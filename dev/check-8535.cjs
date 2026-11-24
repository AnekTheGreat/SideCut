// 85.3.5 harness - the audio-focus block that ships, run against a stubbed phone.
//
// Three reports, one block: the music died when other apps were used, it died with
// the OnePlus game assistant open, and the assistant duck never stepped the music
// back. The block is lifted out of index.html between its own two comments and run
// in a vm against a fake native plugin, a fake <audio> element and a fake Web Audio
// master gain, so what is asserted is the shipped code and not a copy of it.
//
//   node dev/check-8535.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const native = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-audiofocus.py'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const START = '  // ---------------- Android audio focus ----------------';
const END = '  // Records why playback stopped';
const a = page.indexOf(START);
const b = page.indexOf(END, a);
if (a < 0 || b < 0 || b <= a) {
  console.error('could not find the audio-focus block in index.html');
  process.exit(1);
}
const block = page.slice(a, b);

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- the fake phone ---------------------------------------------------------
const phone = { answer: { mode: 0, inCall: false, ringing: false, comm: false, musicActive: false } };
const listeners = {};
function makePlugin() {
  return {
    addListener(name, fn) { listeners[name] = fn; return Promise.resolve(); },
    callState() { return Promise.resolve(Object.assign({}, phone.answer)); },
    focusState() { return Promise.resolve(Object.assign({}, phone.answer)); },
    duckState() { return Promise.resolve({ over: true }); }
  };
}
const plugin = makePlugin();

// ---- the fake page ----------------------------------------------------------
const doc = { hidden: false, _vis: [], addEventListener(t, fn) { if (t === 'visibilitychange') this._vis.push(fn); } };
const stops = [];
const sandbox = {
  console, Date, JSON, Math, Number, String, Object, Array, Error, Promise,
  setInterval, clearInterval, setTimeout, clearTimeout,
  document: doc,
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
  Capacitor: { Plugins: { SideCutAudioFocus: plugin } },
  APP_VERSION: '85.3.5',
  __scHandBackMs: 20,
  queue: ['t1'], allTracks: [{ id: 't1' }], queueIndex: 0,
  userPaused: false,
  assistantDuckOn: true,
  assistantDuckLevel: 0.2,
  SC_DUCK_LEVELS: [0.2, 0.15, 0.25, 0.4],
  audioCtx: { currentTime: 12.5, state: 'running', resume() { return Promise.resolve(); } },
  scDuckMaster: null,
  scDuckFallbackVolume: null,
  scDuckFallbackEl: null,
  audio: null,
  recordPlaybackStop(w) { stops.push(String(w)); },
  ensureAudioGraph() {},
  scUndoPlatformPause() { return false; },
  scStreamState: { audio: null, userPaused: false, curId: '' },
  scStreamPhoneOwns() { return false; },
  msSincePlayStarted() { return 1e9; },
  __scVideoSoundOwn: false
};
sandbox.window = sandbox;
sandbox.$ = function () { return { style: { display: 'none' } }; };
sandbox.activeAudio = function () { return sandbox.audio; };
vm.createContext(sandbox);
vm.runInContext(block + '\n;globalThis.__scUnit = { scDuckSetLevel: scDuckSetLevel, ' +
  'scDuckForAssistant: scDuckForAssistant, scUnduckForAssistant: scUnduckForAssistant, ' +
  'scInCall: scInCall, scNoteCallState: scNoteCallState, scAskCallState: scAskCallState };',
  sandbox, { filename: 'audio-focus.js' });
const U = sandbox.__scUnit;
const HB = sandbox.__scHandBack;
if (!U || !U.scDuckForAssistant || !HB) { console.error('the block did not expose what it should'); process.exit(1); }

function makeAudio(at) {
  return {
    paused: false, ended: false, currentTime: at || 0, plays: 0, pauses: 0,
    play() { this.plays++; this.paused = false; return Promise.resolve(); },
    pause() { this.pauses++; this.paused = true; }
  };
}
function fireFocus(payload) {
  const fn = listeners.focusChange;
  if (!fn) throw new Error('the focus listener was never registered');
  fn(payload);
}
function gainStub() {
  return {
    value: 1, calls: [],
    cancelScheduledValues(t) { this.calls.push(['cancel', t]); },
    setValueAtTime(v, t) { this.calls.push(['set', v, t]); this.value = v; },
    linearRampToValueAtTime(v, t) { this.calls.push(['ramp', v, t]); this.value = v; }
  };
}
const quiet = (extra) => Object.assign({ mode: 0, inCall: false, ringing: false, comm: false, musicActive: false }, extra || {});

