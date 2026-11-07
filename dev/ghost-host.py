#!/usr/bin/env python3
"""83.0.5 - the widget plays without opening the app (second attempt, honest one).

WHAT WAS WRONG IN 83.0.4, AND WHY IT COULD NOT HAVE WORKED. The play button's
intent was chosen when the widget was PAINTED: `ghostPlayPossible()` returns false
while SideCut is alive, and the widget is only painted while SideCut is alive. The
widget asks the launcher for no periodic redraw at all (`updatePeriodMillis="0"`),
so nothing repaints it after the app dies either - the intent baked into the button
is the one from the last paint, which happened while the app was running. The
hidden-host intent was therefore almost never the one under the finger: the press
took the old path, sent a media key to a dead process and opened the app, which is
exactly the behaviour the release was meant to replace.

THE FIX IS WHERE THE DECISION LIVES, NOT WHAT IT SAYS. Nothing is decided at paint
time any more. With the switch on, the play button ALWAYS opens GhostHostActivity -
a transparent trampoline with no UI and no bridge - and the trampoline looks at the
phone at the moment of the press:

  * music already playing, or a fresh heartbeat (the app is still behind the
    widget) -> it re-sends the widget's own `WIDGET_playpause` broadcast and
    finishes. Every press behaves exactly as it did before this release.
  * otherwise -> it starts GhostPlayerActivity, the alpha-0 BridgeActivity that
    boots the page off-screen, and finishes. Nothing appears on the screen.

WHAT ELSE CHANGED.
  * The off-screen WebView is allowed to start audio without a tap
    (`setMediaPlaybackRequiresUserGesture(false)`), because the page's own boot
    presses play and Chromium otherwise refuses it.
  * The hidden player is far less trigger-happy: it waits 8 s before its first
    look, needs 20 s of silence before giving up, and when it does give up it
    OPENS THE APP instead of vanishing - a press can never end in nothing.
  * A song that played and then ended still closes the host silently; only a host
    that never produced a sound falls back to the app.

Everything is idempotent, and the whole file is a `dev/` script because
`.github/workflows/` cannot be committed by an Actions token.

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

MARK = '83.0.5: the widget plays without opening the app'
changed = []


def write(path, text):
    with open(path, 'w') as f:
        f.write(text)
    changed.append(os.path.relpath(path, ROOT))


# ---- the trampoline: decides at the press, owns nothing -------------------------
GHOST_JAVA = """package %s;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.view.View;

/**
 * 83.0.5 - THE PRESS LANDS HERE, AND THE DECISION IS MADE HERE.
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
 * It never shows anything and it is gone in milliseconds either way.
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
    private void handBack() {
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

        // The switch, then the phone. Either of the first two means the old path.
        if (!switchOn(this) || appAlive(this) || musicActive(this)) {
            handBack();
            finish();
            return;
        }

        try {
            Intent i = new Intent(this, GhostPlayerActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(i);
        } catch (Exception ignored) {
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


# ---- the hidden player: the page, off-screen, with nothing on the display --------
PLAYER_JAVA = """package %s;

import android.content.Context;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.webkit.WebSettings;

import com.getcapacitor.BridgeActivity;

/**
 * 83.0.5 - THE HIDDEN COPY THAT MAKES THE SOUND.
 *
 * SideCut's player is an <audio> element inside the WebView, so with the app swiped
 * away there is no WebView and nothing to press. This boots one anyway: the same
 * page, in an activity whose whole view tree is alpha 0, in its own task, in no
 * recents list.
 *
 * The resume request is written BEFORE the bridge exists, so the page's own boot -
 * which asks the widget plugin for a pending resume about a second in - finds it and
 * presses play on the song the restore put on the deck.
 *
 * If that song never makes a sound, the host does what the widget used to do and
 * opens the app: a press can end in the app, never in nothing. A song that played
 * and then ended closes the host silently instead.
 */
public class GhostPlayerActivity extends BridgeActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private int silent = 0;
    private boolean started = false;

    private final Runnable watch = new Runnable() {
        @Override public void run() {
            if (musicActive()) {
                started = true;
                silent = 0;
                handler.postDelayed(this, 5000);
                return;
            }
            silent++;
            if (!started && silent >= 4) {   // never made a sound in 20 s
                openApp();
                finish();
                return;
            }
            if (silent >= 6) {               // it was playing; it has stopped
                finish();
                return;
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
        // The page presses play on its own boot. Without this Chromium refuses that
        // play() because no finger touched the screen - which is the whole point.
        try {
            WebSettings st = getBridge().getWebView().getSettings();
            st.setMediaPlaybackRequiresUserGesture(false);
            st.setJavaScriptEnabled(true);
            st.setDomStorageEnabled(true);
        } catch (Exception ignored) {}
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
        handler.postDelayed(watch, 8000);
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


ACTIVITY_XML = """        <!-- 83.0.5 - the widget's play button lands here. A transparent trampoline
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
        <!-- 83.0.5 - the hidden player itself: the page, off-screen, in its own task. -->
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

PROVIDER_HELPERS = """    // ---- 83.0.5: the widget plays without opening the app ------------------
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

PLUGIN_METHODS = """    // 83.0.5 - the Settings -> Widget switch for playing without opening the app.
    // Written to the same preferences the provider reads, and the widget is repainted
    // immediately so the play button carries the trampoline without waiting for the
    // next heartbeat.
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

    # ---- the trampoline and the hidden player -----------------------------------
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
        print('ghost-host: nothing to change (already 83.0.5)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
