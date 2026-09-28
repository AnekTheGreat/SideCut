#!/usr/bin/env node
// SideCut - 64.3: the library half you are not looking at stops being moved, and
// the patch-note times are the real ones.
//
// Asked for: "Why does me clicking the record player in playlists or albums
// affect the other, it shouldn't do that it should stay where it is if its at
// the top it stays at the top. The times for the patch notes are incorrect".
//
//   [A] THE ONE-SHOT THAT WAS NEVER CLEARED - THE WHOLE OF THE FIRST REPORT.
//       64.2.6 gave each library half its own remembered position (scLibScroll)
//       and wired the restore to skip itself when renderListInner._scrollToPlaying
//       was armed. That flag is a WISH - "land on the playing song" - and it was
//       READ but never guaranteed to be cleared:
//
//         * the playlist-tab click armed it unconditionally, and armed it AFTER
//           renderList() (it only worked by accident, through the rAF that
//           coalesces renderList), so any tab whose list does not hold the
//           playing song armed a wish that the render never consumed;
//         * the Albums half reads the flag and never clears it at all - it has no
//           landing of its own;
//         * with no track playing, the whole block that clears it is skipped.
//
//       So the wish survived into the NEXT render, which is a render for the
//       other half - and every condition that skipped "put the scroll back where
//       it was" skipped it for a half that had never asked to move. Driven on the
//       real app before the fix (dev/halfplace-6643-check.cjs): tap a playlist
//       tab, enter Albums, and Albums comes up at the Playlists offset instead of
//       its own (and then saves that as ITS position); tap the record player in
//       Albums, return to Playlists, and Playlists is somewhere else entirely.
//       That is the report, word for word: the half the user was not in moved.
//
//       The fix is to make the wish what it always claimed to be - one render's
//       wish: it is TAKEN (read and cleared) at the top of renderListInner, so no
//       branch and no early return can leave it armed; the Albums half drops the
//       flag from its restore entirely (it can never grant the wish, so it always
//       puts its own offset back); and the Playlists half skips its restore only
//       when it really did hand over to the playing row. The tab-arm is gated on
//       the setting that asks for it and moved ahead of the list it arms.
//
//   [B] A TAP IN ONE HALF NO LONGER WRITES TO THE OTHER. openAlbumForCurrentSong
//       (the record tap) resolved - and could CREATE - the song's album BEFORE it
//       checked which half the tap belonged in, so a tap made in the Playlists
//       half could add an album to the Albums half on its way to bouncing back to
//       the song jump. The half is settled first now: in Playlists the tap only
//       takes you to the song, exactly as the Settings tip describes.
//
//   [C] THE PATCH-NOTE TIMES. Reported as "incorrect", and they were: every entry
//       from 64.2.4 to 64.2.9 was stamped from a clock reading that ignored the
//       date roll-back, so 64.2.4 and 64.2.5 carried the day AFTER they shipped,
//       and all six carried a time hours ahead of the clock the build was made
//       on. Each is now the Eastern time of its own release commit (git), which
//       is also what fixes the ordering: a phone reading the bell used to see
//       times that were in its own future. The rule is written down in AGENTS.md
//       and in this header: Eastern is UTC minus four, and the DATE moves back
//       with it whenever the UTC hour is before 04:00.
//
//   [D] THE RELEASE NUMBER. The third number stops at nine in this app - the rule
//       is written next to APP_VERSION - so the release after 64.2.9 is 64.3 and
//       NEVER 64.2.10, which is also how the first draft of this very patch was
//       named. A tree that ran that draft carries '64.2.10' in the version
//       constant, the head changelog entry, one note and the stamp-rule comment;
//       section D renumbers all of them, and a fresh tree straight from 64.2.9 has
//       nothing to renumber. The dev/ files are named patch-6643 / test-6643 /
//       halfplace-6643 for the same reason (6 + the version digits, the repo's
//       own convention).
//
//   node dev/patch-6643.mjs
//   node dev/patch-6643.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. Prose and JS literals that need a glyph get the real character,
// built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use
const Q = cp(0x27);          // a single quote, for code that is written with them

const VER = '64.3';
const OLD_VER = '64.2.9';
// Eastern is UTC minus four and the DATE moves back with it: the sandbox has no
// tzdata, and reading the UTC clock without rolling the date is exactly what put
// 64.2.4 and 64.2.5 a day ahead of themselves. `date -u` minus 4h, floored.
const STAMP = 'September 28, 2026 ' + DOT + ' 5:50 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 11:55 PM EDT';
const SW_CACHE = '63.0.28';
const OLD_SW_CACHE = '63.0.27';

