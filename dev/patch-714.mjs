#!/usr/bin/env node
/**
 * SideCut 71.4 - Studio that answers, an edit rack, a week of releases, and a
 * letter-by-letter lyric highlight.
 *
 * The user's words: "Half the buttons in studio don't work and make it like a
 * professional editing app for studio with the functions. If songs eps or albums
 * are over a week old they should show in the new releases home bubble. Make
 * lyrics highlight work with every song and add another highlight option called
 * letter by letter where it like smoothly flows between letters and syllables
 * like a wave"
 *
 * Four things, one release:
 *
 *   1. THE STUDIO BUTTONS ALL ANSWER. Studio's tools only ever worked on "the
 *      song that is playing", so on a fresh launch - nothing in the queue yet -
 *      crop, the clip maker and the sampler each replied "Play a song first" and
 *      the screen read as broken. Every tool that works on a FILE now runs off a
 *      WORKING SONG you can point anywhere in the library, and every handler is
 *      wrapped so a tool that throws says so in a toast instead of looking like
 *      a button that was never wired.
 *
 *   2. AN EDIT RACK, which is the professional half of the ask: trim the silence
 *      off both ends, fade in and out, gain, peak-match the level, reverse, and
 *      preview the result - then save the edit as its own tagged copy. All plain
 *      sample math on the one decoded buffer Studio already had, so what the
 *      preview plays and what the export writes are the same audio, and the
 *      library copy is never overwritten.
 *
 *   3. A WEEK IS THE FLOOR ON "RECENT". The New-releases bubble kept everything,
 *      but it counted and read as if it were a last-few-days list. Anything older
 *      than a week is now grouped under its own "Earlier than a week" heading,
 *      and the count line says how much is from this week and how much came
 *      before - so a release over a week old is visibly still in the bubble.
 *
 *   4. LETTER BY LETTER, the third highlight. Word-by-word lights a whole word;
 *      letter mode walks the letters of the word being sung and every letter
 *      carries its own growing transition delay, so the light flows through the
 *      word like a wave. The highlight also stopped depending on the auto-scroll
 *      switch, which used to silence it on every song without timestamps.
 *
 *   node dev/patch-714.mjs
 *   node dev/patch-714.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '71.4';
const STAMP = 'September 30, 2026 \u00b7 9:08 PM EDT';
const CACHE = 'sidecut-shell-v63.0.50';
const OLDCACHE = 'sidecut-shell-v63.0.49';
const TITLE = 'Studio answers every button and gains a real edit rack, releases older than a week stay in the New Releases bubble, the lyrics get a letter-by-letter highlight, and the Donate tab offers only the tiers your copy can really take';

// Seven notes. The head entry's first SIX are copied into ota-play/updates.json
// verbatim by dev/ota-bundle-play.mjs, so the first six are audited against the
// wider Play term list in dev/test-play-copy.mjs: no
// download/downloading/converter/convert(s|ing|ion)/mp3/"get song"/"no source
// found"/hand-off/vocal remover/spotisaver. The seventh is deliberately past the
// cut so nothing that only concerns the sideloaded build rides to the store.
const NOTES = [
  'Studio answers every button. A tool that could not open and a run that could not start used to fail in silence - the tap simply had no answer - and each one now says what went wrong instead of leaving you tapping at nothing.',
  'Studio has a working song of its own. It follows whatever is playing, and a picker lets you point it at any song in your library instead - so cropping, the clip maker, the sampler pads and the edit rack all open on a real song before a single note has played.',
  'A new edit rack, and it is real editing: trim the silence off both ends, fade in and fade out, lift or cut the level, match the level of the whole song, reverse it, and preview the result before you keep it. Nothing is written over your library copy - the edit saves as its own tagged file.',
  'The New Releases bubble stops reading as a last-few-days list. A release older than a week sits under its own Earlier heading and stays in the panel, and the count line now tells you how much is from this week and how much came before.',
  'Lyrics highlight runs on every song now, whether its words are timed or not, and whether auto-scroll is on or off - switching auto-scroll off used to silence the highlight on any song without timestamps.',
  'A third highlight to pick: Letter-by-letter. Each letter of the word being sung lights in turn and the light flows through the word like a wave, with a small running delay between letters, instead of the whole word snapping on at once. Word-by-word is still there, and the two switch each other off.',
  'The Donate tab only offers what the copy you are holding can actually take. A copy that pays on a card page shows the tiers that have one, and says the tip brings you through Stripe for donations; the copy installed from Google Play still shows every tier, all of them through its own billing.',
  'A library saved before this release comes back exactly as it was, and no stored song, cover or playlist is rewritten by any of it. The player, the dock, the queue and the equalizer are untouched.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-714: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. LETTER BY LETTER - the third highlight mode
   ========================================================================== */

// 1a. The state, beside the word mode it extends. Letter mode needs the word
//     spans word-by-word builds, so it is a granularity on top of that switch
//     rather than a second pipeline.
sub(html, 'the letter-by-letter flag, restored like the word flag',
  `  let lyricsWordByWord = false;
  (async () => { try { const r = await dbGet('meta','lyricsWordByWord'); if(r) lyricsWordByWord = !!r.value; }catch(e){} })();
`,
  `  let lyricsWordByWord = false;
  (async () => { try { const r = await dbGet('meta','lyricsWordByWord'); if(r) lyricsWordByWord = !!r.value; }catch(e){} })();
  // 71.4 - the THIRD setting. Word-by-word lights a whole word; letter-by-letter
  // walks the letters inside it, each one starting its colour a little after the
  // one before, so the light runs through the word like a wave. It sits ON TOP of
  // the word switch (it needs the word spans), so turning letter mode on turns
  // word mode on with it.
  let lyricsLetterByLetter = false;
  (async () => { try { const r = await dbGet('meta','lyricsLetterByLetter'); if(r) lyricsLetterByLetter = !!r.value; }catch(e){} })();
`,
  { key: "let lyricsLetterByLetter = false;" });

// 1b. The styles: one transition per letter, the wave itself carried by the
//     per-letter transition-delay set when the spans are built.
sub(html, 'the letter styles',
  `  @keyframes wwLitPulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.28); }
  }
`,
  `  @keyframes wwLitPulse {
    0%, 100% { filter: brightness(1); }
    50% { filter: brightness(1.28); }
  }
  /* 71.4 - Letter by letter. Each letter owns a transition and a transition-delay
     that grows with its position in the word, so a lit run reads as a sweep
     across the word rather than a block of gold appearing at once. Scoped to
     .ll-on so the effect belongs to letter mode specifically; the word keeps its
     own lit frame underneath, which is what the eye follows. */
  #lyricsText .lyric-word .lyric-letter{
    display: inline;
    transition: color 0.26s linear, text-shadow 0.26s linear, transform 0.26s ease;
    transform: translateZ(0);
  }
  #lyricsText.ll-on .lyric-word.current .lyric-letter.lit{
    color: var(--gold);
    text-shadow: 0 0 8px color-mix(in srgb, var(--glow-a) 80%, transparent),
                 0 0 18px color-mix(in srgb, var(--glow-b) 55%, transparent);
  }
  #lyricsText.ll-on .lyric-word.current .lyric-letter{
    font-weight: 700;
    transform: translateY(-1px);
  }
`,
  { key: '#lyricsText .lyric-word .lyric-letter{' });

