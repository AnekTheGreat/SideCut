#!/usr/bin/env node
// v64 — the QOL pass. One gate for the nine things reported together.
//
//   [1] artist pictures: one square per IMAGE, and the singles asked for too;
//   [2] the assistant: a busy service is retried, a failed one falls back to the
//       knowledge built into the app and says which answered, and what it is told
//       about the app names the tools it must not deny;
//   [3] the pinned artists strip is a rounded card on the raised surface;
//   [4] a long run finishes sooner (longer encode slices, a shorter between-song
//       pause) and Free up space no longer deletes rollback copies;
//   [5] sliders a finger can drag: one styled control for the settings sliders,
//       and a seek bar the file clock stops writing to while it is held;
//   [6] the first-run guide describes the build it is in;
//   [7] the two Android builds can be installed side by side (their own ids);
//   [8] the missing updateNpDisplay() exists, and a refused Blob write reports
//       false instead of escaping as a red banner;
//   [9] the release says so, on both channels, without naming what it may not.
//
//   node dev/test-662.mjs                              # the shipped tree
//   SC_HTML=/path/index.html node dev/test-662.mjs      # any build
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HTML = process.env.SC_HTML ? path.resolve(process.env.SC_HTML) : path.join(ROOT, 'index.html');
const src = fs.readFileSync(HTML, 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (needle) => src.split(needle).length - 1;
// Tolerant on purpose: this gate can be run against a pre-fix build, where whole
// functions do not exist yet. That run must report failures, not throw.
function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = a === -1 ? -1 : src.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return src.slice(a, b);
}

console.log('[1] artist pictures stop repeating, and the singles are included');
ok(src.indexOf('var _seenImg = {}, _uniqCovers = [];') !== -1, 'the picker grid dedupes');
ok(src.indexOf("(_cv.dataUrl && _cv.dataUrl.length > 64) ? _cv.dataUrl") !== -1,
  'on the image itself, not on a per-song URL');
ok(src.indexOf('covers = _uniqCovers;') !== -1, 'and the deduped list is the one that is built');
ok(src.indexOf('&media=music&entity=song&limit=50') !== -1, 'the artist singles are asked for too');
ok(src.indexOf('var sKey = sAlbum.toLowerCase().trim()') !== -1, 'through the same dedupe map');
ok(count('&media=music&entity=album&limit=50') === 1, 'and the album search is still asked once');

console.log('\n[2] the assistant: retry, fall back, and no invented denials');
const gem = sliceBetween('async function _aiGeminiQuery', 'async function _aiSendMessage');
ok(gem.indexOf('var _askRetrying = async function(model){') !== -1, 'a busy service is retried');
ok(gem.indexOf("_st !== 503") !== -1 && gem.indexOf("_st !== 429") !== -1,
  'on the transient codes only (429, 500, 502, 503, 504)');
ok(gem.indexOf('if(resp.status === 429 || resp.status >= 500) return null;') !== -1,
  'and a still-busy service hands off instead of printing an error');
ok(gem.indexOf('resp = await _askRetrying(_better);') !== -1, 'the model fallback retries too');
ok(src.indexOf('var _aiBusyFallback = false;') !== -1, 'the fallback is tracked');
ok(src.indexOf('    _aiBusyFallback = true;\n  }') !== -1, 'a failed service call falls through to the app knowledge');
ok(src.indexOf("Answered from the built-in knowledge base") !== -1, 'and the status line says which answered');
const prompt = sliceBetween('var _aiSystemPrompt = ', ';\n');
ok(prompt.length > 100, 'the assistant is still given a system prompt');
ok(prompt.indexOf('never claim a SideCut feature does not exist') !== -1, 'that forbids denying a real feature');
ok(prompt.indexOf('Get Songs') !== -1, 'and names where the built-in tools are');
ok(prompt.indexOf('SC_IS_PLAY') !== -1, 'per build');

console.log('\n[3] the pinned artists strip is a rounded card');
ok(src.indexOf('id="pinnedArtistsStrip" style="background:var(--bg-raised);margin:0 0 14px;padding:10px 12px 12px;border:1px solid var(--line);border-radius:16px;"') !== -1,
  'raised surface, hairline border, 16px corners');
