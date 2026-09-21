// v60.1.5 patch C — Get Song copies the link, Find on Spotify copies the link,
// MP3 is the default format again.
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'index.html');
let html = fs.readFileSync(file, 'utf8');

function sub(oldStr, newStr) {
  const n = html.split(oldStr).length - 1;
  if (n !== 1) throw new Error('expected exactly 1 match, found ' + n + ' for: ' + JSON.stringify(oldStr).slice(0, 120));
  html = html.replace(oldStr, newStr);
}

// ---- 1. Get Song button: just copy the link --------------------------------
sub(
  '    dlBtn.title = \'Find this song and add it to your library\';',
  '    dlBtn.title = \'Copy the Spotify link for this song\';');

sub(
  '      triggerDiscoverDownload(card, r, dlBtn);',
  '      copySpotifyLink(r.trackName, r.artistName, \'Get song\');');

// Remove the multi-line comment above the Get Song button
sub(
  `    // One button, and it gets the song. SideCut resolves the recording and
    // converts it on-device straight into the library`,
  `    // One button, and it gets the song. It copies the Spotify search link to
    // the clipboard so you can paste it into whatever downloader you use.`);

// ---- 2. Card click: copy link instead of opening Spotify -------------------
sub(
  `    // Tapping the card opens the song in Spotify for the user to get it.
    // Preview only plays via the explicit ▶ button \\u2014 no auto-play on tap.
    card.addEventListener('click', () => {
      const q = (r.trackName || '') + ' ' + (r.artistName || '');
      // Same handoff as the Get song button \\u2014 tapping the card used to load the
      // allow-listed web player inside the app.
      scOpenSpotifySearch(q);
      toast('Spotify opened \\u2014 tap the song, then Share \\u2192 Copy link.', 4000);
    });`,
  `    // Tapping the card copies the Spotify link to the clipboard.
    // Preview only plays via the explicit ▶ button \\u2014 no auto-play on tap.
    card.addEventListener('click', () => {
      copySpotifyLink(r.trackName, r.artistName, 'Get song');
    });`);

// ---- 3. Find on Spotify: copy link instead of opening Spotify ---------------
sub(
  `    scOpenSpotifySearch((b.dataset && b.dataset.album) || '');
    toast('Opening Spotify \\u2014 tap the song, then Share \\u2192 Copy link.', 4000);`,
  `    copySpotifyLink(null, (b.dataset && b.dataset.album) || '', 'Find on Spotify');`);

// ---- 4. triggerDiscoverDownload: just copy link, no auto-convert -----------
sub(
  `  async function triggerDiscoverDownload(card, r, btn){
    const q = (r.trackName || '') + ' ' + (r.artistName || '');
    if(typeof window.__scSaveDiscoverTrack === 'function'){
      let got = false;
      try{ got = await window.__scSaveDiscoverTrack(r, btn || null); }catch(_eGet){ got = false; }
      if(got) return;
    }
    scOpenSpotifySearch(q);
    toast('Couldn\\u2019t find that one on-device \\u2014 Spotify opened, tap the song and Share \\u2192 Copy link.', 5000);
  }`,
  `  async function triggerDiscoverDownload(card, r, btn){
    copySpotifyLink(r.trackName, r.artistName, 'Get song');
  }`);

// ---- 5. Add copySpotifyLink helper right before triggerDiscoverDownload -----
sub(
  `  // "Get song" gets the song.`,
  `  // Build a Spotify search URL, copy it to the clipboard, let the user paste
  // it into their downloader.
  function copySpotifyLink(trackName, artistName, label){
    var q = ((trackName || '') + ' ' + (artistName || '')).trim();
    if(!q){ toast('No song information for this track.', 3000); return; }
    var url = 'https://open.spotify.com/search/' + encodeURIComponent(q);
    try{
      if(navigator.clipboard && navigator.clipboard.writeText){
        navigator.clipboard.writeText(url).then(function(){
          toast('Link copied \\u2014 paste it into your downloader.', 3500);
        }).catch(function(){ fallbackCopy(url); });
      } else { fallbackCopy(url); }
    }catch(_e){ fallbackCopy(url); }
    function fallbackCopy(u){
      try{
        var ta = document.createElement('textarea');
        ta.value = u; ta.style.cssText = 'position:fixed;left:-9999px;opacity:0;';
        document.body.appendChild(ta); ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        toast('Link copied \\u2014 paste it into your downloader.', 3500);
      }catch(_e2){
        toast('Spotify link: ' + u, 6000);
      }
    }
  }
  window.__copySpotifyLink = copySpotifyLink;
  // "Get song" gets the song.`);

// ---- 6. Default format: MP3 instead of FLAC ---------------------------------
sub(
  '<option value="flac" selected>FLAC (lossless)</option><option value="wav">WAV (lossless)</option><option value="mp3">MP3 (smaller)</option>',
  '<option value="mp3" selected>MP3 (smaller)</option><option value="flac">FLAC (lossless)</option><option value="wav">WAV (lossless)</option>');

sub(
  `    var fmt = 'flac';   // lossless unless the converter's format picker says otherwise`,
  `    var fmt = 'mp3';   // MP3 unless the converter's format picker says otherwise`);

sub(
  `<option value="flac"' + (presetFmt === 'flac' ? ' selected' : '') + '>FLAC (lossless)</option><option value="wav"' + (presetFmt === 'wav' ? ' selected' : '') + '>WAV (lossless)</option><option value="mp3"' + (presetFmt === 'mp3' ? ' selected' : '') + '>MP3 (smaller)</option>`,
  `<option value="mp3"' + (presetFmt === 'mp3' ? ' selected' : '') + '>MP3 (smaller)</option><option value="flac"' + (presetFmt === 'flac' ? ' selected' : '') + '>FLAC (lossless)</option><option value="wav"' + (presetFmt === 'wav' ? ' selected' : '') + '>WAV (lossless)</option>`);

fs.writeFileSync(file, html);
console.log('v615c: Get Song copies link, Find on Spotify copies link, MP3 default applied');
