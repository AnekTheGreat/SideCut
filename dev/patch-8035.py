#!/usr/bin/env python3
"""80.3.5 - Settings -> More is one list of rows that open, "Playback" and
"Playback & sound" are ONE menu, and an anti-muffler sits beside the volume boost.

The owner's ask, verbatim (one message, three asks):

    "add a anti muffler in settings and playback and sound also playback and
     playback and sound should be merged into one thing and make it clean the
     settings and more tab with like the things on the left and a smooth drop-down
     that shows when you click on it to clean up clutter and nothing should be left
     out of the drop-down everything shuikd be in it it should be mapped after
     color os 17, and add a anti muffler next to the volume increaser which makes
     the music not muffled"

The edits live in modules beside this file, as 80.3.2's, 80.3.3's and 80.3.4's did:

    patch_8035_ui.py     the pane: one Playback & sound row over both old groups,
                         the pieces that were bare become rows, the ColorOS-style
                         stylesheet, and the DOM rebuild itself
    patch_8035_rows.py   the opener: one smooth slide for every row, a switch on
                         the row as its own tap, the row's state chip, and the three
                         bespoke handlers that become calls to it
    patch_8035_muffle.py the anti-muffler: two filters on a wet path beside a dry
                         one, its state, its setter, its row and its boot restore
    patch_8035_copy.py   the four sentences that named two places instead of one

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-8035.py
    python3 dev/patch-8035.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.3.5'
OLD_VERSION = '80.3.4'
MARKER = '80.3.5 - THE ANTI-MUFFLER RIDES BETWEEN THE BOOST AND ITS CEILING'

sys.path.insert(0, HERE)

import patch_8035_copy      # noqa: E402
import patch_8035_muffle    # noqa: E402
import patch_8035_rows      # noqa: E402
import patch_8035_ui        # noqa: E402


def one(src, marker, what):
    n = src.count(marker)
    if n != 1:
        raise SystemExit('patch-8035: %s appears %d times, expected 1 (marker: %s)'
                         % (what, n, marker[:70].replace('\n', '\\n')))
    return src.index(marker)


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8035: %s appears %d times, expected 1 (marker: %s)'
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
        'Settings \u2192 More is one list of rows now, the way a phone\'s settings should read: the title on the left, what it is doing on the right, and a marker that turns as the row opens. Tap a row and its controls slide out under it \u2014 nothing is on the screen that you did not ask for.',
        'Nothing was left out. Every setting that used to sit loose between two cards is a row of its own: the tutorial, the Playlists / Albums button, auto-scroll to song, keep the playing album open, ask artist when importing, and About \u2014 whose version number is now on its row with the update log, the listening streak and the version guide inside it.',
        '<b>Playback</b> and <b>Playback &amp; sound</b> are one thing. Two menus over the same subject are one menu: crossfade, seek style, auto-volume, the assistant duck, the sleep timer, gapless, the next-album roll, the per-playlist sort, the 8-band equalizer, the volume boost and the anti-muffler all live in <b>Playback &amp; sound</b>, in four labelled parts.',
        'An <b>anti-muffler</b> sits right under the volume boost. A boxed-in master is usually a build-up around 320 Hz and a roll-off above a few kilohertz, so this cuts the first by 3.5 dB and lifts the second by 3.5 dB \u2014 the same size on purpose, because an uneven pair is a preset and this is not one. It colours whatever is playing, on top of your own equalizer.',
        'The anti-muffler comes back on the next launch and applies to a song that is already playing, with no restart and no press of play. <b>Off</b> is exactly how SideCut sounded before this release \u2014 the signal is multiplied by 1 and a zero is added to it, and nothing in the audio graph is ever disconnected to switch it, so there is no click and no gap.',
        'The drop-down slides open instead of appearing, and it opens to whatever it is holding \u2014 the storage numbers and the DJ Mode list can still change height while they are open. Reduce motion (Sandbox) keeps the instant flip, and so does any device that will not report a height.',
        'Nothing moved in the player, the library, the albums, the lyrics, the tabs or the widget. Every control that was in the two old menus is in the new one, unchanged \u2014 same switch, same slider, same saved setting.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'Settings is one clean list of rows that open, Playback and Playback & sound are one menu, and an anti-muffler sits beside the volume boost',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the rows open and the anti-muffler is in the graph')
        print('patch-8035%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8035 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8035: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)

    # 1. Settings -> More: the merge, the rows, the stylesheet.
    page = patch_8035_ui.apply(page, swap)

    # 2. The anti-muffler, in the merged Sound menu, right under the boost.
    page = swap(page, '          <div class="sc-sub">Display</div>',
                patch_8035_muffle.ROW + '          <div class="sc-sub">Display</div>',
                'the anti-muffler row')
    page = swap(page, patch_8035_muffle.ANCHOR_STATE,
                patch_8035_muffle.STATE + patch_8035_muffle.ANCHOR_STATE,
                'the anti-muffler state')
    page = swap(page, patch_8035_muffle.ANCHOR_GRAPH, patch_8035_muffle.GRAPH,
                'the two paths into the guard')
    page = swap(page, patch_8035_muffle.ANCHOR_GRAPH_FAIL, patch_8035_muffle.GRAPH_FAIL,
                'the failed graph clears the new nodes too')
    page = swap(page, patch_8035_muffle.ANCHOR_SET, patch_8035_muffle.SET,
                'the anti-muffler setter, its wiring and its state reader')
    page = swap(page, patch_8035_muffle.ANCHOR_RESTORE, patch_8035_muffle.RESTORE,
                'the anti-muffler comes back at boot')

    # 3. The opener, the chip, and the three handlers that were their own.
    page = swap(page, patch_8035_rows.OPENER_OLD, patch_8035_rows.OPENER_NEW,
                'the one opener every row uses')
    page = swap(page, patch_8035_rows.PB_OLD, patch_8035_rows.PB_NEW,
                'the Playback & sound handler')
    page = swap(page, patch_8035_rows.STORAGE_OLD, patch_8035_rows.STORAGE_NEW,
                'the storage handler')
    page = swap(page, patch_8035_rows.OTA_OLD, patch_8035_rows.OTA_NEW,
                'the Check-for-updates handler')
    page = swap(page, patch_8035_rows.RESET_OLD, patch_8035_rows.RESET_NEW,
                'the More tab opens with that row closed')

    # 4. The copy that named two places instead of one.
    for old, new, what in patch_8035_copy.COPY_SWAPS:
        page = swap(page, old, new, what)

    # 5. The changelog head and the version.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8035: the page did not end up 80.3.5 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8035: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 6. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8035: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the one Playback & sound row, the rows that were bare, the settings '
          'stylesheet, the sliding opener and the row state, the anti-muffler (state, graph, '
          'setter, row, restore), the four sentences, the changelog head and the shell cache')
    print('patch-8035: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.3.5';", 'the page runs 80.3.5'),
    (MARKER, 'the release comment is in the graph'),
    ("{ version: '80.3.5', date:", 'the changelog records the release'),
    # the merge
    ('''<div class="sc-mgroup">Playback &amp; sound</div>''', 'the merged menu is named'),
    ('''id="collapsiblePlaybackSoundContent"''', 'the merged body is there'),
    ('''class="sc-sub">Sleep &amp; queue<''', 'the merged menu has its parts labelled'),
    ('''id="collapsibleSplit"''', 'the layout switches are rows'),
    ('''id="collapsibleAutoScroll"''', 'auto-scroll is a row'),
    ('''id="collapsibleAlbumFocus"''', 'the album switch is a row'),
    ('''id="collapsibleArtistAsk"''', 'the artist prompt is a row'),
    ('''id="collapsibleAbout"''', 'About is a row'),
    ('''id="collapsibleTutorial"''', 'the tutorial is a row'),
    ('''data-sc-val="boostDbValue"''', 'the row carries the boost on itself'),
    ('''#settingsPaneMore .sc-set-card.sc-open > .sc-set-body{''', 'the drop-down is a height'),
    # the opener
    ('function scRowSet(btn, content, open, slide){', 'one opener for every row'),
    ('function scRowClose(id, contentId){', 'and one closer'),
    ("window.__scRowChips = sync;", 'the row state has one writer'),
    ("setupCollapsible('collapsiblePlaybackSound', 'collapsiblePlaybackSoundContent', 'collapsePlaybackSoundIcon', function(){",
     'the merged row is opened by the shared opener'),
    ("setupCollapsible('collapsibleStorage', 'collapsibleStorageContent', 'collapseStorageIcon', function(){",
     'so is storage'),
    ("setupCollapsible('collapsibleOta', 'collapsibleOtaContent', 'collapseOtaIcon');", 'so is Check for updates'),
    # the anti-muffler
    ('var scAntiMuffler = false;', 'the anti-muffler has its own state'),
    ("scMuffleLow.type = 'peaking';", 'the mud cut is a peaking filter'),
    ("scMuffleHigh.type = 'highshelf';", 'the presence lift is a shelf'),
    ('scMuffleLow.connect(scMuffleHigh).connect(scMuffleWet).connect(scBoostGuard);',
     'the wet path runs through both filters'),
    ('scBoostGain.connect(scMuffleDry).connect(scBoostGuard);', 'the dry path runs straight through'),
    ('function setAntiMuffler(on, opts){', 'the switch has one setter'),
    ("id=\"antiMufflerToggle\"", 'the row is in the Sound menu'),
    ("const muffleRow = metaRows.find(r => r.key === 'antiMuffler');", 'it comes back at boot'),
]

GONE = [
    ("const APP_VERSION = '80.3.4';", 'the old version constant'),
    ('''      <div class="sc-mgroup">Sound</div>''', 'the separate Sound group'),
    ('''      <div class="sc-mgroup">Playback</div>''', 'the separate Playback group'),
    ("setupCollapsible('collapsiblePlayback', 'collapsiblePlaybackContent', 'collapsePlaybackIcon');",
     'the old Playback row'),
    ('id="collapsiblePlayback"', 'the old Playback row is gone from the page'),
    ("_pbBtn.addEventListener('click'", 'the Playback & sound handler of its own'),
    ("var head = $('collapsibleStorage'), pane = $('collapsibleStorageContent')",
     'the storage handler of its own'),
    ("$('collapsibleOta').addEventListener('click'", 'the Check-for-updates handler of its own'),
    ("""content.style.display = isOpen ? 'none' : 'block';""", 'the instant flip inside the opener'),
    ('#settingsPaneMore > #collapsiblePlaybackSound{', 'the rule for a header that was a direct child'),
    ('''margin-bottom:16px; border:1px solid var(--line); border-radius:10px; overflow:hidden;''',
     'the box that wrapped the top of the pane'),
    ('''<div style="margin-bottom:16px;">\n        <button class="playlist-pick-btn" id="howToUseBtn"''',
     'the bare tutorial button'),
    ('''<div style="margin-bottom:16px; padding:12px; background:rgba(255,255,255,0.03); border-radius:8px; border:1px solid var(--line);">\n        <div style="display:flex; align-items:center; justify-content:space-between;">\n          <div>\n            <div style="font-size:13px; font-weight:600;">Playlists / Albums button</div>''',
     'the three switches sharing one box'),
    ('Settings \u2192 <b>Playback</b>. <b>8-band EQ + bass boost:</b>',
     'the help line that sent the reader to two menus that are one'),
]

if __name__ == '__main__':
    sys.exit(main())
