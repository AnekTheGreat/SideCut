## 85.0.0 ({{STAMP}}): a music video tab on the side rail

**The side rail has a fourth glyph, and it plays the song's music video.** The
rail is the fixed column of glyphs on the right of the library - Songs, Playlists,
Albums, then the source switch - and the video tab sits under the three pages and
above the switch. It is on the full build only: the Play build has no source and no
video path, so it is not drawn there at all rather than opening onto nothing.

**A song from the source and a file on the device both work.** A catalogue song
already knows which video it is, so its own clip is what plays. A file has no video
id, so the host is searched for "artist title" through the ranking the converter
already trusts, and NEXT walks the next few results - a search for a common title
lands on the wrong upload often enough that one result was not an answer.

**The video is picture, not a second player.** It plays muted on the song's own
clock, follows play and pause, and re-seats itself when it drifts more than a second
and a half. That is the whole reason it is muted: the sound you hear is the song this
app is already playing, through this app's own graph, so the two can never double up.
The element is pointed at the progressive 360p muxed MP4 the player hands over, and
when the media stack refuses that URL the same picture is read with `scFetchBytes` -
the reader the downloader and the stream already use - and played from a blob.

**Both orientations, with nothing to listen for.** The viewer is a fixed full-screen
layer: a header, a grid cell that cannot overflow, and one footer line. The picture
is contained in that cell, so a portrait phone letterboxes a 16:9 video and a
landscape phone fills the height; a rotation reflows it because nothing in it is
measured in pixels. FULL asks the element for real fullscreen and, where the phone
allows it, landscape.

**The measured half.** The player call was run against this exact request shape
before the tab was written: the ANDROID client answered `OK` with one progressive row
- itag 18, `video/mp4; codecs="avc1.42001E"`, 360p - and googlevideo served it in
1 MiB ranges (`206`, `Content-Range: bytes 0-1023/11829048`), which is the shape
`scFetchBytes` expects. The same response also carried 360p-2160p adaptive video
rows, so a refused progressive row has a picture behind it.

**What this does not do.** It does not download or keep the video, and it does not
try to sync past a music video whose intro is longer than the song's: the picture
follows the song's second, so an upload with a spoken intro will sit out of step.
That is a property of matching a film to a track, not something to paper over.

`dev/patch-8500.py` is the payload: the version line, one new notes entry, the
`video` glyph in the icon map, the rail glyph and its click branch, and the module
(`dev/video-8500.js`) inserted into the same script block as the shelf code so it can
reach the app's own resolver, reader and players. Its anchors are the version line,
the 84.1.3 notes entry, the icon map's `device` glyph, the source switch in
`scShelfRender`, the rail's click wiring and the shelf page comment, each matched
exactly once.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
