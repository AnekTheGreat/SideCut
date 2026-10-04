#!/usr/bin/env node
/**
 * 72.5 - All Songs tells the truth about every song in it.
 *
 * The owner reported duplicate songs in All Songs, songs missing from it, a
 * duplicate where deleting one deleted the other, a search for one artist
 * returning another, the run counting songs as added while the list stayed
 * empty, and the lookup taking forever. This gate pins each one where it lives,
 * and RUNS the helpers that decide the outcome rather than reading them:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] an id is never handed out twice (the real allocator, driven);
 *   [3] a song is in All Songs once, and a landed song is drawn at once;
 *   [4] a search answers with what was asked for;
 *   [5] the lookup stops wasting requests;
 *   [6] what did not move;
 *   [7] the repin moved every gate (no stale pin);
 *   [8] inline script syntax.
 *
 *   node dev/test-725.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.8'; /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */
const PREV = '73.1.7'; /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.8';
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so every check about 72.5 itself reads this entry rather than the
// head - the same split test-718 onward carry (written in from the start here).
const OWN = '72.5';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

// Lift a function declaration out of the page as a callable, with the page's
// globals it reads bound to a state object - so a check can assert what the code
// DOES instead of what its text says.
function bindFn(header, stateName, rebind){
  const at = src.indexOf(header);
  if (at === -1) return null;
  const end = src.indexOf('\n  }\n', at);
  if (end === -1) return null;
  const body = src.slice(at, end + 4);
  const name = header.slice(0, header.indexOf('(')).replace(/^\s*(?:async\s+)?function\s+/, '');
  let bound = body;
  for (const key of (rebind || [])) {
    bound = bound.split(new RegExp('\\b' + key + '\\b', 'g')).join(stateName + '.' + key);
  }
  try { return new Function(stateName, bound + '\nreturn ' + name + ';'); } catch (e) { return null; }
}

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
    // The head (entries[0]) moves on every release, so the checks about 72.5
    // itself read the 72.5 entry - the head is 72.5.1 now, and its notes are
    // about the widget transport buttons (this split was added by 72.5.1's
    // repin). Every general rule below still reads the head, which is what it
    // is for.
    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (ownEntry.items || []).join('\n');
    ok(/all songs/i.test(ownNotes), 'the notes say All Songs is the thing this release is about');
    ok(/search/i.test(ownNotes), 'and the search it fixes');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(!!entries.find((e) => String(e.version) === '72.4'), 'the 72.4 entry is still behind it');
  }
  ok(!!entries && String((entries.find((e) => String(e.version) === OWN) || {}).version) === OWN,
    'this release names its own entry (' + OWN + ')');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-725.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.5';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] an id is never handed out twice');
{
  const makeHighest = bindFn('  function scHighestTrackId(){', 'state', ['allTracks']);
  ok(typeof makeHighest === 'function', 'the highest id in use is readable');
  if (typeof makeHighest === 'function') {
    const h = makeHighest({ allTracks: [{ id: 't0' }, { id: 't1' }, { id: 't9' }] });
    ok(h() === 9, 'the highest id in a t0..t9 library reads 9 (' + h() + ')');
    ok(makeHighest({ allTracks: [] })() === -1, 'and an empty library reads -1');
    ok(makeHighest({ allTracks: [{ id: 'x9' }, { id: null }] })() === -1, 'and an id that is not a number is not counted');
  }
  const makeNext = bindFn('  function scNextTrackId(){', 'state', ['allTracks', 'idCounter']);
  ok(typeof makeNext === 'function', 'and a free id can be asked for');
  if (typeof makeNext === 'function') {
    // The exact state that caused the bug: a counter BELOW ids already in use.
    const state = { allTracks: [{ id: 't0' }, { id: 't1' }, { id: 't7' }, { id: 't9' }], idCounter: 2 };
    const alloc = makeNext(state);
    let collisions = 0;
    const issued = [];
    for (let i = 0; i < 6; i++) {
      const id = alloc();
      issued.push(id);
      if (state.allTracks.some((t) => t.id === id)) collisions++;
      state.allTracks.push({ id });
    }
    ok(collisions === 0, 'an id it hands out is never one already in use (' + collisions + ' collisions)');
    ok(state.allTracks.length === 10, 'and every song gets its own row (' + state.allTracks.length + ')');
    const ids = state.allTracks.map((t) => t.id);
    ok(new Set(ids).size === ids.length, 'the library holds no two songs on one id');
    ok(state.idCounter === 9, 'and the counter is where the allocator left it (' + state.idCounter + ')');
    ok(!issued.includes('t7') && !issued.includes('t9'), 'it stepped over the ids that were already taken');
    ok(issued.includes('t2') && issued.includes('t8'), 'and used the free ones it found');
    // A fresh device still starts at t0.
    const fresh = { allTracks: [], idCounter: 0 };
    ok(makeNext(fresh)() === 't0', 'a fresh library starts at t0');
  }
  ok(src.indexOf('idCounter = Math.max(Number(metaMap.idCounter) || 0, scHighestTrackId() + 1);') !== -1,
    'the counter can never fall below an id already in use');
  ok(src.indexOf('idCounter = metaMap.idCounter || allTracks.length') === -1,
    'the old fallback to the song count is gone');
  ok(src.indexOf("      var id = scNextTrackId();\n      var track = {") !== -1, 'the converted path asks for one');
  ok(src.indexOf('      const id = scNextTrackId();') !== -1, 'and so does the import path');
  ok(count(src, "'t' + (idCounter++)") === 1, 'only the manifest import keeps its own counter, which remaps its ids');
}

