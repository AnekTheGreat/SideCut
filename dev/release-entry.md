## 80.6.5 ({{STAMP}}): a warm dusk preset for the widget

- **THE ASK.** *"make another version of the widgit like the Samsung widgit color."* In the screenshot the
  phone's own weather widget is a rounded pane graded from a **gold-olive** top corner down to near-black,
  with warm off-white type, a dim sand line beneath it and a **sun-gold** accent. Every dark preset this app
  shipped is a cold or neutral night (Ocean, Midnight, Slate, Aurora, Forest); every bright one is candy.
  There was nothing warm and graded, which is the one look the screenshot is actually wearing.
- **WHAT SHIPPED: ONE PRESET, `Amber dusk`.** `bg1 #7C6A2C` -> `bg2 #171310`, title `#FFF6E6`, artist
  `#EBD8B4`, accent `#FFC24A`, pill `#332A18`/`#FFF3DC`. It is the same **nine keys** the native provider
  already reads - two stops it renders as one gradient bitmap, the title/artist colours it sets with
  `setTextColor`, the accent it paints the playing bars with, the pill pair - so **nothing on the Android
  side changed**, no new bridge call, no APK rebuild. It sits at the **end of the bright block**, immediately
  above `coral`: bright ones still lead, this closes them, the dark block is untouched.
- **IT IS OPAQUE ON PURPOSE.** A `glass: true` preset would be a second claim on the **Frost dial**, and the
  dial is meant to tune one pane. So Amber dusk behaves like the other plain presets: pick it in
  Settings > Widget, it applies to every placed widget, and the fine-tune palette still layers on top.
- **THE COLOURS WERE CHOSEN AGAINST A MEASUREMENT, NOT BY EYE.** The title is painted across the *whole*
  panel, so the light end of the gradient is the worst case: `#FFF6E6` on `#7C6A2C` is **4.96:1** and the
  artist line on the same stop is **3.80:1**, both over the WCAG floors. `bg1` is held at that value rather
  than a brighter gold for exactly this reason.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-8065.py` (1 step) then `--check` (0 steps); every
  inline script block parses; `dev/check-8065.cjs` passes **23/23**. It slices the real `WIDGET_THEMES`
  literal out of `index.html` (never a copy), evaluates it, and reads it the way the native provider does:
  twenty presets, all nineteen earlier keys still present, **all nine fields on every preset**, **every
  colour a plain `#RRGGBB`**, the contrast ratios above computed from the shipped values, the preset's
  position in the grid, and **Frost still the only glass preset** so the dial cannot end up governing two.
  The OTA bundles reach a true fixed point in the release step - root + `ota/` **{{ROOT}}** bytes,
  `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.5.
- **NOT CLAIMED.** Nobody has looked at the new preset on a phone's home screen - the check proves the data
  the widget is handed is complete, parseable and readable, not how it renders behind a launcher's own
  clipping. Nothing moved in the glass, the glass preview, the playing bars, the idle saver, the player, the
  library, the lyrics or the audio graph.
