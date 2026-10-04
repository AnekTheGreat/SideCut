#!/usr/bin/env node
/**
 * 73.1 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs ... dev/repin-73.mjs. Every gate written before
 * this release pinned the build it was written against, so a release that moves
 * APP_VERSION breaks it for no reason at all. The moves:
 *
 *   A. `const VER = '73';` becomes the new build.
 *   B. `{ version: '73',` becomes the new head.
 *   D. the ADJACENT-entry pin MOVES THIS RELEASE. 73.1 is a dot release of 73,
 *      so the changelog gains a head and the entry below it becomes the 73
 *      entry: every gate that pinned the entry under the head (`72.8.1`) now
 *      pins `73` instead. This is the opposite of repin-73.mjs, which renamed
 *      the head and so had to leave the adjacent pin alone - a repin moves the
 *      adjacent pin when, and only when, it adds an entry above it.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * WHY THIS RELEASE IS 73.1 AND NOT 74. 73 shipped as a finished release; this is
 * a fix inside it (the lyrics are timed from the audio instead of an even split,
 * and the converters gained a format). The third number stops at nine, so the
 * next release in the 73 line is 73.1, exactly as 72.8 was followed by 72.8.1.
 *
 * Plus the bespoke moves this release needs:
 *
 *   F1-F6. test-7251.mjs, test-7252.mjs, test-726.mjs, test-727.mjs,
 *   test-7271.mjs and test-728.mjs each end with a sweep of their own that hunts
 *   for the PREVIOUS shell cache. Those needles name the version that was
 *   previous WHEN THEY WERE WRITTEN, retargeted by repin-73.mjs at 72.9; the
 *   version that is genuinely older now is 73, so they point there.
 *
 *   F7. test-6137.mjs and test-6138.mjs pin the changelog head as a REGEX
 *   literal with NO trailing comma, so B cannot see it. That shape is its own
 *   needle.
 *
 *   F8. test-727.mjs pins the converter card by its old title ("Spotify to
 *   MP3 / WAV / FLAC"). 73.1 renames every converter card to the same "... to
 *   MP3" shape, so the label the gate looks for moves with it.
 *
 * THE NEEDLE IS WRITTEN RAW. The bespoke needles are the exact bytes that sit in
 * the gate files, so they are built with String.raw and pasted verbatim instead
 * of being escaped by hand - one round of escaping too many is how a retarget
 * silently becomes a no-op that reports 'already in place'.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E).
 *
 *   node dev/repin-731.mjs            # apply
 *   node dev/repin-731.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '73';
const NEWVER = '73.1';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.1) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. THE ADJACENT PIN MOVES. 73.1 adds an entry above 73, so the entry under
// the head is 73 now. Every gate that carried the old neighbour is named here.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-731.mjs',
];
const PREV_OLD = '72.8.1';
const PREV_NEW = '73';

const esc = (s) => s.replace(/\./g, '\\.');
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
    "const PREV = '" + PREV_NEW + "'; /* repinned by dev/repin-731.mjs */",
  ]]);
}

// The sweep each of these gates ends with, spelled exactly as it sits in the
// file. Two spellings exist: the escaped `\\.9` and the bracket `[.]9`. The name
// they hunt is now the plain 73, and THAT is the trap this release hit: 73 has
// no dot to escape, so the name a sweep wants (`sidecut-shell-v73`) is the very
// text the mechanical cache move (E) and the stale check hunt for. The first run
// rewrote the needle into `sidecut-shell-v73.1`, so the sweep went hunting the
// release it was shipping. 72.9 never collided because its needle carries a
// backslash the regex-for-a-dot does not match. The needle is therefore written
// with the digit in its own character class: `v7[3]` is the same regex, and no
// cache sweep can mistake it for a literal.
const SWEEP_ESC_OLD = String.raw`sidecut-shell-v72\.9(?![\d.])`;
const SWEEP_ESC_NEW = String.raw`sidecut-shell-v7[3](?![\d.])`;
const SWEEP_BRK_OLD = String.raw`sidecut-shell-v72[.]9(?![\d.])`;
const SWEEP_BRK_NEW = String.raw`sidecut-shell-v7[3](?![\d.])`;

