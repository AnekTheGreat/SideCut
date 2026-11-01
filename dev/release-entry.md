## 80.7.5 ({{STAMP}}): the cover reaches every song, and a failure says where to tap

- **WHAT THE OWNER SAID.** *"for downloaded albums, the track art isn't showing for all of the songs exepg for the first one"*, and
  *"the streaming songs aren't working, they keep saying restart but when your in albums theirs no restart buttons and streaming
  isn't finding sources to stream from"*. Three faults, and the second sentence is one sentence for two different problems: a
  message that points at a button which is not on screen, and a song the app cannot find a copy of.
- **THE ALBUM ART.** Every row in an album asked only for **its own** `artUrl`. A downloaded album can hold its cover on the
  album and on the single song the cover was read from, with the rest carrying no picture of their own - and then every row but
  the first drew an empty 48px box. The art was never missing from the album; it was missing from the rows, because nothing
  looked one level up. `scAlbumRowArt(t)` now answers in that order: the song's own art, the album's saved cover, the art of the
  first song in that album that has any - so a row shows the same picture its header shows. It is wired into all five places an
  album's rows are drawn (the card closed, the card open, the deck's copy of the card, the reorder popup, and the deck's
  re-listing of a found album), and the answer is kept for the length of one render, cleared at the top of `renderList()`, so a
  fifty-song album costs one lookup. This part is library code, not the gated catalogue module: **the Play build takes it too.**
- **THE BUTTON THAT WAS NOT THERE.** `#scStreamSay` - the line that carries `This copy of the song ends at 1:04 of 3:12 - tap
  Restart` and its siblings - was drawn on four streaming pages, and the Restart control was drawn on **one** of them, the
  now-playing card. On the albums page, the playlists page and an open list the line named a button that was not on screen, which
  is exactly what the owner reported. `scStreamSayLine()` now draws the line and its Restart together, in all four places, and
  `scStreamWire()` binds every `.scs-fix` to `scStreamRestart`. A failure that has no line to land in at all - the library is
  what is on screen while a song plays there - now says itself through `toast()` instead of leaving a silent bar, and only the
  lines something can be done about are said that way, so a progress readout cannot toast once per percent.
- **THE COPIES IT WALKED, AND THE ANSWER IT TRUSTED ONCE.** The player hands over one muxed copy behind a row of audio-only ones,
  and the audio-only ones are the copies the source caps at a megabyte - so a copy that stopped early walked those capped rows
  one at a time, each costing a read, a blip and another failure before the one copy that carries the music was reached.
  `scStreamAltUrl(true)` now takes the muxed candidate first, and the fragment path asks for it by name. Separately, resolving
  is one round trip to a host that rate-limits and times out, and a single empty answer was final: the row said no source was
  found and stopped. The answer is now asked a **second** time before that is said (`scStreamPlayFresh` grew `playUrl()` and
  `noneLeft()` so the first answer, the re-ask and the give-up share one path), and the message keeps its Restart beside it.
- **WHAT THE SOURCE ACTUALLY SAYS.** Before touching the resolver, the endpoint was asked directly from this sandbox with the
  app's own request shape - the ANDROID body and the app's exact User-Agent and `X-Youtube-Client-*` headers:
  `playabilityStatus: OK`, **29 adaptive audio formats and 1 muxed**, every URL already plain (no `signatureCipher`); IOS:
  **16 adaptive**, OK. A plain WEB body answers `UNPLAYABLE / Video unavailable` and the TV client `ERROR / YouTube is no longer
  supported in this application or device`, which is why the app's client list is the two that work and not a longer one. So
  "no source found" is **not** a dead endpoint, and the fix is the first ask being final plus a capped candidate list - not a
  new client.
- **WHAT WAS RUN.** `dev/patch-8075.py` over the released 80.7.4 page: `--check` **1** before, **13 steps** applied, a second
  run a no-op, `--check` **0**; both OTA channels at a true fixed point; `dev/check-8075.cjs` **72 passed, 0 failed**
  against the landed bytes. The new behaviour is **driven**, not just found: `scAlbumRowArt` answers from the song, then the
  album's cover, then its first song with art, and escapes a quote in a URL; a track with no art anywhere in its album gets no
  background rather than a broken one; `scStreamSay` writes into the line when it exists, toasts a failure when it does not, and
  stays quiet for a progress line; `scStreamSayLine` carries both the line and a working `.scs-fix`; `scStreamAltUrl(true)` hands
  over the muxed copy first and removes it from the list, while the plain call keeps the player's order; and `scStreamPlayFresh`
  is run end to end three ways - a first answer plays it, an empty first answer is re-asked and the second answer plays, and two
  empty answers say so once without ever starting anything. 80.7.4's length check, 80.7.3's dots menu and 80.7.2's crop pieces
  are re-checked, every inline script compiles, and the notes are checked against **both** channel filters. Full channel:
  **{{ROOT}}** bytes at v80.7.5 with all three notes. Play channel: **released** at v80.7.5 (**{{PLAY}}** bytes,
  `dev/channel-hold.json`), carrying only the album-cover note - the other two are `[FULL]`, so the Play card publishes one
  honest line rather than a note about a module that build does not run.
- **NOT CLAIMED.** No phone and no browser here, so nobody has seen the cover fill in on a downloaded album, heard a capped
  copy hand over to the muxed one, or pressed the new Restart. What is proven is each rule, each branch, and the bytes. The
  device path that cannot be exercised from here is the native transport itself (`scHttpJson` on the patched fetch): the endpoint
  answers a faithful copy of its request, which rules out the source, but a refusal that only that transport produces would still
  need a phone to reproduce - the new second ask and the toast are there so that a refusal is at least visible and retryable in
  one tap instead of silent. The old limits stand: a row whose search result reported no length still cannot be judged, and a
  copy longer than the reader's 40 MiB ceiling is read to the ceiling.
