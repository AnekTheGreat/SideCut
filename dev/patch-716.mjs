#!/usr/bin/env node
/**
 * SideCut 71.6 - the albums come back, and a restored backup sticks.
 *
 * What happened, in the owner's words: "Why did all of my albums disappear" -
 * answered "Library > Albums tab AND Manage albums", songs all still there, no
 * remembered toast, and "It's purely because of the apk because on the play
 * version my albums are still there".
 *
 * That is exactly what the 63.1.4 sweep does to a library that has never run
 * it. Albums in this app used to be entries the app wrote for itself (an old
 * card-drag auto-save, or a tag album materialised so a reorder had somewhere
 * to live). 63.1.4 deleted every one of them - "on the first launch after this
 * update, not hidden" - and a first launch of a NEWLY INSTALLED APK is when a
 * pending one-time cleanup finally runs. Songs, playlists and the album TAGS on
 * the files were never touched: only the entries. That is the whole reason this
 * release can put them back.
 *
 *   1. REBUILD FROM THE TAGS. The album tags are still on the songs, so one
 *      album per tag rebuilds the list - offered in BOTH places an empty one
 *      shows ("No albums yet" in the Albums tab, and Manage albums). It is
 *      additive only: a song another album already owns stays where it is, and
 *      an album you already have keeps its songs, its order and its artist.
 *      Everything it makes or meets is stamped `manual`, which is the one mark
 *      the launch sweep never touches.
 *
 *   2. A RESTORE STICKS. The .zip import and both on-device hydrate paths used
 *      to write albums back WITH the app's own old marker still on them, and
 *      the next launch deleted them again - so a backup looked like it had
 *      restored nothing at all. ("An imported album keeps whatever marker it
 *      came with, and the next boot settles it" was the note that shipped that
 *      behaviour.) An album out of YOUR OWN backup is yours: it now arrives
 *      marked as such.
 *
 *   node dev/patch-716.mjs
 *   node dev/patch-716.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-716.mjs --check   # and name every sub it skips
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
const VERSION = '71.6';
const STAMP = 'October 1, 2026 \\u00b7 6:59 AM EDT';
const CACHE = 'sidecut-shell-v63.0.52';
const OLDCACHE = 'sidecut-shell-v63.0.51';
const TITLE = 'The albums the cleanup took can be rebuilt from the album tags on your songs, and a restored backup finally sticks';

// Seven notes. The head entry's first SIX are copied into ota-play/updates.json
// verbatim by dev/ota-bundle-play.mjs, so the first six are audited against the
// wider Play term list in dev/test-play-copy.mjs: no
// download/downloading/converter/convert(s|ing|ion)/mp3/"get song"/"no source
// found"/hand-off/vocal remover/spotisaver, and never "Play build". The seventh
// is deliberately past the cut, for the sideloaded build's sake. None of them
// contains an apostrophe: they are emitted inside single quotes.
const NOTES = [
  'The Albums tab has a way back. A blank Albums screen now offers Rebuild albums from my songs, and Manage albums carries the same button: one album for every album tag on your files, in the order the songs carry it.',
  'It only ever adds. A song another album already holds is left where it is, no song is renamed, re-tagged or removed, and an album you already have keeps its songs, its own order and its artist exactly as they were.',
  'Everything the rebuild makes - and every album it meets - is marked as yours, which is the one mark the launch cleanup never touches. That is what stops an album it put back from being taken a second time.',
  'A restored backup sticks now. An album that arrived with your export .zip, or from the copy the app keeps on the device, used to keep the mark the app had put on the entries it made for itself - and the next launch deleted it, so a restore looked like it had brought nothing back.',
  'The player is untouched: the dock, the queue, your playlists, your covers and every saved song behave exactly as they did before this release.',
  'Nothing here rewrites your music. No stored track, cover or playlist changes, and the album tags on your files are simply the source the rebuild reads.',
  'And the cleanup itself was never wrong about your songs: it removed entries the app had made for itself, and it never touched a tag on a file. That is why a library whose albums were all app-created can be put back from the songs, entry for entry, without a backup at all.',
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
  console.log('patch-716: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE REBUILD - from the album tags the songs still carry
   ========================================================================== */

