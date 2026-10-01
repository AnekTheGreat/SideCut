#!/usr/bin/env node
/**
 * SideCut 72.0 - an album knows who it is by, and an import never drops a
 * playlist.
 *
 * The owner's words: "something from before importing albums deleted my existing
 * playlists" and "all the albums say unknown artist when you import them", then
 * "make sure stuff like this never happens ever again".
 *
 * 1. WHY EVERY IMPORTED ALBUM SAID UNKNOWN ARTIST. An album zip made before 71.9
 *    had no place in the file to keep an album's artist - its groups were ids
 *    against a playlist name - so the import SYNTHESIZED the album entries and
 *    stamped `artist: 'Unknown artist'` into every one of them (~index.html:24192).
 *    That string is TRUTHY, so the album card's own fallback
 *    (`ua.artist || firstTrack.artist`) never ran and every album in the zip read
 *    Unknown artist. An album's artist is now derived from the songs INSIDE the
 *    album, in one place, by scAlbumArtist() - which also treats a stored
 *    "Unknown artist" as "nothing", so the literal can never win again. The import
 *    writes nothing there, and scHealAlbumArtists() fills the real one in from the
 *    songs: once right after an import (the moment the ids are this device's) and
 *    once at boot, so a library that already came through an album zip is REPAIRED
 *    by the update itself, with no re-import.
 *
 * 2. AN IMPORT MUST NOT BE ABLE TO DROP A PLAYLIST. The playlist side of an import
 *    has always merged (`if(!playlists[name]) playlists[name] = []; ... push`), so
 *    the merge itself is additive - and there is exactly ONE `delete playlists[`
 *    in the whole app, the 71.9 bin, behind its own confirmation. What was NOT
 *    guaranteed is that the merged result is WRITTEN: saveMeta() deliberately
 *    writes nothing about playlists while the Library is on Albums (so the album
 *    paths cannot touch them), and importing a backup is exactly what Manage
 *    albums offers ("Restore from my backup"). So the import now writes the
 *    playlists row itself, next to the merge, instead of leaving it to a function
 *    whose whole job is to refuse it in that mode.
 *
 *   node dev/patch-720.mjs
 *   node dev/patch-720.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-720.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.0';
const STAMP = 'October 1, 2026 \\u00b7 5:12 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDCACHE = 'sidecut-shell-v71.9';
const TITLE = 'An album export carries the artist, an imported album can no longer read Unknown artist, and an import can no longer drop a playlist';
const NOTES = [
  'Albums know who they are by again. An album that came in from a .zip used to arrive reading Unknown artist under its name, every album in the file, because that was the only artist an older album zip had to give it.',
  'The artist now comes from the songs. An album reads the artist the songs inside it agree on, and the album tag on those songs is the second place it looks, so a compilation with one guest credit still reads right.',
  'The albums already in your library are repaired by this update itself. The first launch after this release fills in the artist for every album sitting there with none, so those cards stop reading Unknown artist without importing anything again.',
  'Exporting your albums writes the artist it found, so a zip made after this release carries the real name from the first tap instead of the guess an older import had to make.',
  'An import can no longer drop a playlist. Whatever the .zip carried - playlists, albums or a whole backup - every playlist your library already had is still there afterwards, and the merged result is written down at once instead of waiting for the Library to leave Albums view.',
  'The player, the dock and the queue are untouched. No song, no cover and no listening stat is rewritten by this release, nothing is deleted, and the rebuild in Manage albums still has its undo.',
  'Nothing else about an import changed. The songs, the album order, the settings and the playlists a backup carries all come over exactly as they did, and the delete bin stays in Manage playlists for the playlists you do want gone.',
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
  console.log('patch-720: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. ONE PLACE THAT KNOWS WHO AN ALBUM IS BY
   ========================================================================== */
