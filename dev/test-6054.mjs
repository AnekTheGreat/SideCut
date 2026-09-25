#!/usr/bin/env node
// v60.5.4 verification — the two reported problems, checked as BEHAVIOUR:
//
//   A. "on the play version downloads should be removed." The block-1 header
//      that does the removing is extracted from index.html and RUN against a
//      stub document, so what is asserted is the DOM it actually produces —
//      cards hidden, how-to rewritten, class set, summary renamed — not the
//      text of the source that does it.
//   B. "even on the full ver it says no source found." The real scHttpJson and
//      the real scSpToBuffer are extracted and driven: a first attempt that
//      answers non-200 no longer ends the request (the second shape answers),
//      a total failure leaves a WHY behind, and the three failure reasons are
//      told apart — transport (retry it), Play build (names itself), full build
//      (a real miss, said plainly).
//
// Plus release metadata and an acorn pass over every inline script.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a);
  return b === -1 ? null : src.slice(a, b);
}
const count = (s) => src.split(s).length - 1;

console.log('[1] Play build: downloads removed from the source');
ok(count('id="spCardDisc"') === 1, 'Discover Spotify card has an id');
ok(count('id="spCardSettings"') === 1, 'Settings Spotify card has an id');
ok(count('id="getSongsHowToDisc"') === 1, 'Discover how-to box has an id');
ok(count('id="getSongsHowToSettings"') === 1, 'Settings how-to box has an id');
ok(src.includes('.sc-play-build .discover-dl-btn,') &&
   src.includes('.sc-play-build .ah-dl-album-btn,') &&
   src.includes('.sc-play-build .ah-dl-track{ display:none !important; }'),
   'CSS cuts the three buttons only a render path creates');
ok(count("document.documentElement.classList.add('sc-play-build')") === 1,
   'only the block-1 header sets that class');
