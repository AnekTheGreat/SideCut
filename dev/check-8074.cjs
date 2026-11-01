#!/usr/bin/env node
// 80.7.4 - a song from the catalogue is the whole song, or the row says so.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }
function between(a, b) {
  const i = page.indexOf(a);
  if (i < 0) return '';
  const j = page.indexOf(b, i + a.length);
  return j < 0 ? '' : page.slice(i, j);
}

// ---- the release ------------------------------------------------------------
ok(page.includes("const APP_VERSION = '80.7.4';"), 'the page runs 80.7.4');
const at = page.indexOf("version: '80.7.4'");
ok(at > 0, 'the changelog records 80.7.4');
ok(at < page.indexOf("version: '80.7.3'"), 'and it is the newest entry in it');
const entry = page.slice(at, page.indexOf('{ version:', at + 10));
ok(/date: '[A-Z][a-z]+ \d{1,2}, 2026 · \d{1,2}:\d{2} (AM|PM) E[DS]T'/.test(entry), 'with its day and Eastern time');
const itemsBlock = entry.slice(entry.indexOf('items: ['), entry.indexOf(']},'));
const items = (itemsBlock.match(/'((?:[^'\\]|\\.)*)'/g) || []).map(s => s.slice(1, -1));
ok(items.length === 3, 'three notes (' + items.length + ')');
ok(!items.some(i => i.includes("'")), 'no note carries an apostrophe');
ok(!items.some(i => /streaming|streams?\b|from the source|pinned artist/i.test(i)),
  'and none of them trips the updater filter');
ok(!items.some(i => /both builds|each build|this build|other build|release channel|play store|sideload/i.test(i)),
  'or talks about release channels');

// ---- the row is the song, never a stand-in ----------------------------------
const resolve = between('function scStreamResolve(videoId){', 'function scStreamAltUrl(){');
ok(/scYtPlayer\(id\)/.test(resolve), 'the player is asked for the row\u2019s own video id');
ok(!/scYtSearch|scLegalSearch/.test(resolve), 'and never searches for a stand-in');
const add = between('function scStreamAddResult(it){', 'function scStreamRemove(id){');
ok(/videoId: String\(it\.videoId\)/.test(add), 'the row keeps the exact video id it was added from');
ok(/dur: dur/.test(add), 'and the length the source reported for it');

// ---- the rule ---------------------------------------------------------------
const whole = between('function scStreamWhole(', 'function scStreamFragCheck(');
const frag = between('function scStreamFragCheck(', 'function scStreamPlay(id, ctxIds){');
const timeFn = between('function scStreamTime(s){', '// --- adding');
ok(whole.length > 100 && frag.length > 400, 'the length check and its step are both there');
const tick = between('function scStreamTick(){', '// --- adding');
ok(tick.includes('scStreamFragCheck(a);'), 'the clock on the bar runs the check');
ok(tick.indexOf('scStreamFragCheck(a);') > tick.indexOf('var d = a.duration;'),
  'after it has read the length');
ok(frag.includes('scStreamCacheDrop(t.videoId)'), 'a fragment is dropped from memory');
ok(frag.includes("mime: '', size: 0"), 'the full copy is read on its own terms, not the capped copy\u2019s');
ok(frag.includes("scStreamState.err = 'the source sent a fragment'"), 'and the state names what happened');

// ---- driven ------------------------------------------------------------------
const code = [whole, frag, timeFn].join('\n');
const flush = () => new Promise(r => setImmediate(r));
async function settle() { for (let i = 0; i < 6; i++) await flush(); }
function harness(over) {
  over = over || {};
  const log = { drop: [], say: [], src: [], start: [], resolve: [] };
  const track = Object.assign({ id: 's_k9', videoId: 'k9', title: 'Luna', dur: 192 }, over.track || {});
  const ctx = {
    Number, String, Math, Object, Promise, isFinite, setTimeout,
    scStreamState: Object.assign({ busy: false, curId: 's_k9', fixes: 0, via: 'link', err: '' }, over.state || {}),
    scStreamById: (id) => (String(id) === 's_k9' ? track : null),
    scStreamCacheDrop: (v) => log.drop.push(String(v)),
    scStreamAltUrl: () => (over.alt === undefined ? 'https://cdn.example/muxed' : over.alt),
    scStreamResolve: (v) => { log.resolve.push(String(v)); return Promise.resolve(over.resolved === undefined ? 'https://cdn.example/lead' : over.resolved); },
    scStreamSource: (info) => { log.src.push(info); return Promise.resolve(over.src === undefined ? 'blob:full' : over.src); },
    scStreamStart: (u, at2) => { log.start.push([u, at2]); return Promise.resolve(true); },
    scStreamSay: (m) => log.say.push(String(m))
  };
  vm.createContext(ctx);
  vm.runInContext(code, ctx);
  return { ctx, log };
}

