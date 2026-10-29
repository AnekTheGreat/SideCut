#!/usr/bin/env python3
"""80.6.8 - the light walks word to word, and it cannot skip one.

The owner's ask, verbatim:

    "lyrics are incorrect fix them they should be 100 percent correct flowing
     to the next word dawg"

THE FLOW WAS BEING GUESSED WHERE IT DID NOT HAVE TO BE, AND WHERE IT WAS NOT
GUESSED IT COULD SKIP. Four separate faults, all in the pacer:

1. THE SHEET'S OWN WORD STAMPS WERE THROWN AWAY. Enhanced LRC puts a stamp in
   front of the word it starts - "[00:12.00]<00:12.00>Hello <00:12.62>world" -
   and that is the only word timing in a sheet that is not an estimate.
   SC_LRC_TAG_SRC has always MATCHED those stamps (its bracket forms include the
   angle ones), so formatSyncedLyrics stripped them out of the line and kept the
   text: the row printed correctly and every word in it was then paced by
   syllable share. They are read now, onto each span as data-word-at, and the
   pacer uses them verbatim. A word between two stamps is placed by its own
   syllable share of the gap, so a sheet that stamps only the long words still
   flows evenly between them.

2. THE MEASUREMENT COULD NEVER APPLY TO SUCH A SHEET. The measurement counts the
   words of each row from that row's own text, and the text still carried the
   inline stamps, so a stamp was counted as a word; the count then disagreed with
   the number of spans on screen, scMeasuredWordStarts refused the record (it
   compares counts on purpose), and the song fell back to the guess it had just
   been measured for. The stamps are stripped where the words are COUNTED now, and
   not in scParseLrcLines - which also feeds the line-up writer, and that writer
   must not lose a sheet's own stamps when it rebuilds it.

3. A WORD COULD BE SKIPPED OUTRIGHT. The pacer asked "which word's window
   contains now", and a window is only as wide as the gap to the next start. Two
   words clamped onto the same rise, or a fast line, produced windows of a few
   hundredths of a second - narrower than the 50 ms poll - so those words were
   never lit at all: the highlight jumped. It asks the other question now: the
   last start the playhead has passed. Walking a list of starts forward cannot
   skip one.

4. A LINE COULD SIT DARK. When a measurement put a line's first rise later than
   the line's own stamp, no word was lit until that rise arrived - the current row
   sat there with nothing in it. It lights its first word for that stretch now.

And the tail clamp in scWordStartsForWindow is why 1 and 3 were seen together:
every word past the end of the window was pulled onto `to` itself, so a long line
came out with several words sharing one instant. The tail is now pulled back from
the end with room between them.

Nothing else moves: the line highlight, the scroll, the sync nudge, the letter
mode and the sheet's own text are exactly as they were, and a sheet with no word
stamps is paced by the same two fallbacks in the same order - the recording
first, the syllable share second.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8068.py
    python3 dev/patch-8068.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.8'
OLD_VERSION = '80.6.7'
MARKER = '80.6.8 - THE LIGHT WALKS WORD TO WORD, AND IT CANNOT SKIP ONE'

# ---------------------------------------------------------------------------
# 1. The words the measurement counts are the words that are drawn.
# ---------------------------------------------------------------------------
MEASURE_OLD = "          var words = scPaceSegments(String(rows[i].text || '')).filter(function(w){ return !/^\\s+$/.test(w); });"

MEASURE_NEW = r"""          // 80.6.8 - A STAMP IS NOT A WORD. An enhanced sheet carries a stamp in front of
          // some of its words, and the row's text arrives here with them still in it, so
          // each stamp was counted as a word. The count then disagreed with the number of
          // spans the same row renders, and scMeasuredWordStarts refuses a record whose
          // count disagrees (it compares them on purpose) - so the very sheet that HAS
          // word timing was paced by the guess this measurement exists to replace. The
          // stamps are stripped here, where the words are counted, and NOT in
          // scParseLrcLines: that hands rows to the line-up writer, which must not lose a
          // sheet's own stamps when it rebuilds it.
          var words = scPaceSegments(String(rows[i].text || '').replace(scLrcTagRe(), ' ').replace(/\s+/g, ' ').trim())
            .filter(function(w){ return !/^\s+$/.test(w); });"""

# ---------------------------------------------------------------------------
# 2. The render keeps each word's own stamp, when the sheet has one.
# ---------------------------------------------------------------------------
RENDER_OLD = r"""        } else if(text){
          // Synthetic word timestamps evenly distributed across each occurrence
          // of the line (a repeated chorus gets its own pacing at every repeat).
          const words = scPaceSegments(text);
          let wTotal = 0;
          words.forEach(function(w){ if(!/^\s+$/.test(w)) wTotal++; });
          let wIdx = 0;
          const wordSpans = words.map(function(w){
            if(/^\s+$/.test(w)) return escapeHtml(w);
            const cur = wIdx; wIdx++;
            return '<span class="lyric-word" data-word="1" data-word-start="' + t + '" data-word-offset="' + cur + '/' + wTotal + '">' + escapeHtml(w) + '</span>';
          }).join('');
          nodes.push({
            t: t, kind: 'line', html: '<div class="lyric-line" data-time="' + t + '" data-wordline="1">' + wordSpans + '</div>'
          });
        }"""

RENDER_NEW = r"""        } else if(text){
          // 80.6.8 - THE SHEET'S OWN WORD STAMPS SURVIVE. The line's stamps are its
          // times (a repeated chorus carries one per take); what is left of the row is
          // the sung text with the inline word stamps still in it, and those are the
          // one word timing in a sheet that is not an estimate. Each word keeps its
          // own start in data-word-at and the pacer uses it verbatim; a word without
          // one stays unstamped and is placed by the syllables between its neighbours.
          const bodyTxt = scDeGlyph(scLrcBody(raw)).trim();
          const parts = scWordParts(bodyTxt, t);
          let wTotal = 0;
          parts.forEach(function(p){ if(!p.space) wTotal++; });
          let wIdx = 0;
          const wordSpans = parts.map(function(p){
            if(p.space) return escapeHtml(p.w);
            const cur = wIdx; wIdx++;
            const atAttr = (p.at == null || !isFinite(p.at)) ? '' : ' data-word-at="' + p.at + '"';
            return '<span class="lyric-word" data-word="1" data-word-start="' + t + '" data-word-offset="' + cur + '/' + wTotal + '"' + atAttr + '>' + escapeHtml(p.w) + '</span>';
          }).join('');
          nodes.push({
            t: t, kind: 'line', html: '<div class="lyric-line" data-time="' + t + '" data-wordline="1">' + wordSpans + '</div>'
          });
        }"""

# ---------------------------------------------------------------------------
# 3. The helpers: the row body, the stamped words, the stamped starts, the pick.
# ---------------------------------------------------------------------------
PACEWORDS_ANCHOR = "  function scPaceWords(lineEl, fromSec, toSec, nowSec){"

HELPERS = r"""  // ─── 80.6.8 - THE SHEET TIMES ITS OWN WORDS ─────────────────────────────────
  // Enhanced LRC carries a stamp in front of the word it starts:
  //
  //     [00:12.00]<00:12.00>Hello <00:12.62>world
  //
  // SC_LRC_TAG_SRC has always MATCHED those stamps - the bracket forms include the
  // angle ones - so formatSyncedLyrics stripped them out of the text and threw the
  // timing away with them: the row printed correctly and every word after it was paced
  // by syllable share. Read them instead, and the highlight lands where the singer's
  // word does. A sheet with no stamps changes in no way at all: every word is simply
  // unstamped, and the recording (scMeasuredWordStarts) or the syllable share paces it,
  // in exactly the order and shape they always did.
  function scDeGlyph(s){
    return String(s == null ? '' : s).replace(/[\u266A-\u266F\u{1F3B5}\u{1F3B6}]/gu, '');
  }
  // The line's own stamps are the repeated-line times and are already parsed; what is
  // left of the row is the sung text with its inline word stamps still in it.
  function scLrcBody(raw){
    var s = String(raw == null ? '' : raw);
    for(;;){
      var m = s.match(/^\s*\[\s*\d{1,3}\s*[:\uFF1A]\s*\d{1,2}(?:\s*[.:\uFF0E]\s*\d{1,3})?\s*\]/);
      if(!m) break;
      s = s.slice(m[0].length);
    }
    return s;
  }
  // Split the body into pacing units, each carrying the stamp that introduced it. The
  // stamp belongs to the FIRST word of the run it precedes; a run scPaceSegments breaks
  // into pieces (a Han/Kana/Hangul run with no spaces) stamps only its first piece.
  function scWordParts(body, lineT){
    var out = [], re = scLrcTagRe(), pending = null, last = 0, m;
    var txt = String(body == null ? '' : body);
    var floor = Number(lineT) || 0;
    function add(seg){
      if(!seg) return;
      var units = scPaceSegments(seg), first = true, i;
      for(i = 0; i < units.length; i++){
        var u = units[i];
        if(/^\s+$/.test(u)){ out.push({ w: u, space: true, at: null }); continue; }
        out.push({ w: u, space: false, at: first ? pending : null });
        first = false;
      }
    }
    for(;;){
      re.lastIndex = last;                        // the tag pattern is global; walk it here
      m = re.exec(txt);
      if(!m) break;
      add(txt.slice(last, m.index));
      pending = parseInt(m[1], 10) * 60 + parseInt(m[2], 10) +
                (m[3] ? parseInt(m[3], 10) / Math.pow(10, m[3].length) : 0);
      if(pending < floor) pending = floor;        // a stamp cannot put a word before its line
      last = re.lastIndex;
    }
    add(txt.slice(last));
    return out;
  }
  // Every word's start, when the sheet stamped them - null when it stamped none, which is
  // what leaves the recording (or the syllable share) the say. A stamp is used as it is;
  // a word between two stamps takes its own syllable share of the gap, so a sheet that
  // stamps only the long words still flows evenly between them.
  function scSheetWordStarts(words, fromSec, toSec){
    if(!words || !words.length) return null;
    var n = words.length, at = [], wt = [], i, has = false;
    for(i = 0; i < n; i++){
      var raw = '';
      try{ raw = (words[i].dataset && words[i].dataset.wordAt) || ''; }catch(_eAt){}
      var v = raw === '' ? NaN : Number(raw);
      if(isFinite(v)){ has = true; at.push(v); } else at.push(NaN);
      var txt = '';
      try{ txt = words[i].textContent || ''; }catch(_eTxt){}
      wt.push(Math.max(0.5, Number(scSyllableCount(txt)) || 1));
    }
    if(!has) return null;
    var from = Number(fromSec) || 0, to = Number(toSec) || 0;
    // Order first. The song never goes backwards, so a stamp that lands behind the word
    // before it - a sheet's own rounding, a stamp shared by an overlap - is pulled
    // forward rather than allowed to rewind the line.
    var floorAt = from;
    for(i = 0; i < n; i++){
      if(!isFinite(at[i])) continue;
      if(at[i] < floorAt) at[i] = floorAt;
      floorAt = Math.max(floorAt, at[i] + 0.03);
    }
    // Then the gaps: every unstamped run is shared between the stamps on either side of
    // it by syllable weight, so a sheet that stamps one word per phrase moves at the
    // phrase's own pace instead of at one fixed rate for the whole line.
    i = 0;
    while(i < n){
      if(isFinite(at[i])){ i++; continue; }
      var j = i;
      while(j < n && !isFinite(at[j])) j++;
      var before = i > 0 ? at[i - 1] : from;
      var after = (j < n) ? at[j] : Math.max(before + 0.2, to > before ? to : before + 0.6 * (j - i));
      var span = after - before;
      if(!(span > 0.02 * (j - i + 1))) span = 0.02 * (j - i + 1);
      var wsum = 0, k;
      for(k = i; k < j; k++) wsum += wt[k];
      if(!(wsum > 0)) wsum = j - i;
      var lead = span / (j - i + 1);              // the stretch before the first of them
      var accw = 0;
      for(k = i; k < j; k++){
        accw += wt[k] / wsum;
        var cand = before + lead + accw * Math.max(0, span - lead);
        var cap = (j < n) ? after - 0.02 : cand;
        at[k] = Math.min(cand, Math.max(before + 0.02 * (k - i + 1), cap));
      }
      i = j;
    }
    for(i = 1; i < n; i++){ if(!(at[i] > at[i - 1])) at[i] = at[i - 1] + 0.03; }
    return at;
  }
  // The word on screen is the LAST start the playhead has passed - not "the word whose
  // window contains now". A window is only as wide as the gap to the next start, so two
  // words on one rise or a fast line gave windows of a few hundredths of a second, and a
  // window that narrow is stepped straight over by the 50 ms poll: that word was never
  // lit at all, which is what a skipped word is. Walking starts forward cannot skip one.
  function scPickLitIdx(starts, nowSec){
    var idx = -1;
    for(var i = 0; i < starts.length; i++){
      if(nowSec >= starts[i]) idx = i; else break;
    }
    return idx;
  }
