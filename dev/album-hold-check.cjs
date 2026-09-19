// Verifies album-song hold-to-reorder on the real page: direct per-row wiring,
// the sheet opening, scroll/movement not opening it, Android's cancels not
// killing the hold, and the tap route from the song menu.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return { width: 300, height: 150 };
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (prop === 'createPattern') return () => ({});
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === 'measureText') return () => ({ width: 10 });
      if (typeof prop === 'string' && /^[a-z]/.test(prop)) return () => undefined;
      return undefined;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

const TRACKS = [
  { id: 't1', name: 'Luna (SPOTISAVER)', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe (SPOTISAVER)', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
  { id: 't3', name: 'Champagne (SPOTISAVER)', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
];
const META = [
  // v58.8.1: an album the user took in carries `manual: true`; without it the
  // manual-only migration would treat a tag-identical entry as auto-added and keep
  // it out of the tab (so there would be no card to hold on).
  { key: 'userAlbums', value: { 'MoonChild Era': { artist: 'Diljit Dosanjh', trackIds: ['t1', 't2', 't3'], createdAt: 1, manual: true } } },
  { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3'], Favorites: [] } },
];

function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map(META.map((m) => [m.key, m])) };
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
  return { _data: data, open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
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
    win.indexedDB = fakeIndexedDB();
    win.fetch = () => Promise.reject(new Error('offline'));
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function pev(win, el, type, opts) {
  const o = Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300, pointerId: 7, pointerType: 'touch', button: 0, isPrimary: true }, opts || {});
  let ev;
  try { ev = new win.PointerEvent(type, o); } catch (e) { ev = new win.MouseEvent(type, o); }
  try { if (ev.pointerId !== 7) Object.defineProperty(ev, 'pointerId', { value: 7 }); } catch (e) {}
  try { if (!ev.pointerType) Object.defineProperty(ev, 'pointerType', { value: 'touch' }); } catch (e) {}
  el.dispatchEvent(ev);
  return ev;
}
function tev(win, el, type, opts) {
  const o = Object.assign({ bubbles: true, cancelable: true }, opts || {});
  let ev;
  try { ev = new win.TouchEvent(type, o); } catch (e) { ev = null; }
  if (!ev) return null;
  el.dispatchEvent(ev);
  return ev;
}
function cev(win, el, type, opts) {
  el.dispatchEvent(new win.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true, clientX: 120, clientY: 300 }, opts || {})));
}

function sheet(win) { return win.document.getElementById('albumReorderPopup'); }
// Removing the sheet isn't enough: the sheet swallows clicks for ~700ms after it
// opens (so a long press doesn't also tap the row underneath), so tests have to
// wait that out before the next gesture.
async function resetSheet(win) {
  const s = sheet(win);
  const wasOpen = !!s;
  if (s) s.remove();
  await wait(wasOpen ? 800 : 60);
}

