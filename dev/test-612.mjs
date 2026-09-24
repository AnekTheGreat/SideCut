// v61.2 — "there needs to be a way that SideCut gets it".
// Apple's search API, Deezer and MusicBrainz list nothing for a release that
// has not landed, so a real dated drop (verified: Karan Aujla's "AUJLA SZN 1",
// 0 hits everywhere but Spotify) never reached Upcoming releases. This pins
// the three ways SideCut now gets a date: the silent Spotify pass, the Connect
// CTA on both empty states, and the manual drop sheet — plus the rule that a
// background check must NEVER open an authorization window.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
// Slice from a start marker to an end marker (inclusive of neither check —
// returns null when either is missing so a moved function fails loudly).
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  if (b === -1) return null;
  return src.slice(a, b);
}

console.log('[1] silent token: refresh only, never a window');
const silent = slice('async function scSpotifySilentToken(){', 'window.__scSpotifySilentToken = scSpotifySilentToken;');
ok(!!silent, 'scSpotifySilentToken defined and exported');
ok(silent && silent.includes("grant_type:'refresh_token'"), 'quiet refresh_token exchange');
ok(silent && silent.includes('if(!t || !t.refresh_token) return null;'), 'no connection → null, other sources carry on');
ok(silent && !silent.includes('window.open') && !silent.includes('accounts.spotify.com/authorize'), 'no authorization window anywhere on the silent path');
ok(silent && silent.includes('localStorage.setItem(SC_SPOTIFY_TOKEN_KEY'), 'refreshed token persisted');

console.log('[2] interactive token: the ONE place a window may open');
const inter = slice('async function scSpotifyInteractiveToken(){', 'window.__scSpotifyConnect = scSpotifyInteractiveToken;');
ok(!!inter, 'scSpotifyInteractiveToken defined');
ok(inter && inter.includes("window.open(auth, 'sidecut-spotify-auth'"), 'PKCE authorization popup lives here');
ok(inter && inter.includes('return token;'), 'returns the token for callers');
ok(count('await scSpotifyInteractiveToken()') === 2,
  'exactly two interactive call sites (Spotify search + the Connect CTA tap)');
ok(src.includes('async function scSpotifySearch(q, type){'), 'scSpotifySearch still exists and now routes through it');

console.log('[3] upcoming pass: future, day-precision, pinned artist only');
const up = slice('async function scFetchSpotifyUpcoming(artist){', 'window.__scSpotifyUpcoming = scFetchSpotifyUpcoming;');
ok(!!up, 'scFetchSpotifyUpcoming defined and exported');
ok(up && up.includes('await scSpotifySilentToken()'), 'reads its token silently');
ok(up && up.includes('a.release_date_precision !== \'day\''), 'month-precision placeholders dropped');
ok(up && up.includes('!(d > today)'), 'already-released dates dropped');
ok(up && up.includes('credits.indexOf(want) === -1'), 'the pinned artist must be credited (no collab noise)');
ok(up && up.includes('include_groups=album,single&limit=50'), 'albums + singles, no market filter (pre-saves vary by storefront)');
ok(up && !up.includes('market='), 'no market= narrowing');

console.log('[4] merge inside fetchArtistReleases');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('window.__scSpotifyUpcoming(artist)'), 'Spotify pass runs in the release check');
ok(check && check.indexOf('window.__scSpotifyUpcoming(artist)') < check.indexOf('// Keep all fetched releases'),
  'merges before the prev.concat(fresh) merge');
ok(check && check.includes("'spt:' + nt + '|' + x.date"), 'dedupe key names its source');
ok(check && check.includes('pe.date = x.date'), 'an undated entry gets the date in place instead of duplicating');
ok(check && check.includes('catch(_eSp)'), 'best-effort: a Spotify failure cannot break the check');

console.log('[5] Connect CTA wired into both empty states');
ok(count('window.__scWireUpcomingCta = function') === 1, 'wiring helper defined once');
ok(count('window.__scWireUpcomingCta(') === 2, 'called from both empty states (Home bubble + Fetch latest popup)');
ok(count('_scUpWired') === 2, 'idempotence guard set and checked');
ok(src.includes("cbtn.textContent = 'Connect Spotify'") && src.includes("cbtn.textContent = 'Re-check for drops'"),
  'button relabels to a plain re-check once connected');

console.log('[6] manual drop sheet');
ok(count('window.__scAddUpcomingDrop = function') === 1, 'sheet builder defined once');
ok(count('window.__scAddUpcomingDrop()') >= 1, 'reachable from the empty-state CTA');
ok(src.includes('id="scAddDropArtist"') && src.includes('id="scAddDropTitle"') && src.includes('id="scAddDropDate"'),
  'artist + title + date fields present');
ok(src.includes("_manual: true"), 'manual drops stored with the fetched shape (kind/seen/date)');
ok(src.includes("toast('That drop is already listed.'"), 'duplicate guard');
ok(src.includes('window.__scRebuildReleaseLists(false)') && src.includes('window.__scRebuildReleaseLists = async function'),
  'rebuild helper defined and called after saving');

console.log('[7] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.3', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3';"), 'sw.js cache = sidecut-shell-v61.3');
const head = src.indexOf("version: '61.3'");
ok(src.indexOf("version: '61.3'") < src.indexOf("version: '61.2'"), 'CHANGELOG head entry is 61.3');
ok(src.indexOf("version: '61.3'") < src.indexOf("version: '61.2'"), '61.3 is ahead of 61.2');

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\nall passed');
