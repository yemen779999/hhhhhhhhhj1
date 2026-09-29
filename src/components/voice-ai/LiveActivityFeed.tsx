import React from "react";
import { motion, AnimatePresence } from "motion/react";

interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
}

interface LiveActivityFeedProps {
  messages: Message[];
}

export const LiveActivityFeed: React.FC<LiveActivityFeedProps> = ({ messages }) => {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-[500px] pr-2 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent">
      <AnimatePresence initial={false}>
        {messages.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div className={`max-w-[85%] p-4 rounded-3xl shadow-xl ${
              msg.role === "user" 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-slate-800/80 text-slate-100 border border-slate-700/50 rounded-tl-none backdrop-blur-md"
            }`}>
              <p className="text-sm leading-relaxed">{msg.text}</p>
              <div className={`mt-2 flex items-center gap-2 text-[10px] ${
                msg.role === "user" ? "text-indigo-200" : "text-slate-500"
              }`}>
                <span>{msg.timestamp}</span>
                {msg.role === "assistant" && <span className="w-1 h-1 rounded-full bg-slate-600" />}
                {msg.role === "assistant" && <span>ANAS AI</span>}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};
