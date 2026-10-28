## 80.3.7 ({{STAMP}}): ColorOS is on the theme wall, the badge themes come last, and the widget gets bright colours

- **THE OWNER'S ASK, VERBATIM.** *"where's the color os theme and all non badge themes should be
  before the badge themes in line and make it more smooth and why are the widgits colors so dark make
  them nice and fun, make the app nice and user friendly"*. Four asks; three of them turned out to be
  one bug.
- **"WHERE'S THE COLOR OS THEME" WAS AN ORDERING BUG, NOT A MISSING THEME.** 80.3.6 shipped the
  ColorOS-inspired theme as **Prism**, last in object order, which put it at the bottom of the dynamic
  group - *below `vortex`, a 200-badge reward*. The owner opened the wall, found a locked theme where
  the new one should be, and reasonably concluded it was not there. 80.3.7 answers it at both ends:
  the label is **ColorOS**, and badge rewards are no longer in line with anything.
- **THE KEY DID NOT CHANGE.** The entry is still `prism`, and so is `dynamic:'prism'` - so a phone
  that already picked it keeps its pick, its prepaint cache and its backdrop, and no saved theme
  silently falls back to Coral. Renaming the key would have been the tidier diff and the worse
  release.
- **RECOLOURED TO WHAT COLOROS LOOKS LIKE.** `#07181A` / `#0E2A2C` with a mint accent `#37E6C4` and
  aqua behind it `#7FD1FF`, and a curtain of two soft pools - mint above, aqua below, a dark teal core
  - drifting on the existing `sd-dyn-drift` keyframes at 20 seconds (calmer than everything except
  Abyss's 24, which is what a system wallpaper does). The blue-black of 80.3.6 is gone.
- **THREE GROUPS, REWARDS LAST.** `renderThemeOptions()` used to sort by `rgb`/`dynamic` alone, so the
  four badge rewards appeared wherever object order put them: Cinder, Quartz and Lumen at the end of
  the static list, Vortex in the middle of the dynamic one. Now `reward` is its own group, printed
  **after** both free groups - every theme you can pick today is above every theme you have to earn.
  The rewards keep their `BADGE REWARD` / `N BADGES` tag and their live badge check; what they unlock
  and how they unlock did not move.
- **THE FRESH THEME COMES FIRST, AND LEAVES ON ITS OWN.** `fresh:true` on the entry puts ColorOS at the
  top of its group and puts a `NEW` tag on its row. The flag lives on the theme, so the next release
  drops the flag and the theme settles back into object order - there is no hand-maintained list to
  forget to edit.
- **THE CHIP SHOWS THE PALETTE.** The row's swatch was one dot of the accent, so two themes sharing an
  accent and differing in background were indistinguishable. It is a 26x18 chip now: a third
  background, a third accent, a third second accent - the three things a theme actually decides.
- **THE WALL OPENS, AND A THEME SETTLES.** A group that opens staggers its rows in 14ms apart (capped
  at ten rows), which is the difference between a list arriving and a list flashing; picking a theme
  animates the sheet from 72% opacity to full over the app's existing view duration. Both read the
  80.3.6 tokens (`--sc-t-fade`, `--sc-t-view`, `--sc-e-out`) rather than inventing numbers, both are
  pure CSS on an existing element - no listener, no timer, no rAF - and both are switched off under
  **Reduce motion**, either the Sandbox switch or the device's.
- **THE WIDGET'S TWELVE DARK PRESETS HAD NO LIGHT SIBLING.** Every preset was two background stops in
  the same narrow band (`#0E2A47` down to `#000000`); two of them were literally near-black, and the
  brightest was a mid teal. Nothing was wrong with their colours - there was simply nothing bright to
  choose. 80.3.7 adds **six**: Bubblegum, Mint, Sunshine, Sky, Tangerine and Grape, each a light-to-mid
  gradient with a dark title, a dark artist line and a saturated accent. They ride the exact payload
  the native provider already reads (`bg1`, `bg2`, `title`, `artist`, `accent`, `pill`, `eq`), so
  **no Android change** was needed: the provider renders the gradient bitmap and sets the text
  colours, which is what it does for the dark set.
- **BRIGHT IS FIRST, AND A FRESH INSTALL STARTS THERE.** The six are at the head of the object, so the
  grid opens on the fun ones. All twelve dark presets keep their keys and their colours - a phone on
  Rosewood still has Rosewood - and `ocean` remains the fallback for an unknown key. The one saved
  value this release changes is the **default for a phone that has never picked**: Bubblegum instead of
  Deep Ocean.
- **AND THE PICKER LABEL WAS INVISIBLE.** Each row's name was painted in the preset's own `title`
  colour - white for the dark set, near-black for a new light one - on the dark settings sheet. The
  name is the app's own ink now; the swatch beside it carries the colours. Without this, the six bright
  presets would have been six unlabelled buttons.
- **VERIFIED ON THE PAGE THAT SHIPS.** The payload was applied to a fresh clone of `origin/main` (the
  page at 80.3.6) and the result copied into this tree: `python3 dev/patch-8037.py` (1 step) then
  `--check` (0 steps); **every inline script block compiles** (`new Function`, 7 blocks, 0 failures);
  and `sc-8037-check.cjs` passes **65/65** while the same driver fails **31** on the deployed 80.3.6
  page it replaces. The OTA bundles reach a true fixed point in the release step - root + `ota/`
  **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.3.7. It proves, against
  the release's own source: `THEMES.prism` is labelled ColorOS, keeps `dynamic:'prism'` and carries
  `fresh`; the wall's own `renderThemeOptions()` - extracted from the page and run with stubs - prints
  exactly three groups in the order Static / Dynamic / Badge rewards, puts ColorOS **first** in the
  dynamic group, and puts **no** reward key in either free group; the row's own `themeButtonHTML()`
  emits the three-band chip for ColorOS and the `NEW` tag with it, and does not tag a reward; every
  preset in `WIDGET_THEMES` (18 of them) carries all nine keys, the six light ones are the first six,
  and the title/artist contrast was **computed** for all eighteen against both background stops (light
  ones in the 10-15:1 range, and no preset - old or new - below 4.5:1); `scThemeSettle()` was run with
  stubs and adds the animation class only when the sheet is open and motion is allowed, never when it
  is closed and never under either Reduce-motion switch.
- **WHAT IS NOT CLAIMED.** No phone and no screenshot: the **look** of the new ColorOS palette, of the
  staggered open and of the settle was not seen on a display - what is proven is the CSS, the class
  the function adds and when, and the computed contrast numbers. No Android build was made, so the
  native widget was not re-run: the presets added are ones the unchanged native code already reads.
  Nothing moved in the player, the library, the albums, the lyrics, the tabs, the downloader, the
  Studio or the audio graph.
