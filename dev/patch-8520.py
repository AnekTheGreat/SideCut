#!/usr/bin/env python3
"""SideCut 85.2.0 - the same second at every size, and a transport that steps aside.

85.1.2 shipped a size list, and the sizes did not work. The cause was two lines:

  * `scVideoAuxSet` set `currentTime` before `load()`, and a media element with no
    duration yet ignores or refuses that - so the soundtrack of a 1080p picture
    began at 0:00;
  * `scVideoSync`, in the mode where that soundtrack carries the sound, nudged the
    PICTURE onto the soundtrack's clock - so the film jumped to 0:00 the moment a
    high size was picked, and closing the tab then put the song back at 0:00.

This release replaces the module whole again:

  * a second the element is not ready for is kept on the element and applied once
    it has a duration, for the picture and for its soundtrack both;
  * the picture is the clock in that mode, so the soundtrack is nudged onto the
    picture and a switch can never rewind what you can see;
  * a switch made while the picture is paused leaves it paused, and the swap no
    longer clears the element before loading, so there is no black frame;
  * a size that has played nothing nine seconds after it was attached walks the
    road a refusal takes - another codec, then the best one-stream size - and a
    refused size no longer forgets the size that was chosen;
  * in landscape the transport, the title row, the size chip and the scrim fade
    off the glass two seconds after the last touch, and a tap brings them back;
  * the progress line is a handle: a 26px touch area, a dot, and a drag to any
    second that moves the picture, its soundtrack and the song together.

The module lives in dev/video-8520.js and replaces the 85.1.2 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.2.0 with it.

    python3 dev/patch-8520.py            # apply
    python3 dev/patch-8520.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8520.js")

V = "85.2.0"
OLD = "85.1.3"
DATE = "November 18, 2026"
TITLE = "The same second at every size, and a transport that steps aside"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# This tab is the full build only, so the notes carry the repository's [FULL]
# marker. The update card filters the word "stream" out of every note, so the
# wording below says "size" and "soundtrack" instead.
NOTES = [
    "[FULL] Changing size keeps the second you were on. The picture and the soundtrack of a high size were both being attached at zero, and the soundtrack was asked to start there before it had a duration, which a phone ignores - so a switch could send the film, and the song after it, back to the start. Both now hold the second they were on, the soundtrack is pulled onto the picture rather than the picture onto the soundtrack, and a change made while paused stays paused.",
    "[FULL] The transport steps aside in landscape: two seconds after the last touch the play row, the progress line, the size chip and the close button fade off the glass, with the shadow under them, and a tap on the picture brings them back without stopping the film.",
    "[FULL] The progress line is a handle now: a wider touch area, a dot that follows the finger, and a drag to any second that moves the picture, its soundtrack and the song underneath together.",
    "[FULL] A size that never starts is no longer a black panel. If nothing has played nine seconds after a size is attached, the tab tries the next codec, then the best size that carries its own sound, and the footer says what happened. A size this phone cannot open also no longer forgets the size you chose.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.1.3', date: 'November 18, 2026', "
    "title: 'The size chip fits, and the wide header sits right', items: [\n"
)

BLOCK_START = "  // ─── 85.1.2 - A LADDER OF QUALITIES, AND A PICTURE THAT TURNS SIDEWAYS"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.0 - THE SAME SECOND AT EVERY SIZE"
POSE_MARK = "function scVideoPose"
IDLE_MARK = "function scVideoIdleArm"
SEEK_MARK = "function scVideoWireSeek"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8520: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.1.2 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8520: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.1.3 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, POSE_MARK, IDLE_MARK, SEEK_MARK):
        if mark not in out:
            raise SystemExit("patch-8520: the module that was inserted lacks %r" % mark)

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
    print("page at %s: a size change holds its second at every size, the landscape "
          "transport steps aside, and the progress line is a handle; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
