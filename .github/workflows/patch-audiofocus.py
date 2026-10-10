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

73.6 - ONLY A REAL CALL IS AN INTERRUPTION. Every messaging app takes audio focus
to play its own short sound (the blip when you send a message, an incoming
notification, a voice note), and a transient focus request makes Chromium pause the
WebView's <audio> element over it. The web layer therefore stopped the music the
same way a phone call would, and could not tell the two apart. A real call is a
fact Android publishes: AudioManager reports MODE_IN_CALL / MODE_IN_COMMUNICATION
while a call is up and MODE_RINGTONE while one is ringing (the Android audio-input
guide defines a voice call as exactly that test), and reading the mode needs no
permission. So the plugin grows `callState()`, which reports inCall / ringing, and
the focus event carries the same fact - the web layer obeys an interruption only
when a call is really behind it, and keeps playing through everything else.

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
                        // 73.6 - the web layer decides whether an interruption is
                        // obeyed, and only a real call is, so the fact rides on the
                        // event: inCall is true for a call that is up OR ringing.
                        try {
                            int m = mode();
                            data.put("mode", m);
                            data.put("ringing", m == AudioManager.MODE_RINGTONE);
                            data.put("inCall", inCall());
                        } catch (Exception ignored) {
                            // Still report the focus change itself.
                        }
                        // Delivered to the web layer, which pauses for a call and
                        // puts the song back when focus returns.
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

    /**
     * The device audio mode, or MODE_NORMAL when it cannot be read. Media players,
     * the car and the telephony stack all set this while they own the audio, and no
     * permission is needed to read it.
     */
    private int mode() {
        try {
            AudioManager am = manager();
            return am == null ? AudioManager.MODE_NORMAL : am.getMode();
        } catch (Exception e) {
            return AudioManager.MODE_NORMAL;
        }
    }

    /**
     * Is the phone in a call - or ringing? This is the question that decides whether
     * a focus interruption is obeyed, because another app playing a message blip
     * looks exactly like a call from inside the WebView otherwise.
     *
     * MODE_IN_CALL / MODE_IN_COMMUNICATION (a cellular or VoIP call) and
     * MODE_RINGTONE (an incoming call) are the Android audio-input guide's own test
     * for "a voice call is active", and the audio mode is readable by any app. The
     * sharper answer would be TelephonyManager's call state, but that needs
     * READ_PHONE_STATE, which this app does not ask for, so it is only consulted when
     * that permission happens to be granted already.
     */
    private boolean inCall() {
        try {
            int m = mode();
            if (m == AudioManager.MODE_IN_CALL || m == AudioManager.MODE_IN_COMMUNICATION) return true;
            if (m == AudioManager.MODE_RINGTONE) return true;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    && (m == AudioManager.MODE_IN_CALL_SCREENING || m == AudioManager.MODE_CALL_SCREENING)) return true;
            try {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                        && getContext().checkSelfPermission(android.Manifest.permission.READ_PHONE_STATE)
                            == android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    android.telephony.TelephonyManager tm =
                            (android.telephony.TelephonyManager) getContext().getSystemService(Context.TELEPHONY_SERVICE);
                    if (tm != null && tm.getCallState() != android.telephony.TelephonyManager.CALL_STATE_IDLE) return true;
                }
            } catch (Exception ignored) {
                // No telephony answer available - the audio mode above stands.
            }
        } catch (Exception e) {
            // Never fail a call check into a crash; "no call" keeps the music playing.
        }
        return false;
    }

    /**
     * 73.6 - the web layer asks this before it obeys any interruption, so that a
     * messaging app's own sound cannot stop the music the way a phone call does.
     * Answers are plain facts: inCall is true while a call is up or ringing.
     */
    @PluginMethod
    public void callState(PluginCall call) {
        JSObject out = new JSObject();
        try {
            int m = mode();
            out.put("mode", m);
            out.put("ringing", m == AudioManager.MODE_RINGTONE);
            out.put("inCall", inCall());
        } catch (Exception e) {
            // Unknown is reported as "no call": the song keeps playing.
            out.put("inCall", false);
            out.put("ringing", false);
        }
        call.resolve(out);
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
