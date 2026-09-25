// v61.3.6 — "I told you no connect Spotify — just make the app look it up."
// A public app cannot ask anyone to connect an account to read a drop date,
// so the Connect Spotify CTA is gone and the date now comes from an open
// source: one MusicBrainz search per pinned artist, filtered to a real future
// day and a credit to that artist, merged into pinnedReleases like every other
// source. This pins that pass, the connect-free empty state, the fact that no
// release-check path can open an authorization window, and the metadata.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
// Slice from a start marker to an end marker — null when either is missing so
// a moved function fails loudly instead of passing an empty string.
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  if (b === -1) return null;
  return src.slice(a, b);
}

console.log('[1] MusicBrainz pass: open search, real future day, credited artist');
const mb = slice('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
ok(!!mb, 'scFetchMbUpcoming defined and exported');
ok(mb && mb.includes("'https://musicbrainz.org/ws/2/' + ps.path + '/?query='"), 'queries the open MusicBrainz search, both endpoints');
ok(mb && mb.includes("ps.range + ':[' + today + ' TO ' + horizon + ']'"), 'date range covers today → today+400d');
ok(mb && mb.includes('fetchWithProxy(url, SC_MB_FETCH)'), 'goes through the shared proxy fetch, carrying an identifying User-Agent');
ok(mb && !mb.includes('accounts.spotify.com') && !mb.includes('window.open'), 'no Spotify, no token, no window in the pass');
ok(mb && mb.includes('window.__scDay10(rg[ps.dateKey])'), 'day-precision parse reused');
ok(mb && mb.includes('window.__scUpcomingDay(d)'), 'the future/placeholder gate reused');
ok(mb && mb.includes("pt !== 'Album' && pt !== 'Single' && pt !== 'EP'"), 'albums, singles and EPs only');
ok(mb && mb.includes('credits.some('), 'the pinned artist must be credited (collabs only with your artist)');
ok(mb && mb.includes('_mb: rg.id'), 'entries carry their source key for the dedupe');

console.log('[2] release check merges it before the concat');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('window.__scMbUpcoming(artist)'), 'the no-account pass runs in the release check');
ok(check && check.indexOf('window.__scMbUpcoming(artist)') < check.indexOf('// Keep all fetched releases'),
  'merges before the prev.concat(fresh) merge');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'dedupe key names its source');
ok(check && check.includes('pe.date = x.date'), 'an undated entry gets the date in place instead of duplicating');
ok(check && check.includes('catch(_eSp)'), 'best-effort: a source failure cannot break the check');

console.log('[3] empty state: check + manual, nothing to connect');
const cta = slice('window.__scWireUpcomingCta = function', 'window.__scRebuildReleaseLists = async function');
ok(!!cta, 'CTA helper slice extracted');
ok(cta && cta.includes("cbtn.textContent = 'Check for drops'"), 'primary button runs the check');
ok(cta && !cta.includes('Connect Spotify'), 'no Connect Spotify anywhere in the CTA');
ok(cta && cta.includes('Add a drop manually'), 'manual sheet still offered beside it');
ok(cta && !cta.includes('SC_SPOTIFY_TOKEN_KEY'), 'no connection state consulted when wiring the buttons');
const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
ok(!!tap, 'tap handler slice extracted');
ok(tap && !tap.includes('scSpotifyInteractiveToken'), 'the button tap never opens an authorization window');
ok(count('await scSpotifyInteractiveToken()') === 1, 'the only window left belongs to the Spotify search flow');

console.log('[4] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '62', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v62';"), 'sw.js cache = sidecut-shell-v61.5');
ok(src.indexOf("version: '61.5'") < src.indexOf("version: '61.3.5'"), '61.5 heads the changelog');

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\nall passed');
