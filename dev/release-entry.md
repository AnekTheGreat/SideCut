## 74.1.9 ({{STAMP}}): The album follows the song, the views arrive smoothly, the tabs can be one sliding pill dock, plus two repairs from the phone

- **The ask, in the owner's words, in one message**: *"In albums, when you skip a song to the next album if it starts a new album, the old one should automatically close
  and the new one should automatically show un-collapsed. Also make the apps and transitions in the apps very smooth and add a feature in the bottom where the tabs are to set
  them to a pill like shape all together kind of like iOS where you can hold and hover over what you want to click or like slide it nicely, that would be a cool feature."*
  Three changes and two repairs went in, and each one is small, in one place, and driven by a gate. The second message, on the same day, while the release was being prepared:
  *"also I've seen frequent lag spikes inside the app while doing multiple things simultaneously, also the Spotify to mp3 converter will frequently confuse songs by the
  same artist while downloading a song and often duplicate the same song in different metadata, this often happens when downloading albums... it should download the correct
  audio"*. Both are in this release.
- **1. THE ALBUM FOLLOWS THE SONG.** `highlightPlaying()` is the single place every track change in this app passes through - Next, Previous, a song ending, a row tap, a
  track picked in DJ Mode - and its Albums-tab half already opened the card that holds the playing song. It never closed the card it had opened for the song **before**, so
  skipping into another record left two albums open and the row that was playing somewhere inside them. The cards this rule opened are now remembered (`scAlbPlayingCards`)
  and closed again on the next change. **Only those**, which is the whole point: an album the owner opened by hand and never played is not the app's to shut, and a card that
  still holds the playing song - a saved album and a tag-only card can both hold the same song - stays open. Closing a card takes its rows with it, so the next open rebuilds
  them with the right row marked; and because "shows un-collapsed" has to mean *visible*, the pane is eased to the album that just opened.
- **2. THE VIEWS COME IN.** Home, Discover, Library and Studio each toggle between `display:flex` and `display:none`, which is a hard cut. The view that just arrived now
  fades and settles in about a fifth of a second of opacity and six pixels of travel - both compositor work, no layout - and **nothing at all** happens when less motion has
  been asked for, by the Sandbox reduce-motion switch or by the device's own `prefers-reduced-motion`.
- **3. THE PILL DOCK, and it is a setting.** Studio -> Gestures carries a new switch, **Pill dock**, which joins the tabs into one rounded capsule with a highlight that
  slides to the tab being pressed, hovered or slid over - an iOS segmented control. It is **off until it is switched on**, so the four separate pills are exactly where they
  were for everyone who likes them that way.
- **4. AN ALBUM NO LONGER MIXES ITS OWN TRACKS.** An album is **one artist's whole run**, so the artist check cannot tell its tracks apart, and the length gate is +-60s -
  two tracks of one record routinely sit seconds apart. The only gate left between them was the TITLE one, and both title gates were **substring** tests: `scTitleMatch('Yaar',
  'Artist - Yaarian (Official Audio)', '')` was `true`, and so was `'Pind'` against `'Pind Waliyan'`. So a track took its neighbour's upload (the artist matched, the title
  "matched"), and when the neighbour's own turn came, the run's claim - *a sibling already took this upload* - refused it **its own source**. One audio file, filed twice
  under two sets of tags: the owner's "duplicate the same song in different metadata", once an album. Containment in `scTitleMatch` and in `scTitleStrong` is now a **run of
  whole words** (space-padded, so the whole difference between `yaar` and `yaarian` is the missing space), and the word-overlap fallback counts words rather than substrings.
  Everything that must keep working still does, and is pinned: `Artist - Song (Official Audio)` and `Song (Live)` still pass, because `norm()` has already made those words
  either side of the title. `scTitleStrong` matters twice as much - it is what lets a 15-60s-off decode stand in as the closest cut, and what makes a title claim count - and
  it was the same substring test.
