## 80.4 ({{STAMP}}): one dot in the theme list, a rounded widget cover, and taller tabs that drag

- **THE OWNER'S ASK, VERBATIM.** *"make the track art thing on the widgit slightly rounded and nice
  and you don't need to mention color os anywhere in the app or themes or patch notes dawg and what is
  this random ahh color palette thing remove that and make that how it was before. rename the color os
  theme. make the tabs and the bottom smooth bro like buttery smooth to drag my fingers across and make
  them slightly taller make cloud version better. MAKE THIS NICE v80.4"*.
- **THE PALETTE CHIP IS GONE; THE DOT IS BACK.** 80.3.7 replaced the round accent dot in the theme wall
  with a three-band chip (background / accent / second accent) to show a whole palette. On a phone it
  reads as a strip of random colours, not as a theme, and it replaced a row people had been reading for
  years. The dot is restored exactly as it was: 18px, round, the accent - a coral-to-gold gradient when
  the theme moves, the hue wheel for RGB, the plain accent otherwise.
- **THE THEME IS CALLED LAGOON.** Named after what it looks like - a deep teal-black with a mint accent
  over aqua - rather than after another company's operating system. The palette, the 20-second curtain
  and the `prism` key are untouched, so a phone already wearing it keeps its pick, its prepaint cache
  and its backdrop.
- **THE NAME IS OUT OF THE APP ENTIRELY.** A rename that leaves the old word in a comment is a rename
  the owner finds on the next grep, so the scrubbing went past the theme entry: the 80.3.7 changelog
  title, the two 80.3.7 items that named it, the stylesheet comment above the backdrop, the comment
  block above the theme entry and 80.3.7's marker in the script. The driver asserts the finished page
  contains **zero** case-insensitive occurrences. One consequence, named on purpose: 80.3.7's
  idempotency marker no longer matches, so `dev/patch-8037.py --check` reports "pending" on this page.
  That is correct - every release from here is measured against 80.4's payload - and nothing released
  depends on it, because 80.3.7's commit already carries the page it shipped.
- **THE WIDGET'S COVER IS ROUNDED - BY THE APP.** The widget is a RemoteViews `ImageView` in the APK:
  it scales a bitmap and cannot clip one, so corner radius is not a setting it has and this release
  cannot rebuild the APK to give it one. It can draw whatever bitmap it is handed, so the app draws the
  corners first: `scRoundArtDataUrl()` takes the cover data URL the push was already sending, draws it
  cover-fit into a 256px square with an 18% radius (46px), and hands back a PNG data URL. Every path
  through `pushWidgetState` - blob cover, remote cover, cached cover - goes through it, because it wraps
  `send` rather than the three call sites. Cached per source (twelve entries, oldest dropped); a cover
  that cannot be decoded falls back to the original URL, which is what the widget drew before. The
  Settings > Widget preview draws the same 18% radius, so the picture in the app matches the home screen.
- **THE STRIPS ARE TALLER AND THEY DRAG.** The settings tab strip is the app's one horizontally dragged
  surface, and it had three things against it: no snap (so a diagonal finger parked it between two tabs,
  half of each showing), no `touch-action` (so the browser could reinterpret the gesture, and a slightly
  vertical drag scrolled the pane underneath), and no follow-the-tab scroll (so the open tab could sit
  half off the right edge). Now: `touch-action: pan-x`, `scroll-snap-type: x proximity` with each tab a
  centre snap point, 46px minimum height, and `scTabIntoView()` - called from `showSettingsTab` - that
  scrolls the strip to the tab you just opened, centred and clamped at both ends. It scrolls the strip
  with `scrollTo({behavior:'smooth'})` rather than `scrollIntoView`, because `scrollIntoView` on a
  nested scroller also moves the sheet it lives in. Reduce motion (either switch) jumps instead.
- **AND SO IS THE BOTTOM ROW.** Dock pills go from a 36px to a 44px minimum (48 at the wide-screen step),
  and the cloud layout - where that row is the entire navigation - gets 48px pills with the same snap,
  plus a slightly roomier now bar with an 8px-rounded cover.
- **VERIFIED ON THE PAGE THAT SHIPS.** The payload was applied to a fresh clone of `origin/main` (the
  page at 80.3.7): `python3 dev/patch-804.py` (1 step) then `--check` (0 steps); **every inline script
  block compiles**; and `sc-804-check.cjs` passes **47/47** while the same driver fails on the 80.3.7
  page it replaces. It runs the page's own code rather than grepping it: `themeButtonHTML()` for the
  Lagoon row (18px round dot, the two-accent gradient, no three-band chip), a static theme (accent
  alone) and a reward (BADGE REWARD, no NEW); `scTabIntoView()` with stubs for a centred tab, both
  clamps and the Reduce-motion jump; `scRoundArtDataUrl()` on its fallback path (an undrawable cover
  returns the original URL, never nothing); and the widget preset table, still 18 entries led by the
  bright six. The OTA bundles reach a true fixed point in the release step - root + `ota/`
  **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.4.
- **WHAT IS NOT CLAIMED.** No phone and no screenshot: the 46px tabs, the snap feel and the rounded
  cover as the widget actually draws it were not seen on a display - the cover is rounded by a canvas
  this release cannot run in a harness, so what is proven is that the draw path is the rounding path and
  that a failure returns the old cover. No Android build was made: the widget layout, its ImageView and
  the APK are untouched, which is exactly why the rounding happens in the page. Nothing moved in the
  player, the library, the albums, the lyrics, the downloader, the Studio or the audio graph.
