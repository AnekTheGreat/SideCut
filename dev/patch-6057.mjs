// v60.5.7 — one counted, atomic patch:
//   1. "Remove from an album" removes the song from ONE album (the card the ⋮
//      opened from, else the first album that actually holds it) instead of
//      stripping it from every album. New pure helper scRemoveFromAlbum() so
//      the test can drive the real behaviour.
//   2. Automatic pinned-artist checks when Discover is unlocked: once ~75s after
//      boot and on every return to the app, throttled to one run per 6 hours
//      (sidecut_pinnedAutoAt). Upcoming (future-dated) releases are surfaced:
//      scUpcomingReleases()/scUpcomingUnseen(), a "Dropping soon" bell entry +
//      summary line + badge condition, marked seen when the bell opens, and all
//      three live release lists say "drops Oct 3 · in 10d" instead of calling a
//      future date today.
//   3. Reorder flicker: renderHome() stamps --hb-phase (negative delay pinned to
//      the wall clock, 6s glow cycle) so rebuilt bubbles resume mid-pulse; the
//      drag placeholder copies the dragged bubble's size classes + gridColumn so
//      a wide/tall bubble no longer collapses neighbours into jumping columns.
//   4. Version 60.5.7 / package 5.0.53, sw cache follows, older test pins move;
//      the two [FULL] count pins become across-entries (this entry is all-shared).
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
function assertNotContains(file, needle, label){
  if(!read(file).includes(needle)) { ok++; } else { fail(label, 'still present: ' + needle.slice(0, 80)); }
}

/* ---------- 1+2a. song actions: signature + ONE-album helper ---------- */
apply(HTML,
`  function openSongActions(id){`,
`  // Remove a song from ONE album: the album whose card the ⋮ was opened from
  // when we know it, otherwise the first album that actually holds the song.
  // Other albums keep the song — the old handler stripped it from every album
  // at once (its toast literally said "Removed from all albums").
  // Returns the album name it removed from ('' = no album held it).
  function scRemoveFromAlbum(trackId, albumName){
    if(typeof userAlbums === 'undefined' || !userAlbums) return '';
    const holders = Object.keys(userAlbums).filter(function(n){
      const e = userAlbums[n];
      return e && Array.isArray(e.trackIds) && e.trackIds.indexOf(trackId) !== -1;
    });
    const target = (albumName && holders.indexOf(albumName) !== -1) ? albumName : (holders[0] || '');
    if(!target) return '';
    userAlbums[target].trackIds = userAlbums[target].trackIds.filter(function(tid){ return tid !== trackId; });
    return target;
  }

  function openSongActions(id, _saAlbumCtx){`,
'signature + scRemoveFromAlbum helper');

/* call sites pass the album they were opened from */
apply(HTML,
`                _kbk.addEventListener('click', function(e){
                  e.stopPropagation();
                  openSongActions(tid);
                });`,
`                _kbk.addEventListener('click', function(e){
                  e.stopPropagation();
                  openSongActions(tid, aName);
                });`,
'card site 1 passes aName');

apply(HTML,
`              _kbk2.addEventListener('click', function(e){
                e.stopPropagation();
                openSongActions(tid);
              });`,
`              _kbk2.addEventListener('click', function(e){
                e.stopPropagation();
                openSongActions(tid, aName);
              });`,
'card site 2 passes aName');

apply(HTML,
`      var id = kb.getAttribute('data-kebab');
      if(id) openSongActions(id);`,
`      var id = kb.getAttribute('data-kebab');
      if(id){
        var _kbc = kb.closest('[data-album-name]');
        openSongActions(id, _kbc && _kbc.dataset ? _kbc.dataset.albumName : '');
      }`,
'kebab fallback derives card album');

apply(HTML,
`_kb.addEventListener('click', function(e){ e.stopPropagation(); openSongActions(_tid); });`,
`_kb.addEventListener('click', function(e){ e.stopPropagation(); openSongActions(_tid, _foundAlb); });`,
'search-jump site passes _foundAlb');

