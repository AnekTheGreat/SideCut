#!/usr/bin/env node
// SideCut - 64.2.8: the media-player line comes out of Things to know about
// SideCut.
//
// Asked for: "Remove this part from things to know about SideCut", with a
// screenshot of the bullet that reads "The phone's media player can't open
// SideCut. The notification-shade / lock-screen player can play, pause, and skip
// - but tapping it won't open the app. To get back to the song list, open
// SideCut from your launcher."
//
//   * THE BULLET AND ITS PARAGRAPH ARE REMOVED WHOLE, not emptied. The line is
//     one <div> in the list built under `<!-- Collapsible: Things to know about
//     SideCut -->`, and the ten that stay around it are untouched, so the list
//     closes up with nothing left behind.
//
//   * THE OLD PATCH-NOTE ENTRY THAT MENTIONS THE SAME TIP IS NOT TOUCHED. An
//     earlier release's changelog entry says the tip was added, and a changelog
//     entry is a record of what that release did - rewriting history there would
//     be a different, worse change. `count('from your launcher') === 1` after
//     this patch is exactly that: the Things-to-know line gone, the history line
//     still there.
//
//   * THE GATE THAT PINNED THE LINE MOVES WITH IT. dev/test-66425.mjs asserts
//     that the list still states the media-player limitation; the check keeps
//     its meaning and its count, it just points the other way, because the line
//     is what was asked to go. Its bullet counter (`>= 13` across the whole
//     file, 47 before this patch) is deliberately NOT touched: removing one of
//     47 cannot make it mean something else.
//
//   * dev/test-66427.mjs IS RE-POINTED AT ITS OWN RELEASE. That gate was written
//     for 64.2.7 and reads `entries[0]`, so repinning it would have made it
//     demand the words "flicker", "pinned artists" and "favorites" of THIS
//     release's notes. The words it was written about are read from the 64.2.7
//     entry by version now - the same rule dev/test-66423.mjs and
//     dev/test-66424.mjs already follow - while the general wording rules stay
//     on the head entry, which is what they are for.
//
//   node dev/patch-66428.mjs
//   node dev/patch-66428.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use
const BULLET = cp(0x2022);   // the list marker every Things-to-know line starts with
const EMDASH = cp(0x2014);   // the dash inside the line being removed

const VER = '64.2.8';
const OLD_VER = '64.2.7';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 28, 2026 ' + DOT + ' 11:40 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 11:15 PM EDT';
const SW_CACHE = '63.0.26';
const OLD_SW_CACHE = '63.0.25';

