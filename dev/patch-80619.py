#!/usr/bin/env python3
"""80.6.19 - a stream that starts sooner, keeps its genre, and a rail that stays put.

Four things:
  * the read begins in the same tap as the link, the silent-link wait is 2.4s instead
    of 6s, and a song already read plays from memory - so a replay or a step back is
    instant and a first play no longer waits for the link to fail first;
  * Next keeps the genre: the next song is the next one in the same genre, the card
    says what is up next, and when the list has nothing left in that genre it offers
    a tap for more of it;
  * the genre row keeps its scroll position across every redraw;
  * twelve more genres.

    python3 dev/patch-80619.py
    python3 dev/patch-80619.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.19'
OLD = '80.6.18'
MARKER = '80.6.19 - THE NEXT SONG KEEPS THE GENRE'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80619: the page is already %s - nothing to do' % VERSION)
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


# ── state ────────────────────────────────────────────────────────────────
swap('the state remembers the rail',
     "    via: '', err: '', barOn: false, genre: '', genres: null\n  };",
     "    via: '', err: '', barOn: false, genre: '', genres: null, railLeft: 0\n  };")

# ── the memory, and the faster start ─────────────────────────────────────
CACHE = r'''  // 80.6.19 - A SONG THAT WAS READ IS REMEMBERED, AND THE READ NO LONGER WAITS.
  // Two costs made a stream feel slow, and neither was the network being slow:
  //   1. the read started only AFTER the link had failed - and the silent-link watch
  //      sat on it for six seconds first, so a refused link cost six seconds before
  //      any bytes moved;
  //   2. nothing was kept, so the same song read again read again from zero.
  // The read now begins in the same tap as the link (whichever answers first wins the
  // ear), the silent wait is 2.4s, and the last few songs stay in memory as object
  // URLs, so a replay, a previous, or a return costs no network at all.
  var scStreamCache = {};
  var SC_STREAM_CACHE_MAX = 3;
  var SC_STREAM_CACHE_MS = 12 * 60 * 1000;
  function scStreamCacheDrop(videoId){
    var k = String(videoId || '');
    var e = k && scStreamCache[k];
    if(!e) return;
    try{ URL.revokeObjectURL(e.url); }catch(_eCd){}
    delete scStreamCache[k];
  }
  function scStreamCacheGet(videoId){
    var k = String(videoId || '');
    var e = k && scStreamCache[k];
    if(!e) return null;
    if(Date.now() - (Number(e.at) || 0) > SC_STREAM_CACHE_MS){ scStreamCacheDrop(k); return null; }
    return e;
  }
  function scStreamCachePut(videoId, entry){
    var k = String(videoId || '');
    if(!k || !entry || !entry.url) return;
    var keys = Object.keys(scStreamCache);
    if(keys.length >= SC_STREAM_CACHE_MAX){
      keys.sort(function(a, b){ return (scStreamCache[a].at || 0) - (scStreamCache[b].at || 0); });
      if(keys[0]) scStreamCacheDrop(keys[0]);
    }
    scStreamCache[k] = {
      url: String(entry.url),
      mime: String(entry.mime || ''),
      size: Number(entry.size) || 0,
      at: Date.now()
    };
    // The cache owns this URL now, so the next read must not revoke it out from under
    // a replay. scStreamSource() clears the entry it replaced; this one is kept.
    try{ scStreamState.blobUrl = ''; }catch(_eBz){}
  }
  // A signed URL lasts half an hour; the resolver's answer is kept for the same song
  // so Next does not pay for it twice.
  var scStreamResolved = {};
  function scStreamResolveCached(videoId){
    var k = String(videoId || '');
    var e = k && scStreamResolved[k];
    if(e && !scStreamStale(e.at, Date.now())) return Promise.resolve(e.url);
    return Promise.resolve(scStreamResolve(videoId)).then(function(u){
      if(u && k) scStreamResolved[k] = { url: u, at: Date.now() };
      return u;
    });
  }
  function scStreamWarmNext(){
    var nxt = scStreamUpNext();
    if(!nxt || !nxt.videoId) return;
    Promise.resolve(scStreamResolveCached(nxt.videoId)).catch(function(){});
  }
  // The next song in the SAME genre - the one the card offers and the one Next takes.
  function scStreamUpNext(){
    var q = scStreamState.queue || [];
    if(!q.length) return null;
    var cur = scStreamById(scStreamState.curId) || {};
    var want = String(cur.genre || scStreamState.genre || '').toLowerCase();
    if(!want) return null;
    var i = q.indexOf(String(scStreamState.curId));
    var n = q.length;
    for(var step = 1; step < n; step++){
      var t = scStreamById(q[(i + step + n) % n]);
      if(t && String(t.id) !== String(scStreamState.curId)
        && String(t.genre || '').toLowerCase() === want) return t;
    }
    return null;
  }
  function scStreamGenreOf(){
    var cur = scStreamById(scStreamState.curId) || {};
    return String(cur.genre || scStreamState.genre || '');
  }
'''

swap('the memory and the genre lead',
     "\n  function scStreamSay(msg){",
     "\n" + CACHE + "\n  function scStreamSay(msg){")

swap('a read song plays in the tap',
     "  function scStreamPlay(id, ctxIds){\n"
     "    var t = scStreamById(id);\n"
     "    if(!t){ return; }\n"
     "    scStreamState.curId = String(id);\n"
     "    scStreamState.fixes = 0;\n"
     "    scStreamState.err = '';\n"
     "    scStreamState.bytes = 0;\n"
     "    scStreamState.ready = false;\n"
     "    scStreamState.queue = (ctxIds && ctxIds.length) ? ctxIds.slice() : (scStreamState.tracks || []).map(function(x){ return String(x.id); });\n"
     "    scStreamSay('Loading the stream\\u2026');\n"
     "    scStreamRender();\n"
     "    scStreamBarOn(t);\n"
     "    Promise.resolve(scStreamResolve(t.videoId)).then(function(u){\n"
     "      if(!u){\n"
     "        scStreamSay('No playable stream for this song right now' + (scStreamReason() ? ' (' + scStreamReason() + ')' : ''));\n"
     "        scStreamTick();\n"
     "        return;\n"
     "      }\n"
     "      scStreamState.via = 'link';\n"
     "      // The link first, in the tap. If the element refuses it - a 403 on the\n"
     "      // open-ended range, which is what googlevideo answers - the song is read in\n"
     "      // bounded ranges and played from an object URL instead.\n"
     "      return scStreamStart(u).then(function(ok){\n"
     "        if(ok){ scStreamWatch(u); return; }\n"
     "        scStreamState.err = 'the link was refused';\n"
     "        return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){\n"
     "          if(!src) return;\n"
     "          return scStreamStart(src);\n"
     "        });\n"
     "      });\n"
     "    }).catch(function(){\n"
     "      scStreamState.err = 'the play call failed';\n"
     "      scStreamSay('This source will not play this song - tap Restart');\n"
     "      scStreamTick();\n"
     "    });\n"
     "  }",
     "  function scStreamPlay(id, ctxIds){\n"
     "    var t = scStreamById(id);\n"
     "    if(!t){ return; }\n"
     "    scStreamState.curId = String(id);\n"
     "    scStreamState.fixes = 0;\n"
     "    scStreamState.err = '';\n"
     "    scStreamState.bytes = 0;\n"
     "    scStreamState.ready = false;\n"
     "    scStreamState.via = '';\n"
     "    scStreamState.queue = (ctxIds && ctxIds.length) ? ctxIds.slice() : (scStreamState.tracks || []).map(function(x){ return String(x.id); });\n"
     "    scStreamSay('Loading the stream\\u2026');\n"
     "    scStreamRender();\n"
     "    scStreamBarOn(t);\n"
     "    // 80.6.19 - A SONG ALREADY READ PLAYS IN THE TAP.\n"
     "    var hit = scStreamCacheGet(t.videoId);\n"
     "    if(hit){\n"
     "      scStreamState.mime = hit.mime;\n"
     "      scStreamState.size = hit.size;\n"
     "      scStreamState.via = 'cache';\n"
     "      scStreamStart(hit.url).then(function(ok){\n"
     "        if(ok){ scStreamWarmNext(); return; }\n"
     "        scStreamCacheDrop(t.videoId);\n"
     "        scStreamPlayFresh(t);\n"
     "      });\n"
     "      return;\n"
     "    }\n"
     "    scStreamPlayFresh(t);\n"
     "  }\n"
     "  // The fresh path: the read starts WITH the link instead of after it.\n"
     "  function scStreamPlayFresh(t){\n"
     "    var wanted = String(t.id);\n"
     "    var readP = null;\n"
     "    function beginRead(u){\n"
     "      if(readP) return readP;\n"
     "      readP = Promise.resolve(scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }))\n"
     "        .then(function(src){\n"
     "          if(src) scStreamCachePut(t.videoId, { url: src, mime: scStreamState.mime, size: scStreamState.size });\n"
     "          return src;\n"
     "        })\n"
     "        .catch(function(){ return ''; });\n"
     "      return readP;\n"
     "    }\n"
     "    return Promise.resolve(scStreamResolveCached(t.videoId)).then(function(u){\n"
     "      if(String(scStreamState.curId) !== wanted) return;\n"
     "      if(!u){\n"
     "        scStreamSay('No playable stream for this song right now' + (scStreamReason() ? ' (' + scStreamReason() + ')' : ''));\n"
     "        scStreamTick();\n"
     "        return;\n"
     "      }\n"
     "      scStreamState.via = 'link';\n"
     "      beginRead(u);                       // alongside the link, not after it\n"
     "      return scStreamStart(u).then(function(ok){\n"
     "        if(ok){ scStreamWatch(u); scStreamWarmNext(); return; }\n"
     "        scStreamState.err = 'the link was refused';\n"
     "        return beginRead(u).then(function(src){\n"
     "          if(!src || String(scStreamState.curId) !== wanted) return;\n"
     "          scStreamState.via = 'read';\n"
     "          return scStreamStart(src).then(function(ok2){ if(ok2) scStreamWarmNext(); });\n"
     "        });\n"
     "      });\n"
     "    }).catch(function(){\n"
     "      scStreamState.err = 'the play call failed';\n"
     "      scStreamSay('This source will not play this song - tap Restart');\n"
     "      scStreamTick();\n"
     "    });\n"
     "  }")

# ── Next keeps the genre ────────────────────────────────────────────────
swap('next stays in the genre',
     "  function scStreamNext(dir){\n"
     "    var q = scStreamState.queue || [];\n"
     "    if(!q.length) return;\n"
     "    var i = q.indexOf(String(scStreamState.curId));\n"
     "    var n = i === -1 ? 0 : (i + dir + q.length) % q.length;\n"
     "    scStreamPlay(q[n], q);\n"
     "  }",
     "  // 80.6.19 - THE NEXT SONG KEEPS THE GENRE. A song that knows its genre is followed\n"
     "  // by another song of that genre in the same queue; only when the queue has none\n"
     "  // does it fall back to the plain next, which is what it always did.\n"
     "  function scStreamNext(dir){\n"
     "    var q = scStreamState.queue || [];\n"
     "    if(!q.length) return;\n"
     "    var i = q.indexOf(String(scStreamState.curId));\n"
     "    var n = q.length;\n"
     "    var pick = -1;\n"
     "    var want = scStreamGenreOf().toLowerCase();\n"
     "    if(want){\n"
     "      for(var step = 1; step < n; step++){\n"
     "        var idx = (i + dir * step + n * 2) % n;\n"
     "        var cand = scStreamById(q[idx]);\n"
     "        if(cand && String(cand.id) !== String(scStreamState.curId)\n"
     "          && String(cand.genre || '').toLowerCase() === want){ pick = idx; break; }\n"
     "      }\n"
     "    }\n"
     "    if(pick < 0) pick = i === -1 ? 0 : (i + dir + n) % n;\n"
     "    scStreamPlay(q[pick], q);\n"
     "  }")

# ── the silent-link wait, shortened ─────────────────────────────────────
swap('a silent link is given less time',
     "      if(scStreamState.via === 'read') return;                   // already reading\n"
     "      return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){\n"
     "        if(!src) return;\n"
     "        return scStreamStart(src);\n"
     "      });\n"
     "    }, 6000);",
     "      if(scStreamState.via === 'read') return;                   // already reading\n"
     "      var hit = scStreamCacheGet((scStreamById(scStreamState.curId) || {}).videoId);\n"
     "      if(hit){\n"
     "        scStreamState.via = 'cache';\n"
     "        return scStreamStart(hit.url).then(function(ok){ if(ok) scStreamWarmNext(); });\n"
     "      }\n"
     "      return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){\n"
     "        if(!src) return;\n"
     "        return scStreamStart(src);\n"
     "      });\n"
     "    }, 2400);")

swap('restart forgets a broken read',
     "  function scStreamRestart(){\n    var id = scStreamState.curId || ((scStreamState.tracks || [])[0] || {}).id;",
     "  function scStreamRestart(){\n"
     "    var id = scStreamState.curId || ((scStreamState.tracks || [])[0] || {}).id;\n"
     "    var was = id ? scStreamById(id) : null;\n"
     "    if(was && was.videoId) scStreamCacheDrop(was.videoId);")

# ── the rail keeps its place ────────────────────────────────────────────
swap('the rail is a rail',
     "    h += '<div style=\"display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding:1px 0 3px;\">';",
     "    h += '<div id=\"scStreamGenreRail\" style=\"display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;'\n"
     "      + '-webkit-overflow-scrolling:touch;padding:1px 0 3px;scroll-snap-type:x proximity;\">';")

swap('a tile snaps',
     "        + ' style=\"flex:0 0 auto;width:94px;height:54px;border-radius:12px;padding:8px;text-align:left;'",
     "        + ' style=\"flex:0 0 auto;width:94px;height:54px;border-radius:12px;padding:8px;text-align:left;scroll-snap-align:start;'")

swap('the rail is remembered before the page is rebuilt',
     "  function scStreamRender(){\n    if(!SC_STREAM_OK) return;\n    var host = document.getElementById('scStreamBlock');\n    if(!host) return;",
     "  function scStreamRender(){\n    if(!SC_STREAM_OK) return;\n    var host = document.getElementById('scStreamBlock');\n    if(!host) return;\n"
     "    // 80.6.19 - THE RAIL KEEPS ITS PLACE. Every change rebuilds this block with\n"
     "    // innerHTML, and a fresh row of tiles lands back on the first one. The scroll is\n"
     "    // read here, before the rebuild, and handed back in scStreamWire().\n"
     "    try{\n"
     "      var _railNow = host.querySelector ? host.querySelector('#scStreamGenreRail') : null;\n"
     "      if(_railNow) scStreamState.railLeft = Number(_railNow.scrollLeft) || 0;\n"
     "    }catch(_eRailNow){}")

swap('and it is handed back after the rebuild',
     "  function scStreamWire(){\n    var host = document.getElementById('scStreamBlock');\n    if(!host) return;",
     "  function scStreamWire(){\n    var host = document.getElementById('scStreamBlock');\n    if(!host) return;\n"
     "    try{\n"
     "      var _rail = host.querySelector ? host.querySelector('#scStreamGenreRail') : null;\n"
     "      if(_rail){\n"
     "        if(scStreamState.railLeft) _rail.scrollLeft = scStreamState.railLeft;\n"
     "        _rail.addEventListener('scroll', function(){ scStreamState.railLeft = Number(_rail.scrollLeft) || 0; }, { passive: true });\n"
     "      }\n"
     "    }catch(_eRail){}")

# ── what is up next, on the card ─────────────────────────────────────────
swap('the card says what is next',
     "      h += '<div style=\"display:flex;align-items:center;gap:8px;margin-top:6px;padding-right:46px;\">';",
     "      // 80.6.19 - AND IT SAYS WHAT COMES NEXT. The next song in the same genre is one\n"
     "      // tap away; when the list has no more of that genre, the same place offers more\n"
     "      // of it instead of pretending there is a next one.\n"
     "      var up = scStreamUpNext();\n"
     "      var gLabel = scStreamGenreOf();\n"
     "      if(up){\n"
     "        h += '<button type=\"button\" id=\"scStreamUpNext\" style=\"display:flex;align-items:center;gap:8px;width:100%;'\n"
     "          + 'margin-top:8px;padding:7px 8px;border:1px solid var(--line);border-radius:10px;background:none;color:var(--ink);text-align:left;\">';\n"
     "        h += '<span style=\"font-size:8.5px;letter-spacing:1.1px;text-transform:uppercase;color:var(--coral);font-weight:800;flex:0 0 auto;\">Up next</span>';\n"
     "        h += '<span style=\"flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">'\n"
     "          + escapeHtml(up.title || 'Untitled') + '<span style=\"color:var(--ink-dim);\"> \\u00b7 ' + escapeHtml(up.artist || 'Streaming') + '</span></span>';\n"
     "        h += scIcon('next', 14);\n"
     "        h += '</button>';\n"
     "      } else if(gLabel){\n"
     "        h += '<button type=\"button\" id=\"scStreamMoreGenre\" style=\"display:flex;align-items:center;gap:8px;width:100%;'\n"
     "          + 'margin-top:8px;padding:7px 8px;border:1px dashed var(--line);border-radius:10px;background:none;color:var(--ink-dim);text-align:left;\">';\n"
     "        h += '<span style=\"font-size:8.5px;letter-spacing:1.1px;text-transform:uppercase;font-weight:800;flex:0 0 auto;\">More</span>';\n"
     "        h += '<span style=\"flex:1;min-width:0;font-size:11.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(gLabel) + '</span>';\n"
     "        h += scIcon('search', 13);\n"
     "        h += '</button>';\n"
     "      }\n"
     "      h += '<div style=\"display:flex;align-items:center;gap:8px;margin-top:6px;padding-right:46px;\">';")

swap('the next song is one tap away',
     "    on('scStreamFix', 'click', scStreamRestart);",
     "    on('scStreamFix', 'click', scStreamRestart);\n"
     "    on('scStreamUpNext', 'click', function(){\n"
     "      var up = scStreamUpNext();\n"
     "      if(!up){ scStreamSay('Nothing else in this genre yet'); return; }\n"
     "      scStreamPlay(up.id, scStreamState.queue);\n"
     "    });\n"
     "    on('scStreamMoreGenre', 'click', function(){\n"
     "      var g = scStreamGenreOf();\n"
     "      if(g) scStreamGenre(g);\n"
     "    });")

# ── more genres ────────────────────────────────────────────────────────
swap('twelve more genres',
     "    { n: 'Old School', q: 'old school hits', a: '#b79891', b: '#94716b' }\n  ];",
     "    { n: 'Old School', q: 'old school hits', a: '#b79891', b: '#94716b' },\n"
     "    { n: 'Amapiano', q: 'amapiano hits', a: '#00b09b', b: '#96c93d' },\n"
     "    { n: 'Reggaeton', q: 'reggaeton hits', a: '#ee0979', b: '#ff6a00' },\n"
     "    { n: 'Bollywood', q: 'bollywood hits', a: '#f857a6', b: '#ff5858' },\n"
     "    { n: 'Trap', q: 'trap hits', a: '#141e30', b: '#42506b' },\n"
     "    { n: 'Lo-fi', q: 'lofi study beats', a: '#5f2c82', b: '#49a09d' },\n"
     "    { n: 'Soul', q: 'soul classics', a: '#870000', b: '#190a05' },\n"
     "    { n: 'Funk', q: 'funk grooves', a: '#f2994a', b: '#f2c94c' },\n"
     "    { n: 'Metal', q: 'metal anthems', a: '#232526', b: '#8e0e00' },\n"
     "    { n: 'Blues', q: 'blues classics', a: '#1e3c72', b: '#2a5298' },\n"
     "    { n: 'Disco', q: 'disco hits', a: '#d53369', b: '#daae51' },\n"
     "    { n: 'House', q: 'house music', a: '#00c9ff', b: '#92fe9d' },\n"
     "    { n: 'Workout', q: 'workout motivation songs', a: '#f00000', b: '#dc281e' }\n  ];")

swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'A stream that starts sooner, keeps its genre, and a rail that stays put', items: [\n"
    "    '[FULL] A streamed song starts much sooner. The song is read from the source at the same moment the link is tried instead of only after the link fails, a link that makes no sound is no longer given six seconds before the app gives up on it, and the songs you have already played stay in memory for a while - so playing one again, or stepping back to it, starts at once with no network at all.',\n"
    "    '[FULL] Next keeps the genre. When a song ends or you tap next, the app takes the next song in the same genre from your list, and the card shows what is up next before it happens. When nothing else in that genre is in the list, the same place offers more of the genre in one tap.',\n"
    "    '[FULL] The genre row keeps its place. Swipe along it, tap a genre, and the row stays where you left it instead of snapping back to the first tile every time the page redraws.',\n"
    "    '[FULL] Twelve more genres on the rail, including Amapiano, Reggaeton, Bollywood, Trap, Lo-fi, Soul, Funk, Metal, Blues, Disco, House and Workout.',\n"
    "  ]},\n"
)
if "version: '" + VERSION + "'" not in SRC:
    at = SRC.find("\n  { version: '%s'" % OLD)
    if at == -1:
        failed.append('changelog: no %s entry to insert before' % OLD)
    else:
        SRC = SRC[:at + 1] + ENTRY + SRC[at + 1:]
        applied.append('the changelog entry')

if failed:
    print('patch-80619: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80619: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80619: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
