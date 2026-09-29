// SideCut - 64.3.1: the list you are scrolling stops being rebuilt underneath
// you, and a background pass updates the rows it changed instead of all of them.
//
// Asked for: "The scrolling still needs to be smooth it's smooth for like 2
// seconds then gets clunky for the record player when you tap on it".
//
// This is the third release to answer a report about the list's roughness, and
// the first two changed the WRONG half of it: 64.2.5 removed a cancel-and-restart
// in the glide that lands on the playing song, and 64.2.9/64.2.7 took the last
// per-frame work a dynamic theme did out of the backdrop. Both were real, and
// neither one is what the user feels, because the roughness is not in the glide -
// it is in the list the glide is moving through.
//
//   [A] A BACKGROUND PASS WAS EMPTYING AND REBUILDING THE WHOLE LIBRARY LIST.
//       runAutoEnrich() runs 2.5 seconds after the library loads (every launch -
//       boot code, line ~27953) and fills in missing covers and artist names. It
//       walks the songs in batches of twenty, and EVERY BATCH ENDED WITH A PLAIN
//       renderList().
//
//       renderList() is not a patch-up: renderListInner() starts with
//       pane.innerHTML = '' and builds every row again - a row element, its
//       inline album art, its kebab SVG and its event listeners, per song, for a
//       library that can be hundreds of songs deep. Done while the list is being
//       scrolled (or glided to the playing song after a record tap), that is the
//       worst possible moment: the rows under the finger become new elements,
//       the newly built ones are rastered for the first time, and the browser
//       re-measures a list of hundreds of rows - in the same frames the scroll
//       needs. "Smooth for a moment, then clunky" is exactly that shape, and
//       2.5 seconds after launch is exactly when it starts.
//
//       Measured (dev/listredraw-66431-check.cjs, the real app, sixty songs that
//       need metadata): the pass built 61 rows again on its own. After A+B it
//       builds none.
//
//   [B] SO THE PASS NOW UPDATES ROWS INSTEAD OF REBUILDING THEM. A batch knows
//       which songs it changed (applyEnrichment / fetchCoverForTrack report it),
//       and scPatchListRows() writes the new art and the new artist/album text
//       into the rows that are ALREADY on screen - the .track-art background and
//       the two lines under it, which is the whole of what a cover or an artist
//       read can change. Rows that are not on screen cost nothing (they will be
//       built with the new data when they are), and nothing else in the pane is
//       touched at all.
//
//       The Albums half still asks for a redraw, because there a song lives
//       inside an album card that carries a cover of its own - and that redraw
//       goes through (C), so it waits for the list to be still.
//
//   [C] AND NO REDRAW LANDS WHILE THE LIST IS MOVING. renderList() no longer
//       draws in its next animation frame unconditionally: while the list is
//       moving it re-arms for the next frame and looks again. "Moving" is the
//       pane's own two signals - a glide in flight (the shared engine leaves its
//       animator on the container, and yields to a touch the moment one lands)
//       or a scroll event in the last SC_LIST_MOVING_MS, stamped by the pane's
//       own scroll handler (element scroll events do not bubble). It is never
//       held longer than SC_LIST_STILL_MAX, so a list being scrolled for a long
//       time still catches up, and a list that is not moving draws in the same
//       frame it always did.
//
//       The two record taps are the exception, and they say so: they navigate,
//       wait two frames and then MEASURE the playing row's position, so
//       jumpToPlayingSong() and openAlbumForCurrentSong() call scRenderListNow()
//       and are handed a drawn pane. Deferring those would have turned a tap into
//       "your song is in your library" instead of a glide.
//
//   node dev/patch-66431.mjs
//   node dev/patch-66431.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. Prose and JS literals that need a glyph get the real character,
// built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use

const VER = '64.3.1';
const OLD_VER = '64.3';
// Eastern is UTC minus four and the DATE moves back with it: the sandbox has no
// tzdata, and reading the UTC clock without rolling the date is exactly what put
// 64.2.4 and 64.2.5 a day ahead of themselves (fixed in 64.3).
const STAMP = 'September 28, 2026 ' + DOT + ' 6:45 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 5:50 PM EDT';
const SW_CACHE = '63.0.29';
const OLD_SW_CACHE = '63.0.28';

const TITLE = 'The list stops being rebuilt while you are scrolling it';