- **5. THE SLICE THE UI GETS BACK.** The cooperative encoders hand the main thread back every `SC_ENCODE_SLICE_MS`, and 90ms is about **five dropped frames**: the app
  stuttered for as long as a file was being made, which is the owner's "frequent lag spikes while doing multiple things simultaneously". While the page is **visible** the
  budget is now one frame (`SC_ENCODE_FRAME_MS = 12`); while it is **hidden** the budget is exactly what it was, because a hidden page has no frames to drop and the long,
  deliberately-chosen slice is what makes background work finish soonest. A smaller slice pays the wake-up more often, so the wake-up got cheaper too: `scYieldToUI()` is a
  `MessageChannel` macrotask (no timer clamp, and the browser may paint between macrotasks) with the `setTimeout(0)` fallback kept underneath for anything without it.
- **6. THE WORDS LINE UP WITH THE RECORDING.** Reported last, and from the phone again: *"the lyrics for multi language songs is crazy it like doesn't play for 50 seconds while the
audio is already playing and then starts really late and the lyrics needs to be accurate"*. A lyric sheet that carries its own timestamps - LRCLIB's synced entry, or a sheet the
  model timed - was **trusted in silence**. It often is not in sync with the file on the phone: LRCLIB is community-uploaded and skews to official videos, full-length cuts and
  regional releases, so an entry can sit tens of seconds away from the recording in the library. Nothing measured it, and the only correction offered was the per-song sync nudge
  - clamped to **+-15s**, narrower than the error it exists to fix, so a sheet fifty seconds out could not be lined up by hand either. A stamped sheet is now **measured against
  the file that is playing**: where its singing runs, which is what a uniform offset actually moves (a first version of this measurement matched every stamp to its nearest onset,
  and the probe is what killed it - a sheet fifty seconds late is late into a different part of the singing, where every line still has an onset a second away, so every per-line
  difference came back ~0 and a sheet fifty seconds out "measured" as perfect). The answer becomes the song's own nudge, stored where the existing label, reset button and
  highlight already read it, and the nudge's ceiling is now **120s** so the one control that could have fixed this by hand can reach it. The measurement only acts on a miss big
  enough to be certain about (8s), and refuses - rather than forces - a sheet whose words would land in a measured break, run past the singing, or leave the singing uncovered:
  that is another cut of the song, not an offset. A song with a fifty-second instrumental opening is not touched at all, because its own singing starts late too and the
  difference is zero.
- **7. THE FINISHED PILL LEADS WITH OPEN LIBRARY.** *"the in tab thing that shows up after you download a song should be replaced with open library"*. The conversion pill - the card that
  appears while a song is being saved and stays nine seconds after - carried the run's own sentence as its **title** ("3 songs added to your library") and put the way into the library
  in small print underneath, so the one thing anyone wants at the end of a save read as a status report. The action is the label now: **Open library**, with what happened kept
  underneath it, and the whole pill tappable exactly as it was (it opens All Songs). A run that saved nothing keeps its own text and the bell pointer, so the pill never offers a
  library it did not fill - and that half was already wrong before this release, which is why it is fixed in the same edit. The test for "did this run fill the library" was a
  **substring** test on the run's own sentence (`/library|added/`), so `"Cancelled - nothing was added"` counted as a filled library, and so did the batch line for a run where
  every track failed, `"0 songs added to your library - 3 failed"`. It refuses the count as well as the words now (`!/could not|nothing was added|(\D|^)0 songs/`, the `\D` so
  that "10 songs added" still counts), so a run that saved nothing is never dressed as a way into a library it did not fill, and a run stopped part-way with songs saved still
  leads with **Open library**.
- **How the slide works, and why a tap still does.** A pill keeps its own `pointerdown` and its own `click`, and the dock never takes pointer capture - capturing retargets
  the `pointerup` at the dock, which would fire the click that follows a tap at the dock instead of at the pill. Only a **slide** is answered: the highlight follows the
  finger, the tab it finishes on is activated, and the click the browser fires at the press's common ancestor is swallowed once, so a press that began on Home and ended on
  Studio cannot open both. The split Library tab is part of it: the diagonal cut the clip-path draws is the test used, so sliding from the Library half to the Albums half
  moves the highlight between the halves and lands on Albums. The add-songs plus is never a landing place - it opens a menu, it is not somewhere to be.
