#!/usr/bin/env python3
"""80.6.22 - part 3 of 3: the pages, the wiring, the storage and the hooks.

    python3 dev/patch-80622-c.py
    python3 dev/patch-80622-c.py --check
"""
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
MARKER = 'class="scs-row" data-hold="'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC:
    print('patch-80622: part 3 is already on the page')
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- a removed song leaves every list it was in ---------------------------
swap('a removed song leaves the albums too',
     "    scStreamState.playlists = (scStreamState.playlists || []).map(function(p){\n"
     "      return { name: String(p.name), items: scStreamPlItems(p).filter(function(x){ return String(x.id) !== String(id); }) };\n"
     "    }).filter(function(p){ return (p.items || []).length; });\n",
     "    scStreamState.playlists = (scStreamState.playlists || []).map(function(p){\n"
     "      return { name: String(p.name), items: scStreamPlItems(p).filter(function(x){ return String(x.id) !== String(id); }) };\n"
     "    }).filter(function(p){ return (p.items || []).length; });\n"
     "    scStreamState.albums = (scStreamState.albums || []).map(function(p){\n"
     "      return { name: String(p.name), items: scStreamPlItems(p).filter(function(x){ return String(x.id) !== String(id); }) };\n"
     "    }).filter(function(p){ return (p.items || []).length; });\n")

swap('a file can be filed as well as a stream',
     "  function scStreamToPlaylist(id){\n    var t = scStreamById(id);\n",
     "  function scStreamToPlaylist(id){\n    var t = scStreamEntry(id);\n")

swap('a new album, made the way a new playlist is',
     "    if(!(scStreamState.playlists || []).some(function(p){ return String(p.name) === name; })){\n"
     "      scStreamState.playlists = (scStreamState.playlists || []).concat([{ name: name, items: [] }]);\n"
     "      scStreamSave();\n"
     "      scStreamRender();\n"
     "    }\n  }\n",
     "    if(!(scStreamState.playlists || []).some(function(p){ return String(p.name) === name; })){\n"
     "      scStreamState.playlists = (scStreamState.playlists || []).concat([{ name: name, items: [] }]);\n"
     "      scStreamSave();\n"
     "      scStreamRender();\n"
     "    }\n  }\n"
     "  // 80.6.22 - AN ALBUM IS MADE THE WAY A PLAYLIST IS: same prompt, same store\n"
     "  // pattern, own key. The only difference is which list it lands in.\n"
     "  function scStreamNewAlbum(){\n"
     "    var name = '';\n"
     "    try{ name = prompt('Name the streaming album:', ''); }catch(_e){ name = ''; }\n"
     "    name = String(name == null ? '' : name).trim();\n"
     "    if(!name) return;\n"
     "    if(!scStreamAlbums().some(function(p){ return String(p.name) === name; })){\n"
     "      scStreamState.albums = scStreamAlbums().concat([{ name: name, items: [] }]);\n"
     "      scStreamSave();\n"
     "      scStreamRender();\n"
     "    }\n"
     "  }\n")

# -- the page shows whichever list is open --------------------------------
swap('the page opens whichever list is open',
     "    var open = scStreamState.pl ? (pls || []).filter(function(p){ return String(p.name) === String(scStreamState.pl); })[0] : null;",
     "    var open = scStreamState.pl ? scStreamListOpen() : null;")

swap('the page says how many and which kind',
     "      h += '<div style=\"font-size:11px;color:var(--ink-dim);\">' + (open.items || []).length + ' stream' + ((open.items || []).length === 1 ? '' : 's') + '</div>';",
     "      h += '<div style=\"font-size:11px;color:var(--ink-dim);\">' + (open.items || []).length + ' song' + ((open.items || []).length === 1 ? '' : 's')\n"
     "        + (scStreamState.plKind === 'al' ? ' \\u00b7 album' : ' \\u00b7 playlist') + '</div>';")

swap('the page offers both kinds of song',
     "      h += '<button type=\"button\" id=\"scStreamPlPlay\" style=\"border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:6px 12px;font-size:11.5px;\">Play all</button>';",
     "      h += '<button type=\"button\" id=\"scStreamListAdd\" style=\"border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:6px 10px;font-size:11px;\">Add songs</button>';\n"
     "      h += '<button type=\"button\" id=\"scStreamPlPlay\" style=\"border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:6px 12px;font-size:11.5px;\">Play all</button>';")

