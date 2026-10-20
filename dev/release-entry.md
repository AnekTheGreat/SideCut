## 75.1.1 ({{STAMP}}): 75.1 re-cut as 75.1.1, and the legacy root update path points at the real bundle

- **THE OWNER ASKED FOR THIS RELEASE AS 75.1.1.** The app already states the
  rule: `72.5.1` adds a fourth number for a fix shipped inside a release,
  because the updater compares the numbers one at a time. `75.1.1` is that
  shape for 75.1, not a new series.
- **THE VERSION AND THE SHELL MOVE.** `APP_VERSION` is `75.1.1` and the service
  worker cache is `sidecut-shell-v75.1.1`, so an install that already has the
  75.1 page cached sees a build newer than itself and cannot keep serving the
  old page from its offline copy. `dev/repin-7511.mjs` moved every gate pin that
  names the live build; the historical release literals in `test-70` (70.0),
  `test-736` and the older suites were left alone, and the series pin already
  accepts `/^75\.\d+(\.\d+)?$/`.
- **THE ONE REPAIR: THE ROOT MANIFEST NAMED A FILE THAT DOES NOT EXIST.** The
  repository root carries `updates.json` and `manifest.json` for older clients.
  Both said `url: "update.zip"`, which a client resolves to `/update.zip` - and
  the repository has never published a root zip (Pages answered 404; the real
  bundle is `ota/update.zip`). `dev/ota-bundle.mjs` now writes the root copy
  with `url: "ota/update.zip"`, so the legacy location and the published bundle
  cannot drift apart again. The OTA copies in `ota/` and `ota-play/` keep their
  sibling `update.zip` URLs; those resolve inside their own directories and were
  already correct.
- **THE GATE.** `dev/legacy-update-check.cjs` reads the shipped root manifests,
  resolves the URL the way a client does, and requires a real zip of the size the
  manifest promises; it also proves `ota/updates.json` still names its sibling.
  It is wired into the OTA arm of `dev/gates.sh` by `dev/patch-gate-7511.py`.
- **THE CARRIED 6139 RED IS REPINNED, NOT WEAKENED.** `test-6139` pins the
  number of `__scJunkTitle` references so a second hand-rolled junk test cannot
  appear beside the shared one. The tree has 25 references (one definition and
  24 call sites); the gate still expected 23 from 73.9. It now expects 25 and
  says why; the exact-count rule and its purpose are unchanged.
- **NO APP BEHAVIOUR CHANGED.** The Ask SideCut overlay on the listening-stats
  bubble, the album planner, Undo, the player, the home widget, the lyrics, the
  albums, the playlists and every stored setting are exactly 75.1. The release
  exists to move the version and repair the legacy update path.
- **OTA.** The root bundle is `{{ROOT}}` bytes and the Play channel is
  `{{PLAY}}` bytes, both rebuilt to a fixed point before the battery ran.
- **NOT VERIFIED ON A PHONE.** The gates drive the shipped page in jsdom; the
  real test is one Check for updates on an install that still has 75.1.
