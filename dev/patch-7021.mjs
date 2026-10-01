#!/usr/bin/env node
/**
 * SideCut 70.2.1 - the album cover camera moves into Manage albums.
 *
 * The user's words: "The camera button for setting the image should be in manage
 * albums not next to the actual album in the album row like it is in the
 * screenshot."
 *
 * 70.1.5 put the camera on the album card itself, in the header row, and it was a
 * defensible place for it right up until the row was used. The header IS the tap
 * that opens and closes the album, so the camera sat inside the tap target - one
 * stray press either opened the album cover picker instead of the album or, more
 * often, did nothing the user asked for because they were aiming at the chevron.
 * Manage albums already owns the per-album controls (Rename, Delete, the search
 * box, the ordering), so the camera belongs beside them and the card header goes
 * back to being one thing: the row that opens the album.
 *
 * WHAT MOVED, EXACTLY
 *   * index.html, the album card header: the `.alb-cover-btn` button is gone, and
 *     so is the `_covBtn` handler that opened the picker from it. The header is
 *     the chevron, the cover, the name, the artist, the runtime and the track
 *     count again - nothing else.
 *   * index.html, `manageAlbumsHTML()`: every row grows a `.mgr-alb-cover` camera
 *     button, ahead of Rename and Delete, built from the same row index those two
 *     already use (`data-i`) so it resolves the album the same way they do.
 *   * index.html, `wireManageAlbums()`: wired next to the existing Rename wiring,
 *     by position over `names`, so a row that is filtered out of view still has a
 *     working button when the search is cleared.
 *
 * THE ONE THING THAT WOULD HAVE MADE THIS LOOK BROKEN
 * The picker is `albumCoverModal()`, which appends a bare `.modal-backdrop` to
 * `document.body` - and a bare `.modal-backdrop` is `z-index:60`, while the
 * Discover popup that Manage albums lives in is `z-index:70`. Opened from this
 * panel it would have appeared BEHIND the list it was opened from, i.e. a tap
 * that did nothing. The modal is raised above the popup (10001, the same level
 * `#artistPromptBackdrop` already uses) so the picker stacks over the panel.
 * Nothing else about the picker changed: the same "choose a picture", the same
 * covers from songs in the album, the same remove, the same save path.
 *
 * ASSERTED IN THE GATES
 * dev/test-705.mjs `[10b]` is the structural half: the class is gone from the card
 * and present in the Manage albums row, and the row is wired. dev/studio-70-check.cjs
 * `[11h]` is the real-app half and now pins WHERE the picker is reached from,
 * because jsdom cannot resolve the z-index that makes the tap land.
 *
 *   node dev/patch-7021.mjs
 *   node dev/patch-7021.mjs --check   # report only
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
const VERSION = '70.2.1';
const PREV = '70.2.0';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 6:43 PM EDT';
const CACHE = 'sidecut-shell-v63.0.47';
const OLDCACHE = 'sidecut-shell-v63.0.46';
const TITLE = 'The camera that sets an album cover moves into Manage albums';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), and none may read as a music downloader on the WIDER list
// dev/test-play-copy.mjs audits the store build against - which includes the word
// mp3, download, convert, "get song", "save the file" and "hand-off". test-662,
// test-6642 and test-66421 refuse the same words, plus "play build", "play
// version" and "play install". Notes 5 and 6 name surfaces the 662 rule looks for.
const NOTES = [
  'The camera that sets an album cover lives in Manage albums now. It used to sit on the album card in the album list, right beside the name, where it shared the row with the tap that opens the album - so aiming for the chevron could land on the camera instead.',
  'Every album listed in Manage albums carries its own cover button, beside Rename and Delete, so the picture is set from the same panel that already renames and deletes an album.',
  'Setting a cover works exactly as it did. Take a picture from this device, reuse the cover of any song the album already holds, or remove a custom cover and fall back to the cover of its first song.',
  'The album card is cleaner for it. The chevron, the cover picture, the name, the artist, the total runtime and the track count are what is left, and the whole header is still the one tap that opens the album.',
  'The player, the dock, the library list and Studio are exactly as the release before this one left them. Nothing about playback, the queue or the equalizer changed.',
  'Album covers you already set are untouched, and a library saved before this release comes back the same. Covers still ride in a backup and still survive an update.',
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
  console.log('patch-7021: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

// The guard both removals key on, and the markup the later sub in this patch
// adds. A removal has no text of its own to key on, so the phrase has to be one
// the RELEASE introduces: absent before it, present after it - and, because the
// sub that writes it runs after these two, it cannot skip them.
const MOVED_KEY = 'class="mgr-alb-cover"';

/* ================= A. THE CAMERA LEAVES THE ALBUM CARD ====================== */
// The button was the last operand of the header's innerHTML chain, so removing
// the whole line leaves the `</span>` before it as the end of the chain.
sub(html, 'the camera leaves the album card header',
  "          + '<button class=\"alb-cover-btn\" title=\"Change album cover\" aria-label=\"Change album cover\" style=\"flex-shrink:0;width:28px;height:28px;border-radius:9px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink-dim);font-size:12px;line-height:1;cursor:pointer;padding:0;\">&#128247;</button>'\n",
  '',
  { key: MOVED_KEY });

