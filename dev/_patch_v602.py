#!/usr/bin/env python3
"""v60.2 — record-player jump follows the tab you are in, and the foreground work that
was costing battery (two full audio decodes per song, 48 hidden bars restyled 4x a
second, the whole theme repainted on every display frame) is cut."""
import io, sys

def patch(path, edits):
    src = io.open(path, encoding='utf-8').read()
    for label, old, new, count in edits:
        n = src.count(old)
        if n != count:
            sys.exit('ANCHOR FAIL %s (%s): expected %d, found %d\n---\n%s' % (path, label, count, n, old[:300]))
        src = src.replace(old, new, count)
        print('ok  %s: %s' % (path, label))
    io.open(path, 'w', encoding='utf-8').write(src)

patch('index.html', [
    # ===================================================== 1. record-player jump
    ('record player follows the tab you are in',
     """    const wanted = t.id;
    navigate('albums');""",
     """    // Which half of the library the tap belongs in follows the tab you are in:
    // in Playlists it takes you to the song in the list you are looking at, in
    // Albums it opens the album that song is in. Falling back to the playlist jump
    // when there is no album keeps the tap from ever dead-ending on a toast.
    const _inAlbums = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');
    if(!_inAlbums || !albumName){ jumpToPlayingSong(t); return; }
    const wanted = t.id;
    navigate('albums');""", 1),

    ('jumpToPlayingSong helper',
     """  window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;""",
     """  window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;

  // Take the user to the playing song inside the library's Playlists half: the
  // list is scrolled to it and the row is tinted for a moment. Like the album
  // jump, the scroll is written on the list pane's own scrollTop and never with
  // scrollIntoView — on Android that call bubbles out of the pane and moves the
  // whole app, which is the "everything lifted up" glitch.
  function jumpToPlayingSong(t){
    if(!t) return;
    try{
      searchQuery = '';
      $('searchInput').value = '';
      // The song has to actually be in the list we are about to scroll, so if the
      // open playlist does not hold it, fall back to All Songs rather than
      // scrolling to nothing.
      if(!(playlists[activePlaylist] || []).includes(t.id)){
        activePlaylist = 'All Songs';
        try{ rememberPlaylist(activePlaylist); }catch(_e){}
      }
      navigate('playlists');
      renderTabs();
      renderList();
    }catch(_e){ toast('Could not open the song list — try again.'); return; }
    setTimeout(function(){
      try{
        const pane = $('listPane');
        if(!pane) return;
        const row = pane.querySelector('.track[data-id="' + t.id + '"]');
        if(!row){ toast('Opened All Songs — "' + t.name + '" is in your library.'); return; }
        cancelScrollAnim(pane);
        smoothScrollIn(pane, row, 220);
        row.classList.add('sc-album-focus');
        setTimeout(function(){ try{ row.classList.remove('sc-album-focus'); }catch(_eC){} }, 3000);
      }catch(_eFocus){}
    }, 140);
  }
  window.__scJumpToPlayingSong = jumpToPlayingSong;""", 1),

    # ===================================================== 2. RGB write churn
    ('RGB stops rewriting the whole theme every frame',
     """      var tNow = (((Date.now() - rgbStartAt) / 1000) / rgbSpeedSeconds()) % 1;
      var hueNow = (rgbBaseHue + tNow * 360) % 360;
      if(!force && rgbLastAppliedHue !== null && Math.abs(hueNow - rgbLastAppliedHue) < 0.25) return;
      rgbLastAppliedHue = hueNow;""",
     """      var tNow = (((Date.now() - rgbStartAt) / 1000) / rgbSpeedSeconds()) % 1;
      var hueNow = (rgbBaseHue + tNow * 360) % 360;
      if(!force){
        // Each apply rewrites --coral/--gold/--glow-a/--glow-b, and those four
        // variables are used by essentially every element — so one write is a full
        // repaint of the app. On a 120Hz phone the old 0.25° rule qualified on
        // EVERY frame: 120 repaints a second for a colour sweep nobody can tell
        // apart from 12. Now a write needs a visible step (0.7°) AND at least
        // 90ms since the last one, which lands at ~11/s — smoother than the old
        // 200ms timer, at a tenth of the frames.
        var nowMs = Date.now();
        if(rgbLastApplyAt && nowMs - rgbLastApplyAt < 90) return;
        if(rgbLastAppliedHue !== null && Math.abs(hueNow - rgbLastAppliedHue) < 0.7) return;
        rgbLastApplyAt = nowMs;
      } else {
        rgbLastApplyAt = Date.now();
      }
      rgbLastAppliedHue = hueNow;""", 1),

    ('rgbLastApplyAt state',
     """  let rgbLastAppliedHue = null;   // last hue actually written to the page""",
     """  let rgbLastAppliedHue = null;   // last hue actually written to the page
  let rgbLastApplyAt = 0;         // when the page was last repainted for the hue""", 1),

    ('reset the stamp with the cycle',
     """    rgbLastAppliedHue = null;
    rgbLastFrameAt = 0;""",
     """    rgbLastAppliedHue = null;
    rgbLastApplyAt = 0;
    rgbLastFrameAt = 0;""", 1),

    # ===================================================== 3. waveform bars
    ('hidden waveform bars are no longer restyled 4x a second',
     """  let currentWaveform = null;
  function updateWaveformDisplay(pct){
    const bars = document.querySelectorAll('#waveformBar .wave-bar');
    bars.forEach((bar, i) => {""",
     """  let currentWaveform = null;
  let _waveBarCache = null;
  function lastSeekPct(){
    try{
      const a = activeAudio();
      if(a && a.duration) return (a.currentTime / a.duration) * 100;
    }catch(_e){}
    return 0;
  }
  function updateWaveformDisplay(pct){
    // These 48 bars are display:none unless the seek style is "Waveform", and the
    // seek bar calls this on every timeupdate — so on the default Line style the
    // app was restyling 96 hidden elements ~4x a second for nothing.
    if(typeof seekStyle !== 'undefined' && seekStyle !== 'waveform') return;
    const container = $('waveformBar');
    if(container && container.style.display === 'none') return;
    if(!_waveBarCache || _waveBarCache.length !== WAVE_BARS ||
       (_waveBarCache[0] && _waveBarCache[0].parentNode !== container)){
      _waveBarCache = container ? container.querySelectorAll('.wave-bar') : null;
    }
    const bars = _waveBarCache || [];
    Array.prototype.forEach.call(bars, (bar, i) => {""", 1),

    ('the decode only happens for a style that is on screen',
     """  function loadWaveformFor(track){
    if(track.waveform){
      currentWaveform = track.waveform;
      updateWaveformDisplay(0);
      return;
    }
    currentWaveform = null;
    updateWaveformDisplay(0);
    computeWaveform(track).then(wf => {
      if(!wf) return;
      track.waveform = wf;
      persistTrackMeta(track);
      if(queue[queueIndex] === track.id){
        currentWaveform = wf;
        const a = activeAudio();
        const pct = a.duration ? (a.currentTime / a.duration) * 100 : 0;
        updateWaveformDisplay(pct);
      }
    });
  }""",
     """  function waveformNeeded(){
    // Only the Waveform seek style draws these bars, and only in the expanded
    // player. computeWaveform decodes the WHOLE song, so it must never run for a
    // style (or a view) that is not being looked at.
    try{
      if(document.hidden) return false;
      if(seekStyle !== 'waveform') return false;
      const np = $('nowPlaying');
      return !!np && !np.classList.contains('mini') && np.style.display !== 'none';
    }catch(_e){ return false; }
  }
  function ensureWaveformForCurrent(){
    try{
      const t = allTracks.find(tr => tr.id === queue[queueIndex]);
      if(t) loadWaveformFor(t);
    }catch(_e){}
  }
  window.__scEnsureWaveform = ensureWaveformForCurrent;
  let _waveformBusyId = null;
  function loadWaveformFor(track){
    if(track.waveform){
      currentWaveform = track.waveform;
      updateWaveformDisplay(lastSeekPct());
      return;
    }
    currentWaveform = null;
    updateWaveformDisplay(lastSeekPct());
    if(!waveformNeeded()) return;      // nothing on screen is drawing it
    if(_waveformBusyId === track.id) return;
    _waveformBusyId = track.id;
    computeWaveform(track).then(wf => {
      _waveformBusyId = null;
      if(!wf) return;
      track.waveform = wf;
      persistTrackMeta(track);
      if(queue[queueIndex] === track.id){
        currentWaveform = wf;
        updateWaveformDisplay(lastSeekPct());
      }
    });
  }""", 1),

    ('switching to the waveform style computes it, and paints it',
     """    dbPut('meta', { key: 'seekStyle', value: style });
    // Refresh whichever is now visible so it shows the correct current position
    const a = activeAudio();
    if(a && a.duration) updateSeekDisplay((a.currentTime / a.duration) * 100);""",
     """    dbPut('meta', { key: 'seekStyle', value: style });
    // Refresh whichever is now visible so it shows the correct current position
    const a = activeAudio();
    if(a && a.duration) updateSeekDisplay((a.currentTime / a.duration) * 100);
    // The bars only get decoded while that style is on screen, so ask for it here
    // (and repaint) the moment it becomes visible.
    if(style === 'waveform') ensureWaveformForCurrent();
    else updateWaveformDisplay(lastSeekPct());""", 1),

    ('expanding the player brings the bars in',
     """        // Tap — expand
        $('nowPlaying').classList.remove('mini');""",
     """        // Tap — expand
        $('nowPlaying').classList.remove('mini');
        try{ if(window.__scEnsureWaveform) window.__scEnsureWaveform(); }catch(_e){}""", 1),

    # ===================================================== 4. one decoder, not two
    ('one shared decoder for waveform + auto-volume',
     """  async function estimateGain(track){
    try{
      const resp = await fetch(track.url);
      const arrBuf = await resp.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let audioBuffer;
      try{ audioBuffer = await ctx.decodeAudioData(arrBuf); } finally { ctx.close(); }
      const data = audioBuffer.getChannelData(0);""",
     """  // ---- One decoder for the whole app ---------------------------------------
  // Waveform drawing and auto-volume both need the track's samples, and they BOTH
  // used to fetch the file and decode it in full, separately, on every first play
  // of a song: two complete decodes of the same track, one after the other, on the
  // UI thread, plus a fresh AudioContext each time. That is the single biggest
  // chunk of foreground work SideCut does, and decoding is CPU work on the same
  // core the interface needs. Now there is one shared decoder and a one-track
  // buffer cache, so the second consumer reuses the first one's decode, and the
  // decode waits for an idle frame instead of fighting the first seconds of
  // playback. Nothing about the result changes — same bars, same gain.
  let _scDecodeCtx = null;
  let _scDecodeCache = { id: null, buffer: null };
  function scDecodeContext(){
    try{
      if(_scDecodeCtx) return _scDecodeCtx;
      const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      // An OfflineAudioContext decodes without touching the audio hardware or the
      // output device — no reason to open the real output just to read samples.
      _scDecodeCtx = Offline ? new Offline(1, 1, 44100) : new (window.AudioContext || window.webkitAudioContext)();
      return _scDecodeCtx;
    }catch(_e){ return null; }
  }
  async function scDecodeTrack(track){
    if(!track || !track.url) return null;
    if(_scDecodeCache.id === track.id && _scDecodeCache.buffer) return _scDecodeCache.buffer;
    const ctx = scDecodeContext();
    if(!ctx) return null;
    const resp = await fetch(track.url);
    const arrBuf = await resp.arrayBuffer();
    const buffer = await ctx.decodeAudioData(arrBuf);
    _scDecodeCache = { id: track.id, buffer };
    return buffer;
  }
  // Defer heavy analysis to an idle moment; falls back to a short timeout.
  function scWhenIdle(fn){
    try{
      if(typeof window.requestIdleCallback === 'function'){
        window.requestIdleCallback(function(){ try{ fn(); }catch(_e){} }, { timeout: 5000 });
        return;
      }
    }catch(_e){}
    setTimeout(function(){ try{ fn(); }catch(_e){} }, 1500);
  }

  async function estimateGain(track){
    try{
      const audioBuffer = await scDecodeTrack(track);
      if(!audioBuffer) return null;
      const data = audioBuffer.getChannelData(0);""", 1),

    ('auto-volume estimate waits for idle',
     """    if(t.gain == null){
      estimateGain(t).then(g => {""",
     """    if(t.gain == null){
      if(document.hidden) return; // measured on the next play instead
      scWhenIdle(function(){ estimateGain(t).then(g => {""", 1),

    ('close the idle wrapper',
     """        // Only apply live if this exact track is still the one loaded on this audio element, and the feature's still on
        if(autoVolumeEnabled && queue[queueIndex] === t.id && audioIdx === activeIdx) gainNode.gain.value = g;
      });
    }
  }""",
     """        // Only apply live if this exact track is still the one loaded on this audio element, and the feature's still on
        if(autoVolumeEnabled && queue[queueIndex] === t.id && audioIdx === activeIdx) gainNode.gain.value = g;
      }); });
    }
  }""", 1),

    ('waveform uses the same decode',
     """  async function computeWaveform(track){
    try{
      const resp = await fetch(track.url);
      const arrBuf = await resp.arrayBuffer();
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      let audioBuffer;
      try{ audioBuffer = await ctx.decodeAudioData(arrBuf); } finally { ctx.close(); }
      const data = audioBuffer.getChannelData(0);""",
     """  async function computeWaveform(track){
    try{
      // Same shared decode as auto-volume: one full decode per track, not two.
      const audioBuffer = await scDecodeTrack(track);
      if(!audioBuffer) return null;
      const data = audioBuffer.getChannelData(0);""", 1),
])
