#!/usr/bin/env node
// v60.0.10c — probe for the cap further in, and document the muxed fallback.
// The live run showed one audio-only stream whose 2-byte probe at 1 MiB was
// answered but whose full 1 MiB chunk at that offset was refused, so the probe
// now looks 2 MiB in: a capped stream cannot answer there, and an uncapped one
// that is simply shorter answers 416 (nothing withheld either way).
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const report = [];
function sub(label, needle, repl) {
  const n = src.split(needle).length - 1;
  if (n !== 1) { report.push({ label, ok: false, found: n }); throw new Error(label); }
  src = src.split(needle).join(repl);
  report.push({ label, ok: true });
}

sub('probe-offset', `  // Two bytes past the first megabyte: enough to know whether the server will
  // serve the rest of this stream. A capped stream (403) is skipped without
  // pulling a megabyte that can never complete; 416 means the file is simply
  // smaller than a chunk, which is fine.
  async function scStreamUsable(url, size){
    if(size && size <= SC_AUDIO_CHUNK) return true;
    var probe = await scFetchRange(url, SC_AUDIO_CHUNK, SC_AUDIO_CHUNK + 1);
    if(probe && probe.bytes && probe.bytes.length) return true;
    return !!(probe && probe.status === 416);
  }`, `  // Two bytes two megabytes in: enough to know whether the server will serve
  // this stream past the cap. The cap sits at one megabyte, so a capped stream
  // answers 403 here and is skipped without pulling a megabyte that can never
  // complete; 416 means the file is simply shorter than that, which is fine.
  async function scStreamUsable(url, size){
    if(size && size <= SC_AUDIO_CHUNK) return true;
    var at = SC_AUDIO_CHUNK * 2;
    var probe = await scFetchRange(url, at, at + 1);
    if(probe && probe.bytes && probe.bytes.length) return true;
    return !!(probe && probe.status === 416);
  }`);

// The size cost of the muxed copy is worth stating plainly in the patch notes.
sub('notes-muxed', `    'A truncated preview can never be saved as a song.`, `    'Music tracks fall back to the video stream. YouTube caps the audio-only stream of a music upload at its first megabyte (measured: the 140 stream of "Dealer" answers 403 past ~1 MB while the same video\\u2019s progressive audio + video stream, itag 18, delivered all 11,317,380 bytes in 11 chunks). The small audio streams are still tried first — they are better quality and they are all an ordinary video needs — and that progressive copy sits behind them, so the album converts instead of coming back empty. It is a bigger download (roughly 10-12 MB per track), which is the price of no longer needing a token YouTube will not hand out',
    'A truncated preview can never be saved as a song.`);

fs.writeFileSync(FILE, src);
for (const r of report) console.log((r.ok ? '✓' : '✗') + ' ' + r.label);
console.log('index.html now ' + src.length + ' bytes');
