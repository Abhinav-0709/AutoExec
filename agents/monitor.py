from agents.state import WorkflowState
from db_ops import add_log, update_workflow_status

async def monitor_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    status = state.get("execution_status")
    
    await add_log(workflow_id, "Monitor Agent", f"Monitoring execution health. Status: {status}")
    
    if status == "failed":
        await add_log(workflow_id, "Monitor Agent", "Detected failures in execution! Routing to Escalation.")
        return {"execution_status": "failed"}
    else:
        await add_log(workflow_id, "Monitor Agent", "All tasks executed successfully. Routing to Verifier.")
        return {"execution_status": "completed"}