ok(src.indexOf('id="pinnedArtistsStrip" style="background:var(--bg);') === -1,
  'and no longer a flat block of the page colour');

console.log('\n[4] a long run finishes sooner, and Free up space keeps the rollbacks');
ok(src.indexOf('var SC_ENCODE_SLICE_MS = 90;') !== -1, 'the encoder works in 90ms slices');
ok(src.indexOf('setTimeout(r, 200); });') !== -1, 'the between-song pause is 200ms');
ok(src.indexOf('setTimeout(r, 800); });') === -1, 'and the 800ms one is gone');
ok(src.indexOf('scPruneVersionSnapshots(SC_SNAPSHOT_KEEP)') === -1, 'Free up space does not trim the copies');
const free = sliceBetween('  async function scFreeUpSpace(){', 'window.__scFreeUpSpace = scFreeUpSpace;');
ok(free.indexOf('rollback') !== -1, 'and says so in its own comment');
ok(free.indexOf('scMetaSnapshotRows') === -1, 'and no longer reads every page-sized row to measure them');
ok(src.indexOf("' (none are ever removed)'") !== -1, 'the Storage panel says the copies are never removed');
ok(src.indexOf('Free up space keeps the newest') === -1, 'and no longer advertises a cap');
ok(src.indexOf('SC_SNAPSHOT_HARD_CAP') !== -1, 'the runaway guard for a runaway install is still there');

console.log('\n[5] sliders a finger can drag');
ok(src.indexOf('touch-action:none;') !== -1 && src.indexOf('touch-action:pan-y; cursor:pointer;') !== -1,
  'the sliders own their gestures');
ok(src.indexOf('input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-webkit-slider-thumb{') !== -1,
  'one big thumb for the settings sliders');
ok(src.indexOf('input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)::-webkit-slider-runnable-track{') !== -1,
  'on a filled track');
ok(src.indexOf('input[type=range]:not(#seekBar):not(#actionSpeedSlider):not(.eq-band-slider)') !== -1 &&
   src.indexOf('input[type=range]{ ') === -1,
  'and the seek bar, the speed slider and the EQ faders are left out of it');
ok(src.indexOf('#seekBar{ flex:1; -webkit-appearance:none; appearance:none; height:8px; border-radius:999px; outline:none; touch-action:none;') !== -1,
  'the seek bar no longer offers its drag to the scroller');
ok(src.indexOf('var scSeekDragging = false;') !== -1, 'it knows when it is held');
const seekFn = sliceBetween('  function updateSeekDisplay(pct){', '  async function computeWaveform');
ok(seekFn.indexOf('if(!scSeekDragging){') !== -1, 'and the clock leaves the value alone while it is');
ok(seekFn.indexOf('updateWaveformDisplay(pct);') !== -1, 'while the waveform still follows the song');
ok(count('function(){ scSeekDragging = true; }') === 1, 'the grab is wired once');
ok(count('function(){ scSeekDragging = false; }') === 1, 'and the release once, for every way a drag ends');
const rel = sliceBetween("function(){ scSeekDragging = false; }", '\n  });');
ok(rel.length > 0, 'the release handler exists');
ok(count("'pointerup','pointercancel','touchend','touchcancel','mouseup','change','blur'") === 1,
  'a pointer, a touch, a mouse, a change and a blur all release it');

console.log('\n[6] the guide describes the build it is in');
ok(src.indexOf('SideCut tags the song, gives it its cover art') !== -1,
  'the first-run guide teaches the tool that is built in');
ok(src.indexOf('Paste it into <b>Expand URL</b>') === -1, 'and no longer routes through Expand URL');
ok(src.indexOf('id="howToGetMusicHead"') !== -1, 'the heading keeps the id the other build replaces it by');
ok(src.indexOf('tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library') !== -1,
  'the scenario teaches it too');
