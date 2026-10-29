#!/usr/bin/env python3
"""80.6.9 - streaming, experimental, and only where it is allowed to exist.

The owner's ask, verbatim:

    "try to see if streaming is a possibility like streaming the song, and in library
     build a section in the beginning for streaming and a separate section for
     downloaded songs just try it mark it as experimental see if you can do it tho and
     I should be able to make streaming song playlists and stuff too"

WHAT THIS IS. A Streaming block at the top of the Library that plays a song from a
signed source WITHOUT downloading it, keeps its own list of streaming songs, and
gives those songs their own playlists. It is labelled experimental because it is:
the source is a signed URL from a third party, it expires, and the app has no
control over it - so every failure is surfaced instead of hidden.

WHERE IT IS ALLOWED. `SC_STREAM_OK = !SC_IS_PLAY`, and `SC_IS_PLAY` is the Play
build (native Play APK, or the web page that is not the full one). So this block
exists in the FULL APK and the FULL WEB only - the same two builds whose search
already reaches YouTube, because `scYtSearch()` is what finds the songs and it
answers with legal/sample search on the Play build. No Play build gets a dead
section, and the block is not even built when the gate is false.

WHAT IT REUSES AND WHAT IT DOES NOT. Search is the app's own `scYtSearch()`; the
transport is the app's own `scHttpJson()`; storage is the app's own meta store.
What it does NOT reuse is the player: a stream never enters `queue`, `allTracks`
or `activeAudio()`. It has its own `Audio` element inside the block, so a stream
that dies cannot take the real player, the queue, the widget, the notification
or the resume state with it - which is the whole risk of bolting a stream onto a
player that assumes every track is a local file. That is a deliberate limit, not
an oversight: this is a second, separate speaker.

THE PLAYLISTS ARE SEPARATE TOO. `streamTracks` and `streamPlaylists` are their
own meta keys. A streaming playlist holding a videoId can never be handed to the
library renderer that expects a blob-backed track, and deleting a streaming
playlist cannot touch a downloaded one.

THE EXPIRY IS THE FEATURE THAT KEEPS IT WORKING. A googlevideo URL is signed and
dies; `scStreamStale()` treats a URL as unusable after thirty minutes and on any
`error` event, and the player then re-resolves the same videoId and resumes at the
position it was on. A stream that cannot be re-resolved says so in the row.

Idempotent: the marker is this release's page comment.

    python3 dev/patch-8069.py
    python3 dev/patch-8069.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.9'
OLD_VERSION = '80.6.8'
MARKER = '80.6.9 - STREAMING, EXPERIMENTAL, AND ONLY IN THE FULL BUILDS'

# ---------------------------------------------------------------------------
# 1. The seat in the Library: above the list of downloaded songs, never rewritten.
# ---------------------------------------------------------------------------
PANE_OLD = "  <div id=\"listPane\"></div>"

PANE_NEW = """  <!-- 80.6.9 - THE STREAMING SEAT. A sibling of #listPane, not a child of it: that
       pane is rewritten on every library render (search, tabs, sort), so anything living
       inside it would be destroyed on the next keystroke. This block is filled once, by
       scStreamBoot(), and the downloaded list keeps rendering underneath it. -->
  <div id="scStreamBlock"></div>
  <div id="listPane"></div>"""

# ---------------------------------------------------------------------------
# 2. The module. Inserted at the head of the lyrics formatter, which is a stable
#    declaration inside the page's single script.
# ---------------------------------------------------------------------------
ANCHOR = "  function formatSyncedLyrics(lrc) {"

def stream_module():
    """The module's own text, kept as JavaScript in two parts.

    It was a Python raw string until this file was committed through the API, which
    carries a file as one argument: a 32 KB payload does not survive that trip intact,
    and a silently truncated patch is far worse than two files. Reading it back also
    means the module can be syntax-checked as JavaScript without going through the page.
    The parts are joined in order and the page edit is unchanged by the split.
    """
    parts = []
    for name in ('sc-stream-8069a.js', 'sc-stream-8069b.js'):
        fp = os.path.join(HERE, name)
        if not os.path.exists(fp):
            sys.exit('patch-8069: %s is missing, so the module cannot be read' % name)
        with open(fp, encoding='utf-8') as fh:
            parts.append(fh.read())
    return ''.join(parts)


MODULE = stream_module()


# ---------------------------------------------------------------------------
# 3. The boot call, kept apart so it can be read on its own.
# ---------------------------------------------------------------------------
BOOT = """  // 80.6.9 - the streaming block waits for the library element rather than assuming it:
  // the page is one 3.8 MB script and the boot order of its pieces is not this module's
  // to decide. It retries a few times, then stops quietly - a Play build has already
  // returned above, and a page without the block is not an error worth a console story.
  try{
    (function(){
      var tries = 0;
      function tick(){
        try{ scStreamBoot(); }catch(_e){}
        if(scStreamState.built || ++tries > 20) return;
        setTimeout(tick, 400);
      }
      setTimeout(tick, 900);
    })();
  }catch(_eStreamBoot){}

