#!/usr/bin/env node
/**
 * 74.1.7 - a compress that carries on, a Re-encode button that asks the rate, and
 * playlists you can reorder.
 *
 * THE MOVES (same shape as dev/repin-7416.mjs, which this file is derived from):
 *
 *   A. the build pin becomes the new build (every test gate).
 *   B. the changelog head literal becomes the new head.
 *   D. the ADJACENT-entry pin MOVES: the entry under the head is 74.1.6 now.
 *   E. the shell cache literal becomes the name this release ships.
 *   F1. the two gates that pin the head as a REGEX literal with no comma.
 *   F1b. test-705's own shell-cache pin (it keeps its own build pin).
 *   F1c. test-740/741's build pin, whose comment carries the retarget note inside it.
 *   F2. test-736's three inline literals (build, head, cache).
 *   F3. the release-FAMILY pin in test-70.mjs: a no-op here for the same reason
 *       repin-7416 records - this release is inside 74, the clause is already there,
 *       and the stale sweep below proves it is not missing.
 *   F4. THE ONE BEHAVIOUR PIN THIS RELEASE MOVES. dev/studio-70-check.cjs's [6b]
 *       block (74.1.6's own) tapped the Re-encode button and expected an encode at
 *       once. 74.1.7 makes that button ask which rate, so the same door is one tap
 *       longer: it opens the sheet, the sheet's rate runs. The check that the tap
 *       target never swallows the button beside it is the point of that block, so it
 *       is kept - it just walks through the sheet now. The sheet itself is driven in
 *       the release's own block, [6d].
 *
 * There is no retarget this time and none is needed: 74.1.5 taught the two gates
 * that describe an older release (test-740.mjs, test-741.mjs) to read the entry for
 * THEIR OWN version, so a later head entry no longer moves the question under them.
 *
 * The head entry is this release's changelog entry, which dev/patch-7417.py writes;
 * run that first - the gates read the head, and a build whose head does not match
 * APP_VERSION fails almost every one of them.
 *
 *   node dev/repin-7417.mjs            # apply
 *   node dev/repin-7417.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

// The build this release moves FROM.
const OLDVERS = ['74.1.6'];
const NEWVER = '74.1.7';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release keep their own build pin.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. THE ADJACENT PIN MOVES. 74.1.7 adds an entry above 74.1.6, so the entry under
// the head is 74.1.6 now.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-7316.mjs', 'test-7317.mjs', 'test-737.mjs', 'test-738.mjs', 'test-739.mjs',
  'test-740.mjs', 'test-741.mjs',
];
const PREV_OLD = '74.1.5';
const PREV_NEW = '74.1.6';
// F3. The series this release ships in - the major of NEWVER.
const NEWSERIES = NEWVER.split('.')[0];

const BS = String.fromCharCode(92);
// Escape the dots of a version for a RegExp constructor: 74.1 -> 74(bs).1
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

// D. the adjacent-entry pin, one needle for all of them. The trailing comment chain
// a previous repin left is part of the pin, so the needle stops at the semicolon and
// the replace keeps whatever is after it.
for (const name of PREV_GATES) {
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  const re = new RegExp("(^|[^A-Za-z_])PREV = '" + esc(PREV_OLD) + "';( /\\* repinned by dev/repin-[0-9]+[.]mjs \\*/)?", 'g');
  if (!re.test(src)) { report.push('  ' + name + ': bespoke already in place'); continue; }
  src = src.replace(re, "$1PREV = '" + PREV_NEW + "'; /* repinned by dev/repin-7417.mjs */");
  write(name, src, 1, before);
}

// F1. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX literal with
// NO trailing comma, so B cannot see it. That shape is its own needle.
for (const name of ['test-6137.mjs', 'test-6138.mjs']) {
  bespoke(name, [[
    "version: '74.1.6'/.test(src), 'the newest entry sits inside CHANGELOG');",
    "version: '74.1.7'/.test(src), 'the newest entry sits inside CHANGELOG');",
  ]]);
}

// F1c. test-740.mjs and test-741.mjs carry a note after their build pin - it says the
// ask in that file reads the entry for its OWN release, which is the retarget 74.1.5
// gave them. The note lives INSIDE the pin's comment, so it has to move with the pin.
for (const name of ['test-740.mjs', 'test-741.mjs']) {
  bespoke(name, [[
    "const VER = '74.1.6'; /* repinned by dev/repin-7416.mjs; the ask below reads OWN */",
    "const VER = '74.1.7'; /* repinned by dev/repin-7417.mjs; the ask below reads OWN */",
  ]]);
}

// F1b. test-705.mjs keeps its own build pin but its SHELL CACHE moves like every
// other gate's.
bespoke('test-705.mjs', [[
  "const SHELL_CACHE = 'sidecut-shell-v74.1.6';",
  "const SHELL_CACHE = '" + NEWCACHE + "';",
]]);

