#!/usr/bin/env node
/**
 * SideCut 70.1.5 - the four things the user reported, one release.
 *
 * The user's words: "listening streaks didn't transfer over and in albums add the
 * option to change the cover picture and in the search bar the actual regular one
 * there needs to be a clear button. And the add songs button the popup
 * specifically needs to be wider to not look weird."
 *
 * 1. THE STREAK THAT DID NOT COME BACK. This is the real bug, and it is the same
 * half-a-restore the play counters had in 70.1.4. The day streak is computed from
 * `listenedDates`, a Set of 'YYYY-MM-DD' strings held in the session AND mirrored
 * to a meta row. Both restore paths - the backup zip's full-state snapshot
 * (`__scSnapHydrate`) and its hand-written stats block - wrote the row straight to
 * storage and never touched the live Set. So an imported streak read as zero, and
 * worse, the first song played afterwards called recordListeningDay(), which saves
 * the (still empty) live Set plus today back over the row: the restored history
 * was destroyed by the next play. `scAdoptLiveStats` hands the restored values to
 * the session from both paths, and the best-ever streak travels with them.
 *
 * 2. AN ALBUM COVER YOU CAN SET. An album card drew the cover of its first song
 * and there was no way to say otherwise. `userAlbums[name].cover` is the override:
 * a small data URL on the album entry, so it rides in the meta row like the rest
 * of the album - which is what puts it in the backup zip and the on-device
 * snapshot, and keeps it across an update. A camera button on every album card
 * opens a picker: a picture from this device, or the cover of any song the album
 * already holds. Deliberately NOT a blob URL: those die with the page.
 *
 * 3. A CLEAR BUTTON ON THE LIBRARY SEARCH. The main search box is the one above
 * the playlist tabs; the only way back to the whole list was holding backspace
 * down. The X is shown by the stylesheet (:placeholder-shown) rather than by
 * script, so the several places that empty this field by hand cannot leave it
 * behind.
 *
 * 4. THE ADD SONGS SHEET IS WIDE. Five full-width buttons and the note about
 * export times were laid out in a 240px column, so every label was squeezed and
 * the note wrapped to a few words a line. It is a real sheet now.
 *
 *   node dev/patch-7015.mjs
 *   node dev/patch-7015.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO70 = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const VERSION = '70.1.5';
const PREV = '70.1.4';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 7:30 AM EDT';
const CACHE = 'sidecut-shell-v63.0.41';
const OLDCACHE = 'sidecut-shell-v63.0.40';
const TITLE = 'Your listening streak survives a restore, album covers are yours to set, the search box gets a clear button, and the Add songs sheet is wide enough for what is in it';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download" or "convert", and none uses "play build", "play
// version" or "play install" - test-662, test-6642 and test-66421 refuse those.
// One of them names a surface the 662 surface rule looks for (player, dock,
// Studio, premium, license).
const NOTES = [
  'Your listening streak comes back with a backup. The streak is the set of days you played something, and a restore wrote that set to storage without handing it to the session that had to use it - so the streak read as zero, and the next song you played saved a one-day set straight over the history that had just been restored. Both halves of the restore now put the live streak back in step.',
  'The best streak travels with it too. It is kept as its own number so a broken current streak cannot erase your record, and it arrived as zero on a restored library for the same reason. It is read back with the rest of your listening stats now.',
  'An album cover is yours to set. Album cards used the cover of the first song in them and nothing could change that: there is a camera button on every album card now, and it sets a picture from this device or reuses the cover of any song the album already holds. The same one tap removes it and goes back to the first song.',
  'The search box has a clear button. Typing in the library search puts an X on the right edge of the field, and one tap empties it and puts your whole list back - no holding backspace down until the box is empty again.',
  'The Add songs sheet is wide enough for what is in it. Five full-width buttons and the note about export times sat in a narrow column in the middle of the screen, so every label was squeezed and the note wrapped a few words to a line; it is a proper sheet now.',
  'Nothing else moved. The player, the dock, Studio, the badge wall and Donate are exactly as the last release left them - this one is the four fixes above and nothing more.',
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
  // A replacement that drops the newline the anchor had joins two lines
  // together, and the join parses. Refused here instead of found later.
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';
let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
const studio = holder(fs.readFileSync(STUDIO70, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7015: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ========================= 1. THE STREAK A RESTORE HAS TO HAND TO THE SESSION === */
// The live values, put back in step with the rows that were just written. Reads the
// same shape from both callers: a stats block writes manifest.stats and the
// full-state snapshot writes state.meta, and both carry listenedDates and
// longestStreak under those names.
sub(html, 'scAdoptLiveStats',
  '  function recordListeningDay(){\n',
  block([
    '  // 70.1.5. The day streak is this Set plus its meta row. A restore used to',
    '  // write only the row, which is half a restore twice over: the streak read as',
    '  // zero in the session that has to show it, and recordListeningDay() then saved',
    '  // the empty Set plus today back over the row - so the very next song played',
    '  // destroyed the history that had just been restored. Both restore paths hand',
    '  // the values they wrote to this, so the live streak is what the backup held.',
    '  function scAdoptLiveStats(src){',
    '    if(!src) return;',
    '    if(Array.isArray(src.listenedDates)) listenedDates = new Set(src.listenedDates);',
    "    if(typeof src.longestStreak === 'number') longestStreak = src.longestStreak;",
    '  }',
    '',
  ]) + '  function recordListeningDay(){\n',
  { key: 'function scAdoptLiveStats(' });

