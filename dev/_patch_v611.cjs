#!/usr/bin/env node
// One-off patch for v60.1.1 — the 60.1 release, one patch digit in.
//
// Why not a bare 60.1: the decision to install runs in the build that is already
// on the phone, and every install out there carries the renumbering map that
// reads the exact label "60.1" as 60.0.2. Verified against the published 60.0.9
// page: manifest 60.1 → refused (treated as a downgrade), 60.1.1 → accepted.
// A bare 60.2 is refused the same way (it maps to 60.0.3), so 60.1.1 is the one
// number that both reaches every install and carries the 60.1 release.
//
// The 60.0.10 mapping added for the aborted rename goes away with it: a bare
// 60.1 is not a legacy label any more, it is this line.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const CLIENT = path.join(ROOT, 'dev', 'native-updates.js');

let html = fs.readFileSync(HTML, 'utf8');
let sw = fs.readFileSync(SW, 'utf8');
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

console.log('\n— index.html —');
html = sub('APP_VERSION -> 60.1.1', html, `  const APP_VERSION = '60.1';`, `  const APP_VERSION = '60.1.1';`);

html = sub('versioning rule: why the 60.1 line starts at 60.1.1', html,
  `  //   - The third number stops at nine: 60.0.9 is followed by 60.1 (never\n` +
  `  //     60.0.10), then 60.2, 60.3 … A fix on top of 60.1 ships as 60.1.1.\n`,
  `  //   - The third number stops at nine: 60.0.9 is followed by 60.1 (never\n` +
  `  //     60.0.10), then 60.2, 60.3 … A fix on top of 60.1 ships as 60.1.2.\n` +
  `  //   - The 60.1 release itself ships as 60.1.1. Every build before it carries\n` +
  `  //     the old map that reads the bare label "60.1" as 60.0.2 (the release\n` +
  `  //     that got renumbered), so a bare 60.1 is refused as a downgrade over the\n` +
  `  //     air by every install that exists — 60.1.1 is the same release and is\n` +
  `  //     accepted by all of them. The next release is 60.2.\n`);

html = sub('legacy map: no 60.0.10 entry either', html,
  `  const LEGACY_VERSIONS = { '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8', '60.0.10':'60.1' };`,
  `  const LEGACY_VERSIONS = { '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8' };`);

html = sub('legacy comment: drop the 60.0.10 mention', html,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6, and 60.0.10 → 60.1). A device can still\n`,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A device can still\n`);

html = sub('legacy comment: why 60.1 stays out, and why that number is 60.1.1', html,
  `  // '60.1' is deliberately NOT in this map, and must never be put back: it was\n` +
  `  // the label of the build that became 60.0.2, but it is a real version again\n` +
  `  // now (60.0.9 → 60.1). Mapping it would normalize this app's OWN version down\n` +
  `  // to 60.0.2, so every published release would read as newer than the build\n` +
  `  // that is running and the update would offer itself again and again. Only a\n` +
  `  // device still running that ancient 60.1 label cannot be told apart — it\n` +
  `  // needs the native build once, exactly like one on 60.2 – 60.4.1.\n`,
  `  // '60.1' is deliberately NOT in this map, and must never be put back: it was\n` +
  `  // the label of the build that became 60.0.2. Mapping it would make the app\n` +
  `  // read this release as 60.0.2, so every published version would look newer\n` +
  `  // than the build that is running and the update would offer itself again and\n` +
  `  // again. It stays out even though the 60.1 line is current now — which is\n` +
  `  // exactly why the first release of that line ships as 60.1.1: a build holding\n` +
  `  // this old map reads a bare 60.1 as 60.0.2 and refuses it as a downgrade.\n`);

html = sub('changelog entry renamed to 60.1.1', html,
  `  { version: '60.1', date: `,
  `  { version: '60.1.1', date: `);

html = sub('changelog entry: the numbering, explained properly', html,
  `    'This release is v60.1 — it was going to be numbered 60.0.10. The third number stops at nine now, so 60.0.9 is followed by 60.1, and the patch notes and the version in Settings read that way from here on',\n`,
  `    'This release is the 60.1 line — it was going to be numbered 60.0.10. The third number stops at nine now: 60.0.9 is followed by 60.1, not 60.0.10, and the next release is 60.2',\n` +
  `    'It carries one more digit (60.1.1) on the way in, and that is the delivery talking, not the release. Every install that exists still holds the old note that read the bare label "60.1" as 60.0.2 — the version this one replaced — so a bare 60.1 is refused as a downgrade before it can ever arrive. 60.1.1 is that same release, accepted by every install, and from here the numbers are plain again',\n`);

console.log('\n— sw.js —');
sw = sub('service worker cache -> v60.1.1', sw, `sidecut-shell-v60.1`, `sidecut-shell-v60.1.1`);

console.log('\n— dev/native-updates.js (the OTA client shipped in the bundle) —');
client = sub('client legacy map matches index.html', client,
  `  var LEGACY_VERSIONS = { '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8', '60.0.10':'60.1' };`,
  `  var LEGACY_VERSIONS = { '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8' };`);

client = sub('client comment: drop the 60.0.10 mention', client,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6, and 60.0.10 → 60.1). A phone can still be\n`,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A phone can still be\n`);

client = sub('client comment: 60.1 is a version now, and 60.1.1 is the release', client,
  `  // '60.1' is NOT a legacy label any more — it is the release this build is\n` +
  `  // (60.0.9 → 60.1), so it must never be rewritten. See index.html for the long\n` +
  `  // version: rewriting it would make this client read its own version as 60.0.2\n` +
  `  // and re-install the published bundle on every check.\n`,
  `  // '60.1' is NOT a legacy label any more — it is this release's line, so it must\n` +
  `  // never be rewritten. See index.html for the long version: rewriting it would\n` +
  `  // make this client read its own version as 60.0.2 and re-install the published\n` +
  `  // bundle on every check. The line ships as 60.1.1 for the same reason — a build\n` +
  `  // still holding the old map refuses a bare 60.1 before it can arrive.\n`);

fs.writeFileSync(HTML, html);
fs.writeFileSync(SW, sw);
fs.writeFileSync(CLIENT, client);

console.log('\nindex.html, sw.js and dev/native-updates.js are v60.1.1.');
console.log('Next: update dev/v61-check.cjs, then node dev/ota-bundle.mjs\n');
