#!/usr/bin/env node
// v60.1.3 — the album artist typed into the rename dialog is a credit like any
// other, so it is normalized the same way ("Diljit Dosanjh & Sia" → "Diljit
// Dosanjh, Sia") before it is stored on the album.
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(HTML, 'utf8');

const from = `      var nn = String(v.name || '').trim() || oldName;
      var na = String(v.artist || '').trim();`;
const to = `      var nn = String(v.name || '').trim() || oldName;
      // The album artist is an artist credit like any other: "A & B" is stored as
      // "A, B", the same form the rest of the library uses.
      var na = scArtistCredits(String(v.artist || '').trim());`;
const n = html.split(from).length - 1;
if (n !== 1) throw new Error('expected 1, found ' + n);
html = html.split(from).join(to);
fs.writeFileSync(HTML, html);
console.log('  ✓ renameUserAlbum normalizes the artist credit');
