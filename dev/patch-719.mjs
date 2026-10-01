#!/usr/bin/env node
/**
 * SideCut 71.9 - an album export carries albums, and a playlist can be deleted.
 *
 * The owner's words: "Whenever I import my zip for albums it imports it as
 * playlists in library it not supposed do that obviously and add a delete
 * playlist function in library".
 *
 * 1. WHY ALBUMS CAME BACK AS PLAYLISTS. exportAlbums() () built `albumGroups`
 *    - album name -> track ids - and handed it to doExportTracks() as the
 *    `manifestPlaylists` argument. doExportTracks writes that straight into
 *    `manifest.playlists`, so the zip declared a PLAYLIST per album, and the
 *    confirm text it had just shown said "No playlists are included". Importing
 *    that zip merged manifest.playlists into the Library's playlists, which is
 *    the bug, verbatim. An album export now writes ALBUMS (settings.userAlbums,
 *    in the album shape, plus settings.albumOrder for the card order), sets
 *    manifest.kind = 'albums', and writes no playlists at all.
 *
 * 2. THE ZIPS PEOPLE ALREADY HAVE. Fixing only the export would leave every zip
 *    made before this release still importing as playlists - and for the owner
 *    that zip is the only copy of those albums. So the import reads the marker
 *    AND the older zips, which say it only in their file name
 *    (`sidecut-albums.zip`): an albums zip is not a playlist zip, and its groups
 *    are read as albums.
 *
 * 3. DELETE PLAYLIST, IN THE LIBRARY. Manage playlists (opened from the list's
 *    three dots) now carries a bin beside the rename pencil for every playlist
 *    you can rename. One delete path, a real in-app confirmation (confirm() is
 *    unreliable in the Android WebView - the same reason the app has its own
 *    prompt), and every per-playlist row the name left behind is cleared with it,
 *    so a playlist cannot be half-removed with a hidden/DJ-setting still pointing
 *    at it.
 *
 *   node dev/patch-719.mjs
 *   node dev/patch-719.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-719.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '71.9';
const STAMP = 'October 1, 2026 \\u00b7 3:52 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDCACHE = 'sidecut-shell-v71.8';
const TITLE = 'An album export carries albums instead of playlists, the album order rides along, and Manage playlists gains a bin';
const NOTES = [
  'Exporting your albums no longer writes them as playlists. The zip an album export makes carries the albums themselves, so importing it gives you albums in the Albums tab and nothing added to your playlists - which is what that screen always promised.',
  'That is the fix for albums arriving as playlists after an import. The album export was handing its album list to the playlist side of the file, so every album came back as a playlist wearing the same name.',
  'The zips you already have are read the same way. An album export made before this release says it only in its file name, and the import recognizes it, so those older album zips stop arriving as playlists too.',
  'The card order rides along. An album export records the order your album cards were in, and an import uses it, so the albums come back in the arrangement you left them in.',
  'Delete playlist is in Manage playlists now: a bin beside the rename pencil on every playlist, with a real confirmation that says how many songs stay in your library. Only the playlist goes - the songs are never touched.',
  'The playlist menu above the list keeps the same delete, and both go through one path, so the hidden flag, the DJ Mode setting and the saved sort for a deleted name are cleared with it. Library, Favorites and Unsorted cannot be deleted, so the bin is never offered for them.',
  'Nothing else moved: the player, the dock, the queue, your albums and every saved song behave exactly as they did before this release, and the tag rebuild is still in Manage albums with its undo.',
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
  console.log('patch-719: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. AN ALBUM EXPORT CARRIES ALBUMS
   ========================================================================== */
sub(html, 'the zip helper takes albums as well as playlists',
  '  async function doExportTracks(ids, filenameBase, manifestPlaylists, kindLabel){\n',
  '  async function doExportTracks(ids, filenameBase, manifestPlaylists, kindLabel, manifestAlbums){\n',
  { key: 'async function doExportTracks(ids, filenameBase, manifestPlaylists, kindLabel, manifestAlbums){' });

sub(html, 'and writes them as albums, with no playlists at all',
  '      manifest: { playlists: manifestPlaylists || {}, tracks: [], version: 2 },\n',
  `      // 71.9 - an ALBUM export carries albums. Handing the album groups to the
      // playlist slot is what made a zip "for albums" import as a playlist per
      // album, and it made the confirm text's own promise false. The groups are
      // written where albums live (settings.userAlbums), in album shape, with the
      // card order beside them, and manifest.kind says which kind of zip this is.
      manifest: manifestAlbums
        ? { kind: 'albums', playlists: {}, tracks: [], settings: { userAlbums: manifestAlbums, albumOrder: Object.keys(manifestAlbums) }, version: 2 }
        : { playlists: manifestPlaylists || {}, tracks: [], version: 2 },
`,
  { key: "kind: 'albums', playlists: {}, tracks: []" });

