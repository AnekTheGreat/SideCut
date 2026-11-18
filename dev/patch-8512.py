#!/usr/bin/env python3
"""SideCut 85.1.2 - a quality ladder, and a picture that turns sideways.

85.1.1 could only ever show what the player handed over first: the progressive
360p row. The adaptive rows in the same answer - up to 2160p - were fallbacks,
never a choice, so a music video stayed soft on a phone that could show it sharp.

This release replaces the module whole again:

  * every video-only row is grouped by its real height and the codec the WebView
    can open wins its height; a muxed row of the same height beats both;
  * the size chip in the header opens a list of the sizes the video actually
    has (360p, 480p, 720p, 1080p, 2K, 4K), and the choice is remembered;
  * above the one-stream sizes the same video's own audio row plays in a second
    element, so the picture gets bigger and the sound stays the video's;
  * switching size keeps the second the picture was on, and a refused size falls
    back to the best one-stream size with a line that says so;
  * FULL is a landscape button: full-bleed stage, fullscreen, landscape lock, and
    the app's own transport, quality list and close button stay on the glass.

The module lives in dev/video-8512.js and replaces dev/video-8511.js's block in
index.html, sliced from its banner comment to the shelf comment that follows it.

    python3 dev/patch-8512.py            # apply
    python3 dev/patch-8512.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8512.js")

V = "85.1.2"
OLD = "85.1.1"
DATE = "November 18, 2026"
TITLE = "A quality list, and a picture that turns sideways"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# This tab is the full build only, so the notes carry the repository's [FULL]
# marker: the Play build drops them rather than announcing a tab it does not
# have. The update card also filters the word "stream" out of every note, so the
# wording below says "top sizes" and "arrive separately" instead.
NOTES = [
    "[FULL] The video has a quality list now: the size chip in the header opens every size this video offers, from 360p to 4K, and the size you pick is remembered for the next video. At the top sizes the picture and the same video soundtrack arrive separately and are played together, so a bigger picture still sounds like the video and not the song.",
    "[FULL] The FULL button is a landscape button: it turns the player full-bleed, asks the phone for landscape, and keeps the app own play, pause, quality and close controls on the glass instead of handing the screen to the browser.",
    "[FULL] Changing size keeps the second you were on, and a size the phone refuses falls back to the best size that carries its own sound and says so instead of going black.",
    "[FULL] Limits, stated plainly: a high size can be large, so the player uses it directly and nothing above 64 MB is read into memory. Nothing is downloaded and nothing is kept.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.1.1', date: 'November 18, 2026', "
    "title: 'The video plays its own sound, and its play button is its own', items: [\n"
)

BLOCK_START = "  // ─── 85.1.1 - THE MUSIC VIDEO, ITS OWN SOUND AND ITS OWN BUTTON"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.1.2 - A LADDER OF QUALITIES"
LADDER_MARK = "function scVideoLadder"
LAND_MARK = "function scVideoLandscape"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8512: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.1.1 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8512: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.1.1 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    if MODULE_MARK not in out or LADDER_MARK not in out or LAND_MARK not in out:
        raise SystemExit("patch-8512: the module that was inserted is not the 85.1.2 one")

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
    print("page at %s: the video has a quality ladder, its high sizes carry the "
          "video own soundtrack, and the picture turns sideways; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
