// v60.1 audit — the converter's "no source found".
// (Built as "60.0.10"; the third number stops at nine now, so this release is
// 60.1 and no build is ever numbered 60.0.10 again.)
//
// Three independent bugs produced that one message. All were measured against
// the live service before the fix:
//
//   1. TRANSPORT. googlevideo refuses an unbounded request. Against a real
//      ANDROID-client audio URL (itag 140, 2,607,328 B): no Range header → 403,
//      `bytes=0-` → 403, `bytes=0-4194303` → 403, `bytes=0-9999999` (what the
//      old code sent) → 403, while `bytes=0-1048575` → 206. The whole-file
//      download returned nothing at all.
//   2. THE CAP. YouTube serves only the first megabyte of an AUDIO-ONLY stream
//      for a music upload — `1048576-2097151` → 403 — while the progressive
//      audio+video stream of the same video is not capped at all:
//        "Dealer" (Diljit)  itag 140  2,923,372 B: +1MiB → 403
//                           itag 18  11,317,380 B: 11 chunks → 206, complete
//        "52 Bars" (Karan)  itag 140  3,588,881 B: +1MiB → 403 / itag 18 → 206
//        non-music          itag 140  3,449,447 B: +1MiB → 206 (no cap)
//   3. VERIFICATION. A multi-artist credit ("Sukha, Chani") had to appear
//      word-for-word in the single uploader name, which one channel can never
//      satisfy: the search found the official upload and the check binned it.
//
// The checks run the REAL functions out of index.html against a server that
// reproduces those measured rules, so what is asserted is behaviour.
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
function slice(src, from, to) {
  const a = src.indexOf(from);
  if (a === -1) return '';
  const b = src.indexOf(to, a);
  return b === -1 ? '' : src.slice(a, b);
}

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const TRANSPORT = slice(html, '  var SC_AUDIO_CHUNK = 1048576;', '  // Tries every stream the player handed over');
const DECODE = slice(html, '  // Tries every stream the player handed over', '  // Embed real metadata into encoded audio');
const PLAYER = slice(html, '  async function scYtPlayer(videoId){', '  // Tries every stream the player handed over');
const ARTIST = slice(html, '  function scArtistMatch(artist, author, videoTitle, owner, candTitle){', '  // SideCut AI assist');
const SPTOBUFFER = slice(html, '  async function scSpToBuffer(meta, onStatus){', '  // Artist-name check');

/* ── a fake googlevideo with the measured rules ──────────────────────────── */
function makeServer(size, opts) {
  const o = opts || {};
  const body = Buffer.alloc(size);
  for (let i = 0; i < size; i++) body[i] = i % 251;
  const calls = [];
  return {
    body, calls,
    range(hdr) {
      calls.push(hdr);
      if (o.dead) return { status: 403, bytes: Buffer.alloc(0), cr: '' };      // 403, no headers
      const m = /^bytes=(\d+)-(\d+)$/.exec(String(hdr || '').trim());
      if (!m) return { status: 403, bytes: Buffer.alloc(0), cr: '' };          // no Range at all
      const s = Number(m[1]), e = Number(m[2]);
      if (o.ignoresRange) return { status: 200, bytes: body, cr: '' };
      if (s >= size) return { status: 416, bytes: Buffer.alloc(0), cr: 'bytes */' + size };   // past EOF
      if (o.cap !== undefined && s >= o.cap) return { status: 403, bytes: Buffer.alloc(0), cr: '' }; // the cap
      // A real server clamps the end to the file, so the last chunk is short.
      let hi = Math.min(e, size - 1);
      if (o.cap !== undefined) hi = Math.min(hi, o.cap - 1);
      return { status: 206, bytes: body.slice(s, hi + 1), cr: 'bytes ' + s + '-' + hi + '/' + size };
    }
  };
}

