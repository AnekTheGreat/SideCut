#!/usr/bin/env node
/**
 * SideCut 72.5 - All Songs tells the truth about every song in it.
 *
 * The owner's report: duplicate songs in All Songs, songs that exist in the app
 * missing from All Songs, a duplicate where deleting one deletes the other, a
 * search for one artist returning a different one, the run counting songs as
 * added while the list stayed empty, and the lookup taking forever. They are
 * three separate faults and all three are here.
 *
 * WHY A SONG COULD APPEAR TWICE, AND WHY DELETING ONE TOOK THE OTHER.
 * All Songs is an array of track ids, and a row is that id looked up in the
 * track map. Nothing anywhere ever removed a repeat from that array: the boot
 * repair only ever asked whether an id was PRESENT (a Set of the ids, not a
 * cleanup), and the two paths that file a song into All Songs pushed without
 * asking. So an id that got in twice rendered the same song twice, and
 * deleteTrack filters every playlist by id - one tap removed both rows, because
 * they were never two songs. Every playlist is flattened on the next launch and
 * the render drops a repeat as a last line of defence.
 *
 * WHY TWO SONGS COULD SHARE AN ID. The next id came from a stored counter with
 * `metaMap.idCounter || allTracks.length` as its fallback, and the number fell
 * back to the COUNT of songs. Delete anything, or come back from an older
 * saved state (the snapshot restore rewrites the whole meta store and reloads),
 * and the counter was suddenly below ids that were already in use - so a new
 * song was handed an id an older song already had. Two tracks on one id is one
 * row in the map, one row in the list, and one delete that takes both. The next
 * id is worked out from the ids actually on the device now, and every new song
 * asks for a free one.
 *
 * WHY A SEARCH FOR AN ARTIST RETURNED SOMEONE ELSE. The filter matched the
 * album field exactly as hard as the name and the artist. Combined with the
 * next fault - every song of a converted playlist was stamped with the
 * PLAYLIST's name as its album - one singer's name in that tag answered for
 * every song in the list, so looking up one performer returned unrelated ones.
 * The name and the artist decide the result now; an album-only match is shown
 * only when nothing in the library is named or credited that way. And a
 * playlist name is no longer written into a song's album.
 *
 * WHY THE RUN SAID "ADDED" WHILE THE LIST STAYED EMPTY. Filing a song drew the
 * list through the deferred render, which refuses to draw while the list is
 * moving and re-arms itself for the next frame - so a song could land and not be
 * seen until the list next settled. It is drawn at once now, armed first because
 * the outright draw needs a pending frame.
 *
 * WHY THE LOOKUP TOOK SO LONG. The verify loop called the player API for up to
 * TEN candidates one after another before it found the right one, and every one
 * of those calls is a request - including the candidates whose own length, which
 * the search had already told us, ruled them out. The length is checked first
 * now (no request), the loop stops the moment a full-length match is in hand,
 * and the two extra searches only run when the first search plainly does not
 * carry the track. A song that used four requests takes one.
 *
 * EVERY sub carries a `key`, so re-running this script on a tree that already
 * has it applied is a no-op instead of a second insertion. That mattered: two
 * of these are INSERTIONS whose anchor survives, and an unkeyed re-run put the
 * block in twice.
 *
 * Nothing about playback, the queue, the lock screen or a saved song changes.
 *
 *   node dev/patch-725.mjs
 *   node dev/patch-725.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.5';
const STAMP = 'October 2, 2026 \\u00b7 3:34 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.4';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'All Songs tells the truth about every song in it';
const NOTES = [
  'A song can no longer appear twice in All Songs. A list that had picked up a repeated entry is flattened on the next launch, and one is never filed twice again.',
  'Every song in the library is in All Songs. A song that was added to the library but left out of the list is put back on the next launch, and a song is drawn the moment it lands rather than when the list next gets a chance.',
  'No two songs can share a library id any more. The next free id is worked out from the songs actually on the device, so an id from an older save can never be handed to a new song, which is what made two rows behave as one.',
  'A search for an artist returns that artist. The album a song carries no longer answers a search on its own unless nothing in your library is named or credited that way, so looking up one performer stops returning others.',
  'A playlist is not an album. Songs taken from one no longer have the playlist name written into their album, which is what put unrelated performers in the same search result.',
  'The lookup that finds the audio asks for much less. A candidate whose length already rules it out costs no request, and the search stops as soon as a full-length match is in hand.',
  'A long run finishes sooner for the same reason, and a song that fails is still the one retry it always had, so nothing is skipped to save a request.',
  'Nothing in the player, the dock or the queue moved. Your saved songs, albums and playlists are read exactly as they were, and no song is deleted.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

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

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// Already at this release, padding and all? Nothing to do, whether or not
// --check was passed. (Every sub below also carries a key, but the padding move
// REMOVES a newline, and a key can only ever mean "the text I add is already
// here", never "the text I remove is already gone".)
if(count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1 && html.text.endsWith('</html>\n\n')){
  console.log('patch-725: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. AN ID IS NEVER HANDED OUT TWICE
   ========================================================================== */
