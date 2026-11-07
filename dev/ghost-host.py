#!/usr/bin/env python3
"""83.0.4 - the widget plays without opening the app.

WHAT THIS IS. SideCut's sound comes out of the WebView, so the widget has never been
able to play anything itself: pressing play with the app swiped away left a resume
request and opened the app. This adds the missing piece - a hidden host. The play
button on a widget whose app is gone now opens a translucent, alpha-0 copy of the app
in its own task: it boots the page, the page picks the last song back up (the same
resume path the widget already wrote), and the music plays with nothing on screen.
When there is nothing to play, or the music stops, it closes itself.

WHY A `dev/` SCRIPT AND NOT A WORKFLOW ONE. `.github/workflows/` cannot be pushed by an
Actions token, so a release can never ship a change to a file there. This lives under
dev/ and android-build.yml runs it right after dev/widget-sizes.py, on the project the
widget generator has just written.

WHAT IT TOUCHES, ALL IDEMPOTENT:
  * GhostHostActivity.java            the hidden BridgeActivity (new file)
  * AndroidManifest.xml               one <activity> entry, translucent, out of recents
  * SideCutWidgetProvider.java        the play intent, gated on the switch + the app being gone
  * SideCutWidgetPlugin.java          setGhostPlay / getGhostPlay, so Settings can write the pref

The switch itself defaults OFF: until it is turned on in Settings -> Widget, the play
button behaves exactly as it did in 83.0.3.

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

MARK = '83.0.4: the widget plays without opening the app'
changed = []


def write(path, text):
    with open(path, 'w') as f:
        f.write(text)
    changed.append(os.path.relpath(path, ROOT))


GHOST_JAVA = """package %s;

import android.content.Context;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

import com.getcapacitor.BridgeActivity;

/**
 * 83.0.4 - THE HIDDEN COPY THAT PLAYS.
 *
 * The widget cannot make sound by itself: the player is a WebView audio element, and
 * with the app swiped away there is no WebView. So this activity boots one anyway,
 * with nothing on the screen. It is translucent, its whole view tree is alpha 0, it
 * lives in its own task and it never appears in recents.
 *
 * The resume request is written BEFORE the bridge is built, so the page's boot - which
 * asks the widget plugin for a pending resume about a second in - finds it and presses
 * play on the song the restore already put on the deck. If nothing comes back, or the
 * music stops, the host closes itself and leaves no trace.
 */
public class GhostHostActivity extends BridgeActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private int silentPolls = 0;
    private boolean startedAudio = false;

    private final Runnable watch = new Runnable() {
        @Override public void run() {
            boolean music = musicActive();
            if (music) {
                startedAudio = true;
                silentPolls = 0;
            } else {
                silentPolls++;
                // Nothing ever started (no song to resume), or the song ended: close.
                if (silentPolls >= 2) { finish(); return; }
            }
            handler.postDelayed(this, 5000);
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

    @Override
    public void onCreate(Bundle savedInstanceState) {
        try {
            getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .edit().putBoolean("pendingResume", true).apply();
        } catch (Exception ignored) {}
        super.onCreate(savedInstanceState);
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
        handler.postDelayed(watch, 20000);
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

ACTIVITY_XML = """        <!-- 83.0.4 - the hidden player host the widget opens when SideCut is gone.
             Translucent, out of recents, in a task of its own so the visible app can
             come and go without touching it. -->
        <activity
            android:name=".GhostHostActivity"
            android:theme="@android:style/Theme.Translucent.NoTitleBar"
            android:exported="false"
            android:excludeFromRecents="true"
            android:taskAffinity=""
            android:launchMode="singleInstance"
            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode"
            android:screenOrientation="unspecified" />
"""

PROVIDER_HELPERS = """    // ---- 83.0.4: the widget plays without opening the app ------------------
    // The switch lives in Settings -> Widget. With it on, a play button on a widget
    // whose SideCut is gone opens the hidden host instead of the app: the host boots
    // the page off-screen, the page resumes the last song, and nothing appears on the
    // screen. With it off - or with a live session, or with music already playing -
    // the button is the same media-key press it has always been.
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

    static boolean ghostPlayPossible(Context ctx, boolean playing) {
        if (playing) return false;
        if (!ghostPlayOn(ctx)) return false;
        if (musicActive(ctx)) return false;
        try {
            android.content.SharedPreferences sp =
                    ctx.getSharedPreferences(GHOST_PREFS, Context.MODE_PRIVATE);
            long hb = sp.getLong("hb", 0);
            // A fresh heartbeat means the app is still alive behind the widget, and a
            // hidden second player is exactly what we must not start then.
            return !(hb > 0 && (System.currentTimeMillis() - hb) <= 90000L);
        } catch (Exception e) {
            return true;
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

PLUGIN_METHODS = """    // 83.0.4 - the Settings -> Widget switch for playing without opening the app.
    // Written to the same preferences the provider reads, and the widget is repainted
    // immediately so the play button switches to the hidden host without waiting for
    // the next heartbeat.
    @PluginMethod
    public void setGhostPlay(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        try {
            getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .edit().putBoolean("ghostPlay", on).apply();
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

"""

def replace_play_line(src):
    """Point the widget's play button at the hidden host when there is one to start.

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
            out.append(indent + '        ghostPlayPossible(ctx, playing) ? ghostPi(ctx) : pi(ctx, "playpause", ""));')
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

    # ---- the hidden host ---------------------------------------------------------
    if not os.path.exists(GHOST) or open(GHOST).read() != GHOST_JAVA:
        write(GHOST, GHOST_JAVA)

    # ---- its manifest entry ------------------------------------------------------
    manifest = open(MANIFEST).read()
    if 'GhostHostActivity' not in manifest:
        if '</application>' not in manifest:
            print('ghost-host: ERROR no </application> in the manifest')
            return 1
        manifest = manifest.replace('</application>', ACTIVITY_XML + '    </application>', 1)
        write(MANIFEST, manifest)

    # ---- the play button ---------------------------------------------------------
    provider = open(PROVIDER).read()
    if MARK not in provider:
        if 'ghostPlayPossible' not in provider:
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

    # ---- the switch the page writes ---------------------------------------------
    plugin = open(PLUGIN).read()
    if 'setGhostPlay' not in plugin:
        anchor = '    // Live job progress in the Android shade'
        if anchor not in plugin:
            print('ghost-host: ERROR the plugin has no place to put the switch')
            return 1
        plugin = plugin.replace(anchor, PLUGIN_METHODS + anchor, 1)
        write(PLUGIN, plugin)

    if changed:
        print('ghost-host: OK - ' + ', '.join(changed))
    else:
        print('ghost-host: nothing to change (already 83.0.4)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
