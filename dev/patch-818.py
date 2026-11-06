#!/usr/bin/env python3
"""81.8 - SideCut: cropping that behaves like a computer, and a speed for one song.

index.html is over 4 MB, so the change ships as a patch script instead of an upload.
Every replacement asserts it matches exactly once: if the page has drifted, this
fails loudly rather than half-applying. Re-running it is a no-op.

Applied by .github/workflows/apply-818.yml, which also proves the page still parses.
"""
import io
import sys

PAGE = 'index.html'
s = io.open(PAGE, encoding='utf-8').read()
if 'scSongSpeed' in s:
    print('81.8 already applied - nothing to do')
    sys.exit(0)


def sub(old, new, label):
    global s
    n = s.count(old)
    if n != 1:
        sys.exit('%s: %d matches (expected exactly 1)' % (label, n))
    s = s.replace(old, new, 1)
    print('ok  ' + label)


# ---- the crop sheet, marked up for a keyboard and a mouse -------------------
sub("""<!-- Crop song modal (trim start/end of the audio file) -->
<div class="modal-backdrop" id="cropSongBackdrop">
  <div class="modal">""",
    """<!-- Crop song modal (trim start/end of the audio file) -->
<div class="modal-backdrop" id="cropSongBackdrop" tabindex="-1">
  <div class="modal" style="max-width:820px;width:min(820px,96vw);">""",
    'wider crop sheet that can hold focus')

sub("""<div style="font-size:12px; color:var(--ink-dim); margin-bottom:6px;">Trim the song by dragging the handles \u2014 everything outside the selection is removed and the song is saved as a new file in your library.</div>""",
    """<div style="font-size:12px; color:var(--ink-dim); margin-bottom:6px;">Drag a handle, type the exact times, or click the waveform to drop the nearest edge there. Arrow keys nudge the edge you last touched (Shift = 1 second), Space previews, Enter saves.</div>""",
    'the sheet says what the new controls do')

sub('width:26px; left:0; margin-left:-13px;', 'width:44px; left:0; margin-left:-22px;',
    'left handle is 44px wide')
sub('width:26px; left:100%; margin-left:-13px;', 'width:44px; left:100%; margin-left:-22px;',
    'right handle is 44px wide')
sub("""      const hw = 13;   // half of a handle's 26px width""",
    """      const hw = 22;   // half of a handle's 44px width""",
    'the selection clamp follows the wider handle')

sub("""        <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-dim); margin-bottom:4px;">
          <span id="cropSongStartLbl"></span>
          <span id="cropSongLenLbl"></span>
          <span id="cropSongEndLbl"></span>
        </div>""",
    """        <div style="display:flex; justify-content:space-between; font-size:11.5px; color:var(--ink-dim); margin-bottom:4px;">
          <span id="cropSongStartLbl"></span>
          <span id="cropSongLenLbl"></span>
          <span id="cropSongEndLbl"></span>
        </div>
        <!-- 81.8 - THE EXACT TIMES, TYPED. Dragging is a fine way to trim on a phone;
             on a computer a pixel is a hundred milliseconds, so both edges are also
             editable to a tenth of a second. -->
        <div id="cropTools" style="display:grid; grid-template-columns:auto 1fr auto auto; gap:8px 10px; align-items:center; margin:10px 0 6px; font-size:12px;"></div>""",
    'the typed-times row')

