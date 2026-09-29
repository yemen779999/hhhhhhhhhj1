const fs = require('fs');
let code = fs.readFileSync('src/components/AIControlDashboard.tsx', 'utf8');

// The incorrect replaces made:
// import { Lock, Database } from "../utils";
// import { Lock, Account, DailyLedgerEntry } from "../types";

code = code.replace(/import \{ Lock, Database \} from "\.\.\/utils";/, `import { Database } from "../utils";`);
code = code.replace(/import \{ Lock, Account, DailyLedgerEntry \} from "\.\.\/types";/, `import { Account, DailyLedgerEntry } from "../types";`);
code = code.replace(/import \{ Lock, /g, 'import { '); // remove it entirely if present again
code = code.replace(/import \{/g, 'import {'); // normal form
code = code.replace(/import \{ Cpu,/, 'import { Lock, Cpu,'); // add it to lucide-react

fs.writeFileSync('src/components/AIControlDashboard.tsx', code);
