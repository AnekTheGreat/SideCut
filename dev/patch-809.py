#!/usr/bin/env python3
"""80.9 - a streamed song keeps playing when the app is not on screen.

    python3 dev/patch-809.py
    python3 dev/patch-809.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHAT THE OWNER SAID. "the streaming still doesn't work outside a app."

WHY IT STILL DID NOT, PART ONE: THE LOOP THAT KEEPS IT ALIVE WAS PAUSED WITH THE APP.
The battery saver near the top of the page replaces window.setInterval, tracks every
interval longer than 500ms, and stops all of them on visibilitychange when the page is
hidden and on pagehide. Exactly one timer is exempt - the one-second listening clock,
which calls __scKeepAliveTimer so a song heard with the screen off still gets counted.
80.7.1 then put the whole "a backgrounded stream is revived, its session re-asserted,
its position pushed" machinery INSIDE startMediaSessionHeartbeat(), which is a tracked
30-second interval - so the first thing the saver did when the app went away was clear
the one timer whose entire job is keeping a stream alive out there. The deck's own
revive path runs from the same loop, so both players were counting on a timer that is
deliberately paused. That is why 80.7.1 changed nothing that could be felt: the code was
right and it was not running.

WHY IT STILL DID NOT, PART TWO: NOTHING ASKED THE PHONE TO STAY AWAKE FOR A SONG.
The Android half of this app already carries a hold built for exactly this - SideCutJob,
injected by .github/workflows/patch-joblock.py: a PARTIAL_WAKE_LOCK plus a dataSync
foreground service, because (in that file's own words) "with the screen off the CPU
sleeps... a cached process is frozen and can be killed". A conversion has asked for that
hold since it was written. Playback never did, so a streamed song was the one thing in
this app left to the freezer: the audio died with the page and the notification kept
saying it was playing.

WHAT LANDED. (1) __scKeepAliveTimer is now able to do what its comment always promised
for a timer born while the app is already hidden: it marks the timer kept AND starts it
if the saver already stopped it. (2) startMediaSessionHeartbeat() marks its interval
kept, so the revive loop, the metadata and position re-assert and the widget push run
while the song is in your pocket. (3) The streamed song's own play, pause and ended
events take and give back a native hold: play asks, a pause the owner asked for gives it
back, a pause the platform applied does not (that is the one the heartbeat is there to
undo), and a handed-back bar gives it back. (4) Conversions and playback now share one
arbiter, so a download running while a song plays holds the phone once and only the
last one to finish releases it - the naive version had each caller release the service
out from under the other.

NOT A NATIVE CHANGE. SideCutJob has shipped in the APK since conversions used it; this
only calls it, so it rides the OTA channels like every other page release.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.9'
MARKER = '80.9 - THE PHONE IS ASKED TO STAY AWAKE FOR A SONG'
ANCHOR = "  { version: '80.8',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-809: already on the page, the page is %s' % VERSION)
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


# -- 1. the version ----------------------------------------------------------
once('the page says 80.9',
     "const APP_VERSION = '80.8';",
     "const APP_VERSION = '80.9';")

# -- 2. a kept timer that was born in the background is started now ----------
ONCE_KEEP = """  window.__scKeepAliveTimer = function(id){
    killTimers.forEach(function(t){ if(t.id === id) t.keep = true; });
  };
"""

KEEP = """  window.__scKeepAliveTimer = function(id){
    killTimers.forEach(function(t){
      if(t.id !== id) return;
      t.keep = true;
      // 80.9 - A KEPT TIMER THAT WAS BORN IN THE BACKGROUND IS STARTED NOW. The
      // interceptor starts an interval stopped when document.hidden is set, so a
      // stream resumed from the notification used to be marked exempt from a pause
      // that had already happened: keep was set on a timer nobody had running.
      if(!t.alive){ t.id = _origSI.call(window, t.fn, t.ms); t.alive = true; }
    });
  };
"""

once('a kept timer is started if it was born hidden', ONCE_KEEP, KEEP)

# -- 3. the heartbeat is not paused with the rest of the app -----------------
HEART_OLD = """    }, 30000);
  }
  function stopMediaSessionHeartbeat(){
"""

HEART_NEW = """    }, 30000);
    // 80.9 - THE ONE TIMER THAT MUST SURVIVE THE APP GOING AWAY. Everything in this
    // loop exists for the version of the app nobody is looking at: reviving a stream
    // the phone silenced, re-asserting the media session the system rebuilt, pushing
    // the position and the widget. The battery saver stops every tracked interval on
    // hide, so without this the whole of it ran only while the page was visible -
    // which is the one moment it is not needed.
    try{ if(window.__scKeepAliveTimer && mediaSessionHeartbeat) window.__scKeepAliveTimer(mediaSessionHeartbeat); }catch(_eHKA){}
  }
  function stopMediaSessionHeartbeat(){
"""

once('the heartbeat is marked kept', HEART_OLD, HEART_NEW)

# -- 4. the streamed song takes and gives back a native hold -----------------
PLAY_OLD = """    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamQuietDeck(); scStreamBarSync(); scStreamPhoneState(); });
    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamBarSync(); scStreamPhoneState(); });