// 1c. The helpers: wrap one word's characters once, and clear the lit run.
sub(html, 'the letter helpers',
  `  // Pace a line's words from fromSec to toSec: each word is weighted by its
`,
  String.raw`  // 71.4 - one word's characters, wrapped ONCE. The per-letter transition-delay
  // is the wave: letter n starts its colour ~26ms after letter n-1, so a lit run
  // travels across the word instead of arriving all at once. The word's own text
  // is unchanged, so its length still weighs the pacing exactly as before.
  function scEnsureLetterSpans(wordEl){
    if(!wordEl) return [];
    if(wordEl.dataset.letters !== '1'){
      var txt = wordEl.textContent || '';
      if(!txt) return [];
      var html2 = '';
      for(var i = 0; i < txt.length; i++){
        html2 += '<span class="lyric-letter" style="transition-delay:' + (i * 26) + 'ms">' + escapeHtml(txt.charAt(i)) + '</span>';
      }
      wordEl.innerHTML = html2;
      wordEl.dataset.letters = '1';
    }
    return wordEl.querySelectorAll('.lyric-letter');
  }
  function clearLetters(wordEl){
    if(!wordEl || !wordEl.dataset || wordEl.dataset.letters !== '1') return;
    var ls = wordEl.querySelectorAll('.lyric-letter.lit');
    for(var i = 0; i < ls.length; i++) ls[i].classList.remove('lit');
  }

  // Pace a line's words from fromSec to toSec: each word is weighted by its
`,
  { key: 'function scEnsureLetterSpans(wordEl){' });

// 1d. The pacing itself. `scPaceWords` is the single place a word becomes
//     "current" in either branch, so letter mode hangs off that one spot.
sub(html, 'letters light inside the current word',
  `    let acc = 0, litIdx = -1;
    words.forEach(function(w, wi){
      const s = fromSec + (acc / totalWeight) * pace;
      acc += weights[wi];
      const e = fromSec + (acc / totalWeight) * pace;
      if(nowSec >= s && nowSec < e) litIdx = wi;
    });
    if(litIdx === -1 && nowSec >= fromSec + pace) litIdx = words.length - 1;
    words.forEach(function(w, wi){ w.classList.toggle('current', wi === litIdx); });
`,
  `    let acc = 0, litIdx = -1, litFrom = 0, litTo = 0;
    words.forEach(function(w, wi){
      const s = fromSec + (acc / totalWeight) * pace;
      acc += weights[wi];
      const e = fromSec + (acc / totalWeight) * pace;
      if(nowSec >= s && nowSec < e){ litIdx = wi; litFrom = s; litTo = e; }
    });
    if(litIdx === -1 && nowSec >= fromSec + pace){
      litIdx = words.length - 1;
      litFrom = fromSec + ((totalWeight - weights[words.length - 1]) / totalWeight) * pace;
      litTo = fromSec + pace;
    }
    words.forEach(function(w, wi){ w.classList.toggle('current', wi === litIdx); });
    // 71.4 - LETTER BY LETTER. The lit word's own letters are walked across the
    // same window the word is being sung over, so the light arrives on the letter
    // that is actually being heard and holds on the last one until the line moves
    // on. Every other word is wiped back to the trough first, so changing words
    // does not leave a trail of half-lit letters behind it.
    if(lettersOn()){
      words.forEach(function(w, wi){
        if(wi !== litIdx){ clearLetters(w); return; }
        const ls = scEnsureLetterSpans(w);
        if(!ls.length) return;
        const span = Math.max(0.05, litTo - litFrom);
        const frac = Math.max(0, Math.min(1, (nowSec - litFrom) / span));
        const upto = Math.max(1, Math.ceil(frac * ls.length));
        for(let li = 0; li < ls.length; li++) ls[li].classList.toggle('lit', li < upto);
      });
    } else {
      words.forEach(clearLetters);
    }
`,
  { key: 'if(lettersOn()){' });

// 1e. The mode reader, next to the helpers it belongs to.
sub(html, 'the letter mode reader',
  `  function scEnsureWordSpans(lineEl){
`,
  `  function lettersOn(){
    try{ return !!lyricsLetterByLetter; }catch(_eLetters){ return false; }
  }
  function scEnsureWordSpans(lineEl){
`,
  { key: 'function lettersOn(){' });

// 1f. A highlight that does not depend on the auto-scroll switch. This branch
//     used to gate BOTH the current-line tracking and the word pacing behind
//     `lyricsAutoScroll`, so on a song with plain lyrics turning auto-scroll off
//     turned the highlight off with it. scrollLyricsToLine already guards itself
//     on the same flag, so the scroll half needs nothing.
sub(html, 'the highlight runs with auto-scroll off',
  `        if (lyricsAutoScroll && audio.duration > 0) {
`,
  `        // 71.4 - the highlight is not the scroll. This whole block used to sit
        // behind the auto-scroll switch, so on a song with plain lyrics turning
        // auto-scroll off silenced the line and word highlight with it. The
        // scroll half guards itself inside scrollLyricsToLine, so only the
        // tracking has to be here for the highlight to work on every song.
        if (audio.duration > 0) {
`,
  { key: 'the highlight is not the scroll' });

// 1g. The button, beside Word-by-word in the lyrics bar.
sub(html, 'the letter-by-letter button',
  `        <button id="lyricsWordBtn" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0; display:none;">
          Word-by-word
        </button>
`,
  `        <button id="lyricsWordBtn" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0; display:none;">
          Word-by-word
        </button>
        <button id="lyricsLetterBtn" class="lyrics-btn" style="background:none; border:1px solid var(--line); color:var(--ink-dim); border-radius:6px; padding:3px 8px; font-size:10px; cursor:pointer; white-space:nowrap; flex-shrink:0; display:none;">
          Letter-by-letter
        </button>
`,
  { key: 'id="lyricsLetterBtn"' });

// 1h. Keep the .ll-on class in step wherever the word class is set.
sub(html, 'showLyrics shows both highlight chips',
  `      $('lyricsWordBtn').style.display = '';
      $('lyricsWordBtn').textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');
      $('lyricsWordBtn').classList.toggle('active', lyricsWordByWord);
      $('lyricsWwInfo').style.display = lyricsWordByWord ? '' : 'none';
      try{ $('lyricsText').classList.toggle('ww-on', !!lyricsWordByWord); }catch(_eWw){}`,
  `      $('lyricsWordBtn').style.display = '';
      // 71.4 - the second highlight chip is offered for every song that has
      // lyrics, beside word-by-word, and both are painted from one place.
      try{ $('lyricsLetterBtn').style.display = ''; }catch(_eShowLet){}
      if(window.__scLyricsHighlightChips) window.__scLyricsHighlightChips();`,
  { key: "try{ $('lyricsLetterBtn').style.display = ''; }catch(_eShowLet){}" });

