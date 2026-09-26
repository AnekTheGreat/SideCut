#!/usr/bin/env node
// SideCut — the release number is 63.0.1.
//
// The user's words: "Release no.: 63.0.1 and there's a syntax error". This is the
// number they chose when asked what to ship, and it is the smallest number that can
// reach the phone:
//
//   * The phone runs **63** (the bundle the OTA automation published at 989d176).
//   * The UI only offers an update when the published number is STRICTLY greater
//     than the running one — `updateIsNewer()` → `compareVersions(published,
//     APP_VERSION) > 0` (index.html ~13715) — and the installer refuses anything
//     lower still (`isOlderBundle` in dev/native-updates.js).
//   * 62.1 is BELOW 63, which is why "I don't see the update": the app concluded
//     there was nothing newer. `compareVersions('63.0.1','63')` is **+1**, so
//     63.0.1 is offered and accepted everywhere that 62.1 was not.
//
// This is the SAME release as 62.1, renumbered — so the head CHANGELOG entry is
// rewritten in place (its title and items are untouched), exactly as patch-622 did
// when it corrected 63 → 62.0.5.
//
// The service worker's cache name is untouched: it is `sidecut-shell-v63.0.2` and
// carries its own number (see dev/patch-625.mjs). It is a cache-buster, not a
// version stamp.
//
//   node dev/patch-626.mjs              # APP_VERSION + the head changelog entry + repins
//   node dev/patch-626.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.1';
const OLD_VER = '62.1';
const STAMP = 'September 26, 2026 · 12:46 AM EDT';
const OLD_STAMP = 'September 26, 2026 · 12:34 AM EDT';

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

if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + OLD_VER + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  // The same release, renumbered: rewrite the head entry's version and ship stamp
  // in place. Anchored on the whole opening line, so the items can never be touched.
  sub('CHANGELOG head entry renumbered',
    "  { version: '" + OLD_VER + "', date: '" + OLD_STAMP + "',",
    "  { version: '" + VER + "', date: '" + STAMP + "',",
    1, "  { version: '" + VER + "', date: '" + STAMP + "',");

  fs.writeFileSync(FILE, src);

  const REPINS = [
    ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
    ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
    ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"]
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
      console.log('  ' + name + ' — ' + a.slice(0, 48));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-626: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-626 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
