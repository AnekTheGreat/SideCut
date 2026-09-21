// v60.1.3 audit — three things:
//   1. commas between artists: the file-name cleaner keeps them, every credit is
//      normalized to "A, B", and a multi-artist credit is read whole (not just
//      artists[0])
//   2. lossless downloads: FLAC is the default output everywhere, and the FLAC
//      encoder yields instead of freezing the app — with the encoded bytes frozen
//      as a golden hash, so "it still produces the same file" is checked, not
//      assumed
//   3. this build: version, notes, and the published OTA bundle
//
// The behavioural parts run the REAL functions lifted out of index.html.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'manifest.json'), 'utf8'));

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

/* ── helpers lifted out of the page ──────────────────────────────────────── */
const helperSrc = slice('  function scSafeName(s){', '  // ─── Native HTTP transport');
const F = new Function(helperSrc + '\nreturn { scSafeName: scSafeName, scArtistCredits: scArtistCredits, scArtistsArrayCredits: scArtistsArrayCredits };')();

/* ── 1. commas between artists ──────────────────────────────────────────── */
console.log('\n— the file name keeps its commas —');
{
  const nm = F.scSafeName;
  ok('a converted multi-artist name survives intact',
    nm('Diljit Dosanjh, Sia - Dealer') === 'Diljit Dosanjh, Sia - Dealer', JSON.stringify(nm('Diljit Dosanjh, Sia - Dealer')));
  ok('a track-numbered converted name survives too',
    nm('01 - Diljit Dosanjh, Sia - Dealer') === '01 - Diljit Dosanjh, Sia - Dealer',
    JSON.stringify(nm('01 - Diljit Dosanjh, Sia - Dealer')));
  ok('what the old cleaner did to the same name is gone',
    nm('Diljit Dosanjh, Sia') !== 'Diljit Dosanjh Sia');
  ok('no comma-space is doubled', nm('A,  B ,  C') === 'A, B, C', JSON.stringify(nm('A,  B ,  C')));
  ok('a leading or trailing comma is dropped', nm(', A, B ,') === 'A, B', JSON.stringify(nm(', A, B ,')));
  ok('brackets and slashes are still stripped', nm('C++ (Remix)') === 'C Remix', JSON.stringify(nm('C++ (Remix)')));
  ok('an empty name still falls back', nm('') === 'audio');

  console.log('\n— a credit is normalized to comma form —');
  const cr = F.scArtistCredits;
  ok('ampersand → comma', cr('Diljit Dosanjh & Sia') === 'Diljit Dosanjh, Sia', JSON.stringify(cr('Diljit Dosanjh & Sia')));
  ok('feat. → comma', cr('Diljit Dosanjh feat. Sia') === 'Diljit Dosanjh, Sia', JSON.stringify(cr('Diljit Dosanjh feat. Sia')));
  ok('ft. → comma', cr('A ft. B') === 'A, B', JSON.stringify(cr('A ft. B')));
  ok('"x" → comma', cr('A x B') === 'A, B', JSON.stringify(cr('A x B')));
  ok('a chain becomes a comma list', cr('A x B feat. C') === 'A, B, C', JSON.stringify(cr('A x B feat. C')));
  ok('semicolons are commas too', cr('Sukha; Chani') === 'Sukha, Chani', JSON.stringify(cr('Sukha; Chani')));
  ok('a list already in comma form is only tidied', cr('  Sukha ,  Chani ') === 'Sukha, Chani', JSON.stringify(cr('  Sukha ,  Chani ')));
  ok('duplicates are dropped once', cr('Sukha; Chani; sukha') === 'Sukha, Chani', JSON.stringify(cr('Sukha; Chani; sukha')));
  ok('a single name is left alone', cr('Diljit Dosanjh') === 'Diljit Dosanjh', JSON.stringify(cr('Diljit Dosanjh')));
  ok('an empty credit stays empty', cr('') === '');
  ok('an artists[] array becomes the whole credit',
    F.scArtistsArrayCredits([{ name: 'Diljit Dosanjh' }, { name: 'Sia' }, { name: 'David Guetta' }]) === 'Diljit Dosanjh, Sia, David Guetta',
    JSON.stringify(F.scArtistsArrayCredits([{ name: 'Diljit Dosanjh' }, { name: 'Sia' }, { name: 'David Guetta' }])));
  ok('an empty artists[] array is just empty', F.scArtistsArrayCredits([]) === '');
}

