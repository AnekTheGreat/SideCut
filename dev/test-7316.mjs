// 73.1.6 - the songs that change shape are timed from the recording, and the
// how-to steps now match where songs actually land.
//
// The owner's words for the timing work: "But then theirs other songs that work
// perfectly with the lyrics sync it's just song with multiple languages, pauses,
// switches in speed tempo, long intros ect". A song that keeps the same pace is
// easy; the ones that pause, switch tempo, mix languages or open on a long
// instrumental are where a single pass drifts. So the recording is measured
// first: the quiet stretches become a map the model is handed, a line dropped
// inside a break is pulled to where the voice resumes, and the snap that lands a
// line avoids the instrumental frames entirely.
//
//   * scFindQuietGaps reads the silent/instrumental stretches off the recording;
//   * the prompt carries them, plus the language, pause and tempo-change rules;
//   * scPullRowsClearOfGaps moves a line out of a break to the voice resuming; and
//   * scSnapRowsToOnsets takes the gaps and never targets a frame inside one.
//
// [16] lifts the new measuring code out and RUNS it against a synthetic envelope
// with a loud - silent - loud shape.
//
// The owner's words for the copy fix: "The instructions to get songs into your
// library is wrong because it automatically puts the songs into your library".
// Both how-to boxes still told the reader to tap Download or Import to Library
// after a conversion - a step that stopped existing when a converted song began
// filing itself into the library. Step 3 now says the song is in the library the
// moment it is ready, and that saving the file itself is the optional extra.
// [17] pins the corrected wording.
//
// 73.1.5 - the key says so out loud, and the model answer is checked against the
// song before it is kept.
//
// The owner's words for this release: "There should be a toast saying gemeni key
// conected after you paste it in and you don't need the key field in support it
// should still use it tho. The lyrics is still very off and the AI should be
// doin more, how come Spotify gets it right but you don't". Three answers:
//
//   * pasting a key now toasts "Gemini key connected", once per distinct key,
//     instead of a "saved" toast on every keystroke debounce, and the paste
//     button always confirms;
//   * the one key field lives in Important - the Support pane keeps its chat and
//     contact card but no longer carries a key field, and every "paste a Gemini
//     key" link now names Important;
//   * the model does more work and is held to the recording: the prompt counts
//     the lines and demands exactly that many back, the first line is placed
//     where the SINGING starts rather than at a pinned 00:01, a short answer is
//     asked again with the count it owes, an even split dressed up as a timing is
//     refused, and every timestamp is validated then snapped onto the nearest
//     real energy rise in the song (scRowsLookSane, scSnapRowsToOnsets).
//
// [15] lifts the new judging and snapping functions out of the page and RUNS
// them against a synthetic envelope.
//
// 73.1.4 - the lyrics are timed by the model listening to the recording, and a
// tap on a line only moves the highlight.
//
// The owner's words for this release: "the ai should be doing that work to
// analyze tempo and everything in the song to get the right lyrics timing and
// clicking on a line to change the highlight shouldn't change the audio just
// highlight". Two fixes:
//
//   * the automatic timing path now asks the model FIRST, with the song's own
//     bytes attached, so it hears the tempo, the beat, the intro and the chorus
//     returns instead of the app laying the words out by how long each line is
//     (scTimeLyricsFromOnsets stays only as the offline stand-in); and
//   * a tap on a lyric line is a highlight, not a seek - the old tap-to-seek
//     helper is gone and the tracker holds the tapped line for a few seconds.
//
// 73.1.3 - the lyrics can be lined up by hand, and AI Sync sends the recording.
//
// The owner's words for this release: "Lyric timing: Both" - they took the offer
// of BOTH fixes for a drift no envelope can recover. A plain-text entry with no
// timings (Waliyan by Diljit Dosanjh is filed that way) is handed to the app as
// words with no times at all, so the chorus returns cannot be measured from the
// audio no matter how the envelope is tuned. So there are two answers:
//
//   * a hand-align mode - tap Line up, play the song, tap the line being sung,
//     and the timing is rebuilt around those taps (scApplyLyricAnchors); and
//   * AI Sync attaches the actual recording to the model request, so it times
//     each line against the singing it can hear (inline_data), instead of only
//     seeing the words and guessing from their length.
//
// [7] lifts the shipped measuring code out of the page and RUNS it; [11] lifts
// scApplyLyricAnchors out and RUNS it - every tap must land exactly on its time,
// in order, with the lines outside the taps shifted by the nearest one.
//
// 73.1.2 - a track that opens on music is timed from where the VOICE enters.
//
// 73.1.1 - the letter-by-letter wave now crosses the whole word, and a song with
// a long instrumental opening is timed from where the singing starts.
//
// These are fixes inside 73, not a new release line: 73 shipped and is already
// published, so each lands as a release above the last - 73.1, then 73.1.1, then
// 73.1.2, exactly as 72.8 was followed by 72.8.1.
//
// The owner's words for this fix:
//   * "Letter by letter should be like a wave not just illuminate the first
//     letter";
//   * "for songs with music in the beginning the lyrics is still fully off".
//
// The first was a double clock. The pacer already lights letter i at its own
// weighted share of the word, and the CSS then gave that letter another
// transition-delay of i*step before its fade could even begin - so the wave was
// still crossing the word long after the word was over, and the pacer wiped the
// tail when the line moved on. Only the first letter or two were ever seen to
// light. The delay is gone; the wrap carries a fade now, sized from the word's
// own window, and WHEN a letter lights is the pacer's clock again.
//
// The second was an anchor. The layout began at a lead-in measured from 0, so a
// track with a long intro pinned its first line to the top of the file and spread
// every later line from there - and the first line was the one line the snap loop
// never touched. 73.1.1 anchored the layout to the first strong rise and snapped
// every line. That was still not enough on a track that opens on a BEAT: a drum
// rises harder than a voice does, so the anchor landed on the music and the first
// lines lit during the opening. 73.1.2 makes the anchor the first place the rises
// come thick and fast and keep coming - singing is a stream of articulations, not
// one hit, and a beat every half second cannot reach the count a voice does.
//
// [7] lifts the shipped measuring code out of the page and RUNS it: the synthetic
// long-intro envelope proves the first line lands on the entrance and not on 0.
// [8] runs the shipped AIFF writer against a synthetic buffer and reads the
// container back byte by byte.
//
// Version note: '73.1' is a prefix of '73.1.1', which is a prefix of '73.1.2' -
// the repin is checked for that, not this file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const widgetPy = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-widget.py'), 'utf8');

const VER = '73.2.1'; /* repinned by dev/repin-7321.mjs */
const PREV = '73.2'; /* repinned by dev/repin-7321.mjs */ /* repinned by dev/repin-732.mjs */ /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7317.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.2.1';

// The gates that carry the adjacent-entry pin. repin-7312 moves all of them.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs',  'test-728.mjs', 'test-7281.mjs',
  'test-7316.mjs',
];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
// Split so no literal build number or cache name the repin rewrites is ever
// spelled in this file - a bare one here would be rewritten with it.
const VER_BEFORE = '73' + '.1' + '.5';
const PREV_BEFORE = '73' + '.1' + '.4';
const OLD_CACHE_RE = new RegExp('sidecut-shell-v' + VER_BEFORE.split('.').join('\\.') + '(?![\\d.])');

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
    ok(/widget/i.test(notes), 'the notes name the home-screen widget the earlier gates look for');
    ok(/player/i.test(notes), 'and the player');
    ok(/lyrics/i.test(notes), 'and the lyrics work');
    ok(/letter/i.test(notes), 'including the letter wave');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(items.every((it) => it.length <= 260), 'every note is one short sentence or two (longest ' + Math.max(...items.map((i) => i.length)) + ')');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
}

