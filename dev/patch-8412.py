"""84.1.2 - a playing song is not a battery saving to make.

The battery saver (written for an app whose audio would be the native service's job)
kills every tracked interval the moment document.hidden, and pauses on pagehide too.
SideCut's playback lives in this page - streamed and kept songs both - so the loops
that feed it died with the app's visibility and the music stopped the second you left.

A song that is playing keeps its loops now. Everything else is still paused as before,
and the moment the song stops the saver is back to normal on the next hide.

Idempotent. --check exits 0 when the page already carries the guard.
"""

import io
import json
import sys

PAGE = 'index.html'
SW = 'sw.js'
UPD = 'updates.json'
VERSION = '84.1.2'
OLD_VERSION = '84.1.1'

OLD = ("  document.addEventListener('visibilitychange', function(){\n"
       "    if(document.hidden && !wasHidden){\n"
       "      wasHidden = true;\n"
       "      pauseAll();\n"
       "    } else if(!document.hidden && wasHidden){\n"
       "      wasHidden = false;\n"
       "      resumeAll();\n"
       "    }\n"
       "  });\n"
       "  // Also pause on pagehide (app backgrounded on Android)\n"
       "  window.addEventListener('pagehide', function(){ pauseAll(); });\n")

NEW = ("  // 84.1.2 - A PLAYING SONG KEEPS ITS LOOPS.\n"
       "  // This saver was written when the audio was expected to be the native service's job\n"
       "  // by the time the app went hidden. It is not: streamed and kept songs both play in\n"
       "  // this page, so stopping every tracked interval on hide starved playback and the\n"
       "  // music ended the second the app was left. While a song is actually playing nothing\n"
       "  // is paused; the instant it stops, the saver behaves exactly as it did before.\n"
       "  function __scAudioLive(){\n"
       "    try{\n"
       "      if(window.scStreamState && scStreamState.audio && !scStreamState.audio.paused && !scStreamState.audio.ended) return true;\n"
       "    }catch(_eA1){}\n"
       "    try{\n"
       "      var as = document.querySelectorAll('audio,video');\n"
       "      for(var i = 0; i < as.length; i++){\n"
       "        var a = as[i];\n"
       "        if(a && !a.paused && !a.ended) return true;\n"
       "      }\n"
       "    }catch(_eA2){}\n"
       "    return false;\n"
       "  }\n"
       "  function __scPauseIdle(){ if(!__scAudioLive()) pauseAll(); }\n"
       "  document.addEventListener('visibilitychange', function(){\n"
       "    if(document.hidden && !wasHidden){\n"
       "      wasHidden = true;\n"
       "      __scPauseIdle();\n"
       "    } else if(!document.hidden && wasHidden){\n"
       "      wasHidden = false;\n"
       "      resumeAll();\n"
       "    }\n"
       "  });\n"
       "  // Also pause on pagehide (app backgrounded on Android), unless a song is playing.\n"
       "  window.addEventListener('pagehide', function(){ __scPauseIdle(); });\n")

NOTES = ("Music no longer stops when you leave the app. SideCut's battery saver was stopping "
         "every background timer the moment the app went hidden, and the playback engine lives "
         "in the page - so the loops that feed a song were killed and the music ended as soon "
         "as you switched away. A song that is playing now keeps the loops it needs; when it "
         "stops, the saver goes back to exactly what it did before.")


def main(argv):
    check = '--check' in argv
    src = io.open(PAGE, encoding='utf-8').read()
    sw = io.open(SW, encoding='utf-8').read()
    upd = json.load(io.open(UPD, encoding='utf-8'))

    have = '__scPauseIdle' in src
    if not have and check:
        sys.exit('patch-8412: the guard is not in the page yet')
    if not have:
        if src.count(OLD) != 1:
            sys.exit('patch-8412: the battery saver block is not in the page exactly once')
        src = src.replace(OLD, NEW, 1)

    if ("const APP_VERSION = '%s';" % OLD_VERSION) in src:
        src = src.replace("const APP_VERSION = '%s';" % OLD_VERSION,
                          "const APP_VERSION = '%s';" % VERSION, 1)
    io.open(PAGE, 'w', encoding='utf-8').write(src)

    sw = sw.replace('sidecut-shell-v%s' % OLD_VERSION, 'sidecut-shell-v%s' % VERSION)
    io.open(SW, 'w', encoding='utf-8').write(sw)

    upd['version'] = VERSION
    upd['date'] = 'November 13, 2026'
    upd['notes'] = [NOTES]
    io.open(UPD, 'w', encoding='utf-8').write(json.dumps(upd, ensure_ascii=False) + '\n')

    out = io.open(PAGE, encoding='utf-8').read()
    if '__scPauseIdle' not in out or out.count('pauseAll();') < 1:
        sys.exit('patch-8412: result is not what was intended')
    print('patch-8412: a playing song keeps its loops now, page is %s' % VERSION)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
