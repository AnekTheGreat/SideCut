## 80.7 ({{STAMP}}): collabs filed under the other artist, a fake release you can delete, and the reorder sheet in two seconds

- **WHAT THE OWNER SAID.** *"there's no way to tell if an artist had a collab with another artist and its under the other
  artists name ... Daddy yankee had a collab with Diljit dosanjh and it didn't show up in new releases like it should have,
  make that possible and make it possible in new releases to delete fake songs by holding down on them for 2 seconds and
  hitting delete, make the reordering songs in album delay 2 seconds for the popup instaid of 3 and make that better"*
  Three asks: a collaboration has to be findable from either artist, a wrong release has to be deletable on purpose, and the
  album reorder sheet has to open a second sooner - and open better than it did.
- **WHY THE COLLAB WAS MISSING.** `fetchArtistReleases` compared **the first name of a credit** with the pinned artist:
  `primaryArtistName(r.artistName)` against `primaryArtistName(artist)` for songs, and the same first-name test
  (`__scSameArtistName(rArtist, pArtist)`) for albums. `primaryArtistName` splits on `,`, `&`, `feat.`, `ft.`, `vs.` and `x`
  and keeps only what comes before the separator - it answers "whose name is printed first", not "who is on this record". A
  collaboration is filed under one artist and credited to both: Apple returns that Daddy Yankee single with
  `artistName: "Daddy Yankee & Diljit Dosanjh"`. Pinning Diljit Dosanjh, the row was **in the results, credited to him, and
  thrown away because he was not first** - so the release never reached the list, and no amount of re-checking would find it.
- **WHAT CHANGED FOR THE COLLAB.** Two helpers next to `primaryArtistName`: `scCreditNames(credit)` splits a credit into
  every name it carries (comma, `&`, `;`, `/`, `with`, `feat.`, `ft.`, `featuring`, `vs.`, `and`, `x`, `×`), and
  `scCreditHas(credit, artist)` asks `window.__scSameArtistName` of each name - so any credited artist is enough, while the
  existing name test still refuses "Karan Aujla Tribute Band" for Karan Aujla and a remix album is still not his drop. Both
  passes use it now: the `entity=song` search and the `entity=album` search. `primaryArtistName` and
  `__scSameArtistName` stay where a lead artist is genuinely what is wanted.
- **WHY THE OLD DELETE WAS WRONG.** The Discover list dropped a row on a **~600ms** hold. That is one accidental press away
  from a tap, it never asked, and it looked the release up in the single artist key the row was painted from - `pinnedReleases[artist]`
  - which is exactly the wrong place for a collaboration, because the same drop is stored once per pinned artist that shares
  it. Deleting one copy would have brought the row straight back on the next paint.
- **WHAT THE DELETE IS NOW.** A release is deleted on purpose. `scWireReleaseHold()` is one delegated hold - installed once,
  not once per row per paint - over the three surfaces that draw releases (`.new-release-row` in the Discover list,
  `.hb-track-row[data-date]` in the Home bubble, `#discPopupBody .dp-track[data-title][data-date]` in the Fetch latest popup),
  reading the title, day and artist off the attributes every builder already writes. Two seconds, unmoved (a 12px move is a
  scroll and cancels), then `scRelAskDelete()` names the drop and offers **Delete** and **Keep**. Delete goes through
  `scRelDelete()`, which finds **every stored copy** through `scReleaseKey` and removes all of them, repaints the list, Home,
  the open panel and the bell, and offers `toastWithUndo` to put the copies back under the keys they came from. A row that is
  not in the stored list - a search result, a catalog row - has nothing to delete and the hold does nothing. The click the
  press ends with is swallowed in the capture phase, because otherwise it opens the release page over the sheet.
- **WHY THE SHEET FELT BAD, AND WHAT CHANGED.** Two holds open "Reorder Songs" and both were three seconds: the per-row
  `wireAlbumRowHold` (its own 3000ms timer, plus a 2800ms release gate for a press Android cancels) and the delegated
  `__albumSongHoldWired` block (`HOLD_MS`/`RELEASE_MIN_MS`). Both are **2000 / 1800** now, and the three help sentences that
  promised three seconds say two. The "make that better" is the second half: the sheet builds from the top of the album, so
  holding the twelfth song opened a list that did not show it and the row had to be hunted for. Both holds now pass the held
  row's id to `showAlbumReorderPopup(albumName, focusTrackId)`, and the sheet scrolls that row into the middle of its own
  pane (`listEl.scrollTop`, never `scrollIntoView`, which lifts the whole app on Android) and lights it for 900ms.
- **WHAT WAS RUN.** `dev/patch-807.py` (with the page block it loads from `dev/patch-807-blocks.py`) over the released 80.6.32 page: `--check` **1** before, **23** steps applied (the
  version, the credit helpers, both passes, the row's day attribute, the delete helpers, the retired 600ms hold, six album
  hold timings and their comments, the sheet's focus, the comment, the three help sentences, the changelog), a second run a
  no-op, `--check` **0**. Then the workflow's fixed-point loop (`cp updates.json manifest.json`, `node dev/ota-bundle.mjs`,
  `node dev/ota-bundle-play.mjs`, both `--check`s) until it settled, `python3 dev/release-record.py`, and
  `dev/check-807.cjs` - which **runs** the two new behaviours rather than reading them: the credit test against real
  collaboration strings (`"Daddy Yankee & Diljit Dosanjh"` found from either side, with a comma, `feat.`, `ft.` and `x`, and
  still refusing a tribute band), and the delete against a drop stored under **two** artist keys (both copies gone, written
  once, every surface repainted, Undo putting both back in date order, an unknown title deleting nothing). OTA at a true
  fixed point - root + `ota/` **{{ROOT}}** bytes at v80.7, and `ota-play/` (**{{PLAY}}** bytes) at v80.7.
- **NOT CLAIMED.** No phone and no browser here: nobody has held a release for two seconds, pressed Delete, or opened the
  album sheet from the twelfth song. What is proven is the shape and the logic of the two new behaviours, that the CSS and the
  code are in the page **and** inside the Play zip, that both manifests are v80.7 with these notes, and that all seven
  inline scripts compile. Whether a real catalog even returns that Daddy Yankee single for a Diljit search is the network's
  question, not this page's: what changed is that when it does, it is no longer discarded for being credited second.
  `dev/check-8062{6,7,8,9,30,31,32}.cjs` now fail by design; each pins its own version and they are left as they were.
