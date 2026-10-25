#!/usr/bin/env python3
"""80.2.8 - the lyrics follow the voice, and the phone's ladder stops going backwards.

The owner, twice:

  "add to the same update a fix with the lyrics that makes it absolute correct with
   tempo changes and language changes slow then fast breaks after lines everything"

  and, on the Home bubble sizes, after 80.2.7 shipped: "fix it".

THE LYRICS. The pacer (scPaceWords) spread a line's words by syllable weight at ONE
rate across the window between this line's timestamp and the next one's. That is
exact only when the singer holds one tempo for the whole line. Four things it cannot
survive, all of them named by the owner:

  - slow then fast (or fast then slow) inside one line - one rate for both halves;
  - a change of language, which changes syllables per second and cannot be read off
    any weight table;
  - a break after the line, where the next timestamp is seconds away because the
    singer stopped - the sweep crawled into the silence;
  - a repeated chorus recorded at a different tempo.

The app already measures the track itself for alignment: scOnsetEnvelope is the
rising-energy envelope, and a sung word makes one rise. So the word starts are read
off the recording - one rise per word, in order - and the syllable table stays as the
fallback for a window holding too little singing to place them. Measured once per
track, cached in the meta store, and skipped entirely when a measurement is already
there.

THE LADDER. 80.2.7 made the walk one ascending line, but on a phone the stylesheet
still overrode the full rung to 170px while Roomy stayed 179 - so the walk went 158,
179, 170, 230, 260 on the one screen the chip is actually used on. The override is
gone; the ladder is the stylesheet's own numbers everywhere.

Idempotent: the marker is the measurement block's own banner comment.

    python3 dev/patch-8028.py
    python3 dev/patch-8028.py --check
"""
import importlib.util
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.2.8'
OLD_VERSION = '80.2.7'
MARKER = '  // ─── 80.2.8 - THE VOICE TIMES THE WORDS'
TEXT = os.path.join(ROOT, 'dev', 'patch-8028-text.py')

# The one rung the phone got wrong: 170px, under Roomy's 179.
OLD_PHONE_FULL = """  /* Wide/full bubbles stay full-row; normal bubbles stay 2-up. */
  .home-bubble.hb-size-full{ min-height:calc(170px * var(--hb-s, 1)); }
"""
NEW_PHONE_FULL = """  /* Wide/full bubbles stay full-row; normal bubbles stay 2-up.
     80.2.8 - the 170px full card that lived here was the one rung a phone drew SHORTER
     than the rung below it (roomy 179), so the size chip walked 158, 179, 170, 230, 260.
     The ladder is the stylesheet's own numbers on every width now; this rule is gone. */
"""

