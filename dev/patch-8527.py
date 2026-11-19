"""SideCut 85.2.7 - the song on the screen is the song in the picture, and a way back.

Two reports. The first is not about sizes and not about the ladder: the tab could
show one song's film while a different song played, and then stay there.

A video is found in two round trips - the lookup, then the player - and the queue
can move in between. An answer that came back for the song the queue had already
left loaded anyway, and because the tab had recorded the new song as the one it was
on, the tick saw nothing to follow. The wrong film stayed up for the whole song.

This release:

  * numbers every start (`startSeq`) and checks, when a lookup or a player answer
    comes back, that the number is still current AND that its song is still the one
    being played - anything else is dropped, and the tick's follow loads the film
    for the song that is actually on;
  * bumps that number on close, so a lookup or a player answer that lands after the
    tab is gone cannot attach a source (and hold the song) on a closed tab;
  * puts a back arrow at the left of the tab's header - on the glass in landscape
    too - that leaves the tab the way the close cross does, with the song taking
    over at the second the picture was on.

The module lives in dev/video-8527.js and replaces the 85.2.6 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.2.7 with it.
Nothing in the app half changes.

    python3 dev/patch-8527.py            # apply
    python3 dev/patch-8527.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8527.js")

V = "85.2.7"
OLD = "85.2.6"
DATE = "November 19, 2026"
TITLE = "The song on the screen is the song in the picture, and a way back"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "lookup" and "film" instead.
NOTES = [
    "[FULL] The music video is always the song you are on. A lookup that answers after the song has changed is dropped, so a slow answer cannot put a different song on the screen.",
    "[FULL] The music video has a back button. The arrow at the left of its header returns to the app, with the song carrying on from the second the picture was on.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.6', date: 'November 18, 2026', "
    "title: 'The picture is where the song is, and a song without one has a cover', items: [\n"
)

BLOCK_START = "  // ─── 85.2.6 - THE PICTURE IS WHERE THE SONG IS"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.7 - THE SONG ON THE SCREEN IS THE SONG IN THE PICTURE"
WATCH_MARK = "function scVideoStillOn"
RETRY_MARK = "function scVideoFollow"
BACK_MARK = 'id="scVideoBack"'
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8527: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.6 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8527: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.6 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, WATCH_MARK, RETRY_MARK, BACK_MARK):
        if mark not in out:
            raise SystemExit("patch-8527: the page lacks %r" % mark)
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8527: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: a film for a song the queue has left is dropped, closing stops "
          "what was still looking, and the tab has a back arrow; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
