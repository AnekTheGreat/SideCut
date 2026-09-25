// v61.3.8 — repinned from v61.2. Its old subject, a silent Spotify pass that
// read a drop date through an account token, is gone: no drop date is read
// through a connection any more. What replaced it is the pinned artist's OWN
// open Apple catalog, read by artist ID. The interactive PKCE flow still
// exists for the one place it has always belonged (the converter's Spotify
// search), which is what section [2] pins.
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

console.log('[1] no silent token — nothing in the check reads a connection');
ok(count('scSpotifySilentToken') === 0, 'the silent token is gone');
ok(count('scFetchSpotifyUpcoming') === 0, 'the Spotify upcoming pass is gone');
ok(count('_spt:') === 0, 'no Spotify-sourced entry key survives');
ok(count('spFresh') === 0, 'the check merges no Spotify result set');

console.log('[2] the interactive flow survives, only where it belongs');
const inter = slice('async function scSpotifyInteractiveToken(){', 'window.__scSpotifyConnect = scSpotifyInteractiveToken;');
ok(!!inter, 'scSpotifyInteractiveToken defined');
ok(inter && inter.includes("window.open(auth, 'sidecut-spotify-auth'"), 'the PKCE popup lives here');
ok(count('await scSpotifyInteractiveToken()') === 1, 'exactly one call site (the converter search)');
ok(src.includes('async function scSpotifySearch(q, type){'), 'scSpotifySearch still exists');

console.log('[3] upcoming pass: the open artist catalog, read by ID');
const idFn = slice('async function scItunesArtistAlbums(artist){', '  // Query iTunes for an artist');
ok(!!idFn, 'scItunesArtistAlbums defined');
ok(idFn && idFn.includes('entity=musicArtist&limit=5'), 'one artist search resolves the ID');
ok(idFn && idFn.includes('entity=album&limit=200'), 'the catalog is read by artist id');
ok(idFn && !/spotify|token/i.test(idFn), 'no Spotify, no token in the pass');
ok(idFn && idFn.includes('credited('), 'the pinned artist must be credited');
ok(idFn && idFn.includes('await fetchWithProxy('), 'goes through the shared proxy fetch');

console.log('[4] merge inside fetchArtistReleases');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('scItunesArtistAlbums(artist)'), 'the artist-catalog pass runs in the album loop');
ok(check && !check.includes('__scSpotifyUpcoming'), 'no Spotify pass in the release check');
ok(check && check.includes('window.__scMbUpcoming(artist)'), 'the open MusicBrainz pass still runs');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'dedupe key names its open source');
ok(check && check.includes('pe.date = x.date'), 'an undated entry gets the date in place instead of duplicating');
ok(check && check.includes('_idE'), 'best-effort: a catalog failure cannot break the check');

console.log('[5] the empty state asks you to connect nothing');
ok(count('window.__scWireUpcomingCta = function') === 1, 'wiring helper defined once');
const ctaSlice = slice('window.__scWireUpcomingCta = function', 'window.__scRebuildReleaseLists = async function');
ok(!!ctaSlice && ctaSlice.includes("cbtn.textContent = 'Check for drops'"), 'the button runs the check');
ok(!!ctaSlice && !ctaSlice.includes('Connect Spotify'), 'the Connect Spotify button is gone');
ok(!!ctaSlice && ctaSlice.includes('Add a drop manually'), 'the manual sheet is still offered');

console.log('[6] manual drop sheet');
ok(count('window.__scAddUpcomingDrop = function') === 1, 'sheet builder defined once');
ok(src.includes('id="scAddDropArtist"') && src.includes('id="scAddDropTitle"') && src.includes('id="scAddDropDate"'),
  'artist + title + date fields present');
ok(src.includes("_manual: true"), 'manual drops stored with the fetched shape');

console.log('[7] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '62', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v62';"), 'sw.js cache = sidecut-shell-v61.5');
const head = src.indexOf("version: '61.5'");
ok(src.indexOf("version: '61.5'") < src.indexOf("version: '61.2'"), 'CHANGELOG head entry is 61.5');
ok(src.indexOf("version: '61.5'") < src.indexOf("version: '61.3.5'"), '61.5 is ahead of 61.3.5');

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\nall passed');
