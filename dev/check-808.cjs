#!/usr/bin/env node
// 80.8 - hold a song and drag: the run under the finger is the selection.
//
// Driven, not grepped: the gesture block is lifted out of the shipped page and run in
// a vm against a fake list of six rows - hold then drag down, drag back up, pull back
// to the anchor, a point with no row under it, a hold that lifts without moving, a tap,
// a scroll that starts before the hold arms, and the click the lift itself sends.
//
//   node dev/check-808.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.8';

let pass = 0;
const failures = [];
function ok(name, cond) {
  if (cond) { pass++; } else { failures.push(name); }
}

// ---- the two channel filters, copied from the bundlers ---------------------
const FULL_DROP = /(streaming|streams?\b|from the source|pinned artist)/i;
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
function fullNotes(items) {
  const shown = (items || [])
    .map((it) => (typeof it === 'string' && it.startsWith('[FULL] ')) ? it.slice(7) : it)
    .filter((it) => typeof it !== 'string' || !FULL_DROP.test(it));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}
function playNotes(items) {
  const shown = (items || [])
    .filter((it) => typeof it !== 'string' || (!it.startsWith('[FULL] ') && !hidesOnPlay(it)));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}

// ---- the fake list --------------------------------------------------------
function boot() {
  const start = html.indexOf('  let scHold = null;');
  const end = html.indexOf('  function openHoldChoice(id){');
  if (start < 0 || end < 0 || end < start) return null;
  const block = html.slice(start, end);

  const HOOK = { renderList: 0, holdChoice: [], buzz: 0 };
  const rows = [];
  function mkRow(id) {
    const el = { dataset: { id }, _cls: new Set(), _check: null, firstChild: null, _l: {}, _idx: { style: { display: '' } } };
    el.classList = {
      add: (c) => { el._cls.add(c); },
      remove: (c) => { el._cls.delete(c); },
      contains: (c) => el._cls.has(c),
      toggle: (c, on) => { if (on) el._cls.add(c); else el._cls.delete(c); return !!on; }
    };
    el.querySelector = (s) => (s === '.select-check' ? el._check : (s === '.idx' ? el._idx : null));
    el.insertBefore = (node) => { el._check = node; };
    el.closest = (s) => (s === '.track' ? el : null);
    el.addEventListener = (t, f) => { (el._l[t] = el._l[t] || []).push(f); };
    return el;
  }
  for (let i = 0; i < 6; i++) rows.push(mkRow('t' + (i + 1)));

  const pane = {
    scrollTop: 0, _l: {},
    querySelectorAll: () => rows,
    contains: () => true,
    getBoundingClientRect: () => ({ top: 0, bottom: 800 }),
    addEventListener: (t, f) => { (pane._l[t] = pane._l[t] || []).push(f); },
    removeEventListener: (t, f) => { pane._l[t] = (pane._l[t] || []).filter((x) => x !== f); }
  };

  const byId = {};
  function mkEl() {
    const cls = new Set();
    return {
      id: '', className: '', textContent: '', style: {}, _cls: cls,
      classList: { add: (c) => cls.add(c), remove: (c) => cls.delete(c), contains: (c) => cls.has(c), toggle: (c, on) => { if (on) cls.add(c); else cls.delete(c); return !!on; } },
      remove() {}, insertBefore() {}, appendChild() {}, querySelector() { return null; }
    };
  }
  const bodyCls = new Set();
  const doc = {
    body: {
      classList: { add: (c) => bodyCls.add(c), remove: (c) => bodyCls.delete(c), contains: (c) => bodyCls.has(c) },
      appendChild: (el) => { byId[el.id] = el; }
    },
    createElement: () => mkEl(),
    getElementById: (id) => byId[id] || (id === 'listPane' ? pane : null),
    elementFromPoint: (x, y) => rows[Math.floor(y / 100)] || null,
    addEventListener() {}, removeEventListener() {}
  };
  const win = {
    _l: {},
    addEventListener: (t, f) => { (win._l[t] = win._l[t] || []).push(f); },
    removeEventListener: (t, f) => { win._l[t] = (win._l[t] || []).filter((x) => x !== f); }
  };

  const src = '(function(){\n'
    + 'let selectMode = false; let selectedIds = new Set(); let reorderMode = false;\n'
    + "function $(id){ return id === 'listPane' ? PANE : null; }\n"
    + 'function renderList(){ HOOK.renderList++; }\n'
    + 'function openHoldChoice(id){ HOOK.holdChoice.push(id); }\n'
    + block
    + '\nreturn { attach: attachLongPressChoice, sel: () => Array.from(selectedIds), mode: () => selectMode };\n})()';

  const ctx = {
    HOOK, PANE: pane, document: doc, window: win,
    navigator: { vibrate: () => { HOOK.buzz++; } },
    setTimeout, clearTimeout, Date, Set, Math, Array, Object, JSON, console
  };
  let api = null;
  try { api = vm.runInNewContext(src, ctx); } catch (e) { return null; }

  const evt = (x, y) => ({
    clientX: x, clientY: y, button: 0, defaultPrevented: false,
    target: { closest: () => null },
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.stopped = true; }
  });
  return {
    api, rows, pane, HOOK, evt,
    pill: () => doc.getElementById('scRangeCount'),
    down: (row, ev) => (row._l.pointerdown || []).slice().forEach((f) => f(ev)),
    fire: (t, ev) => (win._l[t] || []).slice().forEach((f) => f(ev)),
    click: (ev) => (pane._l.click || []).slice().forEach((f) => f(ev))
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// The page wires each row from renderList(); the fake list asks for the same.
const rows_arm = (h) => h.rows.forEach((r) => h.api.attach(r, r.dataset.id));

// ---- the release -----------------------------------------------------------
ok('the page is 80.8', html.includes("const APP_VERSION = '80.8';"));
ok('the page carries the gesture', html.includes('function scHoldRelease(swept){')
  && html.includes('function scRangeTo(id){') && html.includes('function scRangePaint(){'));
ok('the hold no longer opens the sheet on a timer', !/openHoldChoice\(id\);\s*\n\s*\}, 450\);/.test(html));
ok('the sweep has a look', html.includes('body.scRanging .track, body.scRanging #listPane')
  && html.includes('#scRangeCount.on{'));