ok(src.indexOf('<b>Getting music in:</b> paste a Spotify link') !== -1, 'and so does the text summary');
ok(src.indexOf('getElementById(\'howToScenario1Head\')') !== -1,
  'and the build without the tools still hides that scenario');

console.log('\n[7] the two Android builds can sit side by side');
const dual = path.join(ROOT, '.github', 'workflows', 'patch-dualinstall.py');
ok(fs.existsSync(dual), 'the identity patch exists');
if (fs.existsSync(dual)) {
  const d = fs.readFileSync(dual, 'utf8');
  ok(d.indexOf("FULL_ID = APP_ID + '.full'") !== -1, 'it moves the sideloaded build off the shared id');
  ok(d.indexOf(`'applicationId "%s"' % FULL_ID`) !== -1, 'in build.gradle applicationId');
  ok(!/namespace\s+["']/.test(d), 'and never assigns a Java namespace, so every generated path stays put');
  ok(d.indexOf('FULL_NAME = ') !== -1 && d.indexOf("'app_name'") !== -1, 'with its own launcher label');
}
const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'android-build.yml'), 'utf8');
ok(wf.indexOf('patch-dualinstall.py') !== -1, 'the workflow runs it');
ok(/if: matrix\.flavor == 'full'[\s\S]{0,220}patch-dualinstall\.py/.test(wf),
  'on the full flavor only, so the Play listing keeps its id');
ok((wf.match(/patch-dualinstall\.py/g) || []).length === 1, 'exactly once');

console.log('\n[8] the missing refresh exists, and a refused Blob cannot escape');
ok(src.indexOf('function updateNpDisplay(t){') !== -1, 'updateNpDisplay() is defined');
ok(count('function updateNpDisplay(t){') === 1, 'once');
ok(count('updateNpDisplay(cur)') === 2, 'and both batch jobs still call it');
ok(src.indexOf('window.updateNpDisplay = updateNpDisplay;') !== -1, 'it is exposed with the other hooks');
const np = sliceBetween('  function updateNpDisplay(t){', '\n  }\n');
ok(np.indexOf('recordPlay') === -1, 'and it does not count as a play');
ok(np.indexOf("$('npTitle')") !== -1 && np.indexOf("$('npArtist')") !== -1, 'it refreshes the text');
ok(np.indexOf('updateNowPlayingArt(t)') !== -1, 'and the art');
const putFn = sliceBetween("        const tx = db.transaction(storeName, 'readwrite');", "    }catch(e){\n      // Log and report it");
ok(putFn.indexOf('try{') !== -1, 'the RefusedBlob put is wrapped where it is thrown');
ok(putFn.indexOf('resolve(false);') !== -1 && putFn.indexOf('return;') !== -1,
  'and reports the documented false so the caller falls back');
ok(putFn.indexOf('tx.abort()') !== -1, 'and aborts the transaction it cannot use');

console.log('\n[9] the release says so');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(ver === '64.2.3', 'APP_VERSION = ' + ver);
  ok(!!entries && entries[0].version === ver, 'the newest changelog matches APP_VERSION');
  if (entries) {
    const head = entries[0];
    ok((head.items || []).length >= 6, 'patch notes: ' + (head.items || []).length);
    ok(!/\bdownload|converter|convert\b/i.test(head.items.join('\n')), 'no downloader term anywhere in it');
    ok(!/play build|play version|play install/i.test(head.items.join('\n')), 'and it never names the other build');
    ok((head.items || []).slice(0, 6).every((it) => it.indexOf('[FULL]') === -1),
      'the first six publish on both channels');
    ok((head.items || []).slice(6).every((it) => it.indexOf('[FULL] ') === 0),
      'and the rest are marked for the full build');
    ok(/rollback/i.test(head.items.join('\n')), 'and it describes what this release did');
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(/^sidecut-shell-v\d+(\.\d+)*$/.test(swCache), 'service worker cache is versioned (' + swCache + ')');
  ok(swCache.indexOf(String(ver)) === -1, 'and is not the app version');
}

console.log('\n[10] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  blocks.forEach((b) => {
    const body = b.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad);
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
