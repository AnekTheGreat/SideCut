#!/usr/bin/env python3
"""83.0.7 - the widget plays without opening the app, and says what it did.

WHY 83.0.5 AND 83.0.6 STILL DID NOTHING, AND WHAT CHANGED.

83.0.5's hidden player extended BridgeActivity, so the page booted with no plugin at all:
the pending resume came back "not implemented" and nothing ever pressed play. 83.0.6
fixed that by extending MainActivity. A press could still end in silence, for two reasons
this release removes:

  * the trampoline hands a press back to the widget when the app looks "alive", and it
    judges that from a heartbeat the page writes - one that stays fresh for 90 seconds
    after the process dies. Play something, swipe the app away, press the widget, and the
    press was handed to a player that no longer existed. A hand-back now has to produce
    sound within 2.5 s, or the hidden player starts anyway.
  * asking for the pending resume used to CONSUME it, so a request read a moment before
    the library finished hydrating was answered "nothing to play" and was gone. Asking no
    longer consumes (ghostAskResume); the page's answer clears it (ghostStep), and the
    page asks four times instead of once.

And the whole chain reports itself now: GhostDiag writes the trail Settings -> Widget
shows and posts every line as a notification, so a press that does nothing says where it
stopped without anyone having to go looking for it.

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

# Deliberately still 83.0.6: this marks the provider as already amended. Bumping it
# would make the next run try to amend a file that already has the helpers.
MARK = '83.0.6: the widget plays without opening the app'
changed = []


def write(path, text):
    with open(path, 'w') as f:
        f.write(text)
    changed.append(os.path.relpath(path, ROOT))


# ---- the breadcrumb trail -------------------------------------------------------
DIAG_JAVA = """package %s;

import android.content.Context;

/**
 * 83.0.7 - THE CHAIN NOW SAYS WHAT IT DID, ON THE PHONE ITSELF.
 *
 * Every branch of a widget press writes one line here: the switch, which way the
 * trampoline went, the player booting, the page's own report, whether audio arrived,
 * whether it gave up. The trail is kept for Settings -> Widget, and the newest line
 * is also posted as a notification, so a press that does nothing can say so without
 * anyone opening the app to go looking for it. Both halves are best effort: a
 * breadcrumb must never be able to break the thing it is describing.
 */
public final class GhostDiag {

    private static final String PREFS = "sidecut_widget";
    private static final String CHANNEL = "sidecut_ghost";
    private static final int NOTIF = 7712;
    private static final int MAX_LINES = 12;

    private GhostDiag() {
    }