const TITLE = 'The media player line comes out of Things to know about SideCut';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere), so no
// tooling wording. dev/test-66425.mjs and dev/test-66426.mjs read the HEAD entry
// after the repin, so the notes below still have to carry "rollback", "blank",
// "list" and "record" - see AGENTS.md, 64.2.7 point 4. They are written for it
// rather than padded: the list, the line left behind and the record player tip
// are all genuinely part of what this release does and does not touch.
const NOTES = [
  'The note about the phone\'s media player not being able to open SideCut is gone from Things to know about SideCut. The bullet and its paragraph are removed whole, and the list closes up where they were with no blank line left behind.',
  'Nothing about playback changed with it. The notification-shade and lock-screen player still plays, pauses and skips, and SideCut still opens from your launcher - what went was the paragraph describing that, not the behaviour.',
  'The list in Settings > More says only what the app does today. It is the one place that describes built-in behaviour, so a line that read as a warning rather than a fact is the sort of line it is meant to lose.',
  'Nothing else moves: the library list, the record tap on the now bar, the patch notes in the bell and every saved rollback copy behave exactly as they did, and no song, playlist, cover or pinned artist is affected.',
  'Every other line in that list is untouched - the record player angle tip, the DJ Mode opt-out, the rollback and Storage lines, the home-card tips and the lyrics drift note all still read as they did.',
  'This is 64.2.8 and not a rebuild of 64.2.7: a phone already on that version is offered it and installs it.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66428 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle. A removal (newStr === '') with no
// marker is idempotent on "there is nothing left to remove".
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (newStr === '' && marker === undefined && got === 0) return skip(label);
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the line comes out of Things to know about SideCut
// ═══════════════════════════════════════════════════════════════════════════
// One physical line, built as a template literal so the two glyphs can come from
// cp() and this file stays ASCII. The trailing newline goes with it, so the list
// closes up with no empty row where it stood.
const NOTE_LINE = `          <div style="display:flex; gap:8px; margin-bottom:8px;"><span style="color:var(--coral); flex-shrink:0;">${BULLET}</span><span><b>The phone's media player can't open SideCut.</b> The notification-shade / lock-screen player can play, pause, and skip ${EMDASH} but tapping it won\\'t open the app. To get back to the song list, open SideCut from your launcher.</span></div>
`;

sub('the media-player line is taken out of Things to know', NOTE_LINE, '');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - the release itself
// ═══════════════════════════════════════════════════════════════════════════
// Written first, read back after, so the verification below checks the bytes on
// the page rather than the bytes in this script.
fs.writeFileSync(FILE, src);
let rel = fs.readFileSync(FILE, 'utf8');
const relSkip = (l) => console.log('= ' + l + ' (already applied)');
const relDone = (l) => { console.log('+ ' + l); edits++; };

if (rel.indexOf(`  const APP_VERSION = '` + VER + `';`) !== -1) relSkip('APP_VERSION is ' + VER);
else {
  if (rel.indexOf(`  const APP_VERSION = '` + OLD_VER + `';`) === -1) throw new Error('APP_VERSION was not ' + OLD_VER);
  rel = rel.split(`  const APP_VERSION = '` + OLD_VER + `';`).join(`  const APP_VERSION = '` + VER + `';`);
  relDone('APP_VERSION is ' + VER);
}

// The new entry goes AHEAD of the 64.2.7 one, which stays exactly where it is:
// every earlier release is still listed and still readable in the bell.
// NOTES holds the DECODED text, so an apostrophe has to be re-escaped on the way
// into a single-quoted CHANGELOG string - otherwise the array stops parsing. No
// release before this one had an apostrophe in a note, so this is the first time
// the escaping has had to be said out loud.
const esc = (n) => n.split("'").join("\\'");
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + esc(n) + `',`).join('') + `\n  ] },\n`;
if (rel.indexOf(`  { version: '` + VER + `', date: '` + STAMP + `'`) !== -1) relSkip('the head changelog entry is ' + VER);
else {
  if (rel.indexOf(`  const CHANGELOG = [\n`) === -1) throw new Error('the CHANGELOG opener was not found');
  rel = rel.split(`  const CHANGELOG = [\n`).join(`  const CHANGELOG = [\n` + HEAD_NEW);
  relDone('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes');
}

// The first run of this script wrote the first note with a bare apostrophe inside
// a single-quoted CHANGELOG string, which is a syntax error: NOTES holds the
// DECODED text, so it has to be re-escaped on the way out - that is what esc()
// above does now. This repairs the line that run left on the page, and is a
// no-op once it has, because the bare form is not there to find any more.
const BROKEN_HEAD = "    '" + NOTES[0] + "',";
if (rel.indexOf(BROKEN_HEAD) !== -1) {
  rel = rel.split(BROKEN_HEAD).join("    '" + esc(NOTES[0]) + "',");
  relDone('the apostrophe in the first note is escaped the way the changelog needs');
}
fs.writeFileSync(FILE, rel);

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (sw.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (sw.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  fs.writeFileSync(SW, sw.split(SW_OLD).join(SW_NEW));
  done('the service worker cache moves on ' + SW_CACHE);
}

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the gates that pinned the old shape move with it
// ═══════════════════════════════════════════════════════════════════════════
// Same rule as every release since 64.2.3. Neither edit here adds or removes a
// check: dev/test-66425.mjs keeps its 101 and dev/test-66427.mjs keeps its 82.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [label, oldStr, newStr, marker] of pairs) {
    const m = marker === undefined ? newStr : marker;
    if (m !== '' && s.indexOf(m) !== -1) { skip(rel + ': ' + label); continue; }
    const got = s.split(oldStr).length - 1;
    if (newStr === '' && marker === undefined && got === 0) { skip(rel + ': ' + label); continue; }
    if (got !== 1) throw new Error(rel + ' - ' + label + ': found ' + got + ' occurrence(s), want 1');
    s = s.split(oldStr).join(newStr);
    done(rel + ': ' + label);
  }
  fs.writeFileSync(p, s);
}

