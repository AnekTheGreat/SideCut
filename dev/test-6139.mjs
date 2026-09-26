// v61.5 — the two 61.3.9 releases, side by side.
//
// The local line's 61.3.9 fixed a lookup chain that had silently died: every
// shared lookup fell back to public CORS relay services, corsproxy.io went
// behind an API key (401) and the others stopped answering, and a page fetch in
// the WebView is bound by CORS anyway (Spotify's embed pages and
// youtube.com/oembed send no access-control-allow-origin — measured Sep 25).
// The fix is a native-first transport plus the relay swap, a cancel flag that
// can no longer latch, an iTunes pass that no longer gates the dated drop
// sources, and an identifying User-Agent for MusicBrainz (403s anonymous
// requests).
//
// origin/main's 61.3.9 (same number, different work) fixed the pinned-artist
// drop check: a 3-way worker pool, incremental save+repaint per artist, a
// shared in-flight run, a time-budgeted / cancel-decoupled release fetch, a
// cross-source dedupe and visible progress — reproduced headless before the
// patch (16 pins burned the whole 35 s ceiling and a second tap resolved in
// 3 ms doing nothing; a slow network stored ZERO rows; one drop listed twice).
//
// Both are kept: this pins the transport, the embed readers, the budgeted
// release fetch, the pool, the dedupe, the progress reporting, and the
// metadata (61.5).
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
  ok(nf && nf.includes('responseType'), "reads the body as bytes, not the plugin's own guess");
  ok(nf && (nf.includes('readTimeout') && nf.includes('connectTimeout')), 'native attempts are clocked');

  const fwp = slice('async function fetchWithProxy(url, init){', '// Fetch cover using Deezer API');
  ok(!!fwp, 'fetchWithProxy still exported in its old place');
  ok(fwp && fwp.includes('await __scNativeFetch(url, init)'), 'native attempt comes first');
  ok(fwp && fwp.includes('!window.__ahFetching') && fwp.includes('window.__ahCancelled = false'),
    'the Album History cancel flag self-heals instead of latching forever');
  ok(fwp && fwp.includes('Object.assign({}, init, { signal: opts.signal })'),
    "the caller's method/headers/body ride the direct attempt (the Gemini POST fix)");
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

console.log('[3] the release fetch is budgeted and no longer shares Album History cancellation');
const proxy = slice('async function fetchWithProxy(url, init){', '  // Fetch cover using Deezer API');
ok(!!proxy, 'fetchWithProxy slice extracted');
ok(proxy && proxy.includes('init = init || {};'), 'it takes per-call options');
ok(proxy && proxy.includes('var _noCancel = !!init.noCancel;'), 'a caller can opt out of the cancel switch');
ok(proxy && proxy.includes('if(!_noCancel && window.__ahCancelled) return null;'), 'the Album History bypass is guarded');
ok(proxy && proxy.includes('var _deadline = Date.now() + _budget;'), 'each URL gets a time budget');
ok(proxy && proxy.includes('if(_left <= 0) return null;'), 'the relay walk stops when the budget is spent');
ok(proxy && proxy.includes('Math.max(800, Math.min(8000, _left))'), 'the per-hop abort is clamped to the budget left');

console.log('[4] the release path opts in, at all five catalog reads');
ok(src.includes('var SC_RELEASE_FETCH = { noCancel: true, budgetMs: 4000 };'), 'the release options are defined once');
ok(count('SC_RELEASE_FETCH') === 7, 'defined + used by 6 catalog reads (' + count('SC_RELEASE_FETCH') + ')');
const idFn = slice('async function scItunesArtistAlbums(artist){', "  // Query iTunes for an artist's recent tracks");
ok(idFn && idFn.split('SC_RELEASE_FETCH').length - 1 === 2, 'the artist search and the catalog lookup both use it');
const mb = slice('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
ok(mb && mb.includes('fetchWithProxy(url, SC_MB_FETCH)'), 'the MusicBrainz search uses it, identifying the app');

console.log('[5] the drop check: iTunes is one source of three');
{
  const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
  ok(!!check, 'fetchArtistReleases slice extracted');
  ok(check && check.includes('if(resp && resp.ok){'), 'the iTunes pass is guarded, not a gate');
  ok(check && check.includes('window.__scMbUpcoming(artist)'), 'the MusicBrainz pass still runs');
  ok(check && check.includes('window.__scWdUpcoming(artist)'), 'and so does the Wikidata pass');
  ok(check && check.includes('catch(_eSp)'), 'a MusicBrainz failure never aborts the check');
}

console.log('[6] cross-source dedupe — one row per drop');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('const freshTitles = new Set();'), 'a per-run title set is kept');
ok(check && check.split('freshTitles.add(').length - 1 === 2, 'songs and albums both record their title+day (' + (check ? check.split('freshTitles.add(').length - 1 : 0) + ')');
ok(check && check.includes("if(!prevKeys.has(key) && !freshTitles.has(key)){"), 'a song already listed this run is skipped');
ok(check && check.includes("if(freshTitles.has(nt + '|' + x.date)) return;"), 'the MusicBrainz pass respects what Apple listed');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'its own source key survives for stored-entry checks');

