#!/usr/bin/env node
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function slice(from, to, what) {
  const a = page.indexOf(from);
  ok(a > 0, what + ' is on the page');
  if (a < 0) return '';
  const b = page.indexOf(to, a);
  ok(b > a, what + ' is closed');
  return b > a ? page.slice(a, b) : '';
}
function fnBody(name) {
  const at0 = page.indexOf('function ' + name + '(');
  ok(at0 > 0, name + ' exists');
  if (at0 < 0) return '';
  // Keep the `async` in front of it: a body sliced from `function` alone loses it
  // and every `await` inside becomes a syntax error.
  const a = page.slice(at0 - 6, at0) === 'async ' ? at0 - 6 : at0;
  let i = page.indexOf('{', a), depth = 0;
  for (let j = i; j < page.length; j++) {
    if (page[j] === '{') depth++;
    else if (page[j] === '}') { depth--; if (!depth) return page.slice(a, j + 1); }
  }
  return '';
}

// ---- the release itself -----------------------------------------------------
ok(page.includes("const APP_VERSION = '80.7.2';"), 'the page runs 80.7.2');
const at = page.indexOf("version: '80.7.2'");
ok(at > 0, 'the changelog records 80.7.2');
ok(at < page.indexOf("version: '80.7.1'"), 'and it is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes("title: 'The notification, the widget and Crop follow a song played from the catalogue'"),
  'and a title that names what changed');
const itemsBlock = entry.slice(entry.indexOf('items: ['), entry.indexOf(']},'));
const items = (itemsBlock.match(/'((?:[^'\\]|\\.)*)'/g) || []).map(s => s.slice(1, -1));
ok(items.length === 3, 'three notes (' + items.length + ')');
ok(!items.some(i => i.includes("'")), 'no note carries an apostrophe');
ok(!items.some(i => /both builds|each build|this build|other build|release channel|play store|sideload/i.test(i)),
  'and none of them talks about release channels');

// ---- the widget push --------------------------------------------------------
ok(page.includes('  function scStreamWidgetPush(){'), 'the stream has a widget push of its own');
const push = fnBody('scStreamWidgetPush');
ok(push.includes('try{ widgetTrackSeq++; }'), 'a new streamed song is a new native sequence');
ok(push.indexOf('scWidgetStreamSeen') < push.indexOf('widgetTrackSeq++'), 'but only when the song actually changed');
ok(push.includes('pushWidgetState(t, playing);'), 'and the pushed state is the stream live, not the deck');
ok(push.includes("if(!scStreamPhoneOwns()) return false;"), 'it does nothing when the deck owns the bar');
ok(page.includes('        pushWidgetState(scStreamPhoneTrack(), !!(a && !a.paused));\n') === false,
  'the old tick push that carried the deck seq is gone');
const tick = page.slice(page.indexOf('  function scStreamPhoneTick(force){'), page.indexOf('  function scStreamPhoneSync(){'));
ok(tick.includes('try{ scStreamWidgetPush(); }catch(_ePwd){}'), 'the ticking stream pushes through the new path');
ok(page.includes("    try{ scStreamWidgetPush(); }catch(_ePsW){}\n    scStreamPhoneTick(true);"),
  'and a play or pause from outside pushes straight away');
const hb = slice('    window.__scWidgetHeartbeat = function(){', '        if(widgetPlaying) window.__scWidgetPulse', 'the widget heartbeat');
ok(hb.includes('scStreamWidgetPush()'), 'the heartbeat pushes a stream too');
ok(hb.indexOf('scStreamWidgetPush()') < hb.indexOf('if(!widgetTrack) return;'),
  'before it can give up on a song that was never on the deck');
ok(page.includes('      if(typeof scStreamPhoneOwns === \'function\' && scStreamPhoneOwns()){\n        try{ scStreamWidgetPush(); }catch(_eWarm){}'),
  'and the one-time arm does the same');

// ---- the card after boot ----------------------------------------------------
const arm = slice('            // 80.7.2 - THE CARD BELONGS TO WHAT IS PLAYING', '            // Arming succeeded', 'the boot arm');
ok(arm.includes('scStreamPhoneSync()'), 'arming with a stream up syncs the stream');
ok(arm.indexOf('scStreamPhoneSync()') < arm.indexOf('if(_cur) mediaSetMetadata(_cur);'),
  'before it can hand the card to the deck song');

