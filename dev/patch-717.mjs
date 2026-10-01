#!/usr/bin/env node
/**
 * SideCut 71.7 - the rebuild stops guessing, and it can be undone.
 *
 * The owner's words, after 71.6: "I'm missing mad albums and you made every
 * single damn song be an album of it's own fix it and I need my songs in the
 * correct order in albums and I'm missing songs inside of albums".
 *
 * 71.6 offered a rebuild from the album tags and ran it on a single tap. On a
 * library whose FILES carry one album tag per song - which is what a converter
 * writes - that is one album per song: the library again, wearing album cards.
 * And the grouping the owner actually had (the old card-drag auto-save, and
 * anything hand-made) is not derivable from a tag at all, which is why "mad
 * albums" were still missing and the albums that did come back were short.
 *
 * So this release takes the blunt instrument away and puts the right one first:
 *
 *   1. IT SAYS WHAT IT WOULD DO FIRST. The rebuild opens a sheet with the real
 *      counts - how many tags there are, how many cover more than one song - and
 *      offers **only the multi-song tags by default**. `mode` is 'multi' | 'all';
 *      with no multi-song tags it refuses and points at a backup instead of
 *      making hundreds of one-song albums.
 *
 *   2. IT CAN BE UNDONE. The albums as they stand are snapshotted into
 *      `localStorage 'sidecut_albumsUndo'` before the first rebuild, and Manage
 *      albums offers "Undo the last rebuild" - one tap back to exactly the list
 *      that was there before, order included. The FIRST snapshot is the one kept,
 *      so rebuilding twice cannot bury the good state under a bad one.
 *
 *   3. THE COPY THAT HAS THE REAL ALBUMS IS ONE TAP AWAY. "Restore from my
 *      backup" opens the backup importer from the Albums tab and from Manage
 *      albums. That is the path that carries names, songs AND their order - no
 *      tag can - and 71.6 already stopped the sweep eating what it restores.
 *
 *   4. THE ORDER THE BACKUP BRINGS NOW WINS. The import used to keep the local
 *      `albumOrder` unless this device had none, so importing over a library that
 *      had an order (or had just been tag-rebuilt) left the albums in the OLD
 *      arrangement. The backup's order is adopted for every album it knows, with
 *      local-only names appended, and written back.
 *
 *   node dev/patch-717.mjs
 *   node dev/patch-717.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-717.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '71.7';
const STAMP = 'October 1, 2026 \\u00b7 7:32 AM EDT';
const CACHE = 'sidecut-shell-v63.0.53';
const OLDCACHE = 'sidecut-shell-v63.0.52';
const TITLE = 'The album rebuild shows what it would make and offers only the tags shared by several songs, one tap undoes it, and a backup brings the real albums back';

// Seven notes, none carrying an apostrophe (they are emitted inside single
// quotes). The first six ride to the store channel and are clean of
// dev/test-play-copy.mjs's wider word list; the seventh is past the cut.
const NOTES = [
  'Rebuilding albums from tags says what it would make before it makes it. A sheet counts the album tags on your songs and offers the ones that cover more than one song - so a library whose files carry one tag per song can no longer be turned into one album per song by a single tap.',
  'Only three of the tags on a real library are usually albums. A tag that appears on one song is normally the song own name rather than an album, which is exactly what the old rebuild was making hundreds of.',
  'Undo the last rebuild is in Manage albums, and it puts your albums back exactly as they were - the same names, the same songs, the same order - from a snapshot taken before the first rebuild.',
  'Restore from my backup is one tap in Manage albums and on the empty Albums screen. That is the copy that carries the albums you actually had, with the right songs in the right order, and the tag rebuild can never reconstruct that on its own.',
  'The album order a backup brings is the order you get now. Importing used to keep the arrangement already on the device unless it had none, so albums came back in the old order even when the backup knew better.',
  'The player is untouched: the dock, the queue, your playlists and every saved song behave exactly as they did before this release.',
  'And nothing is taken from a song by any of it - the tags on your files are only ever read, never rewritten, and every album the rebuild makes can be deleted from Manage albums like any other.',
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

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-717: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE PLAN - what a rebuild would make, counted before it makes it
   ========================================================================== */
