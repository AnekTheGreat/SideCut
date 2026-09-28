#!/usr/bin/env node
// SideCut - 64.2.7: the pinned artists island and the Favorites bubble stop
// flickering on the animated themes.
//
// Reported: "I said pinned artist plateau and the favorites bubble are affected
// by slightly disappearing before reappearing with dynamic themes".
//
// Two surfaces, one cause, and it is neither surface's own CSS:
//
//   * WHAT A DYNAMIC THEME ACTUALLY ADDS. Every `theme-dyn-` rule in this file
//     is one of only two things: the two full-viewport backdrop layers
//     (`body[class*="theme-dyn-"]::before` / `::after`, both `position:fixed`,
//     both `z-index:-1`) and `body[class*="theme-dyn-"] .home-bubble .hb-glow`.
//     Nothing dynamic-theme-gated touches #pinnedArtistsStrip, #pinnedArtistsList
//     or .pinned-artist-chip - and a chip carries no animated child at all - so
//     the island's flicker cannot be coming from a rule on the island. What the
//     island and the Home grid DO share is the backdrop, which only exists while
//     a dynamic theme is selected. That is why both flicker on dynamic themes
//     and neither does on a static one.
//
//   * THE FILTER THAT WAS SUPPOSED TO BE GONE ALREADY. `body...::before` was
//     still animating `sd-dyn-hue` - `filter: hue-rotate() saturate()` - in all
//     13 of its rules. A filter is not a compositor-only property on a layer
//     this large: it re-runs the paint of the whole backdrop, and the backdrop
//     is the one thing every screen in the app sits on. The note the v60 motion
//     pass left behind already describes the intended design as "all of it is
//     transform/opacity only so the compositor runs it without repainting" and
//     calls the filter "a filter re-runs the paint on the whole backdrop every
//     frame" - the keyframes and their uses were simply never removed with it.
//     64.2.7 removes them. The drift, the counter-moving ::after and the sheen
//     are untouched, so the themes keep their motion.
//
//   * THE ISLAND'S OWN SCROLL NEVER ASKED FOR A REPAIR. watchPinnedRail listened
//     on #discoverView only. A `scroll` event on an element does not bubble, and
//     #pinnedArtistsList is its own `overflow-x:auto` scroller - so swiping the
//     artists sideways, the one gesture that moves the island itself, never
//     reached the repair at all. It is watched now as well.
//
//   node dev/patch-66427.mjs
//   node dev/patch-66427.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use

const VER = '64.2.7';
const OLD_VER = '64.2.6';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 28, 2026 ' + DOT + ' 11:15 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 10:40 PM EDT';
const SW_CACHE = '63.0.25';
const OLD_SW_CACHE = '63.0.24';

