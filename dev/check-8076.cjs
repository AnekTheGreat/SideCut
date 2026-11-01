#!/usr/bin/env node
// 80.7.6 - the bar comes back to the song that was played last.
//
// Release pins, then the decision and the restore DRIVEN: a shared record saying
// the deck played must keep the catalogue off the bar, one saying the catalogue
// played must put it back at its second, and an install with no shared record at
// all has to fall back to the timestamps rather than to a twelve-hour window.
//
//   node dev/check-8076.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.6';

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
async function flush() { for (let i = 0; i < 8; i++) await Promise.resolve(); }

// ---- the release -----------------------------------------------------------
ok('the page is 80.7.6', html.includes("const APP_VERSION = '80.7.6';"));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.6 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(String(it))));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('this release has nothing the Play card can honestly publish',
  playNotes(items)[0] === 'Fixes and improvements under the hood.');

// ---- the shared record -----------------------------------------------------
ok('scLastPlayedSet is defined', html.includes('  function scLastPlayedSet(kind, id){'));
ok('the deck writes it', (html.match(/scLastPlayedSet\('deck', t\.id\)/g) || []).length === 1);
ok('the catalogue writes it', (html.match(/scLastPlayedSet\('stream', String\(id\)\)/g) || []).length === 1);
ok('the deck state records when it was saved',
  html.includes('        sourcePlaylist: queueSourcePlaylist,\n') && html.includes('        savedAt: Date.now(),\n'));
ok('the restore reads all three rows', html.includes("dbGet('meta', 'lastPlayed')") && html.includes('Promise.all(['));
ok('the restore asks the decision', html.includes('scLastPlayedWasStream(v,'));

const stampCode = fnText('function scLastPlayedSet(kind, id){');
const put = [];
const stampCtx = sandbox(stampCode, { dbPut: (store, row) => put.push({ store, row }), Date, String, Object });
stampCtx.scLastPlayedSet('deck', 't42');
ok('a stamp writes one meta row', put.length === 1 && put[0].store === 'meta' && put[0].row.key === 'lastPlayed');
ok('and it names the player and the song', put.length === 1 && put[0].row.value.kind === 'deck' && put[0].row.value.id === 't42');
ok('and it carries a time', put.length === 1 && typeof put[0].row.value.at === 'number' && put[0].row.value.at > 0);
stampCtx.scLastPlayedSet('stream', 'vid');
ok('a second stamp is a second row', put.length === 2 && put[1].row.value.kind === 'stream');

// ---- the decision, every shape the rows can be in --------------------------
const decideCtx = sandbox(fnText('function scLastPlayedWasStream(streamLast, deckState, stamp){'));
const D = decideCtx.scLastPlayedWasStream;
const oldStream = { id: 'v', at: 12, savedAt: 1000 };
const oldDeck = { currentTime: 0, savedAt: 2000 };
ok('a record saying the deck played keeps the catalogue off',
  D(oldStream, oldDeck, { kind: 'deck', at: 3000 }) === false);
ok('a record saying the catalogue played puts it back',
  D(oldStream, oldDeck, { kind: 'stream', at: 3000 }) === true);
ok('no record at all: the newer deck wins', D(oldStream, oldDeck, null) === false);
ok('no record at all: the newer catalogue wins', D({ savedAt: 5000 }, oldDeck, null) === true);
ok('no record and no times: a deck paused mid-song wins',
  D({ savedAt: 0 }, { currentTime: 42 }, null) === false);
ok('no record and no times: an empty deck leaves the catalogue alone',
  D({ savedAt: 0 }, null, null) === true);
ok('an empty stamp is not a record', D(oldStream, oldDeck, {}) === false);
ok('a stamp with an unknown kind favours the deck', D(oldStream, oldDeck, { kind: 'widget' }) === false);

// ---- the restore, driven ---------------------------------------------------
const restoreCode = fnText('function scLastPlayedWasStream(streamLast, deckState, stamp){') + '\n'
  + fnText('function scStreamRestoreLast(){');
async function restoreRun(rows) {
  const state = { barOn: false, curId: '', resumeId: '', resumeAt: 0, bars: 0, says: [], rendered: 0 };
  const ctx = sandbox(restoreCode, {
    SC_STREAM_OK: true,
    scStreamState: state,
    dbGet: (store, key) => Promise.resolve(rows[key] ? { value: rows[key] } : null),
    scStreamById: (id) => (String(id) === 'vid-song' ? { id: 'vid-song', title: 'A song', artist: 'An artist' } : null),
    scStreamBarOn: () => { state.barOn = true; state.bars++; },
    scStreamBarSync: () => {},
    scStreamSay: (m) => state.says.push(String(m || '')),
    scStreamRender: () => { state.rendered++; },
    Date, Promise, String, Number, Object, Math
  });
  ctx.scStreamRestoreLast();
  await flush();
  return state;
}
const now = Date.now();

