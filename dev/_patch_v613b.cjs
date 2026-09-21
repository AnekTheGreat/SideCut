#!/usr/bin/env node
// v60.1.3, part B — the download is lossless.
//
// FLAC is now what a conversion gives you unless you ask for something else: it
// is the first option in every converter's format picker and the one that is
// selected, WAV (also lossless) is next, MP3 last for when space matters.
//
// That makes the FLAC encoder the default path, and it used to run the whole
// track in one synchronous pass (five prediction orders scored per 4096-sample
// block — seconds of work for a full song), which locks the app up. It is
// cooperative now: it hands the main thread back every ~24 frames and reports
// progress, exactly like the MP3 and WAV encoders.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');

let html = fs.readFileSync(HTML, 'utf8');

function sub(name, from, to, expected) {
  const want = expected === undefined ? 1 : expected;
  const found = html.split(from).length - 1;
  if (found !== want) throw new Error(`${name}: expected ${want}, found ${found}`);
  console.log('  ✓ ' + name);
  html = html.split(from).join(to);
}

/* ── 1. every format picker opens on lossless ───────────────────────────── */
const FMT_OPTIONS = '<option value="flac" selected>FLAC (lossless)</option><option value="wav">WAV (lossless)</option><option value="mp3">MP3 (smaller)</option>';
const OLD_OPTIONS = '<option value="mp3" selected>MP3</option><option value="wav">WAV</option><option value="flac">FLAC</option>';
['spFmtDisc', 'ytFmtDisc', 'spFmtSettings', 'ytFmtSettings'].forEach(function(id){
  sub('default FLAC: ' + id,
    ' id="' + id + '" style="padding:8px; border-radius:8px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:12px; cursor:pointer;" title="Output format">' + OLD_OPTIONS,
    ' id="' + id + '" style="padding:8px; border-radius:8px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:12px; cursor:pointer;" title="Output format">' + FMT_OPTIONS);
});

sub('default FLAC: the batch picker',
  `'<select class="sp-batch-fmt" style="padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:11.5px; cursor:pointer;"><option value="mp3"' + (presetFmt === 'mp3' ? ' selected' : '') + '>MP3</option><option value="wav"' + (presetFmt === 'wav' ? ' selected' : '') + '>WAV</option><option value="flac"' + (presetFmt === 'flac' ? ' selected' : '') + '>FLAC</option></select>' +`,
  `'<select class="sp-batch-fmt" style="padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:11.5px; cursor:pointer;"><option value="flac"' + (presetFmt === 'flac' ? ' selected' : '') + '>FLAC (lossless)</option><option value="wav"' + (presetFmt === 'wav' ? ' selected' : '') + '>WAV (lossless)</option><option value="mp3"' + (presetFmt === 'mp3' ? ' selected' : '') + '>MP3 (smaller)</option></select>' +`);

sub('default FLAC: the on-device picker leads with it',
  `          '<button onclick="window.__csSpPick(\\'mp3\\')" style="padding:5px 12px; border-radius:6px; background:var(--coral); color:#fff; border:none; font-size:11px; font-weight:600; cursor:pointer;">MP3</button>' +
          '<button onclick="window.__csSpPick(\\'wav\\')" style="padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer;">WAV</button>' +
          '<button onclick="window.__csSpPick(\\'flac\\')" style="padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer;">FLAC</button>' +`,
  `          '<button onclick="window.__csSpPick(\\'flac\\')" style="padding:5px 12px; border-radius:6px; background:var(--coral); color:#fff; border:none; font-size:11px; font-weight:600; cursor:pointer;">FLAC (lossless)</button>' +
          '<button onclick="window.__csSpPick(\\'wav\\')" style="padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer;">WAV (lossless)</button>' +
          '<button onclick="window.__csSpPick(\\'mp3\\')" style="padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer;">MP3 (smaller)</button>' +`);

sub('default FLAC: the picker tips',
  `'<div style="font-size:10px;color:var(--ink-dim);margin-top:2px;">Tip: MP3 is small &amp; universal; WAV/FLAC are lossless but much larger.</div>' +`,
  `'<div style="font-size:10px;color:var(--ink-dim);margin-top:2px;">Lossless by default: FLAC keeps every bit of the audio in a fraction of a WAV\\u2019s size. MP3 is the small one \\u2014 pick it if space matters more.</div>' +`, 2);

sub('default FLAC: the YouTube converter fallback order',
  `      var wantFmts = (presetFmt && presetFmt !== 'auto') ? [presetFmt] : ['mp3', 'wav', 'flac'];`,
  `      var wantFmts = (presetFmt && presetFmt !== 'auto') ? [presetFmt] : ['flac', 'wav', 'mp3'];`);

