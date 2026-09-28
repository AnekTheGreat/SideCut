#!/usr/bin/env node
// SideCut - 64.2.3: the pinned-artists island blinking, and the hitch after a scroll.
//
// Two things were reported about 64.2.2:
//
//   "At some points there are lag spikes and pinned artists island sometimes
//    doesn't show but comes back after a split second."
//
//   * THE BLINK IS 64.2.1'S REPAINT, STILL ON THE RAIL. 64.2.2 took the
//     hide-for-a-frame out of Home's repaint; the pinned-artists rail kept it
//     (`strip.style.visibility = 'hidden'` -> `void strip.offsetHeight` ->
//     requestAnimationFrame restore). A phone can present that hidden frame,
//     which is exactly "the island sometimes doesn't show but comes back after a
//     split second". The rail now repaints the same way Home does: promote the
//     strip onto its own layer, take the promotion away one frame later, never
//     hide it.
//
//   * THE HITCH IS THE FORCED LAYOUT INSIDE THE REPAINT. Both settle handlers
//     made the page lay itself out again in the same task - `void
//     strip.offsetHeight` on the rail (plus `getBoundingClientRect().height` on
//     the chip list, a second one), and `void wrap.offsetHeight` on Home - which
//     is felt as a lag spike the moment a scroll settles. Neither is needed:
//     the flush only ever existed to commit a HIDDEN frame before restoring it,
//     and a transform change is committed by the frame it is scheduled on, so
//     one extra frame (the two-frame pattern the album reorder sheet already
//     uses) does the job with no layout.
//
//   * AND THE RAIL'S "IS IT DRAWN?" CHECK WAS ITSELF A FORCED LAYOUT that could
//     never catch the fault it was written for: a rail whose painting had been
//     dropped still measures its full height. It is decided from the DOM now -
//     a rail with its chips on the page has been built.
//
//   node dev/patch-66423.mjs
//   node dev/patch-66423.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md). Needles that
// end up containing one are built the same way.
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);       // the middle dot the ship stamps use

const VER = '64.2.3';
const OLD_VER = '64.2.2';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 ' + DOT + ' 8:35 PM EDT';
const OLD_STAMP = 'September 27, 2026 ' + DOT + ' 7:40 PM EDT';
const SW_CACHE = '63.0.21';
const OLD_SW_CACHE = '63.0.20';

