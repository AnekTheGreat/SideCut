#!/usr/bin/env python3
"""80.6.12 - streaming as a real tab, and a stream that actually plays.

Two things the owner said, and what each edit answers:

  "the streaming should be an actual tab like thing tho"

  80.6.11 put the shelf behind a tab but opened it as a DRAWER over the list:
  fixed to the right edge, a scrim behind it, a close button on it. That is a
  sheet, not a tab. The shelf is now the page the Streaming tab switches to - the
  downloaded list is put away, the shelf takes its place in the same scroll, and
  the rail and the header stay where they are. Back to Library is one tap, and the
  list is exactly where it was because it was never re-rendered, only hidden.

  "streaming doesn't work"

  It never could. A googlevideo URL handed to an <audio> element is fetched by the
  media stack with none of the resolver's headers, so the source answers 403 and
  the element fails without the page learning why. The bytes now come in through
  scFetchBytes() - the four-lane range reader the downloader has used for releases
  - and play from an object URL, the same trick the crop preview uses. On a device
  that fetch is the patched one, so CORS is not the limiter; on the web the plain
  URL is still tried last, so nothing that worked before stops working.

Idempotent: the marker is 80.6.12 on the page plus the tab CSS.

    python3 dev/patch-80612.py
    python3 dev/patch-80612.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
INDEX = os.path.join(ROOT, 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.12'
OLD_VERSION = '80.6.11'
MARKER = '80.6.12 - A TAB, NOT A DRAWER'


with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

# Already applied: the version and the marker are both there. Re-running must be a
# no-op (the anchors it needs are gone because it replaced them).
if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80612: the page is already %s (%s) - nothing to do' % (VERSION, MARKER))
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, times=1):
    global SRC
    got = SRC.count(old)
    if got != times:
        failed.append('%s: found %d, expected %d' % (name, got, times))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# ---------------------------------------------------------------------------
# 1. The drawer becomes a page. No fixed box, no scrim, no slide: the shelf is
#    display:none until its tab is the one selected, and then it is content.
# ---------------------------------------------------------------------------
swap('the sheet box becomes a page',
     "      '#scStreamBlock{position:fixed;top:0;right:0;bottom:0;left:auto;width:min(88%,430px);',\n"
     "      'z-index:60;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg);',\n"
     "      'border-left:1px solid var(--line);box-shadow:-18px 0 40px rgba(0,0,0,.35);',\n"
     "      'transform:translateX(102%);transition:transform .28s cubic-bezier(.22,.61,.36,1);',\n"
     "      'padding:14px 0 28px;visibility:hidden;margin:0}',\n"
     "      '#scStreamBlock.scShelfOpen{transform:translateX(0);visibility:visible}',",
     "      '#scStreamBlock{position:relative;display:none;width:auto;overflow:visible;',\n"
     "      'background:none;border:0;box-shadow:none;transform:none;visibility:visible;',\n"
     "      'padding:2px 0 26px;margin:0}',\n"
     "      '#scStreamBlock.scShelfOpen{display:block}',")

swap('the scrim has nothing left to dim',
     "      '#scShelfScrim{position:fixed;inset:0;z-index:55;background:rgba(4,8,10,.42);',\n"
     "      'opacity:0;pointer-events:none;transition:opacity .22s ease}',\n"
     "      '#scShelfScrim.scShelfOpen{opacity:1;pointer-events:auto}',",
     "      '#scShelfScrim{display:none}',")

# ---------------------------------------------------------------------------
# 2. One function decides which of the two pages is up, so no caller can leave
#    the list hidden behind a shelf that was closed.
# ---------------------------------------------------------------------------
swap('the tab switch',
     "  function scShelfClose(){\n"
     "    scShelf.open = false;\n"
     "    var sheet = scShelfSheet(), scrim = document.getElementById('scShelfScrim');\n"
     "    if(sheet) sheet.classList.remove('scShelfOpen');\n"
     "    if(scrim) scrim.classList.remove('scShelfOpen');\n"
     "    scShelfRender();\n"
     "  }",
     "  // " + MARKER + ". Streaming is the first of the three pages the rail switches\n"
     "  // between: the downloaded list is put AWAY and the shelf takes its place in the\n"
     "  // same scroll, with the rail and the header staying put. The list is hidden, not\n"
     "  // rebuilt, so returning to it costs nothing and loses nothing.\n"
     "  function scShelfPage(on){\n"
     "    var sheet = scShelfSheet(), list = document.getElementById('listPane');\n"
     "    if(sheet){ if(on) sheet.classList.add('scShelfOpen'); else sheet.classList.remove('scShelfOpen'); }\n"
     "    if(list){ list.style.display = on ? 'none' : ''; }\n"
     "  }\n"
     "  function scShelfClose(){\n"
     "    scShelf.open = false;\n"
     "    scShelfPage(false);\n"
     "    scShelfRender();\n"
     "  }")

swap('opening the streaming tab',
     "    scShelf.tab = 'streaming';\n"
     "    scShelf.open = true;\n"
     "    scShelfCss();\n"
     "    var sheet = scShelfSheet(), scrim = document.getElementById('scShelfScrim');\n"
     "    if(scrim){ scrim.classList.add('scShelfOpen'); }\n"
     "    if(sheet){ sheet.classList.add('scShelfOpen'); }\n"
     "    scStreamRender();\n"
     "    scShelfRender();",
     "    scShelf.tab = 'streaming';\n"
     "    scShelf.open = true;\n"
     "    scShelfCss();\n"
     "    scStreamRender();\n"
     "    scShelfPage(true);\n"
     "    scShelfRender();\n"
     "    scStreamBoot();")

# A tab is not a dialog: aria-hidden on it would take the page away from a screen
# reader for as long as it is open.
swap('the shelf is not a dialog',
     "    var sheet = scShelfSheet();\n"
     "    if(sheet){ sheet.setAttribute('aria-hidden', 'true'); sheet.setAttribute('role', 'dialog'); }\n"
     "    scShelfRender();",
     "    scShelfPage(false);\n"
     "    scShelfRender();")

# ---------------------------------------------------------------------------
# 3. The stream is FETCHED. scFetchBytes() is the downloader's own reader, so a
#    stream now travels the path that has been working for releases.
# ---------------------------------------------------------------------------
swap('the resolver keeps the mime type',
     "        scStreamState.alts = (r.alts || []).slice();",
     "        scStreamState.mime = String(r.mime || '');\n"
     "        scStreamState.alts = (r.alts || []).slice();")

SOURCE = (
    "  // " + MARKER + " - THE STREAM IS FETCHED, NOT POINTED AT.\n"
    "  // A googlevideo URL handed to an <audio> element is fetched by the media stack\n"
    "  // with none of the resolver's headers, so the source answers 403 and the row sits\n"
    "  // at 0:00 with an error the page never gets to read. scFetchBytes() is the reader\n"
    "  // the downloader has been using for releases - four ranges at a time, a short\n"
    "  // first read accepted as the whole file - so the song is read into a Blob and\n"
    "  // played from an object URL. On a device that fetch is the patched one, so CORS is\n"
    "  // not the limiter; on the web the plain URL is still the last try.\n"
    "  function scStreamSource(info){\n"
    "    var a = scStreamAudio();\n"
    "    var u = (info && info.url) || String(info || '');\n"
    "    var mime = String((info && info.mime) || '').split(';')[0].trim() || 'audio/mp4';\n"
    "    var size = (info && Number(info.size)) || 0;\n"
    "    if(!u) return Promise.resolve('');\n"
    "    scStreamSay('Loading the song…');\n"
    "    return Promise.resolve()\n"
    "      .then(function(){\n"
    "        return scFetchBytes(u, size, function(loaded, total){\n"
    "          var pct = total ? Math.round((loaded / total) * 100) : 0;\n"
    "          scStreamSay(pct > 0 ? 'Loading the song… ' + pct + '%' : 'Loading the song…');\n"
    "        });\n"
    "      })\n"
    "      .then(function(buf){\n"
    "        if(!buf) throw new Error('no bytes');\n"
    "        var blob = new Blob([buf], { type: mime });\n"
    "        if(!blob.size) throw new Error('empty');\n"
    "        if(scStreamState.blobUrl){ try{ URL.revokeObjectURL(scStreamState.blobUrl); }catch(_eRev){} }\n"
    "        scStreamState.blobUrl = URL.createObjectURL(blob);\n"
    "        a.src = scStreamState.blobUrl;\n"
    "        scStreamSay('');\n"
    "        return scStreamState.blobUrl;\n"
    "      })\n"
    "      .catch(function(){\n"
    "        a.src = u;\n"
    "        scStreamSay('');\n"
    "        return u;\n"
    "      });\n"
    "  }\n\n"
)

swap('the source helper',
     "  // --- the audio element -----------------------------------------------------\n",
     SOURCE + "  // --- the audio element -----------------------------------------------------\n")

# The element's own error path re-resolves and then has to fetch again.
swap('the error path fetches again',
     "        scStreamState.url = u; scStreamState.urlAt = Date.now();\n"
     "        a.src = u;\n"
     "        try{ a.currentTime = at; }catch(_e){}\n"
     "        Promise.resolve(a.play()).catch(function(){});\n"
     "        scStreamSay('');",
     "        scStreamState.url = u; scStreamState.urlAt = Date.now();\n"
     "        return scStreamSource({ url: u, mime: scStreamState.mime }).then(function(){\n"
     "          try{ a.currentTime = at; }catch(_e){}\n"
     "          Promise.resolve(a.play()).catch(function(){});\n"
     "        });")

# Already buffered: reuse the object URL rather than fetch the song twice.
swap('the buffered fast path',
     "    if(scStreamState.curId === String(id) && scStreamState.url && !scStreamStale(scStreamState.urlAt, Date.now())){\n"
     "      a.src = scStreamState.url;",
     "    if(scStreamState.curId === String(id) && scStreamState.blobUrl && !scStreamStale(scStreamState.urlAt, Date.now())){\n"
     "      a.src = scStreamState.blobUrl;")

swap('the play path fetches',
     "      if(!u){ scStreamSay('No playable stream for this song right now'); return; }\n"
     "      a.src = u;\n"
     "      Promise.resolve(a.play()).then(function(){ scStreamSay(''); }).catch(function(){ scStreamSay('Tap play to start'); });",
     "      if(!u){ scStreamSay('No playable stream for this song right now'); return; }\n"
     "      return scStreamSource({ url: u, mime: scStreamState.mime }).then(function(){\n"
     "        return Promise.resolve(a.play()).then(function(){ scStreamSay(''); }).catch(function(){ scStreamSay('Tap play to start'); });\n"
     "      });")

# ---------------------------------------------------------------------------
# 4. The version and the changelog.
# ---------------------------------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD_VERSION,
     "const APP_VERSION = '%s';" % VERSION)

# The shell cache name lives in sw.js, and its prose in this page quotes one - so
# the page is left alone. A name bumped here by a careless replace is exactly how
# a sentence about the cache turns into a cache key.

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'Streaming is a tab, and a stream that plays', items: [\n"
    "    '[FULL] Streaming is the first of the three tabs above the library: tapping it puts the downloaded list away and the shelf takes its place, and tapping Library brings the list back exactly where it was.',\n"
    "    '[FULL] A stream is read through the same reader the rest of the app uses and played from memory, instead of being handed to the audio element as a bare link - which is why the play button used to sit at 0:00.',\n"
    "    '[FULL] Streaming shows how much of the song has arrived while it loads, so a slow source reads as loading instead of as nothing happening.',\n"
    "  ]},\n"
)
if "version: '" + VERSION + "'" not in SRC:
    anchor = "\n  { version: '%s'" % OLD_VERSION
    at = SRC.find(anchor)
    if at == -1:
        failed.append('changelog: no %s entry to insert before' % OLD_VERSION)
    else:
        SRC = SRC[:at + 1] + ENTRY + SRC[at + 1:]
        applied.append('the changelog entry')

if failed:
    print('patch-%s: %d applied, %d FAILED' % (VERSION.replace('.', ''), len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    # release.yml asks with --check whether the release is ALREADY on the page: a
    # zero exit means "nothing to do", and anything else means "pending". So while
    # the anchors are still there unapplied, this must fail - printing the steps is
    # only for the person reading the log.
    print('patch-80612: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80612: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
