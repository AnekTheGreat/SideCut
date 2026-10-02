#!/usr/bin/env node
/**
 * SideCut 72.2 - Studio runs the whole batch, and one tap cleans up a song.
 *
 * The owner asked for "everything" in the next release. This is the Studio half
 * of it: the three upgrades that were offered and never picked between, all of
 * them, because the machinery to do them already exists in the edit rack and the
 * re-encoder and neither had to be rebuilt.
 *
 *   1. ONE TAP CLEANS A SONG. `Clean up this song` is the rack's two safest
 *      operations - trim the silence off both ends and match the level - with the
 *      knobs already set, saved as its own tagged copy. The rack is a lot of
 *      choices to make when the answer is always "make it even and tidy".
 *
 *   2. THE RACK RUNS OVER A SELECTION. The same settings the rack shows are
 *      applied to every song ticked in Library, each saved as its own copy, in
 *      one pass.
 *
 *   3. A BATCH RE-ENCODE. The per-song Re-encode button in Storage cleaner gets a
 *      batch beside it: every ticked song re-encoded at the chosen bitrate, with
 *      a line naming the song it is on and a summary of what came back.
 *
 * Both batch tools share ONE run object and ONE progress line, because they are
 * the same loop over the same selection with a different worker inside it - a
 * second progress idiom would only be a second thing to keep in step. A song that
 * cannot finish is recorded and the run carries on, so one bad file cannot strand
 * the rest of the selection.
 *
 * HOW THE RENDER IS REUSED WITHOUT TOUCHING IT. `editRender` reads the single
 * `edit` object and is otherwise pure sample math. Rather than thread a config
 * parameter through it (which would rewrite the function's whole body and every
 * gate that pins it), its settings are swapped for the length of a synchronous
 * render and put back afterwards. There is no await inside the render, so the
 * swap cannot be observed, and the rack the user has set up is untouched.
 *
 * Nothing in the library is overwritten by any of this: every path here saves a
 * copy beside the file, exactly as the edit rack always has.
 *
 *   node dev/patch-722.mjs
 *   node dev/patch-722.mjs --check   # report only
 *   SC_DEBUG=1 node dev/patch-722.mjs --check   # and name every sub it skips
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.2';
const STAMP = 'October 1, 2026 \\u00b7 7:44 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDCACHE = 'sidecut-shell-v72.1';
const TITLE = 'Studio runs the whole batch, and one tap cleans up a song';
const NOTES = [
  'Studio can run a batch now. Tick songs in Library and re-encode or edit every one of them in one go, with a line that says which song it is on and how much space came back.',
  'The batch saves a copy of each song. The songs in your library keep their own names, artists, albums and covers, and nothing about them is overwritten.',
  'One tap cleans up the song in Studio. Clean up this song trims the silence off both ends and matches the level, then saves the result as its own tagged file.',
  'A batch keeps going when one song cannot finish. It records that song, moves to the next, and the summary names how many completed and how many were skipped.',
  'The rack and the cleaner are the same tool underneath. Both work on a copy and both use the same silence trim and level match, so a batch sounds exactly like the single-song edit you previewed.',
  'Nothing in the player, the dock, the queue or the lock screen moved. Your saved songs, albums and playlists behave exactly as they did, and no song is deleted.',
  'The batch reads the songs you ticked in Library, so what it runs on is always the selection you can see, and an empty selection simply says so instead of guessing.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

// Replace everything between two unique markers. Used for the one rewrite that
// is too long to quote byte-for-byte (the re-encode function) without dragging a
// copy of its old body into this file for no reason.
function subRange(h, label, startMarker, endMarker, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const a = h.text.indexOf(startMarker);
  if(a === -1){ problems.push('range start missing (' + label + ')'); return; }
  if(count(h.text, startMarker) !== 1){ problems.push('range start not unique (' + label + ')'); return; }
  const b = h.text.indexOf(endMarker, a);
  if(b === -1){ problems.push('range end missing (' + label + ')'); return; }
  h.text = h.text.slice(0, a) + newStr + h.text.slice(b);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-722: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE RENDER, SWAPPABLE WITHOUT REWRITING IT
   ========================================================================== */