sub("""  function cropBuildWaveform(){""",
    """  // 81.8 - THE CROP AS A COMPUTER JOB: exact times, a nudge per edge, click-to-place
  // on the waveform, and the keyboard on the sheet itself.
  var cropActiveEdge = 'l';

  function cropClampSel(which, sec){
    if(!cropBuf) return;
    const total = cropBuf.duration || 1;
    const gap = 0.2;
    sec = Math.max(0, Math.min(total, Number(sec) || 0));
    if(which === 'l'){ cropSelStart = Math.min(sec, Math.max(0, cropSelEnd - gap)); cropActiveEdge = 'l'; }
    else { cropSelEnd = Math.max(sec, Math.min(total, cropSelStart + gap)); cropActiveEdge = 'r'; }
    cropUpdateFrame();
  }

  function cropFmtExact(sec){
    sec = Math.max(0, Number(sec) || 0);
    const m = Math.floor(sec / 60), r = sec - m * 60;
    return m + ':' + (r < 10 ? '0' : '') + r.toFixed(1);
  }

  function cropParseExact(txt){
    // "1:23.4" or "83.4" - a plain split, no regular expression needed.
    const parts = String(txt || '').trim().split(':');
    if(parts.length < 1 || parts.length > 2) return null;
    const mins = parts.length === 2 ? Number(parts[0]) : 0;
    const secs = Number(parts[parts.length - 1]);
    if(!isFinite(mins) || !isFinite(secs) || mins < 0 || secs < 0 || secs >= 60) return null;
    return mins * 60 + secs;
  }

  function cropSyncToolInputs(){
    const a = $('cropStartIn'), b = $('cropEndIn');
    if(a && document.activeElement !== a) a.value = cropFmtExact(cropSelStart);
    if(b && document.activeElement !== b) b.value = cropFmtExact(cropSelEnd);
  }

  function cropNudge(which, delta){
    if(!cropBuf) return;
    cropClampSel(which, (which === 'l' ? cropSelStart : cropSelEnd) + delta);
    cropSyncToolInputs();
  }

  function cropWireTools(){
    const host = $('cropTools');
    if(!host) return;
    if(!host.getAttribute('data-built')){
      host.setAttribute('data-built', '1');
      const box = 'padding:7px 9px; border-radius:8px; border:1px solid var(--line); background:var(--bg); color:var(--ink); font-size:12.5px; font-variant-numeric:tabular-nums;';
      const btn = 'padding:7px 10px; border-radius:8px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:12px; cursor:pointer;';
      host.innerHTML =
        '<span style="color:var(--ink-dim);">Start</span>' +
        '<input id="cropStartIn" type="text" inputmode="decimal" spellcheck="false" style="' + box + '">' +
        '<button class="crop-nudge" data-nudge="l-1" title="Start 1s earlier" style="' + btn + '">\u22121s</button>' +
        '<button class="crop-nudge" data-nudge="l1" title="Start 1s later" style="' + btn + '">+1s</button>' +
        '<span style="color:var(--ink-dim);">End</span>' +
        '<input id="cropEndIn" type="text" inputmode="decimal" spellcheck="false" style="' + box + '">' +
        '<button class="crop-nudge" data-nudge="r-1" title="End 1s earlier" style="' + btn + '">\u22121s</button>' +
        '<button class="crop-nudge" data-nudge="r1" title="End 1s later" style="' + btn + '">+1s</button>';
      Array.prototype.forEach.call(host.querySelectorAll('.crop-nudge'), function(b){
        b.addEventListener('click', function(){
          const v = b.getAttribute('data-nudge') || '';
          cropNudge(v.charAt(0), Number(v.slice(1)) || 0);
        });
      });
      const si = $('cropStartIn'), ei = $('cropEndIn');
      function commit(el, which){
        const v = cropParseExact(el ? el.value : '');
        if(v == null){ cropSyncToolInputs(); toast('Type a time like 1:23.4'); return; }
        cropClampSel(which, v);
        cropSyncToolInputs();
      }
      [[si, 'l'], [ei, 'r']].forEach(function(pair){
        const el = pair[0], which = pair[1];
        if(!el) return;
        el.addEventListener('change', function(){ commit(el, which); });
        el.addEventListener('keydown', function(e){ if(e.key === 'Enter'){ e.preventDefault(); commit(el, which); } });
        el.addEventListener('focus', function(){ cropActiveEdge = which; });
      });
    }
    cropSyncToolInputs();
    const wave = $('cropSongWave');
    if(wave && !wave.getAttribute('data-clickplace')){
      wave.setAttribute('data-clickplace', '1');
      wave.addEventListener('pointerdown', function(e){
        if(!cropBuf) return;
        if(e.target && e.target.closest && e.target.closest('#cropSongSelEdgeL, #cropSongSelEdgeR')) return;
        const r = wave.getBoundingClientRect();
        if(!r || !r.width) return;
        const frac = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
        const sec = frac * (cropBuf.duration || 1);
        cropClampSel(Math.abs(sec - cropSelStart) <= Math.abs(sec - cropSelEnd) ? 'l' : 'r', sec);
        cropSyncToolInputs();
      });
    }
    const back = $('cropSongBackdrop');
    if(back && !back.getAttribute('data-keys')){
      back.setAttribute('data-keys', '1');
      back.addEventListener('keydown', function(e){
        const tag = (e.target && e.target.tagName) || '';
        if(tag === 'INPUT' && e.key !== 'Enter' && e.key !== 'Escape') return;
        const step = e.shiftKey ? 1 : 0.1;
        if(e.key === 'ArrowLeft' || e.key === 'ArrowRight'){
          e.preventDefault(); cropNudge(cropActiveEdge, e.key === 'ArrowLeft' ? -step : step);
        } else if(e.key === ' '){
          e.preventDefault(); const pv = $('cropSongPreviewPlay'); if(pv) pv.click();
        } else if(e.key === 'Enter'){
          const ap = $('cropSongApply');
          if(ap && ap.style.display !== 'none'){ e.preventDefault(); ap.click(); }
        } else if(e.key === 'Escape'){
          const c = $('cropSongCancel'); if(c){ e.preventDefault(); c.click(); }
        } else if(e.key === 'Home'){
          e.preventDefault(); cropClampSel('l', 0); cropSyncToolInputs();
        } else if(e.key === 'End'){
          e.preventDefault(); cropClampSel('r', cropBuf ? cropBuf.duration : 0); cropSyncToolInputs();
        }
      });
      try{ back.focus({ preventScroll: true }); }catch(_eF){}
    }
  }

  function cropBuildWaveform(){""",
    'the crop tools themselves')

