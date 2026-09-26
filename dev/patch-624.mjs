#!/usr/bin/env node
// SideCut 62.1 — holding an album in 📀 Album History and dragging it.
//
// WHY A NEW NUMBER: 62.0.5 shipped this gesture, but it never reached the phone.
// 62.0.5 is numbered BELOW the "63" bundle the OTA automation published before it,
// and dev/native-updates.js refuses any bundle older than the one running
// (isOlderBundle → compareVersions(bundle, current) < 0). A device that ever ran
// the 63 bundle therefore silently refuses 62.0.5 — which is exactly the "I didn't
// get the update" report. 62.1 is the same feature carrying a number above 62.0.5.
//
// WHAT ACTUALLY CHANGED IN THE CODE: one thing, and it is the thing the report
// asked for ("it should be smooth").
//   * The drag read `offsetHeight` for the lifted row AND for every neighbour on
//     EVERY finger move. The row's transform is written first and the heights are
//     read after it, so each move forced a synchronous re-layout of the whole list
//     — the classic layout-thrash shape, and the reason a drag can stutter on a
//     phone even though the maths is right. The list is measured once at pickup
//     (slotTops + the neighbours' midpoints + the lifted row's own height) and
//     every move is then arithmetic only: no layout reads, no reflow.
//
// The gesture itself (420 ms hold, the row following the finger, the neighbours
// sliding, the edge auto-scroll, the per-artist saved order) is unchanged — it was
// written correctly in 62.0.5 and is covered by dev/ah-album-reorder-check.cjs.
//
//   node dev/patch-624.mjs              # drag fix + release metadata
//   node dev/patch-624.mjs --manifest   # re-seed root manifest.json from ota/updates.json
//
// Every index.html edit is count==1 asserted and carries its own marker, and the
// single write happens at the end, so a bad needle can never half-apply and a rerun
// is a no-op.
//
// NOTE on the service worker: sw.js's CACHE_NAME is NOT repinned here. Since the
// 63.0.1 change it is decoupled from APP_VERSION on purpose (see AGENTS.md) — it is
// a cache-buster, not a version stamp, so this release leaves it alone.
//
// NOTE on wording: the head entry's items become the OTA patch notes for BOTH
// channels, and dev/test-6058 + dev/test-60510 forbid a downloader/desktop term
// there. Every note below is free of download*, convert*, "get song", "to mp3"
// and "play build|version|install".
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '62.1';              // what this release calls itself
const OLD_VER = '62.0.5';        // the release it supersedes
const STAMP = 'September 26, 2026 · 12:34 AM EDT';
const OLD_STAMP = 'September 25, 2026 · 9:56 PM EDT';

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The album drag must not read layout while the finger is moving.
//
//    Three edits, all inside window.__wireAHAlbumReorder:
//      a. the slots the drag remembers grow a midpoint list and the lifted row's
//         own measured height;
//      b. begin() fills them from ONE pass over the rows;
//      c. updateIndex() uses them instead of reading offsetHeight per move.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('Album History — the drag remembers a midpoint per slot and the lifted height',
    '    var rows = [], others = [], slotTops = [], startIndex = 0, currentIndex = 0;',
    '    var rows = [], others = [], slotTops = [], slotMids = [], pickH = 0, startIndex = 0, currentIndex = 0;',
    1, 'slotMids = [], pickH = 0,');

  sub('Album History — the list is measured once, at pickup',
    '      slotTops = [0];\n'
    + '      for(var m = 0; m < rows.length; m++) slotTops.push(slotTops[m] + (rows[m].offsetHeight || 0) + GAP_PX);',
    '      // Measured ONCE, here. Reading offsetHeight again on every finger move\n'
    + '      // re-laid-out the whole list mid-drag (the transform is written before the\n'
    + '      // read), which is what made the row lag behind the finger.\n'
    + '      slotTops = [0]; slotMids = [];\n'
    + '      for(var m = 0; m < rows.length; m++){\n'
    + '        var _h = rows[m].offsetHeight || 0;\n'
    + '        slotTops.push(slotTops[m] + _h + GAP_PX);\n'
    + '        slotMids.push(slotTops[m] + _h / 2);\n'
    + '      }\n'
    + '      pickH = el.offsetHeight || 0;',
    1, 'pickH = el.offsetHeight || 0;');

  sub('Album History — a move is maths only, with no layout reads',
    '      var centre = slotTops[startIndex] + (el.offsetHeight || 0) / 2 + dy;\n'
    + '      var p = 0;\n'
    + '      for(var j = 0; j < others.length; j++){\n'
    + '        var mid = slotTops[origSlot(j)] + (others[j].offsetHeight || 0) / 2;\n'
    + '        if(mid < centre) p++;\n'
    + '      }',
    '      // Both sides come from the single measurement taken at pickup, so moving\n'
    + '      // the finger costs nothing but arithmetic.\n'
    + '      var centre = slotTops[startIndex] + pickH / 2 + dy;\n'
    + '      var p = 0;\n'
    + '      for(var j = 0; j < others.length; j++){\n'
    + '        if(slotMids[origSlot(j)] < centre) p++;\n'
    + '      }',
    1, 'if(slotMids[origSlot(j)] < centre) p++;');
}

// ---------------------------------------------------------------------------
// 2. Release metadata: the version and the changelog head.
// ---------------------------------------------------------------------------
const ENTRY = String.raw`  { version: '62.1', date: 'September 26, 2026 · 12:34 AM EDT', title: 'Holding an album in Album History now drags it into the order you want', items: [
    'In \ud83d\udcc0 Album History, press and hold an album for a moment, then drag it up or down. The row picks up under your finger and stays where you let it go.',
    'The drag keeps up with your finger: the list is measured once when you pick an album up instead of on every little move, so nothing stutters while you drag.',
    'The albums you are not holding slide over to open the gap the lifted one is heading for, and the list scrolls itself when you hold an album near the top or bottom edge, so one further down is reachable in a single drag.',
    'The order is remembered for each artist. Close the popup, reopen it, refetch the list, or restart the app, and that artist\'s albums come back in the order you gave them.',
    'A short tap is unchanged — it still opens the album\'s songs. Only a press-and-hold starts a reorder, and moving your finger before the hold finishes still just scrolls the list.',
    'Holding an album\'s artwork still sets a custom cover, and reordering the artists at the top of Album History works exactly as it did.',
  ] },`;

if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + OLD_VER + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  // The new entry goes IN FRONT of the 62.0.5 one: the changelog is newest-first.
  const ANCHOR = "  { version: '" + OLD_VER + "',";
  if (src.indexOf("  { version: '" + VER + "',") !== -1) skip('CHANGELOG ' + VER + ' head entry');
  else {
    const at = src.indexOf(ANCHOR);
    if (at === -1) throw new Error('CHANGELOG: could not find the ' + OLD_VER + ' entry to sit behind');
    src = src.slice(0, at) + ENTRY + '\n' + src.slice(at);
    done('CHANGELOG ' + VER + ' head entry');
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 3. Repin the repo-wide release assertions.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
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
  console.log('patch-624: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-624 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