/* the remove handler itself */
apply(HTML,
`        Object.keys(userAlbums).forEach(name => {
          const ua = userAlbums[name];
          if(ua && Array.isArray(ua.trackIds)){
            ua.trackIds = ua.trackIds.filter(tid => tid !== id);
          }
        });
        saveMeta();
        renderList();
        toast('Removed from all albums');`,
`        // ONE album only: the card this row lives in (passed into this sheet),
        // else the first album that actually holds the song. Any other album
        // that also contains the song keeps it.
        const _from = scRemoveFromAlbum(id, _saAlbumCtx || '');
        saveMeta();
        renderList();
        toast(_from ? 'Removed from "' + escapeHtml(_from) + '"' : 'Not in any album');`,
'remove handler scoped to one album');

/* ---------- 2b. bell: Dropping soon entry + wiring + badge + seen ---------- */
apply(HTML,
`    // Show latest version as summary`,
`    // Upcoming releases from pinned artists: anything still dated in the future
    // gets its own entry so a drop never hides inside the plain list.
    const _upcoming = (typeof scUpcomingReleases === 'function') ? scUpcomingReleases() : [];
    if(_upcoming.length){
      const u0 = _upcoming[0];
      const uMs = new Date(u0.date + 'T00:00:00Z').getTime();
      const uDays = Math.ceil((uMs - Date.now()) / 86400000);
      const uDateStr = new Date(uMs).toLocaleDateString();
      html += \`
        <div id="notifUpcomingEntry" style="border-bottom:1px solid var(--line); padding-bottom:10px; cursor:pointer;">
          <div style="font-weight:600; font-size:13.5px; margin-bottom:6px; color:var(--gold);">🎵 Dropping soon</div>
          <div style="font-size:12px; color:var(--ink-dim);">\${_upcoming.length} upcoming release\${_upcoming.length > 1 ? 's' : ''} from your pinned artists — next: \${escapeHtml(u0.artist)} · \${escapeHtml(u0.title)} on \${uDateStr}\${uDays > 0 ? ' (in ' + uDays + ' day' + (uDays > 1 ? 's' : '') + ')' : ''}. Tap to see them all.</div>
        </div>
      \`;
      summaryHtml += \`
        <div style="border-bottom:1px solid var(--line); padding-bottom:8px;">
          <div style="font-weight:600; font-size:13.5px; color:var(--gold);">🎵 Dropping soon — \${_upcoming.length} upcoming from pinned artists</div>
        </div>
      \`;
    }
    // Show latest version as summary`,
'bell Dropping soon entry');

apply(HTML,
`    const dupEntry = document.getElementById('notifDupEntry');
    if(dupEntry) dupEntry.addEventListener('click', () => { $('notifBackdrop').style.display = 'none'; findDuplicates(); });`,
`    const dupEntry = document.getElementById('notifDupEntry');
    if(dupEntry) dupEntry.addEventListener('click', () => { $('notifBackdrop').style.display = 'none'; findDuplicates(); });
    const upEntry = document.getElementById('notifUpcomingEntry');
    if(upEntry) upEntry.addEventListener('click', () => {
      $('notifBackdrop').style.display = 'none';
      navigate('home');
      openHomeBubble('newreleases');
    });`,
'bell entry tap opens New releases panel');

apply(HTML,
`    const hasExportAlert = exportState.active || (exportState.finishedAt && !exportState.seen);
    badge.style.display = (notifLastReadVersion !== APP_VERSION || hasDupAlert || hasEnrichAlert || hasExportAlert || updateIsNewer() || !!window.__scNotifConv) ? 'block' : 'none';`,
`    const hasExportAlert = exportState.active || (exportState.finishedAt && !exportState.seen);
    const hasUpcomingAlert = typeof scUpcomingUnseen === 'function' && scUpcomingUnseen().length > 0;
    badge.style.display = (notifLastReadVersion !== APP_VERSION || hasDupAlert || hasEnrichAlert || hasExportAlert || hasUpcomingAlert || updateIsNewer() || !!window.__scNotifConv) ? 'block' : 'none';`,
'badge covers unseen upcoming');

