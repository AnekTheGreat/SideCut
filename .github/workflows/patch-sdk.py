#!/usr/bin/env python3
"""
Bump the Android compile/target SDK for release builds.

The android/ project is regenerated from the Capacitor template on every CI
build, and the template pins compileSdkVersion/targetSdkVersion to 34. Google
Play now REQUIRES apps to target API 35 (an upload error, not just a warning),
so we patch android/variables.gradle to 35 before Gradle builds.
"""
import os, re, sys

VARIABLES = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..', 'android', 'variables.gradle'))
TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 35

if not os.path.exists(VARIABLES):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % VARIABLES)

src = open(VARIABLES).read()
new_src, n1 = re.subn(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = %d' % TARGET, src)
new_src, n2 = re.subn(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = %d' % TARGET, new_src)
if n1 == 0 or n2 == 0:
    sys.exit('FATAL: could not find compileSdkVersion/targetSdkVersion in %s' % VARIABLES)
open(VARIABLES, 'w').write(new_src)
print('set compileSdkVersion=%d targetSdkVersion=%d in %s' % (TARGET, TARGET, VARIABLES))