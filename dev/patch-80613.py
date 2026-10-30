#!/usr/bin/env python3
"""80.6.13 - the streaming tab scrolls, a playlist keeps its songs, and a stream
that refuses says which step refused.

What the owner said, and what each edit answers:

  "it's hard to scroll down in the streaming mode"

  #library is a flex COLUMN with no scroller of its own; #listPane was the scroll
  area, and opening the shelf set listPane to display:none. So the shelf was the
  only child left, it had no height, no overflow and no bottom inset - the page
  below the first screenful was clipped by the viewport, which is exactly a page
  that will not scroll. The shelf is now the scroll area when it is up
  (flex:1 + min-height:0 + overflow-y:auto + the same bottom inset the list has),
  and the result list no longer has a scroll box of its own inside it.

  "it should like stay the playlist and metadata for the songs in the streaming
  playlist"

  A playlist stored ids, and nothing else: the cover, the artist and the length
  lived only in `tracks`, so a song dropped from the list took everything a
  playlist knew about it with it, and an id whose track was gone rendered as
  nothing. Playlists now store whole songs (id, videoId, title, artist, cover,
  length), they are migrated from the id-only shape on load, and a song a playlist
  still holds is added back to Streaming rather than silently vanishing.

  "and it doesn't work figure out a way to make it work"

  The resolver was never the problem: measured from this machine, both client
  shapes still answer with audio rows and the URL serves bounded ranges with 206.
  What was wrong is the way the bytes were read and the way a failure was
  reported. `scFetchBytes()` watches one global for the downloader's Stop button,
  so a stream read while that was still set came back one range deep and played
  a fragment; the resolver's own length was thrown away instead of being handed
  to the reader; and a failed read fell through to a bare link with no message,
  which is a play button that appears to do nothing. All three are fixed, and the
  row now names the step that refused.

Idempotent: the marker is 80.6.13 on the page plus the scrolled-shelf CSS.

    python3 dev/patch-80613.py
    python3 dev/patch-80613.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
INDEX = os.path.join(ROOT, 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.13'
OLD_VERSION = '80.6.12'
MARKER = '80.6.13 - THE SHELF IS THE SCROLL AREA'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80613: the page is already %s (%s) - nothing to do' % (VERSION, MARKER))
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
    """The whole `  function name(` ... `  }` block, by its own indentation."""
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
    """Replace a top-level function in the page's first script with `body`."""
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
# 1. The shelf is the scroll area, and the rail is three equal tabs.
# ---------------------------------------------------------------------------
swap('the shelf scrolls, the rail is a tab bar',
     "      '#scStreamBlock{position:relative;display:none;width:auto;overflow:visible;',\n"
     "      'background:none;border:0;box-shadow:none;transform:none;visibility:visible;',\n"
     "      'padding:2px 0 26px;margin:0}',\n"
     "      '#scStreamBlock.scShelfOpen{display:block}',\n"
     "      '#scShelfScrim{display:none}',\n"
     "      '#scShelfRail{display:flex;gap:8px;margin:0 20px 10px;overflow-x:auto;',\n"
     "      'scrollbar-width:none;-webkit-overflow-scrolling:touch}',\n"
     "      '#scShelfRail::-webkit-scrollbar{display:none}',\n"
     "      '#scShelfRail .scshelf-tab{flex:0 0 auto;border:1px solid var(--line);background:none;',\n"
     "      'color:var(--ink-dim);border-radius:999px;padding:7px 14px;font-size:12px;',\n"
     "      'font-family:var(--font-ui);transition:background .18s ease,color .18s ease}',\n"
     "      '#scShelfRail .scshelf-tab.on{background:var(--ink);color:var(--bg);border-color:var(--ink)}',",

     "      '#scStreamBlock{position:relative;display:none;width:auto;overflow:visible;',\n"
     "      'background:none;border:0;box-shadow:none;transform:none;visibility:visible;',\n"
     "      'padding:2px 0 26px;margin:0}',\n"
     "      // " + MARKER + ". #library is a flex column with no scroller: it was\n"
     "      // #listPane that scrolled, and putting that pane away left the shelf as the only\n"
     "      // child of a column with no height and no overflow - so the page under the first\n"
     "      // screenful was clipped instead of scrolled. The shelf owns the scroll while it is\n"
     "      // up, with the inset the list uses so the last row clears the dock.\n"
     "      '#scStreamBlock.scShelfOpen{display:block;flex:1 1 auto;min-height:0;overflow-y:auto;',\n"
     "      'overscroll-behavior:contain;-webkit-overflow-scrolling:touch;',\n"
     "      'padding:2px 0 calc(var(--list-bottom-inset, 96px) + var(--sc-dock-h, 0px) + env(safe-area-inset-bottom))}',\n"
     "      '#scShelfScrim{display:none}',\n"
     "      // The library's own filter tabs belong to its own page; while Streaming is the\n"
     "      // page, the three shelf tabs are the tabs.\n"
     "      '#library.scShelfOn #tabs{display:none}',\n"
     "      '#scShelfRail{display:none}',\n"
     "      '#scShelfRail.scShelfRailOn{display:flex;gap:6px;margin:0 14px 12px;position:relative;z-index:21;padding:2px}',\n"
     "      '#scShelfRail .scshelf-tab{flex:1 1 0;min-width:0;height:40px;border:1px solid var(--line);',\n"
     "      'background:var(--bg-raised);color:var(--ink-dim);border-radius:12px;font-size:12.5px;',\n"
     "      'font-family:var(--font-ui);transition:background .2s ease,color .2s ease,transform .12s ease}',\n"
     "      '#scShelfRail .scshelf-tab:active{transform:scale(.97)}',\n"
     "      '#scShelfRail .scshelf-tab.on{background:var(--accent, var(--ink));color:var(--bg);border-color:transparent;font-weight:600}',")

