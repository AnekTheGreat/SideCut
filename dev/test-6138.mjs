// v61.3.8 — "For not that well known artists such as Bikramjit Dhaliwal the
// lyrics aren't correct for their songs."
//
// What it pins: a same-titled song by a DIFFERENT artist can no longer be
// accepted on its running time alone (that is what served a stranger's lyrics
// for an artist the databases do not carry, and then saved them on the track),
// while an imprint credit ("T-Series", "Saregama Music") still is not treated as
// evidence either way, so an odd tag can't hide a song that really is yours. It
// also pins the two blind providers (textyl's clock, lyrist's title/artist), the
// empty state that names what it skipped, the Manual button being reachable when
// nothing was found, and the picker marking a stranger.
//
// The whole file has to parse for any of it to run.
import fs from 'node:fs';

const src = fs.readFileSync('index.html', 'utf8');
// Kept in a constant on purpose: the release repin pass rewrites the literal
// double-quoted version pins in this directory, and this one is about ordering.
const PREV = '61.3.7';
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

console.log('[1] the file parses — every inline script block');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; let blocks = 0; let bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('       ' + e.message); }
  }
  ok(blocks >= 2 && bad === 0, blocks + ' inline script block(s) parse');
  ok(count("version: '61.3.8'") === 1, 'exactly one 61.3.8 changelog entry');
  ok(/const CHANGELOG = \[\n  \{ version: '61\.3\.8'/.test(src), 'the newest entry sits inside CHANGELOG');
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === '61.3.8', 'APP_VERSION = ' + ver);
  ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v61.3.8';"), 'sw.js cache = sidecut-shell-v61.3.8');
  ok(src.indexOf(`version: '61.3.8'`) < src.indexOf(`version: '${PREV}'`), '61.3.8 heads the changelog');
}

console.log('[2] a length is not an identity — the resolver refuses a stranger');
{
  ok(count("function scLyricsArtistVerdict(candArtist, artistTokens){") === 1, 'the artist-identity check exists');
  ok(count("var SC_LYRICS_IMPRINT_TOKENS = {") === 1, 'the imprint/credit distinction exists');
  ok(count("function scLyricsLooksLikeImprint(artist){") === 1, 'an imprint-only credit is recognised');
  ok(src.includes("  var verdict = scLyricsArtistVerdict(res.artistName, artistTokens);"), 'the ranker asks whose song it is');
  ok(src.includes("  var exactTitle = !!(rKey && titleKey && rKey === titleKey);"), 'an exact title is required of a length match');
  ok(src.includes("      acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign')),"),
     'only the exact title with a non-contradicting credit may ride in on length');
  ok(count("verdict: verdict,") === 1 && count("exactTitle: exactTitle,") === 1, 'both are carried on the rank result');
  ok(!src.includes("acceptable: !!(aHit || dScore >= 2),"), 'the old length-only acceptance is gone');
  ok(src.includes("scLyricsStrangers = 0;") && src.includes("if(rk && rk.verdict === 'foreign' && rk.dScore >= 2) scLyricsStrangers++;"),
     'a refused stranger is counted, not swallowed');
}

console.log('[3] the identity rules themselves (run for real, not grepped)');
{
  const stop = slice("var SC_LYRICS_STOPWORDS = {", "function scLyricsArtistVariants(");
  const block = slice("  function scLyricsArtistTokens(artist){", "  function scLyricsTitleKey(title){");
  ok(!!stop && !!block, 'the rules can be lifted out of the file');
  let api = null;
  try {
    api = new Function(stop + '\n' + block +
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
  ok(count("document.getElementById('lyricsNotFoundWhy')") === 2, 'it is cleared per song and filled on a miss');
  ok(src.includes("why.style.display = scLyricsStrangers ? 'block' : 'none';"), 'it shows only when something was skipped');
  ok(src.includes("' same-titled song' + (scLyricsStrangers === 1 ? '' : 's') +"), 'it counts what it skipped');
  ok(src.includes("' under a different artist \\u2014 skipped, not served as this track\\'s.'"), 'and says they were not served');
  ok(src.includes("var mBtnNF = $('lyricsManualBtn');") && src.includes("mBtnNF.style.display = '';"),
     'the Manual button is revealed when nothing was found');
  ok(src.includes('a same-titled track by someone else is never served as yours'),
     'the empty state says why a real song can have nothing online');
  ok(src.includes('Or tap <b>Manual</b> and paste the words in yourself'), 'and points at the manual way');
}

console.log('[5] the two providers that were taken on trust');
{
  ok(src.includes('var _tyLast = 0;') && src.includes('var _tyFits = !(dur > 0 && _tyLast > dur + 8);'),
     'textyl: a sheet that runs past the end of the file is refused');
  ok(src.includes('if(_tyText.trim().length > 20 && _tyFits){'), 'the clock is part of the acceptance');
  ok(src.includes("var _lyrTitle = String((lyd && lyd.title) || titleVars[lv] || '');"), 'lyrist: its title is read');
  ok(src.includes("var _lyrArtistOk = !_lyrArtist"), 'lyrist: its artist is checked');
  ok(src.includes("scLyricsArtistVerdict(_lyrArtist, scLyricsArtistTokens(artistVars[la])) !== 'foreign'"),
     'lyrist: a reply that contradicts the asked credit is refused');
  ok(src.includes("if(lyd && lyd.lyrics && String(lyd.lyrics).trim() && _textOk(_lyrTitle, '') && _lyrArtistOk){"),
     'and the lyrics only count with the title checked');
}

console.log('[6] the picker marks a stranger');
{
  ok(src.includes('differentArtist: rk.verdict === \'foreign\','), 'each candidate carries the fact');
  ok(src.includes("(c.differentArtist ? ' \\u00b7 different artist' : '')"), 'and the row says so');
}

console.log('[7] the changelog says what actually happened');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  const entries = block ? eval('[' + block[1] + ']') : [];
  const head = entries.find((e) => String(e.version) === '61.3.8');
  ok(!!head, 'the head entry is 61.3.8');
  if (head) {
    const text = (head.items || []).join(' ');
    ok(/Bikramjit Dhaliwal/.test(text) && /length/.test(text), 'it names the small-artist cause');
    ok(/Manual button/.test(text), 'it names the manual way out');
    ok(/imprint/.test(text), 'it names the imprint exception');
    ok(head.date === 'September 24, 2026 · 7:00 PM EDT', 'ship date (' + head.date + ')');
  }
}

console.log('\n' + (failures === 0 ? 'ALL PASS' : 'FAILURES: ' + failures));
process.exit(failures === 0 ? 0 : 1);
