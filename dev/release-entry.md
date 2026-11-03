## 81.3 ({{STAMP}}): your downloads play outside the app, and the source plays fair

- **WHAT THE OWNER SAID.** *"YO WHY IS THE STREAMED AONG NOT PLAYING IN THE BACKGROUND WHEN THERES OTHER MEDIA AND WHEN I
  DOWNLOAD IT TOO THERES NO WAY TO PLAY IT WHILE THE APP ISNT OPEN WTF BRO"*. Two reports, and they are the two halves of one
  fact about this page: there are **two** playback paths and only one of them was finished.
- **THE TWO PATHS.** The *deck* is `audios[0]`/`audios[1]` playing a downloaded file from a blob URL - it has the media
  session, the heartbeat, the wake lock, `recoverAudio`, the focus latch, the parked session and the ten-minute release. The
  *stream* is `scStreamState.audio`, its own element, built in 80.6 and finished for the phone (the bar, the notification,
  the widget) but never for the system: every revive, every focus hand-back, every call stand-down and the whole background
  release ask `activeAudio()`, which is the **deck**. A stream is never `activeAudio()`.
- **WHY A DOWNLOAD COULD NOT PLAY WITH THE APP AWAY.** 80.9 gave a playing song a **partial wake lock and a foreground
  service** so Android would stop freezing the WebView behind it - `scHoldWant('stream')`, owners `{ job, stream }`. A
  downloaded song asked for nothing at all. It started, the page kept it alive while it was on screen, and the moment the
  app went away Android was free to freeze the process: the sound, the notification and every control out there went with
  it. The deck now takes the same hold on every start (`scHoldWant('deck')` in `onPlayEvt`), gives it back on a pause the
  user asked for (`onPauseEvt`), and the heartbeat gives it back when the element has stopped, so a queue that ends cannot
  leave the phone awake. **Three owners, one count**: a conversion finishing in the background still cannot stop the
  service under a song, and a song starting during a conversion does not take a second hold.
- **WHY OTHER MEDIA KILLED A SONG FROM THE SOURCE.** Another app taking the audio makes Chromium pause the elements this
  page owns; the answer is `scUndoPlatformPause`, which opens `const a = activeAudio(); if(!a || !a.paused) return false;`.
  With a stream playing, the deck's element **is** paused - `scStreamQuietDeck` put it to bed - so the function returned
  false every time and nothing was put back. The song stayed silent until the 30-second heartbeat came round, and a source
  that stopped in that window never came back at all. The same blind spot in the focus **gain** handler meant the hand-back
  played the deck: another app borrowed the audio for a moment while a song from the source was playing, handed it back,
  and the app started the last **downloaded** song over it. Both now go to whichever element is really making sound, and the
  deck is never started while the stream owns the bar.
- **A CALL DID NOT SILENCE THE STREAM.** `scStandDownForCall` paused `activeAudio()` only, so a song playing from the source
  kept singing through a call - the one thing this app promises never to do. It pauses whichever element is sounding now,
  and `scNoteCallState` puts it back when the call ends.
- **THE TEN-MINUTE RELEASE TORE DOWN A PLAYING SONG.** `mediaPausedInBackground()` and `mediaResumableTrack()` asked the
  deck, so a stream playing with the screen off read as *paused in the background*: ten minutes later `armMediaRelease()`
  stopped the heartbeat, released the wake lock and parked the session - naming the deck's song. Both ask the stream when
  the stream owns the bar, so the keep-alive stays with the player that is working and a press from outside resumes it.
- **WHAT WAS RUN.** `dev/patch-813.py` over the released 81.2 page: `--check` **1** before, **13 steps** applied, a second
  run a no-op, `--check` **0**; both OTA channels put to a true fixed point by `dev/ota-fixpoint.mjs`. `dev/check-813.cjs`
  **57 passed, 0 failed**. The new logic is **driven, not grepped**: the five hold functions are lifted out of the page and run -
  a downloaded song takes one hold naming *Bobby · Me*, a conversion joining takes none, the song ending releases none, the
  last owner releases once, a new song takes it again and a double drop releases once. `mediaPausedInBackground` and
  `mediaResumableTrack` are run against a paused deck with a playing stream (the old page calls that paused in the
  background) and answer truthfully in all four states, with the stream's own song as the thing to come back to.
  `scUndoPlatformPause` is run in exactly the state the old page could not recover from - a paused stream, the deck
  deliberately idle - and proves it plays the stream, counts the revive, and still refuses a user pause, an interruption
  already being obeyed, a call, a playing stream and a spent budget. The paths that need a real phone (the focus listener's
  gain branch, the call stand-down, the deck's hold on start and pause) are pinned by source, every inline script compiles,
  and both zips carry the 81.3 page with the deck hold. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no browser here. What is proven is the logic those handlers call, run against the shipped
  bytes, and that both zips carry it. Whether Android keeps the process alive on the owner's device - and how a given OEM
  presents the card - is the phone's to decide; the next open is the judge.
