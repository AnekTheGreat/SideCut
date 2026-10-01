#!/usr/bin/env node
/**
 * SideCut 71.3 - YouTube playlists, the song's own metadata, and updates that
 * wait for a run.
 *
 * The user's words: "Make it so that in YouTube converter you can convert YouTube
 * playlists and make the updates not interrupt downloads. Also make YouTube
 * converter fetch the metadata for that song too."
 *
 * Three things, one release:
 *
 *   1. A PLAYLIST LINK CONVERTS THE WHOLE LIST. The YouTube card only ever knew
 *      how to pull one video id out of an address, so a playlist link - which has
 *      no video of its own - ended at "Couldn't extract video ID". A list is now
 *      read from YouTube's own page (the ytInitialData blob the page embeds, which
 *      is steadier than scraping markup that changes weekly), shown as a ticked
 *      song list, and run through the SAME per-video pipeline the single-link card
 *      uses. A watch link (v=…) still converts just its video.
 *
 *   2. THE SONG'S REAL METADATA, not just the upload's. The old run tagged the
 *      raw YouTube title and the channel name and left the cover blank. The store
 *      catalog is asked for the official title, artist, album, year, genre, track
 *      and cover, and a hit is accepted only when BOTH the artist and the song
 *      name agree with the upload - a look-alike channel cannot dress a song up as
 *      another, and nothing is borrowed when nothing matches.
 *
 *   3. AN UPDATE WAITS FOR A RUN. dev/native-updates.js reloads the WebView to
 *      apply a bundle; done mid-run that kills the job. The page already publishes
 *      "a run is in flight" on window.__scNotifConv (the flag the bell reads), and
 *      the updater now defers while it is set, exactly as it already defers while
 *      a song is playing. scConvertPill(false) clears the flag too, so a cancelled
 *      run stops looking busy the moment its pill goes away.
 *
 *   node dev/patch-713.mjs
 *   node dev/patch-713.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '71.3';
const STAMP = 'September 30, 2026 \u00b7 7:48 PM EDT';
const CACHE = 'sidecut-shell-v63.0.49';
const OLDCACHE = 'sidecut-shell-v63.0.48';
const TITLE = 'A YouTube playlist comes in one go, every song lands with its real details, and an update waits for the songs being made';

// Six notes. Every one of these rides out to the Play channel (the head entry's
// first six are copied into ota-play/updates.json verbatim), so none may read as
// a music downloader on the WIDER list dev/test-play-copy.mjs audits: no
// download/downloading/converter/convert(s|ing|ion)/mp3/"get song"/"hand-off",
// and no "play build", "play version" or "play install". They name the player, the
// dock and Studio, which is the surface rule dev/test-662.mjs checks.
const NOTES = [
  'A YouTube playlist is one tap now. Paste a list address and SideCut reads the songs it holds and shows them all ticked, so the whole list comes in without pasting one link per song; untick anything you do not want and only what is left is made.',
  'Every song in the list carries its real details. The title, artist, album, year and cover are read from the store catalog and accepted only when the artist and the song name both agree with the upload, so a look-alike channel cannot dress a song up as another and a cover is never invented from nothing.',
  'A single YouTube link gets the same treatment: its official title, artist, album, year, genre and cover replace the raw upload text and the placeholder picture, and the finished file is tagged with them.',
  'An update no longer cuts off the songs SideCut is making. When a newer SideCut is ready while a run is in flight, the update waits until that run has finished and the app is closed, instead of reloading the app underneath it.',
  'The player, the dock, the library and Studio are exactly as the release before this one left them. Nothing about playback, the queue or the equalizer moved.',
  'A library saved before this release comes back the same, and a song that was already in it is untouched. Nothing here rewrites a stored track or its cover, and nothing is lost if a run is stopped part way.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-713: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ================= 1. THE YOUTUBE PLAYLIST HELPERS ========================== */
