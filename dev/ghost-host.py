#!/usr/bin/env python3
"""83.0.6 - the widget plays without opening the app, with the app's own bridge.

WHY 83.0.5 STILL DID NOTHING. The hidden player extended `BridgeActivity` directly.
Capacitor only registers a page's plugins when the activity builds its bridge, and
this app's local plugin - SideCutWidget, the one that hands the page a pending
resume - is registered in **MainActivity's constructor** (`initialPlugins.add(...)`,
before `super.onCreate`). A BridgeActivity subclass that is not MainActivity gets
none of that: the page booted with no SideCutWidget plugin, `getPendingResume` failed
as "not implemented", no song was ever resumed, and the host sat there silently until
it timed out. The trampoline worked; the thing it started was deaf.

THE FIX. GhostPlayerActivity extends MainActivity. It inherits the plugin list, the
auto-registered npm plugins, and every other thing the real activity sets up - it is
the same app, with the same bridge, only invisible.

AND IT CAN NOW SAY WHAT HAPPENED. Every stage writes a breadcrumb into the widget's
preferences (`GhostDiag.java`): the press, which branch the trampoline took, the
player booting, whether audio arrived, whether it gave up. `getGhostDiag` hands the
trail to Settings -> Widget, so a press that does nothing can explain itself instead
of needing another guess.

Also: the fallback is much quicker. The player looks 5 s after boot and every 3 s
after that, and if it never makes a sound in ~12 s it opens the app - so a press
always ends in the app rather than in nothing.

    python3 dev/ghost-host.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))

with open(os.path.join(ROOT, 'capacitor.config.json')) as f:
    APP_ID = json.load(f).get('appId', 'com.SideCut.myapp')
PKG_PATH = APP_ID.replace('.', '/')
JAVA_DIR = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'java', PKG_PATH)
MANIFEST = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'AndroidManifest.xml')
PROVIDER = os.path.join(JAVA_DIR, 'SideCutWidgetProvider.java')
PLUGIN = os.path.join(JAVA_DIR, 'SideCutWidgetPlugin.java')
GHOST = os.path.join(JAVA_DIR, 'GhostHostActivity.java')
PLAYER = os.path.join(JAVA_DIR, 'GhostPlayerActivity.java')
DIAG = os.path.join(JAVA_DIR, 'GhostDiag.java')

MARK = '83.0.6: the widget plays without opening the app'
changed = []


def write(path, text):
    with open(path, 'w') as f:
        f.write(text)
    changed.append(os.path.relpath(path, ROOT))


# ---- the breadcrumb trail -------------------------------------------------------
DIAG_JAVA = """package %s;

import android.content.Context;
import android.content.SharedPreferences;

/**
 * 83.0.6 - A PRESS THAT DOES NOTHING SHOULD SAY WHY.
 *
 * Two releases were spent guessing what a silent press was doing. This records it
 * instead: five short lines, newest first, in the widget's own preferences, read
 * back by Settings -> Widget through getGhostDiag. No logs, no cable, no adb.
 */
final class GhostDiag {

    private GhostDiag() {}

    static void note(Context ctx, String what) {
        try {
            SharedPreferences sp = ctx.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE);
            String line = new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.US)
                    .format(new java.util.Date()) + "  " + what;
            String old = sp.getString("ghostDiag", "");
            StringBuilder sb = new StringBuilder(line);
            if (old != null && old.length() > 0) {
                String[] parts = old.split("\\n");
                int from = parts.length > 4 ? parts.length - 4 : 0;
                for (int i = from; i < parts.length; i++) {
                    sb.append("\\n").append(parts[i]);
                }
            }
            sp.edit().putString("ghostDiag", sb.toString()).apply();
        } catch (Exception ignored) {
        }
    }
}
""" % APP_ID


# ---- the trampoline: decides at the press, owns nothing -------------------------
GHOST_JAVA = """package %s;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.view.View;

