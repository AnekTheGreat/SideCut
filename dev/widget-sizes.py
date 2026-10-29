#!/usr/bin/env python3
"""80.6.7 - the widget fits the size it is given.

WHERE THIS LIVES, AND WHY NOT IN patch-widget.py. That file is under
`.github/workflows/`, and GitHub refuses any commit from an Actions token that
touches that directory - so a release CANNOT ship a change to it. This file is
under dev/, which a release commits normally, and android-build.yml runs it right
after patch-widget.py has generated the android project. Everything below edits
what that generator wrote; nothing here is needed to build the widget from
scratch, but the build is not finished until this has run.

WHAT IT DOES. Four placements, four layouts, chosen per placement from the
launcher's own options bundle:

  compact  4x1  one row: cover, title/artist, transport - no timeline
  wide     4x2  cover left, text and timeline in the middle, transport right
  tall     2x4  96dp cover, 15sp title, timeline, 48dp transport
  regular  2x2  the column that has always been there, now with hidden
                timeline views so one push body can paint all four

The wide and tall shapes draw a progress bar and both clock readings. The bar is
an ImageView fed a generated strip, not a ProgressBar: a RemoteViews ProgressBar
cannot be tinted per theme (setProgressTintList takes a ColorStateList, which
setInt cannot carry), so the accent is drawn into the bitmap instead.

The two numbers come from the web payload - this release adds `pos` and `dur` to
the object that already carried title, artist, art, playing, seq and pulse.

Idempotent: the provider is left alone once it carries the 80.6.7 marker.

    python3 dev/widget-sizes.py
"""
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..'))
MARKER = '80.6.7: the widget fits the size it is given'

with open(os.path.join(ROOT, 'capacitor.config.json')) as f:
    APP_ID = json.load(f).get('appId', 'com.SideCut.myapp')
PKG_PATH = APP_ID.replace('.', '/')
PROVIDER = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'java', PKG_PATH,
                        'SideCutWidgetProvider.java')
RES = os.path.join(ROOT, 'android', 'app', 'src', 'main', 'res')

COMPACT_XML = """<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

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
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:paddingStart="10dp"
        android:paddingEnd="6dp">

        <ImageView
            android:id="@+id/wArt"
            android:layout_width="38dp"
            android:layout_height="38dp"
            android:background="@drawable/sidecut_cover_bg"
            android:scaleType="centerCrop"
            android:contentDescription="Album art" />

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="9dp"
            android:layout_marginEnd="4dp"
            android:orientation="vertical">

            <TextView
                android:id="@+id/wTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:textSize="12sp"
                android:textStyle="bold"
                android:textColor="#FFFFFF"
                android:text="Now playing" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <TextView
                    android:id="@+id/wArtist"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:maxLines="1"
                    android:ellipsize="end"
                    android:textSize="10sp"
                    android:textColor="#B9BDC7"
                    android:text="" />

                <LinearLayout
                    android:id="@+id/wEqWrap"
                    android:layout_width="wrap_content"
                    android:layout_height="10dp"
                    android:orientation="horizontal"
                    android:gravity="bottom"
                    android:visibility="gone"
                    android:layout_marginStart="6dp">
                    <ImageView
                        android:id="@+id/wEq1"
                        android:layout_width="3dp"
                        android:layout_height="5dp"
                        android:layout_marginEnd="2dp"
                        android:src="@drawable/sidecut_eq_bar"
                        android:contentDescription="@null" />
                    <ImageView
                        android:id="@+id/wEq2"
                        android:layout_width="3dp"
                        android:layout_height="9dp"
                        android:layout_marginEnd="2dp"
                        android:src="@drawable/sidecut_eq_bar"
                        android:contentDescription="@null" />
                    <ImageView
                        android:id="@+id/wEq3"
                        android:layout_width="3dp"
                        android:layout_height="7dp"
                        android:src="@drawable/sidecut_eq_bar"
                        android:contentDescription="@null" />
                </LinearLayout>
            </LinearLayout>
        </LinearLayout>

        <ImageView
            android:id="@+id/wPrev"
            android:layout_width="36dp"
            android:layout_height="36dp"
            android:padding="6dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_prev"
            android:contentDescription="Previous" />

        <ImageView
            android:id="@+id/wPlay"
            android:layout_width="36dp"
            android:layout_height="36dp"
            android:padding="6dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_play"
            android:contentDescription="Play or pause" />

        <ImageView
            android:id="@+id/wNext"
            android:layout_width="36dp"
            android:layout_height="36dp"
            android:padding="6dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_next"
            android:contentDescription="Next" />

        <ImageView
            android:id="@+id/wBar"
            android:layout_width="0dp"
            android:layout_height="0dp"
            android:visibility="gone"
            android:contentDescription="@null" />

        <TextView
            android:id="@+id/wPos"
            android:layout_width="0dp"
            android:layout_height="0dp"
            android:visibility="gone"
            android:text="" />

        <TextView
            android:id="@+id/wDur"
            android:layout_width="0dp"
            android:layout_height="0dp"
            android:visibility="gone"
            android:text="" />
    </LinearLayout>
</FrameLayout>
"""

