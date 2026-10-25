#!/usr/bin/env python3
"""
Set the Android app version for release builds.

The android/ project is regenerated from the Capacitor template on every CI
build, and the template hardcodes versionCode 1 / versionName "1.0". Play
Console rejects any upload whose versionCode it has seen before, so the real
numbers have to be written in on every build.

Where the versionCode comes from: package.json's `androidVersionCode`, an
explicit integer that is bumped by hand in the same commit as `version`.

It used to be a counter derived from the commit count:

    versionCode = max(510040, 510000 + commits on main)

That is exactly the shape that failed. Two builds of the same commit get the
same code (a re-run, a workflow_dispatch next to the push build), and any
history rewrite moves the count backwards or forwards over codes that were
already handed to Play. It ended with 5.0.54 built as versionCode 511722 and
Play answering "Version code 511722 has already been used. Try another version
code." — the count had landed on a number an earlier bundle already owned.

So the number is now state, not arithmetic:

  * bump `androidVersionCode` in package.json by hand for every build that is
    uploaded, whether Play accepted it or not (a rejected upload still spends
    the code);
  * keep it within a few hundred of the previous one, because Play warns when
    the jump is around 1000+ (it burns the 2-billion code space);
  * PLAY_CODES_SPENT below is the highest code Play is known to have taken. The
    script refuses to build at or below it, so a lost bump, a bad merge or a
    history rewrite can no longer quietly rebuild an upload Play will reject.

versionName still comes from package.json's `version`, so the Play listing and
the app UI show the version people talk about ("5.0.55") while the code is
free to step independently.
"""
import json, os, re, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD_GRADLE = os.path.join(ROOT, 'android', 'app', 'build.gradle')
PACKAGE_JSON = os.path.join(ROOT, 'package.json')

# Highest versionCode Play has already been handed (511722, the 5.0.54 bundle
# it answered "already been used" to). Codes at or below this are spent.
PLAY_CODES_SPENT = 511722

if not os.path.exists(BUILD_GRADLE):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % BUILD_GRADLE)

with open(PACKAGE_JSON) as f:
    pkg = json.load(f)

version = pkg['version']
m = re.match(r'^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$', version.strip())
if not m:
    sys.exit('FATAL: cannot parse version %r from package.json' % version)
major, minor, patch, build = (int(x) if x else 0 for x in (m.group(1), m.group(2), m.group(3), m.group(4)))

if 'androidVersionCode' not in pkg:
    sys.exit('FATAL: package.json has no androidVersionCode. Add one (an integer '
             'above %d, a step past the last build) next to "version".' % PLAY_CODES_SPENT)
version_code = pkg['androidVersionCode']
if not isinstance(version_code, int) or isinstance(version_code, bool):
    sys.exit('FATAL: androidVersionCode must be a plain integer, got %r' % (version_code,))
if version_code <= PLAY_CODES_SPENT:
    sys.exit('FATAL: androidVersionCode %d is not above %d, which Play has already used — '
             'bump it in package.json (and keep the jump to a few hundred, not thousands).'
             % (version_code, PLAY_CODES_SPENT))

src = open(BUILD_GRADLE).read()
new_src, subs = re.subn(
    r'(\s*versionCode\s+)\d+', r'\g<1>%d' % version_code, src, count=1)
ver_name = "%d.%d.%d" % (major, minor, patch) if build == 0 else "%d.%d.%d.%d" % (major, minor, patch, build)
new_src, subs_name = re.subn(
    r'(\s*versionName\s+)"[^"]*"', lambda m: m.group(1) + '"' + ver_name + '"',
    new_src, count=1)
if subs == 0 or subs_name == 0:
    sys.exit('FATAL: could not find versionCode/versionName in %s' % BUILD_GRADLE)
open(BUILD_GRADLE, 'w').write(new_src)
print('set versionCode=%d versionName="%s" (pinned in package.json; Play has used up to %d)'
      % (version_code, ver_name, PLAY_CODES_SPENT))
