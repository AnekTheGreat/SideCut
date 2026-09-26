#!/usr/bin/env node
// SideCut — 63.0.6: the two reports that came back after 63.0.5.
//
//   1. "there shouldn't be a play button in singles when you click on a song"
//   2. "I'm still missing one album cover" — Album History: "Ishq Da Uda Ada"
//
//   * APP_VERSION moves 63.0.5 → 63.0.6. A step inside the 63 line the phone is
//     on; a jump past it (v64) still needs the user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.6 → 63.0.7 — its own number, decoupled from
//     APP_VERSION (dev/patch-623.mjs): it is a cache-buster.
//   * The head CHANGELOG entry is NEW; the 63.0.5 entry stays below it.
//
// SIX items, on purpose and by requirement: the OTA channel carries only the
// FIRST SIX items of the head entry (`.slice(0, 6)` in dev/ota-bundle.mjs and its
// two siblings), and test-617 / test-619 / test-6139 assert `items.length >= 6`
// on the head. Both fixes are one long note each in the app's own voice, so the
// six are the distinct things a user would want told: the saved list, the album,
// why it was never found, the check that keeps a stranger out, what is
// remembered, and that it reaches the list already on the phone.
//
// The notes carry REAL characters — curly quotes, the em dash, the ▶ — because
// this file is UTF-8 and index.html is read as UTF-8; nothing here is written as
// a backslash escape, so there is no way for one to leak into the notes as text.
//
//   node dev/patch-638.mjs              # version + changelog + sw.js + repins
//   node dev/patch-638.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.6';
const OLD_VER = '63.0.5';
const STAMP = 'September 26, 2026 · 12:36 PM EDT';
const OLD_STAMP = 'September 26, 2026 · 11:31 AM EDT';
const SW_CACHE = '63.0.7';
const OLD_SW_CACHE = '63.0.6';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'The play button a saved list kept handing back, and the one cover that had no source left to ask', items: [
    'Singles no longer shows a ▶, including on the list that is already saved on your phone. The button was gone from everything the app draws, but three separate places read a list back out of that saved copy and only one of them cleaned it — and the copy is written again from whatever list was just opened, so an old ▶ was handed on to itself, update after update. All three read it through the same cleaner now, and the popup cleans what it is given both before it draws it and before it saves it, so the list on your phone is corrected the moment it opens and cannot come back.',
    'The cover that was still blank is there: “Ishq Da Uda Ada”, 2003-02-09, by Diljit. It was the one row left, because Apple’s store has no entry for that album at all and Deezer has none either — both were asked live and both answered with nothing — which left MusicBrainz as the only place a picture could come from. It has the album: a release group dated 2003-02-09, credited to Diljit, whose front cover the Cover Art Archive serves. That is what the row shows now.',
    'The reason it had never been found is how MusicBrainz was being asked. The request demanded the release group by title and by artist together, and MusicBrainz files that album under “Diljit” rather than “Diljit Dosanjh” — so the artist half matched nothing, and the whole search came back empty. Not the wrong cover: no cover, every single time, however often it was tried. It is asked by title alone now.',
    'Asking by title alone is safe only because the artist is checked afterwards, and that check is kept: the release group’s own credit has to be the same artist as the album, so a same-titled album by somebody else is still refused and the blank square stays rather than being filled with a stranger’s art. That rule is what makes the search above worth doing at all.',
    'A cover that is found is remembered, so the app stops asking about it on every visit. A cover that is not found is deliberately not remembered: these catalogues gain records over time, and an album with no cover today is looked for again on the next launch instead of being written off for good — which is exactly how this one finally turned up.',
    'And it reaches the list you already have. The lookup runs every time Album History is drawn — a fresh one and one reopened from its own saved copy — so the row is fixed on your phone now rather than whenever that list happens to be rebuilt. A cover you set yourself by long-pressing an album still wins over anything these sources return.',
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
  console.log('patch-638: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-638 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