sub(html, 'a free id is asked for, and worked out from the songs on the device',
  "  function _ensureTrackMap(){\n",
  "  // 72.5 - the one place a new song gets its id. It is never a counter read\n" +
  "  // back from storage: that number was `metaMap.idCounter || allTracks.length`\n" +
  "  // at boot, so after a delete - or after the snapshot restore rewrote the meta\n" +
  "  // store from an older save and reloaded - it could sit BELOW ids already in\n" +
  "  // use, and a new song was handed an id an older song already had. Two songs\n" +
  "  // on one id is one row in the track map, one row in the list, and one delete\n" +
  "  // that takes both. This asks the library what is taken.\n" +
  "  function scNextTrackId(){\n" +
  "    var taken = new Set();\n" +
  "    for(var i = 0; i < allTracks.length; i++){ if(allTracks[i] && allTracks[i].id) taken.add(allTracks[i].id); }\n" +
  "    var n = Number(idCounter) || 0;\n" +
  "    while(taken.has('t' + n)) n++;\n" +
  "    idCounter = n + 1;\n" +
  "    return 't' + n;\n" +
  "  }\n" +
  "  window.__scNextTrackId = scNextTrackId;\n" +
  "  function _ensureTrackMap(){\n",
  { key: 'function scNextTrackId(){' });

sub(html, 'the next id can never fall behind the ids in use',
  "    idCounter = metaMap.idCounter || allTracks.length;\n",
  "    // 72.5 - never below an id already in use. The stored counter is a hint; the\n" +
  "    // songs on the device are the fact.\n" +
  "    idCounter = Math.max(Number(metaMap.idCounter) || 0, scHighestTrackId() + 1);\n",
  { key: 'scHighestTrackId() + 1' });

sub(html, 'the highest id in use is readable',
  "  // 72.5 - the one place a new song gets its id. It is never a counter read\n",
  "  function scHighestTrackId(){\n" +
  "    var hi = -1;\n" +
  "    for(var i = 0; i < allTracks.length; i++){\n" +
  "      var m = /^t(\\d+)$/.exec(String((allTracks[i] && allTracks[i].id) || ''));\n" +
  "      if(m){ var n = parseInt(m[1], 10); if(isFinite(n) && n > hi) hi = n; }\n" +
  "    }\n" +
  "    return hi;\n" +
  "  }\n" +
  "  // 72.5 - the one place a new song gets its id. It is never a counter read\n",
  { key: 'function scHighestTrackId(){' });

sub(html, 'a converted song asks for a free id',
  "      var id = 't' + (idCounter++);\n" +
  "      var track = {\n" +
  "        id: id, file: file, name: title, artist: artist, album: album,\n",
  "      // 72.5 - a free id, not whatever the counter happened to hold.\n" +
  "      var id = scNextTrackId();\n" +
  "      var track = {\n" +
  "        id: id, file: file, name: title, artist: artist, album: album,\n",
  { key: 'var id = scNextTrackId();' });

sub(html, 'an imported song asks for a free id',
  "      const id = 't' + (idCounter++);\n      const url = URL.createObjectURL(file);\n",
  "      // 72.5 - a free id, not whatever the counter happened to hold.\n" +
  "      const id = scNextTrackId();\n" +
  "      const url = URL.createObjectURL(file);\n",
  { key: 'const id = scNextTrackId();' });

/* ============================================================================
   2. A SONG IS IN ALL SONGS ONCE, AND IS DRAWN AT ONCE
   ========================================================================== */
