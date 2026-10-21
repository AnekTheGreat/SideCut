## 80.0.2 ({{STAMP}}): the assistant duck, to your taste - choose how far the music steps back

- **THE OWNER'S REQUEST WAS ALREADY SHIPPED, AND THIS IS THE SECOND HALF OF IT.**
  80.0.1 answers "step the music back when I hold the power button and talk to
  Gemini" - it ducks, and it comes back when the phone says the request is over.
  What it could not do was say HOW FAR: one fixed 20% and no way to ask for less or
  more. `dev/patch-8002.py` is the whole change, and it is deliberately thin - the
  engine 80.0.1 built (master gain after the limiters, `duckState()` on the plugin,
  the tap, the eight-second wait, the one-minute cap) is not touched.
- **THE LADDER STARTS ON THE OLD VALUE, ON PURPOSE.** `SC_DUCK_LEVELS =
  [0.2, 0.15, 0.25, 0.4]` and `assistantDuckLevel` boots to the first rung, which is
  exactly what 80.0.1 stepped to. A listener who never touches the button hears no
  difference at all after updating, and the gate pins that as a check of its own.
- **THE ENGINE READS A VARIABLE, NOT A CONSTANT.** The only line changed inside the
  duck is `scDuckSetLevel(SC_DUCK_LEVEL, true)` -> `scDuckSetLevel(assistantDuckLevel,
  true)`. Everything downstream - the ramp, the fallback to element volume on a build
  with no graph, the recording tap staying above the node - is 80.0.1's, unchanged.
- **A MID-DUCK CHANGE DOES NOT DROP THE DUCK.** Changing the depth while the music is
  stepped back calls the same `scDuckForAssistant` that applies a duck, so the new
  level is ramped in over the same short ramp - not released and re-applied, which
  would put the music at full volume for a breath in the middle of a sentence.
- **THE CHOICE IS A ROW, NOT A HIDDEN NUMBER.** Settings - More - Playback and sound
  gains "Step down to" under the Assistant duck switch, cycling 20 / 15 / 25 / 40 and
  written to its own meta row beside `assistantDuck`, so it also rides a library
  backup. A meta value off the ladder (a hand-edited row, an older file) falls back to
  the first rung instead of a level the engine would have to guess at.
- **THE NEW GATE MEASURES THE LAYER, NOT THE ENGINE.**
  `dev/assistant-duck-depth-check.cjs` (wired into the extra arm by
  `dev/patch-gate-8002.py`): **36/0** on this tree and **19 of its 36 checks FAIL on
  the pristine 80.0.1 page**, which is what makes it a measurement rather than a
  description. It boots the page three times - a fresh library, one stored at 15%, and
  one stored off the ladder at 33% - because a restore that is never exercised is not
  a restore. `assistant-duck-check` is untouched and still describes 80.0.1 exactly.
- **THE REPIN.** `dev/repin-8002.mjs`: the live pin moves 80.0.1 -> **80.0.2**, the
  adjacency `PREV` moves 80.0 -> **80.0.1**, and the quoted sweep runs after `PREV`
  and `OWN` are normalized, so a gate that describes its own release keeps describing
  it. 127 edits across 52 gate files, `--check` clean in 0.
- **THE OTA BUILD IS ONE PASS BEHIND BY DESIGN - WATCH THE SIZES.** The zip embeds a
  copy of root `manifest.json` that records the size of the zip it lives inside, so
  the first build after a page edit is stale by construction. Both channels are built
  until `--check` reports a fixed point, and the numbers in this entry are read from
  `ota/updates.json` and `ota-play/updates.json` after that point (root {{ROOT}} bytes,
  Play {{PLAY}}).
- **AND THE COMMITTED BUNDLE IS NOW BYTE-STABLE, WHICH IT WAS NOT ON 80.0.1.**
  `dev/ota-update-check.cjs` regenerates the bundle and compares the zip's bytes;
  that check is RED on a pristine `git archive origin/main` (54 passed / 1 failed,
  `c8463c5e64 -> 7e45147cb9`), and the cause was in `dev/ota-fixpoint.mjs`: it
  seeded root `manifest.json` from `ota/updates.json` (`url: 'update.zip'`, relative
  to `ota/`) while `dev/ota-bundle.mjs` writes it back as `url: 'ota/update.zip'` -
  two forms of the same byte count, so every generation embedded the other one, the
  zip's size never moved, and a size-only fixed point declared victory while
  `deploy.yml` re-committed the bundle after every push. The fixpoint now seeds the
  form the build writes back: it settles on the first pass, two regenerations are
  byte-identical (root `871e94cb05`, Play `2798ca9045`), and the check is green at
  **55/0** on the bundle this release commits.
- **TWO PRE-EXISTING REDS, BOTH PROVEN NOT THIS RELEASE'S** (identical counts on a
  pristine `git archive origin/main`): `media-controls-check` **60 passed / 1
  failed**, "and it no longer fires every half hour"; `album-follow-dock-check` **104
  / 1**, "and its notes name what the release does" - a gate that requires the HEAD
  changelog entry to name the album pill dock, which is red on 80.0.1 for the same
  reason. Everything else in `dev/gates.sh` is green: 62 of 64 suites, plus
  `audit-calls` 0 unresolved and `check-dom` 0 integrity failures.
- **WHAT THIS RELEASE DOES NOT DO.** It does not change the four ways a duck ends, the
  cap, the call path, the native plugin, or the tap-to-release. It does not add a
  second duck engine: the deck-volume design built in this chat's 80.2 branch was
  deliberately dropped rather than shipped beside 80.0.1's master gain, because two
  things stepping the same music is how a volume bug starts. The Ask SideCut drawer
  and microphone work (80.1) is still not on this lineage and is not part of this
  release.