swap('the shelf class on the library view', 
     "  function scShelfPage(on){\n"
     "    var sheet = scShelfSheet(), list = document.getElementById('listPane');\n"
     "    if(sheet){ if(on) sheet.classList.add('scShelfOpen'); else sheet.classList.remove('scShelfOpen'); }\n"
     "    if(list){ list.style.display = on ? 'none' : ''; }\n"
     "  }",
     "  function scShelfPage(on){\n"
     "    var sheet = scShelfSheet(), list = document.getElementById('listPane');\n"
     "    var view = document.getElementById('library');\n"
     "    if(sheet){ if(on) sheet.classList.add('scShelfOpen'); else sheet.classList.remove('scShelfOpen'); }\n"
     "    if(list){ list.style.display = on ? 'none' : ''; }\n"
     "    if(view){ if(on) view.classList.add('scShelfOn'); else view.classList.remove('scShelfOn'); }\n"
     "  }")

# The result list scrolled inside the shelf. Two nested scrollers is why a drag
# that started on a result never reached the page underneath it.
swap('the results are not a scroller of their own',
     "      h += '<div style=\"margin-top:10px;max-height:230px;overflow:auto;\">';",
     "      h += '<div style=\"margin-top:10px;padding-bottom:2px;\">';")

# ---------------------------------------------------------------------------
# 2. Playlists keep whole songs.
# ---------------------------------------------------------------------------
PL_HELPERS = r'''
  // 80.6.13 - A PLAYLIST HOLDS ITS SONGS, NOT THEIR NAMES. The id-only shape was
  // enough to play a song while it was still in Streaming, and nothing else: the
  // title, the artist and the cover lived in the other list, so a song that left
  // Streaming left a playlist with an id that renders as nothing. A playlist item
  // is the song.
  function scStreamPlItem(t){
    t = t || {};
    return {
      id: String(t.id || ''),
      videoId: String(t.videoId || ''),
      title: String(t.title || 'Untitled'),
      artist: String(t.artist || ''),
      dur: Number(t.dur) || 0,
      thumb: String(t.thumb || '')
    };
  }
  function scStreamPlItems(p){
    var out = [], i;
    if(!p) return out;
    if(Array.isArray(p.items)){
      for(i = 0; i < p.items.length; i++) out.push(scStreamPlItem(p.items[i]));
      return out;
    }
    // The shape every playlist saved before 80.6.13 has.
    var ids = Array.isArray(p.ids) ? p.ids : [];
    for(i = 0; i < ids.length; i++) out.push({ id: String(ids[i]), videoId: '', title: '', artist: '', dur: 0, thumb: '' });
    return out;
  }
  // Read: fill what the old shape never stored from the track list, and hand back
  // the songs a playlist still holds so the caller can put them back in Streaming.
  function scStreamRestore(tracks, playlists){
    var byId = {};
    (tracks || []).forEach(function(t){ if(t && t.id) byId[String(t.id)] = t; });
    return (playlists || []).map(function(p){
      var items = scStreamPlItems(p).map(function(it){
        var t = byId[String(it.id)];
        if(t){
          if(!it.videoId) it.videoId = String(t.videoId || '');
          if(!it.title || it.title === 'Untitled') it.title = String(t.title || it.title);
          if(!it.artist) it.artist = String(t.artist || '');
          if(!it.thumb) it.thumb = String(t.thumb || '');
          if(!it.dur) it.dur = Number(t.dur) || 0;
        }
        return it;
      }).filter(function(it){ return !!(it.id && it.videoId); });
      return { name: String((p && p.name) || ''), items: items };
    }).filter(function(p){ return !!p.name; });
  }
'''