"""


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    stamp = changelog_stamp()
    items = [
        '<b>Streaming, experimental.</b> The Library opens with a Streaming block: search a song, add it, and it plays <b>from the source</b> without being downloaded or saved to your device. It is marked experimental because the source is not ours and its links expire.',
        '<b>Your downloaded songs are a section of their own</b>, under a &ldquo;Downloaded songs&rdquo; heading right beneath the streaming block, so the two never look like one list.',
        '<b>Streaming playlists.</b> A streaming song has its own ＋ button: type a playlist name (a new one is created if it does not exist) and the playlist appears as a chip that plays through it. Streaming playlists are stored separately from your downloaded ones and can never be confused with them.',
        '<b>An expired link fixes itself.</b> A stream is re-resolved after thirty minutes, and again the moment the source refuses it &mdash; the same song, resumed at the position it was on. A song that cannot be re-resolved says so instead of sitting there silently.',
        'It lives in the <b>full builds only</b> &mdash; the section is not built at all elsewhere &mdash; and it uses its own player, so a stream that dies cannot touch your queue, widget or downloaded playback.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, stamp, 'Streaming, experimental', body))


def swap(src, old, new, what, times=1):
    count = src.count(old)
    if count != times:
        raise SystemExit('patch-8069: %s appears %d times, expected %d (anchor: %s)'
                         % (what, count, times, old[:70].replace('\n', '\\n')))
    return src.replace(old, new)


CLAIMS = [
    ("const APP_VERSION = '80.6.9';", 'the page runs 80.6.9'),
    (MARKER, 'the release comment is in the script'),
    ("{ version: '80.6.9', date:", 'the changelog records the release'),
    ('<div id="scStreamBlock"></div>', 'the library has the streaming seat'),
    ('var SC_STREAM_OK = !SC_IS_PLAY;', 'the gate is the full builds only'),
    ('function scStreamPickUrl(data){', 'the source picker is in the script'),
    ('function scStreamStale(at, now){', 'the expiry rule is in the script'),
    ('function scStreamPlAdd(list, name, id){', 'streaming playlists are their own list'),
    ('function scStreamPlaylistRemove', 'never (placeholder that must NOT be present)'),
]

# The placeholder above is deliberately wrong; keep CLAIMS honest.
CLAIMS = [c for c in CLAIMS if not c[1].startswith('never')]
CLAIMS.append(('function scStreamPlRemove(list, name, id){', 'playlist removal is in the script'))
CLAIMS.append(("dbPut('meta', { key: 'streamTracks'", 'streaming songs have their own key'))
CLAIMS.append(("dbPut('meta', { key: 'streamPlaylists'", 'streaming playlists have their own key'))
CLAIMS.append(("<div style=\"margin:0 20px 6px;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-dim);\">Downloaded songs</div>",
               'the downloaded section is labelled'))

GONE = [
    ("const APP_VERSION = '80.6.8';", 'the old version constant'),
]


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()
    if ("const APP_VERSION = '%s';" % VERSION) in page and MARKER in page:
        print('  present: the page runs ' + VERSION + ', and Streaming is in the Library')
        print('patch-8069%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-8069 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-8069: the page is not %s, so it is not the shape this release expects'
                 % OLD_VERSION)

    page = swap(page, PANE_OLD, PANE_NEW, 'the library list pane')
    page = swap(page, ANCHOR, MODULE + BOOT + ANCHOR, 'the head of the lyrics formatter')
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')
    page = swap(page, "var SC_IS_WEB = (function(){",
                "// " + MARKER + "\nvar SC_IS_WEB = (function(){",
                'the release comment')

    for needle, why in CLAIMS:
        if needle not in page:
            sys.exit('patch-8069: the page did not end up 80.6.9 (%s)' % why)
    for needle, why in GONE:
        if needle in page:
            sys.exit('patch-8069: the page still carries %s (%s)' % (why, needle[:60]))
    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-8069: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the streaming seat, the module, the boot, the changelog head, '
          'the version and the shell cache')
    print('patch-8069: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
