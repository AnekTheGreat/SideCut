#!/usr/bin/env python3
"""80.0.1 - the assistant duck, in one idempotent pass.

WHAT THIS DOES
  1. APP_VERSION -> 80.0.1 and the service-worker shell cache -> v80.0.1.
  2. Puts a master gain between each deck's limiter and the speakers, so one
     number can step the whole mix back (both decks, the DJ engine and the
     Studio chain all land on a limiter) without touching the element volume
     the crossfade owns. The recording tap stays on the limiter, so a recording
     or a SAVE COPY captures the unducked signal.
  3. Adds the duck controller: duck when an assistant takes the audio, come back
     up when the phone says it is over, or after a bounded wait, or the moment
     you touch anything.
  4. Wires it to the three signals the app already receives - the plugin's duck
     event, a transient focus loss with no call behind it, and a full loss with
     no call behind it - and leaves a real phone call on the pause path.
  5. Adds the Assistant duck switch (Settings, More, Playback and sound), on by
     default, carried in a backup.
  6. Adds the 80.0.1 changelog entry.

Idempotent: every step is a no-op once applied. `--check` reports instead of
writing, and exits 1 when the tree is not on 80.0.1 yet.

  python3 dev/patch-8001.py
  python3 dev/patch-8001.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

VERSION = '80.0.1'
PREV = '80.0'
CACHE = 'sidecut-shell-v%s' % VERSION

ENTRY = """  { version: '80.0.1', date: 'October 20, 2026 \\u00b7 11:35 PM EDT', title: 'Assistant duck: the music steps back for an assistant and comes back on its own', items: [
    'The music drops to a low level the moment an assistant starts listening, so you can talk to it without stopping the song.',
    'When the assistant is done the music comes back up to full volume on its own - nothing to tap and nothing to restart.',
    'SideCut tells an assistant apart from a phone call: a call still pauses the song and puts it back when the call ends.',
    'The duck follows the phone rather than a fixed clock, and it gives up after a minute of silence so the music can never stay quiet.',
    'A tap anywhere brings the music straight back up while an assistant is still open.',
    'The Assistant duck switch is in Settings, More, Playback and sound, on by default, and a backup carries it to a new phone.',
    'The letter-by-letter lyrics, the home-screen widget, the player and the albums are exactly where 80.0 left them.',
  ],
    // 80.0.1 - the second half of every note above, so the bell's patch notes read as
    // the same brief-plus-detail pairs 80.0 introduced. A note with no detail is still
    // a plain bullet, so every release before 80.0 renders exactly as it did.
    details: [
      'An assistant - Gemini from the power button, Google Assistant from a headset, any app that holds the audio to listen - asks the phone to duck whoever is playing. SideCut answers it now instead of ignoring it, through a master gain of its own, so the music steps back for the conversation without pausing and without losing its place.',
      'The system hands the audio back when the assistant stops listening, and that is the signal the music comes back up on. It is the phone saying the conversation is over, not a timer guessing at it, so there is nothing to tap and nothing to restart when you are done talking.',
      'A call and an assistant both take the audio, and they are not the same thing. A call pauses the song, as it always has, and puts it back when the call ends. An assistant only borrows the sound for a moment, so the music stays where it is and steps back rather than stopping.',
      'The duck ends when the phone says it is over, or after eight seconds of hearing nothing more, or when you tap the screen - and a duck can never be held for longer than a minute in total, however many signals arrive. Without that ceiling a stream of requests could leave the music quiet for good.',
      'Tapping the screen ends a duck immediately, so if the assistant has finished but the phone has not said so yet, one touch is all it takes. The tap is read on the way up and never steals the press from a button under your finger.',
      'It sits with the other playback settings and it is on out of the box. Turning it off returns the old behaviour exactly - a duck request changes nothing at all - and the choice travels in a backup, so a new phone arrives the way you left the old one.',
      'Nothing else moved. The letter-by-letter lyrics light the word being sung, the widget, the player and the albums are where 80.0 left them, and every saved song and setting is untouched.',
    ]},
