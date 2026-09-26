#!/usr/bin/env node
// SideCut — 63.0.8: "Its better but still takes forever to load".
//
// 63.0.7 removed the biggest measured cost (174.2 MB of page HTML read per
// launch, now 0.0 MB) and startup was still slow, which means what is left is
// dominated by something only the phone can see. So this release mostly SHIPS
// THE MEASUREMENT — a startup stopwatch readable in one tap from the bell — plus
// the two remaining costs that are certain whatever the numbers say.
//
//   * APP_VERSION moves 63.0.7 → 63.0.8. A step inside the 63 line the phone is
//     on; a jump past it (v64) still needs the user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.8 → 63.0.9 — its own number, decoupled from
//     APP_VERSION: it is a cache-buster.
//   * The head CHANGELOG entry is NEW; the 63.0.7 entry stays below it.
//
// SIX items, on purpose and by requirement: the OTA channel carries only the
// FIRST SIX items of the head entry (`.slice(0, 6)` in dev/ota-bundle.mjs and its
// two siblings) and test-617 / test-619 / test-6139 assert `items.length >= 6` on
// the head. The notes are written for the shared channel, so they must not
// contain `download` / `converter` / `convert` (test-617..620, test-60510).
//
//   node dev/patch-642.mjs              # version + changelog + sw.js + repins
//   node dev/patch-642.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.8';
const OLD_VER = '63.0.7';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT). See the
// note above the APP_VERSION declaration — TZ=America/New_York returns UTC here.
const STAMP = 'September 26, 2026 · 2:12 PM EDT';
const OLD_STAMP = 'September 26, 2026 · 1:37 PM EDT';
const SW_CACHE = '63.0.9';
const OLD_SW_CACHE = '63.0.8';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'SideCut now times its own startup — and the two things that were still being done at launch for no reason', items: [
    'SideCut now measures its own startup and shows you where the time goes. Open the bell (\\ud83d\\udd14) and the first thing in it is “Startup — 1.9s”, your own number from your own phone; tap it and every step is listed: how long the app’s own code takes to load, then the notification state, your settings, the library read, and the moment Home is on screen. It is timed on every launch and the last one is kept. The last two rounds of speed work could only go so far because the numbers came from a faster machine than yours; this is the app reporting on itself, and the next fix will start from that list.',
    'The song list is no longer built while the app is starting up. It is by far the heaviest thing SideCut assembles — a row and a cover for every song — and it was being built for a screen you were not even looking at, because SideCut always opens on Home. Open Library and it is built right then, exactly as fast as before; it is simply no longer part of how long startup takes. (63.0.7 moved that build off the first paint; this removes it from startup altogether.)',
    'SideCut no longer analyses the song you last had open while it is starting. Auto volume works by measuring how loud a song is, which means reading and decoding the whole file, and that was happening to the restored song during startup — for a track that is restored paused and might never be played. A song you actually play still gets measured and remembered exactly as before; only the pointless one at launch is gone.',
    'The small dot on the bell is worked out a moment after Home is on screen instead of in the same instant. That check walks your whole library looking for duplicates, and nothing on the screen you are looking at depends on it, so it no longer competes with the app appearing.',
    'Everything 63.0.7 fixed stays fixed: your settings are read without dragging every old version’s saved page through the read (about 174 MB per launch on a phone with a dozen updates behind it, now a few kilobytes), the recovery file is only opened when something really is missing, and the two pieces that load from the network no longer sit in front of the app and hold up its start.',
    'If a step is still slow, that breakdown in the bell names it — which step, and how many milliseconds. Send that list over and the next round of work starts from your phone’s real numbers rather than from mine. Nothing about your music, playlists, covers or saved versions changes in this release.',
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
  console.log('patch-642: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-642 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