    public static void note(Context ctx, String what) {
        if (ctx == null || what == null) return;
        try {
            android.content.SharedPreferences sp =
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String old = sp.getString("ghostDiag", "");
            String all = stamp() + "  " + what + (old.isEmpty() ? "" : "\n" + old);
            String[] keep = all.split("\n");
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < keep.length && i < MAX_LINES; i++) {
                if (i > 0) sb.append('\n');
                sb.append(keep[i]);
            }
            sp.edit().putString("ghostDiag", sb.toString()).apply();
        } catch (Exception ignored) {
        }
        post(ctx, what);
    }

    /** The newest line, on the shade. No permission, no notification, no problem. */
    private static void post(Context ctx, String what) {
        try {
            android.app.NotificationManager nm = (android.app.NotificationManager)
                    ctx.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;
            if (android.os.Build.VERSION.SDK_INT >= 26) {
                android.app.NotificationChannel ch = new android.app.NotificationChannel(
                        CHANNEL, "SideCut widget", android.app.NotificationManager.IMPORTANCE_LOW);
                ch.setShowBadge(false);
                nm.createNotificationChannel(ch);
            }
            android.app.Notification.Builder b = (android.os.Build.VERSION.SDK_INT >= 26)
                    ? new android.app.Notification.Builder(ctx, CHANNEL)
                    : new android.app.Notification.Builder(ctx);
            b.setSmallIcon(android.R.drawable.ic_media_play)
                    .setContentTitle("SideCut widget")
                    .setContentText(what)
                    .setStyle(new android.app.Notification.BigTextStyle().bigText(what))
                    .setOnlyAlertOnce(true)
                    .setAutoCancel(true);
            nm.notify(NOTIF, b.build());
        } catch (Exception ignored) {
        }
    }

    private static String stamp() {
        try {
            return new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date());
        } catch (Exception e) {
            return "--:--:--";
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
import android.os.Handler;
import android.os.Looper;
import android.view.View;

/**
 * 83.0.7 - THE PRESS LANDS HERE, AND THE DECISION IS MADE HERE.
 *
 * A widget cannot choose its own intent at press time: its button carries whatever
 * was installed when the widget was last painted, and that is almost always while
 * SideCut is still running. So the button carries THIS instead - a transparent
 * activity with no content and no WebView - which costs one frame and then does the
 * only two things that are possible:
 *
 *   music playing  ->  hand the press straight back to the widget's own play action
 *   anything else  ->  hand it back, and if that makes no sound in 2.5 s, start the
 *                      hidden player
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

    // 83.0.7 - A HAND-BACK IS ONLY A GUESS, SO IT IS NOW THE FIRST HALF OF ONE.
    // "SideCut is still alive" comes from a heartbeat the page writes while it runs,
    // and that heartbeat stays fresh for 90 seconds after the process dies. Swipe the
    // app away and press the widget straight afterwards and the press was handed to a
    // player that no longer existed: nothing played, nothing crashed, nothing said
    // why. The hand-back now gets 2.5 seconds to make sound, and if the phone is
    // still quiet the hidden player starts anyway - which is what the press wanted.
    private void handBackThenPlayer(final String why) {
        handBack(why);
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() {
                if (musicActive(GhostHostActivity.this)) {
                    GhostDiag.note(GhostHostActivity.this, "press -> " + why + ", and it played");
                    finish();
                    return;
                }
                GhostDiag.note(GhostHostActivity.this,
                        "press -> " + why + ", but nothing played - starting the hidden player");
                startHiddenPlayer();
                finish();
            }
        }, 2500L);
    }

    /** Start the invisible copy of the app that owns the sound. */
    private void startHiddenPlayer() {
        try {
            Intent i = new Intent(this, GhostPlayerActivity.class);
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_NO_ANIMATION);
            startActivity(i);
        } catch (Exception e) {
            GhostDiag.note(this, "press -> could not start it: " + e);
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
        if (appAlive(this)) { handBackThenPlayer("SideCut is still alive"); return; }
        if (musicActive(this)) { handBack("music is already playing"); finish(); return; }

        GhostDiag.note(this, "press -> starting the hidden player");
        startHiddenPlayer();
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
 * 83.0.7 - THE HIDDEN COPY THAT MAKES THE SOUND.
 *
 * It extends MainActivity, and that is the fix 83.0.6 was about. Capacitor builds a
 * page's plugin list when the activity creates its bridge, and this app registers its
 * own SideCutWidget plugin in MainActivity's CONSTRUCTOR. A plain BridgeActivity gets
 * none of that, so the page booted without the plugin that holds the pending resume -
 * it asked, got "not implemented", and never pressed play. Inheriting MainActivity
 * means the hidden player is the same app with the same plugins, only invisible:
 * alpha 0, its own task, no recents entry.
 *
 * The resume request is written BEFORE the bridge exists, so the page's own boot
 * finds it and presses play on the song the restore put on the deck.
 *
 * If that song never makes a sound, the player opens the app instead: a press can end
 * in the app, never in nothing.
 */
public class GhostPlayerActivity extends MainActivity {

    private final Handler handler = new Handler(Looper.getMainLooper());
    private int silent = 0;
    private boolean started = false;

    private final Runnable watch = new Runnable() {
        @Override public void run() {
            if (musicActive() || pageSaysPlaying()) {
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

    // 83.0.7 - the phone's own answer is not the only one. isMusicActive() is a
    // guess about the whole device and it can be wrong while the first buffer fills
    // or while another app is winding down. The page knows for certain that its
    // play() resolved, so it says so, and that counts - otherwise the player would
    // "give up" over music that is playing.
    private boolean pageSaysPlaying() {
        try {
            return getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getBoolean("ghostAudioOk", false);
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
            getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .edit().putBoolean("ghostAudioOk", false).apply();
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
    // the press back to this provider when music is playing (or the app looks alive,
    // and then starts the hidden player if that makes no sound), and it starts the
    // hidden player when the app is really gone. The decision is NOT made here - the
    // widget is painted while the app is alive, so a choice made here would describe
    // the state at the last paint, which is the bug 83.0.4 shipped.
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

PLUGIN_METHODS = """    // 83.0.7 - the page's own account of a resume: what it found, whether the phone
    // accepted the play, or what it had nothing to play with. "playing" is also the
    // one answer the hidden player trusts over the phone's own guess.
    @PluginMethod
    public void ghostStep(PluginCall call) {
        try {
            String step = call.getString("step", "");
            if (step != null && !step.isEmpty()) {
                GhostDiag.note(getContext(), "page -> " + step);
                android.content.SharedPreferences sp =
                        getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE);
                android.content.SharedPreferences.Editor ed = sp.edit();
                if (step.startsWith("playing")) {
                    ed.putBoolean("ghostAudioOk", true);
                } else {
                    ed.putBoolean("ghostAudioOk", false);
                }
                // The request has been answered, one way or the other - a request that
                // outlived its press would resume a song the next time the app opened.
                ed.remove("pendingResume").apply();
            }
        } catch (Exception ignored) {
        }
        call.resolve();
    }

    // Reading the request used to consume it, so a press that arrived before the
    // library had hydrated was read, found nothing to play, and was gone. This asks
    // without consuming; ghostStep is what clears it.
    @PluginMethod
    public void ghostAskResume(PluginCall call) {
        boolean resume = false;
        try {
            resume = getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getBoolean("pendingResume", false);
        } catch (Exception ignored) {
        }
        JSObject out = new JSObject();
        try { out.put("resume", resume); } catch (Exception ignored) {}
        call.resolve(out);
    }

    // 83.0.6 - the Settings -> Widget switch for playing without opening the app,
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

    # ---- the switch, the trail and the page's report ----------------------------
    plugin = open(PLUGIN).read()
    if 'ghostAskResume' not in plugin:
        anchor = '    // Live job progress in the Android shade'
        if anchor not in plugin:
            print('ghost-host: ERROR the plugin has no place to put the switch')
            return 1
        plugin = plugin.replace(anchor, PLUGIN_METHODS + anchor, 1)
        write(PLUGIN, plugin)

    if changed:
        print('ghost-host: OK - ' + ', '.join(changed))
    else:
        print('ghost-host: nothing to change (already patched)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
