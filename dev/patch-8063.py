#!/usr/bin/env python3
"""80.6.3 - the glass is liquid now: thinner, clearer, and it moves.

The owner's ask, verbatim:

    "make it liquidy like ios and less frosted and more transparent"

80.6 shipped a milky panel, 80.6.1 made the milk cold. It was still milk: half
the pane at the thinnest setting, nearly nine tenths at the thickest, and up to
0.55 of it mixed toward white - so the wallpaper was a tint behind a sheet rather
than colour seen through a lens. Three changes, no new plumbing.

1. THE PANE IS THINNER. Opacity runs 0.32 -> 0.62 (was 0.52 -> 0.88), so there is
   a real setting now for "I want to see my wallpaper".

2. LESS MILK, MORE COLOUR. The white mix is roughly halved (0.16 -> 0.34 on the
   lit stop, 0.02 -> 0.11 on the other) and the second stop goes a shade deeper.
   What carries the pane is the icy blue cast - a clear cool lens - instead of a
   white haze. The 0.6.1 lift is untouched: thicker still reads colder.

3. THE PREVIEW GETS THE LIQUID PART. The static corner sheen was a painted
   highlight; a specular band drifts across the pane now, on a 9s loop, in a
   `.sc-glass-liquid` layer whose animation is switched off by the app's own
   Reduce motion class and by the device's preference - a still band at rest, not
   a highlight that moves for someone who asked it not to. The rim is on both
   edges (bright across the top, soft under the bottom) so the pane reads as a
   lens, and the backdrop is pushed to saturate(1.9) so the thinner glass shows
   colour rather than haze.

WHAT THE WIDGET ITSELF GETS: (1) and (2). The home-screen widget is a RemoteViews
bitmap - it draws a colour, it cannot blur, drift or refract - so the blur, the
moving band and the rim are Settings-preview only, exactly as 80.6.1 said of its
rim and sheen. The honest limit of (1): the thinner the pane, the less contrast
the dark type has over a very dark wallpaper. That is what the dial is for, and
the copy now says so.

Nothing else moves: eighteen other presets, the dial's memory and wiring,
fine-tune, follow-the-app-theme, the idle saver, and the app chrome's own Liquid
glass mode are exactly as they were.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8063.py
    python3 dev/patch-8063.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.3'
OLD_VERSION = '80.6.2'
MARKER = '80.6.3 - THE GLASS IS LIQUID'

# ---------------------------------------------------------------------------
# 1. The preset: the second stop a shade deeper, so a thinner pane still has
#    colour in it instead of fading to the wallpaper.
# ---------------------------------------------------------------------------
PRESET_OLD = ("    frost:  { label: 'Frosted glass', glass: true, bg1: '#E4F1FF', bg2: '#A9C6E6', "
              "title: '#0A1A2E', artist: '#39557A', accent: '#46C8F5', accentText: '#062033', "
              "pill: '#FFFFFF', pillText: '#0A1A2E' },")

PRESET_NEW = ("    frost:  { label: 'Frosted glass', glass: true, bg1: '#E4F1FF', bg2: '#96BCE2', "
              "title: '#07182C', artist: '#2F4A6E', accent: '#46C8F5', accentText: '#062033', "
              "pill: '#FFFFFF', pillText: '#07182C' },")

# ---------------------------------------------------------------------------
# 2. The math: less pane, less milk, same ice.
# ---------------------------------------------------------------------------
MATH_OLD = """    // 0.44 of a white-ish panel is already a readable dull glass; 0.88 is a pane
    // you can barely see through. Both ends keep the wallpaper as a tint.
    var alpha = (0.52 + 0.36 * k) * 255;
    var c1 = scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg1), 0.30 + 0.25 * k), k);
    var c2 = scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.06 + 0.20 * k), k);"""

MATH_NEW = """    // 80.6.3 - A LENS, NOT A SHEET. 80.6.1 ran 0.52 -> 0.88 with up to 0.55 of the
    // panel mixed toward white, which is a milky pane however cool it is: the
    // wallpaper was a tint behind it. The range is 0.32 -> 0.62 now and the white
    // mix is roughly halved, so what you see through it is COLOUR with a cool cast
    // on top rather than white haze. Both ends are still translucent; the thick end
    // is no longer nearly solid, which is the point.
    var alpha = (0.32 + 0.30 * k) * 255;
    var c1 = scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg1), 0.16 + 0.18 * k), k);
    var c2 = scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.02 + 0.09 * k), k);"""

# ---------------------------------------------------------------------------
# 3. The preview: a thinner pane, a wetter backdrop, a band that drifts, and a
#    rim on both edges.
# ---------------------------------------------------------------------------
BLUR_OLD = """      const blur = 8 + Math.round((t.frost || 0) * 0.18);
      const edge = (0.22 + (t.frost || 0) * 0.0034).toFixed(3);
      const rim = (0.50 + (t.frost || 0) * 0.0035).toFixed(3);"""

BLUR_NEW = """      // 80.6.3 - less frost means less blur as well as less white: the blur grows
      // more slowly with the dial and the backdrop is pushed harder, so the thinner
      // pane shows saturated colour instead of a grey wash.
      const blur = 6 + Math.round((t.frost || 0) * 0.12);
      const edge = (0.20 + (t.frost || 0) * 0.0030).toFixed(3);
      const rim = (0.55 + (t.frost || 0) * 0.0030).toFixed(3);"""

TILE_OLD = """      pv.innerHTML = '<div style="position:relative; border-radius:16px; overflow:hidden; box-shadow:0 10px 26px rgba(0,0,0,0.38);">' +
        '<div style="position:absolute; inset:0; background:linear-gradient(135deg,#FF9BB6 0%,#8FD3FF 36%,#7CE3C0 60%,#A996FF 82%,#FFD98A 100%);"></div>' +
        '<div style="position:relative; padding:14px; border-radius:16px; -webkit-backdrop-filter:blur(' + blur + 'px) saturate(1.35) brightness(1.06); backdrop-filter:blur(' + blur + 'px) saturate(1.35) brightness(1.06); background:linear-gradient(160deg,' + t.css1 + ',' + t.css2 + '); box-shadow:inset 0 1px 0 rgba(255,255,255,' + rim + '), inset 0 0 0 1px rgba(255,255,255,' + edge + ');">' +
        '<div style="position:absolute; inset:0; border-radius:16px; pointer-events:none; background:linear-gradient(135deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0) 52%);"></div>' +
        '<div style="position:relative;">' + scWidgetPreviewBody(t) + '</div></div></div>';"""

TILE_NEW = """      pv.innerHTML = '<div style="position:relative; border-radius:16px; overflow:hidden; box-shadow:0 12px 30px rgba(0,0,0,0.34);">' +
        '<div style="position:absolute; inset:0; background:linear-gradient(135deg,#FF9BB6 0%,#8FD3FF 36%,#7CE3C0 60%,#A996FF 82%,#FFD98A 100%);"></div>' +
        '<div style="position:relative; padding:14px; border-radius:16px; -webkit-backdrop-filter:blur(' + blur + 'px) saturate(1.9) contrast(1.04) brightness(1.04); backdrop-filter:blur(' + blur + 'px) saturate(1.9) contrast(1.04) brightness(1.04); background:linear-gradient(160deg,' + t.css1 + ',' + t.css2 + '); box-shadow:inset 0 1px 0 rgba(255,255,255,' + rim + '), inset 0 -1px 0 rgba(255,255,255,' + edge + '), inset 0 0 0 1px rgba(255,255,255,' + edge + ');">' +
        '<div class="sc-glass-liquid"></div>' +
        '<div style="position:relative;">' + scWidgetPreviewBody(t) + '</div></div></div>';"""

# ---------------------------------------------------------------------------
# 4. The liquid layer itself. One class, one keyframe, two switches off.
# ---------------------------------------------------------------------------
CSS_ANCHOR = """  @keyframes glassSheen{
    0%{ background-position: 150% 50%; }
    50%{ background-position: -50% 50%; }
    100%{ background-position: 150% 50%; }
  }"""

CSS_NEW = """  @keyframes glassSheen{
    0%{ background-position: 150% 50%; }
    50%{ background-position: -50% 50%; }
    100%{ background-position: 150% 50%; }
  }
  /* 80.6.3 - THE LIQUID BAND. iOS glass is not a still pane: it carries a specular
     highlight that travels across it as the thing behind it moves. This is that
     highlight in the one place this app can draw a filter - the Settings preview.
     A slow 9s loop, at rest at either end so the restart is not a jump, and switched
     OFF by both Reduce-motion paths, where it settles mid-pane as a still sheen.
     (The home-screen widget draws a colour, not a filter, so it cannot carry this.) */
  .sc-glass-liquid{
    position:absolute; inset:0; border-radius:inherit; pointer-events:none;
    background: linear-gradient(112deg, rgba(255,255,255,0) 30%, rgba(255,255,255,0.34) 41%, rgba(255,255,255,0.06) 50%, rgba(255,255,255,0) 60%);
    background-size: 320% 320%;
    background-position: 128% 50%;
    mix-blend-mode: screen;
    animation: scGlassLiquid 9s ease-in-out infinite;
  }
  @keyframes scGlassLiquid{
    0%{ background-position: 128% 50%; }
    55%{ background-position: -28% 50%; }
    100%{ background-position: 128% 50%; }
  }
  body.sandbox-reduce-motion .sc-glass-liquid{ animation: none; background-position: 60% 50%; }
  @media (prefers-reduced-motion: reduce){
    .sc-glass-liquid{ animation: none; background-position: 60% 50%; }
  }"""

# ---------------------------------------------------------------------------
# 5. The dial's copy, which promised a "nearly solid pane" and no longer does.
# ---------------------------------------------------------------------------
COPY_OLD = ("How much milk is in the glass. Left is thin and clear &mdash; the wallpaper shows "
            "through and tints the panel; right is a soft, nearly solid pane. Drag it and the "
            "preview below moves with your finger; let go and the widget on your home screen "
            "takes the same setting.")

COPY_NEW = ("How much body is in the glass. Left is nearly clear &mdash; the wallpaper shows "
            "through and colours the panel; right is a soft pane you can still see through, "
            "and its type is easiest to read on a busy or very dark wallpaper. Drag it and the "
            "preview below moves with your finger; let go and the widget on your home screen "
            "takes the same setting.")


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'The glass is <b>thinner</b>: the pane runs from about a third opaque to just over a half, where it used to run from a half to nearly nine tenths. The wallpaper is no longer a tint behind a sheet &mdash; it is what you look through.',
        'And there is <b>less milk</b> in it. The panel is mixed toward white half as much, so what comes through is colour with a cool cast on top instead of a white haze. Thicker still reads colder, not chalkier.',
        'The <b>highlight moves</b> now. The fixed corner sheen is a specular band that drifts across the pane on a slow loop, and it sits still for anyone who has Reduce motion on. That is the Settings preview, because the home-screen widget draws a colour and cannot carry a filter &mdash; the see-through part is what reaches your wallpaper.',
        'The preview is a <b>lens</b>: a bright rim across the top, a soft one under the bottom, and a harder colour push behind it so the thinner glass has something to show. The type is a shade deeper to hold up at the new transparency.',
        'The <b>dial</b> is untouched and still remembers where you leave it. Its caption is honest about the trade now: the thinner end is clearer, the thicker end is easier to read.',
        'Nothing else moved &mdash; the eighteen other presets, fine-tune, follow-the-app-theme, the idle saver and the app\'s own Liquid glass mode are exactly as they were.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Liquid glass: thinner, clearer, and it moves', body))


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8063: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


CLAIMS = [
    ("const APP_VERSION = '80.6.3';", 'the page runs 80.6.3'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.3', date:", 'the changelog records the release'),
    ('var alpha = (0.32 + 0.30 * k) * 255;', 'the pane is the thinner one'),
    ('scFrostMixTowardWhite(scFrostHexToRgb(base.bg1), 0.16 + 0.18 * k)', 'less milk on the lit stop'),
    ('scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.02 + 0.09 * k)', 'less milk on the other'),
    ("bg2: '#96BCE2'", 'the deeper second stop'),
    ('saturate(1.9) contrast(1.04)', 'the backdrop is pushed so colour reads through'),
    ('.sc-glass-liquid{', 'the liquid layer has its rule'),
    ('@keyframes scGlassLiquid{', 'and its keyframes'),
    ('body.sandbox-reduce-motion .sc-glass-liquid{ animation: none;', 'the app switch stops it'),
    ('inset 0 -1px 0 rgba(255,255,255,', 'the bottom rim'),
    ('right is a soft pane you can still see through', 'the dial says what it does'),
]

GONE = [
    ("const APP_VERSION = '80.6.2';", 'the old version constant'),
    ('var alpha = (0.52 + 0.36 * k) * 255;', 'the milky opacity range'),
    ('rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.12) 30%', 'the static painted sheen'),
    ('saturate(1.35) brightness(1.06)', 'the old backdrop push'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the glass is liquid')
        print('patch-8063%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8063 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8063: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, PRESET_OLD, PRESET_NEW, 'the frosted preset')
    page = swap(page, MATH_OLD, MATH_NEW, 'the glass math')
    page = swap(page, BLUR_OLD, BLUR_NEW, 'the preview blur and its rim')
    page = swap(page, TILE_OLD, TILE_NEW, 'the preview tile')
    page = swap(page, CSS_ANCHOR, CSS_NEW, 'the glass stylesheet (the liquid layer goes after the sheen)')
    page = swap(page, COPY_OLD, COPY_NEW, "the dial's caption")

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "// 80.6.2 - PLAIN NOTES AND A FREE STRIP\nvar SC_IS_WEB = (function(){",
                "// 80.6.2 - PLAIN NOTES AND A FREE STRIP\n// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8063: the page did not end up 80.6.3 (%s)' % why)
    # The GONE half runs against the WRITTEN page, before the write: a release that
    # claims something is gone has to have looked.
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8063: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8063: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the thinner pane, the halved milk, the deeper second stop, the liquid band '
          'and its two switches, the two-edge rim, the pushed backdrop, the dial caption, the '
          'changelog head, the version and the shell cache')
    print('patch-8063: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
