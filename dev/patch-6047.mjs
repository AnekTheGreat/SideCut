#!/usr/bin/env node
// v60.4.7 — three reported issues:
//
// A. Lyrics highlight inaccurate / word-by-word dead on some songs.
//    Root causes and fixes:
//    - Word pacing spread a line's words across the whole gap to the NEXT
//      line, so any instrumental gap made the highlight crawl and sit on the
//      wrong word. Words are now paced over min(gap, natural singing length
//      ~14 chars/sec) with the last word holding through the trailing gap.
//    - Songs whose lyrics are plain text (no timestamps) had NO word spans
//      at all, so word-by-word silently did nothing there. Plain lines are
//      now wrapped into words once and paced across the line's proportional
//      window — the same pacing math as synced lyrics.
//    - Poll tightened 80ms -> 50ms so line and word changes land closer to
//      the timestamp (the per-song +/-0.5s nudge still fine-tunes the source).
//
// B. Word-by-word should glow like the RGB modes when toggled on.
//    The lit word now gets a glow built from --glow-a/--glow-b — exactly the
//    two colours rgbApplyHue() cycles — so in RGB modes the word sweeps with
//    the whole app, and in every other theme it wears the theme's own pair.
//
// C. False red banner: "previously crashed during: adding files to the
//    library". handleFiles marks the flight recorder but NOTHING ever
//    cleared the marker when the import finished, so any silent kill
//    (memory reclaim, swipe-away without events) within 5 minutes of a
//    SUCCESSFUL import came back as a crash banner. The marker is now
//    cleared the moment the synchronous import pass ends (all paths,
//    including 0-added, CSV-only, and the failure path).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let applied = 0, failed = 0;

function rep(name, oldStr, newStr) {
  if (src.includes(newStr)) { console.log(`  = ${name} (already applied)`); return; }
  if (!src.includes(oldStr)) { console.error(`  ✗ ${name} — anchor NOT found`); failed++; return; }
  src = src.split(oldStr).join(newStr);
  applied++;
  console.log(`  ✓ ${name}`);
}

// ---- B. RGB glow on the lit word (CSS) ----------------------------------
rep('RGB glow CSS for the lit word',
`  #lyricsText .lyric-line .lyric-word.current {
    color: var(--gold);
    font-weight: 700;
  }`,
`  #lyricsText .lyric-line .lyric-word.current {
    color: var(--gold);
    font-weight: 700;
  }
  /* Word-by-word lit word — the same glow the RGB modes animate. --glow-a /
     --glow-b are exactly the two colours rgbApplyHue() cycles every ~90ms, so
     with an RGB theme selected the lit word sweeps with the rest of the app;
     in every other theme the root pair falls back to the theme's own accents.
     Scoped to .ww-on so the effect belongs to word-by-word specifically. */
  #lyricsText.ww-on .lyric-word.current {
    color: var(--gold);
    font-weight: 700;
    text-shadow: 0 0 10px color-mix(in srgb, var(--glow-a) 85%, transparent),
                 0 0 24px color-mix(in srgb, var(--glow-b) 65%, transparent);
    background: linear-gradient(90deg,
      color-mix(in srgb, var(--glow-a) 24%, transparent),
      color-mix(in srgb, var(--glow-b) 24%, transparent));
    border-radius: 5px;
    padding: 1px 3px;
    animation: wwLitPulse 1.1s ease-in-out infinite;
  }
  @keyframes wwLitPulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.28); }
  }`);

// ---- A2. ww-on class at render ------------------------------------------
rep('ww-on class when lyrics render',
`      } else {
        $('lyricsWordBtn').style.display = 'none';
        $('lyricsWwInfo').style.display = 'none';
      }
    }`,
`      } else {
        $('lyricsWordBtn').style.display = 'none';
        $('lyricsWwInfo').style.display = 'none';
      }
      try{ $('lyricsText').classList.toggle('ww-on', !!lyricsWordByWord); }catch(_eWw){}
    }`);

// ---- B. ww-on class at toggle -------------------------------------------
rep('ww-on class when the button is clicked',
`    lyricsWordByWord = !lyricsWordByWord;
    $('lyricsWordBtn').textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');
    $('lyricsWordBtn').classList.toggle('active', lyricsWordByWord);
    dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
    $('lyricsWwInfo').style.display = lyricsWordByWord ? '' : 'none';`,
`    lyricsWordByWord = !lyricsWordByWord;
    $('lyricsWordBtn').textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');
    $('lyricsWordBtn').classList.toggle('active', lyricsWordByWord);
    dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
    $('lyricsWwInfo').style.display = lyricsWordByWord ? '' : 'none';
    try{ $('lyricsText').classList.toggle('ww-on', !!lyricsWordByWord); }catch(_eWw){}`);
// also the other writer of the button label (open path at ~9156)

