#!/usr/bin/env node
// 80.7.9 - a song that only exists as a source can be kept.
//
// The routing is what gets driven: the keeper is lifted out of the page with stubs
// for the library, the source reader, the album writer and the file saver, and each
// destination is asked to prove what it does and what it does NOT do. The source
// read itself cannot be exercised here - there is no source and no network - so
// what is pinned is that the bytes the crop reader returns are what gets kept, and
// that a failed read is caught and said rather than thrown.
//
//   node dev/check-8079.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.9';

let pass = 0;
const failures = [];
function ok(name, cond) {
  if (cond) { pass++; } else { failures.push(name); }
}

// ---- the two channel filters, copied from the bundlers ---------------------
const FULL_DROP = /(streaming|streams?\b|from the source|pinned artist)/i;
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
function fullNotes(items) {
  const shown = (items || [])
    .map((it) => (typeof it === 'string' && it.startsWith('[FULL] ')) ? it.slice(7) : it)
    .filter((it) => typeof it !== 'string' || !FULL_DROP.test(it));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}
function playNotes(items) {
  const shown = (items || [])
    .filter((it) => typeof it !== 'string' || (!it.startsWith('[FULL] ') && !hidesOnPlay(it)));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}

// ---- the release -----------------------------------------------------------
ok('the page is 80.7.9', html.includes("const APP_VERSION = '80.7.9';"));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.9 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(it)));
ok('the entry sits above 80.7.8', entries.findIndex((e) => String(e.version) === VERSION) === 0);
// The feature lives in the catalogue module, which the Play build does not run - so
// the notes are marked rather than advertising it there.
ok('every note is marked for the full build only', items.every((it) => String(it).startsWith('[FULL] ')));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('the Play card falls back rather than advertising what it cannot do',
  JSON.stringify(playNotes(items)) === JSON.stringify(['Fixes and improvements under the hood.']));

// ---- the code --------------------------------------------------------------
const start = html.indexOf('  // 80.7.9 - A SONG THAT ONLY EXISTS AS A SOURCE CAN BE KEPT.');
const end = html.indexOf('  function scStreamMenu(id, where){', start);
ok('the keeper is on the page', start > 0);
ok('it sits immediately before the menu that reaches it', end > start);
const code = start < 0 || end < 0 ? '' : html.slice(start, end);
ok('the keeper reads the same bytes the crop reads', code.includes('await scStreamCropFile('));
ok('it keeps the whole song, not a slice', !/cropRenderSlice|cropBuf/.test(code));
ok('it writes through the library path a clip uses',
  code.includes('scNextTrackId()') && code.includes('persistTrackMeta(track)') &&
  code.includes("playlists['All Songs'].push(tid)"));
