// One-off patch for v60.4.1 — Get song must open the Spotify APP.
//
// The file editor cannot reliably match inside this 1.5 MB index.html, so — as
// this repo's notes require — the edits run as one atomic pass with count
// assertions, followed by a parse check of both inline script blocks.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

let s = fs.readFileSync(HTML, 'utf8');
let changed = 0;

function rep(label, from, to, expect) {
  const n = s.split(from).length - 1;
  if (n !== expect) {
    console.error(`MISMATCH [${label}] found ${n}, expected ${expect}`);
    console.error('--- looked for ---\n' + from.slice(0, 200));
    process.exit(1);
  }
  s = s.split(from).join(to);
  changed += n;
  console.log(`  ok ${label} (${n})`);
}

const r = String.raw;

/* 1 ── the handoff itself: never load the allow-listed web URL on Android. */
rep(
  'scOpenSpotifySearch',
  r`  function scOpenSpotifySearch(q){
    const web = 'https://open.spotify.com/search/' + encodeURIComponent(q || '');
    let native = false;
    try{ native = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); }catch(_e){}
    if(!native){
      try{ window.open(web, '_blank', 'noopener'); }catch(_e){}
      return;
    }
    let handedOff = false;
    const onHide = () => { handedOff = true; };
    try{ document.addEventListener('visibilitychange', onHide); }catch(_e){}
    try{ window.location.href = 'spotify:search:' + encodeURIComponent(q || ''); }catch(_e){}
    setTimeout(() => {
      try{ document.removeEventListener('visibilitychange', onHide); }catch(_e){}
      if(handedOff || document.hidden) return; // the Spotify app took over
      try{ navigator.clipboard.writeText(web); }catch(_e){}
      toast('No Spotify app found \u2014 the track link is on your clipboard for the converter below.', 5000);
    }, 1400);
  }`,
  r`  // open.spotify.com is in the app's allowNavigation list (the converter reads
  // Spotify pages) and Capacitor's WebView cannot open new windows, so BOTH
  // window.open(url, '_blank') and <a target="_blank"> load an allow-listed host
  // IN this WebView — a logged-out Spotify web player sitting on top of SideCut.
  // Only the Get song button used this handoff, which is why tapping a Discover
  // card, a New releases row or "Find on Spotify" in an album still brought up
  // the embedded player.
  //
  // Everything that means "go to Spotify" goes through here now. On Android the
  // spotify: scheme is handed to the Spotify app: a scheme that is not
  // allow-listed is never loaded by the WebView — Capacitor turns it into an
  // ACTION_VIEW intent instead, which is what lets the Spotify app take over. If
  // nothing answers, the search link is copied for the converter below; it is
  // never opened inside this app.
  function scIsAndroid(){
    try{
      if(window.Capacitor){
        if(window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) return true;
        if(window.Capacitor.getPlatform && window.Capacitor.getPlatform() === 'android') return true;
      }
    }catch(_e){}
    return /Android/i.test((navigator && navigator.userAgent) || '');
  }
  function scSpotifyWebUrl(q){ return 'https://open.spotify.com/search/' + encodeURIComponent(q || ''); }
  function scOpenSpotifySearch(q){
    const web = scSpotifyWebUrl(q);
    // Desktop / iOS / a plain browser tab: a new tab is the real Spotify site.
    if(!scIsAndroid()){
      try{ window.open(web, '_blank', 'noopener'); }catch(_e){}
      return;
    }
    let handedOff = false;
    const onHide = () => { handedOff = true; };
    try{ document.addEventListener('visibilitychange', onHide); }catch(_e){}
    try{ window.location.href = 'spotify:search:' + encodeURIComponent(q || ''); }catch(_e){}
    setTimeout(() => {
      try{ document.removeEventListener('visibilitychange', onHide); }catch(_e){}
      if(handedOff || document.hidden) return; // the Spotify app took over
      try{ navigator.clipboard.writeText(web); }catch(_e){}
      toast('No Spotify app found \u2014 the search link is on your clipboard for the converter below.', 5000);
    }, 1400);
  }
  window.__scOpenSpotifySearch = scOpenSpotifySearch;
  // One delegated listener covers every "Find on Spotify" button — Album History,
  // Singles and old cached popups alike — so no render path can fall back to an
  // <a target="_blank"> that loads the web player inside the app.
  document.addEventListener('click', function(e){
    const b = (e.target && e.target.closest) ? e.target.closest('.ah-find-spotify-btn') : null;
    if(!b) return;
    e.preventDefault();
    e.stopPropagation();
    scOpenSpotifySearch((b.dataset && b.dataset.album) || '');
    toast('Opening Spotify \u2014 tap the song, then Share \u2192 Copy link.', 4000);
  }, true);`,
  1
);

