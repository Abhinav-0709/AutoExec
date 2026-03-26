from langchain_core.prompts import ChatPromptTemplate
from agents.state import WorkflowState, Decision
from agents.llm_config import get_llm
from pydantic import BaseModel, Field
from typing import List
from db_ops import add_log

class ExtractorOutput(BaseModel):
    decisions: List[Decision] = Field(description="List of extracted decisions from the transcript")

async def extractor_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    transcript = state.get("transcript", "")
    
    await add_log(workflow_id, "Extractor Agent", "Started analyzing transcript")
    
    llm = get_llm()
    structured_llm = llm.with_structured_output(ExtractorOutput)
    
    prompt = ChatPromptTemplate.from_messages([
        ("system", "You are an expert meeting analyst. Extract all core decisions from the provided meeting transcript. Identify the decision, the assigned owner (or 'Unassigned' if none), and the deadline (or 'No deadline')."),
        ("user", "Transcript:\n{transcript}")
    ])
    
    chain = prompt | structured_llm
    result = await chain.ainvoke({"transcript": transcript})
    
    await add_log(workflow_id, "Extractor Agent", f"Completed extraction", details=f"Extracted {len(result.decisions)} decisions")
    
    return {"decisions": result.decisions}
