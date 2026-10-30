## 80.6.22 ({{STAMP}}): the bar is the bar, and the lists hold both

- **WHAT THE OWNER SAID.** *"make the streaming now bar match the one thier, remove the x button for it
  and make a 2 second hold to have a popup to delete, make it let you make albums like the actual
  downloaded albums things, and playlists, or in playlists you can have streaming playlists and
  downloaded playlists and same thing for albums"*. Four asks, and the last one is a data model rather
  than a control.
- **THE BAR WAS WEARING A COSTUME.** A streamed song wrote three extra things into the shared player bar:
  a **STREAM** pill before the artist, the length and genre appended to the artist line, and - from
  80.6.17's CSS - a coral top edge and a glowing disc. The deck writes `title` and `artist` and stops, so
  the bar changed shape the moment a song came from the source. It now writes exactly what the deck
  writes (`who.textContent = t.artist`), and the three `body.sc-stream-now` rules are gone. The class
  toggles stay (they are inert), so nothing else that tested for them changes.
- **WHY THE x HAD TO GO.** Every streaming row carried a close glyph at the end of the row, a few pixels
  from the row's own play target; a thumb reaching for a song deleted it. The glyph is removed from both
  row shapes (the shelf, and a playlist/album page) and nothing is wired to it any more.
- **TWO SECONDS, THEN A POPUP.** `scStreamHold()` puts a 2000ms pointer timer on each row and cancels it
  on pointerup, pointercancel, pointerleave and contextmenu. On fire it opens `scStreamMenu()` - a bottom
  sheet built from `document.createElement` (title, then Play, Add to a playlist, Add to an album, Add
  songs from your downloads, and Delete / Remove from this list, then Cancel). The click that follows a
  hold is swallowed in the capture phase, so a long press never also starts the song it was aimed at.
- **AN ALBUM IS A PLAYLIST THAT SAYS ALBUM.** Both are `{ name, items }`; playlists live under
  `streamPlaylists` and albums under a new `streamAlbums` key, restored through the same
  `scStreamRestore()` on boot (`scStreamLoad` now waits for three answers, not two). The shelf has a
  **New album** button beside **New playlist**, the two are listed as separate labelled rows of chips, and
  either opens as a page with how many songs it holds, **Add songs**, **Play all** and a held row per song.
- **ONE LIST CAN HOLD BOTH KINDS OF SONG.** An entry now carries `kind` - `'s'` for a song from the
  source, `'d'` for a file already on the device - and `scStreamPlItem()` keeps it. *Add songs* opens a
  picker over `allTracks`, and what it adds is a real entry (title, artist, length, cover, `kind: 'd'`).
  A list row for a file says **ON DEVICE**. A file is never deleted from the device by a list action:
  the shelf's action is *Delete this song*, a list's is *Remove from this album/playlist*.
- **THE ORDER ACROSS TWO PLAYERS.** This is the part that needed an owner. The stream advances inside
  `scStreamState.queue`; the deck advances inside `queue`/`queueIndex`; neither knows about the other. So
  `scMix` owns a mixed list: `scMixPlay(items, id)` sets the entries, `scMixGo(at)` hands each one to the
  player that can play it - a file goes to `playFromList()` **with the whole run of files in the list** (so
  the deck walks them itself), a streamed song goes to `scStreamPlay()` as a one-song queue. Two hooks
  close the loop: `scStreamNext()` asks the mix for the advance first, and `onEnded` does the same when the
  deck finishes the last file of the run (`pendingPlayId === scMix.lastFile`). An entry whose streamed song
  has left the shelf is skipped, not played, and the end of the list stops cleanly.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.21 in three chained payloads (`dev/patch-80622.py` runs
  `-b.py` then `-c.py`; the release ships them by being committed, and one 39 KB file does not survive that
  commit). 33 steps applied, a second run is a no-op, `--check` is 1 before and 0 after, and all seven
  inline scripts compile. `dev/check-80622.cjs` passes **51 checks**: statically (no pill, no pill string,
  no `scStreamMeta` on the bar line, no `body.sc-stream-now` rules, no `scs-del`/`scsp-del` markup or wiring,
  a 2000ms timer, both row shapes held, the popup's actions, the New album button and maker, `streamAlbums`
  read and written, albums listed beside playlists, `ON DEVICE`, and the two advance hooks) and **driven**,
  in a `vm`: a streamed song and a file join one list with both kinds marked, adding twice is one song,
  removing one leaves the other kind, a file survives a restore while an unresolvable stream is dropped,
  the open list resolves by kind, and the mix plays `stream s_1` -> `quiet` + `deck t_a` with `lastFile t_b`
  -> `deck t_b` -> `stream s_2` -> stop, skipping a streamed entry that left the shelf; the hold starts one
  2000ms timer, opens that row, and swallows the following tap. The OTA pair rebuilt to a true fixed point -
  root + `ota/` **{{ROOT}}** bytes at v80.6.22, and `ota-play/` still HELD (**{{PLAY}}** bytes). **Not
  claimed:** there is no phone and no browser here, so the bar was not seen, no row was held with a finger,
  and no mixed list was heard playing. What is verified is that the bar writes what the deck writes, that no
  row has a close target, that a hold and only a hold opens the popup, that the two stores round-trip, and
  that the mix hands each entry to the right player in order.
