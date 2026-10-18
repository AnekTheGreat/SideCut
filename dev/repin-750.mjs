#!/usr/bin/env node
/**
 * 75.0 - the release number and the gates that read it.
 *
 * THE MOVES (same shape as dev/repin-749.mjs, which this file is derived from):
 *
 *   A. the build pin becomes the new build (every test gate).
 *   B. the changelog head literal becomes the new head.
 *   D. the ADJACENT-entry pin MOVES: the entry under the head is 74.9 now.
 *   E. the shell cache literal becomes the name this release ships.
 *   F1. the two gates that pin the head as a REGEX literal with no comma.
 *   F1b. test-705's own shell-cache pin (it keeps its own build pin).
 *   F1c. NONE: test-740/741's inline note was consumed by repin-749's sweep, so
 *        their line is plain `VER = '74.9'; /* repinned ... * /` and rule A sees it.
 *   F2. test-736's three inline literals (build, head, cache) - none of the
 *       mechanical shapes can see `ver === '...'` or `entries[0].version === '...'`.
 *   F3. the release-FAMILY pin in test-70.mjs: a REAL edit here - 75.0 starts a
 *       new series, so /^75\.\d+/ joins the list the page-own rule allows.
 *   F4. NO BEHAVIOUR PIN MOVES. 75.0 changes no fold; the gates that describe it
 *       are dev/ai-button-check.cjs (it clicks the header button, which still has
 *       the same id) and the new dev/ask-album-check.mjs. test-737's switch count
 *       is still 3.
 *
 * Two owner asks, so the version is 75.0 (a feature, not a fix): the Ask SideCut
 * trigger is a regular labelled button under the header icons, and the drawer can
 * create an album out of one sentence.
 *
 *   node dev/repin-750.mjs            # apply
 *   node dev/repin-750.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

// The build this release moves FROM.
const OLDVERS = ['74.9'];
const NEWVER = '75.0';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release keep their own build pin.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. THE ADJACENT PIN MOVES. 75.0 adds an entry above 74.9, so the entry under the
// head is 74.9 now.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-7316.mjs', 'test-7317.mjs', 'test-737.mjs', 'test-738.mjs', 'test-739.mjs',
  'test-740.mjs', 'test-741.mjs',
];
const PREV_OLD = '74.8';
const PREV_NEW = '74.9';
// F3. The series this release ships in - the major of NEWVER.
const NEWSERIES = NEWVER.split('.')[0];

const BS = String.fromCharCode(92);
// Escape the dots of a version for a RegExp constructor: 74.5 -> 74(bs).5
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
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  const re = new RegExp("(^|[^A-Za-z_])PREV = '" + esc(PREV_OLD) + "';( /\\* repinned by dev/repin-[0-9]+[.]mjs \\*/)?", 'g');
  if (!re.test(src)) { report.push('  ' + name + ': bespoke already in place'); continue; }
  src = src.replace(re, "$1PREV = '" + PREV_NEW + "'; /* repinned by dev/repin-750.mjs */");
  write(name, src, 1, before);
}

// F1. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX literal with
// NO trailing comma, so B cannot see it.
for (const name of ['test-6137.mjs', 'test-6138.mjs']) {
  bespoke(name, [[
    "version: '74.9'/.test(src), 'the newest entry sits inside CHANGELOG');",
    "version: '75.0'/.test(src), 'the newest entry sits inside CHANGELOG');",
  ]]);
}

// F1b. test-705.mjs keeps its own build pin but its SHELL CACHE moves like every other.
bespoke('test-705.mjs', [[
  "const SHELL_CACHE = 'sidecut-shell-v74.9';",
  "const SHELL_CACHE = '" + NEWCACHE + "';",
]]);

// F2. test-736.mjs pins the build, the head and the cache as inline literals.
bespoke('test-736.mjs', [
  ["ok(ver === '74.9', 'the app runs 74.9 (' + ver + ')'); /* repinned by dev/repin-7362.mjs */",
   "ok(ver === '75.0', 'the app runs 75.0 (' + ver + ')'); /* repinned by dev/repin-750.mjs */"],
  ["ok(!!entries && entries[0].version === '74.9',",
   "ok(!!entries && entries[0].version === '75.0',"],
  ["sw.includes(\"const CACHE_NAME = 'sidecut-shell-v74.9'\"), 'the shell cache is this release name');",
   "sw.includes(\"const CACHE_NAME = '" + NEWCACHE + "'\"), 'the shell cache is this release name');"],
]);

