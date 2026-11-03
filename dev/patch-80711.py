#!/usr/bin/env python3
"""80.7.11 - the shelf works with nothing imported, and a save shows its real stages.

    python3 dev/patch-80711.py
    python3 dev/patch-80711.py --check
Idempotent: a second run over the patched page is a no-op and --check says so.

WHY. Two things, both from the same session of using the app.

  1. "I SHOULD BE ABLE TO CREATE PLAYLISTS AND ALBUMS AND SEARCH BEFORE I HAVE A SINGLE
     SONG IMPORTED." The shelf was always built - the block is static markup and the
     boot renders it - but the onboarding screen (#emptyState) is laid over the library
     whenever allTracks is empty, so on a fresh install the search box, New playlist and
     New album were all behind a wall that said add music first. Opening the shelf now
     puts it in front of that screen, and closing it puts the screen back.

  2. "MAKE THE DOWNLOADING LIKE SPOTISAVER." They mean a staged panel: a title, the song,
     a bar, and the steps with a tick as each one lands. The honest way to have that is
     to show the steps that actually run - the song is found, its bytes are read with a
     live percentage, the audio is checked, the file is packed, and it is put where it
     was asked to go - and to say which step failed when one does. scStreamCropFile()
     now reports those steps through an optional callback, and scStreamDownload() drives
     the panel with them. Nothing on the panel is decoration.
"""

import datetime
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
INDEX = os.path.join(HERE, '..', 'index.html')

CHECK = '--check' in sys.argv
VERSION = '80.7.11'
MARKER = '80.7.11 - THE SHELF OPENS WITH NOTHING IMPORTED AND A SAVE SHOWS ITS STAGES'
ANCHOR = "  { version: '80.7.10',"

with open(INDEX, encoding='utf-8') as fh:
    SRC = fh.read()

if MARKER in SRC and ("const APP_VERSION = '%s';" % VERSION) in SRC:
    print('patch-80711: already on the page, the page is %s' % VERSION)
    sys.exit(0)

applied, failed = [], []


def once(name, old, new, expect=1):
    global SRC
    got = SRC.count(old)
    if got != expect:
        failed.append('%s: found %d, expected %d' % (name, got, expect))
        return
    SRC = SRC.replace(old, new)
    applied.append(name)


def splice(name, start, end, new):
    """Replace everything from `start` up to (not including) `end`."""
    global SRC
    a = SRC.find(start)
    b = SRC.find(end, a if a >= 0 else 0)
    if a < 0 or b < 0:
        failed.append('%s: the span was not found' % name)
        return
    SRC = SRC[:a] + new + SRC[b:]
    applied.append(name)


# -- 1. the version ----------------------------------------------------------
once('the page says 80.7.11',
     "const APP_VERSION = '80.7.10';",
     "const APP_VERSION = '80.7.11';")

