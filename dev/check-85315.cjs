// 85.3.15 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report: "why is the lyrics only displaying by character and length it should be
// by song and it's rhythm and rhythm changes with ai the lyrics should be actual lyrics and
// coodernate with the song".
//
// Three faults, all of them in the timing:
//   * every measuring path (the automatic timing, the word timing, the sheet's own offset)
//     looked the song up in the LIBRARY and read its `file`. A song played from the network
//     has no library record and no `file` - its bytes are the read the player already made -
//     so none of those paths could run for it, and the only timing left was a share of the
//     song's LENGTH worked out from the letters in each line. That is "by character and
//     length";
//   * even for a song that COULD be measured, 73.1.4 put the model in front whenever a key
//     was set, so a model that never heard the song replaced the measured rhythm - the
//     "rhythm changes with ai";
//   * a model asked for timestamps could hand back a translation or a paraphrase, and the
//     sheet showed words nobody sang - "the lyrics should be actual lyrics".
//
// Nothing here is a copy of the shipped code: the functions are cut out of the page by name
// and braces and run in a vm against fake songs and fake reads. The measurement maths itself
// (scTimeLyricsFromOnsets, scOnsetEnvelope) is stubbed here - this gate is about WHICH song is
// measured, WHICH bytes are read, WHAT is asked first and WHAT is allowed back; the maths was
// covered by its own release.
//
//   node dev/check-85315.cjs
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
function constLine(name) {
  const m = page.match(new RegExp('^\\s*var ' + name + ' = [^\\n]+$', 'm'));
  if (!m) throw new Error('missing constant ' + name);
  return m[0];
}
function grab(name) {
  const key = 'function ' + name + '(';
  // The slice has to keep `async ` when the function is async, or the body is a syntax
  // error the moment it contains an await.
  let start = page.indexOf('async ' + key);
  if (start < 0) {
    start = page.indexOf(key);
    if (start < 0) throw new Error('missing function ' + name);
  }
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}

const UNIT = [
  constLine('SC_LRC_TAG_SRC'), grab('scLrcTagRe'),
  grab('scLyricTrack'), grab('scLyricSong'), grab('scLyricSheetId'), grab('scLyricAudioSource'),
  grab('scSyncLyricsFromAudio'), grab('scAutoTimeCurrentLyrics'), grab('scWordTrackId'),
  grab('scLyricLineKey'), grab('scLyricRowsMatchSheet')
].join('\n');

// The shipped functions, a fake library, a fake source song, a fake read and recorders for
// everything they would do to the screen. `streamSong` is only non-null for the song the sheet
// says it is showing, exactly like scStreamSong() answers for the player.
function harness(opts) {
  const o = opts || {};
  const calls = [];
  const sandbox = {
    console, Number, Math, String, Array, Object, JSON, Promise, isFinite, Date,
    lyricsCurrentTrack: o.lt,
    queueIndex: o.queueIndex === undefined ? 0 : o.queueIndex,
    queue: o.queue || [],
    allTracks: o.tracks || [],
    currentLyricsText: 'one line here\ntwo lines here',
    currentLyricsSynced: false,
    _aiGeminiKey: o.key || '',
    scAiTimedTracks: {},
    scAutoTimedKey: '',
    scAutoTimeFailedKey: '',
    scAutoTimeFailedAt: 0,
    SC_AUTOTIME_RETRY_MS: 20000,
    scAutoSyncBusy: {},
    scStreamState: o.streamState || {},
    scStreamSong: o.streamSong || function () { return null; },
    SC_ONSET_HOP: 0.02,
    scTimeLyricsFromOnsets: function () { calls.push('measure'); return 'TIMED'; },
    scOnsetEnvelope: function () { return new Float32Array(0); },
    blobToArrayBufferFallbackCrop: function () { return Promise.resolve(new ArrayBuffer(8)); },
    AudioContext: function () {
      this.decodeAudioData = function () { return Promise.resolve({ duration: 95 }); };
      this.close = function () {};
    },
    showLyrics: function (t) { calls.push('show:' + t); },
    toast: function () { calls.push('toast'); },
    scLyricsPersist: function (t) { calls.push('save:' + t.id); return true; },
    persistTrackMeta: function (t) { calls.push('persist:' + t.id); },
    aiSyncLyrics: function () { calls.push('ai'); return Promise.resolve(true); }
  };
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(UNIT + '\n;globalThis.__u = {' +
    'scLyricTrack, scLyricSong, scLyricSheetId, scLyricAudioSource, scSyncLyricsFromAudio, ' +
    'scAutoTimeCurrentLyrics, scWordTrackId, scLyricLineKey, scLyricRowsMatchSheet};',
    sandbox, { filename: 'lyrics-85315.js' });
  return { U: sandbox.__u, s: sandbox, calls: calls };
}

