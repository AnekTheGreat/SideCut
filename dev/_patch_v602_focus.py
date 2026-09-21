#!/usr/bin/env python3
"""v60.2 follow-up — the record-player highlight has to survive a re-render.

The tap adds `sc-album-focus` straight to the row element. Any list re-render
(a playback-state repaint, a sort, a re-render of the album cards) rebuilds the
rows from scratch and silently drops that class, so on a busy Library the
highlight could vanish a few hundred ms after the tap. The class is now derived
from a short-lived focus record instead, so it is re-applied by the row builders
themselves for as long as the focus lasts.
"""
import io, sys

p = 'index.html'
src = io.open(p, encoding='utf-8').read()


def rep(label, old, new, count=1):
    global src
    n = src.count(old)
    if n != count:
        sys.exit('ANCHOR FAIL %s: expected %d, found %d\n---\n%s' % (label, count, n, old[:300]))
    src = src.replace(old, new, count)
    print('ok  ' + label)


# 1. the focus record + helper, right beside the jump it serves
rep('focus helper',
    "  window.__scJumpToPlayingSong = jumpToPlayingSong;",
    """  window.__scJumpToPlayingSong = jumpToPlayingSong;

  // The "here is the song you asked for" highlight is a record, not a one-shot
  // class write. A re-render (a playback-state repaint, a sort, the album cards
  // redrawing) rebuilds every row element, which silently threw the class away —
  // so tapping the record player could highlight the row and then lose it a
  // moment later. The row builders below ask for the class instead, so the
  // highlight simply comes back with the row.
  let _scFocusTrackId = null;
  let _scFocusUntil = 0;
  function scFocusClassFor(tid){
    try{
      if(!_scFocusTrackId || _scFocusTrackId !== tid) return '';
      if(Date.now() >= _scFocusUntil){ _scFocusTrackId = null; return ''; }
      return ' sc-album-focus';
    }catch(_e){ return ''; }
  }
  function scFocusRow(trackId, ms){
    if(!trackId) return;
    ms = ms || 3000;
    _scFocusTrackId = trackId;
    _scFocusUntil = Date.now() + ms;
    try{
      const pane = $('listPane');
      if(pane){
        Array.prototype.forEach.call(pane.querySelectorAll('.track[data-id="' + trackId + '"]'),
                                     function(r){ r.classList.add('sc-album-focus'); });
      }
    }catch(_e){}
    setTimeout(function(){
      try{
        if(_scFocusTrackId !== trackId) return;   // a newer jump owns the highlight
        _scFocusTrackId = null;
        const pane = $('listPane');
        if(pane){
          Array.prototype.forEach.call(pane.querySelectorAll('.sc-album-focus'),
                                       function(r){ r.classList.remove('sc-album-focus'); });
        }
      }catch(_e){}
    }, ms);
  }
  window.__scFocusRow = scFocusRow;""")

# 2. the album jump hands the highlight to the record
rep('album jump uses the focus record',
    """        row.classList.add('sc-album-focus');
        setTimeout(() => { try{ row.classList.remove('sc-album-focus'); }catch(_eC){} }, 3000);""",
    """        scFocusRow(t.id);""")

# 3. and so does the playlist jump
rep('playlist jump uses the focus record',
    """        row.classList.add('sc-album-focus');
        setTimeout(function(){ try{ row.classList.remove('sc-album-focus'); }catch(_eC){} }, 3000);""",
    """        scFocusRow(t.id);""")

# 4. every row builder re-applies it while the focus lasts
rep('playlist rows carry the focus',
    "              row.className = 'track' + (tid === _nowPlayingId ? ' playing' : '');",
    "              row.className = 'track' + (tid === _nowPlayingId ? ' playing' : '') + scFocusClassFor(tid);")
rep('reorder-tray rows carry the focus',
    "            row.className = 'track' + (tid === _nowPlayingId ? ' playing' : '');",
    "            row.className = 'track' + (tid === _nowPlayingId ? ' playing' : '') + scFocusClassFor(tid);")
rep('album card rows carry the focus',
    "            row.className = 'track' + (tid === id ? ' playing' : '');",
    "            row.className = 'track' + (tid === id ? ' playing' : '') + scFocusClassFor(tid);")
rep('the main list rows carry the focus',
    "      row.className = 'track' + (selectMode && selectedIds.has(id) ? ' selected' : '') + (reorderMode ? ' reordering' : '');",
    "      row.className = 'track' + (selectMode && selectedIds.has(id) ? ' selected' : '') + (reorderMode ? ' reordering' : '') + scFocusClassFor(id);")
rep('album reorder rows carry the focus',
    "                _row.className = 'track' + (_tid === t.id ? ' playing' : '');",
    "                _row.className = 'track' + (_tid === t.id ? ' playing' : '') + scFocusClassFor(_tid);")

io.open(p, 'w', encoding='utf-8').write(src)
print('focus survives re-renders')
