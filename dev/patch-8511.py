#!/usr/bin/env python3
"""SideCut 85.1.1 - the video plays its own sound, with a matched video.

85.1.0 played a picture and left the song as the sound, so the frame was only as
right as the match between the two, and even a correct match played the wrong
thing: a music video is its own recording.

This release replaces the module whole again:

  * a muxed stream is UNMUTED and the song is paused underneath it, so what you
    hear belongs to what you see; closing the tab puts the song back at the
    second the video stopped on;
  * a stream with no audio track keeps the song as the soundtrack, stays muted,
    and says so on the footer;
  * candidates from a search are re-ranked against the song's own length, with a
    different take (live, cover, remix, sped up) demoted and a length more than
    about a tenth away dropped;
  * the play button that waits over a stopped video is drawn for this tab - a
    frosted disc, a warm gradient triangle and a ripple - instead of the glyph
    the rest of the app uses.

The module lives in dev/video-8511.js and replaces dev/video-8510.js's block in
index.html, sliced from its banner comment to the shelf comment that follows it.

    python3 dev/patch-8511.py            # apply
    python3 dev/patch-8511.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8511.js")

V = "85.1.1"
OLD = "85.1.0"
DATE = "November 18, 2026"
TITLE = "The video plays its own sound, and its play button is its own"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
NOTES = [
    "The video plays its own sound now. A stream that carries an audio track is unmuted and the song is paused underneath it, so what you hear is the recording you see, and closing the tab puts the song back at the second the video stopped on. A stream with no audio track keeps the song as its soundtrack and says so.",
    "The video is matched to the song instead of just found: results are re-ranked against the length of the song, and a take more than about a tenth away - or one that calls itself live, a cover, a remix or sped up - is pushed down the list. A song from the source keeps its own video id.",
    "The play button that waits over a stopped video is drawn for this tab: a frosted disc, a warm gradient triangle with soft corners and a slow ripple. The round button in the transport uses the same drawn triangle, so the tab reads as one control set.",
    "Limits, stated plainly: a music video whose intro is longer than the song will still start a few seconds behind the words, because the picture follows the second the song is on and not the other way round. Nothing is downloaded and nothing is kept.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.1.0', date: 'November 18, 2026', "
    "title: 'The music video plays, with its own play and pause', items: [\n"
)

BLOCK_START = "  // ─── 85.1.0 - THE MUSIC VIDEO TAB, SECOND PASS"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.1.1 - THE MUSIC VIDEO, ITS OWN SOUND"
AUDIO_MARK = "scVideoState.audioMode === 'video'"
BUTTON_MARK = "scVripple"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8511: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.1.0 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8511: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.1.0 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    if AUDIO_MARK not in out or BUTTON_MARK not in out:
        raise SystemExit("patch-8511: the module that was inserted is not the 85.1.1 one")

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
    print("page at %s: the video carries its own sound, its video is matched by "
          "length, and its play button is drawn for it; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
