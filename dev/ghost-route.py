#!/usr/bin/env python3
"""83.1.0 - the widget press stops routing through the phone's media keys.

WHAT 83.0.9 STILL DID WRONG, AND WHY A PRESS COULD PLAY NOTHING AT ALL.

The hidden player exists because swiping the app away destroys its WebView. Whether a
press reached that hidden player was decided by a "heartbeat" pref - a timestamp written
only when the page happens to push widget state. So an app that had been dead for up to
15 seconds still looked alive, and the trampoline handed the press back to the provider.
The provider's answer to a play is AudioManager.dispatchMediaKeyEvent: a key to the
WHOLE PHONE. That starts Spotify if Spotify was the last player, and reaches nothing at
all if there is no session - and the hidden player was only started after 2.5 s of
nothing. A press inside that window was spent on a player that was not this one.

This script rewrites the press routing in the generated tree, after dev/ghost-host.py:

  playing                  -> the press is a pause, and only this case goes back to the
                              provider (a media key is the only way to reach a session)
  alive, but silent        -> ask the RUNNING page to resume (it polls for exactly this
                              every 10 s) and give it 12 s before the hidden player
  nothing alive            -> the hidden player, immediately, with no media key at all

It also cuts the hidden player's patience from ~40 s to ~9 s, so a press that cannot play
ends in the app instead of in forty seconds of nothing, and adds one 70 ms buzz when the
button is pressed - proof that the press reached the app at all (needs VIBRATE, which is
a normal permission and is added to the manifest here).

Re-running is a no-op. It edits ./android/... relative to the working directory.

  python3 dev/ghost-route.py
"""
import io
import os
import sys

JAVA_DIR = os.path.join('android', 'app', 'src', 'main', 'java', 'com', 'SideCut', 'myapp')
HOST = os.path.join(JAVA_DIR, 'GhostHostActivity.java')
PLAYER = os.path.join(JAVA_DIR, 'GhostPlayerActivity.java')
MANIFEST = os.path.join('android', 'app', 'src', 'main', 'AndroidManifest.xml')

NEW_ROUTING = '''    // 83.1.0 - A RESUME IS NEVER HANDED TO THE PHONE.
    //
    // 83.0.8 sent the press back to the provider whenever SideCut "looked alive", and that
    // provider answers a play with dispatchMediaKeyEvent - a SYSTEM-WIDE media key. So a
    // press within a heartbeat of the app dying went to whatever player the phone saw last
    // (Spotify), or to nobody at all, and the hidden player was only started after 2.5 s of
    // nothing. The heartbeat is only stamped when the page pushes state, so "looks alive"
    // was frequently a corpse.
    //
    // The three real cases are separate now, and a resume uses no media key anywhere:
    // playing -> the press is a pause and only then is the provider asked; alive but
    // silent -> the running page is asked to resume and given 12 s; nothing alive -> the
    // hidden player, at once.
    private void askLivePageThenPlayer(final String why) {
        final long before = heartbeat(this);
        try {
            getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                    .putBoolean("pendingResume", true)
                    .putLong("pendingResumeAt", System.currentTimeMillis())
                    .apply();
        } catch (Exception ignored) {
        }
        GhostDiag.note(this, "press -> " + why + ", asked the running app to play");
        new Handler(Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override public void run() {
                if (musicActive(GhostHostActivity.this)
                        || heartbeat(GhostHostActivity.this) > before) {
                    GhostDiag.note(GhostHostActivity.this, "press -> " + why + ", and SideCut answered");
                    finish();
                    return;
                }
                GhostDiag.note(GhostHostActivity.this,
                        "press -> " + why + ", and SideCut did not answer - starting the hidden player");
                startHiddenPlayer();
                finish();
            }
        }, 12000L);
    }

    /** 83.1.0 - one short buzz: proof the press reached this class at all. */
    private void buzz() {
        try {
            android.os.Vibrator v =
                    (android.os.Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (v != null) v.vibrate(70);
        } catch (Exception ignored) {
        }
    }
'''

OLD_BRANCH = '''        // 83.0.8 - ONLY SIDECUT'S OWN PRESS GOES BACK TO SIDECUT. Anything else is
        // handed to the phone, and the phone gives it to whatever played last.
        if (appAlive(this)) { handBackThenPlayer("SideCut is running"); return; }
'''

NEW_BRANCH = '''        buzz();

        // 83.1.0 - THE THREE REAL CASES, IN ORDER.
        if (appAlive(this) && musicActive(this)) {
            handBack("SideCut is playing");
            finish();
            return;
        }
        if (appAlive(this)) { askLivePageThenPlayer("SideCut is open and silent"); return; }
'''

changed = []


def read(path):
    return io.open(path, encoding='utf-8').read()


def write(path, text):
    io.open(path, 'w', encoding='utf-8').write(text)
    if path not in changed:
        changed.append(path)


def span(text, start_mark, end_mark, new, label):
    """Replace everything from start_mark up to and including end_mark."""
    if text.count(start_mark) != 1:
        sys.exit('%s: %d matches for %r (expected exactly 1)'
                 % (label, text.count(start_mark), start_mark[:48]))
    i = text.find(start_mark)
    j = text.find(end_mark, i)
    if j < 0:
        sys.exit('%s: end marker not found' % label)
    return text[:i] + new + text[j + len(end_mark):]


def main():
    for path in (HOST, PLAYER, MANIFEST):
        if not os.path.exists(path):
            print('ghost-route: no ' + path + ' - run patch-widget.py and dev/ghost-host.py first')
            return 1

    # ---- 1. the trampoline's routing -------------------------------------------------
    host = read(HOST)
    if 'askLivePageThenPlayer' not in host:
        if 'handBackThenPlayer' not in host:
            print('ghost-route: the trampoline is not the shape this expects')
            return 1
        host = span(host,
                    '    // 83.0.8 - AND IT HAS TO BE SIDECUT THAT ANSWERS.',
                    '        }, 2500L);\n    }\n',
                    NEW_ROUTING,
                    'the hand-back')
        if host.count(OLD_BRANCH) != 1:
            print('ghost-route: the onCreate branch is %d matches' % host.count(OLD_BRANCH))
            return 1
        host = host.replace(OLD_BRANCH, NEW_BRANCH, 1)
        if 'handBackThenPlayer' in host:
            print('ghost-route: the old routing survived - refusing to write')
            return 1
        write(HOST, host)

    # ---- 2. the hidden player gives up in ~9 s, not ~40 ------------------------------
    player = read(PLAYER)
    old_wait = '            if (!started && silent >= 12) {  // 83.0.9 - never made a sound in ~40 s'
    if old_wait in player:
        player = player.replace(
            old_wait,
            '            if (!started && silent >= 2) {   // 83.1.0 - no sound in ~9 s: show the app',
            1)
        player = player.replace('"player -> no audio, opening the app"',
                                '"player -> no audio in 9 s, opening the app"', 1)
        write(PLAYER, player)
    elif 'silent >= 2' not in player:
        print('ghost-route: the player patience is not where this expects it')
        return 1

    # ---- 3. the buzz needs a permission, and it is the cheap kind -------------------
    manifest = read(MANIFEST)
    if 'android.permission.VIBRATE' not in manifest:
        if '<application' not in manifest:
            print('ghost-route: no <application> in the manifest')
            return 1
        manifest = manifest.replace(
            '<application',
            '    <uses-permission android:name="android.permission.VIBRATE" />\n    <application',
            1)
        write(MANIFEST, manifest)

    if changed:
        print('ghost-route: OK - ' + ', '.join(changed))
    else:
        print('ghost-route: nothing to change (already applied)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