sub(html, 'a repeat is flattened out of every playlist, and the repair is saved',
  "    const allTrackIds = new Set(allTracks.map(t => t.id));\n" +
  "    let staleCleaned = 0;\n" +
  "    Object.keys(playlists).forEach(name => {\n" +
  "        if(name === 'All Songs') return;\n" +
  "        const before = playlists[name].length;\n" +
  "        playlists[name] = playlists[name].filter(id => allTrackIds.has(id));\n" +
  "        staleCleaned += before - playlists[name].length;\n" +
  "    });\n" +
  "\n" +
  "    if(recovered > 0 || staleCleaned > 0){\n",
  "    const allTrackIds = new Set(allTracks.map(t => t.id));\n" +
  "    let staleCleaned = 0;\n" +
  "    // 72.5 - and a repeat is flattened out of every list, All Songs included.\n" +
  "    // This pass used to check membership and nothing else, so an id that got\n" +
  "    // into All Songs twice stayed there: the same song drawn twice, and one\n" +
  "    // delete (which filters every playlist by id) taking both rows - they were\n" +
  "    // never two songs. Repaired once, here, and saved.\n" +
  "    let repeatsFlattened = 0;\n" +
  "    Object.keys(playlists).forEach(name => {\n" +
  "        const arr = playlists[name] || [];\n" +
  "        const keep = name === 'All Songs' ? arr : arr.filter(id => allTrackIds.has(id));\n" +
  "        if(name !== 'All Songs') staleCleaned += arr.length - keep.length;\n" +
  "        const seen = new Set();\n" +
  "        const flat = keep.filter(id => { if(seen.has(id)) return false; seen.add(id); return true; });\n" +
  "        repeatsFlattened += keep.length - flat.length;\n" +
  "        playlists[name] = flat;\n" +
  "    });\n" +
  "\n" +
  "    if(recovered > 0 || staleCleaned > 0 || repeatsFlattened > 0){\n",
  { key: 'let repeatsFlattened = 0;' });

sub(html, 'filing a song into All Songs asks whether it is already there',
  "      allTracks.push(track);\n" +
  "      if(!playlists['All Songs']) playlists['All Songs'] = [];\n" +
  "      playlists['All Songs'].push(id);\n" +
  "      if(!playlists['Unsorted']) playlists['Unsorted'] = [];\n" +
  "      playlists['Unsorted'].push(id);\n",
  "      allTracks.push(track);\n" +
  "      // 72.5 - one entry per song, whatever happened on the way here.\n" +
  "      if(!playlists['All Songs']) playlists['All Songs'] = [];\n" +
  "      if(playlists['All Songs'].indexOf(id) === -1) playlists['All Songs'].push(id);\n" +
  "      if(!playlists['Unsorted']) playlists['Unsorted'] = [];\n" +
  "      if(playlists['Unsorted'].indexOf(id) === -1) playlists['Unsorted'].push(id);\n",
  { key: "if(playlists['All Songs'].indexOf(id) === -1)" });

sub(html, 'a landed song is drawn at once, not left to the deferred render',
  "      try{ renderTabs(); }catch(_rt){}\n" +
  "      try{ renderList(); }catch(_rl){}\n" +
  "      return track;\n",
  "      try{ renderTabs(); }catch(_rt){}\n" +
  "      // 72.5 - arm the draw and then take the frame over, in that order: the\n" +
  "      // deferred path only ARMS a frame and its arm declines to draw while the\n" +
  "      // list is moving (it re-arms for the next frame instead), which is why a\n" +
  "      // run could report a song as added while the list it belongs to still\n" +
  "      // showed none of them. renderList() sets the pending flag this needs.\n" +
  "      try{ renderList(); }catch(_rl){}\n" +
  "      try{ scRenderListNow(); }catch(_rl2){}\n" +
  "      return track;\n",
  { key: "try{ renderList(); }catch(_rl){}\n      try{ scRenderListNow(); }catch(_rl2){}" });

