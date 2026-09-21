#!/usr/bin/env node
// v60.0.10 — the converter's "no source found" is two separate bugs:
//   1. googlevideo no longer serves an unbounded request (no Range header, an
//      open-ended range, or a range wider than 1 MiB all answer 403), so the
//      whole-file download returned nothing and every track failed;
//   2. a multi-artist Spotify credit ("Sukha, Chani") required EVERY word to
//      appear in the single uploader name, so the official upload of a
//      co-credited song never verified.
// Plus: the player now hands back several streams instead of one, so a dead or
// capped URL no longer ends the run, and a truncated preview can't pass as a
// whole song.
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
const origLen = src.length;
const report = [];
function sub(label, needle, repl, expect) {
  const n = src.split(needle).length - 1;
  if (n !== (expect === undefined ? 1 : expect)) {
    report.push({ label, ok: false, found: n });
    return false;
  }
  src = src.split(needle).join(repl);
  report.push({ label, ok: true, found: n });
  return true;
}

// ── 1. the player ladder: collect streams from the first two clients that answer
if (!sub('player-clients', `    var clients = [
      { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 },
      { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' },
      { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20250220.01.00' },
      { clientName: 'WEB', clientVersion: '2.20250220.01.00' },
      { clientName: 'MWEB', clientVersion: '2.20250220.00.00' },
      { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.20240812.00.00' }
    ];`, `    var clients = [
      { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 } },
      { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' } },
      { client: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', androidSdkVersion: 32, deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12' } },
      { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.20240812.00.00' }, third: 'https://www.youtube.com/' },
      { client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20250220.01.00' }, third: 'https://www.youtube.com/' },
      { client: { clientName: 'MWEB', clientVersion: '2.20250220.00.00' }, third: 'https://www.youtube.com/' }
    ];`)) throw new Error('player-clients');

if (!sub('player-loop', `    for(var c = 0; c < clients.length; c++){
      try{
        var body = JSON.stringify({ context: { client: clients[c] }, videoId: videoId, contentCheckOk: true, racyCheckOk: true });
        var d = await scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', JSON.parse(body));
        if(!d) continue;
        if(!d || !d.streamingData) continue;
        var fmts = (d.streamingData.adaptiveFormats || []).concat(d.streamingData.formats || []);
        // Pick the best audio-only stream: opus 251 > m4a 141 > m4a 140, else first audio.
        var best = null, bestRank = 99;
        for(var i = 0; i < fmts.length; i++){
          var f = fmts[i];
          if(!f || !f.url || !f.mimeType) continue;
          if((f.mimeType || '').toLowerCase().indexOf('audio/') !== 0) continue;
          var rank = f.itag === 251 ? 0 : f.itag === 141 ? 1 : f.itag === 140 ? 2 : 3;
          if(rank < bestRank){ bestRank = rank; best = f; }
          if(rank === 0) break;
        }
        if(best){
          var vd = d.videoDetails || {};
          return { url: best.url, mime: best.mimeType, videoTitle: vd.title || '', author: vd.author || '' };
        }
      }catch(e){}
    }
    return null;
  }`, `    function rankOf(itag){ return itag === 251 ? 0 : itag === 141 ? 1 : itag === 140 ? 2 : 3; }

    // Which clients can answer changes week to week, and a stream that answers
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
  }`)) throw new Error('player-loop');

