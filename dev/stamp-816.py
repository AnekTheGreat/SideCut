#!/usr/bin/env python3
"""81.6 - stamp the version and the notes everywhere the app reads them.

    python3 dev/stamp-816.py
    python3 dev/stamp-816.py --check

The version the app compares against lives in five manifests (the web page and the
store build each have an update feed and a manifest) plus the shell cache. They are
written together, from the same three notes, so a phone cannot be told two different
things about which release it is on.

The size is left alone here: it is the size of the OTA bundle, and dev/ota-bundle.mjs
fills it in when the bundle is rebuilt.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '81.6'
DATE = 'November 5, 2026 \u00b7 12:20 PM EST'
NOTES = [
    "Pause from the headphones and the same buttons bring the music back: play, next and previous all resume a paused song, and next starts the song it moves to.",
    "A paused song stays reachable from the headphones, the lock screen and the widget instead of the player going quiet after ten minutes away, and a song played from a URL stays reachable the same way a file does.",
    "Previous on a paused song rewinds to the start and plays it, and a skip that resumes a long-paused song rebuilds its audio if the phone had reclaimed it, so the bar moves and the sound comes back.",
]

FILES = ['updates.json', 'manifest.json', 'ota/updates.json', 'ota/manifest.json', 'ota-play/updates.json']

pending = []
for name in FILES:
    path = os.path.join(ROOT, name)
    with open(path, encoding='utf-8') as fh:
        raw = fh.read()
    data = json.loads(raw)
    want = {'version': VERSION, 'notes': NOTES, 'date': DATE}
    if all(data.get(k) == v for k, v in want.items()):
        continue
    data.update(want)
    pending.append((name, data))

sw_path = os.path.join(ROOT, 'sw.js')
with open(sw_path, encoding='utf-8') as fh:
    sw = fh.read()
sw_new = sw.replace("const CACHE_NAME = 'sidecut-shell-v80.6.11';", "const CACHE_NAME = 'sidecut-shell-v81.6';")
sw_changed = sw_new != sw

if not pending and not sw_changed:
    print('stamp-816: already stamped %s' % VERSION)
    sys.exit(0)

if CHECK:
    print('1')
    sys.exit(1)

for name, data in pending:
    with open(os.path.join(ROOT, name), 'w', encoding='utf-8') as fh:
        fh.write(json.dumps(data, separators=(',', ':')) + '\n')
    print('%s -> %s (%d notes)' % (name, VERSION, len(data['notes'])))

if sw_changed:
    with open(sw_path, 'w', encoding='utf-8') as fh:
        fh.write(sw_new)
    print('sw.js -> sidecut-shell-v%s' % VERSION)
