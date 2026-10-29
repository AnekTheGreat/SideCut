## 80.6.6 ({{STAMP}}): Amber dusk is a theme, and the glass has its name

- **THE ASK.** *"this being an actual theme would be pretty cool and where is the liquid one"* - two things,
  and the second one turned out to be a **naming bug**, not a missing feature.
- **AMBER DUSK IS ON THE THEME WALL.** `THEMES.amberdusk` - `bg #171307`, `bgRaised #271F0E`,
  `coral #FFC24A`, `gold #C9B86A`. The 80.6.5 widget palette as a wall: near-black olive behind everything,
  a raised olive panel, the sun gold as the accent. No `rgb`, no `dynamic`, no `reward`, so
  `renderThemeOptions()` files it under **Static themes**; it carries `fresh:true`, which puts it first in
  that group and puts a **NEW** tag on its row **for this release only** (the flag lives on the entry and
  leaves with it - there is no second list to keep in sync). The wall has no light theme, so the background
  is held dark: white ink on it is **18:1**, the gold on it **11:1**, dark type on the gold **13:1**.
- **THE LIQUID ONE WAS ALWAYS THERE.** The glass widget has been **first** on the shelf since 80.6 - it was
  labelled *Frosted glass*, so anyone looking for "liquid" found nothing. It is **Liquid glass** now. The
  **key stays `frost`**, which is what a phone's saved pick, the fine-tune swatches and every pushed payload
  actually carry, so nothing migrates and nothing is lost. Same nine colours, same Frost dial, still the only
  glass preset.
- **THE PANE READS AS GLASS AGAIN, WITHOUT GETTING THICKER.** 80.6.3 thinned it far enough that the preview
  stopped looking like a lens - the colour strip behind it came through nearly untouched. The fix is **not
  more milk** (that would undo what was asked two releases ago): the drifting **specular band** goes from
  0.34 to **0.52** white and widens, the top rim 0.55 -> **0.72**, the edge 0.20 -> **0.26**, and the backdrop
  is pushed at **saturate(1.45)** instead of 1.9 so the pane sits *on* the colour rather than vanishing into
  it. `alpha` is still **0.32 -> 0.62** - the transparency is untouched, and the check asserts that it is.
- **VERIFIED ON THE PAGE THAT SHIPS.** `python3 dev/patch-8066.py` (1 step) then `--check` (0 steps); every
  inline script block parses; `dev/check-8066.cjs` passes **37/37**. It slices **both** tables out of
  `index.html` (never copies) and evaluates them: the theme lands in the Static group by
  `renderThemeOptions()`'s own rule, it is the only fresh static entry, exactly four themes are still badge
  rewards, its contrast numbers are computed from the shipped hex, the widget key `frost` survives the
  rename and still leads the shelf, twenty presets remain, and the sheen moved while `alpha` did not.
  The OTA bundles reach a true fixed point in the release step - root + `ota/` **{{ROOT}}** bytes,
  `ota-play/` **{{PLAY}}** bytes, both `--check`s OK at v80.6.6.
- **NOT CLAIMED.** Nobody has worn the theme on a phone, and the band/rim/blur are **Settings-preview only** -
  the home-screen widget is a RemoteViews bitmap and draws a colour, not a filter (true since 80.6). No native
  change, so this rides the OTA bundle; the installed APK needs nothing rebuilt.
