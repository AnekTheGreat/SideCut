#!/usr/bin/env node
// SideCut - 63.1.2: the release that stops the check rebuilding its own panel.
//
//   * APP_VERSION moves 63.1.1 -> 63.1.2 (a step inside the 63 line).
//   * sw.js CACHE_NAME moves 63.0.12 -> 63.0.13 (its own number, decoupled).
//   * New head CHANGELOG entry; the 63.1.1 entry stays below it.
//
// The head entry is written as SIX notes on purpose: the OTA channel carries only
// the first six (`slice(0, 6)` in the bundle scripts) and test-616..620 assert
// `items.length >= 5` on it. The notes are shared between channels, so they must
// carry no `download` / `converter` / bare `convert` term and must never name the
// play build.
//
//   node dev/patch-654.mjs
//   node dev/patch-654.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.1.2';
const OLD_VER = '63.1.1';
const STAMP = 'September 27, 2026 \u00b7 3:54 AM EDT';
const OLD_STAMP = 'September 27, 2026 \u00b7 12:18 AM EDT';
const SW_CACHE = '63.0.13';
const OLD_SW_CACHE = '63.0.12';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'The release check updates the panel in place and shows its progress', items: [
    'Asking for upcoming releases no longer rebuilds the panel for every artist it reads. The check refreshed its list as each artist came back, and that refresh re-created the whole panel - header, buttons, rows and tabs - so the list visibly rebuilt itself several times while you watched it.',
    'The panel now shows a progress bar while the check is running, with the count moving 0/4, 1/4 and so on, so you can see it working instead of guessing.',
    'The bar goes away when the check finishes and the panel settles back into a plain list of what it found.',
    'Whatever you did in the panel while the check ran is kept: the tab you picked stays put and the list no longer jumps back to the top as results land.',
    'A release you removed by holding it stays removed, even if a check that was already running finishes afterwards.',
    'Nothing about which sources are read changed - SideCut still asks the open release catalogs directly, with no account and nothing to connect.',
  ] },
`;

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

function headEntry() {
  const entryMark = "  { version: '" + VER + "',";
  const endMark = '\n  ] },\n';
  const at = src.indexOf(entryMark);
  if (at === -1) {
    const headMark = 'const CHANGELOG = [\n';
    sub('CHANGELOG head entry', headMark, headMark + ENTRY, 1, entryMark);
    return;
  }
  const end = src.indexOf(endMark, at);
  if (end === -1) throw new Error('CHANGELOG: no end for the ' + VER + ' entry');
  const existing = src.slice(at, end + endMark.length);
  if (existing === ENTRY) return skip('CHANGELOG head entry');
  src = src.slice(0, at) + ENTRY + src.slice(end + endMark.length);
  done('CHANGELOG head entry (replaced)');
}

if (!MANIFEST_ONLY) {
  sub('APP_VERSION',
    "  const APP_VERSION = '" + OLD_VER + "';",
    "  const APP_VERSION = '" + VER + "';",
    1, "const APP_VERSION = '" + VER + "';");

  headEntry();
  fs.writeFileSync(FILE, src);

  const SW = path.join(ROOT, 'sw.js');
  const swTxt = fs.readFileSync(SW, 'utf8');
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
  if (swTxt.includes(newSw)) {
    console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
  } else {
    const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
    const n = swTxt.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, swTxt.split(oldSw).join(newSw));
    console.log('+ sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
  }

  const REPINS = [
    ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
    ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
    ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
    ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"],
  ];

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    if (name === 'test-653.mjs') continue;   // anchors its own release on purpose
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (a === b || t.indexOf(a) === -1) continue;
      repinned += t.split(a).length - 1;
      t = t.split(a).join(b);
      console.log('  ' + name + ' - ' + a.slice(0, 52));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-654: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-654 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
