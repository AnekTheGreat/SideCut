#!/usr/bin/env python3
"""
Bump the Android app version for release builds.

The android/ project is regenerated from the Capacitor template on every CI
build, and the template hardcodes versionCode 1 / versionName "1.0". Play
Console rejects any upload whose versionCode is not HIGHER than the previous
one, so every build would collide with the first published version.

This script reads the version from package.json ("52.5.0") and rewrites
android/app/build.gradle to use a monotonically increasing versionCode:

    versionCode = major * 100000 + minor * 1000 + patch
    versionName = "major.minor.patch"

Bump the version field in package.json for each new release — the build
automatically produces a higher versionCode.
"""
import json, os, re, sys

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
version_code = (major * 1000 + minor) * 100000 + patch * 1000 + build

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
print('set versionCode=%d versionName="%s"' % (version_code, ver_name))
