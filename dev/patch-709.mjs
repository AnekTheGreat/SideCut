#!/usr/bin/env node
/**
 * SideCut 70.0.9 - the player stops guessing how tall the dock is.
 *
 * The user's words, verbatim, sent with a screenshot of an unfolded foldable:
 *
 *   "This is not how it should look on a foldable phone there is way to much of a
 *    gap"
 *
 * The same complaint as 70.0.7 (which has never been published - nothing has been
 * pushed since 70.0.6, so the device that reported this is still running the build
 * with the bug in it), but worse, and the reason it is worse on a foldable is in
 * the arithmetic:
 *
 *   .action-strip   = 6px + 42px pills + calc(6px + SAFE)   -> 54px + SAFE, and it
 *                     is the surface that touches the bottom edge, so the SAFE is
 *                     correct THERE.
 *   #nowPlaying     = bottom: calc(56px + SAFE)             -> lifted onto the dock
 *                     (the 56 is the 54 above, rounded up: a guess).
 *
 *   Before 70.0.7 the player ALSO carried `calc(10px + SAFE)` of its own bottom
 *   padding, written when the player was the bottom-most surface and had to reserve
 *   that inset itself. So the space between its last row and the dock was
 *
 *       10px + SAFE   (the player's own padding)
 *
 *   and everything after the seek row was the player's own background: a tall empty
 *   panel, not a hole in the page - which is why it reads as one big dark strip.
 *   On a phone that inset is ~48px (Android 15 draws every app edge to edge, and a
 *   3-button nav bar reports about that). On an unfolded foldable the bottom system
 *   area is bigger again, so the same 10px became 10px + a much larger number. Same
 *   bug, bigger device, worse result.
 *
 * 70.0.7 removed that padding (and it is in this tree) - so this release fixes the
 * OTHER half, which is the half a foldable exposes: THE 56px GUESS ITSELF.
 *
 *   --sc-dock-h: 56px is not the dock's height anywhere except a phone with no
 *   inset. The >=768 width breakpoint raises the pill to 44px, the >=1024 one pads
 *   it differently, an unfolded foldable reports a bottom inset no phone has, the
 *   sandbox compact bar changes it, and the user's own "now bar size" scales the
 *   player on top of all of it. The player is `bottom: calc(--sc-dock-h + inset)`,
 *   so on the devices where that guess is wrong the player does not float into the
 *   dock's padding: it floats ABOVE it, and the difference is a strip of nothing
 *   between the seek row and the dock - exactly what the screenshot shows.
 *
 * So the dock is measured - one getBoundingClientRect of the element that is
 * actually on the screen - and the player is lifted by exactly that, with the old
 * arithmetic kept as the fallback so a hidden dock or an unmeasurable one (jsdom
 * measures everything as 0) behaves exactly as it does today.
 *
 *   node dev/patch-709.mjs            # apply
 *   node dev/patch-709.mjs --check    # report only, change nothing
 *   node dev/patch-709.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const CSS = path.join(ROOT, 'dev', 'sc70-styles.css');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');
const TEST662 = path.join(ROOT, 'dev', 'test-662.mjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.0.9';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 19:41 UTC = 3:41 PM EDT, the same day.
// A stamp in the FUTURE is a gate failure (test-6643: "not one of them in the
// future"), so this is anchored to the clock the release was actually cut at.
const STAMP = 'September 29, 2026 \u00b7 3:41 PM EDT';
const CACHE = 'sidecut-shell-v63.0.35';
const OLDCACHE = 'sidecut-shell-v63.0.34';
const TITLE = 'The player stops guessing how tall the dock is, so the strip above the dock closes on a foldable too';

// Six notes, none with an apostrophe: a note is emitted into a single-quoted
// literal in the changelog, so a quote in one would have to be escaped.
const NOTES = [
  'The strip of nothing between the player and the dock is gone on an unfolded foldable. The player reserved the bottom system inset inside its own padding while the dock under it reserves that space as well, so the last row of the player sat that far too high - and the bottom inset on a foldable is a much bigger number than on a phone, which is why the same bug looked far worse there.',
  'Only the surface that touches the bottom edge of the screen reserves that space, the way it should have from the start: the dock. The player keeps the breathing room it was designed with - 10px under the seek row, 8px on a very narrow phone, 6px in landscape or with the compact bar - on every device.',
  'The player also stops trusting a written-down number for how tall the dock is. It was 56px, which is right for a phone with no inset and wrong nearly everywhere else, and a foldable is where that shows: an unfolded screen changes the pill size, the dock padding and the bottom inset all at once.',
  'So the dock is now measured as it actually is on the screen in use, and the player is lifted by exactly that - it ends where the dock begins, whatever the dock comes to on that device. The measurement is taken on launch, on a rotation or fold, and whenever the dock changes size.',
  'Nothing else moved: the same dock, the same tabs, the same seek row and the same player. On a device that reports no bottom inset at all, the page renders as it always did.',
  'If the dock cannot be measured - it is hidden, or the platform reports nothing for it - the app falls back to the previous arithmetic rather than guessing, so the worst case is exactly what shipped before.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

// A correction that must NOT fail when there is nothing to correct, which is why
// it is not sub(): index.html is far too large to be edited by hand and far too
// load-bearing to be reverted, because it carries every release before this one.
function heal(h, label, from, to){
  const n = count(h.text, from);
  if(n === 0) return;
  h.text = h.text.split(from).join(to);
  applied++;
  console.log('patch-709: healed ' + label + ' (' + n + ')');
}

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

/* --------------------------------------------------------------------- page */
const html = holder(fs.readFileSync(IDX, 'utf8'));
const mod = holder(fs.readFileSync(MOD, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const css = holder(fs.readFileSync(CSS, 'utf8'));

sub(html, 'APP_VERSION', "const APP_VERSION = '70.0.8';", "const APP_VERSION = '70.0.9';",
  { key: "const APP_VERSION = '70.0.9';" });

// The new head entry, in front of 70.0.8 - the array is newest first.
const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.0.9 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.0.8',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.0.8',",
  { key: "  { version: '70.0.9', date: '" });

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

// The stamp, healed in place for the same reason the 70.0.8 note was: the page in
// this tree already carries the wording this release first used, and index.html is
// too large to edit by hand and too load-bearing to revert. On a tree built from
// the NOTES above there is nothing to heal.
heal(html, 'the 70.0.9 changelog stamp',
  "date: 'September 29, 2026 \u00b7 4:41 PM EDT'",
  "date: 'September 29, 2026 \u00b7 3:41 PM EDT'");

/* ======================================================= the stylesheet we ship */
// The measured lift, right under the guessed one so the two read together. The
// fallback inside the var() is not decoration: if the custom property were ever
// missing (a stale service worker serving a half-updated file is the realistic
// way that happens) `bottom` would be invalid at computed-value time and the
// player would fall back to its static position - so the fallback is the same
// arithmetic that is in place today, spelled out again.
sub(css, 'the measured lift',
  '#nowPlaying{ bottom: calc(var(--sc-dock-h) + env(safe-area-inset-bottom)); }\n',
  '#nowPlaying{ bottom: calc(var(--sc-dock-h) + env(safe-area-inset-bottom)); }\n' +
  '/* 70.0.9 - "there is way to much of a gap" on a foldable. 56px is a GUESS at the\n' +
  '   dock height: it is 42px pills plus 6px of padding either side, on a phone, with\n' +
  '   no bottom inset. The >=768 breakpoint raises that pill to 44px, an unfolded\n' +
  '   foldable reports a bottom inset no phone has, the sandbox compact bar changes it\n' +
  '   again - and the player is lifted by the guess plus the inset, so wherever the\n' +
  '   guess is wrong the player floats above the dock and the difference is a strip of\n' +
  '   nothing between the seek row and the dock. The dock is measured instead\n' +
  '   (dev/sc70-module.js, measureDock) and this is the last word on the player\n' +
  '   position when it can be. The var() fallback is the arithmetic above, so a\n' +
  '   missing measurement is exactly the behaviour that shipped before. */\n' +
  'html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real, calc(var(--sc-dock-h) + env(safe-area-inset-bottom))); }\n',
  { key: 'html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real' });

/* ================================================= the Studio module (the probe) */
sub(mod, 'the dock measurement',
  '  function boot(){\n    buildStudioView();',
  '  /* --------------------------------------------------------------------------\n' +
  '     13c. HOW TALL IS THE DOCK, REALLY\n' +
  '     -------------------------------------------------------------------------- */\n' +
  '  // The player is `bottom: calc(--sc-dock-h + env(safe-area-inset-bottom))`, and\n' +
  '  // --sc-dock-h is a written-down 56px. That is the right number for a phone with\n' +
  '  // no bottom inset and the wrong one nearly everywhere else - the >=768 width\n' +
  '  // breakpoint raises the pill to 44px, an unfolded foldable reports a bottom inset\n' +
  '  // no phone has, the sandbox compact bar changes it again - so on those devices the\n' +
  '  // player floats above the dock and the difference is a strip of nothing between\n' +
  '  // the seek row and the dock. This measures the dock that is actually on the screen\n' +
  '  // and hands the player that number, so its bottom edge lands where the dock begins\n' +
  '  // on any device, at any width, at any inset. One getBoundingClientRect; nothing is\n' +
  '  // written unless the measurement is a believable dock.\n' +
  '  var DOCK_MIN = 30, DOCK_MAX = 300;\n' +
  '  function measureDock(){\n' +
  '    try{\n' +
  "      var strip = document.querySelector('.action-strip');\n" +
  '      var root = document.documentElement;\n' +
  '      if(!strip || !root) return false;\n' +
  '      var h = Math.round(strip.getBoundingClientRect().height || 0);\n' +
  '      // Hidden, not laid out, or four hundred pixels tall: not a dock. The\n' +
  '      // measurement is dropped and the stylesheet own arithmetic takes over.\n' +
  '      if(!h || h < DOCK_MIN || h > DOCK_MAX){\n' +
  "        root.classList.remove('sc-dock-measured');\n" +
  '        return false;\n' +
  '      }\n' +
  "      root.style.setProperty('--sc-dock-real', h + 'px');\n" +
  "      root.classList.add('sc-dock-measured');\n" +
  '      return true;\n' +
  '    }catch(e){ return false; }\n' +
  '  }\n' +
  '  function watchDock(){\n' +
  '    measureDock();\n' +
  '    try{\n' +
  "      var strip = document.querySelector('.action-strip');\n" +
  '      if(window.ResizeObserver && strip) new ResizeObserver(measureDock).observe(strip);\n' +
  '    }catch(_eRo){}\n' +
  "    window.addEventListener('resize', measureDock);\n" +
  "    window.addEventListener('orientationchange', measureDock);\n" +
  '    // The first paint is not trustworthy - the fonts, the theme and the dock own\n' +
  '    // transition all settle after it - so it is measured again once the page has.\n' +
  '    setTimeout(measureDock, 250);\n' +
  '    setTimeout(measureDock, 1500);\n' +
  '  }\n' +
  '\n' +
  '  function boot(){\n    buildStudioView();',
  { key: 'function measureDock(){' });

sub(mod, 'the boot hook', '    wireSwipe();\n    wireAppWatch();', '    wireSwipe();\n    watchDock();\n    wireAppWatch();',
  { key: 'watchDock();\n    wireAppWatch();' });

sub(mod, 'the dock tools for the gates',
  '    cropCurrent: cropCurrent,',
  '    measureDock: measureDock,\n    watchDock: watchDock,\n    cropCurrent: cropCurrent,',
  { key: 'watchDock: watchDock,' });

/* ============================================ the gate that reads the notes */
// test-662 asserts that the head entry describes a real release by looking for the
// word "studio" in it - which was true of 70.0, 70.0.5 and 70.0.8 and false of
// 70.0.9, a release about the player and the dock. The rule underneath it is "the
// notes name a surface this app actually has", so it is widened to the three
// surfaces the last releases touched rather than dropped, or satisfied by writing
// the word studio into notes about the dock.
const t662 = holder(fs.readFileSync(TEST662, 'utf8'));
sub(t662, 'test-662 the notes name a real surface',
  "    ok(/studio/i.test(head.items.join('\\n')), 'and it describes what this release did');",
  "    // 70.0.9 is about the player and the dock, and the rule underneath the word\n" +
  "    // is that the notes name a surface this app really has - not one in particular.\n" +
  "    ok(/(studio|player|dock)/i.test(head.items.join('\\n')),\n" +
  "      'and it describes what this release did');",
  { key: 'a surface this app really has' });

/* ================================================================== the gate */
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the 70.0.9 rules',
  "  mustStillReserve(src, '.action-strip');",
  "  mustStillReserve(src, '.action-strip');\n" +
  '  // 70.0.9. The lift is measured, not guessed - and the fallback is the guess.\n' +
  "  ok(count('html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real') === 1,\n" +
  "     'the measured lift is not the last word on the player position');\n" +
  "  ok(has('var(--sc-dock-real, calc(var(--sc-dock-h) + env(safe-area-inset-bottom)))'),\n" +
  "     'and it falls back to the guess rather than leaving the player unpositioned');\n" +
  "  ok(countMod('function measureDock(){') === 1, 'the dock is measured');\n" +
  "  ok(countMod('if(!h || h < DOCK_MIN || h > DOCK_MAX){') === 1, 'and a nonsense height is refused');\n" +
  "  ok(countMod('getBoundingClientRect().height') === 1, 'by reading the dock that is on the screen');\n" +
  "  ok(countMod(\"root.classList.add('sc-dock-measured')\") === 1 &&\n" +
  "     countMod(\"root.classList.remove('sc-dock-measured')\") === 1,\n" +
  "     'and the player is switched to it, or back off it, in one place');\n" +
  "  ok(countMod('watchDock();') === 1, 'and the measurement is watched (rotation, resize, the dock itself)');",
  { key: 'the measured lift is not the last word on the player position' });

