// v60.5.8 — "check that the other build doesn't have a downloader nor any
// mention of one." One counted, atomic patch:
//   1. Onboarding + help copy: the first-run/Replay tutorial modal, the
//      Settings tutorial summary, the Discover + Get Songs how-to box and the
//      in-app AI help answers teach the converter everywhere. Block-1 now
//      rewrites the three static ones (howToGetMusicHead parent, the tutorial
//      bullet, scenario 1 hidden) and the four _aiKB answers become SC_IS_PLAY
//      ternaries — no downloader is named on that build.
//   2. Expand URL: both cards describe "the full track URL" (the words "for
//      converters" are gone in both builds — the how-to still explains why),
//      and the result hint only names a converter on the full build.
//   3. New releases: the "Get song" row label and its tap toast are gated.
//   4. Update history: scIsPlayBuild/scHidesOnPlay + changelogTitle(). The
//      history filter hides notes AND titles about the song downloader
//      (converting, sources, outside converter sites, Get song) while export
//      notes (Download to phone, crossfaded mixes, ZIPs, artwork, CSV) stay.
//      All five title render sites route through changelogTitle().
//   5. Wording that is wrong on every build: the empty-album note says
//      "Import songs", the free-tier blurb says "30-second previews".
//   6. Version 60.5.8 / sw cache follows / older test pins move.
import fs from 'node:fs';

let ok = 0, failed = 0;
const HTML = 'index.html';

function read(file){ return fs.readFileSync(file, 'utf8'); }
function fail(label, extra){
  failed++;
  console.error('FAIL ' + label + (extra ? ' — ' + extra : ''));
}
function apply(file, oldStr, newStr, label, expect = 1){
  const src = read(file);
  const parts = src.split(oldStr);
  const hits = parts.length - 1;
  if(hits !== expect){ fail(label, 'found ' + hits + ' (expected ' + expect + ')'); return; }
  fs.writeFileSync(file, parts[0] + newStr + parts.slice(1).join(oldStr));
  ok++;
}
function assertContains(file, needle, label){
  if(read(file).includes(needle)) { ok++; } else { fail(label, 'missing: ' + needle.slice(0, 80)); }
}

/* ---------- 1. tutorial modal + summary: id hooks for block-1 ---------- */
apply(HTML,
`<div style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>`,
`<div id="howToGetMusicHead" style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>`,
'howToGetMusicHead id');

apply(HTML,
`<div style="color:var(--ink); font-weight:600; margin-bottom:4px;">1 · Get one song off Spotify into SideCut (free)</div>`,
`<div id="howToScenario1Head" style="color:var(--ink); font-weight:600; margin-bottom:4px;">1 · Get one song off Spotify into SideCut (free)</div>`,
'howToScenario1Head id');

apply(HTML,
`<div style="display:flex; gap:8px; margin-bottom:4px;"><span style="color:var(--coral); flex-shrink:0;">•</span><span><b>Getting music in:</b> SideCut plays audio files`,
`<div id="tutSumGetMusic" style="display:flex; gap:8px; margin-bottom:4px;"><span style="color:var(--coral); flex-shrink:0;">•</span><span><b>Getting music in:</b> SideCut plays audio files`,
'tutSumGetMusic id');

/* ---------- 2. block-1: reword the how-to replacement, rewrite the modal ---- */
apply(HTML,
`to import them. Downloading and converting other services\\u2019 audio is not part of this build.';`,
`to import them.';`,
'how-to replacement loses the download sentence');

