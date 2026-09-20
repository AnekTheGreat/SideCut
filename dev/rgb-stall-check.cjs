// RGB on a real phone: the cycle must not depend on the WebView handing us frames.
//
// Reported symptom (the "RGB themes are cursed again, not pulsing or anything"
// screenshot): the accent sat on one hue — the RGB theme's own pink — and never
// moved. The cycle was driven by requestAnimationFrame, and a phone can stop
// delivering rAF callbacks entirely: a WebView that is visible but not
// compositing (after a screen-off, a call, a lifecycle transition, under memory
// pressure) gets no frames while its timers keep running. The accents freeze on
// whatever hue the last frame drew, and nothing short of a reload gets them back.
//
// This suite drives the real page with a rAF that dies after a few frames, with a
// garbage saved cycle speed, and across a hide/show, and measures the accent the
// browser actually resolves (getComputedStyle on --coral/--gold).
const fs = require('fs');
const path = require('path');
const { VirtualConsole, JSDOM } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 64, height: 64 };
      if (p === 'createRadialGradient' || p === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'measureText') return () => ({ width: 10 });
      if (typeof p === 'string' && /^[a-z]/.test(p)) return () => undefined;
      return undefined;
    },
    set(t, p, v) { t[p] = v; return true; },
  });
}

const TRACKS = [
  { id: 't1', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 186 },
  { id: 't2', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 155 },
];
function fakeIndexedDB(meta) {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map(Object.keys(meta).map((k) => [k, { key: k, value: meta[k] }])) };
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
      setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0);
      return req;
    },
  };
}

// rafFrames: how many frames the WebView is willing to deliver before it goes
// silent (Infinity = a healthy compositor). 0 = it never draws a frame at all.
function boot({ theme, speed, rafFrames = Infinity, startHidden = false }) {
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ').split('\n')[0]));
  vc.on('warn', () => {});
  const idb = fakeIndexedDB({ theme, rgbSpeedSec: speed, playlists: { 'All Songs': ['t1', 't2'], Favorites: [] } });
  const state = { hidden: startHidden, rafCalls: 0, rafServed: 0 };
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://localhost/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = idb;
      win.fetch = () => Promise.reject(new Error('offline'));
      Object.defineProperty(win.document, 'hidden', { get: () => state.hidden, configurable: true });
      Object.defineProperty(win.document, 'visibilityState', { get: () => (state.hidden ? 'hidden' : 'visible'), configurable: true });
      const realRaf = win.requestAnimationFrame.bind(win);
      win.requestAnimationFrame = function (cb) {
        state.rafCalls++;
        if (state.rafServed >= rafFrames) return 0; // the WebView stopped compositing
        state.rafServed++;
        return realRaf(cb);
      };
    },
  });
  return { dom, state, errors };
}

