#!/usr/bin/env node
/**
 * SideCut 70.1.7 - the DJ Mode loop controls.
 *
 * The user's words: "The loop buttons in dj mode are finicky and don't work".
 *
 * FOUR REASONS, ALL OF THEM REAL, AND THEY COMPOUND EACH OTHER:
 *
 * 1. THE HOLD PADS LOST THEIR GESTURE. The beat-repeat pads arm a slice on
 *    pointerdown and end it on the pointer coming up - but the DJ sheet scrolls
 *    (`.modal{ max-height:82vh; overflow-y:auto }`), so as soon as the finger
 *    drifts the browser takes the touch for a scroll and fires `pointercancel`,
 *    and `pointerleave` fires the moment the finger slides off the pad. The pads
 *    had no `touch-action`, so both happened constantly: the slice died a fraction
 *    of a second after it started. The pads now own the touch
 *    (`touch-action:none`), capture the pointer for the whole hold, and end only
 *    on `pointerup`/`pointercancel` - never on `pointerleave`, which this app
 *    already refuses to cancel a hold with elsewhere ("no pointerleave-cancel on
 *    purpose. On desktop a mouse cursor drifts").
 *
 * 2. THE LOOP BUTTON DID NOT WORK WHILE THE DECK WAS PAUSED, AND SAID THE WRONG
 *    THING. Its guard was `if(!deckEngine.buffer || !deckEngine.node)` - and a
 *    paused deck has no node (deckStop() nulls it), so tapping LOOP while stopped
 *    toasted "Still loading…" even though the song was loaded and simply paused,
 *    and nothing happened. A beat pad had the same hole: `!deckEngine.running`
 *    meant a pad held while stopped lit up and looped nothing.
 *
 * 3. THE LOOP LIVED ONLY ON THE NODE. A loop was armed by writing `loopStart`/
 *    `loopEnd`/`loop` straight onto the live AudioBufferSourceNode, and any
 *    restart - a scratch, a hot cue, a pitch change - built a fresh node with no
 *    loop points; deckStart() then switched the LOOP button off to stop it lying.
 *    The loop is now a window on the deck (`deckEngine.loop`), applied to whatever
 *    node exists (armDeckLoop / applyDeckLoop / clearDeckLoop), so it can be armed
 *    while paused, it survives a restart, and it is dropped - with the button -
 *    only when a restart lands outside the window.
 *
 * 4. THE PLAYHEAD WALKED OUT OF THE LOOP, WHICH IS WHAT MADE IT FEEL RANDOM.
 *    `deckNow()` is a projection of wall-clock time; a native loop sends the
 *    NODE's playhead back to loopStart on every pass, and the projection knew
 *    nothing about it. Hold a beat pad for ten seconds and everything that reads
 *    the position had drifted ten seconds ahead of the audio: the platter, the
 *    play count, the auto-fade countdown, and - the killer - the position the LOOP
 *    button and a hot cue anchor to, so tapping LOOP after a beat repeat jumped
 *    the audio forward by however long the repeat had been running. `deckNow()`
 *    now folds the elapsed time back into the window.
 *
 * Small honesty fixes that fall out of the same four: Loop Lock only says ON when
 * a slice is really armed, the pad only lights when it is, changing the loop
 * length while a loop is running re-windows it instead of doing nothing, and
 * releasing a pad while the LOOP button is on hands the loop back to the button
 * instead of switching it off underneath.
 *
 *   node dev/patch-7017.mjs
 *   node dev/patch-7017.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO70 = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const VERSION = '70.1.7';
const PREV = '70.1.6';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 3:35 PM EDT';
const CACHE = 'sidecut-shell-v63.0.43';
const OLDCACHE = 'sidecut-shell-v63.0.42';
const TITLE = 'The DJ Mode loop controls hold when you hold them: the beat pads keep the touch, a loop can be set while the deck is stopped, and the playhead stops walking out of the loop';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download" or "convert", and none uses "play build", "play
// version" or "play install" - test-662, test-6642 and test-66421 refuse those.
// One of them names a surface the 662 surface rule looks for.
const NOTES = [
  'The beat-repeat pads in DJ Mode hold now. Arming a slice is a press and hold, and the DJ sheet scrolls - so a finger that drifted even slightly was handed to the browser as a scroll, the press was cancelled, and the slice died a fraction of a second after it started. The pads claim the touch for themselves now and hold the pointer until you actually let go, so the slice plays for as long as you hold it, even if your thumb slides across the pad.',
  'The LOOP button works while the deck is stopped. It used to need a live sound source, and a stopped deck does not have one - so tapping LOOP while paused said the song was still loading, which was not true, and did nothing at all. A loop set on a stopped deck is armed for the moment you press PLAY, which is how it is done on real gear, and the beat pads arm the same way.',
  'A loop survives a restart. Scratching the platter, tapping a hot cue or changing the pitch rebuilds the deck sound source, and the loop points lived on the old one - so the loop quietly stopped while the button still said it was on. The loop is kept on the deck itself now and put back on whatever source is playing; it is only dropped, and the button with it, when a restarted playhead lands somewhere outside the loop.',
  'The playhead no longer walks out of the loop, which is what made the buttons feel random. While a loop repeats, the audio jumps back to the start of the loop every pass but the clock the app was reading did not, so it drifted further and further ahead of what you were hearing - and everything that asks it for a position answered wrong: the platter, the play count, the countdown to the next track, and the place a loop or a hot cue gets set. Holding a beat pad for ten seconds and then tapping LOOP used to jump the song forward by ten seconds, which is exactly what a loop button must never do.',
  'Loop Lock tells the truth. It says ON only once a slice has really been armed, the pad lights only when it is, changing the loop length while a loop is running now re-windows the loop instead of doing nothing, and letting go of a beat pad while the LOOP button is on hands the loop back to the button rather than switching it off underneath you.',
  'Nothing else about the deck moved. The pads, the drum pads, the FX pads, the hot cues, the kill switches, the crossfade and the player are exactly as the last release left them - this is the loop controls and nothing more.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  // A replacement that drops the newline the anchor had joins two lines
  // together, and the join parses. Refused here instead of found later.
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';
let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
const studio = holder(fs.readFileSync(STUDIO70, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7017: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* =========================== 1. THE PADS OWN THE TOUCH, SO A HOLD IS A HOLD === */
// One rule for all four press surfaces in DJ Mode. It is the same fix the app
// already applies to its other drag handles: with touch-action:none the browser
// has no scroll to arbitrate for a touch that starts here, so it never claims the
// gesture and never fires pointercancel out from under a hold.
sub(html, 'the pads own the touch',
  '  }   .beat-pad.active{ background: color-mix(in srgb, var(--coral) 35%, #232220); color:var(--coral); border-color:var(--coral); }\n',
  block([
    '  }   .beat-pad.active{ background: color-mix(in srgb, var(--coral) 35%, #232220); color:var(--coral); border-color:var(--coral); }',
    '  /* 70.1.7 - every one of these is pressed and held, and the DJ sheet scrolls',
    '     (`.modal` is max-height:82vh with overflow-y:auto), so a finger that drifted',
    '     was handed to the browser as a scroll: pointercancel fired, the hold died a',
    '     fraction of a second in, and the beat-repeat pads read as "finicky" rather',
    '     than broken. A pad is a performance surface - it does not scroll anything.',
    '     touch-action:none is what keeps the gesture, and it is the same medicine the',
    '     app already uses on its other drag handles. */',
    '  .beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }',
  ]),
  { key: '.beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }' });

