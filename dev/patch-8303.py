#!/usr/bin/env python3
"""83.0.3 - SideCut: a paused song still answers the headphones and the widget.

THE ONE LINE THAT DECIDED ALL OF IT. Ten minutes after a pause with the app away,
`armMediaRelease()` stopped the media heartbeat, gave the wake lock back, dropped the
deck's foreground hold and pushed ONE truthful `paused` state - then nothing ever
refreshed that session again. From there Android is free to drop the card, and the
entry the headphones' play button (or the widget's) has to land on stops being
reliable. Twenty minutes later the press came out of the earbuds and nothing answered,
so the only way back was to open the app - which is exactly what the owner reported,
and exactly what the widget does when it cannot find a session (`askResume` +
`openApp`).

THE ANSWER. Parked no longer goes quiet: `startParkedBeat()` keeps the entry, the
metadata and every control warm for as long as a song sits on the deck - one bridge
call a minute, no wake lock, no audio work, so the battery answer is what it was. Any
press (headphones, lock screen, widget, shade) goes through `scTransportPress()`, which
already re-arms the handlers and restarts the deck; `rearmMediaSession()` now stops the
parked beat the moment a press arrives. The session is still released outright when
there is genuinely nothing to come back to.

Re-running is a no-op, and `--check` reports without writing.

  python3 dev/patch-8303.py           apply
  python3 dev/patch-8303.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.0.3'
OLD = '83.0.2'

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()
CHECK = '--check' in sys.argv

if "const APP_VERSION = '%s';" % VERSION in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(old, new, label, text=None):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    s = s.replace(old, new, 1)
    changes.append(label)
    print('ok  ' + label)


# ---- the version ---------------------------------------------------------------------------------
sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')

# The cached shell has to move with the page, or a phone that already has 83.0.2 keeps
# serving its own copy of it from the offline cache after the update.
OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v83';"
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v83.0.3';"
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was (expected exactly 1)')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
changes.append('the service worker cache moves to 83.0.3')
print('ok  the service worker cache moves to 83.0.3')


# ---- the parked beat -----------------------------------------------------------------------------
BEAT = '''  // 83.0.3 - A PARKED SONG KEEPS ITS SESSION WARM.
  //
  // The grace window used to end in silence: one last `paused` push and nothing ever
  // refreshed the card again, so a press from the headphones twenty minutes later
  // landed on a session Android had long stopped listening to - and the widget, which
  // asks this app's player to press play, fell back to opening the app. This is the
  // missing half: while a song sits on the deck and the page is parked, the entry, its
  // metadata and its controls are re-stated once a minute. No wake lock, no audio work,
  // no position churn - a paused notification is what the phone already shows.
  //
  // A press goes through scTransportPress(), which clears the parked flag and calls
  // rearmMediaSession(); that stops this beat, re-registers every control and hands the
  // press to the deck. Nothing here tries to start playback on its own.
  let mediaParkedBeat = null;
  let mediaParkedBeats = 0;
  function stopParkedBeat(){
    if(mediaParkedBeat){ clearInterval(mediaParkedBeat); mediaParkedBeat = null; }
  }
  function startParkedBeat(track){
    stopParkedBeat();
    mediaParkedBeats = 0;
    const beat = function(){
      try{
        if(!mediaParkedInBackground){ stopParkedBeat(); return; }
        const t = track || (typeof mediaResumableTrack === 'function' ? mediaResumableTrack() : null);
        if(!t){ stopParkedBeat(); return; }
        try{ mediaSetMetadata(t); }catch(_ePkMeta){}
        try{ mediaSetPlaybackState('paused'); }catch(_ePkState){}
        mediaParkedBeats++;
        // The handlers are what make forward/back present instead of dead. Re-asserting
        // them every beat would be a bridge call a minute for nothing; every fourth is
        // enough to cover a session the phone rebuilt underneath us.
        if(mediaParkedBeats % 4 === 1){
          try{ mediaHandlersNeedArm(); refreshMediaControls(); }catch(_ePkArm){}
        }
      }catch(_ePk){ }
    };
    mediaParkedBeat = setInterval(beat, 60000);
    // The battery saver stops every tracked timer on hide, and this beat only ever runs
    // while hidden - so it is exempt, exactly like the heartbeat.
    try{ if(window.__scKeepAliveTimer && mediaParkedBeat) window.__scKeepAliveTimer(mediaParkedBeat); }catch(_ePkKeep){}
  }
'''

sub('  function armMediaRelease(){',
    BEAT + '  function armMediaRelease(){',
    'the parked beat')

sub('''        // One last push, then silence: the player names the song and says paused, so
        // the outside surfaces have something truthful to press play on.
        try{ mediaSetMetadata(back); mediaSetPlaybackState('paused'); }catch(e){}''',
    '''        // 83.0.3 - PARKED MEANS STILL LISTENING, NOT GONE QUIET. This one push used to
        // be all the session ever got: the beat was stopped, the wake lock given back and
        // nothing refreshed the card again, so the press that arrives twenty minutes
        // later - headphones, lock screen, widget, shade - had no live session to land
        // on. startParkedBeat() keeps it warm until a press arrives or the deck empties.
        try{ mediaSetMetadata(back); mediaSetPlaybackState('paused'); }catch(e){}
        startParkedBeat(back);''',
    'a parked session starts its beat')

sub('''  function rearmMediaSession(){
    if(mediaParkedInBackground){
      mediaParkedInBackground = false;''',
    '''  function rearmMediaSession(){
    if(mediaParkedInBackground){
      mediaParkedInBackground = false;
      // 83.0.3 - the press that undoes a park also ends the parked beat: the deck's own
      // heartbeat is the one that should be running from here.
      stopParkedBeat();''',
    'a press ends the parked beat')


# ---- the settings note that told the owner the opposite ------------------------------------------
sub('Note: if the app is closed or swiped away from recents, the widget will not play the right audio '
    '\u2014 open SideCut again to get the widget back in sync.',
    'A paused song stays reachable from this widget, the lock screen and your headphones - press play '
    'there and it resumes without opening the app, even after twenty minutes or an hour. The one case '
    'that still needs the app is a phone that has killed SideCut (swiped away from recents, or short '
    'of memory): open it once and the song is back.',
    'the widget note tells the truth')


# ---- the changelog -------------------------------------------------------------------------------
ENTRY = '''  { version: '%s', date: 'November 7, 2026 · 1:20 PM EST', title: 'A paused song answers the headphones and the widget again', items: [
    'Press play on your earbuds after twenty minutes away and the song starts again, instead of nothing answering.',
    'Parked is not silent any more: while a song sits on the deck, the player behind the lock screen, the shade and the widget is kept warm once a minute, so the press always has something live to land on.',
    'The home-screen widget resumes without opening the app. Its play button was always asking this app to press play - the session it reached had simply stopped being refreshed ten minutes into a pause.',
    'Battery is unchanged: no wake lock is held and nothing is decoded while parked, just one small call a minute until you press play or the queue empties.',
    'This one is in the page: it arrives the next time the app opens, with nothing to install.'
  ]},
''' % VERSION

sub("  { version: '%s', date: 'November 6, 2026 · 10:36 PM EST', title: 'My Hub is off the Other apps list', items: [" % OLD,
    ENTRY + "  { version: '%s', date: 'November 6, 2026 · 10:36 PM EST', title: 'My Hub is off the Other apps list', items: [" % OLD,
    'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