const lib = { id: 't1', name: 'Song', duration: 210, file: { size: 10 } };
const sourceSong = { id: 'scstream:12', streamId: '12', stream: true, duration: 200, name: 'Track' };
const read = { size: 1000 };

async function main() {
  // ===========================================================================
  console.log('\n1. The song on the sheet, whichever list it came from');
  // ===========================================================================
  {
    const h = harness({ lt: 't1', tracks: [lib] });
    ok('a library song is the song the sheet belongs to', h.U.scLyricSong() === lib);
    ok('its own file is what gets measured', (await h.U.scLyricAudioSource()).blob === lib.file);
    ok('and its id is the id its timing is stored under', h.U.scLyricSheetId() === 't1');
  }
  {
    // THE REPORT: a song played from the network is found nowhere in the library, so the
    // queue cannot name it and no file exists to measure.
    const h = harness({ lt: 'scstream:12', tracks: [], queueIndex: 0, queue: ['t1'], streamSong: function () { return sourceSong; } });
    ok('a song played from the network IS the song on the sheet when it is the one shown', h.U.scLyricSong() === sourceSong);
    ok('its sheet id is its own, not the queue song', h.U.scLyricSheetId() === 'scstream:12');
    ok('with no read yet there is nothing to measure', (await h.U.scLyricAudioSource()) === null);
  }
  {
    const h = harness({ lt: 'scstream:12', streamSong: function () { return sourceSong; }, streamState: { blob: read, blobId: '12' } });
    const src = await h.U.scLyricAudioSource();
    ok('the read the player already made is what the words are measured from', src && src.blob === read, src && src.blob);
    ok('and the measurement is named by the sheet id', src && src.id === 'scstream:12', src && src.id);
    ok('the song length the measurement is laid out over comes with it', src && src.duration === 200, src && src.duration);
  }
  {
    const h = harness({ lt: 'scstream:12', streamSong: function () { return sourceSong; }, streamState: { blob: read, blobId: '99' } });
    ok('a read that belongs to another song is never measured', (await h.U.scLyricAudioSource()) === null);
  }
  {
    const h = harness({ lt: 'scstream:12', streamSong: function () { return sourceSong; }, streamState: { blob: { size: 0 }, blobId: '12' } });
    ok('an empty read is not a recording', (await h.U.scLyricAudioSource()) === null);
  }

  // ===========================================================================
  console.log('\n2. The recording is asked first, and it is asked always');
  // ===========================================================================
  {
    // THE SECOND REPORT: with a key set the model used to do the timing even when the song
    // itself was right there and could be measured.
    const h = harness({ lt: 't1', tracks: [lib], key: 'K' });
    ok('the recording times the sheet', (await h.U.scAutoTimeCurrentLyrics()) === true);
    ok('the song was measured', h.calls.includes('measure'), h.calls.join(','));
    ok('the model was NOT asked, even with a key set', !h.calls.includes('ai'), h.calls.join(','));
    ok('the timing is stored on the song', h.calls.includes('save:t1'), h.calls.join(','));
    ok('and put on the screen', h.calls.includes('show:TIMED'), h.calls.join(','));
    // The timed text is a new sheet, so the guard is about the SAME text twice.
    h.s.currentLyricsText = 'one line here\ntwo lines here';
    ok('one measurement per sheet per session', (await h.U.scAutoTimeCurrentLyrics()) === false);
  }
  {
    const h = harness({ lt: 'scstream:12', streamSong: function () { return sourceSong; }, streamState: { blob: read, blobId: '12' }, key: 'K' });
    ok('a song played from the network is timed by its own recording', (await h.U.scAutoTimeCurrentLyrics()) === true);
    ok('and saved where its own store keeps it', h.calls.includes('save:scstream:12'), h.calls.join(','));
    ok('and the model is not asked about that one either', !h.calls.includes('ai'), h.calls.join(','));
    ok('the screen was given the timing, not a length share', h.calls.includes('show:TIMED'), h.calls.join(','));
  }
  {
    const h = harness({ lt: 'scstream:12', streamSong: function () { return sourceSong; }, key: 'K' });
    ok('with no bytes and no model answer the sheet is left as it is', (await h.U.scAutoTimeCurrentLyrics()) === false);
    ok('the failure is remembered under the sheet id so a later read may try again',
      /^scstream:12\|/.test(String(h.s.scAutoTimeFailedKey)), h.s.scAutoTimeFailedKey);
  }
  {
    const h = harness({ lt: 't2', tracks: [{ id: 't2', name: 'No file' }], key: 'K' });
    ok('the model is only asked when there is nothing to measure', (await h.U.scAutoTimeCurrentLyrics()) === true);
    ok('...and that ask is the model', h.calls.includes('ai'), h.calls.join(','));
  }

  // ===========================================================================
  console.log('\n3. The bytes are the song, and one read is one measurement');
  // ===========================================================================
  {
    const h = harness({ lt: 't1', tracks: [lib] });
    ok('no source, no measurement', (await h.U.scSyncLyricsFromAudio(null, 'words')) === null);
    ok('a source with no bytes is not measured', (await h.U.scSyncLyricsFromAudio({ id: 't1', blob: null }, 'words')) === null);
    ok('a sheet with no words is not measured', (await h.U.scSyncLyricsFromAudio({ id: 't1', blob: read }, '')) === null);
    h.s.scAutoSyncBusy['t1'] = true;
    ok('a measurement already running for this song is not started twice',
      (await h.U.scSyncLyricsFromAudio({ id: 't1', blob: read }, 'words')) === null);
    delete h.s.scAutoSyncBusy['t1'];
    ok('and the same call measures once the first one is done',
      (await h.U.scSyncLyricsFromAudio({ id: 't1', blob: read, duration: 100 }, 'w1\nw2')) === 'TIMED');
    ok('the busy mark is cleared when it finishes', !h.s.scAutoSyncBusy['t1']);
  }

  // ===========================================================================
  console.log('\n4. The word timing follows the same song');
  // ===========================================================================
  {
    const h = harness({ lt: 'scstream:12', queueIndex: 0, queue: ['t1'], streamSong: function () { return sourceSong; } });
    ok('a song from the network is measured by its own id, not the queue id', h.U.scWordTrackId() === 'scstream:12', h.U.scWordTrackId());
  }
  {
    const h = harness({ lt: 't1', tracks: [lib], queueIndex: 0, queue: ['t1'] });
    ok('a library song still uses its queue id', h.U.scWordTrackId() === 't1');
  }
  {
    const h = harness({ lt: 'other', queueIndex: 0, queue: ['t1'], streamSong: function () { return sourceSong; } });
    ok('a source song that is not the one on the sheet is not borrowed', h.U.scWordTrackId() === 't1', h.U.scWordTrackId());
  }

  // ===========================================================================
  console.log('\n5. A timing may not change the words');
  // ===========================================================================
  {
    const u = harness({ lt: '', tracks: [] }).U;
    const sheet = ['One line here', 'Two lines here', 'Three lines here', 'Four lines here', 'Five lines here'];
    ok('the same words are accepted',
      u.scLyricRowsMatchSheet([
        { t: 1, text: 'One line here' }, { t: 2, text: 'Two lines here' }, { t: 3, text: 'Three lines here' },
        { t: 4, text: 'Four lines here' }, { t: 5, text: 'Five lines here' }
      ], sheet) === true);
    ok('a translation is refused',
      u.scLyricRowsMatchSheet([{ t: 1, text: 'Una linea' }, { t: 2, text: 'Dos lineas' }], sheet) === false);
    ok('punctuation, case and stamps are not a change',
      u.scLyricRowsMatchSheet([
        { t: 1, text: '[00:01.00]one LINE here!' }, { t: 2, text: 'two, lines  here' },
        { t: 3, text: 'Three lines here' }, { t: 4, text: 'Four lines here.' }, { t: 5, text: 'Five lines here?' }
      ], sheet) === true);
    ok('a sheet that loses one line in five is still the same sheet',
      u.scLyricRowsMatchSheet([
        { t: 1, text: 'One line here' }, { t: 2, text: 'Two lines here' },
        { t: 3, text: 'Three lines here' }, { t: 4, text: 'Four lines here' }
      ], sheet) === true);
    ok('a sheet that loses half of it is not',
      u.scLyricRowsMatchSheet([{ t: 1, text: 'One line here' }, { t: 2, text: 'Two lines here' }], sheet) === false);
    ok('a rewritten chorus is refused',
      u.scLyricRowsMatchSheet([
        { t: 1, text: 'One line here' }, { t: 2, text: 'Two lines here (oh yeah)' },
        { t: 3, text: 'Sing it again' }, { t: 4, text: 'Sing it again' }, { t: 5, text: 'Sing it again' }
      ], sheet) === false);
    ok('nothing to compare against is refused', u.scLyricRowsMatchSheet([], sheet) === false && u.scLyricRowsMatchSheet([{ t: 1, text: 'x' }], []) === false);
  }
  {
    const src = grab('aiSyncLyrics');
    ok('the model output is checked against the sheet it was given',
      /scLyricRowsMatchSheet\(_rows, _plainLines\)/.test(src), 'no check');
    ok('the check runs before the timing is accepted',
      src.indexOf('scLyricRowsMatchSheet(_rows, _plainLines)') < src.indexOf('t.lyrics = text'), 'after');
  }

  // ===========================================================================
  console.log('\n6. The page itself');
  // ===========================================================================
  {
    const auto = grab('scAutoTimeCurrentLyrics');
    ok('the automatic timing measures before it asks any model',
      auto.indexOf('scSyncLyricsFromAudio') >= 0 &&
      auto.indexOf('scSyncLyricsFromAudio') < auto.indexOf('aiSyncLyrics'), 'order');
    ok('and it reads the song on the sheet, not the queue',
      /scLyricSong\(\)/.test(auto) && !/queueIndex >= 0 && queueIndex < queue\.length/.test(auto));
    ok('a song from the network is never handed to the model',
      /!lrc && _aiGeminiKey && !t\.stream/.test(auto), 'guard');
    ok('the timing is stored through the store that knows about both kinds of song',
      /scLyricsPersist\(t\)/.test(auto) && !/persistTrackMeta\(t\)/.test(auto));
  }
  {
    const align = grab('scAutoAlignLyricsToAudio');
    ok('the sheet offset is measured on the song on the sheet', /scLyricSong\(\)/.test(align));
    ok('and from the bytes that song actually has', /scLyricAudioSource\(\)/.test(align) && /src\.blob/.test(align));
  }
  {
    const kick = grab('scWordMeasureKick');
    ok('the word timing accepts a song that has no library file but has a read', /!t\.file && !t\.stream/.test(kick));
    ok('and it measures the bytes the song has', /scLyricAudioSource\(\)/.test(kick) && /src\.blob/.test(kick));
    ok('a song still being read is not re-asked twenty times a second', /scWordTryAt/.test(kick));
  }
  ok('the lyric nudge is stored and read under the sheet id',
    (page.match(/scLyricSheetId\(\)/g) || []).length >= 3,
    (page.match(/scLyricSheetId\(\)/g) || []).length);
  ok('the player keeps the read it already made, with the id it belongs to',
    /scStreamState\.blob = blob;/.test(page) && /scStreamState\.blobId = String\(scStreamState\.curId/.test(page));
  ok('a read that lands while the sheet is open asks for the timing again',
    /scLyricKickMeasure\(\)/.test(page) && /scAutoTimeFailedKey = ''/.test(grab('scLyricKickMeasure')));
  ok('the read is cleared with the blob address it came with',
    /scStreamState\.blob = null;\n\s*scStreamState\.blobId = '';/.test(page));

  releaseChecks();
}

// =============================================================================
function releaseChecks() {
  console.log('\n7. The release itself');
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok('the page is on 85.3.15', vPage === '85.3.15', vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.3.15 entry', page.includes("version: '85.3.15'"));
  ok('the new entry is above 85.3.14', page.indexOf("version: '85.3.15'") < page.indexOf("version: '85.3.14'"));
  const entry = page.slice(page.indexOf("version: '85.3.15'"), page.indexOf("version: '85.3.14'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 140));
  ok('the new entry carries the three lines it describes', (entry.match(/: '/g) || []).length >= 3);
}

main().then(function () {
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  if (fail) process.exitCode = 1;
}, function (e) {
  console.error(e && e.stack || e);
  process.exitCode = 1;
});
