  // --- the audio element -----------------------------------------------------
  function scStreamAudio(){
    if(scStreamState.audio) return scStreamState.audio;
    var a = document.createElement('audio');
    a.id = 'scStreamAudio';
    a.preload = 'none';
    a.volume = 1;
    a.addEventListener('timeupdate', scStreamTick);
    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamRender(); });
    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamRender(); });
    a.addEventListener('ended', function(){ scStreamNext(1); });
    a.addEventListener('error', function(){
      // The signed URL died (or the source refused). One re-resolve, resumed where it
      // was - the same videoId always, so the song does not change under the listener.
      var t = scStreamById(scStreamState.curId);
      if(!t || !t.videoId || scStreamState.busy){ scStreamSay('This stream stopped - tap it again'); return; }
      var at = a.currentTime || 0;
      scStreamState.busy = true;
      scStreamResolve(t.videoId).then(function(u){
        scStreamState.busy = false;
        if(!u){ scStreamSay('This source will not play right now'); return; }
        scStreamState.url = u; scStreamState.urlAt = Date.now();
        a.src = u;
        try{ a.currentTime = at; }catch(_e){}
        Promise.resolve(a.play()).catch(function(){});
        scStreamSay('');
      });
    });
    scStreamState.audio = a;
    return a;
  }

  // --- playing ---------------------------------------------------------------
  function scStreamPlay(id, ctxIds){
    var t = scStreamById(id);
    if(!t){ return; }
    var a = scStreamAudio();
    scStreamState.curId = String(id);
    scStreamState.queue = (ctxIds && ctxIds.length) ? ctxIds.slice() : (scStreamState.tracks || []).map(function(x){ return String(x.id); });
    scStreamSay('Loading the stream…');
    scStreamRender();
    function go(){
      var need = !scStreamState.url || scStreamState.curId !== String(id) || scStreamStale(scStreamState.urlAt, Date.now());
      if(!need){ return Promise.resolve(scStreamState.url); }
      return scStreamResolve(t.videoId).then(function(u){
        if(u){ scStreamState.url = u; scStreamState.urlAt = Date.now(); }
        return u;
      });
    }
    if(scStreamState.curId === String(id) && scStreamState.url && !scStreamStale(scStreamState.urlAt, Date.now())){
      a.src = scStreamState.url;
      Promise.resolve(a.play()).catch(function(){ scStreamSay('Tap play to start'); });
      scStreamSay('');
      return;
    }
    Promise.resolve(go()).then(function(u){
      if(!u){ scStreamSay('No playable stream for this song right now'); return; }
      a.src = u;
      Promise.resolve(a.play()).then(function(){ scStreamSay(''); }).catch(function(){ scStreamSay('Tap play to start'); });
    });
  }
  function scStreamToggle(){
    var a = scStreamAudio();
    if(!scStreamState.curId) return;
    if(a.paused) Promise.resolve(a.play()).catch(function(){}); else a.pause();
  }
  function scStreamNext(dir){
    var q = scStreamState.queue || [];
    if(!q.length) return;
    var i = q.indexOf(String(scStreamState.curId));
    var n = i === -1 ? 0 : (i + dir + q.length) % q.length;
    scStreamPlay(q[n], q);
  }
  function scStreamSay(msg){
    try{ var el = document.getElementById('scStreamSay'); if(el) el.textContent = msg || ''; }catch(_e){}
  }
  function scStreamTick(){
    try{
      var a = scStreamState.audio;
      var bar = document.getElementById('scStreamBar');
      var at = document.getElementById('scStreamAt');
      if(!a) return;
      var d = a.duration;
      if(bar){ bar.max = isFinite(d) && d > 0 ? d : 0; bar.value = a.currentTime || 0; }
      if(at) at.textContent = scStreamTime(a.currentTime || 0) + (isFinite(d) && d > 0 ? ' / ' + scStreamTime(d) : '');
    }catch(_e){}
  }
  function scStreamTime(s){
    s = Math.max(0, Math.floor(Number(s) || 0));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  }

  // --- adding ---------------------------------------------------------------
  function scStreamSearchRun(q){
    q = String(q || '').trim();
    if(!q){ return; }
    scStreamState.q = q;
    scStreamState.results = null;
    scStreamRender();
    Promise.resolve(scYtSearch(q, '', '')).then(function(items){
      scStreamState.results = Array.isArray(items) ? items.slice(0, 12) : [];
      scStreamRender();
      if(!scStreamState.results.length) scStreamSay('Nothing found for that - try the artist and the title');
    }).catch(function(){
      scStreamState.results = [];
      scStreamRender();
      scStreamSay('The search could not reach the source');
    });
  }
  function scStreamAddResult(it){
    if(!it || !it.videoId) return;
    var id = 's_' + String(it.videoId);
    if(scStreamById(id)){ scStreamSay('That song is already in Streaming'); return; }
    var dur = 0;
    try{
      var m = String(it.lengthText || it.duration || '').match(/(\d+):(\d+)/);
      if(m) dur = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }catch(_e){}
    scStreamState.tracks = (scStreamState.tracks || []).concat([{
      id: id,
      videoId: String(it.videoId),
      title: String(it.title || it.videoTitle || 'Untitled'),
      artist: String(it.author || it.channel || ''),
      dur: dur,
      thumb: String(it.thumbnail || it.thumb || '')
    }]);
    scStreamSave();
    scStreamRender();
    scStreamSay('Added to Streaming - it plays from the source, nothing is downloaded');
  }
  function scStreamRemove(id){
    scStreamState.tracks = (scStreamState.tracks || []).filter(function(t){ return String(t.id) !== String(id); });
    scStreamState.playlists = (scStreamState.playlists || []).map(function(p){
      return { name: p.name, ids: (p.ids || []).filter(function(x){ return String(x) !== String(id); }) };
    }).filter(function(p){ return (p.ids || []).length; });
    if(String(scStreamState.curId) === String(id)){ try{ scStreamAudio().pause(); }catch(_e){} scStreamState.curId = ''; }
    scStreamSave();
    scStreamRender();
  }
  function scStreamToPlaylist(id){
    var name = '';
    try{ name = prompt('Add to a streaming playlist (type a new name to create one):', ''); }catch(_e){ name = ''; }
    name = String(name == null ? '' : name).trim();
    if(!name) return;
    scStreamState.playlists = scStreamPlAdd(scStreamState.playlists || [], name, String(id));
    scStreamSave();
    scStreamRender();
    scStreamSay('In “' + name + '”');
  }
  function scStreamNewPlaylist(){
    var name = '';
    try{ name = prompt('Name the streaming playlist:', ''); }catch(_e){ name = ''; }
    name = String(name == null ? '' : name).trim();
    if(!name) return;
    if(!(scStreamState.playlists || []).some(function(p){ return String(p.name) === name; })){
      scStreamState.playlists = (scStreamState.playlists || []).concat([{ name: name, ids: [] }]);
      scStreamSave();
      scStreamRender();
    }
  }

  // --- the block itself ------------------------------------------------------
  function scStreamRender(){
    if(!SC_STREAM_OK) return;
    var host = document.getElementById('scStreamBlock');
    if(!host) return;
    var tracks = scStreamState.tracks;
    var pls = scStreamState.playlists;
    if(tracks === null || pls === null) return;
    var cur = scStreamById(scStreamState.curId);
    var h = '';
    h += '<div style="margin:2px 20px 10px;padding:12px 12px 10px;border:1px solid var(--line);border-radius:16px;background:var(--bg-raised);">';
    h += '<div style="display:flex;align-items:center;gap:8px;">';
    h += '<span style="font-size:13.5px;font-weight:700;">Streaming</span>';
    h += '<span style="font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--coral);border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);border-radius:999px;padding:2px 7px;">Experimental</span>';
    h += '<span style="flex:1;"></span>';
    h += '<button type="button" id="scStreamNewPl" style="background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;">New playlist</button>';
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;">Plays from the source. Nothing is saved to your device, and a source can expire.</div>';
    h += '<div style="display:flex;gap:8px;margin-top:10px;">';
    h += '<input id="scStreamQuery" type="text" placeholder="Search a song to stream…" value="' + escapeHtml(scStreamState.q || '') + '" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--line);color:var(--ink);border-radius:12px;padding:8px 10px;font-size:12.5px;">';
    h += '<button type="button" id="scStreamGo" style="padding:8px 14px;border-radius:12px;border:none;background:var(--coral);color:#12030b;font-size:12px;font-weight:700;">Search</button>';
    h += '</div>';
    if(scStreamState.results){
      h += '<div style="margin-top:10px;max-height:230px;overflow:auto;">';
      if(!scStreamState.results.length){
        h += '<div style="font-size:12px;color:var(--ink-dim);padding:6px 2px;">Nothing found.</div>';
      }
      scStreamState.results.forEach(function(it, i){
        var ttl = String(it.title || 'Untitled');
        var who = String(it.author || it.channel || '');
        h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 2px;border-top:1px solid var(--line);">'
          + '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(ttl) + '</div>'
          + '<div style="font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(who) + '</div></div>'
          + '<button type="button" class="scs-add" data-i="' + i + '" style="border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:5px 10px;font-size:11px;">＋ Add</button>'
          + '</div>';
      });
      h += '</div>';
    }
    if(cur){
      h += '<div style="margin-top:12px;padding:10px;border-radius:12px;background:var(--bg);border:1px solid var(--line);">';
      h += '<div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(cur.title) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--ink-dim);">' + escapeHtml(cur.artist || 'Streaming') + '</div>';
      h += '<input id="scStreamBar" type="range" min="0" max="0" value="0" step="0.5" style="width:100%;margin:8px 0 2px;">';
      h += '<div style="display:flex;align-items:center;gap:10px;">';
      h += '<button type="button" id="scStreamPrev" style="background:none;border:none;color:var(--ink);font-size:16px;">⏮</button>';
      h += '<button type="button" id="scStreamPlay" style="background:var(--coral);border:none;color:#12030b;border-radius:999px;width:36px;height:36px;font-size:14px;">' + (scStreamState.playing ? '⏸' : '▶') + '</button>';
      h += '<button type="button" id="scStreamNextB" style="background:none;border:none;color:var(--ink);font-size:16px;">⏭</button>';
      h += '<span id="scStreamAt" style="font-size:10.5px;color:var(--ink-dim);font-variant-numeric:tabular-nums;"></span>';
      h += '</div></div>';
    }
    h += '<div id="scStreamSay" style="font-size:11px;color:var(--coral);min-height:14px;margin-top:8px;"></div>';
    if((pls || []).length){
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">';
      pls.forEach(function(p){
        h += '<button type="button" class="scs-pl" data-name="' + escapeHtml(String(p.name)) + '" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:4px 9px;font-size:10.5px;">' + escapeHtml(String(p.name)) + ' · ' + (p.ids || []).length + '</button>';
      });
      h += '</div>';
    }
    if((tracks || []).length){
      h += '<div style="margin-top:10px;">';
      tracks.forEach(function(t){
        var on = String(t.id) === String(scStreamState.curId);
        h += '<div style="display:flex;align-items:center;gap:8px;padding:7px 2px;border-top:1px solid var(--line);">'
          + '<button type="button" class="scs-play" data-id="' + escapeHtml(String(t.id)) + '" style="flex:1;min-width:0;text-align:left;background:none;border:none;color:' + (on ? 'var(--coral)' : 'var(--ink)') + ';font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
          + (on ? '▶ ' : '') + escapeHtml(t.title) + '</button>'
          + '<button type="button" class="scs-list" data-id="' + escapeHtml(String(t.id)) + '" title="Add to a streaming playlist" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;">＋</button>'
          + '<button type="button" class="scs-del" data-id="' + escapeHtml(String(t.id)) + '" title="Remove" style="border:none;background:none;color:var(--ink-dim);font-size:13px;">×</button>'
          + '</div>';
      });
      h += '</div>';
    } else {
      h += '<div style="font-size:11.5px;color:var(--ink-dim);margin-top:8px;">Nothing here yet — search for a song above and add it.</div>';
    }
    h += '</div>';
    h += '<div style="margin:0 20px 6px;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-dim);">Downloaded songs</div>';
    host.innerHTML = h;
    scStreamWire();
    scStreamTick();
  }

  function scStreamWire(){
    var host = document.getElementById('scStreamBlock');
    if(!host) return;
    function on(id, ev, fn){ var e = document.getElementById(id); if(e) e.addEventListener(ev, fn); }
    on('scStreamGo', 'click', function(){
      var i = document.getElementById('scStreamQuery');
      scStreamSearchRun(i ? i.value : '');
    });
    on('scStreamQuery', 'keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); scStreamSearchRun(this.value); } });
    on('scStreamNewPl', 'click', scStreamNewPlaylist);
    on('scStreamPlay', 'click', scStreamToggle);
    on('scStreamPrev', 'click', function(){ scStreamNext(-1); });
    on('scStreamNextB', 'click', function(){ scStreamNext(1); });
    on('scStreamBar', 'input', function(){ try{ scStreamAudio().currentTime = Number(this.value) || 0; }catch(_e){} });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-add'), function(b){
      b.addEventListener('click', function(){ scStreamAddResult((scStreamState.results || [])[Number(this.getAttribute('data-i'))]); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-play'), function(b){
      b.addEventListener('click', function(){ scStreamPlay(this.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-list'), function(b){
      b.addEventListener('click', function(){ scStreamToPlaylist(this.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-del'), function(b){
      b.addEventListener('click', function(){ scStreamRemove(this.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-pl'), function(b){
      b.addEventListener('click', function(){
        var name = this.getAttribute('data-name');
        var p = (scStreamState.playlists || []).filter(function(x){ return String(x.name) === name; })[0];
        if(!p || !(p.ids || []).length){ scStreamSay('That playlist is empty'); return; }
        scStreamPlay(p.ids[0], p.ids.slice());
      });
    });
  }

  function scStreamBoot(){
    if(!SC_STREAM_OK) return;                 // a Play build never even builds the block
    if(scStreamState.built) return;
    var host = document.getElementById('scStreamBlock');
    if(!host) return;                         // the library is not in the page yet
    scStreamState.built = true;
    scStreamLoad();
    scStreamRender();
  }

