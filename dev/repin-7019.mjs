#!/usr/bin/env node
/**
 * 70.1.9 - the repin sweep.
 *
 * Same shape as dev/repin-7018.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Three mechanical moves:
 *
 *   A. `const VER = '70.1.8';` becomes the new build.
 *   B. `version: '70.1.8'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   C. the shell cache literal becomes the name this release ships.
 *
 * test-705.mjs is the one gate that must not move with A or B, because it is the
 * 70.0.5 gate: it DESCRIBES that release while it runs on whatever the app is
 * now. Only its shell-cache pin moves (C), because that one is about sw.js.
 *
 *   node dev/repin-7019.mjs            # apply
 *   node dev/repin-7019.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '70.1.8';
const NEWVER = '70.1.9';
const OLDCACHE = 'sidecut-shell-v63.0.44';
const NEWCACHE = 'sidecut-shell-v63.0.45';

// The gate that describes 70.0.5 keeps its own version pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs']);

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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-7019.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY (a gate reading the changelog's first line)
    const headPin = new RegExp("{ version: '" + esc(OLDVER) + "'", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "'");
      n++;
    }
  }

  // C. the shell cache, for every gate that names it
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
console.log('\nrepin-7019: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
  }
  if (stale.length) {
    console.error('repin-7019: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
}
