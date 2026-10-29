#!/usr/bin/env python3
"""80.6.5 - a twentieth widget preset: the warm gold-to-charcoal one.

The owner's ask, verbatim:

    "make another version of the widgit like the Samsung widgit color"

What the screenshot shows. The phone's own weather widget is a rounded pane whose
top-left corner is a gold-olive (#7C6A2C-ish) and whose bottom-right is almost
black, with warm off-white type, a dim sand line under it and a sun-gold accent.
Every dark preset this app shipped is a cold or neutral night (Ocean, Midnight,
Slate, Aurora) and every bright one is candy; there was nothing warm and graded,
which is the one look the screenshot is actually wearing.

So: one more entry in WIDGET_THEMES, the same nine keys the native provider
already reads (two background stops it renders as one gradient bitmap, a title and
an artist colour it sets with setTextColor, an accent for the playing bars, and a
pill pair). Nothing on the Android side changed, nothing new is pushed, and the
preset is OPAQUE - not a glass preset - because the widget in the screenshot is
opaque and because the Frost dial would then have two presets claiming it.

WHERE IT SITS. The grid is Object.keys(WIDGET_THEMES) in declaration order, so the
line goes at the END of the bright block, immediately above coral: bright ones
still lead, the new warm one closes them, and the dark block is untouched.

THE ONE CONSTRAINT THAT SHAPED THE COLOURS. The title is painted across the whole
panel, so it has to be readable on the LIGHT end of the gradient, not just the
dark one. #FFF6E6 on #7C6A2C is 4.96:1 and the artist line on the same stop is
3.80:1 - both over the WCAG body/large-text floors - and dev/check-8065.cjs
asserts those numbers rather than trusting this comment.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8065.py
    python3 dev/patch-8065.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.5'
OLD_VERSION = '80.6.4'
MARKER = '80.6.5 - THE WARM DUSK WIDGET'

# ---------------------------------------------------------------------------
# 1. The preset, at the end of the bright block.
# ---------------------------------------------------------------------------
PRESET_ANCHOR = ("    grape:  { label: 'Grape',               bg1: '#E6DCFF', bg2: '#BFA4FF', "
                 "title: '#241045', artist: '#4E3480', accent: '#6E3FD6', accentText: '#FFFFFF', "
                 "pill: '#D3C1FF', pillText: '#241045' },\n")

PRESET_ADD = PRESET_ANCHOR + """    // 80.6.5 - THE WARM ONE. A gold-olive top fading to deep charcoal with warm
    // off-white type and a sun-gold accent - the graded palette the phone's own
    // weather widget wears, and the one look this shelf was missing: every dark
    // preset here is a cold or neutral night and every bright one is candy.
    //
    // bg1 is held at #7C6A2C rather than a brighter gold because the TITLE is
    // drawn across the whole panel: white-warm type on that stop is 4.96:1 (and
    // the artist line 3.80:1), which the release check measures. It is opaque on
    // purpose - a glass preset would be a second claim on the Frost dial.
    amberdusk: { label: 'Amber dusk', bg1: '#7C6A2C', bg2: '#171310', title: '#FFF6E6', artist: '#EBD8B4', accent: '#FFC24A', accentText: '#2A1B03', pill: '#332A18', pillText: '#FFF3DC' },
"""

# ---------------------------------------------------------------------------
# 2. The two counts that are now wrong: the blurb and a comment.
# ---------------------------------------------------------------------------
BLURB_OLD = ('Customize the home-screen widget: nineteen presets from bright to frosted glass, '
             'a Frost dial on the glass one,')
BLURB_NEW = ('Customize the home-screen widget: twenty presets from bright to frosted glass, '
             'a Frost dial on the glass one,')

COUNT_OLD = """    // 80.6 - the Frost dial. Shown only for a glass preset: it is the one preset
    // with a dial, and hiding (not disabling) it keeps the panel short for the
    // other eighteen."""

COUNT_NEW = """    // 80.6 - the Frost dial. Shown only for a glass preset: it is the one preset
    // with a dial, and hiding (not disabling) it keeps the panel short for the
    // other nineteen."""


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'A new widget preset, <b>Amber dusk</b>: a gold-olive top that fades down to deep charcoal, warm off-white type and a sun-gold accent. It is the graded warm palette the phone&rsquo;s own weather widget wears, and it sits with the bright presets, right above the dark ones.',
        'It is a <b>plain preset</b>, so it behaves like the rest: pick it in Settings &rsaquo; Widget, it applies to every widget you have placed, and the fine-tune palette still works on top of it.',
        'The <b>Frost dial stays on Frosted glass</b> and nowhere else &mdash; Amber dusk is opaque on purpose, so there is still exactly one glass preset to tune.',
        'Nothing else moved &mdash; the other nineteen presets, the glass, the glass preview, the playing bars, the idle saver, the player, the library and the audio graph are exactly as they were.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'A warm dusk widget', body))


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8065: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


CLAIMS = [
    ("const APP_VERSION = '80.6.5';", 'the page runs 80.6.5'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.5', date:", 'the changelog records the release'),
    ("    amberdusk: { label: 'Amber dusk', bg1: '#7C6A2C', bg2: '#171310',",
     'the warm preset is in the list'),
    ('twenty presets from bright to frosted glass', 'the blurb counts the shelf it has'),
    ('keeps the panel short for the\n    // other nineteen.', 'the dial comment counts them'),
]

GONE = [
    ("const APP_VERSION = '80.6.4';", 'the old version constant'),
    ('nineteen presets from bright to frosted glass', 'the old preset count'),
    ("    amberdusk: { label: 'Amber dusk', glass: true", 'a glass claim on the new preset'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the warm dusk preset is in the list')
        print('patch-8065%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8065 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8065: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, PRESET_ANCHOR, PRESET_ADD, 'the end of the bright preset block')
    page = swap(page, BLURB_OLD, BLURB_NEW, 'the Settings > Widget blurb')
    page = swap(page, COUNT_OLD, COUNT_NEW, 'the Frost dial comment')

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page,
                "// 80.6.4 - THE TRANSITION WAITS FOR A VISIBLE PAGE\nvar SC_IS_WEB = (function(){",
                "// 80.6.4 - THE TRANSITION WAITS FOR A VISIBLE PAGE\n// " + MARKER
                + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8065: the page did not end up 80.6.5 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8065: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8065: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the Amber dusk preset, the blurb and dial counts, the changelog head, '
          'the version and the shell cache')
    print('patch-8065: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