// 1a. The two helpers, beside the album rules they belong to: the marker pass
//     that says "this album is yours", and the rebuild itself.
sub(html, 'the rebuild helpers',
  `  function autoAlbumNames(){
    return Object.keys(userAlbums || {}).filter(function(n){ return albumIsAuto(n); });
  }
`,
  `  function autoAlbumNames(){
    return Object.keys(userAlbums || {}).filter(function(n){ return albumIsAuto(n); });
  }
  // ---- 71.6 - the albums the cleanup took, rebuilt from the tags -----------
  // 63.1.4 deleted the album entries older builds had written for themselves.
  // It deleted ENTRIES, never songs, and never a tag on a file - every one of
  // those albums was a copy of an album tag that is still on the songs. That is
  // what makes them rebuildable, and this is the pass that does it.
  //
  // scAlbumsMarkOurs() is the other half. An album that arrives with a backup or
  // an on-device restore came out of YOUR library, so it leaves with the mark
  // that says so. Without this the old "auto" marker rides in with the backup
  // and the next launch's sweep deletes the album that was just restored - a
  // restore that looks like it brought nothing back.
  function scAlbumsMarkOurs(albs){
    try{
      Object.keys(albs || {}).forEach(function(n){
        var e = albs[n];
        if(!e || typeof e !== 'object') return;
        e.manual = true;
        delete e.auto;
      });
    }catch(_eMark){}
    return albs;
  }
  window.__scAlbumsMarkOurs = scAlbumsMarkOurs;

  // One album per album tag on the files, in the order the songs carry it. A tag
  // that already has an album is left alone (and stamped as yours, so it cannot
  // be swept); a tag with no album gets one, taking only the songs no other
  // album has claimed - the same no-stealing rule ensureAlbumSaved() documents.
  // Additive, always: nothing here ever removes a song from an album.
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
    tags.forEach(function(tag){
      if(userAlbums[tag]){ markAlbumManual(tag); met++; return; }
      try{ if(ensureAlbumSaved(tag)) added++; }catch(_eSave){}
    });
    scAlbumsMarkOurs(userAlbums);
    if(added){
      // The new names go on the END of your order. Falling back to key order
      // would put a name like "2003" wherever the language hoists it, which is
      // the one thing an explicit order exists to prevent.
      tags.forEach(function(tag){
        if(userAlbums[tag] && albumOrder.indexOf(tag) === -1) albumOrder.push(tag);
      });
      try{ dbPut('meta', { key: 'albumOrder', value: albumOrder }); }catch(_eOrder){}
    }
    // ensureAlbumSaved() writes a row per album it makes; this covers the marks.
    try{ dbPut('meta', { key: 'userAlbums', value: userAlbums }); }catch(_eRow){}
    try{ renderList(); }catch(_eRl){}
    try{ refreshManageAlbums(true); }catch(_eMg){}
    var total = 0;
    try{ total = visibleAlbumNames().length; }catch(_eTot){}
    if(added){
      toast('Rebuilt ' + added + ' album' + (added === 1 ? '' : 's') + ' from the tags on your songs - ' + total + ' in your library now.', 5000);
      setTimeout(function(){ try{ toast(met ? (met + ' album' + (met === 1 ? '' : 's') + ' you already had were left exactly as they were.') : 'Your album tags are what it read - nothing on a file was changed.', 5000); }catch(_eT2){} }, 2600);
    } else {
      toast(met
        ? ('Nothing to rebuild - all ' + met + ' album tags on your songs already have their album.')
        : 'Nothing to rebuild yet.', 4500);
    }
    return added;
  }
  window.__scRebuildAlbumsFromTags = rebuildAlbumsFromTags;
`,
  { key: 'function rebuildAlbumsFromTags(){' });

// 1b. The Albums tab's own empty state. An empty Albums screen is exactly where
//     someone whose albums were taken looks first, so the way back is there and
//     not only inside Manage albums.
sub(html, 'the Rebuild button in the empty Albums tab',
  `      pane.appendChild(empty);
      return;
    }
`,
  `      pane.appendChild(empty);
      // 71.6 - an empty Albums tab is where anyone whose albums were taken looks
      // first, so the way back belongs here too, not only in Manage albums. The
      // tags are still on the songs; this turns them into albums again. It only
      // ever adds, so there is nothing to warn about.
      if(libraryMode === 'albums'){
        const _rbBtn = document.createElement('button');
        _rbBtn.id = 'albRebuildBtn';
        _rbBtn.className = 'playlist-pick-btn';
        _rbBtn.style.cssText = 'width:100%; text-align:center; margin-top:10px; border-color:var(--coral); color:var(--coral);';
        _rbBtn.textContent = 'Rebuild albums from my songs';
        _rbBtn.addEventListener('click', function(){ try{ rebuildAlbumsFromTags(); }catch(_eRb){} });
        pane.appendChild(_rbBtn);
        const _rbNote = document.createElement('div');
        _rbNote.style.cssText = 'font-size:11px; color:var(--ink-dim); margin-top:10px; line-height:1.55; text-align:center;';
        _rbNote.textContent = 'One album for every album tag on your files. No song is moved, renamed or re-tagged by it.';
        pane.appendChild(_rbNote);
      }
      return;
    }
`,
  { key: "id = 'albRebuildBtn'" });

// 1c. Manage albums: the button, in the panel's own shape. It sits OUTSIDE the
//     .mgr-alb-row rows on purpose - the search box hides those by class, and
//     the way back should not disappear because a query is typed.
const REBUILD_BLOCK =
  `    var _rebuild = '<div style="padding:14px 2px 2px; border-top:1px solid var(--line); margin-top:8px;">'` +
  `\n      + '<button id="mgrAlbumRebuild" style="width:100%; padding:10px; border-radius:10px; border:1px solid var(--line); background:none; color:var(--coral); font-size:12.5px; font-weight:700; cursor:pointer;">Rebuild albums from my songs</button>'` +
  `\n      + '<div style="font-size:11px; color:var(--ink-dim); margin-top:8px; line-height:1.55;">One album for every album tag on your files. Nothing is taken from a song and no album you already have is changed.</div>'` +
  `\n      + '</div>';\n`;

