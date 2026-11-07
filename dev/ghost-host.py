#!/usr/bin/env python3
"""83.0.8 - the widget plays SideCut's music, and only ever SideCut's.

WHY 83.0.5 AND 83.0.6 STILL DID NOTHING.

83.0.5's hidden player extended BridgeActivity, so the page booted with no plugin at all:
the pending resume came back "not implemented" and nothing ever pressed play. 83.0.6
fixed that by extending MainActivity.

WHY 83.0.7 THEN PLAYED SOMEBODY ELSE'S AUDIO.

83.0.7 handed the press back to SideCut when the app "looked alive", judged from a
heartbeat that stayed believable for 90 s after the process died. That hand-back is not
addressed to SideCut at all: it is AudioManager.dispatchMediaKeyEvent(), a system-wide
media key, and Android gives it to whichever player it considers active - with SideCut
gone, whatever played last. Spotify answered. And the check for success was isMusicActive(),
which answers for the whole phone, so Spotify starting counted as SideCut working, the
hidden player was never started, and a SideCut widget press launched Spotify.

WHAT THIS FILE NOW DOES:

  * the heartbeat window is 15 s, not 90: a dead app stops looking alive almost at once;
  * a press is handed back ONLY when SideCut is running, and counts as success ONLY when
    SideCut's own heartbeat moves afterwards - nothing else can fake that;
  * with nothing of SideCut running, the press goes straight to the hidden player and no
    media key is sent at all, so there is no route left to another player;
  * the hidden player accepts its own page's report, or music alongside a heartbeat it is
    still writing - never bare isMusicActive(), which any app can satisfy;
  * asking for the pending resume no longer consumes it, and the page asks four times.

And the whole chain reports itself: GhostDiag writes the trail Settings -> Widget shows
and posts every line as a notification, so a press that does nothing says where it stopped.

THIS FILE CONTAINS NO BACKSLASH SEQUENCES AT ALL, on purpose. It is written out by
editors and tools that have to escape them, and a lost backslash inside a generated Java
string literal is a build failure that only shows up several steps later. Everything that
needs a newline builds one from chr(10) or (char) 10 instead - and the two string halves
that need a marker comment are joined with an explicit +, because chr() is not a literal
and cannot rely on implicit concatenation.

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
 * 83.0.8 - THE CHAIN NOW SAYS WHAT IT DID, ON THE PHONE ITSELF.
 *
 * Every branch of a widget press writes one line here: the switch, which way the
 * trampoline went, the player booting, the page's own report, whether audio arrived,
 * whether it gave up. The trail is kept for Settings -> Widget, and the newest line
 * is also posted as a notification, so a press that does nothing can say so without
 * anyone opening the app to go looking for it. Both halves are best effort: a
 * breadcrumb must never be able to break the thing it is describing.
 *
 * The line break is built from (char) 10 rather than an escape sequence, so this file
 * stays free of backslashes (see the module docstring).
 */
public final class GhostDiag {

    private static final String PREFS = "sidecut_widget";
    private static final String CHANNEL = "sidecut_ghost";
    private static final int NOTIF = 7712;
    private static final int MAX_LINES = 12;
    private static final String SEP = String.valueOf((char) 10);

    private GhostDiag() {
    }

    public static void note(Context ctx, String what) {
        if (ctx == null || what == null) return;
        try {
            android.content.SharedPreferences sp =
                    ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            String old = sp.getString("ghostDiag", "");
            String all = stamp() + "  " + what + (old.isEmpty() ? "" : SEP + old);
            String[] keep = all.split(java.util.regex.Pattern.quote(SEP));
            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < keep.length && i < MAX_LINES; i++) {
                if (i > 0) sb.append(SEP);
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
 * 83.0.8 - THE PRESS LANDS HERE, AND THE DECISION IS MADE HERE.
 *
 * A widget cannot choose its own intent at press time: its button carries whatever
 * was installed when the widget was last painted. So the button carries THIS instead -
 * a transparent activity with no content and no WebView - which costs one frame and
 * then does one of three things:
 *
 *   the switch is off  ->  hand the press back, exactly as before 83.0.4
 *   SideCut is running ->  hand it back, and watch its heartbeat: if it does not move
 *                          in 2.5 s, start the hidden player
 *   anything else      ->  start the hidden player, and send no media key at all
 *
 * That last line is the whole of 83.0.8. A hand-back is a system-wide media key, so it
 * only belongs to SideCut when SideCut is the app that is actually there.
 */
public class GhostHostActivity extends Activity {

    private static final String PREFS = "sidecut_widget";
    // 83.0.8 - NINETY SECONDS WAS A CORPSE'S HEARTBEAT. The page writes this while it
    // runs; keeping it "alive" for a minute and a half after the process dies is what
    // made a press straight after a swipe believe SideCut was still there. Fifteen
    // seconds is long enough to cover a song change and short enough to be honest.
    private static final long ALIVE_MS = 15000L;

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

    /** The last moment the running app said it was alive, in wall-clock ms. */
    private static long heartbeat(Context ctx) {
        try {
            return ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getLong("hb", 0);
        } catch (Exception e) {
            return 0;
        }
    }

    private static boolean appAlive(Context ctx) {
        long hb = heartbeat(ctx);
        return hb > 0 && (System.currentTimeMillis() - hb) <= ALIVE_MS;
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

    // 83.0.8 - AND IT HAS TO BE SIDECUT THAT ANSWERS. The hand-back is a system-wide
    // media key, so when SideCut is not the player the phone saw last, that key starts
    // SOMEBODY ELSE: pressing this widget brought Spotify back to life instead. Worse,
    // the old success test asked the phone "is music playing?", Spotify said yes, and
    // the hidden player was never started. Now the hand-back is only given to SideCut
    // when its own heartbeat says it is running, and it only counts as success when
    // that heartbeat MOVES afterwards. Nothing else is allowed to look like success.
    private void handBackThenPlayer(final String why) {
        final long before = heartbeat(this);
        handBack(why);
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() {
                if (heartbeat(GhostHostActivity.this) > before) {
                    GhostDiag.note(GhostHostActivity.this, "press -> " + why + ", and SideCut answered");
                    finish();
                    return;
                }
                GhostDiag.note(GhostHostActivity.this,
                        "press -> " + why + ", but SideCut did not answer - starting the hidden player");
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

        // 83.0.8 - ONLY SIDECUT'S OWN PRESS GOES BACK TO SIDECUT. Anything else is
        // handed to the phone, and the phone gives it to whatever played last.
        if (appAlive(this)) { handBackThenPlayer("SideCut is running"); return; }

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
 * 83.0.8 - THE HIDDEN COPY THAT MAKES THE SOUND.
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
            if (pageSaysPlaying() || (musicActive() && sidecutRunning())) {
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

    // 83.0.8 - the phone's own answer is not proof of anything: isMusicActive() reports
    // "something is playing" for ANY app, and answering it with "so it worked" is how a
    // press ended up crediting Spotify for SideCut's widget. The page knows for certain
    // that its play() resolved, so that counts.
    private boolean pageSaysPlaying() {
        try {
            return getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getBoolean("ghostAudioOk", false);
        } catch (Exception e) {
            return false;
        }
    }

    // 83.0.8 - music being audible is not proof that it is ours: the phone reports
    // "something is playing" for any app. Ours has the page's own report, or music plus
    // a heartbeat SideCut is still writing.
    private boolean sidecutRunning() {
        try {
            long hb = getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE).getLong("hb", 0);
            return hb > 0 && (System.currentTimeMillis() - hb) <= 15000L;
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
            android.content.SharedPreferences.Editor ed =
                    getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE).edit();
            ed.putBoolean("pendingResume", true);
            ed.putBoolean("ghostAudioOk", false);
            ed.apply();
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
    // the press back to this provider only when SideCut is running, and starts the
    // hidden player otherwise - never handing a press to the phone when SideCut is not
    // there to answer it. The decision is NOT made here - the widget is painted while
    // the app is alive, so a choice made here would describe the state at the last
    // paint, which is the bug 83.0.4 shipped.
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
                android.content.SharedPreferences.Editor ed =
                        getContext().getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE).edit();
                if (step.startsWith("playing")) {
                    ed.putBoolean("ghostAudioOk", true);
                } else {
                    ed.putBoolean("ghostAudioOk", false);
                }
                // The request has been answered, one way or the other - a request that
                // outlived its press would resume a song the next time the app opened.
                ed.remove("pendingResume");
                ed.apply();
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
    for line in src.split(chr(10)):
        if 'setOnClickPendingIntent(R.id.wPlay' in line and 'playpause' in line:
            indent = line[:len(line) - len(line.lstrip())]
            out.append(indent + 'rv.setOnClickPendingIntent(R.id.wPlay,')
            out.append(indent + '        ghostPlayOn(ctx) ? ghostPi(ctx) : pi(ctx, "playpause", ""));')
            hits += 1
        else:
            out.append(line)
    return chr(10).join(out), hits


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
            ('// ' + MARK + chr(10)
             + 'public class SideCutWidgetProvider extends AppWidgetProvider {'), 1)
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
