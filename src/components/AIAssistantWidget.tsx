/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock, Sparkles, Cpu } from 'lucide-react';

interface AIAssistantWidgetProps {
  isPro: boolean;
  isDevMode: boolean;
  isAdmin: boolean;
  children: React.ReactNode;
  onActivateDevMode?: () => void;
  onNavigateToSubscription?: () => void;
}

export default function AIAssistantWidget({ isPro, isDevMode, isAdmin, children, onActivateDevMode, onNavigateToSubscription }: AIAssistantWidgetProps) {
  const hasAccess = isPro || isDevMode || isAdmin;

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
        <div className="w-20 h-20 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center relative rotate-3">
          <Sparkles size={40} />
          <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
        </div>
        
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">مستشار الذكاء الاصطناعي</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
            مساعد الذكاء الاصطناعي ميزة مقفلة في هذه النسخة. يرجى الاشتراك في النسخة العادية للوصول للمستشار الذكي.
          </p>
        </div>

        <button 
          onClick={onNavigateToSubscription}
          className="px-8 py-4 bg-amber-500 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          الترقية للنسخة العادية الآن
        </button>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
          {onActivateDevMode && (
            <button
              onClick={onActivateDevMode}
              className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl text-xs font-bold transition-all duration-150 cursor-pointer shadow-sm"
            >
              تفعيل وضع المطور
            </button>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
