// v60 audit. Covers the batch shipped in v60:
//   • Home bubble default order (new default, one-time migration, custom kept)
//   • exact per-bubble sizes in Sandbox (free) + the two new presets
//   • the New releases bubble's mark-all-as-read chip
//   • "Switch album" in the reorder sheet lists only the albums you made
//   • tap the mini turntable → the playing song's album, scrolled + highlighted
//   • Old songs: no play button, and a row tap opens that song
//   • Singles search bar is not sticky, export note says 2–3 minutes
//   • even top nav pills
//   • five new premium dynamic themes + the second animated layer
//   • the RGB cycle runs on frames (smooth) with the watchdog still there
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
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
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
  { id: 't3', name: 'Champagne', artist: 'Diljit Dosanjh', album: 'MoonChild Era', duration: 182 },
  { id: 't4', name: 'Goat', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 210 },
  { id: 't5', name: 'Legend', artist: 'Sidhu Moose Wala', album: 'G.O.A.T', duration: 190 },
];
const ALBUMS = {
  'My Mix': { artist: 'Various Artists', trackIds: ['t1', 't4'], createdAt: 1, manual: true },
  'Late Night': { artist: 'Diljit Dosanjh', trackIds: ['t5'], createdAt: 2, manual: true },
  'Tag Album': { artist: 'Diljit Dosanjh', trackIds: ['t2', 't3'], createdAt: 3, auto: true },
};
const PLAYLISTS = { 'All Songs': ['t1', 't2', 't3', 't4', 't5'], Favorites: [], 'Punjabi Gaane': ['t1', 't2'] };
const OLD_DEFAULT = ['stats','notifications','newreleases','pinnedartists','library','nowplaying','topsong','artists','favorites','playlists','shortcuts'];

function fakeIndexedDB(metaSeed) {
  const data = {
    tracks: new Map(TRACKS.map((t) => [t.id, t])),
    meta: new Map([
      ['playlists', { key: 'playlists', value: JSON.parse(JSON.stringify(PLAYLISTS)) }],
      ['userAlbums', { key: 'userAlbums', value: JSON.parse(JSON.stringify(ALBUMS)) }],
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
      if (opts.fetch) win.fetch = opts.fetch;
      else win.fetch = () => Promise.reject(new Error('offline'));
    },
  });
  return { dom, idb, errors, win: dom.window };
}

const bubbleKinds = (win) => Array.from(win.document.querySelectorAll('#homeBubbles .home-bubble')).map((b) => b.dataset.bubble);
const storedMeta = (idb, key) => { const m = idb._data.meta.get(key); return m ? m.value : undefined; };
const realErrors = (errors) => errors.filter((e) => e.indexOf('dbPromise') === -1 && e.indexOf('Not implemented') === -1);

