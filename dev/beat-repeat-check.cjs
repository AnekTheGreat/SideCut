// 74.1.10 - the 1/8 pad, and the badge that could not be earned the way it reads.
//
// The owner, twice, in the same words:
//
//   "make the pill like drag and move nicer ... and make the badges actually
//    rechable and the loops 1/8 and stuff actually need to work."
//
// The pill is driven in dev/album-follow-dock-check.cjs, over the dock's geometry.
// This is the other half, and each claim is DRIVEN rather than read off the file:
//
//   [1] every counter and every flag the wall reads is reached by something - the
//       audit that names a badge that could never light;
//   [2] the loop-control shape: a pad never needs a live sound source, so a slice
//       armed on a stopped deck is armed for PLAY;
//   [3] a TAP on a pad latches - the slice keeps repeating after the finger is up,
//       the pad stays lit, and pressing the lit pad stops it - while a HOLD still
//       ends when the finger comes up;
//   [4] the slice is placed ON THE GRID: a 1/8 slice is floored to the eighth note
//       it belongs to, not armed at whatever instant the playhead was sitting on;
//   [5] a pad over an empty deck says which of the two it is instead of doing
//       nothing in silence;
//   [6] the "Beat repeat" badge is credited by the PAD, and no longer by Loop Lock;
//   [7] the Studio presets badges are driven end to end from the sheet, distinct
//       presets only - the counter that reads as dead in a grep but is not.
//
// What this cannot do: there is no Web Audio in jsdom, so the page is given a
// context that only answers - it keeps time at zero and builds nodes that do
// nothing. The deck's own buffer is handed to it through the state it publishes
// (window.__scDjDeck). What is asserted is the window the deck arms, where its
// playhead is and what the app says; the sound itself is not heard, and no check
// here pretends it was.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + JSON.stringify(extra) + ']' : '')); }
}

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}
// An empty library: nothing is loaded, which is half of what is being tested. The
// stores exist so boot finishes the way it does on a phone that has never had a
// song in it.
function fakeIndexedDB() {
  const data = { tracks: new Map(), meta: new Map() };
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
    open() {
      const req = { error: null };
      const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) };
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
}
// A sound context that only answers. Every factory returns one inert node whose
// properties are themselves inert parameters, so a graph can be built and torn down
// without a sound card. It keeps time at zero on purpose: a deck that is NOT
// running reads its own startOffset, which is exactly the playhead this probe sets.
function fakeAudio(win) {
  function inert() {
    const fn = function () {};
    const node = {
      connect: () => node, disconnect: fn, start: fn, stop: fn, addEventListener: fn,
      removeEventListener: fn, setPeriodicWave: fn, getChannelData: () => new Float32Array(1),
      buffer: null, onended: null,
    };
    const param = { value: 0, setValueAtTime: fn, linearRampToValueAtTime: fn,
      exponentialRampToValueAtTime: fn, cancelScheduledValues: fn, setTargetAtTime: fn };
    return new Proxy(node, {
      get(t, p) {
        if (p in t) return t[p];
        if (p === 'gain' || p === 'frequency' || p === 'Q' || p === 'detune' ||
            p === 'pan' || p === 'delayTime' || p === 'playbackRate' || p === 'threshold' ||
            p === 'knee' || p === 'ratio' || p === 'attack' || p === 'release') return param;
        return fn;
      },
      set(t, p, v) { t[p] = v; return true; },
    });
  }
  function FakeAudioContext() {
    const ctx = this;
    this.state = 'running';
    this.currentTime = 0;
    this.sampleRate = 44100;
    this.destination = inert();
    ['createGain', 'createBiquadFilter', 'createBufferSource', 'createBuffer', 'createConvolver',
      'createDelay', 'createStereoPanner', 'createDynamicsCompressor', 'createAnalyser',
      'createOscillator', 'createMediaElementSource', 'createMediaStreamDestination',
      'createScriptProcessor', 'createChannelSplitter', 'createChannelMerger',
      'createWaveShaper', 'createPeriodicWave', 'createConstantSource'].forEach((k) => {
      this[k] = () => inert();
    });
    this.resume = () => Promise.resolve();
    this.suspend = () => Promise.resolve();
    this.close = () => Promise.resolve();
    this.decodeAudioData = () => Promise.resolve({ duration: 240, numberOfChannels: 2, getChannelData: () => new Float32Array(1) });
    this.__scFake = true;
    win.__fakeAudio = ctx;
  }
  win.AudioContext = FakeAudioContext;
  win.webkitAudioContext = FakeAudioContext;
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
    win.HTMLMediaElement.prototype.pause = function () {};
    win.HTMLMediaElement.prototype.load = function () {};
    win.URL.createObjectURL = () => 'blob:jsdom-beat';
    win.URL.revokeObjectURL = () => {};
    win.indexedDB = fakeIndexedDB();
    win.fetch = () => Promise.reject(new Error('offline'));
    fakeAudio(win);
    try { win.localStorage.clear(); } catch (e) {}
  },
});

