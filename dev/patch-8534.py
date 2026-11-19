"""SideCut 85.3.4 - one song, one film, and the film's sound through the same
equalizer.

Three reports:

  * the music video kept showing another song's clip and cycling between three of
    them. The tab follows the queue by comparing the playing song's key with the one
    the film was loaded for, and that key comes from whichever list answered - the
    streaming bar's row or the queue entry, two names for one song - so a bar that
    came or went read as "the queue has moved" and the film was loaded again, and
    again when the old name came back. A change now has to be the answer on two ticks
    in a row, a load waits out a short window after the last one, and the search for a
    clip is run for the song that is on now rather than for the one the tab was opened
    for;
  * leaving a music video started the music again. Closing used to hand the song back
    at the picture's second and play it. The song is put back on that second and stays
    PAUSED;
  * the equalizer, the volume boost, the anti-muffler and the duck never reached the
    film. They live on the app's Web Audio chain, and the tab's elements were not on
    it. The film's audio row is read through the same bridge the picture is read with,
    and the blob that comes back (this app's own resource) goes through the same bands
    and the same master. A remote element cannot be routed - the spec hands its
    MediaElementSource silence - so the voice is read, and the direct link plays only
    until the blob swaps under it.

The module lives in dev/video-8534.js and replaces the 85.3.3 block in index.html,
sliced from its banner comment to the shelf comment that follows it. The page also
gains the film's chain beside the decks' graph, and the version line, the cache name,
one notes entry and updates.json move to 85.3.4 with it.

    python3 dev/patch-8534.py            # apply
    python3 dev/patch-8534.py --check    # verify only, writes nothing
"""

import io
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE = os.path.join(ROOT, "index.html")
SW = os.path.join(ROOT, "sw.js")
UPDATES = os.path.join(ROOT, "updates.json")
MODULE = os.path.join(ROOT, "dev", "video-8534.js")

V = "85.3.4"
OLD = "85.3.3"
DATE = "November 19, 2026"
TITLE = "One song, one film, and the same equalizer on the film"

# The notes go into index.html inside single-quoted JS strings, so no apostrophes -
# a stray one is a parse error in a 4 MB page, not a typo. The update card filters
# the word "stream" out of every note, so the wording avoids it.
NOTES = [
    "[FULL] The music video stays on the song that is playing: a change has to hold for two ticks before another film is loaded, so it no longer takes turns between three songs.",
    "[FULL] Leaving a music video pauses the music on the second the picture stopped, instead of starting the song again by itself.",
    "[FULL] The equalizer, the volume boost, the anti-muffler and the duck reach the music video sound too, because its audio is read and played through the same chain as every song.",
]

ENTRY = (
    "      { version: '%s', date: '%s', title: '%s', items: [\n" % (V, DATE, TITLE)
    + "".join("    '%s',\n" % n for n in NOTES[:-1])
    + "    '%s'\n" % NOTES[-1]
    + "  ] },\n"
)

NOTES_ANCHOR = (
    "      { version: '85.3.3', date: 'November 19, 2026', "
    "title: 'The sharp size is read when the player refuses it, and HD+ sharpens instead of washing', items: [\n"
)

BLOCK_START = "  // ─── 85.3.4 - ONE SONG, ONE FILM, AND THE FILM'S SOUND"
BLOCK_OLD = "  // ─── 85.3.3 - A REFUSED ADDRESS"
BLOCK_END = "\n  // 80.6.12 - A TAB, NOT A DRAWER. Streaming is the first"
MODULE_MARK = "85.3.4 - ONE SONG, ONE FILM"
SOUND_MARK = "window.__scVideoSoundOwn"

# The film's chain sits beside the decks' graph, right after it, where `EQ_BANDS`,
# `globalEQ`, `scBoostGain` and the master are all in scope and nothing has run yet.
GRAPH_ANCHOR = "  const deckGainNodes = [null, null]; // DJ Mode \"GAIN\" knob per deck, independent of auto-normalize\n"

