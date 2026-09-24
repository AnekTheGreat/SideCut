// v61.3.8 — "Musicbrianz don't have the dated release for upcoming releases but
// Spotify has it, but I don't want my app to take the user to Spotify or verify
// anything for that except. Make the upcoming release actually work."
//
// What changed: the release check reads an announced drop date from the pinned
// artist's OWN open Apple catalog, resolved by artist ID — the term search is
// popularity-ranked and buries a pre-order, so a dated release weeks out showed
// nothing (probed Sep 24: the ID lookup found 19 of 21 dated upcoming releases
// where the term search found 8 of 13). The silent Spotify token and the
// Spotify upcoming pass are deleted, so no drop date is ever read through an
// account. This pins that pass, the cross-source collapse, the removal, and the
// metadata — and that the interactive PKCE flow survives for the one place it
// has always belonged (the converter's own Spotify search).
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

console.log('[1] the artist catalog is read by ID, with no account');
const idFn = slice('async function scItunesArtistAlbums(artist){', "  // Query iTunes for an artist's recent tracks");
ok(!!idFn, 'scItunesArtistAlbums defined');
ok(idFn && idFn.includes("entity=musicArtist&limit=5"), 'one artist search resolves the id');
ok(idFn && idFn.includes("'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200'"),
  'the artist catalog is read by id (200 albums)');
ok(idFn && idFn.includes('await fetchWithProxy('), 'goes through the shared proxy fetch');
ok(idFn && idFn.includes('credited('), 'the pinned artist must be credited (bidirectional match)');
ok(idFn && idFn.includes('primaryArtistName(artist)'), 'collab partners are stripped before matching');
ok(idFn && !/spotify|token|accounts\./i.test(idFn), 'no Spotify, no token, no account in the pass');
ok(idFn && idFn.includes('catch(_eId){ return []; }'), 'best-effort: a failure returns nothing, never throws');

console.log('[2] the album pass folds it in and collapses the same drop');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('scItunesArtistAlbums(artist)'), 'the artist-catalog pass runs in the album loop');
ok(check && check.indexOf('scItunesArtistAlbums(artist)') < check.indexOf("const albPick = []"),
  'its albums join the candidate pool before the collapse');
ok(check && check.includes('if((r.trackCount || 0) === 1) return;'), 'one-track releases still defer to the song query');
ok(check && check.includes('const albSeen = new Set();'), 'cross-source albums collapse by title+day');
ok(check && check.includes('albPick.slice(0, 5)'), 'the deduped pool is what gets listed');
ok(check && check.includes('alb:') && check.includes('prevKeys.has(keyA)'), 'the same drop already stored is skipped');
ok(check && check.includes('catch(_idE)'), 'a catalog failure cannot break the check');

console.log('[3] no Spotify anywhere in the release check');
ok(count('scSpotifySilentToken') === 0, 'the silent token is gone');
ok(count('scFetchSpotifyUpcoming') === 0, 'the Spotify upcoming pass is gone');
ok(count('_spt:') === 0, 'no Spotify-sourced entry key survives');
ok(count('spFresh') === 0, 'the check merges no Spotify result set');
ok(check && !check.includes('__scSpotifyUpcoming'), 'the check never calls a Spotify source');
ok(check && !check.includes('accounts.spotify.com'), 'no token exchange in the check');
const mb = slice('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
ok(!!mb, 'the open MusicBrainz pass still runs beside it');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'the dedupe key names the open source');

console.log('[4] the interactive flow survives, only where it belongs');
ok(count('async function scSpotifyInteractiveToken(){') === 1, 'the PKCE flow is still defined');
ok(count('await scSpotifyInteractiveToken()') === 1, 'exactly one call site left (the converter search)');
const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
ok(!!tap, 'the release-check tap handler slice extracted');
ok(tap && !tap.includes('scSpotifyInteractiveToken'), 'the release check never opens an authorization window');
const cta = slice('window.__scWireUpcomingCta = function', 'window.__scRebuildReleaseLists = async function');
ok(!!cta && !cta.includes('Connect Spotify'), 'the empty state still asks you to connect nothing');
ok(!!cta && cta.includes("cbtn.textContent = 'Check for drops'"), 'it runs the check on the spot');

console.log('[5] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.3.9', 'APP_VERSION = ' + ver);
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3.9';"), 'sw.js cache = sidecut-shell-v61.3.9');
ok(count("version: '61.3.9'") === 1, 'exactly one 61.3.8 changelog entry');
ok(/const CHANGELOG = \[\n  \{ version: '61\.3\.9'/.test(src), 'the newest entry sits inside CHANGELOG');
ok(src.indexOf("version: '61.3.9'") < src.indexOf("version: '61.3.7'"), 'it heads the changelog');

if (failures) { console.log('\n' + failures + ' failure(s)'); process.exit(1); }
console.log('\nall passed');
