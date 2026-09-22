#!/usr/bin/env node
// v60.5.0 — Play-ready build mode (dual build from one codebase).
//
// Play policy: an app distributed through Google Play must not facilitate
// downloading copyrighted media from video hosts. The sideload/OTA build keeps
// every source exactly as today; the Play build (flag injected by CI's
// patch-playbuild.py, or by dev/ota-bundle-play.mjs for its OTA zip) reads
// openly-licensed catalogs instead and hides the YouTube converter card.
//
// Changes to index.html:
//   1. Block-1 header: SC_IS_PLAY switch + Play UI hiding (YouTube cards,
//      Conversion Tools summary labels). Runs when the parser has already
//      parsed both cards (they sit above line 4378).
//   2. id anchors on both YouTube cards.
//   3. convertYtToMp3 hard gate (covers any path that reaches it).
//   4-7. The four update-channel URL sites become SC_IS_PLAY ternaries, so a
//      Play install checks ota-play/ and can never download the sideload zip.
//   8. APP_VERSION -> 60.5.0 + changelog entry (real EDT ship time).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');

const nowEdt = new Date().toLocaleString('en-US', {
  timeZone: 'America/New_York',
  month: 'long', day: 'numeric', year: 'numeric',
  hour: 'numeric', minute: '2-digit',
}).replace(' at ', ' \u00b7 ') + ' EDT';

