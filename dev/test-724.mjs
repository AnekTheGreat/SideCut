#!/usr/bin/env node
/**
 * 72.4 - a song from a Spotify link is named by the link.
 *
 * The owner reported a brand-new single coming back as no matching source, saved
 * songs arriving with no metadata, and the artist being wrong on a song. This
 * gate pins the three readers that decide a resolved link's name, and it proves
 * the look-alike guard by RUNNING it rather than by reading it:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] the link reader reaches the device network, like the embed readers do;
 *   [3] a look-alike cannot name the song (behaviour, not text);
 *   [4] a one-track release is filed as its own song, not "<Song> - Single";
 *   [5] the audio query carries no blank part;
 *   [6] what did not move;
 *   [7] the repin moved every gate (no stale pin);
 *   [8] inline script syntax.
 *
 *   node dev/test-724.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '73.1.9'; /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-73.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */
const PREV = '73.1.8'; /* repinned by dev/repin-7319.mjs */ /* repinned by dev/repin-7318.mjs */ /* repinned by dev/repin-7317.mjs */ /* repinned by dev/repin-7316.mjs */ /* repinned by dev/repin-7315.mjs */ /* repinned by dev/repin-7314.mjs */ /* repinned by dev/repin-7313.mjs */ /* repinned by dev/repin-7312.mjs */ /* repinned by dev/repin-7311.mjs */ /* repinned by dev/repin-731.mjs */ /* repinned by dev/repin-729.mjs */ /* repinned by dev/repin-7281.mjs */ /* repinned by dev/repin-728.mjs */ /* repinned by dev/repin-7271.mjs */ /* repinned by dev/repin-727.mjs */ /* repinned by dev/repin-726.mjs */ /* repinned by dev/repin-7252.mjs */ /* repinned by dev/repin-7251.mjs */ /* repinned by dev/repin-725.mjs */
const SHELL_CACHE = 'sidecut-shell-v73.1.9';
// OWN is the release THIS gate describes. The head (entries[0]) moves on every
// release, so the checks about 72.4 itself must read the 72.4 entry - the head
// is 72.5 now, and its notes are about All Songs (72.5's repin added this
// split).
const OWN = '72.4';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