WIDE_XML = """<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

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
        android:orientation="horizontal"
        android:gravity="center_vertical"
        android:padding="11dp">

        <ImageView
            android:id="@+id/wArt"
            android:layout_width="56dp"
            android:layout_height="56dp"
            android:background="@drawable/sidecut_cover_bg"
            android:scaleType="centerCrop"
            android:contentDescription="Album art" />

        <LinearLayout
            android:layout_width="0dp"
            android:layout_height="wrap_content"
            android:layout_weight="1"
            android:layout_marginStart="11dp"
            android:layout_marginEnd="8dp"
            android:orientation="vertical">

            <TextView
                android:id="@+id/wTitle"
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:maxLines="1"
                android:ellipsize="end"
                android:textSize="13sp"
                android:textStyle="bold"
                android:textColor="#FFFFFF"
                android:text="Now playing" />

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <TextView
                    android:id="@+id/wArtist"
                    android:layout_width="0dp"
                    android:layout_height="wrap_content"
                    android:layout_weight="1"
                    android:maxLines="1"
                    android:ellipsize="end"
                    android:textSize="10sp"
                    android:textColor="#B9BDC7"
                    android:text="" />

                <LinearLayout
                    android:id="@+id/wEqWrap"
                    android:layout_width="wrap_content"
                    android:layout_height="12dp"
                    android:orientation="horizontal"
                    android:gravity="bottom"
                    android:visibility="gone"
                    android:layout_marginStart="6dp">
                    <ImageView
                        android:id="@+id/wEq1"
                        android:layout_width="3dp"
                        android:layout_height="6dp"
                        android:layout_marginEnd="2dp"
                        android:src="@drawable/sidecut_eq_bar"
                        android:contentDescription="@null" />
                    <ImageView
                        android:id="@+id/wEq2"
                        android:layout_width="3dp"
                        android:layout_height="11dp"
                        android:layout_marginEnd="2dp"
                        android:src="@drawable/sidecut_eq_bar"
                        android:contentDescription="@null" />
                    <ImageView
                        android:id="@+id/wEq3"
                        android:layout_width="3dp"
                        android:layout_height="8dp"
                        android:src="@drawable/sidecut_eq_bar"
                        android:contentDescription="@null" />
                </LinearLayout>
            </LinearLayout>

            <LinearLayout
                android:layout_width="match_parent"
                android:layout_height="wrap_content"
                android:layout_marginTop="7dp"
                android:orientation="horizontal"
                android:gravity="center_vertical">

                <ImageView
                    android:id="@+id/wBar"
                    android:layout_width="0dp"
                    android:layout_height="4dp"
                    android:layout_weight="1"
                    android:scaleType="fitXY"
                    android:visibility="gone"
                    android:contentDescription="@null" />

                <TextView
                    android:id="@+id/wPos"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="7dp"
                    android:textSize="9sp"
                    android:textColor="#B9BDC7"
                    android:visibility="gone"
                    android:text="" />

                <TextView
                    android:id="@+id/wDur"
                    android:layout_width="wrap_content"
                    android:layout_height="wrap_content"
                    android:layout_marginStart="5dp"
                    android:textSize="9sp"
                    android:textColor="#B9BDC7"
                    android:visibility="gone"
                    android:text="" />
            </LinearLayout>
        </LinearLayout>

        <ImageView
            android:id="@+id/wPrev"
            android:layout_width="38dp"
            android:layout_height="38dp"
            android:padding="6dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_prev"
            android:contentDescription="Previous" />

        <ImageView
            android:id="@+id/wPlay"
            android:layout_width="38dp"
            android:layout_height="38dp"
            android:padding="6dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_play"
            android:contentDescription="Play or pause" />

        <ImageView
            android:id="@+id/wNext"
            android:layout_width="38dp"
            android:layout_height="38dp"
            android:padding="6dp"
            android:scaleType="center"
            android:src="@drawable/sidecut_ic_next"
            android:contentDescription="Next" />
    </LinearLayout>
</FrameLayout>
"""