const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
sub(studio, 'studio-70-check the 70.0.9 rules',
  "  console.log('[12] the page still holds together');",
  "  console.log('[11b] the player is lifted by the dock that is really there');\n" +
  '  {\n' +
  '    // 70.0.9 - "there is way to much of a gap" on a foldable. Driven with a fake\n' +
  '    // dock height, because jsdom measures every element as 0: the mechanism is the\n' +
  '    // class plus the custom property, and the fallback has to survive a dock that\n' +
  '    // cannot be measured.\n' +
  "    const strip = doc.querySelector('.action-strip');\n" +
  "    ok(!!strip, 'the dock is in the page');\n" +
  "    ok(win.SC70.measureDock() === false, 'an unmeasurable dock (0 tall) leaves the guess alone');\n" +
  "    ok(!doc.documentElement.classList.contains('sc-dock-measured'), 'and the measured lift stays off');\n" +
  '    const real = strip.getBoundingClientRect;\n' +
  '    strip.getBoundingClientRect = () => ({ height: 132, width: 400, top: 0, left: 0, right: 400, bottom: 132 });\n' +
  "    ok(win.SC70.measureDock() === true, 'a real dock height is taken');\n" +
  "    ok(doc.documentElement.classList.contains('sc-dock-measured'), 'and the player is switched to it');\n" +
  "    ok(doc.documentElement.style.getPropertyValue('--sc-dock-real') === '132px',\n" +
  "      'with the measured height (' + doc.documentElement.style.getPropertyValue('--sc-dock-real') + ')');\n" +
  '    strip.getBoundingClientRect = () => ({ height: 4000, width: 400, top: 0, left: 0, right: 400, bottom: 4000 });\n' +
  "    ok(win.SC70.measureDock() === false, 'and a 4000px dock is refused as nonsense');\n" +
  "    ok(!doc.documentElement.classList.contains('sc-dock-measured'), 'falling back to the arithmetic');\n" +
  '    strip.getBoundingClientRect = real;\n' +
  '  }\n' +
  '\n' +
  "  console.log('[12] the page still holds together');",
  { key: "console.log('[11b] the player is lifted by the dock that is really there');" });

