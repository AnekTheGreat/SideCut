// v60.4 audit — the foreground drain.
//
// What a phone was doing for every minute SideCut spent on screen:
//   • the display was held at its highest rate by an explicit
//     screen.requestFrameRate() request, so an adaptive panel never dropped
//     between frames;
//   • the RGB and RGB + cycles ran on requestAnimationFrame, i.e. a frame every
//     vsync, 60–120 a second, for as long as the theme was selected;
//   • the RGB + glow loop re-requested a frame at the same rate for a glow that
//     updates 20 times a second;
//   • the tab icon was redrawn (canvas + PNG encode) five times a second.
//
// The checks below assert each one is gone, and measure the cheap thing that
// replaced it — counting real requestAnimationFrame callbacks and real
// toDataURL() encodes over a live second of the booted app.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (hay, needle) => hay.split(needle).length - 1;
// Versions are read through the app's own legacy map (60.1–60.4.1 were renumbered
// behind the second decimal, and 60.4.2 is a bridge release carrying that same
// code under an old-style number), so "this build or anything newer" holds as the
// number keeps moving for OTA delivery.
// The map as it stands: 60.1 is the current line and 60.2 – 60.4 are the numbers
// still to come, so none of them may be rewritten.
const LEGACY = { '60.4.1': '60.0.6', '60.4.2': '60.0.8' };
function versionAtLeast(v, min) {
  const a = String(LEGACY[v] || v).split('.'), b = String(min).split('.');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = parseInt(a[i] || '0', 10), y = parseInt(b[i] || '0', 10);
    if (x !== y) return x > y;
  }
  return true;
}

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const region = (from, to) => {
  const a = html.indexOf(from), b = html.indexOf(to);
  return (a === -1 || b === -1 || b < a) ? '' : html.slice(a, b);
};
// A region with its comments stripped: these boxes are heavily commented, and the
// comments talk about the frame loops that were removed — only real calls count.
const code = (s) => s.replace(/\/\/[^\n]*/g, '');
// The RGB cycle, from its own declarations up to the refresh-rate setting.
const rgbRegion = () => code(region('let rgbAnimHandle = null;', 'const REFRESH_RATE_CHOICES'));
// The RGB + glow loop, from stopGlowSync through startGlowSync up to applyTheme.
const glowRegion = () => code(region('function stopGlowSync(){', 'function applyTheme(key){'));
// The whole glow surface, including the analyser interval above it.
const glowAll = () => code(region('let glowLoopHandle = null;', 'function applyTheme(key){'));

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
];
const PLAYLISTS = { 'All Songs': ['t1', 't2'], Favorites: [] };

function fakeIndexedDB(metaSeed) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: {} }],
      ...Object.entries(metaSeed || {}).map(([k, v]) => [k, { key: k, value: v }]),
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