const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.8 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(it)));
ok('the entry sits at the top of the changelog', entries.findIndex((e) => String(e.version) === VERSION) === 0);
ok('every note is marked for the full build only', items.every((it) => String(it).startsWith('[FULL] ')));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('the Play card falls back rather than advertising what it cannot do',
  JSON.stringify(playNotes(items)) === JSON.stringify(['Fixes and improvements under the hood.']));

// ---- the gesture, driven ---------------------------------------------------
(async () => {
  {
    const h = boot();
    ok('the gesture lifts out of the shipped page', !!h);
    if (h) {
      rows_arm(h);
      h.down(h.rows[1], h.evt(10, 150));
      await sleep(360);
      ok('the hold arms the row', h.rows[1].classList.contains('sc-held'));
      ok('the hold opens nothing while the finger is down', h.HOOK.holdChoice.length === 0);
      ok('the hold buzzes', h.HOOK.buzz >= 1);
      h.fire('pointermove', h.evt(12, 350));
      ok('the drag selects the run from the held row', h.api.mode() === true && h.api.sel().join(',') === 't2,t3,t4');
      ok('the list is not rebuilt mid-drag', h.HOOK.renderList === 0);
      ok('the crossed rows are painted', h.rows[2].classList.contains('selected') && !!h.rows[2].querySelector('.select-check'));
      ok('the row above the anchor stays out of the run', !h.rows[0].classList.contains('selected'));
      const pill = h.pill();
      ok('the count rides at the top and reads the run', !!pill && pill.textContent === '3 songs selected' && pill.classList.contains('on'));
      const before = h.pane.scrollTop;
      h.fire('pointermove', h.evt(12, 786));
      ok('a sweep near the edge scrolls the list under itself', h.pane.scrollTop > before);
      h.fire('pointermove', h.evt(12, 50));
      ok('dragging back up selects the run above the anchor', h.api.sel().join(',') === 't1,t2');
      h.fire('pointermove', h.evt(12, 150));
      ok('pulling back to the anchor leaves one song', h.api.sel().join(',') === 't2');
      ok('one song reads as one song', !!pill && pill.textContent === '1 song selected');
      h.fire('pointermove', h.evt(12, -400));
      ok('a point with no row under it leaves the selection alone', h.api.sel().join(',') === 't2');
      h.fire('pointerup', h.evt(12, 150));
      ok('lifting keeps the selection', h.api.mode() === true && h.api.sel().join(',') === 't2');
      ok('lifting draws the list once', h.HOOK.renderList === 1);
      ok('the count is hidden on lift', !pill.classList.contains('on'));
      const e = h.evt(12, 150);
      h.click(e);
      ok('the click the lift itself sends is swallowed', e.defaultPrevented === true && e.stopped === true);
    }
  }
  {
    const h = boot();
    if (h) {
      rows_arm(h);
      h.down(h.rows[2], h.evt(10, 250));
      await sleep(360);
      h.fire('pointerup', h.evt(10, 250));
      ok('a hold that does not move still opens the sheet', h.HOOK.holdChoice.join(',') === 't3');
      ok('a hold that does not move selects nothing', h.api.mode() === false && h.api.sel().length === 0);
      ok('a hold that does not move does not re-render', h.HOOK.renderList === 0);
    }
  }
  {
    const h = boot();
    if (h) {
      rows_arm(h);
      h.down(h.rows[0], h.evt(10, 50));
      await sleep(40);
      h.fire('pointerup', h.evt(10, 50));
      ok('a tap is still a tap', h.HOOK.holdChoice.length === 0 && h.HOOK.renderList === 0
        && h.api.sel().length === 0 && !h.rows[0].classList.contains('sc-held'));
    }
  }
  {
    const h = boot();
    if (h) {
      rows_arm(h);
      h.down(h.rows[0], h.evt(10, 50));
      await sleep(60);
      h.fire('pointermove', h.evt(10, 92));
      await sleep(320);
      ok('a move before the hold arms never tints the row', !h.rows[0].classList.contains('sc-held'));
      h.fire('pointerup', h.evt(10, 92));
      ok('a scroll selects nothing and opens nothing', h.HOOK.holdChoice.length === 0
        && h.api.sel().length === 0 && h.HOOK.renderList === 0);
    }
  }

  // ---- both channels -------------------------------------------------------
  const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null, hold = null;
  try { full = rd('ota/updates.json'); } catch (e) { full = null; }
  try { play = rd('ota-play/updates.json'); } catch (e) { play = null; }
  try { hold = rd('dev/channel-hold.json'); } catch (e) { hold = null; }
  ok('the full channel is v80.8', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is not held', !!hold && hold.play === false);
  ok('the Play channel is v80.8', !!play && String(play.version) === VERSION);
  ok('the Play channel publishes the fallback, not the feature', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page carries the gesture',
    /const APP_VERSION = '80\.8';/.test(zipped) && zipped.includes('function scHoldRelease(swept)'));
  ok('the shipped Play page is the same page with its flag',
    /const APP_VERSION = '80\.8';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true'));

  if (failures.length) {
    console.log('check-808: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-808: ' + pass + ' passed, 0 failed');
})();