// The handler that opened the picker from it goes with it - a listener with no
// element is dead code, and the wiring is what a future edit would copy from.
sub(html, 'and its handler with it',
  block([
    "        var _covBtn = hdr.querySelector('.alb-cover-btn');",
    '        if(_covBtn){',
    "          _covBtn.addEventListener('click', function(ev){",
    '            ev.stopPropagation(); // the camera is not the expand/collapse tap',
    '            albumCoverModal(aName);',
    '          });',
    '        }',
  ]),
  '',
  { key: MOVED_KEY });

/* ============ B. THE CAMERA ARRIVES IN MANAGE ALBUMS, BESIDE RENAME ========= */
// Built from the same row index Rename and Delete already use, so the button
// resolves the album through `names` exactly the way they do, and a row that the
// search has hidden keeps a working button.
sub(html, 'the camera button lands on the Manage albums row',
  "      html += '<button class=\"mgr-alb-rename\" data-i=\"' + i + '\" style=\"padding:5px 10px;border-radius:6px;border:1px solid var(--line);background:none;color:var(--ink);font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;\">Rename</button>';\n",
  block([
    "      html += '<button class=\"mgr-alb-cover\" data-i=\"' + i + '\" title=\"Set album cover\" aria-label=\"Set album cover\" style=\"flex-shrink:0;width:28px;height:28px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:13px;line-height:1;cursor:pointer;padding:0;\">&#128247;</button>';",
    "      html += '<button class=\"mgr-alb-rename\" data-i=\"' + i + '\" style=\"padding:5px 10px;border-radius:6px;border:1px solid var(--line);background:none;color:var(--ink);font-size:11px;font-weight:600;cursor:pointer;flex-shrink:0;\">Rename</button>';",
  ]),
  { key: MOVED_KEY });

// Wired next to Rename, for the same reason: one place per row, resolved through
// `names` by index, never through the rendered text.
sub(html, 'and the row is wired',
  "    Array.prototype.forEach.call(bEl.querySelectorAll('.mgr-alb-rename'), function(btn){\n",
  block([
    "    Array.prototype.forEach.call(bEl.querySelectorAll('.mgr-alb-cover'), function(btn){",
    "      btn.addEventListener('click', function(e){",
    '        e.stopPropagation();',
    "        var name = names[parseInt(this.getAttribute('data-i'), 10)];",
    '        if(name) albumCoverModal(name);',
    '      });',
    '    });',
    "    Array.prototype.forEach.call(bEl.querySelectorAll('.mgr-alb-rename'), function(btn){",
  ]),
  { key: "bEl.querySelectorAll('.mgr-alb-cover')" });

/* ============ C. THE PICKER HAS TO STACK ABOVE THE PANEL IT OPENS FROM ====== */
// Without this the tap does nothing visible: .modal-backdrop is z-index 60 and
// the Discover popup this is opened from is z-index 70, so the modal renders
// underneath the list. 10001 is the level #artistPromptBackdrop already uses.
sub(html, 'the picker stacks over the Discover popup',
  "      modal.innerHTML = '<div class=\"modal\" style=\"gap:12px;\">'\n",
  block([
    '      // 70.2.1. Opened from Manage albums now, which is a Discover popup at',
    '      // z-index 70 - above the 60 a bare .modal-backdrop gets - so without',
    '      // this the picker opened BEHIND the list it was opened from and the tap',
    '      // read as doing nothing. Raised above it, at the level the artist prompt',
    '      // backdrop already uses. Nothing else about the picker moved.',
    "      modal.style.zIndex = '10001';",
    "      modal.innerHTML = '<div class=\"modal\" style=\"gap:12px;\">'",
  ]),
  { key: "modal.style.zIndex = '10001';" });

/* ==================== D. THE RELEASE ======================================= */
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

/* ================================ E. THE GATES ============================== */
// test-705 is the standing 70.x gate: the structural half of the same claim.
sub(t705, 'test-705 the camera home',
  block([
    "  ok(count('function albumCoverModal(') === 1 && count('function applyAlbumCover(') === 1 &&",
    "     count('alb-cover-btn') >= 1,",
    "     'an album cover can be changed from its card');",
  ]),
  block([
    "  // 70.2.1. The camera moved off the album card and into Manage albums: the",
    "  // card header no longer carries it (it shared the row with the tap that opens",
    "  // the album), and every row in Manage albums has its own cover button.",
    "  ok(count('function albumCoverModal(') === 1 && count('function applyAlbumCover(') === 1 &&",
    "     count('alb-cover-btn') === 0 && count('class=\"mgr-alb-cover\"') === 1 &&",
    "     count(\"bEl.querySelectorAll('.mgr-alb-cover')\") === 1,",
    "     'an album cover is changed from Manage albums, not from the album row');",
  ]),
  { key: 'an album cover is changed from Manage albums' });

