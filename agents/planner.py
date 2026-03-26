from langchain_core.prompts import ChatPromptTemplate
from agents.state import WorkflowState, PlannedTask
from agents.llm_config import get_llm
from pydantic import BaseModel, Field
from typing import List
from db_ops import add_log, add_tasks
import json

class PlannerOutput(BaseModel):
    tasks: List[PlannedTask] = Field(description="Actionable tasks broken down from decisions")

async def planner_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    decisions = state.get("decisions", [])
    
    await add_log(workflow_id, "Planner Agent", "Started planning tasks")
    
    if not decisions:
        await add_log(workflow_id, "Planner Agent", "No decisions to plan")
        return {"planned_tasks": []}
    
    llm = get_llm()
    structured_llm = llm.with_structured_output(PlannerOutput)
    
    decisions_str = "\n".join([f"- {d.decision} (Owner: {d.owner}, Deadline: {d.deadline})" for d in decisions])
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are a project manager. Break down the following decisions into specific, actionable tasks. Assign an owner and a priority (low, medium, high) to each task."),
        ("user", "Decisions:\n{decisions_str}")
    ])
    
    chain = prompt | structured_llm
    result = await chain.ainvoke({"decisions_str": decisions_str})
    planned_tasks = result.tasks
    
    # Save the planned tasks to DB immediately 
    await add_tasks(workflow_id, planned_tasks)
    
    await add_log(workflow_id, "Planner Agent", "Completed planning", details=f"Created {len(planned_tasks)} tasks")
    
    return {"planned_tasks": planned_tasks}
