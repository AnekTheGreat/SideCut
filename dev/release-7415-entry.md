## 74.1.5 ({{STAMP}}): the top-artists bubble opens the artist, and the storage cleaner shows every size in MB

- **The ask, in one line**: an artist in the home Top artists bubble should open when you tap their song, every song should say how big it is in MB, and Studio's storage cleaner should
  say it too. The three land together because that bubble's rows were the only list on the home screen with NO click handler at all - an artist could be read and never be opened.
- **THE PAGE SHIPPED FROM INSIDE THE REPOSITORY, AND FROM NOW ON IT CAN ONLY SHIP FROM THERE.** `index.html` is ONE 3.24 MB file, and the machine that prepares a release has no git
  credentials and cannot push a file that size - the API carries whole files as call arguments, at any encoding. So the release is a payload plus a workflow:
  `dev/7415-payload.tar.xz.b64` carries `dev/patch-7415.py` (the page edits; idempotent, and `--check` says whether the page is behind) and `dev/repin-7415.mjs` (the gate repins);
  `.github/workflows/apply-page-patch.yml` unpacks them, applies them over the checked-out tree, proves the result against `dev/release-7415.sha256` byte for byte, runs the battery and
  the bundle `--check`s, and only then commits. **This is the first release that could be cut from a host with no credentials at all.**
- **A WORKFLOW CANNOT PATCH A WORKFLOW, AND THE FIRST PUSH OF THIS RELEASE PROVED IT.** Run 38657960997 of `apply-page-patch.yml` passed its first eight steps - payload intact,
  page patch applied, repins applied, and **the whole 50-file tree matching `dev/release-7415.sha256`** - and then failed in the retarget step, whose own work was correct and whose
  *guard* was not. The guard asked `git diff --name-only` what had moved and required the answer to be exactly the two gates, but the tree it runs on already carries the page patch and
  every repinned gate UNCOMMITTED, so the answer was all fifty files. It now measures what **this step** moved: the whole diff EXCLUDING the two gates is hashed before and after and has
  to be bit-identical, and both gates have to differ. Fixing it from inside the repository is impossible and that is a platform rule, not a bug: the Actions token is refused
  (`refusing to allow a GitHub App to create or update workflow ... without 'workflows' permission`), so **any release step that would commit a file under `.github/workflows/` can never
  push.** The commit's own path allowlist admitted `.github/`; it does not any more, because that is a release that can only fail at the last step.
- **TWO GATES WERE ASKING THE HEAD FOR AN OLDER RELEASE'S WORDS, AND WERE RETARGETED BY HAND.** `dev/test-740.mjs` (74.0) and `dev/test-741.mjs` (74.1) each held the HEAD changelog
  entry to the words of the release they describe. The repin moves the head pin under them every release, so at 74.1.5 they were asking THIS release's notes (the artist bubble, the
  storage cleaner) for the last two releases' words: **test-740 52/1 and test-741 84/1 on the tree as it was prepared.** Each now finds the entry for ITS OWN version and asserts against
  that - the same fix 71.8 gave test-705, and the rule this file already carries: **a gate that describes a release must read its own entry by version.** Nothing was weakened: 74.0's notes
  still have to name the skip and the album, 74.1's still have to name the back roll and the restored play, and each file gained one check that its own entry is still in the changelog at
  all. **The prepared release was red before this; it is green after.**
- **THE OTA BUNDLE IS AT A TRUE FIXED POINT.** The zip embeds the root `manifest.json` and that manifest records the zip's own size, so the bundle needs a pass to agree with itself:
  publish the measured size into the embedded manifest, rebuild, repeat. Root `ota/update.zip` **{{ROOT}}** bytes and the Play channel `ota-play/update.zip` **{{PLAY}}** bytes, both
  v74.1.5, both `--check`s OK, and the eight bundle files the last release touched are the eight this one touches. `deploy.yml` then finds nothing to publish, which is what a landed
  release looks like.
- **This entry ships as `dev/release-7415-entry.md`**, with `{{STAMP}}`, `{{ROOT}}` and `{{PLAY}}` filled in by the workflow at commit time, so the release's prose is a file of its own
  rather than a nine-kilobyte string literal inside the workflow that runs it.
- **Gate set**, on the prepared tree: test-740 **54/0** and test-741 **86/0** (one new check each, from the retarget above), test-7251 110, test-7316 284, studio-70 397, the eight album
  suites (58, 45, 25, 40, 34, 42, 34, 22) all 0-fail, crossfade-pause 22, compress-library 24, export-playlist 36, refresh-pin 14, widget-resume 33, background-playback 21, audio-focus
  44, librarytools 15, notifgroup 27, audit-calls OK, check-dom 0 failures, OTA trio 20/52/24. 46 suites green.
- **STILL RED, PRE-EXISTING AND UNCHANGED**: `media-controls-check` **66/1** - the months-old "fires every half hour" red that 74.1's entry already records at 66/1, and the same single
  failure on a pristine clone of `main`. It is the only red in `dev/gates.sh` and this release does not touch it. `Build Android (Capacitor) AAB` has been red on **every** push since
  `55920183` (73.6, Oct 10) in `cd android && ./gradlew bundleRelease`; the only Android input 73.6 changed was `.github/workflows/patch-audiofocus.py`, and this release does not touch
  the Android build at all.

