## 80.6.26 ({{STAMP}}): the streaming albums are a page, and a list is held to delete

- **WHAT THE OWNER SAID.** *"no the streaming albums should be easy to see and it shouldn't go to
  regular downloaded albums, fix that and make it possible to delete a streaming album or playlist by
  holding on it for 2 seconds"*. Two requests, and the first is a correction of the last release.
- **WHY ALBUMS COULD NOT BE SEEN.** 80.6.26's predecessor made both page glyphs leave the source
  (`scShelf.src = 'd'`) so the downloaded songs were reachable from them. The cost was the other half of
  the same switch: while the source was on, the **Albums** glyph opened the downloaded albums, and the
  streaming albums existed only as one row (`#scStreamAlLink`) inside the streaming library. The page
  named after albums could not open it.
- **WHY A LIST COULD NOT BE DELETED.** `scStreamHold()` - the two-second hold that opens a row's popup -
  was wired to song rows only (`.scs-row`, `.scsp-row`). Album tiles and playlist chips got a click and
  nothing else, so a list made by mistake was permanent: no sheet, no delete, no way back.
- **WHAT CHANGED.** (1) **The glyph keeps the source.** `scShelfOpenTab()` no longer writes `src`; the
  switch is the source and Library/Albums are its two pages, so on the source, Albums *is* the streaming
  albums page. Re-tapping the page already up still only moves the mark. (2) **The page says what it is**:
  a coral *From the source* pill beside the title, and the line under it now says holding an album for two
  seconds deletes it. (3) **`scStreamHoldList()`** arms the same two-second timer on the album tiles and
  the playlist chips, cancels on `pointerup`/`pointercancel`/`pointerleave`, blocks the context menu and
  swallows the click that follows a hold in the capture phase - so a hold never also opens. (4)
  **`scStreamLibMenu()`** opens the app's own `scStreamSheet()` with *Open* and a danger row named for what
  it deletes. (5) **`scStreamLibDelete()`** is the one delete path: it removes the named list, closes the
  page if that list was the one on screen, saves and repaints, and offers the app's `toastWithUndo()` -
  which puts the list back **in the place it was**, not at the end of the row.
- **WHAT WAS RUN.** `dev/patch-80626.py` over the released 80.6.25 page: `--check` **1** before, 7 steps
  applied, a second run a no-op, `--check` **0**. `dev/check-80626.cjs` passes **46 checks**, and it does
  not only read text - it runs the handlers: the glyph truth table (source + Albums keeps `src = 's'`;
  the page already up only marks; a list on that page yields; the device side stays on the device), and
  the delete against a fake shelf (the named album goes and the playlists do not, the open page closes,
  one save and one paint, undo restores it at index 0, a missing name deletes nothing, and the same path
  deletes a playlist). The release is on the page with its computed Eastern stamp, and all seven inline
  scripts compile. OTA rebuilt to a true fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.26, the
  `ota-play/` channel (**{{PLAY}}** bytes) untouched, as it has been since it was held.
- **NOT CLAIMED.** There is no phone and no browser here: no album tile was held for two real seconds, no
  sheet was tapped, no undo was pressed on a device. What is proven is the wiring and the logic, not the
  feel of the hold under a thumb.
