#!/usr/bin/env node
// v61.3.9 — "Spotify import, YouTube convert, and upcoming album drops" (the
// actual code this time — d2dee07's message promised it, the diff never had it).
//
// What was actually broken, measured against the live services before touching
// anything (Sep 25, 2026):
//   1. The public CORS relay chain every lookup fell back to is dead:
//      corsproxy.io answers 401 ("A valid API key is required") for every
//      request — permanently key-walled — and api.allorigins.win /
//      api.codetabs.com were both down (520/522/timeouts). Seven call sites
//      hardcode those three relays.
//   2. On the device a page fetch is still bound by CORS for anything the
//      relay chain used to cover: Spotify's embed pages send NO
//      access-control-allow-origin, so with the relays dead the converter's
//      metadata legs (artist, album, cover) and every album/playlist track
//      list resolution had no working path at all. The Capacitor HTTP plugin
//      runs the same URL CORS-free on the native stack, and nothing used it
//      for these calls.
//   3. window.__ahCancelled (Album History's cancel flag) is shared by
//      fetchWithProxy: once the user cancelled ONE album fetch, every caller
//      of the shared helper answered null for the rest of the session — the
//      drop check, cover fetches and the converter's Deezer fallback all
//      silently found nothing until a restart or the next album fetch.
//   4. fetchArtistReleases returned [] the moment the iTunes pass failed
//      (if(!resp || !resp.ok) return []), so the MusicBrainz and silent
//      Spotify passes — the only sources that carry DATED future drops —
//      never ran when Apple hiccuped.
//   5. MusicBrainz 403s requests that do not identify the application
//      (measured: no UA → 403, okhttp → 403, browser/SideCut UA → 200) and a
//      page fetch cannot set a User-Agent — only a native attempt can.
//
// The fix:
//   [1] new __scNativeFetch(url, opts) — native-first, CORS-free, custom
//       User-Agent capable, returns a Response-shaped object or null.
//   [2] fetchWithProxy(url, init) — self-heals the latched cancel flag, tries
//       native first, forwards caller init (method/headers/body — this also
//       un-breaks the Gemini lyrics POST that was silently sent as GET), then
//       direct fetch, then live relays (corsproxy.io replaced by cors.lol).
//   [3] scSpEmbedEntity / scSpEmbedTrack — 'native:' attempts first, relay
//       lists refreshed.
//   [4] scSpOembed / expandSpotifyUrl / OTA manifest check — relay swap.
//   [5] fetchArtistReleases — iTunes guarded with if(resp && resp.ok){ … },
//       prev/prevKeys/fresh hoisted so the MB/Spotify passes always run.
//   [6] scFetchMbUpcoming — passes an identifying User-Agent through
//       fetchWithProxy's native attempt.
//
// Run: node dev/patch-6139.mjs              # index.html + sw.js + tests + manifests
//      node dev/patch-6139.mjs --manifest   # re-seed root manifest.json only
//                                           # (run after dev/ota-bundle.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const VER = '61.3.9';
const PREV = '61.3.8';
const MANIFEST_ONLY = process.argv.includes('--manifest');

const devDir = path.join(ROOT, 'dev');
let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
let pinned = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

