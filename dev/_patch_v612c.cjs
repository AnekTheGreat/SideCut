#!/usr/bin/env node
// One-off patch for v60.1.2, part 3 — the batch run:
//   • pick which songs to convert (all ticked by default)
//   • everything converted lands in the library; saving files or a ZIP is opt-in
//   • the run reports into a pill that follows you around the app
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

console.log('\n— the pick list and the output choice —');
sub('the output select offers the library first',
  `'<select class="sp-batch-mode" style="padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:11.5px; cursor:pointer;"><option value="individual">Individual songs (one file each)</option><option value="zip">One ZIP with every song</option></select>' +`,
  `'<select class="sp-batch-mode" style="padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:11.5px; cursor:pointer;"><option value="library">Just my library</option><option value="files">Library + save files</option><option value="zip">Library + one ZIP</option></select>' +`);

sub('the pick list is rendered under the controls',
  `              '<button class="sp-batch-go" style="padding:6px 14px; border-radius:6px; background:var(--coral); color:#fff; border:none; font-size:11px; font-weight:600; cursor:pointer;">Convert ' + plan.tracks.length + ' songs</button>' +\n` +
  `            '</div>';\n`,
  `              '<button class="sp-batch-go" style="padding:6px 14px; border-radius:6px; background:var(--coral); color:#fff; border:none; font-size:11px; font-weight:600; cursor:pointer;">Convert ' + plan.tracks.length + ' songs</button>' +\n` +
  `            '</div>' +\n` +
  `            // Every song is ticked to begin with, so a whole album is one tap;\n` +
  `            // untick what you do not want and the count follows.\n` +
  `            '<div class="sp-pick" style="margin-top:8px; border-top:1px solid var(--line); padding-top:8px;">' +\n` +
  `              '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">' +\n` +
  `                '<span style="font-size:10.5px; color:var(--ink-dim); flex:1;">Pick the songs to convert</span>' +\n` +
  `                '<button class="sp-pick-all" style="padding:3px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:10.5px; cursor:pointer;">All</button>' +\n` +
  `                '<button class="sp-pick-none" style="padding:3px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:10.5px; cursor:pointer;">None</button>' +\n` +
  `              '</div>' +\n` +
  `              '<div class="sp-pick-list" style="max-height:190px; overflow-y:auto; display:flex; flex-direction:column;"></div>' +\n` +
  `            '</div>' +\n` +
  `            '<div style="font-size:9.5px; color:var(--ink-dim); margin-top:6px; line-height:1.5;">Converted songs go straight into your library, in All songs — nothing to import.</div>';\n`);