// Builds a harness with the REAL transport (and decode) over a fake server.
function buildHarness(server, opts) {
  const o = opts || {};
  globalThis.__scServer = server;
  globalThis.__decodeCalls = 0;
  globalThis.__decoded = null;
  globalThis.__statuses = [];
  globalThis.window = { AudioContext: function () { return {
    decodeAudioData: async function (ab) {
      globalThis.__decodeCalls = (globalThis.__decodeCalls || 0) + 1;
      globalThis.__decoded = ab;
      if (o.failDecodeCalls && globalThis.__decodeCalls <= o.failDecodeCalls) throw new Error('decode failed');
      return { duration: 245, byteLength: ab.byteLength };
    },
    close: function () {}
  }; } };
  const body = `
var ALL = [];
function __scCapHttp(){
  if(!${!!o.native}) return null;
  return { request: async function(req){
    var hdr = req.headers && req.headers.Range;
    ALL.push(hdr);
    globalThis.__lastUrl = req.url;
    var r = globalThis.__scServer.range(hdr);
    return { status: r.status, data: r.bytes.length ? r.bytes.toString('base64') : '', headers: r.cr ? { 'content-range': r.cr } : {} };
  } };
}
${TRANSPORT}
${DECODE}
return { fetchBytes: scFetchBytes, fetchRange: scFetchRange, usable: scStreamUsable, decode: scFetchDecode, all: ALL };`;
  return new Function(body)();
}

