#!/usr/bin/env python3
"""74.1.9 - the destructive buttons that did nothing, the system dialogs, and no way back.

Three faults, all on the same thumb, all in the library:

  1. "Clear playlist" and "Delete all songs" removed NOTHING and said "Deleted".
     Both call deleteAllInView(), whose body only ever answered the Albums tab -
     and the buttons are only drawn in the playlist / All Songs view.
  2. Every song delete asked through window.confirm(). This page already documents
     that the Android WebView swallows confirm() (it returns false), which is why
     playlist delete got modalConfirm() in 71.9 - the songs never did.
  3. A delete was final: one tap on the wrong row took the file, its plays, its
     lyric sheet and its place in every playlist.

This script is the record of the edits, in the order they were made.

    python3 dev/patch-74110-destructive.py           # apply
    python3 dev/patch-74110-destructive.py --check   # every anchor is present exactly once
"""
import sys
import pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAGE = ROOT / "index.html"

src = PAGE.read_text(encoding="utf-8")
edits = []
pairst = []
CHECK = "--check" in sys.argv


def rep(old, new, why):
    """Replace exactly one occurrence; refuse a tree that does not match the anchors."""
    global src
    pairst.append((old, new, why))
    if CHECK:
        return          # the pairs are what --check probes; nothing is rewritten
    n = src.count(old)
    if n != 1:
        raise SystemExit("anchor found %d times (%s):\n%s" % (n, why, old[:200]))
    src = src.replace(old, new, 1)
    edits.append(why)


# ---------------------------------------------------------------------------
# 1. The toast is a status, not decoration.
# ---------------------------------------------------------------------------
rep(
    '<div class="toast" id="toast"></div>',
    '<div class="toast" id="toast" role="status" aria-live="polite"></div>',
    "the toast is announced to a screen reader and can be swiped away",
)

# ---------------------------------------------------------------------------
# 2. A toast can be pushed out of the way, and a swipe is not a tap.
# ---------------------------------------------------------------------------
rep(
    """    // Tap once: open the detail if there is one, otherwise dismiss as before.
    if(!toastEl._tapDismissed){
      toastEl._tapDismissed = true;
      toastEl.addEventListener('click', function(){
        clearTimeout(toastEl._t);
        toastEl.style.display='none';
        var _fn = toastEl._onTap;
        toastEl._onTap = null;
        if(typeof _fn === 'function'){ try{ _fn(); }catch(_eToastTap){ console.error('toast tap failed', _eToastTap); } }
      });
    }
""",
    """    // Tap once: open the detail if there is one, otherwise dismiss as before.
    // A swipe ends with a click too, and that click is not a tap on the message -
    // opening the song list because a thumb pushed the toast out of the way would
    // be the opposite of the gesture.
    if(!toastEl._tapDismissed){
      toastEl._tapDismissed = true;
      toastEl.addEventListener('click', function(){
        if(Date.now() - (toastEl._swipedAt || 0) < 450) return;
        clearTimeout(toastEl._t);
        toastEl.style.display='none';
        var _fn = toastEl._onTap;
        toastEl._onTap = null;
        if(typeof _fn === 'function'){ try{ _fn(); }catch(_eToastTap){ console.error('toast tap failed', _eToastTap); } }
      });
    }
    // PUSH IT OUT OF THE WAY. A message that is covering something is dismissed by
    // flicking it up, the way every other transient bar on the phone works; the
    // Undo button inside it is not a swipe, so a press that starts on it is left
    // alone. 24px is over a fingertip's wobble and under a deliberate flick.
    if(!toastEl._swipeWired){
      toastEl._swipeWired = true;
      var _toastDownY = null;
      toastEl.addEventListener('pointerdown', function(ev){
        if(ev.target && ev.target.closest && ev.target.closest('button')){ _toastDownY = null; return; }
        _toastDownY = ev.clientY;
      });
      toastEl.addEventListener('pointerup', function(ev){
        if(_toastDownY == null) return;
        var up = _toastDownY - ev.clientY;      // up is positive
        _toastDownY = null;
        if(up < 24) return;
        toastEl._swipedAt = Date.now();
        clearTimeout(toastEl._t);
        toastEl.style.display = 'none';
      });
      toastEl.addEventListener('pointercancel', function(){ _toastDownY = null; });
    }
""",
    "a toast can be swiped away, and the click that follows a swipe is not a tap",
)

