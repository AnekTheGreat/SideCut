#!/usr/bin/env node
// SideCut v62 — lyrics for an artist whose name is only a letter or two.
//
// The report, in the user's words: "I'm not getting any lyrics for lesser known
// artists such as Bikramjit Dhaliwal".
//
// MEASURED FIRST, and it reframed the whole thing (Sep 25, 2026):
//   * lrclib `search?q=Bikramjit` -> 0 results. `search?artist_name=Bikramjit
//     Dhaliwal` -> 0 results. He is not filed under that name anywhere.
//   * "Bikramjit Dhaliwal" is the WRITER credit, not the performer. The artist
//     is "BK" — the same artist whose albums the v61.8 fix was about. lrclib
//     files his songs under "BK": `/api/get?artist_name=BK&track_name=Mob Ties
//     (Intro)` -> 200, `.../MOTION` -> 200, `.../Aaja Billo` -> 200, and
//     `search?track_name=` turns up "Icy" by "BK & Jay Trak", "MOTION" by "BK".
//   * The two "Genius-derived" fallbacks the file still carries are dead for
//     anonymous callers: some-random-api -> 403 `{"error":"key required"}`,
//     lyrist.vercel.app -> 429. Re-measured this session.
//
// So the entries were THERE and the app refused them. Driving the SHIPPED
// matcher — lifted out of index.html, run against live lrclib answers
// (dev/_probe_rank.mjs, since deleted) — with the entry's own title, the
// artist's own name and the track's own length:
//
//   entry "Mob Ties (Intro)" by "BK" 168s, tag "BK", drift +0s -> ACCEPT
//   entry "Mob Ties (Intro)" by "BK" 168s, tag "BK", drift +3s -> refuse
//   entry "Mob Ties (Intro)" by "BK" 168s, tag "Bikramjit Dhaliwal" -> refuse
//
// Both refusals are the SAME defect as v61.8, in the lyric matcher instead of
// the artist check: **a name of two letters or fewer is dropped, so it can
// neither confirm nor be compared.** `scLyricsRank` builds `aHit` from tokens of
// three or more characters, so "BK" contributed nothing and acceptance rested on
// a length within 2 s alone — any re-encode that drifted 3 s read as "no lyrics"
// even though the artist's own name was on the entry. `scLyricsArtistVerdict`
// filters our tokens to >=3 AND skips the entry's tokens below 3, so an entry
// filed under "BK" could never say 'match', and the comparison fell through to
// 'foreign' — a hard refusal.
//
// The fix is v61.8's rule, applied to lyrics: **a name of two letters or fewer
// can CONFIRM but never REJECT.** It is matched word for word — never as a
// substring, or a two-letter tag would hit inside unrelated names — and it only
// ever counts when the credit has no longer word to go on, so "DJ Snake" still
// cannot be confirmed by "DJ Khaled". Strictly additive: every path that already
// found lyrics behaves exactly as it did.
//
//   node dev/patch-620.mjs              # code fix + release metadata
//   node dev/patch-620.mjs --manifest    # re-seed root manifest.json from ota/updates.json
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

const VER = '62';
const PREV = '61.9';
const STAMP = 'September 25, 2026 · 7:45 PM EDT';
const PREV_STAMP = 'September 25, 2026 · 6:05 PM EDT';

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

// ---------------------------------------------------------------------------
// 1. A short credit can CONFIRM an entry — never REJECT one.
//
// `scLyricsArtistVerdict` decides whether an entry's credit and ours are the
// same artist. Both of its sides dropped a short name, so an entry filed under
// "BK" came back 'foreign' against the writer credit and was refused outright.
// ---------------------------------------------------------------------------
const OLD_VERDICT = [
  "    if(!ours.length) return 'unknown';                // our tag is a label, a channel or blank",
  '    var theirs = scLyricsArtistTokens(cand);',
  '    for(var i = 0; i < theirs.length; i++){',
  '      var t = theirs[i];',
  '      if(t.length < 3 || SC_LYRICS_STOPWORDS[t]) continue;',
  '      for(var j = 0; j < ours.length; j++){',
  '        var o = ours[j];',
  "        if(t === o) return 'match';",
  '        // Transliteration drift ("Gurdas"/"Gurdaas") is the same person, so a',
  '        // long shared prefix has to count as agreement rather than a stranger.',
  '        var pre = 0, n = Math.min(t.length, o.length);',
  '        while(pre < n && t.charAt(pre) === o.charAt(pre)) pre++;',
  "        if(pre >= 5 && n >= 5) return 'match';",
  '      }',
  '    }',
  "    return 'foreign';"
].join('\n');

