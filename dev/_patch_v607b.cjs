// The 60.0.6 entry was stamped from the shell's clock, which has no TZ database:
// `TZ=America/New_York date` silently reported UTC ("12:13 AM EDT" on Sep 21 was
// really 8:13 PM EDT on Sep 20 — four hours ahead, exactly the bug v60.3 fixed).
// The real Eastern time comes from Intl with an explicit timeZone, which is what
// the 60.0.7 entry used.
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
let s = fs.readFileSync(HTML, 'utf8');
const from = `date: 'September 21, 2026 \\u00b7 12:13 AM EDT'`;
const to = `date: 'September 20, 2026 \\u00b7 8:13 PM EDT'`;
const n = s.split(from).length - 1;
if (n !== 1) { console.error(`MISMATCH: found ${n}, expected 1`); process.exit(1); }
fs.writeFileSync(HTML, s.split(from).join(to));
console.log('  60.0.6 stamp corrected to September 20, 2026 · 8:13 PM EDT');
