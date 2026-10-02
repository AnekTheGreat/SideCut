// v64.3.1 - the list you are scrolling stops being rebuilt underneath you.
//
//   "The scrolling still needs to be smooth it's smooth for like 2 seconds then
//    gets clunky for the record player when you tap on it"
//
// The third report about the list's roughness, and the first one pointed at the
// list instead of the glide. 64.2.5 changed the glide (no cancel-and-restart) and
// 64.2.7/64.2.9 took the last per-frame work a dynamic theme did out of the
// backdrop; both were real, neither is what is felt. What is felt is a redraw -
// pane emptied, every row built again - landing on a list that is being scrolled.
// And something was doing exactly that on its own: the background pass that fills
// in missing covers and artist names, once per twenty songs, starting 2.5 seconds
// after the library loads.
//
//   [1] the release itself: 64.3.1 runs, the head entry says so, and its six notes
//       still pass the wording rules both channels are held to (including the
//       words the older gates read the head entry for);
//   [2] the guard, read off the source: the pane says whether it is moving, one
//       scheduler holds a draw back while it is, never for longer than its cap;
//   [3] a background batch updates the rows it changed instead of rebuilding the
//       list, and the Albums half still redraws (into the same waiting scheduler);
//   [4] the two record taps draw their own list at once, because they measure the
//       playing row two frames later;
//   [5] the one the user actually feels, driven on the real app: the pass builds
//       no rows while the list is on screen, and a redraw asked for mid-glide (or
//       mid-finger) waits for the list to be still (dev/listredraw-66431-check.cjs);
//   [6] what 64.3, 64.2.9, 64.2.8, 64.2.7 and 64.2.6 shipped is still standing;
//   [7] the file still holds together.
//
//   node dev/test-66431.mjs
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const ota = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');
const VER = '64.3.1';
const PREV = '64.3';
// The build actually on the page - the release this gate describes may be older.
const PAGEVER = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
// The page this gate runs against may be a LATER release (it always is, once the
// next one ships). Only the "which release is on the page" line is about the
// page; everything else reads the 64.3.1 ENTRY by version, so a newer release is
// never made to carry an older one's words - the same move dev/test-6643.mjs and
// test-66427/66428/66429 already had (see AGENTS.md, 64.3 and 64.3.1).
const vnum = (v) => String(v || '').split('.').map((n) => parseInt(n, 10) || 0);
const vcmp = (a, b) => {
  const A = vnum(a), B = vnum(b);
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const d = (A[i] || 0) - (B[i] || 0);
    if (d) return d > 0 ? 1 : -1;
  }
  return 0;
};

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
const countC = (needle) => code.split(needle).length - 1;
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(!!ver && vcmp(ver, VER) >= 0, 'APP_VERSION = ' + ver + ' (this gate describes ' + VER + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    const at = entries.findIndex((e) => String(e.version) === VER);
    ok(at !== -1, 'the ' + VER + ' entry is still in the changelog');
    const head = entries[at === -1 ? 0 : at];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the entry this gate reads is v' + head.version);
    ok(items.length === 6, 'six notes (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    const notes = items.join('\n');
    ok(items.every((it) => it.indexOf('[FULL]') === -1),
      'every note publishes on both channels, so a store reader is never told less');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(String(head.date).indexOf('5:50 PM') === -1, 'and it is not ' + PREV + ' stamp');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the entry');
    ok(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    ok(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor a term the wider store list knows');
    ok(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    // The words the older gates read the HEAD entry for (dev/test-66425.mjs wants
    // rollback and blank, dev/test-66426.mjs wants list and record, and every one
    // of them wants the rollback line). A newer release is not made to carry a
    // release-specific word, but these four are the standing contract.
    ok(/rollback/i.test(notes), 'it still says what this release left alone (rollback)');
    ok(/blank/i.test(notes), 'and names the surface that came back blank (blank)');
    ok(/list/i.test(notes) && /record/i.test(notes), 'and both halves of the standing report (list, record)');
    ok(String(entries[(at === -1 ? 0 : at) + 1] && entries[(at === -1 ? 0 : at) + 1].version) === PREV, 'the release before this one is still listed next');
    ok(entries.some((e) => /^64\.2\.9$/.test(String(e.version))), 'and the one before that');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  // The shell cache has a name of its own and moves on every release. Pinning the
  // literal made every later release fail this line for no reason; what the check
  // is really for is that the cache is the SHELL's and that it is not a copy of
  // the app version (which is what the old naming bug looked like).
  ok(/^sidecut-shell-v\d/.test(swCache), 'the shell cache has a name of its own (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + PAGEVER, 'the shell cache is the release number (' + swCache + ')');
}

console.log('[2] the list is not rebuilt while it is moving');
{
  ok(has('  function scListIsMoving(){'), 'the pane can say whether the list is moving');
  ok(has("      if(pane.__scScrollAnim) return true;"), 'which asks the shared scroll engine whether a glide is in flight');
  ok(has("      var pane = $('listPane');"), 'and looks at the list pane itself');
  ok(has('      return (Date.now() - _scListScrollAt) < SC_LIST_MOVING_MS;'), 'and whether the finger moved it just now');
  ok(has('  window.__scListMoving = scListIsMoving;'), 'and it is reachable from a probe');
  const scroller = sliceC("  function animateScrollTop(container, targetTop, dur, onDone, ease){", '  window.__scAnimateScroll = animateScrollTop;');
  ok(scroller.indexOf('container.__scScrollAnim = anim;') !== -1,
    'a glide really does leave its animator on the container the guard asks about');
  ok(scroller.indexOf('if(container.__scScrollAnim === anim) container.__scScrollAnim = null;') !== -1,
    'and clears it when it finishes');
  ok(countC('_scListScrollAt = Date.now();') === 1, 'the finger stamp is written in exactly one place (' +
    countC('_scListScrollAt = Date.now();') + ')');
  const handlerAt = code.indexOf("  $('listPane').addEventListener('scroll', () => {");
  const handler = handlerAt === -1 ? '' : code.slice(handlerAt, handlerAt + 400);
  ok(handler.indexOf('_scListScrollAt = Date.now();') !== -1,
    'by the pane\'s own scroll handler - element scroll events do not bubble');
  ok(has('  var SC_LIST_MOVING_MS = 120;') && has('  var SC_LIST_STILL_MAX = 1200;'),
    'both windows are named constants');
  const tick = sliceC('  function scRenderListTick(){', '  function scRenderListDraw(){');
  ok(tick !== '', 'there is one scheduler for a scheduled rebuild');
  ok(tick.indexOf('if(scListIsMoving() && (Date.now() - _renderListWaitFrom) < SC_LIST_STILL_MAX){') !== -1,
    'it holds the draw back while the list is moving');
  ok(tick.indexOf('        scRenderListTick();\n        return;') !== -1, 'by re-arming for the next frame');
  ok(tick.indexOf('scRenderListDraw();') !== -1, 'and draws when it stops, or when the cap is reached');
  ok(countC('_renderListRAF = requestAnimationFrame(') === 1, 'exactly one place schedules that frame (' +
    countC('_renderListRAF = requestAnimationFrame(') + ')');
  const rl = sliceC('  function renderList(){', '  function scRenderListNow(){');
  ok(rl.indexOf('if(!_renderListWaitFrom) _renderListWaitFrom = Date.now();') !== -1, 'a request starts the wait clock once');
  ok(rl.indexOf('_renderListPending = true;') !== -1 && rl.indexOf('scRenderListTick();') !== -1,
    'and is handed to the scheduler');
  ok(rl.indexOf('renderListInner()') === -1, 'renderList itself no longer draws');
  // The cap is a cap: the wait clock is read against the first request, not reset
  // on every frame, or a long scroll would defer the rebuild for ever.
  ok(tick.indexOf('_renderListWaitFrom = 0;') !== -1 && tick.indexOf('if(!_renderListPending){ _renderListWaitFrom = 0; return; }') !== -1,
    'and the clock is only reset when a draw actually happens');
}

console.log('[3] a background batch updates the rows it changed');
{
  const fn = sliceC('  function scPatchListRows(ids){', '  function renderList(){');
  ok(fn !== '', 'there is one helper that patches rows in place');
  ok(fn.indexOf("    var pane = $('listPane');") !== -1, 'it works on the list pane');
  ok(fn.indexOf("pane.querySelectorAll('.track[data-id=\"' + ids[i] + '\"]')") !== -1, 'it looks for that song\'s rows');
  ok(fn.indexOf("art.style.backgroundImage = 'url(\"' + t.artUrl + '\")'") !== -1, 'it writes the art the song now has');
  ok(fn.indexOf('if(nameEl && t.name && nameEl.textContent !== t.name) nameEl.textContent = t.name;') !== -1,
    'and the title, only when it changed');
  ok(fn.indexOf('if(artistEl && t.artist && artistEl.textContent !== t.artist) artistEl.textContent = t.artist;') !== -1,
    'and the artist line the same way');
  ok(fn.indexOf('innerHTML') === -1, 'and it builds nothing: a row is not re-made to change two lines in it');
  ok(has('  window.__scPatchListRows = scPatchListRows;'), 'it is reachable from a probe');
  const loop = sliceC('  async function runAutoEnrich(){', '    enrichState.active = false;');
  ok(loop !== '', 'the background pass is still on the page');
  ok(loop.indexOf('      const _batchTouched = [];') !== -1, 'a batch keeps the songs it changed');
  ok(loop.indexOf('if(updated){ enrichState.updated++; _batchTouched.push(t.id); }') !== -1,
    'and counts a song only when something was really written');
  ok(loop.indexOf('        else scPatchListRows(_batchTouched);') !== -1, 'the rows half is patched in place');
  ok(loop.indexOf("        if(scLibHalfName() === 'albums') renderList();") !== -1,
    'and the Albums half still redraws, because its cards carry a cover of their own');
  ok(loop.indexOf('      renderList();\n      refreshEnrichNotif();') === -1,
    'the unconditional per-batch rebuild is gone');
  ok(count('renderList();\n      refreshEnrichNotif();') === 0, 'anywhere in the file');
  const inner = sliceC('      const _batchTouched = [];', '      saveEnrichAttempted();');
  ok(inner.indexOf('renderList') === -1 && inner.indexOf('scPatchListRows') === -1,
    'and nothing inside the per-song loop draws anything at all');
  ok(loop.indexOf('      saveEnrichAttempted();') !== -1, 'the pass still saves what it attempted');
  ok(loop.indexOf('        else scPatchListRows(_batchTouched);\n      }\n      refreshEnrichNotif();') !== -1,
    'and the Albums redraw goes through the same waiting scheduler');
}

console.log('[4] the two record taps draw their own list at once');
{
  ok(has('  function scRenderListNow(){'), 'there is one way to draw outright');
  const now = sliceC('  function scRenderListNow(){', '  function scRenderListTick(){');
  ok(now !== '', 'and it is its own function');
  ok(now.indexOf('cancelAnimationFrame(_renderListRAF)') !== -1, 'it takes a pending frame over');
  ok(now.indexOf('scRenderListDraw();') !== -1, 'and draws in the same task, without waiting for anything');
  const jump = sliceC('  function jumpToPlayingSong(t){', '  window.__scJumpToPlayingSong = jumpToPlayingSong;');
  ok(jump !== '', 'the song jump is still one function');
  ok(jump.indexOf("navigate('playlists');") !== -1 && jump.indexOf('scRenderListNow();') !== -1 &&
    jump.indexOf("navigate('playlists');") < jump.indexOf('scRenderListNow();'),
    'it draws its own list right after it navigates');
  ok(jump.indexOf('requestAnimationFrame(function(){') !== -1 && jump.indexOf('smoothScrollIn(pane, row);') !== -1,
    'and then measures the playing row on the second frame');
  const album = sliceC('  function openAlbumForCurrentSong(){', '  window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;');
  ok(album !== '', 'the album jump is still one function');
  ok(album.indexOf("navigate('albums');") !== -1 && album.indexOf('scRenderListNow();') !== -1 &&
    album.indexOf("navigate('albums');") < album.indexOf('scRenderListNow();'),
    'and it draws its own cards right after it navigates');
  ok(countC('scRenderListNow();') === 3, 'and the only other caller is the one that files a song (' + countC('scRenderListNow();') + ')');
  ok(sliceC('  function scAddConvertedToLibrary(blob, meta, opts){', '  function scOpenLibraryAfterDownload(').indexOf('scRenderListNow();') !== -1,
    'which draws the new row itself rather than waiting for the scheduler');
  ok(!has('    if(scListIsMoving() && Date.now() - Date.now()'), 'the guard is never asked to ignore itself');
}

console.log('[5] the list stops being rebuilt while it is scrolled, driven on the real app');
{
  let out = '', code0 = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/listredraw-66431-check.cjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code0 = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  ok(code0 === 0, 'dev/listredraw-66431-check drives the real app: ' + (out.trim().split('\n').pop() || '(no output)'));
  ok(/All 23 checks passed/.test(out), 'and every one of its checks passed');
  ok(/and it built no rows at all to do it/.test(out),
    'a metadata pass that changed every song built no rows while the list was on screen');
  ok(/the change went into the row that was already on screen/.test(out),
    'the change landed in the row the list had already made');
  ok(/the list is not rebuilt while it is still gliding/.test(out),
    'a rebuild asked for mid-glide waits for the glide');
  ok(/the rebuild is held while the list is moving under the finger/.test(out),
    'and one asked for mid-scroll waits for the finger');
  ok(/the tap draws its own list at once, even with the list still moving/.test(out),
    'while the record tap is never made to wait');
}

console.log('[6] what 64.3, 64.2.9, 64.2.8 and 64.2.7 shipped is still standing');
{
  // 64.3 - each library half keeps its own place, and a render takes the wish.
  ok(has('    const wantPlayingJump = renderListInner._scrollToPlaying === true;') &&
    has('    renderListInner._scrollToPlaying = false;'), 'a render still takes the one-shot wish and clears it');
  ok(countC('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1,
    'the Playlists half still restores its own offset unless it landed on the song');
  ok(countC('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,
    'and the Albums half always restores its own');
  ok(has("    const _inAlbums = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');"),
    'and the record tap still settles which half it belongs in first');
  // 64.2.9 - the update installs itself on launch, and the backdrop is translate-only.
  ok(ota.indexOf('checkForUpdate({ silent: true, auto: true })') !== -1, 'the boot check still installs the update by itself');
  ok(ota.indexOf('async function autoInstall(Updater, man, o){') !== -1, 'through the one automatic install path');
  const drift = slice('@keyframes sd-dyn-drift{', '@keyframes sd-glow-pulse{');
  ok(drift !== '' && !/scale\(|rotate\(/.test(drift), 'and no backdrop keyframe animates a scale or a rotation');
  ok(count('animation: sd-dyn-drift ') === 13, 'with all thirteen dynamic themes still drifting');
  // 64.2.8 - the media-player line is out of Things to know about SideCut.
  const list = slice('<!-- Collapsible: Things to know about SideCut -->', '<div id="settingsPaneSandbox"');
  ok(list !== '' && list.split('style="color:var(--coral); flex-shrink:0;">\u2022</span>').length - 1 === 11,
    'the Things-to-know list still has its eleven bullets');
  ok(list.indexOf("The phone's media player can't open SideCut.") === -1, 'with the media-player line still gone');
  // 64.2.7 - no colour filter is animated on the backdrop, and the island watches
  // its own scroller.
  ok(!has('@keyframes sd-dyn-hue{'), 'the backdrop still animates no colour filter');
  ok(has('    var onRailScroll = function(){'), 'the rail settle is still named once');
  ok(has("    if(rl) rl.addEventListener('scroll', onRailScroll, { passive: true });"),
    'and the island still asks for a repair on its own scroller');
  // The two mentions left in the file are block comments explaining what was
  // removed; what matters is that nothing is animated with it any more.
  ok(count('animation: sd-dyn-drift ') === 13 && !has('@keyframes sd-dyn-hue{') && !has('animation: sd-dyn-hue'),
    'and the drift is the only backdrop animation left');
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
  let dom0 = 0, domOut = '';
  try {
    domOut = execFileSync(process.execPath, [path.join(ROOT, 'dev/check-dom.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    dom0 = e.status === undefined ? 1 : e.status;
    domOut = String((e.stdout || '') + (e.stderr || ''));
  }
  ok(dom0 === 0, 'the document still closes every element: ' + (domOut.trim().split('\n').pop() || '(no output)'));
  ok(count('id="listPane"') === 1 && count('id="homeBubbles"') === 1, 'the list pane and the Home grid are still there');
  ok(count('  const CHANGELOG = [') === 1, 'and the changelog is still one array');
  ok(new RegExp("const APP_VERSION = '" + String(PAGEVER).replace(/\./g, '\\.') + "';").test(src), 'and the app runs as the version the page declares (' + PAGEVER + ')');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
