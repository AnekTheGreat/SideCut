"""The volume boost for 80.3.2: its state and setter, its two nodes, its row and its restore.

Part of the 80.3.2 payload; run dev/patch-8032.py, which applies these in order.
"""

BOOST_STATE_OLD = """  $('autoVolumeToggle').addEventListener('click', () => setAutoVolume(!autoVolumeEnabled));
"""

BOOST_STATE_NEW = BOOST_STATE_OLD + """
  // 80.3.2 - VOLUME BOOST. One master gain after the decks' limiters, so +15 dB is a clean 5.6x
  // on a quiet master rather than another EQ band. One saved number, restored at boot.
  var scBoostDb = 0;
  var scBoostGain = null;
  var scBoostGuard = null;
  var SC_BOOST_MAX_DB = 15;
  function scBoostGainFor(db){
    return Math.pow(10, Math.max(0, Number(db) || 0) / 20);   // +6 dB is 2x, +15 dB is 5.6x
  }
  function paintBoost(){
    var v = $('boostDbValue');
    if(v) v.textContent = scBoostDb > 0 ? ('+' + scBoostDb + ' dB') : 'Off';
    var s = $('boostDbSlider');
    if(s && String(s.value) !== String(scBoostDb)) s.value = String(scBoostDb);
  }
  function setBoostDb(db, opts){
    var n = Math.round(Number(db));
    if(!isFinite(n)) n = 0;
    scBoostDb = Math.max(0, Math.min(SC_BOOST_MAX_DB, n));
    try{ ensureAudioGraph(); }catch(_eBoostGraph){}
    if(scBoostGain){
      try{ scBoostGain.gain.value = scBoostGainFor(scBoostDb); }catch(_eBoostSet){}
    }
    if(scBoostGuard){
      // The ceiling only exists while there is a boost to catch: at 0 dB the compressor is a
      // straight wire, so Off is the plain signal and not a lightly compressed one.
      try{
        scBoostGuard.ratio.value = scBoostDb > 0 ? 20 : 1;
        scBoostGuard.threshold.value = scBoostDb > 0 ? -1.5 : 0;
      }catch(_eBoostGuard){}
    }
    paintBoost();
    if(!(opts && opts.quiet)) dbPut('meta', { key: 'boostDb', value: scBoostDb });
  }
  try{
    var _boostSlider = $('boostDbSlider');
    if(_boostSlider){
      // The sound follows the finger; the write waits for it to stop.
      _boostSlider.addEventListener('input', function(e){ setBoostDb(e.target.value, { quiet: true }); });
      _boostSlider.addEventListener('change', function(e){ setBoostDb(e.target.value); });
    }
  }catch(_eBoostSlider){}
"""

GRAPH_OLD = """      scDuckMaster = audioCtx.createGain();
      scDuckMaster.gain.value = 1;
      scDuckMaster.connect(audioCtx.destination);
"""

GRAPH_NEW = GRAPH_OLD + """      // 80.3.2 - THE VOLUME BOOST, on the master: both decks' limiters feed it and it feeds a
      // soft ceiling. At 0 dB the gain is 1.0 and the guard is a straight wire (ratio 1), so
      // Off is the same signal, not a nearly-identical one.
      scBoostGain = audioCtx.createGain();
      scBoostGain.gain.value = scBoostGainFor(scBoostDb);
      scBoostGuard = audioCtx.createDynamicsCompressor();
      scBoostGuard.threshold.value = scBoostDb > 0 ? -1.5 : 0;
      scBoostGuard.knee.value = 0;
      scBoostGuard.ratio.value = scBoostDb > 0 ? 20 : 1;
      scBoostGuard.attack.value = 0.002;
      scBoostGuard.release.value = 0.14;
      scBoostGain.connect(scBoostGuard).connect(scDuckMaster);
"""

LIMITER_OLD = """        if(!scStudioFx) deckGain.connect(limiter);
        limiter.connect(scDuckMaster);
"""

LIMITER_NEW = """        if(!scStudioFx) deckGain.connect(limiter);
        limiter.connect(scBoostGain);
"""

GRAPH_RESET_OLD = """      limiterNodes[0] = limiterNodes[1] = null;
      scDuckMaster = null;
      recordDestNode = null;
"""

GRAPH_RESET_NEW = """      limiterNodes[0] = limiterNodes[1] = null;
      scDuckMaster = null;
      scBoostGain = null;
      scBoostGuard = null;
      recordDestNode = null;
"""

EQ_TAIL = """      <div style="font-size:11px; color:var(--ink-dim); margin-top:12px;">Applies to any song without its own Vibe set (see each song's \u22ef menu). Drag any band, or tap a preset to jump straight to it. Save your own setup as the Custom preset to recall it anytime.</div>
"""

EQ_TAIL_NEW = EQ_TAIL + """      <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:baseline;">
          <span style="font-size:13px; color:var(--ink); font-weight:600;">Volume boost</span>
          <span id="boostDbValue" style="font-family:'JetBrains Mono',monospace; font-size:12px; color:var(--coral);">Off</span>
        </div>
        <input type="range" id="boostDbSlider" min="0" max="15" step="1" value="0" style="width:100%; margin-top:9px; accent-color:var(--coral);">
        <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--ink-dim); margin-top:1px;"><span>Off</span><span>+15 dB</span></div>
        <div style="font-size:11px; color:var(--ink-dim); margin-top:7px; line-height:1.55;">Louder than the phone's own maximum, up to about five and a half times the signal \u2014 for a quiet master or quiet headphones. A soft ceiling catches the peaks it would otherwise clip, so it gets louder instead of crackling. <b>Off</b> (0 dB) is exactly how SideCut sounded before.</div>
      </div>
"""

BOOST_RESTORE_OLD = """      const autoVolRow = metaRows.find(r => r.key === 'autoVolume');
      setAutoVolume(autoVolRow ? !!autoVolRow.value : true);
"""

BOOST_RESTORE_NEW = BOOST_RESTORE_OLD + """      // 80.3.2 - the boost, restored through the same door. No row means 0 dB, so an update
      // sounds exactly like the build it replaced.
      const boostRow = metaRows.find(r => r.key === 'boostDb');
      setBoostDb(boostRow && typeof boostRow.value === 'number' ? boostRow.value : 0, { quiet: true });
"""

SWAPS = [
    (BOOST_STATE_OLD, BOOST_STATE_NEW, 'the auto-volume wiring'),
    (GRAPH_OLD, GRAPH_NEW, 'the duck master'),
    (LIMITER_OLD, LIMITER_NEW, 'the limiter output'),
    (GRAPH_RESET_OLD, GRAPH_RESET_NEW, 'the graph teardown'),
    (EQ_TAIL, EQ_TAIL_NEW, 'the equalizer pane tail'),
    (BOOST_RESTORE_OLD, BOOST_RESTORE_NEW, 'the boot restore'),
]
