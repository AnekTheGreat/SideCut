/* ============================================================================
   SideCut 70.0 - Studio, achievements, gestures, an assistant that acts.
   ----------------------------------------------------------------------------
   This is a new top-level script block with its own closure, appended after the
   app's own two. It reaches into the app only through the window.__sc* hooks the
   first block publishes (that block is an IIFE: nothing inside it is visible
   here by name). Every call is guarded, because this block must never be able to
   take the app down - a missing hook degrades one tool, not the screen.

   The five tools here share one engine: the current song is decoded ONCE into an
   AudioBuffer and cached by track id. Crop-clip, the sampler, the loop recorder
   and the BPM reader all work off that one buffer, so the second tool you open is
   instant. The slowed/karaoke colour is not a buffer at all - it is four nodes
   inserted into the live graph by scStudioBuildChain (called from ensureAudioGraph
   in block 1), so it colours whatever is actually playing.
   ========================================================================== */
(function(){
  'use strict';

  // The app publishes window.APP_VERSION from block 1, and this block is spliced
  // AFTER it, so the Studio header and window.SC70.version name the build that is
  // actually on the page instead of pinning the release this module was written
  // in and going stale on the next one.
  var VERSION = (typeof window !== 'undefined' && window.APP_VERSION) || '70.0';
  var LS = {
    fx: 'sidecut_studio_fx',
    pads: 'sidecut_studio_pads',
    ach: 'sidecut_achievements',
    flags: 'sidecut_feature_flags',
    gestures: 'sidecut_gestures',
    autodj: 'sidecut_autodj',
    // 70.0.5
    ctr: 'sidecut_ach_counters',
    mypresets: 'sidecut_studio_mypresets',
    // 73.3.8 - the dev-mode section is gone; what is left of it is the door that
    // holds the one hidden badge. `dev` is only read, never written, so a door
    // that was already opened stays open across this release.
    door: 'sidecut_door',
    dev: 'sidecut_devmode',
    padsSeen: 'sidecut_pads_seen',
    themes: 'sidecut_themes_used',
    reward: 'sidecut_reward_premium'
  };

  function $(id){ return document.getElementById(id); }
  function has(fn){ return typeof window[fn] === 'function'; }
  function call(fn, a, b, c){ try{ return has(fn) ? window[fn](a, b, c) : null; }catch(e){ return null; } }
  function toast(m, ms){ try{ if(typeof window.toast === 'function') window.toast(m, ms); }catch(e){} }
  function esc(s){ try{ return typeof window.escapeHtml === 'function' ? window.escapeHtml(s) : String(s == null ? '' : s); }catch(e){ return String(s == null ? '' : s); } }
  function lsGet(k, d){ try{ var v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); }catch(e){ return d; } }
  function lsSet(k, v){ try{ localStorage.setItem(k, JSON.stringify(v)); }catch(e){} }
  function fmtTime(s){ return call('fmtTime', s) || (Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0')); }
  function fmtBytes(n){ return call('__scFmtBytes', n) || (n + ' B'); }
  function clockToSec(txt){
    var m = String(txt || '').trim().match(/^(\d+):([0-5]?\d)$/);
    if(m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    var m2 = String(txt || '').trim().match(/^(\d+):(\d+):([0-5]?\d)$/);
    if(m2) return parseInt(m2[1], 10) * 3600 + parseInt(m2[2], 10) * 60 + parseInt(m2[3], 10);
    var n = parseFloat(txt);
    return isFinite(n) ? n : 0;
  }
  function secToClock(s){
    s = Math.max(0, Math.floor(s || 0));
    var m = Math.floor(s / 60), r = s % 60;
    return m + ':' + String(r).padStart(2, '0');
  }
  function trackById(id){ return call('__scTrack', id); }
  function allTracks(){ return call('__scAllTracks') || []; }
  function currentTrack(){ return call('__scCurrentTrack'); }

  /* --------------------------------------------------------------------------
     1. THE ONE DECODED BUFFER
     -------------------------------------------------------------------------- */
  var scratchCtx = null;
  var bufById = {};
  var bufWait = {};
  function ctx(){ 
    if(!scratchCtx){ 
      var C = window.AudioContext || window.webkitAudioContext; 
      scratchCtx = C ? new C() : null; 
    } 
    return scratchCtx;
  }
  function decodeFile(file){
    if(!file) return Promise.reject(new Error('this song has no audio file'));
    var c = ctx();
    if(!c) return Promise.reject(new Error('this device has no audio engine'));
    return new Promise(function(res, rej){
      var reader = new FileReader();
      reader.onload = function(){
        try{ c.decodeAudioData(reader.result, function(b){ res(b); }, function(e){ rej(e || new Error('decode failed')); }); }
        catch(e){ rej(e); }
      };
      reader.onerror = function(){ rej(new Error('could not read the file')); };
      reader.readAsArrayBuffer(file);
    });
  }
  function decoded(t){
    if(!t) return Promise.reject(new Error('nothing is selected'));
    var key = t.id + '@' + (t.cropped ? 'c' : 'n') + ':' + (t.duration || 0);
    if(bufById[key]) return Promise.resolve(bufById[key]);
    if(bufWait[key]) return bufWait[key];
    var p = decodeFile(t.file).then(function(b){
      bufById[key] = b;
      bufWait[key] = null;
      return b;
    }, function(e){ bufWait[key] = null; throw e; });
    bufWait[key] = p;
    return p;
  }
  function sliceBuf(buf, start, end){
    var c = ctx();
    var sr = buf.sampleRate;
    var s0 = Math.max(0, Math.floor((start || 0) * sr));
    var s1 = Math.min(buf.length, Math.ceil((end == null ? buf.duration : end) * sr));
    var len = Math.max(1, s1 - s0);
    var ch = Math.min(2, buf.numberOfChannels || 1);
    var out = c.createBuffer(ch, len, sr);
    for(var i = 0; i < ch; i++){
      var src = buf.getChannelData(Math.min(i, buf.numberOfChannels - 1));
      out.getChannelData(i).set(src.subarray(s0, s0 + len));
    }
    return out;
  }

  /* --------------------------------------------------------------------------
     2. THE LIVE FX CHAIN (inserted by block 1's ensureAudioGraph)
     -------------------------------------------------------------------------- */
  var channels = [null, null];
  var fxDefaults = { rate: 1, reverb: 0, karaoke: 0 };
  var fxState = (function(){
    var s = lsGet(LS.fx, null) || {};
    var o = { rate: 1, reverb: 0, karaoke: 0, preset: '' };
    for(var k in o){ if(typeof s[k] === 'number') o[k] = s[k]; if(typeof s[k] === 'string') o.preset = s[k]; }
    if(o.rate < 0.4) o.rate = 0.4;
    if(o.rate > 1.6) o.rate = 1.6;
    return o;
  })();

  // A synthetic impulse response: exponentially decaying noise on two channels.
  // No network, no file - a slowed + reverb preset has to work on a plane.
  function makeIR(c, seconds, decay){
    var len = Math.max(1, Math.floor(c.sampleRate * (seconds || 2.2)));
    var ir = c.createBuffer(2, len, c.sampleRate);
    for(var ch = 0; ch < 2; ch++){
      var d = ir.getChannelData(ch);
      for(var i = 0; i < len; i++){
        var t = i / len;
        var env = Math.pow(1 - t, decay || 2.6);
        d[i] = (Math.random() * 2 - 1) * env * (i < 40 ? i / 40 : 1);
      }
    }
    return ir;
  }
  // Vocal cancel: out = L - R on both channels, which removes what is panned
  // centre (the lead vocal) and keeps the sides (the band).
  function karaokeNode(c){
    var split = c.createChannelSplitter(2);
    var gL = c.createGain(); gL.gain.value = 1;
    var gR = c.createGain(); gR.gain.value = -1;
    var merge = c.createChannelMerger(2);
    split.connect(gL, 0);
    split.connect(gR, 1);
    gL.connect(merge, 0, 0);
    gR.connect(merge, 0, 0);
    gL.connect(merge, 0, 1);
    gR.connect(merge, 0, 1);
    var gate = c.createGain();
    gate.gain.value = 0;
    merge.connect(gate);
    return { node: gate, gate: gate };
  }
  // Called from block 1 for each deck: deckGain -> [ dry | reverb | karaoke | loop ] -> limiter.
  window.scStudioBuildChain = function(c, idx, upIn, upOut){
    try{
      var fxIn = c.createGain();
      var fxOut = c.createGain();
      var dry = c.createGain();
      var send = c.createGain();
      var conv = c.createConvolver();
      conv.buffer = makeIR(c, 2.2, 2.6);
      var wet = c.createGain();
      var kar = karaokeNode(c);
      var loopIn = c.createGain();
      upIn.connect(fxIn);
      fxIn.connect(dry); dry.connect(fxOut);
      fxIn.connect(send); send.connect(conv); conv.connect(wet); wet.connect(fxOut);
      fxIn.connect(kar.node); kar.node.connect(fxOut);
      loopIn.connect(fxOut);
      fxOut.connect(upOut);
      dry.gain.value = 1; send.gain.value = 0; wet.gain.value = 1; kar.gate.gain.value = 0;
      loopIn.gain.value = 1;
      channels[idx] = { fxIn: fxIn, fxOut: fxOut, dry: dry, send: send, wet: wet, kar: kar, loopIn: loopIn };
      return channels[idx];
    }catch(e){ return null; }
  };
  function applyFx(){
    for(var i = 0; i < 2; i++){
      var n = channels[i];
      if(!n) continue;
      var k = Math.max(0, Math.min(1, fxState.karaoke));
      n.kar.gate.gain.value = k;
      // Duck the dry path as the cancel path comes up, or the two fight and the
      // vocal is only half gone.
      n.dry.gain.value = 1 - (k * 0.9);
      n.send.gain.value = Math.max(0, Math.min(1, fxState.reverb));
    }
  }
  function applyRate(){
    try{
      var els = call('__scAudios') || [];
      for(var i = 0; i < els.length; i++){
        var el = els[i];
        if(!el) continue;
        try{
          el.preservesPitch = (fxState.rate === 1);
          el.mozPreservesPitch = (fxState.rate === 1);
          el.webkitPreservesPitch = (fxState.rate === 1);
        }catch(_e){}
        try{ el.playbackRate = (call('__scPlaybackSpeed') || 1) * fxState.rate; }catch(_e2){}
      }
    }catch(e){}
  }
  // Read by block 1 everywhere it sets a media element's rate, so the Studio
  // speed is a multiplier on the app's own speed rather than a fight with it.
  window.__scStudioRate = function(){ return fxState.rate || 1; };
  function saveFx(){ lsSet(LS.fx, fxState); }
  // Distinct presets tried, not preset taps: the badge is "every Studio preset",
  // so pressing the same one ten times must not walk it.
  function seenPreset(id){
    if(!id) return;
    counters['preset_' + id] = 1;
    counters.presets = Object.keys(counters).filter(function(k){ return k.indexOf('preset_') === 0; }).length;
    lsSet(LS.ctr, counters);
  }
  function setFx(patch, quiet){
    for(var k in patch) fxState[k] = patch[k];
    if(patch && patch.preset) seenPreset(patch.preset);
    saveFx();
    applyFx();
    applyRate();
    renderStudio();
    if(!quiet){
      markFeature('studio');
      if(patch.rate != null) toast('Studio speed ' + fxState.rate.toFixed(2) + 'x' + (fxState.rate === 1 ? ' (off)' : ''));
      else if(patch.reverb != null) toast('Reverb ' + Math.round(fxState.reverb * 100) + '%');
      else if(patch.karaoke != null) toast(fxState.karaoke > 0 ? 'Karaoke mode ' + Math.round(fxState.karaoke * 100) + '% - the lead vocal is pulled out' : 'Karaoke mode off');
    }
  }
  var PRESETS = [
    { id: 'slowed',   name: 'Slowed + reverb', sub: '0.85x, big room',      rate: 0.85, reverb: 0.65, karaoke: 0 },
    { id: 'sloweddeep', name: 'Slowed hard',   sub: '0.70x, underwater',    rate: 0.70, reverb: 0.45, karaoke: 0 },
    { id: 'nightcore', name: 'Nightcore',      sub: '1.28x, dry',           rate: 1.28, reverb: 0.08, karaoke: 0 },
    { id: 'karaoke',  name: 'Karaoke',         sub: 'vocal out',            rate: 1,    reverb: 0.12, karaoke: 1 },
    { id: 'lofi',     name: 'Lo-fi tape',      sub: '0.92x, wet',           rate: 0.92, reverb: 0.35, karaoke: 0 },
    { id: 'off',      name: 'Off',             sub: 'normal playback',      rate: 1,    reverb: 0, karaoke: 0 }
  ];

  /* --------------------------------------------------------------------------
     3. THE SAMPLER (eight pads) AND THE LOOP RECORDER
     -------------------------------------------------------------------------- */
  var sampler = (function(){
    var s = lsGet(LS.pads, null) || {};
    var pads = [];
    var lengths = [0.5, 0.5, 0.5, 0.5, 1, 1, 1, 1];
    for(var i = 0; i < 8; i++){
      var p = (s.pads && s.pads[i]) || {};
      pads.push({ start: typeof p.start === 'number' ? p.start : null, len: typeof p.len === 'number' ? p.len : lengths[i] });
    }
    return { trackId: s.trackId || null, pads: pads, fetched: false };
  })();
  function savePads(){ lsSet(LS.pads, { trackId: sampler.trackId, pads: sampler.pads }); }
  function samplerReady(){
    return !!(sampler.trackId && bufById[Object.keys(bufById).filter(function(k){ return k.indexOf(sampler.trackId + '@') === 0; })[0]]);
  }
  function samplerBuffer(){
    var keys = Object.keys(bufById);
    for(var i = 0; i < keys.length; i++){
      if(keys[i].indexOf(sampler.trackId + '@') === 0) return bufById[keys[i]];
    }
    return null;
  }
  function spreadPads(dur){
    // An even spread across the song, so a fresh sampler is playable with no setup.
    for(var i = 0; i < 8; i++){
      if(sampler.pads[i].start == null) sampler.pads[i].start = Math.max(0, Math.min(dur - sampler.pads[i].len, dur * (i / 8)));
    }
    savePads();
  }
  function loadSamplerFor(t, quiet){
    if(!t) { toast('Play a song first, then open the sampler.'); return Promise.reject(new Error('no track')); }
    sampler.trackId = t.id;
    sampler.fetched = false;
    return decoded(t).then(function(b){
      spreadPads(b.duration);
      sampler.fetched = true;
      if(!quiet) toast('Sampler loaded with "' + (t.name || 'this song') + '"');
      markFeature('sampler');
      renderStudio();
      return b;
    }, function(e){
      toast('Could not load the sampler: ' + (e && e.message ? e.message : 'decode failed'));
      throw e;
    });
  }
  function playPad(i){
    seenPad(i);
    var b = samplerBuffer();
    if(!b){ toast('Load the sampler first.'); return; }
    var pad = sampler.pads[i];
    var c = ctx();
    var ch = channels[0] || channels[1];
    try{
      var src = c.createBufferSource();
      src.buffer = b;
      var g = c.createGain();
      g.gain.value = 1;
      src.connect(g);
      if(ch) g.connect(ch.loopIn); else g.connect(c.destination);
      src.start(0, Math.max(0, pad.start || 0), Math.max(0.05, pad.len || 0.5));
    }catch(e){ toast('Pad could not play: ' + (e.message || e)); return; }
    markFeature('sampler');
    padFlash(i);
  }
  function padFlash(i){
    var el = $('scPad' + i);
    if(!el) return;
    el.classList.add('hit');
    setTimeout(function(){ try{ el.classList.remove('hit'); }catch(e){} }, 180);
  }
  function capturePad(i){
    var t = currentTrack();
    if(!t){ toast('Play a song first.'); return; }
    var a = call('__scActiveAudio');
    var at = a ? a.currentTime : 0;
    sampler.trackId = t.id;
    var pad = sampler.pads[i];
    pad.start = Math.max(0, at - (pad.len / 2));
    savePads();
    audioPing();
    toast('Pad ' + (i + 1) + ' captured at ' + secToClock(pad.start) + ' (' + pad.len.toFixed(2) + 's)');
    markFeature('sampler');
    renderStudio();
  }
  // A short confirmation blip generated on the spot - no asset, no file.
  function audioPing(){
    var c = ctx();
    var ch = channels[0] || channels[1];
    if(!c || !ch) return;
    try{
      var o = c.createOscillator();
      var g = c.createGain();
      o.frequency.value = 880;
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.08, c.currentTime + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.12);
      o.connect(g); g.connect(ch.loopIn);
      o.start(); o.stop(c.currentTime + 0.14);
    }catch(e){}
  }

  var looper = { layers: [], running: false, length: 4 };
  function recordLoop(){
    bump('loops');
    var t = currentTrack();
    if(!t){ toast('Play a song first, then record a loop.'); return; }
    var a = call('__scActiveAudio');
    var at = a ? a.currentTime : 0;
    decoded(t).then(function(b){
      var end = Math.min(b.duration, at + looper.length);
      var piece = sliceBuf(b, at, end);
      var c = ctx();
      var ch = channels[0] || channels[1];
      if(!c || !ch){ toast('No audio engine yet - press play first.'); return; }
      var src = c.createBufferSource();
      src.buffer = piece;
      src.loop = true;
      var g = c.createGain();
      g.gain.value = 0.85;
      src.connect(g); g.connect(ch.loopIn);
      src.start();
      looper.layers.push({ src: src, gain: g });
      looper.running = true;
      markFeature('looper');
      toast('Loop ' + looper.layers.length + ' recorded - ' + looper.length + 's, repeating');
      renderStudio();
    }, function(e){ toast('Loop could not be recorded: ' + (e && e.message ? e.message : 'decode failed')); });
  }
  function stopLoops(){
    looper.layers.forEach(function(l){ try{ l.src.stop(); }catch(e){} try{ l.src.disconnect(); }catch(e){} });
    looper.layers = [];
    looper.running = false;
    renderStudio();
  }

  /* --------------------------------------------------------------------------
     3b. THE SLEEP TIMER, THE PRACTICE LOOP, AND YOUR OWN PRESETS (70.1.3)

     "add more features to studio", and then "Remove premium make everything
     free keep donations". So the two tools that remember things for you are
     just here: the loop that steps up as you learn the part, and presets you
     save yourself. There is no half of Studio to pay for and no entitlement to
     ask the app for - 70.1.3 took the paywall out of the whole app.
     -------------------------------------------------------------------------- */

  // ---- the sleep timer (free) ---------------------------------------------
  var SLEEP_CHOICES = [
    ['off',   'Off',               'stop it'],
    ['5',     '5 min',             ''],
    ['15',    '15 min',            ''],
    ['30',    '30 min',            ''],
    ['45',    '45 min',            ''],
    ['song',  'End of this song',  'when the song does'],
    ['queue', 'End of the queue',  'after the last queued song']
  ];
  var sleep = { mode: '', until: 0, timer: 0, bound: null };
  function sleepClear(){
    if(sleep.timer){ clearTimeout(sleep.timer); sleep.timer = 0; }
    if(sleep.bound){
      try{ sleep.bound.el.removeEventListener('ended', sleep.bound.fn); }catch(_e){ }
      sleep.bound = null;
    }
    sleep.mode = ''; sleep.until = 0;
  }
  function sleepLabel(){
    if(!sleep.mode) return '';
    if(sleep.mode === 'song') return 'stops with this song';
    if(sleep.mode === 'queue') return 'stops after the queue';
    var left = Math.max(0, Math.round((sleep.until - Date.now()) / 60000));
    return 'pauses in ' + left + ' min';
  }
  function sleepFire(){
    sleepClear();
    call('__scPause');
    toast('\ud83c\udf19 Sleep timer: paused. Tap play when you are back.');
    renderStudio();
  }
  function setSleep(mode){
    sleepClear();
    if(!mode || mode === 'off'){ toast('Sleep timer off.'); renderStudio(); return; }
    sleep.mode = mode;
    if(mode === 'song' || mode === 'queue'){
      var el = call('__scActiveAudio');
      if(!el){ sleepClear(); toast('Play something first and the timer will stop it.'); renderStudio(); return; }
      var fn = function(){
        // "End of the queue" means the LAST queued song: the app advances on its
        // own, so this only fires when there is nothing after this one.
        if(mode === 'queue'){
          var q = call('__scQueue') || [], i = call('__scQueueIndex') || 0;
          if(i < q.length - 1) return;
        }
        sleepFire();
      };
      try{ el.addEventListener('ended', fn); }catch(_e2){ }
      sleep.bound = { el: el, fn: fn };
    } else {
      var min = parseInt(mode, 10) || 0;
      if(min > 0){
        sleep.until = Date.now() + min * 60000;
        sleep.timer = setTimeout(sleepFire, min * 60000);
      }
    }
    markFeature('sleep');
    toast('Sleep timer: ' + (sleepLabel() || 'on'));
    renderStudio();
  }

  // ---- the practice loop ---------------------------------------------------
  var practice = { on: false, a: 0, b: 0, ramp: false, passes: 0, tick: 0 };
  function practiceMark(which){
    var el = call('__scActiveAudio');
    if(!el){ toast('Play a song first, then set the loop.'); return; }
    var at = Math.round((el.currentTime || 0) * 10) / 10;
    if(which === 'a'){
      practice.a = at;
      if(practice.b && practice.b <= practice.a + 1) practice.b = 0;
    } else {
      practice.b = at;
      if(practice.a && practice.b <= practice.a + 1) practice.a = 0;
    }
    toast((which === 'a' ? 'Loop start' : 'Loop end') + ': ' + secToClock(at));
    renderStudio();
    openPracticeSheet();
  }
  function practiceStop(quiet){
    if(practice.tick){ clearInterval(practice.tick); practice.tick = 0; }
    var was = practice.on;
    practice.on = false;
    if(!quiet){
      practice.passes = 0;
      if(was) toast('Practice loop off.');
      renderStudio();
    }
  }
  function practiceRun(){
    practiceStop(true);
    if(!practice.a && !practice.b){ toast('Set the loop start first - play the song and press Set A.'); return; }
    if(practice.b <= practice.a){ toast('Set the loop end after the loop start.'); return; }
    practice.on = true;
    practice.passes = 0;
    markFeature('practice');
    bump('practiceRuns');
    practice.tick = setInterval(function(){
      var el = call('__scActiveAudio');
      if(!el || el.paused) return;
      var cur = el.currentTime || 0;
      // Past the end, or before the start (the user or the app sought away), so
      // the section is entered again rather than left half-played.
      if(cur >= practice.b || cur < practice.a - 0.35){
        try{ el.currentTime = practice.a; }catch(_e){ }
        practice.passes++;
        if(practice.ramp && practice.passes % 2 === 0){
          fxState.rate = Math.min(1.5, Math.round((fxState.rate + 0.05) * 100) / 100);
          applyRate();
        }
      }
    }, 120);
    toast('Practice loop: ' + secToClock(practice.a) + ' - ' + secToClock(practice.b) +
      (practice.ramp ? ', speeding up every other pass' : ''));
    renderStudio();
  }

  // ---- your own presets ----------------------------------------------------
  // The built-in presets are a taste; this is the chain you actually arrived at,
  // saved under your own name. Stored beside the rest of the Studio state.
  var myPresets = lsGet(LS.mypresets, []) || [];
  function myPresetsHtml(){
    var head = '<div class="sc-sub-head">Your presets</div>';
    var rows = myPresets.length
      ? myPresets.map(function(p){
          return '<div class="sc-reward"><div class="sc-reward-at">' + Math.round(p.rate * 100) + '</div>' +
            '<div class="sc-reward-txt"><div class="sc-reward-name">' + esc(p.name) + '</div>' +
            '<div class="sc-reward-note">' + p.rate.toFixed(2) + 'x \u00b7 ' + Math.round(p.reverb * 100) + '% wet' +
              (p.karaoke > 0 ? ' \u00b7 vocal out ' + Math.round(p.karaoke * 100) + '%' : '') + '</div></div>' +
            '<div class="sc-reward-act"><button class="sc-btn tiny primary" data-myuse="' + p.id + '">Use</button>' +
              '<button class="sc-btn tiny" data-mydrop="' + p.id + '">Delete</button></div></div>';
        }).join('')
      : '<div class="sc-note">Nothing saved yet. Set the speed, the reverb and the vocal out how you like them, then name the chain and keep it.</div>';
    var save = '<div style="display:flex;gap:8px;align-items:center;margin-top:10px;"><input type="text" id="scMyName" maxlength="40" placeholder="Name this chain" autocomplete="off"><button class="sc-btn primary" id="scMySave">Save current</button></div>';
    return head + rows + save;
  }
  function saveMyPreset(){
    var el = $('scMyName');
    var name = el ? String(el.value || '').trim() : '';
    if(!name) name = 'My chain ' + (myPresets.length + 1);
    if(name.length > 40) name = name.slice(0, 40);
    myPresets.push({ id: 'my' + Date.now(), name: name, rate: fxState.rate, reverb: fxState.reverb, karaoke: fxState.karaoke });
    lsSet(LS.mypresets, myPresets);
    bump('myPresets');
    toast('Saved "' + name + '" to your presets.');
    openFxSheet();
  }
  function useMyPreset(id){
    var p = myPresets.filter(function(x){ return x.id === id; })[0];
    if(!p) return;
    setFx({ rate: p.rate, reverb: p.reverb, karaoke: p.karaoke, preset: '' }, true);
    markFeature('studio');
    if(p.rate !== 1) markFeature('slow');
    if(p.karaoke > 0) markFeature('karaoke');
    toast('Preset: ' + p.name);
    openFxSheet();
  }
  function dropMyPreset(id){
    myPresets = myPresets.filter(function(x){ return x.id !== id; });
    lsSet(LS.mypresets, myPresets);
    openFxSheet();
  }

  /* --------------------------------------------------------------------------
     4. CROP -> SHARE AS CLIP, AND THE RE-ENCODER
     -------------------------------------------------------------------------- */
  var clip = { start: 0, end: 30, dur: 0, tr: null, busy: false };

  // 70.0.8 - "Crop song in studio should be like one for songs". 70.0 had put a
  // SECOND cropper here: a clip exporter that writes a new file. The song menu
  // trims the song you already have, in place, and Undo crop in the song info
  // sheet puts it back - that is the one a crop should be, so the card opens
  // exactly that, on the song that is loaded. The app owns the modal; the hook is
  // the only way across from this block.
  function cropCurrent(){
    var t = workTrack();
    if(!t){ toast('Add a song to your library and it can be cropped here.'); return false; }
    if(!t.file){ toast('This song has no audio file to crop.'); return false; }
    if(!call('__scCropSong', t.id)){ toast('The cropper is not available in this build.'); return false; }
    bump('studio');
    return true;
  }
  function openClipSheet(preStart, preEnd){
    var t = workTrack();
    if(!t){ toast('Add a song to your library and it can be clipped here.'); return false; }
    clip.tr = t;
    clip.busy = true;
    clip.start = preStart != null ? preStart : 0;
    clip.end = preEnd != null ? preEnd : 30;
    clip.dur = t.duration || 0;
    openSheet('Export a clip', '<div class="sc-note">Reading the song so the range can be picked by ear\u2026</div>');
    decoded(t).then(function(b){
      clip.dur = b.duration;
      if(preEnd == null) clip.end = Math.min(b.duration, 30);
      clip.start = Math.max(0, Math.min(b.duration - 0.5, clip.start));
      clip.end = Math.max(clip.start + 0.5, Math.min(b.duration, clip.end));
      clip.busy = false;
      paintClipSheet();
    }, function(e){
      clip.busy = false;
      openSheet('Export a clip', '<div class="sc-note sc-bad">Could not read this song\u2019s audio: ' + esc(e && e.message ? e.message : 'decode failed') + '</div>');
    });
    return true;
  }
  function paintClipSheet(){
    var t = clip.tr;
    var selLen = Math.max(0, clip.end - clip.start);
    var body = '' +
      '<div class="sc-songline"><div class="sc-art" style="' + (t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
      '<div><div class="sc-songname">' + esc(t.name || 'Untitled') + '</div>' +
      '<div class="sc-songsub">' + esc(t.artist || 'Unknown artist') + ' \u00b7 ' + secToClock(clip.dur) + ' long</div></div></div>' +
      '<div class="sc-clipbar" id="scClipBar">' +
        '<div class="sc-clipsel" id="scClipSel"></div>' +
        '<div class="sc-clipedge start" id="scClipStart"></div>' +
        '<div class="sc-clipedge end" id="scClipEnd"></div>' +
      '</div>' +
      '<div class="sc-row2">' +
        '<label>From<input type="text" id="scClipFrom" value="' + secToClock(clip.start) + '"></label>' +
        '<label>To<input type="text" id="scClipTo" value="' + secToClock(clip.end) + '"></label>' +
      '</div>' +
      '<div class="sc-chips">' +
        '<button class="sc-chip" data-clipnudge="-5">&minus;5s</button>' +
        '<button class="sc-chip" data-clipnudge="-1">&minus;1s</button>' +
        '<button class="sc-chip" data-clipnudge="1">+1s</button>' +
        '<button class="sc-chip" data-clipnudge="5">+5s</button>' +
        '<button class="sc-chip" data-cliptrue="1">Whole song</button>' +
        '<button class="sc-chip" data-clipring="1">30s ringtone</button>' +
      '</div>' +
      '<div class="sc-note">Length <b id="scClipLen">' + secToClock(selLen) + '</b> \u00b7 written as its own tagged MP3, tagged with the song\u2019s own artist, album and cover art. It leaves the song in your library untouched.</div>' +
      '<div class="sc-actions"><button class="sc-btn primary" id="scClipGo">Export clip</button><button class="sc-btn" id="scClipCancel">Cancel</button></div>';
    openSheet('Export a clip', body);
    paintClipSel();
    document.querySelectorAll('#scSheetBody [data-clipnudge]').forEach(function(b){
      b.addEventListener('click', function(){
        var d = parseFloat(b.getAttribute('data-clipnudge'));
        clip.end = Math.max(clip.start + 0.5, Math.min(clip.dur, clip.end + d));
        var f = $('scClipTo'); if(f) f.value = secToClock(clip.end);
        paintClipSel();
      });
    });
    var wh = document.querySelector('#scSheetBody [data-cliptrue]');
    if(wh) wh.addEventListener('click', function(){
      clip.start = 0; clip.end = clip.dur;
      var f = $('scClipFrom'); if(f) f.value = '0:00';
      var t2 = $('scClipTo'); if(t2) t2.value = secToClock(clip.dur);
      paintClipSel();
    });
    var ring = document.querySelector('#scSheetBody [data-clipring]');
    if(ring) ring.addEventListener('click', function(){
      clip.start = 0; clip.end = Math.min(clip.dur, 30);
      var f = $('scClipFrom'); if(f) f.value = '0:00';
      var t2 = $('scClipTo'); if(t2) t2.value = secToClock(clip.end);
      paintClipSel();
    });
    ['scClipFrom', 'scClipTo'].forEach(function(id){
      var el = $(id);
      if(!el) return;
      el.addEventListener('change', function(){
        var v = clockToSec(el.value);
        if(id === 'scClipFrom') clip.start = Math.max(0, Math.min(clip.dur - 0.5, v));
        else clip.end = Math.max(clip.start + 0.5, Math.min(clip.dur, v || clip.dur));
        var f = $('scClipFrom'); if(f) f.value = secToClock(clip.start);
        var t2 = $('scClipTo'); if(t2) t2.value = secToClock(clip.end);
        paintClipSel();
      });
    });
    var go = $('scClipGo');
    if(go) go.addEventListener('click', exportClip);
    var cx = $('scClipCancel');
    if(cx) cx.addEventListener('click', closeSheet);
  }
  function paintClipSel(){
    var pct = function(v){ return (clip.dur ? (v / clip.dur) * 100 : 0) + '%'; };
    var sel = $('scClipSel');
    if(sel) { sel.style.left = pct(clip.start); sel.style.right = (100 - (clip.dur ? (clip.end / clip.dur) * 100 : 0)) + '%'; }
    var s = $('scClipStart'); if(s) s.style.left = pct(clip.start);
    var e = $('scClipEnd'); if(e) e.style.left = pct(clip.end);
    var l = $('scClipLen'); if(l) l.textContent = secToClock(Math.max(0, clip.end - clip.start));
  }
  function exportClip(){
    bump('clips');
    if(clip.busy || !clip.tr) return;
    var len = clip.end - clip.start;
    if(len < 0.5){ toast('Pick at least half a second.'); return; }
    var tr = clip.tr;
    clip.busy = true;
    var go = $('scClipGo');
    if(go){ go.disabled = true; go.textContent = 'Encoding\u2026'; }
    decoded(tr).then(function(b){
      var piece = sliceBuf(b, clip.start, clip.end);
      var meta = tagMetaFor(tr, (tr.name || 'Clip') + ' (clip ' + secToClock(clip.start) + '-' + secToClock(clip.end) + ')');
      return window.__scEncodeMp3(piece, 192, meta).then(function(blob){
        if(!blob) throw new Error('the encoder produced no output');
        var base = (tr.file && tr.file.name ? tr.file.name.replace(/\.[^/.]+$/, '') : (tr.name || 'clip'));
        var fname = base + ' - clip ' + secToClock(clip.start).replace(':', 'm') + 's.mp3';
        var delivered = window.__scSaveClip(blob, fname);
        return delivered.then(function(ok){
          clip.busy = false;
          markFeature('clip');
          closeSheet();
          toast(ok ? 'Clip saved \u00b7 ' + secToClock(len) + ' \u00b7 ' + fname : 'Clip ready \u00b7 ' + secToClock(len) + ' \u00b7 ' + fname, 4200);
        });
      });
    }).catch(function(e){
      clip.busy = false;
      toast('Export failed: ' + (e && e.message ? e.message : 'could not encode the clip'));
      if(go){ go.disabled = false; go.textContent = 'Export clip'; }
    });
  }
  function tagMetaFor(t, title){
    var meta = {
      title: title || t.name || '',
      artist: t.artist || '',
      album: t.album || '',
      year: t.releaseDate ? String(t.releaseDate).slice(0, 4) : null,
      genre: t.genre || null,
      track: null
    };
    return new Promise(function(res){
      if(t.artBlob){
        var r = new FileReader();
        r.onload = function(){ try{ meta.artBytes = new Uint8Array(r.result); meta.artMime = t.artBlob.type || 'image/jpeg'; }catch(e){} res(meta); };
        r.onerror = function(){ res(meta); };
        r.readAsArrayBuffer(t.artBlob);
      } else res(meta);
    });
  }

  // ---- re-encode to a smaller bitrate, in place, with the crop's own undo ----
  var REENCODE_RATES = [96, 128, 160];
  // 72.2 - the re-encode itself, split out of its own button so a batch can run
  // the same code. It resolves with the bytes won back, and it does not toast:
  // the caller decides what to say, because a batch has one voice for many songs.
  function reencodeOne(t, kbps){
    if(!t || !t.file) return Promise.reject(new Error('no audio file to re-encode'));
    return decoded(t).then(function(b){
      return tagMetaFor(t).then(function(meta){
        // A re-encode of a lossless file is the case that pays: keep the length,
        // drop the bitrate.
        return window.__scEncodeMp3(b, kbps, meta).then(function(blob){
          if(!blob) throw new Error('the encoder produced no output');
          var oldBlob = t.file;
          var oldUrl = t.url;
          var oldDur = t.duration;
          var oldSize = t.file.size || 0;
          try{ if(oldUrl && oldUrl.indexOf('blob:') === 0) URL.revokeObjectURL(oldUrl); }catch(e){}
          try{ if(!t._preReencodeFile) { t._preReencodeFile = oldBlob; t._preReencodeDuration = oldDur; } }catch(e){}
          var newFile = new File([blob], (t.file && t.file.name ? t.file.name.replace(/\.[^/.]+$/, '') : (t.name || 'track')) + '.mp3', { type: 'audio/mpeg' });
          t.file = newFile;
          t.url = URL.createObjectURL(newFile);
          t.duration = oldDur || (b.duration || 0);
          t.reencoded = true;
          t.waveform = null;
          call('__scPersistTrack', t);
          try{ window.__scRefreshMedia && window.__scRefreshMedia(t); }catch(e){}
          markFeature('reencode');
          var saved = Math.max(0, oldSize - newFile.size);
          bump('savedBytes', saved);
          return saved;
        });
      });
    });
  }
  function reencodeTrack(id, kbps, btn){
    var t = trackById(id);
    if(!t || !t.file){ toast('That song has no audio file to re-encode.'); return; }
    if(btn){ btn.disabled = true; btn.textContent = 'Encoding\u2026'; }
    reencodeOne(t, kbps).then(function(saved){
      renderStudio();
      toastWithUndo('Re-encoded "' + (t.name || 'song') + '" at ' + kbps + ' kbps \u2014 ' + fmtBytes(saved) + ' smaller', function(){ undoReencode(id); });
    }).catch(function(e){
      toast('Re-encode failed: ' + (e && e.message ? e.message : 'could not encode'));
      if(btn){ btn.disabled = false; btn.textContent = 'Re-encode'; }
    });
  }
  function undoReencode(id){
    var t = trackById(id);
    if(!t || !t._preReencodeFile){ toast('Nothing to undo for that song.'); return; }
    try{ if(t.url && t.url.indexOf('blob:') === 0) URL.revokeObjectURL(t.url); }catch(e){}
    t.file = t._preReencodeFile;
    try{ t.url = URL.createObjectURL(t.file); }catch(e){}
    if(t._preReencodeDuration) t.duration = t._preReencodeDuration;
    t.reencoded = false;
    t._preReencodeFile = null;
    t._preReencodeDuration = null;
    t.waveform = null;
    call('__scPersistTrack', t);
    renderStudio();
    toast('Back to the original file for "' + (t.name || 'song') + '".');
  }
  // The undo chip the crop flow already uses, reached from here so a re-encode
  // gets the same one-tap reversal instead of a second idiom.
  var undoHideAt = 0;
  function toastWithUndo(msg, fn){
    if(typeof window.toastWithUndo === 'function'){ window.toastWithUndo(msg, fn); return; }
    toast(msg);
  }

  /* --------------------------------------------------------------------------
     5. ACHIEVEMENTS AND STREAKS (built on the app's own stats)
     -------------------------------------------------------------------------- */
  var achState = lsGet(LS.ach, {}) || {};
  var flags = lsGet(LS.flags, {}) || {};
  function markFeature(k){
    // The flag is once-ever; the counter is every time. 'crop' arrives from the
    // app's own crop button, which calls SC70.markFeature, so its counter lives
    // here rather than in a second hook the app would have to remember to call.
    if(k === 'crop') bump('crops');
    if(flags[k]) return;
    flags[k] = Date.now();
    lsSet(LS.flags, flags);
  }
  function stats(){
    var s = call('__scStats') || {};
    return s;
  }
  /* --------------------------------------------------------------------------
     5b. THE WALL - 150 BADGES, EACH ONE A THING, AND ONE THAT IS NOT ON IT

     The owner, 73.3.8: "just make it 150 meaningful badges plus secret badge
     instead of 201 random badges". 70.0.5 had grown a wall of two hundred by
     GENERATING 171 of them from threshold tables - thirteen rungs on plays,
     sixteen on hours, fourteen on the streak - and a wall like that reads as
     filler, because most tiles differ from the tile beside them by a number.
     The tables are gone. Every badge below is a hand-written line: its own
     name, its own sentence, and a goal that means something on its own.

     Three things stay true, and all three are asserted by the gate:

       * Every badge is REACHABLE by using the app normally, and none of them
         asks for a song to be shared, exported or EDITED. Crop, the batch tag
         editor and the re-encoder are tools with their own undo - 70.0.6 took
         them off the wall at the owner's word - and no counter they feed is
         read here.
       * Nothing on the wall can go quietly unearnable. Every entry names a
         signal, the gate walks all 150 and proves each key resolves to a real
         number, and the targets are the ones a year of real listening reaches.
       * The five rewards are gated LIVE off the count (REWARDS, below), so
         there is nothing to unlock, nothing to lose on a restore that keeps
         badges, and no state that can disagree with the badges themselves.
     -------------------------------------------------------------------------- */
  // One entry per badge: g the group, n the name, d what it asks for, i the
  // icon, k the signal it counts, w the number that earns it. The id is the
  // slug of the name, so a badge keeps its identity across releases.
  var WALL = [
    // ---- Listening ----
    { g: 'listen', k: 'plays', w: 1, n: 'First spin', d: 'Play one song', i: '\u25b6' },
    { g: 'listen', k: 'plays', w: 10, n: 'Warmed up', d: '10 songs played', i: '\u266b' },
    { g: 'listen', k: 'plays', w: 50, n: 'Fifty deep', d: '50 songs played', i: '\u266b' },
    { g: 'listen', k: 'plays', w: 200, n: 'Two hundred club', d: '200 songs played', i: '\u266b' },
    { g: 'listen', k: 'plays', w: 500, n: 'Five hundred club', d: '500 songs played', i: '\u266b' },
    { g: 'listen', k: 'plays', w: 1000, n: 'Thousand club', d: '1,000 songs played', i: '\u266a' },
    { g: 'listen', k: 'plays', w: 2000, n: 'Two thousand', d: '2,000 songs played', i: '\u266a' },
    { g: 'listen', k: 'plays', w: 3000, n: 'Three thousand', d: '3,000 songs played', i: '\u266a' },
    { g: 'listen', k: 'minutes', w: 10, n: 'Ten minutes in', d: '10 minutes listened', i: '\u23f1' },
    { g: 'listen', k: 'hours', w: 1, n: 'First hour', d: '1 hour listened', i: '\u23f1' },
    { g: 'listen', k: 'hours', w: 10, n: 'Ten hours', d: '10 hours listened', i: '\u23f1' },
    { g: 'listen', k: 'hours', w: 24, n: 'A day of sound', d: '24 hours listened', i: '\u23f1' },
    { g: 'listen', k: 'hours', w: 50, n: 'Fifty hours', d: '50 hours listened', i: '\u23f1' },
    { g: 'listen', k: 'hours', w: 100, n: 'Century of sound', d: '100 hours listened', i: '\ud83c\udfc6' },
    { g: 'listen', k: 'hours', w: 200, n: 'Two hundred hours', d: '200 hours listened', i: '\ud83c\udfc6' },
    { g: 'listen', k: 'maxPlays', w: 10, n: 'On repeat', d: 'One song played 10 times', i: '\ud83d\udd01' },
    { g: 'listen', k: 'maxPlays', w: 25, n: 'Obsessed', d: 'One song played 25 times', i: '\ud83d\udd01' },
    { g: 'listen', k: 'maxPlays', w: 50, n: 'Fifty times', d: 'One song played 50 times', i: '\ud83d\udd01' },
    { g: 'listen', k: 'maxPlays', w: 100, n: 'A hundred times', d: 'One song played 100 times', i: '\ud83d\udc9c' },
    { g: 'listen', k: 'playedTracks', w: 10, n: 'Broad taste', d: '10 different songs played', i: '\ud83d\udcda' },
    { g: 'listen', k: 'playedTracks', w: 50, n: 'Fifty songs in', d: '50 different songs played', i: '\ud83d\udcda' },
    { g: 'listen', k: 'playedTracks', w: 200, n: 'Two hundred songs', d: '200 different songs played', i: '\ud83d\udcda' },
    { g: 'listen', k: 'playedTracks', w: 500, n: 'Deep cut', d: '500 different songs played', i: '\ud83d\udcda' },
    { g: 'listen', k: 'playedShare', w: 0.5, n: 'Half the shelf', d: 'Half your library played', i: '\u25d0' },
    { g: 'listen', k: 'playedShare', w: 0.8, n: 'Almost all of it', d: '80% of your library played', i: '\u25cf' },
    { g: 'listen', k: 'queue', w: 1, n: 'Lined up', d: 'Queue a song to play next', i: '\ud83d\udd1c' },
    { g: 'listen', k: 'queue', w: 25, n: 'Queue builder', d: '25 songs queued', i: '\ud83d\udd1c' },
    { g: 'listen', k: 'search', w: 1, n: 'Found it', d: 'Search your library', i: '\ud83d\udd0e' },
    { g: 'listen', k: 'search', w: 25, n: 'Search habit', d: '25 library searches', i: '\ud83d\udd0e' },
    { g: 'listen', k: 'shuffle', w: 1, n: 'Shuffled', d: 'Turn on shuffle', i: '\ud83d\udd00' },
    { g: 'listen', k: 'repeat', w: 1, n: 'On a loop', d: 'Turn on repeat', i: '\ud83d\udd02' },
    { g: 'listen', k: 'lyrics', w: 1, n: 'Words on screen', d: 'Open the lyrics', i: '\ud83d\udcac' },
    { g: 'listen', k: 'lyrics', w: 25, n: 'Sing along', d: 'Open the lyrics 25 times', i: '\ud83d\udcac' },
    { g: 'listen', k: 'used_autodj', w: 1, n: 'Blended', d: 'Hear a beat-matched crossfade', i: '\ud83c\udf9a' },
    // ---- Streaks ----
    { g: 'streak', k: 'streak', w: 2, n: 'Back tomorrow', d: '2-day listening streak', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 3, n: 'Three in a row', d: '3-day listening streak', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 5, n: 'Five days', d: '5-day listening streak', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 7, n: 'Seven-day streak', d: '7 days in a row', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 14, n: 'Fortnight', d: '14 days in a row', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 30, n: 'A month of days', d: '30 days in a row', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 60, n: 'Two months running', d: '60 days in a row', i: '\ud83d\udd25' },
    { g: 'streak', k: 'streak', w: 100, n: 'Hundred days', d: '100 days in a row', i: '\ud83d\udcaf' },
    { g: 'streak', k: 'streak', w: 180, n: 'Half a year', d: '180 days in a row', i: '\ud83c\udf17' },
    { g: 'streak', k: 'longest', w: 30, n: 'Personal best', d: 'Best streak of 30 days', i: '\u2b50' },
    // ---- Library ----
    { g: 'library', k: 'library', w: 1, n: 'A start', d: 'One song in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 10, n: 'Ten shelved', d: '10 songs in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 50, n: 'Fifty shelved', d: '50 songs in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 100, n: 'Shelved 100', d: '100 songs in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 250, n: 'Shelved 250', d: '250 songs in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 500, n: 'Shelved 500', d: '500 songs in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 1000, n: 'A thousand songs', d: '1,000 songs in the library', i: '\u2630' },
    { g: 'library', k: 'library', w: 2000, n: 'Two thousand songs', d: '2,000 songs in the library', i: '\u2630' },
    { g: 'library', k: 'albums', w: 1, n: 'An album', d: '1 album in your library', i: '\ud83d\udcc0' },
    { g: 'library', k: 'albums', w: 3, n: 'Three albums', d: '3 albums in your library', i: '\ud83d\udcc0' },
    { g: 'library', k: 'albums', w: 6, n: 'Six albums', d: '6 albums in your library', i: '\ud83d\udcc0' },
    { g: 'library', k: 'albums', w: 12, n: 'A dozen albums', d: '12 albums in your library', i: '\ud83d\udcc0' },
    { g: 'library', k: 'albums', w: 20, n: 'Twenty albums', d: '20 albums in your library', i: '\ud83d\udcc0' },
    { g: 'library', k: 'playlists', w: 1, n: 'First playlist', d: '1 playlist of your own', i: '\ud83d\udcdc' },
    { g: 'library', k: 'playlists', w: 3, n: 'Three playlists', d: '3 playlists of your own', i: '\ud83d\udcdc' },
    { g: 'library', k: 'playlists', w: 6, n: 'Six playlists', d: '6 playlists of your own', i: '\ud83d\udcdc' },
    { g: 'library', k: 'playlists', w: 12, n: 'A dozen playlists', d: '12 playlists of your own', i: '\ud83d\udcdc' },
    { g: 'library', k: 'favorites', w: 1, n: 'Marked one', d: '1 favorite', i: '\u2665' },
    { g: 'library', k: 'favorites', w: 5, n: 'Five favorites', d: '5 favorites', i: '\u2665' },
    { g: 'library', k: 'favorites', w: 25, n: 'Twenty-five favorites', d: '25 favorites', i: '\u2665' },
    { g: 'library', k: 'favorites', w: 100, n: 'A hundred favorites', d: '100 favorites', i: '\u2665' },
    { g: 'library', k: 'artists', w: 10, n: 'Ten artists', d: '10 artists in your library', i: '\ud83c\udfa4' },
    { g: 'library', k: 'artists', w: 50, n: 'Fifty artists', d: '50 artists in your library', i: '\ud83c\udfa4' },
    { g: 'library', k: 'artists', w: 100, n: 'A hundred artists', d: '100 artists in your library', i: '\ud83c\udfa4' },
    { g: 'library', k: 'genres', w: 10, n: 'Ten genres', d: '10 genres in your library', i: '\ud83c\udfbc' },
    { g: 'library', k: 'genres', w: 20, n: 'Twenty genres', d: '20 genres in your library', i: '\ud83c\udfbc' },
    // ---- Studio & the deck ----
    { g: 'studio', k: 'used_studio', w: 1, n: 'Into the studio', d: 'Open Studio and use a tool', i: '\ud83c\udfa7' },
    { g: 'studio', k: 'studio', w: 10, n: 'Studio regular', d: 'Visit Studio 10 times', i: '\ud83c\udfa7' },
    { g: 'studio', k: 'studio', w: 50, n: 'Studio habit', d: 'Visit Studio 50 times', i: '\ud83c\udfa7' },
    { g: 'studio', k: 'studio', w: 100, n: 'Studio resident', d: 'Visit Studio 100 times', i: '\ud83c\udfa7' },
    { g: 'studio', k: 'used_slow', w: 1, n: 'Slowed and wet', d: 'Use slowed + reverb', i: '\ud83c\udf0a' },
    { g: 'studio', k: 'used_karaoke', w: 1, n: 'Take the mic', d: 'Use karaoke mode', i: '\ud83c\udfa4' },
    { g: 'studio', k: 'used_sampler', w: 1, n: 'Pad one', d: 'Play a sampler pad', i: '\ud83c\udf9b' },
    { g: 'studio', k: 'used_looper', w: 1, n: 'Loop it', d: 'Record a loop', i: '\ud83d\udd01' },
    { g: 'studio', k: 'used_clip', w: 1, n: 'Clip artist', d: 'Export a clip', i: '\u2702' },
    { g: 'studio', k: 'toolsFive', w: 5, n: 'Every tool', d: 'Use all five Studio tools', i: '\ud83d\udee0' },
    { g: 'studio', k: 'pads', w: 1, n: 'First pad', d: '1 sampler pad used', i: '\ud83c\udfb9' },
    { g: 'studio', k: 'pads', w: 4, n: 'Four pads', d: '4 sampler pads used', i: '\ud83c\udfb9' },
    { g: 'studio', k: 'pads', w: 8, n: 'All eight pads', d: 'Every sampler pad used', i: '\ud83c\udfb9' },
    { g: 'studio', k: 'presets', w: 1, n: 'First preset', d: '1 Studio preset tried', i: '\ud83c\udf9a' },
    { g: 'studio', k: 'presets', w: 3, n: 'Three presets', d: '3 Studio presets tried', i: '\ud83c\udf9a' },
    { g: 'studio', k: 'presets', w: 6, n: 'Every preset', d: 'All six Studio presets', i: '\ud83c\udf9a' },
    { g: 'studio', k: 'myPresets', w: 1, n: 'My own preset', d: 'Save a preset of your own', i: '\ud83d\udcbe' },
    { g: 'studio', k: 'myPresets', w: 3, n: 'Preset keeper', d: 'Save three of your own presets', i: '\ud83d\udcbe' },
    { g: 'studio', k: 'myPresets', w: 5, n: 'Preset library', d: 'Save five of your own presets', i: '\ud83d\udcbe' },
    { g: 'studio', k: 'loops', w: 1, n: 'Loop one', d: '1 loop recorded', i: '\ud83d\udd01' },
    { g: 'studio', k: 'loops', w: 5, n: 'Five loops', d: '5 loops recorded', i: '\ud83d\udd01' },
    { g: 'studio', k: 'loops', w: 25, n: 'Loop layer', d: '25 loops recorded', i: '\ud83d\udd01' },
    { g: 'studio', k: 'loops', w: 100, n: 'Loop master', d: '100 loops recorded', i: '\ud83d\udd01' },
    { g: 'studio', k: 'clips', w: 1, n: 'Clip one', d: '1 clip exported', i: '\u2702' },
    { g: 'studio', k: 'clips', w: 5, n: 'Clip cutter', d: '5 clips exported', i: '\u2702' },
    { g: 'studio', k: 'clips', w: 25, n: 'Clip factory', d: '25 clips exported', i: '\u2702' },
    { g: 'studio', k: 'cleaner', w: 1, n: 'Space saver', d: 'Open the storage cleaner', i: '\ud83e\uddf9' },
    { g: 'studio', k: 'cleaner', w: 10, n: 'Tidy habit', d: 'Open the cleaner 10 times', i: '\ud83e\uddf9' },
    { g: 'studio', k: 'used_practice', w: 1, n: 'Practice makes', d: 'Run the practice loop', i: '\ud83c\udfaf' },
    { g: 'studio', k: 'practiceRuns', w: 5, n: 'Practice five', d: 'Run the practice loop 5 times', i: '\ud83c\udfaf' },
    { g: 'studio', k: 'used_sleep', w: 1, n: 'Lights out', d: 'Set the sleep timer', i: '\ud83c\udf19' },
    { g: 'studio', k: 'used_bpm', w: 1, n: 'Reading the tempo', d: 'Read a song tempo', i: '\ud83e\udd41' },
    { g: 'studio', k: 'tapTempo', w: 1, n: 'Tap it out', d: 'Tap the tempo by hand', i: '\ud83d\udc46' },
    { g: 'studio', k: 'djmode', w: 1, n: 'On the decks', d: 'Open DJ mode', i: '\ud83c\udf9a' },
    { g: 'studio', k: 'djmode', w: 25, n: 'Resident DJ', d: 'Open DJ mode 25 times', i: '\ud83c\udf9a' },
    { g: 'studio', k: 'djCue', w: 1, n: 'Cue it', d: 'Use the cue button', i: '\ud83c\udfaf' },
    { g: 'studio', k: 'djSync', w: 1, n: 'Locked in', d: 'Beat-sync the deck', i: '\ud83d\udd17' },
    { g: 'studio', k: 'djLoop', w: 1, n: 'Deck loop', d: 'Loop a beat on the deck', i: '\ud83d\udd01' },
    { g: 'studio', k: 'djRecord', w: 1, n: 'Taping the set', d: 'Record a DJ set', i: '\u23fa' },
    { g: 'studio', k: 'beatRepeat', w: 1, n: 'Beat repeat', d: 'Hold a beat repeat', i: '\ud83c\udf9b' },
    { g: 'studio', k: 'tapeStop', w: 1, n: 'Tape stop', d: 'Stop the deck like a tape', i: '\ud83d\udcfc' },
    { g: 'studio', k: 'spinback', w: 1, n: 'Spinback', d: 'Spin the deck back', i: '\ud83c\udf00' },
    // ---- Assistant & gestures ----
    { g: 'assistant', k: 'used_assistant', w: 1, n: 'Asked and done', d: 'Have the assistant do something', i: '\u2728' },
    { g: 'assistant', k: 'assistant', w: 1, n: 'First ask', d: '1 thing done by the assistant', i: '\u2728' },
    { g: 'assistant', k: 'assistant', w: 5, n: 'Assistant regular', d: '5 things done by the assistant', i: '\u2728' },
    { g: 'assistant', k: 'assistant', w: 25, n: 'Assistant habit', d: '25 things done by the assistant', i: '\u2728' },
    { g: 'assistant', k: 'assistant', w: 50, n: 'Fifty things', d: '50 things done by the assistant', i: '\u2728' },
    { g: 'assistant', k: 'assistant', w: 100, n: 'A hundred things', d: '100 things done by the assistant', i: '\u2728' },
    { g: 'assistant', k: 'asstTransport', w: 1, n: 'Ask to skip', d: 'Skip a song by asking', i: '\u23ed' },
    { g: 'assistant', k: 'asstPlaylist', w: 1, n: 'Built by asking', d: 'A playlist built by asking', i: '\ud83d\udcdc' },
    { g: 'assistant', k: 'asstPlaylist', w: 5, n: 'Five by asking', d: '5 playlists built by asking', i: '\ud83d\udcdc' },
    { g: 'assistant', k: 'asstTheme', w: 1, n: 'Theme by asking', d: 'Change the theme by asking', i: '\ud83c\udfa8' },
    { g: 'assistant', k: 'asstClip', w: 1, n: 'Clip by asking', d: 'A clip cut by asking', i: '\u2702' },
    { g: 'assistant', k: 'shake', w: 1, n: 'Shake it off', d: 'Skip a song by shaking the phone', i: '\ud83d\udcf1' },
    { g: 'assistant', k: 'shake', w: 10, n: 'Shake ten', d: 'Skip 10 songs by shaking', i: '\ud83d\udcf1' },
    { g: 'assistant', k: 'swipeTrack', w: 1, n: 'Swiped', d: 'Change track with a swipe', i: '\ud83d\udc46' },
    { g: 'assistant', k: 'swipeSeek', w: 1, n: 'Swipe seek', d: 'Seek with a swipe', i: '\ud83c\udfaf' },
    { g: 'assistant', k: 'used_gestures', w: 1, n: 'Handled', d: 'Use a gesture', i: '\u270b' },
    { g: 'assistant', k: 'whirl', w: 1, n: 'Spun the Vortex', d: 'Turn the Vortex backdrop', i: '\ud83c\udf00' },
    { g: 'assistant', k: 'bubble', w: 1, n: 'From the bubble', d: 'Tap a Home bubble', i: '\ud83d\udca7' },
    // ---- Themes ----
    { g: 'themes', k: 'themeChange', w: 1, n: 'New colours', d: 'Change the theme', i: '\ud83c\udfa8' },
    { g: 'themes', k: 'themeChange', w: 5, n: 'Five looks', d: '5 theme changes', i: '\ud83c\udfa8' },
    { g: 'themes', k: 'themeChange', w: 25, n: 'Twenty-five looks', d: '25 theme changes', i: '\ud83c\udfa8' },
    { g: 'themes', k: 'themeChange', w: 60, n: 'Chameleon', d: '60 theme changes', i: '\ud83e\udd8e' },
    { g: 'themes', k: 'dyn', w: 1, n: 'First dynamic', d: '1 dynamic theme worn', i: '\u2728' },
    { g: 'themes', k: 'dyn', w: 3, n: 'Three dynamic', d: '3 dynamic themes worn', i: '\u2728' },
    { g: 'themes', k: 'dyn', w: 6, n: 'Six dynamic', d: '6 dynamic themes worn', i: '\u2728' },
    { g: 'themes', k: 'themeRGB', w: 1, n: 'RGB cycle', d: 'Turn on the RGB cycle', i: '\ud83c\udf08' },
    { g: 'themes', k: 'themeVortex', w: 1, n: 'Vortex', d: 'Wear the Vortex theme', i: '\ud83c\udf00' },
    { g: 'themes', k: 'customTheme', w: 1, n: 'Your own theme', d: 'Save a custom theme', i: '\ud83c\udfa8' },
    // ---- Milestones ----
    { g: 'miles', k: 'importLib', w: 1, n: 'Library restored', d: 'Import a library backup', i: '\ud83d\udce5' },
    { g: 'miles', k: 'addFiles', w: 1, n: 'Brought your own', d: 'Add your own files', i: '\u2795' },
    { g: 'miles', k: 'badgeGrid', w: 1, n: 'Found the wall', d: 'Open the badge grid', i: '\ud83c\udfc5' },
    { g: 'miles', k: 'notif', w: 1, n: 'Read the notes', d: 'Open the patch notes', i: '\ud83d\udd14' },
    { g: 'miles', k: 'albumsMade', w: 1, n: 'Album maker', d: 'Build an album by hand', i: '\ud83c\udfb5' },
    { g: 'miles', k: 'albumsMade', w: 5, n: 'Five albums made', d: 'Build 5 albums by hand', i: '\ud83c\udfb5' },
    { g: 'miles', k: 'featuresNine', w: 9, n: 'Everything touched', d: 'Use all 9 features the app has', i: '\ud83d\udee0' },
    { g: 'miles', k: 'homeTab', w: 1, n: 'Home', d: 'Open Home', i: '\ud83c\udfe0' },
    { g: 'miles', k: 'libraryTab', w: 1, n: 'The library tab', d: 'Open the Library tab', i: '\ud83d\udcda' },
    { g: 'miles', k: 'groupsLit', w: 7, n: 'Every corner', d: 'Earn a badge in every other section', i: '\ud83e\udded' }
  ];
  // Every counter and flag the wall counts, named once. A badge whose key is not
  // in these lists is a badge that can never be earned, which is why the gate
  // walks the wall and proves every key resolves to a number.
  var COUNTER_SIGNALS = ['cleaner', 'presets', 'myPresets', 'practiceRuns', 'loops', 'clips', 'studio', 'assistant', 'asstTransport', 'asstPlaylist', 'asstTheme', 'asstClip', 'shake', 'swipeTrack', 'swipeSeek', 'themeChange', 'search', 'queue', 'importLib', 'addFiles', 'badgeGrid', 'notif', 'lyrics', 'shuffle', 'repeat', 'bubble', 'homeTab', 'libraryTab', 'tapTempo', 'djmode', 'djCue', 'djSync', 'djLoop', 'djRecord', 'beatRepeat', 'tapeStop', 'spinback', 'customTheme', 'whirl'];
  var FLAG_SIGNALS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures', 'practice', 'sleep', 'bpm'];
  // Every number a badge can be measured against, built once per paint and passed
  // down: 150 tiles each asking for the stats and walking the library would be 300
  // scans of every song on every repaint, and this screen repaints often.
  function buildSignals(){
    var s = stats();
    var d = derivedStats();
    var t = allTracks();
    var top = 0;
    for(var i = 0; i < t.length; i++){
      var pc = (t[i] && t[i].playCount) || 0;
      if(pc > top) top = pc;
    }
    var lib = s.library || t.length || 0;
    var played = d.playedTracks || 0;
    var out = {
      plays: s.plays || 0,
      minutes: (s.listenSeconds || 0) / 60,
      hours: (s.listenSeconds || 0) / 3600,
      streak: s.streak || 0,
      longest: s.longest || 0,
      library: lib,
      albums: d.albums || 0,
      albumsMade: d.userAlbums || 0,
      playlists: d.playlists || 0,
      favorites: d.favorites || 0,
      artists: d.artists || 0,
      genres: d.genres || 0,
      playedTracks: played,
      playedShare: lib ? Math.min(1, played / lib) : 0,
      maxPlays: Math.max(top, d.maxPlays || 0),
      pads: Object.keys(padsSeen).length,
      dyn: dynCount(),
      themeRGB: themesUsed.rgb ? 1 : 0,
      themeVortex: themesUsed.vortex ? 1 : 0,
      toolsFive: ['slow', 'karaoke', 'sampler', 'looper', 'clip'].filter(function(k){ return flags[k]; }).length,
      featuresNine: d.featuresUsed || 0,
      groupsLit: 0 // filled in by ACHIEVEMENTS, which is the only place that can see the whole wall
    };
    COUNTER_SIGNALS.forEach(function(k){ out[k] = ctr(k); });
    FLAG_SIGNALS.forEach(function(k){ out['used_' + k] = flags[k] ? 1 : 0; });
    return out;
  }
  function badgeId(n, w, seen){
    var id = String(n).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    if(seen[id]) id = id + '_' + w; // two goals that read the same, keyed apart
    seen[id] = 1;
    return id;
  }
  // The tone is only colour: within a group, the reachable early rungs and the
  // long ones wear different shades, so a wall does not read as one flat block.
  function toneFor(i, total){
    return i < total * 0.5 ? 'a' : (i < total * 0.85 ? 'b' : 'c');
  }
  function wallBadges(sig){
    var total = {}, at = {}, seen = {};
    WALL.forEach(function(e){ total[e.g] = (total[e.g] || 0) + 1; });
    return WALL.map(function(e){
      at[e.g] = (at[e.g] || 0) + 1;
      var raw = sig[e.k];
      var got = raw == null ? 0 : raw;
      return {
        id: badgeId(e.n, e.w, seen), name: e.n, sub: e.d, ico: e.i, tone: toneFor(at[e.g] - 1, total[e.g]),
        group: e.g, key: e.k, want: e.w, need: { got: Math.min(got, e.w), want: e.w }
      };
    });
  }
  // The whole wall, assembled from one object of live numbers. `sig` is built once
  // here and handed to every tile, so the library is walked exactly once per paint.
  function ACHIEVEMENTS(){
    var sig = buildSignals();
    var list = wallBadges(sig);
    // The one tile that reads the wall itself: a badge earned in every section
    // except this one's. Resolved after the wall exists, so nothing recurses.
    var lit = 0;
    GROUP_TITLES.forEach(function(g){
      if(g[0] === 'miles' || g[0] === 'secret') return;
      if(list.some(function(a){ return a.group === g[0] && a.need.got >= a.need.want; })) lit++;
    });
    list.forEach(function(a){
      if(a.key !== 'groupsLit') return;
      a.need = { got: Math.min(lit, a.want), want: a.want };
    });
    // The one badge that is not on the grid until it is earned: the door behind the
    // version line in Settings. It is a blank tile with a question mark until then.
    list.push({
      id: 'secret_door', name: 'The door', sub: 'Find the hidden way in', ico: '\ud83d\udd13', tone: 'c',
      group: 'secret', secret: true, key: 'secret', want: 1, need: { got: doorOpen ? 1 : 0, want: 1 }
    });
    return list;
  }
  /* --------------------------------------------------------------------------
     5c. WHAT THE WALL COUNTS

     Two maps on the device and nothing else: `bump` is every time the thing
     happens, `markFeature` is once ever. Every tile above reads through them
     rather than keeping a number of its own, so a badge and the thing it counts
     cannot drift apart, and the whole wall can be rebuilt from these two objects
     plus the app's own stats.
     -------------------------------------------------------------------------- */
  var counters = lsGet(LS.ctr, {}) || {};
  function bump(k, n){
    counters[k] = (counters[k] || 0) + (n == null ? 1 : n);
    lsSet(LS.ctr, counters);
    return counters[k];
  }
  function ctr(k){ return counters[k] || 0; }
  var padsSeen = lsGet(LS.padsSeen, {}) || {};
  function seenPad(i){ padsSeen[i] = 1; lsSet(LS.padsSeen, padsSeen); return Object.keys(padsSeen).length; }
  var themesUsed = lsGet(LS.themes, {}) || {};
  function noteTheme(key){
    if(!key) return 0;
    themesUsed[key] = 1;
    lsSet(LS.themes, themesUsed);
    return Object.keys(themesUsed).length;
  }
  var DYN_KEYS = ['rgb', 'rgbplus', 'ember', 'galaxy', 'glacier', 'aurora', 'synthwave', 'ocean', 'cyberpunk', 'nebula', 'neonpulse', 'solstice', 'abyss', 'orchid', 'vortex'];
  function dynCount(){ return DYN_KEYS.filter(function(k){ return themesUsed[k]; }).length; }

  // ---- the door ------------------------------------------------------------
  // Seven taps on the version label in Settings - a control everyone can see and
  // nobody taps twice - opens the one badge that is not on the grid until it is
  // earned. There is no panel behind it any more: 73.3.8 removed the dev-mode
  // section from Studio at the owner's word, so the door is the hidden badge and
  // nothing else, and it no longer touches the app's own test flag either.
  var doorOpen = !!(lsGet(LS.door, null) || lsGet(LS.dev, null)); // LS.dev is what the dev-mode release wrote, so an earned door stays earned
  function setDoorOpen(on){
    doorOpen = !!on;
    lsSet(LS.door, doorOpen ? { at: Date.now() } : null);
    if(doorOpen){
      toast('\ud83d\udd13 The door opened \u00b7 a hidden badge is on the wall now.', 4200);
      checkAchievements();
    }
    renderStudio();
  }
  function wireDoorGesture(){
    var el = $('currentVersionLabel');
    if(!el || el.__scDoorTaps !== undefined) return;
    el.__scDoorTaps = 0;
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(){
      el.__scDoorTaps++;
      clearTimeout(el.__scDoorTimer);
      el.__scDoorTimer = setTimeout(function(){ el.__scDoorTaps = 0; }, 1600);
      var left = 7 - el.__scDoorTaps;
      if(left > 0 && left <= 3) toast(left + ' more\u2026', 900);
      if(el.__scDoorTaps >= 7){ el.__scDoorTaps = 0; setDoorOpen(!doorOpen); }
    });
  }

  // ---- the five rewards ----------------------------------------------------
  var REWARDS = [
    { at: 40,  kind: 'theme',   key: 'cinder',  name: 'Cinder',  note: 'Six metallic palettes in one' },
    { at: 80,  kind: 'theme',   key: 'quartz',  name: 'Quartz',  note: 'Cool glass and silver' },
    { at: 110, kind: 'theme',   key: 'lumen',   name: 'Lumen',   note: 'Daylight green and mint' },
    { at: 140, kind: 'theme',   key: 'vortex',  name: 'Vortex',  note: 'A dynamic theme that whirls under your finger', dynamic: true },
    { at: 151, kind: 'complete', key: 'complete', name: 'The whole wall', note: 'Every badge in the app, including the secret one' }
  ];
  function rewardEarned(at){ return unlockedCount() >= at; }
  function rewardState(){
    var n = unlockedCount();
    return REWARDS.map(function(r){
      return { at: r.at, kind: r.kind, key: r.key, name: r.name, note: r.note, dynamic: !!r.dynamic, earned: n >= r.at, have: n };
    });
  }
  function themeRewards(){ return REWARDS.filter(function(r){ return r.kind === 'theme'; }); }
  // Called from the app's Theme tab, through window.SC70 - a reward theme is free
  // the moment the badges are there, for everyone.
  function themeUnlocked(key){
    for(var i = 0; i < REWARDS.length; i++){
      if(REWARDS[i].kind === 'theme' && REWARDS[i].key === key) return rewardEarned(REWARDS[i].at);
    }
    return true;
  }
  // 70.1.3 - the wall used to end in a purchase, and there is no purchase to end
  // in. The trophy is the wall itself, so this is the celebration and nothing else.
  function grantRewards(silent){
    if(!rewardEarned(REWARDS[REWARDS.length - 1].at)) return false;
    if(lsGet(LS.reward, null)) return false;
    lsSet(LS.reward, { at: Date.now(), granted: true });
    if(!silent) toast('\ud83d\ude80 ' + unlockedCount() + ' of ' + ACHIEVEMENTS().length + ' \u00b7 the whole wall. Thank you for playing with all of it.', 6000);
    return true;
  }
  var REWARD_MARKS = REWARDS.map(function(r){ return r.at; });
  function celebrateRewards(before){
    var after = unlockedCount();
    REWARDS.forEach(function(r){
      if(before < r.at && after >= r.at){
        if(r.kind === 'theme') toast('\ud83c\udf89 ' + r.at + ' badges \u00b7 ' + r.name + ' is unlocked in Settings \u2192 Theme, free.', 5200);
      }
    });
  }

  // Every feature the app can mark as used. The capstone badge wants ALL of them,
  // so this list IS that badge's definition: a new flag cannot be counted without
  // joining it. Nothing here is a share, an export or an EDIT: 70.0.6 took the
  // three in-place editors (crop, retag and reencode) out, so the capstone is
  // nine features you can use on your own files without changing one.
  var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];
  function derivedStats(){
    var tracks = allTracks();
    var artists = {}, genres = {}, played = 0, maxPlays = 0, albums = {};
    tracks.forEach(function(t){
      if(!t) return;
      if(t.artist) artists[String(t.artist).toLowerCase()] = 1;
      if(t.genre) genres[String(t.genre).toLowerCase()] = 1;
      // Albums are counted as a UNION: a name the songs already carry, plus any
      // album built by hand. The app used to report zero for both, so all seven
      // album badges could never be earned by anyone. Counting the library's own
      // album names as well means the badges are reachable whatever the library
      // looks like - the album tags are already there to be counted.
      if(t.album) albums[String(t.album).toLowerCase()] = 1;
      var pc = t.playCount || 0;
      if(pc > 0) played++;
      if(pc > maxPlays) maxPlays = pc;
    });
    var ua = call('__scUserAlbums');
    var made = 0;
    if(ua && typeof ua === 'object'){
      Object.keys(ua).forEach(function(n){ albums[String(n).toLowerCase()] = 1; });
      made = Object.keys(ua).length;
    } else if(typeof ua === 'number'){
      made = ua || 0;
    }
    var pls = call('__scPlaylists') || {};
    return {
      artists: Object.keys(artists).length,
      genres: Object.keys(genres).length,
      playedTracks: played,
      maxPlays: maxPlays,
      userAlbums: made,
      albums: Object.keys(albums).length,
      playlists: Object.keys(pls).filter(function(n){ return n !== 'All Songs' && n !== 'Favorites'; }).length,
      favorites: (pls['Favorites'] || []).length,
      albumsMade: made,
      featuresUsed: FEATURE_KEYS.filter(function(k){ return flags[k]; }).length
    };
  }
  // The sections the grid is drawn in, in the order they appear. 73.3 removed the
  // Discovery group at the owner's word - a wall that scores how late you stay up
  // is a habit worth encouraging - and 73.3.8 put the deck's own controls in with
  // Studio, so the two halves of the creative side sit together.
  var GROUP_TITLES = [
    ['streak', 'Streaks'], ['listen', 'Listening'], ['library', 'Library'],
    ['studio', 'Studio & the deck'], ['assistant', 'Assistant & gestures'], ['themes', 'Themes'],
    ['miles', 'Milestones'], ['secret', 'Secret']
  ];
  function badgesByGroup(list){
    var all = list || ACHIEVEMENTS();
    return GROUP_TITLES.map(function(g){
      var items = all.filter(function(a){ return a.group === g[0]; });
      return { key: g[0], title: g[1], items: items, have: items.filter(isUnlocked).length };
    });
  }

  function unlockedCount(){
    var all = ACHIEVEMENTS();
    var n = 0;
    all.forEach(function(a){ if(a.need.got >= a.need.want) n++; });
    return n;
  }
  // Drawing the wall walks the whole library (every badge reads real stats), so
  // it is NOT redrawn on every counter that moves - that was a deliberate
  // choice and it stays. What it must never be is what the user is looking at
  // with an old number on it, so this is called from the two places where the
  // picture can go stale: a badge unlocking, and the view being opened.
  function badgeRepaintIfVisible(){
    try{
      var host = $('studioView');
      if(host && host.classList.contains('active')) renderStudio();
    }catch(_e){ }
  }

  function checkAchievements(silent){
    var before = Object.keys(achState).length;
    var fresh = [];
    ACHIEVEMENTS().forEach(function(a){
      if(a.need.got < a.need.want) return;
      if(achState[a.id]) return;
      achState[a.id] = Date.now();
      fresh.push(a);
    });
    if(fresh.length){
      lsSet(LS.ach, achState);
      celebrateRewards(before);
      if(!silent){
        // A wall of 150 means a big library can unlock a dozen at once on the first
        // run. Twelve toasts over eleven seconds is not a celebration, it is a
        // queue, so past four the rest are counted in one line.
        if(fresh.length > 4){
          toast('\ud83c\udfc5 ' + fresh.length + ' badges unlocked at once \u00b7 ' + unlockedCount() + ' of ' + ACHIEVEMENTS().length, 5200);
        } else {
          fresh.forEach(function(a, i){
            setTimeout(function(){ toast('\ud83c\udfc5 Badge unlocked \u00b7 ' + a.name + ' \u2014 ' + a.sub, 4000); }, i * 900);
          });
        }
      }
    }
    // A badge that just unlocked has to appear on the wall the user is looking
    // at. Recording it and celebrating it while the grid still shows the count
    // and the tile from an earlier paint is the bug this release is about: the
    // state was right and the picture was old.
    if(fresh.length) badgeRepaintIfVisible();
    // See the note above the reward table: the last tile is a reward, so it is
    // celebrated on every evaluation of the count, not only when one unlocks.
    grantRewards(!!silent);
    return fresh;
  }

  /* --------------------------------------------------------------------------
     6. STORAGE CLEANER - the biggest songs, and a smaller bitrate for each
     -------------------------------------------------------------------------- */
  function biggestSongs(limit){
    var rows = allTracks().filter(function(t){ return t.file && t.file.size; })
      .map(function(t){ return { t: t, size: t.file.size }; })
      .sort(function(a, b){ return b.size - a.size; });
    return rows.slice(0, limit || 40);
  }
  function totalAudioBytes(){
    var n = 0;
    allTracks().forEach(function(t){ if(t.file && t.file.size) n += t.file.size; });
    return n;
  }

  /* --------------------------------------------------------------------------
     7. BATCH TAG EDITOR - and the ID3 tag inside the stored file is rewritten
     -------------------------------------------------------------------------- */
  var batch = { ids: [], cover: undefined };
  function openBatchTags(ids){
    batch.ids = (ids || []).slice();
    batch.cover = undefined;
    if(!batch.ids.length){ toast('Select some songs first.'); return; }
    var sel = batch.ids.map(trackById).filter(Boolean);
    var artists = {}, albums = {};
    sel.forEach(function(t){ if(t.artist) artists[t.artist] = 1; if(t.album) albums[t.album] = 1; });
    var aList = Object.keys(artists), alList = Object.keys(albums);
    var body = '' +
      '<div class="sc-note">' + batch.ids.length + ' song' + (batch.ids.length === 1 ? '' : 's') + ' selected. Only the fields you fill in are changed; an empty field leaves that field alone. The ID3 tag inside each stored file is rewritten, not just the list.</div>' +
      '<div class="sc-field"><label for="scBatchArtist">Artist</label><input id="scBatchArtist" type="text" placeholder="' + (aList.length === 1 ? esc(aList[0]) : (aList.length ? 'mixed \u2014 ' + aList.length + ' artists' : 'not set')) + '"></div>' +
      '<div class="sc-field"><label for="scBatchAlbum">Album</label><input id="scBatchAlbum" type="text" placeholder="' + (alList.length === 1 ? esc(alList[0]) : (alList.length ? 'mixed \u2014 ' + alList.length + ' albums' : 'not set')) + '"></div>' +
      '<div class="sc-field"><label for="scBatchGenre">Genre</label><input id="scBatchGenre" type="text" placeholder="not set"></div>' +
      '<div class="sc-field"><label for="scBatchYear">Year</label><input id="scBatchYear" type="text" placeholder="not set"></div>' +
      '<div class="sc-row2"><label class="sc-cover-pick"><input type="file" id="scBatchCover" accept="image/*" style="display:none"><span id="scBatchCoverLbl">Choose a cover image</span></label>' +
      '<button class="sc-btn" id="scBatchDropCover">Clear cover</button></div>' +
      '<div class="sc-actions"><button class="sc-btn primary" id="scBatchGo">Write tags to ' + batch.ids.length + ' song' + (batch.ids.length === 1 ? '' : 's') + '</button><button class="sc-btn" id="scBatchCancel">Cancel</button></div>';
    openSheet('Batch tag editor', body);
    var cf = $('scBatchCover');
    if(cf) cf.addEventListener('change', function(){
      var f = cf.files && cf.files[0];
      if(!f) return;
      batch.cover = f;
      var l = $('scBatchCoverLbl');
      if(l) l.textContent = f.name.length > 26 ? f.name.slice(0, 23) + '\u2026' : f.name;
    });
    var dc = $('scBatchDropCover');
    if(dc) dc.addEventListener('click', function(){
      batch.cover = null;
      var l = $('scBatchCoverLbl');
      if(l) l.textContent = 'Cover will be removed';
    });
    var go = $('scBatchGo');
    if(go) go.addEventListener('click', runBatchTags);
    var cx = $('scBatchCancel');
    if(cx) cx.addEventListener('click', closeSheet);
  }
  // The ID3v2 tag INSIDE the stored file, rewritten in place. This is what makes
  // a batch edit a change to the files rather than a change to the list: the app
  // keeps each song's bytes in IndexedDB, so the tag it carries is the one that
  // leaves the device on export, and it is the one the next reader of that file
  // sees. MP3 (a leading ID3v2 block) and WAV (an 'id3 ' chunk) are both handled;
  // anything else keeps the list-level change only, and says so.
  var ID3_HELPER_OK = false;
  function retagBytes(u8, id3){
    if(!id3 || !id3.length) return null;
    var isRiff = u8.length > 12 && u8[0] === 0x52 && u8[1] === 0x49 && u8[2] === 0x46 && u8[3] === 0x46;
    if(isRiff){
      // Walk the chunks, drop the old 'id3 ' chunk, append the new one.
      var view = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
      var chunks = [];
      var pos = 12;
      var fmt = null, dat = null, others = [];
      while(pos + 8 <= u8.length){
        var id = String.fromCharCode(u8[pos], u8[pos+1], u8[pos+2], u8[pos+3]);
        var size = view.getUint32(pos + 4, true);
        var body = u8.subarray(pos + 8, Math.min(u8.length, pos + 8 + size));
        if(id === 'fmt ') fmt = { id: id, body: body };
        else if(id === 'data') dat = { id: id, body: body };
        else if(id !== 'id3 ' && id !== 'ID3 ') others.push({ id: id, body: body });
        pos += 8 + size + (size % 2);
      }
      if(!fmt || !dat) return null;
      var idLen = id3.length + (id3.length % 2);
      var total = 4;
      [fmt, dat].concat(others).forEach(function(c){ total += 8 + c.body.length + (c.body.length % 2); });
      total += 8 + idLen;
      var out = new Uint8Array(8 + total);
      var ov = new DataView(out.buffer);
      out[0] = 0x52; out[1] = 0x49; out[2] = 0x46; out[3] = 0x46;
      ov.setUint32(4, total, true);
      out[8] = 0x57; out[9] = 0x41; out[10] = 0x56; out[11] = 0x45;
      var w = 12;
      function put(id, body){
        for(var i = 0; i < 4; i++) out[w + i] = id.charCodeAt(i);
        ov.setUint32(w + 4, body.length, true);
        out.set(body, w + 8);
        w += 8 + body.length + (body.length % 2);
      }
      put('fmt ', fmt.body);
      put('data', dat.body);
      others.forEach(function(c){ put(c.id, c.body); });
      for(var i = 0; i < 4; i++) out[w + i] = 'id3 '.charCodeAt(i);
      ov.setUint32(w + 4, id3.length, true);
      out.set(id3, w + 8);
      return out;
    }
    // MP3 (or anything with a leading ID3v2 block): strip the old one, prepend
    // the new one. A file with no ID3 at all gets one, which is also how the
    // app's own encoders write a tag.
    var off = 0;
    if(u8.length > 10 && u8[0] === 0x49 && u8[1] === 0x44 && u8[2] === 0x33){
      off = 10 + (((u8[6] & 0x7f) << 21) | ((u8[7] & 0x7f) << 14) | ((u8[8] & 0x7f) << 7) | (u8[9] & 0x7f));
      if(u8[5] & 0x10) off += 10;
      if(off >= u8.length) off = 0;
    }
    var body2 = u8.subarray(off);
    var out2 = new Uint8Array(id3.length + body2.length);
    out2.set(id3, 0);
    out2.set(body2, id3.length);
    return out2;
  }
  window.__scWriteTagsToFile = function(t){
    return new Promise(function(res){
      try{
        if(!t || !t.file || typeof window.__scId3 !== 'function'){ res(false); return; }
        var meta = { title: t.name || '', artist: t.artist || '', album: t.album || '', genre: t.genre || null, year: t.releaseDate ? String(t.releaseDate).slice(0, 4) : null };
        var id3 = window.__scId3(meta);
        if(!id3 || !id3.length){ res(false); return; }
        t.file.arrayBuffer().then(function(ab){
          var u8 = new Uint8Array(ab);
          var out = retagBytes(u8, id3);
          if(!out){ res(false); return; }
          try{
            var name = t.file.name || (t.name || 'audio') + '.mp3';
            var nm = /\.[a-z0-9]+$/i.test(name) ? name : name + '.mp3';
            t.file = new File([out], nm, { type: /wav$/i.test(nm) ? 'audio/wav' : 'audio/mpeg' });
            res(true);
          }catch(e){ res(false); }
        }, function(){ res(false); });
      }catch(e){ res(false); }
    });
  };
  function runBatchTags(){
    var artist = (($('scBatchArtist') || {}).value || '').trim();
    var album = (($('scBatchAlbum') || {}).value || '').trim();
    var genre = (($('scBatchGenre') || {}).value || '').trim();
    var year = (($('scBatchYear') || {}).value || '').trim();
    if(!artist && !album && !genre && !year && batch.cover === undefined){ toast('Fill in at least one field.'); return; }
    var go = $('scBatchGo');
    if(go){ go.disabled = true; go.textContent = 'Writing\u2026'; }
    var ids = batch.ids.slice();
    var done = 0, tagged = 0, failed = 0;
    function next(){
      if(!ids.length){
        call('__scRenderList');
        markFeature('retag');
        bump('batch');
        bump('tagged', done);
        checkAchievements();
        closeSheet();
        toast('Updated ' + done + ' song' + (done === 1 ? '' : 's') + (tagged ? ' \u00b7 ' + tagged + ' file tag' + (tagged === 1 ? '' : 's') + ' rewritten' : '') + (failed ? ' \u00b7 ' + failed + ' could not be re-tagged' : ''));
        renderStudio();
        return;
      }
      var id = ids.shift();
      var t = trackById(id);
      if(!t){ next(); return; }
      if(artist) t.artist = artist;
      if(album) t.album = album;
      if(genre) t.genre = genre;
      if(year) t.releaseDate = year;
      var coverTask = Promise.resolve(false);
      if(batch.cover instanceof File){
        coverTask = new Promise(function(res){
          t.artBlob = batch.cover;
          try{ t.artUrl = URL.createObjectURL(batch.cover); }catch(e){}
          res(true);
        });
      } else if(batch.cover === null){
        t.artBlob = null;
        t.artUrl = '';
      }
      coverTask.then(function(){
        return window.__scWriteTagsToFile ? window.__scWriteTagsToFile(t) : Promise.resolve(false);
      }).then(function(ok){
        if(ok) tagged++;
        done++;
        return call('__scPersistTrack', t);
      }).catch(function(){ failed++; done++; }).then(next);
    }
    next();
  }

  /* --------------------------------------------------------------------------
     8. GESTURES - shake to skip, and a swipe on the player
     -------------------------------------------------------------------------- */
  var gestures = lsGet(LS.gestures, { shake: false, swipe: true }) || { shake: false, swipe: true };
  var lastShake = 0;
  function shakeHandler(e){
    if(!gestures.shake) return;
    var a = e.accelerationIncludingGravity || e.acceleration;
    if(!a) return;
    var mag = Math.sqrt((a.x || 0) * (a.x || 0) + (a.y || 0) * (a.y || 0) + (a.z || 0) * (a.z || 0));
    var now = Date.now();
    if(mag > 26 && now - lastShake > 1600){
      bump('shake');
      lastShake = now;
      call('__scNext');
      toast('\u23ed Shake - next song');
      markFeature('gestures');
    }
  }
  function enableShake(on){
    gestures.shake = !!on;
    lsSet(LS.gestures, gestures);
    if(gestures.shake){
      var start = function(){
        window.addEventListener('devicemotion', shakeHandler, { passive: true });
        toast('Shake to skip is on. Shake the phone to go to the next song.');
      };
      var D = window.DeviceMotionEvent;
      if(D && typeof D.requestPermission === 'function'){
        D.requestPermission().then(function(r){
          if(r === 'granted') start();
          else { gestures.shake = false; lsSet(LS.gestures, gestures); toast('Motion permission was refused, so shake is off.'); renderStudio(); }
        }).catch(function(){ gestures.shake = false; lsSet(LS.gestures, gestures); renderStudio(); });
      } else start();
    } else {
      try{ window.removeEventListener('devicemotion', shakeHandler); }catch(e){}
      toast('Shake to skip is off.');
    }
    renderStudio();
  }
  function wireSwipe(){
    var host = $('nowPlaying');
    if(!host || host.__scSwipe) return;
    host.__scSwipe = true;
    var sx = 0, sy = 0, active = false, scrubbing = false, startAt = 0;
    function onDown(e){
      if(!gestures.swipe) return;
      var tgt = e.target;
      if(tgt && tgt.closest && tgt.closest('button, input, a, .crossfader-track')) return;
      var p = e.touches ? e.touches[0] : e;
      if(!p) return;
      active = true;
      scrubbing = !!(tgt && tgt.closest && tgt.closest('#miniBar, .seek-row, .seek-line-wrap'));
      sx = p.clientX; sy = p.clientY;
      var a = call('__scActiveAudio');
      startAt = a ? a.currentTime : 0;
    }
    function onMove(e){
      if(!active) return;
      var p = e.touches ? e.touches[0] : e;
      if(!p) return;
      var dx = p.clientX - sx;
      if(scrubbing){
        var a = call('__scActiveAudio');
        if(a && a.duration){
          e.preventDefault();
          var nv = Math.max(0, Math.min(a.duration, startAt + (dx / Math.max(1, host.clientWidth)) * a.duration));
          a.currentTime = nv;
          if($('curTime')) $('curTime').textContent = fmtTime(nv);
          if($('miniFill')) $('miniFill').style.width = ((nv / a.duration) * 100) + '%';
        }
      }
    }
    function onUp(e){
      if(!active) return;
      active = false;
      var p = (e.changedTouches && e.changedTouches[0]) || e;
      if(!p) return;
      var dx = p.clientX - sx, dy = p.clientY - sy;
      if(scrubbing){ bump('swipeSeek'); return; }
      if(Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5){
        bump('swipeTrack');
        markFeature('gestures');
        if(dx < 0){ call('__scNext'); toast('\u23ed Swipe - next song'); }
        else { call('__scPrev'); toast('\u23ee Swipe - previous song'); }
      }
    }
    host.addEventListener('touchstart', onDown, { passive: true });
    host.addEventListener('touchmove', onMove, { passive: false });
    host.addEventListener('touchend', onUp, { passive: true });
    host.addEventListener('touchcancel', function(){ active = false; }, { passive: true });
    host.addEventListener('mousedown', onDown);
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  /* --------------------------------------------------------------------------
     9. AUTO-DJ - beat-matched crossfade
     -------------------------------------------------------------------------- */
  var autodj = lsGet(LS.autodj, { on: false }) || { on: false };
  var bpmCache = {};
  function detectBpm(buf){
    // Energy envelope in 1024-sample hops, low band only (a one-pole filter keeps
    // the kick), then autocorrelation between 60 and 200 BPM.
    var sr = buf.sampleRate;
    var hop = 1024;
    var ch = buf.getChannelData(0);
    var n = Math.floor(ch.length / hop);
    if(n < 64) return null;
    var env = new Float32Array(n);
    var lp = 0, k = 0.06;
    for(var i = 0; i < n; i++){
      var off = i * hop, sum = 0;
      for(var j = 0; j < hop; j += 4){
        var v = ch[off + j] || 0;
        lp = lp + k * (v - lp);
        sum += lp * lp;
      }
      env[i] = Math.sqrt(sum / (hop / 4));
    }
    var mean = 0;
    for(i = 0; i < n; i++) mean += env[i];
    mean /= n;
    for(i = 0; i < n; i++) env[i] -= mean;
    var fps = sr / hop;
    var minLag = Math.floor((60 / 200) * fps), maxLag = Math.floor((60 / 60) * fps);
    var best = 0, bestLag = 0;
    for(var lag = minLag; lag <= maxLag; lag++){
      var acc = 0;
      for(i = 0; i + lag < n; i++) acc += env[i] * env[i + lag];
      acc /= (n - lag);
      if(acc > best){ best = acc; bestLag = lag; }
    }
    if(!bestLag) return null;
    var bpm = 60 * fps / bestLag;
    while(bpm < 70) bpm *= 2;
    while(bpm > 190) bpm /= 2;
    // The first strong onset above 0.35 of the peak - where a beat-matched blend
    // should drop the incoming track.
    var peak = 0;
    for(i = 0; i < n; i++) peak = Math.max(peak, env[i]);
    var first = 0;
    for(i = 1; i < n; i++){ if(env[i] > peak * 0.35 && env[i] > env[i - 1]){ first = i * hop / sr; break; } }
    return { bpm: Math.round(bpm * 10) / 10, firstBeat: Math.round(first * 1000) / 1000 };
  }
  function bpmFor(t){
    if(!t) return Promise.resolve(null);
    if(bpmCache[t.id]) return Promise.resolve(bpmCache[t.id]);
    return decoded(t).then(function(b){
      var r = detectBpm(b);
      if(r){ bpmCache[t.id] = r; markFeature('bpm'); }
      return r;
    }, function(){ return null; });
  }
  // Beat-snap the START of the blend: hold the crossfade until the outgoing song
  // is on a beat (or until there is less than one beat of it left).
  window.__scAutoDjGate = function(a, remaining){
    if(!autodj.on) return true;
    var t = currentTrack();
    var b = t ? bpmCache[t.id] : null;
    if(!b) { bpmFor(t); return true; }
    var beat = 60 / b.bpm;
    var pos = a.currentTime;
    var sinceBeat = pos - Math.floor(pos / beat) * beat;
    if(sinceBeat < 0.06 || Math.abs(beat - sinceBeat) < 0.06) return true;
    if(remaining <= beat * 1.1) return true;
    return false;
  };
  // Where the incoming song should start so the blend lands on its own downbeat.
  window.__scAutoDjAlign = function(curEl, nextTrack){
    if(!autodj.on || !nextTrack) return 0;
    // The flag, not just the counter: the "Blended" badge reads flags.autodj, and
    // this is the one place a beat-matched blend is actually handed over. Without
    // it that badge was unreachable no matter how much Auto-DJ was used.
    markFeature('autodj');
    bump('autodj');
    var b = bpmCache[nextTrack.id];
    if(!b) { bpmFor(nextTrack); return 0; }
    return b.firstBeat > 0 ? b.firstBeat : 0;
  };
  function setAutoDj(on){
    autodj.on = !!on;
    lsSet(LS.autodj, autodj);
    if(autodj.on){
      var t = currentTrack();
      if(t) bpmFor(t).then(function(r){ if(r) toast('Auto-DJ on \u00b7 ' + (t.name || 'this song') + ' reads ' + r.bpm + ' BPM'); });
      var q = call('__scQueue') || [];
      var i = call('__scQueueIndex') || 0;
      var nxt = trackById(q[i + 1]);
      if(nxt) bpmFor(nxt);
    }
    renderStudio();
  }
  function beatsFor(seconds, bpm){
    if(!bpm) return null;
    var beat = 60 / bpm;
    return Math.max(1, Math.round(seconds / beat));
  }

  /* --------------------------------------------------------------------------
     10. THE ASSISTANT THAT ACTS - window.SCACT
     -------------------------------------------------------------------------- */
  var THEME_WORDS = {
    ember: 'ember', galaxy: 'galaxy', glacier: 'glacier', aurora: 'aurora', synthwave: 'synthwave',
    cyberpunk: 'cyberpunk', 'deep ocean': 'ocean', ocean: 'ocean', coral: 'coral', 'rose gold': 'rosegold',
    'royal blue': 'royal', 'ocean blue': 'blue', 'royal gold': 'gold', emerald: 'emerald', sunset: 'sunset',
    monochrome: 'mono', mono: 'mono', violet: 'purple', purple: 'purple', crimson: 'crimson',
    'deep teal': 'teal', teal: 'teal', forest: 'forest', midnight: 'midnight', rgb: 'rgb',
    'liquid glass': 'liquidglass'
  };
  var SCACT_INNER = {
    // Returns a sentence when the app carried the request out, or null.
    tryRun: function(msg){
      var text = String(msg || '').trim();
      var low = text.toLowerCase();
      if(!low) return null;
      var m;

      // "crop this from 1:20 to 2:00" / "export 1:20-2:00 as a clip" / "make a ringtone"
      m = low.match(/(?:crop|clip|trim|cut|export|ringtone)[^0-9]{0,24}(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:to|until|till|-|\u2013|through|and)\s*(\d{1,2}:\d{2}(?::\d{2})?)/);
      if(m){
        var s0 = clockToSec(m[1]), s1 = clockToSec(m[2]);
        if(s1 > s0){
          markFeature('assistant');
          bump('asstClip');
          if(!openClipSheet(s0, s1)){
            return 'Nothing is playing, so there is no audio to cut. Start a song and ask me again - I will set the clip to ' + secToClock(s0) + ' to ' + secToClock(s1) + ' and open it in Studio.';
          }
          checkAchievements(true);
          return 'Done - I set the clip to ' + secToClock(s0) + ' to ' + secToClock(s1) + ' and opened Studio with it ready. Tap Export clip and it saves as its own tagged MP3.';
        }
      }
      if(/\b(ringtone|story clip|make a clip|clip maker)\b/.test(low) && !/(crop|trim)\b/.test(low)){
        markFeature('assistant');
        if(!openClipSheet(0, 30)){
          return 'Nothing is playing to cut a ringtone from. Start a song and ask again - the first 30 seconds is the ringtone length.';
        }
        return 'Opened the clip maker in Studio with the first 30 seconds selected - that is the ringtone length. Move the ends and tap Export clip.';
      }
      // "make a playlist of my most-played songs"
      if(/(playlist)/.test(low) && /(most[- ]?played|most played|top played|favourites|favorites|best songs|heavy rotation)/.test(low)){
        var n = (low.match(/\b(\d{2,3})\b/) || [])[1];
        var want = Math.max(5, Math.min(200, n ? parseInt(n, 10) : 25));
        var top = allTracks().filter(function(t){ return (t.playCount || 0) > 0 })
          .sort(function(a, b){ return (b.playCount || 0) - (a.playCount || 0); })
          .slice(0, want);
        if(!top.length) return 'None of your songs have been played yet, so there is nothing to rank - play a few and ask me again.';
        var name = 'Most played';
        var k = 2;
        var existing = call('__scPlaylists') || {};
        while(existing[name]){ name = 'Most played ' + (k++); }
        call('__scSetPlaylist', name, top.map(function(t){ return t.id; }));
        markFeature('assistant');
        bump('asstPlaylist');
        checkAchievements(true);
        return 'Made a playlist called "' + name + '" with your ' + top.length + ' most-played songs. "' + (top[0].name || 'the top one') + '" is first with ' + (top[0].playCount || 0) + ' plays.';
      }
      // "turn on the Ember theme"
      m = low.match(/(?:turn on|switch to|use|set|enable|change to|put on)\s+(?:the\s+)?([a-z ]+?)\s*(?:theme|mode|look)?\s*$/);
      if(m && /theme|look/.test(low)){
        var key = THEME_WORDS[m[1].trim()];
        if(key){
          call('__scApplyTheme', key);
          noteTheme(key);
          markFeature('assistant');
          bump('asstTheme');
          return 'Theme switched to ' + m[1].trim() + '.';
        }
      }
      // "start karaoke"
      if(/\bkaraoke\b/.test(low) && /(start|on|enable|play|begin|need|want|switch|put)/.test(low)){
        setFx({ karaoke: 1, preset: 'karaoke' });
        markFeature('assistant'); markFeature('karaoke');
        renderStudio();
        return 'Karaoke mode is on - the lead vocal is pulled out of what is playing. Turn it down in Studio \u2192 Karaoke if you want some of it back.';
      }
      // "slow it down" / "slowed and reverb"
      if(/(slow(ed)?( down)?|nightcore|chipmunk|lo-?fi)/.test(low) && /(slow|reverb|down|speed|pitch|play)/.test(low)){
        var pre = /nightcore|chipmunk/.test(low) ? 'nightcore' : (/lo-?fi/.test(low) ? 'lofi' : 'slowed');
        var P = PRESETS.filter(function(p){ return p.id === pre; })[0] || PRESETS[0];
        setFx({ rate: P.rate, reverb: P.reverb, karaoke: 0, preset: P.id });
        markFeature('assistant');
        return P.name + ' is on - ' + P.rate.toFixed(2) + 'x with ' + Math.round(P.reverb * 100) + '% reverb.';
      }
      // "open the storage cleaner" / "what is taking up space"
      if(/(storage|space|biggest|large files|disk)/.test(low) && /(clean|free|space|biggest|largest|what|show|open|taking)/.test(low)){
        navigate('studio');
        setTimeout(function(){ scrollStudioTo('scStudioStorage'); }, 260);
        markFeature('assistant');
        return 'Opened the storage cleaner in Studio - your biggest songs are listed with a re-encode button on each one.';
      }
      // "open studio"
      if(/\bstudio\b/.test(low) && /(open|show|go to|take me)/.test(low)){
        navigate('studio');
        return 'Studio is open.';
      }
      // "start auto-dj" / "blend on the beat"
      if(/(auto[- ]?dj|beat[- ]?match|crossfade on the beat|blend)/.test(low) && /(start|on|enable|turn|use|do)/.test(low)){
        setAutoDj(true);
        markFeature('assistant');
        return 'Auto-DJ is on. It reads the tempo of the song that is finishing and starts the next one on a beat inside the crossfade.';
      }
      // "make a batch of ..." - hand the tag editor over rather than guessing
      if(/(fix|change|edit|set)\s+(the\s+)?(artist|album|genre|cover|tags)/.test(low)){
        markFeature('assistant');
        openBatchTags(call('__scSelectedIds') || []);
        return 'Opened the batch tag editor. Tick the songs in your library first if the list came up empty, then write the change once for all of them.';
      }
      // playback verbs
      if(/^(next|skip)\b/.test(low)){ call('__scNext'); markFeature('assistant'); bump('asstTransport'); return 'Skipped to the next song.'; }
      if(/^(previous|prev|back a song|go back)\b/.test(low)){ call('__scPrev'); markFeature('assistant'); return 'Back to the previous song.'; }
      if(/^(pause|stop the music|stop)\b/.test(low)){ call('__scPause'); markFeature('assistant'); return 'Paused.'; }
      if(/^(play|resume)\b/.test(low) && low.length < 14){ call('__scResume'); markFeature('assistant'); return 'Playing.'; }
      return null;
    }
  };
  // Every action that actually happened, counted once, at the one place that can
  // tell the difference: the inner object returns a sentence when the app carried
  // the request out and null when it did not.
  var SCACT = {
    tryRun: function(msg){
      var r = SCACT_INNER.tryRun(msg);
      if(r){ bump('assistant'); checkAchievements(true); }
      return r;
    }
  };
  window.SCACT = SCACT;

  /* --------------------------------------------------------------------------
     11. THE STUDIO VIEW
     -------------------------------------------------------------------------- */
  function navigate(view){
    if(typeof window.navigate === 'function'){ window.navigate(view); return; }
    if(has('__scNavigate')) window.__scNavigate(view);
  }
  function scrollStudioTo(id){
    if(id === 'scStudioStorage') bump('cleaner');
    var el = $(id);
    var host = $('studioView');
    if(el && host) host.scrollTop = Math.max(0, el.offsetTop - 8);
  }
  function pctNeed(a){ return Math.round((a.need.got / a.need.want) * 100); }
  function isUnlocked(a){ return a.need.got >= a.need.want; }

  function padHtml(){
    var out = '';
    for(var i = 0; i < 8; i++){
      var p = sampler.pads[i];
      out += '<button class="sc-pad" id="scPad' + i + '" data-pad="' + i + '">' +
        '<span class="sc-pad-n">' + (i + 1) + '</span>' +
        '<span class="sc-pad-at">' + (p.start == null ? 'empty' : secToClock(p.start)) + '</span>' +
        '<span class="sc-pad-len">' + (p.len || 0.5).toFixed(1) + 's</span>' +
        '</button>';
    }
    return out;
  }
  // One badge tile. The grouped grid calls this per badge (70.0.5 added 171 of
  // them, in nine sections, so the grid needs a tile it can call rather than a
  // map over everything), and the secret badge has a tile of its own below it
  // because it must not be spoiled before it is earned.
  function badgeTile(a){
      var have = isUnlocked(a);
      var p = pctNeed(a);
      var out = '';
      out += '<div class="sc-badge' + (have ? ' have' : '') + ' tone-' + a.tone + '">' +
        '<div class="sc-badge-ico">' + a.ico + '</div>' +
        '<div class="sc-badge-txt"><div class="sc-badge-name">' + esc(a.name) + '</div>' +
        '<div class="sc-badge-sub">' + esc(have ? a.sub : a.sub + ' \u00b7 ' + p + '%') + '</div>' +
        '<div class="sc-badge-bar"><i style="width:' + (have ? 100 : p) + '%"></i></div></div></div>';
      return out;
  }
  var achFilter = 'all';
  function secretTile(){
    return '<div class="sc-badge sc-badge-secret">' +
      '<div class="sc-badge-ico">?</div>' +
      '<div class="sc-badge-txt"><div class="sc-badge-name">Hidden badge</div>' +
      '<div class="sc-badge-sub">One badge is not in this list.</div>' +
      '<div class="sc-badge-bar"><i style="width:0%"></i></div></div></div>';
  }
  function achievementsHtml(all){
    var list = all || ACHIEVEMENTS();
    var html = badgesByGroup(list).map(function(g){
      var isSecret = g.key === 'secret';
      // Before the door is found, the secret group is one blank tile and nothing
      // else: the hint that there IS a hidden badge is the point, the answer is not.
      if(isSecret && !doorOpen){
        return '<div class="sc-ach-group">' +
          '<div class="sc-ach-group-head"><span>' + esc(g.title) + '</span><span>' + g.have + '/' + g.items.length + '</span></div>' +
          '<div class="sc-badges">' + (g.have ? g.items.filter(isUnlocked).map(badgeTile).join('') : secretTile()) + '</div></div>';
      }
      var items = g.items.filter(function(a){
        if(achFilter === 'have') return isUnlocked(a);
        if(achFilter === 'todo') return !isUnlocked(a);
        return true;
      });
      if(!items.length) return '';
      var tiles = items.map(function(a){
        if(a.secret && !isUnlocked(a)) return secretTile();
        return badgeTile(a);
      }).join('');
      return '<div class="sc-ach-group">' +
        '<div class="sc-ach-group-head"><span>' + esc(g.title) + '</span><span>' + g.have + '/' + g.items.length + '</span></div>' +
        '<div class="sc-badges">' + tiles + '</div></div>';
    }).join('');
    return html || '<div class="sc-note">Nothing matches that filter yet.</div>';
  }
  function achFilterChips(){
    return '<div class="sc-chips sc-ach-filters"><span class="sc-chip-label">Show</span>' +
      [['all', 'Everything'], ['have', 'Earned'], ['todo', 'Still to get']].map(function(f){
        return '<button class="sc-chip' + (achFilter === f[0] ? ' on' : '') + '" data-act="achfilter" data-f="' + f[0] + '">' + f[1] + '</button>';
      }).join('') + '</div>';
  }
  function rewardRowHtml(r){
    var pct = r.earned ? 100 : Math.round((r.have / r.at) * 100);
    var state = r.earned
      ? '<span class="sc-reward-have">Unlocked</span>'
      : '<span class="sc-reward-need">' + (r.at - r.have) + ' to go</span>';
    var act = !r.earned ? ''
      : (r.kind === 'theme'
        ? '<button class="sc-btn tiny primary" data-act="usetheme" data-key="' + r.key + '">Use it</button>'
        : '');
    return '<div class="sc-reward' + (r.earned ? ' on' : '') + '">' +
      '<div class="sc-reward-at">' + r.at + '</div>' +
      '<div class="sc-reward-txt"><div class="sc-reward-name">' + esc(r.name) + '</div>' +
      '<div class="sc-reward-note">' + esc(r.note) + '</div>' +
      '<div class="sc-reward-bar"><i style="width:' + pct + '%"></i></div></div>' +
      '<div class="sc-reward-act">' + state + act + '</div></div>';
  }
  function rewardsHtml(){
    return '<div class="sc-rewards">' + rewardState().map(rewardRowHtml).join('') + '</div>';
  }
  function storageHtml(){
    var rows = biggestSongs(24);
    if(!rows.length) return '<div class="sc-note">No song has a readable file size yet.</div>';
    var total = totalAudioBytes();
    var html = '<div class="sc-note">Your library holds <b>' + fmtBytes(total) + '</b> of audio across ' + allTracks().length + ' songs. These are the biggest files - the fastest space back.</div>';
    html += '<div class="sc-store-list">' + rows.map(function(r){
      var t = r.t;
      var big = r.size > 8 * 1048576;
      return '<div class="sc-store-row">' +
        '<div class="sc-art sm" style="' + (t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
        '<div class="sc-store-txt"><div class="sc-store-name">' + esc(t.name || 'Untitled') + '</div>' +
        '<div class="sc-store-sub">' + esc(t.artist || 'Unknown artist') + ' \u00b7 ' + fmtBytes(r.size) + (t.reencoded ? ' \u00b7 already re-encoded' : '') + '</div></div>' +
        '<button class="sc-btn tiny' + (big ? ' primary' : '') + '" data-reenc="' + esc(t.id) + '">Re-encode</button>' +
        '</div>';
    }).join('') + '</div>';
    html += '<div class="sc-chips"><span class="sc-chip-label">Target bitrate</span>' +
      REENCODE_RATES.map(function(k){
        return '<button class="sc-chip' + (reenKbps === k ? ' on' : '') + '" data-reenk="' + k + '">' + k + ' kbps</button>';
      }).join('') + '</div>';
    html += '<div class="sc-note">A re-encode keeps the song in place - same name, artist, album and cover - and only the stored file changes. Every one of them can be undone with the Undo chip that appears when it finishes.</div>';
    return html;
  }
  var reenKbps = 128;
  // The whole Achievements section, built once per repaint: the hero, the five
  // rewards, the filter and the eight groups. It counts the badges ONCE and hands
  // that list down - ACHIEVEMENTS() walks the library, and this section used to
  // ask for it four times a repaint.
  function achievementsSectionHtml(){
    var s = stats();
    var allList = ACHIEVEMENTS();
    var unlocked = allList.filter(function(a){ return a.need.got >= a.need.want; }).length;
    var all = allList.length;
    if(!ctr('badgeGrid')) bump('badgeGrid', 1); // the one-time "you found this screen" badge
    var hours = (s.listenSeconds || 0) / 3600;
    return '<div class="sc-hero">' +
      '<div class="sc-hero-num">' + hours.toFixed(1) + 'h</div>' +
      '<div class="sc-hero-sub">listened \u00b7 ' + (s.plays || 0) + ' plays \u00b7 ' + (s.streak || 0) + '-day streak</div>' +
      '<div class="sc-hero-ring"><i style="width:' + Math.round((unlocked / Math.max(1, all)) * 100) + '%"></i></div>' +
      '<div class="sc-hero-badges">' + unlocked + ' of ' + all + ' badges</div>' +
      '</div>' +
      '<div class="sc-sub-head">Rewards</div>' + rewardsHtml() +
      achFilterChips() +
      '<div class="sc-ach-groups">' + achievementsHtml(allList) + '</div>' +
      '</div>';
  }

  function renderStudio(){
    var host = $('studioView');
    if(!host) return;
    // 71.4 - the header, every card and every tool read the WORKING song, not
    // "whatever is playing". Nothing playing is no longer the same thing as
    // nothing to edit.
    var t = workTrack();
    var s = stats();
    var html = '' +
      '<div class="sc-head"><h2>Studio</h2><div class="sc-head-sub">Everything creative, in one place \u00b7 ' + VERSION + '</div></div>' +
      '<div class="sc-now">' +
        '<div class="sc-art lg" style="' + (t && t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
        '<div class="sc-now-txt"><div class="sc-now-tag">Working song</div>' +
        '<div class="sc-now-name">' + esc(t ? (t.name || 'Untitled') : 'No song loaded') + '</div>' +
        '<div class="sc-now-sub">' + esc(t ? (t.artist || 'Unknown artist') : 'Add a song to your library to use the tools') + '</div>' +
        '<div class="sc-now-tools">' +
          '<button class="sc-btn tiny" data-act="choose">Choose song</button>' +
          '<button class="sc-btn tiny" data-act="edit">Edit rack</button>' +
          '<button class="sc-btn tiny" data-act="loadsampler">Load sampler</button>' +
          '<button class="sc-btn tiny" data-act="crop">Crop</button>' +
          '<button class="sc-btn tiny" data-act="clip">Make a clip</button>' +
          '<button class="sc-btn tiny" data-act="playpick">Play it</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="sc-tools">' +
        toolCard('crop', '\u2702', 'Crop song', 'Trim the start and the end in place \u2014 the same cropper as the \u22ee menu, with Undo crop on the song.', 'accent') +
        toolCard('edit', '\ud83c\udf9a', 'Edit rack', editSummary(), (edit.silent || edit.fades || edit.reverse || edit.gainDb) ? 'on' : '') +
        toolCard('clip', '\ud83c\udfb5', 'Ringtone / clip', 'Save a section as its own tagged MP3. Nothing in your library changes.', '') +
        toolCard('cleanup', '\u2728', 'Clean up this song', 'Trim the silence and match the level, then save it as its own tagged file.', '') +
        toolCard('fx', '\ud83c\udf0a', 'Slowed + reverb', fxState.rate === 1 && !fxState.reverb ? 'Add weight and space, or speed it up.' : fxState.rate.toFixed(2) + 'x \u00b7 ' + Math.round(fxState.reverb * 100) + '% wet', fxState.rate !== 1 || fxState.reverb > 0 ? 'on' : '') +
        toolCard('karaoke', '\ud83c\udfa4', 'Karaoke mode', fxState.karaoke > 0 ? 'Vocal pulled out \u00b7 ' + Math.round(fxState.karaoke * 100) + '%' : 'Take the lead vocal out of what is playing.', fxState.karaoke > 0 ? 'on' : '') +
        toolCard('sampler', '\ud83c\udf9b', 'Sampler pads', sampler.trackId ? 'Loaded with "' + esc(trackName(sampler.trackId)) + '"' : 'Eight pads over the song you are playing.', sampler.trackId ? 'on' : '') +
        toolCard('looper', '\ud83d\udd01', 'Loop recorder', looper.layers.length ? looper.layers.length + ' loop' + (looper.layers.length === 1 ? '' : 's') + ' repeating' : 'Record a bar and layer it.', looper.layers.length ? 'on' : '') +
        // 70.1.2. The sleep timer is free and says so by not mentioning money;
        // the sleep timer and the practice loop are simply two more tools, with no
      // price named on either of them.
        toolCard('sleep', '\ud83c\udf19', 'Sleep timer', sleep.mode ? 'Set: ' + sleepLabel() : 'Stop the music after a while.', sleep.mode ? 'on' : '') +
        toolCard('practice', '\ud83c\udfaf', 'Practice loop', (practice.on ? 'Looping ' + secToClock(practice.a) + ' - ' + secToClock(practice.b) + (practice.ramp ? ', faster every other pass' : '') : 'Loop a section until you have it' + (practice.ramp ? ', speeding up every other pass' : '') + '.'), practice.on ? 'on' : '') +
      '</div>' +
      achievementsSectionHtml() +
      '<div class="sc-sec" id="scStudioStorage"><div class="sc-sec-head"><span>Storage cleaner</span><span class="sc-sec-sub">' + fmtBytes(totalAudioBytes()) + '</span></div>' +
        storageHtml() + '</div>' +
        apkSectionHtml() +
      '<div class="sc-sec"><div class="sc-sec-head"><span>Auto-DJ</span><span class="sc-sec-sub">' + (autodj.on ? 'on' : 'off') + '</span></div>' +
        '<div class="sc-toggle-row"><div><div class="sc-toggle-name">Blend on the beat</div><div class="sc-toggle-sub">Reads the tempo of the song that is finishing and starts the next one on a beat inside the crossfade.</div></div>' +
        '<button class="sc-switch' + (autodj.on ? ' on' : '') + '" data-act="autodj" role="switch" aria-checked="' + (autodj.on ? 'true' : 'false') + '"><i></i></button></div>' +
        (autodj.on ? '<div class="sc-note" id="scBpmNote"></div>' : '<div class="sc-note">Crossfade length comes from Settings \u2192 More. Auto-DJ decides WHERE inside that blend the next song lands.</div>') +
      '</div>' +
      '<div class="sc-sec"><div class="sc-sec-head"><span>Gestures</span><span class="sc-sec-sub">' + ((gestures.shake ? 1 : 0) + (gestures.swipe ? 1 : 0)) + '/2 on</span></div>' +
        '<div class="sc-toggle-row"><div><div class="sc-toggle-name">Shake to skip</div><div class="sc-toggle-sub">Shake the phone and the next song starts. Needs the motion permission Android asks for once.</div></div>' +
        '<button class="sc-switch' + (gestures.shake ? ' on' : '') + '" data-act="shake" role="switch" aria-checked="' + (gestures.shake ? 'true' : 'false') + '"><i></i></button></div>' +
        '<div class="sc-toggle-row"><div><div class="sc-toggle-name">Swipe the player</div><div class="sc-toggle-sub">Left or right on the player art or title changes track. Drag on the progress bar to seek.</div></div>' +
        '<button class="sc-switch' + (gestures.swipe ? ' on' : '') + '" data-act="swipe" role="switch" aria-checked="' + (gestures.swipe ? 'true' : 'false') + '"><i></i></button></div>' +
      '</div>' +
      '<div class="sc-sec"><div class="sc-sec-head"><span>Batch tag editor</span><span class="sc-sec-sub">' + ((call('__scSelectedIds') || []).length) + ' selected</span></div>' +
        '<div class="sc-note">Tick songs in Library (long-press one to start selecting) and fix the artist, the album or the cover for all of them at once. The tag inside each stored file is rewritten.</div>' +
        '<div class="sc-actions"><button class="sc-btn primary" data-act="batch">Edit tags for selected songs</button></div>' +
      '</div>' +
      '<div class="sc-sec"><div class="sc-sec-head"><span>Batch on selected</span><span class="sc-sec-sub">' + ((call('__scSelectedIds') || []).length) + ' selected</span></div>' +
        '<div class="sc-note">Re-encode or run the edit rack over every song you have ticked, in one go. Each song is saved as its own copy \u2014 nothing in your library is overwritten.</div>' +
        '<div class="sc-chips"><span class="sc-chip-label">Bitrate</span>' + REENCODE_RATES.map(function(k){ return '<button class="sc-chip' + (reenKbps === k ? ' on' : '') + '" data-reenk="' + k + '">' + k + ' kbps</button>'; }).join('') + '</div>' +
        '<div class="sc-actions">' +
          '<button class="sc-btn' + (batchRun.busy ? '' : ' primary') + '" data-act="batchreen"' + (batchRun.busy ? ' disabled' : '') + '>Re-encode selected</button>' +
          '<button class="sc-btn" data-act="batchedit"' + (batchRun.busy ? ' disabled' : '') + '>Edit selected</button>' +
        '</div>' +
        batchProgressHtml() +
      '</div>';
    host.innerHTML = html;
    wireStudio();
    paintBpmNote();
  }
  /* --------------------------------------------------------------------------
     13b. APK DOWNLOADS - the one number only GitHub keeps
     -------------------------------------------------------------------------- */
  // "to see how many apks I have downloaded". GitHub counts downloads against
  // RELEASE assets; a workflow artifact is a private build output with no counter
  // on it at all. The Android workflow attaches each flavor to a release as well
  // as to the artifact, and this reads the public API. Nothing is fetched until
  // the button is pressed, and a failure says so instead of showing a zero.
  var GH_REPO = 'AnekTheGreat/SideCut';
  var apk = { busy: false, error: '', rows: null };
  function apkTotal(){
    if(!apk.rows) return 0;
    return apk.rows.reduce(function(n, r){ return n + (r.count || 0); }, 0);
  }
  function apkBodyHtml(){
    if(apk.busy) return '<div class="sc-note">Asking GitHub\u2026</div>';
    if(apk.error) return '<div class="sc-note sc-bad">' + esc(apk.error) + '</div>';
    if(!apk.rows) return '<div class="sc-note">Read the download count for every APK the Android build has published. GitHub keeps the number, because the APKs are attached to a release as well as to the build artifact.</div>';
    if(!apk.rows.length) return '<div class="sc-note">No APK is attached to a release yet. The next push to main publishes one, and the count appears here.</div>';
    return '<div class="sc-apks">' + apk.rows.map(function(r){
      return '<div class="sc-apk-row"><span class="sc-apk-name">' + esc(r.name) + '</span>' +
        '<span class="sc-apk-count">' + r.count + ' download' + (r.count === 1 ? '' : 's') + '</span>' +
        '<span class="sc-apk-when">' + esc(r.when) + '</span></div>';
    }).join('') + '</div>';
  }
  function apkSectionHtml(){
    return '<div class="sc-sec" id="scStudioApks"><div class="sc-sec-head"><span>APK downloads</span><span class="sc-sec-sub">' +
      (apk.rows ? apkTotal() + ' total' : 'not read yet') + '</span></div>' + apkBodyHtml() +
      '<div class="sc-actions"><button class="sc-btn' + (apk.rows ? '' : ' primary') + '" data-act="apkread"' +
      (apk.busy ? ' disabled' : '') + '>' + (apk.rows ? 'Refresh' : 'Read the counts') + '</button></div></div>';
  }
  function loadApkDownloads(){
    if(apk.busy) return;
    apk.busy = true; apk.error = ''; renderStudio();
    fetch('https://api.github.com/repos/' + GH_REPO + '/releases?per_page=30', { headers: { Accept: 'application/vnd.github+json' } })
      .then(function(r){ if(!r.ok) throw new Error('GitHub answered ' + r.status); return r.json(); })
      .then(function(list){
        var rows = [];
        (list || []).forEach(function(rel){
          (rel.assets || []).forEach(function(a){
            if(!/\.apk$/i.test(a.name || '')) return;
            rows.push({ name: a.name, count: a.download_count || 0, when: String(rel.tag_name || '') });
          });
        });
        apk.rows = rows; apk.busy = false; renderStudio();
      })
      .catch(function(e){
        apk.busy = false; apk.rows = null;
        apk.error = 'Could not read the counts from GitHub (' + ((e && e.message) || 'network') + '). Reading them needs the SideCut repository to be public and to have releases.';
        renderStudio();
      });
  }
  function trackName(id){
    var t = trackById(id);
    return t ? (t.name || 'Untitled') : 'this song';
  }
  function toolCard(id, ico, name, sub, state){
    return '<button class="sc-tool' + (state === 'on' ? ' on' : '') + (state === 'accent' ? ' accent' : '') + '" data-tool="' + id + '">' +
      '<span class="sc-tool-ico">' + ico + '</span>' +
      '<span class="sc-tool-txt"><span class="sc-tool-name">' + name + '</span><span class="sc-tool-sub">' + sub + '</span></span>' +
      '</button>';
  }
  function paintBpmNote(){
    var el = $('scBpmNote');
    if(!el) return;
    var t = currentTrack();
    if(!t || !autodj.on){ el.textContent = ''; return; }
    el.textContent = 'Reading the tempo\u2026';
    bpmFor(t).then(function(r){
      var note = $('scBpmNote');
      if(!note) return;
      var q = call('__scQueue') || [];
      var i = call('__scQueueIndex') || 0;
      var nxt = trackById(q[i + 1]);
      var line = r ? '"' + (t.name || 'this song') + '" reads ' + r.bpm + ' BPM' : 'This song\u2019s tempo could not be read';
      if(nxt) line += ' \u00b7 next up: "' + (nxt.name || '') + '"';
      note.textContent = line;
    });
  }
  function wireStudio(){
    document.querySelectorAll('#studioView [data-tool]').forEach(function(b){
      b.addEventListener('click', function(){ openTool(b.getAttribute('data-tool')); });
    });
    document.querySelectorAll('#studioView [data-act]').forEach(function(b){
      b.addEventListener('click', function(){
        // 71.4 - everything in this row answers. A control whose tool is missing
        // from the build used to be indistinguishable from one that is simply not
        // wired, because the exception went nowhere.
        try{
        var act = b.getAttribute('data-act');
        if(act === 'loadsampler') loadSamplerFor(workTrack());
        else if(act === 'apkread') loadApkDownloads();
        else if(act === 'crop') cropCurrent();
        else if(act === 'clip') openClipSheet();
        else if(act === 'autodj') setAutoDj(!autodj.on);
        else if(act === 'shake') enableShake(!gestures.shake);
        else if(act === 'swipe'){ gestures.swipe = !gestures.swipe; lsSet(LS.gestures, gestures); toast(gestures.swipe ? 'Swipe the player is on' : 'Swipe the player is off'); renderStudio(); }
        else if(act === 'batchreen') runBatch('reen');
        else if(act === 'batchedit') runBatch('edit');
        else if(act === 'batch') openBatchTags(call('__scSelectedIds') || []);
        else if(act === 'achfilter'){ achFilter = b.getAttribute('data-f') || 'all'; renderStudio(); }
        else if(act === 'usetheme'){
          var k = b.getAttribute('data-key');
          if(themeUnlocked(k)){
            call('__scApplyTheme', k); noteTheme(k); bump('themeChange');
            var rw = REWARDS.filter(function(r){ return r.key === k; })[0] || {};
            toast('Theme: ' + (rw.name || k));
            renderStudio();
          } else toast('Earn the badges for that theme first.');
        }
        else if(act === 'edit') openEditSheet();
        else if(act === 'choose') openSongPickerSheet();
        else if(act === 'playpick') playWorkTrack();
        }catch(e){ toast('That tool could not answer: ' + ((e && e.message) || 'unknown error')); }
      });
    });
    document.querySelectorAll('#studioView [data-reenc]').forEach(function(b){
      b.addEventListener('click', function(){ reencodeTrack(b.getAttribute('data-reenc'), reenKbps, b); });
    });
    document.querySelectorAll('#studioView [data-reenk]').forEach(function(b){
      b.addEventListener('click', function(){ reenKbps = parseInt(b.getAttribute('data-reenk'), 10); renderStudio(); });
    });
  }
  function openTool(id){
    bump('studio');
    markFeature('studio');
    // 71.4 - a tool that throws used to look exactly like a tool that was never
    // wired. Every card is answered, and one that cannot open says so.
    try{
      if(id === 'crop') return cropCurrent();
      if(id === 'clip') return openClipSheet();
      if(id === 'edit') return openEditSheet();
      if(id === 'cleanup') return cleanUpSong();
      if(id === 'fx') return openFxSheet();
      if(id === 'karaoke') return openKaraokeSheet();
      if(id === 'sampler') return openSamplerSheet();
      if(id === 'looper') return openLooperSheet();
      if(id === 'sleep') return openSleepSheet();
      if(id === 'practice') return openPracticeSheet();
      toast('That tool is not in this build.');
    }catch(e){
      toast('That tool could not open: ' + ((e && e.message) || 'unknown error'));
    }
  }

  /* --------------------------------------------------------------------------
     12. THE SHEETS
     -------------------------------------------------------------------------- */
  function ensureSheet(){
    var d = $('scSheet');
    if(d) return d;
    d = document.createElement('div');
    d.id = 'scSheet';
    d.className = 'sc-sheet-backdrop';
    d.innerHTML = '<div class="sc-sheet" role="dialog" aria-modal="true"><div class="sc-sheet-grip"></div>' +
      '<div class="sc-sheet-head"><h3 id="scSheetTitle"></h3><button id="scSheetX" aria-label="Close">\u2715</button></div>' +
      '<div class="sc-sheet-body" id="scSheetBody"></div></div>';
    document.body.appendChild(d);
    d.addEventListener('click', function(e){ if(e.target === d) closeSheet(); });
    var x = $('scSheetX');
    if(x) x.addEventListener('click', closeSheet);
    return d;
  }
  function openSheet(title, bodyHtml){
    var d = ensureSheet();
    var ti = $('scSheetTitle');
    if(ti) ti.textContent = title;
    var b = $('scSheetBody');
    if(b) b.innerHTML = bodyHtml;
    d.style.display = 'flex';
    // The sheet is a fixed layer over the app; stop the page behind it scrolling.
    requestAnimationFrame(function(){ d.classList.add('in'); });
    return b;
  }
  function closeSheet(){
    var d = $('scSheet');
    if(!d) return;
    d.classList.remove('in');
    d.style.display = 'none';
    var b = $('scSheetBody');
    if(b) b.innerHTML = '';
  }
  function openFxSheet(){
    var P = PRESETS;
    var body = '<div class="sc-note">This colours whatever is playing right now \u2014 it is not a file, so you can hear each change as you make it.</div>' +
      '<div class="sc-chips">' + P.map(function(p){
        return '<button class="sc-chip' + (fxState.preset === p.id ? ' on' : '') + '" data-preset="' + p.id + '"><b>' + p.name + '</b><i>' + p.sub + '</i></button>';
      }).join('') + '</div>' +
      '<div class="sc-slider"><label>Speed <span id="scFxRateV">' + fxState.rate.toFixed(2) + 'x</span></label><input type="range" id="scFxRate" min="0.5" max="1.5" step="0.01" value="' + fxState.rate + '"></div>' +
      '<div class="sc-slider"><label>Reverb <span id="scFxRevV">' + Math.round(fxState.reverb * 100) + '%</span></label><input type="range" id="scFxRev" min="0" max="1" step="0.01" value="' + fxState.reverb + '"></div>' +
      '<div class="sc-slider"><label>Vocal out (karaoke) <span id="scFxKarV">' + Math.round(fxState.karaoke * 100) + '%</span></label><input type="range" id="scFxKar" min="0" max="1" step="0.01" value="' + fxState.karaoke + '"></div>' +
      '<div class="sc-note">Slowed down, the pitch drops with the speed \u2014 that is the sound of the preset, not a bug.</div>' +
      myPresetsHtml() +
      '<div class="sc-actions"><button class="sc-btn" data-preset="off">Reset to normal</button><button class="sc-btn primary" id="scFxDone">Done</button></div>';
    openSheet('Slowed + reverb', body);
    document.querySelectorAll('#scSheetBody [data-preset]').forEach(function(b){
      b.addEventListener('click', function(){
        var id = b.getAttribute('data-preset');
        var p = PRESETS.filter(function(x){ return x.id === id; })[0];
        if(!p) return;
        setFx({ rate: p.rate, reverb: p.reverb, karaoke: p.karaoke, preset: p.id }, true);
        markFeature('studio');
        if(p.rate !== 1) markFeature('slow');
        if(p.karaoke > 0) markFeature('karaoke');
        checkAchievements(true);
        openFxSheet();
      });
    });
    // Your own presets. The sheet is not part of #studioView, so wireStudio never
    // sees these buttons - they are wired here, the way the loop recorder does it.
    document.querySelectorAll('#scSheetBody [data-myuse]').forEach(function(b){
      b.addEventListener('click', function(){ useMyPreset(b.getAttribute('data-myuse')); });
    });
    document.querySelectorAll('#scSheetBody [data-mydrop]').forEach(function(b){
      b.addEventListener('click', function(){ dropMyPreset(b.getAttribute('data-mydrop')); });
    });
    var saveMy = $('scMySave');
    if(saveMy) saveMy.addEventListener('click', saveMyPreset);
    var rate = $('scFxRate');
    if(rate) rate.addEventListener('input', function(){
      fxState.rate = parseFloat(rate.value); fxState.preset = '';
      var v = $('scFxRateV'); if(v) v.textContent = fxState.rate.toFixed(2) + 'x';
      applyFx(); applyRate(); saveFx();
      markFeature('studio'); if(fxState.rate !== 1) markFeature('slow');
    });
    var rev = $('scFxRev');
    if(rev) rev.addEventListener('input', function(){
      fxState.reverb = parseFloat(rev.value); fxState.preset = '';
      var v = $('scFxRevV'); if(v) v.textContent = Math.round(fxState.reverb * 100) + '%';
      applyFx(); saveFx(); markFeature('studio');
    });
    var kar = $('scFxKar');
    if(kar) kar.addEventListener('input', function(){
      fxState.karaoke = parseFloat(kar.value);
      var v = $('scFxKarV'); if(v) v.textContent = Math.round(fxState.karaoke * 100) + '%';
      applyFx(); saveFx(); markFeature('studio'); if(fxState.karaoke > 0) markFeature('karaoke');
    });
    var done = $('scFxDone');
    if(done) done.addEventListener('click', function(){ checkAchievements(true); closeSheet(); renderStudio(); });
  }
  function openKaraokeSheet(){
    var body = '<div class="sc-note">Karaoke mode removes what is panned dead centre, which is where a lead vocal almost always sits. The band stays. It works best on a normal stereo mix; on a mono file there is nothing to cancel.</div>' +
      '<div class="sc-slider"><label>Vocal out <span id="scKarV">' + Math.round(fxState.karaoke * 100) + '%</span></label><input type="range" id="scKarAmt" min="0" max="1" step="0.01" value="' + fxState.karaoke + '"></div>' +
      '<div class="sc-chips"><button class="sc-chip" data-kar="0">Off</button><button class="sc-chip" data-kar="0.6">Half</button><button class="sc-chip" data-kar="1">Full karaoke</button></div>' +
      '<div class="sc-actions"><button class="sc-btn primary" id="scKarDone">Done</button></div>';
    openSheet('Karaoke mode', body);
    var amt = $('scKarAmt');
    if(amt) amt.addEventListener('input', function(){
      fxState.karaoke = parseFloat(amt.value);
      var v = $('scKarV'); if(v) v.textContent = Math.round(fxState.karaoke * 100) + '%';
      applyFx(); saveFx(); markFeature('karaoke');
    });
    document.querySelectorAll('#scSheetBody [data-kar]').forEach(function(b){
      b.addEventListener('click', function(){
        fxState.karaoke = parseFloat(b.getAttribute('data-kar'));
        applyFx(); saveFx(); markFeature('karaoke'); checkAchievements(true);
        var v = $('scKarV'); if(v) v.textContent = Math.round(fxState.karaoke * 100) + '%';
        var a = $('scKarAmt'); if(a) a.value = fxState.karaoke;
      });
    });
    var done = $('scKarDone');
    if(done) done.addEventListener('click', function(){ checkAchievements(true); closeSheet(); renderStudio(); });
  }
  function openSamplerSheet(){
    var body = '<div class="sc-note">Tap a pad to play a slice of the song you are playing. Long-press a pad to capture it at the point that is playing right now.</div>' +
      '<div class="sc-now"><div class="sc-art" style="' + (workTrack() && workTrack().artUrl ? 'background-image:url(' + esc(workTrack().artUrl) + ')' : '') + '"></div>' +
      '<div class="sc-now-txt"><div class="sc-now-name">' + esc(sampler.trackId ? trackName(sampler.trackId) : 'Nothing loaded') + '</div>' +
      '<div class="sc-now-sub">' + (sampler.trackId ? '8 pads \u00b7 tap to play, hold to capture' : 'Load the sampler to start') + '</div></div></div>' +
      '<div class="sc-pads">' + padHtml() + '</div>' +
      '<div class="sc-chips"><span class="sc-chip-label">Pad length</span>' +
        [0.25, 0.5, 1, 2].map(function(l){ return '<button class="sc-chip' + (padLen === l ? ' on' : '') + '" data-padlen="' + l + '">' + l + 's</button>'; }).join('') +
      '</div>' +
      '<div class="sc-actions"><button class="sc-btn primary" id="scSamplerLoad">' + (sampler.trackId ? 'Reload for this song' : 'Load the sampler') + '</button><button class="sc-btn" id="scSamplerDone">Done</button></div>';
    openSheet('Sampler pads', body);
    wirePads();
    var l = $('scSamplerLoad');
    if(l) l.addEventListener('click', function(){ loadSamplerFor(workTrack()).then(function(){ openSamplerSheet(); }); });
    var d = $('scSamplerDone');
    if(d) d.addEventListener('click', function(){ checkAchievements(true); closeSheet(); renderStudio(); });
  }
  var padLen = 0.5;
  function wirePads(){
    document.querySelectorAll('#scSheetBody [data-pad]').forEach(function(b){
      var i = parseInt(b.getAttribute('data-pad'), 10);
      var timer = null, held = false;
      var start = function(){
        held = false;
        timer = setTimeout(function(){ held = true; capturePad(i); }, 480);
      };
      var end = function(){
        if(timer) clearTimeout(timer);
        if(!held) playPad(i);
      };
      b.addEventListener('touchstart', start, { passive: true });
      b.addEventListener('touchend', function(e){ e.preventDefault(); end(); }, { passive: false });
      b.addEventListener('mousedown', start);
      b.addEventListener('mouseup', end);
      b.addEventListener('mouseleave', function(){ if(timer) clearTimeout(timer); });
    });
    document.querySelectorAll('#scSheetBody [data-padlen]').forEach(function(b){
      b.addEventListener('click', function(){
        padLen = parseFloat(b.getAttribute('data-padlen'));
        sampler.pads.forEach(function(p){ p.len = padLen; });
        savePads();
        openSamplerSheet();
      });
    });
  }
  function openLooperSheet(){
    var body = '<div class="sc-note">Press record and the last few seconds of what is playing are captured and repeated on top of the song. Record again to layer another one on top.</div>' +
      '<div class="sc-chips"><span class="sc-chip-label">Loop length</span>' +
        [2, 4, 8, 16].map(function(l){ return '<button class="sc-chip' + (looper.length === l ? ' on' : '') + '" data-loooop="' + l + '">' + l + 's</button>'; }).join('') +
      '</div>' +
      '<div class="sc-layer-hint">' + (looper.layers.length ? looper.layers.length + ' loop' + (looper.layers.length === 1 ? '' : 's') + ' playing' : 'Nothing looping yet') + '</div>' +
      '<div class="sc-actions"><button class="sc-btn primary" id="scLoopRec">\u25cf Record a loop</button><button class="sc-btn" id="scLoopStop">Stop all loops</button><button class="sc-btn" id="scLoopDone">Done</button></div>';
    openSheet('Loop recorder', body);
    document.querySelectorAll('#scSheetBody [data-loooop]').forEach(function(b){
      b.addEventListener('click', function(){ looper.length = parseInt(b.getAttribute('data-loooop'), 10); openLooperSheet(); });
    });
    var r = $('scLoopRec');
    if(r) r.addEventListener('click', function(){ recordLoop(); setTimeout(function(){ if($('scSheet') && $('scSheet').style.display === 'flex' && $('scSheetTitle').textContent === 'Loop recorder') openLooperSheet(); }, 400); });
    var s = $('scLoopStop');
    if(s) s.addEventListener('click', function(){ stopLoops(); openLooperSheet(); });
    var d = $('scLoopDone');
    if(d) d.addEventListener('click', function(){ checkAchievements(true); closeSheet(); renderStudio(); });
  }

  function openSleepSheet(){
    var body = '<div class="sc-note">The music stops by itself: after a set time, when this song ends, or after the last song in the queue. Free, and it stays free.</div>' +
      '<div class="sc-chips sc-sleep-chips">' + SLEEP_CHOICES.map(function(c){
        return '<button class="sc-chip' + (sleep.mode === c[0] ? ' on' : '') + '" data-sleepmin="' + c[0] + '"><b>' + c[1] + '</b>' + (c[2] ? '<i>' + c[2] + '</i>' : '') + '</button>';
      }).join('') + '</div>' +
      '<div class="sc-layer-hint">' + (sleep.mode ? 'Set: ' + sleepLabel() : 'Not set') + '</div>' +
      '<div class="sc-actions"><button class="sc-btn" id="scSleepOff">Cancel the timer</button><button class="sc-btn primary" id="scSleepDone">Done</button></div>';
    openSheet('Sleep timer', body);
    document.querySelectorAll('#scSheetBody [data-sleepmin]').forEach(function(b){
      b.addEventListener('click', function(){
        var m = b.getAttribute('data-sleepmin');
        if(m === 'off') setSleep('off'); else setSleep(m);
        if($('scSheet') && $('scSheet').style.display === 'flex' && $('scSheetTitle').textContent === 'Sleep timer') openSleepSheet();
      });
    });
    var off = $('scSleepOff');
    if(off) off.addEventListener('click', function(){ setSleep('off'); openSleepSheet(); });
    var done = $('scSleepDone');
    if(done) done.addEventListener('click', function(){ closeSheet(); renderStudio(); });
  }

  function openPracticeSheet(){
    var setAB = (practice.a || practice.b)
      ? '<div class="sc-note">Looping <b>' + secToClock(practice.a) + ' \u2192 ' + secToClock(practice.b) + '</b>' +
          (practice.ramp ? ' \u00b7 speeding up every other pass' : '') + '</div>'
      : '<div class="sc-note">Play the song, press Set A where the part starts and Set B where it ends. Then loop it until you have it.</div>';
    var pro = '<button class="sc-btn primary" id="scPracGo">' + (practice.on ? 'Restart the loop' : 'Start looping') + '</button>' +
        (practice.on ? '<button class="sc-btn" id="scPracOff">Stop</button>' : '');
    var body = '<div class="sc-note">A practice loop repeats one section of the song. With the ramp on it is a little faster every other pass, which is how a part is actually learned rather than played once.</div>' +
      setAB +
      '<div class="sc-actions"><button class="sc-btn" id="scPracA">Set A \u00b7 start</button><button class="sc-btn" id="scPracB">Set B \u00b7 end</button></div>' +
      '<div class="sc-chips"><button class="sc-chip' + (practice.ramp ? ' on' : '') + '" id="scPracRamp">' + (practice.ramp ? 'Ramp on \u00b7 faster every other pass' : 'Ramp off \u00b7 same speed') + '</button></div>' +
      (practice.on ? '<div class="sc-layer-hint">Pass ' + practice.passes + ' \u00b7 ' + fxState.rate.toFixed(2) + 'x</div>' : '') +
      '<div class="sc-actions">' + pro + '<button class="sc-btn" id="scPracDone">Done</button></div>';
    openSheet('Practice loop', body);
    var a = $('scPracA'); if(a) a.addEventListener('click', function(){ practiceMark('a'); });
    var b = $('scPracB'); if(b) b.addEventListener('click', function(){ practiceMark('b'); });
    var ramp = $('scPracRamp');
    if(ramp) ramp.addEventListener('click', function(){
      practice.ramp = !practice.ramp;
      toast(practice.ramp ? 'Ramp on: every other pass is a little faster' : 'Ramp off: same speed every pass');
      if(practice.on) practiceRun(); else openPracticeSheet();
      renderStudio();
    });
    var go = $('scPracGo'); if(go) go.addEventListener('click', function(){ practiceRun(); openPracticeSheet(); });
    var stop = $('scPracOff'); if(stop) stop.addEventListener('click', function(){ practiceStop(); openPracticeSheet(); });
    var done = $('scPracDone'); if(done) done.addEventListener('click', function(){ closeSheet(); renderStudio(); });
  }
  /* --------------------------------------------------------------------------
     13. THE SONG MENU, GROUPED (called from openSongActions in block 1)
     -------------------------------------------------------------------------- */
  var GROUPS = [
    { label: 'Play',      test: /^(play|play next|queue|start)/i },
    { label: 'Edit',      test: /(crop|clip|lyrics|vibe|cover|info|speed|tag|reverb|karaoke)/i },
    { label: 'Organize',  test: /(playlist|album|favourite|favorite|pin|move|reorder)/i },
    { label: 'Share',     test: /(share|export|download|save)/i },
    { label: 'Danger',    test: /(delete|remove|hide)/i }
  ];
  window.__scDecorSongSheet = function(){
    try{
      var host = document.getElementById('songActionsList');
      if(!host) return false;
      var btns = Array.prototype.slice.call(host.querySelectorAll('button'));
      if(btns.length < 3) return false;
      // 70.0.8 - "where is speed adjuster in song 3 dots menu". It was always
      // built: the app puts a Playback speed slider in this sheet. It is a <div>
      // with a range input rather than a button, and the rebuild below throws the
      // whole list away and puts back only what it collected - so the slider was
      // discarded every time the sheet opened. Everything that is not a button is
      // carried across now and put back at the top of the Play group, where a
      // speed control belongs.
      var extras = [];
      Array.prototype.slice.call(host.children).forEach(function(ch){
        if(ch.tagName === 'BUTTON') return;
        if(ch.classList && ch.classList.contains('sc-sheet-group')) return;
        extras.push(ch);
      });
      var buckets = GROUPS.map(function(g){ return { label: g.label, test: g.test, items: [], danger: g.label === 'Danger' }; });
      var other = { label: 'More', test: null, items: [], danger: false };
      btns.forEach(function(b){
        var txt = (b.textContent || '').trim();
        if(!txt){ other.items.push(b); return; }
        for(var i = 0; i < buckets.length; i++){
          // Every row leads with its own glyph ('▶ Play now', '🗑 Delete from
          // library'), so the group a row belongs to is decided on the WORDS -
          // otherwise '^play' never matches a real row and everything lands in
          // one bucket.
          if(buckets[i].test.test(txt.replace(/^[^\p{L}\p{N}]+/u, ''))){ buckets[i].items.push(b); return; }
        }
        other.items.push(b);
      });
      var all = buckets.concat([other]);
      host.innerHTML = '';
      host.classList.add('sc-grouped');
      all.forEach(function(g){
        if(!g.items.length) return;
        var sec = document.createElement('div');
        sec.className = 'sc-sheet-group' + (g.danger ? ' danger' : '');
        var lab = document.createElement('div');
        lab.className = 'sc-sheet-group-label';
        lab.textContent = g.label;
        sec.appendChild(lab);
        var box = document.createElement('div');
        box.className = 'sc-sheet-group-body';
        g.items.forEach(function(b){
          var txt = (b.textContent || '').trim();
          var m = txt.match(/^(\S{1,2})\s+(.*)$/u);
          var ico = '', label = txt;
          if(m && m[1].length <= 2 && !/^\w{2,}$/.test(m[1])){ ico = m[1]; label = m[2]; }
          else if(m){ ico = m[1]; label = m[2]; }
          if(ico){
            var ic = document.createElement('span');
            ic.className = 'sc-sheet-ico';
            ic.textContent = ico;
            b.textContent = label;
            b.insertBefore(ic, b.firstChild);
          }
          box.appendChild(b);
        });
        sec.appendChild(box);
        host.appendChild(sec);
      });
      if(extras.length){
        var playBody = host.querySelector('.sc-sheet-group-body');
        var target = playBody || host;
        var anchor = target.firstChild;
        extras.forEach(function(x){ target.insertBefore(x, anchor); });
      }
      return true;
    }catch(e){ return false; }
  };

  /* --------------------------------------------------------------------------
     14. BOOT
     -------------------------------------------------------------------------- */
  /* --------------------------------------------------------------------------
     11b. 71.4 - THE WORKING SONG, AND THE EDIT RACK
     -------------------------------------------------------------------------- */
  // Studio could only ever edit one thing: whatever happened to be playing. On a
  // fresh launch nothing is, so crop, the clip maker and the sampler each
  // answered "Play a song first" and the whole screen read as broken. Studio now
  // has a WORKING SONG of its own: it follows whatever is playing, a song you
  // pick takes over, and every tool that works on a file - crop, the clip maker,
  // the sampler, the edit rack, the re-encode list - runs off it.
  var studioPickId = null;
  (function(){
    try{ var v = lsGet('sidecut_studio_pick', null); if(v && typeof v === 'string') studioPickId = v; }catch(_ePickLoad){}
  })();
  function workTrack(){
    try{
      if(studioPickId){ var picked = trackById(studioPickId); if(picked) return picked; }
      var playing = currentTrack();
      if(playing) return playing;
      var all = allTracks();
      return all.length ? all[0] : null;
    }catch(_eWork){ return null; }
  }
  function pickSong(id){
    if(!id || !trackById(id)) return false;
    studioPickId = id;
    lsSet('sidecut_studio_pick', id);
    return true;
  }
  function playWorkTrack(){
    var t = workTrack();
    if(!t){ toast('Add a song to your library first.'); return false; }
    if(!call('__scPlayTrack', t.id)){ toast('This build could not start that song.'); return false; }
    toast('Playing "' + (t.name || 'this song') + '".');
    return true;
  }
  function openSongPickerSheet(){
    var all = allTracks();
    if(!all.length){ toast('Your library is empty - add some songs first.'); return; }
    var cur = workTrack();
    var rows = all.map(function(t){
      var on = !!(cur && t.id === cur.id);
      return '<button class="sc-pick' + (on ? ' on' : '') + '" data-pickid="' + esc(t.id) + '">' +
        '<span class="sc-art sm" style="' + (t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></span>' +
        '<span class="sc-pick-txt"><span class="sc-pick-name">' + esc(t.name || 'Untitled') + '</span>' +
        '<span class="sc-pick-sub">' + esc(t.artist || 'Unknown artist') + (t.duration ? ' \u00b7 ' + fmtTime(t.duration) : '') + '</span></span>' +
        (on ? '<span class="sc-pick-on">editing</span>' : '') + '</button>';
    }).join('');
    openSheet('Choose the song to edit',
      '<input type="text" id="scPickSearch" placeholder="Search your library\u2026" autocomplete="off" style="width:100%; box-sizing:border-box; background:var(--bg); border:1px solid var(--line); border-radius:10px; padding:10px 12px; color:var(--ink); font-size:13px; margin-bottom:10px;">' +
      '<div class="sc-picks" id="scPicks">' + rows + '</div>');
    var box = $('scPicks');
    var search = $('scPickSearch');
    if(search && box){
      search.addEventListener('input', function(){
        var q = String(search.value || '').toLowerCase().trim();
        Array.prototype.slice.call(box.querySelectorAll('.sc-pick')).forEach(function(b){
          var txt = String(b.textContent || '').toLowerCase();
          b.style.display = (!q || txt.indexOf(q) !== -1) ? '' : 'none';
        });
      });
    }
    if(box){
      Array.prototype.slice.call(box.querySelectorAll('.sc-pick')).forEach(function(b){
        b.addEventListener('click', function(){
          var id = b.getAttribute('data-pickid');
          if(!pickSong(id)){ toast('That song is no longer in the library.'); return; }
          closeSheet();
          var t = trackById(id);
          toast('Editing "' + ((t && t.name) || 'that song') + '".');
          renderStudio();
        });
      });
    }
  }

  /* ---- the edit rack ------------------------------------------------------- */
  // Real editing on a COPY. Every operation is plain sample math on the one
  // decoded buffer Studio already caches - no second decoder, no second encoder
  // - so the preview and the saved file are the same audio, and the song in the
  // library is never touched.
  var edit = {
    busy: false,
    silent: true,      // trim the silence off both ends
    fades: false,
    fadeIn: 1.5,
    fadeOut: 1.5,
    reverse: false,
    normalize: true,
    gainDb: 0,
    kbps: 256
  };
  function editSummary(){
    var bits = [];
    if(edit.silent) bits.push('trim silence');
    if(edit.fades) bits.push('fades');
    if(edit.reverse) bits.push('reverse');
    if(edit.normalize) bits.push('level match');
    if(edit.gainDb) bits.push((edit.gainDb > 0 ? '+' : '') + edit.gainDb + ' dB');
    return bits.length ? ('Will ' + bits.join(' \u00b7 ') + ' \u00b7 then save a copy') : 'Trim, fades, level, reverse \u2014 then save a copy.';
  }
  // Silence is measured against the song's OWN peak, so a quiet recording is not
  // read as all-silence and a loud one does not lose its opening breath.
  function editThreshold(buf){
    var peak = 0;
    for(var c = 0; c < buf.numberOfChannels; c++){
      var d = buf.getChannelData(c);
      for(var i = 0; i < d.length; i += 16){ var v = Math.abs(d[i]); if(v > peak) peak = v; }
    }
    return Math.max(0.0005, peak * 0.008);
  }
  function editRender(buf){
    if(!buf) return null;
    var ch = Math.max(1, buf.numberOfChannels);
    var c, i, n = buf.length;
    var chan = [];
    for(c = 0; c < ch; c++){
      var copy = new Float32Array(n);
      copy.set(buf.getChannelData(c));
      chan.push(copy);
    }
    if(edit.reverse){
      for(c = 0; c < ch; c++){
        var src = chan[c], rev = new Float32Array(n);
        for(i = 0; i < n; i++) rev[i] = src[n - 1 - i];
        chan[c] = rev;
      }
    }
    // 1. the silence off both ends. One threshold and one span for every channel,
    //    so a stereo pair keeps its alignment and the trim cannot unbalance it.
    if(edit.silent){
      var th = editThreshold(buf);
      var edge = function(step, from, to){
        for(var k = from; step > 0 ? k <= to : k >= to; k += step){
          for(var cc = 0; cc < ch; cc++){ if(Math.abs(chan[cc][k]) > th) return k; }
        }
        return -1;
      };
      var a = edge(1, 0, n - 1);
      var b = edge(-1, n - 1, 0);
      if(a !== -1 && b !== -1 && b > a){
        var pad = Math.round(buf.sampleRate * 0.06);
        var from2 = Math.max(0, a - pad);
        var to2 = Math.min(n, b + pad);
        for(c = 0; c < ch; c++) chan[c] = chan[c].subarray(from2, to2);
        n = to2 - from2;
      }
    }
    // 2. fades, on whatever is left.
    if(edit.fades){
      var fin = Math.max(0, Math.min(n, Math.round(edit.fadeIn * buf.sampleRate)));
      var fout = Math.max(0, Math.min(n, Math.round(edit.fadeOut * buf.sampleRate)));
      for(c = 0; c < ch; c++){
        var d2 = chan[c];
        for(i = 0; i < fin; i++) d2[i] *= i / fin;
        for(i = 0; i < fout; i++) d2[n - 1 - i] *= i / fout;
      }
    }
    // 3. the level. The chosen gain first, then (if asked) the peak pulled up to
    //    just under full scale - measured AFTER the gain, so the two controls
    //    cannot fight each other into clipping.
    var g = edit.gainDb ? Math.pow(10, edit.gainDb / 20) : 1;
    var peak2 = 0;
    for(c = 0; c < ch; c++){
      var d3 = chan[c];
      for(i = 0; i < n; i++){ var v2 = d3[i] * g; d3[i] = v2; var av = Math.abs(v2); if(av > peak2) peak2 = av; }
    }
    if(edit.normalize && peak2 > 0){
      var to = 0.98 / peak2;
      for(c = 0; c < ch; c++){
        var d4 = chan[c];
        for(i = 0; i < n; i++) d4[i] *= to;
      }
    }
    var cOut = ctx();
    if(!cOut) return null;
    var out = cOut.createBuffer(ch, Math.max(1, n), buf.sampleRate);
    for(c = 0; c < ch; c++){
      try{ out.copyToChannel(chan[c], c); }
      catch(_eCopy){
        var dst = out.getChannelData(c);
        for(i = 0; i < n; i++) dst[i] = chan[c][i];
      }
    }
    return out;
  }
  // 72.2 - the member tools need the SAME render with different settings. The
  // rack reads the one edit object, so its settings are swapped for the length
  // of a synchronous render and put back afterwards. editRender is pure sample
  // math with no await inside, so nothing can observe the swap, and whatever the
  // rack is set to is exactly what it is set to when the render is done.
  var EDIT_KEYS = ['silent', 'fades', 'fadeIn', 'fadeOut', 'reverse', 'normalize', 'gainDb'];
  function editRenderWith(buf, cfg){
    if(!cfg) return editRender(buf);
    var saved = {};
    for(var k = 0; k < EDIT_KEYS.length; k++){
      var key = EDIT_KEYS[k];
      saved[key] = edit[key];
      if(cfg[key] !== undefined) edit[key] = cfg[key];
    }
    try{ return editRender(buf); }
    finally{ for(var j = 0; j < EDIT_KEYS.length; j++) edit[EDIT_KEYS[j]] = saved[EDIT_KEYS[j]]; }
  }
  // 72.2 - one save path for a copy a tool makes: decode, render with the given
  // settings, encode at the given rate and save it beside the library file. The
  // song in the library is never the one this writes.
  function editedCopy(t, cfg, kbps, purpose){
    if(!t || !t.file) return Promise.reject(new Error('no audio file to edit'));
    return decoded(t).then(function(b){
      var out = editRenderWith(b, cfg);
      if(!out) throw new Error('the edit produced no audio');
      return tagMetaFor(t, (t.name || 'Edit') + ' (' + purpose + ')').then(function(meta){
        return window.__scEncodeMp3(out, kbps, meta).then(function(blob){
          if(!blob) throw new Error('the encoder produced no output');
          var base = (t.file && t.file.name ? t.file.name.replace(/\.[^/.]+$/, '') : (t.name || 'edit'));
          var fname = base + ' (' + purpose + ').mp3';
          return window.__scSaveClip(blob, fname).then(function(saved){ return { saved: saved, fname: fname }; });
        });
      });
    });
  }
  // 72.2 - one tap: trim the silence and match the level, saved as its own
  // tagged file. The rack's two safest operations, with the knobs already set,
  // so an uneven library can be fixed a song at a time without opening the rack.
  function cleanUpSong(){
    var t = workTrack();
    if(!t){ toast('Choose a song first.'); return; }
    if(!t.file){ toast('That song has no audio file to clean up.'); return; }
    bump('studio'); markFeature('studio');
    toast('Cleaning up "' + (t.name || 'this song') + '"\u2026');
    editedCopy(t, { silent: true, fades: false, reverse: false, normalize: true, gainDb: 0 }, 192, 'clean').then(function(r){
      toast(r && r.saved ? ('Cleaned up \u00b7 ' + r.fname) : ('Clean copy ready \u00b7 ' + ((r && r.fname) || 'the copy')), 4800);
    }).catch(function(e){
      toast('The clean-up failed: ' + ((e && e.message) || 'could not finish'), 5200);
    });
  }
  // 72.2 - the batch. One song at a time, in the order they were ticked, with a
  // line naming the one it is on. A song that cannot finish is recorded and the
  // run carries on, so one bad file cannot strand the rest of the selection.
  var batchRun = { mode: '', busy: false, i: 0, n: 0, fails: [], saved: 0, log: '' };
  function batchProgressHtml(){
    if(batchRun.busy) return '<div class="sc-layer-hint" id="scBatchLine">' + esc(batchRun.log || 'Working\u2026') + '</div>';
    if(batchRun.n && batchRun.i >= batchRun.n){
      var doneN = batchRun.n - batchRun.fails.length;
      return '<div class="sc-note" id="scBatchDone">Finished: ' + doneN + ' of ' + batchRun.n + (batchRun.mode === 'reen' ? ' re-encoded' : ' edited') + (batchRun.saved ? ' \u00b7 ' + fmtBytes(batchRun.saved) + ' smaller' : '') + (batchRun.fails.length ? ' \u00b7 ' + batchRun.fails.length + ' could not finish' : '') + '.</div>';
    }
    return '';
  }
  function runBatch(mode){
    var ids = (call('__scSelectedIds') || []).slice();
    var songs = ids.map(trackById).filter(function(t){ return t && t.file; });
    if(!songs.length){ toast('Tick the songs you want in Library first.'); return; }
    if(batchRun.busy) return;
    batchRun = { mode: mode, busy: true, i: 0, n: songs.length, fails: [], saved: 0, log: '' };
    renderStudio();
    var cfg = { silent: edit.silent, fades: edit.fades, fadeIn: edit.fadeIn, fadeOut: edit.fadeOut, reverse: edit.reverse, normalize: edit.normalize, gainDb: edit.gainDb };
    var kbps = reenKbps;
    var step = function(){
      if(batchRun.i >= batchRun.n){
        batchRun.busy = false;
        renderStudio();
        var doneN = batchRun.n - batchRun.fails.length;
        toast((mode === 'reen' ? 'Re-encoded ' : 'Edited ') + doneN + ' of ' + batchRun.n + (batchRun.saved ? ' \u00b7 ' + fmtBytes(batchRun.saved) + ' back' : '') + (batchRun.fails.length ? ' \u00b7 ' + batchRun.fails.length + ' could not finish' : ''), 5200);
        return;
      }
      var t = songs[batchRun.i];
      batchRun.log = (mode === 'reen' ? 'Re-encoding ' : 'Editing ') + (batchRun.i + 1) + ' of ' + batchRun.n + ' \u00b7 ' + (t.name || 'song');
      renderStudio();
      var work = (mode === 'reen')
        ? reencodeOne(t, kbps).then(function(saved){ batchRun.saved += saved; })
        : editedCopy(t, cfg, kbps, 'edit').then(function(){ });
      work.catch(function(){ batchRun.fails.push(t.id); }).then(function(){ batchRun.i++; step(); });
    };
    step();
  }
  var editSrcNode = null;
  function editPreview(){
    var t = workTrack();
    if(!t){ toast('Choose a song first.'); return; }
    if(!ctx()){ toast('This device has no audio engine to preview with.'); return; }
    decoded(t).then(function(b){
      var out = editRender(b);
      if(!out){ toast('Could not build the edit.'); return; }
      try{ if(editSrcNode) editSrcNode.stop(); }catch(_eStop){}
      try{
        var node = ctx().createBufferSource();
        node.buffer = out;
        node.connect(ctx().destination);
        node.start(0);
        editSrcNode = node;
        toast('Previewing ' + secToClock(out.duration) + ' of the edit\u2026');
      }catch(e){ toast('Could not preview: ' + ((e && e.message) || 'no audio output')); }
    }, function(e){ toast('Could not read that song: ' + ((e && e.message) || 'decode failed')); });
  }
  function editExport(){
    var t = workTrack();
    if(!t){ toast('Choose a song first.'); return; }
    if(!t.file){ toast('That song has no audio file to edit.'); return; }
    if(edit.busy) return;
    edit.busy = true;
    var btn = $('scEditSave');
    if(btn){ btn.disabled = true; btn.textContent = 'Working\u2026'; }
    var done = function(msg, ms){
      edit.busy = false;
      if(btn){ btn.disabled = false; btn.textContent = 'Save a copy'; }
      if(msg) toast(msg, ms || 4400);
    };
    var base = (t.file && t.file.name ? t.file.name.replace(/\.[^/.]+$/, '') : (t.name || 'edit'));
    var fname = base + ' (edit).mp3';
    decoded(t).then(function(b){
      var out = editRender(b);
      if(!out) throw new Error('the edit produced no audio');
      return tagMetaFor(t, (t.name || 'Edit') + ' (edit)').then(function(meta){
        return window.__scEncodeMp3(out, edit.kbps, meta).then(function(blob){
          if(!blob) throw new Error('the encoder produced no output');
          return window.__scSaveClip(blob, fname).then(function(saved){
            closeSheet();
            bump('studio'); markFeature('studio');
            done(saved ? 'Edit saved \u00b7 ' + fname : 'Edit ready \u00b7 ' + fname, 4800);
          });
        });
      });
    }).catch(function(e){ done('The edit failed: ' + ((e && e.message) || 'could not finish'), 5200); });
  }
  function editSheetHtml(){
    var t = workTrack();
    var dur = (t && t.duration) ? secToClock(t.duration) : '';
    var chip = function(on, act, label){
      return '<button class="sc-chip' + (on ? ' on' : '') + '" data-edit="' + act + '">' + label + '</button>';
    };
    var fader = function(id, label, val){
      return '<div class="sc-slider"><label>' + label + ' <span id="' + id + 'V">' + Number(val).toFixed(1) + 's</span></label>' +
        '<input type="range" id="' + id + '" min="0" max="6" step="0.5" value="' + val + '"></div>';
    };
    return '<div class="sc-songline"><div class="sc-art" style="' + (t && t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
      '<div><div class="sc-songname">' + esc(t ? (t.name || 'Untitled') : 'No song') + '</div>' +
      '<div class="sc-songsub">' + esc(t ? (t.artist || 'Unknown artist') : '') + (dur ? ' \u00b7 ' + dur : '') + '</div></div></div>' +
      '<div class="sc-note">Every change is made on a copy. Your song in the library is never overwritten \u2014 the edit saves as its own tagged file.</div>' +
      '<div class="sc-chips">' +
        chip(edit.silent, 'silent', 'Trim silence') +
        chip(edit.fades, 'fades', 'Fades') +
        chip(edit.reverse, 'reverse', 'Reverse') +
        chip(edit.normalize, 'normalize', 'Level match') +
      '</div>' +
      (edit.fades ? (fader('scEditFadeIn', 'Fade in', edit.fadeIn) + fader('scEditFadeOut', 'Fade out', edit.fadeOut)) : '') +
      '<div class="sc-chips"><span class="sc-chip-label">Level</span>' +
        [['-6', '\u22126 dB'], ['-3', '\u22123 dB'], ['0', '0 dB'], ['3', '+3 dB'], ['6', '+6 dB'], ['9', '+9 dB']].map(function(pair){
          return '<button class="sc-chip' + (String(edit.gainDb) === pair[0] ? ' on' : '') + '" data-editgain="' + pair[0] + '">' + pair[1] + '</button>';
        }).join('') +
      '</div>' +
      '<div class="sc-chips"><span class="sc-chip-label">Save at</span>' +
        [128, 192, 256, 320].map(function(k){
          return '<button class="sc-chip' + (edit.kbps === k ? ' on' : '') + '" data-editkbps="' + k + '">' + k + '</button>';
        }).join('') +
      '</div>' +
      '<div class="sc-layer-hint">' + esc(editSummary()) + '</div>' +
      '<div class="sc-actions"><button class="sc-btn" id="scEditPreview">Preview</button><button class="sc-btn primary" id="scEditSave">Save a copy</button></div>';
  }
  function openEditSheet(){
    var t = workTrack();
    if(!t){ toast('Add a song to your library first, then open the edit rack.'); return; }
    bump('studio');
    markFeature('studio');
    openSheet('Edit rack', editSheetHtml());
    var chipWire = function(sel, fn){
      Array.prototype.slice.call(document.querySelectorAll('#scSheetBody ' + sel)).forEach(function(b){
        b.addEventListener('click', function(){ fn(b); openEditSheet(); });
      });
    };
    chipWire('[data-edit]', function(b){
      var what = b.getAttribute('data-edit');
      if(what === 'silent') edit.silent = !edit.silent;
      else if(what === 'reverse') edit.reverse = !edit.reverse;
      else if(what === 'fades') edit.fades = !edit.fades;
      else if(what === 'normalize') edit.normalize = !edit.normalize;
    });
    chipWire('[data-editgain]', function(b){ edit.gainDb = parseFloat(b.getAttribute('data-editgain')) || 0; });
    chipWire('[data-editkbps]', function(b){ edit.kbps = parseInt(b.getAttribute('data-editkbps'), 10) || 256; });
    var fi = $('scEditFadeIn');
    if(fi) fi.addEventListener('input', function(){
      edit.fadeIn = parseFloat(fi.value) || 0;
      var v = $('scEditFadeInV'); if(v) v.textContent = edit.fadeIn.toFixed(1) + 's';
    });
    var fo = $('scEditFadeOut');
    if(fo) fo.addEventListener('input', function(){
      edit.fadeOut = parseFloat(fo.value) || 0;
      var v = $('scEditFadeOutV'); if(v) v.textContent = edit.fadeOut.toFixed(1) + 's';
    });
    var pv = $('scEditPreview');
    if(pv) pv.addEventListener('click', editPreview);
    var sv = $('scEditSave');
    if(sv) sv.addEventListener('click', editExport);
  }

  function buildStudioView(){
    if($('studioView')) return;
    var host = document.createElement('div');
    host.id = 'studioView';
    var anchor = $('nowPlaying');
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
    else document.body.appendChild(host);
  }
  // ---- what the badges count -----------------------------------------------
  // The app's own controls that the wall counts, in one table: a badge that names
  // a counter here is a badge wired to a button that exists, and the gate checks
  // every selector in this list against the page.
  var FEATURE_CLICKS = [
    ['#lyricsBtn', 'lyrics'],
    ['#shuffleBtn', 'shuffle'],
    ['#repeatBtn', 'repeat'],
    ['#tapTempoBtn', 'tapTempo'],
    ['#djModeBtn', 'djmode'],
    ['#djCueBtn', 'djCue'],
    ['#djSyncBtn', 'djSync'],
    ['#djLoopBtn', 'djLoop'],
    ['#djRecordBtn', 'djRecord'],
    ['#beatRepeatLockBtn', 'beatRepeat'],
    ['#tapeStopBtn', 'tapeStop'],
    ['#spinbackBtn', 'spinback'],
    ['#customThemeSave', 'customTheme'],
    ['#homeBtn', 'homeTab'],
    ['#libraryBtn', 'libraryTab'],
    ['.home-bubble', 'bubble']
  ];
  // One delegated listener for the controls the app owns: the theme buttons, the
  // add-songs menu's own export/import entries, the bell, and the table above.
  // Counting here rather than inside the app keeps the release to one file, and it
  // cannot drift from the button it counts, because it IS the button.
  function wireAppWatch(){
    if(document.__scWatch) return;
    document.__scWatch = true;
    document.addEventListener('click', function(e){
      var el = e.target;
      if(!el || !el.closest) return;
      var th = el.closest('[data-theme-key]');
      if(th){
        var key = th.getAttribute('data-theme-key');
        if(key){ noteTheme(key); bump('themeChange'); }
      }
      if(el.closest('#exportLibBtn')) bump('exportAll', 1);
      if(el.closest('#exportSongsBtn')) bump('exportSongs', 1);
      if(el.closest('#importLibBtn')) bump('importLib', 1);
      // Lining a song up to play next from the song menu. Nothing here is a share
      // or an export - the badge this feeds says so.
      var _ql = (el.textContent || '').trim().replace(/^[^\p{L}\p{N}]+/u, '');
      if(_ql === 'Play next' || _ql === 'Add to queue' || _ql === 'Queue') bump('queue', 1);
      if(el.closest('#addBtn') || el.closest('#addFolderBtn')) bump('addFiles', 1);
      if(el.closest('#notifBtn')) bump('notif', 1);
      for(var fi = 0; fi < FEATURE_CLICKS.length; fi++){
        if(el.closest(FEATURE_CLICKS[fi][0])){ bump(FEATURE_CLICKS[fi][1], 1); break; }
      }
      // Opening Studio is when the wall has to be right: tapping a dock tab is
      // not a visibility change, so nothing else would redraw a grid that was
      // last painted before any of this was earned.
      if(el.closest('#studioBtn')) setTimeout(function(){ renderStudio(); }, 80);
      // Those controls all move badges, so the check runs on the next turn of the
      // loop rather than inside the click that caused it.
      setTimeout(function(){ checkAchievements(true); }, 60);
    }, true);
    // Typing in the Library search box is the one local action the click listener
    // above cannot see, so it gets a listener of its own.
    document.addEventListener('input', function(e){
      var el = e.target;
      if(el && el.closest && el.closest('#searchInput')){
        bump('search', 1);
        setTimeout(function(){ checkAchievements(true); }, 60);
      }
    }, true);
  }

  // ---- Vortex: the 200-badge theme, spun by the finger ----------------------
  // The drag angle around the middle of the screen is added to a rotation, and the
  // angle's own speed is kept as momentum, so a flick keeps it turning and it
  // eases to a stop. Transform only - nothing here repaints the backdrop.
  var whirl = { deg: 0, vel: 0, lastA: null, raf: 0, dragging: false };
  function whirlThemeOn(){
    try{ return document.body.classList.contains('theme-dyn-vortex'); }catch(e){ return false; }
  }
  function whirlPaint(){
    try{ document.documentElement.style.setProperty('--whirl-deg', whirl.deg.toFixed(2) + 'deg'); }catch(e){}
  }
  function whirlSpin(){
    if(whirl.dragging) return;
    if(Math.abs(whirl.vel) < 0.02){ whirl.vel = 0; return; }
    whirl.deg += whirl.vel;
    whirl.vel *= 0.965;
    whirlPaint();
    whirl.raf = requestAnimationFrame(whirlSpin);
  }
  function whirlAngle(e){
    try{
      var cx = window.innerWidth / 2, cy = window.innerHeight / 2;
      var x = (e.clientX || 0) - cx, y = (e.clientY || 0) - cy;
      return Math.atan2(y, x) * 180 / Math.PI;
    }catch(err){ return 0; }
  }
  function wireWhirl(){
    if(document.__scWhirl) return;
    document.__scWhirl = true;
    var down = function(e){
      if(!whirlThemeOn()) return;
      // Never steal a drag from the player's own controls or from a sheet.
      if(e.target && e.target.closest && e.target.closest('#nowPlaying, input, .sc-sheet, .sc-slider')) return;
      whirl.dragging = true;
      whirl.lastA = whirlAngle(e);
      whirl.vel = 0;
    };
    var move = function(e){
      if(!whirl.dragging || !whirlThemeOn()) return;
      var a = whirlAngle(e);
      var d = a - whirl.lastA;
      if(d > 180) d -= 360;
      if(d < -180) d += 360;
      whirl.deg += d;
      whirl.vel = d;      // the last frame's angle IS the speed it is flung at
      whirl.lastA = a;
      whirlPaint();
    };
    var up = function(){
      if(!whirl.dragging) return;
      whirl.dragging = false;
      bump('whirl'); // one turn of the Vortex backdrop is one drag, not one frame
      whirl.raf = requestAnimationFrame(whirlSpin);
    };
    window.addEventListener('pointerdown', down, { passive: true });
    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerup', up, { passive: true });
    window.addEventListener('pointercancel', up, { passive: true });
  }
  function spinWhirl(deg){
    whirl.deg = deg || 0;
    whirl.vel = 0;
    whirlPaint();
  }

  /* --------------------------------------------------------------------------
     13c. HOW TALL IS THE DOCK, REALLY
     -------------------------------------------------------------------------- */
  // The player is `bottom: calc(--sc-dock-h + env(safe-area-inset-bottom))`, and
  // --sc-dock-h is a written-down 56px. That is the right number for a phone with
  // no bottom inset and the wrong one nearly everywhere else - the >=768 width
  // breakpoint raises the pill to 44px, an unfolded foldable reports a bottom inset
  // no phone has, the sandbox compact bar changes it again - so on those devices the
  // player floats above the dock and the difference is a strip of nothing between
  // the seek row and the dock. This measures the dock that is actually on the screen
  // and hands the player that number, so its bottom edge lands where the dock begins
  // on any device, at any width, at any inset. One getBoundingClientRect; nothing is
  // written unless the measurement is a believable dock.
  var DOCK_MIN = 30, DOCK_MAX = 300;
  function measureDock(){
    try{
      var strip = document.querySelector('.action-strip');
      var root = document.documentElement;
      if(!strip || !root) return false;
      var h = Math.round(strip.getBoundingClientRect().height || 0);
      // Hidden, not laid out, or four hundred pixels tall: not a dock. The
      // measurement is dropped and the stylesheet own arithmetic takes over.
      if(!h || h < DOCK_MIN || h > DOCK_MAX){
        root.classList.remove('sc-dock-measured');
        return false;
      }
      root.style.setProperty('--sc-dock-real', h + 'px');
      root.classList.add('sc-dock-measured');
      return true;
    }catch(e){ return false; }
  }
  function watchDock(){
    measureDock();
    try{
      var strip = document.querySelector('.action-strip');
      if(window.ResizeObserver && strip) new ResizeObserver(measureDock).observe(strip);
    }catch(_eRo){}
    window.addEventListener('resize', measureDock);
    window.addEventListener('orientationchange', measureDock);
    // The first paint is not trustworthy - the fonts, the theme and the dock own
    // transition all settle after it - so it is measured again once the page has.
    setTimeout(measureDock, 250);
    setTimeout(measureDock, 1500);
  }

  function boot(){
    buildStudioView();
    applyFx();
    applyRate();
    wireSwipe();
    watchDock();
    wireAppWatch();
    wireWhirl();
    wireDoorGesture();
    renderStudio();
    checkAchievements(true);
    // Someone already past a reward - an update, or a restore - is synced here
    // rather than left with a reward row that says Granted and nothing granted.
    grantRewards(true);
    // A play can happen before this block loads, so re-apply once the graph is
    // definitely up. Nothing else here is time-sensitive.
    setTimeout(function(){ applyFx(); applyRate(); if(bpmCache) paintBpmNote(); }, 1200);
    // Badges are checked after a play, which is when every counter moves.
    document.addEventListener('visibilitychange', function(){
      if(!document.hidden){ checkAchievements(); renderStudio(); }
    });
    var els = call('__scAudios') || [];
    els.forEach(function(el){
      if(el && !el.__sc70Bound){
        el.__sc70Bound = true;
        el.addEventListener('play', function(){ setTimeout(function(){ checkAchievements(); }, 400); });
      }
    });
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  // The app applies a theme from its own tab as well as from ours, and the
  // "wore N dynamic themes" badges count either way - so the app reports
  // every change through here.
  window.__scNoteTheme = noteTheme;

  // The module's own surface, for the gates and for the assistant.
  window.SC70 = {
    version: VERSION,
    fx: fxState,
    applyFx: applyFx,
    applyRate: applyRate,
    setFx: setFx,
    presets: PRESETS,
    pads: sampler,
    playPad: playPad,
    capturePad: capturePad,
    loadSamplerFor: loadSamplerFor,
    looper: looper,
    recordLoop: recordLoop,
    stopLoops: stopLoops,
    // 70.1.2 - the new half of Studio, for the gates and the assistant.
    sleep: function(){ return sleep; },
    setSleep: setSleep,
    sleepLabel: sleepLabel,
    practice: practice,
    practiceMark: practiceMark,
    practiceRun: practiceRun,
    practiceStop: practiceStop,
    openPracticeSheet: openPracticeSheet,
    myPresets: function(){ return myPresets; },
    saveMyPreset: saveMyPreset,
    useMyPreset: useMyPreset,
    dropMyPreset: dropMyPreset,
    measureDock: measureDock,
    watchDock: watchDock,
    cropCurrent: cropCurrent,
    loadApkDownloads: loadApkDownloads,
    apkRows: function(){ return apk.rows; },
    openClipSheet: openClipSheet,
    exportClip: exportClip,
    clip: clip,
    decoded: decoded,
    sliceBuf: sliceBuf,
    detectBpm: detectBpm,
    bpmFor: bpmFor,
    autodj: autodj,
    setAutoDj: setAutoDj,
    gestures: gestures,
    enableShake: enableShake,
    achievements: ACHIEVEMENTS,
    checkAchievements: checkAchievements,
    unlockedCount: unlockedCount,
    rewards: rewardState,
    rewardEarned: rewardEarned,
    themeUnlocked: themeUnlocked,
    rewardFor: function(key){
      var r = REWARDS.filter(function(x){ return x.key === key; })[0];
      if(!r) return null;
      return { at: r.at, key: r.key, name: r.name, kind: r.kind, earned: rewardEarned(r.at), have: unlockedCount() };
    },
    doorOpen: function(){ return doorOpen; },
    setDoorOpen: setDoorOpen,
    // The wall itself, for the gates: every entry, with the signal it reads and
    // the number it asks for, so a release can prove all 150 keys resolve.
    wall: function(){ return WALL.map(function(e){ return { group: e.g, name: e.n, key: e.k, want: e.w }; }); },
    bump: bump,
    counters: function(){ return counters; },
    spinWhirl: spinWhirl,
    spin: function(){ return whirl.deg; },
    flags: function(){ return flags; },
    markFeature: markFeature,
    biggestSongs: biggestSongs,
    reencodeTrack: reencodeTrack,
    undoReencode: undoReencode,
    openBatchTags: openBatchTags,
    runBatchTags: runBatchTags,
    openSheet: openSheet,
    closeSheet: closeSheet,
    renderStudio: renderStudio,
    openTool: openTool,
    // 71.4 - the working song and the edit rack.
    workTrack: workTrack,
    pickSong: pickSong,
    openSongPickerSheet: openSongPickerSheet,
    playWorkTrack: playWorkTrack,
    openEditSheet: openEditSheet,
    editRender: editRender,
    editExport: editExport,
    editPreview: editPreview,
    editOps: function(){ return edit; },
    editSummary: editSummary,
    stats: stats,
    setTarget: function(k){ reenKbps = k; renderStudio(); },
    target: function(){ return reenKbps; }
  };
})();