// Replace `oldStr` with `newStr`. Idempotent: if the finished text is already
// in the file the edit is skipped, and any other count than `want` throws so a
// half-applied file is never written.
function sub(label, oldStr, newStr, want = 1) {
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  if (newStr === '' && src.indexOf(oldStr) === -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Replace the whole span from startMarker (inclusive) to endMarker (exclusive).
// expectOld must occur exactly once INSIDE that span, so the range can only
// ever be the block it is meant to be. Idempotent via newText already present.
function subRange(label, startMarker, endMarker, expectOld, newText) {
  if (src.indexOf(newText) !== -1) return skip(label);
  const a = src.indexOf(startMarker);
  if (a === -1) throw new Error(label + ': start marker missing');
  if (src.indexOf(startMarker, a + 1) !== -1) throw new Error(label + ': start marker ambiguous');
  const b = src.indexOf(endMarker, a + startMarker.length);
  if (b === -1) throw new Error(label + ': end marker missing');
  const span = src.slice(a, b);
  const got = span.split(expectOld).length - 1;
  if (got !== 1) throw new Error(label + ': expected the span to contain expectOld once, found ' + got);
  src = src.slice(0, a) + newText + src.slice(b);
  done(label);
}

// The same, for a small file outside index.html (count-checked, idempotent).
function subFile(rel, label, oldStr, newStr, want = 1) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  if (t.indexOf(newStr) !== -1 && t.indexOf(oldStr) === -1) return skip(rel + ': ' + label);
  const got = t.split(oldStr).length - 1;
  if (got !== want) throw new Error(rel + ' ' + label + ': expected ' + want + ', found ' + got);
  t = t.split(oldStr).join(newStr);
  fs.writeFileSync(p, t);
  console.log('• ' + rel + ': ' + label);
  pinned++;
}

// Eastern is UTC−4 (EDT) through Nov 1; the sandbox has no tzdata, so the
// release stamp is derived arithmetically — see the 61.3.5 lesson: a stamp
// taken from the raw UTC clock ships as a future time wearing an EDT label.
function easternStamp() {
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const h = d.getUTCHours(), m = d.getUTCMinutes();
  const ap = h >= 12 ? 'PM' : 'AM';
  let h12 = h % 12; if (!h12) h12 = 12;
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h12}:${m < 10 ? '0' + m : m} ${ap} EDT`;
}

if (!MANIFEST_ONLY) {

// ---------------------------------------------------------------------------
// [1] the shared native-first fetch
// ---------------------------------------------------------------------------

subRange('__scNativeFetch + fetchWithProxy (native-first, live relays, init passthrough)',
  `  // CORS proxy helper — tries the direct fetch first, then a few public CORS
  // relays, so Discover keeps working even when one relay is down or blocked.`,
  `  // Fetch cover using Deezer API`,
  `(opts) => fetch('https://corsproxy.io/?' + encodeURIComponent(url), opts),`,
  `  // ─── Native-first fetch (CORS-free on the device) ─────────────────────────
  // A page fetch inside the WebView is still bound by CORS: Spotify's embed
  // pages send no access-control-allow-origin, and every public CORS relay
  // that used to catch that has either gone behind an API key (corsproxy.io
  // answers 401 now) or stopped answering for days — which is how the
  // Spotify converter's metadata legs and the album/playlist track lists died
  // while the same URLs fetched fine everywhere else. On the device the
  // Capacitor HTTP plugin runs the request on Android's own network stack,
  // where CORS does not apply and a real User-Agent can be set (MusicBrainz
  // 403s requests that do not identify themselves). Returns a Response-shaped
  // object, or null when there is no native plugin — the browser path below.
  async function __scNativeFetch(url, opts){
    try{
      var cap = window.Capacitor;
      var http = (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins) ? cap.Plugins.CapacitorHttp : null;
      if(!http || typeof http.request !== 'function') return null;
      opts = opts || {};
      var o = { url: url, method: opts.method || 'GET', responseType: 'arraybuffer', readTimeout: 8000, connectTimeout: 8000 };
      if(opts.headers) o.headers = opts.headers;
      if(opts.body != null) o.data = opts.body;
      var nr = await http.request(o);
      if(!nr || nr.status < 200 || nr.status >= 300 || nr.data == null || nr.data === '') return null;
      var parsed = null, b64 = null, rawBuf = null;
      if(typeof ArrayBuffer !== 'undefined' && nr.data instanceof ArrayBuffer) rawBuf = nr.data;
      else if(typeof nr.data === 'string') b64 = nr.data;
      else parsed = nr.data;   // a JSON Content-Type: the plugin hands back the parsed body
      var bytes = null, text = null;
      function asBytes(){
        if(bytes) return bytes;
        if(rawBuf){ bytes = new Uint8Array(rawBuf); return bytes; }
        if(parsed !== null){ bytes = new TextEncoder().encode(JSON.stringify(parsed)); return bytes; }
        // With responseType 'arraybuffer' a successful non-JSON body arrives as
        // raw base64; if it does not decode it was text after all.
        try{
          var bin = atob(b64);
          bytes = new Uint8Array(bin.length);
          for(var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        }catch(_be){ text = b64; bytes = new TextEncoder().encode(b64); }
        return bytes;
      }
      function asText(){
        if(parsed !== null) return JSON.stringify(parsed);
        if(text !== null) return text;
        try{ text = new TextDecoder('utf-8').decode(asBytes()); }catch(_te){ text = String(b64 || ''); }
        return text;
      }
      return {
        ok: true, status: nr.status,
        json: async function(){ if(parsed !== null) return parsed; return JSON.parse(asText()); },
        text: async function(){ return asText(); },
        blob: async function(){ return new Blob([asBytes()]); },
        arrayBuffer: async function(){ var b = asBytes(); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }
      };
    }catch(_e){ return null; }
  }

  // CORS helper — native first on the device, then the direct fetch, then a
  // few public CORS relays, so every lookup keeps working even when one relay
  // is down or blocked. \`init\` (method/headers/body) rides on the native and
  // direct attempts; the relays only ever replay plain GETs.
  async function fetchWithProxy(url, init){
    // Album History's cancel flag used to be final: once set, EVERY caller of
    // this shared helper got null for the rest of the session — the drop
    // check, cover fetches and the converter's fallbacks all silently found
    // nothing after one cancelled album fetch. It only means anything while
    // an album fetch is actually running (the cancel handlers clear
    // __ahFetching themselves).
    if(!window.__ahFetching) window.__ahCancelled = false;
    // If Album History fetch was cancelled, abort immediately
    if(window.__ahCancelled) return null;
    try{
      var nf = await __scNativeFetch(url, init);
      if(nf) return nf;
    }catch(_nfe){}
    const attempts = [
      (opts) => fetch(url, init ? Object.assign({}, init, { signal: opts.signal }) : opts),
      (opts) => fetch('https://api.allorigins.win/raw?url=' + encodeURIComponent(url), opts),
      (opts) => fetch('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(url), opts),
      (opts) => fetch('https://api.cors.lol/?url=' + encodeURIComponent(url), opts)
    ];
    for(const a of attempts){
      // Check cancel between each proxy attempt
      if(window.__ahCancelled) return null;
      try{
        const ctrl = new AbortController();
        const timer = setTimeout(function(){ ctrl.abort(); }, 8000);
        const resp = await a({ signal: ctrl.signal });
        clearTimeout(timer);
        if(resp.ok) return resp;
      }catch(e){}
    }
    return null;
  }
`);

