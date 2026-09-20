// v60.1 audit — the batch shipped after v60:
//   • an available update is announced on boot and parked in the 🔔 bell
//   • "Read the whole thing" hands the user over to the bell's full patch notes
//   • a play only counts past the halfway point of a track (or a natural end)
//   • the tutorial gained step-by-step scenarios, and the summary says so
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const nativeUpdates = fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
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

// `blob` makes them look like real imported files: the player refuses to start a
// track whose audio file is missing, which would quietly skip every count below.
const TRACKS = [
  { id: 't1', blob: 'blob-a', name: 'Luna', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 200 },
  { id: 't2', blob: 'blob-b', name: 'Vibe', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 200 },
  { id: 't3', blob: 'blob-c', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 200 },
];
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3'], Favorites: [] };

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

function boot(metaSeed) {
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
      win.fetch = () => Promise.reject(new Error('offline'));
      win.URL.createObjectURL = () => 'blob:fake';
      win.URL.revokeObjectURL = () => {};
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const storedMeta = (idb, key) => { const m = idb._data.meta.get(key); return m ? m.value : undefined; };
const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);
const trackById = (win, id) => (win.__scGetAllTracks ? win.__scGetAllTracks() : []).find((t) => t.id === id);
const plays = (win, id) => { const t = trackById(win, id); return t ? (t.playCount || 0) : -1; };

// jsdom has no media pipeline: playback only starts if the elements can "play",
// and the halfway rule needs a drivable position, so both are stubbed here.
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
// Put both elements at a known position / length (the app reads whichever is active).
function setAudio(win, seconds, duration) {
  ['audioEl', 'audioEl2'].forEach((id) => {
    const el = win.document.getElementById(id);
    if (!el) return;
    el.__dur = duration;
    el.__paused = false;
    try { el.currentTime = seconds; } catch (e) {}
  });
}