sub(html, 'the album groups are built as albums, in card order',
  `    Object.keys(userAlbums || {}).forEach(function(name){
      if(albumIsAuto(name)) return; // created automatically, not an album you made
      const entry = userAlbums[name];
      if(!entry || !Array.isArray(entry.trackIds)) return;
      const kept = entry.trackIds.filter(function(id){ return ids.indexOf(id) >= 0; });
      if(kept.length) albumGroups[name] = kept;
    });
`,
  `    // 71.9 - built as ALBUMS, in card order, because this map is now written to
    // settings.userAlbums. It used to be an array of ids per name and went to the
    // playlist slot of the manifest, which is the bug this release fixes: an album
    // export produced a playlist per album on import.
    const _albNames = (typeof albumOrder !== 'undefined' && Array.isArray(albumOrder) ? albumOrder.slice() : [])
      .filter(function(n){ return userAlbums[n] && !albumIsAuto(n); });
    Object.keys(userAlbums || {}).forEach(function(n){ if(_albNames.indexOf(n) === -1) _albNames.push(n); });
    _albNames.forEach(function(name){
      if(albumIsAuto(name)) return; // created automatically, not an album you made
      const entry = userAlbums[name];
      if(!entry || !Array.isArray(entry.trackIds)) return;
      const kept = entry.trackIds.filter(function(id){ return ids.indexOf(id) >= 0; });
      if(!kept.length) return;
      albumGroups[name] = {
        artist: entry.artist || 'Unknown artist',
        trackIds: kept,
        createdAt: entry.createdAt || Date.now(),
        manual: true
      };
    });
`,
  { key: 'albumGroups[name] = {' });

sub(html, 'and the export passes them as albums, not as playlists',
  "      await doExportTracks(ids.slice(), 'sidecut-albums', albumGroups, `${albumCount} album${albumCount===1?'':'s'}`);\n",
  "      await doExportTracks(ids.slice(), 'sidecut-albums', undefined, `${albumCount} album${albumCount===1?'':'s'}`, albumGroups);\n",
  { key: "await doExportTracks(ids.slice(), 'sidecut-albums', undefined," });

sub(html, 'and the full backup carries the album order too',
  '            userAlbums: userAlbums || {},\n',
  `            userAlbums: userAlbums || {},

            // 71.9 - the album CARD order. userAlbums' key order cannot hold a
            // name like "2003" in place, so the explicit list comes along and the
            // import prefers it over whatever this device already had. An album's
            // position is the half of "my albums are back" that a list of names
            // and songs cannot show.
            albumOrder: (typeof albumOrder !== 'undefined' && Array.isArray(albumOrder)) ? albumOrder.slice() : [],
`,
  { key: "albumOrder: (typeof albumOrder !== 'undefined' && Array.isArray(albumOrder)) ? albumOrder.slice() : []" });

/* ============================================================================
   2. THE IMPORT READS AN ALBUM ZIP AS ALBUMS (including the older ones)
   ========================================================================== */
sub(html, 'an albums zip is recognized by the import',
  '      const isV2 = manifest.version === 2;\n',
  `      const isV2 = manifest.version === 2;
      // 71.9 - A ZIP THIS APP MADE FOR ALBUMS IS NOT A PLAYLIST ZIP. An album
      // export used to hand its album groups to the playlist slot of the manifest,
      // so importing one produced a playlist per album in the Library. New exports
      // say so with manifest.kind; an OLDER one says it only in its file name
      // (sidecut-albums.zip), and both are read as albums here, so the zips people
      // already have stop coming back as playlists.
      const _isAlbumsZip = (manifest.kind === 'albums') ||
        (!manifest.settings && /^sidecut-albums/i.test(String((file && file.name) || '')));
      if(_isAlbumsZip && !manifest.settings){
        const _albFromZip = {};
        Object.keys(manifest.playlists || {}).forEach(function(n){
          if(n === 'All Songs' || n === 'Favorites' || n === 'Unsorted') return;
          const _ids = manifest.playlists[n];
          if(!Array.isArray(_ids) || !_ids.length) return;
          _albFromZip[n] = { artist: 'Unknown artist', trackIds: _ids.slice(), createdAt: Date.now(), manual: true };
        });
        if(Object.keys(_albFromZip).length){
          manifest.settings = { userAlbums: _albFromZip, albumOrder: Object.keys(_albFromZip) };
        }
      }
`,
  { key: 'const _isAlbumsZip' });

