#!/usr/bin/env node
/* 83.0.3 - drive the parked beat rather than grep it.
 *
 * The question the owner asked is behavioural - "twenty minutes later, does the
 * earbud press still start the song?" - and no phone runs here. So this lifts
 * startParkedBeat/stopParkedBeat out of the page and runs them against a fake clock:
 * a parked session has to keep stating the song and a truthful paused state, re-arm
 * its controls occasionally, stop when a press clears the parked flag, and stop when
 * the deck empties. Then it checks the two places that decide whether that beat ever
 * starts and ever ends, and boots the patched page in jsdom so the file is still a
 * page and not just text.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let fails = 0;
function ok(cond, label) {
  if (cond) console.log('  ok   ' + label);
  else { fails++; console.log('  FAIL ' + label); }
}

function range(name) {
  const start = PAGE.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('no function ' + name + ' in the page');
  let i = PAGE.indexOf('{', start), depth = 0;
  for (; i < PAGE.length; i++) {
    const c = PAGE[i];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return { start, end: i + 1 }; }
  }
  throw new Error('unbalanced braces in ' + name);
}

// ---- lift the beat, with the two state variables it owns -------------------------
const blockStart = PAGE.indexOf('let mediaParkedBeat = null;');
if (blockStart < 0) throw new Error('the parked beat is not in the page');
const BEAT = PAGE.slice(blockStart, range('startParkedBeat').end);

const sandbox = {
  mediaParkedInBackground: true,
  meta: [], states: [], arms: 0, refreshes: 0, exempt: 0,
  timers: new Map(), nextId: 1, track: { id: 't1', name: 'Song' },
  intervals: [],
  mediaSetMetadata: (t) => sandbox.meta.push(t && t.name),
  mediaSetPlaybackState: (s) => sandbox.states.push(s),
  mediaHandlersNeedArm: () => { sandbox.arms++; },
  refreshMediaControls: () => { sandbox.refreshes++; },
  mediaResumableTrack: () => sandbox.track,
  setInterval: (cb, ms) => { const id = sandbox.nextId++; sandbox.timers.set(id, cb); sandbox.intervals.push(ms); return id; },
  clearInterval: (id) => { sandbox.timers.delete(id); },
};
sandbox.window = { __scKeepAliveTimer: () => { sandbox.exempt++; } };

// `with (s)` so the lifted code reads and writes the sandbox's live variables rather
// than a snapshot of them - the parked flag has to change under the beat's feet.
const run = new Function('s', `
  with (s) {
    ${BEAT}
    return {
      start: startParkedBeat,
      stop: stopParkedBeat,
      setParked: (v) => { s.mediaParkedInBackground = v; },
      setTrack: (v) => { s.track = v; },
      alive: () => s.timers.size
    };
  }
`)(sandbox);

// one beat, n times
function tick(n) {
  const cbs = [...sandbox.timers.values()];
  for (let i = 0; i < (n || 1); i++) cbs.forEach((cb) => { if (sandbox.timers.size) cb(); });
}

// ---- the beat itself -------------------------------------------------------------
run.start(sandbox.track);
ok(sandbox.timers.size === 1, 'parking a song starts one beat');
ok(sandbox.intervals[0] === 60000, 'the beat runs once a minute (' + sandbox.intervals[0] + 'ms)');
ok(sandbox.exempt === 1, 'the beat is exempt from the battery saver, like the heartbeat');

tick(1);
ok(sandbox.meta.length === 1 && sandbox.meta[0] === 'Song', 'a beat restates the song that is parked');
ok(sandbox.states.length === 1 && sandbox.states[0] === 'paused', 'and says paused, which is the truth');
ok(sandbox.arms === 1 && sandbox.refreshes === 1, 'the first beat re-arms every control');

tick(3);
ok(sandbox.meta.length === 4, 'four beats, four pushes - the card never goes stale');
ok(sandbox.states.every((s) => s === 'paused'), 'every one of them says paused');
ok(sandbox.arms === 1, 'the controls are not stormed: once every four beats');

tick(1);
ok(sandbox.arms === 2, 'the fifth beat re-arms again');

run.setParked(false);
tick(1);
ok(sandbox.timers.size === 0, 'a press that clears the parked flag ends the beat');

// a park with nothing on the deck must not keep a timer alive
sandbox.track = null;
run.start(null);
tick(1);
ok(sandbox.timers.size === 0, 'a park with nothing to resume ends itself');

// ---- the two places that start and end it ----------------------------------------
const arm = PAGE.slice(range('armMediaRelease').start, range('armMediaRelease').end);
ok(/startParkedBeat\(back\);/.test(arm), 'the grace window hands a resumable song to the beat');
ok(/mediaResumableTrack\(\)/.test(arm) && /mediaParkedInBackground = true;/.test(arm),
  'and only parks when there is something to come back to');
ok(/mediaReleasedInBackground = true;/.test(arm) && /mediaSetPlaybackState\('none'\)/.test(arm),
  'a park with nothing resumable still releases the session outright');

const rearm = PAGE.slice(range('rearmMediaSession').start, range('rearmMediaSession').end);
ok(/mediaParkedInBackground = false;[\s\S]{0,200}?stopParkedBeat\(\);/.test(rearm),
  'the press that undoes a park stops the beat');

const press = PAGE.slice(range('scTransportPress').start, range('scTransportPress').end);
ok(/cancelMediaRelease\(\)/.test(press) && /rearmMediaSession\(\)/.test(press),
  'a transport press cancels the window and re-arms the session');

// ---- the version, the cache and the note that contradicted this ------------------
ok(PAGE.includes("const APP_VERSION = '83.0.3';"), 'the page says 83.0.3');
ok(/\{ version: '83\.0\.3', date: '[^']*', title: 'A paused song answers/.test(PAGE),
  'and carries the changelog entry for it');
ok(SW.includes('sidecut-shell-v83.0.3'), 'the shell cache moves with it');
ok(!/open SideCut again to get the widget back in sync/.test(PAGE),
  'the settings note no longer says the widget needs the app opened');
ok(/press play there and it resumes without opening the app/.test(PAGE),
  'it says what happens now instead');

// ---- and the file is still a page ------------------------------------------------
const blocks = [...PAGE.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*application\/json)[^>]*>([\s\S]*?)<\/script>/g)];
let parseError = null;
for (const b of blocks) { try { new Function(b[1]); } catch (e) { parseError = e.message; } }
ok(!parseError, 'every inline script compiles (' + blocks.length + ' blocks)' + (parseError ? ': ' + parseError : ''));

let JSDOM = null;
try { JSDOM = require('jsdom').JSDOM; } catch (e) { /* optional, installed where the session had it */ }
if (JSDOM) {
  const dom = new JSDOM(PAGE, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://j/' });
  const d = dom.window.document;
  ok(!!d.getElementById('settingsPaneWidget'), 'the patched page boots and the Widget pane is still there');
  ok(d.body.textContent.includes('press play there and it resumes without opening the app'),
    'and the note on it is the new one');
} else {
  console.log('  ---- jsdom not installed: the boot check was skipped');
}

console.log(fails ? '\n' + fails + ' check(s) failed' : '\nall checks pass');
process.exit(fails ? 1 : 0);
