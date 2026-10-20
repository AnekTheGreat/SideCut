#!/usr/bin/env python3
"""75.1.2 - the version, the changelog and the shell cache move to 75.1.2.

The two things this release changes are already in the page (dev/patch-7512-rail.py
for the four-up pinned-artists rail, dev/patch-7512-ask.py for the wider Ask SideCut
grammar). This is the release wrapper around them: APP_VERSION, the newest
changelog entry, and the service worker cache name, so a browser holding the
75.1.1 shell cannot serve it after the update.

The note list is written for the store channel as well: the six that ride with it
name surfaces the app really has (the widget, the player, the letter wave, the
lyrics, the albums, the dock, Studio) and carry no apostrophe, because the array
is single-quoted and every carried gate reads it for those words.

Idempotent. `--check` reports whether the page is already on 75.1.2 without writing.

  python3 dev/patch-7512.py
  python3 dev/patch-7512.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

VERSION = '75.1.2'
CACHE = 'sidecut-shell-v75.1.2'

ENTRY = """  { version: '75.1.2', date: 'October 20, 2026 \\u00b7 5:30 AM EDT', title: 'Four pinned artists at a time with the rail scrolling on, and Ask SideCut reads the whole sentence', items: [
    'Pinned artists shows exactly four at a time now: each chip is a quarter of the width of the rail, so the fourth is never sliced in half and the fifth starts right at the edge.',
    'Nothing is capped. The rail is still one sideways-scrolling row, so two pins and twenty behave the same way, and a slow swipe settles on a chip edge instead of mid-artist.',
    'The Pinned artists header says how many are pinned, so finding out that a fifth artist exists no longer depends on a swipe.',
    'Ask SideCut reads the rest of the sentence: play Aurora, play Diljit Dosanjh, play Night Drive, shuffle my Night Drive, repeat this song, next, back, pause.',
    'A name that more than one song answers to is handed back as a question instead of guessed, and a name the library does not have says so with the closest match it does have.',
    'Questions get the numbers in your library instead of a lecture: how many songs, how much music, how many playlists or pinned artists, what is playing, and the most played song and artist.',
    'It follows one plan with another sentence - add these too, take these out, undo that, make it 8 - and Undo reaches shuffle and repeat now, not just playlists.',
    'A sentence it cannot carry out no longer gets a Do it button that changes nothing: it says what it cannot do and lists what it can.',
    'Nothing else moved: the home-screen widget, the player, the letter-by-letter lyrics, the albums, the pill dock and Studio are exactly where 75.1.1 left them, and every saved song, playlist and setting is untouched.',
  ]},
"""

def edit(name, transform):
    path = os.path.join(ROOT, name)
    before = open(path, encoding='utf-8').read()
    after = transform(before)
    if after != before and not CHECK:
        open(path, 'w', encoding='utf-8').write(after)
    return after != before

def patch_index(src):
    src = src.replace("const APP_VERSION = '75.1.1';",
                      "const APP_VERSION = '%s';" % VERSION, 1)
    if "{ version: '%s'" % VERSION not in src:
        needle = "  { version: '75.1.1', date:"
        if needle not in src:
            raise SystemExit('patch-7512: the 75.1.1 changelog entry is missing')
        src = src.replace(needle, ENTRY + needle, 1)
    return src

def patch_sw(src):
    return src.replace("const CACHE_NAME = 'sidecut-shell-v75.1.1';",
                       "const CACHE_NAME = '%s';" % CACHE, 1)

def main():
    changes = []
    for name, fn in (('index.html', patch_index), ('sw.js', patch_sw)):
        if edit(name, fn):
            changes.append(name)

    if CHECK:
        if changes:
            print('patch-7512 --check: not applied (' + ', '.join(changes) + ')')
            return 1
        print('patch-7512 --check: the page is on %s' % VERSION)
        return 0

    if changes:
        print('patch-7512: %d edit(s) in %s' % (len(changes), ', '.join(changes)))
    else:
        print('patch-7512: already applied')
    return 0

if __name__ == '__main__':
    sys.exit(main())
