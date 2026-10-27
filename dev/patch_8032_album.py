"""The album door for 80.3.2: an export, the glue that arms the button, and the two cards.

Part of the 80.3.2 payload; run dev/patch-8032.py, which applies these in order.
"""

ALBUM_HOOK_OLD = """  window.__scAlbumCardOrder = scAlbumCardOrder;
"""

ALBUM_HOOK_NEW = ALBUM_HOOK_OLD + """  // 80.3.2 - a finished download can be filed. The card is built as HTML with inline handlers,
  // so the picker is reachable by name: it opens the SAME picker the library uses, for the song
  // that was just written. Nothing here invents an album.
  window.__scAlbumPickForTrack = function(id, label){
    try{
      var t = null;
      for(var i = 0; i < allTracks.length; i++){
        if(allTracks[i] && String(allTracks[i].id) === String(id)){ t = allTracks[i]; break; }
      }
      if(!t){ toast('That song is not in the library yet.'); return; }
      pickUserAlbum([t.id], String(label || t.name || 'Downloaded song'));
    }catch(_eAlbumPick){}
  };
"""

ARM_HELPER_OLD = """  function scAddConvertedToLibrary(blob, meta, opts){
"""

ARM_HELPER_NEW = """  // 80.3.2 - arm the "+ Album" button a finished download card carries. The listener is attached
  // after the card is in the document, so a click can only file the song just written.
  function scArmAddToAlbum(rootEl, track, label){
    try{
      if(!rootEl || !track) return;
      var b = rootEl.querySelector('.sc-add-album');
      if(!b) return;
      b.addEventListener('click', function(ev){
        try{ ev.preventDefault(); ev.stopPropagation(); }catch(_ePrev){}
        try{ window.__scAlbumPickForTrack(track.id, label || track.name); }catch(_eOpen){}
      });
    }catch(_eArm){}
  }
  function scAddConvertedToLibrary(blob, meta, opts){
"""

YT_BUTTON_OLD = """>Open in tab</button>' +
          '</div></div>';
"""

YT_BUTTON_NEW = """>Open in tab</button>' +
          (addedYt ? '<button class="sc-add-album" style="padding:5px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer; margin-left:6px;">+ Album</button>' : '') +
          '</div></div>';
"""

YT_ARM_OLD = """      toast(addedYt ? ((_libClean.name || 'The song') + ' is in your library (All songs).') : (ext.toUpperCase() + ' ready! Tap Download.'), 5000);
"""

YT_ARM_NEW = """      scArmAddToAlbum(resultEl, addedYt, (_libClean.name || title || 'Downloaded song'));
""" + YT_ARM_OLD

SP_BUTTON_OLD = """            '<button onclick="window.__csSpFormats()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">\u21bb Other format</button>' +
            '</div></div>';
        }
"""

SP_BUTTON_NEW = """            '<button onclick="window.__csSpFormats()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">\u21bb Other format</button>' +
            (addedSingle ? '<button class="sc-add-album" style="padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink);font-size:11px;font-weight:600;cursor:pointer;margin-left:6px;">+ Album</button>' : '') +
            '</div></div>';
        }
"""

SP_ARM_OLD = """        scConvertPillDone(addedSingle ? ((csMeta.title || 'The song') + ' is in your library') : 'Converted, but it could not be added to the library');
"""

SP_ARM_NEW = """        scArmAddToAlbum(resultEl, addedSingle, (csMeta.title || 'Downloaded song'));
""" + SP_ARM_OLD

SWAPS = [
    (ALBUM_HOOK_OLD, ALBUM_HOOK_NEW, 'the album card order export'),
    (ARM_HELPER_OLD, ARM_HELPER_NEW, 'the library save'),
    (YT_BUTTON_OLD, YT_BUTTON_NEW, 'the YouTube single card'),
    (YT_ARM_OLD, YT_ARM_NEW, 'the YouTube card toast'),
    (SP_BUTTON_OLD, SP_BUTTON_NEW, 'the Spotify single card'),
    (SP_ARM_OLD, SP_ARM_NEW, 'the Spotify card pill'),
]
