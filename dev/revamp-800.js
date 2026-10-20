/* ============================================================================
   SideCut 80.0 - "Massive Revamp": milestones you can replay, a Studio split
   down a diagonal into Studio and Tools, a pinned-artists window you can have
   as one row or eight squares, tabs that glide, and a whole second layout
   (floating bubbles, dock on the right) that is one tap from the original.

   This is a fourth top-level block with its own closure, appended after the
   Studio block, for the same reason that one was: nothing in the app's IIFE is
   visible by name here, so every reach is a guarded window.__sc* hook or a DOM
   query. A hook that is missing degrades one feature, never the app.

   The one hard rule of the revamp: the ORIGINAL layout is the default and it is
   always one tap away. Every new arrangement hangs off a body class this block
   adds, so with the switches off the page is exactly 75.1.2.
   ========================================================================== */
(function(){
  'use strict';

  var VERSION = (typeof window !== 'undefined' && window.APP_VERSION) || '80.0';
  var LS = {
    layout: 'sc80Layout',      // 'classic' (default) | 'cloud'
    pinned: 'sc80PinnedLayout',// 'row' (default, four up) | 'grid' (2 x 4)
    studioTab: 'sc80StudioTab',// 'studio' (default) | 'tools'
    milestones: 'sc80Milestones' // { "50": <ms celebrated> }
  };
  // The days that are worth a whole screen. 3 is the first one that reads as a
  // habit rather than a coincidence; the rest are round numbers people say out
  // loud. 100, 365 and 1000 are the ones this was asked for.
  var MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 250, 300, 365, 500, 730, 1000];
  var TOOL_FOLDS = {
    scFoldBadges: 1,    // badges, rewards and streaks
    scFoldStorage: 1,   // storage cleaner
    scFoldAutodj: 1,    // auto-DJ
    scFoldGestures: 1,  // gestures
    scFoldBatchTags: 1, // batch tag editor
    scFoldBatchSel: 1   // batch on selected
  };

  function $(id){ return document.getElementById(id); }
  function lsGet(k, d){
    try{ var v = localStorage.getItem(k); if(v == null) return d; return JSON.parse(v); }
    catch(e){ return d; }
  }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function esc(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function call(name){
    try{ return (typeof window[name] === 'function') ? window[name]() : null; }
    catch(e){ return null; }
  }
  function stats(){
    var s = call('__scStats');
    return (s && typeof s === 'object') ? s : null;
  }
  function streakNow(){ var s = stats(); return s ? (Number(s.streak) || 0) : 0; }
  function streakBest(){ var s = stats(); return s ? Math.max(Number(s.streak) || 0, Number(s.longest) || 0) : 0; }
  function reachedMilestone(){
    var n = streakNow(), hit = 0;
    for(var i = 0; i < MILESTONES.length; i++){ if(n >= MILESTONES[i]) hit = MILESTONES[i]; }
    return hit;
  }
  function celebrated(){ var m = lsGet(LS.milestones, null); return (m && typeof m === 'object') ? m : {}; }
  function markCelebrated(days){
    var m = celebrated();
    if(!m[String(days)]){ m[String(days)] = Date.now(); lsSet(LS.milestones, m); }
    return m;
  }

  /* ------------------------------------------------------------------------
     1. LAYOUT - classic (the original, default) or cloud (the floating one)
     ------------------------------------------------------------------------ */
  function layout(){ return lsGet(LS.layout, 'classic') === 'cloud' ? 'cloud' : 'classic'; }
  function isCloud(){ return layout() === 'cloud'; }
  function pinnedLayout(){ return lsGet(LS.pinned, 'row') === 'grid' ? 'grid' : 'row'; }

  function applyLayout(){
    var cloud = isCloud();
    document.body.classList.toggle('sc80-cloud', cloud);
    document.body.classList.toggle('sc80-pa-grid', pinnedLayout() === 'grid');
    if(cloud){ ensureNowChip(); updateNowChip(); }
    syncCloudControls();
    paintOptions();
    requestAnimationFrame(function(){ try{ glide(); }catch(e){} });
  }
  function setLayout(mode){
    lsSet(LS.layout, mode === 'cloud' ? 'cloud' : 'classic');
    applyLayout();
    toast(mode === 'cloud'
      ? 'Cloud layout - bubbles, the dock on the right, the small now bar up top'
      : 'Classic layout - the original bottom tabs are back');
  }
  function setPinnedLayout(mode){
    lsSet(LS.pinned, mode === 'grid' ? 'grid' : 'row');
    applyLayout();
    toast(mode === 'grid'
      ? 'Pinned artists: eight squares in a 2 x 4 window'
      : 'Pinned artists: four in a row, scrolling on');
  }

  /* The header's bell / refresh / gear, moved onto the listening-stats card the
     way the Ask SideCut sparkle already is. They are the real buttons: the click
     is forwarded, so notifications, a refresh and Settings all behave exactly
     as the header does. */
  var ICON_BELL = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/></svg>';
  var ICON_REFRESH = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"/></svg>';
  var ICON_GEAR = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.5.5 0 00.12-.61l-1.92-3.32a.5.5 0 00-.6-.22l-2.39.96a7.03 7.03 0 00-1.62-.94l-.36-2.54a.5.5 0 00-.5-.42h-3.84a.5.5 0 00-.5.42l-.36 2.54c-.59.24-1.13.56-1.62.94l-2.39-.96a.5.5 0 00-.6.22L2.66 8.87a.5.5 0 00.12.61l2.03 1.58c-.05.3-.08.61-.08.94s.02.64.07.94l-2.03 1.58a.5.5 0 00-.12.61l1.92 3.32c.12.22.39.3.6.22l2.39-.96c.5.38 1.04.7 1.62.94l.36 2.54c.05.24.26.42.5.42h3.84c.24 0 .46-.18.5-.42l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.49 0 .6-.22l1.92-3.32a.5.5 0 00-.12-.61l-2.03-1.58zM12 15.6a3.6 3.6 0 110-7.2 3.6 3.6 0 010 7.2z"/></svg>';

  function syncCloudControls(){
    var existing = $('sc80CloudCtl');
    if(!isCloud()){
      if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    var host = null;
    var bubbles = $('homeBubbles');
    if(bubbles){
      var cards = bubbles.querySelectorAll('.home-bubble');
      for(var i = 0; i < cards.length; i++){
        if(cards[i].querySelector('#homeAiBtn')){ host = cards[i]; break; }
      }
      // A stats bubble that has been hidden would otherwise leave Settings
      // unreachable once the header buttons are gone, so the greeting row takes
      // them instead. Two places, one set of buttons.
      if(!host){
        var row = document.querySelector('.home-head-row');
        if(row) host = row;
      }
    }
    if(!host){
      if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
      return;
    }
    if(existing && existing.parentNode === host) return;
    if(existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var wrap = document.createElement('div');
    wrap.id = 'sc80CloudCtl';
    wrap.innerHTML =
      '<button data-sc80-go="notifBtn" title="Notifications" aria-label="Notifications">' + ICON_BELL + '<span class="sc80-dot" style="display:none"></span></button>' +
      '<button data-sc80-go="refreshBtn" title="Refresh app" aria-label="Refresh app">' + ICON_REFRESH + '</button>' +
      '<button data-sc80-go="themeBtn" title="Settings" aria-label="Settings">' + ICON_GEAR + '</button>';
    wrap.addEventListener('click', function(ev){
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-sc80-go]') : null;
      if(!b) return;
      ev.stopPropagation();
      var real = $(b.getAttribute('data-sc80-go'));
      if(real) real.click();
    });
    host.appendChild(wrap);
  }
  // The red dot is the app's own; this mirrors it without owning it.
  function syncNotifDot(){
    var badge = $('notifBadge');
    var mine = document.querySelector('#sc80CloudCtl .sc80-dot');
    if(!badge || !mine) return;
    mine.style.display = (badge.style.display && badge.style.display !== 'none') ? 'block' : 'none';
  }

  /* The small now bar in the top right. It reads the player that is already on
     the page rather than keeping a second copy of the state. */
  function ensureNowChip(){
    if($('sc80Now')) return;
    var chip = document.createElement('div');
    chip.id = 'sc80Now';
    chip.setAttribute('role', 'button');
    chip.setAttribute('aria-label', 'Now playing - open the player');
    chip.innerHTML =
      '<div class="art"></div>' +
      '<div class="txt"><div class="t">—</div><div class="a">—</div></div>' +
      '<button class="pp" title="Play / pause" aria-label="Play or pause">▶</button>';
    chip.addEventListener('click', function(ev){
      if(ev.target && ev.target.classList && ev.target.classList.contains('pp')) return;
      var np = $('nowPlaying');
      if(np && np.classList.contains('mini')){
        var exp = document.querySelector('[data-act="expand"], #expandNowBtn');
        if(exp){ exp.click(); return; }
      }
      if(np && np.scrollIntoView) np.scrollIntoView({ behavior: 'smooth', block: 'end' });
    });
    chip.querySelector('.pp').addEventListener('click', function(ev){
      ev.stopPropagation();
      var b = $('playPauseBtn');
      if(b) b.click();
      updateNowChip();
    });
    document.body.appendChild(chip);
  }
  function nowArtUrl(){
    var el = document.querySelector('#npArt, #npCover, #npAlbumArt, .np-art');
    if(el){
      if(el.style && el.style.backgroundImage) return el.style.backgroundImage.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
      if(el.src) return el.src;
    }
    var disc = $('npDisc');
    if(disc){
      var lb = $('npDiscLabel');
      var bg = lb && lb.style && lb.style.backgroundImage;
      if(bg) return bg.replace(/^url\(["']?/, '').replace(/["']?\)$/, '');
    }
    return '';
  }
  function updateNowChip(){
    var chip = $('sc80Now');
    if(!chip) return;
    var t = $('npTitle'), a = $('npArtist');
    var title = (t && t.textContent || '').trim() || 'Nothing playing';
    var artist = (a && a.textContent || '').trim() || '—';
    var art = nowArtUrl();
    chip.querySelector('.t').textContent = title;
    chip.querySelector('.a').textContent = artist;
    chip.querySelector('.art').style.backgroundImage = art ? 'url("' + art + '")' : 'none';
    var pp = chip.querySelector('.pp');
    // The disc spins only while something is actually playing, which is the
    // app's own statement of the same fact - no second copy of the state here.
    var disc = $('npDisc');
    var playing = !!(disc && disc.classList.contains('spinning'));
    if(!disc){
      try{ var aud = document.querySelector('audio'); playing = !!(aud && !aud.paused); }catch(e){}
    }
    pp.textContent = playing ? '❚❚' : '▶';
  }

  /* ------------------------------------------------------------------------
     2. STUDIO - the diagonal split. Everything that is not studio work moves
     to Tools, and the milestone replays live with it.
     ------------------------------------------------------------------------ */
  function studioTab(){ return lsGet(LS.studioTab, 'studio') === 'tools' ? 'tools' : 'studio'; }
  function setStudioTab(name){
    lsSet(LS.studioTab, name === 'tools' ? 'tools' : 'studio');
    paintStudioTab();
  }
  function paintStudioTab(){
    var host = $('studioView');
    if(!host) return;
    var want = studioTab();
    var tabs = host.querySelectorAll('.sc80-tab');
    for(var i = 0; i < tabs.length; i++){
      var on = tabs[i].getAttribute('data-tab') === want;
      tabs[i].classList.toggle('active', on);
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
    var panes = host.querySelectorAll('.sc80-pane');
    for(var j = 0; j < panes.length; j++){
      panes[j].classList.toggle('active', panes[j].getAttribute('data-pane') === want);
    }
  }
  function milestonesCard(){
    var best = streakBest(), now = streakNow(), seen = celebrated();
    var rows = MILESTONES.map(function(d){
      var got = best >= d;
      var at = seen[String(d)];
      var when = at ? new Date(at) : null;
      var stamp = when ? (when.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })) : '';
      var txt;
      if(got && at) txt = 'Celebrated ' + esc(stamp) + ' · ' + (best === d ? 'your best streak' : 'already in the books');
      else if(got) txt = 'Reached' + (now >= d ? ' — not played back yet' : ' on a previous run') + ' · tap Replay';
      else txt = (d - now) + ' day' + ((d - now) === 1 ? '' : 's') + ' to go';
      return '<div class="sc80-ms-row">' +
        '<div class="sc80-ms-days' + (got ? '' : ' locked') + '">' + d + 'd</div>' +
        '<div class="sc80-ms-txt">' + txt + '</div>' +
        (got ? '<button class="sc-btn tiny" data-sc80-ms="' + d + '">Replay</button>' : '') +
      '</div>';
    }).join('');
    return '<div class="sc-sec" id="sc80Milestones">' +
      '<div class="sc-sec-head" style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">' +
        '<div style="flex:1;font-size:13.5px;font-weight:700;">Milestones</div>' +
        '<span style="font-size:11px;color:var(--ink-dim);">best ' + best + ' day' + (best === 1 ? '' : 's') + '</span>' +
      '</div>' +
      '<div class="sc-note">Hit a streak milestone and the app plays it back on the next start, once. Every one you have reached can be replayed here, forever.</div>' +
      rows +
      '<div class="sc-actions" style="margin-top:10px;">' +
        '<button class="sc-btn primary" data-sc80-ms="' + (reachedMilestone() || 7) + '">Play the ' + (reachedMilestone() || 7) + '-day celebration</button>' +
        '<button class="sc-btn" data-sc80-ms="100">Preview 100 days</button>' +
      '</div>' +
    '</div>';
  }
  function lookCard(){
    var cloud = isCloud(), grid = pinnedLayout() === 'grid';
    return '<div class="sc-sec" id="sc80Look">' +
      '<div style="font-size:13.5px;font-weight:700;margin-bottom:2px;">Look and feel</div>' +
      '<div class="sc-note">Two layouts, both live. The original is the default and stays one tap away.</div>' +
      '<div style="font-size:11.5px;font-weight:600;margin-top:10px;">Tabs and home</div>' +
      '<div class="sc80-opt-row">' +
        '<button class="sc80-opt' + (cloud ? '' : ' on') + '" data-sc80-layout="classic">Classic tabs<small>The original: four pills along the bottom, cards on Home.</small></button>' +
        '<button class="sc80-opt' + (cloud ? ' on' : '') + '" data-sc80-layout="cloud">Cloud bubbles<small>Floating round bubbles, the dock down the right, a small now bar up top.</small></button>' +
      '</div>' +
      '<div style="font-size:11.5px;font-weight:600;margin-top:12px;">Pinned artists</div>' +
      '<div class="sc80-opt-row">' +
        '<button class="sc80-opt' + (grid ? '' : ' on') + '" data-sc80-pinned="row">Four in a row<small>One sideways-scrolling row, four artists on screen.</small></button>' +
        '<button class="sc80-opt' + (grid ? ' on' : '') + '" data-sc80-pinned="grid">Eight squares<small>A 2 x 4 window of smaller squares - eight at a time, scrolling for the rest.</small></button>' +
      '</div>' +
    '</div>';
  }
  function paintOptions(){
    var btns = document.querySelectorAll('[data-sc80-layout]');
    for(var i = 0; i < btns.length; i++){
      btns[i].classList.toggle('on', btns[i].getAttribute('data-sc80-layout') === layout());
    }
    var pins = document.querySelectorAll('[data-sc80-pinned]');
    for(var j = 0; j < pins.length; j++){
      pins[j].classList.toggle('on', pins[j].getAttribute('data-sc80-pinned') === pinnedLayout());
    }
  }
  function wireLookCard(root){
    if(!root || root._sc80Wired) return;
    root._sc80Wired = true;
    root.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-sc80-layout],[data-sc80-pinned],[data-sc80-ms]') : null;
      if(!t) return;
      if(t.hasAttribute('data-sc80-layout')) setLayout(t.getAttribute('data-sc80-layout'));
      else if(t.hasAttribute('data-sc80-pinned')) setPinnedLayout(t.getAttribute('data-sc80-pinned'));
      else if(t.hasAttribute('data-sc80-ms')) celebrate(Number(t.getAttribute('data-sc80-ms')), { manual: true });
    });
  }
  function decorateStudio(){
    var host = $('studioView');
    if(!host) return;
    if(host.querySelector('.sc80-tabs')) return; // already split
    var kids = [];
    for(var i = 0; i < host.childNodes.length; i++){
      if(host.childNodes[i].nodeType === 1) kids.push(host.childNodes[i]);
    }
    if(!kids.length) return;
    var paneStudio = document.createElement('div');
    paneStudio.className = 'sc80-pane';
    paneStudio.setAttribute('data-pane', 'studio');
    var paneTools = document.createElement('div');
    paneTools.className = 'sc80-pane';
    paneTools.setAttribute('data-pane', 'tools');
    kids.forEach(function(el){
      var fold = el.querySelector ? el.querySelector('[data-fold]') : null;
      var key = fold ? fold.getAttribute('data-fold') : '';
      (TOOL_FOLDS[key] ? paneTools : paneStudio).appendChild(el);
    });
    paneTools.insertAdjacentHTML('beforeend', milestonesCard() + lookCard());
    var bar = document.createElement('div');
    bar.className = 'sc80-tabs';
    bar.setAttribute('role', 'tablist');
    bar.setAttribute('aria-label', 'Studio sections');
    bar.innerHTML =
      '<button class="sc80-tab left" data-tab="studio" role="tab">Studio<span class="sc80-tab-sub">the work: DJ, crop, edit, FX</span></button>' +
      '<button class="sc80-tab right" data-tab="tools" role="tab">Tools<span class="sc80-tab-sub">badges, milestones, layout</span></button>' +
      '<svg width="100%" height="100%" aria-hidden="true"><line x1="100%" y1="100%" x2="0" y2="0" stroke="var(--line)" stroke-width="1"/></svg>';
    bar.addEventListener('click', function(ev){
      var b = ev.target && ev.target.closest ? ev.target.closest('[data-tab]') : null;
      if(!b) return;
      setStudioTab(b.getAttribute('data-tab'));
    });
    host.appendChild(paneStudio);
    host.appendChild(paneTools);
    host.insertBefore(bar, paneStudio);
    wireLookCard(paneTools);
    paintStudioTab();
  }
  function watchStudio(){
    var host = $('studioView');
    if(!host) return;
    var t = null;
    var run = function(){ clearTimeout(t); t = setTimeout(function(){ try{ decorateStudio(); }catch(e){} }, 0); };
    if(window.MutationObserver) new MutationObserver(run).observe(host, { childList: true });
    // The export is wrapped too so the split is there on the same frame the
    // Studio paints, not one observer tick later.
    try{
      var S = window.SC70;
      if(S && typeof S.renderStudio === 'function' && !S.renderStudio.__sc80){
        var orig = S.renderStudio;
        var wrapped = function(){ var r = orig.apply(this, arguments); try{ decorateStudio(); }catch(e){} return r; };
        wrapped.__sc80 = true;
        S.renderStudio = wrapped;
      }
    }catch(e){}
    run();
  }

  /* ------------------------------------------------------------------------
     3. MILESTONES - the celebration, and the record it leaves in Studio
     ------------------------------------------------------------------------ */
  function bitsHtml(){
    var out = '', colors = ['var(--gold)', 'var(--coral)', '#7ae0c0', '#9b8cff', '#ffd166'];
    for(var i = 0; i < 26; i++){
      var left = (i * 37 + 11) % 100;
      var delay = ((i * 173) % 2100) / 1000;
      var dur = 1.9 + ((i * 7) % 12) / 10;
      out += '<i style="left:' + left + '%;background:' + colors[i % colors.length] +
        ';animation-delay:' + delay.toFixed(2) + 's;animation-duration:' + dur.toFixed(2) + 's;"></i>';
    }
    return out;
  }
  function ensureCelebration(){
    var host = $('sc80Milestone');
    if(host) return host;
    host = document.createElement('div');
    host.id = 'sc80Milestone';
    host.setAttribute('role', 'dialog');
    host.setAttribute('aria-modal', 'true');
    host.innerHTML =
      '<div class="sc80-ms-card">' +
        '<div class="sc80-ms-bits">' + bitsHtml() + '</div>' +
        '<div class="sc80-ms-rings"><i></i><i></i><i></i></div>' +
        '<div class="sc80-ms-kicker">Milestone</div>' +
        '<div class="sc80-ms-num">50</div>' +
        '<div class="sc80-ms-unit">DAY STREAK</div>' +
        '<div class="sc80-ms-sub"></div>' +
        '<div class="sc80-ms-btns">' +
          '<button class="primary" data-sc80-close="1">Keep it going</button>' +
          '<button data-sc80-close="1" data-sc80-replay="1">Watch again</button>' +
        '</div>' +
        '<div class="sc80-ms-hint">Replay this any time in Studio → Tools → Milestones.</div>' +
      '</div>';
    host.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target.closest('[data-sc80-close]') : null;
      if(t){
        if(t.hasAttribute('data-sc80-replay')){ replayAnim(host); return; }
        hideCelebration();
        return;
      }
      if(ev.target === host) hideCelebration();
    });
    document.body.appendChild(host);
    return host;
  }
  function replayAnim(host){
    var card = host.querySelector('.sc80-ms-card');
    if(!card) return;
    card.style.animation = 'none';
    void card.offsetWidth;
    card.style.animation = '';
    var num = host.querySelector('.sc80-ms-num');
    if(num){ num.style.animation = 'none'; void num.offsetWidth; num.style.animation = ''; }
  }
  function hideCelebration(){
    var host = $('sc80Milestone');
    if(host) host.classList.remove('show');
    document.documentElement.style.overflow = '';
  }
  function celebrate(days, opts){
    opts = opts || {};
    days = Number(days) || 0;
    if(!days) return false;
    var host = ensureCelebration();
    host.querySelector('.sc80-ms-num').textContent = String(days);
    host.querySelector('.sc80-ms-unit').textContent = 'DAY STREAK';
    host.querySelector('.sc80-ms-sub').textContent = opts.manual
      ? 'This is what ' + days + ' days of listening looks like. Your best so far is ' + streakBest() + ' — every day counts.'
      : days + ' days in a row of listening. That is not luck any more, that is a habit. Best streak: ' + streakBest() + '.';
    host.classList.remove('show');
    void host.offsetWidth;
    host.classList.add('show');
    document.documentElement.style.overflow = 'hidden';
    if(!opts.manual) markCelebrated(days);
    return true;
  }
  function bootMilestones(){
    var tries = 0;
    (function attempt(){
      tries++;
      var s = stats();
      var hit = reachedMilestone();
      if(hit && !celebrated()[String(hit)]){
        setTimeout(function(){ celebrate(hit); }, 1600);
        return;
      }
      // The library and the streak load out of IndexedDB, so an early read can
      // legitimately be zero. Give it a few seconds before calling it a miss.
      if(tries < 10 && (!s || (!s.library && !s.streak))) setTimeout(attempt, 1500);
    })();
  }

  /* ------------------------------------------------------------------------
     4. TAB FEEL - the dock highlight glides, the tab strip keeps its tab in view
     ------------------------------------------------------------------------ */
  function glide(){
    var strip = $('actionStrip');
    if(!strip) return;
    var g = $('sc80DockGlide');
    if(!g){
      g = document.createElement('div');
      g.id = 'sc80DockGlide';
      g.style.left = '0'; g.style.top = '0';
      strip.insertBefore(g, strip.firstChild);
    }
    if(isCloud()){ g.style.opacity = '0'; return; }
    var active = strip.querySelector('.action-pill.active');
    if(!active){
      var st = $('studioView');
      if(st && st.classList.contains('active')) active = $('studioBtn');
    }
    if(!active){ g.style.opacity = '0'; return; }
    var sr = strip.getBoundingClientRect();
    var r = active.getBoundingClientRect();
    g.style.width = r.width + 'px';
    g.style.height = r.height + 'px';
    g.style.transform = 'translate(' + Math.round(r.left - sr.left) + 'px,' + Math.round(r.top - sr.top) + 'px)';
    g.style.opacity = '1';
  }
  function watchDock(){
    var strip = $('actionStrip');
    if(!strip) return;
    if(window.MutationObserver){
      new MutationObserver(function(){ requestAnimationFrame(glide); })
        .observe(strip, { subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    window.addEventListener('resize', function(){ requestAnimationFrame(glide); });
    strip.addEventListener('click', function(){ setTimeout(glide, 0); setTimeout(glide, 320); });
    requestAnimationFrame(glide);
  }
  function watchTabStrip(){
    var tabs = $('tabs');
    if(!tabs) return;
    var move = function(){
      var a = tabs.querySelector('.tab.active');
      if(!a || !tabs.clientWidth) return;
      var left = a.offsetLeft - (tabs.clientWidth - a.offsetWidth) / 2;
      try{ tabs.scrollTo({ left: Math.max(0, left), behavior: 'smooth' }); }
      catch(e){ tabs.scrollLeft = Math.max(0, left); }
    };
    if(window.MutationObserver){
      new MutationObserver(move).observe(tabs, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
    }
    document.addEventListener('click', function(ev){
      var t = ev.target && ev.target.closest ? ev.target.closest('#tabs .tab') : null;
      if(t) setTimeout(move, 0);
    });
  }
  function watchPinnedRail(){
    var list = $('pinnedArtistsList');
    if(!list) return;
    // A mouse wheel over a one-row rail should move the rail, not the page.
    list.addEventListener('wheel', function(ev){
      if(pinnedLayout() === 'grid') return;
      if(Math.abs(ev.deltaY) <= Math.abs(ev.deltaX)) return;
      ev.preventDefault();
      try{ list.scrollBy({ left: ev.deltaY, behavior: 'smooth' }); }
      catch(e){ list.scrollLeft += ev.deltaY; }
    }, { passive: false });
    // A slow swipe settles on a chip edge; a fast one is left alone, because a
    // snap that fights a fling is what "not smooth" meant.
    var t = null;
    list.addEventListener('scroll', function(){
      clearTimeout(t);
      t = setTimeout(function(){
        if(pinnedLayout() === 'grid') return;
        var chip = list.querySelector('.pinned-artist-chip');
        if(!chip) return;
        var w = chip.getBoundingClientRect().width + 10;
        if(!w) return;
        var target = Math.round(list.scrollLeft / w) * w;
        if(Math.abs(target - list.scrollLeft) < 2) return;
        try{ list.scrollTo({ left: target, behavior: 'smooth' }); }catch(e){ list.scrollLeft = target; }
      }, 180);
    }, { passive: true });
  }

  /* ------------------------------------------------------------------------
     5. SETTINGS & MORE - the two switches, in the place people look for them
     ------------------------------------------------------------------------ */
  function mountSettings(){
    var pane = $('settingsPaneMore');
    if(!pane || $('sc80Look')) return;
    var card = document.createElement('div');
    card.className = 'sc80-settings-card';
    card.style.cssText = 'margin:0 0 14px; padding:12px 14px; border:1px solid var(--line); border-radius:14px; background:rgba(255,255,255,0.03);';
    card.innerHTML = '<div style="font-size:12.5px; font-weight:700;">The new look · ' + esc(VERSION) + '</div>' +
      '<div style="font-size:11px; color:var(--ink-dim); margin-top:3px; line-height:1.45;">A second layout, and a choice of pinned-artists window. The original is the default and never goes away.</div>' +
      '<div class="sc80-opt-row">' +
        '<button class="sc80-opt' + (isCloud() ? '' : ' on') + '" data-sc80-layout="classic">Classic tabs<small>Bottom tabs, card bubbles - the original.</small></button>' +
        '<button class="sc80-opt' + (isCloud() ? ' on' : '') + '" data-sc80-layout="cloud">Cloud bubbles<small>Round floating bubbles, dock on the right, small now bar up top.</small></button>' +
      '</div>' +
      '<div class="sc80-opt-row">' +
        '<button class="sc80-opt' + (pinnedLayout() === 'grid' ? '' : ' on') + '" data-sc80-pinned="row">Pinned: four in a row<small>Sideways scroll, four on screen.</small></button>' +
        '<button class="sc80-opt' + (pinnedLayout() === 'grid' ? ' on' : '') + '" data-sc80-pinned="grid">Pinned: eight squares<small>2 x 4 window of smaller squares.</small></button>' +
      '</div>';
    card.id = 'sc80Look';
    pane.insertBefore(card, pane.firstChild);
    wireLookCard(card);
    paintOptions();
  }

  /* ------------------------------------------------------------------------
     6. WIRING
     ------------------------------------------------------------------------ */
  var toastEl = null;
  function toast(msg){
    if(!toastEl){
      toastEl = document.createElement('div');
      toastEl.id = 'sc80Toast';
      toastEl.style.cssText = 'position:fixed; left:50%; bottom:96px; transform:translateX(-50%) translateY(10px);' +
        'background:rgba(20,20,22,0.94); color:#fff; border:1px solid var(--line); border-radius:12px;' +
        'padding:9px 14px; font-size:12px; z-index:9500; opacity:0; transition:opacity .22s ease, transform .22s ease;' +
        'pointer-events:none; max-width:86vw; text-align:center;';
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = msg;
    toastEl.style.opacity = '1';
    toastEl.style.transform = 'translateX(-50%) translateY(0)';
    clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function(){
      if(!toastEl) return;
      toastEl.style.opacity = '0';
      toastEl.style.transform = 'translateX(-50%) translateY(10px)';
    }, 2400);
  }

  function start(){
    try{ applyLayout(); }catch(e){}
    try{ mountSettings(); }catch(e){}
    try{ watchStudio(); }catch(e){}
    try{ watchDock(); }catch(e){}
    try{ watchTabStrip(); }catch(e){}
    try{ watchPinnedRail(); }catch(e){}
    try{ bootMilestones(); }catch(e){}
    // The player is painted by the app; the chip follows it rather than owning it.
    setInterval(function(){
      if(!isCloud()) return;
      try{ updateNowChip(); syncNotifDot(); }catch(e){}
    }, 1500);
    // Home is repainted whenever a bubble changes size or order, which throws the
    // cloud controls away with it; put them back.
    var bubbles = $('homeBubbles');
    if(bubbles && window.MutationObserver){
      var t = null;
      new MutationObserver(function(){
        clearTimeout(t);
        t = setTimeout(function(){ try{ syncCloudControls(); }catch(e){} }, 30);
      }).observe(bubbles, { childList: true });
    }
    var npTitle = $('npTitle');
    if(npTitle && window.MutationObserver){
      new MutationObserver(function(){ try{ updateNowChip(); }catch(e){} }).observe(npTitle, { childList: true, characterData: true, subtree: true });
    }
  }

  // The one public door: everything the revamp can do, so a future release (or a
  // gate) can reach it without guessing at internals.
  window.SC80 = {
    version: VERSION,
    layout: layout,
    setLayout: setLayout,
    pinnedLayout: pinnedLayout,
    setPinnedLayout: setPinnedLayout,
    studioTab: studioTab,
    setStudioTab: setStudioTab,
    milestones: MILESTONES,
    celebrate: celebrate,
    reached: reachedMilestone,
    celebrated: celebrated,
    isCloud: isCloud,
    decorateStudio: decorateStudio
  };

  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