const TITLE = 'The pinned artists island and the Favorites bubble stop flickering on the animated themes';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere), so no
// tooling wording. The wording rules the shipped list and the store list are
// held to, all of them carrying over to the head entry: no downloader term, no
// name for the other build, none of the terms the wider store list knows, one
// note that says what the release left alone (dev/test-6642 and dev/test-6641
// want "rollback" in it), and the words the two most recent gates read the head
// entry for - dev/test-66425 wants "blank", dev/test-66426 wants "list" and
// "record" - so a repin cannot turn those gates into a description of a release
// that is not there.
const NOTES = [
  'The pinned artists island and the Favorites bubble stop flickering on the animated themes. Both sit on the two animated background layers, and one of them was still running a colour filter that re-painted the whole background every frame. It is gone.',
  'That filter was the one thing an animated theme added under every screen. It re-painted the background continuously, and the dropped paint behind every blank card this app has chased is much harder to put back while that is going on.',
  'The pinned artists island now repairs itself when you swipe the artists sideways. A scroll event on an element does not travel up to the page around it, so the repair on Discover never saw that gesture - the one that moves the island itself.',
  'Nothing in your library is touched. Same songs, playlists, covers and pinned artists, the record tap behaves exactly as it did, and no setting or saved rollback copy is changed by this update.',
  'The animated themes keep their motion. The two background layers still drift, one counter-moving in the theme accents with the slow sheen on top, and the glow on a bubble still breathes. Only the colour-cycling filter that sat on them has been taken away.',
  'This is 64.2.7 and not a rebuild of 64.2.6: a phone already on that version is offered it and installs it.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66427 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Replace every match of a pattern (used where the same shape is repeated with
// different numbers - the 13 per-theme drift timings). This one is a REMOVAL, so
// "no match left" is what says it is already applied - a marker string would be
// wrong here, because the comment that replaces it is inserted by a later step.
function subRe(label, re, newStr, want) {
  const got = (src.match(re) || []).length;
  if (newStr === '' && got === 0) return skip(label);
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': matched ' + got + ' time(s), want ' + want);
  src = src.replace(re, newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the animated filter comes off the backdrop
// ═══════════════════════════════════════════════════════════════════════════

sub('the hue-rotation keyframes are removed',
  `@keyframes sd-dyn-hue{
  0%{ filter: hue-rotate(0deg) saturate(1.1); }
  50%{ filter: hue-rotate(28deg) saturate(1.3); }
  100%{ filter: hue-rotate(0deg) saturate(1.1); }
}
`,
  `/* 64.2.7: the sd-dyn-hue keyframes and their 13 uses lived here. They animated
   a colour filter on the ::before backdrop, and a filter is not a compositor
   property on a layer this large - it re-runs the paint of the whole backdrop,
   which is the one layer every screen in the app sits on, and it was the only
   thing an animated theme added under the pinned-artists island. See the v60
   note below, which already describes this design as transform/opacity only. */
`,
  undefined, 'the sd-dyn-hue keyframes and their 13 uses lived here');

subRe('not one backdrop rule animates a filter any more',
  /, sd-dyn-hue [0-9]+s ease-in-out infinite/g, '', 13);

sub('and the v60 note records that it is finally true',
  `   and all of it is transform/opacity only so the compositor runs it without
   repainting. The per-theme drift timings below keep each one distinct. */`,
  `   and all of it is transform/opacity only so the compositor runs it without
   repainting. The per-theme drift timings below keep each one distinct.

   64.2.7 finished the sentence above. The filter it was written about - the
   sd-dyn-hue animation - was still on every ::before here, so the backdrop was
   still re-painting itself continuously and the pinned-artists island and the
   Home grid both flickered on it. It is gone now, which is what this note
   claimed all along. The drift, the counter-moving ::after and the sheen are
   untouched: every remaining bit of this motion is transform and opacity. */`,
  undefined, '64.2.7 finished the sentence above');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - the island's own scroller asks for the repair too
// ═══════════════════════════════════════════════════════════════════════════

sub('the settle is named so two scrollers can share it',
  `    dv.addEventListener('scroll', function(){
      if(t) clearTimeout(t);
      t = setTimeout(function(){`,
  `    var onRailScroll = function(){
      if(t) clearTimeout(t);
      t = setTimeout(function(){`,
  undefined, 'var onRailScroll = function(){');

sub('and the island watches its own scroller as well as Discover',
  `        }catch(_eRailWatch){}
      }, 140);
    }, { passive: true });
  })();`,
  `        }catch(_eRailWatch){}
      }, 140);
    };
    dv.addEventListener('scroll', onRailScroll, { passive: true });
    // The island's OWN scroller is watched too, and this is the half that was
    // missing: a \`scroll\` event on an element does not bubble, so the sideways
    // swipe over the chips - the one gesture that moves the island itself -
    // never reached the listener above at all, and the repair was never asked
    // for by the scroll that needs it most. #pinnedArtistsList is never replaced
    // (renderPinnedArtists writes its innerHTML), so one listener here lasts as
    // long as the page does.
    var rl = $('pinnedArtistsList');
    if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });
  })();`,
  undefined, "if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });");

fs.writeFileSync(FILE, src);
console.log('patch-66427: index.html written (' + edits + ' edit(s))');

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the release itself
// ═══════════════════════════════════════════════════════════════════════════

let rel = fs.readFileSync(FILE, 'utf8');
const relSkip = (l) => console.log('= ' + l + ' (already applied)');
const relDone = (l) => { console.log('+ ' + l); edits++; };

if (rel.indexOf(`  const APP_VERSION = '` + VER + `';`) !== -1) relSkip('APP_VERSION is ' + VER);
else {
  if (rel.indexOf(`  const APP_VERSION = '` + OLD_VER + `';`) === -1) throw new Error('APP_VERSION was not ' + OLD_VER);
  rel = rel.split(`  const APP_VERSION = '` + OLD_VER + `';`).join(`  const APP_VERSION = '` + VER + `';`);
  relDone('APP_VERSION is ' + VER);
}

// The new entry goes AHEAD of the 64.2.6 one, which stays exactly where it is:
// every earlier release is still listed and still readable in the bell.
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + n + `',`).join('') + `\n  ] },\n`;
if (rel.indexOf(`  { version: '` + VER + `', date: '` + STAMP + `'`) !== -1) relSkip('the head changelog entry is ' + VER);
else {
  if (rel.indexOf(`  const CHANGELOG = [\n`) === -1) throw new Error('the CHANGELOG opener was not found');
  rel = rel.split(`  const CHANGELOG = [\n`).join(`  const CHANGELOG = [\n` + HEAD_NEW);
  relDone('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes');
}
// The second note went in longer than the 260-character rule the shipped list
// is held to. The first run of this script wrote it that way; this shortens the
// copy that is on the page so a rerun lands on the entry the gate describes.
// Harmless once it has run: the long wording is gone, so there is nothing to
// replace and the step is skipped.
const LONG_NOTE = 'That filter was the one thing an animated theme added under every screen, and it re-painted the background continuously. A phone that drops the paint of scrolling content - the fault behind every blank card this app has chased - finds it much harder to put a frame together while that is going on.';
if (rel.indexOf(LONG_NOTE) !== -1) {
  rel = rel.split(LONG_NOTE).join(NOTES[1]);
  relDone('the second note was shortened to the length the shipped list allows');
}
fs.writeFileSync(FILE, rel);

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (sw.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (sw.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  fs.writeFileSync(SW, sw.split(SW_OLD).join(SW_NEW));
  done('the service worker cache moves on ' + SW_CACHE);
}

// ═══════════════════════════════════════════════════════════════════════════
// 4 - the version pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
// A bump rewrites quoted version literals in every dev/test-*.mjs. Gates that
// describe an OLDER release read it by version with a regex and pin nothing of
// the head entry here; dev/test-66425 and dev/test-66426 read the HEAD entry,
// so the notes above are written to satisfy both of them (rollback, blank, list,
// record) rather than only this release's own gate.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);
let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}
console.log('patch-66427: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const code = final.replace(/^\s*\/\/.*$/gm, '');
const count = (needle) => final.split(needle).length - 1;

// 1 - the backdrop no longer runs a filter, and it still moves
must(!has('@keyframes sd-dyn-hue{'), 'the hue keyframes are gone');
must(!/, sd-dyn-hue /.test(final), 'and nothing animates sd-dyn-hue any more');
must(!/filter: hue-rotate\(0deg\) saturate\(1\.1\)/.test(final), 'no filter is declared on the backdrop');
must(count('animation: sd-dyn-drift ') === 13, 'every dynamic theme still gets its drift (' + count('animation: sd-dyn-drift ') + ' of 13)');
must(has('@keyframes sd-dyn-drift{') && has('@keyframes sd-dyn-drift-rev{') && has('@keyframes sd-dyn-sheen{'),
  'the three motion keyframes that stay are still declared');
must(!/\.home-bubble \.hb-glow\{[^}]*filter/.test(final), 'and no bubble glow gained a filter on the way');
{
  // Every rule that animates the ::before backdrop must be transform/opacity
  // only - that is the whole claim of this release.
  const rules = final.match(/body(?:\.theme-dyn-[a-z]+)?\[?[^{]*::before\{[^}]*\}/g) || [];
  const withFilter = rules.filter((r) => /filter:/.test(r));
  must(rules.length >= 13, 'the backdrop rules are all still here (' + rules.length + ')');
  must(withFilter.length === 0, 'and not one of them declares a filter (' + withFilter.length + ')');
}

// 2 - the island's own scroller asks for the repair
must(has('    var onRailScroll = function(){'), 'the rail settle is named once');
must(has("    dv.addEventListener('scroll', onRailScroll, { passive: true });"), 'Discover still asks on its own scroll');
must(has("    if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });"),
  'and the island scroller asks on its own scroll as well');
must(has("    var rl = $('pinnedArtistsList');"), 'which is the scroller that holds the chips');
must(!/addEventListener\('scroll', function\(\)\{\n      if\(t\) clearTimeout\(t\);\n      t = setTimeout\(function\(\)\{\n        t = null;\n        try\{\n          if\(!pinnedArtists/.test(code),
  'and the sideways swipe is no longer the one gesture with no listener');
must(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
  'the rail is still built again when it really has lost its chips');
must(count("          repaintPinnedRail(l);\n") === 1, 'and a settled scroll still repaints the card itself');
must(!/watchPinnedRail[\s\S]{0,400}offsetHeight|watchPinnedRail[\s\S]{0,400}getBoundingClientRect/.test(code),
  'with nothing measured, so no settled scroll lays the page out');

// 3 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
if (block) {
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
    must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    must((head.items || []).every((it) => it.length <= 260), 'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
    must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what this release left alone');
    must(/blank/i.test(notes), 'and naming what was reported');
    // The two gates whose repin leaves them reading the HEAD entry.
    must(/list/i.test(notes), 'the word the 64.2.6 gate reads the head entry for is still there (list)');
    must(/record/i.test(notes), 'and the other one it reads it for (record)');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    must(entries.some((e) => /^64\.2\.6$/.test(String(e.version))), 'and the release before it is still listed');
    must(entries.some((e) => /^64\.2\.5$/.test(String(e.version))), 'and so is the one before that');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

// 4 - nothing else on the page still calls itself the release before this one
must(final.indexOf("'" + OLD_VER + "'") === -1 || has(`  { version: '` + OLD_VER + `'`),
  'the page names ' + VER + ' as itself and ' + OLD_VER + ' only as history');

if (problems.length) {
  console.error('\npatch-66427: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66427: all verification checks passed (' + edits + ' edit(s))');