TALL_XML = """<?xml version="1.0" encoding="utf-8"?>
<FrameLayout xmlns:android="http://schemas.android.com/apk/res/android"
    android:layout_width="match_parent"
    android:layout_height="match_parent">

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
        android:padding="12dp">

        <ImageView
            android:id="@+id/wArt"
            android:layout_width="96dp"
            android:layout_height="96dp"
            android:background="@drawable/sidecut_cover_bg"
            android:scaleType="centerCrop"
            android:contentDescription="Album art" />

        <TextView
            android:id="@+id/wTitle"
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="10dp"
            android:maxLines="1"
            android:ellipsize="end"
            android:textSize="15sp"
            android:textStyle="bold"
            android:textColor="#FFFFFF"
            android:text="Now playing" />

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <TextView
                android:id="@+id/wArtist"
                android:layout_width="0dp"
                android:layout_height="wrap_content"
                android:layout_weight="1"
                android:maxLines="1"
                android:ellipsize="end"
                android:textSize="11sp"
                android:textColor="#B9BDC7"
                android:text="" />

            <LinearLayout
                android:id="@+id/wEqWrap"
                android:layout_width="wrap_content"
                android:layout_height="13dp"
                android:orientation="horizontal"
                android:gravity="bottom"
                android:visibility="gone"
                android:layout_marginStart="6dp">
                <ImageView
                    android:id="@+id/wEq1"
                    android:layout_width="3dp"
                    android:layout_height="7dp"
                    android:layout_marginEnd="2dp"
                    android:src="@drawable/sidecut_eq_bar"
                    android:contentDescription="@null" />
                <ImageView
                    android:id="@+id/wEq2"
                    android:layout_width="3dp"
                    android:layout_height="12dp"
                    android:layout_marginEnd="2dp"
                    android:src="@drawable/sidecut_eq_bar"
                    android:contentDescription="@null" />
                <ImageView
                    android:id="@+id/wEq3"
                    android:layout_width="3dp"
                    android:layout_height="9dp"
                    android:src="@drawable/sidecut_eq_bar"
                    android:contentDescription="@null" />
            </LinearLayout>
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="wrap_content"
            android:layout_marginTop="10dp"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <ImageView
                android:id="@+id/wBar"
                android:layout_width="0dp"
                android:layout_height="5dp"
                android:layout_weight="1"
                android:scaleType="fitXY"
                android:visibility="gone"
                android:contentDescription="@null" />

            <TextView
                android:id="@+id/wPos"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="8dp"
                android:textSize="10sp"
                android:textColor="#B9BDC7"
                android:visibility="gone"
                android:text="" />

            <TextView
                android:id="@+id/wDur"
                android:layout_width="wrap_content"
                android:layout_height="wrap_content"
                android:layout_marginStart="5dp"
                android:textSize="10sp"
                android:textColor="#B9BDC7"
                android:visibility="gone"
                android:text="" />
        </LinearLayout>

        <LinearLayout
            android:layout_width="match_parent"
            android:layout_height="48dp"
            android:layout_marginTop="8dp"
            android:orientation="horizontal"
            android:gravity="center_vertical">

            <ImageView
                android:id="@+id/wPrev"
                android:layout_width="0dp"
                android:layout_height="48dp"
                android:layout_weight="1"
                android:padding="6dp"
                android:scaleType="center"
                android:src="@drawable/sidecut_ic_prev"
                android:contentDescription="Previous" />

            <ImageView
                android:id="@+id/wPlay"
                android:layout_width="0dp"
                android:layout_height="48dp"
                android:layout_weight="1"
                android:padding="6dp"
                android:scaleType="center"
                android:src="@drawable/sidecut_ic_play"
                android:contentDescription="Play or pause" />

            <ImageView
                android:id="@+id/wNext"
                android:layout_width="0dp"
                android:layout_height="48dp"
                android:layout_weight="1"
                android:padding="6dp"
                android:scaleType="center"
                android:src="@drawable/sidecut_ic_next"
                android:contentDescription="Next" />
        </LinearLayout>
    </LinearLayout>
</FrameLayout>
"""

