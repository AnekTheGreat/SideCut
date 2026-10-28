#!/usr/bin/env python3
"""80.3.7 - ColorOS is on the wall under the name the owner looked for, the badge
themes are out of the way, and the widget's colours stop being twelve shades of
night.

The owner's ask, verbatim (one message, four asks):

    "where's the color os theme and all non badge themes should be before the
     badge themes in line and make it more smooth and why are the widgits colors
     so dark make them nice and fun, make the app nice and user friendly"

Three of those four turned out to be one bug: 80.3.6 shipped the ColorOS-inspired
theme as "Prism", at the BOTTOM of the dynamic group, below Vortex (a 200-badge
reward) - so the owner opened the wall, saw a locked theme where the new one
should be, and concluded the theme was not there at all.

The edits live in modules beside this file, as 80.3.2's through 80.3.6's did:

    patch_8037_theme.py   ColorOS: the prism entry's label, palette and backdrop
    patch_8037_wall.py    three groups (rewards last), fresh-first, the palette chip
    patch_8037_motion.py  the staggered group open, the NEW tag, the theme settle
    patch_8037_widget.py  six bright presets, a bright default, a readable label

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-8037.py
    python3 dev/patch-8037.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.3.7'
OLD_VERSION = '80.3.6'
MARKER = '80.3.7 - THE COLOROS WALL'

sys.path.insert(0, HERE)

import patch_8037_motion    # noqa: E402
import patch_8037_theme     # noqa: E402
import patch_8037_wall      # noqa: E402
import patch_8037_widget    # noqa: E402


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8037: %s appears %d times, expected 1 (marker: %s)'
                         % (what, src.count(old), old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'The theme this app added yesterday is called <b>ColorOS</b> now, and it is the first thing in its group with a NEW tag on it. It was on the wall the whole time, sitting four rows below a badge reward nobody can pick yet \u2014 which is exactly what this release fixes.',
        'Every <b>badge theme</b> has moved to its own group at the bottom of the list, so all the free themes come first, in one line, with nothing locked in between. The rewards still say what they cost and still unlock the same way; they are just out of the way until you have the badges.',
        'ColorOS is recoloured to what ColorOS actually looks like: deep teal-black, a <b>mint</b> accent, aqua behind it, and a curtain of two soft pools drifting for twenty seconds. Same key underneath, so a phone that already picked it keeps its pick.',
        'Each row in the wall now shows the theme itself \u2014 a chip of its background, its accent and its second accent \u2014 instead of a single dot of one colour. Two themes with the same accent no longer look identical.',
        'Opening a group <b>staggers</b> its rows in, 14ms apart, and picking a theme settles the sheet instead of snapping to a repainted screen. Both read the motion the app already had; both stop dead when Reduce motion is on.',
        'The widget has <b>six bright presets</b> \u2014 Bubblegum, Mint, Sunshine, Sky, Tangerine, Grape \u2014 with dark text on light gradients, listed first, and a fresh install starts on Bubblegum. The twelve dark ones are all still there with their colours and their saved picks.',
        'The widget picker used to write each preset\u2019s name in that preset\u2019s own text colour, which is invisible for a light one on the dark sheet. The name is the app\u2019s ink now and the swatch beside it shows the colours.',
        'Nothing else moved \u2014 the player, the library, the albums, the lyrics, the downloader, the Studio and the audio graph are untouched.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'ColorOS is on the theme wall, the badge themes come last, and the widget gets bright colours',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', ColorOS is first in its group, the badge '
              'themes are last and the widget has its bright presets')
        print('patch-8037%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8037 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8037: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)

    # 1. ColorOS: the label, the palette, the backdrop.
    page = swap(page, patch_8037_theme.THEME_OLD, patch_8037_theme.THEME_NEW,
                'the prism entry in THEMES')
    page = swap(page, patch_8037_theme.CSS_OLD, patch_8037_theme.CSS_NEW,
                'the prism backdrop')

    # 2. The wall: three groups, fresh first, the palette chip, the NEW tag.
    page = swap(page, patch_8037_wall.GROUP_OLD, patch_8037_wall.GROUP_NEW,
                'the theme grouping')
    page = swap(page, patch_8037_wall.RENDER_OLD, patch_8037_wall.RENDER_NEW,
                'the group order on the wall')
    page = swap(page, patch_8037_wall.SWATCH_OLD, patch_8037_wall.SWATCH_NEW,
                'the theme chip')
    page = swap(page, patch_8037_wall.ROW_OLD, patch_8037_wall.ROW_NEW,
                'the theme row')

    # 3. The motion: the staggered open, the tag, the settle.
    page = swap(page, patch_8037_motion.CSS_ANCHOR, patch_8037_motion.CSS_NEW,
                'the wall motion')
    page = swap(page, patch_8037_motion.SETTLE_ANCHOR, patch_8037_motion.SETTLE_NEW,
                'the theme settle')
    page = swap(page, "  // 80.3.7 - and the sheet you picked it in settles",
                "  // " + MARKER + "\n  // 80.3.7 - and the sheet you picked it in settles",
                'the release comment')

    # 4. The widget: six bright presets, the bright default, the readable label.
    page = swap(page, patch_8037_widget.PRESETS_ANCHOR, patch_8037_widget.PRESETS_NEW,
                'the six bright widget presets')
    page = swap(page, patch_8037_widget.DEFAULT_OLD, patch_8037_widget.DEFAULT_NEW,
                'the default widget theme')
    page = swap(page, patch_8037_widget.LABEL_OLD, patch_8037_widget.LABEL_NEW,
                'the widget picker label')

    # 5. The changelog head and the version.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8037: the page did not end up 80.3.7 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8037: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 6. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8037: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: ColorOS (label, palette, backdrop), three wall groups with the rewards last, '
          'the fresh-first order, the palette chip, the NEW tag, the staggered open and the theme '
          'settle, six bright widget presets, the bright default, the readable picker label, the '
          'changelog head and the shell cache')
    print('patch-8037: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.3.7';", 'the page runs 80.3.7'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.3.7', date:", 'the changelog records the release'),
    # ColorOS
    ("prism:       {  name: 'ColorOS (dynamic)',", 'the theme is called ColorOS'),
    ("dynamic:'prism', fresh:true }", 'it is marked fresh and keeps its key'),
    ('rgba(55,230,196,0.34)', 'the backdrop is the mint one'),
    ('animation: sd-dyn-drift 20s ease-in-out infinite;', 'it drifts at twenty seconds'),
    # the wall
    ('const groups = { static: [], dynamic: [], reward: [] };', 'there are three groups'),
    ('if(th.reward){ groups.reward.push(key); return; }', 'a reward never joins a free group'),
    ("themeGroupHTML('Badge rewards (earned)', groups.reward, false)", 'and is printed last'),
    ('const freshTag = th.fresh', 'the new theme wears a tag'),
    ("(th.bg || '#0E1B1F') + ' 0 33%", 'the chip shows the background'),
    # the motion
    ('.sc-new-tag{', 'the tag is styled'),
    ('animation: scThemeRowIn var(--sc-t-fade) var(--sc-e-out) both;', 'a group opens row by row'),
    ('.sc-theme-settle{ animation: scSheetSettle var(--sc-t-view) var(--sc-e-out); }',
     'a theme change settles the sheet'),
    ('function scThemeSettle(){', 'the settle has one implementation'),
    # the widget
    ("label: 'Bubblegum'", 'Bubblegum is a preset'),
    ("label: 'Grape'", 'so is Grape'),
    ("let widgetThemeKey = 'candy';", 'a fresh install starts bright'),
]

GONE = [
    ("const APP_VERSION = '80.3.6';", 'the old version constant'),
    ("prism:       {  name: 'Prism (dynamic)',", 'the label nobody could find'),
    ('const groups = { static: [], dynamic: [] };', 'the two-group wall'),
    ("color:' + t.title + '; vertical-align:middle;", 'the picker label in the preset colour'),
    ('linear-gradient(158deg, #0b0f1f, #1b1440, #0e2b46, #2a1246);', 'the blue-black backdrop'),
]


if __name__ == '__main__':
    sys.exit(main())
