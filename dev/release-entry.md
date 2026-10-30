## 80.6.20 ({{STAMP}}): the stream shows on the phone

- **WHAT THE OWNER SAID.** *"streaming stuff should also show in widget and phone player in android"*.
  One omission, and it was structural rather than a missing call.
- **WHY NEITHER THE WIDGET NOR THE LOCK SCREEN EVER KNEW.** A stream is a **second `<audio>`
  element**. Every surface that feeds the phone - the media session, its MediaStyle notification, the
  quick-settings player, the lock screen and the home-screen widget - is driven from the app's own deck
  and its queue: `mediaSetMetadata(pushWidgetState)`, `mediaSetPlaybackState`, `mediaSetPositionState`,
  and the handlers in `registerMediaSessionHandlers()`. 80.6.17 taught the stream to take over
  `#nowPlaying`, and 80.6.19 taught it to carry a genre, but nothing ever told the phone. So a streamed
  song left the card on the last **local** song (or empty), and the widget kept drawing a song that was
  not playing while the phone actually made the stream's sound.
- **WHAT CHANGED - THE SAME RULE THE BAR GOT.** `scStreamPhoneOwns()` is the phone's answer to
  `scStreamBarOwns()`: while the stream owns the bar, it owns the phone. `scStreamPhoneTrack()` hands the
  phone the shape it already reads from a library track - title, artist and the cover the card draws
  (`scStreamThumb`, the ytimg thumbnail or the row's own) - so the metadata, the notification's artwork
  and the widget need no new native path. `scStreamPhoneSync()` pushes that song, its real playback
  state and its position in one call, and `scStreamPhoneTick()` keeps the clock and the widget's
  progress strip current from the stream element, throttled to once a second because `timeupdate` fires
  four times a second.
- **THE PHONE'S BUTTONS COME BACK INTO THE STREAM.** `scStreamPhoneArm()` registers all eight actions -
  play, pause, previous, next, stop, both thirty-second jumps and seek - and each one drives the stream
  element, not the deck: next goes through `scStreamNext()`, so the genre rule from 80.6.19 applies to a
  press on the lock screen exactly as it does inside the app; previous restarts the song past three
  seconds, which is the rule the deck already used; play on a stream whose source has gone starts it
  again rather than doing nothing.
- **AND THE DECK STANDS DOWN, ON PURPOSE.** Registering handlers once would not have held: the system
  rebuilds the session (after the service is released, after a WebView reload), and `refreshMediaControls()`
  re-arms the deck's handlers every minute and pushes the deck's own track. Both now open with a guard -
  while the stream owns the bar they arm the **stream** instead - which is what stops the buttons from
  silently flipping back mid-song. The deck's background heartbeat also stopped reviving the local
  element while a stream is up (`&& !scStreamPhoneOwns()`): two sounds at once behind the screen was the
  one thing worse than no card at all.
- **AND IT HANDS THE PHONE BACK.** `scStreamPhoneQuit()` runs when the stream gives the bar up: the deck's
  track returns to the card, the state reads paused, and the deck's handlers are re-armed - so a press
  after the stream ended does not aim at a song nobody can hear.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.19: 11 steps applied, a second run is a no-op, all
  seven inline scripts compile, and `dev/check-80620.cjs` passes **56 checks**. Statically: the phone
  track carries title, artist and cover; every one of the eight actions is registered; both re-arm paths
  consult the stream **before** the deck; the widget timeline reads the stream element; the heartbeat
  guard is in place; the hand-back pushes the deck's card and re-arms its buttons. **Driven**, in a `vm`
  against a stub element: `__sync()` sends the streamed title first, then the state it is actually in,
  then all eight buttons; a `pause` press from the phone pauses the stream and `play` plays it; previous
  past three seconds rewinds instead of skipping; next calls `scStreamNext(1)`; the forward jump moves
  42s to 72s; stop pauses and rewinds; with the element's duration missing the phone is handed the song's
  real length; and `__quit()` puts the deck's song and handlers back. The OTA pair rebuilt to a true
  fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.20, and `ota-play/` still HELD (**{{PLAY}}**
  bytes). **Not claimed:** there is no phone here, so no APK was built and no notification, lock screen
  or home-screen widget was seen. The native side needed no change - the plugin and the widget provider
  already read these exact payloads (`title`, `artist`, `art`, `playing`, `pos`, `dur`), which is why
  this rides OTA - but whether a given launcher repaints the RemoteViews promptly is the device's
  business, not something this release can show.