apply(HTML,
`  function openNotif(){
    enrichState.seen = true;
    exportState.seen = true;
    renderNotifPanel();`,
`  function openNotif(){
    enrichState.seen = true;
    exportState.seen = true;
    // Opening the bell is the user seeing "Dropping soon" — mark the upcoming
    // releases seen so the badge clears until the next one appears.
    try{
      const _up = (typeof scUpcomingReleases === 'function') ? scUpcomingReleases() : [];
      let _upDirty = false;
      _up.forEach(function(x){ if(x.rel && !x.rel.upSeen){ x.rel.upSeen = true; _upDirty = true; } });
      if(_upDirty) savePinnedArtists();
    }catch(_eUp){}
    renderNotifPanel();`,
'openNotif marks upcoming seen');

/* ---------- 2c. auto-check machinery (after the manual check + help line) ---------- */
apply(HTML,
`  $('pinnedArtistsHelp').addEventListener('click', () => {
    toast('Pin artists from any Discover card — collab partners are filtered to just the main artist. SideCut checks for new releases.', 5000);
  });`,
`  $('pinnedArtistsHelp').addEventListener('click', () => {
    toast('Pin artists from any Discover card — collab partners are filtered to just the main artist. SideCut checks for new releases.', 5000);
  });

  // ---- Automatic pinned-artist checks -------------------------------------
  // With Discover unlocked the app looks your pinned artists up on its own:
  // once shortly after boot, and again whenever you return to the app, as long
  // as the last check is at least 6 hours old. A release — or something already
  // dated to drop — then finds you in the bell and on Home instead of waiting
  // for a tap on Fetch latest. A manual Fetch latest still runs instantly.
  function scUpcomingReleases(){
    const _out = [];
    try{
      const _today = new Date().toISOString().slice(0, 10);
      const _pr = (typeof pinnedReleases !== 'undefined' && pinnedReleases) ? pinnedReleases : {};
      Object.keys(_pr).forEach(function(artist){
        (_pr[artist] || []).forEach(function(r){
          if(r && r.date && r.date > _today) _out.push({ artist: artist, title: r.title || '', date: r.date, art: r.art || null, rel: r });
        });
      });
    }catch(_eUp){ /* pinnedReleases can be TDZ this early — treat as empty */ }
    _out.sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); });
    return _out;
  }
  function scUpcomingUnseen(){
    return scUpcomingReleases().filter(function(x){ return !(x.rel && x.rel.upSeen); });
  }
  async function scPinnedAutoCheck(){
    try{
      if(typeof isPremiumActive === 'function' && !isPremiumActive()) return;
      if(!pinnedArtists || !pinnedArtists.length) return;
      if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
      if(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.active) return;
      let last = 0;
      try{ last = parseInt(localStorage.getItem('sidecut_pinnedAutoAt') || '0', 10) || 0; }catch(_eL){}
      if(Date.now() - last < 6 * 60 * 60 * 1000) return;
      try{ localStorage.setItem('sidecut_pinnedAutoAt', String(Date.now())); }catch(_eS){}
      await checkPinnedArtistReleases();
    }catch(_eAuto){ console.warn('auto pinned check skipped', _eAuto); }
  }
  document.addEventListener('visibilitychange', function(){ if(!document.hidden) scPinnedAutoCheck(); });
  setTimeout(function(){ scPinnedAutoCheck(); }, 75000);`,
'auto-check block');

/* ---------- 2d. "drops …" labels in the three live release lists ---------- */
apply(HTML,
`            const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date+'T00:00:00Z').getTime())/86400000) : null;
            const when = daysAgo == null ? '' : daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + 'd ago';`,
`            const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date+'T00:00:00Z').getTime())/86400000) : null;
            const daysUntil = rel.date ? Math.ceil((new Date(rel.date+'T00:00:00Z').getTime() - Date.now())/86400000) : null;
            const when = daysAgo == null ? '' : daysAgo < 0 ? 'drops ' + new Date(rel.date+'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (daysUntil && daysUntil <= 120 ? ' · in ' + daysUntil + 'd' : '') : daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo + 'd ago';`,
'home bubble panel drops label');