# The measurement block, inserted beside the pacer it feeds.
MEASURE = r'''  // ─── 80.2.8 - THE VOICE TIMES THE WORDS ─────────────────────────────────────
  // The pacer spread a line's words by syllable weight at ONE rate across the line's
  // window: from this line's stamp to the next one's. That is exact only if the singer
  // holds one tempo for the whole line. It is wrong in the four ways a sheet moves:
  //
  //   - a line sung slow then fast (or fast then slow) gets one rate for both halves,
  //     so whichever half is not that rate's own arrives early or late;
  //   - a song that changes language mid-line changes its syllables per second, and no
  //     weight table can know which half is which;
  //   - a stamp four seconds away because the singer stopped kept the sweep crawling
  //     into the silence, since the window IS that gap;
  //   - a chorus repeated at a new tempo is paced as if it were the first take.
  //
  // None of that has to be guessed. A voice that sings a word makes a rise in the same
  // rising-energy envelope the auto-alignment already measures (scOnsetEnvelope), so one
  // rise per word, in the order they are sung, IS the word timing - it does not care what
  // tempo, what language or how long the pause after the line is. The starts of a line's
  // words are read off the recording, and the syllable table stays as the fallback for a
  // window holding too few rises to place them (a held note, a whisper, a track that is
  // not on this device).
  //
  // Measured once per song and cached under lyricWords_<track>, so it costs one decode
  // the first time word-by-word or letter-by-letter is used on a track and nothing after.
  var scWordTimes = {};       // trackId -> { len, hop, lines: [{ t, w: [start, ...] }] }
  var scWordEnv = null;       // { id, hop, env } - the song on screen, kept for windows
  var scWordBusy = false;
  var SC_WORD_TAIL = 0.45;    // how long the last word of a line stays lit

  // THE PURE PART. Where a line's words begin, read off the envelope; null when the
  // window holds too little singing to place them, which is what keeps the old shape.
  function scWordStartsForWindow(nWords, fromSec, toSec, env, hop){
    var n = Math.max(1, Math.round(Number(nWords) || 0));
    var from = Number(fromSec) || 0, to = Number(toSec) || 0;
    var span = to - from;
    if(!(span > 0.2) || !env || !env.length || !(hop > 0)) return null;
    var a = Math.max(0, Math.floor(from / hop)), b = Math.min(env.length, Math.ceil(to / hop));
    var peak = 0, i;
    for(i = a; i < b; i++){ if(env[i] > peak) peak = env[i]; }
    if(!(peak > 0)) return null;
    var bar = peak * 0.25;
    // AN ATTACK IS A RISE, not a frame above the bar: a held vowel sits above it for
    // hundreds of milliseconds and is one word, not one word per frame.
    var edges = [];
    for(i = a; i < b; i++){
      if(env[i] >= bar && (i === a || env[i - 1] < bar)) edges.push(i * hop);
    }
    if(edges.length < 2) return null;   // one rise is a hit, not a line of words
    var starts = [];
    if(edges.length >= n){
      // ONE RISE PER WORD. A sung word is an attack, so the words are the n strongest
      // attacks in the window, in the order they happened. A consonant cluster or a drum
      // under the voice makes extra rises; they are dropped from the weakest, and two
      // rises closer together than a syllable can be are the same word (the weaker one
      // goes), so what is left is one rise per word and never a double start.
      var kept = [];
      for(i = 0; i < edges.length; i++){
        var idx = Math.round(edges[i] / hop), strength = 0;
        for(var k = Math.max(0, idx - 2); k <= Math.min(env.length - 1, idx + 2); k++){ if(env[k] > strength) strength = env[k]; }
        kept.push({ t: edges[i], s: strength });
      }
      var merged = [];
      for(i = 0; i < kept.length; i++){
        var prev = merged[merged.length - 1];
        if(prev && kept[i].t - prev.t < 0.09){
          if(kept[i].s > prev.s) merged[merged.length - 1] = kept[i];
          continue;
        }
        merged.push(kept[i]);
      }
      while(merged.length > n){
        var weakest = 0;
        for(i = 1; i < merged.length; i++){ if(merged[i].s < merged[weakest].s) weakest = i; }
        merged.splice(weakest, 1);
      }
      for(i = 0; i < merged.length; i++) starts.push(merged[i].t);
    } else {
      // FEWER RISES THAN WORDS - a word held across two syllables gives one rise. The
      // words are shared out across the rises that ARE there, so the line still follows
      // the recording rather than one rate for all of it.
      var per = (edges.length - 1) / Math.max(1, n - 1);
      for(i = 0; i < n; i++){
        var pos = i * per, k2 = Math.floor(pos), fr = pos - k2;
        if(k2 + 1 < edges.length) starts.push(edges[k2] + (edges[k2 + 1] - edges[k2]) * fr);
        else starts.push(edges[edges.length - 1]);
      }
    }
    // In order, inside the window, and never before the word ahead of it.
    for(i = 0; i < n; i++){
      if(starts[i] == null) starts[i] = i ? starts[i - 1] + span / n : from;
      if(i && starts[i] < starts[i - 1] + 0.04) starts[i] = starts[i - 1] + 0.04;
      if(starts[i] < from) starts[i] = from;
      if(starts[i] > to) starts[i] = to;
    }
    return starts;
  }

  function scWordTrackId(){
    try{
      if(queueIndex >= 0 && queueIndex < queue.length) return String(queue[queueIndex]);
    }catch(_eWid){}
    return null;
  }

  // Take the measurement for the song on screen: from the meta store when it is there,
  // from the audio when it is not. Nothing blocks - the pacer keeps the syllable shape
  // until the numbers arrive, then re-picks the line.
  function scWordMeasureKick(sheetText){
    var tid = scWordTrackId();
    if(!tid || !sheetText || scWordBusy) return;
    var len = String(sheetText).length;
    var known = scWordTimes[tid];
    if(known && known.len === len) return;
    var t = null;
    try{ t = allTracks.find(function(tr){ return String(tr.id) === tid; }); }catch(_eFind){}
    // NO FILE, NO MEASUREMENT - and remember it, or the 50ms poll re-reads the library
    // twenty times a second for a song that can never be measured. The empty record is
    // keyed on the sheet length like a real one, so a different sheet still tries.
    if(!t || !t.file){ scWordTimes[tid] = { len: len, hop: 0, lines: [] }; return; }
    scWordBusy = true;
    (async function(){
      try{
        var cached = null;
        try{
          var row = await dbGet('meta', 'lyricWords_' + tid);
          if(row && row.value) cached = row.value;
        }catch(_eGet){}
        if(cached && cached.len === len && cached.lines && cached.lines.length){
          scWordTimes[tid] = cached;
          lastLyricsIdx = -1;
          return;
        }
        var arr = await blobToArrayBufferFallbackCrop(t.file);
        if(!arr) return;
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var dec = null;
        try{ dec = await ctx.decodeAudioData(arr); }catch(_eDec){ dec = null; }
        try{ ctx.close(); }catch(_eClose){}
        if(!dec) return;
        var env = scOnsetEnvelope(dec);
        var hop = SC_ONSET_HOP;
        var rows = scParseLrcLines(sheetText);
        var lines = [];
        for(var i = 0; i < rows.length; i++){
          var from = Number(rows[i].t);
          if(!isFinite(from) || from < 0) continue;
          var to = (i + 1 < rows.length) ? Number(rows[i + 1].t) : (dec.duration || 0);
          if(!(to > from + 0.2)) to = from + Math.max(1, (dec.duration || from + 6) - from);
          var words = scPaceSegments(String(rows[i].text || '')).filter(function(w){ return !/^\s+$/.test(w); });
          if(!words.length) continue;
          var st = scWordStartsForWindow(words.length, from, to, env, hop);
          if(st) lines.push({ t: from, w: st });
        }
        if(!lines.length){ scWordTimes[tid] = { len: len, hop: 0, lines: [] }; return; }
        var rec = { len: len, hop: hop, lines: lines };
        scWordTimes[tid] = rec;
        scWordEnv = { id: tid, hop: hop, env: env };
        try{ dbPut('meta', { key: 'lyricWords_' + tid, value: rec }); }catch(_ePut){}
        lastLyricsIdx = -1;                                 // re-pick the live line now
      }catch(_eMeasure){} finally { scWordBusy = false; }
    })();
  }

  // The starts this line is paced by, or null to keep the syllable shape. A line whose
  // word count no longer matches its measurement is never paced by the old numbers.
  function scMeasuredWordStarts(lineEl, fromSec, toSec, nWords){
    var tid = scWordTrackId();
    if(!tid) return null;
    var rec = scWordTimes[tid];
    var stamp = NaN;
    try{ stamp = Number(lineEl && lineEl.dataset ? lineEl.dataset.time : NaN); }catch(_eStamp){}
    if(rec && rec.lines && rec.lines.length && isFinite(stamp)){
      for(var i = 0; i < rec.lines.length; i++){
        if(Math.abs(rec.lines[i].t - stamp) <= 0.25 && rec.lines[i].w && rec.lines[i].w.length === nWords) return rec.lines[i].w;
      }
    }
    if(scWordEnv && scWordEnv.id === tid){
      return scWordStartsForWindow(nWords, fromSec, toSec, scWordEnv.env, scWordEnv.hop);
    }
    return null;
  }

'''

