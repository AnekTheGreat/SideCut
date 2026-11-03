#!/usr/bin/env python3
"""81.5 - the Library pill is never a dead door, cropping is done by ear, Studio
gets DJ sets, and the cloud layout gets room to breathe.

    python3 dev/patch-815.py
    python3 dev/patch-815.py --check

1. THE DEAD LIBRARY PILL. From Studio or Tools, tapping Library did nothing at all
   until you went Home first and tapped it again. Two ways in, one of them the only
   one that showed: on the source the handler handed the tap to scShelfOpenTab and
   RETURNED, and that function treats "the page is already the page" as nothing to
   do - so a tap from a view that never showed the library opened nothing. On the
   device side the handler ran its playlist picking BEFORE navigate(), so anything
   thrown while picking took the navigation with it. Both are answered here: the
   pill navigates whenever the library is not the view it is standing on, and
   nothing in the picking can take that navigation down with it.

2. CROPPING BY EAR. A range picked by dragging two edges is a guess about a song you
   cannot hear. The clip sheet now carries a transport: play from the start, stop,
   loop the range, a playhead you can drop anywhere by pressing the bar, and Set the
   start here / Set the end here at the moment you are hearing. The range stops the
   sound itself at its own end, so what you audition is exactly what you export.

3. DJ SETS. A named run of songs in your own order with a blend between them, built
   in Studio for the wedding and the reception. Presets, add the working song,
   reorder, sort by the tempo the app read, choose the blend, then play it (as a
   real playlist the app owns) or delete it.

4. THE CLOUD LAYOUT. Spacing, a capped now bar, press feedback on the bubbles and a
   dock that is glass rather than a stripe: nothing moved, everything has room.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '81.5'
MARKER = '81.5 - A DOCK PILL IS A DOOR, EVEN WHEN THE PAGE IS ALREADY DRAWN'
ANCHOR = "  { version: '81.4',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-815: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


def done():
    if failed:
        print('patch-815: %d step(s) could not be applied, nothing was written:' % len(failed))
        for f in failed:
            print('  - ' + f)
        sys.exit(2)
    if CHECK:
        print('patch-815: %d step(s) would be applied - the page is not %s yet' % (len(applied), VERSION))
        sys.exit(1)
    with open(INDEX, 'w', encoding='utf-8') as fh:
        fh.write(SRC)
    print('patch-815: %d step(s) applied - the page is %s' % (len(applied), VERSION))


# -- 0. the release itself ----------------------------------------------------
once('the page says 81.5',
     "const APP_VERSION = '81.4';",
     "const APP_VERSION = '81.5';")

once('the changelog has its head entry',
     ANCHOR,
     """  // 81.5 - THE LIBRARY PILL IS NEVER A DEAD DOOR, CROPPING IS DONE BY EAR, AND
  // STUDIO HAS DJ SETS.
  { version: '81.5', date: 'November 3, 2026 · 2:06 PM EST', title: 'Library opens on the first tap, and Studio can build a set', items: [
    '[FULL] Moving around is fixed: Library opens on the first tap from Studio or Tools, and the cloud layout spaces its bubbles and its top bar so nothing sits on top of anything else.',
    '[FULL] Cropping is done by ear: play the song inside the crop sheet, drop the playhead anywhere in it, and set the start or the end at the second you are hearing.',
    '[FULL] Studio has DJ sets: name a set, add songs, reorder them or sort them by tempo, choose the blend, then play it or keep it as a playlist.'
  ]},
