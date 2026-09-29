#!/usr/bin/env node
/**
 * SideCut 70.1.1 - the Studio tab says you are in it, and the badge wall stops
 * being stale.
 *
 * Two reports, both about the same screen:
 *
 *   "Studio tab don't highlight like the other tabs do when you click on them"
 *   "fix the badges not working when you reach the goal"
 *
 * THE TAB. `navigate()` has always marked the current pill -
 * `$('studioBtn').classList.toggle('active', isStudio)` - but the rule that
 * PAINTS a lit tab never learned about Studio:
 *
 *     #discoverBtn.active, #homeBtn.active{ background: var(--coral); ... }
 *
 * Home and Discover are in that list, Library lights its own two halves, and
 * Studio had no rule at all - so Studio was the one tab that never showed which
 * view you were in, while still carrying the class that said it. One selector.
 *
 * THE WALL. The badge grid is drawn by `renderStudio()`, which is expensive (it
 * walks the whole library for the stats behind 201 badges), so it is drawn when
 * the view is built and then on `visibilitychange`. Nothing redrew it when the
 * count actually changed: `checkAchievements()` recorded a badge, saved it,
 * toasted it, granted any reward - and left the screen alone. So a badge that
 * reached its goal showed a lit tile on the NEXT paint and nothing on the wall
 * the user was looking at, and opening Studio did not repaint either (tapping a
 * dock tab is not a visibility change). That is "the badges not working when you
 * reach the goal": the state was right, the picture was old.
 *
 * The fix is deliberately narrow, because the reason the grid was not redrawn on
 * every counter is a good one and stays: the wall is repainted when a badge
 * actually unlocks and the Studio view is on screen, and opening Studio redraws
 * it. No badge changed its target, no counter changed what it counts, and
 * nothing was taken away.
 *
 *   node dev/patch-7011.mjs            # apply
 *   node dev/patch-7011.mjs --check    # report only, change nothing
 *   node dev/patch-7011.mjs --manifest # reseed the root manifest.json only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const MOD = path.join(ROOT, 'dev', 'sc70-module.js');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const MANIFEST = process.argv.includes('--manifest');
const VERSION = '70.1.1';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// Built at 2026-09-29 21:11 UTC = 5:11 PM EDT, the same day. A stamp in the
// FUTURE is a gate failure (test-6643: "not one of them in the future").
const STAMP = 'September 29, 2026 \u00b7 5:11 PM EDT';
const CACHE = 'sidecut-shell-v63.0.37';
const OLDCACHE = 'sidecut-shell-v63.0.36';
const TITLE = 'Studio lights up in the dock like the tab it is, and the badge wall stops showing a count from the last time it was painted';

// Six notes, none with an apostrophe (a note is emitted into a single-quoted
// literal) and none with a downloader term or the words "play build", "play
// version" or "play install" - test-662 and test-6139 both refuse those.
const NOTES = [
  'Studio lights up in the dock when you are in it. The app was already marking the Studio pill as the current tab, the way it does for Home and Discover, but the rule that paints a lit tab only ever listed those two - so Studio was the one tab that never said which view you were looking at.',
  'The badge wall is redrawn when it changes. It was only drawn when the screen was built and when the app came back from the background, so a badge you had already earned could be missing from the wall in front of you, with the header, the ring and the tile all still showing the count from an older paint.',
  'That is what made a badge look like it did not work when you reached its goal: the badge was earned, saved and celebrated, and the wall you were looking at was simply a picture of an earlier moment.',
  'Opening Studio redraws the wall now, and a badge that reaches its goal while Studio is on the screen repaints it in place - the count, the ring and the tile move as the last play lands instead of after a trip to another tab.',
  'The wall is still only redrawn when something has actually changed, because walking the library to draw two hundred badges is real work and it is not done on every counter that moves.',
  'Nothing else moved. No badge changed its target, no counter changed what it counts, and nothing was taken away - this is the wall saying what it already knew about you.',
];

const problems = [];
let applied = 0, already = 0;

const count = (hay, needle) => hay.split(needle).length - 1;

function holder(text){ return { text: text }; }

// A correction that must NOT fail when there is nothing to correct, for the same
// reason patch-708 through patch-7011 have one: index.html is far too large to
// edit by hand and far too load-bearing to revert.
function heal(h, label, from, to){
  const n = count(h.text, from);
  if(n === 0) return;
  h.text = h.text.split(from).join(to);
  applied++;
  console.log('patch-7011: healed ' + label + ' (' + n + ')');
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

const block = (lines) => lines.join('\n') + '\n';

/* --------------------------------------------------------------------- page */
const html = holder(fs.readFileSync(IDX, 'utf8'));
const mod = holder(fs.readFileSync(MOD, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

sub(html, 'APP_VERSION', "const APP_VERSION = '70.1';", "const APP_VERSION = '70.1.1';",
  { key: "const APP_VERSION = '70.1.1';" });

const ENTRY =
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',").join('\n') + '\n' +
  '  ] },\n';
sub(html, 'the 70.1.1 changelog entry',
  "  const CHANGELOG = [\n  { version: '70.1',",
  '  const CHANGELOG = [\n' + ENTRY + "  { version: '70.1',",
  { key: "  { version: '70.1.1', date: '" });

sub(sw, 'shell cache', "const CACHE_NAME = '" + OLDCACHE + "';", "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ----------------------------------------------------------------- the tab */
// The lit-pill rule, with Studio in it. Library is not in the list and does not
// want to be: it lights its two halves instead (active-half), which is the thing
// that says which half of the library you are in.
sub(html, 'the lit-tab rule',
  block([
    "  /* The active nav pill lights up (solid accent) so it's clear which view you're in \u2014",
    '     same affordance as a selected tab. Home/Playlists/Discover all use it. */',
    '  #discoverBtn.active, #homeBtn.active{ background: var(--coral); color:#161616; border-color:var(--coral); }',
  ]),
  block([
    "  /* The active nav pill lights up (solid accent) so it's clear which view you're in \u2014",
    '     same affordance as a selected tab. Home, Discover and Studio all use it.',
    '     Library is deliberately not here: it lights its own two halves instead',
    '     (active-half), which is what says WHICH half of the library you are in.',
    '     70.1.1 - "Studio tab dont highlight like the other tabs do": navigate() had',
    '     always marked the Studio pill as current, and this rule simply never',
    '     listed it, so it was the one tab that never showed it. */',
    '  #discoverBtn.active, #homeBtn.active, #studioBtn.active{ background: var(--coral); color:#161616; border-color:var(--coral); }',
  ]),
  { key: '#studioBtn.active{ background: var(--coral);' });

/* ------------------------------------------------------------- the badge wall */
sub(mod, 'the wall repaint helper',
  '  function checkAchievements(silent){',
  block([
    '  // Drawing the wall walks the whole library (201 badges read real stats), so',
    '  // it is NOT redrawn on every counter that moves - that was a deliberate',
    '  // choice and it stays. What it must never be is what the user is looking at',
    '  // with an old number on it, so this is called from the two places where the',
    '  // picture can go stale: a badge unlocking, and the view being opened.',
    '  function badgeRepaintIfVisible(){',
    '    try{',
    '      var host = $(\'studioView\');',
    '      if(host && host.classList.contains(\'active\')) renderStudio();',
    '    }catch(_e){ }',
    '  }',
    '',
    '  function checkAchievements(silent){',
  ]).replace(/\n$/, ''),
  { key: 'function badgeRepaintIfVisible(){' });

sub(mod, 'the repaint on a fresh badge',
  block([
    '    // See the note above the reward table: Premium follows the count, so it is',
    '    // granted on every evaluation of it, not only when a badge unlocks.',
    '    grantRewards(!!silent);',
  ]),
  block([
    '    // A badge that just unlocked has to appear on the wall the user is looking',
    '    // at. Recording it and celebrating it while the grid still shows the count',
    '    // and the tile from an earlier paint is the bug this release is about: the',
    '    // state was right and the picture was old.',
    '    if(fresh.length) badgeRepaintIfVisible();',
    '    // See the note above the reward table: Premium follows the count, so it is',
    '    // granted on every evaluation of it, not only when a badge unlocks.',
    '    grantRewards(!!silent);',
  ]),
  { key: 'if(fresh.length) badgeRepaintIfVisible();' });

sub(mod, 'the repaint when Studio opens',
  block([
    '      // Those controls all move badges, so the check runs on the next turn of the',
    '      // loop rather than inside the click that caused it.',
    '      setTimeout(function(){ checkAchievements(true); }, 60);',
  ]),
  block([
    '      // Opening Studio is when the wall has to be right: tapping a dock tab is',
    '      // not a visibility change, so nothing else would redraw a grid that was',
    '      // last painted before any of this was earned.',
    '      if(el.closest(\'#studioBtn\')) setTimeout(function(){ renderStudio(); }, 80);',
    '      // Those controls all move badges, so the check runs on the next turn of the',
    '      // loop rather than inside the click that caused it.',
    '      setTimeout(function(){ checkAchievements(true); }, 60);',
  ]),
  { key: "el.closest('#studioBtn')" });

/* --------------------------------------------------------- re-splice it in */
{
  const blockRe = /<script id="sc-studio-70">[\s\S]*?<\/script>\n/;
  const wrapped = '<script id="sc-studio-70">\n' + mod.text + '</script>\n';
  if(blockRe.test(html.text)){
    const before = html.text;
    html.text = html.text.replace(blockRe, wrapped);
    if(html.text === before) already++; else applied++;
  } else {
    problems.push('the sc-studio-70 script block is missing');
  }
}

/* ================================================================== the gate */
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
sub(t705, 'test-705 the 70.1.1 rules',
  "  mustStillReserve(src, '.action-strip');",
  "  mustStillReserve(src, '.action-strip');\n" +
  '  // 70.1.1. The tab you are on says so, and the wall is never a picture of an\n' +
  '  // earlier moment than the badges it describes.\n' +
  "  ok(count('#discoverBtn.active, #homeBtn.active, #studioBtn.active{ background: var(--coral);') === 1,\n" +
  "     'the Studio tab is not lit up like the other tabs');\n" +
  "  ok(countMod('function badgeRepaintIfVisible(){') === 1 &&\n" +
  "     countMod('if(fresh.length) badgeRepaintIfVisible();') === 1,\n" +
  "     'a badge that reaches its goal leaves the wall stale');\n" +
  "  ok(countMod(\"el.closest('#studioBtn')\") === 1,\n" +
  "     'and opening Studio does not redraw the wall');\n" +
  "  ok(countMod('host && host.classList.contains') === 1,\n" +
  "     'and the repaint is only done while the wall is on screen');",
  { key: 'the Studio tab is not lit up like the other tabs' });

// The first cut of this release wrote that last needle with its quotes escaped
// inside a single-quoted string, which produced `contains(\\'active\\')` - an
// escaped backslash and then a terminator, so the gate was a SyntaxError rather
// than a failed check. The sub above writes the quote-free needle now, and this
// repairs the tree that already carries the broken line. The backslashes are
// built rather than typed, because getting them wrong is the whole bug.
const BS = String.fromCharCode(92);
heal(t705, 'the double-escaped gate needle',
  "  ok(countMod('if(host && host.classList.contains(" + BS + BS + "'active" + BS + BS + "')) renderStudio();') === 1,\n" +
  "     'and the repaint is not done while the wall is off screen');",
  "  ok(countMod('host && host.classList.contains') === 1,\n" +
  "     'and the repaint is only done while the wall is on screen');");

const studio = holder(fs.readFileSync(STUDIO, 'utf8'));
sub(studio, 'studio-70-check the 70.1.1 rules',
  "  console.log('[12] the page still holds together');",
  block([
    "  console.log('[11d] a badge that reaches its goal shows up on the wall');",
    '  {',
    '    // 70.1.1 - "fix the badges not working when you reach the goal". The wall is',
    '    // drawn when it is drawn, and nothing redrew it when the count moved, so a',
    '    // badge could be earned, saved and toasted with the grid in front of the user',
    '    // still showing the count from an earlier paint. Driven for real here: the',
    '    // header, the ring and the tiles all have to agree with the count after a',
    '    // goal is crossed, and opening Studio has to redraw.',
    "    const hero = () => { const el = doc.querySelector('.sc-hero-badges'); return el ? el.textContent : ''; };",
    '    const all = win.SC70.achievements().length;',
    "    doc.querySelector('#studioBtn').click();",
    '    await wait(120);',
    "    ok(!!doc.querySelector('#studioView').classList.contains('active'), 'Studio is the view');",
    "    ok(hero() === win.SC70.unlockedCount() + ' of ' + all + ' badges',",
    "      'and its wall is drawn from the real count (' + hero() + ')');",
    "    const chip = doc.querySelector('#studioView [data-f=\"all\"]');",
    "    if (chip && !chip.classList.contains('on')) { chip.click(); await wait(60); }",
    '    // Cross the next goal the honest way: move a counter the badges read.',
    '    const before = win.SC70.unlockedCount();',
    '    let steps = 0;',
    "    while (win.SC70.unlockedCount() <= before && steps < 400) { win.SC70.bump('studio', 1); steps++; }",
    "    const after = win.SC70.unlockedCount();",
    "    ok(after > before, 'a goal that is reached is counted (' + before + ' -> ' + after + ')');",
    '    const fresh = win.SC70.checkAchievements(true);',
    "    ok(fresh.length > 0, 'and recorded (' + fresh.length + ' at once)');",
    '    await wait(80);',
    "    ok(hero() === after + ' of ' + all + ' badges',",
    "      'and the wall the user is looking at agrees with it (' + hero() + ')');",
    "    ok(doc.querySelectorAll('#studioView .sc-badge.have').length >= after,",
    "      'with every earned badge a lit tile on that wall');",
    '    // Opening Studio has to redraw rather than trust the last paint: the',
    '    // sentinel can only disappear if a fresh render really ran.',
    "    const wall = doc.querySelector('.sc-hero-badges');",
    "    wall.textContent = 'STALE';",
    "    doc.querySelector('#libraryBtn').click();",
    '    await wait(80);',
    "    doc.querySelector('#studioBtn').click();",
    '    await wait(140);',
    "    ok(hero() !== 'STALE', 'and opening Studio redraws it rather than trusting the last paint');",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]).replace(/\n$/, ''),
  { key: "console.log('[11d] a badge that reaches its goal shows up on the wall');" });

/* ------------------------------------------------------------------- checks */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  must(count(page, "const APP_VERSION = '70.1.1';") === 1, 'the version is not 70.1.1 exactly once');
  must(count(page, "version: '70.1.1'") === 1, 'the 70.1.1 changelog entry is missing');
  must(count(page, "date: 'September 29, 2026 \u00b7 5:11 PM EDT'") === 1,
    'the 70.1.1 stamp is not the one this release was cut at');
  must(count(page, "version: '70.1'") === 1, 'the 70.1 entry left the array');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, "const CACHE_NAME = '" + OLDCACHE + "';") === 0, 'the old shell cache is still in sw.js');

  must(count(page, '#discoverBtn.active, #homeBtn.active, #studioBtn.active{') === 1,
    'the Studio pill is still not painted when it is the current tab');
  must(count(page, "el.closest('#studioBtn')") >= 1, 'opening Studio does not redraw the wall');
  must(count(page, 'function badgeRepaintIfVisible(){') === 1, 'the wall repaint is missing');
  must(count(page, 'if(fresh.length) badgeRepaintIfVisible();') === 1,
    'and a badge that reaches its goal does not repaint it');
  must(count(page, "if(host && host.classList.contains('active')) renderStudio();") === 1,
    'and the repaint is not limited to the visible wall');
  must(count(mod.text, 'function badgeRepaintIfVisible(){') === 1,
    'dev/sc70-module.js is not the source this patch re-splices');
  must(count(page, 'id="sc-studio-70"') === 1, 'the Studio script block is missing');

  // The badge system the fix sits in must be exactly as it was otherwise: the
  // same 201, the same five rewards, the same live unlock test.
  must(count(mod.text, 'function isUnlocked(a){ return a.need.got >= a.need.want; }') === 1,
    'the live unlock test was replaced instead of the wall being repainted');
  must(count(mod.text, "at: 201, kind: 'premium'") === 1, 'the 201-badge reward left the table');

  must(count(t705.text, 'the Studio tab is not lit up like the other tabs') === 1,
    'test-705 does not assert the release');
  must(count(studio.text, "console.log('[11d] a badge that reaches its goal shows up on the wall');") === 1,
    'the real-app probe does not assert the wall');
}

if(problems.length){
  console.error('patch-7011: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(MANIFEST){
  const built = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(built));
  console.log('patch-7011: root manifest.json seeded from ota/updates.json (' + built.size + ' bytes)');
  process.exit(0);
}

if(CHECK){
  console.log('patch-7011: tree is at ' + VERSION + ', ' + applied + ' to apply, ' + already + ' already in place');
  process.exit(0);
}

const files = [[IDX, html.text], [MOD, mod.text], [SW, sw.text], [TEST705, t705.text], [STUDIO, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7011: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7011: next `node dev/repin-7011.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
