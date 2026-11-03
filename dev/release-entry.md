## 81.4 ({{STAMP}}): a stopped song stops saying it is playing

- **WHAT THE OWNER SAID.** *"WHY IN THE STREAMING IT KEEPS FAKE PLAYING AUDIO WHEN I DONT HAVE THE APP OPEN."* The shade,
  the lock screen and the widget kept showing a song as playing, with a clock that never moved, after Android had
  silenced it.
- **THE CAUSE WAS ONE LINE OF JUDGEMENT.** `startMediaSessionHeartbeat` compares the deck's playhead against the time
  spent in the background (`playbackSurvivedBackground`) - and for a stream it did no comparing at all:
  `const bgDead = (scStreamPhoneOwns()) ? false : (...)`. While a song from the source owned the bar, the heartbeat
  declared it alive unconditionally, then pushed `a.paused ? 'paused' : 'playing'` for the **deck** element - which is
  deliberately paused under a stream. So a WebView that Android had frozen with a stream "playing" kept reporting
  playing for as long as the page existed.
- **THE FIX.** The stream keeps its own trip. `noteBackgroundStart()` records `scStreamBgTrip` (when it left, the
  stream's playhead, its song id, and whether anything was believed to be playing), and `scStreamSurvivedBackgroundFrom()`
  applies the deck's own test to it: a few seconds of slack, no judgement under four seconds, a pause or a stopped
  clock is death, a new song or a seek backwards is none of its business. The heartbeat judges the stream by that trip
  and pushes the state belonging to whichever element is sounding, so a dead stream says **paused** and its bar stops
  spinning instead of claiming a playhead nobody can hear.
- **THE FULL APK, IN TOOLS.** Asked in the same message: "in tools add a download link for the full apk version" -
  "for the full web version ONLY NOT THE REGUALR WEB VERSION". `apkCard()` is built into the Tools pane only when
  `SC_IS_WEB` is true and `SC_IS_PLAY` is false, which is exactly the full web page: the plain web page is the store
  build (`SC_IS_PLAY`), and both APKs are native (`SC_IS_WEB` false). It links to the newest release, where
  `android-build.yml` attaches `SideCut-<version>-full.apk` to an `apk-...` tag. The card is one more string in the same
  insert as Milestones, Plays and Look, so nothing about the pane's wiring moved.
- **WHAT WAS RUN.** `dev/patch-814.py` over the released 81.3 page: `--check` **1** before, **9 steps** applied, a
  second run a no-op, `--check` **0**; both OTA channels put to a true fixed point. `dev/check-814.cjs` **34 passed,
  0 failed**, and both claims are **driven**: `scStreamSurvivedBackgroundFrom` is lifted out of the page and handed real
  trips - a song that really moved its playhead over a minute survived, the same minute with a frozen clock did NOT, a
  paused element did not, a changed song and a seek backwards are left alone, and a trip that believed nothing is not
  judged; `apkCard` is executed under all three builds and returns the card for the full web page only. The heartbeat's
  own judgement and the pushed state are pinned by source, all inline scripts compile, and both zips carry the 81.4
  page. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no browser here, so the shade and the lock screen were not looked at: what is proven is
  the judgement those surfaces read, run against the shipped bytes, and that the card renders for the full web build
  and for no other. The link opens the release page the CI tags; it was not clicked from a browser here.