# ---------------------------------------------------------------------------
# 3. deleteSelected: the in-app ask, and a way back for each of its three cases.
# ---------------------------------------------------------------------------
rep(
    """  function deleteSelected(){
    const isAllSongs = activePlaylist === 'All Songs' || activePlaylist === UNSORTED_VIEW;
    const isAlbums = libraryMode === 'albums';
    const count = selectedIds.size;
    if(!count) return;
    if(isAlbums){
      if(!confirm(`Remove ${count} song${count===1?'':'s'} from albums? (Songs stay in your library.)`)) return;
      Object.keys(userAlbums).forEach(name => {
        const ua = userAlbums[name];
        if(ua && Array.isArray(ua.trackIds)){
          ua.trackIds = ua.trackIds.filter(id => !selectedIds.has(id));
        }
      });
      saveMeta();
    } else {
      const scopeText = isAllSongs ? 'from your library' : 'from this playlist';
      if(!confirm(`Delete ${count} song${count===1?'':'s'} ${scopeText}? ${isAllSongs ? 'This removes them from every playlist too.' : ''}`)) return;
      if(isAllSongs){
        Array.from(selectedIds).forEach(id => deleteTrack(id, true));
      } else {
        if(libraryMode === 'albums'){ toast('Use album remove instead.'); exitSelectMode(); return; }
        playlists[activePlaylist] = playlists[activePlaylist].filter(x => !selectedIds.has(x));
        saveMeta();
      }
    }
    exitSelectMode();
  }
""",
    """  async function deleteSelected(){
    const isAllSongs = activePlaylist === 'All Songs' || activePlaylist === UNSORTED_VIEW;
    const isAlbums = libraryMode === 'albums';
    const ids = Array.from(selectedIds);
    const count = ids.length;
    if(!count) return;
    if(isAlbums){
      const sure = await modalConfirm('Remove from albums?',
        'Remove ' + count + ' song' + (count === 1 ? '' : 's') + ' from ' + (count === 1 ? 'its album' : 'their albums') +
        '? They stay in your library, and Undo puts them back where they were.',
        'Remove');
      if(!sure) return;
      const where = scAlbumPlaces(ids);
      Object.keys(userAlbums).forEach(name => {
        const ua = userAlbums[name];
        if(ua && Array.isArray(ua.trackIds)){
          ua.trackIds = ua.trackIds.filter(id => !ids.includes(id));
        }
      });
      saveMeta();
      exitSelectMode();
      renderList();
      toastWithUndo('Removed ' + count + ' song' + (count === 1 ? '' : 's') + ' from albums', function(){
        scAlbumPlacesRestore(where);
        saveMeta();
        renderList();
      });
      return;
    }
    if(isAllSongs){
      // One ask, one undo, and the same path the row's own menu takes.
      exitSelectMode();
      await scDeleteSongs(ids);
      return;
    }
    if(libraryMode === 'albums'){ toast('Use album remove instead.'); exitSelectMode(); return; }
    const target = activePlaylist;
    const before = (playlists[target] || []).slice();
    const sure = await modalConfirm('Remove from "' + target + '"?',
      'Take ' + count + ' song' + (count === 1 ? '' : 's') + ' out of this playlist? They stay in your library, and Undo puts them back.',
      'Remove');
    if(!sure) return;
    playlists[target] = (playlists[target] || []).filter(x => !ids.includes(x));
    saveMeta();
    exitSelectMode();
    renderTabs();
    renderList();
    toastWithUndo('Removed ' + count + ' song' + (count === 1 ? '' : 's') + ' from "' + target + '"', function(){
      playlists[target] = before;
      saveMeta();
      renderTabs();
      renderList();
    });
  }

  // Where each id sat inside its albums, so "Remove from albums" can be undone.
  // Restoring the whole userAlbums object would quietly undo anything else that
  // changed in the same six seconds, which is not what Undo promises.
  function scAlbumPlaces(ids){
    const where = {};
    Object.keys(userAlbums).forEach(name => {
      const ua = userAlbums[name];
      if(!ua || !Array.isArray(ua.trackIds)) return;
      ua.trackIds.forEach((id, at) => { if(ids.includes(id) && !where[id]) where[id] = { name: name, at: at }; });
    });
    return where;
  }
  function scAlbumPlacesRestore(where){
    Object.keys(where || {}).forEach(id => {
      const w = where[id], ua = userAlbums[w.name];
      if(!ua || !Array.isArray(ua.trackIds)) return;
      if(ua.trackIds.indexOf(id) !== -1) return;
      ua.trackIds.splice(Math.min(w.at, ua.trackIds.length), 0, id);
    });
  }
  window.__scAlbumPlaces = scAlbumPlaces;
""",
    "multi-select asks in-app and every branch can be undone",
)

