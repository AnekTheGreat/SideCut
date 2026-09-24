#!/usr/bin/env node
// v61.3.5 — a version-alignment cut on top of 61.3 (no feature changes).
//
// Same mechanics as patch-611 / patch-612 (str_replace still no-ops on the
// 36k-line index.html, so every edit goes through count==1 assertions here):
//   1. APP_VERSION 61.3 → 61.3.5
//   2. new CHANGELOG head entry (61.3.5) so entries[0].version === APP_VERSION
//   3. sw.js CACHE_NAME → sidecut-shell-v61.3.5
//   4. every dev/test-*.mjs `ver === '…'` pin repinned, plus test-612's
//      literal cache-name / changelog-head assertions
//   5. root manifest.json — the one copy still stuck at v58.0 — brought to
//      this release (same shape as updates.json)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function replaceOnce(oldStr, newStr, label) {
  const got = src.split(oldStr).length - 1;
  if (got !== 1) throw new Error(`${label}: expected 1 occurrence, found ${got}`);
  src = src.replace(oldStr, newStr);
  n++;
  console.log('• ' + label);
}

if (src.includes(`const APP_VERSION = '61.3.5'`)) {
  console.log('patch-6135: already applied');
  process.exit(0);
}

// Sandbox runs on UTC with no tzdata: Eastern = UTC minus 4 hours (EDT).
function easternStamp() {
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h}:${mm} ${ampm} EDT`;
}

replaceOnce(`  const APP_VERSION = '61.3';`, `  const APP_VERSION = '61.3.5';`, 'APP_VERSION → 61.3.5');

// ---------------------------------------------------------------- changelog
const ITEMS = [
  'The app, the service worker and both update channels now carry one release number — 61.3.5 — so Fetch latest, Check for updates and the update history can never disagree about what is running.',
  'A patch cut straight on top of 61.3: no feature changes — this release exists so every surface reports the same number and the update bundles are rebuilt from this exact tree.',
  'The service worker cache is named for this release, so the shell refreshes once when the new build lands and then stays put.',
  'The published update bundles were rebuilt from this exact build, so what Check for updates offers is byte-for-byte the app you are reading about.',
  'The update manifest at the repo root — the one copy that had been left behind at an old release — now points at this one like every other channel file.',
  'Upcoming releases behaves exactly as 61.3 left it: pinned artists are checked with no account connection needed, and every date still comes from the sources that carry it.',
];
const DATE = easternStamp();

const HEAD = `  { version: '61.3', date: 'September 23, 2026 · 9:42 PM EDT', title: 'Homing in on the nothing button', items: [`;
{
  const got = src.split(HEAD).length - 1;
  if (got !== 1) throw new Error(`changelog head: expected 1 occurrence, found ${got}`);
  const entry = `  { version: '61.3.5', date: '${DATE}', title: 'One version number everywhere', items: [\n`
    + ITEMS.map((it) => `    '${it}',`).join('\n')
    + `\n  ] },\n`;
  src = src.replace(HEAD, entry + HEAD);
  n++;
  console.log('• changelog head entry → 61.3.5');
}

// ------------------------------------------------------------------- sw.js
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
if (sw.includes(`const CACHE_NAME = 'sidecut-shell-v61.3';`)) {
  sw = sw.replace(`const CACHE_NAME = 'sidecut-shell-v61.3';`, `const CACHE_NAME = 'sidecut-shell-v61.3.5';`);
  fs.writeFileSync(SW, sw);
  console.log('• sw.js cache → sidecut-shell-v61.3.5');
} else if (!sw.includes(`const CACHE_NAME = 'sidecut-shell-v61.3.5';`)) {
  throw new Error('sw.js: unexpected CACHE_NAME');
}

fs.writeFileSync(FILE, src);

// --------------------------------------------------------------- test pins
let pinned = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(f)) continue;
  const p = path.join(ROOT, 'dev', f);
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes(`ver === '61.3'`)) {
    fs.writeFileSync(p, t.split(`ver === '61.3'`).join(`ver === '61.3.5'`));
    pinned++;
    console.log('• repinned dev/' + f);
  }
}
if (pinned < 7) throw new Error(`expected to repin at least 7 test files, got ${pinned}`);

// test-612 also pins the cache name and the changelog-head position literally.
{
  const p = path.join(ROOT, 'dev', 'test-612.mjs');
  let t = fs.readFileSync(p, 'utf8');
  const swaps = [
    [`sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3';"), 'sw.js cache = sidecut-shell-v61.3'`,
     `sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3.5';"), 'sw.js cache = sidecut-shell-v61.3.5'`, 1],
    [`src.indexOf("version: '61.3'")`, `src.indexOf("version: '61.3.5'")`, 3],
    [`'CHANGELOG head entry is 61.3'`, `'CHANGELOG head entry is 61.3.5'`, 1],
    [`'61.3 is ahead of 61.2'`, `'61.3.5 is ahead of 61.2'`, 1],
  ];
  for (const [a, b, want] of swaps) {
    const got = t.split(a).length - 1;
    if (got !== want) throw new Error(`test-612 "${a}": expected ${want}, found ${got}`);
    t = t.split(a).join(b);
  }
  fs.writeFileSync(p, t);
  console.log('• dev/test-612.mjs literal assertions → 61.3.5');
}

// ------------------------------------------------- root manifest.json (v58.0)
// Same shape as updates.json. size is seeded from the current bundle figure;
// ota-bundle writes the exact size into updates.json when it rebuilds.
const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
const rootMan = { version: '61.3.5', url: 'update.zip', size: upd.size, notes: ITEMS, date: DATE };
fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(rootMan, null, 2) + '\n');
console.log('• root manifest.json → 61.3.5');

console.log(`patch-6135: index.html ${n} replacements, ${pinned} test files repinned`);
