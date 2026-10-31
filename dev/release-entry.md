## 80.7.3 ({{STAMP}}): the dots on the player open the menu of the song you are hearing

- **WHAT THE OWNER SAID.** *"the streaming songs should be able to be cropped"* - after 80.7.2 had already given a catalogue
  song a Crop. The Crop existed; the route to it did not reach the screen the song plays on. Behind the vertical dots on the
  player, `showNpMenu()` read the deck queue and nothing else:
  `if(queueIndex < 0 || queueIndex >= queue.length) { toast('Play a song first'); return; }`, then
  `if(!allTracks.some(tr => tr.id === id)) return;`, then `openSongActions(id)`. With a catalogue song playing there is no deck
  queue entry for it - `scStreamBarOn()` shows the same `#nowPlaying` screen and `scStreamQuietDeck()` silences the deck - so the
  dots either answered **"Play a song first"** or, if a download was still in the queue, opened *that* song's menu: the one song
  that is not making sound. The only way to crop a catalogue song was to long-press its row in the catalogue list, which is
  not where anyone looks while the song is on the screen in front of them.
- **WHAT THE DOTS DO NOW.** `showNpMenu()` asks the song on the screen first: if `scStreamState.barOn` is set and there is a
  `curId`, it calls `scStreamMenu(curId, 'np')` and returns. That sheet is the one the long-press already built - Play (when
  that song is not the one playing), **Crop a clip from this song**, Add to a playlist, Add to an album, Delete this song - so
  the crop sits one tap from the player, and the downloaded song's menu is untouched for every case where the deck owns the bar.
  Nothing about the crop itself changed: 80.7.2's `scStreamCropFile()` still reads the bytes (the object URL it is playing, the
  read-ahead copy for its video id, then a fresh read of the same source) and `scCropStreamSave()` still writes the kept part
  into the library as a new song with its cover, leaving the catalogue row alone.
- **WHAT WAS RUN.** `dev/patch-8073.py` over the released 80.7.2 page: `--check` **1** before, **3 steps** applied, a second run
  a no-op, `--check` **0**. Then the workflow's own fixed-point loop for both OTA channels - honest on pass 3 - and
  `dev/check-8073.cjs`: **35 passed, 0 failed**, including three runs of `showNpMenu` itself (a catalogue song on the bar opens
  its own sheet and never the queue song or the nothing-playing toast; an empty bar still answers as it always did; a downloaded
  song keeps its own menu and a released bar does not interpose), the three-note changelog against the updater's own filter, and
  every inline script compiling. The guarantees 80.7.2 landed are re-checked too - the catalogue row still offers Crop, the
  reader and the clip writer are still there, and the press from outside still resumes a catalogue song. OTA at a true fixed
  point on the full channel - root + `ota/` **{{ROOT}}** bytes at v80.7.3, carrying all three notes. **The Play channel is held
  at v80.7** (`dev/channel-hold.json`, **{{PLAY}}** bytes): the crop reaches the catalogue module, and the Play build ships
  without it.
- **NOT CLAIMED.** No phone and no browser here. Nobody has tapped the dots on a catalogue song and watched a clip land in the
  library. What is proven is the routing - which menu the dots open, with which id - the crop path behind it on the page and in
  the full channel's zip, that the page is v80.7.3 while the Play manifest still reads 80.7, and that every inline script
  compiles. `dev/check-8071.cjs` and `dev/check-8072.cjs` now fail by design: they pin their own versions, the same way every
  earlier release checker does.
