import React from "react";
import { Check, Circle, Loader2 } from "lucide-react";
import { ThinkingStep } from "../../types";
import { motion, AnimatePresence } from "motion/react";

interface ThinkingTimelineProps {
  steps: ThinkingStep[];
}

export const ThinkingTimeline: React.FC<ThinkingTimelineProps> = ({ steps }) => {
  return (
    <div className="flex flex-col gap-4 p-6 bg-slate-900/60 rounded-3xl border border-slate-800/50 backdrop-blur-xl">
      <h3 className="text-slate-200 font-bold mb-2 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        خطوات العملية
      </h3>
      <div className="space-y-4 relative">
        <div className="absolute left-2.5 top-2 bottom-2 w-px bg-slate-800" />
        <AnimatePresence mode="popLayout">
          {steps.map((step) => (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex items-start gap-4 relative z-10"
            >
              <div className={`mt-1 w-5 h-5 rounded-full flex items-center justify-center border transition-all duration-300 ${
                step.status === 'completed' ? 'bg-emerald-500 border-emerald-500' :
                step.status === 'active' ? 'bg-indigo-500 border-indigo-500 animate-pulse' :
                'bg-slate-800 border-slate-700'
              }`}>
                {step.status === 'completed' && <Check className="w-3 h-3 text-white" />}
                {step.status === 'active' && <Loader2 className="w-3 h-3 text-white animate-spin" />}
                {step.status === 'pending' && <Circle className="w-1.5 h-1.5 text-slate-500" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium transition-colors ${
                  step.status === 'completed' ? 'text-slate-300' :
                  step.status === 'active' ? 'text-white' :
                  'text-slate-500'
                }`}>
                  {step.label}
                </p>
                {step.timestamp && (
                  <span className="text-[10px] text-slate-600 font-mono">{step.timestamp}</span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
