  // ─── 80.6.11 - THE SHELF: icons, the real resolver, the pins ────────────────
  // 80.6.11 - NO GLYPHS. The transport and the add/remove buttons were set in
  // characters (U+FF0B, U+23EE, U+23F8, U+23ED, U+00D7) and a WebView rendered
  // whichever font owned them: an emoji-looking blob next to a proper label, and
  // a pause glyph in a different weight from the play it replaced. These are
  // paths, so they take the row's colour, keep one weight and cannot be re-fonted.
  function scIcon(name, size){
    var p = {
      play: 'M8 5v14l11-7z',
      pause: 'M7 5h4v14H7zm6 0h4v14h-4z',
      prev: 'M7 5h2v14H7zm12 0v14l-9-7z',
      next: 'M15 5h2v14h-2zM5 5l9 7-9 7z',
      plus: 'M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z',
      close: 'M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z',
      search: 'M10 4a6 6 0 1 0 3.47 10.9l4.31 4.31 1.42-1.42-4.31-4.31A6 6 0 0 0 10 4zm0 2a4 4 0 1 1 0 8 4 4 0 0 1 0-8z',
      back: 'M14.7 6.3 13.3 4.9 6.2 12l7.1 7.1 1.4-1.4L9 12z'
    }[name] || '';
    var s = Number(size) || 15;
    return '<svg viewBox="0 0 24 24" width="' + s + '" height="' + s + '" aria-hidden="true" focusable="false" ' +
      'style="display:inline-block;vertical-align:-3px;fill:currentColor;"><path d="' + p + '"/></svg>';
  }

  // 80.6.11 - THE PLAYER CALL IS THE CONVERTER'S, NOT A SECOND GUESS AT IT.
  // The first streaming release asked the player endpoint itself, with its own
  // client list, its own headers and no cipher handling, and it got nothing back:
  // the row said "no playable stream" and the owner was right to call it broken.
  // scYtPlayer() is the call the converter has been downloading through for
  // releases: both clients asked at once with headers that name the client the
  // body declares, a signatureCipher row decrypted, and the audio pool ranked
  // before the progressive one. A stream is that same answer, handed to an
  // <audio> element instead of to the file writer.
  function scStreamResolve(videoId){
    var id = String(videoId || '');
    if(!id) return Promise.resolve('');
    if(typeof scYtPlayer !== 'function') return Promise.resolve('');
    return Promise.resolve()
      .then(function(){ return scYtPlayer(id); })
      .then(function(r){
        if(!r || !r.url) return '';
        // Keep the alternates: a stream that refuses mid-song is retried against
        // the next candidate before the row admits defeat.
        scStreamState.alts = (r.alts || []).slice();
        if(r.videoTitle){ scStreamState.title = String(r.videoTitle); }
        if(r.author){ scStreamState.author = String(r.author); }
        return r.url;
      })
      .catch(function(){ return ''; });
  }

  // The next candidate the player handed over, or '' when they are all spent.
  function scStreamAltUrl(){
    var a = scStreamState.alts || [];
    while(a.length){
      var n = a.shift();
      if(n && n.url) return n.url;
    }
    return '';
  }

  // --- the pins, mixed into Streaming ------------------------------------------------
  // The pinned artists are the app's own array (Discover writes it), so the shelf
  // reads them where they live rather than keeping a copy that could drift.
  function scShelfPins(){
    try{
      if(typeof pinnedArtists !== 'undefined' && Array.isArray(pinnedArtists)) return pinnedArtists;
    }catch(_ePins){}
    return [];
  }
  function scShelfPinSearch(name){
    var n = String(name || '').trim();
    if(!n) return;
    scShelfOpenTab('streaming');
    scStreamSearchRun(n + ' songs');
  }
  // A song is a seed: its artist is the recommendation, because that is the one
  // thing the source tells us about a stream that the app actually knows.
  function scShelfRecommend(){
    var cur = scStreamById(scStreamState.curId);
    var who = (cur && (cur.artist || '')) || scStreamState.author || '';
    who = String(who).replace(/\s*-\s*topic\s*$/i, '').replace(/vevo$/i, '').trim();
    if(!who){ scStreamSay('Play a stream first - the recommendation comes from its artist'); return; }
    scStreamState.q = who + ' mix';
    scStreamSearchRun(who + ' mix');
  }