// ---- the press from outside -------------------------------------------------
ok(page.includes('  function scStreamResumeFromPhone(){'), 'the press from outside has a stream answer');
const resume = fnBody('scStreamResumeFromPhone');
ok(resume.includes('scStreamState.userPaused = false;'), 'a press to hear a stream ends the deliberate pause');
ok(resume.includes('Promise.resolve(a.play())'), 'and starts the element it was paused on');
ok(page.includes("      if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;"),
  'the restore press asks the stream before it says there is nothing to resume');
ok(page.indexOf('scStreamResumeFromPhone()) return true;') < page.indexOf('      if(queueIndex < 0 || queueIndex >= queue.length) return false;'),
  'and it is the first thing that press does');

// ---- crop -------------------------------------------------------------------
const open = slice('  async function openCropSongModal(t){', "    $('cropSongControls').style.display = '';", 'the crop sheet');
ok(open.includes('const cropStream = (!t.file && (t.stream || t.streamId)) ? t : null;'),
  'the sheet accepts a song with no file when it came from the catalogue');
ok(open.includes("if(!t.file && !cropStream){"), 'and still refuses a row with no bytes at all');
ok(open.includes('await scStreamCropFile(cropStream)'), 'and reads the stream bytes for it');
ok(page.includes('  async function scStreamCropFile(t){'), 'the reader exists');
const read = fnBody('scStreamCropFile');
ok(read.includes('scStreamState.blobUrl'), 'it prefers the object URL the stream is playing');
ok(read.indexOf('scStreamState.blobUrl') < read.indexOf('scStreamCacheGet(vid)'), 'then the read-ahead copy');
ok(read.includes('await scStreamReadOnly(src, scStreamState.mime, 0)'), 'then a fresh read of the same source');
ok(read.includes('URL.revokeObjectURL(fresh)'), 'and it never leaks the URL it made');
const applyAt = page.indexOf("  $('cropSongApply').addEventListener('click', async () => {");
const apply = page.slice(applyAt, page.indexOf('      const oldUrl = cropTrack.url;', applyAt));
ok(apply.includes('if(cropTrack.stream || cropTrack.streamId){'), 'apply branches for a streamed song');
ok(apply.indexOf('scCropStreamSave()') > 0 && apply.indexOf('scCropStreamSave()') < apply.indexOf('const wasPlaying = queue[queueIndex] === cropTrack.id;'),
  'before it can rewrite a row that is not a file');
ok(page.includes('  async function scCropStreamSave(){'), 'the clip writer exists');
const save = fnBody('scCropStreamSave');
ok(save.includes('allTracks.push(track)'), 'the clip becomes a library song');
ok(save.includes("allTracks.push(track);\n    if(!playlists['All Songs'])"), 'that is in All Songs');
ok(save.includes('persistTrackMeta(track)'), 'and is written to the library store');
ok(save.includes("croppedFromStream: String(t.streamId || t.id || '')"), 'and remembers the song it came off');
ok(save.includes("scEncodeAudioCooperative(slice, 'wav')") || save.includes("scEncodeAudioCooperative(slice, 'wav',"),
  'with the WAV fallback when the MP3 encoder is out of reach');
ok(!save.includes('cropTrack.file ='), 'and it never mutates the streamed row');
ok(page.includes("      acts.push({ label: 'Crop a clip from this song\\u2026', run: function(){ scStreamCrop(id); } });"),
  'the stream menu offers the crop');
ok(page.includes('  function scStreamCrop(id){'), 'and the opener builds the sheet a row it can read');
ok(fnBody('scStreamCrop').includes('openCropSongModal(row)'), 'by asking the sheet for the same one a download gets');
ok(fnBody('scStreamCrop').includes('row.stream = true;'), 'marked as a streamed song');

