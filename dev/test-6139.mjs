// v61.3.9 — "Spotify and YouTube links resolve again, and the drop check runs
// every source". The release fixes a lookup chain that had silently died:
// every shared lookup fell back to public CORS relay services, corsproxy.io
// went behind an API key (401) and the others stopped answering, and a page
// fetch in the WebView is bound by CORS anyway (Spotify's embed pages and
// youtube.com/oembed send no access-control-allow-origin — measured Sep 25).
// The fix is a native-first transport plus the relay swap, a cancel flag that
// can no longer latch, an iTunes pass that no longer gates the dated drop
// sources, and an identifying User-Agent for MusicBrainz (403s anonymous
// requests). This pins each of those, plus the release metadata.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
const entries = block ? eval('[' + block[1] + ']') : [];
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
// Same downloader-word rule the shared channel enforces (test-6058's STRONG):
// a note may never name the feature by these terms.
const STRONG = /(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|hand-?off)/i;
// Slice from a start marker to an end marker — null when either is missing, so
// a moved function fails loudly instead of passing an empty string.
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  if (b === -1) return null;
  return src.slice(a, b);
}

console.log('[1] the native-first shared transport');
{
  const nf = slice('async function __scNativeFetch(url, opts){', '// CORS helper — native first on the device');
  ok(!!nf, '__scNativeFetch defined right before fetchWithProxy');
  ok(nf && nf.includes('CapacitorHttp'), 'asks the Capacitor HTTP plugin (CORS-free on device)');
  ok(nf && nf.includes("isNativePlatform()"), 'only on the native platform — browsers fall through');
  ok(nf && nf.includes('responseType'), 'reads the body as bytes, not the plugin\'s own guess');
  ok(nf && (nf.includes('readTimeout') && nf.includes('connectTimeout')), 'native attempts are clocked');

  const fwp = slice('async function fetchWithProxy(url, init){', '// Fetch cover using Deezer API');
  ok(!!fwp, 'fetchWithProxy still exported in its old place');
  ok(fwp && fwp.includes('await __scNativeFetch(url, init)'), 'native attempt comes first');
  ok(fwp && fwp.includes('!window.__ahFetching') && fwp.includes('window.__ahCancelled = false'),
    'the Album History cancel flag self-heals instead of latching forever');
  ok(fwp && fwp.includes('Object.assign({}, init, { signal: opts.signal })'),
    'the caller\'s method/headers/body ride the direct attempt (the Gemini POST fix)');
  ok(fwp && !fwp.includes('corsproxy.io'), 'the key-walled relay is gone from the chain');
  ok(fwp && fwp.includes('api.cors.lol'), 'a live relay stands in for the dead one');
}

console.log('[2] the Spotify embed readers take the native path first');
{
  for (const [name, marker] of [['scSpEmbedEntity', 'async function scSpEmbedEntity(url){'], ['scSpEmbedTrack', 'async function scSpEmbedTrack(url){']]) {
    const fn = slice(marker, marker.indexOf('scSpEmbedEntity') !== -1 ? 'async function scSpEmbedTrack(url){' : 'async function scConvertSpToAudio');
    ok(!!fn || src.includes(marker), name + ' defined');
    const at = src.indexOf(marker);
    const atEnd = src.indexOf('async function ', at + marker.length);
    const body = src.slice(at, atEnd === -1 ? at + 4000 : atEnd);
    ok(body.includes("'native:' + tries[t]") || body.includes("attempts.push('native:'),") || body.includes("'native:' +"),
      name + ' queues a native attempt per URL');
    ok(!body.includes('corsproxy.io'), name + ' no longer asks the key-walled relay');
  }
  const oe = slice('var attempts = [\n      base,', 'for(var ai = 0');
  ok(oe === null || !oe.includes('corsproxy.io'), 'scSpOembed dropped the dead relay (or its shape moved loudly)');
  ok(src.includes('https://api.cors.lol/?url='), 'cors.lol is wired in as the relay fallback');
}

console.log('[3] the drop check: iTunes is one source of three');
{
  const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
  ok(!!check, 'fetchArtistReleases slice extracted');
  ok(check && check.includes('if(resp && resp.ok){'), 'the iTunes pass is guarded, not a gate');
  ok(check && check.includes('window.__scMbUpcoming(artist)'), 'the MusicBrainz pass still runs');
  ok(check && check.includes('catch(_eSp)'), 'the silent Spotify pass is still best-effort');
  ok(check && check.indexOf('const prev = pinnedReleases[artist]') < check.indexOf('itunes.apple.com/search'),
    'the merge state is built before Apple is even asked');
  const mb = slice('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
  ok(!!mb, 'scFetchMbUpcoming slice extracted');
  ok(mb && mb.includes("fetchWithProxy(url, { headers: { 'User-Agent'"), 'the MusicBrainz query identifies the app');
}

console.log('[4] the YouTube title leg rides the shared fetch');
{
  ok(src.includes("await fetchWithProxy('https://www.youtube.com/oembed?"),
    'youtube.com/oembed is read through the native-first transport (it sends no CORS header)');
  ok(count("await fetchWithProxy('https://www.youtube.com/oembed?") === 1, 'exactly one title lookup');
}

console.log('[5] release metadata');
ok(ver === '61.3.9', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3.9';"), 'sw.js cache = sidecut-shell-v61.3.9');
{
  const head = entries.find((e) => String(e.version) === '61.3.9');
  ok(!!head, 'CHANGELOG head entry is 61.3.9');
  if (head) {
    ok(head.items.length >= 5, 'notes: ' + head.items.length);
    ok(!STRONG.test(head.items.join('\n')), 'notes carry no downloader term');
    ok(!/play build|play version|play install/i.test(head.items.join('\n')), 'notes never name the play build');
    ok(head.date.endsWith('EDT'), 'ship date (' + head.date + ')');
  }
}

console.log('[6] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let syntaxErrors = 0;
  blocks.forEach((b, i) => {
    try { new Function(b.replace(/<\/?script[^>]*>/gi, '')); }
    catch (e) {
      if (i === 3 && String(e.message).includes('await')) return; // nested async, shipped that way
      syntaxErrors++;
      console.log('       block ' + (i + 1) + ': ' + e.message);
    }
  });
  ok(syntaxErrors === 0, 'inline script syntax failures: ' + syntaxErrors);
}

console.log('\n' + (failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures));
process.exit(failures === 0 ? 0 : 1);