sub('default FLAC: Save song fallback',
  `    var fmt = 'mp3';
    try{
      try{ var _sel = document.getElementById('spFmtDisc'); if(_sel && _sel.value) fmt = _sel.value; }catch(_e){}`,
  `    var fmt = 'flac';   // lossless unless the converter's format picker says otherwise
    try{
      try{ var _sel = document.getElementById('spFmtDisc'); if(_sel && _sel.value) fmt = _sel.value; }catch(_e){}`);

/* ── 2. the FLAC encoder becomes cooperative ────────────────────────────── */
sub('FLAC encoder is async',
  `function encodeAudioBufferToFlac(audioBuffer, meta){`,
  `// Lossless FLAC. Asynchronous: the block loop hands the main thread back every
// ~24 frames (about two seconds of audio) and reports progress through onSlice,
// because a full song is several seconds of pure-JS work and the app has to stay
// usable while a conversion runs. Returns null if the encode fails, exactly like
// the other encoders.
async function encodeAudioBufferToFlac(audioBuffer, meta, onSlice){`);

sub('FLAC encoder yields during the sample conversion',
  `      var i16 = new Int16Array(length);
      for(var i=0;i<length;i++){
        var sv = src[i];`,
  `      var i16 = new Int16Array(length);
      for(var i=0;i<length;i++){
        if(i && (i % 200000) === 0) await scYieldToUI();
        var sv = src[i];`);

sub('FLAC encoder yields between blocks + reports progress',
  `    var frames = [], minFr = Infinity, maxFr = 0;
    for(var b=0;b<numBlocks;b++){
      var fr = buildFrame(b, b*blockSize);`,
  `    var frames = [], minFr = Infinity, maxFr = 0;
    for(var b=0;b<numBlocks;b++){
      if(b && (b % 24) === 0) await scYieldToUI();
      if(onSlice && (b % 8) === 0) onSlice(b / numBlocks);
      var fr = buildFrame(b, b*blockSize);`);

/* ── 3. the cooperative wrapper drives it ───────────────────────────────── */
sub('scEncodeAudioCooperative routes FLAC through the cooperative encoder',
  `      if(fmt === 'mp3') return await scEncodeMp3Cooperative(buf, meta, onSlice);
      if(fmt === 'wav') return await scEncodeWavCooperative(buf, meta, onSlice);
      return scEncodeAudio(buf, fmt, meta);`,
  `      if(fmt === 'mp3') return await scEncodeMp3Cooperative(buf, meta, onSlice);
      if(fmt === 'wav') return await scEncodeWavCooperative(buf, meta, onSlice);
      if(fmt === 'flac'){
        try{ return await encodeAudioBufferToFlac(buf, meta, onSlice); }
        catch(_flacErr){ console.warn('FLAC encode failed', _flacErr); return null; }
      }
      return scEncodeAudio(buf, fmt, meta);`);

/* ── 4. the two FLAC call sites that are not the wrapper ────────────────── */
sub('YouTube converter awaits the (async) FLAC encode',
  `      var blob = scEncodeAudio(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null });
      if(!blob) return null;`,
  `      // scEncodeAudio returns a Blob for MP3/WAV and a promise for FLAC, so it is
      // awaited here — a promise handed to URL.createObjectURL() is the kind of
      // thing that fails silently.
      var blob = null;
      try{ blob = await scEncodeAudio(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null }); }
      catch(_encErr){ blob = null; }
      if(!blob) return null;`);

sub('MP4 converter awaits the (async) FLAC encode',
  `      audioCtx.decodeAudioData(arrayBuffer).then(function(audioBuffer){`,
  `      audioCtx.decodeAudioData(arrayBuffer).then(async function(audioBuffer){`);

sub('MP4 converter FLAC branch awaits',
  `          try{ fBlob = encodeAudioBufferToFlac(audioBuffer); }catch(ferr){ fBlob = null; }`,
  `          try{ fBlob = await encodeAudioBufferToFlac(audioBuffer); }catch(ferr){ fBlob = null; }`);

/* ── 5. the notes on the converter panels ──────────────────────────────── */
sub('Discover converter note mentions the lossless default',
  `<b>Note:</b> WAV/FLAC are lossless (higher quality) but take up far more storage than MP3 — roughly 5–10× the size. MP3 is plenty for most listening.</div>`,
  `<b>Lossless by default:</b> output is FLAC (every bit of the audio, about a fifth of a WAV\\u2019s size). Pick MP3 if you would rather have small files.</div>`);

fs.writeFileSync(HTML, html);
console.log('\nlossless downloads: done\n');