sub('the pick list is wired and the run takes the selection',
  `          resultEl.innerHTML = '';\n` +
  `          resultEl.appendChild(pickEl);\n` +
  `          var goBtn = pickEl.querySelector('.sp-batch-go');\n` +
  `          if(goBtn){\n` +
  `            goBtn.addEventListener('click', function(){\n` +
  `              var fmtSel = pickEl.querySelector('.sp-batch-fmt');\n` +
  `              var modeSel = pickEl.querySelector('.sp-batch-mode');\n` +
  `              var fmt = (fmtSel && fmtSel.value) || 'mp3';\n` +
  `              var mode = (modeSel && modeSel.value) || 'individual';\n` +
  `              if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }\n` +
  `              scRunBatchConvert(plan, fmt, mode, resultEl, btnEl, url);\n` +
  `            });\n` +
  `          }\n`,
  `          resultEl.innerHTML = '';\n` +
  `          resultEl.appendChild(pickEl);\n` +
  `          var pickList = pickEl.querySelector('.sp-pick-list');\n` +
  `          function pickedIdx(){\n` +
  `            return Array.prototype.slice.call(pickList.querySelectorAll('.sp-pick-cb'))\n` +
  `              .filter(function(cb){ return cb.checked; })\n` +
  `              .map(function(cb){ return Number(cb.getAttribute('data-idx')); });\n` +
  `          }\n` +
  `          function refreshPickCount(){\n` +
  `            var n = pickedIdx().length;\n` +
  `            var gb = pickEl.querySelector('.sp-batch-go');\n` +
  `            if(gb){\n` +
  `              gb.textContent = n ? ('Convert ' + n + ' song' + (n === 1 ? '' : 's')) : 'Pick a song first';\n` +
  `              gb.style.opacity = n ? '1' : '0.55';\n` +
  `            }\n` +
  `          }\n` +
  `          if(pickList){\n` +
  `            pickList.innerHTML = plan.tracks.map(function(tr, ti){\n` +
  `              return '<label style="display:flex; gap:8px; align-items:center; padding:3px 0; font-size:11px; color:var(--ink); cursor:pointer;">' +\n` +
  `                '<input type="checkbox" class="sp-pick-cb" data-idx="' + ti + '" checked style="flex-shrink:0; accent-color:var(--coral);">' +\n` +
  `                '<span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(tr.title || 'Untitled') + '</span>' +\n` +
  `                '<span style="color:var(--ink-dim); font-size:10px; max-width:42%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(tr.artist || '') + '</span>' +\n` +
  `              '</label>';\n` +
  `            }).join('');\n` +
  `            Array.prototype.forEach.call(pickList.querySelectorAll('.sp-pick-cb'), function(cb){ cb.addEventListener('change', refreshPickCount); });\n` +
  `            var allBtn = pickEl.querySelector('.sp-pick-all');\n` +
  `            if(allBtn) allBtn.addEventListener('click', function(){ Array.prototype.forEach.call(pickList.querySelectorAll('.sp-pick-cb'), function(cb){ cb.checked = true; }); refreshPickCount(); });\n` +
  `            var noneBtn = pickEl.querySelector('.sp-pick-none');\n` +
  `            if(noneBtn) noneBtn.addEventListener('click', function(){ Array.prototype.forEach.call(pickList.querySelectorAll('.sp-pick-cb'), function(cb){ cb.checked = false; }); refreshPickCount(); });\n` +
  `          }\n` +
  `          refreshPickCount();\n` +
  `          var goBtn = pickEl.querySelector('.sp-batch-go');\n` +
  `          if(goBtn){\n` +
  `            goBtn.addEventListener('click', function(){\n` +
  `              var fmtSel = pickEl.querySelector('.sp-batch-fmt');\n` +
  `              var modeSel = pickEl.querySelector('.sp-batch-mode');\n` +
  `              var fmt = (fmtSel && fmtSel.value) || 'mp3';\n` +
  `              var mode = (modeSel && modeSel.value) || 'library';\n` +
  `              var idx = pickedIdx();\n` +
  `              if(!idx.length){ toast('Pick at least one song to convert.', 2500); return; }\n` +
  `              var chosen = idx.map(function(ix){ return plan.tracks[ix]; }).filter(Boolean);\n` +
  `              if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }\n` +
  `              scRunBatchConvert(plan, fmt, mode, resultEl, btnEl, url, chosen);\n` +
  `            });\n` +
  `          }\n`);

console.log('\n— the batch run itself —');
sub('the run takes the chosen songs and adds to the library',
  `  // Batch UI: renders progress into resultEl, converts every track, and saves\n` +
  `  // each finished file automatically. A Convert click while one is running is\n` +
  `  // ignored instead of clobbering the run (the button is re-enabled at the end).\n` +
  `  async function scRunBatchConvert(plan, fmt, saveMode, resultEl, btnEl, originalUrl){\n` +
  `    var tracks = (plan && plan.tracks) || [];\n` +
  `    if(!tracks.length) return false;\n` +
  `    if(saveMode === 'zip' && typeof JSZip === 'undefined'){ toast('ZIP builder not loaded — saving songs individually instead.', 3000); saveMode = 'individual'; }\n` +
  `    var zip = saveMode === 'zip' ? new JSZip() : null;\n`,
  `  // Batch UI: renders progress into resultEl, converts the songs the user\n` +
  `  // picked, and puts every finished track into the library (saving files or a\n` +
  `  // ZIP is opt-in on top of that). A Convert click while one is running is\n` +
  `  // ignored instead of clobbering the run (the button is re-enabled at the end).\n` +
  `  // The run is not tied to the window it was started from: it keeps going if\n` +
  `  // that window is closed, reporting into the floating progress pill.\n` +
  `  async function scRunBatchConvert(plan, fmt, saveMode, resultEl, btnEl, originalUrl, chosenTracks){\n` +
  `    var tracks = (chosenTracks && chosenTracks.length) ? chosenTracks.slice() : ((plan && plan.tracks) || []);\n` +
  `    if(!tracks.length) return false;\n` +
  `    var alsoSaveFiles = (saveMode === 'files');\n` +
  `    var wantZip = (saveMode === 'zip');\n` +
  `    if(wantZip && typeof JSZip === 'undefined'){ toast('ZIP builder not loaded — the songs still go to your library.', 3000); wantZip = false; }\n` +
  `    var zip = wantZip ? new JSZip() : null;\n`);

