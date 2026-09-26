// The pane header squashes its runtime with an ellipsis on narrow screens
// ("233 tracks · 12h …"), and tapping that line is supposed to pop the exact
// total in a bubble. Reported: "the popup is not showing for the playlists that
// full track time is not visible — I should be able to click on that and the
// bubble shows up".
//
// This boots the real page with a real playlist, renders the real pane, fakes
// the one thing jsdom has no layout for (a clamped line), and taps it. It also
// taps a line that is NOT cut off, because the tap must not have to pass a
// clamp measurement the person tapping cannot see.
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
  { id: 't1', name: 'Difference', artist: 'Amrit Maan', album: 'Difference', duration: 205 },
  { id: 't2', name: 'Bambiha Bole', artist: 'Amrit Maan', album: 'Bambiha Bole', duration: 301 },
  { id: 't3', name: 'Brown Munde', artist: 'AP Dhillon', album: 'Brown Munde', duration: 254 },
  { id: 't4', name: 'Excuses', artist: 'AP Dhillon', album: 'Excuses', duration: 176 },
  { id: 't5', name: 'STFU', artist: 'AP Dhillon', album: 'STFU', duration: 174 },
  { id: 't6', name: 'White Brown Black', artist: 'Avvy Sra', album: 'White Brown Black', duration: 176 },
];
const META = [
  { key: 'playlists', value: { 'All Songs': ['t1', 't2', 't3', 't4', 't5', 't6'], Favorites: [], 'Punjabi Gaane': ['t1', 't2', 't3', 't4', 't5', 't6'] } },
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
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
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
    win.navigator.vibrate = () => true;
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// jsdom lays nothing out: scrollWidth/clientWidth are always 0. The clamp is the
// condition the old code gated on, so it is the one thing that must be simulated.
function clamp(el, scroll, client) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => scroll });
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => client });
}
const bubble = (win) => win.document.getElementById('durBubble');
const shown = (win) => { const b = bubble(win); return !!b && b.style.display === 'block' && b.style.visibility !== 'hidden'; };
// A real tap on a touch screen: pointerup, then the click it causes. The app
// treats the pair as one tap, so taps are spaced past that window.
async function tap(win, el) {
  try { el.dispatchEvent(new win.PointerEvent('pointerup', { bubbles: true, cancelable: true })); } catch (e) {}
  el.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(450);
}

(async () => {
  const win = dom.window;
  await wait(3000);

  console.log('[1] the playlist pane header carries a tappable runtime');
  let sub = null;
  {
    win.navigate('library');
    await wait(200);
    const chip = Array.from(win.document.querySelectorAll('*')).find(
      (el) => el.children.length === 0 && /Punjabi Gaane/.test(el.textContent || ''));
    if (chip) { chip.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true })); await wait(400); }
    win.renderList();
    await wait(200);
    sub = win.document.querySelector('#listPane .pane-header .sub') || win.document.querySelector('.pane-header .sub');
    ok('the pane header has a sub line', !!sub, sub ? sub.textContent : 'none');
    ok('it carries the runtime', !!sub && /6 tracks · /.test(sub.textContent), sub && sub.textContent);
    ok('and is marked as a duration anchor', !!sub && sub.getAttribute('data-dur-bubble') === '1');
    ok('the bubble helper is exported', typeof win.__scDurBubble === 'object' && typeof win.__scDurBubble.toggle === 'function');
    ok('the line says it is tappable, cut off or not', !!sub && sub.style.cursor === 'pointer', sub && JSON.stringify(sub.style.cursor));
    if (sub) clamp(sub, 420, 180);
    ok('a truncated line reads as clamped', !!sub && win.__scDurBubble.isClamped(sub));
  }

  console.log('[2] tapping it shows the exact total');
  {
    ok('the bubble does not exist yet', !bubble(win));
    await tap(win, sub);
    const b = bubble(win);
    ok('tapping a truncated runtime opens the bubble', shown(win), b ? JSON.stringify(b.style.display) : 'no bubble');
    ok('it holds the exact total, to the second', !!b && /21m 26s/.test(b.textContent), b ? b.textContent : '');
    ok('and names the playlist and the count',
      !!b && /6 tracks/.test(b.textContent) && /Punjabi Gaane/.test(b.textContent), b ? b.textContent : '');
    ok('the bubble is on screen, not parked off it',
      !!b && parseFloat(b.style.left) >= 0 && parseFloat(b.style.top) >= 0,
      b ? b.style.left + ' / ' + b.style.top : '');
  }

  console.log('[3] a line that is NOT cut off answers too');
  {
    win.__scDurBubble.hide();
    await wait(60);
    clamp(sub, 120, 400);
    ok('the line now measures as fully visible', !win.__scDurBubble.isClamped(sub));
    await tap(win, sub);
    ok('tapping it still shows the total', shown(win), bubble(win) ? bubble(win).style.display : 'no bubble');
    clamp(sub, 420, 180);
    win.__scDurBubble.hide();
    await wait(60);
  }

  console.log('[4] and it closes again');
  {
    await tap(win, sub);
    ok('a first tap opens it', shown(win));
    await tap(win, sub);
    ok('a second tap on the same line closes it', !shown(win), bubble(win) ? bubble(win).style.display : 'gone');
    await tap(win, sub);
    ok('and it comes back', shown(win));
    win.document.body.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
    await wait(120);
    ok('a tap elsewhere dismisses it', !shown(win));
  }

  if (errors.length) console.log('\njsdom errors:\n  ' + errors.slice(0, 5).join('\n  '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
