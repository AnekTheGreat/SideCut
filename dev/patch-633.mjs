#!/usr/bin/env node
// SideCut — 63.0.4: a date you set with the pencil stays, and the days nothing
// ever published are off the old albums.
//
//   * APP_VERSION moves 63.0.3 → 63.0.4. A step inside the 63 line the phone is
//     on; a jump past it (v64) still needs the user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.4 → 63.0.5 — its own number, decoupled from
//     APP_VERSION (dev/patch-623.mjs): it is a cache-buster.
//   * The head CHANGELOG entry is NEW; the 63.0.3 entry stays below it. Its items
//     become the OTA notes for both channels, so they stay clear of every
//     downloader term and never name the play build.
//
// The entry text carries REAL characters — an em dash and the 📀 — rather than
// \uXXXX escapes. Escapes in a template literal here need a double backslash to
// survive into index.html, and getting that wrong is silent: the note is stored
// and shown as the literal text "\ud83d\udcc0". Verified after building by
// EVALUATING the changelog out of index.html (the same eval the tests use) and
// reading the rendered notes in ota/updates.json.
//
//   node dev/patch-633.mjs              # version + changelog + sw.js + repins
//   node dev/patch-633.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.4';
const OLD_VER = '63.0.3';
const STAMP = 'September 26, 2026 · 10:21 AM EDT';
const OLD_STAMP = 'September 26, 2026 · 1:59 AM EDT';
const SW_CACHE = '63.0.5';
const OLD_SW_CACHE = '63.0.4';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'A date you set with the pencil stays — and the days nothing ever published are off the old albums', items: [
    'A release date or track count you set with the pencil on an album in 📀 Album History now stays. The list keeps a snapshot of itself so it opens instantly, and that snapshot was being shown instead of your change — both right after saving and on every reopen, which is why editing looked like it did nothing.',
    'That snapshot is now stamped with your edits and the app version it was drawn from, so a list drawn before a change (or by an older build) is redrawn from the albums themselves instead of being shown as it was.',
    'Saving also throws the snapshot away outright, so the row you just edited is redrawn from the data immediately rather than from the picture.',
    'The old albums no longer wear a day nothing published. An album only the discography guide knew about was given a date that guide made up, and two different albums could wear the same 2008-04-24. Those albums now show the year the stores and catalogs agree on, and the pencil is there when you know the exact day.',
    'The invented days already stored on your phone are cut to their year as the list is drawn, so this is right on the next open instead of waiting for every artist to be read again.',
    'Everything else about the list is untouched: the order you dragged the albums into, the covers you added and the albums you removed are all still where you left them.',
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
  console.log('patch-633: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-633 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
