## 80.6.30 ({{STAMP}}): the Play build catches up

- **WHAT THE OWNER SAID.** *"Lift the channel hold so the Play build publishes everything since 80.6.12, minus the streaming
  and downloader copy."* One line, and it is a decision only he could make: the hold was his.
- **WHY THIS IS A RELEASE AND NOT A FILE DELETION.** Both channels version off the same `APP_VERSION` in `index.html`, and
  `dev/ota-bundle-play.mjs --check` fails unless `ota-play/updates.json` carries that same version. `ota-play/` was at 80.6.12,
  and 80.6.29 was already published on the other channel - so deleting the hold on its own would either leave the Play bundle on a
  version nobody released or, worse, republish 80.6.12's bundle as if it were the page. The page moves to a version neither
  channel has shipped (80.6.30), the hold is deleted in the same commit, and the release step's fixed-point loop rebuilds
  `ota-play/` from the page at that version. Nothing about the page's behaviour changes.
- **WHAT CHANGED.** (1) `APP_VERSION` is `80.6.30`, with a changelog entry titled *The Play build catches up* - four notes, three
  of them true of both builds and one `[FULL]`, and the catch-up note itself published on both channels. (2) **The hold is
  lifted**: `dev/channel-hold.json` is deleted. The script still reads the file, so a future hold is data again - set `"play": true`
  with a `why`, and the next release leaves `ota-play/` alone and says so. (3) **`ota-play/` publishes 80.6.30** for the first
  time since 80.6.12, with the Play flag baked into the zip's page, and with the notes filtered the way the app filters them (the
  `[FULL]` note and anything about the downloader, the converter or the source are dropped, and the channel publishes three).
- **THE 80.6.29 ENTRY WAS WRONG ABOUT THIS, AND THIS IS THE CORRECTION.** It said the `ota-play/` channel had been "rebuilt from
  the same page". It had not: the channel was held, `dev/ota-bundle-play.mjs` left `ota-play/` exactly as it was, and the
  duplicated 1138844 bytes in that entry were the held 80.6.12 bundle, not a rebuild. The dock pill and the glass rail were always
  going to reach the Play build through the page - the platform gate is `SC_STREAM_OK`, and the rail card hides itself when it is
  false - but a Play install could not see any of it until the channel published, which is what this release does.
- **WHAT THE PLAY BUILD ACTUALLY GETS.** The same page the sideload build has had since 80.6.29, with the Play flag set: one
  Library pill in the dock, no split setting (that card became the rail's), the rail absent and its Tools card hidden because
  `SC_STREAM_OK` is false, the library's own Albums tab and playlists untouched, and the changelog showing every entry since
  80.6.13 with the notes that belong to it. It is a jump of seventeen releases for anyone on that channel - the largest single
  update it has ever taken - which is worth saying plainly rather than as a small note.
- **WHAT WAS RUN.** `dev/patch-80630.py` over the released 80.6.29 page: `--check` **1** before, three steps applied (version,
  changelog entry, hold), a second run a no-op, `--check` **0**. The whole release was then rehearsed in a clean copy of the
  released tree before shipping: patch, then the workflow's own fixed-point loop (`cp updates.json manifest.json`,
  `node dev/ota-bundle.mjs`, `node dev/ota-bundle-play.mjs`, both `--check`s) until it settled, then
  `python3 dev/release-record.py`, then `dev/check-80630.cjs` - which opens `ota-play/update.zip` and proves the page inside it is
  80.6.30, carries `__PLAY_BUILD__`, still has the one Library pill, and still returns before building the rail. OTA rebuilt to a
  true fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.30, and `ota-play/` (**{{PLAY}}** bytes) published at v80.6.30,
  no longer held.
- **NOT CLAIMED.** There is no phone and no browser here, so nobody has watched a Play install take this update. The store's own
  review path is not something a bundle in a git repository can prove: what is proven is that the channel's manifest and the page
  inside its zip agree at 80.6.30, that the page in it is a Play build, and that its notes are the ones this build publishes.
  `dev/check-8062{6,7,8,9}.cjs` now fail by design - each pins its own version - and are left as they were.
