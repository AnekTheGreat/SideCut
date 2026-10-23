## 80.0.10 ({{STAMP}}): the plus works, the flight is small, the bar covers the bottom

- **THE OWNER'S SCREENSHOT, AND THREE FAULTS IN IT.** "THE ADD SONGS POPUP ISNT
  SHOWING IN CLOUD MODE JUST MAKE IT ICONS ON THE BOTTOM IS A SMALL BOTTOM RIGHT
  STAIRCASE. THE SIMPLIFIED NOW BAR SHOULD COVER THE BOTTOM NOT PROTRUDE LIKE IT IS
  NOW." The screenshot showed five tall glass treads standing on the bubble grid,
  a bar lifted off the bottom edge with a strip of page under it, and a plus that
  did nothing.
- **THE SHEET WAS OFF SCREEN, NOT MISSING.** 80.0.9 kept the old dock rule
  `#addSongsMenu{ bottom: calc(100% + 10px) }`. The menu is `position: fixed` inside
  the fixed strip, so 100% is the VIEWPORT: the sheet opened a full screen above the
  top edge, which is exactly what a dead plus looks like. It is a screen-level sheet
  above the bar now, and its JS moves the sheet and its backdrop to `<body>` so their
  fixed positions measure the screen and the z-index is not trapped in the strip.
- **THE FLIGHT IS SMALL AND IN THE CORNER.** Five 46px treads joined edge to edge,
  each exactly 10px taller than the one on its left, all standing on the bar, the plus
  closing the flight at the top right. 230px wide instead of the whole width. The
  icons sit at the middle of a tread, so they climb with the steps; the old corner
  column's 42/28/14px margins are cancelled, which is why the treads now touch.
- **THE SPLIT TREADS KEEP THEIR CUT** and their two icons now sit side by side at the
  middle of the tread (list, grid; mixer, wrench) instead of one at each far corner
  of a 76px-tall step.
- **THE BAR COVERS THE BOTTOM.** 80.0.3 lifted the player by the phone's inset and
  80.0.9 gave it the inset's height on top of that, so it floated one inset above the
  edge. Bottom zero, full width, `--sc10-bar` = the sixty pixel row plus
  `env(safe-area-inset-bottom)`, the row at the top of the bar and the inset part of
  it. No top border (the 3px scrub line is the top edge) and no bottom corner radius.
  The title and artist truncate with an ellipsis, so a long name cannot shove the
  transport across the bar.
- **THE SHEET CLOSES FOUR WAYS** - its own X (an SVG, because the bundled font has no
  U+2715), the backdrop, Escape, and after you pick a row - and it is styled as rows
  with surfaces instead of five floating labels, because the cloud layout's
  `.action-pill` is transparent.
- **NOTHING WAS DROPPED.** Shuffle, Repeat and DJ Mode are still in the `...` menu
  wired to the same buttons, Lyrics and Song info are still there, the record's
  progress ring stays off the 40px disc, and the classic layout keeps its own dock
  and its full now bar.
- **SEEN, NOT GUESSED.** Headless Chromium at 412x915 and 900x1000 with the missing
  `libnspr4`/`nss`/`atk` objects unpacked locally and a fontconfig file so text lays
  out: rects and computed styles read out of the page, a real mouse click on the plus
  (the sheet lands in the viewport, `parentElement === BODY`, Escape and the X both
  close it), a long title measured at 426px of text in a 112px box with
  `text-overflow: ellipsis`, and the classic layout re-checked with the same probe.
- **THE GATE.** `dev/staircase-check.cjs` is rewritten whole (**68/0**): the corner
  rail and the five joined treads one riser apart, the lit top edge, six icon masks,
  the split halves side by side, the flush full-width bar and its inset accounting,
  the ellipsis, the screen-level sheet and its four closes, the views' reserve, the
  version, the shell cache and the changelog head.
  `dev/patch-gate-80010.py` checks that rewritten gate arrived intact.
- **THE REPIN.** `dev/repin-80010.mjs`: live pin 80.0.9 -> **80.0.10**, adjacency
  `PREV` 80.0.8 -> **80.0.9**, both regex spellings swept, `--check` clean in 0.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
