#!/usr/bin/env python3
"""80.6.16 - the stream walks its candidates, and a row keeps its metadata.

The owner's screenshot named the failure: `webm . 3.5 MB . read . error 4 . the
source sent no bytes`. `webm` is itag 251, the first rank scYtPlayer() returns, and
that resolver also hands back m4a rows and a muxed copy in `alts`. The downloader
walks that list; scStreamSource() read the first URL only, so one refused range
ended the song. A status-only reply also recorded nothing, so the card printed a
fallback instead of the step that refused. And every row was saved without artist,
length or cover because the search answers with `owner`, a numeric `duration` and
a thumbnail list, not with `author`/`channel`/`lengthText`.

    python3 dev/patch-80616.py
    python3 dev/patch-80616.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.16'
OLD = '80.6.15'
MARKER = '80.6.16 - THE STREAM WALKS ITS CANDIDATES'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80616: the page is already %s - nothing to do' % VERSION)
    sys.exit(0)

applied, failed = [], []


def swap(name, old, new):
    global SRC
    got = SRC.count(old)
    if got != 1:
        failed.append('%s: found %d, expected 1' % (name, got))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


def set_func(name, body):
    global SRC
    key = '\n  function %s(' % name
    at = SRC.find(key)
    if at == -1:
        failed.append('function %s: not found' % name)
        return
    start = at + 1
    end = SRC.find('\n  }\n', start)
    if end == -1:
        failed.append('function %s: no end' % name)
        return
    SRC = SRC[:start] + body + '\n' + SRC[end + len('\n  }\n'):]
    applied.append('function %s' % name)


set_func('scStreamSource', r'''  function scStreamSource(info){
    // 80.6.16 - THE STREAM WALKS ITS CANDIDATES
    var u0 = (info && info.url) || String(info || '');
    if(!u0) return Promise.resolve('');
    // The resolver ranks itag 251 (webm/opus) first and answers with the m4a rows and
    // the progressive muxed copy behind it. Reading only the first URL meant a single
    // refused range ended the song; scFetchDecode() walks this same list and never had
    // that problem.
    var list = [{ url: u0, mime: String((info && info.mime) || ''), size: Number(info && info.size) || 0 }]
      .concat((scStreamState.alts || []).filter(function(a){ return !!(a && a.url); }));
    scStreamSay('Reading the song\u2026');
    scStreamState.via = 'read';
    var wasCancel = !!window.__scCancelDl;
    window.__scCancelDl = false;
    function restore(){ try{ window.__scCancelDl = wasCancel; }catch(_eRestore){} }
    function readOne(cand, i){
      // A muxed row is audio in an mp4 video container: the element plays it, but the
      // blob is labelled audio so the WebView does not route it to a video path.
      var mime = String((cand && cand.mime) || '').split(';')[0].trim();
      if(!mime || /^video\//i.test(mime)) mime = 'audio/mp4';
      scStreamState.size = Number(cand && cand.size) || 0;
      return Promise.resolve()
        .then(function(){
          return scFetchBytes(cand.url, scStreamState.size, function(loaded, total){
            if(i > 0) return;
            var pct = total ? Math.round((loaded / total) * 100) : 0;
            scStreamSay(pct > 0 ? 'Reading the song\u2026 ' + pct + '%' : 'Reading the song\u2026');
          });
        })
        .then(function(buf){
          if(!buf) return null;
          var blob = new Blob([buf], { type: mime });
          if(!blob.size) return null;
          if(scStreamState.blobUrl){ try{ URL.revokeObjectURL(scStreamState.blobUrl); }catch(_eRev){} }
          scStreamState.blobUrl = URL.createObjectURL(blob);
          scStreamState.bytes = Number(blob.size) || 0;
          scStreamState.mime = mime;
          return scStreamState.blobUrl;
        })
        .catch(function(){ return null; });
    }
    return list.reduce(function(p, cand, i){
      return p.then(function(got){
        if(got) return got;
        if(window.__scCancelDl) return '';
        return readOne(cand, i);
      });
    }, Promise.resolve(''))
      .then(function(src){
        restore();
        if(src){ scStreamState.err = ''; return src; }
        scStreamState.err = scStreamReason() || 'the source sent no bytes';
        scStreamSay('Could not read the song (' + scStreamState.err + ')');
        scStreamTick();
        return '';
      });
  }''')

# A reply carrying a status and no body is a finding: record it where the readout reads.
swap('the native refusal is named',
     "        if(res && res.status) return { bytes: null, partial: false, total: 0, status: res.status };",
     "        if(res && res.status){\n"
     "          window.__scHttpWhy = 'the source answered ' + res.status;\n"
     "          return { bytes: null, partial: false, total: 0, status: res.status };\n"
     "        }")

swap('the page refusal is named',
     "      if(r && r.status) return { bytes: null, partial: false, total: 0, status: r.status };",
     "      if(r && r.status){\n"
     "        window.__scHttpWhy = 'the page request answered ' + r.status;\n"
     "        return { bytes: null, partial: false, total: 0, status: r.status };\n"
     "      }")

swap('a silent request is not left blank',
     "    }catch(e){}\n    return null;\n  }\n  // \"bytes 0-1023/2923372\"",
     "    }catch(e){}\n"
     "    window.__scHttpWhy = window.__scHttpWhy || 'the range request never answered';\n"
     "    return null;\n  }\n  // \"bytes 0-1023/2923372\"")

# A cover for rows the source never gave one to, and the card's metadata line.
swap('a cover with a fallback, and a metadata line',
     "  function scStreamArt(t, size){\n"
     "    var s = Number(size) || 36;\n"
     "    var th = String((t && t.thumb) || '');\n",
     "  // 80.6.16 - EVERY VIDEO ID HAS A COVER. Rows saved before this release carry an\n"
     "  // empty thumb; the fixed per-id address costs no request and always exists.\n"
     "  function scStreamThumb(t){\n"
     "    var th = String((t && t.thumb) || '');\n"
     "    if(th) return th;\n"
     "    var vid = String((t && t.videoId) || '');\n"
     "    if(!vid) return '';\n"
     "    return 'https://i.ytimg.com/vi/' + encodeURIComponent(vid) + '/mqdefault.jpg';\n"
     "  }\n"
     "  function scStreamMeta(t){\n"
     "    var out = String((t && t.artist) || '') || 'Streaming';\n"
     "    var d = Number(t && t.dur) || 0;\n"
     "    if(d > 0) out += ' \\u00b7 ' + scStreamTime(d);\n"
     "    return out;\n"
     "  }\n"
     "  function scStreamArt(t, size){\n"
     "    var s = Number(size) || 36;\n"
     "    var th = scStreamThumb(t);\n")

# What the search actually answers with: owner, seconds, thumbnails.
swap('the search result keeps its cover',
     "        cands.push({ videoId: items[k].videoId, title: raw, owner: owner, duration: dur, score: score });",
     "        var thumbs = items[k].thumbnail && items[k].thumbnail.thumbnails;\n"
     "        var thumb = (thumbs && thumbs.length) ? String((thumbs[thumbs.length - 1] || {}).url || '') : '';\n"
     "        cands.push({ videoId: items[k].videoId, title: raw, owner: owner, duration: dur, score: score, thumb: thumb });")

swap('the row is saved with what the source said',
     "    var dur = 0;\n"
     "    try{\n"
     "      var m = String(it.lengthText || it.duration || '').match(/(\\d+):(\\d+)/);\n"
     "      if(m) dur = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);\n"
     "    }catch(_e){}\n"
     "    scStreamState.tracks = (scStreamState.tracks || []).concat([{\n"
     "      id: id,\n"
     "      videoId: String(it.videoId),\n"
     "      title: String(it.title || it.videoTitle || 'Untitled'),\n"
     "      artist: String(it.author || it.channel || ''),\n"
     "      dur: dur,\n"
     "      thumb: String(it.thumbnail || it.thumb || '')\n"
     "    }]);\n",
     "    // 80.6.16 - THE ROW KEEPS WHAT THE SOURCE SAID: `owner`, seconds, a cover.\n"
     "    var dur = 0;\n"
     "    if(typeof it.duration === 'number' && it.duration > 0){\n"
     "      dur = Math.round(it.duration);\n"
     "    } else {\n"
     "      try{\n"
     "        var m = String(it.lengthText || it.duration || '').match(/(\\d+):(\\d+)/);\n"
     "        if(m) dur = parseInt(m[1], 10) * 60 + parseInt(m[2], 10);\n"
     "      }catch(_e){}\n"
     "    }\n"
     "    var thumb = String(it.thumb || it.thumbnail || '');\n"
     "    if(!thumb && it.videoId) thumb = 'https://i.ytimg.com/vi/' + String(it.videoId) + '/mqdefault.jpg';\n"
     "    scStreamState.tracks = (scStreamState.tracks || []).concat([{\n"
     "      id: id,\n"
     "      videoId: String(it.videoId),\n"
     "      title: String(it.title || it.videoTitle || 'Untitled'),\n"
     "      artist: String(it.owner || it.author || it.channel || ''),\n"
     "      dur: dur,\n"
     "      thumb: thumb\n"
     "    }]);\n")

swap('the card carries the cover and the metadata',
     "      h += '<div style=\"font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(cur.title) + '</div>';\n"
     "      h += '<div style=\"font-size:10.5px;color:var(--ink-dim);\">' + escapeHtml(cur.artist || 'Streaming') + '</div>';\n",
     "      h += '<div style=\"display:flex;align-items:center;gap:10px;\">';\n"
     "      h += scStreamArt(cur, 44);\n"
     "      h += '<div style=\"flex:1;min-width:0;\">';\n"
     "      h += '<div style=\"font-size:12.5px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(cur.title) + '</div>';\n"
     "      h += '<div style=\"font-size:10.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(scStreamMeta(cur)) + '</div>';\n"
     "      h += '</div></div>';\n")

# The floating rail sat on top of Restart; the readout's row keeps its distance.
swap('the readout clears the rail',
     "      h += '<div style=\"display:flex;align-items:center;gap:8px;margin-top:6px;\">';",
     "      h += '<div style=\"display:flex;align-items:center;gap:8px;margin-top:6px;padding-right:46px;\">';")

swap('the streaming page opens at its top',
     "    scShelfPage(true);\n    scShelfRender();\n    scStreamBoot();\n  }\n  function scShelfBoot(){",
     "    scShelfPage(true);\n"
     "    scShelfRender();\n"
     "    scStreamBoot();\n"
     "    // 80.6.16 - the shelf keeps its scroll, so a page reopened after reading to the\n"
     "    // bottom showed a card whose title and New playlist button were above the fold.\n"
     "    try{ var top = document.getElementById('scStreamBlock'); if(top) top.scrollTop = 0; }catch(_eTop){}\n"
     "  }\n  function scShelfBoot(){")

swap('the version', "const APP_VERSION = '%s';" % OLD,
     "const APP_VERSION = '%s';" % VERSION)

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'A stream that tries every copy, and rows that keep their cover', items: [\n"
    "    '[FULL] Streaming walks every copy of the song the resolver answered with - the m4a rows and the progressive copy behind the first one - instead of giving up when the first copy is refused. It is the same list the downloader already walks.',\n"
    "    '[FULL] A source that refuses a range now says so on the card (for example \"the source answered 403\") instead of reporting that it sent no bytes, which was a fallback message.',\n"
    "    '[FULL] Every streaming row keeps its artist, its length and its cover, and the card shows the cover beside the title. A cover the source never gave is read from the video id, so rows saved before this release fill in by themselves.',\n"
    "    '[FULL] The Streaming page opens at its top, so its title and New playlist button are on screen when you come back to it.',\n"
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
    print('patch-80616: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80616: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80616: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