# -- 2. the panel and the reader that reports --------------------------------
BLOCK = r"""  // 80.7.11 - A SAVE THAT SHOWS ITS REAL STAGES.
  // A staged panel is only worth having if the stages are the work: finding the song,
  // reading its bytes with a live percentage, checking the audio, packing the file, and
  // putting it where it was asked to go. Each row here is a step that can fail, and the
  // panel says which one did instead of spinning forever.
  var scKeepUI = { el: null, rows: {}, order: [], timer: null };

  function scKeepPanelOpen(title){
    try{
      if(scKeepUI.timer){ clearTimeout(scKeepUI.timer); scKeepUI.timer = null; }
      scKeepPanelClose();
      scKeepUI.rows = {}; scKeepUI.order = [];
      var bd = document.createElement('div');
      bd.id = 'scKeepPanel';
      bd.style.cssText = 'position:fixed;inset:0;z-index:2147483000;display:flex;align-items:center;justify-content:center;'
        + 'background:rgba(6,8,14,.62);padding:18px;';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(92vw,360px);max-height:80vh;overflow:auto;background:var(--bg);color:var(--ink);'
        + 'border:1px solid var(--line);border-radius:18px;padding:16px 16px 14px;box-shadow:0 24px 60px rgba(0,0,0,.45);';
      var h = document.createElement('div');
      h.textContent = 'Saving';
      h.style.cssText = 'font-size:11px;font-weight:800;letter-spacing:.9px;text-transform:uppercase;color:var(--ink-dim);';
      card.appendChild(h);
      var t = document.createElement('div');
      t.id = 'scKeepPanelTitle';
      t.textContent = String(title || 'Song');
      t.style.cssText = 'font-size:15px;font-weight:700;margin:4px 0 12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
      card.appendChild(t);
      var bar = document.createElement('div');
      bar.style.cssText = 'height:5px;border-radius:99px;background:var(--line);overflow:hidden;margin-bottom:12px;';
      var fill = document.createElement('div');
      fill.id = 'scKeepPanelBar';
      fill.style.cssText = 'height:100%;width:0%;background:var(--coral, var(--accent, var(--ink)));transition:width .2s ease;';
      bar.appendChild(fill);
      card.appendChild(bar);
      var list = document.createElement('div');
      list.id = 'scKeepPanelRows';
      list.style.cssText = 'display:flex;flex-direction:column;gap:7px;';
      card.appendChild(list);
      bd.appendChild(card);
      document.body.appendChild(bd);
      scKeepUI.el = { bd: bd, fill: fill, list: list };
    }catch(_eKpOpen){}
  }

  function scKeepPanelStep(key, label, pct){
    try{
      var ui = scKeepUI.el;
      if(!ui) return;
      var row = scKeepUI.rows[key];
      if(!row){
        row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:8px;font-size:12.5px;';
        var g = document.createElement('span');
        g.className = 'sc-kp-glyph';
        g.textContent = '\u25CB';
        g.style.cssText = 'flex:0 0 auto;width:16px;text-align:center;color:var(--ink-dim);';
        var l = document.createElement('span');
        l.className = 'sc-kp-label';
        l.style.cssText = 'min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;';
        row.appendChild(g); row.appendChild(l);
        ui.list.appendChild(row);
        scKeepUI.rows[key] = row;
        scKeepUI.order.push(key);
      }
      var lab = row.querySelector('.sc-kp-label');
      if(lab) lab.textContent = String(label || '');
      var done = Number(pct) >= 100;
      row.setAttribute('data-state', done ? 'done' : 'on');
      // Every earlier step is finished the moment a later one is reached, so a stage
      // nobody watched (a copy already in memory) is still ticked when it is skipped.
      var at = scKeepUI.order.indexOf(key);
      for(var i = 0; i < at; i++){
        var prev = scKeepUI.rows[scKeepUI.order[i]];
        if(prev) prev.setAttribute('data-state', 'done');
      }
      for(var k = 0; k < scKeepUI.order.length; k++){
        var r = scKeepUI.rows[scKeepUI.order[k]];
        if(!r) continue;
        var gl = r.querySelector('.sc-kp-glyph');
        if(!gl) continue;
        var isDone = r.getAttribute('data-state') === 'done';
        gl.textContent = isDone ? '\u2713' : '\u2022';
        gl.style.color = isDone ? 'var(--coral, var(--accent, var(--ink)))' : 'var(--ink-dim)';
      }
      if(typeof pct === 'number' && ui.fill) ui.fill.style.width = Math.max(0, Math.min(100, pct)) + '%';
    }catch(_eKpStep){}
  }

  function scKeepPanelDone(text, ok){
    try{
      var ui = scKeepUI.el;
      if(!ui) return;
      if(ui.fill) ui.fill.style.width = '100%';
      for(var i = 0; i < ui.list.children.length; i++){
        var r = ui.list.children[i];
        r.setAttribute('data-state', 'done');
        var g = r.querySelector('.sc-kp-glyph');
        if(g){
          g.textContent = ok === false ? '\u00D7' : '\u2713';
          g.style.color = 'var(--coral)';
        }
      }
      var t = document.getElementById('scKeepPanelTitle');
      if(t) t.textContent = String(text || 'Done');
      if(scKeepUI.timer) clearTimeout(scKeepUI.timer);
      scKeepUI.timer = setTimeout(scKeepPanelClose, ok === false ? 5200 : 2400);
    }catch(_eKpDone){}
  }

  function scKeepPanelClose(){
    try{
      var bd = document.getElementById('scKeepPanel');
      if(bd && bd.parentNode) bd.parentNode.removeChild(bd);
    }catch(_eKpClose){}
    scKeepUI.el = null; scKeepUI.rows = {}; scKeepUI.order = [];
  }

  // The bytes with a live percentage: the same reader the stream reads with, asked for
  // the whole file, reporting as it lands so the bar is the read and not a guess.
  function scStreamReadProgress(u, mime, onPct){
    if(!u) return Promise.resolve('');
    var type = String(mime || '').split(';')[0].trim();
    if(!type || /^video\//i.test(type)) type = 'audio/mp4';
    return Promise.resolve(scFetchBytes(u, 0, function(loaded, total){
      try{ if(typeof onPct === 'function') onPct(total ? Math.round((loaded / total) * 100) : 0); }catch(_eRp){}
    }, SC_STREAM_LANES))
      .then(function(buf){
        if(!buf || !buf.byteLength) return '';
        var blob = new Blob([buf], { type: type });
        if(!blob.size) return '';
        return URL.createObjectURL(blob);
      })
      .catch(function(){ return ''; });
  }

  // 80.7.9 - A SONG THAT ONLY EXISTS AS A SOURCE CAN BE KEPT.
  // scStreamCropFile() already knows how to read a catalogue song's bytes - the copy"""

