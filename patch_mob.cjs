const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const oldMobileBtn = `          <button
            id="mob_nav_btn_backup"
            onClick={() => handleNavigateToTab('backup')}
            className={\`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all \${
              activeTab === 'backup' 
                ? \`\${accentBg} text-white shadow-xs\` 
                : 'bg-slate-50 text-emerald-700'
            }\`}
          >
            <span>النسخ الاحتياطي والمزامنة</span>
            <Cloud size={16} className={activeTab === 'backup' ? 'text-white' : 'text-emerald-500'} />
          </button>`;

const newMobileBtn = `${oldMobileBtn}
          
          {userRole !== 'Salesperson' && (
            <button
              id="mob_nav_btn_gateway"
              onClick={() => handleNavigateToTab('gateway')}
              className={\`flex items-center justify-between p-4 rounded-xl text-xs font-extrabold transition-all \${
                activeTab === 'gateway' 
                  ? \`bg-slate-800 text-white shadow-xs\` 
                  : 'bg-slate-50 text-slate-600'
              }\`}
            >
              <span>الإعدادات</span>
              <Settings size={16} className={activeTab === 'gateway' ? 'text-white' : 'text-slate-400'} />
            </button>
          )}`;

code = code.replace(oldMobileBtn, newMobileBtn);
fs.writeFileSync('src/App.tsx', code);
