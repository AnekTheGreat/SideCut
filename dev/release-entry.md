## 80.3.6 ({{STAMP}}): the whole app settles instead of cutting, Prism joins the theme wall, and the widget gets options it can honour

- **THE OWNER'S ASK, VERBATIM.** *"in fact screw it add an update which makes the whole app as smooth
  as color os 17 with another theme after it make this nice and add more options to the widgit there
  should be more options"*. Three asks: smoothness, one more theme, and more widget options.
- **"SMOOTH" WAS DEFINED BEFORE IT WAS BUILT.** Not a filter and not a spring library: the app already
  had motion, it had it one surface at a time, each rule spelling out its own `0.2s ease`. The release
  gives it ONE motion - four tokens (`--sc-e-out` 0.22/1, `--sc-e-press` a spring-flavoured 0.2/0.9/0.25,
  `--sc-e-inout` symmetric, and `--sc-t-press 110ms` / `--sc-t-fade 200ms` / `--sc-t-view 260ms`) - and
  then three behaviours that read them.
- **A TAP ANSWERS.** `.tab`, `.playlist-pick-btn`, `.sc-set-head`, `.settings-pick` and `.sc-set-card`
  compress to `scale(.98)` under the finger and come back on release, on the press curve. It is a
  transform, so it is the compositor's work; nothing on the page re-lays-out to answer a tap.
  **The dock pills are left to their own rule**, and the first cut of this paragraph was wrong about
  why: the dock has carried `transform: scale(0.95)` on press since 74.9, so "the dock gets no press
  animation" was never true. What is true is that its slide gesture measures every pill's rect at
  pointerdown and then drives the hot pill across those rects, so a second scale on top would move the
  very rect the gesture had just read - and would read as a double press. This release's rule therefore
  does not name `.action-pill` at all, and the harness asserts both halves: the dock's own 0.95 rule is
  still there, and the new 0.98 rule does not list the dock.