console.log('[2] the pacer is measured in syllables, so scripts move together');
{
  const spansAt = src.indexOf('  function scEnsureWordSpans(lineEl){');
  const paceAt = src.indexOf('  function scPaceWords(lineEl, fromSec, toSec, nowSec){');
  const paceEnd = src.indexOf('\n  function formatSyncedLyrics(', paceAt);
  ok(spansAt !== -1 && paceAt !== -1 && paceEnd !== -1, 'the pacing code can be lifted out of the page');
  const lettersOnSrc = src.slice(src.indexOf('  function lettersOn(){'), spansAt);
  const spansSrc = src.slice(spansAt, paceEnd);
  const paceSrc = src.slice(paceAt, paceEnd);
  ok(spansSrc.indexOf('scPaceWords') !== -1 && slide(paceSrc), 'and the pacer comes with its weighting');
  const F = new Function('escapeHtml', 'lyricsLetterByLetter',
    lettersOnSrc + '\n' + spansSrc + '\n' + paceSrc + '\n' +
    'return { pace: scPaceWords };')((x) => String(x), false);
  ok(typeof F.pace === 'function', 'the shipped pacer evaluates');

  const makeEl = (txt) => ({
    textContent: txt,
    dataset: {},
    classList: {
      _s: new Set(),
      add(c){ this._s.add(c); },
      remove(c){ this._s.delete(c); },
      contains(c){ return this._s.has(c); },
      toggle(c, on){ if (on === undefined) on = !this._s.has(c); on ? this._s.add(c) : this._s.delete(c); return on; },
    },
  });
  const makeWord = (txt) => {
    const letters = String(txt).split('').map(makeEl);
    const w = makeEl(txt);
    w.querySelectorAll = (sel) => (sel === '.lyric-letter' ? letters : []);
    return w;
  };
  const mkLine = (text) => {
    const words = String(text).split(' ').map(makeWord);
    const line = makeEl(text);
    line.querySelectorAll = (sel) => (sel === '.lyric-word' ? words : []);
    line.dataset.wordwrap = '1';
    return { line, words };
  };
  // The time each word is scheduled to take over, found by sampling. The last
  // word is skipped: once the paced span ends the pacer holds it deliberately,
  // so its observed time is not its scheduled slice.
  function startsAt(text, from, to){
    const { line, words } = mkLine(text);
    const n = words.length;
    const starts = new Array(n).fill(NaN);
    const N = 2000;
    for (let i = 0; i < N; i++){
      const t = from + ((to - from) * i) / N;
      F.pace(line, from, to, t);
      words.forEach((w, wi) => { if (isNaN(starts[wi]) && w.classList.contains('current')) starts[wi] = t; });
    }
    return starts;
  }
  // "beautiful" is nine letters but about five syllables; "素敵" is two
  // characters and two syllables. Weighting by length gave the Latin word 0.60
  // of the line, the CJK word 0.13 and the last word 0.27 - which is exactly the
  // "completely off" report on a bilingual lyric. Weighed by syllables the CJK
  // word owns roughly twice the slice, and the schedule is measured, not
  // dismissed.
  const st = startsAt('beautiful 素敵 song', 0, 4);
  ok(st[0] === 0, 'the first word opens the line');
  ok(st[1] < st[2], 'and the words take over in order');
  const midShare = (st[2] - st[1]) / st[2];
  ok(midShare > 0.28, 'the two-character CJK word owns a real slice of the line (' + midShare.toFixed(2) + ', length weighting gave 0.13)');
  ok(st[1] / st[2] > 0.4, 'while the longer first word still leads it (' + (st[1] / st[2]).toFixed(2) + ')');
  // A dense line in a short window must still finish inside it.
  const { line: fastLine, words: fastWords } = mkLine('a b c d e');
  F.pace(fastLine, 0, 1, 1);
  ok(fastWords.some((w) => w.classList.contains('current')), 'a fast line still marks a word at the end of its window');

  ok(src.indexOf('const rate = Math.max(1.6, Math.min(7, lineRate * 1.12));') !== -1,
    'the rate is syllables per second, clamped where real singing sits');
  ok(src.indexOf('words.forEach(function(w){ const wt = Math.max(1, w.textContent.length); weights.push(wt); totalWeight += wt; });') === -1,
    'and nothing weights a word by its raw character count any more');
  ok(src.indexOf('const scWordWeight = function(word){') !== -1, 'the syllable weight is its own helper');
  ok(src.indexOf('step = Math.max(11, Math.min(180, step));') !== -1,
    'the letter fade is sized off the word window and clamped at both ends');
  ok(src.indexOf('step = Math.max(14, Math.min(90, step));') === -1, 'and the old narrow clamp is gone');

  function slide(paceSrc){ return paceSrc.indexOf('scWordWeight(w.textContent)') !== -1; }
}

console.log('[3] new releases are de-duplicated and the bubble stops at a month');
{
  const at = src.indexOf('window.__scReleaseList = function(maxDays){');
  const end = src.indexOf('\n};', at) + 3;
  ok(at !== -1 && end > at, 'the shipped release-list builder can be lifted out');
  const fnSrc = src.slice(at, end);
  const W = {
    __scJunkTitle: (t) => /remix|karaoke|tribute/i.test(String(t)),
    __scDay10: (d) => String(d || '').slice(0, 10),
  };
  const day = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
  const recent = day(3), older = day(40);
  const map = {
    'Sidhu Moose Wala': [
      { title: 'Ghostface Killah', date: recent, seen: false },
      { title: 'Ghostface Killah', date: recent, seen: false },
      { title: 'Ghostface Killah', date: recent, seen: false },
    ],
    'sidhu moose wala ': [
      { title: 'Ghostface Killah', date: recent, seen: false },
    ],
    'Someone Else': [
      { title: 'Old Song', date: older, seen: false },
      { title: 'Fresh Cut', date: recent, seen: false },
      { title: 'Fresh Cut (Remix)', date: recent, seen: false },
    ],
  };
  const build = new Function('window', 'pinnedReleases', fnSrc + '\nreturn window.__scReleaseList;')(W, map);
  const all = build(0);
  ok(all.length === 3, 'the same drop stored four times prints once (' + all.length + ' rows)');
  ok(all.filter((r) => r.title === 'Ghostface Killah').length === 1, 'and the repeated title is a single row');
  ok(all.every((r) => !/Remix/i.test(r.title)), 'the junk-title filter still applies');
  const month = build(31);
  ok(month.length === 2, 'the month-bounded list drops the 40-day-old drop (' + month.length + ')');
  ok(!month.some((r) => r.title === 'Old Song'), 'and the old drop is not in it');
  ok(month[0].date >= month[month.length - 1].date, 'the list is newest first');

  ok(src.indexOf('const all = window.__scReleaseList(31);') !== -1, 'the Home bubble list is the month-bounded one');
  ok(src.indexOf('var releases = window.__scReleaseList(0).map(') !== -1, 'the Discover popup still shows the full history, de-duplicated');
  ok(src.indexOf('var all = window.__scReleaseList(31);') !== -1, 'and the bubble overlay paints the same month-bounded list');
  ok(src.indexOf('${window.__scReleaseList(31).filter(r => !r.seen).length}') !== -1, 'the bubble count reads the same list');
}

console.log('[4] a long save can be stopped');
{
  ok(count('function scDlChip(title){') === 1, 'there is one cancellable progress chip');
  ok(src.indexOf('class="sc-dl-x"') !== -1, 'with an X on it');
  ok(src.indexOf('state.cancelled = true;') !== -1, 'the X flips a cancel flag');
  ok(src.indexOf('cancelled: function(){ return state.cancelled; },') !== -1, 'which the job can read');
  ok(src.indexOf("const chip = scDlChip('Downloading songs');") !== -1, 'the whole library save uses it');
  ok(src.indexOf('if(chip.cancelled()){ skipped = tracks.length - done - failed; break; }') !== -1,
    'and stops between files instead of finishing the queue');
  ok(src.indexOf('chip.close();') !== -1 && src.indexOf('Stopped — saved ${done} of ${tracks.length} songs.') !== -1,
    'and says what was kept');
  ok(src.indexOf('id="mixCancelBtn"') !== -1, 'the crossfaded mix chip carries its own X');
  ok(src.indexOf('let mixCancelled = false;') !== -1, 'backed by a flag');
  ok(src.indexOf('const mixStopped = function(){') !== -1, 'with one place that answers whether to bail');
  ok(count('if(mixStopped()) return;') >= 5, 'checked between chunks in every phase (' + count('if(mixStopped()) return;') + ')');
  ok(src.indexOf("toast('Crossfade mix cancelled — nothing was saved.', 4000);") !== -1,
    'and cancelling a mix saves nothing and says so');
}

