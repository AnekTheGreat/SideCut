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
ok(page.includes("const APP_VERSION = '80.7.1';"), 'the page runs 80.7.1');
const at = page.indexOf("version: '80.7.1'");
ok(at > 0, 'the changelog records 80.7.1');
ok(at < page.indexOf("version: '80.7'"), 'and 80.7.1 is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: 'October \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
ok(entry.includes("title: 'Lyrics, DJ Mode and background play for a streaming song'"),
  'and a title that names what changed');
const items = (entry.slice(entry.indexOf('items: [')).match(/'((?:[^'\\]|\\.)*)'/g) || []).map(s => s.slice(1, -1));
ok(items.length === 3, 'three notes (' + items.length + ')');
ok(!items.some(i => i.startsWith('[FULL] ')), 'none of them is kept back from a build');
ok(!items.some(i => /both builds|each build|catch-?up|this build|other build|release channel|play store|sideload/i.test(i)),
  'and no note talks about release channels instead of the app');
ok(!items.some(i => i.includes("'")), 'no note carries an apostrophe');
ok(page.includes('  function scStreamSong(){'), 'the streamed song is mapped to a track');
ok(page.includes('  function scStreamLyricsSave(id, lyrics, synced){'), 'its words have somewhere to live');
ok(page.includes('  function scListenAudio(){'), 'and there is one answer for the element making sound');
ok(page.includes('  function scStreamRemember(force){'), 'the song and the second are remembered');
ok(page.includes('  function scStreamRestoreLast(){'), 'and restored on the next launch');
ok(page.includes("key: 'streamLast'"), 'under one stored key');
ok(page.includes("window.addEventListener('pagehide', function(){ try{ scStreamRemember(true); }catch(_ePh){} })"),
  'written at once when the app goes away');
const lyricsBtn = slice("  $('lyricsBtn').addEventListener('click', () => {", "  $('lyricsClose').addEventListener", 'the lyrics button');
ok(lyricsBtn.includes('const st = (typeof scStreamSong === \'function\') ? scStreamSong() : null;'),
  'the lyrics button asks the stream first');
ok(lyricsBtn.indexOf('scStreamSong()') < lyricsBtn.indexOf("toast('Play a song first')"),
  'before it can say there is no song');
ok(lyricsBtn.includes('if(st){ fetchLyrics(st); return; }'), 'and opens the sheet on the streamed song');
const prevBtn = slice("  $('lyricsPrevBtn').addEventListener('click', () => {", "  $('lyricsNextBtn').addEventListener", 'the sheet previous');
ok(prevBtn.includes('scStreamNext(-1);'), 'the sheet previous walks the stream');
const nextBtn = slice("  $('lyricsNextBtn').addEventListener('click', () => {", '  // Play/pause from inside the lyrics modal', 'the sheet next');
ok(nextBtn.includes('scStreamNext(1);'), 'the sheet next walks the stream');
ok(page.includes("    const a = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();\n    const paused = !a || a.paused;"),
  'the sheet icon reads the element that is playing');
const playBtn = slice("  $('lyricsPlayPauseBtn').addEventListener('click', () => {", '  // ---------------- The song menu (3-dot)', 'the sheet play button');
ok(playBtn.includes("const a = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();"),
  'the sheet play button drives that element');
ok(playBtn.includes('scStreamState.userPaused = true;'), 'a pause from the sheet is a deliberate one');
ok(playBtn.includes('scStreamRestart();'), 'and a stream whose source went starts again');
ok(page.includes("      const audio = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();\n      if (!audio) return;\n      // Paused means the clock has stopped"),
  'the highlight clock follows that element');
ok(page.includes("            var _stSong = (typeof scStreamSong === 'function') ? scStreamSong() : null;\n            var _stDur = _stSong ? Number(_stSong.duration) : 0;"),
  'a plain sheet is paced by the streamed length');
ok(page.includes('  function scLyricsPersist(track){'), 'words are written through one helper');
ok(page.includes('        scLyricsPersist(track);\n'), 'a found sheet is saved for the stream');
ok(page.includes('      try{ scLyricsPersist(track); }catch(_eMissStamp){}'), 'and a missing one is stamped on it');
const fetchLyrics = slice('  async function fetchLyrics(track) {', '  // Say what was actually looked for', 'the lyrics fetch');
ok(!fetchLyrics.includes('persistTrackMeta(track)'), 'the sheet no longer writes a library record for a streamed song');
ok(page.includes('  let djStreamTrack = null; // 80.7.1 - the streamed song, when the deck is holding one'),
  'the deck remembers the streamed song it holds');