(async () => {
  const streamFiveMin = { id: 'vid-song', at: 63, savedAt: now - 5 * 60 * 1000 };

  const deckLast = await restoreRun({
    streamLast: streamFiveMin,
    playback: { currentTime: 30, savedAt: now - 60 * 1000 },
    lastPlayed: { kind: 'deck', id: 't1', at: now - 60 * 1000 }
  });
  ok('a download played later keeps the bar', deckLast.barOn === false && deckLast.bars === 0);
  ok('and the catalogue does not take the song over', deckLast.curId === '' && deckLast.resumeId === '');
  ok('and nothing is said about carrying on', deckLast.says.length === 0);
  ok('and the bar is not redrawn', deckLast.rendered === 0);

  const streamLastRun = await restoreRun({
    streamLast: streamFiveMin,
    playback: { currentTime: 30, savedAt: now - 60 * 60 * 1000 },
    lastPlayed: { kind: 'stream', id: 'vid-song', at: now - 5 * 60 * 1000 }
  });
  ok('a catalogue song played last comes back', streamLastRun.barOn === true && streamLastRun.bars === 1);
  ok('at the second it stopped on', streamLastRun.curId === 'vid-song' && streamLastRun.resumeId === 'vid-song' && streamLastRun.resumeAt === 63);
  ok('and it says so', /carry on where you left off/.test(streamLastRun.says.join(' ')));
  ok('and the bar is drawn', streamLastRun.rendered === 1);

  const stale = await restoreRun({
    streamLast: { id: 'vid-song', at: 63, savedAt: now - 13 * 60 * 60 * 1000 },
    lastPlayed: { kind: 'stream', id: 'vid-song', at: now - 13 * 60 * 60 * 1000 }
  });
  ok('a song from yesterday is not brought back', stale.barOn === false && stale.curId === '');

  const gone = await restoreRun({
    streamLast: { id: 'vid-gone', at: 10, savedAt: now - 1000 },
    lastPlayed: { kind: 'stream', id: 'vid-gone', at: now - 1000 }
  });
  ok('a song that left the list is not brought back', gone.barOn === false && gone.curId === '');

  const legacyDeck = await restoreRun({
    streamLast: { id: 'vid-song', at: 63, savedAt: now - 5 * 60 * 1000 },
    playback: { currentTime: 44 }
  });
  ok('an install with no shared record: a paused download keeps the bar',
    legacyDeck.barOn === false && legacyDeck.curId === '');

  const legacyStream = await restoreRun({ streamLast: { id: 'vid-song', at: 63, savedAt: now - 5 * 60 * 1000 } });
  ok('an install with no shared record and an empty deck still restores the catalogue',
    legacyStream.barOn === true && legacyStream.curId === 'vid-song');

  const nothing = await restoreRun({});
  ok('nothing saved restores nothing', nothing.barOn === false && nothing.curId === '');

  // ---- survivors -----------------------------------------------------------
  ok('80.7.5 still puts the album cover on every row', html.includes('  function scAlbumRowArt(t){'));
  ok('80.7.4 still judges a copy against the song', html.includes('function scStreamWhole(want, got){'));
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

  // ---- both channels -------------------------------------------------------
  const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null, hold = null;
  try { full = read('ota/updates.json'); } catch (e) { full = null; }
  try { play = read('ota-play/updates.json'); } catch (e) { play = null; }
  try { hold = read('dev/channel-hold.json'); } catch (e) { hold = null; }
  ok('the full channel is v80.7.6', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is held', !!hold && hold.play === true);
  ok('the Play channel stays at v80.7.5', !!play && String(play.version) === '80.7.5');
  ok('the Play channel keeps its one note', !!play && play.notes.length === 1);
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page is 80.7.6 with the shared record',
    /const APP_VERSION = '80\.7\.6';/.test(zipped) && zipped.includes('function scLastPlayedWasStream('));
  ok('the shipped Play page is still a Play build at 80.7.5',
    /const APP_VERSION = '80\.7\.5';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true'));

  if (failures.length) {
    console.log('check-8076: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-8076: ' + pass + ' passed, 0 failed');
})();
