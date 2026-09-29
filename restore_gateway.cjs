const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const gatewayBtn = `
          {userRole !== 'Salesperson' && (
            <button
              id="nav_btn_gateway"
              onClick={() => handleNavigateToTab('gateway')}
              title="الإعدادات"
              className={\`group flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-bold transition-all duration-300 cursor-pointer interactive-tap \${
                activeTab === 'gateway' 
                  ? \`bg-slate-800 text-white shadow-lg\` 
                  : \`text-slate-400 hover:text-white hover:bg-white/5\`
              }\`}
            >
              <Settings size={20} className={\`icon-bounce transition-colors mx-auto xl:mx-0 \${activeTab === 'gateway' ? 'text-white' : 'text-slate-500 group-hover:text-white'}\`} />
              <span className="hidden xl:block">الإعدادات</span>
            </button>
          )}
`;

code = code.replace(/\{\/\* Removed Gateway Button \(Admin Portal\) as requested \*\/\}/g, gatewayBtn);

const gatewayTabRender = `
          {activeTab === 'gateway' && userRole !== 'Salesperson' && (
            <ErrorBoundary fallbackTitle="حدث خطأ أثناء تحميل الإعدادات">
              <GatewayTab 
                db={db}
                onDatabaseUpdate={handleDatabaseUpdate}
                role={userRole}
              />
            </ErrorBoundary>
          )}
`;

code = code.replace(/\{\/\* Removed Gateway Rendering \(Admin Portal\) \*\/\}/g, gatewayTabRender);

fs.writeFileSync('src/App.tsx', code);
