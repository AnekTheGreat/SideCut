#!/usr/bin/env node
/**
 * SideCut 72.1 - a refetch keeps the albums and singles you removed.
 *
 * The owner's words: "Refetching albums or singles shouldnt refetch every single
 * or album that was deleted too".
 *
 * A removed album or single is kept out of the list by two things: the removed
 * list itself (`sidecut_hiddenAlbums` / `sidecut_hiddenSingles`, a collectionId or
 * trackId plus a `t:<normalized title>` marker) and the caches that were pruned
 * when it was removed. A refetch has to honour BOTH, and it did not everywhere:
 *
 *   1. SINGLES HAD A "PUT THEM ALL BACK" CHIP. The per-artist header carried a
 *      second, red chip (class `dp-si-deep-refetch`, title "Refetch ALL singles
 *      (including removed)") wired to `__singlesDeepRefreshArtistGroup()`, which
 *      was the ordinary refresh with `__scFetchArtistSingles(name, {includeHidden:
 *      true})` - the one call in the app that asked `fetchArtistSingles` to drop
 *      its removed-list filter (`var skipHidden = !opts.includeHidden`). It even
 *      warned "Previously removed songs will reappear" before doing it. The chip
 *      is gone, and `fetchArtistSingles` now filters unconditionally, so no
 *      caller - including a saved popup that still carries the old chip - can ask
 *      for the removed rows back.
 *
 *   2. THE SAVED LIST WAS HANDED BACK UNCHECKED. When a refresh cannot reach the
 *      catalog it keeps the group it already had (`keptArtistGroupsHTML` ->
 *      `cachedArtistGroups`, which parses `discPopupCache_` and re-inserts the
 *      saved rows verbatim). A snapshot saved before a removal - or one whose own
 *      update was skipped - still held the row, so the next refetch put the
 *      removed single straight back. `cachedArtistGroups` now drops every hidden
 *      row before it is reused.
 *
 *   3. THE AI DISCOGRAPHY SOURCE NEVER ASKED. Every catalog source filters
 *      (iTunes through `filterInto`, Deezer and MusicBrainz each call
 *      `isAlbumHidden`) - except the Gemini merge in `__refetchAlbums`, which
 *      pushed its albums with no check at all, so an album removed from Album
 *      History could ride back in on a refetch for anyone with an AI key.
 *
 *   4. THE PER-ARTIST ALBUM REFETCH SEEDED FROM AN UNFILTERED CACHE.
 *      `__refetchArtistAlbums` loads `sidecut_ahArtistData` into `artistAlbums`
 *      whole and saves it back whole, so a removed album still sitting in that
 *      cache was re-rendered and re-saved. The seed is filtered now, the same
 *      way `__refetchAlbums` already filtered its own.
 *
 * Nothing else moves: no song, cover, album, playlist or listening stat is read
 * or rewritten, and Recently Deleted still restores anything on purpose.
 *
 *   node dev/patch-721.mjs
 *   node dev/patch-721.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-721.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.1';
const STAMP = 'October 1, 2026 \\u00b7 6:26 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDCACHE = 'sidecut-shell-v72.0';
const TITLE = 'A refetch keeps the albums and singles you removed, and the deep-refetch chip that put them back is gone';
const NOTES = [
  'A refetch keeps the albums and singles you removed. Refetching used to be able to pull a deleted album or single straight back into the list, and now nothing a refetch does can put one back.',
  'The red deep-refetch chip in Singles is gone. It existed only to put every removed song back, which is the opposite of what a refresh should do, so the refresh beside it is the only one there now.',
  'The removed list is honored by every source a fetch asks. The AI discography lookup was the one place that never checked it, so an album you removed could ride back in on a refetch, and it asks now.',
  'A saved list cannot resurrect one either. When a refresh cannot reach the catalog it falls back to the list it saved, and that list is checked against your removals before any of it is shown.',
  'Nothing comes back on its own. An album or a single you remove still sits in Recently Deleted for thirty days, and restoring it there is the only way it returns to the list.',
  'The player, the dock, the queue, your albums and every saved song behave exactly as they did before this release. No song, no cover and no listening stat is rewritten, and nothing is deleted.',
  'Nothing else about Discover moved: the same fetch, the same rows and the same Recently Deleted history, with no removed item reappearing.',
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
  console.log('patch-721: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE REMOVED FILTER IS NOT OPTIONAL FOR SINGLES
   ========================================================================== */
sub(html, 'the singles fetch always honours the removed list',
  '    var skipHidden = !opts.includeHidden;\n',
  `    // 72.1 - ALWAYS FILTER. This used to be opt-out, and the red chip in the
    // per-artist header was the one caller that opted out, so it put every
    // removed single back on one tap. There is no refetch that ignores the
    // removed list any more; a single you removed stays removed until you
    // restore it from Recently Deleted.
    var skipHidden = true;\n`,
  { key: '// 72.1 - ALWAYS FILTER.' });

/* ============================================================================
   2. THE "PUT THEM ALL BACK" CHIP LEAVES THE HEADER
   ========================================================================== */
const DEEP_A = "<span class=\"dp-si-deep-refetch\" data-artist=\"' + escapeHtml(artist) + '\" title=\"Refetch ALL singles (including removed)\" role=\"button\" tabindex=\"0\" style=\"width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,80,80,0.12);color:#ff6b6b;font-size:11px;cursor:pointer;flex-shrink:0;margin-left:1px;\">\u26a1</span>";
const DEEP_B = "<span class=\"dp-si-deep-refetch\" data-artist=\"' + window.escapeHtml(artist) + '\" title=\"Refetch ALL singles (including removed)\" role=\"button\" tabindex=\"0\" style=\"width:24px;height:24px;display:flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,80,80,0.12);color:#ff6b6b;font-size:11px;cursor:pointer;flex-shrink:0;margin-left:1px;\">\u26a1</span>";
// No opts.key here on purpose: the key would BE the text this sub removes, so
// the guard would read the chip as "already applied" and skip the removal (the
// tree-is-already-at-72.1 short-circuit above is what makes a rerun safe).
sub(html, 'the deep-refetch chip is gone from the singles header (fresh render)', DEEP_A, '');
sub(html, 'the deep-refetch chip is gone from the singles header (cached render)', DEEP_B, '');

