#!/usr/bin/env node
// SideCut - 63.1.4 (part one): the albums the app added for you are gone, and
// Manage albums gets a search box.
//
// The report, with the panel open on it: "Fix the damn auto albums I hate those
// because I make an album and it says it already exists just remove the auto
// albums and make sure that doesn't affect my regular albums." The panel behind
// the complaint reads "25 albums · 227 not created by you".
//
// Where it came from: the app used to write album entries by itself (an old
// card-drag auto-save, or a tag album materialised so a reorder had somewhere to
// live), keep them out of the Albums tab, and list them under "Not created by
// you" where they could be adopted back one at a time. Every one of them was only
// ever a copy of an album tag already on the songs — but they kept their NAME,
// and a name an invisible album had taken is what made "Create album" answer "an
// album named X already exists — merge these songs into it?" and then file the
// new songs into an album that never appeared.
//
//   * removeAutoAlbums() deletes those entries, once per launch. It only ever
//     touches an entry an automatic path wrote; every album you made, renamed,
//     reordered or filed songs into by hand survives exactly as it was.
//   * migrateAutoFlaggedAlbums() is gone with it. That was the pass that flagged a
//     saved album as auto purely because its songs matched a file-tag group in the
//     same order, which is how an album somebody had made by hand could be taken
//     out of the Albums tab in the first place.
//   * Nothing writes `auto: true` any more: ensureAlbumSaved() saves the album it
//     materialises as an album of yours, which is what its only caller already
//     did a line later.
//   * Manage albums loses the "Not created by you" section and its three controls
//     (It is mine / Rename / Delete) and gains a search box: album name or artist,
//     narrowed as you type, with a match count, a clear button, and the query kept
//     across the in-place re-render a rename or a delete causes.
//
//   node dev/patch-658.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose gets the real character, built here so this script
// stays ASCII (the same reason dev/patch-653.mjs builds its glyphs from code points).
const EM = String.fromCodePoint(0x2014); // em dash

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact ASCII needle. Used for in-place text swaps.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// Replace the whole slice between two ASCII anchors, keeping the END anchor.
// The needles stay ASCII on purpose: the surrounding prose is full of em dashes
// and ellipses, and a needle carrying one of those is how a patch silently stops
// matching (see AGENTS.md, "Non-ASCII needle trap").
function splice(label, from, to, neu, marker) {
  const m = marker || neu;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const at = src.indexOf(from);
  if (at === -1) throw new Error(label + ': start anchor not found');
  const end = src.indexOf(to, at);
  if (end === -1) throw new Error(label + ': end anchor not found');
  const again = src.indexOf(from, at + from.length);
  if (again !== -1 && again < end) throw new Error(label + ': start anchor is ambiguous');
  src = src.slice(0, at) + neu + src.slice(end);
  done(label);
}

// Replace one whole line, located by an ASCII prefix (the rest of the line is
// re-written, so a comment tail full of non-ASCII never has to be matched).
function reLine(label, prefix, newLine) {
  if (src.indexOf(newLine) !== -1) return skip(label);
  const at = src.indexOf(prefix);
  if (at === -1) throw new Error(label + ': line not found');
  if (src.indexOf(prefix, at + 1) !== -1) throw new Error(label + ': line prefix is ambiguous');
  const eol = src.indexOf('\n', at);
  src = src.slice(0, at) + newLine + src.slice(eol);
  done(label);
}

// ---------------------------------------------------------------- the flag
// A tag-only album materialised so a reorder had somewhere to live is an album of
// yours — you reached it from the app — so it is saved as one instead of being
// flagged auto and hidden the moment it is written.
sub('ensureAlbumSaved comment',
  "  // Give a tag-only album a saved entry so it has somewhere to store a position.\n" +
  "  // Mirrors the reorder sheet's materialisation: it claims the tracks carrying\n" +
  "  // that album tag, minus any another saved album already owns, so nothing is\n" +
  "  // ever taken away from an album you built by hand.",
  "  // Give a tag-only album a saved entry so it has somewhere to store a position.\n" +
  "  // Mirrors the reorder sheet's materialisation: it claims the tracks carrying\n" +
  "  // that album tag, minus any another saved album already owns, so nothing is\n" +
  "  // ever taken away from an album you built by hand. It is saved as an album of\n" +
  "  // yours: you reached it from the app, so it belongs in the Albums tab.");

