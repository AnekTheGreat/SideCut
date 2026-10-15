#!/usr/bin/env python3
"""
74.1.5 - write this release's entry (dev/release-7415-entry.md) into AGENTS.md.

WHY THIS IS A FILE AND NOT A STEP'S HEREDOC. The workflow that runs the release
cannot be pushed by the Actions token - GitHub refuses any commit that touches
`.github/workflows/` from a workflow ("without 'workflows' permission") - so that
workflow can only be edited by hand, through an API call that carries the whole
file. Every kilobyte in it is a kilobyte that has to travel by hand, and the 74.1.5
entry alone was nine of them. The prose lives in the template, this script does the
insert, and the workflow step is one line.

The template carries {{STAMP}}, {{ROOT}} and {{PLAY}}: the date stamp is computed
here (EDT, the repo's usual wall clock) and the two zip sizes come from the bundles
the previous step just rebuilt, because those are the numbers a landed release is
described by.

Idempotent: if AGENTS.md already carries the entry, nothing is written.
"""
import datetime
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
AGENTS = os.path.join(ROOT, 'AGENTS.md')
TEMPLATE = os.path.join(ROOT, 'dev', 'release-7415-entry.md')
HEAD = '# SideCut \u2014 repository memory\n'
MARK = '## 74.1.5 ('


def main():
    src = open(AGENTS, encoding='utf-8').read()
    if MARK in src:
        print('AGENTS.md already carries 74.1.5 - nothing to write')
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
    for key, value in (('{{STAMP}}', stamp), ('{{ROOT}}', str(root['size'])), ('{{PLAY}}', str(play['size']))):
        if key not in entry:
            raise SystemExit('FATAL: dev/release-7415-entry.md has no %s to fill in' % key)
        entry = entry.replace(key, value)

    open(AGENTS, 'w', encoding='utf-8').write(HEAD + '\n' + entry + src[len(HEAD):].lstrip('\n'))
    print('AGENTS.md: wrote the 74.1.5 entry at ' + stamp)
    return 0


if __name__ == '__main__':
    sys.exit(main())
