#!/usr/bin/env python3
"""80.6.6 - the amber palette becomes a wall you can wear, and the glass is named.

The owner's ask, verbatim:

    "this being an actual theme would be pretty cool and where is the liquid one"

TWO THINGS, and the second one is a naming bug rather than a missing feature.

1. AMBER DUSK AS AN APP THEME. 80.6.5 put the warm gold-to-charcoal palette on the
   widget shelf; this puts it on the theme wall - the same family (near-black
   olive, a raised olive panel, a sun-gold accent) as one tap that repaints the
   whole app. The wall has no light theme (every theme paints light ink), so the
   background is held dark enough that white on it is 18:1 and the gold accent
   reads at 11:1. `fresh: true` puts it first in the Static group for this release
   and then leaves on its own - there is no second list to keep in sync.

2. WHERE THE LIQUID ONE WAS. It was there the whole time: the glass widget is the
   FIRST preset on the shelf and has been since 80.6 - it was labelled "Frosted
   glass", so looking for "liquid" found nothing. The label is "Liquid glass" now.
   Nothing about the preset changes: same key (`frost`, so a phone that picked it
   keeps its pick, its saved dial value and its fine-tune swatches), same nine
   colours, same Frost dial, still the only glass preset.

AND THE PANE READS AS GLASS AGAIN. 80.6.3 thinned the pane so hard that the
preview stopped looking like a lens: the colour strip behind it came through
nearly untouched. The FIX IS NOT MORE MILK - the owner asked for transparent, and
adding opacity back would undo that. What a lens gives you is a *specular band*
and a *rim*, and both were too quiet: the drifting band goes from 0.34 to 0.52
white and widens, the top rim from 0.55 to 0.72, the edge from 0.20 to 0.26, and
the backdrop is pushed at saturate(1.45) instead of 1.9, so the pane sits ON the
colour instead of vanishing into it. The alpha math (0.32 -> 0.62) is untouched.

Only the Settings preview can carry the band and the blur: the home-screen widget
is a RemoteViews bitmap and draws a colour, not a filter. That has been true since
80.6 and it is still true.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8066.py
    python3 dev/patch-8066.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.6'
OLD_VERSION = '80.6.5'
MARKER = '80.6.6 - AMBER DUSK IS A THEME, AND THE GLASS IS NAMED LIQUID'

# ---------------------------------------------------------------------------
# 1. The app theme, in the static block after Royal Gold.
# ---------------------------------------------------------------------------
THEME_ANCHOR = ("    gold:        {  name: 'Royal Gold',      bg:'#1A140B', bgRaised:'#241C10', "
                "coral:'#E8B94D', gold:'#C9962C'  },\n")

THEME_ADD = THEME_ANCHOR + """    // 80.6.6 - AMBER DUSK. The 80.6.5 widget preset's palette as a wall: the same
    // near-black olive, a raised olive panel, and the sun gold as the accent. No
    // rgb, no dynamic, no reward - it is a plain static theme anyone can pick.
    // The background is held dark on purpose: white ink on it is 18:1 and the gold
    // on it is 11:1, which is the check dev/check-8066.cjs measures. `fresh` puts
    // it at the top of the Static group for this release only; it leaves with the
    // entry, so nothing has to be remembered next time.
    amberdusk:   {  name: 'Amber dusk',      bg:'#171307', bgRaised:'#271F0E', coral:'#FFC24A', gold:'#C9B86A', fresh:true  },