(async () => {
  const win = dom.window;
  await wait(3000);

  win.navigate('albums');
  await wait(600);

  const rows = Array.from(win.document.querySelectorAll('[data-album-name] .track'));
  ok('album rows rendered in Albums view', rows.length === 3, 'rows=' + rows.length);
  ok('every row is wired for hold directly', rows.every((r) => r.__scHoldWired === true));
  ok('helper exported for other paths', typeof win.__scWireAlbumRowHold === 'function');

  // 1. a three-second hold opens the sheet — and a shorter press must not
  let row = rows[1];
  pev(win, row, 'pointerdown');
  await wait(150);
  ok('row shows armed state while held', row.classList.contains('alb-hold-armed'));
  ok('the armed row shows a three-second fill', /albHoldFill 3000ms linear/.test(html));
  await wait(1000);
  ok('a one-second press does NOT open the reorder sheet', !sheet(win));
  await wait(2200);   // ~3.35s of holding in total
  ok('holding for three seconds opens the reorder sheet', !!sheet(win));
  ok('sheet lists the album songs', sheet(win) ? sheet(win).querySelectorAll('[data-id]').length === 3 : false);
  // the release click a real browser fires must not close it
  cev(win, sheet(win) || win.document.body, 'click');
  await wait(60);
  ok('sheet survives the release click', !!sheet(win));
  await resetSheet(win);
  ok('row class cleared after the gesture', !row.classList.contains('alb-hold-armed'));

  // 2. a drag/scroll must NOT open it
  await resetSheet(win);
  pev(win, row, 'pointerdown');
  pev(win, row, 'pointermove', { clientY: 360 });
  await wait(450);
  ok('scrolling a row does not open the sheet', !sheet(win));
  pev(win, row, 'pointerup', { clientY: 360 });

  // 3. Android taking the gesture (pointercancel) must not kill the hold —
  //    but it still has to be a real three-second press.
  pev(win, row, 'pointerdown');
  await wait(140);
  pev(win, row, 'pointercancel');
  await wait(500);
  ok('pointercancel alone does not open the sheet early', !sheet(win));
  await wait(2900);
  ok('pointercancel mid-hold still opens the sheet', !!sheet(win));
  await resetSheet(win);

  // 4. same for touchcancel (Chrome fires this one on Android)
  pev(win, row, 'pointerdown');
  tev(win, row, 'touchstart');
  await wait(140);
  tev(win, row, 'touchcancel');
  await wait(500);
  ok('touchcancel alone does not open the sheet early', !sheet(win));
  await wait(2900);
  ok('touchcancel mid-hold still opens the sheet', !!sheet(win));
  await resetSheet(win);

  // 5. press then immediate release (a plain tap) must not open it
  await resetSheet(win);
  ok('no sheet before the tap test', !sheet(win));
  pev(win, row, 'pointerdown');
  await wait(60);
  pev(win, row, 'pointerup');
  await wait(350);
  ok('a quick tap does not open the sheet', !sheet(win), sheet(win) ? 'sheet present' : '');

  // 6. a sheet that just closed must not eat the next tap
  pev(win, rows[2], 'pointerdown');
  await wait(3000);
  ok('holding the third row for three seconds also opens the sheet', !!sheet(win));
  await resetSheet(win);
  let swallowEaten = false;
  win.document.body.addEventListener('click', () => { swallowEaten = true; });
  cev(win, win.document.body, 'click');
  ok('taps after the sheet closes are not swallowed', swallowEaten);

  // 7. the row kebab tap route
  const kebab = row.querySelector('.kebab-btn');
  ok('row has a kebab button', !!kebab);
  cev(win, kebab, 'click');
  await wait(160);
  const backdrop = win.document.getElementById('songActionsBackdrop');
  const buttons = backdrop ? Array.from(backdrop.querySelectorAll('button')).map((b) => b.textContent.trim()) : [];
  const reorderBtn = backdrop ? Array.from(backdrop.querySelectorAll('button')).find((b) => /Reorder songs in this album/.test(b.textContent)) : null;
  ok('song menu offers "Reorder songs in this album"', !!reorderBtn, buttons.join(' | ').slice(0, 140));
  if (reorderBtn) {
    const calls = [];
    let probeRan = false;
    reorderBtn.addEventListener('click', () => { probeRan = true; });
    const realOpen = win.showAlbumReorderPopup;
    win.showAlbumReorderPopup = function (a) { calls.push(String(a)); return realOpen.apply(this, arguments); };
    await wait(900); // and let any click-swallow from an earlier sheet expire
    const ev = new win.MouseEvent('click', { bubbles: true, cancelable: true });
    reorderBtn.dispatchEvent(ev);
    await wait(160);
    const info = 'calls=' + JSON.stringify(calls) + ' handlerRan=' + probeRan + ' prevented=' + ev.defaultPrevented;
    ok('that menu item opens the reorder sheet', !!sheet(win), info);
    ok('and it opened the right album', sheet(win) ? /MoonChild Era/.test(sheet(win).textContent) : false, info);
    win.showAlbumReorderPopup = realOpen;
    await resetSheet(win);
  }
  if (backdrop) backdrop.style.display = 'none';
  await wait(50);

  // 8. inside the sheet, holding + dragging a row still reorders and persists
  row = rows[0];
  pev(win, row, 'pointerdown', { clientY: 40 });
  await wait(3300);
  const s = sheet(win);
  ok('sheet opened for the drag test', !!s);
  if (s) {
    const sheetRows = Array.from(s.querySelectorAll('[data-id]'));
    const first = sheetRows[0];
    const grip = first.querySelector('.ar-grip') || first;
    // grab the grip and drag below row 2
    pev(win, grip, 'pointerdown', { clientY: 100 });
    pev(win, win.document, 'pointermove', { clientY: 190 });
    pev(win, win.document, 'pointerup', { clientY: 190 });
    await wait(80);
    const order = Array.from(s.querySelectorAll('[data-id]')).map((r) => r.dataset.id);
    // jsdom reports every rect as 0×0, so the drag's step count isn't realistic
    // here — what matters is that the drag moved a song and saved the result.
    ok('dragging the grip reorders the songs', order.join(',') !== 't1,t2,t3', order.join(','));
    const saved = win.__scGetUserAlbums()['MoonChild Era'].trackIds.join(',');
    ok('the new order is persisted', saved === order.join(','), 'saved=' + saved + ' dom=' + order.join(','));
  }

  // 9. playlists mode is untouched (no album entry in the menu)
  await resetSheet(win);
  win.navigate('playlists');
  await wait(400);
  const prows = Array.from(win.document.querySelectorAll('.track'));
  ok('playlist rows exist', prows.length > 0);
  ok('playlist rows are not album-hold wired', prows.every((r) => !r.__scHoldWired));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  const realErrors = errors.filter((e) => !/dbPromise|offline|no network/i.test(e));
  if (realErrors.length) { console.log('page errors:'); realErrors.slice(0, 8).forEach((e) => console.log('  ' + e)); }
  process.exit(fail ? 1 : 0);
})();