const replacements = [
  {
    name: 'block-1 header: SC_IS_PLAY switch + Play UI hiding',
    old: `<script>
// ---- Frame-rate independent drag auto-scroll`,
    neu: `<script>
// ---- Build switch: Play Store build vs sideload/OTA build --------------------
// CI (patch-playbuild.py) injects window.__PLAY_BUILD__ = true into the Play
// AAB's www/index.html before this script runs; the sideload/OTA build never
// sets it and therefore keeps every behavior exactly as it is today. In the
// Play build the acquisition layer reads openly-licensed catalogs (Internet
// Archive netlabel / Creative Commons collections) instead of extracting
// video-host streams, and the YouTube converter card is hidden entirely.
var SC_IS_PLAY = !!(typeof window !== 'undefined' && window.__PLAY_BUILD__);
if(SC_IS_PLAY){
  try{
    ['ytCardDisc','ytCardSettings'].forEach(function(_id){ var _el = document.getElementById(_id); if(_el) _el.style.display = 'none'; });
    var _sums = document.querySelectorAll('summary span');
    for(var _si = 0; _si < _sums.length; _si++){
      if(/YouTube/.test(_sums[_si].textContent || '')) _sums[_si].textContent = 'Spotify \\u00b7 MP4 \\u00b7 Expand URL';
    }
  }catch(_ePlayUI){}
}
// ---- Frame-rate independent drag auto-scroll`,
  },
  {
    name: 'Discover: id on YouTube card',
    old: `      <!-- YouTube card -->
      <div style="margin-bottom:12px; padding:14px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid var(--line);">
        <div style="font-size:12px; font-weight:600; color:var(--coral); margin-bottom:8px;">\u{1F3AC} YouTube to MP3</div>`,
    neu: `      <!-- YouTube card -->
      <div id="ytCardDisc" style="margin-bottom:12px; padding:14px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid var(--line);">
        <div style="font-size:12px; font-weight:600; color:var(--coral); margin-bottom:8px;">\u{1F3AC} YouTube to MP3</div>`,
  },
  {
    name: 'Settings: id on YouTube card',
    old: `        <!-- YouTube card -->
        <div style="margin-bottom:12px; padding:14px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid var(--line);">
          <div style="font-size:12px; font-weight:600; color:var(--coral); margin-bottom:8px;">\u{1F3AC} YouTube to MP3</div>`,
    neu: `        <!-- YouTube card -->
        <div id="ytCardSettings" style="margin-bottom:12px; padding:14px; background:rgba(255,255,255,0.03); border-radius:10px; border:1px solid var(--line);">
          <div style="font-size:12px; font-weight:600; color:var(--coral); margin-bottom:8px;">\u{1F3AC} YouTube to MP3</div>`,
  },
  {
    name: 'convertYtToMp3 hard gate for the Play build',
    old: `  function convertYtToMp3(youtubeUrl, resultEl, btnEl, presetFmt){
    var url = (youtubeUrl || '').trim();`,
    neu: `  function convertYtToMp3(youtubeUrl, resultEl, btnEl, presetFmt){
    // Play build: the card is hidden and the converter must never run \u2014 this
    // gate covers any other path that could still reach it.
    if(SC_IS_PLAY){
      if(resultEl){ resultEl.style.display = 'block'; resultEl.innerHTML = '<span style="color:var(--gold);">\\u26a0 This converter is not part of this build \\u2014 use the Spotify converter, or + Add songs to import your own files.</span>'; }
      return;
    }
    var url = (youtubeUrl || '').trim();`,
  },
  {
    name: 'channel: _otaBase + raw manifest (nativeOtaCheckViaProxy)',
    old: `      var _otaBase = 'https://anekthegreat.github.io/SideCut/ota/';
      var rawManifest = scBust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json');`,
    neu: `      var _scOtaDir = SC_IS_PLAY ? 'ota-play' : 'ota';
      var _otaBase = 'https://anekthegreat.github.io/SideCut/' + _scOtaDir + '/';
      var rawManifest = scBust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/' + _scOtaDir + '/updates.json');`,
  },
  {
    name: 'channel: raw zip URL (web install path)',
    old: `        var zipUrl = scBust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/update.zip');`,
    neu: `        var zipUrl = scBust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/' + (SC_IS_PLAY ? 'ota-play' : 'ota') + '/update.zip');`,
  },
  {
    name: 'channel: Pages manifest (web Check buttons)',
    old: `    var resp = await fetch(scBust('https://anekthegreat.github.io/SideCut/ota/updates.json'));`,
    neu: `    var resp = await fetch(scBust('https://anekthegreat.github.io/SideCut/' + (SC_IS_PLAY ? 'ota-play' : 'ota') + '/updates.json'));`,
  },
  {
    name: 'APP_VERSION -> 60.5.0',
    old: `const APP_VERSION = '60.4.9'`,
    neu: `const APP_VERSION = '60.5.0'`,
  },
  {
    name: 'changelog entry 60.5.0',
    old: `  { version: '60.4.9', date: 'September 22, 2026 \u00b7 3:06 PM EDT'`,
    neu: `  { version: '60.5.0', date: '${nowEdt}', title: 'Play-ready build mode: licensed sources on Play, sideload untouched', items: [
    'Two builds from one codebase: the Google Play build takes audio only from openly-licensed catalogs (Internet Archive netlabel and Creative Commons releases) and files you import yourself, while the sideload build keeps every source exactly as today.',
    'In the Play build the YouTube converter card is hidden and the converter cannot run \\u2014 the Spotify converter, playlists, lyrics, themes, RGB, widget, billing and everything else are identical in both builds.',
    'Each build checks its own update channel (ota-play/ for Play, ota/ for sideload), so a Play install can never receive a sideload bundle.',
  ] },
  { version: '60.4.9', date: 'September 22, 2026 \u00b7 3:06 PM EDT'`,
  },
];

let failed = 0;
for (const r of replacements) {
  const count = src.split(r.old).length - 1;
  if (count !== 1) {
    console.error(`anchor "${r.name}" matched ${count} times (need exactly 1)`);
    failed++;
    continue;
  }
  src = src.replace(r.old, r.neu);
  console.log(`ok  ${r.name}`);
}
if (failed) { console.error(`${failed} anchor(s) failed — nothing written`); process.exit(1); }

fs.writeFileSync(FILE, src);
console.log('written:', FILE, '| changelog date:', nowEdt);