swap('a row in a list is held, and says which player owns it',
     "      (open.items || []).forEach(function(t){\n"
     "        var on = String(t.id) === String(scStreamState.curId);\n"
     "        h += '<div style=\"display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line);\">';\n"
     "        h += scStreamArt(t, 36);\n"
     "        h += '<button type=\"button\" class=\"scsp-play\" data-id=\"' + escapeHtml(String(t.id)) + '\" style=\"' + rowBtn + 'color:' + (on ? 'var(--coral)' : 'var(--ink)') + ';\">';\n"
     "        h += '<div style=\"font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(t.title || 'Untitled') + '</div>';\n"
     "        h += '<div style=\"font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(scStreamRowMeta(t)) + '</div>';\n"
     "        h += '</button>';\n"
     "        h += '<button type=\"button\" class=\"scsp-del\" data-id=\"' + escapeHtml(String(t.id)) + '\" title=\"Remove from this playlist\" style=\"border:none;background:none;color:var(--ink-dim);padding:4px 6px;line-height:0;\">' + scIcon('close', 14) + '</button>';\n"
     "        h += '</div>';\n"
     "      });",
     "      (open.items || []).forEach(function(t){\n"
     "        var on = String(t.id) === String(scStreamState.curId);\n"
     "        var isFile = String(t.kind || 's') === 'd';\n"
     "        h += '<div class=\"scsp-row\" data-hold=\"' + escapeHtml(String(t.id)) + '\" style=\"display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line);\">';\n"
     "        h += scStreamArt(t, 36);\n"
     "        h += '<button type=\"button\" class=\"scsp-play\" data-id=\"' + escapeHtml(String(t.id)) + '\" style=\"' + rowBtn + 'color:' + (on ? 'var(--coral)' : 'var(--ink)') + ';\">';\n"
     "        h += '<div style=\"font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(t.title || 'Untitled')\n"
     "          + (isFile ? '<span style=\"font-size:8.5px;font-weight:800;letter-spacing:1px;color:var(--ink-dim);margin-left:6px;vertical-align:1px;\">ON DEVICE</span>' : '') + '</div>';\n"
     "        h += '<div style=\"font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(scStreamRowMeta(t)) + '</div>';\n"
     "        h += '</button>';\n"
     "        h += '</div>';\n"
     "      });")

# -- the shelf: albums beside playlists, rows that are held ---------------
swap('the card offers a new album as well as a new playlist',
     "    h += '<button type=\"button\" id=\"scStreamNewPl\" style=\"background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;\">New playlist</button>';",
     "    h += '<button type=\"button\" id=\"scStreamNewPl\" style=\"background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;\">New playlist</button>';\n"
     "    h += '<button type=\"button\" id=\"scStreamNewAl\" style=\"background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;\">New album</button>';")

swap('the playlists and the albums are listed together',
     "    if((pls || []).length){\n"
     "      h += '<div style=\"display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;\">';\n"
     "      pls.forEach(function(p){\n"
     "        h += '<button type=\"button\" class=\"scs-pl\" data-name=\"' + escapeHtml(String(p.name)) + '\" style=\"border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:4px 9px;font-size:10.5px;\">' + escapeHtml(String(p.name)) + ' \\u00b7 ' + (p.items || []).length + '</button>';\n"
     "      });\n"
     "      h += '</div>';\n"
     "    }\n",
     "    h += scStreamListChips();\n")

swap('a shelf row is held, not closed',
     "      tracks.forEach(function(t){\n"
     "        var on = String(t.id) === String(scStreamState.curId);\n"
     "        h += '<div style=\"display:flex;align-items:center;gap:9px;padding:7px 2px;border-top:1px solid var(--line);\">';",
     "      tracks.forEach(function(t){\n"
     "        var on = String(t.id) === String(scStreamState.curId);\n"
     "        h += '<div class=\"scs-row\" data-hold=\"' + escapeHtml(String(t.id)) + '\" style=\"display:flex;align-items:center;gap:9px;padding:7px 2px;border-top:1px solid var(--line);\">';")

