## 80.7.11 ({{STAMP}}): a shelf that opens, and a save you can watch

- **WHAT THE OWNER SAID.** *"I SHOULD BE ABLE TO CREATE PLAYLISTS AND ALBUMS AND SEARCH THE STREAMING BEFORE I HAVE A SINGLE SONG
  IMPORTED. MAKE THE DOWNLOADING LIKE SPOTISAVER"* - with photographs of the staged panel those sites show: a title, the song, a
  bar, and the steps ticking off as they run.
- **THE SHELF WAS NEVER MISSING, IT WAS COVERED.** `#scStreamBlock` is static markup and `scShelfBoot()` builds it and the rail
  whether or not anything is imported; the rail is built with `data-built` and its three page glyphs plus the source switch are
  unconditional. What sat on top was `#emptyState`, which `navigate()` lays over the library whenever `allTracks.length` is 0.
  So the search box, **New playlist** and **New album** were all behind a screen that says add music first. `scShelfPage()` now
  hides that screen while the shelf is open and restores it on close under the same rule `navigate()` uses
  (`(allTracks.length || !scLibraryReadOk) ? none : flex`), so a failed library read still never shows onboarding.
- **THE PANEL IS THE WORK, NOT A CARTOON.** `scKeepPanelOpen()` builds a card with the song and a bar; `scKeepPanelStep()` adds a
  row and ticks every earlier one, which is also what makes a skipped stage honest (a copy already in memory still shows as
  read); `scKeepPanelDone()` closes it on the answer. The stages come from the code that does the work: `scStreamCropFile()` grew
  an **optional** `on` listener and reports `find` before the resolve, `read` with a real percentage from `scFetchBytes()` (via the
  new `scStreamReadProgress()`, the same six-lane reader the stream uses), `check` after the blob is validated, and `pack` when the
  `File` is built. `scStreamDownload()` moves the panel on those events and finishes it with the destination - All Songs, a
  playlist, an album, or the file to the device - and a failure is a finished panel that names what failed rather than a spinner
  that never stops. The crop sheet calls `scStreamCropFile(t)` with no listener and behaves exactly as before.
- **WHAT WAS RUN.** `dev/patch-80711.py` over the released 80.7.10 page: `--check` **1** before, **6 steps** applied, a second run
  a no-op, `--check` **0**; both channels rebuilt to a true fixed point. `dev/check-80711.cjs` on the shipped bytes, with both
  changes **driven**: `scShelfPage()` is run against a stub document with an empty library and with two songs to prove onboarding
  is hidden while the shelf is open, restored when it closes, and never shown after a failed library read; and
  `scStreamDownload()` is run against stubs recording every panel event, proving a library save shows find -> read 40% -> read 100%
  -> check -> pack -> save -> kept -> done, that a device save exports the file and adds nothing to the library, that a playlist
  save lands after the keep, that a song already on the device is not read twice, and that a failed read finishes the panel as a
  failure with nothing added. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no source in this environment, so nobody here has watched the panel on a real save, and the read
  callback is stubbed in the checks. What is checked is the order of the events the panel reacts to, the empty-library rule, and
  that every inline script still compiles.
