#!/usr/bin/env node
// SideCut - 64: the QOL and polish release.
//
//   * APP_VERSION moves 63.1.4 -> 64 (the 63 line is closed; the next release
//     after 63.1.4 is 64, per the release rule in AGENTS.md).
//   * sw.js CACHE_NAME moves 63.0.15 -> 63.0.16 (its own number, decoupled —
//     it must NOT contain the app version, and '63.0.16' does not contain '64').
//   * New head CHANGELOG entry: SIX notes that publish on both channels, then
//     TWO [FULL] notes for the work that only exists on the build with the
//     built-in tools. dev/test-617..620, -60510 and -651 read the whole entry,
//     and dev/test-play-copy reads the Play copy against a wider term list than
//     the shared filter knows — so the six carry no tooling wording at all, and
//     the two that do are marked [FULL] and sit at index 6 and 7.
//
//   node dev/patch-661.mjs
//   node dev/patch-661.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '64';
const OLD_VER = '63.1.4';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 \u00b7 11:56 AM EDT';
const OLD_STAMP_1 = 'September 27, 2026 \u00b7 10:36 AM EDT';
const OLD_STAMP_2 = 'September 27, 2026 \u00b7 8:20 AM EDT';
const SW_CACHE = '63.0.16';
const OLD_SW_CACHE = '63.0.15';

const TITLE = 'The QOL pass: covers stop repeating, the assistant stops leaving you with an error, and your rollback history is yours again';

// Six notes that publish everywhere. dev/test-play-copy reads these against a
// WIDER term list than dev/test-617 knows about (it adds mp3, converting,
// conversion, get song, hand-off ...), so none of them names a tool: they
// describe what changed without naming what it is called.
const NOTES = [
  'Picking a picture for an artist no longer shows you the same sleeve over and over. The grid was built one square per song, and every song carries its own copy of that art, so ten songs off one album put ten identical squares in it. It is one square per image now, and the artist singles are asked for as well as the albums \\u2014 which is where a lot of the pictures that were missing were hiding.',
  'The assistant stops leaving you with an error when the service behind it is briefly busy. That is the same question working a moment later, so it is retried before anything is said, and if it still cannot answer, the question is answered from the knowledge built into the app with the line underneath saying which one answered. It also stops denying its own features: the tools this app really has are named in what it is told about the app, so it no longer tells you a feature is not there when it is.',
  'The pinned artists row on Discover is a rounded card on a raised surface with a hairline border now, instead of a flat block of the theme colour running edge to edge and butted against the search box.',
  'Every slider in Settings follows your finger \\u2014 a bigger thumb on a filled track, instead of the small native one that you could only move by tapping where you wanted it to land. The seek bar above the player is draggable too: the file clock used to write the playhead position back into it several times a second, which pulled the thumb out from under your finger mid-drag, and it does not any more.',
  'Free up space no longer deletes any of your saved rollback copies. They are the list the version picker shows and the way back to a build that worked, and the button was trimming them to the newest six; it leaves every one of them alone now, and the Storage panel says so instead of promising a cap. It also stops reading every page-sized copy twice just to report how much it had freed.',
  'A red error banner that read updateNpDisplay is not defined, after a refetch of missing covers or a watermark clean, is gone. The refresh those two jobs were reaching for was never defined anywhere in the app; it exists now, so the now bar updates itself instead of failing, and that refresh no longer counts as a play.',
];

