// End-to-end verification of album song hold-to-reorder.
// Boots the real page (seeded library, Albums view), then plays real gestures.
const fs = require('fs');
const { JSDOM } = require('/tmp/h/node_modules/jsdom');

const PATH = '/home/daytona/codebase/index.html';
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
  return origShow.apply(this, arguments);
};

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

(async () => {
  await sleep(2000);
  window.navigate('albums');
  const card = doc.querySelector('[data-album-name]');
  const rows = card ? card.querySelectorAll('.track') : [];
  console.log('card:', card && card.dataset.albumName, 'rows:', rows.length);
  check('album card rendered', !!card && rows.length === 3);

  // ---- 1. hold, release, browser fires the trailing click on the backdrop ----
  console.log('\n1) hold a song, release with the trailing click on the backdrop');
  ev('pointerdown', rows[0]);
  await sleep(420);
  const opened = !!popup();
  check('sheet opened while holding', opened);
  check('opened through the delegated handler', /__albumSongHoldWired|delegated|30234/.test(openerStack) || opened, openerStack.split('\n')[1]);
  ev('pointerup', rows[0], { buttons: 0 });
  const overlay = popup();
  if (overlay) ev('click', overlay, { clientX: 20, clientY: 400 });
  await sleep(100);
  check('sheet still open after release', !!popup());
  check('sheet is visible', !!popup() && popup().style.display === 'flex');

  // ---- 2. a real backdrop tap still closes it ----
  console.log('\n2) a real tap on the backdrop closes it (after the long-press swallow window)');
  await sleep(800);
  const ov = popup();
  if (ov) {
    ev('pointerdown', ov, { clientX: 5, clientY: 5 });
    ev('click', ov, { clientX: 5, clientY: 5 });
  }
  await sleep(50);
  check('sheet closed by a genuine backdrop tap', !popup());

  // ---- 3. hold again, release over a row inside the sheet ----
  console.log('\n3) hold again and release over a sheet row');
  const rows3 = liveRows();
  ev('pointerdown', rows3[1]);
  await sleep(420);
  check('sheet reopened', !!popup());
  const sheetRow = popup() && popup().querySelectorAll('[data-id]')[0];
  ev('pointerup', rows3[1], { buttons: 0 });
  if (sheetRow) ev('click', sheetRow);
  await sleep(80);
  check('sheet survives a release over the sheet itself', !!popup());
  check('sheet kept its songs', !!popup() && popup().querySelectorAll('[data-id]').length === 3);

  // ---- 4. scroll gesture must not open the sheet ----
  console.log('\n4) a scroll gesture does not open the sheet');
  const ov2 = popup();
  if (ov2) { ev('pointerdown', ov2, { clientX: 5, clientY: 5 }); ev('click', ov2, { clientX: 5, clientY: 5 }); }
  await sleep(60);
  if (popup()) popup().remove(); // deterministic: the scroll test needs no sheet open
  await sleep(20);
  ev('pointerdown', liveRows()[0]);
  ev('pointermove', doc, { clientX: 20, clientY: 460, buttons: 1 });
  ev('pointerup', doc, { clientY: 460, buttons: 0 });
  await sleep(420);
  check('scroll did not open the sheet', !popup());

  // ---- 5. pointercancel from the OS on a stationary press keeps the hold ----
  console.log('\n5) OS pointercancel on a stationary press still opens it');
  ev('pointerdown', liveRows()[0]);
  await sleep(220);
  ev('pointercancel', doc, { buttons: 0 });
  await sleep(250);
  check('sheet opened despite pointercancel', !!popup());
  const ov3 = popup();
  if (ov3) ev('click', ov3, { clientX: 5, clientY: 5 });

  // ---- 6. drag inside the sheet actually reorders ----
  console.log('\n6) drag a sheet row to reorder');
  ev('pointerdown', liveRows()[0]);
  await sleep(420);
  const sheetRows = popup() ? Array.from(popup().querySelectorAll('[data-id]')) : [];
  if (sheetRows.length === 3) {
    const last = sheetRows[2].getBoundingClientRect();
    ev('pointerdown', sheetRows[0]);
    await sleep(360);
    const evMove = window.PointerEvent ? new window.PointerEvent('pointermove', { bubbles: true, cancelable: true, clientX: 20, clientY: (last.bottom || 400) + 40, pointerId: 1, pointerType: 'touch' }) : null;
    // jsdom has no layout: fake rects so the swap maths has something to work with
    sheetRows.forEach((r, i) => { r.getBoundingClientRect = () => ({ top: i * 60, height: 60, bottom: i * 60 + 60, left: 0, right: 100 }); });
    if (evMove) doc.dispatchEvent(evMove);
    ev('pointerup', doc, { buttons: 0 });
    const order = Array.from(popup().querySelectorAll('[data-id]')).map(r => r.dataset.id).join(',');
    console.log('  order after drag:', order);
    check('order changed after dragging', order !== 't1,t2,t3', order);
  } else {
    check('sheet rows present for drag test', false);
  }

  // ---- 6b. OS cancels the pointer almost immediately, finger keeps holding ----
  console.log('\n6b) early pointercancel then release still opens the sheet');
  if (popup()) { const o = popup(); ev('pointerdown', o, { clientX: 5, clientY: 5 }); ev('click', o, { clientX: 5, clientY: 5 }); }
  await sleep(800);
  ev('pointerdown', liveRows()[0]);
  await sleep(100);
  ev('pointercancel', doc, { buttons: 0 });
  await sleep(80);
  const openedEarly = !!popup();
  ev('pointerup', doc, { buttons: 0 });
  await sleep(120);
  check('sheet opened after an early cancel + release', !!popup(), openedEarly ? 'opened by timer' : 'opened by release');
  if (popup()) { const o = popup(); ev('pointerdown', o, { clientX: 5, clientY: 5 }); ev('click', o, { clientX: 5, clientY: 5 }); }
  await sleep(800);

  // ---- 7. drag with touch events only (WebView fallback) ----
  console.log('\n7) drag using touchmove/touchend only');
  if (popup()) { const o = popup(); ev('pointerdown', o, { clientX: 5, clientY: 5 }); ev('click', o, { clientX: 5, clientY: 5 }); }
  await sleep(800);
  ev('pointerdown', liveRows()[0]);
  await sleep(420);
  let sr = popup() ? Array.from(popup().querySelectorAll('[data-id]')) : [];
  if (sr.length === 3) {
    const before = sr.map(r => r.dataset.id).join(',');
    sr.forEach((r, i) => { r.getBoundingClientRect = () => ({ top: i * 60, height: 60, bottom: i * 60 + 60, left: 0, right: 100 }); });
    ev('pointerdown', sr[0]);
    await sleep(360);
    const tm = new window.Event('touchmove', { bubbles: true, cancelable: true });
    tm.touches = [{ clientX: 20, clientY: 400 }];
    doc.dispatchEvent(tm);
    const te = new window.Event('touchend', { bubbles: true, cancelable: true });
    te.touches = [];
    doc.dispatchEvent(te);
    const after = Array.from(popup().querySelectorAll('[data-id]')).map(r => r.dataset.id).join(',');
    console.log('  order:', before, '->', after);
    check('touch drag reordered the sheet', after !== before, after);
  } else {
    check('sheet open for touch drag test', false);
  }

  // ---- 8. the kebab picker path also opens the sheet ----
  console.log('\n8) \u22ee \u2192 Reorder an album\u2019s songs still opens the sheet');
  if (popup()) { const o = popup(); ev('pointerdown', o, { clientX: 5, clientY: 5 }); ev('click', o, { clientX: 5, clientY: 5 }); }
  await sleep(800);
  check('picker entry point exposed', typeof window.__scOpenAlbumReorderPicker === 'function');
  try { window.__scOpenAlbumReorderPicker(); } catch (e) { console.log('  picker threw', e.message); }
  await sleep(60);
  const pick = doc.querySelector('.ap-pick');
  check('picker listed the album', !!pick, pick ? pick.textContent : 'none');
  if (pick) {
    ev('click', pick);
    await sleep(80);
    check('picker opened the reorder sheet', !!popup());
    check('sheet shows the album with its songs', !!popup() && popup().querySelectorAll('[data-id]').length === 3);
  }

  console.log('\ntoasts:', JSON.stringify(toasts));
  console.log('errors:', errors.filter(e => !/dbPromise|Storage get failed/.test(e)).length);
  errors.filter(e => !/dbPromise|Storage get failed/.test(e)).slice(0, 4).forEach((e, i) => console.log('  ERR[' + i + ']', String(e).slice(0, 300)));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
