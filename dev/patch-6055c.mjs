// v60.5.5 follow-up 2: the helper gets an optional playlist argument so every
// home-bubble navigation can go through it without losing its target:
//   scOpenLibraryAfterDownload()          -> Playlists / All Songs (default)
//   scOpenLibraryAfterDownload('Gym')     -> Playlists / that playlist
//   scOpenLibraryAfterDownload(null)      -> Playlists / whatever is selected
// Covers the playlist-row taps, the Favorites CTA and the track-row/play taps
// (playTrackInPlaylistContext picks the context; the helper only guarantees the
// view is Playlists instead of the albums grid, where the song is invisible).
import fs from 'node:fs';

const FILE = 'index.html';
let failed = 0, edits = 0;

function rep(oldStr, newStr, label, expected = 1) {
  const src = fs.readFileSync(FILE, 'utf8');
  let n = 0, i = src.indexOf(oldStr);
  while (i !== -1) { n++; i = src.indexOf(oldStr, i + oldStr.length); }
  if (n !== expected) { failed++; console.error(`MISS(${n}/${expected}) [${label}]`); return; }
  let out = '', rest = src;
  for (let k = 0; k < expected; k++) {
    const at = rest.indexOf(oldStr);
    out += rest.slice(0, at) + newStr;
    rest = rest.slice(at + oldStr.length);
  }
  out += rest;
  fs.writeFileSync(FILE, out);
  edits++;
  console.log(`ok  [${label}] x${n}`);
}

rep(`  function scOpenLibraryAfterDownload(){`,
    `  function scOpenLibraryAfterDownload(playlistName){`,
    'helper takes a playlist argument');

rep(`      reorderMode = false;
      activePlaylist = 'All Songs';`,
    `      reorderMode = false;
      // null = keep the playlist the caller already picked; no argument lands
      // on All Songs, the one list every saved track is guaranteed to be in.
      if(playlistName !== null) activePlaylist = playlistName || 'All Songs';`,
    'helper honours the argument');

rep(`            activePlaylist = row.dataset.playlist;
            closeHomeBubble(); navigate('library'); renderTabs(); renderList();`,
    `            closeHomeBubble(); scOpenLibraryAfterDownload(row.dataset.playlist); renderList();`,
    'playlist-row tap keeps its playlist');

rep(`      $('hbCtaFav').addEventListener('click', () => {
        closeHomeBubble();
        activePlaylist = 'Favorites';
        navigate('library'); renderTabs(); renderList();
      });`,
    `      $('hbCtaFav').addEventListener('click', () => {
        closeHomeBubble();
        scOpenLibraryAfterDownload('Favorites');
        renderList();
      });`,
    'Favorites CTA uses the helper');

rep(`        playTrackInPlaylistContext(id);
        closeHomeBubble();
        navigate('library');`,
    `        playTrackInPlaylistContext(id);
        closeHomeBubble();
        scOpenLibraryAfterDownload(null);`,
    'track-row/play taps keep their context',
    2);

const src = fs.readFileSync(FILE, 'utf8');
const leftover = src.split(`closeHomeBubble(); navigate('library');`).length - 1;
if (leftover !== 0) { failed++; console.error(`FAIL ${leftover} raw prompt(s) remain`); }
else console.log('ok  [no raw closeHomeBubble+navigate(library) prompts remain]');

console.log(`${edits} edits applied, ${failed} problems`);
process.exit(failed ? 1 : 0);
