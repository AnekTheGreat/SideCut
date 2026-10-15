#!/usr/bin/env python3
"""
The 74.1.5 release, stuck on ONE flaky suite.

The third run of this release failed its Gates step with

    ota-update-check: exit 1 (FAILURES: 49 passed, 3 failed)

and the same suite, re-run on its own minutes later with nothing changed, passed 52/0.
dev/release-7415-gates.sh now pushes dev/gates-report.txt on a red battery, and that
report is where this came from: every other suite was green (test-740 54 checks, test-741
86, crossfade 22/0, compress 24/0, refresh-pin 14/0, studio-70 397, ota-guard 20/0,
ota-bootapply 24/0), the one red was this suite, and its own re-run passed.

The cause is the fixed settle. The release battery runs ~50 suites back to back and this
one boots the whole 3.24 MB page; on a busy runner the page had not finished booting when
a fixed settle expired, so the three checks that read the page - the OTA client existing,
the boot check having fetched, the bundle having been staged - read it too early. The
suite was measuring the runner's speed, not the app.

Reproduced here, four copies at once on the same machine: 4/4 copies of the old suite
failed the boot block (the same checks CI lost), and 3/4 of the patched one passed, the
fourth failing only because concurrent copies rewrite ota/update.zip while another reads
it - an artifact of the reproduction, not of the app. Run one at a time, the patched suite
is 52/0.

So each wait now waits for the thing the check below it actually needs. No assertion is
weakened and nothing is skipped: if the page never defines its OTA client, or the boot
check never fetches, or the bundle is never staged, waitFor() times out and the same
checks fail exactly as before - they just no longer fail because the machine was busy.

  python3 dev/patch-ota-waits.py            # apply, from anywhere in the repo
  python3 dev/patch-ota-waits.py --check    # report only, exit 1 if behind
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
CHECK = '--check' in sys.argv
MARK = 'WAIT FOR THE PAGE, NOT FOR A CLOCK'
PATH = os.path.join(ROOT, 'dev', 'ota-update-check.cjs')

WAIT_OLD = "const wait = (ms) => new Promise((r) => setTimeout(r, ms));"

WAIT_NEW = """const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// WAIT FOR THE PAGE, NOT FOR A CLOCK. The release battery runs the suites back to back and
// this one boots the whole 3.24 MB page, so on a busy machine the page has not finished
// booting when a fixed settle expires. That is exactly how the 74.1.5 release failed its
// Gates step on CI with "ota-update-check: exit 1 (FAILURES: 49 passed, 3 failed)" and then
// passed 52/0 when the same suite was re-run on its own, with nothing changed: the three
// checks that read the page (the OTA client existing, the boot check having fetched, the
// bundle having been staged) were reading it too early. Polling for the thing each check
// actually needs removes the race instead of tuning a number that a slower runner wins.
async function waitFor(fn, ms = 60000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    try { if (fn()) return true; } catch (e) {}
    await wait(100);
  }
  return false;
}"""

BOOT_OLD = """  const win = dom.window;
  await wait(2000);"""

BOOT_NEW = """  const win = dom.window;
  await waitFor(() => win.__SideCutOTA && win.__SideCutOTA.IS_NATIVE === true);"""

FIRE_OLD = """  console.log('\\n\u2014 boot: the update installs itself, no tap \u2014');
  await wait(3300);"""

FIRE_NEW = """  console.log('\\n\u2014 boot: the update installs itself, no tap \u2014');
  // The page fires its own boot check ~2.5s after load. Waiting for that check to have
  // started (the download is held open below, so length 1 means "mid-flight") is what the
  // assertions under it are about - and it is the same state a fixed 3.3s was reaching for.
  await waitFor(() => calls.notifyAppReady >= 1 && calls.downloads.length === 1);"""

SET_OLD = """  releaseDownload();
  await wait(2500);"""

SET_NEW = """  releaseDownload();
  await waitFor(() => calls.set.length === 1);"""

EDITS = [
    ('the wait helper', WAIT_OLD, WAIT_NEW),
    ('the boot wait', BOOT_OLD, BOOT_NEW),
    ('the boot-check wait', FIRE_OLD, FIRE_NEW),
    ('the staged-bundle wait', SET_OLD, SET_NEW),
]

src = open(PATH, encoding='utf-8').read()

if MARK in src:
    print('  dev/ota-update-check.cjs already waits for the page')
    print('')
    print('patch-ota-waits: 0 file(s)' + (' (check only)' if CHECK else ''))
    sys.exit(0)

if CHECK:
    print('  PROBLEM dev/ota-update-check.cjs still waits on fixed settles')
    sys.exit(1)

problems = []
for label, old, new in EDITS:
    n = src.count(old)
    if n != 1:
        problems.append('%s: found %d copies of its anchor, expected 1' % (label, n))
        continue
    src = src.replace(old, new)
    print('  %s: done' % label)

if problems:
    for p in problems:
        print('  PROBLEM ' + p)
    sys.exit(1)

open(PATH, 'w', encoding='utf-8').write(src)
print('')
print('patch-ota-waits: 1 file(s)')
