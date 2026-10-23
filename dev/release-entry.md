## 80.2 ({{STAMP}}): the cloud layout, tidied - round bubbles, a curve of icon tabs, Lyrics back in the bar

- **THE OWNER'S SCREENSHOT, AND FIVE FAULTS IN IT.** "THE CIRCLES NEED TO BE MORE
  WELL OPTIMIZED THINGS ARE LOOKING WEIRD AND TABS SHOULD LEGIT JUST BE ICONS ...
  SHOULD KIND OF CURVE UP BUT NICELY, IT'S NOT SMOOTH AT ALL IN THIS MODE LIKE IT
  SHOULD BE AND IN THE NOW BAR THERE SHOULD BE LYRICS OPTIONS STILL, IN ALBUMS AND
  PLAYLISTS A WHOLE PART GETS LIKE TURNS THEME MATCHING BLUE AT THE BOTTOM WHICH
  WASTES SPACE ... JUST MAKE THIS MODE BETTER."
- **THE ICON WAS ON TOP OF THE NUMBER.** `.hb-ico` was absolutely placed at the
  bubble's centre, 128% of its own height up, so on a 172px circle the headphone
  landed on the "0m" and the person on "Top artists". The wall is a two-column grid
  now and a bubble is a column - icon, value, label - with the label clamped to two
  lines, `grid-column:auto` so a "wide" bubble is one cell instead of a full-width
  circle, and the resize chip, the Ask sparkle, the play button and the three header
  buttons each on the rim clear of the reading.
- **THE STAIRCASE BECAME A CURVE.** Five joined 46px treads with a hairline each is
  a staircase of rectangles. It is five equal 44px tiles with an 8px gap, lifted
  0/6/16/28/42px, so the row rises smoothly to the plus. ONE GLYPH A TAB: the split
  treads keep both of their tap targets and stop painting two icons inside a tile.
- **LYRICS IS BACK IN THE BAR,** as an icon in `#npControls` before the `...` menu,
  clicking the same `#lyricsBtn` - one handler, one lyrics view, same saved-versus-
  online behaviour.
- **THE BAND WAS THE RESERVE.** Every view reserved `--sc10-bar + --sc10-rail + 16px`
  (146px) under its last row, which is a band of theme colour with nothing in it.
  The views reserve the bar plus 12px now; the flight floats over the corner with a
  soft scrim, and only the bubble wall keeps its own bottom air, because a 172px
  circle under the tiles is a whole bubble lost.
- **AND IT MOVES SMOOTHER.** The six bubbles no longer float on a 7.5s loop (six big
  circles repainting forever while a list scrolls under them) and the tiles drop
  their per-tile backdrop blur; the bar keeps 10px of glass instead of 22.
- **THE GATE.** `dev/staircase-check.cjs` is rewritten whole (**46/0**): the grid and
  the column, the curve and the one-glyph rule, the lyrics button and its forward,
  the new reserve, and the changelog and cache pins. `dev/patch-gate-802.py` checks
  that it arrived that way.
- **THE REPIN.** `dev/repin-802.mjs`: live pin 80.1 -> **80.2**, adjacency `PREV`
  80.0.9 -> **80.1**, both regex spellings swept, `--check` clean in 0. 127 edits
  across 52 gate files.
- **THE CHANGELOG HEAD HAS SEVEN NOTES** on purpose: `test-738` requires at least
  seven, no apostrophes, and the words widget, player, lyrics and letter - the first
  draft had six and the battery caught it.
- **SEEN, NOT GUESSED.** Headless Chromium at 390x844 with a seeded 40-song library:
  the wall, the flight, the library, the Albums tab, the bar with the lyrics icon
  (it answers "Play a song first" with nothing loaded, which is the pill's own
  handler), and the classic layout re-shot to prove it did not move.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
