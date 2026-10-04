#!/usr/bin/env node
/**
 * 71.9 - an album export carries albums, and a playlist can be deleted.
 *
 * The owner's words: "Whenever I import my zip for albums it imports it as
 * playlists in library it not supposed do that obviously and add a delete
 * playlist function in library".
 *
 * Two claims to pin, and one thing to prove is NOT there:
 *
 *   * an ALBUM export writes albums (settings.userAlbums, in album shape, plus
 *     the card order) and writes no playlists at all, and its zip says which kind
 *     of zip it is (manifest.kind = 'albums');
 *   * the import reads that zip as albums - including the OLDER zips people
 *     already have, which say it only in their file name - and does NOT also turn
 *     their groups into playlists, which is the bug, verbatim;
 *   * there is one delete path for a playlist, with a real in-app confirmation,
 *     it refuses the three lists that are not the user's, and Manage playlists
 *     carries a bin beside the rename pencil.
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] an album export carries albums, never playlists;
 *   [3] the import reads an album zip as albums (and the older ones too);
 *   [4] one delete path, and the bin in Manage playlists;
 *   [5] what did not move;
 *   [6] the repin moved every gate (no stale pin);
 *   [7] inline script syntax.
 *
 *   node dev/test-719.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.5'; /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-72x.mjs when the next release lands */
