from sqlalchemy import Column, String, Integer, DateTime, ForeignKey, Text, CheckConstraint, Enum
from sqlalchemy.orm import relationship
from datetime import datetime
import enum
from database import Base

class WorkflowStatus(str, enum.Enum):
    PENDING = "pending"
    RUNNING = "running"
    AWAITING_APPROVAL = "awaiting_approval"
    COMPLETED = "completed"
    ESCALATED = "escalated"
    ERROR = "error"
    TERMINAL_FAILURE = "terminal_failure"

class TaskStatus(str, enum.Enum):
    PENDING = "pending"
    EXECUTING = "executing"
    COMPLETED = "completed"
    DELAYED = "delayed"
    FAILED = "failed"
    ESCALATED = "escalated"

class PriorityLevel(str, enum.Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"

class Workflow(Base):
    __tablename__ = "workflows"

    id = Column(Integer, primary_key=True, index=True)
    status = Column(String, default=WorkflowStatus.PENDING)
    created_at = Column(DateTime, default=datetime.utcnow)
    transcript_text = Column(Text, nullable=False)

    tasks = relationship("Task", back_populates="workflow", cascade="all, delete-orphan")
    logs = relationship("Log", back_populates="workflow", cascade="all, delete-orphan")


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    task_description = Column(String, nullable=False)
    owner = Column(String, nullable=True)
    status = Column(String, default=TaskStatus.PENDING)
    deadline = Column(String, nullable=True) # E.g. "2 days", could be datetime in a real app
    priority = Column(String, default=PriorityLevel.MEDIUM)
    confidence = Column(String, nullable=True) # Kept as string for SQLite ease, e.g. "0.95"
    reason = Column(Text, nullable=True)

    workflow = relationship("Workflow", back_populates="tasks")


class Log(Base):
    __tablename__ = "logs"

    id = Column(Integer, primary_key=True, index=True)
    workflow_id = Column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False)
    agent_name = Column(String, nullable=False)
    action = Column(Text, nullable=False)
    timestamp = Column(DateTime, default=datetime.utcnow)
    details = Column(String, nullable=True) # JSON payload string or brief description

    workflow = relationship("Workflow", back_populates="logs")
