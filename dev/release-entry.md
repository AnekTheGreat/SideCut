## 83.2.7 ({{STAMP}}): A quiet refresh

- **WHAT CHANGED.** The version moves to 83.2.7 and the service-worker cache moves with it. Nothing in the app behaves differently, and there is no note to read: the changelog entry for this release is marked `silent`, so What's new stays shut and the notes for 83.2.6 do not come back with the new version.
- **WHY.** An update that only exists to refresh the cache should not announce itself. The version has to move for an installed copy to pick the bundle up, so what changed is the two numbers that make that happen and nothing else.
- **NOTE STYLE.** A release entry no longer opens with a quotation of the report that prompted it. It says what changed and why, in the repository's own words.
- **CHECKS.** `dev/patch-8327.py --check` exits 1 before the payload and 0 after it, and a second run is a no-op; the diff is `APP_VERSION`, one changelog entry marked silent, the two lines that keep that entry out of every notes surface, and the cache name. All script blocks of the patched page parse. Rebuilt bundles: {{ROOT}} bytes on the full channel, {{PLAY}} on the store build.
- **NOT CLAIMED.** No phone has booted 83.2.7. What is proven is that the page carries the silent entry and that no notes surface can show it.
