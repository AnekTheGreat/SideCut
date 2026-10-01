#!/usr/bin/env node
/**
 * 71.9 - the repin sweep.
 *
 * Same shape as dev/repin-718.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Four mechanical moves:
 *
 *   A. `const VER = '71.8';` becomes the new build.
 *   B. `version: '71.8'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. test-713, test-714, test-715, test-716 and test-717
 *      were moved to 71.7 by repin-718, and 71.8 was the head it replaced, so all
 *      five move together - and test-718, new in 71.8, moves with them.
 *   E. the shell cache literal becomes the name this release ships. 71.8 made the
 *      cache name BE the release number, so this is now the same number as A, on
 *      its own line - and it stays one number because the name is derived in both
 *      dev/patch-719.mjs and this file.
 *
 * test-705.mjs is the one gate that must not move with A or B: it is the 70.0.5
 * gate and DESCRIBES that release while it runs on whatever the app is now. Only
 * its shell-cache pin moves (E), because that one is about sw.js. test-70.mjs is
 * the 70.0 gate for the same reason.
 *
 * F (bespoke). dev/test-718.mjs is the 71.8 gate and it reads the HEAD entry for
 * two checks that are about 71.8 itself (the notes name the cache and the release
 * the cache is named after). Now that the head is another release, those checks
 * read the entry they describe - the same `const OWN` split test-715.mjs uses, and
 * the same fix repin-718.mjs applied to test-716 / test-717.
 *
 *   node dev/repin-719.mjs            # apply
 *   node dev/repin-719.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '71.8';
const NEWVER = '71.9';
const OLDCACHE = 'sidecut-shell-v71.8';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gate that describes 70.0.5 keeps its own version pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['71.7', OLDVER]],
  ['test-714.mjs', ['71.7', OLDVER]],
  ['test-715.mjs', ['71.7', OLDVER]],
  ['test-716.mjs', ['71.7', OLDVER]],
  ['test-717.mjs', ['71.7', OLDVER]],
  ['test-718.mjs', ['71.7', OLDVER]],
]);

const esc = (s) => s.replace(/\./g, '\\.');
let files = 0, edits = 0;
const report = [];
// The main loop's result per file, so the bespoke step below works on the text this
// run produces - in --check mode nothing has been written to disk yet.
const swept = new Map();

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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-719.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-719.mjs */");
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
  swept.set(name, src);
}

// F (bespoke). dev/test-718.mjs describes 71.8, so the two checks that are about
// what 71.8's notes SAY read the 71.8 entry instead of whatever the head is now.
{
  const file = path.join(DEV, 'test-718.mjs');
  let src = swept.has('test-718.mjs') ? swept.get('test-718.mjs') : fs.readFileSync(file, 'utf8');
  const before = src;
  if (src.indexOf("const OWN = '71.8';") === -1) {
    const anchor = "const SHELL_CACHE = '" + NEWCACHE + "';\n";
    if (src.indexOf(anchor) === -1) {
      console.error('repin-719: test-718.mjs has no SHELL_CACHE anchor for the OWN pin');
      process.exit(1);
    }
    src = src.replace(anchor, anchor + "const OWN = '71.8'; // repin-719: the release this gate describes\n");
  }
  const pairs = [
    ["    const items = head.items || [];\n",
     "    const items = head.items || [];\n    const own = entries.find((e) => String(e.version) === OWN) || head;\n    const ownNotes = (own.items || []).join('\\n');\n"],
    ["ok(/cache/i.test(notes), 'the notes name the cache');",
     "ok(/cache/i.test(ownNotes), 'the 71.8 notes name the cache');"],
    ["ok(/release/i.test(notes), 'and the release it is named after');",
     "ok(/release/i.test(ownNotes), 'and the release it is named after');"],
  ];
  for (const [a, b] of pairs) {
    if (src.indexOf(b) !== -1) continue;
    if (src.indexOf(a) === -1) {
      console.error('repin-719: test-718.mjs: missing OWN-split anchor: ' + JSON.stringify(a.slice(0, 64)));
      process.exit(1);
    }
    src = src.split(a).join(b);
  }
  if (src !== before) {
    report.push('  test-718.mjs: bespoke OWN split');
    files++; edits++;
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

report.forEach((l) => console.log(l));
console.log('\nrepin-719: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done.
if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    // test-718.mjs names the 71.8 release on purpose (it IS the 71.8 gate), and
    // its repin assertions are regexes that cannot go stale.
    if (name === 'test-718.mjs') continue;
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
    console.error('repin-719: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-719: no stale pin left in any gate');
}
