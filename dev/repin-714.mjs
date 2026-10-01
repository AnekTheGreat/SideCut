#!/usr/bin/env node
/**
 * 71.4 - the repin sweep.
 *
 * Same shape as dev/repin-713.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Three mechanical moves:
 *
 *   A. `const VER = '71.3';` becomes the new build.
 *   B. `version: '71.3'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   C. the shell cache literal becomes the name this release ships.
 *
 * test-705.mjs is the one gate that must not move with A or B, because it is the
 * 70.0.5 gate: it DESCRIBES that release while it runs on whatever the app is
 * now. Only its shell-cache pin moves (C), because that one is about sw.js.
 *
 *   node dev/repin-714.mjs            # apply
 *   node dev/repin-714.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '71.3';
const NEWVER = '71.4';
const OLDCACHE = 'sidecut-shell-v63.0.49';
const NEWCACHE = 'sidecut-shell-v63.0.50';

// The gate that describes 70.0.5 keeps its own version pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs']);

// D. The ADJACENT-entry pin. A gate that says "the release before it is still
// listed next" pins the build the release it describes was written on top of,
// and that pin has to follow the app forward or the check reads as a regression
// on the next release. Only these gates move: every other PREV in dev/ pins the
// release ITS OWN gate describes (61.3.7, 64.2.8, 70.0 …), which never moves.
// 71.3's own gate was written when 71.2 was the build before it, so its pin
// moves twice here: 71.2 -> 71.3.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['71.2', OLDVER]],
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-714.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-714.mjs */");
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
console.log('\nrepin-714: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done: no gate may still name the old build or cache.
if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    if (KEEPS_ITS_VERSION.has(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (src.indexOf("const VER = '" + OLDVER + "'") !== -1) stale.push(name + ' VER');
    if (src.indexOf("{ version: '" + OLDVER + "'") !== -1) stale.push(name + ' head');
    const pm = PREV_MOVES.get(name);
    if (pm && src.indexOf("const PREV = '" + pm[0] + "';") !== -1) stale.push(name + ' PREV');
  }
  if (stale.length) {
    console.error('repin-714: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
}
