# The page text dev/patch-7417.py writes, part one: THE FOUR THINGS 74.1.7 ASKS
# FOR - the cleaner row that no longer lets a name out of it, the Re-encode button
# that asks which rate, the compress that carries on when the app is left, and the
# playlists that can be reordered from Manage playlists.
#
# Nothing here runs on its own; it is exec'd into dev/patch-7417.py's globals. Every
# constant is the exact text an `edit()` call swaps in, and every OLD is an anchor
# that was checked to appear exactly once in the 74.1.6 page before this release was
# cut (`python3 dev/patch-7417.py` refuses to write anything if one of them does not).

# ---- 1. THE ROW'S LINES ARE BLOCKS, AND THE ROW CLIPS -----------------------
CSS_OLD = r""".sc-store-txt{ flex: 1; min-width: 0; }
.sc-store-name{ font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-store-sub{ font-size: 10.5px; color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-store-hit{ flex: 1; min-width: 0; display: flex; gap: 10px; align-items: center; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; -webkit-tap-highlight-color: transparent; }
"""

CSS_NEW = r"""/* 74.1.7 - A ROW'S TWO LINES ARE BLOCKS, AND THE ROW CLIPS. The cover, the name
   and the line under it are one <button> (74.1.6), and a button may only hold
   phrasing content, so both lines are <span>s. A span - unlike the <div>s this
   markup carried before - lays out INLINE, and an inline box ignores
   `overflow: hidden` and `text-overflow: ellipsis` completely: the nowrap text
   painted straight on past the Re-encode button and off the right of the screen,
   which is what the phone showed. display: block on the text column and on both
   of its lines makes each one a real box the ellipsis can clip, and the row itself
   clips as a last resort, so nothing a song is called can leave the row again. */
.sc-store-txt{ display: block; flex: 1; min-width: 0; overflow: hidden; }
.sc-store-name{ display: block; font-size: 12.5px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-store-sub{ display: block; font-size: 10.5px; color: var(--ink-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sc-store-hit{ flex: 1; min-width: 0; display: flex; gap: 10px; align-items: center; margin: 0; padding: 0; border: 0; background: none; color: inherit; font: inherit; text-align: left; cursor: pointer; overflow: hidden; -webkit-tap-highlight-color: transparent; }
"""

# The rules the two new surfaces need, appended to the cleaner's own block.
CSS_PICK_OLD = r""".sc-info-tag{ margin-top: 6px; font-size: 11px; color: var(--ink-dim); }
"""

CSS_PICK_NEW = r""".sc-info-tag{ margin-top: 6px; font-size: 11px; color: var(--ink-dim); }

/* 74.1.7 - the rate sheet under a row, and the strip a running compress shows. */
.sc-reen-list{ margin-top: 8px; display: flex; flex-direction: column; gap: 6px; }
.sc-reen-rate{ display: flex; align-items: baseline; gap: 10px; min-height: 40px; padding: 9px 10px; border-radius: 10px; border: 1px solid var(--line); background: var(--bg); color: var(--ink); font: inherit; text-align: left; cursor: pointer; transition: transform 0.12s cubic-bezier(0.34,1.56,0.64,1), border-color 0.2s ease; }
.sc-reen-rate:active{ transform: scale(0.98); }
.sc-reen-rate.on{ border-color: var(--gold); }
.sc-reen-rate[disabled]{ opacity: 0.6; cursor: default; }
.sc-reen-rate.grows{ border-color: color-mix(in srgb, var(--coral) 55%, var(--line)); }
.sc-reen-k{ font-size: 12.5px; font-weight: 600; min-width: 62px; }
.sc-reen-what{ font-size: 11.5px; flex: 1; }
.sc-reen-rate.grows .sc-reen-what{ color: var(--coral); }
.sc-reen-tail{ font-size: 10.5px; color: var(--ink-dim); }
.sc-job{ margin: 8px 0 2px; padding: 8px 10px; border-radius: 12px; border: 1px solid color-mix(in srgb, var(--gold) 45%, var(--line)); background: var(--bg-raised); }
.sc-job-txt{ font-size: 11px; line-height: 1.35; color: var(--ink); }
.sc-job-bar{ margin-top: 6px; height: 3px; border-radius: 2px; background: rgba(255,255,255,0.09); overflow: hidden; }
.sc-job-bar i{ display: block; height: 100%; border-radius: 2px; background: var(--gold); transition: width 0.25s linear; }
.sc-stopped{ margin-top: 8px; border: 1px solid color-mix(in srgb, var(--coral) 40%, var(--line)); }
.sc-stopped .sc-btn{ margin-top: 8px; }
"""

