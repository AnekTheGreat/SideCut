## 80.0.3 ({{STAMP}}): the tabs go back over the screen, and Tools is a half of the Studio tab

- **THE OWNER'S WORDS, AND WHAT THEY CORRECTED.** "STUDIO SHOULD HAVE A DIAGONAL TAB
  IN THE ACTUAL TAB CALLED TOOLS NOT TAB INSIDE STUDIO ... the tabs should be over
  the actual screen so like the bubbles can be under the tabs and stuff", sent with a
  photograph of the cloud layout. 80.0 had built both things the other way round: the
  diagonal split was a tab bar *inside* the Studio view, and in the cloud layout the
  four tabs were a rail down the right side at `top: 50%`. The picture showed what
  that produced - the rail crossing the bubble wall and the player, the Library/Albums
  labels clipped by a 76px column, the player hanging in the middle of the page, and
  the same three header buttons visible twice.
- **THE DOCK IS A BAR ACROSS THE TOP IN THE CLOUD LAYOUT.** One floating capsule,
  `left: 10px; right: 10px`, under the header (`--sc80-head`, the header's measured
  height), `flex-direction: row`, `height: var(--sc80-bar)`. It is `position: fixed`,
  so it stays put while the bubble wall moves underneath it - which is exactly the
  "bubbles can be under the tabs" half of the ask. The views reserve its band as
  `padding-top` so nothing is hidden at rest, and `scroll-padding-top` keeps a
  focused row from landing behind it.
- **THE STUDIO TAB IS THE SPLIT.** The dock's Studio pill is now built the way the
  Library pill has been since 70.0: two clipped halves over one button, `#studioHalf`
  (the left of the pill) and `#toolsHalf` (the right of it), with the seam in an SVG
  line running from 60% of the pill's width at the top to 40% at the bottom - a cut,
  not a divider, and Studio on one side of it and Tools on the other. Each half is a
  control: it opens the Studio view and picks its pane;
  the half you are already on takes you Home, which is what a single tab did before
  and what dev/studio-70-check has always asserted. `navigate()` lights the half you
  are in and only while Studio is the view, the same way it lights the Library halves.
- **THE TAB BAR INSIDE STUDIO IS GONE.** `decorateStudio` still splits the view's
  sections into `.sc80-pane[data-pane="studio"]` and `.sc80-pane[data-pane="tools"]`,
  but it no longer builds a bar, and the "already split" guard now tests for a pane
  instead of the bar's presence - without that change every MutationObserver tick
  wrapped the panes inside new panes (measured: 200 nested `.sc80-pane` nodes and an
  empty-looking Studio view). The click wiring on the old bar went with it.
- **THE PLAYER IS BACK ON THE BOTTOM EDGE.** `measureDock` measures the dock and hands
  the player its height as a bottom inset so the player clears it. With the dock a
  272px column, that put the player at `bottom: 272px` - in the middle of the page,
  over the bubbles, which is the floating player in the photograph. The measurement is
  now skipped while the cloud layout is on (the stylesheet puts the player on the
  safe area), and switching layouts re-measures so the classic dock still sets it. In
  a real browser at 390x900 the player's rect moved from `y 548 / bottom 272px` to
  `y 811 / bottom 0`. The new rule is written as its own declaration rather than a
  second line on the existing one: dev/studio-70-check counts every `#nowPlaying`
  rule that reserves the bottom inset as a *padding* rule, and a bottom edge is not
  padding - adding `bottom: env(...)` beside `padding-right` made that count five and
  turned the suite red, which is the gate doing its job on a careless line.
- **THE HEADER ROW REALLY HIDES.** `body.sc80-cloud header > div:last-child{ display:
  none }` was losing to the wrapper's own inline `display:flex`, so cloud showed the
  bell/refresh/gear in the header *and* the copies on the listening-stats bubble, and
  the small now pill was drawn on top of them. The rule is `!important` now, and the
  chip takes the corner they vacated (`right: 12px`) instead of sitting on a rail.
- **THE COPY THAT DESCRIBED THE OLD SHAPE MOVED WITH IT.** The layout toast still said
  "the dock on the right"; it says the tabs across the top now.
- **THE LOOK CARD EXISTS ONCE, IN TOOLS.** The owner: "the new look shouldn't be in
  settings and more just In tools". `mountSettings()` built a second copy of the same
  four buttons into `#settingsPaneMore` at every start, so the page carried two
  `#sc80Look` cards - one in Settings, one in Studio, Tools - and the one in Settings
  was the one a reader found first, in a pane about something else. The mount is gone;
  the card `lookCard()` builds into `toolsPane` is the only one, beside Milestones. It
  is the same card, so both switches still work from where they are, and the Tools
  pane is one tap from the dock in either layout.
- **THE GATES WERE RETARGETED, NOT DELETED.** `dev/revamp-check.cjs` [4] used to assert
  the rail (`right: 10px`, `flex-direction: column`); it asserts the bar now (left and
  right inset, row, the `top` calc under the measured header, the views' padding, the
  player on the safe area, the `!important` header rule). [6] used to assert the tab
  bar inside the view; it asserts the dock split now (the two halves and their labels,
  the same seam as Library, **no** `.sc80-tabs` in the view, exactly two panes, and
  each half really switching the pane and the remembered choice, and the seam drawn
  at 60%/40% with Studio on the left). [8] used to assert the card in Settings - More;
  it asserts the opposite now (exactly one `#sc80Look` in the document, not inside
  `#settingsPaneMore`, inside the Tools pane, and still switching both ways). **106/0.**
  `dev/shots-800.cjs` clicks `#toolsHalf` instead of the deleted `.sc80-tab`.
  `dev/studio-70-check.cjs` is untouched and passes **570/0** on the new dock.
- **THE REPIN.** `dev/repin-8003.mjs`: the live pin moves 80.0.2 -> **80.0.3**, every
  adjacency `PREV` moves 80.0.1 -> **80.0.2**, and PREV's original value is carried in
  the placeholder rather than assumed, so `--check` is clean on a second run (the
  first draft rewrote non-adjacency PREVs back to one constant and could never settle).
  127 edits across 52 gate files.
- **THE VISUAL CHECK IS A REAL BROWSER.** Headless Chromium (Playwright), 390x900 at
  **BOTH** layouts and the Tools pane: the bar at `y 66..124`, the player at the bottom,
  a scrolled wall passing under the bar, and the Tools pane rendering its badges and
  rewards with no in-view tab bar. jsdom has no layout engine, so the geometry claims
  above come from this, not from computed CSS - which is the rule 80.0's own memory
  set after shipping the diagonal unseen.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, read from `ota/updates.json`
  and `ota-play/updates.json` after the build settled at its fixed point (second
  pass), and both `--check`s green on the tree that ships.
- **THE ALBUM-FOLLOW RED IS GONE, HONESTLY.** `album-follow-dock-check` fails a gate
  that requires the HEAD changelog entry to name the album pill dock - red on every
  release since the pill dock shipped. This release's last note names it, so the gate
  is **106/0** and `dev/release-gates.sh` no longer tolerates it. The one red left in
  the battery is `media-controls-check` **66/1** ("and it no longer fires every half
  hour"), which is not this release's doing and not this release's fix.
- **WHAT THIS RELEASE DOES NOT DO.** It does not change the classic layout's dock
  placement or the cloud bubbles themselves. It does not touch the assistant duck, the
  player, the library, Discover or Studio's tools. The Studio tab gained the same
  diagonal split in **both** layouts, because both layouts share one dock and the ask
  was about the tab, not about the cloud look.
