# The text 80.2.5 carries into index.html, kept out of patch-8025.py so the
# payload travels as small constants and the patch itself stays the cutting.
#
# Nothing here is a redesign: two automatic creators stop creating, the album menu
# grows a delete row, and that row asks first.

# 1. THE TURNTABLE'S COMMENT. It promised to make an album out of the song's tag.
TURNTABLE_DOC = r'''  // Tap the mini turntable in the now bar → open the album the playing song is
  // in, scrolled to the song and highlighted. It never makes an album: 80.2.5
  // removed the step that turned the file's album tag into one, because a jump is
  // a question about your library, not permission to add to it. A song whose tag
  // names no album of yours falls through to the song jump, which is what the tap
  // was asking for anyway.
'''

# 2. THE TURNTABLE ITSELF. Only an album that already exists is opened.
TURNTABLE = r'''    // 2. otherwise the album tag on the file - but only when that tag IS an album
    // you have. 80.2.5: this used to make one on the spot (ensureAlbumSaved), so a
    // tap on the now bar could leave a card behind that nobody created - often a
    // one-song album named after whatever the file's album tag happened to say.
    // A jump never makes an album any more; a tag with no album behind it falls
    // through to the song jump below.
    if(!albumName){
      const tag = String(t.album || '').trim();
      if(tag && userAlbums[tag]){
        try{
          if(albumIsAuto(tag) && typeof markAlbumManual === 'function') markAlbumManual(tag);
        }catch(_eTag){}
        albumName = tag;
      }
    }
'''

# 3. THE BOOT PASS. It only puts back what the app itself took, never a tag.
RECOVERY = r'''      // (3) 80.2.5 - NOTHING IS INVENTED FROM A TAG ANY MORE.
      // This pass used to make an album out of every album tag on the files that
      // no entry held and that at least two songs carried - and, for a name the
      // archive knew, out of a tag only one song carried. The tags on a phone are
      // whatever the files arrived with: a site's idea of the album, the song's own
      // name in the album field, one "single" shared by two songs. So a launch
      // could add a card nobody asked for, holding a couple of songs, wearing
      // manual:true from the moment it was born and looking exactly like an album
      // you made. That is the "random albums with singles" report.
      // The rule now is the one the Albums tab already states: a card is an entry
      // somebody put there. So the boot only puts back what the APP ITSELF took - a
      // name in sidecut_albumsArchive, written by the one sweep that ever removed
      // an entry, restored with the song list it had at that moment. Everything
      // else is left to the one path allowed to turn tags into albums because a
      // person asked: Manage albums > Rebuild albums from tags.
      var SC_ALBUMS_RECOVER_KEY = 'sidecut_albumsUserDeleted';
      var userDeleted = {};
      try{
        var _udRaw = localStorage.getItem(SC_ALBUMS_RECOVER_KEY);
        var _ud = _udRaw ? JSON.parse(_udRaw) : null;
        if(_ud && typeof _ud === 'object' && !(_ud instanceof Array)) userDeleted = _ud;
      }catch(_eRecK){}
      var _arcRaw = null, _arc = null;
      try{ _arcRaw = localStorage.getItem(SC_ALBUMS_ARCHIVE_KEY); _arc = _arcRaw ? JSON.parse(_arcRaw) : null; }catch(_eArcR){}
      var _arcDirty = false;
      if(_arc && typeof _arc === 'object' && !(_arc instanceof Array)){
        Object.keys(_arc).forEach(function(name){
          if(!name || userAlbums[name]) return;
          // Deleted by the user on purpose? Then it stays deleted - the whole
          // reason the tombstone exists.
          if(userDeleted[String(name).toLowerCase()]) return;
          var e = _arc[name] && _arc[name].entry;
          if(!e || !Array.isArray(e.trackIds) || !e.trackIds.length) return;
          // Only the songs that are still here: a reimport can change ids, and an
          // album of nothing is not an album.
          var ids = e.trackIds.filter(function(id){
            for(var ti = 0; ti < allTracks.length; ti++){ if(allTracks[ti] && allTracks[ti].id === id) return true; }
            return false;
          });
          if(!ids.length) return;
          var back = {};
          Object.keys(e).forEach(function(k){ if(k !== 'trackIds' && k !== 'auto') back[k] = e[k]; });
          back.trackIds = ids;
          back.manual = true;
          delete back.auto;
          userAlbums[name] = back;
          if(albumOrder.indexOf(name) === -1) albumOrder.push(name);
          delete _arc[name];
          _arcDirty = true;
          restored++;
        });
        if(_arcDirty){
          try{ localStorage.setItem(SC_ALBUMS_ARCHIVE_KEY, JSON.stringify(_arc)); }catch(_eArcW){}
        }
      }
'''

