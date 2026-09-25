#!/usr/bin/env node
// v61.3.9 follow-up — the release rules the first pass missed:
//   [1] The 61.3.9 changelog entry shipped 4 items and named the feature
//       "converter". The suite demands >= 5 items (test-6053/54/55/56/57/58),
//       and a shared-channel note may never carry a downloader term — STRONG
//       in test-6058 covers converter/convert*/download* (test-60510 line 44
//       too). Same story, told without the forbidden words, plus the two fixes
//       that were missing a note (the YouTube title leg, the init passthrough).
//   [2] The YouTube oEmbed title lookup is a bare fetch — youtube.com/oembed
//       sends NO access-control-allow-origin (measured Sep 25), so inside the
//       WebView it always failed and the saved file kept the fallback title.
//       It now rides fetchWithProxy (native first on the device).
//   [3] dev/test-6136 pinned `await fetchWithProxy(url)` but scFetchMbUpcoming
//       now passes the identifying User-Agent init — the needle moves with it.
//   [4] dev/test-6138's [7] block asserts its OWN release's notes, but 61.3.8
//       is no longer the head — those three content assertions now find the
//       61.3.8 entry by version, while the head is still checked for version
//       and ship date (the lines patch-6139 repins stay byte-identical).
//
// Run: node dev/patch-6139b.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const VER = '61.3.9';
const OWN = '61.3.8';
const OWN_DATE = 'September 24, 2026 · 7:00 PM EDT';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
let pinned = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want = 1) {
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  if (newStr === '' && src.indexOf(oldStr) === -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ', found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}

function subFile(rel, label, oldStr, newStr, want = 1) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  if (t.indexOf(newStr) !== -1 && t.indexOf(oldStr) === -1) return skip(rel + ': ' + label);
  const got = t.split(oldStr).length - 1;
  if (got !== want) throw new Error(rel + ' ' + label + ': expected ' + want + ', found ' + got);
  t = t.split(oldStr).join(newStr);
  fs.writeFileSync(p, t);
  console.log('• ' + rel + ': ' + label);
  pinned++;
}

// ---------------------------------------------------------------- [1] notes
{
  const a = src.indexOf(`  { version: '${VER}', date: `);
  if (a === -1) throw new Error('61.3.9 changelog entry missing');
  if (src.indexOf(`  { version: '${VER}', date: `, a + 1) !== -1) throw new Error('61.3.9 entry is ambiguous');
  const b = src.indexOf(`  { version: '${OWN}', date: `, a);
  if (b === -1) throw new Error('61.3.8 entry below the head is missing');
  const span = src.slice(a, b);
  const dm = span.match(/date: '([^']+)'/);
  if (!dm) throw new Error('could not read the 61.3.9 ship date');
  const shipDate = dm[1]; // keep the stamped date the tests pin

  const ITEMS = [
    'Spotify link lookups stopped resolving: they leaned on free public CORS relay services, corsproxy.io started demanding an API key and the others went quiet for days — so track details, artists, covers and album/playlist track lists came back empty. On the phone those pages are now read straight through the device’s own network path, which needs no relay at all; a browser keeps live relays as its fallback and the dead one has been replaced.',
    'The video title lookup inside the app always failed: youtube.com/oembed sends no cross-origin permission, so a WebView could never ask for it. It now runs through the same device network path, so the saved file gets its real title and channel instead of the fallback name.',
    'One cancelled album fetch could silence everything that looks things up: the Album History cancel flag stayed latched and every shared lookup answered with nothing for the rest of the session — upcoming drops, cover art and the link lookups’ fallbacks included. The flag now only counts while an album fetch is actually running.',
    'MusicBrainz refuses requests that do not say who is asking, and the drop check was sending nothing to identify itself — it now carries an identifying User-Agent through the native network path.',
    'An Apple outage no longer ends the drop check: the iTunes pass still finds new singles and albums first, but when it fails, MusicBrainz and the silent Spotify pass run anyway instead of the whole check returning empty.',
    'Requests that need a body were being sent without one: the shared lookup dropped the method, headers and body a caller passed in, so the AI lyrics and metadata requests went out as plain GETs and could never answer. What a caller asks for now rides all the way through.',
  ];
  const NEW_ENTRY =
    `  { version: '${VER}', date: '${shipDate}', title: 'Spotify and YouTube links resolve again, and the drop check runs every source', items: [\n` +
    ITEMS.map((it) => `    '${it.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',\n`).join('') +
    `  ] },\n`;

  if (span === NEW_ENTRY) {
    skip('the 61.3.9 changelog entry is the compliant one');
  } else {
    if (span.split('items: [').length !== 2) throw new Error('unexpected entry shape');
    src = src.slice(0, a) + NEW_ENTRY + src.slice(b);
    fs.writeFileSync(FILE, src);
    done('61.3.9 changelog entry rewritten (6 notes, no forbidden terms, date kept: ' + shipDate + ')');
  }
}

// ------------------------------------------------- [2] YouTube title lookup
sub('YouTube oEmbed rides the shared fetch',
  `        var oResp = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');`,
  `        // youtube.com/oembed sends no access-control-allow-origin (measured), so a
        // page fetch of it always failed inside the WebView — the shared fetch
        // reads it through the device's own network path instead.
        var oResp = await fetchWithProxy('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');`);

fs.writeFileSync(FILE, src);
console.log('• index.html written — ' + edits + ' edit(s)');

// ------------------------------------------------------ [3] test-6136 needle
subFile('dev/test-6136.mjs', 'the MusicBrainz fetch needle carries the User-Agent init',
  `ok(mb && mb.includes('await fetchWithProxy(url)'), 'goes through the shared proxy fetch');`,
  `ok(mb && mb.includes("await fetchWithProxy(url, { headers: { 'User-Agent'"), 'sends an identifying User-Agent through the shared fetch');`);

// ------------------------------------------- [4] test-6138 pins its own entry
subFile('dev/test-6138.mjs', '[7] content assertions move to the 61.3.8 entry',
  `  const head = entries.find((e) => String(e.version) === '${VER}');
  ok(!!head, 'the head entry is ${VER}');
  if (head) {
    const text = (head.items || []).join(' ');
    ok(/Bikramjit Dhaliwal/.test(text) && /length/.test(text), 'it names the small-artist cause');
    ok(/Manual button/.test(text), 'it names the manual way out');
    ok(/imprint/.test(text), 'it names the imprint exception');
    ok(head.date === '${'September 25, 2026 · 2:39 AM EDT'}', 'ship date (' + head.date + ')');
  }`,
  `  const head = entries.find((e) => String(e.version) === '${VER}');
  ok(!!head, 'the head entry is ${VER}');
  if (head) {
    ok(head.date === '${'September 25, 2026 · 2:39 AM EDT'}', 'ship date (' + head.date + ')');
  }
  // This test's own release is no longer the head — pin ITS entry by version so
  // a later release's notes can never wash these three assertions out.
  const own = entries.find((e) => String(e.version) === '${OWN}');
  ok(!!own, 'the ${OWN} entry still exists');
  if (own) {
    const ownText = (own.items || []).join(' ');
    ok(/Bikramjit Dhaliwal/.test(ownText) && /length/.test(ownText), 'it names the small-artist cause');
    ok(/Manual button/.test(ownText), 'it names the manual way out');
    ok(/imprint/.test(ownText), 'it names the imprint exception');
    ok(own.date === '${OWN_DATE}', 'its own ship date (' + own.date + ')');
  }`);

console.log('patch-6139b: ' + edits + ' index.html edit(s), ' + pinned + ' test file(s) updated');
