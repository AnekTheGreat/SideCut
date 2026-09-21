#!/usr/bin/env node
// v60.1.3 — version bump + patch notes.
//
// Numbering: a change on top of 60.1.2 takes the line's patch digit (60.1.3).
// The next whole step (60.2) still has to wait for the installs that carry the
// old renumbering map to be on this line.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

let html = fs.readFileSync(HTML, 'utf8');
let sw = fs.readFileSync(SW, 'utf8');

function sub(name, src, from, to) {
  const found = src.split(from).length - 1;
  if (found !== 1) throw new Error(`${name}: expected 1, found ${found}`);
  console.log('  ✓ ' + name);
  return src.split(from).join(to);
}

const stamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
}).format(new Date()).replace(' at ', ' · ').replace(/:\d\d /, ' ') + ' EDT';

html = sub('APP_VERSION -> 60.1.3', html, `  const APP_VERSION = '60.1.2';`, `  const APP_VERSION = '60.1.3';`);
sw = sub('sw.js cache -> v60.1.3', sw, `sidecut-shell-v60.1.2`, `sidecut-shell-v60.1.3`);

const entry = `  { version: '60.1.3', date: '${stamp}', title: 'Lossless downloads by default, commas between artists, album artists you can rename', items: [\n    'Downloads are lossless now. Every converter opens on FLAC (lossless) \\\\u2014 the same audio with nothing thrown away, about a fifth of a WAV\\u2019s size \\\\u2014 with WAV (also lossless) next and MP3 last for when space matters more. Pick MP3 at any time from the same format menu, on the album picker, the single-song converter and the YouTube one',\n    'The FLAC encoder no longer freezes the app. It used to run the whole track in one pass on the main thread, which is why a lossless conversion locked everything up; it now hands the screen back every couple of seconds of audio and reports progress, and the file it writes is byte-for-byte the one it always wrote',\n    'Artists are comma-separated everywhere. The file-name cleaner stripped commas, so a converted \\"Diljit Dosanjh, Sia\\" became \\"Diljit Dosanjh Sia\\" and the library filed that as ONE artist. Commas survive now, so the file name, the saved tag and the library row all read \\"Diljit Dosanjh, Sia\\" \\\\u2014 and a credit written \\"A & B\\", \\"A x B\\" or \\"A feat. B\\" is normalized to \\"A, B\\" on the way in, on imports too',\n    'Every credited artist is used, not just the first. A Spotify track whose credits are Diljit Dosanjh, Sia and David Guetta came out as \\"Diljit Dosanjh\\" only; the whole credit list is read now',\n    'Rename an album and its artist in one go. The Rename button in Manage albums asks for the album name AND the artist printed under it. If the album already shares one artist the songs are renamed with it; a mixed-artist album keeps each song\\u2019s own artist',\n    'The record player opens the album properly. In Albums, tapping it used to end in a toast when the album card had not been opened yet \\\\u2014 its song rows are only built when the card is expanded, and a re-render rebuilds the cards closed. It now opens the card itself, scrolls to the playing song and highlights it, with no toast anywhere in that path',\n  ]},\n`;

html = sub('the new patch-note entry', html, `  { version: '60.1.2', date: `, entry + `  { version: '60.1.2', date: `);

fs.writeFileSync(HTML, html);
fs.writeFileSync(SW, sw);
console.log('\nindex.html + sw.js are v60.1.3 (' + stamp + ')\n');
