#!/usr/bin/env node
// SideCut — 63.1: the release that carries the scrubbed patch notes.
//
// 63.0.9's notes were edited to drop the reporter's personal data (library size,
// named artists / albums / songs) and the bundle was rebuilt at the SAME version.
// That does not deliver: dev/native-updates.js only installs a bundle whose
// version is STRICTLY newer than the running one (`compareVersions(man.version,
// cur) <= 0` -> "up to date", nothing downloaded). A device already on 63.0.9
// therefore kept the old notes. This release exists so the scrub reaches it.
//
//   * APP_VERSION moves 63.0.9 -> 63.1. The `.x` line caps at 9 and a rolled-over
//     `63.0.10` is forbidden (MANDATORY VERSION RULE), so the bump is 63.1.
//   * sw.js's CACHE_NAME moves 63.0.10 -> 63.0.11 (its own number, decoupled).
//   * The head CHANGELOG entry is NEW; the 63.0.9 entry stays below it.
//
// SIX items, on purpose: the OTA channel carries only the FIRST SIX
// (`.slice(0, 6)` in dev/ota-bundle.mjs and its siblings) and test-616..620
// assert `items.length >= 6` on the head. The notes are shared between channels,
// so they must not contain `download` / `converter` / a bare `convert`, and must
// never name the play build. This entry's own subject is the notes, so it has to
// obey those rules while talking about itself.
//
//   node dev/patch-650.mjs              # version + changelog + sw.js + repins
//   node dev/patch-650.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.1';
const OLD_VER = '63.0.9';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 26, 2026 · 5:53 PM EDT';
const OLD_STAMP = 'September 26, 2026 · 3:43 PM EDT';
const SW_CACHE = '63.0.11';
const OLD_SW_CACHE = '63.0.10';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'Release notes now describe each fix without quoting your library', items: [
    'Patch notes describe each fix in general terms now, instead of quoting the specific library size, artists, albums or songs that reported it. Every fix described in the previous release is unchanged — only the way it is written.',
    'This release exists so that change actually reaches your phone. An app only installs a build newer than the one it is running, so on an already-updated device the notes would otherwise have stayed exactly as they were.',
    'Nothing about playback, playlists, covers, lyrics or storage changed here. Your music is untouched.',
    'Everything the previous release added is still in place: the Storage panel with Free up space, the Compact library button, and the startup stopwatch in the bell that reports each launch phase by phase.',
    'Songs already saved the old way still move over on their own, a few per launch in the background, and a device that will not accept the newer storage form is left exactly as it is rather than being forced.',
    'If the phone’s own storage figure still reads higher than the Storage panel’s, that gap is the WebView’s own caches, which the app cannot see or clear.',
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
  console.log('patch-650: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-650 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
