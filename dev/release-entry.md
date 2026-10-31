## 80.6.27 ({{STAMP}}): the record player takes you to the song that is playing

- **WHAT THE OWNER SAID.** *"if your streaming a song it should take you to the song if you click on the
  record player not some random song"*. He is describing one tap that answered with two different songs.
- **WHY IT LANDED ON ANOTHER SONG.** The tap on the mini turntable calls `openAlbumForCurrentSong()`, and
  that function can only see the **downloaded deck**: it reads `queue[queueIndex]` and `allTracks`. A
  stream never touches either - the streaming module deliberately keeps its own `<audio>`, its own store
  and its own lists so a dead stream cannot take the real player with it. So while the source was playing,
  the tap resolved whatever the deck had played *last*, and opened the album for it. That is the random
  song: not a wrong guess, but a different player's state being read as if it were the current one.
- **WHAT CHANGED.** (1) **The tap asks the stream first.** `openAlbumForCurrentSong()` now starts with
  `scStreamPhoneOwns() && scStreamJumpToPlaying()` and returns when that takes the tap, so the downloaded
  queue is never consulted while the source owns the bar. The device path below is untouched. (2)
  **`scStreamPlayingList(id)`** finds the list the streaming song is actually in - the list already on
  screen first (that is the one meant), then the albums, then the playlists - and answers `{kind, name}` or
  `null`. (3) **`scStreamJumpToPlaying()`** puts the source on, opens that list, and on the next frame
  finds the row whose `data-hold` is that song, scrolls the shelf's own pane to it and lights it for a
  moment. A song in no list still opens the streaming shelf, which is where the playing song is drawn -
  the tap never answers with nothing. It scrolls with `smoothScrollIn` and, failing that, by writing
  `scrollTop` on `#scStreamBlock`; `scrollIntoView` is still never used, because on Android it bubbles out
  of the pane and lifts the whole app.
- **WHAT WAS DELIBERATELY NOT DONE.** The tap does not start, stop or re-resolve the stream, does not
  open a list the song is not in, and does not invent a list for a loose song. It navigates; it does not
  play. The long press for the turntable angle and the whole device-side resolution are unchanged.
- **WHAT WAS RUN.** `dev/patch-80627.py` over the released 80.6.26 page: `--check` **1** before, 4 steps
  applied, a second run a no-op, `--check` **0**. `dev/check-80627.cjs` passes **43 checks**, and it runs
  the code rather than reading it: the resolver in six states (the open list wins over an album that also
  holds the song; albums are tried before playlists; a loose song resolves to nothing; a numeric id in the
  store still matches the string from the row), and the jump against a fake shelf - the album opens, the
  right row is scrolled to and lit while the one above it is not, the light comes off again, the shelf is
  only repainted when it is not already up, the source comes on when the tap starts from the device side,
  a loose song opens the shelf instead of a list, an empty shelf scrolls nothing and does not throw, and a
  stream that does not own the bar does not take the tap at all. It also proves the guard sits *before*
  the downloaded queue is read, which is the whole bug. All seven inline scripts compile. OTA rebuilt to a
  true fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.27, the `ota-play/` channel (**{{PLAY}}**
  bytes) untouched.
- **NOT CLAIMED.** There is no phone and no browser here: no record player was tapped with a stream
  playing, and the scroll and the light were never watched on a screen. The wiring and the logic are
  proven; the feel of the tap is not.