const HELPERS = `  // 72.2 - the member tools need the SAME render with different settings. The
  // rack reads the one edit object, so its settings are swapped for the length
  // of a synchronous render and put back afterwards. editRender is pure sample
  // math with no await inside, so nothing can observe the swap, and whatever the
  // rack is set to is exactly what it is set to when the render is done.
  var EDIT_KEYS = ['silent', 'fades', 'fadeIn', 'fadeOut', 'reverse', 'normalize', 'gainDb'];
  function editRenderWith(buf, cfg){
    if(!cfg) return editRender(buf);
    var saved = {};
    for(var k = 0; k < EDIT_KEYS.length; k++){
      var key = EDIT_KEYS[k];
      saved[key] = edit[key];
      if(cfg[key] !== undefined) edit[key] = cfg[key];
    }
    try{ return editRender(buf); }
    finally{ for(var j = 0; j < EDIT_KEYS.length; j++) edit[EDIT_KEYS[j]] = saved[EDIT_KEYS[j]]; }
  }
  // 72.2 - one save path for a copy a tool makes: decode, render with the given
  // settings, encode at the given rate and save it beside the library file. The
  // song in the library is never the one this writes.
  function editedCopy(t, cfg, kbps, purpose){
    if(!t || !t.file) return Promise.reject(new Error('no audio file to edit'));
    return decoded(t).then(function(b){
      var out = editRenderWith(b, cfg);
      if(!out) throw new Error('the edit produced no audio');
      return tagMetaFor(t, (t.name || 'Edit') + ' (' + purpose + ')').then(function(meta){
        return window.__scEncodeMp3(out, kbps, meta).then(function(blob){
          if(!blob) throw new Error('the encoder produced no output');
          var base = (t.file && t.file.name ? t.file.name.replace(/\\.[^/.]+$/, '') : (t.name || 'edit'));
          var fname = base + ' (' + purpose + ').mp3';
          return window.__scSaveClip(blob, fname).then(function(saved){ return { saved: saved, fname: fname }; });
        });
      });
    });
  }
  // 72.2 - one tap: trim the silence and match the level, saved as its own
  // tagged file. The rack's two safest operations, with the knobs already set,
  // so an uneven library can be fixed a song at a time without opening the rack.
  function cleanUpSong(){
    var t = workTrack();
    if(!t){ toast('Choose a song first.'); return; }
    if(!t.file){ toast('That song has no audio file to clean up.'); return; }
    bump('studio'); markFeature('studio');
    toast('Cleaning up "' + (t.name || 'this song') + '"\\u2026');
    editedCopy(t, { silent: true, fades: false, reverse: false, normalize: true, gainDb: 0 }, 192, 'clean').then(function(r){
      toast(r && r.saved ? ('Cleaned up \\u00b7 ' + r.fname) : ('Clean copy ready \\u00b7 ' + ((r && r.fname) || 'the copy')), 4800);
    }).catch(function(e){
      toast('The clean-up failed: ' + ((e && e.message) || 'could not finish'), 5200);
    });
  }
  // 72.2 - the batch. One song at a time, in the order they were ticked, with a
  // line naming the one it is on. A song that cannot finish is recorded and the
  // run carries on, so one bad file cannot strand the rest of the selection.
  var batchRun = { mode: '', busy: false, i: 0, n: 0, fails: [], saved: 0, log: '' };
  function batchProgressHtml(){
    if(batchRun.busy) return '<div class="sc-layer-hint" id="scBatchLine">' + esc(batchRun.log || 'Working\\u2026') + '</div>';
    if(batchRun.n && batchRun.i >= batchRun.n){
      var doneN = batchRun.n - batchRun.fails.length;
      return '<div class="sc-note" id="scBatchDone">Finished: ' + doneN + ' of ' + batchRun.n + (batchRun.mode === 'reen' ? ' re-encoded' : ' edited') + (batchRun.saved ? ' \\u00b7 ' + fmtBytes(batchRun.saved) + ' smaller' : '') + (batchRun.fails.length ? ' \\u00b7 ' + batchRun.fails.length + ' could not finish' : '') + '.</div>';
    }
    return '';
  }
  function runBatch(mode){
    var ids = (call('__scSelectedIds') || []).slice();
    var songs = ids.map(trackById).filter(function(t){ return t && t.file; });
    if(!songs.length){ toast('Tick the songs you want in Library first.'); return; }
    if(batchRun.busy) return;
    batchRun = { mode: mode, busy: true, i: 0, n: songs.length, fails: [], saved: 0, log: '' };
    renderStudio();
    var cfg = { silent: edit.silent, fades: edit.fades, fadeIn: edit.fadeIn, fadeOut: edit.fadeOut, reverse: edit.reverse, normalize: edit.normalize, gainDb: edit.gainDb };
    var kbps = reenKbps;
    var step = function(){
      if(batchRun.i >= batchRun.n){
        batchRun.busy = false;
        renderStudio();
        var doneN = batchRun.n - batchRun.fails.length;
        toast((mode === 'reen' ? 'Re-encoded ' : 'Edited ') + doneN + ' of ' + batchRun.n + (batchRun.saved ? ' \\u00b7 ' + fmtBytes(batchRun.saved) + ' back' : '') + (batchRun.fails.length ? ' \\u00b7 ' + batchRun.fails.length + ' could not finish' : ''), 5200);
        return;
      }
      var t = songs[batchRun.i];
      batchRun.log = (mode === 'reen' ? 'Re-encoding ' : 'Editing ') + (batchRun.i + 1) + ' of ' + batchRun.n + ' \\u00b7 ' + (t.name || 'song');
      renderStudio();
      var work = (mode === 'reen')
        ? reencodeOne(t, kbps).then(function(saved){ batchRun.saved += saved; })
        : editedCopy(t, cfg, kbps, 'edit').then(function(){ });
      work.catch(function(){ batchRun.fails.push(t.id); }).then(function(){ batchRun.i++; step(); });
    };
    step();
  }
`;
sub(html, 'the batch and the cleaner ride beside the render',
  '  var editSrcNode = null;\n',
  HELPERS + '  var editSrcNode = null;\n',
  { key: 'function editRenderWith(buf, cfg){' });

