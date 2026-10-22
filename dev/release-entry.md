## 80.0.7 ({{STAMP}}): the cloud layout has one now bar, and it is simple

- **THE OWNER'S WORDS.** "For the cloud version, I want a simpler now bar." That
  is the whole brief, and it settles the question 80.0.6 left open: one bar, in the
  cloud layout, smaller than the full player - not a second chip above it.
- **TWO PLAYERS BECAME ONE.** The cloud layout carried the docked player *and* a
  small now chip in the top right mirroring it. The chip is `display: none` in this
  layout now. Classic layout still has the docked player at full size: nothing in
  this release reaches it.
- **SIMPLER, MEASURED IN THE FOUR PLACES THAT MAKE IT SIMPLER.** `#npPlayerStage`
  62x52 -> **38x34** (with the 3D deck scaled 0.62), `#npControls button` 36 -> **30**,
  the title **13.5 -> 12px** and the artist **11.5 -> 10px**, and the three rows
  closed to a **2px** gap with 6px side padding. The bar keeps its glass, its top
  border and its blur.
- **NOTHING WAS DROPPED.** Shuffle, prev, play, next, repeat, the menu, DJ MODE,
  LYRICS, the ONLINE badge, the seek line and both times are all still there - a
  simpler bar that loses a feature is not simpler, it is less. The gate says so in
  as many words: the chip's is the **only** `display: none` in the whole block.
- **THE STAIRCASE FOLLOWS IT.** It is positioned from this bar's measured height
  (`--sc80-player`, written by `applyLayout`), so a shorter bar moves the staircase
  down with it instead of leaving a hole above the transport.
- **THE INSET IS STILL RESERVED ONCE.** The bar does not re-reserve
  `env(safe-area-inset-bottom)`: in this layout the element is already lifted by
  `bottom`, and `studio-70-check` owns the rule that the player never counts that
  inset twice. My first cut of this rule did, and the gate caught it - 568/2.
- **THE GATE GREW A SECTION.** `dev/patch-gate-8007.py` adds **[9]** to
  `dev/staircase-check.cjs`: the block exists, the chip is hidden, the four things
  that make the bar smaller are there, nothing else is hidden, and the inset is not
  reserved twice. 49 checks, **49/0**.
- **THE REPIN.** `dev/repin-8007.mjs`: the live pin moves 80.0.6 -> **80.0.7**,
  adjacency `PREV` moves 80.0.5 -> **80.0.6**, both spellings of the release regex
  swept, `--check` clean in 0. 127 edits across 52 gate files.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1** ("and it no longer fires
  every half hour"), the recorded pre-existing red this repository has carried for
  months. Everything else is green; `dev/gates-report.txt` in the release commit is
  the full list.
