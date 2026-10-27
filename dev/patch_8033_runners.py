"""80.3.3, sections 7 and 8 - the two batch runners.

The YouTube playlist runner and the Spotify album/playlist runner: every row goes up
first, scRunPool converts scDownloadLanes() songs at once, each song carries its own
context, and Cancel stops the run at the next song boundary.

Imported by dev/patch-8033.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 7. The YouTube playlist runner: rows up front, songs in flight
# ---------------------------------------------------------------------------
YT_OLD_START = """            for(var i = 0; i < chosen.length; i++){
              if(window.__scCancelDl) break;
              var tr = chosen[i];
"""
YT_OLD_END = """              if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 200); });
            }
"""

YT_NEW = r"""            // 80.3.3 - EVERY ROW GOES UP FIRST, and scDownloadLanes() songs are in
            // flight at once. A row is a place to report into, not a step in a queue, so
            // song 2 no longer waits for song 1's file to be finished - which is where an
            // album's hour went. Each song still lands in the library exactly as it did,
            // and Cancel still stops the run at the next song boundary.
            var rows = [], runDone = 0;
            for(var ri = 0; ri < chosen.length; ri++){
              var row = document.createElement('div');
              row.style.cssText = 'font-size:10.5px; color:var(--ink-dim); display:flex; gap:6px; align-items:baseline;';
              row.innerHTML = '<span style="color:var(--gold); white-space:nowrap;">' + (ri + 1) + '/' + chosen.length + '</span><span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(chosen[ri].title || 'Untitled') + '</span><span class="yt-row-state" style="white-space:nowrap;">\u2026</span>';
              rowsEl.appendChild(row);
              rows.push({ state: row.querySelector('.yt-row-state'), done: false, started: false });
            }
            function scYtShowProgress(){
              if(barEl) barEl.style.width = Math.round((runDone / chosen.length) * 100) + '%';
              if(subEl) subEl.textContent = runDone + ' of ' + chosen.length + ' finished';
            }
            scYtShowProgress();
            scRunJobStart(pl.title || 'YouTube playlist', 'Converting ' + chosen.length + ' song' + (chosen.length === 1 ? '' : 's'));
            await scRunPool(chosen, scDownloadLanes(), async function(tr, i){
              var slot = rows[i];
              if(!slot || window.__scCancelDl) return;
              slot.started = true;
              var state = function(txt){ if(slot.state) slot.state.textContent = txt; };
              state('starting');
              scConvertPillUpdate('Converting ' + chosen.length + ' song' + (chosen.length === 1 ? '' : 's') + ' \u00b7 ' + (pl.title || 'YouTube playlist'),
                runDone + ' of ' + chosen.length + ' finished \u2014 ' + (tr.title || 'starting'), Math.round((runDone / chosen.length) * 100));
              var res = null;
              try{ res = await scYtOneVideo(tr.videoId, fmt, tr.title, tr.author, function(txt){ state(txt); if(subEl) subEl.textContent = runDone + ' of ' + chosen.length + ' finished \u2014 ' + txt; }); }catch(_re){ res = null; }
              if(res && res.blob){
                var m = res.meta || {};
                var clean = cleanOnImport(m.title || tr.title || 'YouTube audio', m.artist || tr.author || '');
                var artistPart = scSafeName(clean.artist || '');
                var namePart = scSafeName(clean.name || 'YouTube audio');
                var al = String(artistPart).toLowerCase();
                var artistOk = artistPart && al !== 'unknown artist';
                var fname = scSafeName((artistOk ? artistPart + ' - ' : '') + namePart) + '.' + fmt;
                scAddConvertedToLibrary(res.blob, { title: clean.name, artist: clean.artist, album: m.album || '', genre: m.genre || '', artBytes: m.artBytes, artMime: m.artMime }, { fileName: fname, fmt: fmt, source: 'YouTube playlist conversion' });
                okCount++;
                slot.done = true;
                state('\u2705 added');
                if(slot.state) slot.state.style.color = 'var(--gold)';
              } else if(window.__scCancelDl){
                state('\u2014 cancelled');
              } else {
                failed++; failedNames.push(tr.title || 'a song');
                state('\u26a0 could not be made');
              }
              runDone++;
              scYtShowProgress();
              scConvertPillUpdate('Converting ' + chosen.length + ' song' + (chosen.length === 1 ? '' : 's') + ' \u00b7 ' + (pl.title || 'YouTube playlist'),
                runDone + ' of ' + chosen.length + ' finished \u00b7 ' + okCount + ' added' + (failed ? ' \u00b7 ' + failed + ' failed' : ''),
                Math.round((runDone / chosen.length) * 100));
              scRunJobNote(runDone + ' of ' + chosen.length + ' finished', (runDone / chosen.length) * 100);
            });
            // A song the run never reached, or one that stopped mid-flight, reads as
            // cancelled rather than sitting on an ellipsis for ever.
            for(var ci = 0; ci < rows.length; ci++){
              if(!rows[ci].done && rows[ci].state && /^\u2026$/.test(String(rows[ci].state.textContent || '').trim())) rows[ci].state.textContent = '\u2014 cancelled';
            }
            scRunJobEnd();
"""

# ---------------------------------------------------------------------------
# 8. The Spotify album/playlist runner: the same shape, per-song context
# ---------------------------------------------------------------------------
SP_OLD_START = """    for(var i = 0; i < tracks.length; i++){
      var meta = Object.assign({}, tracks[i]);
"""
SP_OLD_END = """      if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 200); });
    }
