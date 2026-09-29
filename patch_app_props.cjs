const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<AIControlDashboard \n\s*db=\{db\}\n\s*\/>/g, `<AIControlDashboard db={db} isPro={currentUserProfile?.isPro || false} onNavigateToSubscription={() => setActiveTab('subscription')} />`);
code = code.replace(/<AIControlDashboard db=\{db\} \/>/g, `<AIControlDashboard db={db} isPro={currentUserProfile?.isPro || false} onNavigateToSubscription={() => setActiveTab('subscription')} />`);
code = code.replace(/<BackupCenterTab \n\s*db=\{db\}\n\s*authUser=\{authUser\}\n\s*onRestore=\{handleDatabaseUpdate\}\n\s*\/>/g, `<BackupCenterTab \n                db={db}\n                authUser={authUser}\n                onRestore={handleDatabaseUpdate}\n                isPro={currentUserProfile?.isPro || false}\n                onNavigateToSubscription={() => setActiveTab('subscription')}\n              />`);

fs.writeFileSync('src/App.tsx', code);