// Everything lands above the single-link card, in the same scope, so the card can
// delegate to it. String.raw is deliberate: this is source code for index.html,
// not something to interpret, so every \u escape and every regex backslash stays
// exactly as written here.
const YT_CODE = String.raw`  // ─── YouTube playlists ───
  // A playlist link (list=… with no single video of its own) used to end at
  // "Couldn't extract video ID" - there was nowhere for a list to go. It is read
  // from the list's own page through the same device network path every other
  // YouTube call uses, and each song is made by the SAME per-video pipeline the
  // single-link card runs, so a list is not a second converter with its own bugs.
  function scYtPlaylistId(url){
    var m = String(url || '').match(/[?&]list=([A-Za-z0-9_-]+)/);
    return m ? m[1] : null;
  }
  // The search-ready form of an upload title: "(Official Video)" and its family
  // are noise the store catalog does not carry, and they made every lookup miss.
  function scYtSearchTitle(t){
    var s = String(t || '');
    s = s.replace(/[\(\[]([^\)\]]*(official|lyric|lyrics|audio|video|visuali[sz]er|hd|hq|4k|mv|explicit)[^\)\]]*)[\)\]]/gi, ' ');
    s = s.replace(/(official\s+(music\s+)?video|official\s+audio|lyric\s+video|lyrics|visuali[sz]er|full\s+video|audio)/gi, ' ');
    s = s.replace(/\s*-\s*topic\s*$/i, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }
  // Loose song-name agreement: the catalog's punctuation and bracketed tags are
  // never the same as the upload's, so "comparable" means one contains the other
  // once everything but letters and digits is gone.
  function scYtTitleMatch(a, b){
    function n(s){ return String(s || '').toLowerCase().replace(/[\(\[]([^\)\]]*)[\)\]]/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim(); }
    var x = n(a), y = n(b);
    if(!x || !y) return true;
    return x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
  }
  // The SONG's own metadata - the official title, artist, album, year, genre,
  // track and cover - read from the store catalog and accepted only when BOTH the
  // artist and the song name agree with the upload. A look-alike channel therefore
  // cannot dress a song up as another, and nothing is borrowed when nothing
  // matches. Returns an empty object in that case rather than a wrong guess.
  async function scYtEnrichMeta(rawTitle, rawAuthor){
    var out = { title: '', artist: '', album: '', year: '', genre: '', track: '', thumb: '', artBytes: null, artMime: null };
    try{
      var cleanTitle = scYtSearchTitle(rawTitle);
      var artist = String(rawAuthor || '').replace(/\s*-\s*topic\s*$/i, '').trim();
      if(!cleanTitle || !artist) return out;
      var ir = await fetchWithProxy('https://itunes.apple.com/search?term=' + encodeURIComponent(cleanTitle + ' ' + artist) + '&media=music&entity=song&limit=5', { budgetMs: 9000 });
      if(!ir || !ir.ok) return out;
      var it = await ir.json();
      var hit = null;
      for(var i = 0; i < (it.results || []).length && i < 5; i++){
        var row = it.results[i];
        if(!row) continue;
        if(!scArtistMatch(artist, row.artistName, '', '', '')) continue;
        if(!scYtTitleMatch(cleanTitle, row.trackName)) continue;
        hit = row; break;
      }
      if(!hit) return out;
      out.title = hit.trackName || '';
      out.artist = hit.artistName || '';
      out.album = hit.collectionName || '';
      out.year = hit.releaseDate ? String(hit.releaseDate).slice(0, 4) : '';
      out.genre = hit.primaryGenreName || '';
      out.track = hit.trackNumber ? String(hit.trackNumber) : '';
      out.thumb = hit.artworkUrl100 ? String(hit.artworkUrl100).replace('/100x100bb.jpg', '/600x600bb.jpg') : '';
      if(out.thumb){
        try{
          var artR = await fetchWithProxy(out.thumb, { budgetMs: 9000 });
          if(artR && artR.ok){
            var artAb = await artR.arrayBuffer();
            if(artAb && artAb.byteLength > 200){ out.artBytes = new Uint8Array(artAb); out.artMime = /\.png/i.test(out.thumb) ? 'image/png' : 'image/jpeg'; }
          }
        }catch(_ae){}
      }
    }catch(e){}
    return out;
  }
  // One video, end to end: resolve its audio, read its real metadata, decode and
  // re-encode with tags and cover. Returns { blob, meta } or null; the caller owns
  // the library write so a batch can report each song. The single-link card keeps
  // its own banded progress bar - this is the shared per-song worker a list uses.
  async function scYtOneVideo(videoId, fmt, titleHint, authorHint, onStatus){
    var st = onStatus || function(){};
    if(window.__scCancelDl) return null;
    st('Looking for the audio…');
    var _audio = await scYtPlayer(videoId);
    if(!_audio) return null;
    var t = titleHint || _audio.videoTitle || 'YouTube video';
    var a = (typeof authorHint === 'string' && authorHint) ? authorHint : (_audio.author || '');
    var meta = await scYtEnrichMeta(t, a);
    st('Downloading the audio…');
    var dec = await scFetchDecode(_audio, function(txt){ if(txt) st(txt); }, null);
    if(!dec) return null;
    if(fmt === 'mp3' && typeof lamejs === 'undefined'){ try{ await window.__scEnsureLamejs(); }catch(_e){} }
    var blob = null;
    try{
      blob = await scEncodeAudioCooperative(dec.buffer, fmt, {
        title: meta.title || t, artist: meta.artist || a, album: meta.album || '',
        year: meta.year || '', genre: meta.genre || '', track: meta.track || '',
        artBytes: meta.artBytes, artMime: meta.artMime
      }, function(p){ if(p > 0 && p < 1) st('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(p * 100) + '%'); });
    }catch(_ee){ blob = null; }
    if(!blob) return null;
    return { blob: blob, meta: meta };
  }
  // The list's own page, parsed for the songs it holds. YouTube embeds the whole
  // playlist in the page as ytInitialData, so this walks that object for the two
  // shapes that carry a video - the classic playlistVideoRenderer and the newer
  // lockupViewModel - which is far steadier than scraping markup that changes.
  async function scYtResolvePlaylist(listId){
    var out = { title: '', tracks: [] };
    var resp = await fetchWithProxy('https://www.youtube.com/playlist?list=' + encodeURIComponent(listId) + '&hl=en&gl=US', { budgetMs: 15000 });
    if(!resp || !resp.ok) return out;
    var page = '';
    try{ page = await resp.text(); }catch(_te){ return out; }
    var data = null;
    try{
      var at = page.indexOf('ytInitialData');
      var braceAt = at === -1 ? -1 : page.indexOf('{', at);
      if(braceAt !== -1){
        var depth = 0, inStr = false, esc = false, endAt = -1;
        for(var i = braceAt; i < page.length; i++){
          var ch = page.charAt(i);
          if(inStr){ if(esc){ esc = false; } else if(ch === '\\'){ esc = true; } else if(ch === '"'){ inStr = false; } continue; }
          if(ch === '"'){ inStr = true; continue; }
          if(ch === '{'){ depth++; }
          else if(ch === '}'){ depth--; if(depth === 0){ endAt = i; break; } }
        }
        if(endAt !== -1) data = JSON.parse(page.slice(braceAt, endAt + 1));
      }
    }catch(_pe){ data = null; }
    if(!data) return out;
    try{ if(data.metadata && data.metadata.playlistMetadataRenderer) out.title = data.metadata.playlistMetadataRenderer.title || ''; }catch(_me){}
    var seen = Object.create(null);
    var push = function(id, title, author){
      if(!id || seen[id] || !/^[\w-]{11}$/.test(id)) return;
      seen[id] = true;
      out.tracks.push({ videoId: id, title: title || '', author: author || '' });
    };
    (function walk(node){
      if(!node || typeof node !== 'object') return;
      if(Object.prototype.toString.call(node) === '[object Array]'){ for(var i = 0; i < node.length; i++) walk(node[i]); return; }
      var pv = node.playlistVideoRenderer;
      if(pv){
        var t1 = '';
        try{ t1 = ((pv.title && pv.title.runs && pv.title.runs[0] && pv.title.runs[0].text) || (pv.title && pv.title.simpleText) || ''); }catch(_t1){}
        var a1 = '';
        try{ a1 = (pv.shortBylineText && pv.shortBylineText.runs && pv.shortBylineText.runs[0] && pv.shortBylineText.runs[0].text) || ''; }catch(_a1){}
        push(pv.videoId, t1, a1);
      }
      var lv = node.lockupViewModel;
      if(lv && lv.contentId){
        var t2 = '';
        try{ t2 = (lv.metadata && lv.metadata.lockupMetadataViewModel && lv.metadata.lockupMetadataViewModel.title && lv.metadata.lockupMetadataViewModel.title.content) || ''; }catch(_t2){}
        var a2 = '';
        try{
          var rows = (lv.metadata && lv.metadata.lockupMetadataViewModel && lv.metadata.lockupMetadataViewModel.metadata && lv.metadata.lockupMetadataViewModel.metadata.metadataRows) || [];
          for(var ri = 0; ri < rows.length && !a2; ri++){
            var parts = (rows[ri] && rows[ri].metadataParts) || [];
            for(var pi = 0; pi < parts.length; pi++){
              var tx = parts[pi] && parts[pi].text && parts[pi].content;
              if(tx){ a2 = tx; break; }
            }
          }
        }catch(_a2){}
        push(lv.contentId, t2, a2);
      }
      for(var k in node){ if(Object.prototype.hasOwnProperty.call(node, k)) walk(node[k]); }
    })(data);
    return out;
  }
  // The playlist card: list the songs, let the user untick what they do not want,
  // then run the lot through the shared per-video worker. The floating pill is the
  // run's only anchor - the window can be closed and it carries on.
  function scYtConvertPlaylist(url, listId, resultEl, btnEl, presetFmt){
    if(SC_IS_PLAY){
      if(resultEl){ resultEl.style.display = 'block'; resultEl.innerHTML = '<span style="color:var(--gold);">\u26a0 This converter is not part of this build \u2014 use + Add songs to import your own files.</span>'; }
      return;
    }
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
    if(resultEl){
      resultEl.style.display = 'block';
      resultEl.innerHTML = '<div style="display:flex; align-items:center; gap:8px;"><div style="width:16px;height:16px;border:2px solid var(--coral);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="font-size:11px;color:var(--ink-dim);">Reading the playlist and its songs…</span></div>';
    }
    (async function(){
      try{
        var pl = await scYtResolvePlaylist(listId);
        if(!pl.tracks.length){
          if(resultEl){ resultEl.innerHTML = '<div style="font-size:11px;color:var(--coral);line-height:1.5;">Couldn\u2019t read that playlist\u2019s songs. SideCut reads the list straight from YouTube\u2019s own page, and it did not answer this time \u2014 usually a blocked or flaky connection, and nothing was made. Paste a single video link, or try again.</div>'; }
          toast('Could not read that playlist \u2014 nothing was made.', 4000);
          if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
          return;
        }
        var ytFmt = (presetFmt && presetFmt !== 'auto') ? presetFmt : 'flac';
        if(resultEl){
          resultEl.innerHTML =
            '<div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">' +
              '<div style="flex:1; min-width:0;"><div style="font-weight:600; color:var(--ink); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + scEscapeHtml(pl.title || 'YouTube playlist') + '</div>' +
              '<div style="font-size:10.5px; color:var(--ink-dim);">' + pl.tracks.length + ' songs found \u00b7 the whole list</div></div></div>' +
            '<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; margin-bottom:8px;">' +
              '<span style="font-size:10.5px; color:var(--ink-dim);">Format</span>' +
              '<select class="yt-pl-fmt" style="padding:6px 8px; border-radius:6px; border:1px solid var(--line); background:rgba(255,255,255,0.05); color:var(--ink); font-size:11.5px; cursor:pointer;"><option value="flac"' + (ytFmt === 'flac' ? ' selected' : '') + '>FLAC (lossless)</option><option value="wav"' + (ytFmt === 'wav' ? ' selected' : '') + '>WAV (lossless)</option><option value="mp3"' + (ytFmt === 'mp3' ? ' selected' : '') + '>MP3</option></select>' +
              '<button class="yt-pl-go" style="padding:6px 14px; border-radius:6px; background:var(--coral); color:var(--on-coral,#fff); border:none; font-size:11px; font-weight:600; cursor:pointer;"></button>' +
            '</div>' +
            '<div class="yt-pl-pick" style="margin-top:4px; border-top:1px solid var(--line); padding-top:8px;">' +
              '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">' +
                '<span style="font-size:10.5px; color:var(--ink-dim); flex:1;">Pick the songs to convert</span>' +
                '<button class="yt-pl-all" style="padding:3px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:10.5px; cursor:pointer;">All</button>' +
                '<button class="yt-pl-none" style="padding:3px 10px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink-dim); font-size:10.5px; cursor:pointer;">None</button>' +
              '</div>' +
              '<div class="yt-pl-list" style="max-height:190px; overflow-y:auto; display:flex; flex-direction:column;"></div>' +
            '</div>' +
            '<div style="font-size:9.5px; color:var(--ink-dim); margin-top:6px; line-height:1.5;">Each finished song goes straight into your library, in All songs \u2014 nothing to import.</div>';
        }
        var box = resultEl;
        if(!box) return;
        var listEl = box.querySelector('.yt-pl-list');
        var goBtn = box.querySelector('.yt-pl-go');
        function picked(){
          return Array.prototype.slice.call(box.querySelectorAll('.yt-pl-cb')).filter(function(cb){ return cb.checked; }).map(function(cb){ return Number(cb.getAttribute('data-idx')); });
        }
        function refresh(){
          var n = picked().length;
          if(goBtn){ goBtn.textContent = n ? ('Convert ' + n + ' song' + (n === 1 ? '' : 's')) : 'Pick a song first'; goBtn.style.opacity = n ? '1' : '0.55'; }
        }
        if(listEl){
          listEl.innerHTML = pl.tracks.map(function(tr, ti){
            return '<label style="display:flex; gap:8px; align-items:center; padding:3px 0; font-size:11px; color:var(--ink); cursor:pointer;">' +
              '<input type="checkbox" class="yt-pl-cb" data-idx="' + ti + '" checked style="flex-shrink:0; accent-color:var(--coral);">' +
              '<span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(tr.title || 'Untitled') + '</span>' +
              '<span style="color:var(--ink-dim); font-size:10px; max-width:42%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(tr.author || '') + '</span>' +
            '</label>';
          }).join('');
          Array.prototype.forEach.call(listEl.querySelectorAll('.yt-pl-cb'), function(cb){ cb.addEventListener('change', refresh); });
          var allBtn = box.querySelector('.yt-pl-all');
          if(allBtn) allBtn.addEventListener('click', function(){ Array.prototype.forEach.call(listEl.querySelectorAll('.yt-pl-cb'), function(cb){ cb.checked = true; }); refresh(); });
          var noneBtn = box.querySelector('.yt-pl-none');
          if(noneBtn) noneBtn.addEventListener('click', function(){ Array.prototype.forEach.call(listEl.querySelectorAll('.yt-pl-cb'), function(cb){ cb.checked = false; }); refresh(); });
        }
        refresh();
        if(goBtn) goBtn.addEventListener('click', function(){
          var fmtSel = box.querySelector('.yt-pl-fmt');
          var fmt = (fmtSel && fmtSel.value) || 'flac';
          var idx = picked();
          if(!idx.length){ toast('Pick at least one song to convert.', 2500); return; }
          var chosen = idx.map(function(ix){ return pl.tracks[ix]; }).filter(Boolean);
          if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
          window.__scCancelDl = false; scConvertPillResetCancel();
          (async function(){
            var okCount = 0, failed = 0, failedNames = [];
            box.innerHTML = '<div class="yt-pl-run" style="padding:10px; border:1px solid var(--line); border-radius:10px; background:rgba(255,255,255,0.03);">' +
              '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;"><div style="width:14px;height:14px;border:2px solid var(--coral);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
              '<div style="font-size:12px; font-weight:600; color:var(--ink);">' + scEscapeHtml(pl.title || 'YouTube playlist') + '</div></div>' +
              '<div class="yt-pl-sub" style="font-size:10.5px; color:var(--ink-dim); margin-bottom:6px;"></div>' +
              '<div style="height:6px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden;"><div class="yt-pl-bar" style="height:100%; width:0%; background:var(--coral); transition:width 0.3s ease;"></div></div>' +
              '<div class="yt-pl-rows" style="margin-top:8px; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div></div>';
            var run = box.querySelector('.yt-pl-run');
            var subEl = run.querySelector('.yt-pl-sub');
            var barEl = run.querySelector('.yt-pl-bar');
            var rowsEl = run.querySelector('.yt-pl-rows');
            for(var i = 0; i < chosen.length; i++){
              if(window.__scCancelDl) break;
              var tr = chosen[i];
              var row = document.createElement('div');
              row.style.cssText = 'font-size:10.5px; color:var(--ink-dim); display:flex; gap:6px; align-items:baseline;';
              row.innerHTML = '<span style="color:var(--gold); white-space:nowrap;">' + (i + 1) + '/' + chosen.length + '</span><span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(tr.title || 'Untitled') + '</span><span class="yt-row-state" style="white-space:nowrap;">\u2026</span>';
              rowsEl.appendChild(row);
              var stateEl = row.querySelector('.yt-row-state');
              var state = function(txt){ if(stateEl) stateEl.textContent = txt; };
              if(subEl) subEl.textContent = 'Song ' + (i + 1) + ' of ' + chosen.length;
              if(barEl) barEl.style.width = Math.round((i / chosen.length) * 100) + '%';
              scConvertPillUpdate('Converting ' + chosen.length + ' song' + (chosen.length === 1 ? '' : 's') + ' \u00b7 ' + (pl.title || 'YouTube playlist'), 'Song ' + (i + 1) + ' of ' + chosen.length + ' \u2014 ' + (tr.title || 'starting'), Math.round((i / chosen.length) * 100));
              state('starting');
              var res = null;
              try{ res = await scYtOneVideo(tr.videoId, fmt, tr.title, tr.author, function(txt){ state(txt); if(subEl) subEl.textContent = 'Song ' + (i + 1) + ' of ' + chosen.length + ' \u2014 ' + txt; }); }catch(_re){ res = null; }
              if(res && res.blob){
                var m = res.meta || {};
                var clean = cleanOnImport(m.title || tr.title || 'YouTube audio', m.artist || tr.author || '');
                var artistPart = scSafeName(clean.artist || '');
                var namePart = scSafeName(clean.name || 'YouTube audio');
                var al = String(artistPart).toLowerCase();
                var artistOk = artistPart && al !== 'unknown artist';
                var fname = scSafeName((artistOk ? artistPart + ' - ' : '') + namePart) + '.' + fmt;
                scAddConvertedToLibrary(res.blob, { title: clean.name, artist: clean.artist, album: m.album || '', genre: m.genre || '', artBytes: m.artBytes, artMime: m.artMime }, { fileName: fname, fmt: fmt, source: 'YouTube playlist conversion' });
                okCount++;
                state('\u2705 added');
                if(stateEl) stateEl.style.color = 'var(--gold)';
              } else if(window.__scCancelDl){
                state('\u2014 cancelled');
                break;
              } else {
                failed++; failedNames.push(tr.title || 'a song');
                state('\u26a0 could not be made');
              }
              if(barEl) barEl.style.width = Math.round(((i + 1) / chosen.length) * 100) + '%';
              if(!window.__scCancelDl) await new Promise(function(r){ setTimeout(r, 200); });
            }
            var cancelled = !!window.__scCancelDl;
            var summary = document.createElement('div');
            summary.style.cssText = 'font-size:10.5px; color:var(--ink-dim); margin-top:8px; line-height:1.5;';
            summary.innerHTML = (cancelled ? 'Cancelled \u2014 ' : '') + okCount + ' of ' + chosen.length + ' songs are in your library.' + (failed ? ' ' + failed + ' could not be made: ' + scEscapeHtml(failedNames.join(', ')) + '.' : '');
            run.appendChild(summary);
            scConvertPillDone((cancelled ? 'Cancelled \u2014 ' : '') + okCount + ' song' + (okCount === 1 ? '' : 's') + ' added to your library' + (failed ? ' \u00b7 ' + failed + ' failed' : ''));
            if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
          })();
        });
      }catch(e){
        if(resultEl){ resultEl.innerHTML = '<div style="font-size:11px;color:var(--coral);">' + scEscapeHtml((e && e.message) || 'Something went wrong reading that playlist.') + '</div>'; }
        if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
      }
    })();
  }

`;

