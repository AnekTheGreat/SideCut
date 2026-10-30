#!/usr/bin/env node
// 80.6.20 - the stream reaches the phone: the media session, the notification and
// the home-screen widget, and the phone's buttons come back into the stream.
//
//   node dev/check-80620.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.20';"), 'the page runs 80.6.20');
ok(page.includes("version: '80.6.20'"), 'the changelog records 80.6.20');
ok(page.includes('80.6.20 - THE PHONE SEES THE STREAM'), 'the release comment is in the script');

function sliceFn(name) {
  const at = page.indexOf('\n  function ' + name + '(');
  if (at === -1) return '';
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  return end === -1 ? '' : page.slice(start, end + 4);
}

/* ── the stream owns the phone while it owns the bar ────────────────────── */
const owns = sliceFn('scStreamPhoneOwns');
ok(owns.includes('scStreamState.barOn') && owns.includes('scStreamState.curId'),
  'the stream owns the phone while it owns the bar');

const track = sliceFn('scStreamPhoneTrack');
ok(track.includes('name: String(t.title'), 'the phone gets the song title');
ok(track.includes('artist: String(t.artist'), 'and the artist');
ok(track.includes('artUrl: scStreamThumb(t)'), 'and the cover the card already shows');

const sync = sliceFn('scStreamPhoneSync');
ok(sync.includes('mediaSetMetadata(scStreamPhoneTrack())'), 'starting a stream sets the phone card');
ok(sync.includes('scStreamPhoneState()'), 'and the playback state');
ok(sync.includes('scStreamPhoneArm()'), 'and the buttons');
ok(page.includes('      scStreamPhoneSync();\n    }catch(_eBarOn){}'), 'the bar hands the stream to the phone');

const state = sliceFn('scStreamPhoneState');
ok(state.includes('mediaSetPlaybackState('), 'play and pause reach the phone');
ok(page.includes('scStreamBarSync(); scStreamPhoneState(); });'), 'the audio element says so on play and pause');

const tick = sliceFn('scStreamPhoneTick');
ok(tick.includes('mediaSetPositionState(p.dur, 1, Math.min(p.at, p.dur))'), 'the phone gets the stream clock');
ok(tick.includes('now - scStreamPhoneAt < 1000'), 'throttled, because timeupdate fires four times a second');
ok(tick.includes('pushWidgetState(scStreamPhoneTrack()'), 'and the widget is pushed while it plays');
ok(page.includes('    scStreamBarSync();\n    scStreamPhoneTick();'), 'every stream tick feeds the phone');

/* ── the phone's buttons come back into the stream ─────────────────────── */
const arm = sliceFn('scStreamPhoneArm');
for (const a of ['play', 'pause', 'previoustrack', 'nexttrack', 'stop', 'seekbackward', 'seekforward', 'seekto']) {
  ok(arm.includes("mediaSetActionHandler('" + a + "'"), 'the phone\'s ' + a + ' is registered');
}
ok(arm.includes('scStreamNext(1)'), 'next drives the stream queue (and its genre)');
ok(arm.includes('scStreamNext(-1)'), 'previous too');
ok(arm.includes('if(a && (a.currentTime || 0) > 3)'), 'previous past three seconds restarts the song, like every player');
ok(arm.includes('scStreamPlay(scStreamState.curId)'), 'play on a stream with no source starts it again');
ok(sliceFn('scStreamPhonePos').includes('.dur) || 0'), 'the length falls back to the search result when the element has none');

const reg = sliceFn('registerMediaSessionHandlers');
ok(reg.includes('if(scStreamPhoneOwns()){ try{ scStreamPhoneArm(); }catch(_eRms){ } return; }'),
  'a rebuilt session arms the stream, not the deck');
ok(reg.indexOf('scStreamPhoneArm') < reg.indexOf("mediaSetActionHandler('play', () => {"),
  'and that guard comes first');

const refresh = sliceFn('refreshMediaControls');
ok(refresh.includes('if(scStreamPhoneOwns()){ try{ scStreamPhoneSync(); }catch(_eRmc){ } return; }'),
  'the heartbeat refreshes the stream, not the deck');
ok(refresh.indexOf('scStreamPhoneSync') < refresh.indexOf('registerMediaSessionHandlers();'),
  'and before the deck is re-armed');

/* ── the widget ───────────────────────────────────────────────────────── */
ok(page.includes('const a = (scStreamPhoneOwns() && scStreamState.audio) ? scStreamState.audio'),
  'the widget timeline reads the stream element');
ok(page.includes('pushWidgetState(scStreamPhoneTrack(), !!(a && !a.paused))'),
  'the widget is handed the streamed song');
ok(page.includes('&& !scStreamPhoneOwns()'), 'and the deck heartbeat leaves a stream alone');

/* ── and it hands the phone back ──────────────────────────────────────── */
const quit = sliceFn('scStreamPhoneQuit');
ok(quit.includes('mediaSetMetadata(cur)'), 'when the stream lets go, the deck gets its card back');
ok(quit.includes('mediaHandlersNeedArm()') && quit.includes('registerMediaSessionHandlers()'),
  'and its buttons back');
