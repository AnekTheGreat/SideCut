// v64.2.6 - the Favorites bubble stops blinking out, and the record tap moves
// only the list it belongs to.
//
// The two things reported about 64.2.5:
//
//   "Why does me clicking on the record player in albums or playlists influence
//    the other it shouldnt scroll down in another place only in its place"
//   "the favorites bubble keeps disappearing fix these damn issues bro"
//
//   [1] the release itself: 64.2.6 runs, the head entry says so, and its six
//       notes still pass the wording rules both channels are held to;
//   [2] the repair: the paint request outlives the frame that carries it, which
//       is the one thing 64.2.5's version could not do;
//   [3] the grid: an unchanged one is left alone, a rebuild that does happen
//       asks for its own paint, and a rebuild is still forced when a bubble is
//       really missing;
//   [4] the two library halves: each takes its place down as it is left and is
//       put back at it when it is entered - including "back at the top";
//   [5] what 64.2.5, 64.2.4 and 64.2.3 shipped is still standing, because a
//       release that dropped one of them would be a regression, not a fix;
//   [6] the file still holds together.
//
//   node dev/test-66426.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '70.1.9'; /* repinned by dev/repin-7019.mjs */ /* repinned by dev/repin-7018.mjs */ /* repinned by dev/repin-7017.mjs */ /* repinned by dev/repin-7016.mjs */ /* repinned by dev/repin-7015.mjs */ /* repinned by dev/repin-7014.mjs */ /* repinned by dev/repin-7013.mjs */ /* repinned by dev/repin-7012.mjs */ /* repinned by dev/repin-7011.mjs */ /* repinned by dev/repin-701.mjs */ /* repinned by dev/repin-709.mjs */ /* repinned by dev/repin-708.mjs */ /* repinned by dev/repin-707.mjs */ /* repinned by dev/repin-706.mjs */ /* repinned by dev/repin-705.mjs */ /* repinned by dev/repin-70.mjs */
const PREV = '64.2.5';

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
    // head = the 64.2.6 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === '64.2.6') || entries[0];
    const items = head.items || [];
    ok(String(head.version) === '64.2.6', 'the entry this gate reads is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('10:30 PM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    ok(/blank/i.test(notes) || /disappear/i.test(notes), 'while naming what was reported');
    ok(/list/i.test(notes) && /record/i.test(notes), 'and both reports are answered in it');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.5$/.test(String(e.version))), 'the release before this one is still listed');
    ok(entries.some((e) => /^64\.2\.4$/.test(String(e.version))), 'and so is the one before that');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the paint request outlives the frame that carries it');
{
  ok(has('  function scRepaint(el){'), 'one helper asks an element to paint again');
  ok(has("      el.style.outline = '1px solid transparent';"), 'through a property only paint reads');
  ok(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'and puts it back a frame later');
  ok(has(`      requestAnimationFrame(function(){\n        requestAnimationFrame(function(){`),
    'so the frame that carries the invalidation is really painted');
  ok(!/try\{ el\.style\.outline = ''; \}catch\(_eRpBack\)\{\}\n      \}\);/.test(src),
    'and not cleared inside the same one, which the WebView collapses into a single pass');
  const repaint = sliceC('  function scRepaint(el){', '  function scRepaintSurface(root, sel){');
  ok(repaint !== '' && !/visibility|translateZ|offsetHeight|getBoundingClientRect/.test(repaint),
    'nothing is hidden, promoted or measured on the way');
  ok(has('  function scRepaintSurface(root, sel){'), 'a second one covers a whole surface');
  ok(has("    scRepaintSurface(wrap, '.home-bubble');"), 'the Home grid asks for every bubble');
  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');"), 'and the rail asks for every chip');
  const grid = sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
  const rail = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
  ok(grid !== '' && rail !== '', 'both settle repaints are still there');
  ok(!/carried/.test(grid) && !/carried/.test(rail), 'and neither is gated on a drag having left something behind');
  ok(!/visibility/.test(grid) && !/visibility/.test(rail), 'neither ever hides its surface');
  ok(!/translateZ/.test(grid) && !/translateZ/.test(rail), 'and neither puts it on a layer of its own');
  ok(!/offsetHeight|getBoundingClientRect/.test(grid) && !/offsetHeight|getBoundingClientRect/.test(rail),
    'nor measures anything, so no settled scroll lays the page out');
  ok(!/void (wrap|strip)\.offsetHeight/.test(code), 'and no forced layout is left anywhere');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding what a drag gave it is still put back');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'and a grid really missing a bubble is still drawn from the layout');
  ok(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
    'while a rail really missing its chips is still built again');
}

console.log('[3] the grid is only rebuilt when it really changed');
{
  ok(has('const gridHtml = homeOrderNow.map(k => {'), 'the markup is assembled before anything is assigned');
  ok(has('    bubbles.innerHTML = gridHtml;'), 'and the grid is built from it');
  ok(has('    if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){'), 'an unchanged grid is left completely alone');
  const skip = sliceC('    if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){', '    renderHome._lastHtml = gridHtml;');
  ok(skip !== '' && /applyHomeBubbleSizes\(\);/.test(skip),
    'while the bubble sizes are still applied, so a resize is never lost by skipping');
  ok(skip.indexOf('return;') !== -1, 'and it really does stop there');
  ok(has('    renderHome._lastHtml = gridHtml;'), 'so the markup on the page is remembered');
  ok(has("    try{ scRepaintSurface(bubbles, '.home-bubble'); }catch(_eRpBuilt){}"),
    'and a rebuild that DOES happen asks for every bubble to paint again, without waiting for a settle');
  ok(has('    try{ repaintPinnedRail(list); }catch(_eRpRail){}'),
    'a rebuilt pinned-artists rail asks for its own paint too');
  // renderHome's own body runs up to the repair section, which is a comment
  // block - so this one is sliced raw, not from the comment-stripped copy.
  const home = slice('  function renderHome(){', '  // ---- Asking a surface to draw itself again');
  ok(home.indexOf("bubbles.style.setProperty('--hb-phase'") !== -1, 'the glow phase is still stamped before the skip');
  ok(home.indexOf('renderHome._lastHtml === gridHtml') < home.indexOf('bubbles.innerHTML = gridHtml'),
    'and the decision is made before the grid is written');
  ok(home.indexOf('wireHomeBubbleDrag(b)') !== -1, 'the bubbles are still wired for drag-reorder');
  ok(home.indexOf('scRepaintSurface(bubbles') > home.indexOf('wireHomeBubbleDrag(b)'),
    'with the paint asked for after they are wired');
}