""" + ANCHOR)

# -- 1. the Library pill ------------------------------------------------------
once('the shelf knows when the library is not the view',
     "  var scShelf = { page: 'library', src: 'd', open: false, built: false };",
     """  var scShelf = { page: 'library', src: 'd', open: false, built: false };
  // 81.5 - A DOCK PILL IS A DOOR, EVEN WHEN THE PAGE IS ALREADY DRAWN. The page the
  // shelf thinks it is on and the page the screen is showing are two different facts,
  // and the shelf only knew the first one: from Studio or Tools, where the library has
  // never been painted, "the page is already library" was true and a tap opened
  // nothing. This answers the second fact, so a tap that crosses views always paints.
  function scShelfAway(){
    try{
      var lib = document.getElementById('library');
      if(!lib) return true;
      var st = document.getElementById('studioView');
      if(st && st.classList.contains('active')) return true;
      var hv = document.getElementById('homeView');
      if(hv && hv.classList.contains('active')) return true;
      var dv = document.getElementById('discoverView');
      if(dv && dv.classList.contains('active')) return true;
      return lib.style.display === 'none';
    }catch(e){ return true; }
  }""")

once('the shelf opens a page from another view',
     "  function scShelfOpenTab(tab){",
     "  function scShelfOpenTab(tab, force){")


once('a page that is up is only "already up" in the same view',
     """    var already = (page === scShelf.page) &&
      ((scShelf.src === 's') ? (scShelf.open && !scStreamState.pl) : !scShelf.open);""",
     """    // 81.5 - "ALREADY UP" IS A FACT ABOUT THE SCREEN, NOT ABOUT THE STORE.
    var already = !force && !scShelfAway() && (page === scShelf.page) &&
      ((scShelf.src === 's') ? (scShelf.open && !scStreamState.pl) : !scShelf.open);""")

once('the source side of the pill stops swallowing the tap',
     """    // through to the library exactly as before.
    if(typeof scShelf !== 'undefined' && scShelf.src === 's'){ scShelfOpenTab('library'); return; }""",
     """    // through to the library exactly as before.
    if(typeof scShelf !== 'undefined' && scShelf.src === 's'){
      // 81.5 - AND FROM ANOTHER VIEW IT ALWAYS PAINTS. The forced open is what makes
      // a tap in Studio or Tools land on the library instead of on nothing.
      try{ scShelfOpenTab('library', (typeof scShelfAway === 'function') ? scShelfAway() : false); }
      catch(_eLibShelf){ try{ navigate('library'); }catch(_eLibShelf2){} }
      return;
    }""")

once('nothing in the picking can take the navigation with it',
     """    activePlaylist = pickReal();
    if(autoScrollToSong) renderListInner._scrollToPlaying = true; // land on the currently playing song — must be set BEFORE navigate() which calls renderList()
    navigate('library');
    renderTabs();""",
     """    // 81.5 - A THROW WHILE PICKING IS NOT A DEAD DOOR. The playlist this lands on is a
    // preference; arriving in the library is the promise. A pick that cannot be made
    // falls back to All Songs, and the navigation below runs either way.
    try{ activePlaylist = pickReal(); }catch(_eLibPick){ activePlaylist = 'All Songs'; }
    try{ if(autoScrollToSong && renderListInner) renderListInner._scrollToPlaying = true; }catch(_eScrollFlag){} // land on the currently playing song — must be set BEFORE navigate() which calls renderList()
    navigate('library');
    try{ renderTabs(); }catch(_eLibTabs){}""")

# -- 2. cropping by ear -------------------------------------------------------
once('the clip sheet keeps a player, a playhead and a loop',
     "  var clip = { start: 0, end: 30, dur: 0, tr: null, busy: false };",
     """  // 81.5 - A RANGE IS PICKED BY EAR, SO THE SHEET CAN MAKE SOUND. The element is made
  // once and kept for the life of the sheet: repainting the panel must not stop the
  // song you are listening to in order to find the part.
  var clip = { start: 0, end: 30, dur: 0, tr: null, busy: false,
               audio: null, aUrl: '', at: 0, loop: false, playing: false };""")

once('opening the sheet stops the last sheet sound',
     """  function openClipSheet(preStart, preEnd){
    var t = workTrack();""",
     """  function openClipSheet(preStart, preEnd){
    scClipHalt();
    var t = workTrack();""")

once('the bar carries a playhead and two grab edges',
     """        '<div class="sc-clipedge start" id="scClipStart"></div>' +
        '<div class="sc-clipedge end" id="scClipEnd"></div>' +""",
     """        '<div class="sc-clipedge start" id="scClipStart"></div>' +
        '<div class="sc-clipedge end" id="scClipEnd"></div>' +
        '<div class="sc-cliphead" id="scClipHead"></div>' +
        '<div class="sc-clipgrab" id="scClipGrabStart" data-clipgrab="from" aria-label="Drag the start"></div>' +
        '<div class="sc-clipgrab" id="scClipGrabEnd" data-clipgrab="to" aria-label="Drag the end"></div>' +""")

once('the transport and the two Set buttons',
     "      '<div class=\"sc-row2\">' +",
     """      '<div class="sc-cliptransport">' +
        '<button class="sc-btn tiny" id="scClipPlayBtn">\\u25b6 Play from the start</button>' +
        '<button class="sc-btn tiny" id="scClipStopBtn">Stop</button>' +
        '<button class="sc-btn tiny" id="scClipLoopBtn">Loop</button>' +
        '<span class="sc-clipat" id="scClipAt">' + secToClock(clip.at) + '</span>' +
      '</div>' +
      '<div class="sc-chips">' +
        '<button class="sc-chip" id="scClipSetFrom">Set the start here</button>' +
        '<button class="sc-chip" id="scClipSetTo">Set the end here</button>' +
        '<button class="sc-chip" data-clipnudge="-0.1">\\u22120.1s</button>' +
        '<button class="sc-chip" data-clipnudge="0.1">+0.1s</button>' +
      '</div>' +
      '<div class="sc-row2">' +""")

once('the sheet is wired when it is painted',
     """    openSheet('Export a clip', body);
    paintClipSel();""",
     """    openSheet('Export a clip', body);
    paintClipSel();
    scClipWire();""")

once('the selection also places the grabs',
     """  function paintClipSel(){
    var pct = function(v){ return (clip.dur ? (v / clip.dur) * 100 : 0) + '%'; };
    var sel = $('scClipSel');
    if(sel) { sel.style.left = pct(clip.start); sel.style.right = (100 - (clip.dur ? (clip.end / clip.dur) * 100 : 0)) + '%'; }
    var s = $('scClipStart'); if(s) s.style.left = pct(clip.start);
    var e = $('scClipEnd'); if(e) e.style.left = pct(clip.end);
    var l = $('scClipLen'); if(l) l.textContent = secToClock(Math.max(0, clip.end - clip.start));
  }""",
     """  function paintClipSel(){
    var pct = function(v){ return (clip.dur ? (v / clip.dur) * 100 : 0) + '%'; };
    var sel = $('scClipSel');
    if(sel) { sel.style.left = pct(clip.start); sel.style.right = (100 - (clip.dur ? (clip.end / clip.dur) * 100 : 0)) + '%'; }
    var s = $('scClipStart'); if(s) s.style.left = pct(clip.start);
    var e = $('scClipEnd'); if(e) e.style.left = pct(clip.end);
    var gs = $('scClipGrabStart'); if(gs) gs.style.left = pct(clip.start);
    var ge = $('scClipGrabEnd'); if(ge) ge.style.left = pct(clip.end);
    var l = $('scClipLen'); if(l) l.textContent = secToClock(Math.max(0, clip.end - clip.start));
    paintClipHead();
  }
  /* 81.5 - CROPPING BY EAR.
     The range used to be two numbers and two edges you could not move; finding the
     second a song should start at meant exporting, listening, and trying again. This
     is the transport that makes the sheet a place to listen in: the song plays from
     the start of the range, the bar is a playhead you can drop anywhere, Loop keeps
     the range going while you move the edges, and the two Set buttons take the moment
     you are hearing as the start or the end. The element stops itself at the end of
     the range, so what you audition is exactly what the export writes. */
  function scClipHalt(){
    try{ if(clip.audio) clip.audio.pause(); }catch(_eHalt){}
    clip.playing = false;
    paintClipTransport();
  }
  function scClipAudio(){
    if(clip.audio) return clip.audio;
    var t = clip.tr;
    if(!t || !t.file) return null;
    try{
      clip.aUrl = URL.createObjectURL(t.file);
      var a = new Audio(clip.aUrl);
      a.preload = 'auto';
      a.addEventListener('timeupdate', function(){
        clip.at = Number(a.currentTime) || 0;
        if(clip.end > clip.start && clip.at >= clip.end - 0.03){
          if(clip.loop){ try{ a.currentTime = clip.start; }catch(_eLoopSeek){} }
          else { try{ a.pause(); }catch(_eLoopPause){} clip.playing = false; paintClipTransport(); }
        }
        paintClipHead();
      });
      a.addEventListener('play', function(){ clip.playing = true; paintClipTransport(); });
      a.addEventListener('pause', function(){ clip.playing = false; paintClipTransport(); });
      a.addEventListener('ended', function(){ clip.playing = false; paintClipTransport(); });
      clip.audio = a;
    }catch(_eAudio){ clip.audio = null; }
    return clip.audio;
  }
  function clipPlay(from){
    var a = scClipAudio();
    if(!a){ toast('This song has no audio file to play.'); return false; }
    try{
      var at = (from == null) ? clip.start : from;
      var dur = clip.dur || Number(a.duration) || 0;
      a.currentTime = Math.max(0, Math.min(dur || at, at));
      clip.at = a.currentTime;
      var p = a.play();
      if(p && p.catch) p.catch(function(){ clip.playing = false; paintClipTransport(); });
      clip.playing = true;
      paintClipTransport();
      return true;
    }catch(_ePlay){ return false; }
  }
  function paintClipTransport(){
    var b = $('scClipPlayBtn');
    if(b) b.textContent = clip.playing ? '\\u275a\\u275a Pause' : '\\u25b6 Play from the start';
    var l = $('scClipLoopBtn');
    if(l) l.classList.toggle('on', !!clip.loop);
  }
  function paintClipHead(){
    var h = $('scClipHead');
    var pct = clip.dur ? (clip.at / clip.dur) * 100 : 0;
    if(h) h.style.left = Math.max(0, Math.min(100, pct)) + '%';
    var r = $('scClipAt');
    if(r) r.textContent = secToClock(clip.at || 0);
  }
  function clipSetFrom(v, which){
    var at = Math.max(0, Math.min(clip.dur || 0, Number(v) || 0));
    if(which === 'from') clip.start = Math.max(0, Math.min(at, clip.end - 0.5));
    else clip.end = Math.max(clip.start + 0.5, Math.min(clip.dur || at, at));
    var f = $('scClipFrom'); if(f) f.value = secToClock(clip.start);
    var t = $('scClipTo'); if(t) t.value = secToClock(clip.end);
    paintClipSel();
  }
  function scClipWire(){
    var bar = $('scClipBar');
    if(bar && !bar.__sc815){
      bar.__sc815 = true;
      var mode = '';
      var at = function(ev){
        var r = bar.getBoundingClientRect();
        var want = Math.max(0, Math.min(1, (ev.clientX - r.left) / (r.width || 1)));
        return want * (clip.dur || 0);
      };
      bar.addEventListener('pointerdown', function(ev){
        var el = ev.target && ev.target.closest ? ev.target.closest('[data-clipgrab]') : null;
        mode = el ? el.getAttribute('data-clipgrab') : 'seek';
        try{ bar.setPointerCapture(ev.pointerId); }catch(_eCap){}
        try{ ev.preventDefault(); }catch(_ePrevent){}
        clip.at = at(ev);
        if(mode === 'seek'){ paintClipHead(); clipPlay(clip.at); }
        else clipSetFrom(clip.at, mode);
      });
      bar.addEventListener('pointermove', function(ev){
        if(!mode) return;
        clip.at = at(ev);
        if(mode === 'seek'){
          if(clip.audio){ try{ clip.audio.currentTime = clip.at; }catch(_eSeek){} }
          paintClipHead();
        } else clipSetFrom(clip.at, mode);
      });
      var off = function(ev){
        mode = '';
        if(ev && ev.pointerId != null){ try{ bar.releasePointerCapture(ev.pointerId); }catch(_eRel){} }
      };
      bar.addEventListener('pointerup', off);
      bar.addEventListener('pointercancel', off);
    }
    var play = $('scClipPlayBtn');
    if(play) play.addEventListener('click', function(){
      if(clip.playing) scClipHalt();
      else clipPlay(clip.start);
    });
    var stop = $('scClipStopBtn');
    if(stop) stop.addEventListener('click', function(){ scClipHalt(); });
    var loop = $('scClipLoopBtn');
    if(loop) loop.addEventListener('click', function(){ clip.loop = !clip.loop; paintClipTransport(); });
    var sf = $('scClipSetFrom');
    if(sf) sf.addEventListener('click', function(){ clipSetFrom(clip.at, 'from'); });
    var se = $('scClipSetTo');
    if(se) se.addEventListener('click', function(){ clipSetFrom(clip.at, 'to'); });
    var cancel = $('scClipCancel');
    if(cancel) cancel.addEventListener('click', function(){ scClipHalt(); });
    paintClipTransport();
    paintClipHead();
  }""")

# -- 3. the styles ------------------------------------------------------------
once('the styles for the playhead, the grabs and the sets',
     ".sc-clipedge{ position: absolute; top: 0; bottom: 0; width: 2px; background: var(--coral); }",
     """.sc-clipedge{ position: absolute; top: 0; bottom: 0; width: 2px; background: var(--coral); }
/* 81.5 - the playhead, the two grab edges and the little transport under the bar. */
.sc-cliphead{ position: absolute; top: 0; bottom: 0; width: 2px; background: var(--ink); opacity: 0.8; pointer-events: none; z-index: 3; }
.sc-clipgrab{ position: absolute; top: 0; bottom: 0; width: 20px; margin-left: -10px; cursor: ew-resize; touch-action: none; z-index: 4; }
.sc-cliptransport{ display: flex; align-items: center; gap: 6px; margin: 8px 0 2px; flex-wrap: wrap; }
.sc-clipat{ margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--ink-dim); }
/* 81.5 - the cloud layout gets room: bubbles that do not touch, a now bar that
   cannot grow across the glass, and a dock you can see the page through. */
body.sc80-cloud #homeBubbles{ gap: 14px; padding: 6px 2px 26px; }
body.sc80-cloud .home-bubble{ transition: transform 0.14s ease, box-shadow 0.14s ease; }
body.sc80-cloud .home-bubble:active{ transform: scale(0.96); }
body.sc80-cloud #sc80Now{ max-width: min(62vw, 260px); }
body.sc80-cloud #sc80Now .t{ overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
body.sc80-cloud .action-strip{ backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); }
body.sc80-cloud #homeView, body.sc80-cloud #library, body.sc80-cloud #studioView{ scroll-padding-top: calc(var(--sc80-bar) + 20px); }
@media (max-width: 420px){
  body.sc80-cloud #homeBubbles{ gap: 11px; }
  body.sc80-cloud .home-bubble .hb-value{ font-size: calc(20px * var(--hb-s, 1)); }
}
/* 81.5 - DJ sets, in Studio. */
.sc80-dj-set{ border: 1px solid var(--line); border-radius: 14px; padding: 10px 12px; margin: 10px 0; background: var(--bg-raised); }
.sc80-dj-head{ display: flex; align-items: baseline; gap: 8px; margin-bottom: 6px; }
.sc80-dj-title{ font-size: 13px; font-weight: 700; flex: 1; }
.sc80-dj-meta{ font-size: 10.5px; color: var(--ink-dim); }
.sc80-dj-row{ display: flex; align-items: center; gap: 6px; padding: 4px 0; border-top: 1px solid var(--line); }
.sc80-dj-n{ width: 16px; text-align: right; font-size: 10px; color: var(--ink-dim); font-family: 'JetBrains Mono', monospace; }
.sc80-dj-name{ flex: 1; min-width: 0; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.sc80-dj-name small{ display: block; font-size: 9.5px; color: var(--ink-dim); }
.sc80-dj-len{ font-size: 10px; color: var(--ink-dim); font-family: 'JetBrains Mono', monospace; }""")

# -- 4. DJ sets, in the Studio module ----------------------------------------
once('DJ sets: the store, the presets and the arithmetic',
     "  function lookCard(){",
     """  /* ------------------------------------------------------------------------
     3b. DJ SETS - a named run of songs, in an order you chose, with a blend
     ------------------------------------------------------------------------ */
  // The ask: "in studio make like a dj playlist thing where you can add songs and
  // remix them for something like wedding playlists or reception playlists". A set is
  // a name, a blend length and an ordered list of songs - the order is the whole
  // point, so it is stored, moved by hand, and can be sorted by the tempo the app
  // already reads for a song. Playing it writes it as a real playlist, so the queue
  // that follows is the set and the next song is the next song in it.
  var DJ_KEY = 'sc80DjSets';
  var DJ_PRESETS = [
    { name: 'Wedding', fade: 4, note: 'Long, gentle blends - dinner, the first dance, the cake.' },
    { name: 'Reception', fade: 2, note: 'Short blends and no gaps - the floor keeps moving.' }
  ];
  function djSets(){
    var v = lsGet(DJ_KEY, []);
    return Array.isArray(v) ? v : [];
  }
  function djSaveSets(list){ lsSet(DJ_KEY, list); }
  function djTracks(){ return call('__scAllTracks') || []; }
  function djTrack(id){
    var all = djTracks();
    for(var i = 0; i < all.length; i++){ if(all[i] && all[i].id === id) return all[i]; }
    return null;
  }
  function djSetIndex(id){
    var list = djSets();
    for(var i = 0; i < list.length; i++){ if(list[i] && list[i].id === id) return i; }
    return -1;
  }
  function djNewSet(name, fade, gap){
    var list = djSets();
    var set = {
      id: 'djs' + Date.now() + Math.floor(Math.random() * 1000),
      name: String(name || 'Set ' + (list.length + 1)),
      fade: (fade == null ? 3 : Math.max(0, Math.min(12, Number(fade) || 0))),
      gap: Math.max(0, Number(gap) || 0),
      entries: [], at: Date.now()
    };
    list.unshift(set);
    djSaveSets(list);
    return set;
  }
  function djAddTrack(setId, trackId){
    var i = djSetIndex(setId);
    if(i < 0) return false;
    var t = djTrack(trackId);
    if(!t) return false;
    var list = djSets();
    list[i].entries = list[i].entries || [];
    list[i].entries.push({
      id: t.id, name: t.name || 'Untitled', artist: t.artist || '',
      secs: Number(t.duration) || 0, bpm: 0
    });
    djSaveSets(list);
    // The tempo is read in the background and written onto the entry when it lands,
    // so a later Sort by tempo has something real to sort on.
    try{
      if(window.SC70 && SC70.bpmFor){
        SC70.bpmFor(t).then(function(r){
          if(!r || !r.bpm) return;
          var k = djSetIndex(setId);
          if(k < 0) return;
          var l2 = djSets();
          var en = l2[k].entries || [];
          for(var j = 0; j < en.length; j++){ if(en[j].id === t.id && !en[j].bpm) en[j].bpm = Number(r.bpm) || 0; }
          djSaveSets(l2);
          paintDjSets();
        }, function(){});
      }
    }catch(_eDjBpm){}
    return true;
  }
  function djRemoveEntry(setId, ix){
    var i = djSetIndex(setId);
    if(i < 0) return false;
    var list = djSets();
    var en = list[i].entries || [];
    if(ix < 0 || ix >= en.length) return false;
    en.splice(ix, 1);
    djSaveSets(list);
    return true;
  }
  function djMoveEntry(setId, ix, dir){
    var i = djSetIndex(setId);
    if(i < 0) return false;
    var list = djSets();
    var en = list[i].entries || [];
    var j = ix + dir;
    if(ix < 0 || ix >= en.length || j < 0 || j >= en.length) return false;
    var tmp = en[ix]; en[ix] = en[j]; en[j] = tmp;
    djSaveSets(list);
    return true;
  }
  // Sort by tempo, keeping the songs whose tempo could not be read where they are
  // relative to each other: a known tempo is a fact, an unknown one is not a zero.
  function djMixOrder(entries){
    var out = (entries || []).slice();
    out.sort(function(a, b){
      var ba = Number(a && a.bpm) || 0, bb = Number(b && b.bpm) || 0;
      if(ba && bb) return (ba - bb) || String(a.name || '').localeCompare(String(b.name || ''));
      if(ba) return -1;
      if(bb) return 1;
      return String(a && a.name || '').localeCompare(String(b && b.name || ''));
    });
    return out;
  }
  function djMix(setId){
    var i = djSetIndex(setId);
    if(i < 0) return false;
    var list = djSets();
    list[i].entries = djMixOrder(list[i].entries);
    djSaveSets(list);
    return true;
  }
  function djSetFade(setId, secs){
    var i = djSetIndex(setId);
    if(i < 0) return false;
    var list = djSets();
    list[i].fade = Math.max(0, Math.min(12, Number(secs) || 0));
    djSaveSets(list);
    return true;
  }
  function djSetStats(set){
    var entries = (set && set.entries) || [];
    var secs = 0, known = 0;
    for(var i = 0; i < entries.length; i++){
      secs += Number(entries[i] && entries[i].secs) || 0;
      if(Number(entries[i] && entries[i].bpm)) known++;
    }
    var fade = Math.max(0, Number(set && set.fade) || 0);
    // Each blend after the first gives the fade back: the set is the songs minus the
    // overlaps, which is how a set is counted out loud.
    var total = Math.max(0, secs - fade * Math.max(0, entries.length - 1));
    return { count: entries.length, secs: secs, total: total, known: known, fade: fade, gap: Math.max(0, Number(set && set.gap) || 0) };
  }
  function djClock(secs){
    var s = Math.max(0, Math.round(Number(secs) || 0));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    var mm = (h ? (m < 10 ? '0' : '') + m : String(m)) + ':' + (r < 10 ? '0' : '') + r;
    return h ? h + ':' + mm : mm;
  }
  function djSay(msg){
    try{
      if(document.getElementById('toast')){
        var t = document.getElementById('toast');
        t.textContent = msg;
        t.classList.add('show');
        setTimeout(function(){ try{ t.classList.remove('show'); }catch(_eSayOff){} }, 2400);
        return;
      }
    }catch(_eSay){}
  }
  function djPlaySet(setId){
    var i = djSetIndex(setId);
    if(i < 0) return false;
    var set = djSets()[i];
    var ids = ((set.entries) || []).map(function(e){ return e && e.id; }).filter(function(id){ return !!djTrack(id); });
    if(!ids.length){ djSay('Add a song to this set first.'); return false; }
    var name = 'Set: ' + (set.name || 'DJ set');
    var made = false;
    try{ made = (typeof window.__scSetPlaylist === 'function') ? !!window.__scSetPlaylist(name, ids) : false; }catch(_ePlaySet){}
    if(!made){ djSay('The set could not be written as a playlist.'); return false; }
    try{ if(typeof window.__scPlayPlaylist === 'function') window.__scPlayPlaylist(name); }catch(_ePlaySet2){}
    djSay(ids.length + ' song' + (ids.length === 1 ? '' : 's') + ' \\u00b7 playing "' + name + '"');
    return true;
  }
  function djSetsCard(){
    var sets = djSets();
    var body;
    if(!sets.length){
      body = '<div class="sc-note">No sets yet. Start one from a preset, then add songs from your library with Add the working song.</div>';
    } else {
      body = sets.map(function(set){
        var st = djSetStats(set);
        var rows = (set.entries || []).map(function(e, ix){
          return '<div class="sc80-dj-row">' +
            '<span class="sc80-dj-n">' + (ix + 1) + '</span>' +
            '<span class="sc80-dj-name">' + esc(e.name) + '<small>' + esc(e.artist || '') + (Number(e.bpm) ? ' \\u00b7 ' + Number(e.bpm) + ' BPM' : '') + '</small></span>' +
            '<span class="sc80-dj-len">' + (Number(e.secs) ? djClock(e.secs) : '') + '</span>' +
            '<button class="sc-btn tiny" data-dj="up" data-set="' + esc(set.id) + '" data-ix="' + ix + '" aria-label="Move up">\\u2191</button>' +
            '<button class="sc-btn tiny" data-dj="down" data-set="' + esc(set.id) + '" data-ix="' + ix + '" aria-label="Move down">\\u2193</button>' +
            '<button class="sc-btn tiny" data-dj="drop" data-set="' + esc(set.id) + '" data-ix="' + ix + '" aria-label="Remove">\\u2715</button>' +
          '</div>';
        }).join('');
        return '<div class="sc80-dj-set" data-set="' + esc(set.id) + '">' +
          '<div class="sc80-dj-head"><div class="sc80-dj-title">' + esc(set.name) + '</div>' +
          '<div class="sc80-dj-meta">' + st.count + ' song' + (st.count === 1 ? '' : 's') + ' \\u00b7 ' + djClock(st.total) +
            (st.fade ? ' \\u00b7 ' + st.fade + 's blends' : '') + '</div></div>' +
          (rows || '<div class="sc-note">Nothing in this set yet.</div>') +
          '<div class="sc-chips" style="margin-top:8px;"><span class="sc-chip-label">Blend</span>' +
            [0, 2, 4, 6].map(function(f){
              return '<button class="sc-chip' + (st.fade === f ? ' on' : '') + '" data-dj="fade" data-fade="' + f + '" data-set="' + esc(set.id) + '">' + (f ? f + 's' : 'none') + '</button>';
            }).join('') +
          '</div>' +
          '<div class="sc-actions">' +
            '<button class="sc-btn tiny primary" data-dj="add" data-set="' + esc(set.id) + '">Add the working song</button>' +
            '<button class="sc-btn tiny" data-dj="mix" data-set="' + esc(set.id) + '">Sort by tempo</button>' +
          '</div>' +
          '<div class="sc-actions">' +
            '<button class="sc-btn tiny" data-dj="play" data-set="' + esc(set.id) + '">Play the set</button>' +
            '<button class="sc-btn tiny" data-dj="dropSet" data-set="' + esc(set.id) + '">Delete the set</button>' +
          '</div>' +
        '</div>';
      }).join('');
    }
    return '<div class="sc-sec" id="sc80DjSets">' +
      '<div style="font-size:13.5px;font-weight:700;margin-bottom:2px;">DJ sets</div>' +
      '<div class="sc-note">A named run of songs in your own order, with a blend between them \\u2014 built for a wedding or a reception and played in one tap.</div>' +
      '<div class="sc-chips">' + DJ_PRESETS.map(function(p){
        return '<button class="sc-chip" data-dj="preset" data-name="' + esc(p.name) + '" data-fade="' + p.fade + '" title="' + esc(p.note) + '">' + esc(p.name) + '</button>';
      }).join('') +
        '<button class="sc-chip" data-dj="preset" data-name="" data-fade="3">+ New set</button>' +
      '</div>' +
      body +
    '</div>';
  }
  function paintDjSets(){
    var host = $('studioView');
    var old = $('sc80DjSets');
    if(!host || !old || !old.parentNode) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = djSetsCard();
    var fresh = wrap.firstChild;
    if(fresh) old.parentNode.replaceChild(fresh, old);
  }
  function wireDjSets(root){
    if(!root || root.__sc80Dj) return;
    root.__sc80Dj = true;
    root.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-dj]') : null;
      if(!t) return;
      var act = t.getAttribute('data-dj');
      var setId = t.getAttribute('data-set') || '';
      var ix = parseInt(t.getAttribute('data-ix') || '-1', 10);
      if(act === 'preset'){
        var name = t.getAttribute('data-name') || '';
        var fade = Number(t.getAttribute('data-fade')) || 3;
        djNewSet(name || 'Set ' + (djSets().length + 1), fade, 0);
        paintDjSets();
        return;
      }
      if(act === 'add'){
        var track = null;
        try{ track = (window.SC70 && SC70.workTrack) ? SC70.workTrack() : null; }catch(_eWork){}
        if(!track){ djSay('Load a song in Studio first.'); return; }
        if(djAddTrack(setId, track.id)){ paintDjSets(); djSay('Added "' + (track.name || 'the song') + '" to the set.'); }
        return;
      }
      if(act === 'mix'){ djMix(setId); paintDjSets(); djSay('Sorted by the tempo each song reads.'); return; }
      if(act === 'play'){ djPlaySet(setId); return; }
      if(act === 'fade'){ djSetFade(setId, Number(t.getAttribute('data-fade')) || 0); paintDjSets(); return; }
      if(act === 'up'){ djMoveEntry(setId, ix, -1); paintDjSets(); return; }
      if(act === 'down'){ djMoveEntry(setId, ix, 1); paintDjSets(); return; }
      if(act === 'drop'){ djRemoveEntry(setId, ix); paintDjSets(); return; }
      if(act === 'dropSet'){
        var list = djSets().filter(function(s){ return s && s.id !== setId; });
        djSaveSets(list);
        paintDjSets();
        return;
      }
    });
  }
  function lookCard(){""")

once('the sets are drawn in the Studio half',
     "    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + playsCard() + apkCard() + lookCard());",
     """    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + playsCard() + apkCard() + lookCard());
    // 81.5 - the sets belong to the creative half, next to the tools that make the
    // songs: building a run for a wedding is Studio work, not settings.
    paneStudio.insertAdjacentHTML('beforeend', djSetsCard());""")

once('the sets are wired once per paint',
     """    wireLookCard(paneTools);
    paintStudioTab();""",
     """    wireLookCard(paneTools);
    wireDjSets(paneStudio);
    paintStudioTab();""")

done()
