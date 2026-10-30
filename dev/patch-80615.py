#!/usr/bin/env python3
"""80.6.15 - the rail leaves the song's space, and a link that goes quiet is read.

Two things asked for in one message:

  * THE THREE TABS ARE ICONS ON THE RIGHT. Streaming, Library and Albums were a row of
    full-width pills, which spent a band of the screen on three words and pushed the
    songs down to pay for it. They are one small column of glyphs on the right edge
    now, floating over the list, with the label kept for a screen reader and a long
    press. Nothing under them moves: the rail is fixed, so it takes no room in the
    page, and the shelf and list keep the scroll they already had.

  * A LINK THAT STARTS AND THEN SAYS NOTHING. Some WebViews resolve play() and then
    never decode a byte, and fire no error event at all - the row sits at 0:00 and
    looks exactly like a player that did nothing. Six seconds with no progress on the
    same song now hands the song to the read path, which is the path the downloader
    already uses.

Idempotent: the marker is 80.6.15 on the page plus the watch helper.

    python3 dev/patch-80615.py
    python3 dev/patch-80615.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
INDEX = os.path.join(ROOT, 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.15'
OLD_VERSION = '80.6.14'
MARKER = '80.6.15 - THE RAIL IS ICONS ON THE RIGHT, AND A SILENT LINK IS READ'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80615: the page is already %s (%s) - nothing to do' % (VERSION, MARKER))
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


def func_span(src, name):
    key = '\n  function %s(' % name
    at = src.find(key)
    if at == -1:
        raise LookupError(name)
    start = at + 1
    end = src.find('\n  }\n', start)
    if end == -1:
        raise LookupError(name)
    return start, end + len('\n  }\n')


def set_func(name, body):
    global SRC
    try:
        start, end = func_span(SRC, name)
    except LookupError:
        failed.append('function %s: not found' % name)
        return
    text = body.decode('utf-8') if isinstance(body, bytes) else body
    if not text.endswith('\n'):
        text += '\n'
    SRC = SRC[:start] + text + SRC[end:]
    applied.append('function %s' % name)


# ---------------------------------------------------------------------------
# 1. The rail: a fixed column of glyphs on the right edge, over the list.
# ---------------------------------------------------------------------------
swap('the rail is a floating icon column',
     "      '#scShelfRail{display:none}',\n"
     "      '#scShelfRail.scShelfRailOn{display:flex;gap:6px;margin:0 14px 12px;position:relative;z-index:21;padding:2px}',\n"
     "      '#scShelfRail .scshelf-tab{flex:1 1 0;min-width:0;height:40px;border:1px solid var(--line);',\n"
     "      'background:var(--bg-raised);color:var(--ink-dim);border-radius:12px;font-size:12.5px;',\n"
     "      'font-family:var(--font-ui);transition:background .2s ease,color .2s ease,transform .12s ease}',\n"
     "      '#scShelfRail .scshelf-tab:active{transform:scale(.97)}',\n"
     "      '#scShelfRail .scshelf-tab.on{background:var(--accent, var(--ink));color:var(--bg);border-color:transparent;font-weight:600}',\n",
     "      '#scShelfRail{display:none;height:0}',\n"
     "      // 80.6.15 - THE RAIL IS ICONS, ON THE RIGHT, OVER THE SONGS. Three full-width\n"
     "      // pills spent a band of the screen on three words and pushed the list down to\n"
     "      // pay for it. The rail is fixed, so it costs the page no room at all: the shelf\n"
     "      // and the list keep the scroll and the inset they already had.\n"
     "      '#scShelfRail.scShelfRailOn{display:flex;flex-direction:column;gap:6px;height:auto;',\n"
     "      'position:fixed;right:8px;top:50%;margin:0;padding:5px;z-index:70;',\n"
     "      'transform:translateY(-50%);border-radius:999px;pointer-events:none;',\n"
     "      'background:color-mix(in srgb, var(--bg-raised) 84%, transparent);',\n"
     "      'border:1px solid var(--line);box-shadow:0 10px 26px rgba(0,0,0,.28);',\n"
     "      'backdrop-filter:blur(14px) saturate(1.2);-webkit-backdrop-filter:blur(14px) saturate(1.2)}',\n"
     "      // Only the glyphs catch a tap: the gaps between them and the rail's own padding\n"
     "      // pass the touch through to the song underneath, which is the row the owner is\n"
     "      // reaching for nine times out of ten.\n"
     "      '#scShelfRail .scshelf-tab{pointer-events:auto;width:32px;height:32px;flex:0 0 auto;',\n"
     "      'display:grid;place-items:center;padding:0;border:0;border-radius:999px;background:none;',\n"
     "      'color:var(--ink-dim);line-height:0;-webkit-tap-highlight-color:transparent;touch-action:manipulation;',\n"
     "      'transition:background .22s cubic-bezier(.22,.61,.36,1),color .22s cubic-bezier(.22,.61,.36,1),',\n"
     "      'transform .14s ease,box-shadow .22s ease}',\n"
     "      '#scShelfRail .scshelf-tab:active{transform:scale(.9)}',\n"
     "      '#scShelfRail .scshelf-tab.on{background:var(--accent, var(--ink));color:var(--bg);',\n"
     "      'box-shadow:0 2px 10px color-mix(in srgb, var(--accent, var(--ink)) 45%, transparent)}',\n"
     "      '#scShelfRail .scshelf-tab.on:active{transform:scale(.94)}',\n"
     "      '@media (prefers-reduced-motion: reduce){#scShelfRail .scshelf-tab{transition:none}}',\n")

# ---------------------------------------------------------------------------
# 2. Three glyphs, so the rail has something to draw.
# ---------------------------------------------------------------------------
swap('the three rail icons',
     "      back: 'M14.7 6.3 13.3 4.9 6.2 12l7.1 7.1 1.4-1.4L9 12z'\n",
     "      back: 'M14.7 6.3 13.3 4.9 6.2 12l7.1 7.1 1.4-1.4L9 12z',\n"
     "      // 80.6.15 - the rail's three: a waveform for the stream, ruled lines for the\n"
     "      // library, a grid for the albums. Paths, like the rest, so they take the tab's\n"
     "      // colour and cannot be re-fonted by a WebView.\n"
     "      stream: 'M4.5 9h2.6v6H4.5zm4.6-3h2.6v12H9.1zm4.6-3h2.6v18h-2.6zm4.6 5h2.6v8h-2.6z',\n"
     "      list: 'M4 6h16v2H4zm0 5h16v2H4zm0 5h10.5v2H4z',\n"
     "      grid: 'M4 4h7.2v7.2H4zm8.8 0H20v7.2h-7.2zM4 12.8h7.2V20H4zm8.8 0H20V20h-7.2z'\n")

set_func('scShelfRender', r'''  function scShelfRender(){
    if(!SC_STREAM_OK) return;                 // no rail, no sheet, outside the full builds
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    // 80.6.15 - ICONS, NOT THREE WORDS. Same three pages, same data-shelf values, so
    // the wiring below and scShelfOpenTab() are untouched; the label moved into
    // aria-label and title where it still answers "which is this" on a long press.
    var tabs = [['streaming', 'Streaming', 'stream'], ['library', 'Library', 'list'], ['albums', 'Albums', 'grid']];
    rail.className = 'scShelfRailOn';
    rail.innerHTML = tabs.map(function(t){
      var on = (t[0] === 'streaming') ? scShelf.open : (!scShelf.open && scShelf.tab === t[0]);
      return '<button type="button" class="scshelf-tab' + (on ? ' on' : '') + '" data-shelf="' + t[0] + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '" aria-label="' + escapeHtml(t[1]) + '"' +
        ' title="' + escapeHtml(t[1]) + '">' + scIcon(t[2], 17) + '</button>';
    }).join('');
    Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){
      b.addEventListener('click', function(){ scShelfOpenTab(this.getAttribute('data-shelf')); });
    });
  }''')

# ---------------------------------------------------------------------------
# 3. A link that starts and then says nothing gets read.
# ---------------------------------------------------------------------------
WATCH = r'''
  // 80.6.15 - THE RAIL IS ICONS ON THE RIGHT, AND A SILENT LINK IS READ
  // THE LINK HAS SIX SECONDS TO MAKE A SOUND. A WebView is free to resolve
  // play(), load the metadata and then never decode a byte, firing no error at all -
  // the row sits at 0:00 and the owner is right that nothing happened. Progress is
  // the only honest sign of a stream that is playing, so the clock is read time.
  var scStreamWatchT = null;
  function scStreamWatch(u){
    var id = String(scStreamState.curId || '');
    var a = scStreamAudio();
    var at0 = 0;
    try{ at0 = Number(a.currentTime) || 0; }catch(_eAt0){}
    if(scStreamWatchT){ clearTimeout(scStreamWatchT); scStreamWatchT = null; }
    scStreamWatchT = setTimeout(function(){
      scStreamWatchT = null;
      if(String(scStreamState.curId || '') !== id) return;      // another song took over
      var now = 0;
      try{ now = Number(a.currentTime) || 0; }catch(_eAt1){}
      if(now > at0 + 0.4) return;                                // it is playing
      if(!a.paused && !a.error) scStreamState.err = 'the link went quiet';
      if(scStreamState.via === 'read') return;                   // already reading
      return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){
        if(!src) return;
        return scStreamStart(src);
      });
    }, 6000);
  }
''' + r'''
'''

swap('the watch helper',
     "  // 80.6.14 - THE ELEMENT IS IN THE PAGE, THE LINK IS TRIED FIRST\n",
     WATCH + "  // 80.6.14 - THE ELEMENT IS IN THE PAGE, THE LINK IS TRIED FIRST\n")

set_func('scStreamPlay', r'''  function scStreamPlay(id, ctxIds){
    var t = scStreamById(id);
    if(!t){ return; }
    scStreamState.curId = String(id);
    scStreamState.fixes = 0;
    scStreamState.err = '';
    scStreamState.bytes = 0;
    scStreamState.ready = false;
    scStreamState.queue = (ctxIds && ctxIds.length) ? ctxIds.slice() : (scStreamState.tracks || []).map(function(x){ return String(x.id); });
    scStreamSay('Loading the stream\u2026');
    scStreamRender();
    Promise.resolve(scStreamResolve(t.videoId)).then(function(u){
      if(!u){
        scStreamSay('No playable stream for this song right now' + (scStreamReason() ? ' (' + scStreamReason() + ')' : ''));
        scStreamTick();
        return;
      }
      scStreamState.via = 'link';
      // The link first, in the tap. If the element refuses it - a 403 on the
      // open-ended range, which is what googlevideo answers - the song is read in
      // bounded ranges and played from an object URL instead.
      return scStreamStart(u).then(function(ok){
        if(ok){ scStreamWatch(u); return; }
        scStreamState.err = 'the link was refused';
        return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){
          if(!src) return;
          return scStreamStart(src);
        });
      });
    }).catch(function(){
      scStreamState.err = 'the play call failed';
      scStreamSay('This source will not play this song - tap Restart');
      scStreamTick();
    });
  }''')

# ---------------------------------------------------------------------------
# 4. The version and its entry.
# ---------------------------------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD_VERSION,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'Three tabs become three icons, and a silent link gets read', items: [\n"
    "    '[FULL] Streaming, Library and Albums are one small column of icons on the right edge now, floating over the songs instead of a row of pills above them - so the list keeps the screen it had, and the rail costs the page no room at all.',\n"
    "    '[FULL] The rail takes only the taps that land on a glyph: the gaps and its own padding pass through to the song underneath.',\n"
    "    '[FULL] A stream link that starts and then makes no sound for six seconds is read instead, and the card says so - some players resolve a play and then decode nothing, with no error to show for it.',\n"
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
    print('patch-80615: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80615: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80615: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
