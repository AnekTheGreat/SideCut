## 84.1.3 ({{STAMP}})

**The music keeps playing when you leave the app.** While a song is playing, SideCut holds a
foreground service, so switching to another app no longer freezes it and stops the song.

- Nothing in the page was pausing the audio. `scStreamRemember` only saves the position, and 84.1.2 had
  already stopped the battery saver from killing the loops while a song plays. What was left was the
  operating system: the player is an audio element inside the page, and Android freezes a cached
  process - which is what SideCut becomes the moment another app comes forward. A frozen process
  cannot feed an audio element, so the song stopped.
- The app already carried the machinery for this and nothing used it: the `SideCutJob` bridge
  (`hold` / `update` / `release`) starts `SideCutJobService`, a foreground service with a wake lock.
  A foreground service is the difference between an app Android may freeze and a player it may not.
- The page now holds it when a `<audio>` element starts playing and lets it go about half a second
  after the last one pauses or ends. It never releases a hold from the background: an OS pause must
  not tear down a hold something else may be relying on, so a release only happens while the app is
  on screen.
- Honest limit: this keeps the process alive, which is what stops the freeze. A recents swipe that
  destroys the activity still ends the song; owning playback in the native player is the next piece of
  work, not this release.
- OTA: full channel {{ROOT}} bytes, Play channel {{PLAY}} bytes.