- **NAVIGATION CROSS-FADES INSTEAD OF CUTTING.** `navigate()` is wrapped once, at its export, in
  `scNavigateSmooth`: if the platform has `document.startViewTransition` and motion is not reduced, the
  change runs inside it and the frame being left fades out over the frame that arrives; otherwise the
  original function is called and returned. **Both doors are pointed at the wrapper** - the block-scoped
  binding (`navigate = scNavigateSmooth`, which is what the page's own callers resolve) and
  `window.navigate` (which is what another script block, and the Studio's own `navigate()`, resolves) -
  because wrapping only one of them is how a "smooth" release ends up smooth on two tabs and instant on
  the rest. Nothing is deferred: the change still runs synchronously inside the callback, so a caller
  that reads state on the next line sees what it always saw. A transition that throws is caught and
  retried as a plain call.
- **A SETTINGS PANE IS NOT A NAVIGATION, and it does not pretend to be.** The sheet's panes all live in
  one scroller and switch by `display`, so a view transition there would snapshot the whole sheet for a
  content swap. They take the app's existing arrival instead - `scViewIn()` on the pane that was shown -
  which is the same 0.22s fade-and-rise the main views already use and already honours Reduce motion.
- **A SCROLL BELONGS TO ITS PANE.** `overscroll-behavior: contain` on `#tabs`, `#settingsPanesWrap` and
  `#studioView` stops a list that has reached its end from dragging the page behind it, and
  `-webkit-overflow-scrolling: touch` keeps the momentum those panes already had for WebViews that only
  honour the prefixed hint. No scroll listener was added, and no timer.
- **REDUCE MOTION, BOTH WAYS.** The Sandbox switch and the device's own setting each turn off the press
  scale, the pane arrival and the view transition. `scMotionOff()` is the single reader of both, and the
  CSS has a rule under each one - so a device that has asked for less motion gets an instant switch
  rather than a faster one.
- **PRISM.** A static palette with a dynamic backdrop, the shape every theme after `galaxy` already has:
  `dynamic:'prism'` puts `theme-dyn-prism` on the body, and four layers drift behind it on the
  `sd-dyn-drift` keyframes 60.x already ships - two soft colour pools, a deep core and a linear base,
  at 17 seconds (slower than Neon Pulse's 8, faster than Abyss's 24). Colours: `#0b0f1f` / `#161c33`
  with `#8FE3FF` and `#C6A6FF` - a blue-black rather than a grey, and accents light enough to read as
  text on both, which is what a phone theme does and a neon one does not. Free, like every theme since
  70.1.3: no `premium`, no `reward`, no lock, because both walls that used to gate themes are gone. It
  needed one object and one rule: `renderThemeOptions()` groups by `dynamic` and `applyTheme()` sets the
  body class, so the wall, the prepaint cache and the badge counter all pick it up on their own.
- **THE WIDGET'S OPTIONS ARE ONES THE NATIVE SIDE READS.** The widget is a RemoteViews layout compiled
  into the APK and drawn by `SideCutWidgetProvider`, which reads exactly `bg1`, `bg2`, `title`,
  `artist`, `accent` and `eq` out of the theme JSON the page pushes. So this release adds only what
  rides that payload: **five more presets** (Aurora, Sand, Slate, Sakura, Lime - two background stops, a
  title, an artist and an accent, the same shape as the seven that were there); **Follow the app theme**,
  which builds the widget's palette from `THEMES[currentTheme]` instead of a second palette the reader
  has to keep in step, and follows a theme change on the next state push; and **Idle battery saver**,
  which is the page's own heartbeat: a paused widget used to stop refreshing after a hard-coded 25
  seconds, and now that number is a setting - 25 seconds, 1 minute, or never - read live on every beat,
  so changing it takes effect without a relaunch.
- **WHAT THE WIDGET STILL CANNOT DO, SAID OUT LOUD.** Widget *sizes* are not an option: the provider
  inflates `R.layout.sidecut_widget` by name, so a size switch would need a second compiled layout in
  the APK - a native change this release cannot build, let alone verify. Hiding the cover, moving the
  transport and blur all live in that same layout. Nothing here is a switch that does nothing.
- **VERIFIED ON THE PAGE THAT SHIPS.** The payload was applied to a scratch tree taken from
  `origin/main` itself (`git clone --depth 1`), so the thing measured is the page this release replaces
  plus this patch and nothing else: `python3 dev/patch-8036.py` (1 step) then `--check` (0 steps);
  **every inline script block parses** (acorn, 7 blocks, 0 failures); and `sc-8036-check.cjs` passes
  **64/64** while the same driver fails **46** on the page it replaces. It proves, against
  the release's own source rather than a copy: the four motion tokens and the press rule exist and the
  dock is not in them; the three panes that own a scroll are contained; both view-transition rules and
  both Reduce-motion rules are there; this release adds no ninth duplicate id (the page has carried
  eight since long before it) and every settings pane the sheet switches to is a real element; Prism is
  in `THEMES` with its dynamic class, its palette and its backdrop; the widget's preset table has twelve
  entries and every one of them carries all nine keys the native side or the preview reads. Then it
  runs the release's own functions in a `vm` with stubs: `scNavigateSmooth` calls the original once and
  returns, runs the change INSIDE `startViewTransition` when the API exists, and skips the transition
  entirely when either Reduce motion switch is on; `widgetThemeFromApp` returns the app theme's
  background and accent for two different themes; `getWidgetTheme` switches between preset and app
  theme and still honours the fine-tune overrides and the bars flag; `setWidgetFollow` and
  `setWidgetIdle` persist what they were given and refuse a value that is not one of the three; the
  heartbeat's guard is the live setting and reads "never" for 0. The OTA bundles reach a true fixed
  point in the release step - root + `ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both
  `--check`s OK at v80.3.6.
- **WHAT IS NOT CLAIMED.** No phone and no screenshot: the **rate** of the cross-fade and of the press
  scale on a real display was not measured, and a `vm` cannot show a composited frame - what is proven
  is which function runs, when, with what argument, and that nothing runs at all when motion is reduced.
  Prism's backdrop was verified as CSS, not as pixels. No Android build was made, so the native widget
  was not re-run: the options added are ones the unchanged native code already reads, which is exactly
  why they were chosen. Nothing moved in the player, the library, the albums, the lyrics, the tabs, the
  downloader, the Studio or the audio graph.
