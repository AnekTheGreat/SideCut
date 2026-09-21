#!/usr/bin/env node
// v60.0.10b — the second half of the same fix, from the measured behaviour:
//
// YouTube caps the AUDIO-ONLY streams of music uploads at exactly their first
// megabyte (403 past it) while the progressive audio+video stream of the same
// video is not capped. Measured live, ANDROID client:
//   "Dealer" (Diljit Dosanjh)  itag 140 2,923,372 B: 0-1MiB → 206, +1MiB → 403
//                              itag 18 11,317,380 B: 11 chunks → 206, complete
//   "52 Bars" (Karan Aujla)    itag 140 3,588,881 B: 0-1MiB → 206, +1MiB → 403
//                              itag 18:               +1MiB → 206
//   non-music                  itag 140 3,449,447 B: +1MiB → 206 (no cap)
// So: keep the small audio-only streams first (best quality, and all there is
// for ordinary videos), put a muxed stream behind them, probe with two bytes
// instead of downloading a megabyte that can never complete, and learn the real
// size from Content-Range so a capped stream is rejected even when the player
// did not report a length.
const fs = require('fs');
const path = require('path');
const FILE = path.resolve(__dirname, '..', 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const report = [];
function sub(label, needle, repl) {
  const n = src.split(needle).length - 1;
  if (n !== 1) { report.push({ label, ok: false, found: n }); throw new Error(label); }
  src = src.split(needle).join(repl);
  report.push({ label, ok: true });
}

// ── 1. two pools: audio-only first, muxed behind it
sub('player-pools', `    // Which clients can answer changes week to week, and a stream that answers
    // is not the same as a stream that downloads (see scFetchBytes), so gather
    // the streams of the first two clients that respond and let the downloader
    // walk them: one dead URL used to end the whole conversion.
    var streams = [], seenUrls = {}, answered = 0, metaTitle = '', metaAuthor = '';
    for(var c = 0; c < clients.length; c++){
      if(answered >= 2) break;
      try{
        var ctx = { client: clients[c].client };
        if(clients[c].third) ctx.thirdParty = { embedUrl: clients[c].third };
        var d = await scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', { context: ctx, videoId: videoId, contentCheckOk: true, racyCheckOk: true });
        if(!d || !d.streamingData) continue;
        answered++;
        var vd = d.videoDetails || {};
        if(!metaTitle && vd.title) metaTitle = vd.title;
        if(!metaAuthor && vd.author) metaAuthor = vd.author;
        var fmts = (d.streamingData.adaptiveFormats || []).concat(d.streamingData.formats || []);
        // Best first: opus 251 > m4a 141 > m4a 140, else first audio.
        fmts.sort(function(x, y){ return rankOf(x.itag) - rankOf(y.itag); });
        var added = 0;
        for(var i = 0; i < fmts.length && added < 2; i++){
          var f = fmts[i];
          if(!f || !f.mimeType) continue;
          if(String(f.mimeType).toLowerCase().indexOf('audio/') !== 0) continue;
          var streamUrl = f.url || deco(f);
          if(!streamUrl || seenUrls[streamUrl]) continue;
          seenUrls[streamUrl] = true;
          streams.push({ url: streamUrl, mime: f.mimeType, itag: f.itag, size: Number(f.contentLength || f.clen) || 0 });
          added++;
        }
      }catch(e){}
    }
    if(!streams.length) return null;
    return {
      url: streams[0].url, mime: streams[0].mime, itag: streams[0].itag, size: streams[0].size,
      alts: streams.slice(1), videoTitle: metaTitle, author: metaAuthor
    };
  }`, `    // Which clients can answer changes week to week, and a stream that answers
    // is not the same as a stream that downloads, so the streams of the first
    // two clients that respond are gathered and the downloader walks them: one
    // dead URL used to end the whole conversion.
    //
    // Two pools, because YouTube caps the audio-only streams of music uploads
    // at their first megabyte (measured: 403 past it) while the progressive
    // audio+video stream of the same video is not capped. Audio-only streams go
    // first — they are small, they decode cleanly, and for anything that is not
    // a music upload they are the whole answer — with a muxed stream behind
    // them for the music case.
    var audioStreams = [], muxedStreams = [], seenUrls = {}, answered = 0, metaTitle = '', metaAuthor = '';
    var take = function(list, wantMuxed, into){
      var rows = (list || []).slice();
      // Best first: opus 251 > m4a 141 > m4a 140, else first audio.
      rows.sort(function(x, y){ return rankOf(x.itag) - rankOf(y.itag); });
      for(var k = 0; k < rows.length; k++){
        var f = rows[k];
        if(!f || !f.mimeType) continue;
        var mt = String(f.mimeType);
        var isAudio = mt.toLowerCase().indexOf('audio/') === 0;
        if(wantMuxed ? isAudio : !isAudio) continue;
        // A progressive row has to actually carry audio, or there is nothing
        // to decode out of it.
        if(wantMuxed && !/mp4a|opus|vorbis/i.test(mt)) continue;
        var u = f.url || deco(f);
        if(!u || seenUrls[u]) continue;
        seenUrls[u] = true;
        into.push({ url: u, mime: mt, itag: f.itag, size: Number(f.contentLength || f.clen) || 0, muxed: !!wantMuxed });
        return true;
      }
      return false;
    };
    for(var c = 0; c < clients.length; c++){
      if(answered >= 2) break;
      try{
        var ctx = { client: clients[c].client };
        if(clients[c].third) ctx.thirdParty = { embedUrl: clients[c].third };
        var d = await scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', { context: ctx, videoId: videoId, contentCheckOk: true, racyCheckOk: true });
        if(!d || !d.streamingData) continue;
        answered++;
        var vd = d.videoDetails || {};
        if(!metaTitle && vd.title) metaTitle = vd.title;
        if(!metaAuthor && vd.author) metaAuthor = vd.author;
        take(d.streamingData.adaptiveFormats, false, audioStreams);
        take(d.streamingData.formats, true, muxedStreams);
      }catch(e){}
    }
    var streams = audioStreams.concat(muxedStreams);
    if(!streams.length) return null;
    return {
      url: streams[0].url, mime: streams[0].mime, itag: streams[0].itag, size: streams[0].size, muxed: !!streams[0].muxed,
      alts: streams.slice(1), videoTitle: metaTitle, author: metaAuthor
    };
  }`);

// ── 2. a range request now also reports the status and the real file size
sub('range-status', `        if(res && (res.status === 206 || res.status === 200)){
          var bytes = scHttpDataToBytes(res.data);
          if(bytes && bytes.length) return { bytes: bytes, partial: res.status === 206 };
        }
      }catch(e){}
    }
    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 30000);
      var r = await fetch(url, { signal: ctrl.signal, headers: { 'Range': range } });
      clearTimeout(timer);
      if(r && (r.status === 206 || r.ok)){
        var ab = await r.arrayBuffer();
        if(ab && ab.byteLength) return { bytes: new Uint8Array(ab), partial: r.status === 206 };
      }
    }catch(e){}
    return null;
  }`, `        if(res && (res.status === 206 || res.status === 200)){
          var bytes = scHttpDataToBytes(res.data);
          if(bytes && bytes.length) return { bytes: bytes, partial: res.status === 206, total: scRangeTotal(res.headers), status: res.status };
          return { bytes: null, partial: false, total: 0, status: res.status };
        }
        if(res && res.status) return { bytes: null, partial: false, total: 0, status: res.status };
      }catch(e){}
    }
    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 30000);
      var r = await fetch(url, { signal: ctrl.signal, headers: { 'Range': range } });
      clearTimeout(timer);
      if(r && (r.status === 206 || r.ok)){
        var cr = '';
        try{ cr = (r.headers && r.headers.get && r.headers.get('content-range')) || ''; }catch(_h){}
        var ab = await r.arrayBuffer();
        if(ab && ab.byteLength) return { bytes: new Uint8Array(ab), partial: r.status === 206, total: scRangeTotal(cr), status: r.status };
      }
      if(r && r.status) return { bytes: null, partial: false, total: 0, status: r.status };
    }catch(e){}
    return null;
  }
  // "bytes 0-1023/2923372" -> 2923372. The server's own idea of the file size,
  // which is how a stream is measured even when the player reported no length.
  function scRangeTotal(headers){
    var cr = '';
    try{ cr = (headers && (headers['content-range'] || headers['Content-Range'])) || ''; }catch(e){}
    if(!cr) return 0;
    var m = String(cr).match(/\\/(\\d+)\\s*$/);
    return m ? (Number(m[1]) || 0) : 0;
  }`);

// ── 3. the probe + the size from Content-Range
sub('bytes-guard', `  async function scFetchBytes(url, expectedSize){
    var parts = [], total = 0, off = 0;
    while(off < SC_AUDIO_MAX){
      var end = Math.min(off + SC_AUDIO_CHUNK, SC_AUDIO_MAX) - 1;
      var part = await scFetchRange(url, off, end);
      if(!part || !part.bytes || !part.bytes.length) break;
      parts.push(part.bytes);
      total += part.bytes.length;
      // A short read ends the file; a full one means ask for the next chunk.
      if(!part.partial || part.bytes.length < (end - off + 1)) break;
      off += part.bytes.length;
    }
    if(!total) return null;
    if(expectedSize && expectedSize > SC_AUDIO_CHUNK && total + 4096 < expectedSize) return null;
    var out = new Uint8Array(total), pos = 0;
    for(var i = 0; i < parts.length; i++){ out.set(parts[i], pos); pos += parts[i].length; }
    return out.buffer;
  }`, `  // Two bytes past the first megabyte: enough to know whether the server will
  // serve the rest of this stream. A capped stream (403) is skipped without
  // pulling a megabyte that can never complete; 416 means the file is simply
  // smaller than a chunk, which is fine.
  async function scStreamUsable(url, size){
    if(size && size <= SC_AUDIO_CHUNK) return true;
    var probe = await scFetchRange(url, SC_AUDIO_CHUNK, SC_AUDIO_CHUNK + 1);
    if(probe && probe.bytes && probe.bytes.length) return true;
    return !!(probe && probe.status === 416);
  }
  async function scFetchBytes(url, expectedSize){
    var parts = [], total = 0, off = 0;
    while(off < SC_AUDIO_MAX){
      var end = Math.min(off + SC_AUDIO_CHUNK, SC_AUDIO_MAX) - 1;
      var part = await scFetchRange(url, off, end);
      if(!part || !part.bytes || !part.bytes.length) break;
      parts.push(part.bytes);
      total += part.bytes.length;
      // The first reply tells us the real size even when the player didn't.
      if(!expectedSize && part.total) expectedSize = part.total;
      // A short read ends the file; a full one means ask for the next chunk.
      if(!part.partial || part.bytes.length < (end - off + 1)) break;
      off += part.bytes.length;
    }
    if(!total) return null;
    if(expectedSize && expectedSize > SC_AUDIO_CHUNK && total + 4096 < expectedSize) return null;
    var out = new Uint8Array(total), pos = 0;
    for(var i = 0; i < parts.length; i++){ out.set(parts[i], pos); pos += parts[i].length; }
    return out.buffer;
  }`);

// ── 4. decode: probe each stream before pulling it
sub('decode-probe', `    for(var i = 0; i < list.length; i++){
      var s = list[i] || {};
      if(!s.url) continue;
      try{
        var ab = await scFetchBytes(s.url, s.size);`, `    for(var i = 0; i < list.length; i++){
      var s = list[i] || {};
      if(!s.url) continue;
      try{
        if(!(await scStreamUsable(s.url, s.size))) continue;
        var ab = await scFetchBytes(s.url, s.size);`);

fs.writeFileSync(FILE, src);
for (const r of report) console.log((r.ok ? '✓' : '✗') + ' ' + r.label);
console.log('\nindex.html now ' + src.length + ' bytes');
