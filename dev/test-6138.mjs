// v61.5 — the two releases that both called themselves 61.3.8, side by side.
//
// The local line's 61.3.8 ("For not that well known artists such as Bikramjit
// Dhaliwal the lyrics aren't correct for their songs."): a same-titled song by
// a DIFFERENT artist could be accepted on its running time alone — that is what
// served a stranger's lyrics for an artist the databases do not carry, and then
// saved them on the track. An imprint credit ("T-Series", "Saregama Music") is
// still not evidence either way, so an odd tag can't hide a song that really is
// yours. It also pins the blind lyrist provider, the empty state that names
// what it skipped, the Manual button being reachable when nothing was found,
// and the picker marking a stranger.
// (Apple's textyl is NOT pinned here any more: origin's 61.4 removed the
// source outright — its reply carries no title or artist, so it can never be
// verified. What remains is documented at its removal site in index.html.)
//
// origin/main's 61.3.8 ("Make the upcoming release actually work", no
// Spotify): the release check reads an announced drop date from the pinned
// artist's OWN open Apple catalog, resolved by artist ID — the term search is
// popularity-ranked and buries a pre-order, so a dated release weeks out showed
// nothing (probed Sep 24: the ID lookup found 19 of 21 dated upcoming releases
// where the term search found 8 of 13). The silent Spotify token and the
// Spotify upcoming pass are deleted, so no drop date is ever read through an
// account. That pass, the cross-source collapse and the surviving interactive
// PKCE flow (the converter's own search) are pinned in sections [8]–[11].
//
// The whole file has to parse for any of it to run.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
let failures = 0;
const ok = (cond, label) => { console.log((cond ? '  ok   ' : '  FAIL ') + label); if (!cond) failures++; };
const count = (needle) => src.split(needle).length - 1;
const slice = (from, to) => {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a + from.length);
  return b === -1 ? null : src.slice(a, b);
};
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
const entries = block ? eval('[' + block[1] + ']') : [];
// Kept in a constant on purpose: the release repin pass rewrites the literal
// double-quoted version pins in this directory, and this one is about ordering.
const PREV = '61.3.7';

console.log('[1] the file parses — every inline script block');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; let blocks = 0; let bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('       ' + e.message); }
  }
  ok(blocks >= 2 && bad === 0, blocks + ' inline script block(s) parse');
  ok(count("version: '61.5'") === 1, 'exactly one 61.5 changelog entry');
  ok(/const CHANGELOG = \[\n  \{ version: '63.0.7'/.test(src), 'the newest entry sits inside CHANGELOG');
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === '63.0.7', 'APP_VERSION = ' + ver);
  ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v63.0.8';"), 'sw.js cache = sidecut-shell-v61.5');
  ok(src.indexOf(`version: '61.5'`) < src.indexOf(`version: '${PREV}'`), '61.5 heads the changelog');
}

console.log('[2] a length is not an identity — the resolver refuses a stranger');
{
  ok(count("function scLyricsArtistVerdict(candArtist, artistTokens){") === 1, 'the artist-identity check exists');
  ok(count("var SC_LYRICS_IMPRINT_TOKENS = {") === 1, 'the imprint/credit distinction exists');
  ok(count("function scLyricsLooksLikeImprint(artist){") === 1, 'an imprint-only credit is recognised');
  ok(src.includes("  var verdict = scLyricsArtistVerdict(res.artistName, artistTokens);"), 'the ranker asks whose song it is');
  ok(src.includes("  var exactTitle = !!(rKey && titleKey && rKey === titleKey);"), 'an exact title is required of a length match');
  ok(src.includes("      acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign' && !scLyricsStrangerCredit(res.artistName, artistTokens))),"),
     'only the exact title with a non-contradicting credit may ride in on length');
  ok(count("verdict: verdict,") === 1 && count("exactTitle: exactTitle,") === 1, 'both are carried on the rank result');
  ok(!src.includes("acceptable: !!(aHit || dScore >= 2),"), 'the old length-only acceptance is gone');
  ok(src.includes("scLyricsStrangers = 0;") && src.includes("if(rk && rk.verdict === 'foreign' && rk.dScore >= 2) scLyricsStrangers++;"),
     'a refused stranger is counted, not swallowed');
}

