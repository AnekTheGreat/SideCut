## 80.6.7 ({{STAMP}}): Amber dusk leaves, Lagoon settles at the bottom, and the widget fits its size

- **THE OWNER'S ASK, VERBATIM.** *"remove that stupid amber dusk theme and widgit and move lagoon to
  the bottom of the dynamic themes, I said I wanted a liquid widgit theme, and a this color widgit
  theme"*, then, in the same breath, *"I want more feature when you resize the widgit into a 2x4 or
  anything else with a clean ui"*.
- **AMBER DUSK IS A REMOVAL, NOT A HIDE.** `THEMES.amberdusk` (80.6.6) and `WIDGET_THEMES.amberdusk`
  (80.6.5) are both gone from the page, with their comment blocks - `dev/check-8067.cjs` asserts the
  word appears nowhere in any case, and that "Amber dusk" does not either. A phone left wearing the
  key now selects Coral, and `applyTheme()` was changed to SAVE that fallback (`if(!THEMES[key] &&
  key !== 'custom'){ key = 'coral'; }`) instead of painting Coral's colours under a key that is not in
  the list - otherwise no tile was ticked and there was nothing to untick. The widget side already
  fell back (the saved key is looked up in WIDGET_THEMES with a guard), so that shelf needed nothing.
- **LAGOON WAS NEVER MOVED - IT WAS HOISTED.** `prism` (Lagoon, `dynamic:'prism'`) always closed the
  dynamic group in object order; 80.3.7's `fresh: true` lifted it to the TOP of that group, which is
  why it read as missing for the second time. The flag comes off and the entry is byte-identical
  otherwise: same key, same palette, same dynamic class, same prepaint cache and backdrop on a phone
  that already wears it. Nothing is fresh this release, so no group is re-ordered at all.
- **THE PASTEL LIQUID, FROM THE OWNER'S OWN SCREENSHOT.** The screenshot is the glass preview over the
  colour strip the preview paints (rose -> sky -> mint -> lilac -> warm corner) and the ask was "a this
  color widgit theme". That strip is the preset: `pastel`, label **Liquid pastel**, `glass: true`,
  `bg1 #FFC2DE` / `bg2 #B9A6FF`, accent `#3FD9B0`, dark plum type. It is a GLASS preset on purpose -
  it is the liquid pane with that colour in it, which is what makes the ask one feature instead of
  two, and `scFrostGlass()` turns those two stops into ARGB with the dial's alpha exactly as it does
  for `frost`. The dial is therefore shown for **two** presets now, and the blurb says so.
- **THE SHELF IS STILL TWENTY, AND THE GLASS LEADS IT.** One removed, one added: `frost` (Liquid
  glass) then `pastel` (Liquid pastel), then the bright six, then the dark ones. The blurb still reads
  "twenty presets from bright to liquid glass", so nothing else had to be re-counted.
- **THE WIDGET FITS THE SIZE IT IS GIVEN.** Four layouts, written by `dev/widget-sizes.py` - which
  exists BECAUSE the generator lives under `.github/workflows/`, where no release can commit (GitHub
  refuses an Actions token there). Both that module and the one new step in `android-build.yml` were
  pushed by hand with a `workflows`-scoped credential; from here on the module ships with a release
  like any other `dev/` file. The layouts:
  `sidecut_widget.xml` (the 2x2 column, unchanged), `sidecut_widget_compact.xml` (one row: cover,
  title/artist, transport - a 4x1), `sidecut_widget_wide.xml` (cover left, text and timeline centre,
  transport right - a 4x2/4x3) and `sidecut_widget_tall.xml` (96dp cover, 15sp title, timeline,
  48dp transport - a 2x4/2x3). `sizeClass()` reads the placement's own options bundle -
  `OPTION_APPWIDGET_MIN_WIDTH` and `OPTION_APPWIDGET_MAX_HEIGHT` - and picks one per widget id,
  height first because a 4x1 is wide AND short. `onAppWidgetOptionsChanged` repaints, so a resize is
  a full rebuild rather than a nudge. Every layout carries the SAME ids on purpose: one push body
  paints all four, and an id missing from one of them would throw inside setTextViewText and take the
  whole repaint with it.
- **THE TIMELINE.** The wide and tall shapes draw a progress bar and both clock readings. The bar is
  an ImageView fed a generated strip rather than a ProgressBar, because a RemoteViews ProgressBar
  cannot be tinted per theme (`setProgressTintList` takes a ColorStateList, which `setInt` cannot
  carry) - the strip is the accent over a dim track, so the theme reaches it with no API workaround.
  The two numbers come from the web payload, and this release adds them: `pos` and `dur` in the same
  object that already carried title, artist, art, playing, seq and pulse, read off `activeAudio()` on
  every push and never cached.
- **WHAT THE PAGE PATCH TOUCHES.** `dev/patch-8067.py`, one step: the two removals, the pastel entry,
  Lagoon's flag, the applyTheme fallback, the `wdAt` block and the two payload fields, the blurb, the
  changelog head, `APP_VERSION`, and the shell cache to `sidecut-shell-v80.6.7`.
- **WHAT IS NOT CLAIMED.** No phone, no launcher, no APK. The four layouts are generated and the push
  body that paints them is generated, but the sizes a real launcher reports (`MIN_WIDTH` /
  `MAX_HEIGHT`) were not seen on a device, so the boundaries in `sizeClass()` (h < 100 -> compact,
  h >= 180 -> tall, w >= 200 -> wide) are the shape of it, not a measurement. The progress bar was not
  seen drawn on a home screen either. What IS proven: the payload carries `pos`/`dur` from the audio
  element, the generator runs clean on a fresh android project tree, every inline script on the page
  compiles, and `dev/check-8067.cjs` passes - it slices both tables out and evaluates them, checks
  Lagoon is the last dynamic theme with no fresh flag anywhere, that exactly two presets claim the
  dial, that the pastel title clears 4.5:1 on BOTH stops, and that the payload no longer has the old
  shape. The OTA bundles reach a true fixed point in the release step - root + `ota/` **{{ROOT}}**
  bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.7.