console.log('[3] a song is in All Songs once, and a landed song is drawn at once');
{
  const boot = src.slice(src.indexOf('const allTrackIds = new Set(allTracks.map(t => t.id));'), src.indexOf('idCounter = Math.max(Number(metaMap.idCounter)'));
  ok(boot.indexOf('let repeatsFlattened = 0;') !== -1, 'boot flattens repeats');
  ok(boot.indexOf("const keep = name === 'All Songs' ? arr : arr.filter(id => allTrackIds.has(id));") !== -1,
    'out of every list, All Songs included');
  ok(boot.indexOf('const flat = keep.filter(id => { if(seen.has(id)) return false; seen.add(id); return true; });') !== -1,
    'keeping the first of each');
  ok(boot.indexOf('if(recovered > 0 || staleCleaned > 0 || repeatsFlattened > 0){') !== -1, 'and the repair is saved');
  ok(src.indexOf("if(playlists['All Songs'].indexOf(id) === -1) playlists['All Songs'].push(id);") !== -1,
    'filing a song asks whether it is already there');
  ok(src.indexOf("if(playlists['Unsorted'].indexOf(id) === -1) playlists['Unsorted'].push(id);") !== -1,
    'and so does Unsorted');
  ok(src.indexOf("playlists['All Songs'].push(id);") !== -1, 'a converted song still reaches All Songs');
  ok(count(src, "playlists['All Songs'].push(id);") === 2, 'and so does an imported one');
  // The screen cannot show a repeat even if something upstream regressed.
  const inner = src.slice(src.indexOf('function renderListInner(){'), src.indexOf('const fullIds = ids.slice();'));
  ok(inner.indexOf('const _scSeenId = new Set();') !== -1, 'the render drops a repeated id');
  ok(inner.indexOf('rawIds = rawIds.filter(id => { if(_scSeenId.has(id)) return false; _scSeenId.add(id); return true; });') !== -1,
    'before anything sorts or counts it');
  ok(inner.indexOf('const _scSeenId = new Set();') < inner.indexOf('let ids;'),
    'so the queue and the count see the same one row');
  // A landed song is drawn immediately rather than left to the deferred frame.
  const add = src.slice(src.indexOf('function scAddConvertedToLibrary(blob, meta, opts){'), src.indexOf('function scOpenLibraryAfterDownload('));
  ok(add.indexOf('try{ renderList(); }catch(_rl){}\n      try{ scRenderListNow(); }catch(_rl2){}') !== -1,
    'a converted song is drawn at once');
  ok(add.indexOf('try{ scRenderListNow(); }') < add.indexOf('return track;'), 'before the add reports success');
  ok(add.indexOf('try{ renderList(); }') < add.indexOf('try{ scRenderListNow(); }'),
    'armed first, then taken over, because the immediate draw needs a pending frame');
  ok(count(src, 'function scRenderListNow(){') === 1, 'and the immediate draw is still one function');
  // Deleting one row can no longer take a second with it: the id is one song.
  ok(src.indexOf('allTracks = allTracks.filter(tr => tr.id !== id);') !== -1, 'a delete still removes by id');
  ok(src.indexOf("rawIds = allTracks.map(t => t.id).filter(id => !inSomePlaylist.has(id));") !== -1,
    'Unsorted is still the live filter over the track list');
}

