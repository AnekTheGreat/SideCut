#!/usr/bin/env node
// v60.5.9: a pinned-artist release gets its own page — cover, artist photo,
// live countdown to the drop, share, pre-save and a tracklist preview — and
// every place that listed a release (New releases list, Home bubble, the bell's
// "Dropping soon" entry, Fetch latest popup) opens it instead of a toast.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function mustCount(hay, needle, want, label) {
  const got = hay.split(needle).length - 1;
  if (got !== want) throw new Error(`${label}: expected ${want} of "${needle}", found ${got}`);
}
function replaceOnce(oldStr, newStr, label) {
  mustCount(src, oldStr, 1, label);
  src = src.replace(oldStr, newStr);
  n++;
  console.log('• ' + label);
}
// Replace [startAnchor .. endAnchor] (endAnchor inclusive). The start anchor is
// asserted unique so a patch can never fire against the wrong block.
function replaceRange(startAnchor, endAnchor, newStr, label) {
  const s = src.indexOf(startAnchor);
  if (s === -1) throw new Error(label + ': start anchor missing: ' + startAnchor);
  mustCount(src, startAnchor, 1, label + ' (start)');
  const e = src.indexOf(endAnchor, s);
  if (e === -1) throw new Error(label + ': end anchor not found after start: ' + endAnchor);
  src = src.slice(0, s) + newStr + src.slice(e + endAnchor.length);
  n++;
  console.log('• ' + label);
}
// Replace the whole single line whose text contains `marker`.
function replaceLineContaining(marker, newLine, label) {
  const hits = src.split('\n').filter(l => l.includes(marker));
  if (hits.length !== 1) throw new Error(`${label}: expected 1 line containing "${marker}", found ${hits.length}`);
  const oldLine = hits[0];
  mustCount(src, oldLine, 1, label);
  src = src.replace(oldLine, newLine);
  n++;
  console.log('• ' + label);
}