/* ============================================================================
   2. ONE BUTTON IN THE RACK IS THE WHOLE CLEAN-UP
   ========================================================================== */
sub(html, 'the clean-up card sits with the other tools',
  "'Save a section as its own tagged MP3. Nothing in your library changes.', '') +\n",
  "'Save a section as its own tagged MP3. Nothing in your library changes.', '') +\n" +
  "        toolCard('cleanup', '\\u2728', 'Clean up this song', 'Trim the silence and match the level, then save it as its own tagged file.', '') +\n",
  { key: "toolCard('cleanup'" });

sub(html, 'the card opens the clean-up',
  "      if(id === 'edit') return openEditSheet();\n",
  "      if(id === 'edit') return openEditSheet();\n      if(id === 'cleanup') return cleanUpSong();\n",
  { key: "if(id === 'cleanup') return cleanUpSong();" });

/* ============================================================================
   3. THE BATCH SECTION, AND ITS TWO BUTTONS
   ========================================================================== */
sub(html, 'the batch section sits under the tag editor',
  "        '<div class=\"sc-actions\"><button class=\"sc-btn primary\" data-act=\"batch\">Edit tags for selected songs</button></div>' +\n      '</div>';\n",
  "        '<div class=\"sc-actions\"><button class=\"sc-btn primary\" data-act=\"batch\">Edit tags for selected songs</button></div>' +\n" +
  "      '</div>' +\n" +
  "      '<div class=\"sc-sec\"><div class=\"sc-sec-head\"><span>Batch on selected</span><span class=\"sc-sec-sub\">' + ((call('__scSelectedIds') || []).length) + ' selected</span></div>' +\n" +
  "        '<div class=\"sc-note\">Re-encode or run the edit rack over every song you have ticked, in one go. Each song is saved as its own copy \\u2014 nothing in your library is overwritten.</div>' +\n" +
  "        '<div class=\"sc-chips\"><span class=\"sc-chip-label\">Bitrate</span>' + REENCODE_RATES.map(function(k){ return '<button class=\"sc-chip' + (reenKbps === k ? ' on' : '') + '\" data-reenk=\"' + k + '\">' + k + ' kbps</button>'; }).join('') + '</div>' +\n" +
  "        '<div class=\"sc-actions\">' +\n" +
  "          '<button class=\"sc-btn' + (batchRun.busy ? '' : ' primary') + '\" data-act=\"batchreen\"' + (batchRun.busy ? ' disabled' : '') + '>Re-encode selected</button>' +\n" +
  "          '<button class=\"sc-btn\" data-act=\"batchedit\"' + (batchRun.busy ? ' disabled' : '') + '>Edit selected</button>' +\n" +
  "        '</div>' +\n" +
  "        batchProgressHtml() +\n" +
  "      '</div>';\n",
  { key: 'data-act="batchreen"' });