HIDDEN_VIEWS = """    <!-- 80.6.7 - THE TIMELINE'S THREE VIEWS, HIDDEN. This shape has no room for a
         progress bar, but the push body paints every layout with the same calls:
         setViewVisibility on an id this file did not carry would throw and take
         the whole repaint with it. Present, GONE, zero-sized. -->
    <ImageView
        android:id="@+id/wBar"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:visibility="gone"
        android:contentDescription="@null" />

    <TextView
        android:id="@+id/wPos"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:visibility="gone"
        android:text="" />

    <TextView
        android:id="@+id/wDur"
        android:layout_width="0dp"
        android:layout_height="0dp"
        android:visibility="gone"
        android:text="" />

"""

INFO_XML = """<?xml version="1.0" encoding="utf-8"?>
<appwidget-provider xmlns:android="http://schemas.android.com/apk/res/android"
    android:minWidth="110dp"
    android:minHeight="40dp"
    android:targetCellWidth="2"
    android:targetCellHeight="2"
    android:maxResizeWidth="340dp"
    android:maxResizeHeight="340dp"
    android:updatePeriodMillis="0"
    android:initialLayout="@layout/sidecut_widget"
    android:resizeMode="horizontal|vertical"
    android:widgetCategory="home_screen" />
"""

JAVA_NEW = """    // ---- 80.6.7: the widget fits the size it is given ----------------------
    // A launcher reports how big a placement is in its options bundle, and this
    // used to ignore it: every placement drew the 2x2 column at whatever size it
    // had, so a 4x1 squashed the cover and a 2x4 left a lake of gradient under the
    // transport row. Four layouts now, chosen per placement, and they all carry
    // the SAME ids so one push body can paint any of them.
    static final String SIZE_COMPACT = "compact";
    static final String SIZE_WIDE = "wide";
    static final String SIZE_TALL = "tall";

    static int layoutFor(String size) {
        if (SIZE_COMPACT.equals(size)) return R.layout.sidecut_widget_compact;
        if (SIZE_WIDE.equals(size)) return R.layout.sidecut_widget_wide;
        if (SIZE_TALL.equals(size)) return R.layout.sidecut_widget_tall;
        return R.layout.sidecut_widget;
    }

    static String sizeClass(AppWidgetManager mgr, int id) {
        int w = 110, h = 110;
        try {
            android.os.Bundle opts = mgr.getAppWidgetOptions(id);
            if (opts != null) {
                w = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 110);
                // MAX_HEIGHT is the tall side of the placement; MIN_HEIGHT is the
                // portrait one and is 0 for some launchers, so it is only a fallback.
                h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT, 110);
                if (h <= 0) h = opts.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110);
                if (w <= 0) w = 110;
            }
        } catch (Exception ignored) {}
        // Height first: a 4x1 is wide AND short, and the row is the shape that fits
        // it. Then tall (2x4, 2x3), then wide (4x2, 4x3), then the 2x2 column.
        if (h < 100) return SIZE_COMPACT;
        if (h >= 180) return SIZE_TALL;
        if (w >= 200) return SIZE_WIDE;
        return "regular";
    }

    static String fmtTime(int sec) {
        if (sec < 0) sec = 0;
        int m = sec / 60;
        int s = sec - m * 60;
        return m + ":" + (s < 10 ? "0" : "") + s;
    }

    // A themed progress bar. RemoteViews cannot tint a ProgressBar per theme
    // (setProgressTintList takes a ColorStateList, which setInt cannot carry), so
    // the bar is an ImageView fed a small strip: a dim track with the accent drawn
    // over the played fraction. The theme's accent therefore reaches the timeline
    // with no API-level workaround.
    static Bitmap makeBarBitmap(int accent, float frac) {
        try {
            int w = 200, h = 8, r = 4;
            Bitmap bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888);
            android.graphics.Canvas cv = new android.graphics.Canvas(bmp);
            android.graphics.Paint p = new android.graphics.Paint(android.graphics.Paint.ANTI_ALIAS_FLAG);
            p.setColor((accent & 0x00FFFFFF) | 0x3D000000);
            cv.drawRoundRect(new android.graphics.RectF(0, 0, w, h), r, r, p);
            float x = (frac < 0f ? 0f : (frac > 1f ? 1f : frac)) * w;
            if (x > h) {
                p.setColor(accent);
                cv.drawRoundRect(new android.graphics.RectF(0, 0, x, h), r, r, p);
            }
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
            int pos = 0, dur = 0;
            JSONObject o = null;
            try {
                o = new JSONObject(stateJson);
                title = o.optString("title", "SideCut");
                artist = o.optString("artist", "");
                art = o.optString("art", "");
                playing = o.optBoolean("playing", false);
                pos = o.optInt("pos", 0);
                dur = o.optInt("dur", 0);
            } catch (Exception ignored) {}

            // User theme (from the Widget settings tab, persisted in prefs).
            JSONObject th = readTheme(ctx);
            // 71.5 - "Playing bars" off: the heartbeat is never drawn. The
            // plugin also refuses to start the repaint loop, so a hidden
            // heartbeat does not redraw the widget twice a second either.
            boolean bars = th.optBoolean("eq", true);
            int accent = (int) parseColor(th.optString("accent", "#E3B23C"));
            int titleCol = (int) parseColor(th.optString("title", "#FFFFFF"));
            int artistCol = (int) parseColor(th.optString("artist", "#B9BDC7"));

            // Background and cover: identical for every placement, so they are
            // built once per push rather than once per placement.
            Bitmap bg = makeBgBitmap(
                    th.optString("bg1", "#141821"),
                    th.optString("bg2", "#0A0B0E"));
            Bitmap bmp;
            if (art != null && art.equals(sArtKey)) {
                bmp = sArtBmp;
            } else {
                bmp = decodeArt(art);
                sArtKey = art;
                sArtBmp = bmp;
            }

            // Playing equalizer animation: three fixed-height bars (themed
            // accent) that pulse by toggling visibility in a wave while a track
            // plays. The web layer sends a monotonic "pulse" every heartbeat, so
            // the bars keep moving. Only supported RemoteViews calls are used
            // (setViewVisibility / setInt -> setColorFilter) so it always compiles.
            int pulse = 0;
            if (o != null) { try { pulse = o.optInt("pulse", 0); } catch (Exception ignored) {} }
            // While playing, the self-driving loop owns the frame - its phase
            // advances every EQ_FRAME_MS even when the web heartbeat is asleep.
            if (playing && bars && animPhase >= 0) pulse = animPhase;

            Bitmap bar = null;
            float frac = 0f;
            if (dur > 0) {
                frac = (float) pos / (float) dur;
                bar = makeBarBitmap(accent, frac);
            }

            for (int i = 0; i < ids.length; i++) {
                int id = ids[i];
                String size = sizeClass(mgr, id);
                // The 4x1 row has no room for a timeline; the roomier ones do.
                boolean timeline = !SIZE_COMPACT.equals(size) && dur > 0 && bar != null;
                RemoteViews rv = new RemoteViews(ctx.getPackageName(), layoutFor(size));

                if (bg != null) rv.setImageViewBitmap(R.id.wBg, bg);

                // Cover art / title / artist - themeable text colors.
                if (bmp != null) rv.setImageViewBitmap(R.id.wArt, bmp);
                else rv.setImageViewResource(R.id.wArt, R.mipmap.ic_launcher);
                rv.setTextViewText(R.id.wTitle, title);
                rv.setTextColor(R.id.wTitle, titleCol);
                rv.setTextViewText(R.id.wArtist, artist);
                rv.setTextColor(R.id.wArtist, artistCol);

                if (playing && bars) {
                    rv.setViewVisibility(R.id.wEqWrap, android.view.View.VISIBLE);
                    int ph = ((pulse % 4) + 4) % 4;
                    int[] v = EQ_WAVE[ph];
                    rv.setViewVisibility(R.id.wEq1, v[0]);
                    rv.setViewVisibility(R.id.wEq2, v[1]);
                    rv.setViewVisibility(R.id.wEq3, v[2]);
                    rv.setInt(R.id.wEq1, "setColorFilter", accent);
                    rv.setInt(R.id.wEq2, "setColorFilter", accent);
                    rv.setInt(R.id.wEq3, "setColorFilter", accent);
                } else {
                    rv.setViewVisibility(R.id.wEqWrap, android.view.View.GONE);
                }

                if (timeline) {
                    rv.setImageViewBitmap(R.id.wBar, bar);
                    rv.setViewVisibility(R.id.wBar, android.view.View.VISIBLE);
                    rv.setTextViewText(R.id.wPos, fmtTime(pos));
                    rv.setTextViewText(R.id.wDur, fmtTime(dur));
                    rv.setTextColor(R.id.wPos, artistCol);
                    rv.setTextColor(R.id.wDur, artistCol);
                    rv.setViewVisibility(R.id.wPos, android.view.View.VISIBLE);
                    rv.setViewVisibility(R.id.wDur, android.view.View.VISIBLE);
                } else {
                    rv.setViewVisibility(R.id.wBar, android.view.View.GONE);
                    rv.setViewVisibility(R.id.wPos, android.view.View.GONE);
                    rv.setViewVisibility(R.id.wDur, android.view.View.GONE);
                }

                // Transport (always white icons).
                rv.setImageViewResource(R.id.wPlay,
                        playing ? R.drawable.sidecut_ic_pause : R.drawable.sidecut_ic_play);
                rv.setOnClickPendingIntent(R.id.wRoot, pi(ctx, "open", ""));
                rv.setOnClickPendingIntent(R.id.wPrev, pi(ctx, "prev", ""));
                rv.setOnClickPendingIntent(R.id.wPlay, pi(ctx, "playpause", ""));
                rv.setOnClickPendingIntent(R.id.wNext, pi(ctx, "next", ""));

                mgr.updateAppWidget(id, rv);
            }
        } catch (Exception ignored) {
        }
    }

    // 80.6.7 - A RESIZE IS A REPAINT. The launcher hands the new size here, and
    // the layout for that size may be a different file altogether, so the whole
    // placement is rebuilt rather than nudged.
    @Override
    public void onAppWidgetOptionsChanged(Context context, AppWidgetManager appWidgetManager,
                                          int appWidgetId, android.os.Bundle newOptions) {
        super.onAppWidgetOptionsChanged(context, appWidgetManager, appWidgetId, newOptions);
        pushAll(context);
    }

"""