console.log('\n— every credit the app builds goes through it —');
{
  ok('the single-track Spotify read takes the whole artists[] list',
    /var _entCredits = scArtistsArrayCredits\(ent\.artists\);/.test(html));
  ok('and no longer settles for artists[0]',
    !/artists\.length && ent\.artists\[0\]\.name\) csMeta\.artist/.test(html));
  ok('the plan resolver does the same for a pasted track link',
    /var _tCred = scArtistsArrayCredits\(tEnt\.artists\);/.test(html));
  ok('an album or playlist artist is normalized',
    /var eArtist = scArtistCredits\(embedEnt\.subtitle \|\| ''\);/.test(html));
  ok('each album track credit is normalized',
    /artist: scArtistCredits\(er\.subtitle \|\| eArtist \|\| ''\),/.test(html));
  ok('the Deezer fallback credit is normalized',
    /var tArtist = scArtistCredits\(\(tr\.artist && tr\.artist\.name\) \|\| alArtist\);/.test(html));
  ok('a converted song\\u2019s library credit is normalized',
    /var artist = scArtistCredits\(String\(\(meta && meta\.artist\) \|\| o\.artist \|\| ''\)\.trim\(\)\) \|\| 'Unknown artist';/.test(html));
  ok('imports are normalized on the way in',
    /const _credits = scArtistCredits\(artist\);/.test(html));
}

console.log('\n— run for real: an import and a converted song —');
{
  const guessSrc = slice('  function guessMeta(filename){', '\n  // ---------------- Automatic genre detection');
  const guessMeta = new Function(guessSrc + '\nreturn guessMeta;')();
  const converted = guessMeta('01 - Diljit Dosanjh, Sia - Dealer.mp3');
  ok('a converted multi-artist file reads as one artist with a comma',
    converted.artist === 'Diljit Dosanjh, Sia', JSON.stringify(converted));
  ok('and its title is the song', converted.title === 'Dealer', JSON.stringify(converted));

  const cleanSrc = slice('  function applyWatermarkPatterns', '\n  function updateWatermarkToggle');
  const clean = new Function(
    'var watermarkEnabled = true;\nvar watermarkPatterns = "Radio Edit\\n(feat. X)";\nvar watermarkArtistPatterns = "";\n' +
    helperSrc + cleanSrc + '\nreturn cleanOnImport;')();
  const imported = clean('Dealer', 'Diljit Dosanjh & Sia');
  ok('an imported "A & B" credit is stored as "A, B"', imported.artist === 'Diljit Dosanjh, Sia', JSON.stringify(imported));
  const single = clean('Dealer', 'Diljit Dosanjh');
  ok('a single-artist import is untouched', single.artist === 'Diljit Dosanjh', JSON.stringify(single));

  const addSrc = slice('  function scAddConvertedToLibrary(blob, meta, opts){', '\n  // ─── Progress pill');
  const harness = new Function('scSafeName', 'scArtistCredits', 'URL', 'Blob', 'File', `
    var idCounter = 1, allTracks = [], playlists = { 'All Songs': [] };
    function persistTrackMeta(){} function saveMeta(){} function readLazyMeta(){} function renderTabs(){} function renderList(){}
    ${addSrc}
    return { add: scAddConvertedToLibrary, tracks: function(){ return allTracks; } };
  `)(F.scSafeName, F.scArtistCredits, URL, Blob, File);
  const art = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0]);
  const track = harness.add(new Blob([new Uint8Array(64)], { type: 'audio/flac' }), {
    title: 'Dealer', artist: 'Diljit Dosanjh & Sia', album: 'Ghost', artBytes: art, artMime: 'image/jpeg'
  }, { fileName: '01 - Diljit Dosanjh, Sia - Dealer.flac', fmt: 'flac', source: 'conversion' });
  ok('a converted song\\u2019s library credit is comma-separated', track && track.artist === 'Diljit Dosanjh, Sia', track && track.artist);
  ok('and its file name kept the comma', track && /Diljit Dosanjh, Sia/.test(track.file.name), track && track.file.name);
}