- **THE TWO MISTAKES THIS FEATURE COULD MAKE, AND THE ONE THE REHEARSAL ACTUALLY MADE.** The first is the double fire above. The second is the swallow: a flag that eats one
  click is a flag that can be left armed, and a click that never arrives (another listener, an engine that decides the two targets are too far apart) would leave it armed to
  eat an unrelated one later. **The first draft made exactly that mistake in the other direction** - it armed the swallow *before* dispatching its own click, so the click the
  slide wanted was the one it ate and the slide did nothing at all; the library-half case then failed because the flag left over from the previous slide swallowed it. Both
  are fixed and both are pinned: the two lines are ordered (dispatch, then arm), the flag expires after 600ms, and the next press clears it. The gate `[11s]` asks the page for
  every one of those four properties, because each is a line a small, sensible-looking edit could quietly delete.
- **Three things are drawn, and none of them is in the markup.** The capsule and the highlight are built by the dock's own code when the setting is on, so the dock the app
  ships still holds the four tabs and nothing else, and both pieces sit **behind** the labels (a negative `z-index` inside the dock's own stacking context), so no tab name is
  ever covered by the highlight. The joined pills carry `touch-action: none`, so the slide is theirs and not handed to the page's own scrolling.
- **TWO PROBES, BOTH PROVEN BOTH WAYS.** The first is `dev/converter-identity-check.cjs`, new, and run by the battery (`dev/gates.sh`): the three functions that decide which
  upload becomes which song - `scTitleMatch`, `scTitleStrong` and `scSourceClaimsSibling` - are **sliced out of the shipped page and run for real** over the pairs an album
  actually produces ("Yaar" against a "Yaarian" upload and the reverse; a two-word title against a longer word carrying one of them; a shared whole word, which the title gate
  still accepts and the run's claim then takes away from the short track). On the prepared tree: **37 passed, 0 failed**. On the same page with these four edits undone:
  **26 passed, 11 failed** - every bug case and every rule of the second repair goes red, and the pins that predate this release stay green - which is the direction that says the probe is measuring the fix and not the weather.
  The same file **measures** the second repair: the page's own slice logic and its own `scYieldToUI`, driven over calibrated synthetic work, held the thread for **106ms** at
  the old 90ms budget and **19ms** at the frame one, handing it back 16 times instead of 100, for a wall clock within a few percent of the same work.
- **THE PROBE, PROVEN BOTH WAYS.** `dev/album-follow-dock-check.cjs` is new and is run by the battery (`dev/gates.sh`). It boots the real page and drives all three changes:
  a real skip out of one album into the next through the app's own Next button, with the card that was playing closing and the new one opening with its rows built and the
  playing row marked, while a skip *inside* an album and an album opened *by hand* are both left alone; the view entrance, and its absence under reduced motion; and the dock
  over a synthetic geometry - the capsule spanning the tabs and stopping before the plus, the highlight starting on the lit tab, a mouse hovering Discover previewing it
  **without** navigating, a press-and-slide from Home to Studio opening Studio and not Home, the split tab's ancestor click swallowed while a plain tap still reaches its own
  handler, and the plus never sliding into anything. On the prepared tree: **68 passed, 0 failed**. On the 74.1.8 page: **28 passed, 40 failed**, and the red is a report, not
  an exception - the reads go through guards so a page without the feature still prints its whole result.
- **THE NEW GATE BLOCK `[11s]`**, 55 checks inside `dev/studio-70-check.cjs`: the four rules above read off the shipped bytes (one owner of the collapse, and the guard that
  spares a hand-opened album; the entrance that both the device and the Sandbox can switch off; the joined dock that is a setting rather than a second dock, with the capsule
  and the highlight drawn behind the labels; the slide that cannot fire two tabs and cannot eat a later click, including the expiry and the next-press clear), then the two repairs
  that came off the phone (the whole-word title rule in both gates, the frame budget both encoders read, the lyric sheet measured against the recording, the sync nudge that can
  now reach the error it is shown), and the finished pill - pinned off the shipped bytes **and driven**: the real `scConvertPillDone` is sliced out of the page and run over a
  synthetic pill for four shapes - a filled run, an empty batch, a cancelled save, and a run stopped part-way with songs saved - so the label, the small print and what a tap does
  come from the code that ships. And then the setting **driven on the real Studio**: the switch found, tapped, and the dock joining, building its two pieces, writing the choice
  down, and coming apart again.
- **THE RELEASE BATTERY, AS FAR AS THIS MACHINE CAN CARRY IT.** Every suite below was run on the prepared tree: `studio-70-check` **570 passed / 0 failed** (55 of them
  `[11s]`, the fourteen new ones pinning the whole-word title rule in both gates, the absence of the two substring lines that let "Yaar" take "Yaarian", the frame budget read
  by both encoders, the untouched 90ms background slice, the macrotask wake-up with its timer fallback, and the finished pill - pinned off the shipped bytes **and driven**: the real
  `scConvertPillDone` sliced out of the page and run over a synthetic pill for a filled run, an empty batch, a cancelled save and a run stopped part-way);  `converter-identity-check` **37 passed / 0 failed**; `lyrics-timing-check` **30 passed / 0 failed**, and **4 passed / 12 failed** on the 74.1.8 page - the
  direction that says the offsets it drives are the fix and not the weather;
  `test-737` **68 passed / 0 failed** (its Gestures switch count moved from two to three, because this release adds the Pill dock switch to that section - the pin
  was moved, not weakened); the OTA trio **20/0**, **52/0**, **24/0** after both bundles were rebuilt to a true fixed point; `patch-7419.py --check` 16/16 including the four
  inline script blocks parsing (the four new anchors included); `repin-7419.mjs` 111 edits across 81 gates and **no stale pin left**; and `sh dev/gates.sh quick`, the core
  battery plus the OTA trio, **green end to end** once `acorn` was installed in this workspace - three suites of it (`test-735`, `test-736`, `test-7361`) had been reporting
  `ERR_MODULE_NOT_FOUND` for that missing package alone and pass unchanged with it present. `test-662`'s 90ms pin is deliberately **not** moved: the background slice kept its
  value, and only the visible-page budget is new. **The full 51-suite battery was NOT run here**: this machine cannot
  carry it - the suites that boot the 3.24 MB page and the ones that spawn child suites run out of memory or out of the five minutes a command is given - and nothing about
  the wider battery is claimed for this tree.
- **TWO REDS ARE RECORDED AND NOT FIXED, AND NEITHER IS THIS RELEASE'S DOING.** `test-705.mjs` has five checks that pass the **module text** to the helper that searches the
  **page** - `count(mod, '...')`, where `count` closes over `src` - so they do not ask what they look like they ask ("is this string in the module") but whether
  `dev/sc70-module.js` appears byte-for-byte inside `index.html`. It does not, and it did not at 74.1.8 either: the page's Studio block has been edited by every release since
  73.3.8 while the module file was left as the history of what 70.0 spliced. Three more of that gate's lines are child suites that crash in this environment. All eight are
  present on a pristine 74.1.8 tree, and none of them is touched here.
- **Both channels ship together**: `ota/update.zip` and `ota-play/update.zip` are rebuilt from this page to a true fixed point (the zip embeds the root `manifest.json`,
  which records the zip's own size), at {{ROOT}} bytes for the sideload channel and {{PLAY}} for the Play one, and the page inside each carries `APP_VERSION` **74.1.9** and,
  for Play, `__PLAY_BUILD__`.
- **WHAT THIS DOES NOT CLAIM.** Nothing here ran on a phone. That a skip closes one album and opens the next, that a view settles in, and that a thumb can press and slide
  across the joined dock are proven in jsdom on the real page; **how the slide feels under a real thumb is unconfirmed**, and the halo of the highlight, the width of the
  capsule and the half-second of the slide are the parts a phone would judge.
- **Nothing else moved**: the player, the home widget, the letter-by-letter lyrics, the storage cleaner and every saved song and setting are where 74.1.8 left them.
- **8. THE BUTTONS THAT SAID "DELETED" AND DELETED NOTHING, THE SYSTEM DIALOG, AND NO WAY BACK.** The ask was one sentence - *"make the app nicer to use"* - and the
  three faults below were found by following what a thumb actually presses, not by looking at a screenshot. They are one change because they are one moment: the
  moment something is removed.
  **8a. Two destructive buttons did nothing.** "Clear playlist" and "Delete all songs" are drawn only in the playlist / All Songs view, and both call
  `deleteAllInView(ids, isAllSongs)`, whose entire body answered the **Albums** tab: `if(libraryMode === 'albums'){ ... }` and then `toast('Deleted')`. In the two
  places the buttons exist, the branch was false, so nothing was removed and the app said "Deleted". **Driven, with `window.confirm` stubbed to return true - the most
  generous reading of the old page:** Clear playlist on a three-song playlist left `["t1","t2","t3"]` in storage, left the three rows on screen, and showed the toast
  `"Deleted"`. That is the release's worst kind of bug: a confirmation, a success message, and no change.
  **8b. Every song delete asked in a system dialog.** `deleteTrack`, the multi-select delete, the duplicates run and the album-side removes all used `window.confirm()`.
  This page already carries the note, written for `deletePlaylist` in 71.9, that **the Android WebView swallows `confirm()` and returns false** - so the honest reading
  of a swallowed confirm is "the app did nothing", and the other reading is a system sheet in the middle of a fully themed app. `modalConfirm()` existed for exactly
  this reason and the songs never got it. The covers reset, the "album already exists - merge?" prompt on both album paths, and the update-reload prompt were the last
  four; the page now contains **no `confirm(` call at all**, only the comments that explain why.
  **8c. A delete was final.** One thumb on the wrong row took the file, its plays, its lyric sheet, its queue slot and its place in every playlist, for good.
- **ONE DELETE PATH, AND WHAT UNDO ACTUALLY PUTS BACK.** `scDeleteSongs(ids, opts)` is the one path now; `deleteTrack()` and `deleteAllInView()` route through it.
  Before anything is removed it takes a snapshot: the track object and the index it sat at in `allTracks`, its index in **every** playlist (not just the open one, so
  Favorites and a hidden list come back too), its slot in the queue, and the full IndexedDB record read with `dbGet('tracks', id)` - read first, because
  `URL.revokeObjectURL` and the store delete happen a few lines later. The removal is the same code the old path ran. `toastWithUndo()` carries the way back, and
  `scUndoSongDelete()` puts all of it where it was: the song at its old index, a **fresh** object URL from the file it still holds, each playlist membership spliced
  back at its old index rather than pushed on the end, the record written back to the store (so the song survives a restart, not only this session), its queue slot,
  and - if the song that was playing was the one deleted - the now bar back on screen with that song loaded and paused, rather than a hidden bar and no explanation.
  A single delete and a delete of many are the same code; the duplicates review is one delete with one undo rather than N deletes with N toasts.
- **THE THREE LIST-LEVEL CASES ARE THREE DIFFERENT PROMISES.** `deleteAllInView` now keeps each one: **Clear playlist** takes the songs out of that playlist and
  leaves the library alone; **Delete all songs** deletes them from the library and every playlist, through the same snapshot; **Remove from albums** (the Albums tab)
  removes them from their albums, keeping per-id album positions so Undo puts each row back where it was, instead of restoring a whole `userAlbums` object and quietly
  undoing anything else that changed in the same six seconds. Multi-select's playlist-remove and album-remove now carry their own `toastWithUndo` for the same reason.
- **THE MESSAGE BAR.** It is a real status region now (`role="status" aria-live="polite"`), so a delete, a restore or a failed run is announced rather than only drawn.
  It can be **flicked up** out of the way - 24px, over a fingertip's wobble and under a deliberate flick - and the click that follows that flick does not count as a tap
  on the message, so pushing a toast away can never open the song list behind it. A press that starts on the Undo button is left alone: that is the action, not a gesture.
- **VERIFIED BOTH WAYS, THROUGH THE BUTTONS.** `dev/undo-delete-check.cjs` drives the shipped page: the row's own kebab -> "Delete from library" -> the app's confirm
  sheet (which names the song and says what it takes) -> Cancel keeps every song and the store untouched -> Delete removes it from the list, the store, All Songs, Chill and
  Favorites -> Undo restores the row at its old index, the record, and all three memberships in order; then Clear playlist on Chill (playlist empty, library whole, no
  audio deleted, Undo restores it in order); then Delete all songs (library empty, store empty, Undo restores all five in their order); then the toast's ARIA and its
  swipe. **56 passed / 0 failed** on this tree, and **17 named reds** on the page before the change (14 passed), including the missing confirm sheet and the flick.
  `studio-70-check` **570 / 0**, `album-follow-dock-check` **105 / 0**, `beat-repeat-check` **35 / 0**, the OTA trio **20 / 52 / 24** after both bundles were rebuilt to a
  true fixed point (983 769 bytes sideload, 983 781 Play at that stage - the section 9 bubble-size change moved the final bundle to 984 576 / 984 586), `test-738`-`741` **49 / 62 / 54 / 86** (their release-note rules - under 260 characters, no apostrophe, no
  converter word - are what the four new notes were written to), `check-dom` **0 failures**, `audit-calls` OK.
- **THE FULL BATTERY, AND WHAT IT CANNOT SAY HERE.** `sh dev/gates.sh` on this machine runs the whole list. It is green except **`media-controls-check`** (60 passed,
  1 failed - *"and it no longer fires every half hour"*), which is the carried failure this repo records: run against a pristine `git show HEAD:index.html` it fails the
  same one check. **`ota-update-check` was red before the bundles were rebuilt** (*"a second generation produces the same bytes"*) and green after the fixed point,
  which is what that check exists to say. The harness needed **jsdom 30** in this workspace for `requestInterceptor` and for the page's modern CSS; with jsdom 26
  installed the suites that boot the page report `Could not parse CSS stylesheet` on a stylesheet this tree did not touch, and `acorn` had to be linked for
  `test-735`/`736`/`7361`. None of those reds was in the page.
- **WHAT THIS DOES NOT CLAIM.** Nothing here ran on a phone. The confirm sheet, the undo, the restore order, the album positions and the toast flick are proven in jsdom
  on the real page; **the feel of the flick and of the in-app sheet under a real thumb is unconfirmed**, and no store submission was made.
- **9. THE BUBBLE SIZE THAT WAS MISSING.** *"there should be like an inbetween settings for the bubble size like in the middle but without all that gap but not too little"*. Home had
  four sizes through the expand chip - mini **60**, small **84**, automatic **118**, tall **158** - and then wide/full/xl, with **nothing between automatic and tall**; and Sandbox's
  per-bubble height stepper moved in **whole steps of 118px**, so the choice there was 118 or **236**, which is precisely the card-with-a-hole-in-it the owner is describing.
  Three changes, one size: a **Medium** preset at **146px**, which is a real step between automatic and tall; **half steps** on the height stepper (`HB_EXACT_STEP = 0.5`), so 1.5× =
  **177px** exists and is stored as `1.5` rather than a float artefact; and Medium **shares its extra height above and below the words** (`justify-content:center`) instead of leaving
  the label pinned to the floor under an icon with a gap between them. The chip's walk is now mini -> small -> **medium** -> automatic -> tall -> wide -> full -> xl; the first tap on an
  untouched bubble still goes to tall exactly as before, so nothing anyone has learned moves.
- **AND THE RESET BUTTON THAT DID NOT RESET.** `Reset to automatic` in Sandbox claimed *"every bubble is back to its automatic size"* and cleared only `homeBubbleExact` - the **presets
  the expand chip writes live in `homeBubbleSizes`**, so a chip-sized bubble stayed sized while the toast said otherwise. It clears both now, and both rows are written back to storage.
  Found by the new gate on the page before the change, not by inspection: `✗ and no bubble is left wearing a size ["stats"]`.
- **DRIVEN, BOTH WAYS.** `dev/home-bubble-size-check.cjs` (wired into `dev/gates.sh`) proves the CSS is a real middle (`118 < 146 < 158`), the chip walks to Medium through the real
  handler (7 taps from automatic), the choice is persisted, one H tap lands on **1.5 / 177px** (not 2 / 236), the stepper clamps at 1×, and Reset leaves no bubble wearing a size:
  **23 / 0** on this tree, **10 named reds** on the page before it. `patch-74110-bubble-medium.py` is the record of the six edits (`--check` passes). OTA after the page change:
  **984 576** sideload and **984 586** Play, fixed point in two passes; the OTA trio **20 / 52 / 24**.
- **WHAT THIS DOES NOT CLAIM.** No screenshot was taken here and nothing ran on a phone: **146px is chosen from the two numbers either side of it and from the owner's words, not from
  looking at it**, so the exact pixel is the one thing a thumb (or the preview) should settle. Nothing else about Home moved.
- **10. ASK SIDECUT - THE AI BUTTON, WITH A PLAN YOU APPROVE.** *"can we make an ai button that I can ask anything with like my songs and it'll do it like create a new playlist
  containing these songs that Crossfade with specific DJ mode settings"*. The app already had an assistant (Settings -> Support) and an acting layer (`window.SCACT`), but it was
  three taps from the music, it had no idea what "these songs" meant, it ran a sentence as soon as it was typed, and nothing it did could be undone. This release puts a **sparkle
  button in the Home header and another on the multi-select bar**, both opening one drawer whose first line is what it is looking at ("2 songs selected - Aurora, Born To Shine").
  A sentence becomes a **PLAN**: typed steps against the app's own functions (`__scSetPlaylist`, `__scSetCrossfade`, `__scSetDjDisabled`), shown before anything changes, with
  **Do it** and **Cancel**. **Nothing is executed while it is only a plan** - the one thing the old layer could not promise. `Do it` runs the plan and leaves a **single Undo**
  that restores the playlist bodies, removes a playlist it created, and returns the crossfade and the DJ switch to their previous values.
- **Two failures the gate caught in the first cut, both real.** The DJ bridge was written as "disabled on/off" while the plan speaks "DJ mode on/off", so *"dj mode on"* wrote the
  playlist into the **opt-out** set - the exact opposite of the request, and the gate's `[]` was the tell. And the crossfade grammar only understood *"crossfade 9"*, not the way
  the sentence is actually said: *"with a 9 second crossfade"*. Both are fixed, and both directions of the DJ switch are now driven (off -> on -> Undo -> off).
- **A question is not an execution.** With no plan to match, the drawer answers from the knowledge base the Support chat already ships (`__scAiLookup` -> `_aiFuzzyMatch`), shows
  no plan card and offers nothing to run; a sentence it cannot match is offered as ONE step for the existing acting layer, which only runs after Do it.
- **VERIFIED.** `dev/ai-button-check.cjs` (in `dev/gates.sh`): the button on Home and on the selection bar, the context chip naming the selection, three plan steps with **no**
  playlist, **no** crossfade change while it is a plan, Cancel changing nothing, Do it creating the playlist with exactly `t1,t2`, setting 9s and turning DJ mode on, and Undo
  taking all three back - **33 / 0** on this tree, **5 named reds** on the page before the change. OTA rebuilt to a true fixed point at **990 119** bytes sideload and **990 128**
  Play. `AI_ASSISTANT_PLAN.md` is no longer a wish: it now leads with what shipped and what is still open.
- **WHAT THIS DOES NOT CLAIM.** The planner is a small declared grammar, not a language model: it understands playlist / crossfade / DJ mode phrasings and hands anything else
  to the acting layer or the knowledge base. Nothing ran on a phone, and no live Gemini call is exercised by the gate - the key path is unchanged and untested here.
