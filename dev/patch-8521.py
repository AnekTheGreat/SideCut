#!/usr/bin/env python3
"""SideCut 85.2.1 - one sound, and the frame is the clock.

85.2.0 made every size keep its second, but two things about the sound were
still wrong:

  * a high size plays the picture and the video's own soundtrack in two
    elements, and the soundtrack was allowed to start the moment it was ready -
    usually before the first frame. It kept that head start, because 85.2.0 only
    pulled it back when it was more than half a second out;
  * the song under the film could be started again by the app's own background
    recovery - the thirty-second heartbeat revives a paused stream, and a return
    from the background revives a paused deck song - so the film and the song
    were both sounding, a few seconds apart.

This release:

  * owns the sound. Exactly one of the picture, its paired soundtrack and the
    song is audible, and the tab publishes a flag (`window.__scVideoSoundOwn`)
    that the app's recovery paths and both elements consult, so nothing starts
    under the film;
  * starts the soundtrack only when the picture is playing, on the picture's
    second, and holds it to a tenth of a second by trimming its rate - a jump
    only on a real gap (a seek, a size change, a stalled picture);
  * takes the voice with the picture: a pause, a buffer or the end of the film
    silences it, and a seek moves both.

The module lives in dev/video-8521.js and replaces the 85.2.0 block in
index.html, sliced from its banner comment to the shelf comment that follows it.
Four small guards in the app (the deck's play listener, the stream element's
play listener, the heartbeat revive, recoverAudio) make the flag real. The
version line, the cache name, one notes entry and updates.json move to 85.2.1
with it.

    python3 dev/patch-8521.py            # apply
    python3 dev/patch-8521.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8521.js")

V = "85.2.1"
OLD = "85.2.0"
DATE = "November 18, 2026"
TITLE = "One sound, and the frame is the clock"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "size" and "soundtrack" instead.
NOTES = [
    "[FULL] The picture and its sound are locked together. A high size is the picture plus the video own soundtrack in a second element, and that element could start before the first frame and keep the head start - it was only pulled back when it was more than half a second out. It now waits for the picture to be playing, starts on the picture second, and is held to about a tenth of a second by trimming its rate instead of jumping it back.",
    "[FULL] One sound at a time. A song paused by the video tab could be started again by the recovery the app runs in the background - every thirty seconds, and on the way back from the background - so the song played underneath the film. The tab now marks itself as the owner of the sound, and anything the app tries to start under it is stopped again.",
    "[FULL] A picture that pauses or stops to buffer takes its soundtrack with it, so the sound cannot run on over a still frame, and a seek moves both together.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.0', date: 'November 18, 2026', "
    "title: 'The same second at every size, and a transport that steps aside', items: [\n"
)

BLOCK_START = "  // ─── 85.2.0 - THE SAME SECOND AT EVERY SIZE, AND A TRANSPORT THAT STEPS ASIDE ─"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.1 - ONE SOUND, AND THE FRAME IS THE CLOCK"
POSE_MARK = "function scVideoOwnSound"
AUX_MARK = "function scVideoAuxAlign"
SOUND_MARK = "window.__scVideoSoundOwn"

# ── the app half ------------------------------------------------------------
# The flag is only words unless the code that can start a song reads it. Four
# places: the two elements' play listeners (the catch-all), the heartbeat's
# revive of a paused stream, and recoverAudio's revive of a paused deck song.
GUARDS = [
    (
        "the deck play guard",
        "  [audio, audio2].forEach(function(el){\n"
        "    if(!el) return;\n"
        "    el.addEventListener('play', function(){\n"
        "      try{ if(typeof scStreamDeckGuard === 'function' && scStreamDeckGuard()) el.pause(); }catch(_eSg){}\n"
        "    });\n"
        "  });\n",
        "  [audio, audio2].forEach(function(el){\n"
        "    if(!el) return;\n"
        "    el.addEventListener('play', function(){\n"
        "      // 85.2.1 - THE VIDEO TAB OWNS THE SOUND. A song started under it - by a\n"
        "      // crossfade, a recovery, or the tab opening - is stopped again, the same\n"
        "      // way a deck is stopped under a stream.\n"
        "      try{ if(window.__scVideoSoundOwn){ el.pause(); return; } }catch(_eVidOwn){}\n"
        "      try{ if(typeof scStreamDeckGuard === 'function' && scStreamDeckGuard()) el.pause(); }catch(_eSg){}\n"
        "    });\n"
        "  });\n",
    ),
    (
        "the stream play guard",
        "    a.addEventListener('play', function(){\n"
        "      scStreamState.playing = true;\n"
        "      scStreamQuietDeck(); scStreamBarSync(); scStreamPhoneState();\n",
        "    a.addEventListener('play', function(){\n"
        "      // 85.2.1 - NOT UNDER A FILM. The music video tab carries its own sound, and\n"
        "      // this element is only held for the song it hands back when the tab closes.\n"
        "      if(window.__scVideoSoundOwn){ try{ a.pause(); }catch(_eVidP){} return; }\n"
        "      scStreamState.playing = true;\n"
        "      scStreamQuietDeck(); scStreamBarSync(); scStreamPhoneState();\n",
    ),
    (
        "the heartbeat revive",
        "        if(sa && sa.paused && !scStreamState.userPaused && !audioFocusInterrupted && !scInCall()){\n",
        "        // 85.2.1 - unless the music video tab is playing: this thirty-second revive\n"
        "        // is what used to start the song again over a film that was already sounding.\n"
        "        if(sa && sa.paused && !window.__scVideoSoundOwn && !scStreamState.userPaused && !audioFocusInterrupted && !scInCall()){\n",
    ),
    (
        "the recoverAudio guard",
        "  function recoverAudio(a, reason){\n"
        "    if(a !== activeAudio() || queueIndex < 0 || queueIndex >= queue.length) return;\n",
        "  function recoverAudio(a, reason){\n"
        "    if(a !== activeAudio() || queueIndex < 0 || queueIndex >= queue.length) return;\n"
        "    // 85.2.1 - the film is the sound right now, so there is nothing to recover.\n"
        "    if(window.__scVideoSoundOwn) return;\n",
    ),
]


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8521: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.0 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8521: the shelf comment after the module is missing")
    return page[:i] + module.rstrip("\n") + "\n" + page[j:]


def add_guards(page):
    for what, old, new in GUARDS:
        if SOUND_MARK in old and new in page:
            continue
        # A guard that is already in place is recognised by its own text.
        if new in page:
            continue
        once(page, old, what)
        page = page.replace(old, new, 1)
    return page


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()

    out = add_guards(swap_module(page, module))

    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 85.2.0 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, POSE_MARK, AUX_MARK):
        if mark not in out:
            raise SystemExit("patch-8521: the module that was inserted lacks %r" % mark)
    # One flag, and every path that can start a song reads it.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8521: the sound flag is not read in every guard (%d)"
                         % out.count(SOUND_MARK))

    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)

    up_new = up
    if json.loads(up).get("version") != V:
        data = json.loads(up)
        data["version"] = V
        data["notes"] = NOTES
        data["date"] = DATE
        up_new = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
        if up.endswith("\n"):
            up_new += "\n"

    if out == page and sw_new == sw and up_new == up:
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1

    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    io.open(UPDATES, "w", encoding="utf-8").write(up_new)
    print("page at %s: the video tab owns the sound and its soundtrack is held to "
          "the picture; cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
