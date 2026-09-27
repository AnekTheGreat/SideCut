#!/usr/bin/env node
// SideCut - 63.1.3, part three: the YouTube run starts sooner, gives up less, and
// can be stopped from the card.
//
// The report: "YouTube conversion is also taking forever and doesn't work half
// the time", and "if you click the little x right next to convert it should cancel
// the download". The second one was simply missing - the x cleared the fields and
// nothing else, so a run kept going with no way to stop it from the card it was
// started from (the bubble's Cancel was the only stop). The first one had four
// real causes, all of them waiting:
//
//   1. the player call for BOTH audio clients was awaited one after the other,
//      so a second full YouTube round trip (its own connect and read timeouts)
//      happened before a single byte was fetched - for candidates the first
//      client had usually already supplied;
//   2. the title lookup (oEmbed, through the relay walk) sat IN FRONT of the
//      whole run, so a slow lookup delayed the fetch by up to its budget;
//   3. a chosen output format had no fallback at all: the card says "if your
//      format can't be produced, it falls back to another one automatically",
//      but with a format picked the chain was one entry long, so a blocked MP3
//      encoder (lamejs comes from a CDN) ended the run with nothing;
//   4. a stream whose USABILITY PROBE got no answer at all (a timeout, a dropped
//      connection) was thrown away as if it had been refused, which is how a
//      transient blip could leave the downloader with no candidates.
//
// The characters this rewrites are built from code points, so this file stays
// ASCII while its old strings still match index.html byte for byte.
//
//   node dev/patch-656.mjs
//
// Idempotent, and it verifies itself at the end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

