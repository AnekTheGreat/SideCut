## 74.1.7 ({{STAMP}}): a compress that carries on, a Re-encode button that asks the rate, and playlists you can reorder

- **The asks, in the owner's words** (from a screenshot of Studio on the phone, then two more messages): *"it should be able to re encode in the background and it looks really weird fix it why are their
  protruding lines"*, *"have an option to re encode to a higher quality various options should appear"*, *"you should be able to reorder playlists in manage playlists"*. Four things, one release.
- **THE PROTRUDING LINES WERE THIS REPOSITORY'S OWN REGRESSION, AND IT IS WORTH RECORDING WHY.** 74.1.6 turned the left of a cleaner row into a `<button>` so the tap that aims at a song name lands on
  the song - and a button may only hold phrasing content, so the name and the artist became `<span>`s. A span lays out **inline**, and an inline box ignores `overflow: hidden` and
  `text-overflow: ellipsis` *completely*: the nowrap text painted straight across the Re-encode button and off the right of the screen, which is exactly what the screenshot shows. The two lines are
  `display: block` again, the text column clips, and the row itself clips as a last resort, so nothing a song is called can leave the row.
- **THE GATE THAT CATCHES IT READS COMPUTED DISPLAY, NOT TEXT.** jsdom has no layout engine, so a screenshot cannot be taken in it - but `getComputedStyle` does resolve the page's own stylesheet, and
  "this line is an inline box" is the fault itself. Block [6c] of `dev/studio-70-check.cjs` walks every row's three text boxes and fails if any of them is inline. **Proven both ways in rehearsal**:
  500/0 on the prepared tree, and 497/3 with only those two `display: block` declarations removed - and the three that go red are precisely the three that name the fault
  (`.sc-store-name:inline, .sc-store-sub:inline`).
- **THE RE-ENCODE BUTTON ASKS WHICH RATE NOW, 96 TO 320 KBPS.** `REENCODE_RATES` is `[96, 128, 160, 192, 256, 320]`, and the button opens a sheet under its own row: each rate says what it would do to
  **that** song in MB, worked out from its own length (`scEstDelta`), with the rate set at the bottom of the cleaner marked as such. A rate **above** what the file already reads is offered and named for
  what it is - `grows the file by 2.0 MB`, in coral, with the reason on the row - because re-encoding a 128 kbps file at 320 cannot put back detail the first encode threw away. The sheet says that once,
  plainly, rather than dressing it up as an upgrade.
- **A COMPRESS CARRIES ON WHEN YOU LEAVE THE APP.** The job holds a **Web Lock** (`sidecut-reencode`, exclusive) for its whole life - a page holding a lock is exempt from the browser's background
  freeze and intensive timer throttling, which is the difference between a compress that finishes in your pocket and one that stalls when the screen goes off - and the **slice budget triples while the
  page is hidden** (`scBackSliceMul`: a hidden page is woken less often, so each wake-up does three slices of work for the same wall clock).
- **IT SAYS WHERE IT IS, AND IT NEVER HALF-WRITES A SONG.** The cleaner carries a strip with the song, the rate and the percentage the encoder reported, and the row's own button reads `Encoding…` until it
  is done. The run is written to `sidecut_encodeJob` **before its first byte** and cleared when it ends; if the phone kills the app outright, the next render of the cleaner says so, names the song, says the
  song itself was never touched (the stored file is only replaced after the encoder has produced its bytes) and offers the same rate again - said once, not as a banner.
- **WHAT THE BACKGROUND FIX DOES *NOT* CLAIM.** The Web Lock is what the platform honours; an Android WebView with no foreground service can still be killed outright by the OS, and a killed run is not
  restarted automatically (it is reported, with the file untouched). Nothing here was tested on a device - the job, its lock and its record are driven in jsdom, and the shipped bytes are proven by the
  bundle; how it feels under a thumb on the phone is unconfirmed.
- **PLAYLISTS CAN BE REORDERED FROM MANAGE PLAYLISTS.** A `Reorder` control turns the panel into a list of names with `▲`/`▼` arrows - the panel's rows already carry up to five buttons, and a sixth and
  seventh would leave no room for the name. The move writes the **same order the tab strip's own drag writes** (`playlists` + the `meta` row), the Library tabs follow it, and Library and Favorites stay
  first: they are pinned by every path in the app, so their arrows are honestly disabled (`always first`) rather than silently doing nothing.
- **REGRESSION COVERAGE**: the release's own blocks `[6c]`–`[6f]` in `dev/studio-70-check.cjs`, 75 new checks, **500/0** for the file. `[6f]` stubs `navigator.locks` and proves the lock is taken *before*
  the encode and **held while it runs**, that the run is written down, that a killed run is reported once - the parts a machine without a phone can hold the app to.
- **ONE BEHAVIOUR PIN MOVED, AND IT IS RECORDED**: 74.1.6's block [6b] tapped the Re-encode button and expected an encode at once. That door is one tap longer now (the sheet opens, the sheet's rate runs),
  so `dev/repin-7417.mjs` walks it through - what that block exists to prove, that the tap which opens the bubble never swallows the button beside it, is unchanged.
- **THE RELEASE ORDER BUG THAT COST 74.1.5 SEVERAL RUNS IS FIXED AND RECORDED.** `dev/ota-update-check.cjs` asserts the tree's OWN bundle is already on `index.html`'s `APP_VERSION`, and the release
  rebuilt the bundles AFTER the battery - so every run died on that one suite ("manifest v74.1 vs APP_VERSION v74.1.5") and passed 52/0 re-run alone, because that suite regenerates the bundle itself and
  leaves the tree fixed for the next reader. The rebuild now runs BEFORE the battery, because the battery has to measure the tree that gets committed. It was never a flake.
- **THE RELEASE MACHINERY IS GENERIC NOW.** `dev/release-gates.sh` (the battery and its report), `dev/release-record.py` (the AGENTS.md insert, idempotent, version read from the page) and
  `.github/workflows/release.yml` are shared by every release; a release supplies its own `dev/patch-<ver>.py`, `dev/repin-<ver>.mjs`, `dev/release-<ver>.proof` (the proof of the prepared tree, byte for
  byte) and this entry.
- **BOTH CHANNELS SHIP TOGETHER**: `ota/update.zip` and `ota-play/update.zip` are rebuilt from this page to a true fixed point (the zip embeds the root `manifest.json`, which records the zip's own size), at
  {{ROOT}} bytes for the sideload channel and {{PLAY}} for the Play one, and the page inside each carries `APP_VERSION` and, for Play, `__PLAY_BUILD__`.
- **ONE RED IS RECORDED AND NOT FIXED**: `dev/media-controls-check.cjs`, "and it no longer fires every half hour", 66 passed / 1 failed - the same single failure a pristine clone of main reproduces. Every
  other suite is green, and the release's own report is committed at `dev/gates-report.txt`.
- **Nothing else moved**: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where 74.1.6 left them.
