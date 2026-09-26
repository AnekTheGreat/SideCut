#!/usr/bin/env node
// SideCut — 63.0.3: the Album History edit sheet opens where you can see it, and
// the invented dates on old albums are gone.
//
//   * APP_VERSION moves 63.0.2 → 63.0.3. A step inside the 63 line the phone is
//     on; a jump past it (v64) still needs the user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.3 → 63.0.4 — its own number, decoupled from
//     APP_VERSION (dev/patch-623.mjs): it is a cache-buster.
//   * The head CHANGELOG entry is NEW; the 63.0.2 entry stays below it. Its items
//     become the OTA notes for both channels, so they stay clear of every
//     downloader term and never name the play build.
//
//   node dev/patch-631.mjs              # version + changelog + sw.js + repins
//   node dev/patch-631.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.3';
const OLD_VER = '63.0.2';
const STAMP = 'September 26, 2026 · 1:59 AM EDT';
const OLD_STAMP = 'September 26, 2026 · 1:32 AM EDT';
const SW_CACHE = '63.0.4';
const OLD_SW_CACHE = '63.0.3';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'The album edit sheet opens where you can see it \\u2014 and old albums stop wearing a date nothing ever published', items: [
    'The pencil on an album in \\ud83d\\udcc0 Album History now opens a sheet at the bottom of the screen. It used to open inside the list, at the top of the scrolling list, so on a long list scrolled down it appeared far above the screen and tapping it looked like it had done nothing. Release date and track count, Save and Cancel, and a tap outside closes it.',
    'Saving says what actually happened: an album with no catalog id now tells you so instead of closing and reporting the date as saved, and a form you have not changed says there was nothing to save.',
    'The date field only fills in a real day. An album MusicBrainz dates by year alone \\u2014 which is how it files an old album \\u2014 shows that year underneath the field instead of leaving you an empty box, and reopening the pencil shows the date you set, not the one it replaced.',
    'The wrong dates are gone. SideCut also reads a discography guide for albums no store lists, and it used to ask that guide for a full date: asked for the day of a 2004 album it answered with a confident day it could not know, and that day was shown as the album\\'s release date. It is asked for the year now, and only a four-digit year is kept, so a release date only ever comes from a store or a catalog that has one.',
    'An album the guide already covered can no longer be added a second time, whatever year it guessed, and a store or catalog entry now replaces a guessed entry for the same album \\u2014 so the real cover, the real date and the real track count win instead of being thrown away.',
    'A date you set on one of those albums survives a refetch: those entries used to be numbered by their position in the guide\\'s reply, so a refetch renumbered them and your date no longer belonged to that album.',
  ] },
`;

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

if (!MANIFEST_ONLY) {
  sub('APP_VERSION',
    "  const APP_VERSION = '" + OLD_VER + "';",
    "  const APP_VERSION = '" + VER + "';",
    1, "const APP_VERSION = '" + VER + "';");

  sub('CHANGELOG head entry',
    'const CHANGELOG = [\n',
    'const CHANGELOG = [\n' + ENTRY,
    1, "  { version: '" + VER + "', date: '" + STAMP + "',");

  fs.writeFileSync(FILE, src);

  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';";
  if (sw.includes(newSw)) {
    console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
  } else {
    const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';";
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
  }

  const REPINS = [
    ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
    ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
    ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
    ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"]
  ];

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (a === b || t.indexOf(a) === -1) continue;
      repinned += t.split(a).length - 1;
      t = t.split(a).join(b);
      console.log('  ' + name + ' — ' + a.slice(0, 52));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-631: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-631 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
