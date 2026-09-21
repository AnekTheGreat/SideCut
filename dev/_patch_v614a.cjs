// v60.1.4 patch A
//  1. Album card drag "flicks back": the card order is governed by the "Sort
//     songs" key, so under A-Z / By artist the freshly dragged order was
//     re-sorted the instant the list redrew. A drag now becomes the album
//     order.
//  2. "Get song" resolves the track itself (same on-device pipeline as Save)
//     instead of sending the user to Spotify to copy a link by hand.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function sub(oldStr, newStr) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) throw new Error('expected exactly 1 match, found ' + n + ' for: ' + oldStr.slice(0, 90));
  html = html.replace(oldStr, newStr);
}

// ---- 1. card drag commit: live DOM + manual order wins -----------------------
sub(
`                setTimeout(function(){
                  var keys = siblings.map(function(s){ return s.dataset.albumName; });
                  var moved = keys.splice(startIndex, 1)[0];
                  keys.splice(currentIndex, 0, moved);`,
`                setTimeout(function(){
                  // Read the order that is actually on screen. The snapshot taken
                  // when the hold armed goes stale if anything re-rendered the
                  // list mid-drag, and committing from it wrote the old order
                  // straight back \u2014 the card snapped home as if the drag never
                  // happened. The dragged card's own name is the anchor.
                  var liveNames = [];
                  try{
                    Array.prototype.forEach.call(pane.querySelectorAll('[data-album-name]'), function(c){
                      if(c && c.dataset && c.dataset.albumName) liveNames.push(c.dataset.albumName);
                    });
                  }catch(_eLive){}
                  var dragged = (card && card.dataset) ? card.dataset.albumName : '';
                  var keys = (dragged && liveNames.indexOf(dragged) !== -1)
                    ? liveNames.slice()
                    : siblings.map(function(s){ return s.dataset.albumName; });
                  var from = keys.indexOf(dragged);
                  if(from === -1) from = Math.min(startIndex, Math.max(0, keys.length - 1));
                  var to = Math.max(0, Math.min(keys.length - 1, currentIndex));
                  var moved = keys.splice(from, 1)[0];
                  keys.splice(to, 0, moved);`);

sub(
`                  if(typeof dbPut === 'function'){
                    dbPut('meta', { key: 'userAlbums', value: userAlbums });
                  } else {
                    saveMeta();
                  }
                  renderList();
                }, 150);`,
`                  if(typeof dbPut === 'function'){
                    dbPut('meta', { key: 'userAlbums', value: userAlbums });
                  } else {
                    saveMeta();
                  }
                  // Album cards are ordered by whatever "Sort songs" is set to,
                  // so under A\u2013Z or By artist the order just dragged was re-sorted
                  // the moment the list redrew \u2014 it looked like the drag never
                  // took. In Albums the drag IS the answer: take it as the album
                  // order so the card stays where it was put.
                  var _wasSorted = (typeof currentSort !== 'undefined' && currentSort && currentSort !== 'default');
                  if(_wasSorted){ try{ currentSort = 'default'; }catch(_eSort){} }
                  renderList();
                  if(_wasSorted){
                    try{ toast('Album order saved \\u2014 Albums now shows your own order.', 2600); }catch(_eOrdToast){}
                  }
                }, 150);`);

// ---- 2. Albums-mode sort sheet wording --------------------------------------
sub(
`  function openSortSheet(){
    if(document.getElementById('sortSheet')) return;
    const key = currentSortKey();`,
`  function openSortSheet(){
    if(document.getElementById('sortSheet')) return;
    const key = currentSortKey();
    // In Albums the same sheet orders the album cards, so the wording has to
    // say albums \u2014 "Playlist order" made no sense next to a grid of albums, and
    // there was nothing on screen saying a drag is what that option means.
    const _albumMode = (typeof libraryMode !== 'undefined' && libraryMode === 'albums');
    const _sortTitle = _albumMode ? 'Sort albums' : 'Sort songs';
    const _sortLabels = _albumMode
      ? { 'default': ['Your own order', 'Where you drag the cards'] }
      : {};`);

sub(
`    head.textContent = 'Sort songs';`,
`    head.textContent = _sortTitle;`);

sub(
`      b.innerHTML = '<span style="flex:1;min-width:0;"><span style="font-weight:600;display:block;">' + opt[1] + '</span>'
        + '<span style="font-size:11px;color:var(--ink-dim);display:block;margin-top:2px;">' + opt[2] + '</span></span>'`,
`      const _lab = _sortLabels[opt[0]] || [opt[1], opt[2]];
      b.innerHTML = '<span style="flex:1;min-width:0;"><span style="font-weight:600;display:block;">' + _lab[0] + '</span>'
        + '<span style="font-size:11px;color:var(--ink-dim);display:block;margin-top:2px;">' + _lab[1] + '</span></span>'`);

