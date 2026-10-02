#!/usr/bin/env node
/**
 * 72.3 - the repin sweep.
 *
 * Same shape as dev/repin-722.mjs, and for the same reason: every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. Three mechanical moves:
 *
 *   A. `const VER = '72.2';` becomes the new build.
 *   B. `version: '72.2'` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. repin-722 moved test-713 through test-721 to 72.1,
 *      and 72.2 was the head it replaced, so every gate that compares entries[1]
 *      to the release before the head moves together - including test-722, new in
 *      72.2.
 *   E. the shell cache literal becomes the name this release ships. The cache name
 *      IS the release number, on its own line, and it stays one number because the
 *      name is derived in both dev/patch-723.mjs and this file.
 *
 * Plus one bespoke move, a gate that was correct about the app it was written for
 * and is now describing a build that has moved on:
 *
 *   F1. test-722.mjs reads the HEAD entry for checks about its OWN release
 *       (`/studio/`, `/batch/`). The head moved to 72.3, whose notes are about the
 *       release check, so it gets the same OWN split test-718, test-719, test-720
 *       and test-721 already carry: a named `const OWN` and a lookup of that entry.
 *
 * test-705.mjs is the one gate that must not move with A or B: it is the 70.0.5
 * gate and DESCRIBES that release while it runs on whatever the app is now. Only
 * its shell-cache pin moves (E), because that one is about sw.js. test-70.mjs is
 * the 70.0 gate for the same reason.
 *
 *   node dev/repin-723.mjs            # apply
 *   node dev/repin-723.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.2';
const NEWVER = '72.3';
const OLDCACHE = 'sidecut-shell-v72.2';
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.1', OLDVER]],
  ['test-714.mjs', ['72.1', OLDVER]],
  ['test-715.mjs', ['72.1', OLDVER]],
  ['test-716.mjs', ['72.1', OLDVER]],
  ['test-717.mjs', ['72.1', OLDVER]],
  ['test-718.mjs', ['72.1', OLDVER]],
  ['test-719.mjs', ['72.1', OLDVER]],
  ['test-720.mjs', ['72.1', OLDVER]],
  ['test-721.mjs', ['72.1', OLDVER]],
  ['test-722.mjs', ['72.1', OLDVER]],
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

// F1. test-722 gets the OWN split.
bespoke('test-722.mjs', [
  [
    "const SHELL_CACHE = 'sidecut-shell-v72.2';\n",
    "const SHELL_CACHE = 'sidecut-shell-v72.2';\n" +
    "// OWN is the release THIS gate describes. The head (entries[0]) moves on every\n" +
    "// release, so the checks about 72.2 itself must read the 72.2 entry - the head\n" +
    "// is 72.3 now, and its notes are about the release check (72.3's repin added\n" +
    "// this split).\n" +
    "const OWN = '72.2';\n",
  ],
  [
    "    ok(/studio/i.test(notes), 'the notes name the surface this release is about');\n" +
    "    ok(/batch/i.test(notes), 'and the thing this release adds');\n",
    "    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;\n" +
    "    const ownNotes = (ownEntry.items || []).join('\\n');\n" +
    "    ok(/studio/i.test(ownNotes), 'the notes name the surface this release is about');\n" +
    "    ok(/batch/i.test(ownNotes), 'and the thing this release adds');\n",
  ],
]);

// F2. test-612 and test-6138 watched the artist-catalog read sit INSIDE the album
// loop and guarded by catch(_idE). 72.3 moved that read into its own pass (so a
// declined album search cannot skip it) and named its guard _catE. The intent is
// the same - the catalog is read, and a failure of it cannot break the check - so
// the two gates are pointed at where those facts live now.
bespoke('test-612.mjs', [
  [
    "ok(check && check.includes('_idE'), 'best-effort: a catalog failure cannot break the check');\n",
    "ok(check && check.includes('catch(_catE)'), 'best-effort: a catalog failure cannot break the check');\n",
  ],
]);
bespoke('test-6138.mjs', [
  [
    "ok(check && check.indexOf('scItunesArtistAlbums(artist)') < check.indexOf('const albPick = []'),\n" +
    "  'its albums join the candidate pool before the collapse');\n",
    "ok(check && check.indexOf('scItunesArtistAlbums(artist)') > check.indexOf('albPick.slice(0, 5)'),\n" +
    "  'its albums join the pool in their own pass, after the term-search collapse');\n",
  ],
  [
    "ok(check && check.includes('catch(_idE)'), 'a catalog failure cannot break the check');\n",
    "ok(check && check.includes('catch(_catE)'), 'a catalog failure cannot break the check');\n",
  ],
]);

// F3. test-6139 counts the release path's catalog reads and its title+day writes.
// 72.3 adds one of each (the due-drop resolver, and the catalog pass's own
// freshTitles.add), and reads the catalog with the same junk test in the same
// place - so the numbers move and the junk-test needle is the forEach form.
bespoke('test-6139.mjs', [
  [
    "ok(count('SC_RELEASE_FETCH') === 7, 'defined + used by 6 catalog reads (' + count('SC_RELEASE_FETCH') + ')');\n",
    "ok(count('SC_RELEASE_FETCH') === 8, 'defined + used by 7 catalog reads (' + count('SC_RELEASE_FETCH') + ')');\n",
  ],
  [
    "ok(check && check.split('freshTitles.add(').length - 1 === 2, 'songs and albums both record their title+day (' + (check ? check.split('freshTitles.add(').length - 1 : 0) + ')');\n",
    "ok(check && check.split('freshTitles.add(').length - 1 === 3, 'songs, albums and the catalog pass all record their title+day (' + (check ? check.split('freshTitles.add(').length - 1 : 0) + ')');\n",
  ],
  [
    "ok(idFn2 && idFn2.includes('if(window.__scJunkTitle(r.collectionName)) return false;'), 'and the artist-catalog lookup');\n",
    "ok(idFn2 && idFn2.includes('if(window.__scJunkTitle(r.collectionName)) return;'), 'and the artist-catalog lookup');\n",
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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-723.mjs */");
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
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-723.mjs */");
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
console.log('\nrepin-723: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    console.error('repin-723: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-723: no stale pin left in any gate');
}
