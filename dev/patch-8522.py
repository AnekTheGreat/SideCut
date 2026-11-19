#!/usr/bin/env python3
"""SideCut 85.2.2 - FULL HD by default, and one step down.

85.2.1 made the sound right on every size, and then the tab still opened on
AUTO. AUTO is the best row that carries its own sound, which on most videos is
the 360p progressive row - so the sharpest picture the video had was one list
tap away and nothing said so. The other half was a cliff: a size this phone
refused fell straight to that same 360p row, so one refused 1080p cost the 720p
picture as well.

This release:

  * opens at FULL HD. A viewer who has never opened the size list gets 1080p,
    and a video without 1080p opens at the largest size under it;
  * keeps AUTO a choice, and keeps a chosen size for the next video, and does
    not confuse "never chose" with "chose AUTO";
  * steps down one size on a refusal before it gives up the size: 1080p refused
    becomes 720p, not 360p, and only a second refusal takes the one-stream row;
  * says on the size list why the picture is smaller than expected - a video
    that tops out at 720p says so where the sizes are, and the 1080p row is
    marked as the default.

The module lives in dev/video-8522.js and replaces the 85.2.1 block in
index.html, sliced from its banner comment to the shelf comment that follows it.
Nothing in the app half changes: the 85.2.1 sound flag and its four guards are
already on the page, and this release only checks that they are still there.
The version line, the cache name, one notes entry and updates.json move to
85.2.2 with it.

    python3 dev/patch-8522.py            # apply
    python3 dev/patch-8522.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8522.js")

V = "85.2.2"
OLD = "85.2.1"
DATE = "November 18, 2026"
TITLE = "Full HD by default"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "row" and "size" instead.
NOTES = [
    "[FULL] The music video opens at FULL HD now. The tab used to open on AUTO, which is the best row that carries its own sound - usually 360p - so the sharpest sizes sat in a list nobody had a reason to open. 1080p is where a viewer who has never picked a size now lands, and the size list marks that row as the default.",
    "[FULL] A video with no 1080p opens at the largest size under it, and the size list says so on the spot instead of leaving you to work out why the picture is softer than expected.",
    "[FULL] A size the phone refuses steps down one size instead of falling to the smallest - 1080p refused becomes 720p, not 360p - and the size you picked is still kept for the next video. AUTO is still in the list, and choosing it stays chosen.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.1', date: 'November 18, 2026', "
    "title: 'One sound, and the frame is the clock', items: [\n"
)

BLOCK_START = "  // ─── 85.2.1 - ONE SOUND, AND THE FRAME IS THE CLOCK ─"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.2 - FULL HD BY DEFAULT, AND ONE STEP DOWN"
DEFAULT_MARK = "var SC_VQ_DEFAULT = 1080;"
BELOW_MARK = "function scVideoRungBelow"
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8522: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.1 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8522: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.1 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, DEFAULT_MARK, BELOW_MARK):
        if mark not in out:
            raise SystemExit("patch-8522: the module that was inserted lacks %r" % mark)
    # The 85.2.1 app half must still be in place: one flag, read everywhere a
    # song can begin.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8522: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: the tab opens at FULL HD, steps down one size on a refusal, "
          "and the list says why a video is not 1080p; cache at sidecut-shell-v%s, "
          "updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
