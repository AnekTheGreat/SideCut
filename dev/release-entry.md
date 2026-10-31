## 80.6.29 ({{STAMP}}): one Library pill, and a rail that holds still

- **WHAT THE OWNER SAID.** *"make the bottom tab with the diagonal of library and albums just Library, and make the side tab bar 85
  percent see through with adjustable stuff in tools, make it stay still every time I move between the tabs they keep moving down,
  make the changes to regular version as well just without the streaming stuff obviously for that for full do everything make this
  nice"*. Three changes - the dock tab, the rail's glass, and the rail's place - and he wants them on both channels.
- **WHY THE RAIL KEPT MOVING DOWN.** It is a `position:fixed` pill, and it was fixed *inside* `#library`. A fixed child is measured
  from its nearest ancestor that establishes a containing block, and a **transform** does that even for the length of an animation.
  Every arrival in a view plays `.sc-view-in`, which is `@keyframes scViewIn` with `transform: translateY(6px)` - and
  `scShelfApply()` calls `navigate('library')` on every page change, so every tap of a rail glyph replayed that animation on
  `#library`. For those 220ms `top:50%` meant half of the **library's whole scroll height** instead of half the screen: the rail
  dropped into the middle of the list and slid back, once per tap. That is the "moving down", and it is why nothing about the rail's
  own CSS was wrong.
- **WHAT CHANGED.** (1) **The dock tab is one Library pill.** The two clipped halves and the seam `<svg>` are gone from
  `#libraryBtn`; it is `<button id="libraryBtn" class="action-pill">Library</button>`, one tap, the same shape as Home and
  Discover, and it shares the dock row evenly (`flex: 1 1 0`). (2) **The split setting retires with the split.** The Tools card that
  switched a two-half dock tab became the rail card; `applyLibraryButtonMode()` is kept as the one place the dock mode is applied
  and applies nothing - it must not append its "Playlists ▾" label, which would write over the word the pill carries now. The old
  `sidecut_diagonalSplit` key is still read, so an existing install keeps its value. (3) **The Library pill follows the source**:
  with the halves gone, its handler asks the shelf first, so on the source it opens the streaming songs page (Playlists and Albums are
  a glyph away) and on the device it falls through to the library exactly as before - `pickReal()` is untouched. (4) **The rail is
  85% see-through, and adjustable in Tools.** Its background is now
  `color-mix(in srgb, var(--bg-raised) var(--scshelf-solid, 15%), transparent)` - 15% solid is 85% see-through - and the weight is
  one CSS variable written by `scRailSee()`, so it holds for a rail that has not been built yet. The new **Streaming rail** card sits
  where the split card was, with a 0-100 slider (0 solid, 100 only the glyphs), a live value on the row, `input` updating the rail
  while the thumb moves and `change` saving `sidecut_railSee`. Values are clamped and rounded, a non-number falls back to 85, and the
  card hides itself in the builds that have no rail (`!SC_STREAM_OK`, i.e. the Play channel). (5) **The rail lives on the body.**
  `scShelfRender()` moves `#scShelfRail` onto `document.body` before it builds it, where no view's transform can reach it, and
  `navigate()` shows and hides it with the library so it does not float over Home or Discover. `top:50%` + `translateY(-50%)` are
  unchanged - with the body as its containing block that is the screen, and it stays there.
- **WHAT WAS DELIBERATELY NOT DONE.** No blur came back with the transparency: 80.6.25 took `backdrop-filter` off a fixed pill
  because it juddered over a scrolling list, and that stands. The border stays at full strength - an edge is what says the glyphs are
  a rail and not loose icons over artwork. Nothing about `libraryMode`, the library's own tab strip, the albums, the playlists or the
  shelf's pages changed; the guarded half-wiring block still sets `window.__bootDone` and `__scLibraryModeWired`, which the rest of
  the page reads. The Play channel gets the dock pill and the retired split automatically, because it is this page with
  `__PLAY_BUILD__` set and the rail is gated on `SC_STREAM_OK`.
- **WHAT WAS RUN.** `dev/patch-80629.py` over the released 80.6.28 page: `--check` **1** before, 14 steps applied, a second run a
  no-op, `--check` **0**. `dev/check-80629.cjs` passes **50 checks**, and the ones that matter are run, not read: `scRailSee` in a vm
  (85 -> `--scshelf-solid: 15%`, 0 -> `100%`, 100 -> `0%`, 140 and -20 clamped, `'abc'` falls back to 85, 42.6 rounds to 43 and the
  weight follows, the slider is written to and the row reads back, and the card is hidden when `SC_STREAM_OK` is false). It also
  proves the reparent sits inside `scShelfRender` *before* the rail is built, that `navigate()` shows and hides the rail with the
  library, that the Library handler asks the shelf *before* the downloaded `navigate('library')`, that no `#playlistsHalf`,
  `#albumsHalf` or `lib-single-label` path survives, and that all seven inline scripts compile. OTA rebuilt to a true fixed point -
  root + `ota/` **{{ROOT}}** bytes at v80.6.29, the `ota-play/` channel (**{{PLAY}}** bytes) rebuilt from the same page.
- **NOT CLAIMED.** There is no phone and no browser here. The drift was diagnosed from the code (a fixed pill inside an animated
  transform), not watched on a screen; nobody has slid the new rail slider, seen the rail at 85% over artwork, or tapped the single
  Library pill on a device. The logic, the CSS and the markup are proven; the look is not.
