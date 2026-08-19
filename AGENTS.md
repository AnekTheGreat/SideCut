# SideCut — repository memory

## What this is
SideCut is a single-file PWA music player (`index.html`) + a service worker (`sw.js`).
Everything (HTML/CSS/JS) lives in `index.html`. Versioning: `APP_VERSION` + `CHANGELOG`
array (~line 5136) and `sw.js` `CACHE_NAME = 'sidecut-shell-vNN.N'` — bump BOTH on every
change. The user prefers version bumps of .1 (patch) and dates in EDT.

## Key landmarks in index.html
- Settings modal `#themeBackdrop` / `.modal` ~line 1462; tab strip `#settingsTabStrip` ~1466
- Settings panes: `#settingsPanePremium`, `#settingsPaneTheme`, `#settingsPaneDonate`, Glow,
  Playback, EQ, Download, More, Sandbox. `showSettingsTab(tab)` toggles them ~line 3396.
- PAID FEATURES module ~line 3160: `PAYMENT_CONFIG` (checkout/donation links),
  `PREMIUM_PUBKEY_B64`, `isPremiumActive()`, `verifyPremiumCode()`, `initPremiumTab()`,
  `initDonateTab()`, `openPremiumSettings()`. All inside the main IIFE (2599→12131).
- Top-level navigation (v44.5): `navigate(view)` ~line 12113 switches between
  Home / Discover / Library (`#homeView`, `#discoverView`, `#library`). Only one is visible;
  `#emptyState` shows when library is empty. Landing view on boot is Home. The action strip
  is: Home, Discover, Playlists, then an `+ Add songs ▾` collapsible menu (`#addSongsMenu`)
  holding Add folder / + Files / Import / Export. `showDiscover(on)` now only toggles the
  discover view's active class — use `navigate()` for full view switching.
- Discover: `showDiscover(on)` ~line 12100, `discoverBtn` click handler ~12143 (gated on premium).
- `toast(msg, ms)` helper ~line 2552.

## Premium / dev code system (v44.1; codes shortened in v44.2)
- Discover is premium: $10 lifetime OR $0.49/2-weeks subscription (opens dev checkout links).
- Dev-gifted codes unlock premium for free: format `SC-<8 base62 nonce>-<8 base62 HMAC tag>`
  (~20 chars), signed message = ASCII "SC-<nonce>", HMAC-SHA256, verified client-side via
  Web Crypto against embedded `PREMIUM_HMAC_KEY_B64`.
- The embedded HMAC key is a one-way SHA-256 of the dev's private PEM (in
  `dev/premium-private-key.pem`, gitignored) — extracting it from JS does NOT reveal the PEM.
- Generate codes with `node dev/make-premium-code.js [count]`.
- Earlier v44.1 used full Ed25519 signatures (146-char codes); v44.2 switched to HMAC for
  short, easy-to-type codes. The PEM is unchanged, so the same generator/key works.
- Premium state stored in `localStorage['sidecut_premium']` = JSON `{active, granted, plan, ...}`.
- If you ever regenerate the PEM, recompute PREMIUM_HMAC_KEY_B64 (SHA-256 of PEM, base64)
  and update it in index.html AND dev/premium-private-key.pem together.

## Gotchas / past bugs
- `#library` CSS default is `display:none`; visibility is driven by `navigate('library')`,
  which sets `display:flex` and shows `#emptyState` when empty. Don't set library display
  directly — use `navigate()`.
- `.action-strip` uses `overflow-x:auto` (single scrollable row, no `flex-wrap`) — the v44.2
  flex-wrap was reverted; the strip is now less crowded because the add/import/export buttons
  moved into the `+ Add songs ▾` collapsible menu (v44.5).
- The `+ Add songs ▾` menu is a centered modal (v45.0): `#addSongsMenu` is `position:fixed`
  centered z-index:200, `#addSongsBackdrop` z-index:199 sits INSIDE `#addSongsWrap` (not a
  body sibling). Because `.action-strip` is `position:relative; z-index:10` (a stacking
  context), the fixed children would be trapped under higher page layers — so
  `openAddSongsMenu()` adds `.menu-open` to `.action-strip` raising it to `z-index:300`
  while open. Action buttons close the menu via a bubble-phase `queueMicrotask(closeAddSongsMenu)`
  so the real click handler (file picker etc.) fires first, inside the user gesture.
- Playlist memory (v45.0): `lastUsedPlaylist` (persisted meta key `lastUsedPlaylist`) tracks
  the last *real* playlist (never 'All Songs'/Unsorted) the user played from or tapped a tab
  for. `rememberPlaylist(name)` is called in `playFromList`, the mix-start path, the playlist
  tab click handler, and on rename. The `libraryBtn` handler's `pickReal()` lands on it
  (never All Songs unless no real playlist exists). Playing from All Songs does NOT update it.
  Boot restore prefers `lastUsedPlaylist` over `lastPlaybackState.sourcePlaylist`.
