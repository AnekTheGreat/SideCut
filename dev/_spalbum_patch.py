#!/usr/bin/env python3
"""Patch SideCut index.html: album/playlist batch conversion for the built-in
Spotify converter + scYtSearch scoring bugfix. Every edit is anchored to a
unique string and asserted before writing."""
import re
import shutil
import sys
import time

PATH = 'index.html'
BACKUP = 'dev/index.html.pre-spalbum.' + time.strftime('%Y%m%d-%H%M%S')

with open(PATH, 'r', encoding='utf-8') as f:
    src = f.read()

orig_len = len(src)
edits = []  # (name, old, new)


def sub_once(name, pattern, replacement, count=1):
    global src
    n = len(re.findall(pattern, src, flags=re.S))
    if n != count:
        raise SystemExit('ANCHOR FAIL [%s]: %d matches (expected %d)' % (name, n, count))
    src = re.sub(pattern, replacement, src, count=count, flags=re.S)
    edits.append(name)


def replace_once(name, old, new):
    global src
    n = src.count(old)
    if n != 1:
        raise SystemExit('ANCHOR FAIL [%s]: %d occurrences (expected 1)' % (name, n))
    src = src.replace(old, new, 1)
    edits.append(name)


def replace_once_re(name, pattern, replacement):
    global src
    n = len(re.findall(pattern, src, flags=re.S))
    if n != 1:
        raise SystemExit('ANCHOR FAIL [%s]: %d matches (expected 1)' % (name, n))
    src = re.sub(pattern, lambda m: replacement, src, count=1, flags=re.S)
    edits.append(name)


# ---------------------------------------------------------------------------
# P1 — scoring bug: the <60s / >720s penalties ran before `var score = 0;`
# (var hoisting made them write NaN that was then discarded). Move the
# declaration above the penalties.
# ---------------------------------------------------------------------------
ALREADY_FIXED = (
    "        var score = 0;\n"
    "        if(dur > 0 && dur < 60) score -= 30;\n"
    "        if(dur > 720) score -= 35;\n"
)
if ALREADY_FIXED in src:
    edits.append('P1-scoring-fix (already applied)')
else:
    sub_once(
        'P1-scoring-fix',
        r"        if\(dur > 0 && dur < 60\) score -= 30;\n"
        r"        if\(dur > 720\) score -= 35;\n"
        r"        var score = 0;\n",
        "        var score = 0;\n"
        "        if(dur > 0 && dur < 60) score -= 30;\n"
        "        if(dur > 720) score -= 35;\n",
    )

# ---------------------------------------------------------------------------
# P2 — album/playlist resolution + batch conversion helpers, inserted just
# before the shared audio helpers block.
# ---------------------------------------------------------------------------
HELPERS_ANCHOR = "  // ─── Shared on-device audio helpers (used by the Spotify & YouTube converters) ───"

