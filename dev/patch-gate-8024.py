#!/usr/bin/env python3
"""80.2.4 - put this release's section into dev/staircase-check.cjs, and check it landed.

dev/staircase-check.cjs answers for the album workflow's own claims, so the album
sort belongs in it: the two doors, the read that comes from Album History, the
filing rule that keeps an unnamed song at the end, the cache, and the two things
the release refuses to do - guess, and file a list that names nothing.

Idempotent: the marker is the section's own heading.

    python3 dev/patch-gate-8024.py
    python3 dev/patch-gate-8024.py --check
"""
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
CHECK = '--check' in sys.argv
GATE = os.path.join(ROOT, 'dev', 'staircase-check.cjs')
MARKER = "console.log('[10] 80.2.4: an album card has its own three dots"

ANCHOR = "console.log('');\nconsole.log(pass + ' passed, ' + fail + ' failed');"

SECTION = r"""console.log('[10] 80.2.4: an album card has its own three dots, and an album sorts into its real order');
{
  // THE TWO DOORS. The card's own three dots and the row in a song's sheet.
  ok(src.indexOf('data-album-kebab="') > 0, 'the album card carries three dots');
  ok(count(src, '[data-album-kebab]') === 1 && src.indexOf('_albKebabBtn.addEventListener') > 0,
    'which are wired, once');
  ok(src.indexOf('scRealAlbumMenu(aName);') > 0, 'and they open the album menu');
  ok(src.indexOf("row('real', '") > 0 && src.indexOf("row('hand', '") > 0,
    'whose rows are the real-order sort and the hand reorder');
  ok(src.indexOf("albRealBtn.id = 'songActionsAlbumReal';") > 0, 'a song sheet carries the same sort');
  ok(count(src, 'function scRealSortAlbum(') === 1,
    'and both doors call one sort, never two implementations');
  // THE READ. The pair Album History makes, and nothing else.
  ok(src.indexOf('async function scRealFetch(name, artist){') > 0, 'the album is read by one function');
  ok(src.indexOf("'https://itunes.apple.com/search?term='") > 0, 'from the iTunes album search');
  ok(src.indexOf("'https://api.deezer.com/album/'") > 0, 'with Deezer as the fallback');
  ok(src.indexOf("var stores = ['', 'US', 'IN', 'GB'];") > 0,
    'walking the same storefronts the app already tries');
  ok(src.indexOf('var score = cn === want ? 3 :') > 0,
    'and a collection counts only when its name agrees with the album');
  // THE FILING, and the two rules it will not break.
  ok(src.indexOf('if(matched) alb.trackIds = ordered;') > 0,
    'a list that names nothing leaves the album alone');
  ok(src.indexOf('songs.forEach(function(s, i){ if(!taken[i]) ordered.push(s.id); });') > 0,
    'and a song the record does not name stays at the end');
  ok(src.indexOf('if(alb.trackIds.length < 2){') > 0,
    'a one-song album says there is no order to sort');
  ok(src.indexOf('toastWithUndo(msg, function(){') > 0, 'every sort carries Undo');
  // THE CACHE. Read back before the network is asked, per album and per artist.
  ok(src.indexOf("var SCREAL_LS = 'sidecut_albumRealOrder';") > 0,
    'the read order is kept on the device');
  ok(src.indexOf('var cached = scRealCacheGet(key, artist);') > 0 &&
     src.indexOf('scRealCachePut(key, entry);') > 0,
    'and read back before the network is asked');
  ok(src.indexOf('if(a1 && a2 && a1 !== a2) return null;') > 0,
    'a different artist under the same name is a different record');
  ok(src.indexOf('if(keys.length > 40){') > 0, 'and the shelf cannot grow without end');
  // NEVER A GUESS.
  ok(src.indexOf('is not an album Album History knows') > 0,
    'an album nothing is found for says so');
  ok(src.indexOf('None of the songs in') > 0,
    'and a list naming none of its songs is refused');
  // THE DOOR A HARNESS KNOCKS ON.
  ok(src.indexOf('window.__scSortAlbumRealOrder = function(name){ return scRealSortAlbum(name); };') > 0,
    'the sort is exported for a suite');
  ok(src.indexOf('window.__scAlbumRealApply = function(name, titles){ return scRealApplyOrder(name, titles); };') > 0,
    'and so is the filing');
}

"""

# One line of the gate per claim this release makes about the page.
CLAIMS = [
    ("console.log('[10] 80.2.4: an album card has its own three dots", 'the gate names 80.2.4'),
    ('the album card carries three dots', 'the card door is pinned'),
    ('and they open the album menu', 'and its menu is pinned'),
    ('whose rows are the real-order sort and the hand reorder', 'both menu rows are pinned'),
    ('a song sheet carries the same sort', 'the song door is pinned'),
    ('and both doors call one sort, never two implementations', 'one implementation is pinned'),
    ('the album is read by one function', 'the read is pinned'),
    ('from the iTunes album search', 'its first source is pinned'),
    ('with Deezer as the fallback', 'its fallback is pinned'),
    ('a list that names nothing leaves the album alone', 'the no-guess rule is pinned'),
    ('and a song the record does not name stays at the end', 'the keep-at-the-end rule is pinned'),
    ('a one-song album says there is no order to sort', 'the one-song answer is pinned'),
    ('every sort carries Undo', 'Undo is pinned'),
    ('the read order is kept on the device', 'the cache is pinned'),
    ('a different artist under the same name is a different record', 'the cache key is pinned'),
    ('an album nothing is found for says so', 'the refusal is pinned'),
    ("const APP_VERSION = '80.2.4';", 'the gate pins 80.2.4'),
    ('sidecut-shell-v80.2.4', 'the gate pins the 80.2.4 shell cache'),
    ("version: '80.2.4'", 'the gate pins the 80.2.4 changelog head'),
]


def main():
    if not os.path.exists(GATE):
        sys.exit('patch-gate-8024: dev/staircase-check.cjs is missing')
    src = open(GATE, encoding='utf-8').read()
    if MARKER in src:
        print('  present: section [10] is already in the gate')
    else:
        if CHECK:
            print('patch-gate-8024 --check: section [10] is not in the gate yet')
            return 1
        if src.count(ANCHOR) != 1:
            sys.exit('patch-gate-8024: the gate is not the shape this release expects')
        src = src.replace(ANCHOR, SECTION + ANCHOR, 1)
        open(GATE, 'w', encoding='utf-8').write(src)
        print('  applied: section [10]')
    missing = [why for needle, why in CLAIMS if needle not in src]
    if missing:
        sys.exit('patch-gate-8024: the gate is not the 80.2.4 one (%s)' % ', '.join(missing))
    print('  the gate answers for 80.2.4: the two doors, the read, the filing, the cache (%d claims)' % len(CLAIMS))
    print('patch-gate-8024%s: 0 step(s) applied' % (' --check' if CHECK else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
