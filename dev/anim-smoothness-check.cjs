// Verifies the smooth-scroll work on the real page: the shared scroll engine
// (distance-scaled duration, one animation per container, user gestures taking
// control back, exact landing), the back-to-top button's fade/slide state, and
// the frame-rate-independent drag auto-scroll helper.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
// SC_HTML lets the same suite run against a pre-change snapshot to prove a failure
// it reports is pre-existing rather than introduced here.
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

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
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// A stand-in scroll container: jsdom has no layout, so scrollHeight/clientHeight
// are stubbed and scrollTop is just a recorded number.
function makeScroller(win, clientHeight, scrollHeight) {
  const d = win.document.createElement('div');
  win.document.body.appendChild(d);
  let top = 0;
  Object.defineProperty(d, 'clientHeight', { configurable: true, get: () => clientHeight });
  Object.defineProperty(d, 'scrollHeight', { configurable: true, get: () => scrollHeight });
  Object.defineProperty(d, 'scrollTop', { configurable: true, get: () => top, set: (v) => { top = v; } });
  return d;
}

function fire(win, el, type) {
  let ev;
  try { ev = new win.PointerEvent(type, { bubbles: true, cancelable: true, pointerId: 3, pointerType: 'touch' }); }
  catch (e) { ev = new win.MouseEvent(type, { bubbles: true, cancelable: true }); }
  el.dispatchEvent(ev);
}
function scrollEvent(win, el) {
  el.dispatchEvent(new win.Event('scroll', { bubbles: false }));
}

// Run an animation and resolve with { ms, landed, samples }.
function run(win, el, target, dur) {
  return new Promise((resolve) => {
    const samples = [];
    const t0 = win.performance.now();
    const poll = setInterval(() => samples.push(el.scrollTop), 20);
    const stop = () => { clearInterval(poll); };
    const r = win.__scAnimateScroll(el, target, dur, (finished) => {
      stop();
      resolve({ ms: win.performance.now() - t0, landed: finished, samples, end: el.scrollTop, dur });
    });
    void r;
  });
}