# Insert the helpers just above the pure playlist functions.
swap('the playlist helpers',
     "  // Playlists are lists of stream ids in their own key. Adding the same song twice is a\n"
     "  // no-op rather than a duplicate, which is what an add button tapped twice looks like.\n",
     "  // Playlists are their own key. Adding the same song twice is a no-op rather than a\n"
     "  // duplicate, which is what an add button tapped twice looks like.\n" + PL_HELPERS)

set_func('scStreamPlAdd', r'''  function scStreamPlAdd(list, name, track){
    var out = [], i, found = false;
    name = String(name == null ? '' : name).trim();
    var item = scStreamPlItem(track);
    if(!name || !item.id) return (list || []).slice();
    for(i = 0; i < (list || []).length; i++){
      var p = list[i] || {};
      var items = scStreamPlItems(p).slice();
      if(String(p.name) === name){
        found = true;
        if(!items.some(function(x){ return String(x.id) === item.id; })) items.push(item);
      }
      out.push({ name: String(p.name), items: items });
    }
    if(!found) out.push({ name: name, items: [item] });
    return out;
  }''')

set_func('scStreamPlRemove', r'''  function scStreamPlRemove(list, name, id){
    var out = [];
    (list || []).forEach(function(p){
      p = p || {};
      if(String(p.name) !== String(name)){ out.push({ name: String(p.name), items: scStreamPlItems(p) }); return; }
      var items = scStreamPlItems(p).filter(function(x){ return String(x.id) !== String(id); });
      if(items.length) out.push({ name: String(p.name), items: items });
    });
    return out;
  }''')

set_func('scStreamLoad', r'''  function scStreamLoad(){
    scStreamState.tracks = [];
    scStreamState.playlists = [];
    var got = 0, ok = 0;
    function settle(){
      if(++got < 2) return;
      // A store that did not answer must never be written over with empties: that
      // is how a shelf comes back empty after a restart it actually survived.
      if(!ok){ scStreamRender(); return; }
      var seen = {}, kept = [];
      (scStreamState.tracks || []).forEach(function(t){
        var id = String((t && t.id) || '');
        if(!id || seen[id]) return;
        seen[id] = 1;
        kept.push(scStreamPlItem(t));
      });
      var pls = scStreamRestore(kept, scStreamState.playlists || []);
      pls.forEach(function(p){
        (p.items || []).forEach(function(it){
          if(it.id && !seen[it.id]){ seen[it.id] = 1; kept.push(it); }   // a song the list lost
        });
      });
      scStreamState.tracks = kept;
      scStreamState.playlists = pls;
      scStreamState.ready = true;
      scStreamSave();            // and the id-only shape is retired on the way out
      scStreamRender();
      scShelfRender();
    }
    try{
      Promise.resolve(dbGet('meta', 'streamTracks')).then(function(r){
        if(r && Array.isArray(r.value)) scStreamState.tracks = r.value;
        ok++;
        settle();
      }).catch(function(){ settle(); });
      Promise.resolve(dbGet('meta', 'streamPlaylists')).then(function(r){
        if(r && Array.isArray(r.value)) scStreamState.playlists = r.value;
        ok++;
        settle();
      }).catch(function(){ settle(); });
    }catch(_e){ settle(); settle(); }
  }''')

set_func('scStreamRemove', r'''  function scStreamRemove(id){
    scStreamState.tracks = (scStreamState.tracks || []).filter(function(t){ return String(t.id) !== String(id); });
    scStreamState.playlists = (scStreamState.playlists || []).map(function(p){
      return { name: String(p.name), items: scStreamPlItems(p).filter(function(x){ return String(x.id) !== String(id); }) };
    }).filter(function(p){ return (p.items || []).length; });
    if(String(scStreamState.curId) === String(id)){
      try{ scStreamAudio().pause(); }catch(_e){}
      scStreamState.curId = '';
      scStreamState.blobUrl = '';
    }
    if(scStreamState.pl && !(scStreamState.playlists || []).some(function(p){ return String(p.name) === String(scStreamState.pl); })) scStreamState.pl = '';
    scStreamSave();
    scStreamRender();
  }''')

set_func('scStreamToPlaylist', r'''  function scStreamToPlaylist(id){
    var t = scStreamById(id);
    if(!t){ scStreamSay('That song is not in Streaming any more'); return; }
    var name = '';
    try{ name = prompt('Add to a streaming playlist (type a new name to create one):', ''); }catch(_e){ name = ''; }
    name = String(name == null ? '' : name).trim();
    if(!name) return;
    scStreamState.playlists = scStreamPlAdd(scStreamState.playlists || [], name, t);
    scStreamSave();
    scStreamRender();
    scStreamSay('In \u201c' + name + '\u201d');
  }''')

