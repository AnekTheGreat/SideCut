// 80.0.1 - the assistant duck.
//
// The ask: "when you are talking to an ai such as holding down your power button
// to talk to gemini, SideCut should let you talk to the ai while playing the music
// at a lower volume, and then at full volume when you are done talking to the ai."
//
// The phone tells an app about this the only way it can: the assistant asks the
// system to duck whoever holds the audio (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK), and
// a transient focus loss rides along with it. Until 80.0.1 this player ignored the
// duck on purpose and answered the loss by REPLAYING the song - which put it back
// at full volume over the assistant.
//
// So this gate boots the real page against a fake Web Audio graph and drives the
// real signals through the real listener:
//   * a duck request steps the music back, through a gain node, and never touches
//     the element volume the crossfade owns;
//   * the music comes back up when the system hands the audio back;
//   * a transient loss with no call behind it ducks instead of stopping;
//   * a real call still pauses and never ducks;
//   * the bounded wait ends a duck when no signal ever comes, and the cap stops a
//     stream of signals from holding the music down forever;
//   * a tap brings it straight back up;
//   * the switch exists, is on by default, and turning it off restores the old
//     behaviour;
//   * the master node sits between the limiters and the speakers, and the
//     recording tap is above it, so a recording is never ducked.
//
// Run: node dev/assistant-duck-check.cjs
//      SC_HTML=/tmp/pre8001.html node dev/assistant-duck-check.cjs   # the old tree
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, requestInterceptor } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}

// ---- the Web Audio fake ----------------------------------------------------
// Every gain the page creates is recorded, and a ramp lands on `value` the way a
// real ramp ends, so "the music stepped back" is a number this test can read.
const gains = [];
function anode() {
  const n = {
    connect() { return n; }, disconnect() {}, start() {}, stop() {},
    gain: {
      value: 1,
      _ramps: [],
      setValueAtTime(v) { this.value = v; },
      linearRampToValueAtTime(v) { this._ramps.push(v); this.value = v; },
      exponentialRampToValueAtTime(v) { this._ramps.push(v); this.value = v; },
      cancelScheduledValues() {},
    },
    frequency: { value: 0 }, Q: { value: 0 },
    threshold: { value: 0 }, knee: { value: 0 }, ratio: { value: 0 }, attack: { value: 0 }, release: { value: 0 },
    delayTime: { value: 0 }, pan: { value: 0 }, offset: { value: 0 },
    playbackRate: { value: 1 },
    type: '', value: 0, buffer: null, loop: false, stream: {}, fftSize: 1024, frequencyBinCount: 512,
    getByteFrequencyData() {}, getByteTimeDomainData() {}, getFloatFrequencyData() {},
    createPeriodicWave() { return {}; }, setPeriodicWave() {}, curve: null, oversample: 'none',
    reduction: 0, normalRange: {}, getFrequencyResponse() {},
  };
  gains.push(n);
  return n;
}
function fakeBuffer(ch, len, sr) {
  const data = [];
  for (let i = 0; i < Math.max(1, ch); i++) data.push(new Float32Array(len));
  return {
    numberOfChannels: Math.max(1, ch), length: len, sampleRate: sr, duration: len / sr,
    getChannelData: (i) => data[Math.min(i, data.length - 1)],
  };
}
class FakeAudioContext {
  constructor() {
    this.sampleRate = 44100; this.currentTime = 0; this.state = 'running'; this.destination = anode();
  }
  resume() { this.state = 'running'; return Promise.resolve(); }
  close() { this.state = 'closed'; return Promise.resolve(); }
  createGain() { return anode(); }
  createConvolver() { return anode(); }
  createChannelSplitter() { return anode(); }
  createChannelMerger() { return anode(); }
  createBiquadFilter() { return anode(); }
  createDynamicsCompressor() { return anode(); }
  createAnalyser() { return anode(); }
  createOscillator() { return anode(); }
  createBufferSource() { return anode(); }
  createMediaElementSource() { return anode(); }
  createMediaStreamSource() { return anode(); }
  createMediaStreamDestination() { return anode(); }
  createDelay() { return anode(); }
  createWaveShaper() { return anode(); }
  createStereoPanner() { return anode(); }
  createPanner() { return anode(); }
  createConstantSource() { return anode(); }
  createIIRFilter() { return anode(); }
  createScriptProcessor() { return anode(); }
  createBuffer(ch, len, sr) { return fakeBuffer(ch, len, sr); }
  decodeAudioData(ab, okCb) {
    const b = fakeBuffer(2, 8000 * 60, 8000);
    setTimeout(() => { try { okCb && okCb(b); } catch (e) {} }, 0);
    return Promise.resolve(b);
  }
}
function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 300, height: 150 };
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'createPattern') return () => ({});
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

