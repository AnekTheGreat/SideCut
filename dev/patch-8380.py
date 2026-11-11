#!/usr/bin/env python3
"""SideCut 83.8.0 - waveforms in the clips, and a playhead you can pull.

The crop sheet has always shown the song; the Mix Pad made you place clips
blind. This gives every clip its own waveform, puts the same white grab bars the
crop sheet has on the selected clip, and gives the playhead a round knob you can
drag anywhere on the timeline - with playback resuming where it left off.

    python3 dev/patch-8380.py            # apply
    python3 dev/patch-8380.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
HERE = os.path.join(ROOT, "dev")

V = "83.8.0"
OLD = "83.7.0"

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'Mix Pad: waveforms and a playhead you drag', items: [
    'Every clip now draws its own waveform, cut from the part of the song that clip actually plays - so you can see the beat you are lining up instead of guessing where it is.',
    'The selected clip wears the same white grab bars the crop sheet uses: drag one to crop, drag the body to move. The clip outlines itself so you can see exactly what you have hold of.',
    'The playhead has a round knob at the top of the first track. Pull it anywhere on the timeline to jump, and if the mix was playing it picks up from where you dropped it.',
    'Waveforms are read once per song and kept, so placing the same track on four lanes costs nothing after the first time.'
  ] },
""" % V

ANCHOR = ("""      { version: '%s', date: 'November 11, 2026', title: 'Mix Pad: drag, crop, crossfade, reverse', items: [
""" % OLD)

HINT_OLD = "          <div class=\"mp-hint\">Drag a clip to move it \u00b7 drag either edge to crop it \u00b7 tap to select</div>\n"
HINT_NEW = ("          <div class=\"mp-hint\">Drag a clip to move it \u00b7 drag either edge to crop it \u00b7 "
            "drag the white playhead to jump \u00b7 tap to select</div>\n")

CSS_AFTER = ".mp-slide i{ font-style:normal; font-size:9px; text-align:right; }\n"

CSS_NEW = """/* 83.8.0 - the clip shows the song and the playhead is something you pull. */
.mp-clip canvas.mp-wave{ position:absolute; left:0; top:0; width:100%; height:100%;
  pointer-events:none; opacity:.85; }
.mp-clip{ text-shadow:0 1px 2px rgba(0,0,0,.65); }
.mp-grab{ position:absolute; top:2px; bottom:2px; width:8px; border-radius:3px;
  background:#fff; opacity:.92; pointer-events:none; box-shadow:0 1px 3px rgba(0,0,0,.45); }
.mp-grab.left{ left:1px; }
.mp-grab.right{ right:1px; }
.mp-head{ width:14px; margin-left:-7px; cursor:ew-resize; touch-action:none; }
.mp-knob{ position:absolute; top:-9px; left:50%; margin-left:-6px; width:12px; height:12px;
  border-radius:50%; background:#fff; border:1px solid rgba(0,0,0,.45);
  box-shadow:0 1px 3px rgba(0,0,0,.5); touch-action:none; }
"""

PAINT_OLD = ("  // ---- what the timeline shows: handles, fades, and the tool settings ----\n"
             "  function mpPaint(){\n")
PAINT_NEW = ("  // ---- what the timeline shows: handles, fades, and the tool settings ----\n"
             "  function mpPaintTracks(){\n")

JS_ANCHOR = "  function ensureDeckGainNode(deck){\n"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8380: %s appears %d times, expected exactly 1" % (what, n))
    return text


def part(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        raise SystemExit("patch-8380: missing dev/" + name)
    return io.open(path, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and "canvas.mp-wave" in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the 83.7.0 changelog entry")
    once(page, HINT_OLD, "the clip hint line")
    once(page, CSS_AFTER, "the end of the 83.7.0 stylesheet")
    once(page, PAINT_OLD, "the 83.7.0 mpPaint")
    once(page, JS_ANCHOR, "ensureDeckGainNode")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(HINT_OLD, HINT_NEW, 1)
    out = out.replace(CSS_AFTER, CSS_AFTER + CSS_NEW, 1)
    out = out.replace(PAINT_OLD, PAINT_NEW, 1)
    out = out.replace(JS_ANCHOR, part("mixpad-8380.js.txt") + JS_ANCHOR, 1)
    return out


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    out = patched(page)
    sw_new = sw.replace("sidecut-shell-v%s" % OLD, "sidecut-shell-v%s" % V)
    if out == page and sw_new == sw:
        print("already on the page")
        return 0
    if check:
        print("not applied yet")
        return 1
    once(sw, "sidecut-shell-v%s" % OLD, "the cache name")
    io.open(PAGE, "w", encoding="utf-8").write(out)
    io.open(SW, "w", encoding="utf-8").write(sw_new)
    print("page at %s, cache at sidecut-shell-v%s" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
