#!/usr/bin/env python3
"""82 - the version the crop sheet and the per-song speed ship as.

81.7 and 81.8 changed the page without moving APP_VERSION, so an installed copy on
81.6 had no reason to take them: the updater compares the version the page names.
This payload names 82, gives it a changelog entry, and names the service worker's
cache for it, which is what the OTA bundle reads.

    python3 dev/patch-82.py           apply (idempotent - a second run is a no-op)
    python3 dev/patch-82.py --check   0 when the page already says 82, 1 when it does not
"""
import io
import re
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '82'
OLD = '81.6'

ENTRY = """  // 82 - CROPPING BY THE NUMBER, AND A SPEED THAT BELONGS TO ONE SONG.
  { version: '82', date: 'November 6, 2026 · 8:10 PM EST', title: 'Cropping by the number, and a speed for one song', items: [
    '[FULL] Cropping is a computer job now: type the exact start and end to a tenth of a second, nudge either edge a second at a time, or click the waveform to drop the nearest edge there.',
    '[FULL] The crop sheet is wider, its grab handles are nearly twice as wide, and the keyboard does the rest - arrows nudge the edge you last touched, Shift moves a whole second, Space previews and Enter saves.',
    '[FULL] Every song can carry its own speed: tap the chip on the now bar to step through 1x, 1.25x, 1.5x, 2x, 0.75x and 0.5x, or set an exact rate in the song own rack. It is remembered per song, the pitch is kept, and every other song stays at 1x.',
    '[FULL] Searching the open catalogue and playing a streamed song work in a browser again, not only in the Android app.'
  ]},
"""


def applied(text):
    return "const APP_VERSION = '" + VERSION + "';" in text and "version: '" + VERSION + "'" in text


def main():
    text = io.open(PAGE, encoding='utf-8').read()
    if '--check' in sys.argv:
        print('applied' if applied(text) else 'pending')
        return 0 if applied(text) else 1

    if applied(text):
        print('82 is already on the page - nothing to do')
        return 0

    old_const = "const APP_VERSION = '" + OLD + "';"
    if text.count(old_const) != 1:
        sys.exit('APP_VERSION: %d matches for %r (expected 1)' % (text.count(old_const), old_const))
    text = text.replace(old_const, "const APP_VERSION = '" + VERSION + "';", 1)
    print('ok  APP_VERSION 81.6 -> 82')

    anchor = "  { version: '81.6',"
    if text.count(anchor) != 1:
        sys.exit('changelog anchor: %d matches (expected 1)' % text.count(anchor))
    text = text.replace(anchor, ENTRY + anchor, 1)
    print('ok  changelog entry for 82')

    with io.open(PAGE, 'w', encoding='utf-8') as f:
        f.write(text)

    sw = io.open(SW, encoding='utf-8').read()
    sw2, n = re.subn(r"const CACHE_NAME = '[^']*';", "const CACHE_NAME = 'sidecut-shell-v82';", sw, count=1)
    if n != 1:
        sys.exit('CACHE_NAME: could not be found in sw.js')
    with io.open(SW, 'w', encoding='utf-8') as f:
        f.write(sw2)
    print('ok  service worker cache named v82')
    return 0


if __name__ == '__main__':
    sys.exit(main())