# ---- 2. THE RATES ARE A CHOICE, INCLUDING UP --------------------------------
REEN_OLD = r"""  var REENCODE_RATES = [96, 128, 160];
"""

REEN_NEW = r"""  // 74.1.7 - THE RATE IS A CHOICE NOW, AND IT INCLUDES GOING UP. A re-encode used
  // to run the moment the button was tapped, at the one rate chosen at the bottom
  // of the cleaner - so a song could only be shrunk the way the whole list was set
  // up to shrink, and there was no way at all to a bigger file. The button opens
  // the rates instead: 96 to 320 kbps, each one saying what it would do to THIS
  // song, in MB, before anything is encoded.
  //
  // A rate above what the file already reads is offered, and named for what it is.
  // Re-encoding a 128 kbps MP3 at 320 cannot put back the detail the first encode
  // threw away - it spends a bigger file on the same sound - so the sheet says
  // `grows the file by` rather than dressing it up as an upgrade, and the note under
  // the list says the same thing once, plainly.
  var REENCODE_RATES = [96, 128, 160, 192, 256, 320];
  // The two panels a cleaner row can open: its bubble, and the rates under the
  // Re-encode button. One at a time - they hang under the same row.
  var scReenId = '';
  // What a rate would do to this song, SIGNED: the estimated file minus the file,
  // so MINUS means a smaller file and plus means a bigger one. scEstSaved (the
  // bubble's own reading) clamps at 0, which is right for a button that only ever
  // shrank things and wrong for a list that offers to grow them.
  function scEstDelta(t, kbps){
    try{
      if(!t || !t.file || !t.file.size || !t.duration) return 0;
      return Math.round(t.duration * kbps * 125) - t.file.size;
    }catch(e){ return 0; }
  }
  function scReenPickHtml(t, size){
    var now = scInfoKbps(t);
    var running = encodeJob && encodeJob.id === t.id;
    var list = REENCODE_RATES.map(function(k){
      var d = scEstDelta(t, k);
      var isRun = running && encodeJob.kbps === k;
      var what = d < 0 ? 'wins back ' + scMb(-d) : (d > 0 ? 'grows the file by ' + scMb(d) : 'nothing either way');
      var tail = isRun ? 'running \u2014 ' + Math.round((encodeJob.frac || 0) * 100) + '%'
        : (k === reenKbps ? 'the rate set below' : (now && k > now ? 'above what the file reads' : ''));
      return '<button class="sc-reen-rate' + (isRun ? ' on' : '') + (d > 0 ? ' grows' : '') + '"' +
        ' data-reencgo="' + esc(t.id) + '" data-rate="' + k + '"' + (running ? ' disabled' : '') + '>' +
        '<span class="sc-reen-k">' + k + ' kbps</span>' +
        '<span class="sc-reen-what">' + what + '</span>' +
        (tail ? '<span class="sc-reen-tail">' + tail + '</span>' : '') +
        '</button>';
    }).join('');
    return '<div class="sc-info sc-reen" data-reen="' + esc(t.id) + '">' +
      '<div class="sc-info-name">Re-encode \u201c' + esc(t.name || 'Untitled') + '\u201d</div>' +
      '<div class="sc-info-artist">' + (now ? 'The file reads about ' + now + ' kbps' : 'This file carries no length to measure') + ' \u00b7 ' + scMb(size) + '</div>' +
      '<div class="sc-reen-list">' + list + '</div>' +
      '<div class="sc-info-tag">A higher rate cannot put back detail the file no longer has \u2014 it only makes the file bigger. Every size here is worked out from this song\u2019s own length, and every re-encode can be undone.</div>' +
      '</div>';
  }
"""

