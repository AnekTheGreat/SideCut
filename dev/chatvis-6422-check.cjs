// 64.2.2's own surfaces, driven for real.
//
// Three of the six things this release changed only exist at runtime, so they are
// driven here against the shipped index.html rather than read out of it:
//
//   * the Home repaint must not hide the grid. 64.2.1's repaint set
//     visibility:hidden, forced a layout and restored it on the next frame - and a
//     phone can present that frame, which is the "the Favorites bubble disappears
//     for a split second and comes back" that was reported about it. The probe
//     records what the grid's inline style says at the moment each frame callback
//     runs, so a hidden frame is caught rather than argued about.
//   * the assistant's text colour must follow the accent. Every theme is applied
//     and the chosen colour has to be the better of white and near-black against
//     that theme's own accent - which is what "hard to see certain text" was.
//   * Watermark Remover has to come up switched on, and still switch off.
//
//   node dev/chatvis-6422-check.cjs
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 64, height: 64 };
      if (p === 'createLinearGradient' || p === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (p === 'createPattern') return () => ({});
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
  { id: 't3', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 210 },
];
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], Favorites: ['t1'], 'Punjabi Gaane': ['t1'] };

function fakeIndexedDB() {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
    ]),
  };
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
      setTimeout(() => {
        try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {}
        req.result = db;
        try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {}
      }, 0);
      return req;
    },
  };
}

