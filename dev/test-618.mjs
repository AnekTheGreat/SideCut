// v61.8 — a co-credited song is found on the artist's own channel again.
//
// The report: "Tried on 2 different albums and came back no matching source fix
// this" / "I tried 2 different albums and both of them have no source found".
//
// Measured live on Sep 25, 2026 with the shipped search + verify pipeline lifted
// out of index.html (dev/_probe_convert.mjs, since deleted) on the two albums
// the user named — BK's "Gangstas Paradise" and "MIXED FEELINGS":
//
//   Mob Ties (Intro) / BK              -> FOUND
//   In God We Trust  / BK              -> FOUND
//   Scarface         / BK, Arsh Heer   -> null  "no matching source"
//   LIFESTYLE        / BK              -> FOUND
//   IN THE STREETS   / BK, Jay 1       -> null  "no matching source"
//
// The two that failed are exactly the multi-artist credits. scArtistMatch judges
// each credited artist on its own (v60.1), but builds the word list for a credit
// with `w.length > 2` as the stop-word rule — so a two-letter artist name like
// "BK" is dropped entirely, produces an empty list, and hits `continue`. The
// only half of "BK, Arsh Heer" that could ever match was the long one, and the
// artist's own channel (where the album's uploads live) could never satisfy it.
// The solo "BK" tracks passed for the opposite reason: with nothing left to
// judge on, `tried === 0` returns true and the artist check is skipped.
//
// This audit RUNS the shipped scArtistMatch — extracted from index.html by brace
// matching — against the exact live shapes, and pins the shape of the fix (a
// short-only credit may CONFIRM a source, never REJECT one).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

