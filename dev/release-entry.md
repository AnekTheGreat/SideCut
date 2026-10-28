## 80.5 ({{STAMP}}): the converters leave the web page, and the full web app gets its own link

- **THE OWNER'S ASK, VERBATIM.** *"have the converters only on the full build apk version not web
  version either, make a seperate web version with the converters on a different URL with full attached
  to it"*. Three builds, spelled out: the **full APK** keeps every converter; the **web page** is now the
  files-you-own build; and the same web app **with** the converters lives at **`/full/`**.
- **NO SECOND HIDER WAS WRITTEN.** Since 60.5 the page has already shipped as two builds from one file:
  CI injects `window.__PLAY_BUILD__` into the store AAB and the page then removes `convToolsCard`,
  `spCardDisc`, `ytCardDisc` and the Settings copies, rewrites Discover's how-to and gates around twenty
  entry points on `SC_IS_PLAY`. This release makes `SC_IS_PLAY` mean what every one of those gates has
  always read it as - *this build offers no converter* - and makes a plain web page qualify. One
  definition rather than twenty edits, and the web page inherits a removal path that has shipped for
  months instead of a newer one that has not.
- **THE STORE BUILD KEEPS ITS OWN FLAG.** Billing, the `ota-play/` update channel and the Play label are
  properties of the copy Google Play distributed, not of "no converters", so they move to
  `SC_PLAY_NATIVE` - the injected flag itself. Without that split, dropping the tools from the web page
  would also have dropped its card-page tips and pointed it at a bundle it does not have.
- **THE INSTALLED APP IS NEVER A WEB PAGE.** The WebView serves the bundle from `https://localhost`, so
  "is this the web" cannot be the protocol. It is `Capacitor.isNativePlatform()` first, then the host:
  loopback, an IP literal or a `.local` name is a machine talking to itself (a local preview) and keeps
  the tools. A context that cannot answer keeps them too, on purpose - a player that quietly loses its
  converter is the one outcome this must never produce.
- **`/full/` IS A DOOR, NOT A SECOND COPY.** `full/index.html` is served beside the app and replaces
  itself with `../?full=1` on load, so the converters cost about 6 KB of HTML instead of a duplicate
  3.7 MB page that every release would have to keep in step. `?full`, `?full=1`, `?build=full` and a
  `/full/` pathname are all accepted. With the script off, the page is a readable splash with the same
  link. `location.replace` keeps the door out of the history, so Back leaves the app rather than
  bouncing through it.
- **THE WEB PAGE SAYS WHERE THEY WENT.** A page that silently drops a menu reads as broken, so Discover's
  how-to gains one card: *"Converters are not part of the web page"* with a link to `/full/`. Only the
  web page renders it — an installed store build never points at a converter, not even with a link.
- **THE VERSION LINE NAMES THE BUILD.** *Full*, *Play* or *Web*, because "my converter is missing" is a
  question about which build is installed. `Web build — your files only` and `Web build — full` are the
  two web answers.
- **VERIFIED ON THE PAGE THAT SHIPS.** Applied to a fresh clone of `origin/main` at 80.4: `python3
  dev/patch-805.py` (1 step), then `--check` (0 steps); every inline script block parses; `sc-805-check.cjs`
  passes and fails on the 80.4 page it replaces. It runs the page's OWN switch — extracted verbatim from
  the page and evaluated in a `vm` — for seven contexts: the site root (**no tools**), `?full=1`
  (**tools**), a `/full/` path (**tools**), the installed app on `https://localhost` (**tools**), the
  store build (**no tools**), a local preview on `localhost:3000` (**tools**) and a `file:` page
  (**tools**). It then runs the web note against a stub DOM and checks the card it appends names `./full/`,
  and runs `changelogRich` / `changelogTitle` for both builds: the no-tools builds show the two notes that
  changed for them and none of the `[FULL]` ones, while the full build shows all four with the marker
  stripped. OTA: `ota/` **{{ROOT}}** bytes and `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.5,
  with the Play channel's notes free of any converter note.
- **WHAT IS NOT CLAIMED.** No browser was driven and no phone was used: `/full/` was checked over HTTP
  (a 200 with the redirect and the no-script link) and the page's logic was checked in a `vm`, not by
  clicking through the app. No Android build was made - the APK, the widget and the native code are
  untouched, which is exactly why the switch keys off the environment rather than the bundle. The
  converters themselves are unchanged: the same cards, the same encoders, the same downloader, on the
  same page, one word apart.