swap('the x leaves the shelf row',
     "          + '<button type=\"button\" class=\"scs-del\" data-id=\"' + escapeHtml(String(t.id)) + '\" title=\"Remove\" style=\"border:none;background:none;color:var(--ink-dim);padding:4px 6px;line-height:0;\">' + scIcon('close', 13) + '</button>'\n",
     "")

# -- the wiring -----------------------------------------------------------
swap('the shelf is wired for the hold and the new album',
     "    on('scStreamNewPl', 'click', scStreamNewPlaylist);",
     "    on('scStreamNewPl', 'click', scStreamNewPlaylist);\n"
     "    on('scStreamNewAl', 'click', scStreamNewAlbum);\n"
     "    on('scStreamListAdd', 'click', scStreamPickDownloads);")

swap('a row is held instead of closed',
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-del'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamRemove(this.getAttribute('data-id')); });\n"
     "    });\n",
     "    scStreamHold(host.querySelectorAll('.scs-row'), 'shelf');\n"
     "    scStreamHold(host.querySelectorAll('.scsp-row'), 'list');\n")

swap('the playlists and the albums both open',
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-pl'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamOpenPlaylist(this.getAttribute('data-name')); });\n"
     "    });\n",
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-pl'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamOpenList('pl', this.getAttribute('data-name')); });\n"
     "    });\n"
     "    Array.prototype.forEach.call(host.querySelectorAll('.scs-al'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamOpenList('al', this.getAttribute('data-name')); });\n"
     "    });\n")

swap('play all plays the open list, both kinds',
     "    on('scStreamPlPlay', 'click', function(){\n"
     "      var pl = (scStreamState.playlists || []).filter(function(p){ return String(p.name) === String(scStreamState.pl); })[0];\n"
     "      var first = ((pl && pl.items) || [])[0];\n"
     "      if(!first){ scStreamSay('That playlist is empty'); return; }\n"
     "      scStreamPlayFrom(first.id);\n"
     "    });\n",
     "    on('scStreamPlPlay', 'click', function(){\n"
     "      var l = scStreamListOpen();\n"
     "      var first = ((l && l.items) || [])[0];\n"
     "      if(!first){ scStreamSay('That list is empty'); return; }\n"
     "      scStreamPlayFrom(first.id);\n"
     "    });\n")

swap('the list rows are held too, and no row has an x',
     "    Array.prototype.forEach.call(host.querySelectorAll('.scsp-del'), function(b){\n"
     "      b.addEventListener('click', function(){ scStreamPlDrop(scStreamState.pl, this.getAttribute('data-id')); });\n"
     "    });\n",
     "")

swap('a list opens by its kind',
     "  function scStreamOpenPlaylist(name){\n"
     "    scStreamState.pl = String(name || '');\n"
     "    scStreamRender();\n"
     "    try{ var host = document.getElementById('scStreamBlock'); if(host) host.scrollTop = 0; }catch(_ePl){}\n"
     "  }\n",
     "  function scStreamOpenList(kind, name){\n"
     "    scStreamState.plKind = (kind === 'al') ? 'al' : 'pl';\n"
     "    scStreamState.pl = String(name || '');\n"
     "    scStreamRender();\n"
     "    try{ var host = document.getElementById('scStreamBlock'); if(host) host.scrollTop = 0; }catch(_ePl){}\n"
     "  }\n"
     "  function scStreamOpenPlaylist(name){ scStreamOpenList('pl', name); }\n")

swap('a song in a list plays the list',
     "  function scStreamPlayFrom(id){\n"
     "    var pl = scStreamState.pl ? (scStreamState.playlists || []).filter(function(p){ return String(p.name) === String(scStreamState.pl); })[0] : null;\n"
     "    var ids = ((pl && pl.items) || []).map(function(x){ return String(x.id); });\n"
     "    scStreamPlay(id, ids);\n"
     "  }\n",
     "  function scStreamPlayFrom(id){\n"
     "    var l = scStreamListOpen();\n"
     "    var items = (l && l.items) || [];\n"
     "    if(!items.length){ scStreamPlay(id); return; }\n"
     "    scMixPlay(items, id);\n"
     "  }\n")

# -- storage -------------------------------------------------------------
swap('the albums are loaded',
     "    var got = 0, ok = 0;",
     "    var got = 0, ok = 0;   // three stores: the shelf, the playlists, the albums")
swap('three answers before the shelf is settled',
     "      if(++got < 2) return;",
     "      if(++got < 3) return;")
