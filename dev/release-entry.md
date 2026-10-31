## 80.6.25 ({{STAMP}}): the side rail holds still, and the songs are one tap away

- **WHAT THE OWNER SAID.** *"WHY DO THE SIDE BUTTONS KEEP MOVING AND ITS NOT LETTING ME ACCESS MT
  DOWNLOADED SONGS FROM THE BUTTONS"*. Both halves are the 80.6.23 side rail, and neither is the
  flicker that release repaired: no code left repositions the rail, and nothing in it is rebuilt per tap
  any more.
- **WHY THEY MOVED.** The pill is `position:fixed` with a `backdrop-filter`, floating over a list that
  scrolls under it - so its backdrop is re-sampled on every frame of a scroll, and on a WebView a fixed,
  blurred layer visibly judders against the moving page. The 80.6.23 mark also still wrote the source
  glyph as `innerHTML` on every pass (`scShelfMark` was fixed for the *building*, not for the *marking*),
  which replaces the node under the thumb and repaints the pill from the inside out.
- **WHY THE SONGS WERE UNREACHABLE.** `scShelf.page` and `scShelf.src` are two fields: with the switch on
  the source, the **Library** and **Albums** glyphs drew the streaming set - the two buttons named after
  the library opened something that was not it. The only way home was the third glyph, whose icon showed
  where you *already were*: standing on the device side it showed the device arrow, so tapping the one
  arrow that means "your downloaded songs" switched you *away* from them, and flipping back kept whichever
  page was up, so from streaming albums you landed on device albums.
- **WHAT CHANGED.** Library and Albums leave the source: a tap on either lands on what is downloaded. The
  switch's icon is the destination (device arrow on the source, waveform on the device) and its label and
  title follow. Flipping to the device comes home to the song list. The switch is built once with both
  icons and one `on` class decides which is drawn - no `innerHTML`, and a glyph is restyled only when its
  mark actually changes. The rail is a 96% opaque pill with no `backdrop-filter`, so scrolling under it
  repaints nothing of it. Position, size, gaps, `pointer-events` and `data-shelf` are untouched.
- **WHAT WAS RUN.** `dev/patch-80625.py` over the released 80.6.24 page: `--check` **1** before, 8 steps
  applied, `--check` **0** after, a second run a no-op. `dev/check-80625.cjs` passes **29 checks** - the
  pill has no blur, the switch is built with both icons and marked by class only, no `innerHTML` survives
  in `scShelfMark`, the device arrow is what shows on the source, both page glyphs set `src = 'd'`, the
  device side resets to the song list, the streaming entry point still switches the source on, the release
  is on the page with its Eastern stamp, and all seven inline scripts compile. OTA rebuilt to a true fixed
  point - root + `ota/` **{{ROOT}}** bytes at v80.6.25, the `ota-play/` channel (**{{PLAY}}** bytes)
  untouched, as it has been since it was held. **Not claimed:** there is no phone and no browser here, so
  the rail was not scrolled under, no glyph was tapped and no downloaded list was seen - what is verified
  is that the pill no longer asks to be re-blurred or rewritten, and that the path from either page glyph
  to the downloaded songs no longer depends on the switch.