sub(html, 'the Manage albums rebuild button, in the empty panel',
  `    if(!names.length) return '<div class="dp-empty">No albums yet.</div>';
`,
  REBUILD_BLOCK +
  `    if(!names.length) return '<div class="dp-empty">No albums yet.</div>' + _rebuild;
`,
  { key: "id=\"mgrAlbumRebuild\"" });

// NOTE: the block itself is defined ONCE, by the sub above; this one only uses
// it. Emitting REBUILD_BLOCK again here would declare `_rebuild` twice.
sub(html, 'the Manage albums rebuild button, below the rows',
  `    html += '<div id="mgrAlbumNoMatch" class="dp-empty" style="display:none;">No album matches that search.</div>';
    html += '</div>';
    return html;
`,
  `    html += '<div id="mgrAlbumNoMatch" class="dp-empty" style="display:none;">No album matches that search.</div>';
    html += _rebuild;
    html += '</div>';
    return html;
`,
  { key: 'html += _rebuild;' });

// 1d. Wire it. Two taps, exactly like Delete above it - it is additive, but it
//     can make a lot of albums at once, and the Android WebView can swallow
//     window.confirm(), which is why the panel does not use it either.
sub(html, 'the Manage albums rebuild wiring',
  `        }, 4000);
      });
    });
  }
  function refreshManageAlbums(keepQuery){
`,
  `        }, 4000);
      });
    });
    // 71.6 - Rebuild, armed on the first tap like Delete above.
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
  function refreshManageAlbums(keepQuery){
`,
  { key: '_rbWire._armedWired' });

/* ============================================================================
   2. A RESTORE STICKS - an album out of your own backup is yours
   ========================================================================== */

// 2a. The export .zip import. This is the one that reads "an imported album
//     keeps whatever marker it came with, and the next boot settles it".
sub(html, 'the .zip import marks its albums as yours',
  `        userAlbums = _albMerged;
        dbPut('meta', { key: 'userAlbums', value: userAlbums });
        // (No album-flag pass to fend off any more: an imported album keeps
        // whatever marker it came with, and the next boot settles it.)
`,
  `        userAlbums = _albMerged;
        // 71.6 - every album that came out of this backup is one of yours, so
        // the app's own old marker comes off it here. Left on, that marker is
        // what the next launch's sweep deletes: the import restored the albums
        // and then the relaunch took them away again.
        try{ scAlbumsMarkOurs(userAlbums); }catch(_eMark){}
        dbPut('meta', { key: 'userAlbums', value: userAlbums });
`,
  // NOTE: the key must be text ONLY this sub adds. `scAlbumsMarkOurs(userAlbums);`
  // is not usable as the key - sub 1a puts that exact call inside
  // rebuildAlbumsFromTags() earlier in the same run, and a key that matches text
  // an earlier sub added skips this sub while --check still looks clean.
  { key: 'came out of this backup is one of yours' });

// 2b. The full-state hydrate behind "import everything" - the same rule, for the
//     rows that are written straight out of the backup's state object.
sub(html, 'the full-state hydrate marks its albums as yours',
  `      if(state.meta){
        for(var mk in state.meta){ try{ await dbPut('meta', { key: mk, value: state.meta[mk] }); }catch(e){} }
`,
  `      if(state.meta){
        // 71.6 - an album restored out of a backup is yours; the marker the app
        // put on the entries it made for ITSELF must not survive the trip, or
        // the next launch's sweep deletes what this restore just put back.
        try{ if(state.meta.userAlbums) state.meta.userAlbums = scAlbumsMarkOurs(state.meta.userAlbums); }catch(_eMark){}
        for(var mk in state.meta){ try{ await dbPut('meta', { key: mk, value: state.meta[mk] }); }catch(e){} }
`,
  { key: 'state.meta.userAlbums = scAlbumsMarkOurs' });

// 2c. And the on-device snapshot restore, which hydrates the same rows after a
//     wipe. Its rows are the ones a reinstall brings back, so they need it most.
sub(html, 'the on-device restore marks its albums as yours',
  `        if(metaWiped && snap.meta){
          for(var mk in snap.meta){
            try{ await dbPut('meta', { key: mk, value: snap.meta[mk] }); }catch(e){}
          }
        }
`,
  `        if(metaWiped && snap.meta){
          // 71.6 - same rule as the .zip import. A library that survived a wipe
          // by being restored must not be deleted by the very next launch.
          try{ if(snap.meta.userAlbums) snap.meta.userAlbums = scAlbumsMarkOurs(snap.meta.userAlbums); }catch(_eMark){}
          for(var mk in snap.meta){
            try{ await dbPut('meta', { key: mk, value: snap.meta[mk] }); }catch(e){}
          }
        }
`,
  { key: 'snap.meta.userAlbums = scAlbumsMarkOurs' });

/* ===================== 3. THE RELEASE ITSELF ================================ */
sub(html, 'the app version',
  "  const APP_VERSION = '71.5';\n",
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

console.log('patch-716: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-716: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
