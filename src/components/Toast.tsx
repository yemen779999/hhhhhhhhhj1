import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, Gem, ArrowRight } from 'lucide-react';

interface ToastProps {
  show: boolean;
  message: string;
  onClose: () => void;
  onAction?: () => void;
  actionLabel?: string;
  duration?: number;
}

export default function Toast({ show, message, onClose, onAction, actionLabel, duration = 5000 }: ToastProps) {
  useEffect(() => {
    if (show && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[200] w-full max-w-md px-4"
          dir="rtl"
        >
          <div className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl shadow-2xl p-4 flex items-center gap-4 border border-white/10 dark:border-slate-200">
            <div className="flex-shrink-0 w-10 h-10 bg-indigo-500/20 text-indigo-400 dark:text-indigo-600 rounded-xl flex items-center justify-center">
              <Bell size={20} />
            </div>
            
            <div className="flex-grow min-w-0">
              <p className="text-sm font-bold leading-tight">
                {message}
              </p>
            </div>

            {onAction && actionLabel && (
              <button
                onClick={onAction}
                className="flex-shrink-0 px-3 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
              >
                <span>{actionLabel}</span>
                <Gem size={12} />
              </button>
            )}

            <button
              onClick={onClose}
              className="flex-shrink-0 text-slate-400 hover:text-white dark:hover:text-slate-900 p-1"
            >
              <X size={16} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
