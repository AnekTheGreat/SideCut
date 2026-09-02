#!/usr/bin/env python3
"""
patch-widget.py — run AFTER `npx cap add android` in CI.

Injects the SideCut 2x2 home-screen widget into the generated android project:
  - SideCutWidgetPlugin.java : Capacitor plugin ("SideCutWidget"). The web layer
    pushes now-playing state (title, artist, cover art as a data URL, playing
    bool, playlists list + active playlist) with `update()`. The web layer also
    polls `getPendingPlaylist()` — when the user taps a playlist pill on the
    widget, the widget writes the target playlist to prefs and the web layer
    picks it up and switches the playlist.
  - SideCutWidgetProvider.java : AppWidgetProvider that renders a Spotify-style
    widget (playlist pill row on top, cover art top-left, song title + artist
    below, prev / play-pause / next) and turns button taps into media key events
    routed to the media session.
  - res/layout/sidecut_widget.xml + res/xml/sidecut_widget_info.xml (2x2 cell)
    + custom white vector transport icons + pill/card backgrounds (res/drawable).
  - AndroidManifest.xml receiver entry (idempotent).
  - MainActivity.java registers the plugin (idempotent).

Idempotent: safe to run on fresh AND already-patched projects. AAPT-safe:
no `maxWidth="match_parent"`, no weighted spacer View with layout_gravity
(both broke launcher-side inflation previously).
"""
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

with open(os.path.join(ROOT, "capacitor.config.json")) as f:
    APP_ID = json.load(f).get("appId", "com.SideCut.myapp")
PKG_PATH = APP_ID.replace(".", "/")
JAVA_DIR = os.path.join(ROOT, "android", "app", "src", "main", "java", PKG_PATH)
RES_DIR = os.path.join(ROOT, "android", "app", "src", "main", "res")
DRW_DIR = os.path.join(RES_DIR, "drawable")
MANIFEST = os.path.join(ROOT, "android", "app", "src", "main", "AndroidManifest.xml")
MAIN_ACTIVITY = os.path.join(JAVA_DIR, "MainActivity.java")

changed = []


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        f.write(content)
    changed.append(os.path.relpath(path, ROOT))


PLUGIN_JAVA = """package %s;

import android.content.Context;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.JSObject;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "SideCutWidget")
public class SideCutWidgetPlugin extends Plugin {

    @PluginMethod
    public void update(PluginCall call) {
        String data = call.getString("data");
        if (data == null || data.isEmpty()) data = "{}";
        Context ctx = getContext();
        ctx.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                .edit().putString("state", data).apply();
        SideCutWidgetProvider.pushAll(ctx);
        call.resolve();
    }

    // The widget writes the playlist a user tapped into prefs; the web layer
    // polls this and switches. Returns "" when there is nothing pending.
    @PluginMethod
    public void getPendingPlaylist(PluginCall call) {
        Context ctx = getContext();
        android.content.SharedPreferences sp =
                ctx.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE);
        String pending = sp.getString("pendingPlaylist", "");
        if (!pending.isEmpty()) sp.edit().remove("pendingPlaylist").apply();
        JSObject out = new JSObject();
        try { out.put("playlist", pending); } catch (Exception ignored) {}
        call.resolve(out);
    }
}
""" % APP_ID