function extractFn(name) {
  const at = src.indexOf('function ' + name + '(');
  if (at === -1) throw new Error('no such function in index.html: ' + name);
  const start = (at >= 6 && src.slice(at - 6, at) === 'async ') ? at - 6 : at;
  const open = src.indexOf('{', start);
  let depth = 0;
  for (let k = open; k < src.length; k++) {
    const ch = src[k];
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) return src.slice(start, k + 1); }
  }
  throw new Error('unterminated function: ' + name);
}

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.8', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
  const headText = entries[0].items.join(' ');
  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');
  // Both channels share the head entry's first six items, and the Play channel
  // may not carry a downloader term at all.
  ok(!/\bdownload|converter|convert\b/i.test(headText), 'notes carry no downloader term (shared channel)');
  ok(/no matching source/.test(headText), 'the notes name the failure the user saw');
  // The old releases must still be below it, and in order.
  const rel617 = entries.find((e) => String(e.version) === '61.7');
  ok(!!rel617, 'the 61.7 entry is still in the changelog');
  ok(/brand-new release/.test((rel617 ? rel617.items : []).join(' ')), 'its wording survived the new head entry');
}
ok(sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

// ---------------------------------------------------------------------------
// The shipped function, driven directly.
// ---------------------------------------------------------------------------
console.log('[2] the artist check runs the shipped code');
const api = new Function(extractFn('scArtistMatch') + '\n;return { scArtistMatch };')();

console.log('[2a] the two albums the user reported');
// Scarface — "BK, Arsh Heer". The search returns the correct upload ("Scarface"
// on channel "BK", author "BK - Topic", the track's own 144 s) and the old check
// refused it on the artist test alone. Measured live.
ok(api.scArtistMatch('BK, Arsh Heer', 'BK - Topic', 'Scarface', 'BK', 'Scarface') === true,
  'BK, Arsh Heer — the artist own "- Topic" channel now verifies');
ok(api.scArtistMatch('BK, Arsh Heer', 'BK', 'BK - Scarface (Official Music Video) | Gangstas Paradise Album', 'BK', 'BK - Scarface (Official Music Video) | Gangstas Paradise Album') === true,
  'BK, Arsh Heer — the artist own channel verifies');
// IN THE STREETS — "BK, Jay 1", upload on channel "BK".
const iStreets = 'IN THE STREETS - BK | JAY TRAK (Official Video) Mixed Feelings EP | Latest Punjabi Songs 2023';
ok(api.scArtistMatch('BK, Jay 1', 'BK', iStreets, 'BK', iStreets) === true,
  'BK, Jay 1 — the artist own channel verifies');
// The reported tracks are found on the SHORTER half of the credit, not the longer.
ok(api.scArtistMatch('BK, Arsh Heer', 'Arsh Heer', 'x', 'Arsh Heer', '') === true,
  'the long half still verifies on its own (unchanged)');

console.log('[2b] a short credit can only ever CONFIRM, never REJECT');
// The whole point: `tried` must be untouched when a short-only credit does not
// match, so a solo short name keeps the old "nothing to judge on" answer. This
// is what makes the change safe — it can turn a refusal into an acceptance, and
// never the other way round.
ok(api.scArtistMatch('BK', 'Completely Unrelated Channel', 'x', 'Completely Unrelated Channel', '') === true,
  'a solo two-letter name still passes (unchanged, permissive)');
// …and a short-only credit that does not match does not count at all: it can
// never be the reason a source is thrown away, so a co-credit whose long half
// matches still verifies while the short half does not.
ok(api.scArtistMatch('BK, Arsh Heer', 'Arsh Heer Music', 'x', 'Arsh Heer Music', '') === true,
  'a non-matching short half never blocks the long half');
ok(api.scArtistMatch('BK, Arsh Heer', 'Coolio', "Gangsta's Paradise", 'Tommy Boy', 'x') === false,
  'a co-credit still refuses a source belonging to neither artist');
ok(api.scArtistMatch('The Weeknd', 'Random Reactions', 'y', 'Random Reactions', '') === false,
  'a long single credit is judged exactly as before');
ok(api.scArtistMatch('Diljit Dosanjh & Sia', 'Diljit Dosanjh - Topic', 'x', 'Diljit Dosanjh', '') === true,
  'the v60.1 co-credit case is untouched');

console.log('[2c] two letters are matched as a word, never inside one');
// "BKay Music" contains the letters, but not the name. A short token must never
// confirm on a substring, or any channel with those letters in its name could
// pass itself off as the artist.
ok(api.scArtistMatch('BK, Arsh Heer', 'BKay Music', 'Scarface', 'BKay Music', 'Scarface') === false,
  'BKay Music does not confirm as "BK"');
ok(api.scArtistMatch('BK, Arsh Heer', 'B K Music', 'Scarface', 'B K Music', 'Scarface') === false,
  'a split "B K" does not confirm as "BK"');

console.log('[2d] the dead "- Topic" gate is pinned, not leaned on');
// `topic` is computed from the NORMALIZED owner/author and norm() strips every
// non-alphanumeric, so the literal "- topic" suffix the test looks for can never
// survive ("BK - Topic" normalizes to "bk topic"). The two `topic &&` lines
// further down this function have therefore NEVER run on any build. That is
// pre-existing, not this release's doing, and is deliberately left alone here:
// switching it on widens what counts as the artist and deserves its own
// measurement. It is recorded in AGENTS.md; these two pins exist so it cannot
// drift or be mistaken for a working path.
ok(api.scArtistMatch('Someone Else', 'Some Label - Topic', 'Someone Else - Song', 'Some Label', 'Someone Else - Song') === false,
  'the "- Topic" title path stays unreachable (pre-existing; see AGENTS.md)');
ok(api.scArtistMatch('BK, Arsh Heer', 'BK - Topic', 'Scarface', 'BK', 'Scarface') === true,
  'the real Scarface upload verifies anyway — off the uploader NAME, not that gate');

console.log('[3] the fix is shaped as a confirm-only branch');
{
  const fn = extractFn('scArtistMatch');
  ok(fn.includes('var shortHit = function(blob){'), 'the short-token matcher is present');
  // `tried++` must only ever run for a credit that has a word longer than two
  // characters: that is the entire safety property.
  const words = fn.indexOf('var aWords = credit.split');
  const shortBranch = fn.indexOf('if(!aWords.length){');
  const triedUp = fn.indexOf('tried++;', words);
  ok(words !== -1 && shortBranch !== -1 && triedUp !== -1, 'the three anchors are in the function');
  ok(fn.indexOf('continue;', shortBranch) < triedUp, 'the short branch leaves before `tried++`');
  ok(/if\(shortHit\(ath\)\) return true;/.test(fn), 'it confirms on the real uploader');
  ok(!/topic/.test(fn.slice(fn.indexOf('var shortHit'), fn.indexOf('tried++;', fn.indexOf('var shortHit')))),
    'the short branch does not lean on the unreachable topic gate');
  ok(!/scTrackTitleKey|localStorage|fetch\(/.test(fn), 'the check stays pure — no storage, no network');
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
