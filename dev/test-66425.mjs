// v64.2.5 - the bubble that still came back blank, a finished card you can tap
// away, a record tap that glides, and a Things-to-know list that says what the
// app does today.
//
// The four things reported about 64.2.4:
//
//   "Update things to know about SideCut to now information because it is old
//    and outdated"
//   "the favorites bubble and pinned artist bubble still sometimes disappear
//    when scrolling"
//   "When there is a home screen notification that finishes such as watermark
//    remover I should be able to tap it and it goes away"
//   "when clicking on the record player to go to my current song in my library
//    and playlists it should be smooth not rough like it is now"
//
//   [1] the release itself: 64.2.5 runs, the head entry says so, and its six
//       notes still pass the wording rules both channels are held to;
//   [2] the repair: a paint-only outline, asked for on every settled scroll,
//       with nothing hidden, nothing measured and nothing put on its own layer;
//   [3] the finished card on Home: it carries the dismiss attribute, the handler
//       clears the right piece of state, and the badge follows;
//   [4] the record tap: one glide, sized by distance, with no second render and
//       no animation cancelled out from under it - and no jump anywhere in the
//       app scrolling at a fixed pace;
//   [5] the list a reader sees in Settings > More;
//   [6] what 64.2.4, 64.2.3 and 64.2.2 shipped is still standing, because a
//       release that dropped one of them would be a regression, not a fix;
//   [7] the file still holds together.
//
//   node dev/test-66425.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VER = '70.1.4'; /* repinned by dev/repin-7014.mjs */ /* repinned by dev/repin-7013.mjs */ /* repinned by dev/repin-7012.mjs */ /* repinned by dev/repin-7011.mjs */ /* repinned by dev/repin-701.mjs */ /* repinned by dev/repin-709.mjs */ /* repinned by dev/repin-708.mjs */ /* repinned by dev/repin-707.mjs */ /* repinned by dev/repin-706.mjs */ /* repinned by dev/repin-705.mjs */ /* repinned by dev/repin-70.mjs */
const PREV = '64.2.4';

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
    // head = the 64.2.5 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === '64.2.5') || entries[0];
    const items = head.items || [];
    ok(String(head.version) === '64.2.5', 'the entry this gate reads is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('9:40 PM') === -1, 'and it is not ' + PREV + "'s stamp");
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(/rollback/i.test(notes), 'and it still says what this release left alone');
    ok(/blank/i.test(notes), 'while naming what was reported');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    ok(entries.some((e) => /^64\.2\.4$/.test(String(e.version))), 'the release before this one is still listed');
    ok(entries.some((e) => /^64\.2\.3$/.test(String(e.version))), 'and so is the one before that');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'the service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(VER) === -1, 'and carries none of the app version');
}

console.log('[2] the repair cannot be seen, and no scroll can miss it');
{
  ok(has('  function scRepaint(el){'), 'one helper asks an element to paint again');
  ok(has("      el.style.outline = '1px solid transparent';"), 'through a property only paint reads');
  ok(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'and puts it back a frame later, so the frame that carries it is really painted');
  ok(!/visibility/.test(sliceC('  function scRepaint(el){', '  function scRepaintSurface(root, sel){')),
    'nothing in it hides anything');
  ok(has('  function scRepaintSurface(root, sel){'), 'a second one covers a whole surface');
  ok(has("    scRepaintSurface(wrap, '.home-bubble');"), 'the Home grid asks for every bubble');
  ok(has("    scRepaintSurface(strip, '.pinned-artist-chip');"), 'and the rail asks for every chip');
  const grid = sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
  const rail = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
  ok(grid !== '' && rail !== '', 'both settle repaints are still there');
  ok(!/carried/.test(grid) && !/carried/.test(rail),
    'and neither is gated on a drag having left something behind - the gate 64.2.4 had, and the reason the bubble could still come back blank');
  ok(!/visibility/.test(grid) && !/visibility/.test(rail), 'neither ever hides its surface');
  ok(!/translateZ/.test(grid) && !/translateZ/.test(rail), 'and neither puts it on a layer of its own');
  ok(!/offsetHeight|getBoundingClientRect/.test(grid) && !/offsetHeight|getBoundingClientRect/.test(rail),
    'nor measures anything, so no settled scroll lays the page out');
  ok(!/void (wrap|strip)\.offsetHeight/.test(code), 'and no forced layout is left anywhere');
  ok(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }"),
    'a chip still holding what a drag gave it is still put back');
  ok(has("        b.classList.remove('hb-dragging');"), 'and a bubble still holding its drag lift too');
  ok(has("      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); } }"),
    'a dashed placeholder an abandoned drag left is still cleared');
  ok(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
    'and a grid really missing a bubble is still drawn from the layout');
  ok(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
    'while a rail really missing its chips is still built again');
  ok(has('          if(hbDrag) return; // a drag in progress owns the grid'), 'a live drag still owns the grid');
  ok(!/getBoundingClientRect/.test(sliceC('  (function watchPinnedRail(){', '  function findPinnedRelease(')),
    'and the rail watch still decides from the DOM, never by measuring');
}