PROVIDER_JAVA = """package %s;

import android.app.PendingIntent;
import android.appwidget.AppWidgetManager;
import android.appwidget.AppWidgetProvider;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.media.AudioManager;
import android.util.Base64;
import android.view.KeyEvent;
import android.view.View;
import android.widget.RemoteViews;
import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;

public class SideCutWidgetProvider extends AppWidgetProvider {

    // ---- Layout view ids (must match sidecut_widget.xml) ----
    private static final int[] PILL_IDS = {
        R.id.wPill0, R.id.wPill1, R.id.wPill2, R.id.wPill3, R.id.wPill4
    };

    static void pushAll(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            if (mgr == null) return;
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SideCutWidgetProvider.class));
            if (ids == null || ids.length == 0) return;

            String state = ctx.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getString("state", "{}");
            String title = "SideCut";
            String artist = "";
            String art = "";
            boolean playing = false;
            JSONArray playlistsJson = new JSONArray();
            String active = "";
            try {
                JSONObject o = new JSONObject(state);
                title = o.optString("title", "SideCut");
                artist = o.optString("artist", "");
                art = o.optString("art", "");
                playing = o.optBoolean("playing", false);
                playlistsJson = o.optJSONArray("playlists");
                if (playlistsJson == null) playlistsJson = new JSONArray();
                active = o.optString("active", "");
            } catch (Exception ignored) {}

            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.sidecut_widget);

            // Playlist pill row (top). Show the active playlist first, then a few
            // others; hide the unused pill slots.
            List<String> pls = new ArrayList<String>();
            if (active != null && !active.isEmpty()) pls.add(active);
            for (int i = 0; i < playlistsJson.length(); i++) {
                String n = playlistsJson.optString(i, "");
                if (n.isEmpty()) continue;
                boolean isActive = n.equals(active);
                boolean already = false;
                for (String p : pls) if (p.equals(n)) already = true;
                if (already) continue;
                pls.add(n);
            }
            int shown = 0;
            for (int i = 0; i < PILL_IDS.length; i++) {
                int pid = PILL_IDS[i];
                if (i < pls.size()) {
                    String name = pls.get(i);
                    boolean isActive = name.equals(active);
                    rv.setTextViewText(pid, name);
                    rv.setViewVisibility(pid, View.VISIBLE);
                    rv.setTextColor(pid, isActive ? 0xFF0E1B1F : 0xFFFFFFFF);
                    rv.setInt(pid, "setBackgroundResource", isActive
                            ? R.drawable.sidecut_pill_active : R.drawable.sidecut_pill);
                    rv.setOnClickPendingIntent(pid, pi(ctx, "pl", name));
                    shown++;
                } else {
                    rv.setViewVisibility(pid, View.GONE);
                }
            }

            // Cover art / title / artist.
            rv.setTextViewText(R.id.wTitle, title);
            rv.setTextViewText(R.id.wArtist, artist);
            Bitmap bmp = decodeArt(art);
            if (bmp != null) rv.setImageViewBitmap(R.id.wArt, bmp);
            else rv.setImageViewResource(R.id.wArt, R.mipmap.ic_launcher);

            // Transport.
            rv.setImageViewResource(R.id.wPlay,
                    playing ? R.drawable.sidecut_ic_pause : R.drawable.sidecut_ic_play);
            rv.setOnClickPendingIntent(R.id.wRoot, pi(ctx, "open", ""));
            rv.setOnClickPendingIntent(R.id.wPrev, pi(ctx, "prev", ""));
            rv.setOnClickPendingIntent(R.id.wPlay, pi(ctx, "playpause", ""));
            rv.setOnClickPendingIntent(R.id.wNext, pi(ctx, "next", ""));

            mgr.updateAppWidget(ids, rv);
        } catch (Exception ignored) {
        }
    }

    private static PendingIntent pi(Context ctx, String action, String extra) {
        Intent i = new Intent(ctx, SideCutWidgetProvider.class)
                .setAction("com.SideCut.myapp.WIDGET_" + action);
        if (extra != null && !extra.isEmpty()) i.putExtra("name", extra);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        int req = (action + "|" + extra).hashCode();
        return PendingIntent.getBroadcast(ctx, req, i, flags);
    }

    private static Bitmap decodeArt(String dataUrl) {
        try {
            if (dataUrl == null || !dataUrl.startsWith("data:")) return null;
            int comma = dataUrl.indexOf(',');
            if (comma < 0) return null;
            String b64 = dataUrl.substring(comma + 1).replaceAll("\\\\s", "");
            byte[] bytes = Base64.decode(b64, Base64.DEFAULT);
            // Downsample so the bitmap stays small: Android ships RemoteViews over
            // a Binder transaction (~1MB cap). A full-res cover overflows that on
            // Android 14+/OnePlus launchers and shows "An error occurred when
            // loading widget". Target ~160-320px, far under the cap.
            BitmapFactory.Options opts = new BitmapFactory.Options();
            opts.inJustDecodeBounds = true;
            BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
            int sample = 1;
            while ((opts.outWidth / sample > 300) || (opts.outHeight / sample > 300)) sample *= 2;
            opts.inJustDecodeBounds = false;
            opts.inSampleSize = sample;
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length, opts);
        } catch (Exception e) {
            return null;
        }
    }

    @Override
    public void onUpdate(Context context, AppWidgetManager appWidgetManager, int[] appWidgetIds) {
        pushAll(context);
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        super.onReceive(context, intent);
        String action = intent.getAction();
        if (action == null) return;
        // App was updated (or resized): redraw every placed widget NOW so users
        // see the new design immediately instead of a stale pre-update render.
        if (action.endsWith("MY_PACKAGE_REPLACED")
                || action.endsWith("APPWIDGET_OPTIONS_CHANGED")
                || action.endsWith("APPWIDGET_UPDATE")) {
            pushAll(context);
            if (action.endsWith("MY_PACKAGE_REPLACED") || action.endsWith("APPWIDGET_OPTIONS_CHANGED")) return;
        }
        if (action.endsWith("_open")) {
            Intent i = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (i != null) context.startActivity(i);
            return;
        }
        if (action.endsWith("_pl")) {
            String name = intent.getStringExtra("name");
            if (name != null && !name.isEmpty()) {
                context.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                        .edit().putString("pendingPlaylist", name).apply();
            }
            return;
        }
        int code = 0;
        if (action.endsWith("_prev")) code = KeyEvent.KEYCODE_MEDIA_PREVIOUS;
        else if (action.endsWith("_next")) code = KeyEvent.KEYCODE_MEDIA_NEXT;
        else if (action.endsWith("_playpause")) code = KeyEvent.KEYCODE_MEDIA_PLAY_PAUSE;
        if (code != 0) {
            try {
                AudioManager am = (AudioManager) context.getSystemService(Context.AUDIO_SERVICE);
                if (am != null) {
                    am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_DOWN, code));
                    am.dispatchMediaKeyEvent(new KeyEvent(KeyEvent.ACTION_UP, code));
                }
            } catch (Exception ignored) {
            }
        }
    }
}
""" % APP_ID

