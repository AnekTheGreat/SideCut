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
