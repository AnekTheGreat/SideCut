#!/usr/bin/env node
/**
 * SideCut 72.7.1 - the lyrics toast tells you which songs it was about.
 *
 * The owner's words: "if it says lyrics found for x amount of songs then if you
 * click on the toast it should tell you which songs it found it for".
 *
 * The two lyrics runs already announce a count, and the toast already offered a
 * tap that only dismissed it. This release makes that tap useful:
 *
 * 1. `toast()` gains an optional third argument. When it carries a `list`, the
 *    once-bound tap handler opens a panel naming the songs instead of merely
 *    hiding the toast. Every other toast keeps the old dismiss-on-tap behavior.
 *
 * 2. `showToastList(title, items)` is the panel: a centered card that reuses the
 *    shipped `.modal-backdrop` / `.modal` styling, numbers each song and closes
 *    on its own button or a tap outside it.
 *
 * 3. THE BATCH RUN. The Fetch-missing-lyrics pass collects each matched song's
 *    name while it loops, and its closing toast now carries that list and lives
 *    six seconds instead of two, so there is time to tap it. The message is the
 *    same one plus "— tap to see which".
 *
 * 4. THE BACKGROUND RE-CHECK. `scLyricsRecheckRun` collects the names the same
 *    way and hands them to the same toast shape, so the quiet pass that runs a
 *    little after launch answers the same question on the same tap.
 *
 * EVERY sub is a swap and carries a `key`, so re-running this on a tree that
 * already has it applied is a no-op.
 *
 *   node dev/patch-7271.mjs
 *   node dev/patch-7271.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.7.1';
const STAMP = 'October 3, 2026 \\u00b7 4:23 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.7';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'Tap the lyrics toast to see which songs it found';
const NOTES = [
  'The lyrics run now ends with a toast you can tap: tap it and a panel opens listing every song that came back with words.',
  'The list follows the order the songs were checked, so the ones at the top are the songs the run reached first.',
  'The toast also stays on screen a few seconds longer, so there is time to tap it before it goes away.',
  'A run that finds nothing reads exactly as before, with nothing to open and nothing to tap.',
  'The quiet re-check that runs a little while after launch reports the newer songs it found words for the same way, on the same tap.',
  'The panel numbers each song, closes on its own Close button or a tap outside it, and changes nothing else in the app.',
  'Everything the previous update fixed stays fixed, and the stopwatch in the bell and the storage panel are untouched.',
  'The player, your library, your queue, your saved songs and the home-screen widget controls are all left exactly where they were.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
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

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

/* ============================================================================
   1. THE VERSION AND THE CHANGELOG HEAD
   ========================================================================== */
sub(html, 'the app runs 72.7.1',
  "  const APP_VERSION = '72.7';\n",
  "  const APP_VERSION = '72.7.1';\n",
  { key: "const APP_VERSION = '72.7.1';" });

const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.7.1 entry at its head',
  "  const CHANGELOG = [\n" +
  "  { version: '" + OLDVER + "', date:",
  "  const CHANGELOG = [\n" +
  headEntry + "\n" +
  "  { version: '" + OLDVER + "', date:",
  { key: "{ version: '" + VERSION + "', date: '" + STAMP + "'" });