/* --------------------------------------------------------- re-splice both in */
{
  const openTag = '<script id="sc-studio-70">';
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = openTag + '\n' + mod.text + '</script>\n';
  if(blockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(blockRe, wrapped);
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }

  const cssBlockRe = /\n\/\* =+\n   SideCut 70\.0 -[\s\S]*?<\/style>/;
  if(cssBlockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(cssBlockRe, '\n' + css.text + '</style>');
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the SideCut 70.0 stylesheet block is missing');
  }
}

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  must(count(page, "const APP_VERSION = '70.0.9';") === 1, 'the version is not 70.0.9 exactly once');
  must(count(page, "version: '70.0.9'") === 1, 'the 70.0.9 changelog entry is missing');
  must(count(page, "date: 'September 29, 2026 \u00b7 3:41 PM EDT'") === 1,
    'the 70.0.9 stamp is not the one this release was cut at');
  must(count(page, "version: '70.0.8'") === 1, 'the 70.0.8 entry left the array');
  must(count(page, "version: '70.0.7'") === 1, 'the 70.0.7 entry left the array');
  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  // The measured lift, and the arithmetic it must never replace outright.
  must(count(page, 'html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real') === 1,
    'the measured lift is not on the page');
  must(count(page, 'var(--sc-dock-real, calc(var(--sc-dock-h) + env(safe-area-inset-bottom)))') === 1,
    'the measured lift does not fall back to the guess');
  must(count(page, '#nowPlaying{ bottom: calc(var(--sc-dock-h) + env(safe-area-inset-bottom)); }') === 1,
    'the guessed lift was replaced instead of staying as the fallback');
  must(count(page, 'function measureDock(){') === 1, 'the measurement is missing');
  must(count(page, 'DOCK_MIN = 30, DOCK_MAX = 300') === 1, 'and the believable range with it');
  must(count(page, 'watchDock();') === 1, 'and nothing watches it');

  // And the 70.0.7 rule this release leans on has to still be here: the player's
  // own padding must not reserve the inset a second time.
  must(count(page, '#nowPlaying{ padding-bottom: 10px; }') === 1,
    'the player is reserving the bottom inset in its padding again');
  must(count(page, 'padding-bottom: calc(10px + env(safe-area-inset-bottom))') === 0,
    'a player padding that counts the inset is back');
  mustStillReserve(page, '.action-strip');

  must(count(t705.text, 'the measured lift is not the last word on the player position') === 1,
    'test-705 does not assert the release');
  must(count(studio.text, "console.log('[11b] the player is lifted by the dock that is really there');") === 1,
    'the real-app probe does not assert the measurement');
  must(count(t662.text, 'a surface this app really has') === 1,
    'test-662 still insists every release is about Studio');

  must(count(css.text, 'html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real') === 1,
    'dev/sc70-styles.css is not the source this patch re-splices');
  must(count(mod.text, 'function measureDock(){') === 1, 'dev/sc70-module.js is not the source this patch re-splices');
}

// The helper test-705 uses, declared here so this file's own checks can use it too.
function mustStillReserve(page, selector){
  const hit = page.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') +
    '\\{\\s*[^}]*padding:[^}]*env\\(safe-area-inset-bottom\\)[^}]*\\}'));
  if(!hit) problems.push('and ' + selector + ' stopped being the surface that reserves the inset');
}

if(problems.length){
  console.error('patch-709: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-709: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-709: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [MOD, mod.text], [CSS, css.text], [SW, sw.text], [TEST705, t705.text], [STUDIO, studio.text], [TEST662, t662.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-709: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-709: next `node dev/repin-709.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
