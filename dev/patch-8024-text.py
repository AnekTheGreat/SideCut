# The text 80.2.4 carries into index.html, kept out of patch-8024.py so the
# payload travels as small constants and the patch itself stays the cutting.
#
# Nothing here is a rewrite: the album card grows one button, the song sheet
# grows one row, and the module both of them call is new - it reads an album's
# running order from the same place Album History reads it and files the songs
# into it.

# 1. THE MODULE. Inserted inside the main IIFE, directly above openSongActions,
#    where userAlbums, allTracks, fetchWithProxy, dbPut, renderList, toast and
#    toastWithUndo are all in scope.
MODULE = r'''  /* --------------------------------------------------------------------------
     80.2.4 - AN ALBUM'S SONGS, IN THE ORDER THE ALBUM PLAYS THEM
     --------------------------------------------------------------------------
     The owner: "add a way in albums and 3 dots to sort an album by if it is an
     actual album then in that actual order get this from album history".

     An album's songs are in the order they were imported, which is almost never
     the order the record plays in. Album History already knows that order - it
     looks the album up and lists its tracks in the store's own sequence - so
     this reads the same list and files the album's songs by it.

     TWO DOORS, ONE FUNCTION: the three dots on the album card in Albums, and the
     same row in the song's three-dot sheet when the song belongs to an album.
     Both call scRealSortAlbum, so the two can never disagree about what the real
     order is, and both open the same album menu otherwise.

     NEVER A GUESS: a song the real tracklist does not name keeps its place at
     the END, in the order it already had. An album nothing is found for is left
     exactly as it is and says so, and every sort carries Undo.
     -------------------------------------------------------------------------- */
  var SCREAL_LS = 'sidecut_albumRealOrder';

  // The words a title has in common with the record, with the decoration that
  // only ever lives on the file folded away: "(Remastered 2011)", "[Deluxe]",
  // "(feat. X)" and a trailing "- Live". One or two word titles are never
  // matched loosely - moving a song to the wrong place is worse than leaving it
  // where it is.
  function scRealNorm(s){
    return String(s == null ? '' : s)
      .toLowerCase()
      .replace(/\((?:feat|ft|with|prod)\.?[^)]*\)/g, ' ')
      .replace(/\[(?:feat|ft|with|prod)\.?[^\]]*\]/g, ' ')
      .replace(/\s+[-\u2013]\s+(?:remaster(?:ed)?|digital remaster|live|radio edit|single version|album version|bonus track|from the film).*$/i, ' ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  // "Song" against "Song (Part Two)" is the same recording with a subtitle; the
  // match has to sit on a word edge, so "One" never catches "Someone".
  function scRealLoose(a, b){
    if(!a || !b || a.length < 5 || b.length < 5) return false;
    return a === b || a.indexOf(b + ' ') === 0 || a.indexOf(' ' + b) !== -1 ||
           b.indexOf(a + ' ') === 0 || b.indexOf(' ' + a) !== -1;
  }

  function scRealCacheAll(){
    try{
      var raw = localStorage.getItem(SCREAL_LS);
      var m = raw ? JSON.parse(raw) : {};
      return (m && typeof m === 'object' && !(m instanceof Array)) ? m : {};
    }catch(_eRealAll){ return {}; }
  }

  function scRealCacheKey(name){ return String(name || '').trim().toLowerCase(); }

  // The album as Album History last read it. It is keyed by the album's own
  // name, and a different artist under the same name is a different record, so
  // the artist is checked too rather than trusted.
  function scRealCacheGet(name, artist){
    var e = scRealCacheAll()[scRealCacheKey(name)];
    if(!e || !Array.isArray(e.tracks) || !e.tracks.length) return null;
    var a1 = scRealNorm(artist), a2 = scRealNorm(e.artist);
    if(a1 && a2 && a1 !== a2) return null;
    return e;
  }

  function scRealCachePut(name, entry){
    try{
      var m = scRealCacheAll();
      m[scRealCacheKey(name)] = entry;
      // Oldest out first once the shelf is full: forty albums is more than
      // anyone sorts by hand, and the whole list is one small JSON blob.
      var keys = Object.keys(m);
      if(keys.length > 40){
        keys.sort(function(a, b){ return (m[a].at || 0) - (m[b].at || 0); });
        keys.slice(0, keys.length - 40).forEach(function(k){ delete m[k]; });
      }
      localStorage.setItem(SCREAL_LS, JSON.stringify(m));
    }catch(_eRealPut){}
  }

  function scRealTrackNames(results){
    var rows = [];
    (results || []).forEach(function(x){
      if(!x || x.wrapperType !== 'track' || !x.trackName) return;
      rows.push({ name: String(x.trackName), disc: Number(x.discNumber) || 1, num: Number(x.trackNumber) || 0 });
    });
    // The running order is the store's own: disc first, then the track number.
    // A two-disc album has been seen interleaved, so the sort is explicit
    // rather than taking the reply's order on trust.
    rows.sort(function(a, b){ return (a.disc - b.disc) || (a.num - b.num); });
    return rows.map(function(r){ return r.name; });
  }

  // THE READ. The same two lookups Album History makes: iTunes searches the
  // album, the collection is then looked up by id in the storefronts the app
  // already walks, and Deezer answers when iTunes will not. A collection only
  // counts when its own name agrees with the album's, so a similar record is
  // never filed in.
  async function scRealFetch(name, artist){
    var want = scRealNorm(name);
    var term = ((artist ? artist + ' ' : '') + name).trim();
    try{
      var sres = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(term) + '&media=music&entity=album&limit=10');
      var sd = (sres && sres.ok) ? await sres.json() : {};
      var cols = (sd.results || []).filter(function(c){ return c && c.collectionId; })
        .map(function(c){
          var cn = scRealNorm(c.collectionName);
          var score = cn === want ? 3 : ((cn.indexOf(want) === 0 || want.indexOf(cn) === 0) ? 2 : (cn.indexOf(want) !== -1 ? 1 : 0));
          return { c: c, score: score };
        })
        .filter(function(x){ return x.score > 0; })
        .sort(function(a, b){ return b.score - a.score; });
      var stores = ['', 'US', 'IN', 'GB'];
      for(var i = 0; i < cols.length && i < 3; i++){
        for(var s = 0; s < stores.length; s++){
          var u = 'https://itunes.apple.com/lookup?id=' + encodeURIComponent(cols[i].c.collectionId) +
                  '&entity=song&limit=200' + (stores[s] ? '&country=' + stores[s] : '');
          var r = await fetchWithProxy(u);
          var d = (r && r.ok) ? await r.json() : {};
          var names = scRealTrackNames(d.results);
          if(names.length){
            return { tracks: names, artist: cols[i].c.artistName || artist || '', source: 'iTunes',
                     collectionId: cols[i].c.collectionId, art: cols[i].c.artworkUrl100 || '', at: Date.now() };
          }
        }
      }
    }catch(_eRealIt){}
    try{
      var dzs = await fetchWithProxy('https://api.deezer.com/search/album?q=' + encodeURIComponent(term) + '&limit=10');
      var dzd = (dzs && dzs.ok) ? await dzs.json() : {};
      var hit = null;
      (dzd.data || []).forEach(function(a){
        if(hit || !a || !a.id) return;
        var an = scRealNorm(a.title);
        if(an && (an === want || an.indexOf(want) === 0 || want.indexOf(an) === 0 || an.indexOf(want) !== -1)) hit = a;
      });
      if(hit){
        var dzr = await fetchWithProxy('https://api.deezer.com/album/' + encodeURIComponent(hit.id) + '/tracks?limit=200');
        var dzt = (dzr && dzr.ok) ? await dzr.json() : {};
        var dnames = (dzt.data || []).map(function(t){ return String((t && t.title) || ''); }).filter(Boolean);
        if(dnames.length){
          return { tracks: dnames, artist: (hit.artist && hit.artist.name) || artist || '', source: 'Deezer',
                   collectionId: 'dz_' + hit.id, art: hit.cover_medium || '', at: Date.now() };
        }
      }
    }catch(_eRealDz){}
    return null;
  }

  function scRealTrackById(id){
    for(var i = 0; i < allTracks.length; i++){ if(allTracks[i] && allTracks[i].id === id) return allTracks[i]; }
    return null;
  }

  // THE FILING. Small and pure enough to drive from a gate: hand it the album
  // and the list of titles and it answers with what it did. Each real track
  // claims one song, in the record's order, and every song nobody claimed stays
  // after them in the order it already had - so a sort never drops a song.
  function scRealApplyOrder(name, titles){
    var alb = userAlbums[name];
    if(!alb || !Array.isArray(alb.trackIds)) return null;
    var songs = alb.trackIds.map(function(id){
      var t = scRealTrackById(id);
      return { id: id, key: t ? scRealNorm(t.name) : '' };
    });
    var taken = {};
    var ordered = [];
    (titles || []).forEach(function(title){
      var want = scRealNorm(title);
      if(!want) return;
      var pick = -1;
      for(var i = 0; i < songs.length; i++){ if(!taken[i] && songs[i].key === want){ pick = i; break; } }
      if(pick === -1){
        for(var j = 0; j < songs.length; j++){
          if(taken[j]) continue;
          if(scRealLoose(songs[j].key, want)){ pick = j; break; }
        }
      }
      if(pick === -1) return;
      taken[pick] = 1;
      ordered.push(songs[pick].id);
    });
    var matched = ordered.length;
    songs.forEach(function(s, i){ if(!taken[i]) ordered.push(s.id); });
    // Nothing named by the record: leave the album alone and let the caller say
    // so, rather than shuffling it into an order nobody asked for.
    if(matched) alb.trackIds = ordered;
    return { matched: matched, ids: ordered };
  }

  // A card can carry an album tag that was never saved as an album. Make it one
  // the way the reorder sheet does, so the three dots are never a dead end on a
  // card the app itself is showing - and never steal a song another album holds.
  function scEnsureAlbumForSort(name){
    var key = String(name || '').trim();
    if(!key) return null;
    var e = userAlbums[key];
    if(e && Array.isArray(e.trackIds) && e.trackIds.length) return e;
    var ids = [];
    allTracks.forEach(function(t){
      if(!t) return;
      if(String(t.album || '').trim().toLowerCase() !== key.toLowerCase()) return;
      ids.push(t.id);
    });
    if(!ids.length) return null;
    Object.keys(userAlbums || {}).forEach(function(k){
      var other = userAlbums[k];
      if(other && Array.isArray(other.trackIds)){
        ids = ids.filter(function(id){ return other.trackIds.indexOf(id) === -1; });
      }
    });
    if(!ids.length) return null;
    userAlbums[key] = { artist: (scAlbumArtist(key) || 'Unknown artist'), trackIds: ids, createdAt: Date.now(), manual: true };
    try{ markAlbumManual(key); }catch(_eMarkReal){}
    return userAlbums[key];
  }

  function scRealPersist(){
    try{ dbPut('meta', { key: 'userAlbums', value: userAlbums }); }catch(_eRealDb){}
    try{ renderList(); }catch(_eRealRender){}
  }

  function scRealFinish(name, before, res, entry){
    scRealPersist();
    var extra = res.ids.length - res.matched;
    var msg = 'Sorted \u201c' + name + '\u201d into its real order' +
              (extra ? ' \u00b7 ' + extra + ' kept at the end' : '') +
              (entry && entry.source ? ' \u00b7 ' + entry.source : '');
    toastWithUndo(msg, function(){
      var live = userAlbums[name];
      if(!live) return;
      live.trackIds = before.slice();
      scRealPersist();
      toast('Put back the way it was.', 2600);
    });
  }

  // SORT ONE ALBUM. A list read before is used straight away - no network, and
  // it works with the phone in flight mode - and is only thrown away when it
  // names none of the songs in the album, which means it was read for
  // something else.
  function scRealSortAlbum(name){
    var key = String(name || '').trim();
    if(!key){ toast('Pick an album first.', 2600); return Promise.resolve(false); }
    var alb = scEnsureAlbumForSort(key);
    if(!alb){ toast('No album called \u201c' + key + '\u201d in your library.', 3400); return Promise.resolve(false); }
    if(alb.trackIds.length < 2){
      toast('\u201c' + key + '\u201d has one song, so there is no order to sort.', 3400);
      return Promise.resolve(false);
    }
    var artist = scAlbumArtist(key) || '';
    var before = alb.trackIds.slice();
    var cached = scRealCacheGet(key, artist);
    if(cached){
      var done = scRealApplyOrder(key, cached.tracks);
      if(done && done.matched){
        scRealFinish(key, before, done, cached);
        return Promise.resolve(true);
      }
    }
    toast('Reading the real order of \u201c' + key + '\u201d\u2026', 9000);
    return scRealFetch(key, artist).then(function(entry){
      if(!entry){
        toast('\u201c' + key + '\u201d is not an album Album History knows, so nothing was reordered.', 4400);
        return false;
      }
      scRealCachePut(key, entry);
      var res = scRealApplyOrder(key, entry.tracks);
      if(!res || !res.matched){
        toast('None of the songs in \u201c' + key + '\u201d are on the album Album History found, so nothing was reordered.', 4600);
        return false;
      }
      scRealFinish(key, before, res, entry);
      return true;
    }).catch(function(){
      toast('Could not read the album order. Nothing was reordered.', 3600);
      return false;
    });
  }

  // THE ALBUM'S OWN MENU - what the three dots on a card opens. Two rows: the
  // sort, and the hand reorder the long press already offered, so the card is
  // not a one-button menu.
  function scRealAlbumMenu(name){
    var key = String(name || '').trim();
    if(!key) return;
    var alb = scEnsureAlbumForSort(key);
    if(alb) scRealPersist();
    var n = alb ? alb.trackIds.length : 0;
    var artist = scAlbumArtist(key) || '';
    var cached = scRealCacheGet(key, artist);
    function row(action, icon, label, sub){
      return '<button class="sc-alm-row" data-alm="' + action + '" style="display:flex;align-items:center;gap:10px;width:100%;text-align:left;padding:12px;margin-bottom:6px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,0.04);color:var(--ink);font-size:13.5px;cursor:pointer;">'
        + '<svg viewBox="0 0 24 24" fill="currentColor" style="width:18px;height:18px;flex-shrink:0;color:var(--coral);">' + icon + '</svg>'
        + '<span style="flex:1;min-width:0;"><span style="display:block;font-weight:600;">' + escapeHtml(label) + '</span>'
        + (sub ? '<span style="display:block;font-size:11px;color:var(--ink-dim);margin-top:2px;">' + escapeHtml(sub) + '</span>' : '')
        + '</span></button>';
    }
    var html = '<div style="padding:12px;">'
      + row('real', '<path d="M3 5h18v2H3zm0 6h12v2H3zm0 6h18v2H3z"/>', 'Sort into the album\u2019s real order',
            cached ? 'The order Album History read last time, kept on this device.' : 'Reads the album from Album History and files the songs in that order.')
      + row('hand', '<path d="M9 6h2v2H9zm4 0h2v2h-2zM9 11h2v2H9zm4 0h2v2h-2zM9 16h2v2H9zm4 0h2v2h-2z"/>', 'Reorder songs by hand',
            'Drag them where you want them, then tap Done.')
      + '</div>'
      + '<div style="padding:0 16px 14px;font-size:11px;color:var(--ink-dim);line-height:1.5;">Songs the album does not list stay at the end, and every sort carries Undo.</div>';
    openDiscoverPopup('Album actions', html,
      key + (n ? ' \u00b7 ' + n + ' track' + (n !== 1 ? 's' : '') : '') + (artist ? ' \u00b7 ' + artist : ''));
    var body = document.getElementById('discPopupBody');
    if(!body) return;
    Array.prototype.forEach.call(body.querySelectorAll('.sc-alm-row'), function(btn){
      btn.addEventListener('click', function(){
        var what = this.getAttribute('data-alm');
        try{ closeDiscoverPopup(); }catch(_eRealClose){}
        if(what === 'real'){ scRealSortAlbum(key); return; }
        if(what === 'hand'){
          if(typeof window.showAlbumReorderPopup === 'function') window.showAlbumReorderPopup(key);
          else toast('Reorder sheet unavailable.', 2600);
        }
      });
    });
  }

'''