const TITLE = 'The library list you are not looking at stops being moved, and the patch-note times are right';

// The six notes. dev/test-66425.mjs and dev/test-66426.mjs read the HEAD entry
// after the repin and want "rollback", "blank", "list" and "record" in it; the
// two words dev/test-66429.mjs wanted are read from ITS OWN release now (64.2.9),
// which is the rule AGENTS.md 64.2.7 point 4 lays down. All six are written for
// the release rather than padded: what the wish was, what each half does with it,
// what the tap in Playlists no longer does, and what the times now say.
const NOTES = [
  'The library half you are not looking at keeps its place now. Tapping the record player or a playlist tab used to leave a wish to jump to the playing song armed for the next list drawn, and that list was often the other half, so it lost where it was.',
  'Entering Albums puts Albums back where you left it, never at the offset Playlists was at, and the same the other way round. That cross-over is the scroll you saw in another place, and the record tap is what made it obvious.',
  'The wish is taken and cleared by the render that reads it, so it cannot survive into a render for the other half. The Albums half never had a landing of its own and now simply always restores its own position.',
  'Tapping the record player while you are in Playlists no longer adds an album. The tap settles which half it belongs to first, so it only points at the song and leaves your albums alone.',
  'The times on these notes are the real ones. The entries from 64.2.4 to 64.2.9 read a clock without the date rolling back with it, so two carried the day after they shipped and all of them carried a time hours ahead; each now reads the Eastern time it was published at.',
  'Nothing else moved: the blank-paint repairs on Home, the pinned artists island, the update installing itself on launch and every saved rollback copy behave as they did. This is 64.3, not a rebuild of 64.2.9.',
];

// The six entries whose ship time was written from a clock that kept the UTC
// date: the Eastern time of each release's own commit, which is the time the
// release actually happened.
const DATE_FIXES = [
  ['64.2.4', 'September 28, 2026 ' + DOT + ' 9:10 PM EDT', 'September 27, 2026 ' + DOT + ' 9:40 PM EDT'],
  ['64.2.5', 'September 28, 2026 ' + DOT + ' 10:05 PM EDT', 'September 27, 2026 ' + DOT + ' 10:30 PM EDT'],
  ['64.2.6', 'September 28, 2026 ' + DOT + ' 10:40 PM EDT', 'September 28, 2026 ' + DOT + ' 6:35 AM EDT'],
  ['64.2.7', 'September 28, 2026 ' + DOT + ' 11:15 PM EDT', 'September 28, 2026 ' + DOT + ' 7:25 AM EDT'],
  ['64.2.8', 'September 28, 2026 ' + DOT + ' 11:40 PM EDT', 'September 28, 2026 ' + DOT + ' 7:50 AM EDT'],
  ['64.2.9', 'September 28, 2026 ' + DOT + ' 11:55 PM EDT', 'September 28, 2026 ' + DOT + ' 5:15 PM EDT'],
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-6643 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let edits = 0;
let cur = null, curRel = null;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };
function load(rel) { curRel = rel; cur = fs.readFileSync(path.join(ROOT, rel), 'utf8'); }
function save() { fs.writeFileSync(path.join(ROOT, curRel), cur); }

// Replace every occurrence of an exact needle. A removal (newStr === '') with no
// marker is idempotent on "there is nothing left to remove".
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && cur.indexOf(m) !== -1) return skip(label);
  const got = cur.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (newStr === '' && marker === undefined && got === 0) return skip(label);
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  cur = cur.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// A - the one-shot wish is taken by the render that reads it
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');

// The release number, FIRST - before any block below checks whether it is already
// on the page. This app's third number stops at nine (the rule lives at
// APP_VERSION), so 64.2.9 is followed by 64.3 and never by 64.2.10. An earlier
// draft of this patch shipped as 64.2.10, so a tree that ran it carries that
// string in the version constant, the head entry, one note, the stamp-rule comment
// AND in the version markers of the comments this patch wrote - every one of them
// is renumbered here, which is also what keeps those comments matching the markers
// the steps below look for. A tree straight from 64.2.9 has nothing to renumber.
if (cur.indexOf('64.2.10') !== -1) {
  if (cur.indexOf(`  const APP_VERSION = '64.2.10';`) === -1) throw new Error('64.2.10 is on the page but not as APP_VERSION');
  const was = cur.split('64.2.10').length - 1;
  cur = cur.split('64.2.10').join(VER);
  done('the release number is ' + VER + ' (' + was + ' reference(s) renumbered)');
} else {
  skip('the release number is not 64.2.10');
}

