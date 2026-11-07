#!/usr/bin/env python3
"""83.1.0 - the press stops choosing between "somebody else" and "nobody".

WHAT 83.0.9 LEFT BROKEN.

83.0.9 made the page load the song before playing it, and made a miss cost nothing.
Two things were still able to make a press end in silence:

  1. The press was still ROUTED through the phone's global media keys. Whenever the
     app "looked alive" - and the heartbeat is only stamped when the page pushes
     state, so a killed app looked alive for up to 15 s - the trampoline sent the
     press back to the provider, whose answer to a play is
     AudioManager.dispatchMediaKeyEvent. That is a key to the WHOLE PHONE: it starts
     Spotify, or it reaches nothing at all. The hidden player was only started after
     2.5 s of nothing. A press in that window was spent on a player that was not us.

  2. The resume refused to start without a queue. restorePlaybackState() returns
     early when the saved track has no loaded audio (a fresh process, right after a
     swipe), and any boot where the saved queue did not survive left queueIndex at -1
     - and every one of the retries then returned false without ever touching a song.

WHAT THIS DOES (the page half; dev/ghost-route.py is the native half):

  * the song is chosen from the saved playback state when the queue is empty, so a
    press never depends on the queue having been rebuilt first;
  * every dead end now says why, once per reason, so the trail on Settings -> Widget
    (and the shade) reads "no play: the song has no audio file" instead of silence;
  * version, service worker cache and changelog move to 83.1.0.

Re-running is a no-op, and --check reports without writing.

  python3 dev/patch-8310.py           apply
  python3 dev/patch-8310.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.1.0'
OLD = '83.0.9'
CHECK = '--check' in sys.argv

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()

if ("const APP_VERSION = '%s';" % VERSION) in s:
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


# ---- 1. the song does not need the queue to exist -------------------------------
OLD_PICK = """      if(queueIndex < 0 || queueIndex >= queue.length) return false;
      var t = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; });
      if(!t || !t.file) return false;
      var a = activeAudio();
      if(!a) return false;
"""
NEW_PICK = """      // 83.1.0 - THE SAVED QUEUE IS A CONVENIENCE, NOT A PRECONDITION.
      //
      // restorePlaybackState() returns early when the saved song has no loaded
      // audio, and it is the only thing that ever fills queue/queueIndex. When it
      // did, every retry below returned false at this line without touching a
      // song - a press that could not work no matter how long it kept asking.
      if(queueIndex < 0 || queueIndex >= queue.length){
        var st = lastPlaybackState || null;
        var want = (st && st.trackId) ? st.trackId : null;
        if(!want){ scResumeMiss('nothing saved to play'); return false; }
        var ids = (st.queue && st.queue.length) ? st.queue.slice() : [want];
        queue = ids.filter(function(id){
          return allTracks.some(function(tr){ return tr.id === id; });
        });
        if(!queue.length) queue = [want];
        queueIndex = queue.indexOf(want);
        if(queueIndex < 0){ queue.unshift(want); queueIndex = 0; }
      }
      var t = allTracks.find(function(tr){ return tr.id === queue[queueIndex]; });
      if(!t){ scResumeMiss('that song is gone from the library'); return false; }
      if(!t.file){ scResumeMiss('"' + t.name + '" has no audio file'); return false; }
      var a = activeAudio();
      if(!a){ scResumeMiss('no player'); return false; }
"""
sub(OLD_PICK, NEW_PICK, 'the song is found without the queue')

OLD_SRC = """      }catch(_eSrc){}
      if(!a.src) return false;
"""
NEW_SRC = """      }catch(_eSrc){}
      if(!a.src){ scResumeMiss('"' + t.name + '" would not load'); return false; }
"""
sub(OLD_SRC, NEW_SRC, 'a song that will not load says so')

# ---- 2. one line per reason, not one per retry ----------------------------------
ANCHOR = """  function scResumeRestoredSong(){
"""
MISS = """  // 83.1.0 - SAY IT ONCE. The retries run every 600 ms; a reason repeated 67 times
  // is noise on the shade, but a reason said once is the whole diagnosis.
  var scResumeMissWhy = '';
  function scResumeMiss(why){
    if(scResumeMissWhy === why) return;
    scResumeMissWhy = why;
    scGhostStep('no play: ' + why);
  }
"""
sub(ANCHOR, MISS + ANCHOR, 'every dead end says why')

# ---- 3. the version, the cache and the changelog --------------------------------
sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)


ENTRY = """  { version: '83.1.0', date: 'November 7, 2026 \u00b7 7:40 AM EST', title: 'A press is never handed to another player', items: [
    'Pressing play on the widget no longer goes through the phone-wide media keys while SideCut looks alive. That key was the reason a press could start Spotify instead, or reach nobody: it is now only used for a pause, when SideCut is the app actually playing.',
    'If SideCut is open but silent, the running app is asked to play and given twelve seconds to answer; a press with nothing running starts the player straight away.',
    'The resume no longer refuses to start when the saved queue did not survive a relaunch: the song comes from the saved playback state, so a lost queue can no longer make a press do nothing.',
    'A press that cannot play now ends in the app within about nine seconds instead of forty, and says why - "no play: the song has no audio file" - in Settings to Widget and on the shade.',
    'A very short buzz when the button is pressed, so it is clear the press reached the app at all.'
  ]},
"""

ANCHOR_OLD = "  { version: '%s', date:" % OLD
sub(ANCHOR_OLD, ENTRY + ANCHOR_OLD, 'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
