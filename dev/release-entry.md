## 80.6.31 ({{STAMP}}): playlists and albums on the rail

- **WHAT THE OWNER SAID.** *"why are the patch notes referencing multiple builds, only mention the stuff about the new things
  dawg and in the play build it should have the right side playlists and albums"* Two complaints, and both were mine to answer.
- **WHY THE NOTES LOOKED LIKE THAT.** The 80.6.30 entry was written to explain the channel hold: *"Both builds publish the same
  page from here"*, *"Each build updates to itself"*, a catch-up that changed nothing on the page. It was accurate and it was not
  a patch note - it described the release process to someone who just wanted to know what is new. He is right that a note about
  the two channels is not news about the app.
- **WHAT I DID ABOUT IT.** The 80.6.30 entry is **removed**, not reworded, because there is no honest sentence to keep: that
  version changed no behaviour. A changelog is a list of what changed, and a version that changed nothing has nothing in it.
  (The version itself stays released; 80.6.30 was the catch-up the Play channel needed, and nothing is withdrawn from anyone who
  already has it.) This release's entry talks about the rail and where each glyph goes, and says nothing about channels or builds.
- **WHY THE RAIL WAS MISSING ON THE PLAY BUILD.** `scShelfRender()`, `scShelfBoot()` and `scShelfApply()` each opened with
  `if(!SC_STREAM_OK) return;` - the same gate as the streaming sheet, because the rail was built alongside it in 80.6.11. The
  first of those three is what fills `#scShelfRail`, so where there was no source there was no rail at all: no Songs, no
  Playlists, no Albums, and the only way to the playlist strip was scrolling back up to the top of the list. The three page
  glyphs are the library's own pages; gating them on a source was never right.
- **WHAT CHANGED.** (1) `scShelfRender()` and `scShelfBoot()` build the rail on every version. (2) In the rail's markup the
  separator and the source switch are wrapped in `if(SC_STREAM_OK){...}`, so three glyphs are built everywhere and the switch is
  built only where there is something to switch to. (3) `scShelfOpenTab('playlists'|'albums'|'library')` no longer returns early;
  only `'streaming'` does, and it does it inside its own branch. (4) `scShelfApply()` paints a device page without a source, and
  its sheet branch now reads `if(scShelf.src === 's' && SC_STREAM_OK)`. (5) `scShelfSetSrc()` stays gated - it is the switch.
  (6) `scShelfBoot()`'s streaming half is untouched: the sheet still does not exist without a source. (7) Tools no longer hides
  `#scRailGlassCard` on that version, because there is a rail there to set now - it would otherwise ship at 85% see-through with
  no way to change it. (8) `APP_VERSION` is `80.6.31`, with one changelog entry and the 80.6.30 entry gone.
- **WHAT THE PLAY BUILD GETS.** The same right-edge rail the other version has, with Songs, Playlists and Albums, each landing on
  its own page of the library - Playlists on the playlist strip, Albums on the albums, Songs on All Songs - lit while it is up,
  holding still between pages, and taking its see-through amount from the Tools slider. What it does not get is the hairline and
  the switch under the three glyphs, because there is no source on that version to flip to.
- **WHAT WAS RUN.** `dev/patch-80631.py` over the released 80.6.30 page: `--check` **1** before, ten steps applied (version, two
  gate removals, the gated switch, the open-tab branch, the painter, the source branch, the Tools row, the old entry dropped,
  the new one added), a second run a no-op, `--check` **0**. The whole release was rehearsed in a clean copy of the released tree
  before shipping: patch, then the workflow's own fixed-point loop (`cp updates.json manifest.json`, `node dev/ota-bundle.mjs`,
  `node dev/ota-bundle-play.mjs`, both `--check`s) until it settled, then `python3 dev/release-record.py`, then
  `dev/check-80631.cjs`. OTA at a true fixed point - root + `ota/` **{{ROOT}}** bytes at v80.6.31, and `ota-play/` (**{{PLAY}}**
  bytes) at v80.6.31.
- **NOT CLAIMED.** No phone and no browser here, so nobody has tapped the new rail. What the checks prove is that the glyphs are
  built without the source gate, that the switch is still inside it, that the streaming destination still refuses, that the page
  inside `ota-play/update.zip` carries that same shape, and that all seven inline scripts compile. How the rail feels under a
  thumb - the one thing the owner will judge it by - is his to see. `dev/check-8062{6,7,8,9,30}.cjs` now fail by design; each
  pins its own version and they are left as they were.