# 4. DELETE AN ALBUM. The tombstone, the silent path for the panel, and Undo.
DELETE_ALBUM = r'''  // 80.2.5 - DELETE AN ALBUM, with Undo.
  // The tombstone is the part that matters: a boot may only put back what the app
  // archived, and an album you deleted is not one of those - its name is written
  // down here the moment you delete it, so no later launch, rebuild or restore can
  // quietly bring it back. The songs are never touched: an album is a list, and the
  // files keep their own album tag either way.
  function deleteUserAlbum(name, opts){
    if(!userAlbums[name]) return false;
    var _gone = userAlbums[name];
    var _goneAt = albumOrder.indexOf(name);
    var _goneKey = String(name).toLowerCase();
    try{
      var _udRaw = localStorage.getItem('sidecut_albumsUserDeleted');
      var _ud = _udRaw ? JSON.parse(_udRaw) : {};
      if(!_ud || typeof _ud !== 'object' || _ud instanceof Array) _ud = {};
      _ud[_goneKey] = Date.now();
      localStorage.setItem('sidecut_albumsUserDeleted', JSON.stringify(_ud));
    }catch(_eTomb){}
    scAllowRowDrop('userAlbums', name);
    delete userAlbums[name];
    try{
      var _di = albumOrder.indexOf(name);
      if(_di !== -1) albumOrder.splice(_di, 1);
      dbPut('meta', { key: 'albumOrder', value: albumOrder });
    }catch(_e){}
    dbPut('meta', { key: 'userAlbums', value: userAlbums });
    renderList();
    // Only the panel that is on screen is rebuilt. The album card's own menu calls
    // this too, and reopening Manage albums from there would replace the list the
    // owner is looking at with a different screen.
    try{
      var _tEl = document.getElementById('discPopupTitle');
      if(_tEl && _tEl.textContent === 'Manage albums') refreshManageAlbums(true);
    }catch(_eMgr){}
    if(!(opts && opts.silent)){
      toastWithUndo('Deleted "' + name + '" \u2014 the songs stay in your library.', function(){
        if(userAlbums[name]) return;
        userAlbums[name] = _gone;
        var _backAt = _goneAt === -1 ? albumOrder.length : Math.min(_goneAt, albumOrder.length);
        albumOrder.splice(_backAt, 0, name);
        try{
          var _rt = localStorage.getItem('sidecut_albumsUserDeleted');
          var _rm = _rt ? JSON.parse(_rt) : null;
          if(_rm && typeof _rm === 'object' && !(_rm instanceof Array)){
            delete _rm[_goneKey];
            localStorage.setItem('sidecut_albumsUserDeleted', JSON.stringify(_rm));
          }
        }catch(_eUnTomb){}
        try{ dbPut('meta', { key: 'userAlbums', value: userAlbums }); }catch(_eUa){}
        try{ dbPut('meta', { key: 'albumOrder', value: albumOrder }); }catch(_eOa){}
        try{ renderList(); }catch(_eRl){}
        toast('Put "' + name + '" back.', 2600);
      });
    }
    return true;
  }
'''

# 5. THE MENU'S ROW HELPER. It grows a danger variant, which is what the delete row
#    wears, so the destructive row cannot be mistaken for the two above it.
MENU_ROW = r'''    function row(action, icon, label, sub, danger){
      return '<button class="sc-alm-row" data-alm="' + action + '" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px;margin-bottom:6px;border-radius:10px;border:1px solid ' + (danger ? 'color-mix(in srgb, var(--coral) 45%, var(--line))' : 'var(--line)') + ';background:rgba(255,255,255,0.04);color:var(--ink);font-size:13.5px;cursor:pointer;">'
        + '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;flex-shrink:0;color:var(--coral);">' + icon + '</svg>'
        + '<span style="flex:1;min-width:0;"><span style="display:block;font-weight:600;' + (danger ? 'color:var(--coral);' : '') + '">' + escapeHtml(label) + '</span>'
        + (sub ? '<span style="display:block;font-size:11px;color:var(--ink-dim);margin-top:2px;">' + escapeHtml(sub) + '</span>' : '')
        + '</span></button>';
    }
'''

# 6. THE DELETE ROW, under the two that change the order.
MENU_ROW_HTML = r'''      + row('delete', '<path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/>', 'Delete album',
            'Removes the album. The songs stay in your library.', true)
      + '</div>'
      + '<div style="padding:0 16px 14px;font-size:11px;color:var(--ink-dim);line-height:1.5;">Songs the album does not list stay at the end, and every sort carries Undo. Deleting asks first, and can be undone.</div>';
'''

# 7. AND WHAT THAT ROW DOES.
MENU_HANDLER = r'''        if(what === 'hand'){
          if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(key);
          else toast('Reorder sheet unavailable.', 2600);
        }
        if(what === 'delete'){ scAlbumDeleteConfirm(key); return; }
'''