LAYOUT_XML = """<?xml version="1.0" encoding="utf-8"?>
<LinearLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:id="@+id/wRoot"
    android:layout_width="match_parent"
    android:layout_height="match_parent"
    android:orientation="vertical"
    android:padding="7dp"
    android:background="@drawable/sidecut_widget_bg">

    <!-- Playlist pill row (top) -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_horizontal">

        <TextView
            android:id="@+id/wPill0"
            android:layout_width="wrap_content"
            android:layout_height="24dp"
            android:layout_marginEnd="3dp"
            android:background="@drawable/sidecut_pill"
            android:gravity="center"
            android:paddingStart="8dp"
            android:paddingEnd="8dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textSize="9sp"
            android:textColor="#FFFFFF"
            android:text="" />

        <TextView
            android:id="@+id/wPill1"
            android:layout_width="wrap_content"
            android:layout_height="24dp"
            android:layout_marginEnd="3dp"
            android:background="@drawable/sidecut_pill"
            android:gravity="center"
            android:paddingStart="8dp"
            android:paddingEnd="8dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textSize="9sp"
            android:textColor="#FFFFFF"
            android:text="" />

        <TextView
            android:id="@+id/wPill2"
            android:layout_width="wrap_content"
            android:layout_height="24dp"
            android:layout_marginEnd="3dp"
            android:background="@drawable/sidecut_pill"
            android:gravity="center"
            android:paddingStart="8dp"
            android:paddingEnd="8dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textSize="9sp"
            android:textColor="#FFFFFF"
            android:text="" />

        <TextView
            android:id="@+id/wPill3"
            android:layout_width="wrap_content"
            android:layout_height="24dp"
            android:layout_marginEnd="3dp"
            android:background="@drawable/sidecut_pill"
            android:gravity="center"
            android:paddingStart="8dp"
            android:paddingEnd="8dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textSize="9sp"
            android:textColor="#FFFFFF"
            android:text="" />

        <TextView
            android:id="@+id/wPill4"
            android:layout_width="wrap_content"
            android:layout_height="24dp"
            android:background="@drawable/sidecut_pill"
            android:gravity="center"
            android:paddingStart="8dp"
            android:paddingEnd="8dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textSize="9sp"
            android:textColor="#FFFFFF"
            android:text="" />
    </LinearLayout>

    <!-- Track cover, top-left -->
    <ImageView
        android:id="@+id/wArt"
        android:layout_width="42dp"
        android:layout_height="42dp"
        android:layout_marginTop="5dp"
        android:background="@drawable/sidecut_cover_bg"
        android:scaleType="centerCrop"
        android:contentDescription="Album art" />

    <!-- Song name below the cover -->
    <TextView
        android:id="@+id/wTitle"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:layout_marginTop="4dp"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="12sp"
        android:textStyle="bold"
        android:textColor="#FFFFFF"
        android:text="Now playing" />

    <TextView
        android:id="@+id/wArtist"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="10sp"
        android:textColor="#B9C2C6"
        android:text="" />

    <!-- Bottom transport controls -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="0dp"
        android:layout_weight="1"
        android:orientation="horizontal"
        android:gravity="center">

        <ImageView
            android:id="@+id/wPrev"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:src="@drawable/sidecut_ic_prev"
            android:contentDescription="Previous" />

        <ImageView
            android:id="@+id/wPlay"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:src="@drawable/sidecut_ic_play"
            android:contentDescription="Play or pause" />

        <ImageView
            android:id="@+id/wNext"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:src="@drawable/sidecut_ic_next"
            android:contentDescription="Next" />
    </LinearLayout>
</LinearLayout>
"""

BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="16dp" />
    <solid android:color="#DD0E1B1F" />
</shape>
"""

PILL_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="12dp" />
    <solid android:color="#2A3A3F" />
    <stroke android:width="1dp" android:color="#3A4A4F" />
</shape>
"""

PILL_ACTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="12dp" />
    <solid android:color="#F0B7A0" />
</shape>
"""

COVER_BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="8dp" />
    <solid android:color="#2A3A3F" />
    <stroke android:width="1dp" android:color="#3A4A4F" />
</shape>
"""

ICON_TMPL = """<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="22dp"
    android:height="22dp"
    android:viewportWidth="24"
    android:viewportHeight="24">
    <path
        android:fillColor="#FFFFFF"
        android:pathData="%s" />
</vector>
"""

ICONS = {
    "sidecut_ic_play.xml": "M8 5v14l11-7z",
    "sidecut_ic_pause.xml": "M6 5h4v14H6zM14 5h4v14h-4z",
    "sidecut_ic_prev.xml": "M6 6h2v12H6zM20 6l-10 6 10 6z",
    "sidecut_ic_next.xml": "M16 6h2v12h-2zM4 6l10 6-10 6z",
}

WIDGET_INFO_XML = """<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="300dp"
    android:maxResizeHeight="220dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/sidecut_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
"""

