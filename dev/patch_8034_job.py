"""80.3.4, section 2 - the downloader keeps the link and picks the run up again.

The owner's ask, verbatim: *"the link should save in the downloader and it should
automatically resume downloading"*.

80.3.3 made a run survive leaving the app (a Web Lock, the notification, the
Android wake lock). None of that survives the PAGE going away, which is what an
OTA update, a storage wipe, or Android killing the WebView does - and a 32-song
album is exactly long enough for one of those to land in the middle of it.

So a run writes itself down: the link, the format, where the songs were going, the
song list it was working through, and which of those songs have landed. On the next
start the link goes back into the box it was pasted into, and the songs that never
landed are converted from that same link without asking for anything.

Two deliberate choices, both written into the code:

  * a song leaves the queue when it LANDS IN THE LIBRARY, not when the run says so
    (scAddConvertedToLibrary is the one place a converted song lands, and it is
    what marks it - by title, the way the run's own one-source-one-song ledger
    matches; the batch runners additionally mark the exact slot they were handed).
    A song that failed, or one the app died before landing, stays in the queue -
    which is the whole point of writing it down.
  * the same interrupted run is resumed automatically TWICE, and after that the
    link stays and one tap starts it again. A song that cannot be sourced at all
    must not start a download on every single launch for ever.

Imported by dev/patch-8034.py; holds constants only.
"""

# ---------------------------------------------------------------------------
# 2a. The record, the resume, and the mark-a-landed-song-off hook.
# ---------------------------------------------------------------------------
HOLD_END_ANCHOR = "\n  // ONE cancel path, for every way out of a run:"