const rawVar = (win, name) => String(win.getComputedStyle(win.document.documentElement).getPropertyValue(name) || '').trim();
const isHsl = (raw) => /^hsl\(/i.test(raw);
function hueOf(raw) {
  const s = String(raw || '').trim();
  const hsl = /^hsl\(\s*([-0-9.]+)/i.exec(s);
  if (hsl) return ((parseFloat(hsl[1]) % 360) + 360) % 360;
  const hex = /^#?([0-9a-f]{6})$/i.exec(s);
  if (!hex) return null;
  const n = parseInt(hex[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (!d) return null;
  let h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h *= 60;
  return ((h % 360) + 360) % 360;
}
async function sample(win, ms, times) {
  const out = [];
  for (let i = 0; i < times; i++) {
    out.push({ coral: rawVar(win, '--coral'), gold: rawVar(win, '--gold'), glow: rawVar(win, '--glow-a') });
    await wait(ms);
  }
  return out;
}
const distinct = (list) => new Set(list).size;
function interesting(errors) {
  return errors.filter((e) => !/dbPromise|Not implemented|offline|Could not load|Failed to load|Audio graph/i.test(e));
}

(async () => {
  // ---------------------------------------------------------------------
  console.log('\n\u2014 the WebView stops delivering frames (the phone that froze on pink) \u2014');
  {
    const { dom, state, errors } = boot({ theme: 'rgb', speed: 2, rafFrames: 3 });
    const win = dom.window;
    await wait(2500);
    const s = await sample(win, 300, 8);
    // v60.4 turned this inside out: the cycle is a timer now, so the honest test is
    // that a running cycle asks the page for NO frames at all (any that are asked
    // for here come from one-shot UI work during boot). A WebView that stops
    // delivering frames therefore cannot stall the hue — there was never a frame in
    // the path to begin with.
    const rafMark = state.rafCalls;
    await wait(700);
    ok('a running cycle asks for no frames of its own',
       state.rafCalls === rafMark,
       (state.rafCalls - rafMark) + ' frame requests in 700ms');
    ok('the accent is still a live animated colour', s.every((x) => isHsl(x.coral)), s[0].coral + ' | ' + s[s.length - 1].coral);
    ok('the accent keeps moving with no frames at all', distinct(s.map((x) => x.coral)) >= 5,
       s.map((x) => x.coral).join(' \u2192 ').slice(0, 220));
    ok('the second accent moves with it', distinct(s.map((x) => x.gold)) >= 5,
       s.map((x) => x.gold).join(' \u2192 ').slice(0, 220));
    ok('the glow cycles too', distinct(s.map((x) => x.glow)) >= 5);
    ok('it no longer freezes on one hue', distinct(s.map((x) => x.coral)) !== 1);
    ok('no page errors through the stall', interesting(errors).length === 0, interesting(errors).slice(0, 2).join(' | '));
    dom.window.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 a WebView that never draws a single frame \u2014');
  {
    const { dom, state } = boot({ theme: 'rgb', speed: 2, rafFrames: 0 });
    const win = dom.window;
    await wait(2500);
    const s = await sample(win, 300, 6);
    ok('no frame callbacks were ever served', state.rafServed === 0, 'served ' + state.rafServed);
    ok('and it still cycles without a single frame', distinct(s.map((x) => x.coral)) >= 4,
       s.map((x) => x.coral).join(' \u2192 ').slice(0, 200));
    // Frame one must be applied without waiting for any timer at all: with a
    // frozen cycle phase the accent has to be the theme's own pink, not the
    // static fallback of whatever theme was applied before it.
    dom.window.close();
    const fresh = boot({ theme: 'rgb', speed: 3600, rafFrames: 0 });
    await wait(2200);
    const opening = rawVar(fresh.dom.window, '--coral');
    ok('the accent opens on the theme\u2019s own pink with no frames at all',
       hueOf(opening) !== null && Math.abs(hueOf(opening) - 325) <= 8, opening);
    ok('and it is a live animated value, not the static theme colour', isHsl(opening), opening);
    fresh.dom.window.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 a saved cycle speed that cannot work \u2014');
  // A NaN/0/negative stored speed used to make every hue NaN. CSS ignores an
  // invalid value, so the accents kept the static theme colour for ever \u2014 the
  // exact "not pulsing" screenshot, with no error anywhere.
  for (const speed of [NaN, 0, -4, 'x']) {
    const { dom } = boot({ theme: 'rgb', speed, rafFrames: 0 });
    const win = dom.window;
    await wait(2200);
    const s = await sample(win, 250, 6);
    const hues = s.map((x) => hueOf(x.coral));
    ok('a saved speed of ' + String(speed) + ' still produces real hues', hues.every((h) => h !== null),
       s[0].coral + ' | ' + s[1].coral);
    ok('a saved speed of ' + String(speed) + ' still cycles', distinct(s.map((x) => x.coral)) >= 4,
       s.map((x) => x.coral).join(' \u2192 ').slice(0, 160));
    dom.window.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 away and back: the app must not come back frozen \u2014');
  {
    const { dom, state } = boot({ theme: 'rgb', speed: 2, rafFrames: 2, startHidden: true });
    const win = dom.window;
    await wait(2200);
    const away = await sample(win, 200, 3);
    ok('nothing is animated while the app is hidden', distinct(away.map((x) => x.coral)) === 1,
       away.map((x) => x.coral).join(' \u2192 '));

    // The app comes back to the foreground with no frames available.
    state.hidden = false;
    win.document.dispatchEvent(new win.Event('visibilitychange'));
    await wait(1200);
    const back = await sample(win, 300, 6);
    ok('the cycle is running again after the app returns', distinct(back.map((x) => x.coral)) >= 4,
       back.map((x) => x.coral).join(' \u2192 ').slice(0, 200));
    ok('and the glow came back with it', distinct(back.map((x) => x.glow)) >= 4,
       back.map((x) => x.glow).join(' \u2192 ').slice(0, 200));

    // Something takes the cycle's timer away while the app is in the foreground
    // (a frozen page resumed, the platform reaping timers): the next time the app
    // is shown again it must notice and restart, not sit on one colour.
    for (let id = 1; id < 20000; id++) { try { win.clearInterval(id); } catch (e) {} }
    state.hidden = true;
    win.document.dispatchEvent(new win.Event('visibilitychange'));
    await wait(400);
    state.hidden = false;
    win.document.dispatchEvent(new win.Event('visibilitychange'));
    await wait(1200);
    const revived = await sample(win, 300, 6);
    ok('it notices a timer the system took away and restarts the cycle',
       distinct(revived.map((x) => x.coral)) >= 4,
       revived.map((x) => x.coral).join(' \u2192 ').slice(0, 200));
    dom.window.close();
  }

  // ---------------------------------------------------------------------
  console.log('\n\u2014 switching away still settles on the static theme \u2014');
  {
    const { dom } = boot({ theme: 'rgb', speed: 2, rafFrames: 1 });
    const win = dom.window;
    await wait(2200);
    const before = distinct((await sample(win, 300, 4)).map((x) => x.coral));
    ok('RGB is cycling before the switch', before >= 3, 'distinct=' + before);
    if (typeof win.__scApplyTheme === 'function') win.__scApplyTheme('coral');
    await wait(800);
    const after = await sample(win, 300, 4);
    ok('the coral theme is a fixed colour again', distinct(after.map((x) => x.coral)) === 1, after.map((x) => x.coral).join(' \u2192 '));
    ok('and it is the coral theme\u2019s own value', /^#?ff6f59$/i.test(after[0].coral), after[0].coral);
    ok('the animated glow values are released', !isHsl(rawVar(win, '--glow-a')), rawVar(win, '--glow-a'));
    dom.window.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
