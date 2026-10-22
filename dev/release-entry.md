## 80.0.8 ({{STAMP}}): the staircase is one dock, and it hugs the bar

- **THE OWNER'S SCREENSHOT.** The staircase floating in the middle of the bubble
  wall, five glass capsules over a wall of glass bubbles, the plus over a bubble's
  text. "MAKE IT BETTER BRO WHAT THE HELL IS THIS."
- **IT FLOATED BECAUSE THE NUMBER WAS OLD.** The dock's `bottom` is
  `var(--sc80-player) + 10px`, and `--sc80-player` was measured **once**, on the
  first frame after a layout change, before the bar had settled - then cached. On a
  phone that left the dock ~90px too high, across the bubbles. It is now written by
  a `ResizeObserver` on `#nowPlaying`, plus a `resize` and an `orientationchange`
  listener, plus two delayed passes at boot. The dock follows the bar.
- **FIVE CAPSULES BECAME ONE PANEL.** The steps stay - each tab is still one notch
  right of the one above, 14px a step - but they sit on one rounded glass panel
  (24px radius, border, shadow, 20px blur), and the pills inside are unpainted
  until one is active. The plus is the panel's own button, not a bubble of its own.
- **WHAT A RELEASE LIKE THIS NEEDS IS A GATE THAT CAN SEE IT.** `patch-gate-8008.py`
  adds **[10]**: the panel exists with its own glass, the pills are transparent
  until active, the active rule exists, and the observer is in the page (with the
  rotation listener and the once-per-page guard). `staircase-check` is **56/0**.
- **NOTHING ELSE MOVED.** The bar from 80.0.7 (smaller turntable, smaller controls,
  every control kept), the staircase's steps and placement, the bubbles, the album
  pill dock, the letter covers and the lyrics view are untouched. Classic layout
  keeps its own tabs and its full player.
- **THE REPIN.** `dev/repin-8008.mjs`: live pin 80.0.7 -> **80.0.8**, adjacency
  `PREV` 80.0.6 -> **80.0.7**, both regex spellings swept, `--check` clean in 0.
  127 edits across 52 gate files.
- **THE OTA BUNDLES.** Root {{ROOT}} bytes, Play {{PLAY}}, rebuilt to a fixed point
  in the runner and both `--check`s green on the tree that ships.
- **THE ONE RED LEFT** is `media-controls-check` **66/1**, the recorded pre-existing
  red this repository has carried for months.