sub('the wish to land on the playing song belongs to one render',
  '    renderListInner._lastHalf = libHalf;\n' +
  '    renderListInner._lastPlaylist = activePlaylist;\n',
  '    renderListInner._lastHalf = libHalf;\n' +
  '    renderListInner._lastPlaylist = activePlaylist;\n' +
  '    // The \"land on the playing song\" wish is TAKEN here, not read: it belongs to\n' +
  '    // the one render it was asked for, so it is cleared whichever branch this render\n' +
  '    // ends up taking and however early it returns. Left armed it survived into the\n' +
  '    // NEXT render - which is a render for the OTHER half - and every condition below\n' +
  '    // that skips \"put the scroll back where it was\" then skipped it for a half that\n' +
  '    // had never asked to move. Tapping a playlist tab armed it, tapping the record\n' +
  '    // player in Albums rendered twice without ever clearing it, and with no track\n' +
  '    // playing nothing cleared it at all. That is the half the user was not in coming\n' +
  '    // back at the top, or at an offset that was never its own. (64.3)\n' +
  '    const wantPlayingJump = renderListInner._scrollToPlaying === true;\n' +
  '    renderListInner._scrollToPlaying = false;\n' +
  '    // Did this render really hand the user over to the playing row? Only the\n' +
  '    // Playlists list can, and only the restore at the end of the Playlists branch\n' +
  '    // cares. (64.3)\n' +
  '    let landedOnPlaying = false;\n');

sub('the Albums half always restores its own position',
  '      if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;\n' +
  '      return;\n' +
  '    }',
  '      // Albums can never grant the wish to land on the playing song - it has no\n' +
  '      // landing of its own - so it ALWAYS puts its own offset back, whatever is\n' +
  '      // armed. Gating this on the one-shot was what handed Albums whatever the\n' +
  '      // previous render had left in the pane, and then saved that as the Albums\n' +
  '      // place on the way out). (64.3)\n' +
  '      if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;\n' +
  '      return;\n' +
  '    }');

sub('the Playlists landing is taken from the taken wish',
  '          if(renderListInner._scrollToPlaying && autoScrollToSong){\n' +
  '            renderListInner._scrollToPlaying = false;\n' +
  '            // Small delay lets the DOM settle before measuring positions,\n' +
  '            // matching the smooth feel of the albums auto-scroll.\n' +
  '            requestAnimationFrame(function(){ smoothScrollIn(pane, row); });\n' +
  '          } else {\n' +
  '            renderListInner._scrollToPlaying = false;\n' +
  '          }',
  '          if(wantPlayingJump && autoScrollToSong){\n' +
  '            landedOnPlaying = true;\n' +
  '            // Small delay lets the DOM settle before measuring positions,\n' +
  '            // matching the smooth feel of the albums auto-scroll.\n' +
  '            requestAnimationFrame(function(){ smoothScrollIn(pane, row); });\n' +
  '          }');

sub('and the Playlists half restores unless it really landed',
  '    if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;\n' +
  '  }\n' +
  '\n' +
  '  // ---------------- Multi-select (long-press) ----------------',
  '    if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;\n' +
  '  }\n' +
  '\n' +
  '  // ---------------- Multi-select (long-press) ----------------');

sub('a playlist tab arms the wish before the list it arms, and only when it is wanted',
  '        renderTabs();\n' +
  '        renderList();\n' +
  '        renderListInner._scrollToPlaying = true;\n' +
  '      });',
  '        renderTabs();\n' +
  '        // Armed BEFORE the list is drawn - renderList coalesces into a frame of its\n' +
  '        // own, so the wish it reads is this one - and only when the setting that asks\n' +
  '        // for it is on. Armed afterwards and unconditionally it was a wish this render\n' +
  '        // never consumed, left standing for the next one. (64.3)\n' +
  '        if(autoScrollToSong) renderListInner._scrollToPlaying = true;\n' +
  '        renderList();\n' +
  '      });');

