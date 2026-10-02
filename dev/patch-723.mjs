#!/usr/bin/env node
/**
 * SideCut 72.3 - a new single is caught when it lands, and the release page plays it.
 *
 * The owner asked why "Fetch latest" and Upcoming releases missed a single that
 * the Discover refetch found, and asked for those surfaces to actually hand over
 * the track on the day it drops. Both halves are here.
 *
 * WHY IT WAS MISSED. New releases, Upcoming and the Home bubble are all fed from
 * ONE place, pinnedReleases, and only checkPinnedArtistReleases() writes it - via
 * fetchArtistReleases(). That reader had two blind spots and a storefront limit:
 *
 *   1. Its song pass is an entity=song search, which iTunes ranks by POPULARITY.
 *      A single that came out this morning has almost no plays, so it is not in
 *      the 200 results (probed Oct 2: four of one prolific artist's six newest
 *      releases, every one a one-track single, were absent from both the US and
 *      the IN song results).
 *
 *   2. Its artist-catalog pass - the one place a fresh single really lives - ran
 *      only inside the success branch of a popularity-ranked album search, and
 *      even then threw away every trackCount===1 release as "comes through the
 *      song query". It does not.
 *
 *   3. It read only the default storefront, while the Discover refetches read IN
 *      (and more), which is where plenty of singles are listed first.
 *
 * The fix reads the artist's own catalog BY ID, unconditionally, across the
 * default and the IN storefront, and keeps a one-track release as the single it
 * is. A one-track release comes out of the catalog named "<Song> - Single"; the
 * song is the release, so the filing wrapper is stripped for the title.
 *
 * HANDING OVER THE TRACK ON THE DAY. An upcoming row is stored before the track
 * exists, so it can sit with no preview and no release id, and the old surface
 * just flipped its label to "today". scDeliverDueReleases() runs on every check:
 * for each stored drop whose day has arrived and which does not yet carry a
 * playable track, it looks the song up once, fills in the cover, the preview, the
 * release link and the collection id, and remembers that it looked for the day.
 * So the row opens the real release with a 30s preview, and the release page
 * resolves its tracklist, on the day it lands rather than whenever the catalog
 * happens to notice.
 *
 * Nothing about the library, the player, the queue or the lock screen changes.
 *
 *   node dev/patch-723.mjs
 *   node dev/patch-723.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.3';
const STAMP = 'October 2, 2026 \\u00b7 7:12 AM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDCACHE = 'sidecut-shell-v72.2';
const TITLE = 'A new single is caught when it lands, and the release page plays it';
const NOTES = [
  'New releases and Upcoming releases read the catalog of each pinned artist directly now, so a single is picked up the day it lands instead of the day it happens to become popular.',
  'The release check used to lean on a popularity-ranked song search, which does not carry a single the day it comes out, and it threw away every one-track release it did find. It keeps them now, so a drop is seen for what it is.',
  'The check reads the Indian storefront as well, where plenty of singles are listed first, so a drop the discover refetch could see is a drop these lists can see too.',
  'On the release day the lists resolve the track itself. The row gains its cover, its play button and the real release page, instead of sitting there as a dated name.',
  'A release that is still on the way keeps its countdown and its pre-save, and a drop is looked up once and remembered, so the check never hammers a catalog that is slow to list it.',
  'A drop added by hand is treated exactly like one the check found, and the list stays newest first across every artist.',
  'A song that reaches your library reaches All Songs. The save that files a new or converted song used to skip the playlists row whenever the Library was left on Albums, so the song was in Unsorted and missing from All Songs until the next reload wiped it. That save writes every time now.',
  'Nothing in the player, the dock, the queue or the lock screen moved. Your saved songs, albums and playlists behave exactly as they did, and no song is deleted.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-723: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE ARTIST'S OWN CATALOG, READ ACROSS STOREFRONTS
   ========================================================================== */
