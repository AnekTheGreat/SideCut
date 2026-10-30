## 80.6.17 ({{STAMP}}): the stream takes the player bar, and genres to browse

- **WHAT THE OWNER ASKED FOR.** *"show in the now bar and stuff if your streaming the song"*, *
  "make the experience feel amazing Spotify like with a main genre or multiple genre topics"*, and
  *"make it nice and non glitchy"*. All three are the same complaint underneath: a streamed song was
  something that happened inside a card halfway up the Library, not something the app was *playing*.
- **THE STREAM NOW OWNS THE BAR.** When a stream starts, the bar at the bottom stops showing the last
  downloaded song and shows the stream: the cover on the disc (the same artwork the row carries, with
  the video-id fallback, so nothing is ever a black square), the title, `artist · length`, and a small
  **STREAM** pill so there is never a doubt which kind of song is playing. The disc spins while it
  plays and stops when it pauses.
- **AND THE BAR'S BUTTONS DRIVE IT.** Play/pause toggles the stream. Next skips to the next song in
  the queue the stream was started from. Previous restarts the song if it is more than three seconds
  in and goes back if it is not - the behaviour every player has. Dragging the seek bar seeks the
  stream, and the drag is held out of the clock's hands exactly as the local player's is, so the thumb
  no longer jumps back under the finger. The disc's progress ring and the mini bar follow the same
  clock.
- **ONE SOUND AT A TIME.** Starting a stream pauses the local player, and starting a local song stops
  the stream and takes the bar back. Before this, both could be playing at once and the bar showed a
  song that was not the one you could hear.
- **THE GLITCH WAS THE PLAY PATH REDRAWING THE PAGE.** `scStreamAudio()` rebuilt the whole streaming
  block - `innerHTML`, every wiring, the scroll - on every `play` and every `pause` event, because the
  card's own button was drawn from `scStreamState.playing`. A pause therefore reset the card's
  position and its own seek line, which is exactly the flicker and the jumping the owner is asking
  about. Play and pause now update the button, the icon and the clock **in place**; the page is only
  rebuilt when the list itself changes.
- **GENRES, AS A RAIL YOU CAN SWIPE.** Above the search there is a **Browse** row of sixteen gradient
  tiles - Pop, Hip-Hop, R&B, Afrobeats, Punjabi, Latin, Rock, Electronic, K-Pop, Indie, Country, Jazz,
  Chill, Dance, Old School, Gospel. A tile is a search of the source, not a list bundled into the app:
  tapping one asks for that genre and shows the answers where search results always appear. The
  chosen genre is ringed, and one tap on its name clears it. A song added while browsing a genre keeps
  that genre, and it is shown on the row as `artist · 3:12 · Pop`, so the topics survive the search
  that found them. Playlist copies keep the genre too, and playlists saved before this release fill it
  in from the song they point at, with no migration step.
- **RESULTS SAY WHO AND HOW LONG.** The result rows read the artist field the search actually sends
  and append its length, so two versions of the same song can be told apart before either is added.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.16 and driven by `dev/patch-80617.py`: 19 steps
  applied, a second run is a no-op, all seven inline scripts compile, and `dev/check-80617.cjs` passes
  - statically (who owns the bar, the five buttons wired to the stream, the clock feeding the bar,
  the sixteen genres, the genre kept on a row and filled into old playlist copies, the CSS that marks
  a streaming bar) and **behaviourally**, by running `scStreamBarSync()` in a `vm` against a stub DOM
  at 60 seconds of a 240-second song: the clock reads `1:00` and `4:00`, the bar sits at 25% with a
  matching fill, the disc ring is at the matching offset, the disc spins, the icons are a pause glyph,
  and after a pause they flip to a play glyph and the disc stops. Switching `barOn` off shows a local
  song's bar is never written by the stream. `scStreamRowMeta()` is driven the same way and returns
  `Diljit · 1:35 · Punjabi`. The OTA pair rebuilt to a true fixed point - root + `ota/` **{{ROOT}}**
  bytes at v80.6.17 publishing one honest line, and `ota-play/` still held at its published bundle
  (**{{PLAY}}** bytes). **Not claimed:** no song was heard and no bar was seen on a device - there is
  no phone and no browser here. What is verified is that the stream writes the bar, that the bar's
  buttons call the stream, and that pausing no longer rebuilds the page.
