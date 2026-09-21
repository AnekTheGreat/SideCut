// One-off patch for v60.0.9.
//
// Two reported bugs, both verified against the live iTunes API before touching
// anything:
//
//  1. "I'm missing Ranjha by Diljit Dosanjh in Singles."
//     The Singles search has only ever asked ONE store (the default, US).
//     "Ranjha - Single" (Diljit Dosanjh, Sia & David Guetta, 2026-03-12) is not
//     in the US catalogue at all:
//        search?term=Diljit Dosanjh&entity=song&limit=200          -> not found
//        search?term=Diljit Dosanjh&entity=song&limit=200&country=IN -> in the
//        results, near the top
//     So no filter tuning could ever surface it; the query itself never saw it.
//     The fix runs the SAME curated search against both stores and merges, so it
//     cannot become the flood the 58.9.6 release-list union caused (that one was
//     reverted after "over a hundred songs appeared"). Measured live:
//        Diljit Dosanjh 41 -> 46  (Ranjha, Shivaya, Chauffeur, Jugni, Kali Teri Gutt)
//        BK             19 -> 29
//        Karan Aujla    89 -> 90
//        Arsh Heer      28 -> 28
//        AP Dhillon     37 -> 37
//
//  2. "In Old songs the play button should be removed."
//     v60 removed it from the markup, but the popup is served from a 24-hour
//     localStorage snapshot that outlives an app update — so a copy written by
//     an older build (which did draw a play button per row) kept showing one
//     after updating. Older snapshots are now dropped once, and a play button
//     inside any saved copy is stripped on load.
//
//   node dev/_patch_v609.cjs
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

let s = fs.readFileSync(HTML, 'utf8');
let changed = 0;
function rep(label, from, to, expect) {
  const n = s.split(from).length - 1;
  if (n !== expect) {
    console.error(`MISMATCH [${label}] found ${n}, expected ${expect}`);
    console.error('--- looked for ---\n' + from.slice(0, 300));
    process.exit(1);
  }
  s = s.split(from).join(to);
  changed += n;
  console.log(`  ok ${label} (${n})`);
}

/* 1 ── Singles: search both stores, not just the default one. ------------- */
const FROM_FETCH = String.raw`  // It is the iTunes *song* search alone, filtered to one-track releases — the
  // list this has always produced. 58.9.6 also unioned in each artist's own
  // release list; that pulled in releases the song search never returned, and it
  // was reported as well over a hundred songs appearing in Singles that are not
  // the user's artists. Reverted.
  async function fetchArtistSingles(artistName, opts){
    opts = opts || {};
    var skipHidden = !opts.includeHidden;
    var out = [];
    var seen = {};
    try{
      var sresp = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(artistName) + '&media=music&entity=song&limit=200');
      if(sresp && sresp.ok){
        var sdata = await sresp.json();
        var want = String(primaryArtistName(artistName) || '').toLowerCase().trim();
        (sdata.results || []).forEach(function(sr){`;

const TO_FETCH = String.raw`  // It is the iTunes *song* search, filtered to one-track releases — the list
  // this has always produced — asked of MORE THAN ONE STORE.
  //
  // 58.9.6 unioned in each artist's own release list instead; that pulled in
  // releases the song search never returned, and it was reported as well over a
  // hundred songs appearing in Singles that are not the user's artists, so it
  // was reverted. This is the same curated search as before, only store-scoped —
  // and that is what actually fixes a missing single: the search is
  // relevance-ranked per store, and a release that only exists in the Indian
  // store is invisible to the default (US) one. "Ranjha - Single" (Diljit
  // Dosanjh, Sia & David Guetta, March 2026) is exactly that — the US query
  // cannot return it at any limit, while the same query for the IN store puts it
  // near the top. Measured against the live API, the extra store adds 5 singles
  // for Diljit Dosanjh, 10 for BK and 1 for Karan Aujla — nothing like the
  // hundred-odd the release-list union produced.
  async function fetchArtistSingles(artistName, opts){
    opts = opts || {};
    var skipHidden = !opts.includeHidden;
    var out = [];
    var seen = {};
    var want = String(primaryArtistName(artistName) || '').toLowerCase().trim();
    // Default store first, then the Indian store (plenty of Punjabi and Indian
    // film releases are IN-only). Identical filter and identical dedupe for
    // both, so the two stores can never disagree about what a single is.
    var stores = ['', '&country=IN'];
    for(var sti=0; sti<stores.length; sti++){
      try{
      var sresp = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(artistName) + '&media=music&entity=song&limit=200' + stores[sti]);
      if(sresp && sresp.ok){
        var sdata = await sresp.json();
        (sdata.results || []).forEach(function(sr){`;