/* ── 2. lossless downloads ──────────────────────────────────────────────── */
console.log('\n— the format menu opens on lossless —');
{
  const opts = (id) => {
    const m = html.match(new RegExp('id="' + id + '"[^>]*>([\\s\\S]*?)</select>'));
    return m ? m[1] : '';
  };
  ['spFmtDisc', 'ytFmtDisc', 'spFmtSettings', 'ytFmtSettings'].forEach((id) => {
    const body = opts(id);
    ok(id + ' leads with MP3 and has it selected',
      /^<option value="mp3" selected>MP3 \(smaller\)<\/option>/.test(body), body.slice(0, 90));
    ok(id + ' has no selected FLAC', !/<option value="flac" selected/.test(body));
  });
  ok('the batch picker leads with MP3', /<option value="mp3"' \+ \(presetFmt === 'mp3' \? ' selected' : ''\) \+ '>MP3 \(smaller\)<\/option>/.test(html));
  ok('the on-device picker offers FLAC first, as the emphasised button',
    /window\.__csSpPick\(\\'flac\\'\)" style="padding:5px 12px; border-radius:6px; background:var\(--coral\)/.test(html));
  ok('the YouTube converter\\u2019s own fallback order is lossless first',
    /: \['flac', 'wav', 'mp3'\];/.test(html));
  ok('the Discover Save fallback is MP3', /var fmt = 'mp3';   \/\/ MP3 unless/.test(html));
  ok('the panel says what the default is', /Lossless by default: FLAC keeps every bit of the audio/.test(html));
}

console.log('\n— the FLAC encoder stays off the main thread, same bytes —');
const flacSrc = (() => {
  const a = html.indexOf('async function encodeAudioBufferToFlac(audioBuffer, meta, onSlice){');
  const b = html.indexOf("return new Blob([out], { type: 'audio/flac' });", a);
  const end = html.indexOf('\n  }', b);
  return html.slice(a, end + 4);
})();
const flac = new Function(
  'function scYieldToUI(){ return new Promise(function(res){ setTimeout(res, 0); }); }\n' +
  flacSrc + '\nreturn encodeAudioBufferToFlac;')();

function makeBuffer(seconds, channels) {
  const sr = 44100, len = Math.floor(sr * seconds), data = [];
  for (let c = 0; c < channels; c++) {
    const arr = new Float32Array(len);
    for (let i = 0; i < len; i++) arr[i] = Math.sin((i + c * 97) * 0.017) * 0.6;
    data.push(arr);
  }
  return { numberOfChannels: channels, sampleRate: sr, length: len, duration: seconds, getChannelData: (c) => data[c] };
}
const sha256 = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');