sub('the box says the run survives closing it',
  `      '<div class="sp-batch-list" style="margin-top:8px; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>' +\n`,
  `      '<div class="sp-batch-list" style="margin-top:8px; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>' +\n` +
  `      '<div style="font-size:10px; color:var(--ink-dim); margin-top:6px;">Converting in the background — close this window if you like, the run carries on and the progress stays on screen.</div>' +\n`);

sub('the start line reports into the pill',
  `    resultEl.style.display = 'block';\n` +
  `    resultEl.innerHTML = '';\n` +
  `    resultEl.appendChild(box);\n`,
  `    resultEl.style.display = 'block';\n` +
  `    resultEl.innerHTML = '';\n` +
  `    resultEl.appendChild(box);\n` +
  `    scConvertPillUpdate('Converting ' + tracks.length + ' song' + (tracks.length === 1 ? '' : 's') + ' · ' + (plan.title || 'conversion'),\n` +
  `      'Starting · everything lands in your library', 1);\n`);

sub('each finished song goes into the library',
  `      if(out && out.ok){\n` +
  `        if(saveMode === 'zip'){\n` +
  `          try{ zip.file(out.fName, out.blob); okCount++; if(stateEl){ stateEl.textContent = '✓ in ZIP'; stateEl.style.color = 'var(--coral)'; } }\n` +
  `          catch(_ze){ failCount++; failedNames.push((meta.title || 'Untitled') + ' (zip add failed)'); if(stateEl){ stateEl.textContent = '✗ zip add failed'; stateEl.style.color = '#f87171'; } }\n` +
  `        } else {\n` +
  `          var savedOk = false;\n` +
  `          try{ savedOk = await scNativeSaveBlob(out.blob, out.fName); }catch(_se){}\n` +
  `          if(!savedOk) scDownloadBlob(out.blob, out.fName);\n` +
  `          okCount++;\n` +
  `          if(stateEl){ stateEl.textContent = '✓ saved'; stateEl.style.color = 'var(--coral)'; }\n` +
  `        }\n` +
  `      } else {\n`,
  `      if(out && out.ok){\n` +
  `        // The library entry is the point of the run: no share sheet, no\n` +
  `        // download, no import. Everything below is an optional extra.\n` +
  `        var addedTrack = scAddConvertedToLibrary(out.blob, {\n` +
  `          title: meta.title || 'Untitled',\n` +
  `          artist: meta.artist || '',\n` +
  `          album: meta.album || plan.album || '',\n` +
  `          genre: meta.genre || '',\n` +
  `          artBytes: out.artBytes, artMime: out.artMime\n` +
  `        }, { fileName: out.fName, fmt: fmt, source: plan.title || 'conversion' });\n` +
  `        var extra = '';\n` +
  `        if(wantZip){\n` +
  `          try{ zip.file(out.fName, out.blob); extra = ' · in ZIP'; }\n` +
  `          catch(_ze){ extra = ' · ZIP skipped'; }\n` +
  `        } else if(alsoSaveFiles){\n` +
  `          try{\n` +
  `            var savedOk = false;\n` +
  `            try{ savedOk = await scNativeSaveBlob(out.blob, out.fName); }catch(_se){}\n` +
  `            if(!savedOk) scDownloadBlob(out.blob, out.fName);\n` +
  `            extra = ' · file saved';\n` +
  `          }catch(_se2){}\n` +
  `        }\n` +
  `        if(addedTrack){\n` +
  `          okCount++;\n` +
  `          if(stateEl){ stateEl.textContent = '✓ in library' + extra; stateEl.style.color = 'var(--coral)'; }\n` +
  `        } else {\n` +
  `          failCount++;\n` +
  `          failedNames.push((meta.title || 'Untitled') + ' (could not add to the library)');\n` +
  `          if(stateEl){ stateEl.textContent = '✗ could not add'; stateEl.style.color = '#f87171'; }\n` +
  `        }\n` +
  `      } else {\n`);