reLine('ensureAlbumSaved does not flag the album it writes',
  '      auto: true // created for a reorder, not by hand',
  '      manual: true // reached from the app, so it is an album of yours');

// ------------------------------------------------- the pass that did the damage
// removeAutoAlbums() takes the place of migrateAutoFlaggedAlbums(): it does the
// opposite. The old pass ADDED the flag to any saved album whose songs matched a
// file-tag group; this one deletes entries that already carry it.
splice('migrateAutoFlaggedAlbums -> removeAutoAlbums',
  '  // One-time tidy-up: an entry that is NOTHING but a copy of one of your file-tag',
  '  window.__scMarkAlbumManual = markAlbumManual;',
  [
    '  // ---- The albums the app added for you are deleted, not hidden ------------',
    '  // Older builds wrote album entries by themselves (a card-drag auto-save, or a',
    '  // tag album materialised so a reorder had somewhere to live) and kept them out',
    '  // of the Albums tab. Every one of them was only ever a copy of an album tag',
    '  // already on the songs, so nothing in them is not still on your files: the tag',
    '  // stays, By-album sorting still groups them, Album History still finds them.',
    '  // What they did carry was a NAME — and a name an invisible album had taken is',
    '  // what made "Create album" answer "an album named X already exists" and then',
    '  // file the songs into an album that never appeared. They were also the only',
    '  // thing "It is mine" could ever restore, which made a hidden album look like a',
    '  // feature instead of the mess.',
    '  //',
    '  // So they go, once per launch. ONLY an entry an automatic path wrote is ever',
    '  // touched: an album you created, renamed, reordered or filed songs into by hand',
    '  // never carried the flag, and is left exactly as it is. Returns how many went.',
    '  function removeAutoAlbums(){',
    '    var gone = 0;',
    '    try{',
    '      Object.keys(userAlbums || {}).forEach(function(name){',
    '        if(!albumIsAuto(name)) return;',
    '        delete userAlbums[name];',
    '        try{',
    '          var i = albumOrder.indexOf(name);',
    '          if(i !== -1) albumOrder.splice(i, 1);',
    '        }catch(_eOr){}',
    '        gone++;',
    '      });',
    '      if(gone){',
    '        try{ if(typeof dbPut === \'function\') dbPut(\'meta\', { key: \'userAlbums\', value: userAlbums }); }catch(_eUa){}',
    '        try{ if(typeof dbPut === \'function\') dbPut(\'meta\', { key: \'albumOrder\', value: albumOrder }); }catch(_eOa){}',
    '      }',
    '    }catch(_e){ return 0; }',
    '    return gone;',
    '  }',
    ''
  ].join('\n'));

sub('the reorder alias becomes the removal',
  '  window.__scMigrateAutoAlbums = migrateAutoFlaggedAlbums;',
  '  window.__scRemoveAutoAlbums = removeAutoAlbums;');

// ------------------------------------------------------------------- the boot
splice('boot removes them instead of hiding them',
  '      // Manual-only albums: flag entries that were only ever created as a side',
  '      if(loaded){\n        // Reopen on the last playlist the user engaged with',
  [
    '      // Albums the app added on its own used to be hidden from the Albums tab;',
    '      // now they are deleted (see removeAutoAlbums). That is what frees the name',
    '      // they had taken, so creating an album can no longer be told the name is',
    '      // already in use and quietly file the songs into something you cannot see.',
    '      var _scAutoAlbums = 0;',
    '      try{ _scAutoAlbums = removeAutoAlbums(); }catch(e){}',
    '      if(loaded && _scAutoAlbums){',
    '        setTimeout(function(){',
    '          try{ toast(_scAutoAlbums + \' album\' + (_scAutoAlbums === 1 ? \'\' : \'s\') + \' the app had added on its own were removed \\u2014 your songs and their album tags are untouched.\', 7000); }catch(_e){}',
    '        }, 3000);',
    '      }',
    ''
  ].join('\n'),
  'removeAutoAlbums(); }catch(e){}');

