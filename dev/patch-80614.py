#!/usr/bin/env python3
"""80.6.14 - a stream that starts from the link, falls back to read bytes, and says
on screen which step refused.

The owner's report is one sentence - "streaming is not workifn" - and three releases
have now answered it with a theory. This one answers it with mechanics and a readout:

  * THE ELEMENT WAS NEVER IN THE PAGE. scStreamAudio() built an <audio>, kept it in a
    closure and played a blob on it. The app's own player keeps its two elements in
    the document; a WebView is free to treat a detached one differently for load,
    autoplay and decode. It is appended (0x0, invisible) the moment it exists.

  * THE LINK IS TRIED FIRST, IN THE TAP. A media element needs no CORS, so the direct
    URL is the shortest path to sound - but googlevideo refuses the open-ended range
    a media element opens with, so when the element refuses it, the song is read in
    bounded ranges and played from an object URL. That order also means the first
    second does not wait for 3.4 MB.

  * THE READER GAVE UP ON A SHAPE IT DID NOT KNOW. __scCapHttp() answers 206 with
    data this page could not decode, and scFetchRange returned "206, no bytes" -
    which stops the whole read instead of falling through to the page fetch. It now
    falls through, and scHttpDataToBytes() accepts typed arrays, plain arrays and
    wrapped replies as well as base64.

  * AND THE ROW SAYS WHERE IT STOPPED. The card carries one dim line: the stream's
    type and size, which path carried it, the element's error code and readyState,
    and the transport's own reason. A screenshot of that line is a diagnosis.

Idempotent: the marker is 80.6.14 on the page plus the start helper.

    python3 dev/patch-80614.py
    python3 dev/patch-80614.py --check
"""
import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..')
INDEX = os.path.join(ROOT, 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.6.14'
OLD_VERSION = '80.6.13'
MARKER = '80.6.14 - THE ELEMENT IS IN THE PAGE, THE LINK IS TRIED FIRST'

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80614: the page is already %s (%s) - nothing to do' % (VERSION, MARKER))
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
# 1. Every byte shape the native bridge can answer with is a byte shape this page
#    reads - and a 206 it cannot read is not the end of the read.
# ---------------------------------------------------------------------------
set_func('scHttpDataToBytes', r'''  function scHttpDataToBytes(data){
    if(!data) return null;
    if(typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return new Uint8Array(data);
    // The bridge has answered with a typed array, a plain array and a wrapped object
    // on different versions, and every one of those was read as null - a 206 with no
    // bytes, which ended the whole read.
    if(typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView && ArrayBuffer.isView(data)){
      try{ return new Uint8Array(data.buffer, data.byteOffset || 0, data.byteLength); }catch(_eV){}
    }
    if(Array.isArray(data)){
      try{ return new Uint8Array(data); }catch(_eA){}
    }
    if(typeof data === 'object' && data.data != null) return scHttpDataToBytes(data.data);
    if(typeof data !== 'string') return null;
    var b64 = String(data).replace(/^data:[^;]*;base64,/, '');
    if(!b64) return null;
    try{
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for(var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }catch(e){ return null; }
  }''')

swap('a 206 this page cannot read falls through to fetch',
     "        if(res && (res.status === 206 || res.status === 200)){\n"
     "          var bytes = scHttpDataToBytes(res.data);\n"
     "          if(bytes && bytes.length) return { bytes: bytes, partial: res.status === 206, total: scRangeTotal(res.headers), status: res.status };\n"
     "          return { bytes: null, partial: false, total: 0, status: res.status };\n"
     "        }",
     "        if(res && (res.status === 206 || res.status === 200)){\n"
     "          var bytes = scHttpDataToBytes(res.data);\n"
     "          if(bytes && bytes.length) return { bytes: bytes, partial: res.status === 206, total: scRangeTotal(res.headers), status: res.status };\n"
     "          // A success with data this page cannot decode is not an answer: fall through\n"
     "          // to the page fetch rather than reporting a 206 that carries nothing.\n"
     "          window.__scHttpWhy = 'the native reply carried no readable bytes';\n"
     "        }")

# ---------------------------------------------------------------------------
# 2. The element lives in the page, the link is tried first, the read is the fallback.
# ---------------------------------------------------------------------------
set_func('scStreamAudio', r'''  function scStreamAudio(){
    if(scStreamState.audio) return scStreamState.audio;
    var a = document.createElement('audio');
    a.id = 'scStreamAudio';
    a.preload = 'auto';
    a.volume = 1;
    // This element used to be created and held in a closure, never put in the
    // document - while the app's own player keeps both of its elements in the page.
    // A WebView is free to treat a detached element differently for load, autoplay and
    // decode, and that is not a thing a stream can be asked to survive.
    a.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;opacity:0;pointer-events:none;';
    try{ if(!a.parentNode && document.body) document.body.appendChild(a); }catch(_eAttach){}
    a.addEventListener('timeupdate', scStreamTick);
    a.addEventListener('loadedmetadata', function(){ scStreamState.ready = true; scStreamTick(); });
    a.addEventListener('canplay', function(){ scStreamTick(); });
    a.addEventListener('play', function(){ scStreamState.playing = true; scStreamRender(); });
    a.addEventListener('pause', function(){ scStreamState.playing = false; scStreamRender(); });
    a.addEventListener('ended', function(){ scStreamNext(1); });
    a.addEventListener('error', function(){
      var e = a.error || null;
      scStreamState.err = e ? ('error ' + e.code) : 'error';
      var t = scStreamById(scStreamState.curId);
      if(!t || !t.videoId || scStreamState.busy){ scStreamSay('This stream stopped - tap Restart'); return; }
      scStreamState.fixes = (scStreamState.fixes || 0) + 1;
      if(scStreamState.fixes > 1){ scStreamSay('This source will not play this song - tap Restart'); return; }
      var at = a.currentTime || 0;
      scStreamState.busy = true;
      scStreamResolve(t.videoId).then(function(u){
        scStreamState.busy = false;
        if(!u){ u = scStreamAltUrl(); }
        if(!u){ scStreamSay('This source will not play right now'); return; }
        return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size }).then(function(src){
          if(!src) return;
          return scStreamStart(src, at);
        });
      });
    });
    scStreamState.audio = a;
    return a;
  }''')

HELPERS = r'''
  // One line the owner can photograph. Everything a failure needs to be diagnosed,
  // in the order it happened: what the stream is, which path carried it, what the
  // element thinks, and what the transport said.
  function scStreamDiag(){
    var a = scStreamState.audio;
    var bits = [];
    if(scStreamState.mime) bits.push(String(scStreamState.mime).split(';')[0].replace(/^audio\//, ''));
    if(scStreamState.size) bits.push((Number(scStreamState.size) / 1048576).toFixed(1) + ' MB');
    if(scStreamState.via) bits.push(scStreamState.via);
    if(scStreamState.bytes) bits.push(Math.round(Number(scStreamState.bytes) / 1024) + ' KB read');
    if(a && a.error) bits.push('error ' + a.error.code);
    if(a && a.readyState) bits.push('ready ' + a.readyState);
    if(scStreamState.err) bits.push(scStreamState.err);
    var why = scStreamReason();
    if(why) bits.push(why);
    return bits.join(' \u00b7 ');
  }
  // The link, in the tap: a media element is not held to CORS, so this is the
  // shortest path to sound. It is also the path that fails first, because
  // googlevideo refuses the open-ended range a media element opens with.
  // 80.6.14 - THE ELEMENT IS IN THE PAGE, THE LINK IS TRIED FIRST
  function scStreamStart(u, at){
    var a = scStreamAudio();
    if(!u) return Promise.resolve(false);
    scStreamState.url = u;
    scStreamState.urlAt = Date.now();
    try{ a.src = u; a.load(); }catch(_eSet){}
    if(at){ try{ a.currentTime = at; }catch(_eSeek){} }
    return Promise.resolve(a.play()).then(function(){ scStreamSay(''); return true; }).catch(function(){
      return false;
    });
  }
  // Restart, from a tap, so the element is started inside a user gesture every time.
  function scStreamRestart(){
    var id = scStreamState.curId || ((scStreamState.tracks || [])[0] || {}).id;
    if(!id){ scStreamSay('Add a song first'); return; }
    try{ scStreamAudio().pause(); }catch(_ePause){}
    if(scStreamState.blobUrl){ try{ URL.revokeObjectURL(scStreamState.blobUrl); }catch(_eRev){} }
    scStreamState.blobUrl = '';
    scStreamState.url = '';
    scStreamState.urlAt = 0;
    scStreamState.err = '';
    scStreamState.fixes = 0;
    scStreamPlay(id);
  }
''' + r'''
'''

swap('the start helpers',
     "  // --- the audio element -----------------------------------------------------\n",
     HELPERS + "  // --- the audio element -----------------------------------------------------\n")

set_func('scStreamSource', r'''  function scStreamSource(info){
    var u = (info && info.url) || String(info || '');
    var mime = String((info && info.mime) || '').split(';')[0].trim() || 'audio/mp4';
    var size = (info && Number(info.size)) || 0;
    if(!u) return Promise.resolve('');
    scStreamSay('Reading the song\u2026');
    scStreamState.via = 'read';
    // A stopped download must not truncate a stream: scFetchBytes() watches one
    // global for the downloader's Stop button.
    var wasCancel = !!window.__scCancelDl;
    window.__scCancelDl = false;
    function restore(){ try{ window.__scCancelDl = wasCancel; }catch(_eRestore){} }
    return Promise.resolve()
      .then(function(){
        return scFetchBytes(u, size, function(loaded, total){
          var pct = total ? Math.round((loaded / total) * 100) : 0;
          scStreamSay(pct > 0 ? 'Reading the song\u2026 ' + pct + '%' : 'Reading the song\u2026');
        });
      })
      .then(function(buf){
        if(!buf) throw new Error('no bytes');
        var blob = new Blob([buf], { type: mime });
        if(!blob.size) throw new Error('empty');
        if(scStreamState.blobUrl){ try{ URL.revokeObjectURL(scStreamState.blobUrl); }catch(_eRev){} }
        scStreamState.blobUrl = URL.createObjectURL(blob);
        scStreamState.bytes = Number(blob.size) || 0;
        restore();
        scStreamState.err = '';
        return scStreamState.blobUrl;
      })
      .catch(function(){
        restore();
        scStreamState.err = scStreamReason() || 'the source sent no bytes';
        scStreamSay('Could not read the song (' + scStreamState.err + ')');
        scStreamTick();
        return '';
      });
  }''')

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
        if(ok) return;
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
        .catch(function(){ scStreamRestart(); })
        .then(function(){ window.__scStreamPulling = false; });
    } else {
      a.pause();
    }
  }''')

set_func('scStreamTick', r'''  function scStreamTick(){
    try{
      var a = scStreamState.audio;
      var bar = document.getElementById('scStreamBar');
      var at = document.getElementById('scStreamAt');
      var dg = document.getElementById('scStreamDiag');
      if(dg) dg.textContent = scStreamDiag();
      if(!a) return;
      var d = a.duration;
      if(bar){ bar.max = isFinite(d) && d > 0 ? d : 0; bar.value = a.currentTime || 0; }
      if(at) at.textContent = scStreamTime(a.currentTime || 0) + (isFinite(d) && d > 0 ? ' / ' + scStreamTime(d) : '');
    }catch(_e){}
  }''')

# The readout and a restart, on the card itself.
swap('the readout and the restart button',
     "      h += '</div></div>';\n",
     "      h += '</div>';\n"
     "      h += '<div style=\"display:flex;align-items:center;gap:8px;margin-top:6px;\">';\n"
     "      h += '<span id=\"scStreamDiag\" style=\"flex:1;min-width:0;font-size:9.5px;color:var(--ink-dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;\">' + escapeHtml(scStreamDiag()) + '</span>';\n"
     "      h += '<button type=\"button\" id=\"scStreamFix\" style=\"border:1px solid var(--line);background:none;color:var(--ink-dim);border-radius:999px;padding:4px 9px;font-size:10.5px;\">Restart</button>';\n"
     "      h += '</div></div>';\n")

swap('the restart is wired',
     "    on('scStreamBar', 'input', function(){ try{ scStreamAudio().currentTime = Number(this.value) || 0; }catch(_e){} });",
     "    on('scStreamBar', 'input', function(){ try{ scStreamAudio().currentTime = Number(this.value) || 0; }catch(_e){} });\n"
     "    on('scStreamFix', 'click', scStreamRestart);")

swap('the state records how the song arrived',
     "    mime: '', size: 0, bytes: 0, fixes: 0, pl: '', alts: [], blobUrl: ''",
     "    mime: '', size: 0, bytes: 0, fixes: 0, pl: '', alts: [], blobUrl: '',\n"
     "    via: '', err: ''")

# ---------------------------------------------------------------------------
# 3. The version and its entry.
# ---------------------------------------------------------------------------
swap('the version', "const APP_VERSION = '%s';" % OLD_VERSION,
     "const APP_VERSION = '%s';" % VERSION)

swap('the state keeps the stream length',
     "        scStreamState.size = Number(r.size) || 0;",
     "        scStreamState.size = Number(r.size) || 0;\n"
     "        scStreamState.via = '';\n"
     "        scStreamState.err = '';")

today = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d')
ENTRY = (
    "  { version: '" + VERSION + "', date: '" + today + "', title: 'A stream that starts, and a line that says why it did not', items: [\n"
    "    '[FULL] Streaming plays the link itself first, from the tap, and only reads the song in pieces when the source refuses that - so the first second no longer waits for the whole file.',\n"
    "    '[FULL] The streaming player is a real audio element in the page now, loaded before it is started, instead of one held off-screen where a WebView can treat it differently.',\n"
    "    '[FULL] The streaming card carries a one-line readout - type, size, which path carried it, the player state and what the source said - so a song that will not play says where it stopped. There is a Restart button beside it.',\n"
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
    print('patch-80614: --check: %s is NOT on this page yet (%d step(s) would apply)' % (VERSION, len(applied)))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80614: %d step(s) applied' % len(applied))
for a in applied:
    print('  + ' + a)
