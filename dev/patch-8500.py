#!/usr/bin/env python3
"""SideCut 85.0.0 - a music video tab on the side rail (full builds only).

The side panel is #scShelfRail, the fixed glyph column on the right of the
library. This release gives it a fourth glyph: it opens a full-screen viewer for
the music video of the song that is playing - a song from the source (which
already carries its video id) or a file on the device (which is searched for by
artist and title). The picture is muted and follows the song's clock, so the
sound is still the one this app is already playing, and the viewer is laid out
for portrait and landscape with no measurement in pixels.

The rail's glyph is only built when this is not the Play build: the store build
has no source and no video path.

The module itself lives in dev/video-8500.js and is inserted into index.html
above the shelf page code, in the same script block, so it can reach
scHttpJson, scFetchBytes, scYtSearch, scStreamState, queue and activeAudio.

    python3 dev/patch-8500.py            # apply
    python3 dev/patch-8500.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8500.js")

V = "85.0.0"
OLD = "84.1.3"
DATE = "November 18, 2026"
TITLE = "A music video tab on the side rail"

# The notes are inserted into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
NOTES = [
    "The side rail has a fourth glyph, under the three library pages, and it plays the music video of the song that is playing. It is on the full build only: the store build has no source and no video path, so it does not draw a tab that opens onto nothing.",
    "It works for a song from the source and for a file on the device. A source song already knows which video it is; a file is searched for by artist and title, and NEXT walks the rest of the results when the first match is the wrong upload.",
    "The video is picture, not a second player: it plays muted on the clock of the song, follows play and pause, and re-seats itself if it drifts. Portrait and landscape both work - the viewer is the whole screen and the picture is contained inside it - and FULL asks the phone for real fullscreen and landscape.",
    "Limits, stated plainly: a music video whose intro is longer than the song will sit out of step, because the picture follows the second the song is on and not the other way round. Nothing is downloaded and nothing is kept.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '84.1.3', date: 'November 16, 2026', "
    "title: 'The version, the cache and the notes move to 84.1.3', items: [\n"
)

ICON_ANCHOR = (
    "      device: 'M11 3h2v8.6l3.3-3.3 1.4 1.4L12 15.4 6.3 9.7l1.4-1.4L11 11.6V3zM5 19h14v2H5z'\n"
)
ICON_VIDEO = (
    "      // 85.0.0 - the video glyph: a camera body with its lens wedge, so the\n"
    "      // fourth tab is a moving picture and not the play triangle it borrows.\n"
    "      video: 'M4 6h10.5a1 1 0 0 1 1 1v2.6l4.5-2.8v10.4l-4.5-2.8V17a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z'\n"
)
ICON_MARK = "video: 'M4 6h10.5a1 1 0 0 1 1 1v2.6"

RAIL_ANCHOR = (
    "      if(SC_STREAM_OK){\n"
    "        h += '<div class=\"scshelf-sep\"></div>';\n"
)
RAIL_VIDEO = (
    "      // 85.0.0 - THE VIDEO TAB IS A GLYPH, NOT A PAGE. It sits under the three\n"
    "      // library pages and above the source switch, it never changes the source,\n"
    "      // and it is built only where a video can actually play: the Play build has\n"
    "      // no source and no video path, so it gets no fourth glyph at all.\n"
    "      if(typeof SC_IS_PLAY === 'undefined' || !SC_IS_PLAY){\n"
    "        h += '<div class=\"scshelf-sep\"></div>';\n"
    "        h += '<button type=\"button\" class=\"scshelf-tab\" data-video=\"1\"' +\n"
    "          ' aria-pressed=\"false\" aria-label=\"Music video\" title=\"Music video\">' +\n"
    "          scIcon('video', 17) + '</button>';\n"
    "      }\n"
)
RAIL_MARK = 'data-video="1"'

CLICK_ANCHOR = (
    "          if(this.getAttribute('data-src') === '1'){ "
    "scShelfSetSrc(scShelf.src === 's' ? 'd' : 's'); return; }\n"
)
CLICK_VIDEO = (
    "          // 85.0.0 - the video glyph opens the viewer for the song that is on;\n"
    "          // it is not a shelf page, so it does not touch scShelf.page or the source.\n"
    "          if(this.getAttribute('data-video') === '1'){ scVideoOpen(); return; }\n"
)
CLICK_MARK = "getAttribute('data-video') === '1'"

MODULE_ANCHOR = (
    "  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first of the three pages the rail switches\n"
)
MODULE_MARK = "function scVideoOpen(){"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8500: %s appears %d times, expected exactly 1" % (what, n))


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()

    out = page
    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 84.1.3 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    if ICON_MARK not in out:
        once(out, ICON_ANCHOR, "the icon map's device glyph")
        # the map's last row has no trailing comma; the video row joins it
        out = out.replace(ICON_ANCHOR, ICON_ANCHOR.rstrip("\n") + ",\n" + ICON_VIDEO, 1)
    if RAIL_MARK not in out:
        once(out, RAIL_ANCHOR, "the source switch in scShelfRender")
        out = out.replace(RAIL_ANCHOR, RAIL_VIDEO + RAIL_ANCHOR, 1)
    if CLICK_MARK not in out:
        once(out, CLICK_ANCHOR, "the rail's click wiring")
        out = out.replace(CLICK_ANCHOR, CLICK_VIDEO + CLICK_ANCHOR, 1)
    if MODULE_MARK not in out:
        once(out, MODULE_ANCHOR, "the shelf page comment")
        out = out.replace(MODULE_ANCHOR, module + "\n" + MODULE_ANCHOR, 1)

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
    print("page at %s with the video tab, cache at sidecut-shell-v%s, updates.json rewritten"
          % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
