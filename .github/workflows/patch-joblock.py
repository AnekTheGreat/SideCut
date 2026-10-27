#!/usr/bin/env python3
"""
Inject the SideCutJob plugin: the native half of "a conversion keeps going in the
background".

WHY THIS EXISTS, in Android's own terms. A batch of songs is minutes of work, and the
owner starts it and puts the phone down. From that moment the app is in the background,
and Android does two things to a backgrounded app that a download cannot survive:

  * with the screen off, the CPU sleeps. Nothing runs - not the WebView's timers, not a
    range read in flight - unless something holds a wake lock.
  * a cached process is frozen and can be killed. A foreground service is what makes the
    process neither: an app running one keeps its oom_adj, and the OS will not freeze it.

So the web layer asks for a "hold" for the length of a run (index.html: scRunJobStart /
scRunJobNote / scRunJobEnd), and this plugin answers it with a PARTIAL_WAKE_LOCK plus a
dataSync foreground service carrying the run's own progress in the notification.

WHAT IT DELIBERATELY DOES NOT DO. It never throws at the web layer and never fails a
conversion: every call is wrapped, and a device that refuses the foreground service
(Android 12+ forbids starting one from the background; the permission can be denied)
falls back to the wake lock alone, which is still the part that keeps the CPU awake.
It also stops the moment the run ends - the notification and the lock are released
together, so a finished album costs nothing. A browser has no such plugin and never
calls it (the page holds a Web Lock instead), and a build older than this one simply
does not answer, which the page treats as "no native hold here".

Runs AFTER `npx cap add android` and AFTER patch-widget.py (this extends the plugin
registration that writes). Idempotent and safe to re-run.
"""
import os
import sys