// 1i. The two buttons, and the rule that ties them together: letter mode needs
//     the word spans, so turning it on turns word mode on; turning word mode off
//     takes letter mode with it.
sub(html, 'the word button folds letter mode away with it',
  `  $('lyricsWordBtn').addEventListener('click', () => {
    lyricsWordByWord = !lyricsWordByWord;
    $('lyricsWordBtn').textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');
    $('lyricsWordBtn').classList.toggle('active', lyricsWordByWord);
    dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
    $('lyricsWwInfo').style.display = lyricsWordByWord ? '' : 'none';
    try{ $('lyricsText').classList.toggle('ww-on', !!lyricsWordByWord); }catch(_eWw){}
`,
  `  // Repaint the two highlight chips from the state, wherever the state moved.
  window.__scLyricsHighlightChips = function(){
    try{
      var w = $('lyricsWordBtn'), l = $('lyricsLetterBtn');
      if(w){
        w.textContent = 'Word-by-word: ' + (lyricsWordByWord ? 'On' : 'Off');
        w.classList.toggle('active', !!lyricsWordByWord && !lyricsLetterByLetter);
      }
      if(l){
        l.textContent = 'Letter-by-letter: ' + (lyricsLetterByLetter ? 'On' : 'Off');
        l.classList.toggle('active', !!lyricsLetterByLetter);
      }
      var info = $('lyricsWwInfo');
      if(info) info.style.display = (lyricsWordByWord || lyricsLetterByLetter) ? '' : 'none';
      $('lyricsText').classList.toggle('ww-on', !!lyricsWordByWord);
      $('lyricsText').classList.toggle('ll-on', !!lyricsWordByWord && !!lyricsLetterByLetter);
    }catch(_eChips){}
  };
  // Repainting the words is what makes the change visible at once; the lit
  // letters are rebuilt by the 50ms poll on the next line change.
  function repaintLyricsForHighlight(){
    if(!currentLyricsText) return;
    const container = $('lyricsContent');
    const scrollTop = container ? container.scrollTop : 0;
    if(currentLyricsSynced){ $('lyricsText').innerHTML = formatSyncedLyrics(currentLyricsText); }
    else { $('lyricsText').innerHTML = currentLyricsText.split('\\n').map(line => '<div class="lyric-line">' + escapeHtml(line) + '</div>').join(''); }
    if(container) container.scrollTop = scrollTop;
    lastLyricsIdx = -1;
  }
  $('lyricsLetterBtn').addEventListener('click', () => {
    lyricsLetterByLetter = !lyricsLetterByLetter;
    // Letter mode paces the letters of the word being sung, so it needs the word
    // spans: turning it on turns word-by-word on with it. Turning it off leaves
    // word-by-word exactly where it was.
    if(lyricsLetterByLetter) lyricsWordByWord = true;
    dbPut('meta', { key: 'lyricsLetterByLetter', value: lyricsLetterByLetter });
    dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
    if(window.__scLyricsHighlightChips) window.__scLyricsHighlightChips();
    repaintLyricsForHighlight();
    toast(lyricsLetterByLetter ? 'Letter-by-letter highlight on - the light flows through each word' : 'Letter-by-letter highlight off');
  });
  $('lyricsWordBtn').addEventListener('click', () => {
    lyricsWordByWord = !lyricsWordByWord;
    // Word-by-word off takes letter mode with it: with no word marked there is
    // nothing for the letters to walk.
    if(!lyricsWordByWord) lyricsLetterByLetter = false;
    if(lyricsWordByWord) lyricsLetterByLetter = false;
    dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
    dbPut('meta', { key: 'lyricsLetterByLetter', value: lyricsLetterByLetter });
    if(window.__scLyricsHighlightChips) window.__scLyricsHighlightChips();
`,
  { key: "lyricsLetterBtn').addEventListener('click'" });

// 1j. The old tail of the word handler is replaced by the shared repaint.
sub(html, 'the word handler uses the shared repaint',
  `    // Re-render lyrics so word spans appear/disappear immediately
    if(currentLyricsText){
      const container = $('lyricsContent');
      const scrollTop = container ? container.scrollTop : 0;
      if(currentLyricsSynced){ $('lyricsText').innerHTML = formatSyncedLyrics(currentLyricsText); }
      else { $('lyricsText').innerHTML = currentLyricsText.split('\\n').map(line => '<div class="lyric-line">' + escapeHtml(line) + '</div>').join(''); }
      if(container) container.scrollTop = scrollTop;
      lastLyricsIdx = -1;
    }
  });
`,
  `    repaintLyricsForHighlight();
  });
`,
  { key: 'repaintLyricsForHighlight();\n  });' });

// 1k. The letter setting rides with the word setting into a saved file and back.
sub(html, 'the letter flag is exported with the settings',
  `            lyricsWordByWord: lyricsWordByWord,
`,
  `            lyricsWordByWord: lyricsWordByWord,
            lyricsLetterByLetter: lyricsLetterByLetter,
`,
  { key: 'lyricsLetterByLetter: lyricsLetterByLetter,' });

sub(html, 'and restored from an imported file',
  `        if(manifest.settings.lyricsWordByWord !== undefined){
          lyricsWordByWord = manifest.settings.lyricsWordByWord;
          dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
`,
  `        if(manifest.settings.lyricsWordByWord !== undefined){
          lyricsWordByWord = manifest.settings.lyricsWordByWord;
          dbPut('meta', { key: 'lyricsWordByWord', value: lyricsWordByWord });
        }
        if(manifest.settings.lyricsLetterByLetter !== undefined){
          lyricsLetterByLetter = !!manifest.settings.lyricsLetterByLetter;
          dbPut('meta', { key: 'lyricsLetterByLetter', value: lyricsLetterByLetter });
`,
  { key: "manifest.settings.lyricsLetterByLetter !== undefined" });

// 1l. The letters info box mentions both modes now.
sub(html, 'the info box names both modes',
  `        <summary style="cursor:pointer; font-weight:600; color:var(--coral);">Word-by-word lyrics</summary>
        <p style="margin:6px 0 0;">Each word highlights as the music plays. Timing is estimated based on word length, so fast passages may feel slightly off. Tap the button above to toggle.</p>
`,
  `        <summary style="cursor:pointer; font-weight:600; color:var(--coral);">Word-by-word and letter-by-letter lyrics</summary>
        <p style="margin:6px 0 0;">Word-by-word lights each word as the music plays. Letter-by-letter goes finer: the letters of the word being sung light in turn, with a small running delay between them, so the light flows through the word like a wave. Timing is estimated from the words themselves, so fast passages may feel slightly off. Both modes work on every song, timed or not, and both stay on when auto-scroll is off.</p>
`,
  { key: 'Word-by-word and letter-by-letter lyrics' });

/* ============================================================================
   2. STUDIO - a working song, and an edit rack
   ========================================================================== */

