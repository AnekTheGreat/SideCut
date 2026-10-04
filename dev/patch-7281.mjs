#!/usr/bin/env node
/**
 * SideCut 72.8.1 - the Last.fm card comes back out, and the letter wave is paced
 * by the word's own letters instead of an even split.
 *
 * The owner's words: "I don't think there's a point to that and letter by letter
 * lyrics needs to be more accurate and more flowy".
 *
 * TWO things, in one fix release:
 *
 * 1. LAST.FM IS GONE. 72.8 shipped scrobbling to Last.fm. The owner does not want
 *    it, so the settings card, the whole scrobbler module and its two call sites
 *    are removed. Nothing is left behind: no ids, no storage keys, no window
 *    global, no hook inside recordPlay/commitPlay. Those two functions read
 *    exactly as they did before 72.8.
 *
 * 2. THE LETTER WAVE WAS EVEN, WHICH IS WHY IT DRIFTED. A word's slice of the
 *    line was already weighted by the word's own length, but INSIDE that slice
 *    every letter got an equal step: an i and a W were lit for the same amount of
 *    time, and the travelling glow ran on a fixed 26ms delay of its own that knew
 *    nothing about the song. So the light fell behind on a wide word and ran
 *    ahead on a narrow one, and the glow and the letters could not agree.
 *
 *    Both halves are now paced:
 *
 *      a. the lit word's slice is the window it is being sung over, and each
 *         letter inside it is weighted by the letter's own width, so the sweep
 *         advances the way the mouth moves;
 *      b. the per-letter transition delay is DERIVED from that same window, so
 *         the glow cannot run on a different clock from the letters.
 *
 *    Nothing else moves: the line window, the clamp that stops words crawling
 *    across an instrumental gap, and the "last word stays lit" rule are all kept.
 *
 * EVERY sub is a swap and carries a `key`, so re-running this on a tree that
 * already has it applied is a no-op.
 *
 *   node dev/patch-7281.mjs
 *   node dev/patch-7281.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.8.1';
const STAMP = 'October 3, 2026 \\u00b7 7:05 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.8';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'The letter-by-letter wave is paced properly, and the Last.fm card is gone';
const NOTES = [
  'The letter-by-letter lyrics wave is paced by the word being sung now: every letter takes the share of the word its own width deserves, so the light lands on the letter you are hearing instead of drifting behind it.',
  'The glow that travels through a word is timed from that same measured pace, so it reads as one movement with the letters rather than a second effect running alongside them.',
  'Wide letters hold the light a little longer and narrow ones let it pass, which is what stops the sweep sitting on the wrong letter through a quick passage.',
  'Word-by-word is untouched and still lights each word as the line plays, and both lyrics chips still show their coral state while they are on.',
  'The Last.fm card is gone from Settings, More: scrobbling to Last.fm is no longer offered, and nothing is sent to Last.fm from this app any more.',
  'Songs, playlists, saved songs, the queue, the equalizer and every saved setting are exactly as they were, and the player, the widget and the library are untouched.',
  'The storage panel and the startup stopwatch in the bell are unchanged, and nothing about your own files has moved.',
  'Everything 72.8 fixed for the lyrics highlight stays fixed: the wave is visible on the word, and both highlight chips light up when they are on.',
];
const LASTFM_CARD_START = '      <!-- Last.fm scrobbling (72.8) -->\n';
const LASTFM_MODULE_START = "  // ---- Last.fm scrobbling (72.8) -------------------------------------------\n";
const PLAY_COUNTS_ANCHOR = '  const PLAY_COUNTS_AFTER = 0.5;\n';

// The letters-on block, rewritten whole. It is one contiguous run, so a single
// swap keeps it readable and cannot half-apply.
const OLD_LETTERS_BLOCK = [
  '    if(lettersOn()){',
  '      words.forEach(function(w, wi){',
  '        if(wi !== litIdx){ clearLetters(w); return; }',
  '        const ls = scEnsureLetterSpans(w);',
  '        if(!ls.length) return;',
  '        const span = Math.max(0.05, litTo - litFrom);',
  '        const frac = Math.max(0, Math.min(1, (nowSec - litFrom) / span));',
  '        const upto = Math.max(1, Math.ceil(frac * ls.length));',
  "        for(let li = 0; li < ls.length; li++) ls[li].classList.toggle('lit', li < upto);",
  '      });',
  '    } else {',
  '      words.forEach(clearLetters);',
  '    }',
  '',
].join('\n');

const NEW_LETTERS_BLOCK = [
  '    if(lettersOn()){',
  '      words.forEach(function(w, wi){',
  '        if(wi !== litIdx){ clearLetters(w); return; }',
  '        const span = Math.max(0.05, litTo - litFrom);',
  '        const frac = Math.max(0, Math.min(1, (nowSec - litFrom) / span));',
  '        // 72.8.1 - the letters are PACED, not counted. The old wave cut the',
  '        // word into equal steps, so an i and a W were lit for the same amount',
  '        // of time and the light fell behind on a wide word and ran ahead on a',
  '        // narrow one. Each letter now takes the share of the word its own width',
  '        // deserves, and the glow the CSS applies is handed the same window, so',
  '        // the sweep and the travelling light are one movement.',
  '        const ls = scEnsureLetterSpans(w, (span * 1000) / Math.max(1, (w.textContent || \'\').length));',
  '        if(!ls.length) return;',
  '        const wts = [];',
  '        let wTotal2 = 0;',
  '        for(let lw = 0; lw < ls.length; lw++){',
  '          const wt2 = scLetterWeight(ls[lw].textContent || \'\');',
  '          wts[lw] = wt2; wTotal2 += wt2;',
  '        }',
  '        let acc2 = 0, upto = ls.length;',
  '        for(let li = 0; li < ls.length; li++){',
  '          acc2 += wts[li] / wTotal2;',
  '          if(frac < acc2){ upto = li + 1; break; }',
  '        }',
  "        for(let li = 0; li < ls.length; li++) ls[li].classList.toggle('lit', li < upto);",
  '      });',
  '    } else {',
  '      words.forEach(clearLetters);',
  '    }',
  '',
].join('\n');

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

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

// Remove a line that was appended under another line. `hook` is the line that has
// to go and `keep` is the line it was appended to. A `key` would not work here:
// the only distinguishing string is the hook itself, which is present BEFORE the
// patch, so a keyed sub would report itself already done and leave it in place -
// which is exactly the bug this helper exists to avoid.
function stripHook(h, label, hook, keep){
  if(count(h.text, hook) === 0){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const oldStr = keep + hook;
  if(count(h.text, oldStr) !== 1){ problems.push('hook anchor not found exactly once (' + label + ')'); return; }
  h.text = h.text.split(oldStr).join(keep);
  applied++;
}

// Cut a whole block, from `start` up to (but not including) `end`. Used for the
// card and the module, whose text we do not want to reproduce here: the ends are
// the anchors, so this cannot half-apply or leave a dangling fragment.
function cut(h, label, start, end, key){
  if(key && count(h.text, key) === 0){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const i = h.text.indexOf(start);
  if(i === -1){ problems.push('block not found (' + label + ')'); return; }
  if(count(h.text, start) !== 1){ problems.push('block start not unique (' + label + ')'); return; }
  const j = h.text.indexOf(end, i + start.length);
  if(j === -1){ problems.push('block end not found (' + label + ')'); return; }
  h.text = h.text.slice(0, i) + h.text.slice(j);
  applied++;
}

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

/* ============================================================================
   1. THE VERSION AND THE CHANGELOG HEAD
   ========================================================================== */