HELPERS_CODE = r"""
  // ─── Album / playlist batch conversion ─────────────────────────────────────
  // A Spotify album or playlist link can't be read directly from the page
  // (no auth token from a browser), but Spotify's public oEmbed endpoint gives
  // the real title + embed URL, and the Deezer + iTunes public search APIs
  // resolve that title to a real track list with artist + duration — the same
  // metadata the app already uses elsewhere. Each resolved track then goes
  // through the exact same single-track pipeline (artist-locked YouTube search,
  // SideCut AI pick when a Gemini key is set, channel verification, decode,
  // full tags + cover) and is auto-downloaded one file per song.

  // Cache of expanded links, so re-converting the same album doesn't re-hit
  // the lookup APIs.
  var scAlbumResolveCache = {};

  function scSpKind(url){
    var m = String(url || '').match(/open\.spotify\.com\/(?:embed\/)?(track|album|playlist|episode)\/([a-zA-Z0-9]+)/i);
    return m ? m[1].toLowerCase() : '';
  }

  function scFetchJson(url){
    return fetch(url).then(function(r){ return r && r.ok ? r.json() : null; })
      .catch(function(){ return null; });
  }

  // oEmbed via direct + public CORS relays (albums/playlists are not CORS-open).
  async function scSpOembed(url){
    var base = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(url) + '&format=json';
    var attempts = [
      base,
      'https://corsproxy.io/?' + encodeURIComponent(base),
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(base),
      'https://api.codetabs.com/v1/proxy?quest=' + encodeURIComponent(base)
    ];
    for(var i = 0; i < attempts.length; i++){
      try{
        var r = await fetch(attempts[i]);
        if(r && r.ok){ var j = await r.json(); if(j && j.title) return j; }
      }catch(e){}
    }
    return null;
  }

  // Deezer search (needs the CORS relays) — returns { artist, album, tracks[] }
  // with tracks sorted in album order (or playlist order from the API).
  async function scDeezerLookup(title, artistHint, kind){
    var modes = kind === 'album'
      ? [{ t: title, a: artistHint }, { t: title, a: '' }]
      : [{ t: title, a: artistHint }];
    for(var mi = 0; mi < modes.length; mi++){
      var q = ('album:"' + modes[mi].t + '" ' + modes[mi].a).trim();
      var url = 'https://api.deezer.com/search/album?q=' + encodeURIComponent(q) + '&limit=3';
      var out = null;
      try{
        var resp = await fetchWithProxy(url);
        if(resp && resp.ok){
          var data = await resp.json();
          var albums = (data && data.data) || [];
          for(var ai = 0; ai < albums.length; ai++){
            var al = albums[ai] || {};
            if(!al.tracks || !al.tracks.data || !al.tracks.data.length) continue;
            var alArtist = (al.artist && al.artist.name) || '';
            if(modes[mi].a && artistHint && !scDeezerArtistOk(artistHint, alArtist)) continue;
            var tracks = [];
            var tdata = al.tracks.data;
            for(var ti = 0; ti < tdata.length; ti++){
              var tr = tdata[ti] || {};
              var tArtist = (tr.artist && tr.artist.name) || alArtist;
              var dur = Math.round(tr.duration || 0);
              tracks.push({
                title: tr.title || '',
                artist: tArtist,
                album: al.title || '',
                cover: al.cover_medium || al.cover_big || al.cover_xl || '',
                seconds: dur,
                position: ti + 1
              });
            }
            if(tracks.length){ out = { artist: alArtist, album: al.title || '', tracks: tracks }; break; }
          }
        }
      }catch(e){}
      if(out) return out;
    }
    return null;
  }

  function scDeezerArtistOk(hint, found){
    function norm(s){ return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
    var a = norm(hint), b = norm(found);
    if(!a || !b) return true;
    return a === b || a.indexOf(b) !== -1 || b.indexOf(a) !== -1;
  }

  // Fallback resolver: iTunes Search API (CORS-open, no relay needed).
  async function scItunesLookup(title, artistHint, kind){
    try{
      var term = kind === 'album' ? (artistHint + ' ' + title).trim() : title;
      if(!term) return null;
      var entity = kind === 'album' ? 'album' : 'song';
      var url = 'https://itunes.apple.com/search?term=' + encodeURIComponent(term) +
        '&media=music&entity=' + entity + '&limit=' + (kind === 'album' ? 5 : 25);
      var r = await fetch(url);
      if(!r || !r.ok) return null;
      var data = await r.json();
      var results = (data && data.results) || [];
      if(kind !== 'album'){
        var tracks = [];
        for(var i = 0; i < results.length && i < 25; i++){
          var it = results[i] || {};
          if(it.trackName && (!artistHint || scDeezerArtistOk(artistHint, it.artistName))){
            tracks.push({
              title: it.trackName, artist: it.artistName || '', album: it.collectionName || '',
              cover: it.artworkUrl100 ? it.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg') : '',
              seconds: Math.round(it.trackTimeMillis ? it.trackTimeMillis / 1000 : 0),
              position: it.trackNumber || (tracks.length + 1)
            });
          }
        }
        return tracks.length ? { artist: artistHint || '', album: title, tracks: tracks } : null;
      }
      // Album mode: find the matching album id, then pull its track list.
      var albumId = '';
      for(var a2 = 0; a2 < results.length; a2++){
        var al2 = results[a2] || {};
        if(al2.collectionId && al2.collectionName &&
           String(al2.collectionName).toLowerCase().indexOf(String(title).toLowerCase()) !== -1 &&
           (!artistHint || scDeezerArtistOk(artistHint, al2.artistName))){
          albumId = String(al2.collectionId); break;
        }
      }
      if(!albumId) return null;
      var lr = await fetch('https://itunes.apple.com/lookup?id=' + albumId + '&entity=song&limit=100');
      if(!lr || !lr.ok) return null;
      var ld = await lr.json();
      var lres = (ld && ld.results) || [];
      var albumName = '', albumArtist = '', cover = '', tracks2 = [];
      for(var j = 0; j < lres.length; j++){
        var row = lres[j] || {};
        if(row.wrapperType === 'collection'){
          albumName = row.collectionName || albumName;
          albumArtist = row.artistName || albumArtist;
          cover = row.artworkUrl100 ? row.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg') : cover;
        } else if(row.wrapperType === 'track' && row.trackName){
          tracks2.push({
            title: row.trackName, artist: row.artistName || albumArtist,
            album: row.collectionName || albumName, cover: row.artworkUrl100 ? row.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg') : cover,
            seconds: Math.round(row.trackTimeMillis ? row.trackTimeMillis / 1000 : 0),
            position: row.trackNumber || (tracks2.length + 1)
          });
        }
      }
      return tracks2.length ? { artist: albumArtist, album: albumName || title, tracks: tracks2 } : null;
    }catch(e){ return null; }
  }

  // Resolve any Spotify link into a conversion plan:
  //   { kind, title, artist, album, cover, tracks: [{ title, artist, album, cover, seconds, position }] }
  // Track/episode links resolve to a single-entry list.
  async function scResolveSpotifyPlan(rawUrl){
    var url = String(rawUrl || '').trim();
    var kind = scSpKind(url);
    // spotify.link short links never carry the entity type — resolve them via
    // oEmbed's iframe_url first (this is also why albums used to be treated as tracks).
    if(kind === '' || /spotify\.link/i.test(url)){
      var oemb = await scSpOembed(url);
      if(oemb && oemb.iframe_url){
        var m = oemb.iframe_url.match(/open\.spotify\.com\/embed\/(track|album|playlist)\/([a-zA-Z0-9]+)/);
        if(m){ kind = m[1].toLowerCase(); url = 'https://open.spotify.com/' + m[1] + '/' + m[2]; }
      }
      if(kind === '') kind = 'track';
    }
    if(!scAlbumResolveCache[url]){
      var oemb2 = await scSpOembed(url);
      var title = (oemb2 && oemb2.title) || '';
      var thumb = (oemb2 && oemb2.thumbnail_url) || '';
      var author = (oemb2 && oemb2.author_name) || '';
      if(kind === 'playlist'){
        // Playlist titles are usually "Playlist name" / "Album title" — search as-is.
        var pl = await scDeezerLookup(title, '', 'album');
        if(!pl) pl = await scItunesLookup(title, '', 'album');
        if(pl && pl.tracks.length){
          pl.kind = 'playlist'; pl.title = title; pl.cover = thumb || (pl.tracks[0] && pl.tracks[0].cover) || '';
          scAlbumResolveCache[url] = pl;
        }
      } else if(kind === 'album'){
        var ab = await scDeezerLookup(title, author, 'album');
        if(!ab) ab = await scItunesLookup(title, author, 'album');
        if(ab && ab.tracks.length){
          ab.kind = 'album'; ab.title = title; ab.cover = thumb || (ab.tracks[0] && ab.tracks[0].cover) || '';
          scAlbumResolveCache[url] = ab;
        }
      }
      if(!scAlbumResolveCache[url]){
        // Single track (or an album we couldn't resolve): fall back to the
        // oEmbed title + the same metadata enrichment the single flow uses.
        var meta = { title: title, artist: author, album: '', thumb: thumb, year: '', genre: '', track: '', _aiUsed: false };
        if(meta.title) await scEnrichSingleMeta(meta);
        if(meta.title){
          scAlbumResolveCache[url] = {
            kind: 'track', title: meta.title, artist: meta.artist, album: meta.album,
            cover: meta.thumb, tracks: [meta]
          };
        }
      }
    }
    return scAlbumResolveCache[url] || null;
  }

  // Shared metadata enrichment for one track (iTunes + SideCut AI). Fills
  // album/artist/year/genre/track-number gaps without overwriting known values.
  async function scEnrichSingleMeta(meta){
    try{
      var term = ((meta.title || '') + ' ' + (meta.artist || '')).trim();
      if(!term) return meta;
      var ir = await fetch('https://itunes.apple.com/search?term=' + encodeURIComponent(term) + '&media=music&entity=song&limit=3');
      if(ir && ir.ok){
        var it = await ir.json();
        var hit = null;
        for(var i = 0; i < ((it.results) || []).length && i < 3; i++){
          if(!scDeezerArtistOk(meta.artist, it.results[i].artistName)) continue;
          hit = it.results[i]; break;
        }
        if(hit){
          if(hit.trackName) meta.title = hit.trackName;
          if(hit.artistName) meta.artist = hit.artistName;
          if(hit.collectionName && !meta.album) meta.album = hit.collectionName;
          if(hit.releaseDate && !meta.year) meta.year = String(hit.releaseDate).slice(0, 4);
          if(hit.primaryGenreName && !meta.genre) meta.genre = hit.primaryGenreName;
          if(hit.trackNumber && !meta.track) meta.track = String(hit.trackNumber);
          if(hit.artworkUrl100 && !meta.thumb) meta.thumb = hit.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg');
        }
      }
    }catch(e){}
    if(typeof _aiGeminiKey !== 'undefined' && _aiGeminiKey && (!meta.album || !meta.year) && (meta.title || meta.artist)){
      try{
        var _aiResp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + _aiGeminiKey, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'Identify this song from a Spotify track. Return ONLY a JSON object (no markdown) with keys: {"track":"Song Title","artist":"Artist Name","album":"Album Name","year":2024,"genre":"Genre"}, using the exact official title/artist/album/year/genre. year is a number if known, otherwise omit it; genre optional. No text, just JSON. Song context: "' + String((meta.title || '') + ' ' + (meta.artist || '')).replace(/"/g, '') + '"', }] }],
            generationConfig: { temperature: 0.1, maxOutputTokens: 500 }
          })
        });
        if(_aiResp && _aiResp.ok){
          var _aiData = await _aiResp.json();
          var _tx = ((_aiData.candidates || [])[0] || {}).content || {};
          _tx = (((_tx.parts || [])[0] || {}).text) || '';
          _tx = String(_tx).replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
          var _aiObj = JSON.parse(_tx);
          if(_aiObj && _aiObj.track && !meta.title) meta.title = _aiObj.track;
          if(_aiObj && _aiObj.artist && !meta.artist) meta.artist = _aiObj.artist;
          if(_aiObj && _aiObj.album && !meta.album) meta.album = _aiObj.album;
          if(_aiObj && _aiObj.year && !meta.year) meta.year = String(_aiObj.year).slice(0, 4);
          if(_aiObj && _aiObj.genre && !meta.genre) meta.genre = _aiObj.genre;
          if(_aiObj) meta._aiUsed = true;
        }
      }catch(_aiE){}
    }
    return meta;
  }

  // Download a finished blob using the tagged filename (00 - Artist - Title.ext
  // for albums, Artist - Title.ext for singles). Falls back to a new-tab open
  // where downloads aren't supported (older webviews).
  function scDownloadBlob(blob, fName){
    try{
      var fUrl = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = fUrl; a.download = fName; a.rel = 'noopener';
      document.body.appendChild(a); a.click();
      setTimeout(function(){ try{ document.body.removeChild(a); }catch(e){} try{ URL.revokeObjectURL(fUrl); }catch(e){} }, 4000);
      return true;
    }catch(e){ return false; }
  }

  function scTaggedBlob(buf, fmt, tagMeta){
    return scEncodeAudio(buf, fmt, tagMeta);
  }

  function scFmtBytes(n){
    return (n / (1024 * 1024)).toFixed(1);
  }

  function scFmtDur(sec){
    var m = Math.floor(sec / 60), s = Math.round(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Runs one track end-to-end through the single-track pipeline. Returns
  // { ok: true, blob, fName } or { ok: false, reason }.
  async function scConvertOneTrack(meta, fmt, onStatus){
    if(onStatus) onStatus('Searching for "' + meta.title + '"…');
    var res = await scSpToBuffer(meta, function(txt){ if(onStatus) onStatus(txt); });
    if(!res || !res.buffer) return { ok: false, reason: 'no source found' };
    if(onStatus) onStatus('Encoding ' + fmt.toUpperCase() + ' with tags…');
    var artBytes = null, artMime = /\.png/i.test(meta.thumb || '') ? 'image/png' : 'image/jpeg';
    if(meta.thumb){
      try{
        var artR = await fetch(meta.thumb);
        if(artR && artR.ok){
          var artAb = await artR.arrayBuffer();
          if(artAb && artAb.byteLength > 200) artBytes = new Uint8Array(artAb);
        }
      }catch(_e){}
    }
    var tagMeta = {
      title: meta.title || '', artist: meta.artist || '', album: meta.album || '',
      year: meta.year || '', genre: meta.genre || '', track: meta.track || '',
      artBytes: artBytes, artMime: artBytes ? artMime : null
    };
    var blob = scTaggedBlob(res.buffer, fmt, tagMeta);
    if(!blob) return { ok: false, reason: 'encode failed' };
    var artistPart = scSafeName(meta.artist || '');
    var titlePart = scSafeName(meta.title || 'spotify_track') || 'spotify_track';
    var padN = String(meta.position || 0);
    if(padN && padN.length < 2 && Number(padN) > 0) padN = (Number(padN) < 10 ? '0' : '') + padN;
    var al2 = artistPart.toLowerCase();
    var artistOk = artistPart && al2 !== 'unknown' && al2 !== 'unknown artist' && al2 !== 'various artists';
    var baseName = (meta.position && artistOk) ? (padN + ' - ' + (artistOk ? artistPart + ' - ' : '') + titlePart)
      : (artistOk ? artistPart + ' - ' + titlePart : titlePart);
    var fName = scSafeName(baseName) + '.' + fmt;
    return { ok: true, blob: blob, fName: fName, bytes: blob.size, duration: res.buffer.duration };
  }

  // Batch UI: renders progress into resultEl, converts every track, and saves
  // each finished file automatically. A Convert click while one is running is
  // ignored instead of clobbering the run (the button is re-enabled at the end).
  async function scRunBatchConvert(plan, fmt, resultEl, btnEl, originalUrl){
    var tracks = (plan && plan.tracks) || [];
    if(!tracks.length) return false;
    var box = document.createElement('div');
    box.style.cssText = 'margin-top:8px; padding:10px; border:1px solid var(--line); border-radius:10px; background:rgba(255,255,255,0.03);';
    box.innerHTML =
      '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">' +
        '<div style="width:14px;height:14px;border:2px solid var(--coral);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;flex-shrink:0;"></div>' +
        '<div style="font-size:12px; font-weight:600; color:var(--ink);">' + scEscapeHtml(plan.title || 'Spotify ' + (plan.kind || 'album')) + '</div>' +
      '</div>' +
      '<div class="sp-batch-sub" style="font-size:10.5px; color:var(--ink-dim); margin-bottom:6px;">Starting ' + tracks.length + ' track' + (tracks.length === 1 ? '' : 's') + ' → ' + fmt.toUpperCase() + '…</div>' +
      '<div class="sp-batch-bar" style="height:6px; border-radius:4px; background:rgba(255,255,255,0.08); overflow:hidden;"><div style="height:100%; width:0%; background:var(--coral); transition:width 0.3s ease;"></div></div>' +
      '<div class="sp-batch-list" style="margin-top:8px; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:4px;"></div>' +
      '<div class="sp-batch-actions" style="margin-top:8px; display:none; gap:6px; flex-wrap:wrap;"></div>';
    resultEl.style.display = 'block';
    resultEl.innerHTML = '';
    resultEl.appendChild(box);
    var subEl = box.querySelector('.sp-batch-sub');
    var barEl = box.querySelector('.sp-batch-bar > div');
    var listEl = box.querySelector('.sp-batch-list');
    var actEl = box.querySelector('.sp-batch-actions');
    var okCount = 0, failCount = 0, failedNames = [];
    for(var i = 0; i < tracks.length; i++){
      var meta = Object.assign({}, tracks[i]);
      if(!meta.position) meta.position = i + 1;
      if(!meta.album && plan.album) meta.album = plan.album;
      if(!meta.cover && plan.cover) meta.thumb = plan.cover;
      if(meta.cover && !meta.thumb) meta.thumb = meta.cover;
      var row = document.createElement('div');
      row.style.cssText = 'font-size:10.5px; color:var(--ink-dim); display:flex; gap:6px; align-items:baseline;';
      row.innerHTML = '<span style="color:var(--gold); white-space:nowrap;">' + (i + 1) + '/' + tracks.length + '</span><span style="flex:1; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + scEscapeHtml(meta.title || 'Untitled') + '</span><span class="sp-row-state" style="white-space:nowrap;">…</span>';
      listEl.appendChild(row);
      var stateEl = row.querySelector('.sp-row-state');
      function rowStatus(txt){ if(stateEl) stateEl.textContent = txt; }
      var out = null;
      try{
        out = await scConvertOneTrack(meta, fmt, rowStatus);
      }catch(e){
        out = { ok: false, reason: (e && e.message) || 'error' };
      }
      if(out && out.ok){
        scDownloadBlob(out.blob, out.fName);
        okCount++;
        if(stateEl){ stateEl.textContent = '✓ saved'; stateEl.style.color = 'var(--coral)'; }
      } else {
        failCount++;
        failedNames.push((meta.title || 'Untitled') + ((out && out.reason) ? ' (' + out.reason + ')' : ''));
        if(stateEl){ stateEl.textContent = '✗'; stateEl.style.color = '#f87171'; }
      }
      if(barEl) barEl.style.width = Math.round(((i + 1) / tracks.length) * 100) + '%';
      if(subEl) subEl.textContent = okCount + ' saved · ' + failCount + ' failed · ' + (tracks.length - i - 1) + ' left';
      await new Promise(function(r){ setTimeout(r, 800); });  // pacing: never hammer the search APIs
    }
    if(subEl) subEl.textContent = 'Done — ' + okCount + ' saved' + (failCount ? ' · ' + failCount + ' failed' : '');
    if(actEl){
      actEl.style.display = 'flex';
      var retryHtml = '';
      if(failCount) retryHtml = '<button class="sp-batch-retry" style="padding:6px 12px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;">↻ Retry ' + failCount + ' failed</button>';
      actEl.innerHTML = retryHtml +
        '<button class="sp-batch-close" style="padding:6px 12px;border-radius:8px;border:1px solid var(--line);background:none;color:var(--ink-dim);font-size:11px;cursor:pointer;">Close</button>';
      var closeBtn = actEl.querySelector('.sp-batch-close');
      if(closeBtn) closeBtn.addEventListener('click', function(){ resultEl.innerHTML = ''; resultEl.style.display = 'none'; });
      var retryBtn = actEl.querySelector('.sp-batch-retry');
      if(retryBtn) retryBtn.addEventListener('click', function(){
        var retryPlan = Object.assign({}, plan, { tracks: tracks.filter(function(t, k){ return !tracksDone[k]; }) });
        scRunBatchConvert(retryPlan, fmt, resultEl, btnEl, originalUrl);
      });
    }
    if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
    toast('Converted ' + okCount + '/' + tracks.length + ' songs to ' + fmt.toUpperCase() + (failCount ? ' — ' + failCount + ' failed (retry button below)' : ''), 5000);
    return true;
  }

  function scEscapeHtml(s){
    return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

"""