ok(page.includes('    scStreamPhoneQuit();\n  }'), 'the bar leaving hands it back');

/* ── driven: the track the phone is given, and the buttons it gets ────── */
const calls = [];
const handlers = {};
const ctx = {
  Date, Object, Number, String, Array, Promise, Math, isFinite,
  scStreamState: { barOn: true, curId: 's_1', audio: null },
  scStreamById: (id) => (id === 's_1' ? { id: 's_1', title: 'Channa Mereya', artist: 'Arijit Singh', videoId: 'abc123', dur: 298 } : null),
  scStreamThumb: (t) => 'https://i.ytimg.com/vi/' + t.videoId + '/mqdefault.jpg',
  scStreamNext: (d) => calls.push('next' + d),
  scStreamPlay: (id) => calls.push('play:' + id),
  mediaSetMetadata: (t) => calls.push('meta:' + t.name),
  mediaSetPlaybackState: (s) => calls.push('state:' + s),
  mediaSetPositionState: (d) => calls.push('pos:' + d),
  pushWidgetState: (t, p) => calls.push('widget:' + t.name + ':' + p),
  mediaSetActionHandler: (a, h) => { handlers[a] = h; calls.push('arm:' + a); },
  mediaHandlersNeedArm: () => calls.push('arm-dirty'),
  registerMediaSessionHandlers: () => calls.push('deck-armed'),
  queue: [], allTracks: [], queueIndex: 0
};
vm.createContext(ctx);
vm.runInContext(['scStreamPhoneOwns', 'scStreamPhoneTrack', 'scStreamPhonePos', 'scStreamPhoneState',
  'scStreamPhoneTick', 'scStreamPhoneSync', 'scStreamPhoneArm', 'scStreamPhoneQuit']
  .map(sliceFn).join('\n') + '\nthis.__sync = scStreamPhoneSync; this.__arm = scStreamPhoneArm;' +
  ' this.__quit = scStreamPhoneQuit; this.__track = scStreamPhoneTrack;' +
  ' var scStreamPhoneAt = 0; var scStreamPhoneWdAt = 0;', ctx);

ok(vm.runInContext('this.__track().name', ctx) === 'Channa Mereya', 'driven: the phone is given the streamed title');
ok(vm.runInContext('this.__track().artist', ctx) === 'Arijit Singh', 'driven: and its artist');
ok(vm.runInContext('this.__track().artUrl', ctx) === 'https://i.ytimg.com/vi/abc123/mqdefault.jpg',
  'driven: and its cover');

calls.length = 0;
vm.runInContext('this.__sync()', ctx);
ok(calls[0] === 'meta:Channa Mereya', 'driven: starting a stream sets the card');
ok(calls.includes('state:paused'), 'driven: with the state it is actually in');
ok(calls.filter((c) => c.startsWith('arm:')).length === 8, 'driven: and every transport button');

// A real element: pause / play through the handlers the phone was given.
const el = { src: 'blob:1', currentTime: 42, duration: 298, paused: false, pause() { this.paused = true; }, play() { this.paused = false; return Promise.resolve(); } };
ctx.scStreamState.audio = el;
calls.length = 0;
handlers.pause();
ok(el.paused === true, 'driven: pause from the phone pauses the stream');
handlers.play();
ok(el.paused === false, 'driven: play from the phone plays the stream');
calls.length = 0;
handlers.previoustrack();
ok(el.currentTime === 0 && !calls.includes('next-1'), 'driven: previous past three seconds restarts the song');
el.currentTime = 1;
handlers.previoustrack();
ok(calls.includes('next-1'), 'driven: inside three seconds it takes the previous song');
calls.length = 0;
handlers.nexttrack();
ok(calls.includes('next1'), 'driven: next takes the next song in the genre');
calls.length = 0;
el.currentTime = 42;
handlers.seekforward();
ok(el.currentTime === 72, 'driven: the forward jump moves the stream thirty seconds');
calls.length = 0;
handlers.stop();
ok(el.paused === true && el.currentTime === 0, 'driven: stop stops it and rewinds it');

// The clock: the element's own duration wins, the search result is the fallback.
calls.length = 0;
vm.runInContext('scStreamState.audio.duration = NaN; this.__sync()', ctx);
ok(calls.includes('pos:298'), 'driven: with no element duration it uses the song length');

// Giving the phone back.
calls.length = 0;
ctx.allTracks = [{ id: 'l_1', name: 'Mine', artist: 'Me' }];
ctx.queue = ['l_1'];
ctx.queueIndex = 0;
vm.runInContext('this.__quit()', ctx);
ok(calls.includes('meta:Mine'), 'driven: the deck gets its card back');
ok(calls.includes('deck-armed'), 'driven: and its buttons');

if (bad.length) {
  console.log('check-80620: %d passed, %d FAILED', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(1);
}
console.log('check-80620: %d passed, 0 failed', pass);
