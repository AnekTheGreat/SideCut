#!/usr/bin/env node
// The Play build's copy, audited on a WIDER NET than the shipped filter.
//
// The user's ask: "in the play version of the app make sure there are no
// references of a downloader or converter that downloads music — same thing in
// patch notes."
//
// dev/test-6058.mjs is the contract: it runs the SHIPPED filter (scHidesOnPlay)
// over every changelog item and asserts the Play-visible history is clean, and it
// checks the Play header, the AI answers and the bundles. This file is the net
// AROUND that contract — it re-tests what a Play reader can actually see against a
// BROADER term list than the filter knows, so a future note that names the
// feature in wording the filter has never seen fails here instead of shipping to
// the store build.
//
// Three things a Play reader may legitimately still read. Each is named below so
// this cannot quietly widen into a blanket exemption:
//   1. exports of YOUR OWN files — "Download to phone", ZIPs, crossfaded mixes.
//      Not a music downloader; the repo's rule keeps them on every build.
//   2. the app updating ITSELF — v56.0.16's "megabytes downloaded" is the OTA
//      update screen, not music.
//   3. the "Get Songs" SURFACE name. That screen exists on the Play build too
//      (its own help text is rewritten to importing the files you own), so a
//      historical note that merely names it is navigation, not a downloader.
//      The SINGULAR "Get Song" is a real reference and is NOT exempt.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };

function sliceBetween(from, to) {
  const a = src.indexOf(from);
  const b = src.indexOf(to, a);
  if (a === -1 || b === -1) throw new Error('could not extract ' + from + ' .. ' + to);
  return src.slice(a, b);
}

// The nearest `id="..."` before a position — which container a blob of markup
// lives in, so "is this link inside the element the Play header wipes?" is a
// question with an answer rather than a guess.
function containerOf(at) {
  const ids = [...src.slice(0, at).matchAll(/id="([^"]+)"/g)];
  return ids.length ? ids[ids.length - 1][1] : null;
}

