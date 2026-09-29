#!/usr/bin/env node
/**
 * SideCut 70.0.7 - the player stops reserving the bottom of the screen twice.
 *
 * The user's words, verbatim, sent with a photo of a fresh install (no settings
 * touched, no Premium) beside a screenshot of the app as they know it:
 *
 *   "On download with no settings changed and no premium why is their a huge gap
 *    between the media player and tabs when look how it is over here."
 *
 * The gap is real and it is geometric, not cosmetic - and the tell is in their own
 * photo: the phone at the top of it is using the 3-BUTTON nav bar, where the one
 * that looks right is using gestures. That is the whole bug: a bottom inset.
 *
 * THE ARITHMETIC OF THE GAP (every number below is in the page as 70.0.6 shipped):
 *
 *   .action-strip   bottom:0, padding 6px top / 6px + SAFE bottom, pills 42px
 *                   -> its top edge is 54px + SAFE above the screen bottom
 *   #nowPlaying     bottom: 56px + SAFE        (the player sits ON the dock)
 *                   padding: 10px top / 10px + SAFE bottom
 *
 *   So the player's own padding contributes 10 + SAFE below its last row, the
 *   strip contributes 6 above its pills, and 2px is the difference between them:
 *   the visible space between the seek row and the dock is 18px + SAFE.
 *
 *   On a device that reports no inset (a browser tab, any WebView that is not
 *   edge to edge) that is the designed 18px, which is what the reference screenshot
 *   shows. Android 15 draws EVERY app edge to edge, so a Capacitor WebView there
 *   reports the real thing - about 48px behind a 3-button nav bar - and the same
 *   layout becomes 18px + 48px: a nav-bar-tall hole between the player and the
 *   dock. The inset was counted THREE times: the dock's own padding, the player's
 *   `bottom`, and the player's own padding. The first two are correct - the dock
 *   touches the screen edge, and `bottom` is what lifts the bar onto it - but the
 *   third is the leftover of the pre-70.0 shape, when #nowPlaying WAS the
 *   bottom-most surface and had to reserve that inset itself.
 *
 * THE FIX, and it is four declarations, not a redesign: the dock keeps the inset,
 * #nowPlaying's `bottom` keeps it, and the player's own padding stops carrying it.
 * Each of the four override rules restates the padding the app already had for
 * that case (10px default, 8px on a very narrow phone, 6px in landscape, 6px with
 * the compact now bar) so the only thing that changes anywhere is that the inset
 * is counted twice instead of three times - and on a device that reports 0 the
 * page renders exactly what it rendered before.
 *
 * WHY IT SURVIVED 70.0, 70.0.5 AND 70.0.6: the phone it was written and viewed on
 * reports no inset, and every layout number the release gates can see is identical
 * either way. It cannot be measured in this sandbox either - jsdom has no layout
 * engine - so this file asserts the CASCADE instead, in dev/test-705.mjs (source
 * order: the override is the last word on that property) and in
 * dev/studio-70-check.cjs against the page the app actually loads.
 *
 *   node dev/patch-707.mjs            # apply
 *   node dev/patch-707.mjs --check    # report only, change nothing
 *   node dev/patch-707.mjs --manifest # reseed the root manifest.json only
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

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.0.7';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 12:04 UTC = 8:04 AM EDT, the same day.
const STAMP = 'September 29, 2026 \u00b7 8:04 AM EDT';
const CACHE = 'sidecut-shell-v63.0.33';
const OLDCACHE = 'sidecut-shell-v63.0.32';
const TITLE = 'The player stops reserving the bottom of the screen twice, and the gap above the dock closes';

// Six notes, none with an apostrophe: a note is emitted into a single-quoted
// literal in the changelog, so a quote in one would have to be escaped.
const NOTES = [
  'The empty strip between the player and the dock is gone. The bar was reserving the bottom of the screen in its own padding as well as in its position, but the dock underneath it already reserves that space - so the last row of the player sat a whole nav-bar too high on any phone that reports one.',
  'That is what the bottom system inset is, and it is why the app looked right on one phone and left a hole on another: Android 15 draws every app edge to edge, and a 3-button nav bar is around 48px, while a browser tab or a device that is not edge to edge reports 0 and never showed the gap.',
  'No setting, theme or Premium was involved. A fresh install with nothing changed was the case that showed it.',
  'The player keeps the breathing room it was designed with - 10px under the seek row, 8px on a very narrow phone, 6px in landscape or with the compact now bar - on every device, because the padding no longer counts an inset that is already counted around it.',
  'The dock is untouched and still reserves the inset itself, since the dock is the surface that actually touches the bottom edge of the screen.',
  'Nothing else moved: the bar is still lifted onto the dock, on a device that reports no inset the page renders exactly as it did before, and every scrolling view still clears both.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

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

sub(html, 'APP_VERSION', "const APP_VERSION = '70.0.6';", "const APP_VERSION = '70.0.7';",
  { key: "const APP_VERSION = '70.0.7';" });

// The new head entry, in front of 70.0.6 - the array is newest first.
const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.0.7 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.0.6',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.0.6',",
  { key: "  { version: '70.0.7', date: '" });

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* --------------------------------------------------- the stylesheet we ship */
// The fix, in the stylesheet that is the source of truth for the dock block - the
// same file patch-70 spliced in, re-spliced below. The anchor is the pair of lines
// 70.0 shipped; the `key` is the first of the four rules that replace them.
sub(css, 'the player padding rule',
  '/* The player sits ON the dock, not under it. */\n' +
  '#nowPlaying{ bottom: calc(var(--sc-dock-h) + env(safe-area-inset-bottom)); }\n',
  '/* The player sits ON the dock, not under it. */\n' +
  '#nowPlaying{ bottom: calc(var(--sc-dock-h) + env(safe-area-inset-bottom)); }\n' +
  '/* ...and it must not reserve the same bottom inset a SECOND time in its own\n' +
  '   padding. #nowPlaying\'s padding was written when the player WAS the bottom-most\n' +
  '   surface, so it carried `+ env(safe-area-inset-bottom)` the way the dock still\n' +
  '   does. Once the dock landed under it (70.0) that inset was counted three times\n' +
  '   over - the dock\'s own padding, this bar\'s `bottom`, and this bar\'s padding - so\n' +
  '   the bar\'s last 10px of breathing room became 10px + the inset. Where the inset\n' +
  '   is 0 (any non-edge-to-edge WebView, and a browser tab) the design is exactly\n' +
  '   right and this changes nothing; where it is not 0 (Android 15 forces every app\n' +
  '   edge to edge, and a 3-button nav bar reports ~48px) the seek row sat a whole\n' +
  '   nav-bar-tall hole above the dock. The four rules below are the paddings the\n' +
  '   app already had, minus the inset, so the player keeps its 10px (8px on a very\n' +
  '   narrow phone, 6px in landscape or with the compact now bar) on every device. */\n' +
  '#nowPlaying{ padding-bottom: 10px; }\n' +
  'body.sandbox-compact-nowbar #nowPlaying{ padding-bottom: 6px; }\n' +
  '@media (max-width: 360px){ #nowPlaying{ padding-bottom: 8px; } }\n' +
  '@media (max-height: 500px) and (orientation: landscape){ #nowPlaying{ padding-bottom: 6px; } }\n',
  { key: '#nowPlaying{ padding-bottom: 10px; }' });

