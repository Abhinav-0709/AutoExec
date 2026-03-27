# AutoExec Enterprise (Meeting-to-Execution System)

AutoExec Enterprise is a completely autonomous system built to orchestrate, extract, delegate, and aggressively recover tasks born from standard meeting transcripts or direct inputs. 

This full-stack environment features a sleek Glassmorphic React (Next.js) real-time dashboard powered by an autonomous Multi-Agent LangGraph + FastAPI backend.

---

## What It Automatically Does

1. **Extracts:** Identifies core decisions and actions from noisy meetings.
2. **Plans:** Dynamically scales actions into granular tasks.
3. **Executes:** Fulfills operations and delegates tasks with a 100% precision target.
4. **Monitors & Recovers (Escalation Engine):** Constantly monitors API endpoints. When an execution predictably fails (simulated), the LLMs automatically halt it, isolate the blocker, and trigger a surgical **Retry** loop specifically to achieve total task completion, exactly matching enterprise SLAs.

---

## 🚀 Setup & Execution 

It takes less than 2 minutes to spin up the entire system.

### Prerequisites
- Node.js (v18+)
- Python 3.10+

---

### Step 1: Clone & Configure Backend
Navigate to the root directory and install your Python dependencies inside your environment:
```bash
python -m venv venv
venv\Scripts\activate   # (Windows)
# source venv/bin/activate (Mac/Linux)

pip install -r requirements.txt
```

Set up your `.env` file at the root. You must populate your primary Google AI (Gemini) Key.
```bash
# .env
GOOGLE_API_KEY="your-gemini-key"
DATABASE_URL="sqlite+aiosqlite:///./test.db"
```

Start the FastAPI / LangGraph Server:
```bash
python -m uvicorn main:app --port 8000 --reload
```
---

### Step 2: Configure the Display Frontend
Open a **new terminal tab** and navigate perfectly into the `frontend` folder.

```bash
cd frontend
npm install
npm run dev
```

---

### Step 3: Run the Dashboard
Navigate your browser to `http://localhost:3000`. 
1. The **AutoExec Input** waits on the left lane.
2. Paste any team discussion snippet.
3. Click **Extract & Execute**.
4. Witness the LLM system immediately fire the tasks, watch metrics populate instantly in the Impact Panel, and visually verify the exact moment the Escalation Agent identifies and safely remediates a catastrophic task failure.

Enjoy the demo!
