## 80.7.9 ({{STAMP}}): a song you kept

- **WHAT THE OWNER SAID.** *"STREAMING SHOULD BE ABLE TO WORK OUTSIDE OF SIDECUT APP LIKE IN THE BACKGROUND, IT SHOULD BE FASTER AND I
  SHOULD BE ABLE TO CROP A STREAMED SONG, ALSO FROM THE APP DIRECTLY I SHOULD BE ABLE TO DOWNLOAD A STREAMED SONG, AND IT SHOULD
  PROMPT ME TO WHERE I WANT IT - ALL SONGS, ALL SONGS AND A SPECIFIC PLAYLIST, ALL SONGS AND A SPECIFIC ALBUM, OR DOWNLOADED TO
  DEVICE, OR EXPORTED"*. Four asks, and three of them were already shipped.
- **WHAT WAS ALREADY THERE, so nothing was rebuilt on a guess.** Background playback: the stream owns the phone through the
  MediaSession adapter (`updateMediaSession`, the `@jofr/capacitor-media-session` plugin, `registerMediaSessionHandlers`, and the
  heartbeat that keeps the notification live), which is why a catalogue song keeps playing with the screen off - 80.6.20 and
  80.7.1 are the releases that fixed exactly that. Crop: 80.7.2 gave a catalogue song a `File` (`scStreamCropFile`) and
  `scCropStreamSave` writes the clip into the library, and 80.7.3 put it one tap from the player. Speed: the read path already
  resolves one answer per song and remembers it (`scStreamResolveCached`), reads six lanes wide behind the cover art
  (`scStreamReadOnly`), and pulls the **next** song into memory while the current one plays (`scStreamPrefetch`, warmed 1.2s after
  each start).
- **WHAT WAS GENUINELY MISSING, and what landed.** A catalogue song is a reference - a title, an artist and the id of the copy a
  source hands back - so it could be played, cropped and added to lists, but it could not be KEPT. The dots menu now offers
  **Download this song**, which opens the ask the owner described: **All Songs**, **All Songs and a playlist**, **All Songs and an
  album**, or **Save the file to this device**. The bytes are the ones `scStreamCropFile()` already reads (the copy that is
  playing, then the read-ahead copy, then a fresh read of the same source) and the whole song is kept, not a slice; it lands the way
  a clip off a stream lands - its own id, its own blob, persisted, in All Songs and Unsorted - with `downloadedFromStream` recording
  where it came from, so asking twice finds the first copy instead of keeping the file again. Playlists take the new id through the
  same `playlists` store, albums go through `addTracksToAlbum()`, and the file leaves through `saveExportFile()` (Filesystem, then
  the system share sheet). A source that does not answer is caught and said; a song that has left the shelf is refused; one keep
  runs at a time.
- **THE PLAY CHANNEL IS UNTOUCHED BY DESIGN.** The keeper lives inside the catalogue module, which `SC_STREAM_OK` (`!SC_IS_PLAY`)
  keeps out of the store build - so the three notes are marked `[FULL]` and the Play card publishes the standing one-line fallback
  instead of advertising a button it does not have. That is the same reason 80.6.x kept the downloader and converter out of it.
- **WHAT WAS RUN.** `dev/patch-8079.py` over the released 80.7.8 page: `--check` **1** before, **4 steps** applied, a second run a
  no-op, `--check` **0**; both channels rebuilt to a true fixed point on pass 3. `dev/check-8079.cjs` **72 passed, 0 failed** on
  the shipped bytes, and the routing is **driven**, not just grepped: the keeper is lifted out of the page against stubs and every
  destination is proved to do its job and nothing else - All Songs lands one track and touches no album or saver; asking twice
  keeps one copy and says it is already there; a playlist keep creates and fills the list and touches no album; an album keep calls
  the album writer with the new id and creates no playlist; a file keep hands the file to the saver and puts nothing in the library;
  a failing read neither throws at the caller nor leaves a track behind; a song that left the shelf is refused. It also re-checks
  80.7.8 (no `pointer:coarse` in the fitting sheet), 80.7.6's record, 80.7.5's covers, 80.7.2's crop, that the catalogue is still
  gated off the Play build, and that every inline script compiles. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No source, no network and no phone in this environment: the actual read of a song's bytes was stubbed, so the
  copy that comes back from the resolver is the one thing here nobody has held. Background playback was not touched and needs no
  claim - it ships. And **speed is not claimed**: nothing about it was changed, because a speedup without a measurement on the
  hardware is a guess, and the honest next step for "it should be faster" is to time a real play on the device rather than to guess
  at the code.