once('the panel is inserted with the keeper',
     "  // 80.7.9 - A SONG THAT ONLY EXISTS AS A SOURCE CAN BE KEPT.\n"
     "  // scStreamCropFile() already knows how to read a catalogue song's bytes - the copy",
     BLOCK)

# -- 3. the reader reports its stages ---------------------------------------
OLD_CROP = """  async function scStreamCropFile(t){
    var id = String((t && (t.streamId || t.id)) || '').replace(/^scstream:/, '');
    var entry = scStreamById(id) || {};
    var vid = String(entry.videoId || (t && t.videoId) || '');
    var url = '';
    var fresh = '';
    try{ if(String(scStreamState.curId) === id && scStreamState.blobUrl) url = scStreamState.blobUrl; }catch(_eCf1){}
    if(!url && vid){ try{ var hit = scStreamCacheGet(vid); if(hit && hit.url) url = hit.url; }catch(_eCf2){} }
    if(!url && vid){
      var src = await scStreamResolve(vid);
      if(src) fresh = await scStreamReadOnly(src, scStreamState.mime, 0);
      url = fresh;
    }
    if(!url) throw new Error('the song could not be read from its source');
    try{
      var res = await fetch(url);
      var blob = await res.blob();
      if(!blob || !blob.size) throw new Error('the song came back empty');
      var type = String(blob.type || 'audio/mp4');
      var ext = /webm/i.test(type) ? '.webm' : (/ogg/i.test(type) ? '.ogg' : '.m4a');
      var base = scSafeName(String(entry.title || (t && t.name) || 'stream'));
      return new File([blob], base + ext, { type: type });
    } finally {
      if(fresh){ try{ URL.revokeObjectURL(fresh); }catch(_eCf3){} }
    }
  }"""