"""

GRAPH_ANCHOR = """      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audios.forEach((el, idx) => {
"""
GRAPH_NEW = """      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      // 80.0.1 - THE ASSISTANT DUCK RIDES HERE. One master gain sits between the
      // limiters and the speakers, so a single number steps the WHOLE mix back at
      // once: both decks, the DJ Mode engine and the Studio chain all land on a
      // limiter, and every one of them is above this node. The element volume the
      // crossfade owns is never touched, and the recording tap stays on the
      // limiter, so a recording or a SAVE COPY captures the unducked signal.
      scDuckMaster = audioCtx.createGain();
      scDuckMaster.gain.value = 1;
      scDuckMaster.connect(audioCtx.destination);
      audios.forEach((el, idx) => {
"""

DEST_OLD = """        limiter.connect(audioCtx.destination);
"""
DEST_NEW = """        limiter.connect(scDuckMaster);
"""

DECL_OLD = """  const deckGainNodes = [null, null]; // DJ Mode "GAIN" knob per deck, independent of auto-normalize
  const limiterNodes = [null, null];
"""
DECL_NEW = """  const deckGainNodes = [null, null]; // DJ Mode "GAIN" knob per deck, independent of auto-normalize
  const limiterNodes = [null, null];
  // 80.0.1 - the master node the assistant duck rides. Declared here, after
  // ensureAudioGraph, for the same reason the three above it are: that function
  // assigns it when it builds the graph, and nothing calls it until after this
  // line has run. null means there is no graph, and the duck then reports that it
  // could not step the music back rather than pretending it did.
  let scDuckMaster = null;
"""

CATCH_OLD = """      limiterNodes[0] = limiterNodes[1] = null;
      recordDestNode = null;
"""
CATCH_NEW = """      limiterNodes[0] = limiterNodes[1] = null;
      scDuckMaster = null;
      recordDestNode = null;
"""

DUCK_CONTROLLER = """  // ---------------------------------------------------------------------------
  // 80.0.1 - THE ASSISTANT DUCK.
  //
  // The owner's ask: "when you are talking to an ai such as holding down your
  // power button to talk to gemini, SideCut should let you talk to the ai while
  // playing the music at a lower volume, and then at full volume when you are
  // done talking to the ai."
  //
  // What the phone does when an assistant starts listening: it asks the system
  // for the audio for a moment. Android hands that request to whichever app holds
  // the audio - which, for this app, is Chromium holding it for the <audio>
  // element - and the request is a DUCK request (AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK),
  // the same one a navigation prompt or a message blip makes. Until now this
  // player deliberately ignored every duck ("this player has its own volume
  // handling"), and worse: the transient focus loss that rides along with it was
  // answered by replaying the song, which put it back at FULL volume over the
  // assistant. That is the behaviour the owner is asking to change.
  //
  // So the duck is obeyed now, and it is obeyed through SideCut's own master gain
  // rather than the element volume - the crossfade owns that, and the
  // normalisation gain is per track, so neither can carry a duck without one
  // fighting the other.
  //
  // WHEN IT COMES BACK UP. A phone call publishes its own fact, so a call still
  // pauses. An assistant publishes nothing, so the end of the duck is read from
  // three things, in order of how certain they are:
  //   1. the plugin saying the focus was GAINED again - the honest end-of-request
  //      signal, and the one a device with the 80.0.1 plugin sends;
  //   2. duckState() on the native plugin, which reports the system's own view of
  //      the duck (the audio mode is readable without any permission). Asked only
  //      while a duck is held, so the poll runs for seconds, not for the session;
  //   3. the bounded wait below, for a build whose native half is older than this
  //      release - the web half ships over the air, the plugin does not.
  // The wait is refreshed by every fresh signal, so a long answer that keeps the
  // audio does not get cut off, and it is capped so the music can never stay
  // quiet for long. Touching the screen ends it at once.
  const SC_DUCK_LEVEL = 0.2;      // how far the music steps back (about -14 dB)
  const SC_DUCK_RAMP_S = 0.4;     // the ramp down and back up, so nothing clicks
  const SC_DUCK_HOLD_MS = 8000;   // held this long after the last signal, at most
  const SC_DUCK_MAX_MS = 60000;   // ...and never longer than this from the start
  // assistantDuckOn and setAssistantDuck are declared with the rest of the
  // playback switches, next to setAutoVolume: one declaration of each, shared by
  // the switch and this controller.
  let scDuckUntil = 0;            // when the duck expires unless a signal refreshes it
  let scDuckStartedAt = 0;
  let scDuckTimer = null;
  let scDuckProbeTimer = null;
  let scDuckWhy = '';
  let scDuckApplied = false;
  let scDuckFallbackEl = null;
  let scDuckFallbackVolume = null;
  function scDuckHeld(){ return scDuckUntil > Date.now(); }
  // The master gain if the graph is up, otherwise the element volume, so the duck
  // still works on a build whose AudioContext never came up. The element volume is
  // only moved when there is NO graph - with a graph it belongs to the crossfade,
  // which is the whole reason the duck has a node of its own.
  function scDuckSetLevel(level, ramp){
    const now = Date.now();
    if(scDuckMaster){
      try{
        const g = scDuckMaster.gain;
        const from = (typeof g.value === 'number') ? g.value : 1;
        if(g.cancelScheduledValues) g.cancelScheduledValues(now / 1000);
        if(g.setValueAtTime) g.setValueAtTime(from, now / 1000);
        if(ramp && g.linearRampToValueAtTime) g.linearRampToValueAtTime(level, now / 1000 + SC_DUCK_RAMP_S);
        else g.value = level;
        return true;
      }catch(e){ return false; }
    }
    const el = activeAudio();
    if(!el) return false;
    try{
      if(scDuckFallbackVolume == null){ scDuckFallbackEl = el; scDuckFallbackVolume = el.volume; }
      el.volume = Math.max(0, Math.min(1, scDuckFallbackVolume * level));
      return true;
    }catch(e){ return false; }
  }
  function scDuckRestoreFallback(){
    if(scDuckFallbackVolume == null) return;
    try{ if(scDuckFallbackEl) scDuckFallbackEl.volume = scDuckFallbackVolume; }catch(e){}
    scDuckFallbackEl = null; scDuckFallbackVolume = null;
  }
  function scUnduckForAssistant(why){
    if(!scDuckHeld() && !scDuckApplied) return false;
    const was = scDuckWhy;
    scDuckUntil = 0; scDuckStartedAt = 0; scDuckWhy = ''; scDuckApplied = false;
    if(scDuckTimer){ clearTimeout(scDuckTimer); scDuckTimer = null; }
    if(scDuckProbeTimer){ clearInterval(scDuckProbeTimer); scDuckProbeTimer = null; }
    if(scDuckMaster) scDuckSetLevel(1, true);
    scDuckRestoreFallback();
    recordPlaybackStop('assistant duck released (' + (why || 'over') + ')');
    return !!was;
  }
  function scDuckForAssistant(why){
    if(!assistantDuckOn) return false;
    if(userPaused) return false;
    const a = activeAudio();
    if(!a || a.paused) return false;
    if($('djModeBackdrop').style.display === 'flex') return false;   // the deck owns its own gain
    if(queueIndex < 0 || queueIndex >= queue.length) return false;
    ensureAudioGraph();
    const now = Date.now();
    if(!scDuckHeld()) scDuckStartedAt = now;
    scDuckWhy = why || scDuckWhy;
    scDuckUntil = Math.min(now + SC_DUCK_HOLD_MS, scDuckStartedAt + SC_DUCK_MAX_MS);
    // Marked applied BEFORE the level moves: the level write is the app's own
    // doing, and anything that reacts to it must not read it as a fresh signal.
    if(!scDuckApplied){
      scDuckApplied = true;
      recordPlaybackStop('assistant duck — the music steps back (' + scDuckWhy + ')');
    }
    const ok = scDuckSetLevel(SC_DUCK_LEVEL, true);
    if(!ok) scDuckApplied = false;
    if(scDuckTimer) clearTimeout(scDuckTimer);
    scDuckTimer = setTimeout(function(){
      scDuckTimer = null;
      // The wait ran out. Ask the phone once more before believing it, because the
      // native half may know the duck is still up.
      scDuckAskPhone(function(over){ if(over) scUnduckForAssistant('the wait ran out'); });
    }, Math.max(0, scDuckUntil - now));
    // While a duck is held, ask the phone what it thinks. Only while held, so this
    // never becomes a poll running for the life of the app.
    if(!scDuckProbeTimer){
      scDuckProbeTimer = setInterval(function(){
        if(!scDuckHeld()){ clearInterval(scDuckProbeTimer); scDuckProbeTimer = null; return; }
        scDuckAskPhone(function(over){ if(over) scUnduckForAssistant('the phone says it is over'); });
      }, 1500);
    }
    return ok;
  }
  // The phone's own view of the duck, when the plugin can answer it. An older
  // build has no such method, and the answer is then "unknown" - the wait decides.
  function scDuckAskPhone(done){
    try{
      const P = capAudioFocus;
      if(!P || typeof P.duckState !== 'function') return;
      const p = P.duckState({});
      if(p && typeof p.then === 'function'){
        p.then(function(r){ try{ done(!!(r && r.over)); }catch(e){} }, function(){});
      }
    }catch(e){}
  }
  window.__scDuckForAssistant = scDuckForAssistant;
  window.__scUnduckForAssistant = scUnduckForAssistant;
  window.__scDuckHeld = scDuckHeld;
  window.__scAssistantDuckOn = function(){ return assistantDuckOn; };
  // The node the duck rides. Published so a gate can read the node the app really
  // ducks through instead of assuming which gain it is.
  Object.defineProperty(window, '__scDuckMaster', { get: function(){ return scDuckMaster; } });
"""

DUCK_SETTINGS = """
    // 80.0.1 - Assistant duck. On by default: while an assistant is listening the
    // music steps back instead of stopping, and it comes back up when the phone
    // says the request is over. It is an OPT-OUT, like the notification player - a
    // missing row means on, so an update keeps the feature and a fresh install gets
    // it.
    let assistantDuckOn = true;
    function setAssistantDuck(on){
      assistantDuckOn = !!on;
      const b = $('assistantDuckToggle');
      if(b){ b.textContent = assistantDuckOn ? 'On' : 'Off'; b.classList.toggle('active', assistantDuckOn); }
      dbPut('meta', { key: 'assistantDuck', value: assistantDuckOn });
      if(!assistantDuckOn && typeof scUnduckForAssistant === 'function') scUnduckForAssistant('switched off');
    }
    $('assistantDuckToggle').addEventListener('click', () => setAssistantDuck(!assistantDuckOn));

    // A tap anywhere brings the music straight back up: if you want it loud while an
    // assistant is still open, touching anything says so. Registered once, and it
    // does nothing at all unless a duck is being held.
    document.addEventListener('pointerdown', function(){
      try{ if(scDuckHeld()) scUnduckForAssistant('you touched the screen'); }catch(e){}
    }, true);
"""

MARKUP_OLD = """      <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">Evens out songs that are mixed louder or quieter than others.</div>
    </div>
"""
MARKUP_NEW = """      <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">Evens out songs that are mixed louder or quieter than others.</div>

      <div style="margin-top:18px; display:flex; justify-content:space-between; align-items:center;">
        <span style="font-size:13px; color:var(--ink-dim);">Assistant duck</span>
        <button class="tab" id="assistantDuckToggle" style="padding:5px 12px; font-size:12px;">On</button>
      </div>
      <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">While an assistant is listening - the power-button one, or any app that takes the audio for a moment - the music drops to a low level instead of stopping, and comes back up when it is done. A phone call still pauses the song. Off keeps the old behaviour: the music holds its full level through everything but a call.</div>
    </div>
"""

BOOT_OLD = """      const autoVolRow = metaRows.find(r => r.key === 'autoVolume');
      setAutoVolume(autoVolRow ? !!autoVolRow.value : true);
"""
BOOT_NEW = """      const autoVolRow = metaRows.find(r => r.key === 'autoVolume');
      setAutoVolume(autoVolRow ? !!autoVolRow.value : true);
      // 80.0.1 - an untouched library gets the default (on), the same rule the two
      // rows around it use.
      const assistantDuckRow = metaRows.find(r => r.key === 'assistantDuck');
      setAssistantDuck(assistantDuckRow ? !!assistantDuckRow.value : true);
"""

EXPORT_OLD = """            autoVolumeEnabled: autoVolumeEnabled,
            seekStyle: seekStyle,
"""
EXPORT_NEW = """            autoVolumeEnabled: autoVolumeEnabled,
            assistantDuck: assistantDuckOn,
            seekStyle: seekStyle,
"""

IMPORT_OLD = """        if(manifest.settings.autoVolumeEnabled !== undefined){
          setAutoVolume(manifest.settings.autoVolumeEnabled);
        }
"""
IMPORT_NEW = """        if(manifest.settings.autoVolumeEnabled !== undefined){
          setAutoVolume(manifest.settings.autoVolumeEnabled);
        }
        // 80.0.1 - the assistant duck rides a backup like every other playback switch.
        if(manifest.settings.assistantDuck !== undefined){
          setAssistantDuck(manifest.settings.assistantDuck);
        }
"""

TRANSIENT_OLD = """          if(ev === 'lossTransient' && !scInCall()){
            recordPlaybackStop('focus-loss-transient ignored — no call in progress');
            scAskCallState();   // a call that started this instant re-pauses below
            try{ scUndoPlatformPause('another app took focus'); }catch(e){}
            return;
          }
"""
TRANSIENT_NEW = """          if(ev === 'lossTransient' && !scInCall()){
            recordPlaybackStop('focus-loss-transient ignored — no call in progress');
            scAskCallState();   // a call that started this instant re-pauses below
            // 80.0.1 - an assistant taking the audio for a moment is exactly what
            // this feature is for: the music steps back instead of stopping, and it
            // comes back up when the phone says the request is over. The revive below
            // still runs, because Chromium may already have paused the element over
            // this - and it now restores a DUCKED level, so a revive can never put
            // the song back at full volume over the assistant again.
            try{ scDuckForAssistant('another app took the audio for a moment'); }catch(e){}
            try{ scUndoPlatformPause('another app took focus'); }catch(e){}
            return;
          }
"""

REAL_LOSS_OLD = """          recordPlaybackStop('focus-' + ev + (scInCall() ? ' — a call is in progress' : ''));
          audioFocusInterrupted = true;
"""
REAL_LOSS_NEW = """          recordPlaybackStop('focus-' + ev + (scInCall() ? ' — a call is in progress' : ''));
          // 80.0.1 - a PERMANENT loss is another app keeping the audio, not an
          // assistant borrowing it for a moment, and this path stops the song below.
          // Any duck still being held from an earlier signal is dropped with it, or
          // the next play would come back up at the ducked level.
          try{ scUnduckForAssistant('the audio was lost'); }catch(e){}
          audioFocusInterrupted = true;
"""

STANDDOWN_OLD = """  function scStandDownForCall(){
    try{
      audioFocusInterrupted = true;
      audioFocusCallPause = true;
"""
STANDDOWN_NEW = """  function scStandDownForCall(){
    try{
      audioFocusInterrupted = true;
      audioFocusCallPause = true;
      // 80.0.1 - a call is not an assistant borrowing the audio for a moment, so a
      // duck that is being held when a call starts is dropped here. Without this the
      // call would pause the song and the resume at the end of it would come back up
      // at the ducked level.
      try{ scUnduckForAssistant('a call is in progress'); }catch(e){}
"""

DUCK_EVENT_OLD = """        }
        // 'duck' is deliberately ignored: this player has its own volume and
        // crossfade handling, so it keeps playing under a duck request instead of
        // fighting the system over the element's volume.
      });
"""
DUCK_EVENT_NEW = """        } else if(ev === 'duck'){
          // 80.0.1 - A DUCK IS THE SIGNAL THIS RELEASE IS ABOUT. Another app asking
          // the system to duck us - an assistant listening, a navigation prompt, a
          // voice note - is the moment the music should step back rather than stop.
          // The comment that used to sit here said a duck was ignored because this
          // player has its own volume handling; it does, and the duck now uses it,
          // through the master gain, so the crossfade's element volume is untouched.
          recordPlaybackStop('duck request — the music steps back');
          try{ scDuckForAssistant('another app asked the system to duck us'); }catch(e){}
          scAskCallState();   // a call that started this instant takes the pause path
        }
      });
"""

GAIN_OLD = """        } else if(ev === 'gain' || ev === 'gainTransient' || ev === 'gainTransientMayDuck'){
          audioFocusHeld = true;
"""
GAIN_NEW = """        } else if(ev === 'gain' || ev === 'gainTransient' || ev === 'gainTransientMayDuck'){
          audioFocusHeld = true;
          // 80.0.1 - the system saying the audio is ours again is the one honest
          // end-of-interruption signal there is, so the music comes straight back up
          // rather than waiting out the fallback window.
          try{ scUnduckForAssistant('the system handed the audio back'); }catch(e){}
"""

CONTROLLER_ANCHOR = """  function releaseAudioFocus(){
"""

VERSION_OLD = "  const APP_VERSION = '80.0';\n"
VERSION_NEW = "  const APP_VERSION = '80.0.1';\n"

CHANGELOG_OLD = "  const CHANGELOG = [\n"
CHANGELOG_NEW = "  const CHANGELOG = [\n" + ENTRY

SW_OLD = "const CACHE_NAME = 'sidecut-shell-v80.0';\n"
SW_NEW = "const CACHE_NAME = 'sidecut-shell-v80.0.1';\n"

EDITS = [
    ('APP_VERSION', 'index.html', VERSION_OLD, VERSION_NEW),
    ('CHANGELOG head entry', 'index.html', CHANGELOG_OLD, CHANGELOG_NEW),
    ('the master duck node', 'index.html', GRAPH_ANCHOR, GRAPH_NEW),
    ('the limiters land on it', 'index.html', DEST_OLD, DEST_NEW),
    ('the master node declaration', 'index.html', DECL_OLD, DECL_NEW),
    ('the failed-graph reset', 'index.html', CATCH_OLD, CATCH_NEW),
    ('the Assistant duck switch', 'index.html', MARKUP_OLD, MARKUP_NEW),
    ('the switch wiring', 'index.html',
     "  $('autoVolumeToggle').addEventListener('click', () => setAutoVolume(!autoVolumeEnabled));\n",
     "  $('autoVolumeToggle').addEventListener('click', () => setAutoVolume(!autoVolumeEnabled));\n" + DUCK_SETTINGS),
    ('the boot restore', 'index.html', BOOT_OLD, BOOT_NEW),
    ('the backup carries it', 'index.html', EXPORT_OLD, EXPORT_NEW),
    ('a restore brings it back', 'index.html', IMPORT_OLD, IMPORT_NEW),
    ('the duck controller', 'index.html', CONTROLLER_ANCHOR, DUCK_CONTROLLER + CONTROLLER_ANCHOR),
    ('the transient-loss hook', 'index.html', TRANSIENT_OLD, TRANSIENT_NEW),
    ('the permanent-loss unduck', 'index.html', REAL_LOSS_OLD, REAL_LOSS_NEW),
    ('the stand-down unduck', 'index.html', STANDDOWN_OLD, STANDDOWN_NEW),
    ('the duck event', 'index.html', DUCK_EVENT_OLD, DUCK_EVENT_NEW),
    ('the gain hook', 'index.html', GAIN_OLD, GAIN_NEW),
    ('the service-worker cache', 'sw.js', SW_OLD, SW_NEW),
]


def main():
    applied, present, missing = 0, 0, []
    for label, rel, old, new in EDITS:
        path = os.path.join(ROOT, rel)
        src = open(path, encoding='utf-8').read()
        if new in src:
            present += 1
            continue
        if src.count(old) != 1:
            missing.append('%s (%s: anchor found %d times)' % (label, rel, src.count(old)))
            continue
        if not CHECK:
            open(path, 'w', encoding='utf-8').write(src.replace(old, new, 1))
        applied += 1
        print('  applied: ' + label)
    for m in missing:
        print('  MISSING ANCHOR: ' + m)
    if CHECK:
        print('patch-8001 --check: %d to apply, %d already in place, %d anchors missing'
              % (applied, present, len(missing)))
        sys.exit(1 if (applied or missing) else 0)
    if missing:
        sys.exit('patch-8001: %d anchor(s) not found - nothing was written for them' % len(missing))
    print('patch-8001: %d applied, %d already in place' % (applied, present))


if __name__ == '__main__':
    main()
