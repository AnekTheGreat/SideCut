// RGB theme audit: the hue cycle must start at the theme's own accent (not hue 0,
// which is pure red), must actually cycle, and must survive a frame that throws —
// the favicon canvas redraw is the one risky call inside that frame, and a WebView
// refusing a 2D context used to end the cycling for the rest of the session
// (accents frozen on the wrong colour = "RGB mode is broken").
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  return new Proxy({}, {
    get(t, prop) {
      if (prop in t) return t[prop];
      if (prop === 'canvas') return { width: 64, height: 64 };
      if (prop === 'createRadialGradient' || prop === 'createLinearGradient') return () => ({ addColorStop() {} });
      if (prop === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (prop === 'measureText') return () => ({ width: 10 });
      if (typeof prop === 'string' && /^[a-z]/.test(prop)) return () => undefined;
      return undefined;
    },
    set(t, prop, v) { t[prop] = v; return true; },
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
    _data: data,
    open() {
      const req = { error: null };
      const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) };
      setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0);
      return req;
    },
  };
}

function boot({ theme, speed, canvas }) {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const idb = fakeIndexedDB({ theme, rgbSpeedSec: speed, playlists: { 'All Songs': ['t1', 't2'], Favorites: [] } });
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      if (canvas === 'hostile') {
        // What a WebView under memory pressure can do to the tab-icon redraw.
        win.HTMLCanvasElement.prototype.getContext = function () { return null; };
        win.HTMLCanvasElement.prototype.toDataURL = function () { throw new Error('canvas unavailable'); };
      } else {
        win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
        win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      }
      win.indexedDB = idb;
      win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, errors };
}