sub(html, 'the rebuild plan',
  `  window.__scAlbumsMarkOurs = scAlbumsMarkOurs;
`,
  `  window.__scAlbumsMarkOurs = scAlbumsMarkOurs;

  // 71.7 - what a rebuild WOULD make, before it makes any of it. Every tag on
  // the songs, with how many songs carry it: that is the difference between an
  // album list and "one album per song", and it is a number rather than a guess.
  function scAlbumRebuildPlan(){
    var tags = [], counts = {};
    allTracks.forEach(function(t){
      if(!t) return;
      var tag = String(t.album || '').trim();
      if(!tag) return;
      if(!counts[tag]){ counts[tag] = 0; tags.push(tag); }
      counts[tag]++;
    });
    var multi = 0, single = 0;
    tags.forEach(function(tag){ if(counts[tag] > 1) multi++; else single++; });
    return { tags: tags, counts: counts, multi: multi, single: single };
  }
  window.__scAlbumRebuildPlan = scAlbumRebuildPlan;
`,
  { key: 'function scAlbumRebuildPlan(){' });

/* ============================================================================
   2. THE REBUILD - which tags, and a snapshot first
   ========================================================================== */
sub(html, 'the rebuild takes a mode and arms the undo point',
  `  // Additive, always: nothing here ever removes a song from an album.
  function rebuildAlbumsFromTags(){
    var tags = [], seen = {};
    allTracks.forEach(function(t){
      if(!t) return;
      var tag = String(t.album || '').trim();
      if(!tag || seen[tag]) return;
      seen[tag] = 1;
      tags.push(tag);
    });
    if(!tags.length){
      toast('None of your songs carry an album tag, so there is nothing to rebuild from.', 4500);
      return 0;
    }
    var added = 0, met = 0;
`,
  `  // Additive, always: nothing here ever removes a song from an album.
  //
  // 71.7 - \`mode\` decides WHICH tags, and it matters more than anything else
  // here. This used to take them all, which is the wrong answer for a library
  // whose files carry one album tag per song (a converter writes the song's own
  // name into the album field): the rebuild then produced one album per song,
  // which is not an album list, it is the library again. 'multi' - the default,
  // and the choice the sheet offers - takes only the tags shared by more than one
  // song, so that cannot happen by a single tap; 'all' is there for the library
  // whose tags really are the album names. The albums as they stand are
  // snapshotted FIRST, so one tap in Manage albums puts them back.
  function rebuildAlbumsFromTags(mode){
    var plan = scAlbumRebuildPlan();
    if(!plan.tags.length){
      toast('None of your songs carry an album tag, so there is nothing to rebuild from.', 4500);
      return 0;
    }
    var tags = (mode === 'all')
      ? plan.tags.slice()
      : plan.tags.filter(function(t){ return plan.counts[t] > 1; });
    if(!tags.length){
      toast('Every album tag on your songs covers a single song, so a rebuild would make one album per song. Import a backup instead \\u2014 it brings back the albums you actually had.', 8000);
      return 0;
    }
    scAlbumUndoArm();
    var added = 0, met = 0;
`,
  { key: 'function rebuildAlbumsFromTags(mode){' });

sub(html, 'the rebuild says where the undo is',
  `      toast('Rebuilt ' + added + ' album' + (added === 1 ? '' : 's') + ' from the tags on your songs - ' + total + ' in your library now.', 5000);
      setTimeout(function(){ try{ toast(met ? (met + ' album' + (met === 1 ? '' : 's') + ' you already had were left exactly as they were.') : 'Your album tags are what it read - nothing on a file was changed.', 5000); }catch(_eT2){} }, 2600);
`,
  `      toast('Rebuilt ' + added + ' album' + (added === 1 ? '' : 's') + ' from the tags on your songs - ' + total + ' in your library now' + (met ? (', ' + met + ' you already had left untouched') : '') + '.', 5000);
      setTimeout(function(){ try{ toast('Not the albums you had? Manage albums has Undo the last rebuild, and Restore from my backup.', 9000); }catch(_eT2){} }, 2600);
`,
  { key: 'Manage albums has Undo the last rebuild' });

/* ============================================================================
   3. UNDO, AND THE SHEET THAT ASKS FIRST
   ========================================================================== */
