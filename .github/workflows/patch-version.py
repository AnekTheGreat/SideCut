#!/usr/bin/env python3
"""
Bump the Android app version for release builds.

The android/ project is regenerated from the Capacitor template on every CI
build, and the template hardcodes versionCode 1 / versionName "1.0". Play
Console rejects any upload whose versionCode is not HIGHER than the previous
one, so every build would collide with the first published version.

versionCode is a plain sequential counter, NOT derived from the version
string:

    versionCode = max(500040, 500000 + commits on main)

Why: Play's real releases 5.0.31-5.0.39 used codes in the 500031-500039
family (the old major*100000 + minor*1000 + patch scheme). A packed formula
that encodes the new 4-part version (5.0.40 -> 5,000,040) jumps roughly
five million above the previous code, which makes Play Console warn "This
release's version code is significantly higher than your previous version
code" (Play warns when the jump is about 1000+, because it burns the
2-billion code space). A sequential counter that steps just past 500039 by a
few hundred keeps every release within a few hundred of the last and never
trips the warning. The real version still rides along as versionName, so the
Play listing and the app UI keep showing "5.0.40".

The commit count comes from the full git history (the checkout step fetches
with fetch-depth: 0), so it is strictly increasing across pushes. The floor
keeps the code above every previously used code even if the count were ever
tiny.
"""
import json, os, re, subprocess, sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
BUILD_GRADLE = os.path.join(ROOT, 'android', 'app', 'build.gradle')
PACKAGE_JSON = os.path.join(ROOT, 'package.json')

if not os.path.exists(BUILD_GRADLE):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % BUILD_GRADLE)

with open(PACKAGE_JSON) as f:
    version = json.load(f)['version']
m = re.match(r'^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?$', version.strip())
if not m:
    sys.exit('FATAL: cannot parse version %r from package.json' % version)
major, minor, patch, build = (int(x) if x else 0 for x in (m.group(1), m.group(2), m.group(3), m.group(4)))

# Sequential counter: strictly increasing with every push, and numerically
# adjacent to the 500031-500039 family Play already has, so no huge jump.
commit_count = int(subprocess.check_output(['git', 'rev-list', '--count', 'HEAD']).decode().strip())
version_code = max(500040, 500000 + commit_count)

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
print('set versionCode=%d versionName="%s" (commit count: %d)' % (version_code, ver_name, commit_count))
