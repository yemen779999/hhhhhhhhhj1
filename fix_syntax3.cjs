const fs = require('fs');
function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  // I will replace `return;\n    }\n    }` with `return;\n    }`
  code = code.replace(/return;\n    \}\n    \}/g, 'return;\n    }');
  fs.writeFileSync(file, code);
}
fix('src/components/AccountsTab.tsx');
fix('src/components/LedgerTab.tsx');
