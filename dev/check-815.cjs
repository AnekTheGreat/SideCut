#!/usr/bin/env node
/**
 * 81.5 verifier - the Library pill always opens the library, cropping is done by ear,
 * Studio has DJ sets, and the cloud layout has room.
 *
 * The reading is not enough for the parts that are arithmetic or a decision, so those
 * are LIFTED OUT OF THE PAGE AND RUN: scShelfAway is handed four screens, djMixOrder is
 * handed an unordered run, djSetStats and djClock are handed real numbers.
 *
 *   node dev/check-815.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '81.5';

let pass = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  failures.push(name + (extra ? ' (' + extra + ')' : ''));
}

function fnSrc(name) {
  const head = '  function ' + name + '(';
  const i = PAGE.indexOf(head);
  if (i < 0) return '';
  const open = PAGE.indexOf('{', i);
  let depth = 0, k = open;
  for (; k < PAGE.length; k++) {
    const ch = PAGE[k];
    if (ch === "'" || ch === '"' || ch === '`') {
      const q = ch;
      for (k++; k < PAGE.length; k++) {
        if (PAGE[k] === '\\') { k++; continue; }
        if (PAGE[k] === q) break;
      }
      continue;
    }
    if (ch === '/' && PAGE[k + 1] === '/') { while (k < PAGE.length && PAGE[k] !== '\n') k++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { k++; break; } }
  }
  return PAGE.slice(i, k);
}

function run(body, names) {
  const ctx = { module: {}, console, window: {}, document: {}, setTimeout, localStorage: { getItem: () => null, setItem: () => {} } };
  vm.createContext(ctx);
  const src = fnSrc(body);
  if (!src) throw new Error('could not lift ' + body);
  vm.runInContext(src + '\n' + (names || ''), ctx);
  return ctx;
}

// ─── [1] release ────────────────────────────────────────────────────────────
ok('the page is ' + VERSION, PAGE.includes("const APP_VERSION = '81.5';")
  && PAGE.indexOf("const APP_VERSION = '81.4';") === -1);
const CL = PAGE.slice(PAGE.indexOf('const CHANGELOG = ['), PAGE.indexOf("  { version: '81.4',"));
ok('the head entry is 81.5', CL.includes("{ version: '81.5',"));
const notes = (CL.match(/'\[FULL\] [^']*'/g) || []).map(s => s.slice(1, -1));
ok('three notes', notes.length === 3, String(notes.length));
ok('every note is marked full', notes.every(n => n.startsWith('[FULL] ')));
ok('no note carries an apostrophe', notes.every(n => n.indexOf("'") === -1 && n.indexOf('\u2019') === -1));
const DROP = /streaming|streams?\b|from the source|pinned artist/;
ok('no note trips the updater filter', notes.every(n => !DROP.test(n)), notes.filter(n => DROP.test(n)).join(' | '));

// ─── [2] the Library pill ───────────────────────────────────────────────────
ok('the shelf has a fact about the screen', fnSrc('scShelfAway').length > 100);
ok('opening a page takes a force', PAGE.includes('function scShelfOpenTab(tab, force){'));
ok('"already up" answers the screen, not the store',
  PAGE.includes('var already = !force && !scShelfAway() && (page === scShelf.page) &&'));
ok('the source side of the pill passes the force',
  PAGE.includes("scShelfOpenTab('library', (typeof scShelfAway === 'function') ? scShelfAway() : false);"));
ok('a throw in the picking cannot take the navigation with it',
  PAGE.includes('try{ activePlaylist = pickReal(); }catch(_eLibPick){ activePlaylist = \'All Songs\'; }')
  && PAGE.includes("    navigate('library');\n    try{ renderTabs(); }catch(_eLibTabs){}"));
ok('the scroll flag is guarded too', PAGE.includes('if(autoScrollToSong && renderListInner)'));

// RUN: four screens, and what the pill must do on each.
{
  const ctx = run('scShelfAway');
  const el = (cls, display) => ({ classList: { contains: c => (cls || '').indexOf(c) !== -1 }, style: { display: display || '' } });
  const screen = (map) => {
    ctx.document.getElementById = (id) => (id in map ? map[id] : null);
    return ctx.scShelfAway();
  };
  ok('from Studio the library is away', screen({ library: el('', 'none'), studioView: el('active'), homeView: el(''), discoverView: el('') }) === true);
  ok('from Tools (same view, other half) it is away', screen({ library: el('', 'none'), studioView: el('active'), homeView: el(''), discoverView: el('') }) === true);
  ok('from Home it is away', screen({ library: el('', 'none'), studioView: el(''), homeView: el('active'), discoverView: el('') }) === true);
  ok('standing in the library it is not away', screen({ library: el('', 'flex'), studioView: el(''), homeView: el(''), discoverView: el('') }) === false);
  ok('with no page at all it is away', screen({}) === true);
}

// ─── [3] cropping by ear ────────────────────────────────────────────────────
ok('the clip sheet keeps a player', PAGE.includes("audio: null, aUrl: '', at: 0, loop: false, playing: false"));
ok('opening a sheet stops the last one', PAGE.includes("  function openClipSheet(preStart, preEnd){\n    scClipHalt();"));
ok('the bar has a playhead', PAGE.includes('<div class="sc-cliphead" id="scClipHead"></div>'));
ok('both edges can be grabbed', PAGE.includes('id="scClipGrabStart" data-clipgrab="from"')
  && PAGE.includes('id="scClipGrabEnd" data-clipgrab="to"'));
ok('the transport exists', PAGE.includes('id="scClipPlayBtn"') && PAGE.includes('id="scClipStopBtn"') && PAGE.includes('id="scClipLoopBtn"'));
ok('the moment you hear can become the start or the end',
  PAGE.includes('id="scClipSetFrom">Set the start here') && PAGE.includes('id="scClipSetTo">Set the end here'));
ok('pressing the bar plays from there', PAGE.includes("if(mode === 'seek'){ paintClipHead(); clipPlay(clip.at); }"));
ok('the range stops the sound at its own end', PAGE.includes('if(clip.end > clip.start && clip.at >= clip.end - 0.03)'));
ok('loop keeps the range going', PAGE.includes('if(clip.loop){ try{ a.currentTime = clip.start; }'));
ok('the playhead is placed from the same painter as the selection',
  fnSrc('paintClipSel').includes("var gs = $('scClipGrabStart')") && fnSrc('paintClipSel').includes('paintClipHead()'));
ok('a repaint cannot bind the bar twice', PAGE.includes('if(bar && !bar.__sc815)'));
ok('the audio is object URL from the song file', PAGE.includes('clip.aUrl = URL.createObjectURL(t.file);'));

// ─── [4] DJ sets ────────────────────────────────────────────────────────────
ok('the sets are stored', PAGE.includes("var DJ_KEY = 'sc80DjSets';"));
ok('the two presets are the two the owner named',
  PAGE.includes("{ name: 'Wedding', fade: 4,") && PAGE.includes("{ name: 'Reception', fade: 2,"));
ok('a set holds an order', PAGE.includes('entries: [], at: Date.now()'));
ok('the working song is what gets added', PAGE.includes('data-dj="add"'));
ok('playing a set writes a real playlist',
  PAGE.includes("var name = 'Set: ' + (set.name || 'DJ set');") && PAGE.includes('window.__scSetPlaylist(name, ids)'));
ok('the card is drawn in the Studio half',
  PAGE.includes("paneStudio.insertAdjacentHTML('beforeend', djSetsCard());"));
ok('the card is wired once per paint', PAGE.includes('wireDjSets(paneStudio);'));

// RUN: the tempo sort and the arithmetic.
{
  const ctx = run('djMixOrder', 'var ctx = {};');
  const mixed = ctx.djMixOrder([
    { name: 'C', bpm: 0 },
    { name: 'A', bpm: 128 },
    { name: 'B', bpm: 90 },
    { name: 'D', bpm: 0 }
  ]);
  ok('a known tempo sorts before an unknown one', mixed[0].name === 'B' && mixed[1].name === 'A', mixed.map(e => e.name).join(','));
  ok('two unknown tempos keep their own order', mixed[2].name === 'C' && mixed[3].name === 'D', mixed.map(e => e.name + e.bpm).join(','));
  ok('the sort does not write into the set it was handed',
    (() => {
      const input = [{ name: 'A', bpm: 100 }, { name: 'B', bpm: 90 }];
      ctx.djMixOrder(input);
      return input[0].name === 'A';
    })());
}
{
  const ctx = run('djSetStats');
  const s = ctx.djSetStats({ fade: 4, gap: 0, entries: [
    { secs: 200, bpm: 120 }, { secs: 180, bpm: 0 }, { secs: 220, bpm: 128 }
  ] });
  ok('every song is counted', s.count === 3, String(s.count));
  ok('one blend per join is given back', s.secs === 600 && s.total === 592, s.secs + '/' + s.total);
  ok('the tempos that were read are counted', s.known === 2, String(s.known));
  ok('an empty set is zero, not a negative', ctx.djSetStats({ fade: 4, entries: [] }).total === 0);
  ok('one song has no blend to give back', ctx.djSetStats({ fade: 4, entries: [{ secs: 200 }] }).total === 200);
}
{
  const ctx = run('djClock');
  ok('minutes and seconds', ctx.djClock(75) === '1:15', ctx.djClock(75));
  ok('an hour is an hour', ctx.djClock(3725) === '1:02:05', ctx.djClock(3725));
  ok('a set under a minute still reads', ctx.djClock(9) === '0:09', ctx.djClock(9));
}

// ─── [5] the cloud layout ───────────────────────────────────────────────────
ok('the cloud bubbles get room', PAGE.includes('body.sc80-cloud #homeBubbles{ gap: 14px; padding: 6px 2px 26px; }'));
ok('the cloud now bar is capped', PAGE.includes('body.sc80-cloud #sc80Now{ max-width: min(62vw, 260px); }'));
ok('the cloud dock is glass', PAGE.includes('body.sc80-cloud .action-strip{ backdrop-filter: blur(12px);'));
ok('the cloud bubbles answer a press', PAGE.includes('body.sc80-cloud .home-bubble:active{ transform: scale(0.96); }'));
ok('a narrow cloud phone still reads', PAGE.includes('body.sc80-cloud .home-bubble .hb-value{ font-size: calc(20px * var(--hb-s, 1)); }'));

// ─── [6] the whole page still parses ────────────────────────────────────────
{
  const scripts = PAGE.match(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0;
  scripts.forEach((s, i) => {
    const body = s.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    if (!body.trim()) return;
    try { new vm.Script(body, { filename: 'inline-' + i + '.js' }); }
    catch (e) { bad++; failures.push('inline script ' + i + ' does not parse: ' + e.message); }
  });
  ok('every inline script compiles', bad === 0, String(scripts.length) + ' blocks');
}

// ─── report ─────────────────────────────────────────────────────────────────
if (failures.length) {
  console.log('check-815: ' + pass + ' passed, ' + failures.length + ' failed');
  failures.forEach(f => console.log('  FAIL ' + f));
  process.exit(1);
}
console.log('check-815: ' + pass + ' passed, 0 failed');