const PREV = '73.1.4'; /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-72x.mjs */
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so the checks that are about 71.9 itself must read the 71.9 entry -
// 72.0 happened to share the words album and playlist, which is the only reason
// reading the head ever passed here.
const OWN = '71.9';
const SHELL_CACHE = 'sidecut-shell-v73.1.5';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

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
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/stripe/i.test(items.slice(0, 6).join('\n')), 'and the first six name no card page');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (ownEntry.items || []).join('\n');
    ok(/album/i.test(ownNotes) && /playlist/i.test(ownNotes), 'the notes name the two things this release is about');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-719.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '71.9';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] an album export carries albums, never playlists');
{
  // The helper takes the album map as its own parameter ...
  ok(/async function doExportTracks\(ids, filenameBase, manifestPlaylists, kindLabel, manifestAlbums\)/.test(src),
    'the zip helper takes albums as well as playlists');
  // ... and writes them where albums live, never into manifest.playlists.
  ok(src.indexOf("kind: 'albums', playlists: {}, tracks: []") !== -1,
    'an album zip declares itself and writes no playlists at all');
  ok(/settings: \{ userAlbums: manifestAlbums, albumOrder: Object\.keys\(manifestAlbums\) \}/.test(src),
    'its albums go to settings.userAlbums in card order');
  // The call site: albums must NOT occupy the playlist argument any more.
  ok(src.indexOf("await doExportTracks(ids.slice(), 'sidecut-albums', undefined,") !== -1,
    'the album export passes albums in the album slot, not the playlist slot');
  ok(src.indexOf("await doExportTracks(ids.slice(), 'sidecut-albums', albumGroups,") === -1,
    'and the old call that handed albums to the playlist slot is gone');
  // The groups are album-shaped, not an array of ids.
  ok(/albumGroups\[name\] = \{\n\s*artist: entry\.artist \|\| 'Unknown artist',\n\s*trackIds: kept,/.test(src),
    'each album group is album-shaped (artist + trackIds + manual), not a bare id list');
  // The card order is read, with the local row appended so nothing is lost.
  ok(/const _albNames = \(typeof albumOrder !== 'undefined' && Array\.isArray\(albumOrder\)/.test(src),
    'the album export reads the card order');
  ok(/Object\.keys\(userAlbums \|\| \{\}\)\.forEach\(function\(n\)\{ if\(_albNames\.indexOf\(n\) === -1\) _albNames\.push\(n\); \}\)/.test(src),
    'and appends any album the order did not name');
  // Export playlist is unchanged: it still carries its playlist grouping.
  ok(/\{ \[activePlaylist\]: ids \}, `"\$\{activePlaylist\}"`\)/.test(src),
    'exporting a playlist still carries that playlist');
}

console.log('[3] the import reads an album zip as albums');
{
  ok(src.indexOf('const _isAlbumsZip') !== -1, 'the import recognizes an albums zip');
  // New zips say so with a marker; older ones only in their file name - and the
  // owner's existing zip is one of the older ones, so this half is not optional.
  ok(/const _isAlbumsZip = \(manifest\.kind === 'albums'\) \|\|/.test(src),
    'new album zips are recognized by their marker');
  ok(/!manifest\.settings && \/\^sidecut-albums\/i\.test\(String\(\(file && file\.name\) \|\| ''\)\)/.test(src),
    'and the older ones by the file name an album export has always used');
  // An older album zip's groups are re-read as albums ...
  ok(src.indexOf('_albFromZip[n] = { artist:') !== -1,
    'an older album zip is read as albums, in album shape');
  ok(src.indexOf("manifest.settings = { userAlbums: _albFromZip, albumOrder: Object.keys(_albFromZip) };") !== -1,
    'and becomes settings.userAlbums, not playlists');
  // ... and the playlist merge is skipped for an album zip - the double-read that
  // made a playlist per album, which is exactly the owner's report.
  ok(src.indexOf('if(!_isAlbumsZip) Object.keys(manifest.playlists || {}).forEach(name => {') !== -1,
    'its groups are not ALSO made into playlists');
  // The backup album order is preferred over whatever this device had.
  ok(src.indexOf("var _bkOrder = (manifest.settings && Array.isArray(manifest.settings.albumOrder)) ? manifest.settings.albumOrder : [];") !== -1,
    'the import prefers the backup album order');
  ok(/var _mergedOrder = \[\];\n\s*_bkOrder\.forEach\(function\(n\)\{ if\(userAlbums\[n\] && _mergedOrder\.indexOf\(n\) === -1\) _mergedOrder\.push\(n\); \}\);/.test(src),
    'and seeds the merged order with it first');
  // The full backup carries the order too, so the setting exists on both paths.
  ok(src.indexOf("albumOrder: (typeof albumOrder !== 'undefined' && Array.isArray(albumOrder)) ? albumOrder.slice() : [],") !== -1,
    'the full backup carries the album card order');
}

console.log('[4] one delete path, and the bin in Manage playlists');
{
  ok(src.indexOf('async function deletePlaylist(name)') !== -1, 'there is one delete path for a playlist');
  ok(src.indexOf('window.__scDeletePlaylist = deletePlaylist;') !== -1, 'and it is exposed for the gates');
  ok(src.indexOf('function modalConfirm(title, message, okLabel)') !== -1,
    'with a real in-app confirmation (confirm() is unreliable in the WebView)');
  ok(/bd\.style\.zIndex = '250';/.test(src), 'that sits above the discover popup it can be opened from');
  // The three lists that are not the user's to delete.
  ok(src.indexOf("if(target === 'All Songs' || target === 'Favorites' || target === UNSORTED_VIEW || target === 'Unsorted'){") !== -1,
    'it refuses Library, Favorites and Unsorted (the stored list AND the virtual view)');
  ok(src.indexOf('if(!target || !playlists[target]) return false;') !== -1,
    'and a name that is not a playlist');
  // Every per-playlist row the name leaves behind is cleared with it.
  ok(src.indexOf("hiddenPlaylists.delete(target)") !== -1, 'a hidden flag is cleared with the playlist');
  ok(src.indexOf("djDisabledPlaylists.delete(target)") !== -1, 'its DJ Mode setting is cleared');
  ok(src.indexOf("delete perPlaylistSort[target]") !== -1, 'and its saved sort');
  // The view moves somewhere that still exists.
  ok(/if\(activePlaylist === target\)\{\n\s*activePlaylist = 'All Songs';/.test(src),
    'the open playlist moves to the Library instead of pointing at a gone list');
  ok(src.indexOf('rememberPlaylist(activePlaylist)') !== -1, 'and that move is remembered');
  // One path: the old menu delete is a thin wrapper, not a second implementation.
  ok(/function deleteActivePlaylist\(\)\{\n\s*deletePlaylist\(activePlaylist\);\n\s*\}/.test(src),
    'the old delete-a-playlist action is a thin wrapper over the one path');
  ok(src.indexOf("Delete \"${activePlaylist}\"? This won't delete") === -1,
    'and the old confirm()-based playlist delete is gone');
  // The bin in Manage playlists.
  ok(src.indexOf("delBtn.title = 'Delete playlist';") !== -1, 'Manage playlists carries a delete bin');
  ok(src.indexOf('delBtn.innerHTML =') !== -1, 'with a real icon');
  ok(/if\(name !== 'Favorites' && name !== 'Unsorted'\)\{\n\s*const delBtn/.test(src),
    'and it is not offered for Favorites or the stored Unsorted list');
  ok(/deletePlaylist\(name\); \}\);/.test(src), 'the bin runs the one path');
}

console.log('[5] what did not move');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries, 'the changelog still parses');
  if (entries) {
    const prev = entries.find((e) => String(e.version) === PREV);
    ok(!!prev, 'the ' + PREV + ' entry is still there');
    ok(!!prev && (prev.items || []).length >= 6, 'and still carries its notes (' + (prev ? prev.items.length : 0) + ')');
    ok(!!entries.find((e) => String(e.version) === '71.7'), 'and the 71.7 entry behind it');
  }
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  // Export playlists and selection export keep their own shape.
  ok(src.indexOf("await doExportTracks(ids, activePlaylist.replace(/[^a-z0-9]/gi,'_'), { [activePlaylist]: ids },") !== -1,
    'exporting a playlist is untouched');
  ok(src.indexOf("await doExportTracks(ids, `sidecut-selection-${ids.length}`, manifestPlaylists, 'selection');") !== -1,
    'and exporting a selection is untouched');
  ok(src.indexOf('userAlbums: userAlbums || {},') !== -1, 'the full backup still ships the albums themselves');
}

