#!/usr/bin/env python3
"""
Bump the Android compile/target SDK for release builds.

The android/ project is regenerated from the Capacitor template on every CI
build, and the Capacitor 6 template pins compileSdkVersion/targetSdkVersion
to 34. Google Play now REQUIRES apps to target API 36 (an upload error, not
just a warning), so we patch android/variables.gradle to 36 before Gradle
builds.

Compiling against API 36 also needs the Android Gradle Plugin 8.9.1+
(Capacitor 6 template ships 8.2.1), and AGP 8.9.x needs Gradle 8.11.1+
(template ships 8.2.1) — so we bump those in the same pass.
"""
import os, re, sys

ANDROID = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'android'))
VARIABLES = os.path.join(ANDROID, 'variables.gradle')
BUILD_GRADLE = os.path.join(ANDROID, 'build.gradle')
WRAPPER = os.path.join(ANDROID, 'gradle', 'wrapper', 'gradle-wrapper.properties')

TARGET = int(sys.argv[1]) if len(sys.argv) > 1 else 36
AGP_VERSION = '8.9.1'   # earliest AGP that supports compileSdk 36
GRADLE_VERSION = '8.11.1'  # minimum Gradle for AGP 8.9.x

if not os.path.exists(VARIABLES):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % VARIABLES)

# ---- 1) compile/target SDK in variables.gradle ----
src = open(VARIABLES).read()
new_src, n1 = re.subn(r'compileSdkVersion\s*=\s*\d+', 'compileSdkVersion = %d' % TARGET, src)
new_src, n2 = re.subn(r'targetSdkVersion\s*=\s*\d+', 'targetSdkVersion = %d' % TARGET, new_src)
if n1 == 0 or n2 == 0:
    sys.exit('FATAL: could not find compileSdkVersion/targetSdkVersion in %s' % VARIABLES)
open(VARIABLES, 'w').write(new_src)
print('set compileSdkVersion=%d targetSdkVersion=%d in %s' % (TARGET, TARGET, VARIABLES))

# ---- 2) Android Gradle Plugin version in android/build.gradle ----
# Handles both the buildscript-classpath style and the plugins-DSL style the
# Capacitor template could use.
if not os.path.exists(BUILD_GRADLE):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % BUILD_GRADLE)
src = open(BUILD_GRADLE).read()
new_src, n3 = re.subn(
    r'(com\.android\.tools\.build:gradle:)\d+\.\d+(?:\.\d+)?',
    r'\g<1>%s' % AGP_VERSION, src)
new_src, n4 = re.subn(
    r'(id\s+([\'"])com\.android\.application\2\s+version\s+\2)\d+\.\d+(?:\.\d+)?\2',
    r'\g<1>%s\g<2>' % AGP_VERSION, new_src)
if n3 == 0 and n4 == 0:
    sys.exit('FATAL: could not find the Android Gradle Plugin version in %s' % BUILD_GRADLE)
open(BUILD_GRADLE, 'w').write(new_src)
print('set AGP=%s in %s (%d replacement(s))' % (AGP_VERSION, BUILD_GRADLE, n3 + n4))

# ---- 3) Gradle wrapper version (AGP 8.9.x needs Gradle 8.11.1+) ----
if not os.path.exists(WRAPPER):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % WRAPPER)
src = open(WRAPPER).read()
new_src, n5 = re.subn(
    r'(distributionUrl=.*gradle-)(\d+(?:\.\d+)+)(-[a-z]+\.zip)',
    r'\g<1>%s\g<3>' % GRADLE_VERSION, src)
if n5 == 0:
    sys.exit('FATAL: could not find distributionUrl in %s\n--- file content ---\n%s' % (WRAPPER, src))
open(WRAPPER, 'w').write(new_src)
print('set Gradle wrapper=%s in %s' % (GRADLE_VERSION, WRAPPER))
