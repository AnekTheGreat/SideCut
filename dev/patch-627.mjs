#!/usr/bin/env node
// SideCut — Album History: one row per album, no duplicates.
//
// The user's words: "When refetching new albums it shouldn't give duplicates there
// should be no duplicates and the tracks should be in order by newest to oldest in
// album history".
//
// WHERE THE DUPLICATES CAME FROM (measured, not guessed):
//   * `_albumKey` only stripped "(...)", so "Four You - EP" and "Four You" were two
//     different albums, and it kept the release year out of the key entirely in
//     `_dedupAlbums`, which was year-AWARE on purpose: "same title but a DIFFERENT
//     year = a genuinely different release — keep both". That carve-out is what
//     produced the rows the user photographed — "Making Memories" (2023-08-18) and
//     "Making Memories (Un…" (2024-01-26) collapse to the same key and were both
//     kept because the years differ.
//   * There are FOUR sources per artist (iTunes across four storefronts, a term
//     search, Deezer, MusicBrainz) plus an AI lookup, and each one files the same
//     album under a different title and/or year, so the year carve-out fired
//     constantly.
//   * The AI path was the only source with NO noise filter at all, and its prompt
//     literally asks for "deluxe/special editions as separate items".
//
// WHAT THIS CHANGES — one identity, one row:
//   1. `_albumKey` becomes edition-insensitive: parentheses plus a trailing
//      " - EP / - Single / - Deluxe / - Remastered / …" marker are stripped, so
//      every edition of an album shares a key.
//   2. `_dedupAlbums` drops the year carve-out: one row per identity, always. The
//      first row wins (sources run best-first) and a later duplicate only fills in
//      an artwork, a track count or a date the kept row was missing. "there should
//      be no duplicates" is taken literally, which DOES reverse the deliberate
//      keep-both-years rule from an earlier release.
//   3. The AI results get the same noise filter every API source already had.
//   4. The album total is recounted after the fetch from the lists as they now
//      stand, so the toast and the "N albums from M artists" line count the rows
//      you can actually see.
//
// This fixes every path at once: `_dedupAlbums` runs on the per-artist single
// refetch (~27521), on the cached seed before a refetch (~27703), incrementally in
// fetchOneArtist (~27924) and again on every render (~28002).
//
//   node dev/patch-627.mjs              # index.html only
//   node dev/patch-627.mjs --manifest   # re-seed root manifest.json from ota/updates.json
//
// Idempotent: every edit carries its own marker, and the single write is at the end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. One album identity: an edition is the same album.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('Album History — the album key ignores edition markers',
    "  var t = a && a.collectionName ? a.collectionName.toLowerCase().replace(/\\([^)]*\\)/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\\s+/g,' ').trim() : '';",
    [
      "  // The one identity shared by every dedupe in this file. Editions of the same",
      "  // album have to collapse into one row: the sources file them under slightly",
      "  // different titles (\"Four You\" vs \"Four You - EP\", \"… (Deluxe)\", \"… -",
      "  // Remastered\"), and the AI lookup is asked for special editions as separate",
      "  // items.",
      "  var t = a && a.collectionName ? a.collectionName.toLowerCase()",
      "    .replace(/\\([^)]*\\)/g,'')",
      "    .replace(/\\s*[-\\u2013\\u2014]\\s*(ep|single|deluxe|expanded|special|bonus|explicit|clean|remaster(ed)?|re-?recorded|version|edition|anniversary|reissue|re-?release)\\b.*$/,'')",
      "    .replace(/[^a-z0-9 ]/g,'').replace(/\\s+/g,' ').trim() : '';"
    ].join('\n'),
    1, '(ep|single|deluxe|expanded|special|bonus|explicit|clean|remaster(ed)?|re-?recorded|version|edition|anniversary|reissue|re-?release)');

  // -------------------------------------------------------------------------
  // 2. The dedupe itself: one row per identity, whatever year a source printed.
  //    Replaced by locating the function, because the old comment carries an em
  //    dash and an apostrophe that are easy to mistype in a needle.
  // -------------------------------------------------------------------------
  const START = 'function _dedupAlbums(arr){';
  const END = '\n}\n\nfunction _renderAhFromData(artistAlbums){';
  const MARKER = 'ONE row per album identity, and the release YEAR is deliberately ignored';
  if (src.indexOf(MARKER) !== -1) skip('Album History — the dedupe keeps one row per album');
  else {
    const i = src.indexOf(START);
    if (i === -1) throw new Error('dedupe: could not find ' + START);
    const j = src.indexOf(END, i);
    if (j === -1) throw new Error('dedupe: could not find the end of _dedupAlbums');
    const NEW_FN = String.raw`function _dedupAlbums(arr){
  if(!Array.isArray(arr)) return arr;
  // ONE row per album identity, and the release YEAR is deliberately ignored:
  // a second row for the same album is always wrong, whatever year a source put
  // on it, and that is what "there should be no duplicates" means. Sources file
  // the same album under different titles and different years, and the AI lookup
  // is explicitly asked for deluxe/special editions as separate items. The first
  // row wins — the sources run best-first (iTunes, Deezer, MusicBrainz, then AI) —
  // and a later duplicate only fills in what the kept row was missing.
  var seen = {}, out = [];
  for(var i=0;i<arr.length;i++){
    var a = arr[i];
    if(!a || !a.collectionName) continue;
    var k = _albumKey(a);
    var kept = seen[k];
    if(kept){
      if(!kept.artworkUrl100 && a.artworkUrl100) kept.artworkUrl100 = a.artworkUrl100;
      if(!kept.trackCount && a.trackCount) kept.trackCount = a.trackCount;
      if(!kept.releaseDate && a.releaseDate) kept.releaseDate = a.releaseDate;
      continue;
    }
    seen[k] = a;
    out.push(a);
  }
  return out;
}`;
    // j points at the END marker, which STARTS with the old function's closing
    // brace: skip those two characters or the function keeps a stray "}".
    src = src.slice(0, i) + NEW_FN + src.slice(j + 2);
    done('Album History — the dedupe keeps one row per album');
  }

  // -------------------------------------------------------------------------
  // 3. The AI lookup is a source too: give it the noise filter every API has.
  // -------------------------------------------------------------------------
  sub('Album History — the AI results are noise-filtered like every other source',
    '              if(!_aiA || !_aiA.title) continue;',
    '              if(!_aiA || !_aiA.title) continue;\n'
    + '              if(noise.test(_aiA.title)) continue;   // the same junk filter the API sources get',
    1, 'the same junk filter the API sources get');

  // -------------------------------------------------------------------------
  // 4. Recount the albums after the fetch so the count matches the rows on screen.
  // -------------------------------------------------------------------------
  sub('Album History — the album total is recounted from the merged lists',
    '  await Promise.all(workers);\n  window.__ahFetching = false;',
    '  await Promise.all(workers);\n'
    + '  // Recount from the lists as they now stand: a duplicate the merge collapsed\n'
    + '  // no longer inflates the total, so the count matches the rows on screen.\n'
    + '  try{ totalAlbums = Object.keys(artistAlbums).reduce(function(n,k){ return n + ((artistAlbums[k]||[]).length); }, 0); }catch(_eCnt){}\n'
    + '  window.__ahFetching = false;',
    1, 'a duplicate the merge collapsed');

  fs.writeFileSync(FILE, src);
  console.log('patch-627: ' + edits + ' index.html edit(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-627 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
