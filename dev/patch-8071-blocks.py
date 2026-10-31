#!/usr/bin/env python3
"""80.7.1 - the page block patch-8071.py inserts.

Loaded by patch-8071.py, never run on its own. It lives beside the payload because
a release carries whole files through the API, and one file of twenty kilobytes is
one silent truncation away from a broken release.
"""

BRIDGE = r'''  // ---- 80.7.1 - THE STREAM IS A SONG, HERE AND OUTSIDE THE APP --------------
  // The lyrics sheet and DJ Mode could only answer for a downloaded song: both
  // asked `queue` and `allTracks`, and a stream lives in neither - so on a song
  // playing from the source, Lyrics said "Play a song first" and DJ Mode said the
  // same, over a song you could hear. These helpers are the one place that answers
  // "what is playing" across both players; every surface below asks them once.
  function scStreamSong(){
    if(!SC_STREAM_OK) return null;
    if(typeof scStreamPhoneOwns !== 'function' || !scStreamPhoneOwns()) return null;
    var t = scStreamById(scStreamState.curId);
    if(!t) return null;
    var a = scStreamState.audio;
    var dur = 0;
    try{ dur = Number(a && a.duration) || 0; }catch(_eSsd){ dur = 0; }
    if(!isFinite(dur) || dur <= 0) dur = Number(t.dur) || 0;
    return {
      id: 'scstream:' + String(t.id),
      streamId: String(t.id),
      videoId: String(t.videoId || ''),
      name: String(t.title || 'Streaming'),
      artist: String(t.artist || 'Streaming'),
      duration: dur,
      dur: dur,
      artUrl: scStreamThumb(t),
      stream: true,
      lyrics: String(t.lyrics || ''),
      lyricsSynced: !!t.lyricsSynced,
      lyricsOff: !!t.lyricsOff
    };
  }
  // Words fetched for a stream are kept on the streamed song, in the stream's own
  // store: persistTrackMeta() writes a LIBRARY record, and a streamed song has none.
  function scStreamLyricsSave(id, lyrics, synced){
    var t = scStreamById(String(id == null ? '' : id).replace(/^scstream:/, ''));
    if(!t) return false;
    t.lyrics = String(lyrics || '');
    t.lyricsSynced = !!synced;
    t.lyricsCheckedAt = Date.now();
    scStreamSave();
    return true;
  }
  // The element that is actually making the sound this second. The lyrics clock,
  // the lyrics play button and the background heartbeat all read this one, so none
  // of them keeps time on a paused deck while a stream is playing.
  function scListenAudio(){
    try{ if(scStreamSong()) return scStreamAudio(); }catch(_eSla){}
    return activeAudio();
  }
  // The second a stream stopped on is remembered, so closing the app does not lose
  // the song or the place in it. Written at most every four seconds, and at once
  // when the app is going away.
  var scStreamRememberAt = 0;
  function scStreamRemember(force){
    var id = String(scStreamState.curId || '');
    if(!id) return;
    var now = Date.now();
    if(!force && now - scStreamRememberAt < 4000) return;
    scStreamRememberAt = now;
    var a = scStreamState.audio;
    var at = 0;
    try{ at = Number(a && a.currentTime) || 0; }catch(_eRem){}
    try{ dbPut('meta', { key: 'streamLast', value: { id: id, at: at, savedAt: now } }); }catch(_eRem2){}
  }
  // After a launch, the last stream comes back on the bar, paused, at the second it
  // stopped on - and play carries on from there instead of starting the song again.
  function scStreamRestoreLast(){
    if(!SC_STREAM_OK) return;
    try{
      Promise.resolve(dbGet('meta', 'streamLast')).then(function(r){
        var v = r && r.value;
        if(!v || !v.id) return;
        if(Date.now() - (Number(v.savedAt) || 0) > 12 * 60 * 60 * 1000) return;
        var t = scStreamById(v.id);
        if(!t) return;
        scStreamState.curId = String(v.id);
        scStreamState.resumeId = String(v.id);
        scStreamState.resumeAt = Math.max(0, Number(v.at) || 0);
        scStreamBarOn(t);
        scStreamBarSync();
        scStreamSay('Tap play to carry on where you left off');
        scStreamRender();
      }).catch(function(){});
    }catch(_eRestore){}
  }
  // The system rebuilds the media session while the page is away, and the stream's
  // buttons live in this page: re-asserting them on the way back is what keeps the
  // notification holding the stream instead of the deck.
  document.addEventListener('visibilitychange', function(){
    try{
      if(document.hidden){ scStreamRemember(true); return; }
      if(scStreamPhoneOwns()){ scStreamPhoneSync(); scStreamPhoneTick(true); }
    }catch(_eSvis){}
  });
  try{ window.addEventListener('pagehide', function(){ try{ scStreamRemember(true); }catch(_ePh){} }); }catch(_ePageHide){}
'''

DJ = r'''  // 80.7.1 - THE DECK CAN HOLD A STREAMED SONG.
  // Every deck lookup went to allTracks, and a streamed song is not in it. One
  // reader answers for both players, so the title, the per-track reset and the
  // platter cannot disagree about what is loaded.
  function djTrackById(id){
    var want = String(id == null ? '' : id);
    if(!want) return null;
    var t = allTracks.find(function(tr){ return tr.id === want; });
    if(t) return t;
    return (djStreamTrack && String(djStreamTrack.id) === want) ? djStreamTrack : null;
  }
  // The bytes the deck needs, from wherever the stream already has them: the read
  // that is playing, the read-ahead cache, or the link itself.
  function djStreamUrl(t){
    try{
      if(scStreamState.blobUrl) return scStreamState.blobUrl;
      var hit = scStreamCacheGet((t && t.videoId) || '');
      if(hit && hit.url) return hit.url;
      if(scStreamState.url) return scStreamState.url;
    }catch(_eDsu){}
    return '';
  }
'''
