#!/usr/bin/env node
// 80.7.11 - the shelf opens with nothing imported, and a save shows its real stages.
//
// Two things are driven, not grepped:
//   * scShelfPage is run against a stub document with an empty library, and with one
//     song, to prove the onboarding screen no longer sits on top of the shelf.
//   * scStreamDownload is run against stubs and the panel events it causes are recorded,
//     so the stages it shows are the stages it runs - including the failing one.
//
//   node dev/check-80711.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.11';

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
ok('the page is 80.7.11', html.includes("const APP_VERSION = '80.7.11';"));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.11 entry', !!entry);
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

// ---- a function's own text -------------------------------------------------
function fnText(name) {
  const lines = html.split('\n');
  const rx = new RegExp('^\\s*(async\\s+)?function\\s+' + name + '\\s*\\(');
  for (let i = 0; i < lines.length; i++) {
    if (rx.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !/^  (async )?function /.test(lines[j])) j++;
      return lines.slice(i, j).join('\n');
    }
  }
  return '';
}

// ---- the panel -------------------------------------------------------------
ok('the panel can open', /function scKeepPanelOpen\(title\)\{/.test(html));
ok('the panel carries a bar', html.includes("fill.id = 'scKeepPanelBar'"));
ok('the panel carries its rows', html.includes("list.id = 'scKeepPanelRows'"));
ok('a step ticks and completes', /function scKeepPanelStep\(key, label, pct\)\{/.test(html));
ok('earlier steps are ticked when a later one starts',
  /Every earlier step is finished the moment a later one is reached/.test(html));
ok('the panel can finish', /function scKeepPanelDone\(text, ok\)\{/.test(html));
ok('a failure is shown, not spun on', /ok === false \? '\\u00D7'/.test(html));
ok('the panel closes itself', /function scKeepPanelClose\(\)\{/.test(html) &&
  /scKeepUI\.timer = setTimeout\(scKeepPanelClose/.test(html));

// ---- the reader reports ----------------------------------------------------
const read = fnText('scStreamReadProgress');
ok('the whole file is read with a live percentage',
  read.includes('scFetchBytes(u, 0, function(loaded, total)') && read.includes('Math.round((loaded / total) * 100)'));
ok('and it reads in lanes like the stream', read.includes('SC_STREAM_LANES'));

const crop = fnText('scStreamCropFile');
ok('the crop reader takes an optional listener', /async function scStreamCropFile\(t, on\)\{/.test(crop));
ok('it says when it is finding the song', crop.includes("step('find')"));
ok('it reports the read', crop.includes("step('read', pct)") || /step\('read'/.test(crop));
ok('it checks the audio', crop.includes("step('check')"));
ok('it packs the file', crop.includes("step('pack')"));
ok('a cached copy still reports a finished read', crop.includes("step('read', 100)"));
ok('the crop sheet still calls it with no listener', /scStreamCropFile\(\{\s*streamId/.test(html));

// ---- the save drives it ----------------------------------------------------
const dl = fnText('scStreamDownload');
ok('the save opens the panel', dl.includes('scKeepPanelOpen(title)'));
ok('the save moves the panel with the real stages', dl.includes("scKeepPanelStep('find'") &&
  dl.includes("scKeepPanelStep('read'") && dl.includes("scKeepPanelStep('save'"));
ok('the save closes it with the answer', dl.includes('scKeepPanelDone('));
ok('a failure closes it as a failure', /scKeepPanelDone\('Could not save it/.test(dl));
ok('and says the reason', /the source did not answer/.test(dl));
ok('the file destination still hands the file out', dl.includes('await saveExportFile(out, out.name)'));
ok('the library destination still keeps the song', dl.includes('scStreamKeepTrack(id, file)'));
ok('one save at a time is still enforced', dl.includes("if(scKeepBusy){"));

// ---- the shelf with nothing imported --------------------------------------
const shelf = fnText('scShelfPage');
ok('the shelf hides the onboarding screen while it is open', /on \? 'none'/.test(shelf));
ok('and puts it back by the same rule navigate uses', shelf.includes('scLibraryReadOk'));

function shelfWorld(trackCount) {
  const els = {};
  const mk = (id) => ({
    id,
    style: {},
    classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } }
  });
  ['listPane', 'library', 'emptyState', 'scStreamBlock'].forEach((id) => { els[id] = mk(id); });
  const ctx = {
    document: { getElementById: (id) => els[id] || null },
    allTracks: new Array(trackCount),
    scLibraryReadOk: true,
    scShelfSheet: () => els['scStreamBlock']
  };
  vm.createContext(ctx);
  vm.runInContext(shelf + '\nthis.__p = scShelfPage;', ctx);
  return { ctx, els };
}

// ---- driven: the shelf -----------------------------------------------------
{
  const w = shelfWorld(0);
  w.ctx.__p(true);
  ok('driven: with no songs the shelf still opens over the onboarding screen',
    w.els.emptyState.style.display === 'none');
  ok('driven: and its sheet is open', w.els.scStreamBlock.classList.contains('scShelfOpen'));
  w.ctx.__p(false);
  ok('driven: closing it brings the onboarding screen back', w.els.emptyState.style.display === 'flex');
}
{
  const w = shelfWorld(2);
  w.ctx.__p(false);
  ok('driven: a library with songs keeps the onboarding screen hidden', w.els.emptyState.style.display === 'none');
}
{
  const w = shelfWorld(0);
  w.ctx.scLibraryReadOk = false;
  w.ctx.__p(false);
  ok('driven: a failed library read never shows the onboarding screen', w.els.emptyState.style.display === 'none');
}

// ---- driven: the save ------------------------------------------------------
function dlWorld(opts) {
  const o = opts || {};
  const ev = [];
  const ctx = {
    console: { warn() {}, log() {} },
    scKeepBusy: '',
    scStreamEntry: (id) => (String(id) === 'gone' ? null : ({ id: 's1', title: 'Aaj Sajeya', artist: 'Goldie Sohel' })),
    scStreamKeptFrom: () => (o.kept ? { id: 't1', name: 'Aaj Sajeya' } : null),
    scKeepPanelOpen: (t) => ev.push('open:' + t),
    scKeepPanelStep: (k, label, pct) => ev.push('step:' + k + (typeof pct === 'number' ? ':' + pct : '')),
    scKeepPanelDone: (t, ok) => ev.push('done:' + (ok === false ? 'fail' : 'ok')),
    scStreamCropFile: async (t, on) => {
      if (o.throwRead) throw new Error('the song could not be read from its source');
      ev.push('crop');
      if (on) { on('find'); on('read', 40); on('read', 100); on('check'); on('pack'); }
      return { name: 'aaj.m4a' };
    },
    saveExportFile: async (f, n) => { ev.push('export:' + n); },
    scStreamKeepTrack: () => { ev.push('keep'); return { id: 't1', name: 'Aaj Sajeya' }; },
    scStreamKeepIn: (d) => { ev.push('in:' + String(d.kind) + ':' + String(d.name)); },
    scStreamSay: () => {},
    toast: () => {}
  };
  vm.createContext(ctx);
  vm.runInContext(dl + '\nthis.__d = scStreamDownload;', ctx);
  return { ctx, ev };
}

(async () => {
  {
    const w = dlWorld();
    await w.ctx.__d('s1', { kind: 'lib' });
    const want = ['open:Aaj Sajeya', 'crop', 'step:find', 'step:read:40', 'step:read:100',
      'step:check:100', 'step:pack:100', 'step:save:100', 'keep', 'done:ok'];
    ok('driven: a library save shows finding, reading with a percentage, checking, packing, then saving',
      JSON.stringify(w.ev) === JSON.stringify(want));
    ok('driven: the panel opens before the work starts', w.ev[0].indexOf('open:') === 0);
    ok('driven: and only closes after the song is kept', w.ev.indexOf('keep') < w.ev.indexOf('done:ok'));
  }
  {
    const w = dlWorld();
    await w.ctx.__d('s1', { kind: 'file' });
    ok('driven: a file save hands the file out and says where it went',
      w.ev.includes('export:aaj.m4a') && w.ev[w.ev.length - 1] === 'done:ok');
    ok('driven: and never adds it to the library', !w.ev.includes('keep'));
  }
  {
    const w = dlWorld();
    await w.ctx.__d('s1', { kind: 'pl', name: 'Gym' });
    ok('driven: a playlist save puts it in the list after keeping it',
      w.ev.includes('in:pl:Gym') && w.ev.indexOf('keep') < w.ev.indexOf('in:pl:Gym'));
  }
  {
    const w = dlWorld({ kept: true });
    await w.ctx.__d('s1', { kind: 'lib' });
    ok('driven: a song already on the device is not read twice', !w.ev.includes('crop'));
    ok('driven: and the panel still finishes on a success', w.ev[w.ev.length - 1] === 'done:ok');
  }
  {
    const w = dlWorld({ throwRead: true });
    await w.ctx.__d('s1', { kind: 'lib' });
    ok('driven: a failed read closes the panel as a failure', w.ev.includes('done:fail'));
    ok('driven: and nothing is added', !w.ev.includes('keep'));
  }
  {
    const w = dlWorld();
    await w.ctx.__d('gone', { kind: 'lib' });
    ok('driven: a song that left the shelf never opens the panel', !w.ev.some((e) => /^open:/.test(e)));
  }

  // ---- survivors -----------------------------------------------------------
  ok('80.7.10 still opens a stream from its first megabyte', html.includes('  function scStreamPrefix(u, mime){'));
  ok('80.7.10 still swaps in the whole copy', html.includes('  function scStreamUpgrade(u, videoId, want){'));
  ok('80.7.9 still keeps a song from the source', html.includes('  function scStreamKeepTrack(id, file){'));
  ok('80.7.9 still asks the four destinations', html.includes("'Save the file to this device"));
  ok('the save is still a visible button on a row', /class="scs-keep" data-id="/.test(html));
  ok('80.7.8 still leaves phones alone', !/pointer\s*:\s*coarse/.test((function () {
    const a = html.indexOf('<style id="sc77Fit">'), b = html.indexOf('</style>', a);
    return a < 0 || b < 0 ? '' : html.slice(a, b);
  })()));
  ok('80.7.2 still crops a streamed song', /async function scStreamCropFile\(t, on\)\{/.test(html));
  ok('the catalogue is still gated off the Play build', html.includes('var SC_STREAM_OK = !SC_IS_PLAY;'));
  ok('the rail still builds without a library', /rail\.setAttribute\('data-built', '1'\)/.test(html));

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
  const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null, hold = null;
  try { full = rd('ota/updates.json'); } catch (e) { full = null; }
  try { play = rd('ota-play/updates.json'); } catch (e) { play = null; }
  try { hold = rd('dev/channel-hold.json'); } catch (e) { hold = null; }
  ok('the full channel is v80.7.11', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is not held', !!hold && hold.play === false);
  ok('the Play channel is v80.7.11', !!play && String(play.version) === VERSION);
  ok('the Play channel publishes the fallback, not the feature', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page carries the panel and the shelf fix',
    /const APP_VERSION = '80\.7\.11';/.test(zipped) && zipped.includes('function scKeepPanelOpen(') && zipped.includes('scKeepPanelBar'));
  ok('the shipped Play page is the same page with its flag',
    /const APP_VERSION = '80\.7\.11';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true'));

  if (failures.length) {
    console.log('check-80711: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-80711: ' + pass + ' passed, 0 failed');
})();
