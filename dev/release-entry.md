## 80.0.9 ({{STAMP}}): a staircase across the width, and a mini player

- **THE OWNER'S WORDS.** "WHY IS A CHUNK IT SHOULD SPREAD OUT LIKE A NICE
  STAIRCASE ... I TOLD YOU TO REMOVE THE NOW BAR FROM CLOUD MODE AND REPLACE IT
  WITH A SIMPLER VERSION ... YOU CAN MAKE THE TABS IN CLOUD MODE ICONS."
- **THE CHUNK WAS THE COLUMN.** 80.0.5 to 80.0.8 stacked four pills in the bottom
  right corner and nudged each 14px sideways. They are one row across the whole
  width now - five tiles, spread by the rail itself, each one a step higher than
  the tile on its left, the plus closing the flight in the top right.
- **THE TABS ARE ICONS.** A house, a stack, a compass, a mixer, and the plus. Each
  one is a mask in `currentColor`, so an asleep tab is glass grey and the tab you
  are on is filled coral. The words stay in the DOM (a screen reader still reads
  Home, Library, Albums, Discover, Studio, Tools) at `font-size: 0`.
- **THE SPLIT TILES KEPT THEIR CUT** - and gained a small icon in each half's own
  corner, so an icon-only tile still says which half you are tapping.
- **THE BAR IS A MINI PLAYER.** Sixty pixels, one row: the record, the two lines,
  previous, play, next, the menu, and a 3px hairline across the top that is
  drag-to-seek (`#miniBar`, the compact bar's own control). The DJ/LYRICS row and
  the seek row are not in this layout. Shuffle, Repeat and DJ Mode were moved into
  the `...` menu, wired to the same buttons - nothing was dropped with the console.
- **IT CANNOT DRIFT NOW.** The rail used to sit on `--sc80-player`, a number JS
  wrote on the first frame after a layout change; in a browser that never ran that
  write it stayed at its 112px fallback and the rail floated 52px above the bar -
  the same drift the owner photographed, from the same cause. The bar has one
  height in this layout (`--sc89-bar`), and the rail, the bar and every view read
  that one constant.
- **SEEN, NOT GUESSED.** This release was checked in a real headless Chromium at
  412x915 - `chrome-headless-shell` with the missing `libnspr4`/`nss`/`atk` objects
  unpacked locally, and a fontconfig file so text lays out - plus a probe that
  reads rects and computed styles out of the live page. That is how the stale
  `--sc80-player`, the joined-dock capsule drawn across the tiles, the clipped
  ellipse where the record should be, and the active tab staying glass were found.
- **THE GATE.** `dev/staircase-check.cjs` is rewritten whole (73/0): the row, the
  five steps, one tile size, six icon masks, the coral active rule, the capsule
  hidden, the 60px bar, the hairline, and the menu carrying the three controls.
  `dev/patch-gate-8009.py` checks that rewritten gate arrived intact.
- **THE REPIN.** `dev/repin-8009.mjs`: live pin 80.0.8 -> **80.0.9**, adjacency
  `PREV` 80.0.7 -> **80.0.8**, both regex spellings swept, `--check` clean in 0.
  127 edits across 52 gate files.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