# 8. THE CONFIRMATION. Not window.confirm(): the Android WebView can swallow it and
#    answer false, which is how a Delete button once came to look broken.
CONFIRM = r'''  // 80.2.5 - THE CONFIRMATION. A delete is the one row in this menu that cannot be
  // taken back by tapping it again, so it asks first, in the sheet the app already
  // speaks: the album named, the songs accounted for, and two buttons. window.confirm
  // is deliberately not used - the Android WebView can swallow it and answer false,
  // which is exactly how the panel's Delete button once came to look broken.
  function scAlbumDeleteConfirm(name){
    var key = String(name || '').trim();
    if(!key) return;
    if(!userAlbums[key]){ toast('There is no album called \u201c' + key + '\u201d any more.', 3000); return; }
    var n = Array.isArray(userAlbums[key].trackIds) ? userAlbums[key].trackIds.length : 0;
    var btn = 'flex:1;padding:11px 12px;border-radius:12px;font-family:var(--font-ui);font-size:12.5px;font-weight:700;cursor:pointer;';
    var html = '<div style="padding:14px 16px 16px;">'
      + '<div style="font-size:13.5px;line-height:1.5;color:var(--ink);">Delete <b>' + escapeHtml(key) + '</b>?</div>'
      + '<div style="font-size:11.5px;color:var(--ink-dim);line-height:1.55;margin-top:8px;">'
      + (n ? 'Its ' + n + ' song' + (n === 1 ? '' : 's') + ' stay in your library' : 'The album is empty') +
      ' - only the album goes, and it will not come back on the next launch.</div>'
      + '<div style="display:flex;gap:8px;margin-top:14px;">'
      + '<button id="scAlbDelCancel" style="' + btn + 'border:1px solid var(--line);background:rgba(255,255,255,0.04);color:var(--ink);">Keep it</button>'
      + '<button id="scAlbDelGo" style="' + btn + 'border:1px solid var(--coral);background:var(--coral);color:#161616;">Delete album</button>'
      + '</div></div>';
    openDiscoverPopup('Delete album', html, key);
    var body = document.getElementById('discPopupBody');
    if(!body) return;
    var cancel = body.querySelector('#scAlbDelCancel');
    var go = body.querySelector('#scAlbDelGo');
    if(cancel) cancel.addEventListener('click', function(){ closeDiscoverPopup(); });
    if(go) go.addEventListener('click', function(){
      closeDiscoverPopup();
      deleteUserAlbum(key);
    });
  }

'''

# 9. THE DOORS A GATE KNOCKS ON.
EXPORTS = r'''  // 80.2.5 - the confirmed delete and the quiet delete, exported the way the sort
  // above is: a suite drives the same functions the rows call.
  window.__scAlbumDeletePrompt = function(name){ return scAlbumDeleteConfirm(name); };
  window.__scDeleteAlbumQuiet = function(name){ return deleteUserAlbum(name, { silent: true }); };
'''

# 10. THE CHANGELOG HEAD. Eight notes, no apostrophes, and the words the gate asks
#     for (widget, player, lyrics, letter) in the one that says what did not move.
CHANGELOG_HEAD = r'''  { version: '80.2.5', date: 'October 25, 2026 \u00b7 12:04 AM EDT', title: 'Albums only come from you now, and an album can be deleted from its own three dots', items: [
    'An album can be deleted from its own three dots, with a confirmation that names it and says how many songs stay in the library.',
    'The app no longer builds albums out of album tags on its own: a launch used to add a card for any tag two songs shared, which is where the albums nobody made came from.',
    'Tapping the record in the now bar opens the album the song is on when you have one, and jumps to the song when you do not; it never adds an album.',
    'The one thing a launch still puts back is an album the app itself removed, restored with the song list it had at that moment, and never a name you deleted.',
    'Delete asks first, can be undone from the toast, and the album stays gone on every later launch.',
    'Albums that are already there are untouched by this release: the cards you have are the cards you keep, and Manage albums still has Rebuild albums from tags for a library that wants them.',
    'The songs are never touched by a delete, the album order keeps its place, and an album restored from a backup is still marked as yours.',
    'The widget, the player, the lyrics view, the letter covers and the album pill dock are untouched.',
  ],
    details: [
      'The boot pass that repaired a library after the old sweep now restores only what the sweep archived, which is the app own record of what it took; it no longer turns a tag into an album, so nothing appears that a person did not put there.',
      'Rebuild albums from tags is unchanged and still reachable in Manage albums, because turning tags into albums is a good thing to be able to ask for and a bad thing to do by surprise.',
      'The delete row sits under the sort and the hand reorder, in the danger colour, and opens a confirmation in the same sheet language: the album name, the song count and what happens to the songs, with Keep it and Delete album.',
      'Undo restores the entry, its songs and its place in the album order, and takes the tombstone back off, so the album is exactly as it was.',
      'The panel that is on screen is the only one rebuilt after a delete, so deleting from a card menu cannot open Manage albums over the list.',
    ],
  },
'''
