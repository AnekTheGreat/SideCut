#!/usr/bin/env node
/**
 * 72.8.1 - the letter wave is paced, and the Last.fm card is gone.
 *
 * The owner's words: "I don't think there's a point to that and letter by letter
 * lyrics needs to be more accurate and more flowy". Two things ride in this
 * release, so this gate pins both - and it does not take the descriptions on
 * trust:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the removal is COMPLETE: no Last.fm code, ids, storage keys or hooks, and
 *       the two functions it hooked are back to their pre-72.8 form. The release
 *       NOTES still name what was removed - a reader deserves to know - so the
 *       check is on the code, not on the word;
 *   [3] THE PACING IS REAL: the shipped lettersOn, scEnsureWordSpans,
 *       scEnsureLetterSpans, clearLetters, scLetterWeight and scPaceWords are
 *       lifted out of the page and RUN against a fake line. A word that opens on
 *       a wide letter holds the light three times as long as the same two letters
 *       reversed - which an even split per letter cannot do at all. That ratio is
 *       the release;
 *   [4] the glow's delay is derived from the song, not a fixed 26ms;
 *   [5] the repin moved every gate (no stale pin);
 *   [6] inline script syntax, and the OTA tail.
 *
 *   node dev/test-7281.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1'; /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */
const PREV = '73'; /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1';

