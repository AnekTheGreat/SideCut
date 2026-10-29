## 80.6.9 ({{STAMP}}): Streaming, experimental

- **THE OWNER'S ASK, VERBATIM.** *"try to see if streaming is a possibility like streaming the song, and
  in library build a section in the beginning for streaming and a separate section for downloaded songs
  just try it mark it as experimental see if you can do it tho and I should be able to make streaming
  song playlists and stuff too"*.
- **WHAT IS POSSIBLE, AND WHY.** The page already reaches YouTube for search (`scYtSearch`) and already
  speaks the InnerTube player endpoint to get signed media URLs (`scHttpJson`, used by the converter).
  A stream is that same signed URL handed straight to an `<audio>` element instead of being fetched,
  decoded and written as a file — which is why this release is a section and a small module rather than
  a new pipeline.
- **THE GATE IS `!SC_IS_PLAY`.** `SC_IS_PLAY` is the Play build (native Play APK, or the web page that
  is not the full one), so `SC_STREAM_OK` is true in the **full APK and full web only**. That is not
  only a policy choice: `scYtSearch()` answers with legal/sample search on the Play build, so a
  streaming section there would search one catalogue and try to play from another. On the Play build
  the block is never built and `scStreamBoot()` returns before it touches the DOM.
- **IT DOES NOT TOUCH THE PLAYER.** A stream gets its own `Audio` element inside the block. It never
  enters `queue`, `allTracks`, `queueIndex`, `activeAudio()`, the widget, the media session or the
  notification. This is the single most important decision in the release: the existing player assumes
  every track is a local file with a blob and a length, and a stream that dies inside it would take
  playback, the widget and the resume state with it. `dev/check-8069.cjs` asserts the module never
  assigns `queueIndex` or `allTracks` and that its audio element is created by the module itself.
- **THE TWO LIBRARY SECTIONS.** `<div id="scStreamBlock"></div>` is inserted as a **sibling above**
  `#listPane`, not inside it: that pane is rewritten on every library render (search keystroke, tab
  change, sort), so anything inside it would be destroyed on the next keystroke. The block paints the
  streaming header, its search, its songs and its playlists, then a **"Downloaded songs"** heading —
  the downloaded list keeps rendering underneath, under its own label.
- **STREAMING PLAYLISTS ARE SEPARATE DATA.** `streamTracks` and `streamPlaylists` are their own meta
  keys; a streaming playlist holds stream ids (`s_<videoId>`), and `scStreamPlAdd` is a no-op for a
  song already in a playlist. Removing a song from a playlist that empties it deletes the playlist,
  because a zero-length chip is a dead control.
- **THE EXPIRY IS THE FEATURE THAT KEEPS IT ALIVE.** A googlevideo URL is signed and dies.
  `scStreamStale(at, now)` calls a URL dead after thirty minutes (and treats a missing timestamp or a
  clock that went backwards as dead rather than fresh); the `error` handler re-resolves the **same
  videoId** once and resumes at the position it was on, so the song never changes under the listener.
  A source that cannot be re-resolved says so in the row instead of failing silently.
- **PICKING A ROW.** `scStreamPickUrl()` reads the two format pools and prefers opus 251 over m4a 141
  over m4a 140 over any other audio row; a `signatureCipher` row is skipped rather than handed to the
  audio element, because this path does not solve ciphers, and a video row is never chosen for a song.
- **WHAT THE PAGE PATCH TOUCHES.** `dev/patch-8069.py`, one step: the seat above `#listPane`, the
  module and its boot retry, the changelog head, `APP_VERSION` and the shell cache to
  `sidecut-shell-v80.6.9`.
- **WHAT IS NOT CLAIMED, AND THIS ONE MATTERS.** The stream path was **not** played end to end: that
  needs a network route to googlevideo and a device, and neither exists in the session that wrote this.
  What IS proven, by `dev/check-8069.cjs` (39 assertions, driving the shipped functions): the gate
  refuses the Play build in three separate places, the row picker prefers 251 > 141 > 140, skips
  cipher-only and video rows, the thirty-minute expiry rule and its two degenerate cases behave, the
  playlist add/remove/empty cases are right, the seat is above `#listPane` and empty until the module
  fills it, the streaming stores are separate keys and a streaming song is never written into the
  downloaded library, and every inline script on the page still compiles. If the first real tap on a
  stream fails, the row now says which failure it was — that is the part to read before changing
  anything in the resolver. The OTA bundles reach a true fixed point in the release step — root +
  `ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.9.
