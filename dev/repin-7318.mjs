#!/usr/bin/env node
/**
 * 73.1.8 - the album-loss fix release.
 *
 * WHY THIS RELEASE EXISTS. 73.1.7 claimed the Albums tab was intact, and on the
 * device it was not: the boot sweep (removeAutoAlbums) deleted every album entry
 * wearing the old automatic flag, and an import from an album zip made before
 * that flag was retired left every album it brought wearing one - so the update
 * boot took a library of ~20 albums down to one card. The albums are rebuildable
 * (their names are album tags still on the songs), and 73.1.8 carries that
 * recovery, the archive-instead-of-delete sweep, the It-is-mine restore and the
 * full-song-list fix for the half-empty rebuilt album.
 *
 * THE MOVES (same shape as dev/repin-7317.mjs, which this file is derived from):
 *
 *   A. the build pin becomes the new build (every test/check gate).
 *   B. the changelog head entry becomes the new head.
 *   D. the ADJACENT-entry pin MOVES: the entry under the head is 73.1.7 now.
 *      Every gate that pinned 73.1.6 as the neighbour is named in PREV_GATES.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * Plus the bespoke moves this release needs:
 *
 *   F1-F6. test-7251.mjs, test-7252.mjs, test-726.mjs, test-727.mjs,
 *   test-7271.mjs and test-728.mjs each end with a sweep of their own that
 *   hunts for the PREVIOUS shell cache, in the escaped and the bracket
 *   spellings. The version that is genuinely older now is 73.1.7.
 *
 *   F7. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX
 *   literal with NO trailing comma, so B cannot see it. That shape is its own
 *   needle.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their
 * own release while running on whatever the app is now. Only their shell-cache
 * pin moves (E).
 *
 *   node dev/repin-7318.mjs            # apply
 *   node dev/repin-7318.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '73.1.7';
const NEWVER = '73.1.8';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.1) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. THE ADJACENT PIN MOVES. 73.1.8 adds an entry above 73.1.7, so the entry
// under the head is 73.1.7 now. Every gate that carried the old neighbour is
// named here - including test-7317.mjs, whose VER is repinned to 73.1.8 by A
// and whose neighbour must move with it.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-7316.mjs', 'test-7317.mjs',
];
const PREV_OLD = '73.1.6';
const PREV_NEW = '73.1.7';

const BS = String.fromCharCode(92);
// Escape the dots of a version for a RegExp constructor: 73.1.6 -> 73(bs).1(bs).6
const esc = (s) => s.split('.').join(BS + '.');
let files = 0, edits = 0;
const report = [];

function write(name, src, n, before){
  if (src !== before) {
    files++;
    edits += n;
    report.push('  ' + name + ': ' + n + ' edit(s)');
    if (!CHECK) fs.writeFileSync(path.join(DEV, name), src);
  } else {
    report.push('  ' + name + ': bespoke already in place');
  }
}

function bespoke(name, pairs){
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;
  for (const [oldStr, newStr] of pairs) {
    if (src.indexOf(oldStr) === -1) continue;
    src = src.split(oldStr).join(newStr);
    n++;
  }
  write(name, src, n, before);
}

// D. the adjacent-entry pin, one needle for all of them.
for (const name of PREV_GATES) {
  bespoke(name, [[
    "const PREV = '" + PREV_OLD + "';",
    "const PREV = '" + PREV_NEW + "'; /* repinned by dev/repin-7318.mjs */",
  ]]);
}

// The sweep each of these gates ends with, spelled exactly as it sits in the
// file: repin-7317 left it as the escaped and bracket spellings of 73.1.6, and
// this release hunts 73.1.7 in the same two spellings. The escaped form carries
// one backslash before each dot, spelled with BS so no patching tool can ever
// re-escape it.
const SWEEP_ESC_OLD = 'sidecut-shell-v73' + BS + '.1' + BS + '.6(?![' + BS + 'd.])';
const SWEEP_ESC_NEW = 'sidecut-shell-v73' + BS + '.1' + BS + '.7(?![' + BS + 'd.])';
const SWEEP_BRK_OLD = 'sidecut-shell-v73[.]1[.]6(?![' + BS + 'd.])';
const SWEEP_BRK_NEW = 'sidecut-shell-v73[.]1[.]7(?![' + BS + 'd.])';