console.log('[3] the identity rules themselves (run for real, not grepped)');
{
  const stop = slice("var SC_LYRICS_STOPWORDS = {", "function scLyricsArtistVariants(");
  const ruleSlice = slice("  function scLyricsArtistTokens(artist){", "  function scLyricsTitleKey(title){");
  ok(!!stop && !!ruleSlice, 'the rules can be lifted out of the file');
  let api = null;
  try {
    api = new Function(stop + '\n' + ruleSlice +
      '\nreturn { verdict: scLyricsArtistVerdict, imprint: scLyricsLooksLikeImprint, tokens: scLyricsArtistTokens };')();
  } catch (e) { console.log('       ' + e.message); }
  ok(!!api, 'the rules evaluate');
  if (api) {
    const ours = api.tokens('Bikramjit Dhaliwal');
    ok(api.verdict('Karan Aujla', ours) === 'foreign', 'another artist is a stranger (the Bikramjit Dhaliwal / Karan Aujla case)');
    ok(api.verdict('Sharry Mann', ours) === 'foreign', 'so is any other same-titled hit');
    ok(api.verdict('Bikramjit Dhaliwal', ours) === 'match', 'his own credit agrees');
    ok(api.verdict('BIKRAMJIT DHALIWAL;HIZZY HUNDAL', ours) === 'match', 'a multi-credit file agrees');
    ok(api.verdict('Gurdaas Maan', api.tokens('Gurdas Maan')) === 'match', 'transliteration drift still counts as the same artist');
    ok(api.verdict('T-Series', api.tokens('Diljit Dosanjh')) === 'unknown', 'an imprint says nothing either way');
    ok(api.verdict('Saregama Music', api.tokens('Some Unknown Label')) === 'unknown', 'so an odd tag cannot hide a real hit');
    ok(api.verdict('', ours) === 'unknown', 'a missing credit is not a contradiction');
    ok(api.verdict('Karan Aujla', api.tokens('Saregama Music')) === 'unknown', 'a label tag on our side is not evidence either');
    ok(api.imprint('Speed Records') && api.imprint('T-Series') && api.imprint('Saregama Music'), 'the imprints are recognised');
    ok(!api.imprint('Karan Aujla') && !api.imprint('Bikramjit Dhaliwal'), 'people are not imprints');
  }
}

console.log('[4] the empty state explains itself and offers the manual way out');
{
  ok(count('id="lyricsNotFoundWhy"') === 1, 'the explanation line exists');
  ok(count("document.getElementById('lyricsNotFoundWhy')") === 3, 'it is cleared per song, filled on a miss, and filled again when only strangers matched');
  ok(src.includes("why.style.display = _whyLines.length ? 'block' : 'none';"), 'it shows whenever there is something to say');
  ok(src.includes("' same-titled song' + (scLyricsStrangers === 1 ? '' : 's') +"), 'it counts what it skipped');
  ok(src.includes("' under a different artist \\u2014 skipped, not served as this track\\'s.'"), 'and says they were not served');
  ok(src.includes("var mBtnNF = $('lyricsManualBtn');") && src.includes("mBtnNF.style.display = '';"),
     'the Manual button is revealed when nothing was found');
  ok(src.includes('a same-titled track by someone else is never served as yours'),
     'the empty state says why a real song can have nothing online');
  ok(src.includes('Or tap <b>Manual</b> and paste the words in yourself'), 'and points at the manual way');
}

console.log('[5] the provider that was taken on trust');
{
  ok(src.includes("var _lyrTitle = String((lyd && lyd.title) || titleVars[lv] || '');"), 'lyrist: its title is read');
  ok(src.includes('var _lyrArtistOk = !_lyrArtist'), 'lyrist: its artist is checked');
  ok(src.includes("scLyricsArtistVerdict(_lyrArtist, scLyricsArtistTokens(artistVars[la])) !== 'foreign'"),
     'lyrist: a reply that contradicts the asked credit is refused');
  ok(src.includes("if(lyd && lyd.lyrics && String(lyd.lyrics).trim() && _textOk(_lyrTitle, '') && _lyrArtistOk){"),
     'and the lyrics only count with the title checked');
  ok(!src.includes('api.textyl.co'), 'textyl is gone — a reply with no title can never be verified');
}

console.log('[6] the picker marks a stranger');
{
  ok(src.includes("differentArtist: rk.verdict === 'foreign',"), 'each candidate carries the fact');
  ok(src.includes("(c.differentArtist ? ' \\u00b7 different artist' : '')"), 'and the row says so');
}

