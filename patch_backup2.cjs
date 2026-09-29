const fs = require('fs');
let code = fs.readFileSync('src/components/BackupCenterTab.tsx', 'utf8');

code = code.replace(/import \{ Cloud, Download/g, 'import { Lock, Cloud, Download');
code = code.replace(/interface BackupCenterTabProps \{/, `interface BackupCenterTabProps {\n  isPro?: boolean;\n  onNavigateToSubscription?: () => void;`);
code = code.replace(/export const BackupCenterTab: React\.FC<BackupCenterTabProps> = \(\{ db, authUser, onRestore \}\) => \{/, `export const BackupCenterTab: React.FC<BackupCenterTabProps> = ({ db, authUser, onRestore, isPro = false, onNavigateToSubscription }) => {`);

const limitCheck = `
  const restriction = db.checkLimitOrPro('backup', isPro);
  if (!restriction.allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
        <div className="w-20 h-20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-3xl flex items-center justify-center relative rotate-3">
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
          onClick={onNavigateToSubscription}
          className="px-8 py-4 bg-indigo-600 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-indigo-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          الترقية للنسخة العادية الآن
        </button>
      </div>
    );
  }
`;

code = code.replace(/const backupService = authUser \? new BackupService\(authUser\.uid\) : null;/, `const backupService = authUser ? new BackupService(authUser.uid) : null;\n\n${limitCheck}`);

fs.writeFileSync('src/components/BackupCenterTab.tsx', code);