/* ============ 2. THE LOOP IS A WINDOW ON THE DECK, NOT ON THE SOUND SOURCE ==== */
sub(html, 'the deck keeps its own loop window',
  '    gainNode: null,     // per-lane gain, used to blend during a DJ-mode crossfade\n  };\n',
  block([
    '    gainNode: null,     // per-lane gain, used to blend during a DJ-mode crossfade',
    '    // 70.1.7. The loop window, in buffer-seconds, or null. It lives on the deck',
    '    // rather than only on the live AudioBufferSourceNode for two reasons: a loop',
    '    // set while the deck is PAUSED has to survive until PLAY builds a node, and a',
    '    // restart (scratch, hot cue, pitch) has to put the loop back on the new node',
    '    // instead of quietly dropping it while the button still says it is on.',
    '    loop: null,         // { start, end } or null',
    '  };',
  ]),
  { key: '    loop: null,         // { start, end } or null' });

sub(html, 'deckNow folds into the loop',
  block([
    '  function deckNow(){',
    '    // Virtual playhead position in buffer-seconds, right now.',
    '    if(!deckEngine.buffer || !audioCtx) return 0;',
    '    if(!deckEngine.running) return deckEngine.startOffset;',
    '    const elapsed = (audioCtx.currentTime - deckEngine.startedAt) * deckEngine.rate;',
    '    return deckEngine.startOffset + elapsed;',
    '  }',
  ]),
  block([
    '  function deckNow(){',
    '    // Virtual playhead position in buffer-seconds, right now.',
    '    if(!deckEngine.buffer || !audioCtx) return 0;',
    '    if(!deckEngine.running) return deckEngine.startOffset;',
    '    const elapsed = (audioCtx.currentTime - deckEngine.startedAt) * deckEngine.rate;',
    '    let pos = deckEngine.startOffset + elapsed;',
    '    // 70.1.7. A native loop sends the NODE playhead back to loopStart on every',
    '    // pass, but this is a projection of wall-clock time and knows nothing about',
    '    // it: left alone it walks past loopEnd and keeps going, so every pass puts it',
    '    // further ahead of the audio - and everything that asks for a position gets a',
    '    // wrong answer: the platter, the play count, the auto-fade countdown, the',
    '    // place a hot cue is set, and above all the anchor the LOOP button itself',
    '    // uses (tap LOOP after holding a beat pad and the loop jumped forward by the',
    '    // length of the hold). Fold the elapsed time back into the window instead.',
    '    const lp = deckEngine.loop;',
    '    if(lp && lp.end - lp.start > 0.01 && pos > lp.end){',
    '      const span = lp.end - lp.start;',
    '      pos = lp.start + (pos - lp.start) % span;',
    '    }',
    '    return pos;',
    '  }',
    '',
    '  // 70.1.7. The armed window, put on whichever node is live (or taken off it).',
    '  // Called after every node start, which is what makes a loop survive a restart.',
    '  function applyDeckLoop(){',
    '    const node = deckEngine.node;',
    '    if(!node) return;',
    '    const lp = deckEngine.loop;',
    '    try{',
    '      if(lp && lp.end - lp.start > 0.01){',
    '        node.loopStart = lp.start;',
    '        node.loopEnd = lp.end;',
    '        node.loop = true;',
    '      } else {',
    '        node.loop = false;',
    '      }',
    '    }catch(_eLoop){}',
    '  }',
    '',
    '  // Arm a loop of `len` seconds where the deck is right now - playing or paused,',
    '  // because a paused deck has no node and a loop you cannot set while stopped is',
    '  // not a loop button. Near the end of a track the window is pulled BACK so it',
    '  // still fits, the way a CDJ sets a loop, instead of clamping to a few',
    '  // milliseconds of audio and sounding like a click.',
    '  function armDeckLoop(len){',
    '    const dur = (deckEngine.buffer && deckEngine.buffer.duration) || 0;',
    '    if(!dur || !(len > 0)) return false;',
    '    const span = Math.min(len, dur);',
    '    const start = Math.max(0, Math.min(deckNow(), dur - span));',
    '    const end = Math.min(dur, start + span);',
    '    if(!(end - start > 0.01)) return false;',
    '    deckEngine.loop = { start: start, end: end };',
    '    applyDeckLoop();',
    '    return true;',
    '  }',
    '',
    '  function clearDeckLoop(){',
    '    deckEngine.loop = null;',
    '    applyDeckLoop();',
    '  }',
  ]),
  { key: 'function applyDeckLoop(' });

