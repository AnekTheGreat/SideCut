## 85.2.7 ({{STAMP}}): the song on the screen is the song in the picture, and a way back

**Two reports, and the first one was not the ladder.** The tab could show one song's
film while a different song played, and then keep it on the screen for the rest of
that song. A video is found in two round trips - the lookup, then the player - and
the queue can move in between: a song that ends while the tab is still looking for
its film hands over to the next one. The answer for the song that had just been left
loaded anyway. Worse, the tab had already recorded the new song as the one it was
on, so the tick that follows the queue saw no change and never corrected it - the
same key that was supposed to fix this was what made the wrong film stick.

**A film belongs to a song that is still on.** `scVideoStart` numbers every start
(`scVideoState.startSeq`) and keeps the song's key with it, and `scVideoStillOn`
asks, when a lookup comes back, whether that number is still the current one **and**
whether that song is still the one playing. If either has moved the answer is
dropped - no film, no cover - and the tick's `scVideoFollow` is what loads the song
that is actually on. The player answer is checked the same way in `scVideoLoad`,
because that is the second and slower round trip, and only the load that is still
current may clear the loading flag now.

**A closed tab cannot be painted by an answer that was still out.**
`scVideoClose` bumps the same number before it clears the stage, so a lookup or a
player answer that lands afterwards is history instead of a source attached to a
page with no picture on it - which, on a size that carries its own sound, also held
the song. It clears the loading flag too; that flag used to stay set for the rest of
the session once the tab was closed mid-lookup.

**And there is a way back.** The only exit was the close cross at the far end of the
header, which on a phone is the one corner a thumb does not reach. A back arrow now
leads the row (`#scVideoBack`), in the portrait header and on the glass in
landscape - the auto margin keeps it on the left while the sizes and the cross stay
on the right - and it leaves the tab exactly the way the cross does: the song picks
up at the second the picture was on.

`dev/patch-8527.py` replaces the module as one slice (from the 85.2.6 banner to the
shelf comment that follows it) with `dev/video-8527.js`, then moves the version
line, the cache name, one new notes entry and `updates.json` to 85.2.7. A second run
is a no-op.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.

### What was checked, and what was not

Checked: `dev/check-8527.cjs` passes 170 assertions, the 157 of 85.2.6 included.
The ones this release is about: the tab's header carries `#scVideoBack`, the
stylesheet gives it the leading place in the row, and it is wired - one tap clears
the open state, takes the backdrop off the screen and hands the sound back to the
song. A lookup that is started for track one, held open while the queue moves to
track two, and then answers is dropped: the player is never asked, no other song's
film is put up, and the next `scVideoFollow` takes the tab to track two with that
song's own video. The same held lookup answering **empty** puts no cover up for the
song the queue left. A lookup that lands after `scVideoClose` changes no video and
leaves the loading flag clear, and a player answer that lands after a close attaches
no source at all - `scVideoState.rung` stays null and the element has no `src`.
`python3 dev/patch-8527.py --check` exits 1 before and 0 after, a second run prints
`already on the page`, all 7 inline scripts of the patched page parse, the module on
the page is byte-identical to `dev/video-8527.js`, the back button appears once, and
the sound flag is still read in all five places. Bundles reached their fixed point in
three passes and both channels verify with `--check`.

Not checked: no phone and no browser session drove this screen, so the back arrow
was never rendered - its place in the header, its weight against the title and its
behaviour over the landscape glass are stylesheet rules that have not been looked
at. The race itself was proven with a lookup that is held open until the test
answers it, not with a real search on a real radio; the follow is still proven as a
key comparison and a load, not as a film changing by itself on a device. And
whether the song that plays last is the one the app's own bar names in every path
is not asserted here - the tab reads the same queue the bar does.
