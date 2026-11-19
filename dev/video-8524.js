  // ─── 85.2.4 - AN ERROR FOR A SOURCE THAT IS GONE IS NOT A REFUSAL ─────────────
  // WHAT 85.2.3 STILL GOT WRONG. Every `error` event was read as the size being
  // refused. A size change aborts the load that was running, and that abort can
  // arrive as an `error` **after** the new source is attached and the element has
  // already cleared `media.error` - so the handler ran with no `MediaError` at
  // all, and walking the ladder on it took the picture 1080p to 720p to 360p on
  // the click that asked for 1080p. That is the flip-flop the owner kept seeing.
  //
  // AN ERROR IS ONLY AN ERROR IF THE ELEMENT SAYS SO. A failure now needs a real
  // `MediaError` on the element, and it has to belong to the source that is
  // attached: an event for a source that has already been replaced is dropped.
  // The one caller allowed to act without a `MediaError` is the silent-source
  // watch, which passes `true` because it is looking at the element directly. If
  // a size is refused for real, the footer names the size and the codec that
  // refused it, so the next report says exactly which row this phone could not
  // open instead of only which one it landed on.
  // ─── 85.2.3 - A BUSY SIGNAL IS NOT A REFUSAL ─────────────────────────────────
  // WHAT 85.2.2 STILL GOT WRONG. The tab could fall from 1080p to 360p for two
  // reasons that are not a refusal. One: a dropped connection arrives as a media
  // error like any other, and the road treated it as the size being wrong - so a
  // signal that was busy for a second demoted the picture, and the step after the
  // first demotion is the 360p row. Two: the nine-second "nothing started" watch
  // was written for the smallest row and called a 1080p picture dead while it was
  // still fetching the bytes it needs, so a slow start walked the ladder down.
  //
  // A DROP RETRIES, A REFUSAL STEPS DOWN. A network error - or an abort on a
  // source that has been attached for a while - now restarts the same source at
  // the same second, once, and never changes the size; only the phone actually
  // refusing the picture (codes 3 and 4) walks one step down. The watch is
  // scaled to the size and asks whether bytes are still arriving: a source that
  // is buffering, or that the element is still loading, gets more time instead of
  // a smaller picture. 1080p stays 1080p through a bad minute, which is what the
  // default is worth.
  // ─── 85.2.2 - FULL HD BY DEFAULT, AND ONE STEP DOWN ────────────────────────
  // WHAT 85.2.1 LEFT UNFINISHED. The tab opened on AUTO, and AUTO is the best
  // row that carries its own sound - which on most videos is the 360p
  // progressive row a phone is handed. Every sharper size was in the list and
  // nothing said so, so the first picture a viewer saw was the softest one the
  // video had. The other half was a cliff: a sharp size this phone refused fell
  // straight to that same 360p row, so one refused 1080p cost the 720p picture
  // as well.
  //
  // FULL HD UNLESS YOU SAY OTHERWISE. A viewer who has never opened the list
  // gets 1080p - the sharpest size that still plays on a phone - or the largest
  // size under it when a video has no 1080p, with the list saying which. AUTO is
  // still a choice, a size that was chosen is still kept for the next video, and
  // a refused size steps down one size before it gives up: 1080p refused becomes
  // 720p, not 360p. The 85.2.1 sound lock is untouched - the picture is the
  // clock, its own voice follows it, and only one thing is audible at a time.
  // ─── 85.2.1 - ONE SOUND, AND THE FRAME IS THE CLOCK ─────────────────────────
  // WHAT 85.2.0 LEFT WRONG. A high size is the video's picture plus the same
  // video's own soundtrack in a second element, and that element was allowed to
  // start the moment it was ready - which is usually before the first frame. The
  // head start it took, it kept: a few tenths of a second of sound over a picture
  // that never caught up, because 85.2.0 only pulled it back when it was more than
  // half a second out. Two clocks running a fraction of a percent apart do the
  // rest. What you heard was the video's sound, and it was late or early, and it
  // stayed that way.
  //
  // ONE SOUND, AND IT IS THE PICTURE'S. Three things can be heard here - the
  // picture, its paired soundtrack, and the song - and exactly one of them is
  // audible at a time. The tab says which one owns the sound in a flag the rest of
  // the app can read, because the song was being restarted underneath the film by
  // the app's own background recovery: the thirty-second heartbeat brings a paused
  // song back, and so does a return from the background, and neither knew the
  // video was playing. A song that starts under the film is stopped again.
  //
  // THE FRAME IS THE CLOCK, AND THE VOICE FOLLOWS IT. The soundtrack waits for the
  // picture to be playing, starts on the picture's second, is held to a tenth of a
  // second by trimming its rate rather than jumping it back, and is jumped only on
  // a real gap - a buffer, a seek, a size change. A picture that pauses or stops
  // to think takes its voice with it, so the sound cannot run on ahead of a still
  // frame. Native seeks, the progress line and a size change all move both.
  //
  // WHAT 85.2.0 SHIPPED IS UNTOUCHED OTHERWISE: a size change holds its second,
  // the picture is the clock in every size, a refused size falls back with a line
  // saying which, the landscape transport steps aside after two seconds, and the
  // progress line is a handle.
  // WHAT 85.1.2 COULD NOT DO. A size change attached both the picture and the
  // paired soundtrack at zero, and it asked the soundtrack to start there before
  // that element had a duration - which a phone ignores. So the soundtrack began
  // at 0:00 while the picture was two minutes in, the picture was then nudged
  // onto that clock (85.1.2 made the soundtrack the clock), and the film - and
  // the song that follows it out of the tab - restarted from the beginning.
  //
  // THE PICTURE IS THE CLOCK NOW. A second the element is not ready for is kept
  // on the element and applied the moment it knows its own duration, for the
  // picture and for its soundtrack both. The soundtrack is nudged onto the
  // picture, never the other way round, because a backwards seek in the picture
  // is the thing you can see. A change made while the picture is paused stays
  // paused, and the swap no longer clears the element first, so a size change is
  // not a black flash either.
  //
  // A SIZE THAT NEVER STARTS IS NOT A BLACK PANEL. If nothing has played nine
  // seconds after a size is attached, the tab walks the same road a refusal
  // takes: another codec at that height, then the best one-stream size, and the
  // footer says which. A size the phone cannot open no longer forgets the size
  // the owner chose.
  //
  // THE TRANSPORT STEPS ASIDE IN LANDSCAPE. Two seconds after the last touch the
  // transport, the title row and the size chip fade off the glass, and a tap on
  // the picture brings them back without stopping the film. The progress line is
  // a handle: a two-centimetre touch area, a dot, and a drag to any second that
  // moves the picture, its soundtrack and the song underneath together.
  //
  // WHAT THE LADDER AND THE ORIENTATION DID IN 85.1.2 IS UNTOUCHED. AUTO is still
  // the best one-stream size, the choice is still remembered, a refused size still
  // falls back with a line saying so, and the landscape button still turns the
  // stage rather than the browser's own player.
  //
  // NOT CLAIMED: 4K is whatever the video gives and the phone decodes. Nothing is
  // downloaded, nothing is kept, and no size above 64 MB is read into memory. A
  // paired soundtrack is still two elements, so this is a lock, not a mux.

  var scVideoState = {
    open: false, busy: false, tick: null, cands: [], ci: 0,
    title: '', artist: '', videoId: '', pick: null, alts: [], alt: 0,
    blobUrl: '', via: '', audio: null, blocked: false, last: null,
    audioMode: 'song', songWasPlaying: false, startAt: null, resumeAt: null,
    rungs: [], rung: null, want: 0, wide: false,
    wasPlaying: true, posing: false, watch: null, watchToken: 0, swapAt: 0, owns: false,
    idle: null, idleOn: false, scrubbing: false, scrubFrac: null, drops: 0, retries: 0, srcNow: ''
  };

  var SC_VQ_KEY = 'scVideoQuality';
  var SC_VQ_DEFAULT = 1080;                // a viewer who has never chosen gets FULL HD
  var SC_VQ_READ_MAX = 64 * 1024 * 1024;   // the byte reader is not a 4K decoder
  var SC_VQ_IDLE_MS = 2000;                // the transport rests two seconds into landscape
  var SC_VQ_WATCH_MS = 9000;               // how long a silent source gets, before its weight
  var SC_VQ_WATCH_PER_MB = 300;            // and this much more for every megabyte it fetches

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
  // The rung directly under this one, for a refusal that should not cost the
  // whole picture: 1080p refused is a 720p picture, not a 360p one.
  function scVideoRungBelow(rungs, h){
    var best = null;
    (rungs || []).forEach(function(r){
      if(!r || !r.h || r.h >= h) return;
      if(!best || r.h > best.h) best = r;
    });
    return best;
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
  // FULL HD UNLESS A CHOICE WAS MADE. Nothing stored means this viewer has never
  // opened the size list, and the answer is the sharpest common size rather than
  // the softest one that happens to carry its own sound. A stored zero is AUTO,
  // which was a choice, and is kept as one.
  function scVideoWant(){
    var raw = scVideoPref();
    if(raw === null || raw === '') return SC_VQ_DEFAULT;
    var h = Number(raw) || 0;
    return h > 0 ? h : 0;
  }
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
      '#scVideoHead .sv-chip{display:inline-flex;align-items:center;gap:5px;width:auto;height:auto;font-family:"JetBrains Mono",monospace;',
      'font-size:9px;font-weight:700;letter-spacing:1px;color:var(--coral);cursor:pointer;',
      'border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);background:rgba(255,255,255,.04);',
      'border-radius:999px;padding:6px 9px;flex:0 0 auto;transition:transform .12s}',
      '#scVideoHead .sv-chip::after{content:"";width:5px;height:5px;border-right:1.5px solid currentColor;',
      'border-bottom:1.5px solid currentColor;transform:translateY(-1px) rotate(45deg);opacity:.85}',
      '#scVideoHead .sv-chip.on::after{transform:translateY(1px) rotate(-135deg)}',
      '#scVideoHead .sv-chip:active{transform:scale(.94)}',
      '#scVideoHead button{width:34px;height:34px;border-radius:999px;border:1px solid var(--line);',
      'background:rgba(255,255,255,.05);color:var(--ink-dim);font-size:14px;line-height:1;cursor:pointer;flex:0 0 auto}',
      '#scVideoHead button:active{transform:scale(.94)}',
      '#scVideoStage{position:relative;flex:1 1 auto;min-height:0;display:grid;place-items:center;border-radius:18px;',
      'overflow:hidden;background:#000;border:1px solid rgba(255,255,255,.09);box-shadow:0 24px 60px rgba(0,0,0,.55);',
      'touch-action:manipulation}',
      '#scVideoEl{max-width:100%;max-height:100%;width:auto;height:auto;background:#000;display:block}',
      '#scVideoAuxEl{position:absolute;left:0;top:0;width:1px;height:1px;opacity:0;pointer-events:none;border:0}',
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
      // The progress line is a handle: a 26px touch area around a 4px line, a dot
      // that says where the finger is, and no width transition while dragging.
      '#scVideoProg{position:relative;flex:1 1 auto;min-width:44px;height:4px;border-radius:999px;margin:9px 0;',
      'background:rgba(255,255,255,.18);cursor:pointer;touch-action:none}',
      '#scVideoProg::before{content:"";position:absolute;left:-6px;right:-6px;top:-11px;bottom:-11px;border-radius:999px}',
      '#scVideoFill{position:absolute;top:0;bottom:0;left:0;width:0;border-radius:999px;background:var(--coral);',
      'transition:width .25s linear;pointer-events:none}',
      '#scVideoProg.sc-vseek #scVideoFill{transition:none}',
      '#scVideoThumb{position:absolute;top:50%;left:0;width:11px;height:11px;margin:-5.5px 0 0 -5.5px;border-radius:999px;',
      'background:#fff;opacity:.82;box-shadow:0 1px 5px rgba(0,0,0,.55);transition:opacity .2s,transform .14s;pointer-events:none}',
      '#scVideoProg.sc-vseek #scVideoThumb{opacity:1;transform:scale(1.28)}',
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
      'left:calc(env(safe-area-inset-left) + 10px);right:calc(env(safe-area-inset-right) + 10px);padding:0;justify-content:flex-end}',
      '#scVideoBackdrop.sc-vwide #scVideoHead .sv-t{display:none}',
      '#scVideoBackdrop.sc-vwide #scVideoCtl{left:calc(env(safe-area-inset-left) + 14px);',
      'right:calc(env(safe-area-inset-right) + 14px);bottom:calc(env(safe-area-inset-bottom) + 12px)}',
      '#scVideoBackdrop.sc-vwide #scVideoQ{right:calc(env(safe-area-inset-right) + 14px);',
      'bottom:calc(env(safe-area-inset-bottom) + 70px);max-height:72%}',
      '#scVideoBackdrop.sc-vwide #scVideoFoot{display:none}',
      '#scVideoBackdrop.sc-vwide #scVideoSay{padding-bottom:78px}',
      // The scrim under the transport, so the line reads over a bright shot.
      '#scVideoBackdrop.sc-vwide #scVideoStage::after{content:"";position:absolute;left:0;right:0;bottom:0;height:132px;',
      'pointer-events:none;z-index:2;transition:opacity .32s ease;',
      'background:linear-gradient(0deg, rgba(0,0,0,.62), rgba(0,0,0,.22) 46%, transparent)}',
      // Idle. Two seconds after the last touch the transport, the title row and
      // the size chip leave the glass together, and a tap brings them back.
      '#scVideoBackdrop.sc-vwide #scVideoHead,#scVideoBackdrop.sc-vwide #scVideoCtl{',
      'transition:opacity .32s ease,transform .32s ease}',
      '#scVideoBackdrop.sc-vwide.sc-vidle #scVideoHead{opacity:0;pointer-events:none;transform:translateY(-8px)}',
      '#scVideoBackdrop.sc-vwide.sc-vidle #scVideoCtl{opacity:0;pointer-events:none;transform:translateY(10px)}',
      '#scVideoBackdrop.sc-vwide.sc-vidle #scVideoStage::after{opacity:0}',
      '#scVideoBackdrop.sc-vwide.sc-vidle #scVideoQ{display:none}',
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
          '<div id="scVideoProg" role="slider" tabindex="0" aria-label="Seek">' +
            '<div id="scVideoFill"></div><div id="scVideoThumb"></div></div>' +
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
        if(e.target.closest('#scVideoCtl')){ scVideoIdleWake(); return; }
        if(e.target.closest('#scVideoQ')){
          if(!e.target.closest('.sv-qr')) scVideoQualityToggle(false);
          scVideoIdleWake();
          return;
        }
      }
      // IN LANDSCAPE THE FIRST TAP BRINGS THE CONTROLS BACK. It does not also stop
      // the film the controls were hiding - that is what the round button is for.
      if(scVideoIdleWake()) return;
      var q = scVideoEl('scVideoQ');
      if(q && q.classList.contains('on')){ scVideoQualityToggle(false); return; }
      scVideoTap();
    });
    // A touch anywhere wakes the transport; in landscape the two-second walk off
    // the glass starts again from that touch.
    d.addEventListener('pointerdown', function(){ scVideoIdleWake(); }, true);
    scVideoWireSeek();

    var v = scVideoEl('scVideoEl');
    if(v){
      v.addEventListener('playing', function(){
        scVideoState.blocked = false;
        scVideoWatchStop();
        scVideoBig(false); scVideoSpin(false); scVideoSay(''); scVideoBarState();
        if(scVideoState.audioMode === 'aux') scVideoAuxPlay();
        scVideoIdleArm();
      });
      // A PAUSED PICTURE IS A SILENT ONE. The soundtrack is its voice, so it stops
      // with the frame instead of running on over a still.
      v.addEventListener('pause', function(){
        scVideoBarState(); scVideoIdleWake();
        scVideoAuxPause();
        if(!v.ended && !scVideoState.blocked) scVideoBig(true);
      });
      // A PICTURE THAT IS THINKING IS SILENT TOO. The voice used to keep running
      // while the frame waited for bytes, so it pulled ahead and then had to be
      // dragged back - a stutter you could hear.
      v.addEventListener('waiting', function(){ scVideoSpin(true); scVideoIdleWake(); scVideoAuxPause(); });
      v.addEventListener('stalled', function(){ scVideoSpin(true); scVideoAuxPause(); });
      // Any seek puts the voice on the frame's new second, however it was made.
      v.addEventListener('seeked', function(){ if(scVideoState.audioMode === 'aux') scVideoAuxAlign(); });
      v.addEventListener('canplay', function(){ scVideoSpin(false); scVideoWatchStop(); });
      v.addEventListener('timeupdate', scVideoClock);
      v.addEventListener('loadedmetadata', function(){
        scVideoSpin(false);
        // The picture starts where it was, so a size change is not a rewind.
        if(scVideoState.startAt != null){ scVideoPose(v, scVideoState.startAt); scVideoState.startAt = null; }
        scVideoPoseTry(v);
        scVideoClock();
      });
      v.addEventListener('ended', function(){ scVideoAuxPause(); scVideoBig(true); scVideoBarState(); scVideoIdleWake(); });
      v.addEventListener('error', scVideoFailed);
    }

    // The paired soundtrack of a high size has a clock of its own, so it is posed
    // the moment it knows its duration and unmuted only once it is on the
    // picture's second - never the other way round.
    var aux = scVideoEl('scVideoAuxEl');
    if(aux){
      aux.addEventListener('loadedmetadata', function(){ scVideoPoseTry(aux); });
      aux.addEventListener('canplay', function(){
        scVideoPoseTry(aux);
        if(scVideoState.audioMode !== 'aux') return;
        // THE PICTURE GOES FIRST. This used to start the soundtrack the moment it
        // was ready, which is usually before the first frame - and whatever head
        // start that took, it kept for the rest of the song.
        var pv = scVideoEl('scVideoEl');
        if(!pv || pv.paused || pv.readyState < 2) return;
        if(scVideoPosed(aux)) scVideoAuxPlay();
      });
      aux.addEventListener('error', function(){
        if(scVideoState.audioMode !== 'aux') return;
        scVideoAuxFallBack('the phone refused to open it');
      });
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
  function scVideoMMSS(n){
    n = Math.max(0, Math.floor(Number(n) || 0));
    return Math.floor(n / 60) + ':' + ('0' + (n % 60)).slice(-2);
  }
  function scVideoClock(){
    var v = scVideoEl('scVideoEl'), c = scVideoEl('scVideoClock'), f = scVideoEl('scVideoFill');
    var th = scVideoEl('scVideoThumb');
    var at = v ? (Number(v.currentTime) || 0) : 0;
    var dur = (v && isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    var frac = (scVideoState.scrubbing && scVideoState.scrubFrac != null)
      ? scVideoState.scrubFrac
      : (dur ? Math.min(1, Math.max(0, at / dur)) : 0);
    if(c){
      var shown = (scVideoState.scrubbing && dur) ? frac * dur : at;
      c.textContent = scVideoMMSS(shown) + ' / ' + (dur ? scVideoMMSS(dur) : '0:00');
      c.setAttribute('aria-label', c.textContent);
    }
    if(f && !scVideoState.scrubbing) f.style.width = (frac * 100) + '%';
    if(th && !scVideoState.scrubbing) th.style.left = (frac * 100) + '%';
    scVideoBarState();
  }

  // ── the second the picture is on --------------------------------------------
  // Setting `currentTime` on an element with no duration yet is ignored or refused
  // by most phones, and it is forgotten by `load()`. A target second is therefore
  // kept ON the element and applied the first time it is ready for it.
  function scVideoPose(el, at){
    if(!el) return;
    el.__scPose = (at == null) ? null : Math.max(0, Number(at) || 0);
    if(el.__scPose != null) scVideoPoseTry(el);
  }
  function scVideoPoseTry(el){
    if(!el) return true;
    var t = el.__scPose;
    if(t == null) return true;
    if(!(el.readyState >= 1)) return false;
    try{ el.currentTime = t; }catch(_ePose){ return false; }
    el.__scPose = null;
    return true;
  }
  function scVideoPosed(el){ return !el || el.__scPose == null; }

  // ── one sound, and every other one is silent --------------------------------
  // Three things can be heard in this tab: the picture (a size carrying its own
  // sound), its paired soundtrack (a high size), and the song (a size with no
  // audio row at all). Exactly one of them is audible, and the app is told which
  // so its own recovery paths cannot start a song under the film.
  function scVideoOwnSound(on){
    scVideoState.owns = !!on;
    try{ window.__scVideoSoundOwn = !!on; }catch(_eOwn){}
  }
  function scVideoMuteOthers(){
    var v = scVideoEl('scVideoEl'), a = scVideoEl('scVideoAuxEl');
    var mode = scVideoState.audioMode;
    if(v && mode !== 'video' && !v.muted){ try{ v.muted = true; }catch(_eMo1){} }
    if(a && mode !== 'aux' && !a.muted){ try{ a.muted = true; }catch(_eMo2){} }
  }
  // Puts the voice on the frame's second when the frame moves for a reason this
  // module did not perform itself - a native seek, a size change, a dropped buffer.
  function scVideoAuxAlign(){
    var a = scVideoEl('scVideoAuxEl'), v = scVideoEl('scVideoEl');
    if(!a || !a.src || !v || a.readyState < 1) return false;
    var vt = Number(v.currentTime) || 0;
    if(Math.abs((Number(a.currentTime) || 0) - vt) > 0.05){
      try{ a.currentTime = vt; }catch(_eAlign){ return false; }
    }
    try{ if(a.playbackRate !== 1) a.playbackRate = 1; }catch(_eRate){}
    return true;
  }

  function scVideoSeekTo(sec, fromScrub){
    var v = scVideoEl('scVideoEl');
    if(!v || !v.src) return;
    var dur = (isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
    var at = Math.max(0, Number(sec) || 0);
    if(dur) at = Math.min(at, Math.max(0, dur - 0.3));
    try{ v.currentTime = at; }catch(_eS1){}
    if(scVideoState.audioMode === 'aux'){
      var s = scVideoEl('scVideoAuxEl');
      if(!s || !s.src){}
      else if(s.readyState >= 1){ try{ s.currentTime = at; }catch(_eS2){} try{ s.playbackRate = 1; }catch(_eSr){} }
      else scVideoPose(s, at);
    }
    if(scVideoState.audioMode === 'song'){
      var a = scVideoAudioEl();
      try{ if(a && at <= (Number(a.duration) || 1e9)) a.currentTime = at; }catch(_eS3){}
    }
    if(!fromScrub) scVideoClock();
  }

  // The progress line as a handle: press anywhere along the 26px touch area, drag
  // to any second, and the picture, its soundtrack and the song all follow.
  function scVideoWireSeek(){
    var pr = scVideoEl('scVideoProg');
    if(!pr || pr.__scWired) return;
    pr.__scWired = true;
    function frac(ev){
      var r = null;
      try{ r = pr.getBoundingClientRect ? pr.getBoundingClientRect() : null; }catch(_eRect){ r = null; }
      if(!r || !r.width) return null;
      var x = (ev && ev.clientX != null) ? ev.clientX : (r.left + r.width);
      return Math.max(0, Math.min(1, (x - r.left) / r.width));
    }
    function paint(f){
      scVideoState.scrubFrac = f;
      var fill = scVideoEl('scVideoFill'), th = scVideoEl('scVideoThumb');
      if(fill) fill.style.width = (f * 100) + '%';
      if(th) th.style.left = (f * 100) + '%';
      var v = scVideoEl('scVideoEl');
      var dur = (v && isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
      scVideoClock();
      if(!dur){ scVideoState.scrubFrac = f; }
    }
    function put(ev){
      var f = frac(ev);
      if(f == null) return;
      paint(f);
      var v = scVideoEl('scVideoEl');
      var dur = (v && isFinite(v.duration) && v.duration > 0) ? v.duration : 0;
      if(dur) scVideoSeekTo(f * dur, true);
    }
    pr.addEventListener('pointerdown', function(ev){
      try{ if(ev && ev.preventDefault) ev.preventDefault(); }catch(_ePd){}
      scVideoState.scrubbing = true;
      pr.classList.add('sc-vseek');
      scVideoIdleWake();
      try{ if(pr.setPointerCapture && ev && ev.pointerId != null) pr.setPointerCapture(ev.pointerId); }catch(_eCap){}
      put(ev);
    });
    pr.addEventListener('pointermove', function(ev){ if(scVideoState.scrubbing) put(ev); });
    function done(ev){
      if(!scVideoState.scrubbing) return;
      put(ev);
      scVideoState.scrubbing = false;
      scVideoState.scrubFrac = null;
      pr.classList.remove('sc-vseek');
      scVideoSync(true);
      scVideoIdleWake();
    }
    pr.addEventListener('pointerup', done);
    pr.addEventListener('pointercancel', done);
  }

  // ── the transport steps aside ------------------------------------------------
  function scVideoIdleStop(){
    if(scVideoState.idle){ clearTimeout(scVideoState.idle); scVideoState.idle = null; }
  }
  function scVideoIdleMark(on){
    var d = scVideoEl('scVideoBackdrop');
    if(!d) return;
    d.classList.toggle('sc-vidle', !!on);
    scVideoState.idleOn = !!on;
  }
  function scVideoIdleArm(){
    scVideoIdleStop();
    if(!scVideoState.wide) return;
    var v = scVideoEl('scVideoEl'), q = scVideoEl('scVideoQ');
    if(!v || v.paused || scVideoState.blocked || scVideoState.scrubbing) return;
    if(q && q.classList.contains('on')) return;
    scVideoState.idle = setTimeout(function(){
      scVideoState.idle = null;
      var vv = scVideoEl('scVideoEl'), qq = scVideoEl('scVideoQ');
      if(!scVideoState.wide || !vv || vv.paused || scVideoState.scrubbing) return;
      if(qq && qq.classList.contains('on')) return;
      scVideoIdleMark(true);
    }, SC_VQ_IDLE_MS);
  }
  function scVideoIdleWake(){
    var was = !!scVideoState.idleOn;
    scVideoIdleMark(false);
    scVideoIdleArm();
    return was;
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
    scVideoIdleWake();
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
      ? 'the best one-stream size for this phone'
      : (rung.h === SC_VQ_DEFAULT ? 'default \u00b7 ' : '') +
        rung.tag + ' \u00b7 ' + rung.codec + ' \u00b7 ' + Math.max(1, Math.round((rung.size || 0) / 1048576)) + ' MB' +
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
      // QOL: why the picture is not the size that was expected is written where
      // you look to change it, instead of being left to be worked out.
      var lines = [];
      var top = rungs.length ? rungs[0].h : 0;
      if(scVideoState.want && top && top < scVideoState.want){
        lines.push('This video has no ' + scVideoState.want + 'p - it tops out at ' + top + 'p.');
      }
      if(paired) lines.push('Above the one-stream sizes the picture and the same video soundtrack arrive as two streams and are played together.');
      note.style.display = lines.length ? '' : 'none';
      note.textContent = lines.join(' ');
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
    scVideoIdleWake();
    scVideoWantSet(h);
    scVideoState.drops = 0;             // a size picked by hand gets the whole road
    scVideoState.retries = 0;
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
    var hadSrc = !!(keep && v && v.src);
    var at = hadSrc ? (Number(v.currentTime) || 0) : null;
    var switching = !!(hadSrc && scVideoState.rung && scVideoState.rung.h !== rung.h);
    // A size change is not a play button: a picture that was paused stays paused.
    scVideoState.wasPlaying = hadSrc ? !v.paused : true;
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
    scVideoAttach(rung.url, 'direct', switching);
    scVideoTickStart();
    return true;
  }

  // A SIZE THAT NEVER STARTS IS NOT A BLACK PANEL. A source that has produced
  // nothing is walked the way a refusal is - another codec, then one size down -
  // but only once it is clear nothing is coming. Nine seconds was written for the
  // smallest row: a 1080p row is three or four times the bytes, and calling it
  // dead at nine seconds while it was still fetching is what walked a slow
  // picture down to 360p. The watch now scales with the weight of the size, and
  // asks whether the element is still loading at all.
  function scVideoWatch(){
    scVideoWatchStop();
    var token = (scVideoState.watchToken = (scVideoState.watchToken || 0) + 1);
    var ms = scVideoWatchMs(scVideoState.rung && scVideoState.rung.size);
    scVideoState.watch = setTimeout(function(){
      scVideoState.watch = null;
      if(token !== scVideoState.watchToken) return;
      var v = scVideoEl('scVideoEl');
      if(!v || !v.src || v.paused || scVideoState.blocked) return;
      if(v.readyState >= 2 || (Number(v.currentTime) || 0) > 0.4) return;
      // NOT SLOW, DEAD. Bytes that have arrived - even a little - are a size that
      // works; a source the element is still fetching gets more time rather than
      // a smaller size. Only a source that has stopped, with nothing buffered, is
      // treated as a refusal.
      var buffered = 0;
      try{ buffered = (v.buffered && v.buffered.length) ? (Number(v.buffered.end(v.buffered.length - 1)) || 0) : 0; }catch(_eBuf){ buffered = 0; }
      if(buffered > 0.05) return;
      if(Number(v.networkState) === 2) return;      // still fetching: it is not dead
      scVideoFailed(true);                          // nothing came, so the size is dead
    }, ms);
  }
  // The deadline for a silent source: the base, plus a little for every megabyte
  // it has to fetch, capped - a 24 MB 1080p row gets sixteen seconds, and nothing
  // waits longer than twenty-one.
  function scVideoWatchMs(size){
    var mb = Math.max(0, Math.round((Number(size) || 0) / 1048576));
    return Number(SC_VQ_WATCH_MS) + Math.min(12000, mb * Number(SC_VQ_WATCH_PER_MB));
  }
  function scVideoWatchStop(){
    if(scVideoState.watch){ clearTimeout(scVideoState.watch); scVideoState.watch = null; }
    scVideoState.watchToken = (scVideoState.watchToken || 0) + 1;
  }

  function scVideoAttach(src, via, switching){
    var v = scVideoEl('scVideoEl');
    if(!v || !src) return;
    var mode = scVideoState.audioMode;
    scVideoState.via = via;
    scVideoState.blocked = false;
    scVideoState.audio = scVideoAudioEl();
    scVideoState.swapAt = (Date.now ? Date.now() : new Date().getTime());
    var start = scVideoState.resumeAt;
    if(start == null) start = (mode === 'song') ? null : scVideoSongTime();
    scVideoState.startAt = start;
    scVideoState.resumeAt = null;
    scVideoAuxPause();
    // WHO OWNS THE SOUND. A size with its own audio owns it - in the picture or in
    // its paired track - and the rest of the app is told, so the song cannot be
    // started underneath the film by the app's own background recovery. A size
    // with no audio gives it back, because there the song IS the soundtrack.
    scVideoOwnSound(mode !== 'song');
    // The source is replaced rather than cleared first: a cleared element is a
    // black frame where the picture was, and a size change should not blink.
    v.src = src;
    // The source this tab is on, so a late error from the one before it can be
    // told apart from a refusal of this one.
    try{ scVideoState.srcNow = String(v.src || src); }catch(_eNowSrc){ scVideoState.srcNow = String(src || ''); }
    v.muted = (mode !== 'video');          // a paired track is the sound in aux mode
    try{ v.volume = 1; }catch(_eVol){}
    scVideoMuteOthers();
    scVideoPose(v, start);
    if(mode === 'video' || mode === 'aux') scVideoHoldSong();
    if(mode === 'aux') scVideoAuxSet(start);
    if(mode === 'song'){
      var s = scVideoAudioEl();
      try{ if(s && start != null) s.currentTime = Number(start) || 0; }catch(_eSS){}
      if(scVideoState.wasPlaying) scVideoSong(true);
    }
    try{ v.load(); }catch(_eLoad){}
    scVideoPose(v, start);
    scVideoBig(false);
    scVideoSpin(!!scVideoState.wasPlaying);
    scVideoSay(switching && scVideoState.rung
      ? 'Changing to ' + scVideoState.rung.label + '…'
      : 'Starting the video…');
    scVideoWatch();
    if(scVideoState.wasPlaying){ scVideoPlayAttempt(); }
    else { scVideoSpin(false); scVideoBig(true); scVideoBarState(); scVideoClock(); }
  }

  // The soundtrack of a high rung: the same video's own audio row, in its own
  // element, posed onto the picture's second rather than onto the song's.
  function scVideoAuxSet(at){
    var a = scVideoEl('scVideoAuxEl');
    var r = scVideoState.rung;
    if(!a) return;
    scVideoAuxPause();
    // Silent until it is on the picture's second, so a size change cannot play a
    // quarter second of the intro over a picture that is two minutes in.
    try{ a.muted = true; a.volume = 1; }catch(_eAv){}
    scVideoState.posing = false;
    if(!r || !r.audioUrl) return;
    try{ a.src = r.audioUrl; }catch(_eSrc){ return; }
    try{ a.load(); }catch(_eAl){}
    scVideoPose(a, at);                    // applied when this element has a duration
    scVideoState.posing = true;
    scVideoMuteOthers();
  }
  function scVideoAuxPause(){
    var a = scVideoEl('scVideoAuxEl');
    if(a){ try{ a.pause(); }catch(_eAx){} }
  }
  function scVideoAuxPlay(){
    var a = scVideoEl('scVideoAuxEl'), v = scVideoEl('scVideoEl');
    if(!a || !a.src) return;
    if(scVideoState.audioMode !== 'aux'){ try{ a.muted = true; }catch(_eAuxQ){} return; }
    // THE FRAME IS THE CLOCK. There is nothing to line a voice up with until the
    // picture is running, and starting early is exactly what put it ahead.
    if(!v || v.paused || v.readyState < 2) return;
    if(!scVideoPoseTry(a)){ scVideoState.posing = true; return; }   // canplay comes back here
    var vt = Number(v.currentTime) || 0;
    if(Math.abs((Number(a.currentTime) || 0) - vt) > 0.05){
      try{ a.currentTime = vt; }catch(_eAse){}
    }
    try{ if(a.playbackRate !== 1) a.playbackRate = 1; }catch(_eApr){}
    try{ a.muted = false; }catch(_eAum){}
    scVideoMuteOthers();
    scVideoState.posing = false;
    var p = null;
    try{ p = a.play(); }catch(_eApl){ p = null; }
    if(p && p.catch) p.catch(function(e){ scVideoAuxFallBack((e && e.name) || 'refused'); });
  }
  function scVideoAuxFallBack(why){
    if(scVideoState.audioMode !== 'aux') return;
    scVideoState.audioMode = 'song';
    scVideoState.posing = false;
    scVideoOwnSound(false);
    scVideoAuxPause();
    var v = scVideoEl('scVideoEl'), a = scVideoAudioEl();
    try{
      if(a){
        a.currentTime = v ? (Number(v.currentTime) || 0) : 0;
        var p = a.play(); if(p && p.catch) p.catch(function(){});
      }
    }catch(_eAf){}
    try{ if(v) v.muted = true; }catch(_eAm){}
    scVideoFoot('The soundtrack of this size would not play (' + why + ') - the song runs under the picture.');
    scVideoTickStart();
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
    if(scVideoState.scrubbing){ scVideoClock(); return; }
    // THE PICTURE IS THE CLOCK when a paired track carries the sound. The
    // soundtrack is nudged onto the picture, never the other way round: a seek
    // backwards in the picture is the one you can see, and it is what used to
    // send the film - and the song after it - back to the start.
    if(scVideoState.audioMode === 'aux'){
      var s = scVideoEl('scVideoAuxEl');
      scVideoMuteOthers();
      if(s && s.src && s.readyState >= 1 && scVideoPosed(s)){
        var vt2 = Number(v.currentTime) || 0;
        if(v.paused || v.readyState < 2){
          if(!s.paused) scVideoAuxPause();
        } else {
          var d = (Number(s.currentTime) || 0) - vt2;
          // A TENTH, AND IT IS TRIMMED, NOT JUMPED. Two elements run at very
          // slightly different rates, so the voice is allowed to run a hair fast or
          // slow until it sits on the frame. Only a real gap - a buffered picture,
          // a seek, a size change - is jumped.
          if(Math.abs(d) > 0.6){
            try{ s.currentTime = vt2; }catch(_eSync){ }
            try{ s.playbackRate = 1; }catch(_eSyncR){ }
          } else if(Math.abs(d) > 0.1){
            try{ s.playbackRate = Math.max(0.92, Math.min(1.08, 1 - d * 0.5)); }catch(_eSyncT){ }
          } else {
            try{ if(s.playbackRate !== 1) s.playbackRate = 1; }catch(_eSyncU){ }
          }
          if(s.paused && !scVideoState.posing) scVideoAuxPlay();
        }
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
    if(!scVideoState.open) return;
    scVideoState.tick = setInterval(function(){
      if(!scVideoState.open) return;
      scVideoSync(false);
    }, scVideoState.audioMode === 'aux' ? 500 : 900);
  }
  function scVideoTickStop(){
    if(scVideoState.tick){ clearInterval(scVideoState.tick); scVideoState.tick = null; }
  }

  function scVideoFailed(dead){
    var v = scVideoEl('scVideoEl');
    // The size that is failing, kept before the road changes it: the footer has to
    // name the row this phone refused, not the one it landed on.
    var from = scVideoState.rung;
    var why = 'the element could not play this source';
    scVideoWatchStop();
    var err = null;
    try{ err = v && v.error; }catch(_eNone){ err = null; }
    // NO MEDIAERROR, NO REFUSAL. An `error` event that carries nothing is one for
    // a source this tab has already replaced - the abort of the load a size change
    // made - and acting on it is what pulled a 1080p click down to 360p. Only the
    // silent-source watch may act without one, and it says so.
    if(!err && dead !== true) return;
    try{
      if(err && err.code === 2) why = 'the stream dropped (network)';
      else if(err && err.code === 3) why = 'the phone could not decode this stream';
      else if(err && err.code === 4) why = 'this source is not a video the element can open';
      else if(err && err.code === 1) why = 'the read was aborted';
    }catch(_eErr){}
    // An aborted read is the element letting go of the last source, which is what
    // a size change does; it is not the new size failing.
    var fresh = 0;
    try{ fresh = (Date.now ? Date.now() : new Date().getTime()) - (Number(scVideoState.swapAt) || 0); }catch(_eNow){}
    if(fresh < 900 && why === 'the read was aborted') return;
    // AND NOT FOR A SOURCE THAT IS ALREADY GONE. Two attaches in quick succession
    // leave the old one's error behind; if the element is no longer on the source
    // this tab attached, the event is history.
    var cur = '';
    try{ cur = String((v && (v.currentSrc || v.src)) || ''); }catch(_eCur){ cur = ''; }
    if(scVideoState.srcNow && cur && cur !== scVideoState.srcNow) return;
    // A DROPPED CONNECTION IS NOT A WRONG SIZE. Code 2 is the network letting go
    // for a moment, and walking down the ladder on it is how a 1080p picture ends
    // up on the 360p row over a signal that was only busy. The same source is
    // restarted at the same second, once, and the size is not touched. A second
    // drop means the source is not coming back and the road carries on.
    var code = Number(v && v.error && v.error.code) || 0;
    if(code === 2 || (code === 1 && fresh >= 900)){
      var again = v ? String(v.src || '') : '';
      if(again && !(Number(scVideoState.retries) > 0)){
        scVideoState.retries = 1;
        scVideoState.resumeAt = Number(v.currentTime) || 0;
        // On the footer, not the transient line: starting the source clears that
        // one, and this is the thing worth knowing when the picture stumbles.
        scVideoFoot('The connection dropped (' + why + '). The same size is starting again.');
        scVideoAttach(again, scVideoState.via || 'direct', true);
        return;
      }
      scVideoState.retries = 0;
    }
    // Another codec at the same height, first: the size the owner asked for is
    // worth one more stream before it is given up on.
    var alts = scVideoState.alts || [];
    if(scVideoState.alt < alts.length && scVideoState.alt < 2){
      var next = alts[scVideoState.alt++];
      scVideoSay('That stream refused it (' + why + '). Trying another…');
      scVideoAttach(next.url, 'direct');
      return;
    }
    // Then the honest fallback: the best size that carries its own sound. The
    // size the owner chose is kept for the next video - it is this phone that
    // could not open it, not a choice that was wrong.
    // ONE STEP DOWN, NOT A CLIFF. A phone that refuses the size asked for can
    // usually open the one under it, and dropping straight to the smallest size
    // with its own sound threw the 720p picture away because 1080p was refused.
    // One step, then the honest fallback, so a broken phone is not walked down
    // the whole ladder nine seconds at a time.
    var def = null;
    if(!(Number(scVideoState.drops) > 0)){
      def = scVideoRungBelow(scVideoState.rungs, scVideoState.rung ? scVideoState.rung.h : 0);
      if(def) scVideoState.drops = 1;
    }
    if(!def) def = scVideoDefault(scVideoState.rungs);
    if(def && scVideoState.rung && def.h !== scVideoState.rung.h){
      scVideoApplyRung(def, true);
      // On the footer, not the transient line: a playing picture clears that one
      // the moment it starts, and this fallback is the thing worth knowing.
        scVideoFoot('This size did not play here (' + why + ') - ' +
        (from ? from.label + ' ' + from.codec : 'that size') +
        '. Now at ' + def.label + '.');
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
    scVideoOwnSound(false);          // looking for a video: the song is the sound
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
    scVideoState.drops = 0;
    scVideoState.retries = 0;
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
    if(on){ scVideoIdleMark(false); scVideoIdleArm(); }
    else { scVideoIdleStop(); scVideoIdleMark(false); }
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
    scVideoWatchStop();
    scVideoIdleStop();
    scVideoIdleMark(false);
    scVideoState.scrubbing = false;
    scVideoState.scrubFrac = null;
    scVideoState.posing = false;
    scVideoState.wasPlaying = true;
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
    // The song picks up where the video stopped, so the tab is a detour - and it
    // may start freely now, because nothing here owns the sound any more.
    scVideoOwnSound(false);
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