// opts.frameRateRequests — collects every screen.requestFrameRate(hz) the page makes,
// including the one the boot does while restoring settings.
function boot(metaSeed, opts) {
  opts = opts || {};
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const idb = fakeIndexedDB(metaSeed);
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
      if (opts.premium) win.localStorage.setItem('sidecut_premium', JSON.stringify({ active: true, code: 'TEST', unlockedAt: Date.now() }));
      win.fetch = () => Promise.reject(new Error('offline'));
      if (opts.frameRateRequests) {
        try {
          Object.defineProperty(win.screen, 'requestFrameRate', {
            configurable: true,
            get() {
              return function (hz) { opts.frameRateRequests.push(hz); return Promise.resolve({ refreshRate: hz }); };
            },
          });
        } catch (e) { opts.frameRateSpyFailed = String(e && e.message); }
      }
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

// Count actual frame callbacks and actual favicon encodes over a real window of time.
function instrument(win) {
  const stats = { frames: 0, encodes: 0 };
  const origRaf = win.requestAnimationFrame;
  win.requestAnimationFrame = function (cb) { stats.frames++; return origRaf.call(win, cb); };
  const origEncode = win.HTMLCanvasElement.prototype.toDataURL;
  win.HTMLCanvasElement.prototype.toDataURL = function (...a) { stats.encodes++; return origEncode.apply(this, a); };
  return stats;
}

const rawVar = (win, name) => win.document.documentElement.style.getPropertyValue(name);

(async () => {
  // ── A. the build carries the fix and says so ──
  {
    console.log('\n— v60.4 is the build, and the notes explain it —');
    // This build is the one the notes call 60.0.5 (was 60.4 before everything
    // after 60.0.1 was renumbered behind the second decimal); the follow-up fix
    // on top of it ships as 60.0.6, so either number means this audit's code.
    // This audit's code shipped as 60.0.5 (was 60.4); every release after it just
    // moves the number for the OTA.
    ok('the app version is the 60.4 build (now numbered 60.0.5 or later)',
       versionAtLeast(version, '60.0.5'), version);
    ok('the service worker cache moved with it', sw.indexOf('sidecut-shell-v' + version) !== -1,
       (sw.match(/sidecut-shell-v[^']+/) || [])[0]);
    const entry = html.slice(html.indexOf("  { version: '60.0.5', date: '"));
    ok('there is a 60.4 (60.0.5) patch-note entry', html.indexOf("  { version: '60.0.5', date: '") !== -1);
    ok('and it is stamped in Eastern time', /version: '60\.0\.[56]', date: '[^']*EDT'/.test(html),
       (html.match(/version: '60\.0\.[56]', date: '[^']*'/) || [])[0]);
    ok('the notes name the refresh-rate pin', entry.indexOf('requestFrameRate') !== -1 || entry.indexOf('refresh') !== -1);
    ok('and the frame loops', /frame loop/.test(entry.slice(0, 2600)));
  }

  // ── B. nothing drives the cycle from frames any more ──
  {
    console.log('\n— RGB: one timer, and no frame loop behind it —');
    ok('the cycle is scheduled by the interval itself', /rgbAnimHandle = setInterval\(rgbTick, RGB_TICK_MS\)/.test(html));
    ok('the tick rate is the ~10/s the step rule allowed', /const RGB_TICK_MS = 100;/.test(html));
    ok('there is no animation frame anywhere in the cycle',
       rgbRegion().indexOf('requestAnimationFrame') === -1,
       rgbRegion().indexOf('requestAnimationFrame') !== -1 ? 'still calls requestAnimationFrame' : '');
    ok('and nothing is left to cancel a frame with',
       !/rgbRafHandle/.test(html) && !/rgbLastFrameAt/.test(html) && !/rgbFrameLoop/.test(html));
    ok('the visible-step rule still keeps useless repaints out',
       /rgbLastAppliedHue !== null && Math\.abs\(hueNow - rgbLastAppliedHue\) < 0\.7/.test(html) &&
       /nowMs - rgbLastApplyAt < 90/.test(html));
    ok('the cycle still refuses to run while the app is hidden', /if\(document\.hidden\) return;/.test(rgbRegion()));
    ok('and coming back still re-arms it', /document\.addEventListener\('visibilitychange', rgbReassert\)/.test(html));
  }

  // ── C. the glow loop is a timer with a floor ──
  {
    console.log('\n— RGB +: the glow loop is a timer, not a frame loop —');
    const g = glowRegion();
    ok('the glow loop was found in the source', g.length > 500, String(g.length));
    ok('it schedules itself with setTimeout', /glowLoopHandle = setTimeout\(tick, 50\)/.test(g));
    ok('no animation frame is left anywhere in it',
       glowAll().indexOf('requestAnimationFrame') === -1,
       'still calls requestAnimationFrame');
    ok('and nothing can cancel one either', glowAll().indexOf('cancelAnimationFrame') === -1);
    ok('stopping it clears the timer instead', /clearTimeout\(glowLoopHandle\)/.test(g));
    ok('it drops to four checks a second when the music is quiet', /setTimeout\(tick, 250\)/.test(g));
    ok('and does nothing at all while the app is off screen', /if\(document\.hidden\)\{ glowLoopHandle = setTimeout\(tick, 500\); return; \}/.test(g));
    ok('the idle CSS reset happens once, not on every idle tick', /if\(!idleApplied\)/.test(g));
  }

  // ── D. the display is not pinned ──
  {
    console.log('\n— the display rate: "max" asks for nothing, an explicit rate asks for that —');
    const maxBlock = region("if(refreshRate === 'max'){", "var hz = Number(refreshRate);");
    ok('the max branch is there', maxBlock.length > 0);
    ok('and it makes no request at all', maxBlock.indexOf('requestRate.call') === -1, maxBlock.slice(0, 120));
    ok('nothing else in it asks the display for a rate', maxBlock.indexOf('requestFrameRate') === -1);
    ok('an explicit rate still requests exactly that rate', /Promise\.resolve\(requestRate\.call\(window\.screen, hz\)\)/.test(html));
    ok('the picker still offers every explicit rate', /'240', '240 Hz'/.test(html));

    const requests = [];
    const { win, errors } = boot({ refreshRate: 'max', theme: 'coral' }, { frameRateRequests: requests });
    await wait(2600);
    ok('booting on "max" never asks the display for a rate', requests.length === 0, JSON.stringify(requests));
    ok('no page errors while booting on max', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));

    // The picker lives inside Settings, and the internals of the app script are
    // private (only a few things are hung on window), so the explicit-rate path is
    // exercised the way a user gets there: the saved setting the boot restores.
    const explicit = [];
    const { errors: errs2 } = boot({ refreshRate: '120', theme: 'coral' }, { frameRateRequests: explicit });
    await wait(2600);
    ok('booting on an explicit 120 Hz does request exactly 120',
       explicit.length === 1 && Number(explicit[0]) === 120, JSON.stringify(explicit));
    ok('no page errors while booting on 120', realErrors(errs2).length === 0, realErrors(errs2).slice(0, 2).join(' | '));
    ok('and the picker still wires a change straight to the request',
       /btn\.dataset\.rate;\s*dbPut\('meta', \{ key: 'refreshRate', value: refreshRate \}\);\s*applyDeviceRefreshRate\(\);/.test(html));
  }

  // ── E. the tab icon ──
  {
    console.log('\n— the tab icon: once a second, never in the background —');
    ok('the redraw is throttled to a second', /if\(now - lastFaviconUpdate < 1000\) return;/.test(html));
    ok('and skipped entirely while the app is hidden',
       /function maybeUpdateFavicon\(now\)\{[\s\S]{0,600}?if\(document\.hidden\) return;/.test(html));
  }

  // ── F. live: what the app actually does in a second ──
  {
    console.log('\n— live: a second of the RGB theme on screen —');
    const { win, errors } = boot({ theme: 'rgb', rgbSpeedSec: 8 }, {});
    await wait(3000);
    const stats = instrument(win);
    const before = rawVar(win, '--coral');
    await wait(1500);
    const after = rawVar(win, '--coral');

    ok('the accents are a live colour', /^hsl\(/.test(before), before);
    ok('and they still move — the theme pulse is not the thing that was cut', before !== after, before + ' -> ' + after);
    // The old frame loop produced one callback per vsync (60/s, ~90 in 1.5s). A
    // timer-driven cycle produces none at all on its own.
    ok('the cycle requests (almost) no frames at all', stats.frames <= 10,
       stats.frames + ' frame callbacks in 1.5s');
    ok('the tab icon is encoded about once a second, not five times',
       stats.encodes <= 3, stats.encodes + ' PNG encodes in 1.5s');
    ok('no page errors during the RGB second', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
  }

  // ── G. live: an RGB + boot with the app on screen ──
  {
    console.log('\n— live: an RGB + boot, one second of it —');
    const { win, errors } = boot({ theme: 'rgbplus', rgbSpeedSec: 8 }, {});
    await wait(3000);
    const stats = instrument(win);
    const a = rawVar(win, '--coral');
    await wait(1500);
    const b = rawVar(win, '--coral');
    ok('the RGB + accents still cycle', /^hsl\(/.test(a) && a !== b, a + ' -> ' + b);
    ok('and the booted app asks for no frames of its own on top of them', stats.frames <= 10,
       stats.frames + ' frame callbacks in 1.5s');
    ok('no page errors in the RGB + second', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
  }

  // ── H. the published bundle is this build ──
  {
    console.log('\n— the OTA bundle published with it —');
    let rootMan = null, otaMan = null;
    try { rootMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'updates.json'), 'utf8')); } catch (e) {}
    try { otaMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8')); } catch (e) {}
    ok('ota/updates.json exists', !!otaMan);
    ok('it names this version', otaMan && String(otaMan.version) === version, otaMan && otaMan.version);
    ok('it carries patch notes', otaMan && Array.isArray(otaMan.notes) && otaMan.notes.length > 0,
       otaMan ? String(otaMan.notes && otaMan.notes.length) : '');
    ok('the root manifest was kept in step', rootMan && String(rootMan.version) === version,
       rootMan && rootMan.version);
    let zipSize = 0;
    try { zipSize = fs.statSync(path.join(ROOT, 'ota/update.zip')).size; } catch (e) {}
    ok('and the manifest size matches the bundle', otaMan && otaMan.size === zipSize,
       (otaMan && otaMan.size) + ' vs ' + zipSize);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
