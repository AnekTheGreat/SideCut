## 80.2.4 ({{STAMP}}): an album card gets its own three dots, and an album sorts into the order it really plays

- **THE OWNER ASKED FOR ONE THING, IN TWO PLACES.** "add a way in albums and 3
  dots to sort an album by if it's an actual album then in that actual order get
  this from album history". An album's songs have only ever been in the order they
  were imported, which is almost never the order the record plays in, and Album
  History already knew the order. This release connects the two.
- **THE CARD.** Every album card in Albums now carries the same three dots a song
  row carries. A tap opens an album menu: `Sort into the album's real order` and
  `Reorder songs by hand` - the sheet a long press already opened, so the menu is
  not a one-button dead end. The tap stops at the button; the header's own tap
  folds the card and must not fold it on the way in.
- **THE SONG.** The same sort is a row in the song's three-dot sheet - `Sort album
  "<name>" into its real order` - and it is outside the Albums-only block the hand
  reorder sits in, because a song knows its album in every view. It lands in the
  sheet's Organize group, not a group of its own.
- **THE READ.** `scRealFetch` is the pair Album History makes: the iTunes album
  search, then the collection lookup by id in the storefronts the app already
  walks (default, US, IN, GB), then Deezer's album search and its own track
  endpoint. A collection only counts when its NAME agrees with the album, so a
  similar record is never filed in, and the tracks are sorted by disc then track
  number rather than trusting the reply's order.
- **THE FILING.** `scRealApplyOrder` rewrites the album's own `trackIds` - the one
  store the cards, playback and the queue all read - so nothing else needs to
  change. Each real track claims one song, in the record's order; a song the
  album does not name keeps its place at the END, in the order it already had, so
  a sort never drops a song. A list that names none of the album's songs leaves
  the album exactly as it was and says so.
- **THE MATCH.** Titles are compared after the decoration only a file carries is
  folded away - a remaster year, a deluxe tag, a featuring credit, a trailing
  live note - and every loose match sits on a word edge, so a one-word title never
  claims a different song.
- **THE CACHE.** The list is kept per album in `sidecut_albumRealOrder`, with the
  artist it was read for, so a different record with the same name is never
  reused; forty albums deep, oldest out first. A cached list is used before the
  network is asked, so the second sort is instant and works in flight mode, and it
  is thrown away only when it names none of the album's songs.
- **UNDO, AND NO LIES.** Every sort carries Undo, which puts the old order back;
  an album of one song says there is no order to sort, an album Album History has
  nothing for says that and moves nothing, and a sort that fails says so rather
  than reporting a change it did not make.
- **THE GATES.** `dev/album-real-order-check.cjs` is a boot of the patched page -
  **35/0**: the card's dots open the menu without folding the card, the menu's
  first row files the album into the store's order with the unnamed song kept at
  the end, the cache is written with its artist and source, Undo restores, a
  second sort reads no network at all, the song sheet carries the row in a
  non-Albums view and in the Organize group, an album the store knows nothing
  about is untouched, and a one-song album refuses. `dev/staircase-check.cjs`
  gains section **[10]** (**108/0** overall).
- **THE REPIN.** `dev/repin-8024.mjs`: live pin 80.2.3 -> **80.2.4**, adjacency
  `PREV` 80.2.2 -> **80.2.3**, both regex spellings swept, `--check` clean.
- **THE CHANGELOG HEAD HAS EIGHT NOTES** on purpose: `test-738` requires at least
  seven, no apostrophes, the words widget / player / lyrics / letter, and no
  downloader or converter term.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
