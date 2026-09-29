const fs = require('fs');
let code = fs.readFileSync('src/components/InvoiceTab.tsx', 'utf8');

const oldStr = `{!isPro && (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center relative rotate-3">
          <Receipt size={40} />
          <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">نظام الفواتير والمبيعات</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
            إدارة الفواتير، طباعتها، ومتابعة المشتريات هي ميزات حصرية لمشتركي النسخة العادية.
          </p>
        </div>
        <button 
          onClick={onNavigateToSubscription}
          className="px-8 py-4 bg-rose-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          ترقية النسخة الآن
        </button>
      </div>
    )}`;

const newStr = `{(() => {
      const restriction = db.checkLimitOrPro('invoice', isPro);
      if (restriction.allowed) return null;
      return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-600 dark:text-rose-400 rounded-3xl flex items-center justify-center relative rotate-3">
          <Receipt size={40} />
          <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">نظام الفواتير والمبيعات</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
            {restriction.message}
          </p>
        </div>
        <button 
          onClick={onNavigateToSubscription}
          className="px-8 py-4 bg-rose-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-rose-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          الترقية للنسخة العادية الآن
        </button>
      </div>
    )})()}`;

code = code.replace(oldStr, newStr);
code = code.replace(/\{isPro && \(/g, `{db.checkLimitOrPro('invoice', isPro).allowed && (`);
fs.writeFileSync('src/components/InvoiceTab.tsx', code);
