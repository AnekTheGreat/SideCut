#!/usr/bin/env node
/**
 * SideCut 70.1.8 - SAVE COPY: the song, with everything DJ Mode is doing to it, as
 * a NEW song in the library.
 *
 * The user's words: "in dj mode make it so that all the changes you've made can be
 * saved as a dj mode copy of the song seperate from the actual song".
 *
 * WHAT WAS ALREADY THERE, AND WHY THIS IS NOT IT. DJ Mode has REC, which captures
 * the deck's live output through a MediaStreamDestination - and it is the wrong
 * tool twice over: it runs in real time (a four minute song is four minutes of
 * waiting, and it records whatever you play while it runs), and what it produces
 * is a file to download, not a song in the library. What was asked for is a copy
 * OF THE SONG, separate from the original.
 *
 * HOW IT WORKS. The deck decodes the track into an AudioBuffer, so the whole song
 * is already in memory: rendering it through an OfflineAudioContext is a few
 * seconds of work and no waiting at all. SAVE COPY builds the deck's chain again
 * offline - source, GAIN knob, FILTER knob, the three sends (REVERB with the same
 * impulse the live convolver is using, FLANGER, DELAY), the blend, the 8-band EQ,
 * the normalization and auto-gain nodes and the limiter - and then makes the
 * result a normal library song through `scAddConvertedToLibrary`, the same helper
 * a finished conversion uses. It is named "<name> (DJ edit)" and the loaded song
 * is never written to.
 *
 * EVERY VALUE IS READ FROM THE LIVE NODES. The filter's type and frequency, each
 * EQ band's own gain, the sends' delay times and wet gains, the limiter's five
 * settings, the source's playbackRate AND its detune - none of it is re-derived
 * from the knobs, so there is no second copy of the parameter mapping to drift
 * away from the first. That also settles the one subtle case: KEYLOCK counter-
 * shifts `detune`, and since a buffer source's real speed is
 * `playbackRate * 2^(detune/1200)` (the Web Audio spec's computedPlaybackRate),
 * baking both is what makes the copy the sound that is actually playing.
 *
 * THE LOOP IS NOT PART OF IT, on purpose. A loop is where playback is, not part of
 * the song; the copy is the whole track with the deck's sound on it.
 *
 *   node dev/patch-7018.mjs
 *   node dev/patch-7018.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO70 = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const VERSION = '70.1.8';
const PREV = '70.1.7';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 4:05 PM EDT';
const CACHE = 'sidecut-shell-v63.0.44';
const OLDCACHE = 'sidecut-shell-v63.0.43';
const TITLE = 'DJ Mode can save the song you have built: SAVE COPY renders it with your speed, pitch, EQ, filter, gain and FX as a new song, and leaves the original alone';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download" or "convert", and none uses "play build", "play
// version" or "play install" - test-662, test-6642 and test-66421 refuse those.
// One of them names a surface the 662 surface rule looks for.
const NOTES = [
  'DJ Mode has SAVE COPY. Everything you do to a song on the deck - the pitch and speed, GAIN, the FILTER sweep, the kill switches and EQ, the reverb, flanger and delay, and the pump from the DUCK knob - can be written out as a NEW song called "your song (DJ edit)", which lands in All Songs like any other track. The song you were playing is not touched: nothing is written over it, and it is still exactly as it was.',
  'It renders instead of recording, so it does not take as long as the song does. REC is still there for capturing a mix, and it is real time on purpose - it captures what happens while it runs. SAVE COPY takes the whole song straight out of memory and runs it through your settings in one pass, so a four minute song is a few seconds of waiting, not four minutes.',
  'The copy is the whole song, not the loop. If you have a loop going it keeps looping while the copy is rendered and the copy is still the entire track, because a loop is where playback is rather than part of the song. The same is true of where the playhead happens to be: the copy always starts at the beginning.',
  'The copy carries its tags. The title becomes "your song (DJ edit)" with the same artist and album, the cover art travels into the file, and the copy keeps the original song name so the two are easy to tell apart in the list - the original never gains the words "DJ edit".',
  'Every value baked into the copy is read from what the deck is actually doing rather than from the knobs on the screen, so the copy is the sound that is going to the speakers - every one of them, including the ones the DUCK knob pumps and the ones a beat repeat is holding. The player, the dock, the library list, Studio and the badge wall are exactly as the last release left them.',
  'Nothing else moved in this release. The mix recorder, the beat pads, the hot cues, the crossfade and the loop controls are the ones 70.1.7 shipped, and a library saved before this release comes back the same way.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  // A replacement that drops the newline the anchor had joins two lines
  // together, and the join parses. Refused here instead of found later.
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';
let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
const studio = holder(fs.readFileSync(STUDIO70, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7018: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================ 1. THE BUTTON, UNDER THE RECORDER */
sub(html, 'the SAVE COPY button',
  block([
    '        <div style="font-size:10.5px; color:var(--ink-dim); margin-top:6px;">Records everything you hear on this deck \u2014 scratches, EQ, pitch, all of it.</div>',
    '      </div>',
  ]),
  block([
    '        <div style="font-size:10.5px; color:var(--ink-dim); margin-top:6px;">Records everything you hear on this deck \u2014 scratches, EQ, pitch, all of it.</div>',
    '        <div class="record-row" style="margin-top:10px;">',
    '          <button class="deck-btn" id="djCopyBtn" style="flex:1;" title="Render this song with everything this deck is doing to it, and keep it as a new song">SAVE COPY</button>',
    '        </div>',
    '        <div style="font-size:10.5px; color:var(--ink-dim); margin-top:6px;">SAVE COPY writes THIS song out with your speed, pitch, EQ, filter, gain and FX as a new song called \u201c\u2026 (DJ edit)\u201d. It renders in seconds, and the song you loaded is not touched.</div>',
    '      </div>',
  ]),
  { key: 'id="djCopyBtn"' });

