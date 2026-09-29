import React from "react";
import { Sparkles, History, CheckCircle, Brain, Terminal, MessageSquare } from "lucide-react";
import { ActivityLog } from "../types";
import { motion } from "motion/react";

interface LiveOperationLoggerProps {
  logs: ActivityLog[];
}

export const LiveOperationLogger: React.FC<LiveOperationLoggerProps> = ({ logs }) => {
  const aiLogs = logs.filter(log => log.entityType === 'ai_operation');

  if (aiLogs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-slate-800/50 text-slate-500">
          <Brain size={32} strokeWidth={1.5} />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-300">لا يوجد عمليات ذكاء اصطناعي</h3>
          <p className="text-xs text-slate-500 max-w-[250px]">
            جميع التفاعلات مع Gemini Live والتحليلات الآلية ستظهر هنا فور تنفيذها.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <div className="flex items-center gap-2">
          <History size={16} className="text-indigo-400" />
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">سجل العمليات المباشرة (Live Logs)</span>
        </div>
        <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded-full font-bold">
          {aiLogs.length} عملية
        </span>
      </div>

      <div className="space-y-2">
        {aiLogs.map((log) => (
          <motion.div
            key={log.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className="group relative bg-slate-900/40 border border-white/5 rounded-2xl p-4 hover:border-indigo-500/30 transition-all overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
              <Sparkles size={40} className="text-indigo-500" />
            </div>

            <div className="flex gap-4 relative z-10">
              <div className="flex flex-col items-center gap-2 pt-1">
                <div className={`p-1.5 rounded-lg border ${
                  log.actionType === 'add' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                  log.actionType === 'edit' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-400' :
                  'bg-slate-500/10 border-slate-500/20 text-slate-400'
                }`}>
                  {log.actionType === 'add' ? <CheckCircle size={14} /> : <Terminal size={14} />}
                </div>
                <div className="w-px h-full bg-slate-800/50" />
              </div>

              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-500 font-mono">
                    {new Date(log.timestamp).toLocaleTimeString('ar-SA')}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-white/5 text-slate-400 border border-white/5">
                      {log.entityId}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-200 leading-relaxed">
                    {log.details}
                  </p>
                  <div className="flex items-center gap-2">
                    <MessageSquare size={10} className="text-indigo-400" />
                    <span className="text-[10px] text-slate-500 italic">Gemini Live Operation</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};