// ---------------------------------------------------------------- release page
const RELEASE_PAGE = `  // ---------------- Release page for pinned-artist releases --------------
  // A release — especially one still on the way — opens on its own page: cover,
  // a live countdown to the drop, the artist's photo, share, a pre-save toggle
  // and the tracklist once iTunes can name it. It only reads the snapshot the
  // release check already saved, so both builds get it.
  var _relPageTimer = null;
  function findPinnedRelease(artist, title){
    var arr = pinnedReleases[artist] || [];
    for(var i = 0; i < arr.length; i++){ if(arr[i].title === title) return arr[i]; }
    return null;
  }
  function closeReleasePage(){
    if(_relPageTimer){ clearInterval(_relPageTimer); _relPageTimer = null; }
    var old = document.getElementById('scReleasePage');
    if(old && old.parentNode) old.parentNode.removeChild(old);
  }
  function openReleasePage(artist, title){
    var rel = findPinnedRelease(artist, title);
    if(!rel){ try{ toast('That release is no longer listed.', 2500); }catch(_e0){ } return; }
    closeReleasePage();
    // Opening it is seeing it — clear the NEW badge on this row while we're here.
    try{
      if(!rel.seen){
        rel.seen = true; savePinnedArtists();
        if(typeof renderNewReleases === 'function') renderNewReleases();
        if(typeof renderHome === 'function') renderHome();
        if(typeof updateNotifBadge === 'function') updateNotifBadge();
      }
    }catch(_eSeen){ }
    var dMs = rel.date ? new Date(rel.date + 'T00:00:00Z').getTime() : NaN;
    var upcoming = !isNaN(dMs) && dMs > Date.now();
    var pa = null;
    try{ (typeof pinnedArtists !== 'undefined' ? pinnedArtists : []).forEach(function(a){ if(a && a.name === artist) pa = a; }); }catch(_ePa){ }
    var photo = pa ? (pa.photo || pa.art || '') : '';
    var bgArt = rel.art ? 'background-image:url(' + rel.art + ');' : '';
    var dateStr = !isNaN(dMs) ? new Date(dMs).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    var typeLabel = rel.kind === 'album' ? 'Album' : 'Single';
    var ov = document.createElement('div');
    ov.id = 'scReleasePage';
    ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:12000;overflow-y:auto;-webkit-overflow-scrolling:touch;background:var(--bg);';
    ov.innerHTML = [
      '<div style="max-width:620px;margin:0 auto;padding:14px 20px calc(44px + env(safe-area-inset-bottom));">',
        '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;">',
          '<button id="scRelBack" aria-label="Back" style="background:none;border:none;color:var(--ink);cursor:pointer;padding:6px;margin-left:-6px;"><svg viewBox="0 0 24 24" style="width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><path d="M19 12H5M12 19l-7-7 7-7"/></svg></button>',
          '<button id="scRelShare" aria-label="Share" style="background:none;border:none;color:var(--ink);cursor:pointer;padding:6px;margin-right:-6px;"><svg viewBox="0 0 24 24" style="width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg></button>',
        '</div>',
        '<div style="width:min(74vw,330px);aspect-ratio:1/1;margin:0 auto 22px;border-radius:8px;box-shadow:0 18px 44px rgba(0,0,0,0.5);background-size:cover;background-position:center;background-color:var(--bg-raised);' + bgArt + '"></div>',
        upcoming ? '<div style="display:flex;align-items:center;gap:14px;background:rgba(255,255,255,0.05);border:1px solid var(--line);border-radius:14px;padding:12px 14px;margin-bottom:24px;">' +
          '<div style="width:52px;height:52px;border-radius:8px;background-size:cover;background-position:center;flex-shrink:0;background-color:var(--bg-raised);' + bgArt + '"></div>' +
          '<div style="display:flex;flex:1;align-items:center;text-align:center;">' +
            ['Days','Hours','Minutes','Seconds'].map(function(u, i){
              return (i ? '<div style="width:1px;height:36px;background:var(--line);"></div>' : '') +
                '<div style="flex:1;"><div class="sc-rel-cd" data-u="' + u.toLowerCase() + '" style="font-size:23px;font-weight:800;line-height:1.15;">–</div>' +
                '<div style="font-size:10.5px;color:var(--ink-dim);">' + u + '</div></div>';
            }).join('') +
          '</div>' +
        '</div>' : '',
        '<div style="font-size:clamp(26px,7vw,38px);font-weight:800;letter-spacing:-0.5px;line-height:1.1;margin-bottom:14px;">' + escapeHtml(rel.title || '') + '</div>',
        '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">',
          '<div style="width:34px;height:34px;border-radius:50%;background-size:cover;background-position:center;background-color:var(--bg-raised);flex-shrink:0;' + (photo ? 'background-image:url(' + photo + ');' : '') + '"></div>',
          '<div style="font-size:16px;font-weight:700;">' + escapeHtml(artist || '') + '</div>',
        '</div>',
        '<div id="scRelMeta" style="font-size:13.5px;color:var(--ink-dim);margin-bottom:22px;">' + escapeHtml(typeLabel) + (dateStr ? ' \\u00b7 ' + (upcoming ? 'Releases on ' : 'Released ') + dateStr : '') + '</div>',
        '<div style="display:flex;align-items:center;gap:12px;margin-bottom:28px;">',
          rel.previewUrl ? '<button id="scRelPlay" title="Play 30s preview" style="background:none;border:1px solid var(--line);color:var(--ink);border-radius:50%;width:44px;height:44px;cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;"><svg viewBox="0 0 24 24" style="width:18px;height:18px;fill:currentColor;"><path d="M8 5v14l11-7z"/></svg></button>' : '',
          '<div style="flex:1;"></div>',
          upcoming ? '<button id="scRelPresave" style="background:#1ed760;color:#0b0b0b;border:none;border-radius:999px;padding:13px 26px;font-size:15px;font-weight:700;cursor:pointer;">Pre-save +</button>' : '',
        '</div>',
        '<div style="font-size:20px;font-weight:800;margin-bottom:10px;">Tracklist preview</div>',
        '<div id="scRelTracks" style="font-size:13.5px;color:var(--ink-dim);">Looking it up\\u2026</div>',
        '<div style="display:flex;gap:10px;margin-top:26px;">',
          '<button id="scRelDisc" style="flex:1;padding:13px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink);font-size:14px;font-weight:600;cursor:pointer;">Search in Discover</button>',
          rel.url ? '<a href="' + escapeHtml(rel.url) + '" target="_blank" rel="noopener" style="flex:1;padding:13px;border-radius:10px;border:1px solid var(--line);background:transparent;color:var(--coral);font-size:14px;font-weight:600;text-align:center;text-decoration:none;box-sizing:border-box;">Open release</a>' : '',
        '</div>',
      '</div>'
    ].join('');
    document.body.appendChild(ov);

    ov.querySelector('#scRelBack').addEventListener('click', closeReleasePage);
    ov.querySelector('#scRelShare').addEventListener('click', function(){
      var text = (rel.title || '') + ' \\u2014 ' + (artist || '') + (dateStr ? (upcoming ? ' (drops ' : ' (released ') + dateStr + ')' : '');
      var url = rel.url || '';
      try{
        if(navigator.share){ navigator.share({ title: rel.title || '', text: text, url: url || undefined }).catch(function(){}); }
        else if(navigator.clipboard){ navigator.clipboard.writeText(text + (url ? ' ' + url : '')).then(function(){ toast('Copied to clipboard.', 2000); }, function(){}); }
        else toast(text, 3000);
      }catch(_eSh){ }
    });
    var playBtn = ov.querySelector('#scRelPlay');
    if(playBtn) playBtn.addEventListener('click', function(){
      try{ toggleDiscoverPreview(rel.previewUrl, playBtn, { trackName: rel.title || '', artistName: artist || '', art: rel.art || '' }); }catch(_ePv){ }
    });
    var ps = ov.querySelector('#scRelPresave');
    if(ps) ps.addEventListener('click', function(){
      rel.presave = !rel.presave;
      try{ savePinnedArtists(); }catch(_eSv){ }
      if(rel.presave){
        ps.textContent = 'Pre-saved \\u2713';
        ps.style.background = 'transparent'; ps.style.color = '#1ed760'; ps.style.border = '1px solid #1ed760';
        toast('Pre-saved \\u2014 it is flagged the moment it drops.', 3000);
      } else {
        ps.textContent = 'Pre-save +';
        ps.style.background = '#1ed760'; ps.style.color = '#0b0b0b'; ps.style.border = 'none';
        toast('Pre-save removed.', 2200);
      }
    });
    var discBtn = ov.querySelector('#scRelDisc');
    if(discBtn) discBtn.addEventListener('click', function(){
      var q = ((rel.title || '') + ' ' + (artist || '')).trim();
      closeReleasePage();
      navigate('discover');
      try{ $('discoverSearch').value = q; runDiscoverSearch(q); }catch(_eDs){ }
    });

    // Live countdown: one shared interval, dropped the moment the page closes.
    function tickReleaseCountdown(){
      var left = dMs - Date.now();
      if(left <= 0){
        // The drop happened while the page was open — redraw it as out now.
        if(_relPageTimer){ clearInterval(_relPageTimer); _relPageTimer = null; }
        openReleasePage(artist, rel.title);
        return;
      }
      var total = Math.floor(left / 1000);
      var d = Math.floor(total / 86400); total -= d * 86400;
      var h = Math.floor(total / 3600); total -= h * 3600;
      var m = Math.floor(total / 60); var s = total - m * 60;
      var vals = { days: d, hours: h, minutes: m, seconds: s };
      ov.querySelectorAll('.sc-rel-cd').forEach(function(el){
        var v = vals[el.dataset.u] || 0;
        el.textContent = (el.dataset.u === 'days') ? String(v) : (v < 10 ? '0' : '') + v;
      });
    }
    if(upcoming){
      tickReleaseCountdown();
      _relPageTimer = setInterval(tickReleaseCountdown, 1000);
    }

    // Tracklist preview: ask iTunes for the collection this release belongs to.
    var tlBox = ov.querySelector('#scRelTracks');
    var tlFallback = upcoming
      ? 'The full tracklist shows up here as soon as it is listed.'
      : 'Tracklist not listed for this one yet \\u2014 the preview above plays what is available.';
    var cid = rel.cid || null;
    if(!cid && rel.url){ var mId = String(rel.url).match(/id(\\d+)/); if(mId) cid = mId[1]; }
    if(cid && typeof fetchWithProxy === 'function'){
      fetchWithProxy('https://itunes.apple.com/lookup?id=' + encodeURIComponent(cid) + '&entity=song&limit=50')
        .then(function(rsp){ return (rsp && rsp.ok) ? rsp.json() : {}; })
        .then(function(data){
          var res = (data && data.results) || [];
          var coll = null;
          var tracks = [];
          res.forEach(function(x){
            if(!x) return;
            if(x.wrapperType === 'collection') coll = x;
            else if(x.wrapperType === 'track') tracks.push(x);
          });
          if(coll && coll.collectionType){
            var metaEl = ov.querySelector('#scRelMeta');
            if(metaEl) metaEl.innerHTML = escapeHtml(coll.collectionType) + (dateStr ? ' \\u00b7 ' + (upcoming ? 'Releases on ' : 'Released ') + dateStr : '');
          }
          if(!tracks.length){ tlBox.innerHTML = tlFallback; return; }
          tlBox.innerHTML = tracks.map(function(t, i){
            return '<div class="dp-track" data-search="' + escapeHtml('"' + String(t.trackName || '').replace(/"/g, '') + '" ' + (t.artistName || artist)) + '" data-preview="' + escapeHtml(t.previewUrl || '') + '" style="display:flex;gap:12px;align-items:center;padding:9px 4px;border-bottom:1px solid var(--line);cursor:pointer;">' +
              '<span style="width:18px;color:var(--ink-dim);text-align:right;font-size:12px;">' + (i + 1) + '</span>' +
              '<span style="flex:1;min-width:0;font-size:13px;color:var(--ink);">' + escapeHtml(t.trackName || '') + '</span>' +
              (t.previewUrl ? '<span class="sc-rel-tlplay" style="color:var(--coral);font-size:11px;flex-shrink:0;">\\u25b6 30s</span>' : '') +
            '</div>';
          }).join('');
          tlBox.querySelectorAll('.dp-track').forEach(function(row){
            row.addEventListener('click', function(){
              var pv = row.dataset.preview;
              if(!pv){
                var q = row.dataset.search || '';
                closeReleasePage();
                navigate('discover');
                try{ $('discoverSearch').value = q; runDiscoverSearch(q); }catch(_eTr){ }
                return;
              }
              try{ toggleDiscoverPreview(pv, row, { trackName: String(row.textContent || '').trim(), artistName: artist, art: rel.art || '' }); }catch(_ePv2){ }
            });
          });
        })
        .catch(function(){ tlBox.innerHTML = tlFallback; });
    } else {
      tlBox.innerHTML = tlFallback;
    }
  }
  document.addEventListener('keydown', function(e){
    if(e.key === 'Escape' || e.keyCode === 27){
      if(document.getElementById('scReleasePage')) closeReleasePage();
    }
  });

`;