ok('it records where the copy came from', code.includes('downloadedFromStream'));
ok('it finds the copy it already kept', code.includes('function scStreamKeptFrom('));
ok('albums go through the album writer that already exists', code.includes('addTracksToAlbum([track.id], name'));
ok('the file leaves through the saver that already exists', code.includes('await saveExportFile(out, out.name)'));
ok('a failed read is caught and said', /catch\(err\)\{[\s\S]*?scStreamSay\('Could not keep that song/.test(code));
ok('one keep at a time', code.includes("if(scKeepBusy){ scStreamSay('Still keeping the last one"));
ok('the sheet offers the four answers the owner named',
  code.includes("'All Songs'") && code.includes("'All Songs and a playlist") &&
  code.includes("'All Songs and an album") && code.includes("'Save the file to this device"));
ok('the menu offers it next to the crop',
  html.includes("acts.push({ label: 'Download this song\\u2026', run: function(){ scStreamDownloadSheet(id); } });"));
ok('the menu only offers it for a song that is not already a file',
  /if\(!isFile\)\{\n\s+acts\.push\(\{ label: 'Download this song/.test(html));

// ---- driven: each destination does its job and nothing else ----------------
function between(a, b) {
  const i = html.indexOf(a);
  const j = html.indexOf(b, i);
  return i < 0 || j < 0 ? '' : html.slice(i, j);
}

function world(opts) {
  const o = opts || {};
  const calls = { exported: [], albums: [], saved: 0, said: [], toasts: [] };
  const ctx = {
    console: { warn() {}, log() {} },
    URL: { createObjectURL: () => 'blob:' + (++calls.saved) },
    setTimeout,
    allTracks: (o.tracks || []).slice(),
    playlists: JSON.parse(JSON.stringify(o.playlists || { 'All Songs': [], Unsorted: [] })),
    scNextTrackId: () => 'new-id',
    scStreamEntry: (id) => (id === 'gone' ? null : { id, title: 'Song ' + id, artist: 'A', dur: 200 }),
    scStreamThumb: () => 'thumb.png',
    scStreamCropFile: async (t) => {
      if (o.fail) throw new Error('the song could not be read from its source');
      return { name: 'song.m4a', type: 'audio/mp4', size: 1234, streamId: t.streamId };
    },
    scStreamSay: (s) => calls.said.push(String(s)),
    scStreamSheet: (title, acts) => { calls.sheet = { title, acts }; },
    toast: (s) => calls.toasts.push(String(s)),
    persistTrackMeta: () => {},
    saveMeta: () => {},
    readLazyMeta: () => {},
    renderTabs: () => {},
    renderList: () => {},
    saveExportFile: async (file, name) => { calls.exported.push(name); },
    addTracksToAlbum: (ids, name, from) => { calls.albums.push({ ids, name, from }); },
    prompt: () => 'My New List'
  };
  vm.createContext(ctx);
  vm.runInContext(code + '\nthis.__k = { download: scStreamDownload, sheet: scStreamDownloadSheet, pick: scStreamDownloadPick };', ctx);
  return { ctx, calls };
}

(async () => {
  // All Songs
  {
    const w = world();
    await w.ctx.__k.download('s1', { kind: 'lib' });
    const t = w.ctx.allTracks[0];
    ok('a keep lands one track in the library', w.ctx.allTracks.length === 1);
    ok('the track is the file the reader returned', !!t && t.file && t.file.name === 'song.m4a');
    ok('the track is in All Songs', w.ctx.playlists['All Songs'].indexOf(t.id) > -1);
    ok('the track is in Unsorted', w.ctx.playlists['Unsorted'].indexOf(t.id) > -1);
    ok('the track records its source', !!t && t.downloadedFromStream === 's1');
    ok('nothing was handed to the file saver', w.calls.exported.length === 0);
    ok('it says what it did', /Kept /.test(w.calls.said.join(' ')));
  }
  // The same song again: no second copy.
  {
    const w = world({ playlists: { 'All Songs': ['old-id'], Unsorted: ['old-id'] },
      tracks: [{ id: 'old-id', name: 'Song s1', downloadedFromStream: 's1' }] });
    await w.ctx.__k.download('s1', { kind: 'lib' });
    ok('asking twice keeps one copy', w.ctx.allTracks.length === 1);
    ok('and says it was already there', /Already on your device/.test(w.calls.said.join(' ')));
  }
  // All Songs and a playlist
  {
    const w = world();
    await w.ctx.__k.download('s2', { kind: 'pl', name: 'Gym' });
    ok('a playlist keep creates the list', !!w.ctx.playlists['Gym']);
    ok('and puts the track in it', w.ctx.playlists['Gym'].length === 1);
    ok('and still lands it in All Songs', w.ctx.playlists['All Songs'].length === 1);
    ok('and never touches an album', w.calls.albums.length === 0);
  }
  // All Songs and an album
  {
    const w = world();
    await w.ctx.__k.download('s3', { kind: 'al', name: 'Collected' });
    ok('an album keep uses the album writer', w.calls.albums.length === 1 && w.calls.albums[0].name === 'Collected');
    ok('with the new track id', JSON.stringify(w.calls.albums[0].ids) === '["new-id"]');
    ok('and still lands it in All Songs', w.ctx.playlists['All Songs'].length === 1);
    ok('and never creates a playlist', !w.ctx.playlists['Collected']);
  }
  // The file itself
  {
    const w = world();
    await w.ctx.__k.download('s4', { kind: 'file' });
    ok('a file keep hands it to the saver', w.calls.exported.length === 1 && w.calls.exported[0] === 'song.m4a');
    ok('and puts nothing in the library', w.ctx.allTracks.length === 0);
    ok('and says where it went', /handed .* to your device/i.test(w.calls.said.join(' ')));
  }
  // A source that does not answer
  {
    const w = world({ fail: true });
    let threw = false;
    try { await w.ctx.__k.download('s5', { kind: 'lib' }); } catch (e) { threw = true; }
    ok('a failed read does not throw at the caller', !threw);
    ok('a failed read says so', /Could not keep that song/.test(w.calls.said.join(' ')));
    ok('a failed read leaves the library alone', w.ctx.allTracks.length === 0);
  }
  // A song that has left the shelf
  {
    const w = world();
    await w.ctx.__k.download('gone', { kind: 'lib' });
    ok('a song that left the shelf says so', /not in Streaming any more/.test(w.calls.said.join(' ')));
    ok('and keeps nothing', w.ctx.allTracks.length === 0);
  }
  // The sheet itself
  {
    const w = world();
    w.ctx.__k.sheet('s6');
    ok('the sheet names the song', /Song s6/.test(w.calls.sheet.title));
    ok('the sheet offers four answers', w.calls.sheet.acts.length === 4);
    ok('the four are the ones the owner asked for',
      w.calls.sheet.acts.map((a) => a.label).join(' | ') ===
      'All Songs | All Songs and a playlist\u2026 | All Songs and an album\u2026 | Save the file to this device\u2026');
  }

  // ---- survivors -----------------------------------------------------------
  ok('80.7.8 still leaves phones alone', !/pointer\s*:\s*coarse/.test(between('<style id="sc77Fit">', '</style>')));
  ok('80.7.8 still keeps its sheet', html.includes('80.7.8 - PHONES KEEP THEIR OWN LAYOUT'));
  ok('80.7.6 still records what played last', html.includes('  function scLastPlayedSet(kind, id){'));
  ok('80.7.5 still puts the album cover on every row', html.includes('  function scAlbumRowArt(t){'));
  ok('80.7.2 still crops a streamed song', html.includes('  async function scStreamCropFile(t){'));
  ok('and the clip still lands in the library', html.includes('  async function scCropStreamSave(){'));
  ok('the catalogue is still gated off the Play build', html.includes('var SC_STREAM_OK = !SC_IS_PLAY;'));

  // ---- every inline script compiles ----------------------------------------
  let scripts = 0;
  const rx = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = rx.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs) || /type=["']module["']/.test(attrs)) continue;
    scripts++;
    try { new vm.Script(m[2], { filename: 'index.html#script' + scripts }); }
    catch (err) { ok('inline script ' + scripts + ' compiles: ' + err.message, false); }
  }
  ok('every inline script compiles', scripts > 0 && failures.filter((f) => /^inline script \d+ compiles/.test(f)).length === 0);

  // ---- both channels -------------------------------------------------------
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null, hold = null;
  try { full = read('ota/updates.json'); } catch (e) { full = null; }
  try { play = read('ota-play/updates.json'); } catch (e) { play = null; }
  try { hold = read('dev/channel-hold.json'); } catch (e) { hold = null; }
  ok('the full channel is v80.7.9', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is not held', !!hold && hold.play === false);
  ok('the Play channel is v80.7.9', !!play && String(play.version) === VERSION);
  ok('the Play channel publishes the fallback, not the feature', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page carries the keeper',
    /const APP_VERSION = '80\.7\.9';/.test(zipped) && zipped.includes('function scStreamDownloadSheet('));
  ok('the shipped Play page is the same page with its flag',
    /const APP_VERSION = '80\.7\.9';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true') &&
    playZipped.includes('function scStreamDownloadSheet('));

  if (failures.length) {
    console.log('check-8079: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-8079: ' + pass + ' passed, 0 failed');
})();