/**
 * 83.0.6 - THE PRESS LANDS HERE, AND THE DECISION IS MADE HERE.
 *
 * A widget cannot choose its own intent at press time: its button carries whatever
 * was installed when the widget was last painted, and that is almost always while
 * SideCut is still running. So the button carries THIS instead - a transparent
 * activity with no content and no WebView - which costs one frame and then does the
 * only two things that are possible:
 *
 *   music playing, or the app still alive  ->  hand the press straight back to the
 *                                              widget's own play action
 *   nothing playing and the app is gone    ->  start the hidden player
 *
 * It never shows anything and it is gone in milliseconds either way. Every branch
 * leaves a breadcrumb.
 */
public class GhostHostActivity extends Activity {

    private static final String PREFS = "sidecut_widget";
    private static final long ALIVE_MS = 90000L;

    private static boolean switchOn(Context ctx) {
        try {
            return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
                    .getBoolean("ghostPlay", false);
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean musicActive(Context ctx) {
        try {
            AudioManager am = (AudioManager) ctx.getSystemService(Context.AUDIO_SERVICE);
            return am != null && am.isMusicActive();
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean appAlive(Context ctx) {
        try {
            long hb = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("hb", 0);
            return hb > 0 && (System.currentTimeMillis() - hb) <= ALIVE_MS;
        } catch (Exception e) {
            return false;
        }
    }

    /** Give the press back to the widget, exactly as it was before 83.0.4. */
    private void handBack(String why) {
        GhostDiag.note(this, "press -> " + why + ", handed back to the widget");
        try {
            Intent i = new Intent(this, SideCutWidgetProvider.class);
            i.setAction(getPackageName() + ".WIDGET_playpause");
            sendBroadcast(i);
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onCreate(Bundle state) {
        super.onCreate(state);
        try {
            View blank = new View(this);
            blank.setBackgroundColor(0x00000000);
            setContentView(blank);
        } catch (Exception ignored) {
        }

        if (!switchOn(this)) { handBack("the switch is off"); finish(); return; }
        if (appAlive(this)) { handBack("SideCut is still alive"); finish(); return; }
        if (musicActive(this)) { handBack("music is already playing"); finish(); return; }

        GhostDiag.note(this, "press -> starting the hidden player");
        try {
            Intent i = new Intent(this, GhostPlayerActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(i);
        } catch (Exception e) {
            GhostDiag.note(this, "press -> could not start it: " + e);
        }
        finish();
    }

    @Override
    public void finish() {
        super.finish();
        try { overridePendingTransition(0, 0); } catch (Exception ignored) {}
    }
}
""" % APP_ID


# ---- the hidden player: the app's own bridge, invisible --------------------------
PLAYER_JAVA = """package %s;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebSettings;

/**
 * 83.0.6 - THE HIDDEN COPY THAT MAKES THE SOUND.
 *
 * It extends MainActivity, and that is the whole fix. Capacitor builds a page's
 * plugin list when the activity creates its bridge, and this app registers its own
 * SideCutWidget plugin in MainActivity's CONSTRUCTOR. A plain BridgeActivity gets
 * none of that, so the page booted without the plugin that holds the pending
 * resume - it asked, got "not implemented", and never pressed play. Inheriting
 * MainActivity means the hidden player is the same app with the same plugins,
 * only invisible: alpha 0, its own task, no recents entry.
 *
 * The resume request is written BEFORE the bridge exists, so the page's own boot
 * finds it and presses play on the song the restore put on the deck.
 *
 * If that song never makes a sound, the host does what the widget used to do and
 * opens the app: a press can end in the app, never in nothing.
 */
public class GhostPlayerActivity extends MainActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private int silent = 0;
    private boolean started = false;

    private final Runnable watch = new Runnable() {
        @Override public void run() {
            if (musicActive()) {
                if (!started) GhostDiag.note(GhostPlayerActivity.this, "player -> audio is playing");
                started = true;
                silent = 0;
                handler.postDelayed(this, 3000);
                return;
            }
            silent++;
            if (!started && silent >= 4) {   // never made a sound in ~12 s
                GhostDiag.note(GhostPlayerActivity.this, "player -> no audio, opening the app");
                openApp();
                finish();
                return;
            }
            if (silent >= 8) {               // it was playing; it has stopped
                GhostDiag.note(GhostPlayerActivity.this, "player -> the song ended, closing");
                finish();
                return;
            }
            handler.postDelayed(this, 3000);
        }
    };

    private boolean musicActive() {
        try {
            AudioManager am = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
            return am != null && am.isMusicActive();
        } catch (Exception e) {
            return false;
        }
    }

    private void openApp() {
        try {
            Intent i = getPackageManager().getLaunchIntentForPackage(getPackageName());
            if (i != null) {
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                startActivity(i);
            }
        } catch (Exception ignored) {
        }
    }

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .edit().putBoolean("pendingResume", true).apply();
        } catch (Exception ignored) {}
        super.onCreate(savedInstanceState);
        GhostDiag.note(this, "player -> page is booting");
        // The page presses play on its own boot. Without this Chromium refuses that
        // play() because no finger touched the screen - which is the whole point.
        try {
            WebSettings st = getBridge().getWebView().getSettings();
            st.setMediaPlaybackRequiresUserGesture(false);
            st.setJavaScriptEnabled(true);
            st.setDomStorageEnabled(true);
        } catch (Exception e) {
            GhostDiag.note(this, "player -> no web view settings: " + e);
        }
        try {
            getWindow().setBackgroundDrawable(
                    new android.graphics.drawable.ColorDrawable(0x00000000));
        } catch (Exception ignored) {}
        final View root = getWindow().getDecorView();
        root.post(new Runnable() {
            @Override public void run() {
                try { root.setAlpha(0f); } catch (Exception ignored) {}
            }
        });
        handler.postDelayed(watch, 5000);
    }

    @Override
    public void onDestroy() {
        handler.removeCallbacksAndMessages(null);
        super.onDestroy();
    }

    @Override
    public void finish() {
        handler.removeCallbacksAndMessages(null);
        super.finish();
        try { overridePendingTransition(0, 0); } catch (Exception ignored) {}
    }
}
""" % APP_ID


ACTIVITY_XML = """        <!-- 83.0.6 - the widget's play button lands here. A transparent trampoline
             that decides at the moment of the press whether to hand the press back
             or to start the hidden player. Nothing is drawn. -->
        <activity
            android:name=".GhostHostActivity"
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:exported="false"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:launchMode="singleInstance"
            android:noHistory="true"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:screenOrientation="unspecified" />
        <!-- 83.0.6 - the hidden player: the app itself, off-screen, in its own task. -->
        <activity
            android:name=".GhostPlayerActivity"
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:exported="false"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:launchMode="singleInstance"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:screenOrientation="unspecified" />
"""

PROVIDER_HELPERS = """    // ---- 83.0.6: the widget plays without opening the app ------------------
    // The switch lives in Settings -> Widget. With it on, the play button opens a
    // transparent trampoline (GhostHostActivity) that decides at the press: it hands
    // the press back to this provider when SideCut is alive or music is playing, and
    // starts the hidden player when the app is really gone. The decision is NOT made
    // here - the widget is painted while the app is alive, so a choice made here
    // would describe the state at the last paint, which is the bug 83.0.4 shipped.
    static final String GHOST_PREFS = "sidecut_widget";
    static final String GHOST_ACTIVITY = "GhostHostActivity";

    static boolean ghostPlayOn(Context ctx) {
        try {
            return ctx.getSharedPreferences(GHOST_PREFS, Context.MODE_PRIVATE)
                    .getBoolean("ghostPlay", false);
        } catch (Exception e) {
            return false;
        }
    }

    static PendingIntent ghostPi(Context ctx) {
        Intent i = new Intent();
        i.setClassName(ctx.getPackageName(), ctx.getPackageName() + "." + GHOST_ACTIVITY);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getActivity(ctx, 515151, i, flags);
    }

"""

PLUGIN_METHODS = """    // 83.0.6 - the Settings -> Widget switch for playing without opening the app,
    // and the breadcrumb trail that says what the last press did.
    @PluginMethod
    public void setGhostPlay(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        try {
            getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .edit().putBoolean("ghostPlay", on).apply();
            GhostDiag.note(getContext(), on ? "switch -> on" : "switch -> off");
            SideCutWidgetProvider.pushAll(getContext());
        } catch (Exception ignored) {}
        call.resolve();
    }

    @PluginMethod
    public void getGhostPlay(PluginCall call) {
        boolean on = false;
        try {
            on = getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getBoolean("ghostPlay", false);
        } catch (Exception ignored) {}
        JSObject out = new JSObject();
        try { out.put("on", on); } catch (Exception ignored) {}
        call.resolve(out);
    }

    @PluginMethod
    public void getGhostDiag(PluginCall call) {
        JSObject out = new JSObject();
        try {
            android.content.SharedPreferences sp =
                    getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE);
            out.put("diag", sp.getString("ghostDiag", ""));
            out.put("on", sp.getBoolean("ghostPlay", false));
        } catch (Exception ignored) {}
        call.resolve(out);
    }

"""


def replace_play_line(src):
    """Put the trampoline under the play button, keeping whatever indentation it has.

    Done line by line rather than with a regex: the indentation is whatever the
    provider generator wrote, and this has to survive both the original pushAll and
    the one dev/widget-sizes.py replaces it with.
    """
    out = []
    hits = 0
    for line in src.split('\n'):
        if 'setOnClickPendingIntent(R.id.wPlay' in line and 'playpause' in line:
            indent = line[:len(line) - len(line.lstrip())]
            out.append(indent + 'rv.setOnClickPendingIntent(R.id.wPlay,')
            out.append(indent + '        ghostPlayOn(ctx) ? ghostPi(ctx) : pi(ctx, "playpause", ""));')
            hits += 1
        else:
            out.append(line)
    return '\n'.join(out), hits


def main():
    if not os.path.exists(PROVIDER) or not os.path.exists(PLUGIN):
        print('ghost-host: no widget sources - run patch-widget.py first')
        return 1
    if not os.path.exists(MANIFEST):
        print('ghost-host: no AndroidManifest.xml - run npx cap add android first')
        return 1

    # ---- the breadcrumbs, the trampoline and the hidden player ------------------
    if not os.path.exists(DIAG) or open(DIAG).read() != DIAG_JAVA:
        write(DIAG, DIAG_JAVA)
    if not os.path.exists(GHOST) or open(GHOST).read() != GHOST_JAVA:
        write(GHOST, GHOST_JAVA)
    if not os.path.exists(PLAYER) or open(PLAYER).read() != PLAYER_JAVA:
        write(PLAYER, PLAYER_JAVA)

    # ---- their manifest entries -------------------------------------------------
    manifest = open(MANIFEST).read()
    if 'GhostHostActivity' not in manifest:
        if '</application>' not in manifest:
            print('ghost-host: ERROR no </application> in the manifest')
            return 1
        manifest = manifest.replace('</application>', ACTIVITY_XML + '    </application>', 1)
        write(MANIFEST, manifest)

    # ---- the play button --------------------------------------------------------
    provider = open(PROVIDER).read()
    if MARK not in provider:
        if 'ghostPlayOn' not in provider:
            provider, n = replace_play_line(provider)
            if n != 1:
                print('ghost-host: ERROR the play button is not where this expects it (%d)' % n)
                return 1
        anchor = '    static void pushAll(Context ctx) {'
        if anchor not in provider:
            print('ghost-host: ERROR pushAll is not where this expects it')
            return 1
        provider = provider.replace(anchor, PROVIDER_HELPERS + anchor, 1)
        provider = provider.replace(
            'public class SideCutWidgetProvider extends AppWidgetProvider {',
            '// ' + MARK + '\n'
            'public class SideCutWidgetProvider extends AppWidgetProvider {', 1)
        write(PROVIDER, provider)

    # ---- the switch and the trail the page reads --------------------------------
    plugin = open(PLUGIN).read()
    if 'getGhostDiag' not in plugin:
        anchor = '    // Live job progress in the Android shade'
        if anchor not in plugin:
            print('ghost-host: ERROR the plugin has no place to put the switch')
            return 1
        plugin = plugin.replace(anchor, PLUGIN_METHODS + anchor, 1)
        write(PLUGIN, plugin)

    if changed:
        print('ghost-host: OK - ' + ', '.join(changed))
    else:
        print('ghost-host: nothing to change (already 83.0.6)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
