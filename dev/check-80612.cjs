#!/usr/bin/env node
// 80.6.12 - what must be true of the page: a tab, not a drawer, and a stream that
// is fetched rather than pointed at.
//
//   node dev/check-80612.cjs
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

// --- the version and its entry -------------------------------------------
ok(page.includes("const APP_VERSION = '80.6.12';"), 'the page runs 80.6.12');
ok(page.includes("version: '80.6.12'"), 'the changelog records 80.6.12');
ok(!page.includes("const APP_VERSION = '80.6.11';"), 'the previous version string is gone');

// --- the tab, not the drawer ---------------------------------------------
ok(page.includes('function scShelfPage(on)'), 'one function owns which page is up');
ok(page.includes("'#scStreamBlock{position:relative;display:none;width:auto;overflow:visible;'"),
  'the shelf is in flow and hidden, not fixed and slid');
ok(page.includes("'#scStreamBlock.scShelfOpen{display:block}'"), 'its tab shows it as a block');
ok(!page.includes('translateX(102%)'), 'no slide-in transform is left');
ok(page.includes("'#scShelfScrim{display:none}'"), 'the scrim is not a surface any more');
ok(page.includes("if(list){ list.style.display = on ? 'none' : ''; }"), 'the list is put away, not rebuilt');
ok(!/setAttribute\('aria-hidden', 'true'\); sheet\.setAttribute\('role', 'dialog'\)/.test(page),
  'a tab is not announced as a dialog');

// The order the tab builds its page in: render, show, then boot.
const openTab = page.slice(page.indexOf('function scShelfOpenTab(tab)'), page.indexOf('function scShelfBoot()'));
ok(openTab.indexOf('scStreamRender();') < openTab.indexOf('scShelfPage(true);'),
  'the shelf is painted before it is shown');
ok(openTab.includes('scStreamBoot();'), 'the tab builds the shelf if it has not been built yet');

// --- the stream is fetched -----------------------------------------------
ok(page.includes('function scStreamSource(info)'), 'the source helper exists');
const src = page.slice(page.indexOf('function scStreamSource(info)'), page.indexOf('// --- the audio element'));
ok(src.includes('scFetchBytes(u, size,'), 'it reads the song with the downloader\'s own reader');
ok(src.includes('URL.createObjectURL(blob)'), 'and plays what it read, from an object URL');
ok(src.includes("type: mime"), 'the blob carries the stream\'s own type');
ok(src.includes('a.src = u;'), 'the plain URL is still the last try');
ok(src.includes("+ pct + '%'"), 'the load reports how much has arrived');
ok(src.indexOf('scFetchBytes') < src.indexOf('a.src = u;'), 'the fetch is tried before the plain URL');

// Every place that used to point the element at a URL goes through it now. The
// check is scoped to the streaming player, because the app's own player has its
// own element and its own reasons to set a src.
const playFn = page.slice(page.indexOf('function scStreamPlay('), page.indexOf('function scStreamToggle('));
ok(playFn.length > 200, 'the play path was found');
ok(!/a\.src = u;/.test(playFn), 'the play path never hands the element a bare URL');
ok(playFn.includes('scStreamSource({ url: u'), 'it hands the resolver\'s answer to the fetcher');
ok(page.includes("return scStreamSource({ url: u, mime: scStreamState.mime })"), 'the play path fetches');
ok(page.includes("if(scStreamState.curId === String(id) && scStreamState.blobUrl"), 'a buffered song is reused, not fetched twice');
ok(page.includes('scStreamState.mime = String(r.mime || \'\');'), 'the resolver\'s mime is kept');

// --- no glyphs came back --------------------------------------------------
const mod = page.slice(page.indexOf('var SC_STREAM_OK'), page.indexOf('var SC_STREAM_OK') + 40000);
['\uff0b', '\u23ee', '\u23f8', '\u23ed', '\u00d7'].forEach((ch) => {
  ok(mod.indexOf(ch) === -1, 'no U+' + ch.codePointAt(0).toString(16).toUpperCase() + ' inside the shelf');
});

console.log('\ncheck-80612: ' + pass + ' passed, ' + bad.length + ' failed');
bad.forEach((b) => console.log('  x ' + b));
process.exit(bad.length ? 1 : 0);
