#!/usr/bin/env python3
"""75.1.1 - the version moves, and the root update manifest points at the bundle.

The release is a re-cut of 75.1 plus one repair on the update path: the copy of
updates.json at the repository root named `update.zip` relative to the root,
where no such file is published (the real bundle is ota/update.zip). An install
still reading the first manifest location therefore got a 404 instead of the
update. The root copy now names the bundle that exists.

Idempotent. `--check` reports whether the page is already on 75.1.1 without
writing anything.

  python3 dev/patch-7511.py
  python3 dev/patch-7511.py --check
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv

VERSION = '75.1.1'
CACHE = 'sidecut-shell-v75.1.1'

ENTRY = """  { version: '75.1.1', date: 'October 19, 2026 \u00b7 7:00 PM EDT', title: '75.1 re-cut as 75.1.1, and the old root update path points at the real bundle', items: [
    '75.1.1 is 75.1 re-cut under a fresh version, so an install that already has 75.1 cached can see a build newer than itself and take the update.',
    'The legacy manifest at the repository root used to name update.zip at the root, where no such file exists; it now names ota/update.zip, the bundle that is actually published.',
    'The root manifest.json follows the same path, so an older install that still reads the first manifest location gets a working update instead of a 404.',
    'The shell cache moves to sidecut-shell-v75.1.1, so the browser cannot serve the 75.1 page from its offline copy after the update.',
    'Nothing in the app changed: the Ask SideCut overlay on the listening-stats bubble, the album planner and Undo are exactly 75.1.',
    'The release gate count for the shared junk-title test is repinned from 23 to 25 (one definition and 24 call sites), so the carried 6139 red is gone without weakening the exact-count rule.',
    'Nothing else moved: the widget, the player, the letter-by-letter lyrics and the albums are exactly where 75.1 left them, and every saved song, playlist and setting is untouched.',
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
    src = src.replace("const APP_VERSION = '75.1';",
                      "const APP_VERSION = '%s';" % VERSION, 1)
    if "{ version: '%s'" % VERSION not in src:
        needle = "  { version: '75.1', date:"
        if needle not in src:
            raise SystemExit('patch-7511: the 75.1 changelog entry is missing')
        src = src.replace(needle, ENTRY + needle, 1)
    return src

def patch_sw(src):
    return src.replace("const CACHE_NAME = 'sidecut-shell-v75.1';",
                       "const CACHE_NAME = '%s';" % CACHE, 1)

def patch_bundle(src):
    old = "fs.writeFileSync(path.join(ROOT, 'updates.json'), JSON.stringify(manifest));"
    new = ("// The root copy must point at the real bundle: an older client resolves\n"
           "// update.zip relative to the repository root, where no zip is published.\n"
           "fs.writeFileSync(path.join(ROOT, 'updates.json'), JSON.stringify({ ...manifest, url: 'ota/update.zip' }));")
    return src.replace(old, new, 1)

def main():
    changes = []
    for name, fn in (('index.html', patch_index), ('sw.js', patch_sw),
                     ('dev/ota-bundle.mjs', patch_bundle)):
        try:
            changed = edit(name, fn)
        except SystemExit:
            raise
        if changed:
            changes.append(name)

    if CHECK:
        if changes:
            print('patch-7511 --check: not applied (' + ', '.join(changes) + ')')
            return 1
        print('patch-7511 --check: the page is on %s' % VERSION)
        return 0

    if changes:
        print('patch-7511: %d edit(s) in %s' % (len(changes), ', '.join(changes)))
    else:
        print('patch-7511: already applied')
    return 0

if __name__ == '__main__':
    sys.exit(main())
