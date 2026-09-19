#!/usr/bin/env python3
"""
Inject a tiny native audio-focus plugin.

WHY: nothing in this app ever asked Android for audio focus. Android gives back
focus — after a phone call ends, when a headset reconnects, when the car kit
picks a target — to whichever app last *held* it. Spotify keeps its media
session alive in the background even when it is not open, so it was the app the
system resumed instead of SideCut, and Bluetooth/AVRCP followed it. The WebView
never took focus on the app's behalf, so there was nothing for the system to
give back.

With this plugin the app requests AUDIOFOCUS_GAIN while a song plays and
abandons it on a deliberate pause, so:
  • the system hands focus BACK to SideCut after a call, and the app resumes the
    song it was playing instead of Spotify starting up;
  • a headset reconnect targets the app that currently owns focus;
  • the system asks us (instead of talking over us) when a call comes in, and
    the focus listener below reports the interruption to JS.

Idempotent and safe to re-run on a fresh or already-patched project.
"""
import os
import sys

PKG_PATH = 'com/SideCut/myapp'
BASE = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
JAVA_DIR = os.path.join(BASE, 'android', 'app', 'src', 'main', 'java', PKG_PATH)
MAIN_ACTIVITY = os.path.join(JAVA_DIR, 'MainActivity.java')
APP_ID = 'com.SideCut.myapp'

PLUGIN_JAVA = """package %s;

import android.content.Context;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Audio focus for the WebView player.
 *
 * The app's audio lives in a WebView audio element, which never asks Android for
 * focus on the app's behalf. Without focus the system resumes the LAST app that
 * held it after any interruption (a call ending, a headset reconnecting) — which
 * is why another music app would start playing on its own. Holding focus makes
 * SideCut that app, and the focus listener is how we learn a call is taking over.
 */
@CapacitorPlugin(name = "SideCutAudioFocus")
public class SideCutAudioFocusPlugin extends Plugin {

    private AudioManager audioManager;
    private AudioFocusRequest focusRequest;
    private AudioManager.OnAudioFocusChangeListener focusListener;
    private boolean holdingFocus = false;

    private AudioManager manager() {
        if (audioManager == null) {
            audioManager = (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
        }
        return audioManager;
    }

    private AudioAttributes attributes() {
        return new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build();
    }

    private AudioManager.OnAudioFocusChangeListener listener() {
        if (focusListener == null) {
            focusListener = new AudioManager.OnAudioFocusChangeListener() {
                @Override
                public void onAudioFocusChange(int change) {
                    // This runs on the main thread from AudioManager. An exception
                    // escaping a main-thread callback kills the whole process (the
                    // app just disappears mid-song), so the body can never throw.
                    try {
                        String event;
                        switch (change) {
                            case AudioManager.AUDIOFOCUS_LOSS:                    event = "loss"; break;
                            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT:          event = "lossTransient"; break;
                            case AudioManager.AUDIOFOCUS_LOSS_TRANSIENT_CAN_DUCK: event = "duck"; break;
                            case AudioManager.AUDIOFOCUS_GAIN:                    event = "gain"; break;
                            case AudioManager.AUDIOFOCUS_GAIN_TRANSIENT:          event = "gainTransient"; break;
                            case AudioManager.AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK: event = "gainTransientMayDuck"; break;
                            default:                                             event = "unknown"; break;
                        }
                        holdingFocus = "gain".equals(event) || "gainTransient".equals(event)
                                || "gainTransientMayDuck".equals(event);
                        JSObject data = new JSObject();
                        data.put("event", event);
                        // Delivered to the web layer, which pauses on a real
                        // interruption and puts the song back when focus returns.
                        // Not retained: a stale event replayed into a listener that
                        // registers later would pause a song nobody interrupted.
                        notifyListeners("focusChange", data, false);
                    } catch (Exception e) {
                        // Never crash the process over a focus notification.
                    }
                }
            };
        }
        return focusListener;
    }

    @PluginMethod
    public void request(PluginCall call) {
        try {
            AudioManager am = manager();
            if (am == null) {
                JSObject out = new JSObject();
                out.put("granted", false);
                out.put("reason", "no audio manager");
                call.resolve(out);
                return;
            }
            int result;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (focusRequest == null) {
                    focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
                            .setAudioAttributes(attributes())
                            .setOnAudioFocusChangeListener(listener())
                            // Music keeps playing under a duck request; the app has its
                            // own volume/crossfade handling and must not fight the OS.
                            .setWillPauseWhenDucked(false)
                            .build();
                }
                result = am.requestAudioFocus(focusRequest);
            } else {
                result = am.requestAudioFocus(listener(), AudioManager.STREAM_MUSIC, AudioManager.AUDIOFOCUS_GAIN);
            }
            holdingFocus = (result == AudioManager.AUDIOFOCUS_REQUEST_GRANTED);
            JSObject out = new JSObject();
            out.put("granted", holdingFocus);
            call.resolve(out);
        } catch (Exception e) {
            call.reject("audio focus request failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void abandon(PluginCall call) {
        try {
            AudioManager am = manager();
            if (am != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    if (focusRequest != null) am.abandonAudioFocusRequest(focusRequest);
                } else {
                    am.abandonAudioFocus(listener());
                }
            }
            holdingFocus = false;
            call.resolve();
        } catch (Exception e) {
            call.reject("audio focus abandon failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void isHolding(PluginCall call) {
        JSObject out = new JSObject();
        out.put("holding", holdingFocus);
        call.resolve(out);
    }
}
""" % APP_ID

WIDGET_LINE = '        this.initialPlugins.add(SideCutWidgetPlugin.class);'
FOCUS_LINE = '        this.initialPlugins.add(SideCutAudioFocusPlugin.class);'

changed = []


def patch_main_activity():
    with open(MAIN_ACTIVITY) as f:
        src = f.read()
    if 'SideCutAudioFocusPlugin' in src:
        print('already patched: MainActivity registers the audio-focus plugin')
        return
    if WIDGET_LINE in src:
        src = src.replace(WIDGET_LINE, WIDGET_LINE + '\n' + FOCUS_LINE, 1)
    elif 'initialPlugins.add' in src:
        # Some other plugin was registered — append next to it, keeping the list
        # inside the constructor (Capacitor consumes it before super.onCreate()).
        lines = src.split('\n')
        for i, line in enumerate(lines):
            if 'initialPlugins.add' in line:
                indent = line[:len(line) - len(line.lstrip())]
                lines.insert(i + 1, indent + 'this.initialPlugins.add(SideCutAudioFocusPlugin.class);')
                break
        src = '\n'.join(lines)
    else:
        sys.exit('FATAL: MainActivity has no plugin registration to extend — '
                 'run patch-widget.py first (it writes MainActivity).')
    with open(MAIN_ACTIVITY, 'w') as f:
        f.write(src)
    changed.append('android/app/src/main/java/%s/MainActivity.java' % PKG_PATH)


def main():
    for d in (JAVA_DIR, MAIN_ACTIVITY):
        if not os.path.exists(d):
            print('ERROR: missing %s — run this after `npx cap add android`' % d)
            sys.exit(1)
    with open(os.path.join(JAVA_DIR, 'SideCutAudioFocusPlugin.java'), 'w') as f:
        f.write(PLUGIN_JAVA)
    changed.append('android/app/src/main/java/%s/SideCutAudioFocusPlugin.java' % PKG_PATH)
    patch_main_activity()
    for c in changed:
        print('wrote', c)
    print('audio focus plugin injected (%d file(s))' % len(changed))


if __name__ == '__main__':
    main()