"""

SP_NEW = r"""    // 80.3.3 - the same pool the YouTube playlist runner uses: every row up front,
    // scDownloadLanes() songs in flight, each song still landing in the library exactly
    // as it did. The claim ledger is shared (that is its whole point) while the failure
    // reason is this song's own - three songs cannot share one window slot.
    var rows = [], runDone = 0;
    for(var ri = 0; ri < tracks.length; ri++){
      var row = document.createElement('div');
      row.style.cssText = 'font-size:10.5px; color:var(--ink-dim); display:flex; gap:6px; align-items:baseline;';
      row.innerHTML = '<span style="color:var(--gold); white-space:nowrap;">' + (ri + 1) + '/' + tracks.length + '</span><span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(tracks[ri].title || 'Untitled') + '</span><span class="sp-row-state" style="white-space:nowrap;">\u2026</span>';
      listEl.appendChild(row);
      rows.push({ state: row.querySelector('.sp-row-state'), done: false, started: false });
    }
    function scSpShowProgress(){
      var _pct = Math.round((runDone / tracks.length) * 100);
      if(barEl) barEl.style.width = _pct + '%';
      if(subEl) subEl.textContent = okCount + ' in your library \u00b7 ' + failCount + ' failed \u00b7 ' + (tracks.length - runDone) + ' left';
    }
    scSpShowProgress();
    scRunJobStart(plan.title || 'conversion', 'Converting ' + tracks.length + ' song' + (tracks.length === 1 ? '' : 's'));
    await scRunPool(tracks, scDownloadLanes(), async function(track, i){
      var slot = rows[i];
      var meta = Object.assign({}, track);
      if(!meta.position) meta.position = i + 1;
      // 72.5 - a playlist is not an album. Every song of a converted playlist
      // used to be stamped with the PLAYLIST's name as its album, which put a
      // tag on unrelated songs that a search then answered with. Only a real
      // album plan names the album here; a song of a playlist keeps its own.
      if(!meta.album && plan.album && plan.kind === 'album') meta.album = plan.album;
      if(!meta.cover && plan.cover) meta.thumb = plan.cover;
      if(meta.cover && !meta.thumb) meta.thumb = meta.cover;
      var stateEl = slot && slot.state;
      function rowStatus(txt){ if(stateEl) stateEl.textContent = txt; }
      if(window.__scCancelDl){
        if(stateEl){ stateEl.textContent = '\u2014 cancelled'; stateEl.style.color = 'var(--ink-dim)'; }
        tracksDone[i] = false;
        return;
      }
      if(slot) slot.started = true;
      // This song's own context: the run's ledger, and its own place to say why it
      // failed (see scFail).
      var ctx = { used: runCtx.used, titles: runCtx.titles, reason: '', fail: function(msg){ ctx.reason = msg; } };
      var out = null;
      try{
        out = await scConvertOneTrack(meta, fmt, rowStatus, ctx);
      }catch(e){
        out = { ok: false, reason: (e && e.message) || 'error' };
      }
      tracksDone[i] = !!(out && out.ok);
      if(out && out.ok){
        // The library entry is the point of the run: no share sheet, no
        // download, no import. Everything below is an optional extra.
        var addedTrack = scAddConvertedToLibrary(out.blob, {
          title: meta.title || 'Untitled',
          artist: meta.artist || '',
          album: meta.album || plan.album || '',
          genre: meta.genre || '',
          artBytes: out.artBytes, artMime: out.artMime
        }, { fileName: out.fName, fmt: fmt, source: plan.title || 'conversion' });
        var extra = '';
        if(wantZip){
          try{ zip.file(out.fName, out.blob); extra = ' \u00b7 in ZIP'; }
          catch(_ze){ extra = ' \u00b7 ZIP skipped'; }
        } else if(alsoSaveFiles){
          try{
            var savedOk = false;
            try{ savedOk = await scNativeSaveBlob(out.blob, out.fName); }catch(_se){}
            if(!savedOk) scDownloadBlob(out.blob, out.fName);
            extra = ' \u00b7 file saved';
          }catch(_se2){}
        }
        if(addedTrack){
          okCount++;
          if(stateEl){ stateEl.textContent = '\u2713 in library' + extra; stateEl.style.color = 'var(--coral)'; }
        } else {
          failCount++;
          failedNames.push((meta.title || 'Untitled') + ' (could not add to the library)');
          if(stateEl){ stateEl.textContent = '\u2717 could not add'; stateEl.style.color = '#f87171'; }
        }
      } else if(out && out.reason === 'cancelled'){
        tracksDone[i] = false;
        if(stateEl){ stateEl.textContent = '\u2014 cancelled'; stateEl.style.color = 'var(--ink-dim)'; }
      } else {
        failCount++;
        failedNames.push((meta.title || 'Untitled') + ((out && out.reason) ? ' (' + out.reason + ')' : ''));
        if(stateEl){ stateEl.textContent = '\u2717 ' + ((out && out.reason) ? out.reason : 'failed'); stateEl.style.color = '#f87171'; }
      }
      if(slot) slot.done = !!(out && out.ok);
      runDone++;
      scSpShowProgress();
      scConvertPillUpdate('Converting ' + runDone + '/' + tracks.length + ' \u00b7 ' + (plan.title || 'conversion'),
        okCount + ' added to your library' + (failCount ? ' \u00b7 ' + failCount + ' failed' : ''), Math.round((runDone / tracks.length) * 100));
      scRunJobNote(runDone + ' of ' + tracks.length + ' finished', (runDone / tracks.length) * 100);
    });
    scRunJobEnd();
"""
