#!/usr/bin/env node
// SideCut v63 — albums in the 📀 Album History popup can be reordered.
//
// The report, in the user's words: "In album history you click in an artist you
// click on an album you hold down the songs and try to reorder them but nothing
// happens. Behavior: album history it should be the albums getting reordered not
// the songs inside, my mistake."
//
// MEASURED FIRST, and it named the surface exactly:
//   * Album History groups artists (`.dp-ah-artist`), each expandable to its
//     albums (`.dp-ah-album`), each album expandable to its tracks
//     (`.dp-ah-track`). The popup already reorders the ARTISTS: setupGroupReorder
//     in the second script block drives them, keyed `sidecut_ahArtistOrder`.
//   * The albums under an artist were never wired for any gesture. Holding an
//     album row did nothing — which reads exactly as "nothing at all opens".
//     (The user's attempt to hold the SONGS inside an album was a
//     misunderstanding of their own product: they want the albums ordered.)
//
// So the fix is the list the user actually asked for: hold an album under an
// artist, drag it up or down, and its position sticks.
//
// Design, kept aligned with the artist reorder that already ships:
//   * Hold 420 ms, then drag: a tap still opens the album's tracks, a plain
//     scroll still scrolls (movement before the hold cancels it), and the same
//     12 px pickup threshold is used.
//   * Order is persisted per artist in localStorage `sidecut_ahAlbumOrder`
//     (artist -> [collectionId|name, ...]). It is applied BOTH when the popup is
//     rendered fresh (_renderAhFromData) and to a cached body when it is reopened
//     (__wireAHAlbumReorder reorders the DOM), so a reopen cannot show stale order.
//   * The album row already had a 500 ms long-press that sets a custom cover.
//     Two holds on one row raced. The cover hold is now scoped to the artwork
//     itself (which is what its own comment already claimed it did), leaving the
//     rest of the row for reorder.
//   * A drag that reordered must not also toggle the track list on release, so
//     the album-header click is suppressed once after a real drag.
//   * The artist-group handler bails when the press landed inside `.dp-ah-album`
//     so the two reorders can never both start.
//
//   node dev/patch-621.mjs              # code fix + release metadata
//   node dev/patch-621.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Every index.html edit is count==1 asserted and idempotent, and the write
// happens once at the end, so a bad needle can never half-apply and a rerun is
// a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63';
const PREV = '62';
const STAMP = 'September 26, 2026 · 11:30 AM EDT';
const PREV_STAMP = 'September 25, 2026 · 7:45 PM EDT';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. The album-list order store + the Album History album reorder wiring.
//
// Appended right after setupGroupReorderByContext, in the same script block as
// the artist-group reorder so the two live together.
// ---------------------------------------------------------------------------
const ANCHOR_GROUP = [
  "  setupGroupReorder(isAlbum ? 'sidecut_ahArtistOrder' : 'sidecut_singlesArtistOrder');",
  '};'
].join('\n');

