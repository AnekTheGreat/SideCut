## 80.7.4 ({{STAMP}}): the whole song, or a row that says where it stopped

- **WHAT THE OWNER SAID.** *"make sure the streamed songs are correct too like it shouldnt be a fake"*. So the streaming path was
  audited end to end rather than adjusted. What it does do: every row carries the exact `videoId` it was added from
  (`scStreamAddResult`), `scStreamResolve()` asks the player endpoint for **that id** and never runs a search, so the app cannot
  hand you a different song dressed in the row's title. What it did not do is the other half of "correct": check that the audio
  which came back is the whole song.
- **THE FAKE, AND IT WAS REAL.** The source caps the audio-only copy of a music upload at its first megabyte (the player's own
  comment records the 403 past it), and the muxed copy sits behind it as an alternate. `scFetchBytes()` refuses a short read only
  when the player reported the file's length (`total + 4096 < size`); when it did not, a capped read is indistinguishable from a
  whole file, and nothing anywhere compared the result with the length the row already carried. So a 3:12 song could arrive as
  its first 1:04, play, go quiet - and that fragment was then **kept in memory for the next tap** and **decoded as the song by
  Crop**, which is a fake in the only sense that matters: the app called a minute of audio the whole song. If it reached its end
  instead of erroring, `ended` fired and the app moved to the next song as though this one had finished.
- **WHAT LANDED.** `scStreamWhole(want, got)` judges a copy against the row's own length - a copy more than fifteen seconds (or a
  tenth) short is a fragment, while a copy that carries the music video's intro is longer and is left alone, and a row that never
  knew its length, or an element that has not reported one, is never judged. `scStreamFragCheck()` runs from `scStreamTick()`
  on the first metadata the element reports, before a fragment has played a second: the fragment is dropped from the cache, the
  state records `the source sent a fragment`, and the next source the player handed over is read and started **at the second the
  fragment stopped on** - so the song continues from 0:00 of the full copy instead of restarting or skipping. When every copy is
  short the row says `This copy of the song ends at 1:04 of 3:12 - tap Restart to try another copy` rather than falling silent as
  though the song had finished, and a ceiling of twelve steps says `Every copy of this song stopped short` instead of looping.
- **WHAT WAS RUN.** `dev/patch-8074.py` over the released 80.7.3 page: `--check` **1** before, **4 steps** applied, a second run
  a no-op, `--check` **0**. Then the workflow's own fixed-point loop for both OTA channels - honest on pass 3 - and
  `dev/check-8074.cjs`: **55 passed, 0 failed** (the first run failed one check and only because it pinned the month: the stamp
  had rolled into November in Eastern time, so the pin is on the format now, not the month). The release's own function is
  **driven**, not just found: a 3:12 song arriving as 1:04 with a full copy behind it drops the fragment, reads the alternate on
  its own terms, starts it at 0:00 and leaves the player un-busy; the same fragment with no copy behind it names the second it
  ends at and asks for a restart; a whole song is untouched; a copy with the video intro is not refused for being longer; twelve
  spent copies stop reading instead of looping; a row with no video id is not the stream's business; and `scStreamWhole` is run
  across the boundaries. The routing proof is pinned in source as well: the resolver asks for the row's own id and never
  searches. 80.7.3's dots-on-the-player menu and 80.7.2's crop pieces are re-checked, and every inline script compiles. OTA at a
  true fixed point on the full channel - root + `ota/` **{{ROOT}}** bytes at v80.7.4, carrying all three notes. **The Play
  channel is held at v80.7** (`dev/channel-hold.json`, **{{PLAY}}** bytes).
- **NOT CLAIMED.** No phone and no browser here, so nobody has heard a capped copy handed over to the full one on a device. What
  is proven is the rule, the step it takes, the state it leaves, and that the page and the full channel carry it. The deep
  limits are unchanged and now written down: `scFetchBytes()` reads at most 40 MiB, so a song longer than that is read to the
  ceiling and its tail is not in the blob; and a row whose search result reported no length cannot be judged at all - it plays
  whatever the source sends, because there is nothing to judge it against. `dev/check-8071.cjs`, `-8072.cjs` and `-8073.cjs` now
  fail by design: each pins its own version, the same way every earlier release checker does.