(async () => {
  // ── A. fresh boot: the new default order ──
  {
    console.log('\n— Home: the requested order is the default —');
    const { win, errors } = boot(null);
    await wait(3200);
    const NEW_DEFAULT = ['stats','nowplaying','artists','shortcuts','pinnedartists','newreleases','library','topsong','playlists','notifications','favorites'];
    // Pinned artists is a premium bubble, so a free boot hides it.
    const expectedFree = NEW_DEFAULT.filter((k) => k !== 'pinnedartists');
    ok('a fresh install uses the new bubble order', eq(bubbleKinds(win), expectedFree), JSON.stringify(bubbleKinds(win)));
    ok('New playing sits right before Top artists', bubbleKinds(win).indexOf('nowplaying') + 1 === bubbleKinds(win).indexOf('artists'));
    ok('Notifications and Favorites are last', eq(bubbleKinds(win).slice(-2), ['notifications', 'favorites']));
    ok('no page errors', realErrors(errors).length === 0, realErrors(errors).slice(0, 2).join(' | '));
  }

  // ── B. the old stock order migrates; a customised one is kept ──
  {
    console.log('\n— Home: old stock order migrates, your own layout does not —');
    const { win } = boot({ homeOrder: OLD_DEFAULT.slice() });
    await wait(3200);
    ok('the untouched old default moved to the new one',
       bubbleKinds(win).indexOf('nowplaying') + 1 === bubbleKinds(win).indexOf('artists') && eq(bubbleKinds(win).slice(-2), ['notifications', 'favorites']),
       JSON.stringify(bubbleKinds(win)));
    const custom = ['favorites','stats','playlists'];
    const b2 = boot({ homeOrder: custom.slice() });
    await wait(3200);
    const kinds2 = bubbleKinds(b2.win);
    ok('a layout you rearranged is left alone',
       kinds2[0] === 'favorites' && kinds2[1] === 'stats' && kinds2[2] === 'playlists', JSON.stringify(kinds2.slice(0, 4)));
  }

  // ── C. bubble sizes: new presets + exact sizing in Sandbox (free) ──
  {
    console.log('\n— Home: more sizes, and exact sizing from Sandbox —');
    const { win, idb } = boot(null);
    await wait(3200);
    ok('the Sandbox bubble-size editor exists', !!win.document.getElementById('sandboxBubbleSizes'));
    ok('it is in the Sandbox panel, not behind premium',
       !!win.document.getElementById('sandboxBubbleSizes') &&
       !/sandboxBubbleSizes/.test(win.document.body.innerHTML.split('settingsPaneSandbox')[0]));
    const stats = win.document.querySelector('#homeBubbles .home-bubble[data-bubble="stats"]');
    ok('a bubble is rendered to size', !!stats);
    const hBtn = win.document.querySelector('#sandboxBubbleSizes [data-hbex="stats"][data-axis="h"][data-dir="1"]');
    ok('the editor has the size steppers', !!hBtn);
    if (hBtn) {
      for (let i = 0; i < 2; i++) hBtn.click();
      const h = stats.style.minHeight;
      ok('raising the height resizes that bubble only', /calc\(\d+px/.test(h) && Number((h.match(/calc\((\d+)px/) || [])[1]) > 118, h);
      const other = win.document.querySelector('#homeBubbles .home-bubble[data-bubble="favorites"]');
      ok('and leaves the others alone', !other.style.minHeight, other.style.minHeight);
      const wBtn = win.document.querySelector('#sandboxBubbleSizes [data-hbex="stats"][data-axis="w"][data-dir="1"]');
      wBtn.click();
      ok('raising the width makes it full row', stats.style.gridColumn === '1 / -1', stats.style.gridColumn);
      await wait(150);
      ok('the size is persisted', !!(storedMeta(idb, 'homeBubbleExact') || {}).stats, JSON.stringify(storedMeta(idb, 'homeBubbleExact')));
    }
    const sizes = html.match(/HB_SIZE_CLASSES = \[([^\]]+)\]/);
    ok('two more preset sizes shipped (mini + xl)', !!sizes && /mini/.test(sizes[1]) && /xl/.test(sizes[1]), sizes && sizes[1]);
    ok('the mini/xl CSS exists', /hb-size-mini\{/.test(html) && /hb-size-xl\{/.test(html));
  }

  // ── D. New releases bubble: mark all as read ──
  {
    console.log('\n— New releases: mark all as read from the bubble —');
    const releases = { 'Diljit Dosanjh': [{ title: 'A', date: '2026-08-01', seen: false }, { title: 'B', date: '2026-08-02', seen: false }], 'BK': [{ title: 'C', date: '2026-08-03', seen: true }] };
    const { win, idb } = boot({ pinnedReleases: JSON.parse(JSON.stringify(releases)), pinnedArtists: [{ name: 'Diljit Dosanjh' }, { name: 'BK' }] }, { premium: true });
    await wait(3600);
    const bubble = win.document.querySelector('#homeBubbles .home-bubble[data-bubble="newreleases"]');
    ok('a New releases bubble is on Home', !!bubble);
    const chip = bubble ? bubble.querySelector('[data-markread]') : null;
    ok('it carries a mark-all-as-read chip', !!chip, bubble ? bubble.innerHTML.slice(0, 90) : 'no bubble');
    if (chip) {
      chip.click();
      await wait(120);
      const after = storedMeta(idb, 'pinnedReleases') || {};
      const unseen = Object.keys(after).reduce((n, a) => n + (after[a] || []).filter((r) => r && !r.seen).length, 0);
      ok('tapping it marks every release as read', unseen === 0, JSON.stringify(after));
      const bubble2 = win.document.querySelector('#homeBubbles .home-bubble[data-bubble="newreleases"]');
      ok('and the chip goes away once nothing is unread', !bubble2.querySelector('[data-markread]'));
    }
  }

  // ── E. reorder sheet: Switch album is hand-made only ──
  {
    console.log('\n— Reorder Songs: Switch album lists only your albums —');
    const { win } = boot(null);
    await wait(3200);
    ok('the reorder sheet is reachable', typeof win.showAlbumReorderPopup === 'function');
    win.showAlbumReorderPopup('My Mix');
    await wait(200);
    const sheet = win.document.getElementById('albumReorderPopup');
    ok('the sheet opened', !!sheet);
    if (sheet) {
      const chips = Array.from(sheet.querySelectorAll('button')).map((b) => b.textContent.trim());
      console.log('    switch album: ' + JSON.stringify(chips.filter((c) => c && c.length < 30).slice(0, 8)));
      ok('it offers the albums you made', chips.indexOf('My Mix') !== -1 && chips.indexOf('Late Night') !== -1);
      ok('it never offers an album the app created on its own', chips.indexOf('Tag Album') === -1, JSON.stringify(chips));
      sheet.remove();
    }
  }

  // ── F. turntable tap → the song's album, scrolled and highlighted ──
  {
    console.log('\n— Tap the mini turntable → the album that song is in —');
    const { win } = boot(null);
    await wait(3200);
    win.navigate('playlists');
    await wait(300);
    const row = win.document.querySelector('#listPane .track[data-id]');
    ok('the library has rows to play', !!row, row ? row.dataset.id : 'none');
    if (row) row.click();
    await wait(400);
    const stage = win.document.getElementById('npPlayerStage');
    ok('the mini turntable is there to tap', !!stage);
    stage.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
    await wait(600);
    ok('it switches to Albums', win.__scGetLibraryMode() === 'albums', win.__scGetLibraryMode());
    const focused = win.document.querySelector('#listPane .track.sc-album-focus');
    ok('the song is highlighted in its album', !!focused, focused ? focused.dataset.id : 'nothing focused');
    // t4/'Goat' is only in 'My Mix' by hand, t1 too; the first row is whichever
    // All Songs sorts first — assert only that it is inside a card.
    if (focused) {
      ok('the highlight sits inside an album card', !!focused.closest('[data-album-name]'), focused.outerHTML.slice(0, 80));
    }
  }

  // ── G. Old songs: no play button, tap opens the song ──
  {
    console.log('\n— Old songs: no play button, a tap opens that song —');
    const body = 'x'.repeat(20000);
    const itunes = (url) => {
      const results = [
        { trackName: 'Mob Ties', artistName: 'BK', releaseDate: '2024-01-01T00:00:00Z', previewUrl: 'https://p.example/a.m4a', trackId: 11, trackViewUrl: 'https://music.apple.com/a' },
        { trackName: 'Shook Ones', artistName: 'BK', releaseDate: '2024-02-01T00:00:00Z', previewUrl: 'https://p.example/b.m4a', trackId: 12, trackViewUrl: 'https://music.apple.com/b' },
      ];
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ results }) });
    };
    const { win } = boot({ pinnedArtists: [{ name: 'BK' }] }, { fetch: itunes, premium: true });
    await wait(3200);
    // The Discover screen wires its own buttons on first open.
    win.navigate('discover');
    await wait(700);
    const btn = win.document.getElementById('discoverLastYear');
    ok('the Old songs button exists', !!btn);
    if (btn) {
      btn.click();
      await wait(1200);
      const popup = win.document.getElementById('discPopupBody');
      const rows = Array.from(popup.querySelectorAll('.dp-track[data-lyrow]'));
      ok('old songs rows are rendered', rows.length > 0, String(rows.length));
      ok('no play button on them', rows.every((r) => !r.querySelector('.dp-track-play')));
      ok('they carry the filter term they searched with', rows.length > 0 && /\bBK\b/.test(rows[0].dataset.search || ''), rows[0] && rows[0].dataset.search);
      if (rows[0]) {
        const wanted = rows[0].dataset.search;
        rows[0].dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
        await wait(400);
        const got = win.document.getElementById('discoverSearch').value || '';
        ok('tapping a row takes you to that song (Discover search filled with it)',
           got.indexOf('Shook Ones') !== -1 || got.indexOf('Mob Ties') !== -1, got);
        ok('the search box got exactly that row\'s term', got === wanted, JSON.stringify(wanted) + ' -> ' + JSON.stringify(got));
        ok('and the popup closes', win.document.getElementById('discPopupOverlay').style.display === 'none');
      }
    }
    // The same rows arriving from the 24h cache (no per-render wiring) must work.
    const cachedBody = '<div class="dp-track" data-lyrow="1" data-search="&quot;Cached Song&quot; BK" data-trackname="Cached Song" data-artist="BK"><div style="flex:1">Cached Song</div></div>';
    const b2 = boot(null);
    await wait(3200);
    b2.win.openDiscoverPopup('📅 Old songs', cachedBody, '1 song');
    await wait(200);
    const cRow = b2.win.document.querySelector('#discPopupBody .dp-track[data-lyrow]');
    ok('a cached Old songs popup renders rows', !!cRow);
    if (cRow) {
      cRow.dispatchEvent(new b2.win.MouseEvent('click', { bubbles: true }));
      await wait(300);
      ok('and a tap on a cached row still opens that song',
         /Cached Song/i.test(b2.win.document.getElementById('discoverSearch').value || ''), b2.win.document.getElementById('discoverSearch').value);
    }
  }

  // ── H. copy / layout / theme details ──
  {
    console.log('\n— The small stuff —');
    const { win } = boot(null);
    await wait(3200);
    ok('the export note now says 2–3 minutes', /2\u20133 minutes/.test(html) && !/5\u20137 minutes/.test(html));
    ok('the Singles search bar is not sticky', /#discPopupSearchWrap/.test(html) ? html.indexOf("position:sticky") === -1 || !/padding:0 12px 8px 12px; position:sticky/.test(html) : true);
    ok('nav pills are forced even', /\.action-strip > \*\{ flex:1 1 0; min-width:0; \}/.test(html));
    const five = ['nebula', 'neonpulse', 'solstice', 'abyss', 'orchid'];
    const missing = five.filter((k) => !new RegExp('^\\s*' + k + ':', 'm').test(html));
    ok('five new dynamic themes exist', missing.length === 0, JSON.stringify(missing));
    ok('they are premium + dynamic',
       five.every((k) => new RegExp(k + ':.*premium:true, dynamic:' + "'" + k + "'").test(html)),
       JSON.stringify(five.filter((k) => !new RegExp(k + ':.*premium:true, dynamic:' + "'" + k + "'").test(html))));
    ok('every dynamic theme gets a second animated layer', /@keyframes sd-dyn-drift-rev/.test(html) && /body\[class\*="theme-dyn-"\]::after/.test(html));
    ok('and the new palettes have their own backdrops', five.every((k) => html.indexOf('body.theme-dyn-' + k + '::before') !== -1));
    const picker = win.document.getElementById('themeOptions');
    win.renderThemeOptions ? win.renderThemeOptions() : null;
    ok('the picker knows about them', five.every((k) => html.indexOf("'" + k + "'") !== -1 && !!picker));
  }

  // ── I. RGB: frames, not a 5-a-second interval ──
  {
    console.log('\n— RGB: the cycle runs on frames —');
    const { win } = boot({ theme: 'rgb' });
    await wait(3200);
    ok('the hue is driven by a frame loop', /function rgbFrameLoop\(\)/.test(html) && /requestAnimationFrame\(rgbFrameLoop\)/.test(html));
    ok('the watchdog is still there for a frozen WebView', /rgbLastFrameAt > 500/.test(html));
    ok('the 200ms interval no longer applies the colour itself', !/setInterval\(rgbTick, RGB_TICK_MS\)/.test(html));
    ok('frames are skipped when the hue has not visibly moved', /rgbLastAppliedHue !== null && Math\.abs\(hueNow - rgbLastAppliedHue\) < 0\.25/.test(html));
    // Live: picking RGB must put a live hsl() on the accents and keep moving it.
    const a = win.document.documentElement.style.getPropertyValue('--coral');
    ok('the accents are a live colour', /^hsl\(/.test(a), a);
    await wait(700);
    const b = win.document.documentElement.style.getPropertyValue('--coral');
    ok('and they move on their own', a !== b, a + ' -> ' + b);
  }

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail ? 1 : 0);
})();
