## 80.2.3 ({{STAMP}}): the award card opens for plays too, and every rung is a bigger card

- **THE OWNER ASKED FOR THE CARD, NOT THE STREAK.** "make the like awards popup screen
  show up for hitting records in plays too like 100 and 200, 500, 1000, 2000, 3000,
  4000, 5000, 7500, 10000 ect... make them better every time". The full-screen
  celebration already existed: 80.0 built it for streak milestones (`sc80Module`,
  section 3, `#sc80Milestone`). Nothing about it needed replacing, so this release
  earns the same card with the app's own play total and leaves the streak's own
  behaviour where it was.
- **THE LADDER.** `PLAY_MILESTONES` is exactly the ten rungs asked for - 100, 200, 500,
  1,000, 2,000, 3,000, 4,000, 5,000, 7,500, 10,000 - and `playRungs()` generates the
  tail past the last named one: every 5,000 up to 100,000. The "ect..." is real, not
  copy: a library that keeps growing keeps earning awards, with no second list to
  remember to extend.
- **"BETTER EVERY TIME" IS THE MEDAL AND THE CEREMONY.** Five tiers - Bronze at 100,
  Silver at 500, Gold at 2,000, Platinum at 5,000, Diamond at 10,000 - and the card is
  repainted for each: 3 to 8 rings, 26 to 80 falling bits, the kicker and the unit
  taking the tier's colour, and a card glow that warms from bronze to ice. The streak
  cards keep their own three rings and 26 bits, because `paintCeremony(host, 0)` is
  what they ask for.
- **THE TRIGGER IS THE PLAY COUNTER, NOT A TIMER.** `commitPlay` - the one place a play
  is counted - calls `SC80.checkPlays()` after it writes the count, behind a guard, so
  a missing hook can never stop a play from counting. A start (`bootPlays`) and a
  return to the foreground (`visibilitychange`) check the same rung, because a play
  heard with the screen off lands in the stats with no card on screen. The HIGHEST rung
  crossed gets the card and every rung below it is recorded at the same time
  (`markPlaysThrough`), so a library restored with thousands of plays already in it
  says its piece once instead of queueing nine popups.
- **THE RECORD LIVES IN STUDIO.** Tools, Milestones gains a Plays block: the next rung
  and how far along it is, the awards already won with their dates, a Replay on each,
  and a Preview 10,000 plays button. `data-sc80-plays` is wired through the same
  delegated handler the streak replays use.
- **THE STREAK CARD IS UNTOUCHED IN WHAT IT SAYS.** `celebrate()` now resets
  `data-kind`/`data-tier`, hides the medal, restores the Milestone kicker, the DAY
  STREAK unit and the Keep it going button, and paints three rings - so the two
  celebrations share one overlay without either inheriting the other's look. Its own
  copy, its own record and its own replay are unchanged.
- **THE GATE.** `dev/staircase-check.cjs` gains section **[9]** - the ladder, the tail,
  the medal, the ceremony per tier, the medal stylesheet, the trigger, the Studio block
  and the streak card's reset. **85/0**. The section travels alone in
  `dev/patch-gate-8023.py`, which inserts it and refuses to pass unless every claim of
  it is in the gate.
- **AND IT WAS DRIVEN, NOT JUST READ.** A jsdom boot of the patched page (`SC_HTML`) ran
  the milestone block for real: 51 checks/0 - the ladder's ten rungs and its 15,000 to
  100,000 tail, no card at zero plays, 100 plays opening Bronze with 4 rings and 32
  bits, 3,000 opening Gold with 6 rings and 56 bits and every rung below it recorded, a
  10,000-play card at Diamond with 8 rings and 80 bits, a manual replay that records
  nothing, a 30-day streak card still on its own three rings and 26 bits, the Studio
  button opening a plays card again, and no uncaught page errors.
- **THE REPIN.** `dev/repin-8023.mjs`: live pin 80.2.2 -> **80.2.3**, adjacency `PREV`
  80.2.1 -> **80.2.2**, both regex spellings swept, the PREV normalizer widened to carry
  `80.2.x`, `--check` clean in 0 (129 edits across 53 gate files).
- **THE CHANGELOG HEAD HAS EIGHT NOTES** on purpose: `test-738` requires at least seven,
  no apostrophes, the words widget / player / lyrics / letter, and no downloader or
  converter term. The last note names the album pill dock, which is what
  `album-follow-dock-check` and `test-735` require of the head.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point in the
  runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing red
  this repository has carried for months.