NEW_CROP = """  // 80.7.11 - IT REPORTS WHAT IT IS DOING. `on` is optional, so the crop sheet keeps
  // calling it exactly as it did; the save passes a listener and gets the stages.
  async function scStreamCropFile(t, on){
    function step(k, pct){ try{ if(typeof on === 'function') on(k, pct); }catch(_eCfStep){} }
    var id = String((t && (t.streamId || t.id)) || '').replace(/^scstream:/, '');
    var entry = scStreamById(id) || {};
    var vid = String(entry.videoId || (t && t.videoId) || '');
    var url = '';
    var fresh = '';
    try{ if(String(scStreamState.curId) === id && scStreamState.blobUrl) url = scStreamState.blobUrl; }catch(_eCf1){}
    if(!url && vid){ try{ var hit = scStreamCacheGet(vid); if(hit && hit.url) url = hit.url; }catch(_eCf2){} }
    if(!url && vid){
      step('find');
      var src = await scStreamResolve(vid);
      if(src) fresh = await scStreamReadProgress(src, scStreamState.mime, function(pct){ step('read', pct); });
      url = fresh;
    }
    if(!url) throw new Error('the song could not be read from its source');
    step('read', 100);
    step('check');
    try{
      var res = await fetch(url);
      var blob = await res.blob();
      if(!blob || !blob.size) throw new Error('the song came back empty');
      var type = String(blob.type || 'audio/mp4');
      var ext = /webm/i.test(type) ? '.webm' : (/ogg/i.test(type) ? '.ogg' : '.m4a');
      var base = scSafeName(String(entry.title || (t && t.name) || 'stream'));
      step('pack');
      return new File([blob], base + ext, { type: type });
    } finally {
      if(fresh){ try{ URL.revokeObjectURL(fresh); }catch(_eCf3){} }
    }
  }"""

once('the crop reader reports its stages', OLD_CROP, NEW_CROP)

# -- 4. the save drives the panel -------------------------------------------
DOWNLOAD = r"""  // dest: {kind:'lib'} | {kind:'pl', name} | {kind:'al', name} | {kind:'file'}
  // 80.7.11 - AND IT SHOWS ITS WORK. The panel is opened for the song, moved by the
  // stages the read actually reaches, and closed on the answer - including the answer
  // that something failed, which is the one a spinner used to hide.
  async function scStreamDownload(id, dest){
    var e = scStreamEntry(id);
    if(!e){ scStreamSay('That song is not in Streaming any more'); return; }
    if(scKeepBusy){ scStreamSay('Still keeping the last one - give it a second'); return; }
    dest = dest || { kind: 'lib' };
    var title = String(e.title || 'Untitled');
    var kept = scStreamKeptFrom(id);
    var where = (dest.kind === 'pl' || dest.kind === 'al')
      ? (' and \u201c' + String(dest.name || '') + '\u201d') : ' to All Songs';
    scKeepBusy = String(id);
    scKeepPanelOpen(title);
    function stage(k, pct){
      if(k === 'find') scKeepPanelStep('find', 'Finding the song', pct);
      else if(k === 'read') scKeepPanelStep('read', 'Reading the song' + (pct ? ' \u00b7 ' + pct + '%' : ''), pct);
      else if(k === 'check') scKeepPanelStep('check', 'Checking the audio', 100);
      else if(k === 'pack') scKeepPanelStep('pack', 'Packing the file', 100);
    }
    try{
      if(dest.kind === 'file'){
        var out = await scStreamCropFile({ streamId: String(id), name: title, artist: String(e.artist || '') }, stage);
        scKeepPanelStep('save', 'Saving the file to your device', 100);
        await saveExportFile(out, out.name);
        scKeepPanelDone('Saved \u201c' + title + '\u201d to your device');
        scStreamSay('Handed \u201c' + title + '\u201d to your device');
        return;
      }
      var track = kept;
      if(!track){
        var file = await scStreamCropFile({ streamId: String(id), name: title, artist: String(e.artist || '') }, stage);
        scKeepPanelStep('save', 'Adding it' + where, 100);
        track = scStreamKeepTrack(id, file);
      } else {
        scKeepPanelStep('save', 'Adding the copy already on your device' + where, 100);
      }
      if(dest.kind === 'pl' || dest.kind === 'al') scStreamKeepIn(dest, track);
      scKeepPanelDone(kept ? ('Added' + where) : ('Saved \u201c' + title + '\u201d' + where));
      scStreamSay(kept ? ('Already on your device - added' + where) : ('Kept \u201c' + title + '\u201d' + where));
      try{ if(typeof toast === 'function') toast(kept ? ('Added: ' + String(track.name || title) + where) : ('Saved: ' + String(track.name || title) + where), 2800); }catch(_eKeepToast){}
    }catch(err){
      console.warn('Keep from source failed:', err);
      var why = String((err && err.message) || 'the source did not answer');
      scKeepPanelDone('Could not save it - ' + why, false);
      scStreamSay('Could not keep that song: ' + why);
    } finally {
      scKeepBusy = '';
    }
  }

"""

