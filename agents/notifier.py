import os
import resend
from agents.state import WorkflowState
from db_ops import add_log
from dotenv import load_dotenv

load_dotenv()

# Configure Resend
resend.api_key = os.getenv("RESEND_API_KEY")

async def notifier_agent(state: WorkflowState):
    workflow_id = state.get("workflow_id")
    decisions = state.get("decisions", [])
    tasks = state.get("planned_tasks", [])
    recipient = os.getenv("RECIPIENT_EMAIL", "your-email@example.com")
    
    await add_log(workflow_id, "Notifier Agent", "Preparing meeting summary email.")

    # Create HTML Email Content
    decisions_html = "".join([
        f"<li><strong>{d.decision}</strong> (Owner: {d.owner}, Deadline: {d.deadline})</li>" 
        for d in decisions
    ])
    
    tasks_html = "".join([
        f"<li><strong>{t.task}</strong> [{t.priority.upper()}] - assigned to {t.owner}</li>" 
        for t in tasks
    ])

    html_content = f"""
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
        <h2 style="color: #3b82f6;">Meeting Summary & Action Items</h2>
        <p>Your autonomous agent has completed the meeting analysis for <strong>Workflow #{workflow_id}</strong>.</p>
        
        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #1f2937;">Core Decisions</h3>
        <ul>{decisions_html if decisions_html else "<li>No decisions identified.</li>"}</ul>
        
        <h3 style="border-bottom: 1px solid #eee; padding-bottom: 10px; color: #1f2937;">Actionable Tasks</h3>
        <ul>{tasks_html if tasks_html else "<li>No tasks planned.</li>"}</ul>
        
        <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
        <p style="font-size: 12px; color: #6b7280;">Sent automatically by AutoExec Enterprise Suite.</p>
    </div>
    """

    try:
        if resend.api_key and "re_your" not in resend.api_key:
            params = {
                "from": "AutoExec <onboarding@resend.dev>",
                "to": [recipient],
                "subject": f"Meeting Summary: Workflow #{workflow_id}",
                "html": html_content,
            }
            resend.Emails.send(params)
            await add_log(workflow_id, "Notifier Agent", f"Email summary successfully sent to {recipient}")
        else:
            await add_log(workflow_id, "Notifier Agent", "Skipping email send: RESEND_API_KEY not configured or using placeholder.", details="Please update your .env file with a valid API key.")
    except Exception as e:
        await add_log(workflow_id, "Notifier Agent", "Failed to send email summary", details=str(e))

    return state