sub(html, 'the undo point, the undo, and the sheet',
  `  window.__scRebuildAlbumsFromTags = rebuildAlbumsFromTags;
`,
  `  window.__scRebuildAlbumsFromTags = rebuildAlbumsFromTags;

  // ---- 71.7 - the way back out of a rebuild ---------------------------------
  // A rebuild is a guess made from tags, and a guess the user cannot undo is not
  // a feature, it is a trap. The album list as it stands is copied here first,
  // and one tap in Manage albums puts it back - names, songs and order.
  // localStorage because this is a short-lived undo POINT, not library data:
  // nothing but the two functions below ever reads it, and it is dropped the
  // moment it is used. The FIRST snapshot is the one kept, so rebuilding twice
  // cannot bury the good state under a bad one.
  var SC_ALBUM_UNDO_KEY = 'sidecut_albumsUndo';
  var SC_ALBUM_UNDO_MAX = 200000;   // a rebuild is not worth more localStorage than this
  function scAlbumUndoArm(){
    try{
      if(localStorage.getItem(SC_ALBUM_UNDO_KEY)) return false;
      var payload = JSON.stringify({ at: Date.now(), albums: userAlbums, order: albumOrder });
      if(payload.length > SC_ALBUM_UNDO_MAX){
        console.warn('[SideCut] albums are too big to keep an undo point for');
        return false;
      }
      localStorage.setItem(SC_ALBUM_UNDO_KEY, payload);
      return true;
    }catch(_eArm){ return false; }
  }
  function scAlbumUndoAvailable(){
    try{
      var raw = localStorage.getItem(SC_ALBUM_UNDO_KEY);
      if(!raw) return null;
      var o = JSON.parse(raw);
      if(!o || !o.albums || typeof o.albums !== 'object') return null;
      return o;
    }catch(_eRead){ return null; }
  }
  function undoAlbumRebuild(){
    var o = scAlbumUndoAvailable();
    if(!o){ toast('There is no rebuild to undo.'); return false; }
    var n = Object.keys(o.albums).length;
    userAlbums = o.albums;
    albumOrder = Array.isArray(o.order) ? o.order.slice() : [];
    Object.keys(userAlbums).forEach(function(k){ if(albumOrder.indexOf(k) === -1) albumOrder.push(k); });
    // The point of the undo is that these albums STAY: an entry the sweep would
    // have taken must not be taken on the next launch instead.
    scAlbumsMarkOurs(userAlbums);
    try{ dbPut('meta', { key: 'userAlbums', value: userAlbums }); }catch(_eAlb){}
    try{ dbPut('meta', { key: 'albumOrder', value: albumOrder }); }catch(_eOrd){}
    try{ localStorage.removeItem(SC_ALBUM_UNDO_KEY); }catch(_eRm){}
    try{ renderList(); }catch(_eRl){}
    try{ refreshManageAlbums(true); }catch(_eMg){}
    toast(n
      ? ('Put your ' + n + ' album' + (n === 1 ? '' : 's') + ' back exactly as they were before the rebuild.', 5000)
      : 'The rebuild is undone - the album list is back to where it was before it.', 5000);
    return true;
  }
  window.__scUndoAlbumRebuild = undoAlbumRebuild;
  window.__scAlbumUndoAvailable = scAlbumUndoAvailable;

  // The sheet. Nothing is rebuilt until one of these buttons is tapped, and the
  // number on the primary button is the number of albums it will actually make.
  function rebuildAlbumsFromTagsPrompt(){
    var plan = scAlbumRebuildPlan();
    if(!plan.tags.length){
      toast('None of your songs carry an album tag, so there is nothing to rebuild from.', 4500);
      return;
    }
    var total = plan.tags.length;
    var bd = document.createElement('div');
    bd.className = 'modal-backdrop';
    bd.id = 'albRebuildSheet';
    bd.style.zIndex = '250';
    bd.style.display = 'flex';
    var sh = document.createElement('div');
    sh.className = 'modal';
    sh.style.maxWidth = '362px';
    sh.innerHTML = '<h3>Rebuild albums from tags</h3>'
      + '<div style="font-size:12.5px;color:var(--ink-dim);line-height:1.6;margin-bottom:10px;">Your songs carry <b>' + total + '</b> album tag' + (total === 1 ? '' : 's') + ' between them, and <b>' + plan.multi + '</b> appear on more than one song.</div>'
      + (plan.single ? '<div style="font-size:11.5px;color:var(--ink-dim);line-height:1.55;margin-bottom:10px;">A tag that appears on one song is usually the song name rather than an album. Rebuilding those is what makes one album per song.</div>' : '')
      + '<div style="font-size:11.5px;color:var(--ink-dim);line-height:1.55;margin-bottom:14px;">Nothing is taken from your songs either way, and <b>Undo the last rebuild</b> is in Manage albums afterwards. A backup .zip restores the albums you actually had - names, songs and their order - which no tag can.</div>'
      + '<div style="display:flex;flex-direction:column;gap:8px;">'
      + (plan.multi ? '<button id="albRebuildMulti" style="padding:11px;border-radius:8px;border:none;background:var(--coral);color:#161616;font-weight:700;font-size:13px;">Rebuild the ' + plan.multi + ' album' + (plan.multi === 1 ? '' : 's') + '</button>' : '')
      + '<button id="albRebuildAll" style="padding:11px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink);font-size:13px;">Rebuild all ' + total + ' tag' + (total === 1 ? '' : 's') + '</button>'
      + '<button id="albRebuildCancel" style="padding:11px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:13px;">Cancel</button>'
      + '</div>';
    bd.appendChild(sh);
    document.body.appendChild(bd);
    function close(){ try{ bd.remove(); }catch(_eClose){} }
    try{
      var m = bd.querySelector('#albRebuildMulti');
      if(m) m.addEventListener('click', function(){ close(); rebuildAlbumsFromTags('multi'); });
      bd.querySelector('#albRebuildAll').addEventListener('click', function(){ close(); rebuildAlbumsFromTags('all'); });
      bd.querySelector('#albRebuildCancel').addEventListener('click', close);
      bd.addEventListener('click', function(e){ if(e.target === bd) close(); });
    }catch(_eWire){}
  }
  window.__scAlbumRebuildPrompt = rebuildAlbumsFromTagsPrompt;

  // The backup importer, opened from the Albums side of the app. It is the same
  // hidden input Settings uses (id importLibInput -> importLibrary), so there is
  // exactly one import path and one set of rules about what a restore does.
  function scOpenBackupImport(){
    try{
      var inp = $('importLibInput');
      if(inp){ inp.click(); return true; }
    }catch(_eOpen){}
    try{ toast('Importing a backup lives in Settings > Backup - pick the .zip there.', 5000); }catch(_eT){}
    return false;
  }
  window.__scOpenBackupImport = scOpenBackupImport;
`,
  { key: 'function rebuildAlbumsFromTagsPrompt(){' });