swap('a new playlist holds songs',
     "      scStreamState.playlists = (scStreamState.playlists || []).concat([{ name: name, ids: [] }]);",
     "      scStreamState.playlists = (scStreamState.playlists || []).concat([{ name: name, items: [] }]);")

# ---------------------------------------------------------------------------
# 3. The play path: the real length, a reader that is not cancel-flagged, and a
#    message that names the step.
# ---------------------------------------------------------------------------
swap('the resolver keeps the length',
     "        scStreamState.mime = String(r.mime || '');\n"
     "        scStreamState.alts = (r.alts || []).slice();",
     "        scStreamState.mime = String(r.mime || '');\n"
     "        scStreamState.size = Number(r.size) || 0;\n"
     "        scStreamState.alts = (r.alts || []).slice();")

HELPERS = r'''
  // What the page's transport said the last time it was asked. A refusal that
  // cannot name a step is a refusal the owner cannot act on.
  function scStreamReason(){
    var why = '';
    try{ why = String(window.__scHttpWhy || ''); }catch(_eWhy){}
    return why;
  }
  function scStreamArt(t, size){
    var s = Number(size) || 36;
    var th = String((t && t.thumb) || '');
    var box = 'width:' + s + 'px;height:' + s + 'px;border-radius:9px;flex:0 0 auto;object-fit:cover;' +
      'background:var(--bg);border:1px solid var(--line);display:block;';
    if(!th) return '<div style="' + box + '"></div>';
    return '<img src="' + escapeHtml(th) + '" alt="" loading="lazy" style="' + box + '">';
  }
  function scStreamOpenPlaylist(name){
    scStreamState.pl = String(name || '');
    scStreamRender();
    try{ var host = document.getElementById('scStreamBlock'); if(host) host.scrollTop = 0; }catch(_ePl){}
  }
  function scStreamPlayFrom(id){
    var pl = scStreamState.pl ? (scStreamState.playlists || []).filter(function(p){ return String(p.name) === String(scStreamState.pl); })[0] : null;
    var ids = ((pl && pl.items) || []).map(function(x){ return String(x.id); });
    scStreamPlay(id, ids);
  }
  function scStreamPlDrop(name, id){
    scStreamState.playlists = scStreamPlRemove(scStreamState.playlists || [], name, id);
    scStreamSave();
    scStreamRender();
  }
'''

set_func('scStreamSource', r'''  function scStreamSource(info){
    var a = scStreamAudio();
    var u = (info && info.url) || String(info || '');
    var mime = String((info && info.mime) || '').split(';')[0].trim() || 'audio/mp4';
    var size = (info && Number(info.size)) || 0;
    if(!u) return Promise.resolve('');
    scStreamSay('Loading the song\u2026');
    // A STOPPED DOWNLOAD MUST NOT TRUNCATE A STREAM. scFetchBytes()
    // watches one global for the downloader's Stop button; a stream read while that was
    // still set came back one range deep and played a fragment of the song.
    var wasCancel = !!window.__scCancelDl;
    window.__scCancelDl = false;
    function restore(){ try{ window.__scCancelDl = wasCancel; }catch(_eRestore){} }
    return Promise.resolve()
      .then(function(){
        return scFetchBytes(u, size, function(loaded, total){
          var pct = total ? Math.round((loaded / total) * 100) : 0;
          scStreamSay(pct > 0 ? 'Loading the song\u2026 ' + pct + '%' : 'Loading the song\u2026');
        });
      })
      .then(function(buf){
        if(!buf) throw new Error('no bytes');
        var blob = new Blob([buf], { type: mime });
        if(!blob.size) throw new Error('empty');
        if(scStreamState.blobUrl){ try{ URL.revokeObjectURL(scStreamState.blobUrl); }catch(_eRev){} }
        scStreamState.blobUrl = URL.createObjectURL(blob);
        scStreamState.bytes = Number(blob.size) || 0;
        a.src = scStreamState.blobUrl;
        restore();
        scStreamSay('');
        return scStreamState.blobUrl;
      })
      .catch(function(){
        restore();
        // The bytes could not be read here. The link itself is still worth one try -
        // a media element is not held to CORS - and if that fails too, the next error
        // names what refused instead of leaving the row at 0:00.
        window.__scStreamWhy = scStreamReason() || 'the source sent no bytes';
        a.src = u;
        scStreamSay(scStreamReason() ? 'Could not read the song (' + scStreamReason() + ') - trying the link itself' : '');
        return u;
      });
  }

''' + HELPERS)

