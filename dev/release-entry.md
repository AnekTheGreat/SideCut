## 80.2.7 ({{STAMP}}): the Home bubble sizes arrive in order, and the long jumps have rungs in them

- **THE OWNER ASKED FOR TWO THINGS.** "it should be in order the way it goes the
  resizing and add more in between spots", with a phone screenshot of Home. Both halves
  were real: the size walk went backwards twice, and two of its steps were single taps
  of more than 60px with nothing in between them.
- **THE ORDER WAS TWO STEPS BACKWARDS.** The expand chip walked
  mini 60 -> small 84 -> **medium 146 -> automatic 118** -> tall 158 -> **wide 96** ->
  full 200 -> XL 260. Tapping a middle-sized card made it shorter (146 -> 118), and
  tapping a tall one dropped it onto a 96px full-width banner: -28px and -62px inside a
  list whose only job is to grow a card. The two remaining jumps were 62px
  (small -> medium) and 60px (full -> XL).
- **THE LADDER IS NOW ONE LINE.** 60, 84, 96, 118 (automatic), 146, 158, **179**,
  200, **230**, 260 - every tap a taller card than the one before it, and one tap past
  XL puts the bubble back to automatic. The heights live in one table beside the walk
  (`HB_SIZE_HEIGHTS`), so the chip cannot get out of step with the stylesheet, and
  section [6] of the gate reads that table and makes the CSS draw every rung at the
  height it names.
- **TWO RUNGS FILL THE LONG JUMPS.** `hb-size-roomy` at **179px** sits between tall
  (158) and full (200), and `hb-size-grand` at **230px** sits between full (200) and XL
  (260). Grand spans the row like full and XL do, because a 230px card in half of a
  phone's width is a column, not a bubble. With them in, the biggest step anywhere in
  the walk is **30px**.
- **MEASURED, NOT GUESSED.** The same page, the same jsdom boot, the chip driven from
  automatic the way a thumb would:

  | tap | 80.2.6 walk | 80.2.7 walk |
  |---|---|---|
  | 1 | medium 146 (+62 from small) | medium 146 (+28 from automatic) |
  | 2 | automatic 118 (**-28**) | tall 158 (+12) |
  | 3 | tall 158 (+40) | roomy 179 (+21) |
  | 4 | wide 96 (**-62**) | full 200 (+21) |
  | 5 | full 200 (+104) | grand 230 (+30) |
  | 6 | XL 260 (+60) | XL 260 (+30) |
  | 7 | small 84 (wrap) | automatic (wrap) |

  The last row is the point of the order: the wrap is now the only place the card gets
  smaller, and it is the one tap that means "back to automatic".
- **THE STEPPER FROM THE OTHER END.** The Sandbox height stepper moved in half steps of
  a 118px base, so 118, 177, 236 - the same complaint about spots that are too far
  apart. It moves in **quarter steps** now: 118, **148**, 177, **207**, 236, and so on to
  4x, twelve stops where there were six. Quarters are stored cleanly (1.25, not
  1.2500000000000002) and the H readout was widened for the second decimal.
- **THE STATS CARD FOLLOWS.** The two bigger lines 80.2.6 gave the listening stats
  bubble now apply on Roomy and Grand as well, so a taller card is not a taller empty
  one. Every other size keeps the type it had.
- **THE GATE.** `dev/home-bubble-size-check.cjs` - the gate that argued for the middle
  size in 74.1.9 and pinned the stats floor in 80.2.6 - gains section **[6]** through
  `dev/patch-gate-8027.py`, and is **55/0**; on the 80.2.6 tree the same file is
  **33/22**, with the order, both new rungs, the CSS cross-check, the driven ten-tap
  walk and the four quarter steps all named red. Sections [1] and [3] are repinned to
  the new walk and the new step, and [4]'s reset filter learned the two new classes.
- **THE REPIN.** `dev/repin-8027.mjs`: live pin 80.2.6 -> **80.2.7**, adjacency `PREV`
  80.2.5 -> **80.2.6**, both regex spellings and the escaped version pin swept,
  `--check` clean in 0. **133 edits across 55 gates.**
- **A BUG THE REHEARSAL CAUGHT BEFORE THE TREE WAS HASHED.** The first draft of this
  release stamped its changelog entry **3:40 PM EDT**, two hours ahead of this
  sandbox's clock, and `ask-rail-check` came back **55/1** - *"and it is not stamped in
  the future"*. The stamp is the one thing in a release that a gate reads against the
  wall clock, so it was moved to 1:40 PM EDT and the OTA bundles were rebuilt on the new
  bytes; the suite is **56/0** on the tree that ships.
- **THE CHANGELOG HEAD HAS SEVEN NOTES** on purpose: `test-738` requires at least seven,
  no apostrophes, the words widget / player / lyrics / letter, and no downloader or
  converter term.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point in
  the runner and both `--check`s green on the tree that ships.
- **WHAT DOES NOT MOVE.** The height of every size that already shipped (mini 60, small
  84, wide 96, medium 146, tall 158, full 200, XL 260), any size already saved on a
  bubble, the circle wall, the classic layout, the widget, the player, the lyrics view,
  the letter covers and the album pill dock.
- **THE ONE RED LEFT** is `media-controls-check` **60/1**, the recorded pre-existing red
  this repository has carried for months.
- **TWO SUITES OUTSIDE THE BATTERY** are red at exactly the counts a pristine 80.2.6
  tree reports on this machine - `test-70` **179/3** and `v60-check` **51/8** - and
  neither is wired into `dev/gates.sh`. They are recorded here so the next session finds
  them as the state they were found in, not as this release's doing.
- **A SECOND RED LIVES IN THE SANDBOX, NOT IN THE PAGE.** `converter-identity-check`
  times a real encoder loop against a frame budget, so on a loaded machine it reports
  **36/1** ("the frame budget holds it for 35ms, inside a frame") - and it reports the
  same red on a pristine 80.2.6 page (**46ms**) on this sandbox. The battery that
  rehearsed this release came back with it red on both trees and every other suite but
  the recorded one green (**67 suites**). Nothing here touches the encoder.
