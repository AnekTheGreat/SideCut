"""80.3.6, section 3 - Prism, the theme after the smooth one.

The owner's ask, verbatim:

    "add an update which makes the whole app as smooth as color os 17 with
     another theme after it"

Prism is a STATIC palette with a DYNAMIC backdrop, which is the shape every
theme in the second half of the wall already has: `dynamic:'prism'` puts
`theme-dyn-prism` on the body, and the backdrop below is what that class paints.
It is free, like every other theme since 70.1.3 - no `premium`, no `reward`, no
lock, because the badge wall and the store wall were both taken out and a new
theme that arrived locked would be the only one.

WHY THESE COLOURS. ColorOS reads cool and glassy at the top of the screen and
warm at the bottom, and its accents are light values on deep backgrounds rather
than saturated mid-tones. So: bg #0b0f1f (a blue-black, not grey), raised
#161c33, accent #8FE3FF (a pale cyan that stays legible as text on both), second
accent #C6A6FF. The backdrop is four layers - two soft colour pools, one deep
core, one linear base - drifting on `sd-dyn-drift`, the keyframes 60.x already
ships, and the generic `[class*="theme-dyn-"]::after` sheen applies to it with no
extra rule.

NOTHING ELSE IS TOUCHED. `renderThemeOptions()` groups by `rgb`/`dynamic`, so a
new entry appears in the wall on its own; `applyTheme()` sets the four colours
and the body class on its own; the prepaint cache records it on its own. This
module adds one object and one stylesheet rule.

Imported by dev/patch-8036.py; holds constants only.
"""

# The last entry in THEMES, with the object's own closing brace on the next line.
THEMES_OLD = """    vortex:      {  name: 'Vortex (dynamic)',      bg:'#0a0718', bgRaised:'#1a1133', coral:'#9B7BFF', gold:'#63E2FF', reward:true, dynamic:'vortex'  }
  };"""

THEMES_NEW = """    vortex:      {  name: 'Vortex (dynamic)',      bg:'#0a0718', bgRaised:'#1a1133', coral:'#9B7BFF', gold:'#63E2FF', reward:true, dynamic:'vortex'  },
    // 80.3.6 - Prism. Cool and glassy at the top of the screen, warm under it,
    // accents light enough to stay readable on both: the palette is a phone
    // theme rather than a neon one. Free like every other theme since 70.1.3.
    prism:       {  name: 'Prism (dynamic)',      bg:'#0b0f1f', bgRaised:'#161c33', coral:'#8FE3FF', gold:'#C6A6FF', dynamic:'prism'  }
  };"""

# The end of the Orchid backdrop - the last of the v60 five - so Prism lands at
# the end of the block rather than between two themes that arrived together.
# Glacier also drifts on a 15 second cycle, so the anchor carries Orchid's own
# base gradient: that line is in the page exactly once.
CSS_ANCHOR = """    linear-gradient(158deg, #180a1a, #3a1038, #6b1a58, #3a1040);
  animation: sd-dyn-drift 15s ease-in-out infinite;
}"""

PRISM_CSS = CSS_ANCHOR + """

/* 80.3.6 - PRISM. Two soft pools of colour over a deep blue-black core, the same
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