// A pad press. The page reads clientX/clientY and pointerId off it, and the click
// the browser would fire afterwards is never needed: the pad answers the pointer.
function pev(win, type, el) {
  const e = new win.MouseEvent(type, { bubbles: true, cancelable: true, view: win });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  Object.defineProperty(e, 'pointerType', { value: 'touch' });
  el.dispatchEvent(e);
  return e;
}

const counterOf = (win, key) => {
  try { return (JSON.parse(win.localStorage.getItem('sidecut_ach_counters') || '{}') || {})[key]; } catch (e) { return undefined; }
};

// The counter a badge reads, in the app's own table. Read out of the page so this
// probe cannot disagree with the wall about what exists.
function listOf(src, name) {
  const m = new RegExp('var ' + name + ' = \\[([\\s\\S]*?)\\];').exec(src);
  return m ? (m[1].match(/'([a-zA-Z_]+)'/g) || []).map((s) => s.slice(1, -1)) : [];
}

(async () => {
  const win = dom.window;
  await wait(5500);
  const doc = win.document;
  const toastEl = () => doc.getElementById('toast');
  const said = () => (toastEl() ? String(toastEl().textContent || '') : '');
  const clearSaid = () => { const el = toastEl(); if (el) el.textContent = ''; };

  console.log('[1] every badge the wall shows is reachable');
  {
    const countersList = listOf(html, 'COUNTER_SIGNALS');
    const flagsList = listOf(html, 'FLAG_SIGNALS');
    const clicks = (/var FEATURE_CLICKS = \[([\s\S]*?)\];/.exec(html) || [, ''])[1];
    ok(countersList.length > 30 && flagsList.length > 8,
      'the wall names its counters (' + countersList.length + ') and its flags (' + flagsList.length + ')');
    // A counter is reachable if something counts it, either by bump() or - the way
    // the presets do it, because they are distinct-id counts rather than tallies - by
    // writing counters.<key> directly. Both are the same map the wall reads.
    const deadCounters = countersList.filter((k) => {
      const direct = new RegExp("bump\\('" + k + "'").test(html) ||
                     new RegExp('counters\\.' + k + '\\s*=').test(html);
      const viaTable = new RegExp("'" + k + "'").test(clicks);
      return !direct && !viaTable;
    });
    ok(deadCounters.length === 0,
      'nothing counted by the wall is left un-counted by the app', deadCounters);
    const deadFlags = flagsList.filter((k) =>
      !new RegExp("markFeature\\('" + k + "'").test(html) &&
      !new RegExp('flags\\.' + k + '\\s*=').test(html));
    ok(deadFlags.length === 0, 'and every flag it reads is really set somewhere', deadFlags);
    ok(!/beatRepeatLockBtn', 'beatRepeat'/.test(clicks),
      'Loop Lock is not what credits the Beat repeat badge any more');
    ok(/function scBeatRepeatCredit\(\)/.test(html) && /SC70\.bump\('beatRepeat', 1\)/.test(html),
      'the pad credits it itself, through the name the wall publishes');
    ok(/function scBeatRepeatCredit\(\)/.test(html) &&
       html.indexOf('scBeatRepeatCredit();') > html.indexOf('if(startBeatRepeat(beatRepeatLockedBeats)){'),
      'and it is called from the pad, not from the lock');
  }

  const deckState = win.__scDjDeck;
  if (typeof deckState !== 'function') {
    console.log('\n\u2717 the deck does not publish its state, so nothing below can be driven');
    console.log('\n' + pass + ' passed, ' + (fail + 1) + ' failed');
    process.exit(1);
  }

  console.log('\n[2] nothing loaded: the pad says so');
  {
    const pad = doc.querySelector('.beat-pad[data-beats="0.125"]');
    ok(!!pad, 'the 1/8 pad is on the deck');
    clearSaid();
    pev(win, 'pointerdown', pad);
    await wait(40);
    ok(!pad.classList.contains('active'), 'a pad over an empty deck does not light up');
    ok(/Nothing on the deck/.test(said()),
      'and says what it needs instead of doing nothing in silence', said());
    ok(counterOf(win, 'beatRepeat') === undefined,
      'with nothing armed, the pad credits nothing', counterOf(win, 'beatRepeat'));
    pev(win, 'pointerup', pad);
    await wait(20);
  }

  const deck = deckState();
  // A loaded deck, stopped, with the playhead deliberately NOT on a beat: 1.034s at
  // 120bpm. The context answers but keeps time at zero, so a stopped deck reads its
  // own startOffset - which is the playhead set here.
  deck.buffer = { duration: 240, numberOfChannels: 2, getChannelData: () => new Float32Array(1) };
  deck.running = false;
  deck.startOffset = 1.034;

  console.log('\n[3] a tap latches, and the slice is on the grid');
  {
    const pad = doc.querySelector('.beat-pad[data-beats="0.125"]');
    clearSaid();
    pev(win, 'pointerdown', pad);
    await wait(40);
    ok(pad.classList.contains('active'), 'pressing the 1/8 pad lights it');
    ok(!!deck.loop, 'and arms a window on the deck');
    // 120bpm -> one beat 0.5s -> 1/8 is 62.5ms, and 1.034s floors to the 17th
    // eighth note: 1.000s.
    const span = deck.loop ? deck.loop.end - deck.loop.start : 0;
    ok(deck.loop && Math.abs(deck.loop.start - 1.0) < 1e-6,
      'the slice starts ON the eighth note, not at the playhead', deck.loop && deck.loop.start);
    ok(Math.abs(span - 0.0625) < 1e-6, 'and it is one eighth note long', span);
    pev(win, 'pointerup', pad);
    await wait(40);
    ok(pad.classList.contains('active'),
      'lifting the finger early LEAVES it repeating - a tap latches');
    ok(!!deck.loop, 'with the window still armed');
    ok(/repeating/.test(said()),
      'and says that tapping it again stops it', said());
    ok(counterOf(win, 'beatRepeat') === 1,
      'and the pad credits the badge whose text is "Hold a beat repeat"',
      counterOf(win, 'beatRepeat'));

    // The lit pad is the way out of itself.
    clearSaid();
    pev(win, 'pointerdown', pad);
    await wait(30);
    ok(!pad.classList.contains('active'), 'pressing the lit pad takes the light off at once');
    ok(!deck.loop, 'stops the slice', deck.loop);
    ok(/off/i.test(said()), 'and says so', said());
    pev(win, 'pointerup', pad);
    await wait(30);
    ok(!deck.loop, 'with the release leaving nothing armed behind');
    ok(!pad.classList.contains('active'), 'and the pad dark');
  }

  console.log('\n[4] a hold still ends when the finger comes up');
  {
    const pad = doc.querySelector('.beat-pad[data-beats="0.5"]');
    deck.startOffset = 2.26;   // just past the beat, so the grid has something to bite
    pev(win, 'pointerdown', pad);
    await wait(30);
    ok(!!deck.loop && Math.abs(deck.loop.start - 2.25) < 1e-6,
      'a half-beat slice is floored to the beat it belongs to', deck.loop && deck.loop.start);
    await wait(320);           // longer than a tap
    pev(win, 'pointerup', pad);
    await wait(40);
    ok(!pad.classList.contains('active') && !deck.loop,
      'holding it for a while and letting go leaves nothing running', deck.loop);
    ok(counterOf(win, 'beatRepeat') === 2, 'and each pad that really arms counts once',
      counterOf(win, 'beatRepeat'));
  }

  console.log('\n[5] Loop Lock is not a beat repeat');
  {
    const before = counterOf(win, 'beatRepeat') || 0;
    const lock = doc.getElementById('beatRepeatLockBtn');
    lock.click();
    await wait(40);
    ok(lock.textContent.indexOf('ON') !== -1, 'the lock goes on over a loaded deck (' + lock.textContent + ')');
    ok((counterOf(win, 'beatRepeat') || 0) === before,
      'and turning it on does not credit the Beat repeat badge', counterOf(win, 'beatRepeat'));
    lock.click();
    await wait(40);
    ok(lock.textContent.indexOf('OFF') !== -1, 'and off again');
  }

  console.log('\n[6] the Studio presets are counted, once each');
  {
    win.navigate('studio');
    await wait(900);
    const tool = doc.querySelector('#studioView [data-tool="fx"]');
    ok(!!tool, 'the Slowed + reverb card is on the Studio');
    if (tool) {
      tool.click();
      await wait(300);
      const before = counterOf(win, 'presets') || 0;
      const slowed = doc.querySelector('#scSheetBody [data-preset="slowed"]');
      ok(!!slowed, 'its sheet lists the presets');
      if (slowed) {
        slowed.click();
        await wait(250);
        ok((counterOf(win, 'presets') || 0) === before + 1,
          'applying one counts it toward "First preset"', counterOf(win, 'presets'));
        const again = doc.querySelector('#scSheetBody [data-preset="slowed"]');
        if (again) { again.click(); await wait(250); }
        ok((counterOf(win, 'presets') || 0) === before + 1,
          'and applying the same one again is the same preset, not a second',
          counterOf(win, 'presets'));
        const nc = doc.querySelector('#scSheetBody [data-preset="nightcore"]');
        if (nc) { nc.click(); await wait(250); }
        ok((counterOf(win, 'presets') || 0) === before + 2,
          'while a different preset counts again, on the way to "Every preset"',
          counterOf(win, 'presets'));
      }
    }
  }

  const realErrors = errors.filter((e) =>
    e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1 &&
    e.indexOf('Could not parse CSS') === -1 && e.indexOf('offline') === -1);
  ok(realErrors.length === 0, 'no unexpected page errors', realErrors.slice(0, 3));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => {
  console.log('the probe itself threw: ' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
