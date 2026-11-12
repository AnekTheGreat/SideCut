#!/usr/bin/env python3
"""SideCut 83.9.0 - the Mix Pad window unfurls, and a song lands by itself.

83.8.0 shipped a window that looked broken on a phone, and it was: three
different rules shared the class `.mp-head` - the title row, the 2px playhead
line and the 14px knob hit area - so the title row inherited
`position:absolute; width:14px` and the whole panel collapsed on top of itself.
The playhead is now `.mp-lane-head`, which nothing else uses.

Two other things go with it: the window is capped at 88vh and scrolls, so the
tracks are reachable on a phone; and a song no longer needs two gestures -
opening the window with an empty timeline drops the working song onto track 1,
and choosing a song adds it to the chosen track at the playhead.

    python3 dev/patch-8390.py            # apply
    python3 dev/patch-8390.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
HERE = os.path.join(ROOT, "dev")

V = "83.9.0"
OLD = "83.8.0"

ENTRY = """      { version: '%s', date: 'November 12, 2026', title: 'Mix Pad: a window that fits, and a song that lands itself', items: [
    'The Mix Pad window was drawing its title row as the playhead line - one class doing three jobs - so on a phone the panel collapsed and the labels sat on top of each other. The playhead has its own class now and the window lays out properly, capped at the height of the screen and scrolling inside it.',
    'Opening the Mix Pad with nothing on the timeline now puts the song you were working on straight onto track 1, so the window is never empty.',
    'Choosing a song from the picker adds it to the chosen track at the playhead by itself - one tap instead of picking it and then pressing ADD. The button is still there for adding the same song again.',
    'The crossfade label takes its own line instead of sitting on top of the crop buttons, and the fade sliders got their own column so FADE IN and FADE OUT cannot overlap.'
  ] },
""" % V

ANCHOR = ("""      { version: '83.8.0', date: 'November 11, 2026', title: 'Mix Pad: waveforms and a playhead you drag', items: [
""")

HEAD_OLD = """.mp-head{
  position:absolute; top:0; bottom:0; width:2px; background:#fff;
  pointer-events:none; opacity:0.85;
}
"""

HEAD_NEW = """.mp-lane-head{
  position:absolute; top:0; bottom:0; width:2px; background:#fff;
  pointer-events:none; opacity:0.85;
}
"""

HEAD83_OLD = ".mp-head{ width:14px; margin-left:-7px; cursor:ew-resize; touch-action:none; }\n"
HEAD83_NEW = ".mp-lane-head{ width:14px; margin-left:-7px; cursor:ew-resize; touch-action:none; }\n"

JS_CREATE_OLD = """      let head = lane.querySelector('.mp-head');
      if(!head){
        head = document.createElement('div');
        head.className = 'mp-head';
        lane.appendChild(head);
      }
"""
JS_CREATE_NEW = """      let head = lane.querySelector('.mp-lane-head');
      if(!head){
        head = document.createElement('div');
        head.className = 'mp-lane-head';
        lane.appendChild(head);
      }
"""

JS_PAINT_OLD = "        const head = lane.querySelector('.mp-head');\n"
JS_PAINT_NEW = "        const head = lane.querySelector('.mp-lane-head');\n"

JS_KNOB_OLD = "e.target.closest('.mp-head, .mp-knob')"
JS_KNOB_NEW = "e.target.closest('.mp-lane-head, .mp-knob')"

CSS_AFTER = """  box-shadow:0 1px 3px rgba(0,0,0,.5); touch-action:none; }
"""

CSS_NEW = """/* 83.9.0 - the playhead is not the title row any more, and the panel fits a
   phone: capped height, its own scroll, and no label allowed to sit on a button. */
.modal.mp-modal{ max-height:88vh; overflow-y:auto; -webkit-overflow-scrolling:touch; }
.mp-modal .mp-head > div:last-child{ min-width:0; }
.mp-chip-label{ display:block; flex:1 1 100%; margin:0 0 5px; white-space:nowrap; }
.mp-clip-btns{ align-items:center; }
.mp-add select{ flex:1 1 150px; min-width:0; }
.mp-add .deck-btn{ flex:0 0 auto; white-space:nowrap; }
.mp-slide{ grid-template-columns:74px minmax(0,1fr) 46px; }
.mp-slide span{ white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.mp-slide input[type=range]{ min-width:0; }
.mp-sliders{ gap:2px; }
"""

JS_ANCHOR = "  function ensureDeckGainNode(deck){\n"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8390: %s appears %d times, expected exactly 1" % (what, n))
    return text


def part(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        raise SystemExit("patch-8390: missing dev/" + name)
    return io.open(path, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and "mp-lane-head" in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the 83.8.0 changelog entry")
    once(page, HEAD_OLD, "the 83.6.0 playhead rule")
    once(page, HEAD83_OLD, "the 83.8.0 playhead rule")
    once(page, JS_CREATE_OLD, "the playhead element creation")
    once(page, JS_PAINT_OLD, "the 83.8.0 knob lookup")
    once(page, JS_KNOB_OLD, "the scrub lookup")
    once(page, CSS_AFTER, "the end of the 83.8.0 stylesheet")
    once(page, JS_ANCHOR, "ensureDeckGainNode")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(HEAD_OLD, HEAD_NEW, 1)
    out = out.replace(HEAD83_OLD, HEAD83_NEW, 1)
    out = out.replace(JS_CREATE_OLD, JS_CREATE_NEW, 1)
    out = out.replace(JS_PAINT_OLD, JS_PAINT_NEW, 1)
    out = out.replace(JS_KNOB_OLD, JS_KNOB_NEW, 1)
    out = out.replace(CSS_AFTER, CSS_AFTER + CSS_NEW, 1)
    out = out.replace(JS_ANCHOR, part("mixpad-8390.js.txt") + JS_ANCHOR, 1)
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
