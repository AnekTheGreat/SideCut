## 80.6.16 ({{STAMP}}): a stream that tries every copy, and rows that keep their cover

- **WHAT THE OWNER SAID.** *"the streaming stuff isn't working and keeps giving source errors"*, *"it
  should have metadata with track covers"*, and a screenshot of the card with the readout on it:
  `webm · 3.5 MB · read · error 4 · the source sent no bytes`. That line is what turned this release from
  another guess into a diagnosis - it named the copy that was tried and the step that refused it.
- **THE READ ONLY EVER TRIED ONE COPY.** `scYtPlayer()` - the resolver the **downloader** also uses -
  ranks itag 251 (`webm`/opus) first and hands back the m4a rows and the progressive muxed copy behind
  it as `alts`. The downloader walks that list (`scFetchDecode` → `scStreamUsable` → `scFetchBytes`) and
  has never had trouble; `scStreamSource()` read `alts` into the state and then called `scFetchBytes`
  on the first URL only, so a single refused range ended the song. The readout's `webm` is exactly that
  first rank. The read now walks the same list in the same order, keeps the mime and size of whichever
  copy answered, labels a muxed copy `audio/mp4`, and still puts the downloader's `__scCancelDl` flag
  back on every exit.
- **"THE SOURCE SENT NO BYTES" WAS A FALLBACK, NOT A FINDING.** `scFetchRange()` returned
  `{bytes:null,status:403}` from both the native and the page branch without writing anything to
  `window.__scHttpWhy`, so the readout had no step to name and the card printed the fallback. Both
  branches now record the status (`the source answered 403`, `the page request answered 502`) and a
  request that never answered says so, so the next screenshot names the refusal itself.
- **THE ROWS HAD NO METADATA BECAUSE THEY READ THE WRONG FIELDS.** `scYtSearch()` returns
  `{videoId, title, owner, duration, score}` and now `thumb` as well; `scStreamAddResult()` was reading
  `it.author || it.channel` and `it.lengthText`, neither of which is in that answer - so every row was
  saved with an empty artist, `dur` 0 and an empty `thumb`, which is the black square and the word
  "Streaming" standing in for the artist. It now reads `owner`, a numeric `duration` (seconds, with the
  text form still accepted) and the cover, and `scStreamThumb()` falls back to
  `https://i.ytimg.com/vi/<videoId>/mqdefault.jpg`, so rows saved before this release fill in on their
  own with no request and no migration. The now-playing card shows a 44px cover beside the title with
  `artist · length` under it (`scStreamMeta()`), and the readout row carries `padding-right:46px` so
  the floating rail no longer sits on top of Restart.
- **THE PAGE OPENS AT ITS TOP.** The shelf owns the scroll and keeps it, so coming back to Streaming
  after reading to the bottom showed a card whose title, badge and New playlist button were already
  above the fold - which reads as a page that lost its header. `scShelfOpenTab('streaming')` now sets
  the shelf's `scrollTop` to 0.
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.15 and driven by `dev/patch-80616.py`: every step
  applied, a second run is a no-op, all inline scripts compile, and `dev/check-80616.cjs` passes -
  statically (the walk, the status reasons, the field names, the cover fallback, the rail untouched)
  and **behaviourally**, by running `scStreamSource()` in a `vm` against a stub reader: a refused first
  copy is followed by the second and the second one plays, a muxed copy is labelled audio, a total
  failure names the 403, and `__scCancelDl` is restored on both paths. `scStreamMeta()` is driven the
  same way for the card line. The OTA pair rebuilt to a true fixed point - root + `ota/` **{{ROOT}}**
  bytes at v80.6.16 publishing one honest line, and `ota-play/` still held at its published bundle
  (**{{PLAY}}** bytes). **Not claimed:** no song was heard playing and no cover was seen on a device -
  there is no phone and no browser here. What is verified is that every candidate is now tried, that a
  refusal names its status, and that a row carries artist, length and a cover that always resolves.