// The six notes. The words dev/test-66425.mjs, dev/test-66426.mjs, dev/test-66428.mjs
// and dev/test-66429.mjs read the HEAD entry for ride along in the notes that are
// actually about them (rollback, blank, list, record): 64.3.1 is not made to carry
// another release's words, and the head title is still free of "pass".
const NOTES = [
  'The list is not rebuilt while you are scrolling it any more. A redraw empties the whole list and builds every row again, and the background pass that fills in missing covers and artist names used to ask for one every twenty songs.',
  'That pass now updates only the rows it really changed, and only the ones on screen. The album cards still redraw, because a card carries a cover of its own, and that redraw waits for the list to be still like any other.',
  'A redraw a background job asks for waits for the list to be still. If it is moving - your finger, or the glide that lands on the playing song after you tap the record player - it is held to the next still moment, and never for more than a second and a bit.',
  'Tapping the record player is never made to wait. That tap draws its own list at once, because it measures the playing row two frames later and has to be handed a finished list rather than one that is still waiting its turn.',
  'The redraw itself is unchanged: same rows, same order, same art, and your scroll position still put back where it was. Only when it is allowed to happen changed, so nothing you are looking at is thrown away and built again while you move through it.',
  'Nothing else moved: the blank-paint repairs on Home and the pinned artists island, the update installing itself on launch and every saved rollback copy behave as they did. This is 64.3.1, a fix on 64.3.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66431 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let edits = 0;
let cur = null, curRel = null;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };
function load(rel) { curRel = rel; cur = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function save() { fs.writeFileSync(path.join(ROOT, curRel), cur); }

// Replace every occurrence of an exact needle. A removal (newStr === '') with no
// marker is idempotent on "there is nothing left to remove".
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && cur.indexOf(m) !== -1) return skip(label);
  const got = cur.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (newStr === '' && marker === undefined && got === 0) return skip(label);
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  cur = cur.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// A - the list is not rebuilt while it is moving
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');

// The state and the test, next to the two flags the scheduler already keeps.
sub('the pane can say whether the list is moving',
  '  var _renderListRAF = null;\n' +
  '  var _renderListPending = false;\n',
  '  var _renderListRAF = null;\n' +
  '  var _renderListPending = false;\n' +
  '  // -- The list is not rebuilt while it is moving --------------------------\n' +
  '  // A rebuild EMPTIES the pane and builds every row again (renderListInner\n' +
  '  // starts with pane.innerHTML = \'\'), so the moment it happens matters as much\n' +
  '  // as the work itself. While the list is being scrolled - a finger, or the\n' +
  '  // glide that lands on the playing song - that moment is the worst one there\n' +
  '  // is: the rows under the finger become new elements, every one of them is\n' +
  '  // rastered for the first time, and the list is measured again, in the same\n' +
  '  // frames the scroll needs. Background work (a metadata read, a cover, a\n' +
  '  // playback repaint) asks for a rebuild whenever it likes, so the rebuild now\n' +
  '  // waits for the list to be still - and never longer than SC_LIST_STILL_MAX,\n' +
  '  // so a list that is being scrolled for a long time still catches up.\n' +
  '  //\n' +
  '  // "Moving" is the pane\'s own two signals: a glide in flight (the shared\n' +
  '  // engine leaves its animator on the container, and hands control back the\n' +
  '  // instant a touch lands) or a scroll event in the last SC_LIST_MOVING_MS.\n' +
  '  // Element scroll events do not bubble, which is why the stamp is written by\n' +
  '  // the pane\'s own scroll handler. (64.3.1)\n' +
  '  var SC_LIST_MOVING_MS = 120;\n' +
  '  var SC_LIST_STILL_MAX = 1200;\n' +
  '  var _scListScrollAt = 0;\n' +
  '  var _renderListWaitFrom = 0;\n' +
  '  function scListIsMoving(){\n' +
  '    try{\n' +
  '      var pane = $(\'listPane\');\n' +
  '      if(!pane) return false;\n' +
  '      if(pane.__scScrollAnim) return true;                        // a glide is in flight\n' +
  '      return (Date.now() - _scListScrollAt) < SC_LIST_MOVING_MS;  // the finger\n' +
  '    }catch(_e){ return false; }\n' +
  '  }\n' +
  '  // Reachable from a probe: dev/listredraw-66431-check.cjs drives the real app\n' +
  '  // and reads this instead of inferring a scroll from the pane.\n' +
  '  window.__scListMoving = scListIsMoving;\n');

