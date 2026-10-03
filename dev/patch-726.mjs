#!/usr/bin/env node
/**
 * SideCut 72.6 - the way in is spelled out, and a hidden playlist stays hidden.
 *
 * Three things the owner asked for, in one update:
 *
 * 1. MOVE THE EXPAND URL CARD TO THE BOTTOM OF CONVERSION TOOLS.
 *    The card is only a fallback for a SHORT Spotify link - it converts
 *    open.spotify.com/s/... into the full track URL. It sat first in both the
 *    Discover and the Settings tool lists, in front of the Spotify, YouTube and
 *    MP4 cards that are what people actually came for. It moves to the end of
 *    each list (after the audio-format explainer).
 *
 * 2. SAY HOW SONGS GET INTO THE LIBRARY, PLAINLY.
 *    A brand new user could not tell what to do. Both how-to boxes and the
 *    first-run walkthrough now open with a plain lead-in: there are two ways in
 *    - let the app make the file from a Spotify or YouTube link, or bring files
 *    you already have with + Add songs - and either way the songs land in the
 *    library, on your device. The existing steps and the outside-site fallback
 *    links are left in place.
 *
 * 3. A HIDDEN PLAYLIST MUST NOT BE THE ONE THE LIBRARY OPENS ON.
 *    Hiding a tab is the user saying "keep this out of the way". But the boot
 *    restore, the Library button and the single-button toggle all picked
 *    `lastUsedPlaylist` WITHOUT checking whether it is hidden, so reopening the
 *    app put a hidden playlist on screen - and it only disappeared once you
 *    switched tabs, which re-rendered and re-filtered it. Every one of those
 *    picks now goes through `scPlaylistVisible()`.
 *
 * EVERY sub is an insertion or a swap and carries a `key`, so re-running this on
 * a tree that already has it applied is a no-op. The card MOVE is done with code
 * (it is a move, and a move cannot be a keyed single sub), guarded by a marker.
 *
 *   node dev/patch-726.mjs
 *   node dev/patch-726.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.6';
const STAMP = 'October 2, 2026 \\u00b7 9:24 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.5.2';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'Getting music in is spelled out, a hidden playlist stays hidden, and Expand URL moves down';
const NOTES = [
  'Getting songs into your library is spelled out now. Both how-to boxes, the first-run walkthrough and its short summary name the two ways in and say where the songs land, so a brand new install is not a guessing game.',
  'The two ways in are: let the app make the file from a Spotify or YouTube link, or bring audio files you already have with + Add songs. Either way they end up in your library, on your device.',
  'The Expand URL box now sits at the bottom of the tools list, in Discover and in Settings. It is only the fallback for a short Spotify link, so it no longer stands in front of the parts you actually use.',
  'A playlist you hid stays hidden. Reopening the app and opening your Library used to put a hidden playlist back on screen until you switched tabs; the app now never opens on one.',
  'Hiding a playlist is still not a delete: its songs, its order and its tags are untouched, and unhiding it brings it straight back.',
  'The player and the home-screen widget are untouched by this build. This release is about the wording that teaches the library and about the one hidden-tab slip.',
  'Nothing about your songs, playlists or settings changed. Your library, your queue and your saved songs are read exactly as they were.',
  'Everything the previous update fixed stays fixed: pause, play, next and previous on the home-screen widget keep working from outside the app.',
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
sub(html, 'the app runs 72.6',
  "  const APP_VERSION = '72.5.2';\n",
  "  const APP_VERSION = '72.6';\n",
  { key: "const APP_VERSION = '72.6';" });

const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.6 entry at its head',
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
   2. THE EXPAND URL CARD MOVES TO THE BOTTOM OF EACH TOOL LIST
   --------------------------------------------------------------------------
   A move cannot be one keyed sub (a removal can never be keyed), so it is done
   in CODE, guarded by a marker comment that only exists once it has run. The cut
   is the card's own lines (its comment through the line before the next card);
   the paste is just after the audio-format explainer's closing </details>, which
   is the last thing before each list's own </details>. The two lists are told
   apart by that closing tag's indentation (4 spaces in Discover, 7 in Settings).
   ========================================================================== */
{
  const MOVED = '<!-- 72.6: the Expand URL card sits at the bottom of this list now -->';
  if (html.text.indexOf(MOVED) !== -1) {
    if (process.env.SC_DEBUG) console.log('  already: the Expand URL card is at the bottom');
    already++;
  } else {
    const EXPLAINER_END = 'storage.</div></details>';
    // Cut one card (its comment line through the line before `nextComment`) and
    // paste it back right after the audio-format explainer, which is the last
    // thing before the list's own </details>. Every anchor is deliberately
    // indentation-specific: a generic `<!-- Expand URL card -->` anchor matched
    // the card the Discover pass had just inserted, so the Settings cut started
    // there and swallowed the whole middle of the document.
    const moveCard = (text, startComment, nextComment, closeAnchor) => {
      const cAt = text.indexOf(startComment);
      if (cAt === -1) return null;
      const cStart = text.lastIndexOf('\n', cAt) + 1;
      const nAt = text.indexOf(nextComment, cAt + startComment.length);
      if (nAt === -1) return null;
      const nStart = text.lastIndexOf('\n', nAt) + 1;
      const card = text.slice(cStart, nStart);
      const t = text.slice(0, cStart) + text.slice(nStart);
      const at = t.indexOf(closeAnchor);
      if (at === -1) return null;
      const cut = at + EXPLAINER_END.length; // right after the explainer, before </details>
      return t.slice(0, cut) + '\n      ' + MOVED + '\n' + card + t.slice(cut);
    };
    let t = html.text, ok = true;
    // Discover first: 6-space cards, list closes with a 4-space </details>.
    const d = moveCard(t, '      <!-- Expand URL card -->', '      <!-- Spotify card -->', EXPLAINER_END + '\n    </details>');
    if (!d) ok = false; else t = d;
    // Settings: 8-space cards, list closes with a 6-space </details>.
    if (ok) {
      const s = moveCard(t, '        <!-- Expand URL card -->', '        <!-- Spotify card -->', EXPLAINER_END + '\n      </details>');
      if (!s) ok = false; else t = s;
    }
    if (ok) { html.text = t; applied++; }
    else problems.push('could not move the Expand URL card to the bottom');
  }
}