const NEW_BLOCK = [
  "  setupGroupReorder(isAlbum ? 'sidecut_ahArtistOrder' : 'sidecut_singlesArtistOrder');",
  '};',
  '',
  '// ---- 63: reorder the ALBUMS under one artist in Album History ------------',
  '// The popup reorders ARTISTS at the top level (setupGroupReorder above). The',
  '// albums under each artist were never wired to any gesture at all — holding',
  '// one did nothing. This is that list, with its own persisted order per artist.',
  'window.orderAlbumList = function(albums, artist, persistKey){',
  "  if(!Array.isArray(albums) || !albums.length) return Array.isArray(albums) ? albums : [];",
  '  var store = {};',
  "  try{ store = JSON.parse(localStorage.getItem(persistKey || 'sidecut_ahAlbumOrder') || '{}') || {}; }catch(e){ store = {}; }",
  '  var arr = store[artist];',
  '  if(!Array.isArray(arr) || !arr.length) return albums;',
  '  var keyOf = function(a){',
  '    var cid = (a && a.collectionId) ? String(a.collectionId) : \'\';',
  '    return cid ? cid : String((a && a.collectionName) || \'\');',
  '  };',
  '  var pool = albums.slice(), out = [];',
  '  for(var i = 0; i < arr.length; i++){',
  '    for(var j = 0; j < pool.length; j++){',
  '      if(keyOf(pool[j]) === arr[i]){ out.push(pool[j]); pool.splice(j, 1); break; }',
  '    }',
  '  }',
  '  return out.concat(pool);',
  '};',
  'window.__scSaveAHAlbumOrder = function(artist, order){',
  '  if(!artist) return;',
  '  var store = {};',
  "  try{ store = JSON.parse(localStorage.getItem('sidecut_ahAlbumOrder') || '{}') || {}; }catch(e){ store = {}; }",
  '  store[artist] = Array.isArray(order) ? order : [];',
  "  try{ localStorage.setItem('sidecut_ahAlbumOrder', JSON.stringify(store)); }catch(e){}",
  '};',
  '// Reorder an already-rendered album list to the saved order — used for a body',
  '// restored from the popup cache, which was snapshotted in the old order.',
  'window.__scApplyAHAlbumOrder = function(cont, artist){',
  '  if(!cont || !artist) return;',
  '  var store = {};',
  "  try{ store = JSON.parse(localStorage.getItem('sidecut_ahAlbumOrder') || '{}') || {}; }catch(e){ store = {}; }",
  '  var order = store[artist];',
  '  if(!Array.isArray(order) || !order.length) return;',
  '  var keyOf = function(a){',
  '    var h = a.querySelector ? a.querySelector(\'.dp-ah-album-hdr\') : null;',
  '    if(!h) return \'\';',
  '    var cid = h.getAttribute(\'data-collection-id\') || \'\';',
  '    return cid ? cid : String(h.getAttribute(\'data-album\') || \'\');',
  '  };',
  '  var rows = Array.prototype.filter.call(cont.children, function(k){ return k.classList && k.classList.contains(\'dp-ah-album\'); });',
  '  for(var i = 0; i < order.length; i++){',
  '    for(var j = 0; j < rows.length; j++){',
  '      if(keyOf(rows[j]) === order[i]){ cont.appendChild(rows[j]); break; }',
  '    }',
  '  }',
  '};',
  'window.__wireAHAlbumReorder = function(){',
  "  var bodyEl = document.getElementById('discPopupBody');",
  '  if(!bodyEl) return;',
  '  var albums = Array.prototype.slice.call(bodyEl.querySelectorAll(\'.dp-ah-album\'));',
  '  // Apply the saved order to each artist list once (fresh render or cached).',
  '  albums.forEach(function(el){',
  '    var cont = el.parentElement;',
  '    if(cont && !cont._ahAlbOrderApplied){',
  '      cont._ahAlbOrderApplied = true;',
  '      var h0 = el.querySelector(\'.dp-ah-album-hdr\');',
  '      if(h0) window.__scApplyAHAlbumOrder(cont, h0.getAttribute(\'data-artist\') || \'\');',
  '    }',
  '  });',
  '  albums.forEach(function(el){',
  '    if(el._ahAlbReorderWired) return;',
  '    var hdr = el.querySelector(\'.dp-ah-album-hdr\');',
  '    if(!hdr) return;',
  '    el._ahAlbReorderWired = true;',
  '    var holdTimer = null, drag = null;',
  '    function keyOf(a){',
  '      var h = a.querySelector(\'.dp-ah-album-hdr\');',
  '      if(!h) return \'\';',
  '      var cid = h.getAttribute(\'data-collection-id\') || \'\';',
  '      return cid ? cid : String(h.getAttribute(\'data-album\') || \'\');',
  '    }',
  '    function persistOrder(){',
  '      var cont = el.parentElement;',
  '      if(!cont) return;',
  '      var order = [];',
  '      Array.prototype.forEach.call(cont.children, function(k){',
  '        if(k.classList && k.classList.contains(\'dp-ah-album\')){ var kk = keyOf(k); if(kk) order.push(kk); }',
  '      });',
  '      if(typeof window.__scSaveAHAlbumOrder === \'function\') window.__scSaveAHAlbumOrder(hdr.getAttribute(\'data-artist\') || \'\', order);',
  '    }',
  '    function haptic(ms){ try{ if(navigator.vibrate) navigator.vibrate(ms); }catch(e){} }',
  '    function begin(e){',
  '      if(drag || !e.pointerId) return;',
  '      drag = el;',
  '      try{ document.body.classList.add(\'reordering\'); }catch(err0){}',
  '      el._dragging = false;',
  '      el._startX = e.clientX; el._startY = e.clientY;',
  "      el.style.opacity = '0.85';",
  "      el.style.zIndex = '99';",
  "      el.style.boxShadow = '0 8px 20px rgba(0,0,0,0.45)';",
  "      el.style.background = 'rgba(255,255,255,0.06)';",
  "      el.style.transition = 'none';",
  '      try{ el.setPointerCapture(e.pointerId); }catch(err){}',
  '    }',
  '    function move(e){',
  '      if(drag !== el){',
  '        if(!drag && holdTimer && el._startX != null){',
  '          var pdx = e.clientX - el._startX, pdy = e.clientY - el._startY;',
  '          if((pdx*pdx + pdy*pdy) > 144){ clearTimeout(holdTimer); holdTimer = null; }',
  '        }',
  '        return;',
  '      }',
  '      // Ours is the live drag: the artist-group finish() would otherwise run on',
  '      // the same event and clear the body class that blocks the WebView from',
  '      // claiming the gesture (a pointercancel mid-drag).',
  '      e.stopPropagation();',
  '      if(!el._dragging){',
  '        var ddx = e.clientX - el._startX, ddy = e.clientY - el._startY;',
  '        if((ddx*ddx + ddy*ddy) < 100) return;',
  '        el._dragging = true;',
  '        haptic(12);',
  "        el.classList.add('dragging');",
  '      }',
  '      e.preventDefault();',
  '      var cont = el.parentElement;',
  '      if(!cont) return;',
  '      var y = e.clientY, before = null;',
  '      var sibs = Array.prototype.filter.call(cont.children, function(k){ return k !== el && k.classList && k.classList.contains(\'dp-ah-album\'); });',
  '      for(var i = 0; i < sibs.length; i++){',
  '        var r = sibs[i].getBoundingClientRect();',
  '        if(y < r.top + r.height/2){ before = sibs[i]; break; }',
  '      }',
  '      if(before){ if(before.previousElementSibling !== el) cont.insertBefore(el, before); }',
  '      else if(el !== cont.lastElementChild) cont.appendChild(el);',
  '    }',
  '    function finish(e){',
  '      clearTimeout(holdTimer);',
  '      if(drag === el && e && e.stopPropagation) e.stopPropagation();',
  '      try{ document.body.classList.remove(\'reordering\'); }catch(e2){}',
  '      if(drag){',
  "        el.style.opacity = ''; el.style.zIndex = ''; el.style.boxShadow = ''; el.style.background = ''; el.style.transition = '';",
  "        el.classList.remove('dragging');",
  '        if(el._dragging){',
  '          haptic(8);',
  '          // A drag that reordered the albums must not also toggle the tracks.',
  '          hdr._ahSuppressClick = true;',
  '          setTimeout(function(){ hdr._ahSuppressClick = false; }, 700);',
  '          setTimeout(persistOrder, 60);',
  '        }',
  '        drag = null;',
  '      }',
  '    }',
  "    hdr.addEventListener('pointerdown', function(e){",
  '      if(window.__ahSelectMode) return;',
  "      if(e.target.closest('.dp-ah-edit,.dp-ah-rm,.dp-ah-cb,.dp-ah-artist-refetch,.dp-si-refetch,[data-art-url],img,button,a,input,select')) return;",
  '      clearTimeout(holdTimer);',
  '      el._dragging = false;',
  '      el._startX = e.clientX; el._startY = e.clientY;',
  '      holdTimer = setTimeout(function(){ begin(e); }, 420);',
  '    });',
  "    hdr.addEventListener('pointermove', move);",
  "    hdr.addEventListener('pointerup', finish);",
  "    hdr.addEventListener('pointercancel', finish);",
  '  });',
  '};'
].join('\n');