console.log('[5] the widget answers a play without opening the app');
{
  ok(widgetPy.indexOf('if (!sent || !music) {') !== -1,
    'the press gets a second route to whichever player holds the session');
  ok(widgetPy.indexOf('am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));') !== -1,
    'by dispatching the system media key as well as the direct hand-off');
  ok(widgetPy.indexOf('if (code == KeyEvent.KEYCODE_MEDIA_PLAY || code == KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE) {') !== -1,
    'and the app is only opened when nothing played and the press was a play');
  ok(widgetPy.indexOf('if (!sent && !music) {') !== -1, 'so a backgrounded app resumes instead of dragging you in');
  ok(widgetPy.indexOf('AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);') !== -1, 'the audio service is still read for the state');
  ok(widgetPy.indexOf('480L') === -1, 'and nothing about the animation loop moved');
}

console.log('[6] the guide is a map, and the lyrics bar gained a Copy');
{
  ok(src.indexOf('id="collapsibleFeatureMap"') !== -1, 'Settings has the feature map panel');
  ok(src.indexOf("setupCollapsible('collapsibleFeatureMap', 'collapsibleFeatureMapContent', 'collapseFeatureMapIcon')") !== -1,
    'and it opens and closes like the tutorial summary');
  ok(src.indexOf('What SideCut can do') !== -1, 'it is labelled in plain language');
  ok(src.indexOf('<b>Downloads</b>') !== -1 && src.indexOf('<b>Lyrics</b>') !== -1 && src.indexOf('<b>Studio</b>') !== -1,
    'and covers the parts of the app a reader would ask about');
  ok(src.indexOf('Every long download shows a progress chip with an <b>✕</b>') !== -1 || src.indexOf('progress chip with an <b>✕</b>') !== -1,
    'the cancel path is documented where the reader looks');
  ok(src.indexOf('id="lyricsCopyBtn"') !== -1, 'the lyrics bar has a Copy chip');
  ok(src.indexOf("$('lyricsCopyBtn').addEventListener('click'") !== -1, 'and it is wired');
  ok(src.indexOf("if(typeof copyTextToClipboard === 'function') copyTextToClipboard(txt);") !== -1,
    'through the same clipboard path the share code uses');
}

