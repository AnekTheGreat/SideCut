#!/usr/bin/env python3
"""
Prove the Android version code Play is handed cannot repeat or go backwards.

Play refuses an upload whose versionCode it has already seen, so the only thing
that matters about this number is that no two builds ever share one. The two
schemes before this one both failed that test on the same app - a commit count
(511722 reused) and a hand-bumped pin (512000 reused) - so this drives
`.github/workflows/patch-version.py` in a throwaway tree, run by run, and reads
the number it actually wrote into the gradle file.

    python3 dev/version-code-check.py
"""
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile

REPO = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))
SCRIPT = os.path.join(REPO, '.github', 'workflows', 'patch-version.py')
PLAY_MAX = 2100000000

GRADLE = """apply plugin: 'com.android.application'

android {
    namespace "com.SideCut.myapp"
    compileSdk 36
    defaultConfig {
        applicationId "com.SideCut.myapp"
        minSdkVersion 24
        targetSdkVersion 36
        versionCode 1
        versionName "1.0"
    }
}
"""

PASSED = []


def check(label, ok, detail=''):
    if ok:
        PASSED.append(label)
        print('  ok   %s%s' % (label, (' - ' + detail) if detail else ''))
    else:
        print('  FAIL %s%s' % (label, (' - ' + detail) if detail else ''))
        globals()['FAILED'] = True


FAILED = False


def tree(version='5.0.55'):
    """A throwaway repository holding only what the script reads."""
    root = tempfile.mkdtemp(prefix='sc-version-code-')
    os.makedirs(os.path.join(root, '.github', 'workflows'))
    os.makedirs(os.path.join(root, 'android', 'app'))
    shutil.copy(SCRIPT, os.path.join(root, '.github', 'workflows', 'patch-version.py'))
    with open(os.path.join(root, 'package.json'), 'w') as f:
        json.dump({'name': 'sidecut', 'version': version}, f)
    with open(gradle(root), 'w') as f:
        f.write(GRADLE)
    return root


def gradle(root):
    return os.path.join(root, 'android', 'app', 'build.gradle')


def written(root, what):
    src = open(gradle(root)).read()
    m = re.search(r'\s*%s\s+("?)(\d+(?:\.\d+)*)\1' % what, src)
    return m.group(2) if m else None


def run(root, run_number=None, attempt=None, *args):
    env = {k: v for k, v in os.environ.items()
           if k not in ('GITHUB_RUN_NUMBER', 'GITHUB_RUN_ATTEMPT')}
    if run_number is not None:
        env['GITHUB_RUN_NUMBER'] = str(run_number)
    if attempt is not None:
        env['GITHUB_RUN_ATTEMPT'] = str(attempt)
    return subprocess.run(
        [sys.executable, os.path.join(root, '.github', 'workflows', 'patch-version.py')]
        + list(args), env=env, capture_output=True, text=True)


def main():
    # 1. THE FIRST BUILD AFTER THE CHANGE, AND THE ONE AFTER IT.
    root = tree()
    first = run(root, 567, 1)
    check('run 567 attempt 1 writes 512001', first.returncode == 0 and written(root, 'versionCode') == '512001',
          (first.stdout.strip() or first.stderr.strip()))
    check('the versionName comes from package.json', written(root, 'versionName') == '5.0.55',
          written(root, 'versionName') or 'nothing')
    second = run(root, 568, 1)
    check('the next run steps past it (512011)',
          second.returncode == 0 and written(root, 'versionCode') == '512011',
          written(root, 'versionCode') or second.stderr.strip())

    # 2. A RE-RUN OF THE SAME RUN IS NOT THE SAME NUMBER - the failure that
    #    killed the commit count (two builds of one commit).
    again = run(root, 567, 1)
    check('a second build of run 567 attempt 1 re-writes the same number',
          again.returncode == 0 and written(root, 'versionCode') == '512001')
    rerun = run(root, 567, 2)
    check('re-running it as attempt 2 gets its own number (512002)',
          rerun.returncode == 0 and written(root, 'versionCode') == '512002',
          written(root, 'versionCode') or rerun.stderr.strip())
    late = run(root, 567, 10)
    check('the tenth attempt of a run still fits in its block (512010)',
          late.returncode == 0 and written(root, 'versionCode') == '512010',
          written(root, 'versionCode') or late.stderr.strip())

    # 3. NOTHING IN A REAL SEQUENCE OF BUILDS COLLIDES OR GOES BACKWARDS.
    codes, seen, backwards = [], [], []
    for number in range(567, 596):
        for attempt in (1, 2):
            result = run(root, number, attempt)
            code = written(root, 'versionCode')
            if result.returncode != 0:
                backwards.append('run %d attempt %d failed: %s' % (number, attempt,
                                                                    result.stderr.strip()))
                continue
            if seen and int(code) <= max(seen):
                backwards.append('run %d attempt %d gave %s after %s'
                                 % (number, attempt, code, max(seen)))
            seen.append(int(code))
            codes.append(code)
    check('58 builds in sequence: every code is new and higher than the last',
          not backwards and len(set(codes)) == len(codes),
          '; '.join(backwards) or '%s .. %s' % (codes[0], codes[-1]))

    # 4. --print-code AGREES WITH WHAT THE BUILD WRITES. This is what the build's
    #    own verification step compares the bundle against.
    printed = run(root, 700, 1, '--print-code')
    check('--print-code prints the number the gradle file would get',
          printed.returncode == 0 and printed.stdout.strip().isdigit()
          and run(root, 700, 1).returncode == 0
          and printed.stdout.strip() == written(root, 'versionCode'),
          printed.stdout.strip() or printed.stderr.strip())
    check('a run far in the future is still inside Play\'s limit',
          int(printed.stdout.strip()) < PLAY_MAX, printed.stdout.strip())
    far = run(root, 250000, 1, '--print-code')
    check('even run 250000 is inside it', far.returncode == 0
          and int(far.stdout.strip()) < PLAY_MAX, far.stdout.strip() or far.stderr.strip())

    # 5. THE GUARD: A NUMBER PLAY HAS ALREADY TAKEN FAILS HERE, BEFORE THE BUILD.
    root = tree()
    spent = run(root, 566, 1)
    check('run 566 (the block that holds 512000) is refused',
          spent.returncode != 0 and '512000' in spent.stderr
          and written(root, 'versionCode') == '1',
          spent.stderr.strip().splitlines()[0] if spent.stderr.strip() else 'it built')
    over = run(root, 567, 11)
    check('an eleventh attempt is refused instead of colliding with the next run',
          over.returncode != 0 and 'attempt' in over.stderr.lower(),
          over.stderr.strip().splitlines()[0] if over.stderr.strip() else 'it built')
    loose = run(root)
    check('a build with no run number behind it is refused',
          loose.returncode != 0 and 'GITHUB_RUN_NUMBER' in loose.stderr
          and written(root, 'versionCode') == '1',
          loose.stderr.strip().splitlines()[0] if loose.stderr.strip() else 'it built')
    wrong = run(root, 'five', 1)
    check('a non-numeric run number is refused', wrong.returncode != 0
          and 'whole number' in wrong.stderr, wrong.stderr.strip().splitlines()[0]
          if wrong.stderr.strip() else 'it built')

    print('\n%s: %d passed, %d failed'
          % ('version-code-check', len(PASSED), 1 if FAILED else 0))
    return 1 if FAILED else 0


if __name__ == '__main__':
    sys.exit(main())
