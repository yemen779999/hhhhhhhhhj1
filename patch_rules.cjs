const fs = require('fs');
let code = fs.readFileSync('firestore.rules', 'utf8');

code = code.replace(/request\.auth\.token\.email\.lower\(\) == 'guy48942@gmail\.com'/, "request.auth.token.email == 'guy48942@gmail.com'");

fs.writeFileSync('firestore.rules', code);