/* ============================================================================
   4. BOTH PLACES AN EMPTY ALBUMS SCREEN SHOWS
   ========================================================================== */
sub(html, 'the empty Albums tab asks first and offers the backup',
  `        _rbBtn.textContent = 'Rebuild albums from my songs';
        _rbBtn.addEventListener('click', function(){ try{ rebuildAlbumsFromTags(); }catch(_eRb){} });
        pane.appendChild(_rbBtn);
        const _rbNote = document.createElement('div');
        _rbNote.style.cssText = 'font-size:11px; color:var(--ink-dim); margin-top:10px; line-height:1.55; text-align:center;';
        _rbNote.textContent = 'One album for every album tag on your files. No song is moved, renamed or re-tagged by it.';
        pane.appendChild(_rbNote);
`,
  `        _rbBtn.textContent = 'Rebuild albums from my songs';
        // 71.7 - the sheet, not the rebuild: the button says what it would make
        // before it makes it, and it can always be undone afterwards.
        _rbBtn.addEventListener('click', function(){ try{ rebuildAlbumsFromTagsPrompt(); }catch(_eRb){} });
        pane.appendChild(_rbBtn);
        // 71.7 - and the copy that HAS the albums, one tap away. This is the
        // honest first answer on an empty Albums screen: a backup restores the
        // names, the songs and their order, which a tag cannot.
        const _rbRestore = document.createElement('button');
        _rbRestore.id = 'albRestoreBtn';
        _rbRestore.className = 'playlist-pick-btn';
        _rbRestore.style.cssText = 'width:100%; text-align:center; margin-top:8px;';
        _rbRestore.textContent = 'Restore from my backup';
        _rbRestore.addEventListener('click', function(){ scOpenBackupImport(); });
        pane.appendChild(_rbRestore);
        const _rbNote = document.createElement('div');
        _rbNote.style.cssText = 'font-size:11px; color:var(--ink-dim); margin-top:10px; line-height:1.55; text-align:center;';
        _rbNote.textContent = 'A backup .zip brings back the albums you actually had, with their songs in order. The tag rebuild is only an approximation.';
        pane.appendChild(_rbNote);
`,
  { key: "'albRestoreBtn'" });

