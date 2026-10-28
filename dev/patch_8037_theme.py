"""80.3.7, section 1 - the theme gets the name the owner was looking for.

The owner's ask, verbatim:

    "where's the color os theme"

THE NAME WAS THE BUG. 80.3.6 shipped the ColorOS-inspired theme as "Prism", and
it went to the END of the dynamic group - below Vortex, which is a badge reward
most readers cannot even pick. So the owner opened the wall, saw a locked theme
where the new one should be, and reasonably concluded the theme was not there.
Two things fix it and only one of them is a rename:

  * the LABEL says ColorOS, which is what a reader looks for;
  * the KEY does not change. It stays `prism`, and `dynamic:'prism'` stays too, so
    a phone that already picked it keeps the pick, the prepaint cache and the
    backdrop with no migration, and no saved theme silently falls back to Coral.

The palette is recoloured to what ColorOS 17 actually looks like in the dark: a
deep teal-black rather than a blue-black, mint as the accent, aqua as the second,
and a backdrop of two soft pools - mint above, aqua below - over a dark core. The
`fresh:true` flag is this release's, not the theme's: it puts the entry first in
its group and wears a NEW tag, and it goes away with the next release.

Imported by dev/patch-8037.py; holds constants only.
"""

# The whole Prism entry, as 80.3.6 wrote it.
THEME_OLD = """    // 80.3.6 - Prism. Cool and glassy at the top of the screen, warm under it,
    // accents light enough to stay readable on both: the palette is a phone
    // theme rather than a neon one. Free like every other theme since 70.1.3.
    prism:       {  name: 'Prism (dynamic)',      bg:'#0b0f1f', bgRaised:'#161c33', coral:'#8FE3FF', gold:'#C6A6FF', dynamic:'prism'  }"""

THEME_NEW = """    // 80.3.7 - COLOROS. 80.3.6 shipped this theme as "Prism", which is not what
    // anyone would look for, and put it at the bottom of the wall below a badge
    // reward - so it read as missing. The label is ColorOS now. The key stays
    // `prism`, and so does the dynamic class: a phone that already picked it keeps
    // its pick, its prepaint cache and its backdrop, with nothing to migrate.
    // Palette: deep teal-black, mint accent, aqua second - the light values
    // ColorOS 17's dark mode is built from, not a neon pair.
    prism:       {  name: 'ColorOS (dynamic)',    bg:'#07181A', bgRaised:'#0E2A2C', coral:'#37E6C4', gold:'#7FD1FF', dynamic:'prism', fresh:true }"""

# The whole 80.3.6 backdrop, ending at its own reduced-motion media query.
CSS_OLD = """/* 80.3.6 - PRISM. Two soft pools of colour over a deep blue-black core, the same
   four-layer build the v60 themes use, drifting a little slower than Neon Pulse
   and a little faster than Abyss. The generic sheen that every
   `[class*="theme-dyn-"]` body already gets lays over this; nothing about it
   needed a second rule. */
body.theme-dyn-prism::before{
  content:''; position:fixed; inset:-20%; z-index:-1; pointer-events:none;
  background:
    radial-gradient(42% 46% at 26% 28%, rgba(143,227,255,0.40), transparent 62%),
    radial-gradient(36% 42% at 74% 66%, rgba(198,166,255,0.38), transparent 62%),
    radial-gradient(30% 34% at 52% 10%, rgba(24,22,70,0.66), transparent 66%),
    linear-gradient(158deg, #0b0f1f, #1b1440, #0e2b46, #2a1246);
  animation: sd-dyn-drift 17s ease-in-out infinite;
}
body.sandbox-reduce-motion.theme-dyn-prism::before{ animation: none !important; }
@media (prefers-reduced-motion: reduce){ body.theme-dyn-prism::before{ animation: none !important; } }"""

CSS_NEW = """/* 80.3.7 - COLOROS. The curtain behind the app: a mint pool at the top left, an
   aqua pool at the bottom right, a dark teal core, and a base that runs from the
   theme's own background into a deeper green-blue. Same four-layer build as the
   v60 themes and the same `sd-dyn-drift` keyframes, at 20 seconds - calmer than
   everything except Abyss's 24, which is what a system theme's wallpaper does.
   The selector still says prism because the key does: see patch_8037_theme.py. */
body.theme-dyn-prism::before{
  content:''; position:fixed; inset:-20%; z-index:-1; pointer-events:none;
  background:
    radial-gradient(44% 48% at 28% 24%, rgba(55,230,196,0.34), transparent 62%),
    radial-gradient(38% 44% at 74% 70%, rgba(127,209,255,0.32), transparent 62%),
    radial-gradient(32% 36% at 50% 6%, rgba(4,34,36,0.72), transparent 66%),
    linear-gradient(158deg, #07181a, #0b3436, #103449, #0a2a24);
  animation: sd-dyn-drift 20s ease-in-out infinite;
}
body.sandbox-reduce-motion.theme-dyn-prism::before{ animation: none !important; }
@media (prefers-reduced-motion: reduce){ body.theme-dyn-prism::before{ animation: none !important; } }"""
