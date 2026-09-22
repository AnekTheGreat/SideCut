#!/usr/bin/env node
// Verification harness for the 60.4.4 patch.
//
// 1. DOWNLOADER — extracts scSpToBuffer + scArtistMatch/scTitleMatch/scDurationOk
//    straight out of index.html and runs them with stubbed network functions,
//    asserting the duration gates behave (Spotisaver-grade: right song only).
// 2. PINNED ARTISTS — extracts loadPinnedArtists/savePinnedArtists with stubbed
//    storage, asserting a failed read can no longer wipe the stored list, bad
//    entries can't kill the render, and one failing view can't hide the rest.
// 3. SYNTAX — acorn-parses every inline <script> in index.html and compares
//    against HEAD, so only NEW failures count.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parse as acornParse } from 'acorn';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let failures = 0;
function check(name, cond, detail) {
  if (cond) console.log(`  PASS  ${name}`);
  else { failures++; console.log(`  FAIL  ${name}${detail ? ' — ' + detail : ''}`); }
}
function slice(start, end, label) {
  const i = src.indexOf(start);
  if (i === -1) throw new Error(`start marker missing (${label})`);
  const j = src.indexOf(end, i);
  if (j === -1) throw new Error(`end marker missing (${label})`);
  return src.slice(i, j);
}

// ---------------------------------------------------------------- downloader
console.log('\n[1] downloader: scSpToBuffer duration/artist/title gates');
{
  const code = slice('  async function scSpToBuffer(meta, onStatus){',
                     '  // SideCut AI assist', 'downloader');
  const env = { cands: [], players: {}, decodeCalls: 0 };
  const scYtSearch = async () => env.cands.map(c => ({ ...c }));
  const scYtPlayer = async (id) => env.players[id] || null;
  const scFetchDecode = async (pa) => {
    env.decodeCalls++;
    if (!pa || pa.__noDecode) return null;
    return { buffer: { duration: pa.__bufDur }, url: 'u' };
  };
  const windowObj = {};
  const api = new Function('scYtSearch', 'scYtPlayer', 'scFetchDecode', 'window',
    code + '\n;return { scSpToBuffer, scArtistMatch, scTitleMatch, scDurationOk };'
  )(scYtSearch, scYtPlayer, scFetchDecode, windowObj);

  const base = (over) => Object.assign({ videoId: 'v', title: 'Song', owner: 'Artist',
    duration: 200, score: 10 }, over);
  const pl = (over) => Object.assign({ author: 'Artist - Topic', videoTitle: 'Artist - Song',
    __bufDur: 200 }, over);

  async function run(meta, setup) {
    env.cands = []; env.players = {}; env.decodeCalls = 0; windowObj.__scSourceFail = '';
    setup(env);
    const res = await api.scSpToBuffer(meta, null);
    return { res, fail: windowObj.__scSourceFail, decodes: env.decodeCalls };
  }
  const M = (over) => Object.assign({ title: 'Song', artist: 'Artist', album: 'LP', seconds: 200 }, over);

  // S1 exact match
  let r = await run(M(), e => { e.cands = [base({})]; e.players.v = pl({}); });
  check('exact match accepted (200s vs 200s)', !!r.res && r.res.videoTitle === 'Artist - Song', r.fail);

  // S2 right song behind a wrong one
  r = await run(M({ title: 'Real Song' }), e => {
    e.cands = [base({ videoId: 'v1', title: 'Other Song' }), base({ videoId: 'v2', title: 'Real Song' })];
    e.players.v1 = pl({ videoId: 'v1', videoTitle: 'Artist - Other Song' });
    e.players.v2 = pl({ videoId: 'v2', videoTitle: 'Artist - Real Song' });
  });
  check('wrong-title source skipped, right one picked', !!r.res && r.res.videoTitle.indexOf('Real Song') !== -1, r.fail);

  // S3 candidate a completely different length never decodes
  r = await run(M(), e => { e.cands = [base({ duration: 500, title: 'Song 10 hour loop' })]; e.players.v = pl({ __bufDur: 500 }); });
  check('500s source for a 200s track rejected before decode', !r.res && r.decodes === 0, `res=${!!r.res} decodes=${r.decodes}`);
  check('failure reason names the length mismatch', /different length/.test(r.fail), r.fail);

  // S4 closest cut (album vs single edit) accepted
  r = await run(M(), e => { e.cands = [base({ duration: 230 })]; e.players.v = pl({ __bufDur: 230 }); });
  check('30s-longer cut accepted as closest match', !!r.res, r.fail);

  // S5 decoded buffer a minute+ off is never saved
  r = await run(M(), e => { e.cands = [base({ duration: 210 })]; e.players.v = pl({ __bufDur: 400 }); });
  check('decoded 400s for a 200s track rejected', !r.res, `res=${!!r.res}`);
  check('…with duration reason, not a silent accept', /different length/.test(r.fail), r.fail);

  // S6 unknown artist still works via verified title+length
  r = await run(M({ artist: '' }), e => { e.cands = [base({})]; e.players.v = pl({ author: 'Anyone' }); });
  check('unknown-artist track still converts', !!r.res, r.fail);

  // S7 no known seconds keeps legacy permissiveness
  r = await run(M({ seconds: 0 }), e => { e.cands = [base({ duration: 500 })]; e.players.v = pl({ __bufDur: 500 }); });
  check('no track length available → no false rejection', !!r.res, r.fail);

  // S8 decode failure surfaces as blocked, not duration
  r = await run(M(), e => { e.cands = [base({})]; e.players.v = pl({ __noDecode: true }); });
  check('blocked download reported as download blocked', !r.res && r.fail === 'download blocked', r.fail);

  // Unit checks of the helpers
  check('scDurationOk(200,214) exact', api.scDurationOk(200, 214) === true);
  check('scDurationOk(200,216) off', api.scDurationOk(200, 216) === false);
  check('scDurationOk(0,x) unknown passes', api.scDurationOk(0, 999) === true);
  check('scTitleMatch containment', api.scTitleMatch('Shape of You', 'Ed Sheeran - Shape of You (Official Music Video)', '') === true);
  check('scTitleMatch unrelated rejected', api.scTitleMatch('Hello', 'Completely Different Song', '') === false);
  check('scArtistMatch collab credit on Topic channel', api.scArtistMatch('Diljit Dosanjh & Sia', 'Diljit Dosanjh - Topic', 'x', 'Diljit Dosanjh', '') === true);
  check('scArtistMatch unrelated uploader rejected', api.scArtistMatch('The Weeknd', 'Random Reactions', 'y', 'Random Reactions', '') === false);
}

