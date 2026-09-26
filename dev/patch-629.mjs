#!/usr/bin/env node
// SideCut — 63.0.2: no remixes in the release lists, nothing off the pinned
// artists, and an Upcoming tab that finds (and explains) dated drops.
//
//   * APP_VERSION moves 63.0.1 → 63.0.2. An incremental step inside the 63 line,
//     which is the line the phone is on; a jump past it (v64) still needs the
//     user's say-so.
//   * sw.js's CACHE_NAME moves 63.0.2 → 63.0.3. It carries its own number and is
//     deliberately NOT set to APP_VERSION (decoupled in dev/patch-623.mjs): it is
//     a cache-buster, and a new one is what makes the browser drop the old shell.
//   * The head CHANGELOG entry is NEW (the 63.0.1 entry below it is kept), because
//     this is new work and not a renumber. Its items become the OTA notes for both
//     channels, so they stay clear of every downloader term and never name the
//     play build.
//
//   node dev/patch-629.mjs              # version + changelog + sw.js + repins
//   node dev/patch-629.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.2';
const OLD_VER = '63.0.1';
const STAMP = 'September 26, 2026 · 1:32 AM EDT';
const SW_CACHE = '63.0.3';
const OLD_SW_CACHE = '63.0.2';

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'No remixes in New releases or Upcoming releases \\u2014 and Upcoming reads the days that are actually announced', items: [
    'New releases and Upcoming releases are the artist\\'s own new music only: a remix, a mix, a cover, a karaoke or tribute record is left out of both lists, whichever catalog it came from.',
    'A record now has to be credited to a pinned artist by name \\u2014 the exact name, or a whole word of it \\u2014 so a tribute band, a karaoke act or a remix outfit whose name merely begins with your artist\\'s can no longer put a row in your list.',
    'Remixes already stored from an earlier build leave on the next start instead of waiting for a refetch, and the counts on the tab, the Home panel and the bell agree with the rows you can see.',
    'Upcoming releases reads the dates that are really announced: MusicBrainz is asked one request at a time and retried when it is busy \\u2014 a burst of requests was being throttled, and every throttled reply was read as \"nothing found\" \\u2014 and each artist\\'s own MusicBrainz catalog is read by its id, where an announced release sits even when a name search buries it.',
    'The open catalog that carries a drop\\'s day is read for singles and EPs as well as albums, where a dated single used to be invisible.',
    'When no drop is dated ahead, the Upcoming tab says so plainly \\u2014 how many pinned artists were read and when \\u2014 so an empty tab reads as \"nothing announced yet\" rather than a list that broke. The two buttons are unchanged: check again now, or add a drop by hand.',
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

  // A NEW head entry, in front of the 63.0.1 one — anchored on the array opening
  // so the existing entries can never be touched.
  sub('CHANGELOG head entry',
    'const CHANGELOG = [\n',
    'const CHANGELOG = [\n' + ENTRY,
    1, "  { version: '" + VER + "', date: '" + STAMP + "',");

  fs.writeFileSync(FILE, src);

  // sw.js — its own number, decoupled from APP_VERSION.
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
    ["'September 26, 2026 · 12:46 AM EDT'", "'" + STAMP + "'"],
    ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
    ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
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
  console.log('patch-629: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-629 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