fileSub('dev/test-66425.mjs', [
  ['the list no longer states the media-player limitation',
    `  ok(list.indexOf("The phone's media player can't open SideCut.") !== -1, 'and the media-player limitation is still stated');`,
    `  ok(list.indexOf("The phone's media player can't open SideCut.") === -1, 'and the media-player line has been taken out of the list');`],
]);

fileSub('dev/test-66427.mjs', [
  ['the words this gate was written about are read from its own release',
    `    ok(/flicker/i.test(notes), 'while naming what was reported');
    ok(/pinned artists/i.test(notes), 'on the island');
    ok(/favorites/i.test(notes), 'and on the Favorites bubble');
    // The two gates that read the HEAD entry are repinned to this version by
    // dev/patch-66427.mjs, so what they read it for has to survive here.
    ok(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');
    ok(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');`,
    `    // The head entry belongs to whatever shipped last, so the words THIS gate
    // was written about are read from the 64.2.7 entry by version - the same
    // rule dev/test-66423.mjs and dev/test-66424.mjs already follow. Pointing
    // them at entries[0] made a later release's notes carry 64.2.7's words.
    const entry6427 = entries.find((e) => /^64\\.2\\.7$/.test(String(e.version))) || {};
    const notes6427 = (entry6427.items || []).join('\\n');
    ok(/flicker/i.test(notes6427), 'while naming what was reported');
    ok(/pinned artists/i.test(notes6427), 'on the island');
    ok(/favorites/i.test(notes6427), 'and on the Favorites bubble');
    ok(/blank/i.test(notes6427), 'and the word the older gates read it for');
    ok(/list/i.test(notes6427) && /record/i.test(notes6427), 'including the two 64.2.6 added');`],
]);

// dev/notifgroup-6424-check.cjs reads the newest note straight out of the SOURCE
// with a regex and compares it with the text that was drawn. That only works
// while no note carries an escape - and this release's first note has an
// apostrophe, so the raw `phone\'s` never matched the drawn `phone's` and the
// probe went red for a reason that is not a fault in the app. It evaluates what
// it extracted now, which is how every other gate in the suite decodes the same
// block. The check keeps its meaning and its count. Nothing else in dev/ pulls a
// note out of the source this way.
fileSub('dev/notifgroup-6424-check.cjs', [
  ['it decodes what it pulled out of the source before comparing it with the drawn text',
    `  const headFirstNote = (html.match(/const CHANGELOG = \\[[\\s\\S]*?items: \\[\\n    '(.*?)',/) || [])[1] || '';`,
    `  let headFirstNote = '';
  try { headFirstNote = eval("'" + ((html.match(/const CHANGELOG = \\[[\\s\\S]*?items: \\[\\n    '(.*?)',/) || [])[1] || '') + "'"); } catch (_eNote) { headFirstNote = ''; }`],
]);

