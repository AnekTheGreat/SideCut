## 80.8 ({{STAMP}}): hold and drag to pick a run of songs

- **WHAT THE OWNER SAID.** *"Add a hold and drag to select songs, make it nice."* Holding a row was already possible; it was
  holding and *going somewhere* that the app could not do.
- **WHY THE DRAG WAS IMPOSSIBLE, NOT JUST MISSING.** `attachLongPressChoice()` started a 450 ms timer and called
  `openHoldChoice()` the moment it fired - while the finger was still down. The choice sheet's backdrop then landed over the
  list, so the finger that began the press had nothing left to cross: a run of songs meant hold, tap *Select multiple songs*,
  then one tap per row. The gesture the owner asked for was blocked by a sheet being open at the time.
- **THE HOLD NOW ARMS THE ROW.** It tints the row and gives a short buzz instead of opening anything, and the same finger carries
  on into a drag. Crossed rows take the list's own selection styling as the finger passes, and the sweep follows the direction
  it is pulled: from the held row down the list, or back up above it. The range is always the run between the held row and the
  row under the finger, so pulling back shortens it (one row is one song). Near either edge of the list the sweep scrolls the
  pane under itself, faster the closer the finger gets, because a long library cannot be crossed without it.
- **NOTHING IS REBUILT MID-GESTURE.** `renderList()` rebuilds the pane, and doing that under a moving finger takes the row the
  gesture started on out of the document - so rows are painted in place (class plus check mark) and the list is drawn once,
  properly, when the finger lifts. The click the lift itself sends to the row under the finger is swallowed, because in select
  mode a click toggles and it would have deselected the anchor and left the run one short. The click after that is a tap again.
- **IT SAYS SO WHILE IT HAPPENS.** A count rides at the top of the screen (*7 songs selected*), positioned there rather than in a
  bar under the list because the thumb is over the list while the drag is running. `touch-action` is pinned for the length of the
  sweep, or Android hands the vertical gesture to the scroller on the first centimetre, fires `pointercancel`, and the run stops
  at the second row.
- **A HOLD THAT DOES NOT MOVE IS UNCHANGED.** It still opens the same sheet (favourite, play next, select multiple, reorder), so
  nothing that used to work was taken away to make room for the drag.
- **WHAT WAS RUN.** `dev/patch-808.py` over the released 80.7.12 page: `--check` **1** before, **4 steps** applied, a second run
  a no-op, `--check` **0**; both channels rebuilt to a true fixed point. `dev/check-808.cjs` lifts the gesture out of the shipped
  page and **drives** it on a fake list (**49 checks, 0 failed**): hold then drag down selects the run, dragging back up selects the
  run above the anchor, pulling back to the anchor leaves one song, a hold that lifts without moving opens the sheet and selects
  nothing, a tap is still a tap, a scroll that starts before the hold arms selects nothing and opens nothing, a missing row under
  the finger leaves the selection alone, the count reads *1 song selected* / *3 songs selected*, lifting re-renders once and hides
  the count, and the click that follows the lift is swallowed. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no browser in this environment, so nobody here has dragged across a real list with a real thumb:
  what is verified is the gesture logic, the paint, the swallow and the channels, driven against the shipped bytes.