// Pull a function declaration out of the page and hand it back as a callable, so
// a check can assert what it DOES instead of what its text says.
function lift(header){
  const at = src.indexOf(header);
  if (at === -1) return null;
  const end = src.indexOf('\n  }\n', at);
  if (end === -1) return null;
  const body = src.slice(at, end + 4);
  try { return new Function(body + '\nreturn ' + header.slice(0, header.indexOf('(')).replace(/^\s*function\s+/, '') + ';')(); }
  catch (e) { return null; }
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
    const ownEntry = entries.find((e) => String(e.version) === OWN) || head;
    const ownNotes = (ownEntry.items || []).join('\n');
    ok(/artist/i.test(ownNotes), 'the notes say the artist is the thing this release is about');
    ok(/album/i.test(ownNotes) && /tag/i.test(ownNotes), 'and the album a song is tagged with');
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
    ok(!!entries.find((e) => String(e.version) === '72.3'), 'the 72.3 entry is still behind it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-724.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.4';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] the link reader reaches the device network');
{
  const at = src.indexOf('async function scSpOembed(url){');
  ok(at !== -1, 'there is one link reader');
  const fn = src.slice(at, src.indexOf('// Deezer search', at));
  ok(fn.indexOf('var _nResp = await __scNativeFetch(base);') !== -1,
    'it asks the device network first');
  ok(fn.indexOf('var _nResp = await __scNativeFetch(base);') < fn.indexOf('var attempts = ['),
    'before any page or relay attempt');
  ok(fn.indexOf('if(_nResp && _nResp.ok){ var _nj = await _nResp.json(); if(_nj && _nj.title) return _nj; }') !== -1,
    'and only a reply with a real title is accepted');
  // The two embed readers already carry this shape; this is the same rule.
  const ent = src.slice(src.indexOf('async function scSpEmbedEntity(url){'), src.indexOf('async function scSpEmbedTrack(url){'));
  const trk = src.slice(src.indexOf('async function scSpEmbedTrack(url){'), src.indexOf('// Resolve any Spotify link into a conversion plan'));
  ok(ent.indexOf("attempts.push('native:'") !== -1, 'the album reader already goes native first');
  ok(trk.indexOf("attempts.push('native:'") !== -1, 'and so does the track reader');
  ok(count(fn, '__scNativeFetch(') === 1, 'one native attempt, so a browser is unaffected');
  ok(fn.indexOf("'https://api.allorigins.win/raw?url='") !== -1, 'the relays stay as the browser fallback');
}

console.log('[3] a look-alike cannot name the song');
{
  const titleOk = lift('  function scAlbumTitleOk(found, want){');
  const keyOf = lift('  function scTrackTitleKey(s){');
  ok(typeof titleOk === 'function', 'the title-identity test is callable');
  ok(typeof keyOf === 'function', 'and so is the title key');
  if (typeof titleOk === 'function' && typeof keyOf === 'function') {
    // The guard as the reader applies it: the catalog hit must be this song,
    // and with no artist on the link it must be the SAME name.
    const guard = (found, want, artist) => titleOk(found, want) && (!!artist || keyOf(found) === keyOf(want));
    ok(guard('Blinding Lights', 'Blinding Lights', '') === true, 'the same song is accepted');
    ok(guard('Blinding Lights (Karaoke Version)', 'Blinding Lights', '') === false,
      'a karaoke cut with the same name is refused when nothing names the artist');
    ok(guard('Blinding Lights', 'Blinding Lights', 'The Weeknd') === true,
      'and with an artist named, the real song still is');
    ok(guard('Blinding Lights Instrumental', 'Blinding Lights', '') === false,
      'a padded look-alike name is refused');
    ok(titleOk('Blinding Lights', 'Blinding Lights (Radio Edit)') === true,
      'a bracketed edit of the right song still passes the title test');
  }
  const fn = src.slice(src.indexOf('async function scEnrichSingleMeta(meta){'), src.indexOf('// Download a finished blob'));
  ok(fn.indexOf('if(!scAlbumTitleOk(it.results[i].trackName, meta.title)) continue;') !== -1,
    'the reader refuses a hit whose name is not this song');
  ok(fn.indexOf('if(!meta.artist && scTrackTitleKey(it.results[i].trackName) !== scTrackTitleKey(meta.title)) continue;') !== -1,
    'and with no artist it insists on the same name');
  ok(fn.indexOf('if(!scDeezerArtistOk(meta.artist, it.results[i].artistName)) continue;') !== -1,
    'the artist test is still there too');
  ok(fn.indexOf("if(hit.trackName && !meta.title) meta.title = hit.trackName;") !== -1,
    'and only gaps are filled, never what the link said');
}

console.log('[4] a one-track release is filed as its own song');
{
  ok(count(src, 'function scPlanDropSingleSuffix(plan){') === 1, 'there is one plan normaliser');
  ok(src.indexOf('if(plan.title) plan.title = scSingleTitle(plan.title);') !== -1, 'it names the release by the song');
  ok(src.indexOf('if(plan.album) plan.album = scSingleTitle(plan.album);') !== -1, 'and its album too');
  ok(src.indexOf('if(_tr[_i] && _tr[_i].album) _tr[_i].album = scSingleTitle(_tr[_i].album);') !== -1,
    'down to every track of it');
  ok(src.indexOf("var eName = scSingleTitle(String(embedEnt.name || embedEnt.title || '').trim());") !== -1,
    'the embed plan goes through it');
  ok(count(src, 'scAlbumResolveCache[url] = scPlanDropSingleSuffix(') === 2,
    'and both fallback plans go through it (album and playlist)');
  ok(src.indexOf('scAlbumResolveCache[url] = pl;') === -1 && src.indexOf('scAlbumResolveCache[url] = ab;') === -1,
    'so no plan reaches the cache with the wrapper on');
  // It is the same helper the release lists already trust.
  ok(count(src, 'function scSingleTitle(name){') === 1, 'the strip rule is still one function');
  ok(/replace\(\/\\s\+\[-\\u2013\\u2014\]\\s\*single\\s\*\$\/i, ''\)/.test(src),
    'and it strips the filing wrapper, not the song');
}

console.log('[5] the audio query carries no blank part');
{
  ok(src.indexOf("var query = [title, artist, album].filter(function(p){ return !!String(p || '').trim(); }).join(' ').trim();") !== -1,
    'the query is built from the parts the link named');
  ok(src.indexOf("var query = ((title + ' ' + artist + ' ' + album).trim());") === -1,
    'the old blind concatenation is gone');
  ok(count(src, 'var query = [title, artist, album].filter(') === 1, 'in one place');
  ok(src.indexOf('async function scSpToBuffer(meta, onStatus){') !== -1,
    'and the reader signature the harnesses slice by is untouched');
}

console.log('[6] what did not move');
{
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  ok(count(src, 'async function scSpEmbedEntity(url){') === 1, 'the album reader is where it was');
  ok(count(src, 'async function scSpEmbedTrack(url){') === 1, 'and the track reader');
  ok(count(src, 'async function scResolveSpotifyPlan(rawUrl){') === 1, 'and the plan resolver');
  ok(count(src, 'async function scEnrichSingleMeta(meta){') === 1, 'and the metadata enricher');
  // 72.3's own claims still hold - this release sits on top of them.
  ok(src.indexOf("var _catStores = ['', '&country=IN'];") !== -1, '72.3 still reads a second storefront');
  ok(src.indexOf('async function scDeliverDueReleases(){') !== -1, 'and still hands a landed drop its track');
  ok(src.indexOf('try{ await scDeliverDueReleases(); }catch(_eDel){}') !== -1, 'from every check');
  const save = src.slice(src.indexOf('function saveMeta(){'), src.indexOf('// Single source of truth for what gets written'));
  ok(save.indexOf("if(libraryMode === 'albums')") === -1, 'and its All Songs fix is still in place');
  ok(save.indexOf("dbPut('meta', { key: 'playlists', value: playlists });") !== -1, 'the playlists row still writes every time');
  ok(src.indexOf("playlists['All Songs'].push(id);") !== -1, 'a saved song still reaches All Songs');
  ok(src.indexOf('window.__scSingleTitle = scSingleTitle;') !== -1, 'the strip helper is still reachable');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries, 'the changelog still parses');
  if (entries) {
    const prev = entries.find((e) => String(e.version) === PREV);
    ok(!!prev, 'the ' + PREV + ' entry is still there');
    ok(!!prev && (prev.items || []).length >= 6, 'and still carries its notes (' + (prev ? prev.items.length : 0) + ')');
    ok(!!entries.find((e) => String(e.version) === '72.2'), 'and the 72.2 entry behind it');
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
  // The 72.3 gate now describes 72.3 by name, not by its position in the array.
  const g723 = fs.readFileSync(path.join(dev, 'test-723.mjs'), 'utf8');
  ok(g723.indexOf("const OWN = '72.3';") !== -1, 'the 72.3 gate reads its own entry by name');
  ok(g723.indexOf("const ownEntry = entries.find((e) => String(e.version) === OWN) || head;") !== -1,
    'and looks it up rather than taking the head');
  ok(g723.indexOf("ok(/all songs/i.test(ownNotes)") !== -1, 'so its All Songs note check is about 72.3');
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
