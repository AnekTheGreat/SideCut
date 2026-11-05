#!/usr/bin/env python3
"""81.6 - the headphones keep working after a pause.

    python3 dev/patch-816.py
    python3 dev/patch-816.py --check

WHAT THE OWNER SAID: "when I'm listening to music with headphones and I pause it
using the headphone pause control, it doesn't let me unpause it with skipping
forward a song and back, fix this so I can pause and unpause and use all controls
on headphones".

THE SHAPE OF IT. A pause is a pause, but this player answers it in four places at
once: the element stops, `userPaused` is set so nothing revives it, the keep-alive
heartbeat is stopped, and - because the phone is in a pocket, so the page is hidden
- armMediaRelease() starts a ten minute clock that ends by PARKING or RELEASING the
media session. Everything that can undo a pause lived behind one of those four:

  1. A press was only half of a request for sound. `scTransportResume()` cleared
     `userPaused` and `audioFocusInterrupted` and stopped there, so play/next/prev
     obeyed a player whose keep-alive had been stopped by the very pause they were
     undoing. Nothing re-armed the session, nothing cancelled the release clock.
  2. The session could be torn down with a song still on the deck. `mediaResumableTrack()`
     asked for a File, so a song playing from a URL - cloud, a share, a source cache -
     answered null, and ten minutes into a pause the session was RELEASED ('none').
     A released session is a notification that no longer exists: the headset's play
     and skips were handed to nothing at all.
  3. A stream's own buttons never cleared their pause mark. The deck's handlers did;
     `scStreamPhoneArm()`'s play and previous did not, so a source paused from the
     headphones kept `scStreamState.userPaused` set while the press asked it to sound.
     Previous also seeked to zero and returned without starting, so a paused stream
     past the three second mark restarted silently.
  4. A pause stopped the keep-alive at once, even with the page hidden - which is the
     one state in which the card, the handlers and the playhead need refreshing, so a
     press a minute later landed on a session the phone had stopped maintaining.

THE ANSWER.

  * `scTransportPress()` is what every media-session control now calls: it clears the
    mark, cancels the release clock, clears the parked/released flags, re-arms the
    handlers and starts the keep-alive again - then the press is obeyed.
  * `mediaResumableTrack()` answers with anything that can sound, a File OR a URL, so
    a paused song is parked (kept reachable) instead of released.
  * The stream's play and previous clear their pause mark, and previous starts the
    song it just rewound.
  * A pause pressed from outside the app while the app is away keeps the keep-alive
    for the grace window; armMediaRelease() still takes all of it away when the window
    closes, and it now gives the phone hold back too, so the battery answer is unchanged.
  * `playCurrent()` rebuilds a blob URL the phone reclaimed before it hands it to the
    element - the skip that resumes a long-paused song is exactly when that URL is dead.
  * The stop handler no longer dereferences a missing element.
"""

import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '81.6'
MARKER = '81.6 - A PRESS FROM THE HEADPHONES IS A REQUEST FOR THE WHOLE PLAYER BACK'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-816: already on the page, the page is %s' % VERSION)
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
        print('patch-816: %d step(s) could not be applied, nothing was written:' % len(failed))
        for f in failed:
            print('  - ' + f)
        sys.exit(2)
    if CHECK:
        # 1 = the page still needs this payload, 0 = it already has it.
        print('1')
        sys.exit(1)
    with open(INDEX, 'w', encoding='utf-8') as fh:
        fh.write(SRC)
    print('patch-816: %d step(s) applied - the page is %s' % (len(applied), VERSION))


# --- 1. a press is a request for the whole player, not just the mark ----------
once('the transport press',
     """  function scTransportResume(){
    userPaused = false;
    audioFocusInterrupted = false;
  }""",
     """  function scTransportResume(){
    userPaused = false;
    audioFocusInterrupted = false;
  }
  // 81.6 - A PRESS FROM THE HEADPHONES IS A REQUEST FOR THE WHOLE PLAYER BACK.
  // Clearing the mark was half of it. The pause that set the mark also stopped the
  // keep-alive and started a clock that parks (or, with nothing resumable, releases)
  // the session - so the press that undoes a pause was obeyed by a player that had
  // stopped listening. This puts back what the pause took away, in the order that
  // matters: the clock is cancelled before it can fire, the parked/released flags are
  // cleared so the re-arm is not a no-op, the handlers are re-registered on whatever
  // session the phone rebuilt while we were away, and the heartbeat that keeps the
  // card and the playhead fresh is running again before the press is obeyed.
  let scTransportPaused = false;
  function scTransportPress(){
    try{ scTransportResume(); }catch(_eTpResume){}
    try{ cancelMediaRelease(); }catch(_eTpRelease){}
    try{ mediaParkedInBackground = false; mediaReleasedInBackground = false; }catch(_eTpFlags){}
    try{ rearmMediaSession(); }catch(_eTpRearm){}
    try{ startMediaSessionHeartbeat(); }catch(_eTpBeat){}
    scTransportPaused = false;
  }""")

