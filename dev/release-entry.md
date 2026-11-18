## 85.1.0 ({{STAMP}}): the music video plays, with its own play and pause

**85.0.0's tab opened on a black frame, and the code says exactly why.** Three
faults, and the first one was fatal on a phone. `play()` was issued *after* the
resolver's network round trip - by then the WebView no longer had a fresh gesture
from the tap, so it refused with `NotAllowedError`, and the rejection was caught
and dropped. The element was also hidden behind the status text until
`loadeddata` fired, so a refused source was a black panel with nothing written on
it. And a refused direct URL fell straight to `scFetchBytes`, the reader that
cannot open googlevideo from a browser (no `Access-Control-Allow-Origin`), so the
alternates the player had already handed over were never tried.

**The picture is up from the moment it has a source.** `scVideoAttach` sets the
element, calls `load()`, and leaves the frame visible while it starts. A refused
`play()` is not swallowed any more: the frame stays, the reason is printed, and a
round button appears in the middle of it.

**The controls are SideCut's own, drawn on the picture.** The browser's gray
strip is not used. Inside the stage sits one pill: a round **play / pause**
button whose icon swaps with the frame (a triangle when stopped, two bars while
it runs), a progress line that fills as the video plays, the clock beside it, and
`NEXT` and `FULL` at the end. The same round button is the way back in when the
phone refused autoplay - a tap is the gesture the WebView wanted, so it starts
the song and the picture together and the animation runs with sound. Tapping the
picture itself does the same thing.

**It is still picture, not a second player.** The video stays muted and rides the
song's clock; the transport drives the *song*, so play and pause always come out
of the app's own audio graph, and a drift of more than a second and a half seats
the picture back on the song. That is why a tap on PAUSE stops the music you can
hear and the picture you can see at the same moment.

**Every failing step now says so on the screen.** The lookup, the direct stream,
each alternate (three are tried before the reader), the reader, and the
decoder's own `MediaError` code all print a line: `the stream dropped (network)`,
`the phone could not decode this stream`, `this source is not a video the element
can open`. A tab that does nothing is no longer indistinguishable from a tab that
was never opened.

`dev/patch-8510.py` is the payload. It slices 85.0.0's module out - from its
banner comment to the shelf comment that follows it, not by line count - and
inserts `dev/video-8510.js` in its place, then moves the version line, the cache
name, one new notes entry and `updates.json` to 85.1.0. The rail glyph and its
click branch were 85.0.0's and are untouched.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