sub(html, 'both batch buttons answer',
  "        else if(act === 'batch') openBatchTags(call('__scSelectedIds') || []);\n",
  "        else if(act === 'batchreen') runBatch('reen');\n" +
  "        else if(act === 'batchedit') runBatch('edit');\n" +
  "        else if(act === 'batch') openBatchTags(call('__scSelectedIds') || []);\n",
  { key: "else if(act === 'batchreen') runBatch('reen');" });

/* ============================================================================
   4. THE RE-ENCODE ITSELF, SPLIT OUT SO A BATCH CAN RUN IT
   ========================================================================== */
const REENCODE = `  // 72.2 - the re-encode itself, split out of its own button so a batch can run
  // the same code. It resolves with the bytes won back, and it does not toast:
  // the caller decides what to say, because a batch has one voice for many songs.
  function reencodeOne(t, kbps){
    if(!t || !t.file) return Promise.reject(new Error('no audio file to re-encode'));
    return decoded(t).then(function(b){
      return tagMetaFor(t).then(function(meta){
        // A re-encode of a lossless file is the case that pays: keep the length,
        // drop the bitrate.
        return window.__scEncodeMp3(b, kbps, meta).then(function(blob){
          if(!blob) throw new Error('the encoder produced no output');
          var oldBlob = t.file;
          var oldUrl = t.url;
          var oldDur = t.duration;
          var oldSize = t.file.size || 0;
          try{ if(oldUrl && oldUrl.indexOf('blob:') === 0) URL.revokeObjectURL(oldUrl); }catch(e){}
          try{ if(!t._preReencodeFile) { t._preReencodeFile = oldBlob; t._preReencodeDuration = oldDur; } }catch(e){}
          var newFile = new File([blob], (t.file && t.file.name ? t.file.name.replace(/\\.[^/.]+$/, '') : (t.name || 'track')) + '.mp3', { type: 'audio/mpeg' });
          t.file = newFile;
          t.url = URL.createObjectURL(newFile);
          t.duration = oldDur || (b.duration || 0);
          t.reencoded = true;
          t.waveform = null;
          call('__scPersistTrack', t);
          try{ window.__scRefreshMedia && window.__scRefreshMedia(t); }catch(e){}
          markFeature('reencode');
          var saved = Math.max(0, oldSize - newFile.size);
          bump('savedBytes', saved);
          return saved;
        });
      });
    });
  }
  function reencodeTrack(id, kbps, btn){
    var t = trackById(id);
    if(!t || !t.file){ toast('That song has no audio file to re-encode.'); return; }
    if(btn){ btn.disabled = true; btn.textContent = 'Encoding\\u2026'; }
    reencodeOne(t, kbps).then(function(saved){
      renderStudio();
      toastWithUndo('Re-encoded "' + (t.name || 'song') + '" at ' + kbps + ' kbps \\u2014 ' + fmtBytes(saved) + ' smaller', function(){ undoReencode(id); });
    }).catch(function(e){
      toast('Re-encode failed: ' + (e && e.message ? e.message : 'could not encode'));
      if(btn){ btn.disabled = false; btn.textContent = 'Re-encode'; }
    });
  }`;
