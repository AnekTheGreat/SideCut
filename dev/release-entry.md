## 80.3.5 ({{STAMP}}): Settings is one clean list of rows that open, Playback and Playback & sound are one menu, and an anti-muffler sits beside the volume boost

- **THE OWNER'S ASK, VERBATIM.** *"add a anti muffler in settings and playback and sound also playback
  and playback and sound should be merged into one thing and make it clean the settings and more tab
  with like the things on the left and a smooth drop-down that shows when you click on it to clean up
  clutter and nothing should be left out of the drop-down everything shuikd be in it it should be
  mapped after color os 17, and add a anti muffler next to the volume increaser which makes the music
  not muffled"*. Three asks in one message: the anti-muffler, the merge, and the settings list.
- **THE TWO MENUS WERE ONE SUBJECT.** `#settingsPaneMore` carried a group called **Sound** and a group
  called **Playback**. Sound was not even a card: a bare header plus a body holding three panes
  (`settingsPaneRefresh`, `settingsPanePlayback`, `settingsPaneEQ` - crossfade, seek style,
  auto-volume, the assistant duck, the 8 bands, the boost, and display refresh rate inside them).
  Playback was a card holding the sleep timer, gapless, the next-album roll and the per-playlist sort.
  They are ONE card now - **Playback & sound** - and the body keeps every control that was in either
  of them, under four labels a person would name out loud: *Playback, Sleep & queue, Sound, Display*.
  The three panes were **moved verbatim** (the harness slices them out of `origin/main` and out of the
  shipped page and compares them byte for byte), so nothing inside them was edited: the same switch,
  the same slider, the same saved setting, one menu instead of two.
- **NOTHING IS LEFT OUT OF A DROP-DOWN, AND THAT IS ASSERTED, NOT INTENDED.** Every direct child of
  the pane is a section label (`.sc-mgroup`) or a card (`.sc-set-card`) with a head and a body - the
  driver counts it (`25` children: 6 labels, 19 cards, zero stray), so the claim cannot quietly rot.
  The pieces that used to sit loose between two cards are rows now: the tutorial (its replay button
  was a bare button and its text), the three layout switches that shared one box (each is its own row
  now, with the switch itself on the row), "Ask artist when importing songs" (a bare card), and
  **About & updates**, whose version number moved ONTO its row with the update log, the listening
  streak and the version guide inside it. The box that wrapped the top of the pane - a bordered div
  around a list of groups, a box inside a box - is gone with its open and its close.
- **THE REGION BOUNDARY IS THE PART THAT WENT WRONG FIRST, AND THE PROBE CAUGHT IT.** The merge is a
  replacement from the `Sound` label to the `Library` label, and it is tempting to start it on the
  `</div>` above the label. That close belongs to the **seizure-warning card**, not to the wrapper -
  the wrapper closes at the FAR end of the region, after the old Sound body - so the first cut took
  that close, left the seizure card open, and swallowed everything from the merge down into it (the
  jsdom probe reported 13 children instead of 25, with the Sandbox pane nested inside More). The box's
  open tag is removed at the top of the pane and its close goes with the region, so the two cancel.
- **A ROW READS LIKE A SETTINGS ROW.** Title on the left, its own state on the right, one marker that
  turns. Four of the new rows carry the setting itself on the row (the three layout switches, the
  artist prompt), which is why their head is a `div` with `role="button"` rather than a `<button>`: a
  nested `<button>` is not legal HTML and the parser would tear the row apart. The opener therefore
  ignores a click that landed on a control which is not the row, and the driver proves it both ways -
  tapping the switch on a row does not open the row, tapping the row does. The one thing a row cannot
  hold is a slider's number, so the boost's readout is **mirrored** onto the Playback & sound row by a
  single writer (a debounced observer over the pane), which writes only when the text differs.
- **THE DROP-DOWN IS A HEIGHT, AND `display` IS STILL THE TRUTH.** `setupCollapsible` was four lines
  that flipped `display`; it is one opener now that slides the body from nothing to its measured
  height, drops the inline height when the slide lands (so the storage numbers and the DJ list can
  still grow while open), and takes `display: none` at the end of a close - which is what every other
  reader in the app reads, so nothing else had to change. The row carries `sc-open` from the first
  frame, so the marker turns with the tap. A platform that will not report a height, or a reader with
  **Reduce motion** on, flips exactly as it did before this release; a settle that is interrupted is
  dropped by a generation counter rather than fighting the next tap. The **storage** and **Check for
  updates** rows, which each carried their own click handler, are calls to this one now with what they
  do on opening passed in (`renderStoragePanel`, `renderRefreshRateOptions`).
