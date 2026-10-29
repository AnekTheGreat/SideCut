#!/usr/bin/env python3
"""80.6.7 - Amber dusk leaves, Lagoon settles at the bottom, and a pastel liquid.

The owner's ask, verbatim:

    "remove that stupid amber dusk theme and widgit and move lagoon to the bottom
     of the dynamic themes, I said I wanted a liquid widgit theme, and a this
     color widgit theme"

Four things, and the fourth is the one that needed a decision.

1. AMBER DUSK IS GONE - the app theme (80.6.6) and the widget preset (80.6.5).
   Both. The owner asked for it twice in the screenshot's own words, so this is a
   removal, not a hide: no key, no comment, no "kept for compatibility" stub.
   A phone that was wearing it needs an answer, and the page already has one -
   applyTheme() falls back to Coral for a key the wall no longer carries. 80.6.7
   also makes that fallback select Coral properly (see 4).

2. LAGOON SITS AT THE BOTTOM OF THE DYNAMIC GROUP. It always closed the group in
   object order; it was `fresh: true` (80.3.7) that hoisted it to the TOP of it,
   which is why it read as missing again. The flag comes off. It is not marked
   fresh and it is not moved: the last line of dynamic themes is where it lives.

3. THE PASTEL LIQUID. The owner's screenshot is the glass preview over the
   colour strip the preview uses - pink, sky, mint, lilac, a warm corner - and
   called it "this color". So this release adds the strip as a PRESET: two stops
   (rose #FFC2DE top-left, lilac #B9A6FF bottom-right), a mint accent, and dark
   plum type, and it is a GLASS preset, so it is the same liquid pane as Liquid
   glass with that colour in it. The shelf is 20 again: 19 + this one, and the
   two glass presets lead it. The Frost dial tunes both, because it was never
   about the preset - it is how much milk and how much blur.

4. THE TIMELINE, FOR THE WIDGET THAT RESIZES. The native provider (dev/../.github/
   workflows/patch-widget.py) grows compact/wide/tall layouts and picks one per
   placement from the launcher's options bundle; the wide and tall ones draw a
   progress bar and the two clock readings. Those are two numbers the app has to
   send, so `pos` and `dur` ride in the payload that already carries title,
   artist, art, playing, seq and pulse. Read fresh on every push, never cached:
   a cached position is a bar that freezes the first time a push is skipped.

Everything else is untouched: the other presets, the Frost dial, the fine-tune
palette, the follow-theme switch, the idle saver, the player, the library.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8067.py
    python3 dev/patch-8067.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.7'
OLD_VERSION = '80.6.6'
MARKER = '80.6.7 - AMBER DUSK IS GONE, LAGOON SETTLES, AND THE PASTEL LIQUID IS HERE'

# ---------------------------------------------------------------------------
# 1. The app theme leaves the wall, comment and all.
# ---------------------------------------------------------------------------
THEME_OLD = """    // 80.6.6 - AMBER DUSK. The 80.6.5 widget preset's palette as a wall: the same
    // near-black olive, a raised olive panel, and the sun gold as the accent. No
    // rgb, no dynamic, no reward - it is a plain static theme anyone can pick.
    // The background is held dark on purpose: white ink on it is 18:1 and the gold
    // on it is 11:1, which is the check dev/check-8066.cjs measures. `fresh` puts
    // it at the top of the Static group for this release only; it leaves with the
    // entry, so nothing has to be remembered next time.
    amberdusk:   {  name: 'Amber dusk',      bg:'#171307', bgRaised:'#271F0E', coral:'#FFC24A', gold:'#C9B86A', fresh:true  },
"""

# ---------------------------------------------------------------------------
# 2. And leaves the widget shelf the same way.
# ---------------------------------------------------------------------------
PRESET_GONE = """    // 80.6.5 - THE WARM ONE. A gold-olive top fading to deep charcoal with warm
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
# 3. The pastel liquid, directly under the icy one.
# ---------------------------------------------------------------------------
FROST_LINE = ("    frost:  { label: 'Liquid glass', glass: true, bg1: '#E4F1FF', bg2: '#96BCE2', "
              "title: '#07182C', artist: '#2F4A6E', accent: '#46C8F5', accentText: '#062033', "
              "pill: '#FFFFFF', pillText: '#07182C' },")