// The backup zip's stats block. Its rows are written a few lines above this call.
sub(html, 'the import stats hand-off',
  block([
    '        if(manifest.stats.longestStreak){',
    "          dbPut('meta', { key: 'longestStreak', value: manifest.stats.longestStreak });",
    '        }',
    '      }',
  ]),
  block([
    '        if(manifest.stats.longestStreak){',
    "          dbPut('meta', { key: 'longestStreak', value: manifest.stats.longestStreak });",
    '        }',
    '        // 70.1.5. The rows are in - now put the LIVE streak in step with them,',
    '        // or the streak reads as zero and the next play overwrites the history',
    '        // that was just restored. (The play counters had this same half-restore.)',
    '        scAdoptLiveStats(manifest.stats);',
    '      }',
  ]),
  { key: 'scAdoptLiveStats(manifest.stats);' });

// And the full-state snapshot, for a zip whose stats block predates the fields it
// carries. A snapshot restore at boot reloads the page, so this only matters for
// the import path - which is exactly the path that had the bug.
sub(html, 'the snapshot hand-off',
  block([
    '      if(state.meta){',
    "        for(var mk in state.meta){ try{ await dbPut('meta', { key: mk, value: state.meta[mk] }); }catch(e){} }",
    '      }',
  ]),
  block([
    '      if(state.meta){',
    "        for(var mk in state.meta){ try{ await dbPut('meta', { key: mk, value: state.meta[mk] }); }catch(e){} }",
    '        // 70.1.5 - the row is not the streak on its own: the session computes it',
    '        // from the Set. Hand the restored values over with the rows.',
    '        try{ scAdoptLiveStats(state.meta); }catch(_eSnapStats){ }',
    '      }',
  ]),
  { key: 'scAdoptLiveStats(state.meta);' });

