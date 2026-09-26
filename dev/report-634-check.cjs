// The Sep 26, 2026 reports, checked against the shipped code:
//
//   1. "there shouldn't be a play button here" — the Singles rows.
//   2. "I should be able to get the cover art for these albums" — Album History
//      rows whose album Apple does not carry at all. Measured live: Deezer has
//      "Smile", "Ishq Ho Gaya" and "Over Exposure", and MusicBrainz's release
//      groups for those albums resolve through the Cover Art Archive. So the
//      lookup now asks Apple, then Deezer, then MusicBrainz/CAA — and never
//      paints a stranger's cover.
//   3. "this API key thing isn't working" — "API model not found", which is not
//      an expired key. The model that works is now discovered from the API and
//      remembered.
const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/h/node_modules/jsdom');

const html = fs.readFileSync(process.env.SC_HTML || path.join(__dirname, '..', 'index.html'), 'utf8');

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

function fakeIndexedDB() {
  const data = { tracks: new Map(), meta: new Map([['pinnedReleases', { key: 'pinnedReleases', value: {} }]]) };
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

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push('' + (e && e.message)));
vc.on('error', (...a) => errors.push(a.map(String).join(' ')));

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://anekthegreat.github.io/SideCut/',
  virtualConsole: vc,
  beforeParse(win) {
    win.HTMLCanvasElement.prototype.getContext = function () { return makeCtx(); };
    win.HTMLCanvasElement.prototype.toDataURL = function () { return 'data:image/png;base64,'; };
    win.indexedDB = fakeIndexedDB();
    win.fetch = () => Promise.reject(new Error('offline'));
    win.navigator.vibrate = () => true;
  },
});

// The app's own fetchWithProxy is IIFE-local (it is not on window), so the only
// place a probe can meet it is the global fetch it falls back to — which is what
// this router replaces. Every ask is recorded once, in order.
const calls = [];
function installRouter(win, routes) {
  const handle = async (url) => {
    calls.push(String(url));
    for (const [re, body] of routes) {
      if (re.test(String(url))) return { ok: true, status: 200, json: async () => (typeof body === 'function' ? body(String(url)) : body) };
    }
    return { ok: false, status: 404, json: async () => ({}) };
  };
  win.fetch = (url) => handle(url);
}

const PLACEHOLDER = "data:image/svg+xml,%3Csvg%3E";

