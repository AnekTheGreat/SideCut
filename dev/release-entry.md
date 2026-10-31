## 80.7.2 ({{STAMP}}): the notification, the widget and Crop follow a song played from the catalogue

- **WHAT THE OWNER SAID.** *"the android things should be the streaming songs too like media player, same thing with cropping, all
  features should include the streaming songs"*. Three answers to one question: the phone's own surfaces, the crop sheet, and
  everything that assumed a song has a file on the device.
- **WHY THE WIDGET KEPT THE DOWNLOADED SONG.** `pushWidgetState()` sends the native side a `seq`, and the native guard drops
  any update carrying an older one - that is how a slow cover fetch from the previous song is kept from overwriting the song
  that is playing. `widgetTrackSeq` was only ever bumped by `window.__scWidgetOnTrack()` and `mediaSetMetadata()`, both of
  which are deck paths. A streamed song therefore pushed with the last download's number: equal at best, and behind the mark
  the moment that download had been pushed once, so the widget stayed on the deck while the stream played. `__scWidgetHeartbeat`
  made it permanent - it opened with `if(!widgetTrack) return;`, and a phone that had never played a downloaded song had no
  `widgetTrack` at all, so the six-second beat pushed nothing and the widget sat on the SideCut default for the whole stream.
- **WHAT THE WIDGET DOES NOW.** `scStreamWidgetPush()` is the stream's press: it bumps `widgetTrackSeq` once per streamed song
  (a new song is a new sequence, exactly like a new file), reads the live element for playing, and pushes
  `scStreamPhoneTrack()` - the same title/artist/cover shape a library track has. The tick that used to call
  `pushWidgetState()` directly calls this instead, a play or pause of the stream pushes immediately rather than waiting for the
  next beat, and the heartbeat and the one-time arm both ask `scStreamPhoneOwns()` before they can return on an empty
  `widgetTrack`.
- **WHY THE NOTIFICATION COULD SWAP BACK.** `_scArmNativeMedia()` arms three seconds after launch and then pushes "the song
  that is playing" as `allTracks.find(tr => tr.id === queue[queueIndex])` with `activeAudio()`'s state - the deck's song, which
  is precisely the one that is silent while a stream is up. Arming with a restored stream on the bar replaced its card with a
  paused deck row. It now calls `scStreamPhoneSync()` when the stream owns the bar, and only falls through to the deck push
  when it does not. The transport handlers were already routed by 80.6.20 (`registerMediaSessionHandlers` delegates to
  `scStreamPhoneArm`); nothing about them changed.
- **WHY A PRESS FROM OUTSIDE SAID "NOTHING TO PICK BACK UP".** `scWidgetResumeCheck()` fires while nothing is audibly playing
  and calls `scResumeRestoredSong()`, which opened with the deck's queue and returned false for a stream - so the widget's
  play button, the lock-screen press and the notification press on a paused stream produced a toast and no sound.
  `scStreamResumeFromPhone()` runs first now: it clears the deliberate-pause mark, resets the revive budget, starts the element
  at the second it stopped on, and takes the song back out of the store when the element has no source yet.
- **WHY CROP REFUSED A STREAMED SONG.** `openCropSongModal(t)` opened with `if(!t.file){ toast('This song has no audio file to
  crop.'); return; }`. A streamed row is a source URL and metadata - there is no `File` - so the one feature that edits a song
  turned away every song that was not downloaded, and the stream's long-press menu never offered it.
- **WHAT CROP DOES NOW.** The sheet accepts a row with no file when it is a streamed song, and `scStreamCropFile()` hands it the
  same `File` a download has, read in the order the stream itself uses: the object URL it is playing, the read-ahead copy for
  its video id, then a fresh `scStreamReadOnly()` of the same source (the temporary URL revoked in a `finally`). Applying
  branches before the deck hand-off: `scCropStreamSave()` encodes the selection and writes a **new library song** - its own id,
  its own blob, in All Songs and Unsorted, `persistTrackMeta()` called, `croppedFromStream` recording where it came from -
  instead of rewriting a row that has no file to rewrite. The streamed song is never mutated. The stream's long-press menu
  offers "Crop a clip from this song", built through `scStreamCrop()` from the live song when it is playing and from the stored
  row when it is not.
- **WHAT WAS RUN.** `dev/patch-8072.py` over the released 80.7.1 page: `--check` **1** before, 15 steps applied, a second run
  a no-op, `--check` **0**. Then the workflow's own fixed-point loop for both OTA channels, `python3 dev/release-record.py`,
  and `dev/check-8072.cjs` - which **runs** the new behaviour, not only greps it: the widget push bumps the sequence once for a
  new streamed song and not for the same one, reports the song and that it plays, and stands down when the deck owns the bar;
  the resume press actually calls `play()`, clears `userPaused` and resets the revive budget; and the crop reader returns a
  `File` named for the song with the real container and the bytes it read. The checker also compiles every inline script on the
  page. OTA at a true fixed point on the full channel - root + `ota/` **{{ROOT}}** bytes at v80.7.2, carrying all three notes.
  **The Play channel is held at v80.7** (`dev/channel-hold.json`, **{{PLAY}}** bytes): this release is entirely about the
  streaming module, and the Play build has no streaming module at all.
- **NOT CLAIMED.** No phone and no browser here. Nobody has streamed a song and looked at the widget, pressed play on the lock
  screen after closing the app, or cropped a clip off a streamed song. What is proven is the logic and its wiring on the page
  and inside the full channel's zip, that the page is v80.7.2 and the Play manifest still reads 80.7, and that every inline
  script compiles. Whether Android keeps the WebView alive to *serve* that widget is the launcher's decision, not the page's -
  this release makes the page feed the right song to every surface the phone owns, which is the part it can answer for.
  `dev/check-8071.cjs` now fails by design: it pins 80.7.1, the same way `dev/check-8062*` and `dev/check-807.cjs` pin theirs.
