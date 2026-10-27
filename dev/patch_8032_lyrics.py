"""Lyric edits for 80.3.2: the words are paced inside `pace`, and letter mode fills the line.

Part of the 80.3.2 payload; run dev/patch-8032.py, which applies these in order.
"""

MARKER = "  // \u2500\u2500\u2500 80.3.2 - THE LINE FILLS, THE BOOST SITS BESIDE THE EQ"

WORDDUR_OLD = """    const wordDurs = [];
    let acc = 0;
    for(let i = 0; i < weights.length; i++){
      acc += weights[i];
      wordDurs.push((acc / totalWeight) * gap);
    }
    const natural = Math.max(0.4, totalWeight / rate + 0.2);
    const pace = Math.min(gap, natural);
"""

WORDDUR_NEW = """    const natural = Math.max(0.4, totalWeight / rate + 0.2);
    const pace = Math.min(gap, natural);
""" + MARKER + """
    // (a) THE WORDS ARE SPREAD OVER THE WINDOW THEY ARE PACED IN. They used to be spread
    // over the whole line and cut off at `pace` - shorter than the window whenever a line
    // opens or closes over silence - so every word past the cut had no window at all and
    // the highlight skipped to the last word, fully lit. Scaling by `pace` keeps every
    // word inside the stretch the pacer walks, so the line is visited in order.
    const wordDurs = [];
    let acc = 0;
    for(let i = 0; i < weights.length; i++){
      acc += weights[i];
      wordDurs.push((acc / totalWeight) * pace);
    }
"""

LETTERS_OLD = """    if(lettersOn()){
      words.forEach(function(w, wi){
        // 73.4.4 - LETTER BY LETTER, AND NOTHING ELSE. The 73.4 wave kept the two
        // words behind the light lit and dimming, so a run of gold travelled along
        // the line. That trail is gone: every word that is not the one being sung is
        // wiped back to the trough on the same frame, and only the current word's
        // letters light, in turn, as its own window is reached.
        if(wi !== litIdx){
          clearLetters(w);
          return;
        }
        const span = Math.max(0.05, litTo - litFrom);
        const frac = Math.max(0, Math.min(1, (nowSec - litFrom) / span));
        // 72.8.1 - the letters are PACED, not counted. The old wave cut the
        // word into equal steps, so an i and a W were lit for the same amount
        // of time and the light fell behind on a wide word and ran ahead on a
        // narrow one. Each letter now takes the share of the word its own width
        // deserves, and the glow the CSS applies is handed the same window, so
        // the sweep and the travelling light are one movement.
        const ls = scEnsureLetterSpans(w, (span * 1000) / Math.max(1, (w.textContent || '').length));
        if(!ls.length) return;
        const wts = [];
        let wTotal2 = 0;
        for(let lw = 0; lw < ls.length; lw++){
          const wt2 = scLetterWeight(ls[lw].textContent || '');
          wts[lw] = wt2; wTotal2 += wt2;
        }
        let acc2 = 0, upto = ls.length;
        for(let li = 0; li < ls.length; li++){
          acc2 += wts[li] / wTotal2;
          if(frac < acc2){ upto = li + 1; break; }
        }
        for(let li = 0; li < ls.length; li++) ls[li].classList.toggle('lit', li < upto);
      });
    } else {
      words.forEach(clearLetters);
    }
"""

LETTERS_NEW = """    if(lettersOn()){
      // 80.3.2 - (b) A LINE THAT FILLS. Letter mode used to light only the word being sung
      // and wipe every other word on every frame, so the sheet was one word flashing in
      // place with nothing lit between two words. A word the singer has passed keeps every
      // letter lit, the sung word sweeps, later words stay dark: the line fills left to
      // right and a late poll cannot take the fill away. 73.4.4 holds - nothing is left
      // DIMMED behind the light and no gold travels along the sheet.
      words.forEach(function(w, wi){
        if(wi > litIdx){
          clearLetters(w);
          return;
        }
        const span = Math.max(0.05, litTo - litFrom);
        const frac = Math.max(0, Math.min(1, (nowSec - litFrom) / span));
        // 72.8.1 - the letters are PACED, not counted: each takes the share of the word its
        // own width deserves, and the glow the CSS applies gets the same window.
        const ls = scEnsureLetterSpans(w, (span * 1000) / Math.max(1, (w.textContent || '').length));
        if(!ls.length) return;
        if(wi < litIdx){
          // Sung already: the fill stays. Only letters that are not lit are touched, so a
          // finished word never re-runs a transition and never flickers.
          for(let li = 0; li < ls.length; li++){
            if(!ls[li].classList.contains('lit')) ls[li].classList.add('lit');
          }
          return;
        }
        const wts = [];
        let wTotal2 = 0;
        for(let lw = 0; lw < ls.length; lw++){
          const wt2 = scLetterWeight(ls[lw].textContent || '');
          wts[lw] = wt2; wTotal2 += wt2;
        }
        let acc2 = 0, upto = ls.length;
        for(let li = 0; li < ls.length; li++){
          acc2 += wts[li] / wTotal2;
          if(frac < acc2){ upto = li + 1; break; }
        }
        for(let li = 0; li < ls.length; li++) ls[li].classList.toggle('lit', li < upto);
      });
    } else {
      words.forEach(clearLetters);
    }
"""

WIPE_HELPER_OLD = """  function clearLetters(wordEl){
    if(!wordEl || !wordEl.dataset || wordEl.dataset.letters !== '1') return;
    var ls = wordEl.querySelectorAll('.lyric-letter.lit');
    for(var i = 0; i < ls.length; i++) ls[i].classList.remove('lit');
  }
"""

WIPE_HELPER_NEW = WIPE_HELPER_OLD + """  // 80.3.2 - with the fill kept, a sheet whose sung lines stayed gold would be a wall of gold
  // by the second verse. On a line change every other line goes back to the trough.
  function scLettersWipeOthers(keepLine){
    try{
      if(!lettersOn()) return;
      var rows = document.querySelectorAll('#lyricsText .lyric-line');
      for(var i = 0; i < rows.length; i++){
        if(!rows[i] || rows[i] === keepLine) continue;
        var ws = rows[i].querySelectorAll('.lyric-word');
        for(var j = 0; j < ws.length; j++) clearLetters(ws[j]);
      }
    }catch(_eWipe){}
  }
"""

WIPE_SYNCED_OLD = """            allLines.forEach(l => {
              l.classList.remove('current');
              l.querySelectorAll('.lyric-word').forEach(w => w.classList.remove('current'));
            });
            currentLine.classList.add('current');
"""

WIPE_SYNCED_NEW = WIPE_SYNCED_OLD + """            scLettersWipeOthers(currentLine);
"""

WIPE_PLAIN_OLD = """            allLines.forEach(l => {
              l.classList.remove('current');
              l.querySelectorAll('.lyric-word').forEach(w => w.classList.remove('current'));
            });
            allLines[targetIdx].classList.add('current');
"""

WIPE_PLAIN_NEW = WIPE_PLAIN_OLD + """            scLettersWipeOthers(allLines[targetIdx]);
"""

SWAPS = [
    (WORDDUR_OLD, WORDDUR_NEW, 'the syllable pacing block'),
    (LETTERS_OLD, LETTERS_NEW, 'the letter-highlight block'),
    (WIPE_HELPER_OLD, WIPE_HELPER_NEW, 'clearLetters'),
    (WIPE_SYNCED_OLD, WIPE_SYNCED_NEW, 'the synced line change'),
    (WIPE_PLAIN_OLD, WIPE_PLAIN_NEW, 'the plain line change'),
]