// ── 2. the transport: bounded 1 MiB ranges, stitched, size-checked
if (!sub('fetch-bytes', `  async function scFetchBytes(url){
    var Http = __scCapHttp();
    if(Http){
      try{
        var res = await Http.request({ url: url, method: 'GET', responseType: 'arraybuffer', readTimeout: 60000, connectTimeout: 15000 });
        if(res && res.status === 200 && res.data){
          var b64 = (typeof res.data === 'string') ? String(res.data).replace(/^data:[^;]*;base64,/, '') : '';
          if(b64){
            var bin = atob(b64);
            var bytes = new Uint8Array(bin.length);
            for(var bi = 0; bi < bin.length; bi++) bytes[bi] = bin.charCodeAt(bi);
            return bytes.buffer;
          }
        }
      }catch(e){}
    }
    try{
      var ctrl = new AbortController();
      var timer = setTimeout(function(){ ctrl.abort(); }, 25000);
      var r = await fetch(url, { signal: ctrl.signal, headers: { 'Range': 'bytes=0-9999999' } });
      clearTimeout(timer);
      if(r && r.ok){ var ab = await r.arrayBuffer(); if(ab && ab.byteLength) return ab; }
    }catch(e){}
    return null;
  }`, `  // googlevideo no longer serves an unbounded request: a GET with no Range
  // header, an open-ended range, or a range wider than 1 MiB all answer 403,
  // so the old whole-file download silently came back empty and every
  // conversion died with "no source found". A stream is pulled as a run of
  // bounded 1 MiB ranges and stitched back together instead.
  var SC_AUDIO_CHUNK = 1048576;   // 1 MiB — the widest range googlevideo serves
  var SC_AUDIO_MAX = 41943040;    // 40 MiB ceiling (a long track is 10-15 MB)
  function scHttpDataToBytes(data){
    if(!data) return null;
    if(typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer) return new Uint8Array(data);
    if(typeof data !== 'string') return null;
    var b64 = String(data).replace(/^data:[^;]*;base64,/, '');
    if(!b64) return null;
    try{
      var bin = atob(b64);
      var bytes = new Uint8Array(bin.length);
      for(var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      return bytes;
    }catch(e){ return null; }
  }
  // One bounded range. partial marks a 206 (the server honoured the range); a
  // 200 means it ignored the header and sent the whole file.
  async function scFetchRange(url, start, end){
    var range = 'bytes=' + start + '-' + end;
    var Http = __scCapHttp();
    if(Http){
      try{
        var res = await Http.request({ url: url, method: 'GET', headers: { 'Range': range }, responseType: 'arraybuffer', readTimeout: 45000, connectTimeout: 15000 });
        if(res && (res.status === 206 || res.status === 200)){
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
  }
  // expectedSize (from the player) guards against YouTube's truncated preview:
  // an unauthorised stream can stop at its first megabyte, which decodes to a
  // few seconds of audio, so an undersized download is a failure — the caller
  // then tries the next stream instead of saving a stub.
  async function scFetchBytes(url, expectedSize){
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
  }`)) throw new Error('fetch-bytes');

// ── 3. decode: walk every stream the player handed over
if (!sub('fetch-decode', `  async function scFetchDecode(url){
    try{
      var ab = await scFetchBytes(url);
      if(!ab || !ab.byteLength) return null;
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      try{
        var buf = await ctx.decodeAudioData(ab);
        return buf;
      }catch(e){ try{ ctx.close(); }catch(_e){} return null; }
    }catch(e){ return null; }
  }`, `  // Tries every stream the player handed over (lead client first, then the
  // alternates) and returns the decoded audio plus the URL that actually
  // worked, so a blocked, capped or undecodable stream no longer ends the run.
  async function scFetchDecode(stream){
    if(!stream) return null;
    var list = [{ url: stream.url, size: stream.size }].concat(stream.alts || []);
    for(var i = 0; i < list.length; i++){
      var s = list[i] || {};
      if(!s.url) continue;
      try{
        var ab = await scFetchBytes(s.url, s.size);
        if(!ab || !ab.byteLength) continue;
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var buf = null;
        try{ buf = await ctx.decodeAudioData(ab); }catch(_de){ buf = null; }
        try{ ctx.close(); }catch(_ce){}
        if(buf && buf.duration) return { buffer: buf, url: s.url };
      }catch(e){}
    }
    return null;
  }`)) throw new Error('fetch-decode');

