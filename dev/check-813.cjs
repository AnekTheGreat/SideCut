#!/usr/bin/env node
/**
 * 81.3 verifier - a downloaded song keeps the phone awake and the controls outside
 * the app act on whatever is really making sound.
 *
 * The new logic is RUN, not read: the hold's three-owner reference count, the two
 * background-release questions, and scUndoPlatformPause against a paused stream
 * with the deck deliberately idle (which is exactly the state the old page could
 * not recover from) are lifted out of the shipped page and executed.
 *
 *   node dev/check-813.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const failures = [];
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  failures.push(name + (extra ? ' (' + extra + ')' : ''));
}

// A function lifted by counting braces from its own header. String literals and
// line comments are skipped so a brace inside either cannot end it early.
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
    if (ch === '/' && PAGE[k + 1] === '*') { k = PAGE.indexOf('*/', k + 2); if (k < 0) return ''; k++; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') { depth--; if (depth === 0) { k++; break; } }
  }
  return PAGE.slice(i, k);
}

function inSandbox(code, extra, expose) {
  const ctx = Object.assign({}, extra);
  vm.createContext(ctx);
  vm.runInContext(code + '\n' + (expose || ''), ctx);
  return ctx;
}

// ─── [1] the release, the version and the changelog ─────────────────────────
const VERSION = '81.3';
ok('the page is ' + VERSION, (PAGE.match(/const APP_VERSION = '/g) || []).length === 1
  && PAGE.includes("const APP_VERSION = '81.3';"));
ok('the previous const is gone', PAGE.indexOf("const APP_VERSION = '81.2';") === -1);

const CL = PAGE.slice(PAGE.indexOf('const CHANGELOG = ['), PAGE.indexOf("  { version: '81.2',"));
ok('the head entry is 81.3', CL.includes("{ version: '81.3',"));
ok('it has three notes', (CL.match(/'\[FULL\] /g) || []).length === 3);
const notes = (CL.match(/'\[FULL\] [^']*'/g) || []).map(s => s.slice(1, -1));
ok('three notes read out', notes.length === 3, String(notes.length));
ok('every note is marked full', notes.every(n => n.startsWith('[FULL] ')));
ok('no note carries an apostrophe', notes.every(n => n.indexOf("'") === -1 && n.indexOf('\u2019') === -1));
const DROP = /streaming|streams?\b|from the source|pinned artist/;
ok('no note trips the updater filter', notes.every(n => !DROP.test(n)),
  notes.filter(n => DROP.test(n)).join(' | '));
ok('the changelog reads 81.3, 81.2, 81.1, 81, 80.9', (function () {
  const start = PAGE.indexOf('const CHANGELOG = [');
  const end = PAGE.indexOf('\n  ];', start);
  const block = PAGE.slice(start, end);
  const labels = [];
  const re = /\{ version: '([^']+)'/g;
  let m;
  while ((m = re.exec(block)) !== null) labels.push(m[1]);
  return labels.slice(0, 5).join(',') === '81.3,81.2,81.1,81,80.9';
})());

// ─── [2] the hold has three owners, and counts them ─────────────────────────
const HOLD = inSandbox(
  'var scHoldOwners = { job: false, stream: false, deck: false };\nvar scHoldNative = false;\n'
  + ['scHoldText', 'scDeckHoldText', 'scHoldSync', 'scHoldWant', 'scHoldDrop'].map(fnSrc).join('\n'),
  {
    calls: [],
    allTracks: [{ id: 't1', name: 'Bobby', artist: 'Me' }],
    queue: ['t1'], queueIndex: 0,
    scRunJob: { title: 'Conversion', native: false },
    scStreamSong: () => null,
    scJobCall: () => true,
  },
  'this.__calls = function(){ return calls; };'
);
// scJobCall is a property of the sandbox, so replace it with a recorder that keeps
// the order and the payload of every bridge call.
HOLD.calls = [];
HOLD.scJobCall = (m, d) => { HOLD.calls.push({ m, d }); return true; };

const holds = () => HOLD.calls.filter(c => c.m === 'hold').length;
const releases = () => HOLD.calls.filter(c => c.m === 'release').length;

ok('nothing is held before a song starts', HOLD.calls.length === 0);
HOLD.scHoldWant('deck');
ok('a downloaded song takes the hold', holds() === 1, String(holds()));
const first = HOLD.calls[0] || { d: {} };
ok('the hold names the deck song', first.d.title === 'Bobby \u00b7 Me', String(first.d.title));
ok('and says what it is for', first.d.sub === 'Playing on SideCut', String(first.d.sub));
HOLD.scHoldWant('job');
ok('a conversion joining does not take a second hold', holds() === 1, String(holds()));
HOLD.scHoldDrop('deck');
ok('the song ending does not release a hold the run still owns', releases() === 0, String(releases()));
HOLD.scHoldDrop('job');
ok('the last owner releases it', releases() === 1, String(releases()));
HOLD.scHoldWant('deck');
ok('a new song takes it again', holds() === 2, String(holds()));
HOLD.scHoldDrop('deck');
HOLD.scHoldDrop('deck');
ok('dropping twice releases once', releases() === 2, String(releases()));
HOLD.scHoldWant('nobody');
ok('an unknown owner is ignored', holds() === 2);
HOLD.scHoldWant('job');
const jobHold = HOLD.calls[HOLD.calls.length - 1];
ok('a job-only hold is named Conversion', jobHold.d.title === 'Conversion', String(jobHold.d.title));
ok('and carries no playback subtitle', jobHold.d.sub === '', String(jobHold.d.sub));
HOLD.scHoldDrop('job');

// ─── [3] the background release asks what is really playing ─────────────────
const REL = inSandbox(
  ['mediaPausedInBackground', 'mediaResumableTrack'].map(fnSrc).join('\n'),
  {
    document: { hidden: true },
    activeAudio: () => REL.deck,
    queue: [], queueIndex: -1,
    allTracks: [{ id: 'd1', name: 'Download', file: {} }],
    deck: { paused: true },
    stream: { paused: false },
    streamUp: true,
    scStreamState: null,
    scStreamPhoneOwns: () => false,
    scStreamPhoneTrack: () => ({ id: 'sc-stream-s1', name: 'Sourced', stream: true }),
  },
  'this.__paused = mediaPausedInBackground; this.__resume = mediaResumableTrack;'
);
REL.scStreamState = { audio: REL.stream };
REL.scStreamPhoneOwns = () => REL.streamUp;

ok('a playing stream is not paused in the background', REL.__paused() === false);
REL.stream.paused = true;
ok('a paused stream is', REL.__paused() === true);
REL.stream.paused = false;
REL.streamUp = false;
ok('a paused deck with no stream is paused in the background', REL.__paused() === true);
REL.deck.paused = false;
ok('a playing deck is not', REL.__paused() === false);
REL.streamUp = true;
REL.queue = []; REL.queueIndex = -1;
const resumable = REL.__resume();
ok('the stream is something to come back to', !!resumable && resumable.id === 'sc-stream-s1');
REL.streamUp = false;
REL.queue = ['d1']; REL.queueIndex = 0;
ok('the deck song is, when there is no stream', (REL.__resume() || {}).id === 'd1');
REL.allTracks = [{ id: 'd1', name: 'Download' }];
ok('a song with no file is not', REL.__resume() === null);

// ─── [4] an unrequested pause is undone on the stream ───────────────────────
const UNDO = inSandbox(
  fnSrc('scUndoPlatformPause'),
  {
    userPaused: false,
    audioFocusInterrupted: false,
    revivingAudio: false,
    spuriousStopsBlocked: 0,
    queue: [], queueIndex: -1,
    stream: { paused: true, ended: false, play() { UNDO.played.push('stream'); this.paused = false; return Promise.resolve(); } },
    deck: { paused: true, ended: false, play() { UNDO.played.push('deck'); return Promise.resolve(); } },
    played: [],
    streamUp: true,
    scStreamState: null,
    scStreamPhoneOwns: () => false,
    activeAudio: () => UNDO.deck,
    scInCall: () => false,
    scAutoReviveBudget: () => true,
    msSincePlayStarted: () => 1e9,
    recordPlaybackStop: () => {},
    scNoteRevive: () => {},
    scSecondLook: () => {},
    $: () => ({ style: { display: 'none' } }),
  },
  'this.__undo = scUndoPlatformPause;'
);
UNDO.scStreamState = { audio: UNDO.stream, userPaused: false, revives: 0 };
UNDO.scStreamPhoneOwns = () => UNDO.streamUp;

ok('a paused stream is put back', UNDO.__undo('test') === true);
ok('the stream is what plays, not the deck', UNDO.played.join(',') === 'stream', UNDO.played.join(','));
ok('the revive is counted', UNDO.scStreamState.revives === 1, String(UNDO.scStreamState.revives));

UNDO.stream.paused = true; UNDO.scStreamState.userPaused = true; UNDO.played = [];
ok('a pause the user made is believed', UNDO.__undo('test') === false);
ok('and nothing is played', UNDO.played.length === 0);
UNDO.scStreamState.userPaused = false;

UNDO.audioFocusInterrupted = true; UNDO.played = [];
ok('an interruption already being obeyed is believed', UNDO.__undo('test') === false);
ok('and nothing is played', UNDO.played.length === 0);
UNDO.audioFocusInterrupted = false;

UNDO.scInCall = () => true; UNDO.played = [];
ok('a call outranks the revive', UNDO.__undo('test') === false);
UNDO.scInCall = () => false;

UNDO.stream.paused = false; UNDO.played = [];
ok('a playing stream has nothing to undo', UNDO.__undo('test') === false);
UNDO.stream.paused = true;

UNDO.scStreamState.revives = 21;
ok('a dead source is not hammered', UNDO.__undo('test') === false);
UNDO.scStreamState.revives = 0;

UNDO.streamUp = false; UNDO.deck.paused = false;
ok('with no stream the deck path still answers', UNDO.__undo('test') === false);

// ─── [5] the paths that cannot be driven here, pinned by source ─────────────
const playEv = fnSrc('onPlayEvt');
ok('a deck start takes the hold', playEv.includes("scHoldWant('deck')"));
const pause = fnSrc('onPauseEvt');
ok('a user pause gives it back', pause.includes("scHoldDrop('deck')"));
const beat = fnSrc('startMediaSessionHeartbeat');
ok('a stopped deck gives it back', beat.includes("scHoldDrop('deck')"));
ok('the stream keeps its own release', beat.includes("scHoldDrop('stream')"));

ok('the hand-back names the sounding element',
  PAGE.includes('81.3 - THE HAND-BACK GOES TO WHICHEVER ELEMENT IS MAKING SOUND'));
const stand = fnSrc('scStandDownForCall');
ok('a call pauses the stream', stand.includes('scStreamState.audio') && stand.includes('s.pause()'));
const note = fnSrc('scNoteCallState');
ok('the call ending puts the stream back', note.includes('scStreamState.audio') && note.includes('s.play()'));
ok('the deck is never started while the stream owns the bar',
  /scStreamPhoneOwns\(\)\)\{\s*const s = scStreamState\.audio;[\s\S]{0,700}\}\s*else \{\s*const a = activeAudio\(\);/.test(PAGE));

// every inline script must still compile
(function () {
  const scripts = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(PAGE)) !== null) scripts.push(m[1]);
  let bad = 0;
  scripts.forEach((src, i) => {
    try { new vm.Script(src, { filename: 'inline-' + i + '.js' }); } catch (e) { bad++; failures.push('inline script ' + i + ': ' + e.message); }
  });
  ok('all ' + scripts.length + ' inline scripts compile', bad === 0);
})();

// ─── [6] the bundles carry it ───────────────────────────────────────────────
function readJSON(p) { try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8')); } catch (e) { return null; } }
function zipPage(zip) {
  try {
    return execFileSync('unzip', ['-p', path.join(ROOT, zip), 'index.html'], { maxBuffer: 1 << 26 }).toString('utf8');
  } catch (e) { return ''; }
}
const man = readJSON('updates.json');
ok('the root manifest is ' + VERSION, !!man && man.version === VERSION, man && man.version);
ok('it carries the three notes', !!man && Array.isArray(man.notes) && man.notes.length === 3);
ok('its notes are the page s notes', !!man && notes.every(n => man.notes.indexOf(n.replace('[FULL] ', '')) !== -1));
ok('its size is the bundle it points at', !!man && man.size === fs.statSync(path.join(ROOT, 'ota/update.zip')).size,
  man && man.size + ' vs ' + fs.statSync(path.join(ROOT, 'ota/update.zip')).size);
const playMan = readJSON('ota-play/updates.json');
ok('the store channel is ' + VERSION, !!playMan && playMan.version === VERSION, playMan && playMan.version);
const z1 = zipPage('ota/update.zip');
const z2 = zipPage('ota-play/update.zip');
ok('the full bundle carries the page', z1.includes("const APP_VERSION = '81.3';"));
ok('the store bundle carries the page', z2.includes("const APP_VERSION = '81.3';"));
ok('both bundles carry the deck hold', z1.includes("scHoldWant('deck')") && z2.includes("scHoldWant('deck')"));
ok('neither bundle is the old page', !z1.includes("const APP_VERSION = '81.2';") && !z2.includes("const APP_VERSION = '81.2';"));

if (failures.length) {
  console.log('check-813: ' + pass + ' passed, ' + failures.length + ' FAILED');
  failures.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
console.log('check-813: ' + pass + ' passed, 0 failed');
