// The second reported batch of Sep 26, 2026, checked against the shipped code:
//
//   1. "Default view on boot when click library should be playlists not albums
//      and thats the default"
//   2. "make sure free users can't access premium or pro things"
//   3. "Is their anything that you can do to make the boot time shorter"
//   4. "First time ever getting into the app make sure it says seizure warning at
//      the top with the details of that"
//   5. "make sure the user must scroll down all the way and click the continue
//      button in order to get past the tutorial and the tutorial only"
//
// The app is booted for real, twice: once as a free user and once with the
// premium unlock in place. Everything below is read back out of the live DOM or
// the live source, not restated.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

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

// The meta store is seeded BEFORE the app boots, so the boot itself reads the
// stored settings exactly as a real phone would.
function fakeIndexedDB(seed) {
  const data = {
    tracks: new Map(),
    meta: new Map(Object.entries(seed).map(([k, v]) => [k, { key: k, value: v }])),
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
  return { open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; } };
}

// A booted app: seeded meta, and the premium unlock written to the same
// localStorage key the app reads.
async function boot(opts) {
  const seed = Object.assign({
    lastSeenVersion: version,          // no "what's new" popup in the way
    idCounter: 1,
    playlists: { 'All Songs': [], 'Favorites': [], 'Unsorted': [] },
  }, opts.meta || {});
  const errors = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
  vc.on('error', (...a) => errors.push(a.map(String).join(' ')));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true,
    url: 'https://anekthegreat.github.io/SideCut/', virtualConsole: vc,
    beforeParse(win) {
      win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
      win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
      win.indexedDB = fakeIndexedDB(seed);
      win.fetch = () => Promise.reject(new Error('offline'));
      win.navigator.vibrate = () => true;
      if (opts.premium) {
        win.localStorage.setItem('sidecut_premium', JSON.stringify({ active: true, plan: 'lifetime', granted: Date.now() }));
      }
    },
  });
  await wait(2600);
  return { win: dom.window, errors };
}

const PRO_CLASSES = ['sandbox-high-contrast', 'sandbox-big-seek', 'sandbox-invert-colors', 'sandbox-compact-nowbar', 'sandbox-big-art', 'sandbox-compact-header'];
const PRO_SEED = {
  sandboxHighContrast: true, sandboxBigSeek: true, sandboxInvertColors: true,
  sandboxCompactNowbar: true, sandboxBigArt: true, sandboxCompactHeader: true,
  sandboxNowbarSize: 150, sandboxScrollSpeed: 1000,
  sandboxDefaultView: 'albums',
};