set_func('scStreamPlay', r'''  function scStreamPlay(id, ctxIds){
    var t = scStreamById(id);
    if(!t){ return; }
    var a = scStreamAudio();
    scStreamState.curId = String(id);
    scStreamState.fixes = 0;
    scStreamState.queue = (ctxIds && ctxIds.length) ? ctxIds.slice() : (scStreamState.tracks || []).map(function(x){ return String(x.id); });
    scStreamSay('Loading the stream\u2026');
    scStreamRender();
    function go(){
      var need = !scStreamState.url || scStreamStale(scStreamState.urlAt, Date.now());
      if(!need){ return Promise.resolve(scStreamState.url); }
      return scStreamResolve(t.videoId).then(function(u){
        if(u){ scStreamState.url = u; scStreamState.urlAt = Date.now(); }
        return u;
      });
    }
    if(scStreamState.curId === String(id) && scStreamState.blobUrl && !scStreamStale(scStreamState.urlAt, Date.now())){
      a.src = scStreamState.blobUrl;
      Promise.resolve(a.play()).catch(function(){ scStreamSay('Tap play to start'); });
      scStreamSay('');
      return;
    }
    Promise.resolve(go()).then(function(u){
      if(!u){ scStreamSay('No playable stream for this song right now'); return; }
      return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(){
        return Promise.resolve(a.play()).then(function(){ scStreamSay(''); }).catch(function(){ scStreamSay('Tap play to start'); });
      });
    }).catch(function(){
      scStreamSay('This source will not play this song - tap play to try again');
    });
  }''')

set_func('scStreamToggle', r'''  function scStreamToggle(){
    var a = scStreamAudio();
    if(!scStreamState.curId){
      var first = (scStreamState.tracks || [])[0];
      if(first) scStreamPlay(first.id);
      return;
    }
    if(!a.src){ scStreamPlay(scStreamState.curId); return; }
    if(window.__scStreamPulling){ return; }
    if(a.paused){
      window.__scStreamPulling = true;
      Promise.resolve(a.play()).then(function(){ scStreamSay(''); })
        .catch(function(){ scStreamSay('Tap play again to start'); })
        .then(function(){ window.__scStreamPulling = false; });
    } else {
      a.pause();
    }
  }''')

swap('one repair per song, then an honest stop',
     "      var t = scStreamById(scStreamState.curId);\n"
     "      if(!t || !t.videoId || scStreamState.busy){ scStreamSay('This stream stopped - tap it again'); return; }\n"
     "      var at = a.currentTime || 0;\n"
     "      scStreamState.busy = true;",
     "      var t = scStreamById(scStreamState.curId);\n"
     "      if(!t || !t.videoId || scStreamState.busy){ scStreamSay('This stream stopped - tap it again'); return; }\n"
     "      // One repair attempt per song. A source that is refusing every candidate used\n"
     "      // to send the row round this handler for ever, which reads as a dead button.\n"
     "      scStreamState.fixes = (scStreamState.fixes || 0) + 1;\n"
     "      if(scStreamState.fixes > 1){ scStreamSay('This source will not play this song - tap play to try again'); window.__scStreamWhy = ''; return; }\n"
     "      var at = a.currentTime || 0;\n"
     "      scStreamState.busy = true;")

swap('the repair keeps the length',
     "        return scStreamSource({ url: u, mime: scStreamState.mime }).then(function(){\n"
     "          try{ a.currentTime = at; }catch(_e){}",
     "        return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(){\n"
     "          try{ a.currentTime = at; }catch(_e){}")

# The state object gains the two fields the renderer and the repair path read.
swap('the shelf state',
     "  var scStreamState = {\n"
     "    tracks: null, playlists: null, results: null, curId: '', url: '', urlAt: 0,\n"
     "    busy: false, ready: false, q: '', built: false, audio: null, playing: false\n"
     "  };",
     "  var scStreamState = {\n"
     "    tracks: null, playlists: null, results: null, curId: '', url: '', urlAt: 0,\n"
     "    busy: false, ready: false, q: '', built: false, audio: null, playing: false,\n"
     "    mime: '', size: 0, bytes: 0, fixes: 0, pl: '', alts: [], blobUrl: ''\n"
     "  };")

