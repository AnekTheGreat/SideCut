## 81.5 ({{STAMP}}): Library opens on the first tap, and Studio can build a set

- **WHAT THE OWNER SAID.** *"there's this weird glitch where if you go to studio or tools, it doesn't let you click back onto
  library until you go to home and spam library, fix that"* - and then, in the same breath: *"make it easier to crop songs, I
  should be able to skip around to specific parts in the song", "in studio make like a dj playlist thing where you can add
  songs and remix them for something like wedding playlists or reception playlists", "make cloud mode better and nicer to
  use"*. Everything ships to both builds: one page, one `index.html`, the store build is the same file with `SC_IS_PLAY` on.
- **THE DEAD PILL.** The Library tab is not one door but two, and both of them could open nothing. **On the source** the
  handler handed the tap to `scShelfOpenTab` and returned; that function's "this page is already up" guard is a fact about
  the *shelf*, not about the *screen*, so a tap made from Studio or Tools - where the library had never been painted -
  decided there was nothing to do and did it. **On the device** the handler picked the playlist to land on **before**
  `navigate()`, so any throw in that picking (a stale last-used name, a half-migrated playlist map) took the navigation down
  with it. Home was always fine because Home's handler is one call with nothing in front of it, which is exactly why the
  reported workaround was "go Home and spam Library".
- **THE ANSWER.** `scShelfAway()` is one question asked of the screen - is Home, Discover or Studio the active view, or is
  the library's own box hidden - and the pill now passes its answer as a **force** to `scShelfOpenTab`, where "already up"
  is only true when you are standing in the room. The device side keeps its playlist preference, but it is now wrapped: a
  pick that cannot be made falls back to All Songs, the scroll flag is guarded, and `navigate('library')` runs either way.
- **CROPPING BY EAR.** The clip sheet used to be two numbers, two edges you could not move, and four nudge buttons: finding
  the second a song should start at meant export, listen, try again. It now keeps an audio element for the life of the sheet
  (repainting the panel does not stop the song), plays from the start of the range, stops itself at the range's end so what
  you audition **is** what the export writes, offers Loop to keep it going while you move an edge, and carries a playhead
  you can drop anywhere by pressing the bar. Both edges are draggable across the whole bar, and **Set the start here** /
  **Set the end here** take the moment you are hearing as the boundary. Fine nudges are ±0.1s.
- **DJ SETS.** Studio gains a section that stores named, ordered runs of songs: the **Wedding** preset (4-second blends) and
  **Reception** (2-second), plus New set. Add the working song, move a song up or down, sort by the tempo the app read for
  each one (a known tempo sorts before an unknown one, and two unknown ones keep their order), choose the blend from
  none/2/4/6 seconds, then **Play the set** - which writes the set as a real playlist the app owns and plays it, so the
  queue that follows is the set - or delete it. The length shown is the songs minus the blends each join gives back.
- **THE CLOUD LAYOUT.** Bubbles get 14px of air and 11px on a narrow phone, a capped now bar that ellipses instead of
  growing across the header, glass behind the dock, press feedback on a bubble, and scroll padding so the first card is not
  born under the top bar.
- **WHAT WAS CHECKED.** `dev/patch-815.py --check` reported 1 before the payload and 0 after it, a second run was a no-op;
  `node dev/check-815.cjs` runs the new judgement rather than grepping it - four screens through `scShelfAway`, an
  unordered run through `djMixOrder`, real numbers through `djSetStats` and `djClock` - over every inline script in the
  page compiling. The OTA manifests reached a fixed point at {{ROOT}} bytes for the full page and {{PLAY}} for the store
  build.
- **NOT CLAIMED.** No phone, no browser and no Android build ran here: the drag on the crop bar, the sound of the transport
  and the feel of the cloud spacing were not watched or listened to. They are the code the checks above describe, not a
  remembered experience.