// ---- A1/A2. pacing helpers ----------------------------------------------
rep('scEnsureWordSpans + scPaceWords helpers',
`  function formatSyncedLyrics(lrc) {`,
`  // Wrap a plain (unsynced) lyric line's text into .lyric-word spans ONCE, so
  // word-by-word can pace it. Lines that already carry word spans are returned
  // as-is; lines containing other markup (instrumental rows) are left alone —
  // nothing to pace there, and rewriting them would break their structure.
  function scEnsureWordSpans(lineEl){
    if(!lineEl) return [];
    if(lineEl.dataset.wordwrap === '1') return lineEl.querySelectorAll('.lyric-word');
    const existing = lineEl.querySelectorAll('.lyric-word');
    if(existing.length){ lineEl.dataset.wordwrap = '1'; return existing; }
    if(lineEl.children.length || lineEl.dataset.inst){ lineEl.dataset.wordwrap = '1'; return []; }
    const text = lineEl.textContent;
    if(!text || !text.trim()){ lineEl.dataset.wordwrap = '1'; return []; }
    lineEl.innerHTML = String(text).split(/(\\s+)/).map(function(chunk){
      return (/^\\s+$/.test(chunk)) ? chunk : '<span class="lyric-word" data-word="1">' + escapeHtml(chunk) + '</span>';
    }).join('');
    lineEl.dataset.wordwrap = '1';
    return lineEl.querySelectorAll('.lyric-word');
  }
  // Pace a line's words from fromSec to toSec: each word is weighted by its
  // length so pacing feels spoken, but words are NEVER spread across a
  // trailing instrumental gap — that was the "the word highlight crawls and
  // sits on the wrong word" bug. The span is min(gap, natural singing length
  // at ~14 chars/sec), and once pacing ends the LAST word stays lit while the
  // line is still current, so an active line always has a lit word.
  function scPaceWords(lineEl, fromSec, toSec, nowSec){
    if(!lineEl) return;
    const words = scEnsureWordSpans(lineEl);
    if(!words.length) return;
    let totalWeight = 0;
    const weights = [];
    words.forEach(function(w){ const wt = Math.max(1, w.textContent.length); weights.push(wt); totalWeight += wt; });
    const gap = Math.max(0.3, toSec - fromSec);
    const natural = Math.max(0.4, totalWeight / 14 + 0.4);
    const pace = Math.min(gap, natural);
    let acc = 0, litIdx = -1;
    words.forEach(function(w, wi){
      const s = fromSec + (acc / totalWeight) * pace;
      acc += weights[wi];
      const e = fromSec + (acc / totalWeight) * pace;
      if(nowSec >= s && nowSec < e) litIdx = wi;
    });
    if(litIdx === -1 && nowSec >= fromSec + pace) litIdx = words.length - 1;
    words.forEach(function(w, wi){ w.classList.toggle('current', wi === litIdx); });
  }

  function formatSyncedLyrics(lrc) {`);

// ---- A1. synced-branch pacing uses the helper (capped) -------------------
rep('synced branch uses scPaceWords',
`          if (lyricsWordByWord && currentLine.dataset.wordline && !currentLine.dataset.inst) {
            const words = currentLine.querySelectorAll('.lyric-word');
            if (words.length > 0) {
              const nextLine = syncedLines[currentIdx + 1];
              const nextTime = nextLine ? parseFloat(nextLine.dataset.time) : Infinity;
              const lineTime = parseFloat(currentLine.dataset.time);
              const lineDuration = Math.max(0.3, nextTime - lineTime);
              // Weight word duration by character count for more natural pacing
              let totalWeight = 0;
              const wordWeights = [];
              words.forEach(w => { const wt = Math.max(1, w.textContent.length); wordWeights.push(wt); totalWeight += wt; });
              let accumulated = 0;
              words.forEach((w, wi) => {
                const wordStart = lineTime + (accumulated / totalWeight) * lineDuration;
                accumulated += wordWeights[wi];
                const wordEnd = lineTime + (accumulated / totalWeight) * lineDuration;
                w.classList.toggle('current', currentTime >= wordStart && currentTime < wordEnd); // wordLeadAdj
              });
            }
          }`,
`          if (lyricsWordByWord && currentLine.dataset.wordline && !currentLine.dataset.inst) {
            const nextLine = syncedLines[currentIdx + 1];
            const nextTime = nextLine ? parseFloat(nextLine.dataset.time) : NaN;
            const lineTime = parseFloat(currentLine.dataset.time);
            // Capped natural pacing; the last line gets a generous window so
            // its words still pace out instead of all lighting at once.
            const lineEnd = isFinite(nextTime) ? nextTime : (lineTime + 6);
            scPaceWords(currentLine, lineTime, lineEnd, currentTime);
          }`);