sub('renderList hands the draw to the scheduler',
  '  function renderList(){\n' +
  '    // Debounce: coalesce rapid renderList calls (from metadata loads,\n' +
  '    // playback updates, etc.) into a single rAF to reduce DOM thrashing\n' +
  '    _renderListPending = true;\n' +
  '    if(_renderListRAF) return;\n' +
  '    _renderListRAF = requestAnimationFrame(function(){\n' +
  '      _renderListRAF = null;\n' +
  '      if(!_renderListPending) return;\n' +
  '      _renderListPending = false;\n' +
  '      try{\n' +
  '        var _scListT = scNow();\n' +
  '        renderListInner();\n' +
  '        if(!window.__scListTimed){\n' +
  '          window.__scListTimed = true;\n' +
  '          var _scPane = document.getElementById(\'listPane\');\n' +
  '          scBootLastList = Math.round(scNow() - _scListT) + \' ms, \' + (_scPane ? _scPane.children.length : 0) + \' rows\';\n' +
  '          scBootT(\'list: first render (opening Library, not boot)\', scBootLastList);\n' +
  '          scBootPersist();\n' +
  '        }\n' +
  '      }\n' +
  '      catch(e){\n' +
  '        console.error(\'renderList failed\', e);\n' +
  '      }\n' +
  '    });\n' +
  '  }\n',
  '  function renderList(){\n' +
  '    // Debounce: coalesce rapid renderList calls (from metadata loads,\n' +
  '    // playback updates, etc.) into a single rAF to reduce DOM thrashing\n' +
  '    _renderListPending = true;\n' +
  '    if(!_renderListWaitFrom) _renderListWaitFrom = Date.now();\n' +
  '    scRenderListTick();\n' +
  '  }\n' +
  '  // Draw the list now, whatever the list is doing. The two record taps ask for\n' +
  '  // this: they navigate, wait two frames and then measure the playing row\'s\n' +
  '  // position, so they have to be handed a drawn pane rather than one that is\n' +
  '  // waiting for a scroll to settle. Everything else goes through renderList()\n' +
  '  // and waits its turn. (64.3.1)\n' +
  '  function scRenderListNow(){\n' +
  '    if(_renderListRAF){ cancelAnimationFrame(_renderListRAF); _renderListRAF = null; }\n' +
  '    if(!_renderListPending){ _renderListWaitFrom = 0; return; }\n' +
  '    _renderListPending = false;\n' +
  '    _renderListWaitFrom = 0;\n' +
  '    scRenderListDraw();\n' +
  '  }\n' +
  '  // One scheduled rebuild. While the list is moving the tick re-arms itself for\n' +
  '  // the next frame instead of drawing; the wait it has already served is kept in\n' +
  '  // _renderListWaitFrom, so the cap holds across any number of frames.\n' +
  '  function scRenderListTick(){\n' +
  '    if(_renderListRAF) return;\n' +
  '    _renderListRAF = requestAnimationFrame(function(){\n' +
  '      _renderListRAF = null;\n' +
  '      if(!_renderListPending){ _renderListWaitFrom = 0; return; }\n' +
  '      if(scListIsMoving() && (Date.now() - _renderListWaitFrom) < SC_LIST_STILL_MAX){\n' +
  '        scRenderListTick();\n' +
  '        return;\n' +
  '      }\n' +
  '      _renderListPending = false;\n' +
  '      _renderListWaitFrom = 0;\n' +
  '      scRenderListDraw();\n' +
  '    });\n' +
  '  }\n' +
  '  function scRenderListDraw(){\n' +
  '    try{\n' +
  '      var _scListT = scNow();\n' +
  '      renderListInner();\n' +
  '      if(!window.__scListTimed){\n' +
  '        window.__scListTimed = true;\n' +
  '        var _scPane = document.getElementById(\'listPane\');\n' +
  '        scBootLastList = Math.round(scNow() - _scListT) + \' ms, \' + (_scPane ? _scPane.children.length : 0) + \' rows\';\n' +
  '        scBootT(\'list: first render (opening Library, not boot)\', scBootLastList);\n' +
  '        scBootPersist();\n' +
  '      }\n' +
  '    }\n' +
  '    catch(e){\n' +
  '      console.error(\'renderList failed\', e);\n' +
  '    }\n' +
  '  }\n');

// The stamp. This is the pane's own scroll handler: it already records the
// position on every event, and it is the only place that knows the list moved.
sub('the pane stamps its own scrolls',
  '  $(\'listPane\').addEventListener(\'scroll\', () => {\n' +
  '    lastScrollTop = $(\'listPane\').scrollTop;\n' +
  '  });\n',
  '  $(\'listPane\').addEventListener(\'scroll\', () => {\n' +
  '    lastScrollTop = $(\'listPane\').scrollTop;\n' +
  '    // A rebuild asked for while the list is moving waits (see scListIsMoving).\n' +
  '    // Element scroll events do not bubble, so this stamp - written by the\n' +
  '    // pane\'s own handler - is what tells the scheduler the finger is busy.\n' +
  '    _scListScrollAt = Date.now();\n' +
  '  });\n');

