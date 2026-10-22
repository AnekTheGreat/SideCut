## 80.0.6 ({{STAMP}}): the two missing tabs are back on the staircase

- **WHAT THE OWNER SAW.** Two screenshots of the cloud layout: Home there, Discover
  there, a plus in the corner, and two empty steps where Library and Studio should
  be. "I can't even get out of this mode because all of the tabs aren't present."
  Both symptoms are one bug, and the second is the consequence: Settings lives
  behind the Studio tab.
- **THE BUG WAS MINE, AND IT WAS A HEIGHT.** 80.0.3 sized the pills from the old
  bar, with ID selectors:
  `body.sc80-cloud .action-strip > *{ flex: 1 1 0; width: auto }`,
  `> #libraryBtn{ flex: 1.18 1 0 }`, `> #studioBtn{ flex: 1.5 1 0 }`. In a row,
  `flex` is width. 80.0.5 made the strip a COLUMN, where `flex` is HEIGHT, and
  those three rules are written with IDs, so they outranked the staircase's
  `body.sc80-cloud .action-strip > button` no matter where the block sat. The two
  pills that carry their own IDs - Library and Studio, exactly the two split ones -
  computed to **0px tall**. They were in the DOM the whole time, with their
  margins, their cut and their click handlers, invisible.
- **THE FIX IS A RULE WITH THE SAME IDS.** All five pills are restated together
  (`flex: 0 0 auto; width: var(--sc80-pill-w); height: var(--sc80-pill-h)`), which
  carries the same weight as the rules it replaces and comes later in the sheet.
  The two split pills get `calc(var(--sc80-pill-w) + 16px)`, because each still
  holds two names across the cut, and their halves' padding drops to 3px/7px so a
  42px pill reads.
- **THE GATE LEARNED TO SEE IT.** `dev/staircase-check.cjs` was 36/0 while the
  layout was unusable, because every check in it measured something a 0px pill
  still has - a margin, a clip-path, a DOM node. `dev/patch-gate-8006.py` adds
  section **[8]**, six checks that read the sizing block itself: all five pills
  sized together, `flex: 0 0 auto`, the staircase variables, the old bar rule still
  present and overridden *after* it, and the extra width on the split pills. Run
  against the 80.0.5 page it is **6 FAILED / 36 passed**; against this tree,
  **42/0**.
- **NOTHING ELSE MOVED.** The staircase's offsets, the wider wall, the 900/1280
  rows, the motion set and the measured player height are byte-identical to
  80.0.5. Classic layout untouched. This release is the bug and the pin.
- **THE REPIN.** `dev/repin-8006.mjs`: the live pin moves 80.0.5 -> **80.0.6**,
  adjacency `PREV` moves 80.0.4 -> **80.0.5**, both spellings of the release regex
  swept. 127 edits across 52 gate files, `--check` clean in 0.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1** ("and it no longer fires
  every half hour"), the recorded pre-existing red this repository has carried for
  months. Everything else is green; `dev/gates-report.txt` in the release commit is
  the full list.
- **STILL OPEN: THE PLAYER IN THIS LAYOUT.** The owner's second note on the
  screenshots - no now bar, and a simpler player with every feature of the regular
  one - is not in this release. It needs a decision on where that player sits
  before it ships, so it is next, not smuggled in behind a bug fix.
