#!/usr/bin/env node
// v61.2 — "there needs to be a way that SideCut gets it".
//
// A drop can be dated on Spotify weeks before release day while Apple's search
// API, Deezer and MusicBrainz do not list it at all, so the Upcoming tab stayed
// empty even though the drop was real (verified against live catalogs for
// Karan Aujla's "AUJLA SZN 1": iTunes 0 hits in us/in/gb/ca/au, Deezer 0,
// MusicBrainz 0 release-groups, Discogs 0 — Spotify had it).
//
// Three ways SideCut now gets the date, in one atomic pass over index.html:
//   1. Spotify pass  — silent token (refresh_token; never a popup during a
//      check) + /v1/artists/{id}/albums, keeping only FUTURE day-precision
//      dates credited to the pinned artist. Merged into pinnedReleases, so the
//      tabs, Home panel, bell and release page all pick it up unchanged.
//   2. Connect CTA   — both empty states ("No upcoming releases yet…") get a
//      Connect Spotify button (one-time PKCE, only on an explicit tap) that
//      re-runs the check; it relabels to "Re-check for drops" once connected.
//   3. Manual sheet  — "Add a drop manually" for a release no catalog has yet.
//
// Also bumps APP_VERSION → 61.2, sw.js cache, CHANGELOG head, and repins every
// dev/test-*.mjs `ver === '…'` assertion (same mechanics as patch-611).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
let src = fs.readFileSync(FILE, 'utf8');
let n = 0;

function replaceOnce(oldStr, newStr, label) {
  const got = src.split(oldStr).length - 1;
  if (got !== 1) throw new Error(`${label}: expected 1 occurrence, found ${got}`);
  src = src.replace(oldStr, newStr);
  n++;
  console.log('• ' + label);
}

if (src.includes('window.__scSpotifyUpcoming')) {
  console.log('patch-612: already applied');
  process.exit(0);
}

