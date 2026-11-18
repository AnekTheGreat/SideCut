## 85.1.2 ({{STAMP}}): a quality list, and a picture that turns sideways

**85.1.1 could only show what the player handed over first.** That was the
progressive 360p row, and the same answer already carried the sharp ones - 480p,
720p, 1080p, 1440p, 2160p - which the tab only ever used as fallbacks. So the
music video was soft on every phone, and the one thing you could not do was ask
for the version the screen was built for.

**The ladder is read out of the answer.** Every video-only row is grouped by the
height it really is, and each height takes the row the WebView can open - H.264
before VP9 before AV1 - with a muxed row winning its height outright because it
carries sound in the same stream. The size chip in the header opens the list:
`AUTO` (the best one-stream size, which is 85.1.1's guarantee) and every size
this video has, each with its tag, codec and weight. The size you pick is kept
for the next video, and a size that is not offered is asked for as the nearest
smaller one.

**The sound does not change owner when the picture does.** Above the one-stream
sizes YouTube sends the picture and the audio as two streams. The audio row is
this same video's own recording, so it plays in a second, hidden element while
the picture is muted, and the picture is nudged onto its clock every 600 ms. What
you hear at 4K is still the video, not the song - and when there is no audio row
at all the song is the soundtrack, muted, exactly as 85.1.1 left it. A soundtrack
the phone refuses hands the song over at the right second instead of going quiet.

**The picture can turn sideways.** `FULL` used to ask the `<video>` for
fullscreen, which on a phone took the app's own controls away with it. The
landscape button makes the stage full-bleed, asks the backdrop for fullscreen and
the screen for landscape, and keeps the transport, the quality list and the close
button on the glass; tapping it again unlocks the orientation and puts the header
back. Both work without the fullscreen API, because the wide layout is the
stylesheet's, not the browser's.

**Switching keeps the second.** A new size is attached at the time the old one
was on and keeps playing; a codec the phone refuses is retried at the same
height, then the size falls back to the best one-stream row with a line saying
so. No size above 64 MB is read into memory, so the byte reader stays a fallback
and not a way to hold a film.

`dev/patch-8512.py` replaces the module as one slice (from its banner comment to
the shelf comment that follows it), then moves the version line, the cache name,
one new notes entry and `updates.json` to 85.1.2. The rail glyph and its click
branch are untouched.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
