#!/usr/bin/env node
// SideCut — the Album History edit button opens where you can see it, and the
// wrong dates on old albums stop being invented.
//
// The user's words: "The edit button doesn't work and I'm getting wrong dates
// for some albums" (screenshot: Diljit Dosanjh in 📀 Album History, "Dil" shown
// as 2008-04-24 with no cover and no track count, "Ishq Ho Gaya" 2008-04-24,
// "Smile" 2005-09-04, "Ishq Da Uda Ada" 2003-02-09).
//
// ---- 1. The edit button: it worked, but it opened off-screen ---------------
// The pencil inserted its form with `body.insertAdjacentHTML('afterbegin', …)`
// where `body` is `#discPopupBody` — and `#discPopupBody{flex:1;overflow-y:auto}`
// is the SCROLL CONTAINER (index.html ~1906). On a 60-album list scrolled to the
// middle (exactly the screenshot) the form was inserted at the very top of the
// scrollable content, far above the visible area: tapping ✏️ did nothing you
// could see, while the × next to it worked because ITS confirmation is a
// position:fixed popup. The form is now a fixed sheet at the bottom of the
// screen, in the same shape as the × confirmation and the Add-a-drop sheet, plus
// a backdrop that dismisses it. Saving with no album id, or with nothing typed,
// now says so instead of closing and reporting "Album updated".
// Its date field was also fed `(releaseDate||'').slice(0,10)`, which for a
// year-only date (what MusicBrainz gives an old album, e.g. "2004") is not a
// value `<input type="date">` accepts — the field came up blank. A real day is
// prefilled; a year is shown as a hint instead.
// The pencil's own data-date/data-tracks now carry what the row DISPLAYS
// (song/date edits included), not the raw catalog values, so reopening it shows
// the date you set rather than the one it replaced.
//
// ---- 2. The wrong dates: the AI lookup invented days -----------------------
// `_aiGeminiKey`'s discography pass asks the model for
// `{"title":…,"date":"YYYY-MM-DD",…}` and stores that date verbatim on a row with
// no cover and no track count — the three tells of the old rows in the
// screenshot. A model asked for a day on a 2004 album answers with a confident
// day it cannot know, which is how an album got a date that belongs to another
// release ("Dil" wearing "Ishq Ho Gaya"'s 2008-04-24). Measured: MusicBrainz has
// "Dil" as `2004` (year precision), "Chocolate" as `2008`, and Apple's own
// storefronts disagree by a week on the rest (US/CA 2008-02-01 vs IN 2008-02-08),
// while the AI row was free to invent a day to the second.
//   * It is now asked for a YEAR ("year":2004) and only a four-digit year is
//     kept, so a release date comes from a store or a catalog that has one.
//   * An AI row is only added when the album is unknown by title — of ANY year.
//     The year carve-out meant "we already know this album, under a different
//     year" still produced a second row.
//   * AI rows are keyed by the album (`ai_<artist>_<title>`) instead of by their
//     position in the reply (`ai_<artist>_<index>`). A refetch renumbered every
//     AI row, so a date edit set on one no longer belonged to it — the second
//     half of "the edit button doesn't work".
//
// ---- 3. And a real catalog row now beats an AI row ------------------------
// `_dedupAlbums` keeps the first row per album identity. The AI pass runs last,
// but an AI row already in the cache sits AHEAD of a row a later refetch adds,
// so the guessed row won and the real cover/date/track count was discarded. A
// store or catalog row now replaces an AI row for the same album in place.
//
//   node dev/patch-630.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The edit form is a sheet pinned to the screen, not a block at the top of
//    the list's scroller.
// ---------------------------------------------------------------------------
sub('edit sheet styling',
  `      // Show edit form
      var formHtml = '<div style="padding:12px;border-bottom:1px solid var(--line);margin-bottom:4px;" id="ahEditForm">';`,
  `      // Show edit form. position:fixed — #discPopupBody is the scroller, so a
      // block inserted at its top opened off-screen on a long list, which is
      // exactly what "the edit button doesn't work" looks like.
      var formHtml = '<div id="ahEditForm" style="position:fixed;left:0;right:0;bottom:0;z-index:270;max-width:540px;margin:0 auto;box-sizing:border-box;padding:14px 16px calc(18px + env(safe-area-inset-bottom));background:var(--card,#1a2c33);border-top:1px solid var(--line);border-radius:16px 16px 0 0;box-shadow:0 -8px 30px rgba(0,0,0,0.5);">';`);

sub('edit date field prefill',
  `      formHtml += '<input id="ahEditDate" type="date" value="' + curDate + '" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:12px;margin-bottom:6px;box-sizing:border-box;" />';`,
  `      // A date input only takes a real day. A year-only date (what MusicBrainz
      // gives an old album, e.g. "2004") used to be pushed into it anyway and the
      // field came up empty; it is shown as a hint instead.
      var _curDay = /^\\d{4}-\\d{2}-\\d{2}$/.test(curDate) ? curDate : '';
      formHtml += '<input id="ahEditDate" type="date" value="' + _curDay + '" style="width:100%;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:var(--bg);color:var(--ink);font-size:12px;margin-bottom:6px;box-sizing:border-box;" />';
      formHtml += '<div style="font-size:10.5px;color:var(--ink-dim);margin:-2px 0 6px;line-height:1.4;">' + (_curDay ? 'Saved: pick a different day to change it.' : (curDate ? 'This album is dated ' + curDate + ' today \\u2014 pick a full day to replace it.' : 'No release date is known for this album.')) + '</div>';`);

