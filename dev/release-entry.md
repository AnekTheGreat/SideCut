## 80.2.6 ({{STAMP}}): the listening stats bubble keeps its words on the floor, and both lines are bigger

- **THE OWNER ASKED FOR ONE THING.** "fix this why is there a random bottom gap in
  the listening stats bubble for this move the stuff lower the actual stats and you
  can make the stuff a lil bigger", with a phone screenshot of Home. The gap was
  real, it was measurable, and it was the middle size's own centring rule.
- **WHY IT WAS THERE.** The Listening stats bubble is the one full-width card in the
  grid, and on that phone it wears `hb-size-medium` (146px) - either from its expand
  chip or from the Sandbox H stepper. `.home-bubble.hb-size-medium` sets
  `justify-content:center` on purpose (74.1.9: its extra height is shared above and
  below the words, which is the whole reason a middle size was asked for). That is
  right for a card whose icon sits in the middle. This card's icon is pinned in the
  top-left corner, so the room above the words was already spoken for and the shared
  height showed up as a hole underneath them: **53px of empty card below "Listening
  stats" and nothing under it**.
- **THE FLOOR.** The stats card now anchors its words to the card's own floor, the
  way every other bubble's are anchored:
  `body:not(.sc80-cloud) #homeBubbles .home-bubble[data-bubble="stats"]{ justify-content:flex-end; }`.
  Whatever height the card is given lands above the words - behind the icon - never
  under them. It is scoped to `body:not(.sc80-cloud)` so the circle wall, where the
  same bubble is a small round tile and centring is correct, is untouched. Nothing is
  pinned to a stored size, so the answer is the same whether the height came from the
  chip or from the stepper.
- **THE TYPE.** On the sizes with the height to hold it - medium, tall, full, xl - the
  value goes 20px -> **26px** and the label 11.5px -> **12.5px**, with the label
  stopping 26px short of the expand hint in the bottom-right corner. The automatic
  96px wide card is deliberately NOT in that list: its words already fill it exactly,
  and growing them there put the icon's foot on the number.
- **MEASURED, NOT GUESSED.** The same page, the same 390x844 viewport, headless
  Chrome, the chip walked to the middle size the way a thumb would:

  | stats bubble | card | words start | card left under the words | value / label |
  |---|---|---|---|---|
  | 80.2.5, middle size | 146px | 53.5px | **53.5px** | 20px / 11.5px |
  | 80.2.6, middle size | 146px | 85.7px | **13px** | 26px / 12.5px |
  | 80.2.5 / 80.2.6, automatic (96px) | 96px | 40.7px | 13px | 23px / 11.5px |

  The last row is the point of the exclusion list: the automatic wide card is
  byte-for-byte the card it was, in both trees.
- **THE GATE.** `dev/home-bubble-size-check.cjs` - the gate that argued for the middle
  size in the first place - gains section **[5]** through `dev/patch-gate-8026.py`, and
  is **35/0**. It pins the floor rule, the circle-wall scoping, the absence of a
  blanket rule over the other bubbles, the four grown sizes, the three excluded ones,
  the two font sizes, the label inset, and drives the stats bubble back into the middle
  size to prove the card the rule names is the card that wears it. The 74.1.9 claim
  that the middle size itself still centres is pinned beside it, because that rule is
  untouched.
- **THE REPIN.** `dev/repin-8026.mjs`: live pin 80.2.5 -> **80.2.6**, adjacency `PREV`
  80.2.4 -> **80.2.5**, every spelling swept - quoted, cache, `/^80\.2\.5$/`, the
  double-escaped regex and the escaped quoted pin - `--check` clean in 0. 133 edits
  across 55 gates. The escaped quoted pin is the one 80.2.5 left behind:
  `dev/album-auto-delete-check.cjs` tests `/const APP_VERSION = '80\.2\.5';/`, which
  no quoted sweep reaches, so it went red on this build saying "the page runs
  80.2.5". The repin now sweeps that spelling and the sentence it is reported as.
- **THE CHANGELOG HEAD HAS SEVEN NOTES** on purpose: `test-738` requires at least
  seven, no apostrophes, the words widget / player / lyrics / letter, and no
  downloader or converter term.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **WHAT DOES NOT MOVE.** Every other bubble's centring, the circle wall, the classic
  layout, the chip's cycle, the height stepper, the widget, the player, the lyrics
  view, the letter covers and the album pill dock are untouched: this release is one
  scoped stylesheet rule and the two font sizes that go with it.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
- **A SECOND RED LIVES IN THE SANDBOX, NOT IN THE PAGE.** `converter-identity-check`
  times a real encoder loop against a frame budget, so on a loaded machine it reports
  **36/1** ("the frame budget holds it for 48ms, inside a frame") - on a pristine
  80.2.5 tree as readily as on this one - and **37/0** on a quiet run. The battery
  that rehearsed this release came back with it green and every suite but the
  recorded one green (**66 suites at exit 0**). Nothing here touches the encoder.