console.log('[4] a search answers with what was asked for');
{
  const at = src.indexOf("const _scFieldHit = (t, field) => {");
  const inner = at === -1 ? '' : src.slice(at, at + 1600);
  ok(at !== -1, 'the search reads one field at a time');
  ok(inner.indexOf("const _scNamed = ids.filter(id => { const t = _rlMap.get(id); return !!t && (_scFieldHit(t, 'name') || _scFieldHit(t, 'artist')); });") !== -1,
    'the name and the artist decide the result');
  ok(inner.indexOf("ids = _scNamed.length ? _scNamed : ids.filter(id => { const t = _rlMap.get(id); return !!t && _scFieldHit(t, 'album'); });") !== -1,
    'and the album only fills in when nothing was named or credited that way');
  const artistAt = inner.indexOf("_scFieldHit(t, 'artist')");
  const albumAt = inner.indexOf("_scFieldHit(t, 'album')", inner.indexOf('_scNamed.length ?'));
  ok(artistAt !== -1 && albumAt !== -1 && albumAt > artistAt, 'the name and artist test comes first, the album test second');
  // Drive the reported case through the same rules.
  const hit = (t, q) => {
    const field = (o, f) => { const v = String((o && o[f]) || '').toLowerCase(); return !!v && v.indexOf(q) !== -1; };
    if (field(t, 'name') || field(t, 'artist')) return 'named';
    return field(t, 'album') ? 'album' : 'no';
  };
  ok(hit({ name: 'Still Rollin', artist: 'Shubh' }, 'shubh') === 'named', 'a song by the artist is a name-or-artist hit');
  ok(hit({ name: '23', artist: 'Cheema Y, Gur Sidhu', album: 'Shubh' }, 'shubh') === 'album',
    'a song merely stamped with that album is an album hit, not a named one');
  ok(hit({ name: '23', artist: 'Cheema Y' }, 'shubh') === 'no', 'and unrelated songs are no hit at all');
  // The album pollution that produced those hits is gone at the source.
  ok(src.indexOf("if(!meta.album && plan.album && plan.kind === 'album') meta.album = plan.album;") !== -1,
    'a playlist name is not written into a song as its album');
  ok(src.indexOf('if(!meta.album && plan.album) meta.album = plan.album;') === -1, 'the old stamping is gone');
  ok(src.indexOf("kind === 'playlist'") !== -1, 'though playlists still resolve');
}

