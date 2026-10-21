// 80.0.2 - the assistant duck, to your taste.
//
// 80.0.1 shipped the duck: an assistant asks the phone for the audio, the music
// steps back through a master gain, and it comes back up when the phone says the
// request is over. It stepped back to ONE level - 20% - with no way to say "less"
// or "more". 80.0.2 puts that number on a ladder (20, 15, 25, 40 percent), starts
// on the 80.0.1 level so an update sounds identical, and remembers the choice.
//
// This gate boots the real page against a fake Web Audio graph and a fake store,
// and checks the new contract WITHOUT retesting 80.0.1's engine (that is
// assistant-duck-check.cjs's job):
//
//   [1] a fresh library reads 20%, and a duck still lands on 0.2 - the update is
//       audible as no change at all;
//   [2] the button walks the ladder in order and the readout follows it;
//   [3] the level a duck ramps to is the level that was chosen, not the default;
//   [4] changing the depth WHILE ducked re-levels through the same call, without
//       dropping the duck first (the music is never briefly loud mid-sentence);
//   [5] the choice is written to the store as its own meta row;
//   [6] a page that boots with a stored depth uses it, and one that boots with a
//       value off the ladder falls back to the first rung;
//   [7] the switch still says WHETHER: with it off, a chosen depth ducks nothing;
//   [8] no page errors, on any boot.
//
// Run: node dev/assistant-duck-depth-check.cjs
//      SC_HTML=/tmp/pre8002.html node dev/assistant-duck-depth-check.cjs   # the old tree
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
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.001;

// ---- the Web Audio fake ----------------------------------------------------
// A ramp lands on `value`, the way a real ramp ends, so "the music stepped back
// to 15%" is a number this gate can read rather than infer.
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
// seedMeta is the library a page boots against: { assistantDuckLevel: 0.15 } is a
// phone that has already chosen a depth, which is the only way to test a restore.
function fakeIndexedDB(seedMeta) {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map() };
  Object.keys(seedMeta || {}).forEach((k) => data.meta.set(k, { key: k, value: seedMeta[k] }));
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

const serveLocalScript = requestInterceptor((request) => {
  if (/dev\/native-updates\.js/.test(request.url)) {
    return new Response(fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8'), {
      headers: { 'Content-Type': 'application/javascript' },
    });
  }
  return undefined;
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Boot one page. Every boot gets its own store, clock and bridge, so the restore
// checks are real restarts rather than a re-read of the same window.
async function boot(seedMeta) {
  const state = { focusListener: null, errors: [], plays: 0, pauses: 0 };
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => {
    const m = '' + (e && e.message);
    if (!/Not implemented/.test(m) && m.indexOf('dbPromise') === -1) state.errors.push(m);
  });
  const idb = fakeIndexedDB(seedMeta);
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
        nativeCallback: () => Promise.resolve(),
        Plugins: {
          SideCutAudioFocus: {
            request: () => Promise.resolve({ granted: true }),
            abandon: () => Promise.resolve(),
            isHolding: () => Promise.resolve({ holding: true }),
            callState: () => Promise.resolve({ inCall: false, ringing: false, mode: 0 }),
            duckState: () => Promise.resolve({ over: false, ducking: true, holding: true, mode: 0 }),
            addListener: (evt, cb) => { if (evt === 'focusChange') state.focusListener = cb; return { remove() {} }; },
          },
        },
      };
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  const win = dom.window;
  await wait(3000);
  const doc = win.document;
  const el = doc.getElementById('audioEl');
  Object.defineProperty(el, 'paused', { value: true, writable: true, configurable: true });
  el.play = () => { state.plays++; el.paused = false; return Promise.resolve(); };
  el.pause = () => { state.pauses++; el.paused = true; el.dispatchEvent(new win.Event('pause')); };
  // Something on the deck, the way the app plays one: a duck only makes sense
  // while a song is actually playing.
  try { win.playFromList(['t1', 't2'], 't1'); } catch (e) {}
  await wait(400);
  el.paused = false;
  el.dispatchEvent(new win.Event('play'));
  await wait(150);

  // A controllable clock, so the 8s hold can be stepped over instead of waited on.
  const realNow = win.Date.now.bind(win.Date);
  let fakeNow = realNow();
  win.Date.now = () => fakeNow;

  const bag = {
    win, doc, el, idb, errors: state.errors,
    emit: (event) => { if (state.focusListener) state.focusListener({ event }); },
    ducked: () => (typeof win.__scDuckHeld === 'function' ? !!win.__scDuckHeld() : false),
    level: () => (typeof win.__scAssistantDuckLevel === 'function' ? win.__scAssistantDuckLevel() : null),
    gain: () => (win.__scDuckMaster ? win.__scDuckMaster.gain.value : null),
    advance: (ms) => { fakeNow += ms; },
    button: () => doc.getElementById('assistantDuckLevel'),
    label: () => { const b = doc.getElementById('assistantDuckLevel'); return b ? b.textContent.trim() : null; },
    clickDepth: async (times) => {
      const b = doc.getElementById('assistantDuckLevel');
      if (!b) return;
      for (let i = 0; i < (times || 1); i++) { b.click(); await wait(30); }
    },
  };
  return bag;
}

