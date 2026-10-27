"""80.3.4, section 3 - the two batch runners: written down, and one of them a
function now.

The YouTube playlist run lived inside the click handler that started it: a closure
over `pl`, `chosen`, `fmt`, `box` and `btnEl`, reachable only by tapping Convert.
"Automatically resume downloading" needs the same run to be startable from the
downloader at boot with the songs that never landed, so the body is lifted into
`scYtRunChosen(pl, chosen, fmt, box, btnEl, url)` - byte for byte the run it always
was (the only edits inside it are the three record hooks) - and the click handler
calls it. That is the whole refactor; the 80.3.3 behaviour of the run is untouched.

Both runners also announce a resumed run in the words the owner will read ("Resuming
- 12 of 32 still to make"), and both hand each finished song to the record by the
exact slot it was given, which is what makes a reload resume the RIGHT songs.

Imported by dev/patch-8034.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 3a. The YouTube playlist run, lifted out of the click handler.
# ---------------------------------------------------------------------------
YT_RUN_FN = r"""  // The playlist run itself. 80.3.4 lifted it out of the Convert button's click
  // handler unchanged, because the downloader has to be able to start it too: when
  // an interrupted run is picked up again after a reload, this function is called
  // with the songs that never landed. Nothing about how a song is made, tagged or
  // filed moved - the only edits inside are the three lines that write the run
  // down and take each landed song off its queue.
  async function scYtRunChosen(pl, chosen, fmt, box, btnEl, url){
    var okCount = 0, failed = 0, failedNames = [];
    // 80.3.4 - the run is written down before a byte moves: this song list is what
    // a reload resumes from.
    scDlJobItems('youtube', url, fmt, 'library', (pl && pl.title) || 'YouTube playlist', { title: (pl && pl.title) || '' }, chosen);
    box.innerHTML = '<div class="yt-pl-run" style="padding:10px; border:1px solid var(--line); border-radius:10px; background:rgba(255,255,255,0.03);">' +
      '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;"><div style="width:14px;height:14px;border:2px solid var(--coral);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
      '<div style="font-size:12px; font-weight:600; color:var(--ink);">' + scEscapeHtml(pl.title || 'YouTube playlist') + '</div></div>' +
      '<div class="yt-pl-sub" style="font-size:10.5px; color:var(--ink-dim); margin-bottom:6px;"></div>' +
      '<div style="height:6px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden;"><div class="yt-pl-bar" style="height:100%; width:0%; background:var(--coral); transition:width 0.3s ease;"></div></div>' +
      '<div class="yt-pl-rows" style="margin-top:8px; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div></div>';
    var run = box.querySelector('.yt-pl-run');
    var subEl = run.querySelector('.yt-pl-sub');
    var barEl = run.querySelector('.yt-pl-bar');
    var rowsEl = run.querySelector('.yt-pl-rows');
    // 80.3.3 - EVERY ROW GOES UP FIRST, and scDownloadLanes() songs are in
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
      // scDlHead() is empty for a run the owner started and says "Resuming - 12 of
      // 32 still to make" for one the downloader picked back up.
      if(subEl) subEl.textContent = scDlHead() + runDone + ' of ' + chosen.length + ' finished';
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
        // 80.3.4 - this song is made; a reload must not make it again.
        scDlJobTake(i);
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
    var cancelled = !!window.__scCancelDl;
    var summary = document.createElement('div');
    summary.style.cssText = 'font-size:10.5px; color:var(--ink-dim); margin-top:8px; line-height:1.5;';
    summary.innerHTML = (cancelled ? 'Cancelled \u2014 ' : '') + okCount + ' of ' + chosen.length + ' songs are in your library.' + (failed ? ' ' + failed + ' could not be made: ' + scEscapeHtml(failedNames.join(', ')) + '.' : '');
    run.appendChild(summary);
    scConvertPillDone((cancelled ? 'Cancelled \u2014 ' : '') + okCount + ' song' + (okCount === 1 ? '' : 's') + ' added to your library' + (failed ? ' \u00b7 ' + failed + ' failed' : ''));
    if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
    // 80.3.4 - the queue as it stands (what made it, what did not) is written down
    // for the next start.
    scDlJobSave();
  }

"""

YT_FN_ANCHOR = "  // The playlist card: list the songs, let the user untick what they do not want,"

# The click handler keeps its picking, and calls the run above.
YT_SPAN_START = """          window.__scCancelDl = false; scConvertPillResetCancel();
          (async function(){
            var okCount = 0, failed = 0, failedNames = [];"""

YT_SPAN_END = """            if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
          })();
        });"""

YT_SPAN_NEW = """          window.__scCancelDl = false; scConvertPillResetCancel();
          // 80.3.4 - the run is a function now (scYtRunChosen, above the playlist
          // card), so the downloader can start the same run at boot with the songs
          // that never landed. The button is put back if the run throws, which the
          // inline version left to chance.
          scYtRunChosen(pl, chosen, fmt, box, btnEl, url).catch(function(){
            if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
          });
        });"""

# ---------------------------------------------------------------------------
# 3b. The Spotify batch runner: the record, the resume words, and the slot marks.
# ---------------------------------------------------------------------------
SP_HEAD_OLD = """    var tracks = (chosenTracks && chosenTracks.length) ? chosenTracks.slice() : ((plan && plan.tracks) || []);
    if(!tracks.length) return false;
    window.__scCancelDl = false; scConvertPillResetCancel();"""

SP_HEAD_NEW = """    var tracks = (chosenTracks && chosenTracks.length) ? chosenTracks.slice() : ((plan && plan.tracks) || []);
    if(!tracks.length) return false;
    // 80.3.4 - the run is written down before the first request: the song list, the
    // format, where the files were going and the link that produced it. An album is
    // long enough for an OTA reload to land in the middle of it, and the downloader
    // picks the songs that never landed back up from this.
    scDlJobItems('spotify', originalUrl, fmt, saveMode, (plan && plan.title) || 'conversion',
      { title: (plan && plan.title) || '', artist: (plan && plan.artist) || '', album: (plan && plan.album) || '',
        cover: (plan && plan.cover) || '', kind: (plan && plan.kind) || '' }, tracks);
    window.__scCancelDl = false; scConvertPillResetCancel();"""

SP_SUB_OLD = """margin-bottom:6px;">Starting ' + tracks.length + ' track' + (tracks.length === 1 ? '' : 's') + ' """

SP_SUB_NEW = """margin-bottom:6px;">' + scDlHead() + 'Starting ' + tracks.length + ' track' + (tracks.length === 1 ? '' : 's') + ' """

SP_TAKE_OLD = """        if(addedTrack){
          okCount++;"""

SP_TAKE_NEW = """        if(addedTrack){
          okCount++;
          // 80.3.4 - this song is in the library, so it is off the run's queue: a
          // reload resumes the songs that did NOT make it, never this one again.
          scDlJobTake(i);"""
