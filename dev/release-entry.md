## 80.11 ({{STAMP}}): a laptop you can read, and another way into your library

- **WHAT THE OWNER SAID.** *"also for the full version, label that as another way to get songs into your library thru
  streamed songs, and make UI on laptop not cluttered and hard to see, make it nice to see."*
- **THE LABEL.** 80.10 taught the album chooser to list the albums that exist. The full notes now name it from the
  library's side, which is what it is: **another way to get songs into your library** - add a streamed song to an album you
  already have and it joins that album without being downloaded first. The word has to be *streamed*: the updater drops any
  note that matches `streaming|streams?\b|from the source|pinned artist`, and `streamed` does not match that boundary. The
  note is checked through the same regex the bundler uses, not by eye.
- **WHY A LAPTOP WAS CLUTTERED.** Nothing in the ladder was wrong; the ladder simply never had a rung for the size of screen
  a laptop is. The sheet already grows its gutters and its max-widths at 561, 768, 1024, 1440 and 1600, and the ten-foot
  rung at 1800 grows the type and the targets - but **not one rung moved the type of a list row**. A track title was 14px on
  a phone and 14px on a 27-inch monitor, a playlist heading 13.5px, a dock pill 11px, and all of it was laid out across the
  full width of the window: small text on very long lines, a bubble wall with every bubble stretched to a quarter of the
  glass, and a player glued to the bottom and to both side edges. Wide, flat and small at once is exactly what reads as
  cluttered and hard to see.
- **THE STRAY BRACE.** While measuring the sheet, its head stylesheet turned out to hold 1618 `{` and 1619 `}`. The extra
  brace closed `.pane-header`'s rule one line early, and the two declarations after it - `min-width:0; overflow:hidden;`,
  the two the comment directly above them explains are what stop a long playlist name pushing the whole row wider than the
  window and shoving its sort/kebab buttons off screen - were sitting outside any block, ignored since the day they were
  written. Removing that one brace puts them back inside the rule and brings the sheet to 1613 and 1613. A stray `}` is
  silent in every browser, which is how it survived: no error, just a rule that switched half itself off.
- **THE LAPTOP DESK.** A new rung, `@media (min-width:1024px) and (max-width:1799px)`, appended after the ten-foot rung so
  it is the last word in its range and nothing below 1024 moves at all. In it: a row title at 15.5px with 13px under it,
  list headings at 21px, dock pills at 14.5px, tabs at 13.5px, 56px art, a player title at 17px; the library keeps a
  1040px measure, the bubble wall is capped at 1120px, dialog sheets get 600px (760 and 820 for theme and DJ), the song
  menu gets more room, and the player becomes a rounded card floating 24px inside the window. It uses no `!important`, so
  any more specific sandbox or theme rule still wins, and every floating-player rule is scoped to
  `body:not(.sc80-cloud)` - the cloud layout computes its own dock and bar geometry and is left alone.
- **THE LADDER IS FINISHED.** Above 1800 the ten-foot rung grows the type and the targets but never grew a row, so the tail
  adds the three things it was missing: a 17px row title, 14px under it, 64px art, and a 1200px measure on the library. A
  list is now never set smaller on a bigger monitor than it is on a laptop.
- **NOT A REDESIGN.** No markup moved, no element was added or removed, no font was swapped, and the phone, tablet, cloud
  and sandbox layouts are untouched. This is the same page, sized for the screen it is on.
- **WHAT WAS RUN.** `dev/patch-8011.py` over the released 80.10 page: `--check` **1** before, **4 steps** applied, a second
  run a no-op, `--check` **0**; the head stylesheet now balances at 1613 `{` and 1613 `}`; both channels rebuilt to a true
  fixed point (pass 3). `dev/check-8011.cjs` **67 passed, 0 failed** against the shipped bytes. The cascade claim is driven,
  not grepped: the rung and the tail are extracted from the sheet by counting braces from their own headers, the gap between
  them is proven to be whitespace and a comment, and then their media conditions are evaluated at real widths - 390, 800,
  900 and 1023 reach **none** of the new declarations; 1024, 1280, 1440 and 1799 reach all of them; 1800 and 1920 reach
  only the tail. Each declaration the release is about (row title 15.5px, heading 21px, pill 14.5px, library 1040px, wall
  1120px, dialog 600px, player inset 24px and rounded 22px) is read out of the extracted block, and every cloud-sensitive
  rule in it is proven to be the player and nothing else. The repaired `.pane-header` rule is proven to carry both
  declarations again. All seven inline scripts compile, and both zips carry the 80.11 page with the desk in it. Full channel
  **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No browser and no laptop screen here, so the shadow on the floating player, the exact weight of 15.5px
  against a given wallpaper and every pixel of the spacing were not looked at - what is proven is which widths can reach
  which declarations, and that the page is the one inside both zips. The look is the owner's to judge on the next open.