sub(html, 'the list can never draw the same id twice',
  "    }\n" +
  "    let ids;\n" +
  "    if(shuffle && shuffledOrderCache && shuffledOrderCache.playlist === activePlaylist){\n",
  "    }\n" +
  "    // 72.5 - a repeat can never reach a row. The stored lists are repaired at\n" +
  "    // boot and nothing files a song twice, but this is the line that makes the\n" +
  "    // screen honest: one id, one row, whatever the array holds.\n" +
  "    if(rawIds.length > 1){\n" +
  "      const _scSeenId = new Set();\n" +
  "      rawIds = rawIds.filter(id => { if(_scSeenId.has(id)) return false; _scSeenId.add(id); return true; });\n" +
  "    }\n" +
  "    let ids;\n" +
  "    if(shuffle && shuffledOrderCache && shuffledOrderCache.playlist === activePlaylist){\n",
  { key: 'const _scSeenId = new Set();' });

/* ============================================================================
   3. A SEARCH ANSWERS WITH WHAT WAS ASKED FOR
   ========================================================================== */
sub(html, 'the name and the artist decide a search, the album only fills in',
  "    if(searchQuery){\n" +
  "      ids = ids.filter(id => {\n" +
  "        const t = _rlMap.get(id);\n" +
  "        if(!t) return false;\n" +
  "        return (t.name||'').toLowerCase().includes(searchQuery) || (t.artist||'').toLowerCase().includes(searchQuery) || (t.album||'').toLowerCase().includes(searchQuery);\n" +
  "      });\n" +
  "    }\n",
  "    if(searchQuery){\n" +
  "      // 72.5 - a search for an artist returns that artist. This filter matched\n" +
  "      // the album field exactly as hard as the name and the artist, so a query\n" +
  "      // was answered by anything that merely shared an album tag with it: look\n" +
  "      // one performer up and every song on the same record came back, other\n" +
  "      // performers included. The name and the artist are what was asked for, so\n" +
  "      // they decide the list; an album-only match is shown only when nothing in\n" +
  "      // the library is named or credited that way.\n" +
  "      const _scFieldHit = (t, field) => {\n" +
  "        const v = String((t && t[field]) || '').toLowerCase();\n" +
  "        return !!v && v.indexOf(searchQuery) !== -1;\n" +
  "      };\n" +
  "      const _scNamed = ids.filter(id => { const t = _rlMap.get(id); return !!t && (_scFieldHit(t, 'name') || _scFieldHit(t, 'artist')); });\n" +
  "      ids = _scNamed.length ? _scNamed : ids.filter(id => { const t = _rlMap.get(id); return !!t && _scFieldHit(t, 'album'); });\n" +
  "    }\n",
  { key: 'const _scFieldHit = (t, field) => {' });

sub(html, 'a playlist name is not written into a song as its album',
  "      if(!meta.album && plan.album) meta.album = plan.album;\n",
  "      // 72.5 - a playlist is not an album. Every song of a converted playlist\n" +
  "      // used to be stamped with the PLAYLIST's name as its album, which put a\n" +
  "      // tag on unrelated songs that a search then answered with. Only a real\n" +
  "      // album plan names the album here; a song of a playlist keeps its own.\n" +
  "      if(!meta.album && plan.album && plan.kind === 'album') meta.album = plan.album;\n",
  { key: "plan.album && plan.kind === 'album'" });

/* ============================================================================
   4. THE LOOKUP STOPS WASTING REQUESTS
   ========================================================================== */
