// Bridge release — v60.4.2.
//
// A phone running a v60.1–v60.4.1 build compares versions numerically and never
// installs a downgrade, so it reads the renumbered v60.0.7 as older than itself
// and offers nothing ("you're on the latest version"). The only number such a
// build will accept is one above its own in the OLD style, so this release is
// numbered 60.4.2 on purpose — it is the same code as 60.0.7, plus the mapping
// entry that makes 60.4.2 read as 60.0.7 internally. From here on the renumbered
// releases install normally, and the next one brings the label back to 60.0.x.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const NATIVE = path.join(ROOT, 'dev/native-updates.js');

function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [label, from, to, expect] of edits) {
    const n = s.split(from).length - 1;
    if (n !== expect) {
      console.error(`MISMATCH [${path.basename(file)}] ${label}: found ${n}, expected ${expect}`);
      process.exit(1);
    }
    s = s.split(from).join(to);
    console.log(`  ok ${path.basename(file)} · ${label} (${n})`);
  }
  fs.writeFileSync(file, s);
}

const now = new Date();
const dateStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
const timeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName');
const stamped = `${dateStr} \\u00b7 ${timeStr} ${zone ? zone.value : 'ET'}`;

patch(HTML, [
  ['APP_VERSION', `const APP_VERSION = '60.0.7';`, `const APP_VERSION = '60.4.2';`, 1],
  // The bridge reads as the release it carries.
  [
    'the mapping entry',
    `const LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6' };`,
    `const LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.7' };`,
    1
  ],
  [
    'CHANGELOG head',
    `  { version: '60.0.7', date: '`,
    `  { version: '60.4.2', date: '${stamped}', title: 'One-off bridge build: the same code as v60.0.7, numbered so a pre-renumbering install accepts it', items: [
    'This build exists for one reason: to move a v60.1 – v60.4.1 install onto the renumbered releases. Those builds compare version numbers the old way and read v60.0.7 as OLDER than themselves, so they refused it and nothing was ever offered. The number here (60.4.2) is deliberately from the old style, which is the only kind of number they will accept',
    'It IS v60.0.7. The watermark remover matches whole phrases again instead of single letters, every "go to Spotify" tap opens the Spotify app instead of the logged-out web player inside SideCut, and the rest of 60.0.2 – 60.0.7 is here too. Nothing else changed',
    'Install it once and the update chain is repaired for good: this build carries the mapping that reads the old labels, so the renumbered releases install normally from here on',
    'The version label reads v60.4.2 until the next update, which returns to the new numbering. Nothing in the app depends on the label itself',
  ]},
  { version: '60.0.7', date: '`,
    1
  ],
]);

patch(SW, [
  ['CACHE_NAME', `const CACHE_NAME = 'sidecut-shell-v60.0.7';`, `const CACHE_NAME = 'sidecut-shell-v60.4.2';`, 1],
]);

patch(NATIVE, [
  [
    'the mapping entry (OTA client)',
    `var LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6' };`,
    `var LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.7' };`,
    1
  ],
]);

console.log('bridge stamped: ' + stamped.replace('\\u00b7', '-'));
