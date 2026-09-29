const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/\{userRole !== 'Salesperson' && isProUser && \(/g, `{userRole !== 'Salesperson' && (`);
code = code.replace(/disabled=\{\!isProUser\}/g, ``);
code = code.replace(/!isProUser\s*\?\s*`text-slate-500 opacity-50 cursor-not-allowed`\s*:\s*/g, ``);
code = code.replace(/\{\!isProUser && <Lock size=\{12\} className="absolute top-2 right-2 text-rose-500" \/>\}/g, ``);

fs.writeFileSync('src/App.tsx', code);