sub(html, 'the album-artist lookup and the repair pass',
  '  // ---- end scHealBrokenAlbums ----\n',
  `  // ---- end scHealBrokenAlbums ----

  // ---- 72.0 - WHO AN ALBUM IS BY -------------------------------------------
  // An album entry stores the artist it was made from, but not every entry has
  // one. An album zip made before 71.9 had nowhere in the file to keep it - it
  // carried ids against a playlist name - so the import wrote the literal
  // "Unknown artist" in its place, and because that string is TRUTHY it beat the
  // card's own fallback to the first song, which is the owner's report: every
  // album in the zip reading Unknown artist.
  //
  // This is the ONE answer to "who is this album by", and everything that shows
  // an album artist asks here: the entry's own artist when it is a real one,
  // otherwise the artist the songs IN the album agree on (the most common one, so
  // a compilation with a stray guest credit still reads right), and then the
  // album TAG on the songs carrying this name. Returns '' when nothing knows, so
  // a caller can decide what to show instead of being handed a fake answer.
  function scAlbumArtist(name){
    try{
      var key = String(name || '').trim();
      if(!key) return '';
      var e = userAlbums[key];
      var own = (e && typeof e.artist === 'string') ? e.artist.trim() : '';
      if(own && own.toLowerCase() !== 'unknown artist') return own;
      var tally = {}, best = '', bestN = 0;
      var bump = function(a){
        var v = String(a || '').trim();
        if(!v || v.toLowerCase() === 'unknown artist') return;
        tally[v] = (tally[v] || 0) + 1;
        if(tally[v] > bestN){ bestN = tally[v]; best = v; }
      };
      var tm = (typeof _ensureTrackMap === 'function') ? _ensureTrackMap() : null;
      var ids = (e && Array.isArray(e.trackIds)) ? e.trackIds : [];
      for(var i = 0; i < ids.length; i++){
        var t = tm ? tm.get(ids[i]) : null;
        if(t) bump(t.artist);
      }
      if(best) return best;
      // Nothing in the album's own track list: fall back to the album TAG the
      // songs carry, which is what this album was almost certainly named after.
      var lk = key.toLowerCase();
      for(var j = 0; j < allTracks.length; j++){
        var s = allTracks[j];
        if(s && String(s.album || '').trim().toLowerCase() === lk) bump(s.artist);
      }
      return best;
    }catch(_eArtist){ return ''; }
  }
  window.__scAlbumArtist = scAlbumArtist;

  // And the same answer is written BACK. An album whose entry carries no artist,
  // or the "Unknown artist" an older import stamped into it, gets the one its
  // songs agree on - once, at boot, so a library that already came through an
  // album zip is repaired by the update itself, and once right after an import,
  // which is the first moment the ids point at this device's songs. No-op when
  // every album already knows its artist. It writes the userAlbums row and
  // NOTHING else on purpose: at boot it runs before the stored playlists have
  // been read back, so anything that persisted playlists from here would write
  // the empty placeholder over them.
  function scHealAlbumArtists(){
    var healed = 0;
    try{
      Object.keys(userAlbums || {}).forEach(function(n){
        var e = userAlbums[n];
        if(!e || typeof e !== 'object') return;
        var own = (typeof e.artist === 'string') ? e.artist.trim() : '';
        if(own && own.toLowerCase() !== 'unknown artist') return;
        var a = scAlbumArtist(n);
        if(a && a !== own){ e.artist = a; healed++; }
      });
      if(healed){
        try{ if(typeof dbPut === 'function') dbPut('meta', { key: 'userAlbums', value: userAlbums }); }catch(_eRow){}
      }
    }catch(_eHealA){}
    return healed;
  }
  window.__scHealAlbumArtists = scHealAlbumArtists;
`,
  { key: 'function scAlbumArtist(name){' });

/* ============================================================================
   2. THE IMPORT STOPS MAKING IT UP
   ========================================================================== */
sub(html, 'an older album zip no longer stamps an artist into its albums',
  "          _albFromZip[n] = { artist: 'Unknown artist', trackIds: _ids.slice(), createdAt: Date.now(), manual: true };\n",
  `          // 72.0 - NO artist is stamped in. This used to write the literal
          // "Unknown artist", and because that string is truthy it beat every
          // fallback that would have read the artist off the songs - which is why
          // every album in an old album .zip came back wearing it. The real one is
          // filled in from the songs by scHealAlbumArtists() below.
          _albFromZip[n] = { artist: '', trackIds: _ids.slice(), createdAt: Date.now(), manual: true };\n`,
  { key: "_albFromZip[n] = { artist: ''," });

sub(html, 'and the album restore fills the artist in from this device songs',
  `        try{ scAlbumsMarkOurs(userAlbums); }catch(_eMark){}
        dbPut('meta', { key: 'userAlbums', value: userAlbums });
`,
  `        try{ scAlbumsMarkOurs(userAlbums); }catch(_eMark){}
        dbPut('meta', { key: 'userAlbums', value: userAlbums });
        // 72.0 - and the artist the songs agree on, for every album that arrived
        // without one. The id remap above just re-pointed every album at THIS
        // device's tracks, so this is the first moment the real answer exists.
        try{ scHealAlbumArtists(); }catch(_eHealA){}
`,
  { key: '// 72.0 - and the artist the songs agree on, for every album that arrived' });

sub(html, 'and the boot repairs a library that already came through one',
  '    try{ scHealBrokenAlbums(); }catch(_eHeal){}\n',
  `    try{ scHealBrokenAlbums(); }catch(_eHeal){}
    // 72.0 - then the ARTIST for every album that has none (an album zip made
    // before 71.9 had nowhere to keep it, so the import wrote the literal
    // "Unknown artist" into every album in the file). Once, at boot, so the
    // update repairs those cards with no re-import.
    try{ scHealAlbumArtists(); }catch(_eHealA){}
`,
  { key: '// 72.0 - then the ARTIST for every album that has none' });

