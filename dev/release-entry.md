## 80.2.10 ({{STAMP}}): a new release announces itself once instead of every day, and the count is the list you can see

- **THE OWNER, AFTER A STRING OF RELEASES.** *"why does the new releases keep showing
  the new release every single friken day after the release came out I only need to see
  it once and it says +4 other releases when there is only 1 release in total fix this
  crap dude"*. Both halves are one bug with a long tail.
- **THE APP READ ITS OWN STORED ROW AS A NEW FIND.** `fetchArtistReleases` stores a
  one-track release under the SONG's name - every catalog files it as `<Song> - Single`,
  and the wrapper is dropped by `scSingleTitle` - but its catalog pass keyed the row on
  the CATALOG's name (`alb:<collectionName>|<day>`). The key it had just written never
  matched on the next pass, so the same single came back as "fresh" on every check:
  boot, the six-hour check, a return to the app, Fetch latest. Each run appended another
  copy to `pinnedReleases`, and each run had `totalNew > 0`, which is what fired
  `scReleaseAlert` again - the once-a-day announcement.
- **THE COUNT WAS THE RUN, NOT THE LIST.** `scReleaseAlert` was handed the raw finds of
  one run, capped at five and aggregated across every pinned artist, so one artist's
  single could be announced as `"Song" is out (+4 more)` while the panel - which
  de-duplicates by title and day and stops at a month - showed a single row. That is the
  "+4 other releases when there is only 1 release in total".
- **BOTH NAMES ARE KEYS NOW.** The stored-key set answers to a row's own title AND to
  the same title with the `- Single` wrapper folded away, and the catalog pass keys the
  drop the way it is stored (checking the catalog's name too, for rows an older build
  wrote). A drop already in the list is not added again, whichever name it arrives
  under.
- **THE ANNOUNCEMENT READS THE LIST.** `scReleaseAnnouncements` takes
  `window.__scReleaseList(31)` - the same de-duplicated, month-bounded list the Home
  bubble, the panel and the Discover section paint - and drops what has been read, what
  has already been announced, and what is still on the way. `scReleaseAlert` marks every
  row it announces as `alerted` and saves before it speaks, so no boot or check can say
  the same drop twice, and its `+N more` is the number of OTHER drops in that list.
- **THE COPIES LEFT BEHIND ARE COLLAPSED.** `scCollapseReleaseDuplicates` runs on load
  beside the junk prune: same normalised title (with the wrapper folded) and the same
  day is one row; a read or announced copy makes the survivor read or announced; and the
  artwork, link, preview and kind a later copy brought are kept. The copies earlier
  builds made on every check stop being counted anywhere.
- **THE BELL READS THE SAME LIST.** `hasLandedUnseenReleases` used to scan every stored
  row at any age, so a drop too old for the panel to show - and the copies of it - kept
  the badge lit for ever. It reads `__scReleaseList(31)` now, so the bell and the panel
  cannot disagree.
- **VERIFIED ON THE PATCHED PAGE, IN THE SESSION THAT WROTE IT.** A harness lifted
  `fetchArtistReleases`, `window.__scReleaseList` (block 2's), `scReleaseAnnouncements`,
  `scReleaseAlert`, `scReleaseKey`, `scCollapseReleaseDuplicates` and
  `hasLandedUnseenReleases` out of `index.html` and drove them against a fake Apple
  catalog: a second pass over the same catalog returns 0 finds and leaves the stored
  list at one row (it used to add a copy and report a new release); a row an older build
  stored as `Song - Single` is not re-added; four stored copies of one drop (two
  spellings, one four-hundred-days-old) collapse to two rows, of which only the recent
  one is announced - as `🎉 New release: Song — Test Artist`, with no `+N`; the announced
  row is marked, saved, and the next check announces nothing; the bell lights for the
  unread recent drop and not for a read one or one too old to be shown; and a genuinely
  new single is still found and announced once. All six inline script blocks compile
  with no syntax error, and `node dev/ota-bundle.mjs` builds the bundle from this page
  (6 notes, the entry below among them).
- **THE BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}} bytes, rebuilt to a true fixed
  point in the runner before this entry is written, and settled again by deploy.yml on
  the push. Both `--check`s green on the tree that ships.
- **WHAT ONLY A PHONE CAN SHOW.** The alert's Android shade path
  (`SideCutWidget.notifyProgress`) and the bell badge are driven by the same state the
  harness exercised; what is not exercised here is a real pinned artist whose catalog
  answers over the network on a device. Pin one artist, let a drop land, and the alert
  should appear exactly once.