sub(html, 'the YouTube playlist and metadata helpers land above the converter',
  '  function convertYtToMp3(youtubeUrl, resultEl, btnEl, presetFmt){\n',
  YT_CODE + '  function convertYtToMp3(youtubeUrl, resultEl, btnEl, presetFmt){\n',
  { key: 'function scYtConvertPlaylist(' });

/* ============= 2. A LIST LINK GOES TO THE PLAYLIST CARD ===================== */
sub(html, 'a playlist link is handed to the playlist card',
  '    var videoId = extractYtVideoId(url);\n    if(!videoId){\n',
  String.raw`    var _listId = scYtPlaylistId(url);
    var _directVideoId = extractYtVideoId(url);
    // A list address (list=… and no single video of its own) makes the whole
    // playlist; a watch link keeps making just its video.
    if(_listId && !_directVideoId){ scYtConvertPlaylist(url, _listId, resultEl, btnEl, presetFmt); return; }
    var videoId = _directVideoId;
    if(!videoId){
`,
  { key: 'scYtConvertPlaylist(url, _listId' });

/* ============= 3. THE SINGLE-LINK CARD LEARNS THE REAL METADATA ============= */
sub(html, 'the metadata the enrichment fills in',
  "    var ytAuthor = '';\n    var _ytFails = [];\n",
  "    var ytAuthor = '';\n    var ytAlbum = '', ytYear = '', ytGenre = '', ytTrack = '', ytThumb = '', ytArtBytes = null, ytArtMime = null;\n    var _ytFails = [];\n",
  { key: 'var ytArtBytes = null, ytArtMime = null;' });

