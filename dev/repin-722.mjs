#!/usr/bin/env node
/**
 * 72.2 - the repin sweep.
 *
 * Same shape as dev/repin-721.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Four mechanical moves:
 *
 *   A. `const VER = '72.1';` becomes the new build.
 *   B. `version: '72.1'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. repin-721 moved test-713 through test-720 to 72.0,
 *      and 72.1 was the head it replaced, so every gate that compares entries[1]
 *      to the release before the head moves together - including test-721, new in
 *      72.1.
 *   E. the shell cache literal becomes the name this release ships. The cache name
 *      IS the release number, on its own line, and it stays one number because the
 *      name is derived in both dev/patch-722.mjs and this file.
 *
 * Plus two bespoke moves, both of them a gate that was correct about the app it
 * was written for and is now describing a build that has moved on:
 *
 *   F1. test-721.mjs reads the HEAD entry for checks about its OWN release
 *       (`/refetch/`, `/album/ && /single/`). The head moved to 72.2, whose notes
 *       are about Studio, so it gets the same OWN split test-718, test-719 and
 *       test-720 already carry: a named `const OWN` and a lookup of that entry.
 *
 *   F2. dev/studio-70-check.cjs counts the Studio tool cards and asserts nine of
 *       them. 72.2 adds the clean-up card, so the count is ten and the new card is
 *       named. Nothing was traded away for it.
 *
 * test-705.mjs is the one gate that must not move with A or B: it is the 70.0.5
 * gate and DESCRIBES that release while it runs on whatever the app is now. Only
 * its shell-cache pin moves (E), because that one is about sw.js. test-70.mjs is
 * the 70.0 gate for the same reason.
 *
 *   node dev/repin-722.mjs            # apply
 *   node dev/repin-722.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.1';
const NEWVER = '72.2';
const OLDCACHE = 'sidecut-shell-v72.1';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.0', OLDVER]],
  ['test-714.mjs', ['72.0', OLDVER]],
  ['test-715.mjs', ['72.0', OLDVER]],
  ['test-716.mjs', ['72.0', OLDVER]],
  ['test-717.mjs', ['72.0', OLDVER]],
  ['test-718.mjs', ['72.0', OLDVER]],
  ['test-719.mjs', ['72.0', OLDVER]],
  ['test-720.mjs', ['72.0', OLDVER]],
  ['test-721.mjs', ['72.0', OLDVER]],
]);

const esc = (s) => s.replace(/\./g, '\\.');
let files = 0, edits = 0;
const report = [];

// ---- F. the bespoke moves ---------------------------------------------------
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

// F1. test-721 gets the OWN split.
bespoke('test-721.mjs', [
  [
    "const SHELL_CACHE = 'sidecut-shell-v72.1';\n",
    "const SHELL_CACHE = 'sidecut-shell-v72.1';\n" +
    "// OWN is the release THIS gate describes. The head (entries[0]) moves on every\n" +
    "// release, so the checks about 72.1 itself must read the 72.1 entry - the head\n" +
    "// is 72.2 now, and its notes are about Studio (72.2's repin added this split).\n" +
    "const OWN = '72.1';\n",
  ],
  [
    "    ok(/album/i.test(notes) && /single/i.test(notes), 'the notes name the two things this release is about');\n" +
    "    ok(/refetch/i.test(notes), 'and the thing the owner actually reported');\n",
    "    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;\n" +
    "    const ownNotes = (ownEntry.items || []).join('\\n');\n" +
    "    ok(/album/i.test(ownNotes) && /single/i.test(ownNotes), 'the notes name the two things this release is about');\n" +
    "    ok(/refetch/i.test(ownNotes), 'and the thing the owner actually reported');\n",
  ],
]);

// F2. the Studio card count follows the tenth card.
bespoke('studio-70-check.cjs', [
  [
    "    ok(tools.length === 9, 'nine tool cards (' + tools.join(',') + ')');\n" +
    "    ['crop', 'clip', 'edit', 'fx', 'karaoke', 'sampler', 'looper', 'sleep', 'practice'].forEach((k) =>\n",
    "    // 72.2: ten. The clean-up joined the row - the rack's silence trim and level\n" +
    "    // match with the knobs already set - and again nothing was traded away for it.\n" +
    "    ok(tools.length === 10, 'ten tool cards (' + tools.join(',') + ')');\n" +
    "    ['crop', 'clip', 'edit', 'cleanup', 'fx', 'karaoke', 'sampler', 'looper', 'sleep', 'practice'].forEach((k) =>\n",
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-722.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-722.mjs */");
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
console.log('\nrepin-722: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    console.error('repin-722: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-722: no stale pin left in any gate');
}
