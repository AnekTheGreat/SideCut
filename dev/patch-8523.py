#!/usr/bin/env python3
"""SideCut 85.2.3 - a busy signal is not a refusal.

85.2.2 made 1080p the size a viewer lands on, and the tab kept leaving it for
360p. Two things in the failure road did that, and neither was the ladder:

  * a dropped connection arrives as a media error like any other, and the road
    treated it as the size being wrong. A signal that was busy for a second
    demoted the picture, and the step after the first demotion is the 360p row;
  * the nine-second "nothing started" watch was written for the smallest row, so
    a 1080p picture still fetching its bytes was called dead and walked down.

This release:

  * restarts the same source at the same second on a network error (code 2, and
    an abort on a source that has been attached for a while), once, without
    touching the size - only the phone refusing the picture (codes 3 and 4)
    steps down;
  * scales the silent-source watch with the weight of the size and asks whether
    anything is still arriving: a picture that is loading or has buffered
    something gets more time instead of a smaller row;
  * says on the footer when a size is given up and which one it went to.

The module lives in dev/video-8523.js and replaces the 85.2.2 block in
index.html, sliced from its banner comment to the shelf comment that follows it.
The version line, the cache name, one notes entry and updates.json move to
85.2.3 with it. Nothing in the app half changes.

    python3 dev/patch-8523.py            # apply
    python3 dev/patch-8523.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8523.js")

V = "85.2.3"
OLD = "85.2.2"
DATE = "November 18, 2026"
TITLE = "A busy signal is not a refusal"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "row", "size" and "picture" instead.
NOTES = [
    "[FULL] The music video stays on the size you asked for. A dropped connection used to be treated as the size being wrong, so a signal that was busy for a second could take a 1080p picture down to 360p. The same size now starts again at the second it was on, and only a phone that actually refuses the picture steps down.",
    "[FULL] A big size is given the time it needs. The check that watched for a size that never started called it at nine seconds, which is the smallest row budget - a 1080p picture was given up while it was still fetching its bytes. The wait now grows with the size, and a picture that is still loading, or that has already buffered something, is left alone.",
    "[FULL] When a size is given up, the footer says which size it went to and why, so a smaller picture is never a mystery.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.2', date: 'November 18, 2026', "
    "title: 'Full HD by default', items: [\n"
)

BLOCK_START = "  // ─── 85.2.2 - FULL HD BY DEFAULT, AND ONE STEP DOWN ─"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.3 - A BUSY SIGNAL IS NOT A REFUSAL"
WATCH_MARK = "function scVideoWatchMs"
RETRY_MARK = "scVideoState.retries = 1"
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8523: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.2 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8523: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.2 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, WATCH_MARK, RETRY_MARK):
        if mark not in out:
            raise SystemExit("patch-8523: the module that was inserted lacks %r" % mark)
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8523: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: a dropped connection restarts the same size, the silent-source "
          "watch scales with the size, only a refused picture steps down; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
