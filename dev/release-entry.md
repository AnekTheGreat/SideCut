## 80.6.1 ({{STAMP}}): the glass is ice

- **THE OWNER'S ASK, VERBATIM.** *"the frosted design should be much more icy and nice like iOS v80.6.1"*.
  80.6 shipped an evenly milky pane, and even milk reads as a grey sheet on a phone: no cool in it, the lit
  corner barely lighter than the rest, a flat 1px border in the preview where iOS glass has a rim and a
  sheen.
- **THE PRESET WENT COOL.** `frost` is now `#E4F1FF → #A9C6E6` — pale ice where the light lands, cool steel
  at the far corner — with `#0A1A2E` navy type, a `#39557A` artist line and a **cyan** `#46C8F5` accent for
  the playing bars (it was a flat `#2F6BFF` blue).
- **THE ICE LIFT.** Mixing toward white alone gives chalk. `scFrostIce()` pulls red and pushes blue, scaled
  by the dial, so thick frost reads colder rather than greyer: at 100 the far stop is `rgb(184,214,249)`,
  at 0 `rgb(174,201,232)`. The dial's ends moved with the palette too — opacity 0.52 → 0.88 (was 0.44 →
  0.88) and white mix 0.30 → 0.55 / 0.06 → 0.26, so the thinnest pane is milkier and the type stays
  readable on a busy photo while the thickest is still see-through.
- **THE PREVIEW IS A MATERIAL, NOT A FILL.** The wallpaper strip now has five stops of colour, the pane
  blurs at `saturate(1.35) brightness(1.06)`, a white rim (`inset 0 0 0 1px`, alpha 0.22 → 0.56 with the
  dial) runs the edge, a `inset 0 1px 0` highlight sits on top of it, a 135° specular gradient falls across
  the top-left corner, and the whole panel rests on `0 10px 26px rgba(0,0,0,0.38)`.
- **WHAT THE WIDGET GETS, AND WHAT IT CANNOT.** The wallpaper's blur, the rim and the sheen are
  preview-only — a RemoteViews widget draws a bitmap, not a filter, so the home-screen pane receives the
  icy colours, the milk and the cyan bars and nothing else. Saying so beats shipping a preview that
  promises a filter the widget has no way to run.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-8061.py` (1 step) then `--check` (0 steps);
  every inline script block parses; and `node dev/check-8061.cjs` drives the page's own
  `scFrostIce()`/`scFrostGlass()` at 0/55/100 — alpha rising, thin end ≥ 0.52, thick end still under 0xF2,
  green rising with the dial, blue-minus-red positive and larger at the thick end (58 → 65), the 100 stop
  at `rgb(184,214,249)`, navy type at every level — **26/26**, plus the rim, sheen, shadow and cache name.
- **THE FIRST CHECK HAD A CHANNEL BUG.** `check-806.cjs` parsed `#AARRGGBB` from index 1, so its colour
  comparisons were really looking at alpha and red; the alpha assertions were right and the colour ones
  were weaker than they read. This release's check starts at 3 and says so in a comment. 80.6's palette is
  superseded here either way.
- **IT SHIPS OVER THE AIR.** OTA root **{{ROOT}} bytes**, store channel **{{PLAY}} bytes**; the APK the
  widget runs in does not change.
