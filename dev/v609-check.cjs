// v60.0.9 audit — singles from more than one store, and Old songs without a
// play button even from a saved list.
//
// Both bugs were confirmed against the live iTunes API before the fix:
//   • "Ranjha - Single" (Diljit Dosanjh, Sia & David Guetta, 2026-03-12) is not
//     in Apple's default (US) store, so the old single-store query could never
//     return it. The fixture below is that shape: the IN response carries it, the
//     US one does not.
//   • The Old songs popup is served from a 24-hour localStorage snapshot that
//     survives an app update, so a copy written by a build that still drew a play
//     button kept drawing one after the button was removed.
//
// These checks run the REAL functions out of index.html, so behaviour is what is
// asserted, not just the source text.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra !== undefined ? '  [' + extra + ']' : '')); }
}
// Slice from `from` up to (but not including) the first `to` that comes AFTER it.
function slice(src, from, to) {
  const a = src.indexOf(from);
  if (a === -1) return '';
  const b = src.indexOf(to, a);
  return b === -1 ? '' : src.slice(a, b);
}

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];

/* ── the real single-detection function, with the live API's own shapes ───── */
const single = (trackName, artistName, collectionName, trackCount, date, extra) =>
  Object.assign({ trackName, artistName, collectionName, trackCount, releaseDate: date, artworkUrl100: 'art.jpg', previewUrl: 'p.m4a' }, extra || {});

// What the two stores returned for "Diljit Dosanjh" when this was written.
const US_RESULTS = [
  single('Dealer', 'Diljit Dosanjh', 'Dealer - Single', 1, '2026-03-11T07:00:00Z', { trackId: 1, collectionId: 11 }),
  single('Water', 'Diljit Dosanjh', 'Water - Single', 1, '2025-02-14T07:00:00Z', { trackId: 2, collectionId: 12 }),
  // on a full-length album — not a single, must stay out
  single('Proper Patola', 'Diljit Dosanjh', 'Namaste England (Original Motion Picture Soundtrack)', 7, '2018-10-03T07:00:00Z', { trackId: 3, collectionId: 13 }),
  // someone else's release — must stay out
  single('Ranjha', 'Jasleen Royal & B. Praak', 'Ranjha (From "Shershaah") - Single', 1, '2021-08-05T07:00:00Z', { trackId: 4, collectionId: 14 }),
];
const IN_RESULTS = [
  // the one that was missing: Indian store only
  single('Ranjha', 'Diljit Dosanjh, Sia & David Guetta', 'Ranjha - Single', 1, '2026-03-12T07:00:00Z', { trackId: 5, collectionId: 15 }),
  single('Shivaya', 'Diljit Dosanjh & Jaani', 'Shivaya - Single', 1, '2024-11-05T07:00:00Z', { trackId: 6, collectionId: 16 }),
  // same release as the default store returned — must appear once
  single('Dealer', 'Diljit Dosanjh', 'Dealer - Single', 1, '2026-03-11T07:00:00Z', { trackId: 1, collectionId: 11 }),
  single('Chal Kudiye', 'Diljit Dosanjh, Alia Bhatt', 'Chal Kudiye (From "Jigra") - EP', 5, '2024-09-17T07:00:00Z', { trackId: 7, collectionId: 17 }),
];

function buildFetchArtistSingles(opts) {
  const o = opts || {};
  const primary = slice(html, '  function primaryArtistName(name){', '\n  }\n    let lastUnpinned') + '\n  }\n';
  const fnSrc = slice(html, '  async function fetchArtistSingles(artistName, opts){', '  window.__scFetchArtistSingles = fetchArtistSingles;');
  const body = `
${primary}
var HIDDEN = ${JSON.stringify(o.hidden || [])};
function isSingleHidden(trackId, trackName){
  var tid = String(trackId);
  if(HIDDEN.indexOf(tid) !== -1) return true;
  if(trackName){ var t = String(trackName).toLowerCase().replace(/[^a-z0-9]/g,''); if(HIDDEN.indexOf('t:' + t) !== -1) return true; }
  return false;
}
var CALLS = [];
async function fetchWithProxy(url){
  CALLS.push(url);
  ${o.failUs ? "if(url.indexOf('country=IN') === -1) return null;" : ''}
  var rows = url.indexOf('country=IN') !== -1 ? ${JSON.stringify(IN_RESULTS)} : ${JSON.stringify(US_RESULTS)};
  return { ok: true, json: async function(){ return { results: rows }; } };
}
${fnSrc}
return { fn: fetchArtistSingles, calls: CALLS, results: { us: ${JSON.stringify(US_RESULTS)}, inn: ${JSON.stringify(IN_RESULTS)} } };
`;
  return new Function(body)();
}

