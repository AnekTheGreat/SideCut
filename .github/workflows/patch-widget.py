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
    widget (cover art top-left, song title + artist below, prev / play-pause /
    next; an extra PLAYLIST PILL ROW appears when the widget is EXPANDED) and
    turns button taps into media key events routed to the media session.
  - User-themeable: the web layer sends a "theme" object inside update() -
    bg (bg1/bg2 gradient + radius), accent for the active pill, title/artist
    text colors. All colors are applied at render time via RemoteViews.
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
        String theme = call.getString("theme");
        Context ctx = getContext();
        android.content.SharedPreferences.Editor ed = ctx
                .getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE).edit();
        ed.putString("state", data);
        if (theme != null && !theme.isEmpty()) ed.putString("theme", theme);
        ed.apply();
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
import org.json.JSONObject;

public class SideCutWidgetProvider extends AppWidgetProvider {

    // ---- Theme helpers (Widget settings tab persists colors via the plugin) ----
    static JSONObject readTheme(Context ctx) {
        try {
            String raw = ctx.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getString("theme", "{}");
            return new JSONObject(raw);
        } catch (Exception e) {
            return new JSONObject();
        }
    }

    // "#RRGGBB" / "#AARRGGBB" -> Android int. Invalid input falls back to def.
    static long parseColor(String s) {
        try { return 0xFFFFFFFFL & android.graphics.Color.parseColor(s); }
        catch (Exception e) { return -1L; }
    }

