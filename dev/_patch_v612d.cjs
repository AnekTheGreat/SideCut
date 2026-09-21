#!/usr/bin/env node
// One-off patch for v60.1.2, part 4 — the single-song converters:
// a converted song is a library song, not a file to download and import.
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

console.log('\n— Spotify single, format picked from the list —');
sub('it encodes cooperatively',
  `      var blob = scEncodeAudio(buf, fmt, tagMeta);\n` +
  `      if(!blob){ resultEl.innerHTML = '<span style="color:var(--coral);">⚠ Could not encode to ' + fmt.toUpperCase() + ' in this browser. Try another format.</span>'; return; }\n`,
  `      var blob = await scEncodeAudioCooperative(buf, fmt, tagMeta, function(p){\n` +
  `        if(stEl && p > 0 && p < 1) stEl.textContent = 'Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%';\n` +
  `      });\n` +
  `      if(!blob){ resultEl.innerHTML = '<span style="color:var(--coral);">⚠ Could not encode to ' + fmt.toUpperCase() + ' in this browser. Try another format.</span>'; return; }\n`);

sub('it lands in the library, and saving the file becomes the extra step',
  `      var fUrl = URL.createObjectURL(blob);\n` +
  `      var fMB = (blob.size / (1024*1024)).toFixed(1);\n` +
  `      var fDur = buf.duration, fMi = Math.floor(fDur/60), fSe = Math.floor(fDur%60);\n`,
  `      var fUrl = URL.createObjectURL(blob);\n` +
  `      var fMB = (blob.size / (1024*1024)).toFixed(1);\n` +
  `      var fDur = buf.duration, fMi = Math.floor(fDur/60), fSe = Math.floor(fDur%60);\n` +
  `      // This is a finished song now — it goes into the library itself, with the\n` +
  `      // metadata and cover that were just fetched and embedded.\n` +
  `      var addedSingle = scAddConvertedToLibrary(blob, {\n` +
  `        title: meta.title || 'Spotify audio', artist: meta.artist || '', album: meta.album || '',\n` +
  `        genre: meta.genre || '', artBytes: artBytes, artMime: artBytes ? artMime : null\n` +
  `      }, { fileName: fName, fmt: fmt, source: 'Spotify ' + fmt + ' conversion' });\n` +
  `      scConvertPillDone(addedSingle ? ((meta.title || 'The song') + ' is in your library') : 'Converted, but it could not be added to the library');\n`);

sub('the result card reports the library entry',
  `        '<div style="font-size:10px; color:var(--gold); margin:4px 0 6px;">✅ ' + fmt.toUpperCase() + ' ready!</div>' +\n` +
  `        '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +\n` +
  `          '<a href="' + fUrl + '" download="' + fName + '" style="display:inline-block;padding:6px 14px;border-radius:8px;background:var(--coral);color:#fff;font-size:12px;font-weight:600;text-decoration:none;">⬇ Download ' + fmt.toUpperCase() + '</a>' +\n` +
  `          '<button onclick="window.__importConvertedMp4(this.dataset.url, this.dataset.name)" data-url="' + fUrl + '" data-name="' + fName + '" style="padding:6px 14px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:12px;font-weight:600;cursor:pointer;">Import to Library</button>' +\n` +
  `          '<button onclick="window.__csSpFormats()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">↻ Other format</button>' +\n` +
  `        '</div>' +\n`,
  `        '<div style="font-size:10px; color:var(--gold); margin:4px 0 6px;">' + (addedSingle ? '✅ In your library (' + fmt.toUpperCase() + ')' : '⚠ ' + fmt.toUpperCase() + ' ready, but it could not be added to your library') + '</div>' +\n` +
  `        '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +\n` +
  `          '<a href="' + fUrl + '" download="' + fName + '" style="display:inline-block;padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink);font-size:12px;font-weight:600;text-decoration:none;">⬇ Save the file too</a>' +\n` +
  `          '<button onclick="window.__csSpFormats()" style="padding:6px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">↻ Other format</button>' +\n` +
  `        '</div>' +\n`);