TRANSPORT_ANCHOR = "    <!-- Bottom transport controls:"


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)


def method_span(src, signature):
    """Return (start, end) of a method body, brace-matched, or None."""
    start = src.find(signature)
    if start < 0:
        return None
    depth = 0
    for i in range(start, len(src)):
        c = src[i]
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                return start, i + 1
    return None


def main():
    if not os.path.exists(PROVIDER):
        print('widget-sizes: no %s - run patch-widget.py first' % os.path.relpath(PROVIDER, ROOT))
        return 1
    src = open(PROVIDER).read()
    changed = []

    if MARKER in src:
        print('widget-sizes: the provider already carries 80.6.7')
    else:
        span = method_span(src, '    static void pushAll(Context ctx) {')
        if span is None:
            print('widget-sizes: ERROR pushAll is not where this expects it')
            return 1
        start, end = span
        src = src[:start] + JAVA_NEW + src[end:]
        if 'onAppWidgetOptionsChanged' not in src:
            print('widget-sizes: ERROR the resize override did not land')
            return 1
        open(PROVIDER, 'w').write(src)
        changed.append('SideCutWidgetProvider.java')

    # The 2x2 column gains the timeline's three views, hidden. One push body paints
    # every layout, and setViewVisibility on an id a layout does not carry throws -
    # which would take the whole repaint with it.
    layout_path = os.path.join(RES, 'layout', 'sidecut_widget.xml')
    layout = open(layout_path).read()
    if 'wBar' not in layout:
        if TRANSPORT_ANCHOR not in layout:
            print('widget-sizes: ERROR the transport row is not where this expects it')
            return 1
        layout = layout.replace(TRANSPORT_ANCHOR, HIDDEN_VIEWS + TRANSPORT_ANCHOR, 1)
        open(layout_path, 'w').write(layout)
        changed.append('sidecut_widget.xml')

    for name, content in (('sidecut_widget_compact.xml', COMPACT_XML),
                          ('sidecut_widget_wide.xml', WIDE_XML),
                          ('sidecut_widget_tall.xml', TALL_XML)):
        path = os.path.join(RES, 'layout', name)
        if not os.path.exists(path) or open(path).read() != content:
            write(path, content)
            changed.append(name)

    info_path = os.path.join(RES, 'xml', 'sidecut_widget_info.xml')
    if not os.path.exists(info_path) or open(info_path).read() != INFO_XML:
        write(info_path, INFO_XML)
        changed.append('sidecut_widget_info.xml')

    if changed:
        print('widget-sizes: OK - ' + ', '.join(changed))
    else:
        print('widget-sizes: nothing to change (already 80.6.7)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