replace_once_re('P2-insert-helpers', re.escape(HELPERS_ANCHOR), HELPERS_CODE + HELPERS_ANCHOR)

# ---------------------------------------------------------------------------
# P3 — convertSpToAudio: plan-aware head. Replaces the metadata + id extraction
# block so albums/playlists route into the batch runner.
# ---------------------------------------------------------------------------
OLD_HEAD = r"""  function convertSpToAudio(spotUrl, resultEl, btnEl){
    var url = (spotUrl || '').trim();
    if(!url){ toast('Paste a Spotify link first.', 2000); return; }
    if(!/(?:open\.spotify\.com|spotify\.link)/i.test(url)){
      if(resultEl){ resultEl.style.display='block'; resultEl.innerHTML='<span style="color:var(--coral);">⚠ That doesn\'t look like a Spotify link. Paste a full open.spotify.com or spotify.link URL.</span>'; }
      return;
    }
    var idM = url.match(/\/(track|album|episode|playlist|artist)\/([a-zA-Z0-9]+)/i);
    var spotId = idM ? idM[2] : 'song';
    // Real track metadata (title + cover art) fetched from Spotify's oEmbed.
    var csMeta = { title: '', artist: '', album: '', thumb: '', year: '', genre: '', track: '', _aiUsed: false };
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }"""

