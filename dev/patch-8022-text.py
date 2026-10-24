#!/usr/bin/env python3
"""80.2.2 - the text this release writes into the page, part one.

The page is one 3.5 MB file and a payload travels through an API call, so the new
text lives in two small modules and patch-8022.py does the cutting. Loaded by path,
the way dev/release-record.py loads dev/agents-shipping-note.py.
"""

MENU_COMMENT = r'''<!-- The now bar has no 3-dot menu of its own: it opens the song sheet below, the
     same one a song row opens. 80.2.2 removed the second menu that only the bar
     had, so the two entry points cannot answer differently. -->

'''

NP_NEW = r'''  // ---------------- The song menu (3-dot) ----------------
  // ONE MENU, TWO WAYS IN. A song row's 3-dot has always opened openSongActions;
  // the now bar's opened a second, shorter menu of its own, which is how the two
  // drifted apart. 80.2.2 gives the bar the song's menu, so a song answers the same
  // wherever the dots are. The three switches the slim bar no longer paints -
  // Shuffle, Repeat and DJ Mode - are a Playback group inside that sheet, and
  // they still click the very buttons on the bar, so there is one switch each.
  function showNpMenu() {
    if(queueIndex < 0 || queueIndex >= queue.length) {
      toast('Play a song first');
      return;
    }
    const id = queue[queueIndex];
    if(!allTracks.some(tr => tr.id === id)) return;
    openSongActions(id);
  }

  $('npMenuBtn').addEventListener('click', showNpMenu);
'''

SONG_DOWNLOAD = r'''
    // 80.2.2 - ONE SONG, ON THE PHONE. This is the same writer the playlist sheet
    // uses for "Download to phone", handed one id: the audio file this song
    // already plays, written to the phone's Documents folder under its own name.
    // No zip, no second copy in memory, and nothing to import afterwards.
    const dlSongBtn = document.createElement('button');
    dlSongBtn.id = 'songActionsDownload';
    dlSongBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 20h14v-2H5v2zm7-18L5.33 9h4.17v6h4V9h4.17L12 2z"/></svg> Download this song`;
    dlSongBtn.addEventListener('click', () => {
      $('songActionsBackdrop').style.display='none';
      downloadTracksToDevice([id], 'Downloading this song');
    });
    list.appendChild(dlSongBtn);
'''

SHEET_TAIL_OLD = r'''    try{ if(typeof window.__scDecorSongSheet === 'function') window.__scDecorSongSheet(); }catch(_eScSheet){}
    $('songActionsBackdrop').style.display = 'flex';
  }
'''

SHEET_TAIL_NEW = r'''    try{ if(typeof window.__scDecorSongSheet === 'function') window.__scDecorSongSheet(); }catch(_eScSheet){}
    // The Playback group is appended AFTER the grouping: the decor sweeps every
    // button it finds into Play / Edit / Organize / Share / Danger, and these
    // three are none of those - they are the bar's switches, at the bottom.
    try{ appendPlaybackGroup(list); }catch(_ePlayback){}
    $('songActionsBackdrop').style.display = 'flex';
  }

  // THE PLAYBACK SWITCHES THE SLIM BAR HIDES. Shuffle, Repeat and DJ Mode were
  // rows in the now bar's own menu until 80.2.2 folded that menu into this sheet.
  // Each row clicks the button on the bar itself, so the state, the toast and
  // the styling are the ones the bar already owns - not a second copy. The two
  // toggles stay open and redraw their own label; DJ Mode opens the deck, so it
  // closes the sheet the way every other deck entry point does.
  function appendPlaybackGroup(host){
    if(!host) return;
    const sec = document.createElement('div');
    sec.className = 'sc-sheet-group';
    sec.id = 'songActionsPlaybackGroup';
    const lab = document.createElement('div');
    lab.className = 'sc-sheet-group-label';
    lab.textContent = 'Playback';
    sec.appendChild(lab);
    const box = document.createElement('div');
    box.className = 'sc-sheet-group-body';
    const rows = [
      { btn: 'shuffleBtn',
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14.83 13.41l1.41-1.41 3.83 3.83-3.83 3.83-1.41-1.41 1.42-1.42H14a3 3 0 01-2.24-1l-3.28-3.65A1 1 0 007.76 13H3v-2h4.76a3 3 0 012.24 1l3.28 3.65a1 1 0 00.72.35h2.24l-1.42-1.42zM14.83 4.59L16.24 3.18 20.07 7l-3.83 3.83-1.41-1.41L16.24 8H14a1 1 0 00-.72.35L11.15 10.6 9.7 9.03l1.83-2.03a3 3 0 012.24-1h2.24l-1.42-1.41zM3 7h2.76a3 3 0 012.24 1l.7.78-1.45 1.57-.7-.78a1 1 0 00-.72-.35H3z"/></svg>',
        label: function(){ return 'Shuffle: ' + (shuffle ? 'on' : 'off'); } },
      { btn: 'repeatBtn',
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
        label: function(){ return 'Repeat: ' + (repeatMode === 'one' ? 'this song' : repeatMode === 'all' ? 'the queue' : 'off'); } },
      { btn: 'djModeBtn',
        icon: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3v10.55A4 4 0 1014 17V7h4V3h-6z"/></svg>',
        label: function(){ return 'DJ Mode'; } }
    ];
    rows.forEach(function(r){
      const b = document.createElement('button');
      b.setAttribute('data-playback', r.btn);
      b.innerHTML = r.icon + ' <span>' + escapeHtml(r.label()) + '</span>';
      b.addEventListener('click', function(){
        const barBtn = $(r.btn);
        if(barBtn) barBtn.click();
        if(r.btn === 'djModeBtn'){
          $('songActionsBackdrop').style.display = 'none';
          return;
        }
        const span = b.querySelector('span');
        if(span) span.textContent = r.label();
      });
      box.appendChild(b);
    });
    sec.appendChild(box);
    host.appendChild(sec);
  }
'''

