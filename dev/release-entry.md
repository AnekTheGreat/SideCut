## 81.2 ({{STAMP}}): your albums, not the tags on your files

- **WHAT THE OWNER SAID.** *"THESE ARENT MY ACTUAL ALBUMS DAWG FIX THIS AND FIX THE VERSIINS THERE ARE NEVER . 11 OR
  . 12 ECT..."* - sent with a photograph of the phone: a sheet headed **All Songs and an album** listing *Bambiha Bole
  (feat. Sidhu Moose Wala)*, *BATIDAO FUNK*, *Beeper Funk (Super Slowed)*, *Bermuda Triangle*, *Best Of Arijit Singh -
  Revisited*, *BK Songs*, *BLACK NIGGA*, *Blue Eyes*, *Bobby*, *Bollywood Best Duet Songs Sonu Nigam,Shrey...*, *BOUNCE FUNK
  (Slowed)*, *Brown Munde*: alphabetical, plain, no counts, and not one album the owner had made.
- **THE LIST WAS TAGS, NOT ALBUMS.** `scStreamDownloadPick(id, 'al')` built its list by walking every track and collecting
  `String(t.album)` - the album **tag** on each file - then sorted it and offered the first forty. A tag is whatever the
  file's source says it came from: a single, a compilation, a playlist burned into a tag, *BK Songs*. So the sheet offered
  names that had no album behind them, and the albums the owner had actually made were not in the list at all. The
  photograph is exactly that: the names are tags, which is why they are alphabetical and bare.
- **WHY IT SURVIVED.** This is the bug the Albums page fixed for itself years ago - the comment on its cards says they come
  from `userAlbums` only, because one card per album tag "listed albums the user never created". The *Add to an album* sheet
  was taught the same lesson in 80.10. The *All Songs and an album* sheet, one file away and reached from the same menu, was
  never touched, so the tag scan lived on in the one place nobody was looking.
- **THE FIX.** The album branch reads `scStreamDeviceAlbums()` - `visibleAlbumNames()` through `scAlbumCardOrder`, each
  name's `trackIds.length` beside it, empty albums dropped - which is the very list the 80.10 sheet reads. One list, two
  sheets: a row is *Road Trip · 12 songs*, in the order the Albums page keeps, and no tag can appear because no tag is
  read. With no albums at all the one choice names itself ("No albums yet - make the first one") instead of a dead sheet.
  The playlist branch keeps its own rules (`All Songs` and `Unsorted` still excluded, alphabetical still) and gains the same
  counts.
- **THE WRITE PATH WAS ALREADY RIGHT.** `scStreamKeepIn` sends an album destination through `addTracksToAlbum`, so the song
  lands in a real album on the Albums page, and a name typed as a new album becomes one there rather than in the side store
  that 80.10 removed. Nothing about the destination changed; only what the sheet offers.
- **THE VERSION.** Every release in this page's changelog before the last two carries a **one digit** count after the first
  dot: `80.6.x`, `80.7.x`, `80.8`, `80.9`. Then came `80.10` and `80.11` - the only two digit ones in the whole history, and
  the owner is not having them. The page already writes the rule down ("a number stops at nine", said about the third one);
  it is true of the second one too. **80.9 is followed by 81**, a fix on top of 81 is **81.1**, and this release is **81.2**.
  The two shipped labels are renumbered in the changelog to match (`80.10` -> `81`, `80.11` -> `81.1`, one-line comments and
  entries together), and the version comment in the page now states the rule so the next release cannot drift again. No
  device reads an old changelog label - the updater compares the manifest's version, and 81.2 is newer than 80.11 by the
  first number - so the correction leaves no install behind.
- **WHAT WAS RUN.** `dev/patch-812.py` over the released 80.11 page: `--check` **1** before, **8 steps** applied, a second
  run a no-op, `--check` **0**. Both OTA channels rebuilt to a true fixed point (pass 3). `dev/check-812.cjs` **60 passed,
  0 failed**. The two claims are driven, not grepped: `scStreamDownloadPick` and `scStreamDeviceAlbums` are lifted out of the
  page by counting braces from their own headers and run in a sandbox. The chooser is handed a library carrying the exact
  tag names from the photograph plus two real albums, and its sheet is inspected - the rows come out as *Road Trip · 12
  songs*, *Late Night · 1 song*, in card order, with **each of the eleven tags proven absent**, and with no albums it says
  so and still sends the song to an album of the typed name. `scStreamDeviceAlbums` is handed a store holding an empty album
  and an auto album and offers neither. The changelog reads `81.2, 81.1, 81, 80.9, 80.8`; no label in the page still says
  80.10 or 80.11; all inline scripts compile; both zips carry the 81.2 page with the fixed sheet and without the tag scan.
  Full channel **{{ROOT}}** bytes, Play channel **{{PLAY}}** bytes.
- **NOT CLAIMED.** No phone and no browser here, so the sheet was not opened on a device: what is proven is the list the
  function builds from a given library and that both zips carry that function. The look of the counts on the row is the
  owner's to judge on the next open.