// ---------------------------------------------------------------- 1. Spotify
// Split the interactive PKCE prompt out of scSpotifySearch so the release check
// can have a SILENT token path (a background check must never open a window).
replaceOnce(
`  async function scSpotifySearch(q, type){
    var token = await scSpotifyAccessToken();
    if(token && token.length > 40 && !/^ey/.test(token)){
      var verifier = token, state = scRandomString(24), challenge = await scSpotifyPkceChallenge(verifier);
      localStorage.setItem(SC_SPOTIFY_VERIFIER_KEY, verifier); localStorage.setItem(SC_SPOTIFY_STATE_KEY, state);
      var auth = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({client_id:SC_SPOTIFY_CLIENT_ID, response_type:'code', redirect_uri:SC_SPOTIFY_REDIRECT, code_challenge_method:'S256', code_challenge:challenge, state:state});
      var pending = new Promise(function(resolve, reject){ window.__scSpotifyAuthResolve = {resolve:resolve, reject:reject}; });
      try{ if(!window.open(auth, 'sidecut-spotify-auth', 'popup,width=520,height=720')) window.location.href = auth; }catch(_e){ window.location.href = auth; }
      token = (await pending).access_token;
    }
    var response = await fetch(`,

`  // ---- Spotify: the only catalog that knows a drop date before release day --
  // Interactive connection (the authorization window) — called ONLY from an
  // explicit tap, never from a background release check.
  async function scSpotifyInteractiveToken(){
    var token = await scSpotifyAccessToken();
    if(token && token.length > 40 && !/^ey/.test(token)){
      var verifier = token, state = scRandomString(24), challenge = await scSpotifyPkceChallenge(verifier);
      localStorage.setItem(SC_SPOTIFY_VERIFIER_KEY, verifier); localStorage.setItem(SC_SPOTIFY_STATE_KEY, state);
      var auth = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({client_id:SC_SPOTIFY_CLIENT_ID, response_type:'code', redirect_uri:SC_SPOTIFY_REDIRECT, code_challenge_method:'S256', code_challenge:challenge, state:state});
      var pending = new Promise(function(resolve, reject){ window.__scSpotifyAuthResolve = {resolve:resolve, reject:reject}; });
      try{ if(!window.open(auth, 'sidecut-spotify-auth', 'popup,width=520,height=720')) window.location.href = auth; }catch(_e){ window.location.href = auth; }
      token = (await pending).access_token;
    }
    return token;
  }
  window.__scSpotifyConnect = scSpotifyInteractiveToken;
  // Silent token for the release check: the stored token while it is good, else
  // a quiet refresh_token exchange. Returns null when nothing is connected —
  // no window, no toast, the other sources simply carry on.
  async function scSpotifySilentToken(){
    var t = null; try{ t = JSON.parse(localStorage.getItem(SC_SPOTIFY_TOKEN_KEY) || 'null'); }catch(_e){}
    if(t && t.access_token && Number(t.expires_at) > Date.now() + 30000) return t.access_token;
    if(!t || !t.refresh_token) return null;
    try{
      var r = await fetch('https://accounts.spotify.com/api/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'},
        body: new URLSearchParams({ client_id: SC_SPOTIFY_CLIENT_ID, grant_type:'refresh_token', refresh_token: t.refresh_token }) });
      if(!r.ok) return null;
      var nt = await r.json();
      if(!nt || !nt.access_token) return null;
      nt.refresh_token = nt.refresh_token || t.refresh_token;
      nt.expires_at = Date.now() + ((Number(nt.expires_in) || 3600) - 60) * 1000;
      try{ localStorage.setItem(SC_SPOTIFY_TOKEN_KEY, JSON.stringify(nt)); }catch(_e2){}
      return nt.access_token;
    }catch(_e3){ return null; }
  }
  window.__scSpotifySilentToken = scSpotifySilentToken;
  // Upcoming albums/singles for one artist, straight from Spotify. Only dates
  // that are genuinely in the FUTURE and carry a known DAY are kept — a
  // month-precision placeholder or an already-released record is not a drop on
  // the way, and the tab must never fill with guesses.
  async function scFetchSpotifyUpcoming(artist){
    try{
      if(!artist) return [];
      var token = await scSpotifySilentToken();
      if(!token) return [];
      var H = { Authorization: 'Bearer ' + token };
      var rs = await fetch('https://api.spotify.com/v1/search?' + new URLSearchParams({ q: artist, type: 'artist', limit: '5' }), { headers: H });
      if(!rs || !rs.ok) return [];
      var sd = await rs.json();
      var cands = (sd.artists && sd.artists.items) || [];
      var want = String(artist).toLowerCase().trim();
      var pick = null;
      for(var i = 0; i < cands.length; i++){ if(String((cands[i] && cands[i].name) || '').toLowerCase().trim() === want){ pick = cands[i]; break; } }
      if(!pick && cands.length === 1) pick = cands[0];
      if(!pick || !pick.id) return [];
      // No market filter: a pre-save is often only registered in some storefronts.
      var ra = await fetch('https://api.spotify.com/v1/artists/' + encodeURIComponent(pick.id) + '/albums?include_groups=album,single&limit=50', { headers: H });
      if(!ra || !ra.ok) return [];
      var ad = await ra.json();
      var today = new Date().toISOString().slice(0, 10);
      var out = [];
      ((ad && ad.items) || []).forEach(function(a){
        if(!a || !a.name || !a.release_date || a.release_date_precision !== 'day') return;
        var d = String(a.release_date).slice(0, 10);
        if(!/^\\d{4}-\\d{2}-\\d{2}$/.test(d) || !(d > today)) return;
        var credits = (a.artists || []).map(function(x){ return String((x && x.name) || '').toLowerCase().trim(); });
        if(credits.indexOf(want) === -1) return; // collabs: the pinned artist must be credited
        out.push({
          title: a.name, date: d,
          art: (a.images && a.images[0] && a.images[0].url) || null,
          url: (a.external_urls && a.external_urls.spotify) || null,
          previewUrl: null, kind: 'album', cid: null, seen: false, _spt: a.id
        });
      });
      return out;
    }catch(_e){ return []; }
  }
  window.__scSpotifyUpcoming = scFetchSpotifyUpcoming;
  async function scSpotifySearch(q, type){
    var token = await scSpotifyInteractiveToken();
    var response = await fetch(`,

'spotify silent token + upcoming pass'
);