console.log('[6] the repin moved every gate');
{
  const dev = path.join(ROOT, 'dev');
  // These legitimately keep a version that is NOT the release this file
  // describes: test-705/test-70 DESCRIBE their own old release, and test-718 is
  // the 71.8 gate and names 71.8 on purpose.
  const KEEPS = new Set(['test-705.mjs', 'test-70.mjs', 'test-718.mjs', 'test-719.mjs']);
  const files = fs.readdirSync(dev).filter((n) => /^test-.*\.mjs$/.test(n) || n === 'ota-update-check.cjs');
  ok(files.length > 20, 'there are the gates to check (' + files.length + ')');
  let staleVer = 0, staleCache = 0;
  // The needles are DERIVED from PREV, never written out: spelling the shell
  // cache out here would be rewritten by the cache rule of the next repin sweep,
  // turning this stale check into a search for its own build.
  for (const name of files) {
    if (KEEPS.has(name)) continue;
    const t = fs.readFileSync(path.join(dev, name), 'utf8');
    if (t.indexOf("const VER = '" + PREV + "'") !== -1) staleVer++;
    // PREV is a PREFIX of this release name (72.5 of 72.5.1), so a bare indexOf
    // would also match this release's own cache. The dot-boundary keeps the
    // check about a cache that is genuinely older (added by dev/repin-7251.mjs).
    if (new RegExp('sidecut-shell-v' + PREV.replace(/\./g, '\\.') + '(?!\\.)').test(t)) staleCache++;
  }
  ok(staleVer === 0, 'no gate still pins the previous version (' + staleVer + ')');
  ok(staleCache === 0, 'and none names the previous shell cache (' + staleCache + ')');
  const ota = fs.readFileSync(path.join(dev, 'ota-update-check.cjs'), 'utf8');
  ok(ota.indexOf("swCache === ('sidecut-shell-v' + APP_VERSION)") !== -1,
    'the published-bundle probe still asserts the cache is the release');
}

console.log('[7] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
