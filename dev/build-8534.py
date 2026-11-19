"""Build dev/video-8534.js - the 85.3.4 music video module - from dev/video-8533.js.

Every slice below is an exact piece of the 85.3.3 module and is asserted to appear
exactly once, so a later edit cannot make this builder land in the wrong place and
still print success.

    python3 dev/build-8534.py
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dev", "video-8533.js")
OUT = os.path.join(ROOT, "dev", "video-8534.js")

BANNER_NEW = """  // ─── 85.3.4 - ONE SONG, ONE FILM, AND THE FILM'S SOUND IS THE SONG'S SOUND ─────
  // THREE REPORTS, AND THE FIRST TWO WERE THE SAME FAULT.
  //
  // THE FILM KEPT CHANGING SONG. The tab follows the queue by comparing the song's
  // key with the one the film was loaded for, and that key comes from whichever list
  // answered - the streaming bar's own row, or the queue entry. Those are two names
  // for one song, so a bar that came or went, or a row that answered a beat late, read
  // as "the queue has moved": the tick loaded another film, then the old name came
  // back, then the new one - three songs' videos taking turns over one song. A change
  // now has to be the answer on two ticks in a row before anything is loaded, and a
  // load starts no sooner than two and a half seconds after the one before it. Two
  // names taking turns never agree twice, so a song cannot be reloaded by its own
  // second name - and one that really does change still moves, a beat later.
  //
  // AND EXITING THE FILM PAUSES THE MUSIC. Closing used to hand the song back at the
  // picture's second and start it, so leaving the tab meant the music came back on by
  // itself. The song is put back on that second and stays paused now; the round button
  // is how it starts again.
  //
  // AND THE FILM'S SOUND GETS THE SAME TREATMENT AS EVERY SONG. The player has an
  // eight-band equalizer, a volume boost with its ceiling, an anti-muffler and the
  // assistant duck, and all of them live on the app's Web Audio chain - which the
  // music video's own elements were never on, so the film played the file as it came.
  // The film's audio row is read through the same bridge the picture is read with (two
  // or three megabytes), and the blob that comes back is this app's own resource, so it
  // can go through the same filters and the same master: an element from another
  // origin cannot (the spec hands a cross-origin element's MediaElementSource silence,
  // not sound), which is why the voice is read rather than wired straight in. A size
  // with no audio row at all still plays the song underneath, and the one-stream rows
  // are only heard directly if the voice cannot be read.
"""

R = []
CUTS = []


def rep(old, new, what):
    R.append((old, new, what))


def cut(start, end, new, what):
    CUTS.append((start, end, new, what))


# ── the state ---------------------------------------------------------------
rep(
    """    deadH: {}, app: {}, rescueH: {}, songKey: '', loadSeq: 0, openedAt: 0, coverOn: false,
""",
    """    deadH: {}, app: {}, rescueH: {}, songKey: '', loadSeq: 0, openedAt: 0, coverOn: false,
    pendingKey: '', lastLoad: 0, voice: null,
""",
    "the state",
)

rep(
    """  var SC_VQ_IDLE_MS_PORTRAIT = 3200;       // the mini bar steps aside in portrait too
""",
    """  var SC_VQ_IDLE_MS_PORTRAIT = 3200;       // the mini bar steps aside in portrait too
  var SC_VQ_FOLLOW_MS = 2500;              // a song change cannot reload films faster than this
  var SC_VQ_VOICE_MAX = 16 * 1024 * 1024;  // the film's own audio row, read for the equalizer
""",
    "the follow and voice limits",
)

# ── one song, one load ------------------------------------------------------
cut(
    "  function scVideoFollow(){",
    "  function scVideoSync(force){",
    """  // A CHANGE HAS TO STAY A CHANGE. The key a film is loaded for comes from whichever
  // list answered - the streaming bar's row or the queue entry - and those are two
  // names for one song, so a bar that came or went read as a new song and the film was
  // loaded again, and again when the old name came back. A different key is written
  // down on the first tick and acted on only if it is still the answer on the next one;
  // two names taking turns never agree twice. A load also waits out a short window
  // after the last one, so a burst of ticks cannot turn into a burst of lookups.
  function scVideoFollow(){
    if(!scVideoState.open || scVideoState.busy || scVideoState.scrubbing) return false;
    var t = scVideoTrack();
    var key = String((t && t.key) || '');
    if(!key) return false;
    if(!scVideoState.songKey){ scVideoState.songKey = key; scVideoState.pendingKey = ''; return false; }
    if(key === scVideoState.songKey){ scVideoState.pendingKey = ''; return false; }
    if(key !== scVideoState.pendingKey){ scVideoState.pendingKey = key; return false; }
    scVideoState.pendingKey = '';
    var now = 0;
    try{ now = Date.now ? Date.now() : new Date().getTime(); }catch(_eNow){ now = 0; }
    if(now && scVideoState.lastLoad && (now - Number(scVideoState.lastLoad)) < SC_VQ_FOLLOW_MS) return false;
    scVideoState.songKey = key;
    // THE NEW SONG WAS BEING HELD. Its own play was stopped while the picture owned
    // the sound, so ownership is given back before it is asked to run - the tab is
    // free to take it again if the new clip carries sound.
    scVideoOwnSound(false);
    scVideoState.songWasPlaying = false;
    scVideoSong(true);
    scVideoStart(t);
    return true;
  }

