#!/usr/bin/env python3
"""
Harden @jofr/capacitor-media-session against three real main-thread native
crashes that kill the whole WebView app process with no JS error. The android
project compiles this plugin's Java directly from node_modules (referenced via
capacitor.settings.gradle), so we patch the file in place after `npm install`
and before the Gradle build.

  1. onStartCommand NPE      : MediaSessionService.onStartCommand() calls
        MediaButtonReceiver.handleIntent(mediaSession, intent) while
        mediaSession is still null (assigned later in onServiceConnected via
        connectAndInitialize). First-playback startForegroundService fires
        onStartCommand before the binder connects -> NullPointerException,
        process death. This was the "notification player crashed the app" line.
  2. Background FGS start   : MediaSessionPlugin.startMediaService() calls
        ContextCompat.startForegroundService() with no guard. On Android 12+
        (stricter on 14/16) starting a foreground service while the app is not
        foregrounded throws ForegroundServiceStartNotAllowedException -> process
        death. This is the "crashed during starting playback" line (playback
        resumed from a widget / lock-screen / media button while backgrounded).
  3. Unbounded artwork decode: urlToBitmap() decodes cover art with no size cap
        on the main thread. A large cover -> OOM or Binder-transaction overflow
        shipping it to the notification, also during playback start. Downsample
        to ~512px exactly like the home-screen widget provider already does.

Every patch is try/catch-safe and idempotent (safe to re-run on a fresh AND an
already-patched project).
"""
import os
import sys

BASE = os.path.abspath(os.path.join(
    os.path.dirname(__file__), '..', '..',
    'node_modules', '@jofr', 'capacitor-media-session', 'android', 'src', 'main',
    'java', 'io', 'github', 'jofr', 'capacitor', 'mediasessionplugin'))

SERVICE = os.path.join(BASE, 'MediaSessionService.java')
PLUGIN = os.path.join(BASE, 'MediaSessionPlugin.java')


def patch_on_start_command():
    if not os.path.exists(SERVICE):
        sys.exit('FATAL: %s missing — run `npm install` first.' % SERVICE)
    s = open(SERVICE).read()
    old = ('    public int onStartCommand(Intent intent, int flags, int startId) {\n'
           '        MediaButtonReceiver.handleIntent(mediaSession, intent);\n'
           '        return super.onStartCommand(intent, flags, startId);\n'
           '    }')
    new = ('    public int onStartCommand(Intent intent, int flags, int startId) {\n'
           '        // mediaSession is null until onServiceConnected runs; guard so a\n'
           '        // first-playback startForegroundService can never NPE on main.\n'
           '        if (mediaSession != null && intent != null) {\n'
           '            MediaButtonReceiver.handleIntent(mediaSession, intent);\n'
           '        }\n'
           '        return super.onStartCommand(intent, flags, startId);\n'
           '    }')
    if new in s:
        print('already patched: onStartCommand null-guarded')
        return
    if old not in s:
        sys.exit('FATAL: onStartCommand pattern not found in %s' % SERVICE)
    open(SERVICE, 'w').write(s.replace(old, new))
    print('patched onStartCommand null-guard in MediaSessionService.java')