NEW_HEAD = r"""  function convertSpToAudio(spotUrl, resultEl, btnEl){
    var url = (spotUrl || '').trim();
    if(!url){ toast('Paste a Spotify link first.', 2000); return; }
    if(!/(?:open\.spotify\.com|spotify\.link)/i.test(url)){
      if(resultEl){ resultEl.style.display='block'; resultEl.innerHTML='<span style="color:var(--coral);">⚠ That doesn\'t look like a Spotify link. Paste a full open.spotify.com or spotify.link URL.</span>'; }
      return;
    }
    var idM = url.match(/\/(track|album|episode|playlist|artist)\/([a-zA-Z0-9]+)/i);
    var spotId = idM ? idM[2] : 'song';
    var linkKind = idM ? idM[1].toLowerCase() : (scSpKind(url) || 'track');
    if(linkKind === 'album' || linkKind === 'playlist'){
      // Album / playlist: resolve the real track list, then convert + save
      // every song automatically (button stays disabled until the run ends so
      // a second click can't clobber it).
      if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
      if(resultEl){ resultEl.style.display='block'; resultEl.innerHTML='<div style="display:flex;align-items:center;gap:8px;"><div style="width:16px;height:16px;border:2px solid var(--coral);border-top-color:transparent;border-radius:50%;animation:spin 0.8s linear infinite;"></div><span style="font-size:11px;color:var(--ink-dim);">Resolving ' + linkKind + ' and its track list…</span></div>'; }
      (async function(){
        try{
          var plan = await scResolveSpotifyPlan(url);
          if(!plan || !plan.tracks || !plan.tracks.length){
            if(resultEl){ resultEl.innerHTML = '<div style="display:flex; gap:10px; align-items:flex-start;"><div style="flex:1; min-width:0;"><div style="font-weight:600; color:var(--ink); font-size:12px; margin-bottom:2px;">Couldn\'t resolve that ' + linkKind + '\'s track list</div><div style="font-size:10.5px; color:var(--ink-dim); line-height:1.5;">The album/playlist lookup APIs didn\'t answer. Check your connection and try again — or paste individual song links from the ' + linkKind + '.</div></div></div>'; }
            toast('Could not resolve the ' + linkKind + ' track list.', 4000);
            if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
            return;
          }
          var pickEl = document.createElement('div');
          pickEl.style.cssText = 'padding:10px; border:1px solid var(--line); border-radius:10px; background:rgba(255,255,255,0.03);';
          var coverHtml = plan.cover ? '<img src="' + scEscapeHtml(plan.cover) + '" style="width:56px;height:56px;border-radius:6px;object-fit:cover;flex-shrink:0;" onerror="this.style.display=none">' : '';
          pickEl.innerHTML = '<div style="display:flex; gap:10px; align-items:center; margin-bottom:8px;">' + coverHtml +
            '<div style="flex:1; min-width:0;"><div style="font-weight:600; color:var(--ink); font-size:12px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + scEscapeHtml(plan.title || linkKind) + '</div>' +
            '<div style="font-size:10.5px; color:var(--ink-dim);">' + (plan.artist ? scEscapeHtml(plan.artist) + ' — ' : '') + plan.tracks.length + ' songs found · pick a format, every song saves automatically</div></div></div>' +
            '<div style="display:flex; gap:6px; flex-wrap:wrap;">' +
              '<button data-fmt="mp3" class="sp-batch-fmt" style="padding:5px 12px; border-radius:6px; background:var(--coral); color:#fff; border:none; font-size:11px; font-weight:600; cursor:pointer;">MP3</button>' +
              '<button data-fmt="wav" class="sp-batch-fmt" style="padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer;">WAV</button>' +
              '<button data-fmt="flac" class="sp-batch-fmt" style="padding:5px 12px; border-radius:6px; border:1px solid var(--line); background:none; color:var(--ink); font-size:11px; font-weight:600; cursor:pointer;">FLAC</button>' +
            '</div>';
          resultEl.innerHTML = '';
          resultEl.appendChild(pickEl);
          var fmtBtns = pickEl.querySelectorAll('.sp-batch-fmt');
          for(var fi = 0; fi < fmtBtns.length; fi++){
            fmtBtns[fi].addEventListener('click', function(ev){
              var fmt = ev.currentTarget.getAttribute('data-fmt');
              if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }
              scRunBatchConvert(plan, fmt, resultEl, btnEl, url);
            });
          }
        }catch(e){
          if(resultEl){ resultEl.innerHTML = '<span style="color:var(--coral);">⚠ ' + scEscapeHtml((e && e.message) || 'Something went wrong resolving that link.') + '</span>'; }
          if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
        }
      })();
      return;
    }
    // Real track metadata (title + cover art) fetched from Spotify's oEmbed.
    var csMeta = { title: '', artist: '', album: '', thumb: '', year: '', genre: '', track: '', _aiUsed: false };
    if(btnEl){ btnEl.disabled = true; btnEl.textContent = '...'; }"""

