#!/usr/bin/env node
// dev/patch-downloader.mjs — patches index.html for album-aware downloading
// and correct track ordering. Safe to re-run (idempotent).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
const original = src;
let changes = 0;

// 1. scYtSearch: add albumHint parameter
if (!src.includes('scYtSearch(query, artistHint, albumHint)')) {
  src = src.replace(
    'async function scYtSearch(query, artistHint){',
    'async function scYtSearch(query, artistHint, albumHint){'
  );
  changes++;
}

// 2. scYtSearch: add album context scoring
if (!src.includes('albumNorm = normArtist(albumHint)')) {
  src = src.replace(
    "      var artistNorm = normArtist(artistHint);\n      var artistWords = artistNorm.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and'; });",
    "      var artistNorm = normArtist(artistHint);\n      var albumNorm = normArtist(albumHint);\n      var albumWords = albumNorm.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and'; });\n      var artistWords = artistNorm.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and'; });"
  );
  changes++;
}

// 3. scYtSearch: add album hit scoring after whole phrase check
if (!src.includes('albumHits')) {
  src = src.replace(
    "        if(t.indexOf(q) !== -1) score += 8;                     // whole phrase present\n        if(/lyric|karaoke",
    "        if(t.indexOf(q) !== -1) score += 8;                     // whole phrase present\n        if(albumNorm){\n          var albumHits = 0;\n          for(var abw = 0; abw < albumWords.length; abw++) if(t.indexOf(albumWords[abw]) !== -1) albumHits++;\n          if(albumHits >= Math.min(2, albumWords.length)) score += 18;\n          else if(albumHits > 0) score += 5;\n        }\n        if(/lyric|karaoke"
  );
  changes++;
}

// 4. Spotify embed track list: preserve source position
if (!src.includes('er.trackNumber || er.track_number')) {
  src = src.replace(
    '              position: eTracks.length + 1',
    "              // Preserve the source track number even if an earlier row was skipped.\n              position: Number(er.trackNumber || er.track_number || er.position || (et + 1)) || (et + 1)"
  );
  changes++;
}

// 5. scSpToBuffer: include album in query
if (!src.includes("var album = meta.album || '';")) {
  src = src.replace(
    "    var title = meta.title || '', artist = meta.artist || '';\n    var query = ((title + ' ' + artist).trim());",
    "    var title = meta.title || '', artist = meta.artist || '';\n    var album = meta.album || '';\n    var query = ((title + ' ' + artist + ' ' + album).trim());"
  );
  changes++;
}

// 6. scSpToBuffer: pass album to scYtSearch calls
if (!src.includes("scYtSearch(query, artist, album)")) {
  src = src.replace(
    '    var cands = await scYtSearch(query, artist);',
    '    var cands = await scYtSearch(query, artist, album);'
  );
  changes++;
}

// 7. scSpToBuffer: album in audio fallback search
if (!src.includes("artist + ' ' + album + ' audio'")) {
  src = src.replace(
    "try{ cands2 = await scYtSearch(title + ' ' + artist + ' audio', artist)",
    "try{ cands2 = await scYtSearch(title + ' ' + artist + ' ' + album + ' audio', artist, album)"
  );
  changes++;
}

// 8. scSpToBuffer: album in quoted-title search
if (!src.includes("album ? ' \\\"' + album + '\\\"' : ''")) {
  src = src.replace(
    "var q2 = await scYtSearch('\\\\\"' + title + '\\\\\" ' + artist, artist);",
    "var q2 = await scYtSearch('\\\\\"' + title + '\\\\\" ' + artist + (album ? ' \\\\\"' + album + '\\\\\"' : ''), artist, album);"
  );
  changes++;
}

// 9. Batch convert: sort selected indices top-to-bottom
if (!src.includes('idx.sort(function(a, b){ return a - b; })')) {
  src = src.replace(
    "              var chosen = idx.map(function(ix){ return plan.tracks[ix]; }).filter(Boolean);",
    "              idx.sort(function(a, b){ return a - b; });\n              var chosen = idx.map(function(ix){ return plan.tracks[ix]; }).filter(Boolean);"
  );
  changes++;
}

// 10. RGB tick: smooth 50ms (20fps) instead of 100ms (10fps)
if (!src.includes('const RGB_TICK_MS = 50;')) {
  src = src.replace(
    '  const RGB_TICK_MS = 100;',
    '  // 20 updates/sec keeps RGB smooth without a full-vsync render loop.\n  const RGB_TICK_MS = 50;'
  );
  changes++;
}

// 11. Bump version to 60.3.0
if (src.includes("const APP_VERSION = '60.2.0'")) {
  src = src.replace("const APP_VERSION = '60.2.0'", "const APP_VERSION = '60.3.0'");
  changes++;
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`patch-downloader: applied ${changes} patch(es) to index.html`);
} else {
  console.log('patch-downloader: all patches already applied, nothing to do');
}