sub(html, 'so its groups are not also made into playlists',
  `      Object.keys(manifest.playlists || {}).forEach(name => {
        if(name === 'All Songs') return;
`,
  `      // 71.9 - an album zip's groups were read into ALBUMS above, so they must not
      // be made into playlists as well. That double-read is exactly the owner's
      // report: a playlist per album, in the Library, from a zip for albums.
      if(!_isAlbumsZip) Object.keys(manifest.playlists || {}).forEach(name => {
        if(name === 'All Songs') return;
`,
  { key: 'if(!_isAlbumsZip) Object.keys(' });

sub(html, 'and the backup album order is preferred over the local one',
  `          var _ao = (_aoRow && Array.isArray(_aoRow.value)) ? _aoRow.value : [];
          var _mergedOrder = [];
          _ao.forEach(function(n){ if(userAlbums[n] && _mergedOrder.indexOf(n) === -1) _mergedOrder.push(n); });
`,
  `          var _ao = (_aoRow && Array.isArray(_aoRow.value)) ? _aoRow.value : [];
          // 71.9 - the backup's own order comes FIRST. An album export writes the
          // card order into the manifest, and taking the local row first meant the
          // albums came back in this device's old arrangement instead.
          var _bkOrder = (manifest.settings && Array.isArray(manifest.settings.albumOrder)) ? manifest.settings.albumOrder : [];
          var _mergedOrder = [];
          _bkOrder.forEach(function(n){ if(userAlbums[n] && _mergedOrder.indexOf(n) === -1) _mergedOrder.push(n); });
          _ao.forEach(function(n){ if(userAlbums[n] && _mergedOrder.indexOf(n) === -1) _mergedOrder.push(n); });
`,
  { key: 'var _bkOrder =' });

/* ============================================================================
   3. DELETE A PLAYLIST, FROM THE LIBRARY
   ========================================================================== */
sub(html, 'the in-app confirmation and the one delete path',
  "  function deleteActivePlaylist(){\n    if(!confirm(`Delete \"${activePlaylist}\"? This won't delete the songs themselves.`)) return;\n    delete playlists[activePlaylist];\n    activePlaylist = 'All Songs';\n    saveMeta();\n    renderTabs();\n    renderList();\n  }\n",
  `  // 71.9 - a real in-app confirmation. confirm() and prompt() are unreliable in
  // the Android WebView (the app already carries its own prompt for that reason),
  // so anything that destroys something asks here instead.
  function modalConfirm(title, message, okLabel){
    return new Promise(function(resolve){
      var bd = document.createElement('div');
      bd.className = 'modal-backdrop';
      bd.style.zIndex = '250';
      bd.style.display = 'flex';
      var sh = document.createElement('div');
      sh.className = 'modal';
      sh.style.maxWidth = '340px';
      sh.innerHTML = '<h3>' + escapeHtml(title) + '</h3>' +
        '<div id="_modalConfirmMsg" style="font-size:13px; color:var(--ink-dim); line-height:1.55; margin-bottom:12px;"></div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button id="_modalConfirmNo" style="flex:1;padding:10px;border-radius:8px;border:1px solid var(--line);background:var(--bg-raised);color:var(--ink);font-weight:600;font-size:13px;">Cancel</button>' +
        '<button id="_modalConfirmYes" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--coral);color:#161616;font-weight:700;font-size:13px;">' + escapeHtml(okLabel || 'OK') + '</button>' +
        '</div>';
      bd.appendChild(sh);
      var msg = sh.querySelector('#_modalConfirmMsg');
      if(msg) msg.textContent = String(message || '');
      document.body.appendChild(bd);
      function done(v){ try{ if(bd.parentNode) bd.parentNode.removeChild(bd); }catch(e){} resolve(v); }
      var no = sh.querySelector('#_modalConfirmNo'), yes = sh.querySelector('#_modalConfirmYes');
      if(no) no.addEventListener('click', function(){ done(false); });
      if(yes) yes.addEventListener('click', function(){ done(true); });
      bd.addEventListener('click', function(e){ if(e.target === bd) done(false); });
    });
  }

  // 71.9 - ONE delete path for a playlist, reachable from the Library itself
  // (Manage playlists has a bin beside every playlist it lets you rename). It
  // refuses the three lists that are not yours to delete - Library (All Songs),
  // Favorites and the virtual Unsorted - clears every per-playlist row the name
  // left behind, and moves the view somewhere that still exists instead of leaving
  // the app pointed at a list that is gone.
  async function deletePlaylist(name){
    var target = String(name || '').trim();
    if(!target || !playlists[target]) return false;
    if(target === 'All Songs' || target === 'Favorites' || target === UNSORTED_VIEW){
      toast('That list belongs to the app - it cannot be deleted.', 3500);
      return false;
    }
    var n = (playlists[target] || []).length;
    var sure = await modalConfirm('Delete playlist?',
      'Delete "' + target + '"? The ' + n + ' song' + (n === 1 ? '' : 's') + ' in it stay in your library - only the playlist goes.',
      'Delete');
    if(!sure) return false;
    delete playlists[target];
    try{
      if(hiddenPlaylists.has(target)){ hiddenPlaylists.delete(target); dbPut('meta', { key: 'hiddenPlaylists', value: Array.from(hiddenPlaylists) }); }
      if(djDisabledPlaylists.has(target)){ djDisabledPlaylists.delete(target); dbPut('meta', { key: 'djDisabledPlaylists', value: Array.from(djDisabledPlaylists) }); }
      if(perPlaylistSort && perPlaylistSort[target] !== undefined){ delete perPlaylistSort[target]; dbPut('meta', { key: 'perPlaylistSort', value: perPlaylistSort }); }
    }catch(_eClean){}
    if(activePlaylist === target){
      activePlaylist = 'All Songs';
      try{ rememberPlaylist(activePlaylist); }catch(_eRem){}
    }
    saveMeta();
    renderManagePlaylistsList();
    renderTabs();
    renderList();
    toast('Deleted "' + target + '".', 3000);
    return true;
  }
  window.__scDeletePlaylist = deletePlaylist;

  function deleteActivePlaylist(){
    deletePlaylist(activePlaylist);
  }
`,
  { key: 'window.__scDeletePlaylist = deletePlaylist;' });