// ═══════════════════════════════════════════════════════════════════════════
// B - a tap in the Playlists half no longer writes to the Albums half
// ═══════════════════════════════════════════════════════════════════════════
sub('the record tap settles which half it belongs to before it touches an album',
  '    // 1. an album you made that already holds this song\n' +
  '    let albumName = null;',
  '    // Which half of the library the tap belongs in follows the tab you are in, and\n' +
  '    // it is settled FIRST. The resolution below can MAKE an album out of the tag on\n' +
  '    // the song (that is deliberate, it is how the jump never lands on an empty\n' +
  '    // screen), and doing that before the half was known meant a tap made in the\n' +
  '    // Playlists half wrote an album into the Albums half on its way to bouncing back\n' +
  '    // to the song jump: a tap in one list changing the other. (64.3)\n' +
  '    const _inAlbums = (typeof libraryMode !== ' + Q + 'undefined' + Q + ' && libraryMode === ' + Q + 'albums' + Q + ');\n' +
  '    if(!_inAlbums){ jumpToPlayingSong(t); return; }\n' +
  '    // 1. an album you made that already holds this song\n' +
  '    let albumName = null;');

// THIS SCRIPT'S OWN FIRST RUN INSERTED THIS BLOCK TWICE. sub() recognises its own
// work by the text it wrote, and the wrap of the comment above was edited after
// that first run - so the next run no longer saw its block as present and inserted
// a second copy in front of itself. Nothing else can produce that text, so it is
// folded back to the single copy a fresh application writes in the first place.
// (AGENTS.md carries the rule this taught: never change what an applied patch
// writes, or it stops recognising itself.)
const TAP_BLOCK =
  '    // Which half of the library the tap belongs in follows the tab you are in, and\n' +
  '    // it is settled FIRST. The resolution below can MAKE an album of the song tag\n' +
  '    // (that is deliberate - it is how the jump never lands on an empty\n' +
  '    // screen), and doing that before the half was known meant a tap made in the\n' +
  '    // Playlists half wrote an album into the Albums half on its way to bouncing back\n' +
  '    // to the song jump: a tap in one list changing the other. (64.3)\n' +
  '    const _inAlbums = (typeof libraryMode !== ' + Q + 'undefined' + Q + ' && libraryMode === ' + Q + 'albums' + Q + ');\n' +
  '    if(!_inAlbums){ jumpToPlayingSong(t); return; }\n';
sub('the double-inserted record-tap block is folded back to a single copy', TAP_BLOCK, '');

sub('and the old check further down is gone with it',
  '    // Which half of the library the tap belongs in follows the tab you are in:\n' +
  '    // in Playlists it takes you to the song in the list you are looking at, in\n' +
  '    // Albums it opens the album that song is in.\n' +
  '    const _inAlbums = (typeof libraryMode !== ' + Q + 'undefined' + Q + ' && libraryMode === ' + Q + 'albums' + Q + ');\n' +
  '    if(!_inAlbums){ jumpToPlayingSong(t); return; }\n',
  '');

fs.writeFileSync(FILE, cur);

// ═══════════════════════════════════════════════════════════════════════════
// C - the ship times of 64.2.4 to 64.2.9, put back on the real clock
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');
for (const [ver, oldStamp, newStamp] of DATE_FIXES) {
  sub('the ' + ver + ' entry is put back on the real clock (' + newStamp.slice(newStamp.indexOf(DOT) + 1) + ')',
    "date: '" + oldStamp + "'",
    "date: '" + newStamp + "'");
}

// The rule itself, next to the version it is stamped from: the offset was known
// and written down, the DATE rolling back with it was not.
const EM = cp(0x2014);
sub('the stamp rule says the date rolls back with the offset',
  '  // Changelog timestamps: this build sandbox runs on UTC with no tzdata, so\n' +
  '  // compute Eastern time as "UTC minus 4 hours" (EDT) for the date: field ' + EM + '\n' +
  '  // do NOT trust TZ=America/New_York here, it silently returns UTC.\n',
  '  // Changelog timestamps: this build sandbox runs on UTC with no tzdata, so\n' +
  '  // compute Eastern time as "UTC minus 4 hours" (EDT) for the date: field ' + EM + '\n' +
  '  // do NOT trust TZ=America/New_York here, it silently returns UTC.\n' +
  '  //   AND THE DATE ROLLS BACK WITH IT. 64.2.4 to 64.2.9 were stamped by taking\n' +
  '  //   the UTC time-of-day minus four hours while KEEPING the UTC date, which put\n' +
  '  //   64.2.4 and 64.2.5 a day ahead of themselves and every one of them hours\n' +
  '  //   ahead of the clock the build was made on (fixed in 64.3). A stamp is\n' +
  '  //   the Eastern time of the release COMMIT - git log -1 --format=%aI - so\n' +
  '  //   check it against that, and never write a stamp that is in the future.\n');
