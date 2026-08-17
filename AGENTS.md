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