// Short, plain statements of the changes, the way 64.2.2's entries are written.
const TITLE = 'The pinned artists island stops blinking, and a settled scroll no longer lays the page out again';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere), so no
// tooling wording: dev/test-617..620, -60510 and -662 read the WHOLE head entry
// for a downloader term, dev/test-6058 runs the shipped filter over it for the
// store channel, and dev/test-play-copy reads it against a wider list than
// either. The fourth note keeps the word "rollback": dev/test-662 asserts the
// head entry describes what the release did with /rollback/i.
const NOTES = [
  'The pinned artists island no longer blinks. It used to be hidden for a moment after a scroll so it could be redrawn - the same blink the Favorites bubble had in 64.2.2. It is redrawn now without ever being hidden.',
  'Scrolling no longer makes the page lay itself out again. Home and the pinned artists island each did that every time a scroll stopped, and that was the hitch you feel right after you stop.',
  'The island is only rebuilt when it has nothing to show. The old check made the phone measure the strip on every scroll - slow, and it missed the fault it was written for.',
  'Nothing in your library is touched. Same songs, playlists, covers, pinned artists and saved rollback copies, and no setting is reset by this update.',
  'This is 64.2.3 and not a rebuild of 64.2.2: a phone already on 64.2.2 is offered it and installs it.',
  'This finishes what 64.2.2 started. That release stopped a Home bubble blinking; this one does the same for the pinned artists island and takes the extra work out of the scroll.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66423 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the rail repaints without hiding itself, and without forcing a layout
// ═══════════════════════════════════════════════════════════════════════════
sub('the pinned rail repaint stops hiding the strip',
  "    var strip = $('pinnedArtistsStrip');\n" +
  '    if(!strip) return;\n' +
  "    strip.style.visibility = 'hidden';\n" +
  '    void strip.offsetHeight;\n' +
  "    requestAnimationFrame(function(){ try{ strip.style.visibility = ''; }catch(_eRpr){} });",
  "    var strip = $('pinnedArtistsStrip');\n" +
  '    if(!strip) return;\n' +
  '    // 64.2.2 took the hide out of Home\'s repaint and left the rail with it: a\n' +
  '    // frame of a hidden strip is a frame a phone can present, and that is "the\n' +
  '    // pinned artists island sometimes doesn\'t show but comes back after a split\n' +
  '    // second". Promoting the strip onto its own layer and taking the promotion\n' +
  '    // away one frame later makes the compositor raster it again with the strip\n' +
  '    // on screen the whole time.\n' +
  '    //\n' +
  '    // No forced layout here either. The old `void strip.offsetHeight` made the\n' +
  '    // page lay itself out again in the same task as the scroll settle, which is\n' +
  '    // the lag spike felt right after you stop scrolling. That flush was only\n' +
  '    // ever needed by the hide-and-restore - a hidden frame has to be committed\n' +
  '    // before it can be restored - while a transform change is committed by the\n' +
  '    // frame it is scheduled on. The inner requestAnimationFrame is the same\n' +
  '    // two-frame pattern the album reorder sheet uses to let the browser apply\n' +
  '    // an entrance.\n' +
  "    strip.style.transform = 'translateZ(0)';\n" +
  '    requestAnimationFrame(function(){\n' +
  "      requestAnimationFrame(function(){ try{ strip.style.transform = ''; }catch(_eRpr){} });\n" +
  '    });');

sub('and the chip list is judged from the DOM, never measured',
  '          repaintPinnedRail(l);\n' +
  "          if(l.querySelector('.pinned-artist-chip') && l.getBoundingClientRect().height) return;\n" +
  '          renderPinnedArtists();',
  '          repaintPinnedRail(l);\n' +
  '          // Decided from the DOM on purpose: measuring the list\n' +
  '          // (getBoundingClientRect/offsetHeight) is a forced layout on every\n' +
  '          // settled scroll, and it could never catch the fault it was written\n' +
  '          // for - a rail whose painting had been dropped still measures its full\n' +
  '          // height, which is the same reason the chip list is asked whether it\n' +
  '          // holds chips and not how tall it is. Only a rail with no chips on the\n' +
  '          // page has to be built again.\n' +
  "          if(l.querySelector('.pinned-artist-chip')) return;\n" +
  '          renderPinnedArtists();');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - Home's repaint drops its forced layout too
// ═══════════════════════════════════════════════════════════════════════════
sub('the Home repaint no longer forces a layout',
  "    wrap.style.transform = 'translateZ(0)';\n" +
  '    void wrap.offsetHeight;\n' +
  "    requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });",
  "    wrap.style.transform = 'translateZ(0)';\n" +
  '    requestAnimationFrame(function(){\n' +
  "      requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });\n" +
  '    });');

sub('and says why the layout is not asked for',
  '  //     Promoting the grid onto its own layer and taking the promotion away on\n' +
  '  //     the next frame makes the compositor raster it again while it stays on\n' +
  '  //     screen - the same fresh paint, nothing ever off the screen;',
  '  //     Promoting the grid onto its own layer and taking the promotion away one\n' +
  '  //     frame later makes the compositor raster it again while it stays on\n' +
  '  //     screen - the same fresh paint, nothing ever off the screen. It is taken\n' +
  '  //     back on the SECOND frame so the promoted frame is really presented, and\n' +
  '  //     the grid is never measured: reading offsetHeight here (which 64.2.1 and\n' +
  '  //     64.2.2 both did) lays the whole page out again in the same task as the\n' +
  '  //     scroll settle, and that is a lag spike you can feel;');

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the release itself
// ═══════════════════════════════════════════════════════════════════════════
function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const items = NOTES.map((n) => "    '" + n + "',").join('\n');
  const block = "  { version: '" + VER + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
    items + '\n  ] },\n';
  const headMark = 'const CHANGELOG = [\n';
  if (src.indexOf(headMark) === -1) throw new Error('CHANGELOG opener not found');
  src = src.replace(headMark, headMark + block);
  done('CHANGELOG head entry (' + VER + ')');
}

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

// Version pins across the suite. Gates that describe an OLDER release read it by
// version with a regex (test-663, test-6641, test-6642, test-66421) and pin
// nothing here; dev/test-66422 (64.2.2) and dev/test-66421 (64.2.1) both pin the
// repaint shape this release replaced, and are updated by hand below.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);

let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to apply)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

