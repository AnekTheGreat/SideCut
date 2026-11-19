"""SideCut 85.3.1 - the sizes come from the resolver that works, and one pass to sharpen.

85.3.0 answered the 360p lock by guessing: it gave the video tab a second cipher
decoder and a WebM-only path. The app already has a resolver that is measured -
`scYtPlayer`, the call the converter, the downloader and Streaming all use.

This release:

  * makes `scYtPlayer` hand back the picture rows of the same answer (`videos`) and
    the audio row that pairs them (`snd`), which changes nothing for its existing
    callers;
  * makes the video tab fall back to it when its own two-client call does not produce
    FULL HD, and seat those rows in the same ladder;
  * removes 85.3.0's private cipher decoder, its WebM-only path and its
    "rows without a link" counter, which the fallback makes unnecessary;
  * replaces the four-draw unsharp mask (and its two offscreen canvases) with one
    clarity pass, so a frame costs two draws and no buffers.

The module lives in dev/video-8531.js and replaces the 85.3.0 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The version
line, the cache name, one notes entry and updates.json move to 85.3.1 with it.

    python3 dev/patch-8531.py            # apply
    python3 dev/patch-8531.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8531.js")

V = "85.3.1"
OLD = "85.3.0"
DATE = "November 19, 2026"
TITLE = "Music video sizes come from the working resolver, and one pass to sharpen"

# The notes go into index.html inside single-quoted JS strings, so no apostrophes -
# a stray one is a parse error in a 4 MB page, not a typo. The update card filters
# the word "stream" out of every note, so the wording avoids it.
NOTES = [
    "[FULL] Music video sizes now come from the player the app already uses, so 1080p and sharper reach the quality list instead of stopping at 360p.",
    "[FULL] The music video upscaler does the same job in fewer passes, so a sharper picture costs less battery.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.3.0', date: 'November 19, 2026', "
    "title: 'A tap opens the bar, every size is reachable, and the picture is upscaled', items: [\n"
)

BLOCK_START = "  // ─── 85.3.1 - THE SIZES COME FROM THE RESOLVER"
BLOCK_OLD = "  // ─── 85.3.0 - A TAP OPENS THE BAR"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.3.1 - THE SIZES COME FROM THE RESOLVER"
TAP_MARK = "function scVideoPictureTap"
BOOST_MARK = 'id="scVideoBoost"'
RESOLVER_MARK = "function scVideoAppRows"
SOUND_MARK = "window.__scVideoSoundOwn"

# The app half: the resolver hands its picture rows back. Anchors are single lines.
APP_VAR = "    var audioStreams = [], muxedStreams = [], seenUrls = {}, metaTitle = '', metaAuthor = '';"
APP_TAKE = "      take(d.streamingData.formats, true, muxedStreams, 4);"
APP_RETURN = "      alts: streams.slice(1), videoTitle: metaTitle, author: metaAuthor\n    };"
APP_MARK = "videos: videoRows"

APP_TAKE_VIDEO = """
    // THE PICTURE ROWS OF THE SAME ANSWER. Nothing in the converter reads these; the
    // music video tab does. Its own call keeps only rows that carry a plain address,
    // and a client that answers with just the muxed row leaves that tab with one size,
    // so the sizes come from here - the resolver whose clients and cipher handling are
    // the measured ones.
    var videoRows = [], videoSeen = {};
    function takeVideo(list){
      (list || []).forEach(function(f){
        if(!f || !f.mimeType) return;
        if(String(f.mimeType).toLowerCase().indexOf('video/') !== 0) return;
        var u = deco(f);
        if(!u || videoSeen[u]) return;
        videoSeen[u] = true;
        videoRows.push({ url: u, mimeType: String(f.mimeType), itag: Number(f.itag) || 0,
                         contentLength: Number(f.contentLength || f.clen) || 0,
                         height: Number(f.height) || 0 });
      });
    }"""

APP_RETURN_NEW = """      alts: streams.slice(1), videoTitle: metaTitle, author: metaAuthor,
      videos: videoRows,
      snd: (audioStreams[0] ? { url: audioStreams[0].url, mime: audioStreams[0].mime, size: audioStreams[0].size } : null)
    };"""


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8531: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    start = BLOCK_START if BLOCK_START in page else BLOCK_OLD
    once(page, start, "the video module banner")
    i = page.index(start)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8531: the shelf comment after the module is missing")
    return page[:i] + module.rstrip("\n") + "\n" + page[j:]


def swap_app(page):
    if APP_MARK in page:
        return page
    once(page, APP_VAR, "the resolver's stream pools")
    once(page, APP_TAKE, "the resolver's row intake")
    once(page, APP_RETURN, "the resolver's answer")
    page = page.replace(APP_VAR, APP_VAR + APP_TAKE_VIDEO, 1)
    page = page.replace(APP_TAKE, APP_TAKE + "\n      takeVideo(d.streamingData.adaptiveFormats);", 1)
    page = page.replace(APP_RETURN, APP_RETURN_NEW, 1)
    return page


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()

    out = swap_module(page, module)
    out = swap_app(out)

    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 85.3.0 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, TAP_MARK, BOOST_MARK, RESOLVER_MARK, APP_MARK, "function takeVideo(list)"):
        if mark not in out:
            raise SystemExit("patch-8531: the page lacks %r" % mark)
    # The 85.3.0 guess is gone: one cipher decoder in the page, not two.
    if "function scVideoUrl" in out:
        raise SystemExit("patch-8531: the video module still carries its own cipher decoder")
    # The 85.2.1 app half must still be in place.
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8531: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: the music video asks the app resolver for its sizes, the upscaler "
          "is one pass, cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