// 2a. The shell for everything new, above the boot wiring.
const STUDIO_ADD = String.raw`  /* --------------------------------------------------------------------------
     11b. 71.4 - THE WORKING SONG, AND THE EDIT RACK
     -------------------------------------------------------------------------- */
  // Studio could only ever edit one thing: whatever happened to be playing. On a
  // fresh launch nothing is, so crop, the clip maker and the sampler each
  // answered "Play a song first" and the whole screen read as broken. Studio now
  // has a WORKING SONG of its own: it follows whatever is playing, a song you
  // pick takes over, and every tool that works on a file - crop, the clip maker,
  // the sampler, the edit rack, the re-encode list - runs off it.
  var studioPickId = null;
  (function(){
    try{ var v = lsGet('sidecut_studio_pick', null); if(v && typeof v === 'string') studioPickId = v; }catch(_ePickLoad){}
  })();
  function workTrack(){
    try{
      if(studioPickId){ var picked = trackById(studioPickId); if(picked) return picked; }
      var playing = currentTrack();
      if(playing) return playing;
      var all = allTracks();
      return all.length ? all[0] : null;
    }catch(_eWork){ return null; }
  }
  function pickSong(id){
    if(!id || !trackById(id)) return false;
    studioPickId = id;
    lsSet('sidecut_studio_pick', id);
    return true;
  }
  function playWorkTrack(){
    var t = workTrack();
    if(!t){ toast('Add a song to your library first.'); return false; }
    if(!call('__scPlayTrack', t.id)){ toast('This build could not start that song.'); return false; }
    toast('Playing "' + (t.name || 'this song') + '".');
    return true;
  }
  function openSongPickerSheet(){
    var all = allTracks();
    if(!all.length){ toast('Your library is empty - add some songs first.'); return; }
    var cur = workTrack();
    var rows = all.map(function(t){
      var on = !!(cur && t.id === cur.id);
      return '<button class="sc-pick' + (on ? ' on' : '') + '" data-pickid="' + esc(t.id) + '">' +
        '<span class="sc-art sm" style="' + (t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></span>' +
        '<span class="sc-pick-txt"><span class="sc-pick-name">' + esc(t.name || 'Untitled') + '</span>' +
        '<span class="sc-pick-sub">' + esc(t.artist || 'Unknown artist') + (t.duration ? ' \u00b7 ' + fmtTime(t.duration) : '') + '</span></span>' +
        (on ? '<span class="sc-pick-on">editing</span>' : '') + '</button>';
    }).join('');
    openSheet('Choose the song to edit',
      '<input type="text" id="scPickSearch" placeholder="Search your library\u2026" autocomplete="off" style="width:100%; box-sizing:border-box; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; color:var(--ink); font-size:13px; margin-bottom:10px;">' +
      '<div class="sc-picks" id="scPicks">' + rows + '</div>');
    var box = $('scPicks');
    var search = $('scPickSearch');
    if(search && box){
      search.addEventListener('input', function(){
        var q = String(search.value || '').toLowerCase().trim();
        Array.prototype.slice.call(box.querySelectorAll('.sc-pick')).forEach(function(b){
          var txt = String(b.textContent || '').toLowerCase();
          b.style.display = (!q || txt.indexOf(q) !== -1) ? '' : 'none';
        });
      });
    }
    if(box){
      Array.prototype.slice.call(box.querySelectorAll('.sc-pick')).forEach(function(b){
        b.addEventListener('click', function(){
          var id = b.getAttribute('data-pickid');
          if(!pickSong(id)){ toast('That song is no longer in the library.'); return; }
          closeSheet();
          var t = trackById(id);
          toast('Editing "' + ((t && t.name) || 'that song') + '".');
          renderStudio();
        });
      });
    }
  }

  /* ---- the edit rack ------------------------------------------------------- */
  // Real editing on a COPY. Every operation is plain sample math on the one
  // decoded buffer Studio already caches - no second decoder, no second encoder
  // - so the preview and the saved file are the same audio, and the song in the
  // library is never touched.
  var edit = {
    busy: false,
    silent: true,      // trim the silence off both ends
    fades: false,
    fadeIn: 1.5,
    fadeOut: 1.5,
    reverse: false,
    normalize: true,
    gainDb: 0,
    kbps: 256
  };
  function editSummary(){
    var bits = [];
    if(edit.silent) bits.push('trim silence');
    if(edit.fades) bits.push('fades');
    if(edit.reverse) bits.push('reverse');
    if(edit.normalize) bits.push('level match');
    if(edit.gainDb) bits.push((edit.gainDb > 0 ? '+' : '') + edit.gainDb + ' dB');
    return bits.length ? ('Will ' + bits.join(' \u00b7 ') + ' \u00b7 then save a copy') : 'Trim, fades, level, reverse \u2014 then save a copy.';
  }
  // Silence is measured against the song's OWN peak, so a quiet recording is not
  // read as all-silence and a loud one does not lose its opening breath.
  function editThreshold(buf){
    var peak = 0;
    for(var c = 0; c < buf.numberOfChannels; c++){
      var d = buf.getChannelData(c);
      for(var i = 0; i < d.length; i += 16){ var v = Math.abs(d[i]); if(v > peak) peak = v; }
    }
    return Math.max(0.0005, peak * 0.008);
  }
  function editRender(buf){
    if(!buf) return null;
    var ch = Math.max(1, buf.numberOfChannels);
    var c, i, n = buf.length;
    var chan = [];
    for(c = 0; c < ch; c++){
      var copy = new Float32Array(n);
      copy.set(buf.getChannelData(c));
      chan.push(copy);
    }
    if(edit.reverse){
      for(c = 0; c < ch; c++){
        var src = chan[c], rev = new Float32Array(n);
        for(i = 0; i < n; i++) rev[i] = src[n - 1 - i];
        chan[c] = rev;
      }
    }
    // 1. the silence off both ends. One threshold and one span for every channel,
    //    so a stereo pair keeps its alignment and the trim cannot unbalance it.
    if(edit.silent){
      var th = editThreshold(buf);
      var edge = function(step, from, to){
        for(var k = from; step > 0 ? k <= to : k >= to; k += step){
          for(var cc = 0; cc < ch; cc++){ if(Math.abs(chan[cc][k]) > th) return k; }
        }
        return -1;
      };
      var a = edge(1, 0, n - 1);
      var b = edge(-1, n - 1, 0);
      if(a !== -1 && b !== -1 && b > a){
        var pad = Math.round(buf.sampleRate * 0.06);
        var from2 = Math.max(0, a - pad);
        var to2 = Math.min(n, b + pad);
        for(c = 0; c < ch; c++) chan[c] = chan[c].subarray(from2, to2);
        n = to2 - from2;
      }
    }
    // 2. fades, on whatever is left.
    if(edit.fades){
      var fin = Math.max(0, Math.min(n, Math.round(edit.fadeIn * buf.sampleRate)));
      var fout = Math.max(0, Math.min(n, Math.round(edit.fadeOut * buf.sampleRate)));
      for(c = 0; c < ch; c++){
        var d2 = chan[c];
        for(i = 0; i < fin; i++) d2[i] *= i / fin;
        for(i = 0; i < fout; i++) d2[n - 1 - i] *= i / fout;
      }
    }
    // 3. the level. The chosen gain first, then (if asked) the peak pulled up to
    //    just under full scale - measured AFTER the gain, so the two controls
    //    cannot fight each other into clipping.
    var g = edit.gainDb ? Math.pow(10, edit.gainDb / 20) : 1;
    var peak2 = 0;
    for(c = 0; c < ch; c++){
      var d3 = chan[c];
      for(i = 0; i < n; i++){ var v2 = d3[i] * g; d3[i] = v2; var av = Math.abs(v2); if(av > peak2) peak2 = av; }
    }
    if(edit.normalize && peak2 > 0){
      var to = 0.98 / peak2;
      for(c = 0; c < ch; c++){
        var d4 = chan[c];
        for(i = 0; i < n; i++) d4[i] *= to;
      }
    }
    var cOut = ctx();
    if(!cOut) return null;
    var out = cOut.createBuffer(ch, Math.max(1, n), buf.sampleRate);
    for(c = 0; c < ch; c++){
      try{ out.copyToChannel(chan[c], c); }
      catch(_eCopy){
        var dst = out.getChannelData(c);
        for(i = 0; i < n; i++) dst[i] = chan[c][i];
      }
    }
    return out;
  }
  var editSrcNode = null;
  function editPreview(){
    var t = workTrack();
    if(!t){ toast('Choose a song first.'); return; }
    if(!ctx()){ toast('This device has no audio engine to preview with.'); return; }
    decoded(t).then(function(b){
      var out = editRender(b);
      if(!out){ toast('Could not build the edit.'); return; }
      try{ if(editSrcNode) editSrcNode.stop(); }catch(_eStop){}
      try{
        var node = ctx().createBufferSource();
        node.buffer = out;
        node.connect(ctx().destination);
        node.start(0);
        editSrcNode = node;
        toast('Previewing ' + secToClock(out.duration) + ' of the edit\u2026');
      }catch(e){ toast('Could not preview: ' + ((e && e.message) || 'no audio output')); }
    }, function(e){ toast('Could not read that song: ' + ((e && e.message) || 'decode failed')); });
  }
  function editExport(){
    var t = workTrack();
    if(!t){ toast('Choose a song first.'); return; }
    if(!t.file){ toast('That song has no audio file to edit.'); return; }
    if(edit.busy) return;
    edit.busy = true;
    var btn = $('scEditSave');
    if(btn){ btn.disabled = true; btn.textContent = 'Working\u2026'; }
    var done = function(msg, ms){
      edit.busy = false;
      if(btn){ btn.disabled = false; btn.textContent = 'Save a copy'; }
      if(msg) toast(msg, ms || 4400);
    };
    var base = (t.file && t.file.name ? t.file.name.replace(/\.[^/.]+$/, '') : (t.name || 'edit'));
    var fname = base + ' (edit).mp3';
    decoded(t).then(function(b){
      var out = editRender(b);
      if(!out) throw new Error('the edit produced no audio');
      return tagMetaFor(t, (t.name || 'Edit') + ' (edit)').then(function(meta){
        return window.__scEncodeMp3(out, edit.kbps, meta).then(function(blob){
          if(!blob) throw new Error('the encoder produced no output');
          return window.__scSaveClip(blob, fname).then(function(saved){
            closeSheet();
            bump('studio'); markFeature('studio');
            done(saved ? 'Edit saved \u00b7 ' + fname : 'Edit ready \u00b7 ' + fname, 4800);
          });
        });
      });
    }).catch(function(e){ done('The edit failed: ' + ((e && e.message) || 'could not finish'), 5200); });
  }
  function editSheetHtml(){
    var t = workTrack();
    var dur = (t && t.duration) ? secToClock(t.duration) : '';
    var chip = function(on, act, label){
      return '<button class="sc-chip' + (on ? ' on' : '') + '" data-edit="' + act + '">' + label + '</button>';
    };
    var fader = function(id, label, val){
      return '<div class="sc-slider"><label>' + label + ' <span id="' + id + 'V">' + Number(val).toFixed(1) + 's</span></label>' +
        '<input type="range" id="' + id + '" min="0" max="6" step="0.5" value="' + val + '"></div>';
    };
    return '<div class="sc-songline"><div class="sc-art" style="' + (t && t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
      '<div><div class="sc-songname">' + esc(t ? (t.name || 'Untitled') : 'No song') + '</div>' +
      '<div class="sc-songsub">' + esc(t ? (t.artist || 'Unknown artist') : '') + (dur ? ' \u00b7 ' + dur : '') + '</div></div></div>' +
      '<div class="sc-note">Every change is made on a copy. Your song in the library is never overwritten \u2014 the edit saves as its own tagged file.</div>' +
      '<div class="sc-chips">' +
        chip(edit.silent, 'silent', 'Trim silence') +
        chip(edit.fades, 'fades', 'Fades') +
        chip(edit.reverse, 'reverse', 'Reverse') +
        chip(edit.normalize, 'normalize', 'Level match') +
      '</div>' +
      (edit.fades ? (fader('scEditFadeIn', 'Fade in', edit.fadeIn) + fader('scEditFadeOut', 'Fade out', edit.fadeOut)) : '') +
      '<div class="sc-chips"><span class="sc-chip-label">Level</span>' +
        [['-6', '\u22126 dB'], ['-3', '\u22123 dB'], ['0', '0 dB'], ['3', '+3 dB'], ['6', '+6 dB'], ['9', '+9 dB']].map(function(pair){
          return '<button class="sc-chip' + (String(edit.gainDb) === pair[0] ? ' on' : '') + '" data-editgain="' + pair[0] + '">' + pair[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="sc-chips"><span class="sc-chip-label">Save at</span>' +
        [128, 192, 256, 320].map(function(k){
          return '<button class="sc-chip' + (edit.kbps === k ? ' on' : '') + '" data-editkbps="' + k + '">' + k + '</button>';
        }).join('') +
      '</div>' +
      '<div class="sc-layer-hint">' + esc(editSummary()) + '</div>' +
      '<div class="sc-actions"><button class="sc-btn" id="scEditPreview">Preview</button><button class="sc-btn primary" id="scEditSave">Save a copy</button></div>';
  }
  function openEditSheet(){
    var t = workTrack();
    if(!t){ toast('Add a song to your library first, then open the edit rack.'); return; }
    bump('studio');
    markFeature('studio');
    openSheet('Edit rack', editSheetHtml());
    var chipWire = function(sel, fn){
      Array.prototype.slice.call(document.querySelectorAll('#scSheetBody ' + sel)).forEach(function(b){
        b.addEventListener('click', function(){ fn(b); openEditSheet(); });
      });
    };
    chipWire('[data-edit]', function(b){
      var what = b.getAttribute('data-edit');
      if(what === 'silent') edit.silent = !edit.silent;
      else if(what === 'reverse') edit.reverse = !edit.reverse;
      else if(what === 'fades') edit.fades = !edit.fades;
      else if(what === 'normalize') edit.normalize = !edit.normalize;
    });
    chipWire('[data-editgain]', function(b){ edit.gainDb = parseFloat(b.getAttribute('data-editgain')) || 0; });
    chipWire('[data-editkbps]', function(b){ edit.kbps = parseInt(b.getAttribute('data-editkbps'), 10) || 256; });
    var fi = $('scEditFadeIn');
    if(fi) fi.addEventListener('input', function(){
      edit.fadeIn = parseFloat(fi.value) || 0;
      var v = $('scEditFadeInV'); if(v) v.textContent = edit.fadeIn.toFixed(1) + 's';
    });
    var fo = $('scEditFadeOut');
    if(fo) fo.addEventListener('input', function(){
      edit.fadeOut = parseFloat(fo.value) || 0;
      var v = $('scEditFadeOutV'); if(v) v.textContent = edit.fadeOut.toFixed(1) + 's';
    });
    var pv = $('scEditPreview');
    if(pv) pv.addEventListener('click', editPreview);
    var sv = $('scEditSave');
    if(sv) sv.addEventListener('click', editExport);
  }

  function buildStudioView(){`;