sub(html, 'the two extra searches only run when the first one did not carry the track',
  "    var cands2 = [];\n" +
  "    try{ cands2 = await scYtSearch(title + ' ' + artist + ' ' + album + ' audio', artist, album) || []; }catch(_e2){}\n" +
  "    if(cands2 && cands2.length){\n" +
  "      var _seenC = {};\n" +
  "      for(var _c1 = 0; _c1 < cands.length; _c1++) _seenC[cands[_c1].videoId] = true;\n" +
  "      var _extra = [];\n" +
  "      for(var _c2 = 0; _c2 < cands2.length; _c2++){ if(!_seenC[cands2[_c2].videoId]){ _seenC[cands2[_c2].videoId] = true; _extra.push(cands2[_c2]); } }\n" +
  "      if(_extra.length) cands = cands.concat(_extra);\n" +
  "    }\n",
  "    // 72.5 - these two searches used to run for EVERY song, on top of the first\n" +
  "    // one and the player calls: three searches before any audio is asked for.\n" +
  "    // They now run only when the first search plainly did not carry this track.\n" +
  "    // The test is local (a search title and a channel name are already in hand),\n" +
  "    // so the common case - the first result IS the song - costs one search.\n" +
  "    var _scFirstCarriesIt = false;\n" +
  "    try{\n" +
  "      _scFirstCarriesIt = cands.some(function(c){\n" +
  "        if(!c || !scTitleMatch(title, c.title, c.title)) return false;\n" +
  "        if(!artist) return true;\n" +
  "        var own = String(c.owner || '').toLowerCase();\n" +
  "        return String(artist).split(/\\s*(?:,|;|\\/|&|\\u00b7|\\bfeat\\.?\\b|\\bft\\.?\\b|\\bwith\\b|\\bx\\b)\\s*/i)\n" +
  "          .some(function(nm){ nm = String(nm || '').trim().toLowerCase(); return !!nm && own.indexOf(nm) !== -1; });\n" +
  "      });\n" +
  "    }catch(_scCarry){ _scFirstCarriesIt = false; }\n" +
  "    var cands2 = [];\n" +
  "    if(!_scFirstCarriesIt){\n" +
  "      try{ cands2 = await scYtSearch(title + ' ' + artist + ' ' + album + ' audio', artist, album) || []; }catch(_e2){}\n" +
  "      if(cands2 && cands2.length){\n" +
  "        var _seenC = {};\n" +
  "        for(var _c1 = 0; _c1 < cands.length; _c1++) _seenC[cands[_c1].videoId] = true;\n" +
  "        var _extra = [];\n" +
  "        for(var _c2 = 0; _c2 < cands2.length; _c2++){ if(!_seenC[cands2[_c2].videoId]){ _seenC[cands2[_c2].videoId] = true; _extra.push(cands2[_c2]); } }\n" +
  "        if(_extra.length) cands = cands.concat(_extra);\n" +
  "      }\n" +
  "    }\n",
  { key: 'var _scFirstCarriesIt = false;' });

sub(html, 'and so does the quoted-title search',
  "    if(title && cands.length > 0){\n" +
  "      var q2 = await scYtSearch('\\\"' + title + '\\\" ' + artist, artist);\n",
  "    if(!_scFirstCarriesIt && title && cands.length > 0){\n" +
  "      var q2 = await scYtSearch('\\\"' + title + '\\\" ' + artist, artist);\n",
  { key: 'if(!_scFirstCarriesIt && title' });

sub(html, 'a candidate already ruled out by its length costs no request',
  "      tried++;\n" +
  "      if(onStatus) onStatus('Verifying source ' + tried + ' is really ' + (artist || 'the artist') + '…');\n" +
  "      var pa = await scYtPlayer(cands[ci].videoId);\n",
  "      tried++;\n" +
  "      // 72.5 - the length is checked FIRST. It came with the search result, and\n" +
  "      // the wrong length is the single most common rejection, so this used to\n" +
  "      // spend a request on every candidate of the wrong length before it could\n" +
  "      // say no. One request per candidate now, and only when it could be right.\n" +
  "      var cSec = Number(cands[ci].duration) || 0;\n" +
  "      if(expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) > 60) continue; // different recording\n" +
  "      if(onStatus) onStatus('Verifying source ' + tried + ' is really ' + (artist || 'the artist') + '…');\n" +
  "      var pa = await scYtPlayer(cands[ci].videoId);\n",
  { key: '// 72.5 - the length is checked FIRST.' });

sub(html, 'the loop stops the moment a full-length match is in hand',
  "         scTitleMatch(title, pa.videoTitle, cands[ci].title)){\n" +
  "        var cSec = Number(cands[ci].duration) || 0;\n" +
  "        if(expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) > 60) continue; // different recording\n" +
  "        verified.push({ pa: pa, vid: cands[ci].videoId, delta: (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1, strong: scTitleStrong(title, pa.videoTitle, cands[ci].title) });\n",
  "         scTitleMatch(title, pa.videoTitle, cands[ci].title)){\n" +
  "        var _delta = (expectedSec > 0 && cSec > 0) ? Math.abs(expectedSec - cSec) : -1;\n" +
  "        verified.push({ pa: pa, vid: cands[ci].videoId, delta: _delta, strong: scTitleStrong(title, pa.videoTitle, cands[ci].title) });\n" +
  "        // 72.5 - a strong, full-length match is exactly what the ranking below\n" +
  "        // picks first, so there is nothing left for the remaining candidates to\n" +
  "        // change. This loop used to keep asking the player for up to ten of them.\n" +
  "        if(verified[verified.length - 1].strong && expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) <= 15) break;\n",
  { key: 'verified[verified.length - 1].strong' });

