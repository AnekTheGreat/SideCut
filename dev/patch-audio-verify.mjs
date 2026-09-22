#!/usr/bin/env node
// dev/patch-audio-verify.mjs — verify BOTH song title and duration before
// accepting a YouTube source, so the downloader can never tag a different
// song's audio with the right metadata. Safe to re-run.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let changes = 0;

// 1. Add scTitleMatch: does the video title contain the expected song title?
//    This is the missing half of scArtistMatch — the artist check alone lets
//    ANY video by the same artist through, so the wrong track's audio gets
//    tagged with the right metadata.
if (!src.includes('function scTitleMatch')) {
  src = src.replace(
    '  // SideCut AI assist: when a Gemini key is set, the top YouTube candidates are',
    [
      '  // Song-title check: does this video actually carry the track we asked for?',
      '  // scArtistMatch only proved the ARTIST matched — a video by the right artist',
      '  // singing a DIFFERENT song sailed through and got tagged with the correct',
      '  // metadata, which is exactly the "right tags, wrong audio" bug.',
      '  function scTitleMatch(expectedTitle, videoTitle, candTitle){',
      '    function norm(s){',
      '      return String(s || \'\').toLowerCase()',
      '        .replace(/\\([^)]*\\)|\\[[^\\]]*\\]/g, \' \')',
      '        .replace(/[^a-z0-9 ]+/g, \' \')',
      '        .replace(/\\s+/g, \' \').trim();',
      '    }',
      '    var want = norm(expectedTitle);',
      '    if(!want) return true;',
      '    var vt = norm(videoTitle);',
      '    var ct = norm(candTitle);',
      '    // The video title or candidate title must contain the expected title',
      '    // (or a large overlap of its words). A short stop-word filter keeps',
      '    // "a", "the", "of" from padding the overlap score.',
      '    var wantWords = want.split(\' \').filter(function(w){ return w.length > 1; });',
      '    if(!wantWords.length) return true;',
      '    function overlap(blob){',
      '      if(!blob) return 0;',
      '      var hits = 0;',
      '      for(var i = 0; i < wantWords.length; i++){',
      '        if(blob.indexOf(wantWords[i]) !== -1) hits++;',
      '      }',
      '      return hits;',
      '    }',
      '    var best = Math.max(overlap(vt), overlap(ct));',
      '    // Full containment is an instant pass; otherwise require most words.',
      '    if(vt.indexOf(want) !== -1 || ct.indexOf(want) !== -1) return true;',
      '    return best >= Math.max(2, Math.ceil(wantWords.length * 0.6));',
      '  }',
      '',
      '  // Duration check: the Spotify plan carries the real track length in seconds.',
      '  // If the decoded audio is wildly different the wrong video was fetched.',
      '  function scDurationOk(expectedSec, actualSec){',
      '    if(!expectedSec || expectedSec <= 0) return true;',
      '    if(!actualSec || actualSec <= 0) return true;',
      '    var diff = Math.abs(expectedSec - actualSec);',
      '    // Allow 15 seconds of drift (intro/outro edits, ads, silence) but not a',
      '    // different song entirely.',
      '    return diff <= 15;',
      '  }',
      '',
      '  // SideCut AI assist: when a Gemini key is set, the top YouTube candidates are'
    ].join('\n')
  );
  changes++;
}

// 2. In scSpToBuffer, add title verification alongside artist verification.
if (!src.includes('scTitleMatch(title,')) {
  src = src.replace(
    "      if(scArtistMatch(artist, pa.author, pa.videoTitle, cands[ci].owner, cands[ci].title)){\n        audio = pa;\n        break;\n      }",
    "      if(scArtistMatch(artist, pa.author, pa.videoTitle, cands[ci].owner, cands[ci].title) &&\n         scTitleMatch(title, pa.videoTitle, cands[ci].title)){\n        audio = pa;\n        break;\n      }"
  );
  changes++;
}

// 3. After decode, verify duration matches the expected track length.
if (!src.includes('scDurationOk')) {
  src = src.replace(
    "    var dec = await scFetchDecode(audio, onStatus);\n    if(!dec){ window.__scSourceFail = 'download blocked'; return null; }\n    if(onStatus) onStatus('✓ Audio ready — pick MP3, WAV or FLAC below');\n    return { buffer: dec.buffer, streamUrl: dec.url, videoTitle: audio.videoTitle || '' };",
    "    var dec = await scFetchDecode(audio, onStatus);\n    if(!dec){ window.__scSourceFail = 'download blocked'; return null; }\n" +
    "    // Duration sanity: if the Spotify track list told us how long this song\n" +
    "    // should be and the decoded audio is way off, the wrong video was picked.\n" +
    "    var expectedSec = Number(meta.seconds) || 0;\n" +
    "    if(expectedSec > 0 && !scDurationOk(expectedSec, dec.buffer.duration)){\n" +
    "      window.__scSourceFail = 'audio length does not match the track';\n" +
    "      return null;\n" +
    "    }\n" +
    "    if(onStatus) onStatus('✓ Audio ready — pick MP3, WAV or FLAC below');\n" +
    "    return { buffer: dec.buffer, streamUrl: dec.url, videoTitle: audio.videoTitle || '' };"
  );
  changes++;
}

// 4. Pass seconds through from plan tracks to scConvertOneTrack's meta.
//    The batch loop already does Object.assign({}, tracks[i]) so meta.seconds
//    is present if the track object carries it — just make sure the fallback
//    path also passes it.
if (!src.includes('meta.seconds')) {
  src = src.replace(
    "    var title = meta.title || '', artist = meta.artist || '';\n    var album = meta.album || '';",
    "    var title = meta.title || '', artist = meta.artist || '';\n    var album = meta.album || '';\n    // seconds = expected track length from Spotify's own track list, used to\n    // reject a decoded buffer that is a completely different song.\n    var expectedSec = Number(meta.seconds) || 0;"
  );
  changes++;
}

// 5. Bump version.
if (src.includes("const APP_VERSION = '60.3.6'")) {
  src = src.replace("const APP_VERSION = '60.3.6'", "const APP_VERSION = '60.4.0'");
  changes++;
}

// 6. Changelog entry.
if (!src.includes("version: '60.4.0'")) {
  const ANCHOR = "  const CHANGELOG = [\n";
  const ENTRY = [
    "  { version: '60.4.0', date: 'September 22, 2026 · 8:00 AM EDT', title: 'Audio verification: right song, not just right artist', items: [",
    "    'The downloader now verifies the video title actually contains the song name \\u2014 not just the artist \\u2014 before accepting a source.',",
    "    'Decoded audio length is checked against Spotify\\u2019s track duration; a mismatch rejects the source instead of tagging the wrong song.',",
    "    'No more \\u201cright metadata, wrong audio\\u201d files in your library.',",
    "  ]},\n"
  ].join('\n');
  if (src.includes(ANCHOR)) {
    src = src.replace(ANCHOR, ANCHOR + ENTRY);
    changes++;
  }
}

if (changes > 0) {
  fs.writeFileSync(FILE, src, 'utf8');
  console.log(`patch-audio-verify: applied ${changes} patch(es)`);
} else {
  console.log('patch-audio-verify: already applied');
}