function boot() {
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const idb = fakeIndexedDB();
  const dom = new JSDOM(html, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/',
    virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = idb;
      win.confirm = () => true;
      win.localStorage.clear();
      win.fetch = () => Promise.reject(new Error('offline'));
      // jsdom has no StorageManager. The app asks for persistence and reads the
      // allowance at boot, so both are answered here as well as at the point the
      // panel is rendered below.
      try {
        Object.defineProperty(win.navigator, 'storage', {
          configurable: true,
          value: {
            persist: () => Promise.resolve(false),
            persisted: () => Promise.resolve(false),
            estimate: () => Promise.resolve({ usage: 3435973836, quota: 14173392076 }),
          },
        });
      } catch (e) {}
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
const kinds = (win) => Array.from(win.document.querySelectorAll('#homeBubbles .home-bubble')).map((b) => b.dataset.bubble);
const settle = async (win) => {
  win.document.getElementById('homeView').dispatchEvent(new win.Event('scroll'));
  await wait(420);
};

// ---- the colour maths the release's own decision is checked against ---------
function lum(hexStr) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hexStr).trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
function ratio(a, b) {
  const la = lum(a), lb = lum(b);
  if (la === null || lb === null) return null;
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Every classic theme's key, plus the animated ones. A theme the app has since
// renamed simply falls back to Coral, which the accent check then reads off the
// live --coral value anyway.
const THEMES = ['coral', 'rosegold', 'royal', 'blue', 'gold', 'emerald', 'sunset', 'mono', 'purple',
  'crimson', 'teal', 'forest', 'midnight', 'liquidglass', 'rgb', 'rgbplus',
  'aurora', 'synthwave', 'ocean', 'ember', 'galaxy', 'cyberpunk', 'glacier'];

(async () => {
  const { win, errors } = boot();
  await wait(3200);
  const doc = win.document;
  const rootStyle = doc.documentElement.style;
  const grid = doc.getElementById('homeBubbles');
  const home = doc.getElementById('homeView');

  console.log('\n— a settled scroll never hides the grid, and no longer re-rasters a healthy one —');
  {
    ok('Home is rendered', !!grid && kinds(win).length > 0, kinds(win).join(','));
    // Record the grid's inline style at the moment each frame callback runs: a
    // hide-and-restore repaint is still "hidden" at that point, so this is where
    // the flash 64.2.1 could show up.
    const frames = [];
    const raf = win.requestAnimationFrame.bind(win);
    win.requestAnimationFrame = function (cb) {
      return raf(function (t) {
        frames.push({ v: grid.style.visibility, t: grid.style.transform });
        cb(t);
      });
    };
    await settle(win);
    const hidden = frames.filter((f) => f.v && f.v !== 'visible');
    ok('no frame of the repaint was ever hidden', hidden.length === 0, JSON.stringify(hidden.slice(0, 3)));
    ok('and a healthy grid is not re-rastered at all', !frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));
    ok('and left nothing promoted behind', !grid.style.transform, grid.style.transform);
    ok('nor an inline visibility', !grid.style.visibility, grid.style.visibility);
    // And the guard still repairs, which is why it is still there at all.
    const fav = grid.querySelector('.home-bubble[data-bubble="favorites"]');
    fav.parentNode.removeChild(fav);
    await settle(win);
    ok('a grid that lost a bubble is still drawn again', !!grid.querySelector('.home-bubble[data-bubble="favorites"]'));
    // ... and a bubble left holding what a drag gives it is the other kind of
    // damage, which is the one the fresh raster is for.
    const b = grid.querySelector('.home-bubble[data-bubble="notifications"]');
    b.classList.add('hb-dragging');
    b.style.position = 'fixed';
    b.style.transform = 'translate(0px, 0px) scale(1.05)';
    const dragFrames = [];
    win.requestAnimationFrame = function (cb) {
      return raf(function (t) {
        dragFrames.push({ t: grid.style.transform });
        cb(t);
      });
    };
    await settle(win);
    win.requestAnimationFrame = raf;
    ok('the drag carry is cleared', !!b && !b.classList.contains('hb-dragging'));
    ok('and that grid really was rastered again', dragFrames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(dragFrames.slice(0, 3)));
  }

  console.log('\n— the assistant\'s text has usable contrast in every theme —');
  {
    const worst = [];
    let checked = 0, animated = 0;
    for (const key of THEMES) {
      try { win.__scApplyTheme(key); } catch (e) { continue; }
      const accent = rootStyle.getPropertyValue('--coral').trim();
      const onAccent = rootStyle.getPropertyValue('--on-coral').trim().toLowerCase();
      if (!accent || !onAccent) { worst.push(key + ': no pair'); continue; }
      if (onAccent !== '#141414' && onAccent !== '#ffffff') { worst.push(key + ': ' + onAccent + ' is not one of the pair'); continue; }
      if (!/^#/.test(accent)) {
        // The RGB themes write an hsl() accent that moves every step, so there is
        // no single ratio to check here - only that a real choice was made, which
        // the two lines above already did.
        animated++;
        continue;
      }
      const dark = ratio('#141414', accent), white = ratio('#ffffff', accent);
      if (dark === null) continue;
      checked++;
      const wanted = dark >= white ? '#141414' : '#ffffff';
      if (onAccent !== wanted) worst.push(key + ': accent ' + accent + ' -> ' + onAccent + ' (wanted ' + wanted + ')');
    }
    ok('every fixed-accent theme was applied', checked >= 15, checked + ' themes');
    ok('and the animated ones were applied too', animated >= 2, animated);
    ok('the text on the accent is never the worse of the two', worst.length === 0, worst.slice(0, 3).join(' | '));
    win.__scApplyTheme('mono');
    ok('Monochrome (a near-white accent) gets dark text', rootStyle.getPropertyValue('--on-coral').trim() === '#141414',
      rootStyle.getPropertyValue('--coral') + ' -> ' + rootStyle.getPropertyValue('--on-coral'));
    win.__scApplyTheme('liquidglass');
    ok('and so does Liquid Glass', rootStyle.getPropertyValue('--on-coral').trim() === '#141414');
    // There is no fixed answer for a mid-tone: whichever of the two a contrast
    // checker prefers is the one that has to come out, so this pins that a
    // saturated accent is not left on the weaker side.
    win.__scApplyTheme('crimson');
    ok('a saturated mid-tone accent gets the readable side too',
      ratio('#141414', rootStyle.getPropertyValue('--coral').trim()) >= ratio('#ffffff', rootStyle.getPropertyValue('--coral').trim())
        ? rootStyle.getPropertyValue('--on-coral').trim() === '#141414'
        : rootStyle.getPropertyValue('--on-coral').trim() === '#ffffff',
      rootStyle.getPropertyValue('--coral') + ' -> ' + rootStyle.getPropertyValue('--on-coral'));
    ok('the chat bubble asks for it rather than a hard white', html.indexOf('background:var(--coral); color:var(--on-coral,#fff)') !== -1);
    ok('and no accent-filled control is left on a hard white', html.indexOf('background:var(--coral); color:#fff') === -1);
  }

  console.log('\n— Storage says whose allowance it is showing —');
  {
    const body = doc.getElementById('storagePanelBody');
    ok('the phone reports an allowance to the panel', !!(win.navigator.storage && win.navigator.storage.estimate));
    try { await win.__scRenderStoragePanel(); } catch (e) { ok('the storage panel renders', false, '' + e.message); }
    const text = body ? body.textContent : '';
    ok('the allowance is attributed to the phone', /this phone allows the app/.test(text), text.slice(0, 160));
    ok('and the panel says the limit is not SideCut\'s', /limit of this phone rather than a SideCut one/.test(text));
    ok('while still naming what the app itself holds', /Your music/.test(text) && /Covers/.test(text));
  }

  console.log('\n— Watermark Remover is on out of the box —');
  {
    const toggle = doc.getElementById('watermarkEnabledToggle');
    const section = doc.getElementById('watermarkSection');
    ok('the switch reads On', !!toggle && toggle.textContent === 'On', toggle && toggle.textContent);
    ok('and its pattern box is open', !!section && section.style.display !== 'none', section && section.style.display);
    if (toggle) {
      toggle.dispatchEvent(new win.Event('click'));
      ok('it still switches off', toggle.textContent === 'Off', toggle.textContent);
      ok('and its box goes away with it', section.style.display === 'none');
      toggle.dispatchEvent(new win.Event('click'));
      ok('and back on', toggle.textContent === 'On');
    }
  }

  console.log('\n— nothing above threw —');
  {
    const errs = realErrors(errors);
    ok('no error was raised while all of that ran', errs.length === 0, errs.slice(0, 2).join(' | '));
  }

  console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
  process.exit(fail ? 1 : 0);
})();
