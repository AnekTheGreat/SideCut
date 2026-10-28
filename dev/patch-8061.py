#!/usr/bin/env python3
"""80.6.1 - the glass is ice now.

The owner's ask, verbatim:

    "the frosted design should be much more icy and nice like iOS v80.6.1"

80.6 shipped a light, evenly milky panel. Even milk reads as a grey sheet: there
is no cool in it, the lit corner is only slightly lighter than the rest, and the
preview had a flat 1px border where iOS glass has a rim and a specular sheen.

Three changes, no new plumbing. The preset goes cool (pale ice blue at the top,
steel blue at the bottom, an icy cyan accent for the bars); scFrostGlass() mixes
further toward white and then LIFTS THE BLUE as the dial rises, so thick glass is
icy rather than chalky; and the preview becomes a layered material - blurred and
saturated wallpaper, a white rim, a corner-to-corner specular highlight, and a
contact shadow. The widget itself gets the first two, because they are colours in
the bitmap it is already handed; the rim and sheen are preview-only, exactly like
the blur, and the AGENTS entry says so.

The dial's ends moved with the palette: 0.52 -> 0.88 opacity (was 0.44 -> 0.88),
white mix 0.30 -> 0.55 on the first stop and 0.06 -> 0.26 on the second. Both ends
stay translucent; neither end goes chalk-white.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8061.py
    python3 dev/patch-8061.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.1'
OLD_VERSION = '80.6'
MARKER = '80.6.1 - THE GLASS IS ICE'

# ---------------------------------------------------------------------------
# 1. The preset: pale ice at the lit corner, cool steel at the other, a cyan
#    accent for the playing bars, navy type that keeps its contrast at 0.52.
# ---------------------------------------------------------------------------
PRESET_OLD = "    frost:  { label: 'Frosted glass', glass: true, bg1: '#F6F9FF', bg2: '#CBD8EF', title: '#111A2B', artist: '#41506B', accent: '#2F6BFF', accentText: '#FFFFFF', pill: '#FFFFFF', pillText: '#111A2B' },"

PRESET_NEW = "    frost:  { label: 'Frosted glass', glass: true, bg1: '#E4F1FF', bg2: '#A9C6E6', title: '#0A1A2E', artist: '#39557A', accent: '#46C8F5', accentText: '#062033', pill: '#FFFFFF', pillText: '#0A1A2E' },"

# ---------------------------------------------------------------------------
# 2. The math: more opacity, more milk, and the blue lift that makes it ice.
# ---------------------------------------------------------------------------
# The lift is a separate helper so the numbers above stay readable and so the
# check can drive the page's own copy of it.
LIFT_ANCHOR = """  function scFrostGlass(base){"""

LIFT_ADD = """  // 80.6.1 - THE ICE LIFT. Mixing toward white alone gives milk, and milk reads
  // grey on a phone. Ice is white with the red pulled out of it and the blue put
  // back, so this nudges every channel the way a real frosted pane does, scaled
  // by the dial: at 0 it is a whisper, at 100 it is the cool that makes the pane
  // look lit from behind rather than painted on.
  function scFrostIce(rgb, amount){
    return [Math.max(0, Math.round(rgb[0] - 7 * amount)),
            Math.round(rgb[1] + 1 * amount),
            Math.min(255, Math.round(rgb[2] + 12 * amount))];
  }
  function scFrostGlass(base){"""

BODY_OLD = """    var alpha = (0.44 + 0.44 * k) * 255;
    var c1 = scFrostMixTowardWhite(scFrostHexToRgb(base.bg1), 0.12 + 0.28 * k);
    var c2 = scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.04 + 0.14 * k);"""

BODY_NEW = """    var alpha = (0.52 + 0.36 * k) * 255;
    var c1 = scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg1), 0.30 + 0.25 * k), k);
    var c2 = scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.06 + 0.20 * k), k);"""

# ---------------------------------------------------------------------------
# 3. The preview: the iOS material - rim, specular sheen, contact shadow, and a
#    wallpaper strip with enough colour in it to prove the blur is real.
# ---------------------------------------------------------------------------
BLUR_OLD = """      const blur = 6 + Math.round((t.frost || 0) * 0.16);
      const edge = (0.18 + (t.frost || 0) * 0.0032).toFixed(3);"""

BLUR_NEW = """      const blur = 8 + Math.round((t.frost || 0) * 0.18);
      const edge = (0.22 + (t.frost || 0) * 0.0034).toFixed(3);
      const rim = (0.50 + (t.frost || 0) * 0.0035).toFixed(3);"""

TILE_OLD = """      pv.innerHTML = '<div style="position:relative; border-radius:16px; overflow:hidden;">' +
        '<div style="position:absolute; inset:0; background:linear-gradient(135deg,#FF8FB1 0%,#7AC6FF 42%,#9D7BFF 72%,#FFD166 100%);"></div>' +
        '<div style="position:relative; padding:14px; border-radius:16px; -webkit-backdrop-filter:blur(' + blur + 'px) saturate(1.1); backdrop-filter:blur(' + blur + 'px) saturate(1.1); background:linear-gradient(160deg,' + t.css1 + ',' + t.css2 + '); border:1px solid rgba(255,255,255,' + edge + ');">' +
        scWidgetPreviewBody(t) + '</div></div>';"""

TILE_NEW = """      pv.innerHTML = '<div style="position:relative; border-radius:16px; overflow:hidden; box-shadow:0 10px 26px rgba(0,0,0,0.38);">' +
        '<div style="position:absolute; inset:0; background:linear-gradient(135deg,#FF9BB6 0%,#8FD3FF 36%,#7CE3C0 60%,#A996FF 82%,#FFD98A 100%);"></div>' +
        '<div style="position:relative; padding:14px; border-radius:16px; -webkit-backdrop-filter:blur(' + blur + 'px) saturate(1.35) brightness(1.06); backdrop-filter:blur(' + blur + 'px) saturate(1.35) brightness(1.06); background:linear-gradient(160deg,' + t.css1 + ',' + t.css2 + '); box-shadow:inset 0 1px 0 rgba(255,255,255,' + rim + '), inset 0 0 0 1px rgba(255,255,255,' + edge + ');">' +
        '<div style="position:absolute; inset:0; border-radius:16px; pointer-events:none; background:linear-gradient(135deg, rgba(255,255,255,0.58) 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0) 52%);"></div>' +
        '<div style="position:relative;">' + scWidgetPreviewBody(t) + '</div></div></div>';"""

# ---------------------------------------------------------------------------
# 4. The changelog.
# ---------------------------------------------------------------------------
def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        'The glass is <b>ice</b> now: pale blue where the light hits it, cool steel at the other end, and a <b>cyan accent</b> on the playing bars instead of a flat blue. Thicker frost reads colder, not chalkier &mdash; the panel lifts its blue as the dial goes up.',
        'The <b>Frost dial</b> still runs 0 to 100. Its ends moved with the palette: the thinnest setting is a touch milkier than it was, so the type stays readable on a busy photo, and the thickest is still see-through.',
        'The <b>preview</b> is the iOS-style material now &mdash; the wallpaper strip blurs and saturates behind the pane, a white rim runs around the edge, a sheen falls across the top-left corner and the panel sits on a soft shadow. That is the one place the rim and the sheen exist: the home-screen widget draws a colour, not a filter.',
        'Nothing else moved &mdash; the eighteen other presets, the dial\'s memory, fine-tune, follow-the-app-theme and the idle saver are exactly as they were.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'The glass is ice: cooler, brighter, with a rim and a sheen', body))


def swap(src, old, new, what):
    count = src.count(old)
    if count != 1:
        raise SystemExit('patch-8061: %s appears %d times, expected 1 (anchor: %s)'
                         % (what, count, old[:70].replace('\n', '\\n')))
    return src.replace(old, new, 1)


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the glass is ice')
        print('patch-8061%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8061 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8061: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, PRESET_OLD, PRESET_NEW, 'the frosted preset')
    page = swap(page, LIFT_ANCHOR, LIFT_ADD, 'scFrostGlass (the ice lift goes above it)')
    page = swap(page, BODY_OLD, BODY_NEW, 'the glass math')
    page = swap(page, BLUR_OLD, BLUR_NEW, 'the preview blur and its rim')
    page = swap(page, TILE_OLD, TILE_NEW, 'the preview tile')

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){",
                "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8061: the page did not end up 80.6.1 (%s)' % why)
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8061: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the icy preset, the blue lift, the milkier ends, the preview rim, sheen and '
          'shadow, the changelog head, the version and the shell cache')
    print('patch-8061: 1 step(s) applied')
    return 0


CLAIMS = [
    ("const APP_VERSION = '80.6.1';", 'the page runs 80.6.1'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.1', date:", 'the changelog records the release'),
    ("bg1: '#E4F1FF', bg2: '#A9C6E6'", 'the preset is the icy one'),
    ("accent: '#46C8F5'", 'and its bars are cyan'),
    ('function scFrostIce(rgb, amount){', 'the ice lift is in the page'),
    ('var alpha = (0.52 + 0.36 * k) * 255;', 'the dial ends moved with the palette'),
    ('scFrostIce(scFrostMixTowardWhite(scFrostHexToRgb(base.bg2), 0.06 + 0.20 * k), k)',
     'both stops are cooled'),
    ('const rim = (0.50 + (t.frost || 0) * 0.0035).toFixed(3);', 'the preview has a rim'),
    ('rgba(255,255,255,0.58) 0%', 'and a specular sheen'),
]

GONE = [
    ("const APP_VERSION = '80.6';", 'the old version constant'),
    ("var alpha = (0.44 + 0.44 * k) * 255;", 'the flat-milk opacity'),
    ("saturate(1.1)", 'the preview tint that had no brightness or saturation'),
]


if __name__ == '__main__':
    sys.exit(main())
