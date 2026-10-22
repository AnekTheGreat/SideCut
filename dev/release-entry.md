## 80.0.9 ({{STAMP}}): a staircase across the width, and a mini player

- **THE OWNER'S WORDS.** "WHY IS A CHUNK IT SHOULD SPREAD OUT LIKE A NICE
  STAIRCASE ... I TOLD YOU TO REMOVE THE NOW BAR FROM CLOUD MODE AND REPLACE IT
  WITH A SIMPLER VERSION ... YOU CAN MAKE THE TABS IN CLOUD MODE ICONS."
- **THE CHUNK WAS THE COLUMN.** 80.0.5 to 80.0.8 stacked four pills in the bottom
  right corner and nudged each 14px sideways. The first cut of 80.0.9 answered with
  five square tiles floating in a row nine pixels apart in height - a row with a
  wobble, not a flight.
- **THIS IS A FLIGHT.** Five treads, edge to edge, across the whole width, each the
  same width and one riser (15px) taller than the one on its left, every tread
  standing on the top of the bar. The bottoms are one line, the tops climb from the
  bottom left corner to the top right one, and the plus closes the flight as its
  tallest step. Each tread carries a lit hairline along its top edge, which is what
  makes the eye read one staircase instead of five panes of glass.
- **THE TABS ARE ICONS.** A house, a stack, a compass, a mixer, and the plus. Each
  one is a mask in `currentColor`, so an asleep tab is glass grey and the tab you
  are on is filled coral. The words stay in the DOM (a screen reader still reads
  Home, Library, Albums, Discover, Studio, Tools) at `font-size: 0`.
- **THE SPLIT TREADS KEPT THEIR CUT** - and gained a small icon in each end of the
  cut (list / grid, mixer / wrench), so an icon-only tread still says which half
  you are tapping.
- **THE BAR IS A MINI PLAYER.** Sixty pixels, one row: the record, the two lines,
  previous, play, next, the menu, and a 3px hairline across the top that is
  drag-to-seek (`#miniBar`, the compact bar's own control). The DJ/LYRICS row, the
  seek row and the progress ring around the record are not drawn in this layout.
  Shuffle, Repeat and DJ Mode were moved into the `...` menu, wired to the same
  buttons - nothing was dropped with the console. The bar keeps the flight's own
  760px band, so the two stack instead of drifting apart on a computer.
- **IT CANNOT DRIFT NOW.** The rail used to sit on `--sc80-player`, a number JS
  wrote on the first frame after a layout change; in a browser that never ran that
  write it stayed at its 112px fallback and the rail floated 52px above the bar -
  the same drift the owner photographed, from the same cause. The bar has one
  height in this layout (`--sc89-bar`), and the rail, the bar and every view read
  that one constant.
- **SEEN, NOT GUESSED.** Checked in a real headless Chromium at 412x915 and at
  900x1000 - `chrome-headless-shell` with the missing `libnspr4`/`nss`/`atk`
  objects unpacked locally, and a fontconfig file so text lays out - plus a probe
  that reads rects and computed styles out of the live page. That is how the nine
  pixel nudge that still read as a row, the stale `--sc80-player`, the joined-dock
  capsule drawn across the treads, the clipped ellipse where the record should be,
  and the record's progress ring at 38px were found and fixed.
- **THE GATE.** `dev/staircase-check.cjs` is rewritten whole (79/0): the rail, the
  five heights one riser apart, the treads standing on the bar, the lit top edge,
  the 760px band, six icon masks, the half corners, the coral active rule, the
  capsule hidden, the 60px mini bar, the hairline, and the menu carrying the three
  controls. `dev/patch-gate-8009.py` checks that rewritten gate arrived intact.
- **THE REPIN.** `dev/repin-8009.mjs`: live pin 80.0.8 -> **80.0.9**, adjacency
  `PREV` 80.0.7 -> **80.0.8**, both regex spellings swept, `--check` clean in 0.
  127 edits across 52 gate files.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
