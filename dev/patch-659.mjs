#!/usr/bin/env node
// SideCut - 63.1.4: the release that carries the album work onto the 63.1 line.
//
//   * APP_VERSION moves 63.1.3 -> 63.1.4 (a step inside the 63 line).
//   * sw.js CACHE_NAME moves 63.0.14 -> 63.0.15 (its own number, decoupled).
//   * New head CHANGELOG entry with SIX fresh public notes. Unlike 63.1.3 this
//     release adds nothing that may not be named on both channels: the notes
//     describe albums, so the same six can be published everywhere and no
//     [FULL] item is needed. dev/test-617..620, -60510 and -651 read the whole
//     entry, and dev/test-play-copy reads it against a wider term list.
//
//   node dev/patch-659.mjs
//   node dev/patch-659.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.1.4';
const OLD_VER = '63.1.3';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 \u00b7 10:36 AM EDT';
const OLD_STAMP = 'September 27, 2026 \u00b7 8:20 AM EDT';
const SW_CACHE = '63.0.15';
const OLD_SW_CACHE = '63.0.14';

const TITLE = 'The albums SideCut made for you are gone, and Manage albums searches';

// Six notes, all publishable on both channels: no downloader wording anywhere in
// them (dev/test-617..620 and dev/test-60510 read the whole head entry, and
// dev/test-play-copy reads the Play copy against a wider list than the filter
// knows). Written the way the report put it, without dressing any of it up.
const NOTES = [
  'SideCut used to write album entries for itself, each one a copy of the album tag it found on your files, and keep them out of the Albums tab while listing them in Manage albums under "Not created by you". That second list is gone: every album in the app is now an album you made.',
  'Those entries are deleted on the first launch after this update, not hidden. That is what frees the names they had taken \u2014 creating an album called something an automatic entry was already using no longer answers "an album named that already exists" and quietly files your songs into an album you could not see.',
  'Nothing you made is touched. An album you created, renamed, reordered or filed songs into by hand never carried the mark the app put on its own entries, so every one of them keeps its songs, its order and its artist exactly as they were. An older album that was never marked at all is kept too.',
  'Nothing is lost with the entries that go: an automatic album was only ever a copy of an album tag that is still on your songs. The songs, the tags and the by-album grouping are all still there, and the startup notice says so rather than reading like a deletion.',
  'Manage albums has a search box at the top now. Type part of an album name or an artist and the list narrows as you type, with a count of how many still match, a word when nothing does, and a clear button that puts the whole list back. What you typed survives renaming or deleting an album from the list, and opening the panel fresh starts unfiltered.',
  'The album picker, the Switch album strip in the reorder sheet and the Albums tab all read the same list now \u2014 yours. Nothing in the app offers you an album it made for itself, because it no longer makes any.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-659 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// The head entry is built from its own six notes rather than copied from the
// entry above it: this release describes something new, and none of it is
// channel-restricted, so both channels publish the same set.
function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const items = NOTES.map((n) => "    '" + n + "',").join('\n');
  const block = "  { version: '" + VER + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
    items + '\n  ] },\n';
  const headMark = 'const CHANGELOG = [\n';
  if (src.indexOf(headMark) === -1) throw new Error('CHANGELOG opener not found');
  src = src.replace(headMark, headMark + block);
  done('CHANGELOG head entry (' + VER + ')');
}

sub('APP_VERSION',
  "  const APP_VERSION = '" + OLD_VER + "';",
  "  const APP_VERSION = '" + VER + "';",
  1, "const APP_VERSION = '" + VER + "';");

headEntry();
fs.writeFileSync(FILE, src);

