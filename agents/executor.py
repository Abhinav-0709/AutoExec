import asyncio
import random
import os
import resend
from agents.state import WorkflowState
from db_ops import add_log, update_task_statuses, update_individual_task_status

async def executor_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    planned_tasks = state.get("planned_tasks", [])
    
    await add_log(workflow_id, "Executor Agent", "Starting task execution")
    await update_task_statuses(workflow_id, "executing")
    
    failed_reasons = []
    
    # Simulate execution by iterating through tasks
    for task in planned_tasks:
        await add_log(workflow_id, "Executor Agent", f"Executing task: {task.task}")
        # Simulate an API call or work duration
        await asyncio.sleep(1)  # Simulated delay
        
        # If escalated (retry phase), guarantee success!
        escalated = state.get("escalated", False)
        
        # ~30% chance of a mock failure on first run for the demo
        success = True
        if not escalated and random.random() < 0.3:
            success = False
            fail_msg = f"Task '{task.task}' failed due to simulated timeout or CRM error."
            failed_reasons.append(fail_msg)
            await add_log(workflow_id, "Executor Agent", f"Task execution failed", details=fail_msg)
            await update_individual_task_status(workflow_id, task.task, "failed")
        else:
            # Trigger Real Email if Resend setup exists
            resend.api_key = os.environ.get("RESEND_API_KEY")
            target_email = os.environ.get("DEMO_TARGET_EMAIL")
            
            if resend.api_key and target_email:
                try:
                    resend.Emails.send({
                        "from": "onboarding@resend.dev",
                        "to": target_email,
                        "subject": f"AutoExec Enterprise: {task.task}",
                        "html": f"<h3>Task Assigned Successfully</h3><p><strong>Owner:</strong> {task.owner}</p><p><strong>Objective:</strong> {task.task}</p><p><strong>Priority:</strong> {task.priority}</p><hr><p><em>Dispatched automatically by AutoExec Engine.</em></p>"
                    })
                    await add_log(workflow_id, "Executor Agent", f"Task completed and confirmed via Email: {task.task}")
                except Exception as e:
                    await add_log(workflow_id, "Executor Agent", f"Task completed, but email dispatch failed: {str(e)}")
            else:
                await add_log(workflow_id, "Executor Agent", f"Task completed successfully: {task.task}")
            
            # ALWAYS update to completed in DB if we reached here
            await update_individual_task_status(workflow_id, task.task, "completed")
            
    execution_status = "failed" if failed_reasons else "completed"
    
    return {"execution_status": execution_status, "failed_reasons": failed_reasons}