sub('progress and the pill move together',
  `      if(barEl) barEl.style.width = Math.round(((i + 1) / tracks.length) * 100) + '%';\n` +
  `      if(subEl) subEl.textContent = okCount + ' saved · ' + failCount + ' failed · ' + (tracks.length - i - 1) + ' left';\n`,
  `      var _pct = Math.round(((i + 1) / tracks.length) * 100);\n` +
  `      if(barEl) barEl.style.width = _pct + '%';\n` +
  `      if(subEl) subEl.textContent = okCount + ' in your library · ' + failCount + ' failed · ' + (tracks.length - i - 1) + ' left';\n` +
  `      scConvertPillUpdate('Converting ' + (i + 1) + '/' + tracks.length + ' · ' + (plan.title || 'conversion'),\n` +
  `        okCount + ' added to your library' + (failCount ? ' · ' + failCount + ' failed' : ''), _pct);\n`);

sub('the ZIP is built only when one was asked for',
  `    if(saveMode === 'zip' && zip && okCount > 0){\n`,
  `    if(wantZip && zip && okCount > 0){\n`);

sub('the finish line says what happened, and offers the library',
  `    } else {\n` +
  `      if(subEl) subEl.textContent = 'Done — ' + okCount + ' saved' + (failCount ? ' · ' + failCount + ' failed' : '');\n` +
  `    }\n` +
  `    if(actEl){\n` +
  `      actEl.style.display = 'flex';\n` +
  `      var retryHtml = '';\n` +
  `      if(failCount) retryHtml = '<button class="sp-batch-retry" style="padding:6px 12px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;">↻ Retry ' + failCount + ' failed</button>';\n` +
  `      actEl.innerHTML = retryHtml +\n` +
  `        '<button class="sp-batch-close" style="padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">Close</button>';\n`,
  `    } else {\n` +
  `      if(subEl) subEl.textContent = 'Done — ' + okCount + ' in your library' + (failCount ? ' · ' + failCount + ' failed' : '');\n` +
  `    }\n` +
  `    if(actEl){\n` +
  `      actEl.style.display = 'flex';\n` +
  `      var retryHtml = '';\n` +
  `      if(failCount) retryHtml = '<button class="sp-batch-retry" style="padding:6px 12px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;">↻ Retry ' + failCount + ' failed</button>';\n` +
  `      actEl.innerHTML = (okCount ? '<button class="sp-batch-open-lib" style="padding:6px 12px;border-radius:8px;border:none;background:var(--coral);color:#fff;font-size:11px;font-weight:600;cursor:pointer;">Open my library</button>' : '') + retryHtml +\n` +
  `        '<button class="sp-batch-close" style="padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">Close</button>';\n` +
  `      var libBtn = actEl.querySelector('.sp-batch-open-lib');\n` +
  `      if(libBtn) libBtn.addEventListener('click', function(){\n` +
  `        resultEl.innerHTML = ''; resultEl.style.display = 'none';\n` +
  `        try{ closeDiscoverPopup(); }catch(_cp){}\n` +
  `        try{ if(activePlaylist !== 'All Songs'){ activePlaylist = 'All Songs'; renderTabs(); } }catch(_ap){}\n` +
  `        navigate('library');\n` +
  `      });\n`);

sub('the closing toast talks about the library',
  `    toast(saveMode === 'zip'\n` +
  `      ? ('ZIP saved with ' + okCount + '/' + tracks.length + ' songs (' + fmt.toUpperCase() + ')' + (failCount ? ' — ' + failCount + ' failed (retry button below)' : ''))\n` +
  `      : ('Converted ' + okCount + '/' + tracks.length + ' songs to ' + fmt.toUpperCase() + (failCount ? ' — ' + failCount + ' failed (retry button below)' : '')), 5000);\n`,
  `    scConvertPillDone(okCount + ' song' + (okCount === 1 ? '' : 's') + ' added to your library'\n` +
  `      + (wantZip ? ' · ZIP saved' : (alsoSaveFiles ? ' · files saved' : ''))\n` +
  `      + (failCount ? ' · ' + failCount + ' failed' : ''));\n` +
  `    toast(okCount + '/' + tracks.length + ' songs are in your library (All songs)'\n` +
  `      + (wantZip ? ' · ZIP saved separately' : '')\n` +
  `      + (failCount ? ' — ' + failCount + ' failed (retry button below)' : ''), 5000);\n`);

fs.writeFileSync(HTML, html);
console.log('\nindex.html part 3 applied.\n');
