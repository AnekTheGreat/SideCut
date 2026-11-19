#!/usr/bin/env python3
"""SideCut 85.2.4 - an error for a source that is gone is not a refusal.

Clicking 1080p still slid back to 360p. Every `error` event was read as the size
being refused, and a size change aborts the load that was running: that abort can
arrive as an `error` after the new source is attached and the element has already
cleared `media.error`, so the handler ran with no `MediaError` at all and walked
the ladder - 1080p to 720p to 360p - on the click that asked for 1080p.

This release:

  * only acts on an error that carries a real `MediaError` on the element, and
    only when it belongs to the source this tab attached; an event for a source
    that has already been replaced is dropped;
  * keeps the silent-source watch able to act without one, because it looks at
    the element itself;
  * names the size and codec that refused the picture on the footer, so a real
    refusal says which row this phone could not open.

The module lives in dev/video-8524.js and replaces the 85.2.3 block in
index.html, sliced from its banner comment to the shelf comment that follows it.
The version line, the cache name, one notes entry and updates.json move to
85.2.4 with it. Nothing in the app half changes.

    python3 dev/patch-8524.py            # apply
    python3 dev/patch-8524.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8524.js")

V = "85.2.4"
OLD = "85.2.3"
DATE = "November 18, 2026"
TITLE = "An error for a source that is gone is not a refusal"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "row", "size" and "picture" instead.
NOTES = [
    "[FULL] Clicking 1080p no longer slides back to 360p. A size change cancels the load that was running, and that cancellation can arrive as an error after the new size has already started - the tab read it as the new size being refused and walked one size down, twice, so a tap on 1080p ended on the 360p row. An error now counts only when the phone reports a real media error on the size that is actually playing.",
    "[FULL] When a size really is refused, the footer names the size and the codec the phone could not open, so a smaller picture is never a mystery.",
    "[FULL] A picture that is still fetching is not a picture that failed: a size that is loading, or that has buffered anything, keeps its time and its size instead of losing them.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.3', date: 'November 18, 2026', "
    "title: 'A busy signal is not a refusal', items: [\n"
)

BLOCK_START = "  // ─── 85.2.3 - A BUSY SIGNAL IS NOT A REFUSAL ─"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.4 - AN ERROR FOR A SOURCE THAT IS GONE IS NOT A REFUSAL"
WATCH_MARK = "scVideoState.srcNow"
RETRY_MARK = "dead !== true"
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8524: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.3 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8524: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.3 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, WATCH_MARK, RETRY_MARK):
        if mark not in out:
            raise SystemExit("patch-8524: the module that was inserted lacks %r" % mark)
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8524: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: an error only counts when the element reports one on the size "
          "that is playing, and a refused size names its codec; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
