// 73.1 - the lyrics with no timings are timed from the song's own audio instead
// of an even split, and every converter card reads "... to MP3" with a new lossless
// output (AIFF) behind it.
//
// This is a fix inside 73, not a new release line: the third number stops at nine,
// so the release after 73 is 73.1, exactly as 72.8 was followed by 72.8.1.
//
// The owner's words for this fix:
//   * "Lyrics is still very off no language change or not this song is a good
//     example it's really not getting the lyrics right at all";
//   * "make this even all of them should say to mp3 and get more formats to
//     convert to".
//
// The song in the report ("On The Loose" by Sukha) is the case: LRCLIB carries it
// in plain text with no timings at all, it mixes Italian and Punjabi, and the only
// automatic timing was a model asked to "distribute lines evenly across the song
// duration". An even split follows the LINE COUNT, so a short intro and a repeated
// chorus push every later line away from the voice - which is exactly what the
// screenshot shows.
//
// [7] lifts the shipped measuring code out of the page and RUNS it: it lays the
// lines out by syllables and snaps each start onto the loudest energy rise within
// a second of where the words put it. [8] runs the shipped AIFF writer against a
// synthetic buffer and reads the container back byte by byte - that is how the
// header size bug (8 bytes short, so every write ran past the buffer) was caught.
//
// Version note: 72.8.1 is a PREFIX of nothing here, but '73' is a prefix of '73.1'
// - the repin is checked for that, not this file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const widgetPy = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-widget.py'), 'utf8');

