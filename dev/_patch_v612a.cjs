#!/usr/bin/env node
// One-off patch for v60.1.2, part 1 — the converter machinery:
//
//   • guessMeta no longer reads a leading track number as the artist, which is
//     why an imported "01 - Diljit Dosanjh - Dealer.mp3" showed up with the
//     artist "01" and the artist glued to the title.
//   • cooperative (slice-by-slice) MP3 and WAV encoders, so a conversion no
//     longer freezes the whole app for the length of the encode.
//   • scAddConvertedToLibrary: a finished conversion lands in the library
//     (All songs + Unsorted) on its own, with the metadata we already fetched.
//   • a small progress pill that keeps the run visible from any screen.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let html = fs.readFileSync(HTML, 'utf8');

function sub(name, from, to, times) {
  const want = times === undefined ? 1 : times;
  const found = html.split(from).length - 1;
  if (found !== want) throw new Error(`${name}: expected ${want}, found ${found}`);
  html = html.split(from).join(to);
  console.log('  ✓ ' + name);
}

console.log('\n— reading filenames —');
sub('guessMeta ignores a leading track number', [
  `  function guessMeta(filename){`,
  `    const base = filename.replace(/\\.[^/.]+$/, '');`,
  `    const parts = base.split(' - ');`,
  `    if(parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };`,
  `    return { artist: 'Unknown artist', title: base };`,
  `  }`
].join('\n') + '\n', [
  `  function guessMeta(filename){`,
  `    const base = filename.replace(/\\.[^/.]+$/, '');`,
  `    // A leading track number is a track number, never an artist. Conversions`,
  `    // are written as "01 - Artist - Title.mp3" (albums are numbered on`,
  `    // purpose), so this used to file the song under artist "01" with the real`,
  `    // artist stuck on the front of the title. Only a number that stands alone`,
  `    // before a separator is dropped — "3005 - Childish Gambino - ..." keeps`,
  `    // working exactly as before, because the artist then lands in slot two.`,
  `    const stripped = base.replace(/^\\s*(\\d{1,3})\\s*[-\\u2013\\u2014.]\\s+/, '').trim() || base;`,
  `    const parts = stripped.split(' - ');`,
  `    if(parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };`,
  `    return { artist: 'Unknown artist', title: stripped };`,
  `  }`
].join('\n') + '\n');

