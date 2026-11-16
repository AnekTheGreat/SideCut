## 84.1.3 ({{STAMP}}): the version, the cache and the notes move to 84.1.3

A version-only release, cut the same way 84.0.0 was: `const APP_VERSION` in
`index.html`, the `sidecut-shell-v` name in `sw.js`, the first entry in the
release-notes array and `updates.json` all move from 84.1.2 to 84.1.3 together, and
nothing a user can see changes. The point is that the number the app reports, the
cache it installs offline and the notes it shows are the same number, and that the
OTA bundles carry it.

`dev/patch-8413.py` touches exactly three things: the version line, the cache name,
and one new entry prepended to the notes array (`updates.json` is rewritten from the
same notes). Its anchors are the version line and the 84.1.2 notes entry, each
matched exactly once - the guard that stops a release landing on the wrong build.

Bundles on this release: `ota/updates.json` {{ROOT}} bytes, `ota-play/updates.json`
{{PLAY}} bytes. Page-only: no native change, so the APK is not rebuilt.
