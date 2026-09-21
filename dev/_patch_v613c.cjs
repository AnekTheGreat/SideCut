#!/usr/bin/env node
// v60.1.3, part C — renaming an album also renames its artist.
//
// The "Rename" button in Manage albums asked for one thing: the album name. An
// album the user built by hand usually needs the artist printed under it fixed at
// the same time, so the dialog now asks for both — and the songs travel with the
// artist change when the album really has one artist (a compilation keeps each
// song's own artist).
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let html = fs.readFileSync(HTML, 'utf8');

function sub(name, from, to) {
  const found = html.split(from).length - 1;
  if (found !== 1) throw new Error(`${name}: expected 1, found ${found}`);
  console.log('  ✓ ' + name);
  html = html.split(from).join(to);
}

const NEW = `  // The artist an album is filed under: the one saved on the album entry, or the
  // artist of its first song when it has never been set.
  function albumArtistFor(name){
    var e = userAlbums[name];
    if(e && String(e.artist || '').trim()) return String(e.artist).trim();
    var ids = (e && e.trackIds) || [];
    for(var i = 0; i < ids.length; i++){
      var t = allTracks.find(function(tr){ return tr.id === ids[i]; });
      if(t && String(t.artist || '').trim()) return String(t.artist).trim();
    }
    return '';
  }

  // Rename an album AND the artist shown under it. Two fields in one dialog,
  // because an album you built by hand usually needs both corrected together.
  function albumRenamePrompt(name, artist){
    return new Promise(function(resolve){
      var bd = document.createElement('div');
      bd.className = 'modal-backdrop';
      bd.style.zIndex = '250';
      bd.style.display = 'flex';
      var sh = document.createElement('div');
      sh.className = 'modal';
      sh.style.maxWidth = '340px';
      var fieldStyle = 'width:100%;box-sizing:border-box;padding:10px;font-size:14px;border-radius:8px;border:1px solid var(--line);background:var(--bg-raised);color:var(--ink);margin-bottom:10px;';
      var labelStyle = 'display:block;font-size:11px;color:var(--ink-dim);margin-bottom:4px;';
      sh.innerHTML = '<h3>Rename album</h3>' +
        '<label style="' + labelStyle + '">Album name</label>' +
        '<input type="text" id="_albRenameName" value="' + escapeHtml(name || '') + '" style="' + fieldStyle + '" />' +
        '<label style="' + labelStyle + '">Album artist</label>' +
        '<input type="text" id="_albRenameArtist" value="' + escapeHtml(artist || '') + '" placeholder="Artist name" style="' + fieldStyle + '" />' +
        '<div style="font-size:10.5px;color:var(--ink-dim);margin:-4px 0 10px;line-height:1.5;">This is the artist printed under the album. Songs in an album that already shares one artist are renamed with it \\u2014 a mixed-artist album keeps each song\\u2019s own artist.</div>' +
        '<div style="display:flex;gap:8px;">' +
        '<button id="_albRenameOk" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--coral);color:#fff;font-weight:600;font-size:13px;">Save</button>' +
        '<button id="_albRenameCancel" style="flex:1;padding:10px;border-radius:8px;border:none;background:var(--bg-raised);color:var(--ink-dim);font-size:13px;">Cancel</button></div>';
      bd.appendChild(sh);
      document.body.appendChild(bd);
      var nameInp = document.getElementById('_albRenameName');
      var artistInp = document.getElementById('_albRenameArtist');
      try{ nameInp.focus(); nameInp.select(); }catch(_e){}
      function done(val){ bd.remove(); resolve(val); }
      function submit(){ done({ name: nameInp.value, artist: artistInp.value }); }
      document.getElementById('_albRenameOk').addEventListener('click', submit);
      document.getElementById('_albRenameCancel').addEventListener('click', function(){ done(null); });
      [nameInp, artistInp].forEach(function(el){
        el.addEventListener('keydown', function(e){ if(e.key === 'Enter') submit(); if(e.key === 'Escape') done(null); });
      });
      bd.addEventListener('click', function(e){ if(e.target === bd) done(null); });
    });
  }

  function renameUserAlbum(oldName){
    if(!userAlbums[oldName]) return;
    var wasArtist = albumArtistFor(oldName);
    albumRenamePrompt(oldName, wasArtist).then(function(v){
      if(v == null) return;
      var nn = String(v.name || '').trim() || oldName;
      var na = String(v.artist || '').trim();
      if(nn === oldName && na === wasArtist) return;   // nothing was changed
      if(nn !== oldName && userAlbums[nn]){ toast('You already have an album called "' + nn + '".'); return; }
      var entry = userAlbums[oldName];
      // Every song carrying the old album tag travels with the name, not only the
      // ones the saved entry happens to list. An album is derived from its tags, so
      // a song that picked the tag up after the entry was created (imported later,
      // or claimed by a card drag) would otherwise keep the old name and reappear
      // as a ghost one-song album right beside the renamed one.
      var movedIds = (entry.trackIds || []).slice();
      allTracks.forEach(function(tr){
        if(tr && String(tr.album || '').trim() === oldName && movedIds.indexOf(tr.id) === -1) movedIds.push(tr.id);
      });
      // Does the album already share ONE artist, or is it a compilation? If the
      // songs all agree, changing the album's artist is a correction and they come
      // with it; if they don't, each song keeps its own artist.
      var songArtists = [];
      movedIds.forEach(function(id){
        var t = allTracks.find(function(tr){ return tr.id === id; });
        var a = t ? String(t.artist || '').trim() : '';
        if(a && songArtists.indexOf(a) === -1) songArtists.push(a);
      });
      var retagSongs = !!(na && songArtists.length <= 1 && na !== wasArtist);
      var movedEntry = {};
      Object.keys(entry).forEach(function(k){ if(k !== 'trackIds') movedEntry[k] = entry[k]; });
      movedEntry.trackIds = movedIds;
      // The album artist is saved on the album itself; an emptied field falls back
      // to the first song's artist again.
      if(na) movedEntry.artist = na; else delete movedEntry.artist;
      movedEntry.manual = true; delete movedEntry.auto; // renamed/edited by hand
      // Rebuild the map so the renamed album keeps its position in album order.
      var rebuilt = {};
      Object.keys(userAlbums).forEach(function(k){
        if(k === oldName) rebuilt[nn] = movedEntry; else rebuilt[k] = userAlbums[k];
      });
      userAlbums = rebuilt;
      if(nn !== oldName){ try{ localStorage.removeItem('sidecut_albColl_' + oldName); }catch(_e){} }
      // Keep every song's album tag in step, otherwise the album splits apart
      // the next time songs are grouped by their tags.
      movedIds.forEach(function(id){
        var t = allTracks.find(function(tr){ return tr.id === id; });
        if(!t) return;
        var touched = false;
        if(t.album !== nn){ t.album = nn; touched = true; }
        if(retagSongs && t.artist !== na){ t.artist = na; touched = true; }
        if(touched){ try{ persistTrackMeta(t); }catch(_e){} }
      });
      dbPut('meta', { key: 'userAlbums', value: userAlbums });
      renderList();
      refreshManageAlbums();
      var what = [];
      if(nn !== oldName) what.push('renamed to "' + nn + '"');
      if(na !== wasArtist) what.push(na ? ('artist is now ' + na) : 'artist reset');
      toast('Album ' + (what.length ? what.join(' \\u00b7 ') : 'saved') + '.');
    });
  }`;

const OLD_START = `  function renameUserAlbum(oldName){
    if(!userAlbums[oldName]) return;
    modalPrompt('Rename album', oldName).then(function(v){`;
const i = html.indexOf(OLD_START);
if (i === -1) throw new Error('renameUserAlbum not found');
const j = html.indexOf('\n  }\n', html.indexOf("toast('Renamed to \"' + nn + '\".');", i));
if (j === -1) throw new Error('renameUserAlbum end not found');
const old = html.slice(i, j + 4);
if (old.indexOf('movedEntry.manual = true') === -1) throw new Error('unexpected renameUserAlbum body');
console.log('  ✓ renameUserAlbum replaced (two-field dialog + album artist)');
html = html.slice(0, i) + NEW + html.slice(j + 4);

fs.writeFileSync(HTML, html);
console.log('\nalbum artist rename: done\n');
