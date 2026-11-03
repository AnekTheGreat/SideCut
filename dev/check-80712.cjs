#!/usr/bin/env node
// 80.7.12 - a search that answers when the player will not, and one tap to fill.
//
// Driven, not grepped: scStreamSearchRun is lifted out of the page and run five ways -
// the player answers, the player returns null, the player throws, both refuse, and an
// empty query - and scStreamAddAllResults is run to prove one tap fills the shelf and
// clears the results.
//
//   node dev/check-80712.cjs
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const VERSION = '80.7.12';

let pass = 0;
const failures = [];
function ok(name, cond) {
  if (cond) { pass++; } else { failures.push(name); }
}

// ---- the two channel filters, copied from the bundlers ---------------------
const FULL_DROP = /(streaming|streams?\b|from the source|pinned artist)/i;
function hidesOnPlay(t) {
  if (typeof t !== 'string') return false;
  if (/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source)/i.test(t)) return true;
  if (/\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
  return false;
}
function fullNotes(items) {
  const shown = (items || [])
    .map((it) => (typeof it === 'string' && it.startsWith('[FULL] ')) ? it.slice(7) : it)
    .filter((it) => typeof it !== 'string' || !FULL_DROP.test(it));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}
function playNotes(items) {
  const shown = (items || [])
    .filter((it) => typeof it !== 'string' || (!it.startsWith('[FULL] ') && !hidesOnPlay(it)));
  return (shown.length ? shown : ['Fixes and improvements under the hood.']).slice(0, 6);
}

function fnText(name) {
  const lines = html.split('\n');
  const rx = new RegExp('^\\s*(async\\s+)?function\\s+' + name + '\\s*\\(');
  for (let i = 0; i < lines.length; i++) {
    if (rx.test(lines[i])) {
      let j = i + 1;
      while (j < lines.length && !/^  (async )?function /.test(lines[j])) j++;
      return lines.slice(i, j).join('\n');
    }
  }
  return '';
}

