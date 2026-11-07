#!/usr/bin/env python3
"""83.0.9 - a widget press plays a song, not a memory of one.

WHY 83.0.5 TO 83.0.8 ALL ENDED IN SILENCE.

Every one of them assumed the press failed somewhere in the native half. It did not.
The resume the page runs was broken in two ways that made it fail silently EVERY time:

  1. IT PRESSED PLAY ON AN EMPTY ELEMENT. scResumeRestoredSong() called play() without
     ever putting the song on the element. The boot restore only loads a song when the
     track already has an object URL, and on a fresh process it can have none - so the
     element had no src, play() rejected with NotSupportedError, and nothing was heard.
     The track's File is still in the library, so the URL is what has to be remade here.

  2. THE FIRST MISS DELETED THE PRESS. Every page report went through ghostStep(), and
     that cleared the pending request whatever the report said. The page asks about
     700 ms into boot, the library is still hydrating, the queue is empty, the step says
     so - and the request is gone. The three later asks then read "nothing pending" and
     did nothing, so a press that arrived a second too early could never be recovered.

WHAT THIS DOES:

  * the song is put on the element before play() (and a blob URL the OS reclaimed is
    remade, once, before giving up on that attempt);
  * a miss is no longer a verdict: the page keeps asking every 600 ms, for about 40 s,
    until audio is actually playing or the budget is spent;
  * only "playing ..." settles the request (that half is native: dev/ghost-host.py);
  * the hidden player waits long enough for that to finish before it opens the app.

Re-running is a no-op, and --check reports without writing.

  python3 dev/patch-8309.py           apply
  python3 dev/patch-8309.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.9'
OLD = '83.0.8'
CHECK = '--check' in sys.argv

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()

if ("const APP_VERSION = '%s';" % VERSION) in s and 'function scResumePollStart()' in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    s = s.replace(old, new, 1)
    changes.append(label)
    print('ok  ' + label)


# ---- 1. the song goes on the element before anything is played -------------------
RESUME_START = "  // Press play on whatever the restore put on the deck, at the position it was\n"
RESUME_END = "  // One bridge call, only when it can matter"
i = s.find(RESUME_START)
j = s.find(RESUME_END)
if i < 0 or j < 0 or j < i:
    sys.exit('the resume block is not where this expects it (%d, %d)' % (i, j))
if s.count(RESUME_START) != 1 or s.count(RESUME_END) != 1:
    sys.exit('the resume block boundaries are not unique')

RESUME_NEW = """  // 83.0.9 - A PRESS IS A PLAY, NOT A GUESS AT A SONG.
  //
  // This used to call play() on whatever the restore had left on the deck. On a fresh
  // process the restore gives up on a song with no object URL, so the element sits there
  // with no src, play() rejects, and the press is silent - which is what four builds in a
  // row reported. The song's File is still in the library, so the URL is remade here and
  // the element is loaded before it is asked to play.
  //
  // Nothing in here reports a failure to the native side. A miss is not a verdict: the
  // caller keeps asking until audio is really playing (scResumePollStart below), and only
  // an actual "playing ..." report settles the request.
  function scResumeRestoredSong(){
    try{
      // 80.7.2 - the press from the widget, the lock screen or the now bar
      // resumes the song that is actually on the bar, streamed or not.
      if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;
      if(queueIndex < 0 || queueIndex >= queue.length) return false;
      var t = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; });
      if(!t || !t.file) return false;
      var a = activeAudio();
      if(!a) return false;
      // Put the song on the element. A blob URL can also be dead after the app was
      // away (the OS reclaims it), so the URL is remade whenever the element is not
      // already holding this song.
      try{
        if(!t.url || a.error || a.src !== t.url){
          if(t.url && a.src !== t.url){ try{ URL.revokeObjectURL(t.url); }catch(_eRv1){} t.url = null; }
          if(!t.url){ try{ t.url = URL.createObjectURL(t.file); }catch(_eMk1){ t.url = null; } }
          if(t.url && a.src !== t.url) a.src = t.url;
        }
      }catch(_eSrc){}
      if(!a.src) return false;
      // A song that had already finished is started over, not left at its end:
      // play() on an element parked at duration ends on the first tick.
      if(a.duration && a.currentTime >= a.duration - 0.5) a.currentTime = 0;
      // This press is a request to hear the song, so a manual pause from earlier
      // is over.
      userPaused = false;
      if(audioCtx && audioCtx.state === 'suspended'){ audioCtx.resume().catch(function(){}); }
      $('playPauseBtn').classList.remove('pulse-cue');
      try{ updateNowPlayingUI(t); }catch(_eUi){}
      var started = function(){
        scGhostStep('playing "' + t.name + '"');
        // Everything a normal play does to the screen and to the phone: the now
        // bar, the widget's own state push, and the notification / lock-screen
        // player - which only exists while the app is PLAYING, so the resume has
        // to say so. The widget push also refreshes the heartbeat, which is what
        // tells the hidden player its sound is real.
        try{ mediaSetPlaybackState('playing'); }catch(_eMs){}
        try{ pushWidgetState(t, true); }catch(_ePush){}
        toast('Picked back up on "' + t.name + '"', 2600);
        window.__scWidgetResumed = (window.__scWidgetResumed || 0) + 1;
      };
      var attempt = function(first){
        try{
          var p = a.play();
          if(p && typeof p.then === 'function'){
            p.then(started).catch(function(){
              if(!first) return;   // one rebuild per attempt - the caller retries
              // A rejected play on a dead blob: remake it and try once more, or the
              // retry would keep hammering the same dead URL.
              try{ URL.revokeObjectURL(t.url); }catch(_eRv2){}
              try{ t.url = URL.createObjectURL(t.file); a.src = t.url; }catch(_eMk2){ return; }
              try{
                var q = a.play();
                if(q && typeof q.then === 'function') q.then(started).catch(function(){});
              }catch(_eQ){}
            });
          } else started();
        }catch(_ePlay){}
      };
      attempt(true);
      return true;
    }catch(_eRes){ return false; }
  }