PKG_PATH = 'com/SideCut/myapp'
APP_ID = 'com.SideCut.myapp'
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
JAVA_DIR = os.path.join(BASE, 'android', 'app', 'src', 'main', 'java', PKG_PATH)
MAIN_ACTIVITY = os.path.join(JAVA_DIR, 'MainActivity.java')
MANIFEST = os.path.join(BASE, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')

SERVICE_JAVA = """package %s;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.core.app.NotificationCompat;

/**
 * The foreground service a conversion run holds, and the wake lock it holds with it.
 *
 * An app with the screen off is suspended by Android and a suspended app does not read
 * a range; a cached process is frozen and may be killed, and a foreground service is
 * what keeps this one out of that bucket. Both are released together when the run ends
 * (see SideCutJobPlugin.release), so a finished album costs no battery.
 */
public class SideCutJobService extends Service {

    public static final int NOTIFICATION_ID = 9001;
    private static final String CHANNEL_ID = "sidecut_job";
    private static final String CHANNEL_NAME = "Conversions";
    private static final String WAKE_TAG = "SideCut:conversion";

    private static PowerManager.WakeLock wakeLock = null;
    private static boolean running = false;
    private static String title = "SideCut";
    private static String detail = "";

    public static synchronized boolean isRunning() { return running; }

    public static synchronized void setText(String t, String d) {
        if (t != null && t.length() > 0) { title = t; }
        if (d != null) { detail = d; }
    }

    /** The CPU must not sleep under a run. Idempotent: one lock per hold, not per call. */
    public static synchronized void holdWake(Context ctx) {
        if (wakeLock != null) { return; }
        try {
            PowerManager pm = (PowerManager) ctx.getSystemService(Context.POWER_SERVICE);
            if (pm == null) { return; }
            PowerManager.WakeLock lock = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, WAKE_TAG);
            // Not reference counted: hold()/release() are a pair from the web layer, and a
            // count that drifted would leave the phone awake for ever.
            lock.setReferenceCounted(false);
            lock.acquire();
            wakeLock = lock;
        } catch (Exception e) {
            wakeLock = null;
        }
    }

    public static synchronized void releaseWake() {
        PowerManager.WakeLock lock = wakeLock;
        wakeLock = null;
        if (lock != null) {
            try { lock.release(); } catch (Exception e) { }
        }
    }

    /** Stop the service (and with it the notification) and let the CPU sleep again. */
    public static void stop(Context ctx) {
        releaseWake();
        try { ctx.stopService(new Intent(ctx, SideCutJobService.class)); } catch (Exception e) { }
    }

    /**
     * Rebuild the notification with the run's own numbers. `pct` below zero means the
     * run has not reported a percentage yet (an indeterminate bar).
     */
    public static void refresh(Context ctx, int pct) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) { nm.notify(NOTIFICATION_ID, build(ctx, pct)); }
        } catch (Exception e) { }
    }

    private static Notification build(Context ctx, int pct) {
        try {
            NotificationManager nm = (NotificationManager) ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                    && nm.getNotificationChannel(CHANNEL_ID) == null) {
                NotificationChannel ch = new NotificationChannel(
                        CHANNEL_ID, CHANNEL_NAME, NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
        } catch (Exception e) { }
        String text = detail == null ? "" : detail;
        NotificationCompat.Builder b = new NotificationCompat.Builder(ctx, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(text)
                // A framework drawable: this project ships no drawable by that name, and a
                // notification with no icon is not built at all.
                .setSmallIcon(android.R.drawable.stat_sys_download)
                .setOngoing(true)
                .setOnlyAlertOnce(true)
                .setSilent(true)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setCategory(NotificationCompat.CATEGORY_PROGRESS);
        if (pct >= 0) {
            b.setProgress(100, Math.max(0, Math.min(100, pct)), false);
        } else {
            b.setProgress(100, 0, true);
        }
        return b.build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        try {
            Notification n = build(getApplicationContext(), -1);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                startForeground(NOTIFICATION_ID, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
            } else {
                startForeground(NOTIFICATION_ID, n);
            }
            running = true;
        } catch (Throwable t) {
            // Android 12+ refuses a foreground service started from the background and
            // the permission can be refused outright. Neither may take the process with
            // it - the web layer's run carries on, kept awake by the lock alone.
            running = false;
        }
        // Do not resurrect a run the OS killed: the web layer's songs are gone with it.
        return START_NOT_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }
}
""" % APP_ID

PLUGIN_JAVA = """package %s;

import android.content.Context;
import android.content.Intent;
import android.os.Build;

import androidx.core.content.ContextCompat;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The web layer's side of "a conversion keeps going in the background".
 *
 * hold()    - for the length of a run: wake lock + dataSync foreground service
 * update()  - the run's progress, into the notification that service shows
 * release() - the run is over: both go back
 *
 * Every method resolves. None of them may fail a conversion: a phone that will not give
 * the app a foreground service (Android 12+ refuses one started from the background)
 * still gets the wake lock, which is the part that keeps the CPU running.
 */
@CapacitorPlugin(name = "SideCutJob")
public class SideCutJobPlugin extends Plugin {

    private boolean started = false;

    @PluginMethod
    public void hold(PluginCall call) {
        boolean kept = false;
        try {
            String title = call.getString("title", "SideCut");
            String sub = call.getString("sub", "");
            SideCutJobService.setText(title, sub);
            SideCutJobService.holdWake(getContext());
            if (!started) {
                started = startService();
            }
            kept = SideCutJobService.isRunning();
        } catch (Exception e) {
            kept = false;
        }
        JSObject out = new JSObject();
        out.put("running", kept);
        call.resolve(out);
    }

    private boolean startService() {
        try {
            Context ctx = getContext();
            Intent intent = new Intent(ctx, SideCutJobService.class);
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(ctx, intent);
            } else {
                ctx.startService(intent);
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    @PluginMethod
    public void update(PluginCall call) {
        try {
            String title = call.getString("title");
            String sub = call.getString("sub");
            Integer pct = call.getInt("pct");
            SideCutJobService.setText(title, sub);
            SideCutJobService.refresh(getContext(), pct == null ? -1 : pct.intValue());
        } catch (Exception e) { }
        call.resolve();
    }

    @PluginMethod
    public void release(PluginCall call) {
        try {
            started = false;
            SideCutJobService.stop(getContext());
        } catch (Exception e) { }
        call.resolve();
    }
}
""" % APP_ID

WIDGET_LINE = '        this.initialPlugins.add(SideCutWidgetPlugin.class);'
FOCUS_LINE = '        this.initialPlugins.add(SideCutAudioFocusPlugin.class);'
JOB_LINE = '        this.initialPlugins.add(SideCutJobPlugin.class);'

PERMISSIONS = [
    # A foreground service at all, and the type this one declares.
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_DATA_SYNC',
    # The CPU must stay awake for the length of a run: this is what the lock needs.
    'android.permission.WAKE_LOCK',
]

SERVICE_TAG = ('        <service android:name=".SideCutJobService" android:exported="false"'
               ' android:foregroundServiceType="dataSync" />')

changed = []


def patch_main_activity():
    with open(MAIN_ACTIVITY) as f:
        src = f.read()
    if 'SideCutJobPlugin' in src:
        print('already patched: MainActivity registers the job plugin')
        return
    if WIDGET_LINE in src:
        src = src.replace(WIDGET_LINE, WIDGET_LINE + '\n' + JOB_LINE, 1)
    elif FOCUS_LINE in src:
        src = src.replace(FOCUS_LINE, FOCUS_LINE + '\n' + JOB_LINE, 1)
    elif 'initialPlugins.add' in src:
        # Some other plugin was registered — append next to it, keeping the list inside
        # the constructor (Capacitor consumes it before super.onCreate()).
        lines = src.split('\n')
        for i, line in enumerate(lines):
            if 'initialPlugins.add' in line:
                indent = line[:len(line) - len(line.lstrip())]
                lines.insert(i + 1, indent + 'this.initialPlugins.add(SideCutJobPlugin.class);')
                break
        src = '\n'.join(lines)
    else:
        sys.exit('FATAL: MainActivity has no plugin registration to extend — '
                 'run patch-widget.py first (it writes MainActivity).')
    with open(MAIN_ACTIVITY, 'w') as f:
        f.write(src)
    changed.append('android/app/src/main/java/%s/MainActivity.java' % PKG_PATH)


def patch_manifest():
    with open(MANIFEST) as f:
        src = f.read()
    added = 0
    for perm in PERMISSIONS:
        # The Q U O T E D declaration, not the bare name: "...FOREGROUND_SERVICE" is a
        # substring of "...FOREGROUND_SERVICE_MEDIA_PLAYBACK", so a bare-name check said
        # this permission was already there when only a different one was.
        if 'android:name="%s"' % perm in src:
            print('already present: %s' % perm)
            continue
        head = src.index('<manifest')
        close = src.index('>', head) + 1
        src = src[:close] + '\n    <uses-permission android:name="%s" />' % perm + src[close:]
        added += 1
    if 'SideCutJobService' in src:
        print('already present: the SideCutJobService declaration')
    else:
        end = src.rindex('</application>')
        src = src[:end] + SERVICE_TAG + '\n' + src[end:]
        added += 1
    with open(MANIFEST, 'w') as f:
        f.write(src)
    changed.append('android/app/src/main/AndroidManifest.xml (%d change(s))' % added)


def main():
    for path in (JAVA_DIR, MAIN_ACTIVITY, MANIFEST):
        if not os.path.exists(path):
            print('ERROR: missing %s — run this after `npx cap add android`' % path)
            sys.exit(1)
    with open(os.path.join(JAVA_DIR, 'SideCutJobService.java'), 'w') as f:
        f.write(SERVICE_JAVA)
    changed.append('android/app/src/main/java/%s/SideCutJobService.java' % PKG_PATH)
    with open(os.path.join(JAVA_DIR, 'SideCutJobPlugin.java'), 'w') as f:
        f.write(PLUGIN_JAVA)
    changed.append('android/app/src/main/java/%s/SideCutJobPlugin.java' % PKG_PATH)
    if 'SideCutJobService' not in SERVICE_JAVA or 'SideCutJobPlugin' not in PLUGIN_JAVA:
        sys.exit('FATAL: the generated Java does not declare what it says it does')
    patch_main_activity()
    patch_manifest()
    for c in changed:
        print('wrote', c)
    print('job plugin injected (%d file(s))' % len(changed))


if __name__ == '__main__':
    main()
