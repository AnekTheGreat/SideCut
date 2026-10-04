// 73 - the lyrics follow the voice by syllable, long saves can be stopped,
// new releases stop repeating and old drops leave the Home bubble, the widget
// plays without opening the app, and the guide becomes a feature map.
//
// This is the 72.9 work shipped as 73. The 72 line stops at .9, so 72.9 was the
// last in it and the next release in the line is 73 (AGENTS.md, and the version
// guide in Settings). The release itself is unchanged - only its number moved,
// which is why dev/repin-73.mjs only carries the mechanical sweep plus the two
// needle retargets below.
//
// The owner's words, in order:
//   * "The lyrics highlight word by word everything is just completely off. It
//     should be like Spotify ... for songs with multiple languages in them it is
//     completely off if it changes tempo from slow to fast or vice versa";
//   * "there needs to be a way to cancel downloads like crossfaded mixes
//     downloading playlists stuff like that there needs to be an x button";
//   * "in new releases there shouldn't be so many duplicates and new releases in
//     the home bubble should only display songs up to 1 month old";
//   * "if I have the app open and didnt close it in the background from the
//     widget I should just be able to play the song I shouldnt have to go into
//     the app";
//   * "Make more things easier and make the instructions to use the app and
//     explain the vast amount of features easier. Then add more features".
//
// The pacing is measured in SYLLABLES now, not characters, so [2] lifts the
// shipped pacer out of the page and runs it: a two-character CJK word has to
// earn a real share of a bilingual line, which the old length weighting could
// not give it. [3] runs the shipped release-list builder against a map with the
// same drop stored three times under two artist spellings, plus a drop older
// than a month. [4] and [5] pin the cancel path and the second widget route.
//
// Version note: 72.8.1 is a PREFIX of nothing here, but '72.8' is a prefix of
// '72.8.1' - the repin is checked for that, not this file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const widgetPy = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-widget.py'), 'utf8');

const VER = '73';
const PREV = '72.8.1';
const SHELL_CACHE = 'sidecut-shell-v73';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;

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
  ok(src.indexOf('if(typeof copyTextToClipboard === \'function\') copyTextToClipboard(txt);') !== -1,
    'through the same clipboard path the share code uses');
}

console.log('[7] the repin moved every gate');
{
  const repin = fs.readFileSync(path.join(ROOT, 'dev', 'repin-73.mjs'), 'utf8');
  ok(repin.indexOf("const OLDVER = '72.9';") !== -1, 'the repin says which build it moves from');
  ok(repin.indexOf("const NEWVER = '73';") !== -1, 'and to');
  ok(repin.indexOf("const NEWCACHE = 'sidecut-shell-v' + NEWVER;") !== -1, 'deriving the cache, not typing it');
  ok(repin.indexOf('sidecut-shell-v72[.]8[.]1(?!') !== -1 && repin.indexOf('sidecut-shell-v72[.]9(?!') !== -1,
    'the stale-cache sweeps are retargeted from the old name to this line, needle written raw');
  ok(repin.indexOf("bespoke('test-6137.mjs'") !== -1 && repin.indexOf("bespoke('test-6138.mjs'") !== -1,
    'and the comma-less changelog-head regex pin is retargeted');
  ok(repin.indexOf('esc(OLDCACHE)') !== -1, 'the cache move is derived, not typed');
  ok(repin.indexOf('const PREV_MOVES = new Map(') === -1 && repin.indexOf("const ADJACENT_STAYS = '72.8.1';") !== -1,
    'and the adjacent-entry pin deliberately does not move, because this release renames only the head');
  const VER_BEFORE = '72.9';
  const stale = [];
  for (const name of fs.readdirSync(path.join(ROOT, 'dev')).sort()) {
    if (!/^test-.*\.mjs$/.test(name) && !/check\.cjs$/.test(name)) continue;
    if (name === 'test-705.mjs' || name === 'test-70.mjs' || name === 'test-73.mjs') continue;
    const t = fs.readFileSync(path.join(ROOT, 'dev', name), 'utf8');
    if (t.indexOf("const VER = '" + VER_BEFORE + "';") !== -1) stale.push(name + ' VER');
    if (/sidecut-shell-v72\.9(?![\d.])/.test(t)) stale.push(name + ' cache');
  }
  ok(stale.length === 0, 'no gate still pins the build this release renumbered (' + stale.join(',') + ')');
  const kept = ['test-713.mjs', 'test-7281.mjs'].every((n) =>
    fs.readFileSync(path.join(ROOT, 'dev', n), 'utf8').indexOf("const PREV = '" + PREV + "';") !== -1);
  ok(kept, 'and the twenty adjacent-entry pins stayed on ' + PREV);
}
console.log('[8] inline script syntax and the OTA tail');
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
