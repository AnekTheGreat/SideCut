  // ─── 85.1.2 - A LADDER OF QUALITIES, AND A PICTURE THAT TURNS SIDEWAYS ──────
  // WHAT 85.1.1 COULD NOT DO. The player handed the tab one progressive stream
  // (itag 18, 360p) and that was the whole picture. The adaptive rows the same
  // answer carried - 480p, 720p, 1080p, 1440p, 2160p - were only ever fallbacks,
  // never a choice, so a music video stayed soft on a phone that could show it
  // sharp.
  //
  // THE LADDER IS BUILT FROM THE ANSWER, NOT FROM A LIST. Every video-only row is
  // grouped by the height it really is, the codec the WebView can open wins its
  // height (H.264 before VP9 before AV1), and a muxed row of the same height
  // beats both because it carries its own sound in one stream. The menu shows
  // only the sizes this video actually has.
  //
  // THE SOUND DOES NOT CHANGE OWNER WHEN THE PICTURE DOES. Above the one-stream
  // sizes the answer also carries the same video's audio as its own row. That row
  // plays in a second, hidden element while the picture is muted, and the picture
  // is nudged onto its clock: still the video's own recording, still not the
  // song. A stream with no audio row keeps the song as its soundtrack, exactly as
  // 85.1.1 left it.
  //
  // THE PICTURE CAN TURN SIDEWAYS. FULL was a fullscreen request on the <video>,
  // which took the app's own controls away with it. The landscape button makes
  // the stage full-bleed, asks the phone for fullscreen and landscape, and keeps
  // the transport, the quality list and the close button on the glass.
  //
  // NOT CLAIMED: 4K is whatever the video gives and the phone decodes. A refused
  // size falls back to the best one-stream size and says so. Nothing is
  // downloaded, nothing is kept, and no size above 64 MB is read into memory.

  var scVideoState = {
    open: false, busy: false, tick: null, cands: [], ci: 0,
    title: '', artist: '', videoId: '', pick: null, alts: [], alt: 0,
    blobUrl: '', via: '', audio: null, blocked: false, last: null,
    audioMode: 'song', songWasPlaying: false, startAt: null, resumeAt: null,
    rungs: [], rung: null, want: 0, wide: false
  };

  var SC_VQ_KEY = 'scVideoQuality';
  var SC_VQ_READ_MAX = 64 * 1024 * 1024;   // the byte reader is not a 4K decoder

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
  var SC_VICON_LAND = '<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">' +
    '<rect x="2.7" y="6.3" width="18.6" height="11.4" rx="2.4" fill="none" stroke="currentColor" stroke-width="1.6"/>' +
    '<path d="M9.7 9.5l4.5 2.5-4.5 2.5z" fill="currentColor"/></svg>';
  var SC_VICON_CHECK = '<svg class="sv-qc" viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">' +
    '<path d="M5 12.6l4.2 4.2L19 7.2" fill="none" stroke="currentColor" stroke-width="2.2" ' +
    'stroke-linecap="round" stroke-linejoin="round"/></svg>';

  // ── the ladder -------------------------------------------------------------
  function scVideoCanPlay(mime){
    try{
      if(!scVideoCanPlay.el){
        var v = scVideoEl('scVideoEl');
        scVideoCanPlay.el = v || (document.createElement ? document.createElement('video') : null);
      }
      var el = scVideoCanPlay.el;
      if(!el || typeof el.canPlayType !== 'function') return true;
      return !!el.canPlayType(String(mime || ''));
    }catch(_eCp){ return true; }
  }

  function scVideoCodec(mime){
    var mt = String(mime || '').toLowerCase();
    if(mt.indexOf('avc1') !== -1 || mt.indexOf('avc3') !== -1) return 'H.264';
    if(mt.indexOf('vp9') !== -1 || mt.indexOf('vp09') !== -1) return 'VP9';
    if(mt.indexOf('av01') !== -1) return 'AV1';
    return 'MP4';
  }
  function scVideoCodecRank(mime){
    var mt = String(mime || '').toLowerCase();
    if(mt.indexOf('avc1') !== -1 || mt.indexOf('avc3') !== -1) return 0;
    if(mt.indexOf('vp9') !== -1 || mt.indexOf('vp09') !== -1) return 1;
    if(mt.indexOf('av01') !== -1) return 2;
    return 3;
  }
  function scVideoHeight(f){
    var h = Number(f && f.height) || 0;
    if(h) return h;
    var m = String((f && f.qualityLabel) || '').match(/([0-9]{3,4})p/);
    return m ? (Number(m[1]) || 0) : 0;
  }
  function scVideoRungTag(h){
    h = Number(h) || 0;
    if(h >= 2160) return '4K';
    if(h >= 1440) return '2K';
    if(h >= 1080) return 'FULL HD';
    if(h >= 720) return 'HD';
    return 'SD';
  }
  function scVideoSnd(row){
    if(!row) return null;
    return { url: row.url || '', mime: row.mime || 'audio/mp4', size: Number(row.size) || 0 };
  }

  // One rung per height the answer really offers. Rows of the same height are
  // ordered: muxed first (own sound, one stream), then the codec most likely to
  // decode here, then the bigger bitrate. The runner-ups become the alternates a
  // refused stream falls through to.
  function scVideoLadder(muxed, adaptive, snd){
    var byH = {};
    function seat(row, isMux){
      var h = Number(row && row.h) || 0;
      if(!h || h < 144) return;
      var b = byH[h];
      if(!b){ b = byH[h] = { h: h, rows: [] }; }
      row.muxed = !!isMux;
      b.rows.push(row);
    }
    (muxed || []).forEach(function(r){ seat(r, true); });
    (adaptive || []).forEach(function(r){ seat(r, false); });
    var rungs = [];
    Object.keys(byH).forEach(function(k){
      var b = byH[k];
      b.rows.sort(function(x, y){
        if(!!x.muxed !== !!y.muxed) return (y.muxed ? 1 : 0) - (x.muxed ? 1 : 0);
        var c = scVideoCodecRank(x.mime) - scVideoCodecRank(y.mime);
        if(c) return c;
        return (Number(y.bits) || 0) - (Number(x.bits) || 0) || (Number(y.size) || 0) - (Number(x.size) || 0);
      });
      var top = null;
      for(var i = 0; i < b.rows.length; i++){
        if(!top && scVideoCanPlay(b.rows[i].mime)) top = b.rows[i];
      }
      if(!top) top = b.rows[0];
      var alts = [];
      for(var j = 0; j < b.rows.length && alts.length < 3; j++){
        if(b.rows[j] === top) continue;
        if(!scVideoCanPlay(b.rows[j].mime)) continue;
        alts.push({ url: b.rows[j].url, mime: b.rows[j].mime, size: b.rows[j].size });
      }
      rungs.push({
        h: b.h, label: b.h + 'p', tag: scVideoRungTag(b.h),
        url: top.url, mime: top.mime, size: Number(top.size) || 0,
        muxed: !!top.muxed, codec: scVideoCodec(top.mime), alts: alts,
        audioUrl: top.muxed ? '' : (snd ? snd.url : ''),
        audioMime: top.muxed ? '' : (snd ? snd.mime : ''),
        audioSize: top.muxed ? 0 : (snd ? snd.size : 0)
      });
    });
    rungs.sort(function(a, b){ return b.h - a.h; });
    return rungs;
  }

  // AUTO keeps 85.1.1's guarantee: the best stream that carries its own sound.
  function scVideoDefault(rungs){
    var use = rungs || [];
    for(var i = 0; i < use.length; i++){ if(use[i].muxed) return use[i]; }
    return use[0] || null;
  }
  function scVideoRungFor(rungs, want){
    var use = rungs || [];
    if(!use.length) return null;
    want = Number(want) || 0;
    if(!want) return scVideoDefault(use);
    var exact = null, below = null, above = null;
    for(var i = 0; i < use.length; i++){
      var r = use[i];
      if(r.h === want){ if(!exact) exact = r; }
      else if(r.h < want && (!below || r.h > below.h)) below = r;
      else if(r.h > want && (!above || r.h < above.h)) above = r;
    }
    return exact || below || above || use[0];
  }

  function scVideoPref(val){
    try{
      if(typeof localStorage === 'undefined' || !localStorage) return null;
      if(val === undefined) return localStorage.getItem(SC_VQ_KEY);
      if(val === null) localStorage.removeItem(SC_VQ_KEY);
      else localStorage.setItem(SC_VQ_KEY, String(val));
    }catch(_ePref){}
    return null;
  }
  function scVideoWant(){ return Number(scVideoPref()) || 0; }
  function scVideoWantSet(h){ scVideoPref(Number(h) > 0 ? Number(h) : 'auto'); }

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
      // The chip is a button now: the size the picture is at, and the way in to
      // every other size. Its chevron is drawn by the stylesheet so the label
      // can be replaced with a plain string.
      '#scVideoHead .sv-chip{display:inline-flex;align-items:center;gap:5px;font-family:"JetBrains Mono",monospace;',
      'font-size:9px;font-weight:700;letter-spacing:1px;color:var(--coral);cursor:pointer;',
      'border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);background:rgba(255,255,255,.04);',
      'border-radius:999px;padding:6px 9px;flex:0 0 auto;transition:transform .12s}',
      '#scVideoHead .sv-chip::after{content:"";width:5px;height:5px;border-right:1.5px solid currentColor;',
      'border-bottom:1.5px solid currentColor;transform:translateY(-1px) rotate(45deg);opacity:.85}',
      '#scVideoHead .sv-chip:active{transform:scale(.94)}',
      '#scVideoHead button{width:34px;height:34px;border-radius:999px;border:1px solid var(--line);',
      'background:rgba(255,255,255,.05);color:var(--ink-dim);font-size:14px;line-height:1;cursor:pointer;flex:0 0 auto}',
      '#scVideoHead button:active{transform:scale(.94)}',
      '#scVideoStage{position:relative;flex:1 1 auto;min-height:0;display:grid;place-items:center;border-radius:18px;',
      'overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 60px rgba(0,0,0,.55);',
      'touch-action:manipulation}',
      '#scVideoEl{max-width:100%;max-height:100%;width:auto;height:auto;background:#000;display:block}',
      '#scVideoAuxEl{display:none}',
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
      // The quality list. A frosted card that opens above the transport, so the
      // picture is never covered by the thing that describes it.
      '#scVideoQ{position:absolute;right:9px;bottom:66px;z-index:6;width:min(278px, calc(100% - 18px));display:none;',
      'box-sizing:border-box;padding:8px;border-radius:16px;border:1px solid rgba(255,255,255,.14);',
      'background:rgba(8,18,18,.93);-webkit-backdrop-filter:blur(18px);backdrop-filter:blur(18px);',
      'box-shadow:0 22px 50px rgba(0,0,0,.55);max-height:min(60%,340px);overflow:auto}',
      '#scVideoQ.on{display:block;animation:scVqIn .16s ease-out}',
      '@keyframes scVqIn{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}',
      '#scVideoQ .sv-qh{font-size:9px;letter-spacing:1.4px;color:var(--ink-dim);padding:2px 8px 7px;font-weight:700}',
      '#scVideoQList{display:flex;flex-direction:column;gap:2px}',
      '.sv-qr{display:grid;grid-template-columns:1fr auto;grid-template-areas:"t c" "s c";text-align:left;gap:0 8px;',
      'border:0;background:transparent;border-radius:11px;padding:8px 9px;color:var(--ink);cursor:pointer;',
      'font-family:inherit;width:100%}',
      '.sv-qr b{grid-area:t;font-size:13px;font-weight:650;letter-spacing:.2px;line-height:1.2}',
      '.sv-qr i{grid-area:s;font-style:normal;font-size:9.5px;color:var(--ink-dim);margin-top:3px;line-height:1.3}',
      '.sv-qr .sv-qc{grid-area:c;align-self:center;color:var(--coral);display:none}',
      '.sv-qr.cur{background:color-mix(in srgb, var(--coral) 14%, transparent)}',
      '.sv-qr.cur .sv-qc{display:block}',
      '.sv-qr.cur b{color:var(--coral)}',
      '.sv-qr:active{transform:scale(.99)}',
      '#scVideoQ .sv-qn{padding:8px 8px 2px;font-size:9px;line-height:1.45;color:var(--ink-dim);opacity:.82;',
      'border-top:1px solid rgba(255,255,255,.07);margin-top:6px;display:none}',
      '#scVideoCtl{position:absolute;left:9px;right:9px;bottom:9px;display:flex;align-items:center;gap:10px;',
      'box-sizing:border-box;padding:7px 10px 7px 7px;border-radius:999px;border:1px solid rgba(255,255,255,.13);',
      'background:rgba(6,14,14,.72);-webkit-backdrop-filter:blur(14px);backdrop-filter:blur(14px);z-index:4}',
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
      '#scVideoCtl .sv-icon{width:34px;padding:0;display:grid;place-items:center}',
      '#scVideoCtl .sv-icon.on{color:var(--coral);border-color:color-mix(in srgb, var(--coral) 55%, transparent);',
      'background:color-mix(in srgb, var(--coral) 14%, transparent)}',
      '#scVideoFoot{padding:9px 6px 0;font-size:10px;line-height:1.4;color:var(--ink-dim);opacity:.85;',
      'white-space:nowrap;overflow:hidden;text-overflow:ellipsis}',
      // Landscape. The stage takes the glass, the header becomes a floating row
      // over the picture, and the transport stays where a thumb expects it.
      '#scVideoBackdrop.sc-vwide{padding:0;background:#000;background-image:none}',
      '#scVideoBackdrop.sc-vwide #scVideoStage{position:fixed;inset:0;border:0;border-radius:0;box-shadow:none}',
      '#scVideoBackdrop.sc-vwide #scVideoEl{width:100%;height:100%;max-width:none;max-height:none;object-fit:contain}',
      '#scVideoBackdrop.sc-vwide #scVideoHead{position:absolute;z-index:7;top:calc(env(safe-area-inset-top) + 8px);',
      'left:calc(env(safe-area-inset-left) + 10px);right:calc(env(safe-area-inset-right) + 10px);padding:0}',
      '#scVideoBackdrop.sc-vwide #scVideoHead .sv-t{display:none}',
      '#scVideoBackdrop.sc-vwide #scVideoCtl{left:calc(env(safe-area-inset-left) + 14px);',
      'right:calc(env(safe-area-inset-right) + 14px);bottom:calc(env(safe-area-inset-bottom) + 12px)}',
      '#scVideoBackdrop.sc-vwide #scVideoQ{right:calc(env(safe-area-inset-right) + 14px);',
      'bottom:calc(env(safe-area-inset-bottom) + 70px);max-height:72%}',
      '#scVideoBackdrop.sc-vwide #scVideoFoot{display:none}',
      '#scVideoBackdrop.sc-vwide #scVideoSay{padding-bottom:78px}',
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
        '<button type="button" class="sv-chip" id="scVideoChip" style="display:none;" aria-label="Video quality">360p</button>' +
        '<button type="button" id="scVideoClose" title="Close" aria-label="Close">&#215;</button>' +
      '</div>' +
      '<div id="scVideoStage">' +
        '<video id="scVideoEl" playsinline webkit-playsinline preload="auto"></video>' +
        '<audio id="scVideoAuxEl" preload="auto"></audio>' +
        '<div id="scVideoSpin" aria-hidden="true"></div>' +
        '<button type="button" id="scVideoBig" aria-label="Play">' + SC_VICON_BIG + '</button>' +
        '<div id="scVideoSay"></div>' +
        '<div id="scVideoQ" role="dialog" aria-label="Video quality">' +
          '<div class="sv-qh">QUALITY</div>' +
          '<div id="scVideoQList"></div>' +
          '<div class="sv-qn" id="scVideoQNote"></div>' +
        '</div>' +
        '<div id="scVideoCtl">' +
          '<button type="button" id="scVideoPlay" class="paused" aria-label="Play">' + SC_VICON_PLAY + '</button>' +
          '<div id="scVideoProg"><div id="scVideoFill"></div></div>' +
          '<span id="scVideoClock">0:00 / 0:00</span>' +
          '<button type="button" id="scVideoNext" class="sv-mini" title="Try the next search result" style="display:none;">NEXT</button>' +
          '<button type="button" id="scVideoLand" class="sv-mini sv-icon" title="Landscape" aria-label="Landscape">' + SC_VICON_LAND + '</button>' +
        '</div>' +
      '</div>' +
      '<div id="scVideoFoot"></div>';
    document.body.appendChild(d);

    d.addEventListener('click', function(e){ if(e.target === d) scVideoClose(); });
    var c = scVideoEl('scVideoClose'); if(c) c.addEventListener('click', scVideoClose);
    var n = scVideoEl('scVideoNext'); if(n) n.addEventListener('click', function(e){ e.stopPropagation(); scVideoNext(); });
    var l = scVideoEl('scVideoLand'); if(l) l.addEventListener('click', function(e){ e.stopPropagation(); scVideoLandscape(); });
    var p = scVideoEl('scVideoPlay'); if(p) p.addEventListener('click', function(e){ e.stopPropagation(); scVideoTap(); });
    var b = scVideoEl('scVideoBig'); if(b) b.addEventListener('click', function(e){ e.stopPropagation(); scVideoTap(); });
    var chip = scVideoEl('scVideoChip'); if(chip) chip.addEventListener('click', function(e){ e.stopPropagation(); scVideoQualityToggle(); });
    var ql = scVideoEl('scVideoQList');
    if(ql) ql.addEventListener('click', function(e){
      var btn = (e.target && e.target.closest) ? e.target.closest('[data-h]') : null;
      if(!btn) return;
      e.stopPropagation();
      scVideoQualityChoose(Number(btn.getAttribute('data-h')) || 0);
    });
    var stage = scVideoEl('scVideoStage'); if(stage) stage.addEventListener('click', function(e){
      if(e.target && e.target.closest){
        if(e.target.closest('#scVideoCtl')) return;
        if(e.target.closest('#scVideoQ')) return;
        var q = scVideoEl('scVideoQ');
        if(q && q.classList.contains('on')){ scVideoQualityToggle(false); return; }
      }
      scVideoTap();
    });

    var v = scVideoEl('scVideoEl');
    if(v){
      v.addEventListener('playing', function(){
        scVideoState.blocked = false;
        scVideoBig(false); scVideoSpin(false); scVideoSay(''); scVideoBarState();
        if(scVideoState.audioMode === 'aux') scVideoAuxPlay();
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

  // One sound at a time: while the picture carries sound of its own - in the
  // stream, or in its own paired track - the song is paused, and the second it
  // stops is remembered so the song can be put back.
  function scVideoHoldSong(){
    var a = scVideoAudioEl();
    if(a && !a.paused){ scVideoState.songWasPlaying = true; }
    try{ if(a && !a.paused) a.pause(); }catch(_eHold){}
    try{ if(typeof audio !== 'undefined' && audio && !audio.paused) audio.pause(); }catch(_eD1){}
    try{ if(typeof audio2 !== 'undefined' && audio2 && !audio2.paused) audio2.pause(); }catch(_eD2){}
  }
  function scVideoReleaseSong(){
    if(scVideoState.audioMode === 'song'){ scVideoState.songWasPlaying = false; return; }
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
    var muxed = [], adaptive = [], sndRows = [], seen = {};
    function take(list, into, kind){
      (list || []).forEach(function(f){
        if(!f || !f.mimeType) return;
        var mt = String(f.mimeType).toLowerCase();
        if(mt.indexOf('mp4') === -1) return;
        if(kind === 'audio'){
          if(mt.indexOf('audio/') !== 0) return;
        } else {
          if(mt.indexOf('video/') !== 0) return;
          if(kind === 'muxed' && !/mp4a|opus|vorbis/.test(mt)) return;
        }
        var u = f.url || '';
        if(!u || seen[u]) return;
        var size = Number(f.contentLength || f.clen) || 0;
        if(size > 1200 * 1024 * 1024) return;      // nothing this tab will hold
        seen[u] = true;
        into.push({ url: u, mime: String(f.mimeType), itag: Number(f.itag) || 0, size: size,
                    h: scVideoHeight(f), bits: Number(f.bitrate) || 0 });
      });
    }
    function bestAudio(rows){
      rows.sort(function(x, y){
        var ax = /mp4a/i.test(x.mime) ? 0 : 1, ay = /mp4a/i.test(y.mime) ? 0 : 1;
        if(ax !== ay) return ax - ay;
        return (Number(y.bits) || 0) - (Number(x.bits) || 0);
      });
      return scVideoSnd(rows[0]);
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
        take(d.streamingData.formats, muxed, 'muxed');
        take(d.streamingData.adaptiveFormats, adaptive, 'video');
        take(d.streamingData.adaptiveFormats, sndRows, 'audio');
      });
      var snd = bestAudio(sndRows);
      var rungs = scVideoLadder(muxed, adaptive, snd);
      if(!rungs.length) return null;
      return { title: title, rungs: rungs, snd: snd,
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

  // ── the quality list -------------------------------------------------------
  function scVideoQualityToggle(force){
    var q = scVideoEl('scVideoQ');
    if(!q) return;
    var on = (typeof force === 'boolean') ? force : !q.classList.contains('on');
    q.classList.toggle('on', !!on);
    var chip = scVideoEl('scVideoChip');
    if(chip) chip.classList.toggle('on', !!on);
    if(on) scVideoQualityRender();
  }
  function scVideoQualityRow(rung, auto, cur){
    var h = auto ? 0 : rung.h;
    var title = auto ? 'AUTO' : rung.label;
    var sub = auto
      ? 'the best stream with its own sound'
      : rung.tag + ' \u00b7 ' + rung.codec + ' \u00b7 ' + Math.max(1, Math.round((rung.size || 0) / 1048576)) + ' MB' +
        (rung.muxed ? ' \u00b7 one stream' : (rung.audioUrl ? ' \u00b7 its own track' : ' \u00b7 song underneath'));
    return '<button type="button" class="sv-qr' + (cur ? ' cur' : '') + '" data-h="' + h + '"' +
      (cur ? ' aria-current="true"' : '') + '>' +
      '<b>' + title + '</b><i>' + sub + '</i>' + (cur ? SC_VICON_CHECK : '') + '</button>';
  }
  function scVideoQualityRender(){
    var list = scVideoEl('scVideoQList');
    if(!list) return;
    var rungs = scVideoState.rungs || [];
    var cur = scVideoState.rung;
    var auto = !scVideoState.want;
    var html = scVideoQualityRow(null, true, auto && !!cur);
    rungs.forEach(function(r){
      html += scVideoQualityRow(r, false, !!cur && cur.h === r.h);
    });
    list.innerHTML = html;
    var note = scVideoEl('scVideoQNote');
    if(note){
      var paired = false;
      rungs.forEach(function(r){ if(!r.muxed && r.audioUrl) paired = true; });
      note.style.display = paired ? '' : 'none';
      note.textContent = paired
        ? 'Above the one-stream sizes the picture and the same video soundtrack arrive as two streams and are played together.'
        : '';
    }
  }
  function scVideoQualityMark(){
    var r = scVideoState.rung;
    scVideoChip(r ? r.label : '');
    var chip = scVideoEl('scVideoChip');
    if(chip) chip.setAttribute('aria-label', r ? 'Video quality: ' + r.label : 'Video quality');
  }
  function scVideoQualityChoose(h){
    scVideoQualityToggle(false);
    scVideoWantSet(h);
    scVideoState.want = Number(h) || 0;
    var r = scVideoRungFor(scVideoState.rungs, h);
    if(!r) return;
    if(scVideoState.rung && r.h === scVideoState.rung.h){ scVideoQualityMark(); return; }
    scVideoApplyRung(r, true);
  }

  // ── playback ---------------------------------------------------------------
  function scVideoApplyRung(rung, keep){
    var v = scVideoEl('scVideoEl');
    if(!rung) return false;
    var at = (keep && v && v.src) ? (Number(v.currentTime) || 0) : null;
    scVideoState.rung = rung;
    scVideoState.pick = { url: rung.url, mime: rung.mime, size: rung.size };
    scVideoState.alts = (rung.alts || []).slice();
    scVideoState.alt = 0;
    scVideoState.audioMode = rung.muxed ? 'video' : (rung.audioUrl ? 'aux' : 'song');
    scVideoState.resumeAt = at;
    scVideoQualityMark();
    scVideoFoot(rung.muxed
      ? 'This stream carries its own sound - the song waits where you left it.'
      : (rung.audioUrl
        ? 'The picture and the same video soundtrack are two streams, played together.'
        : 'No audio in this stream - the song plays under the picture.'));
    scVideoAttach(rung.url, 'direct');
    return true;
  }

  function scVideoAttach(src, via){
    var v = scVideoEl('scVideoEl');
    if(!v || !src) return;
    var mode = scVideoState.audioMode;
    scVideoState.via = via;
    scVideoState.blocked = false;
    scVideoState.audio = scVideoAudioEl();
    var start = scVideoState.resumeAt;
    if(start == null) start = (mode === 'song') ? null : scVideoSongTime();
    scVideoState.startAt = start;
    scVideoState.resumeAt = null;
    scVideoAuxPause();
    try{ v.removeAttribute('src'); }catch(_eRm){}
    v.src = src;
    v.muted = (mode !== 'video');          // a paired track is the sound in aux mode
    try{ v.volume = 1; }catch(_eVol){}
    if(mode === 'video' || mode === 'aux') scVideoHoldSong();
    if(mode === 'aux') scVideoAuxSet(start);
    try{ v.load(); }catch(_eLoad){}
    scVideoBig(false);
    scVideoSpin(true);
    scVideoSay('Starting the video…');
    scVideoPlayAttempt();
  }

  // The soundtrack of a high rung: the same video's own audio row, in its own
  // element, muted into the picture's clock rather than the song's.
  function scVideoAuxSet(at){
    var a = scVideoEl('scVideoAuxEl');
    var r = scVideoState.rung;
    if(!a) return;
    try{ a.pause(); }catch(_eAp){}
    try{ a.removeAttribute('src'); }catch(_eAr){}
    try{ a.muted = false; a.volume = 1; }catch(_eAv){}
    if(!r || !r.audioUrl) return;
    try{ a.src = r.audioUrl; }catch(_eSrc){ return; }
    try{ if(at != null) a.currentTime = Number(at) || 0; }catch(_eAt){}
    try{ a.load(); }catch(_eAl){}
  }
  function scVideoAuxPause(){
    var a = scVideoEl('scVideoAuxEl');
    if(a){ try{ a.pause(); }catch(_eAx){} }
  }
  function scVideoAuxPlay(){
    var a = scVideoEl('scVideoAuxEl'), v = scVideoEl('scVideoEl');
    if(!a || !a.src) return;
    try{
      if(v && Math.abs((Number(a.currentTime) || 0) - (Number(v.currentTime) || 0)) > 0.25){
        a.currentTime = Number(v.currentTime) || 0;
      }
    }catch(_eAse){}
    var p = null;
    try{ p = a.play(); }catch(_eApl){ p = null; }
    if(p && p.catch) p.catch(function(){ scVideoAuxFallBack(); });
  }
  function scVideoAuxFallBack(){
    if(scVideoState.audioMode !== 'aux') return;
    scVideoState.audioMode = 'song';
    var v = scVideoEl('scVideoEl'), a = scVideoAudioEl();
    try{
      if(a){
        a.currentTime = v ? (Number(v.currentTime) || 0) : 0;
        var p = a.play(); if(p && p.catch) p.catch(function(){});
      }
    }catch(_eAf){}
    try{ if(v) v.muted = true; }catch(_eAm){}
    scVideoFoot('This stream refused its own soundtrack - the song plays under the picture.');
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
        if(scVideoState.audioMode === 'aux') scVideoAuxPlay();
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
      // The picture is the sound in video and aux mode; the song is only started
      // when the stream had no audio of its own.
      if(scVideoState.audioMode === 'song') scVideoSong(true); else scVideoHoldSong();
      scVideoPlayAttempt();
      scVideoSpin(true);
      scVideoBig(false);
    } else {
      try{ v.pause(); }catch(_eP){}
      if(scVideoState.audioMode === 'song') scVideoSong(false);
      scVideoAuxPause();
      scVideoBig(true);
      scVideoBarState();
    }
  }

  function scVideoSync(force){
    var v = scVideoEl('scVideoEl');
    if(!v || !v.src) return;
    // A paired track is the clock: the picture is nudged onto it, not the song.
    if(scVideoState.audioMode === 'aux'){
      var s = scVideoEl('scVideoAuxEl');
      if(s && s.src && !v.paused && s.readyState >= 1){
        var d = (Number(s.currentTime) || 0) - (Number(v.currentTime) || 0);
        if(Math.abs(d) > 0.35){ try{ v.currentTime = Number(s.currentTime) || 0; }catch(_eSync){ } }
      }
      scVideoClock();
      return;
    }
    var a = scVideoState.audio || scVideoAudioEl();
    // THE VIDEO'S AUDIO IS THE SOUND: there is nothing to line up with the song.
    if(scVideoState.audioMode === 'video'){ scVideoClock(); return; }
    if(!a || v.readyState < 1) return;
    scVideoState.audio = a;
    try{
      var at = Number(a.currentTime) || 0;
      var vt = Number(v.currentTime) || 0;
      if(force || Math.abs(vt - at) > 1.5){ try{ v.currentTime = at; }catch(_eSeek){} }
      if(a.paused){ if(!v.paused){ try{ v.pause(); }catch(_ePause){} } }
      else if(v.paused && !scVideoState.blocked){ scVideoPlayAttempt(); }
    }catch(_eSync2){}
    scVideoClock();
  }
  function scVideoTickStart(){
    scVideoTickStop();
    scVideoState.tick = setInterval(function(){
      if(!scVideoState.open) return;
      scVideoSync(false);
    }, scVideoState.audioMode === 'aux' ? 600 : 900);
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
    // Another codec at the same height, first: the size the owner asked for is
    // worth one more stream before it is given up on.
    var alts = scVideoState.alts || [];
    if(scVideoState.alt < alts.length && scVideoState.alt < 2){
      var next = alts[scVideoState.alt++];
      scVideoSay('That stream refused it (' + why + '). Trying another…');
      scVideoAttach(next.url, 'direct');
      return;
    }
    // Then the honest fallback: the best size that carries its own sound.
    var def = scVideoDefault(scVideoState.rungs);
    if(def && scVideoState.rung && def.h !== scVideoState.rung.h){
      scVideoState.want = 0;
      scVideoApplyRung(def, true);
      // On the footer, not the transient line: a playing picture clears that one
      // the moment it starts, and this fallback is the thing worth knowing.
      scVideoFoot('This size did not play here (' + why + '). Now at ' + def.label + '.');
      return;
    }
    if(scVideoState.via === 'direct'){
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
    if(Number(c.size) > SC_VQ_READ_MAX){
      scVideoSpin(false); scVideoBig(true);
      scVideoSay('This size (' + Math.round(Number(c.size) / 1048576) + ' MB) is too large to read into memory. Pick a smaller size, or NEXT for another result.');
      return;
    }
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
    scVideoAuxPause();
    scVideoTickStop();
    scVideoQualityToggle(false);
    scVideoTitle(cand.title || 'Music video', cand.owner || '');
    scVideoChip('');
    scVideoFoot('');
    scVideoBig(false);
    scVideoSpin(true);
    scVideoSay('Looking for the video…');
    scVideoClock();
    scVideoState.busy = true;
    scVideoState.alt = 0;
    scVideoState.rungs = [];
    scVideoState.rung = null;
    scVideoState.resumeAt = null;
    scVideoState.want = scVideoWant();
    return scVideoPlayer(cand.videoId).then(function(r){
      scVideoState.busy = false;
      if(!r || !r.rungs || !r.rungs.length){
        scVideoSpin(false); scVideoSay('This one has no stream the app can reach. NEXT tries another result.');
        return false;
      }
      scVideoState.rungs = r.rungs;
      var rung = scVideoRungFor(r.rungs, scVideoState.want);
      if(r.title) scVideoTitle(r.title, cand.owner || '');
      scVideoApplyRung(rung, false);
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
      scVideoFoot('Matched by length \u00b7 ' + cands.length + ' result' + (cands.length === 1 ? '' : 's') + (cands.length > 1 ? ' \u00b7 NEXT for another' : ''));
      return scVideoLoad(cands[0]);
    });
  }

  function scVideoNext(){
    var c = scVideoState.cands || [];
    if(c.length < 2) return;
    scVideoState.ci = (scVideoState.ci + 1) % c.length;
    scVideoLoad(c[scVideoState.ci]);
  }

  // ── landscape --------------------------------------------------------------
  function scVideoLandMark(on){
    var b = scVideoEl('scVideoLand');
    if(!b) return;
    b.classList.toggle('on', !!on);
    b.setAttribute('aria-label', on ? 'Portrait' : 'Landscape');
    b.title = on ? 'Back to portrait' : 'Landscape';
  }
  function scVideoWide(on){
    var d = scVideoEl('scVideoBackdrop');
    if(!d) return;
    scVideoState.wide = !!on;
    d.classList.toggle('sc-vwide', !!on);
    scVideoLandMark(on);
    if(on){
      try{
        var p = d.requestFullscreen ? d.requestFullscreen() : null;
        var lock = function(){
          try{
            if(typeof screen !== 'undefined' && screen && screen.orientation && screen.orientation.lock){
              var q = screen.orientation.lock('landscape');
              if(q && q.catch) q.catch(function(){});
            }
          }catch(_eLk){}
        };
        if(p && p.then) p.then(lock).catch(function(){});
        else lock();
      }catch(_eFs){}
    } else {
      try{
        if(document.fullscreenElement && document.exitFullscreen) document.exitFullscreen();
        else if(document.webkitFullscreenElement && document.webkitExitFullscreen) document.webkitExitFullscreen();
      }catch(_eFx){}
      try{
        if(typeof screen !== 'undefined' && screen && screen.orientation && screen.orientation.unlock) screen.orientation.unlock();
      }catch(_eUl){}
    }
  }
  function scVideoLandscape(){ scVideoWide(!scVideoState.wide); }

  function scVideoClose(){
    scVideoState.open = false;
    scVideoTickStop();
    scVideoWide(false);
    scVideoQualityToggle(false);
    var d = scVideoEl('scVideoBackdrop');
    if(d) d.classList.remove('on');
    try{ document.body.classList.remove('sc-video-open'); }catch(_eCls){}
    var v = scVideoEl('scVideoEl');
    if(v){
      try{ v.pause(); }catch(_ePause){}
      try{ v.removeAttribute('src'); v.load(); }catch(_eClear){}
    }
    scVideoAuxPause();
    var a = scVideoEl('scVideoAuxEl');
    if(a){ try{ a.removeAttribute('src'); a.load(); }catch(_eAuxClr){} }
    // The song picks up where the video stopped, so the tab is a detour.
    scVideoReleaseSong();
    try{ if(scVideoState.blobUrl) URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eRev2){}
    scVideoState.blobUrl = '';
    scVideoState.pick = null;
    scVideoState.alts = [];
    scVideoState.rungs = [];
    scVideoState.rung = null;
    scVideoState.resumeAt = null;
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
