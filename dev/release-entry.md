## 80.3.1 ({{STAMP}}): a song that stops in its first seconds comes back, and the crash banner stops blaming a helper

- **THE OWNER, WITH A SCREENSHOT.** A song parked at **0:02** with the play button showing,
  and the red banner reading *"Playback stopped while it was starting, so the audio-focus
  helper has been switched off - songs play normally now. It comes back in the next
  update."* The ask was three words: *"audio issue fix"*.
- **THE BUG THAT PARKS THE SONG IS THE INTERRUPTION LATCH, AND IT OUTLIVED THE PRESS.**
  `audioFocusInterrupted` tells `scUndoPlatformPause`, the 30 s heartbeat and
  `scSecondLook` to BELIEVE an automatic pause instead of undoing it. It was cleared by a
  focus GAIN, by `scNoteCallState(false)` after a call, and by `scTransportResume()` -
  which only the media-session play / previous / next handlers call. **The app's own
  play/pause button called `a.play()` and nothing else**, so `onPlayEvt` ran with the latch
  still set. After one real interruption (a call, another app keeping the audio) every
  later pause in that session was obeyed and nothing could touch it: press play, something
  pauses the song two seconds in, and it stays at 0:02 for the rest of the session.
  `onPlayEvt` now drops the latch when the start is not `revivingAudio` and no call is up,
  and `audioFocusInterruptedAt` records when it was set. **Reproduced and fixed with one
  driver** (`sc831-bug.mjs`): 80.3 parks the song (`focus-loss` is the last recorded stop),
  80.3.1 puts it back (`platform-pause after 2000ms - replayed (unrequested)`).
- **THE OUTSIDE PAUSE HAD A 1.2-SECOND WINDOW.** `blockSpuriousStop` refuses a stale
  lock-screen / notification pause only within 1.2 s of the start and 0.5 s of playhead -
  shorter than the notification/session hand-over on the installed app - so a stale press
  that landed at 0:02 was obeyed as if a finger had pressed it. It now refuses within 4 s
  and 2.5 s of playhead, up to three per attempt, recording `refused-auto-pause-media-session`
  each time. A genuine second press is obeyed exactly as before (driven in the harness).
- **THE BANNER SWITCHED A HELPER OFF THAT IS NOT IN THE PLAY PATH.** The recorder wrote
  `sidecut_audiofocus_off` for the rest of the version on a death during "starting
  playback", which makes `capAudioFocus` null for the session: no focus listener, no
  `callState()`, no `duckState()`. Since **58.8.4** `AUDIO_FOCUS_REQUESTS_OFF` is true -
  asking for focus on the app's behalf is what made Chromium pause its own element - so
  there is no focus request in the play path for that helper to be blamed for, and the
  switch-off bought nothing while costing a real call pausing the song and the assistant
  duck. It is gone; the death is written to `sidecut_playback_stopped_at_start` instead
  (with no `APP_VERSION` in it - that const is declared further down the page, the same
  trap 73.4.7 found in the media-notification recorder), and the banner no longer stacks a
  second message over the first.
- **A RELOAD IS NOT A CRASH.** The same banner fired for a page that had simply reloaded
  itself - an update hand-over, a refresh, a WebView restart - because `_scRestart` only
  forgave a boot less than 30 s after the previous one. The recorder now reads
  `PerformanceNavigationTiming.type` (with `performance.navigation.type === 1` as the
  fallback): a boot whose navigation type is `reload` is the app loading itself again, and
  a reload counts as a normal death.
- **WHAT DID NOT CHANGE**: requests stay off, a real call still stands the song down and
  brings it back, a message blip is still undone at any point in a song and in the
  background, a user pause and a finished song are still believed, DJ Mode still owns its
  own sound, and the revive budget still bounds all of it. Driven, not grepped: a call is
  still latched, a press during that call does not clear the stand-down, and the song comes
  back when the call ends.
- **VERIFIED** with `sc831-check.mjs` (jsdom, the shipped page, a stub phone) -
  **51 passed, 0 failed** - covering: the release metadata and the six notes, the four
  changes being present and nothing re-enabled, the latch ending on the app's own press, a
  platform pause at 0:02 being undone and recorded, a stale lock-screen pause at 0:02 being
  refused while a press 40 s in is obeyed, a call stand-down surviving a press and coming
  back when the call ends, a reloading boot showing no banner and writing no switch-off, a
  real death still speaking in plain words and recording itself, and no console error from
  the page. The page was driven **before and after** with `sc831-bug.mjs` to prove the
  first assertion is a real one.
- **THE BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}} bytes, rebuilt to a true fixed point
  in the runner before this entry is written, and settled again by deploy.yml on the push.
  Both `--check`s green on the tree that ships.
- **THE LESSON.** A guard that refuses to undo a pause is only as good as the thing that
  ends it. Every door that starts playback has to end the memory of an interruption - and
  the app's own button is the one door a person actually uses.
