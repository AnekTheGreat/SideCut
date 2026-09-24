// v60.5.8 — the audit the user asked for: "check that the play version doesn't
// have a downloader nor any mention of one."
//
// What counts as a downloader mention (STRONG): the source-fetching feature —
// converters, Get song, outside converter sites, "no source found". Exports of
// your own files (Download to phone, crossfaded mixes, ZIPs, artwork, CSV) are
// NOT a downloader and must stay visible on every build.
//
// The check runs the SHIPPED code, not a copy of it: the changelog filter, the
// AI help answers and the block-1 Play header are lifted out of index.html and
// executed with the flag both ways.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

// Superset of the shipped filter: if a visible item ever grows a term the
// filter does not know, this still catches it.
const STRONG = /(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i;
const KEEP = /(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i;

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from);
  return src.slice(a, b);
}

console.log('[1] release metadata');
const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok(ver === '61.3.7', 'APP_VERSION = ' + ver);
const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
let entries = null;
try { entries = eval('[' + block[1] + ']'); } catch (e) {}
ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
if (entries) {
  ok(entries[0].items.length >= 5, 'patch notes: ' + entries[0].items.length);
  const shared = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  ok(shared.length >= 1, 'shared notes for the other channel: ' + shared.length);
  ok(!/play build|play version|play install/i.test(entries[0].items.join('\n')), 'notes never name the play build');
}
ok(sw.includes('sidecut-shell-v' + ver), 'service worker cache follows the version');
ok(pkg.version === '5.0.53', 'package.json version = ' + pkg.version);

console.log('[2] block-1 Play header: no downloader mention survives it');
{
  const b1 = sliceBetween('var SC_IS_PLAY =', '// ---- Frame-rate independent');
  const b1nc = b1.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  ok(!STRONG.test(b1nc), 'no strong downloader term in the Play header (code only)');
  ok(!/\bdownload/i.test(b1nc), 'no plain "download" word in the Play header either');
  ok(b1.includes("getElementById('howToGetMusicHead')"), 'tutorial modal gets its "Getting music" section rewritten');
  ok(b1.includes("getElementById('howToScenario1Head')"), 'the converter scenario is hidden');
  ok(b1.includes("getElementById('tutSumGetMusic')"), 'the Settings tutorial summary bullet is rewritten');
  ok(/getSongsHowToDisc[\s\S]*?to import them\./.test(b1nc), 'Discover/Get Songs how-to replacement has no download sentence');
}

console.log('[3] static gates for runtime-created copy');
ok(src.includes(`SC_IS_PLAY ? 'Tap the URL above to copy it.'`), 'Expand URL result hint gated');
ok(src.includes(`SC_IS_PLAY ? '' : '<span style="font-size:11px; color:var(--coral); flex-shrink:0;">Get song</span>'`), 'New releases "Get song" label gated');
ok(!src.includes(`'Use Discover → Get song to download this track.'`), 'new-release tap no longer toasts about downloading');
ok(!src.includes(`'Open Discover to look this track up.'`), 'the old tap-toast wording is gone entirely');
ok(src.includes(`openReleasePage(row.dataset.artist || '', row.dataset.title || '')`), 'new-release tap opens the release page instead of a toast');
ok(src.includes('Import songs that carry an album tag'), 'empty-album note says Import (both builds)');
ok(!src.includes('Download songs that carry an album tag'), 'the old Download wording is gone');
ok(src.includes('Album History, 30-second previews'), 'free-tier blurb says 30-second previews');
ok(!src.includes('Album History, download previews'), 'the old download-previews wording is gone');
ok(!src.includes('to get the full track URL for converters'), 'Expand URL cards no longer name converters');

console.log('[4] AI help answers, run with the flag both ways');
{
  const kbSrc = src.slice(src.indexOf('var _aiKB = ['), src.indexOf('];', src.indexOf('var _aiKB = [')) + 2);
  const mkKB = (flag) => new Function('SC_IS_PLAY', 'window', kbSrc + '\nreturn _aiKB;')(flag, { __PLAY_BUILD__: flag });
  let kbPlay = null, kbFull = null;
  try { kbPlay = mkKB(true); kbFull = mkKB(false); } catch (e) { ok(false, 'KB evaluates: ' + e.message); }
  if (kbPlay && kbFull) {
    ok(kbPlay.length === kbFull.length, 'same answer count on both builds: ' + kbPlay.length);
    const leaks = kbPlay.filter((e) => STRONG.test(e.a));
    ok(leaks.length === 0, 'no Play answer mentions a downloader' + (leaks.length ? ' -> ' + leaks.map((l) => l.q[0]).join(', ') : ''));
    const fullStill = kbFull.filter((e) => STRONG.test(e.a));
    ok(fullStill.length >= 3, 'full build keeps its converter help: ' + fullStill.length + ' answers');
    const howTo = kbPlay.find((e) => e.q.includes('how to get songs'));
    ok(!!howTo && /\+ Add songs/.test(howTo.a), 'how-to-get-songs answer points at + Add songs');
  }
}