console.log('\n— Spotify single, format preset —');
sub('it encodes cooperatively',
  `        var blob = scEncodeAudio(buf, fmt, tagMeta);\n` +
  `        if(!blob){ csRenderFormats(buf, streamUrl); return; }\n`,
  `        var blob = await scEncodeAudioCooperative(buf, fmt, tagMeta, function(p){\n` +
  `          if(p > 0 && p < 1) csSetStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%');\n` +
  `        });\n` +
  `        if(!blob){ csRenderFormats(buf, streamUrl); return; }\n`);

sub('the share sheet is gone: it goes to the library instead',
  `        var savedOk = false;\n` +
  `        try{ savedOk = await scNativeSaveBlob(blob, fName); }catch(_se){}\n` +
  `        var dlHref = URL.createObjectURL(blob);\n` +
  `        if(!savedOk) scDownloadBlob(blob, fName);\n` +
  `        var fUrl = dlHref;\n`,
  `        var addedSingle = scAddConvertedToLibrary(blob, {\n` +
  `          title: csMeta.title || 'Spotify audio', artist: csMeta.artist || '', album: csMeta.album || '',\n` +
  `          genre: csMeta.genre || '', artBytes: artBytes, artMime: artBytes ? artMime : null\n` +
  `        }, { fileName: fName, fmt: fmt, source: 'Spotify ' + fmt + ' conversion' });\n` +
  `        var dlHref = URL.createObjectURL(blob);\n` +
  `        var fUrl = dlHref;\n`);

sub('the result card reports the library entry',
  `            '<div style="font-size:10px; color:var(--gold); margin:4px 0 6px;">✅ ' + fmt.toUpperCase() + ' ready' + (savedOk ? ' — saved via share sheet' : '!') + '</div>' +\n` +
  `            '<a href="' + dlHref + '" download="' + fName + '" style="display:inline-block;padding:6px 14px;border-radius:8px;background:var(--coral);color:#fff;font-size:12px;font-weight:600;text-decoration:none;">⬇ Download ' + fmt.toUpperCase() + '</a> ' +\n` +
  `            '<button onclick="window.__importConvertedMp4(this.dataset.url, this.dataset.name)" data-url="' + fUrl + '" data-name="' + fName + '" style="padding:6px 14px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:12px;font-weight:600;cursor:pointer;">Import to Library</button> ' +\n`,
  `            '<div style="font-size:10px; color:var(--gold); margin:4px 0 6px;">' + (addedSingle ? '✅ In your library (' + fmt.toUpperCase() + ')' : '⚠ ' + fmt.toUpperCase() + ' ready, but it could not be added to your library') + '</div>' +\n` +
  `            '<a href="' + dlHref + '" download="' + fName + '" style="display:inline-block;padding:6px 14px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink);font-size:12px;font-weight:600;text-decoration:none;">⬇ Save the file too</a> ' +\n`);

sub('the toast says where it went',
  `        toast(fmt.toUpperCase() + ' ready' + (savedOk ? ' — check your share sheet' : '') + '!', 4000);\n`,
  `        scConvertPillDone(addedSingle ? ((csMeta.title || 'The song') + ' is in your library') : 'Converted, but it could not be added to the library');\n`);

console.log('\n— YouTube to MP3 —');
sub('the converted blob comes back with the result',
  `      return { downloadUrl: URL.createObjectURL(blob), filename: (scSafeName(title || ('youtube_' + videoId)) || ('youtube_' + videoId)) + '.' + fmt };\n`,
  `      return { downloadUrl: URL.createObjectURL(blob), filename: (scSafeName(title || ('youtube_' + videoId)) || ('youtube_' + videoId)) + '.' + fmt, blob: blob };\n`);

