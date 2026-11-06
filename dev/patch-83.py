#!/usr/bin/env python3
"""83 - the speed belongs to the song, in the song's settings, and the mixes carry it.

WHAT THE OWNER SAID. "why is the stupid thing to increase speed there it should be in song settings
and it should be like only for that song and also apply for when you download mixes ... change both
versions".

WHAT WAS WRONG. 81.8 put a rate per song in `sidecut.song.speed` and drew two controls for it: a chip
on the now bar, and a rate row inside the Studio sheet. The song's own ··· menu - the place people
call the song's settings - still carried the OLD slider, wired to `setPlaybackSpeed`, which moves the
whole player: set it there and every song changed. So the one control in the obvious place was the
one that was not per song, and the one that was per song sat on the now bar.

WHAT 83 DOES.
  - The song ··· sheet's slider now writes THAT SONG's rate (`scSpeedSet(t.id, …)`), says "this song
    only", and carries a Reset. Nothing there touches `playbackSpeed`.
  - The now-bar chip is gone; `scSpeedChipAttach` removes any chip an older page left behind.
  - `setPlaybackSpeed` no longer repaints that slider (it belongs to the song now) and applies the
    playing song's own rate through `scSpeedFor`, so a song keeps its speed when the global changes.
  - "Download crossfaded mix" applies each song's rate while decoding, with the pitch kept:
    `scStretchBuffer` is an overlap-add stretch (WSOLA) - the offline twin of the element's
    preservesPitch. A mix of songs left at 1x renders byte for byte as before.
  - 83 names itself in APP_VERSION, the changelog and the service worker cache, so both builds (the
    full APK and the store build from the same page) take it.

THIS FILE EDITS THE PAGE AND THE SERVICE WORKER ONLY. The prose that lands in AGENTS.md is
dev/release-entry.md, because release.yml's commit may not carry a path outside dev/, ota/,
ota-play/, index.html, sw.js, manifest.json, updates.json and AGENTS.md - PATCH_NOTES.md written
here would have failed the release at its last step.

    python3 dev/patch-83.py           apply (idempotent - a second run is a no-op)
    python3 dev/patch-83.py --check   0 when the page already says 83, 1 when it does not
"""
import io
import re
import sys

PAGE = 'index.html'
SW = 'sw.js'
VERSION = '83'
OLD = '82'

ENTRY = """  // 83 - THE SPEED IS THE SONG'S, IN THE SONG'S SETTINGS, AND THE MIXES CARRY IT.
  { version: '83', date: 'November 6, 2026 · 9:40 PM EST', title: 'The speed sits in the song\\'s settings, and the mixes keep it', items: [
    '[FULL] The speed is in the song\\u2019s own settings now, where the rest of that song\\u2019s options are - a slider from 0.5x to 2x with a Reset beside it, and it says so: this song only.',
    '[FULL] It never was the whole player\\u2019s. That slider used to move every song at once; it now writes the rate to the song you opened and to nothing else, and the speed chip that sat on the now bar is gone.',
    '[FULL] Download crossfaded mix keeps it: each song is stretched by its own rate before the blend, so a mix of songs you sped up sounds the way they sound in the app, with the pitch left alone.',
    '[FULL] A song left at 1x makes exactly the mix it made before, and the Studio rate still stacks on top.'
  ]},
"""

SONG_OLD = """    const speedWrap = document.createElement('div');
    speedWrap.style.cssText = 'padding:2px 4px 6px;';
    const speedLabel = playbackSpeed.toFixed(2).replace(/0$/,'').replace(/\\.$/,'') + 'x';
    speedWrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; font-size:12.5px; color:var(--ink-dim); margin-bottom:6px;">
        <span>Playback speed</span><span id="actionSpeedValue">${speedLabel}</span>
      </div>
      <input type="range" id="actionSpeedSlider" min="0.5" max="2" step="0.05" value="${playbackSpeed}" style="width:100%;">
    `;
    list.appendChild(speedWrap);
    speedWrap.querySelector('#actionSpeedSlider').addEventListener('input', (e) => setPlaybackSpeed(parseFloat(e.target.value)));
"""