// ---------------------------------------------------------------------------
// 2. __wireAH runs it on every render (fresh and cached opens both go through).
// ---------------------------------------------------------------------------
const ANCHOR_WIRE = [
  "        _promptManualCount(a, al, f, mc.textContent.match(/\\d+/) ? mc.textContent.match(/\\d+/)[0] : '', function(){ window.__refetchAlbums(false); });",
  '      });',
  '    }'
].join('\n');

const NEW_WIRE = ANCHOR_WIRE + '\n' +
  '    if(typeof window.__wireAHAlbumReorder === \'function\') window.__wireAHAlbumReorder();';

// ---------------------------------------------------------------------------
// 3. _renderAhFromData renders each artist's albums in the saved order.
// ---------------------------------------------------------------------------
const OLD_RENDER = [
  '    var ahAlbums = artistAlbums[ahArtist];',
  '    if(!ahAlbums||!ahAlbums.length) continue;'
].join('\n');

const NEW_RENDER = [
  '    var ahAlbums = artistAlbums[ahArtist];',
  "    if(typeof window.orderAlbumList === 'function') ahAlbums = window.orderAlbumList(ahAlbums, ahArtist, 'sidecut_ahAlbumOrder');",
  '    if(!ahAlbums||!ahAlbums.length) continue;'
].join('\n');

