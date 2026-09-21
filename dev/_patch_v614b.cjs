// v60.1.4: version stamp + changelog entry
const fs = require('fs');
const path = require('path');
const HTML = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(HTML, 'utf8');

function sub(oldStr, newStr) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) throw new Error('expected 1 match, found ' + n + ' for: ' + oldStr.slice(0, 80));
  html = html.replace(oldStr, newStr);
}

const stamp = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit', hour12: true
}).format(new Date()).replace(/\u202f/g, ' ').replace(' at ', ' \u00b7 ') + ' EDT';

sub(`  const APP_VERSION = '60.1.3';`, `  const APP_VERSION = '60.1.4';`);

sub(`  const CHANGELOG = [
  { version: '60.1.3',`,
`  const CHANGELOG = [
  { version: '60.1.4', date: '${stamp}', title: 'Reordering albums sticks, and Get song fetches the song itself', items: [
    'Album order now sticks when you drag a card. The cards are ordered by whatever "Sort songs" is set to, so with A\\u2013Z or By artist picked the list was re-sorted the instant it redrew and the card you had just moved went straight back to where it started. Dragging a card is a decision about the order, so it now becomes the order: Albums switches to your own order and the card stays where you put it (a short note says so). The order is also read from the screen when you let go rather than from a copy taken when the hold began, so a redraw mid-drag can no longer undo it',
    'The sort sheet says what it is in Albums. It read "Sort songs" and its first option "Playlist order" while it was actually arranging album cards; it now reads "Sort albums" with "Your own order \\u2014 where you drag the cards"',
    'Get song gets the song. It used to send you to Spotify to find the track, open the 3-dot menu and copy the link, then paste it into a converter \\u2014 three apps for one tap. It now finds the recording on-device with the same resolver the converters use and files the finished track straight into your library, lossless, exactly like the old Save button (which is gone, since this is that button). If the resolver cannot find that particular recording, it falls back to the Spotify handoff so the copy-the-link route still works. Note for the record: Spotify\\u2019s own track link cannot be read for you automatically \\u2014 their search API needs a developer token and the anonymous routes are blocked \\u2014 so what is fetched is the song, not the link',
  ]},
  { version: '60.1.3',`);

fs.writeFileSync(HTML, html);
console.log('v60.1.4 stamped: ' + stamp);

const SW = path.join(__dirname, '..', 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
if(!sw.includes("sidecut-shell-v60.1.3")) throw new Error('sw cache name not found');
sw = sw.replace("sidecut-shell-v60.1.3", "sidecut-shell-v60.1.4");
fs.writeFileSync(SW, sw);
console.log('sw cache -> sidecut-shell-v60.1.4');