swap('the albums are restored beside the playlists',
     "      var pls = scStreamRestore(kept, scStreamState.playlists || []);\n"
     "      pls.forEach(function(p){\n"
     "        (p.items || []).forEach(function(it){\n"
     "          if(it.id && !seen[it.id]){ seen[it.id] = 1; kept.push(it); }   // a song the list lost\n"
     "        });\n"
     "      });\n"
     "      scStreamState.tracks = kept;\n"
     "      scStreamState.playlists = pls;\n",
     "      var pls = scStreamRestore(kept, scStreamState.playlists || []);\n"
     "      var als = scStreamRestore(kept, scStreamState.albums || []);\n"
     "      pls.concat(als).forEach(function(p){\n"
     "        (p.items || []).forEach(function(it){\n"
     "          if(it.id && !seen[it.id] && it.kind !== 'd'){ seen[it.id] = 1; kept.push(it); }   // a song the list lost\n"
     "        });\n"
     "      });\n"
     "      scStreamState.tracks = kept;\n"
     "      scStreamState.playlists = pls;\n"
     "      scStreamState.albums = als;\n")
swap('the albums are read back',
     "      Promise.resolve(dbGet('meta', 'streamPlaylists')).then(function(r){\n"
     "        if(r && Array.isArray(r.value)) scStreamState.playlists = r.value;\n"
     "        ok++;\n"
     "        settle();\n"
     "      }).catch(function(){ settle(); });\n",
     "      Promise.resolve(dbGet('meta', 'streamPlaylists')).then(function(r){\n"
     "        if(r && Array.isArray(r.value)) scStreamState.playlists = r.value;\n"
     "        ok++;\n"
     "        settle();\n"
     "      }).catch(function(){ settle(); });\n"
     "      Promise.resolve(dbGet('meta', 'streamAlbums')).then(function(r){\n"
     "        if(r && Array.isArray(r.value)) scStreamState.albums = r.value;\n"
     "        ok++;\n"
     "        settle();\n"
     "      }).catch(function(){ settle(); });\n")
swap('the albums are written back',
     "    try{ dbPut('meta', { key: 'streamPlaylists', value: scStreamState.playlists || [] }); }catch(_e){}",
     "    try{ dbPut('meta', { key: 'streamPlaylists', value: scStreamState.playlists || [] }); }catch(_e){}\n"
     "    try{ dbPut('meta', { key: 'streamAlbums', value: scStreamState.albums || [] }); }catch(_e){}")

# -- the order across both players ---------------------------------------
swap('the stream hands an advance to the list first',
     "  function scStreamNext(dir){\n    var q = scStreamState.queue || [];",
     "  function scStreamNext(dir){\n"
     "    // 80.6.22 - a list that owns the order gets the advance first, so a song\n"
     "    // from the source can be followed by one from the device.\n"
     "    if(typeof scMix !== 'undefined' && scMix.active && scMixAdvance(dir)) return;\n"
     "    var q = scStreamState.queue || [];")

swap('the deck hands the last file of a list back to the list',
     "    if(repeatMode !== 'one' && typeof gaplessMode !== 'undefined' && gaplessMode && crossfadeSeconds === 0){",
     "    // 80.6.22 - A MIXED LIST OWNS THE ORDER, so the deck does not get to roll on\n"
     "    // past the last file of it. While the deck is inside a run of files the list\n"
     "    // holds it advances itself; at the end of that run the list takes over.\n"
     "    if(typeof scMix !== 'undefined' && scMix.active && scMix.lastFile){\n"
     "      var _scMixDone = String(pendingPlayId) === String(scMix.lastFile)\n"
     "        || (typeof queueIndex !== 'undefined' && typeof queue !== 'undefined' && queue.length > 1 && queueIndex === queue.length - 1);\n"
     "      if(_scMixDone && scMixAdvance(1)) return;\n"
     "    }\n"
     "    if(repeatMode !== 'one' && typeof gaplessMode !== 'undefined' && gaplessMode && crossfadeSeconds === 0){")

if failed:
    print('patch-80622: part 3, %d step(s) did not apply:' % len(failed))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80622: part 3 pending - %d step(s) to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80622: part 3 applied (%d steps) - the page is 80.6.22' % len(applied))