// ---- the release -----------------------------------------------------------
ok('the page is 80.7.12', html.includes("const APP_VERSION = '80.7.12';"));
const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
ok('the changelog block is there', !!block);
let entries = [];
if (block) { try { entries = vm.runInNewContext('[' + block[1] + ']'); } catch (e) { entries = []; } }
const entry = entries.find((e) => String(e.version) === VERSION);
ok('the changelog has an 80.7.12 entry', !!entry);
const items = (entry && entry.items) || [];
ok('the entry carries exactly three notes', items.length === 3);
ok('the title has no apostrophe', !!entry && !/'/.test(String(entry.title)));
ok('no note has an apostrophe', items.every((it) => !/'/.test(String(it))));
ok('the stamp is a date and a time in Eastern time',
  !!entry && /^[A-Z][a-z]+ \d{1,2}, \d{4} \u00b7 \d{1,2}:\d{2} [AP]M (EDT|EST)$/.test(String(entry.date)));
ok('no note names a build, a channel or a branch',
  items.every((it) => !/(play build|sideload|apk\b|branch|google play)/i.test(it)));
ok('the entry sits at the top of the changelog', entries.findIndex((e) => String(e.version) === VERSION) === 0);
ok('every note is marked for the full build only', items.every((it) => String(it).startsWith('[FULL] ')));
ok('the full card publishes all three notes', fullNotes(items).length === 3);
ok('the notes survive the full channel filter', fullNotes(items).every((n) => !FULL_DROP.test(n)));
ok('the Play card falls back rather than advertising what it cannot do',
  JSON.stringify(playNotes(items)) === JSON.stringify(['Fixes and improvements under the hood.']));

// ---- the open catalogue ----------------------------------------------------
const asearch = fnText('scStreamArchiveSearch');
ok('the open catalogue is searched with a plain GET', asearch.includes('advancedsearch.php') &&
  asearch.includes('output=json'));
ok('it asks for audio only', asearch.includes("'mediatype:(audio) AND '"));
ok('it reads the docs the catalogue returns', asearch.includes('d.response.docs'));
ok('it ranks by downloads', asearch.includes('downloads%20desc'));
ok('an archive row is marked with its own id', asearch.includes("videoId: 'ia:' + ident"));
ok('and carries an archive cover', asearch.includes('archive.org/services/img/'));
ok('a failure returns nothing rather than throwing', /catch\(function\(\)\{ return null; \}\)/.test(asearch));

const ares = fnText('scStreamArchiveResolve');
ok('an item resolves through its metadata', ares.includes('archive.org/metadata/'));
ok('it prefers the mp3 and takes any audio behind it', /\.mp3\$\/i\.test\(n\)/.test(ares) &&
  ares.includes('var file = pick || fallback;'));
ok('and the stream is the item file itself', ares.includes("'https://archive.org/download/'"));
ok('a failure resolves to nothing', /catch\(function\(\)\{ return ''; \}\)/.test(ares));

ok('the resolver routes an archive id to the archive',
  html.includes('if(scStreamIsArchive(id)) return scStreamArchiveResolve(id);'));
ok('a cover for an archive row comes from the archive',
  html.includes("encodeURIComponent(vid.replace(/^ia:/, ''))"));

// ---- one tap ---------------------------------------------------------------
const all = fnText('scStreamAddAllResults');
ok('add all exists', !!all);
ok('it adds through the same path a single Add uses', all.includes('scStreamAddResult(list[i])'));
ok('it counts only what was really added', all.includes('added++'));
ok('it clears the results so the shelf is the songs', all.includes('scStreamState.results = null'));
ok('it says how many landed', /Added ' \+ added \+ ' song/.test(all));
ok('and says when they were already there', /already in Streaming/.test(all));
ok('the button is wired', html.includes("on('scStreamAddAll', 'click', scStreamAddAllResults);"));
ok('the results show a count and the button', html.includes("' found' + (scStreamState.resultsSrc"));
ok('the button says get songs', html.includes("' Get songs</button>'"));
ok('the field says what to type', html.includes('Type a song or an artist'));

// ---- driven: the search ----------------------------------------------------
const search = fnText('scStreamSearchRun');

function searchWorld(opts) {
  const o = opts || {};
  const said = [];
  const ctx = {
    console: { warn() {}, log() {} },
    scStreamState: { q: '', results: null, resultsSrc: '', tracks: [] },
    scStreamRender: () => {},
    scStreamSay: (s) => said.push(String(s)),
    scStreamReason: () => (o.reason || ''),
    scYtSearch: () => (o.ytThrows ? Promise.reject(new Error('boom')) : Promise.resolve(o.yt || null)),
    scStreamArchiveSearch: () => { ctx.__archiveAsked = true; return Promise.resolve(o.archive || null); }
  };
  vm.createContext(ctx);
  vm.runInContext(search + '\nthis.__s = scStreamSearchRun;', ctx);
  return { ctx, said };
}

(async () => {
  {
    const w = searchWorld({ yt: [{ videoId: 'v1' }, { videoId: 'v2' }] });
    w.ctx.__s('aaj sajeya');
    await new Promise((r) => setTimeout(r, 20));
    ok('driven: when the player answers, its rows are the results', w.ctx.scStreamState.results.length === 2);
    ok('driven: and it says which catalogue answered', w.ctx.scStreamState.resultsSrc === 'the source');
    ok('driven: the catalogue is not asked when the player answered', !w.ctx.__archiveAsked);
  }
  {
    const w = searchWorld({ yt: null, archive: [{ videoId: 'ia:x' }] });
    w.ctx.__s('aaj sajeya');
    await new Promise((r) => setTimeout(r, 20));
    ok('driven: when the player refuses, the open catalogue fills the shelf',
      w.ctx.scStreamState.results.length === 1 && w.ctx.scStreamState.results[0].videoId === 'ia:x');
    ok('driven: and the shelf says where they came from',
      w.ctx.scStreamState.resultsSrc === 'the open catalogue');
    ok('driven: and it says how many were found', /Found 1 in the open catalogue/.test(w.said.join(' ')));
  }
  {
    const w = searchWorld({ yt: null, archive: null, reason: 'native request failed' });
    w.ctx.__s('aaj sajeya');
    await new Promise((r) => setTimeout(r, 20));
    ok('driven: when both refuse, the shelf is empty', w.ctx.scStreamState.results.length === 0);
    ok('driven: and the line names what failed', /native request failed/.test(w.said.join(' ')));
  }
  {
    const w = searchWorld({ ytThrows: true, archive: [{ videoId: 'ia:y' }] });
    w.ctx.__s('aaj sajeya');
    await new Promise((r) => setTimeout(r, 30));
    ok('driven: a search that throws still falls back to the catalogue',
      w.ctx.scStreamState.results.length === 1 && w.ctx.scStreamState.results[0].videoId === 'ia:y');
  }
  {
    const w = searchWorld({ yt: null, archive: null });
    w.ctx.__s('   ');
    ok('driven: an empty query says what to do instead of searching', /Type a song or an artist first/.test(w.said.join(' ')));
  }

  // ---- driven: add all -----------------------------------------------------
  function allWorld(opts) {
    const o = opts || {};
    const said = [];
    const ctx = {
      scStreamState: { results: (o.results || []).slice(), resultsSrc: 'the open catalogue', tracks: (o.tracks || []).slice() },
      scStreamSay: (s) => said.push(String(s)),
      scStreamRender: () => {},
      scStreamAddResult: (it) => {
        if (o.dupe && o.dupe.indexOf(it.videoId) !== -1) return;
        ctx.scStreamState.tracks.push({ videoId: it.videoId });
      }
    };
    vm.createContext(ctx);
    vm.runInContext(fnText('scStreamAddAllResults') + '\nthis.__a = scStreamAddAllResults;', ctx);
    return { ctx, said };
  }
  {
    const w = allWorld({ results: [{ videoId: 'a' }, { videoId: 'b' }, { videoId: 'c' }] });
    w.ctx.__a();
    ok('driven: add all adds every result', w.ctx.scStreamState.tracks.length === 3);
    ok('driven: and says how many landed', /Added 3 songs/.test(w.said.join(' ')));
    ok('driven: and the shelf is then the songs, not the results', w.ctx.scStreamState.results === null);
  }
  {
    const w = allWorld({ results: [{ videoId: 'a' }, { videoId: 'b' }], dupe: ['a', 'b'] });
    w.ctx.__a();
    ok('driven: a duplicate is not added twice', w.ctx.scStreamState.tracks.length === 0);
    ok('driven: and it says they are already there', /already in Streaming/.test(w.said.join(' ')));
  }
  {
    const w = allWorld({ results: [] });
    w.ctx.__a();
    ok('driven: add all with nothing searched says so', /Search something first/.test(w.said.join(' ')));
  }

  // ---- survivors -----------------------------------------------------------
  ok('80.7.11 still shows the save stages', html.includes('function scKeepPanelOpen('));
  ok('80.7.11 still opens the shelf with nothing imported', html.includes("scLibraryReadOk) ? 'none' : 'flex'"));
  ok('80.7.10 still opens a stream from its first megabyte', html.includes('  function scStreamPrefix(u, mime){'));
  ok('80.7.9 still keeps a song from the source', html.includes('  function scStreamKeepTrack(id, file){'));
  ok('the save is still a visible button on a row', /class="scs-keep" data-id="/.test(html));
  ok('the catalogue is still gated off the Play build', html.includes('var SC_STREAM_OK = !SC_IS_PLAY;'));

  // ---- every inline script compiles ----------------------------------------
  let scripts = 0;
  const rx = /<script\b([^>]*)>([\s\S]*?)<\/script>/g;
  let m;
  while ((m = rx.exec(html))) {
    const attrs = m[1] || '';
    if (/\bsrc=/.test(attrs) || /type=["']module["']/.test(attrs)) continue;
    scripts++;
    try { new vm.Script(m[2], { filename: 'index.html#script' + scripts }); }
    catch (err) { ok('inline script ' + scripts + ' compiles: ' + err.message, false); }
  }
  ok('every inline script compiles', scripts > 0);

  // ---- both channels -------------------------------------------------------
  const rd = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
  const size = (p) => fs.statSync(path.join(ROOT, p)).size;
  let full = null, play = null, hold = null;
  try { full = rd('ota/updates.json'); } catch (e) { full = null; }
  try { play = rd('ota-play/updates.json'); } catch (e) { play = null; }
  try { hold = rd('dev/channel-hold.json'); } catch (e) { hold = null; }
  ok('the full channel is v80.7.12', !!full && String(full.version) === VERSION);
  ok('the full channel publishes the three notes', !!full && JSON.stringify(full.notes) === JSON.stringify(fullNotes(items)));
  ok('the full channel size is the zip size', !!full && full.size === size('ota/update.zip'));
  ok('the Play channel is not held', !!hold && hold.play === false);
  ok('the Play channel is v80.7.12', !!play && String(play.version) === VERSION);
  ok('the Play channel publishes the fallback, not the feature', !!play && JSON.stringify(play.notes) === JSON.stringify(playNotes(items)));
  ok('the Play channel size is its zip size', !!play && play.size === size('ota-play/update.zip'));
  let zipped = '', playZipped = '';
  try { zipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { zipped = ''; }
  try { playZipped = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) { playZipped = ''; }
  ok('the shipped full page carries the second catalogue',
    /const APP_VERSION = '80\.7\.12';/.test(zipped) && zipped.includes('function scStreamArchiveSearch('));
  ok('the shipped Play page is the same page with its flag',
    /const APP_VERSION = '80\.7\.12';/.test(playZipped) && playZipped.includes('window.__PLAY_BUILD__=true'));

  if (failures.length) {
    console.log('check-80712: ' + pass + ' passed, ' + failures.length + ' failed');
    failures.forEach((f) => console.log('  x ' + f));
    process.exit(1);
  }
  console.log('check-80712: ' + pass + ' passed, 0 failed');
})();
