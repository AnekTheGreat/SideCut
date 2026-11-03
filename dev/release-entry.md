## 80.7.12 ({{STAMP}}): songs when you search

- **WHAT THE OWNER SAID.** *"THE STREAMING IS NOT GIVING ME ANY SONGS AT ALL. MAKE GET SONGS EASIER TO USE."* The search was not
  slow, it was closed, and the measurement says so rather than the guess.
- **THE ONE ROAD OUT WAS A POST THE PAGE CANNOT MAKE.** `scYtSearch()` calls the player's search through `scHttpJson()`, which
  asks the **native bridge** first and then the **page fetch** - there is no third road. A browser refuses that POST to
  `youtube.com` on CORS, so the call resolves to `null` and the shelf printed *Nothing found for that* for every query. The POST
  itself is alive: run from a server it answers **200, 1.33 MB, 20 `videoRenderer` rows** (measured this session), which is why
  the same code works on a phone with a working bridge and nothing else.
- **PROXYING THE RESULTS PAGE WAS MEASURED, AND REJECTED.** The app already knows three CORS proxies; when this was written
  **allorigins answered 522, codetabs 522, cors.lol 429**, so routing the results page through them would have replaced one
  silent failure with another. The open catalogue (`archive.org/advancedsearch.php`) answered **200 with
  `access-control-allow-origin: *`**, so that is the road the fallback is built on: a plain GET, no key, no bridge, no proxy.
- **A SEARCH NOW ANSWERS.** `scStreamSearchRun()` asks the player first, because that is the whole catalogue; if it comes back
  empty or throws, `scStreamArchiveSearch()` asks the open catalogue before the owner is told there are no songs. The shelf says
  which catalogue answered (`12 found · the open catalogue`), so the two are never confused. An archive row carries `ia:<id>`,
  `scStreamResolve()` routes it to `scStreamArchiveResolve()` (metadata -> the item's own mp3, or any audio it has), and its cover
  comes from the archive's own image service - so those rows play from the archive with no key at all.
- **AND GET SONGS MEANS GET SONGS.** The button now says **Get songs** instead of Search, the field says *Type a song or an
  artist*, the results header shows how many were found and where from, and **Add all** puts every one of them on the shelf in one
  tap through the same path a single Add uses - so a duplicate is still refused and the count reports only what really landed.
  Twelve taps to fill a list was a large part of why the shelf looked empty.
- **WHAT WAS RUN.** `dev/patch-80712.py` over the released 80.7.11 page: `--check` **1** before, **11 steps** applied, a second
  run a no-op, `--check` **0**; both channels rebuilt to a true fixed point. `dev/check-80712.cjs` on the shipped bytes, and the
  search is **driven** five ways: the player answers (its rows are the results and the catalogue is never asked); the player
  returns null (the catalogue fills the shelf and says so); both return nothing (the line names the failure); the player throws
  (the catalogue still answers); an empty query says what to do. `scStreamAddAllResults()` is driven too: three results add three
  songs and clear the results, two duplicates add none and say they are already there, and an empty shelf says to search first.
  The open catalogue path was also exercised from this machine: search **200** with three docs, metadata **200** for the first
  item, four audio files listed in it. Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone in this environment, so nobody here has played an archive row on a device, and the coverage of the
  open catalogue is not the player's: it is a fallback for when the player cannot be reached, not a replacement for it. What is
  verified is that a search now returns rows through a road measured open today, that those rows resolve to real files, and that
  Add all fills the shelf in one tap.