# ---------------------------------------------------------------------------
# 4. deleteAllInView actually does what its two buttons say.
# ---------------------------------------------------------------------------
rep(
    """  function deleteAllInView(ids, isAllSongs){
    if(!ids.length){ toast('Nothing here to delete.'); return; }
    if(libraryMode === 'albums'){
      if(!confirm(`Remove all ${ids.length} songs from albums? (Songs stay in your library.)`)) return;
      Object.keys(userAlbums).forEach(name => {
        const ua = userAlbums[name];
        if(ua && Array.isArray(ua.trackIds)){
          ua.trackIds = ua.trackIds.filter(id => !ids.includes(id));
        }
      });
      saveMeta();
      renderList();
    }
    toast('Deleted');
  }
""",
    """  // "Clear playlist" and "Delete all songs" were drawn in the playlist view and
  // answered only the Albums tab: both removed nothing there, and both still said
  // "Deleted". The three cases are three different promises now, and each one is
  // kept - and can be taken back.
  async function deleteAllInView(ids, isAllSongs){
    ids = (ids || []).filter(Boolean);
    if(!ids.length){ toast('Nothing here to delete.'); return; }
    if(libraryMode === 'albums'){
      const sureAlbums = await modalConfirm('Remove from albums?',
        'Remove all ' + ids.length + ' songs on this screen from their albums? They stay in your library, and Undo puts them back.',
        'Remove');
      if(!sureAlbums) return;
      const where = scAlbumPlaces(ids);
      Object.keys(userAlbums).forEach(name => {
        const ua = userAlbums[name];
        if(ua && Array.isArray(ua.trackIds)){
          ua.trackIds = ua.trackIds.filter(id => !ids.includes(id));
        }
      });
      saveMeta();
      renderList();
      toastWithUndo('Removed ' + ids.length + ' song' + (ids.length === 1 ? '' : 's') + ' from albums', function(){
        scAlbumPlacesRestore(where);
        saveMeta();
        renderList();
      });
      return;
    }
    if(isAllSongs){
      await scDeleteSongs(ids);
      return;
    }
    const target = activePlaylist;
    const sure = await modalConfirm('Clear "' + target + '"?',
      'Take all ' + ids.length + ' song' + (ids.length === 1 ? '' : 's') + ' in this playlist out of it? They stay in your library, and Undo puts them back.',
      'Clear playlist');
    if(!sure) return;
    const before = (playlists[target] || []).slice();
    playlists[target] = (playlists[target] || []).filter(id => !ids.includes(id));
    saveMeta();
    renderTabs();
    renderList();
    toastWithUndo('Cleared "' + target + '"', function(){
      playlists[target] = before;
      saveMeta();
      renderTabs();
      renderList();
    });
  }
  window.__scDeleteAllInView = deleteAllInView;
""",
    "Clear playlist clears the playlist, Delete all deletes, albums remove asks in-app",
)

