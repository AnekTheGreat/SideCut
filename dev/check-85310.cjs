// 85.3.10 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report, on Nothing Ear 3: "I should be able to unpause songs paused by the
// earbuds but the app is not letting me do that". A pause from the buds worked; the press
// that undoes it did nothing.
//
//   * the pause arrives on the app's own key door (window.__scNativeKey, 83.4.0) and it
//     called scPauseDeck() directly - so `scTransportPaused` was never set;
//   * onPauseEvt reads exactly that mark (`_keepForPress = scTransportPaused &&
//     document.hidden`) to decide whether the keep-alive, the wake lock and the
//     foreground hold survive the pause;
//   * without it, all three were dropped, armMediaRelease() parked the session ten minutes
//     later, and the press that should have resumed the song had nothing left running to
//     run it. A pause from the lock screen (the media-session handler) DID set the mark,
//     which is why that same second press always worked.
//
// So every door that pauses now goes through one function, and a play press from the
// earbuds has a branch of its own instead of falling through a catch-all.
//
// Nothing here is a copy of the shipped code: the functions are cut out of the page by
// their own names and braces, and run against fake elements and recorders.
//
//   node dev/check-85310.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function grab(name) {
  const key = 'function ' + name + '(';
  const i = page.indexOf(key);
  if (i < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', i + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(i, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}
// `window.__scNativeKey = function(cmd){ ... };` is an assignment, not a declaration.
function grabAssign(expr) {
  const i = page.indexOf(expr);
  if (i < 0) throw new Error('missing assignment ' + expr);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', i + expr.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(i, k + 2); }
  }
  throw new Error('unterminated assignment ' + expr);
}
function run(src, sandbox, expose, filename) {
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}

// =============================================================================
console.log('\n1. One pause, whichever button asked for it');
// =============================================================================
function pauseRun(opts) {
  const o = opts || {};
  const calls = { pause: 0, record: [], spurious: 0, marked: null };
  const el = { paused: !!o.paused };
  const sandbox = {
    console, Number, Math, String, Object, Array,
    scTransportPaused: false,
    activeAudio() { return o.noEl ? null : el; },
    blockSpuriousStop() { calls.spurious++; return !!o.spurious; },
    recordPlaybackStop(why) { calls.record.push(String(why)); },
    scPauseDeck() { calls.pause++; calls.marked = sandbox.scTransportPaused; }
  };
  const U = run(grab('scTransportPause'), sandbox, ['scTransportPause'], 'transport-pause.js');
  U.scTransportPause('x', !!o.fromSession);
  return { calls, sandbox };
}
{
  const r = pauseRun({});
  ok('a pause from the earbuds marks itself as a transport pause', r.sandbox.scTransportPaused === true);
  ok('and the mark is set BEFORE the deck is paused', r.calls.marked === true, r.calls.marked);
  ok('the deck is paused once', r.calls.pause === 1, r.calls.pause);
  ok('the reason is recorded, so the log names the door', r.calls.record[0] === 'x', JSON.stringify(r.calls.record));
  ok('a press from the buds is not treated as a stale session event', r.calls.spurious === 0, r.calls.spurious);
}
{
  const r = pauseRun({ fromSession: true, spurious: true, paused: false });
  ok('the media-session door still refuses a pause that is really a session hand-over', r.calls.pause === 0 && r.calls.spurious === 1,
    'pause=' + r.calls.pause + ' spurious=' + r.calls.spurious);
  ok('but the mark is set even then', r.sandbox.scTransportPaused === true);
}
{
  const r = pauseRun({ fromSession: true });
  ok('a real lock-screen pause goes through the same door', r.calls.pause === 1 && r.calls.record[0] === 'x', JSON.stringify(r.calls));
}
{
  const r = pauseRun({ paused: true });
  ok('a pause on an already paused song records nothing and still marks it', r.calls.record.length === 0 && r.sandbox.scTransportPaused === true,
    JSON.stringify(r.calls.record));
}