// ---------------------------------------------------------------------------
// 4. The artist-group hold must never start from a press on an album row.
// ---------------------------------------------------------------------------
const OLD_GROUP_BAIL = "      if(e.target.closest('.dp-ah-x,.dp-ah-rm,.dp-ah-edit,.dp-ah-artist-refetch,.dp-si-refetch,button,a,input,select')) return;";
const NEW_GROUP_BAIL = "      if(e.target.closest('.dp-ah-album,.dp-ah-x,.dp-ah-rm,.dp-ah-edit,.dp-ah-artist-refetch,.dp-si-refetch,button,a,input,select')) return;";

// ---------------------------------------------------------------------------
// 5. The album cover long-press is scoped to the artwork — leaving the rest of
//    the row free for the reorder hold. (Its own comment always said "art".)
// ---------------------------------------------------------------------------
const OLD_COVER_DOWN = "      hdr.addEventListener('pointerdown', function(e){ onDown(e.clientX||0, e.clientY||0); });";
const NEW_COVER_DOWN = [
  "      hdr.addEventListener('pointerdown', function(e){",
  "        // Only a press on the artwork changes the cover — the rest of the row",
  '        // belongs to the album-reorder hold, and the two used to race.',
  "        if(!(e.target && e.target.closest && e.target.closest('[data-art-url],img'))) return;",
  '        onDown(e.clientX||0, e.clientY||0);',
  '      });'
].join('\n');

const OLD_COVER_TOUCH = "      hdr.addEventListener('touchstart', function(e){ var t=e.touches[0]; if(t) onDown(t.clientX, t.clientY); }, {passive:true});";
const NEW_COVER_TOUCH = [
  "      hdr.addEventListener('touchstart', function(e){",
  "        if(!(e.target && e.target.closest && e.target.closest('[data-art-url],img'))) return;",
  '        var t=e.touches[0]; if(t) onDown(t.clientX, t.clientY);',
  '      }, {passive:true});'
].join('\n');

// ---------------------------------------------------------------------------
// 6. A reorder drag must not also toggle the track list on release.
// ---------------------------------------------------------------------------
const OLD_TOGGLE = [
  "      h.addEventListener('click', function(){",
  '        var tgt = document.getElementById(this.dataset.target);'
].join('\n');

const NEW_TOGGLE = [
  "      h.addEventListener('click', function(){",
  '        // A hold-and-drag that reordered the albums must not also toggle tracks.',
  '        if(this._ahSuppressClick){ this._ahSuppressClick = false; return; }',
  '        var tgt = document.getElementById(this.dataset.target);'
].join('\n');

// 6b. A one-line hint so the hold gesture is discoverable.
const OLD_SUBTITLE = "  openDiscoverPopup('📀 Album History', ahHtml, ahTotal+' album'+(ahTotal!==1?'s':'')+' from '+ahArtistKeys.length+' artist'+(ahArtistKeys.length!==1?'s':''));";
const NEW_SUBTITLE = "  openDiscoverPopup('📀 Album History', ahHtml, ahTotal+' album'+(ahTotal!==1?'s':'')+' from '+ahArtistKeys.length+' artist'+(ahArtistKeys.length!==1?'s':'')+' · hold an album to reorder');";

