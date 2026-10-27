## 80.3.3 ({{STAMP}}): an album converts in minutes, the run keeps going in the background, and a failed song says why

- **THE OWNER'S ASK, VERBATIM.** *"do the loudness thing with the downloaders a they should run
  completely in the background, b they should be much faster, a 32 song album shouldn't take an
  hour to download it should be 5 minutes"*. The opening phrase was read as *the thing you asked
  for last time, applied here*: nothing about loudness in the saved files changed, the 80.3.2
  volume boost is untouched, and this release answers (a) and (b).
- **MEASURED FIRST, BECAUSE "SLOW" IS NOT A DIAGNOSIS.** `sc-8033-measure.cjs` (the session's
  scratch driver, kept out of the repo with 80.3.2's) runs the page's OWN encoders over 3.5 minutes of stereo 44.1 kHz: **FLAC 7-17 s, MP3 at 192k 12-60 s**
  of solid CPU on the build machine (the spread is machine load, not noise in the measurement).
  A 32-song album is about two hours of audio, so it was **minutes to tens of minutes of
  encoding on the app's own thread** - the thread every tap has to get through - before any
  network is counted. On top of that, every stream is fetched as bounded 1 MiB ranges
  (googlevideo refuses anything wider), 4-7 of them for a 3.5-minute track at 128-256 kbps, paid
  **one after another**; and every song waited for the one before it to be finished entirely.
  All three of those are the hour.
- **THE RANGES GO OUT TOGETHER.** `scFetchBytes` plans the stream from the first range's
  `content-range` and pulls the rest through `scDlLanes()` lanes (4), stitching the bytes back in
  range order - the file is byte-for-byte what the sequential reader produced. Proven against
  the reader that shipped: `git show origin/main:index.html`'s own `scFetchBytes` is run beside
  the new one over **eight scenarios** (plain 3.5 MiB, exactly four ranges, under one range, a
  player that reported no length, a length under the truth, a server that ignores Range and
  answers 200, a 403 half way, a 403 past the last range) and every byte is compared. Two real
  bugs in the first cut of this were caught that way and fixed: the lanes started at range 0 and
  fetched the first range twice, and a 200 (the whole file) used to be appended to the first
  range as a corrupt file - it is now taken as the stream itself.
- **SEVERAL SONGS IN FLIGHT, AND THE LANE COUNT IS A MEMORY NUMBER.** `scRunPool` + the two batch
  runners: every row goes up front, `scDownloadLanes()` songs convert at once, each song still
  lands in the library exactly as it did, Cancel still stops the run at the next song boundary
  and what finished stays. The default is **2 lanes under 3 GB of device memory, 3 normally, 4
  at 6 GB+** (`navigator.deviceMemory`), because a lane holds one song's decoded audio and a
  3.5-minute stereo track is ~74 MB of Float32 - memory is what a phone runs out of first.
  `window.__scDlTracks` overrides it for a test.
- **THE ENCODERS GET THREADS OF THEIR OWN.** `scEncoderSource()` builds a worker from the PAGE'S
  OWN ENCODER SOURCE (`Function.prototype.toString`) - `scId3v23Bytes`, `scJoinTaggedChunks`,
  `scEncodeMp3Cooperative`, `scEncodeWavCooperative`, `scEncodeAiffCooperative`,
  `encodeAudioBufferToFlac` - so there is still exactly ONE implementation of every format in
  this repository, and the worker is a place to run it rather than a second copy to keep in step.
  A worker is a thread the platform schedules on its own cores and does not throttle with the
  page's timers, which is also what keeps the encoding fast while the app is behind something
  else. The worker shims only what a worker lacks (`document`, the slice budget, a yield to a UI
  it does not have). FLAC/WAV/AIFF hand their samples over (transferred, so the page's copy is
  freed); **MP3 keeps them**, because lamejs is the one encoder that arrives from a CDN and could
  be out of reach inside a worker - so an mp3 that fails there still encodes on the page, and a
  format whose samples were handed over reports a failed song instead of writing silence. The
  crop preview, the crop save and the two Spotify single saves pass `keepSamples` because they
  re-encode the same buffer from their format menu.
- **A RUN IS NOT A WINDOW.** `scRunJobStart/Note/End` wraps each batch: a **Web Lock**
  (`sidecut-download`, shared, held until the run ends - the same mechanism the re-encode job has
  held since 74.1.7) for the whole run, the progress mirrored into the system notification, and
  the native hold below on Android. Nested runs (the retry button re-enters the runner) count
  depth, so an inner run ending never lets go of the outer one.
- **THE ANDROID HALF: `patch-joblock.py`, A NEW BUILD-TIME PATCH.** With the screen off Android
  suspends the app and a suspended app does not download; a cached process is also frozen and may
  be killed. The plugin answers `hold()` with a `PARTIAL_WAKE_LOCK` plus a **dataSync foreground
  service** carrying the run's own progress (`update()`), and `release()` gives both back.
  `patch-joblock.py` writes `SideCutJobPlugin.java` + `SideCutJobService.java`, registers the
  plugin in MainActivity beside the widget and audio-focus plugins, and adds the three exact
  permissions plus the `<service ... foregroundServiceType="dataSync">` declaration to the
  manifest. Every call on the web side is a no-op when the plugin is absent (a browser, or an APK
  older than this release) and every native call is wrapped so a device that refuses the service
  still gets the wake lock. It runs after `patch-widget.py` and is idempotent; `android-build.yml`
  gained the step. **This part needs a new app build** - the release itself reaches every install
  through the OTA page, which uses the Web Lock the browser honours.
- **ONE SOURCE, ONE SONG, STILL - AND NOW WITH SEVERAL SONGS IN FLIGHT.** The claim on an upload
  moved to BEFORE the download (`scSourceClaim`): with siblings converting at once, writing the
  ledger after the decode let two tracks pick the same upload while neither had recorded it yet,
  which is exactly the failure that writes one song's audio under another's title. Per-song
  failures moved to a per-song sink (`scFail` + the run's `ctx.reason`) for the same reason -
  `window.__scSourceFail` is one slot and several songs were overwriting each other's reason.
- **THE PAYLOAD IS A DRIVER PLUS SIX MODULES BESIDE IT**, as 80.3.2's was (the edits are
  1-14 KB each instead of one 58 KB file, and a reader can find the part they want):
  `patch_8033_ranges.py`, `patch_8033_workers.py`, `patch_8033_claims.py`,
  `patch_8033_hold.py`, `patch_8033_runners.py`, `patch_8033_copy.py`. Splitting it was
  proven not to change what ships: the page and `sw.js` the modules produce are
  **byte-identical** to the ones the single-file patch produced (only the changelog's own
  clock line, which is computed at run time, was normalised out of the comparison).
- **VERIFIED ON THE PAGE THAT SHIPS.** The payload was applied to a scratch tree taken from
  `origin/main` itself (`git archive origin/main`), so the thing measured is the page this
  release replaces plus this patch and nothing else: `python3 dev/patch-8033.py` (1 step) then
  `--check` (0 steps); every inline script block parses (acorn); and **`sc-8033-check.cjs`
  passes 53/53, exit 0** - against `origin/main`'s OWN `scFetchBytes`, sliced out of
  `git show origin/main:index.html`, which is the only way "the same file" means anything. The
  driver runs the page's own bytes (its functions are sliced out of index.html by parsing it),
  so it cannot pass against a page that does not carry them. It proves: the eight byte-equality
  scenarios above; real overlap (4 ranges in flight, ~20 ms against ~31 ms sequential for six
  ranges, 18 ms against ~54 ms for nine songs at three lanes); cancellation stops dispatch;
  the claim rules (first wins, sibling refused, own re-take allowed, no ledger = no refusals);
  **a FLAC and an MP3 encoded in a worker are byte-identical to the same file encoded on the
  page**; FLAC transfers its samples and MP3 keeps them; the run holds one lock, releases once,
  survives an inner run ending, throttles its progress notes and is a no-op without the plugin;
  and both runners driven end to end in jsdom - six songs, three at a time, every row reading
  `✅ added`, and a cancelled run keeping what finished (2 of 6) with the rest reading
  `— cancelled` and the pill saying so. `APP_VERSION 80.3.2 -> 80.3.3`, the head entry above,
  `sw.js` cache `sidecut-shell-v80.3.3`, and the OTA bundles are rebuilt to a fixed point by
  `release.yml` in the same commit - root + `ota/` **{{ROOT}}** bytes, `ota-play/` **{{PLAY}}**
  bytes, both `--check`s OK.
- **WHAT IS NOT CLAIMED.** The Java has not been compiled here - there is no Android SDK in the
  session; it is syntax-checked (java-parser) and rehearsed against a real `npx cap add android`
  project (registration, manifest, idempotency), and the **Android build workflow is the compile
  proof**. And no wall clock on a phone is quoted: the speed work was measured in parts (encoder
  cost, range overlap, lane overlap), not as an end-to-end device number. Nothing else moved -
  the player, the library, the albums, the lyrics, the boost, the tabs, the widget and the
  assistant are where 80.3.2 left them.
