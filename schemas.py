from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import datetime
from models import WorkflowStatus, TaskStatus, PriorityLevel

class ProcessRequest(BaseModel):
    transcript: str
    mode: str = "auto"

class TaskBase(BaseModel):
    task_description: str
    owner: Optional[str] = None
    deadline: Optional[str] = None
    priority: Optional[str] = "medium"
    confidence: Optional[str] = None
    reason: Optional[str] = None

class TaskCreate(TaskBase):
    pass

class TaskOut(TaskBase):
    id: int
    workflow_id: int
    status: TaskStatus

    class Config:
        from_attributes = True

class WorkflowCreate(BaseModel):
    transcript_text: str

class WorkflowOut(BaseModel):
    id: int
    status: WorkflowStatus
    created_at: datetime
    
    class Config:
        from_attributes = True

class LogOut(BaseModel):
    id: int
    workflow_id: int
    agent_name: str
    action: str
    timestamp: datetime
    details: Optional[str]

    class Config:
        from_attributes = True