// ---------------------------------------------------------------- the app UI
console.log('[1] the Play build cannot reach a converter');
{
  // The header block is the whole hiding story for the UI.
  const header = sliceBetween('if(SC_IS_PLAY){', '// ---- Frame-rate independent drag auto-scroll');
  for (const id of ['ytCardDisc', 'ytCardSettings', 'spCardDisc', 'spCardSettings']) {
    ok(header.includes("'" + id + "'"), 'the Play header hides the ' + id + ' card');
  }
  ok(header.includes("classList.add('sc-play-build')"), 'the sc-play-build class cuts render-only buttons');
  ok(/howToGetMusicHead[\s\S]*?does not stream or fetch anything itself/.test(header),
    'the tutorial explains the app does not fetch music, instead of teaching a converter');
  ok(header.includes("getElementById('howToScenario1Head')"), 'the converter tutorial scenario is hidden');
  // The Get Songs tab is steps only on Play, and the tools under it are gone.
  // Both halves matter: the box is what TAUGHT the converter, and the section
  // right below it is what HELD the converter, the link expander, the MP4 card
  // and the format explainer. dev/test-619.mjs proves that section really is the
  // next element of each box, tag by tag; here the Play reader's view is pinned.
  ok(header.includes('var _getSongsSteps ='),
    'the Get Songs how-to is rewritten into a walkthrough');
  ok(header.includes("nextElementSibling.style.display = 'none'"),
    'and the whole tool section below it is put away on Play');
  ok(header.includes("['getSongsHowToDisc','getSongsHowToSettings']"),
    'both Get Songs surfaces are the ones rewritten (Discover and Settings)');
  {
    const from = header.indexOf('var _getSongsSteps =');
    const to = header.indexOf("['getSongsHowToDisc','getSongsHowToSettings']");
    const steps = new Function(header.slice(from, to) + '\nreturn _getSongsSteps;')();
    const text = steps.replace(/<[^>]*>/g, ' ');
    ok(!/converter|spotify|spotisaver|spotmate|youtube|to mp3|download|expand url/i.test(text),
      'the walkthrough a Play reader is shown names no converter, site or tool');
    ok(/\(1\.\)|1\./.test(text) && /\+ Add songs/.test(text) && /Import library/.test(text),
      'it is real steps for bringing your own MP3s in, not a pointer at anything');
  }
  ok(!/spotisaver|spotmate|ytmp3/i.test(header), 'the header never names an outside converter site');

  // Both converters refuse up front, before they do any work.
  ok(/if\(SC_IS_PLAY\)\{[\s\S]{0,220}?not part of this build[\s\S]{0,120}?return;/.test(src),
    'the YouTube converter refuses on Play with "not part of this build"');
  ok(/if\(SC_IS_PLAY\)\{[\s\S]{0,220}?are not part of this build[\s\S]{0,120}?return;/.test(src),
    'the Spotify converter refuses on Play with "are not part of this build"');

  // Every outside-converter-site link in the whole file, and WHY a Play build
  // cannot render it. There are only two stories and both must hold:
  //   * the static how-to markup -> its two containers are the ones the Play
  //     header rewrites (so the links are wiped, not merely hidden);
  //   * the full build's in-app fallback -> reached only after the Play branch
  //     has already returned.
  const WIPED = ['getSongsHowToDisc', 'getSongsHowToSettings'];
  const playRefusal = src.indexOf('Not in the openly-licensed catalogs');
  ok(playRefusal !== -1, 'the Play branch has its own licensed-catalog return');
  const siteRe = /https:\/\/(?:spotisaver\.net|spotmate\.online)/g;
  let m, inWiped = 0, afterRefusal = 0;
  const stray = [];
  while ((m = siteRe.exec(src))) {
    const id = containerOf(m.index);
    if (WIPED.includes(id)) { inWiped++; continue; }
    if (playRefusal !== -1 && m.index > playRefusal) afterRefusal++;
    else stray.push((id || '(no container)') + ' @ ' + m.index);
  }
  ok(inWiped >= 4, 'the how-to boxes carry the outside-site links, inside the two containers Play wipes: ' + inWiped);
  ok(afterRefusal >= 2, 'the only other links are the in-app fallback, after the Play branch returns: ' + afterRefusal);
  ok(stray.length === 0, 'no outside-site link sits anywhere else' + (stray.length ? ': ' + stray.join(', ') : ''));
  ok(src.includes('licensed sources'), 'the version line names the build');

  // The AI answers are swapped, not just words out of them.
  const kbSrc = src.slice(src.indexOf('var _aiKB = ['), src.indexOf('];', src.indexOf('var _aiKB = [')) + 2);
  const gated = (kbSrc.match(/a: SC_IS_PLAY \?/g) || []).length;
  ok(gated >= 4, 'AI answers that could describe fetching music have a Play variant: ' + gated);
}

// ------------------------------------------------- the patch notes, wider net
console.log('[2] Play-visible patch notes, on a term list wider than the filter');
{
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'changelog evaluates: ' + e.message); }

  const MUSIC_FETCH = /(downloader|downloading|converter|converts|converting|conversion|\bconvert\b|spotify to mp3|youtube to mp3|\bto mp3\b|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch|no source found|hand-?off|save the file|save each song|get song\b)/i;
  const EXPORT_OK = /(Download to phone|crossfaded mix( downloads?)?|crossfaded mixes|ZIP downloads?|\.zip downloads?|artwork downloads?|re-?downloads?|megabytes downloaded|while it downloads)/gi;
  const SURFACE_OK = /\bGet Songs\b/g;

  // The exemption is narrow, and this proves it: a singular Get-song reference is
  // still caught, the surface name alone is not.
  ok(MUSIC_FETCH.test('Get Song and Find on Spotify now copies the link'),
    'a singular Get-song reference is still caught by the wider list');
  ok(!MUSIC_FETCH.test('just like the one in Get Songs'.replace(SURFACE_OK, ' ')),
    'the Get Songs SURFACE name alone is not treated as a downloader reference');
  ok(MUSIC_FETCH.test('YouTube to MP3 works again'), 'and a YouTube to MP3 reference is caught');

  if (entries) {
    const cl = sliceBetween('function scIsPlayBuild(', 'function renderWhatsNewBody');
    const play = new Function('window', 'SC_IS_PLAY', cl + '\nreturn { changelogItems, changelogTitle };')({ __PLAY_BUILD__: true }, true);
    let visible = 0;
    const off = [];
    for (const e of entries) {
      const texts = [play.changelogTitle(e)].concat(play.changelogItems(e));
      for (const t of texts) {
        visible++;
        const probe = String(t).replace(EXPORT_OK, ' ').replace(SURFACE_OK, ' ');
        if (MUSIC_FETCH.test(probe)) off.push('v' + e.version + ': ' + String(t).slice(0, 130));
      }
    }
    ok(off.length === 0, 'no Play-visible note reads as a music downloader on the wider list');
    off.forEach((o) => console.log('         LEAK ' + o));
    // The filter must be hiding something real, not passing because it hid everything.
    ok(visible > 500, 'the audited Play history is populated: ' + visible + ' strings');
  }
}

// ------------------------------------------------ what a Play install receives
console.log('[3] the notes a Play install is actually offered');
{
  const man = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota-play/updates.json'), 'utf8'));
  const WIDER = /(downloader|downloading|\bdownload|converter|converts|converting|conversion|\bconvert\b|\bmp3\b|get song|no source found|hand-?off|ytmp3|vocal remover|spotisaver|spotmate|spotidown|spoticatch)/i;
  // Same narrow exemption as [2], for the same reason: a note that merely names
  // the "Get Songs" SCREEN is navigation, not a downloader reference. The
  // singular "Get Song" still trips the list, which [2] proves.
  const SURFACE_OK = /\bGet Songs\b/g;
  const bad = (man.notes || []).filter((n) => WIDER.test(String(n).replace(SURFACE_OK, ' ')));
  bad.forEach((b) => console.log('         LEAK ' + JSON.stringify(b.slice(0, 130))));
  ok(bad.length === 0, 'ota-play notes name no downloader or converter (' + (man.notes || []).length + ' notes)');
  ok(!/play build|play version|play install/i.test((man.notes || []).join('\n')), 'and never name the Play build');
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
