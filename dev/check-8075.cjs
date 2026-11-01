#!/usr/bin/env node
// 80.7.5 - the cover reaches every song, and a failure says where to tap.
//
// Release pins, then the browser-side rules DRIVEN in a VM: an album row's cover
// fallback, the line that carries Restart, the candidate list asked for a whole
// copy, and the whole of scStreamPlayFresh run three ways. Then the survivors of
// 80.7.2 / 80.7.3 / 80.7.4, every inline script compiled, and both OTA channels
// checked against the notes each one is allowed to publish.
//
//   node dev/check-8075.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');
const html = fs.readFileSync(INDEX, 'utf8');
const VERSION = '80.7.5';

let pass = 0;
const failures = [];
function ok(name, cond) {
  if (cond) { pass++; } else { failures.push(name); }
}

// ---- the two channel filters, copied from the bundlers ---------------------
// These are what decide which note reaches which install, so the notes are
// checked against the real rules rather than against a hope.
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

// ---- source slicing --------------------------------------------------------
function fnText(marker) {
  const at = html.indexOf(marker);
  if (at < 0) return '';
  const open = html.indexOf('{', at);
  if (open < 0) return '';
  let depth = 0;
  for (let j = open; j < html.length; j++) {
    const c = html[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return html.slice(at, j + 1); }
  }
  return '';
}
function sandbox(code, globals) {
  const ctx = Object.assign({ console }, globals || {});
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return ctx;
}

// ---- the release -----------------------------------------------------------
ok('the page is 80.7.5', html.includes("const APP_VERSION = '80.7.5';"));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.5 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(String(it))));

const fNotes = fullNotes(items);
const pNotes = playNotes(items);
ok('the full card publishes all three notes', fNotes.length === 3);
ok('the Play card publishes one honest note', pNotes.length === 1);
ok('the one Play note is the album cover', /album cover/i.test(String(pNotes[0] || '')));
ok('the album-cover note is the one unmarked note',
  items.filter((it) => !/^\[FULL\] /.test(String(it))).length === 1);
ok('the two marked notes belong to this build only',
  items.filter((it) => /^\[FULL\] /.test(String(it))).length === 2);