/* ------------------------------------------------- the gate that can see this */
// test-705 is the standing release gate (it drives test-70 and the rest), so the
// rule this release turns on is asserted where the dock rules already are. It
// cannot be a layout measurement - nothing in this repo has a layout engine - so
// what is asserted is the cascade itself: every player padding that still carries
// the inset is overridden by a later rule that does not, and the dock's still does.
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the inset rule',
  "  ok(has('--sc-dock-h: 56px'), 'the dock height token is untouched');",
  "  ok(has('--sc-dock-h: 56px'), 'the dock height token is untouched');\n" +
  '  // 70.0.7, the user\'s words: "why is their a huge gap between the media player and\n' +
  '  // tabs". The player is the MIDDLE surface now - the dock touches the screen edge,\n' +
  '  // and the bar\'s own `bottom` already counts the inset - so the bar\'s padding must\n' +
  '  // not count the same inset a third time. The inset is only visible on a device that\n' +
  '  // reports one (Android 15 is edge to edge; 3-button nav is ~48px), which is exactly\n' +
  '  // why this is asserted as a cascade and not as a picture.\n' +
  "  const padRules = (src.match(/#nowPlaying[^{}]*\\{[^}]*padding[^}]*\\}/g) || []);\n" +
  "  const envPads = padRules.filter((r) => /env\\(safe-area-inset-bottom\\)/.test(r));\n" +
  "  ok(envPads.length === 4, 'the four player paddings that counted the inset are still there (' + envPads.length + ')');\n" +
  "  ok(count('#nowPlaying{ padding-bottom: 10px; }') === 1, 'and the override that drops it ships once');\n" +
  "  ok(count('body.sandbox-compact-nowbar #nowPlaying{ padding-bottom: 6px; }') === 1,\n" +
  "     'the compact now bar keeps its 6px, without the inset');\n" +
  "  ok(has('@media (max-width: 360px){ #nowPlaying{ padding-bottom: 8px; } }'),\n" +
  "     'and the very narrow phone keeps its 8px');\n" +
  "  ok(has('@media (max-height: 500px) and (orientation: landscape){ #nowPlaying{ padding-bottom: 6px; } }'),\n" +
  "     'and the landscape bar keeps its 6px');\n" +
  "  ok(src.indexOf('#nowPlaying{ padding-bottom: 10px; }') > Math.max.apply(null, envPads.map((r) => src.indexOf(r))),\n" +
  "     'and it comes after every padding that counted it, so it is the last word');\n" +
  "  mustStillReserve(src, '.action-strip');\n" +
  "  ok(/#nowPlaying\\{ bottom: calc\\(var\\(--sc-dock-h\\) \\+ env\\(safe-area-inset-bottom\\)\\)/.test(src),\n" +
  "     'while the position that lifts the bar onto the dock still counts it');\n",
  { key: 'the override that drops it ships once' });