// ------------------------------------------------------------ pinned artists
console.log('\n[2] pinned artists: load/save cannot wipe, renders isolated');
{
  const code = slice('  let pinnedArtists = [];',
                     '  // Let the user set their own artist picture', 'pinned');
  const env = { rows: [], trouble: null, failReads: false, retries: 0, reads: 0, puts: [],
                renders: { strip: 0, releases: 0, badge: 0, home: 0 }, releasesThrows: false };
  // Mirrors the real dbGetAll: a failed read returns [] AND leaves the storage
  // trouble flag set (scNoteStorageError); a good read clears it.
  const dbGetAll = async () => {
    env.reads++;
    if (env.failReads) { env.trouble = { why: 'wedged' }; return []; }
    env.trouble = null;
    return env.rows;
  };
  const dbPut = async (store, value) => { env.puts.push({ store, value }); };
  const windowObj = { __scStorageTrouble: () => env.trouble,
                      __scStorageRetry: () => { env.retries++; env.trouble = null; } }; // next failed read re-sets it
  const primaryArtistName = (name) => name;
  const renderPinnedArtists = () => { env.renders.strip++; };
  const renderNewReleases = () => { env.renders.releases++; if (env.releasesThrows) throw new Error('boom'); };
  const updateNotifBadge = () => { env.renders.badge++; };
  const renderHome = () => { env.renders.home++; };

  const api = new Function('dbGetAll', 'dbPut', 'window', 'primaryArtistName',
    'renderPinnedArtists', 'renderNewReleases', 'updateNotifBadge', 'renderHome',
    code + '\n;return { loadPinnedArtists, savePinnedArtists,'
         + ' state: () => ({ pinnedArtists, pinnedReleases, trusted: pinnedLoadTrusted }),'
         + ' seed: (pa, pr, ok) => { pinnedArtists = pa; pinnedReleases = pr || {}; pinnedLoadTrusted = !!ok; } };'
  )(dbGetAll, dbPut, windowObj, primaryArtistName,
    renderPinnedArtists, renderNewReleases, updateNotifBadge, renderHome);

  const reset = () => { env.rows = []; env.trouble = null; env.failReads = false; env.retries = 0; env.reads = 0;
                        env.puts = []; env.releasesThrows = false;
                        env.renders = { strip: 0, releases: 0, badge: 0, home: 0 }; };

  // P1 failed read: retried once, stays untrusted, renders not run
  reset(); env.failReads = true;
  await api.loadPinnedArtists();
  check('failed read retries once', env.retries === 1 && env.reads === 2, `retries=${env.retries} reads=${env.reads}`);
  check('failed read stays untrusted', api.state().trusted === false);
  check('failed read does not paint an empty list as fact', env.renders.strip === 0 && env.renders.home === 0);

  // P2 save while untrusted re-reads and writes the STORED list (+ pending pins)
  reset();
  api.seed([{ name: 'Pending Pin' }], {}, false);
  env.rows = [{ key: 'pinnedArtists', value: [{ name: 'Stored Pin' }] }];
  env.failReads = false;
  await api.savePinnedArtists();
  const written = env.puts.find(p => p.value.key === 'pinnedArtists');
  check('save re-reads instead of writing [] over the list', !!written && written.value.value.length === 2, JSON.stringify(written && written.value.value));
  check('pin added while unreadable survives the merge', !!written && written.value.value.some(a => a.name === 'Pending Pin') && written.value.value.some(a => a.name === 'Stored Pin'));

  // P2b save while untrusted and still unreadable → no write at all
  reset(); env.failReads = true;
  api.seed([], {}, false);
  await api.savePinnedArtists();
  check('unreadable storage → save refused, nothing written', env.puts.length === 0, `puts=${env.puts.length}`);

  // P3 malformed entries skipped; a throwing render can't hide the rest
  reset();
  env.rows = [{ key: 'pinnedArtists', value: [null, { art: 'x' }, { name: 'A' }, { name: 'A' }, { name: 'B' }] }];
  env.failReads = false;
  env.releasesThrows = true;
  await api.loadPinnedArtists();
  const names = api.state().pinnedArtists.map(a => a.name);
  check('malformed entries skipped, dupes deduped', JSON.stringify(names) === '["A","B"]', JSON.stringify(names));
  check('trusted after good read', api.state().trusted === true);
  check('throwing new-releases render does not stop badge/home', env.renders.badge === 1 && env.renders.home === 1, JSON.stringify(env.renders));

  // P4 genuinely empty store is trusted and saves directly
  reset();
  await api.loadPinnedArtists();
  await api.savePinnedArtists();
  check('empty store trusted → save proceeds directly', api.state().trusted === true && env.puts.length === 2 && env.reads === 1,
        `trusted=${api.state().trusted} puts=${env.puts.length} reads=${env.reads}`);
}

// ------------------------------------------------------------------- syntax
console.log('\n[3] syntax: inline scripts vs HEAD (only new failures count)');
{
  function scripts(html) {
    const out = [];
    const re = /<script((?:\s[^>]*)?)>([\s\S]*?)<\/script>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
      if (/\bsrc\s*=/.test(m[1])) continue;
      const body = m[2];
      if (!body.trim()) continue;
      out.push(body);
    }
    return out;
  }
  function parseFailures(html) {
    const fails = [];
    scripts(html).forEach((code, i) => {
      try { acornParse(code, { ecmaVersion: 'latest' }); }
      catch (e) { fails.push(`script#${i}: ${e.message} @ line ${e.loc ? e.loc.line : '?'}`); }
    });
    return fails;
  }
  const head = execFileSync('git', ['show', 'HEAD:index.html'], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const before = parseFailures(head);
  const after = parseFailures(src);
  const newFails = after.filter(f => !before.includes(f));
  check(`no NEW script failures (HEAD had ${before.length} pre-existing, working tree has ${after.length})`,
        newFails.length === 0, newFails.join(' | '));
}

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
