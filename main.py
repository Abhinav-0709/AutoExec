import os
import uuid
import time
import traceback
import google.generativeai as genai

# Silence LangGraph msgpack serialization warnings for custom agent types
os.environ["LANGCHAIN_CHECKPOINT_ALLOWED_MSGPACK_MODULES"] = "agents.state"

from fastapi import FastAPI, BackgroundTasks, HTTPException, Depends, File, UploadFile
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from database import engine, Base, AsyncSessionLocal, get_db
import models
import schemas
from agents.graph import compiled_workflow
from db_ops import add_log, update_workflow_status
from agents.state import WorkflowState
import json

app = FastAPI(title="Meeting-to-Execution Automation System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        
@app.post("/workflows/audio")
async def process_audio(file: UploadFile = File(...)):
    if not os.environ.get("GOOGLE_API_KEY"):
        raise HTTPException(status_code=500, detail="Google API Key missing for audio processing.")
    try:
        genai.configure(api_key=os.environ.get("GOOGLE_API_KEY"))
        temp_file = f"temp_{uuid.uuid4().hex}_{file.filename}"
        with open(temp_file, "wb") as f:
            content = await file.read()
            f.write(content)
            
        # Upload using the Gemini File API
        print(f"Uploading file: {temp_file}")
        genai_file = genai.upload_file(path=temp_file)
        
        # Wait for the file to be processed (ACTIVE state)
        # This is critical for audio/video files before we can use them
        print(f"Waiting for file {genai_file.name} to be processed...")
        while genai_file.state.name == "PROCESSING":
            time.sleep(2)
            genai_file = genai.get_file(genai_file.name)
            
        if genai_file.state.name != "ACTIVE":
            raise Exception(f"File {genai_file.name} failed to process. State: {genai_file.state.name}")
            
        print("File is active. Starting transcription...")
        # Switching to gemini-2.5-flash which is the correct current version
        model = genai.GenerativeModel('gemini-2.5-flash')
        response = model.generate_content([
            "Transcribe this meeting audio. Format it clearly, identifying distinct speakers if possible.",
            genai_file
        ])
        
        # Cleanup
        genai.delete_file(name=genai_file.name)
        os.remove(temp_file)
        
        return {"transcript": response.text}
    except Exception as e:
        print(f"CRITICAL ERROR during audio processing:")
        traceback.print_exc()
        if 'temp_file' in locals() and os.path.exists(temp_file):
            os.remove(temp_file)
        raise HTTPException(status_code=500, detail=str(e))

async def run_langgraph_workflow(workflow_id: int, transcript: str, mode: str):
    initial_state = {
        "workflow_id": workflow_id,
        "transcript": transcript,
        "decisions": [],
        "planned_tasks": [],
        "execution_status": "pending",
        "failed_reasons": [],
        "escalated": False
    }
    
    await add_log(workflow_id, "System", "Starting LangGraph Agent Orchestration loop.")
    config = {"configurable": {"thread_id": str(workflow_id)}}
    
    try:
        # Initial run
        final_state = await compiled_workflow.ainvoke(initial_state, config=config)
        
        while True:
            state_snapshot = compiled_workflow.get_state(config)
            next_steps = state_snapshot.next
            execution_status = final_state.get("execution_status", "pending")

            if next_steps and "executor" in next_steps:
                # If we're in auto mode OR this is a retry loop, auto-resume
                if mode == "auto" or execution_status == "retry":
                    await add_log(workflow_id, "System", f"Auto-resuming execution (Mode: {mode}, Status: {execution_status})")
                    final_state = await compiled_workflow.ainvoke(None, config=config)
                else:
                    # Manual mode and not a retry, wait for approval
                    await update_workflow_status(workflow_id, models.WorkflowStatus.AWAITING_APPROVAL)
                    await add_log(workflow_id, "System", "Waiting for Human Approval to execute tasks.")
                    return
            else:
                # Graph reached END or is at another interrupt we don't handle automatically
                break
                
        await add_log(workflow_id, "System", "Workflow completed graph execution.", details=f"Final status: {final_state.get('execution_status', 'completed')}")
    except Exception as e:
        await update_workflow_status(workflow_id, models.WorkflowStatus.ERROR)
        await add_log(workflow_id, "System", "Fatal error in graph execution", details=str(e))

@app.post("/workflows/{workflow_id}/approve")
async def approve_workflow(workflow_id: int, background_tasks: BackgroundTasks):
    background_tasks.add_task(resume_langgraph_workflow, workflow_id)
    return {"status": "resumed"}

async def resume_langgraph_workflow(workflow_id: int):
    config = {"configurable": {"thread_id": str(workflow_id)}}
    await add_log(workflow_id, "System", "Human approval received. Resuming execution!")
    await update_workflow_status(workflow_id, models.WorkflowStatus.RUNNING)
    try:
        # Resume from where we were (executor)
        final_state = await compiled_workflow.ainvoke(None, config=config)
        
        while True:
            state_snapshot = compiled_workflow.get_state(config)
            next_steps = state_snapshot.next
            execution_status = final_state.get("execution_status", "pending")

            if next_steps and "executor" in next_steps:
                # If it's a retry loop, ALWAYS auto-resume regardless of mode (since approval was once given)
                if execution_status == "retry":
                    await add_log(workflow_id, "System", f"Auto-resuming retry loop (Status: {execution_status})")
                    final_state = await compiled_workflow.ainvoke(None, config=config)
                else:
                    # If it's manual mode again (some unexpected graph loop), stop
                    await update_workflow_status(workflow_id, models.WorkflowStatus.AWAITING_APPROVAL)
                    return
            else:
                break

        await add_log(workflow_id, "System", "Workflow completed graph execution.", details=f"Final status: {final_state.get('execution_status', 'completed')}")
    except Exception as e:
        await add_log(workflow_id, "System", "Fatal error in graph execution", details=str(e))

@app.post("/workflows/process", response_model=schemas.WorkflowOut)
async def process_workflow(payload: schemas.ProcessRequest, background_tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    workflow = models.Workflow(transcript_text=payload.transcript, status=models.WorkflowStatus.RUNNING)
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    
    # Run the langgraph process in background so API remains fast
    background_tasks.add_task(run_langgraph_workflow, workflow.id, payload.transcript, payload.mode)
    
    return workflow

@app.get("/workflows/{id}", response_model=schemas.WorkflowOut)
async def get_workflow(id: int, db: AsyncSession = Depends(get_db)):
    workflow = await db.get(models.Workflow, id)
    if not workflow:
        raise HTTPException(status_code=404, detail="Workflow not found")
    return workflow

@app.get("/tasks", response_model=list[schemas.TaskOut])
async def get_tasks(workflow_id: int = None, db: AsyncSession = Depends(get_db)):
    query = select(models.Task)
    if workflow_id:
        query = query.where(models.Task.workflow_id == workflow_id)
    result = await db.execute(query)
    return result.scalars().all()

@app.get("/logs/{workflow_id}", response_model=list[schemas.LogOut])
async def get_logs(workflow_id: int, db: AsyncSession = Depends(get_db)):
    query = select(models.Log).where(models.Log.workflow_id == workflow_id).order_by(models.Log.timestamp)
    result = await db.execute(query)
    return result.scalars().all()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