// ------------------------------------------------- 2. merge it into a check
replaceOnce(
`      // Keep all fetched releases (up to 50 per iTunes query) so nothing is lost.`,
`      // ---- Spotify: drop dates the other catalogs do not have yet ----------
      // Apple's search API, Deezer and MusicBrainz carry nothing for a release
      // that has not landed, so without this pass a real dated drop never
      // reached Upcoming releases. Best effort: no token, no network, no
      // matches — the other sources above still decide nothing about this one.
      try{
        var spFresh = (typeof window.__scSpotifyUpcoming === 'function') ? await window.__scSpotifyUpcoming(artist) : [];
        (spFresh || []).forEach(function(x){
          if(!x || !x.title || !x.date) return;
          var nt = String(x.title).toLowerCase().trim();
          var k = 'spt:' + nt + '|' + x.date;
          if(prevKeys.has(k)) return;
          for(var pi = 0; pi < prev.length; pi++){
            var pe = prev[pi];
            if(!pe || String(pe.title || '').toLowerCase().trim() !== nt) continue;
            if((window.__scDay10(pe.date) || pe.date || '') === x.date) return;      // same drop, already stored
            if(!pe.date){                                                            // dated in place, not "new"
              pe.date = x.date; pe.kind = 'album';
              if(!pe.art) pe.art = x.art;
              if(!pe.url) pe.url = x.url;
              return;
            }
          }
          fresh.push(x);
          prevKeys.add(k);
        });
      }catch(_eSp){}
      // Keep all fetched releases (up to 50 per iTunes query) so nothing is lost.`,

'spotify merge inside fetchArtistReleases'
);