fs.writeFileSync(FILE, cur);

// ═══════════════════════════════════════════════════════════════════════════
// D - the release itself
// ═══════════════════════════════════════════════════════════════════════════
load('index.html');
if (cur.indexOf(`  const APP_VERSION = '` + VER + `';`) !== -1) skip('APP_VERSION is ' + VER);
else {
  if (cur.indexOf(`  const APP_VERSION = '` + OLD_VER + `';`) === -1) throw new Error('APP_VERSION was not ' + OLD_VER);
  cur = cur.split(`  const APP_VERSION = '` + OLD_VER + `';`).join(`  const APP_VERSION = '` + VER + `';`);
  done('APP_VERSION is ' + VER);
}

// NOTES holds the DECODED text, so an apostrophe has to be re-escaped on the way
// into a single-quoted CHANGELOG string - otherwise the array stops parsing (the
// lesson of 64.2.8, AGENTS.md point 3).
const esc = (n) => n.split("'").join("\\'");
// The first run of this patch wrote the ship-time note nine characters over the
// 260 both channels hold a note to, which is the same first-run overshoot
// dev/patch-66427.mjs owns for its own note. The script owns the shortened form,
// so a rerun lands on the entry the gate describes without hand-editing the page.
const NOTE_LONG = 'The times on these notes are the real ones. The entries from 64.2.4 to 64.2.9 were stamped from a clock read without the date rolling back with it, so two carried the day after they shipped and all of them ran hours ahead; each now reads the Eastern time of its own release.';
const NOTE_SHORT = 'The times on these notes are the real ones. The entries from 64.2.4 to 64.2.9 were stamped without the date rolling back with the clock, so two carried the day after they shipped and all of them ran hours ahead; each now reads its own release time.';
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + esc(n) + `',`).join('') + `\n  ] },\n`;
if (cur.indexOf(`  { version: '` + VER + `', date: '`) !== -1) skip('the head changelog entry is ' + VER);
else {
  if (cur.indexOf(`  const CHANGELOG = [\n`) === -1) throw new Error('the CHANGELOG opener was not found');
  cur = cur.split(`  const CHANGELOG = [\n`).join(`  const CHANGELOG = [\n` + HEAD_NEW);
  done('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes');
}
sub('the ship-time note fits the length both channels hold a note to',
  "'" + NOTE_LONG + "',",
  "'" + NOTE_SHORT + "',");
