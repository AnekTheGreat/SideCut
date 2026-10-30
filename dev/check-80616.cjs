#!/usr/bin/env node
// 80.6.16 - what must be true of the read and the rows: the read walks every copy the
// resolver answered with, a refusal names itself, and a row keeps artist, length, cover.
//
//   node dev/check-80616.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

ok(page.includes("const APP_VERSION = '80.6.16';"), 'the page runs 80.6.16');
ok(page.includes("version: '80.6.16'"), 'the changelog records 80.6.16');
ok(!page.includes("const APP_VERSION = '80.6.15';"), 'the previous version string is gone');

function sliceFn(name) {
  const at = page.indexOf('\n  function ' + name + '(');
  if (at === -1) return '';
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  return end === -1 ? '' : page.slice(start, end + 4);
}

const src = sliceFn('scStreamSource');
ok(src.length > 1200, 'the read function was found');
ok(src.includes('80.6.16 - THE STREAM WALKS ITS CANDIDATES'), 'the read carries the marker');
ok(src.includes('.concat((scStreamState.alts || [])'), 'the alternates are part of the shortlist');
ok(src.includes('list.reduce('), 'and the shortlist is walked in order');
ok(!src.includes('scFetchBytes(u, size,'), 'the single first-candidate read is gone');
ok(src.includes('scStreamState.mime = mime;'), 'the type of the copy that worked is kept');
ok(src.includes("if(!mime || /^video\\//i.test(mime)) mime = 'audio/mp4';"), 'a muxed copy is labelled audio');
ok(src.includes("if(window.__scCancelDl) return '';"), 'a stopped download still stops the read');
ok(src.includes('restore();'), 'the downloader flag is put back');

function drive(alts, answers) {
  const calls = [];
  const state = { alts: alts || [], via: '', mime: '', size: 0, bytes: 0, blobUrl: '', err: '' };
  const said = [];
  const ctx = {
    scStreamState: state,
    scStreamSay: (m) => said.push(m),
    scStreamTick: () => {},
    scStreamReason: () => 'the source answered 403',
    scFetchBytes: async (url) => { calls.push(url); return answers[url] === undefined ? null : answers[url]; },
    Blob: class { constructor(parts, opts) { this.size = (parts[0] && parts[0].byteLength) || 0; this.type = opts && opts.type; } },
    URL: { createObjectURL: () => 'blob:obj', revokeObjectURL: () => {} },
    window: { __scCancelDl: true },
    Promise,
    setTimeout,
    encodeURIComponent
  };
  vm.createContext(ctx);
  vm.runInContext(src + '\nthis.__run = scStreamSource;', ctx);
  return vm.runInContext('this.__run({url:"u0",mime:"audio/webm; codecs=opus",size:3500000})', ctx)
    .then((res) => ({ res, calls, state, said, flag: ctx.window.__scCancelDl }));
}

(async () => {
  const one = await drive([{ url: 'u1', mime: 'audio/mp4', size: 3500000 }], { u0: null, u1: new ArrayBuffer(2048) });
  ok(JSON.stringify(one.calls) === JSON.stringify(['u0', 'u1']), 'a refused first copy is followed by the second');
  ok(one.res === 'blob:obj', 'the copy that answered is the one played');
  ok(one.state.bytes === 2048, 'and its size is what the row reports');
  ok(one.state.mime === 'audio/mp4', 'and its type');
  ok(one.state.err === '', 'and no error is left on the state');
  ok(one.flag === true, 'the downloader flag is put back after a read');

  const all = await drive([{ url: 'u1', mime: 'audio/mp4', size: 3500000 }], { u0: null, u1: null });
  ok(all.calls.length === 2, 'every copy is tried before the song gives up');
  ok(all.res === '', 'a song with no working copy returns nothing');
  ok(all.state.err === 'the source answered 403', 'and the refusal that ended it is named');
  ok(all.said.some((m) => m.includes('the source answered 403')), 'and the card says it');
  ok(all.flag === true, 'and the downloader flag survives a total failure');

  const muxed = await drive([{ url: 'u1', mime: 'video/mp4; codecs="avc1"', size: 9000000 }], { u0: null, u1: new ArrayBuffer(64) });
  ok(muxed.res === 'blob:obj', 'a progressive muxed copy is playable too');
  ok(muxed.state.mime === 'audio/mp4', 'and is presented as audio, not video');

  const range = page.slice(page.indexOf('async function scFetchRange('), page.indexOf('// "bytes 0-1023/2923372"'));
  ok(range.includes("window.__scHttpWhy = 'the source answered ' + res.status;"), 'a native refusal records its status');
  ok(range.includes("window.__scHttpWhy = 'the page request answered ' + r.status;"), 'a page refusal records its status');
  ok(range.includes("'the range request never answered'"), 'and a silent one is not left blank');

  const add = page.slice(page.indexOf('function scStreamAddResult('), page.indexOf('function scStreamRemove('));
  ok(add.includes("typeof it.duration === 'number'"), 'a numeric length is read as seconds');
  ok(add.includes('it.owner || it.author || it.channel'), 'the artist comes from the field the search sends');
  ok(add.includes("if(!thumb && it.videoId) thumb = 'https://i.ytimg.com/vi/'"), 'a cover is derived from the video id');
  ok(page.includes('var thumb = (thumbs && thumbs.length)'), 'the search result keeps its thumbnail entry');
  ok(page.includes('score: score, thumb: thumb });'), 'and hands the cover to the add button');

  const art = page.slice(page.indexOf('function scStreamThumb('), page.indexOf('function scStreamOpenPlaylist('));
  ok(art.includes("'https://i.ytimg.com/vi/' + encodeURIComponent(vid) + '/mqdefault.jpg'"),
    'an old row gets its cover from the video id, with no request of its own');
  ok(art.includes('var th = scStreamThumb(t);'), 'the art helper uses it');

  const mctx = { scStreamTime: (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') };
  vm.createContext(mctx);
  vm.runInContext(sliceFn('scStreamMeta') + '\nthis.__meta = scStreamMeta;', mctx);
  ok(vm.runInContext('this.__meta({artist:"Diljit Dosanjh",dur:95})', mctx) === 'Diljit Dosanjh \u00b7 1:35',
    'the card line reads artist and length');
  ok(vm.runInContext('this.__meta({artist:"",dur:0})', mctx) === 'Streaming', 'and falls back to the old word');

  ok(page.includes('h += scStreamArt(cur, 44);'), 'the card shows the cover beside the title');
  ok(page.includes('escapeHtml(scStreamMeta(cur))'), 'and the artist and length under it');
  ok(page.includes('margin-top:6px;padding-right:46px;'), 'the readout row keeps clear of the rail');
  ok(page.includes('if(top) top.scrollTop = 0;'), 'opening Streaming puts the page back at its top');
  ok(page.includes("'position:fixed;right:8px;top:50%;margin:0;padding:5px;z-index:70;'"), 'the rail is still fixed on the right');
  ok(page.includes('scIcon(t[2], 17)'), 'and still three glyphs');
  ok(page.includes('function scStreamWatch(u){'), 'the quiet-link watch is still armed');

  if (bad.length) {
    console.log('check-80616: %d passed, %d FAILED', pass, bad.length);
    for (const b of bad) console.log('  x ' + b);
    process.exit(1);
  }
  console.log('check-80616: %d passed, 0 failed', pass);
})();