// ------------------------------------------- 3. CTA wiring + manual drop sheet
replaceOnce(
`  // Query iTunes for an artist's recent tracks and merge into the snapshot.
  // Returns the list of newly-discovered releases (empty array if none/failed).
  async function fetchArtistReleases(artist){`,

`  // ---------------- Upcoming releases: two ways to hand SideCut a date --------
  // Shipped inside the empty state ("No upcoming releases yet — pin an artist
  // whose next drop is dated.") in BOTH surfaces: the Fetch latest popup (block
  // 2) and the Home bubble. Both call this; it is on window because block 2
  // cannot see this IIFE's scope.
  window.__scWireUpcomingCta = function(el){
    try{
      if(!el || el._scUpWired) return;
      el._scUpWired = true;
      var wrap = document.createElement('div');
      wrap.style.cssText = 'display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin-top:12px;';
      var cbtn = document.createElement('button');
      cbtn.className = 'sc-up-cta sc-up-cta-connect';
      cbtn.style.cssText = 'padding:10px 16px;border-radius:999px;border:1px solid var(--gold);background:rgba(227,178,60,0.12);color:var(--gold);font-size:12.5px;font-weight:700;cursor:pointer;';
      cbtn.textContent = 'Connect Spotify';
      var abtn = document.createElement('button');
      abtn.className = 'sc-up-cta sc-up-cta-add';
      abtn.style.cssText = 'padding:10px 16px;border-radius:999px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink);font-size:12.5px;font-weight:700;cursor:pointer;';
      abtn.textContent = 'Add a drop manually';
      wrap.appendChild(cbtn); wrap.appendChild(abtn);
      el.appendChild(wrap);
      var hint = document.createElement('div');
      hint.style.cssText = 'font-size:11.5px;color:var(--ink-dim);margin-top:10px;line-height:1.45;max-width:46ch;margin-left:auto;margin-right:auto;';
      hint.textContent = 'A drop is often only listed on Spotify before release day — connect once and SideCut reads the date from there too.';
      el.appendChild(hint);
      cbtn.addEventListener('click', function(){ window.__scUpcomingConnectTap(cbtn); });
      abtn.addEventListener('click', function(){ window.__scAddUpcomingDrop(); });
      try{
        var st = JSON.parse(localStorage.getItem(SC_SPOTIFY_TOKEN_KEY) || 'null');
        if(st && st.access_token && Number(st.expires_at) > Date.now()) cbtn.textContent = 'Re-check for drops';
      }catch(_eLbl){}
    }catch(_eWire){}
  };
  // Refetch + repaint everything the release lists draw from. When the New
  // Releases popup is open we reuse its own button handler, because the popup's
  // HTML (and therefore the tabs' counts) is only ever built there.
  window.__scRebuildReleaseLists = async function(doFetch){
    var popupOpen = false;
    try{
      var ov = document.getElementById('discPopupOverlay');
      popupOpen = !!(ov && getComputedStyle(ov).display !== 'none');
    }catch(_eOv){}
    var tEl = document.getElementById('discPopupTitle');
    var fb = document.getElementById('discoverFetchLatest');
    var onReleasePopup = popupOpen && tEl && String(tEl.textContent || '').indexOf('New Releases') !== -1 && fb && fb.onclick;
    if(onReleasePopup){ try{ await fb.onclick(); }catch(_eFb){} return; }
    if(doFetch){ try{ await checkPinnedArtistReleases(); }catch(_eChk){} }
    try{ renderNewReleases(); }catch(_e1){}
    try{ renderHome(); }catch(_e2){}
    try{ updateNotifBadge(); }catch(_e3){}
  };
  // Explicit tap only: this is the ONE place the authorization window may open.
  window.__scUpcomingConnectTap = async function(btn){
    try{ if(btn){ btn.textContent = 'Connecting\\u2026'; btn.disabled = true; } }catch(_eB0){}
    var ok = false;
    try{ await scSpotifyInteractiveToken(); ok = true; }
    catch(_eConn){ toast('Spotify connection was cancelled \\u2014 you can still add the drop by hand.', 3600); }
    try{ if(btn){ btn.textContent = ok ? 'Checking\\u2026' : 'Add a drop manually'; btn.disabled = false; } }catch(_eB1){}
    if(ok){ try{ await window.__scRebuildReleaseLists(true); }catch(_eRb){} }
    try{ if(btn) btn.textContent = 'Re-check for drops'; }catch(_eB2){}
  };
  // For a drop no catalog has listed yet: artist, title, date — stored exactly
  // like a fetched release, so it flows into the tabs, bell, Home and the
  // countdown page with no special-casing anywhere else.
  window.__scAddUpcomingDrop = function(){
    try{
      if(document.getElementById('scAddDropSheet')) return;
      var ov = document.createElement('div');
      ov.id = 'scAddDropSheet';
      ov.style.cssText = 'position:fixed;left:0;top:0;right:0;bottom:0;z-index:12500;background:rgba(0,0,0,0.68);display:flex;align-items:flex-end;justify-content:center;';
      var card = document.createElement('div');
      card.style.cssText = 'width:min(100%,540px);background:var(--card,#1a2c33);border:1px solid var(--line);border-radius:16px 16px 0 0;padding:16px 16px calc(18px + env(safe-area-inset-bottom));box-sizing:border-box;';
      var field = 'width:100%;box-sizing:border-box;padding:11px 12px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink);font-size:14px;margin-bottom:10px;';
      var names = (typeof pinnedArtists !== 'undefined' ? pinnedArtists : []).map(function(a){ return a && a.name ? a.name : ''; }).filter(Boolean);
      card.innerHTML = [
        '<div style="font-size:16px;font-weight:800;margin-bottom:4px;">Add an upcoming drop</div>',
        '<div style="font-size:12px;color:var(--ink-dim);margin-bottom:14px;line-height:1.45;">For a release no store has listed yet. SideCut counts it down like any other drop.</div>',
        '<input id="scAddDropArtist" list="scAddDropArtistList" placeholder="Artist name" autocomplete="off" style="' + field + '">',
        '<datalist id="scAddDropArtistList">' + names.map(function(nm){ return '<option value="' + String(nm).replace(/"/g, '&quot;') + '"></option>'; }).join('') + '</datalist>',
        '<input id="scAddDropTitle" placeholder="Release title (e.g. AUJLA SZN 1)" autocomplete="off" style="' + field + '">',
        '<input id="scAddDropDate" type="date" style="' + field + '">',
        '<div style="display:flex;gap:10px;margin-top:6px;">',
          '<button id="scAddDropCancel" style="flex:0 0 38%;padding:12px;border-radius:10px;border:1px solid var(--line);background:rgba(255,255,255,0.05);color:var(--ink);font-size:14px;font-weight:600;cursor:pointer;">Cancel</button>',
          '<button id="scAddDropSave" style="flex:1;padding:12px;border-radius:10px;border:none;background:var(--gold,#e7b23c);color:#161616;font-size:14px;font-weight:700;cursor:pointer;">Save drop</button>',
        '</div>'
      ].join('');
      ov.appendChild(card);
      document.body.appendChild(ov);
      var close = function(){ try{ ov.remove(); }catch(_eCl){} };
      ov.addEventListener('click', function(e){ if(e.target === ov) close(); });
      card.querySelector('#scAddDropCancel').addEventListener('click', close);
      try{
        var dEl = card.querySelector('#scAddDropDate');
        var tEl = new Date(); tEl.setDate(tEl.getDate() + 7);
        dEl.value = tEl.toISOString().slice(0, 10);
      }catch(_eDv){}
      card.querySelector('#scAddDropSave').addEventListener('click', function(){
        var artist = String(card.querySelector('#scAddDropArtist').value || '').trim();
        var title = String(card.querySelector('#scAddDropTitle').value || '').trim();
        var date = window.__scDay10(card.querySelector('#scAddDropDate').value || '');
        if(!artist || !title || !date){ toast('Artist, title and a real date are all needed.', 3000); return; }
        // Prefer the pinned spelling so later checks merge into the same entry.
        var aKey = artist;
        try{
          (typeof pinnedArtists !== 'undefined' ? pinnedArtists : []).forEach(function(a){
            if(a && a.name && String(a.name).toLowerCase().trim() === artist.toLowerCase().trim()) aKey = a.name;
          });
        }catch(_eAk){}
        if(!pinnedReleases[aKey]) pinnedReleases[aKey] = [];
        var arr = pinnedReleases[aKey];
        var nt = title.toLowerCase().trim();
        for(var i = 0; i < arr.length; i++){
          if(String(arr[i].title || '').toLowerCase().trim() === nt && (window.__scDay10(arr[i].date) || arr[i].date) === date){
            toast('That drop is already listed.', 2600); close(); return;
          }
        }
        arr.push({ title: title, date: date, art: null, url: null, previewUrl: null, kind: 'album', cid: null, seen: false, _manual: true });
        arr.sort(function(x, y){ return String(y.date || '').localeCompare(String(x.date || '')); });
        try{ savePinnedArtists(); }catch(_eSv){}
        close();
        var today = new Date().toISOString().slice(0, 10);
        try{
          toast(date > today
            ? 'Added \\u2014 ' + title + ' drops on ' + date + '.'
            : 'Saved \\u2014 that date has passed, so it will not appear under Upcoming.', 3600);
        }catch(_eTt){}
        try{ window.__scRebuildReleaseLists(false); }catch(_eRb2){}
      });
    }catch(_eSheet){ }
  };

  // Query iTunes for an artist's recent tracks and merge into the snapshot.
  // Returns the list of newly-discovered releases (empty array if none/failed).
  async function fetchArtistReleases(artist){`,

'CTA + manual drop sheet'
);

