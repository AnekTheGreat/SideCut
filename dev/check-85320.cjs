// 85.3.20 harness - the model hears the recording first, the sheet on the screen is the
// sheet it is asked about, and a timing that arrived from a database may be timed again.
//
// The owner's report: "this lyrics is soo friken off not even close to where it actually
// is fix that cuh with ai gemeni key".
//
// Three faults stood between that key and a wrong sheet:
//
//   * THE SONG WAS LOOKED UP IN THE QUEUE. `aiSyncLyrics` found its track with
//     allTracks.find(id === queue[queueIndex]), so a sheet opened on a song from the
//     source had no track at all - "No track info." - and the recording came from
//     `t.file`, which such a song does not have. The ask now resolves the sheet's own
//     song (85.3.15's scLyricSong) and the bytes that song has (scLyricAudioSource).
//   * A TIMED SHEET WAS REFUSED ON SIGHT. "Lyrics are already synced" closed the door on
//     every sheet a lyrics database hands over with stamps - exactly the wrong timing the
//     owner reported. `force` opens it, and the sheet's own pass in showLyrics forces it
//     once per song when a key is set, before the measurement gets a turn.
//   * THE OLD TIMES WENT WITH THE WORDS. The numbered lines handed to the model still
//     carried their [mm:ss.xx] stamps, so a re-time was given a timing to agree with. They
//     are stripped now.
//
// Nothing here is a copy of the shipped code: the functions are cut out of index.html by
// name and braces and run in a vm against fakes.
//
//   node dev/check-85320.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function grab(name) {
  const key = 'function ' + name + '(';
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}
function grabAsync(name) {
  const key = 'async function ' + name + '(';
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing async function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated async function ' + name);
}
function count(src, needle) {
  let n = 0, at = 0;
  for (;;) { const i = src.indexOf(needle, at); if (i < 0) return n; n++; at = i + needle.length; }
}

// ‒‒ the AI ask, run for real ‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒‒
// The shipped aiSyncLyrics, with every dependency handed in. The model's answer comes
// back through a fake `fetch`, so what is asserted is the ship's own code path.
const AI_SRC = grabAsync('aiSyncLyrics');

const PRELUDE = `
var _aiGeminiKey = __STATE.geminiKey;
var currentLyricsText = __STATE.rawLyrics;
var currentLyricsSynced = __STATE.synced;
var lyricsCurrentTrack = __STATE.sheetId;
var scAiTimedTracks = {};
var scWordTimes = __STATE.scWordTimes;
var allTracks = __API.allTracks;
var queue = __API.queue;
var queueIndex = __API.queueIndex;
var activeAudio = __API.activeAudio;
var scLyricSong = __API.scLyricSong;
var scLyricAudioSource = __API.scLyricAudioSource;
var scLyricsLookEvenlySpaced = __API.scLyricsLookEvenlySpaced;
var toast = __API.toast;
var $ = __API.$;
var blobToArrayBufferFallbackCrop = __API.blobToArrayBufferFallbackCrop;
var scBytesToBase64 = __API.scBytesToBase64;
var scStripLrcStamps = __API.scStripLrcStamps;
var scOnsetEnvelope = __API.scOnsetEnvelope;
var scFindQuietGaps = __API.scFindQuietGaps;
var SC_ONSET_HOP = 0.02;
var scParseLrcLines = __API.scParseLrcLines;
var scRowsLookSane = __API.scRowsLookSane;
var scLyricRowsMatchSheet = __API.scLyricRowsMatchSheet;
var scPullRowsClearOfGaps = __API.scPullRowsClearOfGaps;
var scSnapRowsToOnsets = __API.scSnapRowsToOnsets;
var scFormatLrcRows = __API.scFormatLrcRows;
var dbPut = __API.dbPut;
var scLyricsPersist = __API.scLyricsPersist;
var persistTrackMeta = __API.persistTrackMeta;
var showLyrics = __API.showLyrics;
`;

