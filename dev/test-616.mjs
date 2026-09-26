// v61.6 — the song lookup that reported "nothing", the freeze when saving a song
// from a video link, and the Mark-all button that sat under the whole list.
//
// These are the 61.6 assertions, so the release metadata is read from the 61.6
// ENTRY rather than from the head of the changelog: 61.7 (and everything after
// it) heads the list now, exactly as this release stopped heading it when it
// shipped.
//
// Every check runs against the SHIPPED source in index.html. The three code
// fixes are asserted in the shape they ship in (the client list, the stream
// gatherer's limit, the cooperative encoder call site), not against a copy, and
// the mark-all assertion is the ORDER of the markup — the button has to appear
// before the release rows, both in the panel's HTML and in the renderer that
// re-inserts it on every open.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from + ' .. ' + to);
  return src.slice(a, b);
}

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '63.0.6', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  const rel = entries.find((e) => String(e.version) === '61.6');
  ok(!!rel, 'the 61.6 entry is still in the changelog');
  ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
  const headText = (rel ? rel.items : []).join(' ');
  ok(/Mark all as read/.test(headText), 'the notes mention where mark-all lives now');
  ok(!/play build|play version|play install/i.test(headText), 'notes never name the play build');
}
ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v"), 'service worker has a versioned cache name');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

console.log('[2] the player client list keeps only what answers');
{
  const region = sliceBetween('// Measured live against this exact request shape', 'function deco(f){');
  // The comment block NAMES the retired clients (that is the point of it), so
  // only the code may be counted.
  const code = region.replace(/^\s*\/\/.*$/gm, '');
  const names = (code.match(/clientName: '([A-Z_0-9]+)'/g) || []);
  ok(names.length === 2, 'client entries in the live list: ' + names.length);
  ok(/\bclientName: 'ANDROID'/.test(code), 'ANDROID is asked');
  ok(/\bclientName: 'IOS'/.test(code), 'IOS is asked');
  ['ANDROID_VR', 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', 'WEB_EMBEDDED_PLAYER', 'MWEB', 'IOS_MUSIC',
   'ANDROID_MUSIC', 'ANDROID_CREATOR', 'IOS_CREATOR', 'WEB_CREATOR', 'TVHTML5'].forEach(function(n){
    ok(code.indexOf(n) === -1, 'no dead client is asked (' + n + ')');
  });
  ok(/Re-probe before/.test(region), 'the comment tells the next person to re-probe, not to guess');
}

console.log('[3] the lookup keeps several streams, not one');
{
  const take = sliceBetween('var take = function(list, wantMuxed, into, want){', 'for(var c = 0; c < clients.length; c++){');
  ok(/var limit = \(typeof want === 'number' && want > 0\) \? want : 1;/.test(take), 'the gatherer takes a limit');
  ok(/got < limit/.test(take), 'and stops at that limit, keeping more than one row');
  ok(/return got;/.test(take), 'it reports how many it kept');
  ok(src.includes('take(d.streamingData.adaptiveFormats, false, audioStreams, 3);'), 'three audio-only variants per client');
  ok(src.includes('take(d.streamingData.formats, true, muxedStreams, 2);'), 'two progressive muxed variants behind them');
  ok(!/take\(d\.streamingData\.adaptiveFormats, false, audioStreams\);/.test(src), 'the single-candidate call is gone');
}

console.log('[4] saving a song from a video link yields the thread');
{
  const path621 = sliceBetween("var ytAuthor = '';", 'var _libClean = cleanOnImport');
  ok(path621.includes('scEncodeAudioCooperative(dec.buffer, fmt,'), 'the video path uses the cooperative encoder');
  ok(!path621.includes('scEncodeAudio(dec.buffer'), 'the plain, unbroken encoder is not called from here');
  ok(/setStatus\('Encoding ' \+ fmt\.toUpperCase\(\)/.test(path621), 'and the status line shows the encode progress');
  const coop = sliceBetween('async function scEncodeAudioCooperative(buf, fmt, meta, onSlice){', 'A finished conversion IS a library song');
  ok(coop.includes('scEncodeMp3Cooperative'), 'mp3 goes to the slicing encoder');
  ok(coop.includes('scEncodeWavCooperative'), 'wav too');
  const mp3 = sliceBetween('function scEncodeMp3Cooperative', 'function scEncodeWavCooperative');
  ok(mp3.includes('SC_ENCODE_SLICE_MS'), 'and the mp3 loop yields every slice');
}

console.log('[5] mark-all as read sits at the TOP of the New releases panel');
{
  const hb = sliceBetween("else if(kind === 'newreleases'){", "else if(kind === 'nowplaying'){");
  const iCount = hb.indexOf('id="hbRelCount"');
  const iMark = hb.indexOf('id="hbCtaMarkSeen"');
  const iRows = hb.indexOf('all.map(rel => {');
  ok(iCount !== -1 && iMark !== -1 && iRows !== -1, 'panel markup found (count, button, rows)');
  ok(iCount < iMark, 'the button is rendered under the release count');
  ok(iMark < iRows, 'and ABOVE every release row');
  ok(!/\}\)\.join\(''\) \+\s*\n\s*'<button class="hb-cta hb-markread"/.test(hb), 'nothing appends it after the rows any more');
  ok(hb.includes("_markSeenBtn.addEventListener('click'"), 'the button still marks the list seen');
  const switcher = sliceBetween('window.__scDiscRelTab = function(mode, root){', 'function openDiscoverPopup');
  ok(switcher.includes("root.querySelector('#hbRelCount')"), 'the tab renderer places the button against the count line');
  ok(switcher.includes('root.insertBefore(mr, _markAfter.nextSibling)'), 'with insertBefore, not an append');
  ok(!switcher.includes('root.appendChild(mr)'), 'the old append-after-the-rows is gone');
  ok(switcher.includes("mr.style.display = upcoming ?"), 'it still hides on the Upcoming tab (it acts on the whole list)');
  ok(src.includes('.hb-cta.hb-markread{ display:flex; align-items:center; justify-content:center; gap:8px; margin:0 0 12px; }'),
    'its gap moved below it, where it now sits');
}

console.log('[6] inline script syntax');
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

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
