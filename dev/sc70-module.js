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
    dev: 'sidecut_devmode',
    padsSeen: 'sidecut_pads_seen',
    themes: 'sidecut_themes_used',
    reward: 'sidecut_reward_premium',
    sim: 'sidecut_dev_sim'
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
    var t = currentTrack();
    if(!t){ toast('Play a song first, then crop it.'); return false; }
    if(!t.file){ toast('This song has no audio file to crop.'); return false; }
    if(!call('__scCropSong', t.id)){ toast('The cropper is not available in this build.'); return false; }
    bump('studio');
    return true;
  }
  function openClipSheet(preStart, preEnd){
    var t = currentTrack();
    if(!t){ toast('Play a song first.'); return false; }
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
    document.querySelectorAll('[data-clipnudge]').forEach(function(b){
      b.addEventListener('click', function(){
        var d = parseFloat(b.getAttribute('data-clipnudge'));
        clip.end = Math.max(clip.start + 0.5, Math.min(clip.dur, clip.end + d));
        var f = $('scClipTo'); if(f) f.value = secToClock(clip.end);
        paintClipSel();
      });
    });
    var wh = document.querySelector('[data-cliptrue]');
    if(wh) wh.addEventListener('click', function(){
      clip.start = 0; clip.end = clip.dur;
      var f = $('scClipFrom'); if(f) f.value = '0:00';
      var t2 = $('scClipTo'); if(t2) t2.value = secToClock(clip.dur);
      paintClipSel();
    });
    var ring = document.querySelector('[data-clipring]');
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
  function reencodeTrack(id, kbps, btn){
    var t = trackById(id);
    if(!t || !t.file){ toast('That song has no audio file to re-encode.'); return; }
    var before = t.file.size || 0;
    if(btn){ btn.disabled = true; btn.textContent = 'Encoding\u2026'; }
    decoded(t).then(function(b){
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
          renderStudio();
          var saved = Math.max(0, oldSize - newFile.size);
          bump('savedBytes', saved);
          toastWithUndo('Re-encoded "' + (t.name || 'song') + '" at ' + kbps + ' kbps \u2014 ' + fmtBytes(saved) + ' smaller', function(){ undoReencode(id); });
        });
      });
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
  function BASE_ACHIEVEMENTS(){
    var s = stats();
    var plays = s.plays || 0, secs = s.listenSeconds || 0, lib = s.library || 0;
    var hours = secs / 3600;
    var playsTracks = (allTracks().filter(function(t){ return (t.playCount || 0) > 0 }).length);
    var artists = {};
    allTracks().forEach(function(t){ if(t.artist) artists[String(t.artist).toLowerCase()] = 1; });
    var artistCount = Object.keys(artists).length;
    var top = allTracks().slice().sort(function(a, b){ return (b.playCount || 0) - (a.playCount || 0) })[0];
    var nights = (s.nightPlays || 0);
    function p(n, target){ return { got: Math.min(n || 0, target), want: target }; }
    return [
      { id: 'first_play', name: 'First spin', sub: 'Play one song', ico: '\u25b6', tone: 'a', need: p(plays, 1) },
      { id: 'plays_100', name: 'Hundred club', sub: '100 songs played', ico: '\u266b', tone: 'a', need: p(plays, 100) },
      { id: 'plays_1000', name: 'Thousand club', sub: '1,000 songs played', ico: '\u266b', tone: 'b', need: p(plays, 1000) },
      // 5,000 plays was the one hand-written target that only a multi-year library
      // could ever meet, and every badge is needed for the Premium reward - so it
      // is 3,000 now, which a year of daily listening reaches.
      { id: 'plays_3000', name: 'Three thousand', sub: '3,000 songs played', ico: '\u266b', tone: 'c', need: p(plays, 3000) },
      { id: 'hour_1', name: 'One hour in', sub: '1 hour listened', ico: '\u23f1', tone: 'a', need: p(hours, 1) },
      { id: 'hour_10', name: 'Ten hours', sub: '10 hours listened', ico: '\u23f1', tone: 'a', need: p(hours, 10) },
      { id: 'hour_100', name: 'Century of sound', sub: '100 hours listened', ico: '\ud83c\udfc6', tone: 'c', need: p(hours, 100) },
      { id: 'streak_3', name: 'Three in a row', sub: '3-day listening streak', ico: '\ud83d\udd25', tone: 'a', need: p(s.streak, 3) },
      { id: 'streak_7', name: 'Seven-day streak', sub: '7 days in a row', ico: '\ud83d\udd25', tone: 'b', need: p(s.streak, 7) },
      { id: 'streak_30', name: 'A month of days', sub: '30-day streak', ico: '\ud83d\udd25', tone: 'c', need: p(s.streak, 30) },
      { id: 'streak_best_14', name: 'Personal best', sub: 'Best streak of 14 days', ico: '\u2b50', tone: 'b', need: p(s.longest, 14) },
      { id: 'lib_100', name: 'Shelved 100', sub: '100 songs in the library', ico: '\u2630', tone: 'a', need: p(lib, 100) },
      { id: 'lib_500', name: 'Shelved 500', sub: '500 songs in the library', ico: '\u2630', tone: 'b', need: p(lib, 500) },
      { id: 'artists_25', name: 'Wide taste', sub: '25 different artists', ico: '\ud83c\udfa4', tone: 'a', need: p(artistCount, 25) },
      { id: 'played_50_songs', name: 'Not a one-hit wonder', sub: '50 different songs played', ico: '\u266b', tone: 'b', need: p(playsTracks, 50) },
      { id: 'one_song_10', name: 'On repeat', sub: 'One song played 10 times', ico: '\ud83d\udd01', tone: 'a', need: p(top ? top.playCount : 0, 10) },
      { id: 'one_song_30', name: 'Obsessed', sub: 'One song played 30 times', ico: '\ud83d\udd01', tone: 'b', need: p(top ? top.playCount : 0, 30) },
      { id: 'night_owl', name: 'Late-night listening', sub: 'Play something after 1 AM', ico: '\ud83c\udf19', tone: 'a', need: p(nights, 1) },
      { id: 'studio_first', name: 'Into the studio', sub: 'Open Studio and use a tool', ico: '\ud83c\udfa7', tone: 'a', need: p(flags.studio ? 1 : 0, 1) },
      { id: 'slow_wet', name: 'Slowed and wet', sub: 'Use slowed + reverb', ico: '\ud83c\udf0a', tone: 'a', need: p(flags.slow ? 1 : 0, 1) },
      { id: 'karaoke_1', name: 'Take the mic', sub: 'Use karaoke mode', ico: '\ud83c\udfa4', tone: 'a', need: p(flags.karaoke ? 1 : 0, 1) },
      { id: 'sampler_1', name: 'Pad one', sub: 'Play a sampler pad', ico: '\ud83c\udf9b', tone: 'a', need: p(flags.sampler ? 1 : 0, 1) },
      { id: 'looper_1', name: 'Loop it', sub: 'Record a loop', ico: '\ud83d\udd01', tone: 'a', need: p(flags.looper ? 1 : 0, 1) },
      { id: 'clip_1', name: 'Clip artist', sub: 'Export a clip', ico: '\u2702', tone: 'a', need: p(flags.clip ? 1 : 0, 1) },
      { id: 'assistant_1', name: 'Asked and done', sub: 'Have the assistant do something', ico: '\u2728', tone: 'a', need: p(flags.assistant ? 1 : 0, 1) },
      { id: 'autodj_1', name: 'Blended', sub: 'Hear a beat-matched crossfade', ico: '\ud83c\udf9a', tone: 'a', need: p(flags.autodj ? 1 : 0, 1) },
      { id: 'all_tools', name: 'Every tool', sub: 'Use all five Studio tools', ico: '\ud83d\udee0', tone: 'c', need: p(['slow', 'karaoke', 'sampler', 'looper', 'clip'].filter(function(k){ return flags[k]; }).length, 5) }
    ];
  }
  /* --------------------------------------------------------------------------
     5b. TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS (70.0.5, revised 70.0.6)

     The user asked for over two hundred achievements, one of them secret and only
     obtainable by entering dev mode, plus a free theme at 50, 100 and 150 badges,
     a dynamic theme that whirls under your finger at 200, and free Premium at 201
     with the secret one.

     Three design decisions worth writing down:

       * Every badge on the wall is REACHABLE by using the app normally, and none
         of them asks for a song to be shared, exported or uploaded. Three things
         had to change for that to be true: the album tiers read a stat the app
         always reported as zero (so all seven were impossible), the "Blended"
         badge asked for a flag nothing ever set, and two tiers counted the two
         export buttons. The album stat is real now, Auto-DJ sets its own flag, and
         those two slots count a search and a queued song instead - both local. The
         generated thresholds were also pulled down from their originals (2,000
         songs, 4,000 plays, 365 days, 200 hours, 500 artists) to ceilings a year of
         real listening reaches, and every table is asserted to stay under them.

       * The 30 badges 70.0 shipped are kept as they were written (nicer
         names, hand-written subs) and the rest are GENERATED from threshold tables.
         A hundred and seventy hand-written tiles would be a transcription exercise
         with a hundred and seventy chances to typo a number; tables are exact and
         the count is asserted by the gate instead of trusted.

       * NOTHING ON THE WALL CHANGES A SONG YOU ALREADY HAVE (70.0.6). The wall used
         to reward the three in-place editors - re-encoding a song smaller, running
         the batch tag editor, and cropping a song - plus the nine generated tiers
         that counted them (songs re-encoded, batch tag runs, songs retagged, and
         the megabytes won back). All fourteen tiles are gone, including the three
         hand-written ones (Trimmed, Naming things, Space saver). The tools still
         exist and still work, each with its own undo; they are simply not
         achievements, so finishing the wall never costs anybody a file. The
         capstone stopped counting them too (FEATURE_KEYS is nine, not twelve). The
         fourteen tiles came back as more rungs on things you DO - more plays, more
         hours listened, a longer streak, more Studio visits, more loops, more
         theme changes and more things done by the assistant - so the wall is still
         201 and the five rewards still sit at 50, 100, 150, 200 and 201.
       * The themes are gated LIVE - the app asks whether the badge count has reached
         the reward, every time it draws the Theme tab - so there is nothing to
         unlock, nothing to lose on a reinstall that keeps badges, and no state that
         can disagree with the badges themselves. Premium is the one reward with a
         side effect, so that one is granted once and recorded.
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

  // ---- dev mode ------------------------------------------------------------
  // Seven taps on the version label in Settings - a control everyone can see and
  // nobody taps twice. It sets the app's own hidden test flag too, so the app's
  // dev affordances light up with ours.
  var devOn = !!lsGet(LS.dev, null);
  function devMode(){ return devOn; }
  function setDevMode(on){
    devOn = !!on;
    lsSet(LS.dev, devOn ? { at: Date.now() } : null);
    try{
      if(devOn) localStorage.setItem('sidecut_testMode', '1');
      else localStorage.removeItem('sidecut_testMode');
    }catch(e){}
    try{ document.body.classList.toggle('sc-dev-on', devOn); }catch(e){}
    if(devOn){
      toast('\ud83d\udd27 Dev mode on \u00b7 the hidden badge is on the grid now.', 4200);
      checkAchievements();
    } else {
      toast('Dev mode off.');
    }
    renderStudio();
  }
  function wireDevGesture(){
    var el = $('currentVersionLabel');
    if(!el || el.__scDevTaps !== undefined) return;
    el.__scDevTaps = 0;
    el.style.cursor = 'pointer';
    el.addEventListener('click', function(){
      el.__scDevTaps++;
      clearTimeout(el.__scDevTimer);
      el.__scDevTimer = setTimeout(function(){ el.__scDevTaps = 0; }, 1600);
      var left = 7 - el.__scDevTaps;
      if(left > 0 && left <= 3) toast(left + ' more\u2026', 900);
      if(el.__scDevTaps >= 7){ el.__scDevTaps = 0; setDevMode(!devOn); }
    });
  }

  // ---- the five rewards ----------------------------------------------------
  var REWARDS = [
    { at: 50,  kind: 'theme',   key: 'cinder',  name: 'Cinder',  note: 'Six metallic palettes in one' },
    { at: 100, kind: 'theme',   key: 'quartz',  name: 'Quartz',  note: 'Cool glass and silver' },
    { at: 150, kind: 'theme',   key: 'lumen',   name: 'Lumen',   note: 'Daylight green and mint' },
    { at: 200, kind: 'theme',   key: 'vortex',  name: 'Vortex',  note: 'A dynamic theme that whirls under your finger', dynamic: true },
    { at: 201, kind: 'premium', key: 'premium', name: 'SideCut Premium', note: 'Every badge in the app, including the secret one' }
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
  // the moment the badges are there, for everyone, with or without Premium.
  function themeUnlocked(key){
    for(var i = 0; i < REWARDS.length; i++){
      if(REWARDS[i].kind === 'theme' && REWARDS[i].key === key) return rewardEarned(REWARDS[i].at);
    }
    return true;
  }
  function grantRewards(silent){
    if(!rewardEarned(201)) return false;
    if(lsGet(LS.reward, null)) return false;
    var ok = call('__scGrantPremium', { plan: 'badges', gifted: true, note: 'All 201 badges' });
    lsSet(LS.reward, { at: Date.now(), granted: !!ok });
    if(!silent) toast('\ud83d\ude80 201 of 201 \u00b7 SideCut Premium is yours, free. Thank you for playing with all of it.', 6000);
    return !!ok;
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

  // ---- the generated tiers -------------------------------------------------
  // Every table is { group, key, ico, unit, sub, vals[], get(stats), name(v) }.
  // The thresholds deliberately avoid the 30 hand-written badges' numbers, so no
  // milestone is celebrated twice under two names.
  function fmtNum(v){ return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // Every feature the app can mark as used. The capstone badge at the end of the
  // counting tables wants ALL of them, so this list IS that badge's definition: a
  // new flag cannot be counted without joining it. Nothing here is a share, an
  // export or an EDIT: 70.0.6 took the three in-place editors (crop, retag and
  // reencode) out, so the capstone is nine features you can use on your own
  // files without changing one.
  var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];
  var BADGE_TIERS = [
    { g: 'listen', k: 'plays', ico: '\u266b', sub: 'Songs played',
      vals: [3, 5, 10, 25, 50, 150, 250, 400, 600, 800, 1200, 1500, 2000],
      get: function(s){ return s.plays || 0; }, name: function(v){ return fmtNum(v) + ' plays'; } },
    { g: 'listen', k: 'hours', ico: '\u23f1', sub: 'Time listened',
      vals: [0.1, 0.25, 0.5, 2, 5, 7.5, 15, 20, 25, 40, 50, 60, 75, 90, 110, 150],
      get: function(s){ return (s.listenSeconds || 0) / 3600; },
      name: function(v){ return v < 1 ? Math.round(v * 60) + ' minutes listened' : (v === 1 ? '1 hour listened' : fmtNum(v) + ' hours listened'); } },
    { g: 'explore', k: 'song', ico: '\ud83d\udd01', sub: 'One song, over and over',
      vals: [2, 3, 5, 15, 20, 25],
      get: function(s, d){ return d.maxPlays; }, name: function(v){ return 'One song played ' + v + ' times'; } },
    { g: 'explore', k: 'distinct', ico: '\ud83c\udfb5', sub: 'Songs actually played',
      vals: [1, 5, 10, 20, 30, 100, 200],
      get: function(s, d){ return d.playedTracks; }, name: function(v){ return fmtNum(v) + ' different songs played'; } },
    { g: 'explore', k: 'night', ico: '\ud83c\udf19', sub: 'After 1 AM',
      vals: [3, 5, 10, 15, 20, 25],
      get: function(s){ return s.nightPlays || 0; }, name: function(v){ return v + ' late-night songs'; } },
    { g: 'explore', k: 'artists', ico: '\ud83c\udfa4', sub: 'Across your library',
      vals: [2, 5, 10, 15, 35, 50, 75, 100, 125, 150, 200],
      get: function(s, d){ return d.artists; }, name: function(v){ return fmtNum(v) + ' different artists'; } },
    { g: 'explore', k: 'genres', ico: '\ud83c\udfad', sub: 'Genres in the library',
      vals: [1, 3, 5, 8, 10, 12, 15, 18, 20],
      get: function(s, d){ return d.genres; }, name: function(v){ return v + ' genres'; } },
    { g: 'streak', k: 'streak', ico: '\ud83d\udd25', sub: 'Days in a row',
      vals: [2, 4, 5, 6, 8, 10, 14, 21, 45, 60, 75, 90, 120, 180],
      get: function(s){ return s.streak || 0; }, name: function(v){ return v + ' days in a row'; } },
    { g: 'streak', k: 'longest', ico: '\u2b50', sub: 'Your best run',
      vals: [7, 21, 30, 45, 60],
      get: function(s){ return s.longest || 0; }, name: function(v){ return 'Best streak of ' + v + ' days'; } },
    { g: 'library', k: 'lib', ico: '\u2630', sub: 'Songs in the library',
      vals: [1, 5, 10, 25, 75, 150, 250, 400, 600, 700, 800, 900, 1000],
      get: function(s){ return s.library || 0; }, name: function(v){ return fmtNum(v) + ' songs shelved'; } },      // "Albums you made" used to read a number the app always reported as zero,
      // which made all seven of these impossible. It counts the albums in your
      // library now: a hand-built album, or an album name the songs already carry.
      { g: 'library', k: 'albums', ico: '\ud83d\udcbf', sub: 'Albums in your library',
      vals: [1, 2, 3, 5, 8, 10, 12],
      get: function(s, d){ return d.albums; }, name: function(v){ return v + ' album' + (v === 1 ? '' : 's') + ' shelved'; } },
    { g: 'library', k: 'playlists', ico: '\ud83d\udcdc', sub: 'Playlists you built',
      vals: [1, 2, 3, 5, 8, 10, 12],
      get: function(s, d){ return d.playlists; }, name: function(v){ return v + ' playlist' + (v === 1 ? '' : 's') + ' of your own'; } },
    { g: 'library', k: 'favorites', ico: '\u2665', sub: 'Songs you marked',
      vals: [1, 3, 5, 10, 20, 35, 50, 75, 100],
      get: function(s, d){ return d.favorites; }, name: function(v){ return v + ' favorites'; } }
  ];
  // The counting tiers - things the app does rather than things it holds.
  var BADGE_COUNTS = [
    { g: 'studio', k: 'cleaner', ico: '\ud83e\uddf9', sub: 'Storage cleaner', vals: [1], get: function(){ return ctr('cleaner'); }, name: function(){ return 'Opened the storage cleaner'; } },
    { g: 'studio', k: 'presets', ico: '\ud83c\udf9b', sub: 'Studio presets tried', vals: [1, 3, 6], get: function(){ return ctr('presets'); }, name: function(v){ return v === 6 ? 'Every Studio preset' : v + ' Studio presets'; } },
    { g: 'studio', k: 'pads', ico: '\ud83c\udfb9', sub: 'Sampler pads used', vals: [1, 4, 8], get: function(){ return Object.keys(padsSeen).length; }, name: function(v){ return v === 8 ? 'All eight pads' : v + ' pads played'; } },
    { g: 'studio', k: 'loops', ico: '\ud83d\udd01', sub: 'Loops recorded', vals: [1, 5, 25, 75, 150], get: function(){ return ctr('loops'); }, name: function(v){ return v + ' loops recorded'; } },
    { g: 'studio', k: 'clips', ico: '\u2702', sub: 'Clips exported', vals: [1, 3, 10], get: function(){ return ctr('clips'); }, name: function(v){ return v + ' clips exported'; } },
    { g: 'studio', k: 'visits', ico: '\ud83c\udfa7', sub: 'Studio visits', vals: [10, 50, 100, 250], get: function(){ return ctr('studio'); }, name: function(v){ return 'Into Studio ' + v + ' times'; } },
    { g: 'assistant', k: 'asst', ico: '\u2728', sub: 'Things done for you', vals: [5, 10, 25, 50, 100, 200], get: function(){ return ctr('assistant'); }, name: function(v){ return v + ' things done by the assistant'; } },
    { g: 'assistant', k: 'asst_t', ico: '\u23ed', sub: 'Assistant transport', vals: [1], get: function(){ return ctr('asstTransport'); }, name: function(){ return 'Skipped a song by asking'; } },
    { g: 'assistant', k: 'asst_p', ico: '\ud83d\udcdc', sub: 'Assistant playlists', vals: [1], get: function(){ return ctr('asstPlaylist'); }, name: function(){ return 'A playlist built by asking'; } },
    { g: 'assistant', k: 'asst_th', ico: '\ud83c\udfa8', sub: 'Assistant themes', vals: [1], get: function(){ return ctr('asstTheme'); }, name: function(){ return 'Changed the theme by asking'; } },
    { g: 'assistant', k: 'asst_c', ico: '\u2702', sub: 'Assistant clips', vals: [1], get: function(){ return ctr('asstClip'); }, name: function(){ return 'A clip cut by asking'; } },
    { g: 'assistant', k: 'shake', ico: '\ud83d\udcf1', sub: 'Shake to skip', vals: [1], get: function(){ return ctr('shake'); }, name: function(){ return 'Skipped a song by shaking the phone'; } },
    { g: 'assistant', k: 'swipe_t', ico: '\ud83d\udc46', sub: 'Swiped the player', vals: [1], get: function(){ return ctr('swipeTrack'); }, name: function(){ return 'Changed track with a swipe'; } },
    { g: 'assistant', k: 'swipe_s', ico: '\ud83c\udfaf', sub: 'Swiped the progress bar', vals: [1], get: function(){ return ctr('swipeSeek'); }, name: function(){ return 'Seeked with a swipe'; } },
    { g: 'themes', k: 'themec', ico: '\ud83c\udfa8', sub: 'Theme changes', vals: [1, 5, 10, 25, 40, 60], get: function(){ return ctr('themeChange'); }, name: function(v){ return v + ' theme change' + (v === 1 ? '' : 's'); } },
    { g: 'themes', k: 'dyn', ico: '\u2728', sub: 'Dynamic themes used', vals: [1, 3, 6], get: function(){ return dynCount(); }, name: function(v){ return v + ' dynamic themes used'; } },
    { g: 'themes', k: 'rgb', ico: '\ud83c\udf08', sub: 'The RGB cycle', vals: [1], get: function(){ return themesUsed.rgb ? 1 : 0; }, name: function(){ return 'Turned on the RGB cycle'; } },
    { g: 'themes', k: 'vortex', ico: '\ud83c\udf00', sub: 'The 200-badge theme', vals: [1], get: function(){ return themesUsed.vortex ? 1 : 0; }, name: function(){ return 'Spun the Vortex'; } },
    // Nothing on the wall asks anyone to export or share their music. These two
    // slots used to count the two export buttons; they count two equally real,
    // entirely local actions now - searching your own shelf, and lining a song up
    // to play next - so no badge needs your songs to leave the phone.
    { g: 'library', k: 'search', ico: '\ud83d\udd0e', sub: 'Finding things', vals: [1], get: function(){ return ctr('search'); }, name: function(){ return 'Searched your library'; } },
    { g: 'listen', k: 'queue', ico: '\ud83d\udd1c', sub: 'Lining up', vals: [1], get: function(){ return ctr('queue'); }, name: function(){ return 'Queued a song to play next'; } },
    { g: 'miles', k: 'import', ico: '\ud83d\udce5', sub: 'Backups', vals: [1], get: function(){ return ctr('importLib'); }, name: function(){ return 'Imported a library'; } },
    { g: 'miles', k: 'files_added', ico: '\u2795', sub: 'Getting music in', vals: [1], get: function(){ return ctr('addFiles'); }, name: function(){ return 'Brought your own files in'; } },
    { g: 'miles', k: 'grid_seen', ico: '\ud83c\udfc5', sub: 'This screen', vals: [1], get: function(){ return ctr('badgeGrid'); }, name: function(){ return 'Found the badge grid'; } },
    { g: 'miles', k: 'notif', ico: '\ud83d\udd14', sub: 'Patch notes', vals: [1], get: function(){ return ctr('notif'); }, name: function(){ return 'Opened the patch notes'; } },
    { g: 'miles', k: 'everything', ico: '\ud83d\udee0', sub: 'Every feature touched',
      vals: [FEATURE_KEYS.length], get: function(s, d){ return d.featuresUsed; },
      name: function(v){ return 'Used all ' + v + ' features the app has'; } }
  ];

  // s and d are passed in, never recomputed here: 170 badges each asking for the
  // stats and the library would be 340 scans of every song on every repaint, and
  // the app repaints this screen whenever it approves of the moment.
  function tierBadges(t, s, d){
    return t.vals.map(function(v, i){
      var tone = i < t.vals.length * 0.5 ? 'a' : (i < t.vals.length * 0.85 ? 'b' : 'c');
      return {
        id: 'p_' + t.k + '_' + String(v).replace(/\./g, '_'),
        name: t.name(v), sub: t.sub, ico: t.ico, tone: tone, group: t.g,
        need: { got: Math.min(t.get(s, d) || 0, v), want: v }
      };
    });
  }
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
  // The 30 hand-written badges keep their names and their subs; they only need the
  // group they belong to so the grid can section them.
  var BASE_GROUPS = {
    first_play: 'listen', plays_100: 'listen', plays_1000: 'listen', plays_3000: 'listen',
    hour_1: 'listen', hour_10: 'listen', hour_100: 'listen', one_song_10: 'listen', one_song_30: 'listen',
    streak_3: 'streak', streak_7: 'streak', streak_30: 'streak', streak_best_14: 'streak',
    lib_100: 'library', lib_500: 'library',
    artists_25: 'explore', played_50_songs: 'explore', night_owl: 'explore',
    studio_first: 'studio', slow_wet: 'studio', karaoke_1: 'studio', sampler_1: 'studio', looper_1: 'studio',
    clip_1: 'studio', all_tools: 'studio',
    assistant_1: 'assistant', autodj_1: 'assistant'
  };
  var GROUP_TITLES = [
    ['streak', 'Streaks'], ['listen', 'Listening'], ['explore', 'Discovery'], ['library', 'Library'],
    ['studio', 'Studio & editing'], ['assistant', 'Assistant & gestures'], ['themes', 'Themes'],
    ['miles', 'Milestones'], ['secret', 'Secret']
  ];
  function EXTRA_ACHIEVEMENTS(s, d){
    var out = [];
    BADGE_TIERS.forEach(function(t){ out = out.concat(tierBadges(t, s, d)); });
    BADGE_COUNTS.forEach(function(t){ out = out.concat(tierBadges(t, s, d)); });
    // The one badge that is not on the grid until you have earned it: dev mode is
    // the door, and the badge is what is behind it.
    out.push({
      id: 'secret_devmode', name: 'The door', sub: 'Enter dev mode', ico: '\ud83d\udd13', tone: 'c',
      group: 'secret', secret: true, need: { got: devOn ? 1 : 0, want: 1 }
    });
    return out;
  }
  function ACHIEVEMENTS(){
    var d = derivedStats();
    var s = stats();
    var base = BASE_ACHIEVEMENTS().map(function(a){ return Object.assign({ group: BASE_GROUPS[a.id] || 'listen' }, a); });
    return base.concat(EXTRA_ACHIEVEMENTS(s, d));
  }
  function badgesByGroup(list){
    var all = list || ACHIEVEMENTS();
    return GROUP_TITLES.map(function(g){
      var items = all.filter(function(a){ return a.group === g[0]; });
      return { key: g[0], title: g[1], items: items, have: items.filter(isUnlocked).length };
    });
  }

  // Dev mode can pretend every badge is earned, so the reward path can be walked
  // without playing ten thousand songs first. It is honoured ONLY while dev mode
  // is on, and the panel says so on the line above the button.
  var simAll = !!lsGet(LS.sim, false);
  function unlockedCount(){
    var all = ACHIEVEMENTS();
    if(simAll && devOn) return all.length;
    var n = 0;
    all.forEach(function(a){ if(a.need.got >= a.need.want) n++; });
    return n;
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
        // 201 badges means a big library can unlock a dozen at once on the first
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
    // See the note above the reward table: Premium follows the count, so it is
    // granted on every evaluation of it, not only when a badge unlocks.
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
      if(r) bpmCache[t.id] = r;
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
      '<div class="sc-badge-sub">One of the 201 is not in this list.</div>' +
      '<div class="sc-badge-bar"><i style="width:0%"></i></div></div></div>';
  }
  function achievementsHtml(all){
    var list = all || ACHIEVEMENTS();
    var html = badgesByGroup(list).map(function(g){
      var isSecret = g.key === 'secret';
      // Before dev mode, the secret group is one blank tile and nothing else: the
      // hint that there IS a 201st badge is the point, the answer is not.
      if(isSecret && !devOn){
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
      ? (r.kind === 'premium' ? '<span class="sc-reward-have">Granted, free</span>' : '<span class="sc-reward-have">Unlocked</span>')
      : '<span class="sc-reward-need">' + (r.at - r.have) + ' to go</span>';
    var act = !r.earned ? ''
      : (r.kind === 'theme'
        ? '<button class="sc-btn tiny primary" data-act="usetheme" data-key="' + r.key + '">Use it</button>'
        : '<button class="sc-btn tiny" data-act="openpremium">Open Premium</button>');
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
  function devPanelHtml(){
    if(!devOn) return '';
    var all = ACHIEVEMENTS().length;
    return '<div class="sc-dev">' +
      '<div class="sc-dev-head"><span>\ud83d\udd27 Dev mode</span><span class="sc-dev-sub">' + unlockedCount() + '/' + all + ' met, ' + Object.keys(achState).length + ' recorded</span></div>' +
      '<div class="sc-dev-note">Seven taps on the version line in Settings opens this. It sets the app\u2019s own test flag as well, so the app\u2019s hidden debug affordances come with it.</div>' +
      '<div class="sc-actions">' +
        '<button class="sc-btn tiny" data-act="devself">Self-test</button>' +
        '<button class="sc-btn tiny" data-act="devsim">' + (simAll ? 'Stop pretending' : 'Pretend all ' + all + ' are earned') + '</button>' +
        '<button class="sc-btn tiny" data-act="devreset">Reset badge state</button>' +
        '<button class="sc-btn tiny" data-act="devoff">Exit dev mode</button>' +
      '</div>' +
      '<div class="sc-dev-note">A reset clears badges, counters and feature flags. It never takes Premium back \u2014 a reward is not a switch, and a real purchase is not a dev tool\u2019s to undo.</div>' +
      '</div>';
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
  // rewards, the filter, the nine groups and (when it is on) the dev panel. It
  // counts the badges ONCE and passes that list down - ACHIEVEMENTS() walks the
  // library, and this section used to ask for it four times a repaint.
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
      devPanelHtml() +
      achFilterChips() +
      '<div class="sc-ach-groups">' + achievementsHtml(allList) + '</div>' +
      '</div>';
  }

  function renderStudio(){
    var host = $('studioView');
    if(!host) return;
    var t = currentTrack();
    var s = stats();
    var html = '' +
      '<div class="sc-head"><h2>Studio</h2><div class="sc-head-sub">Everything creative, in one place \u00b7 ' + VERSION + '</div></div>' +
      '<div class="sc-now">' +
        '<div class="sc-art lg" style="' + (t && t.artUrl ? 'background-image:url(' + esc(t.artUrl) + ')' : '') + '"></div>' +
        '<div class="sc-now-txt"><div class="sc-now-name">' + esc(t ? (t.name || 'Untitled') : 'Nothing is playing') + '</div>' +
        '<div class="sc-now-sub">' + esc(t ? (t.artist || 'Unknown artist') : 'Tap a song in Library to load the tools') + '</div>' +
        '<div class="sc-now-tools">' +
          '<button class="sc-btn tiny" data-act="loadsampler">Load sampler</button>' +
          '<button class="sc-btn tiny" data-act="crop">Crop</button>' +
          '<button class="sc-btn tiny" data-act="clip">Make a clip</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="sc-tools">' +
        toolCard('crop', '\u2702', 'Crop song', 'Trim the start and the end in place \u2014 the same cropper as the \u22ee menu, with Undo crop on the song.', 'accent') +
        toolCard('clip', '\ud83c\udfb5', 'Ringtone / clip', 'Save a section as its own tagged MP3. Nothing in your library changes.', '') +
        toolCard('fx', '\ud83c\udf0a', 'Slowed + reverb', fxState.rate === 1 && !fxState.reverb ? 'Add weight and space, or speed it up.' : fxState.rate.toFixed(2) + 'x \u00b7 ' + Math.round(fxState.reverb * 100) + '% wet', fxState.rate !== 1 || fxState.reverb > 0 ? 'on' : '') +
        toolCard('karaoke', '\ud83c\udfa4', 'Karaoke mode', fxState.karaoke > 0 ? 'Vocal pulled out \u00b7 ' + Math.round(fxState.karaoke * 100) + '%' : 'Take the lead vocal out of what is playing.', fxState.karaoke > 0 ? 'on' : '') +
        toolCard('sampler', '\ud83c\udf9b', 'Sampler pads', sampler.trackId ? 'Loaded with "' + esc(trackName(sampler.trackId)) + '"' : 'Eight pads over the song you are playing.', sampler.trackId ? 'on' : '') +
        toolCard('looper', '\ud83d\udd01', 'Loop recorder', looper.layers.length ? looper.layers.length + ' loop' + (looper.layers.length === 1 ? '' : 's') + ' repeating' : 'Record a bar and layer it.', looper.layers.length ? 'on' : '') +
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
        var act = b.getAttribute('data-act');
        if(act === 'loadsampler') loadSamplerFor(currentTrack());
        else if(act === 'apkread') loadApkDownloads();
        else if(act === 'crop') cropCurrent();
        else if(act === 'clip') openClipSheet();
        else if(act === 'autodj') setAutoDj(!autodj.on);
        else if(act === 'shake') enableShake(!gestures.shake);
        else if(act === 'swipe'){ gestures.swipe = !gestures.swipe; lsSet(LS.gestures, gestures); toast(gestures.swipe ? 'Swipe the player is on' : 'Swipe the player is off'); renderStudio(); }
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
        else if(act === 'openpremium'){ if(typeof window.openPremiumSettings === 'function') window.openPremiumSettings(); }
        else if(act === 'devself'){
          var f = checkAchievements(true);
          toast('Self-test: ' + unlockedCount() + '/' + ACHIEVEMENTS().length + ' met, ' + Object.keys(achState).length + ' recorded' + (f.length ? ', ' + f.length + ' just unlocked' : '') + '.', 4200);
        }
        else if(act === 'devsim'){
          simAll = !simAll; lsSet(LS.sim, simAll);
          toast(simAll ? 'Dev: pretending every badge is earned.' : 'Dev: back to the real count.');
          checkAchievements(true); renderStudio();
        }
        else if(act === 'devreset'){
          achState = {}; counters = {}; flags = {};
          lsSet(LS.ach, achState); lsSet(LS.ctr, counters); lsSet(LS.flags, flags);
          toast('Dev: badges, counters and feature flags cleared. Premium was left alone.', 4200);
          checkAchievements(true); renderStudio();
        }
        else if(act === 'devoff') setDevMode(false);
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
    if(id === 'crop') return cropCurrent();
    if(id === 'clip') return openClipSheet();
    if(id === 'fx') return openFxSheet();
    if(id === 'karaoke') return openKaraokeSheet();
    if(id === 'sampler') return openSamplerSheet();
    if(id === 'looper') return openLooperSheet();
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
      '<div class="sc-now"><div class="sc-art" style="' + (currentTrack() && currentTrack().artUrl ? 'background-image:url(' + esc(currentTrack().artUrl) + ')' : '') + '"></div>' +
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
    if(l) l.addEventListener('click', function(){ loadSamplerFor(currentTrack()).then(function(){ openSamplerSheet(); }); });
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
  function buildStudioView(){
    if($('studioView')) return;
    var host = document.createElement('div');
    host.id = 'studioView';
    var anchor = $('nowPlaying');
    if(anchor && anchor.parentNode) anchor.parentNode.insertBefore(host, anchor);
    else document.body.appendChild(host);
  }
  // ---- what the new badges count -------------------------------------------
  // One delegated listener for the controls the app owns: the theme buttons, the
  // add-songs menu's own export/import entries, the bell. Counting here rather
  // than inside the app keeps the release to one file, and it cannot drift from
  // the button it counts, because it IS the button.
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
    wireDevGesture();
    try{ document.body.classList.toggle('sc-dev-on', devOn); }catch(e){}
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
    devMode: devMode,
    setDevMode: setDevMode,
    simulateAll: function(){ return simAll; },
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
    stats: stats,
    setTarget: function(k){ reenKbps = k; renderStudio(); },
    target: function(){ return reenKbps; }
  };
})();
