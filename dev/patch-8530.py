"""SideCut 85.3.0 - a tap opens the bar, every size is reachable, and the picture is upscaled.

Three reports from the music video tab.

  * A tap on the picture stopped the film. It was wired to the same play/pause the
    round button uses, so looking at the controls stopped the song's video. The
    transport now steps aside while the film runs (in portrait too), a tap on the
    picture brings the mini bar back and does nothing else, and play/pause belongs
    to the two round buttons.

  * The size list was stuck on 360p. The resolver kept only rows that arrived with
    a plain `url`, and only MP4 ones - a row that came as `signatureCipher` was
    dropped silently, and on a typical answer that leaves the one muxed 360p row.
    Ciphered rows are opened the way the converter opens them, WebM rows are seated
    as well, and rows that still cannot be opened are counted in the size card
    instead of vanishing. FULL HD stays the default.

  * The picture was soft. HD+ draws each frame into a canvas at the screen's own
    pixel grid, resamples it with the quality sampler and adds an unsharp pass, so
    a 480p or 720p film is not simply stretched. It is on by default, remembered,
    and switchable from the mini bar. It is a resample and a local-contrast sharpen,
    not a neural network - no model ships with the page.

The module lives in dev/video-8530.js and replaces the 85.2.7 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.3.0 with it.
Nothing in the app half changes.

    python3 dev/patch-8530.py            # apply
    python3 dev/patch-8530.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8530.js")

V = "85.3.0"
OLD = "85.2.7"
DATE = "November 19, 2026"
TITLE = "A tap opens the bar, every size is reachable, and the picture is upscaled"

# The notes go into index.html inside single-quoted JS strings, so no apostrophes -
# a stray one is a parse error in a 4 MB page, not a typo. The update card filters
# the word "stream" out of every note, so the wording avoids it.
NOTES = [
    "[FULL] A tap on the music video no longer stops it. The tap opens the mini bar at the bottom, the film keeps playing, and the film is never paused by a tap.",
    "[FULL] The quality list now finds every size a video has, including the ones the player hands over behind a protected link. FULL HD is still the default.",
    "[FULL] The music video is upscaled and sharpened for this screen by default. HD+ in the mini bar turns it off, and the choice is kept.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.2.7', date: 'November 19, 2026', "
    "title: 'The song on the screen is the song in the picture, and a way back', items: [\n"
)

BLOCK_START = "  // ─── 85.3.0 - A TAP OPENS THE BAR"
BLOCK_OLD = "  // ─── 85.2.7 - THE SONG ON THE SCREEN IS THE SONG IN THE PICTURE"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.3.0 - A TAP OPENS THE BAR"
TAP_MARK = "function scVideoPictureTap"
BOOST_MARK = 'id="scVideoBoost"'
CIPHER_MARK = "function scVideoUrl"
SOUND_MARK = "window.__scVideoSoundOwn"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8530: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    # Sliced every time, so an edit to dev/video-8530.js reaches the page on a second
    # run, and an unchanged module is a no-op rather than a rewrite. The 85.2.7 banner
    # is the way in on an unpatched page; the 85.3.0 banner is the way in after.
    start = BLOCK_START if BLOCK_START in page else BLOCK_OLD
    once(page, start, "the video module banner")
    i = page.index(start)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8530: the shelf comment after the module is missing")
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
        once(out, NOTES_ANCHOR, "the 85.2.7 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, TAP_MARK, BOOST_MARK, CIPHER_MARK):
        if mark not in out:
            raise SystemExit("patch-8530: the page lacks %r" % mark)
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8530: the sound flag is no longer read in every guard (%d)"
                         % out.count(SOUND_MARK))

    # The cache moves once per release, so a run that only brings a later module
    # edit to an already-bumped page does not look for the previous name again.
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
    print("page at %s: a tap opens the mini bar instead of stopping the film, ciphered "
          "sizes reach the list, and the picture is upscaled and sharpened; cache at "
          "sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