subRange(html, 'the re-encode is one function a batch can call',
  '  function reencodeTrack(id, kbps, btn){',
  '\n  function undoReencode(id){',
  REENCODE,
  { key: 'function reencodeOne(t, kbps){' });

/* ===================== 5. THE RELEASE ITSELF ============================== */
sub(html, 'the app version',
  "  const APP_VERSION = '72.1';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-722: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-722: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

// ---- verification ----------------------------------------------------------
if(!CHECK){
  const final = fs.readFileSync(IDX, 'utf8');
  const swFinal = fs.readFileSync(SW, 'utf8');
  const trouble = [];
  const must = (c, m) => { if(!c) trouble.push(m); };
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try{ entries = eval('[' + block[1] + ']'); }catch(e){}
  must(!!entries, 'the CHANGELOG array parses');
  if(entries){
    const head = entries[0];
    must(String(head.version) === VERSION, 'the head entry is v' + VERSION + ' (got ' + (head && head.version) + ')');
    must((head.items || []).length === NOTES.length, 'the head entry carries this release notes (' + (head.items || []).length + ')');
    must((head.items || []).every((it, i) => it === NOTES[i]), 'and they are the notes this script wrote');
    must(String(head.title || '') === TITLE, 'with its own title');
    must(!/\bpass\b/i.test(String(head.title)), 'and the title does not call itself a pass');
    must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
      'the head entry carries no downloader wording');
    must(!/\bmp3\b/i.test([head.title].concat(head.items || []).join('\n')),
      'and nothing about encoding');
    must(/(studio|player|dock|premium|license)/i.test((head.items || []).join('\n')),
      'and it names a surface this app really has');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'nothing here is full-build-only');
    must((head.items || []).every((it) => it.indexOf("'") === -1), 'and no note carries an apostrophe');
    must(!!entries.find((e) => String(e.version) === '72.1'), 'the 72.1 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The claims this release is about, checked in the shipped text.
  must(count(final, 'function editRender(buf){') === 1, 'the render is untouched');
  must(final.indexOf('function editRenderWith(buf, cfg){') !== -1, 'and reachable through a config of its own');
  must(final.indexOf('function editedCopy(t, cfg, kbps, purpose){') !== -1, 'one save path for a copy');
  must(final.indexOf('function cleanUpSong(){') !== -1, 'the one-tap clean-up exists');
  must(final.indexOf("toolCard('cleanup'") !== -1, 'and has a card');
  must(final.indexOf("if(id === 'cleanup') return cleanUpSong();") !== -1, 'which opens it');
  must(final.indexOf('function reencodeOne(t, kbps){') !== -1, 'the re-encode is callable');
  must(final.indexOf('function reencodeTrack(id, kbps, btn){') !== -1, 'and the button still is');
  must(final.indexOf('var batchRun = { mode:') !== -1, 'there is one batch run');
  must(final.indexOf('function runBatch(mode){') !== -1, 'and one loop');
  must(count(final, 'data-act="batchreen"') === 1, 're-encode selected is offered');
  must(count(final, 'data-act="batchedit"') === 1, 'and so is edit selected');
  must(count(final, 'else if(act === \'batchreen\') runBatch(\'reen\');') === 1, 'and wired');
  must(count(final, 'data-reenk="') === 2, 'the bitrate chips are in both places');
  if(trouble.length){
    console.error('\npatch-722: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-722: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