(async () => {
  console.log('\n— Singles asks both stores, with one filter —');
  const src = slice(html, '  async function fetchArtistSingles(artistName, opts){', '  window.__scFetchArtistSingles = fetchArtistSingles;');
  ok('the function was extracted', src.length > 400, String(src.length));
  ok('it loops over a store list', /var stores = \['', '&country=IN'\];/.test(src));
  ok('and the loop really wraps the search', /for\(var sti=0; sti<stores\.length; sti\+\+\)\{[\s\S]*tunes\.apple\.com\/search[\s\S]*stores\[sti\]/.test(src));
  ok('the request carries the store, not a hardcoded URL', src.indexOf("'&media=music&entity=song&limit=200' + stores[sti]") !== -1);

  const run = buildFetchArtistSingles({});
  const out = await run.fn('Diljit Dosanjh', {});
  const titles = out.map((r) => r.trackName);
  ok('both stores were asked', run.calls.length === 2 && run.calls[1].indexOf('country=IN') !== -1, run.calls.length);
  ok('the Indian-store-only single is found', titles.indexOf('Ranjha') !== -1, titles.join(', '));
  ok('Ranjha keeps its own release info', (out.find((r) => r.trackName === 'Ranjha') || {}).collectionId === 15);
  ok('the other new IN single comes with it', titles.indexOf('Shivaya') !== -1);
  ok('a title in both stores appears once', titles.filter((t) => t === 'Dealer').length === 1);
  ok('an album track is still not a single', titles.indexOf('Proper Patola') === -1);
  ok("another artist's single is still not a single", titles.filter((t) => t === 'Ranjha').length === 1 && out.find((r) => r.trackName === 'Ranjha').artistName.indexOf('Diljit') === 0);
  ok('the result is newest first', titles.indexOf('Ranjha') < titles.indexOf('Shivaya'), titles.join(', '));
  ok('no more than the two stores were queried (no release-list union)', run.calls.length === 2);

  console.log('\n— the same rules still hold —');
  const hidden = buildFetchArtistSingles({ hidden: ['5'] });
  const hiddenOut = await hidden.fn('Diljit Dosanjh', {});
  ok('a removed single stays removed', hiddenOut.map((r) => r.trackName).indexOf('Ranjha') === -1);
  ok('in either store', hiddenOut.map((r) => r.trackName).indexOf('Dealer') !== -1);
  const deep = buildFetchArtistSingles({ hidden: ['5'] });
  const deepOut = await deep.fn('Diljit Dosanjh', { includeHidden: true });
  ok('the deep refetch (includeHidden) brings it back', deepOut.map((r) => r.trackName).indexOf('Ranjha') !== -1);
  const offline = buildFetchArtistSingles({ failUs: true });
  const offlineOut = await offline.fn('Diljit Dosanjh', {});
  ok('one store failing still returns the other store’s singles', offlineOut.map((r) => r.trackName).indexOf('Ranjha') !== -1);

  console.log('\n— every Singles path goes through that one function —');
  ok('the Discover button uses it', /await fetchArtistSingles\(sa\.name\)/.test(html));
  ok('the refetch uses it', /await window\.__scFetchArtistSingles\(sa\.name\)/.test(html));
  ok('the per-artist ↻ uses it', /await window\.__scFetchArtistSingles\(artist\)/.test(html));
  const chip = slice(html, 'window.__singlesRefreshArtistGroup = async function(groupEl){', "// Deep refetch: refetch ALL singles for an artist");
  ok('the per-artist ↻ has no raw iTunes request left', chip.indexOf('itunes.apple.com') === -1);
  ok('nothing there throws before the shared fetch runs',
    !/throw new Error\('request failed'\)/.test(chip) && chip.indexOf('__scFetchArtistSingles(artist)') !== -1);

  console.log('\n— Old songs: no play button, including from a saved snapshot —');
  const oldSongsRender = slice(html, "const lyBtn = $('discoverLastYear');", '// Album History click wiring, defined at page load');
  ok('the fresh render draws no play button', oldSongsRender.length > 500 && oldSongsRender.indexOf('dp-track-play') === -1);
  ok('its rows are still tap targets', /data-lyrow="1"/.test(oldSongsRender));

  // The snapshot guard: a body saved by an older build still carries the span.
  const staleRow = '<div class="dp-track" data-lyrow="1" data-preview="p.m4a" data-trackname="Sunn i">' +
    '<span class="dp-track-play" style="width:32px;height:32px;">\u25b6</span><div>Sunn i</div>' +
    '<span class="dp-ly-x" data-lyid="9" style="width:28px;">\u00d7</span></div>';
  let opened = null;
  const loadSrc = slice(html, 'function loadCachedDiscoverPopup(key){', 'window.orderArtistKeys');
  ok('loadCachedDiscoverPopup was extracted', loadSrc.length > 200, String(loadSrc.length));
  const store = { 'discPopupCache_\ud83d\udcc5 Old songs': JSON.stringify({ title: '\ud83d\udcc5 Old songs', body: staleRow, subtitle: '111 songs', ts: Date.now(), pins: '' }) };
  // The loader strips through the helper the first script block exports on
  // window, so the harness extracts that helper too and gives it a window to
  // hang on. Both pieces are the real shipped source, run for real.
  const stripSrc = slice(html, 'function scStripPopupPlayButtons(html){', '  // Groups from the saved snapshot, keyed by artist name.');
  ok('the shared stripper was extracted with the loader', stripSrc.length > 100, String(stripSrc.length));
  const winStub = {};
  const load = new Function('localStorage', 'openDiscoverPopup', 'window', stripSrc + '\n' + loadSrc + '\nreturn loadCachedDiscoverPopup;')(
    { getItem: (k) => (k in store ? store[k] : null) },
    (title, body, sub) => { opened = { title, body, sub }; },
    winStub
  );
  const shown = load('\ud83d\udcc5 Old songs');
  ok('a saved Old songs snapshot still opens', shown === true && !!opened);
  ok('its play button is stripped on the way in', opened && opened.body.indexOf('dp-track-play') === -1, opened && opened.body.slice(0, 120));
  ok('the row itself is untouched', opened && opened.body.indexOf('data-lyrow="1"') !== -1 && opened.body.indexOf('Sunn i') !== -1);
  ok('the remove ✕ is untouched', opened && opened.body.indexOf('dp-ly-x') !== -1);
  // Singles is cleaned too, as of the Sep 26, 2026 report: the ▶ was removed
  // from both Singles renderers (the list and the ↻ / ⚡ redraw), so a cached
  // Singles body — which is what was reported — must open without one, the same
  // way an Old songs snapshot does. No popup row carries a play button now, so
  // nothing legitimate is being stripped here.
  opened = null;
  const singlesRow = '<div class="dp-ah-artist"><div class="dp-track" data-si="0-0"><div class="dp-track-play" data-play="0-0" style="width:28px;">\u25b6</div>'
    + '<div style="flex:1;">Ghostface Killah</div><span class="dp-ah-x" data-si="0-0">\u00d7</span></div></div>';
  store['discPopupCache_\ud83c\udfb5 Singles'] = JSON.stringify({ title: '\ud83c\udfb5 Singles', body: singlesRow, subtitle: '', ts: Date.now(), pins: '' });
  load('\ud83c\udfb5 Singles');
  ok('a saved Singles list is cleaned too (no renderer draws a ▶ any more)',
    opened && opened.body.indexOf('dp-track-play') === -1, opened && opened.body.slice(0, 110));
  ok('and its rows and ✕ are left alone', !!opened
    && opened.body.indexOf('Ghostface Killah') !== -1
    && opened.body.indexOf('dp-ah-x') !== -1);

  console.log('\n— the saved lists are refreshed once on this update —');
  ok('the Singles snapshot generation is bumped to 3', /sidecut_singles_cache_gen'\) !== '3'/.test(html) && /sidecut_singles_cache_gen', '3'\)/.test(html));
  ok('Old songs has a generation of its own', /sidecut_oldsongs_cache_gen'\) !== '2'/.test(html));
  ok('it drops the Old songs snapshot', /sidecut_oldsongs_cache_gen[\s\S]{0,220}removeItem\('discPopupCache_\\ud83d\\udcc5 Old songs'\)/.test(html));

  console.log('\n— version, notes and the published bundle —');
  // This audit is for the v60.0.9 fix, which ships on its own or later. "Later"
  // is numeric: 60.0.9 is followed by 60.1, because the third number stops at
  // nine (there is no 60.0.10).
  const atLeast = (v, min) => {
    const a = String(v).split('.').map(Number), b = String(min).split('.').map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return true;
  };
  ok('index.html is v60.0.9 or later', atLeast(version, '60.0.9'), version);
  // The sw.js cache name was decoupled from APP_VERSION on Sep 26, 2026 (see
  // AGENTS.md, "sw.js cache name"): it carries its own number and must NOT be
  // repinned to a future APP_VERSION. This audit predates that decision, so it
  // checks the naming convention instead of equality — the same change the
  // test-*.mjs files were given at the time.
  ok('sw.js has a versioned cache name of its own', /const CACHE_NAME = 'sidecut-shell-v\d+(?:\.\d+)*'/.test(sw));
  ok('and it still starts on this build’s line', sw.indexOf('sidecut-shell-v' + version.split('.')[0] + '.') !== -1, version);
  const entries = [...html.matchAll(/version: '(\d+(?:\.\d+)*)', date: '([^']*)'/g)].map((m) => ({ v: m[1], d: m[2] }));
  ok('the newest entry is this build', entries[0] && entries[0].v === version, entries[0] && entries[0].v);
  ok('every recent stamp is Eastern time', entries.slice(0, 8).every((e) => /(EDT|EST)$/.test(e.d)), entries[0] && entries[0].d);
  const renum = entries.filter((e) => /^60\.0\.\d+$/.test(e.v)).map((e) => e.v).slice(0, 12);
  const renumNums = renum.map((v) => Number(v.split('.')[2]));
  ok('the 60.0.x history stays contiguous, newest first',
    renumNums.length >= 8 && renumNums.every((n, i) => i === 0 || n === renumNums[i - 1] - 1), renum.join(','));
  const own = (html.match(/\{ version: '60\.0\.9'[\s\S]*?\n  \]\}/) || [''])[0];
  ok('this build’s notes name Ranjha and the store reason', own.indexOf('Ranjha') !== -1 && own.indexOf('store') !== -1);
  ok('and say Old songs has no play button even from a saved list', /saved list/i.test(own) && /play button/i.test(own));

  let man = null;
  try { man = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8')); } catch (e) {}
  ok('the OTA manifest parses', !!man);
  ok('it names this version', man && String(man.version) === version, man && man.version);
  ok('and carries patch notes', man && Array.isArray(man.notes) && man.notes.length > 0, man && man.notes.length);
  let zipHtml = '';
  try { zipHtml = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) {}
  ok('the published zip carries the fix', zipHtml.indexOf("var stores = ['', '&country=IN'];") !== -1);
  ok('the zip version matches', (zipHtml.match(/const APP_VERSION = '([^']+)'/) || [])[1] === version);

  console.log('\n— it still parses —');
  const blocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = null;
  blocks.forEach((b, i) => {
    try { new Function(b.replace(/<\/?script[^>]*>/gi, '')); }
    catch (e) { if (!(i === 3 && String(e.message).includes('await'))) bad = `block ${i + 1}: ${e.message}`; }
  });
  ok('every inline script block parses', !bad, bad);
  ok('there are still 5 blocks', blocks.length === 5, String(blocks.length));

  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
