// v60.1.2 audit — the converter batch: pick your songs, everything lands in the
// library, and the app stays usable while it converts.
//
// The behavioural parts run the REAL functions lifted out of index.html:
//   • guessMeta            — "01 - Artist - Title.mp3" is artist+title, not "01"
//   • scEncodeMp3Cooperative / scEncodeWavCooperative — byte-for-byte the same
//     output as the plain encoders, and they really do hand the main thread back
//     (counted with a timer that can only run between slices)
//   • scAddConvertedToLibrary — the track ends up in All songs + Unsorted with
//     its metadata, cover art and an IndexedDB write
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
function slice(from, to) {
  const a = html.indexOf(from);
  if (a === -1) return '';
  const b = html.indexOf(to, a);
  return b === -1 ? '' : html.slice(a, b);
}

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];

/* ── 1. reading a file name ──────────────────────────────────────────────── */
console.log('\n— a track number is not an artist —');
{
  const src = slice('  function guessMeta(filename){', '\n  // ---------------- Automatic genre detection');
  const guessMeta = new Function(src + '\nreturn guessMeta;')();
  const g = (n) => guessMeta(n);
  ok('an album conversion reads as artist + title',
    g('01 - Diljit Dosanjh - Dealer.mp3').artist === 'Diljit Dosanjh' && g('01 - Diljit Dosanjh - Dealer.mp3').title === 'Dealer',
    JSON.stringify(g('01 - Diljit Dosanjh - Dealer.mp3')));
  ok('and the same for a dot separator and a two-digit number',
    g('2. Karan Aujla - 52 Bars.mp3').artist === 'Karan Aujla' && g('2. Karan Aujla - 52 Bars.mp3').title === '52 Bars',
    JSON.stringify(g('2. Karan Aujla - 52 Bars.mp3')));
  ok('a plain "Artist - Title.mp3" is untouched',
    g('Diljit Dosanjh - Water.mp3').artist === 'Diljit Dosanjh' && g('Diljit Dosanjh - Water.mp3').title === 'Water');
  ok('a real album file numbered 01 - Artist - Title keeps the artist in slot two',
    g('01 - Diljit Dosanjh - Dealer.mp3').artist !== '01');
  ok('no separator at all still means Unknown artist',
    g('Random File.mp3').artist === 'Unknown artist' && g('Random File.mp3').title === 'Random File');
  ok('a lone number is left alone (a song can be called 1979)',
    g('1979.mp3').title === '1979' && g('1979.mp3').artist === 'Unknown artist');
  ok('a title that begins with a number survives a numbered file',
    g('03 - Childish Gambino - 3005.mp3').artist === 'Childish Gambino' && g('03 - Childish Gambino - 3005.mp3').title === '3005');
  ok('the library still learns the artist from a converted file name', (() => {
    const m = g('07 - AP Dhillon - Summer High.mp3');
    return m.artist === 'AP Dhillon' && m.title === 'Summer High';
  })());
}

/* ── 2. the encoders ─────────────────────────────────────────────────────── */
console.log('\n— the cooperative encoders —');

// A real-ish AudioBuffer and a stand-in lamejs that spends a millisecond per
// block, so the slice logic has something to slice.
function makeBuffer(seconds, channels) {
  const sr = 44100, len = Math.floor(sr * seconds);
  const data = [];
  for (let c = 0; c < channels; c++) {
    const arr = new Float32Array(len);
    for (let i = 0; i < len; i++) arr[i] = Math.sin((i + c * 97) * 0.017) * 0.6;
    data.push(arr);
  }
  return {
    numberOfChannels: channels, sampleRate: sr, length: len, duration: seconds,
    getChannelData: (c) => data[c]
  };
}
function makeLame(busyMs) {
  return {
    Mp3Encoder: function (ch, sr, br) {
      return {
        encodeBuffer(l, r) {
          if (busyMs) { const t0 = Date.now(); while (Date.now() - t0 < busyMs) {} }
          const out = new Int8Array(6);
          out[0] = l[0] & 0xFF; out[1] = (r ? r[0] : 0) & 0xFF;
          out[2] = l[l.length - 1] & 0xFF; out[3] = ch; out[4] = sr & 0xFF; out[5] = br & 0xFF;
          return out;
        },
        flush() { return new Int8Array([9, 9, 9]); }
      };
    }
  };
}