# 2. THE CARD'S THREE DOTS. Appended to the album card header's innerHTML,
#    after the track count - the same glyph, class and weight the song rows use.
CARD_KEBAB = r'''          + '<button class="kebab-btn alb-kebab" data-album-kebab="' + escapeHtml(alb.name) + '" aria-label="Album actions" title="Album actions"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 8a2 2 0 100-4 2 2 0 000 4zm0 2a2 2 0 100 4 2 2 0 000-4zm0 8a2 2 0 100 4 2 2 0 000-4z"/></svg></button>'
'''

# 3. AND ITS WIRING, right after the header is added to the card: the tap opens
#    the album menu and must not fold the card, which is what the header does.
CARD_WIRE = r'''        // 80.2.4 - the album's own three dots, and what it opens. The header
        // folds the card on a tap, so this has to stop the tap first.
        var _albKebabBtn = hdr.querySelector('[data-album-kebab]');
        if(_albKebabBtn){
          _albKebabBtn.addEventListener('click', function(ev){
            ev.preventDefault();
            ev.stopPropagation();
            scRealAlbumMenu(aName);
          });
        }
'''

# 4. THE SAME DOOR ON A SONG. Immediately after the album-reorder row the sheet
#    already carried, and outside its Albums-only condition: a song knows its
#    album in every view, so the row is offered wherever the song menu opens.
SHEET_ROW = r'''    // 80.2.4 - the card's three dots, on the song. A song's album is usually in
    // the order it was imported; this files the whole album into the order the
    // record plays in, read from Album History. It sits after the hand reorder
    // row and outside the Albums-only block above, because the song knows its
    // album in every view.
    (function(){
      var _albReal = '';
      try{ _albReal = (typeof window.__scAlbumForTrack === 'function') ? (window.__scAlbumForTrack(id) || '') : ''; }catch(_eAlbReal){}
      if(!_albReal) return;
      var albRealBtn = document.createElement('button');
      albRealBtn.id = 'songActionsAlbumReal';
      albRealBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 5h18v2H3zm0 6h12v2H3zm0 6h18v2H3z"/></svg> Sort album \u201c' + escapeHtml(_albReal) + '\u201d into its real order';
      albRealBtn.addEventListener('click', function(){
        $('songActionsBackdrop').style.display = 'none';
        scRealSortAlbum(_albReal);
      });
      list.appendChild(albRealBtn);
    })();
'''

