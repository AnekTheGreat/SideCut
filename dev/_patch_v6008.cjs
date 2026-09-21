// Rename the 60.4.2 bridge release to v60.0.8.
//
// Same content, renumbered into the new scheme: a phone that took the bridge is
// internally at 60.0.7, so 60.0.8 is newer and installs; a phone on 60.0.1 or
// older installs it the old way too. '60.4.2' stays in the legacy map, pointing
// at what that build became (60.0.8), so a snapshot, a staged bundle or a stored
// label can never read as newer than this release.
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
  ['APP_VERSION', `const APP_VERSION = '60.4.2';`, `const APP_VERSION = '60.0.8';`, 1],

  // The bridge build is this build now, so the label reads as 60.0.8.
  [
    'the mapping entry',
    `'60.4.1':'60.0.6', '60.4.2':'60.0.7' };`,
    `'60.4.1':'60.0.6', '60.4.2':'60.0.8' };`,
    1
  ],

  // The entry itself is renamed, with notes that read as this release's.
  [
    'the changelog entry',
    `  { version: '60.4.2', date: 'September 20, 2026 \\u00b7 8:51 PM EDT', title: 'One-off bridge build: the same code as v60.0.7, numbered so a pre-renumbering install accepts it', items: [
    'This build exists for one reason: to move a v60.1 – v60.4.1 install onto the renumbered releases. Those builds compare version numbers the old way and read v60.0.7 as OLDER than themselves, so they refused it and nothing was ever offered. The number here (60.4.2) is deliberately from the old style, which is the only kind of number they will accept',
    'It IS v60.0.7. The watermark remover matches whole phrases again instead of single letters, every "go to Spotify" tap opens the Spotify app instead of the logged-out web player inside SideCut, and the rest of 60.0.2 – 60.0.7 is here too. Nothing else changed',
    'Install it once and the update chain is repaired for good: this build carries the mapping that reads the old labels, so the renumbered releases install normally from here on',
    'The version label reads v60.4.2 until the next update, which returns to the new numbering. Nothing in the app depends on the label itself',
  ]},`,
    `  { version: '60.0.8', date: '${stamped}', title: 'Back on the new numbering: this is v60.0.8', items: [
    'The 60.4.2 bridge build is renamed and ships as v60.0.8. The app reports v60.0.8 everywhere, and the 60.4.x numbers are finished — every release from here on is 60.0.x',
    'Everything from 60.0.7 is in it: the watermark remover matches whole phrases again instead of peeling single letters out of unrelated titles, and every "go to Spotify" tap hands the song to the Spotify app instead of loading the logged-out web player inside SideCut',
    'The old labels are still read as the release they became (60.1 \\u2192 60.0.2, 60.2 \\u2192 60.0.3, 60.3 \\u2192 60.0.4, 60.4 \\u2192 60.0.5, 60.4.1 \\u2192 60.0.6, 60.4.2 \\u2192 60.0.8), so a saved snapshot, a staged bundle or an installed older build can never look newer than this one',
    'An install still on a v60.1 – v60.4.1 label that never took 60.4.2 cannot see this build: its own comparison predates the renumbering and it refuses anything it reads as older. The native build (installed once) or the 60.4.2 bridge puts it back in the chain',
  ]},`,
    1
  ],
]);

patch(SW, [
  ['CACHE_NAME', `const CACHE_NAME = 'sidecut-shell-v60.4.2';`, `const CACHE_NAME = 'sidecut-shell-v60.0.8';`, 1],
]);

patch(NATIVE, [
  [
    'the mapping entry (OTA client)',
    `'60.4.1':'60.0.6', '60.4.2':'60.0.7' };`,
    `'60.4.1':'60.0.6', '60.4.2':'60.0.8' };`,
    1
  ],
]);

console.log('stamped: ' + stamped.replace('\\u00b7', '-'));