// ----------------------------------------------------- the manual-only comments
splice('the manual-only header comment',
  '  // ---- Manual-only albums ',
  '  function markAlbumManual(name){',
  [
    '  // ---- Manual-only albums ' + '----------------------------------------------------',
    '  // "Albums" means the albums YOU made. The app no longer creates any for itself',
    '  // — removeAutoAlbums() deletes the entries older builds wrote the moment the',
    '  // app starts — but the old `auto` marker is still honoured while it is there:',
    '  // an entry wearing it stays out of the Albums tab until a deliberate edit',
    '  // (rename, reorder, add songs) clears it. That is what markAlbumManual() is,',
    '  // and it is the one thing standing between a stale flag and a hidden album.',
    ''
  ].join('\n'));

splice('the explanation under markAlbumManual',
  '  // An album is hidden from Albums ONLY when it was recorded as created',
  '  // ---------------- Album heal: ids from another device ----------------',
  [
    '  // An album is hidden from Albums ONLY when it was recorded as created',
    '  // automatically — the old card-drag auto-save, or a tag album materialised so',
    '  // a reorder had somewhere to live. Everything else is an album you have (or',
    '  // had) in your library, including every album that predates the flag: those',
    '  // have no marker at all, and treating a missing marker as "not yours" is what',
    '  // emptied a library of twelve hand-made albums down to one card. Any such',
    '  // entry is deleted at boot by removeAutoAlbums(), so this stays a guard for a',
    '  // stale flag rather than a state the app ever produces.',
    ''
  ].join('\n'));

// --------------------------------------------------------------- Manage albums
splice('manageAlbumsHTML: no auto section, search box on top',
  '  function manageAlbumsHTML(){',
  '  function wireManageAlbums(){',
  [
    '  function manageAlbumsHTML(){',
    '    // Every entry in the store is an album you made: the app no longer creates',
    '    // any on its own (removeAutoAlbums deletes the ones older builds wrote), so',
    '    // there is no second list to keep apart. The search box is part of this',
    '    // markup rather than injected at open time, because the panel is re-rendered',
    '    // in place after every rename and every delete.',
    '    var names = (typeof visibleAlbumNames === \'function\') ? visibleAlbumNames() : Object.keys(userAlbums || {});',
    '    if(!names.length) return \'<div class="dp-empty">No albums yet.</div>\';',
    '    var html = \'<div style="padding:12px;">\';',
    '    html += \'<div style="display:flex;align-items:center;gap:8px;background:rgba(255,255,255,0.05);border:1px solid var(--line);border-radius:10px;padding:8px 12px;">\';',
    '    html += \'<span style="color:var(--ink-dim);font-size:13px;">\\ud83d\\udd0d</span>\';',
    '    html += \'<input id="mgrAlbumSearch" type="text" placeholder="Search albums or artists\\u2026" autocomplete="off" style="flex:1;background:none;border:none;outline:none;color:var(--ink);font-size:13px;min-width:0;" />\';',
    '    html += \'<span id="mgrAlbumSearchClear" style="display:none;color:var(--ink-dim);font-size:15px;cursor:pointer;padding:0 2px;">\\u00d7</span>\';',
    '    html += \'</div>\';',
    '    html += \'<div id="mgrAlbumCount" style="display:none;font-size:11px;color:var(--ink-dim);padding:6px 2px 2px;"></div>\';',
    '    names.forEach(function(name, i){',
    '      var alb = userAlbums[name] || {};',
    '      // userAlbums entries store trackIds, not tracks - the old "N tracks"',
    '      // count read the wrong field and always said 0.',
    '      var n = (alb.trackIds || []).length;',
    '      // data-name / data-artist are what the search box filters on, so it never',
    '      // has to read the rendered row (which also carries the track count).',
    '      html += \'<div class="mgr-alb-row" data-name="\' + escapeHtml(String(name).toLowerCase()) + \'" data-artist="\' + escapeHtml(String(alb.artist || \'\').toLowerCase()) + \'" style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--line);">\';',
    '      html += \'<div style="flex:1;min-width:0;">\';',
    '      html += \'<div style="font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\' + escapeHtml(name) + \'</div>\';',
    '      html += \'<div style="font-size:11px;color:var(--ink-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">\' + n + \' track\' + (n !== 1 ? \'s\' : \'\') + (alb.artist ? \' \\u00b7 \' + escapeHtml(alb.artist) : \'\') + \'</div>\';',
    '      html += \'</div>\';',
    '      html += \'<button class="mgr-alb-rename" data-i="\' + i + \'" style="padding:5px 10px;border-radius:6px;border:1px solid var(--line);background:none;color:var(--ink);font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;">Rename</button>\';',
    '      html += \'<button class="mgr-alb-del" data-i="\' + i + \'" style="padding:5px 10px;border-radius:6px;border:1px solid #FF6F59;background:none;color:#FF6F59;font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;">Delete</button>\';',
    '      html += \'</div>\';',
    '    });',
    '    html += \'<div id="mgrAlbumNoMatch" class="dp-empty" style="display:none;">No album matches that search.</div>\';',
    '    html += \'</div>\';',
    '    return html;',
    '  }',
    ''
  ].join('\n'));