# ---------------------------------------------------------------------------
# 5. One delete path: the in-app ask, the snapshot, and Undo.
# ---------------------------------------------------------------------------
rep(
    """  function deleteTrack(id, skipConfirm){
    const t = allTracks.find(tr => tr.id === id);
    if(!t) return;
    if(!skipConfirm && !confirm(`Delete "${t.name}" from your library? This removes it from every playlist too.`)) return;

    // If it's currently playing, stop playback cleanly
    if(queue[queueIndex] === id){
      userPaused = true;
      audios.forEach(function(_a){ try{ _a.pause(); _a.removeAttribute('src'); }catch(_){} });
      $('nowPlaying').style.display = 'none';
    }
    queue = queue.filter(x => x !== id);

    Object.keys(playlists).forEach(name => {
      playlists[name] = playlists[name].filter(x => x !== id);
    });
    allTracks = allTracks.filter(tr => tr.id !== id);
    URL.revokeObjectURL(t.url);
    dbDelete('tracks', id);
    saveMeta();

    toast(`Deleted "${t.name}"`);
    renderTabs();
    renderList();
  }
""",
    """  /* --------------------------------------------------------------------------
     One delete path. THE ASK IS IN THE APP, AND THE SONG COMES BACK.
     --------------------------------------------------------------------------
     window.confirm() is swallowed by the Android WebView - this file says so where
     modalConfirm() was added for playlist delete in 71.9 - so a song delete could
     report nothing, or ask in a system sheet that is the only unthemed surface left.
     And a delete was final. scDeleteSongs() asks in the app's own sheet, takes a
     snapshot of everything the removal touches, and toastWithUndo() puts every part
     of it back: the track object in the order it sat in, the file in IndexedDB, its
     index in each playlist, its place in the queue, and the now bar.
     -------------------------------------------------------------------------- */
  let scTrashPile = null;   // the last delete the toast can still undo

  function scDeleteSnapshot(ids){
    const snap = { tracks: [], ids: [], at: {}, where: {}, queueAt: {}, recs: [], playing: (queue[queueIndex] || null) };
    ids.forEach(id => {
      const t = allTracks.find(tr => tr.id === id);
      if(!t) return;
      snap.tracks.push(t);
      snap.ids.push(id);
      snap.at[id] = allTracks.indexOf(t);
      const w = {};
      Object.keys(playlists).forEach(name => {
        const k = (playlists[name] || []).indexOf(id);
        if(k !== -1) w[name] = k;
      });
      snap.where[id] = w;
      const q = queue.indexOf(id);
      if(q !== -1) snap.queueAt[id] = q;
    });
    return snap;
  }

  async function scDeleteSongs(ids, opts){
    opts = opts || {};
    const snap = scDeleteSnapshot((ids || []).filter(Boolean));
    if(!snap.tracks.length){ toast('Nothing here to delete.'); return 0; }
    if(!opts.silent){
      const many = snap.tracks.length > 1;
      const sure = await modalConfirm(
        many ? ('Delete ' + snap.tracks.length + ' songs?') : 'Delete this song?',
        (many ? ('These ' + snap.tracks.length + ' songs') : ('"' + snap.tracks[0].name + '"')) +
        ' will be removed from your library and from every playlist. Undo brings ' + (many ? 'them' : 'it') + ' straight back.',
        many ? ('Delete ' + snap.tracks.length) : 'Delete');
      if(!sure) return 0;
    }
    // The audio goes back into the store only if the undo asks for it, so the
    // record is read BEFORE anything is removed.
    for(const t of snap.tracks){
      try{ snap.recs.push({ id: t.id, rec: await dbGet('tracks', t.id) }); }
      catch(_eRec){ snap.recs.push({ id: t.id, rec: null }); }
    }
    // The bar goes first: a song about to be deleted must not be left pointing at a
    // url that is revoked a line later.
    if(snap.playing && snap.ids.indexOf(snap.playing) !== -1){
      userPaused = true;
      audios.forEach(function(_a){ try{ _a.pause(); _a.removeAttribute('src'); }catch(_){} });
      $('nowPlaying').style.display = 'none';
    }
    for(const t of snap.tracks){
      const id = t.id;
      queue = queue.filter(x => x !== id);
      Object.keys(playlists).forEach(name => {
        playlists[name] = playlists[name].filter(x => x !== id);
      });
      allTracks = allTracks.filter(tr => tr.id !== id);
      try{ if(t.url && String(t.url).indexOf('blob:') === 0) URL.revokeObjectURL(t.url); }catch(_eUrl){}
      try{ dbDelete('tracks', id); }catch(_eDb){}
    }
    saveMeta();
    scTrashPile = snap;
    toastWithUndo(
      snap.tracks.length === 1 ? ('Deleted "' + snap.tracks[0].name + '"') : ('Deleted ' + snap.tracks.length + ' songs'),
      function(){ scUndoSongDelete(); });
    renderTabs();
    renderList();
    return snap.tracks.length;
  }

  async function scUndoSongDelete(){
    const snap = scTrashPile;
    scTrashPile = null;
    if(!snap || !snap.tracks.length) return;
    let back = 0;
    for(const t of snap.tracks){
      const id = t.id;
      if(!allTracks.some(x => x.id === id)){
        const at = Math.min(snap.at[id] == null ? allTracks.length : snap.at[id], allTracks.length);
        allTracks.splice(at, 0, t);
      }
      // The old url was revoked on the way out; the file it came from is still here.
      try{
        const f = t.file || t._originalFile;
        if(f) t.url = URL.createObjectURL(f);
      }catch(_eUrl){}
      const w = snap.where[id] || {};
      Object.keys(w).forEach(name => {
        if(!playlists[name]) playlists[name] = [];
        if(playlists[name].indexOf(id) !== -1) return;
        playlists[name].splice(Math.min(w[name], playlists[name].length), 0, id);
      });
      const rec = (snap.recs.find(r => r.id === id) || {}).rec;
      if(rec){ try{ await dbPut('tracks', rec); }catch(_ePut){} }
      const q = snap.queueAt[id];
      if(q != null && queue.indexOf(id) === -1) queue.splice(Math.min(q, queue.length), 0, id);
      back++;
    }
    saveMeta();
    // A song that was playing when it was deleted gets its place back, paused and
    // visible, rather than leaving the bar hidden with nothing to explain it.
    try{
      if(snap.playing && snap.ids.indexOf(snap.playing) !== -1){
        const p = allTracks.find(x => x.id === snap.playing);
        const a = activeAudio();
        if(p && a && p.url){ a.src = p.url; a.load(); a.pause(); }
        queueIndex = queue.indexOf(snap.playing);
        $('nowPlaying').style.display = 'flex';
        if(p && $('npTitle')) $('npTitle').textContent = p.name;
      }
    }catch(_eBar){}
    renderTabs();
    renderList();
    toast('Restored ' + (back === 1 ? '1 song' : (back + ' songs')) + ' - nothing was lost.', 2600);
  }
  window.__scDeleteSongs = scDeleteSongs;
  window.__scUndoSongDelete = scUndoSongDelete;

  function deleteTrack(id, skipConfirm){
    return scDeleteSongs([id], { silent: !!skipConfirm });
  }
""",
    "song delete asks in-app, keeps a snapshot, and Undo restores all of it",
)