// ---- the album art ---------------------------------------------------------
ok('scAlbumRowArt is defined', html.includes('  function scAlbumRowArt(t){'));
ok('no row asks only for its own art', !html.includes('var artStyle = tt.artUrl ?'));
ok('the deck copy asks the helper too', !html.includes('var _as = _tt.artUrl ?'));
ok('all five places an album draws its rows use it',
  (html.match(/scAlbumRowArt\(/g) || []).length === 6);
ok('a render starts with a fresh cover answer', html.includes('scAlbumArtDrop();   // 80.7.5'));

const artCode = 'var scAlbumArtCache = {};\n' + fnText('function scAlbumArtDrop(){') + '\n' + fnText('function scAlbumRowArt(t){');
const ownTrack = { id: 'a1', album: 'Record', artUrl: 'blob:own' };
const bareTrack = { id: 'a2', album: 'Record', artUrl: '' };
const artCtx = sandbox(artCode, {
  userAlbums: {
    Record: { cover: 'blob:album-cover', trackIds: ['a1', 'a2'] },
    NoCover: { cover: '', trackIds: ['a2'] }
  },
  allTracks: [
    { id: 'a1', artUrl: 'blob:first-song' },
    { id: 'a2', artUrl: '' }
  ]
});
ok('a song with its own cover keeps it',
  artCtx.scAlbumRowArt(ownTrack) === "background-image:url('blob:own');");
ok('a song without one shows the album cover',
  artCtx.scAlbumRowArt(bareTrack) === "background-image:url('blob:album-cover');");
artCtx.scAlbumArtDrop();
const noCoverCtx = sandbox(artCode, {
  userAlbums: { NoCover: { cover: '', trackIds: ['a1', 'a2'] } },
  allTracks: [{ id: 'a1', artUrl: 'blob:first-song' }, { id: 'a2', artUrl: '' }]
});
ok('an album with no saved cover borrows its first song with art',
  noCoverCtx.scAlbumRowArt({ id: 'a2', album: 'NoCover', artUrl: '' }) === "background-image:url('blob:first-song');");
const nothingCtx = sandbox(artCode, { userAlbums: {}, allTracks: [] });
ok('nothing anywhere draws no broken background',
  nothingCtx.scAlbumRowArt({ id: 'x', album: 'Gone', artUrl: '' }) === '');
ok('a quote in a cover address cannot break the style attribute',
  nothingCtx.scAlbumRowArt({ id: 'y', album: '', artUrl: "blob:it's" }) === "background-image:url('blob:it%27s');");
ok('an album row is answered from the album, not from the first row of the screen',
  noCoverCtx.scAlbumRowArt({ id: 'a2', album: 'NoCover', artUrl: '' }).indexOf('first-song') !== -1);

// ---- the failure line and its Restart --------------------------------------
ok('scStreamSayLine is defined', html.includes('  function scStreamSayLine(){'));
const sayLineText = fnText('function scStreamSayLine(){');
ok('the line carries the message element', sayLineText.includes('id="scStreamSay"'));
ok('the line carries a Restart', sayLineText.includes('class="scs-fix"') && />Restart</.test(sayLineText));
ok('no page draws the line without the button', !html.includes('id="scStreamSay" style="font-size'));
ok('all four lists use the shared line', (html.match(/h \+= scStreamSayLine\(\);/g) || []).length === 4);
ok('every Restart on a line is wired',
  html.includes("host.querySelectorAll('.scs-fix'), function(b){ b.addEventListener('click', scStreamRestart); }"));

const sayCode = fnText('function scStreamSay(msg){');
function sayRun(hasElement, msg) {
  const el = hasElement ? { textContent: '' } : null;
  const toasts = [];
  const ctx = sandbox(sayCode, { document: { getElementById: () => el }, toast: (m) => toasts.push(String(m)) });
  ctx.scStreamSay(msg);
  return { el, toasts };
}
const withLine = sayRun(true, 'This copy of the song ends at 1:04 of 3:12 - tap Restart to try another copy');
ok('a failure lands in the line when the line is on screen', /ends at 1:04/.test(withLine.el.textContent));
ok('and it is not said twice', withLine.toasts.length === 0);
const noLine = sayRun(false, 'This copy of the song ends at 1:04 of 3:12 - tap Restart to try another copy');
ok('a failure with no line on screen is said out loud', noLine.toasts.length === 1 && /ends at 1:04/.test(noLine.toasts[0]));
ok('a progress readout is never said out loud',
  sayRun(false, 'Reading the song\u2026 40%').toasts.length === 0);
ok('clearing the line says nothing', sayRun(false, '').toasts.length === 0);
ok('an empty answer is said out loud',
  sayRun(false, 'No playable stream for this song right now (transport timeout)').toasts.length === 1);

// ---- the candidate list asked for a whole copy -----------------------------
ok('the candidate list can be asked for a whole copy', html.includes('function scStreamAltUrl(wantWhole){'));
const altCode = fnText('function scStreamAltUrl(wantWhole){');
function altRun(alts, wantWhole) {
  const state = { alts: alts.map((a) => Object.assign({}, a)) };
  const ctx = sandbox(altCode, { scStreamState: state });
  const url = ctx.scStreamAltUrl(wantWhole);
  return { url, left: state.alts };
}
const pool = [
  { url: 'u-audio-1', muxed: false },
  { url: 'u-audio-2', muxed: false },
  { url: 'u-muxed', muxed: true }
];
const whole = altRun(pool, true);
ok('asked for a whole copy it takes the muxed one', whole.url === 'u-muxed');
ok('and the muxed copy is not offered twice', whole.left.filter((a) => a.muxed).length === 0);
ok('the plain call keeps the player order', altRun(pool, false).url === 'u-audio-1');
ok('with no muxed copy it falls back to the first', altRun([{ url: 'only', muxed: false }], true).url === 'only');
ok('an empty list answers nothing', altRun([], true).url === '');
ok('a short copy asks for a whole copy first', html.includes('var alt = scStreamAltUrl(true);'));
ok('a re-resolved answer asks for a whole copy first',
  html.includes('return scStreamAltUrl(true) || scStreamAltUrl();'));

// ---- the fresh path, run three ways ---------------------------------------
const freshCode = 'var scStreamResolved = {};\n' + fnText('function scStreamPlayFresh(t){');
function freshRun(opts) {
  const calls = { cached: 0, direct: 0, start: [], say: [], watch: 0, warm: 0 };
  const track = { id: 't1', videoId: 'vid1' };
  const ctx = sandbox(freshCode, {
    scStreamState: { curId: 't1', mime: 'audio/webm', size: 0, via: '', err: '', url: '', urlAt: 0, audio: null },
    scStreamById: (id) => (String(id) === 't1' ? track : null),
    scStreamReason: () => 'read timeout',
    scStreamResolveCached: () => { calls.cached++; return Promise.resolve(opts.cached || ''); },
    scStreamResolve: () => { calls.direct++; return Promise.resolve(opts.direct || ''); },
    scStreamSource: () => Promise.resolve('blob:read'),
    scStreamStart: (u) => { calls.start.push(String(u)); return Promise.resolve(true); },
    scStreamCachePut: () => {},
    scStreamSay: (m) => calls.say.push(String(m == null ? '' : m)),
    scStreamTick: () => {},
    scStreamWatch: () => { calls.watch++; },
    scStreamWarmNext: () => { calls.warm++; },
    Date, Promise, String, Number, Object, Array, Math, isFinite
  });
  return { ctx, calls, track };
}
ok('the fresh path shares one way to play an answer', !!fnText('function scStreamPlayFresh(t){') && /function playUrl\(u\)\{/.test(fnText('function scStreamPlayFresh(t){')));
ok('and one way to give up', /function noneLeft\(\)\{/.test(fnText('function scStreamPlayFresh(t){')));

(async () => {
  const a = freshRun({ cached: 'u-lead' });
  await a.ctx.scStreamPlayFresh(a.track);
  ok('a first answer plays straight away', a.calls.start[0] === 'u-lead');
  ok('a good answer never asks the source twice', a.calls.direct === 0);
  ok('and it warms the next song', a.calls.warm === 1 && a.calls.watch === 1);

  const b = freshRun({ cached: '', direct: 'u-second' });
  await b.ctx.scStreamPlayFresh(b.track);
  ok('an empty first answer is asked again', b.calls.cached === 1 && b.calls.direct === 1);
  ok('and the second answer is played', b.calls.start[0] === 'u-second');
  ok('a recovered song is not reported as unplayable',
    !b.calls.say.some((m) => /No playable stream/.test(m)));
  ok('a recovered answer is remembered', b.ctx.scStreamResolved && b.ctx.scStreamResolved['vid1'] && b.ctx.scStreamResolved['vid1'].url === 'u-second');

  const c = freshRun({ cached: '', direct: '' });
  await c.ctx.scStreamPlayFresh(c.track);
  ok('two empty answers are asked twice, no more', c.calls.cached === 1 && c.calls.direct === 1);
  ok('two empty answers start nothing', c.calls.start.length === 0);
  const said = c.calls.say.filter(Boolean);
  ok('two empty answers say so once', said.length === 1 && /No playable stream/.test(said[0]));
  ok('and the reason travels with it', /read timeout/.test(said[0]));

  // ---- survivors -----------------------------------------------------------
  ok('80.7.4 still judges a copy against the song', html.includes('function scStreamWhole(want, got){'));
  ok('80.7.4 still runs the check off the clock', html.includes('scStreamFragCheck(a);   // 80.7.4'));
  ok('80.7.3 still owns the dots on the player', html.includes('// 80.7.3 - THE MENU BELONGS TO THE SONG ON THE SCREEN.'));
  ok('80.7.2 still gives a stream bytes to crop', html.includes('// 80.7.2 - A SONG PLAYED FROM THE CATALOGUE HAS BYTES TO CROP.'));

  // ---- every inline script compiles ---------------------------------------
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
  ok('the page has inline scripts to compile', scripts > 0);
  ok('every inline script compiles', failures.filter((f) => /^inline script \d+ compiles/.test(f)).length === 0);

  // ---- both OTA channels ---------------------------------------------------
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null;
  try { full = read('ota/updates.json'); } catch (e) { full = null; }
  try { play = read('ota-play/updates.json'); } catch (e) { play = null; }
  ok('the full channel is v80.7.5', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes',
    !!full && JSON.stringify(full.notes) === JSON.stringify(fNotes));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is released at v80.7.5', !!play && String(play.version) === VERSION);
  ok('the Play channel publishes one note', !!play && play.notes.length === 1);
  ok('the Play channel publishes the album-cover note',
    !!play && JSON.stringify(play.notes) === JSON.stringify(pNotes));
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page is 80.7.5 with the cover fallback',
    /const APP_VERSION = '80\.7\.5';/.test(zipped) && zipped.includes('function scAlbumRowArt(t){'));
  ok('the shipped Play page is 80.7.5 and still a Play build',
    /const APP_VERSION = '80\.7\.5';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true'));

  if (failures.length) {
    console.log('check-8075: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-8075: ' + pass + ' passed, 0 failed');
})();