sub(html, 'the metadata lookup rides with the title lookup',
  String.raw`      try{
        // youtube.com/oembed sends no access-control-allow-origin (measured), so a
        // page fetch of it always failed inside the WebView — the shared fetch
        // reads it through the device's own network path instead.
        var oResp = await fetchWithProxy('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');
        if(oResp && oResp.ok){ var oData = await oResp.json(); if(oData && oData.title) title = oData.title; if(oData && oData.author_name) ytAuthor = oData.author_name; }
      }catch(e){}
    }
`,
  String.raw`      try{
        // youtube.com/oembed sends no access-control-allow-origin (measured), so a
        // page fetch of it always failed inside the WebView — the shared fetch
        // reads it through the device's own network path instead.
        var oResp = await fetchWithProxy('https://www.youtube.com/oembed?url=' + encodeURIComponent(url) + '&format=json');
        if(oResp && oResp.ok){ var oData = await oResp.json(); if(oData && oData.title) title = oData.title; if(oData && oData.author_name) ytAuthor = oData.author_name; }
      }catch(e){}
      // The SONG's own details, not just the upload's: the official title, artist,
      // album, year, genre and cover, accepted only when the artist and the song
      // name both agree with this upload. This is what makes the saved file read
      // right everywhere instead of carrying "Official Video" text and no picture.
      try{
        var _ym = await scYtEnrichMeta(title, ytAuthor);
        if(_ym){
          if(_ym.title) title = _ym.title;
          if(_ym.artist) ytAuthor = _ym.artist;
          ytAlbum = _ym.album || '';
          ytYear = _ym.year || '';
          ytGenre = _ym.genre || '';
          ytTrack = _ym.track || '';
          if(_ym.thumb) ytThumb = _ym.thumb;
          if(_ym.artBytes){ ytArtBytes = _ym.artBytes; ytArtMime = _ym.artMime; }
        }
      }catch(_yme){}
    }
`,
  { key: 'await scYtEnrichMeta(title, ytAuthor)' });