# ---- 3. ONE COMPRESS AT A TIME, AND IT CARRIES ON WHEN YOU LEAVE ------------
JOB_OLD = r"""  // ---- re-encode to a smaller bitrate, in place, with the crop's own undo ----
"""

JOB_NEW = r"""  /* --------------------------------------------------------------------------
     4b. A COMPRESS THAT CARRIES ON WHEN YOU LEAVE (74.1.7)
     -------------------------------------------------------------------------- */
  // The ask, in the owner's words: "it should be able to re encode in the
  // background". A re-encode is minutes of work on a 50 MB file, and a phone put
  // down in the middle of one is the ordinary case, not the exception. So the job
  // is built to survive being left:
  //
  //   * THE JOB HOLDS A WEB LOCK FOR ITS WHOLE LIFE. A page holding a lock is
  //     exempt from the browser's background freeze and from its intensive timer
  //     throttling, which is the difference between a compress that finishes in
  //     your pocket and one that stalls the moment the screen goes off. A WebView
  //     without the API runs the same job without the lock.
  //   * THE SLICE BUDGET TRIPLES WHILE HIDDEN (scBackSliceMul). A hidden page is
  //     woken less often and every wake-up pays a scheduling round trip, so each
  //     slice does three times the work: the same wall clock for a quarter of the
  //     wake-ups. Visible, it stays the 90ms the screen cannot tell apart.
  //   * THE JOB IS WRITTEN DOWN BEFORE IT STARTS AND CLEARED WHEN IT ENDS. If the
  //     phone kills the app outright there is no half-written song to clean up -
  //     the stored file is only replaced after the encoder has produced its bytes -
  //     and what survives is this record, so the cleaner can say what happened
  //     instead of presenting an interrupted run as a loss.
  //   * IT SAYS WHERE IT IS. The cleaner carries a strip with the song, the rate
  //     and the percentage, and the row's own button reads Encoding\u2026 while it
  //     runs, so a job left in the background is something you can see on return.
  var ENCODE_JOB_KEY = 'sidecut_encodeJob';
  var encodeJob = null;
  function scBackSliceMul(){ return document.hidden ? 3 : 1; }
  function scJobLock(run){
    try{
      if(navigator.locks && navigator.locks.request){
        return navigator.locks.request('sidecut-reencode', { mode: 'exclusive' }, function(){ return run(); });
      }
    }catch(e){}
    return run();
  }
  function scJobText(pct){
    return 'Compressing "' + ((encodeJob && encodeJob.name) || 'song') + '" at ' + ((encodeJob && encodeJob.kbps) || 0) + ' kbps \u00b7 ' + pct + '% \u00b7 this carries on if you leave the app';
  }
  function scJobStripHtml(){
    if(!encodeJob) return '';
    var pct = Math.round((encodeJob.frac || 0) * 100);
    return '<div class="sc-job" data-job>' +
      '<div class="sc-job-txt" data-job-txt>' + scJobText(pct) + '</div>' +
      '<div class="sc-job-bar"><i data-job-bar style="width:' + pct + '%"></i></div></div>';
  }
  // Cheaper than a repaint: while a job runs its numbers move on their own, and a
  // full Studio rebuild eleven times a second would be its own kind of freeze.
  function scJobPaint(){
    try{
      var pct = encodeJob ? Math.round((encodeJob.frac || 0) * 100) : 0;
      var strip = document.querySelector('#studioView [data-job]');
      if(strip && encodeJob){
        var bar = strip.querySelector('[data-job-bar]');
        if(bar) bar.style.width = pct + '%';
        var txt = strip.querySelector('[data-job-txt]');
        if(txt) txt.textContent = scJobText(pct);
      }
      if(encodeJob){
        var btn = document.querySelector('#studioView [data-reenc="' + encodeJob.id + '"]');
        if(btn) btn.textContent = 'Encoding\u2026 ' + pct + '%';
      }
    }catch(e){}
  }
  function scJobProgress(frac){
    if(!encodeJob) return;
    encodeJob.frac = Math.max(0, Math.min(1, Number(frac) || 0));
    scJobPaint();
  }
  function scEncodeJobStart(t, kbps){
    var job = { id: t.id, name: t.name || 'song', kbps: kbps, frac: 0, startedAt: Date.now() };
    encodeJob = job;
    try{ lsSet(ENCODE_JOB_KEY, job); }catch(e){}
    try{ renderStudio(); }catch(e){}
    return job;
  }
  function scEncodeJobDone(job){
    if(encodeJob === job) encodeJob = null;
    try{ lsSet(ENCODE_JOB_KEY, null); }catch(e){}
    try{ renderStudio(); }catch(e){}
  }
  function scEncodeJobWrap(job, run){
    return scJobLock(function(){ return run; }).then(function(v){
      scEncodeJobDone(job);
      return v;
    }, function(e){
      scEncodeJobDone(job);
      throw e;
    });
  }
  // The record a killed run leaves behind. It names the song and offers the rate
  // again, and it is cleared the moment it is read: a sentence said once, not a
  // banner that follows the cleaner around for ever.
  function scInterruptedHtml(){
    var last = null;
    try{ last = lsGet(ENCODE_JOB_KEY, null); }catch(e){ last = null; }
    if(!last || !last.id) return '';
    if(encodeJob && encodeJob.id === last.id) return '';
    try{ lsSet(ENCODE_JOB_KEY, null); }catch(e){}
    var t = trackById(last.id);
    if(!t) return '';
    var rate = parseInt(last.kbps, 10) || 128;
    return '<div class="sc-note sc-stopped">The compression of <b>' + esc(t.name || 'a song') + '</b> stopped before it finished - the app was closed while it worked. The song itself is untouched: the stored file is only replaced once the encoder has produced its bytes. ' +
      '<button class="sc-btn tiny" data-reencgo="' + esc(t.id) + '" data-rate="' + rate + '">Start it again at ' + rate + ' kbps</button></div>';
  }

  // ---- re-encode to a smaller bitrate, in place, with the crop's own undo ----
"""

