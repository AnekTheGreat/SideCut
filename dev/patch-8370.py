#!/usr/bin/env python3
"""SideCut 83.7.0 - the Mix Pad becomes an editor, and Studio gets a door to it.

83.6.0 shipped a four-track timeline whose clips could only be nudged with
buttons, and whose only way in was a small header button. This turns it into
something you edit by hand:

  * a MIX PAD card inside Studio, where the rest of the tools are
  * drag a clip to move it, drag either edge to crop it
  * crossfade 1, 2, 4 or 8 seconds between a clip and the one before it
  * reverse a clip, set its own level, set fade in and fade out
  * playback and the WAV mixdown both honour all of it

    python3 dev/patch-8370.py            # apply
    python3 dev/patch-8370.py --check    # verify only, writes nothing
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
HERE = os.path.join(ROOT, "dev")

V = "83.7.0"
OLD = "83.6.0"

ENTRY = """      { version: '%s', date: 'November 11, 2026', title: 'Mix Pad: drag, crop, crossfade, reverse', items: [
    'A Mix Pad card now sits in Studio with the other tools, so it is one tap from the Studio screen instead of hidden in the header.',
    'Clips are dragged by hand: pull the body to move it, pull either edge to crop the start or the end, and the timeline shows the fades as shading so you can see the shape of the mix.',
    'CROSSFADE 1s, 2s, 4s or 8s overlaps the selected clip with the one before it on the same track and fades one out as the other comes in. REVERSE flips a clip, FADE IN and FADE OUT set each side by hand, and every clip has its own level.',
    'Playback and the exported WAV both follow all of it, so what you hear is what the file contains.'
  ] },