console.log('[5] the lookup stops wasting requests');
{
  const fn = src.slice(src.indexOf('async function scSpToBuffer(meta, onStatus){'), src.indexOf('function scArtistMatch(artist, author, videoTitle, owner, candTitle){'));
  const loopAt = fn.indexOf('for(var ci = 0; ci < cands.length && tried < 10; ci++){');
  const lenAt = fn.indexOf('var cSec = Number(cands[ci].duration) || 0;\n      if(expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) > 60) continue; // different recording');
  const playerAt = fn.indexOf('var pa = await scYtPlayer(cands[ci].videoId);', loopAt);
  ok(lenAt !== -1, 'the length is checked with what the search already said');
  ok(playerAt !== -1 && lenAt < playerAt, 'and it is checked BEFORE the player is asked');
  ok(count(fn, 'if(expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) > 60) continue; // different recording') === 1,
    'the check lives once, in front of the request');
  const breakAt = fn.indexOf('if(verified[verified.length - 1].strong && expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) <= 15) break;');
  ok(breakAt !== -1, 'the loop stops once a full-length match is in hand');
  ok(breakAt > fn.indexOf('verified.push({ pa: pa, vid: cands[ci].videoId, delta: _delta'), 'and only after one was pushed');
  ok(fn.indexOf('var _scFirstCarriesIt = false;') !== -1, 'the two extra searches are gated on a local test');
  ok(fn.indexOf('if(!_scFirstCarriesIt){\n      try{ cands2 = await scYtSearch(') !== -1, 'the first of them');
  ok(fn.indexOf('if(!_scFirstCarriesIt && title && cands.length > 0){') !== -1, 'and the quoted-title one');
  ok(count(fn, 'await scYtSearch(') === 4, 'so a song landing on the first result asks the search source once (' + count(fn, 'await scYtSearch(') + ' call sites)');
  ok(fn.indexOf('async function scSpToBuffer(meta, onStatus){') !== -1,
    'and the signature the harnesses slice by is untouched');
}

console.log('[6] what did not move');
{
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  ok(count(src, 'async function scSpToBuffer(meta, onStatus){') === 1, 'the audio reader is where it was');
  ok(count(src, 'async function scResolveSpotifyPlan(rawUrl){') === 1, 'and the plan resolver');
  ok(count(src, 'async function scEnrichSingleMeta(meta){') === 1, 'and the metadata enricher');
  ok(count(src, 'function renderListInner(){') === 1, 'one list renderer');
  ok(count(src, 'function deleteTrack(id, skipConfirm){') === 1, 'one delete');
  ok(count(src, 'function getDuplicateGroups(){') === 1, 'and the duplicate scanner is still one function');
  ok(src.indexOf('if(activePlaylist !== \'All Songs\') return;') !== -1, 'the duplicate banner still only speaks for All Songs');
  // 72.3's and 72.4's own claims still hold.
  const save = src.slice(src.indexOf('function saveMeta(){'), src.indexOf('// Single source of truth for what gets written'));
  ok(save.indexOf("if(libraryMode === 'albums')") === -1, '72.3 All Songs fix is still in place');
  ok(save.indexOf("dbPut('meta', { key: 'playlists', value: playlists });") !== -1, 'the playlists row still writes every time');
  ok(src.indexOf("var _catStores = ['', '&country=IN'];") !== -1, '72.3 still reads a second storefront');
  ok(src.indexOf('async function scDeliverDueReleases(){') !== -1, 'and still hands a landed drop its track');
  ok(src.indexOf('var _nResp = await __scNativeFetch(base);') !== -1, '72.4 still reaches the device network');
  ok(src.indexOf('if(!scAlbumTitleOk(it.results[i].trackName, meta.title)) continue;') !== -1, 'and still refuses a look-alike');
  ok(src.indexOf('function scPlanDropSingleSuffix(plan){') !== -1, 'and still strips the filing wrapper');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries, 'the changelog still parses');
  if (entries) {
    const prev = entries.find((e) => String(e.version) === PREV);
    ok(!!prev, 'the ' + PREV + ' entry is still there');
    ok(!!prev && (prev.items || []).length >= 6, 'and still carries its notes (' + (prev ? prev.items.length : 0) + ')');
  }
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
  const g724 = fs.readFileSync(path.join(dev, 'test-724.mjs'), 'utf8');
  ok(g724.indexOf("const OWN = '72.4';") !== -1, 'the 72.4 gate reads its own entry by name');
  ok(g724.indexOf('const ownEntry = entries.find((e) => String(e.version) === OWN) || head;') !== -1,
    'and looks it up rather than taking the head');
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
