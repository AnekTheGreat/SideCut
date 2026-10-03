#!/usr/bin/env node
/**
 * 72.5.2 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs and dev/repin-7251.mjs. Every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. The mechanical moves:
 *
 *   A. `const VER = '72.5.1';` becomes the new build.
 *   B. `{ version: '72.5.1',` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. repin-7251 moved test-713 through test-725 to 72.5;
 *      the head those gates compared against (entries[1]) is now 72.5.1, so every
 *      gate that compares entries[1] to the release before the head moves too -
 *      and test-7251.mjs joins them, because it is an adjacent-pin gate now.
 *   E. the shell cache literal becomes the name this release ships. Derived in
 *      both dev/patch-7252.mjs and this file from the release number.
 *
 * A NOTE ON PATTERN-MATCHING, because 72.5.2 follows a FOUR-part version. Unlike
 * 72.5.1 (where the old name was a PREFIX of the new one and every match needed a
 * lookahead) '72.5.1' and '72.5.2' are the same width and neither contains the
 * other, so a lookahead is not what protects these. The D step is still written
 * with its delimiter - `const PREV = '72.5';` - because '72.5' IS a prefix of
 * '72.5.1' and a bare match would rewrite the pin it just wrote.
 *
 * Plus bespoke moves:
 *
 *   F1. test-7251.mjs is itself a gate now, so its own [6] sweep moves with this
 *       release: the built old-build needle is read from PREV instead of a
 *       hardcoded '72.5', and the hardcoded stale-cache regex - which was written
 *       for '72.5' versus '72.5.1' and would now match this release's own
 *       'sidecut-shell-v72.5.2' - is retargeted at 72.5.1.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E), because that one is about sw.js.
 *
 *   node dev/repin-7252.mjs            # apply
 *   node dev/repin-7252.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.5.1';
const NEWVER = '72.5.2';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.5', OLDVER]],
  ['test-714.mjs', ['72.5', OLDVER]],
  ['test-715.mjs', ['72.5', OLDVER]],
  ['test-716.mjs', ['72.5', OLDVER]],
  ['test-717.mjs', ['72.5', OLDVER]],
  ['test-718.mjs', ['72.5', OLDVER]],
  ['test-719.mjs', ['72.5', OLDVER]],
  ['test-720.mjs', ['72.5', OLDVER]],
  ['test-721.mjs', ['72.5', OLDVER]],
  ['test-722.mjs', ['72.5', OLDVER]],
  ['test-723.mjs', ['72.5', OLDVER]],
  ['test-724.mjs', ['72.5', OLDVER]],
  ['test-725.mjs', ['72.5', OLDVER]],
  ['test-7251.mjs', ['72.5', OLDVER]],
]);

const esc = (s) => s.replace(/\./g, '\\.');
let files = 0, edits = 0;
const report = [];

// ---- F. the bespoke moves ---------------------------------------------------
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
  if (src !== before) {
    files++;
    edits += n;
    report.push('  ' + name + ': ' + n + ' bespoke edit(s)');
    if (!CHECK) fs.writeFileSync(file, src);
  } else {
    report.push('  ' + name + ': bespoke already in place');
  }
}

// F1. test-7251.mjs - its own stale-pin sweep.
bespoke('test-7251.mjs', [
  // The old-build needle is now built from PREV, so it tracks the repin instead
  // of naming the build that 72.5.1 happened to move away from.
  [
    "const OLD_VER_PIN = 'const VER = ' + \"'72.5\" + \"';\";",
    "const OLD_VER_PIN = 'const VER = ' + \"'\" + PREV + \"';\";",
  ],
  // The hardcoded regex was written to tell '72.5' from '72.5.1'. Left alone it
  // would match this release's own 'sidecut-shell-v72.5.2' and go red. Retarget it
  // at 72.5.1, the version that is genuinely older now.
  [
    "    .filter((n) => /sidecut-shell-v72\\.5(?!\\.1)/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
    "    .filter((n) => /sidecut-shell-v72\\.5\\.1(?![0-9])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  ],
]);

// ---- the mechanical sweep ---------------------------------------------------
for (const name of fs.readdirSync(DEV).sort()) {
  if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;

  if (!KEEPS_ITS_VERSION.has(name)) {
    // A. the build pin
    const pin = new RegExp("const VER = '" + esc(OLDVER) + "';", 'g');
    if (pin.test(src)) {
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-7252.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "'(?!\\.)", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "'");
      n++;
    }
  }

  // D. the adjacent-entry pin, for the gates that assert it
  const prevMove = PREV_MOVES.get(name);
  if (prevMove && src.indexOf("const PREV = '" + prevMove[0] + "';") !== -1) {
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-7252.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it.
  const cacheRe = new RegExp(esc(OLDCACHE), 'g');
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
console.log('\nrepin-7252: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. The cache check carries a trailing boundary so it
// cannot match this release's own name; the PREV check carries its delimiter
// because '72.5' is a prefix of '72.5.1'.
if (!CHECK) {
  const cacheStale = new RegExp('sidecut-shell-v72\\.5\\.1(?![0-9])');
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      if (src.indexOf("const VER = '" + OLDVER + "';") !== -1) stale.push(name + ' VER');
      if (new RegExp("\\{ version: '" + esc(OLDVER) + "'(?!\\.)").test(src)) stale.push(name + ' head');
    }
    const pm = PREV_MOVES.get(name);
    if (pm && src.indexOf("const PREV = '" + pm[0] + "';") !== -1) stale.push(name + ' PREV');
    if (cacheStale.test(src)) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-7252: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7252: no stale pin left in any gate');
}