console.log('[7] words with no timings are timed from the song itself');
{
  const at = src.indexOf('  var SC_ONSET_HOP = 0.02;');
  const end = src.indexOf('\n  function showLyrics(', at);
  ok(at !== -1 && end > at, 'the measuring code can be lifted out of the page');
  const block = src.slice(at, end);
  let T = null;
  try {
    T = new Function(block + '\nreturn { syl: scSyllableCount, env: scOnsetEnvelope, time: scTimeLyricsFromOnsets, even: scLyricsLookEvenlySpaced, strip: scStripLrcStamps, gaps: scFindQuietGaps };')();
  } catch (e){ ok(false, 'and it evaluates: ' + e.message); }
  ok(T && typeof T.time === 'function' && typeof T.env === 'function' && typeof T.even === 'function', 'the shipped timing code evaluates');

  if (T) {
    ok(Math.round(T.syl('素敵') * 100) / 100 === 2, 'a two-character CJK word counts two units (' + T.syl('素敵') + ')');
    ok(T.syl('beautiful') > T.syl('bat'), 'and vowels weigh more than consonants in a Latin word');

    const parse = (lrc) => String(lrc).split('\n').map((l) => {
      const m = l.match(/^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/);
      return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : NaN;
    });
    const lines = [
      'Parla piu piano e vieni piu vicino a me',
      'x',
      'Voglio sentire gli occhi miei dentro di te',
    ];
    const dur = 60;
    const plain = T.time(lines, dur, null, 0.02);
    ok(typeof plain === 'string' && plain.split('\n').length === 3, 'every line comes back with a stamp');
    ok(/^\[\d{2}:\d{2}\.\d{2}\]/.test(plain.split('\n')[0]), 'in LRC form (' + plain.split('\n')[0].slice(0, 12) + ')');
    const pT = parse(plain);
    ok(pT.every((t) => t >= 0 && t < dur), 'and every stamp sits inside the song');
    ok(pT[1] > pT[0] && pT[2] > pT[1], 'the lines take over in order');
    ok(pT[1] - pT[0] > 0.3 && pT[2] - pT[1] > 0.3, 'never on top of each other, however short a line is');
    ok(Math.abs(pT[1] - dur / 3) > 1, 'and an even split is NOT what the layout does (' + pT[1].toFixed(2) + 's, an even split would be ' + (dur / 3).toFixed(2) + 's)');

    // The snap. A big energy rise half a second after where the words put the
    // second line, and a smaller one half a second before: the line must land on
    // the louder one, which is the moment something actually starts.
    const hop = 0.02;
    const centre = Math.round(pT[1] / hop);
    const env = new Float32Array(Math.round(dur / hop));
    env[centre + 25] = 1.0;
    env[centre - 25] = 0.6;
    const snapped = T.time(lines, dur, env, hop);
    const sT = parse(snapped);
    ok(Math.abs(sT[1] - (pT[1] + 0.5)) < 0.03,
      'a line snaps onto the loudest rise near it (' + sT[1].toFixed(2) + 's, the rise is at ' + (pT[1] + 0.5).toFixed(2) + 's)');
    ok(sT[0] === pT[0], 'while the first line is left where the layout put it');
    ok(sT[1] > sT[0] + 0.3 && sT[2] > sT[1] + 0.3, 'and the order survives the snap');

    // 73.1.2 - a track that OPENS ON MUSIC. The opening is a beat every half
    // second (six rises in a three second window); the voice enters at 24s at
    // four syllables a second (twelve in the same window). The anchor has to be
    // the voice. A drum rises HARDER than a voice does, so "the first strong
    // rise" - what 73.1.1 used - landed on the beat and lit the first lines
    // during the opening.
    const introEnv = new Float32Array(Math.round(180 / hop));
    for (let t = 0.5; t < 24; t += 0.5) introEnv[Math.round(t / hop)] = 0.6;
    for (let t = 24; t < 150; t += 0.25) introEnv[Math.round(t / hop)] = 1.0;
    const iT = parse(T.time(lines, 180, introEnv, hop));
    ok(iT[0] > 18 && iT[0] < 28,
      'a track that opens on a beat anchors the first line to the voice, not to the music (' + iT[0].toFixed(2) + 's, the voice enters at 24s and it used to sit at 5.4s)');
    ok(iT[1] > iT[0] + 0.3 && iT[2] > iT[1] + 0.3, 'and the rest follow it in order');
    ok(src.indexOf('for(var q = 0; q < t.length; q++){') !== -1,
      'every line is snapped, the first one included');
    ok(src.indexOf('var wNeed = Math.max(4, Math.round(wSpan * 0.05));') !== -1,
      'and the entrance is where the rises come thick and fast, not one strong hit');
    ok(src.indexOf('if(!(voiceStart > 0) || voiceStart > dur * 0.35) voiceStart = 0;') !== -1,
      'with a cluster past a third of the song unable to drag the words with it');

    ok(T.even('[00:01.00]a\n[00:11.00]b\n[00:21.00]c\n[00:31.00]d\n[00:41.00]e\n[00:51.00]f') === true,
      'an even split is recognised as the old guess');
    ok(T.even('[00:01.00]a\n[00:05.00]b\n[00:14.00]c\n[00:19.00]d\n[00:29.00]e\n[00:44.00]f') === false,
      'and real singing is not mistaken for one');
  }

  ok(src.indexOf('Distribute lines evenly across the song duration') === -1,
    'the model prompt no longer asks for an even split');
  ok(src.indexOf('- Space the lines by how long each is actually sung, never an even split') !== -1,
    'it spaces the lines by how long each is actually sung');
  ok(src.indexOf('if(!_aligned && lyrics && lyrics.trim()){') !== -1 && src.indexOf('scAutoTimeCurrentLyrics().then(function(timed){') !== -1,
    'showLyrics times the words from the track itself, unless they are hand-pinned');
  ok(src.indexOf('if(!timed && !_hasStamps && _aiGeminiKey)') !== -1,
    'and only asks the model when there is no audio to measure');
  ok(src.indexOf('if(scAutoTimedKey === _atKey) return false;') !== -1,
    'one attempt per text, so a re-measure cannot loop on its own answer');
  ok(src.indexOf('function scLyricsLookEvenlySpaced(lrc){') !== -1, 'a stored even split is re-measured too');
  ok(src.indexOf("toast('Lyrics timed to this song', 2200)") !== -1, 'and it says so when it does');
  ok(src.indexOf('await blobToArrayBufferFallbackCrop(track.file)') !== -1 && src.indexOf('ctx.decodeAudioData(arr)') !== -1,
    'it measures the decoded audio, not the network');

  // 73.1.1 - the letter wave is paced by the pacer, not by a second clock.
  ok(src.indexOf("style=\"transition-duration:' + fade + 'ms\"") !== -1,
    'each letter carries a fade, sized from the word it belongs to');
  ok(count("transition-delay:' + Math.round(i * step)") === 0,
    'and no additive delay is left - that second clock is what stalled the wave on the first letter');
  ok(src.indexOf('var fade = Math.max(80, Math.min(300, Math.round(step * 2.4)));') !== -1,
    'the fade is bounded at both ends, so a fast word still sweeps instead of lighting as a block');
  ok(src.indexOf('if(frac < acc2){ upto = li + 1; break; }') !== -1,
    'and WHEN a letter lights is still the pacer weighted clock');
  // 73.4 - the wave is no longer word-by-word with a fade on it: the sweep travels
  // along the line, the two words behind the light keep their letters and dim out, and
  // it carries across a line boundary. Pinned by source, then RUN below.
  ok(count('if(wi !== litIdx){ clearLetters(w); return; }') === 0,
    'every other word is no longer wiped on the same frame - that is what made it word-by-word with a fade');
  ok(src.indexOf('var SC_WAVE_TRAIL_WORDS = 2;') !== -1, 'the trail is two words long');
  ok(src.indexOf('const back = (litIdx >= 0 && wi < litIdx) ? (litIdx - wi) : -1;') !== -1,
    'the words behind the light are the ones that keep their letters');
  ok(src.indexOf('if(back >= 1 && back <= SC_WAVE_TRAIL_WORDS){') !== -1,
    'and nothing older than the trail holds a lit letter');
  ok(src.indexOf('function scWaveCarryFrom(prevLine){') !== -1 &&
     src.indexOf("scWaveCarryFrom(lyricsText.querySelector('.lyric-line.current'))") !== -1,
    'the wave crosses a line boundary instead of being cut off at it');
  ok(src.indexOf('.lyric-word.wave-1 .lyric-letter.lit') !== -1 &&
     src.indexOf('.lyric-word.wave-2 .lyric-letter.lit') !== -1,
    'and both trailing steps have their own dimmed gold, scoped so they can glow while the word is no longer current');

  // 73.4 - a sheet with no timings of its own is laid out by the words, not by the
  // line count. RUN the shipped schedule: a long line must own a longer window than a
  // short one, and the result must not be an even split.
  const pAt = src.indexOf('  var SC_WAVE_TRAIL_WORDS = 2;');
  const pEnd = src.indexOf('\n  function scPaceWords(', pAt);
  ok(pAt !== -1 && pEnd > pAt, 'the plain-sheet schedule can be lifted out of the page');
  let P = null;
  try {
    P = new Function('var scSyllableCount = arguments[0]; var scStripLrcStamps = arguments[1];' + src.slice(pAt, pEnd) +
      '\nreturn scPlainSheetStarts;')(T ? T.syl : null, T ? T.strip : null);
  } catch (e) { ok(false, 'and it evaluates: ' + e.message); }
  if (P && T && T.syl && T.strip) {
    const rows = ['short', 'this is a much longer line with a lot of syllables in it', 'tiny', 'another fairly long line here'];
    const st = P(rows.join('\n'), 100);
    ok(st.length === rows.length && st[0] === 0, 'a plain sheet starts at the top of the song');
    ok(st[2] - st[1] > st[1] - st[0],
      'a long line owns a longer window than a short one (' + (st[1] - st[0]).toFixed(1) + 's vs ' + (st[2] - st[1]).toFixed(1) + 's)');
    ok(Math.abs(st[1] - 100 / 4) > 0.5,
      'and an even split by line count is NOT what it does (' + st[1].toFixed(2) + 's, an even split would be 25s)');
    ok(st.every((t, i) => i === 0 || t > st[i - 1]), 'the lines still take over in order');
    ok(P(rows.join('\n'), 100) === st, 'and the schedule is built once per sheet, not on every tick');
    ok(P(rows.join('\n') + '\nand a fifth line', 100) !== st,
      'a different sheet (one more line) is never served the schedule of the one before it');
    ok(new Set(P(rows.join('\n'), 100)).size === rows.length, 'and one line never shares another line start');

    // A song with an instrumental break: the recording says nobody sings from 20s to
    // 40s, so no line may be laid out inside it and the lines after it come after it.
    const hop2 = 0.02, dur2 = 60;
    const bEnv = new Float32Array(Math.round(dur2 / hop2));
    for (let t = 2; t < 20; t += 0.25) bEnv[Math.round(t / hop2)] = 1;
    for (let t = 40; t < 58; t += 0.25) bEnv[Math.round(t / hop2)] = 1;
    const parseLrc = (lrc) => String(lrc).split('\n').map((l) => {
      const m = l.match(/^\[(\d{1,2}):(\d{1,2}(?:\.\d+)?)\]/);
      return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : NaN;
    });
    const bT = parseLrc(T.time(['one two three four five', 'six seven eight nine ten', 'eleven twelve thirteen fourteen', 'fifteen sixteen seventeen'], dur2, bEnv, hop2));
    ok(bT.every((t) => t < 20 || t > 40),
      'no line is laid out inside a measured break (' + bT.map((t) => t.toFixed(1)).join(', ') + ')');
    ok(bT[3] > 40, 'the lines that belong after the break come after it (' + bT[3].toFixed(1) + 's)');
    ok(bT[0] > 1 && bT[0] < 5, 'and the first line still lands where the singing starts');

    // 73.4.1 - A QUIET VERSE IS NOT A BREAK. The owner's words: "The lyrics were
    // fine for song but then it auto did lyrics timed to this song and it like
    // skipped back 5 lines it's not supposed do that dawg". The middle of that song
    // is sung, only softer than its chorus. Reading it as "nobody sings here" cut it
    // out of the timeline, which pushed the lines that belong inside it to the end
    // of the stretch and every line after them late by its whole length - the
    // highlight fell behind the voice the moment the timing applied. RUN it: a soft
    // stretch carries a stream of small rises, so it is refused as a break and the
    // words stay where a song with no break at all puts them.
    const softEnv = (level) => {
      const e = new Float32Array(Math.round(dur2 / hop2));
      for (let t = 2; t < 58; t += 0.25) e[Math.round(t / hop2)] = 1;
      for (let t = 20; t < 40; t += 0.25) e[Math.round(t / hop2)] = 0;    // the soft verse
      for (let t = 20; t < 40; t += 0.4) e[Math.round(t / hop2)] = level;  // ...still sung
      return e;
    };
    const solid = new Float32Array(Math.round(dur2 / hop2));
    for (let t = 2; t < 58; t += 0.25) solid[Math.round(t / hop2)] = 1;
    const soft = softEnv(0.03);
    const w4 = ['one two three four five', 'six seven eight nine ten', 'eleven twelve thirteen fourteen', 'fifteen sixteen seventeen'];
    const softGaps = T.gaps(soft, hop2, dur2);
    ok(!softGaps.some((g) => g.s < 40 && g.e > 20),
      'a verse sung softly is not read as a break (' + (softGaps.map((g) => g.s.toFixed(1) + '-' + g.e.toFixed(1)).join(', ') || 'no gaps') + ')');
    ok(T.gaps(bEnv, hop2, dur2).some((g) => Math.abs(g.s - 20) < 0.5 && Math.abs(g.e - 40) < 0.5),
      'while a stretch the recording really has stopped in is still measured as one');
    const softT = parseLrc(T.time(w4, dur2, soft, hop2));
    const solidT = parseLrc(T.time(w4, dur2, solid, hop2));
    const worstGap = Math.max(...softT.map((t, i) => Math.abs(t - solidT[i])));
    ok(worstGap < 1.5,
      'so the words land where a song with no break puts them, not seconds late (worst ' + worstGap.toFixed(2) + 's, it was 11.26s before the fix)');
    ok(solidT.some((t) => t > 20 && t < 40), 'and a line does belong inside that soft verse - it is being sung');
    ok(softT.every((t, i) => i === 0 || t > softT[i - 1]), 'with the lines still taking over in order');
  }
  ok(src.indexOf('function scSingingWindow(gaps, start, end){') !== -1 &&
     src.indexOf('if(quiet > (end - start) * 0.5) return null;') !== -1,
    'a mostly-empty envelope is not mistaken for breaks');
  // 73.4.1 - quiet is not the same as empty: the deep line that separates a break
  // from a verse sung softly is counted per frame, so a stream of small rises keeps
  // the stretch out of the timeline the words are spread over.
  ok(src.indexOf('var SC_BREAK_SILENCE = 0.1;') !== -1 && src.indexOf('var SC_BREAK_NOISE = 0.02;') !== -1,
    'a break has to be quieter than the quiet floor, by a tenth, over almost all of it');
  ok(src.indexOf('if(env[i] > quietTop) live++;') !== -1 && src.indexOf('if(live <= run * SC_BREAK_NOISE &&') !== -1,
    'and what is counted is how much of the stretch rises even that far');
}