// ═══════════════════════════════════════════════════════════════════════════
// B - a background batch updates the rows it changed
// ═══════════════════════════════════════════════════════════════════════════
sub('rows a background pass changed are updated where they stand',
  '  window.__scLibScroll = scLibScroll;\n',
  '  window.__scLibScroll = scLibScroll;\n' +
  '  // The rows a background pass actually changed, updated where they stand.\n' +
  '  // A rebuild is not needed for this: a row\'s art and its two lines of text are\n' +
  '  // the whole of what a cover or an artist read can change. Twenty rows touched\n' +
  '  // in place costs nothing next to emptying a list of hundreds and building it\n' +
  '  // again - which is what every metadata batch used to do, once per batch, while\n' +
  '  // the user was scrolling through it. Rows that are not on screen are skipped:\n' +
  '  // they are built with this data already in them, the next time they are.\n' +
  '  // (64.3.1)\n' +
  '  function scPatchListRows(ids){\n' +
  '    var pane = $(\'listPane\');\n' +
  '    if(!pane || !ids || !ids.length) return 0;\n' +
  '    var touched = 0;\n' +
  '    for(var i = 0; i < ids.length; i++){\n' +
  '      var t = allTracks.find(function(tr){ return tr.id === ids[i]; });\n' +
  '      if(!t) continue;\n' +
  '      var rows = null;\n' +
  '      try{ rows = pane.querySelectorAll(\'.track[data-id="\' + ids[i] + \'"]\'); }catch(_eQ){ rows = null; }\n' +
  '      if(!rows) continue;\n' +
  '      for(var r = 0; r < rows.length; r++){\n' +
  '        var row = rows[r];\n' +
  '        try{\n' +
  '          var art = row.querySelector(\'.track-art\');\n' +
  '          if(art && t.artUrl && !art.style.backgroundImage) art.style.backgroundImage = \'url("\' + t.artUrl + \'")\';\n' +
  '          var nameEl = row.querySelector(\'.track-info .t\');\n' +
  '          if(nameEl && t.name && nameEl.textContent !== t.name) nameEl.textContent = t.name;\n' +
  '          var artistEl = row.querySelector(\'.track-info .a\');\n' +
  '          if(artistEl && t.artist && artistEl.textContent !== t.artist) artistEl.textContent = t.artist;\n' +
  '          touched++;\n' +
  '        }catch(_eRow){}\n' +
  '      }\n' +
  '    }\n' +
  '    return touched;\n' +
  '  }\n' +
  '  // Reachable from a probe, like the two jumps and the focus record are.\n' +
  '  window.__scPatchListRows = scPatchListRows;\n');

// The batch loop: remember what it changed, then touch those rows only.
sub('a batch remembers which songs it changed',
  '      for(let j=0;j<chunk.length;j++){\n' +
  '        const t = chunk[j], r = results[j];\n' +
  '        enrichAttemptedIds.add(t.id);\n',
  '      const _batchTouched = [];\n' +
  '      for(let j=0;j<chunk.length;j++){\n' +
  '        const t = chunk[j], r = results[j];\n' +
  '        enrichAttemptedIds.add(t.id);\n');

sub('and counts a song as touched only when something was written',
  '        if(updated) enrichState.updated++;\n' +
  '        enrichState.done++;\n',
  '        if(updated){ enrichState.updated++; _batchTouched.push(t.id); }\n' +
  '        enrichState.done++;\n');

sub('the batch draws no rows of its own',
  '      saveEnrichAttempted();\n' +
  '      renderList();\n' +
  '      refreshEnrichNotif();\n',
  '      saveEnrichAttempted();\n' +
  '      // Only what this batch actually changed, and only in the half that shows\n' +
  '      // rows. This was a plain renderList(): a full rebuild of every row in the\n' +
  '      // library, once per twenty songs, for a pass that runs in the background -\n' +
  '      // which is a pane emptied and rebuilt under the finger of whoever happened\n' +
  '      // to be scrolling it at the time. The Albums half shows a song inside an\n' +
  '      // album card with a cover of its own, so it still asks for a redraw - and\n' +
  '      // that redraw waits for the list to be still (see scListIsMoving).\n' +
  '      if(_batchTouched.length){\n' +
  '        if(scLibHalfName() === \'albums\') renderList();\n' +
  '        else scPatchListRows(_batchTouched);\n' +
  '      }\n' +
  '      refreshEnrichNotif();\n');