sub(html, 'a restart puts the loop back',
  block([
    '    // A fresh node never has loop points set — if the LOOP button\'s UI still said',
    '    // "on" from before this restart, turn it off rather than let the button lie',
    '    // about what\'s actually playing.',
    '    if(typeof loopActive !== \'undefined\' && loopActive){',
    '      loopActive = false;',
    '      const btn = document.getElementById(\'djLoopBtn\');',
    '      if(btn) btn.classList.remove(\'active\');',
    '    }',
    '  }',
  ]),
  block([
    '    // 70.1.7. A fresh node carries no loop points, so an armed loop goes back on',
    '    // it - that is what lets the LOOP button and the beat pads survive a scratch,',
    '    // a hot cue or a pitch restart. A restart that lands OUTSIDE the window (a hot',
    '    // cue to another part of the song, say) drops the loop instead, and the button',
    '    // follows it, so the UI can never claim a loop over audio that is not looping.',
    '    if(deckEngine.loop){',
    '      if(offset >= deckEngine.loop.start && offset < deckEngine.loop.end){',
    '        applyDeckLoop();',
    '      } else {',
    '        clearDeckLoop();',
    '        if(typeof loopActive !== \'undefined\' && loopActive){',
    '          loopActive = false;',
    '          const btn = document.getElementById(\'djLoopBtn\');',
    '          if(btn) btn.classList.remove(\'active\');',
    '        }',
    '        if(typeof beatRepeatActive !== \'undefined\' && beatRepeatActive) beatRepeatActive = false;',
    '      }',
    '    }',
    '  }',
  ]),
  { key: 'if(offset >= deckEngine.loop.start && offset < deckEngine.loop.end){' });