/* ============================================== 2. THE ALBUM COVER YOU CAN SET === */
// The override and the picker that sets it. Placed with the other album tools.
sub(html, 'the album cover picker',
  '  function openAlbumPickerForReorder(){\n',
  block([
    '  // 70.1.5. An album card shows the cover of the first song in it, and there was',
    '  // no way to say otherwise. userAlbums[name].cover is that override: a small',
    '  // data URL kept on the album entry, so it rides in the meta row like every',
    '  // other album field - which is what puts it in the backup zip and the',
    '  // on-device snapshot, and keeps it across an update. A blob URL would not do:',
    '  // those die with the page, and the cover has to still be there on the next boot.',
    '  function albumCoverDataUrl(name){',
    "    try{ return String((userAlbums[name] && userAlbums[name].cover) || ''); }catch(_eAC){ return ''; }",
    '  }',
    '  function closeAlbumCover(){',
    "    const m = document.getElementById('albumCoverBackdrop');",
    '    if(m) m.remove();',
    '  }',
    '  function applyAlbumCover(name, dataUrl){',
    '    if(!name) return;',
    '    try{',
    '      if(!userAlbums[name]) userAlbums[name] = { trackIds: [], createdAt: Date.now() };',
    '      if(dataUrl) userAlbums[name].cover = dataUrl;',
    '      else delete userAlbums[name].cover;',
    "      dbPut('meta', { key: 'userAlbums', value: userAlbums });",
    '      renderList();',
    "      toast(dataUrl ? 'Album cover saved.' : 'Back to the cover of its first song.', 2600);",
    "    }catch(e){ console.error('album cover save failed:', e); toast('Could not save that picture.', 3000); }",
    '  }',
    '  // One picture in, one small cover out. Whatever was picked - a camera photo or',
    '  // a cover already in the library - is drawn to at most 512px on its long edge',
    '  // and encoded as a JPEG, because this value lives in a meta row that every',
    '  // backup and every snapshot copy carries. `fallback` is used when the picture',
    '  // cannot be drawn - a data URL that is already usable is still a cover.',
    '  function albumCoverFromImage(name, srcUrl, fallback){',
    '    try{',
    '      const img = new Image();',
    '      img.onload = function(){',
    "        let out = '';",
    '        try{',
    '          const s = Math.min(1, 512 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));',
    '          const w = Math.max(1, Math.round((img.naturalWidth || 512) * s));',
    '          const h = Math.max(1, Math.round((img.naturalHeight || 512) * s));',
    "          const cv = document.createElement('canvas');",
    '          cv.width = w; cv.height = h;',
    "          cv.getContext('2d').drawImage(img, 0, 0, w, h);",
    "          out = cv.toDataURL('image/jpeg', 0.78);",
    "        }catch(_ce){ out = ''; }",
    '        if(out && out.length > 64) applyAlbumCover(name, out);',
    '        else if(fallback) applyAlbumCover(name, fallback);',
    "        else toast('Could not read that picture.', 3000);",
    '        closeAlbumCover();',
    '      };',
    '      img.onerror = function(){',
    '        if(fallback) applyAlbumCover(name, fallback);',
    "        else toast('Could not read that picture.', 3000);",
    '        closeAlbumCover();',
    '      };',
    '      img.src = srcUrl;',
    "    }catch(e){ toast('Could not read that picture.', 3000); }",
    '  }',
    '  function albumCoverModal(name){',
    '    try{',
    '      if(!name || !userAlbums[name]) return;',
    '      closeAlbumCover();',
    '      const cur = albumCoverDataUrl(name);',
    '      // The cover of any song the album already holds, offered beside the file',
    '      // picker: the sleeve wanted is usually one that is already in the library.',
    '      const picks = [];',
    "      ((userAlbums[name] && userAlbums[name].trackIds) || []).forEach(function(id){",
    '        const t = allTracks.find(function(x){ return x.id === id; });',
    '        if(t && t.artUrl && picks.indexOf(t.artUrl) === -1) picks.push(t.artUrl);',
    '      });',
    '      const grid = picks.length',
    "        ? '<div style=\"font-size:12px;color:var(--ink-dim);\">Or use the cover of a song in this album:</div>'",
    "          + '<div style=\"display:grid;grid-template-columns:repeat(4,1fr);gap:6px;\">'",
    '          + picks.slice(0, 24).map(function(u, i){',
    `              return '<div class="alb-cover-pick" data-i="' + i + '" style="width:100%;aspect-ratio:1;border-radius:8px;background-image:url(' + u.replace(/"/g, '&quot;') + ');background-size:cover;background-position:center;border:2px solid ' + (u === cur ? 'var(--coral)' : 'var(--line)') + ';cursor:pointer;"></div>';`,
    "            }).join('') + '</div>'",
    "        : '';",
    "      const modal = document.createElement('div');",
    "      modal.id = 'albumCoverBackdrop';",
    "      modal.className = 'modal-backdrop';",
    "      modal.style.display = 'flex';",
    `      modal.innerHTML = '<div class="modal" style="gap:12px;">'`,
    `        + '<h3 style="font-size:15px;margin:0;">Album cover</h3>'`,
    `        + '<div style="font-size:12px;color:var(--ink-dim);word-break:break-word;">' + escapeHtml(name) + '</div>'`,
    `        + '<button id="albCoverFile" style="width:100%;padding:12px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--ink);font-size:13px;cursor:pointer;text-align:left;">&#128247; Choose a picture</button>'`,
    `        + grid`,
    `        + (cur ? '<button id="albCoverClear" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:12px;cursor:pointer;">Remove custom cover</button>' : '')`,
    `        + '<button id="albCoverCancel" style="width:100%;padding:10px;border-radius:10px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:12px;cursor:pointer;">Cancel</button>'`,
    `        + '</div>';`,
    '      document.body.appendChild(modal);',
    `      const fileBtn = modal.querySelector('#albCoverFile');`,
    `      if(fileBtn) fileBtn.addEventListener('click', function(){`,
    "        const input = document.createElement('input');",
    "        input.type = 'file';",
    "        input.accept = 'image/*';",
    "        input.style.display = 'none';",
    '        document.body.appendChild(input);',
    `        input.addEventListener('change', function(){`,
    '          try{',
    '            if(input.files && input.files[0]){',
    '              const file = input.files[0];',
    '              const reader = new FileReader();',
    "              reader.onload = function(){ albumCoverFromImage(name, String(reader.result || ''), ''); };",
    "              reader.onerror = function(){ toast('Could not read that picture.', 3000); };",
    '              reader.readAsDataURL(file);',
    '            } else if(input.parentNode) input.parentNode.removeChild(input);',
    '          }catch(_eCF){ }',
    '        });',
    '        input.click();',
    '      });',
    `      Array.prototype.forEach.call(modal.querySelectorAll('.alb-cover-pick'), function(el){`,
    `        el.addEventListener('click', function(){`,
    `          const u = picks[parseInt(el.getAttribute('data-i'), 10)];`,
    `          if(u) albumCoverFromImage(name, u, '');`,
    '        });',
    '      });',
    `      const clr = modal.querySelector('#albCoverClear');`,
    `      if(clr) clr.addEventListener('click', function(){ applyAlbumCover(name, ''); closeAlbumCover(); });`,
    `      const cancel = modal.querySelector('#albCoverCancel');`,
    `      if(cancel) cancel.addEventListener('click', closeAlbumCover);`,
    `      modal.addEventListener('click', function(e){ if(e.target === modal) closeAlbumCover(); });`,
    "    }catch(e){ console.error('album cover picker failed:', e); }",
    '  }',
    '',
  ]) + '  function openAlbumPickerForReorder(){\n',
  { key: 'function albumCoverModal(' });

