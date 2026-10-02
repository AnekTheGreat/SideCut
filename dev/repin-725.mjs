#!/usr/bin/env node
/**
 * 72.5 - the repin sweep.
 *
 * Same shape as dev/repin-724.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Three mechanical moves:
 *
 *   A. `const VER = '72.4';` becomes the new build.
 *   B. `version: '72.4'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. repin-724 moved test-713 through test-723 to 72.3,
 *      and 72.4 was the head it replaced, so every gate that compares entries[1]
 *      to the release before the head moves together - including test-724, new
 *      in 72.4.
 *   E. the shell cache literal becomes the name this release ships. The cache name
 *      IS the release number, on its own line, and it stays one number because the
 *      name is derived in both dev/patch-725.mjs and this file.
 *
 * Plus one bespoke move, a gate that was correct about the app it was written for
 * and is now describing a build that has moved on:
 *
 *   F1. test-724.mjs reads the HEAD entry for the two checks about its OWN
 *       release (`/artist/` and `/album/` + `/tag/`). The head moved to 72.5,
 *       whose notes are about All Songs, so it gets the same OWN split test-718
 *       through test-723 already carry: a named `const OWN` and a lookup of that
 *       entry. Every other head check in that section is a rule every release
 *       must satisfy and stays on the head.
 *
 * test-705.mjs is the one gate that must not move with A or B: it is the 70.0.5
 * gate and DESCRIBES that release while it runs on whatever the app is now. Only
 * its shell-cache pin moves (E), because that one is about sw.js. test-70.mjs is
 * the 70.0 gate for the same reason.
 *
 *   node dev/repin-725.mjs            # apply
 *   node dev/repin-725.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.4';
const NEWVER = '72.5';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.3', OLDVER]],
  ['test-714.mjs', ['72.3', OLDVER]],
  ['test-715.mjs', ['72.3', OLDVER]],
  ['test-716.mjs', ['72.3', OLDVER]],
  ['test-717.mjs', ['72.3', OLDVER]],
  ['test-718.mjs', ['72.3', OLDVER]],
  ['test-719.mjs', ['72.3', OLDVER]],
  ['test-720.mjs', ['72.3', OLDVER]],
  ['test-721.mjs', ['72.3', OLDVER]],
  ['test-722.mjs', ['72.3', OLDVER]],
  ['test-723.mjs', ['72.3', OLDVER]],
  ['test-724.mjs', ['72.3', OLDVER]],
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

// F1. test-724 gets the OWN split.
bespoke('test-724.mjs', [
  [
    "const SHELL_CACHE = 'sidecut-shell-v72.4';\n",
    "const SHELL_CACHE = 'sidecut-shell-v72.4';\n" +
    "// OWN is the release THIS gate describes. The head (entries[0]) moves on every\n" +
    "// release, so the checks about 72.4 itself must read the 72.4 entry - the head\n" +
    "// is 72.5 now, and its notes are about All Songs (72.5's repin added this\n" +
    "// split).\n" +
    "const OWN = '72.4';\n",
  ],
  [
    "    const notes = items.join('\\n');\n" +
    "    ok(/artist/i.test(notes), 'the notes say the artist is the thing this release is about');\n" +
    "    ok(/album/i.test(notes) && /tag/i.test(notes), 'and the album a song is tagged with');\n",
    "    const notes = items.join('\\n');\n" +
    "    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;\n" +
    "    const ownNotes = (ownEntry.items || []).join('\\n');\n" +
    "    ok(/artist/i.test(ownNotes), 'the notes say the artist is the thing this release is about');\n" +
    "    ok(/album/i.test(ownNotes) && /tag/i.test(ownNotes), 'and the album a song is tagged with');\n",
  ],
]);

// F2. test-66431 pins "those two taps are the only callers" of scRenderListNow.
// That was true, and it was the point: the two record taps draw outright while
// everything else waits its turn. 72.5 adds a third caller on purpose - filing a
// converted song into the library draws its own new row at once, because the
// waiting scheduler declines to draw while the list is moving, which is why a run
// could report a song as added while the list showed none of them. The gate now
// asserts that the third caller is that one, so the rule it was protecting (the
// taps are not the only thing allowed to force a draw, but nothing else sneaks
// one in) still holds.
bespoke('test-66431.mjs', [
  [
    "  ok(countC('scRenderListNow();') === 2, 'and those two taps are the only callers (' + countC('scRenderListNow();') + ')');\n",
    "  ok(countC('scRenderListNow();') === 3, 'and the only other caller is the one that files a song (' + countC('scRenderListNow();') + ')');\n" +
    "  ok(sliceC('  function scAddConvertedToLibrary(blob, meta, opts){', '  function scOpenLibraryAfterDownload(').indexOf('scRenderListNow();') !== -1,\n" +
    "    'which draws the new row itself rather than waiting for the scheduler');\n",
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-725.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-725.mjs */");
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
console.log('\nrepin-725: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    console.error('repin-725: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-725: no stale pin left in any gate');
}