// F1. test-7251.mjs - its stale-cache needle points at 73.1.6 now.
bespoke('test-7251.mjs', [[SWEEP_ESC_OLD, SWEEP_ESC_NEW]]);
// F2-F4. the bracket form.
bespoke('test-7252.mjs', [[SWEEP_BRK_OLD, SWEEP_BRK_NEW]]);
bespoke('test-726.mjs', [[SWEEP_BRK_OLD, SWEEP_BRK_NEW]]);
bespoke('test-727.mjs', [[SWEEP_BRK_OLD, SWEEP_BRK_NEW]]);
// F5-F6. the newest gates of the previous releases.
bespoke('test-7271.mjs', [[SWEEP_ESC_OLD, SWEEP_ESC_NEW]]);
bespoke('test-728.mjs', [[SWEEP_ESC_OLD, SWEEP_ESC_NEW]]);

// F7. test-6137.mjs and test-6138.mjs - the changelog-head regex, which carries
// no trailing comma and so is invisible to B.
bespoke('test-6137.mjs', [[
  "version: '73.1.7'/.test(src), 'the newest entry sits inside CHANGELOG');",
  "version: '73.1.8'/.test(src), 'the newest entry sits inside CHANGELOG');",
]]);
bespoke('test-6138.mjs', [[
  "version: '73.1.7'/.test(src), 'the newest entry sits inside CHANGELOG');",
  "version: '73.1.8'/.test(src), 'the newest entry sits inside CHANGELOG');",
]]);

const TEST_RE = /^test-.*[.]mjs$/;
const CHECK_RE = /check[.]cjs$/;

// ---- the mechanical sweep ---------------------------------------------------
for (const name of fs.readdirSync(DEV).sort()) {
  if (!TEST_RE.test(name) && !CHECK_RE.test(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;

  if (!KEEPS_ITS_VERSION.has(name)) {
    // A. the build pin, anchored on its own terminator. The comment that
    // repin-7317 appended is part of the pin now, so the needle ends at the
    // quote+semicolon and the replace keeps whatever comment is already there.
    const pin = new RegExp("const VER = '" + esc(OLDVER) + "';( /\\* repinned by dev/repin-731[0-9]*[.]mjs \\*/)?", 'g');
    if (pin.test(src)) {
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-7318.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp(BS + "{ version: '" + esc(OLDVER) + "',", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "',");
      n++;
    }
  }

  // E. the shell cache, for every gate that names it.
  const cacheRe = new RegExp(esc(OLDCACHE) + '(?![' + BS + 'd.])', 'g');
  if (cacheRe.test(src)) {
    src = src.replace(cacheRe, NEWCACHE);
    n++;
  }

  if (src !== before) {
    files++;
    edits += n;
    report.push('  ' + name + ': ' + n + ' edit(s)');
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

report.forEach((l) => console.log(l));
console.log('');
console.log('repin-7318: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. Every needle carries its delimiter or boundary.
if (!CHECK) {
  const cacheStale = new RegExp(esc(OLDCACHE) + '(?![' + BS + 'd.])');
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!TEST_RE.test(name) && !CHECK_RE.test(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      if (src.indexOf("const VER = '" + OLDVER + "';") !== -1) stale.push(name + ' VER');
      if (new RegExp(BS + "{ version: '" + esc(OLDVER) + "',").test(src)) stale.push(name + ' head');
      // The regex-literal form with no trailing comma, which B cannot see.
      if (src.indexOf("{ version: '" + OLDVER + "'/") !== -1) stale.push(name + ' head regex');
    }
    // D is a MOVE this time: every one of these gates must now carry the 73.1.7
    // entry as the neighbour, and none may still carry the 73.1.6 one.
    if (PREV_GATES.indexOf(name) !== -1) {
      if (src.indexOf("const PREV = '" + PREV_NEW + "';") === -1) stale.push(name + ' PREV');
      if (src.indexOf("const PREV = '" + PREV_OLD + "'") !== -1) stale.push(name + ' old PREV');
    }
    if (cacheStale.test(src)) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-7318: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7318: no stale pin left in any gate');
}
