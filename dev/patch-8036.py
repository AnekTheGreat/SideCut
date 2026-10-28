#!/usr/bin/env python3
"""80.3.6 - the whole app settles instead of cutting, Prism joins the theme wall,
and the home-screen widget gets options it can actually honour.

The owner's ask, verbatim (one message, three asks):

    "in fact screw it add an update which makes the whole app as smooth as color
     os 17 with another theme after it make this nice and add more options to the
     widgit there should be more options"

The edits live in modules beside this file, as 80.3.2's through 80.3.5's did:

    patch_8036_motion.py  one set of motion tokens, the press states, contained
                          scrolling, the view transition over navigate(), and the
                          arrival fade on a settings pane
    patch_8036_theme.py   Prism: its THEMES entry and its drifting backdrop
    patch_8036_widget.py  five more presets, follow-the-app-theme, and the idle
                          battery saver (state, getter, rows, wiring, heartbeat)
    patch_8036_copy.py    the three sentences this release made stale

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-8036.py
    python3 dev/patch-8036.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.3.6'
OLD_VERSION = '80.3.5'
MARKER = '80.3.6 - THE CROSS-FADE AND THE ONE MOTION SYSTEM'

sys.path.insert(0, HERE)

import patch_8036_copy      # noqa: E402
import patch_8036_motion    # noqa: E402
import patch_8036_theme     # noqa: E402
import patch_8036_widget    # noqa: E402


def swap(src, old, new, what):
    if src.count(old) != 1:
        raise SystemExit('patch-8036: %s appears %d times, expected 1 (marker: %s)'
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
        'The whole app moves on <b>one</b> set of curves now. Every surface used to spell out its own timing, so two things that arrived together did not settle together; there is one set of durations and three curves, and arrivals, drops, sheets and fades all read them.',
        'A tap answers. Tabs, playlist rows, settings rows and pick buttons compress a little under your finger and come back on release \u2014 it is a transform, so the compositor does it and nothing on the page has to be re-laid-out.',
        'Switching tabs <b>cross-fades</b> instead of cutting. The page uses the phone\u2019s own view transition: the frame you are leaving fades out over the one you asked for, in a single pass, with the change itself running exactly when it ran before. An older WebView simply switches the way it always did.',
        'A scroll belongs to the pane it started in. Reaching the end of the tab strip, a settings pane or the Studio list no longer drags the page behind it, and momentum scrolling stays on.',
        'Settings panes settle in when you switch to them, with the same arrival the main views get \u2014 and <b>Reduce motion</b> in Sandbox, or the phone\u2019s own setting, turns all of it off. The state still changes; nothing travels.',
        'New theme: <b>Prism</b> \u2014 cool and glassy at the top of the screen, warm under it, with the accent light enough to read on both. Four layers of colour drift behind the whole app. Free, like every theme has been since the badge wall came down.',
        'The <b>widget</b> has more options, and every one of them changes what is drawn: <b>Aurora, Sand, Slate, Sakura and Lime</b> join the presets; <b>Follow the app theme</b> borrows the app\u2019s own background and accent and follows it when you change theme; and <b>Idle battery saver</b> lets a paused widget keep refreshing for 25 seconds, a minute, or never.',
        'Nothing else moved \u2014 the player, the library, the albums, the lyrics, the downloader, the Studio and the audio graph are untouched. Only the motion, one theme and the widget options are new.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'") for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp,
               'One motion system for the whole app, a new Prism theme, and more options on the widget',
               body))


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', navigation cross-fades, Prism is on the wall '
              'and the widget has its three new options')
        print('patch-8036%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8036 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8036: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)

    # 1. The motion system: tokens, press states, contained scrolling, the fade.
    page = swap(page, patch_8036_motion.CSS_ANCHOR, patch_8036_motion.MOTION_CSS,
                'the motion tokens beside the view-in block')
    page = swap(page, patch_8036_motion.NAV_OLD, patch_8036_motion.NAV_NEW,
                'the cross-fade over navigate()')
    page = swap(page, patch_8036_motion.SETTINGS_ANCHOR, patch_8036_motion.SETTINGS_ADD,
                'the arrival fade on a settings pane')
    page = swap(page, "  // 80.3.6 - THE CROSS-FADE. Navigation used to cut",
                "  // " + MARKER + "\n" + "  // 80.3.6 - THE CROSS-FADE. Navigation used to cut",
                'the release comment')

    # 2. Prism: the entry and its backdrop.
    page = swap(page, patch_8036_theme.THEMES_OLD, patch_8036_theme.THEMES_NEW,
                'the Prism entry in THEMES')
    page = swap(page, patch_8036_theme.CSS_ANCHOR, patch_8036_theme.PRISM_CSS,
                'the Prism backdrop')

    # 3. The widget: presets, the two switches, the getter, the heartbeat, the rows.
    page = swap(page, patch_8036_widget.PRESETS_OLD, patch_8036_widget.PRESETS_NEW,
                'the five new widget presets')
    page = swap(page, patch_8036_widget.STATE_ANCHOR, patch_8036_widget.STATE_ADD,
                'the widget follow and idle state')
    page = swap(page, patch_8036_widget.GET_OLD, patch_8036_widget.GET_NEW,
                'getWidgetTheme follows the app theme')
    page = swap(page, patch_8036_widget.IDLE_OLD, patch_8036_widget.IDLE_NEW,
                'the heartbeat timeout is the saved setting')
    page = swap(page, patch_8036_widget.UI_ANCHOR, patch_8036_widget.UI_NEW,
                'the two new widget rows')
    page = swap(page, patch_8036_widget.WIRE_ANCHOR, patch_8036_widget.WIRE_NEW,
                'the two new widget switches, wired once')

    # 4. The copy that this release made stale.
    for old, new, what in patch_8036_copy.COPY_SWAPS:
        page = swap(page, old, new, what)

    # 5. The changelog head and the version.
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8036: the page did not end up 80.3.6 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8036: the page still carries this (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    # 6. The shell cache.
    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8036: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the motion tokens and press states, the cross-fade over navigate(), the pane '
          'arrival, Prism (entry and backdrop), five widget presets, follow-the-app-theme, the idle '
          'battery saver (state, getter, rows, wiring, heartbeat), the two sentences, the changelog '
          'head and the shell cache')
    print('patch-8036: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.3.6';", 'the page runs 80.3.6'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.3.6', date:", 'the changelog records the release'),
    # the motion system
    ('--sc-e-out: cubic-bezier(.22,1,.36,1);', 'one set of curves'),
    ('--sc-t-press: 110ms;', 'one set of durations'),
    ('.tab:active, .playlist-pick-btn:active, .sc-set-head:active, .settings-pick:active{ transform: scale(.98); }',
     'a tap answers'),
    ('#tabs, #settingsPanesWrap, #studioView{', 'a scroll belongs to its pane'),
    ('::view-transition-new(root){ animation: scVtIn var(--sc-t-view) var(--sc-e-out) both; }',
     'the arriving frame fades in'),
    ('function scNavigateSmooth(view){', 'navigation goes through the fade'),
    ('if(scMotionOff() || typeof document.startViewTransition !== \'function\') return _scNavInner(view);',
     'and falls back to a plain call'),
    ("try{ navigate = scNavigateSmooth; }catch(_eAs){ }", 'the block-scoped binding is wrapped'),
    ('window.navigate = scNavigateSmooth;', 'and so is the global one'),
    ("if(window.__scViewIn){", 'a settings pane arrives the same way'),
    ('body.sandbox-reduce-motion .tab:active,', 'Reduce motion turns the press off'),
    # the theme
    ("prism:       {  name: 'Prism (dynamic)',", 'Prism is in THEMES'),
    ('body.theme-dyn-prism::before{', 'and has a backdrop'),
    ('animation: sd-dyn-drift 17s ease-in-out infinite;', 'drifting'),
    # the widget
    ("aurora: { label: 'Aurora',", 'Aurora is a preset'),
    ("sakura: { label: 'Sakura',", 'so is Sakura'),
    ("let widgetFollow = false;", 'follow-the-app-theme has state'),
    ("function widgetThemeFromApp(){", 'and reads the app theme'),
    ("const _wt = applyWidgetCustom(widgetFollow ? widgetThemeFromApp()", 'getWidgetTheme uses it'),
    ("let widgetIdleSec = 25;", 'the idle saver has state'),
    ("if(widgetIdleSec > 0 && !widgetPlaying", 'the heartbeat reads it live'),
    ('id="widgetFollowToggle"', 'the follow switch is in Settings > Widget'),
    ('id="widgetIdleSelect"', 'so is the idle saver'),
    ('followTog.addEventListener(\'change\'', 'the follow switch is wired'),
    ('idleSel.addEventListener(\'change\'', 'the idle saver is wired'),
]

GONE = [
    ("const APP_VERSION = '80.3.5';", 'the old version constant'),
    ("const _wt = applyWidgetCustom(WIDGET_THEMES[widgetThemeKey] || WIDGET_THEMES.ocean);",
     'the getter that ignored the app theme'),
    ('if(!widgetPlaying && Date.now() - _widgetLastInteraction > _widgetTimeoutMs){',
     'the hard-coded 25 second timeout'),
    ('  window.navigate = navigate;', 'the bare export of navigate'),
    ('Customize the home-screen widget. Changes apply to every widget you have placed; re-adding one also picks these up.',
     'the widget introduction that listed two options'),
]


if __name__ == '__main__':
    sys.exit(main())
