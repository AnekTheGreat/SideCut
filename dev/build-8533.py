"""Build dev/video-8533.js - the 85.3.3 music video module - from dev/video-8532.js.

Every slice below is an exact piece of the 85.3.2 module and is asserted to appear
exactly once, so a later edit cannot make this builder land in the wrong place and
still print success.

    python3 dev/build-8533.py
"""

import io
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "dev", "video-8532.js")
OUT = os.path.join(ROOT, "dev", "video-8533.js")

BANNER_NEW = """  // ─── 85.3.3 - A REFUSED ADDRESS IS NOT A REFUSED PICTURE ──────────────────────
  // THE SIZE LIST WAS RIGHT AND THE PICTURE STILL LANDED ON 360p. 85.3.2 put the
  // ladder in, step by step, and made the resolver give every video its rows - and the
  // tab still walked 1080p, 720p and 480p down to the one-stream row, because each of
  // those rows was refused by the element itself (`this source is not a video the
  // element can open`). Everything about that refusal is about the ADDRESS: a
  // cross-origin media request, a URL the media stack will not fetch, a host that
  // answers this app through its native bridge and not through a tag. None of it says
  // anything about the picture behind the address.
  //
  // SO THE SIZE IS READ. The app already holds a reader that does not go through the
  // element at all - the native bridge the downloader and Streaming read with, ranges
  // and all. When a sharp row is refused with a decoder or container code, that row
  // is read once, at the second the picture was on, and played from memory. The
  // refusal that used to cost the picture is now one extra fetch of the size the
  // viewer asked for; only a size whose bytes cannot be read either is given up on,
  // and then the ladder steps down as before. A height is read once per video and
  // never again, and the one-stream rows are never read because they already play.
  //
  // AND THE LINKS KEEP THEIR QUERY. `scVideoNoRange` removes the `range` parameter a
  // player puts in a row - half a file is not a source - but the rest of the query
  // was rebuilt by a pair of replacements that left `?&` behind when `range` was the
  // first parameter, and a query that starts with `&` is not a query: the element was
  // handed a path and refused it. The parameter is dropped and the remaining pairs
  // are kept intact now.
  //
  // AND HD+ SHARPENS INSTEAD OF WASHING. 85.3.1 replaced the sharpen with a contrast
  // copy laid over the frame at half alpha through `overlay`, which lifts highlights
  // and crushes shadows - on a soft film that already looked hazy it read as milk
  // over the picture. An unsharp mask is back, built in one off-page canvas: the
  // frame blurred, that copy subtracted from the frame (the outlines), and those
  // outlines laid back over the frame. Flat areas are untouched, edges come up, and
  // nothing is added to the bright end.
"""

R = []


def rep(old, new, what):
    R.append((old, new, what))


# ── the state, the switch and the buffer ------------------------------------
rep(
    """    deadH: {}, app: {}, songKey: '', loadSeq: 0, openedAt: 0, coverOn: false,
""",
    """    deadH: {}, app: {}, rescueH: {}, songKey: '', loadSeq: 0, openedAt: 0, coverOn: false,
""",
    "the state",
)

rep(
    """  var SC_VFX_AMOUNT = 0.45;                // how much of the clarity pass is laid over the frame
""",
    """  var SC_VFX_AMOUNT = 0.6;                 // how much of the frame's own edges comes back
  var SC_VFX_BLUR = 'blur(1px)';           // the copy the edges are taken from
""",
    "the sharpen amount",
)

# ── the query, kept whole ---------------------------------------------------
rep(
    """  function scVideoNoRange(u){
    var s = String(u || '');
    if(!/^https?:/i.test(s) || !/[?&]range=/i.test(s)) return s;
    s = s.replace(/([?&])range=[^&]*/i, '$1');
    s = s.replace(/[?&](?=&|$)/g, '');
    return s;
  }
""",
    """  function scVideoNoRange(u){
    var s = String(u || '');
    if(!/^https?:/i.test(s) || !/[?&]range=/i.test(s)) return s;
    // THE PARAMETER BELONGS TO WHOEVER ASKED FOR IT, THE REST OF THE QUERY IS THE
    // ADDRESS. Dropping `range` with two replacements left `?&` where the first pair
    // had been, and `?&itag=137` is a path with no query at all - the element then
    // refused a link that was fine before it was edited. Every other pair is kept in
    // the order the player sent it.
    var q = s.indexOf('?');
    var head = q === -1 ? s : s.slice(0, q);
    var tail = q === -1 ? '' : s.slice(q + 1);
    var kept = [];
    tail.split('&').forEach(function(pair){
      if(!pair || /^range=/i.test(pair)) return;
      kept.push(pair);
    });
    return kept.length ? (head + '?' + kept.join('&')) : head;
  }
""",
    "the range strip",
)