// ---------------------------------------------------------------------------
// [2] the Spotify embed readers — native attempts first, live relays
// ---------------------------------------------------------------------------

subRange('scSpEmbedEntity: native first, live relays',
  `  // Fetch Spotify's own embed page and extract its __NEXT_DATA__ payload. The`,
  `  // Extract a single-track (or episode) entity from Spotify's embed page for this`,
  `allorigins' /get endpoint wraps the page in JSON`,
  `  // Fetch Spotify's own embed page and extract its __NEXT_DATA__ payload. The
  // embed carries the REAL track list (exact count, titles, artists, durations,
  // in order) for albums and playlists — searching Deezer/iTunes for the album
  // title used to pick look-alike editions and compilations, which is where the
  // "wrong amount of tracks / wrong songs / wrong artists" bug came from.
  async function scSpEmbedEntity(url){
    var embedPath = String(url).replace(/^.*open\\.spotify\\.com\\/(?:embed\\/)?/i, '');
    var tries = ['https://open.spotify.com/embed/' + embedPath];
    if(!/open\\.spotify\\.com\\/embed\\//i.test(url)) tries.push(String(url));
    var attempts = [];
    // Native first: a plain page fetch of this embed is blocked by CORS in the
    // WebView (Spotify sends no access-control-allow-origin), and the public
    // relays further down are only a browser fallback now — one wants an API
    // key, the others go quiet for days. The native attempt needs neither.
    for(var t = 0; t < tries.length; t++){
      attempts.push('native:' + tries[t]);
      attempts.push(tries[t]);
      attempts.push('https://api.allorigins.win/raw?url=' + encodeURIComponent(tries[t]));
      attempts.push('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(tries[t]));
      attempts.push('https://api.cors.lol/?url=' + encodeURIComponent(tries[t]));
      attempts.push('https://api.allorigins.win/get?url=' + encodeURIComponent(tries[t]));
    }
    for(var i = 0; i < attempts.length; i++){
      try{
        var html = null;
        var attempt = attempts[i];
        if(attempt.indexOf('native:') === 0){
          var nResp = await __scNativeFetch(attempt.slice(7));
          if(nResp) html = await nResp.text();
        } else {
          var ctrl = new AbortController();
          var timer = setTimeout(function(){ ctrl.abort(); }, 8000);
          var resp = await fetch(attempt, { signal: ctrl.signal });
          clearTimeout(timer);
          if(!resp || !resp.ok) continue;
          html = await resp.text();
        }
        if(!html) continue;
        // allorigins' /get endpoint wraps the page in JSON — unwrap it so the
        // embed parse below sees the real HTML.
        if(/^\\s*\\{/.test(html) && html.indexOf('"contents"') !== -1){
          try{ var _wrap = JSON.parse(html); if(_wrap && typeof _wrap.contents === 'string') html = _wrap.contents; }catch(_we){}
        }
        var m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\\/script>/);
        if(!m) continue;
        var j = JSON.parse(m[1]);
        var ent = null;
        (function find(o, depth){
          if(ent || !o || typeof o !== 'object' || depth > 8) return;
          if(Array.isArray(o.trackList)){ ent = o; return; }
          for(var k in o){ if(Object.prototype.hasOwnProperty.call(o, k)) find(o[k], depth + 1); }
        })(j, 0);
        // A 404 embed page also parses as JSON — only accept real entities.
        if(ent && ent.trackList && ent.trackList.length) return ent;
      }catch(e){}
    }
    return null;
  }

`);