# ---------------------------------------------------------------------------
# 4. The page itself: a playlist is a page, rows carry their own metadata, and
#    the rail is three equal tabs with an aria state.
# ---------------------------------------------------------------------------
set_func('scStreamRender', r'''  function scStreamRender(){
    if(!SC_STREAM_OK) return;
    var host = document.getElementById('scStreamBlock');
    if(!host) return;
    var tracks = scStreamState.tracks;
    var pls = scStreamState.playlists;
    if(tracks === null || pls === null) return;
    var cur = scStreamById(scStreamState.curId);
    var card = 'margin:2px 20px 10px;padding:12px;border:1px solid var(--line);border-radius:16px;background:var(--bg-raised);';
    var rowBtn = 'flex:1;min-width:0;text-align:left;background:none;border:none;padding:0;';
    var h = '';
    var open = scStreamState.pl ? (pls || []).filter(function(p){ return String(p.name) === String(scStreamState.pl); })[0] : null;
    // 80.6.13 - A PLAYLIST IS A PAGE. It shows the songs it holds with the cover,
    // the artist and the length each one was saved with, and it survives a restart
    // because it no longer depends on another list to tell it what its ids were.
    if(open){
      h += '<div style="' + card + '">';
      h += '<div style="display:flex;align-items:center;gap:8px;">';
      h += '<button type="button" id="scStreamPlBack" aria-label="Back to Streaming" style="background:none;border:none;color:var(--ink);padding:4px;line-height:0;">' + scIcon('back', 18) + '</button>';
      h += '<div style="flex:1;min-width:0;">';
      h += '<div style="font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(open.name) + '</div>';
      h += '<div style="font-size:11px;color:var(--ink-dim);">' + (open.items || []).length + ' stream' + ((open.items || []).length === 1 ? '' : 's') + '</div>';
      h += '</div>';
      h += '<button type="button" id="scStreamPlPlay" style="border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:6px 12px;font-size:11.5px;">Play all</button>';
      h += '</div>';
      h += '<div style="margin-top:10px;">';
      (open.items || []).forEach(function(t){
        var on = String(t.id) === String(scStreamState.curId);
        h += '<div style="display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--line);">';
        h += scStreamArt(t, 36);
        h += '<button type="button" class="scsp-play" data-id="' + escapeHtml(String(t.id)) + '" style="' + rowBtn + 'color:' + (on ? 'var(--coral)' : 'var(--ink)') + ';">';
        h += '<div style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(t.title || 'Untitled') + '</div>';
        h += '<div style="font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(t.artist || 'Streaming') + (t.dur ? ' \u00b7 ' + scStreamTime(t.dur) : '') + '</div>';
        h += '</button>';
        h += '<button type="button" class="scsp-del" data-id="' + escapeHtml(String(t.id)) + '" title="Remove from this playlist" style="border:none;background:none;color:var(--ink-dim);padding:4px 6px;line-height:0;">' + scIcon('close', 14) + '</button>';
        h += '</div>';
      });
      if(!(open.items || []).length) h += '<div style="font-size:11.5px;color:var(--ink-dim);padding:8px 0;">Nothing in this playlist yet.</div>';
      h += '</div>';
      h += '<div id="scStreamSay" style="font-size:11px;color:var(--coral);min-height:14px;margin-top:8px;"></div>';
      h += '</div>';
      host.innerHTML = h;
      scStreamWire();
      scStreamTick();
      return;
    }
    h += '<div style="' + card + '">';
    h += '<div style="display:flex;align-items:center;gap:8px;">';
    h += '<span style="font-size:13.5px;font-weight:700;">Streaming</span>';
    h += '<span style="font-size:9.5px;letter-spacing:.6px;text-transform:uppercase;color:var(--coral);border:1px solid color-mix(in srgb, var(--coral) 45%, transparent);border-radius:999px;padding:2px 7px;">Experimental</span>';
    h += '<span style="flex:1;"></span>';
    h += '<button type="button" id="scStreamNewPl" style="background:none;border:1px solid var(--line);color:var(--ink-dim);border-radius:999px;padding:5px 10px;font-size:11px;">New playlist</button>';
    h += '</div>';
    h += '<div style="font-size:11px;color:var(--ink-dim);margin-top:6px;line-height:1.5;">Plays from the source. Nothing is saved to your device, and a source can expire.</div>';
    h += '<div style="display:flex;gap:8px;margin-top:10px;">';
    h += '<input id="scStreamQuery" type="text" placeholder="Search a song to stream\u2026" value="' + escapeHtml(scStreamState.q || '') + '" style="flex:1;min-width:0;background:var(--bg);border:1px solid var(--line);color:var(--ink);border-radius:12px;padding:8px 10px;font-size:12.5px;">';
    h += '<button type="button" id="scStreamGo" style="padding:8px 14px;border-radius:12px;border:none;background:var(--accent, var(--ink));color:var(--bg);font-size:12px;font-weight:700;">' + scIcon('search', 13) + ' Search</button>';
    h += '</div>';
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
    if(scStreamState.results){
      h += '<div style="margin-top:10px;padding-bottom:2px;">';
      if(!scStreamState.results.length){
        h += '<div style="font-size:12px;color:var(--ink-dim);padding:6px 2px;">Nothing found.</div>';
      }
      scStreamState.results.forEach(function(it, i){
        var ttl = String(it.title || 'Untitled');
        var who = String(it.author || it.channel || '');
        h += '<div style="display:flex;align-items:center;gap:9px;padding:6px 2px;border-top:1px solid var(--line);">'
          + '<div style="flex:1;min-width:0;"><div style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(ttl) + '</div>'
          + '<div style="font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(who) + '</div></div>'
          + '<button type="button" class="scs-add" data-i="' + i + '" style="border:1px solid var(--line);background:none;color:var(--ink);border-radius:999px;padding:5px 10px;font-size:11px;line-height:1;">' + scIcon('plus', 13) + ' Add</button>'
          + '</div>';
      });
      h += '</div>';
    }
    if(cur){
      h += '<div style="margin-top:12px;padding:10px;border-radius:12px;background:var(--bg);border:1px solid var(--line);">';
      h += '<div style="font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(cur.title) + '</div>';
      h += '<div style="font-size:10.5px;color:var(--ink-dim);">' + escapeHtml(cur.artist || 'Streaming') + '</div>';
      h += '<input id="scStreamBar" type="range" min="0" max="0" value="0" step="0.5" style="width:100%;margin:8px 0 2px;">';
      h += '<div style="display:flex;align-items:center;gap:10px;">';
      h += '<button type="button" id="scStreamPrev" aria-label="Previous" style="background:none;border:none;color:var(--ink);line-height:0;padding:6px;">' + scIcon('prev', 18) + '</button>';
      h += '<button type="button" id="scStreamPlay" aria-label="Play or pause" style="background:var(--accent, var(--ink));border:none;color:var(--bg);border-radius:999px;width:36px;height:36px;line-height:0;">' + scIcon(scStreamState.playing ? 'pause' : 'play', 18) + '</button>';
      h += '<button type="button" id="scStreamNextB" aria-label="Next" style="background:none;border:none;color:var(--ink);line-height:0;padding:6px;">' + scIcon('next', 18) + '</button>';
      h += '<span id="scStreamAt" style="font-size:10.5px;color:var(--ink-dim);font-variant-numeric:tabular-nums;"></span>';
      h += '</div></div>';
    }
    h += '<div id="scStreamSay" style="font-size:11px;color:var(--coral);min-height:14px;margin-top:8px;"></div>';
    if((pls || []).length){
      h += '<div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px;">';
      pls.forEach(function(p){
        h += '<button type="button" class="scs-pl" data-name="' + escapeHtml(String(p.name)) + '" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:4px 9px;font-size:10.5px;">' + escapeHtml(String(p.name)) + ' \u00b7 ' + (p.items || []).length + '</button>';
      });
      h += '</div>';
    }
    if((tracks || []).length){
      h += '<div style="margin-top:10px;">';
      tracks.forEach(function(t){
        var on = String(t.id) === String(scStreamState.curId);
        h += '<div style="display:flex;align-items:center;gap:9px;padding:7px 2px;border-top:1px solid var(--line);">';
        h += scStreamArt(t, 36);
        h += '<button type="button" class="scs-play" data-id="' + escapeHtml(String(t.id)) + '" style="' + rowBtn + 'color:' + (on ? 'var(--coral)' : 'var(--ink)') + ';">'
          + '<div style="font-size:12.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(t.title) + '</div>'
          + '<div style="font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">' + escapeHtml(t.artist || 'Streaming') + (t.dur ? ' \u00b7 ' + scStreamTime(t.dur) : '') + '</div>'
          + '</button>'
          + '<button type="button" class="scs-list" data-id="' + escapeHtml(String(t.id)) + '" title="Add to a streaming playlist" style="border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:3px 8px;font-size:10.5px;line-height:1;">' + scIcon('plus', 12) + '</button>'
          + '<button type="button" class="scs-del" data-id="' + escapeHtml(String(t.id)) + '" title="Remove" style="border:none;background:none;color:var(--ink-dim);padding:4px 6px;line-height:0;">' + scIcon('close', 13) + '</button>'
          + '</div>';
      });
      h += '</div>';
    } else {
      h += '<div style="font-size:11.5px;color:var(--ink-dim);margin-top:8px;">Nothing here yet \u2014 search for a song above and add it.</div>';
    }
    h += '</div>';
    host.innerHTML = h;
    scStreamWire();
    scStreamTick();
  }''')