// The card draws the override when there is one, and the first song's art when
// there is not - the same fallback order the picker previews.
sub(html, 'the card cover',
  "cover: (firstTrack && firstTrack.artUrl) ? firstTrack.artUrl : '' };",
  "cover: (ua.cover || ((firstTrack && firstTrack.artUrl) ? firstTrack.artUrl : '')) };",
  { key: 'cover: (ua.cover || ' });

sub(html, 'the camera on the card',
  "          + '<span style=\"font-size:11px;color:var(--ink-dim);flex-shrink:0;\">' + alb.tracks.length + ' track' + (alb.tracks.length !== 1 ? 's' : '') + '</span>'\n",
  "          + '<span style=\"font-size:11px;color:var(--ink-dim);flex-shrink:0;\">' + alb.tracks.length + ' track' + (alb.tracks.length !== 1 ? 's' : '') + '</span>'\n" +
  "          + '<button class=\"alb-cover-btn\" title=\"Change album cover\" aria-label=\"Change album cover\" style=\"flex-shrink:0;width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink-dim);font-size:12px;line-height:1;cursor:pointer;padding:0;\">&#128247;</button>'\n",
  { key: 'alb-cover-btn' });

// The button must not also toggle the card, which is what a click on the header
// does. The long-press drag already ignores a <button>, so holding it is safe.
sub(html, 'the camera wiring',
  "        hdr.addEventListener('click', function(){\n",
  block([
    "        var _covBtn = hdr.querySelector('.alb-cover-btn');",
    '        if(_covBtn){',
    "          _covBtn.addEventListener('click', function(ev){",
    '            ev.stopPropagation(); // the camera is not the expand/collapse tap',
    '            albumCoverModal(aName);',
    '          });',
    '        }',
  ]) + "        hdr.addEventListener('click', function(){\n",
  { key: 'albumCoverModal(aName);' });

