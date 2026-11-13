#!/usr/bin/env python3
"""
Give the hold the foreground-service type a player should hold.

WHY. SideCut takes a "hold" for as long as a song plays (index.html: scHoldWant('deck') ->
SideCutJob.hold), and .github/workflows/patch-joblock.py answers it with a PARTIAL_WAKE_LOCK plus a
foreground service carrying the song in its notification. That service is declared dataSync - the
type Android gives work that only has to finish. From Android 15 that is a job the system is allowed
to end: it is capped at six hours a day, and it is among the first things an OEM battery manager stops
when the screen goes off. A song was living on it, so the song died with it whenever the phone was
locked or the app was left - which is what the owner reports as "it just stops sometimes".

For a player the right type is mediaPlayback, and startForeground has to ask for it as well as the
manifest declaring it. Android 14 refuses mediaPlayback from an app with no active MediaSession, and
a phone can refuse the service outright, so the Java falls back to dataSync: this can only ever be
the same or better than it was.

WHY IT LIVES IN dev/. The service is written by .github/workflows/patch-joblock.py, and nothing under
.github/workflows/ can be reached by a release commit - GitHub refuses an Actions token there, which
is the same reason dev/widget-sizes.py, dev/ghost-host.py, dev/ghost-route.py and dev/native-play.py
exist. So this runs AFTER patch-joblock.py and edits what it wrote. patch-sdk.py calls it, because
that is the first step in android-build.yml that runs after the hold is generated.

Idempotent: a second run prints "already applied" and changes nothing.
"""
import os
import re
import sys

ANDROID = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'android'))
PKG = os.path.join(ANDROID, 'app', 'src', 'main', 'java', 'com', 'SideCut', 'myapp')
SERVICE = os.path.join(PKG, 'SideCutJobService.java')
MANIFEST = os.path.join(ANDROID, 'app', 'src', 'main', 'AndroidManifest.xml')

PERMISSION = 'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK'

OLD_START = (
    "            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {\n"
    "                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);\n"
    "            } else {\n"
    "                startForeground(NOTIFICATION_ID, n);\n"
    "            }\n"
    "            running = true;\n"
)

NEW_START = (
    "            /* A SONG IS NOT A DOWNLOAD. This service was written for a conversion and is\n"
    "               declared dataSync, which is right for work that only has to finish. From Android\n"
    "               15 that is a job the system may end - capped at six hours a day, among the first\n"
    "               things an OEM battery manager stops when the screen goes off - so a song was\n"
    "               living on the wrong kind of service and dying with it. mediaPlayback is what a\n"
    "               player holds; the older type stays as the fallback, because Android 14 refuses\n"
    "               the media type without an active MediaSession and a phone can refuse the\n"
    "               service outright. */\n"
    "            boolean up = false;\n"
    "            if (Build.VERSION.SDK_INT >= 34) {\n"
    "                try {\n"
    "                    startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);\n"
    "                    up = true;\n"
    "                } catch (Throwable notMedia) {\n"
    "                    up = false;\n"
    "                }\n"
    "            }\n"
    "            if (!up) {\n"
    "                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {\n"
    "                    startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);\n"
    "                } else {\n"
    "                    startForeground(NOTIFICATION_ID, n);\n"
    "                }\n"
    "            }\n"
    "            running = true;\n"
)

for p in (SERVICE, MANIFEST):
    if not os.path.exists(p):
        sys.exit('FATAL: %s missing - run patch-joblock.py first.' % p)

changed = []

# ---- 1) the service asks for the media type first ----
src = open(SERVICE).read()
if 'FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK' in src:
    print('already applied: the service asks for mediaPlayback')
else:
    if OLD_START not in src:
        sys.exit('FATAL: the startForeground block is not in %s' % SERVICE)
    open(SERVICE, 'w').write(src.replace(OLD_START, NEW_START, 1))
    changed.append('SideCutJobService.java: startForeground asks for mediaPlayback first')

# ---- 2) both types declared, so either request is legal ----
src = open(MANIFEST).read()
tag_old = 'android:foregroundServiceType="dataSync"'
tag_new = 'android:foregroundServiceType="mediaPlayback|dataSync"'
if tag_new in src:
    print('already applied: both service types are declared')
else:
    if tag_old not in src:
        sys.exit('FATAL: the SideCutJobService declaration is not in %s' % MANIFEST)
    src = src.replace(tag_old, tag_new, 1)
    changed.append('AndroidManifest.xml: the hold declares mediaPlayback|dataSync')

# ---- 3) the permission the media type needs ----
decl = 'android:name="%s"' % PERMISSION
if decl in src:
    print('already present: %s' % PERMISSION)
else:
    head = src.index('</manifest>')
    src = src[:head] + '    <uses-permission %s />\n' % decl + src[head:]
    changed.append('AndroidManifest.xml: %s' % PERMISSION)

open(MANIFEST, 'w').write(src)

# ---- 4) the generated Java must still be balanced and must still say what it should ----
java = open(SERVICE).read()
depth = java.count('{') - java.count('}')
parens = java.count('(') - java.count(')')
if depth or parens:
    sys.exit('FATAL: SideCutJobService.java is unbalanced (braces %d, parens %d)' % (depth, parens))
if 'FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK' not in java:
    sys.exit('FATAL: the service does not ask for the media type')
if tag_new not in open(MANIFEST).read():
    sys.exit('FATAL: the manifest does not declare the media type')

for c in changed:
    print('changed: %s' % c)
print('the hold: a song holds mediaPlayback, a download still holds dataSync (%d change(s))' % len(changed))
