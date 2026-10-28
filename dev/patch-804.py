#!/usr/bin/env python3
"""80.4 - the theme list is back to one dot, the theme has a name of its own, the
widget's cover is rounded, and both strips are taller and drag.

The owner's ask, verbatim:

    "make the track art thing on the widgit slightly rounded and nice and you
     don't need to mention color os anywhere in the app or themes or patch notes
     dawg and what is this random ahh color palette thing remove that and make
     that how it was before. rename the color os theme. make the tabs and the
     bottom smooth bro like buttery smooth to drag my fingers across and make them
     slightly taller make cloud version better. MAKE THIS NICE v80.4"

The edits live in modules beside this file, as 80.3.x's did:

    patch_804_theme.py    one round dot again, and the theme renamed Lagoon
    patch_804_scrub.py    the brand name out of the changelog and the comments
    patch_804_tabs.py     taller tabs, snap drag, the strip follows the tab, cloud
    patch_804_widget.py   the cover is rounded in the app, before it is pushed

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-804.py
    python3 dev/patch-804.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.4'
OLD_VERSION = '80.3.7'
MARKER = '80.4 - THE ROUND COVER AND THE BUTTERY TABS'

sys.path.insert(0, HERE)

import patch_804_scrub     # noqa: E402
import patch_804_tabs      # noqa: E402
import patch_804_theme     # noqa: E402
import patch_804_widget    # noqa: E402


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-804: %s appears %d times, expected 1 (marker: %s)'
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
        'The theme list shows <b>one round dot</b> again. The three-band chip that appeared last release read as a strip of random colours on a phone, so it is gone and the dot is back \u2014 the accent, or the accent-and-second gradient when the theme moves.',
        'That theme is called <b>Lagoon</b> now, because the palette is a deep teal-black with a mint accent over aqua and a theme should be named after what it looks like. Same theme, same key underneath: if you were wearing it, you still are.',
        'The tabs are <b>taller</b> and they drag properly. A sideways swipe on the settings tabs can no longer be stolen by the page behind them, the strip settles on a tab instead of between two, and opening a tab scrolls it into view so the one you are in is never half off the edge.',
        'The <b>bottom row</b> got the same treatment: 44px pills instead of 36, 48 in the cloud layout, with the same snap. In the cloud layout that row is the whole navigation, so it is sized like it.',
        'The <b>widget\u2019s cover art</b> is rounded now \u2014 an 18% corner, drawn by the app before the cover is handed to the widget, because the widget\u2019s ImageView can scale a bitmap but cannot clip one. The preview in Settings shows the same shape.',
        'Nothing else moved \u2014 the player, the library, the albums, the lyrics, the downloader, the Studio and the audio graph are untouched.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'One dot in the theme list, a rounded widget cover, and taller tabs that drag',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the dot is back, the strips are taller and '
              'the cover is rounded')
        print('patch-804%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-804 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-804: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)

    # 1. The dot, and the name.
    page = swap(page, patch_804_theme.THEME_OLD, patch_804_theme.THEME_NEW,
                'the theme entry')
    page = swap(page, patch_804_theme.SWATCH_OLD, patch_804_theme.SWATCH_NEW,
                'the swatch')
    page = swap(page, patch_804_theme.ROW_OLD, patch_804_theme.ROW_NEW,
                'the swatch geometry')

    # 2. The word, out of the changelog and the comments.
    for old, new, what in patch_804_scrub.SCRUBS:
        page = swap(page, old, new, what)

    # 3. The strips: taller, and they drag.
    page = swap(page, patch_804_tabs.STRIP_OLD, patch_804_tabs.STRIP_NEW,
                'the settings tab strip')
    page = swap(page, patch_804_tabs.PILL_OLD, patch_804_tabs.PILL_NEW,
                'the dock pill height')
    page = swap(page, patch_804_tabs.PILL_WIDE_OLD, patch_804_tabs.PILL_WIDE_NEW,
                'the wide-screen pill height')
    page = swap(page, patch_804_tabs.CLOUD_OLD, patch_804_tabs.CLOUD_NEW,
                'the cloud dock and the now bar')
    page = swap(page, patch_804_tabs.TAB_CENTER_ANCHOR, patch_804_tabs.TAB_CENTER_ADD,
                'the call that brings the open tab into view')
    page = swap(page, patch_804_tabs.HELPER_ANCHOR, patch_804_tabs.HELPER_ADD,
                'scTabIntoView')
    page = swap(page, "  // 80.4 - one smooth scroll, asked for once per tab change",
                "  // " + MARKER + "\n  // 80.4 - one smooth scroll, asked for once per tab change",
                'the release comment')

    # 4. The rounded cover.
    page = swap(page, patch_804_widget.SEND_OLD, patch_804_widget.SEND_NEW,
                'the widget push (renamed, ready for the rounder)')
    page = swap(page, patch_804_widget.SEND_END_OLD, patch_804_widget.SEND_END_NEW,
                'the rounder in front of the push')
    page = swap(page, patch_804_widget.ROUND_ANCHOR, patch_804_widget.ROUND_ADD,
                'scRoundArtDataUrl')
    page = swap(page, patch_804_widget.PREVIEW_OLD, patch_804_widget.PREVIEW_NEW,
                'the widget preview tile')

    # 5. The changelog head and the version.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-804: the page did not end up 80.4 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-804: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 6. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-804: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: one round dot, the theme renamed Lagoon, the name out of the changelog, the '
          'taller tabs with snap and the tab-into-view scroll, the taller dock and cloud pills, the '
          'rounded widget cover, the preview tile, the changelog head and the shell cache')
    print('patch-804: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.4';", 'the page runs 80.4'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.4', date:", 'the changelog records the release'),
    # the dot
    ("prism:       {  name: 'Lagoon (dynamic)',", 'the theme has a name of its own'),
    ('<span style="width:18px; height:18px; border-radius:50%; ', 'the dot is back'),
    ("'background: linear-gradient(135deg, ' + th.coral + ', ' + th.gold + ');'", 'and a moving theme still shows both its accents'),
    # the strips
    ('  touch-action: pan-x;\n  scroll-snap-type: x proximity;', "the strip's drag is its own"),
    ('#settingsTabStrip > .tab{\n  min-height: 46px;', 'the tabs are taller'),
    ('touch-action:manipulation; min-height:44px;', 'the bottom row is taller'),
    ('body.sc80-cloud .action-strip > .action-pill{\n  min-height: 48px;\n  scroll-snap-align: center;', 'and a size up in the cloud layout'),
    ('function scTabIntoView(tab){', 'the strip follows the open tab'),
    ('try{ scTabIntoView(tab); }catch(_eTabView){ }', 'and it is called on every tab change'),
    # the cover
    ('function scRoundArtDataUrl(url, cb){', 'the cover is rounded in the page'),
    ("const send = (art) => { if(!art){ sendRaw(''); return; } scRoundArtDataUrl(art, sendRaw); };",
     'every cover goes through it'),
    ('roundRect(0, 0, size, size, r)', 'with a real corner'),
]

GONE = [
    ("const APP_VERSION = '80.3.7';", 'the old version constant'),
    ('ColorOS', 'the brand name, anywhere in the page'),
    ('COLOROS', 'the brand name, in a comment'),
    ("linear-gradient(90deg, ' + (th.bg || '#0E1B1F')", 'the three-band chip'),
    ('min-height:36px;', 'the 36px pill'),
    ('      const send = (art) => {\n        try{\n          // Drop stale art', 'the push that sent a square cover'),
]


if __name__ == '__main__':
    sys.exit(main())
