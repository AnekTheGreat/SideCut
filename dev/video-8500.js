  // ─── 85.0.0 - THE MUSIC VIDEO TAB (full builds only) ───────────────────────
  // THE ASK: a tab in the side panel that plays the song's music video, for a
  // downloaded song and a streamed one alike, in portrait and in landscape.
  //
  // WHERE THE TAB IS. The side panel is #scShelfRail - the fixed glyph column on
  // the right of the library (Songs, Playlists, Albums, then the source switch).
  // The video glyph is appended to that rail by scShelfRender, under a hairline,
  // and only when this is not the Play build: the store build has no source and
  // no video path, so the glyph is not drawn there at all rather than opening a
  // door onto nothing.
  //
  // WHICH SONG. Whatever is playing: the stream if the bar holds a stream, else
  // the deck's queue position. A catalogue song already carries its videoId. A
  // downloaded file usually carries none, so the video is found by searching the
  // video host for "artist title" through scYtSearch - the same ranking the
  // converter already uses - and NEXT walks the next few results, because a
  // search for a common title can land on the wrong upload.
  //
  // HOW IT PLAYS, AND WHY IT IS MUTED. The song is already coming out of the
  // deck or the stream element, through this app's own graph. The video is extra
  // picture, so it plays muted on the song's clock: the sound you hear is the
  // song, not a second copy of it, and the two can never double up. The picture
  // is re-seated every 0.9 s if it drifts more than a second and a half, and it
  // follows play and pause.
  //
  // TWO WAYS TO THE PICTURE. The player hands over a progressive muxed MP4
  // (itag 18, measured at 11.8 MB for a 3.5 minute video) with a plain URL, so
  // the element is pointed at it first and it streams and seeks by itself. If
  // the media stack refuses that URL - the same refusal the audio path has hit -
  // the video is read with scFetchBytes, the reader the downloader and the
  // stream already use: googlevideo serves it in 1 MiB ranges (measured: 206,
  // 11829048 bytes) and the blob is handed to the element.
  //
  // BOTH ORIENTATIONS. The viewer is a fixed full-screen layer: a header, the
  // picture in a grid cell that cannot overflow, and a footer line. The video is
  // object-fit-contained, so a portrait phone letterboxes a 16:9 video and a
  // landscape phone fills the height; nothing is measured in pixels, so a
  // rotation reflows it with no listener at all. FULL asks the element for real
  // fullscreen and, where the phone allows it, landscape.
  //
  // WHAT IT IS NOT. It does not download the video, it does not keep it, and it
  // does not try to sync past a music video whose intro is longer than the
  // song's - the picture follows the song's second, so an upload with a spoken
  // intro will sit out of step. That is a limit of matching a film to a track,
  // not a bug to be papered over.

  var scVideoState = {
    open: false, busy: false, tick: null, cands: [], ci: 0,
    title: '', artist: '', videoId: '', pick: null, alts: [],
    blobUrl: '', via: '', audio: null
  };

  function scVideoCss(){
    if(document.getElementById('scVideoCss')) return;
    var st = document.createElement('style');
    st.id = 'scVideoCss';
    st.textContent = [
      '#scVideoBackdrop{position:fixed;inset:0;z-index:240;background:#000;display:none;flex-direction:column;',
      'padding:calc(env(safe-area-inset-top) + 8px) 10px calc(env(safe-area-inset-bottom) + 10px);box-sizing:border-box}',
      '#scVideoBackdrop.on{display:flex}',
      '#scVideoHead{display:flex;align-items:center;gap:6px;padding:0 2px 8px;color:var(--ink);min-height:34px}',
      '#scVideoHead .sv-title{flex:1;min-width:0;font-size:12.5px;font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#scVideoHead .sv-sub{display:block;font-size:10.5px;color:var(--ink-dim);font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#scVideoHead button{background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:8px;',
      'padding:6px 9px;font-size:10px;font-family:"JetBrains Mono",monospace;letter-spacing:.5px;cursor:pointer;flex:0 0 auto}',
      '#scVideoHead button:active{transform:scale(.96)}',
      '#scVideoStage{flex:1 1 auto;min-height:0;display:grid;place-items:center;background:#000;border-radius:12px;overflow:hidden}',
      '#scVideoEl{max-width:100%;max-height:100%;width:auto;height:auto;background:#000;display:none}',
      '#scVideoEl.on{display:block}',
      '#scVideoSay{color:#c3d3d0;font-size:12px;line-height:1.6;text-align:center;padding:20px;max-width:420px}',
      '#scVideoFoot{display:flex;align-items:center;gap:8px;padding:8px 2px 0;color:var(--ink-dim);font-size:10.5px;min-height:26px}',
      '#scVideoFoot .sv-note{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '@media (orientation:landscape){#scVideoBackdrop{padding:6px 10px} #scVideoHead{padding-bottom:4px}',
      '#scVideoHead .sv-sub{display:none} #scVideoFoot{padding-top:4px}}',
      'body.sc-video-open{overflow:hidden}'
    ].join('');
    document.head.appendChild(st);
  }

  function scVideoBuild(){
    if(document.getElementById('scVideoBackdrop')) return;
    scVideoCss();
    var d = document.createElement('div');
    d.id = 'scVideoBackdrop';
    d.innerHTML =
      '<div id="scVideoHead">' +
        '<div class="sv-title"><span id="scVideoTitle">Music video</span>' +
        '<span class="sv-sub" id="scVideoSub"></span></div>' +
        '<button type="button" id="scVideoOther" title="Try the next search result" style="display:none;">NEXT</button>' +
        '<button type="button" id="scVideoFull" title="Fullscreen">FULL</button>' +
        '<button type="button" id="scVideoClose" title="Close">CLOSE</button>' +
      '</div>' +
      '<div id="scVideoStage">' +
        '<video id="scVideoEl" playsinline webkit-playsinline muted preload="auto"></video>' +
        '<div id="scVideoSay">Music video</div>' +
      '</div>' +
      '<div id="scVideoFoot"><span class="sv-note" id="scVideoNote"></span></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){ if(e.target === d) scVideoClose(); });
    var c = document.getElementById('scVideoClose');
    if(c) c.addEventListener('click', scVideoClose);
    var n = document.getElementById('scVideoOther');
    if(n) n.addEventListener('click', scVideoNext);
    var f = document.getElementById('scVideoFull');
    if(f) f.addEventListener('click', scVideoFullscreen);
  }

  function scVideoSay(txt, showVideo){
    var s = document.getElementById('scVideoSay'), v = document.getElementById('scVideoEl');
    if(s){ s.textContent = txt || ''; s.style.display = showVideo ? 'none' : ''; }
    if(v){ if(showVideo) v.classList.add('on'); else v.classList.remove('on'); }
  }
  function scVideoNote(txt){ var n = document.getElementById('scVideoNote'); if(n) n.textContent = txt || ''; }
  function scVideoTitle(title, sub){
    var a = document.getElementById('scVideoTitle'), b = document.getElementById('scVideoSub');
    if(a) a.textContent = title || 'Music video';
    if(b) b.textContent = sub || '';
  }

  // The song on the screen: the stream while the stream owns the bar, the deck's
  // queue position otherwise. Reads only - nothing here starts or stops a song.
  function scVideoTrack(){
    try{
      if(typeof scStreamState === 'object' && scStreamState && scStreamState.barOn && scStreamState.curId){
        var st = scStreamById(scStreamState.curId);
        if(st) return { videoId: String(st.videoId || ''), title: String(st.title || ''), artist: String(st.artist || '') };
      }
    }catch(_eVs){}
    try{
      if(typeof queue !== 'undefined' && typeof allTracks !== 'undefined' && queueIndex >= 0 && queueIndex < queue.length){
        var id = queue[queueIndex];
        for(var i = 0; i < allTracks.length; i++){
          if(allTracks[i] && String(allTracks[i].id) === String(id)){
            return { videoId: String(allTracks[i].videoId || ''), title: String(allTracks[i].title || ''), artist: String(allTracks[i].artist || '') };
          }
        }
      }
    }catch(_eVd){}
    return null;
  }
  function scVideoAudioEl(){
    try{ if(typeof scStreamState === 'object' && scStreamState && scStreamState.barOn && scStreamState.curId) return scStreamAudio(); }catch(_eVa){}
    try{ return activeAudio(); }catch(_eVo){ return null; }
  }

  // The player call, with the two clients that still answer (the same pair
  // scYtPlayer measured: ANDROID 3 and IOS 5). Only rows that already carry a
  // plain url are taken - a cipher would need solving, and this path is picture.
  function scVideoPlayer(videoId){
    var UA_ANDROID = 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip';
    var UA_IOS = 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)';
    var clients = [
      { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 }, num: 3, ua: UA_ANDROID },
      { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' }, num: 5, ua: UA_IOS }
    ];
    var muxed = [], adaptive = [], seen = {};
    function take(list, into, wantMuxed){
      (list || []).forEach(function(f){
        if(!f || !f.mimeType) return;
        var mt = String(f.mimeType);
        if(mt.toLowerCase().indexOf('video/') !== 0) return;
        if(mt.toLowerCase().indexOf('mp4') === -1) return;         // the element plays mp4 everywhere
        if(wantMuxed && !/mp4a|opus|vorbis/i.test(mt)) return;      // a muxed row must carry sound
        var u = f.url || '';
        if(!u || seen[u]) return;
        var size = Number(f.contentLength || f.clen) || 0;
        if(size > 38 * 1024 * 1024) return;                        // this reader stops at 40 MiB
        seen[u] = true;
        into.push({ url: u, mime: mt, itag: Number(f.itag) || 0, size: size,
                    height: Number(f.height) || 0, muxed: !!wantMuxed });
      });
    }
    function rankMuxed(it){ it = Number(it) || 0; return it === 18 ? 0 : it === 59 ? 1 : it === 22 ? 2 : 3; }
    function rankPlain(it){ it = Number(it) || 0; return it === 134 ? 0 : it === 135 ? 1 : it === 133 ? 2 : it === 136 ? 3 : 4; }
    var asks = clients.map(function(cl){
      try{
        return scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
          { context: { client: cl.client }, videoId: videoId, contentCheckOk: true, racyCheckOk: true },
          { name: cl.num, version: cl.client.clientVersion, ua: cl.ua }).catch(function(){ return null; });
      }catch(_eAsk){ return Promise.resolve(null); }
    });
    return Promise.all(asks).then(function(answers){
      var title = '';
      (answers || []).forEach(function(d){
        if(!d || !d.streamingData) return;
        if(!title && d.videoDetails && d.videoDetails.title) title = String(d.videoDetails.title);
        take(d.streamingData.formats, muxed, true);
        take(d.streamingData.adaptiveFormats, adaptive, false);
      });
      muxed.sort(function(a, b){ return rankMuxed(a.itag) - rankMuxed(b.itag); });
      adaptive.sort(function(a, b){ return rankPlain(a.itag) - rankPlain(b.itag); });
      var pool = muxed.concat(adaptive);
      if(!pool.length) return null;
      return { url: pool[0].url, mime: pool[0].mime, size: pool[0].size, itag: pool[0].itag,
               muxed: !!pool[0].muxed, alts: pool.slice(1), title: title };
    }).catch(function(){ return null; });
  }

  // A downloaded file has no video id: ask the host for one, using the ranking
  // the converter already trusts, and keep the top few for NEXT.
  function scVideoSearch(t){
    var q = (String((t && t.artist) || '') + ' ' + String((t && t.title) || '')).trim();
    if(!q) return Promise.resolve([]);
    try{
      return Promise.resolve(scYtSearch(q, (t && t.artist) || '', ''))
        .then(function(cands){
          if(!cands || !cands.length) return [];
          return cands.slice(0, 6).map(function(c){
            return { videoId: String(c.videoId || ''), title: String(c.title || ''), owner: String(c.owner || '') };
          }).filter(function(c){ return !!c.videoId && c.videoId.indexOf('ia:') !== 0; });
        })
        .catch(function(){ return []; });
    }catch(_eSearch){ return Promise.resolve([]); }
  }

  function scVideoSync(force){
    var v = document.getElementById('scVideoEl');
    var a = scVideoState.audio;
    if(!v || !a || !v.src) return;
    try{
      if(v.readyState < 1) return;
      var at = Number(a.currentTime) || 0;
      var vt = Number(v.currentTime) || 0;
      if(force || Math.abs(vt - at) > 1.5){ try{ v.currentTime = at; }catch(_eSeek){} }
      if(a.paused){ if(!v.paused) v.pause(); }
      else if(v.paused){ try{ v.play().catch(function(){}); }catch(_ePlay){} }
    }catch(_eSync){}
  }
  function scVideoTickStart(){
    scVideoTickStop();
    scVideoState.tick = setInterval(function(){ if(scVideoState.open) scVideoSync(false); }, 900);
  }
  function scVideoTickStop(){
    if(scVideoState.tick){ clearInterval(scVideoState.tick); scVideoState.tick = null; }
  }

  // Point the element at a URL. When the media stack refuses it, the same
  // picture is read into a blob through the range reader.
  function scVideoAttach(src, via){
    var v = document.getElementById('scVideoEl');
    if(!v || !src) return;
    scVideoState.via = via;
    scVideoState.audio = scVideoAudioEl();
    v.onerror = null;
    v.onloadeddata = function(){
      scVideoSay('', true);
      scVideoSync(true);
      scVideoTickStart();
    };
    v.onerror = function(){
      if(via === 'direct'){ scVideoRead(); return; }
      scVideoSay('This video could not be played here.');
    };
    try{ v.removeAttribute('src'); }catch(_eRm){}
    v.src = src;
    v.muted = true;
    scVideoSay('Starting the video…', false);
    try{ var p = v.play(); if(p && p.catch) p.catch(function(){}); }catch(_eStart){}
  }

  function scVideoRead(){
    var c = scVideoState.pick;
    if(!c || !c.url){ scVideoSay('This video could not be played here.'); return; }
    scVideoSay('Reading the video' + (c.size ? ' (' + Math.round(c.size / 1048576) + ' MB)' : '') + '…');
    var job = null;
    try{ job = scFetchBytes(c.url, c.size, function(loaded, total){
      var pct = total ? Math.round((loaded / total) * 100) : 0;
      scVideoSay(pct > 0 ? 'Reading the video… ' + pct + '%' : 'Reading the video…');
    }, 4); }catch(_eRead){ job = null; }
    if(!job){ scVideoSay('This video could not be read.'); return; }
    Promise.resolve(job).then(function(buf){
      if(!buf || !buf.byteLength){ scVideoSay('This video could not be read.'); return; }
      try{ if(scVideoState.blobUrl) URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eRev){}
      var type = String(c.mime || 'video/mp4').split(';')[0].trim() || 'video/mp4';
      try{ scVideoState.blobUrl = URL.createObjectURL(new Blob([buf], { type: type })); }
      catch(_eBlob){ scVideoSay('This video could not be read.'); return; }
      scVideoAttach(scVideoState.blobUrl, 'blob');
    }).catch(function(){ scVideoSay('This video could not be read.'); });
  }

  function scVideoLoad(cand){
    if(!cand) return Promise.resolve(false);
    scVideoState.videoId = String(cand.videoId || '');
    if(scVideoState.blobUrl){ try{ URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eOld){} scVideoState.blobUrl = ''; }
    var v = document.getElementById('scVideoEl');
    if(v){ try{ v.pause(); }catch(_eP){} }
    scVideoTickStop();
    scVideoTitle(cand.title || 'Music video', cand.owner || '');
    scVideoSay('Looking for the video…');
    scVideoNote('');
    scVideoState.busy = true;
    return scVideoPlayer(cand.videoId).then(function(r){
      scVideoState.busy = false;
      if(!r || !r.url){ scVideoSay('This video has no stream the app can reach. Try NEXT.'); return false; }
      scVideoState.pick = { url: r.url, mime: r.mime, size: r.size };
      scVideoState.alts = (r.alts || []).slice();
      if(r.title) scVideoTitle(r.title, cand.owner || '');
      scVideoNote(r.muxed ? 'Sound comes from the song - the video itself is muted.'
                          : 'Picture only - the song is the soundtrack.');
      scVideoAttach(r.url, 'direct');
      return true;
    }).catch(function(){
      scVideoState.busy = false;
      scVideoSay('The video could not be resolved.');
      return false;
    });
  }

  function scVideoStart(t){
    scVideoState.title = t.title || '';
    scVideoState.artist = t.artist || '';
    var other = document.getElementById('scVideoOther');
    if(t.videoId){
      scVideoState.cands = [{ videoId: t.videoId, title: t.title || '', owner: t.artist || '' }];
      scVideoState.ci = 0;
      if(other) other.style.display = 'none';
      return scVideoLoad(scVideoState.cands[0]);
    }
    scVideoSay('Looking for a music video for this song…');
    if(other) other.style.display = 'none';
    return scVideoSearch(t).then(function(cands){
      if(!cands.length){
        scVideoSay('No music video found for this song.');
        scVideoNote('A file has no video id, so the search is by artist and title.');
        return false;
      }
      scVideoState.cands = cands;
      scVideoState.ci = 0;
      if(other) other.style.display = (cands.length > 1 ? '' : 'none');
      scVideoNote('Found by search · ' + cands.length + ' result' + (cands.length === 1 ? '' : 's') + (cands.length > 1 ? ' · NEXT for another' : ''));
      return scVideoLoad(cands[0]);
    });
  }

  function scVideoNext(){
    var c = scVideoState.cands || [];
    if(c.length < 2) return;
    scVideoState.ci = (scVideoState.ci + 1) % c.length;
    scVideoLoad(c[scVideoState.ci]);
  }

  function scVideoFullscreen(){
    var v = document.getElementById('scVideoEl');
    var d = document.getElementById('scVideoBackdrop');
    var target = (v && v.classList.contains('on')) ? v : d;
    if(!target) return;
    try{
      if(document.fullscreenElement || document.webkitFullscreenElement){
        if(document.exitFullscreen) document.exitFullscreen();
        else if(document.webkitExitFullscreen) document.webkitExitFullscreen();
        return;
      }
      var p = target.requestFullscreen ? target.requestFullscreen()
            : (target.webkitRequestFullscreen ? target.webkitRequestFullscreen() : null);
      if(p && p.then){
        p.then(function(){
          try{ if(screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(function(){}); }catch(_eLock){}
        }).catch(function(){});
      } else if(!p){
        try{ if(typeof toast === 'function') toast('This phone did not allow fullscreen here'); }catch(_eToast){}
      }
    }catch(_eFull){
      try{ if(typeof toast === 'function') toast('This phone did not allow fullscreen here'); }catch(_eToast2){}
    }
  }

  function scVideoClose(){
    scVideoState.open = false;
    scVideoTickStop();
    var d = document.getElementById('scVideoBackdrop');
    if(d) d.classList.remove('on');
    try{ document.body.classList.remove('sc-video-open'); }catch(_eCls){}
    var v = document.getElementById('scVideoEl');
    if(v){
      v.onerror = null; v.onloadeddata = null;
      try{ v.pause(); }catch(_ePause){}
      try{ v.removeAttribute('src'); v.load(); }catch(_eClear){}
      v.classList.remove('on');
    }
    try{ if(scVideoState.blobUrl) URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eRev2){}
    scVideoState.blobUrl = '';
    scVideoState.pick = null;
    scVideoState.alts = [];
    scVideoSay('Music video');
  }

  function scVideoOpen(){
    if(typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY) return;   // the full build only
    scVideoBuild();
    var d = document.getElementById('scVideoBackdrop');
    if(!d) return;
    d.classList.add('on');
    try{ document.body.classList.add('sc-video-open'); }catch(_eBody){}
    scVideoState.open = true;
    var t = scVideoTrack();
    if(!t){
      scVideoTitle('Music video', '');
      scVideoSay('Play a song first - this tab plays the music video of the song you are on.');
      scVideoNote('');
      var other = document.getElementById('scVideoOther');
      if(other) other.style.display = 'none';
      return;
    }
    scVideoTitle(t.title || 'Music video', t.artist || '');
    scVideoStart(t);
  }