const GRID_OLD_FIRST = '  ok(has("    wrap.style.transform = \'translateZ(0)\';\\n    void wrap.offsetHeight;"),\n' +
  "    'by forcing the grid to be rastered again');\n" +
  '  ok(has("    requestAnimationFrame(function(){ try{ wrap.style.transform = \'\'; }catch(_eRpH){ } });"),\n' +
  "    'and taking that back on the next frame, without ever hiding the grid');";
const GRID_NEW_FIRST = '  ok(has("    wrap.style.transform = \'translateZ(0)\';"),\n' +
  "    'by forcing the grid to be rastered again');\n" +
  '  ok(has("    requestAnimationFrame(function(){\\n      requestAnimationFrame(function(){ try{ wrap.style.transform = \'\'; }catch(_eRpH){ } });"),\n' +
  "    'and taking that back one frame later, with no layout and no hide');\n" +
  '  ok(!/void wrap\\.offsetHeight/.test(src.slice(src.indexOf(\'  function repaintHomeGrid(){\'), src.indexOf(\'  function homeGridIsWhole(){\'))),\n' +
  "    'the forced layout that made a settled scroll hitch is gone');";

// dev/test-66421.mjs is 64.2.1's gate. 64.2.2 gave it the transform assertions
// because that release replaced the hide-and-restore it pinned; this release
// replaces the transform-plus-flush those assertions pin, so they move again.
fileSub('dev/test-66421.mjs', [
  [GRID_OLD_FIRST, GRID_NEW_FIRST],
  ['  ok(has("    strip.style.visibility = \'hidden\';\\n    void strip.offsetHeight;"),\n' +
   "    'the same way Home now does');",
   '  ok(has("  function repaintPinnedRail(list){"),\n' +
   "    'the rail is still the surface Home copied its repaint from');"],
]);

// dev/test-66422.mjs is 64.2.2's gate, and it pins the same two shapes plus the
// head entry, which is this release's now - so it reads the 64.2.2 entry by
// version, exactly as this was done for test-6641 at 64.2 and test-6642 at
// 64.2.1. The replacement uses a regex, never a quoted literal, because the bump
// above rewrites quoted version literals in every dev/test-*.mjs.
fileSub('dev/test-66422.mjs', [
  ["  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');\n" +
   '  if (entries) {\n' +
   '    const head = entries[0];',
   '  ok(!!entries && String(entries[0].version) === ver, \'the newest changelog matches APP_VERSION (\' + (entries && entries[0].version) + \')\');\n' +
   '  // The head entry belongs to whatever shipped last, so read the 64.2.2 entry by\n' +
   '  // version: this gate describes 64.2.2.\n' +
   '  const entry6422 = entries ? entries.find((x) => /^64\\.2\\.2$/.test(String(x.version))) : null;\n' +
   "  ok(!!entry6422 && String(entry6422.version) === '64.2.2', 'the 64.2.2 entry this gate describes is still here');\n" +
   '  if (entry6422) {\n' +
   '    const head = entry6422;'],
  ["    ok(String(head.version) === VER, 'the head entry is v' + VER);",
   "    ok(String(head.version) === '64.2.2', 'the entry this gate describes is v' + head.version);"],
  ['  ok(has("    wrap.style.transform = \'translateZ(0)\';\\n    void wrap.offsetHeight;"),\n' +
   "    'it promotes the grid to force a fresh raster');\n" +
   '  ok(has("    requestAnimationFrame(function(){ try{ wrap.style.transform = \'\'; }catch(_eRpH){ } });"),\n' +
   "    'and takes the promotion back, so nothing stays on its own layer');",
   '  ok(has("    wrap.style.transform = \'translateZ(0)\';"),\n' +
   "    'it promotes the grid to force a fresh raster');\n" +
   '  ok(has("    requestAnimationFrame(function(){\\n      requestAnimationFrame(function(){ try{ wrap.style.transform = \'\'; }catch(_eRpH){ } });"),\n' +
   "    'and takes the promotion back one frame later, so nothing stays on its own layer');"],
  ['  ok(slice(\'  function repaintPinnedRail(list){\', \'  function homeGridIsWhole(){\').indexOf("strip.style.visibility = \'hidden\';") !== -1\n' +
   "    || has(\"    strip.style.visibility = 'hidden';\"), 'the way it always has');",
   '  ok(!/visibility/.test(slice(\'  function repaintPinnedRail(list){\', \'  function watchPinnedRail(){\')),\n' +
   "    'and it repaints without hiding itself, the way Home does');"],
]);

