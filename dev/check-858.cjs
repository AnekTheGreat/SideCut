// 85.8 harness - a deck with nothing left to play is silence, and the card says so.
//
// The owner's report: "it keeps ghost playing audio from SideCut even tho I don't have
// anything playing", sent with the shade's now-playing card frozen at 02:31 / 02:31 with a
// pause button, over a different app. Two faults, one place:
//
//   * AN ENDED SONG SENDS NO `pause` EVENT. `onPauseEvt` is the only door that pushes a
//     paused media session for the deck, so a song that reached its end and had nothing
//     after it left the shade claiming SideCut was still playing, at the song's last
//     second, for ever.
//   * AND THE REVIVE COULD NOT TELL "FINISHED" FROM "INTERRUPTED". The background
//     keep-alive restarts a paused deck element on the argument that the phone paused it,
//     not the owner. A finished song is paused with `userPaused` clear - the same picture -
//     and the failed advance happened before the element's src was changed, so `play()`
//     started the SAME finished file again from zero, silently, in the background.
//     `ended` is the witness that says "this did not pause, it finished".
//
// This gate drives the shipped `scDeckRest` in a vm and reads the rest where it sits.
// Looked at? No - nothing was played from this sandbox, so what is proven is where the
// truth is written and what a stopped deck does, not a particular phone's shade.
//
//   node dev/check-858.cjs
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
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}

function stubEl() {
  const touched = { removed: [], added: [] };
  return {
    innerHTML: '',
    classList: {
      add: function (c) { touched.added.push(c); },
      remove: function (c) { touched.removed.push(c); },
    },
    touched: touched,
  };
}

function stageRest() {
  const calls = { pause: [], state: [], hold: [], wake: 0, beat: 0, fade: 0, stop: [], save: 0, els: {} };
  const ctx = {
    console: console,
    userPaused: false,
    audio: { pause: function () { calls.pause.push('audio'); } },
    audio2: { pause: function () { calls.pause.push('audio2'); } },
    cancelCrossfade: function () { calls.fade++; },
    mediaSetPlaybackState: function (s) { calls.state.push(s); },
    scHoldDrop: function (o) { calls.hold.push(o); },
    releaseWakeLock: function () { calls.wake++; },
    stopMediaSessionHeartbeat: function () { calls.beat++; },
    recordPlaybackStop: function (w) { calls.stop.push(String(w)); },
    savePlaybackState: function () { calls.save++; },
    syncLyricsPlayPauseIcon: function () {},
    $: function (id) { if (!calls.els[id]) calls.els[id] = stubEl(); return calls.els[id]; },
  };
  vm.createContext(ctx);
  vm.runInContext(grab('scDeckRest'), ctx);
  return { ctx: ctx, calls: calls };
}

console.log('1. A deck with nothing to play stops itself, and tells the phone');
{
  const s = stageRest();
  s.ctx.scDeckRest('the song ended and nothing followed it');
  ok('both players are stopped', s.calls.pause.length === 2 && s.calls.pause.join(',') === 'audio,audio2', s.calls.pause.join(','));
  ok('...the card is told paused, not playing', s.calls.state.length === 1 && s.calls.state[0] === 'paused', s.calls.state.join(','));
  ok('...the phone is no longer held awake for it', s.calls.hold.length === 1 && s.calls.hold[0] === 'deck' && s.calls.wake === 1, s.calls.hold.join(',') + '/' + s.calls.wake);
  ok('...and the heartbeat that would revive it is stopped', s.calls.beat === 1);
  ok('...a fade in flight is torn down', s.calls.fade === 1);
  ok('...the deck is marked deliberate, so nothing revives it', s.ctx.userPaused === true);
  ok('the wheel stops and the button goes back to play', s.calls.els.npDisc.touched.removed.indexOf('spinning') !== -1
    && s.calls.els.playIcon.innerHTML === '<path d="M8 5v14l11-7z"/>', s.calls.els.playIcon.innerHTML);
  ok('the reason is written down once', s.calls.stop.length === 1 && /nothing followed it/.test(s.calls.stop[0]), s.calls.stop.join(','));
  ok('the resting position is saved', s.calls.save === 1);
  const s2 = stageRest();
  s2.ctx.scDeckRest();
  ok('a rest with no reason still says something', s2.calls.stop.length === 1 && /nothing to play/.test(s2.calls.stop[0]), s2.calls.stop.join(','));
}

