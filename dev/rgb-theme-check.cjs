// RGB theme audit, v58.8.1: RGB must behave EXACTLY as it did before v58.
//   • the glow vars (--glow-a/--glow-b) cycle, starting on the pre-v58 phase
//   • the theme's own visible accents (--coral/--gold) are NOT repainted — v58.3
//     cycled them, which turned every button, border, ring and highlight into a
//     random rainbow colour ("the RGB colour is completely off")
//   • the cycle can never freeze, even if the tab-icon canvas redraw throws
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

function hueOf(raw) {
  const s = String(raw || '').trim();
  const hsl = /^hsl\(\s*([-0-9.]+)/i.exec(s);
  if (hsl) return ((parseFloat(hsl[1]) % 360) + 360) % 360;
  const hex = /^#?([0-9a-f]{6})$/i.exec(s);
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
const rawVar = (win, name) => String(win.getComputedStyle(win.document.documentElement).getPropertyValue(name) || '').trim();
// The hooks are part of the test surface, so ask for them defensively: without
// them the checks below have to FAIL rather than crash the run.
const getTheme = (win) => (typeof win.__scGetTheme === 'function' ? win.__scGetTheme() : null);
function applyTheme(win, key) { if (typeof win.__scApplyTheme === 'function') win.__scApplyTheme(key); }
function hueDistance(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

(async () => {
  // ---------------------------------------------------------------------
  console.log('\n— the visible accents are the theme’s own, and they never move —');
  // v58.3 cycled --coral/--gold, so the entire UI (buttons, borders, rings,
  // highlights) drifted through the rainbow while you looked at it.
  let { dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'ok' });
  let win = dom.window;
  await wait(2500);

  ok('the app restored the RGB theme', getTheme(win) === 'rgb', String(getTheme(win)));
  ok('theme hooks are exposed for this suite', typeof win.__scApplyTheme === 'function');
  const coral0 = rawVar(win, '--coral'), gold0 = rawVar(win, '--gold');
  const coralHue = hueOf(coral0), goldHue = hueOf(gold0);
  ok('the accent is the RGB theme’s pink', coralHue !== null && hueDistance(coralHue, 325) <= 12,
     'coral=' + coral0 + ' (hue ' + coralHue + ')');
  ok('the second accent is the theme’s blue', goldHue !== null && hueDistance(goldHue, 205) <= 12,
     'gold=' + gold0 + ' (hue ' + goldHue + ')');
  ok('the two accents sit the theme’s 120° apart', coralHue !== null && goldHue !== null && Math.abs(((coralHue - goldHue + 360) % 360) - 120) <= 2,
     'gap=' + ((coralHue - goldHue + 360) % 360));

  const coralSamples = [], goldSamples = [];
  for (let i = 0; i < 6; i++) { coralSamples.push(rawVar(win, '--coral')); goldSamples.push(rawVar(win, '--gold')); await wait(300); }
  ok('the accent colour stays put while the cycle runs', new Set(coralSamples).size === 1 && new Set(goldSamples).size === 1,
     coralSamples.join(' → ') + ' | ' + goldSamples.join(' → '));
  ok('neither accent is being turned into a hsl() hue', !/^hsl\(/i.test(coral0) && !/^hsl\(/i.test(gold0),
     coral0 + ' | ' + gold0);
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— the glow is what cycles, from the pre-v58 starting phase —');
  // Speed 3600s keeps the hue effectively fixed, so the *starting* phase is what is
  // measured. Pre-v58 the cycle opened at hue 0 with the second accent at +130.
  ({ dom, errors } = boot({ theme: 'rgb', speed: 3600, canvas: 'ok' }));
  win = dom.window;
  await wait(2500);
  let g1 = hueOf(rawVar(win, '--glow-a')), g2 = hueOf(rawVar(win, '--glow-b'));
  ok('the glow opens on the pre-v58 starting hue', g1 !== null && hueDistance(g1, 0) <= 8, 'glow-a=' + rawVar(win, '--glow-a') + ' (hue ' + g1 + ')');
  ok('the second glow sits 130° ahead, as it did before v58', g1 !== null && g2 !== null && Math.abs(((g2 - g1 + 360) % 360) - 130) <= 2,
     'gap=' + ((g2 - g1 + 360) % 360));
  // Re-applying the theme restarts the cycle from the same phase.
  applyTheme(win, 'rgb');
  await wait(400);
  const restartHue = hueOf(rawVar(win, '--glow-a'));
  ok('restarting the cycle starts from that same phase', restartHue !== null && hueDistance(restartHue, 0) <= 12, 'hue ' + restartHue);
  dom.window.close();

  ({ dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'ok' }));
  win = dom.window;
  await wait(2500);
  const glowSamples = [];
  for (let i = 0; i < 8; i++) { glowSamples.push(rawVar(win, '--glow-a')); await wait(300); }
  ok('the glow keeps changing over time', new Set(glowSamples).size >= 4, glowSamples.join(' → '));
  ok('every frame is a real hue', glowSamples.every((s) => hueOf(s) !== null), JSON.stringify(glowSamples));
  const gapSamples = [];
  for (let i = 0; i < 4; i++) {
    const a = hueOf(rawVar(win, '--glow-a')), b = hueOf(rawVar(win, '--glow-b'));
    if (a !== null && b !== null) gapSamples.push(Math.round((b - a + 360) % 360));
    await wait(300);
  }
  ok('the pair stays 130° apart all the way round', gapSamples.length > 0 && gapSamples.every((g) => g === 130), JSON.stringify(gapSamples));

  // RGB+ keeps its stable accents and still animates the glow.
  applyTheme(win, 'rgbplus');
  await wait(400);
  const plus1 = rawVar(win, '--coral'), plusGlow1 = rawVar(win, '--glow-a');
  await wait(600);
  const plus2 = rawVar(win, '--coral'), plusGlow2 = rawVar(win, '--glow-a');
  ok('RGB+ holds the accent steady', plus1 === plus2 && plus1 !== '', plus1 + ' vs ' + plus2);
  ok('RGB+ still animates the glow', plusGlow1 !== plusGlow2, plusGlow1 + ' vs ' + plusGlow2);

  // Leaving RGB releases the animated glow back to the static theme.
  applyTheme(win, 'coral');
  await wait(500);
  const back1 = rawVar(win, '--coral');
  await wait(400);
  const back2 = rawVar(win, '--coral');
  ok('switching away restores the theme colour and stops the cycle', back1 === back2 && /^#?ff6f59$/i.test(back1), back1 + ' vs ' + back2);
  ok('the animated glow values are cleaned up', !/^hsl\(/i.test(rawVar(win, '--glow-a')), rawVar(win, '--glow-a'));
  const unharmed = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors during the RGB session', unharmed.length === 0, unharmed.slice(0, 2).join(' | '));
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— a frame that throws can no longer kill the cycle —');
  // The reported freeze: the tab-icon redraw threw inside the hue loop's frame, the
  // next frame was never scheduled, and the accents stuck on one hue for the rest
  // of the session.
  ({ dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'hostile' }));
  win = dom.window;
  await wait(2500);
  const hostile = [], hostileCoral = [];
  for (let i = 0; i < 8; i++) { hostile.push(rawVar(win, '--glow-a')); hostileCoral.push(rawVar(win, '--coral')); await wait(300); }
  ok('the cycle survives a failing favicon redraw', new Set(hostile).size >= 4, hostile.join(' → '));
  ok('and the accent still never moves', new Set(hostileCoral).size === 1, hostileCoral.join(' → '));
  ok('the frozen-hue failure is gone', new Set(hostile).size !== 1, 'distinct=' + new Set(hostile).size);
  const hur = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors with the hostile canvas either', hur.length === 0, hur.slice(0, 2).join(' | '));
  dom.window.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
