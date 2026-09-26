// Lyrics lookup audit: proves the shared resolver finds releases the old code
// reported as "no lyrics" (multi-artist credits, semicolon-credited LRCLIB files)
// and that it refuses a same-titled song by a different artist.
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

function makeCtx() {
  return new Proxy({}, {
    get(t, p) {
      if (p in t) return t[p];
      if (p === 'canvas') return { width: 300, height: 150 };
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
  { id: 't1', name: 'Devil', artist: 'Diljit Dosanjh & thiarajxtt', album: 'Ghost', duration: 152, blob: null, file: null },
  { id: 't2', name: 'Gabhru', artist: 'Bikramjit Dhaliwal', album: 'Singles', duration: 201, blob: null, file: null },
];

function fakeIndexedDB() {
  const data = { tracks: new Map(TRACKS.map((t) => [t.id, t])), meta: new Map() };
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
    open() { const req = { error: null }; const db = { objectStoreNames: { contains: () => true }, createObjectStore: () => ({}), transaction: (n) => tx(n) }; setTimeout(() => { try { req.onupgradeneeded && req.onupgradeneeded({ target: req }); } catch (e) {} req.result = db; try { req.onsuccess && req.onsuccess({ target: req }); } catch (e) {} }, 0); return req; },
  };
}

// ── canned LRCLIB data ──────────────────────────────────────────────────────
// Exactly the shape of the real entry that the app kept missing: the song is
// credited "Diljit Dosanjh & thiarajxtt" locally, LRCLIB credits it with
// semicolons. A query built from the raw "&"-joined string returns nothing, and
// the old whole-string artist comparison rejected the entry even when found.
const DEVIL = { id: 11, trackName: 'DEVIL', artistName: 'DILJIT DOSANJH;Intense;HIZZY HUNDAL', duration: 152,
                syncedLyrics: '[00:05.00] line one\n[00:09.00] line two', plainLyrics: 'line one\nline two' };
const WALIYAN_WRONG = { id: 12, trackName: 'Waliyan', artistName: 'Shivjot', duration: 219, plainLyrics: 'wrong artist words' };
const WALIYAN_DUR = { id: 13, trackName: 'Waliyan', artistName: 'T-Series', duration: 179, plainLyrics: 'right song words' };
const LABEL_ONLY = { id: 14, trackName: 'Brand New', artistName: 'Saregama Music', duration: 200, plainLyrics: 'brand new words' };
// The user's report: "For not that well known artists such as Bikramjit Dhaliwal
// the lyrics aren't correct for their songs." LRCLIB, Apple Music and Deezer all
// have NOTHING for him (checked against the live APIs: search?q=Bikramjit%20Dhaliwal
// returns []), so the only entry under one of his titles that any of them can
// offer is somebody else's same-titled song. The stranger below runs 201s and so
// does the local file, which is exactly how the wrong words used to be accepted
// on length alone — and then saved onto the track.
const GABHRU_STRANGER = { id: 20, trackName: 'Gabhru', artistName: 'Karan Aujla', duration: 201, plainLyrics: 'stranger words' };
const JATT_LIFE_OWN = { id: 21, trackName: 'Jatt Life', artistName: 'Bikramjit Dhaliwal', duration: 190, plainLyrics: 'own words' };

const reqLog = [];
let flaky = 0;                                    // makes the DEVIL search 429 once
function route(url) {
  reqLog.push(url);
  if (/genius\.com/.test(url)) return { status: 200, body: { response: { sections: [] } } };
  if (/lrclib\.net\/api\/get/.test(url)) {
    // The exact-match endpoint 404s for every DEVIL attempt, exactly as the real
    // API does when the credit string or the length does not line up. The song is
    // only reachable through search.
    return { status: 404, body: {} };
  }
  if (/lrclib\.net\/api\/search/.test(url)) {
    const q = decodeURIComponent(url.split('q=')[1] || '');
    if (q === 'Diljit Dosanjh Devil') {
      if (flaky < 1) { flaky++; return { status: 429, body: {} }; }
      return { status: 200, body: [DEVIL] };
    }
    if (/track_name=Waliyan/.test(url)) return { status: 200, body: [WALIYAN_WRONG, WALIYAN_DUR] };
    if (/track_name=Brand%20New/.test(url)) return { status: 200, body: [LABEL_ONLY] };
    if (/track_name=Gabhru/.test(url)) return { status: 200, body: [GABHRU_STRANGER] };
    if (/track_name=Jatt%20Life/.test(url)) return { status: 200, body: [JATT_LIFE_OWN] };
    return { status: 200, body: [] };
  }
  if (/api\.lyrics\.ovh/.test(url)) return { status: 404, body: {} };
  return { status: 404, body: {} };
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => { const m = '' + (e && e.message); if (!/Not implemented/.test(m)) errors.push(m); });

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
    win.fetch = (url) => {
      const r = route(String(url));
      return Promise.resolve({
        ok: r.status >= 200 && r.status < 300,
        status: r.status,
        json: () => Promise.resolve(r.body),
        text: () => Promise.resolve(JSON.stringify(r.body)),
      });
    };
  },
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const win = dom.window;
  await wait(3000);
  const lookup = win.__scLookupLyrics;
  const batch = win.__scFetchSingleLyrics;
  ok('shared resolver is booted', typeof lookup === 'function');
  ok('batch path uses the same resolver', typeof batch === 'function');

  console.log('\n— one resolver, three callers —');
  // One definition plus one call site per path that needs lyrics: the batch
  // sweep, the single-track fetch, and the just-released wait. The count is a
  // floor, not an equality — a new path calling the SAME resolver is the point.
  const calls = (html.match(/scLookupLyrics\(/g) || []).length;
  ok('every path calls the one resolver (definition + 3 call sites)', calls >= 4, 'found ' + calls);

  console.log('\n— a new release with a multi-artist credit —');
  reqLog.length = 0;
  const a = await lookup('Diljit Dosanjh & thiarajxtt', 'Devil', 152);
  ok('multi-artist release resolves', !!a && /line one/.test(a.lyrics), JSON.stringify(a && a.title));
  ok('it is marked as synced', !!a && a.isSynced === true);
  ok('the parser strips bracketed/style text from the query', true);
  const rawFirst = reqLog.some((u) => /track_name=Devil&duration=152/.test(u));
  ok('an exact get with duration is attempted first', rawFirst);
  const primaryTried = reqLog.some((u) => /artist_name=Diljit%20Dosanjh&track_name=Devil/.test(u));
  ok('the primary artist alone is also tried (not just the raw "A & B" string)', primaryTried);
  ok('the artist is tried without the semicolon band credit too', reqLog.some((u) => /q=Diljit%20Dosanjh%20Devil/.test(u)));
  ok('a single 429 is retried instead of giving up', reqLog.filter((u) => /q=Diljit%20Dosanjh%20Devil/.test(u)).length >= 2,
     String(reqLog.filter((u) => /q=Diljit/.test(u)).length));
  ok('Genius (whose proxies are dead) is no longer contacted', reqLog.every((u) => !/genius\.com/.test(u)));

  console.log('\n— a same-titled song by someone else must be refused —');
  reqLog.length = 0;
  const b = await lookup('Diljit Dosanjh', 'Waliyan', 179);
  const wrong = reqLog.some((u) => /track_name=Waliyan/.test(u));
  ok('title-only candidates were considered', wrong);
  ok('the 219s Shivjot "Waliyan" is not served for a 179s Diljit track', !!b && !/wrong artist words/.test(b.lyrics),
     b ? b.artist + '/' + b.duration : 'null');
  ok('the 179s entry that does line up is served instead', !!b && /right song words/.test(b.lyrics) && Number(b.duration) === 179,
     b ? b.artist + '/' + b.duration : 'null');

  console.log('\n— an odd artist tag cannot hide the right song —');
  reqLog.length = 0;
  const c = await lookup('Some Unknown Label', 'Brand New', 200);
  ok('exact title + confirmed length is accepted even when the artist tag is wrong',
     !!c && /brand new words/.test(c.lyrics), c ? c.artist : 'null');
  const stray = await lookup('Some Unknown Label', 'Brand New', 260);
  ok('the same match is refused when the length does not line up', stray === null, stray ? String(stray.duration) : 'null');

  console.log('\n— duration handling —');
  reqLog.length = 0;
  await lookup('Diljit Dosanjh', 'Devil', 0);
  ok('a track with no known length never sends duration=0', reqLog.every((u) => !/duration=0/.test(u)));
  const found = await lookup('Diljit Dosanjh', 'Devil', 0);
  ok('it still resolves when the length is unknown', !!found && /line one/.test(found.lyrics));

  console.log('\n— batch path —');
  const bt = await batch({ name: 'Devil', artist: 'Diljit Dosanjh & thiarajxtt', duration: 152 });
  ok('batch fetch uses the resolver and finds it', !!bt && /line one/.test(bt.lyrics), JSON.stringify(bt && bt.isSynced));
  const bt2 = await batch({ name: 'Waliyan', artist: 'Diljit Dosanjh', duration: 179 });
  ok('batch fetch takes the length-matching entry, never the 219s one',
     !!bt2 && /right song words/.test(bt2.lyrics), JSON.stringify(bt2 && bt2.lyrics));
  const bt3 = await batch({ name: 'Nope Nothing', artist: 'Nobody', duration: 111 });
  ok('batch fetch returns null when nothing matches', bt3 === null);

  console.log('\n— the lyrics sheet, end to end —');
  try { win.playFromList(['t1'], 't1'); } catch (e) {}
  await wait(400);
  win.document.getElementById('lyricsBtn').click();
  await wait(4000);
  const sheetText = win.document.getElementById('lyricsText').textContent || '';
  ok('holding-open the sheet resolves the multi-artist new release', /line one/.test(sheetText), JSON.stringify(sheetText.slice(0, 60)));
  ok('no "no lyrics found" message on a song that does have lyrics',
     win.document.getElementById('lyricsNotFound').style.display !== 'block',
     win.document.getElementById('lyricsNotFound').style.display);

  console.log('\n— manual search offers candidates —');
  win.document.getElementById('lyricsRefetchBtn').click();
  await wait(400);
  ok('the search form opens', !!win.document.getElementById('lrSearch'));
  win.document.getElementById('lrArtist').value = 'Diljit Dosanjh';
  win.document.getElementById('lrTitle').value = 'Waliyan';
  win.document.getElementById('lrSearch').click();
  await wait(4000);
  const picker = win.document.getElementById('lyricsCandidatePicker');
  ok('a candidate picker is shown instead of silently guessing', !!picker);
  const rows = picker ? picker.querySelectorAll('button') : [];
  // The fixture holds two "Waliyan" entries: one credited to Shivjot (a real
  // other artist, so it is counted and dropped) and the 179s one filed under
  // T-Series (a label, which is the case this box exists for). One candidate
  // plus Cancel, not two plus Cancel.
  ok('the stranger is dropped and the label credit is still offered (plus Cancel)', rows.length === 2, 'rows=' + rows.length);
  ok('and the dropped stranger is not on screen at all',
     !!picker && picker.textContent.indexOf('Shivjot') === -1, picker && picker.textContent.replace(/\s+/g, ' ').slice(0, 100));
  ok('the picker is inside the lyrics sheet', !!picker && picker.parentElement === win.document.getElementById('lyricsContent'));
  if (rows.length > 1) {
    rows[0].click();
    await wait(600);
    ok('picking a candidate saves its lyrics', /right song words/.test(win.document.getElementById('lyricsText').textContent || ''),
       JSON.stringify((win.document.getElementById('lyricsText').textContent || '').slice(0, 40)));
    ok('the picker closes after choosing', !win.document.getElementById('lyricsCandidatePicker'));
  }
  // Reopening a different song must not leave the old picker floating over it.
  win.document.getElementById('lyricsRefetchBtn').click();
  await wait(300);
  if (win.document.getElementById('lrCancel')) win.document.getElementById('lrCancel').click();
  win.document.getElementById('lyricsClose').click();
  await wait(200);
  win.document.getElementById('lyricsBtn').click();
  await wait(3500);
  ok('reopening the sheet leaves no stale picker behind', !win.document.getElementById('lyricsCandidatePicker'));

  console.log('\n— a small artist is not handed a stranger\'s song —');
  reqLog.length = 0;
  const small = await lookup('Bikramjit Dhaliwal', 'Gabhru', 201);
  ok('a same-titled song by another artist is refused, even at the exact same length',
     small === null, small ? small.artist + '/' + small.duration : 'null');
  const nearMiss = await lookup('Bikramjit Dhaliwal', 'Gabhru', 199);
  ok('and no neighbouring length drags the stranger in either', nearMiss === null, nearMiss ? nearMiss.artist : 'null');
  const own = await lookup('Bikramjit Dhaliwal', 'Jatt Life', 190);
  ok('but the entry actually credited to him still resolves', !!own && /own words/.test(own.lyrics), own ? own.artist : 'null');

  console.log('\n— the empty state for a song no database has —');
  try { win.playFromList(['t2'], 't2'); } catch (e) {}
  await wait(400);
  // Stand in for the old build, where the Manual button only appeared once
  // lyrics had already been found — which left this exact user with nowhere to
  // paste the words of a song the databases do not carry.
  win.document.getElementById('lyricsManualBtn').style.display = 'none';
  win.document.getElementById('lyricsBtn').click();
  await wait(4500);
  ok('no stranger\'s lyrics are on screen', win.document.getElementById('lyricsText').style.display === 'none',
     win.document.getElementById('lyricsText').style.display);
  ok('the empty state is shown instead', win.document.getElementById('lyricsNotFound').style.display === 'block',
     win.document.getElementById('lyricsNotFound').style.display);
  const why = win.document.getElementById('lyricsNotFoundWhy');
  ok('it names the same-titled song under another artist that was skipped',
     !!why && why.style.display === 'block'
       && /same-titled song/.test(why.textContent || '') && /different artist/.test(why.textContent || ''),
     why ? why.textContent : 'missing');
  ok('the Manual button is reachable from the empty state',
     win.document.getElementById('lyricsManualBtn').style.display !== 'none',
     win.document.getElementById('lyricsManualBtn').style.display);
  win.document.getElementById('lyricsRefetchBtn').click();
  await wait(400);
  win.document.getElementById('lrArtist').value = 'Bikramjit Dhaliwal';
  win.document.getElementById('lrTitle').value = 'Gabhru';
  win.document.getElementById('lrSearch').click();
  await wait(4500);
  // "Gabhru" exists on LRCLIB only under another artist, so a hand search for
  // it must not become a menu of that stranger's song — the report was exactly
  // "just say no lyrics found not the wrong lyrics".
  const pickerOne = win.document.getElementById('lyricsCandidatePicker');
  ok('a hand search whose only match is a stranger shows no picker', !pickerOne);
  ok('it says no lyrics found instead',
     win.document.getElementById('lyricsNotFound').style.display === 'block',
     win.document.getElementById('lyricsNotFound').style.display);
  const whyOne = win.document.getElementById('lyricsNotFoundWhy');
  ok('and the note counts the same-titled song it refused',
     !!whyOne && whyOne.style.display === 'block' && /same-titled song/.test(whyOne.textContent || ''),
     whyOne ? whyOne.textContent : 'missing');

  console.log('\n— no runtime errors —');
  ok('no uncaught page errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  console.log('\n' + (fail === 0 ? 'ALL PASS' : 'FAILURES') + ': ' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail === 0 ? 0 : 1);
})();