ok(page.includes('  function djTrackById(id){'), 'and has one lookup for what it is holding');
ok(page.includes('  function djStreamUrl(t){'), 'and one answer for where its bytes are');
const refresh = slice('  function refreshDjMode(){', '    if(t.id !== djLastTrackId){', 'the platter');
ok(refresh.includes('const t = djTrackById(djCurrentTrackId);'), 'the platter resolves a streamed song');
ok(!page.includes('    const t = allTracks.find(tr => tr.id === djCurrentTrackId);\n    if(!t) return;'),
  'and no longer asks allTracks alone');
const enter = slice('  async function enterDjMode(){', '  function exitDjMode(){', 'DJ Mode entry');
ok(enter.includes("const streamSong = (typeof scStreamSong === 'function') ? scStreamSong() : null;"),
  'DJ Mode asks the stream first');
ok(enter.includes('const t = streamSong || allTracks.find(tr => tr.id === queue[queueIndex]);'),
  'and falls back to the deck for a file');
ok(enter.includes('djStreamTrack = streamSong || null;'), 'it hands the deck the streamed song');
ok(enter.includes('streamSong.url = djStreamUrl(streamSong);'), 'and the bytes the stream is playing');
ok(enter.includes('streamSong.url = await scStreamReadOnly(scStreamState.url, scStreamState.mime, scStreamState.size);'),
  'or reads the same source when that URL is gone');
ok(enter.includes('if(_sAudio){ try{ _sAudio.pause(); }catch(_eDjSp){} }'), 'the stream goes quiet while the deck plays');
const exit = slice('  function exitDjMode(){', "  $('djModeBtn').addEventListener('click', enterDjMode);", 'DJ Mode exit');
ok(exit.includes('const _djStreamSong = djStreamTrack;'), 'leaving the rig knows whether it held a stream');
ok(exit.includes('_sa.currentTime = Math.max(0, Math.min(Number(_sa.duration) || pos, pos));'),
  'and puts the stream back at the second the platter stopped on');
ok(exit.includes('Promise.resolve(_sa.play()).catch(function(){});'), 'playing again if it was playing');
const heartbeat = slice('  function startMediaSessionHeartbeat(){', '      if(a.paused && !userPaused', 'the background heartbeat');
ok(heartbeat.includes("const listen = (typeof scListenAudio === 'function') ? scListenAudio() : activeAudio();"),
  'the heartbeat asks the element that is playing');
ok(heartbeat.includes('if(document.hidden && (!listen || listen.paused)) return;'),
  'so a backgrounded stream is not read as silence');
ok(page.includes("      if(typeof scStreamPhoneOwns === 'function' && scStreamPhoneOwns()){\n        const sa = scStreamState.audio;\n        if(sa && sa.paused && !scStreamState.userPaused"),
  'a stream the phone silenced is started again');
ok(page.includes('if(scStreamState.revives <= 20){'), 'with a ceiling on the attempts');
ok(page.includes('const bgDead = (typeof scStreamPhoneOwns === \'function\' && scStreamPhoneOwns())\n        ? false : (!userPaused && !playbackSurvivedBackground());'),
  'and the notification is not marked paused under a playing stream');
ok(page.includes('    if(!at && scStreamState.pendingAt){ at = scStreamState.pendingAt; }'),
  'a resumed stream starts at the remembered second');
ok(page.includes('    if(String(scStreamState.resumeId || \'\') !== String(id)) scStreamState.pendingAt = 0;'),
  'and only the remembered song does');
ok(page.includes('    try{ if(typeof scStreamRemember === \'function\') scStreamRemember(); }catch(_eRemTick){}'),
  'every few seconds of a stream is remembered');
ok(page.includes('      if(typeof scStreamRestoreLast === \'function\') scStreamRestoreLast();'),
  'and the last one comes back after a launch');
const deliberate = (page.match(/scStreamState\.userPaused = true;/g) || []).length;
ok(deliberate >= 4, 'every deliberate pause is marked (' + deliberate + ')');
require('./check-8071-run.cjs')(page, ok, slice);
const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
ok(full.version === '80.7.1', 'ota/updates.json is 80.7.1');
ok((full.notes || []).length === 1, 'and publishes the one honest line this release leaves it');
ok(full.notes[0] === 'Fixes and improvements under the hood.',
  'because every note about this release names what the Play card hides by rule');
const play = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play', 'updates.json'), 'utf8'));
ok(play.version === '80.7', 'the Play channel is held at 80.7 (' + play.version + ')');
const hold = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'channel-hold.json'), 'utf8'));
ok(hold.play === true && !!hold.why, 'and the hold says why');
console.log('check-8071: %d passed, %d failed', pass, bad.length);
for (const b of bad) console.log('  x ' + b);
process.exit(bad.length ? 1 : 0);