"""

# ---------------------------------------------------------------------------
# 4. The pacer asks the pick, and a line never sits dark waiting for its first word.
# ---------------------------------------------------------------------------
PICK_OLD = r"""    const starts = scMeasuredWordStarts(lineEl, fromSec, toSec, words.length);
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
    } else {"""

PICK_NEW = r"""    // 80.6.8 - WHERE THE STARTS COME FROM, in this order. The sheet's own word stamps,
    // when it has them, are the only exact timing available and are used as they are.
    // Then the measurement the recording gave this line (scMeasuredWordStarts). Only if
    // neither answered does the syllable share below place the words.
    const starts = scSheetWordStarts(words, fromSec, toSec) ||
                   scMeasuredWordStarts(lineEl, fromSec, toSec, words.length);
    if(starts){
      // The last start the playhead has passed - see scPickLitIdx. Every word the singer
      // has reached has been lit on the way here, so a narrow window cannot swallow one.
      const pick = scPickLitIdx(starts, nowSec);
      if(pick >= 0){
        litIdx = pick;
        litFrom = starts[pick];
        litTo = (pick + 1 < starts.length)
          ? Math.max(litFrom + 0.04, starts[pick + 1])
          : litFrom + SC_WORD_TAIL;
      } else {
        // The row is current but its first word is sung a beat later: light the first
        // word for that stretch instead of leaving the whole line unlit.
        litIdx = 0;
        litFrom = fromSec;
        litTo = Math.max(fromSec + 0.04, Math.min(starts[0], toSec));
      }
    } else {"""

# ---------------------------------------------------------------------------
# 5. The tail of a measured line keeps its room instead of collapsing onto `to`.
# ---------------------------------------------------------------------------
CLAMP_OLD = r"""    // In order, inside the window, and never before the word ahead of it.
    for(i = 0; i < n; i++){
      if(starts[i] == null) starts[i] = i ? starts[i - 1] + span / n : from;
      if(i && starts[i] < starts[i - 1] + 0.04) starts[i] = starts[i - 1] + 0.04;
      if(starts[i] < from) starts[i] = from;
      if(starts[i] > to) starts[i] = to;
    }
    return starts;"""

CLAMP_NEW = r"""    // In order, and inside the window. 80.6.8 - the tail clamp used to pull every word
    // past the end of the window onto `to` ITSELF, so a line that ran a little long came
    // out with two, three or six words sharing one instant: those words had no stretch of
    // their own to be lit in, and the pacer stepped over them. The tail is pulled BACK
    // from the end with room between the words instead, which keeps the order and gives
    // every word a window.
    for(i = 0; i < n; i++){
      if(starts[i] == null) starts[i] = i ? starts[i - 1] + span / n : from;
      if(i && starts[i] < starts[i - 1] + 0.04) starts[i] = starts[i - 1] + 0.04;
      if(starts[i] < from) starts[i] = from;
    }
    var gapMin = Math.min(0.14, Math.max(0.04, span / (n * 6)));
    for(i = n - 1; i >= 0; i--){
      var cap = (i === n - 1) ? to : starts[i + 1] - gapMin;
      if(starts[i] > cap) starts[i] = cap;
      if(starts[i] < from) starts[i] = from;
    }
    for(i = 1; i < n; i++){
      if(!(starts[i] > starts[i - 1])) starts[i] = starts[i - 1] + 0.04;
    }
    return starts;"""

# ---------------------------------------------------------------------------
# 6. The light glides between words instead of snapping.
# ---------------------------------------------------------------------------
CSS_WORD_OLD = "    transition: color 0.15s ease, background 0.15s ease, filter 0.3s ease;"
CSS_WORD_NEW = ("    /* 80.6.8 - the light GLIDES to the next word instead of snapping onto it. */\n"
                "    transition: color 0.22s cubic-bezier(0.22,0.61,0.36,1), "
                "background 0.22s cubic-bezier(0.22,0.61,0.36,1), filter 0.3s ease;")

CSS_INNER_OLD = "    transition: color 0.15s ease;\n    color: inherit;"
CSS_INNER_NEW = ("    transition: color 0.22s cubic-bezier(0.22,0.61,0.36,1);\n    color: inherit;")


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        '<b>The sheet&rsquo;s own word timing is used now.</b> A timed sheet can stamp each word, and that was being stripped out of the line with the line stamps &mdash; every word after it was paced by a guess. The highlight lands on the stamp, and a word between two stamps is placed by its own syllables.',
        '<b>The recording&rsquo;s measurement finally applies.</b> The inline stamps were being counted as words, so the measured word count never matched the words on screen and the line fell back to the guess. Counting only the words that are drawn is what lets the voice time the words.',
        '<b>No word gets skipped.</b> The light now moves to the last word the playhead has reached, instead of looking for a window to be inside &mdash; a fast pair of words, or a line whose words were bunched at its end, used to be stepped over entirely.',
        '<b>A line never sits dark waiting for its first word.</b> If the singing starts a beat after the line&rsquo;s stamp, the first word is lit for that stretch.',
        'The light <b>glides</b> from one word to the next now instead of snapping. The sheet&rsquo;s text, the line highlight, the scroll, the sync nudge and letter mode are unchanged.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Every word lands on the voice', body))


def swap(src, old, new, what, times=1):
    count = src.count(old)
    if count != times:
        raise SystemExit('patch-8068: %s appears %d times, expected %d (anchor: %s)'
                         % (what, count, times, old[:70].replace('\n', '\\n')))
    return src.replace(old, new)


CLAIMS = [
    ("const APP_VERSION = '80.6.8';", 'the page runs 80.6.8'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.8', date:", 'the changelog records the release'),
    ('function scWordParts(body, lineT){', 'the body splitter is in the script'),
    ('function scSheetWordStarts(words, fromSec, toSec){', 'the stamped starts are read'),
    ('function scPickLitIdx(starts, nowSec){', 'the pick is in the script'),
    ("' data-word-at=\"' + p.at + '\"'", 'the render keeps a word stamp'),
    ('const starts = scSheetWordStarts(words, fromSec, toSec) ||', 'the stamps come first'),
    ("replace(scLrcTagRe(), ' ').replace(/\\s+/g, ' ').trim())", 'the counted words carry no stamps'),
    ('var gapMin = Math.min(0.14, Math.max(0.04, span / (n * 6)));', 'the tail keeps its room'),
    ('if(!(starts[i] > starts[i - 1])) starts[i] = starts[i - 1] + 0.04;', 'the order is forced'),
    ('transition: color 0.22s cubic-bezier(0.22,0.61,0.36,1);', 'the light glides'),
    ("var SC_WORD_TAIL = 0.45;", 'the last-word hold is untouched'),
]

GONE = [
    ("const APP_VERSION = '80.6.7';", 'the old version constant'),
    ('if(starts[i] > to) starts[i] = to;', 'the tail clamp that collapsed words'),
    ('if(nowSec >= wFrom && nowSec < wTo){ litIdx = si;', 'the contains-a-window pick'),
    ('Synthetic word timestamps evenly distributed', 'the old render comment'),
    ('transition: color 0.15s ease, background 0.15s ease', 'the old word transition'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', and the light walks word to word')
        print('patch-8068%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8068 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8068: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, MEASURE_OLD, MEASURE_NEW, 'the words the measurement counts')
    page = swap(page, RENDER_OLD, RENDER_NEW, 'the word spans of a synced row')
    page = swap(page, PACEWORDS_ANCHOR, HELPERS + PACEWORDS_ANCHOR, 'the head of scPaceWords')
    page = swap(page, PICK_OLD, PICK_NEW, 'the start list and the pick')
    page = swap(page, CLAMP_OLD, CLAMP_NEW, 'the tail of scWordStartsForWindow')
    page = swap(page, CSS_WORD_OLD, CSS_WORD_NEW, 'the word transition')
    page = swap(page, CSS_INNER_OLD, CSS_INNER_NEW, 'the inner word transition')

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){",
                "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8068: the page did not end up 80.6.8 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8068: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8068: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the sheet stamps honoured, the counted text cleaned, the pick, the dark line, '
          'the tail room, the glide, the changelog head, the version and the shell cache')
    print('patch-8068: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