# ── the sharpen -------------------------------------------------------------
rep(
    """  function scVideoFxPaint(){
""",
    """  // The buffer the sharpen is built in. It is never in the page: it holds one frame's
  // blurred copy and then that copy taken out of the frame, and it is overwritten with
  // the next one. A phone that will not hand over a second context keeps the resampled
  // frame instead of a black stage.
  var scVideoFxBufCv = null, scVideoFxBufCtx = null;
  function scVideoFxBuff(W, H){
    if(!scVideoFxBufCv){
      try{
        var cv = document.createElement('canvas');
        cv.id = 'scVideoFxBuf';
        var cx = cv.getContext ? cv.getContext('2d') : null;
        if(!cx) return null;
        scVideoFxBufCv = cv; scVideoFxBufCtx = cx;
      }catch(_eBuf){ scVideoFxBufCv = null; scVideoFxBufCtx = null; return null; }
    }
    if(scVideoFxBufCv.width !== W || scVideoFxBufCv.height !== H){
      scVideoFxBufCv.width = W; scVideoFxBufCv.height = H;
    }
    return { cv: scVideoFxBufCv, ctx: scVideoFxBufCtx };
  }
  function scVideoFxPaint(){
""",
    "the buffer",
)

rep(
    """    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh);
    // ONE CLEARITY PASS. The same frame, contrast-stretched, over itself: local contrast
    // goes up and edges read sharper, for one more draw and nothing to hold between
    // frames. A phone whose canvas refuses `filter` still gets the resampled frame.
    try{
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = SC_VFX_AMOUNT;
      ctx.filter = 'contrast(1.5) saturate(1.06)';
      ctx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh);
    }catch(_eFxPass){
    }finally{
      try{ ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }catch(_eFxReset){}
    }
  }
""",
    """    // THE EDGES ARE WHAT A SOFT FILM IS MISSING. A second canvas holds the frame
    // blurred, and the frame subtracted from that copy: the difference is the outline
    // of everything in the shot. Only that outline is added back, so flat areas stay
    // exactly where they were and the bright end is not lifted - which is what the
    // contrast-over-itself pass did, and why a low size looked washed instead of sharp.
    var buf = scVideoFxBuff(W, H);
    if(buf){
      var bx = buf.ctx;
      try{
        bx.globalCompositeOperation = 'source-over';
        bx.globalAlpha = 1;
        bx.fillStyle = '#000';
        bx.fillRect(0, 0, W, H);
        bx.imageSmoothingEnabled = true; bx.imageSmoothingQuality = 'high';
        bx.filter = SC_VFX_BLUR;
        bx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh);
        bx.filter = 'none';
        bx.globalCompositeOperation = 'difference';
        bx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh);
      }catch(_eFxBuf){
      }finally{
        try{ bx.filter = 'none'; bx.globalCompositeOperation = 'source-over'; bx.globalAlpha = 1; }catch(_eFxBufReset){}
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    try{ ctx.filter = 'none'; }catch(_eFxF){}
    try{ ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high'; }catch(_eFxSm){}
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    ctx.drawImage(v, 0, 0, vw, vh, dx, dy, dw, dh);
    if(buf){
      try{
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = SC_VFX_AMOUNT;
        ctx.drawImage(buf.cv, 0, 0);
      }catch(_eFxPass){
      }finally{
        try{ ctx.filter = 'none'; ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1; }catch(_eFxReset){}
      }
    }
  }
""",
    "the sharpen pass",
)