const VER = '73.1'; /* repinned by dev/repin-731.mjs */
const PREV = '73'; /* repinned by dev/repin-731.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1';

// The gates that carry the adjacent-entry pin. repin-731 moves all of them.
const PREV_GATES = [
  'test-713.mjs', 'test-714.mjs', 'test-715.mjs', 'test-716.mjs', 'test-717.mjs',
  'test-718.mjs', 'test-719.mjs', 'test-720.mjs', 'test-721.mjs', 'test-722.mjs',
  'test-723.mjs', 'test-724.mjs', 'test-725.mjs', 'test-7251.mjs', 'test-7252.mjs',
  'test-726.mjs', 'test-727.mjs', 'test-7271.mjs', 'test-728.mjs', 'test-7281.mjs',
  'test-731.mjs',
];

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
// Split so no literal old build number or old cache name is ever spelled in this
// file - the repin sweep rewrites those strings, and a bare one here would be
// rewritten with it.
const V7 = '7' + '3';
const PREV_BEFORE = '72' + '.8.1';
const OLD_CACHE_RE = new RegExp('sidecut-shell-v' + V7 + '(?![\\d.])');

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
    'the letter wave is allowed to spread across a whole word instead of piling up at the front');
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
  const end = src.indexOf('\n  function showLyrics(lyrics, isSynced) {', at);
  ok(at !== -1 && end > at, 'the measuring code can be lifted out of the page');
  const block = src.slice(at, end);
  let T = null;
  try {
    T = new Function(block + '\nreturn { syl: scSyllableCount, env: scOnsetEnvelope, time: scTimeLyricsFromOnsets, even: scLyricsLookEvenlySpaced };')();
  } catch (e){ ok(false, 'and it evaluates: ' + e.message); }
  ok(T && typeof T.time === 'function' && typeof T.env === 'function' && typeof T.even === 'function', 'the shipped timing code evaluates');

  if (T) {
    // Scripts are counted as units, not letters: a two-character CJK word has to
    // earn a real share of a bilingual line.
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
    ok(sT[0] === pT[0], 'while the first line is left where the lead-in put it');
    ok(sT[1] > sT[0] + 0.3 && sT[2] > sT[1] + 0.3, 'and the order survives the snap');

    ok(T.even('[00:01.00]a\n[00:11.00]b\n[00:21.00]c\n[00:31.00]d\n[00:41.00]e\n[00:51.00]f') === true,
      'an even split is recognised as the old guess');
    ok(T.even('[00:01.00]a\n[00:05.00]b\n[00:14.00]c\n[00:19.00]d\n[00:29.00]e\n[00:44.00]f') === false,
      'and real singing is not mistaken for one');
  }

  ok(src.indexOf('Distribute lines evenly across the song duration') === -1,
    'the model prompt no longer asks for an even split');
  ok(src.indexOf('in proportion to how long each is sung - a short line takes less time than a long one, and never an even split') !== -1,
    'it spaces the lines by how long each is actually sung');
  ok(src.indexOf('if(lyrics && lyrics.trim()){') !== -1 && src.indexOf('scAutoTimeCurrentLyrics().then(function(timed){') !== -1,
    'showLyrics times the words from the track itself');
  ok(src.indexOf('if(!timed && !_hasStamps && _aiGeminiKey)') !== -1,
    'and only asks the model when there is no audio to measure');
  ok(src.indexOf('if(scAutoTimedKey === _atKey) return false;') !== -1,
    'one attempt per text, so a re-measure cannot loop on its own answer');
  ok(src.indexOf('function scLyricsLookEvenlySpaced(lrc){') !== -1, 'a stored even split is re-measured too');
  ok(src.indexOf("toast('Lyrics timed to this song', 2200)") !== -1, 'and it says so when it does');
  ok(src.indexOf('await blobToArrayBufferFallbackCrop(track.file)') !== -1 && src.indexOf('ctx.decodeAudioData(arr)') !== -1,
    'it measures the decoded audio, not the network');
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

  // Run the shipped writer against a synthetic buffer and read the container back.
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
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-731.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '" + V7 + "';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '73.1';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  // The needle is written `v7[3]`, not `v73`: this release has no dot to escape,
  // so a bare `v73` needle was itself rewritten by the cache sweep on the first
  // run and the gate went hunting the release it was shipping.
  ok(repin.indexOf('sidecut-shell-v7[3](?!') !== -1,
    'the stale-cache sweeps are retargeted to this line, needle written raw');
  ok(repin.indexOf('sidecut-shell-v72[.]9(?!') !== -1, 'from the line before it, which is what they hunted');
  ok(repin.indexOf("bespoke('test-6137.mjs'") !== -1 && repin.indexOf("bespoke('test-6138.mjs'") !== -1,
    'and the comma-less changelog-head regex pin is retargeted');
  ok(repin.indexOf("bespoke('test-727.mjs'") !== -1 && repin.indexOf('Spotify to MP3') !== -1,
    'and the converter card the step text names moves with its new title');
  ok(repin.indexOf('esc(OLDCACHE)') !== -1, 'the cache move is derived, not typed');
  ok(repin.indexOf("const PREV_OLD = '72.8.1';") !== -1 && repin.indexOf("const PREV_NEW = '" + V7 + "';") !== -1,
    'and the adjacent-entry pin DOES move, because this release adds an entry above it');

  const stale = [];
  for (const name of fs.readdirSync(path.join(ROOT, 'dev')).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    if (name === 'test-705.mjs' || name === 'test-70.mjs' || name === 'test-731.mjs') continue;
    const t = fs.readFileSync(path.join(ROOT, 'dev', name), 'utf8');
    if (t.indexOf("const VER = '" + V7 + "';") !== -1) stale.push(name + ' VER');
    if (t.indexOf("const VER = '" + PREV_BEFORE + "';") !== -1) stale.push(name + ' old VER');
    if (OLD_CACHE_RE.test(t)) stale.push(name + ' cache');
  }
  ok(stale.length === 0, 'no gate still pins the build this release renumbered (' + stale.join(',') + ')');

  const left = PREV_GATES.filter((n) =>
    fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf("const PREV = '" + PREV + "';") === -1);
  ok(left.length === 0, 'every one of the ' + PREV_GATES.length + ' adjacent-entry pins moved to ' + PREV + '(' + left.join(',') + ')');
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

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
