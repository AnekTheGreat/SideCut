## 80.5.2 ({{STAMP}}): nothing on screen names another build

- **THE OWNER'S ASK, VERBATIM.** *"don't mention the actual full version web or apk in the app or apk or
  web, same thing in patch notes don't mention this"*. 80.5 and 80.5.1 had answered "where did the tools
  go" by pointing at a second build; this release takes every one of those pointers out and leaves the
  behaviour exactly as it shipped.
- **THE TWO SIGNPOSTS ARE GONE, NOT HIDDEN.** The Discover card from 80.5 (`scFullWebNote`) and the About
  & updates row from 80.5.1 (`scFullWebRow`) are removed by putting back the exact text they were inserted
  into - the payload imports the modules that wrote them, so nothing of either can be left behind. Nothing
  in the app links to `./full/` any more.
- **THE VERSION LINE IS THE VERSION.** It read `SideCut v80.5.1 · Web build — your files only`, one of
  four build names. It reads `SideCut v80.5.2` and stops. The one runtime sentence that named the store
  build - the licensed-search failure - now says *"this copy"*.
- **THE NOTES STOP NAMING BUILDS TOO.** 80.5.1's entry is deleted (it asked for a link that no longer
  exists); 80.5 keeps only the note about the page itself and loses the three that named the full web app
  and the full APK; and five older clauses lose the mention of "the full build", "the other build" or
  "the Play build" (two of them in the same sentence pair). The driver runs the changelog filter for both
  builds and searches every note each build can actually show, rather than trusting a grep of the source.
- **THE DOOR STOPPED ADVERTISING ITSELF.** `/full/index.html` was a splash titled *"SideCut full — the
  build with the converters"*. It is now a plain SideCut splash that replaces itself with `../?full=1`.
  The address works exactly as before; it just no longer introduces itself as a second product, which is
  what the app stopped doing an hour ago.
- **WHAT DID NOT MOVE.** The switch, the removal and the door are untouched: the plain web page still
  carries no converters, the installed builds still carry all of them, and `/full/` still opens the full
  web app for anyone who knows the address. This release changes words and pointers, not behaviour - the
  driver asserts that too (`SC_IS_PLAY`, the removal list and full mode are all still in the page).
- **VERIFIED.** `python3 dev/patch-8052.py` on the 80.5.1 page (1 step), then `--check` (0 steps); every
  inline script block parses; `sc-8052-check.cjs` passes **25/25** and fails on the 80.5.1 page it
  replaces. It checks that both signposts are absent, that the version line is `SideCut v${APP_VERSION}`,
  that the runtime message is neutral, that 80.5.1 is gone from the changelog and 80.5 keeps exactly one
  note, and that no note either build renders matches `full web|full apk|full build|other build|play
  build|web build|sidecut full`; plus that the door still redirects, still works with the script off, and
  names no build. OTA: `ota/` **{{ROOT}}** bytes and `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at
  v80.5.2, with the Play channel's notes free of any converter note.
- **WHAT IS NOT CLAIMED.** No browser and no phone: nothing here was seen rendered. Engineering comments
  in the source still explain the two-build architecture (`SC_IS_PLAY`, the store flag, the Play channel)
  because a maintainer needs them; what a person using the app can see no longer mentions another copy.