// F1. test-7251.mjs - its stale-cache needle points at 73 now.
bespoke('test-7251.mjs', [[SWEEP_ESC_OLD, SWEEP_ESC_NEW]]);
// F2-F4. the bracket form.
bespoke('test-7252.mjs', [[SWEEP_BRK_OLD, SWEEP_BRK_NEW]]);
bespoke('test-726.mjs', [[SWEEP_BRK_OLD, SWEEP_BRK_NEW]]);
bespoke('test-727.mjs', [[SWEEP_BRK_OLD, SWEEP_BRK_NEW]]);
// F5-F6. the newest gates of the previous releases.
bespoke('test-7271.mjs', [[SWEEP_ESC_OLD, SWEEP_ESC_NEW]]);
bespoke('test-728.mjs', [[SWEEP_ESC_OLD, SWEEP_ESC_NEW]]);

// F7. test-6137.mjs and test-6138.mjs - the changelog-head regex, which carries
// no trailing comma and so is invisible to B.
bespoke('test-6137.mjs', [[
  String.raw`version: '73'/.test(src), 'the newest entry sits inside CHANGELOG');`,
  String.raw`version: '73.1'/.test(src), 'the newest entry sits inside CHANGELOG');`,
]]);
bespoke('test-6138.mjs', [[
  String.raw`version: '73'/.test(src), 'the newest entry sits inside CHANGELOG');`,
  String.raw`version: '73.1'/.test(src), 'the newest entry sits inside CHANGELOG');`,
]]);

// F8. test-727.mjs - the converter card the step text names. 73.1 gives every
// converter card the same "... to MP3" title, so the old multi-format title is
// gone and the gate looks for the new one.
bespoke('test-727.mjs', [[
  String.raw`box.indexOf('Spotify to MP3 / WAV / FLAC') !== -1, label + ': and still names the card to open'`,
  String.raw`box.indexOf('Spotify to MP3') !== -1, label + ': and still names the card to open'`,
]]);

// ---- the mechanical sweep ---------------------------------------------------
for (const name of fs.readdirSync(DEV).sort()) {
  if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;

  if (!KEEPS_ITS_VERSION.has(name)) {
    // A. the build pin, anchored on its own terminator.
    const pin = new RegExp("const VER = '" + esc(OLDVER) + "';", 'g');
    if (pin.test(src)) {
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-731.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "',", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "',");
      n++;
    }
  }

  // E. the shell cache, for every gate that names it.
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
console.log('\nrepin-731: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

// A stale pin would only be felt as a mystery failure inside some other gate, so
// the sweep proves it is done. Every needle carries its delimiter or boundary.
if (!CHECK) {
  const cacheStale = new RegExp(esc(OLDCACHE) + '(?![\\d.])');
  const stale = [];
  for (const name of fs.readdirSync(DEV).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    const src = fs.readFileSync(path.join(DEV, name), 'utf8');
    if (!KEEPS_ITS_VERSION.has(name)) {
      if (src.indexOf("const VER = '" + OLDVER + "';") !== -1) stale.push(name + ' VER');
      if (new RegExp("\\{ version: '" + esc(OLDVER) + "',").test(src)) stale.push(name + ' head');
      // The regex-literal form with no trailing comma, which B cannot see.
      if (src.indexOf("{ version: '" + OLDVER + "'/") !== -1) stale.push(name + ' head regex');
    }    // D is a MOVE this time: every one of these gates must now carry the 73
    // entry as the neighbour, and none may still carry the 72.8.1 one.
    if (PREV_GATES.indexOf(name) !== -1) {
      if (src.indexOf("const PREV = '" + PREV_NEW + "';") === -1) stale.push(name + ' PREV');
      if (src.indexOf("const PREV = '" + PREV_OLD + "';") !== -1) stale.push(name + ' old PREV');
    }
    if (cacheStale.test(src)) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-731: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-731: no stale pin left in any gate');
}
