#!/usr/bin/env python3
"""
Set the Android app version for release builds.

The android/ project is regenerated from the Capacitor template on every CI
build, and the template hardcodes versionCode 1 / versionName "1.0". Play
Console rejects any upload whose versionCode it has seen before, so the real
numbers have to be written in on every build.

THE CODE IS THE BUILD'S, AND A BUILD IS A RUN OF THIS WORKFLOW:

    versionCode = 512001 + 10 * (run - 567) + (attempt - 1)

out of GITHUB_RUN_NUMBER / GITHUB_RUN_ATTEMPT, which GitHub sets on every run
and every re-run. There is no number to bump anywhere, because bumping by hand
is what has now gone wrong twice:

  * `versionCode = max(510040, 510000 + commits on main)` - a commit count. Two
    builds of one commit share a number (a re-run, or a dispatch next to the
    push build) and a rewritten history steps over codes Play already owns.
    5.0.54 went up as 511722: "Version code 511722 has already been used."
  * `androidVersionCode: 512000` in package.json, bumped by hand - the same
    failure one layer up, because it only moves when somebody remembers and the
    app is built more than once per "version": it ships over the air between
    Play uploads, so the 5.0.55 bundle uploaded on 25 October and the one
    rebuilt after 80.3 / 80.3.1 both carried 512000. Play: "Version code 512000
    has already been used. Try another version code."

A run number cannot repeat and never goes backwards: GitHub spends one for every
run of this workflow, including runs that failed and failed steps, and a re-run
keeps the run number and only changes the attempt. Ten numbers are reserved per
run so up to ten attempts get their own, and the stride from one run to the next
is those ten, so the sequence is monotone by construction:

    run 567 attempt 1 -> 512001      run 568 attempt 1 -> 512011
    run 567 attempt 2 -> 512002      run 568 attempt 2 -> 512012

PLAY_CODES_SPENT is the highest code Play is known to have taken. The script
refuses to build at or below it, so a wrong constant fails here, in the build
log, instead of in the console after an upload has already spent it.

versionName still comes from package.json's `version`, so the Play listing and
the app UI show the version people talk about ("5.0.55") while the code steps on
its own.

  python3 .github/workflows/patch-version.py               # write it into gradle
  python3 .github/workflows/patch-version.py --print-code  # just say the number

Needs android/ to exist ("npx cap add android" first) - except --print-code,
which is what the build's own verification step calls after the bundle is made.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD_GRADLE = os.path.join(ROOT, 'android', 'app', 'build.gradle')
PACKAGE_JSON = os.path.join(ROOT, 'package.json')

# The highest code Play has taken (5.0.55's first bundle, 25 October 2026), and
# the last android-build run before the code started coming from the run itself.
PLAY_CODES_SPENT = 512000
FIRST_RUN = 567
CODES_PER_RUN = 10
FIRST_FREE_CODE = PLAY_CODES_SPENT + 1


def whole_number(name):
    raw = os.environ.get(name, '')
    if not raw.strip():
        return None
    try:
        return int(raw.strip())
    except ValueError:
        sys.exit('FATAL: %s=%r is not a whole number' % (name, raw))


def read_version():
    try:
        with open(PACKAGE_JSON) as f:
            return json.load(f)['version'].strip()
    except (OSError, ValueError, KeyError) as exc:
        sys.exit('FATAL: cannot read version from %s (%s)' % (PACKAGE_JSON, exc))


def version_name(version):
    m = re.match(r'^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$', version)
    if not m:
        sys.exit('FATAL: cannot parse version %r from package.json' % version)
    major, minor, patch = (int(m.group(i)) for i in (1, 2, 3))
    build = int(m.group(4) or 0)
    return '%d.%d.%d' % (major, minor, patch) if build == 0 \
        else '%d.%d.%d.%d' % (major, minor, patch, build)


def version_code():
    """The code this build gets: a function of the run, never of a file."""
    run = whole_number('GITHUB_RUN_NUMBER')
    attempt = whole_number('GITHUB_RUN_ATTEMPT') or 1
    if run is None:
        sys.exit('FATAL: no GITHUB_RUN_NUMBER. The version code is the run of the '
                 'android-build workflow that makes the bundle - Play never accepts a '
                 'code twice, so a build with no run behind it would rebuild an old '
                 'number. To make a bundle by hand, set GITHUB_RUN_NUMBER and '
                 'GITHUB_RUN_ATTEMPT to the run it stands in for.')
    if attempt < 1 or attempt > CODES_PER_RUN:
        sys.exit('FATAL: run %d attempt %d - attempts 1..%d have codes reserved. '
                 'Re-dispatch the workflow (a new run gets a new block) instead of '
                 're-running this one again.' % (run, attempt, CODES_PER_RUN))
    code = FIRST_FREE_CODE + CODES_PER_RUN * (run - FIRST_RUN) + (attempt - 1)
    if code <= PLAY_CODES_SPENT:
        sys.exit('FATAL: run %d attempt %d works out to versionCode %d, which is not '
                 'above %d, the highest code Play has taken. Run numbers do not go '
                 'backwards, so this means FIRST_RUN below is wrong. Nothing was '
                 'written.' % (run, attempt, code, PLAY_CODES_SPENT))
    return code, run, attempt


def main():
    code, run, attempt = version_code()
    if '--print-code' in sys.argv:
        print(code)
        return 0
    name = version_name(read_version())
    if not os.path.exists(BUILD_GRADLE):
        sys.exit('FATAL: %s missing - run `npx cap add android` first.' % BUILD_GRADLE)
    src = open(BUILD_GRADLE).read()
    new_src, subs = re.subn(
        r'(\s*versionCode\s+)\d+', r'\g<1>%d' % code, src, count=1)
    new_src, subs_name = re.subn(
        r'(\s*versionName\s+)"[^"]*"', lambda m: m.group(1) + '"' + name + '"',
        new_src, count=1)
    if subs == 0 or subs_name == 0:
        sys.exit('FATAL: could not find versionCode/versionName in %s' % BUILD_GRADLE)
    open(BUILD_GRADLE, 'w').write(new_src)
    print('set versionCode=%d versionName="%s" (run %d attempt %d; Play has taken up '
          'to %d)' % (code, name, run, attempt, PLAY_CODES_SPENT))
    return 0


if __name__ == '__main__':
    sys.exit(main())