rep('singles: per-store search', FROM_FETCH, TO_FETCH, 1);

// …and close the new loop where the single-store version closed its try.
const FROM_TAIL = String.raw`        });
      }
    }catch(_e1){}
    out.sort(function(x, y){ return String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')); });
    return out;
  }
  window.__scFetchArtistSingles = fetchArtistSingles;`;

const TO_TAIL = String.raw`        });
      }
      }catch(_e1){}
    }
    out.sort(function(x, y){ return String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')); });
    return out;
  }
  window.__scFetchArtistSingles = fetchArtistSingles;`;

rep('singles: close the store loop', FROM_TAIL, TO_TAIL, 1);

/* 2 ── The per-artist ↻ chip had a dead raw request in front of the real one.
   It had no proxy fallback and asked only the default store, so a direct fetch
   that failed aborted the refresh before the shared fetch ran, and an
   Indian-store-only single could never come back on a per-artist refresh. */
rep(
  'per-artist refresh: drop the dead raw fetch',
  String.raw`  var ok = false;
  try{
    var sresp = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(artist) + '&media=music&entity=song&limit=200');
    if(!sresp || !sresp.ok) throw new Error('request failed');
    var sdata = await sresp.json();
    // Same fetch as everywhere else, with the hidden list applied so removed
    // tracks never come back on a per-artist refresh.
    var matched = (typeof window.__scFetchArtistSingles === 'function') ? await window.__scFetchArtistSingles(artist) : [];`,
  String.raw`  var ok = false;
  try{
    // The shared fetch does the work — with the hidden list applied so removed
    // tracks never come back. The raw request (and its unused response) that
    // used to sit above this is gone: it had no proxy fallback and asked only
    // the default store, so one direct fetch failure aborted the refresh before
    // the real call ran.
    var matched = (typeof window.__scFetchArtistSingles === 'function') ? await window.__scFetchArtistSingles(artist) : [];`,
  1
);

/* 3 ── Snapshot generations. The saved Singles list has to be rebuilt once so
   the newly found singles (Ranjha) are actually visible without a manual
   refetch, and the saved Old songs list has to be dropped if it was written by
   a build that still drew a play button on every row. */
rep(
  'snapshot generations (singles 2 -> 3, old songs added)',
  String.raw`    if(localStorage.getItem('sidecut_singles_cache_gen') !== '2'){
      localStorage.removeItem('discPopupCache_\u{1f3b5} Singles');
      localStorage.setItem('sidecut_singles_cache_gen', '2');
    }
  }catch(_eSinglesGen){}`,
  String.raw`    if(localStorage.getItem('sidecut_singles_cache_gen') !== '3'){
      localStorage.removeItem('discPopupCache_\u{1f3b5} Singles');
      localStorage.setItem('sidecut_singles_cache_gen', '3');
    }
    // The saved "Old songs" snapshot outlives an app update: a copy written by a
    // build that still drew a play button on every row could be served for up to
    // 24 hours after the update that removed it. Older snapshots are dropped
    // once, and loadCachedDiscoverPopup strips any play button a saved copy
    // still carries.
    if(localStorage.getItem('sidecut_oldsongs_cache_gen') !== '2'){
      localStorage.removeItem('discPopupCache_\ud83d\udcc5 Old songs');
      localStorage.setItem('sidecut_oldsongs_cache_gen', '2');
    }
  }catch(_eSinglesGen){}`,
  1
);

/* 4 ── A saved copy that still carries a play button loses it on open, so the
   row is the only tap target exactly as it is in a freshly fetched list. */