once('play asks for the player back',
     """    mediaSetActionHandler('play', () => {
      try{ scTransportResume(); }catch(e){}""",
     """    mediaSetActionHandler('play', () => {
      try{ scTransportPress(); }catch(e){}""")

once('previous asks for the player back',
     """    mediaSetActionHandler('previoustrack', () => {
      try{ scTransportResume(); }catch(e){}""",
     """    mediaSetActionHandler('previoustrack', () => {
      try{ scTransportPress(); }catch(e){}""")

once('next asks for the player back',
     """      // 72.5.2 - a skip is a request to HEAR the next song: the deliberate-stop
      // mark an earlier pause left behind must not silence it in the background.
      try{ scTransportResume(); }catch(e){}""",
     """      // 72.5.2 - a skip is a request to HEAR the next song: the deliberate-stop
      // mark an earlier pause left behind must not silence it in the background.
      // 81.6 - and a skip after a HEADPHONE pause asks for the player back too: the
      // press re-arms the session the pause parked before the next song is picked.
      try{ scTransportPress(); }catch(e){}""")

# --- 2. a pause remembers it came from the headphones ------------------------
once('the pause handler records where the pause came from',
     """      if(_wasPlaying) recordPlaybackStop('media-session-pause');
      scPauseDeck();""",
     """      if(_wasPlaying) recordPlaybackStop('media-session-pause');
      // 81.6 - REMEMBER WHERE THIS PAUSE CAME FROM. A pause pressed on the headphones
      // (or the lock screen, or the widget) is a pause the owner expects to undo with
      // the same buttons, from a phone that is still in their hand - so its keep-alive
      // survives the grace window below instead of being dropped on the spot.
      scTransportPaused = true;
      scPauseDeck();""")

once('a transport pause keeps the keep-alive for the grace window',
     """    if(userPaused){
      stopMediaSessionHeartbeat(); releaseWakeLock();
      // 81.3 - and the phone, for the same reason. A pause the user asked for is the
      // one case where the deck has no work left to keep the process alive for.
      try{ scHoldDrop('deck'); }catch(_eHoldDrop){}
    }""",
     """    if(userPaused){
      // 81.6 - A PAUSE PRESSED FROM THE HEADPHONES WITH THE APP AWAY IS NOT THE END OF
      // THE SESSION. Dropping the keep-alive here is what made the second press dead:
      // the card stopped being refreshed, the handlers were never re-registered on a
      // session the phone rebuilt, and ten minutes later the session was parked or
      // released with nothing left listening. The keep-alive now survives a transport
      // pause while the page is hidden, and armMediaRelease() - the ten minute clock
      // armed on the very next line - still takes every bit of it away when the window
      // closes, so the battery answer is exactly what it was.
      const _keepForPress = scTransportPaused && document.hidden;
      if(!_keepForPress) stopMediaSessionHeartbeat();
      releaseWakeLock();
      // 81.3 - and the phone, for the same reason. A pause the user asked for is the
      // one case where the deck has no work left to keep the process alive for.
      if(!_keepForPress){ try{ scHoldDrop('deck'); }catch(_eHoldDrop){} }
    }""")

once('the parked session gives the phone hold back when the window closes',
     """      stopMediaSessionHeartbeat();
      releaseWakeLock();
      const back = mediaResumableTrack();""",
     """      stopMediaSessionHeartbeat();
      releaseWakeLock();
      // 81.6 - the hold kept for a transport pause is given back here, with the rest of
      // it: the window ending is the window ending, whichever press started it.
      try{ scHoldDrop('deck'); }catch(_eHoldGrace){}
      const back = mediaResumableTrack();""")

# --- 3. anything that can sound is something to come back to -----------------
once('a paused song from a URL is still a song to come back to',
     """      if(queueIndex < 0 || queueIndex >= queue.length) return null;
      const t = allTracks.find(tr => tr.id === queue[queueIndex]);
      return (t && t.file) ? t : null;""",
     """      if(queueIndex < 0 || queueIndex >= queue.length) return null;
      const t = allTracks.find(tr => tr.id === queue[queueIndex]);
      if(!t) return null;
      // 81.6 - ANYTHING THAT CAN SOUND IS SOMETHING TO COME BACK TO. This asked for a
      // File, so a song playing from a URL - cloud mode, a share, a source cache - had
      // no resumable track at all: ten minutes into a pause the session was RELEASED
      // ('none'), the notification went away, and the headphones' play and skips were
      // handed to nothing. A parked session is the whole point of the grace window, so
      // a live URL counts exactly like a file on the device.
      return (t.file || t.url) ? t : null;""")