subRange('scSpEmbedTrack: native first, live relays',
  `  // Extract a single-track (or episode) entity from Spotify's embed page for this`,
  `  // Resolve any Spotify link into a conversion plan:`,
  `if(!/\\/(track|episode)\\//i.test(String(url))) return null;`,
  `  // Extract a single-track (or episode) entity from Spotify's embed page for this
  // exact id: { name, artists: [{ name }], albumOfTrack: { name }, releaseDate,
  // visualIdentity.image[] } — the only Spotify source that still names the artist
  // now that oEmbed dropped author_name. Returns null for albums/playlists.
  async function scSpEmbedTrack(url){
    try{
      if(!/\\/(track|episode)\\//i.test(String(url))) return null;
      var html = null;
      var embedPath = String(url).replace(/^.*open\\.spotify\\.com\\/(?:embed\\/)?/i, '');
      var tries = ['https://open.spotify.com/embed/' + embedPath];
      if(!/open\\.spotify\\.com\\/embed\\//i.test(url)) tries.push(String(url));
      var attempts = [];
      // Native first — same reason as scSpEmbedEntity: CORS blocks the WebView's
      // own fetch of this page and the relays are a browser-only fallback.
      for(var t = 0; t < tries.length; t++){
        attempts.push('native:' + tries[t]);
        attempts.push(tries[t]);
        attempts.push('https://api.allorigins.win/raw?url=' + encodeURIComponent(tries[t]));
        attempts.push('https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(tries[t]));
        attempts.push('https://api.cors.lol/?url=' + encodeURIComponent(tries[t]));
      }
      for(var i = 0; i < attempts.length; i++){
        try{
          var attempt = attempts[i];
          if(attempt.indexOf('native:') === 0){
            var nResp = await __scNativeFetch(attempt.slice(7));
            html = nResp ? await nResp.text() : null;
            if(html && html.indexOf('__NEXT_DATA__') !== -1) break;
            html = null;
            continue;
          }
          var ctrl = new AbortController();
          var timer = setTimeout(function(){ ctrl.abort(); }, 8000);
          var resp = await fetch(attempt, { signal: ctrl.signal });
          clearTimeout(timer);
          if(resp && resp.ok){ html = await resp.text(); if(html && html.indexOf('__NEXT_DATA__') !== -1) break; html = null; }
        }catch(_fe){}
      }
      if(!html) return null;
      var m = html.match(/<script[^>]+id="__NEXT_DATA__"[^>]*>([\\s\\S]*?)<\\/script>/);
      if(!m) return null;
      var j = JSON.parse(m[1]);
      var d = ((j.props || {}).pageProps || {}).state || {};
      var ent = d.entity || d.data && d.data.entity || null;
      if(ent && ent.type === 'track' && ent.name) return ent;
      return null;
    }catch(e){ return null; }
  }

`);

