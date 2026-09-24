// v61.3.9 — the pinned-artist drop check finished unreliably and could look
// like it never finished at all.
//
// Reproduced in headless Chromium before this patch, on v61.3.8:
//   • 16 pinned artists on a congested network burned the full 35 s tap
//     ceiling; the ceiling reset the BUTTON but not the run, so `active`
//     stayed true and a second tap resolved in ~3 ms doing nothing;
//   • on a network where every catalog hop was slow, the albums pass was
//     clocked out per artist and the check stored ZERO rows — every real
//     upcoming drop was silently dropped;
//   • the same drop appeared TWICE (the Apple catalog and MusicBrainz both
//     listed it — the MB key `mbt:title|date` is absent from prevKeys);
//   • cancelling Album History (`window.__ahCancelled`) blanked the release
//     check, because both share `fetchWithProxy`.
//
// What this pins: the 3-way worker pool, incremental save+repaint per artist,
// the shared in-flight run, the time-budgeted / cancel-decoupled release fetch,
// the cross-source dedupe, the visible progress, and none of it reaching for an
// account.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  if (b === -1) return null;
  return src.slice(a, b);
}

console.log('[1] the release fetch is budgeted and no longer shares Album History cancellation');
const proxy = slice('async function fetchWithProxy(url, fopts){', '  // Fetch cover using Deezer API');
ok(!!proxy, 'fetchWithProxy slice extracted');
ok(proxy && proxy.includes('fopts = fopts || {}'), 'it takes per-call options');
ok(proxy && proxy.includes('var _noCancel = !!fopts.noCancel;'), 'a caller can opt out of the cancel switch');
ok(proxy && proxy.includes('if(!_noCancel && window.__ahCancelled) return null;'), 'the Album History bypass is guarded');
ok(proxy && proxy.includes('var _deadline = Date.now() + _budget;'), 'each URL gets a time budget');
ok(proxy && proxy.includes('if(_left <= 0) return null;'), 'the relay walk stops when the budget is spent');
ok(proxy && proxy.includes('Math.max(800, Math.min(8000, _left))'), 'the per-hop abort is clamped to the budget left');

console.log('[2] the release path opts in, at all five catalog reads');
ok(src.includes('var SC_RELEASE_FETCH = { noCancel: true, budgetMs: 4000 };'), 'the release options are defined once');
ok(count('SC_RELEASE_FETCH') === 7, 'defined + used by 6 catalog reads (' + count('SC_RELEASE_FETCH') + ')');
const idFn = slice('async function scItunesArtistAlbums(artist){', "  // Query iTunes for an artist's recent tracks");
ok(idFn && idFn.split('SC_RELEASE_FETCH').length - 1 === 2, 'the artist search and the catalog lookup both use it');
const mb = slice('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
ok(mb && mb.includes('await fetchWithProxy(url, SC_RELEASE_FETCH)'), 'the MusicBrainz search uses it');

console.log('[3] cross-source dedupe — one row per drop');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('const freshTitles = new Set();'), 'a per-run title set is kept');
ok(check && check.split('freshTitles.add(').length - 1 === 2, 'songs and albums both record their title+day (' + (check.split('freshTitles.add(').length - 1) + ')');
ok(check && check.includes('if(!prevKeys.has(key) && !freshTitles.has(key)){'), 'a song already listed this run is skipped');
ok(check && check.includes('if(freshTitles.has(nt + \'|\' + x.date)) return;'), 'the MusicBrainz pass respects what Apple listed');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'its own source key survives for stored-entry checks');

console.log('[4] the check itself: pool + incremental persist + shared run');
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

console.log('[5] the button reports progress and always comes back');
const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
ok(!!tap, 'tap handler slice extracted');
ok(tap && tap.includes("'Checking\\u2026 ' + pinnedCheckState.done + '/' + pinnedCheckState.total"), 'it paints real progress (N/M)');
ok(tap && tap.includes('clearInterval(_tick)'), 'the progress ticker is always cleared');
ok(tap && tap.includes("btn.textContent = 'Check for drops'"), 'the label is always put back');
ok(tap && tap.includes('btn.disabled = false'), 'and the button is re-enabled');
ok(tap && !tap.includes('scSpotifyInteractiveToken'), 'still no authorization window in this flow');

console.log('[6] nothing to connect, nothing to verify');
ok(count('scSpotifySilentToken') === 0, 'no silent token anywhere');
ok(count('await scSpotifyInteractiveToken()') === 1, 'the only window left is the converter search');
ok(fn && !fn.includes('spotify'), 'the check never reaches for Spotify');

console.log('[7] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.4', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.4';"), 'sw.js cache = sidecut-shell-v61.4');
ok(count("version: '61.4'") === 1, 'exactly one 61.3.9 changelog entry');
ok(/const CHANGELOG = \[\n  \{ version: '61\.4'/.test(src), 'the newest entry sits inside CHANGELOG');
ok(src.indexOf("version: '61.4'") < src.indexOf("version: '61.3.8'"), 'it heads the changelog');

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\nall passed');
