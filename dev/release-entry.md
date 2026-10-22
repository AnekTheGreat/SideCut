## 80.0.5 ({{STAMP}}): the tabs are a staircase, and a computer gets the room it has

- **THE OWNER'S WORDS.** "v80.0.5, staircase with tabs nice, make the UI on SideCut
  for computers and stuff nice and YouTube and Spotify converter isn't working fix
  it." Three asks in one line: the staircase, a desktop pass, and the converters.
  Two of the three are in this release. The third is not, and why it cannot be is the
  longest note below - it is a server that is down, not a page that is wrong.
- **THE STAIRCASE REPLACES THE BAR, IN THE CLOUD LAYOUT ONLY.** 80.0.3 put the four
  tabs in one capsule across the top. This release makes each tab its own capsule and
  steps them down the bottom right corner: `#homeBtn` three steps in from the edge,
  `#libraryBtn` two, `#discoverBtn` one, `#studioBtn` in the corner, each step
  `--sc80-step` (15px on a phone, 18px past 900px). The container keeps
  `position: fixed` and loses its own background, border and padding, because a step
  cannot read as a step inside one shared bar. Classic layout: untouched, its own
  bottom dock is where it was.
- **THE DOCK SITS ABOVE THE PLAYER, MEASURED.** `applyLayout()` now writes
  `#nowPlaying`'s real height into `--sc80-player` in the same frame it writes
  `--sc80-head`, guarded to 40..320px so a hidden player cannot lift the dock off the
  screen. The dock's `bottom` is `env(safe-area-inset-bottom) + var(--sc80-player) +
  10px` - no guessed number, at any font size.
- **THE VIEWS SWAP BANDS.** They no longer reserve the top bar's band
  (`padding-top: 10px` now) and reserve the staircase and the player at the bottom
  instead (`padding-bottom: calc(var(--sc80-player) + 240px)`, 120px past 900px). The
  add-songs menu moved from under the old bar to above the staircase.
- **BUBBLES BIGGER, AND THE DESKTOP PASS.** The wall runs to the screen edges (6px,
  not a gutter), the gap is 10px not 14, and the two numbers inside are 24px/11.5px.
  Past 900px: three bubbles to a row, the wall centred in a 1120px column and the
  views in a 1320px one. Past 1280px: four to a row, 1240px wall. Before this release
  a wide window just stretched the same two columns.
- **ONE MOTION SET.** `--sc-ease`, `--sc-ease-spring`, `--sc-ease-fast/mid/slow` live
  in `:root`; the tabs, the bubbles and the now chip read them. Transforms and opacity
  only - nothing in this release animates layout.
- **A NEW GATE ANSWERS FOR IT.** `dev/staircase-check.cjs` (36 checks) reads the
  contract out of `index.html`: the container is fixed bottom-right, the four tabs
  carry three different offsets plus the corner, the player height is measured rather
  than guessed, the old top band is gone, the wide rules exist, the motion set is one
  set, and the split tabs kept 80.0.4's cut. `dev/patch-gate-8005.py` writes it and
  adds it to the battery's EXTRA list. The battery is otherwise green.
- **THE CONVERTERS ARE NOT FIXED, AND THIS IS THE MEASUREMENT.** Both converters fall
  back to public CORS relays in a browser, and all three are dead from out here:
  `api.allorigins.win` **522 after 19.8s**, `api.codetabs.com` **a timeout at 25s with
  zero bytes**, `api.cors.lol` **429 rate-limited**. `fetchWithProxy` gives the whole
  walk an 8s budget, so the first dead relay eats it and the run ends in "no source
  found". On the phone this never mattered (Capacitor's native HTTP is not bound by
  CORS). The app's own backend is also not answering: `GET /health` is green
  (`spotify: true, proxy: true, po_token: true, provider_running: true`) but
  `POST /metadata` returns **500** `{"success":false,"error":"Failed: [object
  Object]"}` on three attempts five seconds apart - not a cold start, the handler is
  throwing - and `POST /download` returns **502/503** with an empty body. YouTube's
  InnerTube answers **403 "Sorry..."** to this machine, which is exactly why the
  backend needs its residential proxy and why a static relay cannot replace it. The
  fix is in `AnekTheGreat/SideCut-backend` (the exception is swallowed into
  `[object Object]`, and the instance is on a free tier that sleeps), not in the page;
  a page release that claimed the converters were fixed would be lying.
- **THE REPIN.** `dev/repin-8005.mjs`: the live pin moves 80.0.4 -> **80.0.5**,
  adjacency `PREV` moves 80.0.3 -> **80.0.4**, and the release-regex sweep now catches
  BOTH spellings - the `[.]`-class form most gates carry and the `\.`-escaped form in
  `album-follow-dock-check.cjs`, which 80.0.4's sweep left behind. 127 edits across 52
  gate files, `--check` clean in 0.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point in
  the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1** ("and it no longer fires
  every half hour"), the recorded pre-existing red this repository has carried for
  months. Everything else is green; `dev/gates-report.txt` in the release commit is
  the full list.
