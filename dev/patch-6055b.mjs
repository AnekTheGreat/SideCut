// v60.5.5 follow-up: three more home-bubble CTAs landed on whatever view the
// Library tab was last left in — "Open Playlists" buttons that could open
// Albums, and "Jump to now playing" that could land on the albums grid with
// the song nowhere in sight. All three go through the same helper as the
// download prompts. (str_replace cannot search index.html at this size, so the
// counted-script path the repo already uses for this file is used here too.)
import fs from 'node:fs';

const FILE = 'index.html';
let failed = 0, edits = 0;

function rep(oldStr, newStr, label) {
  const src = fs.readFileSync(FILE, 'utf8');
  let n = 0, i = src.indexOf(oldStr);
  while (i !== -1) { n++; i = src.indexOf(oldStr, i + oldStr.length); }
  if (n !== 1) { failed++; console.error(`MISS(${n}) [${label}]`); return; }
  fs.writeFileSync(FILE, src.replace(oldStr, newStr));
  edits++;
  console.log(`ok  [${label}]`);
}

rep(`      $('hbCtaPlaylists').addEventListener('click', () => { closeHomeBubble(); navigate('library'); });`,
    `      $('hbCtaPlaylists').addEventListener('click', () => { closeHomeBubble(); scOpenLibraryAfterDownload(); });`,
    'Open Playlists bubble CTA');

rep(`      $('hbCtaNowPlaying').addEventListener('click', () => { closeHomeBubble(); navigate('library'); });`,
    `      $('hbCtaNowPlaying').addEventListener('click', () => { closeHomeBubble(); scOpenLibraryAfterDownload(); });`,
    'Jump to now playing CTA');

rep(`      $('hbCtaPlaylists2').addEventListener('click', () => { closeHomeBubble(); navigate('library'); });`,
    `      $('hbCtaPlaylists2').addEventListener('click', () => { closeHomeBubble(); scOpenLibraryAfterDownload(); });`,
    'quick-settings playlists CTA');

const src = fs.readFileSync(FILE, 'utf8');
const leftover = src.split(`closeHomeBubble(); navigate('library');`).length - 1;
if (leftover !== 0) { failed++; console.error(`FAIL ${leftover} raw prompt(s) remain`); }
else console.log('ok  [no raw closeHomeBubble+navigate(library) prompts remain]');

console.log(`${edits} edits applied, ${failed} problems`);
process.exit(failed ? 1 : 0);
