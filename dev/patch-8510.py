#!/usr/bin/env python3
"""SideCut 85.1.0 - the music video tab actually plays, with its own buttons.

85.0.0 shipped the tab and it did not play. Three faults, all in the module:
play() was issued after the resolver round trip (a WebView refuses that without
a fresh gesture, and the rejection was swallowed), the element was hidden
behind the status text until it had data, and a refused direct URL fell
straight to the byte reader instead of trying the alternates.

This release replaces that module whole. The picture is visible as soon as it
has a source; the controls are drawn inside the stage - a round PLAY / PAUSE
button that swaps its icon with the frame, a progress line and the clock beside
it, NEXT and FULL on the same pill - and every failing step prints a line on
the screen rather than vanishing. The transport still drives the song, so the
video stays picture and can never become a second player.

The module lives in dev/video-8510.js. It is inserted in the same script block
as the shelf code, so it can reach scHttpJson, scFetchBytes, scYtSearch,
scStreamState, queue and activeAudio. The rail glyph and its click branch were
added by 85.0.0 and are untouched here.

    python3 dev/patch-8510.py            # apply
    python3 dev/patch-8510.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8510.js")

V = "85.1.0"
OLD = "85.0.0"
DATE = "November 18, 2026"
TITLE = "The music video plays, with its own play and pause"

# The notes are inserted into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
NOTES = [
    "The music video tab plays, and the play and pause buttons are drawn by SideCut itself: a round button on the picture that swaps between the two, with a progress line and the clock beside it, and NEXT and FULL at the end of the same pill. Where the phone will not start a video on its own, that button is the way in, and it starts the song and the picture together.",
    "The reason 85.0.0 sat on a black frame: the video was asked to start after the player had been asked for it, which a WebView refuses without a fresh tap, and the refusal was dropped. The picture now shows as soon as it has a source, and every step that fails says so on the screen - the lookup, the direct stream, each alternate, the reader, and the decoder code the phone reports.",
    "The video is still picture, not a second player: it plays muted on the clock of the song, the transport drives the song, and a drift of more than a second and a half seats the picture back on the song.",
    "Limits, stated plainly: a music video whose intro is longer than the song will sit out of step, because the picture follows the second the song is on and not the other way round. Nothing is downloaded and nothing is kept.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.0.0', date: 'November 18, 2026', "
    "title: 'A music video tab on the side rail', items: [\n"
)

# 85.0.0's module is replaced as one slice: from its banner comment up to the
# shelf comment that follows it. Slicing on comments, not on a line count, is
# what keeps this idempotent - the slice is gone after the first run.
BLOCK_START = "  // ─── 85.0.0 - THE MUSIC VIDEO TAB"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.1.0 - THE MUSIC VIDEO TAB, SECOND PASS"
CONTROL_MARK = 'id="scVideoPlay"'


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8510: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.0.0 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8510: the shelf comment after the module is missing")
    return page[:i] + module.rstrip("\n") + "\n" + page[j:]


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()

    out = swap_module(page, module)

    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 85.0.0 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    if CONTROL_MARK not in out:
        raise SystemExit("patch-8510: the controls are not in the module that was inserted")

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
    print("page at %s with the playing video tab and its own controls, "
          "cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
