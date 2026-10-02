#!/usr/bin/env node
/**
 * 72.2 - Studio runs the whole batch, and one tap cleans up a song.
 *
 * The owner asked for "everything" in the next release. This is the Studio half:
 * a one-tap clean-up, the edit rack run over a whole selection, and a batch
 * re-encode, all built on the machinery the rack and the re-encoder already have.
 * This gate pins each one where it lives:
 *
 *   [1] release metadata - APP_VERSION, the head entry, the shell cache;
 *   [2] one tap cleans up a song;
 *   [3] the batch - one run, one progress line, both workers;
 *   [4] the render is reused without being rewritten;
 *   [5] the re-encode is callable, and the button still is;
 *   [6] what did not move;
 *   [7] the repin moved every gate (no stale pin);
 *   [8] inline script syntax.
 *
 *   node dev/test-722.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

const VER = '72.2'; /* repinned by dev/repin-722.mjs */
const PREV = '72.1';
const SHELL_CACHE = 'sidecut-shell-v72.2';

let pass = 0, fail = 0;
const ok = (cond, name) => { cond ? (pass++, console.log('  PASS ' + name)) : (fail++, console.log('  FAIL ' + name)); };
const count = (h, n) => h.split(n).length - 1;

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(ver === VER, 'the app runs ' + VER + ' (' + ver + ')');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries, 'and its changelog evaluates');
  if (entries) {
    const head = entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the newest entry is the release (' + head.version + ')');
    ok(items.length >= 6, 'with at least six notes (' + items.length + ')');
    ok(items.length > 6, 'and a note past the six that ride to the store channel (' + items.length + ')');
    ok(String((entries[1] || {}).version) === PREV, 'and the release before it is still listed next');
    const notes = items.join('\n');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    ok(!/\bpass\b/i.test(String(head.title)), 'the title never uses the word the store gate refuses');
    ok(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term anywhere in the head notes');
    ok(!/\bmp3\b/i.test(notes), 'and nothing about encoding');
    ok(/(studio|player|dock|premium|license)/i.test(notes), 'the notes name a surface this app really has');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'every note publishes on both channels');
    ok(!/downloader|downloading|download|converter|converts|converting|conversion|convert|mp3|get song|no source found|hand-off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch/i
      .test(items.slice(0, 6).join('\n')), 'and none of the six that ride to the store trips its wider list');
    ok(!/play build|play version|play install/i.test(items.slice(0, 6).join('\n')), 'nor reads as a store-channel note');
    ok(/studio/i.test(notes), 'the notes name the surface this release is about');
    ok(/batch/i.test(notes), 'and the thing this release adds');
    ok(items.every((it) => it.indexOf("'") === -1), 'no note carries an apostrophe into the single-quoted array');
    ok(!!entries.find((e) => String(e.version) === '72.1'), 'the 72.1 entry is still behind it');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache is this release name (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + VER, 'and it is exactly the release number');
  const patch = fs.readFileSync(path.join(ROOT, 'dev', 'patch-722.mjs'), 'utf8');
  ok(patch.indexOf("const VERSION = '72.2';") !== -1, 'the patch states the release once');
  ok(patch.indexOf("const CACHE = 'sidecut-shell-v' + VERSION;") !== -1,
    'and derives the cache name from it, so the two cannot drift');
}

