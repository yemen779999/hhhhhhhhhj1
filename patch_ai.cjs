const fs = require('fs');
let code = fs.readFileSync('src/components/AIControlDashboard.tsx', 'utf8');

code = code.replace(/import \{ /g, 'import { Lock, ');
code = code.replace(/interface AIControlDashboardProps \{/, `interface AIControlDashboardProps {\n  isPro?: boolean;\n  onNavigateToSubscription?: () => void;`);
code = code.replace(/export default function AIControlDashboard\(\{ db, onDatabaseUpdate \}: AIControlDashboardProps\) \{/, `export default function AIControlDashboard({ db, onDatabaseUpdate, isPro = false, onNavigateToSubscription }: AIControlDashboardProps) {`);

const limitCheck = `
  const restriction = db.checkLimitOrPro('ai', isPro);
  if (!restriction.allowed) {
    return (
      <div className="flex flex-col items-center justify-center py-20 px-6 text-center space-y-6 bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-800 shadow-sm mx-auto max-w-2xl mt-12 animate-in fade-in zoom-in-95 duration-500" dir="rtl">
        <div className="w-20 h-20 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-3xl flex items-center justify-center relative rotate-3">
          <Sparkles size={40} />
          <Lock size={20} className="absolute -bottom-2 -right-2 bg-slate-900 text-white rounded-full p-1 border-2 border-white" />
        </div>
        <div className="space-y-3">
          <h3 className="text-2xl font-black text-slate-800 dark:text-white">مستشار الذكاء الاصطناعي</h3>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-bold leading-relaxed max-w-md mx-auto">
            {restriction.message}
          </p>
        </div>
        <button 
          onClick={onNavigateToSubscription}
          className="px-8 py-4 bg-amber-500 text-white font-black text-sm rounded-2xl shadow-xl hover:shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all cursor-pointer"
        >
          الترقية للنسخة العادية الآن
        </button>
      </div>
    );
  }
`;

code = code.replace(/const \[executiveMode, setExecutiveMode\] = useState\(false\);/, `${limitCheck}\n\n  const [executiveMode, setExecutiveMode] = useState(false);`);

fs.writeFileSync('src/components/AIControlDashboard.tsx', code);
