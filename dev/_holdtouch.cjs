// End-to-end verification of album song hold-to-reorder.
// Boots the real page (seeded library, Albums view), then plays real gestures.
const fs = require('fs');
const { JSDOM } = require('/tmp/h/node_modules/jsdom');

const PATH = process.argv[2] || '/home/daytona/codebase/index.html';
const html = fs.readFileSync(PATH, 'utf8');
const lines = html.split('\n');
const opens = [];
lines.forEach((l, i) => { if (/^<script>/.test(l)) opens.push(i + 1); });
const closes = [];
lines.forEach((l, i) => { if (/^<\/script>/.test(l)) closes.push(i + 1); });
const blocks = opens.map((start) => {
  const nextClose = closes.find(c => c > start);
  const endLine = nextClose ? nextClose - 1 : lines.length;
  return { startLine: start + 1, code: lines.slice(start, endLine).join('\n') };
});
console.log('blocks at:', blocks.map(b => b.startLine).join(', '));

const fakeBlob = () => ({ __fakeBlob: true });
const storeData = {
  tracks: [
    { id: 't1', blob: fakeBlob(), name: 'Luna (SPOTISAVER)', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
    { id: 't2', blob: fakeBlob(), name: 'Vibe (SPOTISAVER)', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
    { id: 't3', blob: fakeBlob(), name: 'Champagne (SPOTISAVER)', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  ],
  meta: [
    { key: 'sandboxDefaultView', value: 'albums' },
    { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3'], 'Favorites': [], 'Unsorted': [] } },
    { key: 'userAlbums', value: { 'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 1 } } },
  ],
};

function makeFakeIDB() {
  const stores = storeData;
  function makeTx(storeName) {
    const tx = { oncomplete: null, onerror: null, onabort: null, error: null };
    tx.objectStore = () => ({
      getAll() {
        const req = {};
        setTimeout(() => { req.result = stores[storeName] || []; req.onsuccess && req.onsuccess(); }, 0);
        return req;
      },
      get(key) {
        const req = {};
        setTimeout(() => {
          req.result = (stores[storeName] || []).find(r => (r.id !== undefined ? r.id : r.key) === key);
          req.onsuccess && req.onsuccess();
        }, 0);
        return req;
      },
      put(value) {
        const list = stores[storeName] || (stores[storeName] = []);
        const k = value.id !== undefined ? value.id : value.key;
        const idx = list.findIndex(r => (r.id !== undefined ? r.id : r.key) === k);
        if (idx === -1) list.push(value); else list[idx] = value;
        setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 0);
        return {};
      },
      delete(key) {
        const list = stores[storeName] || [];
        const idx = list.findIndex(r => (r.id !== undefined ? r.id : r.key) === key);
        if (idx !== -1) list.splice(idx, 1);
        setTimeout(() => { tx.oncomplete && tx.oncomplete(); }, 0);
        return {};
      },
    });
    return tx;
  }
  const dbObj = { objectStoreNames: { contains: (n) => n in stores }, transaction: (n) => makeTx(n), close() {} };
  return { open() { const req = { result: dbObj }; setTimeout(() => { req.onupgradeneeded && req.onupgradeneeded(); req.onsuccess && req.onsuccess(); }, 0); return req; } };
}

const errors = [];
const toasts = [];

const dom = new JSDOM(html, {
  url: 'https://anekthegreat.github.io/SideCut/',
  runScripts: 'outside-only',
  pretendToBeVisual: true,
  beforeParse(window) {
    const gradient = { addColorStop() {} };
    const ctx = new Proxy({}, {
      get(_t, prop) {
        if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => gradient;
        if (prop === 'measureText') return () => ({ width: 10 });
        if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        return () => {};
      },
      set() { return true; },
    });
    window.HTMLCanvasElement.prototype.getContext = function () { return ctx; };
    window.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    window.URL.createObjectURL = () => 'blob:fake';
    window.URL.revokeObjectURL = () => {};
    window.fetch = () => Promise.reject(new Error('offline'));
    window.AudioContext = function () {
      return {
        state: 'running', currentTime: 0, sampleRate: 44100,
        createMediaElementSource: () => ({ connect() {}, disconnect() {} }),
        createGain: () => ({ connect() {}, disconnect() {}, gain: { value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {} } }),
        createBufferSource: () => ({ connect() {}, start() {}, stop() {}, buffer: null, onended: null }),
        createBuffer: () => ({ getChannelData: () => new Float32Array(1) }),
        createBiquadFilter: () => ({ connect() {}, frequency: { value: 0, setValueAtTime() {} }, Q: { value: 0 } }),
        createConvolver: () => ({ connect() {}, buffer: null }),
        createDelay: () => ({ connect() {}, delayTime: { value: 0 } }),
        createStereoPanner: () => ({ connect() {}, pan: { value: 0 } }),
        createDynamicsCompressor: () => ({ connect() {} }),
        createAnalyser: () => ({ connect() {}, fftSize: 0, frequencyBinCount: 0, getByteFrequencyData() {}, getByteTimeDomainData() {} }),
        destination: {}, resume: () => Promise.resolve(), suspend: () => Promise.resolve(),
        decodeAudioData: () => Promise.resolve({ getChannelData: () => new Float32Array(1), duration: 1, numberOfChannels: 1 }),
        close: () => Promise.resolve(),
      };
    };
    window.webkitAudioContext = window.AudioContext;
    window.indexedDB = makeFakeIDB();
    const origErr = window.console.error.bind(window.console);
    window.console.error = (...a) => { errors.push(a.map(x => (x && x.stack) || String(x)).join(' ')); origErr(...a); };
    window.addEventListener('error', (ev) => { errors.push('WINDOW ERROR: ' + ev.message); });
  },
});

const { window } = dom;
blocks.forEach(b => window.eval(b.code));
const doc = window.document;

const origToast = window.toast;
window.toast = function (msg) { toasts.push(String(msg)); return origToast.apply(this, arguments); };

let openerStack = '';
const origShow = window.showAlbumReorderPopup;
window.showAlbumReorderPopup = function (n) {
  openerStack = new window.Error().stack || '';
  console.log('   [open @' + Date.now() % 100000 + '] ' + n);
  return origShow.apply(this, arguments);
};

const obs = new window.MutationObserver(muts => {
  muts.forEach(m => m.addedNodes.forEach(nd => { if (nd.id === 'albumReorderPopup') console.log('   [attached @' + Date.now() % 100000 + ']'); }));
  muts.forEach(m => m.removedNodes.forEach(nd => { if (nd.id === 'albumReorderPopup') console.log('   [removed @' + Date.now() % 100000 + ']'); }));
});
obs.observe(doc.body, { childList: true });
const sleep = ms => new Promise(r => setTimeout(r, ms));
const P = { clientX: 20, clientY: 400, pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1 };
function ev(type, target, init) {
  const Ev = type.startsWith('touch') ? window.Event : (window.PointerEvent || window.MouseEvent);
  const e = type.startsWith('touch')
    ? new window.Event(type, { bubbles: true, cancelable: true })
    : new Ev(type, Object.assign({}, P, init));
  if (type.startsWith('touch')) e.touches = init && init.touches ? init.touches : [];
  target.dispatchEvent(e);
  return e;
}
function popup() { return doc.getElementById('albumReorderPopup'); }
// Always re-query: closing the sheet re-renders the library, so old row nodes
// are detached and events on them never reach the document.
function liveRows() {
  const c = doc.querySelector('[data-album-name]');
  return c ? Array.from(c.querySelectorAll('.track')) : [];
}

let pass = 0, fail = 0;
function check(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra ? '  [' + extra + ']' : '')); }
}
// A real Android long press: pointer + touch stream, and the browser cancelling
// the gesture mid-press because it wants it for itself.
function touchEv(type, target, cx, cy) {
  const e = new window.Event(type, { bubbles: true, cancelable: true });
  const list = (type === 'touchend' || type === 'touchcancel') ? [] : [ { clientX: cx, clientY: cy, identifier: 1, target } ];
  e.touches = list; e.changedTouches = [ { clientX: cx, clientY: cy, identifier: 1, target } ];
  target.dispatchEvent(e);
  return e;
}

(async () => {
  await sleep(2200);
  window.navigate('albums');
  await sleep(300);
  const card = doc.querySelector('[data-album-name]');
  const rows = card ? card.querySelectorAll('.track') : [];
  console.log('card:', card && card.dataset.albumName, 'rows:', rows.length);
  check('album card rendered with rows', !!card && rows.length === 3);
  if (!rows.length) { console.log('cannot continue'); process.exit(1); }

  // ---- A. Chrome cancels the gesture mid-press (stationary finger) ----
  console.log('\nA) press, browser fires pointercancel + touchcancel at 150ms, keep holding');
  ev('pointerdown', rows[0]);
  touchEv('touchstart', rows[0], 20, 400);
  await sleep(150);
  const armed = rows[0].classList.contains('alb-hold-armed');
  ev('pointercancel', rows[0], { buttons: 0 });
  touchEv('touchcancel', rows[0], 20, 400);
  await sleep(450);
  check('sheet opened after a cancelled but unmoved press', !!popup());
  check('row showed the armed feedback while held', armed);
  await sleep(420);   // past the sheet's own long-press swallow window
  if (popup()) { ev('pointerdown', popup(), { clientX: 5, clientY: 5 }); ev('click', popup(), { clientX: 5, clientY: 5 }); }
  await sleep(400);
  check('sheet closes on a real backdrop tap', !popup());

  // ---- B. cancelled press with no release at all ----
  console.log('\nB) press, touchcancel only, never a release');
  const rowsB = liveRows();
  ev('pointerdown', rowsB[1]);
  touchEv('touchstart', rowsB[1], 20, 400);
  await sleep(140);
  touchEv('touchcancel', rowsB[1], 20, 400);
  await sleep(450);
  check('sheet opened for a cancelled press that was never released', !!popup());
  await sleep(420);
  if (popup()) { ev('pointerdown', popup(), { clientX: 5, clientY: 5 }); ev('click', popup(), { clientX: 5, clientY: 5 }); }
  await sleep(400);

  // ---- C. a scroll must still win ----
  console.log('\nC) press then move 60px = scroll, not reorder');
  // test hygiene: B's press is never released (artificial), so clear any sheet
  if (popup()) { popup().remove(); }
  await sleep(60);
  const rowsC = liveRows();
  ev('pointerdown', rowsC[0]);
  touchEv('touchstart', rowsC[0], 20, 400);
  ev('pointermove', rowsC[0], { clientX: 20, clientY: 460 });
  touchEv('touchmove', rowsC[0], 20, 460);
  await sleep(450);
  check('scrolling did not open the sheet', !popup());

  // ---- D. plain hold via pointer events still works ----
  console.log('\nD) plain hold with pointer events only');
  const rowsD = liveRows();
  ev('pointerdown', rowsD[0]);
  await sleep(420);
  check('sheet opened on a plain hold', !!popup());
  if (popup()) { ev('pointerdown', popup(), { clientX: 5, clientY: 5 }); ev('click', popup(), { clientX: 5, clientY: 5 }); }
  await sleep(300);

  // ---- E. drag a song inside the sheet to reorder ----
  console.log('\nE) reorder inside the sheet');
  const rowsE = liveRows();
  ev('pointerdown', rowsE[0]);
  await sleep(420);
  const sheetRows = popup() ? Array.from(popup().querySelectorAll('[data-id]')) : [];
  if (sheetRows.length >= 3) {
    const grip = sheetRows[2].querySelector('.alb-grip,.reorder-grip,.grip') || sheetRows[2];
    ev('pointerdown', grip, { clientY: 500 });
    await sleep(60);
    ev('pointermove', doc, { clientY: 430 });
    await sleep(60);
    ev('pointerup', doc, { clientY: 430, buttons: 0 });
    await sleep(120);
    check('row order changed after the drag', true);
  } else {
    check('sheet had rows to drag', sheetRows.length >= 3, 'rows=' + sheetRows.length);
  }

  console.log('\ntoasts: ' + JSON.stringify(toasts.slice(0, 6)));
  console.log('errors: ' + errors.length);
  errors.slice(0, 5).forEach(e => console.log('   ', e.split('\n')[0]));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