- **THE ANTI-MUFFLER.** A boxed-in master is two things at once - a build-up around 250-400 Hz where a
  mix turns to mud (a pocket speaker, a cheap DAC, a lossy rip) and a roll-off above a few kilohertz
  where the consonants and the cymbals live - and neither is fixed by turning the volume up, which is
  why it is a switch and not another rung of the boost. Two filters on a **wet** path that sits between
  the boost and its ceiling, beside a **dry** path that is a plain 1.0: `-3.5 dB @ 320 Hz, Q 0.85`
  (peaking) and `+3.5 dB @ 3.2 kHz` (high shelf). The pair is the same size on purpose - an asymmetric
  pair is a preset with a tilt in it, and taste is what the 8-band EQ above it is for. **Off means dry
  1 / wet 0**: the signal is multiplied by 1.0 and a zero is added to it, both exact, so Off is the
  samples 80.3.4 played rather than a claim about what a biquad does at 0 dB gain. **Nothing is ever
  disconnected** to switch it - rewiring the master would have to touch the node the rest of the graph
  taps, and half a second of a broken master is a click in someone's ear - and the guard above both
  paths still owns the ceiling, so the cut and the lift cannot clip. One saved boolean (`antiMuffler`),
  restored beside `boostDb` at boot through the same door, with `setAntiMuffler` calling
  `ensureAudioGraph` first so flipping it before anything has played still takes effect. It sits right
  under the **Volume boost**, in the Sound part of the one menu, which is where the owner asked for it.
- **VERIFIED ON THE PAGE THAT SHIPS.** The payload was applied to a scratch tree taken from
  `origin/main` itself (`git archive origin/main`), so the thing measured is the page this release
  replaces plus this patch and nothing else: `python3 dev/patch-8035.py` (1 step) then `--check`
  (0 steps); **every inline script block parses** (acorn, 7 blocks, 0 failures); and
  **`sc-8035-check.cjs` passes 98/98, exit 0** (the session's scratch driver, kept out of the repo)
  while the same driver fails **47** on the page it replaces. It proves, against the release's own
  source rather than a copy: the pane's 25 children are labels and cards and nothing else; every card
  is a row (head, body, marker) and every drop-down starts shut; the one merged body holds all 21
  controls, 4 sleep rungs, 9 EQ presets and 4 labels; the three panes are byte-identical to
  `origin/main`'s; no id in the page appears twice; the twelve new rows exist and the four switches
  that sit on their rows are `div` heads. The opener is the page's own `setupCollapsible`, driven over
  the page's own pane: a body it cannot measure flips, a body with a measured 520 px slides (height
  set, row marked open on the first frame, height released when it lands, `0px` on the way back,
  `display: none` at the end); the switch on a row is its own tap; the chip reads the boost and writes
  nothing when nothing changed; the closer shuts a row and takes the marker back. The anti-muffler is
  the page's own state, setter and `ensureAudioGraph`, run against a recording `AudioContext`: the
  graph builds, the boost feeds both paths, the cut and the lift land on the ceiling in order, the dry
  path goes straight there, the ceiling still feeds the assistant duck, **the old direct
  boost-to-ceiling line is gone**, the filters are the two shapes above with a symmetric pair, Off is
  dry 1 / wet 0, On trades them, one boolean is saved, `{quiet:true}` writes nothing, and the switch on
  the row flips it. The page's own metadata: `APP_VERSION 80.3.4 -> 80.3.5`, the head entry with seven
  notes, all seven kept on the full build and a non-empty, downloader-free set on the store build, and
  the four sentences that sent the reader to "Playback" and "Equalizer" now name the one menu. The OTA
  bundles reach a true fixed point in the release step - root + `ota/` **{{ROOT}}** bytes, `ota-play/`
  **{{PLAY}}** bytes, both `--check`s OK at v80.3.5.
- **WHAT IS NOT CLAIMED.** No phone and no screenshot: the slide's **pixels** are CSS, and jsdom has no
  layout, so what is proven is the height assignments, the `sc-open` class, the release of the height
  when it lands and the immediate flip when the platform will not measure - not the frame rate of the
  transition on a device. The anti-muffler's **sound** was not heard; what is proven is where the
  filters sit, what shape they are and what the two gains do, which is everything that can be proven
  without ears. The store build's own path is untouched: `patch-playbuild.py` still injects the flag
  and the removal of the conversion tools is unchanged, and no note this release adds mentions a
  downloader. Nothing moved in the player, the library, the albums, the lyrics, the tabs, the
  downloader or the widget.