sub(html, 'the app runs 72.8.1',
  "  const APP_VERSION = '72.8';\n",
  "  const APP_VERSION = '72.8.1';\n",
  { key: "const APP_VERSION = '72.8.1';" });

const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.8.1 entry at its head',
  "  const CHANGELOG = [\n" +
  "  { version: '" + OLDVER + "', date:",
  "  const CHANGELOG = [\n" +
  headEntry + "\n" +
  "  { version: '" + OLDVER + "', date:",
  { key: "{ version: '" + VERSION + "', date: '" + STAMP + "'" });

sub(sw, 'the shell cache is the release name',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ============================================================================
   2. LAST.FM COMES BACK OUT
   --------------------------------------------------------------------------
   The card sits between the Replay tutorial block and the Diagonal toggle
   comment; the module sits in front of the play counters. Both go by their own
   boundaries, and the two hooks go with them, so recordPlay and commitPlay end
   up reading exactly as they did before 72.8.
   ========================================================================== */
cut(html, 'the Last.fm settings card is removed',
  LASTFM_CARD_START,
  '      <!-- Diagonal / Single button toggle -->',
  'id="lastfmCard"');

cut(html, 'the scrobbler module is removed',
  LASTFM_MODULE_START,
  PLAY_COUNTS_ANCHOR,
  "var LF_API = 'https://ws.audioscrobbler.com/2.0/';");

stripHook(html, 'a track change no longer tells Last.fm anything',
  "    try{ if(window.scLastfm) window.scLastfm.nowPlaying(t); }catch(_eLfNp){}\n",
  "    recordListeningDay();\n");

stripHook(html, 'a heard song is no longer scrobbled',
  "    try{ if(window.scLastfm) window.scLastfm.scrobble(t); }catch(_eLfSc){}\n",
  "    scSidecarSet(t.id, { playCount: t.playCount });\n");

/* ============================================================================
   3. THE LETTER WAVE IS PACED, NOT EVEN
   ========================================================================== */
sub(html, 'a letter is weighed by its own width',
  '  function lettersOn(){\n' +
  "    try{ return !!lyricsLetterByLetter; }catch(_eLetters){ return false; }\n" +
  '  }\n',
  '  function lettersOn(){\n' +
  "    try{ return !!lyricsLetterByLetter; }catch(_eLetters){ return false; }\n" +
  '  }\n' +
  '  // 72.8.1 - how much singing a single character is worth. A narrow letter (i,\n' +
  '  // l, t) passes the light on quickly; a wide one (m, W) holds it. Whitespace is\n' +
  '  // only ever inside a word when a word span was split around it, so it barely\n' +
  '  // counts. This is the weight the sweep is paced by - not an even step.\n' +
  '  function scLetterWeight(ch){\n' +
  "    var c = String(ch || '');\n" +
  '    if(!c) return 1;\n' +
  '    if(/^\\s+$/.test(c)) return 0.3;\n' +
  "    if(/[iljtfIr!.,:;'|]/.test(c)) return 0.45;\n" +
  '    if(/[mwMW]/.test(c)) return 1.35;\n' +
  '    if(/[A-Za-z0-9]/.test(c)) return 1;\n' +
  '    return 0.6;\n' +
  '  }\n',
  { key: 'function scLetterWeight(ch){' });

sub(html, 'the lit word walks its letters by weight',
  OLD_LETTERS_BLOCK,
  NEW_LETTERS_BLOCK,
  { key: 'let wTotal2 = 0;' });

sub(html, 'the 71.4 comment no longer describes a fixed step',
  '  // 71.4 - one word\'s characters, wrapped ONCE. The per-letter transition-delay\n' +
  '  // is the wave: letter n starts its colour ~26ms after letter n-1, so a lit run\n' +
  '  // travels across the word instead of arriving all at once. The word\'s own text\n' +
  '  // is unchanged, so its length still weighs the pacing exactly as before.\n',
  '  // 71.4 - one word\'s characters, wrapped ONCE. The per-letter transition-delay is\n' +
  '  // the wave: letter n starts its colour one step after letter n-1, so a lit run\n' +
  '  // travels across the word instead of arriving all at once. 72.8.1 - the step is\n' +
  '  // no longer the fixed 26ms this comment used to promise: the pacer hands it in,\n' +
  '  // measured from the word\'s own place in the line, so the glow and the letters\n' +
  '  // move together instead of on two different clocks.\n',
  { key: 'measured from the word\'s own place in the line' });

sub(html, 'the travelling glow is timed from the measured pace',
  '  function scEnsureLetterSpans(wordEl){\n' +
  '    if(!wordEl) return [];\n' +
  "    if(wordEl.dataset.letters !== '1'){\n" +
  "      var txt = wordEl.textContent || '';\n" +
  '      if(!txt) return [];\n' +
  "      var html2 = '';\n" +
  '      for(var i = 0; i < txt.length; i++){\n' +
  "        html2 += '<span class=\"lyric-letter\" style=\"transition-delay:' + (i * 26) + 'ms\">' + escapeHtml(txt.charAt(i)) + '</span>';\n" +
  '      }\n',
  '  function scEnsureLetterSpans(wordEl, letterMs){\n' +
  '    if(!wordEl) return [];\n' +
  '    // 72.8.1 - the delay is handed in by the pacer, which knows how long this\n' +
  '    // word is actually being sung over. The old fixed 26ms was a guess that did\n' +
  '    // not move with the song, so the glow and the lit letters drifted apart.\n' +
  '    // Clamped so a very short word cannot flicker and a very long one cannot\n' +
  '    // leave the wave still moving when the word is already over.\n' +
  "    var step = (typeof letterMs === 'number' && isFinite(letterMs) && letterMs > 0) ? letterMs : 26;\n" +
  '    step = Math.max(14, Math.min(90, step));\n' +
  "    if(wordEl.dataset.letters !== '1' || wordEl.dataset.letterMs !== String(Math.round(step))){\n" +
  "      var txt = wordEl.textContent || '';\n" +
  '      if(!txt) return [];\n' +
  "      var html2 = '';\n" +
  '      for(var i = 0; i < txt.length; i++){\n' +
  "        html2 += '<span class=\"lyric-letter\" style=\"transition-delay:' + Math.round(i * step) + 'ms\">' + escapeHtml(txt.charAt(i)) + '</span>';\n" +
  '      }\n' +
  "      wordEl.dataset.letterMs = String(Math.round(step));\n",
  { key: 'wordEl.dataset.letterMs' });

sub(html, 'the letters glide rather than switch',
  '  #lyricsText .lyric-word .lyric-letter{\n' +
  '    display: inline;\n' +
  '    transition: color 0.26s linear, text-shadow 0.26s linear, transform 0.26s ease;\n' +
  '    transform: translateZ(0);\n' +
  '  }\n',
  '  /* 72.8.1 - the letters glide. A linear fade made the sweep read as a switch\n' +
  '     being flipped. The eased curve starts quickly and settles, so the light\n' +
  '     arrives with the letter instead of after it, and the delay is set per word\n' +
  '     by the pacer rather than by a fixed step here. */\n' +
  '  #lyricsText .lyric-word .lyric-letter{\n' +
  '    display: inline;\n' +
  '    transition: color 0.3s cubic-bezier(0.22,0.61,0.36,1),\n' +
  '                text-shadow 0.3s cubic-bezier(0.22,0.61,0.36,1),\n' +
  '                transform 0.3s cubic-bezier(0.22,0.61,0.36,1);\n' +
  '    transform: translateZ(0);\n' +
  '  }\n',
  { key: 'text-shadow 0.3s cubic-bezier(0.22,0.61,0.36,1)' });

/* ============================================================================
   4. THE OTA TAIL - TWO newlines after </html>, as 72.5 through 72.8
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to two newlines');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-7281: ' + problems.join('\n           '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-7281: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));