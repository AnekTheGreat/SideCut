#!/usr/bin/env node
/**
 * 72.7.1 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs ... dev/repin-727.mjs. Every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. The moves:
 *
 *   A. `const VER = '72.7';` becomes the new build.
 *   B. `{ version: '72.7',` becomes the new head.
 *   D. the ADJACENT-entry pin. entries[1] is now 72.7, so every gate that
 *      compares entries[1] to the release before the head moves - test-713
 *      through test-727, all of which carry `const PREV = '72.6';`.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * THE VERSION-PREFIX TRAP, the other way round this time: `'72.7'` IS a prefix
 * of `'72.7.1'`, so a bare `sidecut-shell-v72.7` needle would also match the
 * released `sidecut-shell-v72.7.1` and rewrite it a second time on a re-run. The
 * cache move therefore carries `(?![\d.])`, and every stale-cache sweep needle
 * written for this release carries `(?![0-9.])` - they hunt the exact old name,
 * never the longer new one.
 *
 * Plus the bespoke move this release needs: test-7251.mjs, test-7252.mjs,
 * test-726.mjs and test-727.mjs each end with a sweep of their own that hunts for
 * the PREVIOUS shell cache. Those needles name the version that was previous WHEN
 * THEY WERE WRITTEN (72.6), so they have to be retargeted at 72.7 - the version
 * that is genuinely older now - or they would keep looking for a name nothing has.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E).
 *
 *   node dev/repin-7271.mjs            # apply
 *   node dev/repin-7271.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.7';
const NEWVER = '72.7.1';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.6', OLDVER]],
  ['test-714.mjs', ['72.6', OLDVER]],
  ['test-715.mjs', ['72.6', OLDVER]],
  ['test-716.mjs', ['72.6', OLDVER]],
  ['test-717.mjs', ['72.6', OLDVER]],
  ['test-718.mjs', ['72.6', OLDVER]],
  ['test-719.mjs', ['72.6', OLDVER]],
  ['test-720.mjs', ['72.6', OLDVER]],
  ['test-721.mjs', ['72.6', OLDVER]],
  ['test-722.mjs', ['72.6', OLDVER]],
  ['test-723.mjs', ['72.6', OLDVER]],
  ['test-724.mjs', ['72.6', OLDVER]],
  ['test-725.mjs', ['72.6', OLDVER]],
  ['test-7251.mjs', ['72.6', OLDVER]],
  ['test-7252.mjs', ['72.6', OLDVER]],
  ['test-726.mjs', ['72.6', OLDVER]],
  ['test-727.mjs', ['72.6', OLDVER]],
]);

const esc = (s) => s.replace(/\./g, '\\.');
let files = 0, edits = 0;
const report = [];

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

// F1. test-7251.mjs - its stale-cache needle points at 72.7 now.
bespoke('test-7251.mjs', [
  [
    "    .filter((n) => /sidecut-shell-v72\\.6(?![0-9])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
    "    .filter((n) => /sidecut-shell-v72\\.7(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  ],
]);

// F2. test-7252.mjs - same correction.
bespoke('test-7252.mjs', [
  [
    "    .filter((n) => /sidecut-shell-v72[.]6(?![0-9])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
    "    .filter((n) => /sidecut-shell-v72[.]7(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  ],
]);

// F3. test-726.mjs - same correction.
bespoke('test-726.mjs', [
  [
    "    .filter((n) => /sidecut-shell-v72[.]6(?![0-9])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
    "    .filter((n) => /sidecut-shell-v72[.]7(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  ],
]);

// F4. test-727.mjs - same correction for the newest gate.
bespoke('test-727.mjs', [
  [
    "    .filter((n) => /sidecut-shell-v72[.]6(?![0-9])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
    "    .filter((n) => /sidecut-shell-v72[.]7(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-7271.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY. The lookahead stops it matching a
    // longer version that merely starts the same way.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "'(?!\\.)", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "'");
      n++;
    }
  }

  // D. the adjacent-entry pin, for the gates that assert it
  const prevMove = PREV_MOVES.get(name);
  if (prevMove && src.indexOf("const PREV = '" + prevMove[0] + "';") !== -1) {
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-7271.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it. The lookahead is what keeps
  // 'sidecut-shell-v72.7' from biting the released '…-v72.7.1' on a re-run.
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
console.log('\nrepin-7271: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. Every needle carries its delimiter or boundary.
if (!CHECK) {
  const cacheStale = new RegExp('sidecut-shell-v72\\.7(?![\\d.])');
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
    console.error('repin-7271: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7271: no stale pin left in any gate');
}