replaceOnce(
  '  function renderNewReleases(){',
  RELEASE_PAGE + '  function renderNewReleases(){',
  'release page added'
);

// New releases list: a tap opens the page instead of a toast.
replaceRange(
  "list.querySelectorAll('.new-release-row').forEach(row => row.addEventListener('click'",
  '}));',
  `    // A tap opens the release page (cover, countdown, tracklist) — for a drop
    // that is still on the way as well as one that already landed.
    list.querySelectorAll('.new-release-row').forEach(row => row.addEventListener('click', (e) => {
      if(row._suppressClick){ row._suppressClick = false; e.stopPropagation(); e.preventDefault(); return; }
      if(e.target.closest('.nr-play')) return;
      openReleasePage(row.dataset.artist || '', row.dataset.title || '');
    }));`,
  'New releases rows open the release page'
);

// Home bubble rows: same destination.
replaceRange(
  "const q = (row.dataset.releaseTitle||'') + ' ' + (row.dataset.releaseArtist||'');",
  'runDiscoverSearch(q);',
  `        // Same destination as the New releases list: the release page.
        openReleasePage(row.dataset.releaseArtist || '', row.dataset.releaseTitle || '');
        `,
  'Home bubble rows open the release page'
);

// Bell's "Dropping soon" entry: straight to the next drop's page.
replaceRange(
  "if(upEntry) upEntry.addEventListener('click', () => {",
  "openHomeBubble('newreleases');",
  `if(upEntry) upEntry.addEventListener('click', () => {
      $('notifBackdrop').style.display = 'none';
      // Straight to the next drop's own page — cover, countdown, tracklist.
      const _next = _upcoming[0];
      navigate('home');
      if(_next && typeof openReleasePage === 'function') openReleasePage(_next.artist, _next.title);
      else openHomeBubble('newreleases');
    `,
  'bell Dropping soon opens the release page'
);