splice('wireManageAlbums: search wiring, no auto controls',
  '  function wireManageAlbums(){',
  // A prefix, not the whole signature: a later edit in this same script adds its
  // argument, and an anchor that names the old signature stops matching on a rerun.
  '  function refreshManageAlbums(',
  [
    '  // The search box narrows the list on the rows that are already built — the',
    '  // buttons below are wired BY POSITION, so every row has to stay in the DOM and',
    '  // filtering only shows and hides them. The query is kept across a re-render,',
    '  // because renaming or deleting an album rebuilds this panel: losing what you',
    '  // typed half-way through a search would be worse than not searching at all.',
    '  var _mgrAlbumQuery = \'\';',
    '  function wireManageAlbums(){',
    '    var bEl = document.getElementById(\'discPopupBody\');',
    '    if(!bEl) return;',
    '    var names = (typeof visibleAlbumNames === \'function\') ? visibleAlbumNames() : Object.keys(userAlbums || {});',
    '    var sIn = bEl.querySelector(\'#mgrAlbumSearch\');',
    '    var sClr = bEl.querySelector(\'#mgrAlbumSearchClear\');',
    '    var sCount = bEl.querySelector(\'#mgrAlbumCount\');',
    '    var sEmpty = bEl.querySelector(\'#mgrAlbumNoMatch\');',
    '    function applyAlbumFilter(raw){',
    '      // The filter normalises the query itself, so a caller cannot forget to.',
    '      var q = String(raw || \'\').toLowerCase().trim();',
    '      var rows = bEl.querySelectorAll(\'.mgr-alb-row\');',
    '      var shown = 0;',
    '      Array.prototype.forEach.call(rows, function(r){',
    '        var hay = (r.getAttribute(\'data-name\') || \'\') + \' \' + (r.getAttribute(\'data-artist\') || \'\');',
    '        var hit = !q || hay.indexOf(q) !== -1;',
    '        r.style.display = hit ? \'flex\' : \'none\';',
    '        if(hit) shown++;',
    '      });',
    '      if(sCount){',
    '        sCount.textContent = q ? shown + \' of \' + rows.length + \' album\' + (rows.length === 1 ? \'\' : \'s\') : \'\';',
    '        sCount.style.display = q ? \'block\' : \'none\';',
    '      }',
    '      if(sEmpty) sEmpty.style.display = (q && !shown) ? \'block\' : \'none\';',
    '      if(sClr) sClr.style.display = q ? \'block\' : \'none\';',
    '    }',
    '    if(sIn){',
    '      sIn.addEventListener(\'input\', function(){',
    '        _mgrAlbumQuery = String(this.value || \'\');',
    '        applyAlbumFilter(_mgrAlbumQuery);',
    '      });',
    '      if(_mgrAlbumQuery) sIn.value = _mgrAlbumQuery;',
    '      applyAlbumFilter(_mgrAlbumQuery);',
    '    }',
    '    if(sClr){',
    '      sClr.addEventListener(\'click\', function(e){',
    '        e.stopPropagation();',
    '        if(sIn) sIn.value = \'\';',
    '        _mgrAlbumQuery = \'\';',
    '        applyAlbumFilter(\'\');',
    '        try{ if(sIn) sIn.focus(); }catch(_eF){}',
    '      });',
    '    }',
    '    Array.prototype.forEach.call(bEl.querySelectorAll(\'.mgr-alb-rename\'), function(btn){',
    '      btn.addEventListener(\'click\', function(e){',
    '        e.stopPropagation();',
    '        var name = names[parseInt(this.getAttribute(\'data-i\'), 10)];',
    '        if(name) renameUserAlbum(name);',
    '      });',
    '    });',
    '    Array.prototype.forEach.call(bEl.querySelectorAll(\'.mgr-alb-del\'), function(btn){',
    '      btn.addEventListener(\'click\', function(e){',
    '        e.stopPropagation();',
    '        var name = names[parseInt(this.getAttribute(\'data-i\'), 10)];',
    '        if(!name) return;',
    '        if(this.dataset.armed === \'1\'){ deleteUserAlbum(name); return; }',
    '        // Two taps instead of window.confirm(): the Android WebView can',
    '        // silently swallow confirm() (it returns false), which is what made',
    '        // this Delete button look broken.',
    '        this.dataset.armed = \'1\';',
    '        this.textContent = \'Tap to confirm\';',
    '        this.style.background = \'#FF6F59\';',
    '        this.style.color = \'#161616\';',
    '        var self = this;',
    '        setTimeout(function(){',
    '          if(self.dataset.armed !== \'1\') return;',
    '          self.dataset.armed = \'\';',
    '          self.textContent = \'Delete\';',
    '          self.style.background = \'none\';',
    '          self.style.color = \'#FF6F59\';',
    '        }, 4000);',
    '      });',
    '    });',
    '  }',
    ''
  ].join('\n'));

