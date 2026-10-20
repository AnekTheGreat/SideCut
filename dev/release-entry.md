## 75.1.2 ({{STAMP}}): four pinned artists at a time, and Ask SideCut reads the whole sentence

- **THE OWNER ASKED FOR TWO THINGS.** "ask SideCut should be smarter, pinned
  artists plateu should have 4 displayed at one time with scrolling potential
  unlimited". The rail is `dev/patch-7512-rail.py`; the drawer is
  `dev/patch-7512-ask.py`.
- **THE RAIL IS FOUR-UP, NOT FIXED-WIDTH.** The chips were 72px in a card that
  is about 316px wide on a phone, so the fourth artist was cut in half and the
  rail read as if it ended there. A chip is now
  `calc((100% - 3 * var(--pa-gap)) / 4)` of the rail itself, so exactly four sit
  inside the card and the fifth starts at the edge. Nothing is capped: the width
  comes from the container, not from how many pins there are, so two pins and
  twenty scroll the same way. `proximity` scroll snapping settles a swipe on a
  chip edge without fighting a fast flick. The header now carries the pin count,
  because "there is a fifth artist" used to be discoverable only by swiping.
- **THE DRAWER LEARNS THE REST OF A SENTENCE.** 75.1 could plan a playlist, a
  crossfade, DJ mode and an album. Anything else fell through to a single
  "Carry out: ..." step that the acting layer usually could not carry out, so Do
  it closed the drawer and said "Nothing was changed". Now: "play <song |
  artist | playlist>", shuffle and repeat, next/back/pause/resume, questions
  answered from the library's own numbers (songs, hours, playlists, pinned
  artists, albums, what is playing, most played), and the sentence AFTER a plan
  ("add these too", "take these out", "undo that", "make it 8").
  `lastRun`/`lastUndo` are what those follow-ups point at.
- **PLAY GOES THROUGH THE APP'S OWN PATHS.** `__scPlayPlaylist` opens a playlist
  as itself so the next song is the next song in it, and `__scPlayTrack` is the
  same tap-a-song path the Home bubbles use. Shuffle and repeat are written
  through `__scSetShuffle`/`__scSetRepeat`, which move the state the player's own
  buttons move - including the queue resync the shuffle button does - and report
  the old value so Undo can put it back.
- **IT STOPS PRETENDING.** A sentence it cannot carry out gets no Do it button:
  it says it cannot do that one and lists what it can. The knowledge base is only
  consulted for a real match now (`_aiFuzzyMatch` at 60, not its floor of 35,
  where one shared word scored 40 and "flibbertigibbet the garden hose" came back
  as a confident answer about the converter).
- **TOLERANCE, NOT GUESSING.** One edit is accepted on the long command words
  ("palylist", "shufle"), the crossfade takes a written number ("crossfade six
  seconds"), and a title more than one song answers to is handed back as a
  question instead of picked for the owner.
- **THE GATE.** `dev/ask-rail-check.cjs` boots the page in jsdom: ten pins all
  render with the quarter-width rule present, "play Aurora" / "play Diljit
  Dosanjh" / "play Night Drive" each plan and then really start, shuffle and
  repeat move and undo, the library questions answer with the real numbers, the
  honest reply has no Do it, "add these to X" and "undo that" run off the
  selection, and no page error is raised. `dev/patch-gate-7512.py` puts it in the
  extra arm beside the other drawer gates.
- **THE OTA TOOLING HAD TO LEARN THE ROOT MANIFEST.** `--check` compared the
  bundle against `manifest.json` at the repository root, which nothing ever
  rewrote, so it could only ever compare against an older release.
  `dev/ota-bundle.mjs` now writes that legacy descriptor alongside `updates.json`
  and reaches the same fixed point in two passes.
- **OTA.** The root bundle is `{{ROOT}}` bytes and the Play channel is
  `{{PLAY}}` bytes, both rebuilt to a fixed point before the battery ran.
- **ONE CARRIED RED, NOT CAUSED HERE.** `media-controls-check` fails "and it no
  longer fires every half hour" on `dev/native-updates.js`, which still holds a
  `30 * 60 * 1000` gate at HEAD before this release; it is unchanged by 75.1.2.
- **NOT VERIFIED ON A PHONE.** The gates drive the page in jsdom, which has no
  layout engine: the quarter-width rule is proven as a computed CSS rule and ten
  chips proven to render, not photographed on a device. The real test is one
  swipe on the rail and one sentence typed into the drawer.
- **NEXT RELEASE**: `75.1.3` for a fix inside this one, `76.0` for the next feature. Shell cache `sidecut-shell-v75.1.2`.
