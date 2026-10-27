"""80.3.5, section 2 - the anti-muffler: the blanket comes off the master.

The owner's ask, verbatim: *"add a anti muffler in settings and playback and sound"*
... *"add a anti muffler next to the volume increaser which makes the music not
muffled"*.

WHAT A MUFFLED MASTER IS. Two things, and both are a shape rather than a volume:
a build-up around 250-400 Hz (a mix turns to mud there - it is what a phone speaker
in a pocket, a cheap DAC or a lossy rip adds) and a roll-off above a few kilohertz
(the consonants, the picks, the cymbals). None of that is fixed by turning the
volume up, which is why this is its own switch and not another rung of the boost.

THE SHAPE. Two filters, both on a WET path that sits between the boost and its
ceiling, next to a DRY path that is a plain 1.0:

    boost -> [ dry 1.0 .......................... ] -> guard -> duck master
          -> [ low: -3.5 dB @ 320 Hz, Q 0.85     ]
             [ high: +3.5 dB @ 3.2 kHz, shelf    ]

  * OFF means dry 1 and wet 0: the signal is multiplied by 1.0 and a zero is added
    to it, both exact, so Off is the same samples 80.3.4 played - not a "nearly
    identical" one and not a claim about what a biquad does at 0 dB. On means dry 0
    and wet 1.
  * NOTHING IS EVER DISCONNECTED. The alternative - rewiring the master when the
    switch moves - would have to touch the node the rest of the graph taps, and half
    a second of a broken master is a loud click in someone's ears. Two gains that
    trade 0 and 1 cannot fail like that, and the guard above them still owns the
    ceiling, so the cut and the lift cannot clip.
  * THE CUT IS 3.5 dB, NOT 12. A mud cut deep enough to hear on its own takes the
    body out of a bass line. The lift is the same size on purpose: an asymmetric
    pair is a "bright" preset, and this is not a preset - taste is what the EQ above
    it is for.

One saved boolean (`antiMuffler`), restored beside `boostDb` at boot, and
`setAntiMuffler` calls `ensureAudioGraph` first, so flipping it before anything has
played still takes effect.

Imported by dev/patch-8035.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 2a. The state and the four nodes, beside the boost's own.
# ---------------------------------------------------------------------------
ANCHOR_STATE = "  var scBoostDb = 0;"

STATE = """  // 80.3.5 - the anti-muffler's state and its four nodes. Same shape as the boost
  // above: declared here (before ensureAudioGraph, which assigns them) and null
  // whenever there is no graph.
  var scAntiMuffler = false;
  var scMuffleLow = null;   // the mud cut
  var scMuffleHigh = null;  // the presence lift
  var scMuffleWet = null;   // the path through both filters
  var scMuffleDry = null;   // the path straight through - 1.0 when the switch is off
  var SC_MUFFLE_LOW_HZ = 320, SC_MUFFLE_LOW_Q = 0.85, SC_MUFFLE_LOW_DB = -3.5;
  var SC_MUFFLE_HIGH_HZ = 3200, SC_MUFFLE_HIGH_DB = 3.5;