// The two that only exist on the build with the built-in tools. None of them may
// carry \bdownload, "converter" or a whole-word "convert" — the shared gate reads
// the WHOLE head entry, not just the six — and none of them may name the build
// that lacks the tools.
const FULL_NOTES = [
  '[FULL] Long runs finish sooner. The encoder was handing the thread back eighteen times a second and paying for a wake-up each time; it works in longer slices now, which is about a third more work for every time it stops, and the screen cannot tell the difference. The pause between songs in an album or playlist run was a flat three quarters of a second and is a fifth of that, which is ten seconds back on a twelve-song album.',
  '[FULL] The first-run guide, the step-by-step scenarios and the plain-text summary now describe what this build actually does: paste a Spotify or YouTube link and SideCut makes the file itself, tagged and with its cover art, instead of walking you out to another site to do it by hand. The build that accepts only your own files keeps the walkthrough it already had, which is what it should have been doing all along.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-661 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
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

function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const items = NOTES.concat(FULL_NOTES).map((n) => "    '" + n + "',").join('\n');
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

// Version pins across the suite. test-655 and test-656 read the 63.1.3 entry by
// its own version (repinned by dev/patch-659.mjs), so they are untouched here.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["VER = '" + OLD_VER + "'", "VER = '" + VER + "'"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
  ["'" + OLD_STAMP_1 + "'", "'" + STAMP + "'"],
  ["'" + OLD_STAMP_2 + "'", "'" + STAMP + "'"],
  ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
  ["the " + OLD_VER + " notes", "the " + VER + " notes"],
  ["const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "';", "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "';"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);

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

// dev/test-658.mjs is the gate for the album release, and its release-metadata
// block reads the HEAD entry — which was its own release then and is this one
// now. It reads its own entry by version instead, the same repin dev/patch-659
// applied to the 63.1.3 gates, so its claim ("the notes describe what THIS
// release did", asserted with /auto/) keeps meaning what it meant.
fileSub('dev/test-658.mjs', [
  [`    ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
    ok(!/play build|play version|play install/i.test(entries[0].items.join(' ')), 'notes never name the play build');
    ok(!/\\bdownload|converter|convert\\b/i.test(entries[0].items.join(' ')), 'new notes carry no downloader term');
    ok(/auto/i.test(entries[0].items.join(' ')), 'and the notes describe what this release did');`,
   `    const rel = entries && entries.find((e) => String(e.version) === '${OLD_VER}');
    ok(!!rel && (rel.items || []).length >= 5, 'patch notes: ' + (rel && rel.items.length));
    ok(!!rel && !/play build|play version|play install/i.test(rel.items.join(' ')), 'notes never name the play build');
    ok(!!rel && !/\\bdownload|converter|convert\\b/i.test(rel.items.join(' ')), 'new notes carry no downloader term');
    ok(!!rel && /auto/i.test(rel.items.join(' ')), 'and the notes describe what that release did');`],
]);

// The same claim in dev/test-6139.mjs, which pins the head version literally.
fileSub('dev/test-6139.mjs', [
  [`  ok(entries[0].version === '${VER}', '${OLD_VER.split('.')[0]} heads the changelog');`,
   `  ok(entries[0].version === '${VER}', '${VER} heads the changelog');`],
]);


console.log('patch-661: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
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
  must((head.items || []).length === NOTES.length + FULL_NOTES.length,
    'the head entry carries this release notes (' + (head.items || []).length + ')');
  // The notes are written into index.html with \uXXXX escapes, which the eval
  // above turns into the real characters — so the expected values are unescaped
  // the same way before they are compared.
  const wantNotes = NOTES.concat(FULL_NOTES)
    .map((n) => n.replace(/\\u([0-9a-fA-F]{4})/g, (m, h) => String.fromCodePoint(parseInt(h, 16))));
  must((head.items || []).every((it, i) => it === wantNotes[i]), 'and they are the notes this script wrote');
  must(String(head.title || '') === TITLE, 'with its own title');
  must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
    'the whole head entry carries no downloader term');
  must(!/play build|play version|play install/i.test((head.items || []).join('\n')),
    'and never names the build without the tools');
  must((head.items || []).slice(0, 6).every((it) => it.indexOf('[FULL]') === -1),
    'the first six publish on every channel');
  must((head.items || []).slice(6).every((it) => it.indexOf('[FULL] ') === 0),
    'and the two tooling notes are marked full-build-only');
  const old = entries.find((e) => String(e.version) === OLD_VER);
  must(!!old, 'the ' + OLD_VER + ' entry is still in the changelog');
}
must(final.indexOf("const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION is ' + VER);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
must(swCache === 'sidecut-shell-v' + SW_CACHE, 'sw.js cache is v' + SW_CACHE + ' (got ' + swCache + ')');
must(swCache.indexOf(String(VER)) === -1, 'and does not contain the app version');

const blocks = final.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = 0;
blocks.forEach((b) => {
  const body = b.replace(/<\/?script[^>]*>/gi, '');
  if (!body.trim()) return;
  try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
});
must(bad === 0, 'every inline script block still parses');

if (problems.length) {
  console.error('patch-661 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-661 verify: OK (v' + VER + ' heads the changelog, six shared notes and two full-build notes)');