# 5. THE DOORS A GATE KNOCKS ON, next to the album hooks already exported.
EXPORTS = r'''  // 80.2.4 - the real-order sort, its cache and the card's menu, exported the
  // way the album hooks above are: the harness drives the same functions the
  // three dots call, instead of copying what they do.
  window.__scSortAlbumRealOrder = function(name){ return scRealSortAlbum(name); };
  window.__scOpenAlbumMenu = function(name){ return scRealAlbumMenu(name); };
  window.__scAlbumRealApply = function(name, titles){ return scRealApplyOrder(name, titles); };
  window.__scAlbumRealCache = function(){ return scRealCacheAll(); };
'''

# 6. THE CHANGELOG HEAD. Eight notes, no apostrophes, and the words the gate
#    asks for (widget, player, lyrics, letter) in the one that says what did not
#    move.
CHANGELOG_HEAD = r'''  { version: '80.2.4', date: 'October 24, 2026 \u00b7 9:58 PM EDT', title: 'An album card gets its own three dots, and songs can be sorted into the order the album really plays', items: [
    'The album card in Albums has its own three dots now: sort the album, or reorder its songs by hand, without leaving the list.',
    'Sorting reads the album from Album History - the tracklist the store lists, in the order the store lists it - and files the songs into it.',
    'The same row sits in a song sheet: sort the album this song is on appears whenever the song belongs to an album, in every view and not only in Albums.',
    'The order is kept on the device per album, so the second sort is instant and works with no connection at all; the album is read again only if the list held none of its songs.',
    'A song the album does not list keeps its place at the end instead of being dropped or guessed at, and an album Album History does not know is left exactly as it was.',
    'Every sort carries Undo, which puts the album back the way it was, and an album of one song says there is no order to sort instead of doing nothing.',
    'The three dots on a card never fold it and never open a song menu; the hand reorder they offer is the sheet a long press already opened.',
    'The widget, the player, the lyrics view, the letter covers and the album pill dock are untouched.',
  ],
    details: [
      'One function answers both doors - the card three dots and the song menu - so the two can never disagree about what the real order is. The card menu carries the sort and the hand reorder; the sheet row names the album it would sort.',
      'The read is the pair Album History already makes: iTunes album search, then the collection lookup by id in the storefronts the app walks, then Deezer album search and its own track endpoint. A collection counts only when its name agrees with the album, so a similar record is never filed in.',
      'Titles are compared after the decoration only a file carries is folded away - a remaster year, a deluxe tag, a featuring credit, a trailing live note - and every loose match sits on a word edge, so a one word title never claims another song.',
      'The list is cached per album, artist included, so a different record with the same name is never reused. Forty albums are kept, oldest out first.',
      'Both sorts go through the album order the app already saves, so playing the album, the card list and the queue all read the new order without a second store.',
    ],
  },
'''
