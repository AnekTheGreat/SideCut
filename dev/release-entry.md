## 83.2.8 ({{STAMP}}): The example comes out

- **WHAT CHANGED.** An earlier release note explained a fix by naming a real act beside the one that had been pinned. That example is gone: the line now says what changed without naming anyone, and the rest of the entry is untouched.
- **WHY.** A note that carries a stranger's name turns a fix into a story about them. The note should describe the app.
- **HOW IT ARRIVES.** The version moves to 83.2.8 and the service-worker cache moves with it. The changelog entry for this release is marked `silent`, so What's new does not open and no note is shown.
- **CHECKS.** `dev/patch-8328.py --check` exits 1 before the payload and 0 after it, and a second run is a no-op; the diff is `APP_VERSION`, one silent changelog entry, one rewritten line inside the 83.2.6 items, and the cache name. All script blocks of the patched page parse. Rebuilt bundles: {{ROOT}} bytes on the full channel, {{PLAY}} on the store build.
- **NOT CLAIMED.** No phone has booted 83.2.8. What is proven is that the page no longer carries the named example and that the silent entry reaches no notes surface.