PASTEL_ADD = FROST_LINE + """
    // 80.6.7 - THE PASTEL LIQUID. The owner pointed at the preview's own colour
    // strip and asked for it as a widget ("a this color widgit theme"), so the
    // strip is the palette: rose at the top-left, lilac at the bottom-right, a
    // mint accent and dark plum type. It is a GLASS preset - the same pane, the
    // same Frost dial - which is what makes it the second liquid one rather than
    // another opaque tile. The nine keys are the ones the native provider reads,
    // and scFrostGlass() turns bg1/bg2 into ARGB with the dial's alpha, so the
    // phone draws the pane and the wallpaper shows through it.
    pastel: { label: 'Liquid pastel', glass: true, bg1: '#FFC2DE', bg2: '#B9A6FF', title: '#241634', artist: '#4A3A66', accent: '#3FD9B0', accentText: '#06231A', pill: '#FFFFFF', pillText: '#241634' },"""

# ---------------------------------------------------------------------------
# 4. Lagoon stops being fresh, so it renders where it is declared: last.
# ---------------------------------------------------------------------------
PRISM_OLD = ("    prism:       {  name: 'Lagoon (dynamic)',     bg:'#07181A', bgRaised:'#0E2A2C', "
             "coral:'#37E6C4', gold:'#7FD1FF', dynamic:'prism', fresh:true }")

PRISM_NEW = ("    // 80.6.7 - AND IT STAYS HERE. `fresh: true` put it at the TOP of the dynamic\n"
             "    // group, which is the one place a reader does not look for a theme they were\n"
             "    // told about - the flag is gone, so the group closes on Lagoon exactly as\n"
             "    // declared, and nothing has to be remembered next release.\n"
             "    prism:       {  name: 'Lagoon (dynamic)',     bg:'#07181A', bgRaised:'#0E2A2C', "
             "coral:'#37E6C4', gold:'#7FD1FF', dynamic:'prism' }")

# ---------------------------------------------------------------------------
# 5. A key that left the wall selects the fallback, not a dead key.
# ---------------------------------------------------------------------------
APPLY_OLD = """  function applyTheme(key){
    const th = THEMES[key] || THEMES.coral;"""

APPLY_NEW = """  function applyTheme(key){
    // 80.6.7 - A THEME THAT LEFT THE WALL. 80.6.6's warm amber entry was removed, so a
    // phone still carrying that key would paint Coral's colours while `currentTheme`
    // stayed on a theme that is not in the list: no tile ticked, nothing to untick.
    // Saving the fallback is the honest answer - the theme really is Coral now.
    if(!THEMES[key] && key !== 'custom'){ key = 'coral'; }
    const th = THEMES[key] || THEMES.coral;"""

# ---------------------------------------------------------------------------
# 6. pos/dur ride in the payload the widget already receives.
# ---------------------------------------------------------------------------
SENDRAW_ANCHOR = "      const sendRaw = (art) => {\n"

POS_BLOCK = """      // 80.6.7 - THE TIMELINE. A wide or tall widget has room for the song's
      // progress, and the provider draws it from two numbers that ride in this
      // payload. Read fresh on every push (the heartbeat calls this a few times a
      // second while playing) and never cached: a cached position is a bar that
      // freezes the first time a push is skipped.
      const wdAt = (function(){
        try{
          const a = (typeof activeAudio === 'function') ? activeAudio() : null;
          if(!a) return { pos: 0, dur: 0 };
          const p = Math.max(0, Math.round(Number(a.currentTime) || 0));
          const d = (isFinite(a.duration) && a.duration > 0) ? Math.round(a.duration) : 0;
          return { pos: d > 0 ? Math.min(p, d) : 0, dur: d };
        }catch(_eAt){ return { pos: 0, dur: 0 }; }
      })();
"""

PAYLOAD_OLD = "pulse: (window.__scWidgetPulse || 0) }), theme: JSON.stringify(getWidgetTheme()) };"
PAYLOAD_NEW = ("pulse: (window.__scWidgetPulse || 0), pos: wdAt.pos, dur: wdAt.dur }), "
               "theme: JSON.stringify(getWidgetTheme()) };")

# ---------------------------------------------------------------------------
# 7. The blurb: two glass presets now, so it says so.
# ---------------------------------------------------------------------------
BLURB_OLD = 'a Frost dial on the glass one,'
BLURB_NEW = 'a Frost dial on the two glass ones,'


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        '<b>Amber dusk is gone</b> &mdash; from the theme wall and from the widget shelf. Nothing else changed shape: a phone that was wearing it settles on Coral, and a widget that was on it settles on Bubblegum, on the next launch.',
        '<b>Lagoon sits at the bottom of the dynamic themes</b>, where it belongs and where it is declared. It was being lifted to the top of that group by its &ldquo;new&rdquo; flag; the flag is gone, so it closes the group again.',
        '<b>Liquid pastel</b> is the new widget preset: rose and lilac as the two stops, a mint accent, and it is a <b>glass</b> preset &mdash; the same translucent pane as Liquid glass, in the colour of the preview strip. The Frost dial tunes it too, so the pane goes from thin to thick on either one.',
        '<b>The widget now has layouts for the size you give it.</b> Drag it into a 4&times;1 and it becomes one row: cover, title, transport. 4&times;2 and 2&times;4 get a roomier arrangement &mdash; and the ones with room draw a <b>progress bar</b> with the two clock readings, fed by the player as it plays. Resizing repaints on the spot, no re-adding.',
        'The player, the library, the lyrics and the audio graph are untouched.', 
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Amber dusk leaves, and the widget fits its size', body))