# ── the rescue --------------------------------------------------------------
rep(
    """  function scVideoRead(){
""",
    """  // THE READER CEILING. The bridge reads a file in one-megabyte ranges and stops at
  // its own ceiling; a size past it is not read, it is stepped down from.
  function scVideoReadCap(){
    try{ if(typeof SC_AUDIO_MAX === 'number' && SC_AUDIO_MAX > 0) return SC_AUDIO_MAX; }catch(_eCap){}
    return SC_VQ_READ_MAX;
  }

  // A REFUSED ADDRESS IS NOT A REFUSED PICTURE. `this source is not a video the
  // element can open` is a verdict on the URL and on nothing else: a cross-origin
  // media request, a link the media stack will not fetch, a host that answers this app
  // through the native bridge and not through a tag. The app already reads googlevideo
  // through that bridge - it is how the downloader and Streaming work - so the size
  // that was refused is read there, at the second the picture was on, and played from
  // memory. One read per size per video; the one-stream rows are never read because
  // they are the ones that already play.
  function scVideoRescue(rung){
    if(!rung || rung.muxed || !rung.url) return false;
    if(typeof scFetchBytes !== 'function') return false;
    var size = Number(rung.size) || 0;
    var cap = scVideoReadCap();
    if(size > cap) return false;                       // this reader cannot hold it
    if(!scVideoState.rescueH) scVideoState.rescueH = {};
    if(scVideoState.rescueH[rung.h]) return false;     // this size was already read
    scVideoState.rescueH[rung.h] = 1;
    var v = scVideoEl('scVideoEl');
    // WHERE THE PICTURE WAS, IF IT WAS ANYWHERE. A row that never started is at 0,
    // and a read that took four seconds must not drop the picture onto the intro of
    // a song that is two minutes in - nothing kept here means the attach opens on
    // the song's own second, the way every other size does.
    var at = v ? (Number(v.currentTime) || 0) : 0;
    scVideoState.resumeAt = at > 0.5 ? at : null;
    scVideoSpin(true);
    scVideoIdleWake();
    scVideoSay('The player would not open ' + rung.label + ' here - reading it instead…');
    var job = null;
    try{
      job = scFetchBytes(rung.url, size || cap, function(loaded, total){
        var pct = total ? Math.round((loaded / total) * 100) : 0;
        scVideoSay('Reading ' + rung.label + '…' + (pct > 0 ? ' ' + pct + '%' : ''));
      }, 4);
    }catch(_eRes){ job = null; }
    if(!job){ scVideoSpin(false); return false; }
    Promise.resolve(job).then(function(buf){
      // A CLOSED TAB OR A SIZE CHANGED UNDER THE READ. The bytes are for a picture that
      // is no longer the one on the screen.
      if(!scVideoState.open || scVideoState.rung !== rung) return;
      if(!buf || !buf.byteLength){ scVideoRescueDown(rung, 'it came back empty'); return; }
      var type = String(rung.mime || 'video/mp4').split(';')[0].trim() || 'video/mp4';
      try{ if(scVideoState.blobUrl) URL.revokeObjectURL(scVideoState.blobUrl); }catch(_eRev){}
      var blob = null;
      try{ blob = URL.createObjectURL(new Blob([buf], { type: type })); }catch(_eBlob){ blob = null; }
      if(!blob){ scVideoRescueDown(rung, 'it could not be held in memory'); return; }
      scVideoState.blobUrl = blob;
      scVideoState.drops = 0;                 // nothing has been stepped down from
      scVideoFoot('This size would not open from the player here, so it was read instead (' +
        rung.label + ').');
      scVideoAttach(blob, 'blob', true);
    }).catch(function(){ scVideoRescueDown(rung, 'it could not be read'); });
    return true;
  }
  // The bytes did not come either. The size is given up on the way it used to be, one
  // rung down, and this height is not read again for this video.
  function scVideoRescueDown(rung, why){
    if(!scVideoState.open) return;
    scVideoSpin(false);
    scVideoFoot((rung ? rung.label : 'That size') + ' could not be read here either (' +
      why + '). Stepping down.');
    if(scVideoState.rung === rung) scVideoFailed(true);
  }

  function scVideoRead(){
""",
    "the rescue",
)

rep(
    """    // Another codec at the same height, first: the size the owner asked for is
    // worth one more stream before it is given up on.
""",
    """    // THE ADDRESS MAY BE THE ONLY THING WRONG WITH IT. Read the size the element
    // refused, once, with the bridge the downloader uses - a row whose URL the media
    // stack will not open is a row the app can still play from memory. This is what
    // keeps the picture at the size that was asked for instead of walking to 360p.
    if((code === 3 || code === 4) && scVideoRescue(from)) return;
    // Another codec at the same height, first: the size the owner asked for is
    // worth one more stream before it is given up on.
""",
    "the rescue hook",
)

rep(
    """    scVideoState.deadH = {};
""",
    """    scVideoState.deadH = {};
    scVideoState.rescueH = {};
""",
    "the load reset",
)


def once(text, needle, what):
    n = text.count(needle)
    if n != 1:
        raise SystemExit("build-8533: %s appears %d times, expected exactly 1" % (what, n))


def main():
    src = io.open(SRC, encoding="utf-8").read()
    out = src
    head = out.index("  // ─── 85.3.2 - THE LADDER IS THE LADDER")
    cut = out.index("  var scVideoState = {")
    out = out[:head] + BANNER_NEW + "\n" + out[cut:]
    for old, new, what in R:
        once(out, old, what)
        out = out.replace(old, new, 1)
    # What the release promises has to be in the module that ships.
    for mark in ("function scVideoRescue", "scVideoState.rescueH = {}", "function scVideoReadCap",
                 "function scVideoFxBuff", "SC_VFX_BLUR", "var kept = [];"):
        if mark not in out:
            raise SystemExit("build-8533: the module lacks %r" % mark)
    if "globalCompositeOperation = 'overlay'" in out:
        raise SystemExit("build-8533: the washing contrast pass is still in the frame")
    if "scVideoState.rescueH[rung.h] = 1" not in out:
        raise SystemExit("build-8533: a refused size would be read again and again")
    io.open(OUT, "w", encoding="utf-8").write(out)
    print("wrote %s (%d lines)" % (os.path.relpath(OUT, ROOT), out.count("\n")))
    return 0


if __name__ == "__main__":
    sys.exit(main())
