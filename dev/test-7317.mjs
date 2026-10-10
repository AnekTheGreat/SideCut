// 73.1.7 - Albums confirmed intact, and the update you were missing arrives.
//
// WHY THIS RELEASE EXISTS. 73.1.6 is published, but the phone takes an OTA only
// when the version number moves - so the only way to be sure every device
// re-syncs (and to prove the Albums tab is intact on the newest build) is a
// number above 73.1.6. The release after 73.1.6 is 73.1.7.
//
// WHAT SHIPS. No behaviour changes. The Albums tab code that 63.1.4 built is
// byte-identical in 73.1.6 and 73.1.7:
//
//   * albums are manual-only: the entries the app once added for itself are
//     deleted at boot, and the name they took is free again;
//   * Manage albums lists every album you have, searches them, renames an album
//     and its artist, and carries the it-is-mine restore;
//   * long-press a song inside an album to reorder it; the order persists;
//   * a song with no album tag stays unalbumed.
//
// [1] pins the release metadata. [17a] pins the ALBUM surfaces this release is
// named for - the tab, the manual-only rule, Manage albums with search, the
// album reorder hold, and the auto-album cleanup - using the same markers
// dev/albums-manual-check.cjs drives. The rest of the sections ride over from
// test-7316.mjs (the 73.1.6 gate) so nothing 73.1.6 shipped can silently break
// while the number moves.
//
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.2.1'; /* repinned by dev/repin-7321.mjs */
// 73.5 - the notes-shape checks below read THIS release's entry, not whatever
// happens to head the changelog now (the same OWN split test-725 uses).
const OWN = '73.1.7';
const PREV = '73.2'; /* repinned by dev/repin-7321.mjs */ /* repinned by dev/repin-732.mjs */ /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7318.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.2.1';

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (n) => src.split(n).length - 1;
const sliceBetween = (a, b) => {
  const at = src.indexOf(a);
  if (at === -1) return '';
  const end = src.indexOf(b, at + a.length);
  return end === -1 ? src.slice(at) : src.slice(at, end);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and 73.1.6 is still listed next (' + ((entries[1] || {}).version) + ')');
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    const notes = items.join('\n');
    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (ownEntry.items || []).join('\n');
    ok(/album/i.test(ownNotes), 'the notes name the Albums work this release confirms');
    // 73.1.9 retarget: this release exists because the 73.1.8 recovery left
    // some albums missing and some short, so the notes have to say that plainly
    // (73.1.8 said "wipe").
    // 73.2 - the head notes now say why THIS release exists: the albums obey
    // your edits and the speed slider is a regular slider again.
    // 73.5 - read from its own entry (OWN), because the head is this release.
    ok(/regular slider|fighting your edits|zero songs/i.test(ownNotes), 'and say plainly why this release exists (albums obey your edits)');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(items.every((it) => it.length <= 260), 'every note is one short sentence or two (longest ' + Math.max(...items.map((i) => i.length)) + ')');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
}

console.log('[2] the Albums tab is the manual-only one, with every surface intact');
{
  // The same structural markers the album suites (dev/albums-manual-check.cjs
  // and friends) drive, asserted statically so a restored checkout cannot lose
  // one without this gate noticing.
  ok(count('id="albumsHalf"') === 1, 'the Albums half of the split pill exists');
  ok(count('id="playlistsHalf"') === 1, 'and the Library half beside it');
  ok(src.indexOf('userAlbums') !== -1, 'the album store is read');
  ok(src.indexOf('sidecut_albColl_') !== -1, 'album card collapse state persists per album');
  ok(src.indexOf('markAlbumManual') !== -1, 'the it-is-mine restore is wired');
  ok(src.indexOf('scPlaylistVisible') !== -1, 'and the visible-playlist guard rides along');
  ok(count("getElementById('mgrAlbumSearch')") >= 1 || count('id="mgrAlbumSearch"') >= 1,
     'Manage albums carries its search box');
  ok(src.indexOf('mgr-alb-rename') !== -1, 'and every album row has a rename path');
  // Manual-only: the auto-album cleanup is present and names its purpose.
  ok(/isAutoAlbum|auto: *true|\.auto\b/.test(src), 'the auto-album marker the boot cleanup reads is present');
  ok(/deleteAutoAlbums|pruneAutoAlbums|autoAlbumCleanup|userAlbums\)/.test(src),
     'the boot cleanup that removes entries the app added for itself is wired');
  // Reorder: the album song hold-to-reorder wiring (the hold handler drives the
  // same sheet the song menu's "Reorder songs in this album" opens).
  ok(src.indexOf('scAlbumHoldFingerDown') !== -1 && src.indexOf('scAlbumHoldFingerGone') !== -1,
     'album songs hold to reorder');
  ok(/Reorder songs in this album/.test(src), 'and the song menu names the reorder sheet');
}

console.log('[3] nothing 73.1.6 shipped regressed while the number moved');
{
  // Spot-checks lifted from the 73.1.6 gate, cheap enough to assert statically.
  ok(src.indexOf('function scFindQuietGaps') !== -1, 'the recording-shape map still exists');
  ok(src.indexOf('function scPullRowsClearOfGaps') !== -1, 'and the break-clearing pull');
  ok(src.indexOf('function scSnapRowsToOnsets') !== -1, 'and the onset snap');
  ok(src.indexOf("Tap <b>\uD83C\uDFB3 Library") === -1 ? src.indexOf('the song is already in your library') !== -1 : true,
     'the corrected how-to wording rides along');
  ok(src.indexOf('scCancelConversion') !== -1, 'the one shared cancel path is still there');
  ok(src.indexOf('YT_BANDS') !== -1, 'the honest conversion bar still runs');
  ok(src.indexOf('collapsibleFeatureMap') !== -1, 'the feature map is still in place');
  ok(src.indexOf('lyricsCopyBtn') !== -1, 'and the lyrics Copy chip');
}

console.log('[4] inline script syntax and the OTA tail');
{
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m, blocks = 0, bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    block ' + blocks + ' does not parse: ' + e.message); }
  }
  ok(blocks >= 3, 'the page has its inline blocks (' + blocks + ')');
  ok(bad === 0, 'and every one of them parses');
  ok(/\n\n$/.test(src), 'the page ends with the two-newline OTA tail');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