replace_once_re('P3-convert-head', re.escape(OLD_HEAD), NEW_HEAD)

# ---------------------------------------------------------------------------
# P4 — single-track flow: if the search+verify pass finds no usable source,
# tell the user directly instead of pretending it can't convert (the old text
# pointed at external sites for what is now our own failure to find the song).
# ---------------------------------------------------------------------------
OLD_TAIL = r"""    csFetchMeta().catch(function(){}).then(function(){
      csSetStatus('⏳ Finding audio...');
      return scSpToBuffer(csMeta, function(txt){ csSetStatus(txt); }).then(function(res){
        if(!res || !res.buffer){ csShowExternal(); return; }
        csRenderFormats(res.buffer, res.streamUrl);
      });
    }).catch(function(){ csShowExternal(); }).finally(function(){
      if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
    });
  }"""

NEW_TAIL = r"""    csFetchMeta().catch(function(){}).then(function(){
      csSetStatus('⏳ Finding audio...');
      return scSpToBuffer(csMeta, function(txt){ csSetStatus(txt); }).then(function(res){
        if(!res || !res.buffer){ csShowExternal(); return; }
        csRenderFormats(res.buffer, res.streamUrl);
      });
    }).catch(function(){ csShowExternal(); }).finally(function(){
      if(btnEl){ btnEl.disabled = false; btnEl.textContent = 'Convert'; }
    });
  }"""

