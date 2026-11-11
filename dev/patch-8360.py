#!/usr/bin/env python3
"""SideCut 83.6.0 - MIX PAD: a four-track studio of its own, in Studio.

DJ Mode is one song meeting another in real time. This is the other way of
making a mix, and it is a separate tool rather than another deck: a timeline
with four tracks, a song dropped onto each one, placed at the playhead and
trimmed, levelled with volume and pan (mute and solo included), then rendered
into one WAV file offline - or captured live with REC.

Nothing here shares the deck's engine. The buffer cache, the voices and the
master gain belong to the Mix Pad, so a mixdown cannot be coloured by what the
platter is doing and it keeps working with DJ Mode closed.

Markup in dev/mixpad-8360.html.txt, styles in dev/mixpad-8360.css.txt, engine
in the three dev/mixpad-8360a|b|c.js.txt parts.

    python3 dev/patch-8360.py            # apply
    python3 dev/patch-8360.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
HERE = os.path.join(ROOT, "dev")

V = "83.6.0"
OLD = "83.5.0"

PARTS = ("mixpad-8360a.js.txt", "mixpad-8360b.js.txt", "mixpad-8360c.js.txt")

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'Mix Pad: four tracks and a timeline', items: [
    'A new window in Studio for building a mix instead of performing one: four tracks, a song placed on any of them at the playhead, and a clip you can slide, shorten or lengthen until it sits where you want it.',
    'Each track has its own volume and pan, plus MUTE and SOLO, and they all work while the mix is running - not on the next press of play.',
    'EXPORT WAV renders the whole timeline to a single file in seconds, offline, with a ceiling on the master so four songs at once cannot crackle. REC captures a live take off the same master instead.',
    'It is its own engine: the Mix Pad never borrows the turntable, so a mixdown is not coloured by whatever the deck is doing, and it works with DJ Mode closed.'
  ] },
""" % V

ANCHOR = ("      { version: '%s', date: 'November 11, 2026', "
          "title: 'A second deck, for mixes you mix yourself', items: [\n" % OLD)

BTN_ANCHOR = ("    <button id=\"djModeBtn\" title=\"DJ Mode\" style=\"background:none; "
              "border:1px solid var(--line); color:var(--ink-dim); border-radius:10px; "
              "padding:2px 9px; font-size:9.5px; font-family:'JetBrains Mono',monospace; "
              "letter-spacing:1px; cursor:pointer;\">DJ MODE</button>\n")

BTN_NEW = ("    <button id=\"mixPadBtn\" title=\"Mix Pad\" style=\"background:none; "
           "border:1px solid var(--line); color:var(--ink-dim); border-radius:10px; "
           "padding:2px 9px; font-size:9.5px; font-family:'JetBrains Mono',monospace; "
           "letter-spacing:1px; cursor:pointer;\">MIX PAD</button>\n")

MODAL_ANCHOR = "<!-- What's New popup - shown once whenever the app version changes -->"

CSS_ANCHOR = "/* 83.5.0 - the mix panel: a second deck you drive by hand. */"

JS_ANCHOR = "  function ensureDeckGainNode(deck){\n"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8360: %s appears %d times, expected exactly 1" % (what, n))
    return text


def part(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        raise SystemExit("patch-8360: missing dev/" + name)
    return io.open(path, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and 'id="mixPadBackdrop"' in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the %s changelog entry" % OLD)
    once(page, BTN_ANCHOR, "the DJ MODE button")
    once(page, MODAL_ANCHOR, "the What's New comment")
    once(page, CSS_ANCHOR, "the mix panel stylesheet marker")
    once(page, JS_ANCHOR, "ensureDeckGainNode")
    js = "".join(part(n) for n in PARTS)
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(BTN_ANCHOR, BTN_ANCHOR + BTN_NEW, 1)
    out = out.replace(MODAL_ANCHOR, part("mixpad-8360.html.txt") + "\n" + MODAL_ANCHOR, 1)
    out = out.replace(CSS_ANCHOR, part("mixpad-8360.css.txt") + "\n" + CSS_ANCHOR, 1)
    out = out.replace(JS_ANCHOR, js + JS_ANCHOR, 1)
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