""" % V

ANCHOR = ("""      { version: '83.6.0', date: 'November 11, 2026', title: 'Mix Pad: four tracks and a timeline', items: [
""")

CARD_ANCHOR = "        toolCard('djmode', '\\ud83d\\udcbf', 'DJ Mode', djCardSub(), djCardState()) +\n"
CARD_NEW = ("        toolCard('mixpad', '\\u25a6', 'Mix Pad', "
            "(typeof mpCardSub === 'function' ? mpCardSub() : 'Four tracks, drag, crop, crossfade, reverse.'), 'accent') +\n")

TOOLS_OLD = """          <div class="mp-clip-btns">
            <button class="mp-mini" id="mixPadClipLeft" title="Move this clip one second earlier">\u25c0 1s</button>
            <button class="mp-mini" id="mixPadClipRight" title="Move this clip one second later">1s \u25b6</button>
            <button class="mp-mini" id="mixPadClipShort" title="Make this clip one second shorter">SHORTER</button>
            <button class="mp-mini" id="mixPadClipLong" title="Make this clip one second longer">LONGER</button>
            <button class="mp-mini" id="mixPadClipDel" title="Remove this clip">DELETE</button>
          </div>
"""

TOOLS_NEW = """          <div class="mp-hint">Drag a clip to move it \u00b7 drag either edge to crop it \u00b7 tap to select</div>
          <div class="mp-clip-btns">
            <button class="mp-mini" id="mixPadClipLeft" title="Move this clip one second earlier">\u25c0 1s</button>
            <button class="mp-mini" id="mixPadClipRight" title="Move this clip one second later">1s \u25b6</button>
            <button class="mp-mini" id="mixPadClipShort" title="Make this clip one second shorter">SHORTER</button>
            <button class="mp-mini" id="mixPadClipLong" title="Make this clip one second longer">LONGER</button>
            <button class="mp-mini" id="mixPadClipDel" title="Remove this clip">DELETE</button>
          </div>
          <div class="mp-clip-btns">
            <button class="mp-mini" id="mixPadCropIn" title="Crop one second off the start of this clip">CROP START</button>
            <button class="mp-mini" id="mixPadCropOut" title="Crop one second off the end of this clip">CROP END</button>
            <button class="mp-mini" id="mixPadRev" title="Play this clip backwards">REVERSE</button>
          </div>
          <div class="mp-clip-btns">
            <span class="mp-chip-label">CROSSFADE</span>
            <button class="mp-mini" id="mixPadXf1" title="Overlap this clip with the one before it by one second">1s</button>
            <button class="mp-mini" id="mixPadXf2" title="Overlap this clip with the one before it by two seconds">2s</button>
            <button class="mp-mini" id="mixPadXf4" title="Overlap this clip with the one before it by four seconds">4s</button>
            <button class="mp-mini" id="mixPadXf8" title="Overlap this clip with the one before it by eight seconds">8s</button>
          </div>
          <div class="mp-sliders">
            <label class="mp-slide"><span>FADE IN</span><input type="range" id="mixPadFadeIn" min="0" max="80" step="1" value="0"><i>0.0s</i></label>
            <label class="mp-slide"><span>FADE OUT</span><input type="range" id="mixPadFadeOut" min="0" max="80" step="1" value="0"><i>0.0s</i></label>
            <label class="mp-slide"><span>CLIP LEVEL</span><input type="range" id="mixPadClipGain" min="-24" max="12" step="1" value="0"><i>0 dB</i></label>
          </div>
"""

CSS_ANCHOR = "/* 83.5.0 - the mix panel: a second deck you drive by hand. */"

CSS_NEW = """/* 83.7.0 - the clip as something you can pick up: edges to crop with, fades
   drawn on the clip itself, and the small sliders under the tools. */
.mp-clip{ position:relative; overflow:hidden; touch-action:none;
  box-shadow: inset 2px 0 rgba(255,255,255,.28), inset -2px 0 rgba(255,255,255,.28); }
.mp-clip::before, .mp-clip::after{ content:''; position:absolute; top:0; bottom:0; pointer-events:none; }
.mp-clip::before{ left:0; width:var(--fi,0%); background:linear-gradient(90deg, rgba(0,0,0,.6), rgba(0,0,0,0)); }
.mp-clip::after{ right:0; width:var(--fo,0%); background:linear-gradient(270deg, rgba(0,0,0,.6), rgba(0,0,0,0)); }
.mp-clip.sel{ outline:1.5px solid var(--accent); outline-offset:-1px; }
.mp-clip.rev{ border-style:dashed; }
.mp-hint{ font-size:10px; color:var(--ink-dim); margin:4px 0 2px; line-height:1.45; }
.mp-chip-label{ font-size:9px; letter-spacing:1px; color:var(--ink-dim); align-self:center; margin-right:2px; }
.mp-mini.on{ border-color:var(--accent); color:var(--accent); }
.mp-sliders{ display:flex; flex-direction:column; gap:4px; margin-top:6px; }
.mp-slide{ display:grid; grid-template-columns:78px 1fr 44px; align-items:center; gap:6px; font-size:9px; letter-spacing:.5px; color:var(--ink-dim); }
.mp-slide input[type=range]{ width:100%; accent-color:var(--accent); }
.mp-slide i{ font-style:normal; font-size:9px; text-align:right; }
"""

PAINT_OLD = "  function mpPaint(){\n"
PAINT_NEW = "  function mpPaintBase(){\n"

PLAY_OLD = """        const src = ctx.createBufferSource();
        src.buffer = plan.clip.buffer;
        const g = ctx.createGain();
        g.gain.value = mpTrackGainValue(tr);
        src.connect(g);
"""

PLAY_NEW = """        const src = ctx.createBufferSource();
        src.buffer = mpClipBuffer(plan.clip);
        const g = ctx.createGain();
        mpShapeGain(ctx, g, plan.clip, plan, mpTrackGainValue(tr), ctx.currentTime + plan.when);
        src.connect(g);
"""

EXPORT_OLD = """          const src = off.createBufferSource();
          src.buffer = c.buffer;
          const g = off.createGain();
          g.gain.value = mpTrackGainValue(tr);
          src.connect(g);
"""

EXPORT_NEW = """          const src = off.createBufferSource();
          src.buffer = mpClipBuffer(c);
          const g = off.createGain();
          mpShapeGain(off, g, c, { when: Math.max(0, c.start || 0), offset: c.offset || 0, dur: c.dur },
            mpTrackGainValue(tr), Math.max(0, c.start || 0));
          src.connect(g);
"""

JS_ANCHOR = "  function ensureDeckGainNode(deck){\n"


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8370: %s appears %d times, expected exactly 1" % (what, n))
    return text


def part(name):
    path = os.path.join(HERE, name)
    if not os.path.exists(path):
        raise SystemExit("patch-8370: missing dev/" + name)
    return io.open(path, encoding="utf-8").read()


def patched(page):
    if ("const APP_VERSION = '%s';" % V) in page and 'id="mixPadCropIn"' in page:
        return page
    once(page, "const APP_VERSION = '%s';" % OLD, "the version line")
    once(page, ANCHOR, "the 83.6.0 changelog entry")
    once(page, CARD_ANCHOR, "the DJ Mode card")
    once(page, TOOLS_OLD, "the clip tool row")
    once(page, CSS_ANCHOR, "the mix panel stylesheet marker")
    once(page, PAINT_OLD, "mpPaint")
    once(page, PLAY_OLD, "the playback schedule")
    once(page, EXPORT_OLD, "the mixdown schedule")
    once(page, JS_ANCHOR, "ensureDeckGainNode")
    out = page.replace("const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % V, 1)
    out = out.replace(ANCHOR, ENTRY + ANCHOR, 1)
    out = out.replace(CARD_ANCHOR, CARD_ANCHOR + CARD_NEW, 1)
    out = out.replace(TOOLS_OLD, TOOLS_NEW, 1)
    out = out.replace(CSS_ANCHOR, CSS_NEW + CSS_ANCHOR, 1)
    out = out.replace(PAINT_OLD, PAINT_NEW, 1)
    out = out.replace(PLAY_OLD, PLAY_NEW, 1)
    out = out.replace(EXPORT_OLD, EXPORT_NEW, 1)
    out = out.replace(JS_ANCHOR, part("mixpad-8370.js.txt") + JS_ANCHOR, 1)
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