sub("""      cropBuildWaveform();
      cropUpdateFrame();""",
    """      cropBuildWaveform();
      cropUpdateFrame();
      cropWireTools();""",
    'the tools open with the sheet')


# ---- a speed that belongs to one song ---------------------------------------
sub('  function playCurrent(hardSwitch){',
    """  // 81.8 - EVERY SONG KEEPS ITS OWN SPEED. A podcast at 1.5x, a drill at 0.8x, the
  // rest untouched: the rate belongs to the song rather than to the player, so the
  // tempo a song was set to is the tempo it comes back at. It rides on top of the
  // global speed and the Studio rate instead of replacing either, so a song left at
  // 1x behaves exactly as it did before.
  var scSpeedMap = (function(){
    try{ return JSON.parse(localStorage.getItem('sidecut.song.speed') || '{}') || {}; }catch(_eS){ return {}; }
  })();
  var SC_SPEED_MIN = 0.25, SC_SPEED_MAX = 3;

  function scSongSpeed(id){
    var v = Number(scSpeedMap[String(id || '')]);
    return (v >= SC_SPEED_MIN && v <= SC_SPEED_MAX) ? v : 1;
  }
  function scSpeedSave(){ try{ localStorage.setItem('sidecut.song.speed', JSON.stringify(scSpeedMap)); }catch(_eS){} }
  function scSpeedFor(id){
    return playbackSpeed * (typeof window.__scStudioRate === 'function' ? window.__scStudioRate() : 1) * scSongSpeed(id);
  }
  function scSpeedPlayingId(){
    return (queueIndex >= 0 && queue && queue[queueIndex]) ? queue[queueIndex] : '';
  }
  function scSpeedRelabel(){
    var chip = document.getElementById('scSpeedChip');
    if(!chip) return;
    var r = scSongSpeed(scSpeedPlayingId());
    chip.textContent = (Math.round(r * 100) / 100) + 'x';
    chip.title = 'Speed for this song \u2014 tap to change, shift-tap to reset';
    chip.style.color = (r === 1) ? '' : 'var(--coral)';
  }
  function scSpeedSet(id, rate){
    if(id == null || id === '') return 1;
    rate = Math.round(Math.max(SC_SPEED_MIN, Math.min(SC_SPEED_MAX, Number(rate) || 1)) * 100) / 100;
    var key = String(id);
    if(Math.abs(rate - 1) < 0.001) delete scSpeedMap[key]; else scSpeedMap[key] = rate;
    scSpeedSave();
    try{
      if(scSpeedPlayingId() === key){
        var a = activeAudio();
        if(a && a.src) a.playbackRate = scSpeedFor(key);
      }
    }catch(_eLive){}
    scSpeedRelabel();
    return rate;
  }
  function scSpeedChipAttach(){
    if(document.getElementById('scSpeedChip')){ scSpeedRelabel(); return; }
    var bar = document.getElementById('nowPlaying');
    if(!bar) return;
    var chip = document.createElement('button');
    chip.id = 'scSpeedChip';
    chip.type = 'button';
    chip.style.cssText = 'padding:5px 9px; border-radius:999px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink-dim); font-size:11px; font-weight:600; cursor:pointer; font-variant-numeric:tabular-nums; flex:0 0 auto;';
    chip.addEventListener('click', function(e){
      var id = scSpeedPlayingId();
      if(!id){ toast('Play a song first.'); return; }
      if(e.shiftKey){ scSpeedSet(id, 1); toast('Speed back to 1x'); return; }
      var steps = [1, 1.25, 1.5, 2, 0.75, 0.5], cur = scSongSpeed(id), next = steps[0];
      for(var i = 0; i < steps.length; i++){ if(steps[i] > cur + 0.001){ next = steps[i]; break; } }
      toast('This song: ' + scSpeedSet(id, next) + 'x');
    });
    bar.appendChild(chip);
    scSpeedRelabel();
  }
  // The rack entry: the same control with every rate shown, for the song you opened.
  function scSpeedAttachSheet(t){
    var body = document.getElementById('scSheetBody');
    if(!body || !t) return;
    var id = t.id;
    var host = document.createElement('div');
    host.style.cssText = 'margin-top:12px; padding-top:12px; border-top:1px solid var(--line);';
    var rates = [0.5, 0.75, 0.9, 1, 1.1, 1.25, 1.5, 2];
    function paint(){
      var cur = scSongSpeed(id);
      var btn = 'padding:5px 10px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink);font-size:12px;cursor:pointer;';
      host.innerHTML =
        '<div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">' +
          '<span style="font-size:12px; font-weight:600;">Speed</span>' +
          '<span style="font-size:12px; color:var(--coral); font-variant-numeric:tabular-nums;">' + cur + 'x</span>' +
          '<span style="flex:1;"></span>' +
          '<button id="scSpeedMinus" style="' + btn + '">\u2212</button>' +
          '<button id="scSpeedPlus" style="' + btn + '">+</button>' +
        '</div>' +
        '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
          rates.map(function(r){
            var on = Math.abs(r - cur) < 0.001;
            return '<button data-rate="' + r + '" style="padding:5px 10px;border-radius:999px;border:1px solid ' + (on ? 'var(--coral)' : 'var(--line)') + ';background:' + (on ? 'var(--coral)' : 'none') + ';color:' + (on ? 'var(--on-coral,#fff)' : 'var(--ink-dim)') + ';font-size:11.5px;cursor:pointer;">' + r + 'x</button>';
          }).join('') +
        '</div>' +
        '<div style="font-size:10.5px; color:var(--ink-dim); margin-top:6px; line-height:1.5;">Only this song, and the pitch is kept \u2014 a faster song is not a chipmunk one. It comes back at this speed next time.</div>';
      Array.prototype.forEach.call(host.querySelectorAll('[data-rate]'), function(b){
        b.addEventListener('click', function(){ scSpeedSet(id, Number(b.getAttribute('data-rate'))); paint(); });
      });
      var mi = host.querySelector('#scSpeedMinus'), pl = host.querySelector('#scSpeedPlus');
      if(mi) mi.addEventListener('click', function(){ scSpeedSet(id, scSongSpeed(id) - 0.05); paint(); });
      if(pl) pl.addEventListener('click', function(){ scSpeedSet(id, scSongSpeed(id) + 0.05); paint(); });
    }
    paint();
    body.appendChild(host);
    scSpeedChipAttach();
    scSpeedRelabel();
  }

  function playCurrent(hardSwitch){""",
    'the per-song speed module')

