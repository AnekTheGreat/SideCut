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

  var VERSION = '70.0';
  var LS = {
    fx: 'sidecut_studio_fx',
    pads: 'sidecut_studio_pads',
    ach: 'sidecut_achievements',
    flags: 'sidecut_feature_flags',
    gestures: 'sidecut_gestures',
    autodj: 'sidecut_autodj'
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
  function setFx(patch, quiet){
    for(var k in patch) fxState[k] = patch[k];
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
    if(flags[k]) return;
    flags[k] = Date.now();
    lsSet(LS.flags, flags);
  }
  function stats(){
    var s = call('__scStats') || {};
    return s;
  }
  function ACHIEVEMENTS(){
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
      { id: 'plays_5000', name: 'Five thousand', sub: '5,000 songs played', ico: '\u266b', tone: 'c', need: p(plays, 5000) },
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
      { id: 'crop_1', name: 'Trimmed', sub: 'Crop a song', ico: '\u2702', tone: 'a', need: p(flags.crop ? 1 : 0, 1) },
      { id: 'retag_1', name: 'Naming things', sub: 'Edit tags in a batch', ico: '\u270e', tone: 'a', need: p(flags.retag ? 1 : 0, 1) },
      { id: 'reencode_1', name: 'Space saver', sub: 'Re-encode a song smaller', ico: '\u2b07', tone: 'a', need: p(flags.reencode ? 1 : 0, 1) },
      { id: 'assistant_1', name: 'Asked and done', sub: 'Have the assistant do something', ico: '\u2728', tone: 'a', need: p(flags.assistant ? 1 : 0, 1) },
      { id: 'autodj_1', name: 'Blended', sub: 'Hear a beat-matched crossfade', ico: '\ud83c\udf9a', tone: 'a', need: p(flags.autodj ? 1 : 0, 1) },
      { id: 'all_tools', name: 'Every tool', sub: 'Use all five Studio tools', ico: '\ud83d\udee0', tone: 'c', need: p(['slow', 'karaoke', 'sampler', 'looper', 'clip'].filter(function(k){ return flags[k]; }).length, 5) }
    ];
  }
  function unlockedCount(){
    var n = 0;
    ACHIEVEMENTS().forEach(function(a){ if(a.need.got >= a.need.want) n++; });
    return n;
  }
  function checkAchievements(silent){
    var fresh = [];
    ACHIEVEMENTS().forEach(function(a){
      if(a.need.got < a.need.want) return;
      if(achState[a.id]) return;
      achState[a.id] = Date.now();
      fresh.push(a);
    });
    if(fresh.length){
      lsSet(LS.ach, achState);
      if(!silent){
        fresh.forEach(function(a, i){
          setTimeout(function(){ toast('\ud83c\udfc5 Badge unlocked \u00b7 ' + a.name + ' \u2014 ' + a.sub, 4000); }, i * 900);
        });
      }
    }
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
      if(scrubbing) return;
      if(Math.abs(dx) > 56 && Math.abs(dx) > Math.abs(dy) * 1.5){
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
  var SCACT = {
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
        checkAchievements(true);
        return 'Made a playlist called "' + name + '" with your ' + top.length + ' most-played songs. "' + (top[0].name || 'the top one') + '" is first with ' + (top[0].playCount || 0) + ' plays.';
      }
      // "turn on the Ember theme"
      m = low.match(/(?:turn on|switch to|use|set|enable|change to|put on)\s+(?:the\s+)?([a-z ]+?)\s*(?:theme|mode|look)?\s*$/);
      if(m && /theme|look/.test(low)){
        var key = THEME_WORDS[m[1].trim()];
        if(key){
          call('__scApplyTheme', key);
          markFeature('assistant');
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
      if(/^(next|skip)\b/.test(low)){ call('__scNext'); markFeature('assistant'); return 'Skipped to the next song.'; }
      if(/^(previous|prev|back a song|go back)\b/.test(low)){ call('__scPrev'); markFeature('assistant'); return 'Back to the previous song.'; }
      if(/^(pause|stop the music|stop)\b/.test(low)){ call('__scPause'); markFeature('assistant'); return 'Paused.'; }
      if(/^(play|resume)\b/.test(low) && low.length < 14){ call('__scResume'); markFeature('assistant'); return 'Playing.'; }
      return null;
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
  function achievementsHtml(){
    return ACHIEVEMENTS().map(function(a){
      var have = isUnlocked(a);
      var p = pctNeed(a);
      return '<div class="sc-badge' + (have ? ' have' : '') + ' tone-' + a.tone + '">' +
        '<div class="sc-badge-ico">' + a.ico + '</div>' +
        '<div class="sc-badge-txt"><div class="sc-badge-name">' + esc(a.name) + '</div>' +
        '<div class="sc-badge-sub">' + esc(have ? a.sub : a.sub + ' \u00b7 ' + p + '%') + '</div>' +
        '<div class="sc-badge-bar"><i style="width:' + (have ? 100 : p) + '%"></i></div></div></div>';
    }).join('');
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
  function achievementsSummaryHtml(){
    var s = stats();
    var unlocked = unlockedCount();
    var all = ACHIEVEMENTS().length;
    var hours = (s.listenSeconds || 0) / 3600;
    return '<div class="sc-hero">' +
      '<div class="sc-hero-num">' + hours.toFixed(1) + 'h</div>' +
      '<div class="sc-hero-sub">listened \u00b7 ' + (s.plays || 0) + ' plays \u00b7 ' + (s.streak || 0) + '-day streak</div>' +
      '<div class="sc-hero-ring"><i style="width:' + Math.round((unlocked / Math.max(1, all)) * 100) + '%"></i></div>' +
      '<div class="sc-hero-badges">' + unlocked + ' of ' + all + ' badges</div>' +
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
          '<button class="sc-btn tiny" data-act="clip">Make a clip</button>' +
        '</div></div>' +
      '</div>' +
      '<div class="sc-tools">' +
        toolCard('clip', '\u2702', 'Crop \u2192 clip', 'Cut a section out and save it as its own MP3 \u2014 a ringtone or a story clip.', 'accent') +
        toolCard('fx', '\ud83c\udf0a', 'Slowed + reverb', fxState.rate === 1 && !fxState.reverb ? 'Add weight and space, or speed it up.' : fxState.rate.toFixed(2) + 'x \u00b7 ' + Math.round(fxState.reverb * 100) + '% wet', fxState.rate !== 1 || fxState.reverb > 0 ? 'on' : '') +
        toolCard('karaoke', '\ud83c\udfa4', 'Karaoke mode', fxState.karaoke > 0 ? 'Vocal pulled out \u00b7 ' + Math.round(fxState.karaoke * 100) + '%' : 'Take the lead vocal out of what is playing.', fxState.karaoke > 0 ? 'on' : '') +
        toolCard('sampler', '\ud83c\udf9b', 'Sampler pads', sampler.trackId ? 'Loaded with "' + esc(trackName(sampler.trackId)) + '"' : 'Eight pads over the song you are playing.', sampler.trackId ? 'on' : '') +
        toolCard('looper', '\ud83d\udd01', 'Loop recorder', looper.layers.length ? looper.layers.length + ' loop' + (looper.layers.length === 1 ? '' : 's') + ' repeating' : 'Record a bar and layer it.', looper.layers.length ? 'on' : '') +
      '</div>' +
      '<div class="sc-sec" id="scStudioAch"><div class="sc-sec-head"><span>Achievements</span><span class="sc-sec-sub">' + unlockedCount() + '/' + ACHIEVEMENTS().length + '</span></div>' +
        achievementsSummaryHtml() + '<div class="sc-badges">' + achievementsHtml() + '</div></div>' +
      '<div class="sc-sec" id="scStudioStorage"><div class="sc-sec-head"><span>Storage cleaner</span><span class="sc-sec-sub">' + fmtBytes(totalAudioBytes()) + '</span></div>' +
        storageHtml() + '</div>' +
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
        else if(act === 'clip') openClipSheet();
        else if(act === 'autodj') setAutoDj(!autodj.on);
        else if(act === 'shake') enableShake(!gestures.shake);
        else if(act === 'swipe'){ gestures.swipe = !gestures.swipe; lsSet(LS.gestures, gestures); toast(gestures.swipe ? 'Swipe the player is on' : 'Swipe the player is off'); renderStudio(); }
        else if(act === 'batch') openBatchTags(call('__scSelectedIds') || []);
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
    markFeature('studio');
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
  function boot(){
    buildStudioView();
    applyFx();
    applyRate();
    wireSwipe();
    renderStudio();
    checkAchievements(true);
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
