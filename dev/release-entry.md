## 80.6.23 ({{STAMP}}): streaming moves into the library and the albums

- **WHAT THE OWNER SAID.** *"the buttons shouldn't glitch when you through the selections, there should
  be add to a playlist and add to album option in streaming or wait we can merge the streaming into the
  actual albums and library, with another side button icon that has streaming albums streaming playlists
  so you can switch between them, this would replace the side buttons there rn"*. Three asks: the rail
  stops glitching, the streaming page offers both kinds of list, and streaming stops being a place of its
  own.
- **THE FLICKER WAS TWO BUGS.** `scShelfRender()` reassigned `rail.innerHTML` on every render, which
  throws away the element that was just tapped: its press animation never ran, and a `position:fixed` rail
  with a backdrop blur settled visibly each time a glyph was chosen. And `scShelfOpenTab()` called
  `navigate('library')` and then `renderTabs()` and `renderList()` itself - while `navigate()` already
  paints both (`if(isLibrary){ renderTabs(); renderList(); }`) - so every tab tap drew its page twice in
  one frame: the strip scrolled, jumped back and scrolled again. The rail is now built once
  (`data-built`) and `scShelfMark()` only moves the `.on` class and the source glyph; `scShelfApply()` is
  the single painter, and the hand paint is a fallback for a page with no `navigate()` to ask. Tapping the
  page that is already up repaints nothing.
- **STREAMING IS A SOURCE, NOT A PAGE.** The rail's three glyphs (streaming / library / albums) are two
  pages and a switch: `library`, `albums`, a hairline, then a glyph that flips `scShelf.src` between `'d'`
  (what is on this device) and `'s'` (what plays from the source). With the switch on streaming, the
  Albums page draws the streaming albums and the Library page draws the shelf - the search box, the
  results, the mini player and the streamed songs. The coral dot on the switch is the only thing that
  changes colour. This replaces the third tab: nothing streaming has a page of its own any more.
- **A STREAMING ALBUM LOOKS LIKE AN ALBUM.** `scShelfGrid()` draws a two-column grid of square covers -
  the cover of the list's first song, or the album glyph when there is none - with the name and a song
  count, and a tile carries `data-name` into the same `scShelfOpenList()` page a downloaded album opens.
  The Albums page in streaming mode has **New album** in its own header; the shelf no longer repeats the
  albums as a row of chips, it has one **Streaming albums** row that switches to that page.
- **THE PLUS ASKS BOTH QUESTIONS.** A row's plus was one action - a playlist, named in a prompt - so no
  album could be started from the shelf. `scStreamAddTo()` opens the existing sheet with *Add to a
  playlist…* and *Add to an album…*; each of those opens `scStreamPickList()`, which offers the lists that
  exist (by name, with how many songs each holds) and, last, a new one that falls through to the same
  prompting maker as before.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.22 in one payload, `dev/patch-80623.py` (15 steps; a
  second run is a no-op, `--check` is 1 before and 0 after), and all seven inline scripts still compile.
  `dev/check-80623.cjs` passes **59 checks**: statically (the one rail that is built once and marked
  after, two pages and no streaming page, the switch with its two sources and one painter, no second
  `renderTabs()`/`renderList()` in the tab path, the albums-page branch gated on source *and* page, the
  tile grid, New album on that page, the shelf's way across to it, the plus opening two questions and the
  lists that exist, and the row title saying both) and **driven** in a `vm`: the grid draws one tile per
  album with the first song's cover, counts "2 songs" and "1 song", keeps the name, falls back to the
  glyph with no art, and says so when a kind is empty; the plus opens one sheet with a playlist and an
  album, the album question lists the albums that exist (`Road · 0 songs`), choosing one files the song in
  it marked `kind: 's'` and says where it went, the last choice makes a new one, the playlist question
  does the same for playlists, and a song that has left the shelf is refused. OTA rebuilt to a true fixed
  point - root + `ota/` **{{ROOT}}** bytes at v80.6.23, `ota-play/` still HELD (**{{PLAY}}** bytes).
  **Not claimed:** there is no phone and no browser here, so the rail was not tapped, the switch was never
  flipped with a thumb, and no grid was seen on a screen. What is verified is that the rail is one DOM
  tree that only changes class, that a page is painted once per tap, that the streaming set is chosen by
  source and page rather than by a page of its own, and that both kinds of list can be reached from a
  row's plus.