    // True when the home-screen widget is resized taller than its 2x2 target.
    static boolean isExpanded(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            if (mgr == null) return false;
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SideCutWidgetProvider.class));
            if (ids == null) return false;
            for (int id : ids) {
                android.os.Bundle o = mgr.getAppWidgetOptions(id);
                if (o == null) continue;
                int h = o.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 0);
                if (h > 0 && h < 9999 && h > 2 * 62) return true; // ~62dp per 2x2 cell row
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    // Renders the themeable gradient (bg1 -> bg2, rounded corners) as a small
    // bitmap. Downsampled on purpose: it is stretched to the widget bounds and
    // must stay far under the ~1MB Binder transaction cap.
    static Bitmap makeBgBitmap(String c1, String c2) {
        try {
            int w = 240, h = 240, r = 26;
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            android.graphics.Canvas cv = new android.graphics.Canvas(bmp);
            android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
            p.setShader(new android.graphics.LinearGradient(
                    0, 0, w, h,
                    (int) parseColor(c1), (int) parseColor(c2),
                    android.graphics.Shader.TileMode.CLAMP));
            cv.drawRoundRect(new android.graphics.RectF(0, 0, w, h), r, r, p);
            return bmp;
        } catch (Exception e) {
            return null;
        }
    }

    // Solid rounded-rect bitmap for playlist pill backgrounds (accent-themeable).
    static Bitmap pillBitmap(int color) {
        try {
            int w = 160, h = 44, r = 22;
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            android.graphics.Canvas cv = new android.graphics.Canvas(bmp);
            android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
            p.setColor(color);
            cv.drawRoundRect(new android.graphics.RectF(0, 0, w, h), r, r, p);
            return bmp;
        } catch (Exception e) {
            return null;
        }
    }

    static void pushAll(Context ctx) {
        try {
            AppWidgetManager mgr = AppWidgetManager.getInstance(ctx);
            if (mgr == null) return;
            int[] ids = mgr.getAppWidgetIds(new ComponentName(ctx, SideCutWidgetProvider.class));
            if (ids == null || ids.length == 0) return;

            String stateJson = ctx.getSharedPreferences("sidecut_widget", Context.MODE_PRIVATE)
                    .getString("state", "{}");
            String title = "SideCut";
            String artist = "";
            String art = "";
            boolean playing = false;
            try {
                JSONObject o = new JSONObject(stateJson);
                title = o.optString("title", "SideCut");
                artist = o.optString("artist", "");
                art = o.optString("art", "");
                playing = o.optBoolean("playing", false);
            } catch (Exception ignored) {}

            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.sidecut_widget);

            // User theme (from the Widget settings tab, persisted in prefs).
            JSONObject th = readTheme(ctx);

            // Background: user-themeable gradient, rendered as a bitmap onto
            // the wBg ImageView (RemoteViews cannot take arbitrary drawables,
            // but setImageViewBitmap works on every API level).
            rv.setImageViewBitmap(R.id.wBg, makeBgBitmap(
                    th.optString("bg1", "#141821"),
                    th.optString("bg2", "#0A0B0E")));

            // Cover art / title / artist - themeable text colors.
            rv.setTextViewText(R.id.wTitle, title);
            rv.setTextColor(R.id.wTitle, (int) parseColor(th.optString("title", "#FFFFFF")));
            rv.setTextViewText(R.id.wArtist, artist);
            rv.setTextColor(R.id.wArtist, (int) parseColor(th.optString("artist", "#B9BDC7")));
            Bitmap bmp = decodeArt(art);
            if (bmp != null) rv.setImageViewBitmap(R.id.wArt, bmp);
            else rv.setImageViewResource(R.id.wArt, R.mipmap.ic_launcher);

            // Transport (always white icons).
            rv.setImageViewResource(R.id.wPlay,
                    playing ? R.drawable.sidecut_ic_pause : R.drawable.sidecut_ic_play);
            rv.setOnClickPendingIntent(R.id.wRoot, pi(ctx, "open", ""));
            rv.setOnClickPendingIntent(R.id.wPrev, pi(ctx, "prev", ""));
            rv.setOnClickPendingIntent(R.id.wPlay, pi(ctx, "playpause", ""));
            rv.setOnClickPendingIntent(R.id.wNext, pi(ctx, "next", ""));

            // Playlist pill row: shown only when the widget is EXPANDED
            // (taller than 2 cells). Collapsed widgets keep the clean 2x2 look.
            JSONObject state = null;
            try { state = new JSONObject(stateJson); } catch (Exception ignored) {}
            org.json.JSONArray pls = (state != null) ? state.optJSONArray("playlists") : null;
            String act = (state != null) ? state.optString("active", "") : "";
            boolean showPills = isExpanded(ctx) && pls != null && pls.length() > 0;
            rv.setViewVisibility(R.id.wPillsRow, showPills ? View.VISIBLE : View.GONE);
            if (showPills) {
                int acc = (int) parseColor(th.optString("accent", "#E3B23C"));
                int accInk = (int) parseColor(th.optString("accentText", "#1A1305"));
                int pillBg = (int) parseColor(th.optString("pill", "#1C1F26"));
                int pillText = (int) parseColor(th.optString("pillText", "#DDDEE3"));
                int[] pillWraps = { R.id.wPillWrap0, R.id.wPillWrap1, R.id.wPillWrap2, R.id.wPillWrap3 };
                int[] pillBgs = { R.id.wPillBg0, R.id.wPillBg1, R.id.wPillBg2, R.id.wPillBg3 };
                int[] pillIds = { R.id.wPill0, R.id.wPill1, R.id.wPill2, R.id.wPill3 };
                for (int i = 0; i < pillIds.length; i++) {
                    String name = (i < pls.length()) ? pls.optString(i, "") : "";
                    if (name.isEmpty()) { rv.setViewVisibility(pillWraps[i], View.GONE); continue; }
                    boolean isActive = name.equals(act);
                    rv.setImageViewBitmap(pillBgs[i], pillBitmap(isActive ? acc : pillBg));
                    rv.setTextViewText(pillIds[i], name);
                    rv.setTextColor(pillIds[i], isActive ? accInk : pillText);
                    rv.setViewVisibility(pillWraps[i], View.VISIBLE);
                    rv.setOnClickPendingIntent(pillWraps[i], pi(ctx, "pl", name));
                }
            }

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
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

    <!-- Themeable gradient background, sized to the widget bounds -->
    <ImageView
        android:id="@+id/wBg"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:scaleType="fitXY"
        android:importantForAccessibility="no"
        android:contentDescription="@null" />

    <LinearLayout
        android:id="@+id/wRoot"
        android:layout_width="match_parent"
        android:layout_height="match_parent"
        android:orientation="vertical"
        android:padding="7dp">

    <!-- Playlist pills: hidden on the 2x2 layout, shown when EXPANDED -->
    <LinearLayout
        android:id="@+id/wPillsRow"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:visibility="gone">

        <FrameLayout
            android:id="@+id/wPillWrap0"
            android:layout_width="0dp"
            android:layout_height="26dp"
            android:layout_weight="1"
            android:layout_marginEnd="4dp"
            android:visibility="gone">
            <ImageView
                android:id="@+id/wPillBg0"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:scaleType="fitXY"
                android:importantForAccessibility="no"
                android:contentDescription="@null" />
            <TextView
                android:id="@+id/wPill0"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="center"
                android:maxLines="1"
                android:ellipsize="end"
                android:paddingHorizontal="8dp"
                android:textSize="10sp"
                android:textColor="#DDDEE3"
                android:text="" />
        </FrameLayout>

        <FrameLayout
            android:id="@+id/wPillWrap1"
            android:layout_width="0dp"
            android:layout_height="26dp"
            android:layout_weight="1"
            android:layout_marginEnd="4dp"
            android:visibility="gone">
            <ImageView
                android:id="@+id/wPillBg1"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:scaleType="fitXY"
                android:importantForAccessibility="no"
                android:contentDescription="@null" />
            <TextView
                android:id="@+id/wPill1"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="center"
                android:maxLines="1"
                android:ellipsize="end"
                android:paddingHorizontal="8dp"
                android:textSize="10sp"
                android:textColor="#DDDEE3"
                android:text="" />
        </FrameLayout>

        <FrameLayout
            android:id="@+id/wPillWrap2"
            android:layout_width="0dp"
            android:layout_height="26dp"
            android:layout_weight="1"
            android:layout_marginEnd="4dp"
            android:visibility="gone">
            <ImageView
                android:id="@+id/wPillBg2"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:scaleType="fitXY"
                android:importantForAccessibility="no"
                android:contentDescription="@null" />
            <TextView
                android:id="@+id/wPill2"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="center"
                android:maxLines="1"
                android:ellipsize="end"
                android:paddingHorizontal="8dp"
                android:textSize="10sp"
                android:textColor="#DDDEE3"
                android:text="" />
        </FrameLayout>

        <FrameLayout
            android:id="@+id/wPillWrap3"
            android:layout_width="0dp"
            android:layout_height="26dp"
            android:layout_weight="1"
            android:visibility="gone">
            <ImageView
                android:id="@+id/wPillBg3"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:scaleType="fitXY"
                android:importantForAccessibility="no"
                android:contentDescription="@null" />
            <TextView
                android:id="@+id/wPill3"
                android:layout_width="match_parent"
                android:layout_height="match_parent"
                android:gravity="center"
                android:maxLines="1"
                android:ellipsize="end"
                android:paddingHorizontal="8dp"
                android:textSize="10sp"
                android:textColor="#DDDEE3"
                android:text="" />
        </FrameLayout>
    </LinearLayout>

    <!-- Track cover, top-left -->
    <ImageView
        android:id="@+id/wArt"
        android:layout_width="46dp"
        android:layout_height="46dp"
        android:layout_marginTop="2dp"
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
        android:textColor="#F5E7D3"
        android:text="Now playing" />

    <TextView
        android:id="@+id/wArtist"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="10sp"
        android:textColor="#CBB89B"
        android:text="" />

    <!-- Bottom transport controls: fixed-height (40dp) rows so each button is a
         big, reliable tap target. Larger icons + full-width cells mean a tap
         lands on prev/play/next instead of falling through to open the app. -->
    <LinearLayout
        android:layout_width="match_parent"
        android:layout_height="40dp"
        android:orientation="horizontal"
        android:gravity="center_vertical">

        <ImageView
            android:id="@+id/wPrev"
            android:layout_width="0dp"
            android:layout_height="40dp"
            android:layout_weight="1"
            android:padding="5dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_prev"
            android:contentDescription="Previous" />

        <ImageView
            android:id="@+id/wPlay"
            android:layout_width="0dp"
            android:layout_height="40dp"
            android:layout_weight="1"
            android:padding="5dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_play"
            android:contentDescription="Play or pause" />

        <ImageView
            android:id="@+id/wNext"
            android:layout_width="0dp"
            android:layout_height="40dp"
            android:layout_weight="1"
            android:padding="5dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_next"
            android:contentDescription="Next" />
    </LinearLayout>
    </LinearLayout>
</FrameLayout>
"""

BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="16dp" />
    <solid android:color="#FF0A0B0E" />
</shape>
"""

PILL_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="12dp" />
    <solid android:color="#16181C" />
    <stroke android:width="1dp" android:color="#2A2D33" />
</shape>
"""

PILL_ACTIVE_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="12dp" />
    <solid android:color="#E3B23C" />
</shape>
"""

COVER_BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="8dp" />
    <solid android:color="#16181C" />
    <stroke android:width="1dp" android:color="#2A2D33" />
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