function aiRun(cfg) {
  const c = cfg || {};
  const state = {
    geminiKey: c.key === undefined ? 'test-key' : c.key,
    rawLyrics: c.rawLyrics !== undefined ? c.rawLyrics : '[00:10.00]line one\n[00:20.00]line two',
    synced: c.synced !== undefined ? c.synced : true,
    sheetId: (c.sheet && c.sheet.id) || 's1',
    scWordTimes: c.wordTimes || {},
    toasts: [],
    persist: [],
    persistLib: 0,
    meta: [],
    shown: [],
    fetches: [],
    answer: c.answer || '[00:05.00]line one\n[00:20.00]line two',
    wordsChanged: !!c.wordsChanged,
    evenSplit: !!c.evenSplit,
    onFetch: c.onFetch || null,
  };
  const sheet = c.sheet || { id: 's1', name: 'Day & Night', artist: 'Sukha', duration: 180, lyrics: '', lyricsSynced: true };
  const audioSrc = c.audioSrc === undefined ? { blob: { size: 10, type: 'audio/mpeg' } } : c.audioSrc;
  const bytes = new ArrayBuffer(8);

  const api = {
    allTracks: c.allTracks || [{ id: 'lib1', name: 'Library song' }],
    queue: ['lib1'],
    queueIndex: 0,
    activeAudio: function () { return { duration: 180 }; },
    scLyricSong: function () { return sheet; },
    scLyricAudioSource: function () { return Promise.resolve(audioSrc); },
    scLyricsLookEvenlySpaced: function () { return state.evenSplit; },
    toast: function (m) { state.toasts.push(String(m)); },
    $: function () { return null; },
    blobToArrayBufferFallbackCrop: function () { return Promise.resolve(bytes); },
    scBytesToBase64: function () { return 'AAA'; },
    scStripLrcStamps: function (t) { return String(t == null ? '' : t).replace(/\[\d{1,3}:\d{1,2}(?:[.:]\d{1,3})?\]/g, ' ').trim(); },
    scOnsetEnvelope: function () { return new Float32Array([0.1, 0.2, 0.1, 0.3]); },
    scFindQuietGaps: function () { return []; },
    scParseLrcLines: function (t) {
      state.parsed = t;
      return state.wordsChanged || state.evenSplit || true
        ? [{ t: 5, text: 'line one' }, { t: 20, text: 'line two' }]
        : [];
    },
    scRowsLookSane: function () { return true; },
    scLyricRowsMatchSheet: function () { return !state.wordsChanged; },
    scPullRowsClearOfGaps: function (r) { return r; },
    scSnapRowsToOnsets: function (r) { return r; },
    scFormatLrcRows: function (r) { return r.map(function (x) { return '[00:0' + Math.round(x.t / 5) + '.00]' + x.text; }).join('\n'); },
    dbPut: function (store, row) { state.meta.push(row); },
    scLyricsPersist: function (t) { state.persist.push(t); return true; },
    persistTrackMeta: function () { state.persistLib++; },
    showLyrics: function (t) { state.shown.push(t); },
  };

  function FakeCtx() {}
  FakeCtx.prototype.decodeAudioData = function () { return Promise.resolve({ duration: 180 }); };
  FakeCtx.prototype.close = function () {};

  const sandbox = {
    __STATE: state,
    __API: api,
    console: { error: function () {}, log: function () {} },
    Promise: Promise,
    Float32Array: Float32Array,
    ArrayBuffer: ArrayBuffer,
    setInterval: setInterval,
    clearInterval: clearInterval,
    window: { __scGeminiModel: function () { return 'gemini-test'; }, AudioContext: FakeCtx },
    fetch: function (url, opts) {
      const body = JSON.parse(opts.body);
      state.fetches.push({ url: url, parts: body.contents[0].parts });
      if (state.onFetch) state.onFetch(state);
      return Promise.resolve({
        ok: true,
        json: function () {
          return Promise.resolve({ candidates: [{ content: { parts: [{ text: state.answer }] } }] });
        }
      });
    }
  };
  const code = '(function(){\n' + PRELUDE + '\n' + AI_SRC +
    '\nreturn { aiSyncLyrics: aiSyncLyrics, aiTimed: scAiTimedTracks, wordTimes: scWordTimes };\n})()';
  const out = vm.runInNewContext(code, sandbox);
  out.state = state;
  out.sheet = sheet;
  return out;
}