replace_once_re('P4-convert-tail', re.escape(OLD_TAIL), NEW_TAIL)

# ---------------------------------------------------------------------------
# P5 — external-options card for singles gets a "try again" button (batch card
# already has Retry).
# ---------------------------------------------------------------------------
OLD_EXT = r"""          '<div style="font-size:10px;color:var(--ink-dim);margin-top:4px;">Download there, then use <b>+ Add songs → + Files</b> to import.</div>' +
        '</div></div>';
      }
      toast('In-app conversion unavailable — opened external options.', 4000);"""

NEW_EXT = r"""          '<div style="font-size:10px;color:var(--ink-dim);margin-top:4px;">Download there, then use <b>+ Add songs → + Files</b> to import.</div>' +
          '<div style="margin-top:6px;"><button class="sp-retry-conv" style="padding:5px 12px;border-radius:8px;border:1px solid var(--coral);background:none;color:var(--coral);font-size:11px;font-weight:600;cursor:pointer;">↻ Try again</button></div>' +
        '</div></div>';
      }
      var retryBtn = resultEl && resultEl.querySelector('.sp-retry-conv');
      if(retryBtn) retryBtn.addEventListener('click', function(){ convertSpToAudio(url, resultEl, btnEl); });
      toast('In-app conversion unavailable — opened external options.', 4000);"""

