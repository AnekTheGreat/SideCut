## 80.5.1 ({{STAMP}}): the web page points at its own full build from the About row

- **WHAT THIS IS.** 80.5 made the plain web page the build without the converters and gave the full web
  app its own address (`/full/`, which lands on `?full=1`). This is the follow-up the owner said yes to:
  the page that drops the tools now says where they are, in the place a reader actually goes to find out
  which build they are running - **Settings → More → About & updates**, the same card whose header reads
  `SideCut v80.5.1 · Web build — your files only`.
- **ONE ROW, ONE LINK, NO SCRIPT NAVIGATION.** It is an `<a href="./full/">` appended to that card, not a
  button that calls `location`: the browser's own affordances keep working - long-press to copy the
  address, open in a new tab, Back. The door at `/full/` then turns it into `../?full=1`, so the address a
  reader can copy is either spelling.
- **GATED ON `SC_IS_WEB && SC_IS_PLAY`** - "a browser, not in full mode". The store AAB and the sideloaded
  APK are both `SC_IS_WEB` false; a web page opened with `?full` has `SC_IS_PLAY` false because it already
  has the tools, so the link would only point at the page it is on. That gate is also what keeps it out of
  an installed build: a store copy that links to a page full of converters is the swap its review was
  about.
- **THE NOTE SURVIVES THE FILTER IT HAS TO.** The changelog item is shown by the build it is about, so it
  names no converter, no download and no source - only a row and a link to "the other build". The existing
  no-tools filter (`scHidesOnPlay`) therefore leaves it standing on the web page, and the driver asserts
  that rather than assuming it.
- **VERIFIED.** `python3 dev/patch-8051.py` on the 80.5 page (1 step), then `--check` (0 steps); every
  inline script block parses; `sc-8051-check.cjs` passes and fails on the 80.5 page it replaces. It runs
  the page's own block against a stub DOM in four contexts - the web page without full mode (**one row,
  `href="./full/"`, naming the song tools**), the web page in full mode (**none**), an installed build
  (**none**), a store build (**none**), plus a second run that must not add a second row - and checks the
  changelog filter keeps the note on the no-tools build. OTA: `ota/` **{{ROOT}}** bytes and `ota-play/`
  **{{PLAY}}** bytes, both `--check`s OK at v80.5.1, and the Play channel's notes still name no converter.
- **WHAT IS NOT CLAIMED.** No browser was driven and no phone was used: the row's position and look in the
  About card were not seen on a display, and the 80.5 door was not clicked through - the logic was run in a
  `vm` and the pages were fetched over HTTP. No Android build was made; the APK, the widget and the native
  code are untouched.
