#!/usr/bin/env python3
"""83.2.9 - the native player answers the headphones itself.

NativePlayService (83.2.0) is the player that survives the recents swipe. It made
sound with no MediaSession, so the phone had no player to route a pause or a play to:
every press from the earbuds, the lock screen or the shade went to the WebView's
session, and a swipe takes that away. Its card also only ever offered Pause, so a
paused player had no way back from the shade.

This gives the service a real android.media.session.MediaSession - play, pause and stop
answered inside the service, the song and artist on its card, one button that matches
what the player is doing - and attaches it to the notification with MediaStyle so the
shade, the lock screen and the earbuds act on the same player. The method bodies are
dev/native-session-methods.java.txt.

Run by dev/native-play.py, which is what writes the file this edits. Idempotent.
"""

import io
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
JAVA = os.path.join('android', 'app', 'src', 'main', 'java', 'com', 'SideCut', 'myapp',
                    'NativePlayService.java')
METHODS = os.path.join(HERE, 'native-session-methods.java.txt')

EDITS = [
    ("import android.media.MediaPlayer;\n",
     "import android.media.MediaMetadata;\nimport android.media.MediaPlayer;\n"
     "import android.media.session.MediaSession;\nimport android.media.session.PlaybackState;\n",
     'the MediaPlayer import'),
    ('    private int startMs = 0;\n',
     '    private int startMs = 0;\n    private String artist = "";\n'
     '    private boolean paused = false;\n    private MediaSession session;\n',
     'the player fields'),
    ('        live = this;\n',
     '        live = this;\n        startSession();\n',
     'onCreate'),
    ('                    note(this, "native -> paused");\n',
     '                    note(this, "native -> paused");\n'
     '                    paused = true;\n                    setState(PlaybackState.STATE_PAUSED);\n',
     'the pause branch'),
    ('                note(this, "native -> resumed");\n',
     '                note(this, "native -> resumed");\n'
     '                paused = false;\n                setState(PlaybackState.STATE_PLAYING);\n',
     'the play branch'),
    ('            startMs = j.optInt("positionMs", 0);\n',
     '            startMs = j.optInt("positionMs", 0);\n            artist = j.optString("artist", "");\n',
     'the reading of current.json'),
    ('                        note(NativePlayService.this, "native -> playing " + title);\n',
     '                        paused = false;\n                        setMetadata();\n'
     '                        setState(PlaybackState.STATE_PLAYING);\n'
     '                        note(NativePlayService.this, "native -> playing " + title);\n',
     'onPrepared'),
    ('            Notification.Builder b = Build.VERSION.SDK_INT >= 26\n',
     '            Intent pl = new Intent(this, NativePlayService.class);\n'
     '            pl.setAction(ACTION_PLAY);\n'
     '            PendingIntent playPi = PendingIntent.getService(this, 2, pl, flags);\n'
     '            boolean playingNow = false;\n'
     '            try { playingNow = player != null && player.isPlaying(); } catch (Exception ignored) { }\n'
     '\n            Notification.Builder b = Build.VERSION.SDK_INT >= 26\n',
     'the card'),
    ('                    .setContentText("SideCut is playing")\n',
     '                    .setContentText(playingNow ? "SideCut is playing" : "SideCut is paused")\n',
     'the card text'),
    ('                    .setContentIntent(tap)\n'
     '                    .addAction(android.R.drawable.ic_media_pause, "Pause", pausePi);\n',
     '                    .setContentIntent(tap)\n'
     '                    .setCategory(Notification.CATEGORY_TRANSPORT);\n'
     '            // 83.2.9 - the button matches what the player is doing. A paused card\n'
     '            // that only offered Pause was a card with no way back.\n'
     '            if (playingNow) b.addAction(android.R.drawable.ic_media_pause, "Pause", pausePi);\n'
     '            else b.addAction(android.R.drawable.ic_media_play, "Play", playPi);\n'
     '            try {\n'
     '                if (Build.VERSION.SDK_INT >= 21) {\n'
     '                    Notification.MediaStyle style = new Notification.MediaStyle();\n'
     '                    if (session != null) style.setMediaSession(session.getSessionToken());\n'
     '                    style.setShowActionsInCompactView(0);\n'
     '                    b.setStyle(style);\n'
     '                }\n'
     '            } catch (Exception ignored) { }\n',
     'the card button'),
    ('    private void stopEverything() {\n        releasePlayer();\n',
     '    private void stopEverything() {\n        try {\n'
     '            if (session != null) session.setPlaybackState(new PlaybackState.Builder()\n'
     '                    .setState(PlaybackState.STATE_STOPPED, 0, 1.0f).build());\n'
     '        } catch (Exception ignored) { }\n        releasePlayer();\n',
     'stopEverything'),
    ('    public void onDestroy() {\n        releasePlayer();\n',
     '    public void onDestroy() {\n        releasePlayer();\n        stopSession();\n',
     'onDestroy'),
]


def swap(text, old, new, what):
    n = text.count(old)
    if n != 1:
        sys.exit('native-session: %s appears %d times, expected exactly 1' % (what, n))
    return text.replace(old, new, 1)


def main():
    if not os.path.exists(JAVA):
        print('native-session: no ' + JAVA + ' - run dev/native-play.py first')
        return 1
    src = io.open(JAVA, encoding='utf-8').read()
    if 'private MediaSession session;' in src:
        print('already on the service - nothing written')
        return 0
    if not os.path.exists(METHODS):
        print('native-session: missing ' + METHODS)
        return 1

    methods = io.open(METHODS, encoding='utf-8').read()
    out = src
    for old, new, what in EDITS:
        out = swap(out, old, new, what)
    out = swap(out, '    private void showNote() {\n',
               methods + '    private void showNote() {\n', 'showNote')

    if (out.count('private MediaSession session;') != 1
            or out.count('setState(PlaybackState') < 4
            or out.count('class NativePlayService') != 1
            or 'setShowActionsInCompactView' not in out):
        sys.exit('native-session: the result is not what was intended - nothing written')
    io.open(JAVA, 'w', encoding='utf-8').write(out)
    print('native-session: the player now carries a MediaSession')
    return 0


if __name__ == '__main__':
    sys.exit(main())