// ---- 3. Get song fetches the song -------------------------------------------
sub(
`    const dlBtn = document.createElement('button');
    dlBtn.className = 'discover-dl-btn';
    dlBtn.textContent = 'Get song';
    dlBtn.title = 'Copy song name to clipboard';
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerDiscoverDownload(card, r);
    });
    actions.appendChild(dlBtn);

    // "Save song" \u2014 converts the track on-device and imports it straight
    // into the library (same pipeline as the Spotify converter).
    const saveBtn = document.createElement('button');
    saveBtn.className = 'discover-dl-btn';
    saveBtn.textContent = 'Save';
    saveBtn.title = 'Convert this song on-device and add it to your library';
    saveBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      window.__scSaveDiscoverTrack(r, saveBtn);
    });
    actions.appendChild(saveBtn);`,
`    // One button, and it gets the song. SideCut resolves the recording and
    // converts it on-device straight into the library \u2014 no Spotify trip, no
    // "Share \u2192 Copy link", no paste. The old "Save" button did exactly this,
    // so it is folded in here rather than sitting next to it as a second copy
    // of the same action. If the resolver comes up empty the Spotify handoff
    // still runs, so the copy-the-link route is never lost.
    const dlBtn = document.createElement('button');
    dlBtn.className = 'discover-dl-btn';
    dlBtn.textContent = 'Get song';
    dlBtn.title = 'Find this song and add it to your library';
    dlBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      triggerDiscoverDownload(card, r, dlBtn);
    });
    actions.appendChild(dlBtn);`);

sub(
`  function triggerDiscoverDownload(card, r){
    // "Get song" hands the track to Spotify so the user can copy the link.
    const q = (r.trackName || '') + ' ' + (r.artistName || '');
    scOpenSpotifySearch(q);
    toast('Spotify opened \\u2014 tap the song, then Share \\u2192 Copy link.', 5000);
  }`,
`  // "Get song" gets the song.
  //
  // It used to hand the track to Spotify and leave the user to find it there,
  // open the 3-dot menu, copy the link and paste it back into a converter. That
  // works, but it is three apps of work for one tap. The on-device resolver (the
  // same one the YouTube converter uses) finds the recording and converts it
  // straight into the library, so there is no link to copy at all.
  //
  // Spotify's own track link cannot be read for you without a Spotify developer
  // key \u2014 their search API needs a token, and the anonymous page/token routes
  // are blocked \u2014 so the handoff stays as the fallback when the resolver comes
  // up empty rather than being removed.
  async function triggerDiscoverDownload(card, r, btn){
    const q = (r.trackName || '') + ' ' + (r.artistName || '');
    if(typeof window.__scSaveDiscoverTrack === 'function'){
      let got = false;
      try{ got = await window.__scSaveDiscoverTrack(r, btn || null); }catch(_eGet){ got = false; }
      if(got) return;
    }
    scOpenSpotifySearch(q);
    toast('Couldn\\u2019t find that one on-device \\u2014 Spotify opened, tap the song and Share \\u2192 Copy link.', 5000);
  }`);

// __scSaveDiscoverTrack: report success so the caller can fall back.
sub(
`  window.__scSaveDiscoverTrack = async function(r, btn){
    var oldLabel = btn ? btn.textContent : 'Save';
    if(btn){ btn.disabled = true; btn.textContent = 'Saving\u2026'; }`,
`  window.__scSaveDiscoverTrack = async function(r, btn){
    var oldLabel = btn ? btn.textContent : 'Save';
    if(btn){ btn.disabled = true; btn.textContent = 'Getting\u2026'; }`);

sub(
`      var out = await scConvertOneTrack(meta, fmt, function(){});
      if(!out || !out.ok){
        toast('Couldn\\'t find audio for that one \u2014 try "Get song" instead.', 4000);
        return;
      }`,
`      var out = await scConvertOneTrack(meta, fmt, function(){});
      if(!out || !out.ok) return false;   // caller falls back to the Spotify handoff`);

sub(
`      if(typeof window.__handleFileImport === 'function'){
        window.__handleFileImport([file], { __artistPrompted: true });
      } else {
        var savedOk = false;
        try{ savedOk = await scNativeSaveBlob(out.blob, out.fName); }catch(_se){}
        if(!savedOk) scDownloadBlob(out.blob, out.fName);
        toast('Saved "' + (r.trackName || 'song') + '" \u2014 import it via + Add songs.', 4000);
      }
    }catch(e){
      toast('Save failed \u2014 ' + ((e && e.message) || 'try again.'), 3500);
    }finally{`,
`      if(typeof window.__handleFileImport === 'function'){
        window.__handleFileImport([file], { __artistPrompted: true });
      } else {
        var savedOk = false;
        try{ savedOk = await scNativeSaveBlob(out.blob, out.fName); }catch(_se){}
        if(!savedOk) scDownloadBlob(out.blob, out.fName);
        toast('Saved "' + (r.trackName || 'song') + '" \u2014 import it via + Add songs.', 4000);
      }
      return true;
    }catch(e){
      toast('Get song failed \u2014 ' + ((e && e.message) || 'try again.'), 3500);
      return false;
    }finally{`);

fs.writeFileSync(file, html);
console.log('v614a: card drag order + Get song auto-fetch applied');