apply(HTML,
`      if(/Spotify/.test(_sumTxt) && /MP4/.test(_sumTxt)) _sums[_si].textContent = 'MP4 · Expand URL';
    }
  }catch(_ePlayUI){}`,
`      if(/Spotify/.test(_sumTxt) && /MP4/.test(_sumTxt)) _sums[_si].textContent = 'MP4 · Expand URL';
    }
    // The first-run / Replay tutorial and the how-to modal teach the converter
    // on the full build; here they only describe bringing your own files in, so
    // this build never points at a downloader.
    var _hd = document.getElementById('howToGetMusicHead');
    if(_hd && _hd.parentNode) _hd.parentNode.innerHTML = '<div style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>'
      + '<div style="font-size:12.5px; color:var(--ink-dim); line-height:1.5;">SideCut plays the audio files saved on your device — it does not stream or fetch anything itself.</div>'
      + '<div style="display:flex; flex-direction:column; gap:4px; font-size:12.5px; color:var(--ink-dim); margin-top:8px;">'
      + '<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">1.</span><span>Tap <b>+ Add songs ▾ → + Files</b> and pick the audio already on your phone — it lands in your library right away.</span></div>'
      + '<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">2.</span><span><b>+ Add folder</b> grabs a whole folder at once — handy for a full album.</span></div>'
      + '<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">3.</span><span><b>Import library</b> restores a full backup .zip, including playlists, albums and tags.</span></div>'
      + '</div>';
    var _s1 = document.getElementById('howToScenario1Head');
    if(_s1 && _s1.parentNode) _s1.parentNode.style.display = 'none';
    var _tsg = document.getElementById('tutSumGetMusic');
    if(_tsg) _tsg.innerHTML = '<span style="color:var(--coral); flex-shrink:0;">•</span><span><b>Getting music in:</b> SideCut plays audio files saved on your device — bring them in with <b>+ Add songs ▾ → + Files</b> or <b>+ Add folder</b>; <b>Import library</b> restores a backup .zip.</span>';
  }catch(_ePlayUI){}`,
'block-1 rewrites tutorial modal + summary');

/* ---------- 3. Expand URL copy ---------- */
apply(HTML,
`to get the full track URL for converters`,
`to get the full track URL`,
'Expand URL cards stop naming converters', 2);

apply(HTML,
`'<div style="margin-top:6px; font-size:11px; color:var(--ink-dim);">Tap the URL above to copy it, then paste into any Spotify-to-MP3 converter.</div>';`,
`'<div style="margin-top:6px; font-size:11px; color:var(--ink-dim);">' + (SC_IS_PLAY ? 'Tap the URL above to copy it.' : 'Tap the URL above to copy it, then paste into any Spotify-to-MP3 converter.') + '</div>';`,
'Expand URL result hint gated');

/* ---------- 4. New releases: Get song label + tap toast ---------- */
apply(HTML,
`        <span style="font-size:11px; color:var(--coral); flex-shrink:0;">Get song</span>`,
`        \${SC_IS_PLAY ? '' : '<span style="font-size:11px; color:var(--coral); flex-shrink:0;">Get song</span>'}`,
'Get song row label gated');

apply(HTML,
`      // The public app stays in-app; downloading is handled from Discover.
      toast('Use Discover → Get song to download this track.', 3000);`,
`      // The public app stays in-app; downloading is handled from Discover.
      // The build without downloads must not name a button it does not have.
      toast(SC_IS_PLAY ? 'Open Discover to look this track up.' : 'Use Discover → Get song to download this track.', 3000);`,
'new-release tap toast gated');

/* ---------- 5. AI help answers: play variants ---------- */
apply(HTML,
`a:'SideCut has a built-in **Spotify to MP3 / WAV / FLAC converter**`,
`a: SC_IS_PLAY ? 'SideCut works with the files you already own: tap **+ Add songs → + Files** (or **+ Add folder**) to bring audio in from your device, and **Import backup (everything)** to restore a .zip with playlists, albums, tags and covers.' : 'SideCut has a built-in **Spotify to MP3 / WAV / FLAC converter**`,
'AI KB: how to get songs gated');

apply(HTML,
`a:'**Expand URL** takes a Spotify short link`,
`a: SC_IS_PLAY ? '**Expand URL** takes a Spotify short link (like open.spotify.com/track/...) and expands it to the full open.spotify.com URL. It&apos;s in **Settings → Get Songs** or at the top of **Discover**.' : '**Expand URL** takes a Spotify short link`,
'AI KB: expand url gated');