// Opening the panel is a fresh start: the query is dropped there, and kept only
// when the panel rebuilds itself in place (a rename or a delete), so what you typed
// mid-search is not thrown away under your finger.
splice('refreshManageAlbums: no "not created by you" subtitle',
  '  function refreshManageAlbums(){',
  '  // The artist an album is filed under: the one saved on the album entry, or the',
  [
    '  function refreshManageAlbums(keepQuery){',
    '    if(!keepQuery) _mgrAlbumQuery = \'\';   // a fresh open starts unfiltered',
    '    var names = (typeof visibleAlbumNames === \'function\') ? visibleAlbumNames() : Object.keys(userAlbums || {});',
    '    var _sub = names.length + \' album\' + (names.length !== 1 ? \'s\' : \'\');',
    '    openDiscoverPopup(\'Manage albums\', manageAlbumsHTML(), _sub);',
    '    wireManageAlbums();',
    '  }',
    ''
  ].join('\n'));

// The two editors that rebuild the panel in place tell it to keep the query.
sub('a rename keeps the search',
  "      dbPut('meta', { key: 'userAlbums', value: userAlbums });\n      renderList();\n      refreshManageAlbums();\n",
  "      dbPut('meta', { key: 'userAlbums', value: userAlbums });\n      renderList();\n      refreshManageAlbums(true);\n");

sub('a delete keeps the search',
  "    dbPut('meta', { key: 'userAlbums', value: userAlbums });\n    renderList();\n    refreshManageAlbums();\n",
  "    dbPut('meta', { key: 'userAlbums', value: userAlbums });\n    renderList();\n    refreshManageAlbums(true);\n");

// ------------------------------------------------------------------ other paths
splice('the picker comment',
  '    // The picker offers the albums in your library; the ones the app created by',
  'const backdrop = document.createElement(\'div\');',
  [
    '    // The picker offers the albums in your library — every one of them is an',
    '    // album you made, because the app no longer creates any on its own.',
    '    '
  ].join('\n'));

splice('the reorder sheet lists every album',
  '  // Build list of all album names for switching. Only the albums YOU made: an',
  '  // Create overlay',
  [
    '  // Every album in the store is one you made — the app no longer creates any on',
    '  // its own (removeAutoAlbums deletes the entries older builds wrote) — so the',
    '  // switch strip and every picker can offer all of them without a filter.',
    '  var allAlbumNames = Object.keys(userAlbums || {});',
    ''
  ].join('\n'));

// The backup import used to stamp the flagger's one-time marker so an imported
// album would not be flagged as auto. There is no flagger to fend off any more,
// and an entry that arrives wearing the flag is settled at the next boot by
// removeAutoAlbums().
sub('the import path stops stamping the dead marker',
  "        try{ localStorage.setItem('sidecut_albums_manual_v1', '1'); }catch(_eAlbFlag){}",
  "        // (No album-flag pass to fend off any more: an imported album keeps\n" +
  "        // whatever marker it came with, and the next boot settles it.)");

// The help screen still taught the old story: a second list of albums the app
// made for itself, kept under Manage albums. There is no such list any more.
sub('the help screen sentence',
  'Ones the app created for itself (an old auto-save, or a tag album from a reorder) stay out of the way under Manage albums',
  'Anything the app used to add on its own ' + EM + ' an old auto-save, or a tag album made so a reorder had somewhere to live ' + EM + ' is gone: those entries were removed, and the album tags on your songs are untouched');

