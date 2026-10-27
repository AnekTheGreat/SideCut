"""80.3.3, section 1 - the ranges go out together.

scFetchBytes reads a bounded-range stream through several lanes at once (googlevideo
refuses a request wider than one range) and stitches the bytes back in range order.
Also here: scDlLanes, the lane count, and the run-pool helpers that sit with them.

Imported by dev/patch-8033.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 1. The ranges go out together (scFetchBytes)
# ---------------------------------------------------------------------------
RANGES_OLD_START = """  async function scFetchBytes(url, expectedSize, onProgress){
    var parts = [], total = 0, off = 0;
"""
RANGES_END = """  // ---- Play build acquisition layer"""

RANGES_NEW = r"""  // 80.3.3 - THE RANGES GO OUT TOGETHER. googlevideo refuses a request wider than one
  // megabyte, so a 10 MB song is ten round trips, and this reader used to pay them one
  // after another: a 32-song album spent most of its hour waiting for replies it could
  // have asked for at the same time. The same bounded ranges are now pulled
  // SC_DL_LANES at a time and stitched back in order, so the file is byte-for-byte the
  // one the sequential reader produced - only the waiting overlaps.
  var SC_DL_LANES = 4;             // bounded ranges asked for at once
  function scDlLanes(){
    var want = (typeof window !== 'undefined' && window.__scDlLanes) ? parseInt(window.__scDlLanes, 10) : 0;
    if(!(want > 0)) want = SC_DL_LANES;
    return Math.max(1, Math.min(6, want));
  }
  async function scFetchBytes(url, expectedSize, onProgress){
    var ordered = [], loaded = 0, size = Number(expectedSize) || 0, more = false;
    function want(){
      // 40 MiB is this reader's ceiling, so a long stream is measured against the
      // ceiling rather than against a length it can never reach.
      return size ? Math.min(size, SC_AUDIO_MAX) : 0;
    }
    function report(){
      if(!onProgress) return;
      var w = want();
      if(w > 0){ try{ onProgress(Math.min(loaded, w), w); }catch(_op){} }
    }
    function rangeOf(off){
      return [off, Math.min(off + SC_AUDIO_CHUNK, SC_AUDIO_MAX) - 1];
    }
    // The first range goes alone: its reply carries the stream's real length
    // (content-range) when the player never mentioned one, and everything after it is
    // planned against that number. A refusal here is the answer the sequential reader
    // gave too, so the caller moves on to its next candidate.
    var first = await scFetchRange(url, 0, SC_AUDIO_CHUNK - 1);
    if(!first || !first.bytes || !first.bytes.length) return null;
    // A 200 means the server ignored the Range header and sent the whole file: those
    // bytes ARE the stream. (The sequential reader appended them to the first range and
    // handed back a corrupt file in this case.)
    if(!first.partial) return first.bytes.buffer;
    ordered.push(first.bytes);
    loaded = first.bytes.length;
    if(!size && first.total) size = first.total;
    more = first.bytes.length >= SC_AUDIO_CHUNK;   // a short first read IS the file
    report();
    if(more){
      // Ranges 1..plan-1, planned from the length we now know. A reported length is a
      // hint and not a promise - the sequential reader never let it cut a stream short,
      // and this one does not either (whatever the plan does not cover is read one
      // range at a time below).
      var plan = size ? Math.max(1, Math.ceil(Math.min(size, SC_AUDIO_MAX) / SC_AUDIO_CHUNK))
                      : Math.ceil(SC_AUDIO_MAX / SC_AUDIO_CHUNK);
      if(plan > 1){
        // Range 0 is already in hand; the lanes start at 1.
        var slots = [], ended = false, next = 1;
        async function lane(){
          while(true){
            if(ended || window.__scCancelDl) return;
            var idx = next++;
            if(idx >= plan) return;
            var rr = rangeOf(idx * SC_AUDIO_CHUNK);
            var part = await scFetchRange(url, rr[0], rr[1]);
            // A full 206 is the only shape that says "more is still there": anything
            // else - nothing at all, a refusal, or a range that came back short - is
            // where the stream ends.
            var whole = !!(part && part.bytes && part.bytes.length === (rr[1] - rr[0] + 1) && part.partial);
            if(whole){ slots[idx] = part.bytes; loaded += part.bytes.length; report(); }
            else { slots[idx] = (part && part.bytes && part.bytes.length && part.partial) ? part.bytes : null; ended = true; }
          }
        }
        var lanes = Math.max(1, Math.min(scDlLanes(), plan - 1));
        var running = [];
        for(var l = 0; l < lanes; l++) running.push(lane());
        await Promise.all(running);
        more = false;
        for(var i = 1; i <= plan - 1; i++){
          var got = slots[i];
          if(!got) break;                            // the stream ended inside this range
          ordered.push(got);
          if(got.length < SC_AUDIO_CHUNK) break;     // and this range held its tail
          more = true;                               // full range: there may be more
        }
      }
    }
    // Whatever the plan did not cover - an unknown length, or a length the player
    // under-reported - is read range by range until a short read or a refusal ends the
    // stream, which is exactly the loop this reader used to run.
    var off = 0;
    for(var o = 0; o < ordered.length; o++) off += ordered[o].length;
    while(more && off < SC_AUDIO_MAX){
      if(window.__scCancelDl) break;
      var rr2 = rangeOf(off);
      var p2 = await scFetchRange(url, rr2[0], rr2[1]);
      if(!p2 || !p2.bytes || !p2.bytes.length) break;
      ordered.push(p2.bytes);
      loaded += p2.bytes.length;
      report();
      if(!p2.partial || p2.bytes.length < (rr2[1] - rr2[0] + 1)) break;
      off += p2.bytes.length;
    }
    // The bytes in hand are the file: measured from the ranges themselves, so the
    // body cannot disagree with what is handed back.
    var total = 0;
    for(var a = 0; a < ordered.length; a++) total += ordered[a].length;
    if(!total) return null;
    if(size && size > SC_AUDIO_CHUNK && total + 4096 < size) return null;
    var out = new Uint8Array(total), pos = 0;
    for(var b2 = 0; b2 < ordered.length; b2++){ out.set(ordered[b2], pos); pos += ordered[b2].length; }
    return out.buffer;
  }
  // ---- One run, several songs at once -------------------------------------------
  // A batch used to be strictly one song at a time: the next lookup did not start
  // until the previous file had been looked up, fetched, decoded and encoded. Every
  // leg of that pipeline waits on something else, so running one song at a time added
  // those waits up; a small pool overlaps them instead, and each song still produces
  // exactly the file it did before. The pool changes WHEN the work happens, never what
  // it does.
  //
  // The lane count is a MEMORY budget, not a network one. A lane holds one song's
  // decoded audio, and a 3.5-minute stereo track is ~74 MB of Float32, so the number
  // is what the device can hold at once: 2 on a small phone, 3 on a normal one, 4 on a
  // roomy one. window.__scDlTracks overrides it (the harness does).
  function scDownloadLanes(){
    var want = (typeof window !== 'undefined' && window.__scDlTracks) ? parseInt(window.__scDlTracks, 10) : 0;
    if(want > 0) return Math.max(1, Math.min(4, want));
    var gb = 0;
    try{ gb = (typeof navigator !== 'undefined' && navigator.deviceMemory) ? Number(navigator.deviceMemory) : 0; }catch(_gb){ gb = 0; }
    if(gb && gb < 3) return 2;
    if(gb && gb >= 6) return 4;
    return 3;
  }
  async function scRunPool(items, lanes, work){
    var list = items || [];
    if(!list.length) return;
    var n = Math.max(1, Math.min(list.length, parseInt(lanes, 10) || 1));
    var next = 0;
    async function lane(){
      // A cancelled run stops at the next song boundary; the song already in flight
      // unwinds through its own checks (every fetch, decode and encode step watches
      // __scCancelDl).
      while(!window.__scCancelDl){
        var i = next++;
        if(i >= list.length) return;
        await work(list[i], i);
      }
    }
    var running = [];
    for(var l = 0; l < n; l++) running.push(lane());
    await Promise.all(running);
  }
"""
