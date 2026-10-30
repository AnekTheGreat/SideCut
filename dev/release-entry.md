## 80.6.18 ({{STAMP}}): the web page says FullDev, and the genres are yours

- **WHAT THE OWNER ASKED FOR.** *"make the web version have fulldev after the SideCut"*, *"the full
  web version should also have dev after full"*, and *"have the regular genres with customizable genres
  that the ai can take and recommend song from those genres"*. Three changes, all inside the build that
  carries streaming.
- **THE WEB PAGE NAMES ITSELF.** On the web page the wordmark reads **SideCut FullDev** - the tag sits
  beside the name as a small coral pill, and the browser tab says the same thing. It is set from the
  page's own build flags (`SC_IS_WEB` and `SC_WEB_FULL`), so the installed app keeps its plain name and
  no other build grows a tag. It is a one-shot at boot, guarded against a missing header and against
  being applied twice.
- **ONE GENRE LEFT THE RAIL.** The rail no longer offers a genre the owner does not want. Nothing else
  about the built-ins changed: they are the same sixteen-minus-one gradient tiles, in the same order,
  with the same searches behind them.
- **THE RAIL IS THE OWNER'S AS WELL AS OURS.** A **+ Genre** tile at the end of the row asks for a name.
  It is tidied (one line, at most 24 characters), kept in `streamGenres`, and offered on the rail as a
  tile of its own - grey rather than a canned gradient, so an added genre reads as yours. Tapping it
  searches it exactly as a built-in does, the moment it is added. A long press (650ms) on a genre you
  added asks before taking it away; a long press on one that came with the app says so and removes
  nothing. The tap that follows a long press is swallowed, so removing a genre never also starts a
  search. The list is read back with the shelf, so it survives a restart with no migration step.
- **AND THE AI READS THEM.** **Recommended** now asks the AI first: it hands Gemini the whole rail -
  built-in genres and the ones you added - and asks for real songs across those tastes, as a small JSON
  list. Each title it names is then searched through the ordinary search path, so what comes back is
  the same kind of row a typed search produces, with the artist and the length, ready to add. It offers
  a few, not a wall, and says where they came from. Two honest fallbacks: with no Gemini key it
  recommends from the rail itself and says how to connect one; if the AI answers with nothing usable,
  it says that and leaves the tiles working. The list is also reachable by anything else that can ask,
  through `window.__scStreamGenres()`.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.17 and driven by `dev/patch-80618.py`: 15 steps
  applied, a second run is a no-op, all seven inline scripts compile, and `dev/check-80618.cjs` passes
  55 checks - statically (the tag and its three guards, the removed genre, the + tile and its wiring,
  the long press and its swallowed tap, the stored list and its load, the AI call reading the key and
  the model the app already holds, the fallbacks) and **behaviourally**, by running `scStreamGenres()`
  and `scStreamGenreName()` in a `vm` over a messy saved list: the built-ins come first, an added genre
  is offered, a duplicate in different case is not added twice, an empty entry is ignored, spaces are
  tidied, a long name is capped at 24 characters, an added genre searches its own name, and the line
  handed to the AI shortens itself. The OTA pair rebuilt to a true fixed point - root + `ota/`
  **{{ROOT}}** bytes at v80.6.18 publishing one honest line, and `ota-play/` still held at its
  published bundle (**{{PLAY}}** bytes). **Not claimed:** no browser and no phone here, so the tag was
  not seen on screen and no AI answer was received. What is verified is that the rail builds from the
  saved list, that the tag is gated on the web flags, and that the recommendation path hands the
  genres to the AI and the answer back through the search that already works.
