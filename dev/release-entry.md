## 80.2.1 ({{STAMP}}): the Lyrics icon stays in the cloud bar, the seam leaves the tiles, the circles get air

- **THE OWNER, ONE RELEASE LATER.** "THE EXTRA LYRICS BUTTON IN THE NOW BAR SHOULD
  SHOW FOR [THE] CLOUD MODE ... AND EDIT THE CIRCLES SLIGHTLY AND PATCH MINOR BUGS
  UP IN THAT MODE." Three of the four things in this release were visible on a phone
  the day after 80.2 landed.
- **THE ICON WAS IN BOTH BARS, AND THAT WAS A SPECIFICITY BUG.** 80.2 hid it with
  `#sc11Lyrics{ display:none }`, but the bar's own `#npControls button{ display:flex }`
  is one id PLUS a type and outranks it - so the icon painted in the original layout
  too, a second Lyrics sitting beside the LYRICS pill it forwards every tap to. The
  hide is now `#npControls #sc11Lyrics`, at the weight that beat it, and the cloud
  rule is unchanged: one button, one handler, one lyrics view, in the cloud bar only.
- **THE SEAM WAS STILL ON THE TILES.** Library and Studio are cut corner to corner by
  an `<svg>` inside the button - the diagonal the dock pill wore when the dock was one
  control. 80.2 set the two label halves to `opacity:0` and left the line painting, so
  two 44px icon tiles each carried a hairline across them. The svg is
  `pointer-events:none`, so hiding it takes nothing from the two taps the split halves
  still take.
- **THE CIRCLES, A LITTLE.** The icon disc drops 30px -> 28px and 22% -> 15% of the
  accent; the coral wash 16 -> 11; the padding 15/12% -> 14/11; the gap under the value
  is 4px; the play button and the three header buttons move 8px down; and a two-line
  label breaks with `text-wrap:pretty`, so "Listening stats - 0 plays ·" stops leaving
  `0d streak` alone on its own line.
- **THE FADE WAS A PATCH, NOT A BAND.** The scrim under the flight reached 18px past
  the tiles, so the row of a list *beside* them stayed at full contrast while the part
  *behind* them faded. It now runs from the left edge of the screen to the right one
  (`left:calc(12px + 100% - 100vw)`), so the whole band fades and only the tiles sit
  on it.
- **SEEN, NOT GUESSED.** Headless Chromium at 390x844 with a seeded 40-song library,
  before and after: the wall, the bottom of the wall at full scroll (the last row
  clears the plus), the albums list, the studio view, the add-songs sheet, the lyrics
  toast, and the classic layout re-shot to prove the icon is gone there and nothing
  else moved. Measured, not eyeballed: `#sc11Lyrics` computes `display:none` in the
  classic layout and `flex` in the cloud one, both seam svgs compute `display:none`,
  every bubble is 186x186, and the scrim's pseudo-element is 390px wide at 390px.
- **THE GATE.** `dev/staircase-check.cjs` gains section **[7]** - the hide at the
  weight that beats the bar's button rule, the cloud rule still showing it, the seam
  off both tiles, the circle numbers, the label break and the full-width fade - and is
  **56/0**. The section travels alone in `dev/patch-gate-8021.py`, which inserts it and
  then refuses to pass unless every claim of it is in the gate.
- **THE REPIN.** `dev/repin-8021.mjs`: live pin 80.2 -> **80.2.1**, adjacency `PREV`
  80.1 -> **80.2**, both regex spellings swept, `--check` clean in 0.
- **THE CHANGELOG HEAD HAS SEVEN NOTES** on purpose: `test-738` requires at least
  seven, no apostrophes, and the words widget, player, lyrics and letter.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point in
  the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
