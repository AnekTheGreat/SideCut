#!/usr/bin/env python3
"""83.2.4: the UNote card opens the notebook at its own repository page.

83.2.3 pointed the card at a temporary host. The app lives at its own repository
now, publishes the APK from there, and that is where the card should go. Nothing
else on the tab moves: same card, same wording, same Open. The version moves so an
installed copy actually takes this build.
"""
import io
import re
import sys

PAGE = 'index.html'
OLD = 'https://site-e28e804444934263a1f0838974d59f45.freebuff.page/'
NEW = 'https://anekthegreat.github.io/UNote/'
PREV = '83.2.3'
V = '83.2.4'

src = io.open(PAGE, encoding='utf-8').read()


def applied(s):
    return (OLD not in s) and ("const APP_VERSION = '%s';" % V) in s


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

src, caches = re.subn(r'sidecut-shell-v%s' % re.escape(PREV), 'sidecut-shell-v%s' % V, src)

if OLD in src:
    sys.exit('the old link is still somewhere on the page')
if "const APP_VERSION = '%s';" % V not in src:
    sys.exit('the version did not take')

io.open(PAGE, 'w', encoding='utf-8').write(src)
print('moved the UNote card to %s' % NEW)
print('APP_VERSION %s -> %s, %d cache name(s) moved' % (PREV, V, caches))