set_func('scShelfRender', r'''  function scShelfRender(){
    if(!SC_STREAM_OK) return;                 // no rail, no sheet, outside the full builds
    var rail = document.getElementById('scShelfRail');
    if(!rail) return;
    var tabs = [['streaming', 'Streaming'], ['library', 'Library'], ['albums', 'Albums']];
    // The rail is a tab bar: three equal tabs, the page you are on filled - and it
    // only exists where streaming does, so a build without it has no empty strip.
    rail.className = 'scShelfRailOn';
    rail.innerHTML = tabs.map(function(t){
      var on = (t[0] === 'streaming') ? scShelf.open : (!scShelf.open && scShelf.tab === t[0]);
      return '<button type="button" class="scshelf-tab' + (on ? ' on' : '') + '" data-shelf="' + t[0] + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        escapeHtml(t[1]) + '</button>';
    }).join('');
    Array.prototype.forEach.call(rail.querySelectorAll('.scshelf-tab'), function(b){
      b.addEventListener('click', function(){ scShelfOpenTab(this.getAttribute('data-shelf')); });
    });
  }''')

set_func('scShelfOpenTab', r'''  function scShelfOpenTab(tab){
    if(!SC_STREAM_OK) return;
    if(tab === 'library' || tab === 'albums'){
      scShelf.tab = tab;
      scShelfClose();
      scStreamState.pl = '';
      try{
        if(tab === 'albums'){ if(typeof libraryMode !== 'undefined'){ libraryMode = 'albums'; } }
        else { if(typeof libraryMode !== 'undefined'){ libraryMode = 'playlists'; } }
        if(typeof navigate === 'function') navigate('library');
        if(typeof renderTabs === 'function') renderTabs();
        if(typeof renderList === 'function') renderList();
      }catch(_eShelf){}
      return;
    }
    scShelf.tab = 'streaming';
    scShelf.open = true;
    scShelfCss();
    scStreamRender();
    scShelfPage(true);
    scShelfRender();
    scStreamBoot();
  }''')