/* ============================================================================
   3. SAY HOW SONGS GET IN - a plain lead-in on both boxes and the walkthrough
   ========================================================================== */
sub(html, 'the Discover how-to opens with the two ways in',
  '      <b style="color:var(--coral);">💿 How to get a song</b><br>\n',
  '      <b style="color:var(--coral);">💿 How to get a song</b><br>\n' +
  '      <span style="color:var(--ink-dim);">New here? There are two ways in. Either let the app make the file for you from a Spotify link (steps 1-3 just below), or bring music you already have with <b style="color:var(--ink);">+ Add songs</b> (the last note here). Both end up in <b style="color:var(--ink);">🎵 Library \u2192 All Songs</b>, saved on your device with no ads.</span><br><br>\n',
  { key: 'New here? There are two ways in.' });

sub(html, 'the Settings how-to opens with the same plain lead-in',
  '        <b style="color:var(--coral);">💿 How to get a song into your library</b> <span style="color:var(--ink-dim); font-weight:400;">(free, like everything else in here)</span><br>\n',
  '        <b style="color:var(--coral);">💿 How to get a song into your library</b> <span style="color:var(--ink-dim); font-weight:400;">(free, like everything else in here)</span><br>\n' +
  '        <span style="color:var(--ink-dim);">New here? There are two ways in. Either let the app make the file for you from a Spotify or YouTube link (steps 1-3 just below), or bring music you already have with <b style="color:var(--ink);">+ Add songs</b>. Both end up in <b style="color:var(--ink);">🎵 Library \u2192 All Songs</b>, saved on your device with no ads.</span><br><br>\n',
  { key: 'New here? There are two ways in. Either let the app make the file for you from a Spotify or YouTube link' });

sub(html, 'the first-run walkthrough says the same thing up front',
  '        <div id="howToGetMusicHead" style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>\n',
  '        <div id="howToGetMusicHead" style="font-weight:600; font-size:14px; margin-bottom:6px;">Getting music into your library</div>\n' +
  '        <div style="font-size:12.5px; color:var(--ink-dim); line-height:1.5; margin-bottom:6px;">Two ways in: let the app make the file from a Spotify or YouTube link (steps 1-4), or bring files you already have (the last step). Either way the songs land in <b>🎵 Library \u2192 All Songs</b> and stay on your device.</div>\n',
  { key: 'Two ways in: let the app make the file from a Spotify or YouTube link (steps 1-4), or bring files you already have (the last step).' });

/* ============================================================================
   4. A HIDDEN PLAYLIST IS NEVER THE ONE THE LIBRARY OPENS ON
   ========================================================================== */
sub(html, 'one place decides whether a playlist may be shown',
  '  function rememberPlaylist(name){\n',
  '  // 72.6 - MAY THIS PLAYLIST BE SHOWN?\n' +
  '  // Hiding a tab is the user saying "keep this out of the way". Every pick of\n' +
  '  // the playlist the Library opens on goes through here now: choosing by\n' +
  '  // last-used memory alone put a hidden playlist back on screen on every\n' +
  '  // reopen, and it only went away when you switched tabs and the list\n' +
  '  // re-rendered. Hiding was never a delete - it is a choice about the list.\n' +
  '  function scPlaylistVisible(name){\n' +
  '    try{\n' +
  '      if(!name || !playlists || !playlists[name]) return false;\n' +
  '      return !(hiddenPlaylists && hiddenPlaylists.has && hiddenPlaylists.has(name));\n' +
  '    }catch(e){ return false; }\n' +
  '  }\n' +
  '  // The playlist to fall back to: All Songs when it is not itself hidden (that\n' +
  '  // is what boot has always landed on), otherwise the first one still visible.\n' +
  '  function scFirstVisiblePlaylist(){\n' +
  '    try{\n' +
  '      if(scPlaylistVisible(\'All Songs\')) return \'All Songs\';\n' +
  '      var keys = Object.keys(playlists || {});\n' +
  '      for(var i = 0; i < keys.length; i++){ if(scPlaylistVisible(keys[i])) return keys[i]; }\n' +
  '    }catch(e){}\n' +
  '    return \'All Songs\';\n' +
  '  }\n' +
  '  function rememberPlaylist(name){\n',
  { key: 'function scPlaylistVisible(name){' });

