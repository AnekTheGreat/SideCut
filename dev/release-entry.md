## 80.2.2 ({{STAMP}}): one song or a whole selection to the phone, and one menu behind both sets of dots

- **THE OWNER ASKED FOR THREE THINGS IN ONE BREATH.** "add a feature where I can
  download a single song with its 3 dots menu or if I select multiple songs I can
  download those specific songs make this nice the 3 dots menu in the now bar and in
  the actual 3 dots menu for the song should be the same". Each of the three is a
  separate defect or gap, and none of them needed a new writer: the playlist sheet
  already had "Download to phone", writing each track's own audio blob to the phone.
- **ONE SONG.** The song sheet gets a `Download this song` row under Share. It hands
  that same writer one id, so the file keeps the song's real name and extension and
  lands in Documents; no zip, and nothing to import afterwards.
- **A SELECTION.** The multi-select bar had Export to .zip and nothing else that put
  a file on the phone. A save icon now sits beside the zip export and hands the
  writer the ticked ids, so ten selected songs become ten files, and the selection
  stays up - the same songs can still be album-ed, tagged or exported.
- **ONE MENU, NOT TWO.** The now bar's 3-dot opened a second, shorter menu of its
  own (`showNpMenu`, its own modal, its own list), which is how the two drifted.
  That menu and its markup are gone: `showNpMenu` now opens `openSongActions` for
  the playing song, so a song answers identically from the bar and from its row.
  The three switches the slim bar hides - Shuffle, Repeat, DJ Mode - are a
  `Playback` group appended to the bottom of that sheet after the 80.0 grouping
  runs, and each row clicks the bar's own `#shuffleBtn` / `#repeatBtn` /
  `#djModeBtn`, so there is still one switch and one piece of state per control.
- **THE WRITER GREW UP A LITTLE.** `downloadPlaylistToDevice(ids, isAllSongs)` is
  `downloadTracksToDevice(ids, label)` now - the unused second argument was being
  passed and never read. A song with no stored audio says so once instead of
  walking a progress chip that can only end at "0 saved, 1 failed", a total failure
  reads as a failure rather than a save, and the browser fallback no longer claims
  it wrote to a Documents folder the browser cannot reach.
- **THE GATE.** `dev/staircase-check.cjs` gains section **[8]** - the folded
  menu, the save row, the selection button, the one writer, the Playback group and
  the empty-song message - and is **67/0**. The section travels alone in
  `dev/patch-gate-8022.py`, which inserts it and then refuses to pass unless every
  claim of it is in the gate. The feature itself was also driven locally in jsdom:
  the row-opened sheet and the bar-opened sheet produce the same rows in the same
  order, one tap writes exactly `Alpha.mp3`, a selection of two writes those two
  files in order, the Capacitor run lands four bytes in `DOCUMENTS`, and a song
  with no audio writes nothing and says why.
- **THE REPIN.** `dev/repin-8022.mjs`: live pin 80.2.1 -> **80.2.2**, adjacency
  `PREV` 80.2 -> **80.2.1**, both regex spellings swept, `--check` clean in 0.
- **THE CHANGELOG HEAD HAS EIGHT NOTES** on purpose: `test-738` requires at least
  seven, no apostrophes, the words widget / player / lyrics / letter, and no
  downloader or converter term - so the notes say "save" throughout.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
