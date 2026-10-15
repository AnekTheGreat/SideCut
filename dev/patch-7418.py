#!/usr/bin/env python3
"""
74.1.8 - the repair for a release that shipped a compressor that could not compress.

The owner's phone, on the release before this one:

    Re-encode failed: scBackSliceMul is not defined

WHY IT HAPPENED, in one paragraph, because the reason is the whole release. The page
is four inline <script> blocks and each one is its own program with its own scope.
74.1.7 added the hidden-slice multiplier (scBackSliceMul - the thing that makes a
background compress do three slices of work per wake-up) into the LAST of them, the
Studio module, beside the rest of the background job. The two encoders that read the
slice budget - scEncodeMp3Cooperative's block loop and scEncodeWavCooperative's sample
loop - live in the FIRST, the app's own 2.5 MB script. A bare identifier is resolved
lexically, in the scope of the function that uses it, never in the scope of whichever
block published a reference to it, so both encoders threw the moment they were called:
the slice test is `Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()`,
and `>=` evaluates both of its sides, so the multiplier is called on the FIRST block of
the loop. Every re-encode on every song at every rate failed instantly. Nothing was
damaged - the failure came before a single byte - but the button did nothing.

WHY NO GATE SAW IT, because that is the second half of this release. dev/
studio-70-check.cjs's [6f] drove the background job with `win.__scEncodeMp3` stubbed
out, so the real encoder never ran, and its question about the multiplier went through
`SC70.backSliceMul()` - the module's own copy, which was defined and answered
correctly. The gate asked the module about itself and the module passed. The new block
in dev/storeinfo-7418-block.js closes that three ways: a general reading of the whole
page ("no script block calls an sc-helper that only another block defines", which on
74.1.7 names this bug and nothing else in 3.2 MB), the Studio's multiplier probed for
liveness (a stub taken over by the app's own function, so a copy could not pass), and
one re-encode driven through the REAL encoder with only lamejs stood in for - the CDN
script jsdom never loads - which reproduces the phone's own error message in the gate.

THE PAGE EDIT ITSELF IS TINY: one function moves house, and the Studio's copy becomes
an alias onto the published one.

This is the same kind of release tool as dev/patch-7417.py: the page is ONE 3.2 MB
index.html and the machine that prepares a release cannot push a file that size, so a
page change ships by being EDITED inside the repository - by this script, which the
release workflow runs on the checked-out tree.

THE TEXT IT WRITES IS NOT IN THIS FILE. dev/patch-7418-page.py holds the edits,
dev/patch-7418-notes.py holds the version bump and the changelog entry. Both are
exec'd into this module's globals below, for the same reason: every byte travels by
hand, one API call per file, and a call big enough to be cut off is a release that
does not ship.

It is idempotent. Every edit checks for its own output first and skips when the page
already carries it, so re-running it changes nothing and pushes nothing.

  python3 dev/patch-7418.py            # apply (or report it is already applied)
  python3 dev/patch-7418.py --check    # report only, exit 1 if the page is behind
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
CHECK = '--check' in sys.argv

# The page text, into this module's globals: the two edits, and VERSION, the
# changelog anchor and entry.
for _text in ('patch-7418-page.py', 'patch-7418-notes.py'):
    with open(os.path.join(HERE, _text), encoding='utf-8') as _fh:
        exec(_fh.read(), globals())

changes = []
problems = []


def read(rel):
    with open(os.path.join(ROOT, rel), encoding='utf-8') as fh:
        return fh.read()


def write(rel, text):
    with open(os.path.join(ROOT, rel), 'w', encoding='utf-8') as fh:
        fh.write(text)


def edit(rel, old, new, label):
    """Replace one exact block, once. Already-applied counts as done, not an error."""
    src = read(rel)
    if new in src:
        print('  = %s (already applied)' % label)
        return
    n = src.count(old)
    if n != 1:
        problems.append('%s: anchor found %d times in %s' % (label, n, rel))
        print('  ! %s: anchor found %d times in %s' % (label, n, rel))
        return
    write(rel, src.replace(old, new, 1))
    changes.append(label)
    print('  + %s' % label)


def eastern_stamp():
    """Eastern time of this run as 'Month D, YYYY · H:MM PM EDT'.

    The build sandbox runs on UTC with no tzdata, so Eastern is computed as UTC minus
    four hours (EDT) rather than asked for - and the date rolls back with it, which is
    the bug the versioning note records. The stamp is this run's own time, so it is
    never in the future of the commit that carries it.
    """
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    hour = now.hour % 12 or 12
    ampm = 'AM' if now.hour < 12 else 'PM'
    return '%s %d, %d · %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, hour, now.minute, ampm)


print('74.1.8 patch - %s' % ROOT)
if CHECK:
    for rel, needle, label in (
        ('index.html', VERSION_NEW, 'APP_VERSION is %s' % VERSION),
        ('sw.js', SW_NEW, 'sw cache is v%s' % VERSION),
        ('index.html', "version: '%s'" % VERSION, 'changelog entry'),
        ('index.html', 'function scBackSliceMul(){ return document.hidden ? 3 : 1; }',
         'the multiplier is defined'),
        ('index.html', 'window.__scBackSliceMul = scBackSliceMul;', 'and published for the Studio'),
        ('index.html', MODULE_NEW, 'the Studio reads the published one'),
        ('index.html', DEF_NEW, 'both live in the encoder scope'),
    ):
        if needle not in read(rel):
            problems.append('%s: %s missing' % (label, rel))
            print('  ! %s missing in %s' % (label, rel))
        else:
            print('  ✓ %s' % label)
    # The fault itself, asked of the page: the script block that CALLS the multiplier
    # must be the block that DEFINES it. This is the release's own regression pinned and
    # nothing more - the general reading of the rule (no block may call an sc-helper
    # that only another block defines, which is what named this bug and nothing else in
    # 3.2 MB) lives in exactly one place, the [6g] gate block, so there is one copy of
    # it and no second implementation to drift out of step.
    import re as _re
    call, define = [], []
    for i, m in enumerate(_re.finditer(r'<script\b([^>]*)>([\s\S]*?)</script>', read('index.html'))):
        if 'src=' in m.group(1):
            continue
        body = m.group(2)
        if 'SC_ENCODE_SLICE_MS * scBackSliceMul()' in body:
            call.append(i)
        if 'function scBackSliceMul(' in body:
            define.append(i)
    if call and set(call) & set(define):
        print('  ✓ the block that calls the slice multiplier defines it too (block %s)' % call[0])
    else:
        label = 'the caller defines the multiplier'
        problems.append('%s: the encoders call it from block %s, it is defined in %s'
                        % (label, call or 'nowhere', define or 'nowhere'))
        print('  ! %s: called in %s, defined in %s' % (label, call or 'nowhere', define or 'nowhere'))
    print('CHECKS: %s' % ('FAILED' if problems else 'OK'))
    sys.exit(1 if problems else 0)

# 1. the fix itself: the multiplier moves to the encoders that call it, and the
# Studio's copy becomes an alias onto the published one.
edit('index.html', DEF_OLD, DEF_NEW, 'the slice multiplier is defined beside the encoders that call it')
edit('index.html', MODULE_OLD, MODULE_NEW, 'and the Studio reads the published one instead of its own copy')
# 2. the release itself
edit('index.html', VERSION_OLD, VERSION_NEW, 'APP_VERSION -> %s' % VERSION)
edit('sw.js', SW_OLD, SW_NEW, 'sw cache -> v%s' % VERSION)
edit('index.html', CHANGELOG_ANCHOR, CHANGELOG_ANCHOR + CHANGELOG_ENTRY % eastern_stamp(), 'changelog entry')

if problems:
    print('\nFATAL: %d anchor(s) could not be applied - the page has moved on:' % len(problems))
    for p in problems:
        print('  - %s' % p)
    sys.exit(1)

if not changes:
    print('\nThe page already carries %s - nothing written.' % VERSION)
else:
    print('\nApplied %d edit(s) for %s.' % (len(changes), VERSION))