const cp = (n) => String.fromCodePoint(n);
const MD = cp(0x2014);   // em dash
const ELL = cp(0x2026);  // ellipsis

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('+ ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---- 1. the run is stopped from the card it was started from ---------------
sub('shared cancel path',
  '  var scConvertPillState = { el: null, timer: null, pct: 0, cancelRequested: false };\n' +
  '  // A new run clears the flag; the Cancel handler sets it and dismisses the pill.\n' +
  '  function scConvertPillResetCancel(){ scConvertPillState.cancelRequested = false; }\n',

  '  var scConvertPillState = { el: null, timer: null, pct: 0, cancelRequested: false };\n' +
  '  // A new run clears the flag; the Cancel handler sets it and dismisses the pill.\n' +
  '  function scConvertPillResetCancel(){ scConvertPillState.cancelRequested = false; }\n' +
  '  // ONE cancel path, for every way out of a run: the bubble\'s Cancel button and\n' +
  '  // the small x beside the button that starts a run do the same thing, so the two\n' +
  '  // can never drift apart. The run stops at its next step - every fetch, decode\n' +
  '  // and encode step checks __scCancelDl - and the bubble is dismissed on a grace\n' +
  '  // window, so Cancel always means "gone", whatever the job in flight is doing.\n' +
  '  function scCancelConversion(btnEl){\n' +
  '    window.__scCancelDl = true;\n' +
  '    window.__scNotifyAt = 0;\n' +
  '    scConvertPillState.cancelRequested = true;\n' +
  '    if(scConvertPillState.timer) clearTimeout(scConvertPillState.timer);\n' +
  '    scConvertPillState.timer = setTimeout(function(){\n' +
  '      if(!scConvertPillState.cancelRequested) return;\n' +
  '      scConvertPillState.cancelRequested = false;\n' +
  '      scConvertPill(false);\n' +
  '    }, 1500);\n' +
  '    var pill = scConvertPillState.el;\n' +
  '    if(pill){\n' +
  '      var cb = pill.querySelector(\'.sc-pill-cancel\');\n' +
  '      if(cb){ cb.disabled = true; cb.textContent = \'Cancelling' + ELL + '\'; }\n' +
  '      var cs = pill.querySelector(\'.sc-pill-sub\');\n' +
  '      if(cs) cs.textContent = \'Stopping ' + MD + ' what already finished stays in your library\';\n' +
  '      scNotifyProgress(\'SideCut\', \'Cancelling ' + MD + ' what already finished stays in your library\', scConvertPillState.pct || 0, false);\n' +
  '    }\n' +
  '    // The button that started it is usable again at once: the run may take a\n' +
  '    // moment to unwind, and until it does the card would otherwise sit disabled.\n' +
  '    if(btnEl){ btnEl.disabled = false; btnEl.textContent = \'Convert\'; }\n' +
  '  }\n');

sub('pill cancel button uses it',
  '    var cancelBtn = pill.querySelector(\'.sc-pill-cancel\');\n' +
  '    if(cancelBtn) cancelBtn.addEventListener(\'click\', function(){\n' +
  '      window.__scCancelDl = true;\n' +
  '      cancelBtn.disabled = true; cancelBtn.textContent = \'Cancelling' + ELL + '\';\n' +
  '      var cSub = pill.querySelector(\'.sc-pill-sub\');\n' +
  '      if(cSub) cSub.textContent = \'Stopping ' + MD + ' what already finished stays in your library\';\n' +
  '      window.__scNotifyAt = 0;\n' +
  '      scNotifyProgress(\'SideCut\', \'Cancelling ' + MD + ' what already finished stays in your library\', scConvertPillState.pct || 0, false);\n' +
  '      // The run cannot always report back ' + MD + ' a download or an encode in flight\n' +
  '      // may be wedged, and that is exactly when the bubble used to stay on\n' +
  '      // screen forever. Dismiss it ourselves on a short grace window so the\n' +
  '      // Cancel button always means "gone", whatever the job is doing.\n' +
  '      scConvertPillState.cancelRequested = true;\n' +
  '      if(scConvertPillState.timer){ clearTimeout(scConvertPillState.timer); }\n' +
  '      scConvertPillState.timer = setTimeout(function(){\n' +
  '        if(!scConvertPillState.cancelRequested) return;\n' +
  '        scConvertPillState.cancelRequested = false;\n' +
  '        scConvertPill(false);\n' +
  '      }, 1500);\n' +
  '    });\n',

  '    var cancelBtn = pill.querySelector(\'.sc-pill-cancel\');\n' +
  '    if(cancelBtn) cancelBtn.addEventListener(\'click\', function(){ scCancelConversion(); });\n');

sub('x beside Convert (Discover)',
  '  var ytMp3ClearDisc = document.getElementById(\'ytMp3Clear\');\n' +
  '  if(ytMp3ClearDisc){ ytMp3ClearDisc.addEventListener(\'click\', function(){\n' +
  '    var inp = document.getElementById(\'ytMp3Input\');\n' +
  '    var res = document.getElementById(\'ytMp3Result\');\n' +
  '    if(inp) inp.value = \'\';\n' +
  '    if(res){ res.innerHTML = \'\'; res.style.display = \'none\'; }\n' +
  '  }); }\n',

  '  var ytMp3ClearDisc = document.getElementById(\'ytMp3Clear\');\n' +
  '  if(ytMp3ClearDisc){ ytMp3ClearDisc.addEventListener(\'click\', function(){\n' +
  '    var inp = document.getElementById(\'ytMp3Input\');\n' +
  '    var res = document.getElementById(\'ytMp3Result\');\n' +
  '    var cbtn = document.getElementById(\'ytMp3Btn\');\n' +
  '    // x does both things now: it clears the card AND it stops the run, which is\n' +
  '    // the same gesture as Cancel on the bubble, one tap from the button that\n' +
  '    // started it. A disabled button is exactly the "a run is in flight" state, so\n' +
  '    // a stray tap on an idle card only empties the fields.\n' +
  '    var running = !!(cbtn && cbtn.disabled);\n' +
  '    if(inp) inp.value = \'\';\n' +
  '    if(res){ res.innerHTML = \'\'; res.style.display = \'none\'; }\n' +
  '    if(running) scCancelConversion(cbtn);\n' +
  '  }); }\n');

sub('x beside Convert (Settings)',
  '  var ytMp3ClearSet = document.getElementById(\'ytMp3ClearSettings\');\n' +
  '  if(ytMp3ClearSet){ ytMp3ClearSet.addEventListener(\'click\', function(){\n' +
  '    var inp = document.getElementById(\'ytMp3InputSettings\');\n' +
  '    var res = document.getElementById(\'ytMp3ResultSettings\');\n' +
  '    if(inp) inp.value = \'\';\n' +
  '    if(res){ res.innerHTML = \'\'; res.style.display = \'none\'; }\n' +
  '  }); }\n',

  '  var ytMp3ClearSet = document.getElementById(\'ytMp3ClearSettings\');\n' +
  '  if(ytMp3ClearSet){ ytMp3ClearSet.addEventListener(\'click\', function(){\n' +
  '    var inp = document.getElementById(\'ytMp3InputSettings\');\n' +
  '    var res = document.getElementById(\'ytMp3ResultSettings\');\n' +
  '    var cbtn = document.getElementById(\'ytMp3BtnSettings\');\n' +
  '    // Same as the Discover card: clear the fields, and stop the run too.\n' +
  '    var running = !!(cbtn && cbtn.disabled);\n' +
  '    if(inp) inp.value = \'\';\n' +
  '    if(res){ res.innerHTML = \'\'; res.style.display = \'none\'; }\n' +
  '    if(running) scCancelConversion(cbtn);\n' +
  '  }); }\n');

// ---- 2. both audio lookups go out together --------------------------------
sub('player clients asked at once',
  '    var audioStreams = [], muxedStreams = [], seenUrls = {}, answered = 0, metaTitle = \'\', metaAuthor = \'\';\n',
  '    var audioStreams = [], muxedStreams = [], seenUrls = {}, metaTitle = \'\', metaAuthor = \'\';\n');

sub('player client loop',
  '    for(var c = 0; c < clients.length; c++){\n' +
  '      if(answered >= 2) break;\n' +
  '      try{\n' +
  '        var ctx = { client: clients[c].client };\n' +
  '        if(clients[c].third) ctx.thirdParty = { embedUrl: clients[c].third };\n' +
  '        // Hand the transport the client this body declares, so the headers agree\n' +
  '        // with it instead of always claiming to be the web player.\n' +
  '        var d = await scHttpJson(\'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8\', { context: ctx, videoId: videoId, contentCheckOk: true, racyCheckOk: true }, { name: clients[c].num, version: clients[c].client.clientVersion, ua: clients[c].ua });\n' +
  '        if(!d || !d.streamingData) continue;\n' +
  '        answered++;\n' +
  '        var vd = d.videoDetails || {};\n' +
  '        if(!metaTitle && vd.title) metaTitle = vd.title;\n' +
  '        if(!metaAuthor && vd.author) metaAuthor = vd.author;\n' +
  '        // Audio-only first (small, decodes cleanly), the progressive muxed\n' +
  '        // copy behind it for the music-upload cap ' + MD + ' several of each, so the\n' +
  '        // downloader can walk past a capped or blocked stream instead of\n' +
  '        // running out of candidates.\n' +
  '        take(d.streamingData.adaptiveFormats, false, audioStreams, 3);\n' +
  '        take(d.streamingData.formats, true, muxedStreams, 2);\n' +
  '      }catch(e){}\n' +
  '    }\n',

  '    // Both clients are asked AT ONCE, and the answers are read in the same order\n' +
  '    // they were before. Asking them one after the other cost a whole extra YouTube\n' +
  '    // round trip on every run - with its own connect and read timeouts in front of\n' +
  '    // the download - for candidates the first client had usually already supplied.\n' +
  '    // That wait is what made a run look stalled before it had fetched a byte.\n' +
  '    var asks = clients.map(function(cl){\n' +
  '      var ctx = { client: cl.client };\n' +
  '      if(cl.third) ctx.thirdParty = { embedUrl: cl.third };\n' +
  '      // Hand the transport the client this body declares, so the headers agree\n' +
  '      // with it instead of always claiming to be the web player.\n' +
  '      try{\n' +
  '        return scHttpJson(\'https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8\', { context: ctx, videoId: videoId, contentCheckOk: true, racyCheckOk: true }, { name: cl.num, version: cl.client.clientVersion, ua: cl.ua }).catch(function(){ return null; });\n' +
  '      }catch(_askErr){ return Promise.resolve(null); }\n' +
  '    });\n' +
  '    var answers = await Promise.all(asks);\n' +
  '    for(var c = 0; c < clients.length; c++){\n' +
  '      var d = answers[c];\n' +
  '      if(!d || !d.streamingData) continue;\n' +
  '      var vd = d.videoDetails || {};\n' +
  '      if(!metaTitle && vd.title) metaTitle = vd.title;\n' +
  '      if(!metaAuthor && vd.author) metaAuthor = vd.author;\n' +
  '      // Audio-only first (small, decodes cleanly), the progressive muxed\n' +
  '      // copy behind it for the music-upload cap ' + MD + ' several of each, so the\n' +
  '      // downloader can walk past a capped or blocked stream instead of\n' +
  '      // running out of candidates.\n' +
  '      take(d.streamingData.adaptiveFormats, false, audioStreams, 3);\n' +
  '      take(d.streamingData.formats, true, muxedStreams, 2);\n' +
  '    }\n');

// ---- 3. the title lookup rides alongside the run ---------------------------
sub('title lookup no longer blocks',
  '    tryMeta().then(function(){\n' +
  '      // Pass 1: try MP3. Pass 2: if that fails, try WAV ' + MD + ' so if the MP3\n' +
  '      // converter doesn\'t produce audio we can still grab a lossless WAV.\n' +
  '      var wantFmts = (presetFmt && presetFmt !== \'auto\') ? [presetFmt] : [\'flac\', \'wav\', \'mp3\'];\n' +
  '      var chain = Promise.resolve(false);\n' +
  '      wantFmts.forEach(function(f){\n' +
  '        chain = chain.then(function(done){\n' +
  '          if(done) return true;\n' +
  '          setStatus(\'Trying \' + f.toUpperCase() + \'...\');\n' +
  '          return tryYtAudioFormat(f).then(function(res){\n' +
  '            if(res){ renderDownload(f, res); return true; }\n' +
  '            return false;\n' +
  '          });\n' +
  '        });\n' +
  '      });\n',

  '    // The title lookup rides ALONGSIDE the run instead of in front of it: it is one\n' +
  '    // more request for a string only the tag and the file name need, and on a bad\n' +
  '    // connection its relay walk could spend its whole budget before the run had\n' +
  '    // even asked for a stream. tryYtAudioFormat awaits it before encoding.\n' +
  '    var metaP = tryMeta();\n' +
  '    Promise.resolve().then(function(){\n' +
  '      // The format menu chooses the OUTPUT format, not the source stream. The\n' +
  '      // chosen one is tried first, and the others follow ONLY when that format\n' +
  '      // could not be produced at all ' + MD + ' which is the card\'s own promise ("if your\n' +
  '      // format can\'t be produced, it falls back to another one automatically").\n' +
  '      // A stream that would not fetch is not a format problem: the other formats\n' +
  '      // would re-fetch the same streams and fail the same way, only slower.\n' +
  '      var chosen = (presetFmt && presetFmt !== \'auto\') ? presetFmt : null;\n' +
  '      var wantFmts = chosen\n' +
  '        ? [chosen].concat([\'flac\', \'wav\', \'mp3\'].filter(function(x){ return x !== chosen; }))\n' +
  '        : [\'flac\', \'wav\', \'mp3\'];\n' +
  '      var chain = (function walk(i){\n' +
  '        if(i >= wantFmts.length) return Promise.resolve(false);\n' +
  '        var f = wantFmts[i];\n' +
  '        setStatus(\'Trying \' + f.toUpperCase() + \'...\');\n' +
  '        return tryYtAudioFormat(f).then(function(res){\n' +
  '          if(res === ENC_FAIL) return walk(i + 1);   // this format cannot be produced here\n' +
  '          if(res){ renderDownload(f, res); return true; }\n' +
  '          return false;                              // the stream itself: another format changes nothing\n' +
  '        });\n' +
  '      })(0);\n');

sub('encoder failure is its own kind',
  '    var ytAuthor = \'\';\n' +
  '    var _ytFails = [];\n',
  '    var ytAuthor = \'\';\n' +
  '    var _ytFails = [];\n' +
  '    // A format that could not be PRODUCED here (the MP3 encoder is fetched from a\n' +
  '    // CDN, and a blocked one produces nothing) is not the same answer as a stream\n' +
  '    // that would not fetch: only the first one is worth answering with another\n' +
  '    // format. This sentinel is how the chain tells them apart.\n' +
  '    var ENC_FAIL = { encoder: true };\n');

sub('encoder failure sentinel',
  ', which means a blocked CDN\' : \'\')); return null; }',
  ', which means a blocked CDN\' : \'\')); return ENC_FAIL; }');

sub('encode waits for the title',
  '      var blob = null;\n' +
  '      if(fmt === \'mp3\' && typeof lamejs === \'undefined\'){ await window.__scEnsureLamejs(); }\n',

  '      var blob = null;\n' +
  '      if(fmt === \'mp3\' && typeof lamejs === \'undefined\'){ await window.__scEnsureLamejs(); }\n' +
  '      // Whatever the title lookup has by now (it started with the run). The tag\n' +
  '      // and the file name need it, so this is the one place that waits for it.\n' +
  '      if(metaP){ try{ await metaP; }catch(_mp){} metaP = null; }\n');

// ---- 4. a probe that got no answer is not a verdict ------------------------
sub('usability probe tolerance',
  '    var probe = await scFetchRange(url, at, at + 1);\n' +
  '    if(probe && probe.bytes && probe.bytes.length) return true;\n' +
  '    return !!(probe && probe.status === 416);\n',

  '    var probe = await scFetchRange(url, at, at + 1);\n' +
  '    if(probe && probe.bytes && probe.bytes.length) return true;\n' +
  '    if(probe && probe.status === 416) return true;   // shorter than the probe point: fine\n' +
  '    // A probe that came back with NOTHING (a timeout, a dropped connection) says\n' +
  '    // nothing about the stream, and treating it as a verdict threw away the one\n' +
  '    // candidate that might have fetched. Only an answer that explicitly refuses\n' +
  '    // the range ' + MD + ' 403 past the music-upload cap, 404/410 gone ' + MD + ' disqualifies a\n' +
  '    // stream; anything else is left to the fetch, which fails fast and moves on.\n' +
  '    return !(probe && probe.status);\n');

fs.writeFileSync(FILE, src);

// ---- 6. verification pass --------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (cond, msg) => { if (!cond) problems.push(msg); };
must(final.indexOf('function scCancelConversion(btnEl){') !== -1, 'the shared cancel helper is missing');
must(final.includes("if(cancelBtn) cancelBtn.addEventListener('click', function(){ scCancelConversion(); });"), 'the bubble Cancel does not use it');
must((final.match(/scCancelConversion\(cbtn\);/g) || []).length === 2, 'both cards\u2019 x does not cancel the run');
must(final.indexOf('var answers = await Promise.all(asks);') !== -1, 'the player clients are not asked together');
must(final.indexOf('var metaP = tryMeta();') !== -1, 'the title lookup still blocks the run');
must(final.indexOf('var ENC_FAIL = { encoder: true };') !== -1, 'the encoder-failure sentinel is missing');
must(final.indexOf('if(res === ENC_FAIL) return walk(i + 1);') !== -1, 'a format that cannot be produced still ends the run');
must(final.indexOf('return ENC_FAIL; }') !== -1, 'the encoder failure is not reported as one');
must(final.indexOf('[chosen].concat([') !== -1, 'a chosen format still has no fallback list');
must(final.indexOf('return !(probe && probe.status);') !== -1, 'a silent probe still disqualifies a stream');
var _ytStart = final.indexOf('function scYtPlayer(');
var _ytEnd = final.indexOf('\n  function ', _ytStart);
var _ytBody = _ytStart === -1 ? '' : final.slice(_ytStart, _ytEnd === -1 ? _ytStart + 8000 : _ytEnd);
must(_ytBody.indexOf('answered') === -1, 'scYtPlayer still carries its answer counter');

console.log('patch-656: ' + edits + ' index.html edit(s)');
if (problems.length) {
  console.error('patch-656 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-656 verify: OK (the run starts together, falls back on a blocked encoder, and stops from the card)');
