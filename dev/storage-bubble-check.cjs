// The Storage cleaner's rows squash their name and their "artists - size" line
// with an ellipsis when the byline is long ("Karan Aujla, Mxrci, Seshnolan - ..."),
// so the SIZE and the artist names were the parts that got lost. Reported: the
// name and the MB are cut off because the name is very long, "that's why I wanted
// the bubble".
//
// This boots the real page with a library whose files have sizes, opens the real
// Studio -> Storage cleaner, and taps a row's text. It checks the bubble that
// appears carries the exact size and the whole byline, and that it closes again.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return { width: 300, height: 150 };
      if (prop === 'measureText') return () => ({ width: 10 });
      if (typeof prop === 'string' && /^[a-z]/.test(prop)) return () => undefined;
      return undefined;
    },
    set(t, prop, v) { t[prop] = v; return true; },
  });
}

// The biggest files, with a long artist list - exactly the row shape that clamps.
const MB = 1048576;
// The audio lives INSIDE the record as an ArrayBuffer (blobData); the app builds
// the track's file Blob from it, which is what the cleaner measures.
const audioBytes = (mb) => new ArrayBuffer(Math.round(mb * MB));
const TRACKS = [
  { id: 't1', name: 'Winning Speech', artist: 'Karan Aujla, Mxrci, Seshnolan', album: 'Making Memories', duration: 205, blobData: audioBytes(21.4), blobType: 'audio/mpeg' },
  { id: 't2', name: 'Choli Ke Peeche', artist: 'Alka Yagnik, Ila Arun', album: 'Khal Nayak', duration: 301, blobData: audioBytes(19.7), blobType: 'audio/mpeg' },
  { id: 't3', name: 'Kabhi Khushi Kabhie Gham', artist: 'Jatin-Lalit, Amit Kumar, Sonu Nigam', album: 'K3G', duration: 254, blobData: audioBytes(18.6), blobType: 'audio/mpeg' },
];
const META = [
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
      getAllKeys() { const q = {}; setTimeout(() => { q.result = Array.from(data[store].keys()); q.onsuccess && q.onsuccess(); }, 0); return q; },
      delete(k) { data[store].delete(k); fire(); return {}; },
    });
    return t;
  }
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented|offline|Could not parse CSS/i.test(m)) errors.push(m); });
vc.on('error', (...a) => { const m = a.map(String).join(' ').split('\n')[0]; if (!/Storage|offline/i.test(m)) errors.push(m); });

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.indexedDB = fakeIndexedDB();
    // The app builds a Blob URL for each stored file as it loads the library.
    win.URL.createObjectURL = () => 'blob:fake';
    win.URL.revokeObjectURL = () => {};
    win.fetch = () => Promise.reject(new Error('offline'));
    win.navigator.vibrate = () => true;
    win.HTMLMediaElement.prototype.play = function () { try { this.dispatchEvent(new win.Event('play')); } catch (e) {} return Promise.resolve(); };
    win.HTMLMediaElement.prototype.pause = function () {};
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const bubble = (win) => win.document.getElementById('durBubble');
const shown = (win) => { const b = bubble(win); return !!b && b.style.display === 'block' && b.style.visibility !== 'hidden'; };
async function tap(win, el) {
  try { el.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, cancelable: true })); } catch (e) {}
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(450);
}

(async () => {
  const win = dom.window;
  await wait(2800);

  console.log('[1] the Storage cleaner renders tappable rows');
  win.navigate('studio');
  await wait(400);
  // The section may open folded; work its head if it does.
  const head = win.document.querySelector('[data-fold="scFoldStorage"]');
  const rowSel = '.sc-store-txt[data-store-size]';
  if (head && head.getAttribute('aria-expanded') === 'false') { head.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); await wait(400); }
  let rows = win.document.querySelectorAll(rowSel);
  ok('the cleaner lists the biggest songs', rows.length === 3, rows.length);
  const row = rows[0];
  ok('a row carries its size and byline', !!row && Number(row.getAttribute('data-store-size')) > 0, row && row.getAttribute('data-store-size'));
  ok('and is marked as a bubble anchor (so a tap is wired)', !!row && row.getAttribute('data-dur-bubble') === '1');
  ok('the bubble helper exposes toggleText', typeof win.__scDurBubble.toggleText === 'function');

  console.log('[2] tapping a row pops the exact size and the whole byline');
  ok('the bubble does not exist yet', !bubble(win));
  await tap(win, row);
  const b = bubble(win);
  ok('tapping the row opens the bubble', shown(win), b ? JSON.stringify(b.style.display) : 'no bubble');
  ok('the big line is the file size, in MB',
    !!b && /\d+(\.\d+)?\s*(B|KB|MB|GB)/.test(b.querySelector('.bt').textContent), b ? b.querySelector('.bt').textContent : '');
  ok('the sub line carries the whole byline, not the clamped one',
    !!b && /Karan Aujla, Mxrci, Seshnolan/.test(b.querySelector('.ba').textContent), b ? b.querySelector('.ba').textContent : '');
  ok('and names the song', !!b && /Winning Speech/.test(b.querySelector('.ba').textContent), b ? b.querySelector('.ba').textContent : '');
  ok('the bubble is on screen, not parked off it',
    !!b && parseFloat(b.style.left) >= 0 && parseFloat(b.style.top) >= 0, b ? b.style.left + ' / ' + b.style.top : '');

  console.log('[3] a second row answers with its own size');
  await tap(win, win.document.querySelectorAll(rowSel)[2]);
  const b2 = bubble(win);
  ok('the bubble moved to the new row', shown(win));
  ok('with that row\'s size', !!b2 && /18\.\d MB/.test(b2.querySelector('.bt').textContent), b2 ? b2.querySelector('.bt').textContent : '');
  ok('and that row\'s artist list', !!b2 && /Jatin-Lalit/.test(b2.querySelector('.ba').textContent), b2 ? b2.querySelector('.ba').textContent : '');

  console.log('[4] and it closes again');
  await tap(win, win.document.querySelectorAll(rowSel)[2]);
  ok('a second tap on the same row closes it', !shown(win), bubble(win) ? bubble(win).style.display : 'gone');

  console.log('\n— the duration bubble still works (no regression) —');
  ok('toggle() is still exported', typeof win.__scDurBubble.toggle === 'function');
  ok('fmtPrecise() is still exported', typeof win.__scDurBubble.fmtPrecise === 'function');

  if (errors.length) console.log('\njsdom errors:\n  ' + errors.slice(0, 5).join('\n  '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
