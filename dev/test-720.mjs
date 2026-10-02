#!/usr/bin/env node
/**
 * 72.0 - an album knows who it is by, and an import never drops a playlist.
 *
 * The owner's words: "something from before importing albums deleted my existing
 * playlists" and "all the albums say unknown artist when you import them", then
 * "make sure stuff like this never happens ever again".
 *
 * So this gate pins three things, and one of them it EXECUTES:
 *
 *   * there is ONE answer to "who is this album by" - scAlbumArtist() - it is what
 *     the album card asks, and it treats a stored "Unknown artist" as nothing, so
 *     that literal can never win over the songs again. [2] lifts the function out
 *     of the page and runs it against four libraries, including the exact shape
 *     the old import produced.
 *   * the import STOPS MAKING IT UP (an older album zip no longer stamps an
 *     artist into every album) and the repair pass fills the real one in - at boot
 *     (so a library that already came through an album zip is fixed by the update
 *     itself, with no re-import) and right after the album restore.
 *   * an import cannot drop a playlist: the merge is additive, there is exactly
 *     ONE playlist delete in the whole app, and the merged result is WRITTEN by
 *     the import itself instead of being left to saveMeta(), which deliberately
 *     refuses to write playlists while the Library is on Albums - and importing a
 *     backup is offered from Manage albums, which IS album mode.
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the album-artist lookup, run for real;
 *   [3] the import stops making an artist up;
 *   [4] the repair passes (boot + after an album restore);
 *   [5] an import can never drop a playlist;
 *   [6] what did not move;
 *   [7] the repin moved every gate (no stale pin);
 *   [8] inline script syntax.
 *
 *   node dev/test-720.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '72.3'; /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-72x.mjs when the next release lands */
const PREV = '72.2'; /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-72x.mjs */
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so the checks about 72.0 itself must read the 72.0 entry - 72.0 shared
// the album and playlist words with 71.9, which is the only reason reading the
// head ever passed here (see test-719 and test-718 for the same split).
const OWN = '72.0';
const SHELL_CACHE = 'sidecut-shell-v72.3';

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
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (ownEntry.items || []).join('\n');
    ok(/album/i.test(ownNotes) && /playlist/i.test(ownNotes), 'the notes name the two things this release is about');
    ok(/artist/i.test(ownNotes), 'and the thing the owner actually reported');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-720.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.0';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the album-artist lookup, run for real');
{
  const fnSrc = (src.match(/\n  function scAlbumArtist\(name\)\{[\s\S]*?\n  \}\n/) || [''])[0];
  ok(!!fnSrc, 'the lookup is a single function in the page');
  let scAlbumArtist = null;
  try {
    scAlbumArtist = new Function('userAlbums', 'allTracks', '_ensureTrackMap', 'return ' + fnSrc.trim())(null, null, null);
  } catch (e) { ok(false, 'and it can be lifted out and built: ' + e.message); }
  if (fnSrc && scAlbumArtist) {
    // Each call builds the page's own function against one library, so the
    // lookup is executed, not described.
    const call = (albums, tracks) => {
      const list = tracks.map((t) => Object.assign({}, t));
      const map = new Map(list.map((t) => [t.id, t]));
      const f = new Function('userAlbums', 'allTracks', '_ensureTrackMap', 'return ' + fnSrc.trim());
      return f(albums, list, () => map);
    };
    // 1. an album whose entry knows its artist keeps it.
    ok(call({ 'Cafeteria': { artist: 'Ravi', trackIds: ['t1'] } }, [{ id: 't1', artist: 'Someone else' }])('Cafeteria') === 'Ravi',
      'an album that knows its artist is left alone');
    // 2. THE REPORT: the old import stamped 'Unknown artist' into every album, and
    //    that truthy string beat the songs underneath it. It must not any more.
    ok(call({ 'Cafeteria': { artist: 'Unknown artist', trackIds: ['t1', 't2', 't3'] } },
      [{ id: 't1', artist: 'Ravi' }, { id: 't2', artist: 'Ravi' }, { id: 't3', artist: 'Guest' }])('Cafeteria') === 'Ravi',
      'the literal an older import wrote is treated as nothing, and the songs decide');
    ok(call({ 'Cafeteria': { artist: 'unknown artist', trackIds: ['t1'] } }, [{ id: 't1', artist: 'Ravi' }])('Cafeteria') === 'Ravi',
      'the same for it in any case');
    // 3. an album entry with no artist at all, whose songs carry the album tag.
    ok(call({ 'My Album': { trackIds: [] } }, [{ id: 't1', artist: 'Ravi', album: 'My Album' }, { id: 't2', artist: 'Ravi', album: 'My Album' }])('My Album') === 'Ravi',
      'an album with no artist falls back to the album tag on its songs');
    // 4. nothing knows: an honest empty answer, never the literal.
    ok(call({ 'Mystery': { trackIds: ['t9'] } }, [{ id: 't1', artist: 'Ravi' }])('Mystery') === '',
      'and it answers with nothing rather than a made-up name');
    ok(call({ 'Mystery': { artist: 'Unknown artist', trackIds: [] } }, [])('Mystery') === '',
      'a made-up name is never handed back as an answer');
  }
  ok(src.indexOf('window.__scAlbumArtist = scAlbumArtist;') !== -1, 'the lookup is exposed for this gate');
  ok(src.indexOf('artist: (scAlbumArtist(aName) ||') !== -1,
    'and the album card asks it instead of reading the stored string');
  ok(/if\(own && own\.toLowerCase\(\) !== 'unknown artist'\) return own;/.test(src),
    'the lookup refuses the literal as an answer');
  ok(/\{ key: 'userAlbums', value: userAlbums \}/.test(src), 'and the repair writes the albums row back');
}

