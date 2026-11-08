#!/usr/bin/env python3
"""83.2.4: the UNote card opens the notebook at its own repository page.

83.2.3 pointed the card at a temporary host. The app lives at its own repository
now, publishes the APK from there, and that is where the card should go. Nothing
else on the tab moves: same card, same wording, same Open.

The changelog entry is written out in full, in the same shape as the entries above
it, so the release step that reads a title out of the changelog finds one.
"""
import io
import sys

PAGE = 'index.html'
OLD = 'https://site-e28e804444934263a1f0838974d59f45.freebuff.page/'
NEW = 'https://anekthegreat.github.io/UNote/'
PREV = '83.2.3'
V = '83.2.4'
TITLE = 'UNote moved to its own place'
DATE = 'November 8, 2026 · 1:30 AM UTC'

ENTRY = (
    "  { version: '83.2.4', date: '" + DATE + "', title: '" + TITLE + "', items: [\n"
    "    'The UNote card in Other apps opens the notebook at its own repository now, not the host it was first tried on.',\n"
    "    'The APK is published with every build, and the page is bundled inside it, so the app opens with no signal.'\n"
    "  ]},\n"
)

src = io.open(PAGE, encoding='utf-8').read()


def applied(s):
    return (OLD not in s) and ("const APP_VERSION = '%s';" % V) in s and ("version: '%s'" % V) in s


if applied(src):
    print('%s is already on the page - nothing to do' % V)
    sys.exit(0)
if '--check' in sys.argv:
    print('%s is not on the page yet' % V)
    sys.exit(1)

# 1. the card's link
if src.count(OLD) != 1:
    sys.exit('the UNote link is not where it was (%d matches)' % src.count(OLD))
src = src.replace(OLD, NEW, 1)

# 2. the version the shell carries, so an installed copy takes this build
before = src
src = src.replace("const APP_VERSION = '%s';" % PREV, "const APP_VERSION = '%s';" % V)
if src == before:
    sys.exit('APP_VERSION is not %s, so the page is not what this payload expects' % PREV)

# 3. the changelog entry, above the newest one
marker = "  { version: '%s', date: '" % PREV
if src.count(marker) != 1:
    sys.exit('the %s changelog entry is not there (%d matches)' % (PREV, src.count(marker)))
src = src.replace(marker, ENTRY + marker, 1)

# 4. nothing of the old link, one new entry, the version taken
if OLD in src:
    sys.exit('the old link is still somewhere on the page')
if src.count("version: '%s'" % V) != 1:
    sys.exit('the changelog entry did not land exactly once')
if "const APP_VERSION = '%s';" % V not in src:
    sys.exit('the version did not take')

io.open(PAGE, 'w', encoding='utf-8').write(src)
print('moved the UNote card to %s' % NEW)
print('APP_VERSION %s -> %s' % (PREV, V))
print('added the %s changelog entry: %s' % (V, TITLE))
