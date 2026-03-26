import asyncio
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import AsyncSessionLocal
from models import Workflow, Task, Log, WorkflowStatus, TaskStatus

async def add_log(workflow_id: int, agent_name: str, action: str, details: str = None):
    async with AsyncSessionLocal() as session:
        log = Log(workflow_id=workflow_id, agent_name=agent_name, action=action, details=details)
        session.add(log)
        await session.commit()

async def add_tasks(workflow_id: int, planned_tasks: list):
    async with AsyncSessionLocal() as session:
        for t in planned_tasks:
            # t is a PlannedTask object from state
            task = Task(
                workflow_id=workflow_id, 
                task_description=t.task, 
                owner=t.owner, 
                priority=t.priority,
                confidence=str(t.confidence),
                reason=t.reason
            )
            session.add(task)
        await session.commit()

async def update_workflow_status(workflow_id: int, status: str):
    async with AsyncSessionLocal() as session:
        workflow = await session.get(Workflow, workflow_id)
        if workflow:
            workflow.status = status
            await session.commit()

async def update_task_statuses(workflow_id: int, status: str):
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Task).where(Task.workflow_id == workflow_id))
        tasks = result.scalars().all()
        for t in tasks:
            t.status = status
        await session.commit()