console.log('[8] every converter card leads with MP3 and AIFF is a real output');
{
  ok(count('Spotify to MP3 / WAV / FLAC') === 0, 'the old multi-format Spotify title is gone');
  ok(count('MP4 to WAV / FLAC / MP3 Converter') === 0, 'and the old MP4 one with it');
  ok(count('Spotify to MP3') >= 2, 'the Spotify card reads Spotify to MP3 (' + count('Spotify to MP3') + ')');
  ok(count('YouTube to MP3') >= 2, 'the YouTube card already did');
  ok(count('MP4 to MP3 Converter') === 2, 'and the MP4 card now matches them');

  const opts = (id) => {
    const m = src.match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</select>'));
    return m ? m[1] : '';
  };
  const ids = ['spFmtDisc', 'ytFmtDisc', 'spFmtSettings', 'ytFmtSettings', 'mp4FmtDisc', 'mp4FmtSettings'];
  for (const id of ids) {
    const body = opts(id);
    ok(/^<option value="mp3" selected>MP3<\/option>/.test(body), id + ' opens on MP3');
    ok(body.indexOf('<option value="aiff">AIFF') !== -1, id + ' offers AIFF behind it');
  }
  ok(count('value="aiff"') === 8, 'all eight format menus carry it, the batch and playlist pickers too (' + count('value="aiff"') + ')');

  ok(count('async function scEncodeAiffCooperative(buf, meta, onSlice){') === 1, 'there is one AIFF writer');
  ok(src.indexOf("if(fmt === 'aiff') return await scEncodeAiffCooperative(buf, meta, onSlice);") !== -1,
    'the cooperative dispatcher routes AIFF to it');
  ok(src.indexOf("if(fmt === 'aiff') return null;") !== -1,
    'and the plain synchronous encoder refuses rather than hand back a WAV labelled AIFF');
  ok(count("fmt === 'aiff' ? 'audio/aiff'") === 2, 'the library credits an AIFF as audio/aiff');
  ok(count("if(fmt === 'aiff'){") === 1, 'the MP4 handler routes AIFF as well, instead of falling through to its WAV branch');

  const aAt = src.indexOf('  async function scEncodeAiffCooperative(buf, meta, onSlice){');
  const aEnd = src.indexOf('\n  async function scEncodeAudioCooperative(', aAt);
  ok(aAt !== -1 && aEnd > aAt, 'the AIFF writer can be lifted out of the page');
  const F = new Function('scId3v23Bytes', 'scYieldToUI',
    src.slice(aAt, aEnd) + '\nreturn scEncodeAiffCooperative;')(() => null, () => Promise.resolve());
  const ch0 = new Float32Array(1000), ch1 = new Float32Array(1000);
  for (let i = 0; i < 1000; i++){ ch0[i] = 0.5; ch1[i] = -0.5; }
  const fake = { sampleRate: 44100, length: 1000, numberOfChannels: 2, getChannelData: (c) => (c === 0 ? ch0 : ch1) };
  let blob = null, threw = null;
  try { blob = await F(fake, {}, null); } catch (e){ threw = e; }
  ok(!threw, 'it encodes a 1000-frame stereo buffer without running off the end' + (threw ? ': ' + threw.message : ''));
  if (blob) {
    const dataSize = 1000 * 2 * 2;
    ok(blob.size === 54 + dataSize, 'the file is exactly header + samples (' + blob.size + ', expected ' + (54 + dataSize) + ')');
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const dv = new DataView(bytes.buffer);
    const tag = (o) => String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]);
    ok(tag(0) === 'FORM' && tag(8) === 'AIFF', 'it is a FORM/AIFF container');
    ok(dv.getUint32(4, false) === blob.size - 8, 'whose FORM size counts the whole file after the first eight bytes');
    ok(tag(12) === 'COMM' && dv.getUint32(16, false) === 18, 'with an 18-byte COMM chunk');
    ok(dv.getUint16(20, false) === 2 && dv.getUint32(22, false) === 1000, 'carrying the two channels and the 1000 frames');
    ok(dv.getUint16(26, false) === 16, 'at 16 bits a sample');
    ok(dv.getUint16(28, false) === 0x400E, 'and the 80-bit sample rate exponent for 44100 (' + dv.getUint16(28, false).toString(16) + ')');
    ok(tag(38) === 'SSND' && dv.getUint32(42, false) === 8 + dataSize, 'then the sample chunk, sized to hold the audio');
    ok(dv.getInt16(54, false) === 16384 && dv.getInt16(56, false) === -16384, 'big-endian, left channel then right');
    ok(src.indexOf("return new Blob([buffer], { type: 'audio/aiff' });") !== -1, 'and the blob is typed as AIFF');
  }
}

console.log('[9] the repin moved every gate, including the neighbour');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-7316.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '" + VER_BEFORE + "';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '73.1.6';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  // Both spellings carry each dot as `\.` or `[.]`, so neither the cache move
  // nor the stale check can mistake the needle for a cache literal.
  ok(repin.indexOf("SWEEP_ESC_NEW = 'sidecut-shell-v73' + BS + '.1' + BS + '.5(?![' + BS + 'd.])'") !== -1 &&
     repin.indexOf("SWEEP_BRK_NEW = 'sidecut-shell-v73[.]1[.]5(?![' + BS + 'd.])'") !== -1,
    'the stale-cache sweeps are retargeted to 73.1.5, built from character codes');
  ok(repin.indexOf("SWEEP_ESC_OLD = 'sidecut-shell-v73' + BS + '.1' + BS + '.4(?![' + BS + 'd.])'") !== -1, 'from the spelling repin-7315 left behind');
  ok(repin.indexOf("bespoke('test-6137.mjs'") !== -1 && repin.indexOf("bespoke('test-6138.mjs'") !== -1,
    'and the comma-less changelog-head regex pin is retargeted');
  ok(repin.indexOf('esc(OLDCACHE)') !== -1, 'the cache move is derived, not typed');
  ok(repin.indexOf("const PREV_OLD = '" + PREV_BEFORE + "';") !== -1 && repin.indexOf("const PREV_NEW = '73.1.5';") !== -1,
    'and the adjacent-entry pin DOES move, because this release adds an entry above it (the file this reads is repin-7316 itself, so its own PREV_NEW is the value; later repins retarget it in their own file)');

  const stale = [];
  for (const name of fs.readdirSync(path.join(ROOT, 'dev')).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    if (name === 'test-705.mjs' || name === 'test-70.mjs') continue;
    const t = fs.readFileSync(path.join(ROOT, 'dev', name), 'utf8');
    if (t.indexOf("const VER = '" + VER_BEFORE + "';") !== -1) stale.push(name + ' VER');
    if (t.indexOf("const VER = '" + PREV_BEFORE + "';") !== -1) stale.push(name + ' old VER');
    if (OLD_CACHE_RE.test(t)) stale.push(name + ' cache');
  }
  ok(stale.length === 0, 'no gate still pins the build this release renumbered (' + stale.join(',') + ')');

  const left = PREV_GATES.filter((n) =>
    fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf("const PREV = '" + PREV + "';") === -1);
  ok(left.length === 0, 'every one of the ' + PREV_GATES.length + ' adjacent-entry pins moved to ' + PREV + ' (' + left.join(',') + ')');
  const behind = PREV_GATES.filter((n) =>
    fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf("const PREV = '" + PREV_BEFORE + "';") !== -1);
  ok(behind.length === 0, 'and none was left behind on the old neighbour (' + behind.join(',') + ')');
}

