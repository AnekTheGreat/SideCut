## 80.6 ({{STAMP}}): a frosted-glass widget, and a Frost dial to tune it

- **THE OWNER'S ASK, VERBATIM.** *"add a transparent frosted type widgit with a frosted adjustable thing
  so you can tune it"*. One nineteenth preset, first in the list, and one 0-100 dial that owns its look.
- **THE GLASS IS REAL TRANSPARENCY, NOT A PICTURE OF IT.** `WIDGET_THEMES.frost` is an ordinary opaque
  preset with `glass: true`. At push time `scFrostGlass()` turns its two background stops into
  `#AARRGGBB`, which is what the native provider feeds `Color.parseColor` and `LinearGradient` — the
  bitmap is `ARGB_8888` and the widget root has no background of its own, so the wallpaper genuinely
  shows through the panel. No bridge call, no new native key, no APK rebuild: the page already pushes the
  theme object on every heartbeat.
- **WHAT THE WIDGET CANNOT DO, SAID PLAINLY.** A RemoteViews widget cannot blur what is behind it — there
  is no backdrop filter and no way to read the wallpaper. So the "frost" is the milk in the glass: the
  panel is mixed toward white, and both the mix and the opacity follow the dial. The blur exists in the
  preview only, because a browser is the one place it can.
- **THE DIAL.** `widgetFrost`, 0-100, default 55, kept in `localStorage` (`sidecut_widgetFrost`) and clamped
  on read so a hand-edited store cannot ask for a colour the layout has no shape for. Opacity runs
  0.44 → 0.88 and the white mix 0.12 → 0.40 on the first stop, 0.04 → 0.18 on the second, so 0 is a thin
  pane the wallpaper tints and 100 is a soft near-solid one. `input` repaints the preview only; `change`
  pushes once, so a drag is one bridge call rather than sixty.
- **THE DIAL IS HIDDEN, NOT DISABLED, ON THE OTHER PRESETS.** The row shows only when the preset is glass
  and the widget is not following the app theme (following it replaces the preset with the app's own
  colours, so the dial would tune a glass that is not being drawn). The eighteen existing presets keep the
  exact panel they had — `getWidgetTheme()` only routes through the glass when the merged theme says so.
  Fine-tune still wins over the preset: an override keeps its colour and simply gains the glass.
- **THE PREVIEW GREW A BACKDROP.** The tile moved into `scWidgetPreviewBody()` so both branches paint the
  same widget; the glass branch draws it over a strip of colour with `backdrop-filter`, so the dial has
  something to act on and the panel visibly blurs. The opaque branch is what it was in 80.5.2.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-806.py` (1 step) then `--check` (0 steps);
  **every inline script block parses**; and `node dev/check-806.cjs` extracts the page's own
  `scFrostGlass()` (the function text, not a copy) and drives it at frost 0/55/100 — ARGB shape, alpha
  ordering thin→thick, both ends still translucent, white rising with the dial, dark type at every level,
  CSS getting `rgba()` and never ARGB. 29/29 green, including the dial's wiring and the cache name.
- **IT SHIPS OVER THE AIR.** OTA root **{{ROOT}} bytes**, store channel **{{PLAY}} bytes**; the APK the
  widget runs in does not change.
