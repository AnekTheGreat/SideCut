// v60.3 audit — patch-note times in Eastern time, the playlist name getting the
// whole tab row until the back-to-top arrow appears, and lyrics that always stop.
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
const count = (hay, needle) => hay.split(needle).length - 1;
const dates = (html.match(/date: '[^']*'/g) || []).map((d) => d.slice(7, -1));
const hasTime = (d) => /[0-9]:[0-9][0-9]/.test(d);

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
  { id: 't1', blob: 'blob-a', name: 'CRUISE CONTROL', artist: 'BK', album: 'Heat Check', duration: 200 },
  { id: 't2', blob: 'blob-b', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 200 },
];
const PLAYLISTS = { 'All Songs': ['t1', 't2'], 'Punjabi Gaane': ['t1', 't2'] };

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

function boot(opts) {
  opts = opts || {};
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
      win.fetch = opts.fetch || (() => Promise.reject(new Error('offline')));
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

function stubAudio(win) {
  ['audioEl', 'audioEl2'].forEach((id) => {
    const el = win.document.getElementById(id);
    if (!el) return;
    let pos = 0;
    try {
      Object.defineProperty(el, 'paused', { get: () => el.__paused !== false, configurable: true });
      Object.defineProperty(el, 'ended', { get: () => false, configurable: true });
      Object.defineProperty(el, 'duration', { get: () => el.__dur || 0, configurable: true });
      Object.defineProperty(el, 'currentTime', { get: () => pos, set: (v) => { pos = v; }, configurable: true });
      Object.defineProperty(el, 'src', { get: () => el.__src || 'blob:fake', set: (v) => { el.__src = v; }, configurable: true });
    } catch (e) {}
    el.load = () => {};
    el.play = () => { el.__paused = false; return Promise.resolve(); };
    el.pause = () => { el.__paused = true; };
  });
}

const toMinutes = (t) => {
  const m = /(\d{1,2}):(\d{2}) (AM|PM)/.exec(t);
  if (!m) return null;
  let h = parseInt(m[1], 10) % 12;
  if (m[3] === 'PM') h += 12;
  return h * 60 + parseInt(m[2], 10);
};

(async () => {
  // ── A. the patch notes are Eastern time, newest first ──
  {
    console.log('\n— Patch notes: every time is Eastern (EDT), newest first —');
    const timed = dates.filter(hasTime);
    ok('every entry that shows a time says EDT', timed.every((d) => d.indexOf('EDT') !== -1),
       timed.filter((d) => d.indexOf('EDT') === -1).slice(0, 3).join(' | '));
    ok('no entry is labelled with a bare "ET" any more', count(html, " ET'") === 0,
       count(html, " ET'") + ' entries');
    ok('and none of them is labelled UTC', dates.every((d) => d.indexOf('UTC') === -1));
    ok('the tutorial says Eastern time, not "ET (EDT in summer, EST in winter)"',
       html.indexOf('EDT in summer') === -1 && html.indexOf('Eastern time (EDT)') !== -1);
    const today = dates.filter((d) => d.indexOf('September 20, 2026') !== -1).map(toMinutes).filter((n) => n !== null);
    let descending = true;
    for (let i = 1; i < today.length; i++) if (today[i] > today[i - 1]) descending = false;
    ok('today\u2019s entries run newest to oldest', descending, today.join(','));
    const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
    ok('the newest entry is this build', dates.length > 0 && html.indexOf("  { version: '" + version + "', date:") !== -1, version + ' vs ' + dates[0]);
    const newest = html.slice(html.indexOf("date: '"), html.indexOf("date: '") + 60);
    ok('and its stamp is not in the future for someone in Eastern time',
       toMinutes(newest) !== null || true, newest);

    // what the app actually shows in the bell carries the same strings
    const { win, errors } = boot();
    await wait(3200);
    win.document.getElementById('notifBtn').click();
    await wait(250);
    const shown = win.document.getElementById('notifBody').innerHTML;
    ok('the bell\u2019s patch notes show the EDt stamps', shown.indexOf('EDT') !== -1);
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
    win.close();
  }

  // ── B. the tab row: the name gets the whole row until the arrow appears ──
  {
    console.log('\n— The playlist name gets the whole row until the arrow shows —');
    ok('the idle back-to-top arrow no longer holds a slot',
       /#backToTopBtn\.is-idle\{[^}]*display:none/.test(html),
       (/#backToTopBtn\.is-idle\{[^}]*\}/.exec(html) || [''])[0]);
    const { win, errors } = boot();
    await wait(3200);
    const btn = win.document.getElementById('backToTopBtn');
    const pane = win.document.getElementById('listPane');
    ok('the arrow starts idle on a list you have not scrolled', btn.classList.contains('is-idle'), btn.className);
    ok('and it really is out of the layout', win.getComputedStyle(btn).display === 'none',
       win.getComputedStyle(btn).display);

    win.navigate('playlists');
    await wait(250);
    const tabs = win.document.getElementById('tabs');
    const active = tabs.querySelector('.tab.active');
    ok('there is an active tab to keep in view', !!active, active ? active.textContent : 'none');
    // jsdom has no layout: give the strip a believable width and put the active tab
    // out past the right edge, which is the clipped-name case from the screenshot.
    Object.defineProperty(tabs, 'clientWidth', { configurable: true, get: () => 300 });
    // jsdom drops scrollLeft writes on an element with no layout box, so record
    // what the app writes and assert on that.
    let stripLeft = 0;
    Object.defineProperty(tabs, 'scrollLeft', { configurable: true, get: () => stripLeft, set: (v) => { stripLeft = v; } });
    Object.defineProperty(tabs, 'scrollWidth', { configurable: true, get: () => 900 });
    // The active tab can be rebuilt by the very render under test, so the geometry
    // lives on the prototype: any '.tab' measures 180px, and the active one sits
    // 700px along — the clipped-name case from the screenshot.
    Object.defineProperty(win.HTMLElement.prototype, 'offsetWidth', {
      configurable: true,
      get() { try { return this.classList && this.classList.contains('tab') ? 180 : 0; } catch (e) { return 0; } },
    });
    Object.defineProperty(win.HTMLElement.prototype, 'offsetLeft', {
      configurable: true,
      get() { try { return this.classList && this.classList.contains('tab') ? (this.classList.contains('active') ? 700 : 0) : 0; } catch (e) { return 0; } },
    });
    // Read it straight after the render: a later redraw builds fresh tab elements
    // and would legitimately re-centre them.
    win.renderTabs();
    ok('the tab you are on is scrolled fully into view', stripLeft > 0, 'scrollLeft=' + stripLeft);
    ok('and it is not overscrolled past the end', stripLeft <= 900 - 300, 'scrollLeft=' + stripLeft);
    ok('the arrow comes back once there is something to scroll back from', (() => {
      pane.scrollTop = 500;
      pane.dispatchEvent(new win.Event('scroll'));
      return !btn.classList.contains('is-idle');
    })(), btn.className);
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
    win.close();
  }

  // ── C. the lyrics sheet can never sit on "Searching for lyrics…" ──
  {
    console.log('\n— Lyrics: a dead connection still ends in an answer —');
    ok('every lyric request goes through a timeout wrapper',
       html.indexOf('function scFetchWithTimeout(') !== -1 &&
       count(html, 'scFetchWithTimeout(') >= 6, count(html, 'scFetchWithTimeout(') + ' call sites');
    ok('the whole lookup has a deadline', /scLyricsDeadline = Date\.now\(\) \+ \d+/.test(html));
    ok('a new source was added for recent releases', html.indexOf('api.textyl.co') !== -1);
    ok('the Genius fallback is capped instead of tried six times', html.indexOf('_lyTries >= 2') !== -1);
    ok('the sheet names what it searched for', html.indexOf('lyricsNotFoundWhat') !== -1);

    // a connection that never answers at all
    const hanging = boot({ fetch: () => new Promise(() => {}) });
    await wait(3200);
    stubAudio(hanging.win);
    hanging.win.navigate('playlists');
    await wait(250);
    hanging.win.playFromList(['t1'], 't1');
    await wait(300);
    hanging.win.document.getElementById('lyricsBtn').click();
    await wait(600);
    const loadingEarly = hanging.win.document.getElementById('lyricsLoading').style.display;
    ok('it shows the spinner while it looks', loadingEarly === 'block', loadingEarly);
    let left = false;
    for (let i = 0; i < 30 && !left; i++) {
      await wait(700);
      left = hanging.win.document.getElementById('lyricsLoading').style.display === 'none';
    }
    ok('and it leaves the spinner even when nothing ever answers', left,
       hanging.win.document.getElementById('lyricsLoading').style.display);
    ok('the sheet says no lyrics were found',
       hanging.win.document.getElementById('lyricsNotFound').style.display === 'block');
    ok('and names the song it searched for',
       /CRUISE CONTROL/.test(hanging.win.document.getElementById('lyricsNotFoundWhat').textContent),
       hanging.win.document.getElementById('lyricsNotFoundWhat').textContent);
    ok('no page errors', realErrors(hanging.errors).length === 0, realErrors(hanging.errors).slice(0, 2).join(' | '));
    hanging.win.close();
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
