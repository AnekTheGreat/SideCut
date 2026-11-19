"""SideCut 85.3.3 - a refused sharp size is read by the app and played from memory,
and HD+ sharpens the frame instead of washing it.

What the report said, and what the code said:

  * every song still landed on 360p even with the ladder in place, and the footer
    named the refusal: `this source is not a video the element can open`. That is a
    verdict on the ADDRESS - a cross-origin media request, a link the media stack
    will not fetch - and not on the picture behind it. The app already has a reader
    that does not go through the element at all (the native bridge the downloader and
    Streaming read with), so a refused sharp row is read once there, at the second
    the picture was on, and played from memory. Only a size whose bytes cannot be read
    either is stepped down from, and one size is read once per video;
  * `scVideoNoRange` stripped the player's `range` parameter and, when that parameter
    was the first in the query, left `?&` behind - a query that starts with `&` is not
    a query, so the element was handed a path and refused a link that was fine before
    it was edited. The pair is dropped and the rest of the query is kept;
  * HD+ laid a contrast copy over the frame through `overlay`, which lifts highlights
    and reads as a haze on a soft film. An unsharp mask is back: the frame blurred,
    that copy taken out of the frame, and the difference laid back over it.

The module lives in dev/video-8533.js and replaces the 85.3.2 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.3.3 with it.

    python3 dev/patch-8533.py            # apply
    python3 dev/patch-8533.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8533.js")

V = "85.3.3"
OLD = "85.3.2"
DATE = "November 19, 2026"
TITLE = "The sharp size is read when the player refuses it, and HD+ sharpens instead of washing"

# The notes go into index.html inside single-quoted JS strings, so no apostrophes -
# a stray one is a parse error in a 4 MB page, not a typo. The update card filters
# the word "stream" out of every note, so the wording avoids it.
NOTES = [
    "[FULL] A sharp size the player refuses is now read by the app itself and played from memory, so 1080p opens instead of falling to 360p.",
    "[FULL] HD+ is a real edge sharpen now instead of a contrast wash, so a smaller size reads sharper on a big screen.",
    "[FULL] A size link that carries a range keeps the rest of its query, so the size it names can open.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.3.2', date: 'November 19, 2026', "
    "title: 'The real size ladder, one step at a time, and the library opens on Albums', items: [\n"
)

BLOCK_START = "  // ─── 85.3.3 - A REFUSED ADDRESS IS NOT A REFUSED PICTURE"
BLOCK_OLD = "  // ─── 85.3.2 - THE LADDER IS THE LADDER"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.3.3 - A REFUSED ADDRESS IS NOT A REFUSED PICTURE"
SOUND_MARK = "window.__scVideoSoundOwn"
RESCUE_MARK = "function scVideoRescue"
RANGE_MARK = "var kept = [];"
BUFFER_MARK = "function scVideoFxBuff"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8533: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    start = BLOCK_START if BLOCK_START in page else BLOCK_OLD
    once(page, start, "the video module banner")
    i = page.index(start)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8533: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.3.2 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, RESCUE_MARK, RANGE_MARK, BUFFER_MARK,
                 "let libraryMode = 'albums';"):
        if mark not in out:
            raise SystemExit("patch-8533: the page lacks %r" % mark)
    # What earlier releases earned stays in place.
    if "function scVideoUrl" in out:
        raise SystemExit("patch-8533: the video module carries its own cipher decoder again")
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8533: the sound flag is no longer read in every guard (%d)"
                         % out.count(SOUND_MARK))
    if "globalCompositeOperation = 'overlay'" in module:
        raise SystemExit("patch-8533: the washing contrast pass is still in the module")

    sw_new = sw
    if ("sidecut-shell-v%s" % V) not in sw:
        once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
        sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V, 1)

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

    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    io.open(UPDATES, "w", encoding="utf-8").write(up_new)
    print("page at %s: a refused sharp size is read and played from memory, the range "
          "strip keeps the rest of the query, HD+ is an unsharp mask, cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
