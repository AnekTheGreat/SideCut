## 80.6.28 ({{STAMP}}): the pages follow the source

- **WHAT THE OWNER SAID.** *"The playlists and Albums should be in here in streaming, THE BUTTONS SHOULD DO
  WHAT THEY SHOULD IF IM IN STREAMING IT DOES STREAMING ALL, STREAMING PLAYLISTS AND ALBUMS, IF IM IN
  DOWNLOADS, REGULAR ALBUMS AND REGULAR PLAYLISTS SHOULD SHOW"*. Two things: the streaming lists need a
  place of their own, and the buttons have to belong to the source that is on.
- **WHY THE BUTTONS DID NOT.** The side rail had two page glyphs (Library, Albums) and one source switch.
  The streaming **playlists** had no page at all - they were a row of chips under the shelf - so on the
  source there was no button that showed every one of them. Worse, the **Library pill**'s two halves
  (`#playlistsHalf`, `#albumsHalf`) called `navigate('playlists')` / `navigate('albums')`, which set the
  *downloaded* half and rendered the downloaded list - behind a shelf that stays on top of it. On the
  source those two halves therefore changed nothing you could see.
- **WHAT CHANGED.** (1) **The rail is three pages**: Songs, Playlists, Albums, each with its own glyph
  (`plist` is a new path - ruled lines with a mark, so a playlist is not the library glyph again), and the
  source switch still sits under a hairline where it was. (2) **All three stay in the source**:
  `scShelfOpenTab()` maps the third tab and never writes `scShelf.src`; the switch is still the only thing
  that flips it. (3) **A streaming playlists page** in `scStreamRender()`, drawn with `scShelfGrid('pl',
  ...)` the way the albums page is drawn with `'al'` - a cover, a name, a count per tile, a **New
  playlist** button, the *From the source* pill, and the line that says a hold deletes a playlist. The
  tiles were already wired for open and for the two-second hold, so the page inherits both. (4) **The pill
  follows the source**: on the source its halves open the source's Songs and Albums pages; on the device
  they do what they always did. In single-button mode the one pill flips the source's pages instead of the
  half underneath the shelf. (5) **The device's three pages are the library's three**: Songs lands on All
  Songs (it used to land on whatever playlist was last used, which is not what the word says), Playlists
  on the playlist strip, Albums on the albums.
- **WHAT WAS DELIBERATELY NOT DONE.** The switch still does not move a page; a page glyph still never
  changes the source. Nothing was removed from the shelf: the chips and the *Streaming albums* row are
  still on the songs page, so the way that exists keeps working. No downloaded list, album, playlist or
  setting is written by any of this; the only state touched is `scShelf.page` and, on the device side,
  which list the library shows.
- **WHAT WAS RUN.** `dev/patch-80628.py` over the released 80.6.27 page: `--check` **1** before, 10 steps
  applied, a second run a no-op, `--check` **0**. `dev/check-80628.cjs` passes **39 checks**, and the ones
  that matter are run, not read: `scShelfOpenTab` in four states (Playlists on the source keeps
  `src = 's'` and paints once; the page already up only marks; Albums on the device stays on the device;
  Songs on the source stays on the source), and `scShelfGrid('pl', ...)` against fake lists (one tile per
  playlist, name and count on it, "1 song" not "1 songs", no album tile on the playlists page, and an
  empty page that says so). It also proves the songs/albums halves of the pill are decided *before* the
  downloaded `navigate()` on the source, that the playlists page is decided before any single list page is
  drawn, and that every inline script still compiles. OTA rebuilt to a true fixed point - root + `ota/`
  **{{ROOT}}** bytes at v80.6.28, the `ota-play/` channel (**{{PLAY}}** bytes) untouched.
- **NOT CLAIMED.** There is no phone and no browser here. Nobody has tapped the new third glyph, swiped
  the rail with three glyphs on it, or watched the pill switch pages on a real screen. The logic, the
  mapping and the drawn markup are proven; the look of a three-glyph rail is not.
