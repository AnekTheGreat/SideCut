#!/usr/bin/env python3
"""80.3.1 - a song that stops in its first seconds comes back, and the banner stops blaming the helper.

The owner, with a screenshot of the page reading:

  "SideCut error: Playback stopped while it was starting, so the audio-focus helper
   has been switched off - songs play normally now. It comes back in the next update."

and, behind it, a song parked at 0:02 with the play button waiting. Two things are wrong
in that picture, and only one of them is the banner.

1. THE INTERRUPTION MEMORY NEVER ENDED. `audioFocusInterrupted` is set when the system
   says the audio was taken (a call, another app keeping the speakers) and it is what
   tells `scUndoPlatformPause` / the heartbeat / `scSecondLook` to BELIEVE an automatic
   pause instead of undoing it. It was cleared only by a focus GAIN, by a call ending, or
   by `scTransportResume()` - the lock-screen / notification / widget doors - and NOT by
   the app's own play button, which is the door the owner uses. So after one real
   interruption the app spent the rest of the session believing every pause: press play,
   something pauses the song a couple of seconds in, and nothing puts it back. That is
   the song parked at 0:02. A start that is not our own automatic repair is the user
   asking for sound, so it now ends the memory - the app's button included, and not while
   a call is really up.

2. THE OUTSIDE PAUSE HAD A 1.2-SECOND WINDOW. `blockSpuriousStop` refuses a stale
   lock-screen / notification pause, but it gave up after 1.2 s of the song and 0.5 s of
   playhead - shorter than the hand-over with the phone's media session takes. It now
   covers the first four seconds (2.5 s of playhead) and up to three presses, so a stale
   press cannot silence a song that has only just started, while a real second press is
   still obeyed.

3. THE BANNER. It switched the audio-focus helper off for the rest of the version when a
   death was recorded during "starting playback". That helper has not asked Android for
   audio focus since 58.8.4 - asking is what made Chromium pause its own element - so it
   is not in the play path and cannot be the thing that stops playback; switching it off
   only cost the app `callState()` (a call pausing the song) and `duckState()` (the
   assistant duck). It is no longer switched off, and the banner says what is known.

4. A RELOAD IS NOT A CRASH. The same banner fired for a page that had simply reloaded
   itself - an update hand-over, a refresh, a WebView restart - because the recorder only
   forgave a restart within 30 s of the previous boot. The browser reports the difference
   (`PerformanceNavigationTiming.type === 'reload'`), so a reloading boot is never
   reported as a death.

Idempotent: the marker is this release's banner comment in the page.

    python3 dev/patch-8031.py
    python3 dev/patch-8031.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
VERSION = '80.3.1'
OLD_VERSION = '80.3'
MARKER = '  // \u2500\u2500\u2500 80.3.1 - A START THAT IS NOT OUR OWN REPAIR ENDS THE INTERRUPTION'

# ---------------------------------------------------------------------------
# 1. THE RECORDER LEARNS WHAT A RELOAD IS.
# ---------------------------------------------------------------------------
RELOAD_OLD = """      if(_scLast && _scLast.op){
        var _scAge = Date.now() - (_scLast.at || 0);
        var _scRestart = !!(_scPrevBoot && (Date.now() - _scPrevBoot) < 30000);
"""

RELOAD_NEW = """      // 80.3.1 - A RELOAD IS NOT A DEATH. An update hand-over, a refresh, a WebView
      // restart: the page comes back through the same boot, so the marker the previous
      // session left is read here as a death that never happened - which is why the
      // "playback stopped while it was starting" banner kept coming back after an
      // update. The browser reports the difference itself, so ask it instead of
      // inferring it from timings: a navigation whose type is `reload` is this app
      // loading itself again, and nothing died.
      var _scReload = false;
      try{
        var _scNavEntries = (performance.getEntriesByType ? performance.getEntriesByType('navigation') : null);
        var _scNavEntry = _scNavEntries && _scNavEntries[0];
        if(_scNavEntry && _scNavEntry.type){ _scReload = _scNavEntry.type === 'reload'; }
        else if(performance.navigation){ _scReload = performance.navigation.type === 1; }
      }catch(e){ }
      if(_scLast && _scLast.op){
        var _scAge = Date.now() - (_scLast.at || 0);
        var _scRestart = !!(_scPrevBoot && (Date.now() - _scPrevBoot) < 30000);
"""

NORMAL_OLD = """        var _scNormalDeath = _scRestart
          || (_scLeftAt && _scLeftAt >= (_scLast.at || 0))
"""

NORMAL_NEW = """        var _scNormalDeath = _scRestart
          || _scReload
          || (_scLeftAt && _scLeftAt >= (_scLast.at || 0))
"""

# ---------------------------------------------------------------------------
# 2. THE BANNER STOPS SWITCHING THE HELPER OFF.
# ---------------------------------------------------------------------------
BANNER_OLD = """        if(!_scNormalDeath){
          setTimeout(function(){ __scShowBootError('The app previously crashed during: ' + _scLast.op + ' — screenshot this message'); }, 1200);
          if(_scLast.op === 'starting playback'){
            // A death in the opening moments of playback is the riskiest point of
            // the whole play path, and the only NATIVE call in it is the injected
            // audio-focus helper. Switch it off for THIS build (a newer build is
            // assumed to have fixed it and re-enables it automatically) so it can
            // never block playback twice, and say so once.
            try{ localStorage.setItem('sidecut_audiofocus_off', JSON.stringify({ off: true, v: APP_VERSION })); }catch(e){}
            setTimeout(function(){ __scShowBootError('Playback stopped while it was starting, so the audio-focus helper has been switched off — songs play normally now. It comes back in the next update.'); }, 2000);
          }
"""

BANNER_NEW = """        if(!_scNormalDeath){
          // 80.3.1 - THE HELPER IS NOT SWITCHED OFF ANY MORE. This block used to write
          // `sidecut_audiofocus_off` for the rest of the version whenever a death was
          // recorded during "starting playback", on the guess that the injected
          // audio-focus helper was to blame. That guess cannot be right: the helper has
          // not asked Android for audio focus since 58.8.4 (`AUDIO_FOCUS_REQUESTS_OFF`),
          // because asking is what made Chromium pause our own element - so there is no
          // focus call in the play path to blame. What switching it off DID do was take
          // away `callState()` and `duckState()`, i.e. a real call no longer paused the
          // song and the assistant could no longer be ducked for. The death is still
          // reported (that is what the recorder is for), and the helper stays.
          if(_scLast.op === 'starting playback'){
            // No version in the record: APP_VERSION is a const declared further down
            // this page, so naming it here throws before anything is written - the same
            // trap 73.4.7 found in the media-notification recorder.
            try{ localStorage.setItem('sidecut_playback_stopped_at_start', JSON.stringify({ at: Date.now() })); }catch(e){}
            setTimeout(function(){ __scShowBootError('The app was closed suddenly while a song was starting — everything still plays. Tap to dismiss.'); }, 1200);
          } else {
            setTimeout(function(){ __scShowBootError('The app previously crashed during: ' + _scLast.op + ' — screenshot this message'); }, 1200);
          }
"""

# ---------------------------------------------------------------------------
# 3. THE INTERRUPTION MEMORY, AND WHAT ENDS IT.
# ---------------------------------------------------------------------------
LATCH_OLD = """  // Set while WE were paused by a focus loss — not by the user. Only then do we put
  // the song back when the interruption is over.
  let audioFocusInterrupted = false;
"""

LATCH_NEW = MARKER + """
  // Set while WE were paused by a focus loss — not by the user. Only then do we put
  // the song back when the interruption is over.
  let audioFocusInterrupted = false;
  // 80.3.1 - AND A START OF YOUR OWN ENDS IT. This latch was cleared only by a focus
  // GAIN, by a call ending, or by `scTransportResume()` (the lock-screen, notification
  // and widget doors). The app's own play button never cleared it, so after one real
  // interruption every later pause in that session was BELIEVED and never undone: press
  // play, something pauses the song two seconds in, and the song stayed parked at 0:02
  // for the rest of the session. A start that is not our own automatic repair is the
  // user asking for sound, so it drops the latch - see onPlayEvt.
  let audioFocusInterruptedAt = 0;   // when it was set (0 = never)
"""

CALL_STAND_OLD = """  function scStandDownForCall(){
    try{
      audioFocusInterrupted = true;
      audioFocusCallPause = true;
"""

CALL_STAND_NEW = """  function scStandDownForCall(){
    try{
      audioFocusInterrupted = true;
      audioFocusInterruptedAt = Date.now();
      audioFocusCallPause = true;
"""

LOSS_OLD = """          audioFocusInterrupted = true;
          if(scInCall()) audioFocusCallPause = true;
"""

LOSS_NEW = """          audioFocusInterrupted = true;
          audioFocusInterruptedAt = Date.now();
          if(scInCall()) audioFocusCallPause = true;
"""

PLAY_OLD = """    userPaused = false; // playback is (re)starting — clear any prior deliberate-stop marker
    scStartCallWatch();
"""

PLAY_NEW = """    userPaused = false; // playback is (re)starting — clear any prior deliberate-stop marker
    // 80.3.1 - A START THAT IS NOT OUR OWN REPAIR IS THE USER ASKING FOR SOUND, so the
    // memory of an old interruption must not outlive it. Everything that starts playback
    // from outside already says this (`scTransportResume`), and the app's own play button
    // did not - which is the door the owner uses, and why one interruption used to park
    // every later song. `revivingAudio` is our own automatic repair, and a call that is
    // really up is a fact that outranks the press, so neither clears it.
    if(!revivingAudio && !scInCall()){
      audioFocusInterrupted = false;
      audioFocusInterruptedAt = 0;
      audioFocusCallPause = false;
    }
    scStartCallWatch();
"""

# ---------------------------------------------------------------------------
# 4. THE OUTSIDE PAUSE IN A SONG'S FIRST SECONDS.
# ---------------------------------------------------------------------------
WINDOW_OLD = """      if(msSincePlayStarted() > 1200) return false;
      if((a.currentTime || 0) > 0.5) return false;   // audio really did play
      if(spuriousStopsBlocked >= 2) return false;    // never fight forever
"""

WINDOW_NEW = """      // 80.3.1 - FOUR SECONDS, NOT ONE. The hand-over with the phone's media session
      // (the notification is rebuilt, the session is re-registered, the WebView's own
      // session changes hands) takes longer than 1.2 s, and a stale pause that landed
      // after this window was obeyed as if a finger had pressed it - the "press play, the
      // song stops at 0:02" report. A pause in the first four seconds, before 2.5 s of
      // audio has played, is still the hand-over: refuse it, and a second press is obeyed
      // (three refusals per attempt at most, so this can never fight a finger for long).
      if(msSincePlayStarted() > 4000) return false;
      if((a.currentTime || 0) > 2.5) return false;   // audio really did play
      if(spuriousStopsBlocked >= 3) return false;    // never fight forever
"""

# ---------------------------------------------------------------------------
# 5. THE LATCH IS READABLE FROM OUTSIDE, for the harness that drives this release.
# ---------------------------------------------------------------------------
PROBE_OLD = """  window.__scInCall = scInCall;
"""

PROBE_NEW = """  window.__scInCall = scInCall;
  // Published for the harness that drives this release: is the app still standing down
  // for an interruption? A session that answers `true` after a start of the user's own
  // is the parked-at-0:02 bug.
  window.__scFocusLatch = function(){ return audioFocusInterrupted; };
"""

# ---------------------------------------------------------------------------
# 6. THE CHANGELOG HEAD, directly above the previous release.
# ---------------------------------------------------------------------------
CHANGELOG_ANCHOR = "  { version: '80.3', date:"
CHANGELOG_HEAD = """  { version: '80.3.1', date: 'October 26, 2026 \u00b7 8:20 AM EDT', title: 'A song that stops in its first seconds is put back, and the crash banner stops switching a helper off', items: [
    'A song that stops a second or two after you press play is put back again. The app remembers an interruption \u2014 a call, another app taking the audio \u2014 and it never forgot it, so every later stop was believed instead of undone and a song could stay parked at 0:02 waiting for you.',
    'Pressing play is you asking for sound, whichever way you press it: the app\u2019s own button, the lock screen, the notification, the widget. All of them end that memory now, so the app stops protecting a song that nothing is holding.',
    'An outside pause in the first seconds of a song is no longer obeyed. The guard that refuses a stale lock-screen pause gave up after 1.2 seconds \u2014 shorter than the hand-over with the phone\u2019s media session takes \u2014 and covers the first four seconds now, recording what it refused.',
    'The "playback stopped while it was starting" banner no longer switches the audio-focus helper off. It has not asked for audio focus since 58.8.4, so it is not in the play path, and switching it off only cost the app its call detection and the assistant duck. It stays on.',
    'That banner also stops appearing for a page that simply reloaded itself, which is what an update hand-over and a refresh are. The app now asks the browser whether this boot is a reload, and a reload is never reported as a crash.',
    'A death during "starting playback" is still recorded, and still says so once, in plain words, instead of stacking two messages on the screen.',
  ],
    details: [
      'scUndoPlatformPause, the 30-second heartbeat and scSecondLook all refuse to undo a platform pause while `audioFocusInterrupted` is set. That latch was cleared by a focus GAIN, by `scNoteCallState(false)` after a call, and by `scTransportResume()` \\u2014 which only the media-session play, previous and next handlers call. The app\\u2019s own play/pause button called `a.play()` and nothing else, so `onPlayEvt` ran with the latch still set and every opening-seconds pause after it was believed: the song parked at 0:02, and no revive, second look or heartbeat could touch it. onPlayEvt now clears the latch when the start is not `revivingAudio` and no call is up, and stamps `audioFocusInterruptedAt` wherever it is set.',
      'The call case is why the guard exists, and it still wins: `scInCall()` is checked before the latch is dropped, and a real call (which publishes its own fact) re-latches it on the next poll, so music still stands down for a call and still comes back when the call ends.',
      'blockSpuriousStop refused a stale media-session pause only within 1.2 s of the start and 0.5 s of playhead, which is shorter than the notification/session hand-over on the installed app. It now refuses within 4 s and 2.5 s of playhead, up to three per attempt, recording each refusal as `refused-auto-pause-media-session`. A genuine second press is obeyed as it always was.',
      'The recorder read `_scRestart` only as "the previous boot was less than 30 s ago", so a page that reloaded mid-song (an update hand-over, a refresh, a WebView restart) left its `starting playback` marker behind and the next boot reported a crash. It now reads `PerformanceNavigationTiming.type`, which is `reload` for exactly that case, with `performance.navigation.type === 1` as the fallback, and a reload counts as a normal death.',
      'The banner used to write `sidecut_audiofocus_off` for the rest of the version, which made `capAudioFocus` null for the session: no focus listener, no `callState()`, no `duckState()`. Since `AUDIO_FOCUS_REQUESTS_OFF` has been true since 58.8.4, there is no focus request in the play path for that helper to be blamed for, so the switch-off bought nothing and cost a real call pausing the song. It is gone; the death is written to `sidecut_playback_stopped_at_start` instead, and the banner no longer stacks a second message on the screen.',
    ],
  },
"""


def swap(src, old, new, what, times=1):
    if src.count(old) != times:
        raise SystemExit('patch-8031: %s appears %d times, expected %d' % (what, src.count(old), times))
    return src.replace(old, new)


def apply_all(src):
    src = swap(src, RELOAD_OLD, RELOAD_NEW, 'the recorder boot block')
    src = swap(src, NORMAL_OLD, NORMAL_NEW, 'the normal-death test')
    src = swap(src, BANNER_OLD, BANNER_NEW, 'the crash banner block')
    src = swap(src, LATCH_OLD, LATCH_NEW, 'the interruption latch')
    src = swap(src, CALL_STAND_OLD, CALL_STAND_NEW, 'the call stand-down')
    src = swap(src, LOSS_OLD, LOSS_NEW, 'the focus-loss latch')
    src = swap(src, PLAY_OLD, PLAY_NEW, 'the play path')
    src = swap(src, WINDOW_OLD, WINDOW_NEW, 'the spurious-stop window')
    src = swap(src, PROBE_OLD, PROBE_NEW, 'the published probe')
    src = swap(src, CHANGELOG_ANCHOR, CHANGELOG_HEAD + CHANGELOG_ANCHOR, 'the changelog anchor')
    src = swap(src, "  const APP_VERSION = '%s';" % OLD_VERSION,
               "  const APP_VERSION = '%s';" % VERSION, 'the version')
    return src


CLAIMS = [
    ("const APP_VERSION = '80.3.1';", 'the page runs 80.3.1'),
    (MARKER, 'the release banner is in the page'),
    ("{ version: '80.3.1', date:", 'the changelog records the release'),
    ("{ version: '80.3', date:", 'with 80.3 still listed next'),
    ('var _scReload = false;', 'the recorder asks the browser about reloads'),
    ('          || _scReload\n', 'a reload is a normal death'),
    ('sidecut_playback_stopped_at_start', 'the death is recorded instead of a switch-off'),
    ('let audioFocusInterruptedAt = 0;   // when it was set (0 = never)', 'the latch knows when it was set'),
    ('if(!revivingAudio && !scInCall()){', "a start of the user's own drops the latch"),
    ('window.__scFocusLatch = function(){ return audioFocusInterrupted; };', 'the latch is readable'),
    ('if(msSincePlayStarted() > 4000) return false;', 'the outside pause has four seconds'),
    ('if((a.currentTime || 0) > 2.5) return false;   // audio really did play', 'and 2.5 s of playhead'),
    ('if(spuriousStopsBlocked >= 3) return false;    // never fight forever', 'with three refusals'),
]

GONE = [
    ("const APP_VERSION = '80.3';", 'the old version constant'),
    ("localStorage.setItem('sidecut_audiofocus_off'", 'anything that still writes the switch-off'),
    ('the audio-focus helper has been switched off', 'and the message that promised it would come back'),
    ('if(msSincePlayStarted() > 1200) return false;', 'the old 1.2 s window'),
    ('        var _scNormalDeath = _scRestart\n          || (_scLeftAt', 'the reload-blind death test'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ' and the latch is dropped on a start')
        print('patch-8031%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8031 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8031: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)
    page = apply_all(page)
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8031: the page did not end up 80.3.1 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-8031: the page still carries this (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8031: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the latch, the pause window, the recorder and its banner, the changelog head and the shell cache')
    print('patch-8031: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
