from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver
from agents.state import WorkflowState
from agents.extractor import extractor_agent
from agents.planner import planner_agent
from agents.executor import executor_agent
from agents.monitor import monitor_agent
from agents.escalation import escalation_agent
from agents.verifier import verifier_agent
from agents.notifier import notifier_agent

def create_workflow_graph():
    workflow = StateGraph(WorkflowState)
    
    # Add Nodes
    workflow.add_node("extractor", extractor_agent)
    workflow.add_node("planner", planner_agent)
    workflow.add_node("executor", executor_agent)
    workflow.add_node("monitor", monitor_agent)
    workflow.add_node("escalation", escalation_agent)
    workflow.add_node("verifier", verifier_agent)
    workflow.add_node("notifier", notifier_agent)
    
    # Define Entry Point
    workflow.set_entry_point("extractor")
    
    # Core Flow
    workflow.add_edge("extractor", "planner")
    workflow.add_edge("planner", "executor")
    workflow.add_edge("executor", "monitor")
    
    # Conditional edge from Monitor to Verify or Escalation
    def route_monitor(state: WorkflowState):
        if state.get("execution_status") == "failed":
            return "escalate"
        return "verify"

    workflow.add_conditional_edges(
        "monitor",
        route_monitor,
        {"escalate": "escalation", "verify": "verifier"}
    )
    
    # Conditional edge from Escalation: Retry (Executor) or END (Failed completely)
    def route_escalation(state: WorkflowState):
        if state.get("execution_status") == "retry":
            return "retry"
        return "end"

    workflow.add_conditional_edges(
        "escalation",
        route_escalation,
        {"retry": "executor", "end": END}
    )
    
    workflow.add_edge("verifier", "notifier")
    workflow.add_edge("notifier", END)
    
    memory = MemorySaver()
    return workflow.compile(checkpointer=memory, interrupt_before=["executor"])

compiled_workflow = create_workflow_graph()
