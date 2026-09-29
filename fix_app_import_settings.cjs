const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

if (!code.includes('Settings,')) {
    code = code.replace(/import \{ /, 'import { Settings, ');
}

if (!code.includes('Settings,') && code.includes('lucide-react')) {
    code = code.replace(/import \{\n/, "import {\n  Settings,\n");
}

fs.writeFileSync('src/App.tsx', code);