// ---- A2. unsynced branch: word-by-word works here too -------------------
rep('unsynced branch gains word pacing',
`          if (targetIdx !== lastLyricsIdx) {
            lastLyricsIdx = targetIdx;
            allLines.forEach(l => l.classList.remove('current'));
            allLines[targetIdx].classList.add('current');
            scrollLyricsToLine(container, allLines[targetIdx]);
          }`,
`          if (targetIdx !== lastLyricsIdx) {
            lastLyricsIdx = targetIdx;
            allLines.forEach(l => {
              l.classList.remove('current');
              l.querySelectorAll('.lyric-word').forEach(w => w.classList.remove('current'));
            });
            allLines[targetIdx].classList.add('current');
            scrollLyricsToLine(container, allLines[targetIdx]);
          }
          // Word-by-word on unsynced lyrics: pace the current line's words
          // across this line's proportional window — the same weight-based,
          // gap-capped pacing as synced lyrics, so the feature works on EVERY
          // song instead of only the ones that carry timestamps.
          if (lyricsWordByWord && audio.duration > 0 && allLines[targetIdx] && !allLines[targetIdx].dataset.inst) {
            const lineFrom = (targetIdx / allLines.length) * audio.duration;
            const lineTo = ((targetIdx + 1) / allLines.length) * audio.duration;
            scPaceWords(allLines[targetIdx], lineFrom, lineTo, currentTime);
          }`);

// ---- A3. tighter poll ----------------------------------------------------
rep('poll 80ms -> 50ms',
`    }, 80); // Fast enough for word-by-word: every word gets 2-3 polls`,
`    }, 50); // ~20 polls/s: line and word changes land within ~50ms of the beat`);

// ---- C. flight recorder: clear the import marker on completion -----------
rep('clear import marker after the sync pass',
`    if(added.length){
      saveMeta();`,
`    // The risky synchronous import pass is over — clear the flight-recorder
    // marker NOW. It used to stay set for the whole session, so ANY silent
    // kill (memory reclaim, swipe-away with no page events) within 5 minutes
    // of a SUCCESSFUL import came back next launch as the red "previously
    // crashed during: adding files to the library" banner. All paths below
    // are toasts and deferred prompts — nothing left that can crash-report.
    try{ if(window.__scMarkDone) __scMarkDone(); }catch(_eMark){}
    if(added.length){
      saveMeta();`);

rep('clear import marker on the CSV-only path',
`      if(audioFiles.length > 0){
        handleAudioFiles(audioFiles, targetPlaylist, opts);
      }
      return;`,
`      if(audioFiles.length > 0){
        handleAudioFiles(audioFiles, targetPlaylist, opts);
      } else {
        // Nothing audio-shaped in the batch — nothing left to crash-report.
        try{ if(window.__scMarkDone) __scMarkDone(); }catch(_eCsv){}
      }
      return;`);

rep('clear import marker on the failure path',
`   }catch(e){ console.error('Adding files failed', e); toast('Could not add files: ' + (e && e.message ? e.message : e), 5000); }`,
`   }catch(e){
    // The op ENDED (it failed) — a marker left behind would blame a later
    // silent kill on "adding files to the library".
    try{ if(window.__scMarkDone) __scMarkDone(); }catch(_eMarkDone){}
    console.error('Adding files failed', e); toast('Could not add files: ' + (e && e.message ? e.message : e), 5000);
   }`);

// ---- version + changelog -------------------------------------------------
const now = new Date();
let edt;
try{
  edt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true,
  }).format(now).replace(' at ', ' \u00b7 ');
}catch(e){ edt = '(date)'; }
const dateStr = `${edt} EDT`;
console.log(`  changelog date: ${dateStr}`);

rep('APP_VERSION bump', `const APP_VERSION = '60.4.6';`, `const APP_VERSION = '60.4.7';`);

rep('changelog entry',
`  const CHANGELOG = [
  { version: '60.4.6',`,
`  const CHANGELOG = [
  { version: '60.4.7', date: '${dateStr}', title: 'Word-by-word sings with the RGB glow · the crash banner was a false alarm', items: [
    'Word-by-word now works on EVERY song: plain lyrics without timestamps get their words paced too (they follow the song position like the line highlight does), instead of silently doing nothing.',
    'The lit word no longer crawls across instrumental gaps — words are paced over the natural singing length of the line (about 14 characters a second), so the highlight lands on the word being sung, with the last word holding until the next line.',
    'Toggling word-by-word gives the lit word the same glow the RGB themes animate: with an RGB mode selected the highlight sweeps with the whole app, in other themes it wears the theme colours.',
    'Tighter sync: the lyrics tracker now runs at 50ms instead of 80ms, so line and word changes land closer to the beat (the per-song +/-0.5s nudge still fine-tunes any source).',
    'The red "previously crashed during: adding files to the library" banner was a false alarm: the marker was never cleared after a SUCCESSFUL import, so any later silent kill got blamed on it. The marker now clears the moment adding finishes \u2014 the banner can only appear for a real crash during the import itself.',
  ],
  },
  { version: '60.4.6',`);

fs.writeFileSync(FILE, src);
console.log(failed ? `PATCH FAILED (${failed})` : `ALL PATCHES APPLIED (${applied})`);
if (failed) process.exitCode = 1;
