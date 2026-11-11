#!/usr/bin/env python3
"""SideCut 83.5.0 - a second deck you mix with by hand.

DJ Mode has carried a second audio lane since the crossfade work, but only the
automatic "crossfade to next" ever drove it: there was no way to put a song on
it, start it yourself, or hold two songs in the air at once. A mix you perform
needs exactly that.

This adds a mix panel to DJ Mode - deck B with its own load / play / cue / pitch
/ gain, a tempo reading taken off the audio itself (onset envelope + beat
spacing, not a number someone typed), BEAT SYNC that matches B's tempo to A and
lands B's beat on A's next one, a hand crossfader with an equal-power curve, a
waveform of both songs with their beat grid and playheads, a jog drag, and a
hand-over button that makes B the deck the knobs and pads control.

Markup in dev/mix-8350.html.txt, styles in dev/mix-8350.css.txt, engine in the
four dev/mix-8350a|b|c|d.js.txt parts (inserted where deckEngineB lives, so it
shares that scope).

    python3 dev/patch-8350.py            # apply
    python3 dev/patch-8350.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
HERE = os.path.join(ROOT, "dev")

V = "83.5.0"
OLD = "83.4.0"

PARTS = ("mix-8350a.js.txt", "mix-8350b.js.txt", "mix-8350c.js.txt",
         "mix-8350d.js.txt")

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'A second deck, for mixes you mix yourself', items: [
    'DJ Mode now has deck B with its own load, play, cue, pitch and gain, and a hand crossfader that blends the two songs with an equal-power curve. The automatic next-song fade is still there; this one is yours to perform with.',
    'BEAT SYNC reads the tempo off the audio itself and lands deck B beat on deck A beat, so a hand mix stays in time instead of drifting apart.',
    'Both songs are drawn above the controls as waveforms with their beat grid and both playheads, and dragging on the drawing nudges deck B forwards or backwards.',
    'HAND OVER TO B makes deck B the turntable the knobs, pads and hot cues control, so a set can be mixed straight through without leaving the screen.'
  ] },
""" % V

ANCHOR = ("      { version: '%s', date: 'November 11, 2026', "
          "title: 'The app answers the headphones itself', items: [\n" % OLD)

HTML_ANCHOR = """      <div class="crossfader-wrap">
        <label>CROSSFADE TO NEXT</label>
        <div class="crossfader-track" id="crossfaderTrack">
          <div class="crossfader-thumb" id="crossfaderThumb"></div>
        </div>
        <div class="crossfader-hint">Drag right past the glow to crossfade into the next song in this playlist</div>
      </div>
"""

CSS_ANCHOR = "/* 81.5 - DJ sets, in Studio. */"

JS_ANCHOR = "  function ensureDeckGainNode(deck){\n"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8350: %s appears %d times, expected exactly 1" % (what, n))
    return text


def part(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        raise SystemExit("patch-8350: missing dev/" + name)
    return io.open(path, encoding="utf-8").read()


def engine():
    return "".join(part(n) for n in PARTS)


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and "id=\"mixPanel\"" in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the %s changelog entry" % OLD)
    once(page, HTML_ANCHOR, "the crossfader block")
    once(page, CSS_ANCHOR, "the DJ-sets stylesheet marker")
    once(page, JS_ANCHOR, "ensureDeckGainNode")
    js = engine()
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(HTML_ANCHOR, HTML_ANCHOR + part("mix-8350.html.txt"), 1)
    out = out.replace(CSS_ANCHOR, part("mix-8350.css.txt") + "\n" + CSS_ANCHOR, 1)
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
