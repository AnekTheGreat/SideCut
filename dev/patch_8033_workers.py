"""80.3.3, sections 2, 3 and 9 - the encoders get threads of their own.

The cooperative encoders become scEncodeInPool + scEncoderSource (the worker runs the
PAGE'S OWN encoder source, so there is still one implementation per format), the callers
that re-read their buffer after a failed encode keep their samples, and the lamejs mirror
list is shared by the page loader and the workers.

Imported by dev/patch-8033.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 2. The encoders get threads of their own
# ---------------------------------------------------------------------------
ENCODE_OLD = """  async function scEncodeAudioCooperative(buf, fmt, meta, onSlice){
    try{
      if(fmt === 'mp3' && typeof lamejs === 'undefined'){ await window.__scEnsureLamejs(); }
      if(fmt === 'mp3') return await scEncodeMp3Cooperative(buf, meta, onSlice);
"""

ENCODE_NEW = r"""  // ---- THE ENCODERS GET THREADS OF THEIR OWN -------------------------------------
  // Measured on the page's own encoders (dev/_dl8033-measure.cjs, a 3.5-minute stereo
  // track): ~7-9 s for FLAC and ~12 s for MP3, and that is ONE thread's whole
  // attention, per song. A 32-song album is about two hours of audio, which is four
  // minutes of encoding even on a fast desktop - and the app's thread is the thread
  // that answers every tap. A worker is a thread the platform schedules on its own
  // cores and does not throttle with the page's timers, so the album's encoding spreads
  // across cores AND keeps its speed while the app is behind something else.
  //
  // The worker runs THE PAGE'S OWN ENCODER SOURCE (Function.prototype.toString). That
  // is the point: there is still exactly one implementation of every format in this
  // repository - the worker is a place to run it, not a second copy of it to keep in
  // step. What it needs and does not have (a document, the slice budget, a UI to yield
  // to) is shimmed at the top of the source below.
  var SC_ENC_WORKERS = 3;
  var scEncWorkerUrl = null;
  function scEncoderSource(){
    return [
      // A worker has no document, no frames to drop and no reason to yield - which is
      // exactly why the encode wants to be here.
      'var document = { hidden: false };',
      'var SC_ENCODE_SLICE_MS = 90;',
      'var SC_ENCODE_FRAME_MS = 12;',
      'function scBackSliceMul(){ return 1; }',
      'function scYieldToUI(){ return Promise.resolve(); }',
      'var scLameMirrors = ' + JSON.stringify(SC_LAME_MIRRORS) + ';',
      "function scLoadLame(){ if(typeof lamejs !== 'undefined') return Promise.resolve(true); var i = 0; return new Promise(function(res){ (function next(){ if(i >= scLameMirrors.length) return res(false); try{ importScripts(scLameMirrors[i++]); }catch(_ie){ return next(); } res(typeof lamejs !== 'undefined'); })(); }); }",
      scId3v23Bytes.toString(),
      scJoinTaggedChunks.toString(),
      scEncodeMp3Cooperative.toString(),
      scEncodeWavCooperative.toString(),
      scEncodeAiffCooperative.toString(),
      encodeAudioBufferToFlac.toString(),
      [
        'self.onmessage = function(ev){',
        '  var msg = ev && ev.data;',
        "  if(!msg || !msg.id) return;",
        '  var id = msg.id;',
        '  function finish(bytes){',
        '    try{',
        '      if(bytes && bytes.byteLength){ self.postMessage({ id: id, bytes: bytes }, [bytes.buffer ? bytes.buffer : bytes]); return; }',
        '    }catch(_pf){}',
        '    self.postMessage({ id: id, bytes: null });',
        '  }',
        '  try{',
        '    var chans = msg.channels || [];',
        '    var fake = { numberOfChannels: chans.length, sampleRate: msg.sampleRate, length: msg.length,',
        '                 getChannelData: function(i){ return chans[i]; } };',
        '    var onSlice = function(frac){ try{ self.postMessage({ id: id, progress: Math.max(0, Math.min(1, Number(frac) || 0)) }); }catch(_ps){} };',
        '    (function(){',
        "      return (async function(){",
        "        if(msg.fmt === 'mp3' && typeof lamejs === 'undefined') await scLoadLame();",
        '        var blob = null;',
        "        if(msg.fmt === 'mp3') blob = await scEncodeMp3Cooperative(fake, msg.meta, onSlice, msg.kbps);",
        "        else if(msg.fmt === 'wav') blob = await scEncodeWavCooperative(fake, msg.meta, onSlice);",
        "        else if(msg.fmt === 'aiff') blob = await scEncodeAiffCooperative(fake, msg.meta, onSlice);",
        "        else if(msg.fmt === 'flac') blob = await encodeAudioBufferToFlac(fake, msg.meta, onSlice);",
        '        if(!blob) return finish(null);',
        '        var ab = await blob.arrayBuffer();',
        '        finish(new Uint8Array(ab));',
        '      })();',
        '    })().catch(function(err){',
        "      self.postMessage({ id: id, failed: String((err && err.message) || err) });",
        '    });',
        '  }catch(err){',
        "    self.postMessage({ id: id, failed: String((err && err.message) || err) });",
        '  }',
        '};'
      ].join('\n')
    ].join('\n');
  }
  var scEncPool = null;
  function scEncWorkerList(){
    if(scEncPool) return scEncPool;
    scEncPool = [];
    try{
      if(typeof Worker === 'undefined' || typeof Blob === 'undefined' || !window.URL) return scEncPool;
      if(!scEncWorkerUrl) scEncWorkerUrl = URL.createObjectURL(new Blob([scEncoderSource()], { type: 'text/javascript' }));
    }catch(_be){ return scEncPool; }
    var cores = 4;
    try{ cores = Number(navigator.hardwareConcurrency) || 4; }catch(_cores){ cores = 4; }
    var count = Math.max(1, Math.min(SC_ENC_WORKERS, cores - 1));
    for(var i = 0; i < count; i++){
      try{
        var w = new Worker(scEncWorkerUrl);
        w.__scJobs = {};      // job id -> { resolve, onSlice, mime }
        w.__scCount = 0;      // jobs handed to it, running or waiting
        (function(worker){
          worker.onmessage = function(ev){ scEncWorkerMessage(worker, ev && ev.data); };
          worker.onerror = function(ev){
            var why = (ev && (ev.message || ev.filename)) || 'worker error';
            scEncWorkerFailure(worker, String(why));
          };
        })(w);
        scEncPool.push(w);
      }catch(_we){}
    }
    return scEncPool;
  }
  function scEncJobTake(w, msg){
    if(!w || !w.__scJobs || !msg || !msg.id) return null;
    var job = w.__scJobs[msg.id];
    if(!job) return null;
    if(msg.progress != null){
      // Progress is not the answer: the job stays in the table.
      if(job.onSlice){ try{ job.onSlice(msg.progress); }catch(_op){} }
      return null;
    }
    delete w.__scJobs[msg.id];
    w.__scCount = Math.max(0, w.__scCount - 1);
    return job;
  }
  function scEncWorkerMessage(w, msg){
    if(!w || !msg || !msg.id) return;
    if(msg.progress != null){ scEncJobTake(w, msg); return; }
    var job = scEncJobTake(w, msg);
    if(!job) return;
    if(msg.bytes && msg.bytes.byteLength){
      try{ job.resolve(new Blob([msg.bytes], { type: job.mime })); }
      catch(_bm){ job.resolve(null); }
      return;
    }
    if(msg.failed) console.warn('encode worker failed', msg.failed);
    job.resolve(null);
  }
  // A worker that dies takes its jobs with it. They resolve null (the song is reported
  // as failed and the run carries on) rather than leaving a promise that never settles
  // - which is how a conversion looks when it "hangs for ever" on one song.
  function scEncWorkerFailure(w, why){
    console.warn('encode worker died', why);
    try{
      var ids = Object.keys(w.__scJobs || {});
      for(var i = 0; i < ids.length; i++){
        var job = w.__scJobs[ids[i]];
        if(job && job.resolve) job.resolve(null);
      }
    }catch(_ej){}
    w.__scJobs = {}; w.__scCount = 0;
    try{ w.terminate(); }catch(_tw){}
  }
  // One encode on a worker. Returns null when there is no pool here at all (the page
  // encodes it, exactly as it did before this release), and { blob, detached } when the
  // pool did the work - `detached` saying whether the samples went with it.
  async function scEncodeInPool(buf, fmt, meta, onSlice, kbps, keepSamples){
    var list = scEncWorkerList();
    if(!list.length) return null;
    var worker = list[0];
    for(var i = 1; i < list.length; i++){ if(list[i].__scCount < worker.__scCount) worker = list[i]; }
    var nch = Math.max(1, Math.min(2, buf.numberOfChannels || 1));
    var chans = [];
    for(var c = 0; c < nch; c++) chans.push(buf.getChannelData(c));
    // MP3 never hands its samples over: lamejs is the one encoder that arrives from a
    // CDN, so a worker that cannot reach it must be able to fall back to encoding here.
    // The others keep their samples only when the caller asked (a buffer this app
    // re-reads after a failed attempt - the crop preview and the format menu).
    var transfer = null;
    if(!keepSamples && fmt !== 'mp3'){
      transfer = [];
      for(var t = 0; t < chans.length; t++){
        var ab = chans[t] && chans[t].buffer;
        if(ab && transfer.indexOf(ab) === -1) transfer.push(ab);
      }
    }
    var id = 'sc' + (++scEncJobId) + '-' + Date.now();
    var mime = fmt === 'mp3' ? 'audio/mpeg' : (fmt === 'wav' ? 'audio/wav' : (fmt === 'aiff' ? 'audio/aiff' : 'audio/flac'));
    var payload = {
      id: id, fmt: fmt, kbps: kbps || 192,
      sampleRate: Math.max(8000, Math.min(48000, Math.round(buf.sampleRate || 44100))),
      length: Math.round(buf.length || 0),
      channels: chans, meta: meta || null
    };
    var answer = await new Promise(function(res){
      worker.__scJobs[id] = { resolve: res, onSlice: onSlice, mime: mime };
      worker.__scCount++;
      try{
        if(transfer && transfer.length) worker.postMessage(payload, transfer);
        else worker.postMessage(payload);
      }catch(_pe){
        delete worker.__scJobs[id];
        worker.__scCount = Math.max(0, worker.__scCount - 1);
        console.warn('encode worker would not take the job', _pe);
        res(undefined);        // nothing was handed over: the page can encode it
      }
    });
    if(answer === undefined) return null;
    return { blob: answer || null, detached: !!(transfer && transfer.length) };
  }
  var scEncJobId = 0;
  // The one the converters call. The pool first (the same encoders, on their own
  // threads); the page's own encoders when there is no pool, and again for an mp3 the
  // worker could not make. `keepSamples` is for callers that re-read the buffer after a
  // failed attempt - the samples are copied to the worker instead of being handed over.
  async function scEncodeAudioCooperative(buf, fmt, meta, onSlice, keepSamples){
    try{
      var pooled = await scEncodeInPool(buf, fmt, meta, onSlice, null, keepSamples);
      if(pooled){
        if(pooled.blob) return pooled.blob;
        // The worker ran it and produced nothing. If the samples were handed over there
        // is nothing left here to try again with, and a silent file is worse than a
        // failed song: the run reports it and carries on.
        if(pooled.detached) return null;
      }
    }catch(_pwErr){ console.warn('encode pool unavailable, encoding on this thread', _pwErr); }
    try{
      if(fmt === 'mp3' && typeof lamejs === 'undefined'){ await window.__scEnsureLamejs(); }
"""

# ---------------------------------------------------------------------------
# 3. Callers that re-read their buffer after a failed encode
# ---------------------------------------------------------------------------
KEEP_SAMPLES = [
    ("        let blob = await scEncodeAudioCooperative(rendered, cropFmt, null);",
     "        let blob = await scEncodeAudioCooperative(rendered, cropFmt, null, null, true);",
     'the crop preview'),
    ("        if(!blob && cropFmt === 'mp3') blob = await scEncodeAudioCooperative(rendered, 'wav', null);",
     "        if(!blob && cropFmt === 'mp3') blob = await scEncodeAudioCooperative(rendered, 'wav', null, null, true);",
     'the crop preview fallback'),
    ("      let newBlob = await scEncodeAudioCooperative(slice, cropFmt, meta);",
     "      let newBlob = await scEncodeAudioCooperative(slice, cropFmt, meta, null, true);",
     'the crop save'),
    ("        newBlob = await scEncodeAudioCooperative(slice, 'wav', meta);",
     "        newBlob = await scEncodeAudioCooperative(slice, 'wav', meta, null, true);",
     'the crop save fallback'),
    ("        var blob = await scEncodeAudioCooperative(buf, fmt, tagMeta, function(p){\n          if(p > 0 && p < 1) csSetStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%');\n        });",
     "        var blob = await scEncodeAudioCooperative(buf, fmt, tagMeta, function(p){\n          if(p > 0 && p < 1) csSetStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%');\n        }, true);",
     'the Spotify single save (its buffer feeds the Other format menu)'),
    ("      var blob = await scEncodeAudioCooperative(buf, fmt, tagMeta, function(p){\n        if(stEl && p > 0 && p < 1) stEl.textContent = 'Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%';\n      });",
     "      var blob = await scEncodeAudioCooperative(buf, fmt, tagMeta, function(p){\n        if(stEl && p > 0 && p < 1) stEl.textContent = 'Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%';\n      }, true);",
     'the Spotify second save (same stored buffer)'),
]

# ---------------------------------------------------------------------------
# 9. The lamejs mirror list: one list, two users (the page and the worker)
# ---------------------------------------------------------------------------
LAME_OLD = """      var mirrors = [
        'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
        'https://unpkg.com/lamejs@1.2.1/lame.min.js',
        'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
      ];
"""

LAME_NEW = """      // ONE list, read by the page and by the encoder workers (importScripts). A worker
      // that cannot reach the encoder has to say so, and it has to be looking where the
      // page looks: 'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js'.
      var mirrors = SC_LAME_MIRRORS;
"""

LAME_CONST = """  var SC_LAME_MIRRORS = [
    'https://cdn.jsdelivr.net/npm/lamejs@1.2.1/lame.min.js',
    'https://unpkg.com/lamejs@1.2.1/lame.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js'
  ];
"""
