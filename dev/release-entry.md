## 80.7.8 ({{STAMP}}): phones kept their own

- **WHAT THE OWNER SAID.** *"why did you change the size of the buttons and remove the your files, no ads ever thing on the bar phones
  remove that"* - the `Your files, no ads ever` line gone from the bar, and the buttons a different size, on the one device that was
  never broken.
- **MY MISTAKE, PLAINLY.** 80.7.7 was written to fit every screen at once and it reached into the phone layout on the way past.
  Three of its nine rungs touched a phone and never should have: the `max-width:380px` rung (which covers an iPhone SE, a 12 mini
  and any window narrowed on a desktop) hid `header .brand span` - the `Your files, no ads ever` line - and shrank the dock pills
  and the player's buttons to 10.5px and 30x34; the `orientation:landscape and (max-height:520px)` rung hid the same line again on
  any phone held sideways; and `(pointer:coarse)` raised the tabs, the dock and the header icons to a 44px minimum on every phone
  and tablet. None of that was asked for, and the phone was the one screen that already looked right.
- **WHAT LANDED.** The sheet is cut from nine rungs to five, and every one of them starts at 561px wide. Deleted outright: the
  narrow-screen rung, the landscape rung, the coarse-pointer rung, every `.brand span{ display:none }`, and every size change on a
  tab, a dock pill, a header icon or a player button below a television. The two rungs a sideways phone could still have matched
  now carry `and (min-height:521px)` as well, so a phone in landscape keeps the phone layout instead of being handed the tablet
  one. What is left is what the owner actually asked for: fluid side padding measured against the display insets, the inner-fold
  measure, the centred desktop dock instead of five pills spread across a monitor, the 1440 rung, and the television rung - which
  is now the only place in the sheet that changes a target size, and cannot match a phone.
- **WHAT WAS RUN.** `dev/patch-8078.py` over the released 80.7.7 page: `--check` **1** before, **3 steps** applied, a second run a
  no-op, `--check` **0**. Both channels rebuilt to a true fixed point on pass 3. `dev/check-8078.cjs` **57 passed, 0 failed**
  against the shipped bytes: it enumerates every `@media` in the sheet and pins the exact five allowed (so a new phone-shaped rung
  cannot be added quietly), asserts the line under the title is never hidden, that no rule is keyed to `pointer: coarse`, to a
  phone-width breakpoint or to `max-height`, that the two sideways-phone rungs carry the height floor, that the player buttons and
  the player stage are resized only inside the television rung, that the dock only clusters from 1024, and it repeats the 80.7.7
  audit of the insets, of `!important`, of the cloud-theme gating and of every inline script. Full channel **{{ROOT}}** bytes, Play
  channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** There is still no phone in this environment, so nobody has held this build. What is proven is stronger than
  before in one specific way: the sheet can no longer match a phone-width viewport at all - not by accident, because the checker
  pins the complete list of its queries - so the layout a phone gets is the layout it had before 80.7.7.
