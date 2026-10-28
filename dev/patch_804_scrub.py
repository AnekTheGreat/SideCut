"""80.4, section 2 - the word leaves the page, in every case it appears.

The owner's ask, verbatim:

    "you don't need to mention color os anywhere in the app or themes or patch
     notes dawg"

The name is gone from the theme entry itself (patch_804_theme.py), but it was also
in four other places, and a rename that leaves the old word in a comment is a
rename the owner would find on the next grep:

  * the changelog TITLE for 80.3.7;
  * the two 80.3.7 changelog ITEMS that named the palette after the brand;
  * the comment above the backdrop rule in the stylesheet;
  * the comment block above the theme entry, and the release marker 80.3.7 left
    in the script.

Each is rewritten to say what the thing is rather than which phone it imitates.
Nothing about behaviour is touched here - this module is text, and the driver
asserts the page ends with zero case-insensitive occurrences of the word.

The one consequence worth naming: 80.3.7's idempotency marker changes, so
`dev/patch-8037.py --check` no longer reports "already applied" on this page. That
is correct - the page is 80.4 now and every release from here on is measured
against 80.4's payload, not 80.3.7's. No released artefact depends on the old
marker: 80.3.7's commit is already in the history with the page it shipped.

Imported by dev/patch-804.py; holds constants only.
"""

# (old, new, what) - each string appears exactly once in the page.
SCRUBS = [
    (
        "'ColorOS is on the theme wall, the badge themes come last, and the widget gets bright colours'",
        "'The theme wall puts the badge themes last, and the widget gets bright colours'",
        'the 80.3.7 changelog title',
    ),
    (
        'The theme this app added yesterday is called <b>ColorOS</b> now, and it is the first thing in its group with a NEW tag on it.',
        'The theme this app added yesterday has a proper name now, and it is the first thing in its group with a NEW tag on it.',
        'the 80.3.7 changelog item that named the theme',
    ),
    (
        'ColorOS is recoloured to what ColorOS actually looks like: deep teal-black, a <b>mint</b> accent, aqua behind it, and a curtain of two soft pools drifting for twenty seconds. Same key underneath, so a phone that already picked it keeps its pick.',
        'It is recoloured to a deeper, calmer teal: a <b>mint</b> accent, aqua behind it, and a curtain of two soft pools drifting for twenty seconds. Same key underneath, so a phone that already picked it keeps its pick.',
        'the 80.3.7 changelog item that described the palette by brand',
    ),
    (
        '/* 80.3.7 - COLOROS. The curtain behind the app: a mint pool at the top left, an',
        '/* 80.3.7 - THE CURTAIN. Behind the app: a mint pool at the top left, an',
        'the stylesheet comment above the backdrop',
    ),
    (
        '    // 80.3.7 - COLOROS. 80.3.6 shipped this theme as "Prism", which is not what\n'
        '    // anyone would look for, and put it at the bottom of the wall below a badge\n'
        '    // reward - so it read as missing. The label is ColorOS now. The key stays\n'
        '    // `prism`, and so does the dynamic class: a phone that already picked it keeps\n'
        '    // its pick, its prepaint cache and its backdrop, with nothing to migrate.\n'
        '    // Palette: deep teal-black, mint accent, aqua second - the light values\n'
        '    // ColorOS 17\'s dark mode is built from, not a neon pair.',
        '    // 80.3.7 - LAGOON. 80.3.6 shipped this theme as "Prism", which is not what\n'
        '    // anyone would look for, and put it at the bottom of the wall below a badge\n'
        '    // reward - so it read as missing. It is named for what it looks like now. The\n'
        '    // key stays `prism`, and so does the dynamic class: a phone that already picked\n'
        '    // it keeps its pick, its prepaint cache and its backdrop, with nothing to\n'
        '    // migrate. Palette: deep teal-black, mint accent, aqua second - the light\n'
        '    // values a system dark mode is built from, not a neon pair.',
        'the comment block above the theme entry',
    ),
    (
        '  // 80.3.7 - THE COLOROS WALL',
        '  // 80.3.7 - THE WALL THAT PUT THE BADGE THEMES LAST',
        "80.3.7's marker in the script",
    ),
]