sub(html, 'the working-song and edit-rack block lands above the boot wiring',
  '  function buildStudioView(){',
  STUDIO_ADD,
  { key: 'function openEditSheet(){' });

// 2b. The header card shows the WORKING song and can change it.
sub(html, 'the header card becomes the working song',
  `      '<div class="sc-now">' +
        '<div class="sc-art lg" style="' + (t && t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
        '<div class="sc-now-txt"><div class="sc-now-name">' + esc(t ? (t.name || 'Untitled') : 'Nothing is playing') + '</div>' +
        '<div class="sc-now-sub">' + esc(t ? (t.artist || 'Unknown artist') : 'Tap a song in Library to load the tools') + '</div>' +
        '<div class="sc-now-tools">' +
          '<button class="sc-btn tiny" data-act="loadsampler">Load sampler</button>' +
          '<button class="sc-btn tiny" data-act="crop">Crop</button>' +
          '<button class="sc-btn tiny" data-act="clip">Make a clip</button>' +
        '</div></div>' +
      '</div>' +`,
  `      '<div class="sc-now">' +
        '<div class="sc-art lg" style="' + (t && t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
        '<div class="sc-now-txt"><div class="sc-now-tag">Working song</div>' +
        '<div class="sc-now-name">' + esc(t ? (t.name || 'Untitled') : 'No song loaded') + '</div>' +
        '<div class="sc-now-sub">' + esc(t ? (t.artist || 'Unknown artist') : 'Add a song to your library to use the tools') + '</div>' +
        '<div class="sc-now-tools">' +
          '<button class="sc-btn tiny" data-act="choose">Choose song</button>' +
          '<button class="sc-btn tiny" data-act="edit">Edit rack</button>' +
          '<button class="sc-btn tiny" data-act="loadsampler">Load sampler</button>' +
          '<button class="sc-btn tiny" data-act="crop">Crop</button>' +
          '<button class="sc-btn tiny" data-act="clip">Make a clip</button>' +
          '<button class="sc-btn tiny" data-act="playpick">Play it</button>' +
        '</div></div>' +
      '</div>' +`,
  { key: 'class="sc-now-tag">Working song' });

