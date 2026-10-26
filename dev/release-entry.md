## 80.3 ({{STAMP}}): the announce-once fix, under the number it should have had

- **THE OWNER, ONE LINE.** *"v80. 3 NEVER. 0.10"*. The release that fixed the daily
  release alert shipped as **80.2.10**, and 80.2.10 breaks the rule the page has stated
  above `APP_VERSION` since 60.1: *"the third number stops at nine: 60.0.9 is followed by
  60.1 (never 60.0.10)"*. This repository has already paid for that mistake once - 80.1
  exists only because 80.0.10 was shipped and had to be renumbered.
- **SO THIS RELEASE MOVES THE NUMBER, AND ONLY THE NUMBER.** `APP_VERSION` 80.2.10 ->
  **80.3**, the changelog head's version and stamp, every code comment that carried the
  old label (seven of them), and the shell cache `sidecut-shell-v80.2.10` ->
  **`sidecut-shell-v80.3`**. The whole diff is 19 lines of `index.html` and one of
  `sw.js`: the announcement block, the key fix, the collapse and the bell are
  byte-for-byte what 80.2.10 shipped.
- **NO ORPHAN ENTRY.** The 80.2.10 changelog entry is not kept under a number that the
  page's own rule forbids - it becomes the 80.3 entry, so the list reads 80.3, then
  80.2.8, exactly as 80.1 absorbed 80.0.10. The adjacency anchor stays **80.2.8**,
  because that is the release before this one.
- **THE NOTE LEADS THE ITEMS.** One bullet says why the number moved ("the third number
  stops at nine... the app only moves forward, so the number is how it reaches you"), and
  it is the FIRST bullet on purpose: the OTA update card carries the first six notes, and
  a phone coming from 80.2.10 should see the explanation, not six notes it has read
  already.
- **WHAT THIS RELEASE STILL CARRIES** (the work the owner asked for in the previous
  number): a drop from a pinned artist announces itself **once** - the catalog pass keys a
  one-track release by the name it is stored under, so the app can no longer read its own
  stored row as a brand-new find every check; the alert is taken from
  `window.__scReleaseList(31)`, the same de-duplicated month-long list the panel paints,
  with each announced drop marked `alerted` and saved; `scCollapseReleaseDuplicates`
  clears the copies earlier builds stored on load; and `hasLandedUnseenReleases` reads
  that same list, so the bell and the panel cannot disagree.
- **VERIFIED.** `dev/patch-803.py --check` is clean on the tree that ships, and the whole
  page diff against 80.2.10 is the version constant, the changelog head and note, and the
  seven comments - no function body changed, which is why the behaviour harness that
  wrote the previous release still describes this page. All six inline script blocks
  compile with no syntax error, and `node dev/ota-bundle.mjs` builds a bundle from this
  page with the renumber note first in its six.
- **THE BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}} bytes, rebuilt to a true fixed
  point in the runner before this entry is written, and settled again by deploy.yml on
  the push. Both `--check`s green on the tree that ships.
- **THE LESSON, AGAIN, WHERE THE NEXT SESSION LOOKS.** A version is not a label chosen at
  the end. The page states its own rule above the constant - read it before the payload is
  cut, not after it ships, and do not need the owner to say the number down the wire.