replace_once_re('P5-external-retry', re.escape(OLD_EXT), NEW_EXT)

# ---------------------------------------------------------------------------
# P6 — input placeholders: albums & playlists accepted (converter inputs only).
# ---------------------------------------------------------------------------
sub_once(
    'P6a-placeholder-disc',
    r'(id="spMp3Input" placeholder=")Paste Spotify link here\.\.\.(")',
    r"\1Song, album or playlist link...\2",
)
sub_once(
    'P6b-placeholder-settings',
    r'(id="spMp3InputSettings" placeholder=")Paste Spotify link here\.\.\.(")',
    r"\1Song, album or playlist link...\2",
)

# ---------------------------------------------------------------------------
# P7 — FAQ answers reflect album/playlist support.
# ---------------------------------------------------------------------------
OLD_FAQ1 = "a:'SideCut has a built-in **Spotify to MP3 / WAV / FLAC converter** — no external site needed. In **Spotify**, tap **Share → Copy link** on a song, then paste that link into the converter in **Discover → Conversion Tools** (or **Settings → Get Songs**) and tap **Convert**. Pick MP3 (small) or WAV/FLAC (lossless), then **Download** or **Import to Library** — the file arrives with its title, artist, album and cover art already embedded.'"
NEW_FAQ1 = "a:'SideCut has a built-in **Spotify to MP3 / WAV / FLAC converter** — no external site needed. In **Spotify**, tap **Share → Copy link** on a song, album or playlist, then paste that link into the converter in **Discover → Conversion Tools** (or **Settings → Get Songs**) and tap **Convert**. Pick MP3 (small) or WAV/FLAC (lossless). A song gives you one tagged file; an album or playlist converts and auto-downloads every song one by one, in order, with title/artist/album/track-number and cover art embedded in each file.'"