(async () => {
  const win = dom.window;
  await wait(2800);

  console.log('[1] the Singles rows carry no play button');
  {
    // There were two renderers, and both drew a ▶: the list built by
    // __refetchSingles (`html +=`) and the one ↻ / ⚡ redraw a group with
    // (window.__singlesRowsHTML, `r +=`). Assert on the marker itself, so a
    // third renderer added later cannot slip through.
    const renderers = html.split("'<div class=\"dp-track-play\" data-play=").length - 1;
    ok('no renderer anywhere still emits a play button', renderers === 0,
      renderers + ' left: ' + (html.match(/[^\n]*'<div class="dp-track-play"[^\n]*/g) || []).map((l) => l.trim().slice(0, 60)).join(' | '));
    const singlesStart = html.indexOf('// ▶ buttons play the 30s preview inline');
    ok('and the wiring block that followed it found nothing to wire (documented)',
      singlesStart !== -1);
    ok('the row is still the tap target (Discover search)', html.includes("row.dataset.search || ''"));
    ok('the Album History / singles row markup itself is untouched',
      html.includes("data-si=\"' + ki + '-' + sri + '\""));

    // The reported ▶ was most likely a saved list, and the popup cache survives
    // an app update. Whatever a snapshot holds, it opens without one — the old
    // guard only matched Old songs, and only a <span>, while the button is a
    // <div> inside a Singles row.
    let opened = null;
    const loadSrc = html.slice(html.indexOf('function loadCachedDiscoverPopup(key){'), html.indexOf('window.orderArtistKeys = function'));
    const store = {
      'discPopupCache_\ud83c\udfb5 Singles': JSON.stringify({ title: '\ud83c\udfb5 Singles', subtitle: '298 singles', body:
        '<div class="dp-ah-artist"><div class="dp-track" data-si="0-0">'
        + '<div class="dp-track-play" data-play="0-0" style="width:28px;">\u25b6</div>'
        + '<div style="flex:1;">Ghostface Killah</div>'
        + '<span class="dp-ah-x" data-si="0-0">\u00d7</span></div></div>' }),
    };
    const load = new Function('localStorage', 'openDiscoverPopup', loadSrc + '\nreturn loadCachedDiscoverPopup;')(
      { getItem: (k) => (k in store ? store[k] : null) },
      (title, body, sub) => { opened = { title, body, sub }; }
    );
    ok('a saved Singles list still opens', load('\ud83c\udfb5 Singles') === true && !!opened);
    ok('its play button is gone from the body', opened && opened.body.indexOf('dp-track-play') === -1,
      opened && opened.body.slice(0, 90));
    ok('the row, its name and its ✕ survive', !!opened
      && opened.body.indexOf('Ghostface Killah') !== -1
      && opened.body.indexOf('dp-ah-x') !== -1);
  }

  console.log('[2] the artwork lookup has more than one source');
  {
    win.navigate('discover');
    await wait(400);
    ok('the popup wiring is available', typeof win.__wireAH === 'function');
    // The resolver has to be reachable from the popup, and it has to be RUN by
    // it: it was called exactly once, at boot, when the body is still empty, so
    // a row whose album has artworkUrl100: null could never be painted.
    ok('the resolver is exported', typeof win.__ahResolveArtworks === 'function');
    const openSrc = html.slice(html.indexOf('function openDiscoverPopup('), html.indexOf('// Delegated artist-group collapse'));
    ok('and every popup open runs it', openSrc.includes('window.__ahResolveArtworks()'), 'not called from openDiscoverPopup');
    // Driven exactly the way the app draws the list: a rendered Album History
    // row with no artwork, then the popup's own resolution. __wireAH is called
    // too, because the app calls it right after opening.
    const draw = async (artist, album) => {
      win.openDiscoverPopup('📀 Album History',
        '<div class="dp-ah-album"><div class="dp-ah-album-hdr" data-artist="' + artist + '" data-album="' + album + '">'
        + '<div style="width:36px;height:36px;" data-art-url=""></div></div></div>', '');
      win.__wireAH();
      await wait(260);
      return win.document.querySelector('#discPopupBody div[data-art-url]');
    };

    // Apple has nothing for this album (verified live); Deezer does.
    installRouter(win, [
      [/itunes\.apple\.com/, { results: [] }],
      [/api\.deezer\.com/, { data: [{ title: 'Smile', artist: { name: 'Diljit' }, cover_xl: 'https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg' }] }],
    ]);
    calls.length = 0;
    const el1 = await draw('Diljit Dosanjh', 'Smile');
    ok('the resolver runs on the row and Deezer answers when Apple does not',
      !!el1 && /dzcdn\.net/.test(el1.style.backgroundImage), el1 && el1.style.backgroundImage.slice(0, 90));
    ok('and Deezer was not asked before Apple was',
      calls.findIndex((u) => /itunes/.test(u)) < calls.findIndex((u) => /deezer/.test(u)),
      calls.map((u) => u.replace(/^https?:\/\/([^/]+).*/, '$1')).join(' '));

    // The reported blank rows: Deezer has no entry either, so MusicBrainz's own
    // release group answers through the Cover Art Archive.
    installRouter(win, [
      [/itunes\.apple\.com/, { results: [] }],
      [/api\.deezer\.com/, { data: [] }],
      [/musicbrainz\.org/, { 'release-groups': [{ id: 'd1999b8d-fb08-387f-b3ec-64fa14b81a97', title: 'Ishq Da Uda Ada', 'artist-credit': [{ name: 'Diljit' }] }] }],
    ]);
    calls.length = 0;
    const el2 = await draw('Diljit Dosanjh', 'Ishq Da Uda Ada');
    ok('a MusicBrainz release group resolves to the archive\'s front cover',
      !!el2 && /coverartarchive\.org\/release-group\/d1999b8d/.test(el2.style.backgroundImage),
      el2 && el2.style.backgroundImage.slice(0, 110));
    ok('all three sources were asked', calls.length === 3,
      calls.map((u) => u.replace(/^https?:\/\/([^/]+).*/, '$1')).join(' '));

    // A stranger's cover is worse than a blank one.
    installRouter(win, [
      [/itunes\.apple\.com/, { results: [{ collectionName: 'Maahi', artistName: 'Sukhpal Sukh', artworkUrl100: 'https://example.com/wrong.jpg' }] }],
      [/api\.deezer\.com/, { data: [{ title: 'Maahi', artist: { name: 'Someone Else' }, cover_xl: 'https://cdn-images.dzcdn.net/images/cover/wrong.jpg' }] }],
      [/musicbrainz\.org/, { 'release-groups': [{ id: 'nope', title: 'Maahi', 'artist-credit': [{ name: 'Sukhpal Sukh' }] }] }],
    ]);
    const el3 = await draw('Diljit Dosanjh', 'Maahi');
    ok('a same-titled album by another artist is never painted on',
      !!el3 && el3.style.backgroundImage.indexOf('wrong') === -1 && el3.style.backgroundImage.indexOf('dzcdn') === -1,
      el3 && el3.style.backgroundImage.slice(0, 70));
    ok('the placeholder stays instead', !!el3 && !/http/.test(el3.style.backgroundImage), el3 && el3.style.backgroundImage.slice(0, 60));

    // Found covers are remembered, so the resolver (every render) stops asking.
    installRouter(win, [
      [/itunes\.apple\.com/, { results: [] }],
      [/api\.deezer\.com/, { data: [{ title: 'Smile', artist: { name: 'Diljit' }, cover_xl: 'https://cdn-images.dzcdn.net/images/cover/abc/1000x1000-000000-80-0-0.jpg' }] }],
    ]);
    calls.length = 0;
    const el4 = await draw('Diljit Dosanjh', 'Smile');
    ok('a cover already found is reused without asking again', calls.length === 0, calls.join(' '));
    ok('and it is the same cover', !!el4 && /dzcdn\.net/.test(el4.style.backgroundImage), el4 && el4.style.backgroundImage.slice(0, 80));
  }

  console.log('[3] Gemini: the model is discovered, not assumed');
  {
    ok('the getter is exported', typeof win.__scGeminiModel === 'function');
    ok('and starts on the app\'s default', win.__scGeminiModel() === 'gemini-2.0-flash', win.__scGeminiModel());
    ok('the outdated pin is gone from every call site',
      (html.match(/models\/gemini-2\.0-flash:generateContent/g) || []).length === 0,
      String((html.match(/models\/gemini-2\.0-flash:generateContent/g) || []).length));
    const listCalls = [];
    win.fetch = async (url) => {
      listCalls.push(String(url));
      if (/\/models\?key=/.test(String(url))) {
        return { ok: true, status: 200, json: async () => ({ models: [
          { name: 'models/gemini-1.5-flash-8b', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.0-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-2.5-flash', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/embedding-001', supportedGenerationMethods: ['embedContent'] },
        ] }) };
      }
      return { ok: false, status: 404, json: async () => ({ error: { message: 'models/gemini-2.0-flash is not found for API version v1beta' } }) };
    };
    const picked = await win.__scGeminiEnsureModel('test-key');
    ok('the API is asked what the key can use', listCalls.length === 1, listCalls[0]);
    ok('the newest flash wins', picked === 'gemini-2.5-flash', picked);
    ok('a model that cannot answer questions is not picked', picked !== 'embedding-001');
    ok('and it is remembered for every other caller in the app', win.__scGeminiModel() === 'gemini-2.5-flash');
    ok('it survives a reload', (win.localStorage.getItem('sidecut_aiGeminiModel') || '') === 'gemini-2.5-flash');

    // A key that sees nothing usable fails honestly instead of blaming itself.
    win.fetch = async () => ({ ok: false, status: 400, json: async () => ({ error: { message: 'API key not valid. Please pass a valid API key.' } }) });
    const none = await win.__scGeminiEnsureModel('bad');
    ok('a key with no usable model returns nothing rather than a wrong name', none === '', JSON.stringify(none));

    // The chat's own error handling now quotes the API.
    const querySrc = html.slice(html.indexOf('async function _aiGeminiQuery'), html.indexOf('// Handle user message'));
    ok('the chat asks for a model the key can use on a 404', querySrc.includes('window.__scGeminiEnsureModel(_aiGeminiKey)'));
    ok('and reports what the API said, not a guess about the key', querySrc.includes("(err && err.error && err.error.message)"));
    ok('the old "your key may be expired" guess is gone',
      !querySrc.includes('your Gemini key may be expired'),
      querySrc.includes('your Gemini key may be expired') ? 'still present' : '');
    ok('the paste button has fallbacks beyond navigator.clipboard',
      html.includes('Capacitor.Plugins.Clipboard') && html.includes("execCommand('paste')"));
  }

  if (errors.length) console.log('\njsdom errors:\n  ' + errors.slice(0, 5).join('\n  '));
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
