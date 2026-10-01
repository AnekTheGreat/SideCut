#!/usr/bin/env node
/**
 * 71.8 - the repin sweep, and the one place every gate rule moves.
 *
 * Same shape as dev/repin-717.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Three mechanical moves:
 *
 *   A. `const VER = '71.7';` becomes the new build.
 *   B. `version: '71.7'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * test-705.mjs is the one gate that must not move with A or B, because it is the
 * 70.0.5 gate: it DESCRIBES that release while it runs on whatever the app is now.
 * Only its shell-cache pin moves (E), because that one is about sw.js.
 *
 *   D. the ADJACENT-entry pin. test-713, test-714, test-715 and test-716 were all
 *      moved to 71.6 by repin-717, and 71.7 is the head this release replaces, so
 *      all four move together - and test-717, new in 71.7, moves with them.
 *
 *   F. THE CACHE RULE FLIPPED, and this is why the sweep is the owner of it rather
 *      than a hand edit per file. 63.1.4 decoupled the service worker cache from
 *      the app version on purpose, and every gate written since then asserts the
 *      OLD rule: "the shell cache carries none of the app version". 71.8 makes the
 *      cache name BE the release number, so those assertions have to become the
 *      new rule. There are ~20 of them across dev/test-*.mjs and
 *      dev/ota-update-check.cjs, all one shape - a shape that a release which only
 *      half-moved would leave failing in a gate nobody ran.
 *
 *   node dev/repin-718.mjs            # apply
 *   node dev/repin-718.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '71.7';
const NEWVER = '71.8';
const OLDCACHE = 'sidecut-shell-v63.0.53';
// Derived, not typed out: the cache name IS the release number from here on.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gate that describes 70.0.5 keeps its own version pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs']);
// ...and two gates keep their own cache-rule line, rewritten by hand below: their
// `VER` names the release the gate DESCRIBES (70.0.5 and 70.0), not the app now, so
// the mechanical F rewrite would compare the cache against the wrong number.
const BESPOKE_CACHE_RULE = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['71.6', OLDVER]],
  ['test-714.mjs', ['71.6', OLDVER]],
  ['test-715.mjs', ['71.6', OLDVER]],
  ['test-716.mjs', ['71.6', OLDVER]],
  ['test-717.mjs', ['71.6', OLDVER]],
]);

// F. One shape: `ok(<cache>.indexOf(<ver>) === -1[ && ...], 'and carries none of
// the app version')`. Rewritten to the rule that is actually in force now.
const CACHE_RULE = /^([ \t]*)ok\(\s*(\w+)\.indexOf\((?:String\()?(\w+)(?:\))?\) === -1[^;\n]*?, 'and (?:carries none of the app version|is not the app version)'\);[ \t]*$/gm;

const esc = (s) => s.replace(/\./g, '\\.');
let files = 0, edits = 0;
const report = [];
let ruleFlips = 0;

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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-718.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-718.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it
  if (src.indexOf(OLDCACHE) !== -1) {
    src = src.split(OLDCACHE).join(NEWCACHE);
    n++;
  }

  // F. the cache rule itself
  if (!BESPOKE_CACHE_RULE.has(name) && CACHE_RULE.test(src)) {
    let flips = 0;
    src = src.replace(CACHE_RULE, (m, indent, cacheVar, verExpr) => {
      flips++;
      return indent + "ok(" + cacheVar + " === 'sidecut-shell-v' + " + verExpr +
        ", 'the shell cache is the release number (' + " + cacheVar + " + ')');";
    });
    CACHE_RULE.lastIndex = 0;
    if (flips) { n++; ruleFlips += flips; }
  }

  if (src !== before) {
    files++;
    edits += n;
    report.push('  ' + name + ': ' + n + ' edit(s)');
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

// F (bespoke). test-705.mjs: its `VER` is 70.0.5, so the version it must compare
// the cache to is the app's own, read from the page it already has open.
{
  const file = path.join(DEV, 'test-705.mjs');
  const src = fs.readFileSync(file, 'utf8');
  const old = "  ok(swCache.indexOf(VER) === -1 && swCache.indexOf('70.0') === -1, 'and carries none of the app version');";
  const neu = "  ok(swCache === 'sidecut-shell-v' + (src.match(/const APP_VERSION = '([^']+)'/) || [])[1], 'the shell cache is the release number (' + swCache + ')');";
  if (src.indexOf(old) !== -1) {
    report.push('  test-705.mjs: 1 edit(s) (bespoke cache rule)');
    files++; edits++;
    if (!CHECK) fs.writeFileSync(file, src.split(old).join(neu));
  }
}

// F (bespoke). test-70.mjs: same reason as test-705.mjs - its `VER` is 70.0, the
// release this gate describes, so the app version is read from the page instead.
{
  const file = path.join(DEV, 'test-70.mjs');
  const src = fs.readFileSync(file, 'utf8');
  const old = "  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');";
  const neu = "  ok(swCache === 'sidecut-shell-v' + (src.match(/const APP_VERSION = '([^']+)'/) || [])[1], 'the shell cache is the release number (' + swCache + ')');";
  if (src.indexOf(old) !== -1) {
    report.push('  test-70.mjs: 1 edit(s) (bespoke cache rule)');
    files++; edits++;
    if (!CHECK) fs.writeFileSync(file, src.split(old).join(neu));
  }
}

// F (bespoke). dev/ota-update-check.cjs states the old rule in a comment AND in a
// three-line assertion, so it is not one of the mechanical shapes.
{
  const file = path.join(DEV, 'ota-update-check.cjs');
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  const pairs = [
    ['  // The cache name carries its OWN number on purpose (AGENTS.md, "sw.js cache name"):\n' +
     '  // it is bumped when the shell changes, not on every app version, so it must be\n' +
     '  // versioned and it must not be the app version.\n',
     '  // The cache name IS the release number (AGENTS.md, "sw.js cache name"): APP_VERSION\n' +
     '  // moves every release and the shell names its cache after the build it belongs to,\n' +
     "  // so a new build can never be served the previous build's cached page.\n"],
    ["  ok('the service worker cache name is versioned, and is not the app version',\n" +
     "     !!swCache && /^sidecut-shell-v\\d+(\\.\\d+)*$/.test(swCache) && swCache.indexOf(String(APP_VERSION)) === -1,\n",
     "  ok('the service worker cache name is the release number',\n" +
     "     !!swCache && swCache === ('sidecut-shell-v' + APP_VERSION),\n"],
  ];
  let n = 0;
  for (const [a, b] of pairs) {
    if (src.indexOf(b) !== -1) continue;
    if (src.indexOf(a) === -1) continue;
    src = src.split(a).join(b);
    n++;
  }
  if (src !== before) {
    report.push('  ota-update-check.cjs: ' + n + ' edit(s) (bespoke cache rule)');
    files++; edits += n;
    if (!CHECK) fs.writeFileSync(file, src);
  }
}

// F3 (bespoke). test-716.mjs and test-717.mjs read `entries[0]` for the checks that
// are about what THEIR release did. Until 71.8 the head WAS their release, so it
// worked by accident; now it does not. Those checks read the entry they describe
// (the same `const OWN` shape dev/test-715.mjs already uses), while everything
// about the changelog itself keeps reading the head.
{
  const jobs = [
    {
      file: 'test-716.mjs',
      own: '71.6',
      pairs: [
        ["    const items = head.items || [];\n",
         "    const items = head.items || [];\n    const own = entries.find((e) => String(e.version) === OWN) || head;\n    const ownNotes = (own.items || []).join('\\n');\n"],
        ["String(head.title)), 'the title names the thing that came back'",
         "String(own.title)), 'the 71.6 title names the thing that came back'"],
        ["ok(/album tag/i.test(notes), 'the notes say where the albums are read from');",
         "ok(/album tag/i.test(ownNotes), 'the 71.6 notes say where the albums are read from');"],
        ["ok(/rebuild/i.test(notes), 'and name the way back');",
         "ok(/rebuild/i.test(ownNotes), 'and name the way back');"],
        ["ok(/backup/i.test(notes), 'and the half of it that is about a restore');",
         "ok(/backup/i.test(ownNotes), 'and the half of it that is about a restore');"],
      ],
    },
    {
      file: 'test-717.mjs',
      own: '71.7',
      pairs: [
        ["    const items = head.items || [];\n",
         "    const items = head.items || [];\n    const own = entries.find((e) => String(e.version) === OWN) || head;\n    const ownNotes = (own.items || []).join('\\n');\n"],
        ["ok(/undo/i.test(notes), 'the notes promise the undo');",
         "ok(/undo/i.test(ownNotes), 'the 71.7 notes promise the undo');"],
        ["ok(/backup/i.test(notes), 'and the backup as the copy with the real albums');",
         "ok(/backup/i.test(ownNotes), 'and the backup as the copy with the real albums');"],
      ],
    },
  ];
  for (const job of jobs) {
    const file = path.join(DEV, job.file);
    let src = fs.readFileSync(file, 'utf8');
    const before = src;
    if (src.indexOf("const OWN = '" + job.own + "';") === -1) {
      const anchor = "const SHELL_CACHE = '" + NEWCACHE + "';\n";
      if (src.indexOf(anchor) === -1) {
        console.error('repin-718: ' + job.file + ': no SHELL_CACHE anchor for the OWN pin');
        process.exit(1);
      }
      src = src.replace(anchor, anchor + "const OWN = '" + job.own + "'; // repin-718: the release this gate describes\n");
    }
    for (const [a, b] of job.pairs) {
      if (src.indexOf(b) !== -1) continue;
      if (src.indexOf(a) === -1) {
        console.error('repin-718: ' + job.file + ': missing OWN-split anchor: ' + JSON.stringify(a.slice(0, 64)));
        process.exit(1);
      }
      src = src.split(a).join(b);
    }
    if (src !== before) {
      report.push('  ' + job.file + ': bespoke OWN split');
      files++; edits++;
      if (!CHECK) fs.writeFileSync(file, src);
    }
  }
}

// F4 (bespoke). A gate whose `const VER` names the release it DESCRIBES rather than
// the app now (test-6643 keeps 64.3.1) but which reads the app version into
// PAGEVER: the mechanical rewrite could not know that, so the rule line is
// re-pointed at the page's own version.
{
  for (const name of ['test-6643.mjs', 'test-66431.mjs']) {
    const file = path.join(DEV, name);
    const src = fs.readFileSync(file, 'utf8');
    if (src.indexOf('const PAGEVER') === -1) continue;
    let t = src;
    for (const expr of ['VER', 'ver']) {
      const from = "ok(swCache === 'sidecut-shell-v' + " + expr + ", 'the shell cache is the release number (' + swCache + ')');";
      const to = "ok(swCache === 'sidecut-shell-v' + PAGEVER, 'the shell cache is the release number (' + swCache + ')');";
      t = t.split(from).join(to);
    }
    if (t !== src) {
      report.push('  ' + name + ': bespoke PAGEVER fix');
      files++; edits++;
      if (!CHECK) fs.writeFileSync(file, t);
    }
  }
}

report.forEach((l) => console.log(l));
console.log('\nrepin-718: ' + edits + ' edit(s) across ' + files + ' file(s), ' + ruleFlips + ' cache-rule flip(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done.
if (!CHECK) {
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    // dev/test-718.mjs NAMES the old rule on purpose (it is the gate that proves
    // the rule moved), so it is the one file allowed to carry the old strings.
    if (name === 'test-718.mjs') continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      if (src.indexOf("const VER = '" + OLDVER + "'") !== -1) stale.push(name + ' VER');
      if (src.indexOf("{ version: '" + OLDVER + "'") !== -1) stale.push(name + ' head');
    }
    const pm = PREV_MOVES.get(name);
    if (pm && src.indexOf("const PREV = '" + pm[0] + "';") !== -1) stale.push(name + ' PREV');
    if (src.indexOf(OLDCACHE) !== -1) stale.push(name + ' cache literal');
    if (src.indexOf('and carries none of the app version') !== -1) stale.push(name + ' old cache rule');
    if (src.indexOf('and is not the app version') !== -1) stale.push(name + ' old cache rule');
  }
  if (stale.length) {
    console.error('repin-718: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-718: no stale pin, no old cache rule left in any gate');
}
