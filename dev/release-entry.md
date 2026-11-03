## 80.10 ({{STAMP}}): add to an album shows the albums you have

- **WHAT THE OWNER SAID.** *"these albums don't exist it should be from existing albums or create a new album downloaded
  albums btw, also it shouldn't be cut off."* The shelf that plays from the source kept two stores of its own -
  `streamPlaylists` and `streamAlbums` - and the **Add to an album** sheet offered nothing but the second one. On a phone
  whose albums were all made the way this app makes albums (Select songs -> Create album, or a song's Add to albums), that
  sheet answered with one made-up entry or none, while the album the owner actually wanted sat on the Albums page, invisible
  to it. So: the albums it showed were not albums he had.
- **HOW AN ALBUM THAT DOES NOT EXIST GOT MADE.** The row popup's own **Add to an album** did not show a chooser at all - it
  opened a text prompt and filed the song under whatever was typed. A name typed once became a list in a store nothing else
  in the app reads: an album on no Albums page, holding one song, wearing a name only that sheet knew. The same sheet also
  drew a tile for every list in the store, so lists made and never filled - and lists whose songs had gone - were drawn as
  albums with a count of 0: squares that open nothing, on a page whose subject is albums.
- **THE PART THAT WAS CUT OFF.** `scStreamSheet()` anchors its panel to the bottom edge and appends one row per choice, with
  no height limit and no scroller. Past about a dozen rows the panel grew upwards off the top of the screen, so the first
  albums - and the choice that makes a new one, which is always last - could not be reached at all. The downloads picker,
  which lists up to sixty songs, was clipped on every device, every time. The panel is a flex column capped at the height of
  the screen now: the choices live in a scrolling body, the title and Cancel are pinned, and nothing can be pushed off the
  glass.
- **THE ALBUMS THAT EXIST.** `scStreamPickList()` lists your albums first - `visibleAlbumNames()`, in the order the Album
  cards are in, each with how many songs it holds (`Road Trip · 12 on device`) - then the lists from the source that actually
  hold something, then a new album as the last choice. A name that exists in both stores is offered once. A device album
  with no songs is not offered, and neither is a list with none. And a song filed under a name that is already an album on
  the Albums page goes into this shelf's list of that same name: one name stays one album instead of a second being invented
  beside it.
- **THE ROW POPUP ASKS THE CHOOSER NOW.** `scStreamMenu()`'s **Add to an album** opens `scStreamPickList('al', id)` - the
  same sheet the shelf's plus opens - so a typed name is reachable only from the deliberate **New album** choice, which is
  where it belongs.
- **A TILE NAME WRAPS.** `scShelfGrid()` drew every album name on one nowrap line with an ellipsis, so a long album was a
  cut-off word. It wraps to two lines now.
- **TWO STORES STAY TWO STORES.** An album on the device is a set of file ids (`userAlbums`); a list here carries entries
  that can be a song from the source or a file. This release makes the chooser speak both. It does not merge them, and it
  does not move a song out of either one.
- **WHAT WAS RUN.** `dev/patch-8010.py` over the released 80.9 page: `--check` **1** before, **9 steps** applied, a second
  run a no-op, `--check` **0**; both channels rebuilt to a true fixed point (pass 3). `dev/check-8010.cjs` **69 passed,
  0 failed** against the shipped bytes, and the new behaviour is **driven**, not grepped. The chooser is run against a
  device store and a source store: an empty list is not offered, a device album with no songs is not offered, a name that
  exists in both is offered exactly once, the labels count what they say, a new album is always the last choice and it is
  the only one that asks for a name, and choosing `Road Trip` files the song under `Road Trip` and says so. The sheet is
  built against a fake DOM: capped at the screen, every choice inside the scroller, Cancel its own child of the panel, and
  nothing else in it. The grid is run with an empty list and a full one: one tile, `2 songs`, the empty album not drawn, and
  a page of nothing but empties saying there are no albums. All seven inline scripts compile. Full channel
  **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no browser here, so no sheet was dragged with a thumb and no album was tapped on a screen.
  What is proven is which choices the sheet produces from which stores, where those choices are appended, how tall the panel
  is allowed to be, and that the page is the one in both zips.
