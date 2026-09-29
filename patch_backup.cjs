const fs = require('fs');
let code = fs.readFileSync('src/components/BackupCenterTab.tsx', 'utf8');

const lockUI = `  const isPro = currentUserProfile?.isPro || false;
  const restriction = db.checkLimitOrPro('backup', isPro);
  if (!restriction.allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
        <div className="w-20 h-20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-3xl flex items-center justify-center relative rotate-3">
          <Cloud size={40} />
          <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">النسخ الاحتياطي السحابي</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
            {restriction.message}
          </p>
        </div>
        <button 
          onClick={() => {
            const tabBtn = document.getElementById('nav_btn_subscription') || document.getElementById('mob_nav_btn_subscription');
            if (tabBtn) tabBtn.click();
          }}
          className="px-8 py-4 bg-emerald-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-emerald-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          الترقية للنسخة العادية الآن
        </button>
      </div>
    );
  }
`;

// Add Lock to import
if (!code.includes('Lock,')) {
    code = code.replace(/import \{ /, 'import { Lock, ');
}

// Add the check at the top of the component
code = code.replace(/export const BackupCenterTab: React\.FC<BackupCenterTabProps> = \(\{ db, authUser, onRestore \}\) => \{/, `export const BackupCenterTab: React.FC<BackupCenterTabProps> = ({ db, authUser, onRestore }) => {\n  const currentUserProfile = (window as any)._currentUserProfile_hack || { isPro: false };\n`);
// Wait, I need currentUserProfile in BackupCenterTab. Or I can pass `isPro` to BackupCenterTab!
// App.tsx passes: <BackupCenterTab db={db} authUser={authUser} onRestore={handleDatabaseUpdate} />
