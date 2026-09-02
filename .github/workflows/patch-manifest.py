#!/usr/bin/env python3
"""
Ensure the Android app manifest declares the permissions the media-session
notification needs.

The @jofr/capacitor-media-session plugin's own manifest declares
FOREGROUND_SERVICE but NOT FOREGROUND_SERVICE_MEDIA_PLAYBACK, which Android 14
(API 34) requires for startForeground(..., FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK).
Without it the media notification service throws a SecurityException — the
notification never appears (and the exception historically took the whole app
down, which is why the notification player was made opt-in).

The android/ project is regenerated from the Capacitor template on every CI
build, so we patch android/app/src/main/AndroidManifest.xml after
`npx cap add android` and before Gradle builds.
"""
import os, re, sys

MANIFEST = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..', 'android', 'app', 'src', 'main',
    'AndroidManifest.xml'))
PERMISSIONS = [
    'android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK',
    'android.permission.POST_NOTIFICATIONS',
    # Widget watchdog: lets the widget receiver repaint after a reboot with a
    # corrected (paused) state instead of a stale frozen "playing" snapshot.
    'android.permission.RECEIVE_BOOT_COMPLETED',
]

if not os.path.exists(MANIFEST):
    sys.exit('FATAL: %s missing — run `npx cap add android` first.' % MANIFEST)

src = open(MANIFEST).read()
inserted = 0
for perm in PERMISSIONS:
    if perm in src:
        print('already present: %s' % perm)
        continue
    new_src, n = re.subn(
        r'(<manifest[^>]*>)',
        r'\g<1>\n    <uses-permission android:name="%s" />' % perm,
        src, count=1)
    if n == 0:
        sys.exit('FATAL: could not find <manifest> tag in %s\n--- file head ---\n%s' % (MANIFEST, src[:500]))
    src = new_src
    inserted += 1
open(MANIFEST, 'w').write(src)
print('inserted %d permission(s) into %s' % (inserted, MANIFEST))
