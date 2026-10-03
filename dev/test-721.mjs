#!/usr/bin/env node
/**
 * 72.1 - a refetch keeps the albums and singles you removed.
 *
 * The owner's words: "Refetching albums or singles shouldnt refetch every single
 * or album that was deleted too".
 *
 * A removed album or single stays out of the list because the removed list is
 * honoured everywhere a row can enter it. This gate pins every entry point:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the singles fetch always filters the removed list (the opt-out chip is gone);
 *   [3] a saved list cannot hand a removed row back;
 *   [4] every album source asks the removed list, including the AI one;
 *   [5] what did not move;
 *   [6] the repin moved every gate (no stale pin);
 *   [7] inline script syntax.
 *
 *   node dev/test-721.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '72.5.1'; /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-72x.mjs when the next release lands */
const PREV = '72.5'; /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-72x.mjs */
const SHELL_CACHE = 'sidecut-shell-v72.5.1';
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so the checks about 72.1 itself must read the 72.1 entry - the head
// is 72.2 now, and its notes are about Studio (72.2's repin added this split).
const OWN = '72.1';

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
    ok(/album/i.test(ownNotes) && /single/i.test(ownNotes), 'the notes name the two things this release is about');
    ok(/refetch/i.test(ownNotes), 'and the thing the owner actually reported');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(!!entries.find((e) => String(e.version) === '72.0'), 'the 72.0 entry is still behind it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-721.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.1';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the singles fetch always filters the removed list');
{
  ok(count(src, 'var skipHidden = true;') === 1,
    'the singles fetch filters the removed list with no opt-out (' + count(src, 'var skipHidden = true;') + ')');
  ok(src.indexOf('opts.includeHidden') === -1, 'and no caller can ask it not to');
  ok(src.indexOf('!opts.includeHidden') === -1, 'the old opt-out line is gone');
  ok(count(src, 'class="dp-si-deep-refetch"') === 0, 'the put-one-back chip is out of the markup');
  ok(count(src, 'title="Refetch ALL singles') === 0, 'and so is the promise it made');
}

console.log('[3] a saved list cannot hand a removed row back');
{
  ok(src.indexOf('a saved snapshot can never resurrect one') !== -1,
    'the saved popup is checked against the removed list');
  ok(src.indexOf("tmp.querySelectorAll('.dp-ah-x[data-tid]')") !== -1,
    'every saved row is checked, by its id and its name');
  ok(src.indexOf('if(isSingleHidden(x.getAttribute(' + "'data-tid'" + ') || ' + "''" + ', x.getAttribute(' + "'data-tname'" + ') || ' + "''" + '))') !== -1,
    'through the one removed-single test');
}

console.log('[4] every album source asks the removed list');
{
  ok(count(src, 'isAlbumHidden(') >= 8, 'the album fetch asks it everywhere (' + count(src, 'isAlbumHidden(') + ')');
  ok(src.indexOf('if(isAlbumHidden(_aiCid, _aiA.title)) continue;') !== -1,
    'including the AI discography source, which never asked before');
  ok(src.indexOf('exactly a removed album returning on a refetch') !== -1,
    'and the per-artist refetch filters the cache it seeds from');
  ok(src.indexOf('var _hSeed = JSON.parse(localStorage.getItem(' + "'sidecut_hiddenAlbums'" + ") || '[]');") !== -1,
    'using the removed-albums list itself');
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
    ok(!!entries.find((e) => String(e.version) === '71.9'), 'and the 71.9 entry behind it');
  }
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  // The removal and the restore are untouched: both still key by id AND by the
  // normalized name, and Recently Deleted still restores either one.
  ok(src.indexOf('function hideSingle(trackId, trackName)') !== -1, 'a removed single is still recorded');
  ok(src.indexOf("h.indexOf('t:' + t) === -1") !== -1, 'by id AND normalized name');
  ok(src.indexOf('function hideAlbum(collectionId, collectionName)') !== -1, 'and a removed album the same way');
  ok(src.indexOf('function isSingleHidden(trackId, trackName)') !== -1, 'the removed-single test still reads both');
  ok(src.indexOf('function isAlbumHidden(collectionId, collectionName)') !== -1, 'and so does the removed-album test');
  ok(src.indexOf('function restoreSingle(trackId)') !== -1 && src.indexOf('function restoreAlbum(collectionId)') !== -1,
    'Recently Deleted can still restore either one on purpose');
  ok(count(src, 'delete playlists[') === 1, 'there is still exactly one playlist delete in the app');
  ok(src.indexOf("kind: 'albums', playlists: {}, tracks: []") !== -1, 'the 71.9 album export is untouched');
}

console.log('[6] the repin moved every gate');
{
  const dev = path.join(ROOT, 'dev');
  // These describe their own old release and keep a version that is not the head.
  const KEEPS = new Set(['test-705.mjs', 'test-70.mjs']);
  const files = fs.readdirSync(dev).filter((n) => /^test-.*\.mjs$/.test(n) || n === 'ota-update-check.cjs');
  ok(files.length > 20, 'there are the gates to check (' + files.length + ')');
  let staleVer = 0, staleCache = 0;
  // The needles are DERIVED from PREV, never written out: spelling the shell
  // cache here would be rewritten by the cache rule of the next repin sweep,
  // turning this stale check into a search for its own build.
  const ownVer = 'const ' + 'VER' + " = '" + PREV + "'";
  for (const name of files) {
    if (KEEPS.has(name)) continue;
    const t = fs.readFileSync(path.join(dev, name), 'utf8');
    if (t.indexOf(ownVer) !== -1) staleVer++;
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