apply(HTML,
`            var daysAgo = Math.floor((now - new Date(r.releaseDate).getTime())/86400000);
            var when = daysAgo + 'd ago';`,
`            var daysAgo = Math.floor((now - new Date(r.releaseDate).getTime())/86400000);
            var daysUntil = Math.ceil((new Date(r.releaseDate).getTime() - now)/86400000);
            var when = daysAgo < 0 ? 'drops ' + new Date(r.releaseDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (daysUntil > 0 && daysUntil <= 120 ? ' · in ' + daysUntil + 'd' : '') : daysAgo + 'd ago';`,
'fetch-latest popup drops label');

apply(HTML,
`      const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date + 'T00:00:00Z').getTime())/86400000) : null;
      const when = daysAgo == null ? '' : daysAgo <= 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo < 30 ? daysAgo + 'd ago' : new Date(rel.date + 'T00:00:00Z').toLocaleDateString();`,
`      const daysAgo = rel.date ? Math.floor((Date.now() - new Date(rel.date + 'T00:00:00Z').getTime())/86400000) : null;
      const daysUntil = rel.date ? Math.ceil((new Date(rel.date + 'T00:00:00Z').getTime() - Date.now())/86400000) : null;
      const when = daysAgo == null ? '' : daysAgo < 0 ? 'drops ' + new Date(rel.date + 'T00:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + (daysUntil && daysUntil <= 120 ? ' · in ' + daysUntil + 'd' : '') : daysAgo === 0 ? 'today' : daysAgo === 1 ? 'yesterday' : daysAgo < 30 ? daysAgo + 'd ago' : new Date(rel.date + 'T00:00:00Z').toLocaleDateString();`,
'renderNewReleases drops label');

/* ---------- 3. reorder flicker ---------- */
apply(HTML,
`.home-bubble.is-playing .hb-glow{ animation: sd-glow-pulse 6s ease-in-out infinite; }`,
`.home-bubble.is-playing .hb-glow{ animation: sd-glow-pulse 6s ease-in-out infinite; }
/* renderHome() rebuilds the grid from HTML on every update, which restarts the
   glow at zero — a visible flash on each re-render (each reorder arrow tap,
   each stats refresh, the render that exits reorder mode). --hb-phase is a
   negative delay pinned to the wall clock (all glow rules are a 6s cycle), so
   a fresh element resumes the pulse exactly where the removed one left off. */
body[class*="theme-dyn-"] .home-bubble .hb-glow,
.home-bubble.is-playing .hb-glow{ animation-delay: var(--hb-phase, 0s); }`,
'glow phase CSS rule');

apply(HTML,
`    bubbles.style.setProperty('--hb-s', (homeBubbleSize / 100).toFixed(2));`,
`    bubbles.style.setProperty('--hb-s', (homeBubbleSize / 100).toFixed(2));
    bubbles.style.setProperty('--hb-phase', '-' + ((Date.now() % 6000) / 1000).toFixed(2) + 's');`,
'--hb-phase stamped each render');

apply(HTML,
`    ph.style.minHeight = rect.height + 'px';
    wrap.insertBefore(ph, el);`,
`    ph.style.minHeight = rect.height + 'px';
    // Keep the dragged bubble's footprint: a wide/tall/size-classed bubble needs
    // a placeholder that spans the same grid cells (and honours an exact-width
    // inline gridColumn), or every neighbour jumps a column each time the
    // placeholder moves — the flicker seen while reordering big bubbles.
    HB_SIZE_CLASSES.forEach(function(c){ if(el.classList.contains(c)) ph.classList.add(c); });
    if(el.classList.contains('wide')) ph.classList.add('wide');
    if(el.classList.contains('tall')) ph.classList.add('tall');
    if(el.style.gridColumn) ph.style.gridColumn = el.style.gridColumn;
    wrap.insertBefore(ph, el);`,
'placeholder keeps bubble footprint');