console.log('[4] each library half keeps its own place');
{
  ok(has('  var scLibScroll = { playlists: 0, albums: 0 };'), 'each half has a remembered position');
  ok(has('  window.__scLibScroll = scLibScroll;'), 'which a probe can read');
  ok(has('  function scLibHalfName(){'), 'and one place decides which half is open');
  ok(has('    const libHalf = scLibHalfName();'), 'the renderer asks which half it is drawing');
  ok(has('    const leftHalf = renderListInner._lastHalf;'),
    'and which half the pane was actually showing, not what a caller just set');
  ok(has('    const halfChanged = !!(leftHalf && leftHalf !== libHalf);'), 'so a switch from one half to the other is known');
  ok(has('    if(halfChanged) scLibScroll[leftHalf] = pane.scrollTop;'),
    'the half being left is remembered where it was, before the pane is emptied');
  ok(has('      ? (scLibScroll[libHalf] || 0)'), 'and the half being entered is handed its own offset');
  ok(has('    renderListInner._lastHalf = libHalf;'), 'so the half this render belongs to is recorded');
  // 64.3 gave each half its own restore: Playlists skips it only when it really
  // landed on the song, and Albums always puts its own offset back.
  ok(count('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1 &&
    count('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,
    'each half restores its own position');
  ok(!/&& prevScrollTop\) pane\.scrollTop/.test(code),
    'which is applied even when the offset is the top, because the pane is shared by two lists');
  const albumTail = slice('      // Albums is the other half of the library', '    ids.forEach((id,i) => {');
  ok(albumTail !== '' && albumTail.indexOf('pane.scrollTop = prevScrollTop') !== -1,
    'and Albums, whose cards are built in their own branch, is put back before it returns');
  ok(albumTail.indexOf('return;') !== -1, 'so the return really is what would have skipped it');
  ok(!/watchLibraryHalfScroll|addEventListener\('scroll'[^)]*scLibScroll/.test(code),
    'no scroll listener is needed to keep the two positions apart');
  ok(sliceC('  function jumpToPlayingSong(t){', '  let _scFocusTrackId = null;').indexOf('scrollIntoView') === -1,
    'and the record tap still never reaches outside the pane');
}

console.log('[5] what 64.2.5, 64.2.4 and 64.2.3 shipped is still standing');
{
  ok(has('data-dismiss="watermark"'), 'a finished card on Home can still be tapped away');
  ok(count('title="Tap to dismiss"') === 3, 'each of the finished cards says so (' + count('title="Tap to dismiss"') + ')');
  ok(count('data-dismiss=') === 3, 'and only a finished card carries it (' + count('data-dismiss=') + ')');
  ok(has("  function scPrepaintTheme(){") || has('(function scPrepaintTheme(){'), 'the launch still opens in the saved theme');
  ok(has('  .track.playing::after{'), 'the playing row still glows on a layer of its own');
  ok(!/glowPulse[^}]*box-shadow/.test(src), 'so its pulse still paints nothing per frame');
  ok(has('  function scTitleKeyIsStrong(k){'), 'a short title key is still too weak to reject on');
  ok(has('  function repaintHomeGrid(){') && has('  function repaintPinnedRail(list){'), 'both surfaces still have their repair');
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
    'Home still carries the stacking context 64.2.1 gave it');
  const libGroup = src.indexOf('<!-- Collapsible: Library Tools & Fetching -->');
  const wmGroup = src.indexOf('<!-- Watermark Remover -->');
  const btn = src.indexOf('id="refetchCoversBtn"');
  ok(libGroup !== -1 && wmGroup !== -1 && btn !== -1, 'the settings groups are all still on the page');
  ok(btn > libGroup && btn < wmGroup, 'Refetch missing covers is still inside the library group');
  ok(has('  function scApplyChangelogGroup(v, open){'), 'the bell\u2019s notes are still a header per release');
  ok(has('<span>Roll back app (or go forward again)</span>'), 'rolling forward is still one tap from the picker');
  ok(has('\' of the \' + scFmtBytes(estimate.quota) + \' this phone allows the app\''), 'Storage still names whose allowance it shows');
  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 14,
    'every accent fill still picks its own text colour (' + count('background:var(--coral); color:var(--on-coral,#fff)') + ')');
  ok(has('  function scSetRefetchLabel(txt){'), 'and the cover-label helper is still on the page');
  ok(has('  function scNow(){'), 'and the whole-file shape is unchanged');
}

console.log('[6] the file still holds together');
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
  ok(count("window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;") === 1, 'the album jump is exposed once');
  ok(count("window.__scJumpToPlayingSong = jumpToPlayingSong;") === 1, 'and so is the list jump');
  ok(count('  var scLibScroll = { playlists: 0, albums: 0 };') === 1, 'and the two positions are declared once');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
