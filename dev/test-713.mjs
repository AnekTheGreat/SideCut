#!/usr/bin/env node
/**
 * 71.3 - YouTube playlists, the song's own metadata, and updates that wait.
 *
 * The user's three asks in one release, each pinned where the code actually lives
 * rather than by grepping for a phrase:
 *
 *   [1] release metadata - APP_VERSION, the head entry and the shell cache;
 *   [2] the playlist path   - detection, the page reader, the picker and the run;
 *   [3] the song's metadata - the enrichment and the tags/cover it feeds;
 *   [4] the update guard    - the page's in-flight flag and the updater's deferral.
 *
 *   node dev/test-713.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const ota = fs.readFileSync(path.join(ROOT, 'dev', 'native-updates.js'), 'utf8');

const VER = '72.4'; /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */ /* repinned by dev/repin-715.mjs */ /* repinned by dev/repin-714.mjs */
const PREV = '72.3'; /* repinned by dev/repin-724.mjs */ /* repinned by dev/repin-723.mjs */ /* repinned by dev/repin-722.mjs */ /* repinned by dev/repin-721.mjs */ /* repinned by dev/repin-720.mjs */ /* repinned by dev/repin-719.mjs */ /* repinned by dev/repin-718.mjs */ /* repinned by dev/repin-717.mjs */ /* repinned by dev/repin-716.mjs */ /* repinned by dev/repin-715.mjs */ /* repinned by dev/repin-714.mjs */
const SHELL_CACHE = 'sidecut-shell-v72.4';

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
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok((head.items || []).length >= 6, 'with at least six notes (' + (head.items || []).length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = (head.items || []).join('\n');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'and the notes name a surface this app really has');
    ok((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
  }
  const cache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1];
  ok(cache === SHELL_CACHE, 'the shell cache moved with the release (' + cache + ')');
  ok(cache === 'sidecut-shell-v' + VER, 'the shell cache is the release number (' + cache + ')');
}