"""

# ---------------------------------------------------------------------------
# 2b. The two paths, between the boost and its ceiling.
# ---------------------------------------------------------------------------
ANCHOR_GRAPH = "      scBoostGain.connect(scBoostGuard).connect(scDuckMaster);"

GRAPH = """      // 80.3.5 - THE ANTI-MUFFLER RIDES BETWEEN THE BOOST AND ITS CEILING. Two
      // paths into the same guard: the dry one is a plain 1.0, the wet one is the
      // mud cut and the presence lift. Off is dry 1 / wet 0 - a multiply by one
      // and an add of zero, which is the same samples the last release played; On
      // is dry 0 / wet 1. Nothing here is ever disconnected, so the master chain
      // the rest of the app taps stays where it is.
      scMuffleLow = audioCtx.createBiquadFilter();
      scMuffleLow.type = 'peaking';
      scMuffleLow.frequency.value = SC_MUFFLE_LOW_HZ;
      scMuffleLow.Q.value = SC_MUFFLE_LOW_Q;
      scMuffleLow.gain.value = SC_MUFFLE_LOW_DB;
      scMuffleHigh = audioCtx.createBiquadFilter();
      scMuffleHigh.type = 'highshelf';
      scMuffleHigh.frequency.value = SC_MUFFLE_HIGH_HZ;
      scMuffleHigh.gain.value = SC_MUFFLE_HIGH_DB;
      scMuffleWet = audioCtx.createGain();
      scMuffleWet.gain.value = scAntiMuffler ? 1 : 0;
      scMuffleDry = audioCtx.createGain();
      scMuffleDry.gain.value = scAntiMuffler ? 0 : 1;
      scBoostGain.connect(scMuffleLow);
      scMuffleLow.connect(scMuffleHigh).connect(scMuffleWet).connect(scBoostGuard);
      scBoostGain.connect(scMuffleDry).connect(scBoostGuard);
      scBoostGuard.connect(scDuckMaster);"""

ANCHOR_GRAPH_FAIL = """      scBoostGuard = null;"""

GRAPH_FAIL = """      scBoostGuard = null;
      scMuffleLow = scMuffleHigh = scMuffleWet = scMuffleDry = null;"""

# ---------------------------------------------------------------------------
# 2c. The setter, its painter and its wiring - under the boost's own.
# ---------------------------------------------------------------------------
ANCHOR_SET = """      _boostSlider.addEventListener('change', function(e){ setBoostDb(e.target.value); });
    }
  }catch(_eBoostSlider){}"""

SET = """      _boostSlider.addEventListener('change', function(e){ setBoostDb(e.target.value); });
    }
  }catch(_eBoostSlider){}

  // 80.3.5 - THE ANTI-MUFFLER: one switch, one saved boolean, two gains that
  // trade off. `quiet` is the boot restore's way of saying "do not write this back
  // to the database, you are reading it" - the same option the boost takes.
  function paintAntiMuffler(){
    var b = $('antiMufflerToggle');
    if(b){
      b.textContent = scAntiMuffler ? 'On' : 'Off';
      try{ b.classList.toggle('active', !!scAntiMuffler); }catch(_eMuffleCls){}
    }
  }
  function setAntiMuffler(on, opts){
    scAntiMuffler = !!on;
    // Same reason the boost calls it: moving this before anything has played has
    // to take effect, so the graph is built here if it is not up yet.
    try{ ensureAudioGraph(); }catch(_eMuffleGraph){}
    if(scMuffleWet){ try{ scMuffleWet.gain.value = scAntiMuffler ? 1 : 0; }catch(_eMuffleWet){ } }
    if(scMuffleDry){ try{ scMuffleDry.gain.value = scAntiMuffler ? 0 : 1; }catch(_eMuffleDry){ } }
    paintAntiMuffler();
    if(!(opts && opts.quiet)) dbPut('meta', { key: 'antiMuffler', value: scAntiMuffler });
  }
  try{
    var _muffleBtn = $('antiMufflerToggle');
    if(_muffleBtn){
      _muffleBtn.addEventListener('click', function(){ setAntiMuffler(!scAntiMuffler); });
    }
  }catch(_eMuffleBtn){}
  // For a gate or a future release: where the switch is, and what it is doing to
  // the graph right now.
  window.__scAntiMuffler = function(){
    return {
      on: !!scAntiMuffler,
      wet: scMuffleWet ? scMuffleWet.gain.value : null,
      dry: scMuffleDry ? scMuffleDry.gain.value : null,
      low: scMuffleLow ? { type: scMuffleLow.type, hz: scMuffleLow.frequency.value, q: scMuffleLow.Q.value, db: scMuffleLow.gain.value } : null,
      high: scMuffleHigh ? { type: scMuffleHigh.type, hz: scMuffleHigh.frequency.value, db: scMuffleHigh.gain.value } : null,
      label: ($('antiMufflerToggle') || {}).textContent || null
    };
  };
  window.__scSetAntiMuffler = setAntiMuffler;"""

# ---------------------------------------------------------------------------
# 2d. It comes back at boot, through the same door as the boost.
# ---------------------------------------------------------------------------
ANCHOR_RESTORE = """      setBoostDb(boostRow && typeof boostRow.value === 'number' ? boostRow.value : 0, { quiet: true });"""

RESTORE = """      setBoostDb(boostRow && typeof boostRow.value === 'number' ? boostRow.value : 0, { quiet: true });
      // 80.3.5 - and the anti-muffler. No row means off, so an update sounds
      // exactly like the build it replaced.
      const muffleRow = metaRows.find(r => r.key === 'antiMuffler');
      setAntiMuffler(!!(muffleRow && muffleRow.value), { quiet: true });"""

# ---------------------------------------------------------------------------
# 2e. The row itself: right under the boost, inside the one Sound menu.
# ---------------------------------------------------------------------------
ROW = """
      <div style="margin-top:18px; padding-top:14px; border-top:1px solid var(--line);">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-size:13px; color:var(--ink); font-weight:600;">Anti-muffler</span>
          <button class="tab" id="antiMufflerToggle" style="padding:5px 12px; font-size:12px;">Off</button>
        </div>
        <div style="font-size:11px; color:var(--ink-dim); margin-top:7px; line-height:1.55;">Takes the blanket off. A quiet, boxed-in master is usually two things at once: a build-up around <b>320 Hz</b>, where a mix turns to mud, and a roll-off above a few kilohertz, where the words and the cymbals live. This cuts the first by <b>3.5 dB</b> and lifts the second by <b>3.5 dB</b> - the same size on purpose, because an asymmetric pair is a preset and this is not one. It is on the master, under the volume boost, so it colours whatever is playing rather than the file. <b>Off</b> is the same samples SideCut played before this release (a multiply by 1 and an add of 0), and your own equalizer still sits above it either way.</div>
      </div>
"""