sub(html, 'and a bin in Manage playlists beside the rename pencil',
  `        renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renamePlaylist(name); });
        row.appendChild(renameBtn);
`,
  `        renameBtn.addEventListener('click', (e) => { e.stopPropagation(); renamePlaylist(name); });
        row.appendChild(renameBtn);
        // 71.9 - the way to delete a playlist from the Library itself. Every
        // playlist you can rename is one you can remove, and the two favourites are
        // protected (Unsorted is virtual and never appears in this list at all).
        if(name !== 'Favorites'){
          const delBtn = document.createElement('button');
          delBtn.className = 'icon-btn';
          delBtn.title = 'Delete playlist';
          delBtn.style.cssText = 'flex-shrink:0; color:var(--coral);';
          delBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M6 19a2 2 0 002 2h8a2 2 0 002-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>';
          delBtn.addEventListener('click', (e) => { e.stopPropagation(); deletePlaylist(name); });
          row.appendChild(delBtn);
        }
`,
  { key: "delBtn.title = 'Delete playlist';" });

/* 71.9 - the app stores a REAL 'Unsorted' list (imports land in it) behind the
   virtual Unsorted tab, and the manage list renders a row for every stored key.
   UNSORTED_VIEW is the virtual tab's name, not the stored key, so refusing only
   the view left the bin on the stored list and the path would have deleted it.
   Both are protected now, by the path and by the bin. */
sub(html, 'and the stored Unsorted list is protected by the path too',
  "    if(target === 'All Songs' || target === 'Favorites' || target === UNSORTED_VIEW){\n",
  "    if(target === 'All Songs' || target === 'Favorites' || target === UNSORTED_VIEW || target === 'Unsorted'){\n",
  { key: "|| target === 'Unsorted'){" });

sub(html, 'and the bin is not offered for the stored Unsorted list',
  "        if(name !== 'Favorites'){\n          const delBtn = document.createElement('button');\n",
  "        if(name !== 'Favorites' && name !== 'Unsorted'){\n          const delBtn = document.createElement('button');\n",
  { key: "if(name !== 'Favorites' && name !== 'Unsorted'){" });

/* ===================== 4. THE RELEASE ITSELF =============================== */
sub(html, 'the app version',
  "  const APP_VERSION = '71.8';\n",
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

console.log('patch-719: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-719: ' + problems.length + ' problem(s):');
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
    must(!!entries.find((e) => String(e.version) === '71.8'), 'the 71.8 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The three claims this release is actually about, checked in the shipped text.
  must(final.indexOf("'sidecut-albums', undefined,") !== -1, 'the album export no longer passes albums as playlists');
  must(final.indexOf("kind: 'albums'") !== -1, 'and marks the zip it makes');
  must(final.indexOf('const _isAlbumsZip') !== -1, 'the import recognizes an albums zip');
  must(final.indexOf('async function deletePlaylist(name)') !== -1, 'and there is one delete path for a playlist');
  must(final.indexOf('window.__scDeletePlaylist = deletePlaylist;') !== -1, 'exposed for the gates');
  must(final.indexOf("delBtn.title = 'Delete playlist';") !== -1, 'with a bin in Manage playlists');
  must(final.indexOf("|| target === 'Unsorted'){") !== -1, 'the stored Unsorted list is protected by the path');
  must(final.indexOf("if(name !== 'Favorites' && name !== 'Unsorted'){") !== -1, 'and the bin is not offered for it');
  if(trouble.length){
    console.error('\npatch-719: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-719: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