console.log('\n— encoders that hand the main thread back —');
sub('cooperative encoders + library add + progress pill', `  // Runs one track end-to-end through the single-track pipeline. Returns\n`, `  // ─── Conversions must not freeze the app ─────────────────────────────────────\n` +
`  // Every encoder in here used to be one synchronous loop over the whole track.\n` +
`  // A four-minute song is about ten million samples per channel, so an MP3 (and\n` +
`  // especially a FLAC) encode held the main thread for many seconds at a time —\n` +
`  // the app could not be touched, scrolled or navigated while a conversion ran.\n` +
`  // The conversion path now uses cooperative twins of those encoders: the same\n` +
`  // work, cut into slices that give the main thread back every few dozen ms.\n` +
`  function scYieldToUI(){\n` +
`    return new Promise(function(res){ setTimeout(res, 0); });\n` +
`  }\n` +
`  var SC_ENCODE_SLICE_MS = 55;   // work per slice before yielding\n` +
`  // ID3v2.3 tag in front of the encoded chunks — one copy, used by both paths.\n` +
`  function scJoinTaggedChunks(chunks, meta, mime){\n` +
`    var id3 = scId3v23Bytes(meta);\n` +
`    var total = 0, ci;\n` +
`    for(ci = 0; ci < chunks.length; ci++) total += chunks[ci].length;\n` +
`    if(id3 && id3.length){\n` +
`      var withTag = new Uint8Array(id3.length + total);\n` +
`      withTag.set(id3, 0);\n` +
`      var wpos = id3.length;\n` +
`      for(ci = 0; ci < chunks.length; ci++){ withTag.set(chunks[ci], wpos); wpos += chunks[ci].length; }\n` +
`      return new Blob([withTag], { type: mime });\n` +
`    }\n` +
`    return new Blob(chunks, { type: mime });\n` +
`  }\n` +
`  // MP3 (lamejs) — the block loop is ours, so the slice boundary sits between\n` +
`  // blocks. Same encoder, same blocks, same bytes out as scEncodeAudio.\n` +
`  async function scEncodeMp3Cooperative(buf, meta, onSlice){\n` +
`    if(typeof lamejs === 'undefined') return null;\n` +
`    var chCount = Math.max(1, Math.min(2, buf.numberOfChannels || 1));\n` +
`    var sr = Math.max(8000, Math.min(48000, Math.round(buf.sampleRate || 44100)));\n` +
`    var enc = new lamejs.Mp3Encoder(chCount, sr, 192);\n` +
`    var block = 1152;\n` +
`    var ch0 = buf.getChannelData(0);\n` +
`    var ch1 = chCount > 1 ? buf.getChannelData(1) : null;\n` +
`    var chunks = [];\n` +
`    function toI16(f){ var v = Math.max(-1, Math.min(1, f)); return Math.round(v < 0 ? v*0x8000 : v*0x7FFF); }\n` +
`    var sliceStart = Date.now();\n` +
`    for(var i = 0; i < ch0.length; i += block){\n` +
`      var l = new Int16Array(block);\n` +
`      var r = chCount > 1 ? new Int16Array(block) : null;\n` +
`      var n = Math.min(block, ch0.length - i);\n` +
`      for(var b = 0; b < n; b++){ l[b] = toI16(ch0[i+b]); if(chCount > 1) r[b] = toI16(ch1[i+b]); }\n` +
`      var out = chCount > 1 ? enc.encodeBuffer(l, r) : enc.encodeBuffer(l, l);\n` +
`      if(out && out.length) chunks.push(new Uint8Array(out));\n` +
`      if(Date.now() - sliceStart >= SC_ENCODE_SLICE_MS){\n` +
`        sliceStart = Date.now();\n` +
`        if(onSlice) onSlice(Math.min(1, (i + block) / ch0.length));\n` +
`        await scYieldToUI();\n` +
`      }\n` +
`    }\n` +
`    var endBuf = enc.flush();\n` +
`    if(endBuf && endBuf.length) chunks.push(new Uint8Array(endBuf));\n` +
`    return scJoinTaggedChunks(chunks, meta, 'audio/mpeg');\n` +
`  }\n` +
`  // WAV (PCM 16-bit + id3 chunk) — the same layout scEncodeAudio writes, filled\n` +
`  // in slices so a long track does not lock the screen.\n` +
`  async function scEncodeWavCooperative(buf, meta, onSlice){\n` +
`    var numChannels = Math.max(1, buf.numberOfChannels || 1);\n` +
`    var sampleRate = Math.round(buf.sampleRate || 44100);\n` +
`    var length = buf.length;\n` +
`    var blockAlign = numChannels * 2;\n` +
`    var dataSize = length * blockAlign;\n` +
`    var id3w = scId3v23Bytes(meta);\n` +
`    var id3Chunk = null;\n` +
`    if(id3w && id3w.length){\n` +
`      var id3len = id3w.length + (id3w.length % 2);\n` +
`      id3Chunk = new Uint8Array(8 + id3len);\n` +
`      id3Chunk[0] = 0x69; id3Chunk[1] = 0x64; id3Chunk[2] = 0x33; id3Chunk[3] = 0x20;\n` +
`      id3Chunk[4] = (id3w.length >>> 24) & 0xFF; id3Chunk[5] = (id3w.length >>> 16) & 0xFF;\n` +
`      id3Chunk[6] = (id3w.length >>> 8) & 0xFF; id3Chunk[7] = id3w.length & 0xFF;\n` +
`      id3Chunk.set(id3w, 8);\n` +
`    }\n` +
`    var headerSize = 44 + (id3Chunk ? id3Chunk.length : 0);\n` +
`    var totalSize = headerSize + dataSize;\n` +
`    var buffer = new ArrayBuffer(totalSize);\n` +
`    var view = new DataView(buffer);\n` +
`    function writeString(offset, str){ for(var i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i)); }\n` +
`    writeString(0, 'RIFF');\n` +
`    view.setUint32(4, totalSize - 8, true);\n` +
`    writeString(8, 'WAVE');\n` +
`    writeString(12, 'fmt ');\n` +
`    view.setUint32(16, 16, true);\n` +
`    view.setUint16(20, 1, true);\n` +
`    view.setUint16(22, numChannels, true);\n` +
`    view.setUint32(24, sampleRate, true);\n` +
`    view.setUint32(28, sampleRate * blockAlign, true);\n` +
`    view.setUint16(32, blockAlign, true);\n` +
`    view.setUint16(34, 16, true);\n` +
`    var woff = 36;\n` +
`    if(id3Chunk){\n` +
`      for(var ic = 0; ic < id3Chunk.length; ic++) view.setUint8(woff + ic, id3Chunk[ic]);\n` +
`      woff += id3Chunk.length;\n` +
`    }\n` +
`    writeString(woff, 'data');\n` +
`    view.setUint32(woff + 4, dataSize, true);\n` +
`    var channels = [];\n` +
`    for(var c = 0; c < numChannels; c++) channels.push(buf.getChannelData(c));\n` +
`    var offset = woff + 8;\n` +
`    var sliceStart = Date.now();\n` +
`    for(var i2 = 0; i2 < length; i2++){\n` +
`      for(var c2 = 0; c2 < numChannels; c2++){\n` +
`        var sample = Math.max(-1, Math.min(1, channels[c2][i2]));\n` +
`        sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;\n` +
`        view.setInt16(offset, sample, true);\n` +
`        offset += 2;\n` +
`      }\n` +
`      if((i2 & 4095) === 4095 && Date.now() - sliceStart >= SC_ENCODE_SLICE_MS){\n` +
`        sliceStart = Date.now();\n` +
`        if(onSlice) onSlice(i2 / length);\n` +
`        await scYieldToUI();\n` +
`      }\n` +
`    }\n` +
`    return new Blob([buffer], { type: 'audio/wav' });\n` +
`  }\n` +
`  // The one the converters call. FLAC keeps the original encoder: its bit\n` +
`  // writer has no natural slice boundary, and rewriting it is not worth the\n` +
`  // risk of changing the file it produces.\n` +
`  async function scEncodeAudioCooperative(buf, fmt, meta, onSlice){\n` +
`    try{\n` +
`      if(fmt === 'mp3') return await scEncodeMp3Cooperative(buf, meta, onSlice);\n` +
`      if(fmt === 'wav') return await scEncodeWavCooperative(buf, meta, onSlice);\n` +
`      return scEncodeAudio(buf, fmt, meta);\n` +
`    }catch(e){\n` +
`      console.warn('cooperative encode failed, falling back to the plain encoder', e);\n` +
`      return scEncodeAudio(buf, fmt, meta);\n` +
`    }\n` +
`  }\n` +
`\n` +
`  // ─── A finished conversion IS a library song ─────────────────────────────────\n` +
`  // No share sheet, no download, no "+ Add songs \\u2192 + Files": the track lands in\n` +
`  // All songs (and Unsorted) with the metadata the conversion already fetched,\n` +
`  // cover art included, and is written to IndexedDB like any imported file, so\n` +
`  // it is still there after a restart.\n` +
`  function scAddConvertedToLibrary(blob, meta, opts){\n` +
`    try{\n` +
`      var o = opts || {};\n` +
`      var title = String((meta && meta.title) || o.title || '').trim() || 'Untitled';\n` +
`      var artist = String((meta && meta.artist) || o.artist || '').trim() || 'Unknown artist';\n` +
`      var album = (meta && meta.album) || o.album || null;\n` +
`      var fmt = o.fmt || 'mp3';\n` +
`      var fName = o.fileName || (scSafeName(artist && artist !== 'Unknown artist' ? (artist + ' - ' + title) : title) + '.' + fmt);\n` +
`      var mime = fmt === 'flac' ? 'audio/flac' : (fmt === 'wav' ? 'audio/wav' : 'audio/mpeg');\n` +
`      var file = new File([blob], fName, { type: blob.type || mime });\n` +
`      var artBlob = null, artUrl = null;\n` +
`      if(meta && meta.artBytes && meta.artBytes.length){\n` +
`        try{\n` +
`          artBlob = new Blob([meta.artBytes], { type: meta.artMime || 'image/jpeg' });\n` +
`          artUrl = URL.createObjectURL(artBlob);\n` +
`        }catch(_ab){}\n` +
`      }\n` +
`      var id = 't' + (idCounter++);\n` +
`      var track = {\n` +
`        id: id, file: file, name: title, artist: artist, album: album,\n` +
`        url: URL.createObjectURL(file), duration: null,\n` +
`        genre: (meta && meta.genre) || null, gain: null,\n` +
`        artBlob: artBlob, artUrl: artUrl,\n` +
`        watermarkCleaned: false, dateAdded: Date.now(),\n` +
`        convertedFrom: o.source || 'converter'\n` +
`      };\n` +
`      allTracks.push(track);\n` +
`      if(!playlists['All Songs']) playlists['All Songs'] = [];\n` +
`      playlists['All Songs'].push(id);\n` +
`      if(!playlists['Unsorted']) playlists['Unsorted'] = [];\n` +
`      playlists['Unsorted'].push(id);\n` +
`      persistTrackMeta(track);\n` +
`      saveMeta();\n` +
`      readLazyMeta(track);   // fills in the real duration from the file itself\n` +
`      try{ renderTabs(); }catch(_rt){}\n` +
`      try{ renderList(); }catch(_rl){}\n` +
`      return track;\n` +
`    }catch(e){\n` +
`      console.warn('could not add the converted song to the library', e);\n` +
`      return null;\n` +
`    }\n` +
`  }\n` +
`\n` +
`  // ─── Progress pill: the run stays visible while you use the app ──────────────\n` +
`  var scConvertPillState = { el: null, timer: null };\n` +
`  function scConvertPill(show){\n` +
`    if(!show){\n` +
`      var gone = scConvertPillState.el;\n` +
`      if(gone && gone.parentNode) gone.parentNode.removeChild(gone);\n` +
`      scConvertPillState.el = null;\n` +
`      return;\n` +
`    }\n` +
`    if(scConvertPillState.el) return scConvertPillState.el;\n` +
`    var pill = document.createElement('div');\n` +
`    pill.id = 'scConvertPill';\n` +
`    pill.style.cssText = 'position:fixed;left:12px;right:12px;bottom:calc(84px + env(safe-area-inset-bottom));z-index:180;background:var(--bg-raised);border:1px solid var(--line);border-radius:14px;padding:10px 12px;box-shadow:0 6px 24px rgba(0,0,0,0.45);display:flex;gap:10px;align-items:center;';\n` +
`    pill.innerHTML = '<div style="width:14px;height:14px;border:2px solid var(--coral);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +\n` +
`      '<div style="flex:1;min-width:0;">' +\n` +
`        '<div class="sc-pill-title" style="font-size:12px;font-weight:600;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Converting…</div>' +\n` +
`        '<div class="sc-pill-sub" style="font-size:10.5px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">Starting…</div>' +\n` +
`        '<div style="height:4px;border-radius:3px;background:rgba(255,255,255,0.08);overflow:hidden;margin-top:5px;"><div class="sc-pill-bar" style="height:100%;width:0%;background:var(--coral);transition:width 0.3s ease;"></div></div>' +\n` +
`      '</div>';\n` +
`    document.body.appendChild(pill);\n` +
`    scConvertPillState.el = pill;\n` +
`    return pill;\n` +
`  }\n` +
`  function scConvertPillUpdate(title, sub, pct){\n` +
`    var pill = scConvertPill(true);\n` +
`    if(!pill) return;\n` +
`    var t = pill.querySelector('.sc-pill-title'), s = pill.querySelector('.sc-pill-sub'), b = pill.querySelector('.sc-pill-bar');\n` +
`    if(t) t.textContent = title || 'Converting…';\n` +
`    if(s) s.textContent = sub || '';\n` +
`    if(b) b.style.width = Math.max(0, Math.min(100, pct || 0)) + '%';\n` +
`  }\n` +
`  function scConvertPillDone(text){\n` +
`    var pill = scConvertPillState.el;\n` +
`    if(!pill){ toast(text || 'Conversions finished.', 5000); return; }\n` +
`    var spin = pill.querySelector('div');\n` +
`    if(spin) spin.outerHTML = '<div style="font-size:16px;flex-shrink:0;">✅</div>';\n` +
`    var t = pill.querySelector('.sc-pill-title');\n` +
`    if(t) t.textContent = text || 'Conversions finished';\n` +
`    var s = pill.querySelector('.sc-pill-sub');\n` +
`    if(s) s.textContent = 'Tap the bell or open your library to see them';\n` +
`    var b = pill.querySelector('.sc-pill-bar');\n` +
`    if(b) b.style.width = '100%';\n` +
`    if(scConvertPillState.timer) clearTimeout(scConvertPillState.timer);\n` +
`    scConvertPillState.timer = setTimeout(function(){ scConvertPill(false); }, 9000);\n` +
`  }\n` +
`\n` +
`  // Runs one track end-to-end through the single-track pipeline. Returns\n`, 1);

console.log('\nindex.html part 1 applied.\n');
fs.writeFileSync(HTML, html);