const SW = path.join(ROOT, 'sw.js');
const swTxt = fs.readFileSync(SW, 'utf8');
const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
if (swTxt.includes(newSw)) {
  console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
} else {
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
  const n = swTxt.split(oldSw).length - 1;
  if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
  fs.writeFileSync(SW, swTxt.split(oldSw).join(newSw));
  console.log('+ sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
}

// Version pins across the suite. The gates that name their own release on purpose
// (test-655, test-656, and this release's own test-658) are left alone: they
// compare the head entry to APP_VERSION instead of hard-coding the next one.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["VER = '" + OLD_VER + "'", "VER = '" + VER + "'"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
  ["the " + OLD_VER + " notes", "the " + VER + " notes"],
  ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs', 'test-658.mjs']);

let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== before) fs.writeFileSync(p, t);
}
// The 63.1.3 gates read their two [FULL] notes out of the HEAD entry, because that
// release headed the changelog. This one heads it now, so they read their own entry
// instead — the same repin 63.1.3 applied to the release under it. Their claim that
// the notes sit after the six shared items still holds inside their own entry.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== before) fs.writeFileSync(p, t);
}
const verLookup = "const rel = entries && entries.find((e) => String(e.version) === '" + OLD_VER + "');\n";
fileSub('dev/test-655.mjs', [
  ['const note = head ? (head.items || []).find((i) => /progress bar on a YouTube conversion was guessing/.test(i)) : null;',
   verLookup + 'const note = rel ? (rel.items || []).find((i) => /progress bar on a YouTube conversion was guessing/.test(i)) : null;'],
  ['ok(!!note && head.items.indexOf(note) >= 6,', 'ok(!!note && rel.items.indexOf(note) >= 6,'],
]);
// This probe still asserted the shape the sw cache had BEFORE it was decoupled from
// APP_VERSION (AGENTS.md, "sw.js cache name (Sep 26, 2026)") — so it has been red on
// every release since, because a cache name of its own can never contain the app
// version. Repinned to the rule that is actually in force: versioned, and NOT the
// app version.
fileSub('dev/ota-update-check.cjs', [
  ["  ok('the service worker cache name tracks the app version',\n     !!swCache && swCache.indexOf(String(APP_VERSION)) !== -1, JSON.stringify(swCache) + ' vs v' + APP_VERSION);",
   "  // The cache name carries its OWN number on purpose (AGENTS.md, \"sw.js cache name\"):\n" +
   "  // it is bumped when the shell changes, not on every app version, so it must be\n" +
   "  // versioned and it must not be the app version.\n" +
   "  ok('the service worker cache name is versioned, and is not the app version',\n     !!swCache && /^sidecut-shell-v\\d+(\\.\\d+)*$/.test(swCache) && swCache.indexOf(String(APP_VERSION)) === -1,\n     JSON.stringify(swCache) + ' vs v' + APP_VERSION);"],
]);

fileSub('dev/test-656.mjs', [
  ['const note = head ? (head.items || []).find((i) => /A run starts sooner and gives up less often/.test(i)) : null;',
   verLookup + 'const note = rel ? (rel.items || []).find((i) => /A run starts sooner and gives up less often/.test(i)) : null;'],
  ['ok(!!note && head.items.indexOf(note) >= 6,', 'ok(!!note && rel.items.indexOf(note) >= 6,'],
]);

console.log('patch-659: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification ----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
must(!!entries, 'the CHANGELOG array parses');
if (entries) {
  const head = entries[0];
  must(String(head.version) === VER, 'the head entry is v' + VER + ' (got ' + (head && head.version) + ')');
  must((head.items || []).length === NOTES.length, 'the head entry carries this release notes (' + (head.items || []).length + ')');
  must((head.items || []).every((it, i) => it === NOTES[i]), 'and they are the notes this script wrote');
  must(String(head.title || '') === TITLE, 'with its own title');
  must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
    'the head entry carries no downloader wording');
  must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'nothing here is full-build-only');
  const old = entries.find((e) => String(e.version) === OLD_VER);
  must(!!old, 'the ' + OLD_VER + ' entry is still in the changelog');
  must(!!old && (old.items || []).length === 8, 'and still carries its six notes plus its two fixes');
}
must(final.indexOf("const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION is ' + VER);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(sw.includes("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"), 'sw.js cache is v' + SW_CACHE);

const blocks = final.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = 0;
blocks.forEach((b) => {
  const body = b.replace(/<\/?script[^>]*>/gi, '');
  if (!body.trim()) return;
  try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
});
must(bad === 0, 'every inline script block still parses');

if (problems.length) {
  console.error('patch-659 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-659 verify: OK (v' + VER + ' heads the changelog with six album notes)');
