// RGB theme audit, v58.8.2: RGB must look animated — visibly.
//   • plain RGB cycles the VISIBLE accents (--coral/--gold), so buttons, borders,
//     rings and highlights move with the glow. That is what "RGB (animated)"
//     means, and what it did from v58.3 on; v58.8.1 left RGB looking like the
//     plain pink theme because only the invisible-to-RGB glow vars moved.
//   • the cycle opens on the theme's own pink (hue 325) and blue (hue 205) rather
//     than snapping to pure red/green (hue 0 / 130) on every start and restart.
//   • RGB+ keeps its stable accents (v57.4) and animates the glow overlays.
//   • the cycle can never freeze, even if the tab-icon canvas redraw throws.
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
const isHsl = (raw) => /^hsl\(/i.test(String(raw || '').trim());
const rawVar = (win, name) => String(win.getComputedStyle(win.document.documentElement).getPropertyValue(name) || '').trim();
// The hooks are part of the test surface, so ask for them defensively: without
// them the checks below have to FAIL rather than crash the run.
const getTheme = (win) => (typeof win.__scGetTheme === 'function' ? win.__scGetTheme() : null);
function applyTheme(win, key) { if (typeof win.__scApplyTheme === 'function') win.__scApplyTheme(key); }
function hueDistance(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }
const GAP = 240; // (gold - coral + 360) % 360 for the theme's pink(325) -> blue(205)

async function sample(win, ms, times) {
  const out = [];
  for (let i = 0; i < times; i++) {
    out.push({ coral: rawVar(win, '--coral'), gold: rawVar(win, '--gold'), glowA: rawVar(win, '--glow-a'), glowB: rawVar(win, '--glow-b') });
    await wait(ms);
  }
  return out;
}

(async () => {
  // ---------------------------------------------------------------------
  console.log('\n— plain RGB cycles the visible accents —');
  let { dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'ok' });
  let win = dom.window;
  await wait(2500);

  ok('the app restored the RGB theme', getTheme(win) === 'rgb', String(getTheme(win)));
  ok('theme hooks are exposed for this suite', typeof win.__scApplyTheme === 'function');

  const s = await sample(win, 300, 8);
  const coralHues = s.map((x) => hueOf(x.coral));
  const goldHues = s.map((x) => hueOf(x.gold));
  ok('the accent is a live hsl() colour while RGB runs', s.every((x) => isHsl(x.coral) && isHsl(x.gold)),
     s[0].coral + ' | ' + s[0].gold);
  ok('the accent keeps changing colour', new Set(coralHues).size >= 5, coralHues.join(' → '));
  ok('the second accent keeps changing with it', new Set(goldHues).size >= 5, goldHues.join(' → '));
  ok('the pair stays 120° apart the whole way round',
     s.every((x) => Math.abs((((hueOf(x.gold) - hueOf(x.coral)) + 360) % 360) - GAP) <= 3),
     s.map((x) => Math.round(((hueOf(x.gold) - hueOf(x.coral)) + 360) % 360)).join(','));
  // Sum the signed steps rather than comparing the ends: at this test speed the
  // samples wrap the whole wheel, so the last hue lands back near the first.
  let swept = 0;
  for (let i = 1; i < coralHues.length; i++) {
    let d = coralHues[i] - coralHues[i - 1];
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    swept += d;
  }
  ok('the accents actually sweep a wide arc of the wheel', Math.abs(swept) > 120, 'swept=' + swept.toFixed(1) + '°');
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— the cycle opens on the theme’s own pink and blue —');
  // Speed 3600s keeps the hue effectively fixed, so the *starting* phase is what is
  // measured. v58.8.1 opened at hue 0 (pure red) with the second accent at +130
  // (green) — colours that matched nothing on screen.
  ({ dom, errors } = boot({ theme: 'rgb', speed: 3600, canvas: 'ok' }));
  win = dom.window;
  await wait(2500);
  let c1 = hueOf(rawVar(win, '--coral')), c2 = hueOf(rawVar(win, '--gold'));
  let g1 = hueOf(rawVar(win, '--glow-a')), g2 = hueOf(rawVar(win, '--glow-b'));
  ok('the accent opens on the RGB theme’s pink', c1 !== null && hueDistance(c1, 325) <= 8, rawVar(win, '--coral') + ' (hue ' + c1 + ')');
  ok('the second accent opens on the theme’s blue', c2 !== null && hueDistance(c2, 205) <= 8, rawVar(win, '--gold') + ' (hue ' + c2 + ')');
  ok('it no longer opens on pure red', c1 !== null && hueDistance(c1, 0) > 20, 'hue ' + c1);
  ok('the second accent is no longer the old green', c2 !== null && hueDistance(c2, 130) > 20, 'hue ' + c2);
  ok('the glow opens on the same pair', g1 !== null && g2 !== null && hueDistance(g1, 325) <= 8 && hueDistance(g2, 205) <= 8,
     rawVar(win, '--glow-a') + ' | ' + rawVar(win, '--glow-b'));

  // Re-applying the theme restarts the cycle from that same phase, not from red.
  applyTheme(win, 'rgb');
  await wait(500);
  const rh = hueOf(rawVar(win, '--coral'));
  ok('restarting the cycle starts from the theme, not from red', rh !== null && hueDistance(rh, 325) <= 14, 'hue ' + rh);
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— the glow animates too, and RGB+ keeps stable accents —');
  ({ dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'ok' }));
  win = dom.window;
  await wait(2500);
  const g = await sample(win, 300, 6);
  ok('the glow keeps changing over time', new Set(g.map((x) => x.glowA)).size >= 4, g.map((x) => x.glowA).join(' → '));
  ok('every glow frame is a real hue', g.every((x) => hueOf(x.glowA) !== null), JSON.stringify(g.map((x) => x.glowA)));
  ok('the glow pair stays 120° apart', g.every((x) => Math.abs((((hueOf(x.glowB) - hueOf(x.glowA)) + 360) % 360) - GAP) <= 3),
     g.map((x) => Math.round(((hueOf(x.glowB) - hueOf(x.glowA)) + 360) % 360)).join(','));

  // RGB+ keeps stable accents (v57.4) and still animates the glow overlays.
  applyTheme(win, 'rgbplus');
  await wait(600);
  const p = await sample(win, 400, 4);
  ok('RGB+ holds the accent steady', new Set(p.map((x) => x.coral)).size === 1 && p[0].coral !== '', p.map((x) => x.coral).join(' → '));
  ok('RGB+ still animates the glow', new Set(p.map((x) => x.glowA)).size >= 3, p.map((x) => x.glowA).join(' → '));

  // Leaving RGB releases the animated values back to the static theme.
  applyTheme(win, 'coral');
  await wait(600);
  const back = await sample(win, 400, 3);
  ok('switching away restores the theme colour and stops the cycle',
     new Set(back.map((x) => x.coral)).size === 1 && /^#?ff6f59$/i.test(back[0].coral), back.map((x) => x.coral).join(' → '));
  ok('the animated glow values are cleaned up', !isHsl(rawVar(win, '--glow-a')), rawVar(win, '--glow-a'));
  const unharmed = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors during the RGB session', unharmed.length === 0, unharmed.slice(0, 2).join(' | '));
  dom.window.close();

  // ---------------------------------------------------------------------
  console.log('\n— a frame that throws can no longer kill the cycle —');
  // The reported freeze: the tab-icon redraw threw inside the hue loop's frame, the
  // next frame was never scheduled, and the accents stuck on one hue for the rest
  // of the session — which is "the colour is completely off and it doesn't cycle".
  ({ dom, errors } = boot({ theme: 'rgb', speed: 2, canvas: 'hostile' }));
  win = dom.window;
  await wait(2500);
  const h = await sample(win, 300, 8);
  ok('the cycle survives a failing favicon redraw', new Set(h.map((x) => x.glowA)).size >= 4, h.map((x) => x.glowA).join(' → '));
  ok('and the accents keep moving too', new Set(h.map((x) => x.coral)).size >= 4, h.map((x) => x.coral).join(' → '));
  ok('the frozen-hue failure is gone', new Set(h.map((x) => x.coral)).size !== 1, 'distinct=' + new Set(h.map((x) => x.coral)).size);
  const hur = errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
  ok('no page errors with the hostile canvas either', hur.length === 0, hur.slice(0, 2).join(' | '));
  dom.window.close();

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
