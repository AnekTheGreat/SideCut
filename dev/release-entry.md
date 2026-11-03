## 80.7.10 ({{STAMP}}): a button you can see, and a song that starts

- **WHAT THE OWNER SAID.** *"I CAN'T DOWNLOAD A STREAMED SONG, WHERE'S THE BUTTON. STREAMED SONGS ARE INCONSISTENT, I CLICK IT
  THEN IT PLAYS IT 3 MINUTES LATER."* Both were real, and neither was a mystery in the code.
- **THE BUTTON WAS HIDDEN BEHIND A TWO SECOND HOLD.** 80.7.9 added the save to the song menu, and the song menu is opened by
  holding a row (or the player dots) for two seconds. A tap on a streamed row plays it, so the only way to find the save was to
  already know it existed. Every streamed row now carries a device button beside its add button, a row inside a playlist or an
  album carries one too, and the player card carries one in its transport row. All three open the same four answers 80.7.9
  built: All Songs, All Songs and a playlist, All Songs and an album, or the file itself to the device. The long-press menu keeps
  its entry; nothing was removed.
- **THE THREE MINUTES WAS THE READ, NOT THE RESOLVER.** `scStreamSource()` reads the **whole** song before the element is given
  anything - the first range, then six lanes of one mebibyte, then the tail - and only then builds a blob and calls
  `scStreamStart()`. A three minute song on a phone is therefore minutes of a bar that says *Reading the song*, and a song played
  before is instant because its blob is already in `scStreamCache`. **That is the inconsistency the owner described**: the same
  tap is one second or three minutes depending on a memory cache nobody can see. A stream now opens from its **first mebibyte** -
  `scStreamPrefix()` asks for `0` to `SC_AUDIO_CHUNK - 1`, which is the same bounded range the full reader asks for first and the
  exact first megabyte the source's audio-only copies are capped at, so it is served rather than refused - and the full copy is
  read behind it by `scStreamUpgrade()`, which swaps it in at the second the listener has reached and puts it in the cache.
- **THE THREE PLACES A SHORT COPY WOULD HAVE BROKEN IT**, all guarded. `scStreamFragCheck()` treats a copy that ends early as a
  fragment and starts the whole read again; the opening ends a minute in by design, so it is exempt while `via` is `prefix`. The
  element's `ended` handler advances the queue; the end of the opening is not the end of the song, so it waits for the whole copy
  instead of skipping. And the link path and the quiet-link watcher both open from the first megabyte before falling back, so no
  tap reads a whole file before it makes a sound.
- **WHAT WAS RUN.** `dev/patch-80710.py` over the released 80.7.9 page: `--check` **1** before, **11 steps** applied, a second
  run a no-op, `--check` **0**; both channels rebuilt to a true fixed point. `dev/check-80710.cjs` on the shipped bytes, and the
  order is **driven**, not grepped: the fresh path is lifted out of the page against stubs and the events are recorded, so it is
  proved that the opening is asked for **with** the link, that the opening is what plays when the link is refused, and that the
  whole copy is only read **after** the opening has started - the exact reverse of the order that made the owner wait. It also
  proves the three buttons exist on all three surfaces and all reach the ask, that the fragment guard and the `ended` guard are
  in place, and that 80.7.9's keeper, the sheet, 80.7.8's phone-free fitting sheet, 80.7.2's crop and the Play gate all survive.
  Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone, no source and no network in this environment, so nobody here has heard the opening play or the swap
  happen - the read is stubbed in the checks. What is claimed is narrow and checkable: the element is now given a first
  megabyte at the start of the tap instead of the whole song, and the order of those two events is proved in the verifier.
