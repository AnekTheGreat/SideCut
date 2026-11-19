"""SideCut 85.3.2 - the size ladder is the ladder, the resolver is always asked, and
the library opens on Albums.

Three reports about the music video tab, each with a cause in the code:

  * the size list offered whatever height a row reported and hid everything under
    360p, so 144p and 240p could not be picked and an odd encode put a number on the
    list that is not a size - every height is read as the nearest of 144p, 240p,
    360p, 480p, 720p, 1080p, 1440p, 2K and 4K, and every one the video has is listed;
  * one refused height was remembered for the whole SESSION, so the first video that
    could not open 1080p taught the tab to stop asking and every song after it opened
    on 360p - the memory belongs to the video now;
  * a refusal stepped down once and then jumped to the smallest row with its own
    sound, so the 480p picture was never offered - each refusal steps to the rung
    directly under the one that failed.

And the resolver: 85.3.1 asked `scYtPlayer` only when the tab's own call came back
under 1080p, so a 1080p row from a client this phone then refused never consulted it.
It is asked for every video and its rows win their own height.

A tap on the picture brings the mini bar back and does nothing else - it no longer
starts a stopped film either.

The library opens on Albums instead of Playlists; the Albums tab, the Playlists tab
and the split Library pill are unchanged.

The module lives in dev/video-8532.js and replaces the 85.3.1 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.3.2 with it.

    python3 dev/patch-8532.py            # apply
    python3 dev/patch-8532.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8532.js")

V = "85.3.2"
OLD = "85.3.1"
DATE = "November 19, 2026"
TITLE = "The real size ladder, one step at a time, and the library opens on Albums"

# The notes go into index.html inside single-quoted JS strings, so no apostrophes -
# a stray one is a parse error in a 4 MB page, not a typo. The update card filters
# the word "stream" out of every note, so the wording avoids it.
NOTES = [
    "[FULL] Music video quality lists the real sizes - 144p, 240p, 360p, 480p, 720p, 1080p, 1440p, 2K and 4K - and 1080p actually plays instead of falling to 360p.",
    "[FULL] A size the phone refuses is no longer remembered against every song, and a refusal steps down one size at a time instead of jumping to the smallest.",
    "Library opens on Albums, with Playlists one tap away.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.3.1', date: 'November 19, 2026', "
    "title: 'Music video sizes come from the working resolver, and one pass to sharpen', items: [\n"
)

BLOCK_START = "  // ─── 85.3.2 - THE LADDER IS THE LADDER"
BLOCK_OLD = "  // ─── 85.3.1 - THE SIZES COME FROM THE RESOLVER"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.3.2 - THE LADDER IS THE LADDER"
TAP_MARK = "function scVideoPictureTap"
STEPS_MARK = "var SC_VQ_STEPS = [144, 240, 360, 480, 720, 1080, 1440, 2048, 2160]"
RESOLVER_MARK = "function scVideoAppRows"
SOUND_MARK = "window.__scVideoSoundOwn"
APP_MARK = "videos: videoRows"

# The library opens on Albums. The Boot view setting is the one the settings pass
# reads, and the mode on the library is what the tabs and the split pill paint.
LIB_MODE_OLD = "  let libraryMode = 'playlists'; // 'playlists' | 'albums'"
LIB_MODE_NEW = ("  // 85.3.2 - THE LIBRARY OPENS ON ALBUMS. Playlists is one tap away, on the\n"
                "  // Playlists tab and on the other half of the Library pill.\n"
                "  let libraryMode = 'albums'; // 'playlists' | 'albums'")
BOOT_VIEW_OLD = "  let sandboxDefaultView = 'playlists';"
BOOT_VIEW_NEW = "  let sandboxDefaultView = 'albums';"
BOOT_APPLY_OLD = "      libraryMode = sandboxDefaultView === 'albums' ? 'albums' : 'playlists';"
BOOT_APPLY_NEW = "      libraryMode = sandboxDefaultView === 'playlists' ? 'playlists' : 'albums';"
RESET_OLD = """    sandboxDefaultView = 'playlists';
    dbPut('meta', { key: 'sandboxDefaultView', value: 'playlists' });"""
RESET_NEW = """    sandboxDefaultView = 'albums';
    dbPut('meta', { key: 'sandboxDefaultView', value: 'albums' });"""


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8532: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    start = BLOCK_START if BLOCK_START in page else BLOCK_OLD
    once(page, start, "the video module banner")
    i = page.index(start)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8532: the shelf comment after the module is missing")
    return page[:i] + module.rstrip("\n") + "\n" + page[j:]


def open_on_albums(page):
    if LIB_MODE_NEW in page:
        return page
    once(page, LIB_MODE_OLD, "the library mode")
    once(page, BOOT_VIEW_OLD, "the boot view setting")
    once(page, BOOT_APPLY_OLD, "the boot view decision")
    once(page, RESET_OLD, "the boot view reset")
    page = page.replace(LIB_MODE_OLD, LIB_MODE_NEW, 1)
    page = page.replace(BOOT_VIEW_OLD, BOOT_VIEW_NEW, 1)
    page = page.replace(BOOT_APPLY_OLD, BOOT_APPLY_NEW, 1)
    page = page.replace(RESET_OLD, RESET_NEW, 1)
    return page


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()

    out = swap_module(page, module)
    out = open_on_albums(out)

    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 85.3.1 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, TAP_MARK, STEPS_MARK, RESOLVER_MARK, APP_MARK,
                 "let libraryMode = 'albums';", "let sandboxDefaultView = 'albums';"):
        if mark not in out:
            raise SystemExit("patch-8532: the page lacks %r" % mark)
    # The 85.3.0 guess stays gone and the 85.2.1 app half stays in place.
    if "function scVideoUrl" in out:
        raise SystemExit("patch-8532: the video module carries its own cipher decoder again")
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8532: the sound flag is no longer read in every guard (%d)"
                         % out.count(SOUND_MARK))

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
    print("page at %s: the size ladder is standard and complete, the resolver is asked "
          "for every video, a refusal steps down one rung, the library opens on Albums, "
          "cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
