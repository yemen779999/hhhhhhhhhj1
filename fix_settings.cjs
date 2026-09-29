const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('Settings,')) {
    code = code.replace(/import \{ /, 'import { Settings, ');
}

fs.writeFileSync('src/App.tsx', code);