SONG_NEW = """    // 83 - THE SPEED IS THIS SONG'S, HERE IN ITS SETTINGS. Before 83 this slider called
    // setPlaybackSpeed, which is the whole player's rate: set 1.5x on one song and every
    // song played fast. It now writes sidecut.song.speed for the song that was opened, so
    // the control in the obvious place is the per-song one - and the chip that used to sit
    // on the now bar, where a rate can be neither seen in context nor reset, is gone.
    const speedWrap = document.createElement('div');
    speedWrap.style.cssText = 'padding:2px 4px 6px;';
    function scSpeedPaintSheet(){
      const rate = scSongSpeed(t.id);
      const sl = speedWrap.querySelector('#actionSpeedSlider');
      const val = speedWrap.querySelector('#actionSpeedValue');
      if(val) val.textContent = (Math.round(rate * 100) / 100) + 'x';
      if(sl){
        sl.value = rate;
        const lo = parseFloat(sl.min) || 0.5, hi = parseFloat(sl.max) || 2;
        sl.style.setProperty('--speed-fill', Math.max(0, Math.min(100, ((rate - lo) / (hi - lo)) * 100)) + '%');
      }
      const reset = speedWrap.querySelector('#actionSpeedReset');
      if(reset) reset.style.display = (Math.abs(rate - 1) < 0.001) ? 'none' : 'inline-block';
    }
    speedWrap.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline; font-size:12.5px; color:var(--ink-dim); margin-bottom:6px;">
        <span>Speed <span style="opacity:0.7;">· this song only</span></span>
        <span style="display:inline-flex; align-items:baseline;"><span id="actionSpeedValue" style="color:var(--ink); font-variant-numeric:tabular-nums;"></span><button id="actionSpeedReset" type="button" style="background:none; border:0; color:var(--coral); font-size:12px; cursor:pointer; padding:0 0 0 10px; display:none;">Reset</button></span>
      </div>
      <input type="range" id="actionSpeedSlider" min="0.5" max="2" step="0.05" style="width:100%;">
      <div style="font-size:10.5px; color:var(--ink-dim); margin-top:6px; line-height:1.5;">The pitch stays put, this song comes back at this speed, and every other song keeps its own.</div>
    `;
    list.appendChild(speedWrap);
    speedWrap.querySelector('#actionSpeedSlider').addEventListener('input', (e) => {
      scSpeedSet(t.id, parseFloat(e.target.value));
      scSpeedPaintSheet();
    });
    (function(){
      const reset = speedWrap.querySelector('#actionSpeedReset');
      if(reset) reset.addEventListener('click', function(){ scSpeedSet(t.id, 1); scSpeedPaintSheet(); toast('This song is back to 1x'); });
    })();
    scSpeedPaintSheet();
"""

CHIP_OLD_PAT = r"  function scSpeedChipAttach\(\)\{.*?\n  \}\n(?=  // The rack entry)"

CHIP_NEW = """  // 83 - NOTHING ON THE NOW BAR. The chip was a rate you could step from the player, in
  // a bar that shows no other per-song setting, so it read as the player's speed rather
  // than the song's. The control lives in the song's settings now; this removes the chip
  // an older page may have left in the bar and otherwise does nothing.
  function scSpeedChipAttach(){
    var stale = document.getElementById('scSpeedChip');
    if(stale && stale.parentNode) stale.parentNode.removeChild(stale);
  }
"""

STRETCH = """  // 83 - THE OFFLINE TWIN OF preservesPitch. A playing song is rate-shifted by the audio
  // element, which keeps the pitch; a mix is built from decoded buffers, where slowing or
  // speeding a buffer the naive way (playing it faster) raises or lowers the pitch with it.
  // This stretches the buffer in time without touching its spectrum: grains of ~46ms are
  // copied apart at the ratio asked for, and each grain is placed where it lines up best
  // with the one before it (WSOLA), then cross-faded in with a Hann window. A rate of 1 is
  // returned untouched, so a mix of untouched songs is built exactly as it was before.
  function scStretchBuffer(ctx, buf, rate){
    rate = Math.max(0.5, Math.min(2, Number(rate) || 1));
    if(!ctx || !buf || Math.abs(rate - 1) < 0.001) return buf;
    try{
      var sr = buf.sampleRate, ch = Math.max(1, Math.min(2, buf.numberOfChannels || 1));
      var N = Math.max(512, Math.round(sr * 0.046));         // one grain, ~46ms
      var Ho = Math.round(N / 2);                            // output hop (50% overlap)
      var Hs = Math.max(1, Math.round(Ho * rate));           // input consumed per output hop
      var tol = Math.round(N / 4);                           // how far a grain may be nudged
      var outLen = Math.max(1, Math.round(buf.length / rate));
      var out = ctx.createBuffer(ch, outLen, sr);
      var win = new Float32Array(N);
      for(var i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N);
      var inL = buf.getChannelData(0);
      var inR = ch > 1 ? buf.getChannelData(1) : inL;
      var outL = out.getChannelData(0);
      var outR = ch > 1 ? out.getChannelData(1) : outL;
      var read = 0, write = 0, prev = -1, len = inL.length;
      while(write < outLen && read < len){
        var pos = read;
        if(prev >= 0){
          // Continue what was already written: the tail of the last grain predicts where
          // this one should start, and the best match near `read` is where it starts.
          var want = prev + Ho, best = 0, bestScore = -Infinity;
          for(var d = -tol; d <= tol; d += 8){
            var cand = read + d;
            if(cand < 0 || cand + Ho >= len || want + Ho >= len) continue;
            var score = 0;
            for(var k = 0; k < Ho; k += 8) score += inL[cand + k] * inL[want + k];
            if(score > bestScore){ bestScore = score; best = d; }
          }
          pos = Math.max(0, Math.min(len - 1, read + best));
        }
        for(var j = 0; j < N; j++){
          var s = pos + j, o = write + j;
          if(o >= outLen || s >= len) break;
          var g = win[j];
          outL[o] += inL[s] * g;
          if(outR !== outL) outR[o] += inR[s] * g;
        }
        prev = pos;
        read += Hs;
        write += Ho;
      }
      return out;
    }catch(_eStretch){
      return buf;   // never lose a song to the stretch: it plays at its own rate instead
    }
  }
"""