// The first cut of that block matched the page's CSS as raw text, and the design
// note this release adds names `#nowPlaying` and the inset inside a comment - so the
// scanner read the note as a rule and found five paddings where there are four. A
// comment is not a rule: strip them first, in both halves of the check.
sub(t705, 'test-705 strips comments first',
  '  const padRules = (src.match(/#nowPlaying[^{}]*\\{[^}]*padding[^}]*\\}/g) || []);\n' +
  '  const envPads = padRules.filter((r) => /env\\(safe-area-inset-bottom\\)/.test(r));',
  '  // A rule is a rule: comments are stripped before anything is matched, because\n' +
  '  // this file\'s own design note names this selector and this inset on purpose.\n' +
  "  const cssOnly = src.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');\n" +
  '  const padRules = (cssOnly.match(/#nowPlaying[^{}]*\\{[^}]*padding[^}]*\\}/g) || []);\n' +
  '  const envPads = padRules.filter((r) => /env\\(safe-area-inset-bottom\\)/.test(r));',
  { key: 'const cssOnly = src.replace' });
sub(t705, 'test-705 reads the stripped CSS',
  "  ok(src.indexOf('#nowPlaying{ padding-bottom: 10px; }') > Math.max.apply(null, envPads.map((r) => src.indexOf(r))),",
  "  ok(cssOnly.indexOf('#nowPlaying{ padding-bottom: 10px; }') > Math.max.apply(null, envPads.map((r) => cssOnly.indexOf(r))),",
  { key: "envPads.map((r) => cssOnly.indexOf(r))" });

sub(t705, 'test-705 the dock helper',
  'const VER = \'70.0.5\';',
  'const VER = \'70.0.5\';\n' +
  '\n' +
  '// 70.0.7. One surface has to reserve the bottom inset: the one that touches the\n' +
  '// bottom edge of the screen. That is the dock, and this is the half of that rule\n' +
  '// that a page-wide text check cannot accidentally satisfy with the wrong element.\n' +
  'function mustStillReserve(page, selector){\n' +
  '  const hit = page.match(new RegExp(selector.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\\\$&") +\n' +
  '    "\\\\{\\\\s*[^}]*padding:[^}]*env\\\\(safe-area-inset-bottom\\\\)[^}]*\\\\}"));\n' +
  '  ok(!!hit, "and " + selector + " is the surface that reserves the inset");\n' +
  '}\n',
  { key: 'the surface that reserves the inset' });

