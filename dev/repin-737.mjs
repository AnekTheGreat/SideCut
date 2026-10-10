#!/usr/bin/env node
/**
 * 73.7 - the Studio folds, and the section that read the download counts is gone.
 *
 * THE MOVES (same shape as dev/repin-7362.mjs, which this file is derived from):
 *
 *   A. the build pin becomes the new build (every test gate).
 *   B. the changelog head literal becomes the new head.
 *   D. the ADJACENT-entry pin MOVES: the entry under the head is 73.6.2 now.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * Nothing about a stale gate is touched here beyond the pins: a pin on a
 * behaviour a later release really changed is that gate's own business, and the
 * one gate this release had to retarget for a real removal (test-705.mjs, whose
 * APK count block describes something that no longer exists) was rewritten by
 * hand in the same commit that removed it.
 *
 * test-705.mjs and test-70.mjs keep their own build pin: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E).
 *
 *   node dev/repin-737.mjs            # apply
 *   node dev/repin-737.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

// The build this release moves FROM.
const OLDVERS = ['73.6.2'];
const NEWVER = '73.7';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release keep their own pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. THE ADJACENT PIN MOVES. 73.7 adds an entry above 73.6.2, so the entry under
// the head is 73.6.2 now.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-7316.mjs', 'test-7317.mjs', 'test-737.mjs',
];
const PREV_OLD = '73.6.1';
const PREV_NEW = '73.6.2';

const BS = String.fromCharCode(92);
// Escape the dots of a version for a RegExp constructor: 73.6.2 -> 73(bs).6(bs).2
const esc = (s) => s.split('.').join(BS + '.');
const alts = OLDVERS.map(esc).join('|');
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

// D. the adjacent-entry pin, one needle for all of them. The trailing comment
// chain a previous repin left is part of the pin, so the needle stops at the
// semicolon and the replace keeps whatever is after it.
for (const name of PREV_GATES) {
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  const re = new RegExp("(^|[^A-Za-z_])PREV = '" + esc(PREV_OLD) + "';( /\\* repinned by dev/repin-[0-9]+[.]mjs \\*/)?", 'g');
  if (!re.test(src)) { report.push('  ' + name + ': bespoke already in place'); continue; }
  src = src.replace(re, "$1PREV = '" + PREV_NEW + "'; /* repinned by dev/repin-737.mjs */");
  write(name, src, 1, before);
}

// F1. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX literal
// with NO trailing comma, so B cannot see it. That shape is its own needle.
for (const name of ['test-6137.mjs', 'test-6138.mjs']) {
  bespoke(name, [[
    "version: '73.6.2'/.test(src), 'the newest entry sits inside CHANGELOG');",
    "version: '73.7'/.test(src), 'the newest entry sits inside CHANGELOG');",
  ]]);
}

// F1b. test-705.mjs keeps its own build pin but its SHELL CACHE moves like every
// other gate's.
bespoke('test-705.mjs', [[
  "const SHELL_CACHE = 'sidecut-shell-v73.6.2';",
  "const SHELL_CACHE = '" + NEWCACHE + "';",
]]);

// F2. test-736.mjs pins the build, the head and the cache as inline literals
// rather than through a VER const, so A, B and E cannot see any of the three.
bespoke('test-736.mjs', [
  ["ok(ver === '73.6.2', 'the app runs 73.6.2 (' + ver + ')');", "ok(ver === '73.7', 'the app runs 73.7 (' + ver + ')');"],
  ["ok(!!entries && entries[0].version === '73.6.2',", "ok(!!entries && entries[0].version === '73.7',"],
  ['"const CACHE_NAME = \'sidecut-shell-v73.6.2\'"', '"const CACHE_NAME = \'sidecut-shell-v73.7\'"'],
]);

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
    // A. the build pin. The comment chain a previous repin appended is part of
    // the pin now, so the needle runs to the end of the line and the replace
    // leaves one comment naming the release that moved it.
    const pin = new RegExp("(^|[^A-Za-z_])VER = '(?:" + alts + ")';[^\\n]*", 'gm');
    if (pin.test(src)) {
      src = src.replace(pin, "$1VER = '" + NEWVER + "'; /* repinned by dev/repin-737.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp("(^|[^A-Za-z_])version: '(?:" + alts + ")',", 'gm');
    if (headPin.test(src)) {
      src = src.replace(headPin, "$1version: '" + NEWVER + "',");
      n++;
    }
  }

  // E. the shell cache, for every gate that names one - including the gates
  // that keep their own version, because the TWO store caches move together in
  // every release whether a gate describes its own build or not.
  const cacheRe = new RegExp('sidecut-shell-v(?:' + alts + ')(?![' + BS + 'd.])', 'g');
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
console.log('repin-737: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. Every needle carries its delimiter or boundary.
if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!TEST_RE.test(name) && !CHECK_RE.test(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      const verStale = OLDVERS.filter((v) => new RegExp("(^|[^A-Za-z_])VER = '" + esc(v) + "';").test(src));
      if (verStale.length) stale.push(name + ' VER');
      const headStale = OLDVERS.filter((v) => new RegExp("(^|[^A-Za-z_])version: '" + esc(v) + "',").test(src));
      if (headStale.length) stale.push(name + ' head');
      // The regex-literal form with no trailing comma, which B cannot see.
      for (const v of OLDVERS) if (src.indexOf("version: '" + v + "'/") !== -1) stale.push(name + ' head regex');
    }
    for (const v of OLDVERS) {
      if (new RegExp(esc('sidecut-shell-v' + v) + '(?![' + BS + 'd.])').test(src)) stale.push(name + ' cache literal');
    }
    // The rule test-718.mjs enforces: a gate that pins a shell cache at all pins
    // THIS release name. Its own file names older caches on purpose (that is what
    // it checks), so it is the one gate excluded from both halves of this.
    if (name !== 'test-718.mjs') {
      const pin = src.match(/SHELL_CACHE = '(sidecut-shell-v[^']+)'/);
      if (pin && pin[1] !== NEWCACHE) stale.push(name + ' SHELL_CACHE pin (' + pin[1] + ')');
    }
    // D is a MOVE: every one of these gates must now carry 73.6.2 as the
    // neighbour, and none may still carry the 73.6.1 one.
    if (PREV_GATES.indexOf(name) !== -1) {
      if (src.indexOf("const PREV = '" + PREV_NEW + "';") === -1) stale.push(name + ' PREV');
      if (src.indexOf("const PREV = '" + PREV_OLD + "';") !== -1) stale.push(name + ' old PREV');
    }
  }
  if (stale.length) {
    console.error('repin-737: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-737: no stale pin left in any gate');
}