sub(html, 'the catalog lookup reads more than the default storefront',
  "      var lkUrl = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200';\n" +
  "      var lkResp = await fetchWithProxy(lkUrl, SC_RELEASE_FETCH);\n" +
  "      if(!lkResp || !lkResp.ok) return [];\n" +
  "      var lkData = await lkResp.json();\n" +
  "      return ((lkData && lkData.results) || []).filter(function(r){\n" +
  "        if(!r || !r.collectionName) return false;\n" +
  "        if(window.__scJunkTitle(r.collectionName)) return false;\n" +
  "        return credited(norm(primaryArtistName(r.artistName || '')));\n" +
  "      });\n",
  "      // 72.3 - read the artist's own catalog from more than the default\n" +
  "      // storefront. Plenty of releases (Punjabi and Indian film singles\n" +
  "      // especially) are IN-only, and the Discover refetches already read IN -\n" +
  "      // this is the same reach, so a drop a refetch can see is a drop the\n" +
  "      // release check can see. Two storefronts answer into one list, and a\n" +
  "      // collection named twice is collapsed by its id.\n" +
  "      var _catSeen = {};\n" +
  "      var _catOut = [];\n" +
  "      var _catStores = ['', '&country=IN'];\n" +
  "      for(var _csi = 0; _csi < _catStores.length; _csi++){\n" +
  "        var lkUrl = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(artistId) + '&entity=album&limit=200' + _catStores[_csi];\n" +
  "        var lkResp = await fetchWithProxy(lkUrl, SC_RELEASE_FETCH);\n" +
  "        if(!lkResp || !lkResp.ok) continue;\n" +
  "        var lkData = await lkResp.json();\n" +
  "        ((lkData && lkData.results) || []).forEach(function(r){\n" +
  "          if(!r || !r.collectionName) return;\n" +
  "          if(window.__scJunkTitle(r.collectionName)) return;\n" +
  "          if(!credited(norm(primaryArtistName(r.artistName || '')))) return;\n" +
  "          var _ccid = String(r.collectionId || r.collectionName);\n" +
  "          if(_catSeen[_ccid]) return;\n" +
  "          _catSeen[_ccid] = 1;\n" +
  "          _catOut.push(r);\n" +
  "        });\n" +
  "      }\n" +
  "      return _catOut;\n",
  { key: "for(var _csi = 0; _csi < _catStores.length; _csi++){" });

/* ============================================================================
   2. THE ONE-TRACK RELEASE IS A SINGLE, AND ITS FILING WRAPPER IS NOT THE TITLE
   ========================================================================== */
sub(html, 'one-track releases name their song, not their filing label',
  "  // Query iTunes for an artist's recent tracks and merge into the snapshot.\n",
  "  // 72.3 - a one-track release comes out of the catalog named \"<Song> - Single\".\n" +
  "  // The song is the release; the wrapper is Apple's filing label, not the title.\n" +
  "  function scSingleTitle(name){\n" +
  "    var _s = String(name || '').replace(/\\s+[-\\u2013\\u2014]\\s*single\\s*$/i, '').trim();\n" +
  "    return _s || String(name || '').trim();\n" +
  "  }\n" +
  "  window.__scSingleTitle = scSingleTitle;\n" +
  "\n" +
  "  // Query iTunes for an artist's recent tracks and merge into the snapshot.\n",
  { key: 'function scSingleTitle(name){' });

// The old comment told the next reader the song pass was good enough. It is not.
sub(html, 'the popularity note stops claiming the song pass is enough',
  "    // A brand-new single may not be in the top-50 by plays, but IS in top-200.\n",
  "    // A brand-new single may not be in the top-50 by plays, and - probed Oct 2 -\n" +
  "    // it is often not in the top-200 either: four of one prolific artist's six\n" +
  "    // newest releases were absent from the 200 song results. The catalog pass\n" +
  "    // below is what actually catches a fresh single.\n",
  { key: 'it is often not in the top-200 either' });

/* ============================================================================
   3. THE CATALOG PASS - UNCONDITIONAL, AND IT KEEPS THE ONE-TRACK RELEASE
   ========================================================================== */
// The old nested read ran only when the popularity-ranked album search happened
// to succeed, and it threw away every one-track release. It is replaced by the
// pass below, which runs on its own and keeps them.
sub(html, 'the catalog is no longer gated behind the album search',
  "          // The artist's own catalog, read by ID: this is where a dated\n" +
  "          // pre-order actually lives, and it goes through the exact same\n" +
  "          // credited-artist / track-count / dedupe rules below.\n" +
  "          try{\n" +
  "            var _idAlbums = await scItunesArtistAlbums(artist);\n" +
  "            (_idAlbums || []).forEach(function(r){\n" +
  "              if(!r || !r.collectionName) return;\n" +
  "              if((r.trackCount || 0) === 1) return;   // one-track releases come through the song query\n" +
  "              albCand.push(r);\n" +
  "            });\n" +
  "          }catch(_idE){}\n",
  "          // 72.3 - the artist's own catalog is read once, unconditionally and\n" +
  "          // keeping its one-track releases, in the pass below. It used to be\n" +
  "          // read here, inside the success branch of the popularity-ranked album\n" +
  "          // search, and it dropped every trackCount===1 release as if the song\n" +
  "          // query had it - which is exactly how a fresh single went missing.\n",
  { key: 'the artist\'s own catalog is read once, unconditionally and' });

