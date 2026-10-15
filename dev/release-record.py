#!/usr/bin/env python3
"""
Write this release's entry into AGENTS.md, for any release.

WHY THIS IS A FILE AND NOT A STEP'S HEREDOC. The workflow that runs a release
cannot be pushed by a workflow - GitHub refuses any commit that touches
`.github/workflows/` from an Actions token ("without 'workflows' permission") - so
that workflow can only be edited by hand, through an API call that carries the
whole file. Every kilobyte in it is a kilobyte that has to travel by hand. The
prose lives in dev/release-entry.md, this script does the insert, and the workflow
step is one line.

The template carries {{STAMP}}, {{ROOT}} and {{PLAY}}: the date stamp is computed
here (EDT, the repo's usual wall clock) and the two bundle sizes come from the OTA
channels the release step just rebuilt, because those are the numbers a landed
release is described by.

The version comes from index.html, never from an argument, so the entry that lands
cannot describe a release other than the one the page is on.

Idempotent: if AGENTS.md already carries the entry, nothing is written.

  python3 dev/release-record.py
"""
import datetime
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AGENTS = os.path.join(ROOT, 'AGENTS.md')
TEMPLATE = os.path.join(ROOT, 'dev', 'release-entry.md')
HEAD = '# SideCut \u2014 repository memory\n'


def version():
    src = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    m = re.search(r"const APP_VERSION = '([^']+)'", src)
    if not m:
        raise SystemExit('FATAL: index.html has no APP_VERSION')
    return m.group(1)


def main():
    ver = version()
    mark = '## %s (' % ver
    src = open(AGENTS, encoding='utf-8').read()
    if mark in src:
        print('AGENTS.md already carries %s - nothing to write' % ver)
        return 0
    if not src.startswith(HEAD):
        raise SystemExit('FATAL: AGENTS.md does not start with the expected heading')

    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    stamp = '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')

    root = json.load(open(os.path.join(ROOT, 'ota', 'updates.json')))
    play = json.load(open(os.path.join(ROOT, 'ota-play', 'updates.json')))

    entry = open(TEMPLATE, encoding='utf-8').read()
    if not entry.startswith(mark):
        raise SystemExit('FATAL: dev/release-entry.md is not the entry for %s' % ver)
    for key, value in (('{{STAMP}}', stamp), ('{{ROOT}}', str(root['size'])), ('{{PLAY}}', str(play['size']))):
        if key not in entry:
            raise SystemExit('FATAL: dev/release-entry.md has no %s to fill in' % key)
        entry = entry.replace(key, value)

    open(AGENTS, 'w', encoding='utf-8').write(HEAD + '\n' + entry + src[len(HEAD):].lstrip('\n'))
    print('AGENTS.md: wrote the %s entry at %s' % (ver, stamp))
    return 0


if __name__ == '__main__':
    sys.exit(main())
