#!/usr/bin/env node
// SideCut v61.8 — a co-credited song is found on the artist's own channel again.
//
// The report, in the user's words: "Tried on 2 different albums and came back no
// matching source fix this" / "I tried 2 different albums and both of them have
// no source found".
//
// Measured live on Sep 25, 2026 with dev/_probe_convert.mjs (the shipped search +
// verify pipeline, lifted out of index.html and driven against the real
// network) on the two albums the user named — BK's "Gangstas Paradise" and
// "MIXED FEELINGS":
//
//   Mob Ties (Intro) / BK              -> FOUND
//   In God We Trust  / BK              -> FOUND
//   Scarface         / BK, Arsh Heer   -> null  "no matching source"
//   LIFESTYLE        / BK              -> FOUND
//   IN THE STREETS   / BK, Jay 1       -> null  "no matching source"
//
// The split is not random: the two that fail are exactly the multi-artist
// credits, and dev/_probe_bk.mjs showed why. For Scarface, the CORRECT upload
// ("Scarface" by channel "BK", author "BK - Topic", 144 s — the track's own
// length) is returned by the search, passes scTitleMatch, passes the length
// gate, and is refused by scArtistMatch alone. For IN THE STREETS the same: the
// right upload on channel "BK" is refused by scArtistMatch alone.
//
// Root cause, in scArtistMatch: each credited artist is judged on its own (v60.1
// fixed the "all words must appear in one channel name" bug), but the word list
// for a credit is built with
//
//     credit.split(' ').filter(w => w.length > 2 && ...)      // stop-word rule
//
// A two-letter artist name is therefore dropped: the "BK" half of "BK, Arsh
// Heer" produces an empty list, hits `continue`, and is never looked at. So the
// ONLY half of that credit that could ever match was the long one, and the
// artist's own channel — where the album's uploads actually live — could never
// satisfy it. (The solo "BK" credits passed for the opposite reason: with
// nothing left to judge on, `tried === 0` returns true and the check is skipped
// entirely — which is also why the bug looked like "some tracks work, some
// don't" rather than a broken song lookup.)
//
// The fix: a credit whose every word is short may CONFIRM a source but never
// REJECT one. Word-for-word only (two letters would otherwise hit inside
// unrelated words), and when it does not match it counts for nothing — `tried`
// is untouched — so a single short name keeps the old "nothing to judge on"
// answer and every path that already worked is byte-for-byte unchanged in
// behaviour. The change can therefore only ever turn a refusal into an
// acceptance; it can never turn an acceptance into a refusal.
//
//   node dev/patch-618.mjs               # code fix + release metadata
//   node dev/patch-618.mjs --manifest     # re-seed root manifest.json from ota/updates.json
//
// Every index.html edit is count==1 asserted and idempotent, and the write
// happens once at the end, so a bad needle can never half-apply and a rerun is
// a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '61.8';
const PREV = '61.7';
const STAMP = 'September 25, 2026 · 4:15 PM EDT';
const PREV_STAMP = 'September 25, 2026 · 2:50 PM EDT';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