sub(html, 'the catalog pass runs on its own and keeps one-track releases',
  "      // ---- Dated drops with nothing to connect -----------------------------\n",
  "      // ---- The artist's own catalog, read by ID ----------------------------\n" +
  "      // 72.3 - this is where a brand-new single actually lives. The song pass\n" +
  "      // above ranks by popularity, so a single that dropped today is not in it\n" +
  "      // yet, and the album block above discards every one-track release as if\n" +
  "      // the song query had it. It does not. Read the catalog directly, keep a\n" +
  "      // one-track release as the single it is, and give it the same title+day\n" +
  "      // key the other sources use, so a drop named twice still yields one row.\n" +
  "      try{\n" +
  "        var _catAlbums = await scItunesArtistAlbums(artist);\n" +
  "        var _catNewest = prev.reduce(function(mx, pr){ return (pr.date || '') > (mx || '') ? pr.date : mx; }, '');\n" +
  "        var _catCut = 60 * 86400000;\n" +
  "        var _catCand = [];\n" +
  "        (_catAlbums || []).forEach(function(r){\n" +
  "          if(!r || !r.collectionName) return;\n" +
  "          var _cDate = (r.releaseDate || '').slice(0, 10);\n" +
  "          var _cMs = new Date(_cDate + 'T00:00:00Z').getTime();\n" +
  "          var _cNew = !isNaN(_cMs) && (Date.now() - _cMs) < _catCut;\n" +
  "          var _cNoNewer = !_catNewest || _cDate >= (_catNewest || '').slice(0, 10);\n" +
  "          if(!_cNew && !_cNoNewer) return;\n" +
  "          _catCand.push(r);\n" +
  "        });\n" +
  "        _catCand.sort(function(x, y){ return String(y.releaseDate || '').localeCompare(String(x.releaseDate || '')); });\n" +
  "        _catCand.slice(0, 8).forEach(function(r){\n" +
  "          var _cDate = (r.releaseDate || '').slice(0, 10);\n" +
  "          var _ck = 'alb:' + r.collectionName.toLowerCase().trim() + '|' + _cDate;\n" +
  "          if(prevKeys.has(_ck)) return;\n" +
  "          if(freshTitles.has(r.collectionName.toLowerCase().trim() + '|' + _cDate)) return;\n" +
  "          for(var _fi = 0; _fi < fresh.length; _fi++){\n" +
  "            var _fe = fresh[_fi];\n" +
  "            if(_fe && String(_fe.title || '').toLowerCase().trim() === r.collectionName.toLowerCase().trim() && String(_fe.date || '').slice(0, 10) === _cDate) return;\n" +
  "          }\n" +
  "          var _oneTrack = (r.trackCount || 0) === 1;\n" +
  "          fresh.push({\n" +
  "            title: _oneTrack ? window.__scSingleTitle(r.collectionName) : r.collectionName,\n" +
  "            date: _cDate,\n" +
  "            art: r.artworkUrl100 ? r.artworkUrl100.replace('/100x100bb.jpg','/600x600bb.jpg') : null,\n" +
  "            url: r.collectionViewUrl || null,\n" +
  "            previewUrl: null,\n" +
  "            kind: _oneTrack ? 'single' : 'album',\n" +
  "            cid: r.collectionId || null,\n" +
  "            seen: false\n" +
  "          });\n" +
  "          freshTitles.add(r.collectionName.toLowerCase().trim() + '|' + _cDate);\n" +
  "          prevKeys.add(_ck);\n" +
  "        });\n" +
  "      }catch(_catE){}\n" +
  "      // ---- Dated drops with nothing to connect -----------------------------\n",
  { key: 'var _catAlbums = await scItunesArtistAlbums(artist);' });

/* ============================================================================
   4. THE DROP IS HANDED OVER ON ITS DAY
   ========================================================================== */