apply(HTML,
`a:'Welcome! Here`,
`a: SC_IS_PLAY ? 'Welcome! The quick start: 1) Tap **+ Add songs → + Files** to bring the MP3s already on your device into the app. 2) Tap any song to play it. 3) Use the mini player at the bottom for play/pause, skip, shuffle. 4) Check **Settings → Theme** to customize the look.' : 'Welcome! Here`,
'AI KB: first time gated');

apply(HTML,
`a:'The app comes with a built-in tutorial shown on first launch, including a **Common scenarios, step by step** section (get a song off Spotify,`,
`a: SC_IS_PLAY ? 'The app comes with a built-in tutorial shown on first launch, including a **Common scenarios, step by step** section (bring your own files in, build your own album, reorder without misfiring, jump to the playing song, back up or move to a new phone, keep it updated). Replay it any time: **Settings → More → 🎓 Replay tutorial**, and the plain-text version is the **Tutorial summary** right below it. You can also ask me specific questions about any feature!' : 'The app comes with a built-in tutorial shown on first launch, including a **Common scenarios, step by step** section (get a song off Spotify,`,
'AI KB: tutorial gated');

/* ---------- 6. update history: notes AND titles ---------- */
apply(HTML,
`  function changelogItems(entry){
    var list = (entry && entry.items) || [];
    var out = [];
    for(var _ci = 0; _ci < list.length; _ci++){
      var it = list[_ci];
      if(typeof it === 'string' && it.indexOf('[FULL] ') === 0){
        var _isPlay = false;
        try{ _isPlay = !!(window.__PLAY_BUILD__ || (typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY)); }catch(_pe){}
        if(_isPlay) continue;
        it = it.slice(7);
      }
      out.push(it);
    }
    return out;
  }`,
`  // On the build that takes only the files you own, an automatic pass hides
  // notes and titles about the song downloader (converting, sources, outside
  // converter sites, Get song) — history it never had — while notes about
  // EXPORTS (Download to phone, crossfaded mixes, ZIPs, artwork, CSV) stay put.
  function scIsPlayBuild(){
    try{ return !!(window.__PLAY_BUILD__ || (typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY)); }catch(_pe){ return false; }
  }
  function scHidesOnPlay(t){
    if(typeof t !== 'string') return false;
    if(/(downloader|downloading|converter|converts|converting|conversion|convert\\b|spotify to mp3|youtube to mp3|\\bto mp3\\b|get song\\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i.test(t)) return true;
    if(/\\bdownload/i.test(t) && !/(zip|crossfad|to phone|artwork|megabytes|csv|re-?download)/i.test(t)) return true;
    return false;
  }
  function changelogItems(entry){
    var list = (entry && entry.items) || [];
    var out = [];
    var _isPlay = scIsPlayBuild();
    for(var _ci = 0; _ci < list.length; _ci++){
      var it = list[_ci];
      if(typeof it === 'string' && it.indexOf('[FULL] ') === 0){
        if(_isPlay) continue;
        it = it.slice(7);
      }
      if(_isPlay && scHidesOnPlay(it)) continue;
      out.push(it);
    }
    return out;
  }
  // Titles get the same treatment — a filtered entry must not announce itself
  // through its headline.
  function changelogTitle(entry){
    var t = (entry && entry.title) || '';
    if(scIsPlayBuild() && scHidesOnPlay(t)) return 'Fixes & improvements';
    return t;
  }`,
'changelogItems gains the history filter + changelogTitle');

/* the five title render sites */
apply(HTML,
`          <div style="font-size:13px; margin-top:4px;">\${escapeHtml(entry.title)}</div>`,
`          <div style="font-size:13px; margin-top:4px;">\${escapeHtml(changelogTitle(entry))}</div>`,
'update-log summary title');

apply(HTML,
`font-weight:600; font-size:14px; margin-bottom:6px;">v\${entry.version}\${entry.date ? ' <span style="font-weight:400; font-size:11px; color:var(--ink-dim);">· ' + entry.date + '</span>' : ''} — \${escapeHtml(entry.title)}</div>`,
`font-weight:600; font-size:14px; margin-bottom:6px;">v\${entry.version}\${entry.date ? ' <span style="font-weight:400; font-size:11px; color:var(--ink-dim);">· ' + entry.date + '</span>' : ''} — \${escapeHtml(changelogTitle(entry))}</div>`,
'update-log full title');