(async () => {
  // 1. THE DUCK IS SCHEDULED ON THE AUDIO CLOCK. 12.5 s into the context, not
  //    1.79 billion seconds, which is where Date.now() / 1000 put it.
  const gain = gainStub();
  // The master is a GainNode; the value that is scheduled is its `gain` AudioParam.
  sandbox.scDuckMaster = { gain: gain };
  sandbox.audio = makeAudio(95);
  sandbox.audioCtx.currentTime = 12.5;
  U.scDuckForAssistant('assistant listening');
  const ramp = gain.calls.filter((c) => c[0] === 'ramp').pop();
  ok('the duck ramps on the audio clock', !!ramp && ramp[1] === 0.2 && Math.abs(ramp[2] - 12.9) < 1e-6,
    JSON.stringify(gain.calls));
  ok('nothing is scheduled into the wall clock',
    gain.calls.every((c) => c[0] === 'cancel' ? c[1] < 1e6 : (c[2] === undefined || c[2] < 1e6)),
    JSON.stringify(gain.calls));
  ok('the duck starts from the value the node is on', gain.calls.some((c) => c[0] === 'set' && c[1] === 1 && Math.abs(c[2] - 12.5) < 1e-6),
    JSON.stringify(gain.calls));
  U.scUnduckForAssistant('done');
  const up = gain.calls.filter((c) => c[0] === 'ramp').pop();
  ok('the step back up is on the same clock too', !!up && up[1] === 1 && Math.abs(up[2] - 12.9) < 1e-6,
    JSON.stringify(gain.calls));

  // 2. ANOTHER APP TAKES THE AUDIO AND LETS GO: THE SONG COMES BACK BY ITSELF.
  gain.calls.length = 0;
  sandbox.userPaused = false;
  sandbox.audio = makeAudio(95);
  phone.answer = quiet({ musicActive: true });
  fireFocus({ event: 'loss', inCall: false, ringing: false, comm: false, musicActive: true, mode: 0 });
  ok('a permanent loss pauses the song', sandbox.audio.paused === true);
  ok('and a watch asks the phone for the hand-back', HB.watching() === true && HB.needed() === true);
  await wait(120);
  ok('while something else is still making sound the song stays parked',
    sandbox.audio.paused === true && HB.watching() === true);
  phone.answer = quiet();
  const playsBefore = sandbox.audio.plays;
  await wait(160);
  ok('when the phone is quiet the song comes back without a press',
    sandbox.audio.paused === false && sandbox.audio.plays > playsBefore,
    'paused=' + sandbox.audio.paused + ' plays=' + sandbox.audio.plays);
  ok('on the second it was parked', sandbox.audio.currentTime === 95, String(sandbox.audio.currentTime));
  ok('and the latch is dropped', HB.needed() === false && HB.watching() === false);
  ok('the hand-back is faded in, not a jump',
    gain.calls.some((c) => c[0] === 'set' && c[1] === 0) &&
    gain.calls.some((c) => c[0] === 'ramp' && c[1] === 1 && Math.abs(c[2] - 12.95) < 1e-6),
    JSON.stringify(gain.calls));
  ok('the stop record names the app that left', stops.some((s) => /comes back after/.test(s)), stops.slice(-4).join(' | '));

  // 3. A GAME ON THE MICROPHONE IS NOT A CALL, AND IT STILL HOLDS THE SONG DOWN
  //    WHILE IT IS UP.
  sandbox.audio = makeAudio(42);
  phone.answer = quiet({ comm: true, musicActive: true, mode: 2 });
  fireFocus({ event: 'loss', inCall: false, ringing: false, comm: true, musicActive: false, mode: 2 });
  ok('a game holding the microphone does not pause the app like a call', U.scInCall() === false);
  ok('but the hand-back waits while the microphone is held', HB.watching() === true);
  await wait(120);
  ok('so the song stays parked while the game has the microphone', sandbox.audio.paused === true);
  phone.answer = quiet();
  await wait(160);
  ok('and it returns when the game lets go', sandbox.audio.paused === false && sandbox.audio.currentTime === 42);

  // 4. A REAL CALL STILL OWNS THE SPEAKERS.
  sandbox.audio = makeAudio(10);
  phone.answer = quiet({ inCall: true, ringing: false, mode: 1 });
  fireFocus({ event: 'loss', inCall: true, ringing: false, comm: false, musicActive: false, mode: 1 });
  ok('a call stands the song down', sandbox.audio.paused === true && U.scInCall() === true);
  ok('and no hand-back watch fights a call', HB.watching() === false);
  await wait(100);
  ok('a call does not get the song back over it', sandbox.audio.paused === true);
  phone.answer = quiet();
  fireFocus({ event: 'gain', inCall: false, ringing: false, comm: false, musicActive: false, mode: 0 });
  ok('the end of the call gives the song back', sandbox.audio.paused === false && U.scInCall() === false);

  // 5. A DELIBERATE PAUSE STOPS THE WATCH.
  sandbox.audio = makeAudio(7);
  phone.answer = quiet({ musicActive: true });
  fireFocus({ event: 'loss', inCall: false, ringing: false, comm: false, musicActive: true, mode: 0 });
  ok('the watch runs for a parked song', HB.watching() === true);
  sandbox.userPaused = true;
  await wait(100);
  ok('a press of pause ends it', HB.watching() === false && sandbox.audio.paused === true);

  // 6. AN APK WITHOUT focusState STILL GETS THE SONG BACK.
  const saved = plugin.focusState;
  delete plugin.focusState;
  sandbox.userPaused = false;
  sandbox.audio = makeAudio(77);
  phone.answer = { mode: 0, inCall: false, ringing: false };
  fireFocus({ event: 'loss', inCall: false, ringing: false, mode: 0 });
  await wait(160);
  ok('an older native half is still asked, and still answered', sandbox.audio.paused === false);
  ok('an answer without musicActive is not read as somebody else playing',
    HB.facts().knowsMusic === false, JSON.stringify(HB.facts()));
  plugin.focusState = saved;

  // 7. COMING BACK INTO THE APP ASKS ONCE MORE.
  sandbox.audio = makeAudio(33);
  phone.answer = quiet({ musicActive: false });
  fireFocus({ event: 'loss', inCall: false, ringing: false, comm: false, musicActive: false, mode: 0 });
  HB.stop();                                   // the watch is not the door under test
  doc.hidden = false;
  doc._vis.forEach((fn) => fn());
  await wait(60);
  ok('returning to the app puts the song back on its second',
    sandbox.audio.paused === false && sandbox.audio.currentTime === 33,
    'paused=' + sandbox.audio.paused + ' at=' + sandbox.audio.currentTime);

  // 8. THE NATIVE HALF SAYS A CALL IS A CALL AND NOTHING ELSE.
  ok('the native call test no longer counts MODE_IN_COMMUNICATION',
    native.indexOf('if (m == AudioManager.MODE_IN_CALL || m == AudioManager.MODE_IN_COMMUNICATION) return true;') === -1);
  ok('the native half reports the microphone separately', native.indexOf('private boolean commMode()') !== -1);
  ok('the native half reports the music stream', native.indexOf('am.isMusicActive()') !== -1);
  ok('the page can ask the whole question', native.indexOf('public void focusState(PluginCall call)') !== -1);
  ok('the focus event carries the same facts',
    native.indexOf('data.put("comm", commMode());') !== -1 && native.indexOf('data.put("musicActive", musicActive());') !== -1);

  // 9. THE RELEASE METADATA.
  ok('the page runs 85.3.5', page.indexOf("const APP_VERSION = '85.3.5'") !== -1);
  ok('the shell cache moved with it', sw.indexOf("sidecut-shell-v85.3.5") !== -1);
  ok('the notes carry the release', page.indexOf("{ version: '85.3.5'") !== -1);
  ok('the notes are written without apostrophes',
    page.indexOf("title: 'The music comes back after another app, and a game is not a call'") !== -1);

  HB.stop();
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
