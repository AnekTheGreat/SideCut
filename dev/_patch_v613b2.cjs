#!/usr/bin/env node
// v60.1.3 — the comment above the cooperative encoder still said FLAC kept the
// blocking encoder. It is cooperative now, and it is the default output.
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(HTML, 'utf8');

const from = `  // The one the converters call. FLAC keeps the original encoder: its bit
  // writer has no natural slice boundary, and rewriting it is not worth the
  // risk of changing the file it produces.`;
const to = `  // The one the converters call. All three formats are cooperative: MP3 and WAV
  // slice their own loops, and the FLAC encoder hands the thread back between
  // blocks (its bit writer is per-frame, so the only thing that changed was where
  // it yields — the bytes it produces are identical to the old encoder). Lossless
  // FLAC is the default output, so that is the encoder the app leans on most.`;
const n = html.split(from).length - 1;
if (n !== 1) throw new Error('expected 1, found ' + n);
html = html.split(from).join(to);
fs.writeFileSync(HTML, html);
console.log('  ✓ scEncodeAudioCooperative comment');
