from agents.state import WorkflowState
from db_ops import add_log, update_workflow_status, update_task_statuses
import models

async def verifier_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    
    await add_log(workflow_id, "Verifier Agent", "Validating final outputs and marking workflow as completed.")
    
    # In a real system, verifier would check actual systems like CRM, GitHub, etc.
    # Here we just finalize the statuses.
    await update_task_statuses(workflow_id, "completed")
    await update_workflow_status(workflow_id, models.WorkflowStatus.COMPLETED)
    
    return {"execution_status": "verified"}