if (!MANIFEST_ONLY) {
  sub('Album History — album reorder wiring', ANCHOR_GROUP, NEW_BLOCK, 1, 'window.__wireAHAlbumReorder = function(){');
  sub('Album History — hold-to-reorder hint in the subtitle', OLD_SUBTITLE, NEW_SUBTITLE, 1, "· hold an album to reorder');");
  sub('Album History — wire it from __wireAH', ANCHOR_WIRE, NEW_WIRE, 1, 'if(typeof window.__wireAHAlbumReorder === \'function\') window.__wireAHAlbumReorder();');
  sub('Album History — render albums in the saved order', OLD_RENDER, NEW_RENDER, 1, 'ahAlbums = window.orderAlbumList(ahAlbums, ahArtist');
  sub('Album History — artist hold bails on an album row', OLD_GROUP_BAIL, NEW_GROUP_BAIL, 1);
  sub('Album History — cover hold scoped to the artwork (pointer)', OLD_COVER_DOWN, NEW_COVER_DOWN, 1, 'belongs to the album-reorder hold');
  sub('Album History — cover hold scoped to the artwork (touch)', OLD_COVER_TOUCH, NEW_COVER_TOUCH, 1, "if(!(e.target && e.target.closest && e.target.closest('[data-art-url],img'))) return;\n        var t=e.touches[0];");
  sub('Album History — a reorder drag suppresses the track toggle', OLD_TOGGLE, NEW_TOGGLE, 1, 'if(this._ahSuppressClick){ this._ahSuppressClick = false; return; }');
}

// ---------------------------------------------------------------------------
// 7. Release metadata: APP_VERSION + the 63 changelog head.
//
// NOTE on wording: the head entry's first six items become the OTA patch notes
// for BOTH channels, and dev/test-60510 + dev/test-6058 forbid a
// converter/downloader term there. Keep every note free of download*, convert*,
// "to mp3", "get song", "no source found" and "play build".
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '" + PREV + "';", "  const APP_VERSION = '" + VER + "';", 1,
    "const APP_VERSION = '" + VER + "';");

  const ENTRY = [
    "  { version: '" + VER + "', date: '" + STAMP + "', title: 'Albums in Album History can be put in the order you want', items: [",
    "    'In \\ud83d\\udcc0 Album History, the albums under an artist can now be rearranged. Press and hold an album for a moment, then drag it up or down \\u2014 the row lifts and follows your finger, and where you drop it is where it stays.',",
    "    'The order is remembered per artist: close the popup, reopen it, refetch the list, or restart the app, and the albums come back in the order you gave them.',",
    "    'Nothing about a normal tap changed \\u2014 a short press still opens the album\\'s songs exactly as before, because only a press-and-hold starts a reorder.',",
    "    'Holding an album\\'s artwork still sets a custom cover; the reorder now lives on the rest of the row, so the two gestures no longer compete for the same press.',",
    "    'This is the album order inside Album History only. It does not touch the Albums tab, your playlists, or which songs belong to a collection.',",
    "    'Reordering the artists themselves at the top of Album History works exactly as it did, and the other popups are untouched.',",
    '  ] },'
  ].join('\n');

  const start = src.indexOf("  { version: '" + VER + "',");
  if (start !== -1) {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the ' + VER + ' entry');
    const tail = '\n  ] },'.length;
    const cur = src.slice(start, end + tail);
    const norm = (s) => s.replace(/\s+/g, ' ');
    if (norm(cur) === norm(ENTRY)) skip('CHANGELOG ' + VER + ' entry');
    else { src = src.slice(0, start) + ENTRY + src.slice(end + tail); done('CHANGELOG ' + VER + ' entry rewritten'); }
  } else {
    sub('CHANGELOG head — ' + VER + ' entry',
      "const CHANGELOG = [\n  { version: '" + PREV + "',",
      "const CHANGELOG = [\n" + ENTRY + "\n  { version: '" + PREV + "',", 1,
      "  { version: '" + VER + "', date: '");
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 8. sw.js cache name.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const SW = path.join(ROOT, 'sw.js');
  const sw = fs.readFileSync(SW, 'utf8');
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + PREV + "';";
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + VER + "';";
  if (sw.includes(newSw)) console.log('= sw.js CACHE_NAME (already ' + VER + ')');
  else {
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> v' + VER);
  }
}

// ---------------------------------------------------------------------------
// 9. Repin the repo-wide release assertions.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + PREV + "'", "ver === '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + PREV + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + PREV + "', '" + PREV + " heads the changelog'",
     "entries[0].version === '" + VER + "', '" + VER + " heads the changelog'"],
    ["entries[0].date === '" + PREV_STAMP + "'", "entries[0].date === '" + STAMP + "'"],
    ["'the " + PREV + " entry heads the changelog'", "'the " + VER + " entry heads the changelog'"],
    ["version: '" + PREV + "'", "version: '" + VER + "'"]
  ];

  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (t.indexOf(a) === -1) continue;
      t = t.split(a).join(b);
      repinned++;
      console.log('• ' + name + ' — ' + a.split('\n')[0].slice(0, 46));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-621: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel.
// Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-621 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