// ------------------------------------------------- 4. wire both empty states
replaceOnce(
`            _hbEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';
            body.appendChild(_hbEmpty);`,
`            _hbEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';
            try{ if(typeof window.__scWireUpcomingCta === 'function') window.__scWireUpcomingCta(_hbEmpty); }catch(_eUpCta){}
            body.appendChild(_hbEmpty);`,

'Home bubble empty state CTA'
);

replaceOnce(
`      _upEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';
      bEl.appendChild(_upEmpty);`,
`      _upEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';
      try{ if(typeof window.__scWireUpcomingCta === 'function') window.__scWireUpcomingCta(_upEmpty); }catch(_eUpCta2){}
      bEl.appendChild(_upEmpty);`,

'Fetch latest popup empty state CTA'
);

// ------------------------------------------------------------ 5. the release
function easternStamp() {
  const d = new Date(Date.now() - 4 * 3600 * 1000);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = d.getUTCHours();
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  const mm = String(d.getUTCMinutes()).padStart(2, '0');
  return `${months[d.getUTCMonth()]} ${d.getUTCDate()}, ${d.getUTCFullYear()} · ${h}:${mm} ${ampm} EDT`;
}

replaceOnce(`  const APP_VERSION = '61.1';`, `  const APP_VERSION = '61.2';`, 'APP_VERSION → 61.2');