// The real-app probe: it cannot resolve a z-index, so what it pins is where the
// picker is reached from, which is the half a refactor would move again.
sub(studio, 'studio-70 the camera home',
  block([
    '    // The album cover and the sheet are markup this release adds. The picker is',
    '    // only reachable from an album card and a card only exists once an album does,',
    '    // so what is required here is that both halves shipped and the card is wired.',
    "    ok(html.indexOf('albumCoverModal(aName);') !== -1 && html.indexOf('albumCoverBackdrop') !== -1,",
    "      'and an album card can open the cover picker');",
  ]),
  block([
    '    // The album cover picker is markup 70.1.5 added, and 70.2.1 moved the camera',
    '    // off the album card into Manage albums. Driving it needs an album to exist,',
    '    // so what is pinned here is where it is reached from: the row button in',
    '    // Manage albums, and never the album header again.',
    "    ok(html.indexOf('albumCoverBackdrop') !== -1 &&",
    "      html.indexOf(\"bEl.querySelectorAll('.mgr-alb-cover')\") !== -1 &&",
    "      html.indexOf('alb-cover-btn') === -1,",
    "      'and the cover picker is reached from Manage albums, not the album row');",
  ]),
  { key: 'the cover picker is reached from Manage albums' });

/* ================================= F. WHAT MUST STILL HOLD ================== */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The move itself.
  must(count(page, 'alb-cover-btn') === 0, 'the camera is still on the album card');
  must(count(page, "var _covBtn = hdr.querySelector('.alb-cover-btn');") === 0,
    'the album card still wires a camera it no longer has');
  must(count(page, 'class="mgr-alb-cover"') === 1 && count(page, "bEl.querySelectorAll('.mgr-alb-cover')") === 1,
    'the Manage albums row does not carry the camera, or is not wired');
  must(page.indexOf("bEl.querySelectorAll('.mgr-alb-cover')") <
    page.indexOf("bEl.querySelectorAll('.mgr-alb-rename')"),
    'the camera wiring does not sit with the Rename wiring it mirrors');
  must(count(page, 'if(name) albumCoverModal(name);') === 1 &&
    count(page, 'albumCoverModal(aName);') === 0,
    'the Manage albums row does not open the picker, or the old call survived');
  must(count(page, "modal.style.zIndex = '10001';") === 1,
    'the picker is not raised above the Discover popup it is opened from');
  // The picker itself is untouched.
  must(count(page, 'function albumCoverModal(') === 1 && count(page, 'function applyAlbumCover(') === 1 &&
    count(page, 'id="albCoverFile"') === 1 && count(page, 'id="albCoverClear"') === 1 &&
    count(page, "modal.id = 'albumCoverBackdrop';") === 1,
    'the cover picker lost a control with this release');
  must(count(page, 'userAlbums[name].cover = dataUrl;') === 1,
    'a saved cover no longer lands on the album entry');
  // The Manage albums panel is otherwise the one 63.1.4 left.
  must(count(page, 'id="mgrAlbumSearch"') === 1 && count(page, 'class="mgr-alb-row"') === 1 &&
    count(page, 'class="mgr-alb-rename"') === 1 && count(page, 'class="mgr-alb-del"') === 1,
    'the Manage albums panel lost its search box or one of its controls');
  // The release.
  must(count(page, "const APP_VERSION = '70.2.1';") === 1, 'the version is not 70.2.1');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.2.1',") === 1 && count(page, "  { version: '70.2.0',") === 1 &&
    count(page, "  { version: '70.1.9',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(!/\bmp3\b|\bdownload|converter|\bconvert\b/i.test(NOTES.join('\n')),
    'a note reads as a music downloader on the wider store list');
  must(!/play build|play version|play install/i.test(NOTES.join('\n')), 'a note names the other build');
  must(/(studio|player|dock|premium|license)/i.test(NOTES.join('\n')),
    'and none of them names a surface this app has');
  must(!/\bpass\b/i.test(TITLE), 'the title reads as a test result');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  // The gates.
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, 'an album cover is changed from Manage albums, not from the album row') === 1,
    'the new gate rule did not land');
  must(count(studio.text, 'the cover picker is reached from Manage albums, not the album row') === 1,
    'the real-app probe was not repointed');
}

if(problems.length){
  console.error('patch-7021: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7021: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7021: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7021: next `node dev/repin-7021.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