// =============================================================================
console.log('\n2. A play press from the buds has a branch of its own');
// =============================================================================
function keyRun(opts) {
  const o = opts || {};
  const calls = { play: [], pause: [], press: 0, next: 0, key: [], note: [], film: [] };
  const el = { paused: !!o.paused, currentTime: o.currentTime || 0 };
  const sandbox = {
    console, Number, Math, String, Object, Array,
    scTransportNote(t) { calls.note.push(String(t || '')); },
    scTransportPlay(why) { calls.play.push(String(why || '')); return true; },
    scTransportPause(why) { calls.pause.push(String(why || '')); return true; },
    scTransportKeyState(s) { calls.key.push(String(s || '')); },
    scTransportPress() { calls.press++; },
    activeAudio() { return o.noEl ? null : el; },
    hardAdvance(n) { calls.next += n; }
  };
  sandbox.__scVideoTransportPress = function (act) { calls.film.push(String(act)); return !!o.film; };
  const U = run(grabAssign('window.__scNativeKey = function(cmd)'), sandbox, ['__scNativeKey'], 'native-key.js');
  return { U, calls, sandbox };
}
{
  // THE REPORT, ONE LINE: the buds send KEYCODE_MEDIA_PLAY, SideCutKeys forwards "play".
  const r = keyRun({ paused: true });
  const handled = r.U.__scNativeKey('play');
  ok('a play press from the earbuds is answered', handled === true);
  ok('it goes through the one door that wakes the mixer and starts the song', JSON.stringify(r.calls.play) === '["the headphones"]', JSON.stringify(r.calls.play));
  ok('it is named on the transport log', /headphones -> play/.test(r.calls.note.join(' | ')), r.calls.note.join(' | '));
  ok('it never falls through to a toggle that could pause instead', r.calls.pause.length === 0);
}
{
  const r = keyRun({ paused: false });
  r.U.__scNativeKey('pause');
  ok('a pause press from the earbuds goes through the shared pause', JSON.stringify(r.calls.pause) === '["the headphones"]', JSON.stringify(r.calls.pause));
  ok('the native session is told it is paused, so the next press resolves as play', r.calls.key[0] === 'paused', JSON.stringify(r.calls.key));
}
{
  const r = keyRun({ paused: false });
  r.U.__scNativeKey('toggle');
  ok('a toggle on a playing song pauses through the same door', JSON.stringify(r.calls.pause) === '["the headphones"]', JSON.stringify(r.calls.pause));
  const r2 = keyRun({ paused: true });
  r2.U.__scNativeKey('toggle');
  ok('a toggle on a paused song asks for sound', r2.calls.play.length === 1 && r2.calls.pause.length === 0);
}
{
  const r = keyRun({ film: true });
  r.U.__scNativeKey('pause');
  ok('with the film open the film is paused first and the deck is left alone', r.calls.film[0] === 'pause' && r.calls.pause.length === 0,
    JSON.stringify(r.calls.film) + ' ' + JSON.stringify(r.calls.pause));
}
{
  // The film question is asked inside scTransportPlay, which is the one door every play
  // press goes through - so the key branch delegates rather than asking twice.
  const r = keyRun({ paused: true, film: true });
  r.U.__scNativeKey('play');
  ok('a play press delegates to the one door that asks the film first', r.calls.play.length === 1 && r.calls.film.length === 0,
    JSON.stringify(r.calls));
  ok('and that door does ask the film before the deck',
    /__scVideoTransportPress\('play'\)[\s\S]{0,200}?const a = activeAudio\(\);/.test(grab('scTransportPlay')));
}
ok('the media-session pause is the same call, with its own flag',
  /scTransportPause\('media-session-pause', true\);/.test(page));
ok('the mark the pause sets is the mark the pause event reads',
  /const _keepForPress = scTransportPaused && document\.hidden;/.test(grab('onPauseEvt')));
ok('and a press that asks for sound clears it again', /scTransportPaused = false;/.test(grab('scTransportPress')));
ok('the key door\'s pause is the shared pause', /if\(what === 'pause'\)\{[\s\S]{0,900}?scTransportPause\('the headphones'\);/.test(page));
ok('and the key door\'s toggle-pause is too', /if\(a && !a\.paused\)\{\s*scTransportPause\('the headphones'\);/.test(page));
ok('the shared pause is the only place the deck is silenced for a press',
  /function scTransportPause\(why, fromSession\)\{[\s\S]{0,600}?scPauseDeck\(\);/.test(page));

// =============================================================================
console.log('\n3. The release itself');
// =============================================================================
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
}
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok('the page is on 85.3.10 or newer', /^85\.3\.\d+$/.test(vPage) && Number(vPage.split('.')[2]) >= 10, vPage);
ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
ok('the notes carry the 85.3.10 entry', page.includes("version: '85.3.10'"));
ok('the new entry is above 85.3.9', page.indexOf("version: '85.3.10'") < page.indexOf("version: '85.3.9'"));
{
  const entry = page.slice(page.indexOf("version: '85.3.10'"), page.indexOf("version: '85.3.9'"));
  ok('the new entry avoids the words the Play channel filters', !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 120));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
