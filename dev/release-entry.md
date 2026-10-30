## 80.6.12 ({{STAMP}}): Streaming as a tab, and a stream that plays

- **WHAT THE OWNER SAID.** *"the streaming should be an actual tab like thing tho and streaming
  doesn't work"* - two sentences, and both were true of 80.6.11.
- **WHY IT WAS NOT A TAB.** 80.6.11 opened the shelf as a **drawer**: `position:fixed` on the right
  edge, `translateX(102%)`, a scrim behind it and a close button on it, sliding over a list that stayed
  put underneath. That is a sheet with a tab's label on it. The shelf is now the page the **Streaming**
  tab switches to: `#scStreamBlock` is in flow and `display:none` until its class is set, the
  downloaded list is hidden with `display:none` (never re-rendered, so returning to it costs nothing
  and it keeps its scroll), the rail and the header stay where they are, and there is one function -
  `scShelfPage(on)` - that decides which of the two is up, so no caller can leave the list hidden
  behind a shelf that was closed. The scrim is `display:none`, and the shelf is no longer announced to
  a screen reader as `role="dialog"`: a tab is not a dialog.
- **WHY IT DID NOT PLAY.** A googlevideo URL handed to an `<audio>` element is fetched by the WebView's
  media stack with **none of the resolver's headers**, so the source answers 403 and the element fails
  without the page ever learning why - which is exactly what the owner saw: a card at `0:00` and a
  button that did nothing. The stream is now **read**, not pointed at: `scStreamSource()` pulls the
  song through `scFetchBytes()` - the four-lane range reader the downloader has used since 80.3.3,
  whose first short read is accepted as the whole file - turns the bytes into a `Blob` with the
  resolver's own `mime`, and plays it from an object URL. In the installed app that fetch is the
  patched one, so CORS is not the limiter; on the web the plain URL is still the **last** try, so a
  source that allows it plays and nothing that worked before stops working. A song already buffered is
  played from its object URL rather than fetched twice, the resolver's mime is kept on
  `scStreamState.mime`, and the load reports *"Loading the song… 42%"* instead of looking dead.
- **THE CHANGELOG, AND THE REGULAR CHANNEL.** This release's items are all about the shelf, so none of
  them belongs in front of the build that never asked for it: the root channel's notes now publish
  **one honest line** rather than a streaming note, which is the rule the Play channel has had since
  80.6.11 (`dev/ota-bundle.mjs` filters by what a note says, not by whether it carried the marker).
- **WHAT WAS RUN.** Built on a fresh clone of 80.6.11 and driven by `dev/patch-80612.py`: `--check`
  pending (exit **1**, which is what `release.yml` reads as "pending"), applied (12 steps), `--check`
  released (exit **0**, its marker guard). The prose sentence about the shell cache is untouched - an
  earlier draft renamed that name and mangled the sentence, which is why the patch no longer touches
  it. Every one of the page's **7 inline scripts compiles** (`node --check` on each), `dev/check-80612.cjs`
  **30/0** (the shelf is in flow and hidden, no slide transform survives, the list is hidden not
  rebuilt, the play path never hands the element a bare URL, the fetch comes before the fallback, the
  buffered path reuses the object URL, and no U+FF0B/U+23EE/U+23F8/U+23ED/U+00D7 inside the shelf),
  and the OTA pair rebuilt to a true fixed point - root + `ota/` **{{ROOT}}** bytes, `ota-play/`
  **{{PLAY}}** bytes, both `--check`s OK at v80.6.12, with **both** channels publishing one
  non-streaming line. **Not claimed:** playback was not heard - that needs a device and a route to the
  source. What is proven is that nothing is handed to the element before it has bytes, which is the
  failure the last two releases had.
