## 80.6.15 ({{STAMP}}): three icons on the right, and a silent link that gets read

- **WHAT THE OWNER SAID.** *"make the 3 streaming, albums and library tabs icons on the right hand side
  hovering over ... smooth and nice and smallish ... that layout shouldn't get touched"* - and, in the
  same breath, *"streaming does not work"*.
- **THE RAIL LEFT THE SONG'S SPACE.** Streaming, Library and Albums were a row of full-width pills, so
  three words cost a band of the screen and pushed the list down to pay for it. They are one small
  column of glyphs now - waveform, ruled lines, grid - fixed to the right edge at 32px, floating over
  the songs with a blurred, hairline edge. The rail is `position:fixed`, so it takes no room in the
  page: the shelf, the list, the scroll and the bottom inset are exactly as they were, which is what
  "that layout shouldn't get touched" has to mean in practice.
- **IT ONLY CATCHES ITS OWN TAPS.** The rail container is `pointer-events:none` and only the glyphs are
  targets, so a press in the gaps or in the rail's padding goes through to the song underneath it. The
  active page is a filled circle; the change is eased over .22s, a press scales to .9, and a
  reduced-motion setting removes the easing. `data-shelf` and `scShelfOpenTab()` are untouched - the
  three pages switch exactly as they did - and the word each circle hides is still its `aria-label`
  and its long-press title.
- **A LINK THAT STARTS AND THEN SAYS NOTHING.** The one failure that produces "nothing happens" with
  no error anywhere: a player resolves `play()`, loads the metadata, and then decodes no bytes and
  fires no `error` at all. The row sits at 0:00 and there is nothing to report. Six seconds with no
  progress on the same song now hands it to the read path - the same bounded-range read the downloader
  already uses - and the card's line says *the link went quiet* so the next screenshot names it.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.14 and driven by `dev/patch-80615.py`: every step
  applied, a second run is a no-op, all inline scripts compile, and `dev/check-80615.cjs` passes - the
  rail is fixed at 32px with only its glyphs tappable, the three glyphs are drawn at the requested size
  and differ from each other, the words survive as `aria-label`/`title`, the `data-shelf` wiring is
  unchanged, and the watch is armed on the link and reads the song when it goes quiet. The OTA pair
  rebuilt to a true fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.15 publishing one honest
  line, and `ota-play/` still held at its published bundle (**{{PLAY}}** bytes). **Not claimed:**
  playback was not heard, and the rail was not seen on a device. What is verified is the geometry, the
  wiring, and that every glyph is a path of the right size.
