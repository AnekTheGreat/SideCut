#!/usr/bin/env python3
"""80.3.2 - the lyrics fill letter by letter, a volume boost sits beside the EQ, Settings -> More
is grouped, and a finished download can be filed into an album.

The edits themselves live in four modules beside this file, one per thing the release changes:

    patch_8032_lyrics.py   the words are paced inside `pace`, and letter mode fills the line
    patch_8032_boost.py    the volume boost: its state, its two nodes, its row, its restore
    patch_8032_album.py    the album door a finished download opens
    patch_8032_ui.py       Settings -> More: one card style, six groups, one About card

1. LETTER BY LETTER. (a) The pacer spread a line's words over the whole line window and cut them
   off at `pace`, so every word past the cut had no window and the highlight jumped from the
   first word to the last one, fully lit. The words are spread across `pace` now. (b) Letter mode
   wiped every word but the current one on every frame, so the line read as one word flashing in
   place. A passed word keeps its letters lit, the sung word sweeps, later words stay dark, and
   the fill is wiped per line change (not per tick).

2. VOLUME BOOST, 0 to +15 dB, under the EQ: a master GainNode after both decks' limiters and
   before the assistant duck, with a near-flat compressor after it as a soft ceiling. At 0 dB the
   gain is 1.0 and the compressor is a straight wire (ratio 1), so Off is the plain signal.

3. SETTINGS -> MORE in six named groups, one card style, and the three loose buttons folded into
   one About & updates card with the version label as its first row.

4. A converted single-song download carries "+ Album", which opens the same picker the library
   uses - an album you have, or one you name on the spot.

Idempotent: the marker is this release's page comment, and it is in the page it wrote.

    python3 dev/patch-8032.py
    python3 dev/patch-8032.py --check
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
sys.path.insert(0, HERE)

import patch_8032_album      # noqa: E402
import patch_8032_boost      # noqa: E402
import patch_8032_lyrics     # noqa: E402
import patch_8032_ui         # noqa: E402

CHECK = '--check' in sys.argv
VERSION = '80.3.2'
OLD_VERSION = '80.3.1'
MARKER = patch_8032_lyrics.MARKER

MODULES = (patch_8032_lyrics, patch_8032_boost, patch_8032_album)

CLAIMS = [
    ("const APP_VERSION = '80.3.2';", 'the page runs 80.3.2'),
    (MARKER, 'the release comment is in the pacer'),
    ("{ version: '80.3.2', date:", 'the changelog records the release'),
    ('wordDurs.push((acc / totalWeight) * pace);', 'the words are paced inside `pace`'),
    ('scLettersWipeOthers(keepLine)', 'the fill is wiped per line'),
    ("if(!ls[li].classList.contains('lit')) ls[li].classList.add('lit');", 'a sung word keeps its letters'),
    ('var scBoostDb = 0;', 'the boost has its own state'),
    ('scBoostGain = audioCtx.createGain();', 'the boost gain is in the graph'),
    ('limiter.connect(scBoostGain);', 'the master feeds the boost'),
    ('scBoostGain.connect(scBoostGuard).connect(scDuckMaster);', 'the boost feeds the guard, the guard the duck master'),
    ('id="boostDbSlider"', 'the boost slider is in Settings'),
    ('setBoostDb(boostRow && typeof boostRow.value', 'the boost comes back at boot'),
    ('window.__scAlbumPickForTrack = function(id, label){', 'the album picker is reachable'),
    ('function scArmAddToAlbum(rootEl, track, label){', 'the card button is armed'),
    ('class="sc-add-album"', 'the cards carry the + Album button'),
    ('<div class="sc-mgroup">Good to know</div>', 'the More pane opens with a group name'),
    ('<div class="sc-mgroup">Sound</div>', 'the More pane names its groups'),
    ('<div class="sc-mgroup">App &amp; data</div>', 'and the app group'),
    ('<div class="sc-mgroup">About &amp; updates</div>', 'the About group is there'),
    ('<div class="sc-set-card">', 'the cards share one style'),
]

GONE = [
    ("const APP_VERSION = '80.3.1';", 'the old version constant'),
    ('wordDurs.push((acc / totalWeight) * gap);', 'the window-wide word schedule'),
]


def swap(src, old, new, what, times=1):
    got = src.count(old)
    if got != times:
        raise SystemExit('patch-8032: %s appears %d times, expected %d' % (what, got, times))
    return src.replace(old, new)


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', the letters fill and the boost is in it')
        print('patch-8032%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8032 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8032: the page is not %s, so it is not the shape this release expects' % OLD_VERSION)
    for mod in MODULES:
        for old, new, what in mod.SWAPS:
            page = swap(page, old, new, what)
    page = patch_8032_ui.apply(page, swap)
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    missing = [why for needle, why in CLAIMS if needle not in page]
    if missing:
        sys.exit('patch-8032: the page did not end up 80.3.2 (%s)' % ', '.join(missing))
    left = [why for needle, why in GONE if needle in page]
    if left:
        sys.exit('patch-8032: the page still carries this (%s)' % ', '.join(left))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8032: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))
    print('  applied: the letter fill, the word schedule, the boost, the Settings groups, the album button, the changelog head and the shell cache')
    print('patch-8032: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