// ---------------------------------------------------------------------------
// [3] the remaining relay call sites — corsproxy.io (401 now) → cors.lol
// ---------------------------------------------------------------------------

sub('scSpOembed relays',
  `    var attempts = [
      base,
      'https://corsproxy.io/?' + encodeURIComponent(base),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(base),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(base)
    ];`,
  `    var attempts = [
      base,
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(base),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(base),
      'https://api.cors.lol/?url=' + encodeURIComponent(base)
    ];`);

sub('expandSpotifyUrl relays',
  `      var proxies = ['','https://corsproxy.io/?','https://api.allorigins.win/raw?url=','https://api.codetabs.com/v1/proxy?quest='];`,
  `      var proxies = ['','https://api.allorigins.win/raw?url=','https://api.codetabs.com/v1/proxy?quest=','https://api.cors.lol/?url='];`);

sub('OTA manifest relays',
  `        var attempts = [
          rawManifest,
          'https://corsproxy.io/?' + encodeURIComponent(githubPagesManifest),
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(githubPagesManifest),
          'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(githubPagesManifest)
        ];`,
  `        var attempts = [
          rawManifest,
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(githubPagesManifest),
          'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(githubPagesManifest),
          'https://api.cors.lol/?url=' + encodeURIComponent(githubPagesManifest)
        ];`);

// ---------------------------------------------------------------------------
// [4] the drop check: iTunes is one source of three, not the gate
// ---------------------------------------------------------------------------

sub('fetchArtistReleases: prev/prevKeys/fresh hoisted, iTunes guarded',
  `      const url = \`https://itunes.apple.com/search?term=\${encodeURIComponent(artist)}&media=music&entity=song&limit=200\`;
      const resp = await fetchWithProxy(url);
      if(!resp || !resp.ok) return [];
      const data = await resp.json();
      const results = (data.results || []).filter(r => r && r.trackName &&
        primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim());
      const prev = pinnedReleases[artist] || [];
      const prevKeys = new Set();
      prev.forEach(pr => { const pk = (pr.title||'').toLowerCase().trim() + '|' + (pr.date||''); prevKeys.add(pk); prevKeys.add('alb:' + pk); });
      const fresh = [];
      results.forEach(r => {`,
  `      const prev = pinnedReleases[artist] || [];
      const prevKeys = new Set();
      prev.forEach(pr => { const pk = (pr.title||'').toLowerCase().trim() + '|' + (pr.date||''); prevKeys.add(pk); prevKeys.add('alb:' + pk); });
      const fresh = [];
      // The iTunes pass is one source of three: when it fails (a rate limit, a
      // blocked network, a dead relay) the MusicBrainz and silent-Spotify
      // passes below still run — one Apple hiccup used to end the whole drop
      // check here, and those two are the only sources carrying DATED future
      // drops in the first place.
      const url = \`https://itunes.apple.com/search?term=\${encodeURIComponent(artist)}&media=music&entity=song&limit=200\`;
      const resp = await fetchWithProxy(url);
      if(resp && resp.ok){
      const data = await resp.json();
      const results = (data.results || []).filter(r => r && r.trackName &&
        primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim());
      results.forEach(r => {`);

sub('fetchArtistReleases: close the iTunes guard before the dated-drops pass',
  `      }catch(_ae){}
      // ---- Dated drops with nothing to connect -----------------------------`,
  `      }catch(_ae){}
      }
      // ---- Dated drops with nothing to connect -----------------------------`);

// ---------------------------------------------------------------------------
// [5] MusicBrainz gets an identifying User-Agent (it 403s anonymous requests)
// ---------------------------------------------------------------------------

