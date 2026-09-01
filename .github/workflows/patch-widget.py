#!/usr/bin/env python3
"""
patch-widget.py — run AFTER `npx cap add android` in CI.

Injects the SideCut 2x2 home-screen widget into the generated android project:
  - SideCutWidgetPlugin.java : Capacitor plugin ("SideCutWidget") that receives
    now-playing state from the web layer (JSON string) and refreshes the widget.
  - SideCutWidgetProvider.java : AppWidgetProvider that renders the widget
    (cover art, title, artist, prev / play-pause / next) and turns button taps
    into media key events routed to the app's active media session.
  - res/layout/sidecut_widget.xml + res/xml/sidecut_widget_info.xml (2x2 cell).
  - AndroidManifest.xml receiver entry (idempotent).
  - MainActivity.java registers the plugin (idempotent).

Idempotent: safe to run on fresh AND already-patched projects.
"""
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))

with open(os.path.join(ROOT, "capacitor.config.json")) as f:
    APP_ID = json.load(f).get("appId", "com.SideCut.myapp")
PKG_PATH = APP_ID.replace(".", "/")
JAVA_DIR = os.path.join(ROOT, "android", "app", "src", "main", "java", PKG_PATH)
RES_DIR = os.path.join(ROOT, "android", "app", "src", "main", "res")
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
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
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
import android.widget.RemoteViews;
import org.json.JSONObject;

public class SideCutWidgetProvider extends AppWidgetProvider {

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
            try {
                JSONObject o = new JSONObject(state);
                title = o.optString("title", "SideCut");
                artist = o.optString("artist", "");
                art = o.optString("art", "");
                playing = o.optBoolean("playing", false);
            } catch (Exception ignored) {}

            RemoteViews rv = new RemoteViews(ctx.getPackageName(), R.layout.sidecut_widget);
            rv.setTextViewText(R.id.wTitle, title);
            rv.setTextViewText(R.id.wArtist, artist);
            Bitmap bmp = decodeArt(art);
            if (bmp != null) rv.setImageViewBitmap(R.id.wArt, bmp);
            else rv.setImageViewResource(R.id.wArt, R.mipmap.ic_launcher);
            rv.setImageViewResource(R.id.wPlay,
                    playing ? android.R.drawable.ic_media_pause : android.R.drawable.ic_media_play);

            rv.setOnClickPendingIntent(R.id.wRoot, pi(ctx, "open"));
            rv.setOnClickPendingIntent(R.id.wPrev, pi(ctx, "prev"));
            rv.setOnClickPendingIntent(R.id.wPlay, pi(ctx, "playpause"));
            rv.setOnClickPendingIntent(R.id.wNext, pi(ctx, "next"));

            mgr.updateAppWidget(ids, rv);
        } catch (Exception ignored) {
        }
    }

    static PendingIntent pi(Context ctx, String action) {
        Intent i = new Intent(ctx, SideCutWidgetProvider.class)
                .setAction("com.SideCut.myapp.WIDGET_" + action);
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE;
        return PendingIntent.getBroadcast(ctx, action.hashCode(), i, flags);
    }

    static Bitmap decodeArt(String dataUrl) {
        try {
            if (dataUrl == null || !dataUrl.startsWith("data:")) return null;
            int comma = dataUrl.indexOf(',');
            if (comma < 0) return null;
            byte[] bytes = Base64.decode(dataUrl.substring(comma + 1), Base64.DEFAULT);
            return BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
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
        if (action.endsWith("_open")) {
            Intent i = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
            if (i != null) context.startActivity(i);
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
    android:gravity="center_horizontal"
    android:padding="8dp"
    android:background="@drawable/sidecut_widget_bg">

    <ImageView
        android:id="@+id/wArt"
        android:layout_width="52dp"
        android:layout_height="52dp"
        android:layout_marginTop="2dp"
        android:scaleType="centerCrop"
        android:contentDescription="Album art" />

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
        android:text="SideCut" />

    <TextView
        android:id="@+id/wArtist"
        android:layout_width="match_parent"
        android:layout_height="wrap_content"
        android:maxLines="1"
        android:ellipsize="end"
        android:textSize="10sp"
        android:textColor="#B0B0B0"
        android:text="" />

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
            android:src="@android:drawable/ic_media_previous"
            android:contentDescription="Previous" />

        <ImageView
            android:id="@+id/wPlay"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:src="@android:drawable/ic_media_play"
            android:contentDescription="Play or pause" />

        <ImageView
            android:id="@+id/wNext"
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:src="@android:drawable/ic_media_next"
            android:contentDescription="Next" />
    </LinearLayout>
</LinearLayout>
"""

BG_XML = """<?xml version="1.0" encoding="utf-8"?>
<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">
    <corners android:radius="16dp" />
    <solid android:color="#CC0E1B1F" />
</shape>
"""

WIDGET_INFO_XML = """<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="110dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="250dp"
    android:maxResizeHeight="180dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/sidecut_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
"""

MANIFEST_SNIPPET = """        <receiver
            android:name=".SideCutWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
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
        return
    new_src = """package %s;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        registerPlugin(SideCutWidgetPlugin.class);
    }
}
""" % APP_ID
    with open(MAIN_ACTIVITY, "w") as f:
        f.write(new_src)
    changed.append("android/app/src/main/java/%s/MainActivity.java" % PKG_PATH)


def main():
    for d in (JAVA_DIR, RES_DIR, MANIFEST, MAIN_ACTIVITY):
        if not os.path.exists(d):
            print("ERROR: missing %s — run this after `npx cap add android`" % d)
            sys.exit(1)
    write(os.path.join(JAVA_DIR, "SideCutWidgetPlugin.java"), PLUGIN_JAVA)
    write(os.path.join(JAVA_DIR, "SideCutWidgetProvider.java"), PROVIDER_JAVA)
    write(os.path.join(RES_DIR, "layout", "sidecut_widget.xml"), LAYOUT_XML)
    write(os.path.join(RES_DIR, "drawable", "sidecut_widget_bg.xml"), BG_XML)
    write(os.path.join(RES_DIR, "xml", "sidecut_widget_info.xml"), WIDGET_INFO_XML)
    patch_manifest()
    patch_main_activity()
    print("patch-widget: OK — " + ", ".join(changed))


if __name__ == "__main__":
    main()