console.log('[10] inline script syntax and the OTA tail');
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

console.log('[11] a tap pins the line, and the timing is rebuilt around the taps');
{
  ok(count('id="lyricsLineUpBtn"') === 1, 'the lyrics bar has one Line up chip');
  ok(src.indexOf("$('lyricsLineUpBtn').addEventListener('click'") !== -1, 'and it is wired');
  ok(src.indexOf('var lyricsLineUpOn = false;') !== -1, 'the mode has its own flag');
  ok(src.indexOf('if (lyricsLineUpOn) {') !== -1 && src.indexOf('ev.stopPropagation();') !== -1,
    'and in that mode a tap on a line pins it instead of seeking');
  ok(src.indexOf('pinned at ') !== -1, 'the toast says where each tap landed');
  ok(src.indexOf('updateLyricsLineUpBtn') !== -1 && src.indexOf('scLyricAlignLoad') !== -1, 'the pins are loaded per song');

  const mAt = src.indexOf('  function scParseLrcLines(lrc){');
  const mEnd = src.indexOf('\n  var scAutoSyncBusy = {};', mAt);
  ok(mAt !== -1 && mEnd > mAt, 'the aligning code can be lifted out of the page');
  let A = null;
  try {
    A = new Function(src.slice(mAt, mEnd) + '\nreturn { parse: scParseLrcLines, apply: scApplyLyricAnchors, fmt: scFormatLrcRows };')();
  } catch (e){ ok(false, 'and it evaluates: ' + e.message); }
  ok(A && typeof A.apply === 'function', 'the shipped aligning code evaluates');
  if (A) {
    const base = '[00:10.00]one\n[00:20.00]two\n[00:30.00]three\n[00:40.00]four\n[00:50.00]five';
    const times = (lrc) => A.parse(lrc).map((r) => r.t);
    const out = A.apply(base, [{ i: 1, t: 18 }, { i: 3, t: 45 }]);
    const t = times(out);
    ok(Math.abs(t[1] - 18) < 0.01 && Math.abs(t[3] - 45) < 0.01, 'each tap lands exactly where it was tapped');
    ok(t[0] < t[1] && t[1] < t[2] && t[2] < t[3] && t[3] < t[4], 'and the lines stay in order');
    ok(Math.abs(t[2] - 31.5) < 0.05, 'a line between two taps keeps the base shape, rescaled into the window (' + t[2] + ')');
    ok(Math.abs(t[0] - 8) < 0.01 && Math.abs(t[4] - 55) < 0.01, 'a line outside the taps shifts by the nearest one');
    ok(A.apply(base, []) === base, 'no taps leaves the timing untouched');
    ok(times(A.apply(base, [{ i: 2, t: 3 }, { i: 1, t: 9 }])).every((n) => isFinite(n)),
      'a tap out of order cannot make a NaN stamp');
  }
  ok(src.indexOf('if(!_aligned && lyrics && lyrics.trim()){') !== -1,
    'showLyrics never re-measures a timing the user pinned by hand');
  ok(src.indexOf('scLyricsAlignedNow') !== -1 && src.indexOf('t.lyricsAligned = true') !== -1,
    'the pinned state is recorded on the track');
  ok(count('lyricsAligned: t.lyricsAligned || false,') === 1 && count('lyricsAligned: r.lyricsAligned || false,') === 1,
    'and persisted into the track record, so a restart keeps it');
}

console.log('[12] AI Sync sends the recording, not only the words');
{
  ok(src.indexOf('var audioPart = null;') !== -1, 'the sync builds an audio part from the track');
  ok(src.indexOf('blobToArrayBufferFallbackCrop(t.file)') !== -1, 'by reading the same bytes the pacer decodes');
  ok(src.indexOf('scBytesToBase64(_arr)') !== -1, 'and base64ing them in chunks');
  ok(src.indexOf('inline_data: { mime_type: _mime, data: _b64 }') !== -1, 'as a Gemini inline_data attachment');
  ok(src.indexOf('var _parts = audioPart ? [{ text: prompt }, audioPart] : [{ text: prompt }];') !== -1,
    'which rides beside the text prompt in the same request');
  ok(src.indexOf("The song's audio recording is attached") !== -1, 'and the prompt tells the model to listen to it');
  ok(src.indexOf('if(_b64.length <= 18000000)') !== -1, 'a recording past the body ceiling falls back to the text-only ask');

  // The base64 helper is lifted out and RUN: a chunk that is not a multiple of
  // three would leave padding in the middle of the output and break every upload
  // a song long, so a buffer past one chunk is the case that matters.
  const gAt = src.indexOf('  function scBytesToBase64(buf){');
  const gEnd = src.indexOf('\n  }', gAt) + 4;
  ok(gAt !== -1 && gEnd > gAt, 'the base64 helper can be lifted out of the page');
  const B = new Function('btoa', src.slice(gAt, gEnd) + '\nreturn scBytesToBase64;')((s) => Buffer.from(s, 'binary').toString('base64'));
  function roundTrips(n){
    const big = new Uint8Array(n);
    for (let i = 0; i < n; i++) big[i] = (i * 7) & 255;
    const dec = Buffer.from(B(big.buffer), 'base64');
    return dec.length === n && dec.equals(Buffer.from(big));
  }
  ok(roundTrips(10), 'a short buffer round-trips');
  ok(roundTrips(0x8000), 'and one exactly the old chunk size, where the padding used to land (' + 0x8000 + ')');
  ok(roundTrips(200000), 'and one several chunks long, byte for byte');
}

console.log('[13] the model does the timing and a tap only lights the line');
{
  // AI first: the automatic path asks the model, with the song's own bytes,
  // before it falls back to the energy stand-in.
  ok(src.indexOf('var scAiTimedTracks = {};') !== -1, 'the auto path remembers which songs it already asked about');
  ok(src.indexOf('if(_aiGeminiKey && t.file && !scAiTimedTracks[String(tid)]){') !== -1,
    'the model is asked first when a key is set and the song is here');
  ok(src.indexOf('var _aiOk = await aiSyncLyrics(true);') !== -1 && src.indexOf("if(_aiOk){ toast('Lyrics timed to this song by AI', 2200); return true; }") !== -1,
    'and a model answer is used instead of the length-based layout');
  ok(src.indexOf('var lrc = await scSyncLyricsFromAudio(t, currentLyricsText);') !== -1,
    'with the energy measurement left as the stand-in for a song the model cannot hear');
  ok(src.indexOf('if(silent && scAiTimedTracks[String(t.id)]) { return false; }') !== -1,
    'the automatic ask happens once per song, while the button can always retry');
  ok(src.indexOf('currentLyricsSynced && !scLyricsLookEvenlySpaced(rawLyrics) &&') !== -1,
    'and a stored length-based timing is still allowed to be re-timed by the model');
  ok(src.indexOf('Follow the tempo, the beat, the instrumental sections and the returning choruses') !== -1,
    'the prompt names the music the model should read');
  ok(count('Follow the tempo') === 1, 'and that guidance appears once');

  const aiAt = src.indexOf('async function aiSyncLyrics(silent) {');
  const aiEnd = src.indexOf('  // Wire up highlight + AI sync buttons', aiAt);
  ok(aiAt !== -1 && aiEnd > aiAt, 'the sync can be lifted out of the page');
  const aiBody = src.slice(aiAt, aiEnd);
  ok(aiBody.indexOf('return true;') !== -1, 'and the sync reports success so the caller can skip the stand-in');
  ok(aiBody.indexOf('scBytesToBase64(_arr)') !== -1 && aiBody.indexOf('inline_data: { mime_type: _mime, data: _b64 }') !== -1,
    'still sending the recording itself, not only the words');

  // Highlight only: the tap path no longer writes the playhead.
  ok(count('seekLyricsTo') === 0, 'the old tap-to-seek helper is gone');
  ok(src.indexOf('audio.currentTime = t;') === -1, 'so no tap path writes the playhead any more');
  ok(src.indexOf('if (line) { ev.stopPropagation(); scHighlightTapLine(line); }') !== -1,
    'a tap on a line calls the highlight helper');
  ok(src.indexOf('function scHighlightTapLine(el){') !== -1, 'which lights the line and scrolls it into view');
  ok(src.indexOf('lyricsTapHoldUntil = Date.now() + 5000;') !== -1, 'and holds it so the tracker cannot steal it straight back');
  ok(src.indexOf('if (!_tapHeld && currentIdx !== lastLyricsIdx) {') !== -1 &&
     src.indexOf('if (!_tapHeld2 && targetIdx !== lastLyricsIdx) {') !== -1,
    'the playback tracker respects the hold on both the synced and the plain paths');
  ok(src.indexOf('if (lyricsLineUpOn) {') !== -1 && src.indexOf('t: audio.currentTime }') !== -1,
    'and a Line up tap still only READS the clock to pin the line');
}

