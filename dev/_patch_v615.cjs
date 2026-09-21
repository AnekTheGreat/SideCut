// v60.1.5 — the update check must never read a cached manifest.
//
// GitHub Pages serves ota/updates.json with `cache-control: max-age=600` and an
// Expires 10 minutes ahead; raw.githubusercontent serves it with max-age=300.
// A device that ran a check (boot auto-check, foreground check, the 30-minute
// one) shortly BEFORE a release landed therefore keeps being handed the OLD
// manifest for up to ten minutes and reports "you're on the latest version"
// about a version that is already published. That is exactly what a phone that
// checks right after a push sees, and it is what happened here.
//
// Every manifest read — and every bundle download — is now stamped with the
// current time, so each check asks the origin instead of the cache.
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
function edit(file, pairs){
  const p = path.join(ROOT, file);
  let src = fs.readFileSync(p, 'utf8');
  for(const [from, to] of pairs){
    if(src.indexOf(from) === -1) throw new Error('anchor not found in ' + file + ': ' + from.slice(0, 90));
    if(src.split(from).length - 1 !== 1) throw new Error('anchor is not unique in ' + file + ': ' + from.slice(0, 90));
    src = src.replace(from, to);
  }
  fs.writeFileSync(p, src);
  console.log('patched ' + file);
}

// ---------------------------------------------------------------- native client
edit('dev/native-updates.js', [
  [
`  function currentVersion(){`,
`  // Every manifest and bundle URL carries the current time, so neither GitHub
  // Pages (max-age=600) nor raw.githubusercontent (max-age=300) can answer a
  // check with the manifest it was already serving before the release landed.
  function bust(url){
    try{
      var u = String(url);
      return u + (u.indexOf('?') < 0 ? '?' : '&') + 'scv=' + Date.now();
    }catch(e){ return url; }
  }
  function currentVersion(){`
  ],
  [
`      var _rawManifest = 'https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json';
      var resp = null;`,
`      var _rawManifest = bust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json');
      var resp = null;`
  ],
  [
`        var _fetchAttempts = [
          _rawManifest,
          MANIFEST_URL,
          'https://corsproxy.io/?' + encodeURIComponent(MANIFEST_URL),
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(MANIFEST_URL),
          'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(MANIFEST_URL)
        ];`,
`        var _pagesManifest = bust(MANIFEST_URL);
        var _fetchAttempts = [
          _rawManifest,
          _pagesManifest,
          'https://corsproxy.io/?' + encodeURIComponent(_pagesManifest),
          'https://api.allorigins.win/raw?url=' + encodeURIComponent(_pagesManifest),
          'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(_pagesManifest)
        ];`
  ],
  [
`      var _dlUrl = String(man.url).indexOf('http') === 0 ? man.url : OTA_BASE + 'ota/' + man.url;
      var _rawUrl = 'https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/update.zip';`,
`      var _dlUrl = bust(String(man.url).indexOf('http') === 0 ? man.url : OTA_BASE + 'ota/' + man.url);
      var _rawUrl = bust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/update.zip');`
  ],
]);

// ------------------------------------------------------------------------- page
edit('index.html', [
  [
`  async function nativeOtaCheckViaProxy(){`,
`  // Same stamp as the native client: the manifest is served with a cache window
  // (Pages max-age=600, raw max-age=300), so a check that lands shortly after a
  // release would otherwise be answered from the cache with the previous version
  // and report "you're on the latest version" about a build that is live.
  function scBust(url){
    try{
      var u = String(url);
      return u + (u.indexOf('?') < 0 ? '?' : '&') + 'scv=' + Date.now();
    }catch(_eBust){ return url; }
  }
  async function nativeOtaCheckViaProxy(){`
  ],
  [
`      var rawManifest = 'https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json';
      var githubPagesManifest = 'https://anekthegreat.github.io/SideCut/ota/updates.json';
      var resp = null;`,
`      var _otaBase = 'https://anekthegreat.github.io/SideCut/ota/';
      var rawManifest = scBust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/updates.json');
      var githubPagesManifest = scBust(_otaBase + 'updates.json');
      var resp = null;`
  ],
  [
`        var zipUrl = 'https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/update.zip';`,
`        var zipUrl = scBust('https://raw.githubusercontent.com/AnekTheGreat/SideCut/main/ota/update.zip');`
  ],
  [
`            var gpUrl = githubPagesManifest.replace('updates.json', '') + man.url;`,
`            var gpUrl = scBust(_otaBase + man.url);`
  ],
  [
`    var resp = await fetch('https://anekthegreat.github.io/SideCut/ota/updates.json');`,
`    var resp = await fetch(scBust('https://anekthegreat.github.io/SideCut/ota/updates.json'));`
  ],
  [
`  const APP_VERSION = '60.1.4';`,
`  const APP_VERSION = '60.1.5';`
  ],
  [
`  { version: '60.1.4', date: 'September 21, 2026 · 1:28 AM EDT', title: 'Reordering albums sticks, and Get song fetches the song itself', items: [`,
`  { version: '60.1.5', date: 'September 21, 2026 · 1:45 AM EDT', title: 'Update checks stop reading a cached answer', items: [
    'Checking for updates now always asks the server. Both places the update information is read from answer with a cache window — GitHub Pages hands the file a ten-minute cache and the raw copy five minutes — so a phone that had checked shortly before a release landed kept being given the version it already had and told \\u201cyou\\u2019re on the latest version\\u201d about a build that was already published. That is exactly what checking right after a release looked like. Every check now reads the live file, so an update is offered the moment it exists',
    'The download link is stamped the same way, so an update can never be fetched from that cache and installed under the wrong version number',
  ]},
  { version: '60.1.4', date: 'September 21, 2026 · 1:28 AM EDT', title: 'Reordering albums sticks, and Get song fetches the song itself', items: [`
  ],
]);

// -------------------------------------------------------------------- sw cache
edit('sw.js', [
  [`const CACHE_NAME = 'sidecut-shell-v60.1.4';`, `const CACHE_NAME = 'sidecut-shell-v60.1.5';`],
]);

console.log('v60.1.5 patch applied');