// The panel's own block: the sheet first, the undo, and the backup.
sub(html, 'the Manage albums block offers the sheet, the undo and the backup',
  `    var _rebuild = '<div style="padding:14px 2px 2px; border-top:1px solid var(--line); margin-top:8px;">'
      + '<button id="mgrAlbumRebuild" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--line); background:none; color:var(--coral); font-size:12.5px; font-weight:700; cursor:pointer;">Rebuild albums from my songs</button>'
      + '<div style="font-size:11px; color:var(--ink-dim); margin-top:8px; line-height:1.55;">One album for every album tag on your files. Nothing is taken from a song and no album you already have is changed.</div>'
      + '</div>';
`,
  `    // 71.7 - the way back out of a rebuild, and the copy that has the real
    // albums. The undo button is only there while a rebuild is actually
    // undoable, so it is never a dead control.
    var _undo = (typeof scAlbumUndoAvailable === 'function') ? scAlbumUndoAvailable() : null;
    var _btnBase = 'width:100%; padding:10px; border-radius:10px; border:1px solid var(--line); background:none; font-size:12.5px; font-weight:700; cursor:pointer;';
    var _rebuild = '<div style="padding:14px 2px 2px; border-top:1px solid var(--line); margin-top:8px;">'
      + '<button id="mgrAlbumRebuild" style="' + _btnBase + ' color:var(--coral);">Rebuild albums from my songs</button>'
      + (_undo ? '<button id="mgrAlbumUndo" style="' + _btnBase + ' color:var(--coral); margin-top:8px;">Undo the last rebuild</button>' : '')
      + '<button id="mgrAlbumRestore" style="' + _btnBase + ' color:var(--ink); margin-top:8px;">Restore from my backup</button>'
      + '<div style="font-size:11px; color:var(--ink-dim); margin-top:8px; line-height:1.55;">A backup .zip restores the albums you actually had - names, songs and their order. Rebuilding from tags only guesses at that from the album tags on your files, so it is offered second and can be undone.</div>'
      + '</div>';
`,
  { key: "'mgrAlbumRestore'" });

/* ============================================================================
   5. THE WIRING
   ========================================================================== */
sub(html, 'the panel wiring: the sheet, the undo, the backup',
  `    // 71.6 - Rebuild, armed on the first tap like Delete above.
    var _rbWire = bEl.querySelector('#mgrAlbumRebuild');
    if(_rbWire && !_rbWire._armedWired){
      _rbWire._armedWired = true;
      _rbWire.addEventListener('click', function(e){
        e.stopPropagation();
        if(this.dataset.armed !== '1'){
          this.dataset.armed = '1';
          this.textContent = 'Tap again to rebuild';
          var _self = this;
          setTimeout(function(){
            if(_self.dataset.armed !== '1') return;
            _self.dataset.armed = '';
            _self.textContent = 'Rebuild albums from my songs';
          }, 4000);
          return;
        }
        this.dataset.armed = '';
        this.textContent = 'Rebuild albums from my songs';
        try{ rebuildAlbumsFromTags(); }catch(_eRb){}
      });
    }
  }
`,
  `    // 71.7 - Rebuild opens the sheet, which IS the confirmation now: it shows
    // the counts and the album list it would make, where the 71.6 two-tap arm
    // only asked whether you were sure about something it had not described.
    var _rbWire = bEl.querySelector('#mgrAlbumRebuild');
    if(_rbWire && !_rbWire._rbWired){
      _rbWire._rbWired = true;
      _rbWire.addEventListener('click', function(e){
        e.stopPropagation();
        try{ rebuildAlbumsFromTagsPrompt(); }catch(_eRb){}
      });
    }
    var _undoWire = bEl.querySelector('#mgrAlbumUndo');
    if(_undoWire && !_undoWire._undoWired){
      _undoWire._undoWired = true;
      _undoWire.addEventListener('click', function(e){
        e.stopPropagation();
        try{ undoAlbumRebuild(); }catch(_eUndo){}
      });
    }
    var _restoreWire = bEl.querySelector('#mgrAlbumRestore');
    if(_restoreWire && !_restoreWire._restoreWired){
      _restoreWire._restoreWired = true;
      _restoreWire.addEventListener('click', function(e){
        e.stopPropagation();
        scOpenBackupImport();
      });
    }
  }
`,
  { key: '_undoWire._undoWired' });

/* ============================================================================
   6. THE ORDER THE BACKUP BRINGS WINS
   ========================================================================== */