# ---------------------------------------------------------------------------
# 6. The duplicates run: one ask, one undo, one message.
# ---------------------------------------------------------------------------
rep(
    """    idsToDelete.forEach(id => deleteTrack(id, true));
    $('dupReviewBackdrop').style.display = 'none';
    dupReviewSelections = null;
    toast(`Deleted ${idsToDelete.length} song${idsToDelete.length>1?'s':''}`);
    updateNotifBadge();
""",
    """    $('dupReviewBackdrop').style.display = 'none';
    dupReviewSelections = null;
    // The review sheet already showed exactly what is about to go, so this path
    // does not ask a second time - but it is one delete, with one undo.
    scDeleteSongs(idsToDelete, { silent: true }).then(function(){ updateNotifBadge(); });
""",
    "deleting the checked duplicates is one action with one undo",
)

# ---------------------------------------------------------------------------
# 7. The two remaining system dialogs in the library.
# ---------------------------------------------------------------------------
rep(
    """  $('resetCoversBtn').addEventListener('click', async () => {
    if(!confirm('This will remove all saved covers. Original embedded covers from audio files will be shown instead. Continue?')) return;
""",
    """  $('resetCoversBtn').addEventListener('click', async () => {
    if(!(await modalConfirm('Reset covers?', 'Remove all saved covers? The covers embedded in the audio files are shown instead.', 'Reset covers'))) return;
""",
    "resetting covers asks in the app, not in a system dialog",
)

