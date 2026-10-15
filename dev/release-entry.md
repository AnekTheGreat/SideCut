## 74.1.6 ({{STAMP}}): a song in the storage cleaner opens its own bubble

- **The ask, in one line** (from a screenshot of Studio on the phone): *"I should be able to click on the name of the song and the bubble for it pops up showing the mb and full
  artist name."* The row it pointed at read `Karan Aujla, Mxrci, Seshnolan ...` and `Alka Yagnik, Illa Arun · 19.7 MB...` - both clipped, because a cleaner row is ONE line of a
  24-row list with a Re-encode button at the end of it.
- **What the bubble shows**: the whole song name and every artist in full, the exact size on this phone in MB, the length, the album when the song has one, how many kbps the file
  reads at (bytes x 8 / seconds - nothing here trusts a tag, because a tag can say anything), and what the button beside the row would win at the bitrate already chosen above:
  `wins back 1.6 MB`, or plain `nothing to win` when the file is already at or under that rate.
- **THE ROW IS A DOOR NOW, AND THE DOOR IS A BUTTON.** The cover, the name and the line under it are one `<button data-act="storeinfo">` with `aria-expanded`, so a keyboard and a
  screen reader reach it and the tap a person aims at the song name lands on the song. The Re-encode button is a second control beside it and keeps its own job - the tap never
  swallows it. One bubble at a time: tapping the same row closes it, tapping another moves it. The bubble is the row's immediate next sibling in the cleaner list, which is what makes
  it read as hanging under that row.
- **WHY THE BUBBLE IS THE ONLY PLACE THOSE TWO THINGS CAN BE READ.** `.sc-store-name` and `.sc-store-sub` clip with `text-overflow: ellipsis` on purpose; `.sc-info-name` and
  `.sc-info-artist` set `white-space: normal` and never clip. That pair of rules IS the feature, so the gate checks the stylesheet and not only the text - jsdom has no layout, and a
  `textContent` check cannot see an ellipsis.
- **THE GATE DRIVES IT, IN `dev/studio-70-check.cjs` BLOCK [6b].** It makes one song's credit a six-name string and its file 4 MB, then: taps the row, reads the bubble, and holds it
  to arithmetic computed in the test itself rather than to the app's own formatter (4.0 MB, 2:37, about 214 kbps, `wins back 1.6 MB at 128 kbps`); checks the row clips and the
  bubble does not; closes it; moves it to another song; and clicks the Re-encode button to prove the tap target did not eat it. 27 new checks, 425 in the file, all green.
- **THE RELEASE ORDER BUG THAT COST 74.1.5 SEVERAL RUNS IS FIXED AND RECORDED.** `dev/ota-update-check.cjs` asserts the tree's OWN bundle is already on `index.html`'s
  `APP_VERSION`, and the release rebuilt the bundles AFTER the battery - so every run died on that one suite ("manifest v74.1 vs APP_VERSION v74.1.5") and passed 52/0 re-run alone,
  because that suite regenerates the bundle itself and leaves the tree fixed for the next reader. The rebuild now runs BEFORE the battery, because the battery has to measure the tree
  that gets committed. It was never a flake.
- **THE RELEASE MACHINERY IS GENERIC NOW.** `dev/release-gates.sh` (the battery and its report), `dev/release-record.py` (the AGENTS.md insert, idempotent, version read from the page)
  and `.github/workflows/release.yml` are shared by every release; a release supplies its own `dev/patch-<ver>.py`, `dev/repin-<ver>.mjs`, `dev/release-<ver>.sha256` (the proof of the
  prepared tree, byte for byte) and this entry. The 74.1.5 workflow is left where it is and finds no payload, so it does nothing.
- **BOTH CHANNELS SHIP TOGETHER**: `ota/update.zip` and `ota-play/update.zip` are rebuilt from this page to a true fixed point (the zip embeds the root `manifest.json`, which records
  the zip's own size), at {{ROOT}} bytes for the sideload channel and {{PLAY}} for the Play one, and the page inside each carries `APP_VERSION` and, for Play, `__PLAY_BUILD__`.
- **ONE RED IS RECORDED AND NOT FIXED**: `dev/media-controls-check.cjs`, "and it no longer fires every half hour", 66 passed / 1 failed - the same single failure a pristine clone of
  main reproduces. Every other suite is green, and the release's own report is committed at `dev/gates-report.txt`.
- **Nothing else moved**: the player, the albums, the home widget, the letter-by-letter lyrics and every saved song and setting are where 74.1.5 left them.