"""

s = s[:i] + RESUME_NEW + s[j:]
changes.append('the resume loads the song before it plays')
print('ok  the resume loads the song before it plays')


# ---- 2. keep asking until something is actually playing --------------------------
ANCHOR_RESTORED = "  window.__scWidgetResumeRestored = scResumeRestoredSong;\n"
if s.count(ANCHOR_RESTORED) != 1:
    sys.exit('the resume export is not where this expects it')

POLL_NEW = """  // 83.0.9 - THE PRESS THAT ARRIVED A SECOND TOO EARLY IS THE NORMAL ONE.
  //
  // A cold boot has to hydrate the library out of the database before there is a queue
  // to resume. The old four asks were a guess at how long that takes, and the first miss
  // used to delete the request outright. Now the page asks again, every 600 ms, until
  // audio is actually playing (or about 40 s have gone by), and a miss costs nothing.
  var scResumePoll = null;
  var scResumePolls = 0;
  function scResumePollStop(){
    if(scResumePoll){ try{ clearInterval(scResumePoll); }catch(_eSp){} scResumePoll = null; }
  }
  function scResumePollStart(){
    if(scResumePoll) return;
    scResumePolls = 0;
    scResumePoll = setInterval(function(){
      scResumePolls++;
      var playingNow = false;
      try{ playingNow = !activeAudio().paused; }catch(_ePp){ playingNow = false; }
      // 67 ticks is a little over 40 s: long enough for a cold library, short
      // enough that a press which cannot play does not keep a ghost alive.
      if(playingNow || scResumePolls > 67){ scResumePollStop(); return; }
      try{ scWidgetResumeCheck(); }catch(_ePc){}
    }, 600);
  }
"""

sub(ANCHOR_RESTORED, ANCHOR_RESTORED + POLL_NEW, 'the retry poll')

# ---- 3. a miss starts the retries instead of announcing the end -------------------
CHECK_OLD = """        if(!res || !res.resume) return;
        if(!scResumeRestoredSong()) toast('Nothing to pick back up yet - play a song first.', 3000);
"""
CHECK_NEW = """        // 83.0.9 - nothing to resume YET is not nothing to resume: the queue is
        // rebuilt from the database during boot, so this keeps asking instead of
        // telling the listener their press did nothing.
        if(!res || !res.resume){ scResumePollStop(); return; }
        scResumeRestoredSong();
        scResumePollStart();
"""
sub(CHECK_OLD, CHECK_NEW, 'a miss retries instead of ending the press')


# ---- 4. the version, the cache and the changelog --------------------------------
sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)


ENTRY = """  { version: '83.0.9', date: 'November 7, 2026 · 6:05 AM EST', title: 'The widget press actually plays', items: [
    'The resume pressed play on an element it had never loaded, so a press after the app was swiped away could only ever be silence: the song file was there, but nothing had put it on the deck.',
    'It now puts the song on the deck first, remakes the audio URL if the phone reclaimed it, and tries again instead of giving up on the first refusal.',
    'A press that arrives while the library is still loading is no longer thrown away: the app keeps trying for about forty seconds until music is really playing.',
    'This half is the page; install the newest Android build for the native half.'
  ]},
"""

ANCHOR = "  { version: '%s', date: 'November 7, 2026 · 5:20 AM EST'" % OLD
sub(ANCHOR, ENTRY + ANCHOR, 'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
