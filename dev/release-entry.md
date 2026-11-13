## 84.1.2 ({{STAMP}})

**The music does not stop when you leave the app.** A song that is playing now keeps the
loops it needs when SideCut goes to the background or the page is hidden, instead of being
stopped by the app's own battery saver.

- The battery saver tracks every interval longer than 500 ms and paused them all on
  `visibilitychange` -> `document.hidden`, and again on `pagehide`. That was written when
the audio was expected to be `NativePlayService`'s job by the time the app went hidden, and
it is not: streamed and kept songs both play in this page. So the loops that feed playback
were killed with visibility and the music ended the second the app was left - which is why
downloaded songs stopped too, not just streams.
- `__scAudioLive()` answers whether anything is actually playing (the stream player's own
audio, or any live `<audio>`/`<video>` element), and `__scPauseIdle()` only runs the old
`pauseAll()` when nothing is playing. Both the hidden branch and `pagehide` go through it.
Nothing else about the saver changed: with the song stopped, hiding the app behaves exactly
as it did before.
- Honest limit: this keeps playback alive while the page is alive but hidden. A recents
swipe that destroys the WebView still needs the native player to own the sound, which is
the next piece of work, not this release.
- OTA: full channel {{ROOT}} bytes, Play channel {{PLAY}} bytes.
