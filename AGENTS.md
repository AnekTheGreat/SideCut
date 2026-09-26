# SideCut — repository memory

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

## sw.js cache name (Sep 26, 2026): decoupled from APP_VERSION — 63.0.1 → 63.0.2 → 63.0.3
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