# The row's own button, the sheet that hangs under it, and the highlight they share
# (storageHtml).
ROW_OPEN_OLD = r"""      var open = scInfoId === t.id;
"""

ROW_OPEN_NEW = r"""      var open = scInfoId === t.id;
      // 74.1.7 - whichever panel the row has open, the row shows it. The button still
      // reports the bubble alone (aria-expanded), because that is the panel the button
      // itself opens; the sheet under the Re-encode button highlights the same row.
      var pick = scReenId === t.id;
"""

ROW_DIV_OLD = r"""      return '<div class="sc-store-row' + (open ? ' open' : '') + '">' +
"""

ROW_DIV_NEW = r"""      return '<div class="sc-store-row' + ((open || pick) ? ' open' : '') + '">' +
"""

# The row's own button, and the sheet that hangs under it (storageHtml).
ROWBTN_OLD = r"""        '<button class="sc-btn tiny' + (big ? ' primary' : '') + '" data-reenc="' + esc(t.id) + '">Re-encode</button>' +
"""

ROWBTN_NEW = r"""        '<button class="sc-btn tiny' + (big ? ' primary' : '') + '" data-reenc="' + esc(t.id) + '"' + ((encodeJob && encodeJob.id === t.id) ? ' disabled' : '') + '>' + ((encodeJob && encodeJob.id === t.id) ? 'Encoding\u2026' : 'Re-encode') + '</button>' +
"""

ROWPICK_OLD = r"""        (open ? scInfoHtml(t, r.size) : '');
"""

ROWPICK_NEW = r"""        (open ? scInfoHtml(t, r.size) : '') +
        (scReenId === t.id ? scReenPickHtml(t, r.size) : '');
"""

STRIP_OLD = r"""    html += '<div class="sc-store-list">' + rows.map(function(r){
"""

STRIP_NEW = r"""    html += scJobStripHtml();
    html += scInterruptedHtml();
    html += '<div class="sc-store-list">' + rows.map(function(r){
"""

# reencodeOne: the job, the lock and the progress, without re-indenting the core
# the two callers and the gates already know.
RO_HEAD_OLD = r"""  function reencodeOne(t, kbps){
    if(!t || !t.file) return Promise.reject(new Error('no audio file to re-encode'));
    return decoded(t).then(function(b){
"""