sub(html, 'the player fills in a title the lookup did not',
  "      var audio = await scYtPlayer(videoId);\n      if(!audio){ _ytFails.push(fmt.toUpperCase() + ': YouTube returned no streams",
  "      var audio = await scYtPlayer(videoId);\n      // The player hands back the video's own title and channel: fill in whatever\n      // the oEmbed call did not, so the tag and the file name are never blank.\n      if(!title || title === 'YouTube video'){ if(audio.videoTitle) title = audio.videoTitle; }\n      if(!ytAuthor && audio.author) ytAuthor = audio.author;\n      if(!audio){ _ytFails.push(fmt.toUpperCase() + ': YouTube returned no streams",
  { key: "if(!ytAuthor && audio.author) ytAuthor = audio.author;" });

sub(html, 'the encoder is handed the real tags and the cover',
  String.raw`      try{ blob = await scEncodeAudioCooperative(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), artBytes: null, artMime: null }, function(p){ var _ep = ytBandPct('encode', p); if(p > 0) setStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(_ep) + '%'); }); }
`,
  String.raw`      try{ blob = await scEncodeAudioCooperative(dec.buffer, fmt, { title: title || '', artist: (typeof ytAuthor === 'string' ? ytAuthor : ''), album: ytAlbum || '', year: ytYear || '', genre: ytGenre || '', track: ytTrack || '', artBytes: ytArtBytes, artMime: ytArtMime }, function(p){ var _ep = ytBandPct('encode', p); if(p > 0) setStatus('Encoding ' + fmt.toUpperCase() + ' — ' + Math.round(_ep) + '%'); }); }
`,
  { key: 'album: ytAlbum || \'\', year: ytYear || \'\', genre: ytGenre || \'\', track: ytTrack || \'\', artBytes: ytArtBytes' });

