#!/usr/bin/env node
// 80.6.14 - what must be true of the streaming player: an element in the page, the
// link tried first, a read that does not give up on an unknown shape, and a readout
// that names the step.
//
//   node dev/check-80614.cjs
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.14';"), 'the page runs 80.6.14');
ok(page.includes("version: '80.6.14'"), 'the changelog records 80.6.14');
ok(!page.includes("const APP_VERSION = '80.6.13';"), 'the previous version string is gone');

// --- the element is in the page -----------------------------------------
const audio = page.slice(page.indexOf('function scStreamAudio(){'), page.indexOf('function scStreamPlay('));
ok(audio.length > 500, 'the audio helper was found');
ok(audio.includes('document.body.appendChild(a)'), 'the element is appended to the document');
ok(audio.includes("a.style.cssText = 'position:absolute;left:-9999px;width:0;height:0;opacity:0;pointer-events:none;'"),
  'invisibly, and out of the way');
ok(audio.includes("a.preload = 'auto';"), 'the element is allowed to load itself');
ok(audio.includes("a.addEventListener('loadedmetadata'"), 'and its readiness is watched');

// --- the link is tried first, in the tap ---------------------------------
ok(page.includes('function scStreamStart(u, at){'), 'one function starts the element');
const start = page.slice(page.indexOf('function scStreamStart(u, at){'), page.indexOf('function scStreamRestart(){'));
ok(start.includes('a.src = u; a.load();'), 'it sets the source and loads it');
ok(start.includes('a.play()'), 'and plays inside the caller\'s gesture');
const play = page.slice(page.indexOf('function scStreamPlay(id, ctxIds){'), page.indexOf('function scStreamToggle(){'));
ok(play.indexOf('scStreamStart(u)') !== -1 && play.indexOf('scStreamSource(') !== -1,
  'the link is tried, then the read');
ok(play.indexOf('scStreamStart(u)') < play.indexOf('scStreamSource('), 'in that order');
ok(play.includes("'No playable stream for this song right now'"), 'a song with no source says so');

// --- the read survives an unknown shape ---------------------------------
const conv = page.slice(page.indexOf('function scHttpDataToBytes(data){'), page.indexOf('function scStreamUsable('));
ok(conv.includes('ArrayBuffer.isView'), 'typed arrays are read');
ok(conv.includes('Array.isArray(data)'), 'plain arrays are read');
ok(conv.includes('scHttpDataToBytes(data.data)'), 'wrapped replies are unwrapped');
const range = page.slice(page.indexOf('async function scFetchRange('), page.indexOf('// "bytes 0-1023/2923372"'));
ok(range.includes("window.__scHttpWhy = 'the native reply carried no readable bytes'"),
  'a 206 with no readable bytes falls through to fetch');
ok(!/if\(bytes && bytes\.length\) return[\s\S]{0,200}return \{ bytes: null, partial: false, total: 0, status: res\.status \};/.test(range),
  'and does not return an empty answer on a success status');

// --- the readout ---------------------------------------------------------
ok(page.includes('function scStreamDiag(){'), 'there is a readout');
const diag = page.slice(page.indexOf('function scStreamDiag(){'), page.indexOf('function scStreamStart(u, at){'));
['scStreamState.mime', 'scStreamState.size', 'scStreamState.via', 'a.error.code', 'a.readyState', 'scStreamReason()']
  .forEach((needle) => ok(diag.includes(needle), 'the readout reports ' + needle));
ok(page.includes('id="scStreamDiag"'), 'the readout is on the card');
ok(page.includes('id="scStreamFix"'), 'and a Restart sits beside it');
ok(page.includes("on('scStreamFix', 'click', scStreamRestart);"), 'Restart is wired');
ok(page.includes('function scStreamRestart(){'), 'Restart clears the state and plays again');
ok(page.includes("if(dg) dg.textContent = scStreamDiag();"), 'the readout follows playback');

// --- and the read path is still the downloader's own --------------------
ok(page.includes('var wasCancel = !!window.__scCancelDl;'), 'a stopped download still cannot truncate a stream');
ok(page.includes('return scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size })'),
  'the read still gets the real length');

// --- the pure functions, run --------------------------------------------
function grab(name) {
  const key = '\n  function ' + name + '(';
  const at = page.indexOf(key);
  if (at === -1) throw new Error('missing function ' + name);
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  if (end === -1) throw new Error('unterminated function ' + name);
  return page.slice(start, end + 4);
}
try {
  const convFn = new Function(grab('scHttpDataToBytes') + '\nreturn scHttpDataToBytes;')();
  const bytes = convFn('AAECAwQ=');
  ok(bytes && bytes.length === 5 && bytes[0] === 0 && bytes[4] === 4, 'base64 is decoded');
  const typed = convFn(new Uint8Array([9, 8, 7]));
  ok(typed && typed.length === 3 && typed[0] === 9, 'a typed array is taken as it is');
  const plain = convFn([1, 2, 3]);
  ok(plain && plain.length === 3 && plain[2] === 3, 'a plain array becomes bytes');
  const wrapped = convFn({ data: 'AAECAwQ=' });
  ok(wrapped && wrapped.length === 5, 'a wrapped reply is unwrapped and decoded');
  ok(convFn(null) === null, 'nothing stays nothing');
  ok(convFn({}) === null, 'an unknown object is not guessed at');

  // vm, not new Function: scStreamDiag reads two names from the page's scope, and
  // passing them as parameters to a constructed function put them one scope away
  // from where the body looks for them.
  const vm = require('node:vm');
  const diagFn = vm.runInNewContext(grab('scStreamDiag') + '\nscStreamDiag()', {
    scStreamState: {
      mime: 'audio/webm; codecs="opus"',
      size: 3433755,
      via: 'read',
      bytes: 1048576,
      audio: { error: { code: 4 }, readyState: 1 },
      err: '',
    },
    scStreamReason: () => 'native request answered 403',
  });
  ok(/webm/.test(diagFn) && /3\.3 MB/.test(diagFn), 'the readout describes the stream');
  ok(/read/.test(diagFn) && /1024 KB read/.test(diagFn), 'and the path that carried it');
  ok(/error 4/.test(diagFn) && /ready 1/.test(diagFn), 'and what the element thinks');
  ok(/403/.test(diagFn), 'and what the source said');
} catch (e) {
  bad.push('the pure functions could not be run: ' + e.message);
}

console.log('\ncheck-80614: ' + pass + ' passed, ' + bad.length + ' failed');
bad.forEach((b) => console.log('  x ' + b));
process.exit(bad.length ? 1 : 0);
