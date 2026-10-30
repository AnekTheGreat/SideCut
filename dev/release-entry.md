## 80.6.19 ({{STAMP}}): a stream that starts sooner, keeps its genre, and a rail that stays put

- **WHAT THE OWNER SAID.** *"the streaming like getting the song to play should take much less time"*,
  *"should auto find a next song in that same genre"*, *"the horizontal scroll through genres should
  stay on what it was, not go back to the beginning"*, *"add more genres"*. Four fixes, one theme: the
  streaming page should behave like a player rather than a form.
- **WHY A STREAM TOOK SO LONG, IN THREE PARTS.** None of it was the source being slow:
  1. The read that always ends up playing the song started **only after the link had failed**. The link
     is the path a WebView is usually refused on (a 403 on the open-ended range), so the app paid for a
     failed request *and then* started reading.
  2. A link that loads metadata and then never decodes fires **no error at all**, so the app waited a
     fixed **six seconds** before deciding the link was quiet and reading instead.
  3. Nothing was kept. The same song played twice read twice, from zero.
- **WHAT CHANGED.** The read now begins **in the same tap as the link** - `beginRead()` is kicked off
  before the link is awaited, so when the link is refused the bytes are already moving, and when the
  link does play the read simply finishes into the cache. The silent-link wait is **2.4s**, not six.
  And the songs that have been read stay in memory as object URLs: the last **three**, for **twelve
  minutes**, with the oldest released when a fourth arrives. That makes a replay, a Previous, and a
  return to the song you just heard cost **no network at all** - it starts in the tap. The resolver's
  signed URL is also kept per song for its half-hour life, so Next does not pay for a resolution twice.
  The cache deliberately takes ownership of its URL (`scStreamState.blobUrl = ''` after a put) so the
  next read cannot revoke the copy a replay is about to use; Restart drops the copy it could not play
  before it tries again, so "try again" really is a fresh read.
- **NEXT KEEPS THE GENRE.** `scStreamNext()` now walks the queue for the next song **of the same
  genre** (the `genre` every row has carried since 80.6.17, or the genre the song was found under) and
  only falls back to the plain next when the queue holds no other song of that genre. The card shows
  the answer before it happens: an **Up next** row with the title and artist, one tap away, and when
  there is nothing else of that genre it shows **More <genre>** instead - one tap to search the genre
  again rather than pretending a next song exists. Automatic advance at the end of a song goes through
  the same function, so a genre carries from the first song to the last.
- **THE RAIL KEEPS ITS PLACE.** Every change rebuilds the streaming block with `innerHTML`, and a fresh
  row of tiles always landed back on the first tile - which read as the row "resetting". The rail now
  has an id, its scroll is read **before** the rebuild in `scStreamRender()` and handed back **after**
  it in `scStreamWire()`, and a `scroll` listener keeps the remembered value current as the owner
  swipes. It also snaps gently tile by tile (`scroll-snap-type: x proximity`), which is what makes a
  swipe feel deliberate rather than loose.
- **TWELVE MORE GENRES.** Amapiano, Reggaeton, Bollywood, Trap, Lo-fi, Soul, Funk, Metal, Blues, Disco,
  House and Workout join the rail - 27 built-in tiles in all, each with its own gradient and its own
  search, alongside the same **+ Genre** tile for the owner's own. The one genre that was removed
  stays removed.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.18 and driven by `dev/patch-80619.py`: 15 steps
  applied, a second run is a no-op, all seven inline scripts compile, and `dev/check-80619.cjs` passes
  57 checks - statically (the cache read path, the parallel read ordered before the link, the 2.4s
  wait, the resolver cache, the genre walk, the Up next and More rows and their wiring, the rail's
  capture and restore and its scroll listener, the twelve new genres, the removed one still absent)
  and **behaviourally**, by running the cache and the genre walk in a `vm`: a put is remembered and
  the cache takes ownership of its URL; a fourth song evicts the oldest and **revokes exactly one**
  URL rather than leaking it; and `scStreamNext(1)` over a queue of Punjabi, Pop, Punjabi **skips the
  Pop song and takes the Punjabi one**, while a queue with nothing of that genre falls back to the
  plain next. The OTA pair rebuilt to a true fixed point - root + `ota/` **{{ROOT}}** bytes at
  v80.6.19 publishing one honest line, and `ota-play/` still held at its published bundle
  (**{{PLAY}}** bytes). **Not claimed:** no phone and no browser here, so no song was heard and no
  stopwatch was run on a device. What is verified is the order of the operations (read started before
  the link is awaited, 2.4s instead of 6s, a cache hit before any network), the genre walk driven with
  real data, and the rail's scroll being written back after every rebuild.