sub('scFetchMbUpcoming sends a User-Agent through the native attempt',
  `      var url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
      var rs = await fetchWithProxy(url);`,
  `      var url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
      // MusicBrainz 403s requests that do not identify the application, and a
      // page fetch cannot set a User-Agent — only the native attempt in
      // fetchWithProxy can, so hand it one. A browser keeps its own UA, which
      // MusicBrainz also accepts.
      var rs = await fetchWithProxy(url, { headers: { 'User-Agent': 'SideCut/' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') + ' (https://anekthegreat.github.io/SideCut/)' } });`);

// ---------------------------------------------------------------------------
// [6] version + changelog head
// ---------------------------------------------------------------------------

sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '${PREV}';`,
  `  const APP_VERSION = '${VER}';`);

const ITEMS = [
  "The Spotify converter stopped reading Spotify's own pages: it fell back to public CORS relay services, corsproxy.io started demanding an API key, and the others went quiet — so track details, artists, covers and album/playlist track lists stopped resolving. On the phone those pages are now read straight through the device’s own network path, which needs no relay at all; a browser keeps live relays as its fallback and the dead one has been replaced.",
  "One cancelled album fetch could silence everything that looks things up: the Album History cancel flag stayed latched and every shared lookup answered with nothing for the rest of the session — upcoming drops, cover art and the converter’s fallbacks included. The flag now only counts while an album fetch is actually running.",
  "MusicBrainz refuses requests that do not say who is asking, and the drop check was sending nothing to identify itself — it now carries an identifying User-Agent through the native network path.",
  "An Apple outage no longer ends the drop check: the iTunes pass still finds new singles and albums first, but when it fails, MusicBrainz and the silent Spotify pass run anyway instead of the whole check returning empty.",
];
const NEW_ENTRY =
  `  { version: '${VER}', date: '${easternStamp()}', title: 'The converters and the drop check stop depending on dead relays', items: [\n` +
  ITEMS.map((it) => `    '${it.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',\n`).join('') +
  `  ] },\n`;

const headAnchor = `  const CHANGELOG = [\n  { version: '${PREV}', date: `;
if (src.indexOf(`const CHANGELOG = [\n  { version: '${VER}'`) !== -1) {
  skip('changelog head entry is ' + VER);
} else {
  if (src.indexOf(headAnchor) === -1) throw new Error('CHANGELOG head anchor missing');
  src = src.replace(headAnchor, `  const CHANGELOG = [\n` + NEW_ENTRY + `  { version: '${PREV}', date: `);
  done('changelog head entry added (' + VER + ')');
}

fs.writeFileSync(FILE, src);
console.log('• index.html written — ' + edits + ' edit(s)');

// ------------------------------------------------------------------ sw.js
subFile('sw.js', 'CACHE_NAME -> v' + VER,
  `const CACHE_NAME = 'sidecut-shell-v${PREV}';`,
  `const CACHE_NAME = 'sidecut-shell-v${VER}';`);

// ------------------------------------------------- older tests' own head pins
// The escaped-regex needles and the backtick ordering pin are not covered by
// the generic repin below (it matches double-quoted literal version pins), so
// they move here — each with count==1 so a re-run can never double-apply.
subFile('dev/test-6137.mjs', 'the newest-entry regex moves to ' + VER,
  `/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.8'/`,
  `/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.9'/`);
subFile('dev/test-6138.mjs', 'its own newest-entry regex moves to ' + VER,
  `/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.8'/`,
  `/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.9'/`);
subFile('dev/test-6138.mjs', 'its backtick head-ordering pin moves to ' + VER,
  'ok(src.indexOf(`version: \'61.3.8\'`) < src.indexOf(`version: \'${PREV}\'`), \'61.3.8 heads the changelog\');',
  'ok(src.indexOf(`version: \'61.3.9\'`) < src.indexOf(`version: \'${PREV}\'`), \'61.3.9 heads the changelog\');');

// --------------------------------------------------------------- test pins
for (const f of fs.readdirSync(devDir)) {
  if (!/^test-.*\.mjs$/.test(f)) continue;
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ver === '${PREV}'`).join(`ver === '${VER}'`)
    .split(`sidecut-shell-v${PREV}`).join(`sidecut-shell-v${VER}`)
    .split(`"version: '${PREV}'"`).join(`"version: '${VER}'"`)
    .split(`CHANGELOG head entry is ${PREV}`).join(`CHANGELOG head entry is ${VER}`)
    .split(`exactly one ${PREV} changelog entry`).join(`exactly one ${VER} changelog entry`)
    .split(`'${PREV} heads the changelog'`).join(`'${VER} heads the changelog'`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); pinned++; console.log('• repinned dev/' + f); }
}
// A re-run repins nothing (they are already at VER) — what must never happen is
// a test file left behind on the old pin.
const stale = fs.readdirSync(devDir)
  .filter((f) => /^test-.*\.mjs$/.test(f))
  .filter((f) => fs.readFileSync(path.join(devDir, f), 'utf8').includes(`ver === '${PREV}'`));
if (stale.length) throw new Error('test files still pinned to ' + PREV + ': ' + stale.join(', '));

} else {
  console.log('= manifest-only run — index.html untouched');
}

// ------------------------------------------------- changelog head (read back)
function changelogHead() {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) throw new Error('could not read the CHANGELOG block');
  const entries = eval('[' + block[1] + ']');
  const e = entries.find((x) => String(x.version) === VER);
  if (!e) throw new Error('no ' + VER + ' changelog entry found');
  return e;
}
const head = changelogHead();

{
  // test-6052 pins the head date by exact equality; keep it in step.
  const p = path.join(devDir, 'test-6052.mjs');
  const t = fs.readFileSync(p, 'utf8');
  const re = /ok\(entries\[0\]\.date === '[^']*', 'ship date correct \(' \+ entries\[0\]\.date \+ '\)'\);/;
  const m = t.match(re);
  if (!m) throw new Error('test-6052.mjs: date pin not found');
  if (m[0].indexOf(head.date) === -1) {
    fs.writeFileSync(p, t.replace(re, `ok(entries[0].date === '${head.date}', 'ship date correct (' + entries[0].date + ')');`));
    console.log('• dev/test-6052.mjs ship date → ' + head.date);
  } else {
    skip('dev/test-6052.mjs ship date is ' + head.date);
  }
}

{
  // test-6138's [7] block asserts on the head entry itself — it has to follow
  // the head, including the date it pins.
  const p = path.join(devDir, 'test-6138.mjs');
  let t = fs.readFileSync(p, 'utf8');
  const pairs = [
    [`const head = entries.find((e) => String(e.version) === '61.3.8');`, `const head = entries.find((e) => String(e.version) === '${VER}');`],
    [`ok(!!head, 'the head entry is 61.3.8');`, `ok(!!head, 'the head entry is ${VER}');`],
    [`ok(head.date === 'September 24, 2026 · 7:00 PM EDT', 'ship date (' + head.date + ')');`, `ok(head.date === '${head.date}', 'ship date (' + head.date + ')');`],
  ];
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= dev/test-6138.mjs: head pin already ' + VER); continue; }
    const got = t.split(a).length - 1;
    if (got !== 1) throw new Error('test-6138 head pin: expected 1 match for ' + a.slice(0, 60) + ', found ' + got);
    t = t.split(a).join(b);
    pinned++;
  }
  fs.writeFileSync(p, t);
  console.log('• dev/test-6138.mjs head entry → ' + VER + ' (' + head.date + ')');
}

// ------------------------------------------------------ root manifest.json
// The very first manifest location, kept current so no client left pointing at
// it is ever told about an older version. Size is read from the published
// bundle, so re-run with --manifest after `node dev/ota-bundle.mjs`.
{
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  const notes = (head.items || [])
    .map((it) => (typeof it === 'string' && it.indexOf('[FULL] ') === 0) ? it.slice(7) : it)
    .slice(0, 6);
  const man = { version: VER, url: 'update.zip', size: upd.size, notes, date: String(head.date || '') };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log('• root manifest.json → ' + VER + ' · ' + upd.size + ' bytes · ' + notes.length + ' notes');
}

console.log('patch-6139: ' + edits + ' index.html edit(s), ' + pinned + ' file(s) repinned');