/* ============================================================================
   3. A SAVED LIST CANNOT HAND A REMOVED ROW BACK
   ========================================================================== */
sub(html, 'the saved popup drops every hidden row before it is reused',
  `      var tmp = document.createElement('div');
      tmp.innerHTML = d.body;
`,
  `      var tmp = document.createElement('div');
      tmp.innerHTML = d.body;
      // 72.1 - a saved snapshot can outlive a removal (it was written before
      // the row was removed, or its own update was skipped). This path hands
      // that HTML straight back into the list, so a removed single would come
      // back with it on the next refetch. Every row is checked against the
      // removed list here, so a saved snapshot can never resurrect one.
      try{
        Array.prototype.forEach.call(tmp.querySelectorAll('.dp-ah-x[data-tid]'), function(x){
          if(isSingleHidden(x.getAttribute('data-tid') || '', x.getAttribute('data-tname') || '')){
            var _r = x.closest('.dp-track');
            if(_r && _r.parentNode) _r.parentNode.removeChild(_r);
          }
        });
      }catch(_eCacheHide){}
`,
  { key: 'a saved snapshot can never resurrect one' });

/* ============================================================================
   4. THE AI SOURCE ASKS THE REMOVED LIST TOO
   ========================================================================== */
sub(html, 'the AI merge honours the removed list',
  `              var _aiCid = 'ai_' + a.name.toLowerCase().replace(/[^a-z0-9]/g,'') + '_' + String(_aiA.title).toLowerCase().replace(/[^a-z0-9]/g,'');
              _aiSeenT[_aiTN] = [_aiY];
`,
  `              var _aiCid = 'ai_' + a.name.toLowerCase().replace(/[^a-z0-9]/g,'') + '_' + String(_aiA.title).toLowerCase().replace(/[^a-z0-9]/g,'');
              // 72.1 - every other source in this function asks isAlbumHidden()
              // before it pushes; this one never did, so an album removed from
              // Album History came straight back whenever the AI key was set.
              // Checked by title too, because the store id an album was removed
              // under is not the id this path invents for it.
              if(isAlbumHidden(_aiCid, _aiA.title)) continue;
              _aiSeenT[_aiTN] = [_aiY];
`,
  { key: 'if(isAlbumHidden(_aiCid, _aiA.title)) continue;' });

/* ============================================================================
   5. THE PER-ARTIST REFETCH DOES NOT SEED FROM AN UNFILTERED CACHE
   ========================================================================== */
sub(html, 'the per-artist refetch filters the cache it seeds from',
  `        artistAlbums = ahDataCache.artists;
        totalAlbums = ahDataCache.total || 0;
`,
  `        artistAlbums = ahDataCache.artists;
        totalAlbums = ahDataCache.total || 0;
        // 72.1 - the seed is filtered here, the same way __refetchAlbums filters
        // its own cache seed. This function saves artistAlbums back whole, so a
        // removed album still sitting in the cache would be re-rendered AND
        // re-saved - which is exactly a removed album returning on a refetch.
        try{
          var _hSeed = JSON.parse(localStorage.getItem('sidecut_hiddenAlbums') || '[]');
          Object.keys(artistAlbums).forEach(function(k){
            artistAlbums[k] = (artistAlbums[k] || []).filter(function(a){
              if(_hSeed.indexOf(String(a.collectionId)) !== -1) return false;
              var _t = (a.collectionName || '').toLowerCase().replace(/[^a-z0-9]/g,'').trim();
              if(_t && _hSeed.indexOf('t:' + _t) !== -1) return false;
              return true;
            });
            if(!artistAlbums[k].length) delete artistAlbums[k];
          });
        }catch(_eSeed){}
`,
  { key: 'exactly a removed album returning on a refetch' });

/* ===================== 6. THE RELEASE ITSELF ============================== */
sub(html, 'the app version',
  "  const APP_VERSION = '72.0';\n",
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

console.log('patch-721: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-721: ' + problems.length + ' problem(s):');
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
    must(!!entries.find((e) => String(e.version) === '72.0'), 'the 72.0 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The claims this release is actually about, checked in the shipped text.
  must(count(final, 'var skipHidden = true;') === 1, 'the singles fetch always filters the removed list');
  must(final.indexOf('opts.includeHidden') === -1, 'and no caller can ask it not to');
  // The class name still lives in the click handler (a saved popup can still
  // carry the old chip, and letting it run is harmless now that the fetch always
  // filters). The MARKUP and its promise are what must be gone.
  must(count(final, 'class="dp-si-deep-refetch"') === 0 && count(final, 'title="Refetch ALL singles') === 0,
    'the put-them-all-back chip is out of the markup');
  must(final.indexOf('a saved snapshot can never resurrect one') !== -1, 'a saved list is checked against removals');
  must(final.indexOf('if(isAlbumHidden(_aiCid, _aiA.title)) continue;') !== -1, 'the AI source asks the removed list');
  must(final.indexOf('exactly a removed album returning on a refetch') !== -1, 'the per-artist refetch filters its seed');
  must(count(final, 'delete playlists[') === 1, 'there is still exactly one playlist delete in the app');
  if(trouble.length){
    console.error('\npatch-721: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-721: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