RO_HEAD_NEW = r"""  function reencodeOne(t, kbps){
    if(!t || !t.file) return Promise.reject(new Error('no audio file to re-encode'));
    // 74.1.7 - the whole job is one recorded run inside one Web Lock (see 4b).
    var job = scEncodeJobStart(t, kbps);
    var run = decoded(t).then(function(b){
"""

RO_TAIL_OLD = r"""          bump('savedBytes', saved);
          return saved;
        });
      });
    });
  }
"""

RO_TAIL_NEW = r"""          bump('savedBytes', saved);
          return saved;
        });
      });
    });
    return scEncodeJobWrap(job, run);
  }
"""

# The encoder reports its slices to the job, so the strip has a percentage.
ENCODE_OLD = r"""  window.__scEncodeMp3 = function(buf, kbps, meta){ return scEncodeMp3Cooperative(buf, meta, null, kbps); };
"""

ENCODE_NEW = r"""  window.__scEncodeMp3 = function(buf, kbps, meta, onSlice){ return scEncodeMp3Cooperative(buf, meta, onSlice || null, kbps); };
"""

# The slice budget a hidden page gets. The literal SC_ENCODE_SLICE_MS stays in every
# loop (test-616 reads it there); the multiplier is what changes.
SLICE_DEF_OLD = r"""  var SC_ENCODE_SLICE_MS = 90;
"""

SLICE_DEF_NEW = r"""  var SC_ENCODE_SLICE_MS = 90;
  // 74.1.7 - while the page is hidden each slice does three times the work, so a
  // background compress pays a third of the wake-ups for the same wall clock (the
  // job also holds a Web Lock while it runs - see scJobLock - which is what tells
  // the browser this page must not be frozen at all).
"""

SLICE_MP3_OLD = r"""      if(Date.now() - sliceStart >= SC_ENCODE_SLICE_MS){
"""

SLICE_MP3_NEW = r"""      if(Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()){
"""

SLICE_WAV_OLD = r"""      if((i2 & 4095) === 4095 && Date.now() - sliceStart >= SC_ENCODE_SLICE_MS){
"""

SLICE_WAV_NEW = r"""      if((i2 & 4095) === 4095 && Date.now() - sliceStart >= SC_ENCODE_SLICE_MS * scBackSliceMul()){
"""

# ---- 4. THE WIRES -----------------------------------------------------------
WIRE_OLD = r"""    document.querySelectorAll('#studioView [data-reenc]').forEach(function(b){
      b.addEventListener('click', function(){ reencodeTrack(b.getAttribute('data-reenc'), reenKbps, b); });
    });
"""

WIRE_NEW = r"""    document.querySelectorAll('#studioView [data-reenc]').forEach(function(b){
      b.addEventListener('click', function(){
        // 74.1.7 - the button asks which rate instead of encoding at once: 96 to
        // 320 kbps is a per-song decision, and it is not one a setting at the
        // bottom of the list should make on your behalf. Tapping it again closes
        // the sheet, and the bubble above and this sheet never both show.
        var _rid = b.getAttribute('data-reenc');
        scInfoId = '';
        scReenId = (scReenId === _rid ? '' : _rid);
        renderStudio();
      });
    });
    document.querySelectorAll('#studioView [data-reencgo]').forEach(function(b){
      b.addEventListener('click', function(){
        var _rid = b.getAttribute('data-reencgo');
        var _rate = parseInt(b.getAttribute('data-rate'), 10) || reenKbps;
        scReenId = '';
        reencodeTrack(_rid, _rate, null);
      });
    });
"""

ACT_OLD = r"""        else if(act === 'storeinfo'){ var _sid = b.getAttribute('data-id') || ''; scInfoId = (scInfoId === _sid ? '' : _sid); renderStudio(); }
"""

ACT_NEW = r"""        else if(act === 'storeinfo'){ var _sid = b.getAttribute('data-id') || ''; scInfoId = (scInfoId === _sid ? '' : _sid); scReenId = ''; renderStudio(); }
"""

# ---- 5. PLAYLISTS CAN BE REORDERED FROM THE PANEL ---------------------------
MP_HEAD_OLD = r"""  function renderManagePlaylistsList(){
    const container = $('managePlaylistsList');
    container.innerHTML = '';
"""

