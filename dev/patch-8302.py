#!/usr/bin/env python3
"""83.0.2 - SideCut: My Hub comes off the Other apps list.

83.0.1 listed four apps. My Hub is not on a store page, so a tap on it leaves the app for a repository
rather than a page that can install anything, and the owner asked for it to come off.

FamTM, UJournal and MeasureT stay, in the same place and the same card. The count in the line above
them goes from four to three.

index.html is over 4 MB, so the change ships as a patch script. Every replacement asserts it matches
exactly once: if the page has drifted, this fails loudly rather than half-applying. Re-running it is a
no-op, and `--check` reports without writing.

  python3 dev/patch-8302.py           apply
  python3 dev/patch-8302.py --check   report only
"""
import io
import sys

PAGE = 'index.html'
VERSION = '83.0.2'
OLD = '83.0.1'
MARK = 'My Hub is off the list'

s = io.open(PAGE, encoding='utf-8').read()
CHECK = '--check' in sys.argv

if '{ version: \'%s\'' % VERSION in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    s = s.replace(old, new, 1)
    changes.append(label)
    print('ok  ' + label)


# ---- the version ---------------------------------------------------------------------------------
sub("  const APP_VERSION = '%s';" % OLD,
    "  const APP_VERSION = '%s';" % VERSION,
    'the page says which version it is')


# ---- My Hub's card goes --------------------------------------------------------------------------
CARD = '''      <div style="border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:rgba(255,255,255,0.03); margin-bottom:10px;">
        <div style="font-size:14px; font-weight:600;">My Hub</div>
        <div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">One screen that launches this family of apps.</div>
        <a href="https://github.com/AnekTheGreat/My-Hub" target="_blank" rel="noopener" style="display:inline-block; margin-top:8px; font-size:12px; font-weight:600; color:var(--coral); text-decoration:none;">Open its page &rarr;</a>
      </div>
'''

sub(CARD, '', 'the My Hub card')

sub('Four more, made the same way and free the same way.',
    'Three more, made the same way and free the same way.',
    'the line above them counts three')


# ---- the changelog -------------------------------------------------------------------------------
ENTRY = '''  { version: '%s', date: 'November 6, 2026 · 10:36 PM EST', title: 'My Hub is off the Other apps list', items: [
    'Other apps carries FamTM, UJournal and MeasureT now: the three whose link is a store page, where a tap can actually finish.',
    'My Hub is not on a store page, so a tap on it left the app for a repository that cannot install anything. It is gone rather than listed beside the others as if it could.',
    'Nothing else about the tab moved: same place last before More, same card, same line under each name.',
    'This one is in the page: it arrives the next time the app opens, with nothing to install.'
  ]},
''' % VERSION

sub('''  { version: '%s', date: 'November 6, 2026 · 10:20 PM EST', title: 'Other apps under the gear, the whole family in one place', items: [''' % OLD,
    ENTRY + '''  { version: '%s', date: 'November 6, 2026 · 10:20 PM EST', title: 'Other apps under the gear, the whole family in one place', items: [''' % OLD,
    'the changelog entry')


io.open(PAGE, 'w', encoding='utf-8').write(s)
print('wrote %s: %d bytes (%d changes)' % (PAGE, len(s), len(changes)))
