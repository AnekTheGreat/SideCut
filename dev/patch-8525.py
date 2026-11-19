"""SideCut 85.2.5 - the clip has to be this song, and half a file is not a source.

Two reports, one root each.

The tab showed someone else's clip. A song from the source carries a video id and
that clip was played without ever asking whether it was the same recording - and
NEXT was hidden, because there was only one candidate.

And it kept landing on 360p. A player row can carry its own `range` in the URL,
which is what the player asked for; handed to an element that then makes its own
range requests it is half a file, and a half file is refused exactly like a phone
that cannot decode a sharp size - so the picture fell to the one-stream row.

This release:

  * checks a catalogue clip against the song it was opened for, once, and asks the
    search by artist and title when the length is more than twenty seconds and
    more than a tenth away; the ranked results become the candidate list;
  * strips `range` from every video and audio URL before an element sees it;
  * says which build the tab is in the size list, because two tabs that look the
    same can be two pages, and a report about the wrong page cannot be answered;
  * says when a one-stream row is the sharpest size this phone will play.

The module lives in dev/video-8525.js and replaces the 85.2.4 block in
index.html, sliced from its banner comment to the shelf comment that follows it.
The version line, the cache name, one notes entry and updates.json move to
85.2.5 with it. Nothing in the app half changes.

    python3 dev/patch-8525.py            # apply
    python3 dev/patch-8525.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8525.js")

V = "85.2.5"
OLD = "85.2.4"
DATE = "November 18, 2026"
TITLE = "The clip has to be this song, and half a file is not a source"

# The notes go into index.html inside single-quoted JS strings, so no
# apostrophes: a stray one is a parse error in a 4 MB page, not a typo.
# The update card filters the word "stream" out of every note, so the wording
# below says "row", "size" and "picture" instead.
NOTES = [
    "[FULL] The music video tab checks the clip it is given. A song from the catalogue carries a video id, and that clip used to play no matter what it was - a live take, a remix, or another song entirely - with NEXT hidden because there was only one candidate. A clip whose length is far from the song is now checked against a search by artist and title before it is trusted, and the results become the list NEXT walks.",
    "[FULL] A size that would not open may not have been the phone at all: a player row can hand over a URL with its own range on it, which is half a file and something an element cannot play. That parameter is removed before the picture and its own soundtrack see the URL, so a sharp size has a real chance here.",
    "[FULL] The size list now says which build it is, so a tab that behaves like an older one can be told apart from the page that shipped, and the footer says when the picture had to settle for a smaller size.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.4', date: 'November 18, 2026', "
    "title: 'An error for a source that is gone is not a refusal', items: [\n"
)

BLOCK_START = "  // ─── 85.2.4 - AN ERROR FOR A SOURCE THAT IS GONE IS NOT A REFUSAL ─"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.2.5 - THE CLIP HAS TO BE THIS SONG, AND HALF A FILE IS NOT A SOURCE"
WATCH_MARK = "function scVideoNoRange"
RETRY_MARK = "scVideoSongLen"
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8525: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    if MODULE_MARK in page:
        return page
    once(page, BLOCK_START, "the 85.2.4 module banner")
    i = page.index(BLOCK_START)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8525: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.4 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, WATCH_MARK, RETRY_MARK):
        if mark not in out:
            raise SystemExit("patch-8525: the module that was inserted lacks %r" % mark)
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8525: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: a catalogue clip is checked against the song, media URLs lose "
          "their range, and the size list says which build it is; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