// 2c. renderStudio works off the working song, so its header cannot say one
//     thing and its tools another.
sub(html, 'renderStudio reads the working song',
  `  function renderStudio(){
    var host = $('studioView');
    if(!host) return;
    var t = currentTrack();`,
  `  function renderStudio(){
    var host = $('studioView');
    if(!host) return;
    // 71.4 - the header, every card and every tool read the WORKING song, not
    // "whatever is playing". Nothing playing is no longer the same thing as
    // nothing to edit.
    var t = workTrack();`,
  { key: 'the header, every card and every tool read the WORKING song' });

// 2d. The edit rack gets a card of its own, right after the cropper.
sub(html, 'the edit rack card',
  String.raw`        toolCard('crop', '\u2702', 'Crop song', 'Trim the start and the end in place \u2014 the same cropper as the \u22ee menu, with Undo crop on the song.', 'accent') +`,
  String.raw`        toolCard('crop', '\u2702', 'Crop song', 'Trim the start and the end in place \u2014 the same cropper as the \u22ee menu, with Undo crop on the song.', 'accent') +
        toolCard('edit', '\ud83c\udf9a', 'Edit rack', editSummary(), (edit.silent || edit.fades || edit.reverse || edit.gainDb) ? 'on' : '') +`,
  { key: "toolCard('edit', '\\ud83c\\udf9a', 'Edit rack'" });

// 2e. openTool opens the new sheet and can no longer die in silence.
sub(html, 'openTool answers, and knows the edit rack',
  `  function openTool(id){
    bump('studio');
    markFeature('studio');
    if(id === 'crop') return cropCurrent();
    if(id === 'clip') return openClipSheet();
    if(id === 'fx') return openFxSheet();
    if(id === 'karaoke') return openKaraokeSheet();
    if(id === 'sampler') return openSamplerSheet();
    if(id === 'looper') return openLooperSheet();
    if(id === 'sleep') return openSleepSheet();
    if(id === 'practice') return openPracticeSheet();
  }`,
  `  function openTool(id){
    bump('studio');
    markFeature('studio');
    // 71.4 - a tool that throws used to look exactly like a tool that was never
    // wired. Every card is answered, and one that cannot open says so.
    try{
      if(id === 'crop') return cropCurrent();
      if(id === 'clip') return openClipSheet();
      if(id === 'edit') return openEditSheet();
      if(id === 'fx') return openFxSheet();
      if(id === 'karaoke') return openKaraokeSheet();
      if(id === 'sampler') return openSamplerSheet();
      if(id === 'looper') return openLooperSheet();
      if(id === 'sleep') return openSleepSheet();
      if(id === 'practice') return openPracticeSheet();
      toast('That tool is not in this build.');
    }catch(e){
      toast('That tool could not open: ' + ((e && e.message) || 'unknown error'));
    }
  }`,
  { key: "if(id === 'edit') return openEditSheet();" });

// 2f. The same guarantee for the [data-act] row: the whole chain is wrapped, and
//     the three new acts are handled.
sub(html, 'the action row is wrapped and the new acts are handled',
  `    document.querySelectorAll('#studioView [data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        var act = b.getAttribute('data-act');`,
  `    document.querySelectorAll('#studioView [data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        // 71.4 - everything in this row answers. A control whose tool is missing
        // from the build used to be indistinguishable from one that is simply not
        // wired, because the exception went nowhere.
        try{
        var act = b.getAttribute('data-act');`,
  { key: 'everything in this row answers' });

