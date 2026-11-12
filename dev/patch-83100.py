#!/usr/bin/env python3
"""SideCut 83.10.0 - manual placement in the Mix Pad.

MixPad's whole idea is that a clip is something you slide by hand and lay against
the next one. Three things move it that way:

  * free placement by default, with a SNAP row (OFF / half a second / a second)
  * a clip can be dragged up or down onto another track, so waveforms can be
    laid on top of each other deliberately
  * two clips that overlap on one track split the lane between them, so both
    waveforms stay visible where they cross

    python3 dev/patch-83100.py            # apply
    python3 dev/patch-83100.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
HERE = os.path.join(ROOT, "dev")

V = "83.10.0"
OLD = "83.9.0"

ENTRY = """      { version: '%s', date: 'November 12, 2026', title: 'Mix Pad: free placement, and clips you can lay on top of each other', items: [
    'Dragging is free by default now: a clip follows your finger instead of snapping to a grid. A SNAP row under the crossfade buttons switches to half a second or a whole second when you want things to line up exactly.',
    'A clip can be pulled up or down onto another track while you drag it, and a small badge follows your finger showing where it will land and how long it is. Lay an acapella over an instrumental by dragging it onto the track below instead of adding it again.',
    'When two clips overlap on the same track they now share the lane - one takes the top half, the other the bottom - so you can see both waveforms where they cross instead of one hiding the other.',
    'The whole drag is one gesture: move, crop from either edge, or change track, and the mix keeps playing from where it was.'
  ] },
""" % V

ANCHOR = ("""      { version: '83.9.0', date: 'November 12, 2026', title: 'Mix Pad: a window that fits, and a song that lands itself', items: [
""")

DRAG_START = "  // ---- dragging a clip on the lane: body moves it, edges crop it ----\n"
DRAG_END = "  function mpCardSub(){\n"

SNAP_ANCHOR = """          <div class="mp-clip-btns">
            <span class="mp-chip-label">CROSSFADE</span>
"""

SNAP_NEW = """          <div class="mp-clip-btns">
            <span class="mp-chip-label">SNAP</span>
            <button class="mp-mini on" data-mp-snap="off" title="Place a clip anywhere under your finger">OFF</button>
            <button class="mp-mini" data-mp-snap="0.5" title="Snap to half a second">\u00bd s</button>
            <button class="mp-mini" data-mp-snap="1" title="Snap to a whole second">1 s</button>
          </div>
          <div class="mp-clip-btns">
            <span class="mp-chip-label">CROSSFADE</span>
"""

BADGE_ANCHOR = """      <div class="modal-backdrop" id="mixPadBackdrop">
        <div class="modal mp-modal">
"""
BADGE_NEW = """      <div class="modal-backdrop" id="mixPadBackdrop">
        <div class="modal mp-modal">
          <div class="mp-badge" id="mpDragBadge"></div>
"""

HINT_OLD = ("          <div class=\"mp-hint\">Drag a clip to move it \u00b7 drag either edge to crop it \u00b7 "
            "drag the white playhead to jump \u00b7 tap to select</div>\n")
HINT_NEW = ("          <div class=\"mp-hint\">Drag a clip to move it \u00b7 either edge crops it \u00b7 "
            "up or down moves it to another track \u00b7 the white playhead jumps \u00b7 two clips that "
            "overlap share the lane</div>\n")

CSS_ANCHOR = ".mp-sliders{ gap:2px; }\n"

CSS_NEW = """/* 83.10.0 - manual placement: room for two clips in one lane, and a badge that
   follows the finger so a drag announces where it is going. */
.mp-clip.banded{ border-radius:5px; font-size:8px; padding:2px 4px; }
.mp-clip canvas.mp-wave{ opacity:.9; }
.mp-badge{ position:fixed; display:none; z-index:10001; pointer-events:none;
  background:#0c1113; color:#fff; border:1px solid var(--accent, #4de0c0);
  border-radius:8px; padding:5px 9px; font-family:'JetBrains Mono',monospace;
  font-size:10px; letter-spacing:.6px; white-space:nowrap;
  box-shadow:0 6px 18px rgba(0,0,0,.55); }
.mp-lane{ touch-action:none; }
"""

JS_ANCHOR = "  function ensureDeckGainNode(deck){\n"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-83100: %s appears %d times, expected exactly 1" % (what, n))
    return text


def part(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        raise SystemExit("patch-83100: missing dev/" + name)
    return io.open(path, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and 'id="mpDragBadge"' in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the 83.9.0 changelog entry")
    once(page, SNAP_ANCHOR, "the crossfade row")
    once(page, BADGE_ANCHOR, "the Mix Pad backdrop")
    once(page, HINT_OLD, "the hint line")
    once(page, CSS_ANCHOR, "the end of the 83.9.0 stylesheet")
    once(page, DRAG_START, "the drag section start")
    once(page, DRAG_END, "the drag section end")
    once(page, JS_ANCHOR, "ensureDeckGainNode")

    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(SNAP_ANCHOR, SNAP_NEW, 1)
    out = out.replace(BADGE_ANCHOR, BADGE_NEW, 1)
    out = out.replace(HINT_OLD, HINT_NEW, 1)
    out = out.replace(CSS_ANCHOR, CSS_ANCHOR + CSS_NEW, 1)

    a = out.index(DRAG_START)
    b = out.index(DRAG_END, a)
    out = out[:a] + part("mixpad-83100-drag.js.txt") + out[b:]

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