// The picker's own list and its empty-library bail-out used to sit on the far side
// of the comment that was rewritten, so they are put back explicitly: pickUserAlbum
// still needs `names`, and a library with no albums still goes straight to naming
// a new one.
sub('the picker keeps its list and its guard',
  "    // album you made, because the app no longer creates any on its own.\n    const backdrop = document.createElement('div');",
  "    // album you made, because the app no longer creates any on its own.\n" +
  "    const names = (typeof visibleAlbumNames === 'function' ? visibleAlbumNames() : Object.keys(userAlbums)).sort();\n" +
  "    if(!names.length){ createAlbumFromIds(ids, sourceLabel, null); return; }\n" +
  "    const backdrop = document.createElement('div');");

fs.writeFileSync(FILE, src);
console.log('patch-658: ' + edits + ' index.html edit(s)');

// The import audit pinned the exact marker the deleted pass used to stamp, so it
// is repinned to the state that is true now: an import stamps nothing, and an
// imported album is not re-judged. ASCII needles only, because the message it
// asserts on carries an em dash in the middle of it.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to repin)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== before) fs.writeFileSync(p, t);
}
fileSub('dev/test-6052.mjs', [
  ["ok(A.lsData['sidecut_albums_manual_v1'] === '1',", "ok(!('sidecut_albums_manual_v1' in A.lsData),"],
  ["'one-time auto-album migration stamped ", "'the one-time album-flag pass is gone entirely "],
  [" a fresh install cannot re-judge and hide imported albums');", " so an import can no longer be re-judged and hidden as an auto album');"],
]);

// ---- verification ----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;

must(has('function removeAutoAlbums(){'), 'removeAutoAlbums() is installed');
must(has('window.__scRemoveAutoAlbums = removeAutoAlbums;'), 'and exposed for the audits');
must(!has('migrateAutoFlaggedAlbums'), 'the flagging pass is gone from the file');
must(!has('auto: true'), 'nothing writes the auto flag any more');
must(!has('sidecut_albums_manual_v1'), 'and its one-time marker is gone with it');
must(final.indexOf('_scAutoAlbums = removeAutoAlbums();') !== -1, 'boot deletes them');
must(!has('Not created by you ('), 'the Manage albums section title is gone');
must(!has('mgr-alb-restore') && !has('mgr-alb-rename-auto') && !has('mgr-alb-del-auto'),
  'and so are its three controls');
must(has('id="mgrAlbumSearch"'), 'Manage albums carries a search input');
must(has("bEl.querySelector('#mgrAlbumSearch')"), 'wired to the panel body');
must(has("sIn.addEventListener('input'"), 'and it filters as you type');
must(has("var q = String(raw || '').toLowerCase().trim();"), 'and normalises what it is given');
must(has("r.getAttribute('data-name')") && has('data-artist='), 'on album name and artist');
must(has('id="mgrAlbumNoMatch"'), 'with an honest empty state');
must(has('id="mgrAlbumCount"') && has("' of '"), 'and a match count');
must(has('#mgrAlbumSearchClear'), 'plus a clear button');
must(has('var _mgrAlbumQuery ='), 'the query survives a re-render');
must(has('function refreshManageAlbums(keepQuery){'), 'and is dropped on a fresh open');
must(final.split('refreshManageAlbums(true);').length - 1 === 2, 'the two in-place editors keep it');
must(has("const names = (typeof visibleAlbumNames === 'function' ? visibleAlbumNames() : Object.keys(userAlbums)).sort();"),
  'the Add-to-album picker still builds its list');
must(has("if(!names.length){ createAlbumFromIds(ids, sourceLabel, null); return; }"),
  'and still bails out of an empty library');

const blocks = final.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = 0;
blocks.forEach((b) => {
  const body = b.replace(/<\/?script[^>]*>/gi, '');
  if (!body.trim()) return;
  try { new Function(body); } catch (e) { bad++; console.log('  syntax error: ' + e.message); }
});
must(bad === 0, 'every inline script block still parses (' + bad + ' bad)');

if (problems.length) {
  console.error('patch-658 VERIFY FAILED:');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}
console.log('patch-658 verify: OK (auto albums deleted at boot, Manage albums searches)');