"""

# ---------------------------------------------------------------------------
# 2. The glass preset is called Liquid glass. Same key, same colours.
# ---------------------------------------------------------------------------
PRESET_OLD = ("    frost:  { label: 'Frosted glass', glass: true, bg1: '#E4F1FF', bg2: '#96BCE2', "
              "title: '#07182C', artist: '#2F4A6E', accent: '#46C8F5', accentText: '#062033', "
              "pill: '#FFFFFF', pillText: '#07182C' },")

PRESET_NEW = ("    // 80.6.6 - NAMED FOR WHAT IT IS. This has always been the liquid one - it was\n"
              "    // called \"Frosted glass\", so nobody looking for \"liquid\" could find it. The\n"
              "    // KEY stays `frost`: a phone that already picked it keeps its pick.\n"
              "    frost:  { label: 'Liquid glass', glass: true, bg1: '#E4F1FF', bg2: '#96BCE2', "
              "title: '#07182C', artist: '#2F4A6E', accent: '#46C8F5', accentText: '#062033', "
              "pill: '#FFFFFF', pillText: '#07182C' },")

# ---------------------------------------------------------------------------
# 3. The copy that names it, and the count next to it.
# ---------------------------------------------------------------------------
BLURB_OLD = 'twenty presets from bright to frosted glass'
BLURB_NEW = 'twenty presets from bright to liquid glass'

# ---------------------------------------------------------------------------
# 4. The liquid cue: a brighter drifting band, a stronger rim, a softer push.
# ---------------------------------------------------------------------------
BAND_OLD = ("    background: linear-gradient(112deg, rgba(255,255,255,0) 30%, "
            "rgba(255,255,255,0.34) 41%, rgba(255,255,255,0.06) 50%, "
            "rgba(255,255,255,0) 60%);")

BAND_NEW = ("    /* 80.6.6 - THE BAND CARRIES THE PANE. At 0.34 this highlight was a hint on a\n"
            "       bright wallpaper and invisible on a pastel one; a lens shows a specular band,\n"
            "       so it is 0.52 wide and it travels further. The alpha of the pane itself is\n"
            "       untouched - this is sheen, not milk. */\n"
            "    background: linear-gradient(112deg, rgba(255,255,255,0) 26%, "
            "rgba(255,255,255,0.52) 38%, rgba(255,255,255,0.10) 49%, "
            "rgba(255,255,255,0) 62%);")

RIM_OLD = """      const edge = (0.20 + (t.frost || 0) * 0.0030).toFixed(3);
      const rim = (0.55 + (t.frost || 0) * 0.0030).toFixed(3);"""

RIM_NEW = """      // 80.6.6 - a lens has a bright top edge and a soft under-edge; both were quiet
      // enough on a pastel backdrop to disappear. Still dial-scaled, still inset.
      const edge = (0.26 + (t.frost || 0) * 0.0034).toFixed(3);
      const rim = (0.72 + (t.frost || 0) * 0.0032).toFixed(3);"""

SATURATE_OLD = 'saturate(1.9) contrast(1.04) brightness(1.04)'
SATURATE_NEW = 'saturate(1.45) contrast(1.05) brightness(1.05)'


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        '<b>Amber dusk is a theme now</b>, not only a widget preset: the same gold-olive and charcoal as a wall for the whole app &mdash; near-black olive behind everything, a raised olive panel, and the sun gold as the accent. It is the first card in Static themes this time, with a NEW tag, and the tag clears itself next release.',
        '<b>The liquid one was there all along.</b> The glass widget is the first preset in Settings &rsaquo; Widget and has been since it shipped &mdash; it was called &ldquo;Frosted glass&rdquo;, so looking for &ldquo;liquid&rdquo; found nothing. It is called <b>Liquid glass</b> now. Same preset, same colours, same Frost dial.',
        'The <b>liquid glass preview reads as glass again</b>: a brighter specular band drifting across the pane, a stronger rim on both edges, and the colour behind it pushed less hard, so the pane sits on the wallpaper instead of disappearing into it. The transparency itself is unchanged &mdash; this is sheen, not milk.',
        'Nothing else moved &mdash; the other nineteen widget presets, the Frost dial, the fine-tune palette, the glass mode, the player, the library, the lyrics and the audio graph are exactly as they were.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Amber dusk is a theme, and the glass has its name', body))


def swap(src, old, new, what, times=1):
    count = src.count(old)
    if count != times:
        raise SystemExit('patch-8066: %s appears %d times, expected %d (anchor: %s)'
                         % (what, count, times, old[:70].replace('\n', '\\n')))
    return src.replace(old, new)


CLAIMS = [
    ("const APP_VERSION = '80.6.6';", 'the page runs 80.6.6'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.6', date:", 'the changelog records the release'),
    ("amberdusk:   {  name: 'Amber dusk',", 'the app theme is on the wall'),
    ("frost:  { label: 'Liquid glass', glass: true,", 'the glass preset is named'),
    ('twenty presets from bright to liquid glass', 'the blurb names it'),
    ('rgba(255,255,255,0.52) 38%', 'the band carries the pane'),
    ('const rim = (0.72 + (t.frost || 0) * 0.0032).toFixed(3);', 'the rim is stronger'),
    ('saturate(1.45) contrast(1.05) brightness(1.05)', 'the backdrop is pushed less'),
    ('var alpha = (0.32 + 0.30 * k) * 255;', 'the pane transparency is untouched'),
]

GONE = [
    ("const APP_VERSION = '80.6.5';", 'the old version constant'),
    ("label: 'Frosted glass'", 'the old preset label'),
    ('twenty presets from bright to frosted glass', 'the old blurb'),
    ('saturate(1.9)', 'the old backdrop push'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', Amber dusk is a theme and the glass is named')
        print('patch-8066%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8066 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8066: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, THEME_ANCHOR, THEME_ADD, 'the end of Royal Gold')
    page = swap(page, PRESET_OLD, PRESET_NEW, 'the glass widget preset')
    page = swap(page, BLURB_OLD, BLURB_NEW, 'the Settings > Widget blurb')
    page = swap(page, BAND_OLD, BAND_NEW, 'the liquid band')
    page = swap(page, RIM_OLD, RIM_NEW, 'the preview rim')
    page = swap(page, SATURATE_OLD, SATURATE_NEW, 'the preview backdrop filter', 2)

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page,
                "// 80.6.5 - THE WARM DUSK WIDGET\nvar SC_IS_WEB = (function(){",
                "// 80.6.5 - THE WARM DUSK WIDGET\n// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8066: the page did not end up 80.6.6 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8066: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8066: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the Amber dusk app theme, the Liquid glass label, the blurb, the band, '
          'the rim, the backdrop, the changelog head, the version and the shell cache')
    print('patch-8066: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