// ── 4. the artist check: a multi-artist credit matches if ONE credit matches
if (!sub('artist-match', `    var a = norm(artist);
    var ath = norm(author);
    var own = norm(owner);
    var ct = norm(candTitle);
    var vt = norm(videoTitle);
    if(!a || a === 'unknown' || a === 'unknown artist' || a === 'various artists') return true;
    var aWords = a.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and' && w !== 'feat'; });
    if(!aWords.length) return true;
    function hasArtist(blob){
      if(!blob) return false;
      var bWords = blob.split(' ');
      if(blob.indexOf(a) !== -1) return true;
      var hits = 0;
      for(var i = 0; i < aWords.length; i++){
        for(var j = 0; j < bWords.length; j++){
          if(bWords[j] === aWords[i]){ hits++; break; }
          if(aWords[i].length > 3 && bWords[j].indexOf(aWords[i]) !== -1){ hits++; break; }
        }
      }
      return hits >= Math.min(2, aWords.length) || (hits === 1 && aWords.length === 1);
    }
    if(hasArtist(ath)) return true;                    // uploader is the artist
    var topic = /- topic$/.test(own) || /- topic$/.test(ath);
    if(topic && hasArtist(ct)) return true;            // official label auto-channel
    if(topic && hasArtist(vt)) return true;
    return false;
  }`, `    var a = norm(artist);
    if(!a || a === 'unknown' || a === 'unknown artist' || a === 'various artists') return true;
    var ath = norm(author);
    var own = norm(owner);
    var ct = norm(candTitle);
    var vt = norm(videoTitle);
    var topic = /- topic$/.test(own) || /- topic$/.test(ath);
    // A Spotify credit is often several artists at once — "Sukha, Chani",
    // "Diljit Dosanjh & Sia", "A x B feat. C". An upload has ONE channel, so
    // requiring every word of the whole credit to appear there rejected the
    // official upload of every co-credited song: the search found the right
    // source and the check threw it away, which is the album that always ended
    // in "no source found". Each credited artist is judged on its own now, and
    // the source still has to belong to one of them, so a cover uploaded by an
    // unrelated artist is rejected exactly as before.
    var credits = String(artist).split(/\\s*(?:,|;|\\/|&|\\u00b7|\\bfeat\\.?\\b|\\bft\\.?\\b|\\bwith\\b|\\bx\\b)\\s*/i).map(norm);
    var tried = 0;
    for(var ci = 0; ci < credits.length; ci++){
      var credit = credits[ci];
      if(!credit) continue;
      var aWords = credit.split(' ').filter(function(w){ return w.length > 2 && w !== 'the' && w !== 'and' && w !== 'feat'; });
      if(!aWords.length) continue;
      tried++;
      var hasArtist = (function(pWords, pStr){
        return function(blob){
          if(!blob) return false;
          var bWords = blob.split(' ');
          if(blob.indexOf(pStr) !== -1) return true;
          var hits = 0;
          for(var i = 0; i < pWords.length; i++){
            for(var j = 0; j < bWords.length; j++){
              if(bWords[j] === pWords[i]){ hits++; break; }
              if(pWords[i].length > 3 && bWords[j].indexOf(pWords[i]) !== -1){ hits++; break; }
            }
          }
          return hits >= Math.min(2, pWords.length) || (hits === 1 && pWords.length === 1);
        };
      })(aWords, credit);
      if(hasArtist(ath)) return true;                  // uploader is that artist
      if(topic && hasArtist(ct)) return true;          // official label auto-channel
      if(topic && hasArtist(vt)) return true;
    }
    return tried === 0;                                // nothing to judge on
  }`)) throw new Error('artist-match');

// ── 5. scSpToBuffer: use the new decode result and report WHY it failed
if (!sub('sp-buffer-search', `    var cands = await scYtSearch(query, artist);
    if(!cands || !cands.length) return null;`, `    var cands = await scYtSearch(query, artist);
    if(!cands || !cands.length){ window.__scSourceFail = 'no source found'; return null; }`)) throw new Error('sp-buffer-search');

if (!sub('sp-buffer-tail', `    if(!audio) return null;
    if(onStatus) onStatus('\u2b07 Downloading the audio on your device (a few seconds)\u2026');
    var buffer = await scFetchDecode(audio.url);
    if(!buffer) return null;
    if(onStatus) onStatus('\u2713 Audio ready \u2014 pick MP3, WAV or FLAC below');
    return { buffer: buffer, streamUrl: audio.url, videoTitle: audio.videoTitle || '' };`, `    if(!audio){ window.__scSourceFail = 'no matching source'; return null; }
    if(onStatus) onStatus('\u2b07 Downloading the audio on your device (a few seconds)\u2026');
    var dec = await scFetchDecode(audio);
    if(!dec){ window.__scSourceFail = 'download blocked'; return null; }
    if(onStatus) onStatus('\u2713 Audio ready \u2014 pick MP3, WAV or FLAC below');
    return { buffer: dec.buffer, streamUrl: dec.url, videoTitle: audio.videoTitle || '' };`)) throw new Error('sp-buffer-tail');