/* ============================================================================
   5. THE BUNDLE KEEPS ITS OWN SIZE STILL
   ========================================================================== */
// The OTA bundle carries the root manifest.json, and that manifest carries the
// size of the bundle it lives inside. That is why dev/ota-fixpoint.mjs iterates:
// seed the manifest with the size a build will produce, rebuild, repeat. For this
// content the map has a one-byte two-cycle ({869361, 869362}) that is NOT the
// fixed point (869363), so the seed can land in the cycle and never reach it -
// measured with dev/tmp-pad-exp.mjs across 1..15 trailing newlines, where a
// two-newline tail settles in one pass from the size this tree was left holding
// and everything from four newlines up sits in the cycle. The tail is invisible
// to the page and rides in the bundle only. (72.3 shipped three newlines; that
// content settled there, this content does not.)
sub(html, 'the tail keeps the bundle off its one-byte two-cycle',
  '</html>\n\n\n\n',
  '</html>\n\n');

/* ============================================================================
   6. THIS RELEASE
   ========================================================================== */
sub(html, 'the release number',
  "  const APP_VERSION = '" + OLDVER + "';\n",
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

console.log('patch-725: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-725: ' + problems.length + ' problem(s):');
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
    must(!!entries.find((e) => String(e.version) === '72.4'), 'the 72.4 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(final.endsWith('</html>\n\n'), 'the tail keeps the bundle off its one-byte two-cycle');
  must(count(final, '</html>') === 1, 'and there is still exactly one document');
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The claims this release is about, checked in the shipped text, each exactly
  // once - a re-run that inserts a block twice is a failure, not a no-op.
  must(count(final, 'function scNextTrackId(){') === 1, 'a new song asks for a free id, in one place');
  must(count(final, 'function scHighestTrackId(){') === 1, 'the highest id in use is readable, in one place');
  must(final.indexOf('idCounter = Math.max(Number(metaMap.idCounter) || 0, scHighestTrackId() + 1);') !== -1,
    'and the counter can never fall below an id in use');
  must(final.indexOf("      var id = scNextTrackId();\n      var track = {") !== -1, 'the converted path uses it');
  must(final.indexOf("      const id = scNextTrackId();") !== -1, 'and so does the import path');
  must(count(final, "'t' + (idCounter++)") === 1, 'the one remaining allocation is the manifest import, which remaps its own ids');
  must(count(final, 'let repeatsFlattened = 0;') === 1, 'every list is flattened of repeats at boot');
  must(count(final, 'if(recovered > 0 || staleCleaned > 0 || repeatsFlattened > 0){') === 1, 'and the repair is saved');
  must(count(final, 'const _scSeenId = new Set();') === 1, 'the render drops a repeated id, once');
  must(count(final, "if(playlists['All Songs'].indexOf(id) === -1)") === 1,
    'filing a song asks whether it is already there');
  must(final.indexOf('try{ renderList(); }catch(_rl){}\n      try{ scRenderListNow(); }catch(_rl2){}') !== -1,
    'and the list is drawn the moment a song lands');
  must(count(final, 'const _scFieldHit = (t, field) => {') === 1, 'the name and the artist decide a search');
  must(count(final, "plan.album && plan.kind === 'album'") === 1, 'a playlist name is not an album');
  must(count(final, 'var _scFirstCarriesIt = false;') === 1, 'the extra searches are conditional');
  must(count(final, 'if(!_scFirstCarriesIt') === 2, 'both of them');
  must(count(final, "      var cSec = Number(cands[ci].duration) || 0;\n      if(expectedSec > 0 && cSec > 0 && Math.abs(expectedSec - cSec) > 60) continue; // different recording") === 1,
    'the length is checked before the player is asked, once');
  must(count(final, 'verified[verified.length - 1].strong') === 1, 'and the loop stops once a full-length match is in hand');
  if(trouble.length){
    console.error('\npatch-725: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-725: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