const encoderSrc =
  slice('  function scYieldToUI(){', '  // MP3 (lamejs) — the block loop is ours') +
  slice('  // MP3 (lamejs) — the block loop is ours', '  // WAV (PCM 16-bit + id3 chunk)') +
  slice('  // WAV (PCM 16-bit + id3 chunk)', '  // The one the converters call.') +
  slice('  async function scEncodeAudioCooperative(', '  // ─── A finished conversion IS a library song') +
  slice('  function scId3v23Bytes(meta){', '  function scEncodeAudio(buf, fmt, meta){') +
  slice('  function scEncodeAudio(buf, fmt, meta){', '  async function scSpToBuffer(');

function buildEncoders(lame, sliceMs) {
  const factory = new Function(
    'var lamejs = arguments[0];\n' + encoderSrc +
    '\nSC_ENCODE_SLICE_MS = arguments[1];\n' +
    'return { mp3: scEncodeMp3Cooperative, wav: scEncodeWavCooperative, any: scEncodeAudioCooperative, plain: scEncodeAudio, id3: scId3v23Bytes, join: scJoinTaggedChunks };'
  );
  return factory(lame, sliceMs);
}

(async () => {
  ok('the encoders could be lifted out of index.html', encoderSrc.indexOf('scEncodeMp3Cooperative') !== -1 && encoderSrc.indexOf('scEncodeWavCooperative') !== -1);

  const meta = { title: 'Dealer', artist: 'Diljit Dosanjh', album: 'Ghost', year: '2023', genre: 'Punjabi', track: '1', artBytes: null, artMime: null };

  {
    // Equivalence: same encoder, same blocks — the slicing must not change a byte.
    const E = buildEncoders(makeLame(0), 1000);
    const buf = makeBuffer(4, 2);
    const plain = new Uint8Array(await E.plain(buf, 'mp3', meta).arrayBuffer());
    const coopBlob = await E.mp3(buf, meta);
    const coop = new Uint8Array(await coopBlob.arrayBuffer());
    ok('the cooperative MP3 encode is byte-for-byte the plain one', plain.length === coop.length && plain.every((b, i) => b === coop[i]),
      plain.length + ' vs ' + coop.length);
    ok('and it carries the ID3v2.3 tag at the front', String.fromCharCode(coop[0], coop[1], coop[2]) === 'ID3');

    const wavPlain = new Uint8Array(await E.plain(buf, 'wav', meta).arrayBuffer());
    const wavCoopBlob = await E.wav(buf, meta, null);
    const wavCoop = new Uint8Array(await wavCoopBlob.arrayBuffer());
    ok('the cooperative WAV encode is byte-for-byte the plain one', wavPlain.length === wavCoop.length && wavPlain.every((b, i) => b === wavCoop[i]),
      wavPlain.length + ' vs ' + wavCoop.length);
    ok('and the WAV is a RIFF/WAVE file', String.fromCharCode(wavCoop[0], wavCoop[1], wavCoop[2], wavCoop[3]) === 'RIFF' && String.fromCharCode(wavCoop[8], wavCoop[9], wavCoop[10], wavCoop[11]) === 'WAVE');
  }

  {
    // Responsiveness: a busy encoder plus a real timer. The timer can only fire
    // when the encoder hands the thread back, so ticks prove the slicing works —
    // this is the difference between "the app is frozen" and "the app works".
    const E = buildEncoders(makeLame(1), 20);
    const buf = makeBuffer(12, 2);           // ~460 blocks, ~0.5s of encode work
    let ticks = 0;
    const timer = setInterval(() => { ticks++; }, 0);
    const t0 = Date.now();
    const blob = await E.mp3(buf, meta);
    const elapsed = Date.now() - t0;
    clearInterval(timer);
    ok('the encoder yields to the event loop while it works', ticks >= 5, ticks + ' ticks in ' + elapsed + 'ms');
    ok('the encode still produced the whole file', blob && blob.size > 100, blob && blob.size);

    // WAV does not use lamejs at all — it is a DataView fill, so the slice budget
    // is what has to trip. A 20s stereo track is ~1.8M writes per channel.
    const E2 = buildEncoders(makeLame(0), 1);
    const wbuf = makeBuffer(20, 2);
    let wticks = 0;
    const wtimer = setInterval(() => { wticks++; }, 0);
    const wavBlob = await E2.wav(wbuf, meta, null);
    clearInterval(wtimer);
    ok('the WAV encode yields too', wticks >= 3 && !!wavBlob, wticks + ' ticks');
  }

  {
    // The slice budget is a real number in the shipped file, not a placeholder.
    ok('the slice budget is set (something small, but not zero)',
      /var SC_ENCODE_SLICE_MS = \d+;/.test(html) && Number((html.match(/var SC_ENCODE_SLICE_MS = (\d+)/) || [])[1]) <= 120,
      (html.match(/var SC_ENCODE_SLICE_MS = (\d+)/) || [])[1]);
    ok('the conversion pipeline uses the cooperative encoder, not the blocking one',
      /var blob = await scEncodeAudioCooperative\(/.test(html) &&
      !/scConvertOneTrack[\s\S]{0,900}?var blob = scTaggedBlob\(/.test(html));
    ok('and so do the single-song converters',
      (html.match(/await scEncodeAudioCooperative\(/g) || []).length >= 3,
      (html.match(/await scEncodeAudioCooperative\(/g) || []).length);
  }

  /* ── 3. a converted song is a library song ─────────────────────────────── */
  console.log('\n— converted songs land in the library —');
  {
    const src = slice('  function scAddConvertedToLibrary(blob, meta, opts){', '\n  // ─── Progress pill');
    // The real helpers out of index.html — the file name and the credit
    // normalisation this function now runs are exactly what is being tested.
    const helperSrc = slice('  function scSafeName(s){', '  // ─── Native HTTP transport');
    const realHelpers = new Function(helperSrc + '\nreturn { scSafeName: scSafeName, scArtistCredits: scArtistCredits };')();
    const harness = new Function('scSafeName', 'scArtistCredits', 'URL', 'Blob', 'File', `
      var idCounter = 41;
      var allTracks = [];
      var playlists = { 'All Songs': [] };
      var persisted = [], saves = 0, lazy = null;
      function persistTrackMeta(t){ persisted.push(t); }
      function saveMeta(){ saves++; }
      function readLazyMeta(t){ lazy = t; }
      function renderTabs(){ harness.tabs = (harness.tabs || 0) + 1; }
      function renderList(){ harness.rows = (harness.rows || 0) + 1; }
      var harness = {};
      ${src}
      harness.add = scAddConvertedToLibrary;
      harness.state = function(){ return { idCounter: idCounter, allTracks: allTracks, playlists: playlists, persisted: persisted, saves: saves, lazy: lazy }; };
      return harness;
    `)(realHelpers.scSafeName, realHelpers.scArtistCredits, URL, Blob, File);

    const art = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 1, 2, 3, 4]);
    const track = harness.add(new Blob([new Uint8Array(500)], { type: 'audio/mpeg' }), {
      title: 'Dealer', artist: 'Diljit Dosanjh', album: 'Ghost', genre: 'Punjabi',
      artBytes: art, artMime: 'image/jpeg'
    }, { fileName: '01 - Diljit Dosanjh - Dealer.mp3', fmt: 'mp3', source: 'conversion' });

    const st = harness.state();
    ok('the track is created', !!track && !!track.id, track && track.id);
    ok('it is in All songs', st.playlists['All Songs'].length === 1 && st.playlists['All Songs'][0] === track.id);
    ok('and in Unsorted', st.playlists['Unsorted'] && st.playlists['Unsorted'][0] === track.id);
    ok('it is in the library list itself', st.allTracks.length === 1 && st.allTracks[0] === track);
    ok('the title and artist are the real ones, not the file name',
      track.name === 'Dealer' && track.artist === 'Diljit Dosanjh' && track.album === 'Ghost',
      track.name + ' / ' + track.artist);
    ok('the cover art comes with it', !!track.artBlob && track.artBlob.type === 'image/jpeg' && !!track.artUrl);
    ok('it is written to the library database', st.persisted.length === 1 && st.persisted[0] === track && st.saves >= 1);
    ok('and its duration is read from the file afterwards', st.lazy === track);
    ok('the list is re-rendered so it shows up straight away', harness.tabs >= 1 && harness.rows >= 1);
    ok('the id counter moves on', st.idCounter === 42, st.idCounter);

    const plain = harness.add(new Blob([new Uint8Array(10)]), { title: 'Something', artist: '' }, { fmt: 'mp3' });
    ok('a missing artist falls back instead of showing a blank', plain && plain.artist === 'Unknown artist', plain && plain.artist);
  }

  /* ── 4. the batch UI ───────────────────────────────────────────────────── */
  console.log('\n— picking songs, and the run that follows you —');
  ok('the plan renders a tick box per song', /class="sp-pick-cb"/.test(html) && /data-idx="' \+ ti \+ '"/.test(html));
  ok('every song starts ticked', /class="sp-pick-cb" data-idx="' \+ ti \+ '" checked/.test(html));
  ok('there are All and None controls', /class="sp-pick-all"/.test(html) && /class="sp-pick-none"/.test(html));
  ok('the button counts the selection', /gb\.textContent = n \? \('Convert ' \+ n \+ ' song'/.test(html));
  ok('an empty selection is refused', /if\(!idx\.length\)\{ toast\('Pick at least one song to convert\.'/.test(html));
  ok('only the ticked songs are converted',
    /var chosen = idx\.map\(function\(ix\)\{ return plan\.tracks\[ix\]; \}\)\.filter\(Boolean\)/.test(html) &&
    /scRunBatchConvert\(plan, fmt, mode, resultEl, btnEl, url, chosen\)/.test(html));
  ok('the run takes the chosen list',
    /async function scRunBatchConvert\(plan, fmt, saveMode, resultEl, btnEl, originalUrl, chosenTracks\)/.test(html) &&
    /var tracks = \(chosenTracks && chosenTracks\.length\) \? chosenTracks\.slice\(\)/.test(html));

  ok('the default output is the library', /<option value="library">Just my library<\/option>/.test(html));
  ok('saving files or a ZIP is opt-in',
    /<option value="files">Library \+ save files<\/option>/.test(html) && /<option value="zip">Library \+ one ZIP<\/option>/.test(html));
  ok('nothing in the batch saves to the share sheet unless asked',
    /var alsoSaveFiles = \(saveMode === 'files'\);/.test(html) &&
    /else if\(alsoSaveFiles\)\{[\s\S]{0,400}scNativeSaveBlob/.test(html));
  ok('each converted song is added to the library', /var addedTrack = scAddConvertedToLibrary\(out\.blob, \{/.test(html));
  ok('a failed add is not counted as success',
    /if\(addedTrack\)\{[\s\S]{0,220}\} else \{[\s\S]{0,160}could not add to the library/.test(html));

  ok('the run starts a progress pill', /scConvertPillUpdate\('Converting ' \+ tracks\.length/.test(html));
  ok('the pill is updated per song', /scConvertPillUpdate\('Converting ' \+ \(i \+ 1\) \+ '\/' \+ tracks\.length/.test(html));
  ok('and finished with a count', /scConvertPillDone\(okCount \+ ' song'/.test(html));
  ok('the pill lives on its own, above the player', /id = 'scConvertPill'/.test(html) && /bottom:calc\(84px \+ env\(safe-area-inset-bottom\)\)/.test(html));
  ok('the box says the run survives closing it',
    /close this window if you like, the run carries on/.test(html));
  ok('the finish card offers the library',
    /class="sp-batch-open-lib"/.test(html) && /activePlaylist = 'All Songs'/.test(html));
  ok('the closing toast says the songs are in the library', /songs are in your library \(All songs\)/.test(html));
  ok('the ZIP is only built when one was asked for', /if\(wantZip && zip && okCount > 0\)/.test(html));

  console.log('\n— the single-song converters —');
  ok('the Spotify single adds itself to the library',
    (html.match(/scAddConvertedToLibrary\(blob, \{/g) || []).length >= 2);
  ok('the YouTube converter adds itself too', /scAddConvertedToLibrary\(res\.blob, \{/.test(html));
  ok('the YouTube title and artist are cleaned like an import', /cleanOnImport\(title \|\| 'YouTube audio', ytAuthor \|\| ''\)/.test(html));
  ok('the converted blob is handed to the result card', /filename: \(scSafeName\(title[\s\S]{0,120}blob: blob \};/.test(html));
  // The two converted-song cards must not send you off to import a file any
  // more — the song is already in the library by the time the card is drawn.
  const spotifySingleCard = slice('    async function csRenderSinglePicked(buf, streamUrl, fmt){', '    function csShowExternal(){');
  const ytCard = slice('    function renderDownload(fmt, res){', '  function openYtToMp3(');
  ok('the Spotify single card has no import step left',
    spotifySingleCard.length > 500 && spotifySingleCard.indexOf('__importConvertedMp4') === -1 &&
    spotifySingleCard.indexOf('scAddConvertedToLibrary') !== -1);
  ok('and neither does the YouTube card',
    ytCard.length > 300 && ytCard.indexOf('__importConvertedMp4') === -1 &&
    ytCard.indexOf('scAddConvertedToLibrary') !== -1);

  /* ── 5. this build ─────────────────────────────────────────────────────── */
  console.log('\n— version, notes and the published bundle —');
  // This audit is for the v60.1.2 feature, which ships on its own or later.
  const atLeast = (v, min) => {
    const a = String(v).split('.').map(Number), b = String(min).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return true;
  };
  ok('index.html is v60.1.2 or later', atLeast(version, '60.1.2'), version);
  ok('sw.js cache matches', sw.indexOf('sidecut-shell-v' + version) !== -1);
  const entries = [...html.matchAll(/version: '(\d+(?:\.\d+)*)', date: '([^']*)'/g)].map((m) => ({ v: m[1], d: m[2] }));
  ok('the newest entry is this build', entries[0] && entries[0].v === version, entries[0] && entries[0].v);
  ok('its stamp is Eastern time', /(EDT|EST)$/.test(entries[0].d), entries[0].d);
  const own = (html.match(/\{ version: '60\.1\.2'[\s\S]*?\n  \]\}/) || [''])[0];
  ok('the notes describe the pick list', /untick the ones you do not want/i.test(own));
  ok('the notes describe the library landing', /go straight into your library/i.test(own));
  ok('the notes describe the non-blocking encode', /hands control back every ~55ms/i.test(own));
  ok('the notes describe the pill', /progress stays on screen as a small pill/i.test(own));
  ok('the notes describe the file-name fix', /leading track number/i.test(own));

  console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + '/' + (pass + fail) + ' checks passed (v60.1.2)\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('audit crashed:', e && e.stack || e);
  process.exit(1);
});
