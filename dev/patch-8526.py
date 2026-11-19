"""SideCut 85.2.6 - the picture is where the song is, and a song without one has a cover.

Four reports, and not one of them was the ladder.

The size list offered rows this phone cannot open, and offered the same row again
for the next song after it had already refused it - so "random qualities that do
not work" was true on both halves.

The clip opened at the top of the file instead of at the second the song is on, so
opening the tab two minutes into a song started the film at 0:00.

And the tab stayed on the song it was opened for: the queue moved on and the film
did not, which is the one thing that makes a music video tab useless in a queue.

This release:

  * remembers a height this phone refused, marks it in the list, and stops landing
    on it automatically - and nothing under 360p is offered at all;
  * opens every clip on the song's own second, whatever size it is playing at, and
    says which second that was;
  * follows the queue: a new song loads its own video, on that song's second;
  * shows the track cover art where there is nothing to play, with the song as the
    sound, instead of a black rectangle.

The module lives in dev/video-8526.js and replaces the 85.2.5 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.2.6 with it.
Nothing in the app half changes.

    python3 dev/patch-8526.py            # apply
    python3 dev/patch-8526.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8526.js")

V = "85.2.6"
OLD = "85.2.5"
DATE = "November 18, 2026"
TITLE = "The picture is where the song is, and a song without one has a cover"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "row", "size" and "picture" instead.
NOTES = [
    "[FULL] The size list stops offering what does not work. A height this phone has refused is remembered and marked in the list as one that did not play here, and the tab never chooses it for you again; nothing under 360p is offered unless it is all the video has.",
    "[FULL] The music video opens on the second the song is on, and says which second that was, instead of starting at the top of the clip while the song plays on two minutes in.",
    "[FULL] The tab follows the queue. When the song moves on, the picture moves with it: the new song video opens on that song own second, and its results are what NEXT walks.",
    "[FULL] A song with no music video shows its cover art, with the song playing as the sound, instead of a black rectangle with a line on it.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.5', date: 'November 18, 2026', "
    "title: 'The clip has to be this song, and half a file is not a source', items: [\n"
)

BLOCK_START = "  // ─── 85.2.5 - THE CLIP HAS TO BE THIS SONG, AND HALF A FILE IS NOT A SOURCE ─"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.6 - THE PICTURE IS WHERE THE SONG IS, AND A SONG WITHOUT ONE HAS A COVER"
WATCH_MARK = "function scVideoLive"
RETRY_MARK = "function scVideoFollow"
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8526: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.5 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8526: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.5 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, WATCH_MARK, RETRY_MARK):
        if mark not in out:
            raise SystemExit("patch-8526: the module that was inserted lacks %r" % mark)
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8526: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: refused heights are remembered and marked, the picture opens on "
          "the song second and follows the queue, and a song with no video shows its "
          "cover; cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
