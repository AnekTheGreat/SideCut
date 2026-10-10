#!/usr/bin/env node
/**
 * 73.6.2 - DJ Mode joins Studio, and the built-in assistant stops answering the
 * wrong question.
 *
 * WHY THIS RELEASE EXISTS. The owner, with a screenshot of the assistant
 * answering "Can I compact my library" with the playlist share-code paragraph:
 * "This AI is just complete wrong and the dj mode should also be like shown in
 * studio because that makes sense update old things not updates v73.6.2".
 *
 * THE MOVES (same shape as dev/repin-7321.mjs, which this file is derived from):
 *
 *   A. the build pin becomes the new build (every test gate).
 *   B. the changelog head literal becomes the new head.
 *   D. the ADJACENT-entry pin MOVES: the entry under the head is 73.6.1 now.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * THE CATCH-UP. 73.5, 73.6 and 73.6.1 shipped without running this sweep, so
 * their gates were left pinning 73.2.1 - three releases stale, which is why the
 * battery has been carrying "the app runs 73.2.1 (73.6.1)" failures for three
 * releases. A stale pin is a stale pin whatever released it, so A, B, D and E
 * each move BOTH values in this one pass: the build that moved this time (73.6.1)
 * and the one every gate was still sitting on (73.2.1). Nothing else about a
 * stale gate is touched here - a pin on a behaviour that a later release really
 * changed is that gate's own business, not a version sweep's.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their
 * own release while running on whatever the app is now. Only their shell-cache
 * pin moves (E).
 *
 *   node dev/repin-7362.mjs            # apply
 *   node dev/repin-7362.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

// Every build a gate could still be pinned to, oldest first. The first is what
// this release moves FROM; the second is the one the skipped sweeps left behind.
const OLDVERS = ['73.6.1', '73.2.1'];
const NEWVER = '73.6.2';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release keep their own pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. THE ADJACENT PIN MOVES. 73.6.2 adds an entry above 73.6.1, so the entry
// under the head is 73.6.1 now. Every gate that carries the neighbour pin is
// named here - the list test-7316.mjs sweeps for, plus the ones added since.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-7316.mjs', 'test-7317.mjs',
];
// The neighbour every one of those gates has been sitting on since 73.2 landed.
const PREV_OLD = '73.2';
const PREV_NEW = '73.6.1';

const BS = String.fromCharCode(92);
// Escape the dots of a version for a RegExp constructor: 73.6.1 -> 73(bs).6(bs).1
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

// D. the adjacent-entry pin, one needle for all of them.
for (const name of PREV_GATES) {
  bespoke(name, [[
    "const PREV = '" + PREV_OLD + "';",
    "const PREV = '" + PREV_NEW + "'; /* repinned by dev/repin-7362.mjs */",
  ]]);
}

// F1. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX literal
// with NO trailing comma, so B cannot see it. That shape is its own needle.
for (const name of ['test-6137.mjs', 'test-6138.mjs']) {
  bespoke(name, [[
    "version: '73.2.1'/.test(src), 'the newest entry sits inside CHANGELOG');",
    "version: '73.6.2'/.test(src), 'the newest entry sits inside CHANGELOG');",
  ]]);
}

// F1b. test-705.mjs keeps its own build pin (it describes 70.0 while running on
// whatever the app is now) but its SHELL CACHE moves like every other gate's -
// and it was left at 73.3 by the sweeps that never ran, which is exactly what
// test-718.mjs counts as "a shell-cache pin that does not name this release".
bespoke('test-705.mjs', [[
  "const SHELL_CACHE = 'sidecut-shell-v73.3';",
  "const SHELL_CACHE = '" + NEWCACHE + "';",
]]);

// F2. test-736.mjs pins the build, the head and the cache as inline literals
// rather than through a VER const, so A, B and E cannot see any of the three.
bespoke('test-736.mjs', [
  ["ok(ver === '73.6.1', 'the app runs 73.6.1 (' + ver + ')');", "ok(ver === '73.6.2', 'the app runs 73.6.2 (' + ver + ')');"],
  ["ok(!!entries && entries[0].version === '73.6.1',", "ok(!!entries && entries[0].version === '73.6.2',"],
  ['"const CACHE_NAME = \'sidecut-shell-v73.6.1\'"', '"const CACHE_NAME = \'sidecut-shell-v73.6.2\'"'],
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
      src = src.replace(pin, "$1VER = '" + NEWVER + "'; /* repinned by dev/repin-7362.mjs */");
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
console.log('repin-7362: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    // D is a MOVE: every one of these gates must now carry 73.6.1 as the
    // neighbour, and none may still carry the 73.2 one.
    if (PREV_GATES.indexOf(name) !== -1) {
      if (src.indexOf("const PREV = '" + PREV_NEW + "';") === -1) stale.push(name + ' PREV');
      if (src.indexOf("const PREV = '" + PREV_OLD + "';") !== -1) stale.push(name + ' old PREV');
    }
  }
  if (stale.length) {
    console.error('repin-7362: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7362: no stale pin left in any gate');
}
