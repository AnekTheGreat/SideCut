#!/usr/bin/env python3
"""
patch-dualinstall.py - run AFTER `npx cap add android`, on the FULL flavor only.

WHY THIS EXISTS
---------------
Both flavors were built with the same applicationId ("com.SideCut.myapp"), so
Android treated them as ONE app: the Play build and the sideloaded full build
could never be installed at the same time. Whichever was installed last won, and
because both are signed with the same upload key the install did not even
complain -- it just replaced the other one, taking its local library with it.

Android identifies an installed app by its applicationId. Two of them can only
coexist if their applicationIds differ, so this gives the SIDELOADED build its
own (".full") and leaves the Play build exactly as it was.

Why the sideloaded one and not the Play one: the Play listing is bound to
"com.SideCut.myapp". Changing THAT would publish a brand new app and every
existing Play user would stop receiving updates. The full build is sideloaded
only, so moving it costs one reinstall and nothing else.

The app NAME is changed too ("SideCut Full"), because two identical icons
labelled "SideCut" in the launcher are worse than not being able to install
both -- and the widget label with it.

WHY NOTHING ELSE HAS TO CHANGE
------------------------------
In modern AGP the Java `namespace` (which decides the R class, the generated
package and the source directory) is SEPARATE from `applicationId` (the
installed identity). Only applicationId is touched here, so:

  * android/app/src/main/java/com/SideCut/myapp/... keeps its path,
  * the widget and audio-focus plugins keep their `package com.SideCut.myapp;`,
  * the "com.SideCut.myapp.WIDGET_*" intent actions stay consistent,

and nothing that patch-widget.py, patch-audiofocus.py or patch-mediaplugin.py
writes has to move. A different signing key is NOT needed either -- Android
compares signatures per applicationId, not across them.

Idempotent: a rerun changes nothing.
"""
import json
import os
import re
import sys

BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CONFIG = os.path.join(BASE, 'capacitor.config.json')
GRADLE = os.path.join(BASE, 'android', 'app', 'build.gradle')
STRINGS = os.path.join(BASE, 'android', 'app', 'src', 'main', 'res', 'values', 'strings.xml')

with open(CONFIG) as f:
    APP_ID = json.load(f).get('appId', 'com.SideCut.myapp')
FULL_ID = APP_ID + '.full'
FULL_NAME = 'SideCut Full'

if not os.path.exists(GRADLE):
    sys.exit('FATAL: %s missing - run `npx cap add android` first.' % GRADLE)

changed = []


def read(path):
    with open(path) as f:
        return f.read()


def write(path, content):
    with open(path, 'w') as f:
        f.write(content)


def patch_gradle():
    src = read(GRADLE)
    if 'applicationId "%s"' % FULL_ID in src:
        return
    # "applicationId \"com.SideCut.myapp\"" -> "...full". Both spacings Capacitor
    # has used over time are accepted, and the change is anchored on the exact
    # current id so it can never match the namespace line.
    pattern = re.compile(r'applicationId\s+["\']' + re.escape(APP_ID) + r'["\']')
    new, n = pattern.subn('applicationId "%s"' % FULL_ID, src, count=1)
    if n != 1:
        sys.exit('FATAL: could not find applicationId "%s" in build.gradle' % APP_ID)
    write(GRADLE, new)
    changed.append('build.gradle applicationId -> %s' % FULL_ID)


def patch_strings():
    if not os.path.exists(STRINGS):
        return
    src = read(STRINGS)
    before = src
    # capacitor generates app_name / title_activity_main / package_name and
    # custom_url_scheme. Only the two the launcher and the task title read are
    # renamed; custom_url_scheme is left as it is so deep links keep working
    # for whichever build is installed.
    for key in ('app_name', 'title_activity_main'):
        src = re.sub(
            r'(<string name="%s">)[^<]*(</string>)' % key,
            lambda m: m.group(1) + FULL_NAME + m.group(2),
            src,
        )
    if src != before:
        write(STRINGS, src)
        changed.append('strings.xml app label -> %s' % FULL_NAME)


patch_gradle()
patch_strings()

if changed:
    for c in changed:
        print('+ ' + c)
    print('patch-dualinstall: this build installs as %s ("%s"), so it can sit '
          'beside the Play build (%s) instead of replacing it.' % (FULL_ID, FULL_NAME, APP_ID))
else:
    print('= patch-dualinstall: already applied (%s)' % FULL_ID)
