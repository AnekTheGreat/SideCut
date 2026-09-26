// v62 — lyrics for an artist whose name is only a letter or two.
//
// The report: "I'm not getting any lyrics for lesser known artists such as
// Bikramjit Dhaliwal".
//
// MEASURED FIRST (Sep 25, 2026), and it reframed the report:
//   * lrclib `search?q=Bikramjit` -> 0 results; `search?artist_name=Bikramjit
//     Dhaliwal` -> 0 results. Nothing is filed under that name.
//   * "Bikramjit Dhaliwal" is the WRITER credit, not the performer. The artist
//     is "BK" — the same artist whose albums v61.8 was about. lrclib files his
//     songs under "BK": `/api/get?artist_name=BK&track_name=Mob Ties (Intro)` ->
//     200, `.../MOTION` -> 200, `.../Aaja Billo` -> 200, `.../College` -> 200;
//     and `search?track_name=Icy` returns "Icy" by "BK & Jay Trak".
//   * The two "Genius-derived" fallbacks the file still carries are dead for
//     anonymous callers: some-random-api -> 403 `{"error":"key required"}`,
//     lyrist.vercel.app -> 429. Re-measured this session.
//
// So the entries were THERE and the app refused them. Driving the SHIPPED
// matcher — lifted out of index.html, run against LIVE lrclib answers
// (dev/_probe_rank.mjs, since deleted), with the entry's own title, the
// artist's own name and the track's own length:
//
//   "Mob Ties (Intro)" by "BK" 168s, tag "BK",                 drift +0s -> ACCEPT
//   "Mob Ties (Intro)" by "BK" 168s, tag "BK",                 drift +3s -> refuse
//   "Mob Ties (Intro)" by "BK" 168s, tag "Bikramjit Dhaliwal", drift +0s -> refuse
//
// Both refusals are the SAME defect v61.8 fixed, in the lyric matcher instead of
// the artist check: a name of two letters or fewer is dropped, so it can neither
// confirm nor be compared. `scLyricsRank` built `aHit` from tokens of three or
// more characters, so "BK" contributed nothing and acceptance rested on a length
// within 2 s alone. `scLyricsArtistVerdict` filtered our tokens to >=3 AND
// skipped the entry's tokens below 3, so an entry filed under "BK" could never
// say 'match' and the comparison fell through to 'foreign' — a hard refusal.
//
// The fix is v61.8's rule applied to lyrics: a name of two letters or fewer can
// CONFIRM but never REJECT, word for word, and only when the credit has no
// longer word to go on.
//
// This audit RUNS both shipped functions against those real shapes and pins the
// safety property — that the change can only ever turn a refusal into an
// acceptance — alongside the guard rails that keep strangers out.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (s) => src.split(s).length - 1;

