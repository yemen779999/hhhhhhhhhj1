import React from 'react';
import { Lock, Gem, ArrowRight, X } from 'lucide-react';

interface ProRestrictionModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: string;
  onUpgrade: () => void;
}

export default function ProRestrictionModal({ isOpen, onClose, message, onUpgrade }: ProRestrictionModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-md animate-in fade-in duration-200" dir="rtl">
      <div className="glass rounded-[2.5rem] max-w-md w-full shadow-2xl border border-white/10 overflow-hidden relative animate-in zoom-in-95 duration-300">
        
        <button 
          onClick={onClose}
          className="absolute top-6 left-6 text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/5 transition-all"
        >
          <X size={20} />
        </button>

        <div className="p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-amber-500/10 text-amber-400 rounded-3xl flex items-center justify-center mx-auto relative rotate-3 shadow-lg border border-amber-500/20">
            <Gem size={40} className="stroke-[1.5]" />
            <div className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white/10">
              <Lock size={16} />
            </div>
          </div>

          <div className="space-y-2">
            <span className="inline-block px-3 py-1 bg-amber-500/10 text-amber-400 text-[10px] rounded-lg font-black border border-amber-500/20 uppercase tracking-widest">
              ميزة النسخة العادية (REGULAR)
            </span>
            <h3 className="text-2xl font-black text-white leading-tight">عفواً، لقد وصلت للحد الأقصى</h3>
            <p className="text-slate-400 text-sm font-bold leading-relaxed">
              {message}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 pt-2">
            <button
              onClick={onUpgrade}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-indigo-600 text-white font-black text-sm rounded-2xl shadow-xl shadow-indigo-500/20 hover:shadow-indigo-500/40 hover:scale-[1.02] active:scale-95 transition-all cursor-pointer"
            >
              <span>اشترك في النسخة العادية الآن</span>
              <Gem size={18} />
            </button>
            <button
              onClick={onClose}
              className="w-full px-6 py-4 bg-white/5 text-slate-300 font-black text-sm rounded-2xl hover:bg-white/10 border border-white/10 transition-all cursor-pointer"
            >
              ربما لاحقاً
            </button>
          </div>

          <div className="pt-4 border-t border-white/10">
            <p className="text-[10px] text-slate-500 font-medium">
              الاشتراك يمنحك وصولاً كاملاً للذكاء الاصطناعي، النسخ الاحتياطي، وتقارير غير محدودة.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
