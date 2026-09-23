// v60.5.8 follow-up: the Settings copy of the Expand URL card still read
// "to get the full track URL for converters" — the Discover card was already
// reworded, this one was missed and test-6058 flags it.
import fs from 'node:fs';

const HTML = 'index.html';
const src = fs.readFileSync(HTML, 'utf8');
const OLD = 'to get the full track URL for converters. Not needed if you already have an open.spotify.com/track/... URL.';
const NEW = 'to get the full track URL. Not needed if you already have an open.spotify.com/track/... URL.';
const hits = src.split(OLD).length - 1;
if (hits !== 1) {
  console.error('FAIL expected 1 occurrence, found ' + hits);
  process.exit(1);
}
fs.writeFileSync(HTML, src.replace(OLD, NEW));
console.log('OK Settings Expand URL card reworded');
