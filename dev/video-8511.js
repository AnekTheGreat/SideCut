  // ─── 85.1.1 - THE MUSIC VIDEO, ITS OWN SOUND AND ITS OWN BUTTON ────────────
  // WHAT WAS STILL WRONG IN 85.1.0. The tab played a picture and left the song
  // as the sound, so the two were only as right as the match between them: a
  // search could land on a live take, a cover or a sped-up upload and the frame
  // would show one recording while the speakers played another. And when the
  // two really were the same recording, the song was still the sound, which is
  // not what a music video is.
  //
  // THE AUDIO IS THE VIDEO'S NOW. A muxed stream (itag 18 and friends) carries
  // its own AAC track, so the element is unmuted and the song underneath is
  // paused: one sound, and it is the one the picture belongs to. On close the
  // song is put back at the second the video stopped on, so the tab is a detour
  // and not a fork. A stream with no audio track (an adaptive-only row) keeps
  // the song as its soundtrack, stays muted, and says so on the footer - the
  // honest fallback rather than silence.
  //
  // THE VIDEO IS MATCHED, NOT JUST FOUND. For a file the host is still asked by
  // "artist title", but the candidates are re-ranked against the song's own
  // length: within six seconds earns the top of the list, more than about a
  // tenth of the song away loses it, and a live take, cover, remix, instrumental
  // or nightcore upload is pushed down. A catalogue song keeps its own video id.
  //
  // THE PLAY BUTTON IS ITS OWN. The glyph that waits over a stopped video is
  // not the app's plain play triangle: a frosted disc, a warm gradient triangle
  // with soft corners, an inner highlight and a slow ripple that says "tap me"
  // without a label. The small round button in the transport uses the same
  // drawn triangle, so the tab reads as one control set rather than a stock one.
  //
  // Everything 85.1.0 earned stays: the frame is visible before it plays, a
  // refusal is printed with its name instead of swallowed, the alternates are
  // tried before the byte reader, and every failing step says which step it was.

  var scVideoState = {
    open: false, busy: false, tick: null, cands: [], ci: 0,
    title: '', artist: '', videoId: '', pick: null, alts: [], alt: 0,
    blobUrl: '', via: '', audio: null, blocked: false, last: null,
    audioMode: 'song', songWasPlaying: false, startAt: null
  };

  function scVideoEl(id){ try{ return document.getElementById(id); }catch(_e){ return null; } }

  var SC_VTRI = '<defs><linearGradient id="scVgrad" x1="0" y1="0" x2="1" y2="1">' +
    '<stop offset="0" stop-color="#FFE3B8"/><stop offset=".55" stop-color="#FFB07A"/>' +
    '<stop offset="1" stop-color="#FF7A55"/></linearGradient></defs>' +
    '<path d="M9.4 6.4c0-1.05 1.15-1.7 2.05-1.15l7.5 4.9c.85.55.85 1.8 0 2.35l-7.5 4.9c-.9.55-2.05-.1-2.05-1.15z" ' +
    'fill="url(#scVgrad)" stroke="rgba(255,255,255,.55)" stroke-width=".7" stroke-linejoin="round"/>';
  var SC_VICON_PLAY = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
    '<path d="M9 6.6c0-.95 1.05-1.55 1.85-1.05l6.6 4.35c.75.5.75 1.6 0 2.1l-6.6 4.35c-.8.5-1.85-.1-1.85-1.05z" fill="currentColor"/></svg>';
  var SC_VICON_PAUSE = '<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true">' +
    '<rect x="7" y="5.2" width="3.5" height="13.6" rx="1.5" fill="currentColor"/>' +
    '<rect x="13.5" y="5.2" width="3.5" height="13.6" rx="1.5" fill="currentColor"/></svg>';
  var SC_VICON_BIG = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true">' + SC_VTRI + '</svg>';

  function scVideoCss(){
    if(scVideoEl('scVideoCss')) return;
    var st = document.createElement('style');
    st.id = 'scVideoCss';
    st.textContent = [
      '#scVideoBackdrop{position:fixed;inset:0;z-index:240;display:none;flex-direction:column;box-sizing:border-box;',
      'background:#05090A;background-image:radial-gradient(120% 80% at 50% 0%, rgba(55,230,196,.14), transparent 62%);',
      'padding:calc(env(safe-area-inset-top) + 10px) 12px calc(env(safe-area-inset-bottom) + 10px)}',
      '#scVideoBackdrop.on{display:flex}',
      '#scVideoHead{display:flex;align-items:center;gap:10px;padding:0 4px 10px}',
      '#scVideoHead .sv-t{flex:1;min-width:0}',
      '#scVideoHead .sv-t b{display:block;font-size:13.5px;font-weight:650;color:var(--ink);',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#scVideoHead .sv-t i{display:block;font-style:normal;font-size:10.5px;color:var(--ink-dim);margin-top:2px;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '#scVideoHead .sv-chip{font-family:"JetBrains Mono",monospace;font-size:9px;letter-spacing:1px;color:var(--coral);',
      'border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);border-radius:999px;padding:3px 8px;flex:0 0 auto}',
      '#scVideoHead button{width:34px;height:34px;border-radius:999px;border:1px solid var(--line);',
      'background:rgba(255,255,255,.05);color:var(--ink-dim);font-size:14px;line-height:1;cursor:pointer;flex:0 0 auto}',
      '#scVideoHead button:active{transform:scale(.94)}',
      '#scVideoStage{position:relative;flex:1 1 auto;min-height:0;display:grid;place-items:center;border-radius:18px;',
      'overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 60px rgba(0,0,0,.55);',
      'touch-action:manipulation}',
      '#scVideoEl{max-width:100%;max-height:100%;width:auto;height:auto;background:#000;display:block}',
      // THE PLAY BUTTON BEFORE A VIDEO STARTS. A frosted disc with a warm
      // gradient triangle and a ripple, not the app's plain glyph: this is the
      // one control in the app that is allowed to be a poster.
      '#scVideoBig{position:absolute;width:88px;height:88px;border-radius:999px;display:none;place-items:center;',
      'border:1px solid rgba(255,255,255,.34);cursor:pointer;padding:0;color:#fff;',
      'background:radial-gradient(120% 120% at 32% 22%, rgba(255,255,255,.34), rgba(255,255,255,.08) 44%, rgba(0,0,0,.34));',
      '-webkit-backdrop-filter:blur(16px) saturate(1.35);backdrop-filter:blur(16px) saturate(1.35);',
      'box-shadow:0 18px 46px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.42),',
      'inset 0 -10px 24px rgba(0,0,0,.22), 0 0 36px color-mix(in srgb, var(--coral) 32%, transparent);',
      'transition:transform .16s ease}',
      '#scVideoBig.on{display:grid}',
      '#scVideoBig::before{content:"";position:absolute;inset:-7px;border-radius:999px;pointer-events:none;',
      'border:1.5px solid color-mix(in srgb, var(--coral) 58%, transparent);animation:scVripple 2.6s ease-out infinite}',
      '@keyframes scVripple{0%{transform:scale(.9);opacity:.8}70%{transform:scale(1.16);opacity:0}100%{opacity:0}}',
      '#scVideoBig svg{width:30px;height:30px;margin-left:5px;filter:drop-shadow(0 3px 10px rgba(0,0,0,.5))}',
      '#scVideoBig:active{transform:scale(.94)}',
      '#scVideoSpin{position:absolute;width:32px;height:32px;border-radius:999px;border:3px solid rgba(255,255,255,.16);',
      'border-top-color:var(--coral);animation:scVspin .9s linear infinite;display:none}',
      '#scVideoSpin.on{display:block}',
      '@keyframes scVspin{to{transform:rotate(360deg)}}',
      '#scVideoSay{position:absolute;left:0;right:0;bottom:0;padding:12px 14px 64px;font-size:11.5px;line-height:1.5;',
      'color:#d9e8e4;background:linear-gradient(0deg, rgba(0,0,0,.82), rgba(0,0,0,0));display:none;text-align:left}',
      '#scVideoSay.on{display:block}',
      '#scVideoCtl{position:absolute;left:9px;right:9px;bottom:9px;display:flex;align-items:center;gap:10px;',
      'box-sizing:border-box;padding:7px 10px 7px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.13);',
      'background:rgba(6,14,14,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px)}',
      '#scVideoPlay{width:42px;height:42px;border-radius:999px;border:0;display:grid;place-items:center;',
      'background:linear-gradient(145deg, #FFB478, #FF7A55);color:#2A1206;cursor:pointer;flex:0 0 auto;padding:0;',
      'box-shadow:0 6px 16px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.45);transition:transform .12s}',
      '#scVideoPlay:active{transform:scale(.94)}',
      '#scVideoProg{position:relative;flex:1 1 auto;min-width:40px;height:4px;border-radius:999px;',
      'background:rgba(255,255,255,.18);overflow:hidden}',
      '#scVideoFill{position:absolute;top:0;bottom:0;left:0;width:0;border-radius:999px;background:var(--coral);',
      'transition:width .25s linear}',
      '#scVideoClock{font-family:"JetBrains Mono",monospace;font-size:10px;letter-spacing:.4px;color:#cfe6e1;',
      'white-space:nowrap;flex:0 0 auto}',
      '#scVideoCtl .sv-mini{height:30px;border-radius:999px;border:1px solid rgba(255,255,255,.16);padding:0 10px;',
      'background:rgba(255,255,255,.06);color:#cfe6e1;font-size:9px;font-weight:700;letter-spacing:.6px;',
      'cursor:pointer;flex:0 0 auto}',
      '#scVideoCtl .sv-mini:active{transform:scale(.95)}',
      '#scVideoFoot{padding:9px 6px 0;font-size:10px;line-height:1.4;color:var(--ink-dim);opacity:.85;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      '@media (orientation:landscape){#scVideoHead{padding-bottom:6px} #scVideoStage{border-radius:14px}',
      '#scVideoFoot{display:none} #scVideoSay{padding-bottom:52px} #scVideoBig{width:76px;height:76px}}',
      'body.sc-video-open{overflow:hidden}'
    ].join('');
    document.head.appendChild(st);
  }

  function scVideoBuild(){
    if(scVideoEl('scVideoBackdrop')) return;
    scVideoCss();
    var d = document.createElement('div');
    d.id = 'scVideoBackdrop';
    d.innerHTML =
      '<div id="scVideoHead">' +
        '<div class="sv-t"><b id="scVideoTitle">Music video</b><i id="scVideoSub"></i></div>' +
        '<span class="sv-chip" id="scVideoChip" style="display:none;">360p</span>' +
        '<button type="button" id="scVideoClose" title="Close" aria-label="Close">&#215;</button>' +
      '</div>' +
      '<div id="scVideoStage">' +
        '<video id="scVideoEl" playsinline webkit-playsinline preload="auto"></video>' +
        '<div id="scVideoSpin" aria-hidden="true"></div>' +
        '<button type="button" id="scVideoBig" aria-label="Play">' + SC_VICON_BIG + '</button>' +
        '<div id="scVideoSay"></div>' +
        '<div id="scVideoCtl">' +
          '<button type="button" id="scVideoPlay" class="paused" aria-label="Play">' + SC_VICON_PLAY + '</button>' +
          '<div id="scVideoProg"><div id="scVideoFill"></div></div>' +
          '<span id="scVideoClock">0:00 / 0:00</span>' +
          '<button type="button" id="scVideoNext" class="sv-mini" title="Try the next search result" style="display:none;">NEXT</button>' +
          '<button type="button" id="scVideoFull" class="sv-mini" title="Fullscreen">FULL</button>' +
        '</div>' +
      '</div>' +
      '<div id="scVideoFoot"></div>';
    document.body.appendChild(d);

    d.addEventListener('click', function(e){ if(e.target === d) scVideoClose(); });
    var c = scVideoEl('scVideoClose'); if(c) c.addEventListener('click', scVideoClose);
    var n = scVideoEl('scVideoNext'); if(n) n.addEventListener('click', function(e){ e.stopPropagation(); scVideoNext(); });
    var f = scVideoEl('scVideoFull'); if(f) f.addEventListener('click', function(e){ e.stopPropagation(); scVideoFullscreen(); });
    var p = scVideoEl('scVideoPlay'); if(p) p.addEventListener('click', function(e){ e.stopPropagation(); scVideoTap(); });
    var b = scVideoEl('scVideoBig'); if(b) b.addEventListener('click', function(e){ e.stopPropagation(); scVideoTap(); });
    var stage = scVideoEl('scVideoStage'); if(stage) stage.addEventListener('click', function(e){
      if(e.target && e.target.closest && e.target.closest('#scVideoCtl')) return;
      scVideoTap();
    });

    var v = scVideoEl('scVideoEl');
    if(v){
      v.addEventListener('playing', function(){
        scVideoState.blocked = false;
        scVideoBig(false); scVideoSpin(false); scVideoSay(''); scVideoBarState();
      });
      v.addEventListener('pause', function(){ scVideoBarState(); if(!v.ended && !scVideoState.blocked) scVideoBig(true); });
      v.addEventListener('waiting', function(){ scVideoSpin(true); });
      v.addEventListener('stalled', function(){ scVideoSpin(true); });
      v.addEventListener('canplay', function(){ scVideoSpin(false); });
      v.addEventListener('timeupdate', scVideoClock);
      v.addEventListener('loadedmetadata', function(){
        scVideoSpin(false);
        // The picture starts where the song was, so opening the tab is not a rewind.
        if(scVideoState.startAt != null){
          try{ v.currentTime = scVideoState.startAt; }catch(_eAt){}
          scVideoState.startAt = null;
        }
        scVideoClock();
      });
      v.addEventListener('ended', function(){ scVideoBig(true); scVideoBarState(); });
      v.addEventListener('error', scVideoFailed);
    }
  }

  function scVideoSay(txt){ var s = scVideoEl('scVideoSay'); if(!s) return;
    s.textContent = txt || ''; if(txt) s.classList.add('on'); else s.classList.remove('on'); }
  function scVideoSpin(on){ var s = scVideoEl('scVideoSpin'); if(s) s.classList.toggle('on', !!on); }
  function scVideoBig(on){ var b = scVideoEl('scVideoBig'); if(b) b.classList.toggle('on', !!on); }
  function scVideoFoot(txt){ var f = scVideoEl('scVideoFoot'); if(f) f.textContent = txt || ''; }
  function scVideoChip(txt){ var c = scVideoEl('scVideoChip');
    if(!c) return; if(txt){ c.textContent = txt; c.style.display = ''; } else { c.style.display = 'none'; } }
  function scVideoTitle(title, sub){
    var a = scVideoEl('scVideoTitle'), b = scVideoEl('scVideoSub');
    if(a) a.textContent = title || 'Music video';
    if(b) b.textContent = sub || '';
  }
  function scVideoBarState(){
    var v = scVideoEl('scVideoEl'), b = scVideoEl('scVideoPlay');
    if(!b) return;
    var live = !!(v && v.src && !v.paused);
    b.innerHTML = live ? SC_VICON_PAUSE : SC_VICON_PLAY;
    b.setAttribute('aria-label', live ? 'Pause' : 'Play');
    b.classList.toggle('paused', !live);
  }
  function scVideoClock(){
    var v = scVideoEl('scVideoEl'), c = scVideoEl('scVideoClock'), f = scVideoEl('scVideoFill');
    if(!c) return;
    function mmss(n){
      n = Math.max(0, Math.floor(Number(n) || 0));
      return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2);
    }
    var at = v ? (Number(v.currentTime) || 0) : 0;
    var dur = (v && isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    c.textContent = mmss(at) + ' / ' + (dur ? mmss(dur) : '0:00');
    if(f) f.style.width = (dur ? Math.min(100, (at / dur) * 100) : 0) + '%';
    scVideoBarState();
  }

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
  function scVideoSongTime(){
    var a = scVideoAudioEl();
    var t = 0;
    try{ t = a ? (Number(a.currentTime) || 0) : 0; }catch(_eSt){ t = 0; }
    return t;
  }

  // One sound at a time: while the video carries its own audio the song is
  // paused, and the second it stops is remembered so the song can be put back.
  function scVideoHoldSong(){
    var a = scVideoAudioEl();
    if(a && !a.paused){ scVideoState.songWasPlaying = true; }
    try{ if(a && !a.paused) a.pause(); }catch(_eHold){}
    try{ if(typeof audio !== 'undefined' && audio && !audio.paused) audio.pause(); }catch(_eD1){}
    try{ if(typeof audio2 !== 'undefined' && audio2 && !audio2.paused) audio2.pause(); }catch(_eD2){}
  }
  function scVideoReleaseSong(){
    if(scVideoState.audioMode !== 'video'){ scVideoState.songWasPlaying = false; return; }
    var a = scVideoAudioEl(), v = scVideoEl('scVideoEl');
    var at = v ? (Number(v.currentTime) || 0) : 0;
    var dur = 0;
    try{ dur = a ? (Number(a.duration) || 0) : 0; }catch(_eDur){ dur = 0; }
    if(a && scVideoState.songWasPlaying){
      try{ if(at > 0 && (!dur || at < dur - 1)) a.currentTime = at; }catch(_eSeek){}
      try{ var p = a.play(); if(p && p.catch) p.catch(function(){}); }catch(_ePlay){}
    }
    scVideoState.songWasPlaying = false;
  }

  // The player call, with the two clients that still answer (the same pair
  // scYtPlayer measured). Plain urls only: a cipher is not this path's problem.
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
        if(mt.toLowerCase().indexOf('mp4') === -1) return;
        if(wantMuxed && !/mp4a|opus|vorbis/i.test(mt)) return;
        var u = f.url || '';
        if(!u || seen[u]) return;
        var size = Number(f.contentLength || f.clen) || 0;
        if(size > 38 * 1024 * 1024) return;
        seen[u] = true;
        into.push({ url: u, mime: mt, itag: Number(f.itag) || 0, size: size,
                    height: Number(f.height) || 0, muxed: !!wantMuxed });
      });
    }
    function rankMuxed(it){ it = Number(it) || 0; return it === 18 ? 0 : it === 59 ? 1 : it === 22 ? 2 : 3; }
    function rankPlain(it){ it = Number(it) || 0; return it === 134 ? 0 : it === 135 ? 1 : it === 133 ? 2 : it === 136 ? 3 : 4; }
    function label(row){
      var r = row || {};
      if(r.height) return r.height + 'p';
      var it = Number(r.itag) || 0;
      return it === 18 || it === 134 ? '360p' : it === 22 || it === 136 ? '720p' : it === 135 ? '480p' : 'VIDEO';
    }
    var asks = clients.map(function(cl){
      try{
        return scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
          { context: { client: cl.client }, videoId: videoId, contentCheckOk: true, racyCheckOk: true },
          { name: cl.num, version: cl.client.clientVersion, ua: cl.ua }).catch(function(){ return null; });
      }catch(_eAsk){ return Promise.resolve(null); }
    });
    return Promise.all(asks).then(function(answers){
      var title = '', details = null;
      (answers || []).forEach(function(d){
        if(!d || !d.streamingData) return;
        if(!title && d.videoDetails && d.videoDetails.title) title = String(d.videoDetails.title);
        if(!details && d.videoDetails) details = d.videoDetails;
        take(d.streamingData.formats, muxed, true);
        take(d.streamingData.adaptiveFormats, adaptive, false);
      });
      muxed.sort(function(a, b){ return rankMuxed(a.itag) - rankMuxed(b.itag); });
      adaptive.sort(function(a, b){ return rankPlain(a.itag) - rankPlain(b.itag); });
      var pool = muxed.concat(adaptive);
      if(!pool.length) return null;
      return { url: pool[0].url, mime: pool[0].mime, size: pool[0].size, itag: pool[0].itag,
               muxed: !!pool[0].muxed, alts: pool.slice(1), title: title, label: label(pool[0]),
               length: Number(details && details.lengthSeconds) || 0 };
    }).catch(function(){ return null; });
  }

  // A file has no video id, so the host is asked, and what comes back is put in
  // the order the SONG agrees with: length first, credit second, and anything
  // that advertises itself as a different take demoted.
  function scVideoRank(list, t){
    var songDur = 0;
    try{ var a = scVideoAudioEl(); songDur = a && isFinite(a.duration) ? (Number(a.duration) || 0) : 0; }catch(_eSd){ songDur = 0; }
    var otherTake = /\blive\b|cover|karaoke|remix|sped\s*up|slowed|nightcore|\b8d\b|instrumental|reaction|tutorial|lesson|behind the scenes|teaser|trailer/i;
    var artist = String((t && t.artist) || '').toLowerCase().split(/\s*(?:,|&|\bfeat\b|\bft\b|\bx\b)\s*/)[0].trim();
    var rows = (list || []).map(function(c, i){
      var s = -i * 2;                                  // the host's own ranking is the floor
      var dur = Number(c.duration) || 0;
      if(songDur > 0 && dur > 0){
        var diff = Math.abs(dur - songDur);
        if(diff <= 6) s += 16;
        else if(diff <= 15) s += 7;
        else if(diff > Math.max(25, songDur * 0.12)) s -= 26;   // a different recording
        else s -= 4;
      }
      if(otherTake.test(String(c.title || ''))) s -= 14;
      var owner = String(c.owner || '').toLowerCase();
      if(artist && owner && owner.indexOf(artist) !== -1) s += 9;
      if(/\btopic\b|\bvevo\b/.test(owner)) s += 5;
      return { c: c, s: s, i: i, dur: dur, far: !!(songDur > 0 && dur > 0 && Math.abs(dur - songDur) > Math.max(25, songDur * 0.12)) };
    });
    rows.sort(function(x, y){ return (y.s - x.s) || (x.i - y.i); });
    var kept = rows.filter(function(r){ return !r.far; });
    var use = kept.length ? kept : rows;
    return use.map(function(r){ return r.c; });
  }

  function scVideoSearch(t){
    var q = (String((t && t.artist) || '') + ' ' + String((t && t.title) || '')).trim();
    if(!q) return Promise.resolve([]);
    try{
      return Promise.resolve(scYtSearch(q, (t && t.artist) || '', ''))
        .then(function(cands){
          if(!cands || !cands.length) return [];
          var picked = scVideoRank(cands.slice(0, 8), t);
          return picked.slice(0, 6).map(function(c){
            return { videoId: String(c.videoId || ''), title: String(c.title || ''), owner: String(c.owner || '') };
          }).filter(function(c){ return !!c.videoId && c.videoId.indexOf('ia:') !== 0; });
        })
        .catch(function(){ return []; });
    }catch(_eSearch){ return Promise.resolve([]); }
  }

  // ── playback ---------------------------------------------------------------
  function scVideoAttach(src, via){
    var v = scVideoEl('scVideoEl');
    if(!v || !src) return;
    var videoSound = scVideoState.audioMode === 'video';
    scVideoState.via = via;
    scVideoState.blocked = false;
    scVideoState.audio = scVideoAudioEl();
    scVideoState.startAt = videoSound ? scVideoSongTime() : null;
    try{ v.removeAttribute('src'); }catch(_eRm){}
    v.src = src;
    v.muted = !videoSound;          // the video's own audio when the stream has one
    try{ v.volume = 1; }catch(_eVol){}
    try{ v.load(); }catch(_eLoad){}
    if(videoSound) scVideoHoldSong();
    scVideoBig(false);
    scVideoSpin(true);
    scVideoSay('Starting the video…');
    scVideoPlayAttempt();
  }

  function scVideoPlayAttempt(){
    var v = scVideoEl('scVideoEl');
    if(!v || !v.src) return;
    var p = null;
    try{ p = v.play(); }catch(_e){ p = null; }
    if(p && p.then){
      p.then(function(){
        scVideoState.blocked = false;
        scVideoBig(false); scVideoSpin(false); scVideoSay('');
        scVideoBarState();
        scVideoSync(true);
      }).catch(function(e){
        // Not an error to hide: the phone wants a tap, and the frame stays up.
        scVideoState.blocked = true;
        scVideoSpin(false);
        scVideoBig(true);
        scVideoSay('Tap to play. (' + ((e && e.name) || 'blocked') + ')');
        scVideoBarState();
      });
    } else {
      scVideoBig(false);
    }
  }

  function scVideoSong(on){
    var a = scVideoAudioEl();
    if(!a) return;
    try{
      if(on){ var p = a.play(); if(p && p.catch) p.catch(function(){}); }
      else a.pause();
    }catch(_eSong){}
  }

  function scVideoTap(){
    var v = scVideoEl('scVideoEl');
    if(!v || !v.src){ if(scVideoState.open) scVideoStart(scVideoState.last || scVideoTrack()); return; }
    if(v.paused){
      scVideoState.blocked = false;
      // The video is the sound in video mode; the song is only started when the
      // stream had no audio track of its own.
      if(scVideoState.audioMode === 'video') scVideoHoldSong(); else scVideoSong(true);
      scVideoPlayAttempt();
      scVideoSpin(true);
      scVideoBig(false);
    } else {
      try{ v.pause(); }catch(_eP){}
      if(scVideoState.audioMode !== 'video') scVideoSong(false);
      scVideoBig(true);
      scVideoBarState();
    }
  }

  function scVideoSync(force){
    var v = scVideoEl('scVideoEl');
    var a = scVideoState.audio || scVideoAudioEl();
    if(!v || !v.src) return;
    // THE VIDEO'S AUDIO IS THE SOUND: there is nothing to line up with the
    // song, and the song is paused underneath it by design.
    if(scVideoState.audioMode === 'video'){ scVideoClock(); return; }
    if(!a || v.readyState < 1) return;
    scVideoState.audio = a;
    try{
      var at = Number(a.currentTime) || 0;
      var vt = Number(v.currentTime) || 0;
      if(force || Math.abs(vt - at) > 1.5){ try{ v.currentTime = at; }catch(_eSeek){} }
      if(a.paused){ if(!v.paused){ try{ v.pause(); }catch(_ePause){} } }
      else if(v.paused && !scVideoState.blocked){ scVideoPlayAttempt(); }
    }catch(_eSync){}
    scVideoClock();
  }
  function scVideoTickStart(){
    scVideoTickStop();
    scVideoState.tick = setInterval(function(){ if(scVideoState.open) scVideoSync(false); }, 900);
  }
  function scVideoTickStop(){
    if(scVideoState.tick){ clearInterval(scVideoState.tick); scVideoState.tick = null; }
  }

  function scVideoFailed(){
    var v = scVideoEl('scVideoEl');
    var why = 'the element could not play this source';
    try{
      var err = v && v.error;
      if(err && err.code === 2) why = 'the stream dropped (network)';
      else if(err && err.code === 3) why = 'the phone could not decode this stream';
      else if(err && err.code === 4) why = 'this source is not a video the element can open';
      else if(err && err.code === 1) why = 'the read was aborted';
    }catch(_eErr){}
    if(scVideoState.via === 'direct'){
      var alts = scVideoState.alts || [];
      if(scVideoState.alt < alts.length && scVideoState.alt < 3){
        var next = alts[scVideoState.alt++];
        scVideoSay('That stream refused it (' + why + '). Trying another…');
        scVideoAttach(next.url, 'direct');
        return;
      }
      scVideoSay('The player refused the direct stream (' + why + '). Reading it instead…');
      scVideoRead();
      return;
    }
    scVideoSpin(false);
    scVideoBig(true);
    scVideoSay('This video could not be played here (' + why + '). NEXT tries another result.');
    scVideoFoot('Close this tab to go back to the song.');
  }

  function scVideoRead(){
    var c = scVideoState.pick;
    if(!c || !c.url){ scVideoSay('There is nothing to read for this video.'); return; }
    scVideoSpin(true);
    scVideoSay('Reading the video' + (c.size ? ' (' + Math.round(c.size / 1048576) + ' MB)' : '') + '…');
    var job = null;
    try{
      job = scFetchBytes(c.url, c.size, function(loaded, total){
        var pct = total ? Math.round((loaded / total) * 100) : 0;
        scVideoSay(pct > 0 ? 'Reading the video… ' + pct + '%' : 'Reading the video…');
      }, 4);
    }catch(_eRead){ job = null; }
    if(!job){ scVideoSpin(false); scVideoSay('The reader refused this stream.'); return; }
    Promise.resolve(job).then(function(buf){
      if(!buf || !buf.byteLength){
        scVideoSpin(false); scVideoBig(true);
        scVideoSay('The video came back empty. NEXT tries another result.');
        return;
      }
      try{ if(scVideoState.blobUrl) URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eRev){}
      var type = String(c.mime || 'video/mp4').split(';')[0].trim() || 'video/mp4';
      try{ scVideoState.blobUrl = URL.createObjectURL(new Blob([buf], { type: type })); }
      catch(_eBlob){ scVideoSpin(false); scVideoSay('The video could not be held in memory.'); return; }
      scVideoAttach(scVideoState.blobUrl, 'blob');
    }).catch(function(){
      scVideoSpin(false); scVideoBig(true);
      scVideoSay('The video could not be read.');
    });
  }

  function scVideoLoad(cand){
    if(!cand) return Promise.resolve(false);
    scVideoState.videoId = String(cand.videoId || '');
    if(scVideoState.blobUrl){ try{ URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eOld){} scVideoState.blobUrl = ''; }
    var v = scVideoEl('scVideoEl');
    if(v){ try{ v.pause(); }catch(_eP){} try{ v.removeAttribute('src'); v.load(); }catch(_eC){} }
    scVideoTickStop();
    scVideoTitle(cand.title || 'Music video', cand.owner || '');
    scVideoChip('');
    scVideoFoot('');
    scVideoBig(false);
    scVideoSpin(true);
    scVideoSay('Looking for the video…');
    scVideoClock();
    scVideoState.busy = true;
    scVideoState.alt = 0;
    return scVideoPlayer(cand.videoId).then(function(r){
      scVideoState.busy = false;
      if(!r || !r.url){
        scVideoSpin(false); scVideoSay('This one has no stream the app can reach. NEXT tries another result.');
        return false;
      }
      scVideoState.pick = { url: r.url, mime: r.mime, size: r.size };
      scVideoState.alts = (r.alts || []).slice();
      scVideoState.audioMode = r.muxed ? 'video' : 'song';
      if(r.title) scVideoTitle(r.title, cand.owner || '');
      scVideoChip(r.label || '');
      scVideoFoot(r.muxed
        ? 'This is the video own sound - the song waits where you left it.'
        : 'No audio in this stream - the song plays under the picture.');
      scVideoAttach(r.url, 'direct');
      scVideoTickStart();
      return true;
    }).catch(function(){
      scVideoState.busy = false;
      scVideoSpin(false);
      scVideoSay('The player could not resolve this video.');
      return false;
    });
  }

  function scVideoStart(t){
    if(!t){
      scVideoTitle('Music video', '');
      scVideoSay('Play a song first - this tab shows the music video of the song you are on.');
      return Promise.resolve(false);
    }
    scVideoState.last = t;
    scVideoState.title = t.title || '';
    scVideoState.artist = t.artist || '';
    var other = scVideoEl('scVideoNext');
    if(t.videoId){
      scVideoState.cands = [{ videoId: t.videoId, title: t.title || '', owner: t.artist || '' }];
      scVideoState.ci = 0;
      if(other) other.style.display = 'none';
      return scVideoLoad(scVideoState.cands[0]);
    }
    scVideoSay('Looking for a music video for this song…');
    scVideoSpin(true);
    if(other) other.style.display = 'none';
    return scVideoSearch(t).then(function(cands){
      if(!cands.length){
        scVideoSpin(false);
        scVideoSay('No music video found for this song.');
        scVideoFoot('A file has no video id, so the search is by artist and title.');
        return false;
      }
      scVideoState.cands = cands;
      scVideoState.ci = 0;
      if(other) other.style.display = (cands.length > 1 ? '' : 'none');
      scVideoFoot('Matched by length · ' + cands.length + ' result' + (cands.length === 1 ? '' : 's') + (cands.length > 1 ? ' · NEXT for another' : ''));
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
    var v = scVideoEl('scVideoEl');
    var d = scVideoEl('scVideoBackdrop');
    var target = (v && v.src) ? v : d;
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
    var d = scVideoEl('scVideoBackdrop');
    if(d) d.classList.remove('on');
    try{ document.body.classList.remove('sc-video-open'); }catch(_eCls){}
    var v = scVideoEl('scVideoEl');
    if(v){
      try{ v.pause(); }catch(_ePause){}
      try{ v.removeAttribute('src'); v.load(); }catch(_eClear){}
    }
    // The song picks up where the video stopped, so the tab is a detour.
    scVideoReleaseSong();
    try{ if(scVideoState.blobUrl) URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eRev2){}
    scVideoState.blobUrl = '';
    scVideoState.pick = null;
    scVideoState.alts = [];
    scVideoState.startAt = null;
    scVideoBig(false);
    scVideoSpin(false);
    scVideoSay('');
    scVideoChip('');
    scVideoFoot('');
    scVideoClock();
  }

  function scVideoOpen(){
    if(typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY) return;   // the full build only
    scVideoBuild();
    var d = scVideoEl('scVideoBackdrop');
    if(!d) return;
    d.classList.add('on');
    try{ document.body.classList.add('sc-video-open'); }catch(_eBody){}
    scVideoState.open = true;
    var other = scVideoEl('scVideoNext');
    if(other) other.style.display = 'none';
    var t = scVideoTrack();
    if(!t){
      scVideoTitle('Music video', '');
      scVideoSay('Play a song first - this tab shows the music video of the song you are on.');
      scVideoFoot('');
      scVideoClock();
      return;
    }
    scVideoTitle(t.title || 'Music video', t.artist || '');
    scVideoStart(t);
  }