// The changelog is prose and is allowed to say what was removed. Everything else
// in the page is code and must be clean of it.
const CHANGELOG_START = src.indexOf('const CHANGELOG = [');
const CHANGELOG_END = src.indexOf('\n  ];', CHANGELOG_START);
const code = src.slice(0, CHANGELOG_START) + src.slice(CHANGELOG_END);
const changelogBlock = src.slice(CHANGELOG_START, CHANGELOG_END);

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next (' + ((entries[1] || {}).version) + ')');
    ok(items.length >= 7, 'with at least seven notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(!/play build|play version|play install/i.test(notes), 'nor reads as a store-channel note');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(items.every((it) => it.length <= 260), 'every note is one short sentence or two (longest ' + Math.max(...items.map((i) => i.length)) + ')');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!!entries.find((e) => String(e.version) === PREV), 'the 72.8 entry is still behind it');
    // The words the release before this one pinned on the HEAD have to be here:
    // test-7251 and test-7252 read the head for /widget/ and /player/.
    ok(/widget/i.test(notes), 'the head notes still name the widget the earlier gates look for');
    ok(/player/i.test(notes), 'and the player');
    ok(/letter/i.test(notes), 'and this release says what it is about');
    ok(/lyrics/i.test(notes), 'including the lyrics half of it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-7281.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.8.1';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
  ok(patch.indexOf("const OLDVER = '72.8';") !== -1, 'and it says which build it moves from');
}

console.log('[2] the Last.fm removal is complete');
{
  ok(changelogBlock.indexOf('Last.fm') !== -1, 'the notes tell the reader the scrobbling card is gone');
  // The NAME still appears twice in code, and both are correct: the cover-art
  // lookup from 63.x (fetchCoverFromLastFM) and its changelog line. That feature
  // predates the scrobbler and is not what was removed, so this checks the
  // scrobbler's identifiers rather than the word.
  ok(code.indexOf('fetchCoverFromLastFM') !== -1, 'the cover-art lookup that predates it is untouched');
  ok(code.indexOf('track.scrobble') === -1 && code.indexOf('track.updateNowPlaying') === -1,
    'and no code sends a scrobble or a now-playing update');
  ok(code.indexOf('auth.getSession') === -1 && code.indexOf('auth.getToken') === -1,
    'nor runs the account handshake');
  ok(code.indexOf('lastfm') === -1, 'no lastfm identifier of any kind');
  ok(code.indexOf('scLastfm') === -1, 'no window global left for it');
  ok(code.indexOf('sidecut_lastfm') === -1, 'and none of its storage keys');
  // NOTE: one pre-existing, unrelated use of the Last.fm endpoint remains and is
  // NOT part of the removed feature - the cover-art lookup from 63.x, which has
  // always shipped. The scrobbler's own module constants and helpers are what had
  // to go, and those are checked below.
  ok(count(code, "var LF_API = 'https://ws.audioscrobbler.com/2.0/';") === 0,
    'the scrobbler is no longer wired to the Last.fm endpoint');
  ok(count(code, 'ws.audioscrobbler.com') === 1 && code.indexOf('fetchCoverFromLastFM') !== -1,
    'the cover-art lookup that predates it is the only thing left pointing there');
  ok(code.indexOf('function lfMd5(') === -1, 'the MD5 helper it needed is gone with it');
  ok(code.indexOf('function lfSig(') === -1, 'and so is the signature builder');
  ok(code.indexOf('function lfFlushQueue(') === -1, 'and the offline queue');
  ok(code.indexOf('function lfConnect(') === -1, 'and the connect flow');
  ok(code.indexOf('LF_API') === -1 && code.indexOf('LF_MIN_SECONDS') === -1, 'and its constants');
  // The two functions it hooked read as they did before 72.8: one plain call each.
  ok(/    recordListeningDay\(\);\n/.test(code), 'the play recorder is back to its plain self');
  ok(count(code, 'recordListeningDay();') === 1, 'from exactly one place');
  ok(/    scSidecarSet\(t\.id, \{ playCount: t\.playCount \}\);\n/.test(code), 'and so is the play counter');
  ok(count(code, 'scSidecarSet(t.id, { playCount: t.playCount });') === 1, 'from exactly one place');
  ok(count(code, 'function recordPlay(t){') === 1 && count(code, 'function commitPlay(t){') === 1,
    'both functions are still there and still single');
  // The More pane it lived in is intact.
  ok(count(code, 'id="lastfmCard"') === 0, 'the settings card is gone');
  ok(count(code, 'id="lastfmKeyInput"') === 0 && count(code, 'id="lastfmConnectBtn"') === 0,
    'with its key boxes and its connect button');
  ok(count(code, 'id="lastfmToggle"') === 0 && count(code, 'id="lastfmDisconnectBtn"') === 0,
    'and none of its controls remain');
  ok(count(code, 'id="howToUseBtn"') === 1, 'the Replay tutorial block above it survives');
  ok(count(code, '<!-- Diagonal / Single button toggle -->') === 1,
    'and the card that followed it in the More pane is untouched');
  ok(count(code, 'const PLAY_COUNTS_AFTER = 0.5;') === 1,
    'the play-counting block it was inserted in front of is intact');
}

console.log('[3] the letters are paced by their own widths (the shipped code is run)');
{
  // Lift the whole pacing apparatus out of the page. It is one contiguous run:
  // lettersOn, scEnsureWordSpans, scEnsureLetterSpans, clearLetters, scLetterWeight
  // and scPaceWords all sit together, so the slice is the shipped code and not a
  // paraphrase of it.
  const weightAt = src.indexOf('  function scLetterWeight(ch){');
  const paceAt = src.indexOf('  function scPaceWords(lineEl, fromSec, toSec, nowSec){');
  const paceEnd = src.indexOf('\n  function formatSyncedLyrics(', paceAt);
  ok(weightAt !== -1 && paceAt !== -1 && paceEnd !== -1, 'the pacing code can be lifted out of the page');
  const weightSrc = src.slice(weightAt, src.indexOf('\n  }\n', weightAt) + 4);
  ok(weightSrc.indexOf('function scLetterWeight') !== -1 && weightSrc.indexOf('return 0.6;') !== -1,
    'the letter weight is one self-contained function');
  ok(weightSrc.indexOf('scPaceWords') === -1, 'and it does not drag the pacer in with it');
  const lettersOnSrc = src.slice(src.indexOf('  function lettersOn(){'), src.indexOf('  function scEnsureWordSpans('));
  ok(lettersOnSrc.indexOf('lyricsLetterByLetter') !== -1, 'and the mode check comes with it');
  const spansSrc = src.slice(src.indexOf('  function scEnsureWordSpans(lineEl){'), paceEnd);
  ok(spansSrc.indexOf('function clearLetters') !== -1, 'as does the letter wrapping and clearing');

  // A minimal DOM: the pacer only needs classList, textContent, dataset and a
  // querySelectorAll over the word and letter spans.
  function makeEl(txt){
    return {
      textContent: txt,
      dataset: {},
      classList: {
        _s: new Set(),
        add(c){ this._s.add(c); },
        remove(c){ this._s.delete(c); },
        contains(c){ return this._s.has(c); },
        toggle(c, on){ if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; },
      },
    };
  }
  function makeWord(txt){
    const letters = String(txt).split('').map(makeEl);
    const w = makeEl(txt);
    w.querySelectorAll = (sel) => (sel === '.lyric-letter' ? letters : []);
    return w;
  }
  function makeLine(text){
    const words = String(text).split(' ').map(makeWord);
    const line = makeEl(text);
    line.querySelectorAll = (sel) => (sel === '.lyric-word' ? words : []);
    line.dataset.wordwrap = '1';   // the pacer trusts an already-wrapped line
    return { line, words };
  }

  const factory = new Function('escapeHtml', 'lyricsLetterByLetter',
    'var lyricsWordByWord = true;\n' +
    lettersOnSrc + '\n' +
    spansSrc + '\n' +
    weightSrc + '\n' +
    'return { pace: scPaceWords, weight: scLetterWeight, on: lettersOn };');
  const built = factory((s) => String(s), true);
  ok(typeof built.pace === 'function' && typeof built.weight === 'function' && built.on() === true,
    'the shipped pacer, weight and mode check all evaluate');

  ok(built.weight('W') > built.weight('i'),
    'a W is worth more singing than an i (' + built.weight('W') + ' vs ' + built.weight('i') + ')');
  ok(built.weight('m') > built.weight('l'), 'an m more than an l');
  ok(built.weight('a') === 1, 'an ordinary letter is the unit');
  ok(built.weight(' ') < 1, 'and a space barely counts');

  // Walk the word forward and report when the light LEAVES the first letter.
  // Both words below are two characters with the same total weight, so the pacer
  // hands them the same slice - the only difference is which letter is wide,
  // which is exactly what this release changed.
  function handOffTime(wordText){
    const { line, words } = makeLine(wordText);
    for (let step = 0; step <= 2000; step++){
      const nowSec = step * 0.0005;
      built.pace(line, 0, 4, nowSec);
      const ls = words[0].querySelectorAll('.lyric-letter');
      if (ls.length >= 2 && ls[1].classList.contains('lit')) return nowSec;
    }
    return Infinity;
  }

  const wideFirst = handOffTime('Wi');    // a wide letter, then a narrow one
  const narrowFirst = handOffTime('iW');  // the same two letters, reversed
  ok(isFinite(wideFirst) && isFinite(narrowFirst), 'both words hand the light on inside their slice');
  ok(wideFirst > 0 && narrowFirst > 0, 'and neither does it instantly');
  const ratio = wideFirst / narrowFirst;
  ok(Math.abs(ratio - 3) < 0.2,
    'the wide-first word holds the light three times as long as the narrow-first one (ratio ' + ratio.toFixed(2) + ')');
  // The proof that this IS the weighting: an even split per letter cannot do it.
  ok(Math.abs(1 - ratio) > 1,
    'which an even split per letter could never do - it would always be 1.00');

  // And the same relation the release is named for: a wide letter holds the light
  // past the halfway mark of the word, a narrow one lets it go before it.
  const iWSplit = built.weight('i') / (built.weight('i') + built.weight('W'));
  const wiSplit = built.weight('W') / (built.weight('W') + built.weight('i'));
  ok(iWSplit < 0.5, 'the narrow-first split falls before halfway (' + iWSplit.toFixed(2) + ')');
  ok(wiSplit > 0.5, 'and the wide-first split after it (' + wiSplit.toFixed(2) + ')');
  ok(Math.abs(iWSplit + wiSplit - 1) < 1e-9, 'the two are mirror images of each other');

  // The slice itself still widens with the word, so a long word is given more of
  // the line than a short one - the other half of "flowy".
  function fullTime(wordText){
    const { line, words } = makeLine(wordText);
    for (let step = 0; step <= 4000; step++){
      const nowSec = step * 0.0005;
      built.pace(line, 0, 4, nowSec);
      const ls = words[0].querySelectorAll('.lyric-letter');
      if (ls.length && ls.every((l) => l.classList.contains('lit'))) return nowSec;
    }
    return Infinity;
  }
  const shortWord = fullTime('Wi');
  const longWord = fullTime('Wide');
  ok(isFinite(shortWord) && isFinite(longWord), 'both a short and a long word fill inside their slice');
  ok(longWord > shortWord, 'and the longer word is given the longer slice (' + longWord.toFixed(2) + 's vs ' + shortWord.toFixed(2) + 's)');

  // The pacing must never overrun the line: the next line owns its own window.
  function allFilledEarly(wordText){
    const { line, words } = makeLine(wordText);
    built.pace(line, 0, 4, 4);
    const ls = words[0].querySelectorAll('.lyric-letter');
    return ls.length > 0 && ls.every((l) => l.classList.contains('lit'));
  }
  ok(allFilledEarly('Wide') === true, 'by the end of the window every letter is lit');
}

console.log('[4] the glow is timed from the song, not from a fixed step');
{
  ok(count(src, 'function scEnsureLetterSpans(wordEl, letterMs){') === 1, 'the wrap takes the window it is given');
  ok(src.indexOf("var step = (typeof letterMs === 'number' && isFinite(letterMs) && letterMs > 0) ? letterMs : 26;") !== -1,
    'and falls back to the old 26ms only when it is not told');
  ok(src.indexOf('step = Math.max(11, Math.min(180, step));') !== -1,
    'with a floor and a ceiling so a very short word cannot flicker');
  ok(src.indexOf("wordEl.dataset.letterMs = String(Math.round(step));") !== -1,
    'and the delay is remembered per word, so a re-pace only rebuilds when it moved');
  ok(/wordEl\.dataset\.letters !== '1' \|\| wordEl\.dataset\.letterMs !== String\(Math\.round\(step\)\)/.test(src),
    'which is exactly the condition the rebuild hangs on');
  ok(src.indexOf("style=\"transition-delay:' + Math.round(i * step) + 'ms\"") !== -1,
    'the delay grows with the letter position');
  ok(count(src, "transition-delay:' + (i * 26) + 'ms'") === 0, 'and the fixed 26ms step is gone from the wrap');
  ok(src.indexOf("scEnsureLetterSpans(w, (span * 1000) / Math.max(1, (w.textContent || '').length))") !== -1,
    'the pacer hands in the word own window, measured from the song');
  ok(/transition: color 0\.3s cubic-bezier\(0\.22,0\.61,0\.36,1\),/.test(src),
    'and the letters ease rather than switch');
  ok(count(src, '#lyricsText .lyric-word .lyric-letter{') === 1, 'still as the one rule test-714 pins');
  ok(src.indexOf('linear, text-shadow 0.26s linear') === -1, 'the old linear 0.26s transition is gone');
}

console.log('[5] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-7281.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.8';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '72.8.1';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf("['test-728.mjs', ['72.7.1', OLDVER]]") !== -1, 'and it moves the adjacent-entry pin for its own gate too');
  ok(repin.indexOf("bespokeCut('test-714.mjs'") !== -1,
    'with the wave assertions rewritten for the gate that pinned the old pacing');
  ok(repin.indexOf("esc(OLDCACHE) + '(?![\\\\d.])'") !== -1, 'the cache move is prefix-safe');
  ok(repin.indexOf('esc(OLDVER)') !== -1 && repin.indexOf("esc(OLDVER) + \"';\"") !== -1,
    'and the build pin is anchored, because 72.8 is a prefix of 72.8.1');
  const dev = fs.readdirSync(path.join(ROOT, 'dev'));
  const OLD_VER_PIN = 'const VER = ' + "'" + PREV + "'" + ';';
  const stale = dev.filter((n) => /^test-.*\.mjs$/.test(n) && n !== 'test-705.mjs' && n !== 'test-70.mjs' && n !== 'test-7281.mjs')
    .filter((n) => fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf(OLD_VER_PIN) !== -1);
  ok(stale.length === 0, 'no gate still pins the old build (' + stale.join(',') + ')');
  const cacheStale = dev.filter((n) => /^test-.*\.mjs$/.test(n))
    .filter((n) => /sidecut-shell-v72\.8(?![\d.])/.test(fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8')));
  ok(cacheStale.length === 0, 'and no gate still names the old shell cache (' + cacheStale.join(',') + ')');
}

console.log('[6] inline script syntax and the OTA tail');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
  ok(/\n\n$/.test(src), 'the page ends with the two-newline OTA tail');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);