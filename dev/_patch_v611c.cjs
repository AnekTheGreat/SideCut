#!/usr/bin/env node
// One-off tidy: the client's legacy-map comment, after the map was cut back to
// the two labels a live install can still be sitting on.
const fs = require('fs');
const path = require('path');

const CLIENT = path.join(__dirname, '..', 'dev', 'native-updates.js');

const FROM =
  `  // (60.1 → 60.0.2, 60.4.1 → 60.0.6, 60.4.2 → 60.0.8). A phone can still be\n` +
  `  // running one of those\n` +
  `  // old labels — and the comparison runs in the build that is INSTALLED, so the\n` +
  `  // mapping has to live here too: read as-is, "60.4" is newer than 60.0.6 and this\n` +
  `  // client would refuse the renumbered build as a downgrade for ever.\n`;

const TO =
  `  // (60.1 → 60.0.2, 60.4.1 → 60.0.6, 60.4.2 → 60.0.8). A phone can still be\n` +
  `  // running one of those old labels — and the comparison runs in the build that\n` +
  `  // is INSTALLED, so the mapping has to live here too: read as-is, "60.4" is newer\n` +
  `  // than 60.0.6 and this client would refuse the renumbered build for ever.\n`;

const src = fs.readFileSync(CLIENT, 'utf8');
if (src.split(FROM).length - 1 !== 1) throw new Error('client comment block not found as expected');
fs.writeFileSync(CLIENT, src.split(FROM).join(TO));
console.log('  ✓ dev/native-updates.js comment tidied\n');
