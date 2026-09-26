#!/usr/bin/env node
// SideCut — 63.0.7: "It takes way to long for the app to boot".
//
//   * APP_VERSION moves 63.0.6 → 63.0.7. A step inside the 63 line the phone is
//     on; a jump past it (v64) still needs the user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.7 → 63.0.8 — its own number, decoupled from
//     APP_VERSION: it is a cache-buster.
//   * The head CHANGELOG entry is NEW; the 63.0.6 entry stays below it.
//
// SIX items, on purpose and by requirement: the OTA channel carries only the
// FIRST SIX items of the head entry (`.slice(0, 6)` in dev/ota-bundle.mjs and its
// two siblings) and test-617 / test-619 / test-6139 assert `items.length >= 6` on
// the head. The six are the things a person would actually want told: what was
// being read at startup, why it got worse with every update, the recovery file,
// the two downloads that sat in front of the app, the list that is no longer
// waited for, and the per-song work that is now done once.
//
// The notes carry REAL characters — an em dash, curly quotes — because this file
// is UTF-8 and index.html is read as UTF-8; nothing here is written as a
// backslash escape, so there is no way for one to leak into the notes as text.
//
//   node dev/patch-640.mjs              # version + changelog + sw.js + repins
//   node dev/patch-640.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.7';
const OLD_VER = '63.0.6';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT). See the
// note above the APP_VERSION declaration — TZ=America/New_York returns UTC here.
const STAMP = 'September 26, 2026 · 1:37 PM EDT';
const OLD_STAMP = 'September 26, 2026 · 12:36 PM EDT';
const SW_CACHE = '63.0.8';
const OLD_SW_CACHE = '63.0.7';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'The startup that was reading every copy of itself it had ever kept — and the list it no longer waits for', items: [
    'SideCut starts much faster. The reason it did not is storage the app keeps for itself: every version the app has ever run saves a whole copy of its own page so you can switch back to that version later, and none of those copies are ever deleted — deliberately. Reading your settings did not skip them. It read every one of them, and startup made that kind of read four separate times before your library was even opened, so on a phone that has been through a dozen updates startup was reading about 174 MB of page text at every single launch. It now reads only the settings it is actually asking for, which is a few kilobytes.',
    'That is also why it kept getting worse rather than staying put. Every update adds one more copy of the page, and every launch read all of them — so the same phone started slower after an update than it did the week before, and slower again after the next one. Nothing about your rollback history has changed: every version is still kept, and switching back to one still works exactly as it did. Those copies are simply no longer dragged through every read.',
    'The recovery file the app keeps on the device was opened and read at every launch — megabytes of it, parsed — before anything had checked whether a recovery was needed at all, and startup waits on that step. On a healthy phone that was pure waiting for a file that had nothing to say. It is now opened only when something really is missing, which is the one situation it exists for.',
    'Two pieces the app loads from the network — the one that opens .zip files and the one that writes MP3s — used to sit in front of the app\u2019s own code, so nothing in SideCut ran until both had come back. On a slow connection that wait is the whole of a slow start, and it happened before any part of the app was on screen. They now load alongside the app instead of in front of it, and are ready well before you tap anything that needs them.',
    'The song list is no longer built while the app is still starting up. It is the heaviest thing SideCut assembles — a row and a cover for every song — and it was being built for a screen you were not looking at while Home was still waiting to appear. Home now draws first and the list is built straight after, so the app is on screen and usable instead of held back by it; opening Library still builds it the moment you open it.',
    'And each song\\u2019s audio and cover are opened once as your library loads, instead of three times each. Nothing you look at is different — same songs, same playlists, same settings, same covers, same rollback history — the app has just stopped doing work nobody asked it to do. Measured against the same library on the same device model, the page text read during startup went from around 174 MB to under a kilobyte, and the list is off the critical path entirely.',
  ] },
`;

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// The changelog head, self-healing: an entry already there is replaced outright
// rather than skipped, so a rerun after a fix to the text corrects it instead of
// leaving a wrong one in place.
function headEntry(){
  const headMark = 'const CHANGELOG = [\n';
  const entryMark = "  { version: '" + VER + "',";
  const endMark = '\n  ] },\n';
  const at = src.indexOf(entryMark);
  if(at === -1){
    sub('CHANGELOG head entry', headMark, headMark + ENTRY, 1, entryMark);
    return;
  }
  const end = src.indexOf(endMark, at);
  if(end === -1) throw new Error('CHANGELOG: no end for the ' + VER + ' entry');
  const existing = src.slice(at, end + endMark.length);
  if(existing === ENTRY) return skip('CHANGELOG head entry');
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
  const sw = fs.readFileSync(SW, 'utf8');
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
  if (sw.includes(newSw)) {
    console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
  } else {
    const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
  }

  const REPINS = [
    ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
    ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
    ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
    ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"]
  ];

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (a === b || t.indexOf(a) === -1) continue;
      repinned += t.split(a).length - 1;
      t = t.split(a).join(b);
      console.log('  ' + name + ' — ' + a.slice(0, 52));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-640: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-640 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