console.log('[5] update history filter, run with the flag both ways');
{
  const cl = sliceBetween('function scIsPlayBuild(', 'function renderWhatsNewBody');
  const mk = (flag) => new Function('window', 'SC_IS_PLAY', cl + '\nreturn { changelogItems, changelogTitle };')({ __PLAY_BUILD__: flag }, flag);
  let play, full;
  try { play = mk(true); full = mk(false); } catch (e) { ok(false, 'filter evaluates: ' + e.message); }
  if (play && full && entries) {
    let playVisible = 0, fullVisible = 0, leaks = 0, dlPrinted = [];
    let fullStrong = 0;
    for (const e of entries) {
      for (const it of play.changelogItems(e)) {
        playVisible++;
        if (STRONG.test(it)) { leaks++; console.log('       LEAK item: ' + it.slice(0, 120)); }
        if (/\bdownload/i.test(it)) {
          dlPrinted.push(it.slice(0, 110));
          if (!KEEP.test(it)) { leaks++; console.log('       non-export download note visible: ' + it.slice(0, 120)); }
        }
      }
      const t = play.changelogTitle(e);
      if (STRONG.test(t)) { leaks++; console.log('       LEAK title: ' + t); }
      for (const it of full.changelogItems(e)) { fullVisible++; if (STRONG.test(it)) fullStrong++; }
      if (STRONG.test(full.changelogTitle(e))) fullStrong++;
    }
    ok(leaks === 0, 'Play-visible history has zero downloader mentions (' + playVisible + ' items+titles scanned)');
    console.log('       visible export-style download notes on Play (' + dlPrinted.length + '):');
    dlPrinted.forEach((d) => console.log('         · ' + d));
    ok(fullVisible > playVisible, `full history is bigger than Play history (${fullVisible} vs ${playVisible})`);
    ok(fullStrong >= 15, 'full build keeps its downloader history: ' + fullStrong + ' mentions');
    ok(play.changelogTitle({ title: 'Studio version preference in downloader' }) === 'Fixes & improvements', 'offending title falls back');
    ok(full.changelogTitle({ title: 'Studio version preference in downloader' }) === 'Studio version preference in downloader', 'full build keeps the real title');
    // The exports are not collateral damage:
    let expPlay = 0;
    for (const e of entries) for (const it of play.changelogItems(e)) if (/(Download to phone|ZIP downloads|crossfaded mix download)/i.test(it)) expPlay++;
    ok(expPlay >= 2, 'export notes still visible on Play: ' + expPlay);
    // [FULL] discipline still holds:
    const malformed = entries.flatMap((e) => e.items).filter((i) => i.includes('[FULL]') && !i.startsWith('[FULL] '));
    ok(malformed.length === 0, 'marker only ever appears as a clean [FULL] prefix');
  }
}

console.log('[6] pinned-artist releases: same code on every build');
{
  const a = src.indexOf('async function scPinnedAutoCheck(');
  const b = src.indexOf('document.addEventListener(\'visibilitychange\'', a);
  const body = src.slice(a, b);
  ok(a !== -1 && b !== -1, 'auto-check extractable');
  ok(!/SC_IS_PLAY|__PLAY_BUILD__/.test(body), 'the automatic pinned-artist check is not build-gated');
  ok(src.includes('Dropping soon'), '"Dropping soon" bell entry present');
}

console.log('[7] shipped bundles match');
const man = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
try {
  const mp = man('ota-play/updates.json');
  ok(mp.version === ver, `ota-play manifest v${mp.version} matches ${ver}`);
  ok(mp.notes.length >= 1, 'ota-play has notes: ' + mp.notes.length);
  ok(mp.notes.every((n) => !n.startsWith('[FULL] ')), 'ota-play notes carry no [FULL] marker');
  ok(mp.notes.every((n) => !STRONG.test(n)), 'ota-play notes mention no downloader');
  const mf = man('ota/updates.json');
  ok(mf.version === ver, `ota manifest v${mf.version} matches ${ver}`);
  ok(mf.notes.every((n) => !n.startsWith('[FULL] ')), 'sideload notes have the marker stripped');
  const zp = execFileSync('unzip', ['-p', path.join(ROOT, 'ota-play/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(zp.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'Play flag baked into play zip');
  ok((zp.match(/const APP_VERSION = '([^']+)'/) || [])[1] === ver, 'play zip at current version');
  const zs = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  ok(!zs.includes('<script>window.__PLAY_BUILD__=true;</script>'), 'sideload zip carries NO play flag');
  ok((zs.match(/const APP_VERSION = '([^']+)'/) || [])[1] === ver, 'sideload zip at current version');
} catch (e) { ok(false, 'bundle check: ' + e.message); }

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