def patch_start_media_service():
    if not os.path.exists(PLUGIN):
        sys.exit('FATAL: %s missing — run `npm install` first.' % PLUGIN)
    s = open(PLUGIN).read()
    old = ('    public void startMediaService() {\n'
           '        Intent intent = new Intent(getActivity(), MediaSessionService.class);\n'
           '        ContextCompat.startForegroundService(getContext(), intent);\n'
           '        getContext().bindService(intent, serviceConnection, Context.BIND_AUTO_CREATE);\n'
           '    }')
    new = ('    public void startMediaService() {\n'
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
    if new in s:
        print('already patched: startMediaService guarded')
        return
    if old not in s:
        sys.exit('FATAL: startMediaService pattern not found in %s' % PLUGIN)
    open(PLUGIN, 'w').write(s.replace(old, new))
    print('patched startMediaService guard in MediaSessionPlugin.java')


def patch_bounded_artwork_decode():
    if not os.path.exists(PLUGIN):
        sys.exit('FATAL: %s missing — run `npm install` first.' % PLUGIN)
    s = open(PLUGIN).read()
    old = ('    private Bitmap urlToBitmap(String url) throws IOException {\n'
           '        final boolean blobUrl = url.startsWith("blob:");\n'
           '        if (blobUrl) {\n'
           '            Log.i(TAG, "Converting Blob URLs to Bitmap for media artwork is not yet supported");\n'
           '        }\n'
           '\n'
           '        final boolean httpUrl = url.startsWith("http");\n'
           '        if (httpUrl) {\n'
           '            HttpURLConnection connection = (HttpURLConnection) (new URL(url)).openConnection();\n'
           '            connection.setDoInput(true);\n'
           '            connection.connect();\n'
           '            InputStream inputStream = connection.getInputStream();\n'
           '            return BitmapFactory.decodeStream(inputStream);\n'
           '        }\n'
           '\n'
           '        int base64Index = url.indexOf(";base64,");\n'
           '        if (base64Index != -1) {\n'
           '            String base64Data = url.substring(base64Index + 8);\n'
           '            byte[] decoded = Base64.decode(base64Data, Base64.DEFAULT);\n'
           '            return BitmapFactory.decodeByteArray(decoded, 0, decoded.length);\n'
           '        }\n'
           '\n'
           '        return null;\n'
           '    }')
    new = ('    private Bitmap urlToBitmap(String url) throws IOException {\n'
           '        if (url == null) return null;\n'
           '        byte[] bytes = null;\n'
           '        try {\n'
           '            final boolean httpUrl = url.startsWith("http");\n'
           '            if (httpUrl) {\n'
           '                HttpURLConnection connection = (HttpURLConnection) (new URL(url)).openConnection();\n'
           '                connection.setDoInput(true);\n'
           '                connection.connect();\n'
           '                InputStream inputStream = connection.getInputStream();\n'
           '                java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();\n'
           '                byte[] buf = new byte[8192]; int n;\n'
           '                while ((n = inputStream.read(buf)) != -1) bos.write(buf, 0, n);\n'
           '                inputStream.close();\n'
           '                bytes = bos.toByteArray();\n'
           '            } else {\n'
           '                int base64Index = url.indexOf(";base64,");\n'
           '                if (base64Index != -1) {\n'
           '                    String base64Data = url.substring(base64Index + 8);\n'
           '                    bytes = Base64.decode(base64Data, Base64.DEFAULT);\n'
           '                }\n'
           '            }\n'
           '        } catch (Exception e) { return null; }\n'
           '        if (bytes == null || bytes.length == 0) return null;\n'
           '        // Bounded decode: clamp to ~512px so a large cover can never OOM or\n'
           '        // overflow the Binder transaction that ships it to the notification.\n'
           '        // (The home-screen widget provider downsamples the same way.)\n'
           '        try {\n'
           '            BitmapFactory.Options opts = new BitmapFactory.Options();\n'
           '            opts.inJustDecodeBounds = true;\n'
           '            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);\n'
           '            int sample = 1;\n'
           '            while ((opts.outWidth / sample > 512) || (opts.outHeight / sample > 512)) sample *= 2;\n'
           '            opts.inJustDecodeBounds = false;\n'
           '            opts.inSampleSize = sample;\n'
           '            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);\n'
           '        } catch (Exception e) { return null; }\n'
           '    }')
    if new in s:
        print('already patched: urlToBitmap bounded decode')
        return
    if old not in s:
        sys.exit('FATAL: urlToBitmap pattern not found in %s' % PLUGIN)
    open(PLUGIN, 'w').write(s.replace(old, new))
    print('patched urlToBitmap bounded decode in MediaSessionPlugin.java')


def main():
    patch_on_start_command()
    patch_start_media_service()
    patch_bounded_artwork_decode()
    print('patch-mediaplugin: OK')


if __name__ == '__main__':
    main()
