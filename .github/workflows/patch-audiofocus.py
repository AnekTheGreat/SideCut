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

80.0.1 - THE ASSISTANT DUCK. An assistant listening asks the system to duck us
(AUDIOFOCUS_GAIN_TRANSIENT_MAY_DUCK), the same request a navigation prompt or a
message blip makes. The web layer steps the music back for it and needs to know
when to bring it back up, so the plugin remembers the last focus event and grows
`duckState()`, which answers "is the duck over?" from that event and the audio
mode. It says "over" only on positive evidence, so a duck Android applied without
telling anyone leaves the web layer's own bounded wait in charge.

85.3.5 - MODE_IN_COMMUNICATION IS NOT A PHONE CALL. The audio mode was read as one,
so anything holding the microphone - a VoIP call, but also every game with voice
chat, Discord and the OnePlus/Oppo game assistant - made the web layer believe a
call was up. Every undo path in the page refuses while a call is up, so a single
blip from another app during a game left the music paused for the rest of the
session. `inCall()` now answers only for what a call sets (MODE_IN_CALL,
MODE_RINGTONE, MODE_CALL_SCREENING, plus the telephony state when that permission is
granted), and `commMode()` reports the microphone separately. The plugin also grows
`focusState()`, which reports whether anything else is playing on the music stream
(`isMusicActive()`) beside those facts: that is how the page knows the speakers are
free again and brings the song back by itself, since Android never sends a focus
GAIN to a client that does not hold focus.

80.2.9 - MODE_IN_CALL_SCREENING DOES NOT EXIST. The call check compared the audio
mode against `AudioManager.MODE_IN_CALL_SCREENING`, which is not a constant in the
SDK at any API level: `MODE_CALL_SCREENING` (API 29) is the only call-screening mode
there is. A missing symbol is a compile error, so `:app:compileReleaseJavaWithJavac`
failed on every Android build from the moment this plugin was injected, and the APK
pipeline stayed red. The check now reads the real constant, still guarded by Q.

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
    // 80.0.1 - the assistant duck. The plugin remembers the last focus event it was
    // sent and whether that event was a duck request, because the web layer asks
    // "is the duck over yet?" while it is holding the music down. Only the event
    // and the audio mode are read; neither needs a permission.
    private boolean ducking = false;
    private String lastFocus = "none";

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
                        // 80.0.1 - remember it, so duckState() can answer the web layer.
                        lastFocus = event;
                        ducking = "duck".equals(event);
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
                            // 85.3.5 - a game or an assistant on the microphone is
                            // not a call, and the page is told which one it is.
                            data.put("comm", commMode());
                            data.put("musicActive", musicActive());
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
     * MODE_IN_CALL (a cellular call), MODE_RINGTONE (an incoming call) and
     * MODE_CALL_SCREENING (a call being screened, API 29) are the audio modes a call
     * is in, and the mode is readable by any app. The sharper answer would be
     * TelephonyManager's call state, but that needs READ_PHONE_STATE, which this app
     * does not ask for, so it is only consulted when that permission happens to be
     * granted already.
     *
     * 85.3.5 - MODE_IN_COMMUNICATION IS NOT IN THIS LIST. It is the mode of anything
     * that holds the microphone, and a game with voice chat (or the game assistant
     * that sits over it) holds it for as long as the game runs. Counting it as a call
     * made every undo path in the page refuse for that whole session, which is the
     * music dying with a game open. It is reported by commMode() instead.
     */
    private boolean inCall() {
        try {
            int m = mode();
            if (m == AudioManager.MODE_IN_CALL) return true;
            if (m == AudioManager.MODE_RINGTONE) return true;
            // MODE_CALL_SCREENING is the Q constant (API 29). There is no
            // MODE_IN_CALL_SCREENING in AudioManager at all, and naming it here stopped
            // the app compiling from the moment this plugin was injected.
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
                    && m == AudioManager.MODE_CALL_SCREENING) return true;
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
     * 85.3.5 - is something holding the microphone? MODE_IN_COMMUNICATION is set by a
     * VoIP call and by any game or assistant with voice chat. While it is up the music
     * is held down (it is not paused FOR it), because somebody is talking. It is
     * reported apart from inCall() for exactly that reason: one is a phone call, the
     * other is somebody using the microphone.
     */
    private boolean commMode() {
        try {
            return mode() == AudioManager.MODE_IN_COMMUNICATION;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 85.3.5 - is anything at all playing on the music stream? Read only while the web
     * layer is waiting to bring a song back, so it answers the one question that
     * decides whether the speakers are free: is somebody else still making sound.
     */
    private boolean musicActive() {
        try {
            AudioManager am = manager();
            return am != null && am.isMusicActive();
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * 85.3.5 - the whole answer in one object: a call, a ringing phone, somebody on
     * the microphone, and whether another app is still making sound. Both callState()
     * and focusState() return it, so a page that only knows the older name still gets
     * the new facts. No permission is needed to read any of them.
     */
    private JSObject facts() {
        JSObject out = new JSObject();
        try {
            int m = mode();
            out.put("mode", m);
            out.put("ringing", m == AudioManager.MODE_RINGTONE);
            out.put("inCall", inCall());
            out.put("comm", commMode());
            out.put("musicActive", musicActive());
            out.put("holding", holdingFocus);
        } catch (Exception e) {
            out.put("inCall", false);
            out.put("ringing", false);
            out.put("comm", false);
            out.put("musicActive", false);
        }
        return out;
    }

    /**
     * 73.6 - the web layer asks this before it obeys any interruption, so that a
     * messaging app's own sound cannot stop the music the way a phone call does.
     * Answers are plain facts: inCall is true while a call is up or ringing.
     */
    @PluginMethod
    public void callState(PluginCall call) {
        // 85.3.5 - the same answer as focusState(), so an older page that only asks
        // this question still learns about the microphone and the music stream.
        call.resolve(facts());
    }

    /**
     * 85.3.5 - the answer the web layer asks for every few seconds while it is waiting
     * to bring a song back: is a call up, is somebody on the microphone, and is
     * anything else still making sound. All three are readable without a permission,
     * which is why the page can ask instead of guessing - and guessing wrong either
     * leaves the music silent after another app, or plays it over one.
     */
    @PluginMethod
    public void focusState(PluginCall call) {
        call.resolve(facts());
    }

    /**
     * 80.0.1 - is the duck over? The web layer holds the music down while an
     * assistant is listening and asks this to find out when to bring it back up.
     *
     * The answer is deliberately conservative: the plugin only says "over" when it
     * has positive evidence. A duck it never saw (Android 8 and later can duck a
     * stream without invoking any callback) answers over=false, which leaves the
     * web layer's own bounded wait in charge rather than cutting a real duck short.
     */
    @PluginMethod
    public void duckState(PluginCall call) {
        JSObject out = new JSObject();
        try {
            int m = mode();
            out.put("mode", m);
            out.put("holding", holdingFocus);
            out.put("lastEvent", lastFocus);
            out.put("ducking", ducking);
            // Ducked, and the audio mode has come back to normal: the app that asked
            // for the duck has let go.
            out.put("over", ducking && m == AudioManager.MODE_NORMAL);
        } catch (Exception e) {
            // No opinion: the web layer keeps its own clock.
            out.put("over", false);
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
