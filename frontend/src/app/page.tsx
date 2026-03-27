"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, CheckCircle, Clock, AlertTriangle, Activity, Server, FileText, Loader2, Mic } from 'lucide-react';

const API_BASE = "http://localhost:8000";

// Some mock transcript to make life easy during demo
const MOCK_TRANSCRIPT = `Sarah: Alright team, let's wrap this up. We need to launch the new marketing campaign by Wednesday. John, you're on creative assets.
John: Got it. I'll have the banners done by tomorrow.
Sarah: Great. Emily, you need to update the CRM with the new leads list before the launch.
Emily: Sure, I can handle that. Is there a deadline?
Sarah: Let's say Tuesday EOD. Also we need to email the VIP clients about the early access, Alex, can you take that?
Alex: Yes, I'll draft the email and send it out on Monday.`;

export default function Home() {
  const [transcript, setTranscript] = useState(MOCK_TRANSCRIPT);
  const [workflowId, setWorkflowId] = useState<number | null>(null);
  const [workflowStatus, setWorkflowStatus] = useState<string>("idle");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [logs, setLogs] = useState<unknown[]>([]);
  const [tasks, setTasks] = useState<unknown[]>([]);
  const [duration, setDuration] = useState<number>(0);
  const [isUploading, setIsUploading] = useState(false);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const logsContainerRef = useRef<HTMLDivElement>(null);

  // Auto scroll logs
  useEffect(() => {
    const container = logsContainerRef.current;
    if (container) {
      const isNearBottom = container.scrollHeight - container.scrollTop <= container.clientHeight + 100;
      if (isNearBottom) {
        logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
      }
    }
  }, [logs]);

  // Duration timer
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;
    if (workflowStatus === 'running' && logs.length > 0) {
      timer = setInterval(() => {
        const firstLog = logs[0] as { timestamp: string };
        const firstLogTime = new Date(firstLog.timestamp).getTime();
        setDuration(Math.floor((Date.now() - firstLogTime) / 1000));
      }, 1000);
    } else if (workflowStatus === 'completed' || workflowStatus === 'failed') {
      if (logs.length > 1) {
        const firstLog = logs[0] as { timestamp: string };
        const lastLog = logs[logs.length - 1] as { timestamp: string };
        const start = new Date(firstLog.timestamp).getTime();
        const end = new Date(lastLog.timestamp).getTime();
        setDuration(Math.floor((end - start) / 1000));
      }
    }
    return () => clearInterval(timer);
  }, [workflowStatus, logs]);

  const metrics = React.useMemo(() => {
    const total = tasks.length;
    if (total === 0) return { failureRate: 0, assignmentRate: 0, avgConfidence: 0 };
    
    const failed = tasks.filter((t: unknown) => {
      const task = t as { status: string };
      return task.status === 'failed' || task.status === 'error';
    }).length;

    const assigned = tasks.filter((t: unknown) => {
      const task = t as { owner?: string };
      return task.owner && task.owner !== 'Unassigned';
    }).length;

    const sumConf = tasks.reduce((acc: number, t: unknown) => {
      const task = t as { confidence?: string };
      return acc + (parseFloat(task.confidence || "0") || 0);
    }, 0);

    return {
      failureRate: Math.round((failed / total) * 100),
      assignmentRate: Math.round((assigned / total) * 100),
      avgConfidence: Math.round((sumConf / total) * 100)
    };
  }, [tasks]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (workflowId && !["completed", "escalated", "terminal_failure", "error", "awaiting_approval"].includes(workflowStatus)) {
      interval = setInterval(async () => {
        try {
          const logsRes = await axios.get(`${API_BASE}/logs/${workflowId}`);
          setLogs(logsRes.data);

          const tasksRes = await axios.get(`${API_BASE}/tasks?workflow_id=${workflowId}`);
          setTasks(tasksRes.data);

          const wfRes = await axios.get(`${API_BASE}/workflows/${workflowId}`);
          const status = wfRes.data.status.toLowerCase();
          setWorkflowStatus(status);
          
          if (["completed", "escalated", "terminal_failure", "error", "awaiting_approval"].includes(status)) {
            // Stop polling for terminal or waiting states
            clearInterval(interval);
          }
        } catch (e) {
          console.error(e);
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [workflowId, workflowStatus]);

  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const res = await axios.post(`${API_BASE}/workflows/audio`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      setTranscript(res.data.transcript);
    } catch (err) {
      console.error(err);
      alert("Failed to transcribe audio. Ensure backend is running and Gemini API key is valid.");
    } finally {
      setIsUploading(false);
      e.target.value = ""; 
    }
  };

  const startWorkflow = async () => {
    if (!transcript.trim()) return;
    setWorkflowStatus("starting");
    setLogs([]);
    setTasks([]);
    try {
      const processRes = await axios.post(`${API_BASE}/workflows/process`, {
        transcript: transcript,
        mode: mode
      });
      setWorkflowId(processRes.data.id);
    } catch (e) {
      console.error("Failed to start workflow", e);
      setWorkflowStatus("error");
    }
  };

  const handleApprove = async () => {
    try {
      await axios.post(`${API_BASE}/workflows/${workflowId}/approve`);
      setWorkflowStatus("running");
    } catch (err) {
      console.error(err);
      alert("Approval failed.");
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
      case 'failed':
      case 'error':
      case 'terminal_failure':
      case 'escalated': return 'text-rose-400 bg-rose-400/10 border-rose-400/20';
      case 'executing':
      case 'running': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      case 'awaiting_approval': return 'text-amber-400 bg-amber-400/10 border-amber-400/20';
      default: return 'text-zinc-400 bg-zinc-800 border-zinc-700';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle className="w-4 h-4" />;
      case 'failed':
      case 'error':
      case 'terminal_failure':
      case 'escalated': return <AlertTriangle className="w-4 h-4" />;
      case 'executing':
      case 'running': return <Loader2 className="w-4 h-4 animate-spin" />;
      case 'awaiting_approval': return <Clock className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };
  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 pb-6 mb-2">
        <div className="flex items-center gap-3 text-blue-500">
          <Activity className="w-8 h-8" />
          <h1 className="text-2xl font-bold tracking-tight text-white">AutoExec<span className="text-blue-500 text-sm font-medium tracking-normal ml-2 px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20">Enterprise</span></h1>
        </div>
        <div className="flex items-center gap-4 text-sm font-medium text-zinc-400">
           <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${workflowStatus === 'running' ? 'bg-blue-500 animate-pulse' : workflowStatus === 'idle' ? 'bg-zinc-500' : 'bg-emerald-500'}`}></div>
            Status: {workflowStatus.toUpperCase()}
          </div>
          {workflowStatus === "awaiting_approval" && (
            <button onClick={handleApprove} className="bg-amber-500 hover:bg-amber-400 text-black px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-lg flex items-center gap-2 pulse-amber">
               <CheckCircle className="w-4 h-4" />
               Approve Execution
            </button>
          )}
        </div>
      </header>

      {/* Impact Metrics Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden">
           <div className="text-zinc-400 text-xs font-bold tracking-wider uppercase">Task Failure Rate</div>
           <div className="flex items-end gap-2">
              <span className={`text-2xl font-bold ${metrics.failureRate > 20 ? 'text-rose-400' : 'text-white'}`}>{metrics.failureRate}%</span>
              <span className="text-zinc-500 text-xs font-medium mb-1">Impact Risk</span>
           </div>
           <div className={`absolute right-0 bottom-0 top-0 w-16 bg-gradient-to-l ${metrics.failureRate > 20 ? 'from-rose-500/10' : 'from-blue-500/10'} to-transparent`}></div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden">
           <div className="text-zinc-400 text-xs font-bold tracking-wider uppercase">Auto-Delegation</div>
           <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{metrics.assignmentRate}%</span>
              <span className="text-emerald-400 text-xs font-medium mb-1">assigned</span>
           </div>
           <div className="absolute right-0 bottom-0 top-0 w-16 bg-gradient-to-l from-emerald-500/10 to-transparent"></div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden">
           <div className="text-zinc-400 text-xs font-bold tracking-wider uppercase">Processing Time</div>
           <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{duration}s</span>
              <span className="text-blue-400 text-xs font-medium mb-1">Real-time</span>
           </div>
           <div className="absolute right-0 bottom-0 top-0 w-16 bg-gradient-to-l from-blue-500/10 to-transparent"></div>
        </div>
        <div className="glass-panel p-4 rounded-xl flex flex-col gap-1 relative overflow-hidden">
           <div className="text-zinc-400 text-xs font-bold tracking-wider uppercase">AI Confidence</div>
           <div className="flex items-end gap-2">
              <span className="text-2xl font-bold text-white">{metrics.avgConfidence}%</span>
              <span className="text-purple-400 text-xs font-medium mb-1">Accuracy</span>
           </div>
           <div className="absolute right-0 bottom-0 top-0 w-16 bg-gradient-to-l from-purple-500/10 to-transparent"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-230px)]">
        
        {/* Left Column: Input & Orchestration Logs */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">
          
          {/* Input Panel */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden group">
           <div className="flex items-center justify-between font-medium mb-1 relative z-10">
              <div className="flex items-center gap-2 text-blue-400">
                <FileText className="w-5 h-5" />
                Meeting Transcript
              </div>
               <div>
                 <input type="file" id="audio-upload" className="hidden" accept="audio/*, .m4a" onChange={handleAudioUpload}/>
                 <label htmlFor="audio-upload" className="cursor-pointer text-xs font-semibold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 text-zinc-300 flex items-center gap-2 transition-all mt-1">
                   {isUploading ? <Loader2 className="w-3 h-3 animate-spin text-blue-400"/> : <Mic className="w-4 h-4 text-zinc-400"/>}
                   {isUploading ? "Gemini is processing audio..." : "Upload Audio"}
                 </label>
               </div>
           </div>
           
           <textarea 
              value={transcript}
              onChange={e => setTranscript(e.target.value)}
              className="w-full h-32 bg-black/40 border border-white/5 rounded-xl p-4 text-sm resize-none focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all text-zinc-300 placeholder-zinc-600"
              placeholder="Paste meeting transcript here to extract tasks..."
            />
            <button 
              onClick={startWorkflow}
              disabled={!transcript.trim() || workflowStatus === 'starting' || workflowStatus === 'running'}
              className={`w-full py-4 rounded-xl flex items-center justify-center gap-3 font-semibold text-sm transition-all shadow-lg mt-2
                ${(!transcript.trim() || workflowStatus === 'starting' || workflowStatus === 'running') 
                  ? 'bg-white/5 text-zinc-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white hover:shadow-blue-500/20'}
              `}
            >
              {workflowStatus === 'starting' || workflowStatus === 'running' ? (
                <><Loader2 className="w-5 h-5 animate-spin" /> {workflowStatus === 'running' ? 'Executing Workflow...' : 'Starting...'}</>
              ) : (
                <><Play className="w-5 h-5 fill-current" /> Extract & Execute</>
              )}
            </button>
            <div className="flex items-center justify-between text-xs text-zinc-400">
               <div className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" id="approval-mode" checked={mode === "manual"} onChange={(e) => setMode(e.target.checked ? "manual" : "auto")} className="rounded bg-black/40 border-white/10 w-4 h-4" />
                  <label htmlFor="approval-mode" className="cursor-pointer font-medium hover:text-white transition-colors">Require Human Approval before Execution</label>
               </div>
            </div>
          </div>

          {/* Logs Panel */}
          <div className="glass-panel rounded-2xl p-5 flex flex-col flex-1 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm uppercase tracking-wider">
                <Server className="w-4 h-4 text-purple-400" /> Agent Orchestration Logs
              </div>
            </div>
            
            <div ref={logsContainerRef} className="flex-1 overflow-y-auto pr-2 flex flex-col gap-3 relative">
              <AnimatePresence>
                {logs.length === 0 && workflowStatus !== 'idle' && (
                  <motion.div initial={{opacity:0}} animate={{opacity:1}} className="text-zinc-500 text-sm italic py-4 text-center">Waiting for orchestration to begin...</motion.div>
                )}
                {logs.map((log: unknown) => {
                  const l = log as { id: string, agent_name: string, timestamp: string, action: string, details?: string };
                  return (
                    <motion.div 
                      key={l.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="flex flex-col gap-1 text-sm bg-white/5 rounded-lg p-3 border border-white/5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-purple-300">{l.agent_name}</span>
                        <span className="text-xs text-zinc-500">{new Date(l.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}</span>
                      </div>
                      <span className="text-zinc-300">{l.action}</span>
                      {l.details && (
                        <div className="mt-2 text-xs bg-black/40 p-2 rounded border border-white/5 text-zinc-400 font-mono break-words whitespace-pre-wrap">
                          {l.details}
                        </div>
                      )}
                    </motion.div>
                  );
                })}
              </AnimatePresence>
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* Right Column: Active Task Execution */}
        <div className="lg:col-span-7 flex flex-col h-full">
          <div className="glass-panel rounded-2xl p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2 text-zinc-300 font-semibold text-sm uppercase tracking-wider">
                <CheckCircle className="w-4 h-4 text-emerald-400" /> Assigned Action Items
              </div>
              <div className="text-sm font-medium text-zinc-400 bg-white/5 px-3 py-1 rounded-full border border-white/5">
                {tasks.length} Tasks Tracked
              </div>
            </div>
            
            {tasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 text-zinc-500 gap-4">
                <Server className="w-12 h-12 opacity-20" />
                <p>No actionable items extracted yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 overflow-y-auto pr-2 pb-4 self-start w-full content-start">
                <AnimatePresence>
                  {tasks.map((task: unknown) => {
                    const t = task as { id: string, task_description: string, priority: string, confidence: string, reason: string, owner: string, status: string };
                    return (
                      <motion.div 
                        key={t.id}
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        transition={{ type: "spring", stiffness: 200, damping: 20 }}
                        className="bg-black/40 border border-white/10 rounded-xl p-5 flex flex-col gap-4 relative overflow-hidden group"
                      >
                        {/* Decorative gradient for priority */}
                        <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl -mr-10 -mt-10 opacity-20 transition-all ${
                          t.priority === 'high' ? 'bg-rose-500' : t.priority === 'medium' ? 'bg-amber-500' : 'bg-blue-500'
                        }`} />
                        
                        <div className="flex items-start justify-between relative z-10 gap-2">
                          <h3 className="font-medium text-zinc-200 leading-snug">{t.task_description}</h3>
                        </div>
  
                        {/* AI Explainability Trace */}
                        {t.confidence && (
                          <div className="flex flex-col gap-1 mt-1 p-3 bg-black/50 border border-white/5 rounded-lg relative z-10">
                            <div className="flex justify-between items-center text-xs">
                               <span className="text-zinc-500 font-semibold tracking-wider uppercase">AI Confidence Score</span>
                               <span className={parseFloat(t.confidence) > 0.8 ? "text-emerald-400 font-mono" : "text-amber-400 font-mono"}>
                                 {Math.round(parseFloat(t.confidence) * 100)}%
                               </span>
                            </div>
                            <div className="text-xs text-zinc-400 leading-relaxed border-t border-white/5 pt-2 mt-1 italic">
                               &quot;{t.reason}&quot;
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-auto pt-2 relative z-10">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center text-xs font-bold text-white shadow-lg">
                              {t.owner ? t.owner.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-xs text-zinc-500 font-medium tracking-wide uppercase">Owner</span>
                              <span className="text-sm text-zinc-300">{t.owner || 'Unassigned'}</span>
                            </div>
                          </div>
                          
                          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border ${getStatusColor(t.status)} text-xs font-semibold tracking-wide uppercase shadow-sm`}>
                            {getStatusIcon(t.status)}
                            {t.status}
                          </div>
                        </div>
  
                        {/* Deadline bar if executing */}
                        {t.status === 'executing' && (
                          <div className="absolute bottom-0 left-0 h-1 bg-blue-500/20 w-full">
                             <motion.div 
                               initial={{ width: "0%" }}
                               animate={{ width: "100%" }}
                               transition={{ duration: 2, repeat: Infinity }}
                               className="h-full bg-blue-500"
                             />
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </div >
    </main >
  );
}
