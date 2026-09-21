#!/usr/bin/env node
// One-off patch for v60.1.2, part 2 — the conversion pipeline itself:
//   • scEncodeAudio's MP3 branch shares the tag joiner with the cooperative twin
//     (so the two can never drift apart)
//   • scConvertOneTrack encodes cooperatively (the app stays alive) and hands
//     the cover bytes back so the library entry gets its artwork
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let html = fs.readFileSync(HTML, 'utf8');

function sub(name, from, to, times) {
  const want = times === undefined ? 1 : times;
  const found = html.split(from).length - 1;
  if (found !== want) throw new Error(`${name}: expected ${want}, found ${found}`);
  html = html.split(from).join(to);
  console.log('  ✓ ' + name);
}

sub('scEncodeAudio MP3 branch uses the shared tag joiner',
  `        // Prepend an ID3v2.3 tag carrying the fetched track metadata + cover art.\n` +
  `        var id3 = scId3v23Bytes(meta);\n` +
  `        var total = 0, ci;\n` +
  `        for(ci = 0; ci < chunks.length; ci++) total += chunks[ci].length;\n` +
  `        if(id3 && id3.length){\n` +
  `          var withTag = new Uint8Array(id3.length + total);\n` +
  `          withTag.set(id3, 0);\n` +
  `          var wpos = id3.length;\n` +
  `          for(ci = 0; ci < chunks.length; ci++){ withTag.set(chunks[ci], wpos); wpos += chunks[ci].length; }\n` +
  `          return new Blob([withTag], { type: 'audio/mpeg' });\n` +
  `        }\n` +
  `        return new Blob(chunks, { type: 'audio/mpeg' });\n`,
  `        // Prepend an ID3v2.3 tag carrying the fetched track metadata + cover art.\n` +
  `        return scJoinTaggedChunks(chunks, meta, 'audio/mpeg');\n`);

sub('scConvertOneTrack encodes cooperatively',
  `    var blob = scTaggedBlob(res.buffer, fmt, tagMeta);\n` +
  `    if(!blob) return { ok: false, reason: 'encode failed' };\n`,
  `    var blob = await scEncodeAudioCooperative(res.buffer, fmt, tagMeta, function(p){\n` +
  `      if(onStatus && p > 0 && p < 1) onStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%');\n` +
  `    });\n` +
  `    if(!blob) return { ok: false, reason: 'encode failed' };\n`);

sub('scConvertOneTrack hands the cover art back for the library',
  `    return { ok: true, blob: blob, fName: fName, bytes: blob.size, duration: res.buffer.duration };\n`,
  `    return { ok: true, blob: blob, fName: fName, bytes: blob.size, duration: res.buffer.duration,\n` +
  `             artBytes: artBytes, artMime: artBytes ? artMime : null };\n`);

fs.writeFileSync(HTML, html);
console.log('\nindex.html part 2 applied.\n');
