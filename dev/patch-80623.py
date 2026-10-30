#!/usr/bin/env python3
"""80.6.23 - streaming moves into the Library and the Albums, and the rail stops flickering.

    python3 dev/patch-80623.py
    python3 dev/patch-80623.py --check

Idempotent: a second run over the patched page is a no-op and --check says so.
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.23'
OLD = '80.6.22'
MARKER = '80.6.23 - THE RAIL IS TWO PAGES AND ONE SWITCH'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80623: already on the page, the page is %s' % VERSION)
    sys.exit(0 if CHECK else 0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


def func(name, body):
    """Replace a whole top-level function, from its first line to its closing brace."""
    global SRC
    start = SRC.find('  function ' + name + '(')
    if start < 0:
        failed.append('%s: not found' % name)
        return
    end = SRC.find('\n  }\n', start)
    if end < 0:
        failed.append('%s: no closing brace' % name)
        return
    end += len('\n  }\n')
    if SRC[start:end] == body:
        applied.append(name + ' (unchanged)')
        return
    SRC = SRC[:start] + body + SRC[end:]
    applied.append(name)


# -- one more glyph in the icon set: what is on the device ------------------
swap('a device glyph for the switch',
     "      grid: 'M4 4h7.2v7.2H4zm8.8 0H20v7.2h-7.2zM4 12.8h7.2V20H4zm8.8 0H20V20h-7.2z'",
     "      grid: 'M4 4h7.2v7.2H4zm8.8 0H20v7.2h-7.2zM4 12.8h7.2V20H4zm8.8 0H20V20h-7.2z',\n"
     "      // 80.6.23 - the switch's other half: a song coming down onto the device.\n"
     "      device: 'M11 3h2v8.6l3.3-3.3 1.4 1.4L12 15.4 6.3 9.7l1.4-1.4L11 11.6V3zM5 19h14v2H5z'")

# -- the rail's own rules: a divider, and the switch's colour ---------------
swap('the rail says which source is up',
     "      '#scShelfHead{display:flex;align-items:center;gap:8px;padding:0 16px 6px}',",
     "      // 80.6.23 - THE RAIL IS TWO PAGES AND ONE SWITCH. The third glyph is not a\n"
     "      // page: it is the source, so it sits under a hairline, and its colour is the\n"
     "      // only thing that changes when it is flipped.\n"
     "      '#scShelfRail .scshelf-sep{height:1px;background:var(--line);margin:2px 5px;flex:0 0 auto}',\n"
     "      '#scShelfRail .scshelf-src{position:relative}',\n"
     "      '#scShelfRail .scshelf-src.s-on{color:var(--coral)}',\n"
     "      '#scShelfRail .scshelf-src.s-on::after{content:\"\";position:absolute;right:4px;top:4px;width:5px;height:5px;border-radius:999px;background:var(--coral)}',\n"
     "      '#scShelfHead{display:flex;align-items:center;gap:8px;padding:0 16px 6px}',")

# -- the state: a page and a source, not a third page -----------------------
swap('the shelf carries a page and a source',
     "  var scShelf = { tab: 'library', open: false, built: false };",
     "  // 80.6.23 - THE RAIL IS TWO PAGES, AND BOTH CAN SHOW EITHER SOURCE. `page` is the\n"
     "  // app's own screen (library or albums); `src` is 'd' for what is on the device and\n"
     "  // 's' for what plays from the source. Streaming is no longer a page apart: it is\n"
     "  // the other side of the page that is already up.\n"
     "  var scShelf = { page: 'library', src: 'd', open: false, built: false };")

# -- the rail is built once, then marked ------------------------------------
func('scShelfRender', '''  function scShelfRender(){
    if(!SC_STREAM_OK) return;                 // no rail, no sheet, outside the full builds
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    // 80.6.23 - THE RAIL IS BUILT ONCE. 80.6.15 rebuilt the whole strip on every render:
    // a fresh element for each tab, so a tapped tab could not animate, its press state
    // was thrown away before it finished, and a fixed rail with a blur behind it settled
    // visibly every time one was chosen. The buttons are made here and never again;
    // scShelfMark() only moves the mark from one glyph to the next.
    if(rail.getAttribute('data-built') !== '1'){
      var pages = [['library', 'Library', 'list'], ['albums', 'Albums', 'grid']];
      var h = pages.map(function(t){
        return '<button type="button" class="scshelf-tab" data-shelf="' + t[0] + '"' +
          ' aria-pressed="false" aria-label="' + escapeHtml(t[1]) + '"' +
          ' title="' + escapeHtml(t[1]) + '">' + scIcon(t[2], 17) + '</button>';
      }).join('');
      h += '<div class="scshelf-sep"></div>';
      h += '<button type="button" class="scshelf-tab scshelf-src" data-src="1"' +
        ' aria-pressed="false" aria-label="On device" title="On this device">' + scIcon('device', 17) + '</button>';
      rail.innerHTML = h;
      rail.setAttribute('data-built', '1');
      Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){
        b.addEventListener('click', function(){
          if(this.getAttribute('data-src') === '1'){ scShelfSetSrc(scShelf.src === 's' ? 'd' : 's'); return; }
          scShelfOpenTab(this.getAttribute('data-shelf'));
        });
      });
    }
    rail.className = 'scShelfRailOn';
    scShelfMark();
  }
  function scShelfMark(){
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){
      if(b.getAttribute('data-src') === '1'){
        var s = (scShelf.src === 's');
        b.className = 'scshelf-tab scshelf-src' + (s ? ' s-on' : '');
        b.innerHTML = scIcon(s ? 'stream' : 'device', 17);
        b.setAttribute('aria-pressed', s ? 'true' : 'false');
        b.setAttribute('aria-label', s ? 'Streaming' : 'On device');
        b.setAttribute('title', s ? 'Streaming - tap to show what is on this device' : 'On this device - tap to stream');
        return;
      }
      var on = (b.getAttribute('data-shelf') === scShelf.page);
      b.className = 'scshelf-tab' + (on ? ' on' : '');
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
  }
''')

func('scShelfClose', '''  function scShelfClose(){
    scShelf.src = 'd';
    scShelfApply();
  }
''')

func('scShelfOpenTab', '''  function scShelfOpenTab(tab){
    if(!SC_STREAM_OK) return;
    if(tab === 'streaming'){ scShelf.page = 'library'; scShelf.src = 's'; scShelfApply(); return; }
    var page = (tab === 'albums') ? 'albums' : 'library';
    // 80.6.23 - A PAGE THAT IS ALREADY UP IS NOT DRAWN AGAIN. Tapping the page you are
    // on is not a request for it, and repainting it is the rest of the same flicker.
    if(page === scShelf.page && scShelf.src === 'd' && !scShelf.open){ scShelfMark(); return; }
    scShelf.page = page;
    scShelfApply();
  }
''')

# -- and the switch itself, plus the one function that paints a page --------
swap('the switch and the apply',
     "  function scShelfBoot(){\n",
     '''  function scShelfSetSrc(src){
    if(!SC_STREAM_OK) return;
    var want = (src === 's') ? 's' : 'd';
    if(scShelf.src === want){ scShelfMark(); return; }
    scShelf.src = want;
    scShelfApply();
  }
  // 80.6.23 - ONE PAINTER FOR A PAGE AND A SOURCE. Whatever is asked for - a tab, the
  // switch, a close - it goes through here, so the rail, the page, the library mode and
  // the store cannot disagree about what is up. On the device side navigate() owns the
  // renders; it is only painted by hand when there is no navigate() to ask.
  function scShelfApply(){
    if(!SC_STREAM_OK) return;
    var page = (scShelf.page === 'albums') ? 'albums' : 'library';
    scStreamState.pl = '';
    try{
      if(typeof libraryMode !== 'undefined') libraryMode = (page === 'albums') ? 'albums' : 'playlists';
      if(typeof navigate === 'function') navigate('library');
    }catch(_eShelf){}
    if(scShelf.src === 's'){
      scShelf.open = true;
      scShelfCss();
      scStreamRender();
      scShelfPage(true);
      scStreamBoot();
      try{ var top = document.getElementById('scStreamBlock'); if(top) top.scrollTop = 0; }catch(_eTop){}
      scShelfMark();
      return;
    }
    scShelf.open = false;
    scShelfPage(false);
    // 80.6.23 - ONE PAINT. scShelfOpenTab used to call navigate() and then renderTabs()
    // and renderList() itself, so a tab that was tapped drew its page twice in the same
    // frame: the strip scrolled, jumped back and scrolled again, which is the flicker.
    if(typeof navigate !== 'function'){
      try{
        if(typeof renderTabs === 'function') renderTabs();
        if(typeof renderList === 'function') renderList();
      }catch(_eShelf2){}
    }
    scShelfMark();
  }
  function scShelfBoot(){
''')

# -- a list is a tile, the way an album is --------------------------------
swap('a streaming list is a tile',
     "  function scStreamNewPlaylist(){\n",
     '''  // 80.6.23 - A LIST IS A TILE, THE WAY AN ALBUM IS. The chips were a row of words
  // under a search box, which is the right shape on the shelf and the wrong one on a
  // page of albums. On the albums page a streaming album is drawn the way the app
  // draws an album: a cover, a name, and how many songs it holds.
  function scShelfGrid(kind, list){
    var isAl = (kind === 'al');
    if(!(list || []).length){
      return '<div style="font-size:11.5px;color:var(--ink-dim);margin-top:10px;line-height:1.5;">'
        + (isAl ? 'No streaming albums yet. Make one here, then add songs to it from the shelf or from a row popup.'
                : 'No streaming playlists yet. Make one on the shelf, then add songs to it.') + '</div>';
    }
    var h = '<div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;margin-top:10px;">';
    (list || []).forEach(function(p){
      var items = (p && p.items) || [];
      var th = scStreamThumb(items[0] || {});
      var name = String((p && p.name) || '');
      h += '<button type="button" class="' + (isAl ? 'scs-al' : 'scs-pl') + '" data-name="' + escapeHtml(name) + '"'
        + ' style="display:block;width:100%;padding:0;border:0;background:none;color:var(--ink);text-align:left;">';
      if(th){
        h += '<img src="' + escapeHtml(th) + '" alt="" loading="lazy" style="width:100%;aspect-ratio:1/1;'
          + 'border-radius:12px;border:1px solid var(--line);object-fit:cover;display:block;">';
      }else{
        h += '<div style="width:100%;aspect-ratio:1/1;border-radius:12px;border:1px solid var(--line);'
          + 'background:var(--bg);display:grid;place-items:center;color:var(--ink-dim);">'
          + scIcon(isAl ? 'grid' : 'list', 22) + '</div>';
      }
      h += '<div style="font-size:12px;font-weight:600;margin-top:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(name) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--ink-dim);">' + items.length + ' song' + (items.length === 1 ? '' : 's') + '</div>';
      h += '</button>';
    });
    h += '</div>';
    return h;
  }

  // 80.6.23 - THE PLUS ASKS, AND IT ASKS BOTH. It was one thing - a playlist, named in a
  // prompt - so an album could not be started from the shelf at all, and a list that
  // already existed still had to be typed out exactly. It now offers the two kinds, and
  // then the lists that exist, with a name box only for a new one.
  function scStreamAddTo(id){
    if(!scStreamEntry(id)){ scStreamSay('That song is not in Streaming any more'); return; }
    scStreamSheet('Add to a list', [
      { label: 'Add to a playlist\\u2026', run: function(){ scStreamPickList('pl', id); } },
      { label: 'Add to an album\\u2026', run: function(){ scStreamPickList('al', id); } }
    ]);
  }
  function scStreamPickList(kind, id){
    var t = scStreamEntry(id);
    if(!t){ scStreamSay('That song is not in Streaming any more'); return; }
    var isAl = (kind === 'al');
    var lists = isAl ? scStreamAlbums() : (scStreamState.playlists || []);
    var acts = [];
    (lists || []).forEach(function(p){
      var name = String((p && p.name) || '');
      var n = ((p && p.items) || []).length;
      acts.push({ label: name + ' \\u00b7 ' + n + ' song' + (n === 1 ? '' : 's'), run: function(){
        if(isAl) scStreamState.albums = scLibAdd(scStreamAlbums(), name, t);
        else scStreamState.playlists = scLibAdd(scStreamState.playlists || [], name, t);
        scStreamSave();
        scStreamRender();
        scStreamSay('In \\u201c' + name + '\\u201d');
      } });
    });
    acts.push({ label: (isAl ? 'New album' : 'New playlist') + '\\u2026', run: function(){
      if(isAl) scStreamToAlbum(id); else scStreamToPlaylist(id);
    } });
    scStreamSheet(isAl ? 'Add to an album' : 'Add to a playlist', acts);
  }
  function scStreamNewPlaylist(){
''')

# -- the albums page, when the switch says streaming ----------------------
swap('the albums page shows the albums',
     "    var open = scStreamState.pl ? scStreamListOpen() : null;\n",
     "    var open = scStreamState.pl ? scStreamListOpen() : null;\n"
     "    // 80.6.23 - THE ALBUMS PAGE, WHEN THE SWITCH SAYS STREAMING. These albums are\n"
     "    // found where albums are found, drawn the way an album is drawn, and opened as\n"
     "    // the same page a downloaded album opens as - the switch changes the source and\n"
     "    // nothing else about where a thing lives.\n"
     "    if(!open && scShelf.src === 's' && scShelf.page === 'albums'){\n"
     "      h += '<div style=\"' + card + '\">';\n"
     "      h += '<div style=\"display:flex;align-items:center;gap:8px;\">';\n"
     "      h += '<span style=\"font-size:13.5px;font-weight:700;\">Streaming albums</span>';\n"
     "      h += '<span style=\"flex:1;\"></span>';\n"
     "      h += '<button type=\"button\" id=\"scStreamNewAl\" style=\"background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;\">New album</button>';\n"
     "      h += '</div>';\n"
     "      h += '<div style=\"font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;\">Albums of songs that play from the source, and of files already on this device. Nothing on this page is downloaded.</div>';\n"
     "      h += scShelfGrid('al', scStreamAlbums());\n"
     "      h += '<div id=\"scStreamSay\" style=\"font-size:11px;color:var(--coral);min-height:14px;margin-top:8px;\"></div>';\n"
     "      h += '</div>';\n"
     "      host.innerHTML = h;\n"
     "      scStreamWire();\n"
     "      scStreamTick();\n"
     "      return;\n"
     "    }\n")

# -- the shelf points at them, instead of listing them again --------------
swap('the shelf points at the albums page',
     "    row('Albums', 'al', scStreamAlbums());",
     "    // 80.6.23 - albums are not chips under a search box any more; they are on the\n"
     "    // albums page, and this is the way across to them.\n"
     "    if(scStreamAlbums().length){\n"
     "      h += '<button type=\"button\" id=\"scStreamAlLink\" style=\"margin-top:9px;display:flex;align-items:center;gap:8px;width:100%;'\n"
     "        + 'border:1px solid var(--line);border-radius:12px;background:none;color:var(--ink);padding:8px 10px;text-align:left;\">'\n"
     "        + scIcon('grid', 14)\n"
     "        + '<span style=\"flex:1;font-size:11.5px;\">Streaming albums</span>'\n"
     "        + '<span style=\"font-size:10.5px;color:var(--ink-dim);\">' + scStreamAlbums().length + '</span>'\n"
     "        + scIcon('next', 13) + '</button>';\n"
     "    }")

swap('the way across is wired',
     "    on('scStreamNewAl', 'click', scStreamNewAlbum);",
     "    on('scStreamNewAl', 'click', scStreamNewAlbum);\n"
     "    on('scStreamAlLink', 'click', function(){ scShelf.page = 'albums'; scShelfApply(); });")

# -- a row's plus opens the choice, not a prompt --------------------------
swap('the plus names both lists',
     "title=\"Add to a streaming playlist\"",
     "title=\"Add to a playlist or an album\"")

swap('the plus opens the choice',
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-list'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamToPlaylist(this.getAttribute('data-id')); });\n"
     "    });",
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-list'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamAddTo(this.getAttribute('data-id')); });\n"
     "    });")

# -- the release itself ---------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

swap('the changelog', "  const CHANGELOG = [\n",
     "  const CHANGELOG = [\n"
     "  { version: '80.6.23', date: '2026-10-30', title: 'Streaming moves into your Library and Albums', items: [\n"
     "    '[FULL] Streaming lives in the pages you already use. One extra glyph on the side rail switches the page you are on between what is on your device and what plays from the source: Albums shows your streaming albums, Library shows the streaming shelf.',\n"
     "    '[FULL] A streaming album looks like an album - a cover, a name, how many songs it holds - and opens as a page with Add songs and Play all. New album is on the Albums page, beside the albums it makes.',\n"
     "    '[FULL] The plus on a streaming row now asks both questions, add to a playlist or add to an album, and both offer the lists you already have; a name box appears only when you want a new one.',\n"
     "    '[FULL] The side rail no longer flickers as you move between pages, and a page is drawn once instead of twice.'\n"
     "  ]},\n")

if failed:
    print('patch-80623: %d step(s) did not apply:' % len(failed))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80623: pending - %d step(s) to apply, the page is %s' % (len(applied), OLD))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80623: applied (%d steps), the page is %s' % (len(applied), VERSION))