SPEEDFN_OLD = """    activeAudio().playbackRate = playbackSpeed * (typeof window.__scStudioRate === 'function' ? window.__scStudioRate() : 1);
    const label = playbackSpeed.toFixed(2).replace(/0$/,'').replace(/\\.$/,'') + 'x';
    const actionSlider = document.getElementById('actionSpeedSlider');
    if(actionSlider){
      actionSlider.value = playbackSpeed;
      document.getElementById('actionSpeedValue').textContent = label;
      // Drive the rounded track's filled portion so it follows the thumb.
      const min = parseFloat(actionSlider.min) || 0.5;
      const max = parseFloat(actionSlider.max) || 2;
      const pct = Math.max(0, Math.min(100, ((playbackSpeed - min) / (max - min)) * 100));
      actionSlider.style.setProperty('--speed-fill', pct + '%');
    }
  }"""

SPEEDFN_NEW = """    // 83 - the global rate no longer paints the song sheet's slider: that slider is the
    // song's own rate now, and this function moving it would show one song's speed as
    // another's. The rate a song actually plays at is scSpeedFor, which stacks the global
    // rate, the Studio rate and the song's own, in that order.
    activeAudio().playbackRate = scSpeedFor(scSpeedPlayingId());
  }"""

DECODE_OLD = """        const buf = await decCtx.decodeAudioData(arrBuf);
        decoded[idx] = buf;
        decodedCount++;"""

DECODE_NEW = """        const buf = await decCtx.decodeAudioData(arrBuf);
        // 83 - the mix carries this song's speed. scStretchBuffer keeps the pitch, so a
        // song sped up here sounds the way it sounds in the player; 1x is returned as is.
        const _rate = scSongSpeed(t.id);
        decoded[idx] = (Math.abs(_rate - 1) < 0.001) ? buf : scStretchBuffer(decCtx, buf, _rate);
        decodedCount++;"""


def applied(text):
    return ("const APP_VERSION = '" + VERSION + "';") in text and ("version: '" + VERSION + "'") in text


def main():
    text = io.open(PAGE, encoding='utf-8').read()
    if '--check' in sys.argv:
        print('applied' if applied(text) else 'pending')
        return 0 if applied(text) else 1
    if applied(text):
        print('83 is already on the page - nothing to do')
        return 0

    old_const = "const APP_VERSION = '" + OLD + "';"
    if text.count(old_const) != 1:
        sys.exit('APP_VERSION: %d matches for %r (expected 1)' % (text.count(old_const), old_const))
    text = text.replace(old_const, "const APP_VERSION = '" + VERSION + "';", 1)
    print('ok  APP_VERSION 82 -> 83')

    anchor = "  { version: '82',"
    if text.count(anchor) != 1:
        sys.exit('changelog anchor: %d matches (expected 1)' % text.count(anchor))
    text = text.replace(anchor, ENTRY + anchor, 1)
    print('ok  changelog entry for 83')

    if text.count(SONG_OLD) != 1:
        sys.exit('song-settings speed block: %d matches (expected 1)' % text.count(SONG_OLD))
    text = text.replace(SONG_OLD, SONG_NEW, 1)
    print("ok  the song sheet slider writes this song's rate")

    text, n = re.subn(CHIP_OLD_PAT, CHIP_NEW, text, count=1, flags=re.S)
    if n != 1:
        sys.exit('scSpeedChipAttach: could not be replaced')
    print('ok  no chip on the now bar')

    rack = "  // The rack entry: the same control with every rate shown, for the song you opened."
    if text.count(rack) != 1:
        sys.exit('rack anchor: %d matches (expected 1)' % text.count(rack))
    text = text.replace(rack, STRETCH + rack, 1)
    print('ok  scStretchBuffer added beside the speed module')

    if text.count(SPEEDFN_OLD) != 1:
        sys.exit('setPlaybackSpeed body: %d matches (expected 1)' % text.count(SPEEDFN_OLD))
    text = text.replace(SPEEDFN_OLD, SPEEDFN_NEW, 1)
    print("ok  setPlaybackSpeed applies the song's own rate and leaves the sheet alone")

    if text.count(DECODE_OLD) != 1:
        sys.exit('mix decode block: %d matches (expected 1)' % text.count(DECODE_OLD))
    text = text.replace(DECODE_OLD, DECODE_NEW, 1)
    print('ok  the crossfaded mix stretches each song by its own rate')

    io.open(PAGE, 'w', encoding='utf-8').write(text)

    sw = io.open(SW, encoding='utf-8').read()
    sw2, n = re.subn(r"const CACHE_NAME = '[^']*';", "const CACHE_NAME = 'sidecut-shell-v83';", sw, count=1)
    if n != 1:
        sys.exit('CACHE_NAME: could not be found in sw.js')
    io.open(SW, 'w', encoding='utf-8').write(sw2)
    print('ok  service worker cache named v83')
    return 0


if __name__ == '__main__':
    sys.exit(main())