# CRITICAL Capacitor 6 ordering: the bridge is built INSIDE super.onCreate()
# (BridgeActivity.onCreate -> load() -> bridgeBuilder.create() -> Bridge()
# constructor -> registerAllPlugins(), which consumes the plugin list).
# Registering the widget plugin AFTER super.onCreate() appends to a list that
# was already iterated — a silent no-op. The plugin must be added to the
# builder list BEFORE super.onCreate() so create() picks it up.
MAIN_ACTIVITY_TMPL = """package %s;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

public class MainActivity extends BridgeActivity {
    public MainActivity() {
        // BridgeActivity.onCreate() consumes `initialPlugins` when it builds the
        // bridge; adding here (constructor) guarantees the widget plugin is in
        // the list BEFORE that happens.
        this.initialPlugins.add(SideCutWidgetPlugin.class);
    }
}
"""

MANIFEST_SNIPPET = """        <receiver
            android:name=".SideCutWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="android.appwidget.action.APPWIDGET_OPTIONS_CHANGED" />
                <!-- After the APK is updated, Android fires this broadcast —
                     the provider re-pushes state so an ALREADY-PLACED widget
                     re-inflates with the new layout immediately, no remove/re-add. -->
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/sidecut_widget_info" />
        </receiver>
"""


def patch_manifest():
    with open(MANIFEST) as f:
        src = f.read()
    if "SideCutWidgetProvider" in src:
        return
    if "</application>" not in src:
        print("ERROR: </application> not found in manifest")
        sys.exit(1)
    src = src.replace("</application>", MANIFEST_SNIPPET + "    </application>", 1)
    with open(MANIFEST, "w") as f:
        f.write(src)
    changed.append("android/app/src/main/AndroidManifest.xml")


def patch_main_activity():
    with open(MAIN_ACTIVITY) as f:
        src = f.read()
    if "SideCutWidgetPlugin" in src:
        # Upgrade any older registration (it was made AFTER super.onCreate(),
        # which is a silent no-op in Capacitor 6: super.onCreate() -> load() ->
        # bridgeBuilder.create() already consumed the plugin list, so the
        # widget plugin never joined the bridge and every JS call failed as
        # "not implemented". Registration MUST happen BEFORE super.onCreate().
        if "initialPlugins.add" in src:
            return
        new_src = MAIN_ACTIVITY_TMPL % APP_ID
        with open(MAIN_ACTIVITY, "w") as f:
            f.write(new_src)
        changed.append("android/app/src/main/java/%s/MainActivity.java (UPGRADED registration order)" % PKG_PATH)
        return
    with open(MAIN_ACTIVITY, "w") as f:
        f.write(MAIN_ACTIVITY_TMPL % APP_ID)
    changed.append("android/app/src/main/java/%s/MainActivity.java" % PKG_PATH)


def main():
    for d in (JAVA_DIR, RES_DIR, MANIFEST, MAIN_ACTIVITY):
        if not os.path.exists(d):
            print("ERROR: missing %s — run this after `npx cap add android`" % d)
            sys.exit(1)
    write(os.path.join(JAVA_DIR, "SideCutWidgetPlugin.java"), PLUGIN_JAVA)
    write(os.path.join(JAVA_DIR, "SideCutWidgetProvider.java"), PROVIDER_JAVA)
    write(os.path.join(RES_DIR, "layout", "sidecut_widget.xml"), LAYOUT_XML)
    write(os.path.join(DRW_DIR, "sidecut_widget_bg.xml"), BG_XML)
    write(os.path.join(DRW_DIR, "sidecut_pill.xml"), PILL_XML)
    write(os.path.join(DRW_DIR, "sidecut_pill_active.xml"), PILL_ACTIVE_XML)
    write(os.path.join(DRW_DIR, "sidecut_cover_bg.xml"), COVER_BG_XML)
    for name, data in ICONS.items():
        write(os.path.join(DRW_DIR, name), ICON_TMPL % data)
    write(os.path.join(RES_DIR, "xml", "sidecut_widget_info.xml"), WIDGET_INFO_XML)
    patch_manifest()
    patch_main_activity()
    print("patch-widget: OK — " + ", ".join(changed))


if __name__ == "__main__":
    main()
