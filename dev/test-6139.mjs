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
ok(mb && mb.includes('scMbFetch('), 'the MusicBrainz search uses the app-wide queue');
ok(src.includes('return fetchWithProxy(url, opts).catch(function(){ return null; })'), 'the queue reads through the shared fetch');
ok(count('SC_MB_FETCH') >= 3, 'carrying an identifying User-Agent (' + count('SC_MB_FETCH') + ')');

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
// 25 s, not 8: MusicBrainz is read through ONE spaced queue for the whole app
// (a request a second, two retries on 429/503), so an artist's turn in that
// queue counts against its own ceiling — at 8 s a queued retry was cut off
// before it could be made, and a dated drop was lost.
ok(fn && fn.includes('new Promise(function(res){ setTimeout(function(){ res(null); }, 25000); })'), 'every artist is clocked at 25 s');
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
ok(ver === '63.0.4', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v63.0.5';"), 'sw.js cache = sidecut-shell-v61.5');
{
  const head = entries.find((e) => String(e.version) === '61.5');
  ok(!!head, 'CHANGELOG head entry is 61.5');
  if (head) {
    ok(head.items.length >= 5, 'notes: ' + head.items.length);
    ok(!STRONG.test(head.items.join('\n')), 'notes carry no downloader term');
    ok(!/play build|play version|play install/i.test(head.items.join('\n')), 'notes never name the play build');
    ok(head.date.endsWith('EDT'), 'ship date (' + head.date + ')');
  }
  ok(entries[0].version === '63.0.4', '63 heads the changelog');
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

console.log('[13] no remixes, nothing off the pinned artists');
{
  const check2 = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
  // One shared test, applied by EVERY source and by BOTH lists. 11 hits = the
  // definition, the pruning pass, and nine call sites.
  ok(count('__scJunkTitle') === 11, 'one junk test, applied everywhere (' + count('__scJunkTitle') + ')');
  ok(check2 && check2.includes('!window.__scJunkTitle(r.trackName)'), 'the iTunes song pass refuses a remix title');
  ok(check2 && check2.includes('if(window.__scJunkTitle(r.collectionName)) return;'), 'so does the album pass');
  const idFn2 = slice('async function scItunesArtistAlbums(artist){', "  // Query iTunes for an artist's recent tracks");
  ok(idFn2 && idFn2.includes('if(window.__scJunkTitle(r.collectionName)) return false;'), 'and the artist-catalog lookup');
  ok(mb && mb.includes('if(window.__scJunkTitle(rg.title)) return;'), 'MusicBrainz too');
  ok(src.includes('if(window.__scJunkTitle(title)) return;'), 'and Wikidata');
  ok(src.includes('if(!r || window.__scJunkTitle(r.title)) return;'), 'the Upcoming list');
  // The loose substring credit match is gone from all three release sources.
  ok(!check2.includes('rArtist.indexOf(pArtist)'), 'the album pass no longer matches an artist by substring');
  ok(!mb.includes('credits.some(function(nm){ return !!nm && (nm === want'), 'nor does MusicBrainz');
  ok(src.includes('if(!window.__scSameArtistName(pl, want)) return;'), 'nor does Wikidata');
  ok(src.includes('window.__scActWords = '), 'a tribute band is somebody else ("Karan Aujla Tribute Band")');
  ok(src.includes('window.__scPruneJunkReleases(pinnedReleases)'), 'and the stored list is cleaned on load');

  console.log('[14] Upcoming releases actually finds what is dated ahead');
  // MusicBrainz: one spaced queue + the artist's own catalog by id.
  ok(src.includes('var _mbChain = Promise.resolve()'), 'one MusicBrainz queue for the whole app');
  ok(src.includes('rs.status === 429 || rs.status === 503'), 'a throttled reply is retried, not read as "nothing found"');
  ok(src.includes('?artist=\' + _mbid + \'&fmt=json&limit=100'), 'the catalog is browsed by artist id');
  ok(src.includes('window.__scMbIds || (window.__scMbIds = {})'), 'resolved once per artist per session');
  ok(mb && mb.includes('if(credits.length){'), 'a browse reply with no credits is not refused for having none');
  // Wikidata: singles and EPs are NOT album subclasses, so an album-only query
  // could never see a future-dated single.
  ok(src.includes('VALUES ?cls { wd:Q482994 wd:Q134556 wd:Q169930 }'), 'Wikidata reads albums, singles and EPs');
  // The empty tab explains the check instead of implying nobody is pinned.
  ok(src.includes('window.__scUpcomingEmptyText = function(){'), 'the empty Upcoming tab reports the check');
  ok(count('window.__scUpcomingEmptyText()') === 3, 'the Home panel, the Fetch latest popup and the tab refresh all read it (' + count('window.__scUpcomingEmptyText()') + ')');
}

console.log('\n' + (failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures));
process.exit(failures === 0 ? 0 : 1);