sub('the result card adds the song to the library',
  `    function renderDownload(fmt, downloadUrl, filename){\n` +
  `      var ext = fmt;\n` +
  `      var label = 'Download ' + ext.toUpperCase();\n` +
  `      if(resultEl){\n` +
  `        resultEl.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' +\n` +
  `          '<img src="https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg" style="width:80px; height:60px; border-radius:6px; object-fit:cover; flex-shrink:0;" onerror="this.style.display=none">' +\n` +
  `          '<div style="flex:1;"><div style="font-weight:600; color:var(--ink); margin-bottom:4px; font-size:12px;">' + title.replace(/</g,'&lt;') + '</div>' +\n` +
  `          '<div style="font-size:10px; color:var(--gold); margin-bottom:6px;">\\u2705 Ready to download (' + ext.toUpperCase() + ')</div>' +\n` +
  `          '<a href="' + downloadUrl + '" download="' + filename + '" target="_blank" rel="noopener" style="display:inline-block; padding:5px 12px; border-radius:6px; background:var(--coral); color:#fff; font-size:11px; font-weight:600; text-decoration:none; margin-right:6px;">\\u2b07 ' + label + '</a>' +\n` +
  `          '<button onclick="window.open(this.dataset.url,\\'_blank\\')" data-url="' + downloadUrl + '" style="padding:5px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; cursor:pointer;">Open in tab</button>' +\n` +
  `          '</div></div>';\n` +
  `      }\n` +
  `      toast(label + ' ready! Tap Download.', 5000);\n` +
  `    }\n`,
  `    function renderDownload(fmt, res){\n` +
  `      var ext = fmt;\n` +
  `      var downloadUrl = res.downloadUrl, filename = res.filename;\n` +
  `      // Straight into the library, with the title/artist cleaned the same way an\n` +
  `      // import is — no download-and-import step for a converted song.\n` +
  `      var _libClean = cleanOnImport(title || 'YouTube audio', ytAuthor || '');\n` +
  `      var addedYt = res.blob ? scAddConvertedToLibrary(res.blob, {\n` +
  `        title: _libClean.name, artist: _libClean.artist, album: '', genre: '',\n` +
  `        artBytes: null, artMime: null\n` +
  `      }, { fileName: filename, fmt: fmt, source: 'YouTube conversion' }) : null;\n` +
  `      scConvertPillDone(addedYt ? ((_libClean.name || 'The song') + ' is in your library') : 'Converted, but it could not be added to the library');\n` +
  `      if(resultEl){\n` +
  `        resultEl.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;">' +\n` +
  `          '<img src="https://img.youtube.com/vi/' + videoId + '/mqdefault.jpg" style="width:80px; height:60px; border-radius:6px; object-fit:cover; flex-shrink:0;" onerror="this.style.display=none">' +\n` +
  `          '<div style="flex:1;"><div style="font-weight:600; color:var(--ink); margin-bottom:4px; font-size:12px;">' + title.replace(/</g,'&lt;') + '</div>' +\n` +
  `          '<div style="font-size:10px; color:var(--gold); margin-bottom:6px;">' + (addedYt ? '\\u2705 In your library (' + ext.toUpperCase() + ')' : '\\u26a0 Ready to download (' + ext.toUpperCase() + ')') + '</div>' +\n` +
  `          '<a href="' + downloadUrl + '" download="' + filename + '" target="_blank" rel="noopener" style="display:inline-block; padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; text-decoration:none; margin-right:6px;">\\u2b07 Save the file too</a>' +\n` +
  `          '<button onclick="window.open(this.dataset.url,\\'_blank\\')" data-url="' + downloadUrl + '" style="padding:5px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:11px; cursor:pointer;">Open in tab</button>' +\n` +
  `          '</div></div>';\n` +
  `      }\n` +
  `      toast(addedYt ? ((_libClean.name || 'The song') + ' is in your library (All songs).') : (ext.toUpperCase() + ' ready! Tap Download.'), 5000);\n` +
  `    }\n`);

sub('the call site passes the whole result',
  `            if(res){ renderDownload(f, res.downloadUrl, res.filename); return true; }\n`,
  `            if(res){ renderDownload(f, res); return true; }\n`);

fs.writeFileSync(HTML, html);
console.log('\nindex.html part 4 applied.\n');
