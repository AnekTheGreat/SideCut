#!/usr/bin/env node
/**
 * 72.3 - a new single is caught when it lands, and the release page plays it.
 *
 * The owner asked why Fetch latest and Upcoming releases missed a single the
 * Discover refetch found, and asked for those surfaces to hand over the track on
 * the day it drops. This gate pins both halves where they live:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the artist catalog is read on its own, and a one-track release is kept;
 *   [3] the check reaches a second storefront;
 *   [4] a landed drop is handed its track;
 *   [5] a song in the library is in All Songs;
 *   [6] what did not move;
 *   [7] the repin moved every gate (no stale pin);
 *   [8] inline script syntax.
 *
 *   node dev/test-723.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.2'; /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */
const PREV = '73.1.1'; /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */ /* repinned by dev/repin-724.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.2';
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so the checks about 72.3 itself must read the 72.3 entry - the head
// is 72.4 now, and its notes are about what a Spotify link is named after
// (72.4's repin added this split).
const OWN = '72.3';

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
    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (ownEntry.items || []).join('\n');
    ok(/all songs/i.test(ownNotes), 'and the note about a song reaching All Songs');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(/single/i.test(ownNotes) && /release/i.test(ownNotes), 'and the two things this release is about');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(!!entries.find((e) => String(e.version) === '72.2'), 'the 72.2 entry is still behind it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-723.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.3';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the catalog is read on its own, and a one-track release is kept');
{
  ok(count(src, 'async function scItunesArtistAlbums(artist){') === 1, 'there is one catalog reader');
  ok(count(src, 'await scItunesArtistAlbums(artist)') === 1, 'and it is called once per artist');
  ok(src.indexOf('var _idAlbums = await scItunesArtistAlbums(artist);') === -1,
    'the read is no longer hidden inside the album search success branch');
  const passAt = src.indexOf('var _catAlbums = await scItunesArtistAlbums(artist);');
  const albumBlockEnd = src.indexOf('albPick.slice(0, 5).forEach');
  ok(passAt !== -1, 'the catalog pass runs on its own');
  ok(passAt > albumBlockEnd, 'after the album block, so a refused album search cannot skip it');
  ok(src.indexOf("var _catStores = ['', '&country=IN'];") !== -1, 'and reaches a second storefront');
  // A one-track release is the single it is, under its song rather than its label.
  ok(count(src, 'function scSingleTitle(name){') === 1, 'a one-track release names its song');
  ok(src.indexOf('window.__scSingleTitle = scSingleTitle;') !== -1, 'and that is reachable');
  ok(/replace\(\/\\s\+\[-\\u2013\\u2014\]\\s\*single\\s\*\$\/i, ''\)/.test(src),
    'by stripping the filing wrapper, not the song');
  ok(src.indexOf("kind: _oneTrack ? 'single' : 'album',") !== -1, 'and a one-track release is kept');
  ok(src.indexOf('var _oneTrack = (r.trackCount || 0) === 1;') !== -1, 'with its one-track test named once');
  ok(src.indexOf('_catCand.slice(0, 8).forEach') !== -1, 'bounded so the back catalog cannot flood the list');
  ok(src.indexOf('if(!_cNew && !_cNoNewer) return;') !== -1, 'and gated to genuinely new releases');
  ok(src.indexOf("if(freshTitles.has(r.collectionName.toLowerCase().trim() + '|' + _cDate)) return;") !== -1,
    'a drop named twice is still one row');
  ok(src.indexOf('it is often not in the top-200 either') !== -1,
    'and the popularity note no longer pretends the song pass is enough');
}

console.log('[3] the check reaches a second storefront');
{
  const fn = src.slice(src.indexOf('async function scItunesArtistAlbums(artist){'), src.indexOf('function scSingleTitle(name){'));
  ok(fn.indexOf('&entity=album&limit=200') !== -1, 'the catalog is read by album entity');
  ok(fn.indexOf("+ '&entity=album&limit=200' + _catStores[_csi];") !== -1, 'with the storefront appended per pass');
  ok(fn.indexOf('for(var _csi = 0; _csi < _catStores.length; _csi++){') !== -1, 'looping the storefronts');
  ok(fn.indexOf('if(_catSeen[_ccid]) return;') !== -1, 'and collapsing a collection named twice by its id');
  ok(fn.indexOf("var _ccid = String(r.collectionId || r.collectionName);") !== -1, 'on the id, or the name when there is none');
  ok(fn.indexOf("if(!credited(norm(primaryArtistName(r.artistName || '')))) return;") !== -1,
    'still insisting the artist is really the one pinned');
}

console.log('[4] a landed drop is handed its track');
{
  ok(count(src, 'async function scDeliverDueReleases(){') === 1, 'there is one resolver');
  ok(src.indexOf('window.__scDeliverDueReleases = scDeliverDueReleases;') !== -1, 'and it is reachable');
  ok(src.indexOf('try{ await scDeliverDueReleases(); }catch(_eDel){}') !== -1, 'and runs from every check');
  const fn = src.slice(src.indexOf('async function scDeliverDueReleases(){'), src.indexOf('window.__scDeliverDueReleases = scDeliverDueReleases;'));
  ok(fn.indexOf('if(window.__scUpcomingDay(r.date)) return;') !== -1, 'a drop still on the way is left alone');
  ok(fn.indexOf('if(r.previewUrl && (r.url || r.cid)) return;') !== -1, 'one that already carries its track is left alone');
  ok(fn.indexOf('if(r._deliverTried === _today) return;') !== -1, 'and it looks once per drop per day');
  ok(fn.indexOf('_due = _due.slice(0, 12);') !== -1, 'bounded per run');
  ok(fn.indexOf("entity=song&limit=10") !== -1, 'it looks the song up');
  ok(/__scSameArtistName\(primaryArtistName\(s\.artistName/.test(fn),
    'and only accepts the artist it pinned');
  ok(fn.indexOf('_d.rel.previewUrl = _match.previewUrl') !== -1, 'and hands the row its playable preview');
  ok(fn.indexOf('_d.rel.cid = _match.collectionId') !== -1 && fn.indexOf('_d.rel.url = _match.trackViewUrl') !== -1,
    'its release link and its collection id');
  ok(fn.indexOf('if((_match.trackCount || 0) === 1) _d.rel.kind = \'single\';') !== -1,
    'and calls a one-track release a single');
  ok(fn.indexOf('await savePinnedArtists()') !== -1, 'what it resolves is saved');
  ok(/async function scDeliverDueReleases\(\)\{[\s\S]{0,4000}?finally\{ _scDeliverBusy = false; \}/.test(src),
    'and the run cannot wedge');
}

console.log('[5] a song in the library is in All Songs');
{
  const fn = src.slice(src.indexOf('function saveMeta(){'), src.indexOf('// Single source of truth for what gets written'));
  ok(fn.indexOf("if(libraryMode === 'albums')") === -1, 'saveMeta no longer bails out on Albums');
  ok(fn.indexOf("dbPut('meta', { key: 'playlists', value: playlists });") !== -1,
    'and writes the playlists row on every call');
  ok(fn.indexOf("dbPut('meta', { key: 'idCounter', value: idCounter });") !== -1, 'alongside the id counter');
  ok(fn.indexOf("dbPut('meta', { key: 'userAlbums', value: userAlbums });") !== -1, 'and the albums');
  // All Songs is a STORED list; Unsorted is a live filter over allTracks. That
  // mismatch is exactly why a dropped write showed a song in one and not the
  // other, so both sides of it are pinned.
  ok(src.indexOf("rawIds = allTracks.map(t => t.id).filter(id => !inSomePlaylist.has(id));") !== -1,
    'Unsorted is still the live filter over the track list');
  ok(src.indexOf("playlists['All Songs'].push(id);") !== -1, 'a converted song is still pushed into All Songs');
  ok(count(src, "playlists['All Songs'].push(id);") === 2, 'and so is an imported one');
  ok(src.indexOf("playlists['All Songs'] = allTracks.map(t => t.id);") !== -1,
    'and an import still rebuilds the whole list');
  // The only two playlist writes reachable from the Albums half are both
  // refused in Albums mode, which is what makes the saveMeta guard unnecessary.
  const alb = src.slice(src.indexOf('function deleteUserAlbum(name){'), src.indexOf('function buildAlbumsIds(){'));
  ok(alb.indexOf("if(libraryMode === 'albums'){ toast('Use \"Remove from album\" instead.'); return; }") !== -1,
    'the song kebab refuses to touch a playlist on Albums');
  ok(alb.indexOf("if(libraryMode === 'albums'){ renderList(); return; }") !== -1,
    'and the reorder commit does too');
  ok(count(alb, 'playlists[') === 4, 'so neither of the two writes left there can run on Albums');
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
    ok(!!entries.find((e) => String(e.version) === '72.1'), 'and the 72.1 entry behind it');
  }
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  ok(count(src, 'function openReleasePage(artist, title){') === 1, 'the release page is where it was');
  ok(count(src, 'function fetchArtistSingles(artistName, opts){') === 1, 'the Discover singles refetch is untouched');
  ok(src.indexOf('var skipHidden = true;') !== -1, 'and still hides what the owner removed');
  ok(count(src, 'function fetchArtistReleases(artist){') === 1, 'the release reader is still one function');
  ok(src.indexOf('var mbFresh = (typeof window.__scMbUpcoming === ') !== -1, 'and still reads the open catalogs');
  ok(src.indexOf('var wdFresh = (typeof window.__scWdUpcoming === ') !== -1, 'both of them');
  ok(src.indexOf('let pinnedCheckPromise = null;') !== -1, 'one shared check, never re-entered');
  ok(src.indexOf('await Promise.race([') !== -1, 'a stalled catalog still times out per artist');
}

console.log('[7] the repin moved every gate');
{
  const dev = path.join(ROOT, 'dev');
  const KEEPS = new Set(['test-705.mjs', 'test-70.mjs']);
  const files = fs.readdirSync(dev).filter((n) => /^test-.*\.mjs$/.test(n) || n === 'ota-update-check.cjs');
  ok(files.length > 20, 'there are the gates to check (' + files.length + ')');
  let staleVer = 0, staleCache = 0;
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
