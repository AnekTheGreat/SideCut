#!/usr/bin/env node
// One-off patch for v60.1.1, part two: free the second number.
//
// The renumbering map still rewrote the labels 60.2, 60.3 and 60.4 — and it
// rewrites BOTH sides of every comparison, so a manifest published as 60.2 would
// be read as 60.0.3 by every install that holds the map and refused as a
// downgrade. With the line now at 60.1.x, that would have made the rule the
// versioning comment states ("60.1, then 60.2, 60.3 …") impossible to follow:
// verified against the real comparator, cmp('60.2', '60.1.1') came back negative.
//
// Those three entries protected nothing: the builds that carried those labels
// (60.0.3, 60.0.4, 60.0.5) were made BEFORE the map existed, so they cannot read
// it themselves, and the map only ever lowered the published number for everyone
// else. They go. 60.4.1 and 60.4.2 stay: those builds DO hold the map, so the
// entries are what let a device still sitting on that label take this release.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const CLIENT = path.join(ROOT, 'dev', 'native-updates.js');

let html = fs.readFileSync(HTML, 'utf8');
let client = fs.readFileSync(CLIENT, 'utf8');

function sub(name, src, from, to, times) {
  const want = times === undefined ? 1 : times;
  const found = src.split(from).length - 1;
  if (found !== want) {
    throw new Error(`${name}: expected ${want} occurrence(s), found ${found}: ${JSON.stringify(from.slice(0, 70))}`);
  }
  console.log('  ✓ ' + name);
  return src.split(from).join(to);
}

const OLD = `{ '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8' }`;
const NEW = `{ '60.4.1':'60.0.6', '60.4.2':'60.0.8' }`;

console.log('\n— index.html —');
html = sub('legacy map: only the two labels a live install can still be running', html,
  `  const LEGACY_VERSIONS = ${OLD};`,
  `  const LEGACY_VERSIONS = ${NEW};`);

html = sub('legacy comment: the numbers 60.2 – 60.4 are releases again', html,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A device can still\n` +
  `  // carry an old label —\n`,
  `  // (60.1 → 60.0.2, 60.4.1 → 60.0.6, 60.4.2 → 60.0.8). A device can still carry\n` +
  `  // an old label —\n`);

html = sub('legacy comment: why 60.2 – 60.4 were dropped', html,
  `  // '60.1' is deliberately NOT in this map, and must never be put back: it was\n`,
  `  // 60.1, 60.2, 60.3 and 60.4 are deliberately NOT in this map, and must never be\n` +
  `  // put back. A mapping rewrites both sides of every comparison, so leaving them\n` +
  `  // in would mean a release published as 60.2 reads as 60.0.3 on every install\n` +
  `  // that holds the map and is refused as a downgrade — the second number could\n` +
  `  // never advance. Nothing was protected by them either: the builds that carried\n` +
  `  // those labels predate this map, so they cannot read it.\n` +
  `  //\n` +
  `  // '60.1' was\n`);

html = sub('changelog: the labels that no longer exist are free again', html,
  `    'It carries one more digit (60.1.1) on the way in, and that is the delivery talking, not the release.`,
  `    'The old renumbering labels 60.1 – 60.4 are finished as labels too. They used to be rewritten to the release they became (60.1 → 60.0.2, 60.2 → 60.0.3 …), which would have made a later release published as 60.2 read as 60.0.3 and refused before it could install — the second number could not advance at all. Only 60.4.1 and 60.4.2 stay mapped, so a phone still sitting on one of those two labels can take this release',\n` +
  `    'It carries one more digit (60.1.1) on the way in, and that is the delivery talking, not the release.`);

console.log('\n— dev/native-updates.js (the OTA client shipped in the bundle) —');
client = sub('client legacy map matches index.html', client,
  `  var LEGACY_VERSIONS = ${OLD};`,
  `  var LEGACY_VERSIONS = ${NEW};`);

client = sub('client comment: the parenthetical', client,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A phone can still be\n`,
  `  // (60.1 → 60.0.2, 60.4.1 → 60.0.6, 60.4.2 → 60.0.8). A phone can still be\n`);

client = sub('client comment: the dropped labels', client,
  `  // '60.1' is NOT a legacy label any more — it is this release's line, so it must\n` +
  `  // never be rewritten. See index.html for the long version: rewriting it would\n` +
  `  // make this client read its own version as 60.0.2 and re-install the published\n` +
  `  // bundle on every check. The line ships as 60.1.1 for the same reason — a build\n` +
  `  // still holding the old map refuses a bare 60.1 before it can arrive.\n`,
  `  // 60.1 – 60.4 are NOT legacy labels any more — 60.1 is this release's line and\n` +
  `  // 60.2 onwards are the numbers still to come, so none of them may be rewritten:\n` +
  `  // a mapping lowers the published number for every device that holds the map.\n` +
  `  // See index.html for the long version. The line ships as 60.1.1 because a build\n` +
  `  // still holding the old map refuses a bare 60.1 before it can arrive — and this\n` +
  `  // release is the last one that has to care.\n`);

fs.writeFileSync(HTML, html);
fs.writeFileSync(CLIENT, client);

console.log('\nthe map is { 60.4.1 → 60.0.6, 60.4.2 → 60.0.8 } in both files.');
console.log('Next: update the audits, then node dev/ota-bundle.mjs\n');
