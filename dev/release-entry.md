## 80.6.32 ({{STAMP}}): pills that stop where you aimed, and a rail you can arrange

- **WHAT THE OWNER SAID.** *"make the pills easy to navigate / the dragging for the tabs at the bottom and add the drag and
  hold thing nice to the right sub tabs as well"* Two asks: the pill strip should be easier to move through, and the hold-and-drag
  the bottom tabs have should reach the rail on the right.
- **WHY THE PILL STRIP WAS HARD TO NAVIGATE.** It scrolled freely. A flick stopped wherever the momentum ran out, which is
  usually between two pills, so both names sat cut off by the edges and the one you wanted was another small swipe away. Each
  pill was also 7px of padding around 12.5px text - a target you had to aim at rather than one you could hit.
- **WHAT CHANGED IN THE STRIP.** `#tabs` is a scroll-snap container (`x proximity`) and every `#tabs .tab` is a snap target
  (`scroll-snap-align: center`), so a flick finishes on a pill with its name whole. The pills are `min-height: 38px` with
  `padding: 9px 16px` and an inline-flex box, so the label sits in the middle of a taller target. Snapping would fight a finger
  that is rearranging the strip, so `wireTabReorder` adds `body.sc-tab-drag` on the 380ms hold and `endDrag` takes it off -
  including a release that never became a drag - and `body.sc-tab-drag #tabs` turns `scroll-snap-type` back to `none`.
- **WHAT THE RAIL COULD NOT DO.** Its three glyphs were baked in one order: `var pages = [['library', ...], ...]` in
  `scShelfRender()`, rebuilt only when the rail was built, and a long press did nothing. There was no way to put Playlists above
  Songs, and no memory of an order to keep.
- **WHAT CHANGED ON THE RAIL.** Three functions and a constant: `SC_RAIL_PAGES` (`library`, `playlists`, `albums`),
  `scShelfOrder()` (reads `sidecut_railOrder`, filters it against those three, appends anything missing, falls back to the
  default), `scShelfSaveOrder()` (writes the DOM order back) and `scRailDrag(b)`. The glyphs are built from `scShelfOrder()`, so
  the page dragged to the top is at the top next launch. `scRailDrag()` is the pill strip's gesture applied vertically: 380ms
  hold, `setPointerCapture`, a `lift` class, then a glyph that rides the finger (`translateY(...) scale(1.14)`) and swaps with a
  neighbour once its own middle passes that neighbour's middle, restarting the drag from the finger so the distance is not
  counted twice. It is wired **before** the tap handler, because the guard that swallows the click at the end of a drag must be
  the first listener on the glyph or the page opens anyway; that guard uses `stopImmediatePropagation` and clears itself on a
  400ms timer so the glyph is tappable again at once. `touch-action: none` on the glyphs is what lets a vertical drag move the
  glyph instead of scrolling the song list underneath - the rail is fixed over that list - and it costs nothing else, because
  the gaps between glyphs still pass the finger through.
- **WHAT WAS RUN.** `dev/patch-80632.py` over the released 80.6.31 page: `--check` **1** before, ten steps applied (version,
  the strip's CSS, the two `sc-tab-drag` class changes, the lift CSS, the ordered glyph list, the helper block, the drag wired
  before the tap, the changelog), a second run a no-op, `--check` **0**. Then the workflow's own fixed-point loop
  (`cp updates.json manifest.json`, `node dev/ota-bundle.mjs`, `node dev/ota-bundle-play.mjs`, both `--check`s) until it settled,
  `python3 dev/release-record.py`, and `dev/check-80632.cjs`. OTA at a true fixed point - root + `ota/` **{{ROOT}}** bytes at
  v80.6.32, and `ota-play/` (**{{PLAY}}** bytes) at v80.6.32.
- **NOT CLAIMED.** No phone and no browser here, so nobody has flicked the strip or carried a glyph. What the checks prove is
  the shape: the CSS rules that make a pill a snap target and a taller target are in the page and in the Play zip, the snapping
  is added on hold and removed on release, the order is read from and written to storage, the glyph list is built from that
  order, the drag is wired ahead of the tap, and all seven inline scripts compile. Whether 38ms of scale and a 380ms hold feel
  right under a thumb is the part only the owner can judge. `dev/check-8062{6,7,8,9,30,31}.cjs` now fail by design; each pins
  its own version and they are left as they were.