// Fetch latest popup rows carry artist/title/date (not just albums), so an
// upcoming row can be routed to the release page by the shared wiring below.
replaceLineContaining(
  "r.kind === 'album' ? ' data-kind=\"album\" data-cid=",
  `          html += '<div class="dp-track" data-search="' + escapeHtml((r.title||'') + ' ' + (r.artistName||'')) + '" data-link="' + escapeHtml(r.url||'') + '" data-artist="' + escapeHtml(r.artistName||'') + '" data-title="' + escapeHtml(r.title||'') + '" data-date="' + escapeHtml((r.date||'').slice(0,10)) + '"' + (r.kind === 'album' ? ' data-kind="album" data-cid="' + escapeHtml(String(r.cid||'')) + '" data-art="' + escapeHtml(r.art||'') + '"' : '') + '>';`,
  'Fetch latest rows carry release identity'
);

// Shared release-row wiring: a drop that is still on the way opens the release
// page; albums and singles keep what they did before.
replaceLineContaining(
  "if(this.dataset && this.dataset.kind === 'album')",
  `            // A drop that is still on the way opens its own release page
            // (countdown, pre-save, tracklist) instead of a search.
            var _dd = this.dataset || {};
            if(_dd.date && _dd.artist && _dd.title && _dd.date > new Date().toISOString().slice(0, 10)){
              closeDiscoverPopup();
              if(typeof openReleasePage === 'function'){ openReleasePage(_dd.artist, _dd.title); return; }
            }
            if(this.dataset && this.dataset.kind === 'album'){ if(typeof window.__openReleaseAlbum === 'function') window.__openReleaseAlbum(this); return; }`,
  'release rows route future drops to the page'
);

