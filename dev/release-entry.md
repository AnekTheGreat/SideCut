## 80.6.3 ({{STAMP}}): the glass is liquid - thinner, clearer, and the highlight moves

- **THE OWNER'S ASK, VERBATIM.** *"make it liquidy like ios and less frosted and more transparent"*.
  Three words, one subject: the frosted widget 80.6 added and 80.6.1 froze. Both earlier passes answered
  "what colour is the milk" - this one takes the milk out.
- **THINNER, MEASURED RATHER THAN DESCRIBED.** The panel's alpha ran **0.52 -> 0.88** after 80.6.1;
  it runs **0.32 -> 0.62** now. At the thinnest setting the wallpaper is what you see, with a cool cast
  over it; at the thickest the pane is still plainly see-through, which is the half of the ask that
  0.88 was failing. Only the two stops and the dial's mapping moved - `scFrostGlass()` still returns
  `#AARRGGBB` for the widget and `rgba()` for CSS, so no native path was touched.
- **LESS MILK, MORE COLOUR.** The white mix is roughly halved: **0.16 -> 0.34** on the lit stop (was
  0.30 -> 0.55) and **0.02 -> 0.11** on the other (was 0.06 -> 0.26). The second stop goes a shade
  deeper (`#A9C6E6` -> `#96BCE2`) so a thinner pane keeps its colour instead of fading into the
  wallpaper, and the 80.6.1 ice lift is untouched, so thick still reads colder rather than chalkier.
  The type goes a step deeper with it (`#07182C`, artist `#2F4A6E`).
- **THE HIGHLIGHT MOVES NOW.** 80.6.1's sheen was a painted corner gradient; it is a `.sc-glass-liquid`
  layer with a specular band that travels across the pane on a **9s** loop, at rest at both ends so the
  restart is not a jump. That is the "liquid" half of the ask and it is real motion in the one place
  this app can draw a filter: **the Settings preview**. The home-screen widget is a RemoteViews bitmap -
  it draws a colour, cannot blur or refract - so what reaches the wallpaper is the transparency, not the
  band. Both Reduce-motion paths stop it and settle it mid-pane as a still sheen (the app's
  `sandbox-reduce-motion` class and the device's `prefers-reduced-motion`), and the check proves both.
- **THE PREVIEW IS A LENS.** A bright rim across the top **and** a soft one under the bottom (a one-edge
  rim reads as a sticker, two edges read as thickness), the backdrop pushed to
  `saturate(1.9) contrast(1.04) brightness(1.04)` with a slower-growing blur (`6 -> 18px`, was
  `8 -> 26px`) so a thinner pane shows saturated colour rather than a grey wash, and a deeper contact
  shadow so it sits on the strip of wallpaper instead of floating.
- **THE CAPTION STOPPED LYING.** The dial's copy promised "a soft, nearly solid pane" at the right end,
  which is exactly what this release removed. It now says what the two ends do, and names the trade the
  thinner end makes: type is easiest to read on a busy or very dark wallpaper. The dial itself, its
  0-100 range, its memory and its wiring are untouched.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-8063.py` (1 step) then `--check` (0 steps);
  **every inline script block parses** (7 blocks); and `dev/check-8063.cjs` passes **35/35** against the
  page as it stands. It drives the page's OWN `scFrostGlass()` (sliced out of `index.html`, not copied)
  at 0 / 55 / 100 and asserts what the release claims: both ends are thinner than 80.6.2's (cold
  `<= 0x56`, hot `<= 0xA4`, against its `0x85` / `0xE0`), the thick end is still translucent (`>= 0x90`),
  the white mixing is lower at both ends, the pane stays cool and gets icier with the dial, the type
  stays navy, CSS still receives `rgba()`, and the frost number still rides with the theme. On the
  preview it asserts the two-edge rim, the stronger backdrop push, the absence of the painted sheen, the
  liquid layer and its keyframes, and that **both** Reduce-motion paths switch the animation off. The
  preset keeps its `frost` key and its label, so a phone already on it keeps its pick and its dial.
  The OTA bundles reach a true fixed point in the release step - root + `ota/` **{{ROOT}}** bytes,
  `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.3.
- **WHAT IS NOT CLAIMED.** No phone and no screenshot: the **look** of a 0.32 pane over a photograph,
  and the rate of the band on a display, were not seen - what is proven is the alpha and colour the
  widget is handed, the CSS that animates the band and when it does not. The home-screen widget gets
  the transparency and the colour only; it has no blur, no rim and no band, and this release cannot
  give it one without a native change. The trade is stated rather than hidden: **the thinner the pane,
  the less contrast the dark type has over a very dark wallpaper** - the dial is the answer, and the
  caption says so. Nothing moved in the eighteen other presets, the app chrome's own Liquid glass mode,
  the player, the library, the lyrics or the audio graph.