// F3. test-70.mjs pins the release FAMILY; 75.0 starts a series the list does not
// name yet, so this one really moves. The needle carries ONE backslash per source
// backslash - four in the literal is two in the value, which is what the file holds.
bespoke('test-70.mjs', [[
  "     /^72\\.\\d+(\\.\\d+)?$/.test(ver) || /^73\\.\\d+(\\.\\d+)?$/.test(ver) || /^74\\.\\d+(\\.\\d+)?$/.test(ver), // repin-720: the series list is extended each release",
  "     /^72\\.\\d+(\\.\\d+)?$/.test(ver) || /^73\\.\\d+(\\.\\d+)?$/.test(ver) || /^74\\.\\d+(\\.\\d+)?$/.test(ver) || /^75\\.\\d+(\\.\\d+)?$/.test(ver), // repin-720: the series list is extended each release",
]]);

// F1d. album-follow-dock-check.cjs pins the release number as a REGEX literal with no
// comma and no VER const - the one shape neither A, B nor F1 can see. The needle
// writes two backslashes per dot, JS reads one - which is what the file holds.

bespoke('album-follow-dock-check.cjs', [[
  "ok(/^74\\.9$/.test(VER), 'the page is the release this probe is for (' + VER + ')');",
  "ok(/^75\\.0$/.test(VER), 'the page is the release this probe is for (' + VER + ')');",
]]);

// F4. NO BEHAVIOUR PIN MOVES: the Gestures fold still counts its three switches.
bespoke('test-737.mjs', [[
  "ok(switches.length === 3, 'and it is the one with the three switches in it - shake, swipe and the pill dock');",
  "ok(switches.length === 3, 'and it is the one with the three switches in it - shake, swipe and the pill dock');",
]]);

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
    // A. the build pin.
    const pin = new RegExp("(^|[^A-Za-z_])VER = '(?:" + alts + ")';[^\\n]*", 'gm');
    if (pin.test(src)) {
      src = src.replace(pin, "$1VER = '" + NEWVER + "'; /* repinned by dev/repin-750.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY.
    const headPin = new RegExp("(^|[^A-Za-z_])version: '(?:" + alts + ")',", 'gm');
    if (headPin.test(src)) {
      src = src.replace(headPin, "$1version: '" + NEWVER + "',");
      n++;
    }
  }

  // E. the shell cache, for every gate that names one.
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
console.log('repin-750: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate.
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
      for (const v of OLDVERS) if (src.indexOf("version: '" + v + "'/") !== -1) stale.push(name + ' head regex');
    }
    for (const v of OLDVERS) {
      if (new RegExp(esc('sidecut-shell-v' + v) + '(?![' + BS + 'd.])').test(src)) stale.push(name + ' cache literal');
    }
    if (name !== 'test-718.mjs') {
      const pin = src.match(/SHELL_CACHE = '(sidecut-shell-v[^']+)'/);
      if (pin && pin[1] !== NEWCACHE) stale.push(name + ' SHELL_CACHE pin (' + pin[1] + ')');
    }
    if (name === 'test-70.mjs' && src.indexOf('/^' + NEWSERIES + BS + '.' + BS + 'd+') === -1) {
      stale.push(name + ' series (' + NEWSERIES + ')');
    }
    if (PREV_GATES.indexOf(name) !== -1) {
      if (src.indexOf("const PREV = '" + PREV_NEW + "';") === -1) stale.push(name + ' PREV');
      if (src.indexOf("const PREV = '" + PREV_OLD + "';") !== -1) stale.push(name + ' old PREV');
    }
    if (name === 'test-737.mjs') {
      if (src.indexOf("ok(switches.length === 3,") === -1) stale.push(name + ' switch count');
    }
    // F1d is a pin too: the release-number regex in the album-follow probe.
    if (name === 'album-follow-dock-check.cjs') {
      for (const v of OLDVERS) if (src.indexOf('/^' + esc(v) + '$/') !== -1) stale.push(name + ' release regex');
      if (src.indexOf('/^' + esc(NEWVER) + '$/') === -1) stale.push(name + ' release regex missing');
    }
  }
  if (stale.length) {
    console.error('repin-750: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-750: no stale pin left in any gate');
}