/* ---------- 4. changelog + version ---------- */
apply(HTML,
`  { version: '60.5.6', date: 'September 23, 2026 · 2:25 AM EDT',`,
`  { version: '60.5.7', date: 'September 23, 2026 · 11:40 AM EDT', title: 'Album remove stays local, pinned artists checked on their own, steadier Home reorder', items: [
    '"Remove from an album" takes the song out of exactly that album — any other album that also holds the song keeps it. It used to strip the song from every album at once (and the toast even said so).',
    'Pinned artists are now checked automatically when Discover is unlocked: once shortly after the app opens, and again whenever you come back to the app as long as the last check is at least 6 hours old — no more tapping Fetch latest to learn about a release.',
    'Anything already dated to drop is called out as upcoming: New releases and the Fetch latest popup say "drops Oct 3 · in 10d" instead of calling a future date today, and every automatic scan looks for upcoming albums, EPs and singles for you.',
    'The bell gains a "Dropping soon" entry — the next release from your pinned artists with its date — and its badge lights when one appears that you have not opened yet; opening the bell clears it until the next drop shows up.',
    'Reordering Home bubbles no longer flashes the grid: the glow now resumes mid-cycle across re-renders, so each arrow tap and the render that exits reorder mode keep the bubbles visually still instead of restarting every pulse together.',
    'The drag placeholder keeps a big bubble\\'s full width (and a tall or size-set bubble\\'s footprint), so neighbours stop jumping columns while you drag — small bubbles hold their slots too.',
  ] },
  { version: '60.5.6', date: 'September 23, 2026 · 2:25 AM EDT',`,
'changelog 60.5.7 entry');

apply(HTML,
`const APP_VERSION = '60.5.6';`,
`const APP_VERSION = '60.5.7';`,
'APP_VERSION');
apply('sw.js',
`const CACHE_NAME = 'sidecut-shell-v60.5.6';`,
`const CACHE_NAME = 'sidecut-shell-v60.5.7';`,
'sw cache');
apply('package.json',
`  "version": "5.0.52",`,
`  "version": "5.0.53",`,
'package version');

/* ---------- older test pins move ---------- */
apply('dev/test-6053.mjs', `ver === '60.5.6'`, `ver === '60.5.7'`, '6053 ver pin');
apply('dev/test-6054.mjs', `ver === '60.5.6'`, `ver === '60.5.7'`, '6054 ver pin');
apply('dev/test-6054.mjs', `'5.0.52'`, `'5.0.53'`, '6054 pkg pin');
apply('dev/test-6055.mjs', `ver === '60.5.6'`, `ver === '60.5.7'`, '6055 ver pin');
apply('dev/test-6055.mjs', `'5.0.52'`, `'5.0.53'`, '6055 pkg pin');
apply('dev/test-6056.mjs', `ver === '60.5.6'`, `ver === '60.5.7'`, '6056 ver pin');
apply('dev/test-6056.mjs', `'5.0.52'`, `'5.0.53'`, '6056 pkg pin');

// The [FULL] count pins were written when 60.5.6 WAS entries[0]. This entry is
// all-shared (no download-only notes), so the discipline check moves across the
// whole changelog — where the markers really live — while per-entry shape pins
// (>= 5 items, >= 1 shared, no play naming, malformed = 0) stay on entries[0].
apply('dev/test-6055.mjs',
`  const fullOnly = entries[0].items.filter((i) => i.startsWith('[FULL] '));
  ok(fullOnly.length >= 2, 'full-only items marked: ' + fullOnly.length);`,
`  const fullOnly = entries.flatMap((e) => e.items).filter((i) => i.startsWith('[FULL] '));
  ok(fullOnly.length >= 2, 'full-only items still marked across entries: ' + fullOnly.length);`,
'6055 FULL count pin → across entries');

