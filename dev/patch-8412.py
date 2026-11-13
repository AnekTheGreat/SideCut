"""84.1.2 - a playing song keeps its loops when the app goes hidden.

The battery saver kills every tracked interval on document.hidden and on pagehide. This
app's playback lives in the page (streamed and kept songs both), so the loops that feed
a song died with visibility and the music stopped the second the app was left. A song
that is playing keeps its loops; when it stops, the saver is unchanged.

Also adds this release's changelog entry, which dev/release-record.py reads.
Idempotent. --check exits 0 when everything this release says is already in place.
"""

import io
import json
import re
import sys

PAGE, SW, UPD = 'index.html', 'sw.js', 'updates.json'
VERSION, OLD_VERSION = '84.1.2', '84.1.1'
TITLE = 'The music does not stop when you leave the app'

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

NEW = ("  // 84.1.2 - A PLAYING SONG KEEPS ITS LOOPS. This saver assumed the audio would be the\n"
       "  // native service's job by the time the app went hidden. It is not: playback lives in\n"
       "  // this page, so stopping every tracked interval on hide starved the song and the music\n"
       "  // ended when the app was left. Nothing is paused while a song is actually playing.\n"
       "  function __scAudioLive(){\n"
       "    try{\n"
       "      if(window.scStreamState && scStreamState.audio && !scStreamState.audio.paused && !scStreamState.audio.ended) return true;\n"
       "    }catch(_eA1){}\n"
       "    try{\n"
       "      var as = document.querySelectorAll('audio,video');\n"
       "      for(var i = 0; i < as.length; i++){ if(as[i] && !as[i].paused && !as[i].ended) return true; }\n"
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
         "every background timer the moment the app went hidden, and playback lives in the page - "
         "so the loops feeding a song were killed and the music ended as soon as you switched away. "
         "A song that is playing now keeps the loops it needs; when it stops, the saver is exactly "
         "what it was.")

ENTRY = ("      { version: '%s', date: 'November 13, 2026', title: '%s', items: [\n"
         "        'The music keeps playing when you leave the app. The battery saver was stopping every background timer as soon as the page went hidden, and the player lives in the page, so a song lost the loops that feed it and the music ended the moment you switched away or locked the phone. A playing song now keeps them, and the saver behaves exactly as before the moment nothing is playing.'\n"
         "      ] },\n") % (VERSION, TITLE)


def main(argv):
    check = '--check' in argv
    src = io.open(PAGE, encoding='utf-8').read()

    have_guard = '__scPauseIdle' in src
    have_entry = ("version: '%s'" % VERSION) in src
    on_version = ("const APP_VERSION = '%s';" % VERSION) in src

    if check:
        if not (have_guard and have_entry and on_version):
            sys.exit('patch-8412: the page is not on %s yet' % VERSION)
        return 0

    if not have_guard:
        if src.count(OLD) != 1:
            sys.exit('patch-8412: the battery saver block is not in the page exactly once')
        src = src.replace(OLD, NEW, 1)

    if not have_entry:
        m = re.search(r"\n      \{ version: '[0-9.]+', date: '[^']*', title: '[^']*'", src)
        if not m:
            sys.exit('patch-8412: no changelog entry to put this release above')
        src = src[:m.start() + 1] + ENTRY + src[m.start() + 1:]

    if ("const APP_VERSION = '%s';" % OLD_VERSION) in src:
        src = src.replace("const APP_VERSION = '%s';" % OLD_VERSION,
                          "const APP_VERSION = '%s';" % VERSION, 1)
    io.open(PAGE, 'w', encoding='utf-8').write(src)

    sw = io.open(SW, encoding='utf-8').read()
    io.open(SW, 'w', encoding='utf-8').write(
        sw.replace('sidecut-shell-v%s' % OLD_VERSION, 'sidecut-shell-v%s' % VERSION))

    upd = json.load(io.open(UPD, encoding='utf-8'))
    upd['version'] = VERSION
    upd['date'] = 'November 13, 2026'
    upd['notes'] = [NOTES]
    io.open(UPD, 'w', encoding='utf-8').write(json.dumps(upd, ensure_ascii=False) + '\n')

    out = io.open(PAGE, encoding='utf-8').read()
    if '__scPauseIdle' not in out or ("version: '%s'" % VERSION) not in out:
        sys.exit('patch-8412: result is not what was intended')
    print('patch-8412: playing music keeps its loops, page is %s' % VERSION)
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