/* 2 ── New releases panel row: app handoff, not the web URL. */
rep(
  'new-release row tap',
  r`      const q = row.dataset.title + ' ' + row.dataset.artist;
      // Open Spotify search so user can copy the track link.
      var spotifyUrl = 'https://open.spotify.com/search/' + encodeURIComponent(q);
      try{ window.open(spotifyUrl, '_blank', 'noopener'); }catch(e){}
      toast('Spotify opened \u2014 tap the song, then Share \u2192 Copy link.', 4000);`,
  r`      const q = row.dataset.title + ' ' + row.dataset.artist;
      // Hand off to the Spotify app (scOpenSpotifySearch). open.spotify.com is
      // allow-listed, so opening the web URL here loaded the embedded,
      // logged-out web player instead of the Spotify app.
      scOpenSpotifySearch(q);
      toast('Spotify opened \u2014 tap the song, then Share \u2192 Copy link.', 4000);`,
  1
);

/* 3 ── Discover result card: tapping the card used the web URL too. */
rep(
  'discover card tap',
  `    card.addEventListener('click', () => {
      const q = (r.trackName || '') + ' ' + (r.artistName || '');
      var spotifyUrl = 'https://open.spotify.com/search/' + encodeURIComponent(q);
      try{ window.open(spotifyUrl, '_blank', 'noopener'); }catch(e){}
      toast('Spotify opened — tap the song, then Share → Copy link.', 4000);
    });`,
  `    card.addEventListener('click', () => {
      const q = (r.trackName || '') + ' ' + (r.artistName || '');
      // Same handoff as the Get song button — tapping the card used to load the
      // allow-listed web player inside the app.
      scOpenSpotifySearch(q);
      toast('Spotify opened — tap the song, then Share → Copy link.', 4000);
    });`,
  1
);

/* 4 ── "Find on Spotify" was an <a target="_blank"> (→ web player in-app). */
rep(
  'find-on-spotify links',
  r`<a href="' + dlLink + '" target="_blank" rel="noopener" style="padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;font-weight:600;cursor:pointer;text-decoration:none;display:inline-block;">✨ Find on Spotify</a>`,
  r`<button class="ah-find-spotify-btn" data-album="' + escapeHtml(artistName + ' ' + albumName) + '" style="padding:5px 12px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;font-weight:600;cursor:pointer;">✨ Find on Spotify</button>`,
  2
);

/* 5 ── the web URL those anchors pointed at is no longer built. */
rep(
  'dlLink variable',
  `var dlLink = 'https://open.spotify.com/search/' + encodeURIComponent(artistName + ' ' + albumName);\n`,
  '',
  2
);

/* 6 ── version bump: the version IS the delivery mechanism for an OTA. */
rep('APP_VERSION', `const APP_VERSION = '60.4';`, `const APP_VERSION = '60.4.1';`, 1);

rep(
  'CHANGELOG head',
  `  { version: '60.4', date: '`,
  r`  { version: '60.4.1', date: 'September 21, 2026 \u00b7 12:13 AM EDT', title: 'Get song opens the Spotify app, not the logged-out web player inside SideCut', items: [
    'Every "go to Spotify" tap hands off to the Spotify app now. open.spotify.com is allow-listed so the converter can read Spotify pages, and this WebView cannot open new windows \u2014 so any open.spotify.com link (a window.open or an <a target="_blank">) loaded that page IN the app: a logged-out Spotify web player sitting on top of SideCut. Only the Get song button went through the app handoff, so tapping a Discover card, a New releases row or "Find on Spotify" in an album still brought up the embedded player',
    'The Discover result card, the New releases panel row and the "Find on Spotify" button in Album History track lists all use that one handoff now: on Android the spotify: scheme is given to the Spotify app (its search for that song), so the tap lands in the real app',
    '"Find on Spotify" is a real button everywhere instead of a link, so there is no target="_blank" left to load the web player inside the app',
    'If no Spotify app is installed, the search link is copied to the clipboard for the converter below and the toast says so \u2014 it never falls back to the web player inside SideCut',
    'Desktop and non-Android browsers still get a normal new tab on open.spotify.com, which is where that tap belongs',
  ]},
  { version: '60.4', date: '`,
  1
);

fs.writeFileSync(HTML, s);
console.log(`index.html: ${changed} replacements`);

/* sw.js cache name keeps step with the version. */
let sw = fs.readFileSync(SW, 'utf8');
if (sw.indexOf(`'sidecut-shell-v60.4.1'`) !== -1) {
  console.log('sw.js: already v60.4.1');
} else {
  const from = `const CACHE_NAME = 'sidecut-shell-v60.4';`;
  if ((sw.split(from).length - 1) !== 1) {
    console.error('MISMATCH [sw.js CACHE_NAME]');
    process.exit(1);
  }
  fs.writeFileSync(SW, sw.replace(from, `const CACHE_NAME = 'sidecut-shell-v60.4.1';`));
  console.log('sw.js: CACHE_NAME -> sidecut-shell-v60.4.1');
}