sub(html, 'the import adopts the album order the backup carries',
  `        try{
          var _aoRow = await dbGet('meta', 'albumOrder');
          if(_aoRow && Array.isArray(_aoRow.value) && _aoRow.value.length && (!Array.isArray(albumOrder) || !albumOrder.length)) albumOrder = _aoRow.value;
        }catch(_eAo){}
`,
  `        // 71.7 - the backup's album ORDER wins for every album it knows about.
        // This used to take the local row unless this device had no order at
        // all, so importing a backup over a library that already had one (or had
        // just been rebuilt from tags) left the albums in the OLD arrangement -
        // the half of "my albums are back" that a list of names and songs cannot
        // show. Names the backup did not know are appended, so nothing is lost.
        try{
          var _aoRow = await dbGet('meta', 'albumOrder');
          var _ao = (_aoRow && Array.isArray(_aoRow.value)) ? _aoRow.value : [];
          var _mergedOrder = [];
          _ao.forEach(function(n){ if(userAlbums[n] && _mergedOrder.indexOf(n) === -1) _mergedOrder.push(n); });
          Object.keys(userAlbums).forEach(function(n){ if(_mergedOrder.indexOf(n) === -1) _mergedOrder.push(n); });
          albumOrder = _mergedOrder;
          try{ dbPut('meta', { key: 'albumOrder', value: albumOrder }); }catch(_eAoW){}
        }catch(_eAo){}
`,
  { key: '_mergedOrder' });

/* ============================================================================
   6b. A SONG THE ID REMAP COULD NOT PLACE IS NOT GIVEN UP ON
   ========================================================================== */
sub(html, 'the album remap gets a third chance by title',
  `        var _localIds = new Set(allTracks.map(function(t){ return t.id; }));
`,
  `        var _localIds = new Set(allTracks.map(function(t){ return t.id; }));
        // 71.7 - a song the id remap could not place is not given up on. The
        // content key the importer matches on is name + artist + DURATION, and a
        // cleaned title or a missing duration on either side is enough to miss
        // it - which silently drops that song out of its album while the song
        // itself is sitting right there in the library. So a third chance: the
        // name the backup recorded for that id, matched against the songs here,
        // with the artist first and then on its own.
        var _looseRecs = {};
        try{
          (manifest.tracks || []).forEach(function(m){ if(m && m.id && m.name) _looseRecs[m.id] = m; });
        }catch(_eLoose){}
`,
  { key: '_looseRecs = {}' });

sub(html, 'the album remap uses the title chance before dropping a song',
  `            var nid = idRemap[oid];
            if(nid){ if(mapped.indexOf(nid) === -1) mapped.push(nid); }
            touched = true;
`,
  `            var nid = idRemap[oid];
            if(nid){ if(mapped.indexOf(nid) === -1) mapped.push(nid); }
            else{
              var _rec = _looseRecs[oid];
              var _guess = _rec ? scAlbumFindByTitle(_rec.name, _rec.artist) : null;
              if(_guess && mapped.indexOf(_guess) === -1) mapped.push(_guess);
            }
            touched = true;
`,
  { key: '_looseRecs[oid]' });

// The third chance itself lives at the TOP level, next to the other album
// helpers, so it exists whether or not an import has ever run (the gate drives
// it, and a helper that only exists after a backup is a helper nobody can test).
sub(html, 'the title matcher the album remap falls back to',
  `  window.__scAlbumsMarkOurs = scAlbumsMarkOurs;
`,
  `  window.__scAlbumsMarkOurs = scAlbumsMarkOurs;

  // 71.7 - a song the import's id remap could not place is not given up on. The
  // content key that remap is built on is name + artist + DURATION, so a title
  // the import cleaned, or a duration one side never had, is enough to miss it -
  // and a miss drops that song out of its ALBUM while the song itself is sitting
  // right there in the library. That is the "missing songs inside of albums"
  // half of the report. This is the third chance: the name the backup recorded
  // for that id, matched here, artist first and then the title on its own.
  function scAlbumLooseNorm(v){ return String(v || '').toLowerCase().replace(/\\s+/g, ' ').trim(); }
  function scAlbumFindByTitle(name, artist){
    var n = scAlbumLooseNorm(name), a = scAlbumLooseNorm(artist);
    if(!n) return null;
    var first = null;
    for(var i = 0; i < allTracks.length; i++){
      var t = allTracks[i];
      if(!t || scAlbumLooseNorm(t.name) !== n) continue;
      if(a && scAlbumLooseNorm(t.artist) === a) return t.id;
      if(!first) first = t.id;
    }
    return first;
  }
  window.__scAlbumFindByTitle = scAlbumFindByTitle;
`,
  { key: 'function scAlbumFindByTitle(name, artist){' });

/* ===================== 7. THE RELEASE ITSELF ================================ */
sub(html, 'the app version',
  "  const APP_VERSION = '71.6';\n",
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

console.log('patch-717: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-717: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
