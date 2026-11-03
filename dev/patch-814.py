#!/usr/bin/env python3
"""81.4 - a song that is not making sound stops claiming to play, and the full web
app can hand someone the full APK.

    python3 dev/patch-814.py
    python3 dev/patch-814.py --check

1. THE FAKE PLAYING. startMediaSessionHeartbeat judges the deck by its playhead
   (playbackSurvivedBackground) and the stream by NOTHING: while a stream owns the bar
   it sets bgDead = false outright, then pushes `a.paused ? ...` for the deck element -
   which is deliberately paused under a stream. So a WebView Android froze with a song
   from the source "playing" kept saying playing, with a playhead that never moved, and
   the shade, the lock screen and the widget believed it. The stream now records its own
   trip (noteBackgroundStart) and is judged the same way the deck is, and the pushed
   state is the sounding element's.

2. THE FULL APK IN TOOLS. On the full web page only (SC_IS_WEB and not SC_IS_PLAY - not
   the plain web page, not either APK), the Tools pane carries a card whose button opens
   the newest release, where SideCut-full.apk is attached by android-build.yml.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '81.4'
MARKER = '81.4 - A SONG THAT IS NOT SOUNDING DOES NOT SAY IT IS PLAYING'
ANCHOR = "  { version: '81.3',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-814: already on the page, the page is %s' % VERSION)
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


once('the page says 81.4',
     "const APP_VERSION = '81.3';",
     "const APP_VERSION = '81.4';")

# -- 1. the stream gets a trip of its own ------------------------------------
once('the stream remembers where it started',
     "  let bgTrip = { at: 0, pos: 0, trackId: null, believedPlaying: false };",
     """  let bgTrip = { at: 0, pos: 0, trackId: null, believedPlaying: false };
  // 81.4 - A SONG THAT IS NOT SOUNDING DOES NOT SAY IT IS PLAYING. This judgement was
  // made for the deck only; a stream was declared alive whatever happened.
  let scStreamBgTrip = { at: 0, pos: 0, id: '', believedPlaying: false };""")

once('leaving the app records the stream too',
     """        believedPlaying: !!(a && !a.paused && !userPaused
                            && queueIndex >= 0 && queueIndex < queue.length),
      };
    }catch(e){ }""",
     """        believedPlaying: !!(a && !a.paused && !userPaused
                            && queueIndex >= 0 && queueIndex < queue.length),
      };
      // 81.4 - the same record for the element that is actually making sound.
      const s = (typeof scStreamState !== 'undefined') ? scStreamState.audio : null;
      scStreamBgTrip = {
        at: Date.now(),
        pos: s ? (Number(s.currentTime) || 0) : 0,
        id: (typeof scStreamState !== 'undefined') ? String(scStreamState.curId || '') : '',
        believedPlaying: !!(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()
                            && s && !s.paused && !scStreamState.userPaused),
      };
    }catch(e){ }""")

once('the stream can be judged by its playhead',
     "  function playbackSurvivedBackground(){ return playbackSurvivedBackgroundFrom(bgTrip); }",
     """  function playbackSurvivedBackground(){ return playbackSurvivedBackgroundFrom(bgTrip); }
  // 81.4 - THE STREAM, BY ITS OWN PLAYHEAD. A frozen WebView leaves the element saying
  // `paused === false` and the clock stopped; a song that really played moved it about
  // one second per second. Same test as the deck, with the same slack.
  function scStreamSurvivedBackgroundFrom(trip){
    try{
      if(!trip || !trip.at || !trip.believedPlaying) return true;
      const s = scStreamState.audio;
      if(!s) return false;
      const awaySec = (Date.now() - trip.at) / 1000;
      if(awaySec < 4) return true;
      if(s.paused) return false;
      if(String(scStreamState.curId || '') !== String(trip.id || '')) return true;
      const moved = (Number(s.currentTime) || 0) - (Number(trip.pos) || 0);
      if(moved < 0) return true;
      return (awaySec - moved) < 3;
    }catch(_eScTrip){ return true; }
  }""")

once('the heartbeat judges the stream, and pushes the sounding element',
     """      const bgDead = (typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns())
        ? false : (!userPaused && !playbackSurvivedBackground());
      if(bgDead) mediaSetPlaybackState('paused');""",
     """      // 81.4 - A STREAM IS JUDGED LIKE THE DECK IS. It used to be declared alive
      // outright, and then the DECK's state was pushed - so a song from the source,
      // frozen by Android, kept telling the shade and the lock screen that it was
      // playing with a playhead that never moved. The trip taken when the app left is
      // the witness now, and the state pushed is the one belonging to what sounds.
      const streamUpNow = (typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns());
      const bgDead = streamUpNow
        ? (!scStreamState.userPaused && !scStreamSurvivedBackgroundFrom(scStreamBgTrip))
        : (!userPaused && !playbackSurvivedBackground());
      if(bgDead){
        mediaSetPlaybackState('paused');
        try{ scStreamState.playing = false; scStreamBarSync(); }catch(_eBgDead){}
      }""")

once('and the state it pushes is the sounding one',
     "      if(!bgDead) mediaSetPlaybackState(a.paused ? 'paused' : 'playing');",
     """      if(!bgDead){
        const _sa = streamUpNow ? scStreamState.audio : null;
        mediaSetPlaybackState(streamUpNow ? ((_sa && !_sa.paused) ? 'playing' : 'paused')
                                          : (a.paused ? 'paused' : 'playing'));
      }""")

# -- 2. the full APK, on the full web page only ------------------------------
once('the full web app gets the APK card',
     "  function lookCard(){",
     """  // 81.4 - THE FULL APK, WHERE IT CAN BE HANDED OUT. This card exists on the FULL WEB
  // page and nowhere else: not the plain web page (which is the store build), not the
  // Play APK, not the sideloaded one - an installed copy does not need a download link
  // for itself. android-build.yml attaches SideCut-$V-full.apk to a release tagged
  // apk-..., so /releases/latest is the newest full build.
  function apkCard(){
    try{
      if(typeof SC_IS_WEB === 'undefined' || !SC_IS_WEB) return '';
      if(typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY) return '';
    }catch(_eApkCard){ return ''; }
    return '<div style="margin:14px 0;padding:14px 16px;border:1px solid var(--line);border-radius:16px;background:var(--bg-raised);">' +
      '<div style="font-size:13px;font-weight:700;margin-bottom:6px;">Full APK</div>' +
      '<div style="font-size:12px;color:var(--ink-dim);line-height:1.5;margin-bottom:10px;">You are on the full web app. The same build installs on Android as the full APK - every tool, nothing gated by a store.</div>' +
      '<a href="https://github.com/AnekTheGreat/SideCut/releases/latest" target="_blank" rel="noopener" style="display:inline-block;padding:9px 15px;border-radius:999px;background:var(--coral);color:#fff;font-size:12.5px;font-weight:700;text-decoration:none;">Download the full APK</a>' +
      '</div>';
  }
  function lookCard(){""")

once('and the pane carries it',
     "    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + playsCard() + lookCard());",
     "    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + playsCard() + apkCard() + lookCard());")

# -- 3. the changelog entry --------------------------------------------------

def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %I:%M %p') + ' EDT'


ENTRY = (
    "  // 81.4 - NO MORE PLAYING THAT IS NOT PLAYING, AND THE FULL APK IN TOOLS.\n"
    "  { version: '81.4', date: '{{STAMP}}', title: 'A stopped song stops saying it is playing', items: [\n"
    "    '[FULL] The lock screen, the shade and the widget no longer claim a song is playing when the phone has already silenced it - the playhead decides, not the button you last pressed.',\n"
    "    '[FULL] A song that stops while you are away now shows as paused instead of playing for ever, including one played online and one played from your own files.',\n"
    "    '[FULL] The full web app now has a Full APK card in Tools with a direct way to the newest Android build.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-814: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-814: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-814: %d steps applied, page is %s' % (len(applied), VERSION))
