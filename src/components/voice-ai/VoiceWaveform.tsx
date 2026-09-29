import React from "react";
import { motion } from "motion/react";

interface VoiceWaveformProps {
  bars: number[];
  status: string;
}

export const VoiceWaveform: React.FC<VoiceWaveformProps> = ({ bars, status }) => {
  return (
    <div className="flex items-center justify-center gap-1.5 h-16 w-full px-8 bg-slate-900/40 rounded-full border border-slate-800/50 backdrop-blur-md overflow-hidden">
      {bars.map((height, i) => (
        <motion.div
          key={i}
          initial={{ height: 4 }}
          animate={{ 
            height: height * 1.5,
            backgroundColor: status === "listening" ? "#10b981" : status === "speaking" ? "#6366f1" : "#475569"
          }}
          transition={{ 
            type: "spring", 
            stiffness: 300, 
            damping: 20,
            delay: i * 0.02
          }}
          className="w-1 rounded-full shadow-[0_0_8px_rgba(16,185,129,0.3)]"
        />
      ))}
    </div>
  );
};