// F2. test-736.mjs pins the build, the head and the cache as inline literals rather
// than through a VER const, so A, B and E cannot see any of the three.
bespoke('test-736.mjs', [
  ["ok(ver === '74.1.6', 'the app runs 74.1.6 (' + ver + ')');", "ok(ver === '74.1.7', 'the app runs 74.1.7 (' + ver + ')');"],
  ["ok(!!entries && entries[0].version === '74.1.6',", "ok(!!entries && entries[0].version === '74.1.7',"],
  ['"const CACHE_NAME = \'sidecut-shell-v74.1.6\'"', '"const CACHE_NAME = \'sidecut-shell-v74.1.7\'"'],
]);

// F3. test-70.mjs is the one gate that pins the release FAMILY rather than a build.
// 74.1.7 is inside the 74 series, so the clause a previous repin appended is the one
// this release ships in: nothing to add, and the sweep proves it.
bespoke('test-70.mjs', [[
  "     /^72\\.\\d+(\\.\\d+)?$/.test(ver) || /^73\\.\\d+(\\.\\d+)?$/.test(ver),",
  "     /^72\\.\\d+(\\.\\d+)?$/.test(ver) || /^73\\.\\d+(\\.\\d+)?$/.test(ver),",
]]);

// F4. the one behaviour pin: [6b]'s tap through the button beside the bubble now
// walks the rate sheet 74.1.7 added.
bespoke('studio-70-check.cjs', [[
  "    // The tap target must never swallow the button beside it.\n" +
  "    const realEncode2 = win.__scEncodeMp3;\n" +
  "    win.__scEncodeMp3 = () => Promise.resolve(new win.Blob([new win.Uint8Array(2000)], { type: 'audio/mpeg' }));\n" +
  "    win.SC70.renderStudio();\n" +
  "    doc.querySelector('#studioView [data-reenc=\"' + victim.id + '\"]').click();\n" +
  "    await wait(1400);\n",
  "    // The tap target must never swallow the button beside it.\n" +
  "    const realEncode2 = win.__scEncodeMp3;\n" +
  "    win.__scEncodeMp3 = () => Promise.resolve(new win.Blob([new win.Uint8Array(2000)], { type: 'audio/mpeg' }));\n" +
  "    win.SC70.renderStudio();\n" +
  "    // 74.1.7: the button asks which rate first, so this door is one tap longer.\n" +
  "    // The sheet it opens is driven in full by the release's own block [6d]; what\n" +
  "    // this proves is that the tap that opens the bubble did not eat the button.\n" +
  "    doc.querySelector('#studioView [data-reenc=\"' + victim.id + '\"]').click();\n" +
  "    await wait(60);\n" +
  "    doc.querySelector('#studioView [data-reencgo=\"' + victim.id + '\"][data-rate=\"96\"]').click();\n" +
  "    await wait(1400);\n",
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
    // A. the build pin. The comment chain a previous repin appended is part of the
    // pin now, so the needle runs to the end of the line and the replace leaves one
    // comment naming the release that moved it.
    const pin = new RegExp("(^|[^A-Za-z_])VER = '(?:" + alts + ")';[^\\n]*", 'gm');
    if (pin.test(src)) {
      src = src.replace(pin, "$1VER = '" + NEWVER + "'; /* repinned by dev/repin-7417.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp("(^|[^A-Za-z_])version: '(?:" + alts + ")',", 'gm');
    if (headPin.test(src)) {
      src = src.replace(headPin, "$1version: '" + NEWVER + "',");
      n++;
    }
  }

  // E. the shell cache, for every gate that names one - including the gates that keep
  // their own version, because the TWO store caches move together in every release
  // whether a gate describes its own build or not.
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
console.log('repin-7417: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so the
// sweep proves it is done. Every needle carries its delimiter or boundary.
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
    // The rule test-718.mjs enforces: a gate that pins a shell cache at all pins THIS
    // release name. Its own file names older caches on purpose (that is what it
    // checks), so it is the one gate excluded from both halves of this.
    if (name !== 'test-718.mjs') {
      const pin = src.match(/SHELL_CACHE = '(sidecut-shell-v[^']+)'/);
      if (pin && pin[1] !== NEWCACHE) stale.push(name + ' SHELL_CACHE pin (' + pin[1] + ')');
    }
    // F3 is a pin too: test-70.mjs must name the series this release ships in.
    if (name === 'test-70.mjs' && src.indexOf('/^' + NEWSERIES + BS + '.' + BS + 'd+') === -1) {
      stale.push(name + ' series (' + NEWSERIES + ')');
    }
    // D is a MOVE: every one of these gates must now carry 74.1.6 as the neighbour,
    // and none may still carry the 74.1.5 one.
    if (PREV_GATES.indexOf(name) !== -1) {
      if (src.indexOf("const PREV = '" + PREV_NEW + "';") === -1) stale.push(name + ' PREV');
      if (src.indexOf("const PREV = '" + PREV_OLD + "';") !== -1) stale.push(name + ' old PREV');
    }
  }
  if (stale.length) {
    console.error('repin-7417: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7417: no stale pin left in any gate');
}
