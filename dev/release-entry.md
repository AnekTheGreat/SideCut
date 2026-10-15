## 74.1.8 ({{STAMP}}): Re-encode works again - the slice helper the encoders call lives with them now

- **The report, in the owner's words** (a screenshot of the phone): *"Re-encode failed: scBackSliceMul is not defined"*. Every song, every rate. 74.1.7 shipped a storage
  cleaner whose Re-encode button could not compress anything at all.
- **THE CAUSE, BECAUSE THE CAUSE IS THE RELEASE.** The page is four inline `<script>` blocks and each one is its own program with its own scope. 74.1.7 added
  `scBackSliceMul` - the hidden-slice multiplier that makes a background compress do three slices of work per wake-up - to the **last** block, the Studio module, beside
  the rest of the background job. The two encoders that read the slice budget (`scEncodeMp3Cooperative`'s block loop and `scEncodeWavCooperative`'s sample loop) live in the
  **first**, the app's own 2.5 MB script. A bare identifier is resolved lexically, in the scope of the function that *uses* it, and never in the scope of whichever block
  published a reference to it - so both encoders threw. **It threw on the FIRST block of the loop, not late**, because the slice test is
  `Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()` and `>=` evaluates both of its sides: the multiplier is called whether or not a slice is due. That is
  why every re-encode failed instantly and uniformly, rather than a long one failing after a while. Nothing was damaged - the throw came before a single byte - but the button
  did nothing, on the whole library.
- **WHY THE GATES SAW NOTHING, AND THIS IS THE PART WORTH KEEPING.** 74.1.7's own block `[6f]` drove the job with `win.__scEncodeMp3` **stubbed**, so the real encoder never ran;
  and its question about the multiplier went through `SC70.backSliceMul()` - the *module's* own copy, which was defined, and answered 1 and 3 correctly. **The gate asked the
  module about itself, and the module passed.** The feature every check pointed at was never executed. A stub in the place of the thing under test is not coverage of it.
- **THE FIX IS ONE FUNCTION MOVING HOUSE.** The real `scBackSliceMul` is defined in the app's own block, beside both call sites, and published as `window.__scBackSliceMul`
  the same way `__scEncodeMp3` already was; the Studio's copy becomes a six-line alias that reads the published function **at call time**, so there is one implementation and
  no second copy to drift. Nothing else on the page changed: not the rates, not the sheet, not the job, not the lock, not the record, not the reorder.
- **THE NEW GATE `[6g]` ASKS THE PAGE THREE QUESTIONS, in order of how general they are**, and the first is the one that would have caught this without knowing anything
  about it: **no inline script block may call an `sc`-prefixed helper that only another block defines.** It needs no list of names to keep up to date, and on 74.1.7 it named
  `scBackSliceMul` **and nothing else in the whole 3.2 MB page**. Then it proves the published function is *live* (it overwrites `window.__scBackSliceMul` and requires
  `SC70.backSliceMul()` to go through the overwrite - a copy cannot pass that), and finally it **runs a real re-encode with only `lamejs` stood in for** - the CDN script jsdom
  never loads, which is the same stand-in the app's own engine is - through the app's decoder, its cooperative block loop, its slice boundary, its job record and its file swap.
- **PROVEN BOTH WAYS IN REHEARSAL, like the layout gate 74.1.7 added.** With the 74.1.7 page and only this gate added: **506 passed, 9 FAILED**, and one of the nine is the
  phone's own message reproduced word for word - `a re-encode through the real encoder does not report a failure (Re-encode failed: scBackSliceMul is not defined)`. On the
  prepared tree: **515 passed, 0 failed**, `[6g]`'s fifteen checks included. The gate also had to be made crash-proof to earn this: its first draft called the published
  function directly, and on 74.1.7 that `TypeError` killed the suite and cost the reader the eleven blocks after it - a red must be a report, not an exception.
- **THE RELEASE BATTERY**: 51 suites, every one green except the single red this repository has carried for months - `studio-70-check` **515/0** (fifteen of those checks are `[6g]`),
  `ota-update-check` 52/0, `check-dom` 0 failures, `ota-guard-check` 20/0, `ota-bootapply-check` 24/0 - and the release's own report is committed at `dev/gates-report.txt`.
- **WHAT THIS FIX DOES *NOT* CLAIM.** Nothing here ran on a phone. That the re-encode works is proven in jsdom through the real encoder *and* in the shipped bytes; how it
  feels under a thumb is unconfirmed. The background caveat 74.1.7 recorded still stands untouched: a WebView with no foreground service can be killed outright by Android,
  and a killed run is reported rather than resumed automatically.
- **BOTH CHANNELS SHIP TOGETHER**: `ota/update.zip` and `ota-play/update.zip` are rebuilt from this page to a true fixed point (the zip embeds the root `manifest.json`, which
  records the zip's own size), at {{ROOT}} bytes for the sideload channel and {{PLAY}} for the Play one, and the page inside each carries `APP_VERSION` and, for Play,
  `__PLAY_BUILD__`.
- **ONE RED IS RECORDED AND NOT FIXED**: `dev/media-controls-check.cjs`, "and it no longer fires every half hour", 66 passed / 1 failed - the same single failure a pristine
  clone of main reproduces.
- **Nothing else moved**: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where 74.1.7 left them.