# --- 4. the resuming skip rebuilds a source the phone reclaimed --------------
once('playCurrent rebuilds a dead blob before it hands it to the element',
     """    const a = activeAudio();
    a.src = t.url;
    a.currentTime = 0;""",
     """    const a = activeAudio();
    // 81.6 - A SKIP THAT RESUMES A LONG-PAUSED SONG IS WHEN THE BLOB IS DEAD. Android
    // reclaims the object URL of a song that has been paused for a while, and the
    // element then plays nothing (or its last buffer): the press moved the queue and
    // the bar but no sound came out. The file is still here, so the URL is remade
    // first - the same rebuild recoverAudio() does, done before play() can fail.
    if(t.file && (!t.url || a.error)){
      try{ if(t.url) URL.revokeObjectURL(t.url); }catch(_eRebuildRevoke){}
      try{ t.url = URL.createObjectURL(t.file); }catch(_eRebuildUrl){}
    }
    a.src = t.url;
    a.currentTime = 0;""")

# --- 5. the stream's own buttons clear their mark, and previous resumes ------
once('a stream play press clears the pause mark',
     """      mediaSetActionHandler('play', function(){
        var a = el();
        if(!a) return;
        if(!a.src && scStreamState.curId){ scStreamPlay(scStreamState.curId); return; }""",
     """      mediaSetActionHandler('play', function(){
        var a = el();
        if(!a) return;
        // 81.6 - THE PRESS IS THE REQUEST. The deck's handlers cleared the deliberate
        // pause mark and the stream's did not, so a source paused from the headphones
        // kept saying "the owner paused this on purpose" for as long as it stayed up.
        scStreamState.userPaused = false;
        if(!a.src && scStreamState.curId){ scStreamPlay(scStreamState.curId); return; }""")

once('a stream previous resumes the song it rewound',
     """      mediaSetActionHandler('previoustrack', function(){
        var a = el();
        if(a && (a.currentTime || 0) > 3){ try{ a.currentTime = 0; }catch(_ePpv){} return; }
        scStreamNext(-1);
      });
      mediaSetActionHandler('nexttrack', function(){ scStreamNext(1); });""",
     """      mediaSetActionHandler('previoustrack', function(){
        var a = el();
        scStreamState.userPaused = false;
        if(a && (a.currentTime || 0) > 3){
          try{ a.currentTime = 0; }catch(_ePpv){}
          // 81.6 - and it SOUNDS. Rewinding a paused stream and returning left the
          // press looking like it had done nothing but move a number.
          if(a.paused){ try{ Promise.resolve(a.play()).catch(function(){}); }catch(_ePpv2){} }
          return;
        }
        scStreamNext(-1);
      });
      mediaSetActionHandler('nexttrack', function(){ scStreamState.userPaused = false; scStreamNext(1); });""")

# --- 6. the stop button stops whatever is there ------------------------------
once('stop does not dereference a missing element',
     """    mediaSetActionHandler('stop', () => {
      scPauseDeck();
      activeAudio().currentTime = 0;
    });""",
     """    mediaSetActionHandler('stop', () => {
      scPauseDeck();
      const _stopA = activeAudio();
      if(_stopA){ try{ _stopA.currentTime = 0; }catch(_eStopSeek){} }
    });""")

# --- 7. the release notes ----------------------------------------------------
once('the version',
     "const APP_VERSION = '81.5';",
     "const APP_VERSION = '81.6';")

once('the changelog head',
     "  { version: '81.5', date: 'November 3, 2026 \u00b7 2:06 PM EST',",
     """  // 81.6 - THE HEADPHONES' BUTTONS WORK AFTER A PAUSE.
  { version: '81.6', date: 'November 5, 2026 \u00b7 12:20 PM EST', title: 'The headphones keep working after a pause', items: [
    'Pause from the headphones and the same buttons bring the music back: play, next and previous all resume a paused song, and next starts the song it moves to.',
    'A paused song stays reachable from the headphones, the lock screen and the widget instead of the player going quiet after ten minutes away, and a song played from a URL stays reachable the same way a file does.',
    'Previous on a paused song rewinds to the start and plays it, and a skip that resumes a long-paused song rebuilds its audio if the phone had reclaimed it, so the bar moves and the sound comes back.',
  ] },
  { version: '81.5', date: 'November 3, 2026 \u00b7 2:06 PM EST',""")

done()