rep(
  'cached popup: strip Old songs play buttons',
  String.raw`function loadCachedDiscoverPopup(key){
  try{
    var raw = localStorage.getItem('discPopupCache_' + key);
    if(!raw) return false;
    var d = JSON.parse(raw);
    if(d && d.title && d.body){ openDiscoverPopup(d.title, d.body, d.subtitle); return true; }
  }catch(e){}
  return false;
}`,
  String.raw`function loadCachedDiscoverPopup(key){
  try{
    var raw = localStorage.getItem('discPopupCache_' + key);
    if(!raw) return false;
    var d = JSON.parse(raw);
    if(d && d.title && d.body){
      // Old songs rows are the tap target — no play button. A snapshot saved
      // before that change (the cache survives an app update) can still hold
      // one per row, so it is stripped here rather than shown.
      var isOldSongs = key === '\ud83d\udcc5 Old songs' || d.title === '\ud83d\udcc5 Old songs';
      if(isOldSongs && d.body.indexOf('dp-track-play') !== -1){
        d.body = d.body.replace(/<span[^>]*class="dp-track-play"[\s\S]*?<\/span>/g, '');
      }
      openDiscoverPopup(d.title, d.body, d.subtitle);
      return true;
    }
  }catch(e){}
  return false;
}`,
  1
);

/* 5 ── Version bump + patch notes (the version is the OTA's delivery mechanism). */
const now = new Date();
const dateStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' }).format(now);
const timeStr = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(now);
const zone = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', timeZoneName: 'short' }).formatToParts(now).find((p) => p.type === 'timeZoneName');
const stamped = `${dateStr} \\u00b7 ${timeStr} ${zone ? zone.value : 'ET'}`;
console.log('  changelog stamp: ' + stamped.replace('\\u00b7', '-'));

rep('APP_VERSION', `const APP_VERSION = '60.0.8';`, `const APP_VERSION = '60.0.9';`, 1);

rep(
  'CHANGELOG head',
  `  { version: '60.0.8', date: '`,
  `  { version: '60.0.9', date: '${stamped}', title: 'Singles that only exist in the Indian store show up now, and Old songs has no play button even from a saved list', items: [
    'Missing singles are found. The Singles search only ever asked Apple\\u2019s default (US) store, and a release that is not in that catalogue cannot come back at any limit \\u2014 \\u201cRanjha - Single\\u201d (Diljit Dosanjh, Sia & David Guetta, March 2026) is exactly that case: the US query returns nothing for it, while the same query in the Indian store returns it near the top. That is why no filter tuning could ever find it',
    'The same search is now asked of both stores and merged, with one identical filter and dedupe, so it cannot become the flood the old release-list union caused. Measured live: Diljit Dosanjh 41 \\u2192 46 singles (Ranjha, Shivaya, Chauffeur, Jugni, Kali Teri Gutt), BK 19 \\u2192 29, Karan Aujla 89 \\u2192 90, Arsh Heer and AP Dhillon unchanged',
    'Your saved Singles list is rebuilt once on this update, so the new ones appear without you having to tap Refetch singles',
    'The \\u21bb button on an artist\\u2019s Singles group uses that same two-store search now. It also had a stray direct request in front of it with no fallback, which aborted the whole refresh if that one request failed and never asked the Indian store at all \\u2014 both gone',
    'Old songs has no play button, including from a saved list. The row-level play button was removed in v60, but the popup is served from a snapshot that survives an app update, so a copy saved by an older build kept showing one. Older snapshots are dropped and any play button inside a saved copy is stripped when it opens \\u2014 tapping a row goes to the song, exactly like Singles and album tracks',
  ]},
  { version: '60.0.8', date: '`,
  1
);

fs.writeFileSync(HTML, s);
console.log(`index.html: ${changed} replacements`);

let sw = fs.readFileSync(SW, 'utf8');
const swFrom = `const CACHE_NAME = 'sidecut-shell-v60.0.8';`;
if (sw.split(swFrom).length - 1 !== 1) { console.error('MISMATCH [sw.js CACHE_NAME]'); process.exit(1); }
fs.writeFileSync(SW, sw.replace(swFrom, `const CACHE_NAME = 'sidecut-shell-v60.0.9';`));
console.log('sw.js: CACHE_NAME -> sidecut-shell-v60.0.9');
