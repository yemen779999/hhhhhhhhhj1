const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(/import \{ Settings, Database \} from '\.\/utils';/, "import { Database } from './utils';");
if (!code.includes('Settings, ') && !code.match(/Settings[, }]/)) {
    code = code.replace(/import \{ /, 'import { Settings, ');
}

fs.writeFileSync('src/App.tsx', code);
