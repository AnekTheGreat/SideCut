#!/usr/bin/env node
// v60.1 LIVE check (built as "60.0.10" — the third number stops at nine now) — needs the network, so it is not part of the offline
// audit. It lifts the real functions straight out of index.html and runs real
// conversions, because "no source found" was only ever reproducible against the
// live service.
//
//   node dev/v6010-live.cjs
//
// Per track it prints the streams the player handed over (and which are muxed),
// how many chunk requests and two-byte cap probes were made, and how many bytes
// actually decoded.
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
function slice(from, to) {
  const a = html.indexOf(from);
  const b = html.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from);
  return html.slice(a, b);
}

const body = `
var window = { AudioContext: function(){ return {
  decodeAudioData: async function(ab){ globalThis.__decoded = ab; return { duration: ab.byteLength / 1000, byteLength: ab.byteLength }; },
  close: function(){}
}; } };
${slice('  function __scCapHttp(){', '  var SC_AUDIO_CHUNK = 1048576;')}
${slice('  var SC_AUDIO_CHUNK = 1048576;', '  // Tries every stream the player handed over')}
${slice('  // Tries every stream the player handed over', '  // Embed real metadata into encoded audio')}
${slice('  async function scYtSearch(query, artistHint){', '  async function scYtPlayer(videoId){')}
${slice('  async function scYtPlayer(videoId){', '  // Tries every stream the player handed over')}
${slice('  function scArtistMatch(artist, author, videoTitle, owner, candTitle){', '  // SideCut AI assist')}
${slice('  async function scSpToBuffer(meta, onStatus){', '  // Artist-name check')}
return { spToBuffer: scSpToBuffer, search: scYtSearch, player: scYtPlayer, artist: scArtistMatch };
`;

const TRACKS = [
  { title: '8 ASLE', artist: 'Sukha, Chani', note: 'the album that always failed (co-credited artist)' },
  { title: 'Dealer', artist: 'Diljit Dosanjh', note: 'single-artist music track' },
  { title: 'Never Gonna Give You Up', artist: 'Rick Astley', note: 'non-music control (never capped)' }
];

(async () => {
  const realFetch = globalThis.fetch;
  let requests = [];
  globalThis.fetch = function (url, init) {
    const o = Object.assign({}, init || {});
    const h = Object.assign({}, o.headers || {});
    const hdr = h.Range || h.range || '';
    if (/googlevideo/.test(String(url))) requests.push(hdr);
    // The app's Capacitor transport sends the WebView's user agent; Node's
    // undici one gets the InnerTube API bot-checked, so match the real caller.
    if (/youtube\.com\/youtubei/.test(String(url))) {
      h['User-Agent'] = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 Chrome/131 Mobile Safari/537.36';
      h['Origin'] = 'https://www.youtube.com';
      h['X-Youtube-Client-Name'] = '1';
      h['X-Youtube-Client-Version'] = '2.20240801.00.00';
    }
    o.headers = h;
    return realFetch(String(url), o);
  };
  const api = new Function(body)();
  let bad = 0;
  for (const t of TRACKS) {
    requests = [];
    globalThis.__decoded = null;
    console.log('\n=== "' + t.title + '" by ' + t.artist + '  —  ' + t.note);
    let streams = null;
    try {
      const cands = await api.search(t.title + ' ' + t.artist, t.artist);
      console.log('   search: ' + (cands ? cands.length : 0) + ' candidates' + (cands && cands.length ? ' | top: ' + cands[0].title.slice(0, 58) : ''));
      if (cands && cands.length) streams = await api.player(cands[0].videoId);
    } catch (e) {
      console.log('   player lookup failed: ' + (e && e.message));
    }
    if (streams) {
      console.log('   streams: ' + [streams].concat(streams.alts)
        .map((s) => 'itag ' + s.itag + (s.muxed ? '(muxed)' : '') + ' ' + Math.round(s.size / 1024) + 'KB').join(' | '));
    }
    const statuses = [];
    const res = await api.spToBuffer({ title: t.title, artist: t.artist, album: '', year: '' }, (txt) => statuses.push(txt));
    const probes = requests.filter((h) => /^bytes=\d+-\d+$/.test(h) && (Number(h.split('-')[1]) - Number(h.split('-')[0].slice(6)) + 1) === 2).length;
    if (res && res.buffer) {
      const bytes = globalThis.__decoded ? globalThis.__decoded.byteLength : 0;
      console.log('   ✓ converted — ' + bytes + ' bytes decoded, ' + requests.length + ' googlevideo requests (' +
        (requests.length - probes) + ' chunks + ' + probes + ' cap probes)');
      console.log('   status trail: ' + statuses.join(' → ').slice(0, 300));
    } else {
      bad++;
      console.log('   ✗ failed — last status: ' + (statuses[statuses.length - 1] || 'none'));
      // Why: walk the candidates again and say which failed verification and
      // whether the player even answered for them.
      const again = await api.search(t.title + ' ' + t.artist, t.artist).catch(() => null);
      if (again) {
        for (let i = 0; i < again.length && i < 6; i++) {
          const v = again[i];
          let pa = null;
          try { pa = await api.player(v.videoId); } catch (e) { pa = null; }
          const verdict = pa ? api.artist(t.artist, pa.author, pa.videoTitle, v.owner, v.title) : 'no player response';
          console.log('     [' + (i + 1) + '] ' + v.videoId + ' ch=' + JSON.stringify(v.owner) + ' | player=' +
            (pa ? JSON.stringify(pa.author) + ' / ' + JSON.stringify(pa.videoTitle).slice(0, 40) + ' | streams=' + (1 + pa.alts.length) : 'NONE') +
            ' | match=' + verdict);
        }
      }
    }
  }
  console.log('\n' + (bad ? '✗ ' + bad + ' of ' + TRACKS.length + ' tracks failed' : '✓ all ' + TRACKS.length + ' tracks converted') + '\n');
  process.exit(bad ? 1 : 0);
})().catch((e) => { console.error('live check crashed:', e && e.stack); process.exit(1); });