async function main() {
  // =======================================================================
  console.log('\n1. The model hears the recording');
  {
    const h = aiRun({});
    const wrote = await h.aiSyncLyrics(true, true);
    ok('a forced ask runs even though the sheet already had stamps', wrote === true, wrote);
    ok('a request was actually made to the model', h.state.fetches.length === 1, h.state.fetches.length);
    const parts = h.state.fetches[0].parts;
    ok('the recording goes with the words', !!(parts[1] && parts[1].inline_data && parts[1].inline_data.data === 'AAA'));
    ok('the bytes are the sheet song\u2019s own, not a queue track\u2019s', !!h.state.fetches[0].url.includes(':generateContent'));
    const prompt = parts[0].text;
    ok('the old timestamps are not sent to the model', prompt.indexOf('[00:10') === -1 && prompt.indexOf('[00:20') === -1, prompt.slice(-200));
    ok('the words are, one per line, numbered', /1\. line one/.test(prompt) && /2\. line two/.test(prompt));

    ok('the sheet\'s own song is the one that is written', h.sheet.lyrics.indexOf('line one') !== -1, h.sheet.lyrics);
    ok('and it is marked timed', h.sheet.lyricsSynced === true);
    ok('the timing is stored through the sheet store, not a library record',
      h.state.persist.length === 1 && h.state.persist[0] === h.sheet && h.state.persistLib === 0,
      h.state.persist.length + '/' + h.state.persistLib);
    ok('the sheet is repainted with it', h.state.shown.length === 1);
    ok('the word timing measured against the old stamps is dropped', !('s1' in h.wordTimes));
    ok('and its stored copy is cleared too',
      h.state.meta.some(function (r) { return r.key === 'lyricWords_s1' && r.value === null; }),
      JSON.stringify(h.state.meta));

    const again = await h.aiSyncLyrics(true, true);
    ok('a second silent ask for the same sheet in one session is refused', again === false, again);
    ok('...without a second request', h.state.fetches.length === 1, h.state.fetches.length);
  }

  // =======================================================================
  console.log('\n2. A sheet that arrived timed can be timed again');
  {
    const h = aiRun({});
    const wrote = await h.aiSyncLyrics(false);
    ok('without force, a sheet that has stamps and is "synced" is refused', wrote === false, wrote);
    ok('no request is made for it', h.state.fetches.length === 0);
    ok('and it says why', h.state.toasts.some(function (t) { return /already synced/i.test(t); }), h.state.toasts.join(' | '));
    ok('nothing is written over it', h.state.persist.length === 0);

    const btn = aiRun({});
    const wroteBtn = await btn.aiSyncLyrics(false, true);
    ok('the button (not silent, forced) times it again', wroteBtn === true, wroteBtn);
    ok('and still speaks when it is done', btn.state.toasts.some(function (t) { return /AI Sync complete/i.test(t); }), btn.state.toasts.join(' | '));
  }

  // =======================================================================
  console.log('\n3. The song on the sheet, whichever list it came from');
  {
    const streamSheet = { id: 'scstream:7', stream: true, streamId: 7, name: 'Day & Night', duration: 180, lyrics: '', lyricsSynced: false };
    const h = aiRun({ sheet: streamSheet, rawLyrics: 'line one\nline two', synced: false });
    const wrote = await h.aiSyncLyrics(true, true);
    ok('a song from the source is timed, not answered with "No track info."', wrote === true, wrote);
    ok('its own bytes go with the request', h.state.fetches[0].parts[1].inline_data.data === 'AAA');
    ok('the timing is written to that song', streamSheet.lyrics.indexOf('line one') !== -1);
    ok('and stored where that song lives', h.state.persist[0] && h.state.persist[0].id === 'scstream:7', h.state.persist[0] && h.state.persist[0].id);
    ok('no library record is written for it', h.state.persistLib === 0);

    const noBytes = aiRun({ audioSrc: null, sheet: streamSheet, rawLyrics: 'line one\nline two', synced: false, key: '' });
    const noKey = await noBytes.aiSyncLyrics(true, true);
    ok('with no key there is no ask at all', noKey === undefined && noBytes.state.fetches.length === 0, noKey);
  }

  // =======================================================================
  console.log('\n4. The guards still decide');
  {
    const changed = aiRun({ wordsChanged: true });
    const wroteChanged = await changed.aiSyncLyrics(true, true);
    ok('a timing that changed the words is refused', wroteChanged === false, wroteChanged);
    ok('the song keeps its own text', changed.sheet.lyrics === '', changed.sheet.lyrics);
    ok('nothing is stored', changed.state.persist.length === 0);

    const even = aiRun({ evenSplit: true });
    const wroteEven = await even.aiSyncLyrics(true, true);
    ok('an even split is refused', wroteEven === false, wroteEven);
    ok('and nothing is written for it', even.sheet.lyrics === '' && even.state.persist.length === 0);

    const moved = aiRun({ onFetch: function (s) { s.moved = true; } });
    moved.state.onFetch = function () { moved.sheet.id = 'other'; };
    const wroteMoved = await moved.aiSyncLyrics(true, true);
    ok('a song that changed while the model was answering is not written over', wroteMoved === false, wroteMoved);
    ok('and its sheet is untouched', moved.state.persist.length === 0);

    const src = AI_SRC;
    ok('the old queue lookup is gone from the ask', src.indexOf('allTracks.find') === -1 || src.indexOf('if (!t) t = allTracks.find') !== -1);
    ok('the sheet\u2019s own song is asked for first', /scLyricSong\(\)/.test(src));
    ok('the bytes come from the sheet, not `t.file` alone', /scLyricAudioSource\(\)/.test(src) && /t\.file \|\| null/.test(src));
    ok('the stamps are stripped before the words are numbered', /scStripLrcStamps\(s\)/.test(src));
    ok('every failure path frees the one-ask latch', count(src, 'delete scAiTimedTracks[_aiSid]') === 5, count(src, 'delete scAiTimedTracks[_aiSid]'));
    ok('a library record is no longer what stores the timing', count(src, 'persistTrackMeta(t)') === 0);
  }

  // =======================================================================
  console.log('\n5. The sheet\'s own pass asks the model first');
  {
    const show = grab('showLyrics');
    ok('the sheet pass forces the model', /aiSyncLyrics\(true, true\)/.test(show));
    ok('once per sheet per session', /scAiTriedAuto\[_askSheet\] = 1;/.test(show));
    ok('the fallback is the old behaviour, unchanged', /scAutoTimeCurrentLyrics\(\)/.test(show) && /scAutoAlignLyricsToAudio\(\)/.test(show));
    ok('the model is asked before the fallback runs',
      show.indexOf('aiSyncLyrics(true, true)') > show.indexOf('var _fallbackTime') &&
      show.indexOf('aiSyncLyrics(true, true)') < show.lastIndexOf('_fallbackTime();'),
      [show.indexOf('var _fallbackTime'), show.indexOf('aiSyncLyrics(true, true)')].join(','));
    ok('a model that declines falls back instead of leaving the sheet untimed',
      /if\(timed\)\{/.test(show) && /_fallbackTime\(\);/.test(show));
    ok('the old "ask the model only after the measurement" block is gone',
      show.indexOf('!timed && !_hasStamps && _aiGeminiKey') === -1);
    ok('the sheet it asks about is the sheet on screen', /scLyricSheetId\(\)/.test(show));
    ok('an even-split sheet is still re-measured rather than trusted', /_evenSplit/.test(show));

    const auto = grabAsync('scAutoTimeCurrentLyrics');
    ok('the measurement still runs first inside the automatic path',
      auto.indexOf('scSyncLyricsFromAudio') < auto.indexOf('aiSyncLyrics(true, true)'),
      [auto.indexOf('scSyncLyricsFromAudio'), auto.indexOf('aiSyncLyrics(true, true)')].join(','));
    ok('its model fallback shares the once-per-sheet latch', /scAiTriedAuto\[tid\]/.test(auto));
    ok('a song still being read is not handed to the model without its recording', /!lrc && _aiGeminiKey && !t\.stream/.test(auto), auto.slice(auto.indexOf('!lrc'), auto.indexOf('!lrc') + 120));
    ok('and the ask itself refuses a text-only guess for a song that is still reading',
      /if\(!audioPart && t\.stream\)/.test(AI_SRC), AI_SRC.slice(AI_SRC.indexOf('!audioPart'), AI_SRC.indexOf('!audioPart') + 120));

    ok('the latch is declared beside the session map', page.indexOf('var scAiTriedAuto = {};') > 0);
    ok('...once', count(page, 'var scAiTriedAuto = {};') === 1, count(page, 'var scAiTriedAuto = {};'));
  }

  // =======================================================================
  console.log('\n6. The release itself');
  {
    const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
    let m, scripts = 0, bad = 0;
    while ((m = re.exec(page))) {
      scripts++;
      try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
    }
    ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
    const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    // The work this gate proves was built under the label 85.3.20 and ships in 85.4 - the
    // version after 85.3.9, because a segment after the second only ever runs 0-9 (see the
    // numbering rule at the top of AGENTS.md). So the pin reads "85.4 or newer".
    const vNum = (s) => String(s || '').split('.').map(Number);
    const atLeast = (v, w) => {
      const a = vNum(v), b = vNum(w);
      for (let i = 0; i < Math.max(a.length, b.length); i++) {
        const x = a[i] || 0, y = b[i] || 0;
        if (x !== y) return x > y;
      }
      return true;
    };
    ok('the page is on 85.4 or newer', atLeast(vPage, '85.4'), vPage);
    ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
    ok('the notes carry the 85.4 entry', page.includes("version: '85.4'"));
    ok('the new entry is above 85.3.19',
      page.indexOf("version: '85.4'") < page.indexOf("version: '85.3.19'"));
    const entry = page.slice(page.indexOf("version: '85.4'"), page.indexOf("version: '85.3.19'"));
    ok('the new entry avoids the words the Play channel filters',
      !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
      entry.slice(0, 200));
    const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
    ok('the entry carries the five things it describes', items >= 5, items);
    ok('and names the key, the recording and the sheet that arrived timed',
      /gemini key/i.test(entry) && /recording/i.test(entry) && /timestamps|timed/i.test(entry));
  }
}

main().catch(function (e) { console.error(e); process.exitCode = 1; }).then(function () {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
});
