  // ─── 80.6.9 - STREAMING, EXPERIMENTAL (full builds only) ────────────────────
  // A song that is played from a signed source instead of a local file. It has its own
  // Audio element, its own store and its own playlists, and it never touches queue,
  // allTracks or activeAudio(): a stream that dies must not be able to take the real
  // player with it. Read the release entry for why that separation is the whole design.
  var SC_STREAM_OK = !SC_IS_PLAY;               // full APK and full web, nothing else
  var scStreamState = {
    tracks: null, playlists: null, results: null, curId: '', url: '', urlAt: 0,
    busy: false, ready: false, q: '', built: false, audio: null, playing: false
  };

  // --- the pure part, which is what dev/check-8069.cjs drives -----------------
  function scStreamGate(isPlayBuild){ return !isPlayBuild; }

  // A signed URL is only good for so long. Thirty minutes is well inside the life
  // googlevideo gives a URL and far outside the length of a song, so a stream is
  // re-resolved once per listen at the start rather than stuttering mid-song.
  function scStreamStale(at, now){
    var age = (Number(now) || Date.now()) - (Number(at) || 0);
    return !(age >= 0 && age < 30 * 60 * 1000);
  }

  // The best audio row of a player response: 251 (opus) over 141 over 140 over anything
  // else that is audio. Only rows that already carry a plain `url` are used - a
  // signatureCipher row would need the cipher solved, and this path does not attempt it.
  function scStreamPickUrl(data){
    try{
      var sd = data && data.streamingData;
      if(!sd) return '';
      var rows = (sd.adaptiveFormats || []).concat(sd.formats || []);
      var best = '', bestRank = 99, bestSize = 0;
      for(var i = 0; i < rows.length; i++){
        var f = rows[i];
        if(!f || !f.url) continue;
        if(!/^audio\//i.test(String(f.mimeType || ''))) continue;
        var it = Number(f.itag) || 0;
        var rank = it === 251 ? 0 : it === 141 ? 1 : it === 140 ? 2 : 3;
        var size = Number(f.contentLength || f.clen) || 0;
        if(rank < bestRank || (rank === bestRank && size > bestSize)){ bestRank = rank; best = f.url; bestSize = size; }
      }
      return best || '';
    }catch(_e){ return ''; }
  }

  // Playlists are lists of stream ids in their own key. Adding the same song twice is a
  // no-op rather than a duplicate, which is what a "＋" tapped twice looks like.
  function scStreamPlAdd(list, name, id){
    var out = [], i, found = false;
    name = String(name == null ? '' : name).trim();
    if(!name || !id) return (list || []).slice();
    for(i = 0; i < (list || []).length; i++){
      var p = list[i] || {};
      var ids = (p.ids || []).slice();
      if(String(p.name) === name){
        found = true;
        if(ids.indexOf(id) === -1) ids.push(id);
      }
      out.push({ name: String(p.name), ids: ids });
    }
    if(!found) out.push({ name: name, ids: [id] });
    return out;
  }
  function scStreamPlRemove(list, name, id){
    var out = [], i;
    for(i = 0; i < (list || []).length; i++){
      var p = list[i] || {};
      if(String(p.name) !== String(name)){ out.push({ name: String(p.name), ids: (p.ids || []).slice() }); continue; }
      var ids = (p.ids || []).filter(function(x){ return x !== id; });
      if(ids.length) out.push({ name: String(p.name), ids: ids });
    }
    return out;
  }

  // --- storage ---------------------------------------------------------------
  function scStreamLoad(){
    scStreamState.tracks = [];
    scStreamState.playlists = [];
    try{
      Promise.resolve(dbGet('meta', 'streamTracks')).then(function(r){
        if(r && Array.isArray(r.value)) scStreamState.tracks = r.value;
        scStreamRender();
      }).catch(function(){});
      Promise.resolve(dbGet('meta', 'streamPlaylists')).then(function(r){
        if(r && Array.isArray(r.value)) scStreamState.playlists = r.value;
        scStreamRender();
      }).catch(function(){});
    }catch(_e){}
  }
  function scStreamSave(){
    try{ dbPut('meta', { key: 'streamTracks', value: scStreamState.tracks || [] }); }catch(_e){}
    try{ dbPut('meta', { key: 'streamPlaylists', value: scStreamState.playlists || [] }); }catch(_e){}
  }
  function scStreamById(id){
    var t = scStreamState.tracks || [];
    for(var i = 0; i < t.length; i++){ if(t[i] && String(t[i].id) === String(id)) return t[i]; }
    return null;
  }

  // --- resolution ------------------------------------------------------------
  // The same player endpoint the converter uses, asked for one videoId. The clients are
  // tried in order because which one answers without a signature cipher changes week to
  // week; the first answer that yields a plain audio url wins.
  function scStreamResolve(videoId){
    var clients = [
      { name: 'ANDROID', ver: '20.16.39', body: { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 } } },
      { name: 'IOS', ver: '20.10.36', body: { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' } } },
      { name: 'WEB', ver: '2.20240801.00.00', body: { client: { clientName: 'WEB', clientVersion: '2.20240801.00.00' } } }
    ];
    var i = 0;
    function step(){
      if(i >= clients.length) return Promise.resolve('');
      var cl = clients[i++];
      var payload = { context: cl.body.context, videoId: videoId, contentCheckOk: true, racyCheckOk: true };
      return Promise.resolve(scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', payload))
        .then(function(d){
          var u = scStreamPickUrl(d);
          if(u) return u;
          return step();
        })
        .catch(function(){ return step(); });
    }
    return step();
  }