// ═══════════════════════════════════════════════════════════════════════════
// C - the two record taps are never made to wait
// ═══════════════════════════════════════════════════════════════════════════
sub('the song jump draws its own list at once',
  '      renderListInner._scrollToPlaying = false;\n' +
  '      navigate(\'playlists\');\n',
  '      renderListInner._scrollToPlaying = false;\n' +
  '      navigate(\'playlists\');\n' +
  '      // This tap owns the next two frames: it measures the playing row\'s\n' +
  '      // position on the second one and then glides to it, so it is handed a\n' +
  '      // drawn list instead of one that is waiting for a scroll to settle.\n' +
  '      // (64.3.1)\n' +
  '      scRenderListNow();\n');

sub('the album jump draws its own list at once',
  '    const wanted = t.id;\n' +
  '    navigate(\'albums\');\n',
  '    const wanted = t.id;\n' +
  '    navigate(\'albums\');\n' +
  '    // Same reason as the song jump above: the tap then looks for the album card\n' +
  '    // and expands it, so the cards have to be there. (64.3.1)\n' +
  '    scRenderListNow();\n');

// ═══════════════════════════════════════════════════════════════════════════
// A, B and C are one tree, and D reads index.html from disk again before it
// writes the release in - so what they changed has to be on disk by this line.
save();

// ══════════════════════════════════════════════════════════════════════════
// D - the release itself
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');
if (cur.indexOf(`  const APP_VERSION = '` + VER + `';`) !== -1) skip('APP_VERSION is ' + VER);
else {
  if (cur.indexOf(`  const APP_VERSION = '` + OLD_VER + `';`) === -1) throw new Error('APP_VERSION was not ' + OLD_VER);
  cur = cur.split(`  const APP_VERSION = '` + OLD_VER + `';`).join(`  const APP_VERSION = '` + VER + `';`);
  done('APP_VERSION is ' + VER);
}

// NOTES holds the DECODED text, so an apostrophe has to be re-escaped on the way
// into a single-quoted CHANGELOG string - otherwise the array stops parsing (the
// lesson of 64.2.8, AGENTS.md point 3).
const esc = (n) => n.split("'").join("\\'");
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + esc(n) + `',`).join('') + `\n  ] },\n`;
if (cur.indexOf(`  { version: '` + VER + `', date: '`) !== -1) skip('the head changelog entry is ' + VER);
else {
  if (cur.indexOf(`  const CHANGELOG = [\n`) === -1) throw new Error('the CHANGELOG opener was not found');
  cur = cur.split(`  const CHANGELOG = [\n`).join(`  const CHANGELOG = [\n` + HEAD_NEW);
  done('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes');
}
// The first run of this patch wrote the opening note ten characters over the 260
// both channels hold a note to, which is the same first-run overshoot
// dev/patch-66427.mjs owns for its own note. The script owns the shortened form,
// so a rerun lands on the entry the gate describes without hand-editing the page.
sub('the opening note fits the length both channels hold a note to',
  'Scrolling the library stays smooth now. The background pass that fills in missing covers and artist names used to redraw the whole list once per twenty songs, and a redraw empties that list and builds every row again - right under the finger of whoever was scrolling it.',
  'The list is not rebuilt while you are scrolling it any more. A redraw empties the whole list and builds every row again, and the background pass that fills in missing covers and artist names used to ask for one every twenty songs.');
fs.writeFileSync(FILE, cur);

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
load('sw.js');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (cur.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (cur.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  cur = cur.split(SW_OLD).join(SW_NEW);
  done('the service worker cache moves on ' + SW_CACHE);
}
save();

// ═══════════════════════════════════════════════════════════════════════════
// E - the gate written for 64.3 moves with it
// ═══════════════════════════════════════════════════════════════════════════
// Same rule as every release since 64.2.3. Neither edit adds or removes a check.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [label, oldStr, newStr, marker] of pairs) {
    const m = marker === undefined ? newStr : marker;
    if (m !== '' && s.indexOf(m) !== -1) { skip(rel + ': ' + label); continue; }
    const got = s.split(oldStr).length - 1;
    if (newStr === '' && marker === undefined && got === 0) { skip(rel + ': ' + label); continue; }
    if (got !== 1) throw new Error(rel + ' - ' + label + ': found ' + got + ' occurrence(s), want 1');
    s = s.split(oldStr).join(newStr);
    done(rel + ': ' + label);
  }
  fs.writeFileSync(p, s);
}