const NEW_VERDICT = [
  '    var theirs = scLyricsArtistTokens(cand);',
  '    // 62 — a name of two letters or fewer can CONFIRM but never REJECT: the',
  '    // rule the downloader\'s artist check got in 61.8, and for the same',
  '    // reason. BOTH sides of this function dropped such a name — `ours` above',
  '    // keeps only words of three or more, and the entry\'s tokens are skipped',
  '    // below for the same reason — so a tag like "BK" had no say in whether an',
  '    // entry was ours, and an entry filed under "BK" could not agree with any',
  '    // credit at all: the comparison fell straight through to \'foreign\'.',
  '    // Measured on lrclib\'s own entries (Sep 25, 2026): the entry\'s own',
  '    // title, the artist\'s own name on the entry, and still a hard refusal.',
  '    var mineShort = [];',
  '    for(var s0 = 0; s0 < (artistTokens || []).length; s0++){',
  '      var sw = artistTokens[s0];',
  '      if(sw.length > 0 && sw.length < 3 && !SC_LYRICS_STOPWORDS[sw] && !SC_LYRICS_IMPRINT_TOKENS[sw]) mineShort.push(sw);',
  '    }',
  '    if(!ours.length){',
  '      // Nothing long enough here to judge on, so a short name may only ever',
  '      // AGREE — word for word, never as a substring.',
  '      for(var s1 = 0; s1 < mineShort.length; s1++){',
  '        for(var s2 = 0; s2 < theirs.length; s2++) if(theirs[s2] === mineShort[s1]) return \'match\';',
  '      }',
  "      return 'unknown';                              // a label, a channel, a short name or blank",
  '    }',
  '    for(var i = 0; i < theirs.length; i++){',
  '      var t = theirs[i];',
  '      if(t.length < 3 || SC_LYRICS_STOPWORDS[t]) continue;',
  '      for(var j = 0; j < ours.length; j++){',
  '        var o = ours[j];',
  "        if(t === o) return 'match';",
  '        // Transliteration drift ("Gurdas"/"Gurdaas") is the same person, so a',
  '        // long shared prefix has to count as agreement rather than a stranger.',
  '        var pre = 0, n = Math.min(t.length, o.length);',
  '        while(pre < n && t.charAt(pre) === o.charAt(pre)) pre++;',
  "        if(pre >= 5 && n >= 5) return 'match';",
  '      }',
  '    }',
  '    // The entry\'s own credit carries no word long enough to be read as a',
  '    // DIFFERENT artist, so it cannot contradict ours either — it says nothing.',
  '    // Returning \'foreign\' here (which is what used to happen, because the',
  '    // loop above skips short tokens and then falls through) was a refusal',
  '    // built on a name too short to be evidence of anything.',
  '    for(var k = 0; k < theirs.length; k++){',
  '      if(theirs[k].length >= 3 && !SC_LYRICS_STOPWORDS[theirs[k]]) return \'foreign\';',
  '    }',
  "    return 'unknown';"
].join('\n');

// ---------------------------------------------------------------------------
// 2. A short credit can CONFIRM an entry, in the scorer.
//
// `aHit` is what makes an entry acceptable without a length match. It was built
// from tokens of three or more characters, so a tag like "BK" could never produce
// one — and acceptance rested on the length being within 2 s.
// ---------------------------------------------------------------------------
const OLD_RANK = [
  '    var rTokens = scLyricsArtistTokens(res.artistName);',
  '    var strong = 0, weak = 0;',
  '    artistTokens.forEach(function(w){',
  '      if(w.length < 3 || SC_LYRICS_STOPWORDS[w]) return;',
  '      if(rTokens.indexOf(w) === -1) return;',
  '      if(w.length >= 4) strong++; else weak++;',
  '    });',
  '    var aHit = strong >= 1 || weak >= 2;'
].join('\n');