console.log('[7] the changelog says what actually happened');
{
  const head = entries.find((e) => String(e.version) === '61.5');
  ok(!!head, 'the head entry is 61.5');
  if (head) {
    ok(head.date === 'September 25, 2026 · 5:00 AM EDT', 'ship date (' + head.date + ')');
    const headText = (head.items || []).join(' ');
    // Both 61.3.8 releases are folded into this one entry, so the notes this
    // test was written against live HERE now.
    ok(/Bikramjit Dhaliwal/.test(headText) && /length/.test(headText), 'it names the small-artist cause');
    ok(/Manual button/.test(headText), 'it names the manual way out');
    ok(/imprint/.test(headText), 'it names the imprint exception');
    ok(/same-titled/.test(headText), 'and it says a same-titled stranger is never served');
  }
}

console.log('[8] the artist catalog is read by ID, with no account');
const idFn = slice('async function scItunesArtistAlbums(artist){', "  // Query iTunes for an artist's recent tracks");
ok(!!idFn, 'scItunesArtistAlbums defined');
ok(idFn && idFn.includes('entity=musicArtist&limit=5'), 'one artist search resolves the id');
ok(idFn && idFn.includes("'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200'"),
  'the artist catalog is read by id (200 albums)');
ok(idFn && idFn.includes('await fetchWithProxy('), 'goes through the shared proxy fetch');
ok(idFn && idFn.includes('credited('), 'the pinned artist must be credited (bidirectional match)');
ok(idFn && idFn.includes('primaryArtistName(artist)'), 'collab partners are stripped before matching');
ok(idFn && !/spotify|token|accounts\./i.test(idFn), 'no Spotify, no token, no account in the pass');
ok(idFn && idFn.includes('catch(_eId){ return []; }'), 'best-effort: a failure returns nothing, never throws');

console.log('[9] the album pass folds it in and collapses the same drop');
const check = slice('async function fetchArtistReleases(artist){', 'async function checkPinnedArtistReleases');
ok(!!check, 'fetchArtistReleases slice extracted');
ok(check && check.includes('scItunesArtistAlbums(artist)'), 'the artist-catalog pass runs in the album loop');
ok(check && check.indexOf('scItunesArtistAlbums(artist)') < check.indexOf('const albPick = []'),
  'its albums join the candidate pool before the collapse');
ok(check && check.includes('if((r.trackCount || 0) === 1) return;'), 'one-track releases still defer to the song query');
ok(check && check.includes('const albSeen = new Set();'), 'cross-source albums collapse by title+day');
ok(check && check.includes('albPick.slice(0, 5)'), 'the deduped pool is what gets listed');
ok(check && check.includes('alb:') && check.includes('prevKeys.has(keyA)'), 'the same drop already stored is skipped');
ok(check && check.includes('catch(_idE)'), 'a catalog failure cannot break the check');

console.log('[10] no Spotify anywhere in the release check');
ok(count('scSpotifySilentToken') === 0, 'the silent token is gone');
ok(count('scFetchSpotifyUpcoming') === 0, 'the Spotify upcoming pass is gone');
ok(count('_spt:') === 0, 'no Spotify-sourced entry key survives');
ok(count('spFresh') === 0, 'the check merges no Spotify result set');
ok(check && !check.includes('__scSpotifyUpcoming'), 'the check never calls a Spotify source');
ok(check && !check.includes('accounts.spotify.com'), 'no token exchange in the check');
const mb = slice('async function scFetchMbUpcoming(artist){', 'window.__scMbUpcoming = scFetchMbUpcoming;');
ok(!!mb, 'the open MusicBrainz pass still runs beside it');
ok(check && check.includes("'mbt:' + nt + '|' + x.date"), 'the dedupe key names the open source');

console.log('[11] the interactive flow survives, only where it belongs');
ok(count('async function scSpotifyInteractiveToken(){') === 1, 'the PKCE flow is still defined');
ok(count('await scSpotifyInteractiveToken()') === 1, 'exactly one call site left (the converter search)');
const tap = slice('window.__scUpcomingConnectTap = async function', 'window.__scAddUpcomingDrop = function');
ok(!!tap, 'the release-check tap handler slice extracted');
ok(tap && !tap.includes('scSpotifyInteractiveToken'), 'the release check never opens an authorization window');
const cta = slice('window.__scWireUpcomingCta = function', 'window.__scRebuildReleaseLists = async function');
ok(!!cta && !cta.includes('Connect Spotify'), 'the empty state still asks you to connect nothing');
ok(!!cta && cta.includes("cbtn.textContent = 'Check for drops'"), 'it runs the check on the spot');

console.log('\n' + (failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures));
process.exit(failures === 0 ? 0 : 1);