// dev/test-6643.mjs is the newest gate, so the repin sweep leaves it reading the
// HEAD entry - and the entry it describes is its own. Its release-specific words
// belong to 64.3, so it reads them from the 64.3 entry by version now, the same
// move dev/test-66427.mjs, dev/test-66428.mjs and dev/test-66429.mjs got. The
// general wording rules stay on the head entry, where every release has to keep
// them; that is the contract, and it does not move.
fileSub('dev/test-6643.mjs', [
  ['its own release\'s words are read from its own entry',
    `  if (entries) {\n` +
    `    const head = entries[0];\n` +
    `    const items = head.items || [];\n` +
    `    ok(String(head.version) === VER, 'the head entry is v' + head.version);\n`,
    `  if (entries) {\n` +
    `    // What THIS gate is about is its own release, read by version - the rule\n` +
    `    // dev/test-66423.mjs, dev/test-66424.mjs, dev/test-66427.mjs,\n` +
    `    // dev/test-66428.mjs and dev/test-66429.mjs already follow. The general\n` +
    `    // wording rules below still run against the head entry, because every\n` +
    `    // release has to keep them.\n` +
    `    const entry643 = entries.find((e) => /^64\\\\.3$/.test(String(e.version))) || {};\n` +
    `    const head = entry643;\n` +
    `    const items = head.items || [];\n` +
    `    ok(String(head.version) === VER, 'the entry this gate describes is v' + head.version);\n`,
    // The marker is the form the SECOND pass below lands on, because that pass
    // rewrites the find this one writes.
    `    const entry643 = entries.find((e) => String(e.version) === OWNVER) || {};`],
  // The gate's needle is a regex LITERAL, so its backslash is built by
  // concatenation here (the way the version pins above are), instead of being
  // carried through this file's own escapes.
  ['the app runs as this release',
    "  ok(/const APP_VERSION = '64" + "\\.3';/.test(src), 'and the app runs as 64.3');",
    "  ok(/const APP_VERSION = '64" + "\\.3\\.1';/.test(src), 'and the app runs as 64.3.1');"],
]);

// The same gate, moved onto this release's numbers: it describes 64.3 while the
// build on the page is 64.3.1, so the two are named apart (OWNVER), and the pins
// that name the release it describes move with it. Test-6643 is skipped by the
// sweep below (its VER has to stay its own release), so its pins are here.
fileSub('dev/test-6643.mjs', [
  ['the release it describes is named apart from the build on the page',
    "const VER = '64.3';\nconst PREV = '64.2.9';\n",
    "const VER = '64.3.1';\nconst PREV = '64.2.9';\n// This gate describes 64.3 - the release it was written for - while VER is the\n// build on the page, so the two are named apart (64.3.1).\nconst OWNVER = '64.3';\n"],
  ['its own entry is found by that name',
    '    const entry643 = entries.find((e) => /^64',
    '    const entry643 = entries.find((e) => String(e.version) === OWNVER) || {}; /* /^64'],
  ['and the find reads that plainly, with no escape in the way',
    '.test(String(e.version))) || {};\n    const head = entry643;',
    '*/\n    const head = entry643;'],
  ['the entry check reads the same name',
    "ok(String(head.version) === VER, 'the entry this gate describes is v' + head.version)",
    "ok(String(head.version) === OWNVER, 'the entry this gate describes is v' + head.version)"],
  ['and the cache it pins moves on with the shell',
    "ok(swCache === 'sidecut-shell-v63.0.28',",
    "ok(swCache === 'sidecut-shell-v63.0.29',"],
]);