splice('the save drives the panel',
       "  // dest: {kind:'lib'} | {kind:'pl', name} | {kind:'al', name} | {kind:'file'}",
       '  function scStreamDownloadPick(id, kind){',
       DOWNLOAD)

# -- 5. the shelf opens even with nothing imported --------------------------
once('the onboarding screen no longer blocks the shelf',
     """  function scShelfPage(on){
    var sheet = scShelfSheet(), list = document.getElementById('listPane');
    var view = document.getElementById('library');
    if(sheet){ if(on) sheet.classList.add('scShelfOpen'); else sheet.classList.remove('scShelfOpen'); }
    if(list){ list.style.display = on ? 'none' : ''; }
    if(view){ if(on) view.classList.add('scShelfOn'); else view.classList.remove('scShelfOn'); }
  }""",
     """  function scShelfPage(on){
    var sheet = scShelfSheet(), list = document.getElementById('listPane');
    var view = document.getElementById('library');
    if(sheet){ if(on) sheet.classList.add('scShelfOpen'); else sheet.classList.remove('scShelfOpen'); }
    if(list){ list.style.display = on ? 'none' : ''; }
    if(view){ if(on) view.classList.add('scShelfOn'); else view.classList.remove('scShelfOn'); }
    // 80.7.11 - THE SHELF IS NOT A REWARD FOR IMPORTING SOMETHING. The onboarding screen
    // is laid over the library whenever allTracks is empty, so on a fresh install the
    // search box, New playlist and New album were behind a wall that says add music
    // first. Opening the shelf puts it in front of that screen; closing it puts the
    // screen back, under the same rule navigate() already uses.
    try{
      var es = document.getElementById('emptyState');
      if(es) es.style.display = on ? 'none'
        : (((typeof allTracks !== 'undefined' && allTracks.length) || !scLibraryReadOk) ? 'none' : 'flex');
    }catch(_eEmptyShelf){}
  }""")

# -- 6. the changelog ------------------------------------------------------

def stamp():
    now = datetime.datetime.now(datetime.timezone.utc)
    try:
        from zoneinfo import ZoneInfo
        local = now.astimezone(ZoneInfo('America/New_York'))
        label = 'EDT' if local.dst() else 'EST'
        return local.strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' ' + label
    except Exception:  # noqa: BLE001 - a missing tz database must not fail a release
        return (now - datetime.timedelta(hours=4)).strftime('%B %-d, %Y \u00b7 %-I:%M %p') + ' EDT'


ENTRY = (
    "  // 80.7.11 - THE SHELF OPENS WITH NOTHING IMPORTED AND A SAVE SHOWS ITS STAGES.\n"
    "  { version: '80.7.11', date: '{{STAMP}}', title: 'A shelf that opens, and a save you can watch', items: [\n"
    "    '[FULL] A playlist, an album and the search work before a single song is imported, so a list can be made and filled from the shelf on its own.',\n"
    "    '[FULL] Saving a song shows its real stages as they happen: finding it, reading it with a live percentage, checking the audio, packing the file.',\n"
    "    '[FULL] The panel closes on the answer, and a failure names the step that failed instead of spinning.'\n"
    "  ]},\n"
)
ENTRY = ENTRY.replace('{{STAMP}}', stamp())
once('the changelog records the release', ANCHOR, ENTRY + ANCHOR)


if failed:
    print('patch-80711: %d applied, %d FAILED' % (len(applied), len(failed)))
    for f in failed:
        print('  x ' + f)
    sys.exit(1)

if CHECK:
    print('patch-80711: pending - %d steps ready to apply' % len(applied))
    sys.exit(1)

with open(INDEX, 'w', encoding='utf-8') as fh:
    fh.write(SRC)
print('patch-80711: %d steps applied, page is %s' % (len(applied), VERSION))