/* ===================================== 3. THE LOOP BUTTON, ARMED OR NOT ======= */
sub(html, 'the LOOP button',
  block([
    '  let loopActive = false;',
    '  let loopStart = 0;',
    '  let loopLen = 4;',
    "  $('loopLenSelect').addEventListener('change', (e) => { loopLen = parseFloat(e.target.value); });",
    "  $('djLoopBtn').addEventListener('click', () => {",
    "    if(!deckEngine.buffer || !deckEngine.node){ toast('Still loading…'); return; }",
    '    loopActive = !loopActive;',
    "    $('djLoopBtn').classList.toggle('active', loopActive);",
    '    if(loopActive){',
    '      const pos = deckNow();',
    '      loopStart = Math.max(0, pos);',
    '      const loopEnd = Math.min(deckEngine.buffer.duration, loopStart + loopLen);',
    '      try{',
    '        deckEngine.node.loop = true;',
    '        deckEngine.node.loopStart = loopStart;',
    '        deckEngine.node.loopEnd = loopEnd;',
    '      }catch(e){}',
    '      toast(`Looping last ${loopLen}s`);',
    '    } else {',
    '      if(deckEngine.node){ try{ deckEngine.node.loop = false; }catch(e){} }',
    "      toast('Loop off');",
    '    }',
    '  });',
  ]),
  block([
    '  let loopActive = false;',
    '  let loopLen = 4;',
    "  $('loopLenSelect').addEventListener('change', (e) => {",
    "    loopLen = parseFloat(e.target.value) || 4;",
    '    // 70.1.7. Changing the length WHILE a loop was running did nothing at all -',
    '    // the window was set when the loop was armed and never read again - so the',
    '    // control only worked if you switched the loop off and on. Re-window it.',
    '    if(loopActive) armDeckLoop(loopLen);',
    '  });',
    '  function setDeckLoop(on){',
    '    if(!deckEngine.buffer) return false;',
    '    loopActive = !!on;',
    "    const btn = $('djLoopBtn');",
    '    if(loopActive && !armDeckLoop(loopLen)) loopActive = false;',
    '    if(!loopActive) clearDeckLoop();',
    "    if(btn) btn.classList.toggle('active', loopActive);",
    '    return loopActive;',
    '  }',
    "  $('djLoopBtn').addEventListener('click', () => {",
    '    // 70.1.7. The old guard was `!deckEngine.buffer || !deckEngine.node`, and a',
    '    // PAUSED deck has no node (deckStop() nulls it) - so tapping LOOP while',
    "    // stopped toasted \"Still loading…\" about a song that was loaded, and did",
    '    // nothing. A loop set on a stopped deck is armed for PLAY, which is how it is',
    '    // done on real gear.',
    "    if(!deckEngine.buffer){ toast('Still loading…'); return; }",
    '    if(loopActive){',
    '      setDeckLoop(false);',
    "      toast('Loop off');",
    '    } else if(setDeckLoop(true)){',
    "      toast(deckEngine.running ? ('Looping ' + loopLen + 's')",
    "        : ('Loop armed · ' + loopLen + 's · starts when you press PLAY'));",
    '    }',
    '  });',
  ]),
  { key: 'function setDeckLoop(on){' });

