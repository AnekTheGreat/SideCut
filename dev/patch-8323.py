#!/usr/bin/env python3
"""83.2.3 - UNote, in the same list as the others.

One more card under Other apps: UNote, the notebook with links and a vault behind a PIN.
It is a page rather than a store listing, so the card says Open rather than Get, and the
line under the list already explains that a link opens in the phone's own browser.

Re-running is a no-op, and --check reports without writing.
"""
import io
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83.2.3'
OLD = '83.2.2'
CHECK = '--check' in sys.argv

s = io.open(PAGE, encoding='utf-8').read()
sw = io.open(SW, encoding='utf-8').read()

if ("const APP_VERSION = '%s';" % VERSION) in s:
    print('%s is already on the page - nothing to do' % VERSION)
    sys.exit(0)

if CHECK:
    print('%s is NOT on the page - it needs applying' % VERSION)
    sys.exit(1)

changes = []


def sub(text, old, new, label):
    n = text.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    changes.append(label)
    print('ok  ' + label)
    return text.replace(old, new, 1)


CARD = '''      <div style="border:1px solid var(--line); border-radius:12px; padding:14px 16px; background:rgba(255,255,255,0.03); margin-bottom:10px;">
        <div style="font-size:14px; font-weight:600;">UNote</div>
        <div style="font-size:12px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">Notes that link themselves, with a Vault behind a PIN you choose: everything in one place.</div>
        <a href="https://site-e28e804444934263a1f0838974d59f45.freebuff.page/" target="_blank" rel="noopener" style="display:inline-block; margin-top:8px; font-size:12px; font-weight:600; color:var(--coral); text-decoration:none;">Open it &rarr;</a>
      </div>
'''

FOOT = '      <div style="font-size:11px; color:var(--ink-dim); line-height:1.5; margin-top:4px;">A link opens in the phone'
s = sub(s, FOOT, CARD + FOOT, 'the UNote card, above the line that explains the links')
s = sub(s, 'Three more, made the same way and free the same way.',
        'Four more, made the same way and free the same way.', 'the list says four')
s = sub(s, "const APP_VERSION = '%s';" % OLD, "const APP_VERSION = '%s';" % VERSION,
        'the page says which version it is')

OLD_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % OLD
NEW_CACHE = "const CACHE_NAME = 'sidecut-shell-v%s';" % VERSION
if sw.count(OLD_CACHE) != 1:
    sys.exit('sw.js: the cache name is not where it was')
sw = sw.replace(OLD_CACHE, NEW_CACHE, 1)
print('ok  the service worker cache moves to %s' % VERSION)

ENTRY = """  { version: '83.2.3', date: 'November 7, 2026 \u00b7 6:20 PM EST', title: 'UNote is on the list', items: [
    'Other apps has a fourth card: UNote, a notebook where [[links]] connect the notes and a Vault sits behind a PIN you choose on first launch.',
    'Its card says Open rather than Get because it is a page, not a store listing - it opens in the phone\u2019s own browser and can be added to the home screen from there.',
    'Nothing else about the tab moved: same place last before More, same card shape, same line under each name.',
    'This one is in the page: it arrives the next time the app opens, with nothing to install.'
  ]},
"""

ANCHOR = "  { version: '%s', date:" % OLD
s = sub(s, ANCHOR, ENTRY + ANCHOR, 'the changelog entry')

io.open(PAGE, 'w', encoding='utf-8').write(s)
io.open(SW, 'w', encoding='utf-8').write(sw)
print('wrote %s: %d bytes (%d changes) and %s' % (PAGE, len(s), len(changes), SW))