sub('edit form placement',
  `      var oldForm = document.getElementById('ahEditForm'); if(oldForm) oldForm.remove();
      var body = document.getElementById('discPopupBody');
      if(body){ body.insertAdjacentHTML('afterbegin', formHtml); }`,
  `      var oldForm = document.getElementById('ahEditForm'); if(oldForm) oldForm.remove();
      var oldEditBd = document.getElementById('ahEditBackdrop'); if(oldEditBd) oldEditBd.remove();
      var editBd = document.createElement('div');
      editBd.id = 'ahEditBackdrop';
      editBd.style.cssText = 'position:fixed;inset:0;z-index:265;background:rgba(0,0,0,0.55);';
      editBd.addEventListener('click', function(){
        var f = document.getElementById('ahEditForm'); if(f) f.remove();
        editBd.remove();
      });
      document.body.appendChild(editBd);
      document.body.insertAdjacentHTML('beforeend', formHtml);`);

sub('edit save/cancel wiring',
  `      document.getElementById('ahEditCancel').addEventListener('click', function(){ var f = document.getElementById('ahEditForm'); if(f) f.remove(); });
      document.getElementById('ahEditSave').addEventListener('click', function(){
        var newDate = (document.getElementById('ahEditDate').value||'').trim();
        var newTracks = (document.getElementById('ahEditTracks').value||'').trim();
        if(cid){
          if(newDate) saveAlbumEdit(cid, 'date', newDate);
          if(newTracks) saveAlbumEdit(cid, 'tracks', newTracks);
        }
        var f = document.getElementById('ahEditForm'); if(f) f.remove();
        // Re-render with updated data
        window.__refetchAlbums(false);
        toast('Album updated', 2000);
      });`,
  `      var _closeEdit = function(){
        var f = document.getElementById('ahEditForm'); if(f) f.remove();
        var b = document.getElementById('ahEditBackdrop'); if(b) b.remove();
      };
      var _cancelEditBtn = document.getElementById('ahEditCancel');
      if(_cancelEditBtn) _cancelEditBtn.addEventListener('click', _closeEdit);
      var _saveEditBtn = document.getElementById('ahEditSave');
      if(_saveEditBtn) _saveEditBtn.addEventListener('click', function(){
        var newDate = (document.getElementById('ahEditDate').value||'').trim();
        var newTracks = (document.getElementById('ahEditTracks').value||'').trim();
        // Say what happened. This used to close and toast "Album updated" even
        // when there was no id to save against and nothing was written.
        if(!cid){ _closeEdit(); toast('This album has no id to save against \\u2014 refetch the artist, then edit it.', 3600); return; }
        if(!newDate && !newTracks){ _closeEdit(); toast('Nothing to save.', 2000); return; }
        if(newDate) saveAlbumEdit(cid, 'date', newDate);
        if(newTracks) saveAlbumEdit(cid, 'tracks', newTracks);
        _closeEdit();
        // Re-render with updated data
        window.__refetchAlbums(false);
        toast('Album updated', 2000);
      });`);

sub('pencil carries the shown values',
  ` data-date="'+escapeHtml((ahAlb.releaseDate||'').slice(0,10))+'" data-tracks="'+escapeHtml(String(ahAlb.trackCount||''))+'"`,
  ` data-date="'+escapeHtml(String(_showDate||'').slice(0,10))+'" data-tracks="'+escapeHtml(String(_showTracks||''))+'"`);
// Matched on the two attributes alone: the rest of that very long line carries a
// style attribute that has no business in a needle.

// ---------------------------------------------------------------------------
// 2. The AI discography pass: a year, not an invented day; no duplicate row for
//    an album we already have; an id that survives a refetch.
// ---------------------------------------------------------------------------
sub('AI prompt asks for a year',
  `        var _aiPrompt = 'List every album, EP, soundtrack appearance, and compilation feature by ' + a.name + '. Return ONLY a JSON array (no markdown) where each item has: {"title":"Album Name","date":"YYYY-MM-DD","tracks":12,"type":"album|ep|soundtrack|compilation|live"}. Include deluxe/special editions as separate items. Be as complete as possible including old albums from the early 2000s, movie soundtracks, and guest features on compilations. No text explanation, just the JSON array.';`,
  `        // A YEAR, never a day: asked for "YYYY-MM-DD" the model answers with a
        // confident day for a 2004 album it has never seen, and that invented day
        // was stored as the album's release date — the wrong dates on old albums.
        // A year is the precision MusicBrainz itself gives an old album, and it
        // means a release date only ever comes from a store or a catalog.
        var _aiPrompt = 'List every album, EP, soundtrack appearance, and compilation feature by ' + a.name + '. Return ONLY a JSON array (no markdown) where each item has: {"title":"Album Name","year":2004,"tracks":12,"type":"album|ep|soundtrack|compilation|live"}. "year" must be a four-digit release YEAR only — never a day or a month. Include deluxe/special editions as separate items. Be as complete as possible including old albums from the early 2000s, movie soundtracks, and guest features on compilations. Do not list an album that is already in the list. No text explanation, just the JSON array.';`);

