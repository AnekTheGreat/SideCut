#!/usr/bin/env node
/**
 * 72.9 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs ... dev/repin-7281.mjs. Every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. The moves:
 *
 *   A. `const VER = '72.8.1';` becomes the new build.
 *   B. `{ version: '72.8.1',` becomes the new head.
 *   D. the ADJACENT-entry pin. entries[1] is now 72.8.1, so every gate that
 *      compares entries[1] to the release before the head moves - test-713
 *      through test-7281, all of which carry `const PREV = '72.8';`.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * THE PREFIX TRAP. `'72.8'` IS a prefix of `'72.8.1'`, so the D needle is
 * anchored on its own terminator (`';`) and A and B carry theirs. The cache move
 * keeps a `(?![\d.])` lookahead so a re-run cannot bite the new name.
 *
 * THE NEEDLE IS WRITTEN RAW. The bespoke needles below are the exact bytes that
 * sit in the gate files, so they are built with String.raw and pasted verbatim
 * instead of being escaped by hand - one round of escaping too many is how a
 * "retarget" silently becomes a no-op that reports 'already in place'.
 *
 * Plus the bespoke moves this release needs:
 *
 *   F1-F6. test-7251.mjs, test-7252.mjs, test-726.mjs, test-727.mjs,
 *   test-7271.mjs and test-728.mjs each end with a sweep of their own that hunts
 *   for the PREVIOUS shell cache. Those needles name the version that was
 *   previous WHEN THEY WERE WRITTEN (72.8), so they are retargeted at 72.8.1 -
 *   the version that is genuinely older now.
 *
 *   F7. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX
 *   literal with NO trailing comma, so B cannot see it. That shape is its own
 *   needle.
 *
 *   F8. Two gates pin lyrics code that 72.9 deliberately replaced:
 *     * test-614.mjs pins the pacing rate, which is now measured in syllables
 *       per second and clamped to [1.6,7] instead of characters per second at
 *       [6,14];
 *     * test-7281.mjs pins the letter-wave delay clamp, widened from 14-90ms to
 *       11-180ms so a long word's wave finishes with the word.
 *   Neither of these is a version pin - the behaviour changed, so the gate has
 *   to change with it.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E).
 *
 *   node dev/repin-729.mjs            # apply
 *   node dev/repin-729.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.8.1';
const NEWVER = '72.9';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.1) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin. After repin-7281 all of these carry '72.8'.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.8', OLDVER]],
  ['test-714.mjs', ['72.8', OLDVER]],
  ['test-715.mjs', ['72.8', OLDVER]],
  ['test-716.mjs', ['72.8', OLDVER]],
  ['test-717.mjs', ['72.8', OLDVER]],
  ['test-718.mjs', ['72.8', OLDVER]],
  ['test-719.mjs', ['72.8', OLDVER]],
  ['test-720.mjs', ['72.8', OLDVER]],
  ['test-721.mjs', ['72.8', OLDVER]],
  ['test-722.mjs', ['72.8', OLDVER]],
  ['test-723.mjs', ['72.8', OLDVER]],
  ['test-724.mjs', ['72.8', OLDVER]],
  ['test-725.mjs', ['72.8', OLDVER]],
  ['test-7251.mjs', ['72.8', OLDVER]],
  ['test-7252.mjs', ['72.8', OLDVER]],
  ['test-726.mjs', ['72.8', OLDVER]],
  ['test-727.mjs', ['72.8', OLDVER]],
  ['test-7271.mjs', ['72.8', OLDVER]],
  ['test-728.mjs', ['72.8', OLDVER]],
  ['test-7281.mjs', ['72.8', OLDVER]],
]);

const esc = (s) => s.replace(/\./g, '\\.');
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

// The sweep each of these gates ends with, spelled exactly as it sits in the
// file. Two spellings exist: the escaped `\.8` and the bracket `[.]8`.
const SWEEP_ESC_OLD = String.raw`sidecut-shell-v72\.8(?![\d.])`;
const SWEEP_ESC_NEW = String.raw`sidecut-shell-v72\.8\.1(?![\d.])`;
const SWEEP_BRK_OLD = String.raw`sidecut-shell-v72[.]8(?![\d.])`;
const SWEEP_BRK_NEW = String.raw`sidecut-shell-v72[.]8[.]1(?![\d.])`;

// F1. test-7251.mjs - its stale-cache needle points at 72.8.1 now.
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
  String.raw`version: '72.8.1'/.test(src), 'the newest entry sits inside CHANGELOG');`,
  String.raw`version: '72.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
]]);
bespoke('test-6138.mjs', [[
  String.raw`version: '72.8.1'/.test(src), 'the newest entry sits inside CHANGELOG');`,
  String.raw`version: '72.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
]]);

// F8a. test-614.mjs - the pacing rate is measured in syllables now, not
// characters, so the pinned formula and its clamp move with it.
bespoke('test-614.mjs', [[
  String.raw`ok(/const rate = Math\.max\(6, Math\.min\(14, lineRate \* 1\.15\)\);/.test(paceFn), 'the rate follows the line, clamped to [6,14]');`,
  String.raw`ok(/const rate = Math\.max\(1\.6, Math\.min\(7, lineRate \* 1\.12\)\);/.test(paceFn), 'the rate follows the line in syllables, clamped to [1.6,7]');`,
]]);

// F8b. test-7281.mjs - the letter-wave delay clamp widened, so the pinned
// bounds move with the shipped code.
bespoke('test-7281.mjs', [[
  "'step = Math.max(14, Math.min(90, step));'",
  "'step = Math.max(11, Math.min(180, step));'",
]]);

// F10. test-6139.mjs counts where the junk-title filter is applied. 72.9's
// window.__scReleaseList is a thirteenth consumer (it refuses a junk title
// before it ever reaches a surface), so the invariant moves with it.
bespoke('test-6139.mjs', [[
  String.raw`  // One shared test, applied by EVERY source and by BOTH lists. 12 hits = the
  // definition, the pruning pass, the row painter, and nine call sites.`,
  String.raw`  // One shared test, applied by EVERY source and by BOTH lists. 10 hits = the
  // definition, the pruning pass, the release-list builder, and seven call
  // sites: the three surfaces that used to each re-check a row now delegate to
  // window.__scReleaseList, which does it once.`,
], [
  String.raw`  ok(count('__scJunkTitle') === 12, 'one junk test, applied everywhere (' + count('__scJunkTitle') + ')');`,
  String.raw`  ok(count('__scJunkTitle') === 10, 'one junk test, applied everywhere, with the three surface copies folded into the shared list (' + count('__scJunkTitle') + ')');`,
]]);

// F9. test-7251.mjs pins the widget's single delivery route. 72.9 gave the
// press a second route (the system-wide key is dispatched whenever nothing is
// audibly playing yet, which is the resume case), so the gate describes how the
// press is answered now instead of the old `if (!sent)` only.
bespoke('test-7251.mjs', [[
  String.raw`  ok(/if \(!sent\) \{/.test(java), 'the system-wide key is sent only when the direct hand-off did not go');`,
  String.raw`  ok(/if \(!sent \|\| !music\) \{/.test(java), 'the system-wide key is also sent whenever nothing is audibly playing yet, so a paused app resumes instead of opening');`,
]]);

// ---- the mechanical sweep ---------------------------------------------------
for (const name of fs.readdirSync(DEV).sort()) {
  if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;

  if (!KEEPS_ITS_VERSION.has(name)) {
    // A. the build pin, anchored on its own terminator.
    const pin = new RegExp("const VER = '" + esc(OLDVER) + "';", 'g');
    if (pin.test(src)) {
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-729.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "',", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "',");
      n++;
    }
  }

  // D. the adjacent-entry pin, for the gates that assert it. `'72.8'` is a
  // prefix of `'72.8.1'`, so the needle keeps its own `';` terminator.
  const prevMove = PREV_MOVES.get(name);
  if (prevMove && src.indexOf("const PREV = '" + prevMove[0] + "';") !== -1) {
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-729.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it.
  const cacheRe = new RegExp(esc(OLDCACHE) + '(?![\\d.])', 'g');
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
console.log('\nrepin-729: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. Every needle carries its delimiter or boundary.
if (!CHECK) {
  const cacheStale = new RegExp(esc(OLDCACHE) + '(?![\\d.])');
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      if (src.indexOf("const VER = '" + OLDVER + "';") !== -1) stale.push(name + ' VER');
      if (new RegExp("\\{ version: '" + esc(OLDVER) + "',").test(src)) stale.push(name + ' head');
      // The regex-literal form with no trailing comma, which B cannot see.
      if (src.indexOf("{ version: '" + OLDVER + "'/") !== -1) stale.push(name + ' head regex');
    }
    const pm = PREV_MOVES.get(name);
    if (pm && src.indexOf("const PREV = '" + pm[0] + "';") !== -1) stale.push(name + ' PREV');
    if (cacheStale.test(src)) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-729: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-729: no stale pin left in any gate');
}