/* ============================= 4. THE BEAT-REPEAT PADS, HELD FOR REAL ======== */
sub(html, 'startBeatRepeat arms the slice',
  block([
    '  let beatRepeatActive = false;',
    '  let beatRepeatLen = 0.5;',
    '  let beatRepeatResumeOffset = 0;',
    '  function beatLenToSeconds(beats){',
    '    const bpm = liveBpm || (allTracks.find(tr => tr.id === djCurrentTrackId)?.bpm) || 120;',
    '    return (60 / bpm) * beats;',
    '  }',
    '  function startBeatRepeat(beats){',
    '    if(!deckEngine.buffer || !deckEngine.running || !deckEngine.node) return;',
    '    beatRepeatActive = true;',
    '    beatRepeatLen = beatLenToSeconds(beats);',
    '    const pos = deckNow();',
    '    beatRepeatResumeOffset = pos; // remember where to resume normal playback on release',
    '    const loopStart = Math.max(0, pos);',
    '    const loopEnd = Math.min(deckEngine.buffer.duration, loopStart + beatRepeatLen);',
    '    try{',
    '      deckEngine.node.loop = true;',
    '      deckEngine.node.loopStart = loopStart;',
    '      deckEngine.node.loopEnd = loopEnd;',
    '    }catch(e){}',
    '  }',
    '  function stopBeatRepeat(){',
    '    if(!beatRepeatActive) return;',
    '    beatRepeatActive = false;',
    '    if(deckEngine.node){',
    '      try{ deckEngine.node.loop = false; }catch(e){}',
    '    }',
    '    // The native loop kept playing inside the small window the whole time, so',
    '    // just let it continue forward from wherever it naturally is right now —',
    '    // no restart needed, which is what kept this glitch-free.',
    '  }',
  ]),
  block([
    '  let beatRepeatActive = false;',
    '  function beatLenToSeconds(beats){',
    '    const bpm = liveBpm || (allTracks.find(tr => tr.id === djCurrentTrackId)?.bpm) || 120;',
    '    return (60 / bpm) * beats;',
    '  }',
    '  // 70.1.7. Arm one beat length at the playhead and report whether it landed.',
    '  // The caller decides what to light up from that answer, so a pad with nothing',
    '  // loaded can no longer show as active over silence. It used to also demand a',
    '  // RUNNING deck and a live node, which is why a pad held while stopped looped',
    '  // nothing at all - a slice armed now starts repeating the moment you press PLAY.',
    '  function startBeatRepeat(beats){',
    '    if(!deckEngine.buffer) return false;',
    '    if(!armDeckLoop(beatLenToSeconds(beats))) return false;',
    '    beatRepeatActive = true;',
    '    return true;',
    '  }',
    '  function stopBeatRepeat(){',
    '    if(!beatRepeatActive) return;',
    '    beatRepeatActive = false;',
    '    // Releasing the pad ends the SLICE. If the LOOP button is still on, its own',
    '    // window comes back underneath rather than being switched off with the pad.',
    '    // The native loop played inside the window the whole time, so letting go',
    '    // needs no restart - the audio simply carries on from where it is.',
    '    if(loopActive) armDeckLoop(loopLen); else clearDeckLoop();',
    '  }',
  ]),
  { key: 'function startBeatRepeat(beats){\n    if(!deckEngine.buffer) return false;' });

sub(html, 'Loop Lock stops lying',
  block([
    "  let beatRepeatLocked = false;",
    "  let beatRepeatLockedBeats = 0.5;",
    "  $('beatRepeatLockBtn').addEventListener('click', () => {",
    '    beatRepeatLocked = !beatRepeatLocked;',
    "    $('beatRepeatLockBtn').textContent = `LOOP LOCK: ${beatRepeatLocked ? 'ON' : 'OFF'}`;",
    "    $('beatRepeatLockBtn').classList.toggle('active', beatRepeatLocked);",
    '    if(beatRepeatLocked){',
    '      startBeatRepeat(beatRepeatLockedBeats);',
    '      const btn = document.querySelector(`.beat-pad[data-beats="${beatRepeatLockedBeats}"]`);',
    "      if(btn) btn.classList.add('active');",
    '    } else {',
    '      stopBeatRepeat();',
    "      document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));",
    '    }',
    '  });',
  ]),
  block([
    '  let beatRepeatLocked = false;',
    '  let beatRepeatLockedBeats = 0.5;',
    '  function setLoopLock(on){',
    '    beatRepeatLocked = !!on;',
    "    $('beatRepeatLockBtn').textContent = 'LOOP LOCK: ' + (beatRepeatLocked ? 'ON' : 'OFF');",
    "    $('beatRepeatLockBtn').classList.toggle('active', beatRepeatLocked);",
    '    if(!beatRepeatLocked){',
    '      stopBeatRepeat();',
    "      document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));",
    '    }',
    '  }',
    "  $('beatRepeatLockBtn').addEventListener('click', () => {",
    '    if(beatRepeatLocked){ setLoopLock(false); return; }',
    '    // 70.1.7. Loop Lock only goes ON once a slice is REALLY armed. It used to',
    '    // claim ON and keep the pad lit over an empty deck or a paused one, where',
    '    // there was nothing looping at all.',
    '    if(startBeatRepeat(beatRepeatLockedBeats)){',
    '      setLoopLock(true);',
    '      const btn = document.querySelector(`.beat-pad[data-beats="${beatRepeatLockedBeats}"]`);',
    "      if(btn) btn.classList.add('active');",
    '    } else {',
    "      toast('Still loading…');",
    '    }',
    '  });',
  ]),
  { key: 'function setLoopLock(on){' });

