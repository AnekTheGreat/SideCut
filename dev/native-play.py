#!/usr/bin/env python3
"""83.2.0 - THE SOUND LEAVES THE WEBVIEW.

Every version up to 83.1.0 played music with an <audio> element inside the app
window. Swiping the task out of recents destroys that window and the audio dies with
it, which is why a widget press could do nothing at all however the press was routed:
there was no player left to start. The "hidden player" was a WebView too, so it
inherited the same death.

This is the shape Spotify uses, cut down to the case that is broken: MediaPlayer in a
foreground service (dev/native-play-service.java.txt), which the swipe does not
touch. The page writes a copy of the current song beside it (dev/patch-8320.py), so a
press starts real sound with no activity, no WebView and no timing.

  NativePlayService.java   the player, its notification, its actions
  AndroidManifest.xml      service INSIDE <application>, FGS permissions
  GhostHostActivity.java   dead-app press: native first, hidden player second
  MainActivity.java        opening the app stops the native copy (no double audio)

Re-running is a no-op. Edits ./android/... relative to the working directory.
"""
import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JAVA_DIR = os.path.join('android', 'app', 'src', 'main', 'java', 'com', 'SideCut', 'myapp')
SERVICE = os.path.join(JAVA_DIR, 'NativePlayService.java')
SOURCE = os.path.join(HERE, 'native-play-service.java.txt')
HOST = os.path.join(JAVA_DIR, 'GhostHostActivity.java')
MAIN = os.path.join(JAVA_DIR, 'MainActivity.java')
MANIFEST = os.path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml')

SERVICE_DECL = (
    '        <service\n'
    '            android:name=".NativePlayService"\n'
    '            android:exported="false"\n'
    '            android:stopWithTask="false"\n'
    '            android:foregroundServiceType="mediaPlayback" />\n'
)

PERMS = (
    '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />\n'
    '    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />\n'
)

OLD_HIDDEN = (
    '        GhostDiag.note(this, "press -> starting the hidden player");\n'
    '        startHiddenPlayer();\n'
)
NEW_HIDDEN = (
    '        // 83.2.0 - NOTHING IS ALIVE, SO PLAY REAL AUDIO.\n'
    '        //\n'
    '        // Everything above here ends in a WebView, and the swipe that made the\n'
    '        // press necessary destroyed the WebView that was making sound. The page\n'
    '        // keeps a copy of the current song beside NativePlayService, so this press\n'
    '        // can start native playback that the swipe cannot touch.\n'
    '        if (NativePlayService.playing(this)) {\n'
    '            GhostDiag.note(this, "press -> native is playing, pausing it");\n'
    '            NativePlayService.pause(this);\n'
    '            finish();\n'
    '            return;\n'
    '        }\n'
    '        if (NativePlayService.ready(this)) {\n'
    '            GhostDiag.note(this, "press -> native play, no window needed");\n'
    '            NativePlayService.play(this);\n'
    '            finish();\n'
    '            return;\n'
    '        }\n'
    '\n'
    '        GhostDiag.note(this, "press -> starting the hidden player");\n'
    '        startHiddenPlayer();\n'
)

MAIN_OLD = (
    '        this.initialPlugins.add(SideCutWidgetPlugin.class);\n'
    '    }\n'
    '}'
)
MAIN_NEW = (
    '        this.initialPlugins.add(SideCutWidgetPlugin.class);\n'
    '    }\n'
    '\n'
    '    // 83.2.0 - the app is back, so the page owns playback again. Without this the\n'
    '    // native copy would keep playing under a page that thinks it is paused.\n'
    '    @Override\n'
    '    protected void onResume() {\n'
    '        super.onResume();\n'
    '        try { NativePlayService.stopIfPlaying(this); } catch (Exception ignored) {}\n'
    '    }\n'
    '}'
)


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, text):
    io.open(path, 'w', encoding='utf-8').write(text)


def main():
    for path in (HOST, MAIN, MANIFEST):
        if not os.path.exists(path):
            print('native-play: no ' + path + ' - run patch-widget.py and dev/ghost-host.py first')
            return 1
    if not os.path.exists(SOURCE):
        print('native-play: missing ' + SOURCE)
        return 1

    changed = []

    java = read(SOURCE)
    if not os.path.exists(SERVICE) or read(SERVICE) != java:
        write(SERVICE, java)
        changed.append('NativePlayService.java')

    manifest = read(MANIFEST)
    if 'FOREGROUND_SERVICE_MEDIA_PLAYBACK' not in manifest:
        if '<application' not in manifest:
            print('native-play: no <application> in the manifest')
            return 1
        manifest = manifest.replace('<application', PERMS + '<application', 1)
        write(MANIFEST, manifest)
        changed.append('the foreground-service permissions')

    manifest = read(MANIFEST)
    if 'NativePlayService' not in manifest:
        # INSIDE <application>, not before it: a service element at the root of the
        # manifest is legal XML and completely ignored by Android.
        head = manifest.find('<application')
        close = manifest.find('>', head)
        if head < 0 or close < 0:
            print('native-play: no <application> tag in the manifest')
            return 1
        manifest = (manifest[:close + 1] + '\n' + SERVICE_DECL.rstrip('\n')
                    + manifest[close + 1:])
        write(MANIFEST, manifest)
        changed.append('the service entry')

    host = read(HOST)
    if 'NativePlayService.playing(this)' not in host:
        if host.count(OLD_HIDDEN) != 1:
            print('native-play: the hidden-player line is %d matches (expected 1)'
                  % host.count(OLD_HIDDEN))
            return 1
        host = host.replace(OLD_HIDDEN, NEW_HIDDEN, 1)
        write(HOST, host)
        changed.append('the press routing')

    main_java = read(MAIN)
    if 'NativePlayService.stopIfPlaying' not in main_java:
        if main_java.count(MAIN_OLD) != 1:
            print('native-play: MainActivity is not the shape this expects')
            return 1
        main_java = main_java.replace(MAIN_OLD, MAIN_NEW, 1)
        write(MAIN, main_java)
        changed.append('stopping native when the app opens')

    if changed:
        print('native-play: OK - ' + ', '.join(changed))
    else:
        print('native-play: nothing to change (already applied)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