# The measured starts are read inside the pacer, before the syllable share is used.
OLD_PACE_READ = """    let litIdx = -1, litFrom = 0, litTo = 0;
    words.forEach(function(w, wi){"""

NEW_PACE_READ = """    // 80.2.8 - the measurement this song has, if it has one. The kick is a map lookup
    // until a decode is actually needed, and that only happens with word or letter
    // highlighting on AND a sheet with stamps in it, so a plain sheet costs nothing.
    if(lettersOn() || lyricsWordByWord) scWordMeasureKick(currentLyricsText);
    let litIdx = -1, litFrom = 0, litTo = 0;
    // MEASURED FIRST. A word is lit at the rise the singer made for it, so a line that
    // slows down or speeds up, a change of language, a chorus at a new tempo and a pause
    // after the line all land where the recording puts them. `starts` is null unless a
    // measurement exists for this song AND this line still has the word count it was
    // measured with - in which case the syllable share below runs exactly as it did.
    const starts = scMeasuredWordStarts(lineEl, fromSec, toSec, words.length);
    if(starts){
      for(let si = 0; si < starts.length; si++){
        const wFrom = starts[si];
        const wTo = (si + 1 < starts.length)
          ? Math.max(wFrom + 0.04, starts[si + 1])
          : Math.max(wFrom + 0.12, Math.min(toSec, wFrom + SC_WORD_TAIL));
        if(nowSec >= wFrom && nowSec < wTo){ litIdx = si; litFrom = wFrom; litTo = wTo; break; }
      }
      // Past the last rise the line is still the current line, so the last word holds -
      // and it does not start walking into the gap the singer left behind it.
      if(litIdx === -1 && nowSec >= starts[starts.length - 1]){
        litIdx = starts.length - 1;
        litFrom = starts[starts.length - 1];
        litTo = litFrom + SC_WORD_TAIL;
      }
    } else {
    words.forEach(function(w, wi){"""