console.log('[14] Settings gains an Important tab beside Donate');
{
  ok(count('id="settingsTabImportant"') === 1, 'the strip has one Important tab');
  ok(count('id="settingsPaneImportant"') === 1, 'and one Important pane');
  const order = ['settingsTabDonate', 'settingsTabImportant', 'settingsTabGlow'].map((id) => src.indexOf('id="' + id + '"'));
  ok(order.every((i) => i !== -1) && order[0] < order[1] && order[1] < order[2],
    'and it sits right after Donate, before Glow');

  // The Gemini key moved out of Support into Important - one field, one home.
  ok(count('id="aiGeminiKeyInput"') === 1, 'the Gemini key field appears exactly once');
  const paneAt = src.indexOf('id="settingsPaneImportant"');
  const keyAt = src.indexOf('id="aiGeminiKeyInput"');
  const widgetAt = src.indexOf('id="settingsPaneWidget"');
  ok(paneAt !== -1 && keyAt > paneAt && keyAt < widgetAt, 'and it lives inside the Important pane');
  const supAt = src.indexOf('id="settingsPaneSupport"');
  const moreAt = src.indexOf('id="settingsPaneMore"');
  const sup = src.slice(supAt, moreAt);
  ok(sup.indexOf('aiGeminiKeyInput') === -1, 'the Support pane no longer carries the key field');
  ok(sup.indexOf('id="aiChatMessages"') !== -1 && sup.indexOf('sidecutsupport@gmail.com') !== -1,
    'while its chat and contact card stay put');

  // The feature map moved out of More and into Important.
  ok(count('id="collapsibleFeatureMap"') === 1, 'the feature map appears exactly once');
  const mapAt = src.indexOf('id="collapsibleFeatureMap"');
  ok(mapAt > paneAt && mapAt < widgetAt, 'and it sits inside the Important pane, not More');
  ok(src.slice(supAt, moreAt).indexOf('collapsibleFeatureMap') === -1, 'More no longer lists it');

  // The tab is wired like every other one.
  ok(src.indexOf("$('settingsPaneImportant').style.display = tab === 'important' ? '' : 'none';") !== -1,
    'the pane shows and hides with its tab');
  ok(src.indexOf("$('settingsTabImportant').addEventListener('click', () => showSettingsTab('important'));") !== -1,
    'and the tab button opens it');
  ok(src.indexOf("'donate', 'important', 'refresh'") !== -1, 'the new tab is a known settings destination');
  ok(src.indexOf("if(tab === 'ai') tab = 'important';") !== -1, 'and the old AI deep link lands on it too');
}

console.log('[15] the key confirms itself, and the recording checks the model');
{
  // (1) the paste confirms the key out loud.
  ok(src.indexOf("toast('Gemini key connected") !== -1, 'pasting a key confirms it with a toast');
  ok(src.indexOf('window._aiSetGeminiKey(true);') !== -1, 'the paste button forces that confirmation');
  ok(src.indexOf('var _aiLastSavedKey = _aiGeminiKey;') !== -1, 'a remembered value keeps it to once per key');
  ok(src.indexOf('if (changed || force) {') !== -1, 'so typing does not re-toast while a paste always does');

  // (2) one key field, in Important - and the links say so.
  ok(count('id="aiGeminiKeyInput"') === 1, 'there is still exactly one key field');
  ok(src.indexOf('Open Settings → Important</span> to paste a Gemini API key') !== -1,
    'the dashboard link names the tab the field actually lives in');
  ok(src.indexOf('and paste it in Settings → Important.') !== -1, 'and so does the 404 helper text');

  // (3) the model is told the count, checked, and snapped to the recording.
  ok(src.indexOf('Lines to time: ') !== -1 && src.indexOf('return exactly ') !== -1,
    'the prompt names how many lines there are and demands the same number back');
  ok(src.indexOf('- Put the first line at the moment the FIRST WORDS ARE SUNG') !== -1,
    'the first line is placed where the singing starts, not at a pinned 00:01');
  ok(src.indexOf('[00:01.00]') === -1, 'so the old pinned first-line rule is gone');
  ok(src.indexOf('var _aiAskLyrics = async function(parts){') !== -1, 'the request is reusable for a retry');
  ok(src.indexOf('Your previous answer had ') !== -1, 'a short answer is asked again, with the count it owes');
  ok(src.indexOf('delete scAiTimedTracks[String(t.id)];') !== -1, 'and a failed ask is forgotten so a later open can retry');
  ok(src.indexOf('scSnapRowsToOnsets(_cleared, _aiEnv, SC_ONSET_HOP, 0.9, _gaps)') !== -1,
    'the model answer is snapped onto the recording own energy rises');
  ok(src.indexOf('if(scLyricsLookEvenlySpaced(text)){') !== -1,
    'and an even split dressed up as a timing is refused');
  ok(src.indexOf('if(_rows.length && _aiEnv){') !== -1, 'and the snap runs once the recording has been measured');

  const gAt = src.indexOf('  function scRowsLookSane(rows, duration){');
  const sEnd = src.indexOf('\n  // Rebuild the timings around the taps.', gAt);
  ok(gAt !== -1 && sEnd > gAt, 'the new timing checks can be lifted out of the page');
  let J = null;
  try { J = new Function(src.slice(gAt, sEnd) + '\nreturn { sane: scRowsLookSane, snap: scSnapRowsToOnsets };')(); }
  catch (e) { ok(false, 'and they evaluate: ' + e.message); }
  ok(J && typeof J.sane === 'function' && typeof J.snap === 'function', 'the shipped checks evaluate');
  if (J) {
    ok(J.sane([{ t: 1 }, { t: 2 }, { t: 3 }], 200) === true, 'a rising timing inside the song is sane');
    ok(J.sane([{ t: 3 }, { t: 2 }], 200) === false, 'one that goes backwards is not');
    ok(J.sane([{ t: 5 }, { t: 500 }], 200) === false, 'nor one that runs past the end');
    ok(J.sane([{ t: 1 }], 200) === false, 'and a single line cannot be trusted');
    const env = new Float32Array(200); env[50] = 1;
    const snapped = J.snap([{ t: 0.7 }, { t: 3.0 }], env, 0.02, 1.3);
    ok(Math.abs(snapped[0].t - 1.0) < 0.021, 'a line near a rise is pulled onto it (' + snapped[0].t + ')');
    ok(snapped[1].t === 3.0, 'a line with no rise near it is left alone');
    ok(snapped[0].t <= snapped[1].t, 'and snapping never reorders the lines');
    ok(J.snap([{ t: 2 }], null, 0.02, 1.3)[0].t === 2, 'no envelope leaves the timing untouched');
  }
}

