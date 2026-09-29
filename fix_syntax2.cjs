const fs = require('fs');

function fix(file) {
  let code = fs.readFileSync(file, 'utf8');
  code = code.replace(/    \}\n    \}\n    if \(restriction\.warning\)/g, '    }\n    if (restriction.warning)');
  fs.writeFileSync(file, code);
}

fix('src/components/AccountsTab.tsx');