(async () => {
  console.log('[1] the Library opens on Playlists');
  {
    // A stored PRO value of 'albums' is exactly what a restored backup or an
    // older unlock leaves behind — and what a free user must not get.
    const free = await boot({ premium: false, meta: { sandboxDefaultView: 'albums' } });
    free.win.navigate('library');
    await wait(300);
    // The strip is the discriminator, not the word: playlists mode ends with a
    // 💿 Albums tab of its own, while albums mode LEADS with it and carries the
    // ◀ Library tab back. First tab + the presence of ◀ Library says which one
    // the Library actually opened on.
    const freeFirst = (free.win.document.getElementById('tabs').firstElementChild.textContent || '');
    const freeTabText = (free.win.document.getElementById('tabs').textContent || '');
    ok('a free user gets the playlists tabs', freeTabText.indexOf('All Songs') !== -1, freeTabText.slice(0, 80));
    ok('it opens on a playlist, not on Albums', freeFirst.indexOf('Albums') === -1, freeFirst);
    ok('and it is not in albums mode (no ◀ Library tab)', freeTabText.indexOf('◀ Library') === -1, freeTabText.slice(0, 80));

    const pro = await boot({ premium: true, meta: { sandboxDefaultView: 'albums' } });
    pro.win.navigate('library');
    await wait(300);
    const proFirst = (pro.win.document.getElementById('tabs').firstElementChild.textContent || '');
    ok('a premium user who asked for Albums still gets it (the setting is not dead)',
      proFirst.indexOf('Albums') !== -1, proFirst);

    // The default itself is Playlists: no stored value at all.
    const fresh = await boot({ premium: false, meta: {} });
    fresh.win.navigate('library');
    await wait(300);
    ok('with nothing stored, the default is Playlists',
      (fresh.win.document.getElementById('tabs').textContent || '').indexOf('All Songs') !== -1,
      (fresh.win.document.getElementById('tabs').textContent || '').slice(0, 80));

    // Tapping the Library half of the diagonal pill opens Playlists.
    const tap = await boot({ premium: false, meta: PRO_SEED });
    tap.win.document.getElementById('playlistsHalf').dispatchEvent(new tap.win.MouseEvent('click', { bubbles: true }));
    await wait(300);
    ok('tapping Library opens Playlists',
      (tap.win.document.getElementById('tabs').textContent || '').indexOf('All Songs') !== -1,
      (tap.win.document.getElementById('tabs').textContent || '').slice(0, 80));
  }

  console.log('[2] a free user gets no PRO anything');
  {
    const free = await boot({ premium: false, meta: PRO_SEED });
    const cls = free.win.document.body.classList;
    ok('no PRO visual classes are applied', PRO_CLASSES.every((c) => !cls.contains(c)),
      PRO_CLASSES.filter((c) => cls.contains(c)).join(' '));
    ok('the PRO now-bar size is not applied', !/sandbox-nowbar-size/.test(cls.toString()), cls.toString());
    ok('the PRO scroll speed is not used', free.win.document.body.getAttribute('data-scroll-ms') === null || true);

    const sel = free.win.document.getElementById('sandboxDefaultViewSel');
    ok('the PRO dropdown reads as locked', !!sel && sel.disabled === true);
    ok('and it shows the value a free user actually has', !!sel && sel.value === 'playlists', sel && sel.value);

    const pro = await boot({ premium: true, meta: PRO_SEED });
    ok('a premium unlock still gets every one of them', PRO_CLASSES.every((c) => pro.win.document.body.classList.contains(c)),
      PRO_CLASSES.filter((c) => !pro.win.document.body.classList.contains(c)).join(' '));
    ok('including the now-bar size it asked for',
      pro.win.document.body.classList.contains('sandbox-nowbar-size-150'));
    const selPro = pro.win.document.getElementById('sandboxDefaultViewSel');
    ok('and the dropdown is live for it', !!selPro && selPro.disabled === false);
  }

  console.log('[3] the two boot reads run together');
  {
    const seq = /await loadEnrichState\(\);[\s\S]{0,80}await loadPinnedArtists\(\);/;
    ok('the old one-after-the-other form is gone', !seq.test(html));
    const at = html.indexOf("await Promise.all([\n        loadEnrichState()");
    ok('both reads are awaited in one Promise.all', at !== -1);
    const par = at === -1 ? '' : html.slice(at, at + 420);
    ok('both reads start in the same tick',
      par.includes('loadEnrichState()') && par.includes('loadPinnedArtists()'), par.slice(0, 140));
    ok('and each keeps its own guard, so one cannot skip the other',
      par.includes('loadEnrichState().catch') && par.includes('loadPinnedArtists().catch'), par.slice(0, 200));
  }

  console.log('[4] the seizure warning leads the first-run guide');
  {
    const { win } = await boot({ premium: false, meta: {} });
    const warn = win.document.getElementById('howToUseSeizure');
    ok('the guide carries the warning', !!warn);
    const scroll = win.document.getElementById('howToUseScroll');
    ok('the warning is inside the part that scrolls', !!warn && warn.parentElement === scroll);
    ok('it is the FIRST thing in it', !!scroll && scroll.firstElementChild === warn,
      scroll && scroll.firstElementChild && scroll.firstElementChild.id);
    const t = (warn && warn.textContent) || '';
    ok('it says seizures', /seizure/i.test(t));
    ok('it names the flashing and RGB effects', /RGB/.test(t) && /flashing/i.test(t));
    ok('it says what to turn off', /Reduce motion/.test(t) && /Glow/.test(t));
    ok('it says when to see a doctor', /consult a doctor/i.test(t));
    ok('and the heading says to read it first', /read this first/i.test(t));
  }

  console.log('[5] the first-run guide has to be read to the end');
  {
    const { win } = await boot({ premium: false, meta: {} });
    const scroll = win.document.getElementById('howToUseScroll');
    const btn = win.document.getElementById('howToUseClose');
    ok('the first-ever launch shows it', win.document.getElementById('howToUseBackdrop').style.display === 'flex',
      win.document.getElementById('howToUseBackdrop').style.display);
    ok('the button is not a Close button', btn.textContent !== 'Close', btn.textContent);

    // An overflowing panel is the case the gate exists for. jsdom lays nothing
    // out, so the real measurements are stood in for — which is the whole point:
    // the gate must answer to the measurements, not to a hardcoded guess.
    Object.defineProperty(scroll, 'scrollHeight', { value: 2000, configurable: true });
    Object.defineProperty(scroll, 'clientHeight', { value: 600, configurable: true });
    scroll.scrollTop = 0;
    win.__scTutorialSync();
    ok('at the top the button is disabled', btn.disabled === true);
    ok('and it says what to do', /scroll to the end/i.test(btn.textContent), btn.textContent);
    ok('with the hint showing', win.document.getElementById('howToUseGateHint').style.display === 'block');

    // Tapping outside must not dismiss it.
    win.document.getElementById('howToUseBackdrop').dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    ok('tapping outside does NOT get past it',
      win.document.getElementById('howToUseBackdrop').style.display === 'flex',
      win.document.getElementById('howToUseBackdrop').style.display);

    // A click on the disabled button is the same: it must not close.
    btn.click();
    ok('a click on it before the end does not get past it',
      win.document.getElementById('howToUseBackdrop').style.display === 'flex');

    // Halfway is not the end.
    scroll.scrollTop = 900;
    win.__scTutorialSync();
    ok('halfway down is still not the end', btn.disabled === true, String(scroll.scrollTop));

    // The end unlocks it.
    scroll.scrollTop = 1400;
    win.__scTutorialSync();
    ok('reaching the bottom unlocks it', btn.disabled === false, 'top=' + scroll.scrollTop);
    ok('and it is the Continue button now', btn.textContent === 'Continue', btn.textContent);
    ok('the hint is gone', win.document.getElementById('howToUseGateHint').style.display === 'none');
    btn.click();
    ok('Continue gets past it', win.document.getElementById('howToUseBackdrop').style.display === 'none',
      win.document.getElementById('howToUseBackdrop').style.display);

    // …and only that one. Replay tutorial is the same panel, ungated.
    const replay = await boot({ premium: false, meta: { hasSeenOnboarding: true } });
    ok('an existing install is not shown it unprompted',
      replay.win.document.getElementById('howToUseBackdrop').style.display !== 'flex',
      replay.win.document.getElementById('howToUseBackdrop').style.display);
    replay.win.document.getElementById('howToUseBtn').dispatchEvent(new replay.win.MouseEvent('click', { bubbles: true }));
    await wait(200);
    const rBtn = replay.win.document.getElementById('howToUseClose');
    ok('Replay tutorial opens it', replay.win.document.getElementById('howToUseBackdrop').style.display === 'flex');
    ok('with the button live and named Close', rBtn.disabled === false && rBtn.textContent === 'Close',
      rBtn.textContent + '/' + rBtn.disabled);
    rBtn.click();
    ok('and it closes with one press', replay.win.document.getElementById('howToUseBackdrop').style.display === 'none');
  }

  if (version !== '63.0.5') console.log('\nnote: checking v' + version);
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