const HEAD = `  { version: '61.1', date: 'September 23, 2026 · 8:13 PM EDT', title: 'The home widget moves again, and Upcoming releases stops counting the past', items: [`;
{
  const got = src.split(HEAD).length - 1;
  if (got !== 1) throw new Error(`changelog head: expected 1 occurrence, found ${got}`);
  const entry = `  { version: '61.2', date: '${easternStamp()}', title: 'SideCut learns the drop dates only Spotify knows', items: [
    'Upcoming releases now reads drop dates from Spotify: when a release is listed there weeks before it lands \\u2014 which is exactly how Apple\\u2019s, Deezer\\u2019s and MusicBrainz\\u2019s catalogs behave, they carry nothing until release day \\u2014 SideCut takes the date and counts it down with everything else. The tab, the Home panel, the bell and the release page all read the same stored date, so they agree.',
    'That pass runs silently on the connection already on your device: it refreshes the token quietly and never opens an authorization window while a check is running, so Fetch latest and the automatic check stay exactly as hands-off as before.',
    'The empty Upcoming tab now tells you how to make it find your drop: a Connect Spotify button runs the one-time connection and immediately re-checks, and once you are connected it turns into a plain re-check button.',
    'Nothing to connect? The same empty state has an "Add a drop manually" sheet \\u2014 artist, title and date \\u2014 and the release lands in the countdown list, the bell and the release page like any fetched one.',
    'A release SideCut already listed without a date gets the Spotify date written straight onto it instead of being added a second time.',
    'Only genuinely future dates that name a real day are taken: month-precision placeholders and anything already released are ignored, so the tab never fills with guesses.',
  ] },
`;
  src = src.replace(HEAD, entry + HEAD);
  n++;
  console.log('• changelog head entry → 61.2');
}

const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
if (sw.includes(`const CACHE_NAME = 'sidecut-shell-v61.1';`)) {
  sw = sw.replace(`const CACHE_NAME = 'sidecut-shell-v61.1';`, `const CACHE_NAME = 'sidecut-shell-v61.2';`);
  fs.writeFileSync(SW, sw);
  console.log('• sw.js cache → sidecut-shell-v61.2');
} else if (!sw.includes('sidecut-shell-v61.2')) {
  throw new Error('sw.js: unexpected CACHE_NAME');
}

fs.writeFileSync(FILE, src);

let pinned = 0;
for (const f of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(f)) continue;
  const p = path.join(ROOT, 'dev', f);
  const t = fs.readFileSync(p, 'utf8');
  if (t.includes(`ver === '61.1'`)) {
    fs.writeFileSync(p, t.split(`ver === '61.1'`).join(`ver === '61.2'`));
    pinned++;
    console.log('• repinned dev/' + f);
  }
}
console.log(`patch-612: index.html ${n} replacements, ${pinned} test pins`);
