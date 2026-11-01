#!/usr/bin/env python3
"""80.7.6 - the bar comes back to the song that was played last.

    python3 dev/patch-8076.py
    python3 dev/patch-8076.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

THE FAULT. Two stores remembered two different things. This module remembered the
last song played from the catalogue (meta `streamLast`), the deck remembered its own
queue (meta `playback`), and neither knew the other existed. At launch the catalogue
restore ran last and claimed the bar whenever its row was under twelve hours old - so
a song played from the catalogue in the morning came back on the bar over the
download played five minutes ago, on the phone as well as on screen.

 1. THE VERSION.
 2. ONE RECORD OF WHAT PLAYED LAST. Both players write meta `lastPlayed` at the
    moment a song starts, and the deck's own saved state now carries the time it was
    written, so an older install can be judged without one.
 3. THE BAR ONLY COMES BACK TO THE CATALOGUE WHEN IT WAS REALLY LAST.
 4. THE CHANGELOG, as every release has it.
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.6'
MARKER = '80.7.6 - THE BAR COMES BACK TO THE SONG PLAYED LAST'
ANCHOR = "  { version: '80.7.5',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-8076: already on the page, the page is %s' % VERSION)
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
once('the page says 80.7.6',
     "const APP_VERSION = '80.7.5';",
     "const APP_VERSION = '80.7.6';")

# -- 2. the deck's saved state carries when it was saved ---------------------
once('a deck play is stamped with its time',
     """        currentTime: activeAudio().currentTime || 0,
        sourcePlaylist: queueSourcePlaylist,
""",
     """        currentTime: activeAudio().currentTime || 0,
        sourcePlaylist: queueSourcePlaylist,
        // 80.7.6 - WHEN this play was saved. Without it the bar at the next launch
        // had no way to compare a download against the catalogue's own row, so the
        // catalogue won any tie it liked.
        savedAt: Date.now(),
""")

once('a deck play writes the shared record',
     """    crossfadeTriggered = false;
    updateNowPlayingUI(t);
    savePlaybackState(true);
""",
     """    crossfadeTriggered = false;
    updateNowPlayingUI(t);
    scLastPlayedSet('deck', t.id);   // 80.7.6 - what played last, written by both players
    savePlaybackState(true);
""")

once('a catalogue play writes the shared record',
     """    scStreamRender();
    scStreamBarOn(t);
""",
     """    scStreamRender();
    scStreamBarOn(t);
    scLastPlayedSet('stream', String(id));   // 80.7.6 - this song was played last
""")

# -- 3. the bar only comes back to the catalogue when it was last ------------
RESTORE_BLOCK = """  // 80.7.6 - ONE RECORD OF WHAT PLAYED LAST, WRITTEN BY BOTH PLAYERS.
  // Two stores remembered two different things: this module remembered the last song
  // played from the catalogue (streamLast) and the deck remembered its own queue
  // (playback), and neither knew the other existed. At launch the catalogue restore
  // ran last and claimed the bar whenever its row was under twelve hours old - so a
  // song from the morning came back over the download played five minutes ago.
  // Both players now write this one row at the moment a song starts, and the bar
  // comes back to the catalogue only when this row says the catalogue was last.
  function scLastPlayedSet(kind, id){
    try{
      dbPut('meta', { key: 'lastPlayed', value: { kind: String(kind || ''), id: String(id || ''), at: Date.now() } });
    }catch(_eLastPlayed){}
  }
  function scLastPlayedWasStream(streamLast, deckState, stamp){
    if(stamp && stamp.kind) return String(stamp.kind) === 'stream';
    var deckAt = Number(deckState && deckState.savedAt) || 0;
    var streamAt = Number(streamLast && streamLast.savedAt) || 0;
    if(deckAt && streamAt) return streamAt > deckAt;   // both dated: the later one wins
    // Only one side is dated, so the times cannot order them. A deck session with a
    // position in it is a song that was really being listened to, and a catalogue row
    // on its own proves only that a catalogue song was STARTED at some point - which
    // is the shape every install has the first time it runs this release. The deck
    // wins there, so a download played after a catalogue song keeps the bar.
    return !(deckState && Number(deckState.currentTime) > 0);
  }
  // After a launch, the last song played from the catalogue comes back on the bar,
  // paused, at the second it stopped on - but only when it really was the last song
  // played. A download played after it owns the bar, and the catalogue stays out of
  // the way, which is what the owner reported it was not doing.
  function scStreamRestoreLast(){
    if(!SC_STREAM_OK) return;
    try{
      Promise.all([
        Promise.resolve(dbGet('meta', 'streamLast')).catch(function(){ return null; }),
        Promise.resolve(dbGet('meta', 'playback')).catch(function(){ return null; }),
        Promise.resolve(dbGet('meta', 'lastPlayed')).catch(function(){ return null; })
      ]).then(function(rows){
        var v = (rows[0] && rows[0].value) || null;
        if(!v || !v.id) return;
        if(Date.now() - (Number(v.savedAt) || 0) > 12 * 60 * 60 * 1000) return;
        var t = scStreamById(v.id);
        if(!t) return;
        if(!scLastPlayedWasStream(v, (rows[1] && rows[1].value) || null, (rows[2] && rows[2].value) || null)) return;
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
"""
once('the bar asks what played last instead of assuming',
     """  // After a launch, the last stream comes back on the bar, paused, at the second it
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
""", RESTORE_BLOCK)

# -- 4. the changelog -------------------------------------------------------


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
    "  // 80.7.6 - THE BAR COMES BACK TO THE SONG PLAYED LAST.\n"
    "  { version: '80.7.6', date: '{{STAMP}}', title: 'The bar comes back to the song played last', items: [\n"
    "    '[FULL] After a restart the player bar and the lock screen come back to the song you played most recently, so a song from the catalogue can no longer come back over a song from your library that you played after it.',\n"
    "    '[FULL] Both players now write one shared record of the song that started playing, and the deck writes down when it saved its own place, so the bar follows the last real play instead of each player assuming it was the one that mattered.',\n"
    "    '[FULL] A catalogue song is only brought back when it really was the last thing you played, and it still comes back paused at the second it stopped on.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-8076: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-8076: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-8076: %d steps applied, page is %s' % (len(applied), VERSION))