""",
    "the follow",
)

rep(
    """  function scVideoLoad(cand){
    if(!cand) return Promise.resolve(false);
""",
    """  function scVideoLoad(cand){
    if(!cand) return Promise.resolve(false);
    try{ scVideoState.lastLoad = Date.now ? Date.now() : new Date().getTime(); }catch(_eLoadAt){}
""",
    "the load stamp",
)

rep(
    """      return scVideoSearch(scVideoState.last).then(function(list){
""",
    """      // THE SONG THAT IS ON NOW, not the one this tab was opened for: a search run
      // with a stale title is how one song's clip arrives under another's name.
      return scVideoSearch(scVideoTrack() || scVideoState.last).then(function(list){
""",
    "the search for the right song",
)

# ── the voice, read so the equalizer can reach it ----------------------------
rep(
    """        audioUrl: top.muxed ? '' : (snd ? snd.url : ''),
        audioMime: top.muxed ? '' : (snd ? snd.mime : ''),
        audioSize: top.muxed ? 0 : (snd ? snd.size : 0),
""",
    """        // THE VOICE IS THIS VIDEO'S OWN AUDIO ROW, whether or not the picture
        // carries a copy of it. It is what the equalizer can reach.
        audioUrl: snd ? snd.url : '',
        audioMime: snd ? snd.mime : '',
        audioSize: snd ? (Number(snd.size) || 0) : 0,
""",
    "the rung voice",
)

rep(
    """    scVideoState.audioMode = rung.muxed ? 'video' : (rung.audioUrl ? 'aux' : 'song');
""",
    """    // THE PAIRED VOICE IS PREFERRED, even on a one-stream row: the same recording,
    // in the element the app can filter. A one-stream row is only heard directly when
    // there is no audio row at all to pair it with.
    scVideoState.audioMode = rung.audioUrl ? 'aux' : (rung.muxed ? 'video' : 'song');
    scVideoVoiceReset();
""",
    "the sound owner",
)

cut(
    "  function scVideoAuxSet(at){",
    "  function scVideoAuxPause(){",
    """  // THE VOICE IS READ, NOT WIRED. A media element from googlevideo is another
  // origin, and a cross-origin element handed to the app's audio graph plays silence,
  // not sound - so the equalizer can never reach it while it is a remote tag. The same
  // bridge the film is read with reads the film's audio row (two or three megabytes),
  // and the blob that comes back is this app's own resource, which the filters, the
  // boost, the anti-muffler and the duck all reach. The direct link plays first so a
  // song change is never silent; the blob swaps under it a moment later, on the same
  // second, and only then is the element unmuted.
  function scVideoVoiceReset(){
    var st = scVideoState.voice;
    if(st && st.blob){ try{ URL.revokeObjectURL(st.blob); }catch(_eVoiceRev){} }
    scVideoState.voice = null;
  }
  function scVideoVoice(r){
    if(!r || !r.audioUrl) return '';
    var st = scVideoState.voice;
    if(st && st.for === r && st.blob) return st.blob;
    if(!st || st.for !== r){
      scVideoState.voice = { for: r, blob: '', reading: false };
      scVideoVoiceRead(r, scVideoState.voice);
    }
    return r.audioUrl;
  }
  function scVideoVoiceRead(r, st){
    if(!st || st.reading) return;
    if(typeof scFetchBytes !== 'function') return;
    var size = Number(r.audioSize) || 0;
    if(size > SC_VQ_VOICE_MAX) return;                       // a film's audio is a few megabytes
    st.reading = true;
    var job = null;
    try{ job = scFetchBytes(r.audioUrl, size || SC_VQ_VOICE_MAX, null, 4); }catch(_eVoiceRead){ job = null; }
    if(!job){ st.reading = false; return; }
    Promise.resolve(job).then(function(buf){
      if(scVideoState.voice !== st) return;
      st.reading = false;
      if(!scVideoState.open || !buf || !buf.byteLength) return;
      if(scVideoState.rung !== r) return;                    // a size changed while reading
      var type = String(r.audioMime || 'audio/mp4').split(';')[0].trim() || 'audio/mp4';
      var blob = null;
      try{ blob = URL.createObjectURL(new Blob([buf], { type: type })); }catch(_eVoiceBlob){ blob = null; }
      if(!blob) return;
      st.blob = blob;
      var a = scVideoEl('scVideoAuxEl'), v = scVideoEl('scVideoEl');
      if(!a || scVideoState.audioMode !== 'aux') return;
      var at = v ? (Number(v.currentTime) || 0) : 0;
      try{ a.pause(); a.src = blob; a.load(); }catch(_eVoiceSwap){ return; }
      scVideoPose(a, at);
      scVideoState.posing = true;
      scVideoGraphSync();
    }).catch(function(){ if(scVideoState.voice === st) st.reading = false; });
  }

  function scVideoAuxSet(at){
    var a = scVideoEl('scVideoAuxEl');
    var r = scVideoState.rung;
    if(!a) return;
    scVideoAuxPause();
    // Silent until it is on the picture's second, so a size change cannot play a
    // quarter second of the intro over a picture that is two minutes in.
    try{ a.muted = true; a.volume = 1; }catch(_eAv){}
    scVideoState.posing = false;
    if(!r || !r.audioUrl) return;
    var url = scVideoVoice(r);
    try{ a.src = url; }catch(_eSrc){ return; }
    try{ a.load(); }catch(_eAl){}
    scVideoPose(a, at);                    // applied when this element has a duration
    scVideoState.posing = true;
    scVideoMuteOthers();
    scVideoGraphSync();
  }
""",
    "the aux voice",
)

rep(
    """  function scVideoAuxPlay(){
    var a = scVideoEl('scVideoAuxEl'), v = scVideoEl('scVideoEl');
    if(!a || !a.src) return;
""",
    """  function scVideoAuxPlay(){
    var a = scVideoEl('scVideoAuxEl'), v = scVideoEl('scVideoEl');
    if(!a || !a.src) return;
    // A ROUTED ELEMENT MAY NOT PLAY A REMOTE LINK. Once the voice is on the app's
    // graph, an element from another origin would come out as silence; the blob is
    // what is heard, so the read is waited for rather than played around.
    if(a.__scVideoChain && String(a.src || '').indexOf('blob:') !== 0) return;
""",
    "the aux play guard",
)

cut(
    "  function scVideoAuxFallBack(why){",
    "  function scVideoPlayAttempt(){",
    """  function scVideoAuxFallBack(why){
    if(scVideoState.audioMode !== 'aux') return;
    var rung = scVideoState.rung;
    var v = scVideoEl('scVideoEl'), a = scVideoAudioEl();
    scVideoState.posing = false;
    // A ONE-STREAM SIZE CARRIES ITS OWN SOUND. When its paired voice will not play,
    // the picture is the sound rather than the song - the same recording, in the
    // element that is already on the screen.
    if(rung && rung.muxed){
      scVideoState.audioMode = 'video';
      try{ if(v) v.muted = false; }catch(_eAfV){}
      scVideoAuxPause();
      scVideoMuteOthers();
      scVideoOwnSound(true);
      scVideoFoot('The paired track of this size would not play (' + why + ') - the size carries its own sound.');
      scVideoTickStart();
      return;
    }
    scVideoState.audioMode = 'song';
    scVideoOwnSound(false);
    scVideoAuxPause();
    try{
      if(a){
        a.currentTime = v ? (Number(v.currentTime) || 0) : 0;
        var p = a.play(); if(p && p.catch) p.catch(function(){});
      }
    }catch(_eAf){}
    try{ if(v) v.muted = true; }catch(_eAm){}
    scVideoFoot('The soundtrack of this size would not play (' + why + ') - the song runs under the picture.');
    scVideoTickStart();
  }

""",
    "the aux fallback",
)

# ── the graph, for a film that has one --------------------------------------
rep(
    """  function scVideoOwnSound(on){
""",
    """  // THE FILM'S SOUND IS THE APP'S SOUND. The picture and its voice are handed to the
  // chain the songs use (the eight bands, the boost, its ceiling, the muffle and the
  // duck) whenever they are this app's own resource. The chain refuses a remote
  // element, because a MediaElementSource of one plays silence.
  function scVideoGraphSync(){
    try{
      var fn = (typeof window !== 'undefined' && window) ? window.scVideoEqChain : null;
      if(typeof fn !== 'function') return;
      var v = scVideoEl('scVideoEl'), a = scVideoEl('scVideoAuxEl');
      if(scVideoState.audioMode === 'aux' && a && a.src) fn(a);
      else if(v && v.src) fn(v);
    }catch(_eGraph){}
  }

  function scVideoOwnSound(on){
""",
    "the graph sync",
)

rep(
    """    scVideoWatch();
    if(scVideoState.wasPlaying){ scVideoPlayAttempt(); }
""",
    """    scVideoWatch();
    scVideoGraphSync();
    if(scVideoState.wasPlaying){ scVideoPlayAttempt(); }
""",
    "the attach graph",
)

rep(
    """        scVideoState.drops = 0;              // a picture that plays has used no steps
""",
    """        scVideoState.drops = 0;              // a picture that plays has used no steps
        scVideoGraphSync();
""",
    "the playing graph",
)

# ── leaving the tab pauses the music ---------------------------------------
cut(
    "  function scVideoReleaseSong(){",
    "  // THE APP'S OWN RESOLVER, NOT A SECOND COPY OF IT.",
    """  // EXITING PAUSES THE MUSIC. The film owns the sound while it is up; when it is put
  // away the song is seated on the second the picture stopped on and left PAUSED - a
  // stop, not a hand-off that starts playing by itself because the tab was closed. The
  // round button starts it again, from that second.
  function scVideoParkSong(at){
    var a = scVideoAudioEl(), v = scVideoEl('scVideoEl');
    at = Number(at);
    if(!at) at = v ? (Number(v.currentTime) || 0) : 0;
    if(a && scVideoState.songWasPlaying && at > 0){
      try{ a.currentTime = at; }catch(_eParkSeek){}
    }
    try{ if(a) a.pause(); }catch(_eParkPause){}
    try{ if(typeof audio !== 'undefined' && audio) audio.pause(); }catch(_eParkD1){}
    try{ if(typeof audio2 !== 'undefined' && audio2) audio2.pause(); }catch(_eParkD2){}
    scVideoState.songWasPlaying = false;
  }

""",
    "the park on exit",
)

rep(
    """    scVideoOwnSound(false);
    scVideoReleaseSong();
""",
    """    scVideoOwnSound(false);
    scVideoParkSong(stopAt);
    scVideoVoiceReset();
""",
    "the close",
)


rep(
    """  function scVideoClose(){
    scVideoState.open = false;
""",
    """  function scVideoClose(){
    // THE SECOND THE FILM STOPPED, read before the element is cleared: a cleared
    // element knows nothing, and the song would be seated at the start instead.
    var stopAt = 0;
    try{ var pv = scVideoEl('scVideoEl'); stopAt = pv ? (Number(pv.currentTime) || 0) : 0; }catch(_eStopAt){ stopAt = 0; }
    scVideoState.open = false;
""",
    "the close second",
)


def once(text, needle, what):
    n = text.count(needle)
    if n != 1:
        raise SystemExit("build-8534: %s appears %d times, expected exactly 1" % (what, n))


def main():
    src = io.open(SRC, encoding="utf-8").read()
    out = src
    head = out.index("  // ─── 85.3.3 - A REFUSED ADDRESS")
    at = out.index("  var scVideoState = {")
    out = out[:head] + BANNER_NEW + "\n" + out[at:]
    # The sliced functions first (their boundaries are unique in the module), then the
    # exact-slice edits.
    for start, end, new, what in CUTS:
        once(out, start, what + " (start)")
        i = out.index(start)
        j = out.find(end, i + len(start))
        if j < 0:
            raise SystemExit("build-8534: %s has no end" % what)
        out = out[:i] + new + out[j:]
    for old, new, what in R:
        once(out, old, what)
        out = out.replace(old, new, 1)
    for mark in ("function scVideoFollow", "scVideoState.pendingKey = key", "SC_VQ_FOLLOW_MS",
                 "function scVideoVoice", "function scVideoGraphSync", "function scVideoParkSong",
                 "a.__scVideoChain && String(a.src || '').indexOf('blob:') !== 0"):
        if mark not in out:
            raise SystemExit("build-8534: the module lacks %r" % mark)
    if "scVideoReleaseSong" in out:
        raise SystemExit("build-8534: closing still hands the song back playing")
    io.open(OUT, "w", encoding="utf-8").write(out)
    print("wrote %s (%d lines)" % (os.path.relpath(OUT, ROOT), out.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
