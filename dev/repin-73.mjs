#!/usr/bin/env node
/**
 * 73 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs ... dev/repin-729.mjs. Every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. The moves:
 *
 *   A. `const VER = '72.9';` becomes the new build.
 *   B. `{ version: '72.9',` becomes the new head.
 *   D. the ADJACENT-entry pin DOES NOT MOVE THIS RELEASE. A and B rename the
 *      HEAD, not the history: entries[1] is still the 72.8.1 entry, so every
 *      gate keeps `const PREV = '72.8.1';` exactly as repin-729 left it. There
 *      is deliberately no PREV_MOVES below and no PREV needle in the sweep - a
 *      repin that moved it here would break all twenty of those gates.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * WHY THIS RELEASE IS 73 AND NOT 72.10. The third number stops at nine, so a
 * `72.9` line is closed: 71.9 is the last 71 and the next release after it is
 * 72.0. By the same rule the release after 72.9 is 73. The work itself did not
 * change - only the number it ships under - so this repin carries only the
 * mechanical sweep and the two needles below.
 *
 * Plus the bespoke moves this release needs:
 *
 *   F1-F6. test-7251.mjs, test-7252.mjs, test-726.mjs, test-727.mjs,
 *   test-7271.mjs and test-728.mjs each end with a sweep of their own that hunts
 *   for the PREVIOUS shell cache. Those needles name the version that was
 *   previous WHEN THEY WERE WRITTEN (72.8.1), so they are retargeted at 72.9 -
 *   the version that is genuinely older now.
 *
 *   F7. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX
 *   literal with NO trailing comma, so B cannot see it. That shape is its own
 *   needle.
 *
 * THE NEEDLE IS WRITTEN RAW. The bespoke needles are the exact bytes that sit in
 * the gate files, so they are built with String.raw and pasted verbatim instead
 * of being escaped by hand - one round of escaping too many is how a retarget
 * silently becomes a no-op that reports 'already in place'.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E).
 *
 *   node dev/repin-73.mjs            # apply
 *   node dev/repin-73.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.9';
const NEWVER = '73';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.1) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. NO ADJACENT-ENTRY MOVE. See the header: this release renames the head, so
// the entry below it is unchanged and every gate keeps its '72.8.1' pin. The
// gates that carry it are still named here so the sweep can prove it stayed put.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-73.mjs',
];
const ADJACENT_STAYS = '72.8.1';

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
// file. Two spellings exist: the escaped `\.8\.1` and the bracket `[.]8[.]1`.
const SWEEP_ESC_OLD = String.raw`sidecut-shell-v72\.8\.1(?![\d.])`;
const SWEEP_ESC_NEW = String.raw`sidecut-shell-v72\.9(?![\d.])`;
const SWEEP_BRK_OLD = String.raw`sidecut-shell-v72[.]8[.]1(?![\d.])`;
const SWEEP_BRK_NEW = String.raw`sidecut-shell-v72[.]9(?![\d.])`;

// F1. test-7251.mjs - its stale-cache needle points at 72.9 now.
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
  String.raw`version: '72.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
  String.raw`version: '73'/.test(src), 'the newest entry sits inside CHANGELOG');`,
]]);
bespoke('test-6138.mjs', [[
  String.raw`version: '72.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
  String.raw`version: '73'/.test(src), 'the newest entry sits inside CHANGELOG');`,
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-73.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "',", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "',");
      n++;
    }
  }

  // D. the adjacent-entry pin STAYS at 72.8.1. This release renames the head, so
  // there is nothing here to move - and a gate that lost that pin would be a
  // real failure, which the sweep at the bottom reports.

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
console.log('\nrepin-73: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    // D is a KEEP, not a move: every one of these gates must still carry the
    // adjacent entry exactly as repin-729 left it.
    if (PREV_GATES.indexOf(name) !== -1 && src.indexOf("const PREV = '" + ADJACENT_STAYS + "';") === -1) {
      stale.push(name + ' PREV');
    }
    if (cacheStale.test(src)) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-73: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-73: no stale pin left in any gate');
}
