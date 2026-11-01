## 80.7.6 ({{STAMP}}): the bar comes back to the song played last

- **WHAT THE OWNER SAID.** *"why does it default to the streamed songs in the now bar even tho my most recent song is a downloaded soNG IT SHOULD JUST BE
  THE SONG THAT WAS RECENTLY PLAYED"*. Nothing about that was a preference or a guess: the bar had two memories and no way to tell which was newer, and
  it resolved the tie in favour of the catalogue every time.
- **THE FAULT.** The catalogue remembered the last song played from it, in `meta.streamLast` (`{ id, at, savedAt }`). The deck remembered its own queue,
  in `meta.playback` - with **no time at all**. Neither row knew the other existed. At launch `scStreamRestoreLast()` read its own row, and while that
  row was under **twelve hours** old it set `curId`, marked the bar as the catalogue's and drew the song - so a song streamed in the morning came back over
  the download played five minutes ago, on the bar, on the lock screen and in the widget, because everything the phone shows follows the bar. It was not
  the restore being wrong about *one* song: it was a restore that never asked whether it had been superseded.
- **WHAT LANDED.** One record of what played last, written at the moment a song starts by **both** players: `scLastPlayedSet('deck' | 'stream', id)`
  writes `meta.lastPlayed` with the kind, the id and the time. `playCurrent()` - the deck's single start path, so a tap, Next, Previous and an album roll
  all reach it - and `scStreamPlay()` both call it. `savePlaybackState()` now also records `savedAt`, so the deck's own row can be compared instead of
  guessed at. `scStreamRestoreLast()` reads all three rows at once (`streamLast`, `playback`, `lastPlayed`), and `scLastPlayedWasStream()` decides:
  the shared record when it exists; otherwise the two timestamps when **both** rows carry one; otherwise a deck session with a position in it beats a
  catalogue row, because a catalogue row on its own proves only that a catalogue song was started at some point - which is the shape every install
  has the first time it runs this release. That last branch is the owner's own case: their catalogue row was dated and their download's was not. When the catalogue really was last, the old behaviour is untouched - the song comes back,
  paused, at the second it stopped on, with the same "Tap play to carry on where you left off". When it was not, it stays out of the way entirely: no
  `curId`, no resume point, no message.
- **WHAT WAS RUN.** `dev/patch-8076.py` over the released 80.7.5 page: `--check` **1** before, **6 steps** applied, a second run a no-op, `--check` **0**;
  both OTA channels at a true fixed point; `dev/check-8076.cjs` **57 passed, 0 failed** against the landed bytes. The decision and the restore are both
  **driven**: a shared record saying the deck played stops the catalogue from claiming the bar; one saying the catalogue played lets it claim it and put
  the resume point back; a record older than twelve hours is ignored either way; a song that has since left the catalogue list is ignored; and with no
  shared record at all, the newer timestamp wins in both directions and a deck session with a position beats an undated catalogue row. `scLastPlayedSet`
  is driven to write the row it is supposed to write. 80.7.5's album cover, 80.7.4's length check, 80.7.3's dots and 80.7.2's crop pieces are re-checked,
  and every inline script compiles. Full channel: **{{ROOT}}** bytes at v80.7.6. The Play channel is **held at v80.7.5** (`dev/channel-hold.json`,
  **{{PLAY}}** bytes): the bar restore belongs to the catalogue module, which that build does not run, and 80.7.5 already gave it the album-cover fix.
- **NOT CLAIMED.** No phone here, so nobody has watched the bar come back to a download after a relaunch. What is proven is the record both players
  write, the decision across every combination the rows can be in, and the state the restore leaves behind. One honest limit: an install whose rows were
  all written before this release has no shared record and no deck timestamp, so the first launch after updating falls back to the rule above - a deck
  session with a position wins - and from the next play onwards the shared record decides exactly.
