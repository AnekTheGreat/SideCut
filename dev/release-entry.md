## 80.6.14 ({{STAMP}}): the stream is started, and the row says where it stopped

- **WHAT THE OWNER SAID.** *"streaming is not workifn"* - one sentence, after three releases that
  each answered it with a theory. This one answers with mechanics, and leaves a readout on screen.
- **THE ELEMENT WAS NEVER IN THE PAGE.** `scStreamAudio()` built an `<audio>`, kept it in a closure and
  played an object URL on it; the app's own player keeps both of its elements in the document. A
  WebView is free to treat a detached element differently for load, autoplay and decode, and that is
  not something a stream can be asked to survive. It is appended when it exists - 0x0, off-screen,
  `pointer-events:none` - `preload` is `auto` rather than `none`, and its `loadedmetadata` is watched so
  the card knows when there is something to play.
- **THE LINK IS TRIED FIRST, IN THE TAP.** A media element is not held to CORS, so the direct URL is
  the shortest path to sound; the previous release fetched the whole 3.4 MB before it handed anything
  to the element, which on a phone is indistinguishable from nothing happening. `scStreamStart()` sets
  the source, calls `load()` and calls `play()` inside the caller's gesture. When the element refuses
  that link - googlevideo answers 403 to the open-ended range a media element opens with - the song is
  read in bounded ranges and played from an object URL, which is the order the two mechanisms actually
  want.
- **THE READER NO LONGER GIVES UP ON A SHAPE IT DOES NOT KNOW.** `__scCapHttp()` can answer 206 with
  data this page cannot decode; `scFetchRange()` then returned "206, no bytes", which ended the whole
  read instead of falling through to the page fetch. That success status now falls through, and
  `scHttpDataToBytes()` accepts typed arrays, plain arrays and wrapped replies as well as base64.
- **AND THE CARD SAYS WHERE IT STOPPED.** One dim line under the transport: the stream's type and size,
  which path carried it (`link` or `read`), how many bytes were read, the element's `error.code` and
  `readyState`, and the transport's own reason (`window.__scHttpWhy`). A **Restart** button sits beside
  it and starts the song again from a fresh gesture, clearing the object URL and the resolver's cached
  link first. A screenshot of that line is a diagnosis instead of a report.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.13 and driven by `dev/patch-80614.py`: every step
  applied, a second run is a no-op, **all 7 inline scripts compile**, and `dev/check-80614.cjs` passes -
  the element is appended and preloaded, the link is tried before the read, a 206 with unreadable bytes
  falls through to fetch, the readout reports type, size, path, element state and transport reason, and
  the pure functions are **executed**: base64, typed array, plain array and wrapped replies all decode,
  while `null` and an unknown object stay unread rather than guessed at. The OTA pair rebuilt to a true
  fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.14 publishing one honest line, and `ota-play/`
  still held at its published bundle (**{{PLAY}}** bytes). **Not claimed:** playback was not heard. What
  changed is that the page now starts the element the way the app's own player does, tries the two
  mechanisms in the order that can work, and prints the reason when neither does.