set_func('scStreamWire', r'''  function scStreamWire(){
    var host = document.getElementById('scStreamBlock');
    if(!host) return;
    function on(id, ev, fn){ var e = document.getElementById(id); if(e) e.addEventListener(ev, fn); }
    on('scStreamGo', 'click', function(){
      var i = document.getElementById('scStreamQuery');
      scStreamSearchRun(i ? i.value : '');
    });
    on('scStreamQuery', 'keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); scStreamSearchRun(this.value); } });
    on('scStreamNewPl', 'click', scStreamNewPlaylist);
    on('scStreamClose', 'click', scShelfClose);
    on('scStreamRec', 'click', scShelfRecommend);
    Array.prototype.forEach.call(host.querySelectorAll('.scs-pin'), function(b){
      b.addEventListener('click', function(){ scShelfPinSearch(this.getAttribute('data-name')); });
    });
    on('scStreamPlay', 'click', scStreamToggle);
    on('scStreamPrev', 'click', function(){ scStreamNext(-1); });
    on('scStreamNextB', 'click', function(){ scStreamNext(1); });
    on('scStreamBar', 'input', function(){ try{ scStreamAudio().currentTime = Number(this.value) || 0; }catch(_e){} });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-add'), function(b){
      b.addEventListener('click', function(){ scStreamAddResult((scStreamState.results || [])[Number(this.getAttribute('data-i'))]); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-play'), function(b){
      b.addEventListener('click', function(){ scStreamPlay(this.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-list'), function(b){
      b.addEventListener('click', function(){ scStreamToPlaylist(this.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scs-del'), function(b){
      b.addEventListener('click', function(){ scStreamRemove(this.getAttribute('data-id')); });
    });
    // A playlist chip opens the playlist. It used to start track one, which made
    // every playlist a single button and none of them a page.
    Array.prototype.forEach.call(host.querySelectorAll('.scs-pl'), function(b){
      b.addEventListener('click', function(){ scStreamOpenPlaylist(this.getAttribute('data-name')); });
    });
    on('scStreamPlBack', 'click', function(){ scStreamOpenPlaylist(''); });
    on('scStreamPlPlay', 'click', function(){
      var pl = (scStreamState.playlists || []).filter(function(p){ return String(p.name) === String(scStreamState.pl); })[0];
      var first = ((pl && pl.items) || [])[0];
      if(!first){ scStreamSay('That playlist is empty'); return; }
      scStreamPlayFrom(first.id);
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scsp-play'), function(b){
      b.addEventListener('click', function(){ scStreamPlayFrom(this.getAttribute('data-id')); });
    });
    Array.prototype.forEach.call(host.querySelectorAll('.scsp-del'), function(b){
      b.addEventListener('click', function(){ scStreamPlDrop(scStreamState.pl, this.getAttribute('data-id')); });
    });
  }''')

# ---------------------------------------------------------------------------
# 5. The version and its entry.
# ---------------------------------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD_VERSION,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'Streaming is a tab that scrolls, and playlists that stay', items: [\n"
    "    '[FULL] Streaming scrolls like a page now: the shelf owns the scroll from the search box to the last song, and a long list of results is part of that page instead of a small box that scrolls by itself inside it.',\n"
    "    '[FULL] A streaming playlist is a page with its songs - cover, artist and length included - and it is still there after a restart. The songs in it are saved with the playlist instead of being looked up by name, so nothing drops out of a playlist when it leaves the shelf.',\n"
    "    '[FULL] A stream is read past a stopped download without being cut short, and a song the source refuses now says which step refused instead of sitting at 0:00.',\n"
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
    print('patch-80613: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80613: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
