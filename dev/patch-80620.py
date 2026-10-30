#!/usr/bin/env python3
"""80.6.20 - the stream shows on the phone: the notification player, the lock
screen, the quick-settings player and the home-screen widget.

A stream is a SECOND <audio> element. Everything that feeds the phone - the
media session, its notification, and the widget - is driven from the app's own
deck and its queue, so a streamed song never reached any of them: the card kept
the last local song (or stayed empty) and the widget showed a song that was not
playing.

The fix mirrors 80.6.17's now bar exactly: while the stream owns the bar it also
owns the phone. Metadata, playback state and position are pushed from the stream
element, the phone's buttons are routed back into the stream, and the local
handlers stand down until the stream gives the phone back.

    python3 dev/patch-80620.py
    python3 dev/patch-80620.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.20'
OLD = '80.6.19'
MARKER = '80.6.20 - THE PHONE SEES THE STREAM'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80620: the page is already %s - nothing to do' % VERSION)
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# ── the phone half ───────────────────────────────────────────────────────
PHONE = r'''  // 80.6.20 - THE PHONE SEES THE STREAM.
  // The stream is a second <audio> element, and everything that feeds the lock
  // screen, the notification and the home-screen widget is wired to the app's
  // own deck and its queue - so a streamed song reached none of them. While the
  // stream owns the bar it owns the phone too: the same song, the same cover and
  // the same clock go out, and the phone's buttons come back here.
  function scStreamPhoneOwns(){
    return !!(scStreamState.barOn && scStreamState.curId);
  }
  // The phone wants a title, an artist and a picture, which is exactly the shape
  // the widget and the media session already read from a library track.
  function scStreamPhoneTrack(){
    var t = scStreamById(scStreamState.curId) || {};
    return {
      id: 'sc-stream-' + String(scStreamState.curId || ''),
      name: String(t.title || 'Streaming'),
      artist: String(t.artist || 'Streaming'),
      artUrl: scStreamThumb(t),
      stream: true
    };
  }
  function scStreamPhonePos(){
    var a = scStreamState.audio;
    var at = 0, d = 0;
    try{ at = Number(a && a.currentTime) || 0; }catch(_ePp1){}
    try{ d = Number(a && a.duration) || 0; }catch(_ePp2){}
    if(!isFinite(d) || d <= 0){
      d = Number((scStreamById(scStreamState.curId) || {}).dur) || 0;
    }
    return { at: Math.max(0, at), dur: (isFinite(d) && d > 0) ? d : 0 };
  }
  function scStreamPhoneState(){
    try{
      var a = scStreamState.audio;
      mediaSetPlaybackState((a && !a.paused) ? 'playing' : 'paused');
    }catch(_ePs){}
    scStreamPhoneTick(true);
  }
  var scStreamPhoneAt = 0;
  var scStreamPhoneWdAt = 0;
  // The timeline and the widget's bar. Throttled - a timeupdate fires four times
  // a second, and the native bridge does not need that.
  function scStreamPhoneTick(force){
    if(!scStreamPhoneOwns()) return;
    var now = Date.now();
    if(!force && now - scStreamPhoneAt < 1000) return;
    scStreamPhoneAt = now;
    var p = scStreamPhonePos();
    if(p.dur > 0){
      try{ mediaSetPositionState(p.dur, 1, Math.min(p.at, p.dur)); }catch(_ePpos){}
    }
    if(now - scStreamPhoneWdAt > 3000){
      scStreamPhoneWdAt = now;
      try{
        var a = scStreamState.audio;
        pushWidgetState(scStreamPhoneTrack(), !!(a && !a.paused));
      }catch(_ePwd){}
    }
  }
  // Everything the phone needs at the start of a song, and everything it needs
  // again when the system has rebuilt the session without our buttons.
  function scStreamPhoneSync(){
    if(!scStreamPhoneOwns()) return;
    scStreamPhoneAt = 0;
    scStreamPhoneWdAt = 0;
    try{ mediaSetMetadata(scStreamPhoneTrack()); }catch(_ePm){}
    scStreamPhoneState();
    scStreamPhoneArm();
  }
  // The phone's transport, routed into the stream instead of the deck. Registered
  // over the deck's handlers - the delegation in registerMediaSessionHandlers()
  // is what keeps the system from handing them back on its next rebuild.
  function scStreamPhoneArm(){
    function el(){ return scStreamState.audio || null; }
    try{
      mediaSetActionHandler('play', function(){
        var a = el();
        if(!a) return;
        if(!a.src && scStreamState.curId){ scStreamPlay(scStreamState.curId); return; }
        if(a.paused){ Promise.resolve(a.play()).catch(function(){}); }
      });
      mediaSetActionHandler('pause', function(){
        var a = el();
        if(a && !a.paused){ try{ a.pause(); }catch(_ePpa){} }
      });
      mediaSetActionHandler('previoustrack', function(){
        var a = el();
        if(a && (a.currentTime || 0) > 3){ try{ a.currentTime = 0; }catch(_ePpv){} return; }
        scStreamNext(-1);
      });
      mediaSetActionHandler('nexttrack', function(){ scStreamNext(1); });
      mediaSetActionHandler('stop', function(){
        var a = el();
        if(!a) return;
        try{ a.pause(); a.currentTime = 0; }catch(_ePst){}
      });
      mediaSetActionHandler('seekbackward', function(){
        var a = el();
        if(a){ try{ a.currentTime = Math.max(0, (a.currentTime || 0) - 30); }catch(_ePsb){} }
      });
      mediaSetActionHandler('seekforward', function(){
        var a = el();
        if(!a) return;
        var p = scStreamPhonePos();
        try{ a.currentTime = Math.max(0, Math.min((p.dur || 0) - 0.4, (a.currentTime || 0) + 30)); }catch(_ePsf){}
      });
      mediaSetActionHandler('seekto', function(d){
        var a = el();
        if(a && d && d.seekTime != null){ try{ a.currentTime = Number(d.seekTime) || 0; }catch(_ePse){} }
      });
    }catch(_eParm){}
  }
  // The stream has given the phone up: the deck's card and the deck's buttons come
  // back, so a press after the stream ended does not aim at a song nobody hears.
  function scStreamPhoneQuit(){
    try{
      var cur = null;
      try{
        if(queueIndex >= 0 && queueIndex < queue.length){
          cur = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; }) || null;
        }
      }catch(_ePcur){ cur = null; }
      if(cur) mediaSetMetadata(cur);
      mediaSetPlaybackState('paused');
      mediaHandlersNeedArm();
      registerMediaSessionHandlers();
    }catch(_ePquit){}
  }
'''

swap('the phone half',
     "  function scStreamBarOn(t){\n    if(!t || !t.title) return;",
     PHONE + "\n  function scStreamBarOn(t){\n    if(!t || !t.title) return;")

# ── when the stream takes the bar, it takes the phone ───────────────────
swap('the stream hands itself to the phone',
     "      scStreamBarSync();\n    }catch(_eBarOn){}\n  }",
     "      scStreamBarSync();\n"
     "      scStreamPhoneSync();\n"
     "    }catch(_eBarOn){}\n  }")

swap('and gives it back when the stream lets go',
     "    scStreamState.barOn = false;\n"
     "    try{ document.body.classList.remove('sc-stream-now'); }catch(_eOff){}\n  }",
     "    scStreamState.barOn = false;\n"
     "    try{ document.body.classList.remove('sc-stream-now'); }catch(_eOff){}\n"
     "    scStreamPhoneQuit();\n  }")

# ── play, pause and the clock reach the phone ───────────────────────────
swap('the phone follows play and pause',
     "    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamBarSync(); });\n"
     "    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamBarSync(); });",
     "    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamBarSync(); scStreamPhoneState(); });\n"
     "    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamBarSync(); scStreamPhoneState(); });")

swap('and the timeline',
     "    }catch(_e){}\n    scStreamBarSync();\n  }\n  function scStreamTime(s){",
     "    }catch(_e){}\n    scStreamBarSync();\n    scStreamPhoneTick();\n  }\n  function scStreamTime(s){")

# ── the deck's handlers stand down while the stream is up ───────────────
swap('the deck does not take the buttons back',
     "  function registerMediaSessionHandlers(){\n    mediaSetActionHandler('play', () => {",
     "  function registerMediaSessionHandlers(){\n"
     "    // 80.6.20 - a rebuild while a stream is playing must not put the deck's\n"
     "    // buttons back on a song nobody is hearing.\n"
     "    if(scStreamPhoneOwns()){ try{ scStreamPhoneArm(); }catch(_eRms){ } return; }\n"
     "    mediaSetActionHandler('play', () => {")

swap('nor take the card back',
     "  function refreshMediaControls(){\n"
     "    try{\n"
     "      if(mediaHandlersDirty || Date.now() - mediaHandlersArmedAt > 60000){",
     "  function refreshMediaControls(){\n"
     "    if(scStreamPhoneOwns()){ try{ scStreamPhoneSync(); }catch(_eRmc){ } return; }\n"
     "    try{\n"
     "      if(mediaHandlersDirty || Date.now() - mediaHandlersArmedAt > 60000){")

# ── the widget's bar is the stream's bar ────────────────────────────────
swap('the widget timeline reads the stream',
     "          const a = (typeof activeAudio === 'function') ? activeAudio() : null;",
     "          const a = (scStreamPhoneOwns() && scStreamState.audio) ? scStreamState.audio\n"
     "                  : ((typeof activeAudio === 'function') ? activeAudio() : null);")

# ── one sound at a time, behind the screen too ──────────────────────────
swap('the heartbeat leaves a stream alone',
     "      if(a.paused && !userPaused && !audioFocusInterrupted && !scInCall() && scReviveAllowed()",
     "      if(a.paused && !userPaused && !audioFocusInterrupted && !scInCall() && scReviveAllowed()\n"
     "         && !scStreamPhoneOwns()")

swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'The stream shows on the phone', items: [\n"
    "    '[FULL] A streamed song now shows on your phone, not just in the app. The lock screen, the notification player, the quick-settings player and the home-screen widget all carry the song that is streaming - its title, its artist and its cover - with the same clock and the same progress bar.',\n"
    "    '[FULL] Their buttons work on the stream. Play, pause, previous, next, stop and the thirty-second jumps from the lock screen, the shade, the quick settings or the widget all drive the song that is streaming, and next keeps to the genre the stream is in.',\n"
    "    '[FULL] When the stream ends, the phone goes back to your own library player instead of leaving a song on the lock screen that is not playing.',\n"
    "  ]},\n"
)
if "version: '" + VERSION + "'" not in SRC:
    at = SRC.find("\n  { version: '%s'" % OLD)
    if at == -1:
        failed.append('changelog: no %s entry to insert before' % OLD)
    else:
        SRC = SRC[:at + 1] + ENTRY + SRC[at + 1:]
        applied.append('the changelog entry')

if failed:
    print('patch-80620: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80620: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80620: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
