import operator
from typing import Annotated, TypedDict, List
from pydantic import BaseModel, Field

class Decision(BaseModel):
    decision: str = Field(description="The core decision extracted from the meeting")
    owner: str = Field(default="Unassigned", description="The person assigned to the action or decision")
    deadline: str = Field(default="No deadline", description="The deadline for the decision")
    confidence: float = Field(default=0.95, description="Confidence score between 0.0 and 1.0 tracking accuracy.")
    reason: str = Field(default="Explicitly stated", description="The reasoning or direct quote justifying extraction.")

class PlannedTask(BaseModel):
    task: str = Field(description="The actionable task description")
    owner: str = Field(description="The owner of the task")
    priority: str = Field(description="Priority: low, medium, or high")
    confidence: float = Field(default=0.95, description="Agent confidence score (0.0 to 1.0).")
    reason: str = Field(default="Clear objective", description="Justification for task delegation.")

class WorkflowState(TypedDict):
    workflow_id: int
    transcript: str
    
    # Decisions and tasks
    decisions: List[Decision]
    planned_tasks: List[PlannedTask]
    
    # State tracking
    execution_status: str # "pending", "executing", "completed", "failed"
    failed_reasons: Annotated[List[str], operator.add]
    escalated: bool