sub(sw, 'the shell cache is the release name',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ============================================================================
   2. THE TOAST LEARNS TO OPEN A LIST
   --------------------------------------------------------------------------
   The tap handler is bound once, so it has to be the single place that decides
   what a tap means: open the list if this toast carries one, otherwise dismiss
   as before. `toastEl._onTap` is the per-toast switch, cleared on every fresh
   toast so a stale list can never open under a later message.
   ========================================================================== */
sub(html, 'the toast can carry a tappable list',
  "  const toastEl = $('toast');\n" +
  "  function toast(msg, ms=2200){\n" +
  "    toastEl.textContent = msg;\n" +
  "    toastEl.style.display='block';\n" +
  "    toastEl.style.cursor='pointer';\n" +
  "    clearTimeout(toastEl._t);\n" +
  "    toastEl._t = setTimeout(()=> toastEl.style.display='none', ms);\n" +
  "    // Tap to dismiss (only bind once)\n" +
  "    if(!toastEl._tapDismissed){\n" +
  "      toastEl._tapDismissed = true;\n" +
  "      toastEl.addEventListener('click', function(){\n" +
  "        clearTimeout(toastEl._t);\n" +
  "        toastEl.style.display='none';\n" +
  "      });\n" +
  "    }\n" +
  "  }\n",
  "  const toastEl = $('toast');\n" +
  "  // `opts.list` makes a toast one you can tap for detail: the tap opens a panel\n" +
  "  // naming the songs instead of just dismissing. The lyrics runs use it so\n" +
  "  // \"Found lyrics for N songs\" can answer which ones.\n" +
  "  function toast(msg, ms=2200, opts){\n" +
  "    toastEl._onTap = (opts && opts.list && opts.list.length)\n" +
  "      ? function(){ showToastList(opts.title || msg, opts.list); }\n" +
  "      : null;\n" +
  "    toastEl.textContent = msg;\n" +
  "    toastEl.style.display='block';\n" +
  "    toastEl.style.cursor='pointer';\n" +
  "    clearTimeout(toastEl._t);\n" +
  "    toastEl._t = setTimeout(()=> toastEl.style.display='none', ms);\n" +
  "    // Tap once: open the detail if there is one, otherwise dismiss as before.\n" +
  "    if(!toastEl._tapDismissed){\n" +
  "      toastEl._tapDismissed = true;\n" +
  "      toastEl.addEventListener('click', function(){\n" +
  "        clearTimeout(toastEl._t);\n" +
  "        toastEl.style.display='none';\n" +
  "        var _fn = toastEl._onTap;\n" +
  "        toastEl._onTap = null;\n" +
  "        if(typeof _fn === 'function'){ try{ _fn(); }catch(_eToastTap){ console.error('toast tap failed', _eToastTap); } }\n" +
  "      });\n" +
  "    }\n" +
  "  }\n" +
  "\n" +
  "  // The panel a tappable toast opens: a centered card listing the songs, reusing\n" +
  "  // the shipped modal styling. Closes on its own button or a tap outside it.\n" +
  "  function showToastList(title, items){\n" +
  "    var list = (items || []).filter(Boolean);\n" +
  "    var rows = list.map(function(s, i){\n" +
  "      return '<div style=\"display:flex; gap:8px; padding:8px 0; border-bottom:1px solid var(--line); font-size:13.5px; color:var(--ink);\">' +\n" +
  "        '<span style=\"color:var(--ink-dim); flex-shrink:0; min-width:18px;\">' + (i + 1) + '.</span>' +\n" +
  "        '<span style=\"flex:1; min-width:0; word-break:break-word;\">' + escapeHtml(String(s)) + '</span></div>';\n" +
  "    }).join('');\n" +
  "    if(!rows) rows = '<div style=\"color:var(--ink-dim); font-size:13px; padding:6px 0;\">No songs to list.</div>';\n" +
  "    var bd = document.createElement('div');\n" +
  "    bd.className = 'modal-backdrop';\n" +
  "    bd.style.zIndex = '250';\n" +
  "    bd.style.display = 'flex';\n" +
  "    var sh = document.createElement('div');\n" +
  "    sh.className = 'modal';\n" +
  "    sh.style.maxWidth = '380px';\n" +
  "    sh.innerHTML = '<h3>' + escapeHtml(title) + '</h3>' +\n" +
  "      '<div style=\"max-height:50vh; overflow-y:auto; margin-bottom:10px;\">' + rows + '</div>' +\n" +
  "      '<button id=\"_toastListClose\" style=\"width:100%; padding:11px; border-radius:8px; border:none; background:var(--coral); color:#fff; font-weight:600; font-size:13px; cursor:pointer;\">Close</button>';\n" +
  "    bd.appendChild(sh);\n" +
  "    document.body.appendChild(bd);\n" +
  "    function close(){ try{ bd.remove(); }catch(_eClose){} }\n" +
  "    var btn = document.getElementById('_toastListClose');\n" +
  "    if(btn) btn.addEventListener('click', close);\n" +
  "    bd.addEventListener('click', function(e){ if(e.target === bd) close(); });\n" +
  "  }\n",
  { key: 'function showToastList(title, items){' });

// An undo toast must clear a list left behind by an earlier one, so a stale tap
// cannot open a panel that no longer belongs to the message on screen.
sub(html, 'the undo toast clears any pending tap action',
  "  function toastWithUndo(msg, onUndo){\n    toastEl.textContent = '';\n",
  "  function toastWithUndo(msg, onUndo){\n    toastEl._onTap = null;\n    toastEl.textContent = '';\n",
  { key: 'function toastWithUndo(msg, onUndo){\n    toastEl._onTap = null;' });

/* ============================================================================
   3. THE BATCH RUN COLLECTS THE NAMES AND HANDS THEM TO THE TOAST
   ========================================================================== */
sub(html, 'the batch run keeps the names it matched',
  "    const total = needsLyrics.length;\n",
  "    const total = needsLyrics.length;\n    const foundNames = [];\n",
  { key: 'const foundNames = [];' });

sub(html, 'each matched song is remembered by name',
  "        t.lyricsSynced = result.isSynced;\n" +
  "        persistTrackMeta(t);\n" +
  "        window.lyricsFetchState.fetched++;\n" +
  "      }\n",
  "        t.lyricsSynced = result.isSynced;\n" +
  "        persistTrackMeta(t);\n" +
  "        window.lyricsFetchState.fetched++;\n" +
  "        foundNames.push(t.name || t.title || 'Untitled');\n" +
  "      }\n",
  { key: 'foundNames.push(t.name' });

sub(html, 'the batch toast carries the list and lives longer',
  "    btn.disabled = false;\n" +
  "    bar.style.display = 'none';\n" +
  "    toast(`Found lyrics for ${window.lyricsFetchState.fetched} songs`);\n",
  "    btn.disabled = false;\n" +
  "    bar.style.display = 'none';\n" +
  "    const _lyricsCount = window.lyricsFetchState.fetched;\n" +
  "    const _lyricsList = foundNames.slice();\n" +
  "    const _lyricsOpen = _lyricsCount > 0 && _lyricsList.length > 0;\n" +
  "    toast(`Found lyrics for ${_lyricsCount} songs` + (_lyricsOpen ? ' \\u2014 tap to see which' : ''),\n" +
  "      _lyricsOpen ? 6000 : 2200,\n" +
  "      _lyricsOpen ? { title: 'Lyrics found for', list: _lyricsList } : undefined);\n",
  { key: 'const _lyricsOpen = _lyricsCount > 0' });

/* ============================================================================
   4. THE BACKGROUND RE-CHECK DOES THE SAME
   ========================================================================== */
sub(html, 'the re-check keeps the names it matched',
  "    var added = 0;\n    try{\n",
  "    var added = 0;\n    var addedNames = [];\n    try{\n",
  { key: 'var addedNames = [];' });

sub(html, 'each re-checked hit is remembered by name',
  "          try{ await persistTrackMeta(t); }catch(_eRecheckSave){}\n" +
  "          added++;\n",
  "          try{ await persistTrackMeta(t); }catch(_eRecheckSave){}\n" +
  "          added++;\n" +
  "          try{ addedNames.push(t.name || 'Untitled'); }catch(_eRecheckName){}\n",
  { key: 'addedNames.push(t.name' });

sub(html, 'the re-check toast carries the list and lives longer',
  "      try{ toast('Lyrics found for ' + added + ' newer song' + (added === 1 ? '' : 's')); }catch(_eToast){}\n",
  "      try{ toast('Lyrics found for ' + added + ' newer song' + (added === 1 ? '' : 's') + ' \\u2014 tap to see which', 6000, { title: 'Lyrics found for', list: addedNames }); }catch(_eToast){}\n",
  { key: "' \\u2014 tap to see which', 6000, { title: 'Lyrics found for', list: addedNames }" });

/* ============================================================================
   5. THE OTA TAIL - TWO newlines after </html>, exactly as 72.5 and 72.7
   --------------------------------------------------------------------------
   72.7 shipped a two-newline tail and its bundle settled pass 2. This release
   keeps the same padding; the fixpoint is re-probed after the bundle is built,
   and the extra newline is invisible to the page and rides in the bundle only.
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to two newlines');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-7271: ' + problems.join('\n           '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-7271: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