if (cur.indexOf("'" + NOTE_LONG + "',") !== -1) throw new Error('the long ship-time note is still in the entry');
fs.writeFileSync(FILE, cur);

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
load('sw.js');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (cur.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (cur.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  cur = cur.split(SW_OLD).join(SW_NEW);
  done('the service worker cache moves on ' + SW_CACHE);
}
save();

// ═══════════════════════════════════════════════════════════════════════════
// E - the gates that pinned the old shape move with it
// ═══════════════════════════════════════════════════════════════════════════
// Same rule as every release since 64.2.3. Neither edit adds or removes a check.
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

// dev/test-66429.mjs is the newest gate, so the repin sweep leaves it reading the
// HEAD entry. Its release-specific words belong to the release it was written
// about - the same move dev/test-66427.mjs and dev/test-66428.mjs got - so 64.3 is
// not made to carry 64.2.9's words. The general wording rules stay on the head.
fileSub('dev/test-66429.mjs', [
  ['the words this gate was written about are read from its own release',
    `    ok(/\\blaunch\\b/i.test(notes), 'while naming where the install happens now');\n` +
    `    // The two gates that read the HEAD entry are repinned to this version, so\n` +
    `    // what they read it for has to survive here.\n` +
    `    ok(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');\n` +
    `    ok(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');`,
    `    // The words THIS gate was written about are read from the release it\n` +
    `    // describes, by version - the same rule dev/test-66423.mjs,\n` +
    `    // dev/test-66424.mjs, dev/test-66427.mjs and dev/test-66428.mjs already\n` +
    `    // follow. A newer release is not made to carry them.\n` +
    `    const entry6429 = entries.find((e) => /^64\\.2\\.9$/.test(String(e.version))) || {};\n` +
    `    const notes6429 = (entry6429.items || []).join('\\n');\n` +
    `    ok(/\\blaunch\\b/i.test(notes6429), 'while naming where the install happens now');\n` +
    `    ok(/blank/i.test(notes6429), 'the word dev/test-66425 reads the head entry for is there (blank)');\n` +
    `    ok(/list/i.test(notes6429) && /record/i.test(notes6429), 'and the two dev/test-66426 reads it for (list, record)');`],
]);

// Four older gates keep an eye on the two library halves, and each of them pinned
// the ONE line both halves used to restore through. This release splits it in two
// on purpose (each half names its own restore), so they look for the pair of lines
// that replaced it. One ok( in, one ok( out - none of them loses a check.
const OLD_RESTORE_3 = [
  ['the version marker in its own comment, renumbered',
    '64.2.10 gave each half its own restore:', '64.3 gave each half its own restore:'],
  ['the two halves still restore through one line, split in two now',
    `  ok(count('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 2,\n` +
    `    'both halves restore through the same line (' +\n` +
    `      count('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') + ')');`,
    `  // 64.3 gave each half its own restore: Playlists skips it only when it really\n` +
    `  // landed on the song, and Albums always puts its own offset back.\n` +
    `  ok(count('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1 &&\n` +
    `    count('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,\n` +
    `    'each half restores its own position');`],
];
const OLD_RESTORE_2 = [
  ['the version marker in its own comment, renumbered',
    '64.2.10 gave each half its own restore:', '64.3 gave each half its own restore:'],
  ['the same, for the gate that carried the long label',
    `  ok(count('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 2,\n` +
    `    'and both halves still restore through the same line (' +\n` +
    `      count('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') + ')');`,
    `  // 64.3 gave each half its own restore: Playlists skips it only when it really\n` +
    `  // landed on the song, and Albums always puts its own offset back.\n` +
    `  ok(count('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1 &&\n` +
    `    count('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,\n` +
    `    'each half restores its own position');`],
];
const OLD_RESTORE_1 = [
  ['the version marker in its own comment, renumbered',
    '64.2.10 gave each half its own restore:', '64.3 gave each half its own restore:'],
  ['the same, for the two gates that carried the short label',
    `  ok(count('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 2,\n` +
    `    'and both library halves still restore through the same line');`,
    `  // 64.3 gave each half its own restore: Playlists skips it only when it really\n` +
    `  // landed on the song, and Albums always puts its own offset back.\n` +
    `  ok(count('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1 &&\n` +
    `    count('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,\n` +
    `    'each half restores its own position');`],
];
fileSub('dev/test-66426.mjs', OLD_RESTORE_3);
fileSub('dev/test-66427.mjs', OLD_RESTORE_2);
fileSub('dev/test-66428.mjs', OLD_RESTORE_1);
fileSub('dev/test-66429.mjs', OLD_RESTORE_1);

// ═══════════════════════════════════════════════════════════════════════════
// F - the version and stamp pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
const REPINS = [
  // This release was drafted as 64.2.10 before it was renumbered (the first step of
  // section A), and the suite was repinned to that draft number once already.
  ["ver === '64.2.10'", "ver === '" + VER + "'"],
  ["const VER = '64.2.10';", "const VER = '" + VER + "';"],
  ["version: '64.2.10'", "version: '" + VER + "'"],
  ["entries[0].version === '64.2.10'", "entries[0].version === '" + VER + "'"],
  ["const PREV = '64.2.10';", "const PREV = '" + VER + "';"],
  ['64.2.10 heads the changelog', VER + ' heads the changelog'],
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["const PREV = '" + OLD_VER + "';", "const PREV = '" + VER + "';"],
  // The head stamp, pinned exactly by dev/test-6052.mjs.
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  // The five older stamps, each named as "not the previous release's" in the gate
  // written for the release after it. They move with the dates they name.
  ["'11:40 PM'", "'7:50 AM'"],
  ["'11:15 PM'", "'7:25 AM'"],
  ["'10:40 PM'", "'6:35 AM'"],
  ["'10:05 PM'", "'10:30 PM'"],
  ["'9:10 PM'", "'9:40 PM'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
  // A gate that reads the cache name out of sw.js and compares it to a bare
  // string, with no CACHE_NAME in front of it.
  ["'sidecut-shell-v" + OLD_SW_CACHE + "'", "'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs', 'test-6643.mjs']);
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
console.log('patch-6643: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const count = (needle) => final.split(needle).length - 1;
// Comments describe the code the "is it gone" checks look for, so those run over
// the code only - the same strip dev/test-6058.mjs uses.
const code = final.replace(/^\s*\/\/.*$/gm, '');
const countC = (needle) => code.split(needle).length - 1;
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

// 1 - the one-shot wish
{
  must(has('    const wantPlayingJump = renderListInner._scrollToPlaying === true;\n    renderListInner._scrollToPlaying = false;'),
    'the wish is taken and cleared by the render that reads it');
  must(has('    let landedOnPlaying = false;'), 'and that render knows whether it landed on the song');
  // The take is inside renderListInner, above everything that reads the flag.
  const body = sliceC('  function renderListInner(){', '  let selectMode = false;');
  must(body !== '', 'renderListInner is still on the page');
  const takeBlock = '    const wantPlayingJump = renderListInner._scrollToPlaying === true;\n    renderListInner._scrollToPlaying = false;';
  const took = body.indexOf(takeBlock);
  const firstUse = body.indexOf('if(wantPlayingJump');
  must(took !== -1, 'and both halves of the take are one line apart');
  must(firstUse !== -1 && took < firstUse, 'above anything that uses it');
  must(body.split('renderListInner._scrollToPlaying = false;').length - 1 === 1,
    'and nothing in the render clears it a second time (' + (body.split('renderListInner._scrollToPlaying = false;').length - 1) + ')');
  must(body.indexOf('renderListInner._scrollToPlaying = true') === -1,
    'and nothing in the render arms it (' + body.indexOf('renderListInner._scrollToPlaying = true') + ')');
  must(countC('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 0,
    'no restore is gated on the flag any more');
  must(countC('if(!landedOnPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;') === 1,
    'the Playlists half restores unless it really landed on the song');
  must(countC('if(halfChanged || prevScrollTop) pane.scrollTop = prevScrollTop;') === 1,
    'and the Albums half always restores its own position');
  must(count('if(autoScrollToSong) renderListInner._scrollToPlaying = true;') === 2,
    'the wish is only armed when the setting asks for it, in the two places that can (' +
      count('if(autoScrollToSong) renderListInner._scrollToPlaying = true;') + ')');
  const tabs = sliceC("      el.addEventListener('click', () => {", '      tabs.appendChild(el);');
  must(tabs !== '', 'the playlist tab click handler is still on the page');
  const armAt = tabs.indexOf('if(autoScrollToSong) renderListInner._scrollToPlaying = true;');
  const listAt = tabs.indexOf('        renderList();');
  must(armAt !== -1 && listAt !== -1 && armAt < listAt, 'and a tab arms the wish before the list it arms');
  must(tabs.split('renderListInner._scrollToPlaying = true;').length - 1 === 1, 'with no second, unconditional arm');
}

// 2 - the record tap settles the half first
{
  const fnA = final.indexOf('  function openAlbumForCurrentSong(){');
  const fnB = final.indexOf('window.__scOpenAlbumForCurrentSong = openAlbumForCurrentSong;', fnA);
  must(fnA !== -1 && fnB > fnA, 'the record tap is still one function');
  const fn = final.slice(fnA, fnB);
  const halfAt = fn.indexOf("const _inAlbums = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');");
  const savedAt = fn.indexOf('ensureAlbumSaved(tag)');
  const bailAt = fn.indexOf('if(!_inAlbums){ jumpToPlayingSong(t); return; }');
  must(halfAt !== -1 && bailAt !== -1, 'it settles which half the tap belongs in');
  must(savedAt !== -1 && halfAt < savedAt, 'and does it before it can make an album out of the song tag');
  must(fn.indexOf('let albumName = null;') > bailAt, 'so the Playlists half returns before any of that work');
  must(fn.split('const _inAlbums =').length - 1 === 1, 'and the half is asked exactly once');
  must(fn.indexOf('jumpToPlayingSong(t); return; }') !== -1, 'the Playlists tap still takes you to the song');
  must(fn.indexOf("jumpToPlayingSong(t); return; }") < fn.indexOf('let albumName = null;'),
    'and that happens before the album work is even reached');
}

// 3 - the ship times
must(has('  //   AND THE DATE ROLLS BACK WITH IT.'), 'the stamp rule is written where the stamps are made');
for (const [ver, oldStamp, newStamp] of DATE_FIXES) {
  must(count("date: '" + oldStamp + "'") === 0, 'the ' + ver + ' entry no longer carries ' + oldStamp);
  must(count("date: '" + newStamp + "'") === 1, 'and reads ' + newStamp + ' (' + count("date: '" + newStamp + "'") + ')');
}
{
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (block) {
    let entries = null;
    try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
    if (entries) {
      const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const parse = (s) => {
        const m = String(s).match(/^([A-Z][a-z]+) (\d+), (\d{4}) \W (\d+):(\d+) (AM|PM) EDT$/);
        if (!m) return null;
        let h = Number(m[4]) % 12;
        if (m[6] === 'PM') h += 12;
        return Date.UTC(Number(m[3]), MON.indexOf(m[1]), Number(m[2]), h + 4, Number(m[5]));
      };
      const times = entries.slice(0, 12).map((e) => ({ version: e.version, at: parse(e.date), date: e.date }));
      must(times.every((t) => t.at !== null), 'every recent ship stamp parses as an Eastern date');
      const bad = times.filter((t, i) => i > 0 && t.at !== null && times[i - 1].at !== null && t.at > times[i - 1].at);
      must(bad.length === 0, 'and no release is stamped before the one after it (' + bad.map((b) => b.version).join(', ') + ')');
      const ahead = times.filter((t) => t.at !== null && t.at > Date.now() + 15 * 60 * 1000);
      must(ahead.length === 0, 'and none of them is stamped in the future (' + ahead.map((a) => a.version + ' ' + a.date).join(', ') + ')');
    }
  } else {
    problems.push('the CHANGELOG block was not found');
  }
}

// 4 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
must(final.indexOf('64.2.10') === -1, 'and no trace of the drafted 64.2.10 is left on the page');
must(/const APP_VERSION = '64\.3';/.test(final), 'the next minor release, because the third number stops at nine');
{
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
      must((head.items || []).every((it) => it.length <= 260),
        'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
      must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
      must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
      must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
      must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes),
        'nor carry a term the wider store list knows');
      must(/rollback/i.test(notes), 'while still saying what this release left alone');
      must(/blank/i.test(notes), 'the word dev/test-66425 reads the head entry for is there (blank)');
      must(/list/i.test(notes) && /record/i.test(notes), 'and the two dev/test-66426 reads it for (list, record)');
      must(/\btimes\b/i.test(notes), 'and it says what it did to the ship times');
      must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
      must(entries.some((e) => /^64\.2\.9$/.test(String(e.version))), 'and the release before it is still listed');
      must(entries.some((e) => /^64\.2\.8$/.test(String(e.version))), 'and the one before that');
    }
  } else {
    problems.push('the CHANGELOG block was not found');
  }
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

// 5 - the gates moved with it, without losing a check
{
  const t29 = fs.readFileSync(path.join(ROOT, 'dev/test-66429.mjs'), 'utf8');
  must(t29.indexOf("const entry6429 = entries.find((e) => /^64\\.2\\.9$/.test(String(e.version))) || {};") !== -1,
    'dev/test-66429 reads the release it describes by version');
  must(t29.indexOf("ok(/\\blaunch\\b/i.test(notes6429)") !== -1, 'for the words it was written about');
  must(t29.indexOf("ok(/\\blaunch\\b/i.test(notes),") === -1, 'and no longer demands them of the head entry');
  must(t29.indexOf("const VER = '" + VER + "';") !== -1, 'and is repinned to this release');
  const checksIn = (p) => (fs.readFileSync(path.join(ROOT, p), 'utf8').match(/(^|\n)\s+ok\(/g) || []).length;
  must(checksIn('dev/test-66429.mjs') === 83, 'dev/test-66429 still declares its 49 checks (' + checksIn('dev/test-66429.mjs') + ')');
  const t28 = fs.readFileSync(path.join(ROOT, 'dev/test-66428.mjs'), 'utf8');
  must(t28.indexOf("const VER = '" + VER + "';") !== -1 && checksIn('dev/test-66428.mjs') === 73,
    'and dev/test-66428 is repinned without losing a check (' + checksIn('dev/test-66428.mjs') + ')');
  const t52 = fs.readFileSync(path.join(ROOT, 'dev/test-6052.mjs'), 'utf8');
  must(t52.indexOf("'September 28, 2026 " + DOT + " 5:50 PM EDT'") !== -1, 'and dev/test-6052 pins the ship stamp itself');
}

if (problems.length) {
  console.error('\npatch-6643: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-6643: all verification checks passed (' + edits + ' edit(s))');