MP_HEAD_NEW = r"""  // 74.1.7 - REORDER THE PLAYLISTS FROM THE PANEL. The order of this list IS the
  // order of the Library tabs - the tab strip already drags them and persistTabOrder
  // reads that strip back - so the panel gets the same move by arrow: the playlist
  // swaps with its neighbour, the new order is written to the same place the drag
  // writes it, and the tabs are rebuilt to match. Library and Favorites stay first
  // (every path in the app puts them there), so they are not offered a move.
  var manageReordering = false;
  function playlistIsPinned(name){ return name === 'All Songs' || name === 'Favorites'; }
  // `step` is where the playlist is going: -1 up, +1 down - which is the direction
  // the arrow that called it hands over.
  function movePlaylist(name, step){
    try{
      var keys = Object.keys(playlists);
      var from = keys.indexOf(name);
      var to = step < 0 ? from - 1 : from + 1;
      if(from < 0 || to < 0 || to >= keys.length) return false;
      if(playlistIsPinned(keys[to])) return false;
      var moved = keys.slice();
      moved.splice(to, 0, moved.splice(from, 1)[0]);
      var rebuilt = {};
      moved.forEach(function(n){ rebuilt[n] = playlists[n]; });
      playlists = rebuilt;
      dbPut('meta', { key: 'playlists', value: playlists });
      renderManagePlaylistsList();
      renderTabs();
      renderList();
      return true;
    }catch(e){ return false; }
  }
  function reorderArrow(name, dir, atEnd){
    const el = document.createElement('button');
    el.className = 'icon-btn';
    el.dataset.move = dir < 0 ? 'up' : 'down';
    el.dataset.playlist = name;
    el.title = dir < 0 ? 'Move this playlist up' : 'Move this playlist down';
    el.style.cssText = 'flex-shrink:0;' + (atEnd ? ' opacity:0.25;' : '');
    el.disabled = !!atEnd;
    el.innerHTML = dir < 0
      ? '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 5l7 9H5l7-9z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M12 19l-7-9h14l-7 9z"/></svg>';
    el.addEventListener('click', (e) => { e.stopPropagation(); movePlaylist(name, dir); });
    return el;
  }
  function renderManagePlaylistsList(){
    const container = $('managePlaylistsList');
    container.innerHTML = '';
    // The panel's own header: the way into reorder mode, and what this mode does.
    // In reorder mode a row is a name and two arrows, because the ordinary row
    // already carries up to five buttons and a sixth and seventh would leave no
    // room for the name at all.
    const head = document.createElement('div');
    head.style.cssText = 'display:flex; align-items:center; gap:8px; margin:0 0 10px;';
    const reorderBtn = document.createElement('button');
    reorderBtn.className = 'sc-btn tiny';
    reorderBtn.id = 'manageReorderBtn';
    reorderBtn.style.cssText = 'flex-shrink:0; min-height:32px;';
    reorderBtn.textContent = manageReordering ? 'Done' : 'Reorder';
    reorderBtn.addEventListener('click', () => { manageReordering = !manageReordering; renderManagePlaylistsList(); });
    const headHint = document.createElement('div');
    headHint.style.cssText = 'flex:1; font-size:10.5px; line-height:1.35; color:var(--ink-dim);';
    headHint.textContent = manageReordering
      ? 'Move a playlist with the arrows. This is the order of your Library tabs; Library and Favorites stay first.'
      : 'Tap a name to show or hide it, or use Reorder to move the playlists.';
    head.appendChild(reorderBtn);
    head.appendChild(headHint);
    container.appendChild(head);
"""

MP_ROWBTN_OLD = r"""      const btn = document.createElement('button');
      btn.style.flex = '1';
      btn.innerHTML = hidden
"""

MP_ROWBTN_NEW = r"""      const btn = document.createElement('button');
      btn.style.flex = '1';
      // In reorder mode the row is a name, not a switch: a tap here would toggle
      // the playlist off in the middle of moving it.
      if(manageReordering){
        btn.disabled = true;
        btn.style.cssText = 'flex:1; min-width:0; background:none; border:0; padding:0; text-align:left; color:var(--ink); font-size:13px; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;';
        btn.textContent = String(name) + (hidden ? ' \u00b7 hidden' : '');
      } else btn.innerHTML = hidden
"""