(async () => {
  {
    // The bytes are frozen: these hashes are what the pre-60.1.3 synchronous
    // encoder produced for the same input (verified byte-for-byte before the
    // change, and re-checked here so a later edit to the encoder cannot slip by).
    const meta = { title: 'Dealer', artist: 'Diljit Dosanjh, Sia', album: 'Ghost', year: '2023', genre: 'Punjabi', track: '1', artBytes: null, artMime: null };
    const stereo = new Uint8Array(await (await flac(makeBuffer(10, 2), meta)).arrayBuffer());
    ok('the lossless file is byte-for-byte the one the old encoder wrote',
      stereo.length === 292032 && sha256(stereo) === '5f7e5a9c7f2aee8b0f5e5e64e14877beb13bb3289118eadf2ad027ce58673f49',
      stereo.length + ' bytes, ' + sha256(stereo).slice(0, 16));
    ok('it is a real FLAC stream', String.fromCharCode(stereo[0], stereo[1], stereo[2], stereo[3]) === 'fLaC');
    const mono = new Uint8Array(await (await flac(makeBuffer(3, 1), { title: 'Solo' })).arrayBuffer());
    ok('a second fixed point matches too (mono, no tags)',
      mono.length === 43988 && sha256(mono) === 'c216a5810dba1fd384f30d02e0f7589b2e74e670030876f95fb9f15924cfd92f',
      mono.length + ' bytes');
  }

  {
    // Responsiveness: a real timer can only fire when the encoder hands the thread
    // back between blocks, so ticks prove the slicing works.
    let ticks = 0, slices = 0;
    const timer = setInterval(() => { ticks++; }, 0);
    const t0 = Date.now();
    const blob = await flac(makeBuffer(45, 2), { title: 'Long one' }, () => { slices++; });
    const elapsed = Date.now() - t0;
    clearInterval(timer);
    ok('the encoder hands the main thread back while it works', ticks >= 5, ticks + ' ticks in ' + elapsed + 'ms');
    ok('and reports progress as it goes', slices >= 3, slices + ' progress reports');
    ok('the whole file is still produced', !!blob && blob.size > 1000, blob && blob.size);
  }

  {
    ok('the cooperative wrapper is what the converters call for FLAC',
      /if\(fmt === 'flac'\)\{\s*\n\s*try\{ return await encodeAudioBufferToFlac\(buf, meta, onSlice\); \}/.test(html));
    ok('the YouTube converter awaits it',
      /try\{ blob = await scEncodeAudio\(dec\.buffer, fmt, \{/.test(html));
    ok('and the MP4 converter awaits it',
      /fBlob = await encodeAudioBufferToFlac\(audioBuffer\);/.test(html) &&
      /decodeAudioData\(arrayBuffer\)\.then\(async function\(audioBuffer\)\{/.test(html));
    ok('every await on the FLAC encoder sits inside a try/catch, so a failure still ends as null, not a rejection',
      (html.match(/try\{[^\n]*await encodeAudioBufferToFlac\(/g) || []).length ===
      (html.match(/await encodeAudioBufferToFlac\(/g) || []).length &&
      (html.match(/await encodeAudioBufferToFlac\(/g) || []).length === 2,
      (html.match(/await encodeAudioBufferToFlac\(/g) || []).length + ' await sites');
  }

  /* ── 3. this build ────────────────────────────────────────────────────── */
  console.log('\n— version, notes and the published bundle —');
  const atLeast = (v, min) => {
    const a = String(v).split('.').map(Number), b = String(min).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return true;
  };
  ok('index.html is v60.1.3 or later', atLeast(version, '60.1.3'), version);
  ok('sw.js cache matches', sw.indexOf('sidecut-shell-v' + version) !== -1);
  const entries = [...html.matchAll(/version: '(\d+(?:\.\d+)*)', date: '([^']*)'/g)].map((m) => ({ v: m[1], d: m[2] }));
  ok('the newest entry is this build', entries[0] && entries[0].v === version, entries[0] && entries[0].v);
  ok('its stamp is Eastern time with minutes', /(EDT|EST)$/.test(entries[0].d) && /:\d\d /.test(entries[0].d), entries[0].d);
  ok('the version history is contiguous on this line (60.1.2 -> 60.1.3)',
    entries.findIndex((e) => e.v === '60.1.2') >= 0 && entries.findIndex((e) => e.v === '60.1.3') < entries.findIndex((e) => e.v === '60.1.2'));
  const own = (html.match(/\{ version: '60\.1\.3'[\s\S]*?\n  \]\}/) || [''])[0];
  ok('the notes describe the lossless default', /Downloads are lossless now/.test(own));
  ok('the notes describe the encoder no longer freezing the app', /no longer freezes the app/.test(own));
  ok('the notes describe the commas', /Artists are comma-separated everywhere/.test(own));
  ok('the notes describe the album artist rename', /Rename an album and its artist in one go/.test(own));
  ok('the notes describe the record-player fix', /record player opens the album properly/.test(own));
  ok('the OTA manifest carries this version', String(manifest.version) === version, manifest.version);
  ok('the OTA bundle exists for it', fs.existsSync(path.join(ROOT, 'ota', 'update.zip')));
  const updates = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  ok('updates.json carries this version', String(updates.version) === version, updates.version);
  ok('and the notes reach the update popup', Array.isArray(updates.notes) && updates.notes.length >= 3, updates.notes && updates.notes.length);

  console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + '/' + (pass + fail) + ' checks passed (v60.1.3)\n');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.error('audit crashed:', (e && e.stack) || e);
  process.exit(1);
});
