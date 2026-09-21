#!/usr/bin/env node
// One-off patch for v60.1.2 — the version bump and the patch notes.
//
// Numbering: this is a change on top of 60.1.1, so it takes the line's patch
// digit (60.1.2). The next whole step (60.2) has to wait until the installs that
// still carry the old map — the ones that read 60.2 as 60.0.3 — are on this
// release; publishing 60.2 today would be refused by a phone still on 60.0.9.
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

// Eastern time. The sandbox shell has no timezone database (TZ=America/New_York
// silently reports UTC), so this is computed with Intl and an explicit zone.
const stamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
}).format(new Date()).replace(' at ', ' · ').replace(/:\d\d /, ' ') + ' EDT';

html = sub('APP_VERSION -> 60.1.2', html, `  const APP_VERSION = '60.1.1';`, `  const APP_VERSION = '60.1.2';`);
sw = sub('sw.js cache -> v60.1.2', sw, `sidecut-shell-v60.1.1`, `sidecut-shell-v60.1.2`);

const entry = `  { version: '60.1.2', date: '${stamp}', title: 'Conversions run in the background, land in your library, and you pick the songs', items: [
    'Pick what converts. The Spotify album/playlist converter now lists every song it found with a tick box, all of them ticked to start with \\u2014 untick the ones you do not want (or tap None) and the button counts the selection: "Convert 4 songs". No more converting twelve songs to keep three',
    'Converted songs go straight into your library. Every finished track is filed under All songs (and Unsorted) with the title, artist, album and cover art the conversion already fetched, written to the library exactly like an imported file \\u2014 so it is still there after a restart. Nothing to download, nothing to import, no share sheet popping up over your music',
    'Saving files is now the extra, not the default: the output choice is "Just my library", "Library + save files" or "Library + one ZIP"',
    'The app stays usable while it converts. The encoder used to run the entire track in one go on the main thread \\u2014 a four-minute song is about ten million samples per channel, so the app froze until it finished. Encoding is now sliced and hands control back every ~55ms, so you can scroll, browse, switch tabs and keep listening while the work happens. MP3 (the default) and WAV; FLAC keeps its old encoder',
    'The run follows you. Converting is no longer tied to the window you started it in: close that window and the progress stays on screen as a small pill above the player, which turns into "12 songs added to your library" when it is done, with an Open my library button right there',
    'A leading track number is no longer read as the artist. Conversions are named "01 - Diljit Dosanjh - Dealer.mp3" on purpose, and importing one used to file the song under artist "01" with the artist stuck on the front of the title \\u2014 the number is dropped before the artist/title split now, for every file you add, converted or not',
    'The single-song converters do it too: a converted Spotify track or YouTube link is in your library when it finishes, with a "Save the file too" button if you also want the file. No Import to Library step anywhere',
  ]},
`;

html = sub('the new patch-note entry', html, `  { version: '60.1.1', date: `, entry + `  { version: '60.1.1', date: `);

fs.writeFileSync(HTML, html);
fs.writeFileSync(SW, sw);
console.log('\nindex.html + sw.js are v60.1.2 (' + stamp + ')\n');