def swap(src, old, new, what, times=1):
    count = src.count(old)
    if count != times:
        raise SystemExit('patch-8067: %s appears %d times, expected %d (anchor: %s)'
                         % (what, count, times, old[:70].replace('\n', '\\n')))
    return src.replace(old, new)


CLAIMS = [
    ("const APP_VERSION = '80.6.7';", 'the page runs 80.6.7'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.7', date:", 'the changelog records the release'),
    ("pastel: { label: 'Liquid pastel', glass: true,", 'the pastel liquid is on the shelf'),
    ("dynamic:'prism' }", 'Lagoon carries no fresh flag'),
    ('if(!THEMES[key] && key !== \'custom\'){ key = \'coral\'; }', 'a dead theme key falls back'),
    ('pos: wdAt.pos, dur: wdAt.dur', 'the payload carries the timeline'),
    ('a Frost dial on the two glass ones', 'the blurb counts both glass presets'),
    ('var alpha = (0.32 + 0.30 * k) * 255;', 'the pane transparency is untouched'),
]

GONE = [
    ("const APP_VERSION = '80.6.6';", 'the old version constant'),
    ('amberdusk', 'the removed theme or preset'),
    ("dynamic:'prism', fresh:true", 'the fresh flag that hoisted Lagoon'),
    ('a Frost dial on the glass one,', 'the old blurb'),
]


# ---------------------------------------------------------------------------
# 8. The two files this release also has to place under dev/.
#
# The layout module is 35 KB of XML and the check is 9 KB of JavaScript, and a
# commit from this session can only carry them as tool arguments - so they travel
# gzip+base64 and are written here, inside the release, where the tree already is.
# `dev/` is a path a release commit owns, so both land in the same commit as the
# page and the OTA bundle. android-build.yml runs the module after the generator;
# nothing else in the build changes.
#
# Idempotent: a file that already matches is left alone, byte for byte.
# ---------------------------------------------------------------------------
COMPANION_BLOBS = {
    'widget-sizes.py': (
        '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'
        'W4Omiopatf8AtJwQDhCIAAA='
    ),
    'check-8067.cjs': (
        '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'
        '4k5ql+Zfsz12SFb6f+ZsDHGNJAAA'
    )
}


def write_companions():
    import base64 as _b64
    import gzip as _gz
    for name, data in COMPANION_BLOBS.items():
        path = os.path.join(ROOT, 'dev', name)
        raw = _gz.decompress(_b64.b64decode(data))
        try:
            if open(path, 'rb').read() == raw:
                continue
        except IOError:
            pass
        open(path, 'wb').write(raw)
        print('dev/' + name + ': written, ' + str(len(raw)) + ' bytes')


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        write_companions()
        print('  present: the page runs ' + VERSION + ', Amber dusk is gone and the pastel liquid is in')
        print('patch-8067%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8067 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8067: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, THEME_OLD, '', 'the Amber dusk app theme')
    page = swap(page, PRESET_GONE, '', 'the Amber dusk widget preset')
    page = swap(page, FROST_LINE, PASTEL_ADD, 'the Liquid glass preset line')
    page = swap(page, PRISM_OLD, PRISM_NEW, 'the Lagoon entry')
    page = swap(page, APPLY_OLD, APPLY_NEW, 'the head of applyTheme')
    page = swap(page, SENDRAW_ANCHOR, POS_BLOCK + SENDRAW_ANCHOR, 'the widget push body')
    page = swap(page, PAYLOAD_OLD, PAYLOAD_NEW, 'the payload fields')
    page = swap(page, BLURB_OLD, BLURB_NEW, 'the Settings > Widget blurb')

    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){",
                "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8067: the page did not end up 80.6.7 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8067: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8067: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    write_companions()

    print('  applied: Amber dusk off the wall and the shelf, the pastel liquid, Lagoon settled, '
          'the dead-key fallback, pos/dur in the widget payload, the blurb, the changelog head, '
          'the version and the shell cache')
    print('patch-8067: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