sub(html, 'the boot restore skips a hidden last-used playlist',
  '        if(lastUsedPlaylist && playlists[lastUsedPlaylist]){\n' +
  '          activePlaylist = lastUsedPlaylist;\n' +
  '        } else if(lastPlaybackState && lastPlaybackState.sourcePlaylist && playlists[lastPlaybackState.sourcePlaylist] && lastPlaybackState.sourcePlaylist !== \'All Songs\'){\n' +
  '          activePlaylist = lastPlaybackState.sourcePlaylist;\n' +
  '        }\n',
  '        // 72.6 - never reopen on a HIDDEN playlist (see scPlaylistVisible).\n' +
  '        if(scPlaylistVisible(lastUsedPlaylist)){\n' +
  '          activePlaylist = lastUsedPlaylist;\n' +
  '        } else if(lastPlaybackState && lastPlaybackState.sourcePlaylist !== \'All Songs\' && scPlaylistVisible(lastPlaybackState.sourcePlaylist)){\n' +
  '          activePlaylist = lastPlaybackState.sourcePlaylist;\n' +
  '        } else {\n' +
  '          activePlaylist = scFirstVisiblePlaylist();\n' +
  '        }\n',
  { key: 'never reopen on a HIDDEN playlist' });

sub(html, 'the Library button only lands on a playlist it may show',
  '    const pickReal = () => {\n' +
  '      if(lastUsedPlaylist && playlists[lastUsedPlaylist]) return lastUsedPlaylist;\n' +
  '      const src = lastPlaybackState && lastPlaybackState.sourcePlaylist;\n' +
  '      if(src && src !== \'All Songs\' && playlists[src]) return src;\n' +
  '      const real = Object.keys(playlists).find(n => n !== \'All Songs\' && n !== \'Favorites\' && playlists[n].length);\n' +
  '      if(real) return real;\n' +
  '      return \'All Songs\';\n' +
  '    };\n',
  '    const pickReal = () => {\n' +
  '      // 72.6 - a HIDDEN playlist is not a candidate for the one to open on.\n' +
  '      if(scPlaylistVisible(lastUsedPlaylist)) return lastUsedPlaylist;\n' +
  '      const src = lastPlaybackState && lastPlaybackState.sourcePlaylist;\n' +
  '      if(src && src !== \'All Songs\' && scPlaylistVisible(src)) return src;\n' +
  '      const real = Object.keys(playlists).find(n => n !== \'All Songs\' && n !== \'Favorites\' && playlists[n].length && scPlaylistVisible(n));\n' +
  '      if(real) return real;\n' +
  '      return scFirstVisiblePlaylist();\n' +
  '    };\n',
  { key: 'a HIDDEN playlist is not a candidate for the one to open on' });

sub(html, 'the single-button library toggle never lands on a hidden playlist',
  '      libraryMode = libraryMode === \'playlists\' ? \'albums\' : \'playlists\';\n' +
  '      if(typeof dbPut === \'function\') dbPut(\'meta\', { key: \'libraryMode\', value: libraryMode });\n' +
  '      activePlaylist = lastUsedPlaylist || \'All Songs\';\n',
  '      libraryMode = libraryMode === \'playlists\' ? \'albums\' : \'playlists\';\n' +
  '      if(typeof dbPut === \'function\') dbPut(\'meta\', { key: \'libraryMode\', value: libraryMode });\n' +
  '      activePlaylist = scPlaylistVisible(lastUsedPlaylist) ? lastUsedPlaylist : scFirstVisiblePlaylist();\n',
  { key: 'activePlaylist = scPlaylistVisible(lastUsedPlaylist) ? lastUsedPlaylist : scFirstVisiblePlaylist();' });

sub(html, 'the ◀ Library tab never lands on a hidden playlist either',
  "      pl.addEventListener('click', () => { activePlaylist = lastUsedPlaylist || 'All Songs'; rememberPlaylist(activePlaylist); navigate('playlists'); });\n",
  "      pl.addEventListener('click', () => { activePlaylist = scPlaylistVisible(lastUsedPlaylist) ? lastUsedPlaylist : scFirstVisiblePlaylist(); rememberPlaylist(activePlaylist); navigate('playlists'); });\n",
  { key: 'activePlaylist = scPlaylistVisible(lastUsedPlaylist) ? lastUsedPlaylist : scFirstVisiblePlaylist(); rememberPlaylist(activePlaylist); navigate' });

/* ============================================================================
   5. THE OTA TAIL - one newline after </html>, exactly as 72.5.1/72.5.2
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to one newline');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-726: ' + problems.join('\n           '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-726: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