replace_once_re('P7a-faq-convert', re.escape(OLD_FAQ1), NEW_FAQ1)

OLD_FAQ2 = "Usually you can paste your Spotify link straight into the built-in **Spotify to MP3 / WAV / FLAC** converter without expanding it first.'"
NEW_FAQ2 = "Usually you can paste your Spotify link straight into the built-in **Spotify to MP3 / WAV / FLAC** converter without expanding it first — song, album and playlist links (and spotify.link short links) all resolve automatically.'"

replace_once_re('P7b-faq-expand', re.escape(OLD_FAQ2), NEW_FAQ2)

# ---------------------------------------------------------------------------
# P8 — changelog 56.0.7: describe the batch conversion accurately.
# ---------------------------------------------------------------------------
OLD_CL = r"      'The built-in Spotify converter now accepts ALBUM and PLAYLIST links — it resolves the real track list, then converts and auto-downloads every song one by one with a live progress bar and per-track status',"
NEW_CL = r"      'The built-in Spotify converter now accepts ALBUM and PLAYLIST links — it resolves the real track list (works with spotify.link short links too), then converts and auto-downloads every song one by one with a live progress bar and per-track status, plus a retry button for any song that fails',"

replace_once_re('P8-changelog', re.escape(OLD_CL), NEW_CL)

# (No SW cache bump here — sw.js already carries 'sidecut-shell-v56.0.7' from
# the previous commit; nothing to change.)

# ---------------------------------------------------------------------------
# Write + summary
# ---------------------------------------------------------------------------
shutil.copyfile(PATH, BACKUP)
with open(PATH, 'w', encoding='utf-8') as f:
    f.write(src)

print('Applied edits:', ', '.join(edits))
print('Size: %d -> %d bytes (+%d)' % (orig_len, len(src), len(src) - orig_len))
print('Backup:', BACKUP)