(async () => {
  // ---------------------------------------------------------------------------
  console.log('\n— [1] a fresh library is exactly where 80.0.1 left it —');
  const a = await boot();
  ok('the Step down to row is in the pane', !!a.button());
  ok('it reads 20% out of the box, the level 80.0.1 shipped', a.label() === '20%', 'label=' + a.label());
  ok('the published ladder is 20, 15, 25, 40 percent', (() => {
    const l = typeof a.win.__scDuckLadder === 'function' ? a.win.__scDuckLadder() : null;
    return Array.isArray(l) && l.length === 4 && near(l[0], 0.2) && near(l[1], 0.15) && near(l[2], 0.25) && near(l[3], 0.4);
  })(), JSON.stringify(typeof a.win.__scDuckLadder === 'function' ? a.win.__scDuckLadder() : null));
  ok('the setting the app holds is 0.2', near(a.level(), 0.2), 'level=' + a.level());
  a.emit('duck');
  await wait(60);
  ok('and a duck still ramps the master gain to 0.2 - an update sounds the same',
     near(a.gain(), 0.2), 'gain=' + a.gain());
  ok('the song is still playing (the duck is not a pause)', a.el.paused === false);
  ok('the element volume the crossfade owns is untouched', near(a.el.volume, 1), 'volume=' + a.el.volume);
  a.emit('gain');
  await wait(60);
  ok('the hand-back returns the music to full', near(a.gain(), 1), 'gain=' + a.gain());

  // ---------------------------------------------------------------------------
  console.log('\n— [2] the button walks the ladder, and the readout follows —');
  await a.clickDepth(1);
  ok('one touch: 15%', a.label() === '15%' && near(a.level(), 0.15), 'label=' + a.label() + ' level=' + a.level());
  await a.clickDepth(1);
  ok('two: 25%', a.label() === '25%' && near(a.level(), 0.25), 'label=' + a.label() + ' level=' + a.level());
  await a.clickDepth(1);
  ok('three: 40%', a.label() === '40%' && near(a.level(), 0.4), 'label=' + a.label() + ' level=' + a.level());
  await a.clickDepth(1);
  ok('four: back to 20%, so the ladder is a loop and never an off-list number',
     a.label() === '20%' && near(a.level(), 0.2), 'label=' + a.label() + ' level=' + a.level());

  // ---------------------------------------------------------------------------
  console.log('\n— [3] the chosen depth is the depth a duck actually uses —');
  await a.clickDepth(3);          // 20 -> 15 -> 25 -> 40
  ok('40% chosen', a.label() === '40%');
  a.emit('duck');
  await wait(60);
  ok('a duck now steps the music back to 0.4, not to the old 0.2', near(a.gain(), 0.4), 'gain=' + a.gain());
  ok('and it is held', a.ducked() === true);

  // ---------------------------------------------------------------------------
  console.log('\n— [4] changing the depth mid-duck is heard without dropping the duck —');
  const holdsBefore = typeof a.win.__scDuckHeld === 'function' && a.ducked();
  await a.clickDepth(1);          // 40 -> 20, while still ducked
  ok('the duck was held going in', holdsBefore === true);
  ok('the new depth is applied immediately', near(a.gain(), 0.2), 'gain=' + a.gain());
  ok('the duck was not released to do it', a.ducked() === true);
  ok('so the music was never briefly back at full volume', near(a.gain(), 0.2) && !near(a.gain(), 1));
  ok('the readout and the setting agree', a.label() === '20%' && near(a.level(), 0.2));
  a.emit('gain');
  await wait(60);
  ok('and the hand-back still restores full volume', near(a.gain(), 1));

  // ---------------------------------------------------------------------------
  console.log('\n— [5] the choice is its own row in the store —');
  await a.clickDepth(2);          // 20 -> 15 -> 25
  const stored = (() => {
    for (const v of a.idb._data.meta.values()) {
      if (v && v.key === 'assistantDuckLevel') return v.value;
    }
    return 'missing';
  })();
  ok('the depth is written to meta as assistantDuckLevel', near(stored, 0.25), 'stored=' + stored);
  const storedSwitch = (() => {
    for (const v of a.idb._data.meta.values()) {
      if (v && v.key === 'assistantDuck') return v.value;
    }
    return 'missing';
  })();
  ok('and the 80.0.1 switch row is still written beside it', storedSwitch !== 'missing', 'stored=' + storedSwitch);

  // ---------------------------------------------------------------------------
  console.log('\n— [6] the depth survives a restart, and a bad value cannot —');
  const b = await boot({ assistantDuckLevel: 0.15 });
  ok('a page that boots with 15% stored reads 15%', b.label() === '15%', 'label=' + b.label());
  ok('and the setting it holds is 0.15', near(b.level(), 0.15), 'level=' + b.level());
  b.emit('duck');
  await wait(60);
  ok('a duck on that page steps to 0.15 - the chosen depth, not the default', near(b.gain(), 0.15), 'gain=' + b.gain());
  b.emit('gain');
  await wait(40);
  b.win.close();

  const c = await boot({ assistantDuckLevel: 0.33 });   // off the ladder on purpose
  ok('a stored value off the ladder falls back to the first rung, 20%', c.label() === '20%' && near(c.level(), 0.2),
     'label=' + c.label() + ' level=' + c.level());
  c.emit('duck');
  await wait(60);
  ok('and it ducks to a level the engine knows, not to 0.33', near(c.gain(), 0.2), 'gain=' + c.gain());
  c.emit('gain');
  await wait(40);
  c.win.close();

  // ---------------------------------------------------------------------------
  console.log('\n— [7] the switch still says WHETHER, the row says HOW FAR —');
  await a.clickDepth(1);          // 25 -> 40, so the depth is not the default
  const sw = a.doc.getElementById('assistantDuckToggle');
  ok('the 80.0.1 switch is still there', !!sw);
  if (sw) sw.click();
  await wait(60);
  a.emit('duck');
  await wait(60);
  ok('with the switch off a chosen depth ducks nothing at all',
     near(a.gain(), 1) && a.ducked() === false, 'gain=' + a.gain() + ' ducked=' + a.ducked());
  if (sw) sw.click();
  await wait(60);
  ok('turning it back on keeps the depth that was chosen', near(a.level(), 0.4), 'level=' + a.level());
  ok('and the readout still says 40%', a.label() === '40%', 'label=' + a.label());
  a.emit('duck');
  await wait(60);
  ok('and a duck uses it again', near(a.gain(), 0.4), 'gain=' + a.gain());
  a.emit('gain');
  await wait(40);

  // ---------------------------------------------------------------------------
  console.log('\n— [8] no runtime errors —');
  ok('the first page threw nothing', a.errors.length === 0, a.errors.slice(0, 3).join(' | '));
  ok('the restored page threw nothing', b.errors.length === 0, b.errors.slice(0, 3).join(' | '));
  ok('the off-ladder page threw nothing', c.errors.length === 0, c.errors.slice(0, 3).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
