#!/usr/bin/env node
/*
 * 80.9 - does a streamed song survive the app going away?
 *
 * Two faults were found by reading, and both are DRIVEN here rather than grepped:
 *
 *   1. the timer wrapper. The battery saver replaces setInterval, stops every tracked
 *      interval on hide, and offers __scKeepAliveTimer to the one timer that must not
 *      stop. That helper only set keep = true - it never started a timer the saver had
 *      already stopped, which is exactly the state a stream resumed from the
 *      notification is in. Run against a fake clock: a 30s timer created while hidden
 *      must be stopped, and marking it kept must leave it running.
 *   2. the hold. SideCutJob is a pair of calls (hold/release) with no reference count,
 *      so two owners releasing independently would stop the phone's wake lock and
 *      foreground service for each other. The whole arbiter is run against a fake
 *      plugin: one hold for two owners, one release when the last one is done, and no
 *      call at all - and no throw - on a build with no plugin.
 *
 * Then the page itself: the version, the heartbeat marked kept, the stream events
 * wired to the hold, one hold call site and one release call site, three notes that
 * survive the updater's own filter, every inline script compiling, and both OTA
 * channels carrying 80.9 with their page inside.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let passed = 0;
const failures = [];
function ok(name, cond, detail) {
  if (cond) { passed++; return true; }
  failures.push(name + (detail ? ' - ' + detail : ''));
  return false;
}
function eq(name, got, want) {
  return ok(name, got === want, 'got ' + JSON.stringify(got) + ', wanted ' + JSON.stringify(want));
}
function sliceAround(startAnchor, endAnchor, what) {
  const a = PAGE.indexOf(startAnchor);
  if (a < 0) throw new Error(what + ': the start is not on the page');
  const b = PAGE.indexOf(endAnchor, a);
  if (b < 0) throw new Error(what + ': the end is not on the page');
  return PAGE.slice(a, b);
}

// ---------------------------------------------------------------- 1. the clock
function driveTimers() {
  const log = [];
  let nextId = 1;
  const fakeWindow = {
    setInterval(fn, ms) { const id = nextId++; log.push({ op: 'start', id, fn, ms }); return id; },
    clearInterval(id) { log.push({ op: 'stop', id }); },
    addEventListener() {},
    removeEventListener() {},
  };
  const fakeDocument = { hidden: true, addEventListener() {} };
  const sandbox = { window: fakeWindow, document: fakeDocument, navigator: {}, console };
  vm.createContext(sandbox);

  const block = sliceAround('// ---- Battery saver: kill expensive timers',
                            '// ---- Boot error visibility', 'the battery saver');
  const cut = block.lastIndexOf('})();');
  ok('the battery saver block closes', cut > 0);
  vm.runInContext(block.slice(0, cut + 5), sandbox, { filename: 'battery-saver.js' });

  // A timer born with the app already hidden is started stopped by the interceptor.
  const id = sandbox.window.setInterval(() => {}, 30000);
  const before = log.filter((e) => e.id === id);
  ok('a timer born hidden is started then stopped',
     before.length === 2 && before[0].op === 'start' && before[1].op === 'stop',
     JSON.stringify(before));

  // Marking it kept must start it again - the 80.9 fix. A restarted interval gets a
  // fresh id from the real setInterval, so the proof is a second start and a live tail.
  sandbox.window.__scKeepAliveTimer(id);
  const starts = log.filter((e) => e.op === 'start');
  ok('a kept timer that was born hidden is running',
     starts.length === 2 && log[log.length - 1].op === 'start',
     JSON.stringify(log));

  // A kept timer created while visible is left alone and survives a hide.
  const visId = (() => { fakeDocument.hidden = false; return sandbox.window.setInterval(() => {}, 1000); })();
  ok('a visible timer runs', log.filter((e) => e.id === visId && e.op === 'stop').length === 0);
  sandbox.window.__scKeepAliveTimer(visId);
  fakeDocument.hidden = true;
  sandbox.document.dispatch = null;
  ok('marking a visible timer kept does not restart it',
     log.filter((e) => e.id === visId).length === 1, JSON.stringify(log.filter((e) => e.id === visId)));
}

try {
  driveTimers();
} catch (e) {
  failures.push('the clock could not be driven - ' + e.message);
}

// ---------------------------------------------------------------- 2. the hold
function driveHold() {
  const calls = [];
  function makePlugin() {
    return {
      hold(d) { calls.push({ m: 'hold', d }); return Promise.resolve({ running: true }); },
      update(d) { calls.push({ m: 'update', d }); return Promise.resolve(); },
      release() { calls.push({ m: 'release' }); return Promise.resolve(); },
    };
  }
  const body = sliceAround('  function scJobPlugin(){', '  function scRunJobStart(title, sub){', 'the hold block');

  function build(withPlugin) {
    const sandbox = {
      console,
      navigator: {},
      Promise,
      scRunJob: { depth: 0, release: null, native: false, title: 'Conversion', notedAt: 0 },
      scStreamSong() { return { name: 'So High', artist: 'Diljit Dosanjh' }; },
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    sandbox.Capacitor = withPlugin ? { Plugins: { SideCutJob: makePlugin() } } : undefined;
    vm.runInContext(body, sandbox, { filename: 'hold.js' });
    return sandbox;
  }

  // No plugin: the calls must be no-ops that never throw.
  let s = build(false);
  let threw = '';
  try {
    s.scHoldWant('stream');
    s.scHoldDrop('stream');
    s.scHoldWant('job');
    s.scHoldDrop('job');
  } catch (e) { threw = e.message; }
  eq('a build with no plugin holds nothing and throws nothing', threw, '');
  eq('a build with no plugin calls nothing', calls.length, 0);

  // Stream only.
  calls.length = 0;
  s = build(true);
  s.scHoldWant('stream');
  eq('a playing song takes the hold once', calls.filter((c) => c.m === 'hold').length, 1);
  eq('the hold names the song', (calls[0] && calls[0].d && calls[0].d.title) || '', 'So High \u00b7 Diljit Dosanjh');
  s.scHoldWant('stream');
  eq('asking twice does not hold twice', calls.filter((c) => c.m === 'hold').length, 1);
  s.scHoldDrop('stream');
  eq('the last owner releases the phone', calls.filter((c) => c.m === 'release').length, 1);
  s.scHoldDrop('stream');
  eq('dropping twice does not release twice', calls.filter((c) => c.m === 'release').length, 1);

  // Both owners, in each order: one hold, one release, never a release under the other.
  for (const order of [['job', 'stream'], ['stream', 'job']]) {
    calls.length = 0;
    s = build(true);
    s.scHoldWant(order[0]);
    s.scHoldWant(order[1]);
    eq('two owners take one hold (' + order.join(' then ') + ')', calls.filter((c) => c.m === 'hold').length, 1);
    s.scHoldDrop(order[0]);
    eq('the first owner to finish does not release (' + order.join(' then ') + ')',
       calls.filter((c) => c.m === 'release').length, 0);
    s.scHoldDrop(order[1]);
    eq('the last owner to finish releases once (' + order.join(' then ') + ')',
       calls.filter((c) => c.m === 'release').length, 1);
  }

  // An unknown owner cannot move the hold.
  calls.length = 0;
  s = build(true);
  s.scHoldWant('nobody');
  s.scHoldDrop('nobody');
  eq('an owner that is not a thing holds nothing', calls.length, 0);

  // The conversion path goes through the arbiter now, not through the plugin directly.
  ok('a conversion takes the hold through the arbiter',
     /scRunJob\.native = true;\s*\n\s*scHoldWant\('job'\);/.test(PAGE));
  ok('a conversion gives it back through the arbiter',
     /scRunJob\.native = false; scHoldDrop\('job'\);/.test(PAGE));
  eq('exactly one hold call site', (PAGE.match(/scJobCall\('hold'/g) || []).length, 1);
  eq('exactly one release call site', (PAGE.match(/scJobCall\('release'/g) || []).length, 1);
}

try {
  driveHold();
} catch (e) {
  failures.push('the hold could not be driven - ' + e.message);
}

// ---------------------------------------------------------------- 3. the page
eq('the page is 80.9', (PAGE.match(/const APP_VERSION = '80\.9';/g) || []).length, 1);
eq('the heartbeat is marked kept',
   (PAGE.match(/__scKeepAliveTimer\(mediaSessionHeartbeat\)/g) || []).length, 1);
ok('a playing song asks for the hold', /try\{ scHoldWant\('stream'\); \}catch/.test(PAGE));
ok('only a pause that was asked for releases it',
   /if\(scStreamState\.userPaused\)\{ try\{ scHoldDrop\('stream'\); \}catch/.test(PAGE));
ok('a finished song drops the hold',
   /try\{ scHoldDrop\('stream'\); \}catch[^\n]*\n\s*scStreamNext\(1\);/.test(PAGE));
ok('a handed-back bar drops the hold',
   /if\(typeof scStreamPhoneOwns === 'function' && !scStreamPhoneOwns\(\)\) scHoldDrop\('stream'\);/.test(PAGE));

// The notes, read the way the page writes them and the updater filters them.
const entryAt = PAGE.indexOf("  // 80.9 - THE PHONE IS ASKED");
ok('the 80.9 entry is on the page', entryAt > 0);
const entryEnd = PAGE.indexOf('  ]},', entryAt);
ok('the 80.9 entry closes', entryEnd > entryAt);
const chunk = PAGE.slice(entryAt, entryEnd);
const items = chunk.split('\n')
  .map((l) => l.trim())
  .filter((l) => l.startsWith("'"))
  .map((l) => ({
    full: l.startsWith("'[FULL] "),
    text: l.replace(/^'(\[FULL\] )?/, '').replace(/',?$/, ''),
  }));
eq('the entry carries three notes', items.length, 3);
ok('every note is marked full', items.every((i) => i.full));
ok('no note carries an apostrophe', items.every((i) => !/['\u2019]/.test(i.text)));
ok('no note mentions a channel or a build', items.every((i) => !/channel|play build|full build/i.test(i.text)));
// The bundle's own filter: a note naming the source is dropped from the card.
const survives = items.filter((i) => !/(streaming|streams?\b|from the source|pinned artist)/i.test(i.text));
eq('the updater keeps all three notes', survives.length, 3);
ok('80.8 is still in the changelog', PAGE.indexOf("{ version: '80.8',") > 0);

// Every inline script compiles.
let compiled = 0, compileErr = '';
for (const m of PAGE.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)) {
  const code = m[1];
  if (!code.trim()) continue;
  try { new vm.Script(code, { filename: 'inline-' + compiled + '.js' }); compiled++; }
  catch (e) { compileErr = 'inline-' + compiled + ': ' + e.message; break; }
}
eq('every inline script compiles', compileErr, '');
ok('the page actually has inline scripts', compiled >= 5, 'compiled ' + compiled);

// ---------------------------------------------------------------- 4. the channels
function bundled(dir) {
  const zip = path.join(ROOT, dir, 'update.zip');
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, dir, 'updates.json'), 'utf8'));
  const big = { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 };
  const names = execFileSync('unzip', ['-Z1', zip], big).split('\n').filter(Boolean);
  const html = names.find((n) => /\.html$/i.test(n)) || names[0];
  const page = html ? execFileSync('unzip', ['-p', zip, html], big) : '';
  return { man, page, size: fs.statSync(zip).size, names };
}

for (const dir of ['ota', 'ota-play']) {
  try {
    const b = bundled(dir);
    eq(dir + ' is 80.9', b.man.version, '80.9');
    eq(dir + ' size matches its zip', b.man.size, b.size);
    ok(dir + ' carries the page', b.page.indexOf("const APP_VERSION = '80.9';") > 0,
       'page ' + b.page.length + ' bytes of ' + b.names.length + ' entries');
    ok(dir + ' publishes at least one note', Array.isArray(b.man.notes) && b.man.notes.length >= 1,
       JSON.stringify(b.man.notes));
  } catch (e) {
    failures.push(dir + ' could not be read - ' + e.message);
  }
}

// ---------------------------------------------------------------- report
if (failures.length) {
  console.log('check-809: ' + passed + ' passed, ' + failures.length + ' failed');
  for (const f of failures) console.log('  x ' + f);
  process.exit(1);
}
console.log('check-809: ' + passed + ' passed, 0 failed');