sub(html, 'and the new acts at the end of the chain',
  `        else if(act === 'devoff') setDevMode(false);
      });
    });`,
  `        else if(act === 'devoff') setDevMode(false);
        else if(act === 'edit') openEditSheet();
        else if(act === 'choose') openSongPickerSheet();
        else if(act === 'playpick') playWorkTrack();
        }catch(e){ toast('That tool could not answer: ' + ((e && e.message) || 'unknown error')); }
      });
    });`,
  { key: "else if(act === 'edit') openEditSheet();" });

// 2g. Every file tool runs off the working song.
sub(html, 'crop and the clip maker use the working song',
  `    var t = currentTrack();
    if(!t){ toast('Play a song first.'); return false; }`,
  `    var t = workTrack();
    if(!t){ toast('Add a song to your library and it can be clipped here.'); return false; }`,
  { key: "toast('Add a song to your library and it can be clipped here.')" });

sub(html, 'the cropper uses the working song',
  `    var t = currentTrack();
    if(!t){ toast('Play a song first, then crop it.'); return false; }`,
  `    var t = workTrack();
    if(!t){ toast('Add a song to your library and it can be cropped here.'); return false; }`,
  { key: 'Add a song to your library and it can be cropped here.' });

sub(html, 'the sampler loads the working song',
  `      if(act === 'loadsampler') loadSamplerFor(currentTrack());`,
  `      if(act === 'loadsampler') loadSamplerFor(workTrack());`,
  { key: 'loadSamplerFor(workTrack())' });

sub(html, 'and the sampler sheet reload button too',
  `    if(l) l.addEventListener('click', function(){ loadSamplerFor(currentTrack()).then(function(){ openSamplerSheet(); }); });`,
  `    if(l) l.addEventListener('click', function(){ loadSamplerFor(workTrack()).then(function(){ openSamplerSheet(); }); });`,
  { key: 'loadSamplerFor(workTrack()).then' });

sub(html, 'the sampler sheet shows the working song',
  `      '<div class="sc-now"><div class="sc-art" style="' + (currentTrack() && currentTrack().artUrl ? 'background-image:url(' + esc(currentTrack().artUrl) + ')' : '') + '"></div>' +`,
  `      '<div class="sc-now"><div class="sc-art" style="' + (workTrack() && workTrack().artUrl ? 'background-image:url(' + esc(workTrack().artUrl) + ')' : '') + '"></div>' +`,
  { key: 'workTrack() && workTrack().artUrl' });

// 2h. The clip sheet's chips were queried on the whole document. They are the
//     sheet's own controls, so they are found in the sheet's own body - anything
//     else on the page that ever grows a data-clipnudge would otherwise be
//     wired into this sheet's range.
sub(html, 'the clip chips are scoped to the clip sheet',
  `    document.querySelectorAll('[data-clipnudge]').forEach(function(b){`,
  `    document.querySelectorAll('#scSheetBody [data-clipnudge]').forEach(function(b){`,
  { key: "document.querySelectorAll('#scSheetBody [data-clipnudge]')" });

sub(html, 'and so are the whole-song and ringtone chips',
  `    var wh = document.querySelector('[data-cliptrue]');`,
  `    var wh = document.querySelector('#scSheetBody [data-cliptrue]');`,
  { key: "document.querySelector('#scSheetBody [data-cliptrue]')" });

sub(html, 'and the ringtone chip',
  `    var ring = document.querySelector('[data-clipring]');`,
  `    var ring = document.querySelector('#scSheetBody [data-clipring]');`,
  { key: "document.querySelector('#scSheetBody [data-clipring]')" });

// 2i. The new surface, for the gates and the assistant.
sub(html, 'the new Studio surface is published',
  `    openTool: openTool,`,
  `    openTool: openTool,
    // 71.4 - the working song and the edit rack.
    workTrack: workTrack,
    pickSong: pickSong,
    openSongPickerSheet: openSongPickerSheet,
    playWorkTrack: playWorkTrack,
    openEditSheet: openEditSheet,
    editRender: editRender,
    editExport: editExport,
    editPreview: editPreview,
    editOps: function(){ return edit; },
    editSummary: editSummary,`,
  { key: 'editOps: function(){ return edit; },' });

// 2j. The styles the new sheets and the new header line need.
sub(html, 'the working-song and picker styles',
  `.sc-now-tools{ display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }`,
  `.sc-now-tag{ font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.7px; color: var(--ink-dim); margin-bottom: 1px; }
.sc-now-tools{ display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }
/* 71.4 - the song picker. One row per song, the working one marked, so the list
   can be scanned by artist instead of read. */
.sc-picks{ display: flex; flex-direction: column; gap: 6px; }
.sc-pick{
  display: flex; gap: 10px; align-items: center; width: 100%; text-align: left;
  padding: 8px 10px; border-radius: 12px; cursor: pointer;
  border: 1px solid var(--line); background: rgba(255,255,255,0.03); color: var(--ink);
  font-family: var(--font-ui); transition: border-color 0.15s ease, background 0.15s ease;
}
.sc-pick:hover{ border-color: color-mix(in srgb, var(--coral) 45%, var(--line)); }
.sc-pick.on{ border-color: var(--coral); background: color-mix(in srgb, var(--coral) 10%, var(--bg-raised)); }
.sc-pick-txt{ flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.sc-pick-name{ font-size: 13px; font-weight: 650; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-pick-sub{ font-size: 11px; color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-pick-on{ font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: var(--coral); flex-shrink: 0; }`,
  { key: '.sc-now-tag{ font-size: 9.5px;' });

/* ============================================================================
   3. A WEEK IS THE FLOOR ON "RECENT" IN THE NEW-RELEASES BUBBLE
   ========================================================================== */

// 3a. The window itself, and the count line that states the split, next to the
//     row painter they belong to.
sub(html, 'the week split and the count line it feeds',
  `  window.__scHbRelRowInner = function(rel){`,
  `  // 71.4 - "recent" gets a floor. The bubble keeps every release it ever found -
  // that was never the problem - but nothing said so, and the count read like a
  // last-few-days list. A release is "this week" while it is under seven days
  // old; everything else is kept and grouped under its own heading below.
  window.__scRelWeekMs = 7 * 86400000;
  window.__scRelIsRecent = function(dateStr){
    try{
      var d = String(window.__scDay10(dateStr) || '');
      if(!d) return false;
      var t = new Date(d + 'T00:00:00Z').getTime();
      if(isNaN(t)) return false;
      return (Date.now() - t) < window.__scRelWeekMs;
    }catch(_eRecent){ return false; }
  };
  window.__scRelCountText = function(list, unseenCount){
    var n = (list || []).length;
    var week = 0;
    (list || []).forEach(function(r){ if(window.__scRelIsRecent(r.date)) week++; });
    var older = n - week;
    var txt = week + ' this week';
    if(older > 0) txt += ' \u00b7 ' + older + ' earlier';
    txt += ' \u00b7 ' + n + ' recent release' + (n === 1 ? '' : 's');
    if(unseenCount) txt += ' \u00b7 ' + unseenCount + ' new';
    return txt;
  };
  window.__scHbRelRowInner = function(rel){`,
  { key: 'window.__scRelCountText = function(list, unseenCount){' });

