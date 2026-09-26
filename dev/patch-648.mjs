#!/usr/bin/env node
// SideCut — 63.0.9: "Boot takes 4 seconds and storage bro".
//
// The panel screenshot made the diagnosis exact: 454 songs · 2.99 GB, in a 4.12 GB
// app data directory. `loadFromDB()` reads every track record and each record
// carried its song as raw audio bytes, so a launch deserialised the whole library
// before the first paint (312 MB per launch in dev/compact-647-check.cjs, scaled
// down from 40 songs; ~3 GB on the phone that reported this), and a metadata write
// re-serialised a whole song. 63.0.9 stores the audio as a Blob handle instead,
// with the old form as a fallback, plus a resumable per-record conversion for
// libraries written before it.
//
//   * APP_VERSION moves 63.0.8 → 63.0.9 (a step inside the 63 line).
//   * sw.js's CACHE_NAME moves 63.0.9 → 63.0.10 (its own number).
//   * The head CHANGELOG entry is NEW; the 63.0.8 entry stays below it.
//
// SIX items, on purpose and by requirement: the OTA channel carries only the
// FIRST SIX (`.slice(0, 6)` in dev/ota-bundle.mjs and its two siblings) and
// test-617 / test-619 / test-6139 assert `items.length >= 6` on the head. The
// notes are shared between channels, so they must not contain `download` /
// `converter` / a bare `convert`, and never name the play build.
//
//   node dev/patch-648.mjs              # version + changelog + sw.js + repins
//   node dev/patch-648.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.9';
const OLD_VER = '63.0.8';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 26, 2026 · 3:43 PM EDT';
const OLD_STAMP = 'September 26, 2026 · 2:12 PM EDT';
const SW_CACHE = '63.0.10';
const OLD_SW_CACHE = '63.0.9';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'The four-second startup was reading your whole library — every launch, before the first screen', items: [
    'Opening SideCut read every song out of the database in full, because each song was stored inside the same record as its name and artist — so a phone with 454 songs pulled 2.99 GB of audio through memory before Home appeared. That is what the four seconds were. Songs are now stored so the record holds a reference to the audio, and the audio itself is read only when that song is actually played.',
    'Libraries saved by earlier versions move over on their own, a handful of songs per launch in the background, and Settings → More → Storage has a Compact library button that does the whole collection in one go. It is safe to interrupt: each song is moved in a single step, so it is either the old storage or the new one, never half of each.',
    'It also stops the app\\u2019s storage growing behind the music. A play count, a lyric stamp, a tag edit or a tempo scan used to write the whole song back to disk — megabytes to record one number. Those writes are now a few bytes, so what you listen to no longer makes the app bigger. The Storage panel shows how many songs are still on the old storage.',
    'If a device will not accept the newer storage form, nothing changes: that song is left exactly as it is, SideCut remembers not to try again, and playback, playlists, covers and exports carry on as before. The panel says so instead of pretending the job was done.',
    'Everything 63.0.8 added stays: the Storage panel with Free up space, the backups that no longer leave a second copy of your library behind, and the startup stopwatch in the bell — which still reports each launch phase by phase, so the improvement can be judged from your own phone rather than from a description.',
    'One honest note: the first launch after this update still reads the old storage once, because that is the job being done. Judge the speed on the launch after the library has been compacted \\u2014 the panel tells you when there is nothing left to move. And if the phone\\u2019s own storage figure stays higher than the panel\\u2019s, that gap is the WebView\\u2019s caches, not your music.',
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

// Self-healing head entry: replaced outright when the text differs, so a rerun
// corrects the wording instead of leaving a stale one behind.
function headEntry(){
  const entryMark = "  { version: '" + VER + "',";
  const endMark = '\n  ] },\n';
  const at = src.indexOf(entryMark);
  if(at === -1){
    const headMark = 'const CHANGELOG = [\n';
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
    ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"],
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
  console.log('patch-648: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-648 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
