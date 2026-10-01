#!/usr/bin/env node
/**
 * 72.0 - the repin sweep.
 *
 * Same shape as dev/repin-719.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Four mechanical moves:
 *
 *   A. `const VER = '71.9';` becomes the new build.
 *   B. `version: '71.9'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. test-713 through test-717 were moved to 71.8 by
 *      repin-719, and 71.9 was the head it replaced, so all seven gates that
 *      compare `entries[1]` to the release before the head move together -
 *      including test-718, new in 71.8, and test-719, new in 71.9.
 *   E. the shell cache literal becomes the name this release ships. 71.8 made the
 *      cache name BE the release number, so this is now the same number as A, on
 *      its own line - and it stays one number because the name is derived in both
 *      dev/patch-720.mjs and this file.
 *
 * test-705.mjs is the one gate that must not move with A or B: it is the 70.0.5
 * gate and DESCRIBES that release while it runs on whatever the app is now. Only
 * its shell-cache pin moves (E), because that one is about sw.js. test-70.mjs is
 * the 70.0 gate for the same reason.
 *
 * No bespoke step this time: 72.0 adds a lookup, a repair pass and one write, and
 * it leaves every anchor the older gates assert on in place - the album zip's
 * album groups are still album-shaped, the import still reads them as albums, and
 * the one delete path is untouched.
 *
 *   node dev/repin-720.mjs            # apply
 *   node dev/repin-720.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '71.9';
const NEWVER = '72.0';
const OLDCACHE = 'sidecut-shell-v71.9';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gate that describes 70.0.5 keeps its own version pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['71.8', OLDVER]],
  ['test-714.mjs', ['71.8', OLDVER]],
  ['test-715.mjs', ['71.8', OLDVER]],
  ['test-716.mjs', ['71.8', OLDVER]],
  ['test-717.mjs', ['71.8', OLDVER]],
  ['test-718.mjs', ['71.8', OLDVER]],
  ['test-719.mjs', ['71.8', OLDVER]],
]);

const esc = (s) => s.replace(/\./g, '\\.');
let files = 0, edits = 0;
const report = [];

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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-720.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY (a gate reading the changelog's first line)
    const headPin = new RegExp("{ version: '" + esc(OLDVER) + "'", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "'");
      n++;
    }
  }

  // D. the adjacent-entry pin, for the gates that assert it
  const prevMove = PREV_MOVES.get(name);
  if (prevMove && src.indexOf("const PREV = '" + prevMove[0] + "';") !== -1) {
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-720.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it
  if (src.indexOf(OLDCACHE) !== -1) {
    src = src.split(OLDCACHE).join(NEWCACHE);
    n++;
  }

  if (src !== before) {
    files++;
    edits += n;
    report.push('  ' + name + ': ' + n + ' edit(s)');
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

// F (bespoke). dev/test-70.mjs is the 70.0 gate and names the 70.1 and 71 series
// explicitly, because it refuses a build whose major is not one it knows - 72.0
// is the next series, so it is named here. That is the extension the comment
// above that rule describes ("which refused 71.2 for no reason but its major").
{
  const file = path.join(DEV, 'test-70.mjs');
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  const done = "/^72\\.\\d+(\\.\\d+)?$/.test(ver)";
  const anchor = "     /^70\\.1(\\.\\d+)?$/.test(ver) || /^71\\.\\d+(\\.\\d+)?$/.test(ver),\n";
  const next = "     /^70\\.1(\\.\\d+)?$/.test(ver) || /^71\\.\\d+(\\.\\d+)?$/.test(ver) ||\n" +
    "     " + done + ", // repin-720: the series list is extended each release\n";
  if (src.indexOf(done) === -1) {
    if (src.indexOf(anchor) === -1) {
      console.error('repin-720: test-70.mjs has no series anchor to extend');
      process.exit(1);
    }
    src = src.split(anchor).join(next);
  }
  if (src !== before) {
    report.push('  test-70.mjs: bespoke series extension');
    files++; edits++;
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

report.forEach((l) => console.log(l));
console.log('\nrepin-720: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done.
if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      if (src.indexOf("const VER = '" + OLDVER + "'") !== -1) stale.push(name + ' VER');
      if (src.indexOf("{ version: '" + OLDVER + "'") !== -1) stale.push(name + ' head');
    }
    const pm = PREV_MOVES.get(name);
    if (pm && src.indexOf("const PREV = '" + pm[0] + "';") !== -1) stale.push(name + ' PREV');
    if (src.indexOf(OLDCACHE) !== -1) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-720: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-720: no stale pin left in any gate');
}