(async () => {
  console.log('\n— the transport: bounded 1 MiB ranges, stitched —');
  const big = 2607328;                                  // the real UNDISPUTED track size
  const good = makeServer(big);
  const h1 = buildHarness(good, { native: true });
  const got = await h1.fetchBytes('https://rr5.googlevideo.com/videoplayback?x=1', big);
  ok('a whole track downloads through the native transport', !!got && got.byteLength === big, got && got.byteLength);
  ok('its bytes are exact', !!got && Buffer.from(got).equals(good.body));
  ok('it was pulled in more than one chunk', good.calls.length > 1, good.calls.length);
  ok('no request asked for more than 1 MiB', good.calls.every((h) => {
    const m = /^bytes=(\d+)-(\d+)$/.exec(h); return Number(m[2]) - Number(m[1]) + 1 <= 1048576;
  }), good.calls.join(' '));
  ok('every request carried a bounded Range header', good.calls.every((h) => /^bytes=\d+-\d+$/.test(h)));
  ok('the old whole-file range is never sent', good.calls.indexOf('bytes=0-9999999') === -1);

  const web = makeServer(big);
  const h2 = buildHarness(web, { native: false });
  const oldFetch = globalThis.fetch;
  globalThis.fetch = async function (url, init) {
    const r = globalThis.__scServer.range(init && init.headers && init.headers.Range);
    return {
      status: r.status, ok: r.status === 200,
      headers: { get: (k) => (String(k).toLowerCase() === 'content-range' ? r.cr : null) },
      arrayBuffer: async () => r.bytes.buffer.slice(r.bytes.byteOffset, r.bytes.byteOffset + r.bytes.byteLength)
    };
  };
  const gotWeb = await h2.fetchBytes('https://rr5.googlevideo.com/videoplayback?x=1', big);
  globalThis.fetch = oldFetch;
  ok('the same works when fetch is the transport', !!gotWeb && gotWeb.byteLength === big, gotWeb && gotWeb.byteLength);
  ok('and its bytes are exact too', !!gotWeb && Buffer.from(gotWeb).equals(web.body));

  console.log('\n— a capped stream is rejected, not saved as a stub —');
  const capped = makeServer(2923372, { cap: 1048576 });  // "Dealer", as the live server behaved
  const h3 = buildHarness(capped, { native: true });
  const cappedOut = await h3.fetchBytes('https://rr2.googlevideo.com/videoplayback?x=1', 2923372);
  ok('an audio-only stream cut off at 1 MiB returns nothing', cappedOut === null, cappedOut && cappedOut.byteLength);
  const noSize = buildHarness(makeServer(2923372, { cap: 1048576 }), { native: true });
  const noSizeOut = await noSize.fetchBytes('https://rr2.googlevideo.com/videoplayback?x=1');
  ok('and it is rejected even with no reported size', noSizeOut === null, noSizeOut && noSizeOut.byteLength);
  const probe = buildHarness(makeServer(2923372, { cap: 1048576 }), { native: true });
  ok('the cap is found with a two-byte probe two megabytes in',
    (await probe.usable('u', 2923372)) === false && probe.all.join(',') === 'bytes=2097152-2097153', probe.all.join(','));
  const uncapped = buildHarness(makeServer(2923372), { native: true });
  ok('an uncapped stream of the same size passes the probe', (await uncapped.usable('u', 2923372)) === true && uncapped.all.join(',') === 'bytes=2097152-2097153');
  const small = buildHarness(makeServer(900000), { native: true });
  ok('a file smaller than a chunk counts as usable without a probe',
    (await small.usable('u', 900000)) === true && small.all.length === 0);
  const short = buildHarness(makeServer(1500000), { native: true });
  ok('an uncapped file shorter than the probe answers 416 and counts as usable', (await short.usable('u', 0)) === true);

  console.log('\n— servers that behave differently —');
  const ignored = makeServer(big, { ignoresRange: true });
  const h4 = buildHarness(ignored, { native: true });
  const oneShot = await h4.fetchBytes('u', big);
  ok('a server that ignores Range still returns the file once', !!oneShot && oneShot.byteLength === big && ignored.calls.length === 1, ignored.calls.length);
  const dead = makeServer(big, { dead: true });
  const h5 = buildHarness(dead, { native: true });
  ok('a dead URL returns nothing', (await h5.fetchBytes('u', big)) === null);

  console.log('\n— decode walks the streams: capped audio, then the muxed copy —');
  const audioUrl = 'https://rr2.googlevideo.com/videoplayback?itag=140';
  const muxUrl = 'https://rr2.googlevideo.com/videoplayback?itag=18';
  const muxSize = 11317380;
  // Which file answers depends on the URL, so the shared server routes by it —
  // exactly like two different googlevideo URLs behave in the wild.
  function route(audio, mux) {
    return { range(hdr) {
      return /itag=18/.test(globalThis.__lastUrl || '') ? mux.range(hdr) : audio.range(hdr);
    } };
  }
  const audioServer = makeServer(2923372, { cap: 1048576 });
  const muxServer = makeServer(muxSize);
  globalThis.__scServer = route(audioServer, muxServer);
  const dec = buildHarness(globalThis.__scServer, { native: true });
  const decodeRes = await dec.decode({
    url: audioUrl, size: 2923372,
    alts: [{ url: muxUrl, size: muxSize, muxed: true }]
  });
  ok('the capped audio stream does not stop the conversion', !!decodeRes, decodeRes && decodeRes.url);
  ok('the muxed stream is the one that worked', !!decodeRes && decodeRes.url === muxUrl, decodeRes && decodeRes.url);
  ok('the whole muxed file was downloaded', !!decodeRes && decodeRes.buffer.byteLength === muxSize, decodeRes && decodeRes.buffer.byteLength);
  ok('the capped stream cost exactly one two-byte request',
    audioServer.calls.length === 1 && audioServer.calls[0] === 'bytes=2097152-2097153', audioServer.calls.join(' '));
  const muxProbes = muxServer.calls.filter((h) => h === 'bytes=2097152-2097153').length;
  const muxChunks = muxServer.calls.length - muxProbes;
  ok('the muxed stream was pulled in bounded chunks',
    muxProbes === 1 && muxChunks === Math.ceil(muxSize / 1048576) &&
    muxServer.calls.every((h) => { const m = /^bytes=(\d+)-(\d+)$/.exec(h); return Number(m[2]) - Number(m[1]) + 1 <= 1048576; }),
    muxChunks + ' chunks + ' + muxProbes + ' probe');
  ok('every byte of the muxed file came down, in order',
    !!globalThis.__decoded && globalThis.__decoded.byteLength === muxSize &&
    Buffer.from(globalThis.__decoded).equals(muxServer.body.subarray(0, muxSize)));

  const deadLead = makeServer(2923372, { dead: true });
  const liveAlt = makeServer(4000000);
  globalThis.__scServer = route(deadLead, liveAlt);
  const dec2 = buildHarness(globalThis.__scServer, { native: true });
  const r2 = await dec2.decode({ url: audioUrl, size: 0, alts: [{ url: muxUrl, size: 4000000 }] });
  ok('a dead lead stream falls through to the alternate', !!r2 && r2.url === muxUrl);
  ok('and the dead URL was only probed once', deadLead.calls.length === 1, deadLead.calls.length);
  ok('the patchnotes explain the muxed fallback and its size',
    /progressive audio \+ video stream/.test(html) && /10-12 MB per track/.test(html));

  globalThis.__scServer = makeServer(1000, { dead: true });
  const dec3 = buildHarness(globalThis.__scServer, { native: true });
  ok('nothing usable returns null', (await dec3.decode({ url: 'a', size: 0, alts: [{ url: 'b', size: 0 }] })) === null);
  const badDecode = makeServer(2000000);
  const dec4 = buildHarness(badDecode, { native: true, failDecodeCalls: 1 });
  const r4 = await dec4.decode({ url: 'a', size: 2000000, alts: [{ url: 'b', size: 2000000 }] });
  ok('an undecodable stream moves on to the next', !!r4 && r4.url === 'b');

  console.log('\n— the player hands back small streams first, a muxed one behind —');
  function buildPlayer(clients) {
    const body = `
var ASKED = [];
async function scHttpJson(url, bodyObj){ ASKED.push(bodyObj.context.client.clientName); return ${JSON.stringify(clients)}[bodyObj.context.client.clientName] || null; }
${PLAYER}
return { player: scYtPlayer, asked: ASKED };`;
    return new Function(body)();
  }
  const aFmt = (itag, url, clen) => ({ itag, url, mimeType: 'audio/mp4; codecs="mp4a.40.2"', contentLength: String(clen) });
  const vFmt = (itag, url, clen) => ({ itag, url, mimeType: 'video/mp4; codecs="avc1.42001E, mp4a.40.2"', contentLength: String(clen) });
  const p1 = buildPlayer({
    ANDROID: { videoDetails: { title: 'Dealer', author: 'Diljit Dosanjh' }, streamingData: { adaptiveFormats: [aFmt(140, 'url-140-android', 2923372), aFmt(251, 'url-251-android', 3230000)], formats: [vFmt(18, 'url-18-android', 11317380)] } },
    IOS: { videoDetails: { title: 'Dealer', author: 'Diljit Dosanjh' }, streamingData: { adaptiveFormats: [aFmt(140, 'url-140-ios', 2923372)], formats: [] } }
  });
  const s1 = await p1.player('vid');
  ok('the best audio-only stream leads', s1 && s1.url === 'url-251-android', s1 && s1.url);
  ok('the iOS audio stream is next', s1 && s1.alts[0] && s1.alts[0].url === 'url-140-ios', s1 && JSON.stringify(s1.alts.map((a) => a.url)));
  ok('the muxed copy is the safety net behind them', s1 && s1.alts.some((a) => a.url === 'url-18-android' && a.muxed));
  ok('the muxed stream is last, never first', s1 && s1.alts[s1.alts.length - 1].url === 'url-18-android');
  ok('the real track size rides along', s1 && s1.size === 3230000, s1 && s1.size);
  ok('the video title/author are still reported', s1 && s1.videoTitle === 'Dealer' && s1.author === 'Diljit Dosanjh');
  ok('no more than the first two answering clients were asked', p1.asked.length === 2, p1.asked.join(','));
  const p2 = buildPlayer({
    ANDROID: { videoDetails: { title: 'x', author: 'y' }, streamingData: { adaptiveFormats: [aFmt(140, 'url-140', 100)], formats: [] } }
  });
  const s2 = await p2.player('vid');
  ok('a video with no progressive copy still works off audio-only', !!s2 && s2.url === 'url-140' && s2.alts.length === 0);
  const p4 = buildPlayer({
    ANDROID: { videoDetails: {}, streamingData: { adaptiveFormats: [], formats: [{ itag: 18, url: 'u', mimeType: 'video/mp4; codecs="avc1.42001E"' }] } }
  });
  ok('a silent video-only row is refused', (await p4.player('vid')) === null);
  const p5 = buildPlayer({});
  ok('no stream anywhere returns null', (await p5.player('vid')) === null);

  console.log('\n— the right upload wins even when the merge buries it —');
  // The live failure: the quoted search's covers were merged AHEAD of the
  // artist's own upload, so the correct source was never reached. The scores
  // below are the real ones the scorer gives these uploads for "8 ASLE" by
  // "Sukha, Chani": the artist's own channel keeps +16, the re-uploads take -60.
  const SUKHA = { videoId: 'sukha-own', title: '8 ASLE - SUKHA | GURLEZ AKHTAR | CHANI NATTAN | PRODGK', owner: 'SUKHA', duration: 208, score: 22 };
  const covers = [
    { videoId: 'cover-1', title: '8 Asle (Bass Boosted) Surround Sound Sukha', owner: 'Panjab surround sound', duration: 252, score: -54 },
    { videoId: 'cover-2', title: '8 ASLE - SUKHA | GURLEZ AKHTAR | CHANI NATTAN | PRODGK', owner: 'SYSTEM RECORDS', duration: 208, score: -54 },
    { videoId: 'cover-3', title: '8 ASLE - SUKHA | GURLEZ AKHTAR | CHANI NATTAN | PRODGK', owner: '48 RECORDS', duration: 208, score: -54 },
    { videoId: 'cover-4', title: '8 ASLE is PURE FIRE! Reacting to SUKHA', owner: 'J x Nate', duration: 723, score: -114 },
    { videoId: 'cover-5', title: '8 ASLE BHANGRA WORKSHOP | SUKHA | GURLEZ', owner: 'Bhangra Empire', duration: 300, score: -54 },
    { videoId: 'cover-6', title: '8 Asle (slowed + reverb)', owner: 'slowed edits', duration: 240, score: -79 },
    { videoId: 'cover-7', title: '8 Asle instrumental', owner: 'beats daily', duration: 208, score: -79 },
    { videoId: 'cover-8', title: '8 Asle karaoke', owner: 'karaoke nation', duration: 208, score: -79 }
  ];
  globalThis.__AUTHORS = { 'sukha-own': 'SUKHA' };
  covers.forEach((c) => { globalThis.__AUTHORS[c.videoId] = c.owner; });
  function buildConverter(quoted, main) {
    globalThis.__QUOTED = quoted;
    globalThis.__MAIN = main;
    const body = '\n' +
      'var window = {};\n' +
      'var PLAYED = [];\n' +
      'var DECODED = [];\n' +
      'async function scYtSearch(query, artistHint){ return (query.charAt(0) === String.fromCharCode(34) ? globalThis.__QUOTED : globalThis.__MAIN).slice(); }\n' +
      'async function scYtPlayer(videoId){ PLAYED.push(videoId); return { url: "stream-" + videoId, size: 2000000, muxed: false, author: globalThis.__AUTHORS[videoId] || "", videoTitle: "", alts: [] }; }\n' +
      'async function scFetchDecode(stream){ DECODED.push(stream.url); return { buffer: { duration: 208 }, url: stream.url }; }\n' +
      ARTIST + '\n' + SPTOBUFFER + '\n' +
      'return { run: scSpToBuffer, played: PLAYED, decoded: DECODED, fail: function(){ return window.__scSourceFail; } };';
    return new Function(body)();
  }
  const conv = buildConverter(covers, covers.concat([SUKHA]));
  const out = await conv.run({ title: '8 ASLE', artist: 'Sukha, Chani' }, function () {});
  ok('the artist\'s own upload is reached despite the merge', !!out && conv.decoded[0] === 'stream-sukha-own', conv.decoded.join(','));
  ok('and it is verified first, before any cover', conv.played.length === 1 && conv.played[0] === 'sukha-own', conv.played.join(','));
  ok('nothing else is downloaded', conv.decoded.length === 1, conv.decoded.length);
  const badConv = buildConverter(covers, covers);
  const none = await badConv.run({ title: '8 ASLE', artist: 'Sukha, Chani' }, function () {});
  ok('with no matching upload anywhere it still refuses', none === null && badConv.fail() === 'no matching source', badConv.fail());
  ok('and it saved nothing', badConv.decoded.length === 0, badConv.decoded.length);

  console.log('\n— the artist check: one credit matching is enough —');
  const am = new Function(`${ARTIST}\nreturn scArtistMatch;`)();
  // The album this was reported from: "UNDISPUTED", credited to Sukha + Chani,
  // uploaded on the SUKHA channel.
  ok('"Sukha, Chani" accepts the SUKHA upload (was: rejected)',
    am('Sukha, Chani', 'SUKHA', '8 ASLE - SUKHA | GURLEZ AKHTAR | CHANI NATTAN | PRODGK', 'SUKHA', '8 ASLE - SUKHA') === true);
  ok('it accepts through the official auto-channel too',
    am('Sukha, Chani', 'Sukha - Topic', '8 ASLE', 'Sukha - Topic', '8 ASLE') === true);
  ok('a single-artist credit still matches its own channel',
    am('Diljit Dosanjh', 'Diljit Dosanjh', 'Lover', 'Diljit Dosanjh', 'Lover') === true);
  ok('and still matches a label auto-channel',
    am('Karan Aujla', 'Karan Aujla - Topic', '52 Bars', 'Karan Aujla - Topic', '52 Bars') === true);
  ok('"Diljit Dosanjh & Sia" accepts the Diljit upload (was: rejected)',
    am('Diljit Dosanjh & Sia', 'Diljit Dosanjh', 'Ranjha', 'Diljit Dosanjh', 'Ranjha') === true);
  ok('an x-credit works too', am('Chani Nattan x Sukha', 'SUKHA', 'Tere Karke', 'SUKHA', 'Tere Karke') === true);
  ok('another artist\'s channel is still rejected',
    am('Sukha, Chani', 'Some Cover Band', '8 ASLE (cover)', 'Some Cover Band', '8 ASLE (cover)') === false);
  ok('a lyric video by an unrelated channel is still rejected',
    am('Sukha, Chani', 'Lyrics World', '8 ASLE Lyrics', 'Lyrics World', '8 ASLE Lyrics') === false);
  ok('a wrong-artist single is still rejected',
    am('Diljit Dosanjh', 'Jasleen Royal', 'Ranjha', 'Jasleen Royal', 'Ranjha') === false);
  ok('an auto-channel for a different artist is still rejected',
    am('Sukha, Chani', 'Jasleen Royal - Topic', 'Ranjha', 'Jasleen Royal - Topic', 'Ranjha') === false);
  ok('unknown/various artists stay permissive',
    am('Unknown Artist', 'anyone', '', 'x', '') === true && am('Various Artists', 'anyone', '', 'x', '') === true);

  console.log('\n— everything is wired to the new path —');
  ok('the app is v60.1', version === '60.1', version);
  ok('the service worker cache moved with it', /sidecut-shell-v60\.1\b/.test(sw));
  ok('the patchnotes carry the new version', /\{ version: '60\.1', date:/.test(html));
  ok('the batch converter uses the decode result',
    /var dec = await scFetchDecode\(audio, onStatus\);[\s\S]{0,200}streamUrl: dec\.url/.test(html));
  ok('and says when the bigger muxed stream is used',
    /if\(s\.muxed && onStatus\) onStatus\('[^']*bigger file/.test(html));
  ok('the YouTube converter uses it too',
    /var dec = await scFetchDecode\(audio\);/.test(html) && /scEncodeAudio\(dec\.buffer/.test(html));
  ok('no caller still passes a bare URL to scFetchDecode', !/scFetchDecode\([a-zA-Z_.]+\.url\)/.test(html));
  ok('the failure reason is carried into the row',
    /window\.__scSourceFail/.test(html) && /reason: window\.__scSourceFail \|\| 'no source found'/.test(html));
  ok('the reasons distinguish the three failures',
    html.indexOf("'no matching source'") !== -1 && html.indexOf("'download blocked'") !== -1);
  ok('the old whole-file request is gone from the source', html.indexOf("'Range': 'bytes=0-9999999'") === -1);
  ok('the merged candidates are ranked by score', /cands\.sort\(function\(a, b\)\{ return \(b && b\.score \? b\.score : 0\) - \(a && a\.score \? a\.score : 0\); \}\);/.test(html));
  ok('a credited artist scores its own channel', /creditNames\[cn\] && ownLow\.indexOf\(creditNames\[cn\]\) !== -1/.test(html));
  ok('and the verifier walks ten candidates', /ci < cands\.length && ci < 10/.test(html));

  console.log('\n— numbering: 60.0.9 → 60.1, and never 60.0.10 —');
  ok('the notes say why the number is 60.1', html.indexOf('it was going to be numbered 60.0.10') !== -1);
  ok('and the rule is written down where the version is',
    /The third number stops at nine/.test(html) && html.indexOf('60.0.9 is followed by 60.1') !== -1);
  // The decision to install runs in whichever build the phone has, so both
  // comparators are exercised: the page's and the shipped OTA client's.
  function cmpFn(src, from, to) {
    const a = src.indexOf(from), b = src.indexOf(to);
    if (a === -1 || b === -1 || b < a) return null;
    try { return new Function(src.slice(a, b) + '\nreturn compareVersions;')(); } catch (e) { return null; }
  }
  const otaSrc = fs.readFileSync(path.join(ROOT, 'dev', 'native-updates.js'), 'utf8');
  const pageCmp = cmpFn(html, 'const LEGACY_VERSIONS', '  // 58.9.6/58.9.7 snapshots');
  const otaCmp = cmpFn(otaSrc, 'var LEGACY_VERSIONS', '  function currentVersion(){');
  [['page', pageCmp], ['OTA client', otaCmp]].forEach(([who, cmp]) => {
    if (typeof cmp !== 'function') { fail++; console.log('  ✗ ' + who + ' comparator missing'); return; }
    ok(who + ': v60.1 is newer than v60.0.9', cmp('60.1', '60.0.9') > 0);
    ok(who + ': this build’s own version is never rewritten to 60.0.2',
      cmp('60.1', '60.1') === 0 && cmp('60.1', '60.0.2') > 0);
    ok(who + ': the 60.0.10 label reads as 60.1', cmp('60.0.10', '60.1') === 0);
    ok(who + ': the other legacy labels still read correctly',
      cmp('60.4', '60.0.5') === 0 && cmp('60.4.2', '60.0.8') === 0);
  });

  console.log('\n' + (fail ? '✗ ' : '✓ ') + pass + '/' + (pass + fail) + ' checks passed (v60.1)\n');
  process.exit(fail ? 1 : 0);
})();
