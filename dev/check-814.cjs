#!/usr/bin/env node
/**
 * 81.4 verifier - a stopped song stops saying it is playing, and the full web Tools
 * pane carries the full APK.
 *
 * The new judgement is RUN: scStreamSurvivedBackgroundFrom is lifted out of the page
 * and handed real trips, and apkCard is executed under each of the three builds.
 *
 *   node dev/check-814.cjs
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '81.4';

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

// ─── [1] release ────────────────────────────────────────────────────────────
ok('the page is ' + VERSION, PAGE.includes("const APP_VERSION = '81.4';")
  && PAGE.indexOf("const APP_VERSION = '81.3';") === -1);
const CL = PAGE.slice(PAGE.indexOf('const CHANGELOG = ['), PAGE.indexOf("  { version: '81.3',"));
ok('the head entry is 81.4', CL.includes("{ version: '81.4',"));
const notes = (CL.match(/'\[FULL\] [^']*'/g) || []).map(s => s.slice(1, -1));
ok('three notes', notes.length === 3, String(notes.length));
ok('every note is marked full', notes.every(n => n.startsWith('[FULL] ')));
ok('no note carries an apostrophe', notes.every(n => n.indexOf("'") === -1 && n.indexOf('\u2019') === -1));
const DROP = /streaming|streams?\b|from the source|pinned artist/;
ok('no note trips the updater filter', notes.every(n => !DROP.test(n)),
  notes.filter(n => DROP.test(n)).join(' | '));

// ─── [2] the stream's playhead decides ──────────────────────────────────────
const TRIP = vm.createContext({
  scStreamState: { audio: { paused: false, currentTime: 100 }, curId: 'a', userPaused: false },
});
vm.runInContext(fnSrc('scStreamSurvivedBackgroundFrom') + '\nthis.__t = scStreamSurvivedBackgroundFrom;', TRIP);
const t = TRIP.__t;
const now = Date.now();

ok('no trip means nothing to judge', t(null) === true && t({}) === true);
ok('a short trip is not judged yet', t({ at: now - 1000, pos: 0, id: 'a', believedPlaying: true }) === true);

// it really played: 60 seconds away, the playhead moved 59
ok('a song that played through survived',
  t({ at: now - 60000, pos: 41, id: 'a', believedPlaying: true }) === true);
// frozen: 60 seconds away, the playhead did not move
ok('a frozen stream did NOT survive',
  t({ at: now - 60000, pos: 100, id: 'a', believedPlaying: true }) === false);
// the element says paused: the WebView was told
TRIP.scStreamState.audio.paused = true;
ok('a paused element did not survive',
  t({ at: now - 60000, pos: 40, id: 'a', believedPlaying: true }) === false);
TRIP.scStreamState.audio.paused = false;
// the song changed under the trip
ok('a new song is not judged by the old one',
  t({ at: now - 60000, pos: 0, id: 'other', believedPlaying: true }) === true);
// a seek backwards
ok('a seek backwards is not a stall',
  t({ at: now - 60000, pos: 300, id: 'a', believedPlaying: true }) === true);
// nothing was believed to be playing
ok('a trip that believed nothing is left alone',
  t({ at: now - 60000, pos: 100, id: 'a', believedPlaying: false }) === true);

const beat = fnSrc('startMediaSessionHeartbeat');
ok('the heartbeat judges the stream by the trip',
  beat.includes('!scStreamState.userPaused && !scStreamSurvivedBackgroundFrom(scStreamBgTrip)'));
ok('a dead stream is shown paused and its bar stops spinning',
  beat.includes("mediaSetPlaybackState('paused');") && beat.includes('scStreamBarSync();'));
ok('the pushed state belongs to the sounding element',
  /streamUpNow \? \(\(_sa && !_sa\.paused\) \? 'playing' : 'paused'\)/.test(beat));
const trip = fnSrc('noteBackgroundStart');
ok('leaving the app records the stream', trip.includes('scStreamBgTrip = {') && trip.includes('scStreamPhoneOwns()'));

// ─── [3] the APK card, per build ────────────────────────────────────────────
const card = fnSrc('apkCard');
ok('the card is built once', card.length > 200);
function cardFor(isWeb, isPlay) {
  const c = vm.createContext({ SC_IS_WEB: isWeb, SC_IS_PLAY: isPlay });
  vm.runInContext(card + '\nthis.__c = apkCard();', c);
  return c.__c;
}
const fullWeb = cardFor(true, false);
ok('the full web page gets the card', fullWeb.includes('Download the full APK'));
ok('it points at the newest release', fullWeb.includes('https://github.com/AnekTheGreat/SideCut/releases/latest'));
ok('it opens in a new tab safely', fullWeb.includes('target="_blank"') && fullWeb.includes('rel="noopener"'));
ok('the plain web page does not', cardFor(true, true) === '');
ok('the Play APK does not', cardFor(false, true) === '');
ok('the sideloaded APK does not', cardFor(false, false) === '');
ok('the Tools pane carries it',
  PAGE.includes('milestonesCard() + playsCard() + apkCard() + lookCard()'));

// ─── [4] the page still compiles, and the bundles carry it ──────────────────
(function () {
  const scripts = [];
  const re = /<script\b[^>]*>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = re.exec(PAGE)) !== null) scripts.push(m[1]);
  let bad = 0;
  scripts.forEach((src, i) => {
    try { new vm.Script(src, { filename: 'inline-' + i + '.js' }); } catch (e) { bad++; failures.push('inline ' + i + ': ' + e.message); }
  });
  ok('all ' + scripts.length + ' inline scripts compile', bad === 0);
})();

const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'updates.json'), 'utf8'));
ok('the manifest is ' + VERSION, man.version === VERSION, man.version);
ok('it carries the three notes', man.notes.length === 3 && notes.every(n => man.notes.indexOf(n.replace('[FULL] ', '')) !== -1));
ok('its size is its bundle', man.size === fs.statSync(path.join(ROOT, 'ota/update.zip')).size);
const playMan = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play/updates.json'), 'utf8'));
ok('the store channel is ' + VERSION, playMan.version === VERSION, playMan.version);
function zipPage(z) {
  try { return execFileSync('unzip', ['-p', path.join(ROOT, z), 'index.html'], { maxBuffer: 1 << 26 }).toString('utf8'); }
  catch (e) { return ''; }
}
ok('the full bundle carries the page', zipPage('ota/update.zip').includes("const APP_VERSION = '81.4';"));
ok('the store bundle carries the page', zipPage('ota-play/update.zip').includes("const APP_VERSION = '81.4';"));

if (failures.length) {
  console.log('check-814: ' + pass + ' passed, ' + failures.length + ' FAILED');
  failures.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
console.log('check-814: ' + pass + ' passed, 0 failed');
