## 80.0 ({{STAMP}}): the Massive Revamp - replayable milestones, Studio split down a diagonal, and a second layout that is always one tap from the original

- **THE OWNER ASKED FOR ALL OF IT IN ONE RELEASE, WITH ONE RULE.** "one shot
  done", and "REMEMBER YOU SHOULD ALWAYS HAVE THE OPTION TO REVERT BACK TO THE OG
  WAY WITH TABS ON THE BOTTOM". So every new arrangement hangs off a body class
  the new block adds (`sc80-cloud`, `sc80-pa-grid`) and the ORIGINAL is the
  default: with both switches off the page is 75.1.2. Everything is in
  `dev/patch-800.py` + `dev/revamp-800.css` + `dev/revamp-800.js`.
- **MILESTONES.** A streak that reaches 3, 7, 14, 21, 30, 50, 75, 100, 150, 200,
  250, 300, 365, 500, 730 or 1000 days now opens the app with a celebration made
  for that number: the number, the unit, three expanding rings and confetti, a
  line that says what the streak is. It plays once per milestone (the record is
  `localStorage.sc80Milestones`, days -> timestamp) so it stays a moment instead
  of a nag, and every milestone that has been reached is listed in Studio with
  its date and a Replay button. The boot check reads `__scStats()` and retries for
  ten seconds, because the streak loads out of IndexedDB and an early read is
  legitimately zero.
- **STUDIO IS TWO TABS, CUT ON THE DIAGONAL.** One pill, split corner to corner
  from the bottom right to the top left - the same diagonal the Library pill has
  carried since 70.0 - with Studio (the work: DJ, Crop, Edit rack, clip, cleanup,
  FX, karaoke, sampler, looper, sleep, practice) on one side and Tools on the
  other. Tools takes the badges wall, the storage cleaner, Auto-DJ, gestures, the
  batch tag editor, batch on selected, the milestones and the layout switches.
  `renderStudio` is wrapped AND watched by a MutationObserver, because the Studio
  block repaints itself from several places inside its own closure; the split is
  rebuilt on whichever of the two arrives first and the chosen tab is remembered.
- **PINNED ARTISTS, TWO WINDOWS.** Four in a row is still the default and still
  exactly 75.1.2. The new option is eight smaller squares in a 2 x 4 window with
  the rest scrolling. The rail also glides now: `scroll-behavior: smooth`, a mouse
  wheel that moves the rail instead of the page, and a snap that only engages
  once the scroll is already slowing down (a snap that fights a flick is what
  "not smooth" meant).
- **TABS THAT MOVE.** The dock carries one highlight layer that slides between
  pills by transform instead of four pills repainting their backgrounds, the pill
  and tab colours cross-fade over 280 ms, and the active library tab scrolls
  itself to the middle of the strip when the strip changes.
- **THE CLOUD LAYOUT.** Round floating bubbles on Home, the four tabs as a
  vertical glass dock down the right, the player keeping the bottom, and a small
  now bar in the top right with the track, the artist and play/pause. The header
  bell, refresh and gear move onto the listening-stats bubble beside the Ask
  SideCut sparkle and forward the real clicks; if the stats bubble is hidden they
  land on the greeting row, so Settings can never be unreachable. The "your files
  / no ads, ever" line is gone in this layout, which is what was asked for.
- **BACK TO THE ORIGINAL.** Both switches live in Settings -> More -> The new
  look, and again in Studio -> Tools -> Look and feel. They are live (no restart)
  and remembered in `sc80Layout` / `sc80PinnedLayout`.
- **PATCH NOTES HAVE A SECOND LAYER.** `items` stays an array of plain strings -
  one sentence each, which is what every gate and every older panel reads - and a
  parallel `details` array carries the explanation. `changelogRich()` pairs them
  and `scClItemHtml()` draws a `<details>` whose summary is the sentence. A note
  with no detail is still a plain bullet, so every release before 80.0 renders
  exactly as it did.
- **THE DUPLICATE UNSORTED TAB IS GONE.** The strip drew the virtual Unsorted tab
  and then walked the playlists object, which holds a real `Unsorted` key created
  the first time a song had no playlist. The stored key is storage, not a tab, so
  it is skipped by name and the virtual one is the only one that renders.
- **BIGGER SCREENS.** Breakpoints at 600, 760 and 1000 px: the bubble cloud goes
  three or four across, the panes keep a readable measure and centre, and a
  landscape phone shrinks the right-hand dock.
- **THE GATE.** `dev/revamp-check.cjs` boots the page in jsdom (87 checks): the
  80.0 notes are sentences with details long enough to be worth opening; one
  Unsorted tab with a real Unsorted key in playlists; the row is the default and
  the grid is a switch that is remembered and caps nothing; the cloud layout adds
  the now bar and the three bubbles on the stats card and classic takes every one
  of them away; the celebration opens with the number, records itself, closes,
  and a manual replay does not mark an unearned milestone; the Studio pill is
  split on the bottom-right-to-top-left diagonal with the six non-studio sections
  moved and the tab remembered; the dock highlight and the tab scroll exist; both
  Settings switches work in both directions; nothing threw. `dev/patch-gate-800.py`
  puts it in the extra arm.
- **OTA.** The root bundle is `{{ROOT}}` bytes and the Play channel is
  `{{PLAY}}` bytes, both rebuilt to a fixed point before the battery ran.
- **ONE CARRIED RED, NOT CAUSED HERE.** `media-controls-check` fails "and it no
  longer fires every half hour" on `dev/native-updates.js`, which is untouched by
  this release and reproduces on a pristine 75.1.2 checkout.
- **NOT VERIFIED ON A DEVICE.** jsdom has no layout engine: the diagonal, the
  circles and the floating dock are proven as computed CSS rules and as rendered
  elements, not photographed on a phone. The real test is one swipe on the rail,
  one tab switch in Studio and one boot on a streak day.
- **NEXT RELEASE**: `80.1` for a fix inside this one, `81.0` for the next feature.
  Shell cache `sidecut-shell-v80.0`.