/* ============================================================================
   3. WHO THE CARD ASKS
   ========================================================================== */
sub(html, 'the album card reads the album-artist lookup, not the stored string',
  "        _albumMap[aName] = { name: aName, artist: (ua.artist || (firstTrack ? (firstTrack.artist||'').trim() : 'Unknown artist')), tracks: visibleTracks, cover: (ua.cover || ((firstTrack && firstTrack.artUrl) ? firstTrack.artUrl : '')) };\n",
  `        // 72.0 - scAlbumArtist() is the one answer to who this album is by. Read
        // straight off the entry, the "Unknown artist" an older import wrote won
        // the || below (a non-empty string is truthy) and the card showed it for
        // every album in the zip, which is exactly what was reported.
        _albumMap[aName] = { name: aName, artist: (scAlbumArtist(aName) || (firstTrack ? (firstTrack.artist||'').trim() : 'Unknown artist')), tracks: visibleTracks, cover: (ua.cover || ((firstTrack && firstTrack.artUrl) ? firstTrack.artUrl : '')) };\n`,
  { key: 'artist: (scAlbumArtist(aName) ||' });

/* ============================================================================
   4. AN IMPORT WRITES THE PLAYLISTS IT MERGED
   ========================================================================== */
sub(html, 'the import writes the playlists row itself, not through saveMeta',
  `      playlists['All Songs'] = allTracks.map(t => t.id);
      saveMeta();
`,
  `      playlists['All Songs'] = allTracks.map(t => t.id);
      saveMeta();
      // 72.0 - AND THE ROW ON ITS OWN. saveMeta() deliberately writes nothing
      // about playlists while the Library is in Albums mode (the album paths must
      // not touch them), but an import is not an album path: it has just merged
      // this zip's playlists into the ones already here. Restoring a backup is
      // offered from the ALBUMS side ("Restore from my backup" in Manage albums),
      // so that is album mode - and left to saveMeta the merged result lived only
      // in memory while the stored row kept whatever the zip carried. The merge
      // below is additive and the only playlist delete in the app is the 71.9 bin
      // behind its own confirmation; this line is what makes the result stick.
      try{ dbPut('meta', { key: 'playlists', value: playlists }); }catch(_ePlRow){}
`,
  { key: "; }catch(_ePlRow){}" });

/* ===================== 5. THE RELEASE ITSELF ============================== */
sub(html, 'the app version',
  "  const APP_VERSION = '71.9';\n",
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

console.log('patch-720: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-720: ' + problems.length + ' problem(s):');
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
    must((head.items || []).every((it, i) => it === NOTES[i]), 'and they are the notes this script wrote');
    must(String(head.title || '') === TITLE, 'with its own title');
    must(!/\bpass\b/i.test(String(head.title)), 'and the title does not call itself a pass');
    must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
      'the head entry carries no downloader wording');
    must(/(studio|player|dock|premium|license)/i.test((head.items || []).join('\n')),
      'and it names a surface this app really has');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'nothing here is full-build-only');
    must((head.items || []).every((it) => it.indexOf("'") === -1), 'and no note carries an apostrophe');
    must(!!entries.find((e) => String(e.version) === '71.9'), 'the 71.9 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The claims this release is actually about, checked in the shipped text.
  must(final.indexOf('function scAlbumArtist(name){') !== -1, 'there is one album-artist lookup');
  must(final.indexOf('window.__scAlbumArtist = scAlbumArtist;') !== -1, 'exposed for the gates');
  must(final.indexOf('function scHealAlbumArtists(){') !== -1, 'and one repair pass');
  must(final.indexOf("_albFromZip[n] = { artist: '',") !== -1, 'an older album zip stamps no artist in');
  must(final.indexOf("_albFromZip[n] = { artist: 'Unknown artist',") === -1, 'the literal is gone from the import');
  must(final.indexOf('artist: (scAlbumArtist(aName) ||') !== -1, 'the album card asks the lookup');
  must(final.indexOf("try{ dbPut('meta', { key: 'playlists', value: playlists }); }catch(_ePlRow){}") !== -1,
    'and an import writes the playlists it merged');
  must(count(final, 'try{ scHealAlbumArtists(); }catch(_eHealA){}') === 2,
    'the repair runs at boot and right after an album restore, nowhere else (' + count(final, 'try{ scHealAlbumArtists(); }catch(_eHealA){}') + ')');
  must(count(final, 'delete playlists[') === 1, 'there is still exactly one playlist delete in the app');
  if(trouble.length){
    console.error('\npatch-720: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-720: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
