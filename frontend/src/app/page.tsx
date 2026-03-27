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
      case 'completed': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]';
      case 'failed':
      case 'error':
      case 'terminal_failure':
      case 'escalated': return 'text-rose-400 bg-rose-400/10 border-rose-400/20 shadow-[0_0_15px_rgba(244,63,94,0.2)]';
      case 'executing':
      case 'running': return 'text-blue-400 bg-blue-400/10 border-blue-400/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]';
      case 'awaiting_approval': return 'text-amber-400 bg-amber-400/10 border-amber-400/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]';
      default: return 'text-zinc-500 bg-white/5 border-white/5';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return <CheckCircle className="w-3.5 h-3.5" />;
      case 'failed':
      case 'error':
      case 'terminal_failure':
      case 'escalated': return <AlertTriangle className="w-3.5 h-3.5" />;
      case 'executing':
      case 'running': return <Loader2 className="w-3.5 h-3.5 animate-spin" />;
      case 'awaiting_approval': return <Clock className="w-3.5 h-3.5" />;
      default: return <Clock className="w-3.5 h-3.5" />;
    }
  };
  return (
    <main className="min-h-screen p-4 md:p-8 max-w-[1600px] mx-auto flex flex-col gap-6">
      
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/5 pb-6 mb-2">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-[0_0_20px_rgba(59,130,246,0.5)]">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
              AutoExec
              <span className="text-[10px] uppercase tracking-[0.2em] font-black px-2 py-0.5 rounded-md bg-blue-500/10 border border-blue-500/20 text-blue-400">Enterprise</span>
            </h1>
            <p className="text-zinc-500 text-xs font-medium">Autonomous Task Orchestration Engine</p>
          </div>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-3 bg-white/5 px-4 py-2 rounded-full border border-white/5 shadow-inner">
              <div className={`w-2 h-2 rounded-full ${workflowStatus === 'running' ? 'bg-blue-500 animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.8)]' : workflowStatus === 'idle' ? 'bg-zinc-600' : 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]'}`}></div>
              <span className="text-xs font-bold tracking-widest text-zinc-400 uppercase">System: {workflowStatus || "IDLE"}</span>
          </div>
          {workflowStatus === "awaiting_approval" && (
            <button onClick={handleApprove} className="bg-amber-500 hover:bg-amber-400 text-black px-6 py-2 rounded-xl text-xs font-black transition-all shadow-[0_0_20px_rgba(245,158,11,0.4)] flex items-center gap-2 uppercase tracking-tight">
               <CheckCircle className="w-4 h-4" />
               Approve Execution
            </button>
          )}
        </div>
      </header>

      {/* Impact Metrics Panel */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-2">
        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
           <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black tracking-[0.15em] uppercase">
              <AlertTriangle className="w-3 h-3 text-rose-500" /> Task Failure Rate
           </div>
           <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold tracking-tighter ${metrics.failureRate > 20 ? 'text-rose-400' : 'text-white'}`}>{metrics.failureRate}%</span>
              <span className="text-zinc-600 text-[10px] font-bold uppercase tracking-wider italic">Impact Risk</span>
           </div>
           <div className={`absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 transition-all group-hover:opacity-40 ${metrics.failureRate > 20 ? 'bg-rose-500' : 'bg-blue-500'}`}></div>
        </div>
        
        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
           <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black tracking-[0.15em] uppercase">
              <CheckCircle className="w-3 h-3 text-emerald-500" /> Auto-Delegation
           </div>
           <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tighter text-white">{metrics.assignmentRate}%</span>
              <span className="text-emerald-500/80 text-[10px] font-bold uppercase tracking-wider italic font-mono">assigned</span>
           </div>
           <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 bg-emerald-500 transition-all group-hover:opacity-40"></div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
           <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black tracking-[0.15em] uppercase">
              <Clock className="w-3 h-3 text-blue-500" /> Processing Time
           </div>
           <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tighter text-white">{duration}s</span>
              <span className="text-blue-400/80 text-[10px] font-bold uppercase tracking-wider italic font-mono">Real-time</span>
           </div>
           <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 bg-blue-500 transition-all group-hover:opacity-40"></div>
        </div>

        <div className="glass-panel p-5 rounded-2xl flex flex-col gap-2 relative overflow-hidden group">
           <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-black tracking-[0.15em] uppercase">
              <Activity className="w-3 h-3 text-purple-500" /> AI Confidence
           </div>
           <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold tracking-tighter text-white">{metrics.avgConfidence}%</span>
              <span className="text-purple-400/80 text-[10px] font-bold uppercase tracking-wider italic font-mono">Accuracy</span>
           </div>
           <div className="absolute -right-4 -bottom-4 w-24 h-24 rounded-full blur-[40px] opacity-20 bg-purple-500 transition-all group-hover:opacity-40"></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-230px)]">
        
        {/* Left Column: Input & Orchestration Logs */}
        <div className="lg:col-span-5 flex flex-col gap-6 h-full">
          
          {/* Input Panel */}
          <div className="glass-panel p-6 rounded-2xl flex flex-col gap-4 relative overflow-hidden group">
           <div className="flex items-center justify-between font-bold mb-3 relative z-10 px-1">
              <div className="flex items-center gap-2 text-blue-400 text-xs tracking-widest uppercase">
                <FileText className="w-4 h-4" />
                Meeting context
              </div>
              <div className="flex gap-2">
                <input type="file" id="audio-upload" className="hidden" accept="audio/*, .m4a" onChange={handleAudioUpload}/>
                <label htmlFor="audio-upload" className={`cursor-pointer text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-xl border transition-all flex items-center gap-2 ${isUploading ? 'bg-blue-500/10 border-blue-500/30 text-blue-400' : 'bg-white/5 hover:bg-white/10 border-white/10 text-zinc-400'}`}>
                  {isUploading ? <Loader2 className="w-3 h-3 animate-spin"/> : <Mic className="w-3 h-3"/>}
                  {isUploading ? "Processing..." : "Upload Audio"}
                </label>
              </div>
           </div>
           
           <div className="relative group/textarea">
             <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl blur opacity-0 group-focus-within/textarea:opacity-100 transition duration-500"></div>
             <textarea 
                value={transcript}
                onChange={e => setTranscript(e.target.value)}
                className="w-full h-32 bg-black/60 border border-white/5 rounded-xl p-5 text-sm resize-none focus:outline-none focus:border-blue-500/40 transition-all text-zinc-300 placeholder-zinc-700 relative z-10 font-medium leading-relaxed"
                placeholder="Paste meeting transcript here..."
              />
            </div>
            <button 
              onClick={startWorkflow}
              disabled={!transcript.trim() || workflowStatus === 'starting' || workflowStatus === 'running'}
              className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-[0.2em] transition-all relative overflow-hidden group/btn
                ${(!transcript.trim() || workflowStatus === 'starting' || workflowStatus === 'running') 
                  ? 'bg-white/5 text-zinc-600 cursor-not-allowed border border-white/5' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-[0_0_30px_rgba(59,130,246,0.3)] hover:shadow-[0_0_40px_rgba(59,130,246,0.5)] border border-blue-400/30'}
              `}
            >
              {workflowStatus === 'starting' || workflowStatus === 'running' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> {workflowStatus === 'running' ? 'Active Execution' : 'Initializing'}</>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current transition-transform group-hover/btn:scale-110" /> 
                  Orchestrate Workflow
                </>
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
          <div className="glass-panel rounded-2xl p-6 flex flex-col flex-1 overflow-hidden relative">
            <div className="flex items-center justify-between mb-5 relative z-10 px-1">
              <div className="flex items-center gap-2 text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <Server className="w-3.5 h-3.5 text-purple-400 shadow-[0_0_10px_rgba(167,139,250,0.5)]" /> Agent Orchestration Logs
              </div>
              <div className="flex gap-1">
                <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
                <div className="w-1 h-1 rounded-full bg-zinc-700"></div>
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
          <div className="glass-panel rounded-2xl p-6 h-full flex flex-col relative overflow-hidden">
            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 blur-[100px] -mr-32 -mt-32 rounded-full"></div>
            
            <div className="flex items-center justify-between mb-8 relative z-10 px-1">
              <div className="flex items-center gap-2 text-zinc-400 font-black text-[10px] uppercase tracking-[0.2em]">
                <CheckCircle className="w-4 h-4 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]" /> Assigned Action Items
              </div>
              <div className="text-[10px] font-black text-zinc-400 bg-white/5 px-4 py-1.5 rounded-full border border-white/5 uppercase tracking-widest shadow-inner">
                {tasks.length} {tasks.length === 1 ? 'Task' : 'Tasks'} Detected
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
                        initial={{ opacity: 0, y: 15, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        className="bg-black/40 border border-white/5 rounded-2xl p-6 flex flex-col gap-5 relative overflow-hidden group/card shadow-[0_4px_20px_rgba(0,0,0,0.2)]"
                      >
                        {/* Status Pulse Glow */}
                        <div className={`absolute -right-12 -top-12 w-24 h-24 rounded-full blur-[40px] opacity-10 transition-all duration-700 group-hover/card:opacity-30 ${
                          t.status === 'completed' ? 'bg-emerald-500' : t.status === 'executing' ? 'bg-blue-500' : 'bg-rose-500'
                        }`} />
                        
                        <div className="flex items-start justify-between relative z-10 gap-4">
                          <h3 className="font-semibold text-zinc-100 leading-relaxed text-sm group-hover/card:text-white transition-colors">
                            {t.task_description}
                          </h3>
                        </div>
  
                        {/* AI Confidence Gauge/Bar */}
                        {t.confidence && (
                          <div className="relative z-10 pt-2 pb-1 border-t border-white/5">
                             <div className="flex justify-between items-center mb-2">
                                <span className="text-[9px] text-zinc-500 font-black tracking-widest uppercase">AI Strategic Alignment</span>
                                <span className={`text-[10px] font-black font-mono ${parseFloat(t.confidence) > 0.8 ? "text-emerald-400" : "text-amber-400"}`}>
                                  {Math.round(parseFloat(t.confidence) * 100)}%
                                </span>
                             </div>
                             <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden shadow-inner flex">
                                <motion.div 
                                  initial={{ width: 0 }}
                                  animate={{ width: `${parseFloat(t.confidence) * 100}%` }}
                                  transition={{ duration: 1, ease: "easeOut" }}
                                  className={`h-full rounded-full shadow-[0_0_8px_rgba(59,130,246,0.3)] ${
                                    parseFloat(t.confidence) > 0.8 ? 'bg-gradient-to-r from-emerald-600 to-emerald-400' : 'bg-gradient-to-r from-amber-600 to-amber-400'
                                  }`}
                                />
                             </div>
                             <p className="text-[9px] text-zinc-500 leading-relaxed mt-3 italic bg-white/5 p-2 rounded-lg border border-white/5 font-medium line-clamp-2 hover:line-clamp-none transition-all">
                                &ldquo;{t.reason}&quot;
                             </p>
                          </div>
                        )}
                        
                        <div className="flex items-center justify-between mt-auto pt-4 relative z-10 border-t border-white/5">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-zinc-800 to-zinc-900 border border-white/10 flex items-center justify-center text-xs font-black text-blue-400 shadow-lg group-hover/card:scale-110 transition-transform">
                              {t.owner ? t.owner.charAt(0).toUpperCase() : '?'}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-[8px] text-zinc-500 font-extrabold tracking-widest uppercase">Assignment</span>
                              <span className="text-xs text-zinc-300 font-bold group-hover/card:text-blue-200 transition-colors uppercase tracking-tight">{t.owner || 'Unassigned'}</span>
                            </div>
                          </div>
                          
                          <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border-t border-white/5 shadow-inner transition-all duration-500 ${getStatusColor(t.status)}`}>
                            <span className="w-4">{getStatusIcon(t.status)}</span>
                            <span className="text-[10px] font-black tracking-widest uppercase">{t.status}</span>
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
