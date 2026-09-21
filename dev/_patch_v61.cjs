#!/usr/bin/env node
// One-off patch for v60.1 — the converter release that was going to ship as
// 60.0.10.
//
// The rule now is that the third number never reaches ten: 60.0.9 is followed by
// 60.1 (never 60.0.10), then 60.2, 60.3 … A fix on top of 60.1 ships as 60.1.1.
//
// The rename has one real trap. '60.1' used to be a LEGACY label standing for
// the pre-renumbering build that is now 60.0.2 — and it is a genuine version
// again. Left in the legacy map, the app would normalize its OWN version down to
// 60.0.2, and then every published release would look newer than the build that
// is running: the updater would offer the same install for ever. So that entry
// goes, and the map gets an entry for the number this release was almost
// published under (60.0.10 → 60.1) instead.
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
html = sub('APP_VERSION -> 60.1', html, `  const APP_VERSION = '60.0.10';`, `  const APP_VERSION = '60.1';`);

html = sub('versioning rule: the third number stops at nine', html,
  `  //     additions, visual polish, copy changes.\n`,
  `  //     additions, visual polish, copy changes.\n` +
  `  //   - The third number stops at nine: 60.0.9 is followed by 60.1 (never\n` +
  `  //     60.0.10), then 60.2, 60.3 … A fix on top of 60.1 ships as 60.1.1.\n`);

html = sub('legacy map: drop the now-real 60.1, record 60.0.10', html,
  `  const LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8' };`,
  `  const LEGACY_VERSIONS = { '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8', '60.0.10':'60.1' };`);

html = sub('legacy comment: the parenthetical names 60.0.10', html,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A device can still carry an old label —\n`,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6, and 60.0.10 → 60.1). A device can still\n` +
  `  // carry an old label —\n`);

html = sub('legacy comment: why 60.1 is not in the map', html,
  `  // renumbered build.\n`,
  `  // renumbered build.\n` +
  `  //\n` +
  `  // '60.1' is deliberately NOT in this map, and must never be put back: it was\n` +
  `  // the label of the build that became 60.0.2, but it is a real version again\n` +
  `  // now (60.0.9 → 60.1). Mapping it would normalize this app's OWN version down\n` +
  `  // to 60.0.2, so every published release would read as newer than the build\n` +
  `  // that is running and the update would offer itself again and again. Only a\n` +
  `  // device still running that ancient 60.1 label cannot be told apart — it\n` +
  `  // needs the native build once, exactly like one on 60.2 – 60.4.1.\n`);

html = sub('changelog entry renamed', html,
  `  { version: '60.0.10', date: `,
  `  { version: '60.1', date: `);

html = sub('changelog entry gains the numbering note', html,
  `    'Both converters share the fix: Spotify links and the YouTube to MP3 box use the same download and decode path, so both come back at once',\n`,
  `    'Both converters share the fix: Spotify links and the YouTube to MP3 box use the same download and decode path, so both come back at once',\n` +
  `    'This release is v60.1 — it was going to be numbered 60.0.10. The third number stops at nine now, so 60.0.9 is followed by 60.1, and the patch notes and the version in Settings read that way from here on',\n`);

console.log('\n— sw.js —');
sw = sub('service worker cache -> v60.1', sw, `sidecut-shell-v60.0.10`, `sidecut-shell-v60.1`);

console.log('\n— dev/native-updates.js (the OTA client shipped in the bundle) —');
client = sub('client legacy map matches index.html', client,
  `  var LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8' };`,
  `  var LEGACY_VERSIONS = { '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6', '60.4.2':'60.0.8', '60.0.10':'60.1' };`);

client = sub('client comment: the parenthetical names 60.0.10', client,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A phone can still be running one of those\n`,
  `  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6, and 60.0.10 → 60.1). A phone can still be\n` +
  `  // running one of those\n`);

client = sub('client comment: 60.1 is a version now, not a label', client,
  `  // client would refuse the renumbered build as a downgrade for ever.\n`,
  `  // client would refuse the renumbered build as a downgrade for ever.\n` +
  `  //\n` +
  `  // '60.1' is NOT a legacy label any more — it is the release this build is\n` +
  `  // (60.0.9 → 60.1), so it must never be rewritten. See index.html for the long\n` +
  `  // version: rewriting it would make this client read its own version as 60.0.2\n` +
  `  // and re-install the published bundle on every check.\n`);

fs.writeFileSync(HTML, html);
fs.writeFileSync(SW, sw);
fs.writeFileSync(CLIENT, client);

console.log('\nindex.html, sw.js and dev/native-updates.js are v60.1.');
console.log('Next: node dev/ota-bundle.mjs && node dev/v61-check.cjs\n');