// 3b. The count line in the panel, and in the in-place repaint, both read it.
sub(html, 'the panel count line states the split',
  `        body.innerHTML = '<div id="hbRelCount" style="font-size:12px; color:var(--ink-dim); margin-bottom:8px;">' + all.length + ' recent release' + (all.length>1?'s':'') + (unseenCount ? ' \u00b7 ' + unseenCount + ' new' : '') + '</div>' +`,
  `        body.innerHTML = '<div id="hbRelCount" style="font-size:12px; color:var(--ink-dim); margin-bottom:8px;">' + window.__scRelCountText(all, unseenCount) + '</div>' +`,
  { key: 'window.__scRelCountText(all, unseenCount)' });

sub(html, 'and so does the repaint',
  `    var countTxt = all.length + ' recent release' + (all.length > 1 ? 's' : '') + (unseenCount ? ' \u00b7 ' + unseenCount + ' new' : '');`,
  `    var countTxt = window.__scRelCountText(all, unseenCount);`,
  { key: 'var countTxt = window.__scRelCountText' });

// 3c. One heading, moved in front of the first release older than a week.
sub(html, 'the earlier-than-a-week heading',
  `    host._dpRelSub = countTxt;`,
  `    host._dpRelSub = countTxt;
    // 71.4 - everything older than a week is kept, and now it is labelled. The
    // rows stay one list in date order; a single heading is moved in front of the
    // first row past the week, and removed when there is nothing that old.
    try{
      var _older = Array.prototype.slice.call(host.querySelectorAll('.hb-track-row[data-hb-rel]')).filter(function(row){
        return !window.__scRelIsRecent(row.getAttribute('data-date'));
      });
      var _head = host.querySelector('#hbRelEarlier');
      if(_older.length){
        if(!_head){
          _head = document.createElement('div');
          _head.id = 'hbRelEarlier';
          _head.className = 'hb-rel-earlier';
          _head.textContent = 'Earlier than a week';
        }
        host.insertBefore(_head, _older[0]);
      } else if(_head){
        _head.remove();
      }
    }catch(_eEarlier){ }`,
  { key: "'Earlier than a week'" });

// 3d. And the heading has a style, so it reads as a divider rather than a row.
sub(html, 'the earlier heading style',
  `.hb-track-row{\n`,
  `/* 71.4 - the divider that keeps releases older than a week in the panel and
   visibly labelled, instead of letting the list read as a few days of finds. */
.hb-rel-earlier{
  font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.7px;
  color: var(--ink-dim); opacity: 0.85;
  margin: 12px 0 2px; padding-top: 10px; border-top: 1px dashed var(--line);
}
.hb-track-row{\n`,
  { key: '.hb-rel-earlier{' });

/* ============================================================================
   4. THE DONATE PANE OFFERS ONLY WHAT THE COPY CAN REALLY TAKE
   ========================================================================== */
// 4a. The user's words: "on apk/web version it should only display on donations
// the actual ones that bring you to stripe only 2,5,10,25,50 should display and
// it should say brings you through stripe for donations then on play version
// it's Google play billing all of them". A copy with no billing can only be paid
// through Stripe, so a tier with no card page behind it had nothing to offer but
// a sentence and a detour to the Play listing. Only the amounts that really open
// a Stripe page are shown, and the pane says where the money goes. The copy
// installed from Google Play is not touched at all.
const DONATE_OLD = "    const promise = $('donatePromise');\n" +
  "    if(promise && !SC_IS_PLAY){\n" +
  "      const tierList = donateTierList();\n" +
  "      if(tierList){\n" +
  "        const intro = $('donateIntro');\n" +
  "        promise.textContent = 'Pick an amount \u2014 Google Play takes it inside the copy installed from Play, and ' + tierList + ' open a secure card page in every other copy.';\n" +
  "        if(intro) intro.textContent = \"SideCut is free and ad-free. If it's made your listening better, a tip helps keep it running and improving \u2014 a secure card page takes it here. Thank you! \ud83d\udc9b\";\n" +
  "      }\n" +
  "    }\n";

const DONATE_NEW = "    const promise = $('donatePromise');\n" +
  "    if(promise && !SC_IS_PLAY){\n" +
  "      const tierList = donateTierList();\n" +
  "      if(tierList){\n" +
  "        const intro = $('donateIntro');\n" +
  "        promise.textContent = 'Pick an amount \u2014 every tip here brings you through Stripe for donations, on a secure card page: ' + tierList + '.';\n" +
  "        if(intro) intro.textContent = \"SideCut is free and ad-free. If it's made your listening better, a tip helps keep it running and improving \u2014 donations are brought to you through Stripe, on a secure card page. Thank you! \ud83d\udc9b\";\n" +
  "      }\n" +
  "      // 71.4 - the pane only offers what THIS copy can take. Every tier used to\n" +
  "      // be shown, and the ones with no card page behind them ended in a sentence\n" +
  "      // and a detour to the Play listing, which is not a tip this copy can\n" +
  "      // actually accept. The amounts that really open a Stripe page are the ones\n" +
  "      // on screen, and the two lines above say where the money goes. THE COPY\n" +
  "      // INSTALLED FROM GOOGLE PLAY IS NOT TOUCHED: it has Billing, so every tier\n" +
  "      // stays and every one of them is Play's.\n" +
  "      try{\n" +
  "        pane.querySelectorAll('.donate-quick').forEach(function(btn){\n" +
  "          const amt = parseInt(btn.dataset.amt, 10) || 0;\n" +
  "          if(!donateUrlFor(amt)) btn.style.display = 'none';\n" +
  "        });\n" +
  "      }catch(_eTierHide){ }\n" +
  "    }\n";

sub(html, 'the pane offers only the amounts this copy can take', DONATE_OLD, DONATE_NEW,
  { key: "if(!donateUrlFor(amt)) btn.style.display = 'none';" });

/* ============================================================================
   5. THE ONE HOOK THE WORKING SONG NEEDS FROM THE APP
   ========================================================================== */
sub(html, 'the app can start one named song',
  `  window.__scNext = function(){ try{ $('nextBtn').click(); }catch(e){} };`,
  `  // 71.4 - Studio's working song can be any song in the library, and "Play it"
  // has to actually start it. This is the app's own tap-a-song path (the one a
  // Home bubble uses), so playing from Studio keeps the playlist context the way
  // tapping the row would, instead of dumping the whole library into the queue.
  window.__scPlayTrack = function(id){
    try{
      if(!id) return false;
      if(!window.__scTrack(id)) return false;
      playTrackInPlaylistContext(id);
      return true;
    }catch(_ePlayTrack){ return false; }
  };
  window.__scNext = function(){ try{ $('nextBtn').click(); }catch(e){} };`,
  { key: 'window.__scPlayTrack = function(id){' });

/* ===================== 6. THE RELEASE ITSELF ================================ */
sub(html, 'the app version',
  "  const APP_VERSION = '71.3';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-714: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-714: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