sub("""    a.volume = 1;
    a.playbackRate = playbackSpeed * (typeof window.__scStudioRate === 'function' ? window.__scStudioRate() : 1);""",
    """    a.volume = 1;
    a.playbackRate = scSpeedFor(t.id);   // 81.8 - this song's own speed rides on top""",
    'a fresh song plays at its own speed')

sub("""    nxt.volume = 0;
    nxt.playbackRate = playbackSpeed * (typeof window.__scStudioRate === 'function' ? window.__scStudioRate() : 1);""",
    """    nxt.volume = 0;
    nxt.playbackRate = scSpeedFor(nextTrack.id);   // 81.8 - the incoming song brings its own""",
    'a blended song brings its own speed')

sub("""    scStreamQuiet();
    $('nowPlaying').style.display = 'flex';""",
    """    scStreamQuiet();
    try{ scSpeedChipAttach(); scSpeedRelabel(); }catch(_eChip){}   // 81.8
    $('nowPlaying').style.display = 'flex';""",
    'the speed chip follows the song')

sub("    openSheet('Edit rack', editSheetHtml());",
    """    openSheet('Edit rack', editSheetHtml());
    try{ scSpeedAttachSheet(t); }catch(_eSheet){}   // 81.8 - the song's own speed""",
    'the rack gains the speed control')

io.open(PAGE, 'w', encoding='utf-8').write(s)
print('81.8 written to ' + PAGE)