console.log('[3] the import stops making an artist up');
{
  ok(src.indexOf('_albFromZip[n] = { artist: \'\',') !== -1,
    'an older album zip is read with no artist stamped into its albums');
  ok(src.indexOf("_albFromZip[n] = { artist: 'Unknown artist',") === -1,
    'the literal the import used to write is gone');
  ok(/if\(Object\.keys\(_albFromZip\)\.length\)\{\n\s*manifest\.settings = \{ userAlbums: _albFromZip/.test(src),
    'and the groups still become settings.userAlbums');
}

console.log('[4] the repair passes');
{
  ok(src.indexOf('function scHealAlbumArtists(){') !== -1, 'there is one repair pass');
  ok(src.indexOf('window.__scHealAlbumArtists = scHealAlbumArtists;') !== -1, 'and it is exposed');
  const calls = count(src, 'try{ scHealAlbumArtists(); }catch(_eHealA){}');
  ok(calls === 2, 'it runs twice: at boot and right after an album restore (' + calls + ')');
  const boot = src.indexOf('try{ scHealBrokenAlbums(); }catch(_eHeal){}');
  ok(boot !== -1 && src.indexOf('try{ scHealAlbumArtists(); }catch(_eHealA){}') > boot,
    'the boot pass runs beside the album id heal, so an update repairs what is already there');
  const restore = src.indexOf('userAlbums = _albMerged;');
  ok(restore !== -1 && src.indexOf('try{ scHealAlbumArtists(); }catch(_eHealA){}', restore) > restore,
    'and the import repairs as soon as the ids point at this device songs');
  // The boot pass must not persist playlists: it runs BEFORE the stored playlists
  // are read back, so a saveMeta() there would write the empty placeholder over
  // them. That is exactly the kind of thing this release exists to prevent.
  const body = (src.match(/\n  function scHealAlbumArtists\(\)\{[\s\S]*?\n  \}\n/) || [''])[0];
  ok(body.indexOf('saveMeta') === -1, 'the repair never persists playlists from the boot path');
  ok(body.indexOf("dbPut('meta', { key: 'userAlbums'") !== -1, 'it writes the albums row and nothing else');
}

console.log('[5] an import can never drop a playlist');
{
  // Exactly one place in the app deletes a playlist, and it is the 71.9 bin
  // behind its own confirmation.
  ok(count(src, 'delete playlists[') === 1, 'there is exactly one playlist delete in the app');
  ok(src.indexOf('async function deletePlaylist(name)') !== -1, 'and it is the one path from 71.9');
  // The import's own merge is additive, for every kind of zip.
  ok(src.indexOf('if(!playlists[name]) playlists[name] = [];') !== -1, 'an import only ever ADDS a playlist');
  ok(src.indexOf('if(id && !playlists[name].includes(id)) playlists[name].push(id);') !== -1,
    'and only ever adds ids to one, never replaces its list');
  ok(!/playlists\s*=\s*manifest/.test(src),
    'no import path assigns the playlists straight out of the zip');
  // And the merged result is WRITTEN by the import itself: saveMeta() refuses to
  // touch playlists in Albums mode, and restoring a backup is offered from the
  // Albums side, so leaving it to saveMeta is how the merge could live only in
  // memory while the stored row kept whatever the zip carried.
  const row = src.indexOf("try{ dbPut('meta', { key: 'playlists', value: playlists }); }catch(_ePlRow){}");
  ok(row !== -1, 'an import writes the playlists row itself');
  ok(row > src.indexOf('if(!_isAlbumsZip) Object.keys(manifest.playlists || {})'),
    'after the merge, not before it');
  ok(src.indexOf("if(libraryMode === 'albums'){") !== -1,
    'and it is needed because saveMeta refuses playlists while the Library is on Albums');
  ok(src.indexOf("if(!_isAlbumsZip) Object.keys(manifest.playlists || {}).forEach(name => {") !== -1,
    'an album zip still touches playlists not at all');
}

console.log('[6] what did not move');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries, 'the changelog still parses');
  if (entries) {
    const prev = entries.find((e) => String(e.version) === PREV);
    ok(!!prev, 'the ' + PREV + ' entry is still there');
    ok(!!prev && (prev.items || []).length >= 6, 'and still carries its notes (' + (prev ? prev.items.length : 0) + ')');
    ok(!!entries.find((e) => String(e.version) === '71.8'), 'and the 71.8 entry behind it');
  }
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  // The 71.9 album export is untouched: it still carries albums, not playlists.
  ok(src.indexOf("kind: 'albums', playlists: {}, tracks: []") !== -1, 'an album export still carries albums');
  ok(src.indexOf("await doExportTracks(ids.slice(), 'sidecut-albums', undefined,") !== -1,
    'and never hands them to the playlist slot');
  ok(src.indexOf('const _isAlbumsZip') !== -1, 'and the import still reads an album zip as albums');
  ok(src.indexOf("delBtn.title = 'Delete playlist';") !== -1, 'the delete bin is still in Manage playlists');
}

console.log('[7] the repin moved every gate');
{
  const dev = path.join(ROOT, 'dev');
  // These legitimately keep a version that is NOT the release this file
  // describes: test-705/test-70 DESCRIBE their own old release, and test-718 and
  // test-719 are the 71.8 and 71.9 gates.
  const KEEPS = new Set(['test-705.mjs', 'test-70.mjs', 'test-718.mjs', 'test-719.mjs', 'test-720.mjs']);
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
    if (t.indexOf('sidecut-shell-v' + PREV) !== -1) staleCache++;
  }
  ok(staleVer === 0, 'no gate still pins the previous version (' + staleVer + ')');
  ok(staleCache === 0, 'and none names the previous shell cache (' + staleCache + ')');
  const ota = fs.readFileSync(path.join(dev, 'ota-update-check.cjs'), 'utf8');
  ok(ota.indexOf("swCache === ('sidecut-shell-v' + APP_VERSION)") !== -1,
    'the published-bundle probe still asserts the cache is the release');
}

console.log('[8] inline script syntax');
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
