// v64.2.7 - the pinned artists island and the Favorites bubble stop flickering
// on the animated themes.
//
// The report, as it was put: "I said pinned artist plateau and the favorites
// bubble are affected by slightly disappearing before reappearing with dynamic
// themes". Both surfaces, one cause, and the cause is neither surface's own CSS:
// every dynamic-theme rule in this file is one of only two things - the two
// full-viewport backdrop layers and the glow inside a Home bubble - so what the
// island and the grid share is the backdrop, and the backdrop was still running
// an animated colour filter that re-paints it every frame.
//
//   [1] the release itself: 64.2.7 runs, the head entry says so, and its six
//       notes still pass the wording rules both channels are held to;
//   [2] the backdrop: the filter is gone, every ::before rule is filter-free,
//       and the motion the themes keep is all still transform/opacity;
//   [3] the island: BOTH of its scrollers ask for a repair, and the repair is
//       still the invisible one - nothing hidden, measured or put on a layer;
//   [4] what 64.2.6, 64.2.5, 64.2.4, 64.2.2 and 64.2 shipped is still standing,
//       because a release that dropped one of them would be a regression, not a
//       fix;
//   [5] the file still holds together.
//
//   node dev/test-66427.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '73.6.2'; /* repinned by dev/repin-7362.mjs */
const PREV = '64.2.6';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const slice = (from, to) => {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
};
// Comments describe the code the "is it gone" checks look for, so those run over
// the code only - the same strip dev/test-6058.mjs uses.
const code = src.replace(/^\s*\/\/.*$/gm, '');
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // head = the 64.2.7 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === '64.2.7') || entries[0];
    const items = head.items || [];
    ok(String(head.version) === '64.2.7', 'the entry this gate reads is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('6:35 AM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    // The head entry belongs to whatever shipped last, so the words THIS gate
    // was written about are read from the 64.2.7 entry by version - the same
    // rule dev/test-66423.mjs and dev/test-66424.mjs already follow. Pointing
    // them at entries[0] made a later release's notes carry 64.2.7's words.
    const entry6427 = entries.find((e) => /^64\.2\.7$/.test(String(e.version))) || {};
    const notes6427 = (entry6427.items || []).join('\n');
    ok(/flicker/i.test(notes6427), 'while naming what was reported');
    ok(/pinned artists/i.test(notes6427), 'on the island');
    ok(/favorites/i.test(notes6427), 'and on the Favorites bubble');
    ok(/blank/i.test(notes6427), 'and the word the older gates read it for');
    ok(/list/i.test(notes6427) && /record/i.test(notes6427), 'including the two 64.2.6 added');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.6$/.test(String(e.version))), 'the release before this one is still listed');
    ok(entries.some((e) => /^64\.2\.5$/.test(String(e.version))), 'and so is the one before that');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the backdrop no longer re-paints itself every frame');
{
  ok(!has('@keyframes sd-dyn-hue{'), 'the filter keyframes are gone');
  ok(!/, sd-dyn-hue /.test(src), 'and no rule animates them any more');
  // The signature of the removed keyframes, and ONLY theirs: the drum pad still
  // cycles its own hue (dev/padRgbCycle, a small element, not a backdrop).
  ok(!/hue-rotate\(0deg\) saturate\(1\.1\)/.test(src), 'and the filter they animated is gone with them');
  ok(!/hue-rotate\(28deg\) /.test(src), 'not even the far end of the cycle');
  ok(count('animation: sd-dyn-drift ') === 13, 'every dynamic theme still gets its drift (' + count('animation: sd-dyn-drift ') + ' of 13)');
  ok(has('@keyframes sd-dyn-drift{'), 'the drift keyframes are still here');
  ok(has('@keyframes sd-dyn-drift-rev{'), 'so is the second, counter-moving layer');
  ok(has('@keyframes sd-dyn-sheen{'), 'and the sheen');
  ok(has('body[class*="theme-dyn-"]::after{'), 'the ::after backdrop layer is still the accent-coloured one');
  // The whole claim of this release, checked as a property of the stylesheet
  // rather than of one rule: a dynamic theme may never declare a filter.
  const dynRules = src.match(/body[^{}]*theme-dyn-[^{]*\{[^}]*\}/g) || [];
  const withFilter = dynRules.filter((r) => /filter:/.test(r));
  ok(dynRules.length >= 12, 'the dynamic-theme rules are all still here (' + dynRules.length + ')');
  ok(withFilter.length === 0, 'and not one of them declares a filter (' + withFilter.length + ')');
  const beforeRules = src.match(/body(?:\.theme-dyn-[a-z]+)?\[?[^{]*::before\{[^}]*\}/g) || [];
  ok(beforeRules.length >= 13, 'every ::before backdrop rule is still declared (' + beforeRules.length + ')');
  ok(beforeRules.every((r) => !/filter:/.test(r)), 'and every one of them is filter-free');
  // The reduce-motion rules are overrides and carry no layer of their own, so
  // the "it still paints the layer it did before" check is scoped to the rules
  // that really declare one.
  // The layers are declared in two groups (the shared one and the v60 five) that
  // carry content/position; the 13 per-theme rules add only background and
  // animation on top of them, which is why the drift count above is their check.
  const declared = beforeRules.filter((r) => /content:''/.test(r));
  ok(declared.length >= 2, 'both backdrop groups are still declared (' + declared.length + ')');
  ok(declared.every((r) => /position:fixed/.test(r) && /inset:-/.test(r)),
    'and each still paints the fixed, over-sized layer it did before');
  // The glow inside a bubble is opacity-only, and it stays that way: a filter
  // there would put the whole flicker back on the one surface that is a child of
  // a clipped, rounded box.
  ok(!/\.hb-glow\{[^}]*filter/.test(src), 'no bubble glow gained a filter on the way');
  // Five, not four: the Vortex reward theme (70.0.5) carries a per-theme rule of
  // its own, where every other dynamic theme shares one. The gate was red from
  // that release until 70.0.6 moved the number, which is what it is counting.
  ok(count('animation: sd-glow-pulse 6s ease-in-out infinite') === 5, 'and the glow still breathes on the 6s cycle (' + count('animation: sd-glow-pulse 6s ease-in-out infinite') + ')');
}

console.log('[3] the island asks for a repair on both of its scrollers');
{
  ok(has('  (function watchPinnedRail(){'), 'the watcher is still installed once');
  ok(has('    var onRailScroll = function(){'), 'its settle is named, so two scrollers can share it');
  ok(has("    dv.addEventListener('scroll', onRailScroll, { passive: true });"), 'Discover still asks on its own scroll');
  ok(has("    var rl = $('pinnedArtistsList');"), 'and the chip scroller is found');
  ok(has("    if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });"),
    'which asks on its own scroll too - the gesture that was invisible before');
  // A scroll event on an element does not bubble, so the old shape (a listener
  // on #discoverView alone, with the settle inlined into it) is exactly what
  // must not come back.
  ok(sliceC('  (function watchPinnedRail(){', '  function findPinnedRelease').indexOf("dv.addEventListener('scroll', function(){") === -1,
    'the settle is no longer inlined into the Discover listener alone');
  const watch = sliceC('  (function watchPinnedRail(){', '  function findPinnedRelease');
  ok(watch !== '' && count("addEventListener('scroll', onRailScroll") === 2, 'exactly two scrollers ask for it');
  ok(watch.indexOf('pinnedArtistsList') !== -1, 'and the second one is the rail itself');
  ok(count('          repaintPinnedRail(l);\n') === 1, 'a settled scroll still repaints the card itself');
  ok(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
    'and a rail really missing its chips is still built again');
  ok(!/offsetHeight|getBoundingClientRect/.test(watch), 'nothing is measured, so no settled scroll lays the page out');
  ok(!/visibility|translateZ/.test(watch), 'and nothing hides or promotes the surface');
  const rail = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
  ok(rail !== '', 'the card repair is still there');
  ok(!/visibility|translateZ|offsetHeight|getBoundingClientRect/.test(rail), 'and it still hides, promotes and measures nothing');
  ok(!/carried/.test(rail), 'and is still not gated on a drag having left something behind');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding what a drag gave it is still put back');
  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');"), 'and every chip is still asked to paint');
}

console.log('[4] what 64.2.6, 64.2.5, 64.2.4, 64.2.2 and 64.2 shipped is still standing');
{
  ok(has('  function scRepaint(el){'), 'the paint request is still one helper');
  ok(has("      el.style.outline = '1px solid transparent';"), 'through a property only paint reads');
  ok(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'taken back a frame later, not inside the same one');
  ok(has(`      requestAnimationFrame(function(){\n        requestAnimationFrame(function(){`),
    'so the frame that carries the invalidation is really painted');
  const scBody = sliceC('  function scRepaint(el){', '  function scRepaintSurface(root, sel){');
  ok(scBody !== '' && !/visibility|translateZ|offsetHeight|getBoundingClientRect/.test(scBody),
    'and the repair still hides nothing, promotes nothing and measures nothing');
  ok(has('  function scRepaintSurface(root, sel){'), 'the surface helper is still there');
  ok(has("    scRepaintSurface(wrap, '.home-bubble');"), 'the Home grid still asks for every bubble');
  ok(has('if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){'), 'an unchanged Home grid is still left alone');
  ok(has("    try{ scRepaintSurface(bubbles, '.home-bubble'); }catch(_eRpBuilt){}\n  }"),
    'and a rebuild that happens still asks for its own paint');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'a grid really missing a bubble is still drawn from the layout again');
  ok(has('  var scLibScroll = { playlists: 0, albums: 0 };'), 'each library half still keeps its own place');
  // 64.3 gave each half its own restore: Playlists skips it only when it really
  // landed on the song, and Albums always puts its own offset back.
  ok(count('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1 &&
    count('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,
    'each half restores its own position');
  ok(count('data-dismiss=') === 3 && count('title="Tap to dismiss"') === 3,
    'a finished card on Home can still be tapped away (' + count('data-dismiss=') + ')');
  ok(has('  .track.playing::after{'), 'the playing row still glows on a layer of its own');
  ok(has('  function scPrepaintTheme(){') || has('(function scPrepaintTheme(){'), 'the launch still opens in the saved theme');
  ok(has('  function scTitleKeyIsStrong(k){'), 'a short title key is still too weak to reject on');
  ok(has('  function repaintHomeGrid(){') && has('  function repaintPinnedRail(list){'), 'both surfaces still have their repair');
  ok(has('#pinnedArtistsStrip{ position:relative; z-index:1; }'),
    'the island still carries the stacking context 64.2 gave it');
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
    'and Home still carries the one 64.2.1 gave it');
  ok(has('  function scApplyChangelogGroup(v, open){'), 'the bell\\u2019s notes are still a header per release');
  ok(has('  function scNow(){'), 'and the whole-file shape is unchanged');
}

console.log('[5] the file still holds together');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'every inline script block parses (' + bad + ' bad)');
  let code0 = 0, out = '';
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/audit-calls.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const first = out.split('\n').find((l) => l.trim()) || '(no output)';
  ok(code0 === 0, 'every name the app reads is declared: ' + first.trim());
  ok(count('  function onRailScroll') + count('    var onRailScroll') === 1, 'the rail settle is declared once');
  ok(count('    scRepaintSurface(strip, \'.pinned-artist-chip\');') === 1, 'and the card asks for its paint in one place');
  const noCssComments = src.replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!/sd-dyn-hue/.test(noCssComments), 'and nothing outside a comment still names the removed filter');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