JOB_BLOCK = r"""  // ---- THE RUN IS WRITTEN DOWN, SO A RELOAD CAN PICK IT UP --------------------
  // The owner's ask, verbatim: "the link should save in the downloader and it
  // should automatically resume downloading". A run already survives leaving the
  // app (80.3.3). What it could not survive is the PAGE going away - an OTA
  // update, a storage wipe, Android killing the WebView - and an album is long
  // enough for one of those to land in the middle of it.
  //
  // So the run writes itself down: the link, the format, where the songs were
  // going, the song list it was working through, and which of them have landed.
  // The next start puts the link back in the box it was pasted into and converts
  // the songs that never landed, from that same link, without asking.
  //
  // WHERE "LANDED" COMES FROM. The library write, not the run's own bookkeeping:
  // scAddConvertedToLibrary is the one place a converted song lands, so that is
  // what marks it off (matched by title, the way the run's own one-source-one-song
  // ledger matches), and the batch runners mark the exact slot they were handed. A
  // song that failed, or one the app died before landing, stays in the queue.
  //
  // TWO AUTOMATIC RESUMES, THEN THE LINK. A song that simply cannot be sourced must
  // not start a download on every single launch for ever: after two automatic
  // attempts the link is still in the box, and one tap starts it by hand.
  var SC_DL_JOB_KEY = 'sidecut_dl_job';
  var scDlJobLive = null;    // the record of the run in flight (or being resumed)
  var scDlAdopt = false;     // true only while a resume is driving a runner
  var scDlResumeLabel = '';  // "12 of 32" while a resumed run is on screen
  function scDlJobLoad(){
    try{
      var raw = localStorage.getItem(SC_DL_JOB_KEY);
      if(!raw) return null;
      var rec = JSON.parse(raw);
      if(!rec || typeof rec !== 'object' || !rec.url) return null;
      if(Object.prototype.toString.call(rec.left) !== '[object Array]') rec.left = [];
      return rec;
    }catch(_jl){ return null; }
  }
  function scDlJobLeft(rec){
    var out = [];
    var list = (rec && rec.left) || [];
    for(var i = 0; i < list.length; i++){ if(list[i] && !list[i].taken) out.push(list[i]); }
    return out;
  }
  function scDlJobSave(){
    var J = scDlJobLive;
    if(!J) return;
    try{
      J.at = Date.now();
      J.pending = scDlJobLeft(J).length;
      localStorage.setItem(SC_DL_JOB_KEY, JSON.stringify(J));
    }catch(_js){}
  }
  // A fresh run of any kind starts here: the record replaces whatever the last one
  // left behind, and the song list is stored as PLAIN DATA (what comes back from
  // localStorage after a reload has to be enough to convert from).
  function scDlJobBegin(kind, url, fmt, mode, title, plan, chosen, single){
    var items = [];
    if(!SC_IS_PLAY){
      for(var i = 0; i < ((chosen && chosen.length) || 0); i++){
        var t = chosen[i] || {};
        var copy = {};
        for(var k in t){ if(Object.prototype.hasOwnProperty.call(t, k)) copy[k] = t[k]; }
        copy.taken = false;
        items.push(copy);
      }
      scDlResumeLabel = '';
      scDlJobLive = { v: 1, kind: kind === 'youtube' ? 'youtube' : 'spotify', url: String(url || ''),
                      fmt: fmt || 'mp3', mode: mode || 'library', title: String(title || ''),
                      plan: plan || null, left: items, total: items.length, done: 0, single: !!single,
                      attempts: 0, at: Date.now(), pending: items.length };
      scDlJobSave();
    }
    return items;
  }
  // What the two batch runners call. A resume is already holding the record (and
  // its queue IS the list being converted), so the run adopts it instead of
  // starting a second record for the same work.
  function scDlJobItems(kind, url, fmt, mode, title, plan, tracks){
    if(scDlAdopt && scDlJobLive && scDlJobLive.left && scDlJobLive.left.length){
      scDlAdopt = false;
      return scDlJobLive.left;
    }
    scDlAdopt = false;
    return scDlJobBegin(kind, url, fmt, mode, title, plan, tracks);
  }
  // One song is off the queue. `idx` is the slot a batch runner was handed (exact);
  // with no index, the song is matched by title, and a queue with one song left in
  // it can only be that song (a single link, or the last song of an album).
  function scDlJobTake(idx, name){
    var J = scDlJobLive;
    if(!J || !J.left || !J.left.length) return;
    var item = null;
    if(typeof idx === 'number' && idx >= 0 && idx < J.left.length && !J.left[idx].taken) item = J.left[idx];
    if(!item && name != null){
      var key = '';
      try{ key = (typeof scTrackTitleKey === 'function') ? scTrackTitleKey(name) : String(name || '').toLowerCase().trim(); }catch(_kt){ key = ''; }
      var open = [];
      for(var i = 0; i < J.left.length; i++){ if(!J.left[i].taken) open.push(J.left[i]); }
      for(var j = 0; j < open.length && key; j++){
        var k2 = '';
        try{ k2 = (typeof scTrackTitleKey === 'function') ? scTrackTitleKey(open[j].title) : ''; }catch(_k2){ k2 = ''; }
        if(k2 && k2 === key){ item = open[j]; break; }
      }
      if(!item && open.length === 1) item = open[0];
    }
    if(!item || item.taken) return;
    item.taken = true;
    J.done = (J.done || 0) + 1;
    scDlJobSave();
  }
  // Cancel and the x beside the Convert button mean the same thing here: the run is
  // over, so its record goes with it and a reload does not quietly start the
  // download the owner just stopped.
  function scDlJobClear(){
    scDlJobLive = null;
    scDlAdopt = false;
    scDlResumeLabel = '';
    try{ localStorage.removeItem(SC_DL_JOB_KEY); }catch(_jc){}
  }
  // The link, back in the box it was pasted into - in both places the app offers
  // one for that kind (Discover's card and the Settings copy).
  function scDlJobFill(rec){
    if(!rec || !rec.url) return;
    var ids = rec.kind === 'youtube' ? ['ytMp3Input', 'ytMp3InputSettings'] : ['spMp3Input', 'spMp3InputSettings'];
    for(var i = 0; i < ids.length; i++){
      var el = document.getElementById(ids[i]);
      if(el && !el.value) el.value = rec.url;
    }
  }
  // The opening words of a resumed run, and nothing at all for a normal one; a
  // fresh run clears it (scDlJobBegin), so it can never label the wrong run.
  function scDlHead(){
    return scDlResumeLabel ? ('Resuming \u2014 ' + scDlResumeLabel + ' still to make \u00b7 ') : '';
  }
  var scDlResumeKicked = false, scDlResumeBusy = false;
  function scDlResumeKick(){
    if(scDlResumeKicked) return;
    scDlResumeKicked = true;
    // The link comes back first: that half of the ask does not wait on the library.
    try{ scDlJobFill(scDlJobLoad()); }catch(_rf){}
    var waits = 0;
    var t = setInterval(function(){
      waits++;
      var ready = false;
      // Not on a library that is still being read: a resume adds songs to it.
      try{ ready = (typeof scLibraryReadOk !== 'undefined' && scLibraryReadOk) || (allTracks && allTracks.length) || waits > 80; }
      catch(_rw){ ready = waits > 80; }
      if(!ready) return;
      clearInterval(t);
      try{ scDlResume(); }catch(_rs){}
    }, 250);
  }
  async function scDlResume(){
    if(scDlResumeBusy || SC_IS_PLAY || window.__scCancelDl) return;
    var rec = scDlJobLoad();
    if(!rec) return;
    scDlJobFill(rec);
    var left = scDlJobLeft(rec);
    if(!left.length) return;                       // nothing was left unfinished
    if((rec.attempts || 0) >= 2) return;           // two automatic tries, then the link is the answer
    var resultEl = document.getElementById(rec.kind === 'youtube' ? 'ytMp3Result' : 'spMp3Result');
    var btnEl = document.getElementById(rec.kind === 'youtube' ? 'ytMp3Btn' : 'spMp3Btn');
    if(!resultEl || !btnEl) return;
    scDlResumeBusy = true;
    rec.attempts = (rec.attempts || 0) + 1;
    rec.pending = left.length;
    scDlResumeLabel = left.length + ' of ' + (rec.total || left.length);
    scDlJobLive = rec;
    scDlAdopt = true;
    try{
      if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
      if(rec.single){
        // A one-song run is resumed by its own link: the song's own title was
        // never known here (it is read from the service while converting), so the
        // single path is asked again from the top, exactly as a tap would.
        if(rec.kind === 'youtube') convertYtToMp3(rec.url, resultEl, btnEl, rec.fmt || 'mp3');
        else convertSpToAudio(rec.url, resultEl, btnEl, rec.fmt || 'mp3');
      } else if(rec.kind === 'youtube'){
        await scYtRunChosen(rec.plan || { title: rec.title || 'YouTube playlist' }, left, rec.fmt || 'flac', resultEl, btnEl, rec.url);
      } else {
        await scRunBatchConvert(rec.plan || { title: rec.title || 'conversion' }, rec.fmt || 'mp3', rec.mode || 'library', resultEl, btnEl, rec.url, left);
      }
    }catch(_rr){}
    scDlJobSave();
    scDlResumeBusy = false;
    scDlAdopt = false;
  }
  // The x beside either Convert button empties the card - and the card's link is
  // the record, so it goes with it. One listener, the four buttons it names.
  try{
    document.addEventListener('click', function(ev){
      var id = (ev && ev.target && ev.target.id) || '';
      if(id === 'spMp3Clear' || id === 'spMp3ClearSettings'){ try{ scDlJobClear(); }catch(_x1){} }
      else if(id === 'ytMp3Clear' || id === 'ytMp3ClearSettings'){ try{ scDlJobClear(); }catch(_x2){} }
    }, true);
  }catch(_xl){}
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scDlResumeKick);
  else scDlResumeKick();
"""