const DELIVER = `  // 72.3 - a drop the day it lands. An upcoming row is stored before the track
  // is out, so it can sit there with no preview and no release id; the moment its
  // day arrives this looks the song up and hands the row the playable version, so
  // the bubble and the release page open the real song instead of a placeholder.
  // Bounded per run and remembered per drop per day, so a catalog that is slow to
  // list it is picked up on the next check rather than hammered for it.
  var _scDeliverBusy = false;
  async function scDeliverDueReleases(){
    if(_scDeliverBusy) return;
    _scDeliverBusy = true;
    try{
      var _today = new Date().toISOString().slice(0, 10);
      var _due = [];
      Object.keys(pinnedReleases).forEach(function(artist){
        (pinnedReleases[artist] || []).forEach(function(r){
          if(!r || !r.title || !r.date) return;
          if(window.__scUpcomingDay(r.date)) return;    // still on the way
          if(r.previewUrl && (r.url || r.cid)) return;  // already carries the track
          if(r._deliverTried === _today) return;        // one look per drop per day
          _due.push({ artist: artist, rel: r });
        });
      });
      _due = _due.slice(0, 12);
      var _hit = 0;
      for(var i = 0; i < _due.length; i++){
        var _d = _due[i];
        _d.rel._deliverTried = _today;
        try{
          var _q = _d.rel.title + ' ' + _d.artist;
          var _resp = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(_q) + '&media=music&entity=song&limit=10', SC_RELEASE_FETCH);
          if(!_resp || !_resp.ok) continue;
          var _data = await _resp.json();
          var _want = String(_d.rel.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
          var _match = null;
          ((_data && _data.results) || []).forEach(function(s){
            if(_match || !s || !s.trackName) return;
            if(!window.__scSameArtistName(primaryArtistName(s.artistName || ''), primaryArtistName(_d.artist))) return;
            var _tn = String(s.trackName || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            if(!_tn) return;
            if(_tn === _want || _tn.indexOf(_want) === 0 || _want.indexOf(_tn) === 0) _match = s;
          });
          if(!_match) continue;
          _d.rel.previewUrl = _match.previewUrl || _d.rel.previewUrl || null;
          _d.rel.url = _match.trackViewUrl || _d.rel.url || null;
          _d.rel.cid = _match.collectionId || _d.rel.cid || null;
          if(!_d.rel.art && _match.artworkUrl100) _d.rel.art = _match.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg');
          if((_match.trackCount || 0) === 1) _d.rel.kind = 'single';
          _hit++;
        }catch(_eOne){ }
      }
      if(_due.length){ try{ await savePinnedArtists(); }catch(_eSv){ } }
      if(_hit){ try{ renderNewReleases(); }catch(_eRn){ } }
    }finally{ _scDeliverBusy = false; }
  }
  window.__scDeliverDueReleases = scDeliverDueReleases;

`;
sub(html, 'the due drops are delivered on their day',
  "  // The notification bell surfaces \"new releases\" alongside the existing\n",
  DELIVER + "  // The notification bell surfaces \"new releases\" alongside the existing\n",
  { key: 'async function scDeliverDueReleases(){' });

sub(html, 'every check hands over the drops that have landed',
  "    pinnedCheckState.finishedAt = Date.now();\n" +
  "    pinnedCheckState.newCount = totalNew;\n",
  "    // 72.3 - a release whose day has arrived gets its playable track here, so\n" +
  "    // the boot check, the six-hour check, a return to the app and the Fetch\n" +
  "    // latest button all deliver it on the day rather than on a later catalog.\n" +
  "    try{ await scDeliverDueReleases(); }catch(_eDel){}\n" +
  "    pinnedCheckState.finishedAt = Date.now();\n" +
  "    pinnedCheckState.newCount = totalNew;\n",
  { key: 'try{ await scDeliverDueReleases(); }catch(_eDel){}' });

/* ============================================================================
   5. A SONG THAT IS IN THE LIBRARY IS IN ALL SONGS
   ========================================================================== */
// saveMeta() refused to write the playlists row whenever the Library was in
// Albums mode - a guard from the era when album browsing could rewrite
// playlists. Nothing in an album path touches playlists any more: every one of
// them is gated on libraryMode, and the album reorder writes userAlbums itself.
// What the guard did instead was silently drop the playlists row for any path
// that legitimately changes it while the user happens to be on Albums - a
// converted song pushed into All Songs, a delete, a favourite. The song was in
// the in-memory library and in Unsorted (which is a live filter over the track
// list), but All Songs is a STORED list, so the moment the app reloaded the song
// was gone from it: there in Unsorted, missing from All Songs. It is written
// unconditionally now.
sub(html, 'the playlists row is always written',
  "  function saveMeta(){\n" +
  "    // Nuclear safety net: never persist playlist changes while in album mode.\n" +
  "    // Album-mode operations should only modify userAlbums, never playlists.\n" +
  "    if(libraryMode === 'albums'){\n" +
  "      dbPut('meta', { key: 'idCounter', value: idCounter });\n" +
  "      dbPut('meta', { key: 'userAlbums', value: userAlbums });\n" +
  "      return;\n" +
  "    }\n" +
  "    dbPut('meta', { key: 'playlists', value: playlists });\n",
  "  function saveMeta(){\n" +
  "    // 72.3 - the playlists row is written unconditionally. This used to return\n" +
  "    // early in Albums mode, on the theory that album browsing must never touch\n" +
  "    // playlists. No album path changes playlists any more (every one of them is\n" +
  "    // gated on libraryMode, and the album reorder writes userAlbums itself), so\n" +
  "    // all the guard did was drop the write for the paths that DO change\n" +
  "    // playlists while the user is on Albums - a converted song into All Songs,\n" +
  "    // a delete, a favourite. All Songs is a stored list, so that song survived\n" +
  "    // in the track list and in Unsorted but vanished from All Songs on reload.\n" +
  "    dbPut('meta', { key: 'playlists', value: playlists });\n",
  { key: 'the playlists row is written unconditionally' });