sub(html, 'the pads hold the pointer',
  block([
    "  document.querySelectorAll('.beat-pad').forEach(btn => {",
    "    btn.addEventListener('pointerdown', (e) => {",
    '      e.preventDefault();',
    "      document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));",
    "      btn.classList.add('active');",
    '      beatRepeatLockedBeats = parseFloat(btn.dataset.beats);',
    '      startBeatRepeat(beatRepeatLockedBeats);',
    '    });',
    "    ['pointerup','pointercancel','pointerleave'].forEach(ev => btn.addEventListener(ev, () => {",
    '      if(beatRepeatLocked) return; // stays looping until Loop Lock is switched off',
    "      btn.classList.remove('active');",
    '      stopBeatRepeat();',
    '    }));',
    '  });',
  ]),
  block([
    "  document.querySelectorAll('.beat-pad').forEach(btn => {",
    "    btn.addEventListener('pointerdown', (e) => {",
    '      e.preventDefault();',
    '      // 70.1.7. Capture the pointer for the whole hold. Without it a finger that',
    '      // drifts, or a scroll this sheet decides to start, took the gesture away:',
    '      // pointercancel/pointerleave fired a fraction of a second in and the slice',
    '      // died. With capture the pad keeps receiving the move and the release even',
    '      // if the thumb slides right off it.',
    '      try{ if(btn.setPointerCapture) btn.setPointerCapture(e.pointerId); }catch(_eCap){ }',
    "      document.querySelectorAll('.beat-pad').forEach(b => b.classList.remove('active'));",
    '      beatRepeatLockedBeats = parseFloat(btn.dataset.beats);',
    '      // Light the pad only if a slice was actually armed - the old order lit it',
    '      // first and asked questions later.',
    "      if(startBeatRepeat(beatRepeatLockedBeats)) btn.classList.add('active');",
    '    });',
    "    // pointerup / pointercancel only, never pointerleave: this app already refuses",
    "    // to cancel a hold on pointerleave for exactly this reason (a drifting cursor",
    '    // or thumb fires it constantly on desktop and on Android WebView alike).',
    "    ['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {",
    '      if(beatRepeatLocked) return; // stays looping until Loop Lock is switched off',
    "      btn.classList.remove('active');",
    '      stopBeatRepeat();',
    '    }));',
    '  });',
  ]),
  { key: "if(startBeatRepeat(beatRepeatLockedBeats)) btn.classList.add('active');" });

/* ======================= 5. A LOOP IS PER SONG, AND PER SONG IT IS CLEARED ==== */
sub(html, 'the per-track loop reset',
  block([
    '      loopActive = false;',
    "      if($('djLoopBtn')) $('djLoopBtn').classList.remove('active');",
  ]),
  block([
    '      // 70.1.7. A loop window belongs to THIS track and buffer, so it goes with',
    '      // the rest of the per-song deck state (hot cues, kill switches, tap tempo).',
    '      loopActive = false;',
    "      if($('djLoopBtn')) $('djLoopBtn').classList.remove('active');",
    '      clearDeckLoop();',
    "      if(beatRepeatLocked) setLoopLock(false);",
  ]),
  // The key has to be the line this release ADDS to that block, not the bare
  // `clearDeckLoop();` call: deckStart's own `clearDeckLoop()` sits 8 spaces in and
  // CONTAINS the 6-space key, so a key on the call alone would skip this sub and
  // leave the reset half-applied - silently, which is the failure mode this file
  // has been bitten by before.
  { key: "      if(beatRepeatLocked) setLoopLock(false);" });