MP_ROWTAIL_OLD = r"""      row.appendChild(btn);
      if(name !== 'All Songs'){
"""

MP_ROWTAIL_NEW = r"""      row.appendChild(btn);
      row.dataset.playlist = name;
      if(manageReordering){
        if(playlistIsPinned(name)){
          const pinNote = document.createElement('span');
          pinNote.style.cssText = 'font-size:10.5px; color:var(--ink-dim); padding-right:6px;';
          pinNote.textContent = 'always first';
          row.appendChild(pinNote);
        } else {
          const keysNow = Object.keys(playlists);
          const at = keysNow.indexOf(name);
          row.appendChild(reorderArrow(name, -1, at <= 0 || playlistIsPinned(keysNow[at - 1])));
          row.appendChild(reorderArrow(name, 1, at >= keysNow.length - 1));
        }
        container.appendChild(row);
        return;
      }
      if(name !== 'All Songs'){
"""

MP_UNSORTED_OLD = r"""    // Add Unsorted toggle at the end
"""

MP_UNSORTED_NEW = r"""    // The Unsorted switch is not a playlist and never moves, so reorder mode has
    // nothing to offer it and leaves it out while the arrows are showing.
    if(manageReordering) return;
    // Add Unsorted toggle at the end
"""

MP_CLOSE_OLD = r"""  $('managePlaylistsClose').addEventListener('click', () => { $('managePlaylistsBackdrop').style.display = 'none'; });
  $('managePlaylistsBackdrop').addEventListener('click', e => { if(e.target === $('managePlaylistsBackdrop')) $('managePlaylistsBackdrop').style.display = 'none'; });
"""

MP_CLOSE_NEW = r"""  $('managePlaylistsClose').addEventListener('click', () => { manageReordering = false; $('managePlaylistsBackdrop').style.display = 'none'; });
  $('managePlaylistsBackdrop').addEventListener('click', e => { if(e.target === $('managePlaylistsBackdrop')) { manageReordering = false; $('managePlaylistsBackdrop').style.display = 'none'; } });
"""

# ---- 6. THE TWO HELPERS THE GATES DRIVE -------------------------------------
PUB_OLD = r"""    setTarget: function(k){ reenKbps = k; renderStudio(); },
    target: function(){ return reenKbps; }
"""

PUB_NEW = r"""    setTarget: function(k){ reenKbps = k; renderStudio(); },
    target: function(){ return reenKbps; },
    // 74.1.7 - what a gate can read of the background job: the rate sheet, the
    // hidden-slice rule, and the job itself. The playlist reorder is NOT published
    // here: it lives in the app's own scope (Manage playlists), and reaching for it
    // from this module would throw before this object was ever assigned.
    rates: function(){ return REENCODE_RATES.slice(); },
    openRates: function(id){ scInfoId = ''; scReenId = id; renderStudio(); },
    pickRate: function(id, kbps){ scReenId = ''; return reencodeTrack(id, kbps, null); },
    backSliceMul: scBackSliceMul,
    jobProgress: scJobProgress,
    encodeJob: function(){ return encodeJob; }
"""

# reencodeTrack hands back the promise, so a gate (and the assistant) can wait for
# the job instead of guessing at a delay.
TRACK_OLD = r"""    reencodeOne(t, kbps).then(function(saved){
      renderStudio();
      toastWithUndo('Re-encoded "' + (t.name || 'song') + '" at ' + kbps + ' kbps \u2014 ' + fmtBytes(saved) + ' smaller', function(){ undoReencode(id); });
    }).catch(function(e){
"""

TRACK_NEW = r"""    return reencodeOne(t, kbps).then(function(saved){
      renderStudio();
      toastWithUndo('Re-encoded "' + (t.name || 'song') + '" at ' + kbps + ' kbps \u2014 ' + fmtBytes(saved) + ' smaller', function(){ undoReencode(id); });
      return saved;
    }).catch(function(e){
"""