(async () => {
  // ── A. an available update is announced on boot and lives in the bell ──
  {
    console.log('\n— Update available: announced on boot, parked in the bell —');
    const { win, idb, errors } = boot(null);
    await wait(3200);
    const badge = win.document.getElementById('notifBadge');
    win.document.getElementById('notifBtn').click();
    await wait(200);
    ok('a fresh boot has no update entry to offer', !win.document.getElementById('notifUpdateInstall'));
    win.document.getElementById('notifClose').click();
    await wait(150);
    win.dispatchEvent(new win.CustomEvent('sc-update-available', { detail: { version: '99.9.9', date: 'soon' } }));
    await wait(150);
    ok('the bell badges itself the moment the update is announced', badge.style.display === 'block', badge.style.display);
    ok('and the news is remembered across restarts', (storedMeta(idb, 'updateAvailable') || {}).version === '99.9.9',
       JSON.stringify(storedMeta(idb, 'updateAvailable')));
    win.document.getElementById('notifBtn').click();
    await wait(200);
    const install = win.document.getElementById('notifUpdateInstall');
    ok('the bell carries an Update available entry', !!install, install ? install.textContent : 'missing');
    ok('the entry names the version', /99\.9\.9/.test(win.document.getElementById('notifBody').innerHTML));
    ok('and offers Later', !!win.document.getElementById('notifUpdateLater'));
    if (win.document.getElementById('notifUpdateLater')) {
      win.document.getElementById('notifUpdateLater').click();
      await wait(150);
      ok('Later closes the bell but keeps the entry',
         win.document.getElementById('notifBackdrop').style.display === 'none' && !!storedMeta(idb, 'updateAvailable'));
    }
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));

    const b2 = boot({ updateAvailable: { version: '99.9.9', date: 'soon', at: Date.now() } });
    await wait(3200);
    ok('a remembered update still badges the bell after a restart',
       b2.win.document.getElementById('notifBadge').style.display === 'block');
    b2.win.document.getElementById('notifBtn').click();
    await wait(200);
    ok('and its entry is still there', !!b2.win.document.getElementById('notifUpdateInstall'));

    const b3 = boot({ updateAvailable: { version: '99.9.9', date: 'soon' } });
    await wait(3200);
    if (typeof b3.win.__scUpdateAvailable === 'function') b3.win.__scUpdateAvailable({ version: b3.win.APP_VERSION });
    else ok('the update notice hook exists', false, 'no __scUpdateAvailable');
    await wait(150);
    b3.win.document.getElementById('notifBtn').click();
    await wait(200);
    ok('a build we are already running is never offered', !b3.win.document.getElementById('notifUpdateInstall'));

    // Nothing new may run in the background for this.
    ok('the app adds no update timer of its own',
       !/setInterval\([^;]{0,140}(checkForUpdate|SideCutOTA)/i.test(html));
    const announcer = (nativeUpdates.match(/function announceAvailable\(man\)[\s\S]{0,700}?\n  \}/) || [''])[0];
    ok('the announcer only publishes what the check already found (no fetch, no timer, no audio)',
       announcer.length > 0 && !/fetch\(|setTimeout|setInterval|\.play\(/.test(announcer), announcer ? '' : 'no announceAvailable');
    ok('it is called on the available-update path', /announceAvailable\(man\);/.test(nativeUpdates));
  }

  // ── B. What's new → the bell's full patch notes ──
  {
    console.log('\n— What\'s new: "Read the whole thing" hands over to the bell —');
    const { win, idb } = boot({ lastSeenVersion: '1' });
    await wait(3200);
    const wn = win.document.getElementById('whatsNewBackdrop');
    ok('the what\'s-new popup shows on an upgrade', wn.style.display === 'flex', wn.style.display);
    const btn = win.document.getElementById('whatsNewExpandBtn');
    ok('its button reads "Read the whole thing"', /Read the whole thing/.test(btn.textContent), btn.textContent.trim());
    ok('and it says where the full notes live', /bell/i.test(win.document.body.innerHTML.split('whatsNewExpandBtn')[0].slice(-400)));
    btn.click();
    await wait(300);
    ok('the popup closes', wn.style.display === 'none', wn.style.display);
    ok('the notification bell opens instead',
       win.document.getElementById('notifBackdrop').style.display === 'flex');
    ok('landing on the full patch notes rather than the one-line summary',
       win.document.getElementById('notifBody').style.display === 'flex' &&
       win.document.getElementById('notifSummary').style.display === 'none');
    const bodyText = win.document.getElementById('notifBody').innerHTML;
    ok('the notes go back further than one version', (bodyText.match(/v\d/g) || []).length > 20, (bodyText.match(/v\d/g) || []).length + ' version markers');
    ok('and include the release you are on', bodyText.indexOf('v' + win.APP_VERSION.split('.')[0]) !== -1);
    ok('the cramped in-popup notes are gone', win.document.getElementById('whatsNewBody').style.display === 'none');
    ok('and the popup is marked seen so it stays gone', String(storedMeta(idb, 'lastSeenVersion')) === String(win.APP_VERSION),
       String(storedMeta(idb, 'lastSeenVersion')) + ' vs ' + win.APP_VERSION);
  }

  // ── C. a play only counts once the track has been heard ──
  {
    console.log('\n— Stats: a play counts past the halfway point, or a natural end —');
    const { win, idb, errors } = boot(null);
    await wait(3200);
    stubAudio(win);
    win.navigate('playlists');
    await wait(300);
    const rows = Array.from(win.document.querySelectorAll('#listPane .track[data-id]'));
    ok('there are rows to play', rows.length >= 2, String(rows.length));
    const firstId = rows[0] && rows[0].dataset.id;
    win.playFromList([firstId], firstId);
    await wait(600);
    ok('the song actually started', win.document.getElementById('npTitle').textContent === trackById(win, firstId).name,
       win.document.getElementById('npTitle').textContent);
    ok('starting a song does not count a play on its own', plays(win, firstId) === 0, 'playCount=' + plays(win, firstId));

    setAudio(win, 20, 200);         // 10% heard
    await wait(1300);
    ok('ten percent of the track still does not count', plays(win, firstId) === 0, 'playCount=' + plays(win, firstId));

    setAudio(win, 120, 200);        // 60% heard
    await wait(1300);
    ok('passing the halfway point counts exactly one play', plays(win, firstId) === 1, 'playCount=' + plays(win, firstId));

    await wait(1300);
    ok('and it never double-counts while the song keeps playing', plays(win, firstId) === 1, 'playCount=' + plays(win, firstId));

    const secondId = rows[1] && rows[1].dataset.id;
    win.playFromList([secondId], secondId);
    await wait(600);
    setAudio(win, 5, 200);
    ok('a freshly started song is uncounted', plays(win, secondId) === 0, 'playCount=' + plays(win, secondId));
    ['audioEl', 'audioEl2'].forEach((id) => {
      const el = win.document.getElementById(id);
      if (el) el.dispatchEvent(new win.Event('ended'));
    });
    await wait(250);
    ok('playing through to the end counts even before halfway', plays(win, secondId) === 1, 'playCount=' + plays(win, secondId));

    ok('total plays only counts the completed ones',
       ((storedMeta(idb, 'stats') || {}).totalPlays || 0) === 2, JSON.stringify(storedMeta(idb, 'stats')));
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
  }

  // ── D. the tutorial teaches it, and the summary carries it ──
  {
    console.log('\n— Tutorial: step-by-step scenarios, and a summary of them —');
    const { win } = boot(null);
    await wait(3200);
    const tut = win.document.getElementById('howToUseBackdrop').innerHTML;
    ok('the tutorial has a scenarios section', /Common scenarios, step by step/.test(tut));
    const scenarios = [
      'Get one song off Spotify into SideCut',
      'Make your own album from songs in different playlists',
      'Reorder songs in an album without misfiring',
      'Jump back to the song that\'s playing',
      'Back everything up, or move to a new phone',
      'Keep SideCut up to date without digging for it',
    ];
    scenarios.forEach((s) => ok('scenario: ' + s, tut.indexOf(s) !== -1));
    ok('the tutorial explains the halfway play rule', /halfway point/.test(tut));
    ok('and the 3-second album hold', /three seconds/.test(tut));
    const sum = win.document.getElementById('collapsibleTutorialSummaryContent').innerHTML;
    ok('the summary repeats the scenarios', /Scenario — backup/.test(sum));
    ok('the summary has the play rule', /halfway point/.test(sum));
    ok('the summary explains updates', /Update available/.test(sum));
    ok('the summary says albums are yours only', /Albums/.test(sum) && /picker/.test(sum));
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