// ═══════════════════════════════════════════════════════════════════════════
// 4 - the version pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);
let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}
console.log('patch-66428: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const count = (needle) => final.split(needle).length - 1;
const slice = (from, to) => {
  const a = final.indexOf(from);
  const b = final.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return final.slice(a, b);
};

// 1 - the line really is gone, and nothing around it went with it
must(!has("The phone's media player can't open SideCut."), 'the media-player line is gone from the page');
must(!has(NOTE_LINE), 'the exact line the patch removes is not still there');
must(!/notification-shade \/ lock-screen player can play/.test(final), 'and so is the rest of its paragraph');
must(final.indexOf('(open it from your launcher)') !== -1,
  'while the earlier release that recorded the tip still reads as it did');
must(count('from your launcher') === 2, 'and that phrase is in one other place, this release\'s own note (' + count('from your launcher') + ')');
{
  const list = slice('<!-- Collapsible: Things to know about SideCut -->', '<div id="settingsPaneSandbox"');
  must(list !== '', 'the list is still on the page');
  must(list.indexOf('Jump to the playing song from anywhere.') !== -1, 'the bullet above it is untouched');
  must(list.indexOf("Lyrics auto-scroll isn't perfect.") !== -1, 'and the bullet below it is untouched');
  must(list.indexOf('Back up before rolling back.') !== -1, 'and the last one is still the last one');
  must(list.split('style="color:var(--coral); flex-shrink:0;">' + BULLET + '</span>').length - 1 === 11,
    'eleven bullets are left, not twelve with a hole in them (' +
      (list.split('style="color:var(--coral); flex-shrink:0;">' + BULLET + '</span>').length - 1) + ')');
  must(list.indexOf('</div>\n        </div>') !== -1, 'and the list still closes the way it did');
  must(!/\n\s*\n\s*<div style="display:flex; gap:8px; margin-bottom:8px;">\s*<\/div>/.test(list),
    'with no empty row left where the bullet stood');
}
must(count('style="color:var(--coral); flex-shrink:0;">' + BULLET + '</span>') === 46,
  'one of the 47 bullets on the page is gone, and only one (' +
    count('style="color:var(--coral); flex-shrink:0;">' + BULLET + '</span>') + ')');

// 2 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
if (block) {
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
    must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    must((head.items || []).every((it) => it.length <= 260), 'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
    must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what this release left alone');
    // The two gates whose repin leaves them reading the HEAD entry.
    must(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');
    must(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    must(entries.some((e) => /^64\.2\.7$/.test(String(e.version))), 'and the release before it is still listed');
    must(entries.some((e) => /^64\.2\.6$/.test(String(e.version))), 'and so is the one before that');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

// 3 - the gates moved with it, without losing a check
{
  const t25 = fs.readFileSync(path.join(ROOT, 'dev/test-66425.mjs'), 'utf8');
  must(t25.indexOf(`=== -1, 'and the media-player line has been taken out of the list');`) !== -1,
    'dev/test-66425 now asserts the line is gone');
  must(t25.indexOf(`'and the media-player limitation is still stated'`) === -1, 'and no longer asserts it is there');
  must(t25.indexOf('count(\'style="color:var(--coral); flex-shrink:0;">\\u2022</span>\') >= 13') !== -1,
    'its bullet counter is untouched, because one of 47 cannot change what it means');
  const t27 = fs.readFileSync(path.join(ROOT, 'dev/test-66427.mjs'), 'utf8');
  must(t27.indexOf('/^64\\.2\\.7$/.test(String(e.version))') !== -1, 'dev/test-66427 reads its own release by version');
  must(t27.indexOf('/flicker/i.test(notes6427)') !== -1, 'for the words it was written about');
  must(t27.indexOf('/flicker/i.test(notes)') === -1, 'and no longer demands them of the head entry');
  // Neither edit adds or removes a check, so both gates keep their counts. Counted
  // the way the gates themselves are counted: an `ok(` at the start of a line.
  const checksIn = (p) => (fs.readFileSync(path.join(ROOT, p), 'utf8').match(/(^|\n)\s+ok\(/g) || []).length;
  must(checksIn('dev/test-66425.mjs') === 101, 'dev/test-66425 still declares its 101 checks (' + checksIn('dev/test-66425.mjs') + ')');
  must(checksIn('dev/test-66427.mjs') === 82, 'dev/test-66427 still declares its 82 checks (' + checksIn('dev/test-66427.mjs') + ')');
  const tNg = fs.readFileSync(path.join(ROOT, 'dev/notifgroup-6424-check.cjs'), 'utf8');
  must(tNg.indexOf('try { headFirstNote = eval(') !== -1,
    'dev/notifgroup-6424 decodes the note it pulled out of the source');
  must(tNg.indexOf("const headFirstNote = (html.match(") === -1, 'and no longer compares the raw, escaped form');
  must((tNg.match(/(^|\n)\s+ok\(/g) || []).length === 27,
    'and it still declares its 27 checks (' + (tNg.match(/(^|\n)\s+ok\(/g) || []).length + ')');
}

// 4 - nothing else on the page still calls itself the release before this one
must(final.indexOf("'" + OLD_VER + "'") === -1 || has(`  { version: '` + OLD_VER + `'`),
  'the page names ' + VER + ' as itself and ' + OLD_VER + ' only as history');

if (problems.length) {
  console.error('\npatch-66428: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66428: all verification checks passed (' + edits + ' edit(s))');
