## 80.6.21 ({{STAMP}}): streaming, made quick - and quiet

- **WHAT THE OWNER SAID.** *"streaming is not efficient at all make that better it should be fast and
  easy to play dawg, and music shouldn't overlap with the downloaded music fix this and make it good,
  sources should never fail have like 10 backups, playback should be instant like how downloaded songs
  are"*. Three separate faults, and one of them was a half-fix I shipped myself.
- **WHY IT FELT SLOW.** Every song was an island: the resolver answered for the one song being tapped,
  the bytes were read for that song only, and nothing was remembered about the one after it. So Next -
  the most-used control in the app - paid the whole cost again: a player round trip, then a read. The
  only thing that made a song feel instant was the object-URL cache, three songs deep and twelve minutes
  long, which is shorter than one album.
- **WHAT CHANGED.** `scStreamPrefetch()` reads the **next** song into memory while the current one plays,
  using `scStreamReadOnly()` - a reader that never touches the element that is playing and never asks the
  resolver twice. The cache is **six songs, forty-five minutes**. A stream read is **six ranges at a time**
  instead of four (`scFetchBytes` now takes a lane count; the downloader's default is untouched), and the
  silent-link wait dropped from 2.4s to 1.1s, because the read already runs alongside the link and the
  old wait was mostly a pause before the fallback. One read at a time, always: a counter around
  `scStreamSource` means the read-ahead yields to a real play instead of competing with it.
- **WHY TWO SONGS COULD PLAY AT ONCE.** 80.6.17 paused the deck's **active** element when a stream took the
  bar - which is not the same as silencing the deck. The other element is the one a **crossfade** is already
  playing into; a track that ends can advance into it; `recoverAudio()` restarts whatever it likes. So a
  streamed song and a downloaded one could be heard together, and the owner heard exactly that.
  `scStreamQuietDeck()` now puts the deck to bed as a whole - both elements, the crossfade timer, the
  pending hand-off - on every path into the stream (`scStreamBarOn`, and the stream element's own `play`,
  so a resume after a pause counts too). And the rule holds from the other side: while the stream owns the
  bar, any deck element that starts playing is stopped again at once, and `recoverAudio()` returns instead
  of restarting local playback behind a stream.
- **WHY A SOURCE COULD STILL FAIL.** `scYtPlayer()` kept **three** audio rows and **two** muxed ones per
  player answer, and the element gave up after **one** retry - and that retry asked the resolver again
  before trying anything it already had. It now keeps **ten** audio rows and **four** progressive ones (the
  same player answer: no extra request, just more of what was already in it), retries up to **twelve**
  times, and walks the backups **first** - a dead URL costs the next candidate, not a fresh lookup.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.20: 16 steps applied, a second run is a no-op, and all
  seven inline scripts compile. `dev/check-80621.cjs` passes **51 checks**. Statically: six songs and
  forty-five minutes; six lanes threaded through the reader and the read-ahead; the read counter; the
  scheduled read-ahead; the whole-deck silence with the old half-silence gone; the deck listener and the
  recovery guard; ten and four rows; the twelve-retry ceiling and the backups-first order. **Driven**, in a
  `vm`: `scStreamQuietDeck()` pauses **both** elements, cancels the crossfade interval and drops the pending
  hand-off while the stream keeps its bar; the deck's own listener stops an element that plays behind the
  stream and leaves it alone when the stream does not own the bar; `scStreamReadOnly()` labels a muxed read
  audio and asks for six lanes; and `scStreamPrefetch()` resolves the next song, reads it six lanes wide,
  keeps the object URL under its video id, refuses to run while a read is in flight, and gives the URL back
  if that song became current. The OTA pair rebuilt to a true fixed point - root + `ota/` **{{ROOT}}**
  bytes at v80.6.21, and `ota-play/` still HELD (**{{PLAY}}** bytes). **Not claimed:** there is no phone and
  no network here, so no song was streamed and no timing was measured on a device. The read-ahead is a
  scheduling change, not a promise of a number: what it removes is the resolve and the read on every Next
  after the first, and the honest way to see it is one album played straight through.