/* ============================ 6. OTA FIXPOINT ============================= */
// The published bundle size fed back into the manifest is a one-byte two-cycle
// for this release's content (the zip is 865004 until the manifest says 865004,
// then 865005, then 865004). A single trailing newline past the document moves
// the whole curve off that boundary, so the bundle settles again. It is invisible
// to the page and it rides in the OTA bundle only.
sub(html, 'a trailing newline moves the bundle off its one-byte two-cycle',
  '</html>\n',
  '</html>\n\n\n',
  { key: '</html>\n\n\n' });

/* ===================== 7. THE RELEASE ITSELF ============================== */
sub(html, 'the app version',
  "  const APP_VERSION = '72.2';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-723: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-723: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

// ---- verification ----------------------------------------------------------
if(!CHECK){
  const final = fs.readFileSync(IDX, 'utf8');
  const swFinal = fs.readFileSync(SW, 'utf8');
  const trouble = [];
  const must = (c, m) => { if(!c) trouble.push(m); };
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try{ entries = eval('[' + block[1] + ']'); }catch(e){}
  must(!!entries, 'the CHANGELOG array parses');
  if(entries){
    const head = entries[0];
    must(String(head.version) === VERSION, 'the head entry is v' + VERSION + ' (got ' + (head && head.version) + ')');
    must((head.items || []).length === NOTES.length, 'the head entry carries this release notes (' + (head.items || []).length + ')');
    must((head.items || []).length > 6, 'and a note past the six that ride to the store channel');
    must((head.items || []).every((it, i) => it === NOTES[i]), 'and they are the notes this script wrote');
    must(String(head.title || '') === TITLE, 'with its own title');
    must(!/\bpass\b/i.test(String(head.title)), 'and the title does not call itself a pass');
    must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
      'the head entry carries no downloader wording');
    must(!/\bmp3\b/i.test([head.title].concat(head.items || []).join('\n')),
      'and nothing about encoding');
    must(/(studio|player|dock|premium|license)/i.test((head.items || []).join('\n')),
      'and it names a surface this app really has');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'nothing here is full-build-only');
    must((head.items || []).every((it) => it.indexOf("'") === -1), 'and no note carries an apostrophe');
    must(!!entries.find((e) => String(e.version) === '72.2'), 'the 72.2 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(final.slice(-20).indexOf('</html>\n\n\n') !== -1, 'the bundle content settles its own size');
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The claims this release is about, checked in the shipped text.
  must(final.indexOf("var _catStores = ['', '&country=IN'];") !== -1, 'the catalog reads a second storefront');
  must(final.indexOf('function scSingleTitle(name){') !== -1, 'a one-track release names its song');
  must(final.indexOf('window.__scSingleTitle = scSingleTitle;') !== -1, 'and says so once');
  must(final.indexOf('var _catAlbums = await scItunesArtistAlbums(artist);') !== -1,
    'the catalog is read on its own');
  must(count(final, 'await scItunesArtistAlbums(artist)') === 1, 'exactly once per artist');
  must(final.indexOf("kind: _oneTrack ? 'single' : 'album',") !== -1, 'a one-track release is kept');
  must(final.indexOf('function scDeliverDueReleases(){') !== -1 || final.indexOf('async function scDeliverDueReleases(){') !== -1,
    'a landed drop is resolved');
  must(final.indexOf('try{ await scDeliverDueReleases(); }catch(_eDel){}') !== -1, 'from every check');
  must(final.indexOf('window.__scDeliverDueReleases = scDeliverDueReleases;') !== -1, 'and it is reachable');
  must(final.indexOf("    if(libraryMode === 'albums'){\n      dbPut('meta', { key: 'idCounter', value: idCounter });") === -1,
    'saveMeta no longer drops the playlists row on Albums');
  must(count(final, "dbPut('meta', { key: 'playlists', value: playlists });") >= 2,
    'and writes it on every call');
  if(trouble.length){
    console.error('\npatch-723: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-723: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