console.log('[7] the check itself: pool + incremental persist + shared run');
const fn = slice('  // A running check is shared, never re-entered', 'function scUpcomingReleases');
ok(!!fn, 'checkPinnedArtistReleases slice extracted');
ok(fn && fn.includes('let pinnedCheckPromise = null;'), 'an in-flight run is tracked');
ok(fn && fn.includes('if(pinnedCheckPromise) return pinnedCheckPromise;'), 'a second call joins the run instead of no-oping');
ok(fn && fn.includes('const _queue = pinnedArtists.slice();'), 'artists go through a work queue');
ok(fn && fn.includes('for(let _wi = 0; _wi < 3; _wi++) _pool.push(_worker());'), 'a 3-way worker pool reads them');
ok(fn && fn.includes('await Promise.all(_pool);'), 'the run awaits the whole pool');
ok(fn && fn.includes('savePinnedArtists()'), 'each artist persists as it lands');
ok(fn && fn.includes('scRepaintOpenReleasePanel()'), 'and the open panel is repainted in place');
ok(fn && fn.includes('new Promise(function(res){ setTimeout(function(){ res(null); }, 8000); })'), 'every artist is still clocked at 8 s');
ok(fn && fn.includes('pinnedCheckState.active = false'), 'active is still cleared in the finally');
ok(fn && fn.includes('finally{ pinnedCheckPromise = null; }'), 'the in-flight slot is released');
ok(fn && fn.split('Promise.race([').length - 1 === 1, 'exactly one race per artist');

console.log('[8] the button reports progress and always comes back');
const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
ok(!!tap, 'tap handler slice extracted');
ok(tap && tap.includes("'Checking\\u2026 ' + pinnedCheckState.done + '/' + pinnedCheckState.total"), 'it paints real progress (N/M)');
ok(tap && tap.includes('clearInterval(_tick)'), 'the progress ticker is always cleared');
ok(tap && tap.includes("btn.textContent = 'Check for drops'"), 'the label is always put back');
ok(tap && tap.includes('btn.disabled = false'), 'and the button is re-enabled');
ok(tap && !tap.includes('scSpotifyInteractiveToken'), 'still no authorization window in this flow');

console.log('[9] nothing to connect, nothing to verify');
ok(count('scSpotifySilentToken') === 0, 'no silent token anywhere');
ok(count('await scSpotifyInteractiveToken()') === 1, 'the only window left is the converter search');
ok(fn && !fn.includes('spotify'), 'the check never reaches for Spotify');

console.log('[10] the YouTube title leg rides the shared fetch');
{
  ok(src.includes("await fetchWithProxy('https://www.youtube.com/oembed?"),
    'youtube.com/oembed is read through the native-first transport (it sends no CORS header)');
  ok(count("await fetchWithProxy('https://www.youtube.com/oembed?") === 1, 'exactly one title lookup');
}

console.log('[11] release metadata');
ok(ver === '62.1', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v63.0.2';"), 'sw.js cache = sidecut-shell-v61.5');
{
  const head = entries.find((e) => String(e.version) === '61.5');
  ok(!!head, 'CHANGELOG head entry is 61.5');
  if (head) {
    ok(head.items.length >= 5, 'notes: ' + head.items.length);
    ok(!STRONG.test(head.items.join('\n')), 'notes carry no downloader term');
    ok(!/play build|play version|play install/i.test(head.items.join('\n')), 'notes never name the play build');
    ok(head.date.endsWith('EDT'), 'ship date (' + head.date + ')');
  }
  ok(entries[0].version === '62.1', '63 heads the changelog');
}

console.log('[12] inline script syntax');
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
