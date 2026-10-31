## 80.7.1 ({{STAMP}}): lyrics, DJ Mode and background play for a streaming song

- **WHAT THE OWNER SAID.** *"why doesn't streaming work outside of the app like when I close the app, dj mode and lyrics should be
  for the streaming song"*. Three surfaces stopped at the edge of the deck: the lyrics sheet, DJ Mode, and the background
  heartbeat. None of them was broken; each asked the wrong player a question only the deck could answer.
- **WHY LYRICS SAID "PLAY A SONG FIRST" OVER A SONG YOU COULD HEAR.** `#lyricsBtn` opened with
  `if(queueIndex < 0 || queueIndex >= queue.length){ toast('Play a song first'); return; }` and then looked the song up in
  `allTracks` - and a stream is deliberately in neither: since 80.6.9 the streaming module keeps its own store, its own
  queue and its own `<audio>` element. Even on the paths that did open, `startLyricsAutoScroll` read
  `activeAudio().currentTime` and bailed on `activeAudio().paused`, so the highlight kept time on a deck that was silent by
  design while the stream played, and the lyrics play button paused the deck.
- **WHAT THE LYRICS SHEET DOES NOW.** `scStreamSong()` returns the streamed song in the shape the lyrics sheet already reads -
  id, name, artist, length, cover - and `scListenAudio()` returns the element that is actually making sound that second (the
  stream while it owns the bar, the deck otherwise). The button, the sheet's previous and next (which now walk the stream's
  own genre-aware queue and re-fetch for the song that started), the play/pause button and icon, the highlight clock and the
  plain-sheet duration fallback all read those two. Words found for a stream are saved with `scStreamLyricsSave()` onto the
  streamed song in the stream's own store - `persistTrackMeta()` writes a *library* record, and a streamed song has none, so
  its words used to be lost the moment the sheet closed.
- **WHY DJ MODE REFUSED THE SAME SONG.** `enterDjMode()` opened with the same queue test and looked up `queue[queueIndex]`;
  every deck lookup (`refreshDjMode`, `loadTrackIntoDeck`, the strip) searched `allTracks` alone. A streamed song is in none of
  those, so the rig refused to open on music that was playing.
- **WHAT DJ MODE DOES NOW.** `enterDjMode()` asks `scStreamSong()` first and takes the streamed song. The deck decodes the
  bytes the stream already has: its playing object URL, the read-ahead cache entry for that video id, or - when both are gone -
  a fresh `scStreamReadOnly()` of the same source. `djTrackById()` is the one lookup the deck uses for the loaded song, so the
  platter, the per-track reset (hot cues, kill switches, loop, tap tempo) and the title all work on a stream. `djStreamUrl()`
  answers where the bytes are. Leaving the rig hands the sound back: `exitDjMode()` seeks the stream element to the second the
  platter stopped on and starts it again, instead of silently handing the playhead to a deck element that was never playing.
- **WHY IT DIED IN THE BACKGROUND.** `startMediaSessionHeartbeat` opened with
  `if(document.hidden && (!activeAudio() || activeAudio().paused)) return;` - the deck's element. A backgrounded stream is
  therefore "nothing playing" to the one loop that keeps a page alive out there: no metadata re-assert, no position state, no
  revival, and `playbackSurvivedBackground()` (which reads the deck's playhead) would have marked the notification paused while
  the stream was still running. The heartbeat now opens on `scListenAudio()`, and a stream that is paused without ever being
  asked to pause - the OS reclaiming a backgrounded page - is started again from the second it stopped on, up to twenty
  attempts, with the position and the widget timeline pushed each tick. A pause the owner made is marked with
  `scStreamState.userPaused` at every place it can happen (the app's own toggle, the phone's pause and stop, the lyrics
  button, giving the bar up) and is never revoked.
- **AND CLOSING THE APP LEAVES A WAY BACK.** `scStreamRemember()` writes `{id, at, savedAt}` to the stream's own store at most
  every four seconds, at once on `pagehide` and when the page is hidden. On the next launch `scStreamRestoreLast()` puts that
  song back on the bar, paused, at that second - and `scStreamPlay()` carries the second in `scStreamState.pendingAt`, which
  `scStreamStart()` seeks to, so play continues where the song stopped instead of starting it again. Older than twelve hours,
  or a song no longer on the shelf, and nothing is restored.
- **WHAT WAS RUN.** `dev/patch-8071.py` (with `dev/patch-8071-blocks.py` and three step files) over the released 80.7 page:
  `--check` **1** before, 32 steps applied, a second run a no-op, `--check` **0**, every inline script compiles. Then the
  workflow's fixed-point loop, `python3 dev/release-record.py`, and `dev/check-8071.cjs`, which **runs** the new behaviour
  rather than reading it: the streamed song is mapped to a track (title, artist, length, cover, its own store id), the listening
  element is the stream while it owns the bar and the deck when it does not, lyrics are written to the stream's store and to a
  library record on a device song, the deck finds a streamed song by id and prefers the playing URL over the link, and a
  remembered second is carried into `scStreamPlay()`. OTA at a true fixed point on the full channel - root + `ota/` **{{ROOT}}**
  bytes at v80.7.1. **The Play channel is held at v80.7** (`dev/channel-hold.json`, **{{PLAY}}** bytes): this release is
  entirely streaming, the Play build has no streaming, and its update card drops any note that names it by rule - so the
  full channel publishes the one honest line the card allows ("Fixes and improvements under the hood.") rather than a note
  about a feature that build does not have.
- **NOT CLAIMED.** No phone and no browser here: nobody has streamed a song, opened its words, mixed it on the platter, or
  closed the app mid-stream. What is proven is the logic and its wiring on the page **and** inside the full channel's zip, that
  the full manifest is v80.7.1 and the Play manifest still reads 80.7, and that every inline script compiles. Whether a
  streaming song's words exist
  online at all is the database's question; whether the phone keeps a WebView alive for an hour in the background is the
  launcher's - this release makes the page ask for it and recover when it is taken, which is everything the page owns.
  `dev/check-8062{6,7,8,9,30,31,32}.cjs` and `dev/check-807.cjs` now fail by design; each pins its own version and they are
  left as they were.