console.log('\n[2] a YouTube list is read, shown and made');
{
  ok(count(src, 'function scYtPlaylistId(url){') === 1, 'the list id is read out of a link');
  ok(src.indexOf('[?&]list=([A-Za-z0-9_-]+)') !== -1, 'looking for the list= parameter');
  ok(count(src, 'async function scYtResolvePlaylist(listId){') === 1, 'the list page is read for its songs');
  // The page reader walks the object YouTube embeds rather than scraping markup.
  ok(src.indexOf("page.indexOf('ytInitialData')") !== -1, 'from the ytInitialData the page embeds');
  ok(src.indexOf('node.playlistVideoRenderer') !== -1, 'the classic video rows are understood');
  ok(src.indexOf('node.lockupViewModel') !== -1, 'and so is the newer lockup shape');
  ok(/\/\^\[\\w-\]\{11\}\$\//.test(src), 'a video id is only ever eleven id characters');
  // The single-link card hands a list link over instead of failing on it.
  ok(src.indexOf('if(_listId && !_directVideoId){ scYtConvertPlaylist(url, _listId, resultEl, btnEl, presetFmt); return; }') !== -1,
    'a list link is handed to the playlist card, unchanged and before the video-id check');
  ok(count(src, 'function scYtConvertPlaylist(url, listId, resultEl, btnEl, presetFmt){') === 1,
    'the playlist card exists once');
  const card = src.slice(src.indexOf('function scYtConvertPlaylist('), src.indexOf('function convertYtToMp3('));
  ok(card.indexOf("pl.tracks.map(") !== -1, 'it lists every song the page held');
  ok(card.indexOf('class="yt-pl-cb"') !== -1 && card.indexOf('data-idx=') !== -1, 'each with a tick of its own');
  ok(card.indexOf("querySelector('.yt-pl-all')") !== -1 && card.indexOf("querySelector('.yt-pl-none')") !== -1,
    'and All / None beside them');
  ok(card.indexOf('await scYtOneVideo(tr.videoId, fmt, tr.title, tr.author,') !== -1, 'the run uses the shared per-video worker');
  ok(card.indexOf('if(window.__scCancelDl) break;') !== -1, 'a cancelled run stops between songs');
  ok(card.indexOf('scAddConvertedToLibrary(res.blob') !== -1, 'and every finished song lands in the library');
  ok(count(src, 'async function scYtOneVideo(videoId, fmt, titleHint, authorHint, onStatus){') === 1,
    'the shared per-video worker exists once');
  // The worker is the real pipeline, not a shortcut.
  const worker = src.slice(src.indexOf('async function scYtOneVideo('), src.indexOf('async function scYtResolvePlaylist('));
  ok(worker.indexOf('await scYtPlayer(videoId)') !== -1, 'it resolves the audio through the player');
  ok(worker.indexOf('await scFetchDecode(') !== -1, 'downloads and decodes it');
  ok(worker.indexOf('await scEncodeAudioCooperative(') !== -1, 'and re-encodes it with the shared encoder');
  ok(worker.indexOf('await scYtEnrichMeta(') !== -1, 'with the song metadata read first');
}

console.log('\n[3] the song brings its own metadata');
{
  ok(count(src, 'async function scYtEnrichMeta(rawTitle, rawAuthor){') === 1, 'the enrichment exists once');
  const enr = src.slice(src.indexOf('async function scYtEnrichMeta('), src.indexOf('async function scYtOneVideo('));
  ok(enr.indexOf('itunes.apple.com/search') !== -1, 'it asks the store catalog for the song');
  ok(enr.indexOf('scArtistMatch(artist, row.artistName') !== -1, 'the artist has to agree with the upload');
  ok(enr.indexOf('scYtTitleMatch(cleanTitle, row.trackName)') !== -1, 'and so does the song name');
  ok(enr.indexOf('hit.collectionName') !== -1 && enr.indexOf('hit.primaryGenreName') !== -1, 'the album and genre come back');
  ok(enr.indexOf("replace('/100x100bb.jpg', '/600x600bb.jpg')") !== -1, 'the cover is upgraded to the big one');
  ok(enr.indexOf('out.artBytes = new Uint8Array(artAb)') !== -1, 'and its bytes are read for the tag');
  // The single-link card is wired to all of it.
  ok(src.indexOf('var ytAlbum = \'\', ytYear = \'\', ytGenre = \'\', ytTrack = \'\', ytThumb = \'\', ytArtBytes = null, ytArtMime = null;') !== -1,
    'the card keeps the enriched fields');
  ok(src.indexOf('var _ym = await scYtEnrichMeta(title, ytAuthor);') !== -1, 'the card asks for them with the run');
  ok(/var _ym = await scYtEnrichMeta\(title, ytAuthor\);[\s\S]{0,400}?if\(_ym\.title\) title = _ym\.title;/.test(src),
    'the official title replaces the raw upload text');
  ok(src.indexOf("if(!ytAuthor && audio.author) ytAuthor = audio.author;") !== -1,
    'and the player fills in a channel the lookup left empty');
  // The encoder and the library row both receive them.
  ok(/scEncodeAudioCooperative\(dec\.buffer, fmt, \{ title: title \|\| '', artist: \(typeof ytAuthor === 'string' \? ytAuthor : ''\), album: ytAlbum \|\| '', year: ytYear \|\| '', genre: ytGenre \|\| '', track: ytTrack \|\| '', artBytes: ytArtBytes, artMime: ytArtMime \}/.test(src),
    'the tag carries album, year, genre, track and the cover');
  ok(/scAddConvertedToLibrary\(res\.blob, \{\n        title: _libClean\.name, artist: _libClean\.artist, album: ytAlbum \|\| '', genre: ytGenre \|\| '',\n        artBytes: ytArtBytes, artMime: ytArtMime\n/.test(src),
    'and so does the library row (and its cover)');
}

console.log('\n[4] an update waits for a run in flight');
{
  // The page publishes "a run is running" on the bell's flag and clears it when the
  // pill is dismissed for any reason - done, cancelled or hidden.
  ok(count(src, 'window.__scNotifConv = null;') >= 3, 'the in-flight flag is cleared wherever a run ends');
  const pillHide = src.slice(src.indexOf('function scConvertPill(show){'), src.indexOf('function scConvertPillUpdate('));
  ok(/if\(!show\)\{[\s\S]{0,200}?window\.__scNotifConv = null;[\s\S]{0,200}?scConvertPillState\.el = null;/.test(pillHide),
    'including when the pill is simply hidden');
  // The updater defers on it.
  ok(count(ota, 'function somethingIsDownloading(){') === 1, 'the updater asks whether a run is in flight');
  ok(ota.indexOf('if(window.__scNotifConv) return true;') !== -1, 'reading the page flag');
  ok(/if\(somethingIsDownloading\(\)\)\{[\s\S]{0,900}?applyInBackground\(Updater, nb\);[\s\S]{0,300}?return true;/.test(ota),
    'and pins the bundle to an app close instead of reloading under it');
  ok(ota.indexOf('if(somethingIsDownloading()){') !== -1 &&
     ota.indexOf('if(somethingIsDownloading()){') < ota.indexOf('if(!force && somethingIsPlaying()){'),
    'the deferral runs BEFORE the playback deferral, so even Install now cannot cut a run off');
  ok(/never cut off a run in flight/i.test(ota), 'with the reason written down where it is enforced');
}

console.log('');
console.log(fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed');
process.exit(fail ? 1 : 0);
