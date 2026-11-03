#!/usr/bin/env python3
"""80.7.12 - a search that answers even when the player will not, and one tap to fill.

    python3 dev/patch-80712.py
    python3 dev/patch-80712.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHY. "THE STREAMING IS NOT GIVING ME ANY SONGS AT ALL." Measured, not guessed:

  * the player search is a POST to www.youtube.com/youtubei/v1/search, and the page's
    transport (scHttpJson) asks the native bridge first and then a plain fetch - there is
    no third road. A browser refuses that POST (CORS), so scYtSearch resolves to null and
    the shelf says "Nothing found for that" for every query on earth;
  * the three CORS proxies this app already uses were all down when this was written -
    allorigins 522, codetabs 522, cors.lol 429 - so proxying the results page is not a
    road either;
  * the open catalogue is a plain GET and answers with access-control-allow-origin: *,
    so it is the one catalogue that answers with no bridge and no proxy.

So a search now tries the player first and, if it comes back empty, asks the open
catalogue. A row from that catalogue is played straight from the archive (metadata ->
the item's own file), which needs no key and no bridge. And "Get songs" now means it:
the button says so, and Add all fills the shelf from the results in one tap.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.12'
MARKER = '80.7.12 - A SEARCH THAT ANSWERS WHEN THE PLAYER WILL NOT'
ANCHOR = "  { version: '80.7.11',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80712: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


# -- 1. the version ----------------------------------------------------------
once('the page says 80.7.12',
     "const APP_VERSION = '80.7.11';",
     "const APP_VERSION = '80.7.12';")

# -- 2. the open catalogue ---------------------------------------------------
BLOCK = r"""  // 80.7.12 - A SECOND CATALOGUE, ON A ROAD THAT IS OPEN.
  // The player search is a POST to youtube.com: the phone's own bridge can make it and a
  // browser cannot, and every CORS proxy this app knows was down when this was written
  // (allorigins 522, codetabs 522, cors.lol 429 - measured). The open catalogue is a
  // plain GET that answers with access-control-allow-origin: *, so a search still comes
  // back with songs when the player will not, and those rows play straight from the
  // archive with no key and no bridge.
  function scStreamIsArchive(id){ return String(id || '').indexOf('ia:') === 0; }

  function scStreamArchiveSearch(q){
    var terms = String(q || '').trim().toLowerCase();
    if(!terms) return Promise.resolve(null);
    var words = terms.split(/\s+/)
      .map(function(w){ return w.replace(/[^\w'-]/g, ''); })
      .filter(function(w){ return w.length > 1; });
    if(!words.length) return Promise.resolve(null);
    var clause = words.map(function(w){ return '(title:(' + w + ') OR creator:(' + w + '))'; }).join(' AND ');
    var url = 'https://archive.org/advancedsearch.php?q=' + encodeURIComponent('mediatype:(audio) AND ' + clause)
      + '&fl[]=identifier&fl[]=title&fl[]=creator&fl[]=length&fl[]=downloads'
      + '&sort%5B%5D=downloads%20desc&rows=12&page=1&output=json';
    return Promise.resolve(scHttpJson(url, null)).then(function(d){
      var rows = (d && d.response && d.response.docs) || [];
      var out = [];
      for(var i = 0; i < rows.length && out.length < 12; i++){
        var r = rows[i] || {};
        var ident = String(r.identifier || '').trim();
        var title = String(Array.isArray(r.title) ? r.title[0] : (r.title || '')).trim();
        if(!ident || !title) continue;
        var dur = 0;
        var len = Array.isArray(r.length) ? r.length[0] : r.length;
        if(typeof len === 'number') dur = Math.round(len);
        else {
          var m = String(len || '').match(/^(?:(\d+):)?(\d+):(\d+)$/);
          if(m) dur = (parseInt(m[1] || '0', 10) * 3600) + (parseInt(m[2], 10) * 60) + parseInt(m[3], 10);
        }
        out.push({
          videoId: 'ia:' + ident,
          title: title,
          owner: String(Array.isArray(r.creator) ? r.creator.join(', ') : (r.creator || '')),
          duration: dur,
          thumb: 'https://archive.org/services/img/' + encodeURIComponent(ident),
          source: 'archive'
        });
      }
      return out.length ? out : null;
    }).catch(function(){ return null; });
  }

  // The file inside an item: the first MP3 the archive lists, else any audio it has.
  // The download URL is the item's own, so a stream plays from it with no key at all.
  function scStreamArchiveResolve(id){
    var key = String(id || '').replace(/^ia:/, '');
    if(!key) return Promise.resolve('');
    return Promise.resolve(scHttpJson('https://archive.org/metadata/' + encodeURIComponent(key), null))
      .then(function(d){
        var files = (d && d.files) || [];
        var pick = '', fallback = '';
        for(var i = 0; i < files.length; i++){
          var n = String((files[i] && files[i].name) || '');
          if(!n || !/\.(mp3|m4a|ogg|oga|opus|flac)$/i.test(n)) continue;
          if(/\.mp3$/i.test(n)){ pick = n; break; }
          if(!fallback) fallback = n;
        }
        var file = pick || fallback;
        if(!file) return '';
        return 'https://archive.org/download/' + encodeURIComponent(key) + '/'
          + file.split('/').map(encodeURIComponent).join('/');
      })
      .catch(function(){ return ''; });
  }

  function scStreamSearchRun(q){"""

once('the second catalogue is inserted before the search',
     '  function scStreamSearchRun(q){',
     BLOCK)

# -- 3. the search answers from either catalogue ----------------------------
SEARCH = r"""  // 80.7.12 - THE SEARCH ANSWERS. The player is asked first because it is the whole
  // catalogue; when it comes back with nothing - a browser refusing the POST, a bridge
  // that is not there, a client shut for the week - the open catalogue is asked before
  // the owner is told there are no songs. Whoever answered is written above the results,
  // so the shelf never pretends one catalogue is the other.
  function scStreamSearchRun(q){
    q = String(q || '').trim();
    if(!q){ scStreamSay('Type a song or an artist first'); return; }
    scStreamState.q = q;
    scStreamState.results = null;
    scStreamState.resultsSrc = '';
    scStreamRender();
    Promise.resolve(scYtSearch(q, '', '')).then(function(items){
      var got = Array.isArray(items) ? items.slice(0, 12) : [];
      if(got.length){
        scStreamState.results = got;
        scStreamState.resultsSrc = 'the source';
        scStreamRender();
        return;
      }
      return Promise.resolve(scStreamArchiveSearch(q)).then(function(rows){
        scStreamState.results = Array.isArray(rows) ? rows.slice(0, 12) : [];
        scStreamState.resultsSrc = scStreamState.results.length ? 'the open catalogue' : '';
        scStreamRender();
        if(!scStreamState.results.length){
          var why = (typeof scStreamReason === 'function') ? scStreamReason() : '';
          scStreamSay('Nothing came back for that' + (why ? ' (' + why + ')' : '') + ' - try the artist and the song');
        } else {
          scStreamSay('Found ' + scStreamState.results.length + ' in the open catalogue');
        }
      });
    }).catch(function(){
      return Promise.resolve(scStreamArchiveSearch(q)).then(function(rows){
        scStreamState.results = Array.isArray(rows) ? rows.slice(0, 12) : [];
        scStreamState.resultsSrc = scStreamState.results.length ? 'the open catalogue' : '';
        scStreamRender();
        if(!scStreamState.results.length) scStreamSay('The search could not reach a catalogue - tap Get songs again');
      });
    });
  }
"""

start = '  function scStreamSearchRun(q){'
end = '  function scStreamAddResult(it){'
a = SRC.find(start)
b = SRC.find(end, a if a >= 0 else 0)
if a < 0 or b < 0:
    failed.append('the search could not be replaced: the span was not found')
else:
    SRC = SRC[:a] + SEARCH + '\n' + SRC[b:]
    applied.append('the search answers from either catalogue')

# -- 4. an archive row plays from the archive ------------------------------
once('an archive row resolves to its own file',
     """  function scStreamResolve(videoId){
    var id = String(videoId || '');
    if(!id) return Promise.resolve('');""",
     """  function scStreamResolve(videoId){
    var id = String(videoId || '');
    if(!id) return Promise.resolve('');
    // 80.7.12 - an open-catalogue row is not a video: its id names an item, and the
    // item's own file is the stream.
    if(scStreamIsArchive(id)) return scStreamArchiveResolve(id);""")

# -- 5. and its cover comes from the archive too ----------------------------
once('an archive row carries an archive cover',
     """    var vid = String((t && t.videoId) || '');
    if(!vid) return '';
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(vid) + '/mqdefault.jpg';""",
     """    var vid = String((t && t.videoId) || '');
    if(!vid) return '';
    if(scStreamIsArchive(vid)) return 'https://archive.org/services/img/' + encodeURIComponent(vid.replace(/^ia:/, ''));
    return 'https://i.ytimg.com/vi/' + encodeURIComponent(vid) + '/mqdefault.jpg';""")

# -- 6. one tap fills the shelf --------------------------------------------
once('the results say how many and offer to add them all',
     """    if(scStreamState.results){
      h += '<div style="margin-top:10px;padding-bottom:2px;">';""",
     """    if(scStreamState.results){
      h += '<div style="margin-top:10px;padding-bottom:2px;">';
      // 80.7.12 - GET SONGS MEANS GET SONGS. The count says who answered, and one button
      // puts all of it on the shelf: twelve taps to fill a list is why the shelf looked
      // empty.
      if((scStreamState.results || []).length){
        h += '<div style="display:flex;align-items:center;gap:8px;margin:2px 0 8px;">'
          + '<span style="font-size:11px;color:var(--ink-dim);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'
          + scStreamState.results.length + ' found' + (scStreamState.resultsSrc ? ' \\u00b7 ' + escapeHtml(String(scStreamState.resultsSrc)) : '') + '</span>'
          + '<span style="flex:1;"></span>'
          + '<button type="button" id="scStreamAddAll" style="border:none;background:var(--accent, var(--ink));color:var(--bg);border-radius:999px;padding:6px 13px;font-size:11.5px;font-weight:700;flex:0 0 auto;">Add all ' + scStreamState.results.length + '</button>'
          + '</div>';
      }""")

once('the add all function exists',
     '  function scStreamAddResult(it){',
     r"""  // 80.7.12 - ONE TAP, NOT TWELVE. Each result goes in through the same path a single
  // Add uses, so a duplicate is still refused and the row is still the source's own.
  function scStreamAddAllResults(){
    var list = (scStreamState.results || []).slice();
    if(!list.length){ scStreamSay('Search something first'); return; }
    var added = 0;
    for(var i = 0; i < list.length; i++){
      var before = (scStreamState.tracks || []).length;
      try{ scStreamAddResult(list[i]); }catch(_eAddAll){}
      if((scStreamState.tracks || []).length > before) added++;
    }
    scStreamState.results = null;
    scStreamState.resultsSrc = '';
    scStreamRender();
    scStreamSay(added
      ? ('Added ' + added + ' song' + (added === 1 ? '' : 's') + ' to Streaming')
      : 'Those are already in Streaming');
  }

  function scStreamAddResult(it){""")

once('add all is wired to its button',
     """    on('scStreamQuery', 'keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); scStreamSearchRun(this.value); } });""",
     """    on('scStreamQuery', 'keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); scStreamSearchRun(this.value); } });
    on('scStreamAddAll', 'click', scStreamAddAllResults);""")

# -- 7. the button says what it does ----------------------------------------
once('the button says get songs',
     """+ scIcon('search', 13) + ' Search</button>';",
     """+ scIcon('search', 13) + ' Get songs</button>';""")

once('the field says what to type',
     r'''placeholder="Search a song to stream\u2026"''',
     r'''placeholder="Type a song or an artist\u2026"''')

# -- 8. the changelog ------------------------------------------------------

def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.7.12 - A SEARCH THAT ANSWERS WHEN THE PLAYER WILL NOT.\n"
    "  { version: '80.7.12', date: '{{STAMP}}', title: 'Songs when you search', items: [\n"
    "    '[FULL] A search now answers even when the player service refuses: the open catalogue is searched instead, and those songs play straight from it.',\n"
    "    '[FULL] Add all puts every result on the shelf in one tap, and the button says Get songs.',\n"
    "    '[FULL] A search that finds nothing now names what failed instead of leaving the shelf empty and silent.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-80712: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80712: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80712: %d steps applied, page is %s' % (len(applied), VERSION))