console.log('[2] one tap cleans up a song');
{
  ok(count(src, "toolCard('cleanup'") === 1, 'the clean-up has a card');
  ok(src.indexOf("if(id === 'cleanup') return cleanUpSong();") !== -1, 'and the card opens it');
  ok(count(src, 'function cleanUpSong(){') === 1, 'the clean-up exists');
  ok(src.indexOf("editedCopy(t, { silent: true, fades: false, reverse: false, normalize: true, gainDb: 0 }, 192, 'clean')") !== -1,
    'it is the silence trim and the level match, saved at a fixed rate');
  ok(src.indexOf("toast('Cleaning up \"'") !== -1, 'and it says what it is doing first');
  ok(src.indexOf('markFeature(\'studio\')') !== -1, 'it counts as Studio use');
  ok(/function cleanUpSong\(\)\{[\s\S]{0,900}?\.catch\(function\(e\)\{/.test(src), 'and it fails with a message, not a silence');
  // The save path is the app's own, and it never writes over the library copy.
  const copyFn = src.slice(src.indexOf('function editedCopy(t, cfg, kbps, purpose){'), src.indexOf('function cleanUpSong(){'));
  ok(copyFn.indexOf('window.__scSaveClip(blob, fname)') !== -1, 'a copy is saved through the app save path');
  ok(copyFn.indexOf('__scPersistTrack') === -1, 'and nothing here writes over the stored song');
  ok(copyFn.indexOf("purpose + ').mp3'") !== -1, 'under a name that carries its purpose');
  ok(copyFn.indexOf('editRenderWith(b, cfg)') !== -1, 'rendered with the settings it was handed');
}

console.log('[3] the batch - one run, one progress line, both workers');
{
  ok(count(src, 'var batchRun = { mode:') === 1, 'there is one batch run');
  ok(count(src, 'function runBatch(mode){') === 1, 'and one loop over the selection');
  ok(src.indexOf("var ids = (call('__scSelectedIds') || []).slice();") !== -1, 'which reads the selection you can see');
  ok(src.indexOf("if(!songs.length){ toast('Tick the songs you want in Library first.'); return; }") !== -1,
    'and says so when there is nothing ticked');
  ok(src.indexOf('var work = (mode === \'reen\')') !== -1 && src.indexOf('reencodeOne(t, kbps)') !== -1,
    're-encode runs the re-encoder');
  ok(src.indexOf(": editedCopy(t, cfg, kbps, 'edit').then(function(){ });") !== -1,
    'and edit runs the rack over the copy');
  ok(src.indexOf('work.catch(function(){ batchRun.fails.push(t.id); }).then(function(){ batchRun.i++; step(); });') !== -1,
    'a song that cannot finish is recorded and the run carries on');
  ok(count(src, 'function batchProgressHtml(){') === 1, 'there is one progress line');
  ok(src.indexOf("id=\"scBatchLine\"") !== -1 && src.indexOf("id=\"scBatchDone\"") !== -1,
    'naming the song it is on, then what finished');
  ok(count(src, 'data-act="batchreen"') === 1 && count(src, 'data-act="batchedit"') === 1,
    'both batch buttons are offered');
  ok(src.indexOf("else if(act === 'batchreen') runBatch('reen');") !== -1 &&
     src.indexOf("else if(act === 'batchedit') runBatch('edit');") !== -1, 'and both answer');
  ok(count(src, 'data-reenk="') === 2, 'the bitrate chips are in the batch section too');
  ok(src.indexOf('>Re-encode selected</button>') !== -1 && src.indexOf('>Edit selected</button>') !== -1,
    'and the two buttons are named for the selection');
  ok(src.indexOf('(batchRun.busy ? \' disabled\' : \'\')') !== -1 || src.indexOf("(batchRun.busy ? ' disabled' : '')") !== -1,
    'a running batch disables its own buttons');
}

console.log('[4] the render is reused without being rewritten');
{
  ok(count(src, 'function editRender(buf){') === 1, 'the render keeps its signature');
  ok(count(src, 'function editRenderWith(buf, cfg){') === 1, 'and gets a config-aware face');
  ok(src.indexOf("var EDIT_KEYS = ['silent', 'fades', 'fadeIn', 'fadeOut', 'reverse', 'normalize', 'gainDb'];") !== -1,
    'the settings it swaps are named once');
  ok(/finally\{ for\(var j = 0; j < EDIT_KEYS\.length; j\+\+\) edit\[EDIT_KEYS\[j\]\] = saved\[EDIT_KEYS\[j\]\]; \}/.test(src),
    'and put back in a finally, so the rack is never left changed');
  ok(src.indexOf('if(!cfg) return editRender(buf);') !== -1, 'no config means the rack as it stands');
  // The rack's own operations are still written against `edit`, untouched.
  ok(src.indexOf('if(edit.silent){') !== -1 && src.indexOf('if(edit.fades){') !== -1, 'the render still reads the rack');
  ok(src.indexOf('var g = edit.gainDb ? Math.pow(10, edit.gainDb / 20) : 1;') !== -1, 'with the same sample math');
  ok(count(src, 'function editExport(){') === 1 && src.indexOf("var fname = base + ' (edit).mp3';") !== -1,
    'and saving from the rack is exactly as it was');
}

console.log('[5] the re-encode is callable, and the button still is');
{
  ok(count(src, 'function reencodeOne(t, kbps){') === 1, 'the re-encode is its own function');
  ok(count(src, 'function reencodeTrack(id, kbps, btn){') === 1, 'the button is still there');
  const btnFn = src.slice(src.indexOf('function reencodeTrack(id, kbps, btn){'), src.indexOf('\n  function undoReencode(id){'));
  ok(btnFn.indexOf('reencodeOne(t, kbps)') !== -1, 'and it runs the same code a batch does');
  ok(btnFn.indexOf('toastWithUndo(') !== -1 && btnFn.indexOf('undoReencode(id)') !== -1,
    'keeping its own undo chip');
  ok(btnFn.indexOf('__scEncodeMp3') === -1, 'so there is only one place the encode happens');
  const oneFn = src.slice(src.indexOf('function reencodeOne(t, kbps){'), src.indexOf('function reencodeTrack(id, kbps, btn){'));
  ok(oneFn.indexOf('__scPersistTrack') !== -1, 'which is what swaps the stored file');
  ok(/return saved;/.test(oneFn), 'and resolves with the bytes won back for the batch total');
  ok(oneFn.indexOf('toast(') === -1, 'while saying nothing itself, so a batch has one voice');
}

console.log('[6] what did not move');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries, 'the changelog still parses');
  if (entries) {
    const prev = entries.find((e) => String(e.version) === PREV);
    ok(!!prev, 'the ' + PREV + ' entry is still there');
    ok(!!prev && (prev.items || []).length >= 6, 'and still carries its notes (' + (prev ? prev.items.length : 0) + ')');
    ok(!!entries.find((e) => String(e.version) === '72.0'), 'and the 72.0 entry behind it');
  }
  ok(count(src, 'const APP_VERSION = ') === 1, 'one APP_VERSION in the page');
  ok(count(sw, "const CACHE_NAME = '") === 1, 'one CACHE_NAME in sw.js');
  ok(count(src, 'delete playlists[') === 1, 'there is still exactly one playlist delete in the app');
  ok(src.indexOf('function editPreview(){') !== -1 && src.indexOf('function openEditSheet(){') !== -1,
    'the rack still previews and still opens');
  ok(count(src, 'function openClipSheet(preStart, preEnd){') === 1, 'the clip maker is untouched');
  ok(src.indexOf('function cropCurrent(){') !== -1, 'and so is the cropper');
  // Every new path saves a copy; none of them swaps a stored file.
  ok(count(src, 'reencodeOne(t, kbps).then(') === 2, 'the re-encode runs from the button and from the batch');
}

console.log('[7] the repin moved every gate');
{
  const dev = path.join(ROOT, 'dev');
  const KEEPS = new Set(['test-705.mjs', 'test-70.mjs']);
  const files = fs.readdirSync(dev).filter((n) => /^test-.*\.mjs$/.test(n) || n === 'ota-update-check.cjs');
  ok(files.length > 20, 'there are the gates to check (' + files.length + ')');
  let staleVer = 0, staleCache = 0;
  const ownVer = 'const ' + 'VER' + " = '" + PREV + "'";
  for (const name of files) {
    if (KEEPS.has(name)) continue;
    const t = fs.readFileSync(path.join(dev, name), 'utf8');
    if (t.indexOf(ownVer) !== -1) staleVer++;
    if (t.indexOf('sidecut-shell-v' + PREV) !== -1) staleCache++;
  }
  ok(staleVer === 0, 'no gate still pins the previous version (' + staleVer + ')');
  ok(staleCache === 0, 'and none names the previous shell cache (' + staleCache + ')');
  const ota = fs.readFileSync(path.join(dev, 'ota-update-check.cjs'), 'utf8');
  ok(ota.indexOf("swCache === ('sidecut-shell-v' + APP_VERSION)") !== -1,
    'the published-bundle probe still asserts the cache is the release');
}

console.log('[8] inline script syntax');
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