// ---- the store and the native bridge --------------------------------------
const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
];
function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map() };
  function tx(store) {
    const t = { oncomplete: null, onerror: null, onabort: null, error: null };
    const fire = () => setTimeout(() => { try { t.oncomplete && t.oncomplete(); } catch (e) {} }, 0);
    t.objectStore = () => ({
      put(v) { const k = v && v.key !== undefined ? v.key : v.id; data[store].set(k, v); fire(); return {}; },
      get(k) { const q = {}; setTimeout(() => { q.result = data[store].get(k); q.onsuccess && q.onsuccess(); }, 0); return q; },
      getAll() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].values()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
    });
    return t;
  }
  return {
    _data: data,
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

let focusListener = null;
let callAnswer = { inCall: false, ringing: false, mode: 0 };
let duckAnswer = { over: false, ducking: false, holding: false, mode: 0 };
const duckProbes = { count: 0 };
const mediaHandlers = {};

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8'), {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  return undefined;
});

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) errors.push(m); });

const idb = fakeIndexedDB();
const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://localhost/',
  resources: { interceptors: [serveLocalScript] },
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.indexedDB = idb;
    win.AudioContext = FakeAudioContext;
    win.webkitAudioContext = FakeAudioContext;
    win.URL.createObjectURL = () => 'blob:sidecut/test';
    win.URL.revokeObjectURL = () => {};
    win.Capacitor = {
      isNativePlatform: () => true,
      getPlatform: () => 'android',
      nativePromise: () => Promise.resolve({}),
      nativeCallback: (plugin, method, opts, cb) => {
        if (plugin === 'MediaSession' && method === 'setActionHandler' && opts && opts.action) {
          mediaHandlers[opts.action] = cb;
        }
        return Promise.resolve();
      },
      Plugins: {
        SideCutAudioFocus: {
          request: () => Promise.resolve({ granted: true }),
          abandon: () => Promise.resolve(),
          isHolding: () => Promise.resolve({ holding: true }),
          callState: () => Promise.resolve(callAnswer),
          // 80.0.1 - the phone's own view of the duck, asked while one is held.
          duckState: () => { duckProbes.count++; return Promise.resolve(duckAnswer); },
          addListener: (evt, cb) => { if (evt === 'focusChange') focusListener = cb; return { remove() {} }; },
        },
      },
    };
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const win = dom.window;
  await wait(3000);
  const doc = win.document;
  const el = doc.getElementById('audioEl');
  const played = { count: 0, pausedCount: 0 };
  Object.defineProperty(el, 'paused', { value: true, writable: true, configurable: true });
  el.play = () => { played.count++; el.paused = false; return Promise.resolve(); };
  el.pause = () => { played.pausedCount++; el.paused = true; el.dispatchEvent(new win.Event('pause')); };
  const setPlaying = () => { el.paused = false; el.dispatchEvent(new win.Event('play')); };
  const emit = (event) => { if (focusListener) focusListener({ event }); };
  const setCall = (on) => { callAnswer = { inCall: !!on, ringing: false, mode: on ? 2 : 0 }; win.__scAskCallState(); };

  // A controllable clock, so the bounded wait is measured rather than waited on.
  const realNow = win.Date.now.bind(win.Date);
  let fakeNow = realNow();
  win.Date.now = () => fakeNow;
  const advance = (ms) => { fakeNow += ms; };

  // Crash-proof access to the duck API. On a tree that does not have it yet (the
  // 80.0 page) every one of these has to answer something instead of throwing, or
  // the gate dies on its second check and the reader loses every block after it.
  const ducked = () => (typeof win.__scDuckHeld === 'function' ? !!win.__scDuckHeld() : false);
  const duckOn = () => (typeof win.__scAssistantDuckOn === 'function' ? !!win.__scAssistantDuckOn() : null);
  const forceDuck = (why) => { try { if (typeof win.__scDuckForAssistant === 'function') return win.__scDuckForAssistant(why); } catch (e) {} return false; };
  const forceUnduck = (why) => { try { if (typeof win.__scUnduckForAssistant === 'function') return win.__scUnduckForAssistant(why); } catch (e) {} return false; };
  // The node the app ducks through, taken from the page rather than assumed: the
  // gate asks the app which gain carries the duck, so the assertion is about the
  // node the app actually uses.
  const masterGain = () => win.__scDuckMaster && win.__scDuckMaster.gain;
  const atDuck = () => {
    const g = masterGain();
    return !!g && Math.abs((g.value || 0) - 0.2) < 0.001;
  };
  const atFull = () => {
    const g = masterGain();
    return !!g && Math.abs((g.value || 0) - 1) < 0.001;
  };

  console.log('\n— the page is up and the duck is idle —');
  ok('the duck API is published', typeof win.__scDuckForAssistant === 'function'
     && typeof win.__scUnduckForAssistant === 'function' && typeof win.__scDuckHeld === 'function',
     typeof win.__scDuckForAssistant + '/' + typeof win.__scDuckHeld);
  ok('nothing is ducked before anything happens', ducked() === false);
  ok('the switch is on by default', duckOn() === true);

  // A real song on the deck, the way the app plays one.
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(400);
  setPlaying();
  await wait(150);
  played.count = 0; played.pausedCount = 0;

  console.log('\n— an assistant taking the audio steps the music back, it does not stop it —');
  const volumeBefore = el.volume;
  emit('duck');
  await wait(60);
  ok('the duck is held', ducked() === true);
  ok('the master gain is sitting at the duck level', atDuck(), 'gain=' + (masterGain() && masterGain().value));
  ok('and the song is still playing (a duck is not a pause)', el.paused === false, 'paused=' + el.paused);
  ok('the element volume the crossfade owns was not touched', el.volume === volumeBefore,
     'volume=' + el.volume + ' before=' + volumeBefore);
  ok('and no revive was spent, because nothing stopped', played.count === 0, 'plays=' + played.count);

  console.log('\n— the system handing the audio back brings it up again —');
  emit('gain');
  await wait(60);
  ok('the duck is over', ducked() === false);
  ok('and the master gain is back to full', atFull(), 'gain=' + (masterGain() && masterGain().value));
  ok('and the song is still the same song, still playing', el.paused === false);

  console.log('\n— a transient loss with no call behind it ducks instead of stopping —');
  played.count = 0; played.pausedCount = 0;
  emit('lossTransient');
  await wait(60);
  ok('the music stepped back for it', ducked() === true);
  ok('it did not duck through the element volume', el.volume === volumeBefore);
  ok('and it is audible, not paused', el.paused === false, 'paused=' + el.paused);

  console.log('\n— a real phone call is still a call —');
  emit('gain');   // hand the audio back, so nothing is ducked going in
  await wait(60);
  setCall(true);
  await wait(80);
  ok('the call stands the song down', el.paused === true, 'paused=' + el.paused);
  ok('and a call is never a duck', ducked() === false);
  setCall(false);
  await wait(120);
  ok('and the song comes back when the call ends', el.paused === false, 'paused=' + el.paused);
  setPlaying();
  await wait(60);

  console.log('\n— a tap brings the music straight back up —');
  setPlaying();
  await wait(60);
  emit('duck');
  await wait(60);
  ok('ducked', ducked() === true);
  doc.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));
  await wait(60);
  ok('a tap on the screen ends it', ducked() === false);

  console.log('\n— the bounded wait, and the cap —');
  setPlaying();
  await wait(60);
  emit('duck');
  await wait(40);
  ok('ducked again', ducked() === true);
  advance(9000);   // past SC_DUCK_HOLD_MS with no signal at all
  ok('the duck expires once the wait runs out, with no signal from the phone',
     ducked() === false);
  // The cap: signals close enough together to be ONE continuous duck cannot hold
  // the music down for ever. Eleven signals five seconds apart reach 55s in, and
  // each one refreshes the 8s wait - so the wait alone would run to 63s. The cap
  // closes the window at 60s instead, and that is the difference being measured.
  emit('duck');
  await wait(30);
  for (let i = 0; i < 11; i++) { advance(5000); emit('duck'); await wait(15); }
  advance(6000);
  ok('and the cap stops a stream of signals holding it down past a minute',
     ducked() === false, 'held=' + ducked());
  emit('gain');
  await wait(40);

  console.log('\n— the phone can say the duck is over —');
  setPlaying();
  await wait(60);
  emit('duck');
  await wait(40);
  const probesBefore = duckProbes.count;
  duckAnswer = { over: true, ducking: true, holding: true, mode: 0 };
  await wait(1700);   // the probe interval is 1500ms, and it only runs while held
  ok('a held duck asks the phone what it thinks', duckProbes.count > probesBefore,
     'probes=' + (duckProbes.count - probesBefore));
  ok('and the answer ends the duck', ducked() === false);
  duckAnswer = { over: false, ducking: false, holding: false, mode: 0 };

  console.log('\n— the switch —');
  const btn = doc.getElementById('assistantDuckToggle');
  ok('the Assistant duck switch is in the pane', !!btn);
  ok('it reads On out of the box', !!btn && btn.textContent.trim() === 'On', btn && btn.textContent);
  if (btn) btn.click();
  await wait(60);
  ok('turning it off is recorded', duckOn() === false);
  ok('and it reads Off', !!btn && btn.textContent.trim() === 'Off');
  ok('the choice is written to the store', (() => {
    const rows = idb._data.meta;
    for (const v of rows.values()) { if (v && v.key === 'assistantDuck') return v.value === false; }
    return false;
  })());
  setPlaying();
  await wait(60);
  emit('duck');
  await wait(60);
  ok('with it off an assistant signal changes nothing at all', ducked() === false);
  if (btn) btn.click();
  await wait(60);
  ok('and turning it back on restores it', duckOn() === true && !!btn && btn.textContent.trim() === 'On');

  console.log('\n— the shape of the graph —');
  // The master node is a real node of its own, so the recording tap (which hangs
  // off the limiter) is above it and a recording is never ducked.
  const src = html;
  ok('the limiters land on the master node, not on the speakers',
     src.indexOf('limiter.connect(scDuckMaster);') !== -1
     && src.indexOf('limiter.connect(audioCtx.destination);') === -1);
  ok('the master node is what reaches the speakers',
     /scDuckMaster\.connect\(audioCtx\.destination\);/.test(src));
  ok('the recording tap is taken from the limiter, so it is never ducked',
     /recordDestNode = audioCtx\.createMediaStreamDestination\(\);\s*\n\s*limiterNodes\[0\]\.connect\(recordDestNode\);/.test(src));
  ok('the duck never writes the element volume when the graph is up',
     /if\(scDuckMaster\)\{[\s\S]{0,900}?\n    \}\n    const el = activeAudio\(\);/.test(src));
  ok('a failed graph clears the master node with the rest of it',
     /limiterNodes\[0\] = limiterNodes\[1\] = null;\s*\n\s*scDuckMaster = null;/.test(src));

  console.log('\n— the native half asks the phone the same question —');
  const afp = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'patch-audiofocus.py'), 'utf8');
  ok('the plugin grows duckState()', afp.indexOf('public void duckState(PluginCall call)') !== -1);
  ok('it remembers the last focus event', afp.indexOf('lastFocus = event;') !== -1);
  ok('and whether that event was a duck', afp.indexOf('ducking = "duck".equals(event);') !== -1);
  ok('it only says the duck is over on positive evidence',
     afp.indexOf('out.put("over", ducking && m == AudioManager.MODE_NORMAL);') !== -1);

  console.log('\n— no runtime errors —');
  ok('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
