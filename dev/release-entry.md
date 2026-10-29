## 80.6.11 ({{STAMP}}): A shelf for streaming, and streams that play

- **WHAT THE OWNER ASKED FOR, AND WHY 80.6.9 DID NOT DELIVER IT.** In his words: streaming *"should
  have like its own thing like its own mini tab like you click on Library and a side panel on the right
  opens that opens up subtabs, of streaming, library, and albums"*, and *"make the streaming actually
  work and play songs"*. Both were true of 80.6.9: streaming was painted into the library list, sharing
  one scroll with the downloaded songs, and it did not play.
- **WHY IT DID NOT PLAY.** The stream path was a second guess at the player - its own client list, its
  own headers, no cipher handling - so it came back empty and the row said so. It now calls
  `scYtPlayer()`, the resolver the converter has been downloading through: both clients asked at once,
  headers that name the client the request declares, a `signatureCipher` row decrypted, audio-only
  streams ranked before the muxed ones, and the alternates kept so a stream that dies mid-song is
  retried against the next candidate before the row admits defeat.
- **THE RAIL AND THE SHEET.** `#scShelfRail` sits above the list with three tabs. **Streaming** slides a
  sheet in from the right edge (`position:fixed`, `translateX`), over the list rather than into it, with
  a scrim behind it and a close button on it; the list underneath is never re-rendered by opening it.
  **Library** and **Albums** are not reimplementations: they close the sheet and drive the page's own
  `libraryMode` + `navigate`, so sorting, selection and album expansion behave exactly as before. On a
  Play build `SC_STREAM_OK` is false, so no rail, no sheet and no tab is built at all.
- **THE GLYPHS ARE GONE.** The transport and the add/remove buttons were set in characters (U+FF0B,
  U+23EE, U+23F8, U+23ED, U+00D7) and a WebView chose a font for them - which is why one of them looked
  like an emoji beside a normal label. They are SVG paths now, in the row's colour, and the play button
  takes the theme's accent instead of a hardcoded coral.
- **PINS AND RECOMMENDATIONS.** The sheet paints the app's own `pinnedArtists` array (the one Discover
  writes) as chips - one tap searches that artist - and **Recommended** seeds a search from the artist
  of whatever is streaming, which is the only thing the source tells us that the app can act on.
- **THE PLAY CHANNEL'S NOTES.** The owner's other complaint was that regular SideCut's patch notes
  talked about streaming at all. The streaming items are marked `[FULL]` and "streaming / streams /
  from the source" join the words that channel hides - in `scHidesOnPlay()` and in its own copy in
  `dev/ota-bundle-play.mjs`, which this release writes so the two cannot drift.
- **WHAT WAS RUN.** The page was built from 80.6.8, 80.6.9 and 80.6.10 in the session that wrote this,
  then `dev/patch-80611.py`: one step, `--check` green (a second run is a no-op), the rail above the
  sheet above `#listPane`, no banned character left inside the module, the resolver delegating to
  `scYtPlayer`, every one of the page's inline scripts compiling (7 scripts, the big one 2.9 MB), and
  the Play channel's note filter run over the changelog to confirm the streaming items are dropped from
  what that channel publishes - 80.6.10 and 80.6.11 publish none of them, while 80.6.8's lyric notes
  still publish. **Not claimed:** the stream was not played end to end - that needs a device and a route
  to the source. If the first real tap fails, the row names the failure; that is the part to read
  before touching the resolver again. The release step rebuilds the OTA bundles to a true fixed point -
  root + `ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.11.
