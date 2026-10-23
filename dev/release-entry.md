## 80.1 ({{STAMP}}): the corner flight, under the number it should have had

- **80.0.10 WAS NEVER A VERSION, AND THIS REPOSITORY ALREADY SAID SO.** The comment
  directly above `APP_VERSION` has carried the rule since 60.1 - "the third number
  stops at nine: 60.0.9 is followed by 60.1 (never 60.0.10)" - and `AGENTS.md` says
  it twice in the 80 line: "NEXT RELEASE: `80.1`". The release that shipped the
  corner flight, the covering bar and the working plus was numbered 80.0.10 anyway.
  The owner's correction was one line: "it should be v80.1 bro READ THE AGENT MD".
- **SO THIS RELEASE MOVES THE NUMBER, AND ONLY THE NUMBER.** `APP_VERSION` 80.0.10 ->
  **80.1**, the cloud block's two banners, the changelog head's version and stamp
  (with one note saying why), and the shell cache
  `sidecut-shell-v80.0.10` -> **`sidecut-shell-v80.1`**. The flight, the bar and the
  sheet are byte-for-byte what 80.0.10 shipped; the page's hash before this patch is
  the tree that release produced.
- **NO ORPHAN ENTRY.** The 80.0.10 changelog entry is not kept under a number that
  never existed - it becomes the 80.1 entry, so the list reads 80.1, then 80.0.9.
  That is also why the adjacency `PREV` stays **80.0.9**: it is the release before
  this one, and 80.0.10 was no release at all.
- **WHAT THIS RELEASE STILL CARRIES** (the work the owner asked for): five 46px icon
  treads joined edge to edge in the bottom right corner, one riser a step, the plus
  closing the flight; a full-width mini player flush with the bottom edge, its inset
  part of the bar, the scrub line its top edge and long titles ending in an ellipsis;
  and the add-songs sheet as a screen-level panel above the bar, with its own X,
  Escape, the backdrop and a close after you pick - the fix for a sheet that opened a
  full screen above the top edge.
- **THE GATE.** `dev/staircase-check.cjs` moves its four release strings (banner,
  APP_VERSION, shell cache, changelog head) and stays **68/0**.
  `dev/patch-gate-801.py` checks that it arrived that way.
- **THE REPIN.** `dev/repin-801.mjs`: live pin 80.0.10 -> **80.1**, adjacency `PREV`
  left at **80.0.9**, both regex spellings and the cache swept, `--check` clean in 0.
- **THE LESSON, WRITTEN DOWN WHERE THE NEXT SESSION LOOKS.** A version is not a label
  chosen at the end: the page states its own rule above the constant, and the release
  number has to be read against it before the payload is cut, not after it ships.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