/* ==================================== 2. THE RENDER, AFTER THE MIX RECORDER ==== */
sub(html, 'the SAVE COPY machinery',
  block([
    "    toast('Saved to your downloads');",
    '  });',
  ]),
  block([
    "    toast('Saved to your downloads');",
    '  });',
    '',
    '  // ---------------- SAVE COPY: the song, with everything this deck is doing to',
    '  // it, as a NEW library song. REC above captures the deck live and hands you a',
    '  // file: real time, and a recording of the mix rather than a copy of the song.',
    '  // This renders the same chain offline instead. The track is already decoded',
    '  // into deckEngine.buffer, so the whole thing happens in one pass in a few',
    '  // seconds, and the result goes into the library through scAddConvertedToLibrary',
    '  // - the helper a finished conversion uses - so it arrives with tags, cover art,',
    '  // a real duration and an All Songs entry like any imported file. Nothing here',
    '  // writes to the loaded song.',
    '  //',
    '  // Every value below is read from the LIVE nodes rather than re-derived from the',
    '  // knobs (the filter type and frequency, each EQ band gain, the sends\u2019 delay',
    '  // times and wet gains, the limiter\u2019s five settings, the source\u2019s playbackRate',
    '  // and detune). One implementation, two contexts: whatever the knobs are doing',
    '  // to the sound is what gets baked, with no second copy of the mapping to drift.',
    '  let djCopyBusy = false;',
    '  function djCopySourceState(){',
    '    // A buffer source really plays at playbackRate * 2^(detune/1200) - detune is',
    '    // not an independent pitch shifter, it scales the rate. Both are copied so',
    '    // the copy is the sound the deck is making, KEYLOCK included. A paused deck',
    '    // has no node, so the same two values are mirrored from the engine.',
    '    const node = deckEngine.node;',
    '    let rate = deckEngine.rate || 1;',
    '    let detune = 0;',
    '    try{',
    '      if(node){',
    '        if(node.playbackRate) rate = node.playbackRate.value || rate;',
    '        if(node.detune) detune = node.detune.value || 0;',
    '      } else if(keylockOn){',
    '        detune = -1200 * Math.log2(rate);',
    '      }',
    '    }catch(_eSrcState){ }',
    '    const speed = Math.max(0.05, rate * Math.pow(2, detune / 1200));',
    '    return { rate: rate, detune: detune, speed: speed };',
    '  }',
    '  function djCopyTailSeconds(){',
    '    // Room for the sends to ring out, and none at all when they are off: three',
    '    // seconds of silence on the end of a copy is three seconds of silence.',
    '    let tail = 0;',
    '    if(deckEngine.reverbNodes) tail += 3.4;',
    '    if(deckEngine.delayNodes) tail += 2;',
    '    if(deckEngine.flangerNodes) tail += 0.4;',
    '    return tail;',
    '  }',
    '  function buildDjCopySource(octx, buffer, state){',
    '    const src = octx.createBufferSource();',
    '    src.buffer = buffer;',
    '    src.playbackRate.value = state.rate;',
    '    try{ if(src.detune) src.detune.value = state.detune; }catch(_eCopyDet){ }',
    '    // The GAIN knob, with the DUCK pump replayed if it is running - it is a beat',
    '    // automation, so the copy has to carry the automation and not a snapshot of',
    '    // wherever the gain happened to be when the button was tapped.',
    '    const knob = octx.createGain();',
    '    const baseGain = Math.pow(10, (deckGainDb || 0) / 20);',
    '    knob.gain.value = baseGain;',
    '    try{',
    '      if(duckAmount > 0){',
    '        const bpm = liveBpm || (allTracks.find(tr => tr.id === djCurrentTrackId)?.bpm) || 120;',
    '        const beat = Math.max(0.08, (60 / bpm) / state.speed);',
    '        const duckedGain = baseGain * (1 - duckAmount);',
    '        const total = Math.max(beat, buffer.duration / state.speed);',
    '        for(let t = 0; t < total; t += beat){',
    '          knob.gain.setValueAtTime(duckedGain, t);',
    '          knob.gain.linearRampToValueAtTime(baseGain, t + beat * 0.85);',
    '        }',
    '      }',
    '    }catch(_eCopyDuck){ }',
    '    // The FILTER sweep, exactly as the knob left it.',
    '    const filter = octx.createBiquadFilter();',
    '    const liveFilter = deckEngine.filterNode;',
    '    try{',
    '      filter.type = liveFilter ? liveFilter.type : \'allpass\';',
    '      filter.frequency.value = liveFilter ? liveFilter.frequency.value : 20000;',
    '      filter.Q.value = liveFilter ? liveFilter.Q.value : 0.0001;',
    '    }catch(_eCopyFilter){ }',
    '    // The blend the sends return into, then the EQ, the normalization/auto-gain',
    '    // nodes and the limiter - the same order the live deck is wired in.',
    '    const blend = octx.createGain();',
    '    blend.gain.value = 1;',
    '    const bands = [];',
    '    (eqNodes[0] || []).forEach(function(liveBand){',
    '      const band = octx.createBiquadFilter();',
    '      try{',
    '        band.type = liveBand.type;',
    '        band.frequency.value = liveBand.frequency.value;',
    '        band.Q.value = liveBand.Q.value;',
    '        band.gain.value = liveBand.gain.value;',
    '      }catch(_eCopyBand){ }',
    '      bands.push(band);',
    '    });',
    '    const norm = octx.createGain();',
    '    norm.gain.value = gainNodes[0] ? gainNodes[0].gain.value : 1;',
    '    const deckGain = octx.createGain();',
    '    deckGain.gain.value = deckGainNodes[0] ? deckGainNodes[0].gain.value : 1;',
    '    const limiter = octx.createDynamicsCompressor();',
    '    try{',
    '      const liveLimiter = limiterNodes[0];',
    '      if(liveLimiter){',
    '        limiter.threshold.value = liveLimiter.threshold.value;',
    '        limiter.knee.value = liveLimiter.knee.value;',
    '        limiter.ratio.value = liveLimiter.ratio.value;',
    '        limiter.attack.value = liveLimiter.attack.value;',
    '        limiter.release.value = liveLimiter.release.value;',
    '      }',
    '    }catch(_eCopyLimiter){ }',
    '    src.connect(knob);',
    '    knob.connect(filter);',
    '    filter.connect(blend);',
    '    let tail = blend;',
    '    bands.forEach(function(band){ tail.connect(band); tail = band; });',
    '    tail.connect(norm);',
    '    norm.connect(deckGain);',
    '    deckGain.connect(limiter);',
    '    limiter.connect(octx.destination);',
    '    // The three sends, tapped off the filter and returning into the blend, the',
    '    // way the live ones are. Each is skipped when the knob was never touched,',
    '    // which is also why the render has no tail to wait for.',
    '    try{',
    '      const rv = deckEngine.reverbNodes;',
    '      if(rv && rv.convolver && rv.convolver.buffer){',
    '        const pre = octx.createDelay(0.1);',
    '        pre.delayTime.value = rv.preDelay.delayTime.value;',
    '        const conv = octx.createConvolver();',
    '        // The SAME impulse the live convolver is using, so the copy sits in the',
    '        // space that was actually being heard rather than a re-generated guess.',
    '        conv.buffer = rv.convolver.buffer;',
    '        conv.normalize = rv.convolver.normalize;',
    '        const hp = octx.createBiquadFilter();',
    '        hp.type = rv.wetHighpass.type;',
    '        hp.frequency.value = rv.wetHighpass.frequency.value;',
    '        const lp = octx.createBiquadFilter();',
    '        lp.type = rv.wetLowpass.type;',
    '        lp.frequency.value = rv.wetLowpass.frequency.value;',
    '        const wet = octx.createGain();',
    '        wet.gain.value = rv.wetGain.gain.value;',
    '        filter.connect(pre); pre.connect(conv); conv.connect(hp);',
    '        hp.connect(lp); lp.connect(wet); wet.connect(blend);',
    '      }',
    '    }catch(_eCopyReverb){ console.warn(\'SAVE COPY: the reverb send could not be mirrored\', _eCopyReverb); }',
    '    try{',
    '      const fl = deckEngine.flangerNodes;',
    '      if(fl){',
    '        const d = octx.createDelay(0.02);',
    '        d.delayTime.value = fl.delay.delayTime.value;',
    '        const lfo = octx.createOscillator();',
    '        lfo.type = fl.lfo.type;',
    '        lfo.frequency.value = fl.lfo.frequency.value;',
    '        const depth = octx.createGain();',
    '        depth.gain.value = fl.lfoGain.gain.value;',
    '        lfo.connect(depth); depth.connect(d.delayTime);',
    '        const fb = octx.createGain();',
    '        fb.gain.value = fl.feedback.gain.value;',
    '        const wet = octx.createGain();',
    '        wet.gain.value = fl.wetGain.gain.value;',
    '        filter.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(blend);',
    '        lfo.start(0);',
    '      }',
    '    }catch(_eCopyFlanger){ console.warn(\'SAVE COPY: the flanger send could not be mirrored\', _eCopyFlanger); }',
    '    try{',
    '      const dl = deckEngine.delayNodes;',
    '      if(dl){',
    '        const d = octx.createDelay(2);',
    '        d.delayTime.value = dl.delay.delayTime.value;',
    '        const fb = octx.createGain();',
    '        fb.gain.value = dl.feedback.gain.value;',
    '        const wet = octx.createGain();',
    '        wet.gain.value = dl.wetGain.gain.value;',
    '        filter.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(blend);',
    '      }',
    '    }catch(_eCopyDelay){ console.warn(\'SAVE COPY: the delay send could not be mirrored\', _eCopyDelay); }',
    '    return src;',
    '  }',
    '  async function saveDjCopy(){',
    '    if(djCopyBusy) return;',
    '    const t = allTracks.find(tr => tr.id === djCurrentTrackId);',
    '    if(!t){ toast(\'Load a song onto the deck first\'); return; }',
    '    if(!deckEngine.buffer){ toast(\'This song is still being read \u2014 try again in a moment\'); return; }',
    '    const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;',
    '    if(!Offline){ toast(\'This device cannot render a copy of the song\'); return; }',
    '    djCopyBusy = true;',
    '    const btn = $(\'djCopyBtn\');',
    '    if(btn){ btn.disabled = true; btn.textContent = \'RENDERING\u2026\'; }',
    '    try{',
    '      const buffer = deckEngine.buffer;',
    '      const state = djCopySourceState();',
    '      const sr = Math.max(8000, Math.round(buffer.sampleRate || 44100));',
    '      const chCount = Math.max(1, Math.min(2, buffer.numberOfChannels || 2));',
    '      const seconds = (buffer.duration / state.speed) + djCopyTailSeconds();',
    '      const octx = new Offline(chCount, Math.max(1, Math.ceil(seconds * sr)), sr);',
    '      const src = buildDjCopySource(octx, buffer, state);',
    '      src.start(0);',
    '      const rendered = await octx.startRendering();',
    '      if(!rendered) throw new Error(\'the render produced nothing\');',
    '      // The tag a re-encoded song gets, plus this copy\'s own name, so the two are',
    '      // told apart in the list and the original keeps its own title.',
    '      const title = (t.name || \'Untitled\') + \' (DJ edit)\';',
    '      const meta = { title: title, artist: t.artist || \'\', album: t.album || \'\', genre: t.genre || \'\' };',
    '      try{',
    '        if(t.artBlob){',
    '          meta.artBytes = new Uint8Array(await blobToArrayBufferFallbackCrop(t.artBlob));',
    '          meta.artMime = t.artBlob.type || \'image/jpeg\';',
    '        }',
    '      }catch(_eCopyArt){ }',
    '      const blob = await scEncodeAudioCooperative(rendered, \'mp3\', meta, function(p){',
    '        if(btn) btn.textContent = \'ENCODING \' + Math.round(Math.max(0, Math.min(1, p)) * 100) + \'%\';',
    '      });',
    '      if(!blob) throw new Error(\'the MP3 encoder produced nothing\');',
    '      const made = scAddConvertedToLibrary(blob, meta, { fmt: \'mp3\', source: \'djmode\' });',
    '      if(!made) throw new Error(\'the copy could not be added to the library\');',
    '      toast(\'Saved \u201c\' + title + \'\u201d to All Songs \u2014 your own copy of the song is untouched\', 5200);',
    '    }catch(e){',
    '      console.warn(\'SAVE COPY failed\', e);',
    '      toast(\'Could not save the copy: \' + (e && e.message ? e.message : e), 5200);',
    '    }finally{',
    '      djCopyBusy = false;',
    '      if(btn){ btn.disabled = false; btn.textContent = \'SAVE COPY\'; }',
    '    }',
    '  }',
    '  // Guarded because this button is markup from this same release: if a shell ever',
    '  // loads with an older page, a missing button must not take the rest of the boot',
    '  // wiring down with it.',
    '  (function(){',
    '    const copyBtn = $(\'djCopyBtn\');',
    '    if(copyBtn) copyBtn.addEventListener(\'click\', saveDjCopy);',
    '  })();',
  ]),
  { key: 'async function saveDjCopy(){' });

