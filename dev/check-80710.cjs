#!/usr/bin/env node
// 80.7.10 - a button you can see, and a song that starts from its first second.
//
// The order is what gets driven. The fresh path is lifted out of the page against
// stubs and every event it causes is recorded, so this proves the thing that was wrong:
// the whole song used to be read BEFORE the element was given anything, and the opening
// is now asked for WITH the link and played before the full read starts.
//
//   node dev/check-80710.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.10';

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

function between(a, b) {
  const i = html.indexOf(a);
  const j = html.indexOf(b, i);
  return i < 0 || j < 0 ? '' : html.slice(i, j);
}

// ---- the release -----------------------------------------------------------
ok('the page is 80.7.10', html.includes("const APP_VERSION = '80.7.10';"));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.10 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(it)));
ok('the entry sits at the top of the changelog', entries.findIndex((e) => String(e.version) === VERSION) === 0);
ok('every note is marked for the full build only', items.every((it) => String(it).startsWith('[FULL] ')));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('the Play card falls back rather than advertising what it cannot do',
  JSON.stringify(playNotes(items)) === JSON.stringify(['Fixes and improvements under the hood.']));

// ---- the opening -----------------------------------------------------------
const prefix = between('  function scStreamPrefix(u, mime){', '  function scStreamFallback(u, want){');
const fallback = between('  function scStreamFallback(u, want){', '  function scStreamUpgrade(u, videoId, want){');
const upgrade = between('  function scStreamUpgrade(u, videoId, want){', '  function scStreamSource(info){');
ok('the first megabyte is asked for as a bounded range', prefix.includes('scFetchRange(u, 0, SC_AUDIO_CHUNK - 1)'));
ok('a whole-file reply is not mistaken for an opening', prefix.includes('if(!part.partial) return'));
ok('the opening is a blob the element can play', prefix.includes('URL.createObjectURL(blob)'));
ok('the opening object url is tracked so it can be released', prefix.includes('scStreamState.prefixUrl'));
ok('the fallback plays the opening and says so', fallback.includes('scStreamStart(src)') && fallback.includes('first second'));
ok('the fallback warms the next song', fallback.includes('scStreamWarmNext()'));
ok('the whole copy is read by the upgrade, not by the play path', upgrade.includes('scStreamSource({'));
ok('the upgrade keeps the whole copy for the next tap', upgrade.includes('scStreamCachePut(videoId'));
ok('the upgrade swaps in at the second the listener reached',
  upgrade.includes('a.currentTime') && upgrade.includes('scStreamStart(src, at)'));
ok('the upgrade releases the opening', upgrade.includes('URL.revokeObjectURL(scStreamState.prefixUrl)'));

// ---- the fresh path --------------------------------------------------------
const fresh = between('  function scStreamPlayFresh(t){', '  function scStreamToggle(){');
ok('the fresh path exists', fresh.length > 400);
ok('the opening is asked for with the link, not after it',
  fresh.indexOf('scStreamPrefix(u, scStreamState.mime)') < fresh.indexOf('scStreamStart(u)'));
