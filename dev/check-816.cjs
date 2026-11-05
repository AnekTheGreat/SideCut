#!/usr/bin/env node
/**
 * 81.6 verifier - the headphones keep working after a pause.
 *
 * The reading is not enough for the parts that are a decision, so those are LIFTED
 * OUT OF THE PAGE AND RUN: scTransportPress is handed stub plumbing and has to leave
 * the mark cleared, the release clock cancelled, the parked flags cleared, the handlers
 * re-armed and the heartbeat running; mediaResumableTrack is handed a file, a URL and
 * neither. The rest is pinned in the source, because the handler bodies live inside
 * closures a verifier cannot lift.
 *
 *   node dev/check-816.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '81.6';

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

// --- [1] release -----------------------------------------------------------
ok('the page is ' + VERSION, PAGE.includes("const APP_VERSION = '81.6';"));
ok('the changelog head is 81.6', /\{\s*version: '81\.6', date: '[^']+', title: 'The headphones keep working after a pause'/.test(PAGE));
ok('the changelog still keeps 81.5 behind it', PAGE.includes("{ version: '81.5', date: 'November 3, 2026"));

// --- [2] every transport control is a press, not just a mark ---------------
function between(a, b) {
  const i = PAGE.indexOf(a);
  if (i < 0) return '';
  const j = PAGE.indexOf(b, i + a.length);
  return j < 0 ? '' : PAGE.slice(i, j);
}
const deckHandlers = between('  function registerMediaSessionHandlers(){', '  // Re-assert every control');
const streamHandlers = between('  function scStreamPhoneArm(){', '  // The stream has given the phone up');

ok('the deck handlers are found', deckHandlers.length > 500);
ok('the stream handlers are found', streamHandlers.length > 500);
ok('play, next and previous all ask for the player back',
  (deckHandlers.match(/scTransportPress\(\)/g) || []).length === 3,
  'found ' + (deckHandlers.match(/scTransportPress\(\)/g) || []).length);
ok('no deck transport control is left with the old half-fix',
  !/scTransportResume\(\)/.test(deckHandlers));
ok('the pause handler says where the pause came from',
  /recordPlaybackStop\('media-session-pause'\);[\s\S]{0,400}?scTransportPaused = true;[\s\S]{0,80}?scPauseDeck\(\);/.test(deckHandlers));
ok('stop does not dereference a missing element',
  /mediaSetActionHandler\('stop',[\s\S]{0,220}?const _stopA = activeAudio\(\);[\s\S]{0,120}?if\(_stopA\)/.test(deckHandlers));

// --- [3] the stream's buttons clear their own mark -------------------------
ok('the stream play press clears the pause mark',
  /mediaSetActionHandler\('play', function\(\)\{[\s\S]{0,700}?scStreamState\.userPaused = false;[\s\S]{0,700}?a\.play\(\)/.test(streamHandlers));
ok('the stream previous press clears the mark AND sounds',
  /mediaSetActionHandler\('previoustrack', function\(\)\{[\s\S]{0,400}?scStreamState\.userPaused = false;[\s\S]{0,900}?if\(a\.paused\)\{ try\{ Promise\.resolve\(a\.play\(\)\)/.test(streamHandlers));
ok('the stream next press clears the mark',
  /mediaSetActionHandler\('nexttrack', function\(\)\{ scStreamState\.userPaused = false; scStreamNext\(1\); \}\)/.test(streamHandlers));

// --- [4] a pause from outside keeps the keep-alive for the grace window ----
ok('the hidden page keeps the keep-alive for a transport pause',
  /const _keepForPress = scTransportPaused && document\.hidden;[\s\S]{0,120}?if\(!_keepForPress\) stopMediaSessionHeartbeat\(\);/.test(PAGE));
ok('and the hold is kept with it, not dropped',
  /if\(!_keepForPress\)\{ try\{ scHoldDrop\('deck'\); \}catch\(_eHoldDrop\)\{\} \}/.test(PAGE));
ok('the grace clock still takes everything back',
  /stopMediaSessionHeartbeat\(\);\s*\n\s*releaseWakeLock\(\);[\s\S]{0,400}?scHoldDrop\('deck'\);[\s\S]{0,80}?const back = mediaResumableTrack\(\);/.test(PAGE));

// --- [5] a source the phone reclaimed is rebuilt before it is played -------
ok('playCurrent rebuilds a dead blob URL',
  /if\(t\.file && \(!t\.url \|\| a\.error\)\)\{[\s\S]{0,300}?t\.url = URL\.createObjectURL\(t\.file\)/.test(PAGE));

// --- [6] scTransportPress, run for real -----------------------------------
{
  // A shared array rather than `this.calls`: a stub called bare from inside the vm
  // has no useful `this`, and a swallowed TypeError reads exactly like a control that
  // was never wired.
  const calls = [];
  const ctx = {
    console,
    setTimeout,
    window: {},
    document: { hidden: true },
    userPaused: true,
    audioFocusInterrupted: true,
    mediaParkedInBackground: true,
    mediaReleasedInBackground: true,
    calls,
    cancelMediaRelease() { calls.push('release-cancelled'); },
    rearmMediaSession() { calls.push('rearmed'); },
    startMediaSessionHeartbeat() { calls.push('heartbeat'); }
  };
  vm.createContext(ctx);
  const src = fnSrc('scTransportResume') + '\n' + fnSrc('scTransportPress') + '\n';
  try {
    vm.runInContext(src + 'scTransportPress();', ctx);
  } catch (e) {
    failures.push('scTransportPress threw: ' + e.message);
  }
  ok('scTransportPress clears the deliberate pause', ctx.userPaused === false);
  ok('scTransportPress clears the interruption mark', ctx.audioFocusInterrupted === false);
  ok('scTransportPress cancels the release clock', calls.includes('release-cancelled'), JSON.stringify(calls));
  ok('scTransportPress clears the parked and released flags',
    ctx.mediaParkedInBackground === false && ctx.mediaReleasedInBackground === false);
  ok('scTransportPress re-arms the handlers', calls.includes('rearmed'));
  ok('scTransportPress starts the keep-alive again', calls.includes('heartbeat'));
}

// --- [7] mediaResumableTrack, run for real ---------------------------------
function resumable(track, streamOwns) {
  const ctx = {
    console,
    window: {},
    document: {},
    queueIndex: 0,
    queue: ['t1'],
    allTracks: track ? [track] : [],
    scStreamPhoneOwns: () => !!streamOwns,
    scStreamPhoneTrack: () => ({ id: 'streaming' })
  };
  vm.createContext(ctx);
  const src = fnSrc('mediaResumableTrack');
  if (!src) throw new Error('could not lift mediaResumableTrack');
  vm.runInContext('var out = (' + src.trim() + ');', ctx);
  return ctx.out();
}
ok('a file on the device is resumable', !!resumable({ id: 't1', name: 'a', file: { size: 1 }, url: 'blob:1' }));
ok('a song played from a URL is resumable too', !!resumable({ id: 't1', name: 'a', file: null, url: 'https://example.test/a.mp3' }));
ok('a paused stream is resumable', !!resumable(null, true));
ok('a song with nothing to play is not', resumable({ id: 't1', name: 'a', file: null, url: '' }) === null);

// --- [8] every inline script still compiles --------------------------------
{
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let m, i = 0, bad = 0;
  while ((m = re.exec(PAGE)) !== null) {
    const code = m[1];
    if (!code.trim()) continue;
    i++;
    try { new vm.Script(code); } catch (e) { bad++; failures.push('inline script #' + i + ' does not compile: ' + e.message); }
  }
  ok('the page has inline scripts to compile', i > 0);
  ok('all of them compile', bad === 0);
}

// --- [9] the notes are shipped with the version ----------------------------
for (const f of ['updates.json', 'manifest.json', 'ota/updates.json', 'ota/manifest.json', 'ota-play/updates.json']) {
  let j = null;
  try { j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); } catch (e) { failures.push(f + ' is not JSON: ' + e.message); continue; }
  ok(f + ' is ' + VERSION, j.version === VERSION, String(j.version));
  ok(f + ' carries the headphone note', (j.notes || []).some(n => /headphone/i.test(n)), JSON.stringify(j.notes || []).slice(0, 80));
}
ok('the shell cache moved with the version', /sidecut-shell-v81\.6/.test(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8')));

// --- report ---------------------------------------------------------------
if (failures.length) {
  console.log('check-816: ' + pass + ' passed, ' + failures.length + ' failed');
  for (const f of failures) console.log('  x ' + f);
  process.exit(1);
}
console.log('check-816: ' + pass + ' passed, 0 failed - ' + VERSION + ', the headphones keep working after a pause');