/* --------------------------------------------------- the real-app probe's half */
const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
sub(studio, 'studio-70-check the inset rule',
  "    ok(!!npRule, 'and the player is lifted above it');",
  "    ok(!!npRule, 'and the player is lifted above it');\n" +
  '\n' +
  '    // 70.0.7, the user\'s words: "why is their a huge gap between the media player and\n' +
  '    // tabs". The bar is the middle surface now, so its own padding must not reserve the\n' +
  '    // bottom inset the dock already reserves and `bottom` already counts - on a phone\n' +
  '    // that reports a real inset (Android 15 edge to edge, 3-button nav) that stray\n' +
  '    // inset was the gap. Asserted against the page the app loads, not a description.\n' +
  '    const npPads = (html.match(/#nowPlaying[^{}]*\\{[^}]*padding[^}]*\\}/g) || [])\n' +
  '      .filter((r) => /env\\(safe-area-inset-bottom\\)/.test(r));\n' +
  "    ok(npPads.length === 4, 'the player paddings that counted the inset are all still in the page');\n" +
  "    ok(npPads.every((r) => html.indexOf(r) < html.indexOf('#nowPlaying{ padding-bottom: 10px; }')),\n" +
  "      'and a later rule overrides every one of them, so the bar does not reserve it twice');\n" +
  "    ok(/\\.action-strip\\{\\s*position:\\s*fixed[^}]*padding:\\s*6px 10px calc\\(6px \\+ env\\(safe-area-inset-bottom\\)\\)/.test(html),\n" +
  "      'while the dock, which does touch the bottom edge, still reserves it');\n",
  { key: 'so the bar does not reserve it twice' });

// Same repair in the probe: it reads the page, and the page carries the note.
sub(studio, 'studio-70-check strips comments first',
  '    const npPads = (html.match(/#nowPlaying[^{}]*\\{[^}]*padding[^}]*\\}/g) || [])\n' +
  '      .filter((r) => /env\\(safe-area-inset-bottom\\)/.test(r));',
  "    const cssOnly = html.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '');\n" +
  '    const npPads = (cssOnly.match(/#nowPlaying[^{}]*\\{[^}]*padding[^}]*\\}/g) || [])\n' +
  '      .filter((r) => /env\\(safe-area-inset-bottom\\)/.test(r));',
  { key: 'const cssOnly = html.replace' });
sub(studio, 'studio-70-check reads the stripped page',
  "    ok(npPads.every((r) => html.indexOf(r) < html.indexOf('#nowPlaying{ padding-bottom: 10px; }')),",
  "    ok(npPads.every((r) => cssOnly.indexOf(r) < cssOnly.indexOf('#nowPlaying{ padding-bottom: 10px; }')),",
  { key: "npPads.every((r) => cssOnly.indexOf(r)" });

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

  must(count(page, "const APP_VERSION = '70.0.7';") === 1, 'the version is not 70.0.7 exactly once');
  must(count(page, "version: '70.0.7'") === 1, 'the 70.0.7 changelog entry is missing');
  must(count(page, "version: '70.0.6'") === 1, 'the 70.0.6 entry left the array');
  must(count(page, "version: '70.0.5'") === 1, 'the 70.0.5 entry left the array');
  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  // The rule of this release, on the page: the override is spliced, the dock kept
  // its own inset, and the bar's position kept its.
  must(count(page, '#nowPlaying{ padding-bottom: 10px; }') === 1, 'the padding override is not on the page');
  must(count(page, 'body.sandbox-compact-nowbar #nowPlaying{ padding-bottom: 6px; }') === 1,
    'the compact override is not on the page');
  must(/\.action-strip\{\s*position:\s*fixed[^}]*padding:\s*6px 10px calc\(6px \+ env\(safe-area-inset-bottom\)\)/.test(page),
    'the dock stopped reserving the inset it is meant to own');
  must(/#nowPlaying\{ bottom: calc\(var\(--sc-dock-h\) \+ env\(safe-area-inset-bottom\)\)/.test(page),
    'the player stopped being lifted onto the dock by the inset too');
  must(count(css.text, '#nowPlaying{ padding-bottom: 10px; }') === 1 &&
    /\.action-strip\{\s*position: fixed[^}]*env\(safe-area-inset-bottom\)/.test(css.text),
    'dev/sc70-styles.css is not the source this patch re-splices');
  must(count(css.text, 'padding-bottom: calc(10px + env(safe-area-inset-bottom))') === 0,
    'a player padding that counts the inset survived in the stylesheet');

  must(count(t705.text, 'the override that drops it ships once') === 1, 'test-705 does not assert the rule');
  must(count(studio.text, 'so the bar does not reserve it twice') === 1, 'the real-app probe does not assert the rule');
  must(count(page, 'const cssOnly = src.replace') === 0 && count(page, 'const cssOnly = html.replace') === 0,
    'a note about stripping comments leaked into the page');
  must(count(t705.text, 'const cssOnly = src.replace') === 1 && count(studio.text, 'const cssOnly = html.replace') === 1,
    'a half of the check still reads the CSS as raw text');
}

if(problems.length){
  console.error('patch-707: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-707: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-707: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [CSS, css.text], [SW, sw.text], [TEST705, t705.text], [STUDIO, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-707: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-707: next `node dev/repin-707.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
