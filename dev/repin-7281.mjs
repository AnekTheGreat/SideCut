#!/usr/bin/env node
/**
 * 72.8.1 - the repin sweep.
 *
 * Same shape as dev/repin-725.mjs ... dev/repin-728.mjs. Every gate written
 * before this release pinned the build it was written against, so a release that
 * moves APP_VERSION breaks it for no reason at all. The moves:
 *
 *   A. `const VER = '72.8';` becomes the new build.
 *   B. `{ version: '72.8',` becomes the new head.
 *   D. the ADJACENT-entry pin. entries[1] is now 72.8, so every gate that
 *      compares entries[1] to the release before the head moves - test-713
 *      through test-728, all of which carry `const PREV = '72.7.1';`.
 *   E. the shell cache literal becomes the name this release ships.
 *
 * THE PREFIX TRAP, WHICH IS WHY THIS FILE LOOKS PARANOID. `'72.8'` IS a prefix of
 * `'72.8.1'`, so a bare needle built from the old number would also bite the new
 * one. Every needle here is therefore anchored:
 *
 *   * A and B carry their own terminator (`';` and `',`) so they cannot match a
 *     longer version that merely starts the same way;
 *   * E keeps a `(?![\d.])` lookahead, because the needle is built from the old
 *     cache name and a future release must not be able to bite a longer one.
 *
 * Plus the bespoke moves this release needs:
 *
 *   F1-F6. test-7251.mjs, test-7252.mjs, test-726.mjs, test-727.mjs,
 *   test-7271.mjs and test-728.mjs each end with a sweep of their own that hunts
 *   for the PREVIOUS shell cache. Those needles name the version that was
 *   previous WHEN THEY WERE WRITTEN (72.7.1), so they have to be retargeted at
 *   72.8 - the version that is genuinely older now.
 *
 *   F7. test-714.mjs is the gate for the lyrics highlight, and it pins the wave's
 *   own code. 72.8.1 replaced that code (the letters are weighed, and the glow's
 *   delay is derived from the song instead of a fixed 26ms), so the assertions
 *   about it are rewritten to describe what the wave does now. This is not a
 *   version pin: the behaviour changed, so the gate has to change with it.
 *
 * test-705.mjs and test-70.mjs must not move with A or B: they describe their own
 * release while running on whatever the app is now. Only their shell-cache pin
 * moves (E).
 *
 *   node dev/repin-7281.mjs            # apply
 *   node dev/repin-7281.mjs --check    # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const DEV = path.join(ROOT, 'dev');
const CHECK = process.argv.includes('--check');

const OLDVER = '72.8';
const NEWVER = '72.8.1';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
// Derived, not typed out: the cache name IS the release number.
const NEWCACHE = 'sidecut-shell-v' + NEWVER;

// The gates that describe their own release (70.0.5 and 70.1) keep their pins.
const KEEPS_ITS_VERSION = new Set(['test-705.mjs', 'test-70.mjs']);

// D. The ADJACENT-entry pin, for the gates that compare `entries[1]` to the
// release before the head. After repin-728 all of these carry '72.7.1'.
const PREV_MOVES = new Map([
  ['test-713.mjs', ['72.7.1', OLDVER]],
  ['test-714.mjs', ['72.7.1', OLDVER]],
  ['test-715.mjs', ['72.7.1', OLDVER]],
  ['test-716.mjs', ['72.7.1', OLDVER]],
  ['test-717.mjs', ['72.7.1', OLDVER]],
  ['test-718.mjs', ['72.7.1', OLDVER]],
  ['test-719.mjs', ['72.7.1', OLDVER]],
  ['test-720.mjs', ['72.7.1', OLDVER]],
  ['test-721.mjs', ['72.7.1', OLDVER]],
  ['test-722.mjs', ['72.7.1', OLDVER]],
  ['test-723.mjs', ['72.7.1', OLDVER]],
  ['test-724.mjs', ['72.7.1', OLDVER]],
  ['test-725.mjs', ['72.7.1', OLDVER]],
  ['test-7251.mjs', ['72.7.1', OLDVER]],
  ['test-7252.mjs', ['72.7.1', OLDVER]],
  ['test-726.mjs', ['72.7.1', OLDVER]],
  ['test-727.mjs', ['72.7.1', OLDVER]],
  ['test-7271.mjs', ['72.7.1', OLDVER]],
  ['test-728.mjs', ['72.7.1', OLDVER]],
]);

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

// Replace everything between two plain anchors with fresh text. Used where the
// old content is dense with regex escapes that would be a nightmare to reproduce
// inside a string here - the anchors are what matter, not the text between them.
function bespokeCut(name, label, startAnchor, endAnchor, newText){
  const file = path.join(DEV, name);
  const src = fs.readFileSync(file, 'utf8');
  // Already rewritten? The new text carries a mark only this cut writes, so its
  // presence means the swap is done and there is nothing to report.
  if (src.indexOf(newText.split('\n')[0]) !== -1 && src.indexOf(startAnchor) === -1) {
    report.push('  ' + name + ': bespoke already in place');
    return;
  }
  const i = src.indexOf(startAnchor);
  if (i === -1) { report.push('  ' + name + ': ' + label + ' - start anchor missing'); return; }
  const j = src.indexOf(endAnchor, i + startAnchor.length);
  if (j === -1) { report.push('  ' + name + ': ' + label + ' - end anchor missing'); return; }
  const out = src.slice(0, i) + newText + src.slice(j);
  write(name, out, 1, src);
}

// F1. test-7251.mjs - its stale-cache needle points at 72.8 now.
bespoke('test-7251.mjs', [[
  "    .filter((n) => /sidecut-shell-v72\\.7\\.1(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  "    .filter((n) => /sidecut-shell-v72\\.8(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
]]);

// F2. test-7252.mjs - the bracket form.
bespoke('test-7252.mjs', [[
  "    .filter((n) => /sidecut-shell-v72[.]7[.]1(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  "    .filter((n) => /sidecut-shell-v72[.]8(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
]]);

// F3. test-726.mjs - the bracket form.
bespoke('test-726.mjs', [[
  "    .filter((n) => /sidecut-shell-v72[.]7[.]1(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  "    .filter((n) => /sidecut-shell-v72[.]8(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
]]);

// F4. test-727.mjs - the bracket form.
bespoke('test-727.mjs', [[
  "    .filter((n) => /sidecut-shell-v72[.]7[.]1(?![0-9.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  "    .filter((n) => /sidecut-shell-v72[.]8(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
]]);

// F5. test-7271.mjs - the escaped form.
bespoke('test-7271.mjs', [[
  "    .filter((n) => /sidecut-shell-v72\\.7\\.1(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  "    .filter((n) => /sidecut-shell-v72\\.8(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
]]);

// F6. test-728.mjs - the newest gate of the previous release. Written with its
// needle already retargeted, so this is a no-op on the shipped file; it stays so
// the sweep is complete and a re-run is honest.
bespoke('test-728.mjs', [[
  "    .filter((n) => /sidecut-shell-v72\\.7\\.1(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
  "    .filter((n) => /sidecut-shell-v72\\.8(?![\\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));",
]]);

// F7. test-6137.mjs and test-6138.mjs - the changelog-head regex. B did not reach
// these because the pin is inside a regex literal and carries NO trailing comma:
// /const CHANGELOG = \[\n  \{ version: '72.8'/. That shape is its own needle.
bespoke('test-6137.mjs', [[
  "  ok(/const CHANGELOG = \\[\\n  \\{ version: '72.8'/.test(src), 'the newest entry sits inside CHANGELOG');",
  "  ok(/const CHANGELOG = \\[\\n  \\{ version: '72.8.1'/.test(src), 'the newest entry sits inside CHANGELOG');",
]]);
bespoke('test-6138.mjs', [[
  "  ok(/const CHANGELOG = \\[\\n  \\{ version: '72.8'/.test(src), 'the newest entry sits inside CHANGELOG');",
  "  ok(/const CHANGELOG = \\[\\n  \\{ version: '72.8.1'/.test(src), 'the newest entry sits inside CHANGELOG');",
]]);

// F8. test-714.mjs - the wave's own assertions, rewritten for how it paces now.
bespokeCut('test-714.mjs', 'the letter wave assertions', '  // The wave itself.\n', '  // The styles that make it read as a wave.\n',
`  // The wave itself. 72.8.1 changed how the light advances: it used to be an
  // even slice per letter, and it is now weighed by each letter's own width and
  // driven by the window the word is being sung over. The gate describes that.
  ok(count(src, 'function scEnsureLetterSpans(wordEl, letterMs){') === 1, 'a word’s letters are wrapped once, at the pace it is sung');
  ok(src.indexOf("transition-delay:' + Math.round(i * step) + 'ms'") !== -1, 'each letter carrying its own share of the delay');
  ok(src.indexOf('function scLetterWeight(ch){') !== -1, 'and a weight for what a single letter is worth');
  ok(count(src, 'function clearLetters(wordEl){') === 1, 'and a way to clear a run');
  ok(src.indexOf('if(lettersOn()){') !== -1 && count(src, 'function lettersOn(){') === 1, 'the pacing asks whether letter mode is on');
  ok(src.indexOf("scEnsureLetterSpans(w, (span * 1000) / Math.max(1, (w.textContent || '').length))") !== -1,
    'the word hands the pacer the window it is actually being sung over');
  ok(src.indexOf('if(frac < acc2){ upto = li + 1; break; }') !== -1,
    'and the light stops on the letter that window has reached');
  ok(src.indexOf('acc2 += wts[li] / wTotal2;') !== -1, 'counted by weight, not by an even step per letter');
  ok(/for\\(let li = 0; li < ls\\.length; li\\+\\+\\) ls\\[li\\]\\.classList\\.toggle\\('lit', li < upto\\);/.test(src), 'turning them on in order');
  ok(/if\\(wi !== litIdx\\)\\{ clearLetters\\(w\\); return; \\}/.test(src), 'while every other word is wiped back');
  ok(src.indexOf("words.forEach(clearLetters);") !== -1, 'and switching letter mode off clears the run');
`);

// ---- the mechanical sweep ---------------------------------------------------
for (const name of fs.readdirSync(DEV).sort()) {
  if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
  const file = path.join(DEV, name);
  let src = fs.readFileSync(file, 'utf8');
  const before = src;
  let n = 0;

  if (!KEEPS_ITS_VERSION.has(name)) {
    // A. the build pin. Anchored on its own terminator: '72.8' is a prefix of
    // '72.8.1', so a bare needle would bite the new pin too.
    const pin = new RegExp("const VER = '" + esc(OLDVER) + "';", 'g');
    if (pin.test(src)) {
      src = src.replace(pin, "const VER = '" + NEWVER + "'; /* repinned by dev/repin-7281.mjs */");
      n++;
    }
    // B. a literal pin on the head ENTRY, anchored on the following quote+comma.
    const headPin = new RegExp("\\{ version: '" + esc(OLDVER) + "',", 'g');
    if (headPin.test(src)) {
      src = src.replace(headPin, "{ version: '" + NEWVER + "',");
      n++;
    }
  }

  // D. the adjacent-entry pin, for the gates that assert it
  const prevMove = PREV_MOVES.get(name);
  if (prevMove && src.indexOf("const PREV = '" + prevMove[0] + "';") !== -1) {
    src = src.split("const PREV = '" + prevMove[0] + "';").join("const PREV = '" + prevMove[1] + "'; /* repinned by dev/repin-7281.mjs */");
    n++;
  }

  // E. the shell cache, for every gate that names it. The lookahead is what
  // keeps this from biting 'sidecut-shell-v72.8.1' on a re-run.
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
console.log('\nrepin-7281: ' + edits + ' edit(s) across ' + files + ' file(s)' + (CHECK ? ' (check only)' : ''));

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
    }
    const pm = PREV_MOVES.get(name);
    if (pm && src.indexOf("const PREV = '" + pm[0] + "';") !== -1) stale.push(name + ' PREV');
    if (cacheStale.test(src)) stale.push(name + ' cache literal');
  }
  if (stale.length) {
    console.error('repin-7281: a pin survived: ' + stale.join(', '));
    process.exit(1);
  }
  console.log('repin-7281: no stale pin left in any gate');
}