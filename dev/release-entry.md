## 80.9 ({{STAMP}}): a song keeps playing when the app does not

- **WHAT THE OWNER SAID.** *"the streaming still doesn't work outside a app."* He had said it once before, in 80.7.1
  (*"why doesn't streaming work outside of the app like when I close the app"*), and that release answered it with a page
  full of machinery: a heartbeat that revives a stream the phone silenced, re-asserts the media session, pushes the position
  to the widget, and remembers the second to come back to. It changed nothing he could feel, and this release is why.
- **FAULT ONE: THE LOOP THAT KEEPS A STREAM ALIVE WAS PAUSED WITH THE APP.** The battery saver near the top of the page
  replaces `window.setInterval`, tracks every interval longer than 500 ms, and stops all of them on `visibilitychange` when
  the page is hidden - and again on `pagehide`. Exactly one timer is exempt: the one-second listening clock, which calls
  `__scKeepAliveTimer` so a song heard with the screen off still gets counted. 80.7.1 then put the entire background revival
  inside `startMediaSessionHeartbeat()` - a tracked 30-second interval. So the first thing the saver did when the owner left
  the app was clear the one timer whose only job is keeping a song alive out there. The deck's revive path rides the same
  loop, so both players were counting on a timer that is deliberately stopped. The code was right; it was not running.
- **FAULT TWO: NOTHING ASKED THE PHONE TO STAY AWAKE FOR A SONG.** The Android half already carries the hold this needs -
  `SideCutJob`, injected by `.github/workflows/patch-joblock.py`: a `PARTIAL_WAKE_LOCK` plus a `dataSync` foreground service,
  because (that file's own words) *"with the screen off the CPU sleeps ... a cached process is frozen and can be killed"*.
  A conversion has asked for it since it was written. Playback never did, so a streamed song was the one piece of work in
  this app left to the freezer: the audio died with the page while the notification kept saying it was playing.
- **A KEPT TIMER THAT WAS BORN HIDDEN IS STARTED NOW.** The interceptor starts an interval *stopped* when it is created while
  `document.hidden` is set, and `__scKeepAliveTimer` only ever set `keep = true` - keeping a timer exempt from a pause that
  had already happened. It now starts the timer as well, which is the state a stream resumed from the lock screen is in.
- **THE HEARTBEAT IS MARKED KEPT.** Reviving a silenced stream, re-asserting metadata and position, and pushing the widget all
  happen on the 30-second beat that only matters while nobody is looking. It survives the saver now.
- **PLAYBACK TAKES THE HOLD, AND GIVES IT BACK FOR THE RIGHT REASON.** A streamed song's `play` asks for the hold; a `pause`
  the owner asked for gives it back; a pause the platform applied does **not**, because that is the exact case the heartbeat
  is there to undo; a finished song gives it back before advancing; and a now bar handed back to the deck gives it back from
  the heartbeat, whatever the element's last event said.
- **ONE HOLD, TWO OWNERS.** `SideCutJob` is a pair of calls with no reference count - `hold()`/`release()` - so the naive
  version had a download finishing in the background stop the service out from under a playing song. `scHoldSync()` is the
  missing arbiter: one `hold` when the first owner asks, one `release` when the last is done, named for whichever thing is
  still running, and a no-op on a build without the plugin.
- **NOT A NATIVE CHANGE.** `SideCutJob` has shipped in the APK since conversions used it; this release only calls it, so it
  rides the OTA channels like any other page release.
- **WHAT WAS RUN.** `dev/patch-809.py` over the released 80.8 page: `--check` **1** before, **10 steps** applied, a second
  run a no-op, `--check` **0**; both channels rebuilt to a true fixed point (pass 3). `dev/check-809.cjs` **47 passed,
  0 failed** against the shipped bytes, and the two new behaviours are **driven**, not grepped: a 30-second timer created
  while hidden is started then stopped, marking it kept leaves it running, and a kept timer created while visible is not
  restarted; the arbiter is run against a fake plugin in both owner orders - one `hold` for two owners, no `release` when the
  first finishes, exactly one when the last does, nothing at all and no throw on a build with no plugin, and an unknown owner
  cannot move it. The page carries one `hold` call site and one `release` call site, the stream's three events are wired to
  it, the heartbeat is marked kept, every inline script compiles, and the notes survive the updater's own filter. Full
  channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no browser here, so nobody has played a song, closed the app and heard it carry on. What is
  proven is the timer state, the arbiter, the wiring and the bytes. Two limits are worth naming: Android 12+ refuses a
  foreground service started from the background, so a song resumed from a notification while the app is away gets the wake
  lock alone (the plugin's own fallback, unchanged by this release); and whether the WebView keeps decoding audio once the
  activity is destroyed - a swipe away from recents rather than a press of home - is the launcher's decision, not the page's.
  The hold is what stops the freezer, which is the part the page can answer for.