console.log('[3] a finished card on Home can be tapped away');
{
  ok(has('data-dismiss="watermark"'), 'the Watermarks-removed card can be dismissed');
  ok(has('data-dismiss="enrich"'), 'so can the song-details card');
  ok(has('data-dismiss="export"'), 'and the export card');
  ok(count('title="Tap to dismiss"') === 3, 'each of them says so (' + count('title="Tap to dismiss"') + ')');
  ok(count('data-dismiss=') === 3, 'and only a finished card carries it (' + count('data-dismiss=') + ' - the running cards cannot be tapped away)');
  const handler = sliceC("    el.querySelectorAll('[data-dismiss]').forEach(card => {", '    const anyActive = exportState.active');
  ok(handler !== '', 'the dismiss handler is still wired');
  ok(/if\(which === 'export'\)\{ exportState\.seen = true; exportState\.finishedAt = 0; \}/.test(handler),
    'tapping the export card clears the export it belongs to');
  ok(/else if\(which === 'enrich'\)\{ enrichState\.seen = true; enrichState\.finishedAt = 0; \}/.test(handler),
    'tapping a song-details card clears that run');
  ok(/else if\(which === 'watermark'/.test(handler) && /watermarkCleanState\.seen = true; watermarkCleanState\.finishedAt = 0;/.test(handler),
    'and tapping Watermarks removed clears the watermark run');
  ok(/else if\(which === 'pinned'/.test(handler), 'a pinned-artists card would be covered too');
  ok(handler.indexOf('renderHomeExportPopup();') !== -1, 'and the card is drawn again at once, so it leaves on the tap');
  ok(handler.indexOf('updateNotifBadge()') !== -1, 'with the bell badge refreshed in the same breath');
  ok(count('data-dismiss') >= 4, 'the handler itself still reads the attribute');
  const wm = slice('    if(typeof watermarkCleanState !== \'undefined\' && watermarkCleanState && watermarkCleanState.finishedAt', '    if(bgImportState');
  ok(wm.indexOf('Watermarks removed') !== -1 && wm.indexOf('data-dismiss="watermark"') !== -1,
    'the finished card is the one that carries it, not the running one');
  const CROSS = 'style="font-size:13px; color:var(--ink-dim); flex-shrink:0;">' + '\u2715' + '</span>';
  ok(count(CROSS) === 3, 'and each of them draws the dismiss cross (' + count(CROSS) + ')');
}

console.log('[4] the record tap is one glide, sized by distance');
{
  const jump = sliceC('  function jumpToPlayingSong(t){', '  let _scFocusTrackId = null;');
  ok(jump !== '', 'the playlist jump is still there');
  ok(jump.indexOf('smoothScrollIn(pane, row);') !== -1, 'it scrolls through the shared engine');
  ok(jump.indexOf('smoothScrollIn(pane, row, 220)') === -1, 'with the distance deciding the pace, not a fixed 220ms');
  ok(jump.indexOf('renderListInner._scrollToPlaying = false;') !== -1,
    'and the list\u2019s own auto-scroll is switched off for it, so the two cannot fight');
  ok(jump.indexOf('cancelScrollAnim(pane)') === -1, 'nothing is cancelled out from under it mid-flight');
  ok(jump.indexOf('renderTabs();') === -1 && jump.indexOf('renderList();') === -1,
    'and the list is not rendered a second time');
  ok(jump.indexOf('requestAnimationFrame(') !== -1, 'the glide starts once the rows have been laid out');
  ok(jump.indexOf('scrollIntoView') === -1, 'and it never leaves the pane');
  ok(jump.indexOf('scFocusRow(t.id)') !== -1, 'the row is still highlighted where it lands');
  const album = sliceC('  function openAlbumForCurrentSong(){', '  function jumpToPlayingSong(t){');
  ok(album !== '', 'the album jump is still there');
  ok(album.indexOf('smoothScrollIn(pane, row, 220)') === -1, 'and it is not paced at a fixed 220ms either');
  ok(!/smoothScrollIn\([^)]*, ?(120|150|200|220|250|300|350|400)\)/.test(code),
    'no programmatic scroll in the app carries a fixed duration any more');
  ok(has("            requestAnimationFrame(function(){ smoothScrollIn(pane, row); });"),
    'landing on the playing song when Playlists opens follows the distance too');
}

console.log('[5] Things to know about SideCut says what the app does today');
{
  const list = slice('<!-- Collapsible: Things to know about SideCut -->', '<div id="settingsPaneSandbox"');
  ok(list !== '', 'the list is still on the page');
  ok(list.indexOf('Tap a finished card on Home to dismiss it.') !== -1, 'it says a finished card can be tapped away');
  ok(list.indexOf('The patch notes in the bell are grouped by version.') !== -1, 'that the patch notes are grouped');
  ok(list.indexOf('The library tools live together in Settings') !== -1, 'where the cover tools live');
  ok(list.indexOf('Refetch missing covers') !== -1, 'naming the button itself');
  ok(list.indexOf('Watermark Remover') !== -1 && list.indexOf('starts switched on') !== -1, 'and that Watermark Remover starts on');
  ok(list.indexOf('Every version keeps its own copy, so a rollback is two-way.') !== -1, 'how a rollback behaves');
  ok(list.indexOf('SideCut sets no size of its own') !== -1, 'and whose allowance Storage shows');
  ok(list.indexOf('glides to that song, in Albums the album it is in opens and glides to the song inside it') !== -1,
    'the record-tap bullet describes the glide');
  ok(list.indexOf('it scrolls to that song in the list, in Albums it opens the album it is in') === -1,
    'and no longer describes the old jump');
  ok(list.indexOf('Hold the mini record player to adjust its angle') !== -1, 'the long-press tip is kept');
  ok(list.indexOf("The phone's media player can't open SideCut.") === -1, 'and the media-player line has been taken out of the list');
  ok(list.indexOf('Back up before rolling back.') !== -1, 'as is the advice to back up before rolling back');
  ok(count('style="color:var(--coral); flex-shrink:0;">\u2022</span>') >= 13,
    'every bullet still carries its marker (' + count('style="color:var(--coral); flex-shrink:0;">\u2022</span>') + ')');
}

console.log('[6] what 64.2.4, 64.2.3 and 64.2.2 shipped is still standing');
{
  ok(has('  function scPrepaintTheme(){') || has('(function scPrepaintTheme(){'), 'the launch still opens in the saved theme');
  ok(has('  .track.playing::after{'), 'the playing row still glows on a layer of its own');
  ok(!/glowPulse[^}]*box-shadow/.test(src), 'so its pulse still paints nothing per frame');
  ok(has('  function scTitleKeyIsStrong(k){'), 'a short title key is still too weak to reject on');
  ok(has('  function repaintHomeGrid(){') && has('  function repaintPinnedRail(list){'), 'both surfaces still have their repair');
  ok(!/visibility/.test(sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){')), 'and neither hides itself any more');
  ok(has('overflow-x:hidden; -webkit-overflow-scrolling:touch; position:relative; z-index:20; padding:14px 16px 170px; }'),
    'Home still carries the stacking context 64.2.1 gave it');
  const libGroup = src.indexOf('<!-- Collapsible: Library Tools & Fetching -->');
  const wmGroup = src.indexOf('<!-- Watermark Remover -->');
  const btn = src.indexOf('id="refetchCoversBtn"');
  ok(libGroup !== -1 && wmGroup !== -1 && btn !== -1, 'the settings groups are all still on the page');
  ok(btn > libGroup && btn < wmGroup, 'Refetch missing covers is still inside the library group');
  ok(has('<span id="refetchCoversLabel">Refetch missing covers</span>'), 'with its own label element');
  ok(has('  let watermarkEnabled = true;'), 'Watermark Remover still starts on');
  ok(has('  function scApplyChangelogGroup(v, open){'), 'the bell\u2019s notes are still a header per release');
  ok(has('  const openChangelogGroups = new Set();'), 'with the open ones kept in one place');
  ok(has('<span>Roll back app (or go forward again)</span>'), 'rolling forward is still one tap from the picker');
  ok(has('\' of the \' + scFmtBytes(estimate.quota) + \' this phone allows the app\''), 'Storage still names whose allowance it shows');
  ok(count('background:var(--coral); color:var(--on-coral,#fff)') >= 14,
    'every accent fill still picks its own text colour (' + count('background:var(--coral); color:var(--on-coral,#fff)') + ')');
  ok(has('  function scSetRefetchLabel(txt){'), 'and 64.2.4\u2019s cover-label helper is still on the page');
}

console.log('[7] the file still holds together');
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
  // The one-shot flags that guard a run must not have been duplicated.
  ok(count("window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;") === 1, 'the album jump is exposed once');
  ok(count("window.__scJumpToPlayingSong = jumpToPlayingSong;") === 1, 'and so is the list jump');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