apply(HTML,
`$('whatsNewSummary').innerHTML = \`<div style="color:var(--ink-dim); font-size:12px; margin-bottom:8px;">\${escapeHtml(entry.title)}</div>`,
`$('whatsNewSummary').innerHTML = \`<div style="color:var(--ink-dim); font-size:12px; margin-bottom:8px;">\${escapeHtml(changelogTitle(entry))}</div>`,
"what's-new summary title");

apply(HTML,
`          <div style="font-size:13px; margin-top:4px;">\${escapeHtml(latest.title)}</div>`,
`          <div style="font-size:13px; margin-top:4px;">\${escapeHtml(changelogTitle(latest))}</div>`,
'bell latest title');

apply(HTML,
`font-weight:600; font-size:13.5px; margin-bottom:6px;">v\${entry.version}\${entry.date ? ' <span style="font-weight:400; font-size:11px; color:var(--ink-dim);">· ' + entry.date + '</span>' : ''} — \${escapeHtml(entry.title)}</div>`,
`font-weight:600; font-size:13.5px; margin-bottom:6px;">v\${entry.version}\${entry.date ? ' <span style="font-weight:400; font-size:11px; color:var(--ink-dim);">· ' + entry.date + '</span>' : ''} — \${escapeHtml(changelogTitle(entry))}</div>`,
'bell list title');

/* ---------- 7. wording that is wrong on every build ---------- */
apply(HTML,
`Download songs that carry an album tag`,
`Import songs that carry an album tag`,
'empty-album note says Import');

apply(HTML,
`Album History, download previews, export/import backups`,
`Album History, 30-second previews, export/import backups`,
'free-tier blurb says 30-second previews');

/* ---------- 8. version, changelog head, sw cache, older test pins ---------- */
apply(HTML,
`  const CHANGELOG = [
  { version: '60.5.7',`,
`  const CHANGELOG = [
  { version: '60.5.8', date: 'September 23, 2026 · 12:20 PM EDT', title: 'Import wording everywhere and an update history that fits the build', items: [
    'The empty-album note, the premium feature list and both Expand URL cards now describe importing your own files and getting a full track URL — the wording matches what the app actually does.',
    '[FULL] On the build that takes only your own files, the first-run tutorial, the Replay tutorial summary and the in-app help no longer teach outside converter sites — they describe + Add songs instead, the New releases rows lose their Get song label and tap hint, and Expand URL results stop pointing at a converter.',
    '[FULL] That same build now filters its update history: notes and titles about converting or fetching a song from a source are hidden, while exports (Download to phone, crossfaded mixes, ZIPs) stay in the list.',
    '[FULL] The how-to box on Discover and Get Songs says what that build does with your own files instead of describing downloads it never offers.',
    '[FULL] The scenario that taught going out to a converter is gone from that build\\u2019s tutorial; importing your own files is step one there.',
  ] },
  { version: '60.5.7',`,
'changelog 60.5.8 entry');

apply(HTML,
`const APP_VERSION = '60.5.7';`,
`const APP_VERSION = '60.5.8';`,
'APP_VERSION bump');

apply('sw.js',
`sidecut-shell-v60.5.7`,
`sidecut-shell-v60.5.8`,
'sw cache bump');

for(const t of ['6053','6054','6055','6056','6057']){
  apply(`dev/test-${t}.mjs`, `ver === '60.5.7'`, `ver === '60.5.8'`, `test-${t} ver pin`);
}

/* ---------- sanity ---------- */
assertContains(HTML, `function changelogTitle(entry){`, 'changelogTitle defined');
assertContains(HTML, `id="howToGetMusicHead"`, 'modal hook present');
assertContains(HTML, `id="tutSumGetMusic"`, 'summary hook present');
assertContains(HTML, `SC_IS_PLAY ? 'SideCut works with the files you already own`, 'KB play answer present');

console.log(`\n${ok} ok, ${failed} failed`);
process.exit(failed ? 1 : 0);
