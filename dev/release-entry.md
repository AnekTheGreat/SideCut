## 80.2.5 ({{STAMP}}): albums only come from you now, and an album can be deleted from its own three dots

- **THE OWNER ASKED FOR TWO THINGS.** "sometimes they're making random albums with
  singles and stuff idk why it shouldn't be doing that and in the album 3 dots it
  should have an option to delete the album with confirmation". The albums were
  real and they were the app's doing: two paths made an album without being asked.
  This release stops both, and gives the card's menu the row that removes one.
- **THE LAUNCH.** `scAlbumsRecoverDeleted()` step (3) made an album out of every
  album tag on the files that no entry held and that at least two songs carried -
  and, for a name the archive knew, out of a tag only one song carried. The tags on
  a phone are whatever the files arrived with (a site's idea of the album, the
  song's own name in the album field, one "single" shared by two songs), and the
  entry it wrote was stamped `manual:true` from birth, so it was indistinguishable
  from an album the owner made. That is the whole of the report. The pass now
  restores only what the app itself took: names in `sidecut_albumsArchive`, written
  by the one sweep that ever removed an entry, and each one comes back with the song
  list it had at that moment. Nothing else is invented, and a tombstoned name is
  skipped. Turning tags into albums is still there, where a person asks for it:
  Manage albums -> Rebuild albums from tags.
- **THE RECORD TAP.** `openAlbumForCurrentSong()` (a tap on the mini turntable)
  called `ensureAlbumSaved(tag)` and so made an album out of the playing song's tag
  on the spot - often a one-song album named after the file. It now opens the album
  only when the tag IS an album you have, and falls through to the existing song
  jump when it is not. A jump is a question about the library, not permission to add
  to it.
- **THE DELETE.** The album card's three dots grows a third row, `Delete album`, in
  the danger colour, under the sort and the hand reorder. It opens a confirmation in
  the app's own sheet language - the album named, "Its N songs stay in your library
  - only the album goes, and it will not come back on the next launch", Keep it /
  Delete album. `window.confirm()` is deliberately not used: the Android WebView can
  swallow it and answer false, which is how the panel's Delete button once came to
  look broken.
- **UNDO, AND THE TOMBSTONE.** `deleteUserAlbum(name, opts)` now returns whether it
  deleted, remembers the entry and its place in `albumOrder`, and toasts with Undo:
  Undo puts the entry, its songs and its position back and deletes the tombstone, so
  the album is exactly as it was. It no longer reopens Manage albums unconditionally
  - only when Manage albums is the popup on screen - so deleting from a card cannot
  replace the list the owner is looking at.
- **WHAT DOES NOT MOVE.** The songs, their album tags, every other album, the album
  order, and the whole 80.2.4 sort are untouched. Deleting an album deletes a list,
  never music.
- **THE GATE.** `dev/staircase-check.cjs` gains section **[11]** and is **136/0**,
  and the section travels alone in `dev/patch-gate-8025.py`, which refuses to pass
  unless every claim of it is in the gate. `dev/albums-manual-check.cjs` is
  rewritten where it promised the old rule: it now proves a missing entry is NOT
  invented from its tag, and that an archived album is still put back whole - it is
  **61/0**. `dev/album-isolation-check.cjs` and `dev/albums-menu-isolation-check.cjs`
  are updated the same way (**45/0** and **25/0**), and `dev/album-real-order-check.cjs`
  stops pinning the row count of the menu this release grows (**35/0**).
- **THE NEW SUITE.** `dev/album-auto-delete-check.cjs` drives a real boot of the
  patched page on a library whose files carry tags nobody made albums for:
  **52/0**. No card appears for a shared tag, a song-named tag or a loose tag; the
  archive is the only thing restored; the record tap makes nothing; the card menu's
  third row asks first; Keep it changes nothing; Delete removes, tombstones and
  leaves every song and tag alone; Undo puts it back with its place and clears the
  tombstone.
- **THE REPIN.** `dev/repin-8025.mjs`: live pin 80.2.4 -> **80.2.5**, adjacency
  `PREV` 80.2.3 -> **80.2.4**, both regex spellings swept, `--check` clean in 0.
- **THE CHANGELOG HEAD HAS EIGHT NOTES** on purpose: `test-738` requires at least
  seven, no apostrophes, the words widget / player / lyrics / letter, and no
  downloader or converter term.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