const NEW_RANK = [
  '    var rTokens = scLyricsArtistTokens(res.artistName);',
  '    var strong = 0, weak = 0;',
  '    var longWords = 0;',
  '    artistTokens.forEach(function(w){',
  '      if(w.length < 3 || SC_LYRICS_STOPWORDS[w]) return;',
  '      longWords++;',
  '      if(rTokens.indexOf(w) === -1) return;',
  '      if(w.length >= 4) strong++; else weak++;',
  '    });',
  '    // 62 — a credit whose every word is SHORT ("BK") was dropped right here, so',
  '    // it could never confirm an entry and the whole match rested on a length',
  '    // within 2 s: the entry\'s own title, the artist\'s own name, 3 s of drift,',
  '    // and the song was reported as having no lyrics. Such a credit can confirm',
  '    // now — word for word, never as a substring — and ONLY when the credit has',
  '    // no longer word to go on, so "DJ Snake" still cannot be confirmed by',
  '    // "DJ Khaled". A long credit is scored exactly as it was.',
  '    var shortHit = false;',
  '    if(!longWords){',
  '      for(var sw1 = 0; sw1 < artistTokens.length; sw1++){',
  '        var sh = artistTokens[sw1];',
  '        if(sh.length === 0 || sh.length >= 3 || SC_LYRICS_STOPWORDS[sh]) continue;',
  '        if(rTokens.indexOf(sh) !== -1){ shortHit = true; break; }',
  '      }',
  '    }',
  '    var aHit = strong >= 1 || weak >= 2 || shortHit;'
].join('\n');

if (!MANIFEST_ONLY) {
  sub('lyric artist check — a short credit confirms an entry, never refuses one',
    OLD_VERDICT, NEW_VERDICT, 1, 'var mineShort = [];');
  sub('lyric scorer — a short credit can count as an artist hit',
    OLD_RANK, NEW_RANK, 1, 'var shortHit = false;');
}

// ---------------------------------------------------------------------------
// 3. Release metadata: APP_VERSION + the 62 changelog head.
//
// NOTE on wording: the head entry's first six items become the OTA patch notes
// for BOTH channels, and dev/test-60510 + dev/test-6058 forbid a
// converter/downloader term there. Keep every note free of download*, convert*,
// "to mp3", "get song", "no source found" and "play build".
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + PREV + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  const ENTRY = [
    "  { version: '" + VER + "', date: '" + STAMP + "', title: 'Lyrics are found again for an artist whose name is only a letter or two', items: [",
    "    'Lyrics could go missing for an artist whose name is only a letter or two — a stage name like \"BK\". The check that decides whether a lyric entry really belongs to the artist skipped every name of two letters or fewer, so such a name could never confirm anything, and the song had to match on running time alone: any release whose length drifted by more than two seconds came back as having no lyrics even though the words were on file.',",
    "    'Such a name counts now. It is matched word for word, never as part of a longer word, and only ever to CONFIRM an entry — it can never be the reason one is turned down, so no song that already found its lyrics can lose them.',",
    "    'The same rule now covers the credit on the other side of the lookup: an entry filed under a one- or two-letter name can no longer be read as \"a different artist\" and thrown away.',",
    "    'Nothing was loosened for ordinary names. The title still has to line up, a full artist credit that contradicts ours is still refused, and a plain running-time match still has to be within two seconds. Only a name too short to carry a name can confirm without being able to contradict.',",
    "    'Measured before and after on the artist this was reported for, against the live database: songs the database files under that artist and that still came back empty are found now.',",
    "    'Nothing else moved — playback, playlists, covers, the drop check, the exports and the search behave exactly as they did.',",
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
// 4. sw.js cache name.
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
// 5. Repin the repo-wide release assertions.
//
// `version: '61.9'` mentions in the CHANGELOG are deliberately NOT touched: they
// name the historical entry the ordering assertions compare against.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + PREV + "'", "ver === '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + PREV + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + PREV + "', '" + PREV + " heads the changelog'",
     "entries[0].version === '" + VER + "', '" + VER + " heads the changelog'"],
    ["entries[0].date === '" + PREV_STAMP + "'", "entries[0].date === '" + STAMP + "'"],
    ["'the " + PREV + " entry heads the changelog'", "'the " + VER + " entry heads the changelog'"]
  ];
  // test-6137/test-6138 pin the head entry with a REGEX literal, where the dot is
  // escaped (version: '61\.9'). A plain string repin never sees that form, and
  // the new version has no dot to escape.
  const BS = String.fromCharCode(92);
  REPINS.push(["version: '61" + BS + ".9'", "version: '" + VER + "'"]);

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
  console.log('patch-620: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel so
// the two never disagree about the version. Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-620 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