"""

PLAY_NEW = """    a.addEventListener('play', function(){
      scStreamState.playing = true;
      scStreamQuietDeck(); scStreamBarSync(); scStreamPhoneState();
      // 80.9 - SOUND IS THE ONE THING THE PHONE MUST NOT PUT DOWN. A song that is
      // playing is work the app is doing with the screen off, so it asks for the same
      // hold a conversion asks for - a partial wake lock and a foreground service -
      // instead of leaving the WebView to Android's freezer.
      try{ scHoldWant('stream'); }catch(_eShPlay){}
    });
    a.addEventListener('pause', function(){
      scStreamState.playing = false; scStreamBarSync(); scStreamPhoneState();
      // A pause the platform applied is not the owner stopping - that is the case
      // the heartbeat is there to undo, so the hold stays. Only a pause that was
      // asked for (the button, the phone, giving the bar up) releases the phone.
      if(scStreamState.userPaused){ try{ scHoldDrop('stream'); }catch(_eShPause){} }
    });
"""

once('the stream holds the phone while it plays', PLAY_OLD, PLAY_NEW)

END_OLD = """      if(scStreamState.via === 'prefix') return;
      scStreamNext(1);
"""

END_NEW = """      if(scStreamState.via === 'prefix') return;
      // The song is over, not the run: the next one takes the hold back on its own
      // play, and a queue that stops here must not leave the phone awake.
      try{ scHoldDrop('stream'); }catch(_eShEnd){}
      scStreamNext(1);
"""

once('a finished song gives the phone back', END_OLD, END_NEW)

# -- 5. one arbiter for the two things that hold the phone -------------------
ARBITER = """  // ---- 80.9 - A SONG IN YOUR POCKET IS A RUN, TOO ----------------------------
  // Two things in this app keep working when nobody is looking at it: a conversion
  // reading its ranges, and a song playing. Both need the same thing from Android -
  // a partial wake lock so the CPU does not sleep, and a foreground service so the
  // process is not frozen or killed - and patch-joblock.py has shipped that as
  // SideCutJob since conversions used it. What was missing is that PLAYBACK never
  // asked for it, so a streamed song was the only work in the app left to the
  // freezer, and the audio died with the page while the notification kept claiming
  // it was playing.
  //
  // ONE HOLD, TWO OWNERS. The plugin is not reference counted (hold()/release() are a
  // pair, deliberately), so whoever released last used to stop the service for both:
  // a download finishing in the background would have taken the wake lock out from
  // under a song. This is the small piece that was missing - the hold is taken when
  // the first owner asks for it and released when the last one is done.
  var scHoldOwners = { job: false, stream: false };
  var scHoldNative = false;
  function scHoldText(){
    try{
      var t = (typeof scStreamSong === 'function') ? scStreamSong() : null;
      if(t && (t.name || t.artist)) return String(t.name || t.artist) + (t.name && t.artist ? ' \\u00b7 ' + t.artist : '');
    }catch(_eHoldText){}
    return 'Playing on SideCut';
  }
  function scHoldSync(){
    var want = !!(scHoldOwners.job || scHoldOwners.stream);
    if(want === scHoldNative) return;
    if(want){
      // A build without the plugin answers null and nothing is held - the same way a
      // browser runs without it - and the next ask tries again.
      var title = scHoldOwners.stream ? scHoldText() : ((scRunJob && scRunJob.title) || 'Conversion');
      if(!scJobCall('hold', { title: title, sub: scHoldOwners.stream ? 'Playing on SideCut' : '' })) return;
      scHoldNative = true;
    } else {
      scHoldNative = false;
      scJobCall('release', {});
    }
  }
  function scHoldWant(owner){
    if(!scHoldOwners.hasOwnProperty(owner) || scHoldOwners[owner]) return;
    scHoldOwners[owner] = true;
    scHoldSync();
  }
  function scHoldDrop(owner){
    if(!scHoldOwners.hasOwnProperty(owner) || !scHoldOwners[owner]) return;
    scHoldOwners[owner] = false;
    scHoldSync();
  }
"""

once('the hold has one arbiter',
     "  function scRunJobStart(title, sub){",
     ARBITER + "  function scRunJobStart(title, sub){")

once('a conversion asks the arbiter',
     "    scRunJob.native = !!scJobCall('hold', { title: scRunJob.title, sub: sub || '' });",
     "    scRunJob.native = true;\n    scHoldWant('job');")

once('a conversion gives the hold back through the arbiter',
     "    if(scRunJob.native){ scRunJob.native = false; scJobCall('release', {}); }",
     "    if(scRunJob.native){ scRunJob.native = false; scHoldDrop('job'); }")

# -- 6. a bar given back to the deck releases the phone ----------------------
HANDOLD = """      const listen = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();
"""

HANDNEW = """      const listen = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();
      // 80.9 - THE BAR IS THE THING THAT KEEPS THE HOLD HONEST. A stream that has
      // handed the now bar back to the deck is not playing, whatever its element's
      // last event said, and the phone is released here rather than left awake for
      // a song nothing is showing.
      try{ if(typeof scStreamPhoneOwns === 'function' && !scStreamPhoneOwns()) scHoldDrop('stream'); }catch(_eHBHold){}
"""

once('a handed-back bar releases the hold', HANDOLD, HANDNEW)

# -- 7. the changelog --------------------------------------------------------

def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.9 - THE PHONE IS ASKED TO STAY AWAKE FOR A SONG.\n"
    "  { version: '80.9', date: '{{STAMP}}', title: 'A streamed song keeps playing when you leave the app', items: [\n"
    "    '[FULL] A song that is playing now asks the phone to stay awake for it, so leaving the app no longer freezes the page and kills the sound.',\n"
    "    '[FULL] The loop that puts a silenced song back and keeps the notification, the lock screen and the saved place current is no longer paused when the screen goes off.',\n"
    "    '[FULL] A song playing in your pocket and a download running at the same time share one hold, so neither one releases the phone while the other still needs it.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-809: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-809: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-809: %d steps applied, page is %s' % (len(applied), VERSION))