console.log('\n2. Every advance that cannot start a song goes through it');
{
  const play = grab('playCurrent');
  ok('a song that is no longer in the library rests the deck',
    /if\(!t\)\{ scDeckRest\('this song is not in the library any more'\); return; \}/.test(play));
  const missing = play.slice(play.indexOf('if(!t.file || !t.url)'), play.indexOf('if(hardSwitch)'));
  ok('a missing audio file rests the deck before it says so', /scDeckRest\(/.test(missing), missing.slice(0, 80));
  ok('...and the toast is still there for the owner', /re-imported/.test(missing));
  ok('a song is never left half-loaded by the rest', play.indexOf('scDeckRest(') < play.indexOf("a.src = t.url"), play.indexOf('scDeckRest(') + '/' + play.indexOf('a.src = t.url'));
  const adv = grab('hardAdvance');
  ok('a queue with nothing after it rests instead of spinning forever',
    /if\(wrap\) next = 0; else \{ scDeckRest\('there is nothing after this song'\); return; \}/.test(adv),
    (adv.match(/if\(wrap\) next = 0;[^\n]*/) || [''])[0]);
}

console.log('\n3. A finished song is not an interrupted one');
{
  const beat = grab('startMediaSessionHeartbeat');
  ok('the deck revive refuses an element that ended',
    /if\(a\.paused && !a\.ended && !userPaused && !audioFocusInterrupted/.test(beat),
    (beat.match(/if\(a\.paused[^\n]*/) || [''])[0]);
  ok('...and a stream that ended is refused the same way', /sa\.paused && !sa\.ended/.test(beat));
  ok('the stream keeps its own revive for a real interruption', /sa\.paused && !sa\.ended/.test(beat) && /scStreamState\.revives/.test(beat));
}

console.log('\n4. A card cannot sit at the last second saying it is playing');
{
  const block = page.slice(page.indexOf("a.addEventListener('ended', function(){\n      setTimeout(function(){"),
    page.indexOf("a.addEventListener('ended', function(){\n      setTimeout(function(){") + 900);
  ok('the deck settles a moment after a song ends', /setTimeout\(function\(\)\{/.test(block));
  ok('...only when nothing took over', /if\(crossfadeTriggered \|\| crossfadeRAF\) return;/.test(block)
    && /if\(window\.__scVideoSoundOwn\) return;/.test(block)
    && /scStreamPhoneOwns\(\)\) return;/.test(block));
  ok('...and only for the element that really ended',
    /var cur = activeAudio\(\);\s*\n\s*if\(cur && cur\.ended\) scDeckRest\(/.test(block), block.slice(0, 120));
  // The listener is registered once, inside `[audio, audio2].forEach(a => ...)`, so it is on
  // both elements - the test is that it sits in that loop, not that the text twice exists.
  const loop = page.indexOf('[audio, audio2].forEach(a => {');
  const listenAt = page.indexOf("a.addEventListener('ended', function(){\n      setTimeout(function(){");
  const loopEnd = page.indexOf('});\n', page.indexOf('if(document.readyState', listenAt));
  ok('the settle is registered on both players by the one loop',
    loop > 0 && listenAt > loop && loopEnd > listenAt, loop + '/' + listenAt + '/' + loopEnd);
}

console.log('\n5. The release itself');
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) {
    scripts++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
  }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  const { atLeast } = require('./version.cjs');
  ok('the page is on 85.8 or newer', atLeast(vPage, '85.8'), vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.8 entry', page.includes("version: '85.8'"));
  ok('the new entry is above 85.7', page.indexOf("version: '85.8'") < page.indexOf("version: '85.7'"));
  const entry = page.slice(page.indexOf("version: '85.8'"), page.indexOf("version: '85.7'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
    (entry.match(/(downloader|downloading|converter|converts|converting|conversion|convert\b|streams?\b|from the source|\bdownload)/i) || [])[0]);
  const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
  ok('the entry carries the things it describes', items >= 4, items);
  ok('and names the card, the finished song and the silence',
    /card/i.test(entry) && /finished|ends?|end\b/i.test(entry) && /silence|silent/i.test(entry));
  ok('the version is two-part or one digit after the second (the numbering rule)',
    /^\d+\.\d+(\.\d)?$/.test(String(vPage)), vPage);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