// ------------------------------------------------------------- version + notes
replaceOnce("const APP_VERSION = '60.5.8';", "const APP_VERSION = '60.5.9';", 'APP_VERSION 60.5.8 → 60.5.9');

const now = new Date();
const entryDate = now.toLocaleString('en-US', { timeZone: 'America/New_York', year: 'numeric', month: 'long', day: 'numeric' }) +
  ' · ' + now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
const ENTRY = `  { version: '60.5.9', date: '${entryDate}', title: 'Pinned-artist drops open on their own countdown page', items: [
    'A release from your pinned artists now opens its own page instead of a toast: the cover up top, your artist photo, the release type and date \\u2014 and for something still on the way, a countdown ticking down days, hours, minutes and seconds to the drop.',
    'That page has Share (your phone\\u2019s share sheet, falling back to copying the link), a Pre-save button remembered per release, Search in Discover, Open release, and a tracklist preview once iTunes can name it \\u2014 with a \\u25b6 30s play on every track that has a preview.',
    'Every list opens it: a row in New releases, a row in the Home bubble, the bell\\u2019s "Dropping soon" entry (straight to the next drop), and an upcoming row in the Fetch latest popup. Released music opens the same page marked out now, and the countdown flips it over the moment the drop happens.',
  ] },
`;
replaceOnce('  const CHANGELOG = [\n', '  const CHANGELOG = [\n' + ENTRY, 'changelog entry added');

fs.writeFileSync(FILE, src);

// The service worker cache name follows the release version.
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
if (sw.includes('sidecut-shell-v60.5.8')) {
  sw = sw.replace('sidecut-shell-v60.5.8', 'sidecut-shell-v60.5.9');
  fs.writeFileSync(SW, sw);
  n++;
  console.log('• sw.js cache → v60.5.9');
} else {
  mustCount(sw, 'sidecut-shell-v60.5.9', 1, 'sw.js already bumped');
}

// ------------------------------------------------------------------ verification
// Parse every inline script so a syntax slip never ships in an OTA bundle.
try {
  const { parse } = await import('acorn');
  const re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  let m, idx = 0, bad = 0;
  while ((m = re.exec(src))) {
    idx++;
    if (/\bsrc\s*=/.test(m[1] || '')) continue;
    const code = m[2];
    if (!code.trim()) continue;
    let ok = false;
    for (const sourceType of ['script', 'module']) {
      try { parse(code, { ecmaVersion: 'latest', sourceType }); ok = true; break; }
      catch (err) { if (sourceType === 'module') console.error('  ✗ inline script #' + idx + ': ' + err.message); }
    }
    if (!ok) bad++;
  }
  if (bad) { console.error('patch-6059: ' + bad + ' script block(s) have syntax errors'); process.exit(1); }
  console.log('• all inline scripts parse (' + idx + ' blocks checked)');
} catch (err) {
  console.log('• acorn unavailable, skipping script parse (' + err.message + ')');
}

console.log(`patch-6059: ${n} change(s) applied`);