ok(/if\(SC_IS_PLAY\)\{\s*try\{\s*\['ytCardDisc','ytCardSettings'\]/.test(src),
   'the YouTube-card line is still the first statement (a test pins this)');
ok(count("['spCardDisc','spCardSettings'].forEach") === 1,
   'Spotify cards are hidden with them');
const spGate = src.indexOf('function convertSpToAudio(');
const spGateIf = src.indexOf('if(SC_IS_PLAY){', spGate);
ok(spGate !== -1 && spGateIf !== -1 && spGateIf - spGate < 400,
   'convertSpToAudio is hard gated like convertYtToMp3');
const ytGate = src.indexOf('function convertYtToMp3(');
const ytGateIf = src.indexOf('if(SC_IS_PLAY){', ytGate);
ok(ytGate !== -1 && ytGateIf !== -1 && ytGateIf - ytGate < 400,
   'convertYtToMp3 gate untouched');
ok(!src.includes("'Spotify \\u00b7 MP4 \\u00b7 Expand URL'"),
   'the summary no longer names tools this build does not have');

console.log('[2] Play build: the removal actually runs (block-1 executed)');
{
  // slice() excludes its end marker; this body needs the catch clause it ends
  // on, so it is cut by position with the marker included.
  const from = 'if(SC_IS_PLAY){\n  try{';
  const to = '}catch(_ePlayUI){}\n}';
  const a0 = src.indexOf(from), b0 = a0 === -1 ? -1 : src.indexOf(to, a0);
  const body = a0 === -1 || b0 === -1 ? null : src.slice(a0, b0 + to.length);
  ok(!!body, 'block-1 header extracted');
  const els = {};
  const el = (id) => (els[id] || (els[id] = { id, style: {}, innerHTML: '', textContent: '' }));
  const summaries = [{ textContent: 'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL' }];
  const classes = [];
  const document = {
    getElementById: (id) => el(id),
    querySelectorAll: () => summaries,
    documentElement: { classList: { add: (c) => classes.push(c) } },
  };
  try {
    new Function('SC_IS_PLAY', 'document', body)(true, document);
    ok(classes.includes('sc-play-build'), 'html carries the class that cuts the buttons');
    ok(els.spCardDisc.style.display === 'none' && els.spCardSettings.style.display === 'none',
       'both Spotify converter cards are hidden');
    ok(els.ytCardDisc.style.display === 'none' && els.ytCardSettings.style.display === 'none',
       'both YouTube converter cards are hidden');
    ok(String(els.getSongsHowToDisc.innerHTML).includes('+ Add songs') &&
       String(els.getSongsHowToSettings.innerHTML).includes('+ Add songs'),
       'both how-to boxes become an + Add songs note (ripper links gone with them)');
    ok(summaries[0].textContent === 'MP4 \u00b7 Expand URL',
       'summary reads: ' + summaries[0].textContent);
    ok(!String(els.getSongsHowToDisc.innerHTML).includes('spotisaver') &&
       !String(els.getSongsHowToSettings.innerHTML).includes('spotmate'),
       'no outside converter link survives in either box');
  } catch (e) {
    ok(false, 'block-1 threw: ' + e.message);
  }
  // The full build runs the same block with the flag off: nothing may change.
  const els2 = {}; const el2 = (id) => (els2[id] || (els2[id] = { id, style: {}, innerHTML: '', textContent: 'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL' }));
  const summaries2 = [{ textContent: 'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL' }];
  const classes2 = [];
  try {
    new Function('SC_IS_PLAY', 'document', body)(false, {
      getElementById: (id) => el2(id), querySelectorAll: () => summaries2,
      documentElement: { classList: { add: (c) => classes2.push(c) } },
    });
    ok(classes2.length === 0 && els2.spCardDisc === undefined &&
       summaries2[0].textContent.includes('Spotify'),
       'full build: the same block removes nothing');
  } catch (e) {
    ok(false, 'full-build run threw: ' + e.message);
  }
}

console.log('[3] Full build: the transport gets a second chance (scHttpJson executed)');
{
  const body = slice('  async function scHttpJson(url, bodyObj, ytClient){', '  // googlevideo no longer serves an unbounded request');
  ok(!!body, 'scHttpJson extracted');
  const make = () => {
    const calls = [];
    const win = {};
    const plugin = { request: async (opts) => { calls.push(opts); return plugin.next.shift(); } };
    plugin.next = [];
    const api = new Function('window', '__scCapHttp', 'fetch', body + '\nreturn scHttpJson;')(win, () => plugin, async () => ({ ok: false, status: 0 }));
    return { api, calls, plugin, win };
  };
  // A: first shape answers 403, second shape answers 200 -> still works.
  {
    const h = make();
    h.plugin.next.push({ status: 403, data: null });
    h.plugin.next.push({ status: 200, data: { ok: 1 } });
    const out = await h.api('https://www.youtube.com/youtubei/v1/player', { a: 1 });
    ok(out && out.ok === 1, 'a non-200 first attempt no longer ends the request');
    ok(h.calls.length === 2, 'the raw-body shape was the one that answered (' + h.calls.length + ' attempts)');
    ok(String(h.calls[0].headers['User-Agent'] || '').includes('Mozilla'),
       'the video host is asked with a browser-shaped request');
    ok(h.calls[0].responseType === 'json' && h.calls[1].responseType === undefined,
       'shape 1 is parsed JSON, shape 2 is the raw body');
    ok(h.win.__scHttpWhy === '', 'a success clears the why');
  }
  // B: everything fails -> null, and a WHY is left for the caller.
  {
    const h = make();
    h.plugin.next.push({ status: 429, data: null });
    h.plugin.next.push({ status: 429, data: null });
    const out = await h.api('https://example.org/x', null);
    ok(out === null, 'total failure still returns null');
    ok(!!h.win.__scHttpWhy, 'but it says why: ' + h.win.__scHttpWhy);
  }
  // C: no native plugin at all (browser) -> fetch path, still no throw.
  {
    const win = {};
    const api = new Function('window', '__scCapHttp', 'fetch', body + '\nreturn scHttpJson;')(
      win, () => null, async () => ({ ok: true, json: async () => ({ g: 2 }) }));
    const out = await api('https://example.org/y', { b: 1 });
    ok(out && out.g === 2, 'without the plugin it falls back to the page fetch');
  }
}

console.log('[4] Failure reasons: three messages, told apart (scSpToBuffer executed)');
{
  const body = slice('  async function scSpToBuffer(meta, onStatus){', '  // Artist-name check');
  ok(!!body, 'scSpToBuffer extracted');
  const run = async (mode, isPlay) => {
    const win = {};
    // The stub stands in for scYtSearch AND the transport behind it: it can
    // either die (leaving the why behind, as scHttpJson now does) or answer
    // with nothing. It closes over `win` — the harness's own window — so no
    // reference to a real global is ever made.
    const scYtSearch = async () => {
      if (mode === 'transport') win.__scHttpWhy = 'native request answered 429';
      return null;
    };
    const fn = new Function('window', 'SC_IS_PLAY', 'scYtSearch', 'toast',
      'async function scYtPlayer(){ return null; }\n' +
      'async function scFetchDecode(){ return null; }\n' +
      body + '\nreturn scSpToBuffer;')(win, isPlay, scYtSearch, () => {});
    const out = await fn({ title: 'T', artist: 'A', album: '' }, function () {});
    return { out, why: win.__scSourceFail };
  };
  const a = await run('transport', false);
  ok(a.out === null && /search could not reach the source .*429.*tap Convert to retry/.test(a.why || ''),
     'dead transport says so, with a retry: ' + a.why);
  const b = await run('empty', true);
  ok((b.why || '').startsWith('no source found') && b.why.includes('Play build'),
     'Play build names itself when the source answers with nothing: ' + b.why);
  const c = await run('empty', false);
  ok((c.why || '').startsWith('no source matched this track'),
     'full build calls a real miss what it is: ' + c.why);
}

console.log('[5] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];  ok(ver === '61.6', 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) {}
  ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
  if (entries) {
    ok(entries[0].date.endsWith('EDT'), 'date ends in EDT (' + entries[0].date + ')');
    ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  }
  ok(sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version');
  ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version + ' (a new Play build number)');
}

console.log('[6] inline script syntax');
let scriptIdx = 0, syntaxBad = 0;
{
  let i = 0;
  while (true) {
    const open = src.indexOf('<script', i);
    if (open === -1) break;
    const gt = src.indexOf('>', open);
    if (gt === -1) break;
    if (src.slice(open, gt).includes('src=')) { i = gt + 1; continue; }
    const close = src.indexOf('</script>', gt);
    if (close === -1) break;
    scriptIdx++;
    try { acorn.parse(src.slice(gt + 1, close), { ecmaVersion: 2022, sourceType: 'script' }); }
    catch (e) { syntaxBad++; console.log('  FAIL script#' + scriptIdx + ': ' + e.message); }
    i = close + 9;
  }
}
ok(scriptIdx >= 2, 'inline scripts found: ' + scriptIdx);
ok(syntaxBad === 0, 'inline script syntax failures: ' + syntaxBad);

console.log('');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
