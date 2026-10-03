#!/usr/bin/env node
/**
 * 72.5.1 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs. Every gate written before this release pinned
 * the build it was written against, so a release that moves APP_VERSION breaks it
 * for no reason at all. The mechanical moves:
 *
 *   A. `const VER = '72.5';` becomes the new build.
 *   B. `{ version: '72.5',` becomes the new head, for the gates that read the
 *      changelog's first line as text rather than reading the array.
 *   D. the ADJACENT-entry pin. repin-725 moved test-713 through test-725 to 72.4;
 *      the head those gates compared against (entries[1]) is now 72.5, so every
 *      gate that compares entries[1] to the release before the head moves too.
 *   E. the shell cache literal becomes the name this release ships. The cache name
 *      IS the release number and stays one number because it is derived in both
 *      dev/patch-7251.mjs and this file.
 *
 * Plus one bespoke move:
 *
 *   F1. test-725.mjs reads the HEAD entry for the two checks about its OWN
 *       release (`/all songs/` and `/search/i`). The head moved to 72.5.1, whose
 *       notes are about the widget transport buttons, so it gets the same OWN
 *       split test-718 through test-724 already carry.
 *
 * A NOTE ON THE PATTERN-MATCHING, because 72.5.1 is a FOUR-part version and every
 * earlier repin moved between equal-width ones. `'72.5.1'` CONTAINS `'72.5'`, so a
 * naive "is the old pin still here" sweep would report a match on its own output.
 * Every stale check below is written with its delimiter (`'72.5',`, `'72.5';`) or a
 * negative lookahead (`72.5(?!\.1)`), so it can only match a pin that really is
 * stale.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E), because that one is about sw.js.
 *
 *   node dev/repin-7251.mjs            # apply
 *   node dev/repin-7251.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.5';
const NEWVER = '72.5.1';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.0) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.4', OLDVER]],
  ['test-714.mjs', ['72.4', OLDVER]],
  ['test-715.mjs', ['72.4', OLDVER]],
  ['test-716.mjs', ['72.4', OLDVER]],
  ['test-717.mjs', ['72.4', OLDVER]],
  ['test-718.mjs', ['72.4', OLDVER]],
  ['test-719.mjs', ['72.4', OLDVER]],
  ['test-720.mjs', ['72.4', OLDVER]],
  ['test-721.mjs', ['72.4', OLDVER]],
  ['test-722.mjs', ['72.4', OLDVER]],
  ['test-723.mjs', ['72.4', OLDVER]],
  ['test-724.mjs', ['72.4', OLDVER]],
  ['test-725.mjs', ['72.4', OLDVER]],
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

// F1. test-725 gets the OWN split.
bespoke('test-725.mjs', [
  [
    "    const notes = items.join('\\n');\n" +
    "    ok(/all songs/i.test(notes), 'the notes say All Songs is the thing this release is about');\n" +
    "    ok(/search/i.test(notes), 'and the search it fixes');\n",
    "    const notes = items.join('\\n');\n" +
    "    // The head (entries[0]) moves on every release, so the checks about 72.5\n" +
    "    // itself read the 72.5 entry - the head is 72.5.1 now, and its notes are\n" +
    "    // about the widget transport buttons (this split was added by 72.5.1's\n" +
    "    // repin). Every general rule below still reads the head, which is what it\n" +
    "    // is for.\n" +
    "    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;\n" +
    "    const ownNotes = (ownEntry.items || []).join('\\n');\n" +
    "    ok(/all songs/i.test(ownNotes), 'the notes say All Songs is the thing this release is about');\n" +
    "    ok(/search/i.test(ownNotes), 'and the search it fixes');\n",
  ],
]);

// F2. test-719 through test-725 end with a sweep of their own: "no gate still
// names the PREVIOUS shell cache". It probed with a bare indexOf, which was true
// for every equal-width version it had ever moved through - and is FALSE the
// moment the new name extends the old one, because 'sidecut-shell-v72.5' is a
// prefix of 'sidecut-shell-v72.5.1'. The probe now carries a dot-boundary, so it
// can only match a cache that is genuinely older. This is the one bespoke move
// that is a correction rather than a repin, and it has to happen here because the
// next equal-width release would not need it and this one cannot pass without it.
const STALE_CACHE_OLD = "    if (t.indexOf('sidecut-shell-v' + PREV) !== -1) staleCache++;\n";
const STALE_CACHE_NEW = [
  "    // PREV is a PREFIX of this release name (72.5 of 72.5.1), so a bare indexOf",
  "    // would also match this release's own cache. The dot-boundary keeps the",
  "    // check about a cache that is genuinely older (added by dev/repin-7251.mjs).",
  "    if (new RegExp('sidecut-shell-v' + PREV.replace(/\\./g, '\\\\.') + '(?!\\\\.)').test(t)) staleCache++;",
  "",
].join('\n');
for (const name of ['test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs', 'test-723.mjs', 'test-724.mjs', 'test-725.mjs']) {
  bespoke(name, [[STALE_CACHE_OLD, STALE_CACHE_NEW]]);
}

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
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-7251.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY (a gate reading the changelog's first
    // line). The lookahead is what makes this safe for a four-part version: the
    // new literal contains the old one, so a bare pattern would fire on its own
    // output. It also catches the gates that write the pin as a REGEX
    // (`{ version: '72.5'/`), which a comma-delimited pattern would miss.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "'(?!\\.)", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "'");
      n++;
    }
  }

  // D. the adjacent-entry pin, for the gates that assert it
  const prevMove = PREV_MOVES.get(name);
  if (prevMove && src.indexOf("const PREV = '" + prevMove[0] + "';") !== -1) {
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-7251.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it. The lookahead matters: the
  // new name CONTAINS the old one ('sidecut-shell-v72.5.1' starts with
  // 'sidecut-shell-v72.5'), so a plain indexOf/split would fire again on its own
  // output and produce '...v72.5.1.1'.
  const cacheRe = new RegExp(esc(OLDCACHE) + '(?!\\.1)', 'g');
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
console.log('\nrepin-7251: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. Every check carries a delimiter (or a lookahead),
// because '72.5' is a prefix of '72.5.1' and a bare indexOf would match its own
// output.
if (!CHECK) {
  const cacheStale = new RegExp('sidecut-shell-v72\\.5(?!\\.1)');
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
    console.error('repin-7251: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7251: no stale pin left in any gate');
}
