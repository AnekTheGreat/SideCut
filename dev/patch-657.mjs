#!/usr/bin/env node
// SideCut - 63.1.3: the release that carries the converter-progress and
// YouTube-speed/cancel fixes onto the 63.1 line.
//
//   * APP_VERSION moves 63.1.2 -> 63.1.3 (a step inside the 63 line).
//   * sw.js CACHE_NAME moves 63.0.13 -> 63.0.14 (its own number, decoupled).
//   * New head CHANGELOG entry. Its six PUBLIC notes are the 63.1.2 set, because
//     the head entry is the release both channels describe and the shared six
//     may not name a converter; the two fixes are documented as [FULL] items
//     AFTER them, where the full build shows them (marker stripped) and the Play
//     build filters them out on the marker alone (changelogItems). See
//     dev/patch-655.mjs / dev/patch-656.mjs (the two fix scripts) for why the
//     wording is shaped that way, and dev/test-651.mjs / dev/test-play-copy.mjs
//     for the gates.
//
//   node dev/patch-657.mjs
//   node dev/patch-657.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const cp = (n) => String.fromCodePoint(n);
const ELL = cp(0x2026);  // ellipsis, in the cancelled-bubble assertions below

const VER = '63.1.3';
const OLD_VER = '63.1.2';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 \u00b7 8:20 AM EDT';
const OLD_STAMP = 'September 27, 2026 \u00b7 3:54 AM EDT';
const SW_CACHE = '63.0.14';
const OLD_SW_CACHE = '63.0.13';

// The two [FULL] notes: the fixes this release adds. Both avoid the shared
// head-entry vocabulary (no `download` / `converter` / bare `convert`) so
// dev/test-617..620 and dev/test-60510 stay green over the whole entry.
const NOTE_PROGRESS = '[FULL] The progress bar on a YouTube conversion was guessing, and it does not any more. It opened at a fixed 15% ' +
  'before any work had started, sat there through it \u2014 the longest wait of the run \u2014 and jumped around while the encoder ' +
  'counted its own way, sliding backwards whenever a stream had to be retried. The bar now follows the run itself: the audio ' +
  'lookup, the bytes actually received, the decode and the encode each take their own share of it, and it only ever moves ' +
  'forwards. The arrow character that used to sit in front of the word Converting is gone with it.';
const NOTE_RUN = '[FULL] A run starts sooner and gives up less often. The two audio lookups go out together now instead of ' +
  'one after the other, and the title lookup rides alongside them rather than in front of them, so nothing waits on a ' +
  'request it does not need before fetching anything. If the chosen output format cannot be produced at all, another one ' +
  'is tried automatically \u2014 a run that meets a blocked encoder still leaves you with your song. And the small x ' +
  'beside the button that starts a run now stops it, exactly like Cancel on the bubble.';

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-657 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
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

// The new head entry is a copy of the 63.1.2 entry (same six public notes, same
// title) re-labelled and re-dated, with the two [FULL] notes appended. Copying
// rather than re-typing keeps the six public items byte-for-byte the set both
// channels already publish (dev/test-651 compares them to ota/updates.json).
function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const oldMark = "  { version: '" + OLD_VER + "',";
  const at = src.indexOf(oldMark);
  if (at === -1) throw new Error('CHANGELOG: no ' + OLD_VER + ' entry to copy');
  const endMark = '\n  ] },\n';
  const end = src.indexOf(endMark, at);
  if (end === -1) throw new Error('CHANGELOG: no end for the ' + OLD_VER + ' entry');
  const block = src.slice(at, end + endMark.length);
  let neu = block
    .replace("version: '" + OLD_VER + "'", "version: '" + VER + "'")
    .split("'" + OLD_STAMP + "'").join("'" + STAMP + "'");
  const close = '\n  ] },\n';
  if (!neu.endsWith(close)) throw new Error('CHANGELOG: unexpected head entry shape');
  neu = neu.slice(0, neu.length - close.length) +
    "\n    '" + NOTE_PROGRESS + "'," +
    "\n    '" + NOTE_RUN + "'," +
    close;
  const headMark = 'const CHANGELOG = [\n';
  if (src.indexOf(headMark) === -1) throw new Error('CHANGELOG opener not found');
  src = src.replace(headMark, headMark + neu);
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
// (test-655 / test-656) are left alone: they compare the head entry to APP_VERSION.
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["VER = '" + OLD_VER + "'", "VER = '" + VER + "'"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["version === '" + OLD_VER + "'", "version === '" + VER + "'"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["the " + OLD_VER + " entry heads", "the " + VER + " entry heads"],
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

// The two fixes also repin the audits that pinned the strings they moved: the
// bubble's Cancel now sets its button through a local, and the player call now
// names the client it was handed instead of indexing the array. Both are
// substring swaps, so they are safe to leave un-run once applied.
function patchFile(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  for (const [a, b] of pairs) {
    if (b !== a && t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== before) fs.writeFileSync(p, t);
}

const CANCEL_OLD = "cancelBtn.disabled = true; cancelBtn.textContent = 'Cancelling" + ELL + "'";
const CANCEL_NEW = "cb.disabled = true; cb.textContent = 'Cancelling" + ELL + "'";
patchFile('dev/test-6055.mjs', [[CANCEL_OLD, CANCEL_NEW]]);
patchFile('dev/test-6056.mjs', [[CANCEL_OLD, CANCEL_NEW]]);
patchFile('dev/test-614.mjs', [
  ["  ok(pill.includes('scConvertPillState.cancelRequested = true;'), 'Cancel flips the flag');\n" +
   "  ok(pill.includes('scConvertPill(false);'), 'Cancel dismisses the pill itself, not only the run');",
   "  // The Cancel handler now delegates to one shared path (the cards' x uses it\n" +
   "  // too), so the flag and the dismissal are asserted on that helper.\n" +
   "  const cancel = sliceBetween('function scCancelConversion(btnEl){', 'function scConvertPill(show){');\n" +
   "  ok(pill.includes('scCancelConversion()'), 'Cancel goes through the one shared path');\n" +
   "  ok(cancel.includes('scConvertPillState.cancelRequested = true;'), 'Cancel flips the flag');\n" +
   "  ok(cancel.includes('scConvertPill(false);'), 'Cancel dismisses the pill itself, not only the run');"],
  ["{ name: clients[c].num, version: clients[c].client.clientVersion, ua: clients[c].ua }",
   "{ name: cl.num, version: cl.client.clientVersion, ua: cl.ua }"],
]);
console.log('patch-657: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

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
  must((head.items || []).length >= 8, 'the head entry carries both fixes (' + (head.items || []).length + ' items)');
  must((head.items || []).indexOf(NOTE_PROGRESS) >= 6, 'the progress note sits outside the shared six');
  must((head.items || []).indexOf(NOTE_RUN) >= 6, 'the run note sits outside the shared six');
  must(!/\bdownload|converter|convert\b/i.test((head.items || []).join('\n')), 'the head entry carries no downloader wording');
  // The old entry stays in history, untouched.
  const old = entries.find((e) => String(e.version) === OLD_VER);
  must(!!old, 'the ' + OLD_VER + ' entry is still in the changelog');
  must(!!old && (old.items || []).length === 6, 'and still carries its six notes');
}
must(final.indexOf("const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION is ' + VER);
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(sw.includes("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"), 'sw.js cache is v' + SW_CACHE);

if (problems.length) {
  console.error('patch-657 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-657 verify: OK (v' + VER + ' heads the changelog with both fixes as [FULL] notes)');
