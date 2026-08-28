# SideCut — repository memory

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