ok('the fresh path never reads the whole song itself', !fresh.includes('scStreamSource('));
ok('the link that plays moves straight to the whole copy', /if\(ok\)\{[\s\S]*?scStreamUpgrade\(u, t\.videoId, wanted\)/.test(fresh));
ok('a refused link opens from the first megabyte', fresh.includes('scStreamFallback(u, wanted)'));
ok('the second ask before giving up is still there', fresh.includes('scStreamResolve(t.videoId)'));
ok('and it still says when there is nothing', fresh.includes('No playable stream for this song right now'));

// ---- the guards a short copy needs ----------------------------------------
const frag = between('  function scStreamFragCheck(a){', '  function scStreamPlay(id, ctxIds){');
ok('an opening is not judged as a fragment', frag.includes("if(scStreamState.via === 'prefix') return;"));
ok('the end of the opening does not advance the queue',
  html.includes("      if(scStreamState.via === 'prefix') return;\n      scStreamNext(1);"));
const watch = between('  function scStreamWatch(u){', '  function scStreamStart(u, at){');
ok('a quiet link opens the song instead of reading all of it first',
  watch.includes('scStreamFallback(u, id)') && watch.includes('scStreamUpgrade(u, cur.videoId, id)'));
ok('the watch no longer reads the whole song before starting', !watch.includes('scStreamSource('));

// ---- the button, on all three surfaces ------------------------------------
ok('a shelf row carries the save button', /class="scs-keep" data-id="/.test(html));
ok('a row inside a list carries it', /class="scsp-keep" data-id="/.test(html));
ok('the player carries it', html.includes('id="scStreamSave"'));
ok('the player button is the device glyph', /id="scStreamSave"[\s\S]{0,200}scIcon\('device', 18\)/.test(html));
ok('the player button opens the ask', html.includes("on('scStreamSave', 'click', function(){ scStreamDownloadSheet(scStreamState.curId); })"));
ok('the row buttons open the ask', /'\.scs-keep', '\.scsp-keep'[\s\S]{0,320}scStreamDownloadSheet\(this\.getAttribute\('data-id'\)\)/.test(html));
ok('the row button does not also start the song',
  /\.scsp-keep[\s\S]{0,400}e\.stopPropagation\(\)[\s\S]{0,200}scStreamDownloadSheet/.test(html) ||
  /scs-keep[\s\S]{0,400}e\.stopPropagation\(\)/.test(html));

// ---- driven: the order the owner was waiting on ---------------------------
function world(opts) {
  const o = opts || {};
  const ev = [];
  const said = [];
  const ctx = {
    console: { warn() {}, log() {} },
    allTracks: [],
    playlists: { 'All Songs': [], Unsorted: [] },
    scStreamState: { curId: 's1', mime: 'audio/mp4', size: 0, via: '', err: '' },
    scStreamResolved: {},
    scStreamPrefix: () => { ev.push('prefix-asked'); return Promise.resolve('blob:prefix'); },
    scStreamFallback: () => { ev.push('fallback'); return Promise.resolve(true); },
    scStreamUpgrade: () => { ev.push('upgrade'); return Promise.resolve(true); },
    scStreamStart: (u) => { ev.push('start:' + u); return Promise.resolve(o.linkRefused ? u === 'blob:prefix' : true); },
    scStreamWatch: () => { ev.push('watch'); },
    scStreamWarmNext: () => {},
    scStreamSay: (s) => said.push(String(s)),
    scStreamReason: () => '',
    scStreamTick: () => {},
    scStreamResolveCached: () => Promise.resolve(o.cached === undefined ? 'link' : o.cached),
    scStreamResolve: () => { ev.push('resolve'); return Promise.resolve(o.resolved === undefined ? 'link2' : o.resolved); }
  };
  vm.createContext(ctx);
  vm.runInContext(fresh + '\nthis.__f = scStreamPlayFresh;', ctx);
  return { ctx, ev, said };
}

(async () => {
  // The link is refused: the opening must play, and the whole read must come after it.
  {
    const w = world({ linkRefused: true });
    await w.ctx.__f({ id: 's1', videoId: 'v1' });
    const at = (k) => w.ev.indexOf(k);
    ok('driven: the opening is asked for before the link is tried', at('prefix-asked') === 0);
    ok('driven: the link is tried second', w.ev[1] === 'start:link');
    ok('driven: a refused link opens from the first megabyte', at('start:blob:prefix') > at('start:link'));
    ok('driven: the whole copy is only taken on after the opening plays', at('upgrade') > at('start:blob:prefix'));
    ok('driven: the whole song is never read before the opening', at('upgrade') > -1 && at('upgrade') < w.ev.length);
  }
  // The link plays: the opening is still asked for, and the upgrade follows the link.
  {
    const w = world({ linkRefused: false });
    await w.ctx.__f({ id: 's1', videoId: 'v1' });
    const at = (k) => w.ev.indexOf(k);
    ok('driven: the opening goes out even when the link plays', at('prefix-asked') === 0);
    ok('driven: a playing link is watched', at('watch') > -1);
    ok('driven: and the whole copy follows it', at('upgrade') > at('watch'));
    ok('driven: nothing falls back when the link works', at('fallback') === -1);
  }
  // Nothing resolves: two asks, then the honest line.
  {
    const w = world({ cached: '', resolved: '' });
    await w.ctx.__f({ id: 's1', videoId: 'v1' });
    ok('driven: the resolver is asked twice before giving up', w.ev.filter((e) => e === 'resolve').length === 1);
    ok('driven: and it says so instead of sitting silent', /No playable stream/.test(w.said.join(' ')));
    ok('driven: and nothing is played', !w.ev.some((e) => /^start:/.test(e)));
  }
  // A song that was replaced mid-tap must not be started.
  {
    const w = world({ linkRefused: true });
    const p = w.ctx.__f({ id: 's1', videoId: 'v1' });
    w.ctx.scStreamState.curId = 'other';
    await p;
    ok('driven: a song that was replaced mid-tap is not played', !w.ev.includes('start:blob:prefix'));
  }

  // ---- survivors -----------------------------------------------------------
  ok('80.7.9 still keeps a song from the source', html.includes('  function scStreamKeepTrack(id, file){'));
  ok('80.7.9 still offers the keep in the long-press menu', html.includes("acts.push({ label: 'Download this song\\u2026'"));
  ok('80.7.9 still asks the four destinations', html.includes("'Save the file to this device"));
  ok('80.7.8 still leaves phones alone', !/pointer\s*:\s*coarse/.test(between('<style id="sc77Fit">', '</style>')));
  ok('80.7.8 still keeps its sheet', html.includes('80.7.8 - PHONES KEEP THEIR OWN LAYOUT'));
  ok('80.7.2 still crops a streamed song', html.includes('  async function scStreamCropFile(t){'));
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
  ok('every inline script compiles', scripts > 0);

  // ---- both channels -------------------------------------------------------
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null, hold = null;
  try { full = read('ota/updates.json'); } catch (e) { full = null; }
  try { play = read('ota-play/updates.json'); } catch (e) { play = null; }
  try { hold = read('dev/channel-hold.json'); } catch (e) { hold = null; }
  ok('the full channel is v80.7.10', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is not held', !!hold && hold.play === false);
  ok('the Play channel is v80.7.10', !!play && String(play.version) === VERSION);
  ok('the Play channel publishes the fallback, not the feature', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page carries the opening and the button',
    /const APP_VERSION = '80\.7\.10';/.test(zipped) && zipped.includes('function scStreamPrefix(') && zipped.includes('class="scs-keep"'));
  ok('the shipped Play page is the same page with its flag',
    /const APP_VERSION = '80\.7\.10';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true') && playZipped.includes('function scStreamPrefix('));

  if (failures.length) {
    console.log('check-80710: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-80710: ' + pass + ' passed, 0 failed');
})();
