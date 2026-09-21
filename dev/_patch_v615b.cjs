// v60.1.5 patch B — an album order that can actually hold a number.
//
// The album card order was read from the key order of userAlbums. JavaScript
// puts any key that looks like a number at the FRONT of an object, in numeric
// order, no matter when it was added — so an album called "2003" could never be
// dragged anywhere, and dragging anything else past it could not be expressed
// either. The order is now its own saved list, with the old key order as the
// fallback for anyone who has never dragged a card.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function sub(oldStr, newStr) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) throw new Error('expected exactly 1 match, found ' + n + ' for: ' + oldStr.slice(0, 90));
  html = html.replace(oldStr, newStr);
}

// ---- 1. the list itself -----------------------------------------------------
sub(
`  let userAlbums = {}; // name -> { artist, trackIds:[], createdAt }`,
`  let userAlbums = {}; // name -> { artist, trackIds:[], createdAt }
  // The order of the album cards, as its own list. userAlbums key order cannot
  // hold it: a name that looks like a number ("2003") is always hoisted to the
  // front by the language itself, so a dragged position for it could never be
  // saved. Empty means "never dragged yet" — the key order is used then.
  let albumOrder = [];`);

// ---- 2. load it with the rest of the library --------------------------------
sub(
`    userAlbums = metaMap.userAlbums || {};
    if(sandboxDefaultView === 'albums' || sandboxDefaultView === 'playlists') libraryMode = sandboxDefaultView;`,
`    userAlbums = metaMap.userAlbums || {};
    albumOrder = Array.isArray(metaMap.albumOrder)
      ? metaMap.albumOrder.filter(function(n){ return typeof n === 'string'; })
      : [];
    if(sandboxDefaultView === 'albums' || sandboxDefaultView === 'playlists') libraryMode = sandboxDefaultView;`);

// ---- 3. the render honours it ----------------------------------------------
sub(
`      _albumOrder.sort(function(a,b){
        // When sort is default (Playlist order), preserve userAlbums key order
        var _uaKeys = Object.keys(userAlbums);
        if(_uaKeys.length && (typeof currentSort === 'undefined' || currentSort === 'default')){
          var ia = _uaKeys.indexOf(a), ib = _uaKeys.indexOf(b);
          if(ia !== -1 && ib !== -1) return ia - ib;
          if(ia !== -1) return -1;
          if(ib !== -1) return 1;
        }`,
`      _albumOrder.sort(function(a,b){
        // With sort on "default" this is YOUR order \u2014 the list a card drag writes.
        // It used to read the key order of userAlbums, which the language cannot
        // keep once a name looks like a number: an album called "2003" is hoisted
        // to the front of every Object.keys, so that card could never be moved and
        // any drag past it looked like it snapped back. An explicit list has no
        // such rule; a name that is in neither list falls back below.
        var _uaKeys = Object.keys(userAlbums);
        if(_uaKeys.length && (typeof currentSort === 'undefined' || currentSort === 'default')){
          var _ord = (typeof albumOrder !== 'undefined' && Array.isArray(albumOrder)) ? albumOrder : [];
          var ia = _ord.indexOf(a), ib = _ord.indexOf(b);
          if(ia === -1) ia = _ord.length + _uaKeys.indexOf(a);
          if(ib === -1) ib = _ord.length + _uaKeys.indexOf(b);
          if(ia !== ib) return ia - ib;
        }`);

// ---- 4. the drag writes it -------------------------------------------------
sub(
`                  if(typeof dbPut === 'function'){
                    dbPut('meta', { key: 'userAlbums', value: userAlbums });
                  } else {
                    saveMeta();
                  }
                  // Album cards are ordered by whatever "Sort songs" is set to,`,
`                  if(typeof dbPut === 'function'){
                    dbPut('meta', { key: 'userAlbums', value: userAlbums });
                  } else {
                    saveMeta();
                  }
                  // Write the order down as a real list as well. The key order of
                  // userAlbums above is kept for older builds, but it cannot hold
                  // a name like "2003" in place, so the list is what the cards are
                  // actually drawn from.
                  try{
                    var _ordKeys = keys.slice();
                    Object.keys(userAlbums).forEach(function(k){ if(_ordKeys.indexOf(k) === -1) _ordKeys.push(k); });
                    albumOrder = _ordKeys;
                    if(typeof dbPut === 'function') dbPut('meta', { key: 'albumOrder', value: albumOrder });
                  }catch(_eAlbOrd){}
                  // Album cards are ordered by whatever "Sort songs" is set to,`);

// ---- 5. rename and delete keep the list in step ----------------------------
sub(
`      userAlbums = rebuilt;
      if(nn !== oldName){ try{ localStorage.removeItem('sidecut_albColl_' + oldName); }catch(_e){} }`,
`      userAlbums = rebuilt;
      if(nn !== oldName){
        // The order list holds the old name in the same position, so a renamed
        // album does not jump to the end of the grid.
        try{
          var _oi = albumOrder.indexOf(oldName);
          if(_oi !== -1) albumOrder[_oi] = nn;
          if(typeof dbPut === 'function') dbPut('meta', { key: 'albumOrder', value: albumOrder });
        }catch(_e){}
        try{ localStorage.removeItem('sidecut_albColl_' + oldName); }catch(_e){}
      }`);

sub(
`  function deleteUserAlbum(name){
    if(!userAlbums[name]) return;
    delete userAlbums[name];
    dbPut('meta', { key: 'userAlbums', value: userAlbums });`,
`  function deleteUserAlbum(name){
    if(!userAlbums[name]) return;
    delete userAlbums[name];
    try{
      var _di = albumOrder.indexOf(name);
      if(_di !== -1) albumOrder.splice(_di, 1);
      dbPut('meta', { key: 'albumOrder', value: albumOrder });
    }catch(_e){}
    dbPut('meta', { key: 'userAlbums', value: userAlbums });`);

// ---- 6. changelog: this release fixes the drag ------------------------------
sub(
`  { version: '60.1.5', date: 'September 21, 2026 · 1:45 AM EDT', title: 'Update checks stop reading a cached answer', items: [`,
`  { version: '60.1.5', date: 'September 21, 2026 · 1:45 AM EDT', title: 'Album cards stay where you drop them, and update checks stop reading a cached answer', items: [`);

sub(
`    'The download link is stamped the same way, so an update can never be fetched from that cache and installed under the wrong version number',
  ]},`,
`    'The download link is stamped the same way, so an update can never be fetched from that cache and installed under the wrong version number',
    'Album cards stay where you drop them. The drag measured the one card under your finger and assumed every other card was exactly that tall, so with an expanded album card anywhere in the list it usually worked out that you had not moved at all \\u2014 and releasing wrote the old order straight back, which is the card snapping home the moment you lift your finger. Every card is measured now, so the drop lands on the slot you actually dragged it to',
    'The list can no longer steal the drag. A card being dragged never claimed the gesture, so Android was free to take a vertical drag for scrolling, cancel it and leave the move unsaved. Scrolling is held off for the length of the drag, and a cancel now saves what you see instead of putting the card back',
    'Your album order is a list of its own now. It used to be the key order of the album map, and JavaScript always pushes a name that looks like a number to the front of one \\u2014 so an album called \\"2003\\" could not be dragged anywhere, and a drop past it could not be saved either',
  ]},`);

fs.writeFileSync(file, html);
console.log('v615b: album order list + changelog applied');