// ── 6. one-track reason, so a row says what actually happened
if (!sub('convert-one', `  async function scConvertOneTrack(meta, fmt, onStatus){
    if(onStatus) onStatus('Searching for "' + meta.title + '"\u2026');
    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); });
    if(!res || !res.buffer) return { ok: false, reason: 'no source found' };`, `  async function scConvertOneTrack(meta, fmt, onStatus){
    window.__scSourceFail = '';
    if(onStatus) onStatus('Searching for "' + meta.title + '"\u2026');
    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); });
    if(!res || !res.buffer) return { ok: false, reason: window.__scSourceFail || 'no source found' };`)) throw new Error('convert-one');

// ── 7. the YouTube converter uses the same helpers
if (!sub('yt-format', `      var audio = await scYtPlayer(videoId);
      if(!audio) return null;
      var buf = await scFetchDecode(audio.url);
      if(!buf) return null;
      var blob = scEncodeAudio(buf, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null });`, `      var audio = await scYtPlayer(videoId);
      if(!audio) return null;
      var dec = await scFetchDecode(audio);
      if(!dec) return null;
      var blob = scEncodeAudio(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null });`)) throw new Error('yt-format');

// ── 8. version + changelog
const edtDate = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'long', day: 'numeric', year: 'numeric' }).format(new Date());
const edtTime = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date());
const stamp = edtDate + ' \\u00b7 ' + edtTime + ' EDT';

if (!sub('version', `  const APP_VERSION = '60.0.9';`, `  const APP_VERSION = '60.0.10';`)) throw new Error('version');

if (!sub('changelog', `  const CHANGELOG = [
  { version: '60.0.9',`, `  const CHANGELOG = [
  { version: '60.0.10', date: '${stamp}', title: 'Conversions download again: YouTube only serves audio in small chunks now, and a multi-artist credit verifies', items: [
    'The converter works again. YouTube stopped serving an unbounded audio request \\u2014 a download with no Range header, an open-ended range, or one asking for more than 1 MiB now answers 403. The app asked for the whole file in a single request, so it came back empty and every track reported "no source found" no matter how right the match was. Streams are pulled as a run of bounded 1 MiB pieces and stitched back together, on the device, with no relay in the middle',
    'More than one source is tried. The player used to hand back a single URL from whichever client answered first, so a URL that had gone dead ended the whole conversion. It now collects the streams of the first two clients that respond and takes the first one that downloads and decodes \\u2014 a blocked, capped or unplayable stream is walked past instead of reported',
    'A truncated preview can never be saved as a song. YouTube can cut an unauthorised stream off at its first megabyte, which still decodes \\u2014 into a few seconds of audio. The download is now checked against the size the player reported, and an undersized grab is thrown away rather than written out as a broken track',
    'Multi-artist credits verify. A credit like "Sukha, Chani" or "Diljit Dosanjh & Sia" was required to appear word-for-word in the one uploader name, which no single channel can satisfy \\u2014 that is why an album by a co-credited artist searched, found its own official upload and then discarded it. Each credited artist is checked on its own, and the source still has to belong to one of them, so a cover by an unrelated channel is rejected exactly as before',
    'A failed row now says what failed instead of the same line every time: "no source found" (nothing matched the search), "no matching source" (sources were found but none belonged to the artist) or "download blocked" (the right source was found but its audio would not come down)',
    'Both converters share the fix: Spotify links and the YouTube to MP3 box use the same download and decode path, so both come back at once',
  ]},
  { version: '60.0.9',`)) throw new Error('changelog');

fs.writeFileSync(FILE, src);
const swFile = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(swFile, 'utf8');
if (!/sidecut-shell-v60\.0\.9/.test(sw)) throw new Error('sw cache name not found');
sw = sw.replace('sidecut-shell-v60.0.9', 'sidecut-shell-v60.0.10');
fs.writeFileSync(swFile, sw);

for (const r of report) console.log((r.ok ? '\u2713' : '\u2717') + ' ' + r.label + (r.ok ? '' : ' (found ' + r.found + ')'));
console.log('\nindex.html ' + origLen + ' -> ' + src.length + ' bytes');
console.log('APP_VERSION 60.0.10 | sw ' + sw.match(/sidecut-shell-v[\d.]+/)[0] + ' | stamp ' + stamp);