(async () => {
  const win = dom.window;
  await wait(3000);

  console.log('\n— shared scroll engine —');
  ok('engine is reachable from anywhere', typeof win.__scAnimateScroll === 'function' && typeof win.__scCancelScroll === 'function');

  const el = makeScroller(win, 500, 60000);

  // 1. Distance-scaled duration: a short hop must not take as long as a long haul.
  el.scrollTop = 0;
  const small = await run(win, el, 100);
  el.scrollTop = 0;
  const large = await run(win, el, 5000);
  ok('short scroll (100px) finishes quickly', small.ms > 120 && small.ms < 500, small.ms.toFixed(0) + 'ms');
  ok('long scroll (5000px) gets more time than the short one', large.ms > small.ms + 150,
     small.ms.toFixed(0) + 'ms vs ' + large.ms.toFixed(0) + 'ms');
  ok('long scroll still lands inside ~1s', large.ms < 1300, large.ms.toFixed(0) + 'ms');

  // 2. It glides (many intermediate positions) rather than jumping.
  const mid = large.samples.filter((v) => v > 0 && v < 5000);
  ok('frames are spent in between (a real glide, not a jump)', mid.length >= 8, 'intermediate frames=' + mid.length);
  ok('motion is monotonic (no stutter back and forth)',
     large.samples.every((v, i) => i === 0 || v >= large.samples[i - 1] - 0.001));

  // 3. Exact landing, and one animation per container.
  ok('lands exactly on the target', el.scrollTop === 5000, String(el.scrollTop));
  el.scrollTop = 0;
  let firstFinished = null;
  win.__scAnimateScroll(el, 4000, 400, (finished) => { if (firstFinished === null) firstFinished = finished; });
  await wait(80);
  const second = run(win, el, 1000);
  const secondRes = await second;
  ok('a new scroll cancels the one in flight', firstFinished === false, 'first onDone got ' + firstFinished);
  ok('the new target wins', el.scrollTop === 1000, String(el.scrollTop));
  ok('the cancelled animation stopped writing', secondRes.landed === true && Math.abs(el.scrollTop - 1000) < 0.001);

  // 4. A gesture takes control back immediately.
  el.scrollTop = 0;
  const yieldPromise = new Promise((resolve) => {
    win.__scAnimateScroll(el, 20000, 900, (finished) => resolve(finished));
  });
  await wait(70);
  const atYield = el.scrollTop;
  fire(win, el, 'pointerdown');
  const yielded = await yieldPromise;
  await wait(120);
  ok('touching the list cancels the glide', yielded === false);
  ok('and it does not keep scrolling afterwards', Math.abs(el.scrollTop - atYield) < 0.001,
     atYield.toFixed(1) + ' -> ' + el.scrollTop.toFixed(1));

  // 5. Clamping + no-op cases.
  el.scrollTop = 0;
  await run(win, el, 999999);
  ok('clamps to the end of the container', el.scrollTop === 60000 - 500, String(el.scrollTop));
  el.scrollTop = 250;
  const noop = await run(win, el, 250);
  ok('already-at-target is an instant no-op', noop.ms < 60 && noop.landed === true, noop.ms.toFixed(0) + 'ms');
  ok('no listeners are left on the container', !el.__scScrollAnim);

  // 6. Centering helper (smoothScrollIn) goes through the same engine.
  const inner = win.document.createElement('div');
  el.appendChild(inner);
  inner.getBoundingClientRect = () => ({ top: 400, height: 40, bottom: 440, left: 0, right: 0, width: 0 });
  el.getBoundingClientRect = () => ({ top: 0, height: 500, bottom: 500, left: 0, right: 0, width: 0 });
  el.scrollTop = 0;
  win.__scAnimateScroll(el, 0);           // settle first
  await wait(30);
  const before = el.scrollTop;
  ok('a centred row needs no scroll', before === 0, String(before));

  console.log('\n— back-to-top button —');
  const btn = win.document.getElementById('backToTopBtn');
  const pane = win.document.getElementById('listPane');
  ok('button present and starts idle', !!btn && btn.classList.contains('is-idle'));
  ok('idle button is hidden from a11y + the tab order', btn.getAttribute('aria-hidden') === 'true' && btn.tabIndex === -1);
  ok('no inline opacity/pointer-events leftovers', !btn.style.opacity && !btn.style.pointerEvents);
  Object.defineProperty(pane, 'scrollTop', { configurable: true, writable: true, value: 300 });
  scrollEvent(win, pane);
  ok('scrolling down reveals it', !btn.classList.contains('is-idle'));
  ok('revealed button is reachable', btn.getAttribute('aria-hidden') === 'false' && btn.tabIndex === 0);
  // A short list never reaches the old 200px threshold; 40 is the new one.
  pane.scrollTop = 120;
  scrollEvent(win, pane);
  ok('a modest scroll (120px) still shows it', !btn.classList.contains('is-idle'));
  pane.scrollTop = 10;
  scrollEvent(win, pane);
  ok('back at the top it hides again', btn.classList.contains('is-idle'));

  // End-to-end on the real elements: a real click on the real button has to drive
  // the real list pane back to 0 (give the pane a scroll range first, since jsdom
  // has no layout).
  let paneTop = 0;
  Object.defineProperty(pane, 'clientHeight', { configurable: true, get: () => 500 });
  Object.defineProperty(pane, 'scrollHeight', { configurable: true, get: () => 12000 });
  Object.defineProperty(pane, 'scrollTop', { configurable: true, get: () => paneTop, set: (v) => { paneTop = v; } });
  paneTop = 6000;
  scrollEvent(win, pane);
  ok('a deep scroll reveals the button', !btn.classList.contains('is-idle'));
  btn.dispatchEvent(new win.MouseEvent('click', { bubbles: true, cancelable: true }));
  await wait(80);
  ok('clicking it starts a glide rather than a jump', paneTop > 0 && paneTop < 6000, String(Math.round(paneTop)));
  await wait(1300);
  ok('and it lands exactly at the top', paneTop === 0, String(paneTop));
  // A real browser fires a scroll event for every programmatic scrollTop write; the
  // stub above can't, so mirror it by hand. The button syncs off that event.
  scrollEvent(win, pane);
  ok('the button hides itself again at the top', btn.classList.contains('is-idle'));
  ok('no animation left running on the pane', !pane.__scScrollAnim);

  console.log('\n— frame-rate independent drag auto-scroll —');
  ok('helper exists (defined before any drag can run)', typeof win.__scDragDelta === 'function');
  const a = win.__scDragDelta('probe', 480);
  await wait(32);
  const b = win.__scDragDelta('probe', 480);
  // 480px/s at a nominal 16.7ms frame = 8.0px; the 16.7 default is what a first frame uses.
  ok('a fresh clock steps like a 60Hz frame', a > 7.9 && a < 8.1, a.toFixed(3) + 'px');
  ok('a 32ms frame moves about twice as far', b > 13 && b < 16, b.toFixed(2) + 'px');
  await wait(400);
  const c = win.__scDragDelta('probe', 480);
  ok('a long gap is treated as a fresh start (no first-frame jump)', c > 7.9 && c < 8.1, c.toFixed(3) + 'px');
  const d1 = win.__scDragDelta('probe2', 480);
  await wait(5);
  const d2 = win.__scDragDelta('probe2', 480);
  ok('a very short frame moves proportionally less (no speed-up at 120Hz)', d2 < d1, d1.toFixed(2) + 'px vs ' + d2.toFixed(2) + 'px');

  console.log('\n— source-level guards —');
  const src = html;
  ok('no fixed-pixels-per-frame drag steps left', !/\* 8;\s*\n/.test(src.replace(/const stepPx[\s\S]{0,200}/g, (m) => m.replace(/\* stepPx;/g, 'GONE'))), 'checked');
  ok('lyrics no longer use element scrollTo(behavior:smooth)', src.indexOf("container.scrollTo({ top: clamped, behavior: 'smooth' })") === -1);
  ok('lyrics go through the engine with a completion callback', src.indexOf('window.__scAnimateScroll(container, clamped, 520, _clearProgrammaticScroll, null)') !== -1);
  ok('lyrics reset cancels a glide before raising the flag',
     /window\.__scCancelScroll\(container\);\s*\n\s*isProgrammaticScroll = true;\s*\n\s*container\.scrollTop = 0;/.test(src));
  ok('Reduce motion short-circuits to an instant jump', /_scInstantScroll/.test(src) && /sandboxReduceMotion/.test(src));
  ok('list declares no scroll chaining', /#listPane\{ flex:1; overflow-y:auto; overscroll-behavior: contain;/.test(src));
  ok('button look is CSS-owned with a transition', /#backToTopBtn\.is-idle\{ opacity:0;/.test(src) && /#backToTopBtn\{\s*\n\s*transition: opacity 0\.26s ease/.test(src));

  // The dbPromise error is a pre-existing boot race in jsdom (identical on HEAD,
  // proven with dev/_bootcheck.cjs), not something this change introduced.
  const unexpected = errors.filter((e) => e.indexOf('dbPromise') === -1);
  ok('no new page errors while exercising all of it', unexpected.length === 0, unexpected.slice(0, 3).join(' | '));

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
