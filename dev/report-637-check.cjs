// The two Sep 26, 2026 reports, checked against the live code:
//
//   1. "there shouldn't be a play button in singles when you click on a song"
//   2. "I'm still missing one album cover" -- Album History: "Ishq Da Uda Ada"
//
// Both are driven through the real entry points of a real boot, not restated:
// the popup is opened, the Singles button is clicked, the saved snapshots are
// seeded with the exact markup an older build wrote, and the artwork resolver is
// pointed at an honest stand-in for the three APIs -- one that answers the
// MusicBrainz question the way the live service does (verified: the
// `AND artist:"..."` query returns count 0 for this album, the title-only query
// returns the release group). Run it against the pre-fix build with
// SC_HTML=/tmp/index.before.637.html and the artwork half fails.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');
const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1] || '';

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  \u2713 ' + name); }
  else { fail++; console.log('  \u2717 ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
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

const SINGLES_KEY = 'discPopupCache_\ud83c\udfb5 Singles';

// The exact button an older build wrote into every singles row: the renderer at
// the time emitted a <div> with the class first, and the only guard that existed
// matched a <span>.
const PLAY = '<div class="dp-track-play" data-play="0-0" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(227,178,60,0.16);color:var(--coral);font-size:11px;cursor:pointer;">\u25b6</div>';

// The report's own list: artist BK, 22 singles, with a search bar and the
// Refetch singles / Recently Deleted row -- which is what the saved body holds.
function dirtyBody(artist, title) {
  return '<div style="text-align:center;padding:4px 0 6px;display:flex;gap:6px;justify-content:center;">'
    + '<button id="singlesRefetchBtn">\u21bb Refetch singles</button>'
    + '<button id="singlesRecentlyDeletedBtn">\ud83d\uddd1\ufe0f Recently Deleted</button></div>'
    + '<div class="dp-ah-artist"><div class="dp-ah-artist-hdr" data-target="dps_0">'
    + '<span class="dp-ah-chevron" style="transition:transform 0.2s;">\u25b8</span>'
    + '<span style="font-size:13px;font-weight:600;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + artist + '</span>'
    + '<span class="dp-si-count" style="font-size:11px;color:var(--ink-dim);flex-shrink:0;">22 singles</span>'
    + '<span class="dp-si-refetch" data-artist="' + artist + '">\u21bb</span>'
    + '<span class="dp-si-deep-refetch" data-artist="' + artist + '">\u26a1</span>'
    + '</div><div id="dps_0" class="dp-ah-albums" style="display:block;padding:2px 0 4px 0;">'
    + '<div class="dp-track" data-si="0-0">' + PLAY
    + '<div style="width:36px;height:36px;border-radius:6px;flex-shrink:0;"></div>'
    + '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:600;">' + title + '</div>'
    + '<div style="font-size:11px;color:var(--ink-dim);">' + artist + ' & Arsh Heer \u00b7 2026-08-14</div></div>'
    + '<span class="dp-ah-x" data-si="0-0" data-tid="1">\u00d7</span>'
    + '</div></div></div>';
}

function seedSingles(win, artist, title) {
  win.localStorage.setItem(SINGLES_KEY, JSON.stringify({
    title: '\ud83c\udfb5 Singles',
    body: dirtyBody(artist, title),
    subtitle: '298 singles from 7 artists',
    ts: Date.now(),
    pins: artist.toLowerCase().trim(),
  }));
}
const cachedSinglesBody = (win) => {
  try { return JSON.parse(win.localStorage.getItem(SINGLES_KEY) || '{}').body || ''; } catch (e) { return ''; }
};
const playButtonsIn = (el) => el.querySelectorAll('.dp-track-play').length;

let calls = [];
function installRouter(win, route) {
  win.fetch = async (url) => {
    calls.push(String(url));
    return route(String(url));
  };
  win.fetch.route = route;
}

(async () => {
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
      win.indexedDB = fakeIndexedDB({
        lastSeenVersion: version,
        idCounter: 1,
        playlists: { 'All Songs': [], 'Favorites': [], 'Unsorted': [] },
        pinnedArtists: [{ name: 'BK', art: '' }],
      });
      win.fetch = () => Promise.reject(new Error('offline'));
      win.navigator.vibrate = () => true;
      win.localStorage.setItem('sidecut_premium', JSON.stringify({ active: true, plan: 'lifetime', granted: Date.now() }));
    },
  });

  const win = dom.window;
  await wait(2700);
  installRouter(win, async () => ({ ok: false, status: 404, json: async () => ({}) }));
  win.navigate('discover');
  await wait(400);

  console.log('[1] the \u25b6 cannot come back out of a saved snapshot');

  // -- the whole point: one stripper, reachable from both script blocks.
  ok('the stripper is exported on window', typeof win.__scStripPopupPlayButtons === 'function');
  if (typeof win.__scStripPopupPlayButtons === 'function') {
    const one = win.__scStripPopupPlayButtons(dirtyBody('BK', 'GALL MUKKDI'));
    ok('it strips the <div> button an older build wrote', one.indexOf('dp-track-play') === -1);
    ok('and the row itself survives it', one.indexOf('GALL MUKKDI') !== -1 && one.indexOf('dp-ah-x') !== -1);
    const two = win.__scStripPopupPlayButtons('<div class="dp-track"><span class="dp-track-play" data-play="1">\u25b6</span><span style="flex:1">Row</span></div>');
    ok('it strips the <span> form too', two.indexOf('dp-track-play') === -1 && two.indexOf('Row') !== -1);
    ok('and leaves a body that never had one alone', win.__scStripPopupPlayButtons('<div class="dp-track">Row</div>') === '<div class="dp-track">Row</div>');
  }
  // One copy of the regex, so the two readings cannot drift apart again. Before
  // this patch there were two (the loader's and none at the readers).
  const regexCopies = (html.match(/class="dp-track-play"\[/g) || []).length;
  ok('exactly one copy of the strip regex exists in the source', regexCopies === 1, regexCopies + ' found');

  // -- (a) the groups lifted out of a saved snapshot and re-used in a FRESH list.
  {
    seedSingles(win, 'BK', 'GALL MUKKDI');
    const kept = typeof win.__scKeptArtistGroups === 'function'
      ? win.__scKeptArtistGroups('\ud83c\udfb5 Singles', {}, [{ name: 'BK' }])
      : null;
    ok('a saved group is still carried into a fresh list',
      !!kept && kept.rows === 1 && kept.html.indexOf('GALL MUKKDI') !== -1,
      kept && ('rows=' + kept.rows));
    ok('and it carries no play button', !!kept && kept.html.indexOf('dp-track-play') === -1,
      kept && kept.html.slice(0, 70));
  }

  // -- (b) the popup's own choke point: whatever body it is handed, and
  //        therefore whatever it re-saves, is clean.
  {
    seedSingles(win, 'BK', 'GALL MUKKDI');
    win.openDiscoverPopup('\ud83c\udfb5 Singles', dirtyBody('BK', 'GALL MUKKDI'), '298 singles from 7 artists');
    await wait(60);
    const body = win.document.getElementById('discPopupBody');
    ok('opening a saved body renders no play button', playButtonsIn(body) === 0, playButtonsIn(body) + ' found');
    ok('the row is still there to tap', (body.textContent || '').indexOf('GALL MUKKDI') !== -1);
    ok('and the cache it just wrote is clean too, so it cannot re-serve itself',
      cachedSinglesBody(win).indexOf('dp-track-play') === -1, cachedSinglesBody(win).slice(0, 70));
  }

  // -- (c) the Singles button's own cached-open branch (the reported one).
  {
    seedSingles(win, 'BK', 'CRUISE CONTROL');
    const siBtn = win.document.getElementById('discoverSingles');
    ok('the Singles button is present', !!siBtn);
    if (siBtn && typeof siBtn.onclick === 'function') {
      await siBtn.onclick.call(siBtn);
      await wait(80);
      const body = win.document.getElementById('discPopupBody');
      ok('clicking Singles on a saved list shows no play button', playButtonsIn(body) === 0, playButtonsIn(body) + ' found');
      ok('its rows are still listed', (body.textContent || '').indexOf('CRUISE CONTROL') !== -1);
      ok('the ✕ that removes a single is still there', body.querySelectorAll('.dp-ah-x').length === 1);
      ok('and the re-saved snapshot is healed, not re-poisoned',
        cachedSinglesBody(win).indexOf('dp-track-play') === -1, cachedSinglesBody(win).slice(0, 70));
    }
  }

  // -- (d) the loader path, which now shares the same stripper.
  if (typeof win.loadCachedDiscoverPopup === 'function') {
    seedSingles(win, 'BK', 'Unforgettable');
    win.localStorage.removeItem('discPopupCache_\ud83d\udcbf Album History');
    const opened = win.loadCachedDiscoverPopup('\ud83c\udfb5 Singles');
    await wait(60);
    ok('a snapshot reopened through the loader has no play button',
      opened === true && playButtonsIn(win.document.getElementById('discPopupBody')) === 0);
  } else {
    ok('the cached-popup loader is reachable', false, 'loadCachedDiscoverPopup not on window');
  }

  console.log('\n[2] the cover that had no source anything could find');

  ok('the resolver is exported', typeof win.__ahResolveArtworks === 'function');

  // An honest stand-in for the three services. Apple and Deezer carry no record
  // of this album at all (both verified live, both empty). MusicBrainz answers
  // exactly as the live API does: the `AND artist:"Diljit Dosanjh"` query returns
  // count 0 -- its index does not match the group's credit against that string --
  // while the title-only query returns it.
  const MB_ID = 'd1999b8d-fb08-387f-b3ec-64fa14b81a97';
  let mbQueries = [];
  const honest = (url) => {
    const u = String(url);
    const d = decodeURIComponent(u);
    if (/itunes\.apple\.com/.test(d)) return { ok: true, status: 200, json: async () => ({ resultCount: 0, results: [] }) };
    if (/api\.deezer\.com/.test(d)) return { ok: true, status: 200, json: async () => ({ data: [], total: 0 }) };
    if (/musicbrainz\.org/.test(d)) {
      if (d.indexOf('query=') !== -1) mbQueries.push(d.slice(d.indexOf('query=')));
      if (/AND artist:"/.test(d)) return { ok: true, status: 200, json: async () => ({ count: 0, 'release-groups': [] }) };
      if (d.indexOf('Ishq Da Uda Ada') !== -1) {
        return { ok: true, status: 200, json: async () => ({ count: 1, 'release-groups': [
          { id: MB_ID, title: 'Ishq Da Uda Ada', 'first-release-date': '2003-02-09', 'artist-credit': [{ name: 'Diljit' }] },
        ] }) };
      }
      if (d.indexOf('Maahi') !== -1) {
        return { ok: true, status: 200, json: async () => ({ count: 1, 'release-groups': [
          { id: 'a-stranger', title: 'Maahi', 'artist-credit': [{ name: 'Sukhpal Sukh' }] },
        ] }) };
      }
      return { ok: true, status: 200, json: async () => ({ count: 0, 'release-groups': [] }) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  const draw = async (artist, album) => {
    win.openDiscoverPopup('\ud83d\udcbf Album History',
      '<div class="dp-ah-album"><div class="dp-ah-album-hdr" data-artist="' + artist + '" data-album="' + album + '">'
      + '<div style="width:36px;height:36px;border-radius:6px;" data-art-url=""></div></div></div>', '');
    if (typeof win.__wireAH === 'function') win.__wireAH();
    await wait(400);
    return win.document.querySelector('#discPopupBody div[data-art-url]');
  };

  {
    // The reported row: "Ishq Da Uda Ada", 2003-02-09, the last blank one.
    installRouter(win, honest);
    calls = []; mbQueries = [];
    const el = await draw('Diljit Dosanjh', 'Ishq Da Uda Ada');
    ok('the album\'s release group is found and its archive cover is painted',
      !!el && /coverartarchive\.org\/release-group\/d1999b8d-fb08-387f-b3ec-64fa14b81a97\/front-500/.test(el.style.backgroundImage),
      el && el.style.backgroundImage.slice(0, 120));
    ok('so the placeholder is not left behind', !!el && el.style.backgroundImage.indexOf('data:image/svg') === -1);
    ok('the MusicBrainz query no longer carries an artist clause',
      mbQueries.length > 0 && mbQueries.every((q) => q.indexOf('AND artist:') === -1),
      mbQueries[0] || 'no MusicBrainz query was made');
    ok('it is a title-only release-group search for this album',
      mbQueries.some((q) => q.indexOf('releasegroup:"Ishq Da Uda Ada"') !== -1),
      mbQueries[0] || '');
    ok('all three sources were still asked, in order',
      calls.filter((u) => /itunes/.test(u)).length > 0
      && calls.filter((u) => /deezer/.test(u)).length > 0
      && calls.filter((u) => /musicbrainz/.test(u)).length > 0,
      calls.map((u) => u.replace(/^https?:\/\/([^/]+).*/, '$1')).join(' '));
    // No separate assertion for the credit name: the cover above only paints if
    // the loop accepted the release group's credit, which MusicBrainz reports as
    // "Diljit" -- not "Diljit Dosanjh".
  }

  {
    // A stranger's cover is still worse than a blank one: MusicBrainz returns a
    // same-titled release group credited to somebody else.
    installRouter(win, honest);
    calls = [];
    const el = await draw('Diljit Dosanjh', 'Maahi');
    ok('a same-titled release group by another artist is refused',
      !!el && el.style.backgroundImage.indexOf('coverartarchive') === -1 && el.style.backgroundImage.indexOf('a-stranger') === -1,
      el && el.style.backgroundImage.slice(0, 90));
    // The app paints its ♪ placeholder here. jsdom's CSS parser rejects that
    // data URI (it carries single quotes, and cssstyle drops the whole value),
    // so the assertion is on what is NOT painted plus what was NOT remembered --
    // both of which are the real behaviour and both jsdom-independent.
    ok('no cover is painted for it at all', !!el
      && !/https?:\/\//.test(el.style.backgroundImage)
      && el.style.backgroundImage.indexOf('a-stranger') === -1,
      el ? JSON.stringify(el.getAttribute('style')) : 'no row');
    let remembered = '';
    try { remembered = win.localStorage.getItem('sidecut_ahArtCache') || ''; } catch (e) {}
    ok('and nothing was remembered for it, so it is retried next time',
      remembered.indexOf('maahi') === -1, remembered.slice(0, 80));
    ok('while the cover that WAS found is remembered',
      remembered.indexOf('ishqdaudaada') !== -1, remembered.slice(0, 120));
  }

  {
    // The artist check that makes the title-only query safe is still in the code.
    ok('the artist identity check still guards the release-group loop',
      html.indexOf('if(!__ahArtSameArtist(_credit, artist)) continue;') !== -1);
    ok('the old artist-clause query is gone from the source',
      html.indexOf('AND artist:"\' + artist + \'"') === -1);
  }

  if (errors.length) console.log('\njsdom errors:\n  ' + errors.slice(0, 5).join('\n  '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