sub('AI rows: year only, no duplicate, stable id',
  `              var _aiTN = normTitle(_aiA.title);
              var _aiY = String(_aiA.date||'').slice(0,4);
              if(_aiSeenT[_aiTN] && (!_aiY || _aiSeenT[_aiTN].indexOf(_aiY) !== -1)) continue; // already have this album from API
              if(_aiSeenT[_aiTN] && _aiY) _aiSeenT[_aiTN].push(_aiY);
              else if(!_aiSeenT[_aiTN]) _aiSeenT[_aiTN] = [_aiY];
              // Skip singles from AI results too
              var _aiTC = _aiA.tracks || null;
              if(_aiTC === 1) continue;
              var _aiCid = 'ai_' + a.name.toLowerCase().replace(/[^a-z0-9]/g,'') + '_' + _aiI;
              artistAlbums[a.name].push({
                collectionId: _aiCid,
                collectionName: _aiA.title,
                artworkUrl100: null,
                releaseDate: _aiA.date || '',
                trackCount: _aiTC,
                _ai: true
              });`,
  `              var _aiTN = normTitle(_aiA.title);
              // Already known by title from a store or a catalog — of ANY year.
              // The year carve-out let the AI add a second row for an album we
              // already had, filed under the year the model guessed, and both
              // then showed.
              if(_aiSeenT[_aiTN]) continue;
              // A four-digit year, or nothing at all. A day the model produced is
              // dropped rather than shown as the album's release date.
              var _aiY = String(_aiA.year || '').trim();
              if(!/^(19|20)\\d{2}$/.test(_aiY)) _aiY = '';
              // Skip singles from AI results too
              var _aiTC = _aiA.tracks || null;
              if(_aiTC === 1) continue;
              // Keyed by the album, not by its position in the reply: this used to
              // be 'ai_<artist>_<index>', so a refetch renumbered every AI row and
              // a date set on one no longer belonged to it.
              var _aiCid = 'ai_' + a.name.toLowerCase().replace(/[^a-z0-9]/g,'') + '_' + String(_aiA.title).toLowerCase().replace(/[^a-z0-9]/g,'');
              _aiSeenT[_aiTN] = [_aiY];
              artistAlbums[a.name].push({
                collectionId: _aiCid,
                collectionName: _aiA.title,
                artworkUrl100: null,
                releaseDate: _aiY,
                trackCount: _aiTC,
                _ai: true
              });`);

// ---------------------------------------------------------------------------
// 3. A real row replaces an AI row for the same album, in place.
// ---------------------------------------------------------------------------
sub('a catalog row beats an AI row',
  `    var kept = seen[k];
    if(kept){
      if(!kept.artworkUrl100 && a.artworkUrl100) kept.artworkUrl100 = a.artworkUrl100;`,
  `    var kept = seen[k];
    if(kept){
      // A store or catalog row always wins over an AI row for the same album.
      // The AI pass runs last, but an AI row already in the cache sits AHEAD of
      // the row a later refetch adds — so the guessed row kept the place and the
      // real date, cover and track count were thrown away. Swapping keeps the
      // row where it is and gives it the real data.
      if(kept._ai && !a._ai){
        var _realAt = out.indexOf(kept);
        if(_realAt !== -1){ out[_realAt] = a; seen[k] = a; continue; }
      }
      if(!kept.artworkUrl100 && a.artworkUrl100) kept.artworkUrl100 = a.artworkUrl100;`);

// ---------------------------------------------------------------------------
// 4. And a day that is already stored on an AI row is dropped to its year, so a
//    list opened from the cache stops showing an invented day right away instead
//    of at the next refetch. This runs on every render path (cache seed, single
//    artist refetch, full refetch), which is why it lives in _dedupAlbums.
// ---------------------------------------------------------------------------
sub('stored AI days drop to the year',
  `    var a = arr[i];
    if(!a || !a.collectionName) continue;
    var k = _albumKey(a);`,
  `    var a = arr[i];
    if(!a || !a.collectionName) continue;
    // A day on a guessed row came from the lookup, not from a catalog: keep its
    // year and throw the invented day away, so an album that no store lists
    // stops wearing a date the moment the list is drawn.
    if(a._ai && /^(19|20)\\d{2}-\\d{2}-\\d{2}/.test(String(a.releaseDate || ''))) a.releaseDate = String(a.releaseDate).slice(0, 4);
    var k = _albumKey(a);`);

fs.writeFileSync(FILE, src);
console.log('patch-630: ' + edits + ' index.html edit(s)');