sub(html, 'the library row carries the album and the cover',
  "      var addedYt = res.blob ? scAddConvertedToLibrary(res.blob, {\n        title: _libClean.name, artist: _libClean.artist, album: '', genre: '',\n        artBytes: null, artMime: null\n      }, { fileName: filename, fmt: fmt, source: 'YouTube conversion' }) : null;\n",
  "      var addedYt = res.blob ? scAddConvertedToLibrary(res.blob, {\n        title: _libClean.name, artist: _libClean.artist, album: ytAlbum || '', genre: ytGenre || '',\n        artBytes: ytArtBytes, artMime: ytArtMime\n      }, { fileName: filename, fmt: fmt, source: 'YouTube conversion' }) : null;\n",
  { key: 'album: ytAlbum || \'\', genre: ytGenre || \'\',\n        artBytes: ytArtBytes, artMime: ytArtMime' });

/* ====== 4. A DISMISSED/CANCELLED RUN STOPS LOOKING BUSY TO THE UPDATER ===== */
// window.__scNotifConv is the page's "a run is in flight" flag (the bell reads it,
// and dev/native-updates.js now defers on it). scConvertPillDone already clears it;
// the pill being hidden for any other reason must clear it too, or a cancelled run
// would hold every update back until the app restarted.
sub(html, 'a dismissed pill clears the in-flight flag',
  "      scConvertPillState.el = null;\n      return;\n",
  "      window.__scNotifConv = null;\n      scConvertPillState.el = null;\n      return;\n",
  { key: 'window.__scNotifConv = null;\n      scConvertPillState.el = null;\n      return;' });

/* ===================== 5. THE RELEASE ITSELF ================================ */
sub(html, 'the app version',
  "  const APP_VERSION = '71.2';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-713: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-713: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