// ═══════════════════════════════════════════════════════════════════════════
// F - the version and stamp pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  ["const PREV = '" + OLD_VER + "';", "const PREV = '" + VER + "';"],
  [OLD_VER + ' heads the changelog', VER + ' heads the changelog'],
  // The head stamp, pinned exactly by the newest gate.
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["'5:50 PM'", "'6:45 PM'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
  // A gate that reads the cache name out of sw.js and compares it to a bare
  // string, with no CACHE_NAME in front of it.
  ["'sidecut-shell-v" + OLD_SW_CACHE + "'", "'sidecut-shell-v" + SW_CACHE + "'"],
];
// test-6643 names its own release apart from the build on the page, and
// test-66431 pins 64.3's ship stamp as "not this one", so neither takes the sweep.
const SKIP = new Set(['test-655.mjs', 'test-656.mjs', 'test-6643.mjs', 'test-66431.mjs']);
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
console.log('patch-66431: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const count = (needle) => final.split(needle).length - 1;
// Comments describe the code the "is it gone" checks look for, so those run over
// the code only - the same strip dev/test-6058.mjs uses.
const code = final.replace(/^\s*\/\/.*$/gm, '');
const countC = (needle) => code.split(needle).length - 1;
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

// 1 - the list is not rebuilt while it is moving
{
  must(has('  function scListIsMoving(){'), 'the pane can say whether the list is moving');
  must(has('      if(pane.__scScrollAnim) return true;'), 'which asks the shared engine whether a glide is in flight');
  must(has('      return (Date.now() - _scListScrollAt) < SC_LIST_MOVING_MS;'), 'and whether the finger moved it just now');
  must(has('    _scListScrollAt = Date.now();'), 'the stamp is written by the pane\'s own scroll handler');
  must(countC('_scListScrollAt = Date.now();') === 1, 'in exactly one place');
  must(has('  window.__scListMoving = scListIsMoving;'), 'and it is reachable from a probe');
  must(has('  var SC_LIST_MOVING_MS = 120;') && has('  var SC_LIST_STILL_MAX = 1200;'),
    'both windows are named constants');
  const tick = sliceC('  function scRenderListTick(){', '  function scRenderListDraw(){');
  must(tick !== '', 'the scheduler is still on the page');
  must(tick.indexOf('if(scListIsMoving() && (Date.now() - _renderListWaitFrom) < SC_LIST_STILL_MAX){') !== -1,
    'and a draw is held while the list is moving');
  must(tick.indexOf('        scRenderListTick();\n        return;') !== -1, 'by re-arming for the next frame');
  must(tick.indexOf('scRenderListDraw();') !== -1, 'with the draw itself factored out');
  const now = sliceC('  function scRenderListNow(){', '  function scRenderListTick(){');
  must(now !== '', 'the two record taps have their own way to draw at once');
  must(now.indexOf('cancelAnimationFrame(_renderListRAF)') !== -1, 'which takes the pending frame over');
  must(now.indexOf('scRenderListDraw();') !== -1, 'and draws in the same task');
  const rl = sliceC('  function renderList(){', '  function scRenderListNow(){');
  must(rl.indexOf('if(!_renderListWaitFrom) _renderListWaitFrom = Date.now();') !== -1,
    'a render request starts the wait clock once');
  must(rl.indexOf('scRenderListTick();') !== -1, 'and is handed to the scheduler');
  must(countC('_renderListRAF = requestAnimationFrame(') === 1, 'exactly one place schedules a frame ('
    + countC('_renderListRAF = requestAnimationFrame(') + ')');
}

// 2 - a background batch updates the rows it changed
{
  must(has('  function scPatchListRows(ids){'), 'a row can be updated where it stands');
  must(has("    var pane = $('listPane');") && has("      try{ rows = pane.querySelectorAll('.track[data-id=\"' + ids[i] + '\"]'); }catch(_eQ){ rows = null; }"),
    'the patch looks for that song\'s row in the pane');
  must(has("art.style.backgroundImage = 'url(\"' + t.artUrl + '\")'"), 'it writes the new art');
  must(has('          if(nameEl && t.name && nameEl.textContent !== t.name) nameEl.textContent = t.name;'),
    'and only rewrites a line that actually changed');
  must(has('          if(artistEl && t.artist && artistEl.textContent !== t.artist) artistEl.textContent = t.artist;'),
    'both lines, and nothing else in the row');
  must(has('  window.__scPatchListRows = scPatchListRows;'), 'and it is reachable from a probe');
  const loop = sliceC('  async function runAutoEnrich(){', '    enrichState.active = false;');
  must(loop !== '', 'the enrichment pass is still on the page');
  must(loop.indexOf('      if(_batchTouched.length){') !== -1, 'a batch acts on what it changed');
  must(loop.indexOf("        if(scLibHalfName() === 'albums') renderList();") !== -1,
    'the Albums half still redraws, because its cards carry their own cover');
  must(loop.indexOf('        else scPatchListRows(_batchTouched);') !== -1,
    'and the rows half is patched in place');
  must(countC('      renderList();\n      refreshEnrichNotif();') === 0,
    'the per-batch rebuild is gone (' + countC('      renderList();\n      refreshEnrichNotif();') + ' left)');
  must(loop.indexOf('_batchTouched.push(t.id)') !== -1, 'and a batch only counts a song it really wrote');
  must(countC('_batchTouched.push(t.id)') === 1, 'exactly once');
  const loopInner = sliceC('      const _batchTouched = [];', '      saveEnrichAttempted();');
  must(loopInner !== '' && loopInner.indexOf('renderList()') === -1 && loopInner.indexOf('scPatchListRows') === -1,
    'nothing inside the per-song loop draws anything');
}

// 3 - the two record taps are never made to wait
{
  const jump = sliceC('  function jumpToPlayingSong(t){', '  window.__scJumpToPlayingSong = jumpToPlayingSong;');
  must(jump !== '', 'the song jump is still one function');
  must(jump.indexOf("navigate('playlists');") !== -1 && jump.indexOf('scRenderListNow();') !== -1 &&
    jump.indexOf("navigate('playlists');") < jump.indexOf('scRenderListNow();'),
    'and it draws its own list before it measures the playing row');
  const album = sliceC('  function openAlbumForCurrentSong(){', '  window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;');
  must(album !== '', 'the album jump is still one function');
  must(album.indexOf("navigate('albums');") !== -1 && album.indexOf('scRenderListNow();') !== -1 &&
    album.indexOf("navigate('albums');") < album.indexOf('scRenderListNow();'),
    'and so does it');
  must(countC('scRenderListNow();') === 2, 'and those two are the only callers ('
    + countC('scRenderListNow();') + ')');
}

// 4 - the release itself, and the wording both channels are held to
{
  must(has(`  const APP_VERSION = '` + VER + `';`), 'APP_VERSION is ' + VER);
  must(count('const APP_VERSION') === 1, 'declared once');
  let entries = null;
  try {
    const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
    entries = eval('[' + block[1] + ']');
  } catch (e) {
    problems.push('the changelog evaluates: ' + e.message);
  }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is ' + VER + ' (' + head.version + ')');
    must(String(head.version) === (final.match(/const APP_VERSION = '([^']+)'/) || [])[1],
      'and matches APP_VERSION');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    const longest = (head.items || []).reduce((n, it) => Math.max(n, it.length), 0);
    must(longest <= 260, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    must(String(head.date).indexOf(DOT) !== -1 && /EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    must(String(head.date) !== OLD_STAMP, 'and it is not ' + OLD_VER + '\'s stamp');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in the entry');
    must(!/play build|play version|play install/i.test(notes), 'and it never names the other build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor a term the wider store list knows');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title carries no "pass" (' + head.title + ')');
    // The words the older gates read the HEAD entry for.
    must(/rollback/i.test(notes), 'the head entry still says what this release left alone (rollback)');
    must(/blank/i.test(notes), 'and names the surface that came back blank (blank)');
    must(/list/i.test(notes) && /record/i.test(notes), 'and both halves of the standing report (list, record)');
    must(String(entries[1] && entries[1].version) === OLD_VER, 'the release before this one is still listed next');
    must(entries.some((e) => /^64\.2\.9$/.test(String(e.version))), 'and the one before that');
  } else {
    problems.push('the CHANGELOG block was not found');
  }
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

// 5 - the gates moved with it, without losing a check
{
  const checksIn = (p) => (fs.readFileSync(path.join(ROOT, p), 'utf8').match(/(^|\n)\s+ok\(/g) || []).length;
  const t43 = fs.readFileSync(path.join(ROOT, 'dev/test-6643.mjs'), 'utf8');
  /* \\\\.3$/.test(String(e.version))) || {};") !== -1,
    'dev/test-6643 reads the release it describes by version'); */
  must(t43.indexOf("const entry643 = entries.find((e) => String(e.version) === OWNVER) || {};") !== -1,
    'and its own entry is found by the name it is given');
  must(t43.indexOf("const head = entries[0];") === -1, 'and no longer takes the head entry for its own');
  must(t43.indexOf("and the app runs as 64.3.1") !== -1, 'and it is repinned to this release');
  must(checksIn('dev/test-6643.mjs') === 80, 'dev/test-6643 still declares its 80 checks (' + checksIn('dev/test-6643.mjs') + ')');
  must(checksIn('dev/test-66429.mjs') === 83, 'dev/test-66429 still declares its 83 checks (' + checksIn('dev/test-66429.mjs') + ')');
  const t52 = fs.readFileSync(path.join(ROOT, 'dev/test-6052.mjs'), 'utf8');
  must(t52.indexOf("'" + STAMP + "'") !== -1, 'and dev/test-6052 pins the ship stamp itself');
}

if (problems.length) {
  console.error('\npatch-66431: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66431: all verification checks passed (' + edits + ' edit(s))');