OLD_PACE_TAIL = """    if(litIdx === -1 && nowSec >= fromSec + pace){
      litIdx = words.length - 1;
      litFrom = fromSec + ((totalWeight - weights[words.length - 1]) / totalWeight) * pace;
      litTo = fromSec + pace;
    }
"""

NEW_PACE_TAIL = """    if(litIdx === -1 && nowSec >= fromSec + pace){
      litIdx = words.length - 1;
      litFrom = fromSec + ((totalWeight - weights[words.length - 1]) / totalWeight) * pace;
      litTo = fromSec + pace;
    }
    }
"""

# The insertion point: the pacer its own self, and the whole block before it stays put.
PACE_HEAD = "  function scPaceWords(lineEl, fromSec, toSec, nowSec){"

CLAIMS = [
    ("const APP_VERSION = '80.2.8';", 'the page runs 80.2.8'),
    (MARKER, 'the measurement block is in the page'),
    ('function scWordStartsForWindow(nWords, fromSec, toSec, env, hop){', 'the window reader is there'),
    ('function scWordMeasureKick(sheetText){', 'the measurement driver is there'),
    ('function scMeasuredWordStarts(lineEl, fromSec, toSec, nWords){', 'the pacer can read a measurement'),
    ('const starts = scMeasuredWordStarts(lineEl, fromSec, toSec, words.length);', 'the pacer consults it'),
    ('if(lettersOn() || lyricsWordByWord) scWordMeasureKick(currentLyricsText);', 'and measures only when it matters'),
    ("key: 'lyricWords_' + tid", 'the measurement is cached per track'),
    ('var SC_WORD_TAIL = 0.45;', 'the last word holds past its rise'),
    (NEW_PHONE_FULL, 'the phone no longer shortens the full rung'),
    ("{ version: '80.2.8', date:", 'the changelog records the release'),
    ("{ version: '80.2.7', date:", 'with 80.2.7 still listed next'),
]

GONE = [
    ('  .home-bubble.hb-size-full{ min-height:calc(170px * var(--hb-s, 1)); }',
     'the 170px full card a phone drew'),
    ('function scWordStartsForWindow(nWords, fromSec, toSec, env, hop){}', 'an empty stub'),
]


def load_text():
    spec = importlib.util.spec_from_file_location('sc_patch_8028_text', TEXT)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def swap(src, old, new, what, times=1):
    if src.count(old) != times:
        raise SystemExit('patch-8028: %s appears %d times, expected %d' % (what, src.count(old), times))
    return src.replace(old, new)


def apply_all(src):
    t = load_text()
    # 1. THE MEASUREMENT, beside the pacer it feeds.
    src = swap(src, PACE_HEAD, MEASURE + PACE_HEAD, 'the pacer head')
    # 2. THE PACER reads it, then falls back to the syllable share exactly as before.
    src = swap(src, OLD_PACE_READ, NEW_PACE_READ, 'the pacer read')
    src = swap(src, OLD_PACE_TAIL, NEW_PACE_TAIL, 'the pacer tail')
    # 3. THE PHONE'S LADDER.
    src = swap(src, OLD_PHONE_FULL, NEW_PHONE_FULL, 'the phone full rule')
    # 4. THE RELEASE ITSELF.
    src = swap(src, t.CHANGELOG_ANCHOR, t.CHANGELOG_HEAD + t.CHANGELOG_ANCHOR, 'the changelog head')
    src = swap(src, "  const APP_VERSION = '%s';" % OLD_VERSION,
               "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if MARKER in page and ("const APP_VERSION = '%s';" % VERSION) in page:
        print('  present: the measurement block and the page runs as ' + VERSION)
        print('patch-8028%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8028 --check: the release is pending, 6 steps to apply')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8028: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8028: the page did not end up 80.2.8 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-8028: the page still carries this (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    if "'sidecut-shell-v%s'" % OLD_VERSION not in sw:
        sys.exit('patch-8028: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(
        sw.replace("'sidecut-shell-v%s'" % OLD_VERSION, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the voice times the words, the phone ladder, the notes and the shell cache')
    print('patch-8028: 6 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