// ---- it runs ---------------------------------------------------------------
(function widgetPushRuns() {
  const body = fnBody('scStreamWidgetPush');
  const calls = [];
  const ctx = {
    scStreamState: { curId: 'abc', audio: { paused: false } },
    scStreamPhoneOwns: () => true,
    scStreamPhoneTrack: () => ({ id: 'sc-stream-abc', name: 'Song', artist: 'Artist', artUrl: 'https://x/1.jpg' }),
    pushWidgetState: (t, playing) => calls.push([t.name, playing]),
    widgetTrackSeq: 4, widgetTrack: null, widgetPlaying: false,
    scWidgetStreamSeen: '', String, Number
  };
  ctx.widgetTrackSeq = 4;
  vm.createContext(ctx);
  const scStreamWidgetPush = vm.runInContext('(' + body + ')', ctx);
  const first = scStreamWidgetPush.call(ctx);
  ok(first === true, 'the push reports that it took the bar');
  ok(ctx.widgetTrackSeq === 5, 'a new streamed song bumps the native sequence (' + ctx.widgetTrackSeq + ')');
  ok(calls.length === 1 && calls[0][0] === 'Song' && calls[0][1] === true, 'and the widget is told the song and that it plays');
  scStreamWidgetPush.call(ctx);
  ok(ctx.widgetTrackSeq === 5, 'the same song does not bump it again');
  ctx.scStreamPhoneOwns = () => false;
  ok(scStreamWidgetPush.call(ctx) === false, 'and the deck keeps its own push when it owns the bar');
})();

(function resumeRuns() {
  const body = fnBody('scStreamResumeFromPhone');
  let played = 0;
  const ctx = {
    scStreamState: { curId: 'abc', userPaused: true, revives: 3, audio: { paused: true, src: 'blob:x', play: () => { played++; return Promise.resolve(); } } },
    scStreamPhoneOwns: () => true,
    scStreamPhoneState: () => {},
    Promise, String
  };
  vm.createContext(ctx);
  const scStreamResumeFromPhone = vm.runInContext('(' + body + ')', ctx);
  ok(scStreamResumeFromPhone.call(ctx) === true, 'the press resumes a paused stream');
  ok(played === 1, 'the element is actually started');
  ok(ctx.scStreamState.userPaused === false, 'and the deliberate pause is cleared');
  ok(ctx.scStreamState.revives === 0, 'so the revive budget starts fresh');
})();

(function readRuns() {
  const body = fnBody('scStreamCropFile');
  const first = { id: 'k', title: 'Song', videoId: 'vid1' };
  const ctx = {
    scStreamById: () => first,
    scStreamState: { curId: 'k', blobUrl: 'blob:playing', mime: 'audio/webm' },
    scStreamCacheGet: () => null,
    scStreamResolve: () => Promise.resolve('https://cdn/1'),
    scStreamReadOnly: () => Promise.resolve(''),
    scSafeName: (s) => s.replace(/\s+/g, '-'),
    fetch: () => Promise.resolve({ blob: () => Promise.resolve(new Blob([new Uint8Array([1, 2, 3])], { type: 'audio/webm' })) }),
    File, Blob, URL, String, Number, RegExp, Promise, Error, isFinite
  };
  vm.createContext(ctx);
  const scStreamCropFile = vm.runInContext('(' + body + ')', ctx);
  return scStreamCropFile.call(ctx, { name: 'Song' }).then((file) => {
    ok(file && typeof file.name === 'string', 'the reader hands the sheet a File');
    ok(/^Song\.webm$/.test(file.name), 'named for the song and the real container (' + (file && file.name) + ')');
    ok(file.size === 3, 'holding the bytes it read');
    ok(file.type === 'audio/webm', 'with the type the source sent');
  }).catch((e) => { bad.push('the reader threw: ' + e.message); });
})();

// ---- every inline script still compiles ------------------------------------
const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
ok(scripts.length >= 6, 'the page has its inline scripts (' + scripts.length + ')');
let compiled = 0;
scripts.forEach((s, i) => {
  try { new vm.Script(s); compiled++; } catch (e) { bad.push('inline script ' + i + ' does not compile: ' + e.message); }
});
ok(compiled === scripts.length, 'and all ' + scripts.length + ' of them compile');

// ---- the channels -----------------------------------------------------------
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
ok(full.version === '80.7.2', 'ota/updates.json is 80.7.2');
ok((full.notes || []).length === 3, 'and publishes all three notes (' + (full.notes || []).length + ')');
const play = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play', 'updates.json'), 'utf8'));
ok(play.version === '80.7', 'the Play channel is held at 80.7 (' + play.version + ')');
const hold = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'channel-hold.json'), 'utf8'));
ok(hold.play === true && !!hold.why, 'and the hold says why');

console.log('check-8072: %d passed, %d failed', pass, bad.length);
for (const b of bad) console.log('  x ' + b);
process.exit(bad.length ? 1 : 0);