apply('dev/test-6056.mjs',
`  const full = entries[0].items.filter((i) => i.startsWith('[FULL] '));
  const shared = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  ok(full.length >= 2, 'download-only items marked: ' + full.length);`,
`  const full = entries.flatMap((e) => e.items).filter((i) => i.startsWith('[FULL] '));
  const shared = entries[0].items.filter((i) => !i.startsWith('[FULL] '));
  ok(full.length >= 2, 'download-only items still marked across entries: ' + full.length);`,
'6056 FULL count pin → across entries');

/* ---------- self-verification ---------- */
assertContains(HTML, 'function scRemoveFromAlbum(trackId, albumName)', 'helper present');
assertNotContains(HTML, `toast('Removed from all albums')`, 'remove-all toast gone');
assertNotContains(HTML, `ua.trackIds = ua.trackIds.filter(tid => tid !== id);`, 'remove-all loop gone');
assertContains(HTML, `scRemoveFromAlbum(id, _saAlbumCtx || '')`, 'handler uses helper');
assertContains(HTML, `openSongActions(tid, aName)`, 'card sites pass album');
assertContains(HTML, `openSongActions(_tid, _foundAlb)`, 'search-jump passes album');
assertContains(HTML, 'function scPinnedAutoCheck()', 'auto check present');
assertContains(HTML, '6 * 60 * 60 * 1000', '6h throttle present');
assertContains(HTML, `document.addEventListener('visibilitychange', function(){ if(!document.hidden) scPinnedAutoCheck(); });`, 'resume trigger present');
assertContains(HTML, 'setTimeout(function(){ scPinnedAutoCheck(); }, 75000);', 'boot trigger present');
assertContains(HTML, 'function scUpcomingReleases()', 'upcoming helper present');
assertContains(HTML, 'function scUpcomingUnseen()', 'unseen helper present');
assertContains(HTML, 'notifUpcomingEntry', 'bell entry present');
assertContains(HTML, 'Dropping soon', 'bell title present');
assertContains(HTML, 'hasUpcomingAlert', 'badge condition present');
assertContains(HTML, `x.rel.upSeen = true`, 'bell open marks seen');
assertContains(HTML, `openHomeBubble('newreleases')`, 'bell tap target present');
assertContains(HTML, `'drops '`, 'drops label present');
assertContains(HTML, 'animation-delay: var(--hb-phase, 0s)', 'phase CSS present');
assertContains(HTML, `'--hb-phase'`, 'phase stamped in renderHome');
assertContains(HTML, 'HB_SIZE_CLASSES.forEach(function(c){ if(el.classList.contains(c)) ph.classList.add(c); });', 'placeholder copies size classes');
assertContains(HTML, 'ph.style.gridColumn', 'placeholder copies gridColumn');
assertContains(HTML, `version: '60.5.7'`, 'entry present');
assertContains(HTML, `const APP_VERSION = '60.5.7'`, 'version bumped');
assertContains('sw.js', 'sidecut-shell-v60.5.7', 'sw bumped');
assertContains('package.json', '"5.0.53"', 'pkg bumped');

// Changelog shape, parsed the same way the tests do.
{
  const src = read(HTML);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { fail('changelog eval', e.message); }
  if (entries) {
    const e0 = entries[0];
    if (e0.version !== '60.5.7') fail('entry version', e0.version);
    else ok++;
    if (!/EDT$/.test(e0.date || '')) fail('entry date EDT', e0.date);
    else ok++;
    if (e0.items.length < 5) fail('entry items >= 5', String(e0.items.length));
    else ok++;
    const full = e0.items.filter((i) => i.startsWith('[FULL] '));
    const shared = e0.items.filter((i) => !i.startsWith('[FULL] '));
    if (shared.length < 1) fail('shared items >= 1', String(shared.length));
    else ok++;
    const malformed = entries.flatMap((e) => e.items).filter((i) => i.includes('[FULL]') && !i.startsWith('[FULL] '));
    if (malformed.length) fail('malformed markers', String(malformed.length));
    else ok++;
    if (/play build|play version|play install|google play build/i.test(e0.items.join('\n'))) fail('notes name the play build');
    else ok++;
  }
}

console.log('');
console.log(ok + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