// dev/test-6642.mjs (64.2) and dev/test-6641.mjs (64.1) both pin the rail repaint
// this release replaces: 64.1 recorded its measuring check and 64.2 recorded the
// hide-and-restore as the way the rail repaints, so those two assertions now
// describe what the rail does instead.
fileSub('dev/test-6642.mjs', [
  [`  ok(has('    strip.style.visibility = \\'hidden\\';\\n    void strip.offsetHeight;'),
    'by throwing its painted pixels away');
  ok(has('    requestAnimationFrame(function(){ try{ strip.style.visibility = \\'\\'; }catch(_eRpr){} });'),
    'and painting them again on the next frame');`,
   `  ok(has(\"    strip.style.transform = 'translateZ(0)';\"),
    'by asking the compositor to raster the card again');
  ok(has(\"      requestAnimationFrame(function(){ try{ strip.style.transform = ''; }catch(_eRpr){} });\"),
    'and taking that back one frame later, without ever hiding it');`],
]);

fileSub('dev/test-6641.mjs', [
  [`  ok(has(\"if(l.querySelector('.pinned-artist-chip') && l.getBoundingClientRect().height) return;\"),
    'and redraws it only when it is really empty');`,
   `  ok(has(\"if(l.querySelector('.pinned-artist-chip')) return;\"),
    'and redraws it only when it is really empty');`],
]);

console.log('patch-66423: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
// Comments talk about the code these checks are looking for, so every "is it
// gone" test runs over the code only (the same strip dev/test-6058.mjs uses).
const noComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
const railAt = final.indexOf('  function repaintPinnedRail(list){');
const railEnd = final.indexOf('  (function watchPinnedRail(){');
const rail = railAt === -1 || railEnd === -1 ? '' : final.slice(railAt, railEnd);
const watchAt = final.indexOf('  (function watchPinnedRail(){');
const watchEnd = final.indexOf('  // ---------------- Release page for pinned-artist releases');
const watch = watchAt === -1 || watchEnd === -1 ? '' : final.slice(watchAt, watchEnd);
const gridAt = final.indexOf('  function repaintHomeGrid(){');
const gridEnd = final.indexOf('  function homeGridIsWhole(){');
const grid = gridAt === -1 || gridEnd === -1 ? '' : final.slice(gridAt, gridEnd);

// 1 - the rail
must(rail !== '' && !/visibility/.test(rail), 'the rail repaint never hides the strip');
must(has("    strip.style.transform = 'translateZ(0)';"), 'it promotes the strip to force a fresh raster');
must(has('    requestAnimationFrame(function(){\n      requestAnimationFrame(function(){ try{ strip.style.transform = \'\'; }catch(_eRpr){} });'),
  'and drops the promotion on the frame after');
must(!/void strip\.offsetHeight/.test(noComments(rail)), 'with no forced layout in it');
must(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
  'a chip still carrying what a drag gives it is still put back');
must(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
  'and the rebuild is decided from the DOM alone');
must(!/getBoundingClientRect/.test(noComments(watch)), 'with the measuring gone');
must(has('  function renderPinnedArtists(){'), 'the rail still has its builder');

// 2 - Home
must(grid !== '' && !/visibility/.test(grid), 'the Home repaint still never hides the grid');
must(!/offsetHeight/.test(noComments(grid)), 'and no longer forces a layout either');
must(has('    requestAnimationFrame(function(){\n      requestAnimationFrame(function(){ try{ wrap.style.transform = \'\'; }catch(_eRpH){ } });'),
  'it takes the promotion back on the frame after');
must(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
  'and a grid really missing a bubble is still drawn again');
must(!/void (wrap|strip)\.offsetHeight/.test(noComments(final)),
  'no settled scroll lays the page out again');

// 3 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
if (block) {
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
    must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    must((head.items || []).every((it) => it.length <= 260), 'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
    must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what this release left alone');
    must(/pinned artists/i.test(notes), 'and naming what was reported');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(SW, 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

const t6642 = fs.readFileSync(path.join(ROOT, 'dev/test-6642.mjs'), 'utf8');
const t6641 = fs.readFileSync(path.join(ROOT, 'dev/test-6641.mjs'), 'utf8');
must(t6642.indexOf('strip.style.visibility') === -1, 'dev/test-6642.mjs no longer pins the hidden frame');
must(t6641.indexOf('getBoundingClientRect().height') === -1, 'dev/test-6641.mjs no longer pins the measuring check');

if (problems.length) {
  console.error('\npatch-66423: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66423: all verification checks passed (' + edits + ' edit(s))');