GRAPH = """  // 85.3.4 - THE FILM'S SOUND IS THE SONG'S SOUND. The music video tab plays its own
  // elements, and an element that is not in this graph gets no equalizer, no volume
  // boost, no anti-muffler and no duck: it plays the file exactly as it came. Each
  // element the tab hands over gets its own band chain and its own limiter, and lands
  // on the same master the decks do (boost -> anti-muffler -> ceiling -> duck ->
  // speakers), so every adjustment made for a song is made for its film.
  //
  // A REMOTE ELEMENT IS REFUSED, NOT SILENCED. A media element from another origin
  // hands a MediaElementSource nothing but silence - that is the spec, not a bug - so
  // only this app's own blobs and pages are routed. The tab reads the film's own audio
  // row through the native bridge, so its voice IS a blob; until that arrives nothing
  // is routed and the direct link plays as it did before.
  const scVideoChains = [];
  function scVideoChainFor(el){
    if(!el) return null;
    try{
      ensureAudioGraph();
      if(!audioCtx) return null;
      if(el.__scVideoChain) return el.__scVideoChain;
      var u = String(el.currentSrc || el.src || '');
      var local = !u || u.indexOf('blob:') === 0 || u.indexOf('data:') === 0;
      if(!local){
        var o = '';
        try{ o = String(location.origin || ''); }catch(_eOrigin){ o = ''; }
        local = !!(o && o !== 'null' && u.indexOf(o) === 0);
      }
      if(!local) return null;
      const srcNode = audioCtx.createMediaElementSource(el);
      const bands = EQ_BANDS.map((b, i) => {
        const f = audioCtx.createBiquadFilter();
        if(i === 0) f.type = 'lowshelf';
        else if(i === EQ_BANDS.length - 1) f.type = 'highshelf';
        else { f.type = 'peaking'; f.Q.value = 1.1; }
        f.frequency.value = b.freq;
        return f;
      });
      for(let i = 0; i < bands.length - 1; i++) bands[i].connect(bands[i + 1]);
      const gain = audioCtx.createGain();
      const limiter = audioCtx.createDynamicsCompressor();
      limiter.threshold.value = -6;
      limiter.knee.value = 6;
      limiter.ratio.value = 16;
      limiter.attack.value = 0.003;
      limiter.release.value = 0.25;
      srcNode.connect(bands[0]);
      bands[bands.length - 1].connect(gain).connect(limiter);
      // THE SAME MASTER AS EVERY SONG: the boost, its ceiling, the anti-muffler and
      // the duck all sit between here and the speakers.
      limiter.connect(scBoostGain || scDuckMaster || audioCtx.destination);
      const chain = { el: el, src: srcNode, bands: bands, gain: gain, limiter: limiter };
      try{ el.__scVideoChain = chain; }catch(_eMark){}
      scVideoChains.push(chain);
      scVideoEqApply();
      return chain;
    }catch(_eChain){ return null; }
  }
  // The film rides the GLOBAL equalizer - the eight bands every song gets - and the
  // values are refreshed whenever a slider moves, because applyEQ calls this.
  function scVideoEqApply(){
    const preset = (typeof globalEQ === 'object' && globalEQ) ? globalEQ : null;
    for(let c = 0; c < scVideoChains.length; c++){
      const chain = scVideoChains[c];
      if(!chain) continue;
      EQ_BANDS.forEach((b, n) => {
        try{ chain.bands[n].gain.value = preset ? (preset[b.key] || 0) : 0; }catch(_eBand){}
      });
    }
  }
  window.scVideoEqChain = function(el){ return scVideoChainFor(el); };
"""

EQ_HOOK_OLD = "    EQ_BANDS.forEach((b, i) => { nodes[i].gain.value = preset[b.key] || 0; });\n"
EQ_HOOK_NEW = ("    EQ_BANDS.forEach((b, i) => { nodes[i].gain.value = preset[b.key] || 0; });\n"
               "    // 85.3.4 - and the film, which is on the same equalizer.\n"
               "    try{ scVideoEqApply(); }catch(_eVideoEq){}\n")


def once(text, old, what):
    n = text.count(old)
    if n != 1:
        raise SystemExit("patch-8534: %s appears %d times, expected exactly 1" % (what, n))


def swap_module(page, module):
    start = BLOCK_START if BLOCK_START in page else BLOCK_OLD
    once(page, start, "the video module banner")
    i = page.index(start)
    j = page.find(BLOCK_END, i)
    if j < 0:
        raise SystemExit("patch-8534: the shelf comment after the module is missing")
    return page[:i] + module.rstrip("\n") + "\n" + page[j:]


def main():
    check = "--check" in sys.argv
    page = io.open(PAGE, encoding="utf-8").read()
    sw = io.open(SW, encoding="utf-8").read()
    up = io.open(UPDATES, encoding="utf-8").read()
    module = io.open(MODULE, encoding="utf-8").read()

    out = swap_module(page, module)

    if "function scVideoChainFor" not in out:
        once(out, GRAPH_ANCHOR, "the deck chain array")
        out = out.replace(GRAPH_ANCHOR, GRAPH + GRAPH_ANCHOR, 1)
    if "try{ scVideoEqApply(); }catch(_eVideoEq){}" not in out:
        once(out, EQ_HOOK_OLD, "the equalizer setter")
        out = out.replace(EQ_HOOK_OLD, EQ_HOOK_NEW, 1)

    if ("const APP_VERSION = '%s';" % V) not in out:
        once(out, "const APP_VERSION = '%s';" % OLD, "the version line")
        out = out.replace("const APP_VERSION = '%s';" % OLD,
                          "const APP_VERSION = '%s';" % V, 1)
    if ENTRY not in out:
        once(out, NOTES_ANCHOR, "the 85.3.3 notes entry")
        out = out.replace(NOTES_ANCHOR, ENTRY + NOTES_ANCHOR, 1)
    for mark in (MODULE_MARK, "scVideoState.pendingKey", "function scVideoParkSong",
                 "function scVideoGraphSync", "window.scVideoEqChain", "scVideoChainFor(el)", "scVideoEqApply"):
        if mark not in out:
            raise SystemExit("patch-8534: the page lacks %r" % mark)
    if "function scVideoUrl" in out:
        raise SystemExit("patch-8534: the video module carries its own cipher decoder again")
    if out.count(SOUND_MARK) < 5:
        raise SystemExit("patch-8534: the sound flag is no longer read in every guard (%d)"
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
    print("page at %s: the film follows one song (two ticks and a cooldown), exiting "
          "pauses the music, and the film's voice is read and put on the equalizer's "
          "chain; cache at sidecut-shell-v%s, updates.json rewritten" % (V, V))
    return 0


if __name__ == "__main__":
    sys.exit(main())
