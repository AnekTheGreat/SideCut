#!/usr/bin/env python3
"""
Harden @jofr/capacitor-media-session against a real main-thread crash.

`MediaSessionService.onStartCommand()` calls
`MediaButtonReceiver.handleIntent(mediaSession, intent)` unconditionally. But
`mediaSession` is only assigned in `connectAndInitialize()`, which runs from
`onServiceConnected()` — i.e. AFTER `startForegroundService()` has already fired
`onStartCommand()`. On the very first playback the binder has not connected yet,
so `mediaSession` is null and `handleIntent(null, ...)` throws a NullPointerException
on the main thread, killing the whole app. That is exactly the crash the
"notification player crashed the app" flight-recorder message was catching.

The android project compiles this plugin's Java directly from node_modules
(referenced via capacitor.settings.gradle), so we patch the file in place after
plugin install and before the Gradle build.
"""
import os, sys

PLUGIN = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..',
    'node_modules', '@jofr', 'capacitor-media-session', 'android', 'src', 'main',
    'java', 'io', 'github', 'jofr', 'capacitor', 'mediasessionplugin',
    'MediaSessionService.java'))

if not os.path.exists(PLUGIN):
    sys.exit('FATAL: %s missing — run `npm install` first.' % PLUGIN)

# ---- Second hardening target: MediaSessionPlugin.java ----
PLUGIN2 = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..',
    'node_modules', '@jofr', 'capacitor-media-session', 'android', 'src', 'main',
    'java', 'io', 'github', 'jofr', 'capacitor', 'mediasessionplugin',
    'MediaSessionPlugin.java'))

def guard_start_media():
    if not os.path.exists(PLUGIN2):
        print('skip: MediaSessionPlugin.java missing')
        return
    s = open(PLUGIN2).read()
    o = ('    public void startMediaService() {\n'
         '        Intent intent = new Intent(getActivity(), MediaSessionService.class);\n'
         '        ContextCompat.startForegroundService(getContext(), intent);\n'
         '        getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);\n'
         '    }')
    n = ('    public void startMediaService() {\n'
         '        Intent intent = new Intent(getActivity(), MediaSessionService.class);\n'
         '        try {\n'
         '            ContextCompat.startForegroundService(getContext(), intent);\n'
         '            getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);\n'
         '        } catch (Exception e) {\n'
         '            // Android 12+ throws ForegroundServiceStartNotAllowedException when a\n'
         '            // service is started from the background (playback resumed via a widget /\n'
         '            // lock-screen / media button while the app WebView is not foregrounded).\n'
         '            // That would kill the whole process with no JS error — exactly the\n'
         '            // "crashed during starting playback" flight-recorder line. Swallow it so\n'
         '            // the process survives; a quiet bind keeps state moving.\n'
         '            try { getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE); }\n'
         '            catch (Exception ignored) {}\n'
         '        }\n'
         '    }')
    if n in s:
        print('already patched: startMediaService guarded')
        return
    if o not in s:
        sys.exit('FATAL: startMediaService pattern not found in %s' % PLUGIN2)
    open(PLUGIN2, 'w').write(s.replace(o, n))
    print('patched startMediaService guard in MediaSessionPlugin.java')

guard_start_media()

src = open(PLUGIN).read()

OLD = ('    public int onStartCommand(Intent intent, int flags, int startId) {\n'
       '        MediaButtonReceiver.handleIntent(mediaSession, intent);\n'
       '        return super.onStartCommand(intent, flags, startId);\n'
       '    }')
NEW = ('    public int onStartCommand(Intent intent, int flags, int startId) {\n'
       '        // mediaSession is null until onServiceConnected runs; guard so a\n'
       '        // first-playback startForegroundService can never NPE on main.\n'
       '        if (mediaSession != null && intent != null) {\n'
       '            MediaButtonReceiver.handleIntent(mediaSession, intent);\n'
       '        }\n'
       '        return super.onStartCommand(intent, flags, startId);\n'
       '    }')

if NEW in src:
    print('already patched: onStartCommand null-guarded')
    sys.exit(0)
if OLD not in src:
    sys.exit('FATAL: onStartCommand pattern not found in %s' % PLUGIN)

src = src.replace(OLD, NEW)
open(PLUGIN, 'w').write(src)
print('patched onStartCommand null-guard in MediaSessionService.java')