(async function () {
  {
    // A three-minute song arrives as its first minute, with a full copy behind it.
    const { ctx, log } = harness({});
    ctx.scStreamFragCheck({ duration: 64, currentTime: 0 });
    await settle();
    ok(log.drop.length === 1 && log.drop[0] === 'k9', 'the short copy is dropped from memory first');
    ok(log.src.length === 1 && log.src[0].url === 'https://cdn.example/muxed', 'the full copy behind it is read');
    ok(log.src[0].mime === '' && log.src[0].size === 0, 'with its own type instead of the capped copy\u2019s');
    ok(log.start.length === 1 && log.start[0][0] === 'blob:full',
      'and started (' + JSON.stringify(log.start) + ')');
    ok(log.start.length === 1 && Math.abs(log.start[0][1]) < 0.001, 'at the second the fragment stopped on');
    ok(ctx.scStreamState.via === 'read', 'the state says how it is playing now');
    ok(log.say.some(m => /reading the whole song/i.test(m)), 'and the row says what it is doing');
    ok(ctx.scStreamState.busy === false, 'and the step is finished, not stuck');
  }

  {
    // No full copy anywhere: the row says where it stopped instead of pretending.
    const { ctx, log } = harness({ alt: '', resolved: '' });
    ctx.scStreamFragCheck({ duration: 64, currentTime: 0 });
    await settle();
    ok(log.resolve.length === 1 && log.resolve[0] === 'k9', 'it asks the player once more for the song');
    ok(log.src.length === 0, 'and does not read a copy it was not given');
    ok(log.say.some(m => /ends at 1:04 of 3:12/.test(m)), 'the row says which second it ends at (' + JSON.stringify(log.say) + ')');
    ok(log.say.join(' ').indexOf('tap Restart') !== -1, 'and asks for a restart');
    ok(ctx.scStreamState.err === 'the source sent a fragment', 'the diagnostic keeps the reason');
  }

  {
    // The whole song: nothing is touched.
    const { ctx, log } = harness({});
    ctx.scStreamFragCheck({ duration: 192, currentTime: 30 });
    await settle();
    ok(log.drop.length === 0 && log.src.length === 0 && log.start.length === 0 && log.say.length === 0,
      'a whole song is never disturbed');
  }

  {
    // A copy with the video intro on it is longer, not a fragment.
    const { ctx, log } = harness({});
    ctx.scStreamFragCheck({ duration: 213, currentTime: 12 });
    await settle();
    ok(log.src.length === 0, 'a longer copy is left playing');
  }

  {
    // Every copy spent: the ceiling speaks once and stops reading.
    const { ctx, log } = harness({ state: { fixes: 12 } });
    ctx.scStreamFragCheck({ duration: 64, currentTime: 0 });
    await settle();
    ok(log.say.some(m => /Every copy of this song stopped short/.test(m)), 'when every copy is short the row says so');
    ok(log.src.length === 0 && log.start.length === 0, 'and no further copy is read');
    ok(ctx.scStreamState.busy === false, 'without leaving the player busy');
  }

  {
    // The rule itself.
    const { ctx } = harness({});
    const w = ctx.scStreamWhole;
    ok(w(192, 64) === false, 'a three-minute song that stops at 1:04 is a fragment');
    ok(w(192, 192.4) === true, 'the same song at its own length is whole');
    ok(w(192, 210) === true, 'a copy carrying the video intro is not refused for being longer');
    ok(w(192, 178) === true, 'and fifteen seconds of drift is not a fragment');
    ok(w(60, 30) === false, 'a one-minute song that stops at thirty seconds is a fragment');
    ok(w(0, 64) === true, 'a row that never knew its length is not judged');
    ok(w(192, 0) === true, 'an element that has not said yet is not judged');
    ok(w(192, NaN) === true, 'nor one that never will');
  }

  {
    // A song with no video id is not the stream's business.
    const { ctx, log } = harness({ track: { videoId: '' } });
    ctx.scStreamFragCheck({ duration: 64, currentTime: 0 });
    await settle();
    ok(log.drop.length === 0 && log.src.length === 0, 'a row with no video id is left alone');
  }

  // ---- 80.7.3 and 80.7.2 still hold ------------------------------------------
  ok(page.includes("scStreamMenu(scStreamState.curId, 'np')"), 'the dots on the player still open the song\u2019s own menu');
  ok(page.includes('  async function scStreamCropFile(t){'), 'a catalogue song still has bytes to crop');
  ok(page.includes('  async function scCropStreamSave(){'), 'and the clip still lands in the library');
  ok(page.includes("    if(!isFile){\n      acts.push({ label: 'Crop a clip from this song"), 'the catalogue row still offers Crop');
  ok(page.includes("    if(typeof scStreamResumeFromPhone === 'function' && scStreamResumeFromPhone()) return true;"),
    'and a press from outside still resumes a catalogue song');

  // ---- every inline script still compiles ------------------------------------
  const scripts = [...page.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  ok(scripts.length >= 6, 'the page has its inline scripts (' + scripts.length + ')');
  let compiled = 0;
  scripts.forEach((s, i) => {
    try { new vm.Script(s); compiled++; } catch (e) { bad.push('inline script ' + i + ' does not compile: ' + e.message); }
  });
  ok(compiled === scripts.length, 'and all ' + scripts.length + ' of them compile');

  // ---- the channels -----------------------------------------------------------
  const full = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  ok(full.version === '80.7.4', 'ota/updates.json is 80.7.4');
  ok((full.notes || []).length === 3, 'and publishes all three notes (' + (full.notes || []).length + ')');
  const play = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play', 'updates.json'), 'utf8'));
  ok(play.version === '80.7', 'the Play channel is held at 80.7 (' + play.version + ')');
  const hold = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev', 'channel-hold.json'), 'utf8'));
  ok(hold.play === true && !!hold.why, 'and the hold says why');

  console.log('check-8074: %d passed, %d failed', pass, bad.length);
  for (const b of bad) console.log('  x ' + b);
  process.exit(bad.length ? 1 : 0);
})();