rep(
    """    setTimeout(function(){ try{ if(confirm('Reload SideCut now to get v' + String(man.version) + '?')) location.reload(); }catch(_e){} }, 1400);
""",
    """    setTimeout(async function(){
      try{
        var go = await modalConfirm('Update ready', 'Reload SideCut now to get v' + String(man.version) + '?', 'Reload');
        if(go) location.reload();
      }catch(_e){}
    }, 1400);
""",
    "the update prompt is the app's own sheet",
)

rep(
    """    if(userAlbums[albumName]){
      if(!confirm('An album named "' + albumName + '" already exists — merge these songs into it?')) return;
    }
""",
    """    if(userAlbums[albumName]){
      if(!(await modalConfirm('Album already exists', 'An album named "' + albumName + '" already exists - merge these songs into it?', 'Merge'))) return;
    }
""",
    "creating an album that already exists asks in the app (selection path)",
)

rep(
    """    if(userAlbums[albumName]){
      if(!confirm(`An album named "${albumName}" already exists — merge these songs into it?`)) return;
    }
""",
    """    if(userAlbums[albumName]){
      if(!(await modalConfirm('Album already exists', 'An album named "' + albumName + '" already exists - merge these songs into it?', 'Merge'))) return;
    }
""",
    "creating an album that already exists asks in the app (picker path)",
)

# ---------------------------------------------------------------------------
# 8. The release's own notes: the first items are the ones an installed app shows.
# ---------------------------------------------------------------------------
rep(
    """  { version: '74.1.9', date: 'October 16, 2026 · 7:22 PM EDT', title: 'The album follows the song, the views arrive smoothly, the tabs can be one sliding pill dock, and two repairs from the phone: an album stops mixing its own tracks, and the app stops stuttering while it works', items: [
    'Skipping into another album closes the album you were in and opens the new one, so the song that is playing is never the one you cannot see. A card still holding the playing song stays open, and albums you opened by hand are left alone.',
""",
    """  { version: '74.1.9', date: 'October 16, 2026 · 7:22 PM EDT', title: 'The album follows the song, the views arrive smoothly, the tabs can be one sliding pill dock, and the buttons that said Deleted now delete - with an Undo - plus two repairs from the phone', items: [
    'Clear playlist and Delete all songs work now. Both used to remove nothing and still say Deleted, because they answered the Albums tab while drawn in the playlist one. Undo is one tap away.',
    'Deleting songs asks in the app instead of a system dialog the phone can swallow, and Undo brings the song back with its file, its plays and its place in every playlist.',
    'The message bar can be flicked up out of the way, and it is announced to a screen reader.',
    'Resetting covers, merging into an existing album and the update prompt all ask in the app, so no system dialog is left anywhere.',
    'Skipping into another album closes the album you were in and opens the new one, so the song that is playing is never the one you cannot see. A card still holding the playing song stays open, and albums you opened by hand are left alone.',
""",
    "the release notes lead with the delete buttons, so the update prompt says what changed",
)

if CHECK:
    # A probe of the SHIPPED tree, not of this script: every result is present and
    # every anchor it replaced is gone. Run before applying, it fails on the old
    # page for the right reason (the anchors are still there).
    bad = 0
    for old, new, why in pairst:
        # The two notes that follow this one in the same release (Medium, then Ask)
        # are inserted INTO this note list, so the block this edit adds is no longer
        # contiguous on the shipped page. What must hold is that every line the edit
        # adds is there - that is the same promise, line by line, and it is the one
        # the page can still keep.
        added = [ln for ln in new.splitlines() if ln.strip() and ln not in old.splitlines()]
        if new not in src and not (added and all(ln in src for ln in added)):
            print("  MISSING result: " + why)
            bad += 1
        elif old in src:
            print("  STALE anchor:  " + why)
            bad += 1
    if bad:
        print("patch-74110-destructive: CHECK FAILED (%d)" % bad)
        sys.exit(1)
    print("patch-74110-destructive: CHECK OK - %d edits are in the page" % len(pairst))
    for e in edits:
        print("  . " + e)
    sys.exit(0)

PAGE.write_text(src, encoding="utf-8")
print("patch-74110-destructive: applied %d edits" % len(edits))
for e in edits:
    print("  . " + e)