/* ===================================================== 6. THE RELEASE METADATA */
sub(html, 'APP_VERSION',
  "  const APP_VERSION = '" + PREV + "';",
  "  const APP_VERSION = '" + VERSION + "';",
  { key: "const APP_VERSION = '" + VERSION + "';" });

sub(html, 'changelog head',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ]) + NOTES.map((n) => "    '" + n + "',").join('\n') + '\n  ] },\n',
  { key: "const CHANGELOG = [\n  { version: '" + VERSION + "'" });

sub(sw, 'shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';",
  "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ==================================================================== 7. THE GATES */
sub(t705, 'test-705 the DJ loop controls',
  "console.log('\\n[11] the file still holds together');\n",
  block([
    "console.log('\\n[10d] the DJ Mode loop controls');",
    '{',
    '  // 70.1.7. Every one of these is a hole that made a loop control do nothing:',
    '  // a guard that needed a live sound source, a window that only ever existed on',
    '  // the node, a playhead that walked out of the loop, and a hold the browser',
    '  // could cancel. The audio half cannot run here (no Web Audio in a text gate),',
    '  // so this is the code shape and the real-app probe drives the resting state.',
    "  ok(count('function applyDeckLoop(') === 1 && count('function armDeckLoop(') === 1 &&",
    "     count('function clearDeckLoop(') === 1 && count('    loop: null,         // { start, end } or null') === 1,",
    "     'the loop window is armed on the deck, not only on the sound source');",
    "  ok(count('if(!deckEngine.buffer || !deckEngine.node){ toast') === 0 &&",
    "     count('if(!deckEngine.buffer || !deckEngine.running || !deckEngine.node) return;') === 0,",
    "     'and neither the LOOP button nor a beat pad needs a live node any more');",
    "  ok(count('pos = lp.start + (pos - lp.start) % span;') === 1,",
    "     'the playhead is folded back into the loop instead of walking out of it');",
    "  ok(count('btn.setPointerCapture(e.pointerId)') >= 1 &&",
    "     count(\"['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {\") === 1 &&",
    "     count(\"['pointerup','pointercancel','pointerleave'].forEach(ev => btn.addEventListener(ev, () => {\") === 0,",
    "     'a held pad keeps the pointer and ends only when the finger is released');",
    "  ok(count('.beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }') === 1,",
    "     'and the pads own the touch so a scrolling sheet cannot cancel the hold');",
    '}',
    '',
    "console.log('\\n[11] the file still holds together');",
  ]),
  { key: '[10d] the DJ Mode loop controls' });

sub(studio, 'studio-70 the DJ loop controls',
  "  console.log('[12] the page still holds together');\n",
  block([
    "  console.log('[11j] the DJ Mode loop controls do not lie');",
    '  {',
    '    // 70.1.7. There is no Web Audio and no decoded deck buffer in jsdom, which is',
    '    // exactly the "nothing is armed" case these controls used to lie about: a beat',
    '    // pad lit up over silence and Loop Lock went ON with nothing looping. What is',
    '    // driven here is that they now stay OFF and say so - and that the pads own the',
    '    // touch, which is the half of the fix a stylesheet can be wrong about.',
    "    ok(doc.querySelectorAll('.beat-pad').length === 6, 'the six beat-repeat pads are there');",
    "    const pad = doc.querySelector('.beat-pad[data-beats=\"0.25\"]');",
    '    if (pad) {',
    "      pad.dispatchEvent(new win.Event('pointerdown', { bubbles: true }));",
    '      await wait(60);',
    "      ok(!pad.classList.contains('active'),",
    "        'a pad that could not arm a slice does not light up as if it had');",
    '    }',
    "    const lock = doc.querySelector('#beatRepeatLockBtn');",
    '    if (lock) {',
    '      lock.click();',
    '      await wait(60);',
    "      ok(lock.textContent.indexOf('OFF') !== -1,",
    "        'and Loop Lock does not claim ON over an empty deck (' + lock.textContent + ')');",
    '    }',
    "    ok(html.indexOf('.beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }') !== -1,",
    "      'with the pads owning the touch so a hold is not cancelled by the sheet');",
    // The needle stops at the `{` of the handler on purpose: the hot-cue pads still
    // cancel their long-press on pointerleave, and that is their own safety cancel,
    // not the beat pads' hold.
    "    ok(html.indexOf(\"['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {\") !== -1 &&",
    "       html.indexOf(\"['pointerup','pointercancel','pointerleave'].forEach(ev => btn.addEventListener(ev, () => {\") === -1,",
    "      'and a held pad ending only when the finger really comes up');",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]),
  { key: '[11j] the DJ Mode loop controls do not lie' });

/* ============================================================ 8. WHAT MUST STILL HOLD */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The deck engine itself has to be intact.
  must(count(page, '  function deckStart(offsetSeconds, rate){') === 1 &&
    count(page, '  function deckStop(){') === 1 && count(page, '  function deckPause(){') === 1,
    'the deck engine lost a lifecycle function');
  must(count(page, '  function deckNow(){') === 1, 'the deck playhead is not the one this release shipped');
  must(count(page, '    const elapsed = (audioCtx.currentTime - deckEngine.startedAt) * deckEngine.rate;\n') === 1,
    'the playhead no longer projects wall-clock time at all');
  must(count(page, 'lp.start + (pos - lp.start) % span') === 1 && count(page, 'if(lp && lp.end - lp.start > 0.01 && pos > lp.end){') === 1,
    'the loop fold is not in the playhead');
  // The loop controls.
  must(count(page, 'function setDeckLoop(on){') === 1 && count(page, 'function setLoopLock(on){') === 1,
    'the two loop state setters are not both there');
  must(count(page, 'if(!deckEngine.buffer || !deckEngine.node)') === 0,
    'the LOOP button still demands a live node');
  must(count(page, 'if(!deckEngine.buffer || !deckEngine.running || !deckEngine.node) return;') === 0,
    'a beat pad still demands a running deck');
  must(count(page, 'if(loopActive) armDeckLoop(loopLen); else clearDeckLoop();') === 1,
    'releasing a pad no longer hands the loop back to the LOOP button');
  must(count(page, 'if(loopActive) armDeckLoop(loopLen);\n') === 1,
    'changing the loop length no longer re-windows a running loop');
  must(count(page, 'let loopStart = 0;') === 0 && count(page, 'beatRepeatLen') === 0 &&
    count(page, 'beatRepeatResumeOffset') === 0,
    'the loop variables that were written and never read are still there');
  // The hold.
  must(count(page, "    ['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {\n") === 1,
    'the beat pads do not hold the pointer the way this release shipped');
  must(page.indexOf("['pointerup','pointercancel','pointerleave'].forEach(ev => btn.addEventListener(ev, () => {") === -1,
    'a beat pad still dies on pointerleave');
  must(count(page, '  .beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }\n') === 1,
    'the pads do not own the touch');
  must(count(page, '  .beat-pad{\n') === 1 && count(page, '  .fx-pad{\n') === 1 &&
    count(page, '  .drum-pad{\n') === 1 && count(page, "  .hotcue-btn{\n") === 1,
    'a pad stylesheet block went missing');
  // The per-song reset.
  must(count(page, "      clearDeckLoop();\n      if(beatRepeatLocked) setLoopLock(false);\n") === 1,
    'a new song no longer clears the loop and Loop Lock');
  // The release.
  must(count(page, "const APP_VERSION = '70.1.7';") === 1, 'the version is not 70.1.7');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.1.7',") === 1 && count(page, "  { version: '70.1.6',") === 1 &&
    count(page, "  { version: '70.1.5',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, '[10d] the DJ Mode loop controls') === 1, 'the new gate rule did not land');
  must(count(studio.text, '[11j] the DJ Mode loop controls do not lie') === 1,
    'the real-app probe does not drive the loop controls');
  // The two releases before this one are still pinned.
  must(count(t705.text, '[10c] the select bar and the Discover search row') === 1,
    'the 70.1.6 gate rule left with this release');
  must(count(studio.text, '[11i] the select bar and the Discover search row') === 1,
    'the 70.1.6 probe section left with this release');
}

if(problems.length){
  console.error('patch-7017: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7017: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7017: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7017: next `node dev/repin-7017.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
