# SideCut — repository memory


## 72.7.1 (Oct 3, 2026 · 4:23 PM EDT): the lyrics toast tells you which songs it means
- **The owner's ask, verbatim**: "if it says lyrics found for x amount of songs then if you click on the toast it
  should tell you which songs it found it for". Behaviour release, one feature: a toast can now carry a tap.
- **`dev/patch-7271.mjs`** (`VERSION='72.7.1'`, `OLDVER='72.7'`, `STAMP='October 3, 2026 \\u00b7 4:23 PM EDT'`, 8 notes,
  `CACHE='sidecut-shell-v'+VERSION` derived). 11 keyed subs + the OTA tail (first run `11 applied, 1 already in place`;
  re-run `0 applied, 12 already in place`):
  1. `APP_VERSION '72.7'` -> `'72.7.1'`; 2. changelog head inserted before the 72.7 entry; 3. `sw.js` `CACHE_NAME`
     `sidecut-shell-v72.7` -> `v72.7.1`;
  4. **`toast()` gains an optional third argument** `opts`. With `opts.list` it arms `toastEl._onTap`; the once-bound tap
     handler now reads that action, hides the toast, and runs it (otherwise it dismisses exactly as before). `toast()`
     clears `_onTap` on every fresh message, and `toastWithUndo` clears it too, so a stale list can never open under a
     later toast.
  5. **`showToastList(title, items)`** is the panel: a centered card that reuses the shipped `.modal-backdrop` / `.modal`
     styling, numbers each song, escapes every name, and closes on its own `Close` button or a tap outside it.
  6. **the batch run** (`fetchMissingLyricsBtn`) now collects `foundNames` while it loops and its closing toast carries
     `{ title: 'Lyrics found for', list: foundNames }` and lives `6000` ms when the list is non-empty (message gains
     ` \\u2014 tap to see which`).
  7. **the background re-check** (`scLyricsRecheckRun`) collects `addedNames` the same way and hands them to the same
     toast shape. Its call still starts `toast('Lyrics found for '`, so the test-617 substring pin still matches.
- **`dev/repin-7271.mjs` — 77 edits / 40 files** (`OLDVER='72.7'`, `NEWVER='72.7.1'`, `NEWCACHE` derived; second run 0;
  "no stale pin left in any gate"). `PREV_MOVES` maps test-713..**test-727** from `'72.6'` -> `'72.7'` (17 entries).
  `KEEPS_ITS_VERSION` = test-705.mjs / test-70.mjs. **THE VERSION-PREFIX TRAP, other way round**: `'72.7'` IS a prefix of
  `'72.7.1'`, so the cache move carries `(?!\\[\\d.])` — a bare `sidecut-shell-v72.7` needle would bite the released
  `…-v72.7.1` and double-rewrite it on a re-run. Bespoke **F1–F4** retarget the stale-cache sweep needles in test-7251.mjs
  (`sidecut-shell-v72\\.6` -> `…v72\\.7`), test-7252.mjs, test-726.mjs and **test-727.mjs** (`sidecut-shell-v72[.]6` ->
  `…-v72[.]7`), each now `(?![0-9.])` so the released name is never matched.
- **THE OTA TAIL held.** The two-newline padding from 72.5/72.7 still settles this content: `node dev/ota-bundle.mjs &&
  node dev/ota-bundle-play.mjs && node dev/ota-fixpoint.mjs` -> pass 2 fixed point, `ota/` **875802**, `ota-play/`
  **875810**, all 5 manifest/updates entries OK. No throwaway probe was needed this time.
- **`dev/test-7271.mjs` — 59 checks, all green**: release metadata (head notes name widget/player and lyrics; patch derives
  cache); the toast takes an optional third arg, arms `_onTap`, routes the tap, opens `showToastList`, which reuses the
  modal styling, numbers/escapes and closes on button or backdrop; both lyrics runs collect names and pass the list (the
  tap affordance appears exactly twice); a fresh toast and an undo toast clear `_onTap`; the older test-617 message pin
  still matches; the repin moved every gate and its cache move is prefix-safe; inline script syntax (4 blocks parse).
- **Gates green after the bump**: test-727 59/59, test-7271 59/59, test-619 55/55, test-718 46/46, test-725 103/103,
  test-7251 109/109, test-7252 57/57, test-726 74/74, test-play-copy 28/28, and test-713..test-724 all green.
  **test-617 is a PRE-EXISTING red at HEAD** (`66 passed, 1 FAILED`, `hits and misses are both persisted`) — reproduced on a
  clean HEAD copy, so it is not caused by this release.
- **NEXT RELEASE: 72.7.2** for another fix inside 72.7, or **72.8** for a feature release. New trio
  `dev/patch-728.mjs` + `repin-728.mjs` + `test-728.mjs`.

## 72.7 (Oct 3, 2026 · 9:29 AM EDT): the instructions are tap-by-tap now — the tools bar says it opens, and every step names the tap
- **The owner's ask, verbatim**: "Make the instructions more clearer of to like click on conversion tools and stuff and a
  drop-down will appear stuff like that to make it more clearer do that". Wording-only release: no markup was reshaped, no
  id invented, no element moved. The `getSongsHowTo*` / walkthrough / scenario copy now **names the tap and the drop-down**
  instead of saying "open the built-in converter below".
- **`dev/patch-727.mjs`** (`VERSION='72.7'`, `OLDVER='72.6'`, `STAMP='October 3, 2026 \\u00b7 9:29 AM EDT'`, 7 notes,
  `CACHE='sidecut-shell-v'+VERSION` derived). 10 keyed subs, so a re-run is a no-op (first run `9 applied, 1 already in
  place`; re-run `0 applied, 10 already in place`):
  1. `APP_VERSION '72.6'` -> `'72.7'`; 2. changelog head inserted before the 72.6 entry; 3. `sw.js` `CACHE_NAME`
     `sidecut-shell-v72.6` -> `v72.7`;
  4. **the tools-bar hint** (global, `all:true`, 2 occurrences): `Spotify · YouTube · MP4 · Expand URL</span></summary>` ->
     `… Expand URL — tap to open ▾</span></summary>`. The bar now reads as a control you press, not a heading you read past.
  5-9. **every teaching line names the tap**: Discover step 2 and Settings step 2 now `Tap <b>🎛️ Conversion Tools</b> below —
     a drop-down opens. … tap the link box to paste the link and tap Convert.`; the `howToGetMusicHead` walkthrough step 2
     and scenario 1 (`howToScenario1Head`) both `Tap 🎛️ Conversion Tools — a drop-down opens; tap 🎵 Spotify to MP3 / WAV /
     FLAC, tap the link box to paste the link …`; `tutSumGetMusic` gains `tap 🎛️ Conversion Tools in Settings → Get Songs or
     Discover first and a drop-down opens`.
  Preserved VERBATIM so the older pins hold: `Open the built-in converter below`, `Paste the link into the built-in`,
  `tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library` (test-662) and
  `<b>Getting music in:</b> paste a Spotify link`.
- **`dev/repin-727.mjs` — 74 edits / 38 files** (`OLDVER='72.6'`, `NEWVER='72.7'`, `NEWCACHE` derived; second run 0;
  "no stale pin left in any gate"). `PREV_MOVES` maps test-713..**test-726** from `'72.5.2'` -> `'72.6'` (16 entries).
  `KEEPS_ITS_VERSION` = test-705.mjs / test-70.mjs. Bespoke: **F1** `test-7251.mjs` stale-cache needle
  `sidecut-shell-v72\.5\.2` -> `…v72\.6`; **F2** `test-7252.mjs` `sidecut-shell-v72[.]5[.]2` -> `…v72[.]6`; **F3**
  `test-726.mjs` gets the same regex change PLUS its hardcoded `OLD_VER_PIN` converted to the derived
  `'const VER = ' + "'" + PREV + "';"`. The **version-prefix trap** again: `'72.6'` is not a prefix of `'72.7'`.
- **THE OTA 2-CYCLE AND THE TWO-NEWLINE FIX.** The 72.7 content landed in the known **one-newline 2-cycle**
  (`874738 <-> 874739`, 8 passes, never settles). Probed the tail padding over a scratch copy (`SC_ROOT=/tmp/exp727`) with
  a **throwaway** `dev/tmp-pad-exp.mjs` (DELETED before commit, like `dev/fix-726-cards.mjs`): pad 0 (one `\n`) = no fixed
  point; pads 1, 2, 4, 5 settle pass 2; pads 3, 6 settle pass 1. Chose **TWO newlines** after `</html>` (the 72.5
  precedent for this exact problem). Result: `ota/` **874740**, `ota-play/` **874747**, settled pass 2, all 5
  manifest/updates entries OK. Lesson: when the fixpoint oscillates by ONE byte, the tail padding is the knob — probe it on a
  scratch copy, do not hand-guess.
- **`dev/test-727.mjs` — 59 checks, all green**: release metadata (incl. widget/player words in the head notes, patch
  derives cache); the tools bar reads as a control (the new hint appears exactly twice, the old heading-only hint 0 times);
  every step names the tap + drop-down (Discover/Settings slices to `<!-- Expand URL card -->`, the modal slice, the tutsum
  slice; the two teaching lines still exactly once; fallback links kept); the Play-only build is given no converter language
  (`_getSongsSteps` intact, header free of drop-down/Conversion Tools/spotisaver, `nextElementSibling.style.display =
  'none'` count 1); the repin moved every gate; inline script syntax (4 blocks parse).
- **`dev/test-619.mjs` NEEDED A RETARGET — and it is the interesting one.** Its `[3]` used the bare phrase
  `🎛️ Conversion Tools` as a proxy for "the tool section", so once the how-to box legitimately *names* the section
  ("Tap 🎛️ Conversion Tools") it reported `the tool section is not nested inside the box` as a false FAIL (53/2). The
  structural guarantee (box does not *contain* the section; `nextElementSibling` IS the section) is independently proven by
  the id assertions, so the fix was to key `[3]` off the section's own markup signature (`TOOL_MARKUP =
  '🎛️ Conversion Tools <span'`), never the bare phrase. Now 55/55. Lesson: **a test that proxies a structure with a phrase
  breaks the moment the copy starts using that phrase — proxy on markup, not on words.**
- **PRE-EXISTING REDS, NOT caused by this work** (identical on `git show HEAD:index.html`): test-705.mjs 223/7,
  batch-635-check.cjs 35/7, test-6058.mjs 47/1, test-66428.mjs 72/1, media-controls-check.cjs 18/1,
  native-snapshot-check.cjs 12/1, audio-focus-check.cjs 35/3. Several gates need `NODE_PATH=/tmp/h/node_modules`.
  `test-66429.mjs` is a known FLAKE (fails in a batch, passes alone). `ota-guard-check` / `ota-update-check` /
  `ota-loop-check` misreport right after `ota-bundle --check` — run each ALONE; `ota-bootapply-check.cjs` needs ~60-150 s.
  The real play-copy gate is `dev/test-play-copy.mjs` (there is no `play-copy-check.cjs`).
- **PREVIEW CAVEAT**: the Freebuff preview serves the workspace root `/home/daytona/codebase` (a separate checkout at
  APP_VERSION 63.1), NOT the `.wt-641` worktree — so the live preview shows the old build and cannot show the new copy.
- **NEXT RELEASE: 72.7.1** for a fix inside 72.7, or **72.8** for a feature release. New trio
  `dev/patch-72Xn.mjs` + `repin-72Xn.mjs` + `test-72Xn.mjs`; `NEWCACHE = 'sidecut-shell-v' + NEWVER`; add test-726.mjs to
  `PREV_MOVES`; and write the repin's bespoke stale-cache sweep correction.

## 72.6 (Oct 2, 2026 · 9:24 PM EDT): the way in is spelled out, a hidden playlist stays hidden, and Expand URL moves down
- **The owner's four asks, in one update**: (1) move the Expand URL card to the BOTTOM of the conversion tools; (2) make
  the "get songs into your library" instructions much clearer; (3) a hidden playlist must stay hidden on reopen; (4) update
  the Freebuff sandbox/preview environment. Plus an explicit "Push". **72.5.2 ships in the SAME push** - it was written but
  never committed, and it is the PREDECESSOR this release pins against (`OLDVER='72.5.2'`).
- **1. THE CARD MOVE — AND THE ANCHOR LESSON.** The Expand URL box is only the fallback for a SHORT Spotify link
  (`open.spotify.com/s/...` -> the full track URL); it sat FIRST in both the Discover and Settings tool lists, in front of
  the Spotify / YouTube / MP4 cards people actually came for. It now sits LAST in each list, after the audio-format
  explainer. **The first attempt used generic anchors** (`'<!-- Expand URL card -->'`, `'<!-- Spotify card -->'`) - and the
  Settings pass then matched the card the Discover pass had JUST INSERTED, slicing from there forward and swallowing the
  whole Settings Spotify/YouTube/MP4/explainer block into the Discover list. The move block was rewritten around a single
  `moveCard(text, startComment, nextComment, closeAnchor)` helper with **indentation-specific anchors** (Discover 6-space,
  Settings 8-space) and each list's own `</details>` close. Lesson: a move that runs twice over two sibling lists must
  anchor on the INDENTATION that distinguishes them, never a bare text comment. One-time `dev/fix-726-cards.mjs` repaired
  the working tree (idempotence-guarded by marker count; throws if run twice on an already-repaired tree).
- **Order, pinned**: Discover `spCardDisc` < `ytCardDisc` < MP4 < explainer < Expand URL; Settings the same. Two
  `<!-- Expand URL card -->` markers remain, one per list. `dev/test-619.mjs` (55 checks) independently confirms it: each
  how-to box's `nextElementSibling` IS the Conversion Tools section containing Expand URL + MP4 + Spotify + YouTube.
- **2. TWO WAYS IN, SAID PLAINLY.** Both how-to boxes (`getSongsHowToDisc` and `getSongsHowToSettings`) and the first-run
  walkthrough (`howToGetMusicHead`) now OPEN with a plain lead-in: there are two ways in - let the app make the file from a
  Spotify or YouTube link, OR bring files you already have with `+ Add songs` - and either way the songs land in your
  library, on your device. The existing steps and outside-site fallback links are untouched.
- **3. A HIDDEN PLAYLIST STAYS HIDDEN.** Hiding a tab is the user saying "keep this out of the way", but the boot restore,
  the Library button and the single-button toggle all picked `lastUsedPlaylist` WITHOUT checking whether it is hidden - so
  reopening the app put a hidden playlist on screen, and it only vanished once a tab switch re-rendered/re-filtered. New
  helpers `scPlaylistVisible(name)` and `scFirstVisiblePlaylist()` (inserted before `function rememberPlaylist(name)`) now
  guard every one of those picks: boot restore (~:30043), the Library-button `pickReal` (~:32409), the single-button toggle
  (~:32392) and the `◀ Library` tab `pl.addEventListener('click', ...)` (~:19206). Hiding is still not a delete: songs,
  order and tags are untouched, and unhiding brings the tab straight back.
- **THE VERSION-PREFIX TRAP, THIRD FORM.** `'72.5.1'` is not a prefix of `'72.6'` (nor of `'72.5.2'`), so the A/B/E steps
  need no lookahead. Every gate written before a release still ends with a "no gate names the PREVIOUS shell cache" sweep,
  and this release needs TWO bespoke retargets: **F1** in `test-7251.mjs` (its built needle was hardcoded `72.5.1` -> now
  `72.5.2`) and **F2** in `test-7252.mjs` (whose hardcoded `OLD_VER_PIN` is replaced by a `PREV`-built needle matching
  `72[.]5[.]2`). Expect a bespoke sweep correction in every repin from here.
- **`dev/repin-726.mjs` - 70 edits / 36 files** (`OLDVER='72.5.2'`, `NEWVER='72.6'`, `NEWCACHE` derived), second run 0,
  "no stale pin left in any gate". `PREV_MOVES` maps test-713..test-725 **and test-7251.mjs, test-7252.mjs** from `'72.5.1'`
  to `'72.5.2'`; `KEEPS_ITS_VERSION` = test-705.mjs / test-70.mjs.
- **`dev/patch-726.mjs`** (`VERSION='72.6'`, `OLDVER='72.5.2'`, `STAMP='October 2, 2026 \\u00b7 9:24 PM EDT'`, 8 notes, cache
  derived, resolves its root from `SC_ROOT` else the script's parent dir) - every sub is an insertion/swap with a `key`, so a
  re-run is a no-op; the card MOVE is code (a move cannot be a keyed sub) guarded by a marker; the OTA tail is normalised to
  exactly ONE newline after `</html>`. Re-run: `0 applied, 13 already in place`.
- **`dev/test-726.mjs` - 74 checks**: release metadata, the card move, the how-to text (scoped to the how-to box slice, so
  `spotisaver`/`spotmate`/`Audio formats explained` duplicates no longer trip it), the hidden-playlist fix **DRIVEN** via
  `bindFn`, the repin, inline syntax. **`dev/test-619.mjs`** re-passed 55/55 too.
- **OTA SETTLED IN THREE PASSES**: pass 1 874288 -> 874361, pass 2 **874361** fixed point; `ota-play/` **874369**. All 5
  manifest/updates entries OK; both `--check`s OK at v72.6. `dev/test-718.mjs` 46/46 (its [4] asserts `ota/`/`ota-play/`
  `updates.json` version == VER and the notes are the head six, verbatim).
- **4. FREEBUFF PREVIEW ENV.** `freebuff-preview set-install "npm install"`, `set "npm run preview" 8080`,
  `set-build "npm run build"`, then `start` -> `running:true, listening:true`. `.wt-641/package.json` has ONLY
  `preview`/`build` (no `dev`), so the preview command MUST be `npm run preview`. See the note under PRE-EXISTING REDS for
  the `freebuff-preview`/`curl` reachability gotcha.
- **PRE-EXISTING REDS, NOT caused by this work** (verified identical on `git show HEAD:index.html`): test-705.mjs 223/7,
  batch-635-check.cjs 35/7, test-6058.mjs 47/1, test-66428.mjs 72/1, media-controls-check.cjs 18/1,
  **native-snapshot-check.cjs 12/1** (`the recovery file is written at all`, 12/1 on HEAD too), audio-focus-check.cjs 35/3.
  Several gates need `NODE_PATH=/tmp/h/node_modules`. `test-66429.mjs` is a known FLAKE (failed once in a batch, passes
  alone). `ota-guard-check` / `ota-update-check` / `ota-loop-check` misreport if run right after `ota-bundle --check` - run
  each ALONE. `dev/ota-bootapply-check.cjs` needs ~60-150 s (jsdom + real timers), so give it a long timeout.
- **NEXT RELEASE: 72.6.1** for a fix inside 72.6 (the third number stops at nine), or **72.7** for a feature release. New
  trio `dev/patch-72Xn.mjs` + `repin-72Xn.mjs` + `test-72Xn.mjs`; `NEWCACHE = 'sidecut-shell-v' + NEWVER`; move
  test-713..test-7252 pins; add `test-726.mjs` to `PREV_MOVES`; and write the repin's bespoke stale-cache sweep correction.

## 72.5.2 (Oct 2, 2026): the widget can pause, and now it can play again
- **The owner's words**: "The widgit can pause but not play again and forward and backward songs don't work v72.5.2". That is
  one press that had been working (pause) and three that had not (play, next, previous) - and there are TWO independent
  causes, one on each side of the bridge. Both are fixed in this single update.
- **CAUSE 1 (web, rides the OTA): STOPPING SET A MARK AND STARTING NEVER CLEARED IT.** Stopping sets `userPaused`, the flag
  that tells the background heartbeat "this stop was deliberate - do not revive it". Nothing in the media-session
  transport cleared it again, so after a pause from the widget every later play / next / previous ran with the mark still
  set - and the ONE mechanism that puts a backgrounded WebView back together refuses to run while it is set: `recoverAudio`
  returns at `if(userPaused) return;` (~:26990) and the revive loop is gated on `!userPaused` (~:26749). A song the phone
  reclaimed while the app was away therefore could not be rebuilt, so resume and skips came out silent - while pause,
  which needs none of that, kept working. That asymmetry IS the report. New helper `scTransportResume()` (one definition,
  asserted) clears **`userPaused` AND `audioFocusInterrupted`**, and the `play`, `nexttrack` and `previoustrack` handlers
  call it first. The `play` handler also RETRIES once (a rejected `play()` is the case `recoverAudio` exists for), and
  `previoustrack` starts a paused song again instead of moving a playhead nobody can hear. `pause`/`stop` still SET the
  mark - that is what makes the reset mean anything.
- **CAUSE 2 (native widget, needs the next APK): THE TOGGLE ASKED THE PHONE TO DECIDE.** The widget sent
  `KEYCODE_MEDIA_PLAY_PAUSE`, which is a TOGGLE the system resolves against the playback state IT last saw for the
  session - and keeps resolving that way until the state changes, so a stale state answers "pause" for ever. That is
  "can pause but not play again" in one line. `onReceive` now reads the widget's own stored state
  (`SharedPreferences 'sidecut_widget'` -> `JSONObject` -> `st.has("playing")`) and names the verb outright
  (`KEYCODE_MEDIA_PAUSE` while it shows pause, `KEYCODE_MEDIA_PLAY` while it shows play), falling back to the toggle ONLY
  when there is no state to go on. The widget already draws its icon from that same flag, so it may as well act on it.
- **DELIVERY IS STILL SPLIT.** The web half rides the OTA and reaches a phone in minutes; the widget half is native Java
  injected only during the Android CI build, so it needs the NEXT APK. Complementary, not alternatives - same as 72.5.1.
- **WHAT DID NOT MOVE, AND IS PINNED**: the eight registered controls (play / pause / previoustrack / nexttrack /
  seekbackward / seekforward / stop / seekto), the >3s "previous restarts the song" rule, the single
  `mediaSetActionHandler`, the 4 s skip-storm throttle, the ten-minute background release (`MEDIA_BG_GRACE_MS`) and the
  single `mediaSetPlaybackState('none')` site. `dev/test-7252.mjs` asserts each of them, and asserts that pause still
  sets the mark.
- **THE VERSION-PREFIX TRAP, SECOND FORM.** `'72.5.2'` does NOT contain `'72.5.1'` (unlike 72.5.1 vs 72.5), so the A/B/E
  steps need no lookahead. What still needs its delimiter is the D step: `const PREV = '72.5';` is a PREFIX of
  `const PREV = '72.5.1';`, so the D move is written with the trailing `;` or it would rewrite the pin it just wrote.
- **`dev/repin-7252.mjs` - 66 edits / 34 files** (`OLDVER='72.5.1'`, `NEWVER='72.5.2'`, `NEWCACHE` derived), second run 0,
  `no stale pin left in any gate`. `PREV_MOVES` maps test-713..test-725 **and test-7251.mjs** from `'72.5'` to `'72.5.1'`,
  `KEEPS_ITS_VERSION` = test-705.mjs/test-70.mjs. **Bespoke F1**: test-7251.mjs is a gate now, so its OWN [6] sweep moves
  with this release - the built old-build needle is read from `PREV` instead of a hardcoded `'72.5'`, and its hardcoded
  stale-cache regex `/sidecut-shell-v72\.5(?!\.1)/` - which was written to tell 72.5 from 72.5.1 and would now match this
  release's own `sidecut-shell-v72.5.2` - is retargeted at 72.5.1. **This is the second release in a row where a gate's
  own stale sweep had to be taught about the new name; expect it in every repin from here.**
- **`dev/patch-7252.mjs`** (`VERSION='72.5.2'`, `OLDVER='72.5.1'`, `STAMP='October 2, 2026 \u00b7 8:53 PM EDT'`, 7 notes,
  cache derived) - 6 keyed subs/steps plus the idempotent one-newline tail normaliser, and NO top guard (all keyed, same
  reasoning as 72.5.1). It writes THREE files now: index.html, sw.js and `.github/workflows/patch-widget.py`.
  Re-run: `0 applied, 7 already in place`.
- **`dev/test-7252.mjs` - 57 checks**, sections [1] release metadata [2] the transport-resume fix **DRIVEN** (the real
  `scTransportResume` and `registerMediaSessionHandlers` are lifted with `bindFn` and run against a stub element whose
  `play()` rejects - asserting that play/next/previous clear the mark, that a rejected play reaches `recoverAudio`, that
  next/prev really advance, and that pause still sets it) [3] the widget names its own verb, plus a scratch-tree emit of
  the real provider Java [4] the repin moved every gate [5] inline script syntax.
- **OTA SETTLED IN THREE PASSES, no tail fight this time**: pass 1 873113 -> 873065, pass 2 -> 873064, pass 3 **873064**
  fixed point; `ota-play/` **873072**. All 5 manifest/updates entries OK; both `--check`s OK at v72.5.2.
- **PRE-EXISTING REDS, NOT caused by this work** (identical on `git show HEAD:index.html`): test-705.mjs 223/7,
  batch-635-check.cjs 35/7, test-6058.mjs 47/1, **test-66428.mjs 72/1** (its page-wide `\u2022` canary wants 47; the page
  has held 48 since >=72.0), media-controls-check.cjs 18/1 (`and it no longer fires every half hour`),
  audio-focus-check.cjs 35/3. Several gates need `NODE_PATH=/tmp/h/node_modules` (jsdom scratch).
- **NEXT RELEASE: 72.5.3** for another fix inside 72.5 (the third number stops at nine), or **72.6** for a feature
  release. New trio `dev/patch-72Xn.mjs` + `repin-72Xn.mjs` + `test-72Xn.mjs`; `NEWCACHE = 'sidecut-shell-v' + NEWVER`;
  move test-713..test-7251 pins; add `test-7252.mjs` to `PREV_MOVES`; and remember the repin's bespoke sweep correction.

## 72.5.1 (Oct 2, 2026): the widget transport buttons reach the player again
- **The owner's request**: "I hit play then I exit the app since still playing and then I go to the widget and the pause
  button and play button don't work neither to song forward and back fix this v72.5.1 fix any other bugs you find". A
  second request landed mid-session and rides the SAME update: an OPTIONAL album switch (see below).
- **THE WIDGET BUG, ROOT CAUSE.** The home-screen widget (`.github/workflows/patch-widget.py`, native Java injected only
  during the Android CI build) turned button taps into `AudioManager.dispatchMediaKeyEvent` - a system-wide
  media key. Android delivers a media key to whichever player it currently considers active; in the background that is
  often another app or nothing, so all four buttons died while the song audibly played. The widget now hands the key
  straight to our own session: `Intent(Intent.ACTION_MEDIA_BUTTON)` addressed at `io.github.jofr.capacitor.
  mediasessionplugin.MediaSessionService` with an `EXTRA_KEY_EVENT` `KeyEvent(ACTION_DOWN, code)` via `startService`; the
  system-wide `dispatchMediaKeyEvent` remains only as a fallback when `startService` throws, and if even that fails and
  `!am.isMusicActive()` it opens the app. `pi(ctx, action, extra)` still builds `com.SideCut.myapp.WIDGET_<action>` and
  `onReceive` still handles `_open/_prev/_next/_playpause/_HBCHECK/BOOT_COMPLETED/MY_PACKAGE_REPLACED/APPWIDGET_*`.
- **THE WEB HALF, AND WHY IT WAS DEAD TOO.** `index.html` mirrored controls to BOTH `navigator.mediaSession` and the
  native `@jofr/capacitor-media-session` plugin, but `_scArmNativeMedia` (was a bare one-shot `setTimeout(..., 3000)`)
  armed EXACTLY ONCE, 3 s after boot; if the bridge wasn't ready at that one moment the whole session had NO handler. It
  is now a named `function _scArmNativeMedia()` with a one-way `_scMediaArmDone` flag set ONLY right after
  `capMediaSessionActive = capMediaSessionNative` (so it is set when the adapter is genuinely live), a 3 s first attempt,
  and a bounded retry `setInterval(..., 2000)` that stops after `_scArmTries > 30` or on `_scMediaArmDone`.
- **THE CONTROLS RE-ASSERT.** The `visibilitychange` HIDDEN branch now calls `mediaHandlersNeedArm();
  refreshMediaControls();` before `armMediaRelease()`, and `startMediaSessionHeartbeat` fires `refreshMediaControls()`
  once per beat while `mediaHandlersDirty`. So the transport is rebuilt on the way OUT and while the song is playing.
- **DELIVERY IS SPLIT ON PURPOSE.** The web half rides OTA; the widget half needs the NEXT APK. They are complementary,
  not alternatives - the widget hand-off only helps once a build carrying it is on the device, while the media-session
  half improves the current one on the next OTA.
- **THE OPTIONAL ALBUM SWITCH.** The other request, re-thought mid-session: "maybe in albums it should be like you can
  have 2 albums open at once but the song playing in that album stays open when you leave the tab then all albums
  collapse except for the one the current song is playing in if it's in an album ... optional". So it is **OFF by
  default** (`localStorage['sidecut_albumFocusPlaying'] === '1'`). While ON the Albums tab **nothing is touched** - you
  can keep as many albums open as you like, which is exactly how the list has always worked (each card has its own
  `sidecut_albColl_<name>`). On the way OUT of the tab, `scAlbumsRememberOnLeave()` closes every album card except
  `scAlbumForPlayingTrack()`, **persisting** the state (not just painting it) because the cards are rebuilt from
  `sidecut_albColl_*` on the next render. `scAlbumForPlayingTrack()` reads the DJ track or `queue[queueIndex]`, finds it
  in `userAlbums` (skipping auto-albums), falls back to the track's album TAG, and never CREATES an album - a song in no
  album leaves them all shut.
- **THE ALBUM SWITCH'S TWO HOMES AND TWO CALLERS.** Toggle row `#albumFocusPlayingToggle` in Settings > More (after
  `autoScrollToggle`) and `#mgrAlbumFocusPlayingToggle` in `manageAlbumsHTML()`; both wired, both labels kept in sync by
  `scSyncAlbumFocusToggles()` (also at boot). The two leave-callers are the `navigate()` hook
  (`if(view !== "albums" && view !== "library")` before anything else) and the single-library-button flip, which reads
  the OLD `libraryMode` before flipping it. Internal names: `scAlbumFocusOn`, `scAlbumForPlayingTrack`,
  `scAlbumsRememberOnLeave`, `scSyncAlbumFocusToggles`, `scSetAlbumFocus`, `window.__scAlbumFocusOn`,
  `window.__scAlbumsRememberOnLeave`.
- **THE FOUR-PART VERSION / PREFIX TRAP (the central lesson of 72.5.1).** `'72.5'` is a PREFIX of `'72.5.1'`, and
  `'sidecut-shell-v72.5'` a prefix of `'sidecut-shell-v72.5.1'`. Three consequences had to be handled. (1) repin's
  cache step uses a lookahead `new RegExp(esc(OLDCACHE) + '(?!\\.1)', 'g')` else it re-fires on its own output and
  produces `sidecut-shell-v72.5.1.1`. (2) The repin head-entry literal now matches `\{ version: '72.5'(?!\.)` because
  some gates write it as a REGEX, and the lookahead stops self-matching. (3) test-719..test-725 each end with a "no gate
  still names the PREVIOUS shell cache" sweep using a bare `t.indexOf('sidecut-shell-v' + PREV)`, TRUE for the new tree
  - 1 FAILURE each in 7 gates until repin applies a bespoke **F2** replacing it with
  `new RegExp('sidecut-shell-v' + PREV.replace(/\./g, '\\.') + '(?!\\.)').test(t)`. `dev/test-7251.mjs` itself is
  scanned by its own sweep, so it builds the needle at runtime. `v72.5.1` IS legal for the version gates
  (`test-662`/`test-6642` accept `/^\d+(\.\d+)*$/`; `native-updates.js` `compareVersions` splits on `.` and
  `parseInt`s segment by segment, so `72.5.1 > 72.5`).
- **THE OTA TAIL, PROBED AGAIN.** At this page size `ota-fixpoint.mjs` two-cycled `872146 <-> 872147` for all 8 passes. A
  throwaway probe across pads 0..4 showed `pad 0 -> 872144 settled`, `pad 1 -> 872146 settled`, `pad 2 -> cycle`. So
  patch-7251 NORMALIZES the tail to exactly ONE newline after `</html>` in code (a removal, so it cannot be a keyed
  sub): `const trimmed = html.text.replace(/\s*$/, ''); const want = trimmed.endsWith('</html>') ? trimmed + '\n' :
  trimmed;`. Re-run then settled in **pass 3: `ota/` 872146, `ota-play/` 872153**, all 5 manifest/updates entries OK.
- **THE PATCH, REPIN AND GATE.** `dev/patch-7251.mjs` (`VERSION='72.5.1'`, `OLDVER='72.5'`, `STAMP='October 2, 2026
  \u00b7 7:27 PM EDT'`, 9 notes, cache derived as `'sidecut-shell-v' + VERSION`) carries 21 keyed sub/steps and, by
  DESIGN, **no top short-circuit guard** - the album subs were added AFTER the first pass, so every sub is an
  insertion/swap and keyed; a re-run adds only what is missing (`0 applied, 21 already in place`).
  `dev/repin-7251.mjs` final run **60 edits across 33 files**, second run 0, `PREV_MOVES` maps test-713..test-725 `72.4`
  -> `72.5`, `KEEPS_ITS_VERSION` = test-705.mjs/test-70.mjs, plus the F1 test-725 `const OWN = '72.5'` split and the F2
  correction above. `dev/test-7251.mjs` = **109 checks** across 9 sections, section [7] DRIVES the album helpers with
  `bindFn()` against fake cards + a fake localStorage, section [8] copies `patch-widget.py` into a SCRATCH dir and runs
  it to assert the emitted Java (never run it from the repo - it resolves its project root from its own file location
  and would write an `android/` tree here).
- **PRE-EXISTING REDS, NOT caused by this work** (identical on `git show HEAD:index.html`): `test-705.mjs` 223/7,
  `batch-635-check.cjs` 35/7, `test-6058.mjs` 47/1, `test-66428.mjs` 72/1 (its page-wide `\u2022` canary expects 47;
  the page has held 48 since >=72.0), `media-controls-check.cjs` 18/1, `audio-focus-check.cjs` 35/3. Several gates need
  `NODE_PATH=/tmp/h/node_modules` (jsdom scratch).
- **NEXT RELEASE: 72.6** - new trio `dev/patch-726.mjs` + `repin-726.mjs` + `test-726.mjs`; `OLDVER='72.5.1'`,
  `NEWCACHE = 'sidecut-shell-v' + NEWVER`; move test-713..test-725 pins from `'72.5'` to `'72.5.1'`; add `test-7251.mjs`
  to `PREV_MOVES`. Remember the prefix trap: `'72.5.1'` is a prefix of nothing here, but the lookahead guards and the F2
  cache sweep are now the established pattern.

## 72.5 (Oct 2, 2026): All Songs tells the truth about every song in it
- **The owner's words** (all one message, mid-conversion): "WHY ARE THEIR DUPLICATE SONGS IN ALL SONGS", "WHY ARE
  SONGS THAT EXIST IN THE APP NOT SHOWING IN ALL SONGS", "SONGS THAT ARE COMPLETE DUPLICATES IN ALL SONGS BUT DELETING
  ONE DELETS THE OTHER", "SEARCH ISNT EVEN WORKING I LOOK UP SHUBH WHY IS CHEEMA Y POPPING UP", "the downloader saying
  the songs are in my library and the number goes up but it keeps not showing", "IT TAKES FOREVER TO DOWNLOAD MUSIC".
  Two screenshots: All Songs whose rows repeat (23 / Excuse Me / What..? / Bucks & Fame, then 23 / Excuse Me / What..?
  again) while the duplicate banner says only "Found 1 duplicate song (1 extra copy)", and a search for `Shubh` whose
  list is `Bucks & Fame`, `23`, `Excuse Me`, `What..?` — none of them by Shubh.
- **THE THREE FAULTS.** (1) A repeated id in `playlists['All Songs']` renders the SAME song twice, and `deleteTrack`
  filters every playlist by id — so one tap removes both rows, because they were never two songs. That is why the visual
  duplicates outnumbered the banner: `getDuplicateGroups()` walks `allTracks` (the objects), the rows come from the id
  array, and only one of the two had a real second copy. (2) A search matched the **album** field exactly as hard as the
  name and the artist, and every song of a converted PLAYLIST was stamped with the playlist's own name as its album —
  so `Shubh` answered for anything filed under that tag, which was a whole converted list. (3) The verify loop called
  `scYtPlayer` for up to TEN ranked candidates one after another, including candidates whose length (already in the
  search result) ruled them out — a request each.
- **WHY TWO SONGS COULD SHARE AN ID (the "delete one, both go" mechanism).** `idCounter = metaMap.idCounter ||
  allTracks.length` — the fallback was the COUNT of songs. Delete anything, or come back from the snapshot restore
  (which rewrites the whole meta store and reloads), and the counter sat BELOW ids already in use, so a new song was
  handed an id an older song already had: one row in `_trackMap`, one row in the list, one delete taking both.
- **`dev/patch-725.mjs` — 19 edits, EVERY sub keyed.** (1) New `scNextTrackId()` scans `allTracks` for a free id and
  `scHighestTrackId()` parses `^t(\d+)$`; boot is now `idCounter = Math.max(Number(metaMap.idCounter) || 0,
  scHighestTrackId() + 1);`. (2) The converted-add and import id sites ask for a free id. (3) The boot repair flattens
  repeats out of EVERY playlist (All Songs included) and persists when it did (`repeatsFlattened`). (4) The two filing
  pushes are `indexOf(...) === -1` guarded. (5) `renderListInner` dedupes `rawIds` before sorting/counting. (6) The
  search is name-or-artist first, album only as a fallback (`_scFieldHit`/`_scNamed`). (7) `plan.album` is applied only
  when `plan.kind === 'album'`. (8) The audio query skips the two extra searches via the local `_scFirstCarriesIt` test,
  the expected length is checked BEFORE `scYtPlayer`, and the loop `break`s on a strong full-length match.
- **THE DRAW FIX AND ITS ORDERING TRAP.** `scAddConvertedToLibrary` now calls `renderList()` **then** `scRenderListNow()`.
  The order is the whole point: `scRenderListNow()` returns early unless `_renderListPending` is set (which is what
  `renderList()` does), and the deferred arm refuses to draw while `scListIsMoving()` — which is exactly why a run could
  report songs as added while the list showed none.
- **IDEMPOTENCE (learned the hard way).** Two of the 72.5 subs are INSERTIONS whose anchor survives, and a first run of
  the script left them keyless, so a re-run inserted `scNextTrackId` and the `_scSeenId` dedupe a SECOND time (caught by
  `count(...) === 1` verification added after the fact). **Every sub in patch-725 carries a `key`**, and the top
  short-circuit no longer requires `--check` (keyless text-REMOVAL subs can never be keyed, so the guard is what protects
  the padding move). Expect `19 edit(s) applied, 0 already in place` from 72.4 and `0 applied, 19 already in place` after.
- **THE OTA TWO-CYCLE, AND THAT THE FIXPOINT CAN BE TRAPPED.** For 72.5's content the size map is
  `869361 -> 869363`, `869362 -> 869361`, `869363 -> 869363`, i.e. **the fixed point (869363) is NOT in the 2-cycle the
  real tree gets stuck in**, so `dev/ota-fixpoint.mjs` burned all 8 passes reporting "the size did not settle". Probing
  trailing newlines 1..15 (`dev/tmp-pad-exp.mjs`, since deleted, over a /tmp/exp tree) showed a **two-newline tail
  settles in one pass from 869361** while four or more sit in the cycle. patch-725 therefore replaces the 72.3 FOUR
  newlines (`</html>\n\n\n\n`, which is what HEAD actually held — the 72.3 sub appended three to a single one) with
  **TWO**. `</html>` + 2 newlines is invisible to the page and rides in the bundle only. **Settled: 869361 (`ota/`) /
  869371 (`ota-play/`), one pass**, and two generations are byte-identical across 8 artifacts (`/tmp/gen725.md5`).
  **If a future release hits this again, probe the tail rather than trusting the 8-pass loop.**
- **`dev/repin-725.mjs` — 61 edits / 32 files** (59 mechanical + 2 bespoke). `OLDVER='72.4'`, `NEWVER='72.5'`,
  `NEWCACHE` derived; `PREV_MOVES` maps test-713..test-724 `['72.3','72.4']`; KEEPS_ITS_VERSION = test-705.mjs,
  test-70.mjs. **TWO bespoke moves**: F1 test-724.mjs gets the OWN split (`const OWN = '72.4'`) for its `/artist/` and
  `/album/`+`/tag/` note checks; F2 test-66431.mjs pinned "those two record taps are the only callers" of
  `scRenderListNow()` (count === 2) — 72.5 adds a deliberate third (the add path), so the count moves to **3** and the
  gate now asserts that the extra caller is `scAddConvertedToLibrary`. test-70 runs test-66431, so this showed up as a
  test-70 failure too.
- **`dev/test-725.mjs` — 103 checks**, sections [1] release metadata [2] an id is never handed out twice **[the real
  `scNextTrackId`/`scHighestTrackId` are lifted out of the page with `bindFn` and DRIVEN: a library `t0,t1,t7,t9` with
  `idCounter = 2` must yield 6 unique ids, step over `t7`/`t9`, use `t2`/`t8`, and leave no two songs on one id]**
  [3] a song is in All Songs once and a landed song is drawn at once [4] the search answer [5] the request savings
  [6] what did not move [7] the repin moved every gate [8] inline script syntax. ⚠ **The `renderListInner` slice must end
  at `const fullIds = ids.slice();` and the `scSpToBuffer` slice at `function scArtistMatch(` — `_isUserAlbumTrack` and
  `scEscapeHtml` both come BEFORE those functions, so those end-markers silently produce an empty slice.**
- **Gate set all green**: test-725 **103** (new), test-724 79, test-723 87, test-722 79, test-721 54, test-720 66,
  test-719 70, test-718 46, test-717 94, test-716 83, test-715 72, test-714 137, test-713 50, test-70 182, test-662 75,
  test-6643 90, test-6642 75, test-66421 49, test-66422 87, test-66423 52, test-66424 102, test-66425 101,
  test-66426 86, test-66427 82, test-66429 83, test-66431 96, test-play-copy 28, test-612, test-6136, test-6137,
  test-6138, test-6139, test-651 35, test-6641 128, **studio-70-check.cjs 390**, check-dom 0 failures, ota-guard 20/0,
  ota-update 52/0, ota-loop 26/0.
- **Pre-existing reds, NOT in the gate set, unchanged** (each verified NOT caused by 72.5): test-705.mjs 223/7,
  batch-635-check.cjs 35/7, test-6058.mjs 47/1, test-66428.mjs 72/1 (its page-wide bullet canary; the page has held 48
  since at least 72.0).
- **NOTE on the two-byte-identical OTA checks**: `dev/ota-guard-check.cjs` and `dev/ota-update-check.cjs` reported
  14/6 and 42/10 on the first run immediately after a `--check` pair in the same shell, then 20/0 and 52/0 on a clean
  re-run. They rebuild the bundle themselves; run them on their own.
- **STILL OPEN (the owner's longer report):** Spotify streams are DRM-protected and its ToS forbid ripping, so a
  Spotify→MP3 replacement is off the table; the offered alternative is bulk local file/folder import with
  auto-tagging. Also open: "adding to library" adding the wrong song or none, and the album-level artist mismatch on a
  *fallback* album resolve (no `author_name` in oEmbed, so `scDeezerLookup`/`scItunesLookup` get an empty artist hint).
- **NEXT RELEASE: 72.6**

## 72.4 (Oct 2, 2026): a song from a Spotify link is named by the link
- **The owner's words**: "Ya do that and make sure it fetches the right metadata" - the follow-on to the longer report
  that still had the converter's "no matching source" for brand-new singles, Spotify-linked songs arriving without
  metadata, and "HOW IS IT GETTING THE ARTIST WRONG IN ALBUMS AND IN GETTING A SONG" on the open list.
- **THE DIAGNOSIS.** A single-track Spotify link resolves through three readers, and all three could lose or invent the
  name: `scSpOembed(url)` (the track NAME + cover - the track oEmbed carries **no artist at all**),
  `scSpEmbedTrack(url)` (the ARTIST, from the embed page's `__NEXT_DATA__`), then `scEnrichSingleMeta(meta)` (whatever the
  first two left blank, from iTunes). Three defects, one per reader:
  1. **`scSpOembed` was the ONE reader of `open.spotify.com` that never used the device network.** It called the page
     itself and then three public relays. On Android the page request gets no answer (Spotify sends no cross-origin
     permission) and the relays are a browser-only fallback the app's own comment calls "go quiet for days". So the
     title and the cover of a fresh track arrived EMPTY, and a plan with no title is no plan - the link looked like it
     held nothing. `scSpEmbedEntity`/`scSpEmbedTrack` already go `native:` first for exactly this reason.
  2. **`scEnrichSingleMeta` accepted the first iTunes result for the TITLE ALONE whenever the link had no artist** -
     which is the whole case of a brand-new single whose embed was not readable, i.e. exactly when metadata is scarce.
     `scDeezerArtistOk` answers `true` on an empty hint ("nothing to judge on"), so `result[0]` was taken whatever it
     was. That is routinely a cover, a re-record, a karaoke cut or another performer's song with a similar name, and its
     artist, album, year, genre and cover were ALL borrowed: the tag, the file name and the library row named the wrong
     performer. The audio search was then built FROM that wrong name, which is how the right song answered "no matching
     source". **This is the single root cause behind three of the owner's reported symptoms.**
  3. **A one-track release is filed by every one of these catalogs as `<Song> - Single`.** That wrapper was copied into
     the album a song was tagged with and into the album the search asked for. 72.3 already strips it for the release
     lists (`scSingleTitle`); the same rule now applies to a plan.
- **`dev/patch-724.mjs` - 10 edits.** (1) `scSpOembed` tries `await __scNativeFetch(base)` first and only accepts a reply
  with `title`, before `var attempts = [` (relays kept as the browser fallback). (2) The iTunes loop in
  `scEnrichSingleMeta` now requires `scAlbumTitleOk(it.results[i].trackName, meta.title)` first, and when `meta.artist`
  is empty also requires `scTrackTitleKey(found) === scTrackTitleKey(meta.title)` (the SAME name, not merely a name
  containing it). The artist test stays, and only gaps are still filled. (3) New `scPlanDropSingleSuffix(plan)`
  (inserted right after `window.__scSingleTitle = scSingleTitle;`) strips the wrapper from a plan's `title`, its `album`
  and every `tracks[i].album`. (4) The album-embed plan's `eName` runs through `scSingleTitle`. (5) Both fallback
  assignments in `scResolveSpotifyPlan` became `scAlbumResolveCache[url] = scPlanDropSingleSuffix(pl/ab);`. (6) The audio
  query in `scSpToBuffer` is now `[title, artist, album].filter(...).join(' ').trim()` so an unnamed part leaves no
  blank. (7) APP_VERSION / changelog / cache. **Do NOT touch the `</html>\n\n\n` padding** - it is what holds the OTA
  bundle off its size two-cycle, and it is already in the tree.
- **`dev/repin-724.mjs` - 58 edits / 31 files** (55 mechanical + 3 bespoke). `OLDVER='72.3'`, `NEWVER='72.4'`,
  `NEWCACHE` derived; `PREV_MOVES` maps test-713..test-723 `['72.2','72.3']`; KEEPS_ITS_VERSION = test-705.mjs, test-70.mjs.
  **ONE bespoke move**: F1 test-723.mjs gets the OWN split (`const OWN = '72.3'`, `const ownEntry = entries.find(...)`,
  `const ownNotes = ...`) so its `/all songs/i` and `/single/i && /release/i` checks read the 72.3 entry rather than the
  new head (72.4's notes are about metadata). Every other head check in that gate is a rule every release must satisfy
  and correctly stays on the head. Ends with "no stale pin left in any gate".
- **`dev/test-724.mjs` - 79 checks**, sections [1] release metadata [2] the link reader reaches the device network
  [3] a look-alike cannot name the song **[behavioural: `scAlbumTitleOk` + `scTrackTitleKey` are lifted out of the page
  and RUN, not read]** [4] a one-track release is filed as its own song [5] the audio query carries no blank part
  [6] what did not move [7] the repin moved every gate [8] inline script syntax.
- **OTA at a TRUE byte-identical fixed point: 866774 (`ota/`) / 866783 (`ota-play/`)**, settled in 3 passes; the 72.3
  three-newline padding still holds, so no new padding was added. Two generations verified byte-identical across 8
  artifacts (`/tmp/gen724a.md5`). Both bundle `--check`s OK (6 notes each).
- **Gate set all green**: test-724 **79** (new), test-723 87, test-722 79, test-721 54, test-720 66, test-719 70,
  test-718 46, test-717 94, test-716 83, test-715 72, test-714 137, test-713 50, test-70 182, test-662 75, test-6643 90,
  test-6642 75, test-66421 49, test-66422 87, test-66423 52, test-66424 102, test-66425 101, test-66426 86,
  test-66427 82, test-66429 83, test-66431 95, test-play-copy 28, test-612, test-6136, test-6137, test-6138, test-6139,
  test-651 35, test-6641 128, **studio-70-check.cjs 390**, check-dom 0 failures, ota-guard 20/0, ota-update 52/0,
  ota-loop 26/0.
- **Pre-existing reds, NOT in the gate set, unchanged** (each verified NOT caused by 72.4): test-705.mjs 223/7,
  batch-635-check.cjs 35/7, test-6058.mjs 47/1, test-66428.mjs 72/1 (its page-wide bullet canary; the page has held 48
  since at least 72.0).
- **STILL OPEN (the owner's longer report, none of it touched here):** "adding to library" adding the wrong song or none;
  and the album-level artist mismatch on a *fallback* resolve (when `scSpEmbedEntity` is unreachable, `oEmbed` carries no
  `author_name`, so `scDeezerLookup`/`scItunesLookup` are called with an empty artist hint and only `scAlbumTitleOk`
  guards the album name). A conservative guard for that - require the fallback album's own artist, and require the
  tracks to agree with it - is the natural next step.
- **NEXT RELEASE: 72.5**

## 72.3 (Oct 2, 2026): a new single is caught when it lands, and the release page plays it
- **The owner's words**: "How the hell did upcoming releases or fetch latest didn't catch the new single but refetching
  discover did" + "make upcoming releases and new releases home bubble actually give you the track on the release date".
  Both halves shipped: the release check now reads the artist's own catalog, and a landed drop is handed its track.
- **THE DIAGNOSIS (probed live Oct 2, 2026)**: New releases, Upcoming and the Home bubble are ALL fed from ONE place,
  `pinnedReleases`, and only `checkPinnedArtistReleases()` writes it, via `fetchArtistReleases()`. That reader had three
  blind spots the Discover refetches do not have: (a) its song pass is an `entity=song` search, which iTunes ranks by
  POPULARITY - a single that came out this morning has no plays, so it is not in the 200 results (measured: 4 of one
  prolific artist's 6 newest releases, every one a one-track single, were absent from BOTH the US and the IN song
  results); (b) its artist-catalog pass - the one place a fresh single really lives - ran only INSIDE the success branch
  of a popularity-ranked album search, and even then threw away every `trackCount===1` release as "comes through the song
  query", which it does not; (c) it read only the default storefront, while the Discover refetches read IN (and more).
  **The bubble was never broken - it was showing exactly what the reader had stored.**
- **`dev/patch-723.mjs` - 12 edits.** (1) `scItunesArtistAlbums` now loops `['', '&country=IN']` and collapses a
  collection named twice by its id. (2) New `scSingleTitle(name)` strips a trailing `- Single`/`-Single`/`- Single`
  wrapper (a one-track release is named `<Song> - Single` by Apple; the song is the release, the wrapper is the filing
  label). (3) The catalog read moved OUT of the album-search success branch into its own pass (new comment anchored on
  `var _catAlbums = await scItunesArtistAlbums(artist);`), gated `_catNew = <60d` OR `_catNoNewer = >= newest stored`,
  sorted, `slice(0, 8)`, deduped against `prevKeys`/`freshTitles`/`fresh`, and **keeps a one-track release as
  `kind:'single'`**. (4) New `scDeliverDueReleases()` (+ `window.__scDeliverDueReleases`): for every stored drop whose
  day has arrived and which lacks a playable track, look the song up once (`entity=song&limit=10`), match artist via
  `__scSameArtistName` and title by normalized prefix, and fill in `previewUrl`/`url`/`cid`/`art`, setting `kind:'single'`
  on a one-track match. Bounded (`slice(0,12)`), one look per drop per day (`_deliverTried`), `_scDeliverBusy` guard, and
  **called from `checkPinnedArtistReleases` right before `pinnedCheckState.finishedAt`**, so the boot check, the
  six-hour check, a foreground return and the Fetch latest button all deliver it on the day. (5) **`saveMeta()` no longer
  returns early in Albums mode** - see below. (6) APP_VERSION / changelog / cache, and three trailing newlines.
- **THE All Songs BUG (same patch, note 7).** `saveMeta()` opened with `if(libraryMode === 'albums'){ ...write idCounter +
  userAlbums...; return; }`, a guard from when album browsing could rewrite playlists. Nothing in an album path touches
  `playlists` any more (the only two writes reachable from the Albums half - the song kebab and the reorder commit - are
  BOTH gated on `libraryMode === 'albums'`), so all the guard did was drop the write for the paths that legitimately
  change playlists while the user is on Albums: a converted song pushed into All Songs, a delete, a favourite. **All
  Songs is a STORED list; Unsorted is a LIVE FILTER over `allTracks`** (`rawIds = allTracks.map(t=>t.id).filter(id =>
  !inSomePlaylist.has(id))`) - which is exactly the reported shape: the song shows in Unsorted, is missing from All
  Songs, and vanishes from All Songs entirely on the next reload. The row is written unconditionally now.
- **`dev/repin-723.mjs` - 60 edits / 33 files** (54 mechanical + 6 bespoke). `PREV_MOVES` maps test-713..test-722
  `['72.1','72.2']`; KEEPS_ITS_VERSION = test-705.mjs, test-70.mjs. **FOUR bespoke moves**: F1 test-722.mjs gets the OWN
  split (`const OWN = '72.2'`, the `studio`/`batch` note checks now read that entry - the head is 72.3, whose notes are
  about the release check); F2 test-612.mjs + test-6138.mjs watched the catalog read sit inside the album loop guarded by
  `catch(_idE)` - 72.3 moved the read into its own pass and named the guard `catch(_catE)`, so both are repointed
  (`scItunesArtistAlbums(artist)` is now AFTER `albPick.slice(0, 5)`, not before `const albPick = []`); F3 test-6139.mjs
  counts moved: `SC_RELEASE_FETCH` 7 -> **8** (the due-drop resolver is a new catalog read), `freshTitles.add(` 2 -> **3**
  (the catalog pass records its own title+day), and the junk-test needle became the forEach form
  `if(window.__scJunkTitle(r.collectionName)) return;`.
- **`dev/test-723.mjs` - 87 checks**, sections [1] release metadata [2] the catalog is read on its own, and a one-track
  release is kept [3] the check reaches a second storefront [4] a landed drop is handed its track [5] a song in the
  library is in All Songs [6] what did not move [7] the repin moved every gate [8] inline script syntax.
- **OTA at a TRUE byte-identical fixed point: 865246 (`ota/`) / 865254 (`ota-play/`).** The `size` field was in a
  one-byte two-cycle (865245 <-> 865246) for this content, so the patch appends **three** trailing newlines after
  `</html>` (invisible to the page, rides in the OTA bundle only) - `sub(html, 'a trailing newline moves the bundle off
  its one-byte two-cycle', '</html>\n', '</html>\n\n\n', { key: '</html>\n\n\n' })`. Two generations verified byte-identical
  across 8 artifacts (`/tmp/gen723.md5`). Both bundle `--check`s OK (6 notes each).
- **Gate set all green**: test-723 **87** (new), test-722 79, test-721 54, test-720 66, test-719 70, test-718 46,
  test-717 94, test-716 83, test-715 72, test-714 137, test-713 50, test-70 182, test-662 75, test-6643 90, test-6642 75,
  test-66421 49, test-66422 87, test-66423 52, test-66424 102, test-66425 101, test-66426 86, test-66427 82,
  test-66429 83, test-66431 95, test-play-copy 28, test-612, test-6136, test-6137, test-6138, test-6139, test-651,
  test-6641 128, **studio-70-check.cjs 390**, check-dom 0 failures, ota-guard 20/0, ota-update 52/0, ota-loop 26/0.
- **Pre-existing reds, NOT in the gate set, unchanged**: test-705.mjs 223/7, batch-635-check.cjs 35/7, test-6058.mjs
  47/1, test-66428.mjs 72/1 (its page-wide bullet canary expects 46 `•` markers; the page has held 48 since at least 72.0).
- **STILL OPEN / NOT DONE in 72.3** (the owner's later, longer report - converter + Spotify metadata + wrong-song
  matches + album artist - was NOT fully addressed; only the All Songs persistence bug was). The converter/source-matching
  work lives in `scArtistMatch` / `scTitleMatch` / `scSourceClaimsSibling` / `scSpToBuffer` / `scRunBatchConvert` /
  `scConvertOneTrack` (~:38024-39209) and the Spotify lookup paths - none of it was changed here.
- **NEXT RELEASE: 72.4** - `dev/patch-724.mjs` + `repin-724.mjs` + `test-724.mjs`; add `test-723.mjs` to `PREV_MOVES`
  (OLDVER `72.3`); KEEP the derived cache name; the trailing-newline OTA trick may need re-tuning if the size two-cycles
  again; update this file.

## 72.2 (Oct 2, 2026): Studio runs the whole batch, and one tap cleans up a song
- **The owner's words**: "Next release: Everything". This is the **Studio half** of that: the three Studio upgrades that
  were offered and never picked between, ALL of them, because the machinery was already there. (The MediaSession half
  needed nothing - `registerMediaSessionHandlers` already registers play / pause / previoustrack / nexttrack /
  seekbackward / seekforward / stop / seekto on BOTH sessions via `mediaSetActionHandler`, so Wear and the lock screen
  already get the full button set; and the native Android Auto bridge stays parked - `android/` is generated only in CI,
  `node_modules/` is not installed here, and a hand-written native patch's first test is the next APK build.)
- **1. ONE TAP CLEANS A SONG.** New `cleanUpSong()` (`dev/patch-722.mjs`) - the rack's two safest operations with the
  knobs already set: trim the silence off both ends + match the level, at 192 kbps, saved as its own `(clean)` tagged
  file. New `toolCard('cleanup', '\u2728', 'Clean up this song', ...)` in the `sc-tools` row and
  `if(id === 'cleanup') return cleanUpSong();` in `openTool`.
- **2. THE RACK RUNS OVER A SELECTION (batch edit) and 3. A BATCH RE-ENCODE.** ONE run object `batchRun`
  (`{ mode, busy, i, n, fails, saved, log }`), ONE `runBatch(mode)` loop, ONE progress line (`batchProgressHtml()`,
  ids `scBatchLine` / `scBatchDone`). A song that throws is pushed to `batchRun.fails` and the run carries on, so one bad
  file cannot strand the selection. New Studio section **"Batch on selected"** with `data-act="batchreen"` and
  `data-act="batchedit"` (wired in `wireStudio`) and a second set of `data-reenk` bitrate chips.
- **THE RENDER IS REUSED WITHOUT BEING REWRITTEN - THE KEY TRICK.** `editRender(buf)` reads the single `edit` object and
  is otherwise pure sample math. Threading a config parameter through it would rewrite the whole body AND break
  `test-714`, which pins `count(studio, 'function editRender(buf){') === 1` and each `edit.<field>` reference. Instead new
  `editRenderWith(buf, cfg)` (`EDIT_KEYS = ['silent','fades','fadeIn','fadeOut','reverse','normalize','gainDb']`) swaps
  those seven fields on `edit` for the length of a **synchronous** render and puts them back in a `finally`. There is no
  await inside the render, so the swap cannot be observed and the user's rack is never left changed.
- **ONE COPY-SAVE PATH.** New `editedCopy(t, cfg, kbps, purpose)` = decode -> `editRenderWith(b, cfg)` -> `tagMetaFor` ->
  `window.__scEncodeMp3` -> `window.__scSaveClip(blob, name + ' (' + purpose + ').mp3')`. It **never** calls
  `__scPersistTrack`, so no path here overwrites a library file. `cleanUpSong` uses purpose `'clean'`, the batch uses
  `'edit'`. `editExport` (the rack's own save) is left exactly as it was.
- **THE RE-ENCODE IS SPLIT, NOT DUPLICATED.** `reencodeOne(t, kbps)` holds the decode/tag/encode/swap core and resolves
  with the bytes won back; it says nothing itself. `reencodeTrack(id, kbps, btn)` is now a thin wrapper that keeps its
  own `Encoding\u2026` button state and `toastWithUndo(..., undoReencode(id))`. The batch calls the same `reencodeOne`, so
  a batch re-encode and a single one cannot drift. (`dev/studio-70-check.cjs` still drives `SC70.reencodeTrack`.)
- **`dev/patch-722.mjs` - 9 edits**, applied and self-verified. It adds a `subRange()` helper for the one rewrite too
  long to quote byte-for-byte (the re-encode function), anchored on `function reencodeTrack(id, kbps, btn){` ->
  `\n  function undoReencode(id){`. **`dev/repin-722.mjs` - 52 edits / 30 files**, `--check` proves no stale pin survives,
  `PREV_MOVES` adds `test-721.mjs`, plus TWO bespoke moves: **(F1)** test-721 gets the `const OWN = '72.1'` split (it read
  the HEAD for `/refetch/` and `/album/ && /single/` - the same lesson test-718/719/720 already learned); **(F2)**
  `studio-70-check.cjs` moves **nine tool cards -> ten** and names `cleanup`.
- **`dev/test-722.mjs` - 79 checks**, sections [1] release metadata [2] one tap cleans up a song [3] the batch - one run,
  one progress line, both workers [4] the render is reused without being rewritten [5] the re-encode is callable, and the
  button still is [6] what did not move [7] the repin moved every gate [8] inline script syntax.
- **OTA BUNDLE AT A TRUE FIXED POINT**: **862755** (`ota/`) / **862764** (`ota-play/`). `dev/ota-fixpoint.mjs` settles in
  3 passes (862791 -> 862756 -> 862755 -> fixed), and a SECOND generation is byte-identical. Both `ota-bundle.mjs --check`
  and `ota-bundle-play.mjs --check` OK (6 notes each).
- **Verified on the finished tree**: `test-722` **79** (new), `test-721` 54, `test-720` 66, `test-719` 70, `test-718` 46,
  `test-717` 94, `test-716` 83, `test-715` 72, `test-714` 137, `test-713` 50, `test-70` 182, `test-662` 75,
  `test-6643` 90, `test-66429` 83, `test-66431` 95, `test-play-copy` 28, `studio-70-check.cjs` **390**, `check-dom` DOM
  INTEGRITY FAILURES 0, ota-guard 20/0, ota-update 52/0, ota-loop 26/0.
- **Pre-existing reds, unchanged and NOT in the gate set**: `test-705` 223/7, `batch-635-check` 35/7, `test-6058` 47/1,
  and **`test-66428` 72/1** (its page-wide bullet canary expects **46**, but the page has held **48** since at least 72.0 -
  verified identical at `HEAD~1` and `HEAD`; it is NOT caused by this release and was left untouched).
- **NEXT RELEASE**: `72.3` (the third number stops at nine). Shell cache `sidecut-shell-v72.2` -> `sidecut-shell-v72.3`
  (still derived in `dev/patch-72x.mjs` and the sweep). Add `test-722.mjs` to `PREV_MOVES`.

## 72.1 (Oct 1, 2026): a refetch keeps the albums and singles you removed
- **The owner's words**: "Refetching albums or singles shouldnt refetch every single or album that was deleted too". A removed
  album or single is kept out of the Discover lists by the removed list (`sidecut_hiddenAlbums` / `sidecut_hiddenSingles`, a
  collectionId or trackId plus a `t:<normalized title>` marker) and by the caches pruned when it was removed. A refetch has
  to honour BOTH, and it did not everywhere - four entry points could put a removed row back.
- **1. SINGLES HAD A PUT-THEM-ALL-BACK CHIP.** The per-artist header carried a red chip (class `dp-si-deep-refetch`, title
  "Refetch ALL singles (including removed)") wired to `__singlesDeepRefreshArtistGroup()`, which was the ordinary refresh
  with `__scFetchArtistSingles(name, {includeHidden: true})` - the one call that asked `fetchArtistSingles` to drop its
  filter (`var skipHidden = !opts.includeHidden`). It even warned "Previously removed songs will reappear". `skipHidden`
  is now **`true` unconditionally** and the chip is **out of the render markup** (both render sites, ~`:32013` and
  `:41582`). The click handler and `__singlesDeepRefreshArtistGroup` are left in place on purpose: a saved popup from an
  older build can still carry the chip, and letting it refresh is harmless now that the fetch always filters.
- **2. THE SAVED LIST WAS HANDED BACK UNCHECKED.** When a refresh cannot reach the catalog it keeps the group it already
  had (`keptArtistGroupsHTML` -> `cachedArtistGroups`, parsing `discPopupCache_` and re-inserting saved rows verbatim),
  so a snapshot written before a removal put the removed single straight back. `cachedArtistGroups` (~`:31908`) now drops
  every `.dp-ah-x[data-tid]` row that `isSingleHidden` matches, before the HTML is reused.
- **3. THE AI SOURCE NEVER ASKED.** Every catalog source filters (iTunes via `filterInto`, Deezer and MusicBrainz each
  call `isAlbumHidden`) - except the Gemini merge in `__refetchAlbums`, which pushed its albums with no check at all.
  It now does `if(isAlbumHidden(_aiCid, _aiA.title)) continue;` (~`:31589`), checked by title too because the store id an
  album was removed under is not the `ai_...` id this path invents.
- **4. THE PER-ARTIST ALBUM REFETCH SEEDED FROM AN UNFILTERED CACHE.** `__refetchArtistAlbums` loaded `sidecut_ahArtistData`
  into `artistAlbums` whole (`~:31027`) and saved it back whole (`~:31218`), so a removed album still in that cache was
  re-rendered AND re-saved. The seed is filtered against `sidecut_hiddenAlbums` now, the same way `__refetchAlbums`
  already filtered its own (`~:31316`).
- **`dev/patch-721.mjs` - 9 edits**, applied and self-verified; **`dev/repin-721.mjs` - 46 edits / 27 files**, `--check`
  proves no stale pin survives. The sweep adds `test-720.mjs` to `PREV_MOVES`; no bespoke series step (test-70 already
  names `^72`).
- **THE OWN SPLIT REACHED A THIRD AND FOURTH GATE.** test-719 and test-720 read `entries[0]` (the HEAD) for their own
  theme checks (`/album/ && /playlist/`, and test-720's `/artist/`). That only ever passed because 71.9 and 72.0 happen to
  share the words album and playlist - 72.1 does not carry "playlist", so both failed the moment the head moved. Both got
  the `const OWN = '...'` split (like test-718 before them): the theme checks now read `entries.find(v === OWN)`.
- **`dev/test-721.mjs` - 54 checks**, sections [1] release metadata [2] the singles fetch always filters the removed list
  [3] a saved list cannot hand a removed row back [4] every album source asks the removed list, including the AI one
  [5] what did not move [6] the repin moved every gate (no stale pin) [7] inline script syntax.
- **OTA BUNDLE AT A TRUE FIXED POINT**: **860630** (`ota/`) / **860638** (`ota-play/`). `dev/ota-fixpoint.mjs` settles in
  3 passes (860699 -> 860631 -> 860630 -> fixed), and a SECOND generation is **byte-identical across all 7 artifacts**
  (`md5sum -c` against `/tmp/gen721.md5`). Both `ota-bundle.mjs --check` and `ota-bundle-play.mjs --check` OK (6 notes
  each). (72.0 had NO fixed point; 72.1's content does - check convergence every release.)
- **Verified on the finished tree**: `test-721` **54** (new), `test-720` 66, `test-719` 70, `test-718` 46, `test-717` 94,
  `test-716` 83, `test-715` 72, `test-714` 137, `test-713` 50, `test-70` 182, `test-662` 75, `test-6643` 90,
  `test-66429` 83, `test-66431` 95, `test-play-copy` 28, `studio-70-check.cjs` 389, `check-dom` DOM INTEGRITY FAILURES 0,
  ota-guard 20/0, ota-update 52/0. **Pre-existing reds, unchanged and NOT in the gate set**: `test-705` 223/7,
  `batch-635-check` 35/7, `test-6058` 47/1.
- **NEXT RELEASE**: `72.2` (the third number stops at nine). Shell cache `sidecut-shell-v72.1` -> `sidecut-shell-v72.2`
  (still derived in `dev/patch-72x.mjs` and the sweep). Add `test-721.mjs` to `PREV_MOVES`.

## 72.0 (Oct 1, 2026): an album knows who it is by, and an import can never drop a playlist
- **The owner's words**: "something from before importing albums deleted my existing playlists" and "all the albums say
  unknown artist when you import them", then "make sure stuff like this never happens ever again". Three asks, one
  release: an album that reads the artist it is actually by, an import that cannot lose a playlist, and neither of those
  regressing again.
- **WHY EVERY IMPORTED ALBUM SAID UNKNOWN ARTIST.** An album `.zip` made before 71.9 had no field to keep an album's
  artist - `exportAlbums()` handed `albumGroups` (album name -> array of ids) to `doExportTracks()`, so the file's only
  record of an album was a name and its ids. The import therefore SYNTHESIZED the album entry and stamped
  `artist: 'Unknown artist'` into it (~`index.html:24289`). That string is TRUTHY, so the album card's own fallback
  (`ua.artist || firstTrack.artist`) never ran and every album in the zip read Unknown artist.
- **ONE ANSWER TO "WHO IS THIS ALBUM BY".** New `scAlbumArtist(name)` (~`:22107`) - the entry's own artist when it is a
  real one, else the artist the album's OWN songs agree on (the most common, so a compilation with a stray guest credit
  still reads right), else the `album` TAG on the songs carrying this name, and `''` when nothing knows. It treats a
  stored literal `"Unknown artist"` as "nothing", so that string can never win again. Everything that shows an album
  artist asks here; `window.__scAlbumArtist` is the hook the gates drive.
- **AND THE ANSWER IS WRITTEN BACK, SO OLD LIBRARIES HEAL THEMSELVES.** New `scHealAlbumArtists()` (~`:22149`) fills the
  real artist into every album entry that carries none or the literal, writing the `userAlbums` row and NOTHING else (at
  boot it runs before the stored playlists are read back, so persisting playlists from there would write the empty
  placeholder over them). It runs at boot (`~:17654`) AND right after an import (`~:24882`), so a library that already
  came through an album zip is repaired by the update itself with no re-import. The import no longer stamps the literal
  (`_albFromZip[n] = { artist: '', ... }`, ~`:24289`), and `exportAlbums()` writes the artist it found so a zip made after
  this release carries the real name from the first tap.
- **AN IMPORT MUST NOT BE ABLE TO DROP A PLAYLIST.** The playlist side has always merged additively
  (`if(!playlists[name]) playlists[name] = []; ... push`) and there is exactly ONE `delete playlists[` in the app - the
  71.9 bin, behind its own confirmation. What was NOT guaranteed is that the merged result is WRITTEN: `saveMeta()`
  writes nothing about playlists while the Library is on Albums (so the album paths cannot touch them), and "Restore from
  my backup" is offered from the ALBUMS side - album mode. So the import now writes the row itself, next to the merge
  (`dbPut('meta', { key: 'playlists', value: playlists })`, ~`:24496`), instead of leaving it to a function whose whole job
  is to refuse it in that mode.
- **`dev/patch-720.mjs` - 9 edits**, applied and self-verified (`APP_VERSION 72.0`, `CACHE_NAME sidecut-shell-v72.0`);
  **`dev/repin-720.mjs` - 44 edits / 27 files**, `--check` proves no stale pin survives. The sweep adds `test-719.mjs` to
  `PREV_MOVES` and skips nothing new (`KEEPS_ITS_VERSION` is still `test-705.mjs`, `test-70.mjs`).
- **`dev/test-720.mjs` - 66 checks**, sections [1] release metadata [2] the album-artist lookup, run for real [3] the
  import stops making an artist up [4] the repair passes (boot + after an album restore) [5] an import can never drop a
  playlist [6] what did not move [7] the repin moved every gate (no stale pin) [8] inline script syntax.
- **THE OTA BUNDLE HAS NO FIXED POINT FOR THIS CONTENT - the 70.1.5 / 70.1.7 caveat applies.** `dev/ota-fixpoint.mjs`
  oscillates **859746 <-> 859747** and exits 1 after eight passes (probed 859740..859760: no seed builds itself - the zip
  size barely moves with the seed and never lands on it). The shipped state is the accepted shape: `ota/update.zip`
  **859746** (the real size), and `ota/updates.json` + `ota/manifest.json` + `updates.json` **859746** (what a client
  actually fetches); root `manifest.json` **859747** (the seed it was built with - a 1-byte lie in a field nothing
  verifies, exactly like the manifest baked inside the zip); `ota-play/update.zip` + `ota-play/updates.json` **859754**.
  Two consecutive `ota-bundle.mjs` / `ota-bundle-play.mjs` runs are **byte-identical across all seven files**
  (`md5sum -c`), and both `--check`s pass (6 notes each) - which is what `deploy.yml`'s `git diff --quiet` and
  `ota-update-check.cjs`'s "a second generation produces the same bytes" actually require. **Check convergence every
  release instead of assuming either answer.**
- **Verified on the finished tree**: `test-720` **66** (new), `test-719` 70, `test-718` 46, `test-717` 94, `test-716` 83,
  `test-715` 72, `test-714` 137, `test-713` 50, `test-70` 182, `test-662` 75, `test-6643` 90, `test-66431` 95,
  `test-play-copy` 28, `check-dom` DOM INTEGRITY FAILURES 0, `studio-70-check.cjs` 389, ota-guard 20/0, ota-update 52/0.
  **Pre-existing reds, unchanged and NOT in the gate set**: `test-705` 223/7, `batch-635-check` 35/7, `test-6058` 47/1.
- **NEXT RELEASE**: `72.1` (the third number stops at nine). Shell cache `sidecut-shell-v72.0` -> `sidecut-shell-v72.1`
  (still derived in `dev/patch-72x.mjs` and the sweep). Add `test-720.mjs` to `PREV_MOVES`.

## 71.9 (Oct 1, 2026): an album export carries albums, and a playlist can be deleted
- **The owner's words**: "Whenever I import my zip for albums it imports it as playlists in library it not supposed do that
  obviously and add a delete playlist function in library". Two asks, one release: an album export that imports as albums, and
  a delete next to a playlist in the Library.
- **WHY ALBUMS CAME BACK AS PLAYLISTS.** `exportAlbums()` (~`index.html:22782`) built `albumGroups` - album name -> ARRAY
  OF IDS - and handed it to `doExportTracks(...)` in the **`manifestPlaylists`** slot (~`:22796`), even though the confirm
  text it had just shown said "No playlists are included". `doExportTracks` (~`:22843`) wrote that straight into
  `manifest: { playlists: manifestPlaylists || {}, ... }` (~`:22967`), so the zip declared a PLAYLIST per album. Importing
  merged `manifest.playlists` into the Library's playlists (~`:24368`), which is the bug, verbatim. An album export now passes
  `undefined` in the playlist slot and its album map as a NEW fifth parameter, writes `settings.userAlbums` +
  `settings.albumOrder`, sets `manifest.kind = 'albums'`, and writes `playlists: {}`.
- **THE ZIPS PEOPLE ALREADY HAVE STILL HAVE TO WORK.** Fixing only the export would leave every zip made before this
  release importing as playlists - for the owner that zip is the only copy of those albums. So the import recognizes an
  albums zip by the marker **AND** by the older zips, which say it only in their file name (`sidecut-albums.zip`):
  `const _isAlbumsZip = (manifest.kind === 'albums') || (!manifest.settings && /^sidecut-albums/i.test(file.name))`
  (~`:24184`). An older one has no `settings.userAlbums`, so the block just below synthesises one from its
  `manifest.playlists` (skipping `All Songs`/`Favorites`/`Unsorted`), and the playlist-merge loop is guarded with
  `if(!_isAlbumsZip)` (~`:24368`) - the DOUBLE READ was the bug, so an album zip must not be read as albums AND playlists.
- **THE CARD ORDER RIDES ALONG.** `userAlbums`' key order cannot hold a name like "2003" in place, so the export writes an
  explicit `albumOrder`, and the full backup carries it too (~`:23997`). The import's order restore now prefers the
  backup's list (`var _bkOrder = manifest.settings.albumOrder`, ~`:24783`) and pushes the local row after it, instead of the
  local row winning - an album's position is the half of "my albums are back" a list of names cannot show.
- **DELETE A PLAYLIST, FROM THE LIBRARY.** New `modalConfirm(title, message, okLabel)` (~`:22731`) - `confirm()` and
  `prompt()` are unreliable in the Android WebView (the app already carries its own prompt for that reason), so anything
  destructive asks in-app; its backdrop is `zIndex '250'` so it sits above a Discover popup (`.disc-popup-overlay` is 70).
  New **one** delete path `async function deletePlaylist(name)` (~`:22764`): refuses `All Songs`, `Favorites` and the virtual
  `UNSORTED_VIEW` with a toast; counts the songs for the confirmation; deletes the name and clears every per-playlist row
  it left behind (`hiddenPlaylists`, `djDisabledPlaylists`, `perPlaylistSort`, each with its own `dbPut`); moves
  `activePlaylist` to `All Songs` (+ `rememberPlaylist`) if it was open; then `saveMeta(); renderManagePlaylistsList();
  renderTabs(); renderList();`. `deleteActivePlaylist()` (the old menu action, ~`:22707`) is now a THIN WRAPPER over it, so
  there is one path. `renderManagePlaylistsList` (~`:19225`) gained a coral trash `delBtn` beside the rename pencil for
  every name except `All Songs` and `Favorites` (the `if(name !== 'All Songs')` block already excludes All Songs).
- **`dev/patch-719.mjs` - 13 edits**, applied and self-verified; **`dev/repin-719.mjs` - 41 edits / 26 files**, `--check`
  reports 0 and PROVES no stale pin survives. Three fixes now in the sweep's lineage: `PREV_MOVES` adds test-718, and
  `test-718.mjs` got the `const OWN` split (it reads the head for two checks that are about 71.8's own notes) - the same
  OWN-by-version lesson 71.7 and 71.8 recorded, now applied to a third gate. A repin sweep that reads a gate's file from
  disk during `--check` sees PRE-sweep text (nothing written yet), so `repin-719.mjs` keeps an in-memory `swept` map and
  runs the bespoke step against `swept.get(name)`.
- **`dev/test-719.mjs` - 70 checks**, sections [1] release metadata [2] an album export carries albums, never playlists
  [3] the import reads an album zip as albums [4] one delete path, and the bin in Manage playlists [5] what did not move
  [6] the repin moved every gate [7] inline script syntax. **A `confirm()` assertion must name the exact string**: the
  first draft asserted no `if(!confirm(` anywhere and failed on the unrelated delete-songs confirm (~`:22467`).
- **OTA BUNDLE AT A TRUE FIXED POINT**: **857313** (`ota/`) / **857320** (`ota-play/`). `dev/ota-fixpoint.mjs` settles in
  3 passes (854360 -> 857140 -> 857313 -> fixed), and a SECOND generation is **byte-identical across all 8 artifacts**
  (`md5sum -c` against `/tmp/gen719.md5`). Both `ota-bundle.mjs --check` and `ota-bundle-play.mjs --check` OK (6 notes each).
- **Verified on the finished tree**: `test-719` **70** (new), `test-718` 46, `test-717` 94, studio-70-check **367**,
  `test-716` 83, `test-715` 72, `test-714` 137, `test-713` 50, `test-70` 182, `test-662` 75, `test-663` 49, `test-6641` 128,
  `test-6642` 75, `test-66421` 49, `test-6643` 90, `test-66431` 95, `test-66429` 83, `test-6056` 48/0, `test-619` 55,
  `test-widget-anim`, `test-widget-dim`, `test-play-copy` 28, album-rename-check 40/0, albums-manual-check 40/0,
  `check-dom` DOM INTEGRITY FAILURES 0, ota-guard 20/0, ota-bootapply 24/0, ota-update 52/0, ota-loop 26/0.
  **Pre-existing reds, unchanged and NOT in the gate set**: `test-705` 223/7, `batch-635-check` 35/7, `test-6058` 47/1.
- **NEXT RELEASE**: the third number stops at nine, so `71.9` is the last in this line and the next is **72.0** - the shell
  cache becomes `sidecut-shell-v72.0` (still derived in the patch and the sweep). Add `test-719` to `PREV_MOVES`.

## 71.8 (Oct 1, 2026): the shell cache is named after the release
- **The owner's words**: "The cache should be whatever the patch notes number is" and "Every release bumps it". `sw.js`
  `CACHE_NAME` is now **`sidecut-shell-v71.8`** - the release number itself, DERIVED in the patch (`const CACHE =
  'sidecut-shell-v' + VERSION`) and in the sweep (`const NEWCACHE = 'sidecut-shell-v' + NEWVER`), so the two cannot drift
  apart again.
- **THIS REVERSES 63.1.4 ON PURPOSE.** `dev/patch-623.mjs` decoupled the cache name from `APP_VERSION`, and every gate
  written since asserts the OLD rule ("carries none of the app version"). The reason was real: the FIRST scheme built the
  name out of the version's leading line (`sidecut-shell-v70.0`), so two releases in one line SHARED a cache name and the
  later one was served the earlier one's shell. One name per RELEASE cannot do that - `APP_VERSION` moves every release.
  The old rule is kept in `## sw.js cache name` below as history; it is no longer the contract.
- **AN INVARIANT FLIP IS A GATE SWEEP, NOT A FILE EDIT.** ~20 gates asserted the old rule across `dev/test-*.mjs` and
  `dev/ota-update-check.cjs`. All of them are moved by **`dev/repin-718.mjs` (step F)**: one regex rewrites
  `ok(<cache>.indexOf(<ver>) === -1, 'and carries none of the app version')` into
  `ok(<cache> === 'sidecut-shell-v' + <ver>, 'the shell cache is the release number')`, and the sweep then PROVES no gate
  anywhere still carries the old strings. A half-moved rule would otherwise fail one file at a time, in gates nobody ran.
  Three shapes needed bespoke handling: `test-705.mjs` and `test-70.mjs`, whose `const VER` names the release they
  DESCRIBE (70.0.5 / 70.0) rather than the app now, and `test-6643.mjs` / `test-66431.mjs`, which keep the app version in
  `PAGEVER` (fixed by a PAGEVER post-pass). **`test-718.mjs` is excluded from the sweep's stale check** because it NAMES
  the old rule on purpose - it is the gate that proves the rule moved.
- **THE HEAD IS ANOTHER RELEASE NOW, AND TWO GATES READ IT BY ACCIDENT.** `test-716.mjs` and `test-717.mjs` asserted
  things about THEIR release against `entries[0]`; that only worked while they were the head. Both got the `const OWN`
  split `dev/test-715.mjs` already uses (release-specific checks read the OWN entry by version, everything about the
  changelog itself still reads the head) - `repin-718.mjs` step F3. **Lesson: a gate that describes release X must read X
  BY VERSION.** Also watch a new gate's own text against the sweep: `test-718.mjs` first carried the old cache literal and
  step E rewrote it, which is why its repin assertions are regexes now.
- **`dev/patch-718.mjs` is only three edits** (`APP_VERSION` 71.7 -> 71.8, the 7-note head entry, the `sw.js` cache). The
  release is a rule change, and the rule lives in the sweep.
- **THE OWNER'S OTHER REPORT WAS INVESTIGATED AND IS NOT A PUBLISHING BUG.** "I don't see an ota for the full [APK] on my
  phone": `ota/` IS the full/sideload channel, and it was live and current (v71.7, `update.zip` 854194, `manifest.json` +
  `SideCut-web.zip` present) on GitHub Pages and on `raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json`.
  The zip carries all six `OTA_FILES`, the right `APP_VERSION`, and NO `__PLAY_BUILD__` (the play zip carries one), and
  `apk-71.7-full` / `apk-71.7-release` both exist with assets. **One real latent defect found**: the ROOT `updates.json` /
  `manifest.json` (the pre-`ota/` locations, still published and still the `<link rel="manifest">` target) carry
  `url: "update.zip"`, which resolves to `https://anekthegreat.github.io/SideCut/update.zip` - a **404**. Nothing in the
  current app reads them (`index.html` and `dev/native-updates.js` both read `ota/` | `ota-play/`), so they were left
  alone; fix that before trusting any old build's update check.
- **OTA BUNDLE AT A TRUE FIXED POINT**: **854360** (`ota/`) / **854369** (`ota-play/`). `dev/ota-fixpoint.mjs` settles in
  3 passes (854194 -> 854530 -> 854360 -> fixed), and a SECOND generation is **byte-identical across all 8 artifacts**
  (`md5sum -c` against `/tmp/gen718.md5`). Both `ota-bundle.mjs --check` and `ota-bundle-play.mjs --check` OK (6 notes each).
- **Verified on the finished tree**: `test-718` **46** (new), `test-717` 94, studio-70-check **367**, `test-716` 83,
  `test-715` 72, `test-714` 137, `test-713` 50, `test-70` 182, `test-662` 75, `test-663` 49, `test-6641` 128,
  `test-6642` 75, `test-66421` 49, `test-6643` 90, `test-66431` 95, `test-66429` 83, `test-6056` 48/0, `test-619` 55,
  `test-widget-anim`, `test-widget-dim`, `test-play-copy` 28, album-rename-check 40/0, albums-manual-check 40/0,
  `check-dom` DOM INTEGRITY FAILURES 0, ota-guard 20/0, ota-bootapply 24/0, ota-update 52/0, ota-loop 26/0.
  **Pre-existing reds, unchanged and NOT in the gate set**: `test-705` 223/7, `batch-635-check` 35/7, `test-6058` 47/1.

## 71.7 (Oct 1, 2026): the rebuild shows what it would make, one tap undoes it, and the backup has the real albums
- **The owner's words, after 71.6**: "I'm missing mad albums and you made every single damn song be an album of it's own fix it
  and I need my songs in the correct order in albums and I'm missing songs inside of albums". **71.6's rebuild ran on one
  tap and took EVERY album tag** - and on a library whose files carry one album tag per song (what a converter writes into
  the album field), that is one album per song. The grouping the owner actually had (the old card-drag auto-save, anything
  hand-made) is **not derivable from a tag at all**, which is why albums were still missing and the ones that came back
  were short. Lesson: a recovery that guesses must say what it is about to do, and must be undoable.
- **1. THE SHEET (`rebuildAlbumsFromTagsPrompt()`, `#albRebuildSheet`).** `scAlbumRebuildPlan()` counts the tags first
  (`tags`, `counts`, `multi`, `single`), and the sheet shows those counts before anything is made. `rebuildAlbumsFromTags(mode)`
  takes **'multi' | 'all'**: the primary button is the tags shared by more than one song ("Rebuild the 2 albums"), the second
  is every tag ("Rebuild all 6 tags"), and with no shared tag at all it **refuses** ("a rebuild would make one album per
  song") and points at a backup. `plan.counts[t] > 1` is checked BEFORE `scAlbumUndoArm()`, so a bad rebuild cannot even
  start. zIndex `250` on the sheet - above `.disc-popup-overlay` (70), because Manage albums opens from a Discover popup.
- **2. THE UNDO.** `scAlbumUndoArm()` copies `{ at, albums, order }` into **`localStorage 'sidecut_albumsUndo'`** before the
  first album is made (localStorage because it must be synchronous to keep the rebuild sync, and it is a short-lived undo
  POINT, not library data). **The FIRST snapshot is the one kept** (`if(localStorage.getItem(KEY)) return false`), so
  rebuilding twice cannot bury the good state under a bad one - which is exactly what the owner had done. `undoAlbumRebuild()`
  restores both rows, `scAlbumsMarkOurs()`es them (or the next sweep takes what was just restored), spends the point, and
  re-renders. `#mgrAlbumUndo` is rendered **only while a point exists**, so it is never a dead button.
- **3. THE BACKUP IS OFFERED FIRST-CLASS.** `scOpenBackupImport()` clicks `#importLibInput` (the SAME importer Settings
  uses - one path, one set of rules), and it is a button in **both** places: `#mgrAlbumRestore` in Manage albums and
  `#albRestoreBtn` under the empty Albums screen. The copy says which of the two is the real album list, because a tag can
  never reconstruct names, membership and order.
- **4. THE ORDER THE BACKUP BRINGS NOW WINS.** The import used to keep the local `albumOrder` unless the device had none,
  so importing over a library that had an order (or had just been tag-rebuilt) left the albums in the OLD arrangement. Now
  it merges the backup's order first and appends local-only names (`_mergedOrder`) and writes it back. This is the half of
  "my albums are back" that a list of names cannot show.
- **5. A SONG THE ID REMAP MISSED IS NOT DROPPED ("missing songs inside of albums").** The import's remap is keyed on
  name + artist + **DURATION**; a cleaned title or a duration one side lacks makes it miss, and a miss deleted that song
  from its album while the song sat in the library. New **top-level** `scAlbumFindByTitle(name, artist)` / `scAlbumLooseNorm`
  give it a third chance: the name the backup recorded, artist first then title alone. **Top-level on purpose** - the gate
  drives it, and a helper that only exists after an import has run is a helper nobody can test. (An earlier draft declared
  it inside `importLibrary`; `window.__scAlbumFindByTitle` was then missing at boot and the jsdom case caught it.)
- **PATCH EMITTING LESSON - BACKSLASHES.** `sub()`'s strings are TEMPLATE LITERALS: to land a `\s+` in index.html the patch
  source needs `\\s` (two backslashes), not four. Verify with `awk 'NR==<line>' index.html | od -c`, not with `grep -c` -
  the tool's JSON escaping doubles what you see in the output and cost a full detour. **Never use a backtick inside an
  emitted string or comment**: an earlier edit put `` ` `` in a comment and broke the whole patch file's parse.
- **GATES THAT DESCRIBE THEIR OWN RELEASE.** 71.7 legitimately changed 71.6's panel wiring and its tag collection, so
  `dev/test-716.mjs` was updated to follow the code (the tag counting moved into `scAlbumRebuildPlan()`; the two-tap arm
  became the sheet) while keeping its release-specific claims (the notes, the entry, the restore paths). `repin-717.mjs`
  added `['test-716.mjs', ['71.5', OLDVER]]` to `PREV_MOVES` - every gate that compares `entries[1]` moves.
- **`dev/patch-717.mjs` (14 edits) / `dev/repin-717.mjs` (33 edits / 23 files) / `dev/test-717.mjs` (94 checks)**: `APP_VERSION`
  **71.6 -> 71.7**, stamp `October 1, 2026 \u00b7 7:32 AM EDT`, shell cache **`v63.0.52 -> v63.0.53`**, a **7-note** head
  (six ride to Play, clean of the wider word list; note 7 past the cut; no apostrophes).
- **`dev/studio-70-check.cjs` 332 -> 362**: new **`[11q]`** builds the library that broke - four songs tagged `Record A`,
  four `Record B`, four tagged with their own name, plus one hand-made album - and drives it: the plan's 2/4 split, the
  sheet's counts and its Cancel, the default making exactly the two shared-tag albums (and **not** one per song), the songs
  already in another album staying put, `'all'` making all seven, the undo going back to the state before the **first**
  rebuild, the point being spent, and the refusal when every tag covers one song. `[11p]` now taps the sheet's primary
  button (the empty-screen button opens the sheet) and its note check follows the new copy.
- **OTA fixed point 850021 -> `854194` (play `854202`)**, byte-identical on a second generation (`md5sum -c`, eight
  artifacts), both bundles `--check` OK (6 notes each).
- **VERIFIED**: test-717 **94**, studio-70-check **362**, test-716 **83**, test-715 **72**, test-714 **137**, test-713 **50**,
  test-70 **182**, test-widget-anim **18**, test-widget-dim pass, test-662 75, test-663 49, test-6641 128, test-6642 75,
  test-66421 49, test-6643 90, test-66429 83, test-play-copy 28, test-6056 48, test-619 55, album-rename-check 40,
  albums-manual-check 40, check-dom DOM INTEGRITY FAILURES 0, ota-guard 20, ota-bootapply 24, ota-loop 26,
  ota-update 52, ota-bundle/-play `--check` OK. Pre-existing and unchanged: `test-705` **223/7**, `batch-635-check.cjs` 35/7,
  `test-6058.mjs` 47/1, check-dom's critical static ids 2/6.


## 71.6 (Oct 1, 2026): the albums come back from the tags on the songs, and a restored backup sticks
- **The user's words**: "Why did all of my albums disappear" - answered "Where: Library → Albums tab AND Manage albums",
  "Songs: All my songs are still there", "Toast: No / I don't remember", "Backup: Yes, I have an export .zip", and the
  line that settles it: **"It's purely because of the apk because on the play version my albums are still there"**.
- **THE CAUSE — 63.1.4's one-time cleanup running for the FIRST time, which is exactly what a freshly installed APK does.**
  Albums in this app used to be entries the app wrote for itself (the old card-drag auto-save, or a tag album materialised
  so a reorder had somewhere to live), marked `auto: true`. `removeAutoAlbums()` runs at **every** launch (index.html ~29132)
  and deletes every entry where `albumIsAuto(name)` = `e.auto === true && e.manual !== true`, then toasts "N album(s) the app
  had added on its own were removed — your songs and their album tags are untouched" (3s after boot, 7s long - missable).
  **Nothing in the current code writes `auto: true` any more**, so the only way a library still holds such entries is that
  it has never run the sweep: an APK older than 63.1.4. The changelog entry for 63.1.4 says it outright: *"Those entries are
  deleted on the first launch after this update, not hidden."* Songs, playlists and the album TAGS on the files were never
  touched - **only the entries** - and that is the whole reason this release can put them back. The `play` install kept its
  albums because it was still the old APK, so the sweep had never run there.
- **1. THE REBUILD (`rebuildAlbumsFromTags()`)** - one album per album tag on the songs, in the order the songs carry it.
  The tags are grouped off `allTracks` (`String(t.album||'').trim()`, empty skipped, each tag once), a tag that already has
  an album is `markAlbumManual()`-ed instead of duplicated, and a tag with none goes through **`ensureAlbumSaved(tag)`** -
  which is why the no-stealing rule and `manual: true` come for free. New names go on the END of `albumOrder` (never key
  order: a name like "2003" cannot hold a position), then both meta rows are written, `renderList()` and
  `refreshManageAlbums(true)` run, and the count is toasted. **It only ever ADDS**: it never deletes an album, never empties
  or splices a track list, and never calls `persistTrackMeta`/`buildTrackRecord`, so no song is renamed or re-tagged.
- **2. THE WAY BACK IS IN BOTH PLACES AN EMPTY SCREEN SHOWS.** `#albRebuildBtn` in the empty Albums tab (added in the
  `if(!ids.length)` branch of `renderList`, guarded by `if(libraryMode === 'albums')` so an empty playlist does not grow a
  button it has no business having), and `#mgrAlbumRebuild` in Manage albums. **The panel block (`var _rebuild`) is declared
  ONCE and used by both branches** - emitting it twice declares `_rebuild` twice - and it sits OUTSIDE the `.mgr-alb-row`
  rows on purpose, because the search box hides those by class and the way back must not vanish under a typed query. The
  panel button arms on the first tap ("Tap again to rebuild", 4s) exactly like Delete above it: **never `window.confirm()`
  in this panel** - the Android WebView can silently swallow it.
- **3. A RESTORE STICKS — `scAlbumsMarkOurs(albs)`** sets `manual = true` and `delete e.auto` on every entry. Without it the
  old marker rides in with the backup and the next launch's sweep deletes the album that was just restored - which is what
  *"an imported album keeps whatever marker it came with, and the next boot settles it"* (a comment in the .zip import)
  used to mean, and why restoring a backup looked like it had brought nothing back. It is now called on **all three paths
  that can bring an album in**: the .zip import merge (`userAlbums = _albMerged;`), `__scSnapHydrate` (`state.meta.userAlbums`,
  the "import everything" path), and `__scSnapRestore` (`snap.meta.userAlbums`, the on-device hydrate after a wipe) - each
  BEFORE it writes a single row.
- **THE SWEEP IS NOT LOOSENED, and must not be.** `albumIsAuto` still requires `auto === true && manual !== true` and
  `removeAutoAlbums()` still takes nothing else. The fix is the marker plus the way back, not a weaker cleanup; an entry the
  app made for itself is still the one that goes.
- **SCOPE LESSON (why `scAlbumsMarkOurs` is a top-level `function`).** The snapshot block (`(function(){ ... })()` at ~12074)
  and the album helpers (~21940) look like separate scopes but are both inside the ONE script block that starts at line 4984,
  so a hoisted function declaration in it is visible to both. **`dev/studio-70-check.cjs` [11p] proves it by DRIVING the
  hydrate and reading the row it wrote**, instead of trusting a source grep - the guard `typeof x === 'function'` would
  have failed silently here.
- **`dev/patch-716.mjs` (11 edits) / `dev/repin-716.mjs` (31 edits / 22 files) / `dev/test-716.mjs` (82 checks)**: `APP_VERSION`
  **71.5 -> 71.6**, stamp `October 1, 2026 \u00b7 6:59 AM EDT`, shell cache **`v63.0.51 -> v63.0.52`**, a **7-note** head
  (six ride to Play and are clean of the wider word list; note 7 is past the cut). Notes carry **no apostrophes** - they are
  emitted inside single quotes - and `test-716.mjs` pins that.
- **PATCH-KEY GOTCHA, ONE MORE TIME**: `scAlbumsMarkOurs(userAlbums);` is NOT usable as a `sub()` key because sub 1a puts
  that exact call inside `rebuildAlbumsFromTags()` earlier in the same run - the key would match text this run added, skip
  the sub silently, and `--check` would still look clean. The key is a fragment only that sub emits.
- **REPIN LESSON — A GATE'S CONTENT CHECKS MUST BE KEYED TO ITS OWN RELEASE.** `test-715.mjs` reads `entries[0]` for its
  head checks, and two of them are about what **71.5's** notes SAY (`/widget/`, `/heartbeat|bars/`). VER moves every release,
  so those two now look the 71.5 entry up by version through a new **`const OWN = '71.5'`** - deliberately not a
  `const VER`/`{ version: … }` shape, so the repin sweep leaves it alone. `PREV_MOVES` gained
  `['test-715.mjs', ['71.4', '71.5']]` alongside test-713 and test-714 (which moved 71.4 -> 71.5 in the same sweep).
- **OTA fixed point 847440 -> `850021` (play `850029`)**, verified byte-identical on a second generation (`md5sum -c` over
  all eight artifacts) with both `ota-bundle.mjs --check` and `ota-bundle-play.mjs --check` OK (6 notes each).
- **THE OWNER'S OWN RECOVERY, worth telling them**: their `play` install still had the album entries, so a fresh Export
  .zip from THAT install is the only copy of the original names/order/covers - and with this release that zip now imports
  and stays. `dev/album-rename-check.cjs` / `dev/albums-manual-check.cjs` / `dev/album-hold-check.cjs` are the album gates.
- **VERIFIED**: test-716 **82**, studio-70-check **332** ([11p] is the new case; `fakeIndexedDB(seedMeta)` and
  `boot(mode, seedMeta)` are the new plumbing), test-70 **182**, test-715 **72**, test-714 **137**, test-713 **50**,
  test-widget-anim **18**, test-widget-dim pass, test-662 75, test-663 49, test-6641 128, test-6642 75, test-66421 49,
  test-6643 90, test-66429 83, test-play-copy 28, test-6056 48, test-619 55, album-rename-check 40, albums-manual-check 40,
  check-dom DOM INTEGRITY FAILURES 0, ota-guard 20, ota-bootapply 24, ota-loop 26 (slow - give it the full 180s),
  ota-update 52, ota-bundle/-play `--check` OK. Pre-existing and unchanged: `test-705` **223/7**, `batch-635-check.cjs` 35/7,
  `test-6058.mjs` 47/1, check-dom's critical static ids 2/6.


## 71.5 (Sep 30, 2026): the widget heartbeat is slower, and a switch hides it for good
- **The user's words**: "This heartbeat is way too fast in the widgit and it's it necessary like is their a way to hide it
  like I don't see other widgits have it" (with a screenshot of the **SideCut Full** widget: cover art, `Ashke` /
  `Karan Aujla, Mxrci`, two little blue bars at mid-right, then prev / pause / next). Two asks: slow it, and let me hide it.
- **WHAT THE "HEARTBEAT" ACTUALLY IS — name it correctly, it is NOT the web heartbeat.** The bars beside the artist are
  the **playing equalizer of the ANDROID widget**: `wEqWrap` + `wEq1/wEq2/wEq3` in `LAYOUT_XML`, painted by
  `setAnimating()` ("Self-driving EQ animation") in **`.github/workflows/patch-widget.py`**, the Java that CI injects after
  `npx cap add android` - the web layer cannot draw them at all. **The `pulse` in the widget JSON is only the fallback**:
  `if (playing && animPhase >= 0) pulse = animPhase;` means the app's own 6s heartbeat stops driving the frame while that
  loop runs. **The screenshot shows TWO bars because `EQ_WAVE` phases 1 and 3 set bar 2 INVISIBLE** (bar1 + bar3 visible).
  Do not "fix" this in the 6000ms web heartbeat; that number is unrelated and was left alone.
- **1. SLOWER**: the loop repainted every **480ms**, which reads as a fast blink. `480L` is gone entirely - the frame is
  now `static final long EQ_FRAME_MS = 900L` and `sAnimH.postDelayed(this, EQ_FRAME_MS)`, i.e. one step a beat. Half the
  repaint cost while a song plays, as a side effect. `dev/test-widget-anim.mjs` fails on any surviving `480L`.
- **2. HIDEABLE — the switch is in Settings > Widget, not in the Android settings.** `#widgetBarsRow` +
  `#widgetBarsToggle` (a real checkbox inside its `<label>`, `accent-color:var(--gold)`) sits between `#widgetThemeGrid`
  and `#widgetCustomWrap`. The answer is `let widgetBarsOn = true` (default ON - it is what every existing place shows),
  stored at **`localStorage 'sidecut_widgetBars'` as `'1'`/`'0'`**, and applied by `setWidgetBars(on)`, which saves,
  re-renders the preview and **pushes the state on the spot** instead of waiting for the next beat.
- **HOW THE WIDGET HEARS IT — `eq` rides in the THEME object, so no new bridge call exists.**
  `getWidgetTheme()` (called from BOTH payload builders: `pushWidgetState` and the battery-saving dim) now stamps
  `_wt.eq = !!widgetBarsOn`. **It must be a real JSON boolean, not 1/0**: the native side reads it with
  `org.json`'s `optBoolean("eq", true)`, which understands `true`/`false` and silently returns the default for a number.
  Native: new `static boolean barsOn(Context ctx)`, `boolean bars = th.optBoolean("eq", true)` in `pushAll()` gating
  `if (playing && bars)`, the plugin's `setAnimating(ctx, playing && SideCutWidgetProvider.barsOn(ctx))`, and
  `if (sAnimCtx != null && !barsOn(sAnimCtx)) { setAnimating(sAnimCtx, false); return; }` inside the runnable so a switch
  flipped mid-song stops the loop instead of painting hidden frames. **Hidden = nothing drawn AND no loop, so it costs no
  battery at all** - which is the honest answer to the user's "is it necessary".
- **`dev/patch-715.mjs` (7 edits) / `dev/repin-715.mjs` / `dev/test-715.mjs` (72 checks)**: `APP_VERSION` **71.4 -> 71.5**,
  stamp `September 30, 2026 \u00b7 10:15 PM EDT`, shell cache **`v63.0.50 -> v63.0.51`**, a **7-note** head (six ride to
  Play, all clean of the wider word list; note 7 is past the cut because `test-714.mjs` still pins that a note exists
  there and that the first six never say Stripe).
- **REPIN STEP D, SECOND LESSON — THE ADJACENCY PINS COME IN PAIRS.** `test-713.mjs` and `test-714.mjs` BOTH still read
  `const PREV = '71.3'` after the last repin (both compare `entries[1]` to the head build), so both had to move to `'71.4'`
  and `test-713.mjs` was red until they did. **The next repin must add `['test-715.mjs', ['71.4', OLDVER]]`** for the same
  reason. Only gates shaped that way are listed - `test-70.mjs` finds its own entry by version and never moves.
- **`dev/studio-70-check.cjs` 296 -> 310 checks.** New **`[11o]`** boots the sideloaded copy and DRIVES the switch: the
  row exists, defaults to on, tapping it pushes **exactly one** theme whose `eq === false`, stores `'0'`, drops the bars
  from `#widgetThemePreview`, and turning it back on sends `eq === true` and draws them again. `fakeCapacitor()` gained a
  recording **`SideCutWidget.update`** that collects every theme payload (`widgetThemePushes`) - that is how the web half of
  a NATIVE feature becomes assertable without a device.
- **WHAT THIS RELEASE CANNOT PROVE IN THE SANDBOX**: the bars are drawn by the Android widget, so the 900ms beat and the
  hidden state have to be seen **on a device** - and only in an APK built **after** this commit, because `patch-widget.py`
  runs in the Android CI job, not at web runtime. An OTA update alone does not change the widget.
- **OTA fixed point 846207 -> `847440` (play `847448`)**, verified byte-identical on a second generation (`md5sum` over all
  eight artifacts) and with `ota-play/updates.json` carrying exactly the head's first six notes.
- **Stamp arithmetic**: `date -u` = `2026-10-01 02:15 UTC` -> Eastern is UTC-4 **with the date rolling back**, so
  `September 30, 2026 \u00b7 10:15 PM EDT`.
- **Android flavors**, for the screenshot: **`full` = `com.SideCut.myapp.full`, labelled "SideCut Full"** - the widget in the
  picture - and `play` = `com.SideCut.myapp` (the Play listing, which must never change its id).
- **VERIFIED**: test-715 **72**, studio-70-check **310**, test-70 **182** (it execs studio-70-check and test-66431),
  test-714 **137**, test-713 **50**, test-widget-anim **18**, test-widget-dim pass, test-662 75, test-663 49, test-6641 128,
  test-6642 75, test-66421 49, test-6643 90, test-66429 83, test-play-copy 28, test-6056 48, test-619 55, album-rename 40,
  albums-manual 40, check-dom DOM INTEGRITY FAILURES 0, ota-guard 20, ota-bootapply 24, ota-loop 26, ota-update 52,
  ota-bundle/ota-bundle-play `--check` OK. Pre-existing and unchanged: `test-705` **223/7** (all seven red at HEAD), and
  `batch-635-check.cjs` 35/7.


## 71.4 (Sep 30, 2026): Studio answers every button and gains an edit rack, a week is the floor on "recent", letters flow, and the tip tiers are the ones your copy can take
- **The user's words**: "Half the buttons in studio don't work and make it like a professional editing app for studio with
  the functions. If songs eps or albums are over a week old they should show in the new releases home bubble. Make lyrics
  highlight work with every song and add another highlight option called letter by letter where it like smoothly flows
  between letters and syllables like a wave", then "on apk/web version it should only display on donations the actual ones
  that bring you to stripe only 2,5,10,25,50 should display and it should say brings you through stripe for donations then
  on play version it's Google play billing all of them". Five asks, one release.
- **1. WHY STUDIO'S BUTTONS LOOKED DEAD — AND THE FIX.** Every file tool read `currentTrack()`, i.e. "the song that is
  playing". **On a fresh launch nothing is playing, so crop, the clip maker and the sampler each answered "Play a song
  first"** and the screen read as broken - there was no way to aim Studio at a song at all. Studio now has a **WORKING
  SONG**: `workTrack()` = a song you picked (`studioPickId`, persisted at `sidecut_studio_pick`) -> else `currentTrack()`
  -> else the first song in the library, so a tool always has something real. `openSongPickerSheet()` is a searchable list
  (`data-pickid`, `.sc-pick`) and `playWorkTrack()` starts it through the NEW `window.__scPlayTrack(id)` hook, which calls
  the app's own `playTrackInPlaylistContext(id)` so the queue keeps the song's playlist instead of dumping the library.
  `renderStudio` paints `workTrack()` (the header now says **Working song**), and `cropCurrent` / `openClipSheet` /
  `loadSamplerFor` / the sampler sheet all read it.
- **2. A TOOL THAT THREW LOOKED EXACTLY LIKE A TOOL THAT WAS NEVER WIRED.** `openTool()` and the whole `[data-act]` chain
  are wrapped in `try/catch` with a toast ("could not open" / "could not answer"); an unknown id says "not in this build"
  rather than nothing. The clip sheet's chips were also the only ones queried **document-wide**
  (`document.querySelectorAll('[data-clipnudge]')`) - they are now scoped to `#scSheetBody`, like every other sheet.
- **3. THE EDIT RACK** (`openEditSheet`, card id `edit`, glyph 🎚) is the "professional functions" half: **trim silence**
  (`editThreshold` against the song's own peak, one span for every channel so a stereo pair cannot unbalance), **fade in /
  out**, **gain** (dB chips), **level match** (peak to 0.98, measured AFTER the gain so the two cannot fight into
  clipping), **reverse**, **preview** (a `createBufferSource` on the rendered audio itself) and **Save a copy**
  (`__scEncodeMp3` at 128/192/256/320 -> `__scSaveClip` as `name (edit).mp3`). All of it is plain sample math on the ONE
  decoded buffer Studio already caches - no second decoder, no second encoder, so preview and export are the same audio.
  **Nothing touches the library copy**: `editExport` never calls `__scPersistTrack` and never swaps `t.file` (the
  re-encode path does both, which is the difference the gate pins).
- **4. A WEEK IS THE FLOOR ON "RECENT".** The New-releases bubble never dropped anything - that was never the bug - but
  nothing said so and it read as a last-few-days list. New `window.__scRelWeekMs = 7 * 86400000`,
  `window.__scRelIsRecent(date)`, `window.__scRelCountText(list, unseen)` ("**N this week · M earlier · T recent
  releases**"), and the in-place painter inserts ONE `#hbRelEarlier` heading ("Earlier than a week", styled
  `.hb-rel-earlier`) in front of the first row whose own `data-date` is past the week, removing it when none is. Panel and
  repaint both call the same one function.
- **5. LETTER BY LETTER, AND A HIGHLIGHT THAT NO LONGER NEEDS THE SCROLL SWITCH.** New `lyricsLetterByLetter`
  (persisted, exported and imported with the other setting) + a `#lyricsLetterBtn` chip beside `#lyricsWordBtn`; letter
  mode **turns the word spans on** (it needs them) and word mode off takes letter mode with it. `scEnsureLetterSpans(word)`
  wraps one word's characters **once**, each `<span class="lyric-letter">` carrying `transition-delay: i*26ms` - that delay
  IS the wave - and `scPaceWords` (the single place a word becomes `.current` in both branches) now lights
  `math.ceil(frac * letters)` of them, clearing every other word back to the trough. Both chips are painted from one
  helper, `window.__scLyricsHighlightChips()`.
- **THE REAL EVERY-SONG BUG**: in the **plain-lyrics** branch the entire block - the current-line tracking AND the word
  pacing - sat behind `if (lyricsAutoScroll && audio.duration > 0)`, so **turning auto-scroll off silenced the highlight on
  every song without timestamps**. The guard is now `if (audio.duration > 0)`; `scrollLyricsToLine` already returns early
  on `!lyricsAutoScroll`, so the scroll half is unchanged.
- **6. THE DONATE PANE OFFERS ONLY WHAT THE COPY CAN TAKE.** A copy with no Billing can only be paid on a card page, so a
  tier with no page behind it had nothing to offer but a sentence and a detour to the Play listing.
  `if(!donateUrlFor(amt)) btn.style.display = 'none';` runs over the pane's own `.donate-quick` buttons inside the existing
  `if(promise && !SC_IS_PLAY)` block, and the two sentences now say the tip **brings you through Stripe for donations**.
  **The markup is untouched - all eleven tiers stay** and the hiding is per copy at run time; the Play build keeps every
  tier and never resolves a card page at all (`const web = SC_IS_PLAY ? '' : donateUrlFor(amt);`). The refresh-rate row
  reuses the `donate-quick` class but lives in `#refreshRateOptions`, so the pane-scoped query cannot reach it.
- **`dev/patch-714.mjs` / `dev/repin-714.mjs`**: `APP_VERSION` **71.3 -> 71.4**, stamp `September 30, 2026 \u00b7
  9:08 PM EDT`, shell cache **`v63.0.49 -> v63.0.50`**, an **8-note** head (the donations note is 7th so it never rides to
  Play), **40 edits**, every sub keying on text IT adds; repin **25 edits across 20 files**, still skipping `test-705.mjs`.
- **A NEW REPIN STEP, LEARNED THE HARD WAY: `const PREV`.** `dev/test-713.mjs` asserts "the release before it is still
  listed next" and pinned `PREV = '71.2'` - which was right when it was written and wrong one release later, so 71.4 left
  it red until the repin learned to move it. Step **D** in `repin-714.mjs` has an explicit `PREV_MOVES` map (the source
  pin -> the pin it must become) plus a stale check for it; **only gates that assert ADJACENCY are listed**, because every
  other `PREV` in `dev/` pins the release ITS OWN gate describes (61.3.7, 64.2.8, 70.0 …) and must never move.
  **The next release's repin must add its own entry for `test-714.mjs` (71.3 -> 71.4).**
- **THE `key` GOTCHA, HIT AGAIN**: a key matching text another sub **ADDS LATER** silently skips that sub while `--check`
  looks clean. Here the clip-maker sub keyed on `toast('Add a song to your library first.'); return false; }` - text the
  BIG STUDIO BLOCK (emitted earlier in the same run) already contains, because `playWorkTrack` uses the same sentence. The
  fix is the repo's own rule: give the sub a sentence **only it writes** ("…and it can be clipped here."). `SC_DEBUG=1
  node dev/patch-714.mjs --check` now prints which sub was skipped, which is how this was found.
- **WHERE THE 71.4 CODE LIVES**: the new Studio block sits between section 11 and `buildStudioView()` (working song,
  picker, edit rack); `renderStudio`'s header card, `openTool`, the `[data-act]` chain and `cropCurrent`/`openClipSheet`
  are edited in place; the week split goes in beside `window.__scHbRelRowInner` and the heading is inserted in
  `__scHbPaintRelRows` after the rows; `scEnsureLetterSpans` / `clearLetters` / `lettersOn` sit above the `// Pace a
  line's words from fromSec to toSec:` comment, and the letter run is lit from inside `scPaceWords` itself; and
  `window.__scPlayTrack` is published with the other 70.0 hooks next to `window.__scNext`.
- **A STALE GATE, NOT OURS: `dev/test-705.mjs` is 223 passed / 7 FAILED** (it was **222/8 AT HEAD**, measured with a
  scratch tree built from `git show HEAD:index.html`) - its badge-wall/whirl checks read `dev/sc70-module.js`, which is
  untouched; they were already red and 71.4 happens to fix one. `dev/studio-70-check.cjs` moved from **289 to 296** checks
  (the Donate tier assertions) and its `[2]` now expects **nine** tool cards, `edit` included.
- **VERIFIED**: test-714 **137** (new gate), studio-70 **296**, test-70 **182**, test-705 **223/7 (7 pre-existing)**, test-713
  50, test-662 75, test-663 49, 6641 128, 6642 75, 66421 49, 6643 90, 66429 83, test-play-copy 28, test-619 55,
  album-rename 40, albums-manual 40, check-dom DOM INTEGRITY FAILURES 0, ota-guard 20, ota-bootapply 24, ota-loop 26,
  ota-update 52. `test-66429` read 82/1 on one run and 83/0 on the next two with no edit in between - it is count-sensitive
  to the machine, so re-run it before believing a single failure.
- **THE OTA BUNDLE CONVERGES**: 846113 -> **846207 (fixed point)**, `ota-play` **846215**; two consecutive
  `ota-bundle`/`ota-bundle-play` generations are **byte-identical** (md5sum on all eight artifacts) and
  `ota-play/updates.json` carries exactly the head entry's first six notes with **no mention of Stripe**.
- **THE STAMP ARITHMETIC** (unchanged): Eastern is UTC-4 for these releases, with the date rolling back. `date -u` read
  `2026-10-01 01:08 UTC` while `TZ=America/New_York date` printed an inconsistent `01:08 AM America`, so the stamp follows
  the repo's own precedent (UTC - 4) - `September 30, 2026 \u00b7 9:08 PM EDT` - and all three stamp gates pass.

## 71.3 (Sep 30, 2026): YouTube playlists, the song's own metadata, and updates that wait for a run
- **The user's words**: "Make it so that in YouTube converter you can convert YouTube playlists and make the updates not
  interrupt downloads. Also make YouTube converter fetch the metadata for that song too." Three asks, one release.
- **1. A PLAYLIST LINK MAKES THE WHOLE LIST.** The card only knew `extractYtVideoId`, so a list address (no `v=` of its
  own) ended at "Couldn't extract video ID". `convertYtToMp3` now reads `scYtPlaylistId(url)` first and hands a list to
  `scYtConvertPlaylist` **only when there is no direct video** (`_listId && !_directVideoId`) - a watch link still
  makes just its video. The list is read by `scYtResolvePlaylist(listId)`, which fetches
  `https://www.youtube.com/playlist?list=…&hl=en&gl=US` through `fetchWithProxy` (the device network path) and parses
  the **`ytInitialData` object the page embeds** - a balanced-brace scan then `JSON.parse` - walking it for BOTH
  `playlistVideoRenderer` and the newer `lockupViewModel`, deduped by an 11-character `/^[\w-]{11}$/` id. A picker lists
  every song ticked (`yt-pl-cb`, All/None), and the run loops `scYtOneVideo(...)` per song, landing each in the library
  and reporting into the floating pill. **Scraping markup would have been the wrong call** - YouTube reshapes it weekly;
  the embedded data object is the stable interface.
- **2. THE SONG'S OWN METADATA, NOT JUST THE UPLOAD'S.** `scYtEnrichMeta(title, author)` asks the iTunes Search API
  for the official title/artist/album/year/genre/track and the **600x600** cover, and accepts a hit only when BOTH
  `scArtistMatch(artist, row.artistName, '', '', '')` and `scYtTitleMatch(cleanTitle, row.trackName)` pass - a
  look-alike channel cannot dress a song up as another and nothing is borrowed on no match. `scYtSearchTitle` strips
  `(Official Video)`-family noise first; without it every lookup missed. The cover bytes are read in the same call so
  the tag and the library row carry them. The single-link path runs the SAME enrichment inside `tryMeta()` (which
  `tryYtAudioFormat` already awaited before encoding) and the player's own `videoTitle`/`author` fill in whatever oEmbed
  left empty. The tag and `scAddConvertedToLibrary` both receive album/year/genre/track/`artBytes`/`artMime`.
- **3. AN UPDATE NO LONGER CUTS A RUN OFF.** `dev/native-updates.js` reloads the WebView to apply a bundle, which kills
  the job. The page already publishes "a run is in flight" on **`window.__scNotifConv`** (the flag the bell reads, set by
  `scConvertPillUpdate`, cleared by `scConvertPillDone`) - and `scConvertPill(false)` now clears it too, so a **cancelled**
  run stops looking busy the moment its pill goes (otherwise the flag would stick and hold every update back until a
  restart). The updater gained `somethingIsDownloading()` and, in `applyStagedNow`, a deferral block placed **before**
  the `!force && somethingIsPlaying()` one - deliberately, so even a deliberate **Install now** (`force`) cannot cut a
  run off; the bundle is pinned to a real app kill via `applyInBackground` + `waitForRelaunch`.
- **`dev/patch-713.mjs` / `dev/repin-713.mjs`**: `APP_VERSION` **71.2 -> 71.3**, stamp `September 30, 2026 \u00b7
  7:48 PM EDT`, shell cache **`v63.0.48 -> v63.0.49`**, a 6-note changelog head, **11 edits** (10 in index.html, 1 in
  sw.js) with every sub keying on text IT adds; repin **22 edits across 19 files**, still skipping `test-705.mjs`.
- **`dev/patch-713b.mjs` - THE SANDBOX PRO TAGS COME OFF** ("On sandbox remove the pro tags"). 70.1.3 removed the last
  entitlement ("Nothing is PRO any more") and the panel's own description says the paywall line is gone, but the twelve
  little gold `PRO` badges in the markup were left behind telling every reader half the list is held back. All twelve are
  the **same exact string** and all twelve live in `#settingsPaneSandbox`, so the removal is one global replace. **A
  follow-up script, NOT an edit inside `patch-713.mjs`, because that script short-circuits on `APP_VERSION === '71.3'` -
  which is exactly the tree this runs on** (the repo's own `patch-6055b/c.mjs` did the same for 60.5.5). **A removal has
  to key on its RESULT**: `'Compact now bar </span>'` is absent before and present after. It also appends a **7th** note to
  the 71.3 entry - past the first six, so it never rides to `ota-play`.
- **A STALE GATE THAT IS NOT OURS**: `dev/batch-635-check.cjs` is **35 passed / 7 failed AT HEAD** (v70.1.9, verified
  with `SC_HTML=<git show HEAD:index.html>`), because it still asserts a free user is denied the PRO visuals the 70.1.3
  release deliberately removed. It is unrelated to this release and stays as it is.
- **THE BIG BLOCK IS EMITTED WITH `String.raw`.** It is source code for index.html, not data to interpret, so `\u26a0`,
  `\u2705`, `\w`, `\.` etc. must survive the patch script verbatim - `String.raw` is the only way to write them once.
  The one thing it cannot contain is a backtick or `${`; keep new helpers free of both.
- **THE HEAD NOTES RIDE TO PLAY.** The head entry's first six items are copied into `ota-play/updates.json` verbatim, so
  they must clear the WIDER list `dev/test-play-copy.mjs` audits (no download/downloading/converter/convert(s|ing|ion)/
  mp3/get song/hand-off) as well as `dev/test-662.mjs` (`\bdownload|converter|convert\b`, no Play-build naming, must
  name studio|player|dock|premium|license). They say "made", "in flight", "reloading", and name the player/dock/Studio.
- **VERIFIED**: test-713 **50** (new gate), test-705 **230**, studio-70 **289**, test-70 **182**, test-662 75, test-663
  49, 6641 128, 6642 75, 66421 49, 6643 90, 66429 83, test-play-copy 28, test-619 55, album-rename 40, albums-manual
  40, check-dom DOM INTEGRITY FAILURES 0, ota-guard 20, ota-bootapply 24, ota-loop 26, ota-update 52. test-6058 is the
  known 47/1 ("free-tier blurb says 30-second previews").
- **THE OTA BUNDLE CONVERGES**: 837402 -> 837414 -> **837414 (fixed point)**, `ota-play` **837422**; after the 713b badge
  removal 837414 -> 837440 -> **837440 (fixed point)**, `ota-play` **837448**; two consecutive `ota-bundle` /
  `ota-bundle-play` generations are **byte-identical** (md5sum on all seven artifacts) and both `--check` runs report
  v71.3 with 6 notes (the head entry carries 7; the first six are what ride to Play).
- **UNCOMMITTED IN THIS WORKTREE**: **70.2.0**, **70.2.1**, **71.2** and **71.3** are all applied-and-verified but not
  committed or pushed. One commit carrying all four matches the `7d5c746` ("70.1.5-70.1.9") convention.


## 71.2 (Sep 30, 2026): the refresh button comes back to the header and the add-songs plus moves to the dock
- **The user's words**: "And add an refresh button back next to the settings icon at the top and move the plus icon for
  exporting importing add songs ect... to the bottom tabs just the smaller plus icon. Make sure there are all in v71.2 one
  update." This **reverses 70.0.5** (f8b2587), which had taken the add-songs pill out of the dock and the refresh button
  out of the header and left one + at the top as the only way into the menu.
- **WHAT MOVED**: (1) the header's `#addSongsBtn` + becomes `#refreshBtn` in the SAME slot - the row is now
  notifications / refresh / settings, and the refresh is wired again (`_scRefreshWired`, `saveMeta()` then
  `location.reload()`); (2) a compact `#dockAddBtn` sits on the dock after Studio and toggles the same `#addSongsMenu`.
- **THE DOCK PLUS IS `action-pill dock-add`, AND IT HAS TO BE BOTH.** `.action-strip > *{ flex:1 1 0 }` makes every
  direct child an equal-width cell, so the plus carries a more specific rule
  (`.action-strip .action-pill.dock-add{ flex:0 0 auto; width:44px; ... }`) to stay the **smaller icon** - a fifth equal
  cell is exactly what squeezed the old "+ Add songs" pill. And it must keep the `action-pill` class: `reorderActionPills()`
  runs at boot, appends the ordered tabs to a fragment, then **every other `.action-pill`**, then re-attaches - a button
  that was NOT `.action-pill` would be left in front of the four tabs and the plus would jump to the left of the row.
  Both dock readers (`getStripItems()`, the studio probe's tab list) skip it by its `dock-add` class.
- **`body.sandbox-large-touch .action-pill{ padding:12px 18px !important; }` WOULD SQUARE-IFY IT BACK INTO A TAB** - a
  matching `padding:0 !important` rule lands with it, plus a 38px override under 380px.
- **`dev/test-70.mjs` POLICED THE 70 SERIES BY LITERAL** and failed on 71.2 for no reason but its major:
  `/^70\.\d+(\.\d+)?$/` and a `70.x`-only series arm. The series arms now name 71.x the way they already named 70.1, and
  the rule underneath is the **general** one (well-formed version, third number under ten, a new series not reading
  x.y.0). Its `VER` still says `70.0` - that gate DESCRIBES 70.0 and reads that entry by version.
- **`dev/patch-712.mjs` / `dev/repin-712.mjs`**: `APP_VERSION` **70.2.1 -> 71.2**, stamp `September 30, 2026 \u00b7
  7:14 PM EDT`, shell cache **`v63.0.47 -> v63.0.48`**, a 6-note changelog head, **12 edits** (13 with the test-70
  repoint, which was added after the first pass and applied on a re-run - every other sub skipped on its key); the usual
  repin (**22 edits across 19 files**, still skipping `test-705.mjs`).
- **THE GATES WERE REVERSED, NOT ADDED**: `dev/test-705.mjs` `[2]`/`[3]` now assert the dock plus + the header refresh,
  and the 70.0.5 rules that said the opposite (`count('id="refreshBtn"') === 0`, `count('id="addSongsBtn"') === 1`) are
  gone; `dev/studio-70-check.cjs` `[1]` drives the same two claims and its tab list filters out `dock-add`. **A release
  that reverses an older one has to reverse that older release's gates too**, or the suite asserts both.
- **VERIFIED**: test-705 **230**, studio-70 **289**, test-70 **182**, test-662 75, test-663 49, 6641 128, 6642 75,
  66421 49, 6643 90, 66429 83, test-play-copy 28, test-619 55, album-rename 40, albums-manual 40, check-dom DOM
  INTEGRITY FAILURES 0, ota-guard 20, ota-bootapply 24, ota-loop 26, ota-update 52.
- **THE OTA BUNDLE CONVERGES**: seed 830879 -> 830975 -> **830975 (fixed point)**, `ota-play` **830982**; two
  consecutive generations are **byte-identical** and both `--check` runs report v71.2 with 6 notes.
- **UNCOMMITTED IN THIS WORKTREE**: **70.2.0**, **70.2.1** and **71.2** are all applied-and-verified but not committed or
  pushed. One commit carrying all three matches the `7d5c746` ("70.1.5-70.1.9") convention.


## 70.2.1 (Sep 30, 2026): the album cover camera moves into Manage albums
- **The user's words**: "The camera button for setting the image should be in manage albums not next to the actual
  album in the album row like it is in the screenshot." 70.1.5 had put it on the album **card header**, which is also
  the tap that opens and closes the album - so the camera sat inside the tap target and a press aimed at the chevron
  could land on it instead. Manage albums already owns the per-album controls (Rename, Delete, the search box, the
  ordering), so the camera went beside them and the card header went back to being one thing.
- **WHAT MOVED**: (1) the `.alb-cover-btn` button is **gone from the album card header** and so is the `_covBtn`
  handler that opened the picker from it; (2) `manageAlbumsHTML()` grows a `.mgr-alb-cover` camera button per row,
  ahead of Rename/Delete, built from the **same `data-i` row index** they already use; (3) `wireManageAlbums()` wires
  it next to the Rename wiring, resolved through `names` by index the same way. The picker itself
  (`albumCoverModal`/`applyAlbumCover`, the song-cover grid, the remove, the save path) is untouched.
- **THE ONE THING THAT WOULD HAVE LOOKED BROKEN**: the picker appends a bare `.modal-backdrop`, which is
  **`z-index:60`**, and the Discover popup Manage albums lives in is **`z-index:70`** - so opened from that panel it
  would have rendered **BEHIND the list** and read as a tap that did nothing. `albumCoverModal` now sets
  `modal.style.zIndex = '10001'` (the level `#artistPromptBackdrop` already uses). **Any modal opened from a Discover
  popup needs this**; a bare `.modal-backdrop` will always be under it.
- **A REMOVAL HAS NO TEXT TO KEY ON.** `sub()`'s idempotence guard is "if the key is present, skip" - which works for
  an edit that ADDS text and not for one that deletes it. Both removals here key on `class="mgr-alb-cover"`, the
  markup written by a LATER sub in the same patch: absent before the release, present after it, and because that sub
  runs after these two it cannot skip them. **Do not key a removal on `@@ marker @@`-style text; the anchor-missing
  path makes the second run refuse to write.**
- **`dev/patch-7021.mjs` / `dev/repin-7021.mjs`**: `APP_VERSION` **70.2.0 -> 70.2.1**, stamp
  `September 30, 2026 \u00b7 6:43 PM EDT`, shell cache **`v63.0.46 -> v63.0.47`**, a 6-note changelog head,
  **10 edits**; the usual repin (**22 edits across 19 files**, still skipping `test-705.mjs`).
- **THE GATES WERE REPOINTED, NOT ADDED**: `dev/test-705.mjs` `[10b]` now asserts `alb-cover-btn === 0` **and**
  `class="mgr-alb-cover" === 1` + the row wiring; `dev/studio-70-check.cjs` `[11h]` pins where the picker is reached
  from (jsdom cannot resolve a z-index, so the stacking above cannot be asserted there).
- **VERIFIED**: test-705 **225**, studio-70 **288**, test-662 75, test-663 49, 6641 128, 6642 75, 66421 49,
  6643 90, 66429 83, test-play-copy 28, test-619 55, album-rename 40, albums-manual 40, ota-guard 20, ota-bootapply
  24, ota-loop 26, ota-update 52.
- **THE OTA BUNDLE CONVERGES**: seed 829973 -> 829779 -> **829779 (fixed point)**, `ota-play` **829786**; two
  consecutive generations are **byte-identical** and both `--check` runs report v70.2.1 with 6 notes.
- **UNCOMMITTED IN THIS WORKTREE**: both **70.2.0** and **70.2.1** sit applied-and-verified but not committed or
  pushed. A single commit carrying both matches the `7d5c746` ("70.1.5-70.1.9") convention.


## 70.2.0 (Sep 30, 2026): the tip rail works from the sideloaded package, and a page the app opens really opens
- **The user's words**: "The stripe isn't linked on the apk like it should while on the Web it is". Both halves were true,
  and they are **two independent defects** - the browser worked because it failed in the one way 70.1.9 handled, and the
  APK failed in the two ways it did not.
- **1. THE APK DOES NOT FAIL THE WAY THE BROWSER DOES, and that is the whole bug.** `runTip` reached the card page only
  from the `'unavailable'` branch - the answer when `getPlayBillingService()` finds **no plugin at all**, which is exactly
  a plain browser. The sideloaded package ships `@capgo/native-purchases`, so the plugin IS there and `purchasePlayItem`
  really asks Play: a package Play never distributed has **no products**, so it answers **`'not-found'`**, or `'error'`
  when the sheet itself refuses. Both of those returned early with a sentence, so the card page was unreachable from the
  one copy that needed it. The lookup now sits **above** both returns: the rail a copy can use is a property of the copy,
  not of the way Play declined. `'cancelled'` still stops the tip (the branch above it returns first) - someone who
  backed out of the Play sheet did not ask to be sent to Stripe - and `SC_IS_PLAY` still keeps the store build out of the
  lookup entirely. **A test that only ever drives the browser copy thinks a two-branch sentence is the whole story.**
- **2. `window.open()` DOES NOTHING IN THIS WEBVIEW.** Capacitor's WebView has no window support, so
  `window.open(url, '_blank', 'noopener')` answers **null** and no window is ever created: the app's own note next to the
  Spotify handoff says so ("Capacitor's WebView cannot open new windows"), which is why that code already falls back to
  `window.location.href`. Assigning an address whose host is **not** in `allowNavigation` is handed to Android as an
  ACTION_VIEW intent, so the system browser takes it - which is what "opens the card page in your browser" always
  promised. `scOpenExternal(url)` is now that idiom in one place (try the window, fall back to the address, never
  silently do nothing) and both the card page and the Play listing go through it. **Nothing in this repo could have
  proved this without a device; the evidence was the app's own comment about the WebView, in the file.**
- **THE PROBE BOOTS THREE WAYS NOW**, which is what makes the reported path measurable: `boot()` (the browser),
  `boot('play')` (`__PLAY_BUILD__`) and `boot('apk')` (a `fakeCapacitor()` whose `NativePurchases` reports itself
  supported and then has **no products** - what the sideloaded package really gets back). `[11n]` stubs `win.open` to
  answer null the way the WebView does, taps Tip $5, and requires the card URL **and** a refused navigation
  (`/Not implemented: navigation/`, which is how jsdom reports the address fallback) - so "handed to Android, not only
  to `window.open()`" is measured, not asserted in prose. `boot(play)` became `boot(mode)` for this.
- **TWO PATCH-AUTHORING TRAPS FIRED, BOTH OF THE SAME FAMILY AS 70.1.7's.** (1) The sub that REMOVES the old card block
  was keyed on `const web = SC_IS_PLAY` - the very text it deletes - so the guard skipped it on the first run and
  `--check` reported **nothing wrong**; the result was two card blocks and a gate that failed two claims later. The key
  is now a phrase the OTHER sub adds. (2) `count("try{ window.open(web,") === 0` was too broad: the same call shape
  exists in the Spotify handoff (`scOpenSpotifySearch`, `catch(_e){ }` instead of `catch(_eDon){ }`), so the check failed
  against a correct file. **A count needle is a claim about the whole 2.8MB file - anchor it on the line this release
  touched.** (3) A third one the `must()` block caught for free: this release's last changelog note was written
  identically to 70.1.9's, so `count(note) === 1` found two.
- **Verified.** test-705 **225** (was 222; three rules: the helper and its fallback, both call sites going through it,
  and the lookup above the `not-found`/`error` returns), studio-70-check **288** (was 284; `[11n]`, the sideloaded
  package driving the exact report), test-662 75, test-663 49, 6641 128, 6642 75, 66421 49, 6643 90, 66429 83,
  test-play-copy 28, test-619 55, audit-calls clean, ota-guard 20, ota-bootapply 24, ota-loop **26** (see below),
  ota-update 52. `dev/test-6058.mjs` still reports **47 passed, 1 failed** - the pre-existing "free-tier blurb"
  baseline failure documented in 70.1.9.
- **`dev/ota-loop-check.cjs` IS TIMING-SENSITIVE.** One run inside a long chain of commands reported
  **24 passed, 2 failed**; three standalone runs after it reported 26/0 and one of those needed most of a 180s budget.
  It boots the app repeatedly and counts reloads, so a loaded machine can shift its windows. Re-run it alone before
  believing a failure.
- **`dev/patch-7020.mjs` / `dev/repin-7020.mjs`**: `APP_VERSION` **70.1.9 -> 70.2.0** (the third number stops at nine),
  stamp `September 30, 2026 \u00b7 5:52 PM EDT`, shell cache `v63.0.45 -> v63.0.46`, a 6-note changelog head,
  **15 edits**; the usual repin (**22 edits across 19 files**, still skipping `test-705.mjs`).
- **THE OTA BUNDLE CONVERGES.** seed 829639 -> 829528 -> **829528**, and the shipped state has
  `ota/update.zip` **829528** (real size) with `manifest.json` + `updates.json` + `ota/manifest.json` +
  `ota/updates.json` all **829528**, and `ota-play/updates.json` **829533**; two consecutive generations are
  byte-identical and `ota-fixpoint.mjs` reports `(fixed point)` with five `OK` lines.


## 70.1.9 (Sep 30, 2026): donations reach the sideloaded package and the browser, and the store build says where audio can come from
- **The user's words**: "make donations work on the apk" (the parked release, finally unblocked) plus the payment links,
  "In play version you can put that you can get mp3's from external sources as well", and then the two corrections that
  reshaped it: "What about 2 dollar stripe” and **"store is for apk/web only not play store that has play billing"**.
  Two things shipped in one release: the tip rail, and four copy edits on the store build.
- **ASK BEFORE MAPPING MONEY.** The links arrived as `...MI03 ...MI02 ...MI04 these are 10 25 and 50 this is 5 ...MI01`,
  which reads positionally as 03=$10, 02=$25, 04=$50, 01=$5 - and that reading is **wrong**. The user confirmed
  **01=$5, 02=$10, 03=$25, 04=$50**, and later **MI00=$2**. One `ask_user` question was much cheaper than four
  mislabelled donation buttons, and a wrong tier is invisible in the UI (the button already says "Tip $25"; only the link
  behind it is wrong). **Ask.**
- **THE RAIL: `PAYMENT_CONFIG.donateLinks`, one hosted card page per amount, AND ONLY ON A COPY PLAY DOES NOT SELL TO.**
  Google Play Billing only sells inside the copy Play distributed, so the `full` flavour (com.SideCut.myapp.full) and a
  plain browser had nothing to charge and every tip ended at "install the Play build". Stripe Payment Links are **fixed
  amounts**, so this is a table (`2:`, `5:`, `10:`, `25:`, `50:`) and not a template: `donateUrlFor(amt)` asks the table
  first, then falls back to the optional templated `donateUrl` (a PayPal.me / Cash App link takes `{amt}`; a "customers
  choose what they pay" link is used as-is). Empty result = no web route, which is the answer `runTip` branches on.
  `runTip(sku)` became `runTip(sku, amt)` because the web rail needs the number the user tapped.
- **THE STORE BUILD IS NOT PART OF THE CARD ROUTE AT ALL** - the user drew that line explicitly, and it is the difference
  between a product rule and a bug: `const web = SC_IS_PLAY ? '' : donateUrlFor(amt);` and
  `const tierList = SC_IS_PLAY ? '' : donateTierList();`, so a copy installed from Play never looks a card page up and
  never names one, and its fallback sentence is character-for-character the one 70.1.3 shipped. `SC_IS_PLAY` is a `var`
  in the same script block as `initDonateTab` and `runTip`, so it is in scope with no plumbing. A tier with **no** page of
  its own keeps 70.1.3's route (message + Play listing), now saying which amounts do work here, read off the table by
  `donateTierList()` rather than written out a second time - and **the store build's Donate pane is untouched copy too,
  because the user said so twice** ("No the play build should stay as is with play billing no stripe for that"). Both
  sentences a card page changes therefore live behind `if(promise && !SC_IS_PLAY){` in `initDonateTab`: `#donatePromise`
  ("Pick an amount - Google Play handles the payment." becomes the rail sentence plus the amounts) and `#donateIntro`
  (the "processed through Google Play" clause becomes a card page). The markup those rewrites target is the 70.1.8
  markup character for character; only the two `id` attributes are new, and a copy with no links leaves the sentence
  alone. Putting the amount list in static markup had already gone stale once - it said four amounts the day a fifth
  arrived - which is why the list is read from the table at the moment the pane opens.
- **THE STORE BUILD'S COPY, four edits, all inside the `SC_IS_PLAY` block**: the walkthrough that `getSongsHowToDisc`
  and `getSongsHowToSettings` both render, the first-run sheet's `howToGetMusicHead` rewrite, the tutorial summary
  (`tutSumGetMusic`) and the first help answer in `_aiKB`. Before, that copy said "SideCut plays the audio files saved on
  your device" - true, but it reads as a limit. It now adds that audio from external sources works too (a computer, a
  cloud drive, an SD card, an email, a chat or another app). **Nothing about what the build does changed** - it still
  fetches nothing - and `dev/test-play-copy.mjs` holds that copy to its wider term list (`converter|spotify|youtube|to
  mp3|download|expand url` on the walkthrough string, evaluated with `new Function`), which is why none of the new
  wording names a source or a tool.
- **A NOTE THAT SAILS WITH THE PLAY BUNDLE IS AUDITED HARDER THAN ANY OTHER TEXT.** `ota-bundle-play.mjs` copies the
  head entry's first six items into `ota-play/updates.json` **unfiltered** (`scHidesOnPlay` is not applied), and
  `test-play-copy.mjs` `[3]` runs a **wider** list over them than the shipped filter knows:
  `/(downloader|downloading|\bdownload|converter|converts|converting|conversion|\bconvert\b|\bmp3\b|get song|no source
  found|hand-?off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch)/i`. So **a changelog head note may not say
  "MP3"**, may not say "save the file" (`test-play-copy` `[2]`), and may not say "download", "convert" or "get song"
  (test-662 `[9]`, test-6642/66421). The notes that shipped say "the audio can come from anywhere" for exactly this
  reason. The patch asserts the rule against its own `NOTES` before writing.
- **AMENDING AN UNCOMMITTED RELEASE IS A RESTORE PLUS A RE-RUN.** The first cut of this release was applied, bundled and
  verified - and then the user's "apk/web only" correction arrived. Nothing had been committed or pushed, so the release
  was amended rather than followed by a second patch: `cp /tmp/sc7018/index.html /tmp/sc7018/sw.js .` and
  `cp -r /tmp/sc7018/dev/. dev/` put the tree back on the 70.1.8 state (**the scratch tree from the previous release is
  the revert, so keep it until the release is committed**), then the rewritten `patch-7019.mjs` + `repin-7019.mjs` ran
  again from scratch (`--check` first: `would apply 17 edit(s), 0 already in place`). The compare that proves the restore
  was exact is `diff -rq /tmp/sc7018/dev dev` - it must list only the files you intend to change.
- **Verified.** test-705 **222** (was 217; the new rule is five web-route and store-build checks added under the 70.1.3
  donate block), studio-70-check **284** (was 271). The probe now **boots twice** - `boot(play)` sets
  `window.__PLAY_BUILD__` in `beforeParse`, before any inline script has read `SC_IS_PLAY` - so both sides of the user's
  line are MEASURED, not reasoned about: `[11l]` (no flag, the sideloaded package exactly, since jsdom has no
  `window.Capacitor`) sees the pane promise `$2, $5, $10, $25 or $50`, opens
  `https://buy.stripe.com/28E4gyb6vfUn1P2dsUdMI01` on a tap of `$5`, and still ends `$7` in the Play listing; `[11m]`
  (flag set, the store build exactly) sees the two sentences the last release shipped, **no mention of a card page
  anywhere it says**, and a `$5` tap that ends in the Play listing.
  test-662 75, test-663 49, 6641 128, 6642 75, 66421 49, 6643 90, 66429 83, test-play-copy 28, test-619 55,
  ota-guard 20, ota-bootapply 24, ota-loop 26, ota-update 52. `dev/test-6058.mjs` reports **47 passed, 1 failed** -
  "free-tier blurb says 30-second previews" (`'Album History, 30-second previews'` is absent from index.html). **That is
  pre-existing**: the string is missing from the 70.1.7 tree too, so it is a baseline failure and not this release's.
- **`dev/patch-7019.mjs` / `dev/repin-7019.mjs`**: `APP_VERSION` **70.1.8 -> 70.1.9**, stamp
  `September 30, 2026 \u00b7 5:00 PM EDT` (the clock read 5:06 PM when it was re-applied), shell cache
  `v63.0.44 -> v63.0.45`, a 6-note changelog head, **19 edits**; the usual repin (**22 edits across 19 files**, still
  skipping `test-705.mjs`). The old `SC_DONATE_URL` env requirement is gone - the links are in the file, where a public
  Payment Link belongs.
- **THE OTA BUNDLE: A FIXED POINT, BUT ONLY AFTER ONE HUNT.** The first cut of this release oscillated
  **828407 <-> 828408** (the 70.1.7 shape), and the final content converges at **828625** with `ota/update.zip` real size
  828625 and `manifest.json` + `updates.json` + `ota/manifest.json` + `ota/updates.json` all **828625**;
  `ota-play/update.zip` + `ota-play/updates.json` **828633**. Two consecutive `ota-bundle.mjs` /
  `ota-bundle-play.mjs` runs are byte-identical (`md5sum` on all six files), which is what `deploy.yml`'s
  `git diff --quiet` and `ota-update-check.cjs`'s "a second generation produces the same bytes" actually require, and
  `ota-fixpoint.mjs` itself now reports `(fixed point)` and five `OK` lines. **Check convergence every release instead of
  assuming either answer** - 70.1.6, 70.1.8 and 70.1.9's final content converged; 70.1.7 and 70.1.9's first cut did not.
  The manual loop is `S=$(node -e "...ota/updates.json.size"); cp ota/updates.json manifest.json; node dev/ota-bundle.mjs;
  node dev/ota-bundle-play.mjs; echo seeded/built`, repeated until the size stops moving.


## 70.1.8 (Sep 30, 2026): SAVE COPY renders the song with the deck's own sound as a new song
- **The user's words**: "in dj mode make it so that all the changes you've made can be saved as a dj mode copy of the
  song seperate front the actual song". The label on the button is **SAVE COPY**, and it sits under the record panel.
- **REC WAS THE WRONG TOOL, TWICE.** DJ Mode already had `REC`, which captures the deck live through a
  `MediaStreamDestination`: real time (a four minute song is four minutes of waiting, plus whatever is played while it
  runs) and it hands back a file to save, not a song in the library. SAVE COPY renders instead: the deck has already
  decoded the track into `deckEngine.buffer`, so an `OfflineAudioContext` runs the whole thing in one pass in a few
  seconds, and the result goes into the library through `scAddConvertedToLibrary` - the same helper a finished
  conversion uses - as `"<name> (DJ edit)"`. **The loaded song is never written to.**
- **EVERY BAKED VALUE IS READ OFF THE LIVE NODES, not re-derived from the knobs**: the filter's `type`/`frequency`/`Q`
  off `deckEngine.filterNode`, each of the eight `eqNodes[0]` band's own gain, `gainNodes[0]`,
  `deckGainNodes[0]`, the limiter's five settings, the reverb's **same convolver buffer** plus preDelay/highpass/lowpass
  and wet gain, the flanger and delay sends (`lfoGain` -> `delayTime`, feedback, wet) and the DUCK pump rebuilt as beat
  automation (`setValueAtTime` / `linearRampToValueAtTime` at `60/bpm/speed`), because a snapshot of the gain at the
  moment of the tap is not the pump. One mapping, two contexts, nothing to drift.
- **KEYLOCK SETTLES THE ONE SUBTLE CASE.** `applyKeylockDetune` countershifts `detune` by `-1200*log2(rate)`, and a
  buffer source really plays at **`playbackRate * 2^(detune/1200)`** (the Web Audio spec's `computedPlaybackRate`, W3C
  Web Audio 1.1). Baking **both** is what reproduces the sound the deck is making; the offline source gets
  `src.playbackRate.value = state.rate` **and** `src.detune.value = state.detune`, and a paused deck (no node) mirrors
  the same two from the engine.
- **THE LOOP IS NOT PART OF THE COPY, on purpose**: a loop is where playback is, not part of the song, and so is the
  playhead position. The copy is the whole track from the beginning with the deck's sound on it. The render length is
  `buffer.duration / speed` plus a tail that is **only added for sends that exist** (`djCopyTailSeconds()`), so a copy
  made with everything off has no silence on the end.
- **TWO DEFECTS IN `dev/patch-7018.mjs` WERE CAUGHT BY READING IT BEFORE APPLYING IT.** (1) The flanger used
  `lfo.connect(depth); lfo.connect(depth).connect(d.delayTime);` - `AudioNode.connect()` returns the **destination**
  node only in the spec's newer form; against real Web Audio the chained call is `undefined.connect(...)` and throws,
  leaving a half-built send. It is `lfo.connect(depth); depth.connect(d.delayTime);`. (2) The `must()` block carried a
  nonsense always-true clause (`count('' + 'src.detune...') >= 0`). **Read a patch's assertions, not just its edits.**
- **THE GATE HAD TO ASSERT WHAT THE RELEASE BUILDS, NOT THE FEATURE DETECT.** The first cut of `[10e]` counted
  `window.OfflineAudioContext || window.webkitOfflineAudioContext` and demanded exactly 1 - but that string is already in
  the file **four** times (the export path, the decode path, the crop path). The rule now pins
  `const octx = new Offline(chCount` and `const rendered = await octx.startRendering();`, which is the render this
  release adds. **A count-based needle is a claim about the whole file; scratch-run it before believing it.**
- **`dev/repin-7018.mjs` HAD TO BE WRITTEN BEFORE THIS COULD SHIP**: the sweep had already been renamed to
  `repin-7019.mjs` for the parked donation release while `patch-7018.mjs` was being written, so the 70.1.7 -> 70.1.8
  repin did not exist. Same shape as its neighbours (`test-705.mjs` keeps its own pins; **22 edits across 19 files**).
- **Verified.** test-705 **217** (`[10e]`, 5 checks), studio-70-check **271** (`[11k]`, 4 checks - jsdom has no Web
  Audio, so it drives the resting state: the button says `Load a song onto the deck first` rather than throwing), test-662
  75, 663 49, 6641 128, 6642 75, 66421 49, 6643 90, 66429 83, audit-calls clean, ota-guard 20, ota-bootapply 24,
  ota-loop 26, ota-update 52. The OTA converged without a manual hunt: fixpoint **826035** (root manifest and all four
  published manifests agree), play zip **826044**, two consecutive generations byte-identical.
- **RENUMBERING:** the parked donation work moved **70.1.8 -> 70.1.9** while this shipped, and it is no longer blocked
  (see the 70.1.9 section above).


## 70.1.7 (Sep 30, 2026): the DJ Mode loop controls hold, arm while stopped, and stop lying
- **The user's words**: "The loop buttons in dj mode are finicky and don't work". Four causes, and they compounded each
  other. All four are fixed; nothing else about the deck moved.
- **1. THE HOLD PADS LOST THEIR GESTURE, and this is the "finicky" half.** The beat-repeat pads arm a slice on
  `pointerdown` and end it when the pointer comes up - but the DJ sheet scrolls (`.modal{ max-height:82vh;
  overflow-y:auto }`), so the moment a finger drifted the browser claimed the touch for a scroll and fired
  `pointercancel`, and `pointerleave` fired as soon as the finger slid off the pad. The pads had **no `touch-action`**, so
  both happened constantly and the slice died a fraction of a second in. Fix: `touch-action:none` on the four press
  surfaces (`.beat-pad, .fx-pad, .drum-pad, .hotcue-btn` - the app already uses exactly this medicine on its other drag
  handles), `btn.setPointerCapture(e.pointerId)` for the whole hold, and the release list is
  `['pointerup','pointercancel']` with **`pointerleave` removed on purpose** - the same rule the app already states at its
  reorder handles ("no pointerleave-cancel on purpose. On desktop a mouse cursor drifts").
- **2. THE LOOP BUTTON DID NOT WORK WHILE THE DECK WAS PAUSED, AND BLAMED LOADING.** Its guard was
  `if(!deckEngine.buffer || !deckEngine.node)` - and a paused deck has **no node** (`deckStop()` nulls it), so tapping
  LOOP while stopped toasted `Still loading…` about a song that was loaded, and did nothing. A beat pad had the same hole
  (`!deckEngine.running`). Both now only need a buffer, and a loop set while stopped is **armed for PLAY**, which is how a
  CDJ behaves.
- **3. THE LOOP LIVED ONLY ON THE NODE.** `loopStart`/`loopEnd`/`loop` were written straight onto the live
  `AudioBufferSourceNode`, and every restart - scratch, hot cue, pitch - builds a fresh node with no loop points;
  `deckStart()` then switched the LOOP button off so it could not lie. The loop is now a window on the deck
  (`deckEngine.loop`, with `applyDeckLoop()` / `armDeckLoop(len)` / `clearDeckLoop()`), put back on whatever node exists,
  so it survives a restart - and it is dropped, **with the button**, only when a restart lands outside the window.
- **4. THE PLAYHEAD WALKED OUT OF THE LOOP, WHICH IS WHY IT FELT RANDOM.** `deckNow()` is a projection of wall-clock
  time; a native loop sends the **NODE's** playhead back to `loopStart` every pass and the projection knew nothing about
  it. Hold a beat pad for ten seconds and the app's idea of the position had drifted ten seconds ahead of the audio - the
  platter, the play count, the auto-fade countdown, the position a hot cue stores, and above all **the anchor the LOOP
  button itself uses**: tap LOOP after a beat repeat and the loop jumped forward by the length of the hold. `deckNow()`
  now folds the elapsed time back into the window (`pos = lp.start + (pos - lp.start) % span`).
- **Honesty fixes that fall out of the same four**: Loop Lock only says ON once a slice is really armed (it used to claim
  ON, and keep the pad lit, over an empty or paused deck); the pad lights only if arming succeeded (the old order lit it
  first and asked questions later); changing the loop length **while a loop is running** now re-windows it instead of
  doing nothing; and releasing a pad while the LOOP button is on hands the loop back to the button instead of switching it
  off underneath.
- **A SUB-KEY LESSON, THE FIFTH KIND OF SILENT FAILURE.** The per-song reset sub was keyed on `      clearDeckLoop();\n`
  (six spaces) while `deckStart`'s own `clearDeckLoop()` sits **eight** spaces in - so the key was already "satisfied",
  the sub was SKIPPED via `already++`, and half the reset never landed while `patch --check` said nothing was wrong. The
  key is now the line this release adds (`      if(beatRepeatLocked) setLoopLock(false);`). Same family as 70.1's three and
  70.0.8's: **a sub that skips for the wrong reason looks exactly like a sub that worked - read the file, not the
  summary.**
- **REGRESSION WATCH.** `dev/test-705.mjs` **+5 (212 total)** gets `[10d]` (the code shape: the window on the deck, no
  guard needing a live node, the loop fold, the capture, and `touch-action:none`); `dev/studio-70-check.cjs` **+5 (267
  total)** gets `[11j]`, which drives the resting state - a pad `pointerdown` with no deck buffer must **not** light up,
  and Loop Lock must stay `OFF` - plus the stylesheet and the pointer list. **The audio half cannot run in jsdom** (there
  is no Web Audio and no decoded deck buffer), so the audible claim rests on the code and the reasoning above; the probe's
  stray needle that also matched the hot-cue pads' own `pointerleave` cancel was the only gate bug, and it is fixed by
  ending the needle at the handler's `{`.
- **`dev/patch-7017.mjs` / `dev/repin-7017.mjs`**: `APP_VERSION` **70.1.6 -> 70.1.7**, stamp
  `September 30, 2026 \u00b7 3:35 PM EDT` (the clock was 3:39 PM), shell cache `v63.0.42 -> v63.0.43`, a 6-note changelog
  head, **14 edits**; the usual repin (**22 edits across 19 files**, still skipping `test-705.mjs`).
- **RENUMBERED AGAIN:** the parked donation work is now **70.1.8** (`dev/patch-7018.mjs` / `dev/repin-7018.mjs`, stamp
  `September 30, 2026 \u00b7 4:00 PM EDT`, cache `v63.0.44`) - still waiting on the user's hosted donation URL
  (`SC_DONATE_URL`), still refusing to apply without one.
- **THE OTA BUNDLE HAS NO FIXED POINT FOR THIS CONTENT EITHER - the 70.1.6 convergence was the lucky one.**
  `dev/ota-fixpoint.mjs` oscillates **822199 <-> 822200** and exits 1 after eight passes. The shipped state is the same
  shape as 70.1.5's: `ota/update.zip` **822199** (the real size) and `ota/updates.json` + `ota/manifest.json` +
  `updates.json` **822199**; root `manifest.json` **822200** (the seed it was built with - a 1-byte lie in a field
  nothing verifies, exactly like the copy baked inside the zip); `ota-play/update.zip` + `ota-play/updates.json`
  **822206**. Two consecutive `ota-bundle.mjs` / `ota-bundle-play.mjs` runs are byte-identical (checked with `md5sum -c`
  on all seven files), and both `--check`s pass - which is what `deploy.yml`'s `git diff --quiet` and
  `ota-update-check.cjs`'s "a second generation produces the same bytes" actually require. **Check convergence every
  release instead of assuming either answer.**
- **Verified.** test-705 **212**, studio-70-check **267**, test-662 **75**, test-663 49, 6641 128, 6642 75, 66421 49,
  6643 90, 66429 **83** (its one failure before the OTA rebuild is expected - it is the gate that reads the built
  bundle), check-dom 0 failures, ota-guard 20, ota-bootapply 24, ota-loop 26, ota-update 52.


## 70.1.6 (Sep 30, 2026): the select-mode bar stops stacking its label, and the Discover field gets its width back
- **The user's words**: "Fix these bugs UI bugs", with two photos - the library in select mode and the Discover tab. Two
  reports, two fixes, nothing else.
- **1. THE SELECT-MODE ACTION BAR STACKED ITS OWN LABEL, and the arithmetic is the whole bug.** Selecting songs builds a
  `.pane-header` with a label and **seven** action buttons (cancel, add to album, add to playlist, create album, edit
  tags, export, delete). The header is a nowrap flex row in which the label column is the **only** child allowed to
  shrink (`  .pane-header > div:first-child{ min-width:0; flex:1 1 0; }`) and its `h2` wraps anywhere
  (`overflow-wrap:anywhere`). On a phone the seven buttons alone are wider than the row, so the row resolved by crushing
  the label to its one-character minimum: `2 selected` broke to a letter a line - ten lines at 18px, which is the
  ~250px-tall bar in the photo - with the button strip below it. Fix: the script now emits
  `header.className = 'pane-header' + (selectMode ? ' select-bar' : '')` and four rules scoped to `.pane-header.select-bar`
  let the bar wrap (`flex-wrap:wrap`), stop the label shrinking (`flex:0 0 auto` on the first child, `white-space:nowrap`
  on the h2) and let the buttons wrap onto a second row (`flex:1 1 auto; flex-wrap:wrap; justify-content:flex-end` on
  `.pane-actions`). **Scoped on purpose**: every other header keeps the no-wrap single row it relies on.
- **2. THE DISCOVER SEARCH ROW SPLIT ITS WIDTH WITH ITS OWN BUTTON.** `.action-pill` carries **`flex:1`** from the dock's
  pill rule, and the row held the field, a clear button and the Search pill - so **both** the field and the button grew,
  the button took half the row, the field was cut to "Search songs, a" with its placeholder ellipsised, and the clear X sat
  between them as a bare bordered square that was **on screen while the field was empty**. Fix: the field and its X are one
  control now - `#discoverSearchWrap` (relative, `flex:1 1 auto`) with the same round 22px inside-the-right-edge X the
  library box has had since 70.1.5, shown by `#discoverSearch:not(:placeholder-shown) + #discoverSearchClear` rather than by
  script - and `#discoverSearchRow #discoverSearchBtn{ flex:0 0 auto; }` stops the pill growing. The row is
  `align-items:stretch` so the field and the button are one height instead of two. **The library `#searchClearBtn` rule is
  asserted untouched** by the patch, because this is the same idea a release later.
- **Both are layout only.** No song, playlist, album, listening stat, setting or storage key is read or written, so there
  is no data half to this release and no migration.
- **REGRESSION WATCH.** `dev/test-705.mjs` **+3 (207 total)** gets `[10c]` (the stylesheet and the class, which is all a
  text gate can honestly claim about layout); `dev/studio-70-check.cjs` **+7 (262 total)** gets `[11i]`, which **drives both
  rows**: `win.__scEnterSelect(ids)` (the hook that already existed for the gates) and asserts the class list on the header
  the app actually builds is exactly `pane-header select-bar`, that all seven actions are still in it, that cancelling takes
  the mark off, and that the Discover field and its X are one control whose click empties the field. **The Discover tab
  itself is deliberately not switched to** in that probe: showing it starts the chart fetch, which cannot resolve in jsdom
  and would leave an error in the boot log `[12]` asserts is clean - the row is static markup with a real click handler, so
  the driving is the same without the navigation. **That is what the first run of this section proved** (261 passed, 1
  FAILED, `the boot log is clean: Top 25 chart failed`).
- **`dev/patch-7016.mjs` / `dev/repin-7016.mjs`**: `APP_VERSION` **70.1.5 -> 70.1.6**, stamp
  `September 30, 2026 \u00b7 3:05 PM EDT` (built 19:03 UTC = 3:03 PM EDT, so it is in the PAST - a stamp more than
  fifteen minutes ahead fails test-6643), shell cache `v63.0.41 -> v63.0.42`, a 6-note changelog head, **9 edits**; the
  usual repin (**22 edits across 19 files**, still skipping `test-705.mjs`).
- **RENUMBERED AGAIN, and this is now the pattern:** the parked donation work became **70.1.7** (`dev/patch-7017.mjs` /
  `dev/repin-7017.mjs`, stamp `September 30, 2026 \u00b7 3:20 PM EDT`, cache `v63.0.43`). It still needs the user's hosted
  donation URL (`SC_DONATE_URL`) and is verified on a scratch tree only - `node dev/patch-7017.mjs --check` correctly
  refuses without it.
- **THE OTA FIXED POINT CONVERGED THIS TIME - the 70.1.5 caveat does NOT apply to this release.** `dev/ota-fixpoint.mjs`
  settled in **two passes** (`seeded 818875 -> built 818868`, then `818868 -> 818868`) and all five manifests agree: web
  **818868**, play **818877**. Two consecutive `ota-bundle.mjs` / `ota-bundle-play.mjs` runs are byte-identical and
  `ota-bundle --check` says `ota/ is v70.1.6 and complete (6 notes)`. So the 2-cycle that 70.1.5 hit is a property of that
  particular content, not of the toolchain - check it every release rather than assuming either answer.
- **Verified.** test-705 **207**, studio-70-check **262**, test-662 **75**, test-663 49, 6641 128, 6642 75, 66421 49,
  6643 90, 66429 **83**, check-dom 0 failures and audit-calls OK (inside test-705's own sub-gates), ota-guard 20,
  ota-bootapply 24, ota-loop 26, ota-update 52. **test-66429's first run failed on `ota-update-check` (49 passed, 3
  failed) purely because the bundle was still 70.1.5 while `index.html` was 70.1.6** - it is the one gate that reads the
  built bundle, so it is expected to fail between the patch and the OTA rebuild, and it is green afterwards.
- **Not verifiable here.** jsdom measures every element as 0 and cannot apply a stylesheet's flex layout, so the pixel
  half of both fixes is reasoned from the CSS and not measured; what the gates pin is the class the app emits and the rule
  text, and what the probe pins is the markup and the wiring. The two screenshots are the visual claim.


## 70.1.5 (Sep 30, 2026): the streak survives a restore, album covers, a clear button, a wider Add songs sheet
- **The user's words**: "listening streaks didn't transfer over and in albums add the option to change the cover picture
  and in the search bar the actual regular one there needs to be a clear button. And the add songs button the popup
  specifically needs to be wider to not look weird." Four reports, four fixes, nothing else.
- **1. THE STREAK (the real bug, and it is 70.1.4's bug wearing a different hat).** The day streak is not a stored
  number - it is `listenedDates`, a `Set` of `'YYYY-MM-DD'` strings held **in the session** and mirrored to a meta row.
  Both restore paths (the zip's full-state snapshot via `__scSnapHydrate`, and its hand-written `manifest.stats` block)
  wrote the **row** and never touched the live `Set`. So a restored streak read as zero, and then
  `recordListeningDay()` - which saves the live Set plus today - **destroyed the restored history on the very next
  play**. `scAdoptLiveStats(src)` now hands the restored values to the session from both paths; the best-ever streak
  travels with them. This is the same half-a-restore the play counters had in 70.1.4, and the comment at
  `__scSnapHydrate` says so.
- **2. ALBUM COVERS.** `userAlbums[name].cover` is a data URL override, shown instead of the first song's art; a camera
  button on every album card (`albumCoverModal`) sets it from a file or from any song the album already holds. Stored on
  the album entry so it rides the meta row, the zip and the snapshot - **never a blob URL**, those die with the page.
- **3. THE SEARCH CLEAR BUTTON.** `#searchClearBtn` is shown by `#searchInput:not(:placeholder-shown) + #searchClearBtn`
  rather than by script, because five other places empty that field by hand and a script flag would be left behind by
  whichever one forgot. The wide-screen rule that re-pads the field keeps the X its room (`11px 38px 11px 16px`).
- **4. THE ADD SONGS SHEET.** Was `min-width:240px` inside `max-width:calc(100vw - 32px)` - five full-width labels
  squeezed into a narrow column. Now `width:440px` (and `520px` at ≥561px), same centring.
- **REGRESSION WATCH.** `dev/test-705.mjs` **+4 (204 total)** gets `[10b]`; `dev/studio-70-check.cjs` **+7 (255 total)**
  gets `[11h]`, which **drives the clear button for real**: type `song 3`, assert the list narrowed, tap the X, assert
  the field is empty and all 12 rows are back.
- **`dev/patch-7015.mjs` / `dev/repin-7015.mjs`**: `APP_VERSION` **70.1.4 -> 70.1.5**, stamp
  `September 30, 2026 \u00b7 7:30 AM EDT`, shell cache `v63.0.40 -> v63.0.41`, a 6-note changelog head, **17 edits**;
  the usual repin (**22 edits across 19 files**, still skipping `test-705.mjs`).
- **RENUMBERED AGAIN:** the parked donation work became **70.1.6** (`dev/patch-7016.mjs` / `dev/repin-7016.mjs`,
  stamp `September 30, 2026 \u00b7 7:40 AM EDT`, cache `v63.0.42`) - it still needs the user's hosted donation URL
  (`SC_DONATE_URL`), and its applied state is verified on a scratch tree only.
- **THE OTA BUNDLE CANNOT REACH A FIXED POINT FOR THIS CONTENT - KNOW THIS BEFORE TRUSTING `ota-fixpoint.mjs`.** The
  bundle contains the root `manifest.json`, whose `size` is the size of the archive it lives inside, so the size is
  fed back through itself. `ota-fixpoint.mjs` iterates that to a fixed point and **this toolchain's deflate answers a
  ±1 change in those digits with a ±2 change in the archive**, giving the 2-cycle `817528 <-> 817530` and no fixed point
  anywhere in the reachable range (probed 817515..817545: none). 70.1.4's content *was* a fixed point, so this is new.
  The state that was committed: `ota/update.zip` **817528**, `ota/updates.json` + `ota/manifest.json` + `updates.json`
  **817528** (the real size - these are what a client fetches), root `manifest.json` **817530** (the seed it was built
  with, a 2-byte lie in a field nothing verifies, exactly like the manifest baked inside the zip). Two consecutive
  `ota-bundle.mjs` runs are byte-identical, which is what `deploy.yml`'s `git diff --quiet -- ota ota-play updates.json`
  and `ota-update-check.cjs`'s "a second generation produces the same bytes" actually require - **and both pass.**
  OTA sizes: web **817528**, play **817534**.


## 70.1.4 (Sep 29, 2026): "Export everything" now really exports everything
- **The user's words**: "Make sure export includes everything all functions of the app".
- **THE ACTUAL BUG.** The app had two full sweeps of its stored data and they were the SAME sweep. One is the
  **on-device mirror** (`sidecut-snapshot.json` in `Directory.Data`): written 1.5 s after any storage change and capped
  on purpose (`MAX_ITEM = 262144` per value, `MAX_SNAP_BYTES = 1000000` for the file) so it stays a cheap safety net.
  The other is the `.zip` a user makes deliberately (`exportLibrary` -> `runZipExport` -> `manifest.state`), and it
  called the same capped collectors - so **every stored value past 256 KB was silently left out of the backup**. On a
  real library those are exactly the rows that grow with use: `trackSidecar` (play counts, loudness gains, the seek
  waveforms) and the artist/album cover maps (`sidecut_ahCovers`, `sidecut_ahCoversMirror`, `sidecut_ahArtCacheMirror`).
- **THE FIX.** Two uncapped collectors, `collectLocalStorageForBackup()` and `collectMetaForBackup()`, used only by
  `window.__scSnapCollect` (i.e. the backup). **The mirror keeps its caps** - they are the only reason it is cheap. The
  uncapped sweeps still skip the app's own page HTML: `versionSnapshot_<v>` rows (~1.8 MB each), `sidecut_pinned_snapshot`,
  the `discPopupCache_*` caches and the ephemeral beacons (`scLastOp`/`scLeftFgAt`/`scAliveAt`/`sidecut_ahPending`/
  `bgImportState`). The call site keeps the name `__scSnapCollect` on purpose: the **play-build gate** greps for
  `manifest.state = await window.__scSnapCollect()`.
- **THE SONGS.** `buildTrackRecord()` writes `cropped`, `originalDuration` and `manualOverride` per song, and the export
  manifest listed **every field except those three** - they are not in the sidecar either, so a song restored on a new
  phone came back trimmed with **no "Undo crop"** left and a hand-corrected tag forgotten. `manifest.tracks` now carries
  all three, the import builds a new song with them, and the merge onto a song that is already here fills only what the
  device does not have.
- **REGRESSION WATCH.** `dev/test-705.mjs` **+6 (200 total)** asserts the two collectors exist, that the export uses
  them, that the mirror still has its two `MAX_ITEM` skips, that `sidecut_pinned_snapshot` is still kept out, that the
  export list carries the three fields and that the merge reads them. `dev/studio-70-check.cjs` gets **`[11g]` (248
  total)**: it writes a 300 KB localStorage value and a 300 KB meta row through the app's own `__scSnapHydrate`, then
  asks the collector the export calls for them back - so the cap that used to eat them cannot return unnoticed.
- **`dev/patch-7014.mjs` / `dev/repin-7014.mjs`**: `APP_VERSION` **70.1.3 -> 70.1.4**, stamp
  `September 29, 2026 \u00b7 9:55 PM EDT` (built 01:55 UTC = 9:55 PM EDT), shell cache `v63.0.39 -> v63.0.40`, a 6-note
  changelog head, **12 edits**; the usual repin (**22 edits across 19 files**, still skipping `test-705.mjs`). OTA fixed
  point **813870** (web) / **813877** (play), five manifests agree.
- **RENUMBERED:** the parked donation work became **70.1.5** (`dev/patch-7015.mjs` / `dev/repin-7015.mjs`) because it
  ships after this one - it still needs the user's hosted donation URL (`SC_DONATE_URL`).


## 70.1.3 (Sep 29, 2026): Premium is removed, everything it locked is free, Donate stays
- **The user's words**, in two messages: "Remove it remove premium only thing is keep donations" and then, after the
  Lemon Squeezy store signup served a 429 and the slug field kept rejecting `SideCut`, "Remove premium make everything
  free keep donations". The store was never created, so 70.1's `LICENSE_CONFIG.checkoutUrl` shipped empty and then left
  with everything around it. **This release is the removal, not a switch**: the cheap version - make `isPremiumActive()`
  answer `true` and walk away - leaves four ways to buy a thing that cannot be bought and a gate on every screen.
- **WHAT WENT.** (1) **Every gate**: 27 `if(!isPremiumActive())` guards in four shapes (own line, inline, spread over
  braces, brace-less one-liner), the Discover tab's refusal, the pinned-artists bubble, the theme tile's lock and FREE
  tag, the Sandbox PRO toggles, word-by-word lyrics, the PRO scroll pace, the boot library view, the background
  discovery fetches and the Quick actions Discover button. (2) **The Premium surface**: the tab, the whole pane (plan
  cards, gift-code box, paste-a-license-key box, transfer copy, cancel/remove buttons), the settings-dropdown option,
  `SETTINGS_TABS`/`LABELS`, the quick-action meta and the assistant's tab list. (3) **The money**: `isPremiumActive`,
  `getPremiumInfo`, `setPremiumActive`, `clearPremium*`, `PREMIUM_HMAC_KEY_B64`, `verifyPremiumCode`, `b64ToBytes`,
  `bytesToB62`, the whole `LICENSE_CONFIG` + licence module (`licensePost`, `activateLicenseKey`, `revalidateLicense`,
  `releaseLicenseActivation`, `licenseShaped`, `licenseInstanceOfThisStore`, `offerLicenseOrPlayStore`, `openExternal`),
  `PLAY_SUBSCRIPTION_PRODUCT_ID`, `PLAY_LIFETIME_PRODUCT_ID`, `PLAY_SUB_GRACE_MS`, `syncPlayEntitlement`,
  `nativePurchasesAvailable`, `purchasePlaySubscription`, `purchasePlayLifetime`, `refreshPremiumUI`, `initPremiumTab`,
  `openPremiumSettings`, and the published hooks `__scIsPremium` / `__scGrantPremium` / `__scLicenseRedeem` /
  `__scLicenseCheck` / `window.isPremiumActive` / `window.openPremiumSettings` / `window.syncPlayEntitlement`.
  (4) **Premium in the backup**: `buildPremiumPayload`, the manifest's `premium` field and the import-side restore, plus
  the export-confirm checkbox. An old `.zip` that still has the field is ignored on the way back in.
- **THE GATES ASSERT THE ABSENCE, WHICH IS A STRONGER CLAIM THAN THE ONE THEY MADE.** `dev/test-705.mjs` now carries the
  invariant list: `isPremiumActive`, `sidecut_premium`, `LICENSE_CONFIG`, `PREMIUM_HMAC_KEY_B64`, `PREMIUM_STORAGE_KEY`,
  `activateLicenseKey`, `revalidateLicense`, `licensePost`, `buildPremiumPayload`, `manifest.premium`,
  `syncPlayEntitlement`, both Play product ids, `__scGrantPremium`, `__scIsPremium`, `__scLicenseRedeem`, `premium:true`,
  `data-act="openpremium"`, `isPro(`, `proOnly(`, `premiumStudioHtml` and the Premium pane's three ids must all count
  **zero** in `index.html`. The same list is repeated as `mustNot()` inside `dev/patch-7013.mjs`, which refuses to write
  if any of them survived. **A comment counts as an appearance** - the first run failed on this file's own bridge
  comment naming `__scIsPremium`, which is why that comment now says "the ask and the mint" instead.
- **WHAT HAD TO SURVIVE IT: DONATE.** The tip tiers, their product map, the Play sheet and the tab are untouched - a tip
  unlocks nothing on purpose, which is exactly right now that nothing is locked. The one thing added is a **route out
  for a copy that cannot bill**: the APK and the browser used to get a sentence about Google Play and nothing to click,
  and they now open the Play listing, because that install is still the only place a tip can be made. **This is the
  piece that is not finished**: donations still cannot be given on the APK itself, and the fix is a web donate link
  (see the 70.1.5 note below).
- **THE 201st BADGE.** The wall is still 201 tiles with the same five reward rows; the last one was the table's only
  reward with a side effect (a grant of Premium) and it is `kind: 'complete'` - "The whole wall" - now. `grantRewards`
  still runs on every evaluation of the count and still records `LS.reward` under its original storage key
  `sidecut_reward_premium` (renaming it would re-celebrate for everyone who already finished the wall, which is worse
  than the word staying in one constant).
- **TWO SUB-AUTHORING BUGS THIS RELEASE FOUND IN ITSELF, BOTH SILENT.** (1) **A `cut()` whose `from` IS a closing
  brace**: the gift-code/licence deletion started at `  }  // base64 -> Uint8Array` (the line that closes
  `purchasePlayTip`) and deleted it, so the IIFE sixty lines above lost its end and **four gates died on the same
  parse error**. Fixed by putting the brace back in `opts.keep`, and the lesson is in the code comment. (2) **A sub that
  drops the trailing newline of its anchor joins two lines, and the join parses** - eleven of them, none visible in a
  green test run. `sub()` now refuses `oldStr` ending in `\n` with a `newStr` that does not (unless `newStr` is empty,
  which is a whole block coming out and SHOULD take its newline with it). Both are the same family as 70.1's three.
- **A GATE-READING LESSON.** `dev/test-705.mjs`'s `count()` takes ONE argument and reads `index.html`; the two-argument
  call `count(src, x)` that 70.1 wrote was a **tautology** (`src.split(src).length - 1` is always 1), so a check meant to
  fail could not. The new rules use the one-argument form.
- **`dev/patch-7013.mjs` / `dev/repin-7013.mjs`** (70.1.3 -> 7013): `APP_VERSION` **70.1.2 -> 70.1.3**, stamp
  `September 29, 2026 \u00b7 7:54 PM EDT` (built 23:54 UTC = 7:54 PM EDT), shell cache `v63.0.38 -> v63.0.39`, a 6-note
  changelog head, **141 edits**. `repin-7013` is the usual sweep (**22 edits across 19 files**) and still SKIPS
  `dev/test-705.mjs`. **`--check` here reads the version rather than carrying a `key` on ninety subs**: on a tree already at
  70.1.3 it says so and exits 0. On a tree that is not, it names every anchor that moved, which is how this release was
  built.
- **Five older gates pinned the paywall and were repointed, not deleted:** `test-663` (the `showSettingsTab` fold now
  includes `|| tab === 'premium'`), `test-6641` (`[3]` is "every animated theme is free now" - all fourteen present,
  `premium:true` count zero, no lock left), `test-6642` and its own copy inside `test-6641` (eight tabs, Donate third,
  More last, and both `$('settingsPanePremium')` anchors moved to `Expand`), and `test-66422/66423/66424/66425/66426`
  (the accent-fill count `>= 15` -> `>= 14`: the fill it lost was on the **Cancel subscription** button in the pane).
- **`index.html` also still carries the word "premium" in history and in one constant** (the changelog's older entries,
  `LS.reward = 'sidecut_reward_premium'`, and two "this used to be" comments). That is deliberate - the wall keeps its
  past, and a storage key is not a paywall.


## 70.1.2 (Sep 29, 2026): Studio grows up, and Premium gets something to be
- **The user's words**, the two asks left over from the same message as 70.1.1: "add more features to studio" and "make
  their an actual reason to get SideCut premium".
- **WHAT WAS ADDED, AND WHY THESE FOUR RATHER THAN ANOTHER KNOB.** (1) **A sleep timer** (off / 5 / 15 / 30 / 45 minutes /
  end of this song / end of the queue) - the one thing a player is asked for that Studio is the natural home for, needing
  no new permission, and useful every single day rather than another effects slider. It is **free on purpose**: a timer
  that stops your music is not a creative tool and nobody should pay to fall asleep. (2) **A practice loop** (Premium) -
  set A and B on the song that is playing and that section repeats; switch the ramp on and it speeds up a little every
  other pass, which is how a part is actually learned. (3) **Your own presets** (Premium) - the built-in presets are a
  taste of what the chain can do, this is saving the chain you actually arrived at under your own name. (4) **A "Studio
  Premium" section**, shown only while Premium is off, naming what Premium adds **in Studio** - because the old pitch lived
  in Settings and the value of it was invisible from where it is used.
- **NOTHING THAT WAS FREE GOT CAPPED TO SELL IT.** The loop recorder still layers as many loops as you like, every tool is
  still open to everyone, and **the wall is still exactly 201 badges with the same five rewards** at 50, 100, 150, 200 and
  201 - adding features must not move anybody's progress or un-complete a wall somebody finished. The practice loop's
  sheet is not hidden from free users; **starting** the loop is the paid part and the sheet says so. The premium half is
  additive, which is the only honest way to sell an app that already gave the rest away.
- **THE ENTITLEMENT IS ASKED FOR, NEVER COPIED.** `isPro()` in the Studio module asks the app (`window.__scIsPremium`),
  which is the only part that knows about a Play purchase, a licence key, a gift code and the badge wall. There is one
  answer to one question, so the module and Settings can never disagree about whether Premium is on. This is the same
  rule 70.1 established by keeping the licence logic in `index.html` and this is the second place it applies.
- **THE TITLE MAY NOT SAY "pass".** test-6642 and test-66421 refuse the word in any changelog title from 60 onward - it
  was used for whole releases ("a polish pass") and stopped meaning anything. The practice loop really does repeat a
  pass, so the word is allowed in a **note** and the title was reworded off it (the patch carries the `OLD_TITLE` it
  heals). Same family of lesson as the 70.1 test-70 rewrite: know which string the rule is actually about.
- **`dev/patch-7012.mjs` / `dev/repin-7012.mjs`** (70.1.2 -> 7012): `APP_VERSION` **70.1.1 -> 70.1.2**, stamp
  `September 29, 2026 \u00b7 5:40 PM EDT` (built 21:40 UTC = 5:40 PM EDT), shell cache `v63.0.37 -> v63.0.38`, a 6-note
  changelog head, the module section and its wiring, the gate edits, and `--check` reporting **0 to apply / 17 already in
  place** once done. `repin-7012` is the usual sweep (**22 edits across 19 files**) and still SKIPS `dev/test-705.mjs`
  (the 70.0.5 gate's own version pins stay; only its shell-cache pin moves).
- **Verified.** test-705 **201 all passed** (4 new, and the sub-gate that had been failing is green now), studio-70-check
  **268** (driven on the real app), test-70 pass, 662 **75**, 663 49, 66431 95, 6643 90, 66429 83, 66428 73, 66427 82,
  66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 651 35, 612/6136/6137/6138/6139 all
  pass, check-dom 0 failures, audit-calls OK (6835 line comments), ota-guard 20, ota-bootapply 24, ota-update 52,
  ota-loop 26. OTA at a true fixed point: `ota/` **827922**, `ota-play/` **827931**, all five manifests agree, both
  `--check`s OK with 6 notes, `patch-7012 --manifest` reseeded the root manifest.
- **THE WHOLE CHAIN REPRODUCES FROM THE TIP, and this is the check worth repeating.** `git archive HEAD` (the committed
  70.0.9 tree) into a scratch dir, copy the untracked `dev/patch-70*.mjs` / `dev/repin-70*.mjs` in, symlink
  `node_modules` to the root checkout's, then run `patch-701 -> repin-701 -> patch-7011 -> repin-7011 -> patch-7012 ->
  repin-7012` and the OTA chain. Result: **`index.html`, `sw.js`, `dev/sc70-module.js`, all four gate files and all five
  OTA manifests are byte-identical**, the fixpoint converges to the same 827922 / 827931, and the only bytes that differ
  are the **permission bits recorded inside the zips** (`0x81a40000` = 0644 vs `0x81b40000` = 0664, the umask of whoever
  wrote the files) - entry names, entry contents, sizes, normalised timestamps (2020-01-01 00:00) and deflate output are
  all identical. A mode bit is not part of the release; nothing in the app or the updater reads it.


## 70.1.1 (Sep 29, 2026): the Studio tab says you are in it, and the badge wall stops being stale
- **The user's words**, two reports about one screen: "Studio tab don't highlight like the other tabs do when you click
  on them" and "fix the badges not working when you reach the goal".
- **THE TAB WAS ONE MISSING SELECTOR, and the honest version of the bug matters.** `navigate()` has always marked the
  current pill - `$('studioBtn').classList.toggle('active', isStudio)` - but the rule that **paints** a lit tab was
  `#discoverBtn.active, #homeBtn.active{ background: var(--coral); ... }`. Home and Discover were in it, Library lights
  its own two halves (`#playlistsHalf` / `#albumsHalf`), and Studio had **no rule at all** - so Studio carried the class
  that said "this is the current tab" and was the one tab that never showed it. The fix is `#studioBtn.active` added to
  that selector, in `index.html` (this is **not** in `dev/sc70-styles.css`; do not go looking for it there).
- **THE WALL WAS A STALE PAINT, NOT A BROKEN BADGE.** The grid is drawn by `renderStudio()`, which is expensive - it walks
  the whole library for the stats behind 201 badges - so it is drawn when the view is built and again on
  `visibilitychange`. `checkAchievements()` recorded the badge, saved it, toasted it and granted any reward, and then
  **left the screen alone**. Tapping a dock tab is **not** a visibility change either, so opening Studio did not repaint.
  That is exactly what "the badges not working when you reach the goal" looks like: **the state was right and the picture
  was old** - a badge that had already been earned, saved and celebrated missing from the wall in front of you, with the
  header, the ring and the tile all still showing an earlier count.
- **THE FIX, AND WHY IT IS NOT A REPAINT ON EVERY COUNTER.** `badgeRepaintIfVisible()` (immediately before
  `checkAchievements` in the module) does nothing unless the Studio view is the one on screen:
  `var host = $('studioView'); if(host && host.classList.contains('active')) renderStudio();`. It is called from
  `checkAchievements` when `fresh.length` - i.e. only when something was actually earned - and `wireAppWatch()`'s click
  handler repaints on a `#studioBtn` tap. Walking the library stays expensive, and a counter that moved with Studio
  closed still costs nothing.
- **A GATE-AUTHORING LESSON, THE FOURTH KIND OF SILENT FAILURE.** The needle was written as
  `contains('active')` **inside a single-quoted JS string** in the probe, so the escapes came out as
  `contains(\'active\')` and the file died with `SyntaxError: missing ) after argument list` before a single check ran.
  Repaired with a **`heal()`** whose backslashes are built with `String.fromCharCode(92)`, replacing the needle with the
  quote-free `countMod('host && host.classList.contains')`. Same conclusion as 70.1's three: a broken needle can look
  like a passing check, so read the file and not the summary.
- **`dev/patch-7011.mjs` / `dev/repin-7011.mjs`** (70.1.1 -> 7011): `APP_VERSION` **70.1 -> 70.1.1**, stamp
  `September 29, 2026 \u00b7 5:11 PM EDT`, shell cache `v63.0.36 -> v63.0.37`, a 6-note changelog head, the CSS selector,
  the module repaint + wiring, the gate edits, and `--check` **0 to apply / 10 already in place**. `repin-7011`: **22
  edits across 19 files**, still skipping `dev/test-705.mjs`. Gate edits: test-705 **+4**, and studio-70-check gained
  `[11d] a badge that reaches its goal shows up on the wall` - it clicks `#studioBtn`, bumps the `studio` counter until
  the count crosses a goal, calls `checkAchievements(true)`, asserts the hero text and `.sc-badge.have` agree, then writes
  `'STALE'` into `.sc-hero-badges`, switches tabs and back, and asserts it was redrawn. **245/245** at the time.
- **OTA** at the 70.1.1 fixed point: `ota/` **823061**, `ota-play/` **823069**, all five manifests agree, both `--check`s
  OK with 6 notes.


## 70.1 (Sep 29, 2026): the APK gets a way to be paid for (license key + web checkout)
- **The user's words**, after being told Play Billing cannot sell to a sideloaded build: "Why won't it work on the apk can't we
  do smth else", and then the choice they made: "APK payment: License key + web checkout" / "Processor: Not sure yet".
- **WHY PLAY CANNOT DO IT, AND THAT IT IS NOT A WIRING BUG.** Play Billing is not a payment API the app calls - it is a
  purchase made THROUGH the Play Store, and the Play Store only sells for a package it recognises as its own, **installed by
  Play**. Two hard gates: (1) the package must exist in Play Console, or `launchBillingFlow` / the product lookup comes back
  `BILLING_UNAVAILABLE` / "not configured for billing through Google Play"; (2) **the APK distributed here is the OTHER
  flavour** - `com.SideCut.myapp.full`, a deliberately different package id so it installs side by side with the Play copy,
  which **is not on Play at all**. There is nothing to charge for. No amount of code fixes that, which is why the answer has
  to be a second way to pay. The Play path (`play` flavour, `com.SideCut.myapp`) is untouched and still the only route for
  the subscription and the lifetime product bought inside Play.
- **THE WAY TO PAY: the store's own customer-facing license API.** `LICENSE_CONFIG` in `index.html` (next to
  `PAYMENT_CONFIG`) holds `checkoutUrl` plus `validateUrl` / `activateUrl` / `deactivateUrl`, defaulted to **Lemon Squeezy**
  (`https://api.lemonsqueezy.com/v1/licenses/...`). The buyer checks out on the web, the store issues a key and emails it,
  the key is pasted into Settings → Premium, and `activate` records this device as an activation (so the device limit is
  real and the licence can move to the next phone); `validate` is the source of truth afterwards; `deactivate` hands the
  activation back when premium is removed. **Nothing secret goes in the file** - these three endpoints take nothing but the
  key itself, which is exactly why a static, backendless app can use them. Contrast the gift codes: **their HMAC key is in
  the page**, so gift codes are for giving away and this is the paid path. Verified against the live API: a refusal is a
  **404 with a JSON body** (`{"valid":false,"error":"license_key not found."}`), so the body decides and not the status
  code; the response carries `access-control-allow-origin: *`; and `application/x-www-form-urlencoded` + `Accept` is a
  CORS-**simple** request, so there is no preflight to fail. `capacitor.config.json` already sets
  `plugins.CapacitorHttp.enabled = true`, so in the installed app the call never reaches CORS at all.
- **THE ONE RULE THAT MATTERS MOST: a store that cannot be reached must NEVER lock a paying user out.** Only
  `data.valid === false` (refunded / deactivated / expired) clears premium; a thrown `licensePost` returns `false` and
  changes nothing. `revalidateLicense()` asks `validate` only when the last answer is older than `revalidateMs` (7 days,
  the same grace idea as `PLAY_SUB_GRACE_MS`), and it is wired into the three places `syncPlayEntitlement()` already runs
  (launch, `focus`, `visibilitychange`). This is asserted three times over: in test-705 (`// unreachable store: the unlock
  stays, untouched` must be there exactly once), and twice in the probe, which drives a rejecting `fetch` and asserts
  premium is still on.
- **THE REST OF THE WIRING.** `offerLicenseOrPlayStore(msg, url)` replaces the identical three-line tails of **both** Play
  buttons (`all: true` - the two tails are byte-identical): with a checkout configured it says Google Play only works for
  the copy installed from Play and opens the web checkout; with none it is **exactly the behaviour that shipped before**.
  `checkoutUrl` ships **EMPTY** and every button that would open it says the checkout is not open yet rather than opening a
  dead link - so the single line the user still has to fill in is the whole of what is left to do. The buy view gains a
  paste-a-key box (`#premiumLicenseInput` / `#premiumLicenseBtn`) and a `#premiumLicenseBuyBtn`; a key rides inside backups
  (the existing `buildPremiumPayload` already ships `info.code`), and on import `licenseShaped()` sends it down the licence
  branch instead of `verifyPremiumCode()` - restored, then re-checked with the store on the next launch, which is how the
  Play purchase already behaves, except this one really can be revoked. `licenseShaped()` is also what keeps the two kinds
  of unlock apart: `SC-xxxxxxxx-xxxxxxxx` is a gift code and is **never handed to the store as a key**.
- **WHY LEMON SQUEEZY, AND WHAT CHANGING STORE COSTS.** It issues licence keys for a product out of the box, it is a
  merchant of record (so VAT is its problem, not a solo dev's), and its validate/activate/deactivate take **no API key** -
  which is the only reason a static app can call them at all. Changing store is the three URLs, the two optional ids
  (`storeId` / `productId`, 0 = do not check) and the fields the two responses are read with; **no other line in the app
  knows who sold the key.** `dev/license-check.mjs` is the terminal half of the same flow (`validate` / `activate` /
  `deactivate` against the live API, exit 0/1/2) so a key can be tested before a customer ever pastes one.
- **THIS IS A SERIES RESTART, NOT AN INCREMENT: 70.0.9 -> 70.1.** The rule is the page's own ("the third number stops at
  nine: 60.0.9 is followed by 60.1, never 60.0.10"), and the patch/repin numbers are the version without its dots, so
  **`dev/patch-701.mjs` / `dev/repin-701.mjs`** (70.1 -> 701, the same way 64.3 -> patch-643). patch-701: `APP_VERSION`
  **70.0.9 -> 70.1**, a 6-note changelog head, shell cache `v63.0.35 -> v63.0.36`, the configuration + machinery + markup
  + wiring, the gate edits, and `--check` reports **0 to apply / 19 already in place** once done. repin-701 is the usual
  sweep (**22 edits across 19 files**) and still SKIPS `dev/test-705.mjs`.
- **THE RESTART BROKE `dev/test-70.mjs`, AND THE FIX IS THE INTERESTING PART.** test-70 is the 70.0 gate and its `VER` is
  `'70.0'` - it was never repinned, by design - so its two "the build on the page" rules failed on 70.1: one pinned the page
  to `70.0` or a patch on it, the other pinned the literal `/const APP_VERSION = '70\.0(\.\d+)?';/`. The first is widened
  to the series the page's own rule says follows (`/^70\.1(\.\d+)?$/`), and the second literal is replaced by **the rule
  the page states about itself**: the version is `70.x`, the third number never reaches ten, and a new series does not read
  `70.1.0`. (Same lesson as 70.0.9's test-662: widen the rule to what it was always about rather than satisfy it by
  accident.)
- **THREE GATE/PATCH LESSONS, ALL OF THEM SILENT-FAILURE KIND.** (1) **A `sub()` argument list can be broken by two
  inserted lines that forget their `\n' +` continuation** - the concatenation ends early, the following lines become extra
  *arguments*, `opts` silently becomes a plain string (so `opts.key` is undefined and the idempotence guard disappears), and
  the sub applies a **truncated** replacement. Nothing errors; the symptom was the patch's own file check counting two
  `[11c]` markers instead of one, and it was found by noticing the probe's `[11c]` header still on disk while the run said
  "healed". **A sub that skips for the wrong reason looks exactly like a sub that worked - check the file, not the
  summary.** (2) **`x instanceof Function` is false for a function from another realm**: the app runs in the jsdom VM, so
  the probe must use `typeof x === 'function'`. (3) **`encodeURIComponent` is the wrong encoder for a form body** (a space
  goes out as `%20` where a form sends `+`); `new URLSearchParams()` is right, and the tree that already had the old
  construction was repaired with **`heal()`** - which is what heal is for: a correction that must not fail when this tree
  no longer needs it. The probe asserts the activation name is really sent (`/instance_name=SideCut\+/`), so the encoder is
  pinned by behaviour and not by a comment.
- **Verified.** test-705 **186** (14 new), studio-70-check **238** (22 new, driven on the real app: a gift code is never
  sent to the store, a refused key does not unlock, an unreachable store neither unlocks nor locks, an activated key
  unlocks with `plan: 'license'` and the store's instance id kept, a re-check that cannot reach the store keeps a paying
  user in, `valid:false` locks, and a renewed key stays unlocked), test-70 **182**, 662 **75**, 663 49, 66431 95, 6643 90,
  66429 83, 66428 73, 66427 82, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 651 35,
  6139/6138 ALL PASS, 6137 0 failures, 6136/612 all pass, check-dom 0 failures, audit-calls OK (6802 line comments),
  ota-guard 20, ota-bootapply 24, ota-loop 26, ota-update 52. **test-66429's 82+FAIL was the known flake** - it is 83.
  `dev/license-check.mjs` was run against the live store (a junk key is refused by both `validate` and `activate`). OTA at a
  true fixed point: `ota/` **822071**, `ota-play/` **822079**, all five manifests agree, both `--check`s OK with 6 notes,
  `patch-701 --manifest` reseeded the root manifest from `ota/updates.json`.


## 70.0.9 (Sep 29, 2026): the player stops guessing how tall the dock is
- **The user's words**, verbatim, with a screenshot of the app on an **unfolded foldable**: "This is not how it should look on
  a foldable phone there is way to much of a gap". The same complaint as 70.0.7 - and **the first thing to know is that the
  device making it is still running 70.0.6**: nothing has been pushed since `389fe8a` (70.0.6), so 70.0.7's fix, which is
  in this tree, has never reached the phone or the foldable. Before diagnosing a repeat report, check what the device can
  possibly be running.
- **WHAT THE STRIP ACTUALLY IS, and this is why it looks like one tall dark panel rather than a hole in the page**: the
  space between the player's last row and the dock is the player's OWN bottom padding painted with the player's own
  background. `#nowPlaying` is a fixed box whose bottom edge sits exactly on the dock's top edge
  (`bottom: calc(56px + env(safe-area-inset-bottom))` against a dock of `54px + inset` - the SAFE terms cancel, which is
  why the bar's POSITION is right on every device), and everything the box contains below its last row is that padding.
  Before 70.0.7 that padding was `calc(10px + env(safe-area-inset-bottom))` - written when the player WAS the bottom-most
  surface - so the strip was `10px + SAFE`. On a phone SAFE is ~48px (Android 15 draws every app edge to edge; a 3-button
  nav bar reports about that). **On an unfolded foldable the bottom system area is bigger again, so the same 10px became
  10px + a much larger number.** Same bug, bigger inset, worse result - which is the whole of the "it is much worse on a
  foldable" half of the report.
- **THE TWO HALVES, AND WHICH RELEASE OWNS WHICH.** 70.0.7 owns the padding half (only the surface that touches the bottom
  edge reserves the inset - the dock - so `#nowPlaying{padding-bottom:10px}` and its three variants). **70.0.9 owns the
  other half: the 56px guess.** `--sc-dock-h: 56px` is 42px pills plus 6px of padding either side, on a phone, with no
  inset. It is wrong nearly everywhere else: the `min-width:561px/768px/1024px` breaks change the pill and the padding, an
  unfolded foldable reports an inset no phone has, `body.sandbox-compact-nowbar` changes it again, and the Premium "now
  bar size" scales the bar on top of all of it. The player is lifted by `calc(--sc-dock-h + inset)`, so where the guess is
  wrong the player floats ABOVE the dock and the difference is a strip of nothing between the seek row and the dock.
- **THE FIX: MEASURE THE DOCK, KEEP THE GUESS AS THE FALLBACK.** `--sc-dock-h` is not the last word any more -
  `html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real, calc(var(--sc-dock-h) + env(safe-area-inset-bottom))); }`
  is, and the module sets `--sc-dock-real` from `Math.round(strip.getBoundingClientRect().height)` of the real
  `.action-strip` (`measureDock`, published on `SC70`, driven by `watchDock()` from `boot()`: once immediately, on `resize`,
  on `orientationchange`, on a `ResizeObserver` of the dock itself, and again at 250ms and 1500ms because the first paint
  is not trustworthy). The believable range is `DOCK_MIN 30 .. DOCK_MAX 300`; outside it - hidden dock, unlaid-out page,
  or the 0 that jsdom reports for everything - the class is dropped and **the page falls back to exactly today's
  arithmetic**. **The `var()` fallback is not decoration**: if the custom property were ever missing, `bottom` would be
  invalid at computed-value time and the player would fall back to its static position, which is a far worse bug than the
  one being fixed.
- **`dev/patch-709.mjs` then `dev/repin-709.mjs`.** patch-709 bumps `APP_VERSION` **70.0.8 -> 70.0.9**, adds the
  changelog head (6 notes), moves the shell cache `v63.0.34 -> v63.0.35`, adds the measurement to the module and the
  measured rule to the stylesheet, re-splices both, and re-points the new assertions in `dev/test-705.mjs` and
  `dev/studio-70-check.cjs` (**12 edits**, `--check` reports 0/12 when clean). repin-709 is the mechanical sweep -
  **22 edits across 19 files** - and still SKIPS `dev/test-705.mjs`.
- **Two gate lessons from this release, both worth remembering.** (1) **A stamp in the FUTURE fails the build**: the first
  stamp written here was 4:41 PM EDT while the sandbox clock said 3:45 PM, and `dev/test-6643.mjs` asserts "not one of them
  in the future" - so a stamp has to be anchored to the clock the release is actually cut at, and one already applied to
  the page is repaired with `heal()` (the helper patch-708 introduced). (2) **`dev/test-662.mjs` pinned the word "studio"
  in the head entry's notes** ("and it describes what this release did"), which 70.0, 70.0.5 and 70.0.8 all satisfied and a
  release about the player and the dock cannot. The rule underneath it is "the notes name a surface this app actually
  has", so it now reads `/(studio|player|dock)/i` - widened rather than dropped, and never satisfied by writing the word
  "studio" into notes about the dock.
- **Verified.** test-705 **172** (7 new), studio-70-check **216** (8 new, on the real app: an unmeasurable dock leaves the
  guess alone, a faked 132px dock switches the player to the measured lift, a 4000px one is refused and falls back),
  test-70 182, 662 **75**, 663 49, 66431 95, 6643 90, 66429 83, 66428 73, 66427 82, 66426 86, 66425 101, 66424 102,
  66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 651 35, 6139/6138 ALL PASS, 6137 0 failures, 6136/612 all pass,
  check-dom 0 failures, audit-calls OK (5057 declared names across 4 script blocks, 6722 line comments), ota-guard 20,
  ota-bootapply 24, ota-loop 26, ota-update 52. OTA at a true fixed point: `ota/` **816426**, `ota-play/` **816436**, all
  five manifests agree, both `--check`s OK with 6 notes.
- **Reproduction proven, including the gate**: `git archive HEAD` (70.0.6) into a scratch tree, then patch-707, repin-707,
  patch-708, repin-708, patch-709, repin-709 in that order -> `index.html` and `sw.js` byte-identical, `diff -rq dev`
  clean except the hand-written `dev/apk-downloads.mjs` - **and `node dev/test-705.mjs` inside that scratch tree passes
  172/172**, so the whole chain is reproducible from the committed tip.
- **Not verifiable here.** jsdom measures every element as 0 and cannot make `env(safe-area-inset-bottom)` non-zero, so
  the probe drives the mechanism with faked heights rather than a real layout. The device-side proof is the arithmetic:
  the strip is the player's own padding (fixed in 70.0.7) plus whatever the guess got wrong (fixed here, by measuring).
  If a phone or foldable still shows a strip, the first thing to read is whether the build on it is even the one that has
  these fixes - see the note at the top of this section.


## 70.0.8 (Sep 29, 2026): one cropper, the speed slider back, lyrics off per song, and a count of the APKs
- **The user's words**, verbatim, in one message with two screenshots: "Can you build me a seperate apk in git artifacts
  to see how many apks I have downloaded and is their a way play billing can work on the apk?" / "Crop song in studio
  should be like one for songs and where is speed adjuster in song 3 dots menu" / "If the lyrics is not right just add
  an option to disable lyrics for that song". **Four complaints and only one of them is a missing feature**: the crop
  was two different tools under one word, the speed control existed and was being thrown away, the lyrics switch did
  not exist, and the APK count has no home on GitHub's artifacts at all.
- **[1] CROP: THE RULE IS "ONE CROPPER".** 70.0 shipped `openClipSheet()` inside Studio under the card name "Crop ->
  clip" - a clip exporter that writes a NEW tagged MP3 - while the song menu's **Crop song** (`openCropSongModal()`)
  trims the song you already have, in place, with **Undo crop** in the song info sheet. Two things called crop, and the
  one in Studio was not the one the user meant. The Studio card now opens the app's own modal: the Studio block is a
  separate `<script>` and the app is an IIFE, so it goes through a new **`window.__scCropSong(id)`** hook (defined
  next to `__scResume`, implemented as `openCropSongModal(trackById(id))`, `false` when there is no song or no file).
  Module side: `cropCurrent()` (in `dev/sc70-module.js`, right before `openClipSheet`), the tool card `crop`,
  `data-act="crop"` on the now-bar "Crop" button, `openTool('crop')`, and `SC70.cropCurrent`. **The clip exporter was
  not deleted** - it is its own card, "Ringtone / clip", and it still makes a new file without touching the library.
- **[2] SPEED: IT WAS NEVER MISSING, IT WAS THROWN AWAY.** The app builds the three-dot song sheet with a real
  "Playback speed" slider (`#actionSpeedSlider`, wired to `setPlaybackSpeed`, at index.html ~21090). 70.0's grouping
  (`__scDecorSongSheet`) rebuilds that sheet out of its **buttons only** - `host.querySelectorAll('button')` then
  `host.innerHTML = ''` - and the slider is a `<div>` with a range input, so it was discarded every single time the
  sheet opened. The rebuild now collects every non-button child and puts the batch back at the top of the **Play**
  group. Two details that matter: the collection **ignores the module's own `.sc-sheet-group` sections** (a
  second decoration would otherwise nest one whole grouping inside the new Play group), and the batch is inserted
  before ONE anchor so several controls keep their order instead of arriving upside down. The app's inline
  `padding:10px 4px 4px` on that wrapper became `2px 4px 6px`, because it is a row inside a group now, not a sheet.
- **[3] LYRICS OFF, PER SONG.** A wrong match (words for a different recording, or for another song with the same
  title) is worse than no lyrics. New per-track flag **`lyricsOff`**, and four things make it a real switch rather
  than a UI state: it is in **`SC_SIDECAR_FIELDS`** (so it costs no audio rewrite - the same store as `playCount` -
  and it rides along in backups), it is in **`buildTrackRecord`** (so a later full write cannot drop it), **
  `scLyricsRecheckRun` skips it** (otherwise the background pass would re-fetch a switched-off song five times a
  launch), and **`fetchLyrics` returns early** on it - after the manual guess, because manual lyrics are the user's
  own words and still work. One setter, `scLyricsSetOff(track, off)` (published as `window.__scLyricsSetOff` for the
  gates), drives both the new chip `#lyricsDisableBtn` ("Lyrics are wrong - turn them off" / "Turn lyrics back on")
  and the button in the panel `#lyricsOffPanel` it opens. `scLyricsOffPanelHide()` is called from `showLyrics`,
  `scLyricsSayNotFound` and `renderManualLyrics` so the explanation never sits on screen over the next song's words,
  and the song menu's row reads **"Lyrics (off for this song)"** when it is off.
- **[4] APK COUNT: ARTIFACTS CANNOT BE COUNTED, RELEASE ASSETS CAN.** `.github/workflows/android-build.yml` already
  built and uploaded a signed AAB **and** APK per flavor as a workflow artifact, and that is all an artifact can ever
  be: GitHub reports no download count for one and they expire. A **release asset** reports `download_count`, is
  public and does not expire - so the workflow now also publishes each flavor's files to a release (**one tag per
  flavor, `apk-<package.json version>-<flavor>`**, because two matrix jobs creating one release race each other),
  via `gh release create/upload --clobber` with `permissions: contents: write`, and then **lists the assets and fails
  the step by name if the APK or AAB did not land** (the count must not be silently untrackable). Studio reads it under
  **APK downloads** (`GH_REPO = 'AnekTheGreat/SideCut'`, `https://api.github.com/repos/<repo>/releases?per_page=30`,
  summed per `.apk` asset, `data-act="apkread"`), and says so plainly when GitHub cannot be reached instead of showing
  a zero. `dev/apk-downloads.mjs` is the terminal version of the same number (`gh api` first, so a private repo works
  too). **Watch the wording**: `dev/test-662.mjs` refuses the word "download" anywhere in the changelog head's notes
  (the Play policy row over downloader claims), so the note says the APKs have been **fetched** from the release page.
- **PLAY BILLING, ANSWERED.** It is already wired (`@capgo/native-purchases`, `patch-billing.py`, and the fixes in
  `FIX_NOTES.md` - `PLAY_TIP_PRODUCTS`, the `com.android.vending.BILLING` permission, the base-plan `planIdentifier`),
  and it **cannot work on a sideloaded build, by design and by Google's rules**: BillingClient only sells to an app
  that was installed from Play. The `full` flavor cannot buy at all - it is a different `applicationId`
  (`com.SideCut.myapp.full`, so both can be installed side by side) and is not on Play - and outside the plugin the
  purchase buttons fall back to opening the Play listing. The supported path is the **`play` AAB on an internal or
  closed testing track** (free, no review, instant) where the tester installs from the Play link.
- **`dev/patch-708.mjs` then `dev/repin-708.mjs`.** patch-708 bumps `APP_VERSION` **70.0.7 -> 70.0.8**, adds the
  changelog head (6 notes), moves the shell cache `sidecut-shell-v63.0.33 -> sidecut-shell-v63.0.34`, edits the module
  and the stylesheet and re-splices both, and re-points the new assertions in `dev/test-705.mjs` and
  `dev/studio-70-check.cjs` (**42 edits**, `--check` reports 0/42 when clean). It also carries a **`heal()`** helper -
  a correction that must not fail when there is nothing to correct - used twice, because index.html is far too large
  to edit by hand and far too load-bearing to revert: once to rename a helper (`scLyricsOffPanelShow` ->
  `scLyricsShowOff`) whose call site was written against the other name, once to reword the sixth changelog note.
  **Lesson for the next patch**: a `sub()` whose `key` is already satisfied in the tree is SKIPPED, so anything that
  tightens a block an earlier `sub()` in the same patch inserted needs its own follow-up `sub()` (or `heal()`) that is
  keyed on the CORRECTED text - and the earlier sub's key must then be the corrected marker, or it becomes unreachable.
  repin-708 is the mechanical sweep - **22 edits across 19 files** - and still SKIPS `dev/test-705.mjs`.
- **Verified.** test-705 **165** (18 new), studio-70-check **208** (19 new, on the real app: the sheet keeps
  `#actionSpeedSlider` in the Play group, the crop card drives `__scCropSong` by id and reports a build without it,
  lyrics off/on through the sidecar, and the APK panel reporting an unreachable GitHub), test-70 **182**, 66431 95,
  6643 90, 66429 83, 66428 73, 66427 82, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6643 90,
  6642 74, 6641 119, 663 49, 662 **75**, 651 35, 6139/6138 ALL PASS, 6137 0 failures, 6136/612 all pass, check-dom 0
  failures, audit-calls OK (5052 declared names across 4 script blocks, 6708 line comments), ota-guard 20,
  ota-bootapply 24, ota-loop 26, ota-update 52. OTA at a true fixed point: `ota/` **814873**, `ota-play/` **814881**,
  all five manifests agree with the zip they describe, both `--check`s OK with 6 notes.
- **Reproduction proven the repo way**: `git archive HEAD` (70.0.6) into a scratch tree, then patch-707, repin-707,
  patch-708, repin-708 in that order -> `index.html` and `sw.js` **byte-identical**, `diff -rq dev` clean except the
  new `dev/apk-downloads.mjs` - which, like `.github/workflows/android-build.yml` and this file, is hand-written and
  not produced by a patch script.
- **Not verifiable here.** The speed slider and the lyrics switch are asserted against the real app in jsdom (no
  layout engine, no fingers), and the release-asset count needs one real push to `main`: until the workflow runs, the
  Studio panel correctly reports that no APK is attached to a release yet. The billing answer above is the shape of
  Google Play's rule, not a checkout that was completed in this sandbox.


## 70.0.7 (Sep 29, 2026): the player stops reserving the bottom of the screen twice
- **The user's words**, verbatim, sent with a photo of a fresh install (no settings touched, no Premium) beside a
  screenshot of the app as they know it: "On download with no settings changed and no premium why is their a huge gap
  between the media player and tabs when look how it is over here." Real, geometric, and not a settings problem - and
  the tell is in the photo: the phone with the gap is using the **3-button nav bar**, the one that looks right is
  using gestures. That is the whole bug: a bottom inset.
- **THE ARITHMETIC, and every number in it is 70.0.6 as shipped.** `.action-strip` is `bottom:0` with `6px` top and
  `6px + env(safe-area-inset-bottom)` bottom padding over 42px pills, so its top edge is `54px + SAFE` above the
  screen edge; `#nowPlaying` is `bottom: 56px + SAFE` with `10px + SAFE` of its own bottom padding. The visible space
  between the seek row and the dock is therefore `18px + SAFE` - the designed 18px on a device that reports no inset
  (any browser tab, any WebView that is not edge to edge), and **18px + the nav bar** on one that does. The 3-button
  bar made that ~66px: a hole exactly one dock tall, which is what the photo shows. The inset was counted THREE times
  - the dock's own padding, the bar's `bottom`, and the bar's padding. The first two are right.
- **THE RULE: THE BOTTOM INSET BELONGS TO THE SURFACE THAT TOUCHES THE BOTTOM EDGE.** That is the dock, and only the
  dock. `#nowPlaying`'s own `padding: 10px ... calc(10px + env(safe-area-inset-bottom))` was written when the player
  WAS the bottom-most surface (pre-70.0) and survived the dock landing under it. The fix is four declarations in
  `dev/sc70-styles.css`, each restating the padding that case already had - 10px default, 8px at `max-width:360px`,
  6px in short landscape, 6px with `body.sandbox-compact-nowbar` - minus the inset. **On a device that reports 0 the
  page renders pixel for pixel what it rendered before**, which is exactly why 70.0, 70.0.5 and 70.0.6 all shipped it.
- **WHY IT SURVIVED THREE RELEASES, AND WHY IT IS ASSERTED AS A CASCADE.** Every phone this was written and viewed on
  reports no inset, and every layout number the gates can see is identical either way. Android 15 draws every app
  edge to edge, so a Capacitor WebView there reports the real thing (~48px behind a 3-button bar); a device that is
  not edge to edge reports 0. jsdom has no layout engine, so neither the gate nor the probe can measure the gap -
  they assert the CASCADE instead: `dev/test-705.mjs` checks that every `#nowPlaying` rule whose padding still counts
  the inset is overridden by a later rule that does not, that `mustStillReserve(src, '.action-strip')` still holds,
  and that the bar's `bottom` still counts it; `dev/studio-70-check.cjs` asserts the same against the page the app
  actually loads. **A CSS-text check must strip comments first**: the note this release adds names the selector and
  the inset on purpose, and the first cut of the scanner read the note as a rule and found five paddings where there
  are four.
- **`dev/patch-707.mjs` then `dev/repin-707.mjs`.** patch-707 bumps `APP_VERSION` **70.0.6 -> 70.0.7**, adds the
  changelog head, moves the `sw.js` cache `sidecut-shell-v63.0.32 -> sidecut-shell-v63.0.33`, re-splices the module
  and the stylesheet, and re-points both halves of the check. repin-707 is the mechanical sweep - **22 edits across 19
  files** (12 `const VER` pins, the 2 changelog head-line pins in test-6137/6138, the 8 shell-cache literals) - and it
  SKIPS `dev/test-705.mjs`, which keeps describing 70.0.5 while it runs the rule about whatever build is on the page.
- **Verified.** test-705 **147** (8 new), studio-70-check **189** (3 new, on the real app), test-70 **182**, 66431 95,
  6643 90, 66427 82, 6139 all pass, 66429 83, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74,
  6641 119, 651 35, 6138 ALL PASS, 6137 0 failures, 6136/612 all pass, check-dom 0 failures, audit-calls OK (6661
  line comments). OTA at a true fixed point: `ota/` **810021** (was 808950), `ota-play/` **810029** (was 808958), all
  five manifests agree with the zip they describe (ota-update 52, ota-guard 20, ota-bootapply 24, ota-loop 26, both
  `--check`s OK, 6 published notes).
- **STILL NOT MEASURABLE HERE.** The gap itself cannot be reproduced in this sandbox - there is no layout engine and
  no way to make `env(safe-area-inset-bottom)` non-zero - so the only device-side proof is the arithmetic above plus
  the cascade the gates assert. If a phone still shows a strip under the player, the number to move is
  `--sc-dock-h` (56px) against the dock's real height (54px + inset), and the surface to look at is whichever one is
  adding the inset that is already accounted for around it.


## 70.0.6 (Sep 29, 2026): the badges stop asking you to change your songs
- **The user's words**, verbatim, sent with a screenshot of the Studio section of the badge wall (15 songs re-encoded,
  1/5 batch tag runs, 10/50 songs retagged, 5.0/50.0 MB saved by re-encoding): "The badges shouldny do with altering
  your songs". A fair complaint, and that section is exactly what it looks like - every tile in it is paid for by
  permanently rewriting a song the user already has. Re-encoding replaces the stored file in place, the batch tag
  editor rewrites the tags inside the files, cropping trims the audio in place, and the megabytes won back are a side
  effect of the first of those. A wall that pays out free Premium at 201 must not need anybody to edit their own music.
- **THE RULE IS "NOTHING CHANGES A SONG YOU ALREADY HAVE", AND IT COST 14 TILES.** Removed: the five BADGE_COUNTS rows
  and their eleven tiers (`crops` [1, 5], `reenc` [1, 5, 15], `batch` [1, 5], `tagged` [10, 50], `saved`
  [5 MB, 50 MB]), and the three hand-written badges that are the same complaint with a nicer name (`crop_1`
  "Trimmed", `retag_1` "Naming things", `reencode_1` "Space saver"). Also gone: the `reencoded` stat `derivedStats()`
  computed for the re-encode tiers, and three entries in `FEATURE_KEYS` - the capstone badge ("used every feature")
  counted crop, retag and reencode too, so completing it wanted an edit. It is nine features now.
- **THE FOURTEEN REPLACEMENTS ARE MORE RUNGS ON THINGS YOU DO**, two each, so the wall never moves off 201 and the
  five rewards stay at 50/100/150/200/201: plays +1500/2000, hours +110/150, streak +120/180, theme changes +40/60,
  assistant actions +100/200, loops recorded +75/150, Studio visits +100/250. Recording a loop and opening Studio
  change nothing on disk. The threshold TABLES are why this was a fourteen-number change instead of a rewrite, and the
  total (201) is asserted by the gates rather than trusted.
- **THE TOOLS ARE UNTOUCHED.** Crop, the batch tag editor and the re-encoder all still work, with the same Undo chips
  they always had, and the storage cleaner still offers a re-encode button per row. They are simply not achievements.
  The lesson worth keeping: an achievement is a statement about what the app should REWARD, so an optional,
  destructive tool belongs in the tool list and not on the wall.
- **`dev/patch-706.mjs` then `dev/repin-706.mjs`** (after the 70.0.5 trio: patch-705, 705b, 705c). patch-706 edits
  `dev/sc70-module.js` (whole table rows are deleted by SHAPE - a regex on the line - rather than by retyping a line
  full of \uXXXX escapes), the changelog head, `APP_VERSION` **70.0.5 -> 70.0.6** and the `sw.js` cache
  `sidecut-shell-v63.0.31 -> sidecut-shell-v63.0.32`, re-splices the module and the stylesheet, and re-points three
  gates. repin-706 is the mechanical sweep: **22 edits across 19 files** (12 `const VER = '70.0.5'` pins, the 2
  changelog head-line pins in test-6137/6138, and the 8 shell-cache literals) - and it SKIPS `dev/test-705.mjs`,
  which is the 70.0.5 gate and has to keep describing 70.0.5.
- **A RELEASE GATE KEEPS DESCRIBING ITS RELEASE, AND THAT IS THE PATCH'S JOB, NOT THE SWEEP'S.** patch-706 re-pointed
  test-705 exactly as repin-705 did for test-70: it now finds ITS entry by version (`entries.find((e) =>
  String(e.version) === VER)`) and its two "which build is on the page" pins became shape tests
  (`/^\d+(\.\d+)+$/`), so a later release is not made to carry its words. Its new assertions read the module's table
  KEYS (`k: 'reenc'` absent) while the real-app probe reads the badge OBJECTS for the wording - deliberately, because
  this patch's own design note names those tools on purpose and a phrase-based check would have caught the note
  instead of the tiles.
- **TWO GATES HAD BEEN RED SINCE 70.0 AND 70.0.5, AND THIS RELEASE'S SWEEP FOUND THEM.** `dev/test-66427.mjs` asked
  for **four** `sd-glow-pulse` rules and the Vortex reward theme (70.0.5) added a fifth - per-theme, where every other
  dynamic theme shares one. `dev/test-6139.mjs` pinned `entries[0].version === '64.3.1'`, which 70.0 broke by putting
  its own entry at the top. Both are fixed here, and both are the same lesson: **a gate that describes a release must
  read its own entry by version, and a gate that counts something must say why the number is that number.** Neither is
  in the release gate set, which is how two releases shipped over them.
- **IDEMPOTENCE: A KEY HAS TO BE A REAL SUBSTRING OF WHAT THE EDIT WRITES.** patch-706's first run passed and wrote
  the tree; the SECOND run reported 25 "anchor missing" failures, because most `sub` calls carried no `key` at all.
  Keys were added, and one was still wrong - typed from the intended text (`(entries.findIndex(...`) rather than the
  text the edit actually leaves behind (`entries[entries.findIndex(...`). **The proof that a patch reproduces its own
  tree is not the diff: copy every file it touches out of `git show HEAD:<file>` into a scratch tree, run the patch
  there, and `diff` the result against the real one.** Done here - byte-identical for index.html, sw.js, the module and
  the probe, with only the repin-owned cache pins differing, which is precisely what the sweep is for.
- **Verified.** test-705 **139** (4 new), studio-70-check **186** (1 new; driven on the real app, it asserts no badge
  name or sub names a re-encode, a batch tag run, a crop or the space one saves), test-70 **182**, 66431 95, 6643 90,
  66427 82 (was 81 + 1 failed), 6139 all pass (was 1 failure), 66429 83, 66426 86, 66425 101, 66424 102, 66423 52,
  66422 87, 66421 49, 6642 74, 6641 119, 651 35, 6138 ALL PASS, 6137 0 failures, 6136/612 all pass, check-dom 0
  failures, audit-calls OK (6661 line comments). OTA at a true fixed point: `ota/` **808950**, `ota-play/` **808958**,
  all five manifests agree with the zip they describe (ota-update 52, ota-guard 20, ota-bootapply 24, ota-loop 26,
  both `--check`s OK, 6 published notes).
- **STILL NOT MEASURABLE HERE.** Whether the wall now READS as being about the app rather than about editing files is a
  judgment made by playing with it; what is provable, and asserted, is that no tile on it can be earned by changing a
  song. The balance to move if it reads wrong is the per-family rung lists in `BADGE_TIERS`/`BADGE_COUNTS` - they are
  tables for exactly that reason.


## 70.0.5 (Sep 28, 2026): the add-songs pill leaves the dock for a + in the header, and thirty badges grow to 201 with five rewards
- **The user's words**, verbatim, in THREE messages, all released as 70.0.5: "Remove the add songs tab from bottom
  and remove the refresh button from the top and replace that with a plus sign for add songs v70.0.5"; then "Achivements
  should have over 200 of them including 1 secret 1 where you have to enter dev mode in order to obtain them" with free
  themes at 50/100/150 badges, a finger-whirled theme at 200 and free SideCut Premium at all 201; then, straight after
  seeing the wall, "Make the achivements actually possible and without sharing your songs". Two controls moved, one of
  them load-bearing, and the interesting part is what was NOT moved.
- **THE DOCK LOST THE PILL AND ITS WRAP, NOT JUST THE PILL.** `#addSongsWrap` was a flex child of `.action-strip`, and
  `.action-strip > *{ flex:1 1 0 }` is what makes the pills share the row evenly. Deleting only the `+ Add songs ▾`
  button would have left an invisible wrap still holding a fifth share of the width - the row would have looked
  4-wide with a phantom gap in it. The wrap goes with the pill; the dock is `homeBtn, libraryBtn, discoverBtn,
  studioBtn` as direct children, in that order.
- **THE MENU STAYED IN THE DOCK'S SUBTREE ON PURPOSE.** `#addSongsMenu` and `#addSongsBackdrop` were children of the
  wrap and are now children of the strip itself. They are `position:fixed`, so their DOM home does not move them on
  screen - but `.action-strip.menu-open{ z-index:300 }` (added with 70.0) is what lifts them over the player, since
  `#nowPlaying` sits at `z-index:20` and the dock at 25. Move them out to body level and the lift is gone. Nothing
  about the menu's 5 entries, its centred position or its tap-outside-to-close changed.
- **The header + takes the refresh button's own slot**: same `.icon-btn` class, same `flex-shrink:0`, same place in
  `<header>` between the bell and settings, with `title="Add songs"`. Only the id, the tooltip and the glyph differ,
  so the header cannot drift apart. The refresh button's `location.reload()` wiring went with it - it read an id that
  no longer exists, which is exactly what `dev/check-dom.mjs` is written to catch.
- **The copy kept its words and lost its caret.** 13 places said `+ Add songs ▾ → + Files`; the caret is the glyph for
  "this opens a menu" and there is no longer anything wearing it, so it is dropped and the sentence stays. That
  choice is not cosmetic: five older gates (`test-6052`, `test-6054`, `test-6058`, `test-619`, `test-play-copy`) assert
  the words `+ Add songs` and `+ Files` in the how-to text, and the button's tooltip plus the menu's own title are
  still "Add songs" - so the instructions point at something that really exists and the gates stay true.
- **The Studio header no longer pins a release.** `sc70-module.js` had `var VERSION = '70.0'` and printed it on the
  Studio screen; the app already publishes `window.APP_VERSION`, and the module is spliced AFTER that block, so it now
  reads it (falling back to the old literal). Otherwise a 70.0.5 build would have shown "70.0" on its own Studio page.
- **Release machinery**: `dev/patch-705.mjs` (13 anchored edits, idempotent, `--check`, `--manifest`) moves the two
  controls; `dev/patch-705b.mjs` is the achievements half (the reward themes, the live gating, the Premium grant, and
  the module + CSS re-splice); `dev/patch-705c.mjs` is the follow-up that makes the wall earnable (below). Run order is
  705 then 705b then 705c - all three write into the same head entry, so it grows rather than being rewritten, and all
  three are idempotent and report on the tree a run WOULD produce. `dev/repin-705.mjs` (26 edits across 18 files: 13
  `const VER` pins, the 2 changelog-head-line pins, the 7 shell-cache literals) re-points the older gates by SHAPE, so a
  point release does not break them for no reason. `dev/test-705.mjs` is the release gate at **135 checks**, and it
  drives everything test-70 does except test-70 itself, so neither gate runs the other's probe twice. `dev/test-70.mjs`
  is re-pinned by SHAPE - it still DESCRIBES 70.0 and its ten notes, while reading that entry out of the array by
  version instead of assuming it is the head. `dev/studio-70-check.cjs` grew 108 -> **185 checks**, driving the real app
  in jsdom: four tabs, the +, the menu opening from up there and its backdrop closing it, the 201 tiles and their nine
  group heads, the 7-tap door, the five reward gates and the Vortex drag.
- **201 BADGES, AND ONLY THIRTY OF THEM ARE WRITTEN OUT.** `dev/sc70-module.js` keeps the original thirty badge
  definitions verbatim and GENERATES the other 171 from two tables - `BADGE_TIERS` (id prefix, label, group, metric) x
  `BADGE_COUNTS` (the rungs a metric is measured at) through `tierBadges()`. A new metric is one row in each table, not
  a hundred edits, and the thresholds can be retuned without touching the badge list. `derivedStats()` is the single
  place every stat is read from (`__scStats()`, the streak, the library, the theme/dynamic counters, the named
  milestones), `BASE_GROUPS`/`GROUP_TITLES` turn them into the nine sections the grid paints (`streak, listen, explore,
  library, studio, assistant, themes, miles, secret`), and `unlockedCount()` is what the rewards AND the gates read -
  never a literal.
- **ONE SECRET BADGE, AND ITS DOOR IS DEV MODE.** `secret_devmode` is `secret: true` in the `secret` group; until it is
  met the group paints `secretTile()` - a single blank tile - so the wall reads as 200 + a question mark rather than 201
  with an empty slot. The door is a 7-tap gesture on `#currentVersionLabel` inside a 1600ms window (`wireDevGesture`),
  and it is deliberately that element: the app already prints its version there and already has its own tap handler, so
  the gesture attaches separately and neither disturbs the other. `setDevMode(on)` writes `sidecut_devmode` AND sets the
  app's own `localStorage.sidecut_testMode = '1'` - an affordance the app already had (`__scTestMode()`) - so leaving
  dev mode clears the flag it set.
- **THE PRE-DEV-MODE BUG THAT WOULD HAVE COST THE PREMIUM: the secret group returned `''` while unearned**, which made
  the wall read as exactly 200 and left the 201st reward unreachable from the grid. The group always renders now and only
  its TILE is conditional (which is also why the now-dangling `g.have ?` before the group's `return` had to go). What
  found it is the check that compares what the tiles say against `unlockedCount()` - the reason the reward gates are
  asserted against the count instead of against a literal.
- **FIVE REWARDS, FOUR OF THEM LIVE RATHER THAN FLAGGED.** `REWARDS` pays at 50 / 100 / 150 / 200 with `cinder`, `quartz`,
  `lumen` and `vortex` (the last `dynamic: true`), and at 201 with Premium. The themes are gated by
  `rewardThemeOK(key)`/`rewardThemeNeed(key)`, which read the count EVERY time a tile is built, so a badge earned hands
  the theme over on the next paint with nothing to unlock - the `themeGroupHTML` tile tag and click gate ask exactly the
  function the Theme tab does. Premium is granted ONCE through the app's own path: `window.__scGrantPremium` calls
  `setPremiumActive({plan:'gifted',gifted:true,source:'badges'})`, the same state a purchase writes, and the recorded
  `sidecut_reward_premium` flag is what stops a badge reset from taking it back. `__scRewardThemeUnlocked` and
  `__scRewardThemeProgress` are the read-only hooks the gates use.
- **THE BUG THAT MADE DEV MODE UNABLE TO SEE ITS OWN REWARD: `grantRewards` sat inside `if(fresh.length)`.** Its job is
  to notice a reward's COUNT, not a newly-earned badge, and the dev-mode self-test ("pretend the whole wall is earned",
  `simAll`, honoured only while dev mode is on) changes no badge's own progress - so the one path that is meant to hand
  out everything never ran it. `grantRewards(!!silent)` now runs on EVERY `checkAchievements()` and returns the fresh
  list.
- **THE VORTEX WHIRL IS A FINGER ANGLE WRITTEN TO ONE CSS VARIABLE.** The theme follows the finger about the screen
  centre - `whirlAngle(e)` is an `atan2` about the viewport centre, `whirlPaint()` writes the degrees to `--whirl-deg` on
  `<html>`, and the momentum carries on through `whirlSpin()` (`vel *= 0.965`) until it stops - while the whole visual is
  `body.theme-dyn-vortex::before`: a `conic-gradient` with `transform: rotate(var(--whirl-deg, 0deg))` and
  `will-change: transform`. **Transform only, no filter** (the 64.2.7 lesson), and `sandbox-reduce-motion` disables it,
  so moving the layer never repaints it. `wireWhirl()` listens on the document but declines any drag starting on
  `#nowPlaying, input, .sc-sheet, .sc-slider`, so the whirl never steals a seek, a slider or the player.
- **THE FOLLOW-UP ASKED FOR STRAIGHT AFTER THE WALL SHIPPED** - "Make the achivements actually possible and without
  sharing your songs". Three tiers could not be earned: (1) the seven album tiers read `d.albums`, which `derivedStats()`
  hard-coded to zero - the stat is now a real union of the album names the songs already carry and the albums built by
  hand, published through the app's own `userAlbums` via the one hook the patch adds; (2) "Blended" read `flags.autodj`
  and nothing ever set that flag - only the counter - so `window.__scAutoDjAlign()` marks the feature; (3) two tiers
  counted the two export buttons, and on a phone an export opens the SHARE SHEET, which is the sharing the user meant -
  they count a library search and a song queued to play next now, both entirely local and wired by the module's own
  delegated listeners. The tallest generated thresholds were pulled down to ceilings a year of real listening reaches,
  because Premium needs ALL 201 and one unreachable tile blocks the reward.
- **THE OTA BUNDLE NOW ITERATES TO A FIXED POINT, AND THAT FIXES A REAL DRIFT.** The root `manifest.json` is itself
  inside `ota/update.zip` and `ota-play/update.zip`, and it carries the size of the bundle it lives in -
  `dev/ota-bundle.mjs` deliberately does not rewrite it (it writes root `updates.json` instead). Seeding it after the
  build therefore left the committed zip carrying a manifest that did not match it, which is why
  `dev/ota-update-check.cjs`'s "a second generation produces the same bytes" failed on the 70.0 tree and passed on the
  next run. `dev/ota-fixpoint.mjs` seeds, rebuilds and repeats until a rebuild produces the size it was seeded with
  (two passes for 70.0.5), and reports every manifest against the zip it describes. Run it as the last build step. At this
  fixed point `ota/` is **808501** and `ota-play/` is **808509**, all five manifests agree with the zip they describe
  (`ota-update-check` 52, `ota-guard` 20, `ota-bootapply` 24, `ota-loop` 26, both `--check`s OK), and the head entry
  publishes its **10 notes**, of which the OTA bundle carries the newest 6.
- **The shell cache moved to `sidecut-shell-v63.0.31`** - its own counter, no app version in it (70.0.5 would have
  carried `70.0`, and two releases sharing a cache name is the bug that check exists for).
- **Still not measurable here.** Whether a four-tab dock looks right at the widths people hold, and how the + reads
  next to the bell on a narrow phone, cannot be judged from this sandbox. The numbers to move if the phone disagrees
  are `.action-strip`'s `gap`/`padding` and the 42px pill `min-height`. The same goes for the OTHER two things this
  release asks of a finger: whether 7 taps inside 1600ms is a comfortable door (the window is the number to move, in
  `wireDevGesture`), and how the Vortex whirl FEELS - jsdom proves the angle arrives in `--whirl-deg` and that a drag on
  a control is never stolen, but the momentum decay (`vel *= 0.965`) and the phrase "whirls with your finger" are
  device judgments, not sandbox ones.


## 70.0 (Sep 28, 2026): THE MEGA UPDATE — Studio, achievements, a batch tag editor, gestures, an assistant that acts, and the app reshaped around a bottom dock
- **This is the release the user asked for by name**, and it is a series restart, not an increment: `APP_VERSION = '70.0'`. The
  rule was already written down at the changelog and is worth repeating where the number is chosen — the third number stops
  at nine (64.3.1 -> 64.4, never 64.3.10), and a whole new series reads `70.0` rather than `70.0.0`. The service worker's
  `CACHE_NAME` moved to `sidecut-shell-v63.0.30` on its own counter, which must never contain the app version (**reversed
  by 71.8** - the cache name IS the release number again, see `## 71.8`).
- **The shape of the app changed: there is a bottom dock now.** Home / Library⧄Albums (one diagonal split tab) / Discover /
  Studio, with the player sitting above it and everything else sized around it (`--sc-dock-h`, `#nowPlaying{ bottom: ... }`,
  the view padding insets and the list pane's bottom inset all read the same variable). Four screenshots of the intended
  result were used as the look reference, and the follow-up feedback on the dock is what the final pills are: `.action-strip`
  pills at 42px min-height, `#libraryBtn{ flex:1.18 1 0 }` so the split tab is only slightly wider than its neighbours.
- **Studio is a whole new tab, and it is deliberately its own file.** `dev/sc70-module.js` is the entire tab - crop and
  export-as-clip, slowed + reverb, karaoke, eight sampler pads, a loop recorder, the storage cleaner, the badge grid - and
  it is spliced into `index.html` as its own top-level `<script id="sc-studio-70">` block. It reaches the app ONLY through
  `window.__sc*` hooks and publishes `window.SC70`; the app reaches it the same way. `dev/sc70-styles.css` is spliced the
  same way, appended last so every rule in it is the last word on the property it sets, and every colour in it comes from
  the theme tokens so all 25 themes restyle it with no theme-specific rule. `dev/patch-70.mjs` applies all of it and
  re-splices its own block in place, so the module stays the editable source of truth rather than a copy in a 2.7MB page.
- **The FX chain is one insert, not five.** `window.__scStudioBuildChain()` returns the nodes (fxIn/fxOut/dry/send/wet/kar/
  loopIn) and `ensureAudioGraph` splices it in once; rate is a single multiplier, `window.__scStudioRate()`, folded into the
  five `playbackRate = playbackSpeed` writes that already existed. Karaoke is the oldest trick there is - an L-R cancel -
  and the reverb is a synthetic impulse response (`makeIR()`), so nothing is fetched.
- **Crop -> share as clip is a second, different crop.** `Crop song` in the song menu still trims in place; `openClipSheet()`
  exports the picked section as its OWN tagged file, which is what makes the same tool a ringtone maker. Writing the tag back
  is real byte surgery: `retagBytes()` strips and rewrites the ID3v2 tag and rebuilds the WAV `fmt `/`data`/`id3 ` chunks.
  Batch tag editing rides the same writer - `openBatchTags()`/`runBatchTags()` only touch the fields that were filled in.
- **The storage cleaner grows a size axis.** `biggestSongs()` sorts by what each track actually occupies and
  `reencodeTrack()`/(`undoReencode()`) re-encode in place at 96/128/160 kbps through the existing cooperative encoder, which
  gained a `kbps` parameter (clamped 32-320, default 192). Nothing is deleted that the user did not pick, and Undo holds the
  pre-re-encode file exactly like the crop flow does.
- **Achievements are measured, never awarded twice.** Thirty badges read `__scStats()` - plays, listen seconds, library size,
  the day streak from `computeStreak()`, the longest streak and night plays - plus `markFeature()` flags written into
  `sidecut_feature_flags` for "first time you used it". Unlocks are persisted once to `sidecut_achievements`, checked on
  boot and again on visibilitychange, and the bar on a locked badge is the progress, not a decoration.
- **The assistant acts.** `window.SCACT.tryRun(msg)` sits behind the existing knowledge base and returns null when it cannot
  act, so anything it does not recognise still falls through to the normal answer. It speaks plain requests: a clip range
  ("crop this from 1:20 to 2:00"), a most-played playlist, a theme by name, karaoke/slowed/nightcore/lofi, the storage
  cleaner, Studio itself, Auto-DJ, batch tags, and next/prev/pause/play.
- **Auto-DJ detects tempo instead of assuming it.** `detectBpm()` runs an energy envelope plus autocorrelation (lags for
  200->60 BPM, folded to 70-190) and returns `{bpm, firstBeat}`; the crossfade is gated by `window.__scAutoDjGate()` so it
  only starts a mix when the remaining time is within one beat, and `window.__scAutoDjAlign()` lines the next track up.
- **Gestures, with the boring guards written down.** Shake-to-skip is devicemotion at a threshold of 26 with a 1600ms
  debounce and a real permission request where one is needed. Swipe is 56px horizontal, ignores anything that starts on a
  control, changes track on the mini player and seeks when the gesture starts on `#miniBar`/`.seek-row`/`.seek-line-wrap`.
- **The 3-dots menu was reorganised, not replaced.** `__scDecorSongSheet()` moves the app's own real buttons into
  Play / Edit / Organize / Share / Danger groups, matching on the label with any leading glyph stripped so the icons the app
  draws do not defeat the match. It decorates the sheet the app already has, so every existing handler keeps working.
- **Verified on the real app, not on a description of it.** `dev/studio-70-check.cjs` drives the whole release inside jsdom
  with a faked AudioContext (full Web Audio surface), URL.createObjectURL and HTMLMediaElement shims, in-window Blobs and an
  8kHz/300s decode stand-in - 108 checks, including a 120 BPM click reading back as 120. `dev/test-70.mjs` is the release
  gate at 182 checks and runs that probe plus the older suites, the OTA guard, `audit-calls.mjs` and `check-dom.mjs`.
  `dev/repin-70.mjs` re-pointed the older gates that read a version or a shell-cache literal by shape instead of by literal
  (49 + 4 edits across 33 + 3 files); `dev/test-66431.mjs`, `dev/test-6643.mjs` and `dev/test-70.mjs` were re-pointed by hand
  and deliberately skipped by the sweep. The page is now 7 inline script blocks, and the two audits that count them
  (`v609`, and the older `v606`/`v607` pair that already failed before this release) are updated/known-failing as such.
- **Both OTA channels carry 70.0.** `dev/ota-bundle.mjs` rebuilds `ota/` and re-seeds `ota/updates.json`, `ota/manifest.json`
  and the legacy root `updates.json`; the root `manifest.json` is seeded from the built bundle with
  `node dev/patch-70.mjs --manifest`. `ota-play/` is rebuilt by `dev/ota-bundle-play.mjs`, which is the only one allowed to
  bake `window.__PLAY_BUILD__` into the zip - a Play install must never receive the sideload bundle.
- **Still not measurable here.** The feel of the dock and of the gesture layer on a real phone - swipe distance, shake
  threshold, how the reverb sits on a car stereo - cannot be judged from this sandbox. They are wired and driven in jsdom;
  the numbers above are the ones to move if the phone disagrees.


## 64.3.1 (Sep 28, 2026): the list stops being rebuilt while you are scrolling it
- **The user's words**, verbatim and in one message: "The scrolling still needs to be smooth it's smooth for like 2
  seconds then gets clunky for the record player when you tap on it". The THIRD report about the list's roughness, and
  the first one I pointed at the right thing. 64.2.5 answered the same complaint by removing a cancel-and-restart from
  the glide that lands on the playing song, and 64.2.7/64.2.9 took the last per-frame work a dynamic theme did out of
  the backdrop; both were real, and neither is what is felt. The roughness is not in the glide - it is in the list the
  glide is moving through.
- **THE CAUSE: A BACKGROUND PASS WAS EMPTYING AND REBUILDING THE WHOLE LIBRARY LIST.** `runAutoEnrich()` runs 2.5s
  after the library loads (every launch - the boot code, `setTimeout(function(){ runAutoEnrich(); }, 2500)`) and fills
  in missing covers and artist names in batches of twenty. **Every batch ended with a plain `renderList()`.** And
  `renderList()` is not a patch-up: `renderListInner()` starts with `pane.innerHTML = ''` and builds every row again -
  row element, inline album art, kebab SVG and event listeners, per song, for a library hundreds of songs deep. Landing
  while the list is being scrolled (or glided to the playing song after a record tap), the rows under the finger become
  new elements, every one of them is rastered for the first time and the list is measured again, in the same frames the
  scroll needs. **"Smooth for a moment, then clunky", 2.5 seconds after launch, is exactly that shape.** Measured on the
  real app with sixty songs that need metadata (a scratch probe, then `dev/listredraw-66431-check.cjs`): the pass built
  **61 rows again** on its own. After this release it builds none.
- **1. THE GUARD: the list is not rebuilt while it is moving.** `scListIsMoving()` is the pane's own two signals - a
  glide in flight (`container.__scScrollAnim`, which the shared engine already leaves on the container and clears when
  it finishes, and which hands control back the instant a touch lands) or a scroll event in the last
  `SC_LIST_MOVING_MS` (120ms), stamped by the pane's OWN scroll handler because element scroll events do not bubble -
  and `renderList()` now goes through `scRenderListTick()`, which re-arms for the next frame instead of drawing while
  that is true. **It is never held longer than `SC_LIST_STILL_MAX` (1200ms)**, counted from the first request (the wait
  clock is only reset when a draw really happens), so a list being scrolled for a long time still catches up and a list
  that is not moving draws in the same frame it always did. Reachable as `window.__scListMoving`.
- **2. THE PASS NOW UPDATES ROWS INSTEAD OF REBUILDING THEM.** A batch knows what it changed
  (`if(updated){ enrichState.updated++; _batchTouched.push(t.id); }`) and `scPatchListRows(ids)` writes the new art and
  the new title/artist text into the rows that are ALREADY on screen - the `.track-art` background and the two lines
  under it, which is the whole of what a cover or an artist read can change. Rows that are not on screen cost nothing:
  they are built with the new data the next time they are. It builds nothing (`innerHTML` does not appear in it) and
  returns how many rows it touched. The Albums half still asks for a redraw, because a song lives there inside an album
  card that carries a cover of its own - and that redraw goes through the guard above, so it waits for the list to be
  still. Reachable as `window.__scPatchListRows`.
- **3. THE TWO RECORD TAPS ARE NEVER MADE TO WAIT.** `scRenderListNow()` cancels a pending frame and draws in the same
  task, ignoring the guard. `jumpToPlayingSong()` and `openAlbumForCurrentSong()` call it right after they navigate,
  because they navigate, wait two frames and then MEASURE the playing row's position (`smoothScrollIn(pane, row)`) or
  look for the album card and expand it. Deferring those would have turned a tap into "Opened All Songs - your song is
  in your library" instead of a glide. **Rule: a user-initiated draw says so; everything else waits its turn.**
- **THE GATE**: `dev/test-66431.mjs` (**94 checks**, including the real-app probe) and
  `dev/listredraw-66431-check.cjs` (**23 checks, driven on the real app**): it opens the library, lets the metadata pass
  run to the end, and asserts the pane was never emptied and no row was built again, that a row the pass did not change
  is still the same element the list made, that a redraw asked for mid-glide (the real engine, given a scroll range) and
  mid-finger (a real scroll event on the pane) is held and lands once the list is still, and that the record tap still
  draws at once. **Regression proof: against `SC_HTML=<64.3 index.html>` it fails 7 of its 23 checks** (no guard, no
  patch helper, 61 rows rebuilt by the pass and 61 more mid-glide).
- **THE OTHER GATES MOVED WITH IT**: `dev/test-6643.mjs` now reads the release it describes by version (`OWNVER = 64.3`)
  while `VER` is the build on the page, so a newer release is not made to carry its words - the same move
  test-66427/66428/66429 got. It keeps its 90 checks. The repin sweep moved the version and stamp pins across the rest
  of `dev/test-*.mjs`; `test-6643` and `test-66431` are skipped by it (each names a release other than the head's), so
  their own pins are written by the patch.
- **THE RELEASE / REPINS**: `APP_VERSION` **64.3 -> 64.3.1**, six-note head entry, title `The list stops being rebuilt
  while you are scrolling it`, stamp `September 28, 2026 · 6:45 PM EDT` (the Eastern time of the release commit - see
  the stamp rule at `APP_VERSION`), `sw.js` -> `sidecut-shell-v63.0.29`. Bundles at a true fixed point: `ota/`
  **764509**, `ota-play/` **764517**, root `manifest.json` = the zip. Full suite green at 64.3.1: 66431 94, 6643 90,
  66429 83, 66428 73, 66427 82, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119,
  663 49, 662 75, 6058 48, 60510 46, 658 63, 651 35, 653 31, 614 108, play 59, play-copy 28, boot-639 45, libhalf 18,
  homecard 26, themepaint 11, notifgroup 27, librarytools 15, railpaint 21, chatvis 26, homepaint 17, ota-update 52,
  ota-guard 20, ota-bootapply 24, ota-loop 26, native-snapshot 13, audit-calls clean, check-dom 0. Only the two known
  baselines remain (`test-617` 1 check, `v60-check` 2 - both identical on pristine `origin/main`).
- **STILL OPEN**: the feel of a scroll on a phone. This release removes provable main-thread work from the frames a
  scroll needs (the pass no longer builds 60+ rows under the finger, and no rebuild lands while the list moves), but
  the device itself cannot be measured from this sandbox. If the roughness survives this build, the next step is a
  device trace rather than another CSS or duration round - 64.2.5 and 64.2.7/64.2.9 already spent those.

## 64.3 (Sep 28, 2026): the half you are not looking at stops being moved, and the ship times are the real ones
- **The user's words**, verbatim and in one message (with a screenshot of Home): "Why does me clicking the record player
  in playlists or albums affect the other, it shouldn't do that it should stay where it is if its at the top it stays at
  the top. The times for the patch notes are incorrect". Two reports, one release. The FIRST is 64.2.6's fix reported as
  still broken - and it was, in a way 64.2.6 could not have covered; the second is a clock, not a feature.
- **1. THE ONE-SHOT 64.2.6 INTRODUCED WAS NEVER GUARANTEED TO BE CLEARED - THAT IS THE WHOLE OF THE FIRST REPORT.**
  64.2.6 gave each half its own remembered position (`scLibScroll`) and wired the "put the scroll back where it was"
  restore to skip itself while `renderListInner._scrollToPlaying` was armed. That flag is a WISH ("land on the playing
  song"), and nothing cleared it reliably: the playlist-tab click armed it unconditionally and AFTER `renderList()`
  (it only worked at all through the rAF that coalesces `renderList`), the Albums half READ it and cleared it never
  (it has no landing of its own), and with no track playing the entire block that clears it is skipped. So the wish
  survived into the NEXT render - a render for the OTHER half - and that half threw its own offset away, then saved the
  stranger's offset as its own on the way out. **Driven on the real app before the fix (`dev/halfplace-6643-check.cjs`,
  SC_HTML=the 64.2.9 build): tap a playlist tab whose list does not hold the playing song, enter Albums, and Albums
  comes up at 900 instead of its own 240 and the app writes NOTHING to the pane (wrote []); Albums' remembered place is
  then overwritten with 900; and after the record tap in Albums, Playlists comes back at 0 instead of 900.** That is
  the report word for word - the half the user was not in moved.
- **2. THE FIX: TAKE THE WISH, DO NOT READ IT.** `renderListInner` takes it at the top (`const wantPlayingJump =
  renderListInner._scrollToPlaying === true; renderListInner._scrollToPlaying = false;`), so no branch and no early
  return can leave it armed; the Albums branch drops the flag from its restore entirely (it can never grant the wish,
  so it always puts its own offset back); and the Playlists branch skips its restore only when it really handed over to
  the playing row (`!landedOnPlaying && ...`, which is the old condition exactly, scoped to the only list that can
  honour it). The tab-arm is gated on `autoScrollToSong` and moved ahead of the `renderList()` it arms. **Rule: a
  one-shot read by a render that has more than one exit path must be TAKEN where it is read, or it leaks into the next
  render - and the next render is usually for the other surface.**
- **3. A TAP IN ONE HALF NO LONGER WRITES TO THE OTHER.** `openAlbumForCurrentSong` resolved - and could CREATE - the
  song's album (via `ensureAlbumSaved` + `markAlbumManual`) BEFORE it checked which half the tap belonged in, so a tap
  made in the Playlists half could add an album to the Albums half on its way to bouncing back to the song jump. The
  half is settled first now. Same family as 64.2.6's "the record tap moved the list you were not in": a tap is an event
  in ONE half and must not touch the other.
- **4. THE SHIP TIMES: EASTERN IS UTC MINUS FOUR, AND THE DATE MOVES BACK WITH IT.** Every entry from 64.2.4 to 64.2.9
  was stamped from a clock read whose DATE did not roll back with the four hours, so 64.2.4 and 64.2.5 carried the day
  after they shipped (their commits are Sep 28 01:40Z / 02:31Z, i.e. Sep 27 9:40 PM / 10:30 PM EDT) and all six carried
  a time hours ahead of the clock the build was made on - a phone reading the bell was shown times in its own FUTURE.
  Each now reads the Eastern time of its own release COMMIT (git `%aI`), which is the only objective record of when a
  release happened: 64.2.4 Sep 27 9:40 PM, 64.2.5 Sep 27 10:30 PM, 64.2.6 Sep 28 6:35 AM, 64.2.7 Sep 28 7:25 AM, 64.2.8
  Sep 28 7:50 AM (7 and 8 shipped in one commit; their 25-minute gap was kept), 64.2.9 Sep 28 5:15 PM. **The rule is
  now written at the `APP_VERSION` comment and in `dev/patch-6643.mjs`: `date -u` minus four hours, with the DATE
  rolling back when the UTC hour is before 04:00.** `dev/test-6643.mjs` section [2] enforces the shape, not the
  literals: every recent stamp parses, the run reads newest-first, and nothing is stamped more than 15 minutes ahead of
  the clock at check time. (Two earlier precedents: `dev/fix-613-date.mjs` fixed a future stamp, `dev/fix-6049-date.mjs`
  a draft-time one - this is the third time a ship stamp has needed a script.)
- **5. THE TRAP THIS RELEASE ACTUALLY FELL INTO, AND THE LESSON.** After the first successful run of
  `dev/patch-6643.mjs` the comment it had just written was re-wrapped for reading - and because a `sub()` step
  recognises its own work BY THE TEXT IT WROTE, the next run no longer saw its block as present and INSERTED A SECOND
  COPY of it, leaving two `const _inAlbums = ...` in `openAlbumForCurrentSong`. The gate caught it instantly ("the half
  is asked exactly once"), and the script now folds the doubled text back to one copy. **Rule: once a patch has been
  applied, never change what it writes - its own output IS its idempotence marker.** If the wording has to change, own
  the repair in the same script (this one does; so does `dev/patch-66428.mjs`'s `BROKEN_HEAD`).
- **6. THE GATES MOVED WITH IT, WITHOUT LOSING A CHECK.** Four older gates (66426, 66427, 66428, 66429) each pinned the
  ONE line both halves restored through; they now look for the PAIR that replaced it, one `ok(` in and one `ok(` out,
  so none of them loses a check (86 / 82 / 73 / 83 unchanged). `dev/test-66429.mjs` was re-pointed the documented way
  (its `launch` / `blank` / `list` + `record` words are read from the 64.2.9 entry by version, like 66427 and 66428
  before it), and its `swCache` pin needed a SECOND repin pattern because it compares the bare
  `'sidecut-shell-v63.0.27'` string with no `CACHE_NAME = ` in front of it. `dev/test-6052.mjs` pins the head stamp
  itself and moved with it. New: `dev/test-6643.mjs` (**90 checks**) and `dev/halfplace-6643-check.cjs` (**27
  checks**, and 5 of them FAIL on the 64.2.9 build - it is a real regression gate, not a description of the new code).
- **7. THE RELEASE NUMBER, AND THE NAME OF THIS RELEASE'S OWN FILES.** The user caught this one: "It should be v64.3
  never .10". It should, and the app says so itself - the `APP_VERSION` comment has always carried the rule **"the
  third number stops at nine: 60.0.9 is followed by 60.1 (never 60.0.10)"** - so the release after 64.2.9 is **64.3**.
  The first draft of this patch shipped as 64.2.10 (it was even named `patch-664210.mjs`), and the fix had to be owned
  by the same script for the reason point 5 gives: the version string is part of the markers the patch recognises its
  own work by. The renumber is therefore the FIRST step of section A (before any block checks whether it is already on
  the page), it rewrites every `64.2.10` on the page - the constant, the head entry, one note, the stamp-rule comment
  AND the version markers inside the comments this patch wrote - and a tree straight from 64.2.9 has nothing to
  renumber. The dev/ files were renamed with it: **`patch-6643.mjs` / `test-6643.mjs` / `halfplace-6643-check.cjs`**,
  which is the repo's own convention (6 + the version digits without dots: 6642 for 64.2, 66426 for 64.2.6, 60510 for
  60.5.10). **Rule: a version number is a version number - check it against the rule the file states about itself
  before it is used as a directory of the work.**
- **BUNDLE FIXPOINT**: `ota/` **761828**, `ota-play/` **761835**, root `manifest.json` **1443 bytes** and its size field
  equal to `ota/update.zip`, both `--check`s OK, three rounds (rebuilt after the last index.html edit) byte-identical.
  Green: **6643 90 (new)**, 66429 83, 66428
  73, 66427 82, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 663 49, 662 75, 6058
  48, 60510 46, 658 63, 651 35, 653 31, 614 108, play 59, play-copy 28, boot-639 45 (v64.3), libhalf 18, homecard
  26, themepaint 11, notifgroup 27, librarytools 15, railpaint 21, chatvis 26, homepaint 17, halfplace 27 (new),
  ota-update 52, ota-guard 20, ota-bootapply 24, ota-loop 26, native-snapshot 13, audit-calls clean (6397 comments),
  check-dom 0 failures. **Only the two known baselines remain: `dev/test-617.mjs` fails exactly 1 ("hits and misses are
  both persisted") and `dev/v60-check.cjs` fails exactly 2 (the v60 bubble order and the RGB tick rate), both identical
  on pristine `origin/main`; v60-check is not in the gate set.** `dev/ota-loop-check.cjs` needs its own run - it takes
  longer than a combined loop allows, and reports 26 passed.


## 64.2.9 (Sep 28, 2026): the update installs itself on launch, and the animated backdrop stops being redrawn
- **The user's words**, verbatim and in one message: "The glitch with dynamic themes and the favorites bubble and pinned
  artist plateau still happens and the ota update should automatically happen on boot no manually clicking install".
  Two reports, one release, and they are RELATED: a phone that never installs an update by itself is a phone still
  running the build before the last fix, so the flicker report cannot be judged until the install report is answered.
  No version was named; the line after 64.2.8 is 64.2.9.
- **1. THE UPDATE INSTALLS ITSELF ON A REAL LAUNCH.** THIS IS THE REPORT THAT WAS REALLY NEW. Every automatic path
  before this one stopped at the update SHEET: the boot check found the newer version, wrote its notes into the card
  and waited for a tap on "Download & install", so the update only ever arrived on a phone whose owner pressed it -
  and every fix that shipped in between reached nobody who did not press it. `autoInstall()` in
  `dev/native-updates.js` closes that gap: fetch (progress in the sheet, same card), `next()`, then `set()` -
  `applyStagedNow()`, the sheet's own Install now, with the force flag OFF, so every guard applies exactly as it does
  when the button is tapped and a track that is playing still defers to app-close instead of being cut off.
- **2. ONLY THE BOOT CHECK INSTALLS - THE OTHER TWO CHECKS STILL ONLY OFFER, AND THAT IS DELIBERATE.** The two reports
  pull against each other (AGENTS.md, 64.2.6 point 3 and dev/ota-loop-check: "I open the app it refreshes
  automatically and I have to click play" vs "can it auto update on boot so I actually get the update"). The
  resolution is the one the staged hand-over already used in v58.9.1: install on a REAL LAUNCH (the `load` event, now
  the boot check with `{ silent: true, auto: true }`) and only there. The 3-hour timer and the foreground resume keep
  `checkForUpdate({ silent: true })` and still just show the sheet - they run while the user is listening to
  something, and a hand-over there is the refresh-mid-use report. **The boot check also RETRIES until `appBooted()`
  (window.toast), because a check against a page that had not booted returned `null` silently - a slow cold start used
  to mean no update check at all.**
- **3. A LATENT BUG THE CHANGE EXPOSED, AND THE FIX (THIS IS THE ONE TO REMEMBER).** The boot check now hands over at
  ~2.5s and the launch hand-over (`_bootTick`) runs at 4s. On a device `set()` reloads in between, so the second never
  sees the first. If `set()` were slow or failed, the old context kept running, `getNextBundle()` still reported the
  bundle we had just installed, and `applyInBackground()`'s "already handed over to once" rule would call
  `markBadVersion()` on a version that is MID-SWAP - refusing that release for ever, which is exactly the "the fix did
  nothing" trap 64.2.8's point 3 and 64.2.6's point 1 are about. `HANDED_OVER_THIS_SESSION` (set in `applyStagedNow`)
  is read in TWO places now: the launch hand-over skips that bundle, and a later non-automatic check (the app runs one
  of its own) neither re-offers it as "staged, Install now" nor marks it. **Rule: an automatic hand-over has to be
  visible to every other path in the same session, or they will "repair" it into a failure.**
- **4. THE FLICKER, PART TWO: THE BACKDROP WAS STILL BEING RASTERED, TWICE, EVERY FRAME.** 64.2.7 removed the animated
  `filter` and wrote that the remaining motion was "transform/opacity only so the compositor runs it without
  repainting" - but `sd-dyn-drift` and `sd-dyn-drift-rev` both animated `scale()` (1.0-1.14) and `rotate()` as well,
  and a SCALE CHANGE IS NOT A COMPOSITOR PROPERTY: the layer has to be drawn again at its new size, and both backdrop
  layers are larger than the screen (`inset:-32%`/`-26%`). That is a fresh raster of a screen-and-a-bit, twice, for as
  long as the app is open, behind every screen in it - the raster/memory pressure a phone answers by dropping the
  paint of the card nearest the edge, which is the six-times-repeated report. Both keyframes are pure `translate3d`
  now (amplitudes grown so the motion still reads), and with no zoom to cover the layers come in to `inset:-20%` /
  `-18%`. **Rule: "transform" is not one thing. translate/rotate are composited; `scale` re-rasters the layer.**
- **5. THE FLICKER, PART THREE: THE ONE REMAINING CANDIDATE 64.2.7 NAMED.** Its "STILL OPEN" note ended with "the
  per-bubble `sd-glow-pulse` (opacity only) is the one remaining candidate that is a child of a clipped, rounded box",
  and that is still true: every Home card holds a `.hb-glow` pulsing for as long as a dynamic theme is on, inside
  `overflow:hidden; border-radius:22px`. `.home-bubble` now carries `contain:paint`, which says every pixel of that
  stays inside the card - same glow, same clip, same corner, and the scroller around it cannot be invalidated by it.
  It is a hint, not a visual change. **The search space 64.2.7 enumerated is now exhausted: the filter is gone (64.2.7),
  the scale and rotation are gone and the layers are smaller (64.2.9), and the last animated child of a clipped box is
  contained (64.2.9).**
- **6. THE GATES MOVED WITH IT, AND ONE OF THEM HAD TO.** `dev/ota-update-check.cjs` (46 -> 52 checks) drove the OLD
  shape - it booted with a newer manifest, read the sheet, pressed the button and asserted the download - so its boot
  section now runs the same client with no tap at all, and the native stub can HOLD THE FETCH OPEN (`holdDownload`) so
  the fetching state (notes, version, progress, NO button) is asserted while it is on screen instead of inferred from
  what is left afterwards. Its `NEXT_VERSION` bumps the LAST segment, so a three-part version (64.2.9) gets `64.2.10`
  instead of falling through to the `99.9` placeholder. Two more pins moved: `dev/ota-loop-check.cjs`'s stale-record
  loop scenario is pinned to `manifestVersion: APP_VERSION` (a genuinely newer bundle now installs itself, so a pure
  stale-record test must not have one in the mix - it still asserts 0 `set()` and 0 reloads over 3 boots), and
  `dev/test-66428.mjs` reads the words it was written about ("things to know", and its own first note) from the 64.2.8
  entry by version, keeping its 73 checks - the rule from 64.2.7 point 4. **`dev/patch-66429.mjs` also had to learn one
  thing about itself: two `sub()` steps inserting in front of the same line broke each other's "already applied"
  marker, and the second run duplicated its own insert. Both blocks are ONE step now, with the marker on the line they
  leave behind.**
- **BUNDLE FIXPOINT**: `ota/` **760347**, `ota-play/` **760354**, root `manifest.json` **1372 bytes** with `size`
  760347 equal to `ota/update.zip`, both `--check`s OK, byte-identical from round 2 on. Green at 64.2.9: **66429 83
  (new)**, 66428 73, 66427 82, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 663
  49, 662 75, 6058 48, 60510 46, 658 63, 651 35, 653 31, 614 108, play 59, play-copy 28, boot-639 45 (v64.2.9),
  libhalf 18, homecard 26, themepaint 11, notifgroup 27, librarytools 15, railpaint 21, chatvis 26, homepaint 17,
  ota-update **52**, ota-guard 20, ota-bootapply 24, ota-loop 26, native-snapshot 13, audit-calls OK (4731 names /
  6367 comments), check-dom 0 failures. (`ota-bootapply` 24, `ota-loop` 26 and `native-snapshot` 13 are the counts a
  PRISTINE `origin/main` checkout reports too - the 25/27/14 in older notes were stale. **Only `dev/test-617.mjs` fails,
  its one long-standing baseline check - identical on pristine `origin/main`. `dev/v60-check.cjs` fails exactly 2 (the
  v60 Home bubble order and the RGB tick rate) and fails them identically against `git show HEAD:index.html`; it is not
  in the gate set.**)
- **STILL OPEN**: the flicker itself is a device-side paint fault and the sandbox cannot reproduce it, so it still has
  to be judged on a phone - but note the ORDER the two halves of this release landed in: the install half is what gets
  this build onto the phone at all. If it comes back again, the three things a dynamic theme animates (64.2.7 point 1)
  are now all translation/opacity or contained, so the next honest step is a real device trace rather than another
  round of CSS.


## 64.2.8 (Sep 28, 2026): the media-player line comes out of Things to know about SideCut
- **The user's words**, with a screenshot of the bullet: "Remove this part from things to know about SideCut". The
  bullet was "The phone's media player can't open SideCut. The notification-shade / lock-screen player can play,
  pause, and skip - but tapping it won't open the app. To get back to the song list, open SideCut from your
  launcher." No version was named; the line after 64.2.7 is 64.2.8.
- **1. THE LINE IS REMOVED WHOLE, NOT EMPTIED.** It is one `<div>` under `<!-- Collapsible: Things to know about
  SideCut -->`, and the trailing newline goes with it, so the list closes up with no row opened where it stood. The
  list goes 12 bullets -> 11 and the file 47 -> 46. **`dev/test-66428.mjs` pins the ROWS, not just the count**: a
  line emptied instead of removed leaves the same 11 markers but a gap between two row numbers, and that is what the
  `bulletRows.every((n, k) => n === bulletRows[k - 1] + 1)` check is for. `dev/test-66425.mjs` pinned the line as
  PRESENT (`and the media-player limitation is still stated`) - it now asserts it is gone, keeping its 101 checks and
  deliberately leaving its `>= 13` bullet counter alone, because one of 47 cannot change what that means.
- **2. THE OLDEST RELEASE THAT RECORDED THE TIP IS NOT TOUCHED.** An earlier changelog entry says the tip was added,
  and a changelog entry is a record of what that release did. `(open it from your launcher)` is still in it;
  `from your launcher` now appears exactly twice (that history line and this release's own note).
- **3. THE FIRST NOTE WITH AN APOSTROPHE BROKE TWO THINGS - the one to remember.** No release before 64.2.8 had an
  apostrophe in a note, so two latent assumptions had never been tested:
  * **The changelog stopped parsing.** `HEAD_NEW` emits `NOTES`, and `NOTES` holds the DECODED text - so emitting it
    into a single-quoted literal produced `'... the phone's media player ...'` and `eval` died with `Unexpected
    identifier 's'`. **Rule: anything that re-emits a note into a quoted literal has to escape the apostrophe**
    (`esc()` in `dev/patch-66428.mjs`). The first run of that script wrote the broken line, so the script also owns
    a `BROKEN_HEAD` repair step for it; a fresh run uses `esc()` from the start.
  * **`dev/notifgroup-6424-check.cjs` pulls the newest note out of the SOURCE with a regex** and compares it with the
    text that was drawn, so the raw `phone\'s` never matched the drawn `phone's` and the probe went red over an
    escape rather than over the app. It `eval`s what it extracted now. **No other gate or probe in `dev/` reads a
    note out of the raw source** - everything else `eval`s the whole block, which decodes escapes correctly.
- **4. THE HEAD-ENTRY WORD CONTRACT, AND THE FIRST BITE TAKEN OUT OF IT.** 64.2.8's notes still carry `rollback`,
  `blank`, `list` and `record` because `dev/test-66425.mjs` and `dev/test-66426.mjs` read the HEAD entry (see 64.2.7
  point 4) - they are written for it, not padded: the list, the row left behind and the record player tip are all
  genuinely part of what this release does and does not touch. What changed is `dev/test-66427.mjs`: it was written
  for 64.2.7 and read `entries[0]`, so repinning it would have made it demand the words "flicker", "pinned artists"
  and "favorites" of THIS release's notes. **The words it was written about are read from the 64.2.7 entry by version
  now - the same rule `dev/test-66423.mjs` and `dev/test-66424.mjs` already follow - while the general wording rules
  stay on the head entry, which is what they are for.** The lever for any future release that wants to go further is
  the same one: point the release-specific words at your own version.
- **BUNDLE FIXPOINT**: `ota/` **757527**, `ota-play/` **757534**, root `manifest.json` **757527** and equal to
  `ota/update.zip`, both `--check`s OK. A true fixed point this time - rounds 2, 3 and 4 are byte-identical, where
  64.2.7 cycled by a byte. Green: **66428 73 (new)**, 66427 82, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87,
  66421 49, 6642 74, 6641 119, 663 49, 662 75, 6058 48, 60510 46, 658 63, 651 35, 653 31, 614 108, play 59,
  play-copy 28, boot-639 45 (v64.2.8), libhalf 18, homecard 26, themepaint 11, notifgroup 27, librarytools 15,
  railpaint 21, chatvis 26, homepaint 17, ota-guard 20, audit-calls clean (4731 names / 6367 comments), check-dom 0
  failures. **Only `dev/test-617.mjs` fails, its one long-standing baseline check - identical on pristine
  `origin/main`. `dev/v60-check.cjs` fails exactly 2 (the v60 Home bubble order and the RGB tick rate) and fails
  them identically against `git show HEAD:index.html`; it is not in the gate set.**


## 64.2.7 (Sep 28, 2026): the colour filter comes off the dynamic-theme backdrop, and the island watches its own scroller
- **The user's words**, two messages: "The favorites bubble issue is a dynamic theme only issue so Is the pinned artist
  flicker dynamic theme only issue" then the correction "I said pinned artist plateau and the favorites bubble are
  affected by slightly disappearing before reappearing with dynamic themes". No version was named; the line after 64.2.6
  is 64.2.7. **THE FIRST ANSWER GIVEN TO THIS WAS WRONG, AND THE CORRECTION IS THE POINT OF THE RELEASE.** Reading the
  island's own CSS finds no `theme-dyn` rule at all on `#pinnedArtistsStrip`, `#pinnedArtistsList` or
  `.pinned-artist-chip`, so the answer given was "the island is not dynamic-theme-gated". That is true of the island
  and false as an answer, because the two surfaces share something that only exists on a dynamic theme.
- **1. A DYNAMIC THEME ADDS EXACTLY THREE ANIMATED THINGS, AND TWO OF THEM SIT UNDER EVERY SCREEN.** Enumerated from
  the stylesheet: every `theme-dyn` rule in this file is one of two things - `body[class*="theme-dyn-"]::before` /
  `::after` (the full-viewport backdrop layers, `position:fixed; inset:-32%/-26%; z-index:-1`) and
  `body[class*="theme-dyn-"] .home-bubble .hb-glow`. Nothing dynamic-theme-gated touches the island, and a chip
  carries no animated child at all. So the island and the Home grid can only be flickering on a dynamic theme for the
  one thing they both have - the backdrop. **When a report says "only on a dynamic theme", enumerate what a dynamic
  theme actually animates, then look for what the NAMED surface shares; do not stop at the surface's own rules.**
- **2. THE FILTER THE V60 NOTE ALREADY SAID SHOULD NOT BE THERE.** Every dynamic theme's `::before` was still
  animating `sd-dyn-hue` (`filter: hue-rotate() saturate()`) in all 13 of its rules - the shared seven-theme rule plus
  the 12 per-theme ones. A filter is not a compositor-only property on a layer this large: it re-runs the paint of the
  whole backdrop, and the backdrop is the one layer every screen sits on. The v60 comment the rules carry already
  describes the intended design as "all of it is transform/opacity only so the compositor runs it without repainting"
  and calls the old mechanism "a filter re-runs the paint on the whole backdrop every frame" - the keyframes and their
  13 uses were simply never removed with that pass. Removing them is therefore both the fix and the completion of a
  documented intent, which is why it needed no product decision: the drift, the counter-moving `::after` and the sheen
  are untouched, so the themes keep their motion and only the continuous whole-backdrop re-paint goes.
- **3. THE ISLAND'S OWN SCROLLER NEVER ASKED FOR A REPAIR.** `watchPinnedRail()` listened on `#discoverView` only. A
  `scroll` event on an element does NOT bubble, and `#pinnedArtistsList` is its own `overflow-x:auto` scroller - so the
  sideways swipe over the chips, the one gesture that moves the island itself, never reached the repair at all. The
  settle body moved into a named `onRailScroll` attached to both scrollers. The nesting depth was preserved on purpose
  (`var onRailScroll = function(){` sits at the same indent as the old `dv.addEventListener('scroll', function(){`),
  so the 10-space shape `dev/test-66426.mjs` pins did not have to move with it.
- **4. THE HEAD-ENTRY WORDING CONTRACT IS CUMULATIVE - THIS IS THE TRAP OF THE REPIN SWEEP.** `dev/test-66425.mjs`
  and `dev/test-66426.mjs` read the HEAD changelog entry, so the repin sweep turns them into gates on the NEWEST
  release's notes. 66425 wants `blank` in them; 66426 wants `list` AND `record`; `dev/test-6642.mjs` and
  `dev/test-6641.mjs` want `rollback`. The 64.2.7 notes are written to satisfy all of them deliberately, not by
  accident. Older gates read their own entry by version with a regex and are unaffected.
- **5. THE FILE TOOLS CANNOT TOUCH index.html - USE THE PATCH SCRIPT INSTEAD.** In this environment `write_file` /
  `str_replace` resolve paths against `/home/daytona/codebase`, so every path must be given as `.wt-641/...`, and they
  CANNOT match a needle inside the 2 MB `index.html` (a correct, verified-exact needle is still reported "not found";
  `dev/patch-66427.mjs` edits it, `dev/test-*.mjs` reads it, so anything in it goes through a patch step). The first
  patch run wrote note 2 at 297 chars and failed its own `<= 260` check, so the script now owns the shortening
  (`LONG_NOTE`); a rerun lands on the entry the gate describes without hand-editing the page.
- **BUNDLE FIXPOINT**: `ota/` **757228** (pair {757227, 757228}), `ota-play/` **757236** (pair {757235, 757236}), root
  `manifest.json` **1402 bytes** and equal to `ota/update.zip`, both `--check`s OK, `ota/`-recorded size equal to the
  zip on the final round. Green: **66427 82 (new)**, 66426 86, 66425 101, 66424 102, 66423 52, 66422 87, 66421 49,
  6642 74, 6641 119, 663 49, 662 75, 6058 48, 60510 46, 658 63, 651 35, 653 31, 614 108, play 59, play-copy 28,
  boot-639 45 (v64.2.7), libhalf 18, homecard 26, themepaint 11, notifgroup 27, librarytools 15, railpaint 21,
  chatvis 26, homepaint 17, ota-guard 20, audit-calls clean (4731 names / 6367 comments), check-dom 0 failures.
  **Only `dev/test-617.mjs` fails, its one long-standing baseline check ("hits and misses are both persisted") -
  identical on pristine `origin/main`. `dev/v60-check.cjs` also fails exactly 2 of its checks (the v60 Home bubble
  order and the RGB tick rate) and fails them identically against `git show HEAD:index.html`; it is not in the gate
  set.**
- **STILL OPEN**: this is a device-side paint fault and the sandbox cannot reproduce it. What shipped removes the only
  continuous whole-backdrop re-paint a dynamic theme had, which is the shared cause and a real cost on its own - but
  the flicker itself still has to be judged on a phone. If it comes back, the three things a dynamic theme animates
  listed in point 1 are the whole search space, and the per-bubble `sd-glow-pulse` (opacity only) is the one remaining
  candidate that is a child of a clipped, rounded box.


## 64.2.6 (Sep 28, 2026): the Favorites bubble stops blinking out, and the record tap moves only the list it belongs to
- **The user's words**: "Why does me clicking on the record player in albums or playlists influence the other it
  shouldnt scroll down in another place only in its place, the favorites bubble keeps disappearing fix these damn
  issues bro". No version was named; the line after 64.2.5 is 64.2.6.
- **1. THE REPAIR 64.2.5 ADDED COULD NEVER TAKE EFFECT - THIS IS THE FAVORITES BUBBLE.** `scRepaint()` wrote a
  transparent outline and cleared it "on the next frame". The repair is started by a TIMER (the settle debounce),
  and a timer task runs BEFORE the frame's rendering update - so the rAF callback scheduled from it runs inside that
  SAME update, and the browser then styles, lays out and paints **once**: the write and the clear collapse into that
  single pass, the only painted frame carries no outline, nothing is invalidated, and the repair asks for a paint
  that never comes. The clear is now on the **SECOND** frame (a rAF scheduled from a rAF), so exactly one painted
  frame carries the invalidation. **Rule for the future: a paint request written and cleared inside one frame is
  not a paint request. Any write-then-clear invalidation must straddle a painted frame.**
- **2. THE GRID WAS REBUILT FOR NO REASON.** `renderHome()` is called by a play count ticking up, a metadata read
  landing, the mini-play button settling - and every call threw the grid away and built it again, while a rebuild
  that lands on a Home which is already scrolled is precisely what a WebView leaves half drawn (the new nodes arrive
  with the scroller where it is). `renderHome()` now assembles its markup into `gridHtml` first, and when that
  equals `renderHome._lastHtml` AND `homeGridIsWhole()` it applies the sizes and returns; a rebuild that DOES happen
  ends with `scRepaintSurface(bubbles, '.home-bubble')`, and `renderPinnedArtists()` ends with
  `repaintPinnedRail(list)` - so a rebuild paints itself instead of waiting for a settle that may never come.
  `applyHomeBubbleSizes()` is still called on the skip path, because that is what applies a bubble's size class.
  **Rule: never rebuild a scrolled surface for something that is not on it, and never wait for the next scroll to
  repair a rebuild.**
- **3. THE TWO LIBRARY HALVES SHARED ONE SCROLL POSITION - THIS IS THE RECORD TAP.** Playlists and Albums render
  into one `#listPane`, and `renderListInner`'s "put the scroll back" restore did not know which half it belonged
  to: leaving Albums at 240 and switching to Playlists put the playlists list at 240 (and the reverse), and the
  record tap - which renders the list before it glides - moved the half the user was NOT looking at on the way to
  the one they were. `scLibScroll` (exposed as `window.__scLibScroll`) keeps one position per half, taken from the
  pane at the TOP of `renderListInner`, before the rebuild, keyed on `renderListInner._lastHalf` - the half the pane
  is actually SHOWING, never `libraryMode`, which the single-button library toggle flips *before* it calls
  `navigate`. Both paths now restore through
  `if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;`: the
  **albums branch returns early, right after its cards are built, and had no restore at all**, which is why the
  albums list opened at the playlists offset. `halfChanged || prevScrollTop` matters - arriving at offset 0 has to
  be said out loud, because a shared pane does not go back to the top by itself. **No scroll listener is used:** the
  first draft kept the map current from the pane's `scroll` event, and a clamp during a rebuild then wrote the
  leaving half's offset into the entering half's slot (jsdom caught it immediately).
- **4. THE GATES THAT PINNED THIS REPAIR MOVED WITH IT** (same rule as 64.2.3/64.2.4/64.2.5): `dev/test-66424.mjs`
  and `dev/test-66425.mjs` pinned the take-back line's indentation - they now assert the 10-space nested line and
  describe it as "a frame later"; then the usual version sweep (37 repins). New: **`dev/test-66426.mjs` (86
  checks)** and **`dev/libhalf-6426-check.cjs` (18 checks, drives both halves through the real `navigate()` and
  records every `scrollTop` WRITE on the pane, because jsdom lays nothing out and a glide there always ends at 0).
  Regression proof: against `git show HEAD:index.html` (64.2.5) the probe fails **8** checks, including "entering
  Albums does NOT start at the Playlists offset" and "Playlists comes back where it was".
- **THE RELEASE / REPINS**: `APP_VERSION` **64.2.5 -> 64.2.6**, six-note head entry (every note <= 260 chars, no
  downloader term, note 4 keeps *rollback*), title `The Favorites bubble stops blinking out, and the record tap
  moves only the list it belongs to` (no `\bpass\b`); `sw.js` -> **`sidecut-shell-v63.0.24`**; bundles at **ota/
  756353**, **ota-play/ 756360** (this cycle is a 1-byte 2-cycle - the embedded manifest carries the size it is
  about to have, so it settles on the pair {756353, 756354}), root `manifest.json` **1306 bytes**. Green: 66426 86,
  66425 101, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 663 49, 662 75, 6058 48, 60510 46, 658
  63, 651 35, 653 31, 614 108, play 59, play-copy 28, boot-639 45 (v64.2.6), libhalf 18, homecard 26, themepaint
  11, notifgroup 27, librarytools 15, railpaint 21, chatvis 26, homepaint 17, ota-guard 20, audit-calls clean (4729
  names / 6360 comments), check-dom 0 failures. **Only `dev/test-617.mjs` fails, its one long-standing baseline
  check ("hits and misses are both persisted") - identical on pristine `origin/main`.**


## 64.2.5 (Sep 28, 2026): the bubble that still came back blank, a finished card you can tap away, a record tap that glides, and a Things-to-know list that says what the app does today
- **The user's words** (three screenshots: Home with the *Watermarks removed / Cleaned 5 songs.* card and the record
  player playing, and the same Home with Notifications "All caught up"): "Update things to know about SideCut to now
  information because it is old and outdated, the favorites bubble and pinned artist bubble still sometimes disappear
  when scrolling. When there is a home screen notification that finishes such as watermark remover I should be able to
  tap it and it goes away. And when clicking on the record player to go to my current song in my library and playlists
  it should be smooth not rough like it is now make this nice see if you can push to main if not open up a pr." No
  version was named; the line after 64.2.4 is 64.2.5.
- **1. THE BUBBLE THAT STILL CAME BACK BLANK WAS 64.2.4'S OWN REPAIR-ONLY GUARD.** Four releases have now chased the
  same WebView fault (content inside a scroller keeps its space and loses its paint), and each earlier answer paid for
  the repair somewhere a user can see or feel: 64.2.1/64.2.2 **hid** the surface for a frame (the blink); 64.2.3
  **promoted** it onto its own layer and took the promotion away (a full re-raster per settled scroll — and a layer of
  its own is the very shape a phone drops); 64.2.4 repaired **only what carried a drag lift**, which threw the trigger
  away, because a phone that drops a paint writes nothing in the page to find. The repair is now `scRepaint(el)` /
  `scRepaintSurface(root, sel)`: write `outline: 1px solid transparent`, put it back on the **next frame**. An outline
  is read by paint and nothing else, so the element and everything drawn under it must be painted again — while
  nothing is hidden, nothing moves, nothing is measured and **no layer is created or destroyed**. That is cheap and
  invisible enough to run on **every** settled scroll again (the trigger 64.2.1–64.2.3 had and the one that actually
  repaired the fault): `repaintHomeGrid()` calls `scRepaintSurface(wrap, '.home-bubble')` unconditionally and
  `repaintPinnedRail()` calls `scRepaintSurface(strip, '.pinned-artist-chip')` unconditionally. **Rules for the
  future: `carried` is gone from both repairs — never gate a paint repair on DOM damage again; never hide a surface,
  never promote one, never measure one.** The drag cleanup (placeholder removal, the `hb-dragging` reset, the chip
  lift reset) is unchanged and still runs first.
- **2. THE FINISHED CARD COULD NOT BE DISMISSED AT ALL.** `#homeExportPopup` has had a `[data-dismiss]` click handler
  since the export card was written, and **nothing on the page ever carried the attribute** — so tapping "Watermarks
  removed" did nothing and the card sat there until its own timeout. The three finished cards (watermark, `enrich`,
  `export`) now carry `data-dismiss` + `title="Tap to dismiss"` + `cursor:pointer` + a ✕ cue, and the handler maps each
  key to the state it belongs to (`watermarkCleanState`, `enrichState`, `exportState`, `pinnedCheckState`), re-renders
  and calls `updateNotifBadge()`. **Only a finished card carries it** (`count('data-dismiss=') === 3`): a running card
  must not be tappable away. `dev/homecard-6425-check.cjs` clicks the real `#watermarkConfirmBtn`, waits for the real
  run to finish, and taps the real card.
- **3. THE ROUGH RECORD TAP WAS A CANCEL-AND-RESTART AT A FIXED SPEED.** `jumpToPlayingSong()` navigated (which makes
  `renderListInner` begin a **350 ms** scroll to the playing row when the tab is switched into) and then, 140 ms later,
  `cancelScrollAnim(pane)` killed that glide mid-flight and started a hard-coded **220 ms** one from wherever it had got
  to — a teleport with a wobble on a long jump, a crawl on a short one. It now sets
  `renderListInner._scrollToPlaying = false` **before** `navigate('playlists')` (so the list never starts one of its
  own), drops the redundant `renderTabs(); renderList();` (note: `renderList()` is **rAF-debounced and coalesces**, so
  that pair was never the extra DOM work it looks like — do not claim it was), and starts **one** glide on the second
  `requestAnimationFrame` with **no duration argument**, which is what makes the shared engine size it by distance and
  honour the Scroll-speed setting. The same fixed `200`/`220` durations were dropped from `openAlbumForCurrentSong()`,
  from the disc handler's album expand, and from `highlightPlaying()`. **Rule: never pass a fixed duration to
  `smoothScrollIn()`.** `dev/test-66425.mjs` asserts no `smoothScrollIn(x, y, <number>)` call is left anywhere.
- **4. "THINGS TO KNOW ABOUT SIDECUT" (Settings → More) SAID 64.2.2.** Four bullets added (tap a finished card away;
  the bell's notes are grouped by version; the library tools live together and Watermark Remover starts on; every
  version keeps its own copy so a rollback is two-way and Storage shows the room the *phone* gives the app) and the
  record-tap bullet now describes the glide. The block sits between
  `<!-- Collapsible: Things to know about SideCut -->` and `<div id="settingsPaneSandbox"`.
- **5. THE GATES THAT PINNED THE OLD SHAPE MOVED WITH IT** (same rule as 64.2.3/64.2.4): `dev/test-66423.mjs`,
  `dev/test-66424.mjs`, `dev/test-6642.mjs`, `dev/test-66421.mjs`, `dev/test-66422.mjs` (the translateZ/two-frame/
  `carried` lines), `dev/railpaint-6423-check.cjs` and `dev/chatvis-6422-check.cjs` (they now **record the outline** and
  assert "a healthy surface IS asked to paint again, without a layer and without being hidden" plus that real damage is
  still repaired), and `dev/notifgroup-6424-check.cjs` (it pinned 64.2.4's title/**blink** wording — it now reads the
  newest title and first note **out of the page itself**, because that probe describes the group UI, not one release).
  `dev/test-66424.mjs` was moved to read its own **64.2.4** entry by version (the same move test-66423 needed at
  64.2.4). New: **`dev/test-66425.mjs` (102 checks)** and **`dev/homecard-6425-check.cjs` (26 checks, built on the
  real button, the real run and the exposed `window.__scJumpToPlayingSong`)**. Regression proof: against
  `git show HEAD:index.html` the Home probe fails **7** checks (the healthy-surface repair and the whole dismissable
  card) and railpaint/chatvis fail 3/2.
- **THE RELEASE / REPINS**: `APP_VERSION` **64.2.4 -> 64.2.5**, six-note head entry (every note <= 260 chars, no
  downloader term, note 4 keeps *rollback*), title `The bubble that still came back blank, a finished card you can tap
  away, and a record tap that glides` (no `\bpass\b`); `sw.js` -> **`sidecut-shell-v63.0.23`**; the usual
  quoted-version repins (`dev/test-*.mjs`, 36 of them, `ver === '...'` / `const VER = '...'` / `version: '...'` /
  the ship stamp / the shell cache); bundles at **ota/ 754117**, **ota-play/ 754123**, root `manifest.json` **1246
  bytes**. Green: 66425 102, 66424 102, 66423 52, 66422 87, 66421 49, 6642 74, 6641 119, 663 49, 662 75, 6058 48,
  test-play 59, test-play-copy 28, boot-639 45 (v64.2.5), homepaint 17, railpaint 21, chatvis 26, homecard 26,
  notifgroup 27, librarytools 15, themepaint 11, ota-guard 20, audit-calls clean (4720 names / 6301 comments),
  check-dom 0 failures, both OTA `--check`s OK. **Only `dev/test-617.mjs` fails, its one long-standing baseline check
  ("hits and misses are both persisted") — identical on pristine `origin/main`.**
- **NEW TRAP (cost an hour): a `\n` inside a template literal in a patch script is a REAL line break.** Several gates
  write a two-line needle as a **string containing the two characters backslash-n** (e.g.
  `ok(has("    if(!carried) return;\n    var strip = ..."))`), so a patch needle for one of those files needs those two
  characters — and `\n` in a template literal (or a tool round-trip that turns `\\n` into `\n`) silently gives a real
  newline instead, which never matches. Build it as `const NL = String.fromCharCode(92) + 'n';` and interpolate
  `${NL}`. Always `node --check dev/patch-*.mjs` first, and let `sub()`/`fileSub()` throw loudly on a count of 0.


## 64.2.4 (Sep 28, 2026): the blink on every scroll and every launch, the album that lost a few songs, the glow that kept the phone busy
- **The user's words**, three screenshots (Settings → More with the cover refetch still in the Watermark Remover card, the
  bell's flat bulleted notes, the battery screen 24.3 % / 703 mAh foreground / 1 h 29 m): "Every time it boots or you
  scroll around the app it blinks now slightly, and why is refetch missing covers in watermark remover it should be in
  library tools and fetching. These patch notes should have like headers and then drop-down menus for the headers to go
  more into depth or just take a glance. Fix the foreground battery drain issue without reducing performance or
  smoothness of the app. And for some songs Spotify to mp3 it still says no source found but this happens when it's an
  album more often and it's like a few songs in it." No version was named; the line after 64.2.3 is 64.2.4.
- **1. THE SCROLL BLINK WAS 64.2.1/64.2.2/64.2.3'S REPAINT RUNNING ON A HEALTHY SURFACE.** Both settle handlers promoted
  the grid/card onto its own layer and dropped the promotion two frames later on **every** settled scroll, whether or
  not anything was wrong — a full re-raster of the surface a moment after you stop, plus a wasted GPU pass per scroll.
  `repaintHomeGrid()` and `repaintPinnedRail()` now count the damage they actually find (a placeholder an abandoned
  drag left, a bubble/chip still carrying a drag lift) and `if(!carried) return;` before touching `transform`. **Rule
  for the future: a scroll-settle repaint is repair-only.** The promote/demote, the two-frame drop and the DOM-only
  "is it whole?" checks all stay exactly as 64.2.2/64.2.3 left them.
- **2. THE LAUNCH BLINK WAS THE THEME ARRIVING LATE.** The saved theme lives in IndexedDB, so the app painted in the
  default colours and then restyled every colour in it (including `--on-coral`, which is picked from the accent) once
  the row came back. `applyTheme()` now mirrors what it applied into `localStorage['sidecut_theme_prepaint']`
  (`{v:1,key,bg,bgRaised,coral,gold,onCoral,dyn}`), and a small IIFE at the **top of the app script block**
  (`scPrepaintTheme`, inserted right after the `<script>` that opens block 2, before the day-gate helpers) sets those
  root variables and the `theme-dyn-*` body class during parse — so the **first paint** already carries the theme. The
  cache is never a second source of truth: the database row still decides, and every `applyTheme()` rewrites it.
- **3. THE PLAYING ROW ANIMATED A BOX-SHADOW.** `@keyframes glowPulse` moved `box-shadow` between two inset glows,
  which no compositor can animate, so the row was re-painted on every frame for as long as a song played with the list
  open (foreground, on the scroll path). The glow is now `.track.playing::after` with `position:absolute; inset:0;
  z-index:-1; pointer-events:none` (above the row's own background, below its content — where the row-level inset
  shadow used to be drawn) and the keyframes move `opacity: 0.4 -> 1`, which the compositor animates with nothing
  painted. The row keeps only `box-shadow: inset 3px 0 0 var(--coral);`. **Do not put an animated box-shadow back on a
  list row.**
- **4. `Refetch missing covers` MOVED TO Library Tools & Fetching** (the user's exact ask), right after "Fetch missing
  covers" and before the lyrics fetch, with its own caption. Its label is now `<span id="refetchCoversLabel">` and the
  run reports through `scSetRefetchLabel()`: the old `btn.textContent = …` writes wiped the ONLINE badge on the first
  tap. **`dev/librarytools-6424-check.cjs` (15 checks)** asserts the DOM position (inside `#collapsibleLibraryContent`,
  **not** inside `#collapsibleWatermarkContent`), the button order, and that the badge survives a run.
- **5. THE BELL'S PATCH NOTES ARE GROUPS NOW.** `renderNotifPanel()` renders one collapsible block per changelog entry:
  a `<button data-cl-group="vX">` header (version + date + title, a **glance** line cut from the first note, and
  "N updates · tap for the detail") with `data-cl-body` behind it and `data-cl-glance` shown while it is shut. The
  newest entry is open, everything else starts shut, and `openChangelogGroups` + `changelogGroupsTouched` keep what the
  reader opened **open across re-renders** — the panel redraws itself every few seconds while a job reports progress.
  The first tap adopts whatever is open on screen before changing anything, so the newest entry never shuts itself. It is
  wired through **one delegated listener** (`body._scClWired`) and `scApplyChangelogGroup()` changes the DOM in place —
  re-rendering to open a group would lose the reader's scroll position. `changelogItems(entry)` is still the only
  renderer path (`dev/test-6055.mjs`: `>= 3` `.map`, `>= 4` `.length`, `entry.items` count `=== 1`). **
  `dev/notifgroup-6424-check.cjs` (27 checks)** boots the app, opens the bell, taps a group, and re-renders via
  `#notifMarkRead` to prove the opened group stays open.
- **6. THE ALBUM THAT LOST A FEW SONGS: `scSourceClaimsSibling()` matched a sibling's key as a SUBSTRING.** A weak key
  (no word of 4+ characters — "Ok", "Ya", "Pt 1", "One") sits inside unrelated titles ("smoking", "yacht",
  "alone"), so one short track title in a run threw the RIGHT candidate away for its neighbours — an album where the
  rest is fine and a few songs come back with nothing. `scTitleKeyIsStrong(k)` (any word `>= 4` chars) now gates the
  reject arm: a weak key may only **confirm**, never reject (the same doctrine as the short artist credit in 63.x), and
  it can only turn a refusal into an acceptance — the artist/title/duration checks still gate the audio. Also in
  `scSpToBuffer()`: a search that could not **reach** the source (`window.__scHttpWhy` set) is retried **once** after
  900 ms, because a burst of songs mid-album can come back blocked; a search that plainly answered with nothing is
  never repeated. `dev/test-66424.mjs` **runs** both (it extracts `scTitleMatch…scSourceClaimsSibling`, reproduces the
  old rule inline and shows it threw the candidate away, then shows the fix does not).
- **7. THREE PROBES CHANGED SHAPE, BY HAND.** `dev/railpaint-6423-check.cjs`, `dev/chatvis-6422-check.cjs`, plus the two
  chip-line pins in `dev/test-66423.mjs` / `dev/test-6642.mjs`: the two probes asserted "a settled scroll promoted the
  surface" (true at 64.2.3, false now), so they assert **"a healthy surface is not re-rastered at all"** and gained a
  companion check that real damage still gets the fresh raster. All three are real regression tests — against
  `git show HEAD:index.html` the rail probe fails on the healthy-rail check and the notif/theme/library probes fail 7–8
  checks each.
- **THE RELEASE / REPINS**: `APP_VERSION` **64.2.3 -> 64.2.4**, six-note head entry (every note <= 260 chars, no
  downloader term, no "no source found", note 1 names *blink*, note 4 keeps "Ok"/"Ya", note 6 keeps *rollback*),
  title `The blink on every scroll and every launch, the album that lost a few songs, and the glow that kept the phone
  busy` (no `\bpass\b`); `sw.js` -> **`sidecut-shell-v63.0.22`**; the usual quoted-version repins;
  `dev/test-66423.mjs` moved to read its own 64.2.3 entry **by version** (the same move test-66422 needed at 64.2.3);
  bundles at **ota/ 752373**, **ota-play/ 752381**, root `manifest.json` 1504 bytes. Green: 66424 100, 66423 52,
  66422 87, 66421 49, 6642 74, 6641 119, 662 75, 663 49, 658 63, 6058 48, 6055 62, 60510 46, play-copy 28, play 59,
  check-dom 0, audit-calls 4715 names / 3 blocks / 6268 line comments, all eight `.cjs` probes. The only failure is the
  long-standing baseline `dev/test-617.mjs` (66/1, identical on pristine `origin/main`).

## 64.2.3 (Sep 27, 2026): the pinned-artists blink, and the forced layout out of a settled scroll
- **The user's words**, two screenshots: "At some points there are lag spikes and pinned artists island sometimes
  doesn't show but comes back after a split second." No version was named; the line after 64.2.2 is 64.2.3.
- **1. THE RAIL WAS STILL DOING 64.2.1'S HIDE.** 64.2.2 took `visibility:hidden` -> flush -> restore out of Home's
  repaint and left it in the rail: `repaintPinnedRail()` hid `#pinnedArtistsStrip`, forced a layout and restored it on
  the next frame. A phone can present that frame, which is "the island sometimes doesn't show but comes back after a
  split second". The rail now repaints exactly the way Home does — `transform:translateZ(0)` on the strip, promotion
  dropped **one frame later** (the two-frame pattern the album reorder sheet already uses) — never hidden.
- **2. BOTH SETTLE HANDLERS FORCED A FULL PAGE LAYOUT.** `void strip.offsetHeight` (rail), `void
  wrap.offsetHeight` (Home) and `l.getBoundingClientRect().height` (the rail's "is it drawn?" check) each ran in the
  same task as the scroll settle — that is the lag spike felt the moment a scroll stops. The flush only ever existed
  to commit a **hidden** frame before restoring it, so it is gone everywhere; a transform change is committed by the
  frame it is scheduled on. **Never re-introduce a `void …offsetHeight` inside a scroll-settle handler** — if a
  redraw really needs to be committed, wait an extra frame instead.
- **3. THE RAIL'S REDRAW CHECK COULD NEVER CATCH THE FAULT.** `!.pinned-artist-chip && l.getBoundingClientRect().height`
  was a forced layout AND useless: a rail whose painting had been dropped still measures its full height. It is
  decided from the DOM now — `if(l.querySelector('.pinned-artist-chip')) return; renderPinnedArtists();`.
- **4. NEW PROBE `dev/railpaint-6423-check.cjs` (18 checks)** boots the app in jsdom, seeds two pins, wraps
  `requestAnimationFrame` and records the strip's inline style **at the moment every frame callback runs**. It is a
  real regression test: against pre-fix `index.html` it fails on "no frame of the repaint was ever hidden" with
  `{"v":"hidden"}` recorded — the blink itself. `dev/test-66423.mjs` (50 checks) is the static release gate and also
  carries a **carry-forward block** asserting 64.2.2's six fixes are still standing.
- **5. `dev/patch-66423.mjs` REWRITES TWO OLDER GATES BY CHARACTER CODE.** `test-6642.mjs` (64.2) pinned the rail's
  hide-and-restore and `test-6641.mjs` (64.1) pinned the measuring check, so their assertions now describe the new
  shape via a local `editTest()` and needles built with `String.fromCharCode(92/39/34)`. **Trap that cost real time:**
  a double-quoted JS string can never span lines — an "array element" written as several physical lines is a syntax
  error, not a multi-line value. Build the value with `+` or use a **backtick template literal** (that is how the two
  needles in this patch script are written), and check `node --check dev/patch-*.mjs` before believing an edit landed.
- **THE RELEASE / REPINS**: `APP_VERSION` **64.2.2 -> 64.2.3**, six-note head entry, every note <= 260 chars, plain
  title, no `\bpass\b` (title: `The pinned artists island stops blinking, and a settled scroll no longer lays the page
  out again`), note 4 keeps *rollback*, note 1 names *pinned artists*; `sw.js` -> **`sidecut-shell-v63.0.21`**; the
  usual quoted-version repins across `dev/test-*.mjs`; bundles at **ota/ 747976**, **ota-play/ 747988**.

## 64.2.2 (Sep 27, 2026): the 64.2.1 blink, roll-forward made visible, a per-build assistant, the storage allowance, watermark on by default
- **The user's words**, one message with six screenshots: "If you roll back the app make sure you can roll forward again
  back to current version. Now the favorites bubble sometimes disappears for a split second and reappear put the patch
  notes in simple terms not so long for minimal changes. Make sure the knowledge base for the full ver and play version
  is different because play version shouldnt know anything about downloading just that it stores your mp3's or whatever
  you got. Why is there only a certain amount of storage allowed? And when talking to the ai in certain themes in
  general its just hard to see certain text. And watermark remover that should be default and it should be on by
  default." No version was named; the line after 64.2.1 is 64.2.2.
- **1. THE BLINK WAS 64.2.1'S OWN DOING — and this supersedes the 64.2.1 note below.** `repaintHomeGrid()` hides the
  whole grid for a frame (`visibility:hidden` -> `void wrap.offsetHeight` -> `requestAnimationFrame` restore) to force
  the pixels to be drawn again. That trick is *supposed* to be invisible because the rAF callback runs before the
  frame is painted, but a phone can present that frame — a forced layout can flush a paint, and dropping/re-adding a
  compositor layer on Android WebView is a known one-frame blank. **"The favorites bubble disappears for a split
  second and reappear" is that hide.** The repaint now does the same job without ever leaving the screen: promote the
  grid onto its own layer (`wrap.style.transform = 'translateZ(0)'`), `void wrap.offsetHeight`, then drop the
  promotion on the next frame. The drag-carry clean-up and `homeGridIsWhole() -> renderHome()` are untouched. Note the
  64.2.1 "no layer promotion" rule still holds where it was written: that was about leaving a **bubble** promoted
  (the shape the WebView discards); this is a transient promotion on the **container**, cleared in the next frame.
- **2. ROLL FORWARD IS NOW THE FIRST THING THE PICKER OFFERS.** Rolling back was always two-way in the plumbing
  (`pinnedVersion` is sticky, boot swaps to the pinned snapshot, a pin whose snapshot is missing just falls through
  to the newest code, and an OTA hand-over clears it via `sidecut_ota_pin_clear`) — but the way back was a footer
  button under the whole history. `renderVersionSnapshots()` now renders the forward entry **before** the rows: a
  button `↩ Go forward to the latest version (vX)` when pinned (clears the pin, reloads, lands on the installed
  build), otherwise a line saying you are on the latest version and this is where you come back from. The section is
  titled "Roll back app (or go forward again)" and its note explains both directions.
- **3. THE STORE BUILD'S ASSISTANT ANSWERS THE DOWNLOAD QUESTION ITSELF.** The answers that could describe fetching
  music already had `SC_IS_PLAY` variants (4 of them), and `dev/test-6058.mjs` proves the store build never leaks
  one — the leak in the report is an older installed build. What was still wrong: the question people actually type
  did not match. The entry's `q` list now carries `'can i download music'`, `'download music from the app'`,
  `'can i download songs'`, `'does sidecut download music'`, and the store answer opens with "No - this build does
  not download music from anywhere. SideCut stores and plays the music files you already have...". The store half of
  `_aiSystemPrompt` says the same ("This build does not fetch music at all"), and the full build's converter answer is
  untouched. **Wording trap:** the store-visible gates forbid `\bdownload` in the NOTES (`test-617`, `test-6058`)
  while the knowledge base and the prompt may say it — the notes say "fetch music" and "the store build", never
  "download" and never "Play build".
- **4. THE STORAGE ALLOWANCE IS THE PHONE'S, AND THE PANEL NOW SAYS SO.** "3.19 GB of 13.19 GB allowed" read like a
  SideCut cap. It is `navigator.storage.estimate().quota` — the origin allowance of the WebView. The row is now
  `... of the 13.19 GB this phone allows the app`, and the footnote answers the question outright: the storage system
  every Android app shares sets it, SideCut sets no size of its own, and the room grows with free space.
- **5. WATERMARK REMOVER DEFAULTS ON.** `let watermarkEnabled = true;` and, one line later in the loader,
  `if(watermarkEnabledRow) watermarkEnabled = !!watermarkEnabledRow.value;` — so a **stored choice still wins** and
  anyone who switched it off stays off. The toggle markup ships reading `On` so the first paint matches.
- **6. TEXT ON AN ACCENT FILL IS READABLE IN EVERY THEME.** The assistant's user bubble and the Send button were
  `background:var(--coral); color:#fff`, and several themes ship a **light** accent (Monochrome `#E5E5E5`, Liquid
  Glass `#E9EDF5`, Glacier `#A6E8FF`) — white on those is invisible, which is "its just hard to see certain text".
  New `--on-coral` in `:root`, decided by **`scOnAccent(color)`** from the accent's WCAG relative luminance: it
  compares the contrast ratio of `#141414` against white and returns the better one. **Do not replace this with a
  brightness threshold** (Rec. 601 > 150 was the first attempt and a probe caught it choosing the *worse* side for
  saturated mid-tones like Crimson `#FF5470`, where dark text wins 6.5:1 vs 2.8:1). `applyTheme()` sets it, and
  `rgbApplyHue()` re-decides it on every step of the hue sweep because that accent moves. All **15** accent-filled
  controls go through `var(--on-coral,#fff)` — the fallback keeps the old look if the variable is ever missing.
- **THE RELEASE / REPINS**: `APP_VERSION` **64.2.1 -> 64.2.2**, a **six-note head entry, every note <= 260 chars**
  (the brevity is the request, so the gate pins the length), plain title, no `\bpass\b`, note 6 keeps *rollback*
  (test-662) and note 1 names *favorites*; `sw.js` -> **`sidecut-shell-v63.0.20`**; 35 repins across `dev/test-*.mjs`
  (`ver === '64.2.1'`, `const VER = '64.2.1';`, `version: '64.2.1'`, `entries[0].version === '64.2.1'`,
  `64.2.1 heads the changelog`, the 6:20 PM ship stamp in `test-6052`, and `sidecut-shell-v63.0.19` in test-612/6136/
  6137/6138/6139). **`dev/test-66421.mjs` is repinned by hand**, exactly as `test-6642` was at 64.2.1: its
  head-entry block now reads the **v64.2.1 entry by version**, and its two repaint assertions were rewritten because
  this release replaced the hide/restore they pinned.
- **GATE RESULT**: `dev/test-66422.mjs` **86/86** (new), `dev/chatvis-6422-check.cjs` **24/24** (new — and it is a
  real regression test: against `SC_HTML=$(git show HEAD:index.html)` the repaint check fails with `{v:'hidden'}`
  recorded at frame time, which is the flash, while the accent, storage and watermark blocks fail for their own
  reasons), `dev/test-66421.mjs` **48/48**, `dev/test-6642.mjs` **74/74**, `dev/test-6641.mjs` **119/119**,
  `dev/test-663.mjs` **49/49**, `dev/test-662.mjs` **75/75**, `dev/test-6058.mjs` **48/48**,
  `dev/test-play-copy.mjs` **28/28**, `dev/test-play.mjs` **59/59**, `dev/test-658.mjs` **63/63**,
  `dev/homepaint-6421-check.cjs` **17/17**, `dev/boot-639-check.cjs` **45/45 (v64.2.2)**,
  `dev/storage-usage-check.cjs` **34/34 (v64.2.2)**, `dev/native-snapshot-check.cjs` **13/13**,
  `dev/ota-guard-check.cjs` **20/20**, `dev/audit-calls.mjs` clean (**4704 declared names**),
  `dev/check-dom.mjs` **0 failures**; both `--check`s OK at v64.2.2 / 6 notes. Only the known baseline
  `test-617` -> "hits and misses are both persisted" still fails (66/1 on pristine `origin/main` too).
- **BUNDLE FIXED POINT**: `ota/` **747031 bytes**, `ota-play/` **747040**, root `manifest.json` equal to the zip
  (747031). **The first rounds overshoot before they settle** (747471 -> 747029 -> 747031): keep cycling
  `ota-bundle -> ota-bundle-play -> patch-66422 --manifest` until the size repeats, do not stop on round three.


## 64.2.1 (Sep 27, 2026): "the favorites bubble just disappears when I scroll" — the same paint fault, third surface
- **The user's words**, one message: "New bug found UI bugs why do these keep happening, whenever I scroll down in home
  the favorites bubble/ last bubble to right is there but I scroll up and down 2 more times and that bubble just
  disappears for some wierd reason. V bump to v64.2.1". Two screenshots taken a minute apart (4:53): **the same grid,
  the same row, the same scroll position** — one with the Notifications card alone on its row and an empty cell beside
  it, one with `11 / Favorites` drawn there.
- **NOTHING IN THE APP REMOVES A BUBBLE, and this is now the third surface with this exact symptom**: `renderHome()`
  rebuilds the grid from `homeOrder`/`homeHidden` (and `normalizeHomeOrder` re-adds every kind that is missing), **no
  scroll handler anywhere touched Home**, and the two screenshots have identical layout — the cell is there, the
  painting is not. Same report, same class as the library list (`#listPane`, the v63 batch) and the pinned-artists row
  (64.1 and 64.2). The rail has not been reported again since 64.2, which is the evidence that the rail's answer —
  stacking context + repaint on a settled scroll — is the right one to reuse.
- **THE FIX (the rail's own answer, applied to the grid)**:
  * **`#homeView` gets its own stacking context** (`position:relative; z-index:20;`). It was **the last scrolling page
    without one** — `#listPane` and `#discoverView` both carry the note explaining why they have theirs, and this
    makes all three consistent.
  * **`repaintHomeGrid()` runs on a settled scroll** (passive listener on `#homeView`, wired **once** on
    `_hbPaintWatch`, same **140 ms** debounce as `watchPinnedRail`, and it returns immediately when `hbDrag` is live
    so a real drag owns the grid). It drops a leftover carry **in place** — the `hb-dragging` class plus the inline
    `position`/`left`/`top`/`width`/`height`/`transform`/`transition` a drag gives a bubble, which lifts it out of
    the grid and onto a layer of its own — removes a `.hb-drag-placeholder` an abandoned drag left behind, then
    **throws the grid's painted pixels away and paints them again** (`visibility:hidden` -> `void wrap.offsetHeight`
    -> `requestAnimationFrame` restore), which is the exact hide/restore that fixed the rail.
  * **`homeGridIsWhole()` draws the grid again if a bubble is really gone**: it builds the wanted list through the
    same rules `renderHome()` uses (a custom action that no longer exists is not counted, and a deliberate
    `reorder-mode` is never judged a fault), checks every `[data-bubble]` is on the page and the child count matches,
    and `renderHome()` runs when it is not.
  * **Deliberately NOT done: no layer promotion.** `transform:translateZ(0)`/`will-change` on `.home-bubble` was the
    obvious "keep its own layer" idea and it is the wrong one — the rail's own lesson is that **a promoted layer is
    exactly what this WebView discards on a long scroll** (that is why the chip lift is dropped rather than set).
- **THE RELEASE**: `APP_VERSION` **64.2 -> 64.2.1**. Three-part versions are safe here: the in-app
  `compareVersions()` and the OTA client's own `cmpVer()` both pad a missing part with `0`, so `64.2.1 > 64.2` and a
  phone already on 64.2 takes the update (the rule that makes a same-version rebuild useless still holds). A
  **six-note head entry with no `[FULL]` notes**, no downloader term anywhere (note 5 keeps *rollback*, which
  `dev/test-662.mjs` requires; nothing names the store build, and nothing trips `test-play-copy`'s wider list),
  `sw.js` -> **`sidecut-shell-v63.0.19`** (decoupled, carries no part of the app version), 34 repins across
  `dev/test-*.mjs`, `--manifest` for the bundle fixed point. `dev/patch-66421.mjs` is the release; new
  **`dev/test-66421.mjs` is 47 checks** (release metadata, the whole paint guard, a regression block proving the
  library list + Discover + the rail kept their own, the entry names, and the file integrity pass).
- **REPIN**: `dev/test-6642.mjs`'s release-metadata block read the **HEAD** entry — this release's now. It reads the
  **v64.2 entry by version** (`entries.find((x) => /^64\.2$/.test(String(x.version)))`) instead, so its six-note and
  wording claims stay about the release they describe — the repin 64.1 applied to `test-663.mjs` and 64.2 applied to
  `test-6641.mjs`. The replacement uses a **regex**, never a quoted literal, for the same reason: the bump rewrites
  quoted version literals in every `dev/test-*.mjs`. `test-658.mjs` is **not** in the skip list (it pins
  `ver === '64.2'` and had to move to 64.2.1); `test-655`/`test-656` still are (they read their own entry and pin
  nothing this bump touches).
- **GATE RESULT**: `dev/test-66421.mjs` **47/47**, `dev/test-6642.mjs` **74/74** (after the repin), `dev/test-6641.mjs`
  **119/119**, `dev/test-662.mjs` **75/75**, `dev/test-663.mjs` **49/49**, `dev/test-play-copy.mjs` **28/28**,
  `dev/test-play.mjs` **59/59**, `dev/test-658.mjs` **63/63**, `dev/test-6058.mjs` **48/48**,
  `dev/audit-calls.mjs` clean (**4694 declared names**, 6140 line comments, no comment has swallowed code),
  `dev/check-dom.mjs` **DOM INTEGRITY FAILURES: 0**, `dev/boot-639-check.cjs` **45/45 (v64.2.1)**,
  `dev/ota-guard-check.cjs` **20/20**, and the rest of `dev/test-*.mjs` green. New
  **`dev/homepaint-6421-check.cjs` is 17/17** — it boots the app in jsdom, deletes the Favorites bubble out of the
  grid, dispatches one scroll on `#homeView` and asserts the bubble is drawn again with its count, then gives
  another bubble the full drag carry (class + inline box + a leftover placeholder) and asserts it is put back — and
  it is **10/17 against the pre-fix file** (`SC_HTML=$(git show origin/main:index.html)`), so the guard is what the
  checks are measuring. The only failing probe is the known baseline `test-617` -> "hits and misses are both
  persisted" (a lyrics-cache check untouched by this release; 66/1 on pristine `origin/main` and here).
- **BUNDLE FIXED POINT**: `ota/` **744749 bytes**, `ota-play/` **744759**, root `manifest.json` equal to the zip
  (744749), both `--check`s OK at v64.2.1 / 6 notes (five `bundle -> patch-66421 --manifest` rounds to settle).
- **STILL OPEN**: like the rail, this is a rendering-side fix and cannot be reproduced in this sandbox. If a Home
  bubble blanks again, the next step is a device read — the debug badge, then `getComputedStyle` and
  `getBoundingClientRect()` on `#homeBubbles` and on the bubble itself — because the app-side state is provably
  correct in both screenshots.


## 64.2 (Sep 27, 2026): "what the hell are these names ... just state the changes" + the rail that is STILL there + the settings tabs back + the More tab's upness
- **The user's words**, one message about the build 64.1 had just shipped, five things: "What the hell are these names
  the polish pass QOL pass no change those just state the changes"; "the glitch where the pinned artist island
  disappears when you scroll down in discover is still there"; "why did you reorder the settings tabs more should be
  at the end and the other two tabs support and donate should be where they were before"; "the more tab when you open
  it has a weird glitch where it goes up and you can barely see the other tabs it's not supposed to that ... and once
  you go into the more tab it's upness affects every other tab"; "why are the options in settings and more so square
  they should be how they were before and how every other tab is". Eleven screenshots: the two branded entry names,
  the Support chat, three shots of Discover with the rail blank, two of Settings → More with the strip cut off, and
  two of the healthy rail.
- **THE ENTRY NAMES**: `CHANGELOG`'s two newest-but-one entries opened with an invented name above the changes —
  `'The polish pass: crop by ear, ...'` (v64.1) and `'The QOL pass: covers stop repeating, ...'` (v64) — which told a
  reader nothing about what moved. They are statements now (`'Crop by ear, a hello the assistant answers, five
  animated themes free, Settings grouped, and cover picks newest first'` / `'Cover picks stop repeating, the assistant
  answers instead of erroring, the pinned bar is rounded, and rollback history is kept'`), and the one **33.4** entry
  that carried the same kind of name (`'Small UI polish pass'` -> `'Track rows and the play button get clearer press
  feedback'`, which is what its own two notes say) is fixed with them. The head entry's first note says so. **The
  release notes as a published artifact are not the place for a name**: dev/test-6642.mjs asserts the three newest
  titles, that no entry anywhere still carries either invented name, and that no entry from v60 up calls itself a
  pass.
- **THE PINNED RAIL, THIRD REPORT — WHAT 64.1 GOT WRONG**: 64.1's answer was "re-render the rail when it has lost its
  chips", and the screenshots show the card **standing in the layout with nothing drawn inside it** — so that
  condition was never met, and the self-heal never fired. The 11:58/2:07 shots are the pre-64.1 build and the 3:05
  pair is 64.1: same four chips, one shot with the card and one without, minutes apart. Three changes now:
  * **`#discoverView` has its own stacking context** (`position:relative; z-index:20;`). It was plain static flow
    content — no `position`, no `z-index` — and every fixed glow/edge layer in the theme suite is `position:fixed;
    z-index:1; pointer-events:none`, so they paint **over** it. That is the identical fault the v63 batch found and
    fixed on `#listPane`, which carries the note explaining it; Discover never got the same treatment. A translucent
    wash of `--glow-a` over the card is exactly "the card's navy background and its hairline border are gone" while
    the photographic covers on it still read through — and it is why the blank looks like bare page background.
  * **A settled scroll repaints the card, not just an empty one.** `repaintPinnedRail(list)` runs first (before the
    has-chips-and-height bail) on the same 140 ms debounce: it drops the inline lift from any chip still holding one
    — `transform`/`zIndex`/`boxShadow` in place, **not** by re-rendering, so no cover is decoded again — then hides
    the card, forces a layout read and shows it again on the next frame, which throws the painted pixels away and
    paints them fresh. That is the part aimed at the screenshot with the card still taking up its space.
  * **The rail's own horizontal scroller lost `-webkit-overflow-scrolling:touch`** and pins `flex-wrap:nowrap`. The
    legacy property is a no-op on this WebView and a nested scroller is the shape that keeps producing this fault.
    `min-height:64px`, `list.scrollLeft = 0` after a redraw and the drag-lift clearing in `finish()` all stay.
- **THE SETTINGS TABS ARE BACK**: the strip runs **Premium, Get Songs, Theme, Donate, Glow, Sandbox, Support, Widget,
  More** again — More last, Donate fourth, Support seventh, exactly the order 64.1 had rearranged. That is markup
  order only; no handler moved.
- **THE MORE TAB'S "UPNESS" (and why it followed you into every other tab)**: all nine panes live inside **one**
  scrolling box (`#settingsPanesWrap.settings-scroll`), and the sheet around it (`.modal`, `max-height:82vh;
  overflow-y:auto`) can scroll as well. So the offset the previous tab left behind was still in place when the next
  one opened — the strip came up clipped under the title and the first card read as cut off — and because the box is
  shared, that offset then followed the user into **every** tab. Two fixes, both needed: the sheet is laid out so
  only the pane scrolls (`#themeBackdrop .modal > h3`, `> #settingsTabStrip` and `> .modal-btns` are `flex:0 0 auto`,
  so the strip can never be squeezed to part of its height; the pane is `flex:1 1 auto; min-height:0`, so it absorbs
  the leftover and the sheet never overflows), and `showSettingsTab()` resets **both** `$('settingsPanesWrap').scrollTop`
  and the sheet's `scrollTop` before any pane is shown.
- **THE MORE PANE IS THE CARD LIST IT WAS**: the four uppercase group headings 64.1 added (`This build and help`,
  `Playback`, `Library, storage and rollback`, `History and extras`) and the regrouping are gone, and the
  Playlists/Albums + Auto-scroll card is back above the tutorial summary where it always sat. The "so square" reading
  is the same fault as the upness: a pane that opens part-way down shows its first card with its rounded top corners
  cut off by the scroll box's edge. The rail card's lift went into the **stylesheet**
  (`#pinnedArtistsStrip{ position:relative; z-index:1; }`) rather than its markup, because dev/test-662.mjs pins the
  inline style down to the trailing `border-radius:16px;"`.
- **THE RELEASE**: `APP_VERSION` **64.1 -> 64.2**. A rebuild carrying the same version is never taken over
  (`compareVersions(man.version, cur) <= 0` is "up to date"), so a follow-up has to be the next release — and
  64.1 -> 64.2 is what the version rule gives. A **six-note head entry** with no `[FULL]` notes (both bundlers accept
  `slice(6)` over six; the notes carry no downloader term and none names the store build — note 5 keeps the word
  *rollback*, which dev/test-662.mjs requires), `sw.js` -> **`sidecut-shell-v63.0.18`** (decoupled, must not contain
  the app version), 33 repins across `dev/test-*.mjs`, `--manifest` for the bundle fixed point. `dev/patch-6642.mjs`
  is the release; new `dev/test-6642.mjs` is **74 checks**, one per reported item plus the release metadata.
- **REPINS, AND THE ONES THAT WOULD HAVE POINTED AT THE WRONG ENTRY**: `dev/test-6641.mjs` is 64.1's gate and its
  release-metadata block read the HEAD entry — this release's now. It reads the **v64.1 entry by version**
  (`entries.find((x) => /^64\.1$/.test(String(x.version)))`) and its whole `[6] Settings and More` block was replaced
  with the state that is true now (old tab order, no headings, the card back, the flex sheet). Both replacements use a
  **regex**, never a quoted literal, for exactly the reason 64.1 recorded: the version bump rewrites quoted literals
  in every `dev/test-*.mjs`, and `64.1` inside `new RegExp`-free `/^64\.1$/` is invisible to it. The same trap was hit
  once during this release: `dev/test-6642.mjs` itself was rewritten by its own REPINS pass on the second run (a
  `version: '64.1'` inside one of its own assertions), which is why that file now builds its 64.1 stamp from
  `'64' + '.1'`.
- **GATE RESULT**: `dev/test-6642.mjs` **74/74**, `dev/test-6641.mjs` **119/119** (it was 125; the Settings block is
  five checks shorter than the one it replaced), `dev/audit-calls.mjs` clean (**4686 declared names** across 3 script
  blocks, no comment has swallowed code), `dev/test-662.mjs` **75/75**, `dev/test-663.mjs` **49/49**,
  `dev/test-play-copy.mjs` **28/28**, `dev/check-dom.mjs` **DOM INTEGRITY FAILURES: 0**, `dev/boot-639-check.cjs`
  **45/45 (v64.2)**, and 6053/6054/6055/6056/6057/6058/60510/612/6136/6137/6138/6139/614/616/618/619/620/651/653/
  655/656/658 all green. The one failing probe (`test-617` -> "hits and misses are both persisted") fails
  **identically on pristine `origin/main`** (re-checked: 66/1 both ways).
- **BUNDLE FIXED POINT**: `ota/` **742620 bytes**, `ota-play/` **742631**, root `manifest.json` equal to the zip,
  both `--check`s OK (two `bundle -> patch-6642 --manifest` rounds).
- **STILL OPEN**: the rail fix is a rendering-side fix — the stacking context is the one class of cause this codebase
  has documented evidence for, and the repaint is what the user's own screenshots show fixing it — but it cannot be
  reproduced in this sandbox, so if the card blanks again the next thing to do is ask for a screenshot with the
  debug badge on and read `getComputedStyle(#pinnedArtistsStrip)` and its `getBoundingClientRect()` from the device.


## 64.1 (Sep 27, 2026): "crop by ear, a hello the assistant knows, premium animated themes, a rail that stays put, Settings grouped, and a scroll that behaves"
- **The user's words**, one message, eight things: "Inside the cropping I should be able to move the slider where the
  track is playing around in order to make it easier to listen to what I'm cropping"; "All dynamic themes except for
  glacier, rgb, RGB plus and ember and galaxy should be premium only"; "The ai is being weird and doesn't know what to
  say to me saying hi"; "there is a weird UI glitch where the pinned artist plateau just disappears after you scroll
  down in discover. Sometimes the pinned artists plateau just disappears"; "Make settings and more more organized"; "The
  settings scroll wheel is being weird"; "album covers that you can select for your pinned artist should be in order
  newest to oldest"; "Bump ver to v64.1".
- **THE CROP SHEET CAN BE LISTENED THROUGH** (the one that needed new UI): the sheet could only play the slice
  **already chosen** (`Preview selection`, and only if the selection was ≥ 0.5 s), and the two grab bars only move the
  selection — so judging a crop meant cutting it, listening, undoing and cutting again. `#cropSongScrub` (a range over
  the whole song) plus `#cropSongScrubPlay` sit between the waveform and the start/length/end labels: `input` calls
  `cropScrubSeek(sec, false)` so **a drag only moves the line and makes no sound** (nothing is committed, and the
  matched `#cropSongScrubTime` clock and the white `#cropSongPlayhead` line follow the thumb), `change` calls
  `cropScrubSeek(sec, true)` so **letting go plays the song from where it was dropped**, and the button stops whatever
  is sounding. It plays through the **same live AudioContext path** as the selection preview (`src.start(0, at)`,
  `cropPreviewLive`, `cropPreviewT0`), so there is still one playback path to stop and one playhead to keep in step;
  `cropPlayMode` (`'sel'` | `'song'`) is what makes the status line read `Listening x / y` instead of `Previewing`.
  The markup glyphs are built with `String.fromCodePoint` in the patch script.
- **THE PREMIUM LINE MOVED**: `THEMES` had only `rgb`/`rgbplus`/`synthwave`/`ocean`/`ember`/`galaxy` free among the
  animated entries, with `glacier` (and aurora, cyberpunk, nebula, neonpulse, solstice, abyss, orchid) premium. The
  request draws it at **free = RGB, RGB +, Ember, Galaxy, Glacier** and **premium = every other animated theme**, so
  `synthwave` and `ocean` gained `premium:true` and `glacier` lost it. Three places describe the split and must move
  together: the premium buy view ("every static theme, plus five of the animated ones: RGB, RGB +, Ember, Galaxy and
  Glacier" / "nine animated themes (Aurora, Synthwave, Deep Ocean, Cyberpunk, Nebula, Neon Pulse, Solstice, Abyss,
  Orchid)") and the **seizure warning**, which appears twice (Settings → More and the first-run guide) and now lists
  **every** animated theme, because that warning is about flashing, not about the price. The lock itself is unchanged:
  the Theme tab reads `th.premium && !isPremiumActive()`.
- **THE GREETING**: `_aiFuzzyMatch` scored `pattern.indexOf(q) !== -1 || q.indexOf(pattern) !== -1` at **80** with no
  minimum length, and `"hi"` is a substring of `"history"` — so a bare **Hi** came back as the **Album History**
  paragraph (the screenshot). Two fixes, both needed: `_aiGreetingReply(msg)` answers greetings / good mornings /
  "how are you" / thanks / goodbyes **directly from the app, before any matching or any model call** (it is called in
  `_aiSendMessage` immediately after the user's bubble is added), and the substring rule now requires
  **`q.length >= 4`** so no two-letter word can be found inside a longer one again. `dev/test-6641.mjs` extracts and
  **runs** the shipped `_aiGreetingReply` + `_aiFuzzyMatch` + `_aiKB` and asserts `match('hi', 80) === null` while
  `match('album history')` still finds its answer.
- **THE PINNED RAIL THAT CAME BACK EMPTY** (reported once before, at v52.3 "your artists panel disappearing"):
  nothing in the app removes `#pinnedArtistsStrip` or clears `#pinnedArtistsList`, so the damage is on the rendering
  side. The chip drag in `wirePinnedReorder` sets `transform:scale(1.1)` / `zIndex:99` / `boxShadow` on the chip, which
  makes it **its own composited layer** — and a layer like that is what a WebView discards on a long scroll. That lift
  was cleared **only inside `if(drag)`**, so a drag that ended without its record (WebView claims the gesture, or the
  pointerup lands elsewhere) left the chip holding it for the session. Four changes: the styles are dropped on **every**
  `finish()`; `renderPinnedArtists()` sets `list.scrollLeft = 0` so a stray horizontal scroll can never leave the rail
  showing the blank space past the last chip; `#pinnedArtistsList` carries `min-height:64px` so the card cannot
  collapse to a bare heading; and `watchPinnedRail()` (wired once, on `#discoverView`'s scroll, 140 ms after the scroll
  settles) re-renders the rail **only** when pins exist and the rail has no `.pinned-artist-chip` or no height. That
  last one is the self-heal: a redraw is what fixes an evicted layer, and nothing else was going to happen on a scroll.
- **SETTINGS AND MORE ARE GROUPED**: the tab strip runs **Premium, Get Songs, Theme, Glow, Sandbox, Widget, More,
  Support, Donate** (what you buy → what you bring in → how it looks → the panes → everything else → help → donate),
  and the More pane's seventeen-card column is grouped under four uppercase headings — **This build and help**, **
  Playback**, **Library, storage and rollback**, **History and extras**. The one card that was in the wrong group (the
  Playlists/Albums button + Auto-scroll, a playback preference sitting among the informational notes) moved into
  Playback. The first heading goes **inside** the pane: building it with `before(<div id="settingsPaneMore">)` put it
  *before* the pane, where it would have been visible on every other tab.
- **THE SETTINGS SCROLL**: `.settings-scroll` was `height:62vh` + `scroll-behavior:smooth` sitting inside a sheet that
  also scrolls. A wheel over a **short** tab did nothing (its own box still had a scrollbar area), the pane kept
  **gliding** after the wheel stopped (smooth + momentum), and its scroll **chained into the page behind** the sheet.
  It is `max-height:62vh` (70vh ≥1024) + `overscroll-behavior:contain` + `scroll-behavior:auto` + `scrollbar-gutter:
  stable` now, and `#settingsTabStrip` lost its smooth scroll and gained `overscroll-behavior-x:contain`.
- **PINNED-ARTIST COVERS, NEWEST FIRST**: each candidate now carries a `date` — `Number(t.dateAdded)` for a cover out
  of the library, `Date.parse(r.releaseDate)` / `Date.parse(sr.releaseDate)` for the store's albums and singles — and
  `buildPicker()` sorts on it (`(Number(b.date) || 0) - (Number(a.date) || 0)`) right before the grid is drawn, so
  anything undated sorts last instead of being dropped. `dev/test-6641.mjs` lifts the shipped comparator and **runs** it.
- **THE RELEASE**: `APP_VERSION` **64 → 64.1** (the next release after 64, per the version rule), a **six-note head
  entry with no `[FULL]` notes at all** (this release has no tooling-only work, and `slice(6)` over six items is empty,
  which both bundlers and the channel gates accept), `sw.js` -> **`sidecut-shell-v63.0.17`** (decoupled: it must not
  contain the app version), 34 repins, `--manifest` twice for the bundle fixed point. `dev/patch-6641.mjs` is the
  release; new `dev/test-6641.mjs` is 124 checks. **`dev/test-663.mjs` was repinned**: it pinned the HEAD entry (v64,
  exactly 8 notes, the wording that release introduced), so it now reads the **v64 entry by version**
  (`entries.find((x) => /^64$/.test(String(x.version)))`) and the head entry is left to `-662` and this release's gate.
  Neither replacement text may re-introduce a literal the version bump rewrites (`String(head.version) === '64'`),
  or a second run of the patch would repin the very entry it points at.
- **GATE RESULT**: `dev/test-6641.mjs` **124/124**, `dev/audit-calls.mjs` clean (**4678 declared names**, 6098 comments,
  no swallowed line break — it caught a duplicate comment the crop-sheet insert had glued onto one line, which is
  exactly the fault class it exists for), `dev/test-662.mjs` **75/75**, `dev/test-663.mjs` **49/49**,
  `dev/test-play-copy.mjs` **28/28**, `dev/check-dom.mjs` **DOM INTEGRITY FAILURES: 0**, and both OTA checks OK.
  The one failing probe (`test-617` -> "hits and misses are both persisted") fails **identically on pristine
  `origin/main`** — no new failures.
- **BUNDLE FIXED POINT**: `ota/` **741065 bytes**, `ota-play/` **741076**, root `manifest.json` equal to the zip.
  Each cycle flips the size by a byte (the embedded `manifest.json` carries the size it is about to have), so the
  recipe stays `bundle -> patch-6641 --manifest` and then `bundle -> --check`.


## 64 (Sep 27, 2026): the QOL pass — covers, the assistant, the pinned bar, draggable sliders, faster runs, per-build guides, rollbacks kept, and the two apps side by side
- **The user's words**, one message, nine things: covers "just repeats" and "I'm missing a lot of them made by the artist";
  "the AI is very not assuring when it's going to work I need a permanent solution"; "the pinned artist bar should be
  rounded and contrast color"; Spotify/YouTube runs "take very long ... and have an accurate progress bar"; settings
  sliders should be "nice to scroll with your finger and not wired tap thing", same for "the media player time left
  playing thingy"; "the tutorials for the full ver and play version should be according to what features they have";
  "is there a way I can have the apk and the play version installed at the same time but 2 different applications?";
  "Free up storage should not delete any older rollback things"; "Bump ver to v64 mark this huge QOL update and polish."
  Two screenshots showed red banners: **`updateNpDisplay is not defined`** and **`Failed to write blob (InvalidBlob)`**.
- **THE MISSING FUNCTION (a real, reproducible crash)**: `updateNpDisplay(cur)` was called twice — at the end of the
  watermark clean and at the end of **Refetch Missing Covers** — and **defined nowhere in the file**. The real function
  is `updateNowPlayingUI()`, which is the wrong tool there (it records a play, loads a waveform, re-arms the widget:
  all of that belongs to a track CHANGE, not to a batch job finishing). `updateNpDisplay()` now exists next to it and
  does only what those two callers wanted — `npTitle`, `npArtist` and the art of the song already playing — and is
  exposed with the other hooks. **Nothing counts as a play for updating the now bar.**
- **COVERS ("just repeats" / "missing the ones the artist made")**: the artist-picture grid was keyed on
  `(album name + that track's own art URL)` — and every imported song carries its own Blob and therefore its own URL,
  so ten songs off one album drew **ten identical squares**. By the time the grid is built every candidate has been
  converted to a **data URL**, so identical pictures are identical strings: `buildPicker()` now collapses them on that.
  The missing pictures were a second fault — the artist lookup asked `entity=album` only, so an artist's **singles**
  (where a lot of that artwork lives) were never offered. A second request with `entity=song&limit=50` runs through the
  same artist filter and the same `seen` map, so nothing can be added twice.
- **THE ASSISTANT ("I need a permanent solution")** — three separate faults:
  * **503/429/5xx were printed as a red API-error bubble.** They are the same request working a moment later, so
    `_askRetrying()` retries at **0 / 700 / 1600 / 3000 ms**, and the model fallback
    (`__scGeminiEnsureModel`) retries the same way.
  * **A still-failing call left the user with the error and nothing else.** `_aiGeminiQuery` now returns `null` for a
    transient code, `_aiSendMessage` falls through to the knowledge built into the app, `_aiBusyFallback` is set, and
    the status line says **"Answered from the built-in knowledge base (the assistant service was busy)"** — a question
    always gets an answer and you always know where it came from.
  * **It denied its own features** (asked how the downloader works it answered "SideCut does not have a built-in tool
    to download music"). The system prompt now carries a **CRITICAL** line naming the built-in tools and where they
    live, **per build** (`SC_IS_PLAY ? ... : ...`), and says never to claim a feature does not exist when it does.
- **PINNED ARTISTS BAR**: `#pinnedArtistsStrip` was `background:var(--bg)` with no radius and no border — on a themed
  build a flat block of the page colour pinned edge to edge, butted against the search row. It is
  `var(--bg-raised)` + `1px solid var(--line)` + `border-radius:16px` + padding now.
- **LONG RUNS FINISH SOONER**: `SC_ENCODE_SLICE_MS` **55 → 90** (≈18 wake-ups a second → ≈11, each wake-up costing a
  timer round trip on top of the encode), and the fixed per-song pacing in the multi-song loop **800 ms → 200 ms**
  (two thirds of a twelve-song run's 9.6 s dead time). The accurate progress bar for a YouTube run came in 63.1.3.
- **DRAGGABLE SLIDERS**: the seek bar carried `touch-action:pan-x`, which **told the browser a horizontal gesture on it
  is a pan** — the drag could be taken by the scroller and never reach the thumb. It is `none` now. Every other
  settings slider was a bare native input (small thumb, tap-to-jump); they share one styled control —
  `input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)`, a 22px thumb on a filled track,
  `touch-action:pan-y` so the pane still scrolls. `#seekBar` and `#actionSpeedSlider` are excluded because both paint
  their **own** filled track on the input and a generic runnable-track would sit over it; the EQ bands are excluded
  because they are vertical faders that need the native rendering.
- **THE SEEK BAR'S REAL COMPLAINT** was not the CSS: `timeupdate` fires several times a second and
  `updateSeekDisplay()` wrote the playhead straight back into the slider, so the thumb was **pulled out from under the
  finger mid-drag**. `scSeekDragging` (set on `pointerdown`/`touchstart`/`mousedown`, cleared on
  `pointerup`/`pointercancel`/`touchend`/`touchcancel`/`mouseup`/`change`/`blur`) holds the value and the fill out of
  the clock's hands while it is held; the waveform and the disc ring still follow the song.
- **PER-BUILD GUIDES**: the build that **has** the built-in tools was still teaching the outside-site route in its
  first-run guide (Share → Expand URL → "paste it into any converter" → import), its scenario 1 and its text summary.
  All three now describe what that build does (`Settings -> Get Songs`, paste, Convert, MP3 or WAV/FLAC, YouTube the
  same way). The heading keeps `id="howToGetMusicHead"`, because the build WITHOUT the tools replaces that whole block
  at boot by that id — so the `SC_IS_PLAY` branch is untouched and still supplies the import-only walkthrough, and
  `getElementById('howToScenario1Head')` still hides the tool scenario there.
- **FREE UP SPACE NO LONGER DELETES ROLLBACKS**: it called `scPruneVersionSnapshots(SC_SNAPSHOT_KEEP)` — trimming the
  version history to the newest six, which is **the exact list the version picker exists to show** and the only way
  back to a build that worked — and read every page-sized row **twice** just to report what it had thrown away. It now
  clears the rebuildable things and nothing else (the `discPopupCache_*` saved lists, the leftover export zip in the
  app's own cache directory), the Storage row says **"(none are ever removed)"** instead of promising a cap, and
  nothing is read to measure the copies. `SC_SNAPSHOT_HARD_CAP`/the keyed runaway guard is deliberately kept.
- **A REFUSED BLOB CANNOT ESCAPE**: the `InvalidBlob` banner is Android's WebView refusing a generated File/Blob
  cloned into IndexedDB — `put()` throws it **synchronously**. `dbPut()`'s promise executor already turned that into a
  rejection its `try/catch` caught, but the guarantee is now explicit at the call site: the `put()` is wrapped, the
  transaction is aborted, and the call resolves **`false`** — the documented failure `persistTrackMeta` uses to fall
  back to the ArrayBuffer form this device accepts.
- **THE TWO APPS SIDE BY SIDE (item 7)**: both flavors shipped `applicationId com.SideCut.myapp`, so Android saw ONE
  app and installing either **replaced** the other (same upload key, so no signature error — it just took the library
  with it). New `.github/workflows/patch-dualinstall.py`, run for **`matrix.flavor == 'full'`** only, moves the
  **sideloaded** build to `com.SideCut.myapp.full` with the label **"SideCut Full"**. The Play build keeps its id
  because the Play listing is bound to it — moving that would publish a new app and existing Play users would stop
  getting updates. Only `applicationId` is touched, never the Java `namespace`, so every generated package path, the
  widget/audio-focus plugins' `package com.SideCut.myapp;` and the `com.SideCut.myapp.WIDGET_*` intent actions stay
  exactly where they are. One reinstall of the sideloaded build is the cost (restore from a backup .zip).
- **PATCHES**: `dev/patch-660.mjs` = the nine fixes (**28** index.html edits, incl. the `dev/storage-usage-check.cjs`
  repin); `dev/patch-661.mjs` = the release (`APP_VERSION` **64** — the next release after 63.1.4 per the version
  rule — a **six-note head entry plus two `[FULL]` notes at index 6 and 7**, `sw.js` -> **`63.0.16`** (must not
  contain `64`, and does not), 32 repins, `--manifest`). New `dev/test-662.mjs` (~85 checks across the nine items and
  the CI wiring). Bundle fixed point: **ota/ 733724 bytes**, **ota-play/ 733736**, both `--check` OK.
- **ALSO REPINNED**: `dev/test-658.mjs` (its release-metadata block read the HEAD entry, which was its own release
  then and is this one now — it reads the **63.1.4 entry by version** instead, so its `/auto/` claim keeps meaning what
  it meant; the same repin `dev/patch-659.mjs` applied to the 63.1.3 gates) and `dev/test-6139.mjs` (the "63 heads the
  changelog" label). `dev/test-655.mjs`/`-656.mjs` are untouched: they already read the 63.1.3 entry explicitly.
- **NOTE-CHANNEL DISCIPLINE, unchanged and still biting**: `dev/test-617..620`, `-60510` and `-662` assert
  `!/\bdownload|converter|convert\b/i` over the **whole** head entry (`\bdownload` matches "downloads"/"downloading"
  too), and `dev/test-play-copy.mjs` reads the six Play-visible notes against a **wider** list that adds
  `\bmp3\b|converting|conversion|get song|hand-?off`. So the six public notes name no tool at all, the two tooling
  notes are `[FULL]`-marked and last, and neither names the build that lacks the tools.
- **GATE RESULT**: `dev/test-662.mjs` passes, `dev/check-dom.mjs` reports **DOM INTEGRITY FAILURES: 0**, and every
  failing probe/test (`test-617` → "hits and misses are both persisted", `media-controls-check`, `rgb-theme-check`,
  `audio-focus-check`, `discover-singles-check`, `lyrics-lookup-check`, `rgb-stall-check`, `ota-*`, `batch-635`,
  `boot-profile`, the `v*-check.cjs` stale pins) fails **identically on pristine `origin/main`** — no new failures.


### 64, part two: "the inbuilt AI ... keeps hallucinating. And check every single function of the app and make sure it works with 0 errors"
- **THE AUDIT IS THE DELIVERABLE** for the second half of that ask: `dev/audit-calls.mjs` (acorn, already a dependency)
  parses every inline `<script>` block and walks the AST, then reports every identifier that is **READ but never
  DECLARED** and is not a platform global. That is exactly a `ReferenceError` waiting for the line to run — the same
  fault as the `updateNpDisplay is not defined` banner in part one, which no text-matching gate could see (the syntax
  was valid). It also checks the mirror-image fault: a **line comment that swallowed code**, i.e. an inner `//`
  preceded by whitespace with code punctuation after it, which is the fingerprint of two lines glued together with a
  space. `node dev/audit-calls.mjs` exits 1 on either. `dev/test-663.mjs` runs it as check [1].
- **IT FOUND NINE. TWO WERE ITS OWN BLIND SPOT, ONE WAS A DELETION, AND SEVEN WERE REAL CALLS TO NOTHING:**
  * **THE LOST LINE BREAK (the worst of them)**: **one physical line 17311** held the tail of `sharePlaylistCode`,
    the comment `// Build a full share link ...`, the rest of `sharePlaylistCode`, **`openShareCodeModal()`** and the
    opening line of **`copyTextToClipboard()`** — all joined by spaces. A `//` runs to the end of the line, so all of
    it became comment text: the share link was never stored, `openShareCodeModal()` did not exist (tapping
    "Open a share code" threw), `copyTextToClipboard()` did not exist (**every Copy button in the app threw**), and
    its body was left as dangling statements inside `sharePlaylistCode`, where it threw `text is not defined` the
    moment the share sheet opened. This is why the auditor reported those two as undeclared — they were declared, in
    a comment. **The newlines are restored**; the two were never bugs to "fix".
  * `confirmDeleteTrack(t.id)` (now-playing menu "Delete from library") → the function is **`deleteTrack(id,
    skipConfirm)`**, which is what the song actions sheet already calls.
  * `parseMP3Tags(buf)` in **Reset covers** → the app has exactly one tag reader, **`extractTags(track)`** (async,
    returns `{genre, artBlob}`, used by the import path to lift the embedded APIC cover). The reset built its own
    buffer and called a reader that was never written, so it threw on the first song that still had a file.
  * `persistLibrary()` in the playlist-import preview path → **declared nowhere**. A preview is a remote 30-second
    clip with no bytes on the device; `buildTrackRecord()` stores the audio as a blob, so a record written without one
    restores as a silent entry (`_noAudio`). It is honestly **session-only** now, with the reason in a comment.
  * `dbGetSync('meta','appIcon')` → the meta store is **asynchronous** and has no sync getter. It threw inside a
    `try/catch`, which is why the app-icon picker silently never restored a saved choice that was not in
    localStorage. It awaits `dbGet('meta','appIcon')` (the `wireAppIconPicker` IIFE is `async` now).
  * `_cardPtrId` (album-card hold-to-reorder release) → nothing ever captured that name. The id **was** captured, as
    `origPointerId`, **inside the hold timer**, where `cancelHold()` (declared outside it) cannot see it — and both
    release sites were inside `try/catch`, so neither throw was visible. Both now use one `var _cardPtrId = null;`
    declared in the scope the two share.
  * `updateCSSGlow()` on the import path restoring glow settings → the real function is **`applyGlowCssVars()`**.
  * `seenReleaseIds` in the New Releases popup → declared nowhere, so `seen` was always empty and **every release
    carried a NEW badge forever**. The flag the app actually keeps is **`r.seen`** (`markReleasesSeen`).
- **WHY THE ASSISTANT HALLUCINATED — four separate causes, all "the app was described by someone who has not seen it":**
  1. **THE KNOWLEDGE BASE HAD NO CROP ENTRY.** "How to crop a song" fell through to Gemini, which answered *"SideCut
     does not currently support cropping or trimming audio files"* — while the app has a **Crop song** button, a
     waveform scrubber, a preview of the cut and an **Undo crop** in the song info sheet. Five entries added: crop /
     trim (+ undo), the Watermark Remover, the rollback copies, the Home layout editor, and "my song is not loading".
  2. **ELEVEN ANSWERS NAMED TABS THAT DO NOT EXIST**: `Settings -> Playback` (5), `Settings -> EQ` (2),
     `Settings -> Equalizer` (1), plus two tips in the guide. `showSettingsTab()` opens with
     `if(tab === 'refresh' || tab === 'playback' || tab === 'eq') tab = 'more';` and a tag-stack parse of the settings
     markup confirms it: **Refresh, Playback, the equalizer, the library tools, the Watermark Remover and the storage
     panel all live inside `settingsPaneMore`**. The tab strip's buttons are Premium, Get Songs, Theme, Donate, Glow,
     Sandbox, Support, Widget and More. All eleven now say `Settings -> More` (and `More -> Playback` where that is
     the collapsible).
  3. **THE KNOWLEDGE BASE'S OWN TEXT HAD LOST ITS SPACES** — same lost-space fault as the lost line break, caught
     before it deleted code: "give it a name,andthe songs group under it", "Pinned-artist coversare manual-only",
     "it no longer clutter", "covering allthe v56 stuff,then falls back". **46 restored** by a pass over `_aiKB`
     only, with the guard "a letter on both sides of the comma" (which is why `,a:` in the object literals and `','`
     in the query lists are untouched), plus an explicit glue-word table.
  4. **THE PROMPT ONLY LISTED A FEW FEATURES** and asked the model not to contradict them — not enough to stop a
     model answering from its idea of a music player. It now carries the **real tab list**, the real features **with
     the page each one lives on**, and the rule *never invent a screen or a menu path; if you are not certain, say so
     and point at Settings -> Support*. On top of that: **the model is handed the app's entry for the question as
     GROUND TRUTH** (`_aiGroundNote` + `_aiGeminiQuery(msg, kbGround)`), and a question the app really answers
     (**`_aiFuzzyMatch(msg, 80)`**, i.e. an exact or substring match — `_aiFuzzyMatch` now takes a threshold) is
     answered **from the app itself without asking a model at all**, with the status line saying so. A model cannot
     deny a feature that is in front of it.
- **THE RELEASE NOTE STRATEGY, unchanged**: the head entry stays at **8 items** (6 shared + 2 `[FULL]`), and the two
  notes that already described this class of fault were **extended rather than renumbered** — the assistant note and
  the `updateNpDisplay` note. `dev/test-662.mjs` pins that shape (first six carry no `[FULL]`, everything from index 6
  does) and `dev/test-play-copy.mjs` reads the six Play-visible ones against the wider term list, so the added text
  names no tool.
- **BUNDLE FIXED POINT MOVED TO 736759** (was 733724): the root `manifest.json` is the OTA update manifest **and it is
  inside the zip**, so editing the notes changes the bundle, which changes the manifest, which changes the bundle.
  Reach it the same way: `node dev/ota-bundle.mjs` → `node dev/patch-661.mjs --manifest` → repeat until the size stops
  changing (this time it needed two rounds, because the notes themselves changed), then `node dev/ota-bundle-play.mjs`.
  Both `--check`s pass.
- **GATE RESULT**: `dev/audit-calls.mjs` → **OK, 4663 declared names across 3 script blocks, no comment has swallowed
  code**; `dev/test-663.mjs` → **49/49**; `dev/test-662.mjs` → passes; `dev/check-dom.mjs` → **DOM INTEGRITY
  FAILURES: 0**. The whole suite was re-run: the only remaining failures are the known pre-existing ones
  (`test-617`, `media-controls-check`, and the `v*-check.cjs` stale pins), and every one of them was re-run against
  the **pre-patch v64 file** and fails **identically** — no new failures. `ota-*` and `batch-635` and
  `discover-singles-check` now PASS (they had been run against the stale bundle in part one).


## 63.1.4 (Sep 27, 2026): "Fix the damn auto albums ... just remove the auto albums and make sure that doesn't affect my regular albums" + "add a search bar to manage albums"
- **The user's words**: "Fix the damn auto albums I hate those because I make an album and it says it already exists just
  remove the auto albums and make sure that doesn't affect my regular albums. Then add a search bar to manage albums."
  The screenshot behind it was Manage albums reading **25 albums - 227 not created by you**.
- **WHERE "ALREADY EXISTS" CAME FROM**: v58.8.1 made albums manual-only, but the entries the automatic paths had already
  written stayed in the store wearing an `auto` flag: hidden from the Albums tab, listed under "Not created by you" in
  Manage albums with an **It is mine** button. They kept their NAME, and every album-creating path guards on
  `if(userAlbums[albumName])` - so creating an album called something one of those entries was already using answered
  "an album named X already exists - merge these songs into it?", merged the songs into it, and left the result flagged
  `auto`, so the album the user had just made was invisible. A name that could not be used and an album that could not
  be seen, from the same one collision.
- **THE FIX IS A DELETION, NOT ANOTHER HIDE**: `removeAutoAlbums()` (in place of `migrateAutoFlaggedAlbums()`, which is
  gone) deletes every entry `albumIsAuto()` matches - `auto === true && manual !== true` - on each launch, and writes
  `userAlbums` + `albumOrder` back only when something actually went. It touches nothing else: an album you created,
  renamed, reordered or filed songs into by hand never carried the flag (every deliberate path calls
  `markAlbumManual`, and `ensureAlbumSaved` plus both create paths now write `manual: true` outright), and an entry
  that predates the flag and carries **no marker at all** is kept too - a "missing marker means not yours" rule is what
  once emptied a library of twelve hand-made albums down to one card. The boot says what it did: "N albums the app had
  added on its own were removed - your songs and their album tags are untouched."
- **WHY THE OLD PASS HAD TO GO WITH IT**: `migrateAutoFlaggedAlbums()` was the pass that ADDED the flag to any saved
  album whose songs matched a file-tag group in the same order. With the entries now deleted rather than hidden, that
  pass would delete a hand-made album of exactly that shape, so it is removed entirely, and the
  `sidecut_albums_manual_v1` marker with it (including the stamp the backup-import path used to leave). **Nothing
  writes `auto: true` any more** - `grep -c 'auto: true' index.html` is 0 - so the flag can only survive from an
  older build, and `albumIsAuto()` stays as the guard that keeps such a leftover out of the Albums tab until boot
  settles it.
- **MANAGE ALBUMS SEARCHES**: the panel loses the whole "Not created by you" section and its three controls
  (`It is mine` / hidden Rename / hidden Delete) and gains a real search box above the list: album name **or artist**,
  narrowed as you type, a `N of M albums` count, a "No album matches that search." state, a clear x, and it lives in
  `manageAlbumsHTML()` rather than being injected at open time because `refreshManageAlbums()` re-renders the panel in
  place. Rows are filtered by **show/hide** (`data-name` / `data-artist`), because the Rename/Delete buttons are wired
  by position - every row has to stay in the DOM. `applyAlbumFilter` normalises the query itself, and
  `refreshManageAlbums(keepQuery)` drops it on a **fresh open** while the two in-place editors (rename, delete) pass
  `true`. The reorder sheet's Switch album strip and the Add-to-album picker lose their auto filters: one list, yours.
- **PATCHES**: `dev/patch-658.mjs` = the album work (15 index.html edits, including the help-screen sentence that still
  taught the old second list); `dev/patch-659.mjs` = the release (`APP_VERSION` **63.1.4**, a **six-note head entry**
  built from its own notes - unlike 63.1.3 none of it is channel-restricted, so there is no `[FULL]` item and no copy
  of the previous set - `sw.js` -> **`63.0.15`**, 31 repins, `--manifest`). New `dev/test-658.mjs` (63 checks, and
  **46 of them fail on the pre-fix build**). `dev/albums-manual-check.cjs` was rewritten for the new behaviour (40
  checks: the deletion, the untouched hand-made entries, the entry with no marker at all, playlist + tag invariance,
  and the search box driven through the real popup), and `dev/album-rename-check.cjs` was repinned: its Rename helper
  finds its row by `data-name`, both albums are visible, and the tab holds 5 songs.
- **ALSO REPINNED**: `dev/test-6052.mjs` (an import no longer stamps the dead flag marker), `dev/test-655.mjs` and
  `dev/test-656.mjs` (their `[FULL]` notes are now read out of **their own 63.1.3 entry**, because this release heads
  the changelog - the same repin 63.1.3 applied to the release under it), `dev/albums-menu-isolation-check.cjs` and
  `dev/discover-singles-check.cjs` (an auto entry is deleted at boot, not flagged and hidden), and
  `dev/ota-update-check.cjs` - which had been **red on every release since the sw cache was decoupled from
  `APP_VERSION`**, because it still asserted that the cache name *contains* the app version; it now asserts what is
  actually true (versioned, and not the app version).
- **Verified**: the full `dev/test-*.mjs` suite green apart from the **pre-existing** `test-617` ("hits and misses are
  both persisted", identical against `git show origin/main:index.html`); `check-dom` 0 failures; the album jsdom probes
  (`album-rename` 40, `albums-manual` 40, `album-isolation` 44, `albums-menu-isolation` 25, `discover-singles` 37,
  `album-hold` 34) green; `ota-update` 50, `ota-guard` 20, `ota-loop` 26, `ota-bootapply` 24, `batch-635` 42,
  `compact-647` 23, `storage-usage` 34 (v63.1.4), `refresh-pin` 14, `native-snapshot` 13 green;
  `media-controls-check.cjs` fails on its periodic-update-poll line **on origin/main too** (that file is untouched by
  this release). Both channels rebundled to the **fixed point** (`ota-bundle` + `ota-bundle-play`, then
  `patch-659 --manifest`, 3 rounds until the bytes stopped moving): `ota/update.zip` **729280 B**,
  `ota-play/update.zip` **729291 B**, 6 notes each, both `--check`s OK.

## 63.1.3 (Sep 27, 2026): "the progress bar is not accurate at all" + "YouTube conversion takes forever" + "clicking the x should cancel"
- **The user's words**: a YouTube run's converting banner carried a down-arrow glyph and "the progress bar was not
  accurate at all"; a YouTube conversion was "taking forever and doesn't work half the time"; and "if you click the
  little x right next to convert it should cancel the download". Three reports, two bodies of work.
- **THE BAR WAS GUESSING**: one bar, four phases (audio lookup, download, decode, encode), no single owner. It opened
  at a hard-coded **15%** before any work had started, sat there through the download — the longest wait of the run —
  because nothing measured it, and then slid **backwards** when a stream had to be retried (the encoder reported its
  own 0–100 into the same bar). Now each phase reports into its own band (`var YT_BANDS = { resolve:[0,8],
  download:[8,62], decode:[62,70], encode:[70,100] }`) and one clamped figure (`function ytPct(p)`) owns the number,
  so the status words and the bar can never disagree and the bar can only move forwards. `scFetchBytes` and
  `scFetchDecode` now report **real bytes** while the stream is read (measured against the reader's 40 MiB ceiling).
  The glyph was a literal character in the strings the pill, the bell and both converter cards can show mid-run, so
  all of them lost it.
- **THE RUN STALLED AND GAVE UP — four waiting causes**: (1) the two Innertube clients were awaited **one after the
  other** (`answered` / `if(answered >= 2) break`), so a second full round trip with its own connect+read timeouts sat
  in front of the first byte; both are now asked at once (`var asks = clients.map(...)`, `await Promise.all(asks)`).
  (2) the oEmbed title lookup sat **in front of** the whole run, so a slow relay walk delayed the fetch by up to its
  budget; it now rides alongside (`var metaP = tryMeta()`) and only the encoder awaits it. (3) a **chosen** output
  format had no fallback at all — the card promises one, but the chain was one entry long — so a blocked MP3 encoder
  (lamejs is fetched from a CDN) ended the run with nothing; the chain is now `[chosen].concat(others)` with an
  `ENC_FAIL` sentinel that tells "cannot be produced here" (try the next format) apart from "the stream would not
  fetch" (stop, another format changes nothing). (4) a usability probe that got **no answer** (timeout, dropped
  connection) was treated as a refusal and threw the one good candidate away; now `return !(probe && probe.status)` —
  only an explicit 403/404/410 refuses.
- **CANCEL FROM THE CARD**: the x beside Convert cleared the fields and nothing else, so a run kept going with no way
  to stop it from its own card. Both cards now call one shared `scCancelConversion(btnEl)` — the same path the
  bubble's Cancel uses — which latches `window.__scCancelDl`, hands the Convert button back at once, and dismisses the
  pill on a **1500 ms** grace window so Cancel always means "gone", whatever the job in flight is doing.
- **THE NOTES ARE [FULL] AND LAST**: the new head entry's six **public** notes are the 63.1.2 set, because the head
  entry is the release both channels describe and the shared six may not read as a downloader (dev/test-617..620,
  -60510, -651). The two fixes are documented as `[FULL]` items **after** them: marker-stripped for the full build,
  filtered out on the Play channel on the marker alone (`changelogItems`), so neither test-651's six-note set nor
  test-play-copy's wider net ever sees them.
- **PATCHES**: `dev/patch-655.mjs` = the progress fix (no glyph, bands, byte-measured download); `dev/patch-656.mjs` =
  the run/cancel fix (concurrent clients, `metaP`, format fallback, probe tolerance, shared cancel);
  `dev/patch-657.mjs` = the release bump (`APP_VERSION` **63.1.3**, six-note-plus-two head entry, `sw.js` →
  **`63.0.14`**, version repins, `--manifest`). New `dev/test-655.mjs` (41 checks) and `dev/test-656.mjs` (43 checks)
  pin the fixes and **fail against the pre-fix build** (`SC_HTML=<pre-fix index.html> node dev/test-655.mjs`).
  `dev/test-6055.mjs` / `dev/test-6056.mjs` were repinned for the moved `cb.` cancel button and `dev/test-614.mjs`
  for the helper slice + `cl.num`; the version pins across the suite (`test-6052..60510`, `612`, `6136..6139`, `614`,
  `616..620`, `651`, `653`) moved 63.1.2 → 63.1.3. **Numbering note**: 652/653 already belong to the 63.1.1/63.1.2
  scripts on this line, so this release's files start at 655.
- **Verified**: full `dev/test-*.mjs` suite green apart from the **pre-existing** `test-617` ("hits and misses are
  both persisted", identical against `git show origin/main:index.html`); `check-dom` 0 failures; both `ota-bundle
  --check` and `ota-bundle-play --check` OK at **v63.1.3 / 6 notes** (zip fixed-point after 2 rounds; re-run
  `--manifest` **after** the bundles, as always).

## 63.1.2 (Sep 27, 2026): "keeps reopening the popup for every artist instead of showing a progress bar"
- **The user's words**: "it keeps reopening the same new releases popup for every artist instaid of just showing a
  progress bar inside of the what's new popup" — a follow-up to 63.1.1, which fixed the *reopen-after-close* but not
  this. So 63.1.1's diagnosis was right as far as it went and the batch was **not done**.
- **THE CAUSE (and why 63.1.1 missed it)**: `checkPinnedArtistReleases` saves and repaints **as each artist lands**
  (`try{ renderNewReleases(); }catch{}` / `try{ scRepaintOpenReleasePanel(); }catch{}` inside the worker loop) — done
  on purpose so a partly-finished run keeps what it found. But `scRepaintOpenReleasePanel()` called
  `openHomeBubble('newreleases')`, and **`openHomeBubble` writes `body.innerHTML` from scratch**: the icon+title, the
  `#hbRelCount` line, the mark-all button, every `.hb-track-row` and the injected All/Upcoming tab strip are all
  re-created. Measured on the shipped build with 4 pinned artists by polling the identity of `#hbPanelBody`'s first
  element: **THREE full panel rebuilds during one check**, and no progress indicator anywhere. 63.1.1 re-read the
  popup's open/closed state and stopped *reopening* it, but the panel was still rebuilt once per artist while it was
  open — which is exactly what the user was describing.
- **The fix is an in-place row painter, `window.__scHbPaintRelRows(host)`** (with `window.__scHbRelRowInner(rel)` for
  the markup): it builds the wanted set, **removes** rows whose release is gone (a long-press removal that raced a
  finish), **reuses** the nodes that are still wanted (so listeners survive; `_hbRelWired` stops re-wiring and
  `_hbRelSig` stops needless innerHTML writes), **creates** only the missing ones, updates `#hbRelCount` and the
  mark-all button, then re-runs `__scDiscRelTab` so new rows land in the right tab. `scRepaintOpenReleasePanel` now
  targets `#hbPanelBody` and calls it, with the old `openHomeBubble` rebuild kept only as a fallback behind a
  `typeof` guard. The panel's **initial** render also goes through the painter, so the two paths can't drift.
- **The progress bar**: `__scUpRefreshState` grew `#scRelProgress` — a labelled gold bar with `N/total` and a %
  fill — created while `pinnedCheckState.active` and **removed** when the run ends. It lives at the top of the
  *surface*, not inside the empty state (which is `display:none` on the All-releases tab — so a line there was
  invisible exactly while the check ran). `__scUpRefreshState()` called with **no root** now updates *every* open
  release surface (`['discPopupBody','hbPanelBody']`), which is what the 900 ms ticker in `__scUpcomingConnectTap`
  needs. Verified: bar advances `0/4 → 1/4 → 2/4 → 3/4`, is gone after the run, and shows on BOTH the Home panel and
  the Fetch latest popup.
- **Verified with real node identity, not counts**: tab strip node preserved, every original row node still in the
  DOM, panel never closed/reopened, bar removed at the end — on both surfaces.
- **Patches**: `dev/patch-653.mjs` = the in-place painter + bar (5 index.html edits, anchor-located where a needle
  would have to carry a non-ASCII `·`/`…`); `dev/patch-654.mjs` = the release bump (`APP_VERSION` **63.1.2**,
  six-note head entry, `sw.js` → **`63.0.13`**, 29 repins, `--manifest`). New `dev/test-653.mjs` (30 checks);
  `dev/test-60510.mjs` [4], `dev/test-616.mjs` [5] and `dev/test-651.mjs`'s `VER` were repinned because they pinned
  the *inline* panel markup that moved into the painter — **grep every `test-*.mjs` for a moved code shape before
  rebuilding**.
- **Non-ASCII needle trap (cost two rounds)**: index.html stores the row markup with **literal** `·` and `…`
  (bytes e2 80 a6 / e2 80 a2), while a JS `'\u2026'` in a patch needle evaluates to the *same* char but a
  **template-literal** `\u2026` inside a written file can end up as a 6-char escape. Have index.html carry the
  escapes (`textContent`, string concat) and the patch needle carry the real char, and prefer locating such a block
  by anchor (`indexOf` start + end) rather than embedding it. (The shipped files ended up with LITERAL chars, which
  is what the surrounding code already had — byte-different from an escape but identical on screen.)
- **Sandbox note again**: the in-repo OTA zips carry a per-entry fixed mtime, but the CI publish step rebuilds them
  and the byte sizes land a few bytes apart from a local build (725654 local). Always re-run `--manifest` **after**
  the bundles, in that order.
- **Verified**: 6 inline blocks parse; full `dev/test-*.mjs` suite green apart from the **pre-existing** `test-617`
  ("hits and misses are both persisted", identical against `git show HEAD:index.html`); `check-dom` 0 failures; both
  `ota-bundle --check` and `ota-bundle-play --check` OK at v63.1.2 / 6 notes; zero personal tokens in the notes or
  any published manifest.

## 63.1.1 (Sep 27, 2026): "Check for drops keeps reopening the popup and I don't think it's looking"
- **The user's words**: "Whenver I click upcoming releses and check for drops it keeps like reopening the popup
  for it and I don't think it's actually looking for upcoming releases from pinned artists" (Karan Aujla,
  Diljit Dosanjh, AP Dhillon, Shubh).
- **THE REOPEN, both halves**: `__scRebuildReleaseLists` read the popup's open/closed state **before** the check
  ran and, whenever the release popup was open, called the popup's own handler `fb.onclick()`. That handler ends
  in `openDiscoverPopup(...)`, which sets `display:flex` **unconditionally** — so a check you started and then
  closed put the popup back on screen when it finished. Measured: reopened 32 s into a run the user had already
  dismissed, popup closed at 2.5 s and back mid-run. `__scDiscRelTab` also re-armed `window.__scUpcomingAutofetch`
  from inside the switcher itself, so **every redraw** re-armed it — including the redraw that follows a finished
  check — and each autofetch ran the same rebuild. That is why a single tap could run the whole sweep more than
  once and why it felt like it kept re-checking. Also: the same `fb.onclick()` re-ran `checkPinnedArtistReleases()`,
  so one "Check for drops" was two full passes over the artists.
  **Fix**: sample the popup state **after** the check (closed stays closed); gate the handler with
  `window.__scReleaseRepaintOnly` so a repaint never re-runs the sweep; mark a genuine tap with
  `window.__scUserTabTap` (both tab strips) and let the empty tab autofetch only on that; add a
  `pinnedCheckState.active` bail to the autofetch. Verified: 1 rebuild per tap, 0 autofetches.
- **"It isn't looking"**: it *is* looking — live probes show MusicBrainz browse-by-id and the Wikidata pass
  leaving for every pinned artist (3 MB requests each; MusicBrainz 200 with a UA, 403 without) and returning 0
  rows because none of the four genuinely has a dated future release in any open catalog (Wikidata spells the
  artist "Diljit", not "Diljit Dosanjh", so its pass can't credit him either). What made it *read* as dead was
  the empty-state line: it was written once at panel build time, and updating it later was deliberately skipped
  (`!emptyEl._scUpWired`) because `emptyEl.textContent = …` onto the container would take the two CTA buttons
  with it. So a finished check left the **same frozen sentence**. Fix: the sentence moves into its own
  `.sc-up-msg` child; new `window.__scUpRefreshState(root)` rewrites it in place and adds a live
  "Reading the open catalogs… N/M" line while the run goes. Called from the rebuild, the empty tab's refresh, the
  900 ms progress ticker, and the tap's `finally`. The catalog code was **not touched**.
- **Patches**: `dev/patch-651.mjs` (11 index.html edits, converges from the pre-fix tree — rerun 0) and
  `dev/patch-652.mjs` (`APP_VERSION` 63.1 → **63.1.1**, the six-note head entry, `sw.js` → **`63.0.12`**, 29 repins,
  `--manifest`). New `dev/test-651.mjs` (35 checks); `dev/test-614.mjs` [3] repinned to the new gating (2 assertions).
- **Two `sub()` traps hit again**: (1) a marker that is a **substring of another edit's replacement** makes the
  edit skip on the first run — the ticker's `window.__scUpRefreshState()` marker was contained in edit 1's
  replacement, so it silently "already applied" and never landed; use a longer, unique marker. (2) a line that
  stores a **literal `\uXXXX` escape** in index.html (the ticker's `'Checking\u2026 '`) needs `\\u2026` in the
  needle — a JS `"\u2026"` in the needle literal is 6 chars wide (bytes 5c 75 32 30 32 36) and matches nothing.
- **Verified**: 6 inline blocks parse; full `dev/test-*.mjs` suite green apart from the **pre-existing**
  `test-617` "hits and misses are both persisted" failure (identical against the pre-change `index.html`);
  `check-dom` 0 failures; both `ota-bundle --check` and `ota-bundle-play --check` OK at v63.1.1 / 6 notes; zero
  personal tokens in the notes or any published manifest. Probes: closed popup stays closed for 50 s of a run,
  the two CTA buttons survive the in-place text update, and the empty line reports how many artists were read.
- **Sandbox note (re-confirmed)**: `npm install acorn --no-save` PRUNES `jsdom` (probe died with MODULE_NOT_FOUND);
  `npm install jsdom --no-save` after it. The zip shim must treat **non-flag args** as `out` + files — flag-first
  parsing fed `.shim/zip` the `-X` and it never found `ota/update.zip`.

## 63.1 (Sep 26, 2026): the scrub needed a version bump to reach an updated phone
- **The user's ask, verbatim**: "You don't have to put my personal data In patch notes remove all personal data from
  patch notes" — and, once the scrub was pushed at the same version, "Did you bump ver?" / "Yes".
- **THE LESSON (this batch exists only because of it): editing the notes and rebuilding the bundle at the SAME
  version does not deliver.** `dev/native-updates.js` installs only a bundle whose version is STRICTLY newer:
  `compareVersions(man.version, cur) <= 0` → logs "up to date" and returns without downloading (~line 954). A phone
  already on 63.0.9 therefore kept the old notes; only devices on 63.0.8 or older, or a fresh install, received the
  scrub. The same rule is at `updateIsNewer()` (index.html ~14124) for the offer side and `isOlderBundle()` on the
  apply side. **A note-only change still needs a number nobody has run — the bump IS the delivery.**
- **Number choice**: the `.x` line caps at 9 and `63.0.10` is forbidden (MANDATORY VERSION RULE), so **63.1**.
  `sw.js` moves on its own line to `sidecut-shell-v63.0.11` (decoupled; nothing compares the two).
  Verified with the SHIPPED `compareVersions` (lifted out of index.html): `63.1` vs `63.0.9` → `+1`,
  `63.1` vs `63.0.10` → `+1` (so the cache-buster's higher number can never be mistaken for a release).
- **The head entry is six notes and talks about itself**, so it has to obey the channel rules it describes: no
  `download`/`converter`/bare `convert`, never name the play build (test-6058's `STRONG`, test-60510, test-616..620).
  It also names no artist, album, song or library size — the whole point.
- **`dev/patch-650.mjs`** is the bump: `APP_VERSION` 63.0.9 → 63.1, the self-healing head entry, `sw.js` →
  `63.0.11`, and 29 test repins. Then the usual mechanics — **rebuild BOTH bundles and re-seed the root manifest**.
  **Order matters and cost a round here**: `dev/test-6058.mjs` and `dev/test-play.mjs` assert the OTA manifests match
  `APP_VERSION`, so they fail until the bundles are rebuilt (they read `ota/updates.json`, not index.html).
- **Sandbox has no `zip`/`unzip`**: `.shim/zip` + `.shim/unzip` are Python `zipfile` stand-ins, used as
  `PATH="$PWD/.shim:$PATH" node dev/ota-bundle.mjs`. **Run the whole suite with that PATH** or test-6058/test-play
  fail on `spawnSync unzip ENOENT` for a reason that has nothing to do with the change. `npm install acorn --no-save`
  is also needed.
- **`dev/test-617.mjs` fails 1 check ("hits and misses are both persisted") — PRE-EXISTING**, identical against the
  pre-change `index.html`. Verified in both directions this batch.
- **Verified**: 6 inline blocks parse; **1258 ok / 1 pre-existing failure** across `dev/test-*.mjs`; both
  `ota-bundle --check` and `ota-bundle-play --check` OK at v63.1; zero personal tokens in `index.html`'s CHANGELOG and
  in every published manifest (`ota/updates.json`, `ota/manifest.json`, `ota-play/updates.json`, root
  `updates.json`/`manifest.json`).

## 63.0.9 follow-up (Sep 26, 2026): patch notes carry no personal data
- **The user's ask, verbatim**: "You don't have to put my personal data In patch notes remove all personal data from
  patch notes." The `CHANGELOG` array in `index.html` is the app's patch notes AND the source of the published OTA
  notes (`dev/ota-bundle*.mjs` slice the head entry's `items` into `ota/updates.json`, `ota/manifest.json`,
  `updates.json`, `manifest.json`), so scrubbing the array scrubs the public surface too.
- **What counted as personal data and was generalised**: the reporter's library size (songs count + GB) in 63.0.9;
  named artists (in 63.0.6, 63.0.5, 62, 61.8, 61.7, 61.5, 60.1.3, 60.1.2, 60.1.1, 60.0.9, 50.1.1, 50.0.2, 49.5.x,
  56.1); named albums/songs (Ishq Da Uda Ada, Ishq Ho Gaya, Smile, Dil, Ranjha, LIFESTYLE, Gangstas Paradise, Dealer,
  CRUISE CONTROL, AUJLA SZN, Punjabi Gaane, Over Exposure, Dil); and the third-party names used to describe the
  lyrics incident (Jason Derulo, LISA). Each note keeps its meaning — only the identifying specifics are gone.
- **Mechanics**: `dev/patch-649.mjs` — 27 full-line replacements into the `CHANGELOG` array, marker-matched
  (unique substring of the old line) with `count==1` and self-healing (`lines.includes(replacement)` → skipped), so a
  rerun reports 0 edits. Then the usual release mechanics: rebuild both bundles and re-seed the root manifest.
- **Sandbox has no `zip`/`unzip`** — `.shim/zip` + `.shim/unzip` are Python `zipfile` stand-ins (already gitignored via
  `.shim/`), used as `PATH="$PWD/.shim:$PATH" node dev/ota-bundle.mjs`. `acorn` also needs `npm install acorn --no-save`.
- **A test pinned the personal data**: `dev/test-6138.mjs` asserted `/Bikramjit Dhaliwal/.test(headText)`. It now asserts
  `/small artist/` — the genericised wording. **When genericising notes, grep `dev/test-*.mjs` for the names first.**
- **`dev/test-617.mjs` fails 1 check ("hits and misses are both persisted") — PRE-EXISTING**, verified identical against
  the pre-patch `index.html`, unrelated to the notes.
- **Verified**: all 6 inline `<script>` blocks parse (`new Function`); 1258 `ok` / 1 pre-existing failure across the
  `dev/test-*.mjs` suite; both `ota-bundle --check` and `ota-bundle-play --check` OK; zero personal tokens in
  `index.html`'s visible changelog and in every published manifest.

## 63.0.9 (Sep 26, 2026): "Boot takes 4 seconds and storage bro" — the same defect
- **The user's screenshots settled it**: in-app panel `454 songs · 2.99 GB`, covers 59.6 MB, rollback copies 13.1 MB,
  settings 55 KB, `storage.estimate()` 3.09 GB of 13.09 GB — while Android's app page said `Data 4.12 GB`, cache 4.6 MB.
- **THE DIAGNOSIS (the thing to remember): `loadFromDB()` does `dbGetAll('tracks')`, and every track record carried its
  own song as a raw ArrayBuffer (`blobData`) — so a launch deserialised the ENTIRE LIBRARY'S AUDIO before the first paint.**
  That is the 4 seconds. It is also why a play count or a lyric stamp cost megabytes, and part of why the app data
  directory (4.12 GB) exceeded the music (2.99 GB). Measured in `dev/compact-647-check.cjs` at 1/15 scale: **312 MB read at
  boot for 40 songs → 0.0 MB** after compaction.
- **The fix**: store the audio as a **Blob handle** instead of inline bytes. IndexedDB keeps blob bytes out of the record and
  dedups them by UUID, so the record is a few hundred bytes, the bytes are written once, and a metadata write never touches
  audio again. `restoreTrackFile()` already accepted both forms — that is what made this a small change.
  - **The ArrayBuffer form is the fallback, not dead code.** Some Android WebView builds refuse a generated Blob cloned
    into IndexedDB (`InvalidBlob`) — the original reason for the bytes-in-record layout. `persistTrackMeta()` tries the
    Blob first and falls back; `scAudioInlineOnly` then stops it from paying for the failed attempt on every later write.
  - **CRITICAL, cost a debugging round: `dbPut()` reports a refused write by resolving `false`, never by rejecting** (its
    outer try/catch swallows a synchronous DataCloneError from `put()`). Both audio writes must check `if(_ok === false)`,
    or a song that was never written looks saved. The probe's fake reproduces the refusal (`refuseBlob`).
- **`scCompactLibraryStep(maxRecords, onProgress)`** converts libraries written before this release: one transaction per
  record (a crash leaves that song intact), idempotent (it only looks at records that still hold `blobData`, so there is no
  progress state to lose), and it stops for good on a device that refuses the form. 25 records per launch from
  `scRunWhenIdle` next to the snapshot guard; **Storage → Compact library** does the whole library with progress. The panel
  row `Songs read at every launch` is the number behind a slow start, and it only claims "none — all compacted" when a pass
  has actually seen every key (`seen >= keys.length`), never from a budgeted run that stopped early.
- **`dev/compact-647-check.cjs`** (new, 23 checks; fails 11 against the build the user was running). Harness notes: the fake
  reports an inline-audio record as `NOMINAL_BYTES` (40 songs × 6 MB) instead of allocating GBs — the metric is "what the
  storage engine pays for an ArrayBuffer inside a record" — and a record with a Blob handle reports **0**. Its `getAllKeys`
  MUST return `v.key !== undefined ? v.key : v.id` (tracks are keyed by `id`, meta rows by `key`); returning only `key` made
  the compaction find nothing and silently report "all compacted".
- **Order-safety lesson**: patch-643's prune sub used `async function scPruneVersionSnapshots(){` as its marker, so after
  patch-645 rewrote that function as `(keepCount)` a re-run of 643 **put the reading version back**. Markers must match both
  the old and the new form (now `'function scPruneVersionSnapshots('` and 645's `scRunWhenIdle` line). Verified by running
  641..648 both from the 63.0.7 base and from a tree that already had 641..646: both produce the tree byte-for-byte.
- **Honest limits to tell the user**: the first launch after installing still reads the old form once (that is the conversion),
  so judge speed on the following launch; and the gap between Android's number and the panel's is the WebView's own caches
  (GPU/HTTP/service-worker), which JavaScript cannot see or clear.

## 63.0.8 (Sep 26, 2026, second half): "why does it take up 4.53 gb"
- **No new version.** This folded into the unreleased **63.0.8** (`APP_VERSION`, the `sw.js` cache `63.0.9`, the changelog
  DATE `September 26, 2026 · 2:12 PM EDT` and every test repin stay exactly where patch-642 put them — `dev/test-6052.mjs`
  pins that date literally). Only the head entry's TEXT changed, still **exactly six** items, so both OTA bundles were
  rebuilt at v63.0.8 / 6 notes and root `manifest.json` re-seeded.
- **Cause 1 — the export leak (the real gigabytes).** `streamZipToCapacitor()` streams the WHOLE library into the app's own
  `CACHE` directory so the share sheet can have a URI, and **only the failure path ever called `deleteFile`** (there was
  exactly one `deleteFile` in the file, inside the `catch`). Exporting a 4 GB library left 4 GB in app storage for good,
  counted by Android and invisible from inside the app (it is not in `navigator.storage.estimate()`). Now: a 90 s grace
  `setTimeout` deletes the cache copy right after the share/copy-out block, and `scCleanOwnCache()` sweeps leftovers.
  **Guard against sweeping too much:** only `CACHE`, only names matching `/^sidecut-(songs|library)\.zip$/i`, and skip
  anything whose `stat.mtime` is under 3 minutes old (never pull a file out from under an open share sheet).
- **Cause 2 — a duplicate function name shadowing a real one.** There were TWO `scFmtBytes` in the same script scope: the
  Storage panel's labelled one and an older bare-number one lower in the file. Function declarations hoist and the **LAST
  wins**, so the panel printed `13.8` where it meant `13.8 MB`. Deleted. Lesson for a 39k-line single scope: `grep -c` a
  helper name before adding it, and when a panel shows a number with its unit missing, suspect a second definition.
- **Cause 3 — nothing told the user what storage was FOR.** Settings → More now has a collapsible **Storage** block:
  `renderStoragePanel()` (music/covers/rollback copies/settings/localStorage/leftover export zips/`estimate()`), the
  `collapsibleStorage` + `#storagePanelBody` + `#storageRefreshBtn` + `#storageFreeUpBtn` wiring, and `scFreeUpSpace()`
  (prune + clear `discPopupCache_*` + `scCleanOwnCache`, then report what was freed in the panel and a toast).
- **The regression this batch caught in itself (read this one twice).** patch-643 put `scPruneVersionSnapshots()` in the
  settings pass. It decided "newest" from `savedAt`, i.e. it **deserialised every ~2.4 MB rollback row at boot** — the exact
  cost 63.0.7 removed (measured by `dev/boot-639-check.cjs`: 29.9 MB read, 13 page-sized rows handed to callers, where the
  target is 0 and 0) — **and it silently deleted the user's rollback history**, which the version picker exists to list
  (the probe went 39/39 → 5 failures). Fix (patch-645): order comes from the **KEYS** (`versionSnapshot_<ver>` + a dotted
  `scCompareVersions`), the only automatic prune is a runaway guard at `SC_SNAPSHOT_HARD_CAP = 24` runs (~58 MB) scheduled
  with `scRunWhenIdle` (key-only, off the boot turn), and trimming to `SC_SNAPSHOT_KEEP = 6` happens ONLY from Free up
  space. **Lesson: after a later patch in the same batch touches a path an earlier probe already covers, re-run that
  probe — 643 shipped a boot regression that only boot-639 could see.**
- **`dev/storage-usage-check.cjs`** (new, 34 checks; fails 24 against HEAD and 6 against 63.0.8-before-644, so it reproduces
  the report in both directions). Harness traps, all of which cost a debugging round:
  - `window.allTracks` is **not** exposed — use `window.__scGetAllTracks()`.
  - jsdom's `HTMLMediaElement.prototype.play()` returns `undefined`, so the app's `a.play().catch(…)` throws
    `Cannot read properties of undefined (reading 'catch')`. Stub it to dispatch a `play` event and return a resolved
    promise; stub `pause` too.
  - A play is only COUNTED via `commitPlay`, which needs the `ended` event on **`#audioEl`** (not `#audio`), and the sidecar
    row lands after its 700 ms debounce — call `__scSidecarFlush()` before reading it.
  - The fake IndexedDB must implement **`getAllKeys`** or the key-only prune silently no-ops (and boot-639's fake must too,
    or the guard path is never exercised).
- **Numbers for the answer** (jsdom, 3 songs + 12 versions of history): meta read during boot **29.9 MB → 0.0 MB**, rollback
  rows handed to callers **13 → 0**, one play: **0** track-record writes (was 1 whole song, ~6 MB re-serialised), leftover
  export zip **4 MB removed**, panel sizes now carry units (`3 KB`, `13.8 MB`, `775 B`).
- **Cause 4 — a timing bug the SAME batch introduced, in the OTA client.** `dev/ota-guard-check.cjs` went 20/20 → 17/20
  once patch-641 landed (bisected: HEAD+641 already fails; `SC_HTML=/tmp/pre643/index.html` proves it is not 643).
  `detectPinnedOlderPage()` in `dev/native-updates.js` is what stops a pinned old page and a newer installed bundle
  fighting across launches; it runs ONCE from its own `<script>` tag, and it asked `currentVersion()` — whose last resort
  is the version LABEL, which ships as the stale placeholder "SideCut v48". `native-updates.js` is a separate tag, so its
  ledger-read → ledger-write promise chain can finish **before the app's 2 MB inline script has run**: the guard compared the
  pin with `48`, mismatched and gave up for good. Fix (patch-646): ask `appReportedVersion()` (the app's own constant /
  dataset, never the label) and treat "the app has not run yet" as **not yet** — retry every 250 ms up to 10 s.
  Debugging route worth remembering: jsdom's `VirtualConsole` does NOT forward the page's `console.log` to stdout, so
  instrument a probe by writing markers to `localStorage` and reading them after boot; and `SC_OTA=/tmp/ota-debug.js` lets a
  probe run against an instrumented COPY of the client without touching the repo.
- **Probe files touched**: `dev/boot-639-check.cjs` (45 checks now — added `opts.history`, `getAllKeys` in the fake, and the
  runaway-guard block), `dev/storage-usage-check.cjs`, `dev/ota-guard-check.cjs` (20 checks, the pinned-page block), plus
  `dev/patch-644.mjs` / `dev/patch-645.mjs` / `dev/patch-646.mjs`.
- **Tooling note**: `str_replace`/`write_file` will not touch `dev/native-updates.js` in this environment (the file tools
  only resolve the four indexed root files plus files they created), so part of the batch — and 646 — edits it from Node
  inside a `dev/patch-*.mjs`. Same is true of any other long-standing file the editor cannot see.

## 63.0.8 (Sep 26, 2026): startup gets measured on the phone, and two more launch-time costs go
- **Shipped number**: **63.0.8** — a step inside the 63 line. `sw.js` cache name → **`63.0.9`** (own number, decoupled).
  Head CHANGELOG entry written as **exactly six** notes; `ota/` + `ota-play/` rebuilt at **v63.0.8 / 6 notes** (both
  `--check` OK), root `manifest.json` re-seeded (`--manifest`).
- **The user's words**: "Its better but still takes forever to load" — i.e. 63.0.7's 174.2 MB → 0.0 MB of launch reads
  was real but not sufficient. **The lesson: once the measurable defect is gone, what is left of startup is device-only**
  — the WebView parsing a 2.37 MB page (2.06 MB of it inline JS), blob-backed IndexedDB reads, image decoding — and a
  desktop/jsdom profile CANNOT attribute it. So this release mostly ships the measurement.
- **The boot stopwatch** (the part worth remembering):
  - `window.__scBootClock` is stamped by its own **one-line `<script>` placed BEFORE the app's script block**, so the first
    mark inside block 1 is exactly `parse + compile + all top-level set-up` — the one cost no desktop profiler can
    attribute honestly. **This made the file have 6 inline script blocks instead of 5**, and `dev/v609-check.cjs` asserted
    `blocks.length === 5` (re-pinned to 6 with the reason in the probe).
  - `scBootT(label, note)` / `scBootPersist()` / `scBootRead()` live immediately above the boot IIFE (`scBootMarks`),
    with `window.__scBootProfile()` and `window.__scBootT`. The last launch is kept in `localStorage['scBootProfile']`,
    logged as ONE console line, and rendered in the notifications panel as `#notifBootEntry` → `#notifBootDetail`
    (`bootProfileNotifHtml()`, tap to expand). One tap on the bell, no test mode, no console needed.
  - Marks: `page ready: script parsed, compiled and set up` · `boot: notification state read` · `boot: settings + theme
    applied` · `boot: recovery check done` · `boot: library read from storage` (with `N songs, M ms`) · `boot: library
    built` · `boot: tabs rendered` · `boot: Home on screen` · `boot: enrich state + pinned artists read` · `boot: DONE`,
    plus `list: first render (opening Library, not boot)` with its ms and row count.
- **The two launch-time costs removed** (certain whatever the numbers say):
  - **The list render no longer runs at startup at all.** 63.0.7 moved it to the first idle slice; it is still the
    heaviest thing the app builds (a row and a cover per song) and it was built for a screen the app never shows — boot
    always lands on Home, and `navigate('library')` has always called `renderList()` itself. The idle slice now does
    `updateNotifBadge()` instead (that walks the whole library for duplicates and nothing on screen needs it in the same
    frame).
  - **The restored song is no longer analysed at launch.** `restorePlaybackState()` called
    `applyNormalizedGain(track, activeIdx)`, and with `autoVolumeEnabled` (default ON) and `t.gain == null` that schedules
    `estimateGain()` → `scDecodeTrack()` → **a full `decodeAudioData` of the whole song inside the boot turn**, for a track
    restored paused that may never be played. Now `applyNormalizedGain(t, idx, { skipMeasure: true })` applies the stored
    gain but never starts a decode; a real play measures it exactly as before (`playCurrent` calls it without the flag —
    note it applies gain/EQ BEFORE `a.play()`, so "skip while paused" would have broken the feature outright).
- **`dev/boot-profile.cjs`** (new): injects the phase hooks into a COPY of index.html in /tmp and prints a phase table for
  a seeded library (`TRACKS` / `HISTORY` env, default 600/12). Shape on 300 tracks in jsdom: page ready 103 ms,
  notification 74, theme 123, library read 1 ms, Home on screen 317, DONE 359, first list render (Library opened) 16 ms
  for 4 rows. Its counters had the same trap as the other probe: a rollback row's value is an OBJECT (`{version, html,
  savedAt}`), so a naive `value.length` reports "0.0 MB" — size it via the `html` string. Missing anchors are skipped, not
  thrown, so it can be pointed at an older build.
- **A trap that cost real time, recorded so it doesn't again**: in `boot()` the recovery step is
  `try{ await Promise.race([...]); }` on one line and `catch(e){...}` on the next — **the try's closing brace is at the END
  of the try line**, so an anchor of `      }catch(e){ ... }` finds 0 occurrences. I "fixed" the anchor but left the `}` in
  the *replacement*, which left a stray brace and broke block 1 (`Missing catch or finally clause`). **The only thing that
  caught it was `dev/test-6044.mjs`'s acorn pass over every inline script** — jsdom just failed silently through the boot
  catch and the probe reported a half-booted app. Fix idiom now in the patch: a tolerant repair step
  (`if (src.indexOf(broken) !== -1) { swap }`) so it converges from the broken intermediate state AND from clean HEAD.
- **Shared-channel note rule hit again**: notes must not contain `download` / `converter` / `convert` (test-617..620,
  test-60510). Wrote "the two pieces that load from the network" instead of "the app downloads".
- **Verification for this batch**: all **28 `dev/test-*.mjs`** green, `check-dom` **0 failures**, `boot-639` **39/39**
  (and **29/9 against the shipped 63.0.7 build**, which is the batch's own reproduction) — including checks that the bell
  row exists, is collapsed, carries every phase and expands on tap. `batch-635` 42/42, `report-637` 29/29, `report-634`
  31/31, `v609` 50/50, `native-snapshot` 13/13, `storage-recovery` 17/17, both OTA `--check`s OK. Clean-tree convergence:
  patch-641 = 17 edits then 0, patch-642 = 2 edits, and the result is byte-identical to the working tree. Pre-existing and
  unchanged (verified against HEAD): `v612` 62/65, `v613` 63/70, `v60` 60/2, `v603` 25/2, `v604` 44/2, `v606` 41/6,
  `v607` 46/2, `media-controls` 18/1, `ota-update` 48/2.
- **Still unmeasured, honestly**: the phone's own numbers. That is what the stopwatch is for — the next round of startup
  work should read `window.__scBootProfile()` from the user's device and target whichever phase dominates there.

## 63.0.7 (Sep 26, 2026): boot stopped reading every copy of the app it had ever kept
- **Shipped number**: **63.0.7** — a step inside the 63 line. `sw.js` cache name → **`63.0.8`** (its own number, decoupled).
  Head CHANGELOG entry written as **exactly six** notes; `ota/` and `ota-play/` both rebuilt and both carry **v63.0.7 / 6
  notes** (`--check` OK on both), root `manifest.json` re-seeded with `--manifest`.
- **The user's words**: "It takes way to long for the app to boot". The screenshots on this account show a ~2.9 KB/s
  connection and a library of 60 albums / 298 singles from 7 artists — a real phone, many updates installed.
- **What was actually slow: the rollback history, read on every meta sweep.** Every version that has ever run writes
  `versionSnapshot_<APP_VERSION>` into the `meta` store holding `SHELL_SNAPSHOT_HTML` = `'<!DOCTYPE html>\n' +
  document.documentElement.outerHTML` (~2.4 MB), and they are deliberately never pruned (`loadSavedTheme`, "every version
  stays, none get pruned"). Nothing filtered them out of a read, so **boot made four full `dbGetAll('meta')` sweeps before
  the library was parsed** — `loadNotifReadState`, `loadSavedTheme`, `loadFromDB`, `loadPinnedArtists` — plus
  `loadEnrichState`, plus `checkForUpdatePopup` 900 ms later, plus `collectMeta` after *every* storage change while the app
  runs. Measured with `dev/boot-639-check.cjs` on a store with 12 versions of history: **174.2 MB deserialised per boot
  before, 0.0 MB after** (76 page-sized rows handed to callers before, 0 after). It also explains "it keeps getting
  worse": one more row per update, in every sweep.
- **The fix is key RANGES, not a schema change.** `dbGetAll(storeName, range)` now passes its range to `getAll(range)` —
  the storage layer filters, so a row outside the range is **never read or deserialised at all** — and two helpers live next
  to `dbGetAll` (line ~15462):
  - `scMetaSettingsRows()` — everything except the rollback block, as two ranged reads: `upperBound('versionSnapshot_',
    true)` (keys before the block) + `lowerBound('versionSnapshot_\uffff', true)` (keys after it). The prefix block is
    exactly the keys inside `['versionSnapshot_', 'versionSnapshot_\uffff']`, which is what makes two ranges enough.
  - `scMetaSnapshotRows()` — `bound('versionSnapshot_', 'versionSnapshot_\uffff')`, i.e. the rollback rows, and only for
    the version picker.
  - `dbHas(store, key)` — a keyed existence test through `getKey()`, which answers **without deserialising the value**
    (this is how `loadSavedTheme` checks whether its own version already has a row). Falls back to `get()` when `getKey`
    is missing.
  - All 8 `dbGetAll('meta')` call sites now use one of these (10927, 11287, 13696, 13934, 14069, 14279, 15618, 29621 on
    the 63.0.6 file). `loadEnrichState` became a plain `dbGet('meta','enrichAttemptedIds')`.
  - The helper constants are `var`, not `const`: a boot-time caller must never hit a TDZ if something calls a sweep before
    the very end of block 1 has executed.
- **`__scSnapRestore()` opened the recovery file before checking whether anything was missing.** It read + `JSON.parse`d
  the whole snapshot (megabytes) and only then discovered the stores were healthy — and boot races this hook against a 4 s
  deadline. The wipe check (marker in localStorage + a keyed `dbGet('meta','idCounter')`) now runs first and the file is
  opened only when a store really looks empty.
- **Two CDN scripts sat in front of the app's own script** (`<script src=…jszip.min.js>`, `…lamejs.min.js`), so on a cold
  start no app code ran until both third-party requests had come back — on a 3 KB/s connection that is the whole wait.
  Both are now `defer`. Safe because every use is guarded: JSZip has a dynamic-loader fallback (`typeof JSZip ===
  'undefined'` → load it, line ~20255) and lamejs is probed with `typeof` (line ~20407, falls back to WAV).
  **`dev/native-updates.js` was checked for a parse-time JSZip use and has none** — it is left as a plain script, in order.
- **Two more costs off the boot path**: `loadFromDB` called `restoreTrackFile(r)` 3× and `restoreTrackArt(r)` 3× per song
  (six File/blob wrappers per track before the first paint) — now one of each, re-used; and the list render (a row + a
  cover per song, the heaviest thing boot builds, for a screen the app does not land on) goes through a new
  `scRunWhenIdle()` — `requestIdleCallback` with a `setTimeout(0)` fallback — instead of running inside the boot turn.
  `navigate('library')` already calls `renderList()` itself, so nothing depends on the boot render.
- **The probe for this batch**: `dev/boot-639-check.cjs`, 31 checks, and it **fails 13 of them against the pre-fix build**
  (`SC_HTML=/tmp/index.before.639.html`). It has to be built to be able to tell the two apart:
  - a **range-aware** fake IDB plus an `IDBKeyRange` polyfill (`only/lowerBound/upperBound/bound`, each exposing
    `_r.contains(key)`); a fake that ignores ranges cannot see the difference between the builds.
  - byte counters per sweep (`metaBytes`, `bigRowsReturned`, `snapshotRowsReturned`) and a `settingsKeys` set, so the
    claim is "only settings were read", not "the app still works".
  - **counting getters** on the seeded track records for `blob` / `art` (`Object.defineProperty(…, {get})`), which is how
    the 3-per-song restore is measured rather than asserted from the source.
  - `requestIdleCallback` captured into a queue and fired by hand: the list must be **absent** before the fire and present
    after, which is the honest test for "off the boot turn".
  - the native `Filesystem.readFile` stub counts **only paths matching `sidecut-snapshot.json`**: the OTA client reads its
    own `sidecut-ota-ledger.json` during boot, so a raw read count says 1 on a healthy phone for the wrong reason.
  - jsdom has no `URL.createObjectURL` — without a stub the whole `loadFromDB` rejects ("Auto-load failed TypeError") and
    every later check quietly measures a half-booted app. `dev/batch-635-check.cjs` never hit this because it seeds no
    tracks.
- **Harness repair, same lesson as last batch**: `dev/test-6044.mjs` slices `loadPinnedArtists` into `new Function(...)`
  with its own `dbGetAll` stub. Now that the real code calls `scMetaSettingsRows()`, that stub was bypassed and 7 checks
  failed ("reads=0"). The harness now injects `scMetaSettingsRows` **bound to the same stub and the same counter** — the
  sweep is exactly `dbGetAll` on a store with no rollback rows, so the assertions keep their meaning.
- **Shared-channel changelog rule, hit again**: `test-617/618/619/620/60510` assert the head notes carry **no**
  `\bdownload|converter|convert\b` (the Play build has none). Note 4 originally said "the app downloads" and had to be
  rewritten to "the one that opens .zip files". Check that regex before writing the notes, not after.
- **Pre-existing failures, verified unchanged against a pristine HEAD checkout** (`git archive HEAD | tar -x -C
  /tmp/head639base`): `v612` 62/65, `v613` 63/70, `v60` 60/2, `v603` 25/2, `v604` 44/2, `v606` 41/6, `v607` 46/2,
  `media-controls` 18/1 ("no longer fires every half hour"), `ota-update` 48/2 (its "service worker cache name tracks the
  app version" assertion contradicts the deliberate decoupling, plus zip byte-determinism). Green: all **28
  `dev/test-*.mjs`**, `check-dom` **0 failures**, `report-637` 29/29, `report-634` 31/31, `batch-635` 42/42, `v609` 50/50,
  `storage-recovery` 17/17, `discover-singles` 37/37, `native-snapshot` 13/13, `ota-guard` 26/26, `ota-bootapply` 24/24,
  `ota-loop` 26/26, `export-playlist` 16/16, `refresh-pin` 14/14, `ah-*` 42/34/17, `album-hold` 34/34, `dur-bubble`,
  `lyrics-lookup` 42/42, `boot-639` 31/31. **`native-snapshot` is timing-flaky under contention** (12/13 once when four
  jsdom suites ran back to back, 13/13 alone twice) — rerun it alone before believing a failure.
- **The patch converged from clean HEAD**: 18 edits in `/tmp/head639`, rerun = 0 edits, result byte-identical to the working
  tree.

## 63.0.6 (Sep 26, 2026): the ▶ that lived in the popup cache, and the one cover with no source left
- **Shipped number**: **63.0.6** — a step inside the 63 line the phone is on. `sw.js` cache name → **`63.0.7`** (its own
  number, decoupled; a cache-buster). Head CHANGELOG entry written as **exactly six** notes; `ota/` and `ota-play/` both
  rebuilt and both carry **v63.0.6 / 6 notes**, both `--check`s OK, root `manifest.json` re-seeded (`--manifest`).
- **The user's words**: "I'm still missing one album cover and there shouldn't be a play button in singles when you click
  on a song" — with two screenshots: Album History with **`Ishq Da Uda Ada` (2003-02-09, Diljit) still a blank square**
  while `Smile` / `Ishq Ho Gaya` / `Over Exposure` / `Dil` / `Chocolate` / `The Next Level` all had art, and the **Singles**
  popup for `BK` ("298 singles from 7 artists", search bar + ↻ Refetch singles / 🗑 Recently Deleted row) with a **green ▶
  on every row** (GALL MUKKDI, CRUISE CONTROL, Unforgettable …).
- **Reports are not code, and the code is not the app — the ▶ had moved into the popup cache.** 63.0.5 really did remove
  the last renderer that drew a button, and `loadCachedDiscoverPopup` really did strip a saved body. But three things read
  a saved `discPopupCache_*` body and only that one stripped it:
  - **`cachedArtistGroups()`** — lifts whole `.dp-ah-artist` groups out of a saved body as `outerHTML`; they are re-used as
    `kept.html` at the top of a *fresh* Singles list.
  - **the Singles button's cached-open branch in `siBtn.onclick`** — hands `_sCached.body` straight to `openDiscoverPopup`
    and returns, never touching the loader at all. **This is what the screenshot was.**
  - **`openDiscoverPopup` itself *writes* the cache** (`localStorage.setItem('discPopupCache_' + title, …)`) from the body
    it was just handed — so that branch **re-saved the ▶ it had served**, and the button became self-perpetuating: cache
    expiry was the only thing that could ever have cleared it. **Lesson: when a snapshot is cleaned on read, clean it at
    the writer too, and prefer the one choke point every path already goes through** (here, the top of
    `openDiscoverPopup`, which also heals the write).
- **index.html has TWO top-level script blocks, and the popup code is in the second one.** Block 1 runs the app IIFE and
  closes at `</script>` (formerly line 36429); `openDiscoverPopup`, `loadCachedDiscoverPopup` and the album-history popup
  live in block 2 from `<script>` (36430) on. **A helper defined in one block is invisible to the other except through
  `window`** — which is why `scStripPopupPlayButtons` is declared in block 1 next to `cachedArtistGroups` and published as
  `window.__scStripPopupPlayButtons`, exactly like `__scKeptArtistGroups` and `__ahResolveArtworks`, and why block-2 call
  sites read it as `window.__scStripPopupPlayButtons(...)`. One regex in the file, called from every reader, the popup's
  entry, and the cache write.
- **Two probes had to be repaired for that, and this will happen again.** `dev/report-634-check.cjs` and
  `dev/v609-check.cjs` drive the cached-popup loader by slicing its source into `new Function('localStorage',
  'openDiscoverPopup', …)`. That harness has no `window`, so the loader's new call throws straight into its own
  `catch(e){}` and both probes read it as "the saved list does not open" (3 and 6 failures). They now pass a real window
  (report-634) and extract + run the **real** stripper next to the loader (v609). **When a sliced function starts using a
  new global, fix the harness, never the guard.** report-634 still fails 10 checks against its own pre-fix build, and v609
  is 50/50.
- **The cover: `Ishq Da Uda Ada` had no source left, and the one it had was being asked wrong** (all of it measured live,
  Sep 26 2026, not reasoned about):
  - `itunes.apple.com/search?term=Diljit Dosanjh Ishq Da Uda Ada&media=music&entity=album` → **`resultCount: 0`**.
  - `api.deezer.com/search/album?q=Diljit Dosanjh Ishq Da Uda Ada` → **`{"data":[],"total":0}`**. (Deezer is where
    *Smile*, *Ishq Ho Gaya* and *Over Exposure* came from in 63.0.5 — it has no record of this one.)
  - MusicBrainz has it: `releasegroup:"Ishq Da Uda Ada"` → count 1, id `d1999b8d-fb08-387f-b3ec-64fa14b81a97`,
    2003-02-09, `artist-credit: [{name: "Diljit"}]` — **the credit is "Diljit", not "Diljit Dosanjh"**.
  - So the code's own query, `releasegroup:"Ishq Da Uda Ada" AND artist:"Diljit Dosanjh"`, returned **count 0**. The
    `AND artist:` clause was the entire defect: the title-only query finds it, the artist check that already exists in the
    loop (`__ahArtSameArtist(_credit, artist)`) keeps strangers out, and that is what the code does now (`limit` 5 → 10).
  - `coverartarchive.org/release-group/d1999b8d-…/front-500` → **200, image/jpeg, 68 KB** (redirects to ia…archive.org).
  - `musicbrainz.org/ws/2/…` sends **`access-control-allow-origin: *`**, so the direct browser fetch is legitimate — no
    relay needed. (The sandbox's own curl does throw intermittent `000`/522 at MusicBrainz; use `curl -4 --tlsv1.2` with a
    User-Agent before believing a failure.)
- **jsdom quirk recorded so it stops costing time**: `el.style.backgroundImage = 'url(<the ♪ PLACEHOLDER data URI>)'` is
  **silently rejected** by jsdom's `cssstyle` — the value carries single quotes (`xmlns='…'`), the whole declaration is
  dropped and `getAttribute('style')` comes back `null`. A probe therefore cannot assert "the placeholder is painted".
  `dev/report-637-check.cjs` asserts what is **not** painted (no `https?:`, no stranger URL) plus what was **not**
  remembered (`sidecut_ahArtCache` gains nothing for the miss, and does gain the found cover), which is the real behaviour
  and jsdom-independent. `dev/report-634-check.cjs`'s older `!/http/.test(bg)` check passes for the right reason by luck.
- **The probe for this batch**: `dev/report-637-check.cjs`, 29 checks, run against the live entry points (seeded premium +
  `pinnedArtists`, the real `siBtn.onclick`, the real `openDiscoverPopup`) with an **honest** MusicBrainz router — it
  answers `AND artist:` with count 0 and title-only with the real release group, i.e. the way the service actually
  behaves. It fails **10** checks against the pre-fix build, including both reported symptoms verbatim.
- **Full verification on 63.0.6** (all re-run after the bump): 28/28 `dev/test-*.mjs`; `check-dom` `DOM INTEGRITY
  FAILURES: 0`; report-637 29/29 · report-634 31/31 · v609 50/50 · batch-635 42/42 · discover-singles 37/37 ·
  ah-edit-persist 17/17 · ah-album-edit 42/42 · ah-album-reorder 34/34 · album-hold 34/34 · dur-bubble 17/17 ·
  lyrics-lookup 42/42 · ota-guard 20/20 · ota-bootapply 24/24 · ota-loop 26/26 · native-snapshot 13/13 ·
  storage-recovery 17/17 · refresh-pin 14/14 · export-playlist 16/16; both OTA `--check`s OK.
- **Known, pre-existing, and NOT from this batch**: the historical `dev/v*-check.cjs` audits carry stale pins — v60 2,
  v603 2, v604 2, v606 6, v607 2, v61 4, v612 3, v613 7, v614 6 — and every one of those counts is **identical against
  the build without this batch** (v614 actually improves 33 → 34). The maintained gate is the 28 `dev/test-*.mjs`, plus
  `dev/check-dom.mjs` and the popup probes; the v6xx files are per-release audits, not a suite to keep green.
- **Patches**: `dev/patch-637.mjs` (5 code edits + 1 transition edit; converges from HEAD byte-for-byte — 5 edits on a
  clean tree, rerun 0) and `dev/patch-638.mjs` (the release bump: `APP_VERSION`, the six-note head entry, `sw.js` cache,
  29 test repins, `--manifest`).

## 63.0.5 (Sep 26, 2026): ten reports in one release — and the reason the phone still looked unfixed
- **Shipped number**: **63.0.5** — a step inside the 63 line the phone is on. `sw.js` cache name → **`63.0.6`** (its own
  number, decoupled; see the sw.js note below).
- **FIRST, the thing that made this batch look like it had failed**: the previous five reports were implemented and fully
  verified, but **never released** — `APP_VERSION` was still `63.0.4` and `sw.js` still `sidecut-shell-v63.0.5`, i.e. the
  exact published state. Nothing was committed and no OTA bundle was rebuilt, so an installed app had no way to receive
  any of it. "It's still broken" was correct and had nothing to do with the fixes. **A batch is not done at `--check OK`;
  it is done when `ota/` and `ota-play/` carry the new `APP_VERSION` and the commits are pushed.**
- **The user's words (batch A)**: "I should be able to get the cover art for these albums and there shouldn't be a play
  button here… the popup is not showing for the playlists that full track time is not visible… with the lyrics if
  absolutely no lyrics by the exact artist and exact song is found then just say no lyrics found not the wrong lyrics.
  And this API key thing isn't working."
- **The user's words (batch B)**: "Default view on boot when click library should be playlists not albums and thats the
  default… make sure free users can't access premium or pro things. Is their anything that you can do to make the boot
  time shorter… First time ever getting into the app make sure it says seizure warning at the top with the details of
  that, then make sure the user must scroll down all the way and click the continue button in order to get past the
  tutorial and the tutorial only."
- **Batch A, the findings that mattered** (full detail in each patch's header):
  - The Singles ▶ had **two** renderers, not one. The list was fixed long ago; `window.__singlesRowsHTML` (the ↻ / ⚡
    per-artist refetch) still drew one, and its rows are what a saved popup kept. A cached body is now cleaned on open
    for **every** popup — the old guard matched Old songs only, and only a `<span>`, while the button is a `<div>`.
  - The blank covers: Apple has **no album entry** for “Smile”, “Ishq Ho Gaya” or “Ishq Da Uda Ada” by Diljit Dosanjh in
    either the US or the IN storefront. Deezer has all three; MusicBrainz release groups for them resolve through the
    Cover Art Archive (all verified live). But the deeper defect was that `__ahResolveArtworks` — the **only** caller of
    the artwork lookup — was invoked exactly once, at boot, when `#discPopupBody` is still empty, so it had never run
    over a real row. It now runs from `openDiscoverPopup`, which every list goes through, cached or fresh.
  - The duration bubble was wired only when `isClamped(_subEl)` said the line was cut off; any line that fit answered
    nothing. The bubble also no longer dismisses itself on the scroll it causes within 350 ms of opening.
  - Lyrics: a title-exact + length-within-2 s match was accepted even when `scLyricsArtistVerdict` said `unknown`, which
    is how BK's “LIFESTYLE” got twenty strangers (Jason Derulo, LISA, Gminxr). `scLyricsStrangerCredit` now refuses an
    entry filed under a real other artist, `scListLyricsCandidates` drops and **counts** them, and an empty list is what
    the panel reports. The manual picker stays — gating it on `agreeCount` killed the label-credit case (a “T-Series”
    entry never *agrees*, yet is exactly what the box is for), so the gate is `!_picks.length` with the heading saying
    when nothing is credited to you.
  - Gemini: the app pinned `gemini-2.0-flash` in six places and read a **404** as “your key may be expired”. It now asks
    `GET /v1beta/models` what the key can use, retries with one of those, remembers it, and quotes the API's own
    `error.message`. `_aiPasteKey` falls back Capacitor → `navigator.clipboard` → `execCommand('paste')` → focus + say so.
- **Batch B, the findings that mattered**:
  - The Library boot view was a **race**. The single decision line lived in the *library loader*, reading the
    `sandboxDefaultView` variable that a *different* async pass fills in — and it was placed after the loader's own
    `if(!trackRows.length) return false`, so on an empty library it never ran at all. It moves to the settings pass (one
    run, at boot, always) and is gated on the premium unlock, so a free user lands on Playlists whatever a restored
    backup or a lapsed unlock left stored. `dev/patch-635.mjs` normalises from the committed line **or** either interim
    this patch wrote, because a rerun from a mid-state must converge (verified in a clean `/tmp` tree: 13 edits, rerun 0).
  - PRO effects were ungated. Every PRO control refused the *click*, but the values were read back out of storage and
    applied on every boot — so a lapsed subscription, a restored backup or a stale row left a free user wearing them.
    `applySandboxStyles()` is the single place they are painted, and `_scScrollSpeed()` the single place scroll speed is
    read; both now check `isPremiumActive()`. The “Default view on boot” `<select>` is also disabled for a free user
    instead of visibly moving and then discarding the choice.
  - Boot: `loadEnrichState()` and `loadPinnedArtists()` were awaited **one after the other**, two round trips to the same
    store. They run in one `Promise.all`, each keeping its own guard.
  - The first-run guide (`#howToUseBackdrop`) had no seizure warning in it and one unguarded Close button. The warning
    (same wording as Settings → More) is now the first child of `#howToUseScroll`, and that panel must be scrolled to the
    bottom before the button — relabelled **Continue** — unlocks. **Only the first-ever showing is gated**: Replay
    tutorial opens the same panel live, and no other popup changes.
- **The OTA note cap (recorded so it is not repeated)**: `dev/ota-bundle.mjs` and its two siblings take `.slice(0, 6)` of
  the head entry's items. A twelve-item entry would have shipped an update that silently said nothing about its last six
  fixes. The head entry is therefore written as **exactly six** notes, folding the ten reports into the six a user
  actually receives.
- **Mechanics**: `dev/patch-634.mjs` (batch A, **23** index.html edits), `dev/patch-635.mjs` (batch B, **13** edits), then
  `dev/patch-636.mjs` (`APP_VERSION` → **63.0.5**, new head CHANGELOG entry in front of the 63.0.4 one, `sw.js` →
  `63.0.6`, **29 repins**), then `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs`, then `--manifest`. Final state:
  `ota-bundle` v63.0.5 · 706078 bytes, `ota-bundle-play` v63.0.5 · 706087 bytes, both `--check OK`; all three zips carry
  `APP_VERSION = '63.0.5'` and `CACHE_NAME = 'sidecut-shell-v63.0.6'`. `dev/patch-636.mjs` is self-healing like 633: a
  rerun REPLACES an existing 63.0.5 entry rather than skipping it.
- **New probes**: `dev/report-634-check.cjs` (31 checks) and `dev/batch-635-check.cjs` (42 checks, boots the app twice —
  free and premium — with the seeded meta store). Both reproduce their report against the released build:
  `SC_HTML=/tmp/index.before.634.html node dev/report-634-check.cjs` fails 10, `dur-bubble-check.cjs` fails 2 of 17.
  `report-634-check.cjs` reaches the network through the **global `fetch`** only, because `fetchWithProxy` is IIFE-local
  and is not on `window` — the harness lesson from this batch.
- **Also updated**: `dev/v609-check.cjs` (the Old-songs-only cache guard is gone — every popup body is cleaned now — and
  its `sidecut-shell-v' + version` equality was stale since the sw.js decoupling; it asserts the naming convention like
  the other 12 files), `dev/lyrics-lookup-check.cjs` (the picker is no longer a menu of strangers; its `scLookupLyrics(`
  count of 3 predated a third call site).
- **Verified**: 28/28 `dev/test-*.mjs`, `check-dom` 0 failures, `ah-edit-persist-check.cjs` 17/17,
  `ah-album-edit-check.cjs` 42/42, `ah-album-reorder-check.cjs` 34/34, `album-hold-check.cjs` 34/34,
  `discover-singles-check.cjs` 37/37, `dur-bubble-check.cjs` 17/17, `report-634-check.cjs` 31/31,
  `lyrics-lookup-check.cjs` 42/42, `v609-check.cjs` 49/49, `batch-635-check.cjs` 42/42, both channel `--check`s OK.

## 63.0.4 (Sep 26, 2026): a saved album date sticks, and the invented days stop being served from the list's snapshot
- **Shipped number**: **63.0.4** — a step inside the 63 line the phone is on. `sw.js` cache name → **`63.0.5`** (its own
  number, decoupled; see the sw.js note below).
- **The user's words**: "Album editing doesn't save after I close album history, and why do my older albums have the wrong
  date".
- **Both are ONE defect, and it is not in the save.** The edit really was written (`sidecut_albumEdits`) and the renderer
  really does read it back (`var _ae = getAlbumEdits()[ahAlb.collectionId]`, index.html ~28156). What swallowed it is the
  popup's **own HTML snapshot**: `openDiscoverPopup` stores the body it drew under `discPopupCache_📀 Album History`
  (index.html ~36444), and the Album History open path in `window.__refetchAlbums` (the `!wasRefetch` branch, ~27680)
  renders that stored HTML **verbatim and returns** — no renderer runs at all. So (a) the pencil's Save repainted the
  picture of the list as it looked *before* the edit, and every close-and-reopen served that same picture — exactly
  "editing doesn't save after I close album history"; and (b) the invented day that 63.0.3 cut to its year inside
  `_dedupAlbums` was **just as invisible**, because a snapshot never goes near `_dedupAlbums`. Same cause behind both
  complaints, which is why they arrived together.
- **The fix — stamp the snapshot, and never serve one that disagrees**: `window._ahPopupCacheSig()` (the album-edits JSON
  plus `window.APP_VERSION`) is stamped onto every Album History snapshot as `ahSig` as it is written, and the open path
  now requires `ahCached.ahSig === window._ahPopupCacheSig()`. A mismatch (an edit made since, or a snapshot an older
  build left on the phone) falls through to the artist-data branch, which draws from the data — your edits, and the
  invented days cut to their year — with no refetch. `saveAlbumEdit` also drops the snapshot outright
  (`window._ahDropPopupCache()`), so the repaint that Save itself triggers is drawn from the data too.
- **The gotcha that cost a rewrite (recorded so it is not repeated)**: those two helpers MUST be **window properties**.
  index.html is assembled from block-scoped sections, so a plain `function` declaration next to `saveAlbumEdit` is
  invisible where the snapshot is written and read; the call then throws straight into that region's own `try/catch` and
  the snapshot **stops being written at all** (measured: zero `discPopupCache_*` keys after a render). The reader is also
  written to fail **safe** (`typeof window._ahPopupCacheSig === 'function' && …`), so if the helper ever goes missing the
  snapshot is dropped rather than trusted.
- **A second silent trap, in the release script itself**: the head CHANGELOG `ENTRY` in `dev/patch-633.mjs` carries REAL
  characters (the em dash and the 📀) instead of `\uXXXX`. Inside a template literal those escapes need a double
  backslash to survive into index.html, and getting it wrong is invisible in the file — the note is stored and **shown**
  as the literal text `\ud83d\udcc0`. Check it by evaluating the changelog out of index.html (the same `eval` the tests
  use) and reading the rendered notes in `ota/updates.json`, never by eyeballing the source.
- **Mechanics**: `dev/patch-632.mjs` (3 count==1-markered index.html edits: the stamp+drop helpers beside `saveAlbumEdit`,
  the `ahSig` stamp in the snapshot writer, the stamp check in the reader), then `dev/patch-633.mjs` (`APP_VERSION` →
  **63.0.4**, new head CHANGELOG entry in front of the 63.0.3 one, `sw.js` → `63.0.5`, **29 repins**), then
  `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs`, then `--manifest`. Final state: `ota-bundle` v63.0.4 · 694920 bytes,
  `ota-bundle-play` v63.0.4 · 694927 bytes, both `--check OK`; all three zips carry `APP_VERSION = '63.0.4'` and
  `CACHE_NAME = 'sidecut-shell-v63.0.5'`. **`dev/patch-633.mjs` is self-healing**: its changelog step REPLACES an
  existing 63.0.4 entry instead of skipping it, so a rerun after a text fix corrects it (the rerun reported `0` repins
  and only `CHANGELOG head entry (replaced)`).
- **New probe**: `dev/ah-edit-persist-check.cjs` (17 checks). It lets the app draw and store a snapshot of its own first
  (so the pin signature it stamps in is the real one, read back rather than guessed), then swaps that snapshot's body for
  the pre-edit picture an older build would have left behind — no `ahSig` at all — asks for the list again, saves a date
  with the pencil, closes the popup and reopens it. **Against the pre-patch build 7 of them fail**
  (`SC_HTML=/tmp/index.630.before.html`), and the screen shows `Dil 2008-04-24` plus `Chocolate 2008-02-01` no matter what
  was saved: the report, reproduced.
- **Verified**: 28/28 `dev/test-*.mjs`, `check-dom` 0 failures, `ah-album-edit-check.cjs` 42/42,
  `ah-album-reorder-check.cjs` 34/34, `album-hold-check.cjs` 34/34, `ah-edit-persist-check.cjs` **17/17** with no jsdom
  errors, both channel `--check`s OK.

## 63.0.3 (Sep 26, 2026): the album edit sheet opens on screen, and old albums stop wearing an invented date
- **Shipped number**: **63.0.3** — a step inside the 63 line the phone is on. `sw.js` cache name → **`63.0.4`** (its own
  number, decoupled; see the sw.js note below).
- **The user's words**: "The edit button doesn't work and I'm getting wrong dates for some albums" — with a screenshot of
  📀 Album History, Diljit Dosanjh, showing `Dil 2008-04-24` and `Ishq Ho Gaya 2008-04-24` (the same day for two different
  albums, no cover and no track count on `Dil`), `Smile 2005-09-04`, `Ishq Da Uda Ada 2003-02-09`.
- **Why the pencil looked dead — it opened off-screen**: the handler inserted its form with
  `body.insertAdjacentHTML('afterbegin', formHtml)` where `body` is `#discPopupBody`, and
  `#discPopupBody{flex:1;overflow-y:auto}` (index.html ~1906) is the **scroll container**. On a 60-album list scrolled to
  the middle — exactly the screenshot — the form landed at the top of the scrollable content, far above the viewport.
  The **×** beside it always worked because its confirmation is a `position:fixed` popup. The fix is the same shape: a
  fixed bottom sheet + backdrop, appended to `document.body`. The pencil's `data-date`/`data-tracks` now carry what the
  row **displays** (`_showDate`/`_showTracks`, saved edits included), so reopening it shows the date you set rather than
  the catalog one it replaced, and Save is honest — no id, no save (it says so); nothing typed, nothing saved.
- **Why the dates were wrong — the AI discography pass invented them**: the Gemini lookup asks for
  `{"title":…,"date":"YYYY-MM-DD",…}` and stored that date verbatim on a row with **no cover and no track count** — the
  three tells of the bad rows in the screenshot. Ground truth measured for those albums: MusicBrainz has `Dil` = **2004**
  and `Chocolate` = **2008** (year precision), and Apple's own storefronts disagree with each other by a week
  (US/CA `Chocolate 2008-02-01` vs IN `2008-02-08`), so a model's invented *day* is unverifiable by construction — yet it
  was displayed to the day. The pass is now asked for a **year** (`"year":2004`), only a four-digit year is kept, an AI
  row is only added when the album is unknown **by title, any year** (the old year carve-out let it add a second row for an
  album we already had), and its id is `ai_<artist>_<title>` instead of `ai_<artist>_<index>` — the index form was
  renumbered by every refetch, which is why an edit set on such a row no longer belonged to that album.
- **And a real row now beats a guessed one**: `_dedupAlbums` keeps the first row per album identity, and an AI row already
  in the cache sits **ahead** of a row a later refetch adds — so the guess kept the place and the real date/cover/count
  were discarded. A non-AI row now replaces an AI row for the same album **in place** (`out[_realAt] = a`). And a day
  already STORED on a guessed row is cut to its year (`a.releaseDate.slice(0, 4)`, guarded on `a._ai`) inside
  `_dedupAlbums`, which runs on every render path — so an album only the lookup knows stops wearing the invented day as
  the list is redrawn, without waiting for a refetch.
- **Mechanics**: `dev/patch-630.mjs` (8 count==1-markered index.html edits: the sheet, the date-field prefill, the
  placement, the save/cancel rewiring, the pencil attributes, the AI prompt, the AI row build, the dedupe swap), then
  `dev/patch-631.mjs` (`APP_VERSION` → **63.0.3**, new head CHANGELOG entry in front of the 63.0.2 one, `sw.js` → `63.0.4`,
  29 repins incl. the ship-stamp literal in `dev/test-6052.mjs`), then `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs`,
  then `--manifest`. Final state: `ota-bundle` v63.0.3 · 693842 bytes, `ota-bundle-play` v63.0.3 · 693851 bytes, both
  `--check OK`; all three zips carry `APP_VERSION = '63.0.3'` and `CACHE_NAME = 'sidecut-shell-v63.0.4'`.
- **New probe**: `dev/ah-album-edit-check.cjs` (42 checks). It opens a real popup body, runs the app's own `__wireAH`, taps
  ✏️, types a date and a count, hits Save and reads `sidecut_albumEdits` — and it pins the shapes: the sheet is `fixed`
  and a child of `<body>` (never the scroller), the backdrop dismisses it, a year-only album gets an empty day field with
  the year explained beneath it, the AI reply is asked for a year and never stores a day, the dedupe swaps a guessed row
  for a real one. **Against the pre-patch build it fails 22 of them** (`SC_HTML=/tmp/index.before.630.html`), which is how
  the report was reproduced.
- **Verified**: 28/28 `dev/test-*.mjs`, `check-dom` 0 failures, `ah-album-reorder-check.cjs` 34/34,
  `album-hold-check.cjs` 34/34, `ah-album-edit-check.cjs` **42/42**, both channel `--check`s OK.

## 63.0.2 (Sep 26, 2026): no remixes, nothing off the pinned artists, and Upcoming reads the days that are announced
- **Shipped number**: **63.0.2** — an incremental step inside the 63 line the phone is on, so it is offered and accepted
  everywhere 63.0.1 was. **v64 still needs the user's explicit consent** (their rule, recorded below).
- **The user's words**: "In new releases or upcoming releases, and make upcoming releses actually work there should be no
  remixes or anything not made by my pinned artists there shouldn't be remixes in general" (with a screenshot of Album
  History: `AUJLA SZN 1 - EP`, both `Making Memories` rows, `Four You - EP`).
- **Where the junk came from (read from the file, not guessed)**: the iTunes **song** pass never looked at the title, so
  `Daytona (Remix) - Single`, `Aaye Haaye (Afro Mix)` and slowed/karaoke uploads came straight through; the iTunes
  **album** pass and both open-catalog passes matched the credit with `indexOf` **in both directions** — a substring
  anywhere in the string — so `Karan Aujla Tribute Band` counted as Karan Aujla; and no release path filtered a title at
  all (the Album History noise regex only ever ran on Album History rows).
- **Three shared helpers, on `window` beside `__scDay10`** (both script blocks can reach them):
  `__scJunkTitle` (whole-word remix/cover/karaoke/tribute/slowed/non-stop test — **`mix` is only refused when qualified**:
  `dj mix`, `club mix`, `afro mix`, `extended mix`… so `Mix Tape` survives and `Mixed Signals` never matched),
  `__scSameArtistName` (exact name, or a whole-word prefix — `Karan` ~ `Karan Aujla` — but never a substring inside a word,
  and a longer credit containing an act word (`tribute|karaoke|band|remix|live|orchestra|presents|soundtrack|cast|choir`)
  is **refused**: `Karan Aujla Tribute Band` is somebody else), and `__scPruneJunkReleases` (runs on **load**, so remixes an
  older build already stored leave every surface at once — Home panel, Fetch latest popup, bell count, Home section).
- **Upcoming releases — why it looked dead, measured Sep 26 2026**: (1) MusicBrainz answers **one request a second** and
  throttles a burst with 429/503; the check runs three artists at once and asked MusicBrainz **twice per artist**, so six
  requests left together, most came back throttled, and a 503 was read as "nothing found" — the one source that carries an
  announced day was silently the least reliable. (2) MusicBrainz was asked **by name** (`artist:"..."`), a rank-limited
  search that can bury an announced release; browsing the artist's own catalog **by MusicBrainz id** returns everything on
  it. (3) Wikidata was asked for **albums only** (`P31/P279* wd:Q482994`), and singles/EPs (`Q134556`/`Q169930`) are *not*
  album subclasses, so a future-dated single was invisible. (4) Apple and Deezer carry **no future-dated release at all**
  (probed: the user's artists and a dozen global ones → 0 rows each), so MusicBrainz + Wikidata are the only two sources
  that can ever date a drop ahead.
- **What changed**: one app-wide MusicBrainz queue (`_mbChain`, one request in flight, 1100 ms apart, **two retries** on
  429/503), the artist's MusicBrainz id resolved once per artist per session (`__scMbIds`) then its catalog browsed, the
  name search kept as the fallback when no id resolves; Wikidata read for **albums + singles + EPs**; the per-artist
  ceiling raised **8 s → 25 s** — an artist's turn in that queue counts against its own ceiling, and at 8 s a queued retry
  was cut off before it could be made; a MusicBrainz browse reply carries **no `artist-credit`**, so the credit check now
  only applies when credits are present (the id in the query is the credit) and is strict when they are.
- **The empty tab now explains itself**: `window.__scUpcomingEmptyText()` says how many pinned artists were read and when
  ("SideCut last read the catalogs for all 7 pinned artists 3m ago and none of them is dated ahead"), read by the Home
  panel, the Fetch latest popup and the tab refresh. **Honest limit, told to the user**: no open catalog currently has a
  dated next drop for *any* of their artists (Karan Aujla, Diljit Dosanjh, Shubh, AP Dhillon, Sidhu Moose Wala, Divine,
  Badshah — MusicBrainz browse: 0 future rows each), so an empty Upcoming tab is the truth, not a bug.
- **Proven after the patch** (not assumed): the patched pass run against the live API found `Tracy Bonham → 2`
  (`LIFT @2026-11-13`, `Un-F*k This F*kt Up Christmas @2026-12-05`) and `Trippin Jaguar → 1` where the previous name
  search returned nothing for them, resolved `Karan Aujla`'s id and found him genuinely 0, and refused
  `Karan Aujla Tribute Band` (no id). The new Wikidata query returned future **singles** for `Hinatazaka46`, `STU48`,
  `Sakurazaka46`, `Sophie and the Giants` — invisible before. Helper probe: 10 junk titles → `Daytona (Remix)`,
  `Aaye Haaye (Afro Mix)`, `Karaoke Hits`, `Tribute to Karan Aujla`, `Slowed + Reverb`, `Extended Mix`, `Club Mix` refused;
  `Mix Tape`, `Mixtape`, `Mixed Signals`, `Four You - EP`, `AUJLA SZN 1 - EP`, `Best Of Karan Aujla`, `P-POP CULTURE` kept;
  prune 10 rows → 6.
- **Mechanics**: `dev/patch-628.mjs` (22 count==1-markered index.html edits: helpers + 5 source sites + 4 list sites + the
  empty-tab line), then `dev/patch-629.mjs` (`APP_VERSION` → **63.0.2**, the new CHANGELOG head entry inserted **in front of**
  the 63.0.1 one, `sw.js` `CACHE_NAME` → **`sidecut-shell-v63.0.3`**, 29 test repins incl. the ship-stamp literal in
  `dev/test-6052.mjs`), then `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs`, then `--manifest`. Final state: `ota-bundle`
  v63.0.2 · 691428 bytes, `ota-bundle-play` v63.0.2 · 691437 bytes, both `--check OK`; all three zips carry
  `APP_VERSION = '63.0.2'` **and** `CACHE_NAME = 'sidecut-shell-v63.0.3'`.
- **Test contract changed on purpose**: the MusicBrainz assertion `mb.includes('fetchWithProxy(url, SC_MB_FETCH)')` became
  "the pass uses the app-wide queue (`scMbFetch(`) and the queue reads through the shared fetch"; the 8 s clock became 25 s
  in `test-6137`/`test-6139`; `dev/test-6139` grew blocks `[13]`/`[14]` pinning the junk test (11 hits), the strict credit
  match, the prune-on-load, the queue + retry, the id browse, Wikidata's three classes and the empty-tab line.
- **Verified**: 28/28 `dev/test-*.mjs`, `check-dom` 0 failures, `ah-album-reorder-check.cjs` 34/34,
  `album-hold-check.cjs` 34/34, and a jsdom load of the app with the new helpers (only the usual jsdom noise: no
  indexedDB, no canvas — 44 messages, none from this change).

## 63.0.1 (Sep 26, 2026): the Album History album drag — the release that finally reaches a 63 phone
- **Shipped number**: **63.0.1**. It went out as `62.1` first and was renumbered at the user's direction
  ("Release no.: 63.0.1") after they reported "I don't see the update" — see the next bullet for why 62.1 could never
  appear. The changelog entry, title and notes are **unchanged**; only the number and the ship stamp moved.
- **The user's words**: "I didnt get the update I need these able to reorder by me holding and dragging them it should be
  smooth bump ver to v62.1 patch notes", then "I don't see the update", then "Release no.: 63.0.1". Asked which version the
  phone showed they answered **phone = 63**.
- **Why 62.0.5 never arrived — the 63 trap, in full**: the OTA automation published a bundle numbered **63** *before* the
  62.0.5 release (`989d176 "Publish OTA bundle 63"`), and `dev/native-updates.js` applies one rule everywhere:
  `isOlderBundle(v)` → `compareVersions(v, currentVersion()) < 0` → refuse (lines ~194, ~499, ~570, ~652, ~1073, ~1201).
  A phone that ran 63 therefore silently refuses 62.0.5 — and it refused **62.1** too, which is exactly what "I don't see
  the update" was. The UI gate is `updateIsNewer()` → `compareVersions(published, APP_VERSION) > 0` (index.html ~13715), so a
  phone on 63 is shown *nothing at all* for any 62.x build; it does not even offer it. `compareVersions('63.0.1','63')` is
  **+1**, so the same release renumbered 63.0.1 is both offered and accepted. **Rule: to reach a device, the published
  number must be strictly greater than the number it is running — check the device's version before choosing a release
  number.** The 62.x line cannot reach that phone; a step above 63 (63.0.1 here, or 64 with the user's consent) is required.
- **What 62.1 actually changes in the code — one thing, and it is the "smooth" half of the report**: `updateIndex()` read
  `el.offsetHeight` and every `others[j].offsetHeight` **on every finger move**. `drive()` writes the lifted row's
  `transform` first and the reads come after it, so each move forced a synchronous re-layout of the whole list — classic
  layout thrash, and why a drag can stutter on a phone even when the maths is right. The list is now measured **once** at
  pickup (`slotTops` + a `slotMids` midpoint per slot + `pickH`, the lifted row's own height) and a move is arithmetic
  only. The rest of the gesture (420 ms hold, finger-following row, 0.18 s neighbour slides, 56 px edge auto-scroll,
  per-artist `sidecut_ahAlbumOrder`) is untouched from 62.0.5.
- **Mechanics** — three scripts, run in this order:
  `dev/patch-624.mjs` (3 count==1-markered index.html edits for the drag, `APP_VERSION` → `62.1`, the new CHANGELOG head
  entry inserted **in front of** the 62.0.5 one, 24 test repins), then `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs`,
  then `--manifest`. `dev/patch-625.mjs` advances only the sw.js cache name (62.0.5-era → `63.0.1` → **`63.0.2`**), and
  `dev/patch-626.mjs` renumbers the release `62.1` → **`63.0.1`** by rewriting the head entry's version and date in place.
  Final state: `APP_VERSION` 63.0.1, `sw.js` cache name `sidecut-shell-v63.0.2`, `ota-bundle` v63.0.1 · 687075 bytes,
  `ota-bundle-play` v63.0.1 · 687087 bytes, both `--check OK`.
- **Verified**: 28/28 `dev/test-*.mjs`, `check-dom` 0 failures, `dev/ah-album-reorder-check.cjs` **34/34** (it grew two
  shape checks: the list is measured once at pickup, and no `offsetHeight` read survives in the move path),
  `dev/album-hold-check.cjs` 34/34. The shipped notes in `ota/updates.json` are clean of every term
  `dev/test-6058` / `dev/test-60510` forbid.

## sw.js cache name (Sep 26, 2026): decoupled from APP_VERSION, then put back by 71.8

**SUPERSEDED by 71.8** - the cache name is the release number again (`sidecut-shell-v71.8`). What follows records WHY the
  decoupling happened (an early scheme shared one name across a whole version LINE, so the later release was served the
  earlier one's shell); 71.8 keeps that lesson by naming the cache after the full release number, which is unique per
  release. See `## 71.8` at the top of this file. — 63.0.1 → 63.0.2 → 63.0.3
- **The user's words**: "The sw.js can be 63.0.1", then "Just make the sw.js v63.0.2 you are not allowed to make full jumps
  from v63 to v64 without my consent". Only `sw.js`'s `CACHE_NAME` moves — it is now **`sidecut-shell-v63.0.2`** while the app
  is **62.1**. That name is a pure cache-buster: nothing in `index.html` compares it to `APP_VERSION` (there is no
  `SW_UPDATED` consumer at all), it only decides which stale caches `activate` deletes. So it is free to carry its own
  number, and the two are **no longer required to match**. The **63.x line belongs to the cache name alone**: it must never
  be copied into `APP_VERSION` or the CHANGELOG, and **stepping past 63 (to v64) needs the user's explicit consent** —
  they have ruled out whole-number jumps on their own.
- **User rule to honour**: the app's release number and the cache-buster's number are independent decisions, and the user
  chooses each one. Never infer one from the other, and never advance a whole version (63 → 64) or rename a release on your
  own initiative. Ask first.
- **Test contract changed**: `dev/test-*.mjs` used to assert `sw.includes('sidecut-shell-v' + ver)`. Those 12 files now assert
  the naming convention (`sw.includes("const CACHE_NAME = 'sidecut-shell-v")`, label "service worker has a versioned cache
  name"), and the five files that pinned a literal now pin `sidecut-shell-v63.0.2` (test-612, test-6136, test-6137,
  test-6138, test-6139). **A future release that bumps `APP_VERSION` must NOT repin the SW cache name to it** — bump `sw.js`
  on its own so the cache-buster stays independent.
- **Mechanics**: `dev/patch-623.mjs` (the 62.0.5 → 63.0.1 decoupling; the sw.js edit + 17 test repins) and
  `dev/patch-625.mjs` (63.0.1 → 63.0.2; the sw.js edit + the 5 pinned literals). Both take `--manifest` to re-seed root
  `manifest.json`. `sw.js` is inside **both** OTA zips, so `node dev/ota-bundle.mjs` and `node dev/ota-bundle-play.mjs`
  must be rebuilt after any `sw.js` edit (patch-623 alone left the sizes unchanged, because `62.0.5` and `63.0.1` are the
  same length; the 62.1 release changed `index.html`, so the zips grew to 687074 / 687086).
- **The zip size is NOT reproducible**: a rebuild of identical content can differ by a byte or two (an embedded timestamp),
  so the order is always `ota-bundle` + `ota-bundle-play`, **then** `patch-*.mjs --manifest`. `ota/updates.json`,
  `manifest.json` and `ota-play/updates.json` must record the size of the LAST build — rebuild after re-seeding and the
  recorded size is a build behind, which `--check` will flag. Verified after both patches: 28/28 `dev/test-*.mjs`,
  `check-dom` 0 failures, `ah-album-reorder-check` 34/34, `album-hold-check` 34/34.

## 62.0.5 (Sep 25, 2026): the albums in Album History drag like the albums in the Albums tab
- **The user's report, in their words**: "It should be v62.0.5 not v63 and you didn't fix the problem I should be able to
  hold and drag to reorder these albums in album history and it should be the smooth reorder like the albums in albums".
  Two complaints, and both were real: the release was versioned wrongly, and the v63 gesture was **dead on a phone**.
- **Version correction — 62.0.5, not 63**: the bundle published on the OTA channel is **62**, so a release named **63** was
  never a version anyone was offered. This build is **62.0.5**: `APP_VERSION`, the CHANGELOG head, `sw.js`'s
  `CACHE_NAME`, `manifest.json`, `updates.json`, `ota/updates.json`, `ota/manifest.json` and `ota-play/updates.json` all read
  62.0.5, and the 29 release assertions in `dev/test-*.mjs` were repinned. `compareVersions('62.0.5','62')` is **+1**, so it
  is an ordinary update for anyone on 62. **Caveat worth remembering**: a device that already ran the 63 build treats 62.0.5
  as OLDER (`isOlderBundle`) and will refuse the bundle — that device needs a fresh install, not an update.
- **Why the v63 build looked like nothing happened — three shape bugs, each fatal on its own**: (1) `begin()` lifted the row
  and called `el.setPointerCapture(...)` on the **`.dp-ah-album` wrapper** while every `pointermove` / `pointerup` listener
  was bound to **`.dp-ah-album-hdr`**, a *child* of it. A captured pointer is dispatched at the capture element and bubbles
  **up**, so `move()` and `finish()` never ran again: the row lifted and nothing followed the finger, and no drop ever
  committed. It also meant the artist group's `finish()` ran on the same `pointerup` and cleared the `reordering` body class
  mid-drag. (2) Nothing pinned `touch-action` and nothing swallowed `touchmove`, so Android was free to claim the vertical
  drag for the popup's scroller and fire `pointercancel` — the drag died the instant it started. The song drag says exactly
  this in a comment; the album drag ignored it. (3) The row never moved with the finger and the neighbours never slid, so
  even a working swap would have read as a jump rather than a drag.
- **The fix — the same shape as the two reorders that already feel right**: the album cards in the Albums tab
  (`window.__scDragDelta('cardDrag', 480)`) and the library grip drag (`'gripDrag'`). The lifted row now follows the finger
  with `translateY`, every other album is given `transition: transform 0.18s ease` and slides into the gap it is heading
  for, and the list auto-scrolls while the finger is held within 56 px of an edge (`'ahAlbumDrag'`), shifting the drag
  baseline as it scrolls. The auto-scroll step bails when `scrollHeight <= clientHeight`, so a list that cannot scroll is
  never spun (and a harness that reports zero heights cannot spin it forever).
- **Everything is bound to `document`, on purpose**: re-ordering a row removes and re-inserts it, which drops pointer capture
  and would strand row-bound listeners — bug (1) above. `touchmove` / `touchend` / `touchcancel` fallbacks cover WebViews
  that deliver no pointer events at all, `el.style.touchAction = 'none'` pins the gesture at pickup, `touchmove` is
  `preventDefault`ed for the length of the drag, and CSS now carries
  `body.reordering .dp-ah-album, body.reordering .dp-ah-album-hdr{ touch-action:none !important; }`.
- **The lift baseline is the pickup point** (`begin(pickY)` → `startY = pickY`). `dev/ah-album-reorder-check.cjs` caught this
  one: without it every move was measured from zero and the row leapt to the pointer instead of travelling with it.
- **Order is still per artist** in `localStorage "sidecut_ahAlbumOrder"` (`artist -> [collectionId|name]`), applied by
  `window.orderAlbumList(...)` from `_renderAhFromData` on a fresh render and by `window.__scApplyAHAlbumOrder(cont, artist)`
  to a body restored from `discPopupCache_📀 Album History`. The drop re-appends each row in the new order, so a nested track
  list travels with its album, and then writes the order once.
- **Gesture conflicts, unchanged from v63 and still deliberate**: the hold is **420 ms** and movement before it completes
  cancels it (a tap still opens the album's songs, and a drag on the list still scrolls); the album row's 500 ms cover hold
  stays scoped to the **artwork** (`[data-art-url]` / `img`); the artist-group hold bails on `.dp-ah-album`; a real drag sets
  `hdr._ahSuppressClick` so the release click cannot also toggle the track list; and the artist `finish()` now returns early
  while `window.__scAHAlbumDragging` is set, so it can no longer drop the album drag's `reordering` state.
- **History — what the 63 build actually shipped** (kept because both failure modes are easy to reintroduce):
- **The user's report, in their words**: first "In album history you click in an artist you click on an album you hold down
  the songs and try to reorder them but nothing happens", then the correction: **"Album history it should be the albums
  getting reordered not the songs inside, my mistake."** So the earlier "reorder songs inside an album" idea was the user's
  own misread of what they wanted — the list to make reorderable is the **albums under an artist**.
- **Measured first**: Album History renders `.dp-ah-artist` groups, each expandable to its albums (`.dp-ah-album`), each
  album expandable to its tracks (`.dp-ah-track`). The popup **already** reorders the *artists* — `setupGroupReorder` in the
  second `<script>` block drives them, keyed `sidecut_ahArtistOrder`. The **album rows under an artist were never wired to
  any gesture**; holding one did nothing, which reads exactly as "nothing at all opens". The user had been holding the
  tracks because that was where they expected a handle.
- **What the 63 build did**: new `window.__wireAHAlbumReorder()` (in the same block as `setupGroupReorderByContext`),
  called from `window.__wireAH` so it ran on every render (fresh and cached opens). Hold **420 ms**, then drag; a tap still
  opened the album's tracks and a pre-hold scroll still cancelled (same 12 px pickup rule as the artist list). Order persisted
  **per artist** in `localStorage "sidecut_ahAlbumOrder"` (`artist -> [collectionId|name]`). Everything above about the
  order store, the two apply paths and the gesture conflicts survives into 62.0.5; only the drag itself was replaced.
- **Order is applied in two places, because the popup body is cached**: `_renderAhFromData` now runs each artist's album
  array through `window.orderAlbumList(...)` before rendering, and `__wireAHAlbumReorder` also reorders an already-rendered
  (cached) body via `window.__scApplyAHAlbumOrder(cont, artist)`. Without the second path a reopen from the 24 h cache would
  have shown the pre-reorder order.
- **Two gesture conflicts were closed deliberately**: (1) the album row already had a **500 ms long-press that set a custom
  cover** — two holds on one row raced, so that hold is now scoped to the **artwork** (`[data-art-url]` / `img`), which its own
  comment always claimed it was, leaving the rest of the row for reorder; (2) the **artist-group** hold bails when the press
  landed inside `.dp-ah-album`, so the two reorders can never both start. A drag that reordered also sets `hdr._ahSuppressClick`
  so the release click does not additionally toggle the album's track list.
- **Regression coverage**: `dev/ah-album-reorder-check.cjs` (jsdom, needs `/tmp/h/node_modules/jsdom`) opens a real Album
  History popup, runs `__wireAH` over it, holds and drags an album, and asserts persist / `orderAlbumList` / cached-body
  apply / tap-still-opens / drag-does-not-toggle / cover-hold-scoped-to-art — **31/31**. It also pins the drag's **shape**,
  which is what the 63 build got wrong: document-level listeners, no `setPointerCapture`, pinned `touch-action`, swallowed
  `touchmove`, the touchmove fallback and the artist guard, plus that the row follows the finger and that a drop leaves no
  row lifted or transformed. `dev/album-hold-check.cjs` (library Albums view song reorder) still passes **34/34**. All **28**
  `dev/test-*.mjs` pass and `dev/check-dom.mjs` reports **0** integrity failures. `dev/patch-622.mjs` carries the idempotent
  edits and the 62.0.5 metadata.
- **Notes for the next release**: the CHANGELOG head at 62.0.5 is the first to describe Album History ordering; keep its
  notes free of `download*` / `convert*` / "play build" terms (dev/test-60510, dev/test-6058). The popup cache key is
  `discPopupCache_📀 Album History`; a reorder does **not** clear it (the order helper re-applies on the cached body instead).

## v62 (Sep 25, 2026): lyrics for an artist whose name is only a letter or two
- **The user's report, in their words**: "I'm not getting any lyrics for lesser known artists such as Bikramjit Dhaliwal".
  Same user, same library, right after v61.8/v61.9 — and v61.8 was about **BK**'s *Gangstas Paradise* / *MIXED FEELINGS*.
- **Measured first, and it reframed the report completely** (all Sep 25, 2026, live): `lrclib search?q=Bikramjit` → **0 results**,
  `search?artist_name=Bikramjit Dhaliwal` → **0 results**, `get?artist_name=Bikramjit Dhaliwal&track_name=<any title>` → **404**.
  The name is not filed anywhere. A web check explains why: **"Bikramjit Dhaliwal" is the WRITER credit, not the performer —
  the artist is "BK"** (MusicBrainz: `lyricist: BK (Bikramjit Dhaliwal)`; Musixmatch/Shazam/Gaana credit him as writer on
  *College*, *Ferrari*, *Bodyguard*, *MESMERIZED*, *IN THE STREETS*, *Missed Calls*, *Icy*). lrclib DOES file his songs under
  "BK": `get?artist_name=BK&track_name=Mob Ties (Intro)` → 200, `.../MOTION` → 200, `.../Aaja Billo` → 200, `.../College` →
  200, `.../Bodyguard` → 200, `.../47` → 200; `search?track_name=Icy` → "Icy" by "BK & Jay Trak". **So the entries were there
  and the app refused them** — a lookup bug, not a coverage gap.
- **The measurement that pinned it**: `dev/_probe_rank.mjs` (temporary, since deleted) lifted the SHIPPED matcher out of
  index.html by brace matching and drove it against LIVE lrclib answers — entry title, entry artist and entry length real:
  `"Mob Ties (Intro)" by "BK" 168 s, tag "BK", drift +0 s` → ACCEPT · `drift +3 s` → **refuse** ·
  `tag "Bikramjit Dhaliwal"` → **refuse** even at drift 0. After the fix: all three ACCEPT (and the writer-credit case at
  drift +0 only — see the ceiling below).
- **Root cause — v61.8's bug, in the lyric matcher: a name of two letters or fewer is dropped, so it can neither confirm nor
  be compared.** Two functions, both blind: `scLyricsRank` builds `aHit` from tokens of `w.length >= 3` only, so "BK"
  contributed nothing and acceptance rested on a length within 2 s — any re-encode drifting 3 s read as "no lyrics" even with
  the artist's own name on the entry. `scLyricsArtistVerdict` filters **our** tokens to `>= 3` *and* skips the **entry's**
  tokens `t.length < 3`, so an entry filed under "BK" could never say `match` and the comparison fell straight through to
  `foreign` — a hard refusal.
- **The fix**: v61.8's rule, applied to lyrics — **a name of two letters or fewer can CONFIRM but never REJECT.** In the scorer
  a short token counts as an artist hit, word for word (never a substring); in the verdict the short-name question is asked
  before `foreign` can be returned, and `foreign` now additionally requires the entry's credit to have a word of three or more.
  Crucially the short confirm runs **only when the credit has no longer word to go on** (`longWords` / `!ours.length`), so
  "DJ Snake" still cannot be confirmed by "DJ Khaled" — pinned in test-620 `[2e]`.
- **Strictly additive, and that is the whole safety argument**: any path that already found lyrics scores exactly as before, so
  the change can only turn a refusal into an acceptance. The v61.3.8 guard rails all hold: exact title still required for a
  length-only match, `verdict !== 'foreign'` still required, a real long credit that contradicts ours is still refused,
  transliteration drift still matches, imprints still say nothing.
- **The honest ceiling, recorded rather than papered over**: (1) **lrclib simply has no "BK" entry** under *Scarface*,
  *Mesmerized*, *IN THE STREETS*, *LIFESTYLE*, *In God We Trust*, *Missed Calls*, *Gangstas Paradise* — `search?track_name=`
  returns 20 other artists' songs and no fix can conjure the entry; (2) for the writer-credit tag the length bar is unchanged,
  so **drift > 2 s is still refused** for that spelling (nothing in the strings links "Bikramjit Dhaliwal" to "BK");
  (3) "Icy" by "BK & Jay Trak" still cannot be claimed by the writer credit, because that credit has real long words that
  match nothing — that is `foreign`, correctly.
- **Two providers in the chain are DEAD and were deliberately NOT touched this release**: `some-random-api.com/lyrics` → 403
  `{"error":"key required"}`, `lyrist.vercel.app` → 429 for every anonymous call (both re-measured from here; also measured
  dead in the v61.7 session). They cost up to ~9 s of the 12 s lookup deadline *after* lrclib and lyrics.ovh have already
  missed — i.e. exactly on the lesser-known-artist path. Removing them is a behaviour change of its own and belongs in its own
  release; also probed live and rejected as replacements: JioSaavn `lyrics.getLyrics` (always
  `{"status":"failure"}`), QQ Music (500), Genius search API (403 with a browser UA), chartlyrics (404), textyl (dead),
  LyricsPlus (429). Only **lrclib.net and api.lyrics.ovh** actually send `Access-Control-Allow-Origin: *`, which is why they
  are the two that work in a browser context (on device `CapacitorHttp` patches fetch, so CORS is not the limiter there —
  coverage is).
- **One pre-existing blind spot worth knowing, left as it was**: when OUR tag is short (`ours.length === 0`), the verdict is
  `unknown`, so a same-titled stranger within 2 s can still be served on length alone. That predates this release and is
  `unknown` on purpose — tightening it to `foreign` would LOSE the real "BK" vs "Bikramjit Dhaliwal" pairing, which is the
  user's own case. It is pinned as behaviour, not fixed.
- **Mechanics**: `dev/patch-620.mjs` (2 index.html edits + APP_VERSION + the `62` changelog head + sw.js), `dev/test-620.mjs`
  (50 assertions — it lifts `scLyricsRank` and `scLyricsArtistVerdict` out by brace matching and drives them against the exact
  measured lrclib shapes, plus the "DJ Khaled" safety case). Then `node dev/ota-bundle.mjs` && `node dev/ota-bundle-play.mjs`
  && `node dev/patch-620.mjs --manifest`, `--check` both. Full suite green (**28 files**), `check-dom` → 0 integrity failures.
  Repins: `ver === '61.9'` in 16 test files, the `sidecut-shell-v61.9` pins, the `61\.9` head-regex pins (the new version has
  no dot to escape), test-6052's ship-date pin, test-6139's head-entry pin, and test-619's head-entry message. Version went
  `61.9 → 62`, in the shape of the earlier rolls (`58.9.9 → 59.0`, `60.5.9 → 61`); `compareVersions` and `cmpVer` both read a
  dotless `62` correctly (`62` vs `61.9` → 62 wins), so no legacy-version map entry was needed.
- **Delivery scope, at the user's request**: the v61.9 Get Songs change is **Play-channel only** (it lives inside
  `if(SC_IS_PLAY){`; the full build's markup, cards and format explainer are untouched — pinned by test-619 `[2d]`). The v62
  lyrics change is deliberately on **both** channels, as the earlier lyrics work was.

## v61.9 (Sep 25, 2026): the store build's Get Songs tab is steps only
- **The user's ask, in their words**: "Get songs tab should have no converters on play version and should simply have
  steps of how to get mp3's in your library". A follow-on to the v61.8-conversation ask that the Play build carry no
  downloader/converter references anywhere.
- **What the Play build was still showing in that tab**, found by reading the markup rather than assuming the v61.x hiding
  was complete: only the two Spotify/YouTube cards were hidden (`ytCard*`, `spCard*`). Still visible were the
  **`🎛️ Conversion Tools` header** (`Spotify · YouTube · MP4 · Expand URL`), the **Expand URL card**, the
  **MP4 to WAV/FLAC/MP3 card**, and the **`💡 Audio formats explained`** guide — and the tab's own copy taught the converter
  as well ("Paste the link into the built-in 🎵 Spotify to MP3 / WAV / FLAC converter below").
- **The fix, both halves, in the `if(SC_IS_PLAY){` header block** (v61.9 `dev/patch-619.mjs`): (1) the Get Songs how-to box in
  each tab (`getSongsHowToDisc` on Discover, `getSongsHowToSettings` in Settings) is rewritten into a 5-step walkthrough —
  put the MP3s on the phone → `+ Add songs ▾ → + Files` → `+ Add folder` for a whole album → tags land in
  `Playlists → All songs` → `Import library` restores the backup `.zip`; and (2) the **whole tool section is put away**.
- **The tool section is hidden BY POSITION**: it is the element immediately AFTER each how-to box in the markup, so the code
  does `_el.nextElementSibling.style.display = 'none'`. No markup was reshaped and no id was invented. **Hiding rather than
  removing is the point**: the converter wiring further down (e.g. `mp4FileDisc`/`mp4FileSet`, the expand-URL buttons) still
  finds every element it looks up, so a screen that no longer shows a tool can never become a null for the screen that does.
  The full build never enters the branch at all and is byte-for-byte unchanged.
- **Verified by walking the markup, not by trusting the comment**: `dev/test-619.mjs` (55 assertions) carries a real
  tag-depth walk (`elementEnd`, quote-aware so a `>` inside an attribute cannot end a tag early) and PROVES for both tabs that
  (a) the Conversion Tools section is **not nested inside** the how-to box and (b) it **is** the very next element — which is
  the single assumption `nextElementSibling` rests on. It also runs the shipped `_getSongsSteps` concatenation and checks the
  five steps, and pins that all 20 ids the tool wiring looks up are still present in the file.
- **Where the outside-site links actually live** (worth remembering): `spotisaver.net` / `spotmate.online` are in the two
  HOW-TO BOXES, which the Play header rewrites — not in the tool section it hides. So "the links are wiped, not merely
  hidden" is a claim about the box. The only other two (the full build's in-app fallback) sit after the Play branch's
  licensed-catalog return. test-619's first draft pinned this to the wrong element and was corrected by the failure.
- **Play copy audit widened to the newly-closed surface**: `dev/test-play-copy.mjs` [1] now also asserts the walkthrough is
  what a Play reader gets, that it names no converter/site/tool, and that the section below it is put away. Its [3] gained
  the **same narrow "Get Songs"-surface exemption [2] already had** — the 61.9 head note's TITLE names that screen, which is
  navigation, not a downloader reference; the singular "Get Song" still trips the wider list (pinned in [2]).
- **Two stale pins updated, not worked around**: `dev/test-6058.mjs` pinned the OLD one-liner's wording
  (`getSongsHowToDisc … to import them.`) and now pins the walkthrough + the put-away section; test-6052's ship-date pin and
  the usual `ver ===` / `sidecut-shell-v` / `61\.N` head-regex repins went through `patch-619.mjs`'s REPINS list.
- **Mechanics**: `node dev/patch-619.mjs` (2 index.html edits — the block comment and the code it describes — then
  APP_VERSION, the changelog head, sw.js and the repins); then `node dev/ota-bundle.mjs` && `node dev/ota-bundle-play.mjs`
  && `node dev/patch-619.mjs --manifest`, then `--check` on both.
  Full suite green (27 files). `node dev/check-dom.mjs` → 0 integrity failures. Play channel: 681053 bytes.

## v61.8 (Sep 25, 2026): a co-credited song is found on the artist's own channel again
- **The user's report, in their words**: "Tried on 2 different albums and came back no matching source fix this" /
  "I tried 2 different albums and both of them have no source found". Both lines are the SONG LOOKUP (the converter rows), not
  lyrics: `'no matching source'` and the search-empty `'no source found'` live only in the downloader (`window.__scSourceFail`).
- **Measured first, and the harness also named the albums**: `dev/_probe_convert.mjs` was the previous session's temporary
  diagnostic — it lifts the shipped search + verify pipeline out of index.html and drives it against the LIVE network. Run on
  the two albums it names (BK's **Gangstas Paradise** and **MIXED FEELINGS**), it reproduced the report exactly:
  Mob Ties (Intro)/BK → FOUND · In God We Trust/BK → FOUND · LIFESTYLE/BK → FOUND ·
  **Scarface / "BK, Arsh Heer" → null "no matching source"** · **IN THE STREETS / "BK, Jay 1" → null "no matching source"**.
  The split is the signal: the two that failed are exactly the tracks with a MULTI-ARTIST credit.
- **Root cause, in `scArtistMatch`**: each credited artist is judged on its own (that was v60.1's fix), but a credit's word list
  is built with `filter(w => w.length > 2 && ...)` as the stop-word rule — so a **two-letter artist name is dropped entirely**,
  the credit hits `continue`, and only the LONG half of "BK, Arsh Heer" could ever match. A second temporary probe
  (`dev/_probe_bk.mjs`, dumped every candidate with its real channel + the verdicts) proved the rest of the pipeline was fine:
  for Scarface the CORRECT upload (title "Scarface", channel "BK", author "BK - Topic", 144 s = the track's own length) is
  returned by the search, passes `scTitleMatch`, passes the length gate, and is refused **by the artist check alone**.
  The solo-"BK" tracks passed for the opposite reason: with no word left to judge on, `tried === 0` returns true and the whole
  artist check is skipped.
- **The fix**: a credit whose every word is short may **CONFIRM** a source but never **REJECT** one. A short-only credit is
  matched word-for-word (never as a substring — two letters would also hit inside unrelated words), and when it does not match it
  counts for nothing: `tried` is untouched, so a solo short name keeps the old "nothing to judge on" answer. **The change can
  only ever turn a refusal into an acceptance, never the other way round** — that is the entire safety argument, and it is why no
  path that already worked can start failing. It confirms on the real uploader name only (see the dead gate below).
- **Verified with the shipped code, not a copy**: `dev/test-618.mjs` (30 assertions) extracts `scArtistMatch` from index.html by
  brace matching and drives the live-reported shapes. Re-running the live probe against the patched file: all five tracks
  resolve, the two failures to their CORRECT uploads, and the three that already worked to the same uploads as before.
- **Found on the way, deliberately NOT fixed**: the `topic` gate in `scArtistMatch` is **DEAD CODE**. `topic` is computed from
  the NORMALIZED owner/author and `norm()` strips every non-alphanumeric, so the literal `"- topic"` suffix `/- topic$/` looks
  for can never survive (`"BK - Topic"` normalizes to `"bk topic"`). Both `topic && hasArtist(...)` lines — and the `topic &&`
  clause the first draft of this fix leaned on — have therefore never run on any build. Switching it on would widen what counts
  as the artist, which is a change of its own with its own measurement, so it is pinned as unreachable in test-618 [2d] and
  noted in the source rather than turned on in the middle of this fix.
- **Mechanics**: `dev/patch-618.mjs` (idempotent, count==1 needles, one atomic write at the end; it also carries a `subOpt`
  migration so the intermediate wording its own first draft wrote is brought to the final one), `dev/test-618.mjs` (30
  assertions), then `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs` and `node dev/patch-618.mjs --manifest` in that order (the
  manifest re-seed reads `ota/updates.json`). Repins: `ver === '61.7'` in 15 test files, the `sidecut-shell-v61.7` pins, the
  `61\.7` changelog-head regex pins, test-6052's ship-date pin, and **test-617's head-entry wording pin** — which had to start
  reading its OWN 61.7 entry instead of the head, the exact repin 61.7 gave to 61.6.
- **The honest ceiling**: this fixes a co-credited song whose source sits on the shorter-named artist. It cannot make a source
  carry a song it does not have. "No source found" (the search itself answering with nothing) is a different failure line and
  was not what these two albums hit; if it is ever reported, probe the search response before touching the verify stage.

## v61.7 (Sep 25, 2026): lyrics for a song that has only just come out
- **The user's report**: "The lyrics for new songs aren't fetching well they are but not showing like Aujla szn 1
  EP just came out but I can't get lyrics for them." The EP is Karan Aujla's AUJLA SZN 1, released that day.
- **Measured first, and it mattered**: lrclib.net had NO entry for any of its five tracks on release day
  (`search?q=Karan Aujla Ashke` → [], `search?track_name=Rap Killa` → [], `search?q=aujla szn 1` → [],
  `api/get?artist_name=Karan Aujla&track_name=Ashke` → 404) — while `search?track_name=Ashke` returned 20 OTHER
  artists' Ashke songs. So no matcher could have found them, and "the lookup is broken" was the wrong diagnosis.
  Also measured: **lrclib.net answered 503 `ServerOverloaded` twice in a row** (release-day load), and BOTH
  Genius-derived fallbacks are dead as shipped — `some-random-api.com/lyrics` → 403 `{"error":"key required"}`,
  `lyrist.vercel.app/api/...` → 429 for every anonymous call. The live list is lrclib + lyrics.ovh (old catalog).
  Musixmatch needs a token, Deezer removed its lyrics endpoint, Genius blocks non-browser clients (403 here).
- **Two real defects came out of that**: (1) one 1.3 s retry turned a BUSY source into "no lyrics found"; (2) nothing
  ever looked again at a song that came back empty — the sheet only re-looks-up when the user opens it.
- **The fix**: a busy answer is retried off a growing wait table (700 / 1600 / 3000 ms, still inside the 12 s
  lookup deadline) and the failure reason is remembered, so the empty state says "the database was busy" or
  "could not reach it" instead of pretending nothing exists; a real answer clears a stale busy note. A song added
  in the last fortnight also gets told that a brand-new release reaches the databases a day or two later.
  Then `scLyricsRecheckRun()` re-checks lyric-less songs in the background — at most 5 per pass, at most once per
  song every 6 h, never-checked first, ~1.2 s apart, run 20 s after boot and 45 s after an import — so the words
  appear on their own. It never touches a song with lyrics already saved, and **never one whose words were typed
  by hand (those live in the song's notes)**; it stamps `lyricsCheckedAt` (persisted with the track record) on hits
  and misses alike, which is what holds the whole library to one question per 6 h.
- **Mechanics**: `dev/patch-617.mjs` (15 index.html edits, idempotent, count-asserted, one atomic write),
  `dev/test-617.mjs` (66 assertions — and it RUNS the shipped code: `scLyricsJson` and `scLyricsRecheckRun` are
  lifted out of index.html by brace matching and driven with a fake network / fake library). Two old assertions
  were repinned rather than deleted: test-6137's "no example release name anywhere" is now scoped to the add-drop
  sheet's own builder (the notes may name a real release), and test-6138's `why.style.display = scLyricsStrangers ?`
  became "show whenever there is something to say". Bundles rebuilt via `dev/ota-bundle.mjs` +
  `dev/ota-bundle-play.mjs` then `node dev/patch-617.mjs --manifest`.
- **For the next person**: the honest ceiling is the source. A release-day song is not in LRCLIB and the app cannot
  conjure it; what it can do is keep asking and say why. If a NEW provider is ever added here, it has to be probed
  live from a phone-shaped request first — all three "Genius-derived" fallbacks this file already carries are dead,
  and two of them fail fast enough that nobody noticed.

## v61.6 (Sep 25, 2026): the lookup stops asking dead sources, saving a video stops freezing, mark-all moves up
- **The user's report, in their words**: "no source found" on older EPs/albums, and "whenever I try to convert
  YouTube to mp3 the app freezes and nothing works". Two different failures, same file (`dev/patch-616.mjs`).
- **Measured, not guessed**: the Innertube client list carried six clients; re-probing the SHIPPING request shape
  showed only ANDROID (3) and IOS (5) still return playable audio — ANDROID_VR → LOGIN_REQUIRED,
  TVHTML5_SIMPLY_EMBEDDED_PLAYER → 404, WEB_EMBEDDED_PLAYER → ERROR, MWEB → UNPLAYABLE. A dead client is not a
  fallback: it costs a full connect + read timeout per track on the way to the same "nothing", which is exactly
  why a working lookup read as a broken one. The list is two entries now, with the probe results in the comment.
- **An empty result had no second candidate behind it**: `take()` kept exactly ONE stream per pool, and the
  top-ranked audio-only row is the one YouTube caps at its first megabyte for a music upload — so the only
  candidate was the one that cannot be fetched. It now gathers up to `want` rows per pool (3 audio-only, 2
  muxed) and returns how many it kept, so `scFetchDecode` walks past a capped or refused stream.
- **The freeze was the encoder, not the network**: the video-link path called plain `scEncodeAudio`, whose whole
  lamejs pass is one unbroken loop on the main thread (~8M samples for a three-minute track). It now calls
  `scEncodeAudioCooperative` with a progress callback — every other conversion path already did.
- **Mark-all-as-read moved to the TOP of the New releases panel**, and TWO places had to move: the panel's own
  markup, and `__scDiscRelTab` — which re-`appendChild`s that button after the rows on EVERY render, so fixing
  only the markup puts it straight back at the bottom.
- **Mechanics**: `dev/patch-616.mjs` (idempotent, count==1 needles, one atomic write at the end),
  `dev/test-616.mjs` (44 assertions), then `dev/ota-bundle.mjs` + `dev/ota-bundle-play.mjs` and
  `node dev/patch-616.mjs --manifest` in that order (the manifest re-seed reads `ota/updates.json`).
- **Do not assume a patch script's replacement text is what shipped**: index.html's wording can be NEWER than the
  script's (a reworded needle still skips via its marker), so match new needles against the CURRENT file.

## v61.5 (Sep 25, 2026): two release lines that both called themselves 61.3.8/61.3.9 became one
- **What happened**: `origin/main` and the local line had each been shipping under the SAME version numbers
  for DIFFERENT work — local `61.3.8` was the lyrics-identity fix while origin `61.3.8` was the dated-drops
  fix, and both had a `61.3.9`. Merging origin/main (v61.4) in needed one number nobody had used: **61.5**.
  Local's two releases are folded into a single 61.5 changelog entry (their notes, in order); origin's
  history (61.4, 61.3.9, 61.3.8 …) is kept exactly as published, and all four original AGENTS sections stay
  below verbatim — read them as "local line" and "origin line", not as one timeline.
- **The merge broke index.html in three ways, and `dev/merge-audit.mjs` is what caught them**: run it after
  ANY merge — it reads `git show :1/:2/:3:<file>` for both parents, diffs each against the merge base, and
  prints every line that side added which the merged file then lost. It found (1) the whole
  `__scNativeFetch` definition dropped, so `fetchWithProxy` still called it and the ReferenceError was
  swallowed by its own try/catch — every phone silently fell back to page fetch + CORS relays, i.e. the
  exact "converters stopped working" symptom; (2) a stray `}` left by the Apple-guard splice, which closed
  the outer try of `fetchArtistReleases` early and stopped the ENTIRE main script from parsing (a blank app,
  not a subtle bug — check `new Function` on every inline block BEFORE trusting a merge); (3) no 61.5
  changelog head entry, so `APP_VERSION` and `entries[0].version` disagreed.
- **Rule for the next merge**: resolving a conflict is not finishing it. The audit script + the full
  `dev/test-*.mjs` suite are the finish line, and the file tools silently cannot reach into `index.html`
  (2.3 MB) — they only match near the head of a file, so every index.html edit still goes through a
  `dev/patch-*.mjs` script like this one.
## v61.4 follow-up (Sep 24, 2026): MusicBrainz must be asked BOTH ways — that was the real "no dated drops"
- **The user's follow-up, verbatim**: "Musicbrainz don't have the dated release for upcoming releases but
  Spotify has it but I don't want my app to take the user to Spotify or verify anything for that except.
  Make the upcoming release actually work". v61.4 shipped MB + Wikidata but **the live probe still returned
  0 dated future releases for every mainstream artist** — so "actually work" was not yet true.
- **Root cause (measured live this session, `dev/_probe_*` then deleted)**: MusicBrainz has TWO relevant
  endpoints and they DO NOT AGREE. `release-group` is the canonical album/EP/single; `release` is the
  concrete pressing. An announced-but-not-yet-pressed drop often exists on exactly ONE of them:
  - The Weeknd → release-group **0**, release **1** ("House of Balloons", 2026-10-13).
  - Taylor Swift → release-group **3** (Patient Zero + acoustic + piano), release **1** (Patient Zero) —
    the two lists overlap but are not equal, which is why merging on **normalized title + day** (not id) is
    required or the same drop shows twice.
  - Query shape was NOT the bug: `artist:"X" AND firstreleasedate:[today TO today+400d]` returns 0 for
    The Weeknd while each clause alone returns 200/2776 — MB genuinely has no release-group row for him.
    `arid:` + range behaves the same as `artist:` + range, so the artist-name form is fine.
- **The fix — `scFetchMbUpcoming` now loops a `passes` table over BOTH endpoints**, each with its own list
  key, type key, date field and range field:
  `[{path:'release-group', list:'release-groups', typeKey:'primary-type', dateKey:'first-release-date', range:'firstreleasedate'},
    {path:'release', list:'releases', typeKey:null, dateKey:'date', range:'date'}]`
  - **Both reads run CONCURRENTLY** (`Promise.all` over `passes.map(...)`) — each is budgeted at 4s, so two
    sequential reads could burn the whole 8s per-artist race in `checkPinnedArtistReleases` on one artist.
    Do not "simplify" this back to a sequential `for` + `await`.
  - A `release` row has no `primary-type`, so the Album/Single/EP filter applies only when a type exists
    (classify-if-present) — that endpoint cannot smuggle in a compilation.
  - Dedupe `seenMb[normalizedTitle + '|' + day]`, results sorted by date, each row's `url` points at its own
    endpoint (`/release/…` vs `/release-group/…`).
- **Verified live against the real API through the SHIPPED function** (extracted from index.html, run in
  Node): Taylor Swift 4, The Weeknd 1, Baron Noir 1, Tracy Bonham 2 dated drops. The Weeknd's came only
  from `release` — direct proof the second endpoint is load-bearing.
- **"No Spotify" stays true**: nothing in the release path logs in, connects, verifies, opens a window or
  touches a token. Confirmed by the suite's `!accounts.spotify && !window.open` assertions.
- **Mechanics**: `dev/patch-614.mjs` (now 26 index.html edits; still fully idempotent — rerun = 0 edits),
  `dev/test-614.mjs` gained `[6b2] MusicBrainz is asked both ways` (10 assertions), and two historical pins
  were repinned because they matched the old single-endpoint source text:
  `dev/test-6136.mjs` (release-group URL, `firstreleasedate:` literal, `rg['first-release-date']`, the
  `await fetchWithProxy` line) and `dev/test-6139.mjs` (the MB fetch line + the `SC_RELEASE_FETCH` count,
  which stays **7** = 1 definition + 6 call sites — one call site now serves both endpoints, so it does NOT
  climb to 8). Both repins are tolerant/idempotent so a rerun can't double-apply.
- **Verified**: all 22 `dev/test-*.mjs` green; `ota-bundle --check` + `ota-bundle-play --check` OK — v61.4,
  6 notes, Play flag baked.
- **Lesson for next time**: when a "find upcoming releases" source comes back empty, test EACH endpoint of
  the service separately before concluding the artist has nothing. MB's `release` and `release-group` are
  different data with different date fields, and the concrete one is often the only one that has an
  announced drop. Also: a search endpoint returning 0 for `A AND B` while `A` alone returns 200 is a signal
  that the *data* is missing, not that the query is malformed.

## v61.4 (Sep 24, 2026): Upcoming dates come from TWO open catalogs (MusicBrainz + Wikidata)
- **User directive, verbatim**: "Musicbrainz don't have the dated release for upcoming releases but Spotify
  has it but I don't want my app to take the user to Spotify or verify anything for that … just make the app
  look it up." So: **no Spotify login/connect/verify/token/backend anywhere in the release path** — every
  drop date is read from a keyless open catalog.
- **The gap that prompted it**: v61.3.6 shipped ONE open source, MusicBrainz (`__scMbUpcoming`), and it is
  thin. A live sweep found **0 future release-groups for Diljit Dosanjh, Karan Aujla, AP Dhillon, Drake,
  The Weeknd, Ariana Grande** — whole catalogues come back empty. iTunes (`entity=album`) and Deezer
  (`/artist/{id}/albums`) carry **nothing** dated in the future at all (pre-orders don't surface in search):
  re-probe before re-litigating, 5 major artists → 0 future rows on both.
- **The fix — `scFetchWdUpcoming` / `window.__scWdUpcoming`**, defined right after `__scMbUpcoming`: ONE
  open **Wikidata SPARQL** query per pinned artist, no key, no window.
  - Query: `SERVICE wikibase:mwapi` EntitySearch on the artist name → `?album wdt:P175 ?performer` →
    `?album wdt:P31/wdt:P279* wd:Q482994` (album) → `?album wdt:P577 ?date` → `FILTER(?date > NOW())`,
    English label service, LIMIT 25.
  - Endpoint `https://query.wikidata.org/sparql?query=…&format=json` sends
    `access-control-allow-origin: *` and answers the browser's `fetch` (verified from a localhost page in
    the sandbox), so it goes through `fetchWithProxy(url, SC_RELEASE_FETCH)` like every other catalog read —
    direct first, proxies as fallback, 4 s budget, `catch(_e){ return []; }` so it can never wedge the run.
  - Filters: `__scDay10` + `__scUpcomingDay` (day precision only, future, ≤400 d), title must be a real
    label (a bare `Q\d+` stub is refused — don't list an item by its Q-id), and the pinned artist must be
    credited (`primaryArtistName` both sides, bidirectional substring like the MB/iTunes passes).
  - **Verified value-add**: Paulo Londra and Cesare Cremonini have **0** MusicBrainz future releases but
    Wikidata carries "Entre cielos" (2026-10-21) and "Amateur" (2026-10-23). End-to-end in Chromium: pin
    Paulo Londra → check → Upcoming tab shows exactly his dated drop, and the Spotify probe shows
    `spotify network touched: false | popups opened: 0`.
- **Merge (in `fetchArtistReleases`)**: a second block mirrors the MusicBrainz one — source key
  `'wdt:' + nt + '|' + x.date` in `prevKeys`, defers to `freshTitles` (Apple listed it) and to any entry
  already in `fresh` from MB this run, and **dates an undated stored row in place** rather than adding a
  duplicate. `SC_RELEASE_FETCH` count is now **7** (defined + 6 catalog reads); `dev/test-6139.mjs` was
  updated to that number.
- **Version**: APP_VERSION/sw.js/CHANGELOG head/root manifest → **61.4** (7 notes; the rollout line is
  61.3.x, so 61.3.9 → **61.4**, never a rolled-over `x.y.10`). `dev/patch-614.mjs` is the single idempotent
  pass (3 index.html edits on this turn: the Wikidata fn, the merge block, the changelog note); it also
  repins tests and re-seeds root `manifest.json`. `dev/test-614.mjs` grew a `[6b]` section (14 checks).
- **Verified**: 5 inline `<script>` blocks parse (`new Function`); the FULL `dev/test-*.mjs` suite
  (22 files, test-614 = 59 checks) green; both OTA bundles rebuilt + `--check` clean —
  v61.4, 6 notes, Play flag baked (zips 663047 / 663058 bytes).
- **Lyrics (same release, separate user report)**: smaller artists showed wrong/missing words. `lyrist`
  now validates the title+artist it returns, `textyl` (no title/artist in its reply — unverifiable) is no
  longer auto-surfaced, and an LRCLIB match on a coincidental duration now also needs an exact title. The
  highlight holds while paused and survives being backgrounded (the poller used to clear itself on hide and
  nothing re-armed it).

## MANDATORY VERSION RULE (Sep 23, 2026): NEVER ship 60.5.10-style versions — it should be v61
- **User rule, verbatim intent**: "No v60.5.10 that doesn't fucking exist and I fucking hate that … never fucking do that, it should be v61."
  After **60.5.9** the next release is **v61**. Do NOT invent a `.10` step in the 60.5.x line (or any rolled-over patch like `x.y.10`) — when a patch line
  would exceed 9, bump the way the user says: **v61**, not 60.5.10.
- Keep these aligned on every version change: `APP_VERSION` (index.html), sw.js `CACHE_NAME` (`sidecut-shell-v…`), the CHANGELOG head entry version, every
  `dev/test-*.mjs` `ver === '…'` pin — then rebuild both OTA bundles (`node dev/ota-bundle.mjs && node dev/ota-bundle-play.mjs`, both with `--check`) and run
  the whole `dev/test-*.mjs` suite before committing/pushing.

## v61.3.9 (Sep 25, 2026): the lookup chain was riding dead CORS relays — Spotify/YouTube imports, the drop check
- **User report**: "the Spotify converter used work then it just stopped working … Dawg it worked before … Fix it."
  Note the trap at the start of this release: commit d2dee07's MESSAGE already claimed "v61.3.9: Spotify import,
  YouTube convert, and upcoming album drops" but its diff never contained the code — the written-but-unrun
  `dev/patch-6139.mjs` was the only trace. **A commit message is not the fix; grep the marker** (`__scNativeFetch`)
  before believing a fix shipped. `61.3.9` is also the LAST of the 61.3.x line — per the mandatory version rule the
  next release must not be 61.3.10.
- **Measured root causes (re-probe before re-litigating)**: corsproxy.io → 401 ("A valid API key is required"),
  api.allorigins.win + api.codetabs.com → curl 000 (still down) — every public-relay leg of `fetchWithProxy` was dead;
  Spotify's embed pages and youtube.com/oembed send NO `access-control-allow-origin` (only open.spotify.com/oembed
  and itunes.apple.com answer `*`), so a WebView page fetch of them can never work even with the relays alive;
  `window.__ahCancelled` stayed latched after ONE cancelled Album History fetch, so every one of the 50+ shared
  `fetchWithProxy` callers answered null for the rest of the session; `fetchArtistReleases` returned `[]` the moment
  the iTunes pass failed (`if(!resp || !resp.ok) return []`) — killing MusicBrainz + silent-Spotify, the only DATED
  sources; MusicBrainz 403s a request with no identifying User-Agent and a page fetch cannot set one; and
  `fetchWithProxy` ignored the caller's `init`, so the Gemini lyrics POST went out as a plain GET.
- **The fix (one idempotent `dev/patch-6139.mjs` pass)**: `__scNativeFetch(url, opts)` — CapacitorHttp first
  (`responseType:'arraybuffer'`, 8 s read/connect clocks, Response-shaped `{ok,status,json,text,blob,arrayBuffer}`),
  null when not native. `fetchWithProxy(url, init)` now (a) self-heals the cancel flag (`if(!window.__ahFetching)
  window.__ahCancelled = false`), (b) tries native first forwarding `init`, (c) direct fetch with `init`, then
  `[allorigins, codetabs, cors.lol]` replaying plain GETs — corsproxy.io deleted everywhere (`scSpOembed`,
  `expandSpotifyUrl`, OTA manifest check too). `scSpEmbedEntity`/`scSpEmbedTrack` queue `'native:'+url` per try.
  `fetchArtistReleases` hoists `prev/prevKeys/fresh` and guards Apple with `if(resp && resp.ok){ … }` (closed before
  the dated-drops pass). `scFetchMbUpcoming` sends `User-Agent: SideCut/<ver> (…)`. YouTube's oEmbed title leg now
  rides the shared fetch (it could never have worked in a WebView before).
- **Changelog rules re-learned here**: a head entry needs `items.length >= 5` (test-6053/54/55/56/57/58 all assert
  it) and may NEVER contain a STRONG term — `converter|convert*|download*` are banned in EVERY note by
  test-60510's `!/\bdownload|converter|convert\b/i` and test-6058's `STRONG.test(mp.notes)` — nor `play build/
  version/install`. Six compliant notes; the entry's title was reworded off "converters" too (nothing scans titles,
  but don't start). **When a release test asserts on "the head", re-pin its CONTENT block to its own entry by
  version** (`const own = entries.find(e => String(e.version) === '61.3.8')` — test-6138 [7]) while leaving the
  `head`/`head.date` lines byte-identical to the strings the patch's repin pairs write, or a re-run throws count!=1.
- **Patch-script escaping gotcha (cost this session)**: needles written inside template literals get EVALUATED — a
  raw run of 4 backslashes yields 2, but the test files hold ONE (`\[`, `\n`, `\{`, `\.`, verified by
  `(line.match(/\\+/g)||[]).map(r=>r.length)` → the file is [1,1,1,1,1], the needle must be [2,2,2,2,2]), and a
  bare `\.` in a template eats the dot. The count==1 assertion caught it BEFORE index.html was written (the write
  sits at the end of the pass) — first `scSpEmbedTrack expectOld found 0`, then `test-6137 newest-entry regex
  found 0`. Fix scripts must be written whole (`write_file`) and prove the evaluated needle against the real file
  (`indexOf`) — see `dev/fix-6139-needles.mjs`; hand-typed backslash runs in tool payloads DO get mangled.
- **Live probes**: YouTube innertube ANDROID player POST → 200 with 6 `audio/*` formats carrying `url`;
  `open.spotify.com/embed/track/…` direct fetch → `__NEXT_DATA__` present; cors.lol alive but 429 from this sandbox
  IP (per-IP quota — acceptable as the last-resort leg; each phone has its own IP).
- **Mechanics**: `dev/patch-6139.mjs` (whole-file, idempotent, `--manifest` mode), `dev/patch-6139b.mjs` (the
  compliant notes, the oEmbed leg, test-6136's needle → `fetchWithProxy(url, { headers: { 'User-Agent'`,
  test-6138 [7] → own entry), `dev/fix-6139-needles.mjs`, new `dev/test-6139.mjs` (34 assertions: the transport,
  the relay swap, the cancel-flag self-heal, the iTunes guard, the MB User-Agent, the notes discipline, syntax);
  APP_VERSION + sw.js `sidecut-shell-v61.3.9` + CHANGELOG head + root manifest → 61.3.9, 11 test files repinned,
  `test-6052` ship date → "September 25, 2026 · 2:39 AM EDT".
- **Verified**: all 5 inline `<script>` blocks parse (`new Function`); the FULL `dev/test-*.mjs` suite green —
  21 files, 0 failures; `node dev/ota-bundle.mjs --check` + `node dev/ota-bundle-play.mjs --check` both OK —
  v61.3.9, 6 notes, Play flag baked (zips 663861 / 663873 bytes); root manifest re-seeded via `--manifest`.
  Push pending an explicit ask (Freebuff's Changes panel owns delivery).

## v61.3.8 (Sep 24, 2026): a small artist keeps their own lyrics
- **User report, verbatim**: "For not that well known artists such as Bikramjit Dhaliwal the lyrics aren't correct for
  their songs."
- **The diagnosis, measured against the live APIs (do this before touching the matcher)**: LRCLIB has NOTHING for him
  (`lrclib.net/api/search?q=Bikramjit%20Dhaliwal` → `[]`), and neither Apple Music (`itunes.apple.com/search` → only
  "Ranjit Dhaliwal") nor Deezer (`api.deezer.com/search/artist` → total 0) has him. So every artist-based lyrics step
  misses, and the ONLY entries under one of his titles belong to someone else. **The bug was that they were still
  accepted: the title-only LRCLIB search (`search?track_name=…`) returned 20 same-titled songs by other artists, and any
  entry whose duration was within ±2s of the local file passed `acceptable: !!(aHit || dScore >= 2)` — a length is not an
  identity — and was then SAVED onto the track (`persistTrackMeta`), so it stuck. Replaying the real API data through the
  real scoring code for common Punjabi titles gave a stranger-inside-the-window chance of 13-31% (Gabhru 20%, Pind 31%,
  Yaar 20%). Note `textyl` (Apple) is unreachable from this sandbox (curl `http=000`), so that path can only be reasoned
  about, not replayed.
- **The rule now**: a length-only match additionally needs the EXACT title key
  (`acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign'))`) and a credit that does not contradict
  ours. New `scLyricsArtistVerdict(candArtist, artistTokens)` → `'match' | 'foreign' | 'unknown'`, plus
  `SC_LYRICS_IMPRINT_TOKENS` + `scLyricsLooksLikeImprint`: an imprint credit ("T-Series", "Saregama Music", "Speed
  Records") is NOT a contradiction — it says nothing about who sings — so an odd tag still can't hide a real hit (this is
  what keeps `dev/lyrics-lookup-check.cjs`'s `WALIYAN_DUR`/`LABEL_ONLY` cases passing). Transliteration drift ("Gurdas"
  vs "Gurdaas": ≥5-char shared prefix, both ≥5 chars) counts as agreement, never as a stranger. `aHit` is unchanged on
  purpose — the multi-artist-credit case from 6137 depends on it.
- **Two loose ends of the same bug closed**: `textyl` (Apple Music) hands back a timestamp per line and no title, and was
  accepted blind — its own clock is now the check (`_tyFits = !(dur > 0 && _tyLast > dur + 8)`, i.e. a sheet that runs
  past the end of the file belongs to a longer song). `lyrist` returns a `title`/`artist` that were never looked at; they
  are now validated against the request (`_textOk(_lyrTitle, '') && _lyrArtistOk`).
- **The empty state is honest now**: `scLyricsStrangers` counts refused strangers (reset in `scLookupLyricsInner`); the new
  `#lyricsNotFoundWhy` line says "Found 1 same-titled song under a different artist — skipped, not served as this
  track's", the Refetch picker marks such a candidate `· different artist`, and **`lyricsManualBtn` is revealed from the
  not-found state** (it used to appear only in `showLyrics`, i.e. only once lyrics existed — so a user whose song no
  database carries had no way to paste the words).
- **Mechanics**: `dev/patch-6138.mjs` (whole-file only, idempotent `sub`/`subFile`, `--manifest` mode), new
  `dev/test-6138.mjs` (its identity rules are lifted out of index.html and RUN, not grepped), APP_VERSION + sw.js +
  CHANGELOG head + root manifest → 61.3.8, 10 test files repinned, `test-6052`'s ship date →
  "September 24, 2026 · 7:00 PM EDT". Note: the repin pass rewrites the literal `"version: '…'"` pins in every
  `dev/test-*.mjs`, so a new test that needs to name an OLD version must hold it in a `const` (see `PREV` in test-6138).
- **Verified**: both inline blocks parse; the jsdom audit `dev/lyrics-lookup-check.cjs` (needs
  `/tmp/h/node_modules/jsdom`) extended with the user's exact case — **40/40 pass**, including "a same-titled song by
  another artist is refused, even at the exact same length" and "the picker marks it as a different artist"; the full
  `dev/test-*.mjs` suite is green (20 files); both OTA checks OK — v61.3.8, 5 notes, Play flag baked (zips 661061 /
  661069 bytes).

## v61.3.9 (Sep 24, 2026): the drop check finishes, and fills in as it goes
- **The user's report, verbatim**: "Musicbrianz don't have the dated release for upcoming releases but Spotify has it but I
  don't want my app to take the user to Spotify or verify anything for that except. Make the upcoming release actually work."
- **The sources were never the problem — v61.3.8 already proved the dates are reachable with no account.** Probing live
  before this patch: the iTunes catalog read BY ARTIST ID returns the real announced day (The Avalanches `No Bad Memories`
  2026-10-16, QOTSA `Perfecth` 2026-10-30, Fontaines D.C. `Dopamine Chamber` 2026-10-16, Royal Blood `Dead Company`
  2026-11-13, La Roux `Old Flames` 2026-11-06), while the popularity-ranked TERM search returns 0 future rows. MusicBrainz
  1/15 artists. Deezer 0. Apple RSS marketing endpoints 404. **Do not re-litigate sourcing; fix the plumbing.**
- **Six defects, each reproduced in headless Chromium on v61.3.8 before patching**:
  1. **Stall.** `checkPinnedArtistReleases` walked pins strictly serially (~5 network hops each). 16 pins on a congested
     network burned the whole 35 s tap ceiling.
  2. **Silent no-op.** The 35 s ceiling reset the BUTTON but never cancelled the RUN, so `active` stayed true; every later
     tap hit `if(pinnedCheckState.active) return;` and resolved in ~3 ms doing nothing. Measured: 2nd tap = 3 ms.
  3. **Blank on a bad network.** Each hop walked all 4 relays with an 8 s abort each; the artist's own 8 s clock then
     dropped the artist with ZERO results — `pinnedReleases` empty, 0 future rows. This is what "doesn't work" looked like.
  4. **Shared cancel.** `fetchWithProxy` bailed on `window.__ahCancelled` (the Album History switch), so cancelling an
     album fetch silently blanked the release check.
  5. **Duplicates.** The MusicBrainz pass keys entries `mbt:title|date`, which is ABSENT from `prevKeys`, so the drop the
     Apple catalog had just added got pushed a second time.
  6. **No visible progress.** Persist + paint happened only after the last artist, so a working check read as a dead button.
- **The fix (all in `dev/patch-6139.mjs`, 15 idempotent count==1 edits)**: a **3-way worker pool** over the pins; **save +
  repaint per artist** (`savePinnedArtists`, `renderNewReleases`, `scRepaintOpenReleasePanel`); a **shared in-flight run**
  (`let pinnedCheckPromise`) so a second tap AWAITS the run instead of no-oping; **`fetchWithProxy(url, { noCancel,
  budgetMs })`** with the release path passing `SC_RELEASE_FETCH = { noCancel:true, budgetMs:4000 }` at all 5 catalog
  reads; **cross-source dedupe** via a `freshTitles` Set (song + album + MB all consult it); and the button paints
  **"Checking… N/M"** on a 900 ms ticker with a 60 s last-resort race (was 35 s).
- **Verified in the browser (not just statically)**: 16 pins finished in **17438 ms** with the button restored and showing
  `1/16 → 12/16`; on a network where EVERY catalog hop was delayed 900 ms it still found **5 future-dated drops** (the five
  listed above) with **0 duplicate rows**; a second tap during a run waited **22965 ms** instead of 3 ms; with
  `__ahCancelled = true` the check still stored **543 rows**.
- **Environment gotcha (cost real time)**: this sandbox has **no `zip` and no `unzip` binary and no root to install them**,
  so `dev/ota-bundle.mjs --check` and `test-6058`/`test-play` fail with `spawnSync unzip ENOENT` — **pre-existing at HEAD,
  not a regression** (verified by `git stash` + rerun). Worked around with Python `zipfile` shims on `PATH`
  (`/tmp/zbin/{zip,unzip}` implementing `-Z1` and `-p`); with those, both bundles build and both `--check`s pass.
- **Release mechanics**: APP_VERSION 61.3.8 → 61.3.9, sw.js → `sidecut-shell-v61.3.9`, new CHANGELOG head (6 notes,
  stamp UTC−4 → "September 24, 2026 · 5:44 PM EDT"), root manifest.json re-seeded from the TRUE zip size via
  `node dev/patch-6139.mjs --manifest` (660399), 11 test files repinned, `dev/test-6139.mjs` added (its own repin is
  skipped by name since it anchors the PREVIOUS release on purpose), and `test-6137`'s 35 s ceiling + `test-6136`'s MB
  fetch needle updated.
- **Suite**: all **21** `dev/test-*.mjs` green (with the zip shims on PATH). Both OTA bundles rebuilt and `--check` clean
  — v61.3.9, 6 notes, Play flag baked (zips 660399 / 660407 bytes). `dev/_boottest.js` still dies on
  `pane.style.setProperty is not a function` — the documented PRE-EXISTING harness limitation, unrelated.
- **Nothing to connect**: `scSpotifySilentToken` count is 0; `await scSpotifyInteractiveToken()` has exactly ONE call site
  (the converter's own search). The release check never touches Spotify.
## v61.3.8 (Sep 24, 2026): upcoming releases reads the dates it was missing — no Spotify, no token, no backend
- **The user's directive, verbatim**: "Musicbrianz don't have the dated release for upcoming releases but Spotify has it but I don't want my app to take
  the user to Spotify or verify anything for that except. Make the upcoming release actually work." So: find the date from an OPEN source, and delete the
  account path entirely.
- **The real miss was the search, not the source.** Apple publishes an announced release as a **pre-order with the real day already set** — but only on the
  artist's OWN catalog. The term search (`search?term=…&entity=album`) is popularity-ranked and buries a pre-order, so a drop dated weeks out never surfaced.
  Probed Sep 24: the **ID lookup** (`lookup?id=<artistId>&entity=album&limit=200`) found **19 of 21** dated upcoming releases where the term search found 8 of
  13. MusicBrainz (the v61.3.6 source) carries the same day-precision data for artists someone has already dated, so both stay.
- **`scItunesArtistAlbums(artist)`** (defined just above `fetchArtistReleases`): ONE `entity=musicArtist&limit=5` search resolves the artistId (first result
  whose `artistName`, reduced to its primary artist, matches bidirectionally — the same `credited()` rule as the rest of the pass), then ONE
  `lookup?id=…&entity=album&limit=200` reads the catalog. Returns the raw album rows; the caller applies the credited-artist / `trackCount === 1` / dedupe
  rules. `catch(_eId){ return []; }` — best effort, never throws, never opens a window, never touches a token.
- **Folded into the album loop** in `fetchArtistReleases` and collapsed across sources: the ID catalog and the term search (and a cross-storefront edition)
  can name the same drop, so `albSeen` (key `alb:<title>|<day>`) keeps one — preferring the copy with `artworkUrl100`, then `collectionId` — before
  `albPick.slice(0,5)`. `prevKeys.has()` still drops a drop already stored.
- **The Spotify release-check path is DELETED**, not just unused: `scSpotifySilentToken` + `scFetchSpotifyUpcoming` (and their `window.__sc*` aliases) are
  gone, the `spFresh` concat is gone, and the MusicBrainz merge dedupe key is now a plain `'mbt:' + nt + '|' + x.date` (no `spt:` source prefix survives).
  `await scSpotifyInteractiveToken()` now has exactly ONE call site — the converter's `scSpotifySearch`, where the user explicitly starts a connection — and
  `__scUpcomingConnectTap` no longer references it.
- **Home unaffected**: the empty-state CTA already said "Check for drops" (v61.3.6 removed the Connect Spotify button), so nothing there changed.
- **Release mechanics**: `dev/patch-6138.mjs` (idempotent; `--manifest` re-seeds root `manifest.json` after the OTA build) did all of it in one pass —
  APP_VERSION + sw.js `CACHE_NAME` + CHANGELOG head + the 9 index.html edits, then repinned every `dev/test-*.mjs` `ver ===` pin. Gotchas hit and fixed:
  (1) the changelog head carries the run timestamp, so the generic exact-string idempotence check can never match on a re-run — guard on the version
  marker (`src.includes("const CHANGELOG = [\n  { version: '<VER>'")`), not the new text; (2) `test-6137`'s `const CHANGELOG = [` anchor is a REGEX
  literal (escaped dots), so the blanket repin skips it — it needs its own targeted rewrite; (3) the blanket repin must EXCLUDE the new
  `test-6138.mjs`, whose own "heads the changelog" anchor names the previous release on purpose.
- **New `dev/test-6138.mjs`** pins the pass, the cross-source collapse, the removal (`scSpotifySilentToken`/`scFetchSpotifyUpcoming`/`_spt:`/`spFresh` all
  count 0, no `__scSpotifyUpcoming` in the check), the surviving interactive flow (1 definition, 1 call site), the empty state, and the metadata.
  `dev/test-612.mjs` was rewritten WHOLE (its old subject was the silent Spotify pass — regex surgery on a test whose premise changed broke it twice).
- **Env gotchas this session**: `zip`/`unzip` and the `acorn` dev dep were missing from the image — `test-6044/6046/6047/6053/6054` all failed with
  `ERR_MODULE_NOT_FOUND: acorn` and `test-6058`/`test-play` fail without `zip`. `apt-get update && apt-get install -y zip unzip` and
  `npm install acorn --no-save` made the FULL suite (20 files) green — none of those were regressions.
- **Verified**: all 5 inline `<script>` blocks parse via the `new Function` check; FULL `dev/test-*.mjs` suite (20 files) green;
  `node dev/ota-bundle.mjs --check` + `node dev/ota-bundle-play.mjs --check` both OK — v61.3.8, 5 notes, Play flag baked
  (zips 658270 / 658281 bytes). Live pipeline re-confirmed 19/21 coverage, `dupUpcoming=0`.


## v61.3.7 (Sep 24, 2026): the release check can't stick, Home stops showing it, drops carry a time
- **The user's four fixes**: "you don't need an example for release name and the checking doesn't work and fetching
  pinned artists releases doesn't need to show on the home page Also add the time for Manuel and auto fetching upcoming
  releases" — plus "there's a syntax error right now fix that".
- **THREE SYNTAX ERRORS the abandoned 61.3.7 pass had already written into index.html** (the inline-block `new Function`
  check is what catches these — run it after ANY index.html edit):
  1. The new CHANGELOG entry was spliced in at TOP LEVEL, immediately above `const APP_VERSION` — `{...},` followed by
     `const` = "Unexpected token ','". It is now lifted verbatim into the head of `CHANGELOG`. **Anchor a changelog head
     splice on `const CHANGELOG = [\n  { version: '<previous>', date: ` (patch-6136's anchor), never on APP_VERSION.**
  2. `window.__scUpcomingConnectTap`'s 35 s `Promise.race` had no closing `})` before `]);`.
  3. `checkPinnedArtistReleases` kept the OLD `const fresh = await fetchArtistReleases(a.name)` line beside the new
     clocked one (two declarations + an unterminated race), and the `anyActive` cleanup left a stray `)` behind.
- **Root cause of the corruption (the lesson)**: `dev/patch-6137.mjs` was being edited by splicing its own text in a
  terminal (`s[:j] + seg + s[tail:]`) and got truncated to 60 lines mid-edit; running that half-written copy wrote junk
  into index.html. Patch scripts must be written whole (`write_file`) only, and every edit in them count==1 asserted AND
  idempotent, so a re-run can never double-apply (see `sub`/`subRe` in patch-6137: skip when the result is already there).
- **The check can no longer stick on "Checking…"**: `checkPinnedArtistReleases` clocks EACH artist —
  `Promise.race([fetchArtistReleases(a.name), new Promise(res => setTimeout(() => res(null), 8000))])` — so a stalled,
  offline or rate-limited reply counts as 0 and the loop moves on; the tap races the whole rebuild against 35 s and always
  puts `Check for drops` back. New `scRepaintOpenReleasePanel()` rebuilds the OPEN Home bubble in place with
  `panel.style.animation='none'` for the duration, so the repaint never replays the slide-up (that animation is on
  `#homeBubbleOverlay.open #homeBubblePanel`).
- **Home draws nothing for the pinned check**: both cards are gone from `renderHomeExportPopup` (the progress card
  "Checking pinned artists for new releases 7/7 artists" and the finished "New releases found" card, which the broken
  pass had left as a dead `if(false)`), and `anyActive` no longer includes `pinnedCheckState.active`. New drops still
  reach the bell badge and the New releases tab.
- **Time of day**: `window.__scTime12('HH:MM')` (next to `__scDay10`/`__scUpcomingDay`) is the one formatter; the manual
  sheet gained `<input id="scAddDropTime" type="time">` defaulted to now, entries store `time`, rows read
  "drops Oct 3 at 7:23 AM", and a repeat save for the same title+day updates the time instead of refusing.
  **No catalog (MusicBrainz / silent-Spotify / iTunes) carries a time, so a day-only upcoming row says "at time TBA"** —
  deliberate, not a missing value. A catalog that ever reports one keeps it (`x.time` flows through both merge paths).
- **Mechanics**: `dev/patch-6137.mjs` (idempotent; `--manifest` re-seeds root `manifest.json` with the true zip size AFTER
  `dev/ota-bundle.mjs`, since the normal run seeds it from the previous bundle's size), new `dev/test-6137.mjs`,
  APP_VERSION + sw.js + CHANGELOG head + root manifest → 61.3.7, 10 test files repinned, `test-6052`'s ship date →
  "September 24, 2026 · 7:23 AM EDT".
- **Verified**: both inline `<script>` blocks parse (`new Function`); the FULL `dev/test-*.mjs` suite (20 files) green;
  `node dev/ota-bundle.mjs --check` + `node dev/ota-bundle-play.mjs --check` both OK — v61.3.7, 6 notes, Play flag baked
  (zips 658074 / 658087 bytes).

## v61.3.6 (Sep 24, 2026): Upcoming releases looks the date up itself — no Spotify connection anywhere
- **The user's directive, verbatim**: "I told you no connect Spotify just like make the app look it up or something that shows
  when an upcoming album is going to be released." v61.3 shipped a **Connect Spotify** CTA (PKCE window) on both empty
  states — that whole angle is gone.
- **The new source — `scFetchMbUpcoming` (`window.__scMbUpcoming`)**, defined right after `scFetchSpotifyUpcoming`: ONE open
  MusicBrainz search per pinned artist —
  `release-group/?query=artist:"NAME" AND firstreleasedate:[today TO today+400d]&fmt=json&limit=100` through `fetchWithProxy`
  (musicbrainz.org sends `access-control-allow-origin: *`, so the direct attempt works; proxies catch rate-limits). Verified
  live from the sandbox BEFORE shipping: the combined query returns day-precision FUTURE release-groups ("Arrasando | 2026-10-19
  | Album"), and MB range queries are granularity-aware — year-only "2026" matches a range it overlaps, which is exactly why
  `__scDay10` + `__scUpcomingDay` still gate the results client-side. Filters: primary-type Album/Single/EP, pinned artist
  present in `artist-credit` (bidirectional substring, same rule as the iTunes pass). Entries carry `_mb: rg.id`.
- **Merge**: `fetchArtistReleases` runs `mbFresh.concat(spFresh)` through ONE loop; the dedupe key gained a source prefix
  (`(x._mb ? 'mbt:' : 'spt:') + nt + '|' + x.date`). The silent Spotify pass STAYS (a token from an old install still
  contributes, returns `null` fast, never a window); the `catch(_eSp)` best-effort contract is unchanged.
- **CTA/tap**: `__scWireUpcomingCta` labels the primary button **Check for drops** (the token-state sniff was deleted), the
  hint reads "… no account, nothing to connect …", and `__scUpcomingConnectTap` just awaits `__scRebuildReleaseLists(true)`
  with a failure toast. `await scSpotifyInteractiveToken()` now has exactly ONE call site: the converter's `scSpotifySearch`.
- **Why not iTunes/Deezer too (probed live Sep 24 — re-probe before re-litigating)**: iTunes `entity=album` search returned
  ZERO future-dated albums across 4 major artists (pre-orders do not surface in search), and Deezer artist-album lists only
  carried past `release_date`s at 2 hops. MusicBrainz alone was the verified dated source, so the check stays ~3 hops/artist.
- **Release mechanics**: APP_VERSION 61.3.5 → 61.3.6, sw.js → `sidecut-shell-v61.3.6`, new CHANGELOG head (6 notes,
  `easternStamp()` UTC−4 → "September 24, 2026 · 6:02 AM EDT"), root manifest.json regenerated (size seeded from
  ota/updates.json), the 7 non-612 `ver ===` pins repinned, test-612 got 5 assertion swaps (interactive count 2→1, merge-key
  needle, CTA slice must NOT contain 'Connect Spotify', version block), test-6052's `entries[0].date` repinned, and
  `dev/test-6136.mjs` added. One idempotent `dev/patch-6136.mjs` pass did every index.html/test edit with count==1 assertions.
- **str_replace on index.html CONFIRMED still dead in this environment**: even a unique 36-char ASCII line
  (`cbtn.textContent = 'Connect Spotify';`) reports "not found" while sw.js edits fine — the same 2.2 MB no-op documented since
  v56.0.12. Deep index.html edits MUST go through a patch script; grep the markers immediately after running it.
- **Verified**: all 5 inline `<script>` blocks parse via the `new Function` check; the FULL `dev/test-*.mjs` suite (18 files)
  green; `node dev/ota-bundle.mjs --check` and `node dev/ota-bundle-play.mjs --check` both OK — v61.3.6, 6 notes, Play flag
  baked (zips 656417 / 656430 bytes). Push pending an explicit ask (Freebuff's Changes panel owns delivery).

## v61.3.5 (Sep 23, 2026): one release number everywhere + the mislabeled v61.3 ship date — pushed
- **What it is**: an alignment patch cut ~35 min after 61.3 (f097cbd + 4c3a946). No feature
  changes: APP_VERSION → 61.3.5, sw.js → `sidecut-shell-v61.3.5`, new CHANGELOG head entry
  (6 notes), every `dev/test-*.mjs` `ver === '…'` pin repinned, and root `manifest.json` — the
  legacy update-manifest copy that `android-build.yml` drops into `www/` — dragged off the stale
  v58.0 onto this release. All of it via the idempotent `dev/patch-6135.mjs` pass (str_replace
  still no-ops on the 2.2 MB index.html).
- **The date bug the bump flushed out (the reason `test-6052` failed)**: 61.3's changelog entry
  read "September 24, 2026 · 1:42 AM EDT" — that is the UTC clock time wearing an EDT label
  (f097cbd landed 2026-09-24T01:50Z = Sep 23, 9:50 PM EDT), i.e. a timestamp in the future from
  the moment it was written. With the correctly stamped 61.3.5 head (Sep 23, 10:27 PM EDT) above
  it, the changelog read backwards, and `dev/test-6052.mjs` — the ONLY test that pins
  `entries[0].date` by exact string equality — failed while every other check passed. Fixed by
  `dev/fix-613-date.mjs` (atomic count==1 replace): 61.3 now reads "September 23, 2026 · 9:42 PM
  EDT", and the test pin was repinned to the 61.3.5 head date.
  - **Gotcha**: a patch script stamping a release date MUST derive Eastern as UTC−4 (see
    `easternStamp()` in patch-6135 — no tzdata in the sandbox). Symptoms of getting this wrong:
    a CHANGELOG entry dated LATER than the entry below it, and a red `dev/test-6052.mjs` on the
    single line `entries[0].date === '…'`. Repin that line on every release, like the `ver ===`
    pins.
- **Bundle/size mechanics learned here**: root `manifest.json`'s `size` is a SEED only — the
  manifest is itself one of `OTA_FILES`, so the field inside the zip can never equal that zip's
  own size; the exact figure is written by `dev/ota-bundle.mjs` into `ota/updates.json`,
  `ota/manifest.json` and root `updates.json`, and re-zipping shifts the byte count by ±1 per
  pass. Left in the consistent state the checks care about: repo manifest.json = updates.json =
  zip = 654999 bytes; the embedded copy lags one build by design and nothing verifies it.
- **Verified**: all 5 inline `<script>` blocks parse via `new Function`; the FULL
  `dev/test-*.mjs` suite (17 files) green including the repinned date; `node dev/ota-bundle.mjs
  --check` and `node dev/ota-bundle-play.mjs --check` both OK — v61.3.5, 6 notes, Play flag
  baked.

## v61.2 (Sep 23, 2026): Upcoming releases reads drop dates from Spotify — pushed
- **What shipped**: a real dated drop never reached Upcoming releases because Apple/Deezer/
  MusicBrainz carry nothing before release day. `scFetchSpotifyUpcoming` (`window.__scSpotifyUpcoming`)
  takes the pinned artist → Spotify artist search → `/albums?include_groups=album,single`, keeps only
  `release_date_precision === 'day'` dates strictly in the future AND credited to the pinned artist,
  and the merge into `pinnedReleases` (in `fetchArtistReleases`) either ADDS the entry or writes the
  date onto an already-listed undated release (never a duplicate).
- **Token split (the important bit)**: `scSpotifySearch` used to open the authorization window on
  every call. It now goes through `scSpotifyInteractiveToken()` (window allowed — called ONLY from an
  explicit tap), while the background release check uses `scSpotifySilentToken()` (stored token, else
  quiet refresh_token exchange, else `null` → other sources carry on, no window, no toast).
- **Empty-state CTAs**: `window.__scWireUpcomingCta(el)` appends "Connect Spotify" + "Add a drop
  manually" (+ hint) to BOTH empty states (Fetch latest popup `#dpRelUpEmpty` and the Home bubble
  `#dpRelUpEmpty`). Connect = `__scUpcomingConnectTap` → interactive token → `__scRebuildReleaseLists(true)`;
  relabels to "Re-check for drops" when a good token is stored. Manual = `__scAddUpcomingDrop` sheet
  (artist datalist from `pinnedArtists`, title, date defaulting to +7d) writing a normal release entry
  with `_manual:true`, sorted + `savePinnedArtists()`.
- **Release mechanics**: APP_VERSION 61.1 → 61.2, sw.js `sidecut-shell-v61.2`, new CHANGELOG head
  entry (6 notes), all version pins in `dev/test-*.mjs` repinned, done via `dev/patch-612.mjs`;
  new `dev/test-612.mjs` covers it.
- **Verified**: inline blocks parse via the `new Function` check; the FULL `dev/test-*.mjs` suite
  (17 files) green; both OTA bundles rebuilt and `--check` clean.

## v61.1 (Sep 23, 2026): widget animates + can't freeze, Upcoming releases gates the day — pushed (0dd13c4)
- **What shipped**: (1) the home widget's EQ now self-drives from inside the app process
  (`.github/workflows/patch-widget.py` → `SideCutWidgetProvider.setAnimating(ctx, playing)`,
  a 480 ms `Handler` loop started/stopped by `update()` and by the watchdog on a dead app;
  cover art cached in `sArtKey`/`sArtBmp` so the ~2 repaints/s loop never re-decodes the same
  base64 frame). Driving it from the web heartbeat was too slow AND died when the WebView went
  to background — exactly when you look at the widget. (2) `index.html` heartbeat dim guard:
  the 25 s battery dim can no longer fire while `widgetPlaying` (it pushed a fake paused
  "Tap to show" state then went silent = the "frozen widget"), and the first touch undims by
  re-pushing immediately instead of waiting for the next beat. (3) `window.__scUpcomingDay`
  rejects past days AND placeholder dates >400 days out, so junk/past-dated albums no longer
  show under Upcoming releases (landed in 7cb6e02, first shipped here).
- **Release mechanics followed**: APP_VERSION `61` → `61.1`, sw.js `sidecut-shell-v61.1`, new
  CHANGELOG head entry (6 shared notes, no downloader terms / no play-build naming), all 7
  `dev/test-*.mjs` `ver === '…'` pins repinned — everything done in one idempotent
  `dev/patch-611.mjs` pass with count==1 assertions (the reliable way to edit the 2.2 MB
  index.html; `str_replace` still no-ops on it).
- **Verified**: inline blocks parse via the mandatory `new Function` check; the FULL
  `dev/test-*.mjs` suite (16 files, incl. new `test-widget-anim.mjs` + `test-widget-dim.mjs`)
  is green; both OTA bundles rebuilt and `--check` clean (`node dev/ota-bundle.mjs &&
  node dev/ota-bundle-play.mjs`, then each with `--check`). `dev/_boottest.js` still dies on
  `pane.style.setProperty is not a function` — PRE-EXISTING at HEAD (the harness's element mock
  `style: {}` has no `setProperty`), not a regression; check against `git show HEAD:index.html`
  via `BOOT_HTML=` before chasing it.
- **Push result**: commit 0dd13c4 → Pages deploy ✅ (live `updates.json` now v61.1, 6 notes),
  AAB build ✅ both jobs (full + play) — the widget animation is native, so it only reaches
  phones through that AAB artifact, while the heartbeat/upcoming fixes ride the OTA.

## v56.10.1 (Sep 12, 2026): reorder songs works from All Songs (hold, kebab, header)
- **User complaint**: "Like holding down the song the reorder function doesn't show" — the
  reorder entry points were gated on `activePlaylist !== 'All Songs'/'__unsorted__'`
  (`!isAllSongsView` at 14399/14488, `!isAllSongs` header gates, `showReorder = reorderMode && !isAllSongs`),
  so the user holding a song in the main **All Songs** list saw no Reorder option anywhere.
- **Fix**: reorder is a stored order, so it's valid on real playlists AND All Songs (whose
  array holds the library insertion order and only ever gets missing tracks APPENDED at boot
  ~12091 — a saved custom order survives reload; verified by CDP). Added
  `canReorderPlaylist()` (false only for `UNSORTED_VIEW`, a live filter — toasts an
  explanation instead), and un-gated: hold sheet "Reorder songs" (label changed to match),
  song ⋮ "Reorder this playlist", header `#reorderModeBtn` render + handler, reorder-mode
  header + per-row grip/arrow rendering (`showReorder = reorderMode`, header
  `else if(reorderMode && effectiveSort === 'default')`). CSS: `.pane-actions #reorderModeBtn`
  was `display:none` (v56.1 moved reorder into kebab) — now `display:flex` so the pencil icon
  shows next to the sort dropdown; `#mixBtn` stays hidden.
- **Verified in Chromium**: hold sheet + kebab + header pencil all enter reorder mode on All
  Songs (Reordering header, 31 grips), ▲/▼ moves persist through `Page.reload`.
- Version 56.10 → 56.10.1, sw.js sidecut-shell-v56.10.1. Commit 0f90bcc pushed to main.

## v56.10 (Sep 12, 2026): crossfaded mix downloads + reorder-on-desktop + add-toast fix
- **Menu layers (critical gotcha for automation)**: the LIBRARY/PLAYLIST header ⋮ is
  `#listMoreBtn` (wired at ~13868 → `openListMoreMenu(ids, isAllSongs, canDelete)` ~12770), and
  it hosts Export/Download to phone/Download crossfaded mix/Manage playlists/Find duplicates/
  Delete all songs. The PER-SONG ⋮ (`.track .kebab-btn`) hosts a DIFFERENT sheet
  (`#songActionsList` = openSongActions/song 3-dot ~14359): Favorites/Play next/Vibe/Lyrics/
  Edit/Crop song (+ reorder entry when `!isAllSongsView`)/Fetch cover/Set cover/Song info/
  Add to playlist/Delete/Add to albums. Both menus share the same `songActionsBackdrop` and
  `songActionsList` container — don't get them confused when testing.
- **`downloadCrossfadedMix(ids, isAllSongs)`** (~15422): decodes every track (skips
  undecodable), overlaps them by the user's `crossfadeSeconds` (clamped 0.25–12s, capped at
  half of either adjacent song), equal-power fades (`sqrt` ramps, single pass with offset
  math), peak-normalizes to 0.55, then `scEncodeAudio` → MP3 when `lamejs` is loaded (CDN,
  `~300` seconds threshold unnecessary — always MP3 if available), else WAV. Caps: 400 songs /
  3600s MP3 / 720s WAV. Saves via `writeBlobToDir` (native) or `<a download>` (browser).
  Verified end-to-end in Chromium: two 3s WAVs → "All Songs - Crossfaded Mix.mp3" (valid
  `0xFF 0xFB` MP3), anchor captured the filename.
- **Reorder on desktop**: song 3-dot menu now gets "Reorder this playlist" (`!=isAllSongsView`,
  calls `enterReorderMode()`); Home greeting row has a visible `#homeReorderBtn` → the same
  `openHbReorderConfirm()` used by the hold gesture. **`attachLongPressChoice` no longer
  cancels on `pointerleave`** — that killed desktop mouse holds (cursor drift off the row
  cancelled instantly); `pointermove` threshold + `pointerup`/`pointercancel` still clean up,
  and the hold correctly no-ops while in reorder/select mode.
- **Add-toast false failure fixed**: line ~4274 `let playlists` + `let userAlbums` were
  swallowed into a `// comment\n  let ...` literal (garbled transport) → `saveMeta()` threw
  `ReferenceError: userAlbums is not defined` → `__handleFileImport`'s catch showed the
  failure toast despite success. Real newline restored. Heuristic to find siblings of this
  class: grep for `\\n +let |\\n +const |\\n +function ` (zero hits now).
- **Crop preview robustness**: `cropStartPreview` now plays the selected slice DIRECTLY from a
  live `AudioContext` + `BufferSource` (primary path; `cropPreviewLive`/`cropPreviewLiveCtx`
  vars), with the offline-render + `scEncodeAudio` path demoted to a fallback. This makes
  preview work even when `OfflineAudioContext` is flaky or the MP3 encoder CDN is blocked.
  Verified: selection drag shrinks the kept window, Preview button toggles "⏸ Stop preview".
- Version 56.9 → 56.10 (sw cache sidecut-shell-v56.10). Changelog entry at head. Pushed 38ed499.

## MANDATORY RULES
- **ALWAYS verify syntax before pushing.** After ANY edit to index.html, run:
  ```
  node -e "const fs=require('fs');const s=fs.readFileSync('index.html','utf8');const m=s.match(/<script[^>]*>([\s\S]*?)<\/script>/g);let ok=true;m.forEach((b,i)=>{try{new Function(b.replace(/<\/?script[^>]*>/gi,''));console.log('Block '+(i+1)+': OK')}catch(e){if(i===3&&e.message.includes('await')){console.log('Block '+(i+1)+': OK (await in nested async)')}else{console.error('Block '+(i+1)+': '+e.message);ok=false}}});if(!ok)process.exit(1);console.log('All blocks OK');"
  ```
  If any block fails, fix the error BEFORE committing or pushing. Never push broken syntax.

## v56.1 (Sep  9,  2026): user-requested overhaul — albums, share codes, exports, AI, icons
- **Version**: APP_VERSION 56.0.23 → 56.1; sw.js cache → sidecut-shell-v56.1; CHANGELOG head date Sep  8 · 5:55 PM ET (user-specified EDT time).
- **What shipped (this batch)**:
  1. Create your own albums: hold a song → Select multiple → ⋮ → Create album; sort-by-artist now shows YOUR albums first, then singles under each artist (e.g. Diljit albums, then Diljit singles).
  2. Playlist share codes: playlist ⋮ menu → Share code emits a tiny base64 payload (`?sc=<code>` share link too); any other SideCut → Open code rebuilds the playlist from matched songs — no file download. `_scB64Encode/_scB64Decode`, `sharePlaylistCode`, `importShareCode`, `copyTextToClipboard`; alias `window.__scImportShareCode = importShareCode;` MUST sit INSIDE the main IIFE (after line~11958, near the share-code megа-line); an external alias (post-IIFE) throws `importShareCode is not defined` on boot.
  3. Playlist header decluttered: reorder + shuffle buttons hidden (`#mixBtn`/`#reorderModeBtn`/`#managePlaylistsBtn` CSS) — both moved into the playlist kebab sheet (same frame); also mix + delete there.
  4. Back-to-top + Manage playlists merged: `#backToTopBtn` now pops a `#topChooser` action sheet (Back to top / Manage playlists).
  5. Check-for-updates fixed (was firing and dying instantly due to un-awaited async): `otaCheckBtnBig` handler awaits `checkBrowserUpdate()`/`window.__SideCutOTA.checkForUpdate` with try/finally; a newer OTA triggers a real notification prompt to install.
  6. Pinned-artist covers are manual-only now: theming/edit flow no longer auto-fetches; `#ahArtFab` etc only save what the user sets. Settings → More → Manage pinned-artist covers entry. (Also the no-art fallback div honors `a.photo`.)
  7. Quick-actions Home bubble buttons now ordered and include Widgets (`SETTINGS_TABS` gained `'widget'` first) — Settings pane `widget` hosts the home-widget toggles.
  8. App icon picker: Settings → Theme → App icon select (`auto`/coral/gold/ocean/night/mint/sunset)`; `updateFavicon()` draws theme colors unless a manual preset overrides them (tab/address-bar icon only; installed-OS icons are cached platform files).
  9. Large exports fixed: `runZipExport` prefers File System Access API streaming (`showSaveFilePicker`+`createWritable`); else Capacitor path `streamZipToCapacitor` (chunked 256KB cache-file appends); else in-memory Blob-parts; `Array buffer allocation failed` now guides the user to export a playlist/selection instead. No song cap.
  10. AI/smart tweaks + regex tidy-ups.
- **Parse gotcha (cost this session)**:theror's `-c`/heredoc/file_editor transport injects soft-hyphens/U+200B into JS as I type it (e.g. `= 0`→`= = 0`, `chr(10`)→`chr(10`+missing-paren`. ALWAYS verify via a tiny python file as data + sed-delete all `\xe2\x80\x8b`, or use base64 round-trip, after authoring any multi-line JS edit.inline blocks parses via `node --check` on the two `<script>` blocks.
- **Boottest now fully green**: dev/_boottest.js executes the main IIFE без throw and smoke-tests `_toggleGenres` (stale `_toggleNR` smoke removed — that toggle is intentionally gone per v47).
## Google Play billing "not opening" (Sep 7, 2026): stale-bundle symptom, not a code bug
- User reported billing taps don't open the Play sheet. The RUNNING bundle (pre-56.0.18
  OTA zip) still contains the broken code: `purchasePlayItem()` calls
  `nativePurchasesAvailable()` which has no definition there → ReferenceError on every
  Donate/Subscribe tap BEFORE the sheet opens. The 56.0.18 source already fixed it.
- Fix delivery = the rebuilt OTA zip (commit 1400519 + the copy fixes in this commit);
  no APK rebuild needed. Billing should work as soon as the device applies 56.0.18.
- Error-copy cleanup while there: 'not-found' messages no longer tell users to add
  products to RevenueCat (plugin removed ages ago) — now they point at Play Console only.
- CI `patch-billing.py` no-ops on current source (identifier-first already shipped);
  BILLING permission is added by `patch-manifest.py` — nothing else to fix in CI.

## v56.0.18: UX batch + billing ReferenceError fix (Sep 7, 2026)
- Batch: (1) Discover popup group reorder (Album History/Singles) now feels like
  playlist reorder — pickup haptic, dashed `.dp-ah-artist.dragging` outline,
  drag-lift visuals, edge auto-scroll via rAF, settle-then-persist, transition
  kill during drag; (2) pinned-artist `set photo` writes `a.photo` AND `a.art`,
  and the no-art fallback div now shows the photo (`a.photo` as background) —
  covers users whose stored pin only carries `photo`; (3) Discover Top Hits
  (Apple RSS most-played 25 + iTunes lookup) goes through `fetchWithProxy` with
  the 8s AbortController instead of bare fetch, so blocked domains can't kill
  it; (4) Settings → More: "Ask artist when importing" moved below the Playback
  collapsible, Library Tools relabeled "Library Tools & Fetching".
- **Real bug found while verifying**: `nativePurchasesAvailable()` (added in
  aed26ee v56.0.7) lost its DEFINITION in the very next commit but 4 call sites
  survived — first line of `syncPlayEntitlement()` (boot/focus/visibility) and
  `purchasePlayItem()` (Donate/premium taps) → guaranteed ReferenceError on
  every purchase attempt. The RevenueCat native path (`*Native` fns, Purchases
  plugin) was removed with it, so the two dead branches calling
  `syncPlayEntitlementNative`/`purchasePlayItemNative` were deleted and the
  function restored gated on `Capacitor.isNativePlatform()`. jsdom boot test
  now clean (0 occurrences vs 1 before).
- Version: APP_VERSION 56.0.16→56.0.18, sw.js cache → sidecut-shell-v56.0.18,
  CHANGELOG + ota/manifest.json regenerated (notes = 4 bullet batch).
- **index.html file-editor gotcha confirmed again**: str_replace "succeeds"
  with no error yet writes NOTHING (even a trivial no-op replace fails to
  match). Every index.html edit must go through an atomic python replace pass
  with count==1 assertions, then `node --check` both inline blocks.

## v56.0.17: "Install later" actually installs on close + version bump REQUIRED for delivery (Sep 6, 2026)
- **Delivery gotcha that cost hours**: fixing only `dev/native-updates.js` and republishing a
  SAME-VERSION manifest does nothing for devices that already staged/applied 56.0.12 —
  `checkForUpdate` short-circuits on `man.version === cur` ("up to date") and the already-staged
  old zip would be re-offered instead of re-downloaded. **The version bump is not cosmetic; it
  IS the delivery mechanism.** APP_VERSION 56.0.12→56.0.17, sw.js cache → sidecut-shell-v56.0.17,
  fresh CHANGELOG head entry (deploy.yml extracts notes/size/date from it).
- **What the uncommitted diff shipped** (close/reopen complaint: "I got the OTA, closed + reopened,
  still old version"):
  - `applyStagedNow` returns true when the apply was DEFERRED (music playing) — callers drop the
    sheet instead of repainting over the deferral toast; it now also sets
    `sidecut_ota_prompt_<version>` so silent checks stop re-offering, and remembers the version in
    `sidecut_ota_applied` for the next-boot confirmation toast.
  - New `applyInBackground(Updater, nb)` implements the Install-later contract for real: if the
    user chose "later" (or music forced a deferral), the staged bundle installs the moment the app
    leaves the foreground — wired to pause/resume/visibilitychange (BOTH transitions: 'hidden'
    catches Home-gesture close while the webview is alive; 'visible' on reopen catches swipe-away
    kills). Returns 'immediate' | 'deferred' | false. If the plugin's own background handler
    applied it first, `getNextBundle()` returns null and `go()` no-ops.
  - Launch staged-bundle check restores v56.0.16 auto-apply: never-later users get it applied at
    launch (sheet shows "Installing…"), later-choosers get the on-close wiring, nobody sees the
    stuck behind-a-sheet-forever loop.
  - Boot confirmation: `sidecut_ota_applied` matching `currentVersion()` → "✓ SideCut updated to
    v…" toast, then the key is removed.
  - `checkForUpdateInner` staged branch: when `applyInBackground` returned 'immediate', return
    early — never repaint a 'staged' sheet over the 'Installing…' sheet in the 450ms before
    `set()` reloads the context.
- **Workflow verified locally**: zipped the shell + ran deploy.yml's exact manifest node block →
  `{version:'56.0.17', size:424330, notes:[3], date:'…11:40 PM ET'}`.
- Parse checks: `node --check` on native-updates.js + sw.js, `new Function` on both inline
  index.html script blocks — all green. ota/ in-repo copies are CI-owned (regenerated on push);
  don't hand-edit them.

## OTA update sheet: progress + ETA + Install now/later + real patch notes (Sep 6, 2026) — v56.0.12
- **User complaint**: OTA "gives the toast and stays there installing" — no visible progress, no
  install choice, and the update's patch notes were missing. Also the user explicitly set the
  shipping version to **56.0.12** (an intentional re-use of the number — do NOT "fix" it upward;
  the OTA version only matters as "different from installed").
- **What shipped (dev/native-updates.js rewrite)**:
  - A bottom **update sheet** (`#scOtaSheet`, z-index 9999) replaces toast-only feedback: title
    + date, real patch notes (bulleted), progress bar with %, MB-of-total and a **live ETA**
    (smoothed from the plugin's `download` percent events — `Updater.addListener('download', s => s.percent)`),
    and **Install now / Install later** buttons.
  - Phases: `prompt` (notes + buttons) → `downloading` (bar, buttons hidden) → `staged`
    (Install now applies via `set()`, Install later defers to next close) → `installing`
    ("Installing… the app will reopen automatically") → context dies → new version boots.
  - Sheet state persists in `localStorage['sidecut_ota_sheet']` so a staged-but-unapplied
    bundle re-surfaces on launch (`restoreSheetState` + the boot `getNextBundle` check).
  - `checkForUpdate` resolves `{ dismissed: true }` when the user picks Install later — the
    manual "Check for updates" button no longer lies "You're on the latest version ✓" after a
    dismissal (that inverted-toast bug is also fixed in index.html).
- **ota/manifest.json now carries `size` + `notes` + `date`**: deploy.yml extracts the matching
  CHANGELOG entry (version-matched, falls back to newest) via `eval('[' + block + ']')` and the
  real zip size via `stat -c%s`, so the sheet shows what changed and the ETA has a byte total.
  Manifest is written ONCE, after the zip exists (the first node block was deleted as redundant).
- **str_replace gotcha**: the file editor silently no-ops on index.html (1.5 MB) — every edit
  "succeeds" but changes nothing. sw.js edits work fine. For index.html use an atomic python
  replace pass with count==1 assertions, then parse-check both inline script blocks
  (`<script(?![^>]*src=)` extraction → `node --check`).
- Manifest flow verified locally: built the zip, ran the exact workflow node block, got
  `{version:'56.0.12', size:'384510', notes:[3 items], date:'…6:30 PM ET'}`.

## OTA "I got the update but reopening didn't apply it" (Sep 6, 2026, post-v56.0.16) — DIAGNOSED, no code change
- User report: got the OTA toast, closed + reopened the app, still old version. Chain of custody
  verified end-to-end: live Pages `ota/manifest.json` = 56.0.16; `ota/SideCut-web.zip` contains the
  fixed updater (applyStagedNow/getNextBundle present), APP_VERSION 56.0.16, both inline script
  blocks parse clean (`new Function`), `node --check` clean on native-updates.js. CI runs 34057489955
  (Pages) + 34057489961 (AAB) green for 4fb7c05. **The published bundle is good.**
- **Root cause of the symptom: one-way latch.** The user's installed build runs the OLD updater
  (v56.0.11-era code from 7a28e81: staged bundles only say "restart the app to finish installing"
  and NEVER call `set()` themselves — the plugin applies on background events, which swipe-away
  kills interrupt). That updater can't be fixed by the OTA it delivers — it has to first install
  the fixed one. Also, once the fixed bundle DOES land, the plugin's auto-revert still silently
  kicks any bundle that never calls `notifyAppReady()` back to the previous version on relaunch —
  indistinguishable from "didn't get the update" without checking the OTA log lines.
- **Escape hatches for the user (in order)**: (1) reopen the app, leave it OPEN ~10 min (the 30-min
  interval is 0/30/60…, but foreground visibilitychange fires an immediate silent check) so the
  OLD code at least re-stages 56.0.16, then fully background it (Home gesture — NOT swipe-away)
  so the plugin's background handler applies it, then reopen. (2) If that fails, install the new
  AAB from Actions artifact `SideCut-5.0.44-release` once — every OTA after that works. (3) On the
  NEW updater, a stuck staged bundle is applied automatically at launch (`applyStagedNow`), and
  "didn't get it" on the new updater = bundle was rolled back by auto-revert → check logcat for
  `[SideCut OTA]` (a crash before `toast` is defined leaves the bundle unconfirmed → revert).
- **DO NOT bump the version again chasing this** — v56.0.16 already ships the fix and Pages is
  serving it; another bump just adds another stage/apply cycle the old updater can't finish.
- Changed files: none (diagnosis turn).

## Play Billing native purchases (Sep  ồ4,  ồ2026) — v56.0.6
- **Goal reached: native Google Play Billing works in the Capacitor WebView app** —
  `@capgo/native-purchases@7.19.3` added (`.npmrc` at repo root sets
  `legacy-peer-deps=true` so CI `npm install` succeeds despite plugin peer
  `@capacitor/core >=7` vs project core `^6`.) Billing adapter region lives in
  `index.html` (validated 9/9 harness checks; APP_VERSION `56.0.6`,
  sw.js cache `sidecut-shell-v56.0.6`; CHANGELOG entry added).
- **Two CI-required env facts (both committed and pushed**:
  1. **minSdk 23**: downstream `com.android.billingclient:billing:8.3.0`
     declares `uses-sdk:minSdkVersion 23`;the Capacitor 6 template pins
     `22`,so Gradle manifest merger failed. `.github/workflows/patch-sdk.py`
     now also rewrites `minSdkVersion` in `android/variables.gradle` (min 23;
     max-with-any-future-explicit-higher-value). Verified vs a mock template:
     `compileSdkVersion=36 targetSdkVersion=36 minSdkVersion=23`.
  2. **JDK 21**:the plugin module compiles with `release 21`,so the
     runner JDK 17 threw `invalid source release: 21`. `.github/workflows/
     android-build.yml` sets `java-version: '21'` (quoted). Commit dcf9613.
## Android Capacitor signing (Aug 30, 2026) — REAL Play upload keystore
- User has the REAL upload keystore (`signing.keystore`) used for the existing
  Play app `com.SideCut.myapp`. The Capacitor cloud build (.github/workflows/
  android-build.yml) signs the AAB with it, via 4 GitHub repo secrets:
  `ANDROID_KEYSTORE_BASE64` (keystore, base64), `ANDROID_KEYSTORE_PASSWORD`,
  `ANDROID_KEY_PASSWORD`, `ANDROID_KEY_ALIAS` (alias: `my-key-alias`).
- Keystore material NEVER lives in the repo; the workflow decodes it from
  secrets at build time (patch-signing.py). Builds fail fast if the secrets
  are missing.
- Goal: packaged as a Capacitor **WebView** app (NOT the PWABuilder TWA) so the
  lock-screen / media notification is attributed to the SideCut app icon
  instead of Chrome's. Same appId keeps it an in-place Play update.
- `tools/base64.html` (served on GitHub Pages) lets a phone-only user base64-
  encode the keystore locally, no computer needed.


## GUEST PREFERENCE (Aug 30, 2026): DO NOT bump the version
- The user explicitly said "Don't bump ver" — stop incrementing APP_VERSION.
  Leave APP_VERSION at 52.5 and sw.js CACHE_NAME at sidecut-shell-v52.5 for
  small fixes. index.html is served network-first in the SW, so plain edits to
  index.html still reach the installed app on its next reload even without a
  cache-version bump (though a stale-SW user may need a hard refresh). Only
  bump if the user explicitly asks.

## Post-v50.0.10 follow-up #3 (Aug 28, 2026, no version bump) — "only first and last albums" Album History glitch

Root cause: the cached-branch re-sanitize that serves sidecut_ahArtistData compared a normalized row artist name against the raw pinned-artist key, which keeps spaces and case intact。 nameMatchArtists failed for any real artist with a space,so every row for that artist was silently dropped from the re-render → the popup showed a bare Refetch shell or a few surviving rows,and that truncated shell got cached,persisting across close and reopen. A fresh Refetch, which compares raw verses raw consistently, showed everything — hence“refetch fixes it, exit and return breaks it”.

Fix, no version bump, APP_VERSION stays 50.1.5 and sw.js untouched: 1) the cache-branch sanitizer now uses the normalized artist key everywhere and only nameMatchArtists — normalized against normalized;2) _renderAhFromData with an empty input now shows dp-empty instead of rendering a bare Refetch shell, so no path can cache a truncated body over a good full popup cache。



Gotcha:the seed-merge sanitizer already normalized both sides;the cache-branch one was the inconsistent copy。 Always normalize both artist sides,and use nameMatchArtists only,never a raw strict-equality compare between differently normalized strings。

## Post-v50.0.10 follow-up #2 (Aug  ồ28,  ồ2026, no version bump) — AH filtering/delete/cover/Retry/pinned-notif fixes
- **NO version bump per user.** sw.js untouched. APP_VERSION stays 50.0.10。
- **EPs/singles by the artist are FINE — don't delete them.** User: "No don't delete eps那些are fine" (this reversed the earlier "too general" complaint — there the problem was *wrong-artist* EPs, not EPs per se. The artist-match filter (`nameMatchArtists` → `primaryArtistName` both sides) excludes wrong-artist rows; legit EPs/high-track-count singles stay。) All 4 `noise`/`_noiseR`/`_noiseS` regexes (fresh fetch, per-artist refetch, cache re-sanitize, seed re-sanitize) dropped `ep`/`single` (keep karaoke/tribute/bootleg/unreleased/video album/remix (es|bundle|album)/focus collection/non.?stop/mashup + trailing "remix"。 Also each fresh-fetch `filterInto` still `trackCount <= 1` skip singles — matches the cached sanitize behavior。
- **Delete persists across refetches + cross-`collectionId` sources**: `hideAlbum(cid, cname)` now pushes BOTH `String(cid)` and `'t:' + normalizedTitle` into `sidecut_hiddenAlbums`; every fetch path (main filterInto, per-artist refetch filterInto + Deezer + MusicBrainz release-groups, echoed in the two re-sanitize passes) consults `isAlbumHidden(cid, cname)` (id + `t:`-title check) — so a deleted album can't come back under a different storefront's collectionId or a slightly different edition title. Batch-delete (📋 select-mode) now passes the real title (`hdr.dataset.album`) instead of `''`。(Per-row ✕ already passed `data-cname`。。
- **Cached artist data re-sanitized before render**: both the `!wasRefetch` cache branch (~16440)and the seed-merge for a real refetch (~16493) now re-run the SAME filter as the fresh fetch (hidden id/title, normalized-title guard, noise/remix, `primaryArtistName`+`nameMatchArtists` strict artist match, trackCount<=1 drop, delete empty artist keys, empty-artist deletion)。 — so junk stored by pre-filter versions can't resurrect by serving `sidecut_ahArtistData` alone。
- **Album-track "Retry" was dead — selector typo**: the three Retry links used `this.closest('.dp-ah-songs')` — but the track container class is `.dp-ah-albums` — so `c` was null,and nothing happened. Now `.dp-ah-albums` + resets `dataset.loaded`/`innerHTML`/`display:none` then re-clicks the header (which resets `mbFallbackDone` itself at load-start)。 Both "No tracks found." and "Error loading tracks." paths fixed。
- **Manual album covers glitch — root cause: `__ahResolveArtworks()` was NEVER CALLED.** The reapply-by-`artist|album` logic existed (lines ~18453+)but had zero call sites; only `loadCachedDiscoverPopup` (~19085) re-applied covers, so after a fresh render/refetch the custom cover reverted to the iTunes `data-art-url` (the "glitch")。 Fix: `__wireAH()` — which runs after every fresh render, cached restore,and track load (`_renderAhFromData` end + cache branch + popup restore)— now ends with `try{ if(typeof __ahResolveArtworks === 'function') __ahResolveArtworks(); }catch(_e){}`。 Covers key = normalized `artist|album` via `sidecut_ahCovers`。
- **Pinned-artist "new releases" alert removed from the notification bell**: `hasReleasesAlert` is gone from the badge computation,and the "🆕 N new releases from pinned artists" / "New from your pinned artists" block is gone from `renderNotifPanel`'s summary HTML. The Discover releases risepot (untouched) remains the pinned-artist release surface。(Also the badge now only flags changelog/duplicates/enrich/export。)
- Verification: both inline `<script>` blocks `node --check` clean;2 blocks。
## Post-v50.0.10 follow-up (Aug 27, 2026, commit d76bc12) — "Fetching albums" popup stuck/auto-every-time
- **User: "the popup opens in album history but it just says everytime fetching albums from pinned artists automatically"** +
  remove the "update will hit when song pauses" toast. ROOT CAUSE (found via real-browser storage dump):
  1. **`_getManualCount` / `_promptManualCount` were referenced but NEVER defined** (since commit 603bf40 "manual
     album/track count overrides"). The Album History render (`__refetchAlbums`'s completion block, ~16942/16966)
     calls `_getManualCount` per artist/album → `ReferenceError` on the first row → the big `try{}` skips straight
     to `finally{}`, the popup stays frozen on "Fetching albums from pinned artists…" forever, and
     **`openDiscoverPopup` (which writes `discPopupCache_📀 Album History`) never runs** → no cache → every tap
     re-fetches. Lesson: a `ReferenceError` in a render pipeline shows as a *stuck loading state*, not a crash.
  2. The 24h popup-cache expiry made any >24h-old cache re-fetch from the network on open.
- **Fix (no version bump, no sw.js — user explicitly requested):**
  - Defined `_getManualCount(artist,album,field)` + `_promptManualCount(...)` right before `__refetchAlbums`,
    backed by `localStorage['sidecut_ahManualCounts']` (key `artist\u0001album\u0001field`).
  - Cache branch now serves the popup cache at **ANY age** (`ahCached.title && ahCached.body`, dropped the
    `ts < 24h` check) — opening Album History is instant/offline forever; the **only** network trigger is the
    in-popup "Refetch albums" button (`wasRefetch=true`). No auto-fetch on Discover open, on load, or on tap.
  - Removed `toast('Update ready — will apply when the song pauses or ends', 4000)` (~15584) — `__pendingSWReload`
    still set, update still applies on pause silently.
- **Verification DONE in a real browser**: seeded pins → Discover → tap 📀 Albums → after my fix the fetch
  completed and `discPopupCache_📀 Album History` was written with a fully rendered album list (The Weeknd 21
  albums w/ artwork + track counts). Before the fix the same harness left only `sidecut_ahArtistData` (incremental
  saves inside the worker loop, BEFORE the render) and NO popup cache — the bogus "render works" signal.
- **Gotcha**: don't trust `sidecut_ahArtistData` existing as proof the popup renders — it's saved incrementally
  per-artist inside `runAhWorker` (16878), which runs before the final render. The final render (and the popup
  cache write) is what actually proves the flow works.

## v50.0.10 (Aug 27, 2026) — Album History works again; fetch is tap-only
- **The disable was an over-correction.** A previous session's "Album History infinite
  auto-fetch" complaint led to commit 4144e0a, which stubbed `__refetchAlbums` to show
  "Fetching is temporarily disabled". But the ACTUAL auto-fetch loop (`__resumeAlbumFetch`,
  load + visibilitychange auto-resume) was already removed in 6e69b23 — the disable shipped a
  dead button for a bug that was already fixed. Re-enabled the fetch pipeline in
  `__refetchAlbums` (index.html ~16441) + bumped APP_VERSION 50.0.9→50.0.10, SW cache
  v51.62→v51.63 (the bump is what makes the fix reach SW-served users).
- **All `__refetchAlbums(true/false)` callers are explicit user actions** (grep-verified): the
  main `ahBtn.onclick` (📀 Albums), the popup's "Refetch albums" button, the `wasRefetch` variant,
  plus a couple of internal no-op guards — every entry requires a tap. No boot/interval/visibility
  trigger exists anymore. Per-artist refetch (`__refetchArtistAlbums`) explicitly does NOT re-run
  the full fetch (see its "Don't refetch ALL artists" comment + cache-clear at ~16387).
- **KEY GOTCHA — album wiring lives INSIDE navigate()'s if(isDiscover) branch**: `__wireAH`,
  `__refetchAlbums`, the discoverAlbumHistory/discoverSingles onclick assignments, and the
  boot `if(typeof window.__wireAH==='function') window.__wireAH()` call (index.html lines
  ~15797-17043) are all nested in the `navigate()` function's `isDiscover` block (line 15674).
  They only execute when the user OPENS Discover. If you probe `window.__refetchAlbums` while
  Home/Library is active, it's legitimately `undefined` — not a bug. Users only ever hit Albums
  from Discover, so it works for them.
- **Why the earlier "undefined in browser" investigation was misleading**: probing globals
  right after load (Home active) showed `__refetchAlbums`/`__wireAH`/`navigate` undefined and
  block 0 appeared to "abort" silently — but it was just the isDiscover guard. Always navigate
  to Discover before assuming the fetch pipeline is missing.
- Browser E2E via same-origin harness (dev/ files deleted after): seed pinnedArtists into
  IndexedDB (meta store, `{name, art, addedAt}`), switch to Discover, click 📀 Albums →
  `sidecut_ahArtistData` written with real iTunes albums (The Weeknd: 21 albums w/ track counts).
- Version 50.0.9 → 50.0.10 (SW sidecut-shell-v51.62 → v51.63). Changelog entry at head of 50.0.10.

## v49.5.7 follow-up #5c — why every update forced an AH refetch (commit 38f6002)
- The popup cache lives in `localStorage['discPopupCache_<title>']` (24h TTL),
  so version updates were NOT inherently wiping it. The real bug:
  `window.__wireAH = function(){...}` was defined INSIDE `ahBtn.onclick` at
  the end of the first-ever fresh fetch, and the cache branch guards on
  `typeof window.__wireAH === 'function'` — on the first tap after ANY page
  load (e.g. right after an update) the guard failed → full refetch. Fix:
  hoist the assignment to page top-level so the cached popup is servable on
  the first tap of every load. The stray `};` + guarded call leftovers in
  that section are LOAD-BEARING (the section's original closers) — removing
  them breaks the parse; there's a NOTE comment on-site.
- Fetch speed: the per-artist pipeline (artist-ID search → lookup →
  optional storefronts → paged search → song-credit scan → Deezer) is
  ~15-25 hops; 10+ pinned artists run serially = minutes. Artists now run
  through a 4-worker pool with progress text ("⏳ Fetching albums… 3/12").
  Verified: cache-tap ~220ms post-reload; parallel timing test seeds
  Madonna/Beatles/Weeknd.

## v49.5.7 follow-up #5b — the ACTUAL wireAH scope bug (commit 626a0de)
- **The real wireAH bug**: the assignment `window.__wireAH = function(){...}`
  sits INSIDE `ahBtn.onclick`, but the CALL
  `if(typeof window.__wireAH === 'function') window.__wireAH();` was OUTSIDE
  that onclick body. It ran once at page boot — before the assignment —
  so nothing was ever actually wired. Follow-up #4 incorrectly claimed
  the call was "after a fresh build AND after loadCachedDiscoverPopup" —
  only the cached-load branch was guarded correctly.
  **Lesson**: when a user reports "X works but Y never runs", the wiring
  may be syntactically valid yet *scopally dead* — always grep for BOTH
  the assignment AND every call site, and verify each reach. Fix: call
  `window.__wireAH();` INSIDE ahBtn.onclick, immediately after
  `window.__wireAH = function(){...};`.

## v49.5.7 follow-up #4 — Album History collapsibles dead on cached loads (commit cd0efec)
- Root causes: (1) the track-fetch IIFE call passed the stale `trackUrls` name
  instead of `trackSources` (ReferenceError -> "Error loading tracks." on every
  album expand); (2) cached popups from `loadCachedDiscoverPopup` restore RAW
  HTML with zero listeners, so expand/collapse, remove ✕, hold-to-remove and
  the refetch button were all dead on cache hits.
- Fix: the whole wire-up block is now `window.__wireAH = function(){ ... }`,
  called after a fresh build AND after `loadCachedDiscoverPopup(...)`; the
  cache-hit branch additionally requires `typeof window.__wireAH === 'function'`
  so the first tap after a page reload falls through to a fresh build (which
  assigns it) instead of serving a dead cached popup.
- Changelog item appended to the existing 49.5.7 entry. No version bump.

## v49.5.7 follow-up #5 — second unguarded __wireAH call was KILLING boot (commit 770c3e5)
- The same follow-up-added wire-up has a SECOND call site: at the end of the
  fresh-build path right after `wireAHRef/window.__wireAH = function(){...}`
  is assigned, it also calls `window.__wireAH();` (warm-up). That call was
  UNguarded — unlike the cached-load branch, it would throw when run before
  the assignment. Worse: it sits right after navigate() in the boot chain,
  so this TypeError ("window.__wireAH is not a function") killed the whole
  boot sequence (Auto-load failed) and left every Home bubble at its
  placeholder/0 state even though the library data was fine.
- Fix: both call sites now `if(typeof window.__wireAH === 'function')
  window.__wireAH();`. App boots clean; bubbles populate on reload again.
- Boot-crash lesson: a stray throw *inside the auto-load async chain* aborts
  before `boot()` finishes, which kills renderHome/pinned artists/library
  stats — but only SOME bubbles empty (favorites/playlists rendered from
  independent listeners anyway). "Some bubbles empty" is a diagnostic hint
  for an async boot-throw, not a data issue.
- WARN: extracting a long inline block into a named function in index.html via
  python substring wraps is error-prone — always brace-check per-line and
  parse-check with acorn/`new Function` immediately after.

## v49.5.7 follow-up #3 — 24h popup cache for Album History + Old songs
- **User: "why does fetching albums have to refetch everytime, same with old
  songs."** Both handlers now consult the existing `discPopupCache_<title>`
  localStorage slot FIRST and serve it when `ts < 24h` — bypassing the entire
  network pipeline (for Album History: up to ~4+ lookups/artist + Deezer
  passes). The "🔄 Refetch albums" button sets `_isRefetch` which skips the
  cache — the escape hatch for genuinely new content. Old songs has no
  in-popup refetch (no room in the row), so it self-rolls on the 24h expiry.
  Cache keys: `discPopupCache_📀 Album History` / `discPopupCache_📅 Old
  songs` — keep the exact title strings consistent (emoji included).
- Also added to the head of the 49.5.7 changelog entry.

## v49.5.7 follow-up #2 — Old songs window + Get Songs quick-action label
- **"Old songs" (renamed from "Songs from last year")**: the user's complaint
  was everything shown was 1000+ days old. Root cause: the single
  `entity=song&limit=50` search page holds the artist's ~50 MOST POPULAR
  tracks (relevance-ranked), and a 1–3-year-old hit is rarely in that set —
  so an "over 365 days" filter only matched the ancient entries on the page.
  Now per pinned artist the handler unions 3 entity queries (song, album,
  musicVideo — each limit 50), dedupes by track+artist key, and filters to a
  real WINDOW `365d <= age <= 3*365d` of the CURRENT date (no `minDate`
  var — that's dead in this one). Button label, popup title, empty message,
  and offline-cache key all renamed to "Old songs". Version stays 49.5.7;
  changelog bullet inserted at the head of the existing 49.5.7 entry. SW
  cache already at 49.5.7 — any fix that's pushed needs SOME way to reach
  users: if a same-version fix gets re-reported as not visible, bump.
- **Quick-action labels for the expand→Get Songs rename**: a custom quick
  action of type `settings` rendered its TOOLTIP as `Open settings: expand`
  (raw key) and the Sandbox add form's settings-select had NO expand/Get
  Songs option at all (only 8 of the 10 live tabs; refresh also missing).
  Added `SETTINGS_TAB_LABELS` map next to SETTINGS_TABS (expand:'Get Songs'),
  `actionTitle` uses it, and both missing options added to
  `#customActionSettingsSel`. hbQuickMeta (Home quick-actions grid) does NOT
  include expand on purpose (grid is quick-settings shortcuts; expand is the
  Get Songs form, matches SETTINGS_TABS grid Meta keys conceptually… update
  only if the user asks for it in the grid — it also lacks 'refresh' on
  purpose? No: it HAS refresh; expand is deliberately not a quick-jump since
  the grid predates the rename — leave unless asked).

## v49.5.7 follow-up (same day) — REVERTED the multi-ID track fetch
- **User immediately re-reported: "tracks now just don't load."** The
  `seenIds`/`data-ids` design (every dedupe key accumulating every edition ID,
  expand trying ID × 5 storefronts) was OVER-ENGINEERED: capped artists had
  ~10+ IDs per title → 20-40 sequential proxy lookups before any tracks
  rendered — reads as "nothing loads." Reverted to the v49.5.5 behavior:
  ONE iTunes lookup with the album's own collectionId + country fallback
  ([_country, GB, IN, US, default]), and one Deezer /album/{id}/tracks call for
  _dz albums. `seenIds`/`data-ids`/`_ids` are GONE; `seenCids` is back.
  **Lesson: don't batch dozens of sequential network lookups on a tap path —
  keep tap-lazy fetches to ~5 max, and never multiply ID×storefront.**

## v49.5.7 (Aug 23, 2026) — Deezer backup + comp cleanup + 3-day genre cache
- **User follow-ups**: (1) find a backup album source, (2) "random albums not
  made by him" showing, (3) albums with a track count but no tracks when
  expanded, (4) manifest JSON / TWA question, (5) Top Hits + genres should
  refresh periodically.
- **Deezer backup pass (~line 14996, inside the capped-lookup block)**:
  Deezer's public API (`api.deezer.com`) is CORS-blocked → goes through
  `fetchWithProxy` like iTunes. Two sources: the artist's own
  `/artist/{id}/albums` pages, and a track search `artist:"<name>"` (Deezer
  honors the `artist:"..."` filter; search caps at 100/page → 3 pages via
  `index=`) where an album qualifies at >=2 track-hits, then `/album/{id}`
  resolves date/contributors. Deezer rows carry `_dz:true` + null trackCount
  (list rows lack `nb_tracks`); `dzAdd` applies a STRICTER `dzNoise` list
  (adds best of/top hits/workout/party/collaborations/playlist/essentials/
  greatest/trailing-mix) because Deezer artist pages mix in editorial comps
  the artist merely appears on. Verified: Diljit 35→41 (adds "Dil" 2008, the
  Jihne Mera Dil Luteya soundtrack), comps killed, Weeknd untouched.
- **Random-album fixes**: `noise` regex gained `non.?stop` + `mashup`;
  `normTitle` strips `soundtrack` tags (merges "(Original Motion Picture
  Soundtrack)" dupes); track-credit pass now rejects `artistName === 'Various
  Artists'` collections (Des Hoya Pardes-type comps).
- **Empty-track fix round 2**: `seenCids` became `seenIds` — every dedupe key
  accumulates ALL candidate IDs (`{id, country}` iTunes / `{id, dz:true}`
  Deezer); albums carry `_ids`; the header gets `data-ids` JSON; the lazy
  track fetch tries iTunes lookups for every ID × storefronts then Deezer
  `/album/{id}/tracks` (normalized into trackName/trackTimeMillis/trackNumber).
- **3-day chip cache**: `runDiscoverSearch` caches chip searches (chipIdx !=
  null only — manual searches always live) in localStorage
  `sidecut_discoverChipCache` keyed by term, TTL 3 days, with stale-cache
  offline fallback; status line shows "(updated Aug 23)" when cached.
- **Manifest/TWA answer (no change needed)**: manifest.json is valid
  (standalone, icons, start_url). "Running in Chrome" on install means Chrome
  couldn't verify the TWA's Digital Asset Links (assetlinks.json on the
  origin doesn't match the APK's signing key) so it falls back to a plain
  webapp install — that's Play Console/assetlinks config, NOT this repo.
- Version 49.5.6 → 49.5.7 (SW sidecut-shell-v49.5.6 → v49.5.7).

## v49.5.6 (Aug 23, 2026) — manual-only release checks
- **User asked: don't auto-fetch new releases — only on button tap.** Removed
  the boot-time auto-check (`setTimeout(checkPinnedArtistReleases, 5000)` after
  auto-enrich) and the window-focus check (10-min throttle). The only remaining
  call sites are the manual "Fetch latest" big button in Discover and the
  pinned-section "Check now" (`newRelesRefresh` → `checkPinnedArtistReleases`).
  `renderNewReleases()`/`renderPinnedArtists()` only DISPLAY cached IDB data —
  they don't fetch. Version 49.5.5 → 49.5.6 (SW sidecut-shell-v49.5.5 → v49.5.6).

## v49.5.5 (Aug 23, 2026) — track-credit discovery + storefront-aware tracks + added date
- **User follow-up on the multi-storefront merge**: "old albums have no songs
  in them" + "albums from 2002–2008 still missing" + "song info should show
  when the song was added".
- **Track-credit discovery (~line 14928)**: after the capped-lookup path, one
  artistTerm SONG search (offset is IGNORED for song searches — pages repeat,
  verified — so a single page; the default page + a `country=IN` page are
  unioned because the 200-entry page is relevance-ranked and non-deterministic)
  finds collections whose TRACKS credit the pinned artist. Verified against
  live data: a collection qualifies with as few as ONE track hit (the `>=3`
  threshold dropped it — "Smile" fluctuated between 1 and 3 hits across
  identical requests). Candidate album lookups run in batches of 8 in parallel;
  an album is added only when the artist fronts a MAJORITY of its tracks
  (`hisTracks > totalTracks/2`) — keeps modern one-feature soundtracks (Crew,
  Soorma) out while catching Punjabi director-credited albums (Smile→Sukhpal
  Sukh, The Lion of Punjab→Anand Raj Anand). Live result: Diljit 25→35 albums,
  Gurdas Maan 63→69 (54 pre-2008), Weeknd unchanged at 21 (pass skipped for
  under-cap artists). Still unreachable: Diljit's 2004–2006 originals (Ishq Da
  Uda Ada, Dil, Ishq Ho Gaya) — Apple only stocks director-credited
  re-recordings whose tracks don't surface in his song-search pages at all.
  If reported again: Apple catalog gap, not code.
- **Empty track list fixed**: filterInto now tags each kept album with
  `r._country` (storefront of origin); the album header carries
  `data-country`, and the lazy track fetch tries `[albumCountry, GB, IN, US,
  default]` (deduped) until one returns songs — a GB-only album (Over
  Exposure) returned 0 tracks from the default storefront. `fetchTracks(urls)`
  is a recursive promise chain with a single trailing .catch.
- **Song info "Added" row**: `dateAdded` stamped at file import (~9456),
  round-trips through persistTrackMeta (~8840), boot restore (~8895), export
  manifest (~11104), import (~11466, defaults to now for old exports), and
  merge (~11425). Old libraries show 'Unknown' (only imports ever stamped it).
- Version 49.5.4 → 49.5.5 (SW sidecut-shell-v49.5.4 → v49.5.5). User explicitly
  asked for the bump this time.

## Album History multi-storefront merge (no version bump, Aug 24, 2026)
- **User re-reported: "Old Diljit Dosanjh albums before 2008 still don't fetch".**
  Root cause is NOT the cap/paging — it's REGION LOCKING. iTunes serves a
  different catalog per storefront: the US/IN lookups for artistId 423087540
  have ZERO pre-2008 albums, but the GB storefront has "Over Exposure"
  (2005-08-25, 9 tracks) — also ES/NL/SE/NO/DK. Fix (~line 14880): when the
  default lookup hits the 200-entry cap (`lookupCount >= 200`), also merge
  `lookup?id=...&country=GB/IN/CA/AU` through the same `filterInto` (dedupe by
  normalized title handles cross-store dupes; earliest releaseDate wins).
  Verified live: Diljit 25→31 albums (1 pre-2008), Gurdas Maan 57→63
  (50 pre-2008, oldest 1982), Beatles 39/26 pre-2008 unchanged (no cap → no
  extra fetches), Weeknd 21 unchanged.
- **Hard limit discovered: Diljit's 2004–2006 albums (Ishq Da Uda Ada, Dil,
  Smile, Ishq Ho Gaya) are NOT on iTunes under his name in ANY storefront.**
  Apple only carries 2008 re-recordings credited to the MUSIC DIRECTORS
  (Ishq Da Uda Ada→Bablu Mahendra, Smile→Sukhpal Sukh, Ishq Ho Gaya→Sachin
  Ahuja — track-level credits ARE Diljit, album-level isn't). These never
  appear in term/artistTerm search pages for "Diljit Dosanjh" (checked 600+
  results), so no fetch pipeline can surface them under his name. If the user
  asks again: it's an Apple catalog gap, not a code bug.
- **iTunes search offset gotcha**: for "Diljit Dosanjh" entity=album, offset
  pages 200/400 returned the SAME 200 entries as page 0 (offset is unreliable
  on some queries). Don't assume paged search always goes deeper.
- Changelog item added to the EXISTING 49.5.4 entry — NO version bump per
  user (APP_VERSION + CACHE_NAME stay 49.5.4). Stale-SW users won't see it
  until the next bump — bump both together if re-reported.

## Album History refetch + pre-2008 follow-up (no version bump, Aug 24, 2026)
- **User re-reported: "Refetch albums doesn't do anything" + "pre-2008 albums
  aren't showing" after v49.5.4.** Live browser testing showed v49.5.4 already
  worked for well-matched artists (Beatles 26 pre-2008) and refetch DID re-run
  — but silently (rebuilt the popup + collapsed the expanded list with zero
  feedback → reads as "does nothing").
- **Real remaining bug found via live test with Gurdas Maan**: the
  `entity=musicArtist` search returned an artistId whose lookup albums ALL
  failed the credited-artist filter (wrong-ID match) → the artist silently
  showed ZERO albums. The old code only used the term-search fallback when
  artistId was null, never when the ID resolved wrong. Fix: the filter is now
  a reusable `filterInto(results)` pass; the paged term search (offsets
  0/200/400) runs whenever `!artistId || lookupCount >= 200 || seen is empty`.
  Verified live: Gurdas Maan 0 → 57 albums (45 pre-2008, oldest 1982).
- **Refetch is now unmissable**: refetch sets `ahBtn._isRefetch = true` and
  calls `ahBtn.onclick()` directly (same pattern as the remove-album flow);
  the handler captures `wasRefetch` after the premium/pins guards, paints
  "⏳ Refetching albums — hang tight…" into `#discPopupBody`, and toasts
  "📀 Refreshed — N albums across M artists" after the popup rebuilds.
- Changelog updated in the EXISTING 49.5.4 entry — NO version bump per user
  (APP_VERSION + CACHE_NAME stay 49.5.4). **Note: users on a stale SW won't
  see this until the next bump — if re-reported, bump both together.**

## v49.5.4 (Aug 23, 2026)
- **Album History pre-2008 fetch** (`discoverAlbumHistory` onclick ~14800):
  artist search `entity=musicArtist` limit 5 → 25 (exact-name match was being
  crowded off the first page, dropping to the relevance-ranked term search
  where old albums are buried); when a response hits the 200-entry iTunes cap,
  extra pages are fetched via the SEARCH endpoint with `offset=200/400`
  (lookup does NOT support offset, search does — verified); dedupe now prefers
  the EARLIEST releaseDate per normalized title (tie-break: most tracks) so
  pre-2008 albums show their original year instead of a 2009+ remaster date.
  Verified vs live iTunes: Beatles 26 pre-2008 (was 23), Madonna 26 (was 25),
  Miles Davis 117 (was 115), Weeknd still 21. The unused `minDate='1900-01-01'`
  leftover was removed.
- **Songs From Last Year flipped to "over 365 days old"** (~14773): filter is
  now `releaseDate < minDate` (minDate = exactly 1 year ago), results sorted
  releaseDate-desc per artist; empty message "No songs over 365 days old
  found." Button label/title unchanged ("Songs from last year").
- **New default turntable angle: TILT 5 / SPIN -88 / ROLL 117** (sliders are
  -180..180; values estimated from a user screenshot of desired settings).
  Changed in FOUR places that must stay in sync: `.np-tt-3d` CSS fallback
  (~628), `body.sandbox-compact-nowbar` fallback (~579), JS `let rx/ry/rz`
  initial (~3528), popup `DEFAULT_ANGLE` (~3572). Saved `npTurntableAngle`
  meta still wins for existing users.
- **Things to know top bullet**: long-press the mini record player →
  Turntable angle popup (TILT/SPIN/ROLL, Reset restores default).
- Version 49.5.3 → 49.5.4 (SW sidecut-shell-v49.5.4).

## v49.5.3 (Aug 23, 2026)
- **Converter recommendation duplicated into Settings → Get Songs**: the
  collapsed 💡 Converter recommendation `<details>` (Spotisaver, name-only —
  no URL) from Discover's how-to box now also sits in `#settingsPaneExpand`
  between the how-to text and the expand input. Same copy, kept as a native
  `<details>`. Version bumped 49.5.2 → 49.5.3 (SW sidecut-shell-v49.5.3).
- `_toggleNR` is INTENTIONALLY gone (New Releases dropdown removed from
  Discover) — `dev/_boottest.js` still smoke-tests it and reports
  "not a function"; that's stale test code, not a bug. `_toggleGenres` is
  the live one.

## Settings: Download tab removed, Expand URL → Get Songs (no version bump, Aug 23, 2026)
- **Settings Download section fully removed**: `#settingsTabDownload` button,
  `#settingsPaneDownload` div, both `showSettingsTab` display/active lines, the
  click listener, the `<option value="download">` in `#customActionSettingsSel`,
  `'download'` in `SETTINGS_TABS`, its toast string, and the `download` entry in
  `hbQuickMeta` (Home "Quick actions" grid). Saved custom actions with value
  `download` now fail the `SETTINGS_TABS.indexOf` guard in `runCustomAction` and
  do nothing — acceptable (inert), no migration added.
- **Expand URL renamed to Get Songs in settings only**: tab label +
  `#settingsPaneExpand` heading changed; ids (`settingsTabExpand`,
  `settingsPaneExpand`, tab key `'expand'`) untouched, and Discover's own
  "🔗 Expand URL" box is deliberately NOT renamed. The pane's inner button is
  still labeled "Expand" (it describes the action, not the section name).
- **No version bump** (user request, still v49.5.2 / sidecut-shell-v49.5.2) —
  remember: users on a stale SW won't see it until the next bump; bump
  APP_VERSION + CACHE_NAME together if this gets re-reported.

## v49.5.2 (Aug 23, 2026)
- **The reorder-flicker fix never reached users — the version/cache bump was
  forgotten.** Commit 06e5ff4 removed the wiggle but left APP_VERSION at
  49.5.1 and CACHE_NAME at sidecut-shell-v49.5.1, so the cache-first SW kept
  serving the old flickering shell and the user re-reported the bug.
  Bumped APP_VERSION → 49.5.2, CACHE_NAME → sidecut-shell-v49.5.2, added a
  CHANGELOG entry, pushed. **Lesson: "no version bump" fixes are invisible to
  users on a stale SW — if the user will re-test the deployed app, ALWAYS
  bump APP_VERSION + CACHE_NAME together, even for "no bump" changes.**

## Reorder-bubble flicker fix (no version bump, Aug 23, 2026)
- **Wiggle/glow animation removed from reorder mode — photosensitive risk.** In
  `#homeBubbles.reorder-mode` bubbles used to run `hb-wiggle 0.3s infinite`
  (±1.2° rotation, staggered) plus the `sd-glow-pulse` glow — a strobing grid.
  Now reorder mode shows a STATIC dashed outline
  (`outline:2px dashed coral 45%`) + `cursor:grab`; the `.hb-glow` animation is
  forced to `animation:none`; `@keyframes hb-wiggle` deleted. `hb-dragging` keeps
  `cursor:grabbing` and drops the outline.
- **renderHome() skips the grid while in reorder mode.** It rebuilds
  `bubbles.innerHTML` on every play/pause/stats event while Home is active, and
  each rebuild restarted the infinite animations (visible strobe) AND destroyed
  any in-progress drag element. Guard: `if(bubbles.classList.contains('reorder-mode')) return;`
  (class check, not `hbReorderMode`, to avoid TDZ on early boot calls).
  `exitBubbleReorderMode()` now calls `renderHome()` once after Done to re-sync
  skipped play/pause updates.
- **No :hover/:active pops in reorder mode** (follow-up, same day): the dragged
  bubble is `pointer-events:none`, so every bubble the finger passes over
  flashed the coral hover border + box-shadow, and every finger-down briefly
  scaled the bubble 0.96. Reorder mode now forces
  `border-color:var(--line); box-shadow:none` on `:hover` and `transform:none`
  on `:active`.
- **Slot-pick hysteresis** (follow-up, same day): `placeHbPlaceholder(x, y,
  force)` skips re-picking unless the point moved ≥4px since the last
  successful pick (`hbDrag.placeXY`) — a finger parked on a slot boundary or
  the auto-scroll loop re-reading shifted rects could oscillate the placeholder
  between two slots (visible twitch). `endHomeBubbleDrag` passes `force=true`
  so the release point always lands.
- **Gotcha: this fix sat UNCOMMITTED for a session — the user re-tested the
  deployed build and saw the old wiggle.** Commit + push before telling the
  user it's fixed.
- Test: `/tmp/hbtest/test-flicker.js` — hold→popup→reorder entry, zero CSS
  animations on bubbles + glow, static outline, renderHome skip, hover-flash
  suppression, full drag swaps slots + persists, Done re-render, tap
  regression. 11/11 green.

## v49.5.1 (Aug 23, 2026)
- **Manual Home bubble sizes**: every bubble gets a `.hb-expand` chip
  (discreet top-right icon, expand-arrows SVG, opacity 0.32 — no border/
  background; `.sized` state tints coral) appended in `renderHome()`; each tap
  runs `cycleHomeBubbleSize(kind)` cycling `small → null(auto) → tall →
  wide → full`. State lives in `homeBubbleSizes` (meta key
  `homeBubbleSizes`), applied by `applyHomeBubbleSizes()` via
  `hb-size-*` classes (defined next to `.home-bubble.wide/tall`). Chip
  clicks stopPropagation + the reorder-hold `pointerdown` ignores
  `[data-expand]` (same pattern as `[data-miniplay]`). Pruned on custom
  action delete; cleared by `resetHomeOrderBtn` + sandbox reset.
- **Flicker-free expand animation**: the overlay panel now uses
  single-run KEYFRAME animations (`hb-panel-up`/`hb-panel-down`,
  ease-out, no overshoot) instead of class-flip transitions — the old
  `cubic-bezier(0.18,0.9,0.28,1.1)` spring settle + opacity transition
  was the visible flicker. `closeHomeBubble()` adds `.closing`, waits
  250ms, then removes `.open`. `openHomeBubble` does a reflow
  (`void overlay.offsetWidth`) so rapid reopens restart the keyframes.
  Panel docks to the bottom on ≤560px screens (sheet style).
- **Panel drag-to-resize**: `#hbPanelGrip` (first child of
  `#homeBubblePanel`) pointer-drags the panel height 40–92vh; persisted
  as meta `homePanelHeight`, applied in `openHomeBubble`.
- **Glow pulse calmed**: `sd-glow-pulse` was `opacity 0.65→1.3` — over-1
  opacity clips hard and reads as flicker. Now 0.55→0.9, and the
  is-playing glow runs at 6s (was 4s).
- **Gotcha**: `renderHome()` re-runs on every play/pause/stats event
  while Home is active and rebuilds `bubbles.innerHTML` — any infinite
  CSS animation on a bubble restarts then (potential strobe). Keep
  bubble animations slow/subtle, and never animate the overlay panel
  with re-triggerable transitions.

## Bk-47 cleanup + converter recommendation (no bump, Aug 23, 2026)
- The "Bk-47" codename (v47 changelog title + `#currentVersionLabel`) is
  removed — it was a one-off for that release. If a codename is wanted for
  a specific version, flag it in CHANGELOG and the label together.
- Discover how-to box now has a collapsed `<details>` ("💡 Converter
  recommendation") naming Spotisaver as management's Spotify-to-MP3 pick.
  Keep it name-only (no hard URL) — converter domains die constantly
  (spotidown/spoticatch/spotisaver.com/spotify-downloader all came and went).

## Home bubble reorder UX (no version bump, Aug 23, 2026)
- **Flow**: hold a Home bubble ~300ms → `#hbReorderBackdrop` popup
  ("Would you like to reorder your bubbles?" Cancel/Continue) →
  `enterBubbleReorderMode()`: `#homeBubbles.reorder-mode` wiggles bubbles
  (hb-wiggle keyframes), a "✓ Done" pill (`#hbReorderDone`) exits via
  `exitBubbleReorderMode()`. In reorder mode ANY bubble grabs on first
  7px of movement (no second hold) via a pointerdown-scoped window
  pointermove listener; taps don't open bubbles (click handlers gate on
  `hbReorderMode`, mini-play is inert too).
- **Bugs fixed vs the old long-press drag** (each cost a debugging round,
  don't reintroduce):
  1. Fixed-position jump: the old code translated by `x - wrapRect.left`
     while the element was `position:fixed` (viewport coords) — the bubble
     leapt away from the finger. `positionHbDrag()` now uses raw viewport
     coords (`x - offsetX`).
  2. Lag: the 0.18s `.home-bubble` transform transition wasn't disabled
     during drag — now `el.style.transition = 'none'` at grab.
  3. Browser stealing vertical drags as scroll: reorder mode sets
     `touch-action:none` on bubbles.
  4. Popup self-close race: a backdrop-tap-close listener made the
     synthesized click on hold-release instantly close the popup — the
     popup has NO backdrop-close now, only Cancel/Continue.
  5. Slot-pick instability: mid-FLIP-animation sibling rects made the
     drop-slot choice wander/ping-pong. Removed sibling FLIP entirely —
     `placeHbPlaceholder()` picks the slot from CLEAN rects (instant
     reflow + dashed `.hb-drag-placeholder` is enough feedback).
  6. The dragged el STAYS in the DOM (removeChild makes it invisible),
     which means DOM-adjacency checks (ph.nextSibling) LIE — slot math
     counts el-excluded indexes instead (`sibsBeforePh` loop).
  7. Drop-slot convention: row-major scan, "before the first sibling
     whose center comes after the point"; dropping exactly ON a bubble's
     center counts as AFTER (takes its slot).
  8. Pointermove events lag the finger — `endHomeBubbleDrag()` re-runs
     `placeHbPlaceholder()` with the pointerup coords so the release
     point always gets the final say.
- **Testing gotcha**: the app SELF-RELOADS ~1.2s after first boot in
  automation (SW registers on localhost → controllerchange →
  reloadForUpdate). Browser tests must wait ~3.5s before interacting or
  the context silently swaps mid-test.
- **Scrolling while reordering** (follow-up, same day): every bubble is
  `touch-action:none` in reorder mode, so the page itself can't be dragged
  to scroll. Two ways out: (1) `#homeBubbles.reorder-mode{ margin-right:26px }`
  leaves a slim touch strip at the grid's right edge that still scrolls;
  (2) `tickHbAutoScroll()` — an rAF loop running for the whole drag — scrolls
  `#homeView` when the finger parks within 72px of the scroller's top/bottom
  edge (quadratic ramp up to 14px/frame), re-running `positionHbDrag` +
  `placeHbPlaceholder` each frame from `hbDrag.lastX/lastY` (the pointer's
  last seen viewport coords, updated in `onHomeBubbleDragMove`). Stopped in
  `endHomeBubbleDrag`. Tests: TEST11 parks at the bottom edge and asserts
  scrollTop advances; TEST12 asserts the margin strip + scrollability.
- Puppeteer test harness lives in /tmp/hbtest (NOT in repo): test.js
  covers popup open, cancel, reorder entry, fixed-position drag, finger
  tracking, before/after split convention, drag-to-end (aims below last
  bubble), auto-scroll, scroll strip, Done exit, IDB persistence,
  reload survival, normal-tap regression. All green 6/6 runs.
- **Gap fix follow-up (Aug 23, 2026)**: the original `#homeBubbles` was
  `display:flex; flex-wrap:wrap` with `flex:1 1 140px` — after any
  reorder the row got weird stretch/wrap behavior and a big empty space
  opened. Now `display:grid; grid-template-columns:1fr 1fr` so the grid
  never stretches; `wide` spans both columns via `grid-column:1/-1`;
  `tall` is just a taller min-height. `placeHbPlaceholder()` also got a
  row-band guard (a sibling is targetable only when the point is within
  its own row band, or above it and horizontally near it) so a full-width
  bubble can't soak up drops meant for the two-column row above it; tall
  bubbles cap their band to one row height. The no-op bail compares to
  the drag's startIndex (not penultimate position) so returning to the
  original slot correctly persists/nops. Tests re-aim in live code using
  fresh rects fetched after the grab (the grid reflows when the drag
  starts; stale rect aims always miss).

## v49.0.5 (Aug 22, 2026)
- **Album History pre-2008 fix**: the v49 noise regex `\bremix(es| bundle)?\b`
  treated ANY bare "Remix" as a remix album — including edition tags like
  "[2019 Remix & Remaster]" — which wiped out classic catalog (Beatles had
  31 pre-2008 entries dropped, Madonna 53). Now "remix" is noise only as a
  release-type descriptor: `remixes`, `remix bundle`, or trailing
  ` - Remix`. Also added `mix` to normTitle's stripped edition tags so
  different mix years of one album merge into a single row. Verified:
  Beatles 39 albums (23 pre-2008, incl. Please Please Me 1963), Madonna
  45 (25 pre-2008), Weeknd unchanged at 21.

## v49 (Aug 22, 2026)
- **Album History rewrite of the album filter** (~line 14673, in the
  `discoverAlbumHistory` onclick). The old keyword blocklist
  (`single|greatest|best of|...|deluxe|...|collection|...|vol.?|volume`)
  dropped REAL albums (After Hours (Deluxe), Donda (Deluxe)) while still
  letting duplicate store editions through. New logic: (1) accept when the
  pinned artist is ANY member of the credited artist list
  (`artistName` split on `, ; & feat. ft. vs. x` — collab albums like
  Watch the Throne / KIDS SEE GHOSTS / VULTURES / Her Loss credit "A & B");
  (2) drop only true noise: karaoke/tribute/bootleg/unreleased,
  `video album`, `remix(es| bundle)`, `focus collection`, trailing
  ` - Single` (multi-track single packages); (3) dedupe by normalized
  title (`normTitle()` strips edition parentheticals + LRM/RLM marks)
  keeping the edition with the MOST tracks (full/deluxe). Verified against
  live iTunes data: The Weeknd 21 (was 39 w/ dupes + missing deluxe),
  Kanye 16 (incl. all 3 collab albums), Drake 21 (incl. Her Loss).
- **Lesson**: test Discover filter changes against REAL iTunes API data
  (`itunes.apple.com/lookup?id=<artistId>&entity=album&limit=200`) in
  Node — the raw payload is full of duplicates, `- Single` packages with
  2–5 tracks, video albums, and smart-quote/whitespace variants that
  hand-written regexes always miss.

## v48.8 (Aug 22, 2026)
- **A parallel Codebuff session reverted the v48.7 nesting fix (remote
  commit 42a7097, "nuclear z-index/!important")** because it worked from a
  pre-fix checkout — always `git fetch` and read the remote head before
  re-applying. The nuclear CSS was also harmful: the bar rendered above
  modals, and `display:flex !important` defeated the legit `display:none`
  when the playing track is deleted. Restored to sane `z-index:20`.
- **Now bar missing on Home/Playlists — ROOT CAUSE was an unclosed `<div>`**, not
  CSS or the SW. The Discover how-to box (~line 1756) lost its closing `</div>`
  during the v48.5 Expand-URL edit, so `#discoverResults`, `#discoverPreviewAudio`,
  and everything after them — including `#nowPlaying` (~line 1811) — parsed as
  children of `#discoverView`. Home/Playlists set `#discoverView{display:none}`,
  which hid the now bar regardless of its own `display:flex`. The v48.6 "fix"
  (CSS default display:flex) couldn't work because the PARENT was display:none.
  **Lesson: when a fixed element renders at 0×0 with correct computed styles,
  check its parent chain first (`el.parentElement` up to body) — browser
  auto-recovery of unclosed divs silently re-nests later top-level elements.**
  Diagnosed with a temporary on-page overlay that dumps getComputedStyle +
  getBoundingClientRect + parent chain (title-based reporting is unreliable in
  the embedded browser; use a fixed overlay div + screenshot).
- **Foldable corner taps**: `#glowTop` band capped at `min(var(--glow-edge-size), 64px)`
  and `.corner-glow` boxes capped 160→120px so the animated glow layers keep a
  safe margin from the top-corner header buttons on foldable WebViews.
- The settings gear (`#themeBtn`) opens `#themeBackdrop` via `openSettingsTo()`.

## Native OTA updates (Sep 6, 2026) — v56.0.11: self-hosted Capgo, no Capgo cloud
- The native app could NEVER be updated by hard refresh: the WebView loads index.html from APK assets
  and SWs are disabled at https://localhost (they hang) — only a new AAB from Play did. Fix:
  `@capgo/capacitor-updater@7.51.15` + `dev/native-updates.js` (manual mode, `autoUpdate: false`,
  `resetWhenUpdate: false`, `autoDeletePrevious: true` in capacitor.config.json `plugins.CapacitorUpdater`).
- **Delivery pipeline (all three pieces required, they were the missing bits)**:
  1. `deploy.yml` now builds `ota/SideCut-web.zip` (index.html, sw.js, manifest.json, icons, dev/native-updates.js
     — native-updates.js MUST be at `dev/` inside the zip, matching the script tag) + `ota/manifest.json`
     (`{version: APP_VERSION, url}`) and ships them with the GitHub Pages deploy.
  2. `android-build.yml` stages `dev/native-updates.js` into `www/dev/` so the FIRST APK that ships the
     updater is itself OTA-capable (that APK or newer is the floor — older APKs stay Play-Store-only).
  3. `index.html` loads `<script src="dev/native-updates.js">` before the main script; it checks
     `https://anekthegreat.github.io/SideCut/ota/manifest.json` at boot+8s, every 30min, on foreground,
     and via the native-only `#otaCheckBtnBig` button; downloads → `next()` (activates on
     background/relaunch, never mid-song) → `notifyAppReady()` after boot is confirmed healthy
     (unconfirmed bundles auto-revert — a broken OTA can't brick the app).
- Version-detection is fail-safe: `window.__SC_VERSION` is set by boot (`$('currentVersionLabel')` line);
  if the version can't be determined, the check SKIPS instead of downloading (old code would have
  re-downloaded on every boot). Bump APP_VERSION as usual and the OTA picks it up — no Capgo dashboard.
- Gotcha: GitHub Pages caching is CDN-level (~10 min max-age); manifest fetch uses `cache: 'no-store'`.
- zip note: `zip -q -r ota/SideCut-web.zip ... dev/native-updates.js` stores it as `dev/native-updates.js`
  inside the zip root — that's why unzip layout matters (plugin serves the zip as the new web root).

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

## v47.7 consolidated (Aug 19, 2026)
All v47.7/v47.8/v47.9 changes rolled into a single v47.7 entry:
- **New Releases dropdown** in Discover auto-refreshes on open, shows
  all releases (no 40-per-artist cap), visible count in header, and
  auto-fetches when opened with empty cache
- **Discover flash fix**: `loadPinnedArtists()` catch block no longer
  wipes `pinnedArtists`/`pinnedReleases` to `[]` on IDB errors
- **Support tab** in Settings (before More): sidecutsupport@gmail.com,
  48-hour response time
- **Lifetime no-refunds**: "No refunds — all sales are final" on plan card
- **Premium transfer**: Manage premium shows Export → Import flow for
  moving to a new device
- **Discover buttons**: Fetch Latest + Songs From Last Year for pinned
  artists
- SW cache: sidecut-shell-v47.7 (unchanged from prior push)

## v48 (Aug 19, 2026)
- **Album History** in Discover: new button that fetches all albums from
  pinned artists released in the last 20 years via iTunes. Collapsible
  drill-down: tap artist → see albums → tap album → see every track with
  duration. Album artwork, year, and track count shown. Tapping a track
  searches for it in Discover. Songs are lazy-loaded on first expand.
- SW cache: sidecut-shell-v48. Date Aug 19 10:30 am EDT.


## SHARE CODES — SPEC, NOT YET SHIPPED (Sep  8,  2026, deferred)
- Request: "generate a link or code of your library or specific playlist, share it to
  other users, they can get that playlist or library on their device as well".
- AGENTS memory: the tool pipeline in this session garbled any JS I authored with
  shift/ampersand/paren-closures (soft hyphens injected into `>>`,`&`,`(r.result` etc.),
  so I reverted the half-built feature instead of shipping broken code. All risky JS lives
  in index.html inline blocks — always parse-check via node --check on extracted blocks after
  any edit, and eyeball cat-verified small files before splicing.
- Deferred implementation plan (write it in a fresh session, ideally via discrete
  minimal edits, or a code-generation script that writes files as data (python ast dump /
  repr round-trip) rather than emitting JS verbatim):
  1. Share UI: Add songs menu buttons 'Share library code' + 'Open a share code' (ids
     shareLibCodeBtn / importShareCodeBtn), plus a 'Share playlist' entry in
     openListMoreMenu (~line 11730). Share code modal #shareCodeModal (out textarea,
     copy code, copy share link = https://anekthegreat.github.io/SideCut/?sc=<code>,
     paste-in textarea + Open).
  2. Code format: JSON payload {v:2, kind:'playlist'|'library', n:name,
     ts:[{t:title,a:artist,al:album}]} → runtime btoa(unescape(encodeURIComponent(json)))
     (no manual base64/deflate needed — keeps the code tiny to author). Library caps at
     2000 newest tracks (else toast 'share a playlist instead'); zip backup stays the full-
     fidelity path. Decompression: atob + decodeURIComponent. Prefix 'SC.' optional.
  3. Import matching: normalize title+artist (album tie-break), match against allTracks,
     add matched ids to playlists[name] (create if missing), renderTabs/renderList, toast the
     count, and list unmatched rows (tap → Discover search for that song). Boot param
     ?sc=<code> auto-opens the import modal (mirror the existing ?transfer=1 handler
     ~17912). Clipboards via navigator.clipboard with execCommand fallback.
 Clear out.dataset
     pending on open/close. SaveMeta persists the new playlist.
- Keep the existing .zip Export/Import as the reliable full-audio transfer meanwhile (it
  already embeds album + premium — v45-era streaming + v56.0.22 chunked writes).
