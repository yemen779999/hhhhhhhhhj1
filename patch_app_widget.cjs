const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<AIAssistantWidget \n\s*isPro=\{isProUser\} \n\s*isDevMode=\{isDevMode\} \n\s*isAdmin=\{isAdminUser\}\n\s*onActivateDevMode=\{\(\) => \{/g, `<AIAssistantWidget \n                  isPro={isProUser} \n                  isDevMode={isDevMode} \n                  isAdmin={isAdminUser}\n                  onNavigateToSubscription={() => setActiveTab('subscription')}\n                  onActivateDevMode={() => {`);

fs.writeFileSync('src/App.tsx', code);