- Sandbox is premium-only (v45.0): `showSettingsTab('sandbox')` redirects non-premium users
  to the Premium tab with a toast. `refreshPremiumUI()` shows `#premiumManageBox` ("Remove
  premium from this device") only when `plan === 'sub'` (subscriptions); gifted/lifetime
  codes hide it. The box is the last child of the premium pane.
- Sandbox "Accessibility & display" group (v45.0): Reduce motion, High-contrast text, Big
  seek bar, Invert colors — all body-class toggles (`sandbox-reduce-motion` etc.) that persist
  via meta and reset with the other sandbox settings.
- Discover (v45.0): no Spotidown/Spoticatch/Spotisaver links (all dead domains → 404s).
  `triggerDiscoverDownload()` only opens the Spotify search/track URL; how-to instructions
  are at the top of `#discoverView`. "Get song" opens the track in Spotify.
- Premium-in-export (v45.2; on all paths v45.3; auto-include after v45.3):
  `exportLibrary`, `exportPlaylist`, and `exportSelected` all call
  `buildPremiumPayload()` (returns `{code,plan}` from `getPremiumInfo()` when
  `isPremiumActive()`, else null) and hand it to `runZipExport` via `opts.premium`,
  which writes `manifest.premium`. **There is no opt-in checkbox anymore** —
  `showExportConfirm(message, onConfirm)` (no opts, onConfirm takes no args) always
  hides `#exportPremiumOpt`; premium is auto-included in every export when active.
  On import, after settings/stats restore, `importLibrary` re-verifies the code via
  `verifyPremiumCode` (so a tampered manifest can't activate a bogus code) and
  `setPremiumActive`s it — but never overwrites premium already active on the device.
  No server, no accounts; the code is the same reusable recovery credential
  already in localStorage.
- Export memory (post-v45.3, no version bump): the export streams the .zip
  directly to a file on disk via the **File System Access API**
  (`showSaveFilePicker` + `createWritable`), piping JSZip's
  `generateInternalStream({type:'uint8array', streamFiles:true})` chunks to the
  `FileSystemWritableStream`. Only one ~64KB chunk + the file being read live in
  memory at a time — this is the real fix for "Array buffer allocation failed"
  (V8 RangeError when a single allocation exceeds its limit, low on Android
  webviews). `generateAsync` builds the whole output in one buffer, which is what
  threw; streaming avoids ever materializing the whole archive. Inputs are passed
  as Blobs directly to JSZip (no pre-read into ArrayBuffers). `generateAsync` uses
  `{compression:'STORE'}` (audio is already compressed). **Fallback** when
  `showSaveFilePicker` is unavailable (iOS Safari, older Android webview, APK
  shell): in-memory `generateAsync` → Blob → anchor download, and on RangeError
  the toast suggests exporting a playlist or fewer songs. `blobToArrayBuffer`
  remains for other paths (DJ mix recorder, watermark remover) with its 3-tier
  fallback.
- Export progress on Home (v45.3): `#homeExportPopup` (inside `#homeView`, below the
  greeting) is driven by `renderHomeExportPopup()`, called from `refreshExportNotif()`
  on every export tick and from `navigate('home')`. Shows bundling/compressing % + ETA
  while active, a done/failed card that auto-hides after 6s. Only renders when Home is
  the active view.
- Track play now stamps `t.lastPlayedAt = Date.now()` in `recordPlay()` (v44.5), persisted via
  `persistTrackMeta` and synced through library export/import. Home's Recently played /
  Not played in a while depend on it. Older libraries without it just sort by playCount.

## Verification tips
- Parse-check all inline scripts: `node -e` with a regex extracting `<script>` blocks (no src)
  and `new Function(src)` each. Two inline blocks exist.
- Web Crypto Ed25519 verify logic can be unit-tested in Node via `require('crypto').webcrypto.subtle`
  — identical API to the browser. Valid code → true, tampered/garbage → false.
- Dev server for browser testing: `python3 -m http.server 12000` then
  `https://work-1-gjowoesfeonmvpdw.prod-runtime.all-hands.dev/` (proxies 12000).
  Note: a stale service worker can block updates — unregister SW / hard reload to see new code.

## Git / deploy
- Remote: https://github.com/AnekTheGreat/SideCut.git, branch `main`.
- Commit with `Co-authored-by: openhands <openhands@all-hands.dev>`.
- The user generally says "push" — they want commits pushed to main.

## v45.x state (Aug 15, 2026)
- Two parallel sessions both produced v45 changes. v45.0 (remote commit 7b7742c)
  landed: sandbox premium-only, modal Add songs, playlist memory (`lastUsedPlaylist`,
  persisted), removed premium roadmap, removed Spotidown/Catch/Saver dead links,
  Get song → Spotify only, notif bubble + stats icon removed from header, sandbox
  "Accessibility & display" group (reduce motion, high-contrast, big seek bar,
  invert colors). v45.1 (local d486e2b) added on top: Donate pay buttons removed,
  Subscribe activates 14-day on-device sub unlock (`plan:'sub', expires`).
- Premium sub unlock: `setPremiumActive({ plan:'sub', expires: Date.now()+14d })`.
  `isPremiumActive()` honors `expires`. `refreshPremiumUI()` shows
  `#premiumManageBox` / `#premiumRemoveBtn` only when `info.plan === 'sub'`.
- When rebasing onto a remote that already has a same-version commit, expect
  index.html + sw.js conflicts — read the remote commit first, sync with
  `git reset --hard origin/main`, then re-apply only the genuinely missing parts.

## v45.4 (Aug 15, 2026)
- **Streaming zip import**: `importLibrary()` now tries `makeStreamingZipReader()`
  (central-directory-at-end reader using `File.slice()` + native
  `DecompressionStream('deflate-raw')`) before falling back to JSZip. Fixes the
  OOM crash on low-memory Android webviews that `JSZip.loadAsync()` caused by
  reading the whole archive into one ArrayBuffer (same class as the export OOM
  fixed in 858e9ec). Supports STORE (method 0) + DEFLATE-raw (method 8); zipApi
  abstraction bridges both with `{ has(name), file(name)->{async:(t)=>...} }`.
  Verified: small STORE zip + 300MB streamed zip both import cleanly in browser.
- **Premium roadmap re-added**: `PREMIUM_ROADMAP` array + `renderPremiumRoadmap()`
  populate `#premiumRoadmapList` (manage view) and `#premiumRoadmapListBuy`
  (buy view). Was removed in v45.0; user asked for "more premium features coming
  soon" so it's back with 8 entries (gapless/crossfade, synced lyrics, advanced
  EQ, sleep timer+fade, auto-mix, deep stats, exclusive themes, cloud sync).
- All five user-reported UI regressions (now bar, get-song 404, add-songs menu
  out of frame, playlists→All Songs, premium roadmap) were ALREADY fixed in code
  by v44.6/v45.0 commits — the user was on a stale service worker. The real fix
  was bumping `APP_VERSION` (45.3→45.4) + `sw.js CACHE_NAME`
  (sidecut-shell-v45.3→v45.4) + a CHANGELOG entry so the SW actually updates.
  **Lesson**: when a user re-reports something the changelog already claims fixed,
  suspect a stale SW and bump version/cache before re-investigating the code.
- Landmarks shifted: `makeStreamingZipReader()` ~line 9830+, `importLibrary()`
  ~line 9500+, `renderPremiumRoadmap()` ~line 3549, `navigate()` ~12790,
  `libraryBtn` pickReal logic ~12822, `triggerDiscoverDownload()` ~13248.

## v45.5 (Aug 16, 2026)
- **Premium pane Sandbox description corrected**: the "Your unlocked features"
  Sandbox card claimed "bass boost, mono, vocal isolation, night mode" — none of
  which exist. Now lists the real toggles (compact rows, hide album art,
  duration on tabs, larger tap targets, play counts, compact now bar,
  always-show search, accessibility & display, drag & drop).
- **Note: the roadmap is NOT actually in the code.** The v45.4 changelog/AGENTS
  entry claimed `PREMIUM_ROADMAP` + `renderPremiumRoadmap()` were re-added, but
  the current tree has no roadmap array, renderer, or `#premiumRoadmapList`
  elements — that change was lost in the v45.4 rebase. If "coming soon" features
  are wanted again, it must be re-added from scratch.
- **Sandbox → Drag & Drop actually works now**: long-press any top-strip button
  (Home / Playlists / Discover / + Add songs) and drag to reorder; quick taps still
  click normally. Order is saved to meta as `actionPillOrder` (real element ids:
  homeBtn/libraryBtn/discoverBtn/addSongsToggle) and restored on boot. The old
  code had wrong default ids, an instant-drag-on-pointerdown that made the strip
  buttons unclickable, and never applied the saved order.
- **Three new Sandbox toggles**: Compact header, Bigger album art, Show album
  names (rendered under each track's artist when on). All persist and reset like
  the other sandbox settings.
- No version bump for this change — still 45.5 (user asked).


## v45.6 (Aug 16, 2026)
- **Drag & Drop rebuilt** (movement-based, not long-press): the drag starts the
  instant the finger moves past a small threshold, the pill rides centered under
  the finger with a smooth sibling-shift animation, and quick taps still click.
  One generic 1D pointer-drag engine (`initLinearDrag`) now powers both the
  action strip (horizontal) and the sandbox home-layout editor (vertical).
- **Custom quick actions (Sandbox)**: add your own buttons to the top strip —
  open a link, open a playlist, or start playing a playlist. Persisted in meta
  `customQuickActions`, rendered as `.custom-action` pills, and draggable with
  the other buttons.
- **Home page layout (Sandbox)**: `homeOrder` (meta) drives the Home bubble
  order; the sandbox editor lets you drag sections into place and save/load
  arrangements from three slots (A/B/C, meta `homeSlots`). Reset restores
  default order and clears slots.
- Version 45.5 → 45.6 (SW cache sidecut-shell-v45.5 → v45.6). Date Aug 16 EDT.

## v45.7 (Aug 17, 2026)
- **Custom quick actions do anything now**: besides `url`/`playlist`/`play`,
  action types are `view` (home/discover/library via `navigate()`), `settings`
  (opens the settings modal to a tab via `openSettingsTo(tab)` — same pattern as
  the themeBtn handler), `add` (`openAddSongsMenu()`), and playback controls
  `playpause`/`next`/`prev`/`shuffle` (mirrors the now-bar button handlers;
  shuffle uses `regenerateShuffleOrder()` + `savePlaybackState(true)`).
- Consts `SETTINGS_TABS` / `VIEWS` / `NO_VALUE_TYPES` (add/playpause/next/prev/
  shuffle need no value) / `CUSTOM_ACTION_TYPE_LABELS` live right before the
  `customActionType` change handler (~line 4862); `#customActionValueRow` is
  hidden for no-value types, and add-side validation checks URL/view/settings
  values. `actionTitle(a)` builds pill tooltips; `openSettingsTo()` opens the
  modal. Note: `runCustomAction`/`renderCustomActions` reference the consts
  which are declared later in the IIFE — safe because they only run on clicks
  or boot-restore (which runs after the IIFE body finishes).
- Version 45.6 → 45.7 (SW cache sidecut-shell-v45.6 → v45.7). Date Aug 17 1:05 pm EDT.

## v46 (Aug 17, 2026)
- **Record is a circle now**: the mini record player in the now bar was rendered in a 3D
  perspective tilt (default rx 52° / ry -34°) that squashed the disc into an oval. Defaults
  are now face-on (rx 12° / ry 0°) in BOTH CSS fallbacks and the JS angle state + Turntable
  popup `DEFAULT_ANGLE`. Users with a saved `npTurntableAngle` keep their own tilt.
- **Crossfade now beats Gapless**: `onTimeUpdate` used to let `gaplessMode` override
  crossfade entirely, so turning Gapless on silently killed audible blends. Now
  `crossfadeSeconds > 0` takes priority (audible fade); gapless preload/cut only applies
  when crossfade is 0s. Same change in `onEnded` (`crossfadeSeconds === 0` guard).
- **Home bubbles merged**: `HOME_BUBBLE_KINDS` no longer has `'recent'` — Now playing and
  Recently played are one `'nowplaying'` bubble (preview shows current track, or recent if
  idle; the expanded overlay shows the current track + the recently-played list). Old saved
  `homeOrder` entries with `'recent'` are dropped by `normalizeHomeOrder` and the orphaned
  `openHomeBubble('recent')` branch was removed.
- **Sandbox Home layout editor can remove/add bubbles**: each row in the editor has a
  Hide / "Hidden · show" toggle; hidden kinds persist in meta `homeHidden` (filtered in
  `renderHome`, restored on boot, cleared on sandbox reset). Hidden rows are excluded from
  the drag selector so they can't be dragged while hidden.
- **Settings → More**: the guide button is now "🎓 Replay tutorial" with a text
  **Tutorial summary** collapsible; first-run tutorial teaches tapping the record to jump
  to the playing song. "Works offline" now lists Sandbox tweaks and marks Discover as
  needing internet. New "Things to know" bullets: record-tap jumps to now playing; the
  phone's notification media player can't open the app; lyrics auto-scroll may drift.
- **Lyrics view**: "Auto-scroll may not be perfectly accurate" note under the toggle.
- Version 45.7 → 46 (SW cache sidecut-shell-v45.7 → sidecut-shell-v46). Date Aug 17 4:26 pm EDT.

## v46.1 (Aug 17, 2026)
- **Quick-action placement**: custom quick actions carry `placement` (`'strip'` default |
  `'home'` | `'both'`), picked in the Sandbox add form (`#customActionPlacement`) and
  changeable per-row via a small select in `renderCustomActionList` (`data-pl-ca`).
  `renderCustomActions()` (strip pills) filters out `placement === 'home'`. `renderHome()`
  appends `customActionBubbleHTML(a)` bubbles for `home`/`both` actions with
  `data-bubble="custom-<id>"`; bubble taps route to `runCustomAction` (click handler checks
  the `custom-` prefix before `openHomeBubble`). The Home layout editor shows custom bubbles
  as `.home-layout-custom` rows (hide/show via `homeHidden['custom-<id>']`, excluded from
  the drag selector `.home-layout-row:not(.home-layout-hidden):not(.home-layout-custom)`;
  they stay appended after the built-in order — not part of `homeOrder`/slots). Deleting an
  action prunes its `custom-<id>` from `homeHidden`. Version 46 → 46.1 (SW
  sidecut-shell-v46 → sidecut-shell-v46.1). Date Aug 17 5:48 pm EDT.

## v46.3 (Aug 17, 2026)
- **Donate tiers**: `PLAY_TIP_PRODUCTS` is now `{1:'tip1', 2:'tip2', 7:'tip7',
  15:'tip15', 50:'tip50', 75:'tip75', 100:'tip100'}` (was 3/5/10/25). Donate tab
  renders seven quick buttons plus a custom amount field (`#donateCustomAmt` +
  `#donateCustomBtn`): any whole-dollar amount maps to SKU `tip<amt>` and runs
  through the shared `runTip()`; if the product doesn't exist yet the message
  tells the user exactly which ID to create in Play Console. Play Console still
  needs matching products created (Monetize → Products). v46.2 → 46.3 (SW
  sidecut-shell-v46.2 → v46.3). Date Aug 17 2:06 pm EDT.

## v46.4 (Aug 17, 2026)
- **Home bubble size + reorder fix**: Sandbox → Home page layout gained a bubble
  size slider (`#homeBubbleSizeSlider`, 70–130%, meta `homeBubbleSize`, default
  100) applied via `--hb-s` on `#homeBubbles` (all `.home-bubble` dimensions and
  fonts are `calc(... * var(--hb-s, 1))`). Reordering rows in the editor now
  works on touch: `.home-layout-row` is `touch-action:none` (was `manipulation`,
  which let the browser hijack vertical drags as scroll).
- **5 premium dynamic themes**: `aurora`/`synthwave`/`ocean`/`ember`/`galaxy`
  added to `THEMES` with `premium:true, dynamic:'<key>'`. `applyTheme` toggles a
  `body.theme-dyn-<key>` class whose CSS animates an oversized gradient
  (`sd-bg-drift` keyframes) plus a subtle `hb-glow` pulse (`sd-glow-pulse`).
  `renderThemeOptions` shows a 🔒 badge and redirects free users to the Premium
  tab (`openPremiumSettings()`) instead of applying. Reset never touches themes;
  premium themes restore like any other saved theme on boot.
- Version 46.3 → 46.4 (SW sidecut-shell-v46.3 → sidecut-shell-v46.4). Date Aug
  17 2:12 pm EDT.

## v46.4 follow-up (no version bump)
- **Theme picker split**: `renderThemeOptions()` now renders two native
  `<details class="theme-group">` collapsibles — Static themes (open by default)
  and Dynamic themes (animated), which includes RGB, RGB+ and every `dynamic`
  theme. Lock badge (🔒) on premium themes only shows when premium is NOT
  active.
- **Custom theme builder removed**: the "Or build your own" section (customBg /
  customCoral / customGold + applyCustomTheme + populateStartFromOptions) is
  gone from the theme pane and the JS; boot restore/reset no longer touch
  `THEMES.custom`. `customTheme` meta may still round-trip through exports but
  is unused. Tutorial text updated.
- **Dynamic themes improved + 2 more**: animated backgrounds now use a fixed
  `body.theme-dyn-<key>::before` layer (`inset:-30%`, `z-index:-1`) with
  wandering multi-blob radial gradients (`sd-dyn-drift` keyframes); added
  `cyberpunk` and `glacier` (7 premium dynamic themes total). Reduce-motion
  kills the pseudo-element animation explicitly.
- **Tips restored**: `PLAY_TIP_PRODUCTS` now covers 1,2,3,5,7,10,15,25,50,75,100
  (tip3/tip5/tip10/tip25 are back alongside the new tiers).
- **Custom bubbles reorderable**: `normalizeHomeOrder()` preserves `custom-<id>`
  entries (dropping ones whose action was deleted or switched to strip, and
  appending missing ones), so custom bubbles now sit inside the same `homeOrder`
  as built-ins — draggable in the editor, ordered on Home, and storable in
  slots. The editor also gained per-row ▲/▼ move buttons
  (`[data-move-ca]/[data-move-dir]`). `renderHome()` renders custom ids inline;
  boot restore of `homeHidden` now keeps `custom-*` ids.

## v46.5 (Aug 17, 2026)
- **Custom donations removed**: the Donate tab no longer has the custom-amount
  field (`#donateCustomAmt` / `#donateCustomBtn`) or the "custom amounts need
  their own Play product" helper note — only the fixed quick tiers
  ($1/$2/$3/$5/$7/$10/$15/$25/$50/$75/$100) remain, since Play Billing can
  only charge fixed products anyway. `PLAY_TIP_PRODUCTS` and `runTip()` are
  unchanged. Version 46.4 → 46.5 (SW sidecut-shell-v46.4 → v46.5). Date Aug 17
  3:54 pm EDT.

## v46.6 (Aug 17, 2026)
- **Sandbox drag & drop (hold to reorder) removed**: the "Drag & Drop UI"
  toggle is gone from the Sandbox pane, along with all its JS (`sandboxDragDrop`
  state, `applyActionPillDragDrop`, `initActionPillDragDrop`, the toggle click
  handler, boot-restore/reset wiring, and the dead `.action-strip.drag-active`
  CSS). The top strip keeps its default order — or a previously saved
  `actionPillOrder` still applies via `reorderActionPills()` (getStripItems is
  kept for that). Custom quick actions now simply appear in the top bar in the
  order they're added. Home page layout reordering (drag via `initLinearDrag`
  on `.home-layout-row` + ▲/▼ buttons) is unaffected. Version 46.5 → 46.6 (SW
  sidecut-shell-v46.5 → v46.6). Date Aug 17 4:04 pm EDT.

## Post-v46.6 follow-up (no version bump)
- **Home layout editor drag removed too**: the last press-and-hold reorder in
  Sandbox — dragging `.home-layout-row` in the Home page layout editor — is
  gone. The whole generic drag engine (`initLinearDrag`, `onDragPointerDown`,
  `activeDrag`, click-suppress guard) and its CSS (`.action-pill.ghost`,
  `.home-layout-row.dragging`, `.hl-grip`, `touch-action:none`) were deleted.
  Reordering in the editor now happens only via the ▲/▼ move buttons; rows use
  `touch-action:manipulation` so the pane scrolls normally.
- **Save button**: Sandbox now has "💾 Save all sandbox changes"
  (`#saveSandboxBtn` → `persistSandboxMeta()`), which re-persists every sandbox
  meta key (toggles, nowbar size, actionPillOrder, customQuickActions, homeOrder,
  homeSlots, homeHidden, homeBubbleSize), reapplies styles, and toasts. Changes
  still auto-save on each toggle; the button is an explicit confirm.
- **Visible settings scrollbar**: `.settings-scroll` scrollbar widened 6→10px,
  height 52vh→62vh, thumb/track now have solid rgba fallbacks before
  `color-mix` (color-mix silently fails on older Android WebViews, leaving the
  thumb transparent/invisible).

## Post-v46.6 follow-up (no version bump)
- **Now-playing bubble play button**: every Home track row (`.hb-track-row`)
  now has a round `.hb-play` button — shows ⏸ when it's the current playing
  track (tap pauses in place, no navigation), ▶ otherwise (plays that track
  and jumps to Library, like tapping the row). Wired in `wireHbTrackRows`
  with stopPropagation so the row's own click handler doesn't also fire.
- **Quick settings on Home**: the "Quick actions" bubble (kind `shortcuts`)
  now renders a `.hb-quick-grid` of all `SETTINGS_TABS` (Premium, Theme,
  Donate, Glow, Playback, EQ, Download, More, Sandbox) via `openSettingsTo()`
  — so you can jump straight to e.g. Themes or Sandbox from Home.
- **Spotidown name dropped**: tutorial + Discover "Where to get music" now
  say "any Spotify-to-MP3 converter" instead of naming Spotidown (which was
  only ever a suggestion, and domains have a habit of dying).
- **High refresh rate note**: changelog entry added to the v46.6 patch notes
  — SideCut is compatible with 144/165/185/200/240 Hz displays (all
  animations are rAF/CSS driven and scale with the display's refresh rate;
  nothing is locked to 60 Hz).

## Post-v46.6 follow-up (no version bump)
- **Refresh rate settings tab** (after Donate): `#settingsPaneRefresh` /
  `#settingsTabRefresh` with `renderRefreshRateOptions()` filling
  `#refreshRateOptions` — choices: Max device refresh rate (default) or a
  60/90/120/144/165/185/200/240 Hz cap, persisted in meta `refreshRate`.
  The cap is applied to the RGB hue-cycling loop (`startRgbAnimation` now
  schedules via a rate-limited `frame` wrapper using `frameRateIntervalMs()`);
  glow/other loops were already self-throttled. Changing it restarts the RGB
  loop if the theme is RGB; boot restore reads `refreshRate` and restarts the
  loop with the cap. `SETTINGS_TABS` + Home quick-settings grid gained
  `'refresh'` (⚡ Refresh) so custom actions and the Quick actions bubble can
  open it too. Changelog item added to the v46.6 entry; no version bump.

## Post-v46.6 follow-up #2 (no version bump)
- **Theme picker both groups collapsed by default**: `themeGroupHTML()` now
  passes `startOpen=false` for BOTH Static and Dynamic themes (Static was
  `true`, so it auto-unfolded on every open + after every theme switch since
  the click handler calls `renderThemeOptions()` again). Now both stay
  collapsed unless the user taps the summary; switching a theme re-renders
  them collapsed. (Note: a stale SW can still show the old always-open
  behavior — bump APP_VERSION/CACHE if a user re-reports it.)
- **Dynamic themes actually dynamic + bug fix**: `applyTheme()` was missing
  `theme-dyn-cyberpunk` and `theme-dyn-glacier` in its `classList.remove(...)`
  call, so switching away from cyberpunk/glacier left their `::before` layer
  stuck on. Fixed to remove all 7 dynamic classes. The drift keyframe gained
  rotation + wider translate/scale, and a new `sd-dyn-hue` keyframe
  (hue-rotate + saturate) is now layered onto every `theme-dyn-*::before`
  (animation: drift + hue, two separate durations). Per-theme durations
  shortened so motion is clearly visible. Reduce-motion still kills it.
- **Now-playing bubble mini play button**: the Home `nowplaying` bubble now
  has a `.hb-miniplay` round button (bottom-right) that toggles play/pause
  IN PLACE — it does NOT open the expanded overlay (the bubble's own click is
  ignored when the tap lands on the play button via `e.target.closest`). It
  shows play idle / pause playing and adds `.playing` (gold) + `.is-playing`
  (coral border + pulsing glow) to the bubble. `renderHome()` re-runs on
  `onPlayEvt`/`onPauseEvt` (guarded on Home being the active view) so the
  icon/state stay in sync; the miniplay handler also defers a `renderHome`
  60ms after toggling. The now bar reflects playing state via
  `npPlayerBody.playing` + spinning disc.
- **Home bubble icons -> theme-matched SVG**: emoji icons in Home bubbles
  replaced with `HB_ICONS` (hoisted const near `HOME_BUBBLE_KINDS`) — inline
  SVGs whose `path` uses `fill:currentColor`, so each icon tints with the
  bubble's `--coral`/`--gold`. CSS added: `.home-bubble .hb-ico svg` sizing +
  `.hb-panel-ico svg` (expanded overlay head icon) — the nowplaying overlay
  now uses `ico.innerHTML = HB_ICONS.play` instead of `ico.textContent`.
- **Hold-to-delete Home bubbles (3.5s)**: long-press any Home bubble for 3.5s
  opens `#homeBubbleConfirm` ("Hide this bubble?" / "Remove this custom
  action?" with Delete / Cancel). `wireHomeBubbleHold()` uses pointer events
  with a 12px move-cancel (so a scroll/drag aborts) and ignores presses that
  start on the mini play button. Built-in bubbles get added to `homeHidden`
  (re-addable from Sandbox -> Home page layout); custom-<id> bubbles delete
  the custom action. The held bubble gets `.hb-hold-confirm` (coral ring).

## v46.7 (Aug 17, 2026)
- **Reorder now has ▲/▼ buttons**: reorder mode (`reorderMode` + effective
  sort `default`, real playlist only) renders per-row up/down buttons next to
  the grip handle. `moveSongInPlaylist(id, dir)` splices
  `playlists[activePlaylist]` one slot; first row's ▲ and last row's ▼ are
  `disabled`. The drag grip (`attachGripDrag`) still works too.
- **Insert-position picker on add/import into a playlist**: adding files via
  a playlist's "Add audio files to …", importing a .zip into a playlist, or
  adding a single song via the kebab "Add to playlist" no longer dumps new
  tracks at the end. A new `#insertPosBackdrop` modal offers Beginning /
  End / Pick a spot… `promptInsertPosition(name, label, onChoose)` returns
  the index (or `'__pick__'`). Pick mode sets `insertMode` via
  `enterInsertPickMode()` (forces sort `default` + clears search so the
  displayed index == real insertion index); `renderListInner` then shows a
  yellow banner + "Insert at the very top" bar and each row tap calls
  `onCommit(i+1)`. `handleAudioFiles` gained an `opts.deferPosition` path
  (new songs are pulled out of Unsorted but NOT pushed to the target until
  the user picks); `importLibrary` collects `importTargetIds` and defers the
  same way. Cancelling leaves the songs in the library (All Songs) but not
  the target playlist — acceptable.
- **Lyrics-not-found copy**: the lyrics view now says "Lyrics could not be
  found." instead of "this song may not be in our database."
- **Now-playing bubble play buttons are themed SVGs**: `.hb-play` in
  `hbTrackRowHTML` used ▶/⏸ text characters — now uses `HB_ICONS.play` /
  `HB_ICONS.pause` (new) inline SVGs (16px, `fill:var(--coral)`), matching
  the rest of the Home bubble icons. The pause-on-tap handler swaps to
  `HB_ICONS.play` via `innerHTML`.
- Version 46.6 → 46.7 (SW cache sidecut-shell-v46.6 → sidecut-shell-v46.7).
  Date Aug 17 7:30 pm EDT.

## v46.7.5 (Aug 17, 2026)
- **Stats bubble icon was invisible**: `HB_ICONS.stats` was an open-stroke
  bar-chart path (`M4 20V10M10 20V4...`) but the CSS only sets
  `fill:currentColor` (no `stroke`), and open line segments render nothing
  when filled. Replaced with a solid filled-bars path. Same fix applied to
  `HB_ICONS.playlists` (was open lines + a circle that had no fill rule) →
  solid playlist-bars-with-note icon. `HB_ICONS.library` (open note-stem
  lines) → solid two-note icon.
- **Home shows ALL background-task progress, always**: `renderHomeExportPopup`
  was export-only. It's now a unified card that also renders cover-fetch
  (`coverFetchState`), lyrics-fetch (`lyricsFetchState`), metadata enrich
  (`enrichState`), and CSV import (`bgImportState`) progress, each with its
  own bordered sub-card when several run at once. `refreshEnrichNotif()` and
  the import loop's tick now call `renderHomeExportPopup()`, and the cover
  refetch loop got `refreshEnrichNotif()` calls added at start/per-tick/end.
  `navigate('home')` already called it, so returning to Home during a task
  shows the live card. Finished cards only show while `!seen` and auto-clear
  `finishedAt` after the 6s hide so they don't reappear on the next Home visit.
- **Home bubble song taps now follow the playlist**: `wireHbTrackRows` used
  `playFromList(allTracks.map(t=>t.id), id)` — the whole library in insertion
  order — so the track after the tapped one felt "random". New
  `playTrackInPlaylistContext(id)` picks the real playlist the track belongs
  to (prefers the active one if it contains it, else the first real playlist
  that does, else All Songs), builds the queue from that playlist's
  `getSortedIds` (or the cached shuffle order when shuffle is on), sets
  `activePlaylist` to it, and renders tabs/list so the user lands on it.
- Version 46.7 → 46.7.5 (SW cache sidecut-shell-v46.7 → sidecut-shell-v46.7.5).
  Date Aug 17 7:30 pm EDT.

## Theme picker collapse (no version bump → bumped to v47, Aug 17, 2026)
- The theme picker (`renderThemeOptions()` ~line 3628) already does what users
  ask: both Static and Dynamic `<details>` render collapsed
  (`themeGroupHTML(..., false)`), open only when the user taps the summary, and
  collapse after picking a theme (the click handler calls `renderThemeOptions()`
  again, which rebuilds both groups closed). Verified in-browser on the live
  v47 build (Static → pick Violet → collapsed; Dynamic → pick Aurora →
  collapsed; both-open → pick static → both collapsed).
- **Non-obvious gotcha**: you CANNOT collapse a user-opened `<details>` from
  inside the button's click handler via `d.open = false` /
  `d.removeAttribute('open')` — it silently fails to close, even when deferred
  via `requestAnimationFrame`. The checkmark-in-place update succeeds but the
  group stays open. Only REPLACING the `<details>` element (i.e. rebuilding
  `container.innerHTML`) reliably collapses it. So the rebuild-on-select
  approach is mandatory; don't "optimize" it to an in-place checkmark move +
  `removeAttribute` — it looks like it should work and doesn't.
- **Version bump to v47 (codename "Bk-47", after the song) to bust the stale
  SW** that was serving the pre-v46.4-followup shell (older code had
  `themeGroupHTML('Static themes', groups.static, true)` — open by default,
  click handler didn't rebuild). `APP_VERSION` 46.7.5 → 47, `sw.js CACHE_NAME`
  sidecut-shell-v46.7.5 → sidecut-shell-v47, CHANGELOG entry titled
  "Bk-47 — ...". The "Bk-47" codename also shows in the version label
  (`#currentVersionLabel` → "SideCut v47 · Bk-47") and as the What's-New
  popup subtitle (the changelog entry title renders there). Bundles the
  earlier-session work (Discover downloader, pinned artists + release check,
  auto-clean-on-import, unified Home progress card) into the same release.

## v47 follow-up (no version bump, Aug 17, 2026)
- **Discover "Get song" → Spotisaver only**: the converter list
  (`getDownloaderHosts()` ~line 14969) was trimmed from three (SpotifyMate /
  Spotify-downloader.com / spotify-downloader.net) to just **Spotisaver**
  (`https://spotisaver.net/en`). Spotisaver sends `X-Frame-Options: DENY` so it
  can't be iframed — the sheet's fallback ("Spotisaver blocks embedded loading
  — it needs to open on its own page." + "Open Spotisaver in new tab") handles
  it. The list is still editable via `sidecut_downloaderHosts` in localStorage
  for power users who want a frameable converter.
- **Big iframe**: downloader iframe grew from 340px → `height:70vh;
  min-height:460px`; modal max-width 560px → 760px. (Won't help Spotisaver
  itself, but any frameable converter a user adds now has usable real estate.)
- **Copy-link is the song's Spotify link**: `triggerDiscoverDownload` (~14982)
  and the new-release row handler now pass a real Spotify URL — prefer the
  track's own `trackViewUrl` (when the iTunes lookup returned one), else a
  Spotify search URL built from title+artist. The "Copy link" field holds THAT
  (what the user pastes into Spotisaver), not a generic Spotify search page.
- **Pinned artists moved into a sleek collapsible**: the 📌 Pinned artists +
  🆕 New releases sections used to sit bluntly in the middle of Discover. They
  are now one `<details id="pinnedArtistsDetails">` ("📌 Your artists",
  ~line 1676) collapsed by default, with a count ("N pinned") and a NEW badge
  that appears when there are unseen releases. Auto-opens (`det.open = true`)
  when a release check finds new songs so the user actually sees them.
- **30s preview on new releases**: `fetchArtistReleases` now stores
  `previewUrl` on each release; `renderNewReleases` (~14731) renders a round ▶
  play button per row that calls `toggleDiscoverPreview(url, btn)` (reuses the
  existing Discover preview audio + play/pause icon swap). stopPropagation so
  the row's own click (open downloader) doesn't fire.
- **Watermark remover no longer runs on every refresh**: removed the
  `if(watermarkEnabled) applyWatermarkToAll();` call on the boot path
  (~line 13951) that re-cleaned the whole library every load, churning the DB
  + firing the "Cleaned N songs" toast every single reload. Watermark cleaning
  now happens ONLY when a new song is imported (`cleanOnImport` on the three
  import paths: ~8760, ~8886, ~10882) or when the user taps Apply/Reset in
  Settings → More → Watermark. Matches the user's intent: "only do that when a
  new song comes in."
- All verified live in the browser (Discover collapsed "Your artists", Get song
  sheet with Spotisaver + big iframe + song link, fallback message, Spotisaver
  in the how-to text). No version bump per user request (still v47 / Bk-47).

## v47 follow-up #2 (no version bump, Aug 17, 2026)
- **Scrapped the embedded downloader sheet entirely.** The in-app "Get this
  song" modal (`#downloaderBackdrop` + iframe + converter list + copy-link) is
  gone — HTML, `openDownloaderSheet()`, `getDownloaderHosts()`/`downloaderHosts`,
  `downloaderEmbedUrl`, and the close/backdrop/copy event listeners all removed.
  Spotisaver (and every other Spotify-to-MP3 converter) sends `X-Frame-Options:
  DENY` so the iframe was always falling back to a button anyway — it was
  dead weight. "Get song" now just opens the track in Spotify (`window.open`)
  with a toast telling the user to copy the link there and take it to any
  converter themselves, exactly the pre-sheet flow. Same for new-release row
  clicks. The "How to get a song" box at the top of Discover was rewritten to
  match: 1. Get song → opens in Spotify, 2. Share → Copy link → paste into any
  Spotify-to-MP3 converter, 3. + Files to import.
- **Pinned artists note**: the "📌 Your artists" collapsible in Discover is
  always in the DOM; when empty it shows a "Pin artists you love — search,
  tap a card, hit Pin" hint. Tap the 📌 summary to expand. Pin any artist
  from their Discover card's Pin button.

## v47 follow-up #3 (no version bump, Aug 18, 2026)
- **Pinned artists always visible; only new-releases is a dropdown**: the
  whole pinned-artists block is no longer a `<details>` —
  `#pinnedArtistsDetails` is now a plain `<div>` and the artist list
  (`#pinnedArtistsList`) is ALWAYS visible at the top of Discover (no
  dropdown to expand). Only the new-releases sub-block is a collapsible
  `<details id="newReleasesSection">` with its own `#newReleasesChevron`
  (rotates 90deg open / 0deg closed via a `toggle` listener).
  `renderNewReleases()` still drives `newReleasesSection.style.display`
  (none when no releases), and sets `sec.open = true` on first render
  unless the user already toggled it (`data-toggled` attribute). The
  Check-now button (`#newReleasesRefresh`) lives inside that summary and
  calls stopPropagation+preventDefault so clicking it runs the release
  check without collapsing the panel. The release-check success path now
  sets `newReleasesSection.open = true` (was the outer details). Commit
  2b27a88. No version bump — SW still sidecut-shell-v47, so a user on a
  stale SW won't see this until they unregister/clear cache.

## v47.2 (Aug 18, 2026)
- **Discover buttons with dropdowns**: New Releases and Genres are now side-by-side
  buttons at the top of Discover. Each toggles a dropdown panel — New Releases shows
  unseen releases from pinned artists (with a "Mark all as seen" button); Genres shows
  the category list (Pop, Hip-hop, etc.) in a vertical list with themed icons.
- **New releases Home bubble**: added `newreleases` to `HOME_BUBBLE_KINDS` — shows a
  gold count of unseen releases, expands to a list where tapping a release searches for
  it in Discover. "Mark all as seen" clears the badge. No more toast notifications on
  new releases — the bubble is the discreet indicator.
- **Pinned artists: primary-only pinning**: `primaryArtistName()` strips collaboration
  partners ("The Weeknd, Ariana Grande" → "The Weeknd") so each artist is pinned once.
  Existing duplicate pins are deduplicated on load.
- **Now-playing bubble icon**: replaced the play-triangle decorative icon (which looked
  like a second play button) with a headphones icon. Only the miniplay button is a
  real play/pause control.
- **Changelog times shifted 4 hours earlier** for the last 4 entries.
- Version 47.1 → 47.2 (SW sidecut-shell-v47.1 → sidecut-shell-v47.2). Date Aug 18
  4:10 pm EDT.

## v47.3 (Aug 18, 2026)
- **Discover buttons fixed**: New Releases and Genres buttons now use inline `onclick`
  handlers calling `window._toggleNR()` / `window._toggleGenres()` defined at the end
  of the IIFE. Previous `addEventListener` + `setTimeout` fallback approaches silently
  failed on Android WebViews where `overflow-y:auto` on the parent could swallow touch
  events. Version bumped from v47.2 → v47.3 to bust the stale SW.
- **Undo unpinned artists**: `toastWithUndo()` shows an Undo button in the toast when
  an artist is unpinned. Restores the artist + their release snapshot within 6 seconds.
- **Primary-only pinning**: `primaryArtistName()` strips collab partners so each artist
  is pinned once. Existing duplicates are deduplicated on load.
- **New Releases Home bubble**: `newreleases` bubble shows a gold count of unseen releases;
  tap to expand, "Mark all as seen" clears the badge. No more toast notifications.
- **Now-playing bubble icon**: headphones instead of play triangle (only the miniplay
  button is a real play/pause control).
- **Discover dropdowns**: New Releases and Genres are side-by-side buttons that toggle
  dropdown panels.
- Version 47.2 → 47.3 (SW sidecut-shell-v47.2 → sidecut-shell-v47.3). Date Aug 18
  6:47 pm EDT.

## v47.4 (Aug 19, 2026)
- **Discover buttons REALLY fixed — root cause finally found.** The v47.2/v47.3 "fixes" (inline onclick, window-level toggles) were all correctly wired — but they never ran because `renderDiscoverChips()` is called at top level near the end of the main IIFE (was ~line 15120) and referenced `DISCOVER_CHIP_ICONS`, a const that was **never defined** (added in the v47.2 rewrite, lost in the rebase). That boot-time ReferenceError killed the whole IIFE, so the `window._toggleNR`/`_toggleGenres` assignments right after it never executed → tapping the buttons threw a silent `ReferenceError: _toggleNR is not defined`. **Lesson: parse-checking is NOT enough — boot crashes hide in plain sight. Run the IIFE under a DOM mock to find them.** `dev/_boottest.js` (Node + `vm` + stub DOM/IDB/AudioContext) executes the main inline script and prints the first runtime error; keep it for future edits.
- **`DISCOVER_CHIP_ICONS` re-added** (10 genres, themed emoji) right after `DISCOVER_CHIPS` (~line 14208).
- **`toastWithUndo()` was also never defined** — `togglePinArtist` called it for the Unpin undo toast (shipped in 87b2ed3), so Unpin silently crashed behind the click-freeze safety net. Now defined next to `toast()` (~line 3217): reuses `#toastEl`, appends an Undo button, 6s auto-dismiss.
- **Media Session hardened**: `if('mediaSession' in navigator)` is now `&& typeof navigator.mediaSession.setActionHandler === 'function'` so old WebViews can't kill the IIFE at the lock-screen-controls init.
- **Known benign boot noise**: `dbGet` calls made before `let dbPromise = null` executes (e.g. the lyrics `lyricsWordByWord` restore async IIFE ~line 5468) hit a caught TDZ ReferenceError → log "Storage get failed", return null. Harmless (caught), but the word-by-word restore defaults to off on first boot.
- Version 47.3 → 47.4 (SW cache sidecut-shell-v47.3 → sidecut-shell-v47.4). Date Aug 19 12:50 am EDT.

## v47.5 (Aug 19, 2026)
- **Discover dropdowns finally open — the last two bugs were the double-firing handlers + the release-check freeze loop.** (1) A single tap on New Releases / Genres ran BOTH the inline `onclick="_toggleNR()"` AND a leftover `addEventListener` toggle — the dropdown opened then instantly closed, so it looked like the button did nothing. The duplicate listeners are removed; only the early-defined `window._toggleNR`/`_toggleGenres` inline handlers remain. (2) `renderNewReleasesDropdown()` auto-fired `checkPinnedArtistReleases().then(render)` whenever there were no unseen releases, and that render re-triggered the check forever — an infinite loop of iTunes fetches for every pinned artist that froze the app. It now renders a plain empty state; checks run on boot, app-focus (10-min throttle), and Check-now only. **Lesson: when the user reports "the dropdown doesn't work" after a fix, check for a SECOND handler on the same element — a toggle wired twice cancels itself out and reads as "button broken".**
- Version 47.4 → 47.5 (SW cache sidecut-shell-v47.4 → sidecut-shell-v47.5). Date Aug 19 1:45 am EDT.

## v47.5.1 (Aug 19, 2026)
- **New Releases dropdown emptied by the What's-New popup**: `openNotif()` called `markReleasesSeen()` on open — and the popup auto-opens on every version bump, so the v47.5 bump silently marked ALL pinned-artist releases as seen, and the dropdown/bubble (which only listed *unseen* releases) showed nothing. Fixes: (1) `openNotif()` no longer calls `markReleasesSeen()` — only the explicit "Mark all as seen" buttons in the dropdown + Home bubble clear releases now. (2) `renderNewReleasesDropdown()` and the Home `newreleases` bubble expanded view now list the 20 most recent releases across pinned artists with a NEW badge on unseen ones (matching `renderNewReleases()`, which always showed all), so the list is never empty while releases exist. Version 47.5 → 47.5.1 (SW sidecut-shell-v47.5 → sidecut-shell-v47.5.1). Date Aug 19 2:10 am EDT.

## v47.6 (Aug 19, 2026)
- **Long-press Home bubbles → drag to reorder**: pressing a bubble ~350ms (without moving) lifts it out of the grid (`.hb-dragging` = position:fixed, z-index:999, pointer-events:none, scale 1.06) and it rides under the finger; the nearest-bubble slot is computed from center distance and the dragged bubble is DOM-moved with a FLIP animation on siblings (they already had `transition: transform .18s`). Drop saves `homeOrder` (meta key `homeOrder`) + re-renders the Sandbox editor. Quick taps still open the bubble; moving >14px before the timer aborts the hold (scroll). The 3.5s hold-to-delete (wireHomeBubbleHold / openHomeBubbleConfirm / doDeleteHomeBubble + `#homeBubbleConfirm` modal) was removed — hiding bubbles is done from Sandbox → Home page layout. `window.__hbDragSuppressClick` swallows the click that follows a drag.
- **Discover songs not appearing**: `fetchWithProxy` now tries direct fetch → corsproxy.io → api.allorigins.win/raw → api.codetabs.com/v1/proxy, so a dead/blocked relay can't blank the results.
- **Settings → More → "Works offline"** now explicitly names **Discover** (song search, previews, pinned artists, new-release checks) as needing internet.
- **Pinned artists persistence**: confirmed the data path (IndexedDB meta `pinnedArtists`/`pinnedReleases`, saved on every pin/unpin/check, merged (not overwritten) on import) — the "they disappeared" reports were the old boot-crash/stale-SW issue; the v47.6 bump delivers the fixed shell.
- **"New releases found" Home card**: now `data-dismiss="pinned"` + tap-to-dismiss, and the 6s auto-hide timer also sets `pinnedCheckState.seen = true`. `pinnedCheckState.active` was added to `anyActive` so the progress card stays up while the check runs.
- **Notifications**: new "✓ Mark all as read" button (`#notifMarkRead`) sets `notifLastReadVersion` + calls `markReleasesSeen()` + re-renders + clears the badge.
- **All releases shown**: removed the `.slice(0, 20)` caps in `renderNewReleasesDropdown()` and the Home `newreleases` bubble overlay (per-artist snapshot still capped at 40 in `fetchArtistReleases`).
- **Premium pane**: `#premiumFeatureList` gained a Word-by-word lyrics row (🎤).
- Version 47.5.1 → 47.6 (SW cache sidecut-shell-v47.5.1 → sidecut-shell-v47.6). Date Aug 19 2:39 am EDT.

## v47.7 (Aug 19, 2026)
- **New Releases dropdown fix**: the dropdown in Discover now auto-renders when
  you navigate to Discover (not just on button tap), so the release list is always
  up to date. If opened with no cached releases, it shows "Checking..." and
  auto-fetches, then re-renders when done. A visible release count in the
  dropdown header confirms data is loaded.
- **All releases shown**: removed the 40-per-artist release cap in
  `fetchArtistReleases` — all fetched releases (up to 50 per artist from iTunes)
  are now kept and shown in both the Home bubble and the Discover dropdown.
- Debug `console.log` traces in `renderNewReleasesDropdown` for on-device
  troubleshooting.
- Version 47.6 → 47.7 (SW cache sidecut-shell-v47.6 → sidecut-shell-v47.7).
  Date Aug 19 8:55 am EDT.
