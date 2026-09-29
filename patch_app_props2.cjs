const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/<AIControlDashboard \n\s*db=\{db\}\n\s*onDatabaseUpdate=\{handleDatabaseUpdate\}\n\s*\/>/g, `<AIControlDashboard \n                db={db}\n                onDatabaseUpdate={handleDatabaseUpdate}\n                isPro={currentUserProfile?.isPro || false}\n                onNavigateToSubscription={() => setActiveTab('subscription')}\n              />`);

fs.writeFileSync('src/App.tsx', code);