console.log('[16] the tricky songs are timed from the shape of the recording');
{
  ok(src.indexOf('function scFindQuietGaps(env, hopSec, duration){') !== -1, 'the quiet gap finder ships');
  ok(src.indexOf('function scPullRowsClearOfGaps(rows, gaps){') !== -1, 'and the pull-out-of-gaps helper');
  ok(src.indexOf('_gaps = scFindQuietGaps(_aiEnv, SC_ONSET_HOP, duration)') !== -1,
    'the recording is measured before the model is asked');
  ok(src.indexOf('The recording has no singing at these times') !== -1, 'and the model is handed the map');
  ok(src.indexOf('This track may mix languages or scripts, pause part-way through, change speed, or open on a long instrumental') !== -1,
    'and told the song may change shape or language');
  ok(src.indexOf('- Where the song pauses, speeds up or slows down, follow the recording rather than an average') !== -1,
    'the rules cover a tempo change');
  ok(src.indexOf('if(skip && skip[f]) continue;') !== -1, 'the snap never targets an instrumental frame');
  ok(src.indexOf('scSnapRowsToOnsets(_cleared, _aiEnv, SC_ONSET_HOP, 0.9, _gaps)') !== -1, 'on a shorter window');

  // 73.4.1 - the lift starts at the deep line the quiet floor is measured against
  // now, which sits with the floor rather than up at the onset constants, so the
  // shipped code keeps its own numbers.
  const gAt = src.indexOf('  var SC_BREAK_SILENCE = 0.1;');
  const gEnd = src.indexOf('\n  // Rebuild the timings around the taps.', gAt);
  ok(gAt !== -1 && gEnd > gAt, 'the gap measuring code can be lifted out of the page');
  let G = null;
  try { G = new Function(src.slice(gAt, gEnd) + '\nreturn { floor: scQuietFloor, gaps: scFindQuietGaps, pull: scPullRowsClearOfGaps };')(); }
  catch (e) { ok(false, 'and it evaluates: ' + e.message); }
  ok(G && typeof G.gaps === 'function' && typeof G.pull === 'function', 'the shipped gap code evaluates');
  if (G) {
    const env = new Float32Array(250);
    for (let i = 0; i < 50; i++) env[i] = 1;
    for (let i = 200; i < 250; i++) env[i] = 1;
    const gaps = G.gaps(env, 0.02, 10);
    ok(gaps.length === 1, 'one quiet stretch is found in the middle (' + gaps.length + ')');
    if (gaps.length) {
      ok(Math.abs(gaps[0].s - 1.0) < 0.05 && Math.abs(gaps[0].e - 4.0) < 0.05,
        'spanning exactly the silent run (' + gaps[0].s.toFixed(2) + ' to ' + gaps[0].e.toFixed(2) + ')');
    }
    ok(G.gaps(new Float32Array(100).fill(1), 0.02, 2).length === 0, 'a wall of sound has no gap');
    const rows = [{ t: 0.5 }, { t: 2.5 }, { t: 7.0 }];
    const out = G.pull(rows, gaps);
    ok(Math.abs(out[1].t - 4.0) < 0.05, 'a line inside the break moves to where the voice resumes (' + out[1].t.toFixed(2) + ')');
    ok(out[0].t === 0.5 && out[2].t === 7.0, 'lines outside the break are left alone');
    ok(out[0].t <= out[1].t && out[1].t <= out[2].t, 'and the order is kept');
    ok(G.pull(rows, []) === rows, 'no gaps leaves the timing untouched');
  }
}

console.log('[17] the how-to steps put the songs in the library by themselves');
{
  const slice = (from, to) => {
    const a = src.indexOf(from);
    const b = src.indexOf(to, a);
    return a === -1 || b === -1 ? '' : src.slice(a, b);
  };
  const disc = slice('id="getSongsHowToDisc"', '<!-- Expand URL card -->');
  const settings = slice('id="getSongsHowToSettings"', '<!-- Expand URL card -->');
  ok(disc !== '' && settings !== '', 'both how-to boxes can be sliced out');
  for (const [label, box] of [['Discover', disc], ['Settings', settings]]) {
    ok(box.indexOf('already in your library') !== -1, label + ': the last step says the song is already in the library');
    ok(box.indexOf('Nothing to import') !== -1, label + ': and that there is nothing to import');
    ok(box.indexOf('Import to Library') === -1, label + ': the stale Import to Library step is gone');
    ok(box.indexOf('Save the file too') !== -1, label + ': saving the file is named as the optional extra');
    ok(box.indexOf('a drop-down opens') !== -1 && box.indexOf('Conversion Tools') !== -1 && box.indexOf('Convert') !== -1,
      label + ': and the tap steps the older gates pin still survive');
    ok(box.indexOf('+ Add songs') !== -1 && box.indexOf('Library') !== -1,
      label + ': and the two-ways-in intro is intact');
  }
  ok(count('Import to Library</b> — the file keeps') === 0,
    'no how-to box still teaches the old save-or-import step');
}

console.log('[18] a track that opens on a beat is timed from where the VOICE enters');
{
  // 74 - the entrance detector counted FRAMES above the bar, so what it measured was
  // how LONG each hit lasted. A punchy drum kit holds a hit across two or three
  // frames while a voice is one, so a drum intro on its own reached the count a voice
  // does: measured on the synthetic recording below (24s of drums, then the voice),
  // the shipped code put the entrance at 0.00s and the whole sheet 14 seconds from
  // the voice. This RUNS the shipped measuring code on that recording.
  const at = src.indexOf('  var SC_ONSET_HOP = 0.02;');
  const end = src.indexOf('\n  function showLyrics(', at);
  ok(at !== -1 && end > at, 'the measuring code can be lifted out of the page');
  let E = null;
  try { E = new Function(src.slice(at, end) + '\nreturn { env: scOnsetEnvelope, time: scTimeLyricsFromOnsets };')(); }
  catch (e) { ok(false, 'and it evaluates: ' + e.message); }
  ok(E && typeof E.env === 'function', 'and the shipped measuring code evaluates');

  if (E) {
    const SR = 8000, HOP2 = 0.02, DUR = 90;
    // A beat every `beats` seconds across the file, plus a voice with four
    // articulations a second from `enterSec` on. The energy envelope comes out of
    // the shipped scOnsetEnvelope, not out of a hand-made array.
    function recording(enterSec, beats){
      const n = Math.round(DUR * SR), data = new Float32Array(n);
      for (let t = 0; t < DUR; t += beats){
        const a = Math.round(t * SR), b = Math.min(n, Math.round((t + 0.12) * SR));
        for (let i = a; i < b; i++) data[i] += 0.9 * Math.exp(-(i / SR - t) * 45) * Math.sin(2 * Math.PI * 90 * (i / SR - t));
      }
      for (let i = Math.round(enterSec * SR); i < n; i++){
        const t = i / SR, ph = ((t - enterSec) * 4) % 1;
        const e2 = ph < 0.06 ? ph / 0.06 : Math.exp(-(ph - 0.06) * 9);
        data[i] += 0.5 * (0.35 + 0.65 * e2) * Math.sin(2 * Math.PI * 220 * t);
      }
      return { sampleRate: SR, length: n, numberOfChannels: 1, getChannelData: () => data };
    }
    const parse = (lrc) => String(lrc).split('\n').map((l) => {
      const m = l.match(/^\[(\d{1,2}):(\d{2}(?:\.\d+)?)\]/);
      return m ? parseInt(m[1], 10) * 60 + parseFloat(m[2]) : NaN;
    });
    const lines = Array.from({ length: 7 }, (_, i) => 'line number ' + (i + 1) + ' sung here');

    const first = parse(E.time(lines, DUR, E.env(recording(24, 0.5)), HOP2))[0];
    ok(Math.abs(first - 24) < 0.6,
      'the first line lands on the voice, not on the opening beat (' + first.toFixed(2) + 's, the voice enters at 24s and it used to sit at 4.8s)');
    ok(src.indexOf('if(env[e0] >= bar && (e0 === 0 || env[e0 - 1] < bar)) edge[e0] = 1;') !== -1,
      'an articulation is counted as a RISING EDGE, not as every frame it stays above the bar');
    ok(src.indexOf('if(_c >= SC_ENTRANCE_STREAM){ _found = s1; break; }') !== -1 && src.indexOf('var SC_ENTRANCE_STREAM = 4;') !== -1,
      'and the entrance is the first attack with more right behind it - a stream, which a beat cannot be');

    // A backing that only ever beats and never sings: there is no entrance to find,
    // so the lead-in stands - the detector must not invent one.
    const drumsOnly = parse(E.time(lines, DUR, E.env(recording(1e9, 0.5)), HOP2))[0];
    ok(drumsOnly < 6.5, 'a track with no voice at all keeps the lead-in rather than naming a beat (' + drumsOnly.toFixed(2) + 's)');

    // The shape the older checks pin: a beat every half second for 24s, then a voice
    // twice as dense. That entrance still has to be found.
    const introEnv = new Float32Array(Math.round(180 / HOP2));
    for (let t = 0.5; t < 24; t += 0.5) introEnv[Math.round(t / HOP2)] = 0.6;
    for (let t = 24; t < 150; t += 0.25) introEnv[Math.round(t / HOP2)] = 1.0;
    const iT = parse(E.time(lines, 180, introEnv, HOP2));
    ok(iT[0] > 18 && iT[0] < 28, 'and the long-intro shape the older checks pin still anchors to the voice (' + iT[0].toFixed(2) + 's)');
  }
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