// `marker` is a short, stable string that exists ONLY after the edit, so
// reworded prose (or an already-applied pass) can never make a rerun throw.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) {
    throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  }
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Same, but missing text is not an error and an already-applied change is
// skipped: used to carry a wording an earlier pass of this same script wrote
// while the fix was still being worked out, so the file and this script always
// end up saying the same thing.
function subOpt(label, oldStr, newStr, want, marker) {
  if (marker && marker !== '' && src.indexOf(marker) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got === 0) return skip(label + ' (not present)');
  if (want !== undefined && got !== want) {
    throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  }
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. A short artist name can confirm a source, never reject one.
// ---------------------------------------------------------------------------
const OLD_WORDS = [
  "      var aWords = credit.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and' && w !== 'feat'; });",
  '      if(!aWords.length) continue;',
  '      tried++;'
].join('\n');

const NEW_WORDS = [
  '      // A credit whose every word is short — the "BK" in "BK, Arsh Heer" — was',
  '      // dropped right here by the >2-char stop-word rule, so only the LONG half',
  '      // of the credit could ever match. An artist\'s own channel and their',
  '      // "- Topic" auto-channel are exactly where an album\'s uploads live, so a',
  '      // co-credited track whose source sits on the short-named artist could',
  '      // never verify. Measured live (Sep 25, 2026) on BK\'s "Gangstas Paradise"',
  '      // and "MIXED FEELINGS": the correct upload (channel "BK", author',
  '      // "BK - Topic", the track\'s own title, the track\'s own length) was',
  '      // refused by this check alone, which is the whole of "no matching source".',
  '      //',
  '      // A token that short is too weak to REJECT a source on — an upload on a',
  '      // label channel that never prints the name would be thrown away — but it',
  '      // must be able to CONFIRM one. So a short-only credit is matched',
  '      // word-for-word (never as a substring, which two letters would also hit',
  '      // inside unrelated words) and, when it does not match, it simply counts',
  '      // for nothing: `tried` is untouched, so a single short name like "BK"',
  '      // keeps the old "nothing to judge on" answer and no track that already',
  '      // worked can start failing. The change can only ever turn a refusal into',
  '      // an acceptance, never the other way round.',
  '      //',
  '      // NOTE, pre-existing and deliberately left alone: the `topic` gate this',
  '      // function also carries is DEAD. `topic` is computed from the NORMALIZED',
  '      // owner/author, and norm() strips every non-alphanumeric, so the literal',
  '      // "- topic" suffix the test looks for can never survive ("BK - Topic"',
  '      // normalizes to "bk topic"). That path has therefore never run on any',
  '      // build. Switching it on would widen what counts as the artist — a change',
  '      // of its own, with its own measurement — so it is recorded in AGENTS.md',
  '      // instead of being turned on in the middle of this fix.',
  "      var aWords = credit.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and' && w !== 'feat'; });",
  '      if(!aWords.length){',
  "        var sWords = credit.split(' ').filter(function(w){ return w.length > 0; });",
  '        if(!sWords.length) continue;',
  '        var shortHit = function(blob){',
  '          if(!blob) return false;',
  "          var bWords = blob.split(' ');",
  '          for(var si = 0; si < sWords.length; si++){',
  '            var hitOne = false;',
  '            for(var sj = 0; sj < bWords.length; sj++){',
  '              if(bWords[sj] === sWords[si]){ hitOne = true; break; }',
  '            }',
  '            if(!hitOne) return false;',
  '          }',
  '          return true;',
  '        };',
  '        if(shortHit(ath)) return true;                 // the artist\'s own channel',
  '        continue;                                      // confirm-only: never reject',
  '      }',
  '      tried++;'
].join('\n');

if (!MANIFEST_ONLY) {
  sub('artist check — a short credit confirms a source, never rejects one',
    OLD_WORDS, NEW_WORDS, 1, 'var shortHit = function(blob){');

  // The first pass of this fix wrote the short branch with a
  // `topic && (shortHit(ct) || shortHit(vt))` clause, before the `topic` gate it
  // leaned on was measured and found unreachable. Bring that intermediate
  // wording to the final one. A no-op on a tree that never carried it.
  const NOTE = [
    '      //',
    '      // NOTE, pre-existing and deliberately left alone: the `topic` gate this',
    '      // function also carries is DEAD. `topic` is computed from the NORMALIZED',
    '      // owner/author, and norm() strips every non-alphanumeric, so the literal',
    '      // "- topic" suffix the test looks for can never survive ("BK - Topic"',
    '      // normalizes to "bk topic"). That path has therefore never run on any',
    '      // build. Switching it on would widen what counts as the artist — a change',
    '      // of its own, with its own measurement — so it is recorded in AGENTS.md',
    '      // instead of being turned on in the middle of this fix.',
    ''
  ].join('\n');
  subOpt('artist check — the short branch stops leaning on the dead topic gate',
    '        if(topic && (shortHit(ct) || shortHit(vt))) return true;\n', '', 1);
  subOpt('artist check — the dead topic gate is written down',
    '      // an acceptance, never the other way round.\n',
    '      // an acceptance, never the other way round.\n' + NOTE, 1,
    '"- topic" suffix the test looks for can never survive');
}

// ---------------------------------------------------------------------------
// 2. Release metadata: APP_VERSION + the 61.8 changelog head.
//
// NOTE on wording: the head entry's first six items become the OTA patch notes
// for BOTH channels, and dev/test-60510 + dev/test-6058 forbid a
// converter/downloader term there. Keep every note free of download*, convert*,
// "to mp3", "get song", "no source found" and "play build".
//
// The entry is CONTENT-COMPARED rather than insert-only: a release gets written
// more than once while it is being put together, and a later wording has to be
// able to replace an earlier one (patch-615/616/617 did the same).
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + PREV + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  const ENTRY = [
    "  { version: '" + VER + "', date: '" + STAMP + "', title: 'A song credited to two artists is saved again, even when the right upload sits on the artist with the shorter name', items: [",
    "    'A track credited to two artists could come back with nothing even when the right source had been found: the check that decides whether a source really belongs to the artist skipped every name of two letters or fewer, so the \"BK\" half of a credit like \"BK, Arsh Heer\" was never looked at at all. On Gangstas Paradise, where the correct upload sits on BK\\'s own channel, every co-credited track ended in \"no matching source\" while the solo tracks went through.',",
    "    'The rule is unchanged bar one correction: a name that short cannot be allowed to REFUSE a source — an upload on a label channel that never prints the artist\\'s name would be thrown away — but it must be able to ACCEPT one. A short-only credit is matched word for word now, so it can only ever let a source through, never turn one down.',",
    "    'Nothing else was loosened. A longer credit is judged exactly as before, a source that belongs to none of the credited artists is still refused, and a solo short name like \"BK\" with nothing to compare it against still passes — so no track that already worked can start failing.',",
    "    'A short name is only ever matched as a whole word, never inside a longer one, so a channel that merely has those two letters buried in its name cannot pass itself off as the artist.',",
    "    'The checks that decide which audio may be used are untouched: the title still has to line up, the source still has to run to the same length as the track, and nothing is saved under a track\\'s own tags unless both of them agree.',",
    "    'Nothing else moved — playback, playlists, lyrics, covers, the drop check, the exports and the search behave exactly as they did.',",
    '  ] },'
  ].join('\n');

  const start = src.indexOf("  { version: '" + VER + "',");
  if (start !== -1) {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the ' + VER + ' entry');
    const tail = '\n  ] },'.length;
    const cur = src.slice(start, end + tail);
    const norm = (s) => s.replace(/\s+/g, ' ');
    if (norm(cur) === norm(ENTRY)) skip('CHANGELOG ' + VER + ' entry');
    else { src = src.slice(0, start) + ENTRY + src.slice(end + tail); done('CHANGELOG ' + VER + ' entry rewritten'); }
  } else {
    sub('CHANGELOG head — ' + VER + ' entry',
      "const CHANGELOG = [\n  { version: '" + PREV + "',",
      "const CHANGELOG = [\n" + ENTRY + "\n  { version: '" + PREV + "',", 1,
      "  { version: '" + VER + "', date: '");
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 3. sw.js cache name.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + PREV + "';";
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + VER + "';";
  if (sw.includes(newSw)) console.log('= sw.js CACHE_NAME (already ' + VER + ')');
  else {
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> v' + VER);
  }
}

// ---------------------------------------------------------------------------
// 4. Repin the repo-wide release assertions.
//
// `version: '61.7'` mentions in the CHANGELOG are deliberately NOT touched: they
// name the historical entry the ordering assertions compare against.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + PREV + "'", "ver === '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + PREV + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + PREV + "', '" + PREV + " heads the changelog'",
     "entries[0].version === '" + VER + "', '" + VER + " heads the changelog'"],
    ["entries[0].date === '" + PREV_STAMP + "'", "entries[0].date === '" + STAMP + "'"]
  ];
  // test-6137/test-6138 pin the head entry with a REGEX literal, where the dot
  // is escaped (version: '61\\.7'). A plain string repin never sees that form.
  // The backslash is built from a char code so no layer in between can eat it.
  const BS = String.fromCharCode(92);
  REPINS.push(["version: '61" + BS + ".7'", "version: '61" + BS + ".8'"]);

  // test-617 pinned the HEAD entry's own wording ("brand-new release" /
  // "re-checks"), which is 61.7's prose and is about to be displaced by 61.8.
  // Exactly the same repin test-617 did to test-616: read the release's OWN
  // entry instead of the head, keeping the head-side guards on the head.
  REPINS.push([
    [
      "  const headText = entries[0].items.join(' ');",
      "  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');",
      "  ok(!/\\bdownload|converter|convert\\b/i.test(headText), 'notes carry no downloader term (shared channel)');",
      "  ok(/brand-new release/.test(headText) && /re-checks/.test(headText), 'the notes say a new release is looked up again');"
    ].join('\n'),
    [
      "  const headText = entries[0].items.join(' ');",
      "  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');",
      "  ok(!/\\bdownload|converter|convert\\b/i.test(headText), 'notes carry no downloader term (shared channel)');",
      "  // 61.8 heads the changelog now, so the wording this release introduced is",
      "  // read from its own entry rather than from the head (the same repin 61.7",
      "  // applied to 61.6).",
      "  const rel617 = entries.find((e) => String(e.version) === '61.7');",
      "  ok(!!rel617, 'the 61.7 entry is still in the changelog');",
      "  const relText = (rel617 ? rel617.items : []).join(' ');",
      "  ok(/brand-new release/.test(relText) && /re-checks/.test(relText), 'the 61.7 notes say a new release is looked up again');"
    ].join('\n')
  ]);

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (t.indexOf(a) === -1) continue;
      t = t.split(a).join(b);
      repinned++;
      console.log('• ' + name + ' — ' + a.split('\n')[0].slice(0, 46));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-618: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel so
// the two never disagree about the version. Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-618 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