function accentHue(win, name) {
  const raw = String(win.getComputedStyle(win.document.documentElement).getPropertyValue(name) || '').trim();
  const hsl = /^hsl\(\s*([-0-9.]+)/i.exec(raw);
  if (hsl) return ((parseFloat(hsl[1]) % 360) + 360) % 360;
  const hex = /^#?([0-9a-f]{6})$/i.exec(raw);
  if (hex) {
    const n = parseInt(hex[1], 16), r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
    if (!d) return null;
    let h;
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    return ((h % 360) + 360) % 360;
  }
  return null;
}
const rawAccent = (win, name) => String(win.getComputedStyle(win.document.documentElement).getPropertyValue(name) || '').trim();
// The hooks are part of the fix, so ask for them defensively: on a build without
// them the checks below have to FAIL, not crash the run.
const getTheme = (win) => (typeof win.__scGetTheme === 'function' ? win.__scGetTheme() : null);
function applyTheme(win, key) { if (typeof win.__scApplyTheme === 'function') win.__scApplyTheme(key); }
function hueDistance(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

(async () => {
  // ---------------------------------------------------------------------
  console.log('\n— RGB starts on the theme’s own hue, not on red —');
  // A very slow cycle keeps the hue effectively fixed, so the *starting* phase
  // is what gets measured (the old loop opened at hue 0 = red and hue 130 = green).
  let { dom, errors } = boot({ theme: 'rgb', speed: 3600, canvas: 'ok' });
  let win = dom.window;
  await wait(2500);

  ok('the app restored the RGB theme', getTheme(win) === 'rgb', String(getTheme(win)));
  ok('theme hooks are exposed for this suite', typeof win.__scApplyTheme === 'function');
  let h1 = accentHue(win, '--coral');
  let h2 = accentHue(win, '--gold');
  ok('the accent is the theme’s pink, not pure red', h1 !== null && hueDistance(h1, 325) <= 12,
     'coral=' + rawAccent(win, '--coral') + ' (hue ' + h1 + ')');
  ok('the second accent is the theme’s blue, not green', h2 !== null && hueDistance(h2, 205) <= 12,
     'gold=' + rawAccent(win, '--gold') + ' (hue ' + h2 + ')');
  ok('the two accents stay 120° apart like the theme pair', h1 !== null && h2 !== null && Math.abs(((h1 - h2 + 360) % 360) - 120) <= 2,
     'gap=' + ((h1 - h2 + 360) % 360));

  // Re-applying the theme restarts the cycle — the old build jumped straight back
  // to red/green here (this is the "the colour is completely off" path).
  applyTheme(win, 'rgb');
  await wait(500);
  const h1b = accentHue(win, '--coral');
  ok('restarting the cycle stays on the theme’s hue', h1b !== null && hueDistance(h1b, 325) <= 14,
     'coral=' + rawAccent(win, '--coral') + ' (hue ' + h1b + ')');
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— and it actually cycles —');
  ({ dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'ok' }));
  win = dom.window;
  await wait(2500);
  const samples = [];
  for (let i = 0; i < 7; i++) { samples.push(rawAccent(win, '--coral')); await wait(300); }
  const distinct = new Set(samples);
  ok('the accent colour keeps changing over time', distinct.size >= 4, samples.join(' → '));
  const hues = samples.map((s) => { const m = /^hsl\(\s*([-0-9.]+)/i.exec(s); return m ? parseFloat(m[1]) : null; });
  ok('every frame of the cycle is a real hue', hues.every((h) => h !== null), JSON.stringify(hues));
  const glowSamples = [];
  for (let i = 0; i < 4; i++) { glowSamples.push(rawAccent(win, '--glow-a')); await wait(300); }
  ok('the glow overlay cycles too', new Set(glowSamples).size >= 3, glowSamples.join(' → '));

  // RGB+ keeps the visible accents stable and only animates the glow.
  applyTheme(win, 'rgbplus');
  await wait(400);
  const plus1 = rawAccent(win, '--coral');
  const plusGlow1 = rawAccent(win, '--glow-a');
  await wait(600);
  const plus2 = rawAccent(win, '--coral');
  const plusGlow2 = rawAccent(win, '--glow-a');
  ok('RGB+ holds the accent steady', plus1 === plus2 && plus1 !== '', plus1 + ' vs ' + plus2);
  ok('RGB+ still animates the glow', plusGlow1 !== plusGlow2, plusGlow1 + ' vs ' + plusGlow2);

  // Leaving RGB releases the animated accents back to the static theme.
  applyTheme(win, 'coral');
  await wait(500);
  const back1 = rawAccent(win, '--coral');
  await wait(400);
  const back2 = rawAccent(win, '--coral');
  ok('switching away stops the cycle and restores the theme colour', back1 === back2 && /^#?ff6f59$/i.test(back1), back1 + ' vs ' + back2);
  // stopRgbAnimation removes the inline --glow-a/b the loop was writing; what is
  // left is the stylesheet's own fallback (a var()), never a frozen hsl() hue.
  ok('the animated glow values are cleaned up', !/^hsl\(/i.test(rawAccent(win, '--glow-a')), rawAccent(win, '--glow-a'));
  const unharmed = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors during the RGB session', unharmed.length === 0, unharmed.slice(0, 2).join(' | '));
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— a frame that throws can no longer kill the cycle —');
  // This is the reported bug: the favicon canvas redraw threw inside the hue
  // loop's frame, so the next frame was never scheduled and the accents froze.
  ({ dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'hostile' }));
  win = dom.window;
  await wait(2500);
  const hostile = [];
  for (let i = 0; i < 7; i++) { hostile.push(rawAccent(win, '--coral')); await wait(300); }
  ok('the cycle survives a failing favicon redraw', new Set(hostile).size >= 4, hostile.join(' → '));
  const hostileGlow = [];
  for (let i = 0; i < 4; i++) { hostileGlow.push(rawAccent(win, '--glow-a')); await wait(300); }
  ok('and the glow overlay keeps cycling', new Set(hostileGlow).size >= 3, hostileGlow.join(' → '));
  ok('the frozen-accent failure is gone (no stuck single hue)', new Set(hostile).size !== 1);
  dom.window.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
