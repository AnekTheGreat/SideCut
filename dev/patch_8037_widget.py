"""80.3.7, section 4 - the widget's colours stop being twelve shades of night.

The owner's ask, verbatim:

    "why are the widgits colors so dark make them nice and fun"

WHY THEY WERE ALL DARK. Every preset was built as two background stops in the
same narrow band - #0E2A47 down to #000000 - because the widget's very first
palette was a dark one and each addition copied its shape. Two of the twelve were
literally near-black (`black`, `dark`), and the brightest was a mid teal. Nothing
was wrong with them as colours; there was simply no light one to choose.

WHAT THIS ADDS. Six bright presets - Bubblegum, Mint, Sunshine, Sky, Tangerine,
Grape - each a light-to-mid gradient with a dark title, a dark artist line and a
saturated accent. They ride the same payload the native side already reads
(`bg1`, `bg2`, `title`, `artist`, `accent`, `pill`, `eq`), so nothing on the
native side changed: the provider renders the gradient bitmap and sets the text
colours, exactly as it does for the dark set.

Two consequences, both deliberate:

  * THEY COME FIRST in the object, so the grid opens on the fun ones. Everything
    that was there keeps its key and its colours - a phone that picked Rosewood
    still has Rosewood - and `ocean` stays the fallback for an unknown key.
  * A FRESH INSTALL STARTS ON BUBBLEGUM, not on Deep Ocean. That is the only
    saved value this release changes, and it only exists where nothing has been
    chosen yet.

THE LABEL HAD TO FOLLOW. The picker painted each row's name in the preset's own
`title` colour - white for the dark set - which on a light preset is a dark
near-black on the dark settings sheet: invisible. The name is drawn in the app's
own ink now, and the swatch beside it is what shows the colours.

Imported by dev/patch-8037.py; holds constants only.
"""

# The head of the preset table.
PRESETS_ANCHOR = "  const WIDGET_THEMES = {\n"

PRESETS_NEW = """  const WIDGET_THEMES = {
    // 80.3.7 - SIX BRIGHT ONES, FIRST. Every preset below this block is a dark
    // palette, which is what the widget shipped with and never grew out of. These
    // are light gradients with a dark title, a dark artist line and a saturated
    // accent - the same nine keys the native provider reads, so nothing on the
    // Android side had to change to draw them.
    candy:  { label: 'Bubblegum',           bg1: '#FFD3E8', bg2: '#FF97C4', title: '#3A0A22', artist: '#7A2A4E', accent: '#D6196F', accentText: '#FFFFFF', pill: '#FFB3D6', pillText: '#4A0C2A' },
    mint:   { label: 'Mint',                bg1: '#C9F7E2', bg2: '#8CE7C6', title: '#06291F', artist: '#2C6A57', accent: '#0B8F6C', accentText: '#FFFFFF', pill: '#ADEFD4', pillText: '#0A3A2C' },
    sunny:  { label: 'Sunshine',            bg1: '#FFEFAE', bg2: '#FFC63A', title: '#3A2600', artist: '#7A5812', accent: '#C77400', accentText: '#FFFFFF', pill: '#FFE39B', pillText: '#3A2600' },
    sky:    { label: 'Sky',                 bg1: '#CFE7FF', bg2: '#98C8FA', title: '#0A2440', artist: '#2C5A83', accent: '#0F6FCB', accentText: '#FFFFFF', pill: '#B6DAFF', pillText: '#0A2440' },
    tangerine: { label: 'Tangerine',        bg1: '#FFDCC2', bg2: '#FFAE6E', title: '#371500', artist: '#7A3A12', accent: '#C9541A', accentText: '#FFFFFF', pill: '#FFC9A3', pillText: '#371500' },
    grape:  { label: 'Grape',               bg1: '#E6DCFF', bg2: '#BFA4FF', title: '#241045', artist: '#4E3480', accent: '#6E3FD6', accentText: '#FFFFFF', pill: '#D3C1FF', pillText: '#241045' },
"""

# A fresh install starts on a bright one. An unknown key still falls back to ocean.
DEFAULT_OLD = "  let widgetThemeKey = 'ocean';"

DEFAULT_NEW = """  // 80.3.7 - a fresh install starts on Bubblegum rather than Deep Ocean. Only a
  // phone that has never picked a widget theme is affected: the saved key wins as
  // it always did, and an unknown key still falls back to ocean below.
  let widgetThemeKey = 'candy';"""

# The picker's row label: the app's ink, not the preset's title colour.
LABEL_OLD = "'<span style=\"font-size:12.5px; font-weight:600; color:' + t.title + '; vertical-align:middle;\">' + t.label + '</span></button>';"

LABEL_NEW = "'<span style=\"font-size:12.5px; font-weight:600; vertical-align:middle;\">' + t.label + '</span></button>';"
