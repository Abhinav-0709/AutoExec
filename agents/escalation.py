from agents.state import WorkflowState
from db_ops import add_log, update_workflow_status
import models

async def escalation_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    failed_reasons = state.get("failed_reasons", [])
    escalated = state.get("escalated", False)
    
    await add_log(workflow_id, "Escalation Agent", "Handling escalation for failed tasks.", details=str(failed_reasons))
    
    if not escalated:
        await add_log(workflow_id, "Escalation Agent", "First failure. Resetting reasons and attempting automatic retry of execution.")
        # Return state to trigger a retry loop via the graph logic
        return {"execution_status": "retry", "failed_reasons": [], "escalated": True}
    else:
        await add_log(workflow_id, "Escalation Agent", "Retry also failed. Escalating to human manager (Workflow halted).")
        await update_workflow_status(workflow_id, models.WorkflowStatus.TERMINAL_FAILURE)
        return {"execution_status": "terminal_failure"}
