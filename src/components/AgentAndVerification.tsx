/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, Cloud, ShieldAlert } from 'lucide-react';

interface AgentAndVerificationProps {
  isPro: boolean;
  isDevMode: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
  onActivateDevMode?: () => void;
}

export default function AgentAndVerification({ isPro, isDevMode, isAdmin, children, onActivateDevMode }: AgentAndVerificationProps) {
  const hasAccess = isPro || isDevMode || isAdmin;

  if (!hasAccess) {
    return (
      <div className="glass border border-white/10 rounded-3xl p-8 shadow-xl text-center max-w-2xl mx-auto my-8 space-y-6 animate-in fade-in zoom-in-95 duration-300" dir="rtl">
        <div className="w-20 h-20 bg-indigo-500/10 text-indigo-400 rounded-full flex items-center justify-center mx-auto relative border border-white/10">
          <Cloud size={40} className="stroke-[1.5]" />
          <Lock size={20} className="absolute bottom-1 left-1 bg-slate-900 text-white rounded-full p-0.5 border-2 border-white/10" />
        </div>
        
        <div className="space-y-2">
          <span className="p-1 px-3 bg-indigo-500/10 text-indigo-400 text-[10px] rounded-lg font-black border border-indigo-500/20 uppercase tracking-widest">مزامنة وحماية البيانات</span>
          <h3 className="text-lg font-black text-white">النسخ الاحتياطي السحابي والمزامنة (Cloud Backup & Sync)</h3>
          <p className="text-xs text-slate-400 leading-relaxed max-w-md mx-auto">
            هذه الميزة متاحة فقط في النسخة العادية. قم بالترقية للقدرة على ترحيل بياناتك تلقائياً لحظة بلحظة واستعادتها بضغطة زر عند الطوارئ.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
          {onActivateDevMode && (
            <button
              onClick={onActivateDevMode}
              className="w-full sm:w-auto px-5 py-3 bg-white/5 hover:bg-white/10 text-white border border-white/10 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-lg"
            >
              تفعيل وضع المطور locally 🛠
            </button>
          )}
          <span className="text-xs text-slate-500 font-medium">أو تواصل مع الإدارة لتفعيل Pro لحسابك</span>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
