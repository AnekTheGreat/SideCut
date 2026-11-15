"""84.1.3 - a song holds the app awake, the way a player does.

Nothing in the page paused the audio: scStreamRemember only saves the position, and 84.1.2
stopped the battery saver from killing the loops while a song plays. The music still died on
leaving because the sound is played by the WebView, and Android freezes a cached process -
which is what the app becomes the moment another app comes forward. A frozen process cannot
feed an audio element, so the song stopped.

SideCut already carries the machinery for this: the SideCutJob plugin (hold/update/release)
starts SideCutJobService, a foreground service with a wake lock, which is exactly what makes
the difference between a cached app that can be frozen and a player that cannot. The page now
holds it while a song is actually playing and lets it go when the song stops - and never lets
go of a hold it did not take while the app is in the background, so an OS pause cannot tear
down a hold that something else may be relying on.

Idempotent. --check exits 0 when the page already carries the hold.
"""

import io
import json
import sys

PAGE, SW, UPD = 'index.html', 'sw.js', 'updates.json'
VERSION, OLD_VERSION = '84.1.3', '84.1.2'
TITLE = 'The music keeps playing when you leave'

ANCHOR = "  window.addEventListener('pagehide', function(){ __scPauseIdle(); });\n"

HOLD = '''
  // 84.1.3 - A SONG HOLDS THE APP AWAKE. The player is this page, so the page has to keep the
  // process out of Android's freezer: SideCutJob.hold() starts the foreground service that says
  // "this app is doing something", and the audio survives another app coming forward. Released
  // when the song stops, and only from the foreground - a hold taken while something else may be
  // using the service is not ours to drop.
  (function(){
    var held = false;
    function job(){
      try{ var C = window.Capacitor; return (C && C.Plugins) ? C.Plugins.SideCutJob : null; }catch(_eJ){ return null; }
    }
    function playing(){
      try{
        if(window.scStreamState && scStreamState.audio && !scStreamState.audio.paused && !scStreamState.audio.ended) return true;
      }catch(_eP1){}
      try{
        var as = document.querySelectorAll('audio,video');
        for(var i = 0; i < as.length; i++){ if(as[i] && !as[i].paused && !as[i].ended) return true; }
      }catch(_eP2){}
      return false;
    }
    function name(){
      try{
        var a = document.querySelector('#npTitle') || document.querySelector('.np-title') || document.querySelector('#barTitle');
        var t = a && (a.textContent || '').trim();
        if(t) return t;
      }catch(_eN){}
      return 'SideCut';
    }
    function hold(){
      var P = job();
      if(!P || typeof P.hold !== 'function' || held) return;
      held = true;
      try{
        var r = P.hold({ title: name(), sub: 'Playing' });
        if(r && typeof r.catch === 'function') r.catch(function(){ held = false; });
      }catch(_eH){ held = false; }
    }
    function release(){
      var P = job();
      if(!P || typeof P.release !== 'function' || !held) return;
      held = false;
      try{
        var r = P.release();
        if(r && typeof r.catch === 'function') r.catch(function(){});
      }catch(_eR){}
    }
    document.addEventListener('play', function(){ hold(); }, true);
    function letGo(){
      setTimeout(function(){ if(!playing()){ if(document.hidden) return; release(); } }, 600);
    }
    document.addEventListener('pause', letGo, true);
    document.addEventListener('ended', letGo, true);
    // A song already running when this code arrives (an over-the-air update caught mid-play).
    if(playing()) hold();
  })();
'''

NOTES = ("The music keeps playing when you leave the app. SideCut plays in the page, and Android "
         "freezes a backgrounded app that is not in the foreground - so the sound stopped the second "
         "another app came forward. While a song is playing the app now holds a foreground service, "
         "which is exactly what a player does to stay a player, and lets it go when the song stops.")


def main(argv):
    check = '--check' in argv
    src = io.open(PAGE, encoding='utf-8').read()
    have = 'SideCutJob.hold' in src or "Plugins.SideCutJob" in src
    if check:
        if not have or ("const APP_VERSION = '%s';" % VERSION) not in src:
            sys.exit('patch-8413: the hold is not in the page yet')
        return 0

    if not have:
        if src.count(ANCHOR) != 1:
            sys.exit('patch-8413: the battery saver anchor is not in the page exactly once')
        src = src.replace(ANCHOR, ANCHOR + HOLD, 1)

    if ("const APP_VERSION = '%s';" % OLD_VERSION) in src:
        src = src.replace("const APP_VERSION = '%s';" % OLD_VERSION,
                          "const APP_VERSION = '%s';" % VERSION, 1)
    io.open(PAGE, 'w', encoding='utf-8').write(src)

    sw = io.open(SW, encoding='utf-8').read()
    io.open(SW, 'w', encoding='utf-8').write(
        sw.replace('sidecut-shell-v%s' % OLD_VERSION, 'sidecut-shell-v%s' % VERSION))

    upd = json.load(io.open(UPD, encoding='utf-8'))
    upd['version'] = VERSION
    upd['date'] = 'November 14, 2026'
    upd['notes'] = [NOTES]
    io.open(UPD, 'w', encoding='utf-8').write(json.dumps(upd, ensure_ascii=False) + '\n')

    out = io.open(PAGE, encoding='utf-8').read()
    if 'SideCutJob' not in out:
        sys.exit('patch-8413: result is not what was intended')
    print('patch-8413: a playing song holds the app awake, page is %s' % VERSION)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