/* ==================================== 3. THE CLEAR BUTTON ON THE SEARCH BOX === */
// Shown by the field itself rather than by script: several places empty this box by
// hand (an import, a tab change, a fresh pick), and a flag kept by script would be
// left behind by whichever one forgot. :placeholder-shown is exactly "empty".
sub(html, 'the clear button css',
  block([
    '.add-songs-menu{',
    '  display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:200;',
    '  min-width:240px; max-width:calc(100vw - 32px); padding:10px; gap:6px; flex-direction:column;',
  ]),
  block([
    "/* 70.1.5 - the clear button on the library search box. It is shown by the",
    "   field's own state, not by script: :placeholder-shown IS \"empty\", so the X",
    '   cannot be left behind by one of the several places that empty this box. */',
    '#searchClearBtn{',
    '  display:none; position:absolute; right:10px; top:50%; transform:translateY(-50%);',
    '  width:22px; height:22px; border-radius:50%; border:none; background:rgba(255,255,255,0.12);',
    '  color:var(--ink-dim); font-size:13px; line-height:1; cursor:pointer; padding:0;',
    '  align-items:center; justify-content:center;',
    '}',
    '#searchInput:not(:placeholder-shown) + #searchClearBtn{ display:flex; }',
    '.add-songs-menu{',
    '  display:none; position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); z-index:200;',
    '  width:440px; max-width:calc(100vw - 32px); padding:12px; gap:6px; flex-direction:column;',
  ]),
  { key: '#searchInput:not(:placeholder-shown) + #searchClearBtn' });

// Wide screens: the sheet gets a little more room rather than a min-width that the
// five labels then had to fit inside.
sub(html, 'the wide-screen sheet',
  '  .add-songs-menu{ min-width:260px; }\n',
  '  .add-songs-menu{ width:520px; max-width:calc(100vw - 48px); }\n',
  { key: '  .add-songs-menu{ width:520px;' });

sub(html, 'the search field markup',
  block([
    '  <div style="padding: 6px 20px 12px;">',
    '    <input type="text" id="searchInput" placeholder="Search songs or artists\u2026"',
    '      style="width:100%; background:var(--bg-raised); border:1px solid var(--line); color:var(--ink);',
    '      border-radius:20px; padding:9px 14px; font-size:13.5px; font-family:var(--font-ui);">',
    '  </div>',
  ]),
  block([
    '  <div style="padding: 6px 20px 12px;">',
    '  <div style="position:relative;">',
    '    <input type="text" id="searchInput" placeholder="Search songs or artists\u2026"',
    '      style="width:100%; background:var(--bg-raised); border:1px solid var(--line); color:var(--ink);',
    '      border-radius:20px; padding:9px 38px 9px 14px; font-size:13.5px; font-family:var(--font-ui);">',
    '    <button id="searchClearBtn" type="button" aria-label="Clear search" title="Clear">&#215;</button>',
    '  </div>',
    '  </div>',
  ]),
  { key: 'id="searchClearBtn"' });

// The wide-screen override of the field's padding has to leave the X its room.
sub(html, 'the wide-screen field padding',
  '  #searchInput{ padding:11px 16px; font-size:14px; }\n',
  '  #searchInput{ padding:11px 38px 11px 16px; font-size:14px; }\n',
  { key: '#searchInput{ padding:11px 38px 11px 16px;' });

sub(html, 'the clear button wiring',
  block([
    "  $('searchInput').addEventListener('input', (e) => {",
    '    searchQuery = e.target.value.trim().toLowerCase();',
    '    renderList();',
    '  });',
  ]),
  block([
    "  $('searchInput').addEventListener('input', (e) => {",
    '    searchQuery = e.target.value.trim().toLowerCase();',
    '    renderList();',
    '  });',
    '  // 70.1.5. The library search box had no way back to the whole list but holding',
    '  // backspace down until it was empty. The X is only drawn while there is',
    '  // something to clear (see the stylesheet), and one tap empties the field, the',
    '  // query and the list together and puts the cursor back where it was.',
    "  $('searchClearBtn').addEventListener('click', () => {",
    "    const si = $('searchInput');",
    "    if(si) si.value = '';",
    "    searchQuery = '';",
    '    renderList();',
    '    try{ if(si) si.focus(); }catch(_eSC){ }',
    '  });',
  ]),
  { key: "  $('searchClearBtn').addEventListener" });