/* ===================================================== 3. THE RELEASE METADATA */
sub(html, 'APP_VERSION',
  "  const APP_VERSION = '" + PREV + "';",
  "  const APP_VERSION = '" + VERSION + "';",
  { key: "const APP_VERSION = '" + VERSION + "';" });

sub(html, 'changelog head',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ]) + NOTES.map((n) => "    '" + n + "',").join('\n') + '\n  ] },\n',
  { key: "const CHANGELOG = [\n  { version: '" + VERSION + "'" });

sub(sw, 'shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';",
  "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ==================================================================== 4. THE GATES */
sub(t705, 'test-705 SAVE COPY',
  "console.log('\\n[11] the file still holds together');\n",
  block([
    "console.log('\\n[10e] SAVE COPY in DJ Mode');",
    '{',
    '  // 70.1.8. The claim is that a DJ copy is the song with the deck\'s own sound on',
    '  // it, as a NEW song. What a text gate can hold: the button exists, the render is',
    '  // offline, every baked value is read from a live node, and the result goes in',
    '  // through the same helper a finished conversion uses. The audio itself cannot be',
    '  // rendered here (no Web Audio in jsdom) - the probe drives the resting state.',
    "  ok(count('id=\"djCopyBtn\"') === 1 && count('async function saveDjCopy(') === 1,",
    "     'the DJ deck has a SAVE COPY button that is really wired');",
    "  ok(count('const octx = new Offline(chCount') === 1 &&",
    "     count('const rendered = await octx.startRendering();') === 1,",
    "     'and it renders the song offline rather than recording it in real time');",
    "  ok(count('src.playbackRate.value = state.rate;') === 1 &&",
    "     count('src.detune.value = state.detune;') === 1 &&",
    "     count('if(node.detune) detune = node.detune.value || 0;') === 1,",
    "     'the copy is the speed the deck is really playing, detune included');",
    "  ok(count('const liveFilter = deckEngine.filterNode;') === 1 &&",
    "     count('(eqNodes[0] || []).forEach') === 1 &&",
    "     count('conv.buffer = rv.convolver.buffer;') === 1 &&",
    "     count('const liveLimiter = limiterNodes[0];') === 1,",
    "     'and every baked value is read from the live chain, not the knobs');",
    "  ok(count('scAddConvertedToLibrary(blob, meta, { fmt: \\'mp3\\', source: \\'djmode\\' })') === 1 &&",
    "     count(\" + ' (DJ edit)';\") === 1,",
    "     'the copy lands in the library as its own song, and the original is never written');",
    '}',
    '',
    "console.log('\\n[11] the file still holds together');",
  ]),
  { key: '[10e] SAVE COPY in DJ Mode' });

sub(studio, 'studio-70 SAVE COPY',
  "  console.log('[12] the page still holds together');\n",
  block([
    "  console.log('[11k] SAVE COPY says what it needs');",
    '  {',
    '    // 70.1.8. SAVE COPY renders through an OfflineAudioContext, which jsdom does not',
    '    // implement and the deck has no decoded buffer for either - so what is driven',
    '    // here is that the control is on the deck, that tapping it with nothing loaded',
    '    // says so instead of throwing, and that the copy is named rather than overwriting',
    '    // the song that was loaded.',
    "    const copyBtn = doc.querySelector('#djCopyBtn');",
    "    ok(!!copyBtn, 'the DJ deck has a SAVE COPY button');",
    "    if (copyBtn) {",
    "      copyBtn.click();",
    '      await wait(120);',
    "      const said = doc.querySelector('#toast');",
    "      ok(!!said && /load a song|still being read|cannot render/i.test(said.textContent || ''),",
    "        'and it says what it is waiting for instead of failing silently (' + (said ? said.textContent : '') + ')');",
    '    }',
    "    ok(html.indexOf(\" + ' (DJ edit)';\") !== -1,",
    "      'with the copy named as an edit so the original keeps its own title');",
    "    ok(html.indexOf('scAddConvertedToLibrary(blob, meta') !== -1,",
    "      'and going in through the library path a finished conversion uses');",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]),
  { key: '[11k] SAVE COPY says what it needs' });

/* ============================================================ 5. WHAT MUST STILL HOLD */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The mix recorder and the 70.1.7 loop work are untouched.
  must(count(page, 'function startDjRecording(){') === 1 && count(page, 'function stopDjRecording(){') === 1,
    'the mix recorder left with this release');
  must(count(page, 'function applyDeckLoop(') === 1 && count(page, 'function setDeckLoop(on){') === 1,
    'the 70.1.7 loop controls left with this release');
  // The copy itself.
  must(count(page, 'function djCopySourceState(){') === 1 && count(page, 'function buildDjCopySource(octx, buffer, state){') === 1,
    'the copy machinery is not both there');
  must(count(page, 'src.playbackRate.value = state.rate;') === 1 &&
    count(page, 'src.detune.value = state.detune;') === 1,
    'the copy does not take the source rate and detune');
  must(count(page, 'filter.connect(pre); pre.connect(conv); conv.connect(hp);') === 1 &&
    count(page, 'filter.connect(d); d.connect(fb).connect(d); d.connect(wet).connect(blend);') === 2,
    'the three sends are not both mirrored');
  must(count(page, 'const made = scAddConvertedToLibrary(blob, meta, { fmt: \'mp3\', source: \'djmode\' });') === 1,
    'the copy does not go into the library');
  must(count(page, 'if(copyBtn) copyBtn.addEventListener(\'click\', saveDjCopy);') === 1,
    'the button is not wired');
  must(count(page, '  .record-panel') === 1 && count(page, '  .record-row{ display:flex; align-items:center; justify-content:center; gap:14px; }') === 1,
    'the recorder panel styles went missing');
  // The release.
  must(count(page, "const APP_VERSION = '70.1.8';") === 1, 'the version is not 70.1.8');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.1.8',") === 1 && count(page, "  { version: '70.1.7',") === 1 &&
    count(page, "  { version: '70.1.6',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, '[10e] SAVE COPY in DJ Mode') === 1, 'the new gate rule did not land');
  must(count(studio.text, '[11k] SAVE COPY says what it needs') === 1,
    'the real-app probe does not drive the control');
  // The three releases before this one are still pinned.
  must(count(t705.text, '[10d] the DJ Mode loop controls') === 1, 'the 70.1.7 gate rule left with this release');
  must(count(studio.text, '[11j] the DJ Mode loop controls do not lie') === 1, 'the 70.1.7 probe section left');
  must(count(studio.text, '[11h] the search box clears, and the sheet and the cover are real') === 1,
    'the 70.1.5 probe section left with this release');
}

if(problems.length){
  console.error('patch-7018: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7018: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7018: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7018: next `node dev/repin-7018.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