# ---------------------------------------------------------------------------
# 2b. A song that lands is taken off the queue at the library write.
# ---------------------------------------------------------------------------
ADD_HOOK_OLD = """      try{ renderList(); }catch(_rl){}
      try{ scRenderListNow(); }catch(_rl2){}
      return track;"""

ADD_HOOK_NEW = """      try{ renderList(); }catch(_rl){}
      try{ scRenderListNow(); }catch(_rl2){}
      // 80.3.4 - THIS IS WHERE A SONG LEAVES THE RUN'S QUEUE. One song landing is
      // one song that a reload must not download again, and this is the only place
      // in the app where a converted song lands - so the mark is taken here rather
      // than from the run's own bookkeeping, which can die with the page.
      try{ scDlJobTake(-1, title); }catch(_tk){}
      return track;"""

# ---------------------------------------------------------------------------
# 2c. Cancel clears the record (a stopped download must not resume itself).
# ---------------------------------------------------------------------------
CANCEL_OLD = """  function scCancelConversion(btnEl){
    window.__scCancelDl = true;"""

CANCEL_NEW = """  function scCancelConversion(btnEl){
    // 80.3.4 - Cancel means gone, record and all: a reload must not start the
    // download the owner just stopped.
    try{ scDlJobClear(); }catch(_cc){}
    window.__scCancelDl = true;"""

# ---------------------------------------------------------------------------
# 2d. The single-link runs are written down too (their own path on resume).
# ---------------------------------------------------------------------------
SP_SINGLE_OLD = """    window.__scCancelDl = false; scConvertPillResetCancel();
    scConvertPillUpdate('Converting \u00b7 Spotify', 'Fetching track info\u2026', 15);"""

SP_SINGLE_NEW = """    window.__scCancelDl = false; scConvertPillResetCancel();
    // 80.3.4 - one song is a run too, so the link is written down before the work
    // starts: a reload in the middle of a single leaves the link in the box rather
    // than an empty one, and the song it never finished is made on the next start.
    try{ scDlJobBegin('spotify', url, (presetFmt && presetFmt !== 'auto') ? presetFmt : 'mp3', 'library', 'Spotify link', null, [{ title: '' }], true); }catch(_sb){}
    scConvertPillUpdate('Converting \u00b7 Spotify', 'Fetching track info\u2026', 15);"""

YT_SINGLE_OLD = """    window.__scCancelDl = false; scConvertPillResetCancel();
    if(resultEl) resultEl._scClearOnCancel = false;"""

YT_SINGLE_NEW = """    window.__scCancelDl = false; scConvertPillResetCancel();
    // 80.3.4 - the same record for a single video link (see the job block above
    // the pill): the link survives a reload, and so does the song it was making.
    try{ scDlJobBegin('youtube', url, (presetFmt && presetFmt !== 'auto') ? presetFmt : 'mp3', 'library', 'YouTube link', null, [{ title: '' }], true); }catch(_yb){}
    if(resultEl) resultEl._scClearOnCancel = false;"""
