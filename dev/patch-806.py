#!/usr/bin/env python3
"""80.6 - a frosted-glass widget, and a Frost dial to tune it.

The owner's ask, verbatim:

    "add a transparent frosted type widgit with a frosted adjustable thing so you
     can tune it"

A nineteenth preset, first in the list: a translucent panel with dark type that
lets the wallpaper through, plus one 0-100 dial that decides how much milk is in
the glass. The widget is a RemoteViews layout and cannot blur what is behind it,
so the transparency is real ARGB opacity and the frost is a white mix that both
the opacity and the colour follow - the preview in Settings does the blur, because
that is the one place a browser can.

The edits live in dev/patch_806_widget.py (constants only).

Idempotent: the marker is this release's page comment.

    python3 dev/patch-806.py
    python3 dev/patch-806.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6'
OLD_VERSION = '80.5.2'
MARKER = '80.6 - THE FROSTED GLASS AND ITS DIAL'

sys.path.insert(0, HERE)

import patch_806_widget     # noqa: E402


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-806: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:80].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def span_swap(src, start, end, new, what):
    """Replace everything from `start` to the end of `end`, inclusive.

    The preview's old body is a six-line string concatenation; quoting all of it
    into a constant is how a patch script grows typo-shaped bugs, so the region is
    named by its first and last line and the middle goes with it.
    """
    if src.count(start) != 1:
        raise SystemExit('patch-806: %s starts %d times, expected 1' % (what, src.count(start)))
    if src.count(end) != 1:
        raise SystemExit('patch-806: %s ends %d times, expected 1' % (what, src.count(end)))
    a = src.index(start)
    b = src.index(end, a) + len(end)
    return src[:a] + new + src[b:]


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'There is a <b>Frosted glass</b> widget now, and it is the first in the list. A translucent panel that lets the wallpaper through, with dark type on it, so it sits on a photo as well as it sits on a plain wall.',
        'It has a <b>Frost dial</b> &mdash; a slider in Settings &rarr; Widget, 0 to 100, that decides how much milk is in the glass. Left is thin and clear and the wallpaper tints the panel; right is a soft, nearly solid pane. It stays where you leave it.',
        'The <b>preview</b> in Settings shows the glass over a strip of colour, so the dial has something to act on, and the panel behind it blurs the way real glass does. Drag the slider and the preview moves with your finger; let go and the widget on your home screen takes the same setting.',
        'The preset carries its own <b>blue accent</b> for the playing bars and the fine-tune swatches still work on top of it &mdash; pick a background there and it keeps its colour, and simply gains the glass.',
        'Every other preset is untouched: the eighteen that were there draw exactly what they drew in 80.5.2, and the Frost dial is hidden unless you are on the glass one.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'A frosted-glass widget, and a Frost dial to tune it',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the glass preset and its dial are in it')
        print('patch-806%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-806 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-806: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    # 1. The preset, first in the object.
    page = swap(page, patch_806_widget.THEMES_ANCHOR, patch_806_widget.THEMES_ADD,
                'the head of the preset list')

    # 2. The dial's state, beside the theme key it belongs to.
    page = swap(page, patch_806_widget.STATE_ANCHOR, patch_806_widget.STATE_ADD,
                'the widget theme state')

    # 3. The glass math, the setter, and the call that uses them.
    page = swap(page, patch_806_widget.MATH_ANCHOR, patch_806_widget.MATH_ADD,
                'getWidgetTheme (the glass math goes above it)')
    page = swap(page, patch_806_widget.THEME_OLD, patch_806_widget.THEME_NEW,
                'the body of getWidgetTheme')

    # 4. The dial's card, and its wiring.
    page = swap(page, patch_806_widget.GRID_ANCHOR, patch_806_widget.GRID_ADD,
                'the preset grid')
    page = swap(page, patch_806_widget.WIRE_ANCHOR, patch_806_widget.WIRE_ADD,
                'the controls in Settings > Widget')

    # 5. The preview: the tile split out, both branches painting it, and the
    #    glass branch drawing over colour.
    page = span_swap(page, patch_806_widget.PREVIEW_START, patch_806_widget.PREVIEW_END,
                     patch_806_widget.PREVIEW_NEW, 'the body of renderWidgetPreview')
    page = swap(page, "  function renderWidgetPreview(){",
                patch_806_widget.BODY_FUNC + "  function renderWidgetPreview(){",
                'renderWidgetPreview (scWidgetPreviewBody goes above it)')

    # 6. The shelf has nineteen presets now, not eight.
    page = swap(page, patch_806_widget.BLURB_OLD, patch_806_widget.BLURB_NEW,
                'the Widget tab blurb')

    # 7. The changelog head, the version and the marker.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){",
                "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-806: the page did not end up 80.6 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-806: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 8. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-806: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the frosted preset, the Frost state and setter, the glass math in '
          'getWidgetTheme, the dial card and its wiring, the shared preview tile and the glass '
          'preview, the blurb, the changelog head, the version and the shell cache')
    print('patch-806: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.6';", 'the page runs 80.6'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6', date:", 'the changelog records the release'),
    ("frost:  { label: 'Frosted glass', glass: true,", 'the glass preset is first in the list'),
    ('let widgetFrost = 55;', 'the dial has state'),
    ('function scFrostGlass(base){', 'the glass math is in the page'),
    ('if(_wt && _wt.glass === true) _wt = scFrostGlass(_wt);', 'the push runs through it'),
    ('id="widgetFrostSlider" min="0" max="100" step="1"', 'the dial is a 0-100 slider'),
    ('frostSlider.addEventListener(\'input\'', 'the drag previews live'),
    ("frostSlider.addEventListener('change', () => { setWidgetFrost(frostSlider.value, true); });",
     'the release pushes it'),
    ('function scWidgetPreviewBody(t){', 'the preview tile is shared'),
    ("if(t.glass === true){", 'the preview has a glass branch'),
    ('nineteen presets from bright to frosted glass', 'the blurb counts the shelf it has'),
]

GONE = [
    ("const APP_VERSION = '80.5.2';", 'the old version constant'),
    ('eight presets', 'the old count in the blurb'),
]


if __name__ == '__main__':
    sys.exit(main())