function extractFn(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at === -1) throw new Error('no such function in index.html: ' + name);
  const open = src.indexOf('{', at);
  let d = 0;
  for (let k = open; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (d === 0) return src.slice(at, k + 1); }
  }
  throw new Error('unterminated function: ' + name);
}
// The object literals span lines, so end on the ';' at bracket depth 0.
function extractVar(name) {
  const at = src.indexOf('var ' + name + ' = ');
  if (at === -1) throw new Error('no such var in index.html: ' + name);
  let d = 0;
  for (let k = at; k < src.length; k++) {
    const ch = src[k];
    if (ch === '{' || ch === '[' || ch === '(') d++;
    else if (ch === '}' || ch === ']' || ch === ')') d--;
    else if (ch === ';' && d === 0) return src.slice(at, k);
  }
  throw new Error('unterminated var: ' + name);
}

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '62.0.5', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
  const headText = entries[0].items.join(' ');
  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');
  // Both channels share the head entry's first six items, and the store channel
  // may not carry a downloader term at all.
  ok(!/\bdownload|converter|convert\b/i.test(headText), 'notes carry no downloader term (shared channel)');
  ok(entries.findIndex((e) => String(e.version) === ver) === 0, 'the 62.0.5 entry heads the changelog');
  const rel619 = entries.find((e) => String(e.version) === '61.9');
  ok(!!rel619, 'the 61.9 entry is still in the changelog');
  ok(/steps only|walkthrough/.test((rel619 ? rel619.items : []).join(' ')), 'its wording survived the new head entry');
  const rel618 = entries.find((e) => String(e.version) === '61.8');
  ok(!!rel618 && /no matching source/.test(rel618.items.join(' ')), 'so did the 61.8 entry');
}
ok(sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

console.log('[2] the shipped rules are lifted out and run');
const ruleSrc = [
  extractVar('SC_LYRICS_STOPWORDS'),
  extractVar('SC_LYRICS_IMPRINT_TOKENS'),
  extractFn('scLyricsArtistTokens'),
  extractFn('scLyricsLooksLikeImprint'),
  extractFn('scLyricsArtistVerdict'),
  extractFn('scLyricsTitleKey'),
  extractFn('scLyricsRank')
].join('\n');
let api = null;
try { api = new Function(ruleSrc + '\nreturn { verdict: scLyricsArtistVerdict, tokens: scLyricsArtistTokens, rank: scLyricsRank, key: scLyricsTitleKey };')(); }
catch (e) { console.log('       ' + e.message); }
ok(!!api, 'the rules evaluate');

const V = (cand, tag) => api.verdict(cand, api.tokens(tag));
// A lyric entry, as lrclib hands it over.
const E = (trackName, artistName, duration, synced) => ({
  trackName, artistName, duration, plainLyrics: 'la la', syncedLyrics: synced ? '[00:01.00] la la' : null
});
const accepts = (e, title, tag, dur) => {
  const r = api.rank(e, api.key(title), api.tokens(tag), dur);
  return !!(r && r.acceptable);
};

console.log('[2a] a short credit can CONFIRM');
{
  ok(V('BK', 'BK') === 'match', 'our "BK" and an entry filed under "BK" agree (was never even compared)');
  ok(V('BK & Jay Trak', 'BK') === 'match', '"BK" is found inside a multi-artist credit');
  ok(V('Karan Aujla', 'BK') === 'unknown', 'a short credit cannot refuse a real name either');
  ok(V('BKay Music', 'BK') === 'unknown', 'and two letters never match inside a longer word');
  ok(V('B K Music', 'BK') === 'unknown', 'nor across a split "B K"');
}

console.log('[2b] a short credit on the ENTRY can no longer be read as a stranger');
{
  // The measured refusal: the writer credit against lrclib's own "BK" entry.
  ok(V('BK', 'Bikramjit Dhaliwal') === 'unknown',
    'an entry filed under "BK" is not a contradiction of "Bikramjit Dhaliwal" (was foreign — a hard refusal)');
  ok(V('BK & Jay Trak', 'Bikramjit Dhaliwal') === 'foreign',
    'but a credit with real names that match nothing is still a stranger');
}

console.log('[2c] the stranger guard is untouched for ordinary names');
{
  ok(V('Karan Aujla', 'Bikramjit Dhaliwal') === 'foreign', 'another artist is still a stranger');
  ok(V('Sharry Mann', 'Bikramjit Dhaliwal') === 'foreign', 'so is any other same-titled hit');
  ok(V('Bikramjit Dhaliwal', 'Bikramjit Dhaliwal') === 'match', 'his own credit agrees');
  ok(V('BIKRAMJIT DHALIWAL;HIZZY HUNDAL', 'Bikramjit Dhaliwal') === 'match', 'a multi-credit file agrees');
  ok(V('Gurdaas Maan', 'Gurdas Maan') === 'match', 'transliteration drift still counts as the same artist');
  ok(V('T-Series', 'Diljit Dosanjh') === 'unknown', 'an imprint says nothing either way');
  ok(V('', 'Bikramjit Dhaliwal') === 'unknown', 'a missing credit is not a contradiction');
  ok(V('Karan Aujla', 'Saregama Music') === 'unknown', 'a label tag on our side is not evidence either');
}

console.log('[2d] the scorer, on the exact entries that were measured');
{
  const mob = E('Mob Ties (Intro)', 'BK', 168);
  ok(accepts(mob, 'Mob Ties (Intro)', 'BK', 168) === true, 'tag "BK", entry by "BK", same length — accepted');
  // THE FIX: before this release the two below were refused, because "BK" could
  // not produce an artist hit and acceptance rested on a length within 2 s.
  ok(accepts(mob, 'Mob Ties (Intro)', 'BK', 171) === true, 'tag "BK", 3 s of drift — accepted now (was refused)');
  ok(accepts(mob, 'Mob Ties (Intro)', 'BK', 177) === true, 'tag "BK", 9 s of drift — accepted now (was refused)');
  // THE OTHER HALF: the writer credit against the artist's own entry.
  ok(accepts(mob, 'Mob Ties (Intro)', 'Bikramjit Dhaliwal', 168) === true,
    'tag "Bikramjit Dhaliwal", entry by "BK" — accepted now (was refused)');
  // Honest ceiling, unchanged: nothing links those two names, so a drifted length
  // still may not be used as identity.
  ok(accepts(mob, 'Mob Ties (Intro)', 'Bikramjit Dhaliwal', 171) === false,
    'tag "Bikramjit Dhaliwal" with drift still needs the length — the ceiling is unchanged');

  const icy = E('Icy', 'BK & Jay Trak', 147, true);
  ok(accepts(icy, 'Icy', 'BK', 156) === true, '"BK" confirms a multi-artist entry (was refused)');
  ok(accepts(icy, 'Icy', 'Bikramjit Dhaliwal', 147) === false, 'the writer credit still cannot claim that one');
}

console.log('[2e] the change can only ever turn a refusal into an acceptance');
{
  // A short token must never leak into a credit that has a long word to go on,
  // or "DJ Snake" would be confirmed by "DJ Khaled".
  const dj = E('Some Song', 'DJ Khaled', 100);
  const r = api.rank(dj, api.key('Some Song'), api.tokens('DJ Snake'), 100);
  ok(!r || !r.acceptable, '"DJ Khaled" cannot confirm "DJ Snake"');
  ok(!!r && r.aHit === false, 'because the short half of a long credit still counts for nothing');
  // …and a short token only ever matches a whole word of the candidate's credit.
  ok(V('Khaled', 'DJ') === 'unknown', 'a two-letter name does not match inside a longer one');
  ok(V('DJ', 'DJ') === 'match', 'but an exact short word does');
}

console.log('[2f] the pre-existing guards are all still in place');
{
  ok(src.includes("dScore >= 2 && exactTitle && verdict !== 'foreign'"),
    'a length-only match still needs the exact title and a credit that does not contradict ours');
  ok(!!api.rank(E('Different Song', 'BK', 168), api.key('Mob Ties (Intro)'), api.tokens('BK'), 168) === false,
    'a different song is still not this song');
  ok(api.rank(E('Mob Ties (Intro)', 'BK', 168), 'not a key', api.tokens('BK'), 168) === null, 'a title that lines up nowhere is refused');
  ok(api.rank({ trackName: 'Mob Ties (Intro)', artistName: 'BK', duration: 168 }, api.key('Mob Ties (Intro)'), api.tokens('BK'), 168) === null,
    'an entry with no lyrics at all is not a result');
  ok(src.includes('4. (removed) textyl'), 'the unverifiable provider is still documented as removed');
}

console.log('[3] the fix is shaped as two confirm-only branches');
{
  ok(count('var mineShort = [];') === 1, 'the artist check builds the short-name list');
  ok(count('var shortHit = false;') === 1, 'the scorer builds the short-name test');
  const verdict = extractFn('scLyricsArtistVerdict');
  ok(verdict.indexOf("return 'foreign'") > verdict.indexOf('var mineShort'),
    'the verdict only reaches foreign after the short-name question is asked');
  // `foreign` must now be guarded by a real long word on the entry's side.
  ok(/for\(var k = 0; k < theirs\.length; k\+\+\)\{\n\s*if\(theirs\[k\]\.length >= 3/.test(verdict),
    'a short entry credit cannot produce a refusal');
  const rank = extractFn('scLyricsRank');
  ok(rank.indexOf('if(!longWords){') < rank.indexOf('var aHit'),
    'the short-name test runs only for a credit with no long word, and before aHit is decided');
  ok(!/scTrackTitleKey|localStorage/.test(verdict), 'the check stays pure — no storage');
}

console.log('[4] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
