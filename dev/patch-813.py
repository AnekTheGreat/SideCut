#!/usr/bin/env python3
"""81.3 - a downloaded song keeps playing when the app is not open, and a song from
the source is treated as sound by everything that already treats the deck as sound.

    python3 dev/patch-813.py
    python3 dev/patch-813.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHAT THE OWNER SAID. "YO WHY IS THE STREAMED AONG NOT PLAYING IN THE BACKGROUND WHEN
THERES OTHER MEDIA AND WHEN I DOWNLOAD IT TOO THERES NO WAY TO PLAY IT WHILE THE APP
ISNT OPEN WTF BRO"

Two playback paths live in this page and only one of them was ever finished:

  * THE DECK - audios[0] and audios[1], a downloaded file through a blob URL. It has
    the media session, the heartbeat, the wake lock, recoverAudio, the focus latch and
    the parked session.
  * THE STREAM - scStreamState.audio, its own element, built in 80.6 and finished for
    the phone (the bar, the notification, the widget) but never for the system: every
    revive, every focus hand-back, every call stand-down and the ten minute background
    release ask activeAudio(), which is the DECK. The stream is not activeAudio().

1. DOWNLOADS NEVER ASKED FOR THE HOLD. 80.9 gave a playing song a partial wake lock
   and a foreground service (scHoldWant('stream'), owners {job, stream}) so Android
   would stop freezing the WebView behind it. A downloaded song asked for nothing: it
   started, the page kept it alive while it was on screen, and the moment the app went
   away Android was free to freeze the process - taking the sound, the notification and
   every control out there with it. That is "there is no way to play it while the app
   is not open". The deck now takes the same hold on every start, gives it back on a
   pause the user asked for, and the heartbeat gives it back when the element has
   stopped (a queue that ends). Three owners, one reference count: a conversion that
   finishes in the background still cannot stop the service under a song.

2. THE STREAM WAS INVISIBLE TO THE FOCUS MACHINERY. Another app taking the audio makes
   Chromium pause the elements this page owns; the app's answer is scUndoPlatformPause,
   which opens with `const a = activeAudio(); if(!a || !a.paused) return false;`. With a
   song from the source playing, the deck's element IS paused (scStreamQuietDeck put it
   to bed), so the function returned false and nothing was put back: the song stayed
   silent until the 30 second heartbeat came round, or for good. The same blind spot in
   the focus GAIN handler meant the hand-back played the DECK - the last downloaded
   song, over or instead of the one you were hearing. Both now go to whichever element
   is really making sound, and the deck is never started while the stream owns the bar.

3. A CALL DID NOT SILENCE THE STREAM. scStandDownForCall paused activeAudio() only, so
   a song playing from the source kept singing through a call. It pauses whichever
   element is sounding now, and scNoteCallState puts it back when the call ends.

4. THE TEN MINUTE RELEASE TORE DOWN A PLAYING SONG'S KEEP-ALIVE.
   mediaPausedInBackground() and mediaResumableTrack() asked the deck. A stream playing
   with the screen off therefore read as "paused in the background": ten minutes later
   the app stopped its own heartbeat, released its wake lock, and parked the session on
   the deck's song. Both ask the stream when the stream owns the bar.

WHAT IS NOT TOUCHED. The stream's own reader, resolver and cache; the bar, the
notification's transport and the widget; the deck's crossfade, gapless and DJ paths;
the focus requests (still off, on purpose); the audio focus plugin. No apostrophes and
none of the words the updater drops (streaming|streams?\\b|from the source|pinned artist).
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '81.3'
MARKER = '81.3 - THE HOLD BELONGS TO A SONG THAT IS REALLY PLAYING'
ANCHOR = "  { version: '81.2',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-813: already on the page, the page is %s' % VERSION)
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
once('the page says 81.3',
     "const APP_VERSION = '81.2';",
     "const APP_VERSION = '81.3';")

# -- 2. the hold has a third owner: the deck ---------------------------------
once('the hold counts three owners',
     "  var scHoldOwners = { job: false, stream: false };",
     "  var scHoldOwners = { job: false, stream: false, deck: false };")

once('the hold is taken while any owner has it',
     "    var want = !!(scHoldOwners.job || scHoldOwners.stream);",
     "    var want = !!(scHoldOwners.job || scHoldOwners.stream || scHoldOwners.deck);")

once('the hold names the song that is making sound',
     r"""      var title = scHoldOwners.stream ? scHoldText() : ((scRunJob && scRunJob.title) || 'Conversion');
      if(!scJobCall('hold', { title: title, sub: scHoldOwners.stream ? 'Playing on SideCut' : '' })) return;""",
     r"""      // 81.3 - THREE OWNERS NOW. A downloaded song asks for the hold as well, so the
      // title names whichever song is making sound, and the count keeps a conversion
      // that finishes in the background from stopping the service under it.
      var playing = !!(scHoldOwners.stream || scHoldOwners.deck);
      var title = scHoldOwners.stream ? scHoldText()
        : (scHoldOwners.deck ? scDeckHoldText() : ((scRunJob && scRunJob.title) || 'Conversion'));
      if(!scJobCall('hold', { title: title, sub: playing ? 'Playing on SideCut' : '' })) return;""")

once('the deck can name its song for the hold',
     r"""    }catch(_eHoldText){}
    return 'Playing on SideCut';
  }""",
     r"""    }catch(_eHoldText){}
    return 'Playing on SideCut';
  }
  // 81.3 - THE DECK'S SONG, FOR THE SAME REASON. A downloaded song is a run too, and
  // the shade entry it holds should name it instead of saying Conversion.
  function scDeckHoldText(){
    try{
      var t = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; });
      if(t && (t.name || t.artist)) return String(t.name || t.artist) + (t.name && t.artist ? ' \u00b7 ' + t.artist : '');
    }catch(_eDeckHold){}
    return 'Playing on SideCut';
  }""")

# -- 3. a downloaded song starts and stops the hold --------------------------
once('a start on the deck asks for the hold',
     """    startMediaSessionHeartbeat();
    requestWakeLock();""",
     """    startMediaSessionHeartbeat();
    requestWakeLock();
    // 81.3 - A DOWNLOADED SONG IS A RUN, TOO. 80.9 gave the stream a hold - a partial
    // wake lock and a foreground service - so it could play with the screen off, and
    // left the deck asking for nothing: leave the app with a downloaded song playing
    // and Android was free to freeze the page, which takes the sound, the notification
    // and every control out there with it. The deck asks for the same hold, on every
    // start, exactly like the stream does.
    try{ scHoldWant('deck'); }catch(_eHoldDeck){}""")

once('a pause the user asked for gives the hold back',
     "    if(userPaused){ stopMediaSessionHeartbeat(); releaseWakeLock(); }",
     """    if(userPaused){
      stopMediaSessionHeartbeat(); releaseWakeLock();
      // 81.3 - and the phone, for the same reason. A pause the user asked for is the
      // one case where the deck has no work left to keep the process alive for.
      try{ scHoldDrop('deck'); }catch(_eHoldDrop){}
    }""")

once('a deck that has stopped gives the hold back',
     "      try{ if(typeof scStreamPhoneOwns === 'function' && !scStreamPhoneOwns()) scHoldDrop('stream'); }catch(_eHBHold){}",
     """      try{ if(typeof scStreamPhoneOwns === 'function' && !scStreamPhoneOwns()) scHoldDrop('stream'); }catch(_eHBHold){}
      // 81.3 - THE HOLD BELONGS TO A SONG THAT IS REALLY PLAYING. A deck element that
      // is paused or finished gives it back here, the same way the stream's gives its
      // own back above, so a queue that stops at its last song cannot leave the phone
      // awake for nothing.
      try{
        if(typeof scStreamPhoneOwns === 'function' && !scStreamPhoneOwns()){
          var _hbDeck = activeAudio();
          if(!_hbDeck || _hbDeck.paused || _hbDeck.ended) scHoldDrop('deck');
        }
      }catch(_eHBDeck){}""")

# -- 4. the background release asks what is really playing -------------------
once('paused in the background means neither player is sounding',
     """  function mediaPausedInBackground(){
    try{ const a = activeAudio(); return document.hidden && (!a || a.paused); }catch(e){ return false; }
  }""",
     """  // 81.3 - THE STREAM IS SOUND TOO. This asked the deck's element only, so a song
  // playing from the source with the screen off read as "paused in the background":
  // ten minutes later armMediaRelease() stopped the heartbeat, released the wake lock
  // and parked the session - on the deck's song. The keep-alive was torn down behind
  // the one player that was working, and the shade named a song nobody could hear.
  function mediaPausedInBackground(){
    try{
      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){
        const s = scStreamState.audio;
        return document.hidden && (!s || s.paused);
      }
      const a = activeAudio(); return document.hidden && (!a || a.paused);
    }catch(e){ return false; }
  }""")

once('something to come back to includes the stream',
     """  function mediaResumableTrack(){
    try{
      if(queueIndex < 0 || queueIndex >= queue.length) return null;""",
     """  function mediaResumableTrack(){
    try{
      // 81.3 - a song from the source is something to come back to as well. Without
      // this the session was released outright while a paused stream sat on the bar,
      // and the press that was meant to resume it had no entry to land on.
      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()) return scStreamPhoneTrack();
      if(queueIndex < 0 || queueIndex >= queue.length) return null;""")

# -- 5. a pause from outside is undone on whichever element is sounding ------
once('the unrequested pause is undone on the stream',
     """  function scUndoPlatformPause(why, force){
    try{
      const a = activeAudio();
      if(!a || !a.paused) return false;""",
     """  function scUndoPlatformPause(why, force){
    try{
      // 81.3 - A SONG FROM THE SOURCE IS PAUSED FROM OUTSIDE THE SAME WAY. This opened
      // by asking the deck and giving up when the deck was not paused - and while a
      // stream plays the deck is deliberately paused, so the first thing every focus
      // loss, message blip and platform pause met was `return false`. Nothing put the
      // song back until the heartbeat came round, and a source that stopped in the
      // meantime was never put back at all.
      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){
        const s = scStreamState.audio;
        if(!s || !s.paused) return false;
        if(scStreamState.userPaused || s.ended) return false;
        if(audioFocusInterrupted) return false;
        if(scInCall()) return false;
        scStreamState.revives = (Number(scStreamState.revives) || 0) + 1;
        if(scStreamState.revives > 20) return false;
        recordPlaybackStop('reviving the stream after ' + why);
        try{ s.play().catch(function(){}); }catch(_eUndoStream){}
        return true;
      }
      const a = activeAudio();
      if(!a || !a.paused) return false;""")

once('the hand-back goes to the stream, not the deck',
     """          const a = activeAudio();
          if(audioFocusInterrupted && !userPaused && a && a.paused && queueIndex >= 0 && queueIndex < queue.length){
            try{ a.play().catch(function(){}); }catch(e){}
          }""",
     """          // 81.3 - THE HAND-BACK GOES TO WHICHEVER ELEMENT IS MAKING SOUND. This
          // played activeAudio() unconditionally, which is the deck: another app took
          // the audio for a moment while a song from the source was playing, handed it
          // back, and the app started the last DOWNLOADED song over it. With a stream
          // on the bar the stream is resumed and the deck is never started.
          if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){
            const s = scStreamState.audio;
            if(!userPaused && !scStreamState.userPaused && s && s.paused && !s.ended){
              try{ s.play().catch(function(){}); }catch(_eGainStream){}
            }
          } else {
            const a = activeAudio();
            if(audioFocusInterrupted && !userPaused && a && a.paused && queueIndex >= 0 && queueIndex < queue.length){
              try{ a.play().catch(function(){}); }catch(e){}
            }
          }""")

# -- 6. a call silences the stream, and gives it back ------------------------
once('a call pauses whichever element is sounding',
     """      const a = activeAudio();
      if(a && !a.paused && !userPaused){
        recordPlaybackStop('a call is in progress \u2014 pausing until it ends');
        try{ a.pause(); }catch(e){}
      }""",
     """      // 81.3 - A CALL SILENCES WHATEVER IS MAKING SOUND. This paused the deck's
      // element only, so a song playing from the source kept singing through a call -
      // the one thing this app promises never to do.
      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){
        const s = scStreamState.audio;
        if(s && !s.paused){
          recordPlaybackStop('a call is in progress \u2014 pausing until it ends');
          try{ s.pause(); }catch(_eCallStream){}
        }
        return;
      }
      const a = activeAudio();
      if(a && !a.paused && !userPaused){
        recordPlaybackStop('a call is in progress \u2014 pausing until it ends');
        try{ a.pause(); }catch(e){}
      }""")

once('the call ending puts the stream back too',
     """      const a = activeAudio();
      if(wasKnown && a && a.paused && queueIndex >= 0 && queueIndex < queue.length""",
     """      // 81.3 - and the song comes back to whichever element the call stopped.
      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){
        const s = scStreamState.audio;
        if(wasKnown && s && s.paused && !scStreamState.userPaused){
          recordPlaybackStop('call ended \u2014 putting the song back');
          try{ s.play().catch(function(){}); }catch(_eCallEndStream){}
        }
        return;
      }
      const a = activeAudio();
      if(wasKnown && a && a.paused && queueIndex >= 0 && queueIndex < queue.length""")

# -- 7. the changelog entry --------------------------------------------------

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
    "  // 81.3 - YOUR OWN SONGS PLAY OUTSIDE THE APP, AND ONE SOUND AT A TIME.\n"
    "  { version: '81.3', date: '{{STAMP}}', title: 'Your downloads play outside the app, and the source plays fair', items: [\n"
    "    '[FULL] A downloaded song no longer stops when you leave the app or turn the screen off: it asks the phone for the same hold a conversion gets, so Android stops freezing the page behind your music.',\n"
    "    '[FULL] The controls outside the app now act on the song that is really making sound, including a song played online, and a song paused by another app comes straight back instead of leaving the last downloaded song playing.',\n"
    "    '[FULL] A call now silences a song played online as well, and ten minutes with the screen off no longer shuts down the keep-alive behind a song that is still playing.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-813: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-813: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-813: %d steps applied, page is %s' % (len(applied), VERSION))