/* ===================================================== 4. THE RELEASE METADATA === */
sub(html, 'APP_VERSION',
  "  const APP_VERSION = '" + PREV + "';",
  "  const APP_VERSION = '" + VERSION + "';",
  { key: "const APP_VERSION = '" + VERSION + "';" });

sub(html, 'changelog head',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ]) + NOTES.map((n) => "    '" + n + "',").join('\n') + '\n  ] },\n',
  { key: "const CHANGELOG = [\n  { version: '" + VERSION + "'" });

sub(sw, 'shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';",
  "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ==================================================================== 5. THE GATES === */
sub(t705, 'test-705 the four fixes',
  "console.log('\\n[11] the file still holds together');\n",
  block([
    "console.log('\\n[10b] the streak, the album cover, the search box and the sheet');",
    '{',
    '  // 70.1.5. Four reported defects, one rule each. The streak rules are the',
    '  // whole point: the failure was a restore that wrote the meta row and never',
    '  // handed it to the running session, so BOTH paths in have to be asserted,',
    '  // not just the presence of the row.',
    "  ok(count('function scAdoptLiveStats(') === 1 && count('scAdoptLiveStats(manifest.stats);') === 1 &&",
    "     count('scAdoptLiveStats(state.meta);') === 1,",
    "     'a restored listening streak is handed to the running session, both ways in');",
    "  ok(count('function albumCoverModal(') === 1 && count('function applyAlbumCover(') === 1 &&",
    "     count('alb-cover-btn') >= 1,",
    "     'an album cover can be changed from its card');",
    "  ok(count('searchClearBtn') >= 3 &&",
    "     count('#searchInput:not(:placeholder-shown) + #searchClearBtn') === 1,",
    "     'the library search box has a clear button the field itself shows');",
    "  ok(count('width:440px; max-width:calc(100vw - 32px)') === 1,",
    "     'the Add songs sheet is wide enough for its five buttons');",
    '}',
    '',
  ]) + "console.log('\\n[11] the file still holds together');\n",
  { key: '[10b] the streak, the album cover, the search box and the sheet' });

// Driven for real in the probe: the clear button is the one of the four that can be
// exercised without a layout engine or a clock. jsdom does not implement
// :placeholder-shown, which is exactly why the button is not hidden by an inline
// style - the stylesheet decides whether it is drawn, and the wiring is driven here.
sub(studio, 'studio-70 the four fixes',
  "  console.log('[12] the page still holds together');\n",
  block([
    "  console.log('[11h] the search box clears, and the sheet and the cover are real');",
    '  {',
    '    // 70.1.5 - "in the search bar the actual regular one there needs to be a',
    '    // clear button". Driven here: type, watch the list narrow to the match, tap',
    '    // the X, and require the field, the query and the whole list back.',
    "    doc.querySelector('#libraryBtn').click();",
    '    await wait(120);',
    "    const si = doc.querySelector('#searchInput');",
    "    const x = doc.querySelector('#searchClearBtn');",
    "    ok(!!si && !!x, 'the library search box has a clear button beside it');",
    "    ok(html.indexOf('#searchInput:not(:placeholder-shown) + #searchClearBtn') !== -1,",
    "      'and the stylesheet is what decides whether it is shown');",
    '    if (si && x) {',
    "      si.value = 'song 3';",
    "      si.dispatchEvent(new win.Event('input', { bubbles: true }));",
    '      await wait(140);',
    '      const narrowed = doc.querySelectorAll(\'#listPane .track\').length;',
    "      ok(narrowed > 0 && narrowed < TRACKS.length, 'typing narrows the list (' + narrowed + ' of ' + TRACKS.length + ')');",
    '      x.click();',
    '      await wait(140);',
    "      ok(si.value === '', 'tapping the X empties the field');",
    "      ok(doc.querySelectorAll('#listPane .track').length === TRACKS.length,",
    "        'and puts the whole list back (' + doc.querySelectorAll('#listPane .track').length + ')');",
    '    }',
    '    // The album cover and the sheet are markup this release adds. The picker is',
    '    // only reachable from an album card and a card only exists once an album does,',
    '    // so what is required here is that both halves shipped and the card is wired.',
    "    ok(html.indexOf('albumCoverModal(aName);') !== -1 && html.indexOf('albumCoverBackdrop') !== -1,",
    "      'and an album card can open the cover picker');",
    "    ok(html.indexOf('width:440px; max-width:calc(100vw - 32px)') !== -1,",
    "      'with the Add songs sheet wide enough for its buttons');",
    '  }',
    '',
  ]) + "  console.log('[12] the page still holds together');\n",
  { key: '[11h] the search box clears, and the sheet and the cover are real' });

/* ============================================================ 6. WHAT MUST STILL HOLD === */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The streak fix has to be complete: every path that restores the days must hand
  // them over, and the live values must still be the ones the recorder writes back.
  must(count(page, 'function scAdoptLiveStats(') === 1 &&
    count(page, 'scAdoptLiveStats(manifest.stats);') === 1 &&
    count(page, 'scAdoptLiveStats(state.meta);') === 1,
    'a restore still leaves the live listening streak empty');
  must(count(page, "dbPut('meta', { key: 'listenedDates', value: Array.from(listenedDates) });") === 3 &&
    count(page, "const listenedDatesRow = metaRows.find(r => r.key === 'listenedDates');") === 1,
    'the live Set is no longer the one the app records days into');
  must(count(page, "dbPut('meta', { key: 'longestStreak', value: longestStreak });") === 2,
    'the best streak is no longer written from the live value');

  // The album cover.
  must(count(page, 'function albumCoverModal(') === 1 && count(page, 'function applyAlbumCover(') === 1 &&
    count(page, 'function albumCoverFromImage(') === 1 && count(page, 'function albumCoverDataUrl(') === 1,
    'the album cover picker is not all there');
  must(count(page, "cover: (ua.cover || ((firstTrack && firstTrack.artUrl) ? firstTrack.artUrl : '')) };") === 1,
    'the album card does not draw the cover the user set');
  must(count(page, 'userAlbums[name].cover = dataUrl;') === 1 &&
    count(page, 'delete userAlbums[name].cover;') === 1,
    'the album cover is not saved to the album entry');
  must(count(page, 'albumCoverModal(aName);') === 1 &&
    count(page, 'ev.stopPropagation(); // the camera is not the expand/collapse tap') === 1,
    'the camera on the card is not wired, or it also toggles the card');

  // The search clear button.
  must(count(page, 'id="searchClearBtn"') === 1 &&
    count(page, '#searchInput:not(:placeholder-shown) + #searchClearBtn{ display:flex; }') === 1,
    'the search box has no clear button, or it is not shown by the field itself');
  must(count(page, "$('searchClearBtn').addEventListener('click'") === 1 &&
    count(page, "    searchQuery = '';\n    renderList();\n    try{ if(si) si.focus(); }") === 1,
    'the clear button does not empty the query and the list');
  must(count(page, '#searchInput{ padding:11px 38px 11px 16px; font-size:14px; }') === 1,
    'the wide-screen field padding has no room for the clear button');

  // The sheet.
  must(count(page, 'min-width:240px; max-width:calc(100vw - 32px)') === 0,
    'the narrow Add songs sheet is still in the stylesheet');
  must(count(page, 'width:440px; max-width:calc(100vw - 32px); padding:12px; gap:6px;') === 1 &&
    count(page, '.add-songs-menu{ width:520px; max-width:calc(100vw - 48px); }') === 1,
    'the Add songs sheet is not the wider one');
  must(count(page, 'id="addSongsMenu"') === 1 && count(page, 'id="exportLibBtn"') === 1 &&
    count(page, 'id="importLibBtn"') === 1,
    'the Add songs sheet lost one of its buttons');

  // The release itself.
  must(count(page, "const APP_VERSION = '70.1.5';") === 1, 'the version is not 70.1.5');
  must(count(page, "  { version: '70.1.5',") === 1 && count(page, "  { version: '70.1.4',") === 1 &&
    count(page, "  { version: '70.1.3',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, '[10b] the streak, the album cover, the search box and the sheet') === 1,
    'the new gate rules did not land');
  must(count(studio.text, '[11h] the search box clears, and the sheet and the cover are real') === 1,
    'the real-app probe does not drive the clear button');
  must(count(page, 'function exportLibrary(') === 1 && count(page, 'function importLibrary(') === 1,
    'the two backup paths left with the release');
}

if(problems.length){
  console.error('patch-7015: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7015: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7015: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7015: next `node dev/repin-7015.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
