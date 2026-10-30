## 80.6.13 ({{STAMP}}): the shelf scrolls, a playlist keeps its songs, and the regular channel waits

- **WHAT THE OWNER SAID.** *"why are you delivering the update to the regular version it shouldn't
  update at until I tell you to it's hard to scroll down in the streaming mode and it should like stay
  the playlist and metadata for the songs in the streaming playlist and it doesn't work figure out a
  way to make it work"* - four complaints, four separate causes.
- **WHY IT WOULD NOT SCROLL.** `#library` is a flex column with no scroller of its own; `#listPane` was
  the scroll area, and opening the shelf set that pane to `display:none`. The shelf was then the only
  child of a column with no height, no overflow and no bottom inset, so everything under the first
  screenful was clipped by the viewport instead of scrolled - a page that simply refuses to move. The
  shelf is the scroll area while it is up (`flex:1 1 auto; min-height:0; overflow-y:auto`, contained
  overscroll, momentum, and the same dock inset the list uses), and the result list lost the
  `max-height:230px; overflow:auto` box it carried: two nested scrollers is why a drag that started on
  a result never reached the page under it. The rail is a real tab bar now - three equal 40px tabs, the
  open one filled with the accent, `aria-pressed` on each - and the library's own filter strip stands
  down while Streaming is the page.
- **WHY A PLAYLIST FORGOT ITS SONGS.** A playlist stored ids and nothing else; the title, artist, cover
  and length lived in `tracks`, so a song that left the shelf left a playlist holding an id that
  rendered as nothing. Playlist entries are whole songs now (`id, videoId, title, artist, dur, thumb`),
  `scStreamRestore()` migrates the id-only shape by filling it from the shelf on load, a song a playlist
  still holds is put back into Streaming rather than silently dropped, and an id nobody can resolve is
  discarded instead of drawn blank. Tapping a playlist opens it as a page - its songs, their covers,
  artists and lengths, Play all, and a remove per row - instead of starting track one and calling that
  a playlist.
- **WHY THE STREAM DID NOT PLAY.** Not the resolver: run from this machine against the two client shapes
  the page asks with, both answer `playabilityStatus: OK` with audio rows, and the resulting googlevideo
  URL answers `HTTP 206` to a bounded range with the right `content-range` - measured, not assumed. What
  was wrong was around it. `scFetchBytes()` watches `window.__scCancelDl`, the downloader's Stop flag, so
  a stream read while that was still set came back one range deep and played a fragment; the played
  source now clears and restores that flag. The resolver's own `contentLength` was thrown away and the
  reader was handed `size: 0`; it is kept on `scStreamState.size` and handed over, so the reader plans
  against the real file. And a failed read fell through to a bare link with an empty message - a play
  button that appears to do nothing, which is exactly the report. The failure path now names the step
  (`window.__scHttpWhy`, the page's own transport reason), the element's error handler repairs a song
  once and then says so instead of looping, and the play button starts a song that never loaded instead
  of returning early.
- **THE REGULAR CHANNEL IS HELD.** `dev/channel-hold.json` carries `"play": true`, and
  `dev/ota-bundle-play.mjs` honours it: with the key set it leaves `ota-play/` exactly as it is - the
  bundle a regular install already has - and its `--check` reports the hold instead of demanding the new
  version, so the release still settles. The full build's channel (`ota/`) is untouched and ships this
  release. Lifting the hold is deleting the key; the next release publishes to both again. This is data,
  not a build flag: nothing about the page depends on it, and a held channel cannot receive a bundle it
  was never given.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.12 and driven by `dev/patch-80613.py`: 23 steps applied,
  a second run is a no-op, **every one of the page's 7 inline scripts compiles**, and `dev/check-80613.cjs`
  passes - the shelf owns the scroll, no result box scrolls on its own, the rail is three equal tabs, the
  cancel flag is saved and restored on every path of the source helper, the resolver's length reaches the
  reader, and the playlist functions are **executed**, not grepped: the whole song is stored, adding twice
  is one song, the id-only shape comes back with its metadata filled in, an orphan keeps its name, an
  emptied playlist disappears, and an unresolvable id is dropped. The OTA pair rebuilt to a true fixed
  point - root + `ota/` **{{ROOT}}** bytes at v80.6.13 publishing one honest line, and `ota-play/` left at
  its published bundle with `--check` reporting the hold. **Not claimed:** playback was not heard - that
  needs the device. What is proven is that the source is asked, answered, read with the right length and
  a cleared stop flag, and that every refusal is now named on screen.
