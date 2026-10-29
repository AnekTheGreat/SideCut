#!/usr/bin/env python3
"""80.6.11 - the shelf: streaming in its own panel, playing through the real resolver.

What the owner said, and what each part of this answers:

  "streaming should have like its own thing like its own mini tab like you click on
   Library and a side panel on the right opens that opens up subtabs, of streaming,
   library, and albums"

  The Library keeps its own list. A rail of three tabs sits above it, and the
  Streaming tab slides a sheet in from the right edge - over the list, not into it.
  Library and Albums are not reimplementations: they close the sheet and drive the
  page's own libraryMode + navigate, so sorting, selection and album expansion are
  untouched.

  "make the streaming actually work and play songs"

  It did not work because it was a second guess at the player: its own client list,
  its own headers, no cipher handling. It now calls scYtPlayer(), which is the call
  the converter has been downloading through for releases.

  "fix this random ahh emoji"

  The buttons were set in characters (U+FF0B, U+23EE, U+23F8, U+23ED, U+00D7) and
  the WebView picked a font for them. They are paths now, in the row's colour.

  "it should mix in like your pinned artists from discover and have recommended songs"

  The pinned artists already live in `pinnedArtists`; the sheet reads that array and
  paints it as chips, and a Recommended row seeds itself from the artist of whatever
  is playing.

  "why would you mention the streaming in the patch notes for regular SideCut"

  The Play channel publishes its own notes (dev/ota-bundle-play.mjs) and it already
  knows how to drop an item: a [FULL]-marked item, or one it hides. The streaming
  items are marked, and "stream"/"streaming"/"from the source" join the words that
  channel hides - in the page and in that script, which have to agree.

Idempotent: the marker is 80.6.11 on the page plus the rail.

    python3 dev/patch-80611.py
    python3 dev/patch-80611.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')

CHECK = '--check' in sys.argv
VERSION = '80.6.11'
OLD_VERSION = '80.6.10'
MARKER = '80.6.11 - THE SHELF'


def part(name):
    fp = os.path.join(HERE, name)
    if not os.path.exists(fp):
        raise SystemExit('patch-80611: %s is missing' % name)
    with open(fp, encoding='utf-8') as fh:
        return fh.read()


A = part('sc-stream-80611a.js')
B = part('sc-stream-80611b.js')

ANCHOR = "  function formatSyncedLyrics(lrc) {"

SEAT_OLD = '  <div id="scStreamBlock"></div>\n  <div id="listPane"></div>'
SEAT_NEW = ('  <!-- 80.6.11 - THE SHELF RAIL. Three tabs above the library list: Streaming is the\n'
            '       panel that slides in from the right, and Library and Albums are the halves of\n'
            '       this screen, driven by the page itself. The rail is filled by scShelfRender(). -->\n'
            '  <div id="scShelfRail"></div>\n'
            '  <div id="scStreamBlock"></div>\n'
            '  <div id="listPane"></div>')

# The glyphs, and what replaces them.
GLYPHS = [
    ("h += '<button type=\"button\" id=\"scStreamPrev\" style=\"background:none;border:none;color:var(--ink);font-size:16px;\">\u23ee</button>';",
     "h += '<button type=\"button\" id=\"scStreamPrev\" aria-label=\"Previous\" style=\"background:none;border:none;color:var(--ink);line-height:0;padding:6px;\">' + scIcon('prev', 18) + '</button>';"),
    ("h += '<button type=\"button\" id=\"scStreamPlay\" style=\"background:var(--coral);border:none;color:#12030b;border-radius:999px;width:36px;height:36px;font-size:14px;\">' + (scStreamState.playing ? '\u23f8' : '\u25b6') + '</button>';",
     "h += '<button type=\"button\" id=\"scStreamPlay\" aria-label=\"Play or pause\" style=\"background:var(--accent, var(--ink));border:none;color:var(--bg);border-radius:999px;width:36px;height:36px;line-height:0;\">' + scIcon(scStreamState.playing ? 'pause' : 'play', 18) + '</button>';"),
    ("h += '<button type=\"button\" id=\"scStreamNextB\" style=\"background:none;border:none;color:var(--ink);font-size:16px;\">\u23ed</button>';",
     "h += '<button type=\"button\" id=\"scStreamNextB\" aria-label=\"Next\" style=\"background:none;border:none;color:var(--ink);line-height:0;padding:6px;\">' + scIcon('next', 18) + '</button>';"),
    ("style=\"border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:5px 10px;font-size:11px;\">\uff0b Add</button>'",
     "style=\"border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:5px 10px;font-size:11px;line-height:1;\">' + scIcon('plus', 13) + ' Add</button>'"),
    ("style=\"border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;\">\uff0b</button>'",
     "style=\"border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;line-height:1;\">' + scIcon('plus', 12) + '</button>'"),
    ("style=\"border:none;background:none;color:var(--ink-dim);font-size:13px;\">\u00d7</button>'",
     "style=\"border:none;background:none;color:var(--ink-dim);padding:4px 6px;line-height:0;\">' + scIcon('close', 13) + '</button>'"),
    ("font-weight:700;\">Search</button>';",
     "font-weight:700;\">' + scIcon('search', 13) + ' Search</button>';"),
    ("background:var(--coral);color:#12030b;font-size:12px;font-weight:700;",
     "background:var(--accent, var(--ink));color:var(--bg);font-size:12px;font-weight:700;"),
    # The last one is in a comment, and it is still a character a WebView picks a font
    # for - so the comment says what the button is instead of quoting the glyph.
    ('which is what a "\uff0b" tapped twice looks like.',
     'which is what an add button tapped twice looks like.'),
]

# The sheet is streaming only now, so the heading that separated it from the
# downloaded list has nothing left to separate.
DROP_HEADING = ("    h += '<div style=\"margin:0 20px 6px;font-size:10.5px;letter-spacing:1.4px;text-transform:uppercase;color:var(--ink-dim);\">Downloaded songs</div>';\n", '')

# A close button, because a sheet that covers the list must be dismissable by the
# thing it covers; the scrim behind it closes it too.
HEAD_OLD = "    h += '<span style=\"flex:1;\"></span>';"
HEAD_NEW = ("    h += '<span style=\"flex:1;\"></span>';\n"
            "    h += '<button type=\"button\" id=\"scStreamClose\" aria-label=\"Close\" style=\"background:none;border:none;color:var(--ink-dim);padding:4px;line-height:0;\">' + scIcon('close', 16) + '</button>';")

# Pins and the recommendation, between the search box and the results.
PINS_OLD = "    h += '</div>';\n    if(scStreamState.results){"
PINS_NEW = """    h += '</div>';
    var pins = scShelfPins();
    if(pins.length){
      h += '<div style="margin-top:10px;display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;">';
      pins.forEach(function(p){
        h += '<button type="button" class="scs-pin" data-name="' + escapeHtml(String(p.name || '')) + '" style="flex:0 0 auto;border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:6px 12px;font-size:11.5px;">' + escapeHtml(String(p.name || '')) + '</button>';
      });
      h += '</div>';
    }
    h += '<div style="margin-top:8px;display:flex;gap:8px;">';
    h += '<button type="button" id="scStreamRec" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:5px 12px;font-size:11px;">Recommended</button>';
    h += '</div>';
    if(scStreamState.results){"""

# Boot: the rail is built by its own step, and it only exists on this build.
BOOT_OLD = "        try{ scStreamBoot(); }catch(_e){}"
BOOT_NEW = "        try{ scStreamBoot(); }catch(_e){}\n        try{ scShelfBoot(); }catch(_eSh){}"

WIRE_OLD = "    on('scStreamNewPl', 'click', scStreamNewPlaylist);"
WIRE_NEW = ("    on('scStreamNewPl', 'click', scStreamNewPlaylist);\n"
            "    on('scStreamClose', 'click', scShelfClose);\n"
            "    on('scStreamRec', 'click', scShelfRecommend);\n"
            "    Array.prototype.forEach.call(host.querySelectorAll('.scs-pin'), function(b){\n"
            "      b.addEventListener('click', function(){ scShelfPinSearch(this.getAttribute('data-name')); });\n"
            "    });")

# The stream that dies mid-song tries the next candidate before it admits defeat.
ERR_OLD = "        if(!u){ scStreamSay('This source will not play right now'); return; }"
ERR_NEW = ("        if(!u){ u = scStreamAltUrl(); }\n"
           "        if(!u){ scStreamSay('This source will not play right now'); return; }")

# The words the Play channel hides. The page and dev/ota-bundle-play.mjs each keep a copy
# (they have to agree), and only the rule body is shared here so both can be written.
HIDES_BODY_OLD = ('downloader|downloading|converter|converts|converting|conversion|convert\\b|'
                  'spotify to mp3|youtube to mp3|\\bto mp3\\b|get song\\b|spotisaver|spotmate|'
                  'spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off')
HIDES_BODY_NEW = HIDES_BODY_OLD + '|streaming|streams?\\b|from the source'
HIDES_OLD = 'if(/(' + HIDES_BODY_OLD + ')/i.test(t)) return true;'
HIDES_NEW = 'if(/(' + HIDES_BODY_NEW + ')/i.test(t)) return true;'
MJS_OLD = 'if (/(' + HIDES_BODY_OLD + ')/i.test(t)) return true;'
MJS_NEW = 'if (/(' + HIDES_BODY_NEW + ')/i.test(t)) return true;'

FULL = [
    ("'<b>Streaming, experimental.</b> The Library opens with a Streaming block",
     "'[FULL] <b>Streaming, experimental.</b> The shelf opens as a panel of its own"),
    ("'<b>Your downloaded songs are a section of their own</b>",
     "'[FULL] <b>Your downloaded songs are a section of their own</b>"),
    ("'<b>Streaming playlists.</b> A streaming song has its own \uff0b button",
     "'[FULL] <b>Streaming playlists.</b> A streamed song has its own add button"),
    ("'<b>An expired link fixes itself.</b>", "'[FULL] <b>An expired link fixes itself.</b>"),
    ("'It uses its own player, so a stream that dies", "'[FULL] It uses its own player, so a stream that dies"),
]


def changelog_stamp():
    now = datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None) - datetime.timedelta(hours=4)
    return '%s %d, %d \u00b7 %d:%02d %s EDT' % (
        now.strftime('%B'), now.day, now.year, now.hour % 12 or 12, now.minute,
        'AM' if now.hour < 12 else 'PM')


def changelog_entry():
    items = [
        'The Library opens on a short rail of three tabs - <b>Streaming</b>, <b>Library</b> and <b>Albums</b> - so the stream shelf, your files and your albums never share one scroll again.',
        'Streaming is a panel of its own now: it slides in from the right over the list, and the list keeps the place it was in while it is open.',
        '[FULL] Your <b>pinned artists</b> sit at the top of the shelf as chips - one tap searches that artist - and <b>Recommended</b> seeds a mix from whoever you are streaming.',
        '[FULL] The transport and the add and remove buttons are drawn as icons instead of characters, so a WebView can no longer render one of them as an emoji, and the play button takes your theme&rsquo;s colour.',
        'A stream is resolved by the same call the converter is built on, so a song that would download now plays: both clients asked at once, headers that name the client the request declares, a ciphered row decrypted, and the audio streams tried before the muxed ones.',
    ]
    body = ',\n'.join("    '%s'" % i.replace('\\', '\\\\').replace("'", "\\'")
                      for i in items)
    return ("  { version: '%s', date: '%s', title: '%s', items: [\n%s,\n  ]},\n"
            % (VERSION, changelog_stamp(), 'A shelf for streaming, and streams that play', body))


def cut_function(src, name):
    """Return (src_without_the_function, the_function_text)."""
    head = '  function ' + name + '('
    i = src.find(head)
    if i < 0:
        raise SystemExit('patch-80611: no %s to replace' % name)
    depth = 0
    for p in range(src.index('{', i), len(src)):
        if src[p] == '{':
            depth += 1
        elif src[p] == '}':
            depth -= 1
            if depth == 0:
                end = p + 1
                while end < len(src) and src[end] == '\n':
                    end += 1
                return src[:i] + src[end:], src[i:end]
    raise SystemExit('patch-80611: %s does not close' % name)


def swap(src, old, new, what, times=1):
    count = src.count(old)
    if count != times:
        raise SystemExit('patch-80611: %s appears %d times, expected %d (%s)'
                         % (what, count, times, old[:60].replace('\n', '\\n')))
    return src.replace(old, new)


def main():
    page_path = os.path.join(ROOT, 'index.html')
    page = open(page_path, encoding='utf-8').read()

    if ("const APP_VERSION = '%s';" % VERSION) in page and 'id="scShelfRail"' in page:
        print('  present: the page runs ' + VERSION + ', and the shelf rail is in the Library')
        print('patch-80611%s: 0 step(s) applied' % (' --check' if CHECK else ''))
        return 0
    if CHECK:
        print('patch-80611 --check: the release is pending')
        return 1
    if ("const APP_VERSION = '%s';" % OLD_VERSION) not in page:
        sys.exit('patch-80611: the page is not %s' % OLD_VERSION)

    page = swap(page, SEAT_OLD, SEAT_NEW, 'the library seat')
    page, _old_resolver = cut_function(page, 'scStreamResolve')
    page = swap(page, ANCHOR, A + '\n' + B + '\n' + ANCHOR, 'the head of the lyrics formatter')
    for old, new in GLYPHS:
        page = swap(page, old, new, 'a glyph in the shelf')
    page = swap(page, DROP_HEADING[0], DROP_HEADING[1], 'the downloaded heading')
    page = swap(page, HEAD_OLD, HEAD_NEW, 'the sheet head')
    page = swap(page, PINS_OLD, PINS_NEW, 'the pins row')
    page = swap(page, BOOT_OLD, BOOT_NEW, 'the boot tick')
    page = swap(page, WIRE_OLD, WIRE_NEW, 'the shelf wiring')
    page = swap(page, ERR_OLD, ERR_NEW, 'the dead-stream retry')
    page = swap(page, HIDES_OLD, HIDES_NEW, 'the play-build note filter')
    for old, new in FULL:
        page = swap(page, old, new, 'a streaming note')
    page = swap(page, "  const CHANGELOG = [\n", "  const CHANGELOG = [\n" + changelog_entry(),
                'the changelog head')
    page = swap(page, "  const APP_VERSION = '%s';" % OLD_VERSION,
                "  const APP_VERSION = '%s';" % VERSION, 'the version')

    claims = [
        ('id="scShelfRail"', 'the rail seat'),
        ('function scShelfOpenTab(tab){', 'the shelf tabs'),
        ('function scIcon(name, size){', 'the icons'),
        ('return scYtPlayer(id);', 'the proven resolver'),
        ('class="scshelf-tab', 'the rail buttons'),
    ]
    for needle, why in claims:
        if needle not in page:
            sys.exit('patch-80611: the page is missing %s' % why)

    open(page_path, 'w', encoding='utf-8').write(page)

    sw_path = os.path.join(ROOT, 'sw.js')
    sw = open(sw_path, encoding='utf-8').read()
    marker = "'sidecut-shell-v%s'" % OLD_VERSION
    if marker not in sw:
        sys.exit('patch-80611: the shell cache is not the %s one' % OLD_VERSION)
    open(sw_path, 'w', encoding='utf-8').write(sw.replace(marker, "'sidecut-shell-v%s'" % VERSION, 1))

    print('  applied: the rail, the sheet, the icons, the resolver call, the pins, the notes, '
          'the changelog head, the version and the shell cache')
    # The Play channel publishes its own notes and keeps its own copy of the hide rule, so
    # the same words go in there. It is a dev script, which a release is allowed to own; a
    # tree that has neither rule is an error, and one that already has the new rule is fine.
    tool = os.path.join(ROOT, 'dev', 'ota-bundle-play.mjs')
    if os.path.exists(tool):
        tsrc = open(tool, encoding='utf-8').read()
        if MJS_OLD in tsrc:
            open(tool, 'w', encoding='utf-8').write(tsrc.replace(MJS_OLD, MJS_NEW, 1))
            print('  applied: the Play channel hide rule (dev/ota-bundle-play.mjs)')
        elif MJS_NEW not in tsrc:
            sys.exit('patch-80611: dev/ota-bundle-play.mjs carries neither hide rule')
    print('patch-80611: 1 step(s) applied')
    return 0


if __name__ == '__main__':
    sys.exit(main())
