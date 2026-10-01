#!/usr/bin/env node
/**
 * 72.1 - the repin sweep.
 *
 * Same shape as dev/repin-720.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Four mechanical moves:
 *
 *   A. `const VER = '72.0';` becomes the new build.
 *   B. `version: '72.0'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. repin-720 moved test-713 through test-719 to 71.9,
 *      and 72.0 was the head it replaced, so every gate that compares
 *      `entries[1]` to the release before the head moves together - including
 *      test-720, new in 72.0.
 *   E. the shell cache literal becomes the name this release ships. 71.8 made the
 *      cache name BE the release number, so this is now the same number as A, on
 *      its own line - and it stays one number because the name is derived in both
 *      dev/patch-721.mjs and this file.
 *
 * test-705.mjs is the one gate that must not move with A or B: it is the 70.0.5
 * gate and DESCRIBES that release while it runs on whatever the app is now. Only
 * its shell-cache pin moves (E), because that one is about sw.js. test-70.mjs is
 * the 70.0 gate for the same reason - and its series list already names the 72
 * line, so there is no bespoke step this time.
 *
 *   node dev/repin-721.mjs            # apply
 *   node dev/repin-721.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.0';
const NEWVER = '72.1';
const OLDCACHE = 'sidecut-shell-v72.0';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['71.9', OLDVER]],
  ['test-714.mjs', ['71.9', OLDVER]],
  ['test-715.mjs', ['71.9', OLDVER]],
  ['test-716.mjs', ['71.9', OLDVER]],
  ['test-717.mjs', ['71.9', OLDVER]],
  ['test-718.mjs', ['71.9', OLDVER]],
  ['test-719.mjs', ['71.9', OLDVER]],
  ['test-720.mjs', ['71.9', OLDVER]],
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-721.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-721.mjs */");
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

report.forEach((l) => console.log(l));
console.log('\nrepin-721: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    console.error('repin-721: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-721: no stale pin left in any gate');
}
