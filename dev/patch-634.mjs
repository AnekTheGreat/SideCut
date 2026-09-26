#!/usr/bin/env node
// SideCut — the reported batch of five:
//
//   1. "there shouldn't be a play button here" (Singles, screenshot)
//   2. "I should be able to get the cover art for these albums" (Album History:
//      "Ishq Ho Gaya", "Smile", "Ishq Da Uda Ada" — blank squares)
//   3. "the popup is not showing for the playlists that full track time is not
//      visible — I should be able to click on that and the bubble shows up"
//   4. "with the lyrics if absolutely no lyrics by the exact artist and exact
//      song is found then just say no lyrics found not the wrong lyrics"
//   5. "this API key thing isn't working" ("API model not found")
//
// MEASURED, not guessed:
//   * The blank covers: Apple has NO album entry for "Smile", "Ishq Ho Gaya" or
//     "Ishq Da Uda Ada" by Diljit Dosanjh in either the US or the IN storefront,
//     so the iTunes-only artwork lookup had nothing to return. Deezer HAS all
//     three (verified live), and MusicBrainz's release groups for them resolve
//     through the Cover Art Archive (verified: all three 307 to a real front
//     cover). Hence the two new sources below.
//   * The Gemini model: the app hardcodes `gemini-2.0-flash` in six places. A key
//     that cannot see that model gets a 404, which the app reported as "your
//     Gemini key may be expired" — a guess. The API can simply be ASKED which
//     models the key can use (`GET /v1beta/models`), and the error body carries
//     the real reason.
//
//   * The blank covers, continued: __ahResolveArtworks (the only caller of the
//     artwork lookup) was invoked exactly once — at boot, when #discPopupBody is
//     empty. It had therefore never run over a real row, and MusicBrainz-sourced
//     albums are stored with artworkUrl100: null, so they could only ever be
//     blank. The resolver is now run when the popup is drawn.
//
//   node dev/patch-634.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. Singles: no ▶ on a row. The row itself is the tap target (it opens the song
//    in Discover, the same contract an album track and an Old songs row have),
//    and the button spent a request on a 30-second preview of something you
//    asked to LOOK at. Same call the Old songs list already made.
// ---------------------------------------------------------------------------
sub('no play button on a single',
  String.raw`      html += '<div class="dp-track-play" data-play="' + ki + '-' + sri + '" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(227,178,60,0.16);color:var(--coral);font-size:11px;cursor:pointer;">\u25b6</div>';`,
  String.raw`      // No ▶ on a single: the row is the tap target now — it opens the song in
      // Discover, exactly like a track inside an album and like an Old songs row.
      // The button played a 30-second preview of something you asked to look at,
      // and on a single with no preview it did nothing at all.`,
  undefined, null);

// ---------------------------------------------------------------------------
// 2. Artwork: more than one source, and the answer is remembered.
// ---------------------------------------------------------------------------
sub('artwork lookup tries Deezer and the Cover Art Archive',
  String.raw`function __ahFetchArtFromSearch(artist, album, artDiv, PLACEHOLDER){
  if(!artist || !album){ artDiv.style.backgroundImage = 'url(' + PLACEHOLDER + ')'; return; }
  var term = encodeURIComponent(artist + ' ' + album);
  fetchWithProxy('https://itunes.apple.com/search?term=' + term + '&media=music&entity=album&limit=1').then(function(r){ return r && r.ok ? r.json() : {}; }).then(function(d){
    var al = (d.results||[])[0];
    if(al && al.artworkUrl100){
      artDiv.style.backgroundImage = 'url(' + al.artworkUrl100.replace('/100x100bb.jpg','/200x200bb.jpg') + ')';
    } else {
      artDiv.style.backgroundImage = 'url(' + PLACEHOLDER + ')';
    }
  }).catch(function(){ artDiv.style.backgroundImage = 'url(' + PLACEHOLDER + ')'; });
}`,
  String.raw`function __ahArtNorm(s){ return String(s || '').toLowerCase().replace(/\(.*?\)|\[.*?\]/g, ' ').replace(/[^a-z0-9]+/g, ''); }
// "Diljit" and "Diljit Dosanjh" are the same artist; "Diljit Dosanjh" and
// "Diljit Dosanjh & Tru-Skool" are too. A name that is not in there at all
// ("Sukhpal Sukh") is a stranger, and a stranger's cover is worse than a blank.
function __ahArtSameArtist(a, b){
  var x = __ahArtNorm(a), y = __ahArtNorm(b);
  if(!x || !y) return false;
  return x === y || x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
}
var __ahArtCache = {};
try{ __ahArtCache = JSON.parse(localStorage.getItem('sidecut_ahArtCache') || '{}') || {}; }catch(_eArt){}
// Found covers are kept, so the resolver (which runs on every render) stops
// re-asking Apple, Deezer and MusicBrainz for the same album. A MISS is only
// remembered for this session: the catalogs gain those records over time, and a
// permanent "no cover" would mean never finding one.
var __ahArtMiss = {};
function __ahArtRemember(key, url){
  if(!url){ __ahArtMiss[key] = 1; return; }
  __ahArtCache[key] = url;
  try{ localStorage.setItem('sidecut_ahArtCache', JSON.stringify(__ahArtCache)); }catch(_eA){}
  try{ dbPut('meta', { key: 'sidecut_ahArtCacheMirror', value: __ahArtCache }); }catch(_eA2){}
}
// Artwork for an album the stores may not list. Apple's store comes first, then
// Deezer — which carries the older Punjabi and Indian catalogues Apple does not
// have at all ("Smile", "Ishq Ho Gaya" and "Over Exposure" by Diljit Dosanjh are
// all there and all missing from Apple) — and then MusicBrainz's own release
// group, whose front cover the Cover Art Archive serves. Only if all three come
// up empty does the placeholder stay, and a long-press on the cover still lets
// you set one by hand.
function __ahFetchArtFromSearch(artist, album, artDiv, PLACEHOLDER){
  if(!artist || !album){ artDiv.style.backgroundImage = 'url(' + PLACEHOLDER + ')'; return; }
  var _key = __ahArtNorm(artist) + '|' + __ahArtNorm(album);
  if(__ahArtCache[_key]){ artDiv.style.backgroundImage = 'url(' + __ahArtCache[_key] + ')'; return; }
  if(__ahArtMiss[_key]){ artDiv.style.backgroundImage = 'url(' + PLACEHOLDER + ')'; return; }
  (async function(){
    var found = '';
    // 1. Apple's storefronts (the original source).
    try{
      var _term = encodeURIComponent(artist + ' ' + album);
      var _ir = await fetchWithProxy('https://itunes.apple.com/search?term=' + _term + '&media=music&entity=album&limit=5');
      var _ij = _ir && _ir.ok ? await _ir.json() : {};
      var _list = (_ij.results || []).filter(function(a){ return __ahArtSameArtist(a.artistName, artist); });
      var _exact = _list.filter(function(a){ return __ahArtNorm(a.collectionName) === __ahArtNorm(album); })[0];
      var _near = _list.filter(function(a){
        var t = __ahArtNorm(a.collectionName), q = __ahArtNorm(album);
        return t && q && (t.indexOf(q) !== -1 || q.indexOf(t) !== -1);
      })[0];
      var _hit = _exact || _near;
      if(_hit && _hit.artworkUrl100) found = _hit.artworkUrl100.replace('/100x100bb.jpg', '/600x600bb.jpg');
    }catch(_e1){}
    // 2. Deezer.
    if(!found){
      try{
        var _dr = await fetchWithProxy('https://api.deezer.com/search/album?q=' + encodeURIComponent(artist + ' ' + album));
        var _dj = _dr && _dr.ok ? await _dr.json() : {};
        var _dhit = (_dj.data || []).filter(function(a){
          return a && a.artist && __ahArtSameArtist(a.artist.name, artist) && __ahArtNorm(a.title) === __ahArtNorm(album);
        })[0];
        if(_dhit) found = _dhit.cover_xl || _dhit.cover_big || _dhit.cover_medium || '';
      }catch(_e2){}
    }
    // 3. MusicBrainz's release group, then its front cover in the archive.
    if(!found){
      try{
        var _mr = await fetchWithProxy('https://musicbrainz.org/ws/2/release-group?query=' +
          encodeURIComponent('releasegroup:"' + album + '" AND artist:"' + artist + '"') + '&fmt=json&limit=5',
          { headers: { 'User-Agent': 'SideCut/' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') + ' (https://anekthegreat.github.io/SideCut/)' } });
        var _mj = _mr && _mr.ok ? await _mr.json() : {};
        var _groups = _mj['release-groups'] || [];
        for(var _gi = 0; _gi < _groups.length; _gi++){
          var _g = _groups[_gi];
          var _credit = (_g['artist-credit'] || []).map(function(x){ return x.name || ''; }).join(' ');
          if(!__ahArtSameArtist(_credit, artist)) continue;
          if(__ahArtNorm(_g.title) !== __ahArtNorm(album)) continue;
          // The archive answers with the image itself (it redirects), so this can
          // be used straight as a background — no extra request from here.
          found = 'https://coverartarchive.org/release-group/' + _g.id + '/front-500';
          break;
        }
      }catch(_e3){}
    }
    __ahArtRemember(_key, found);
    if(!artDiv || !artDiv.style) return;
    artDiv.style.backgroundImage = 'url(' + (found || PLACEHOLDER) + ')';
  })();
}`,
  undefined, null);

// ---------------------------------------------------------------------------
// 3. The playlist runtime line: answer every tap, and answer it the first time.
//    It used to answer only when the line measured as "clamped" (scrollWidth >
//    clientWidth), which is a condition the tap itself cannot see — so on a
//    phone the line looked cut off and the tap looked dead. Now the runtime line
//    always answers, it says so with a pointer cursor, the gesture is wired on
//    pointerup as well as click (a tap that moves a pixel can swallow the click
//    in a WebView), and a scroll no longer dismisses it the instant it opens.
// ---------------------------------------------------------------------------
sub('the runtime line always answers a tap',
  String.raw`        _subEl.setAttribute('data-dur-bubble', '1');
          // Pointer cursor only while the line is really cut off (re-checked as
          // fonts/layout settle and whenever the viewport changes).
          requestAnimationFrame(function(){ window.__scDurBubble.syncCursor(_subEl); });
          setTimeout(function(){ window.__scDurBubble.syncCursor(_subEl); }, 400);
          _subEl.addEventListener('click', function(ev){
            ev.stopPropagation();
            // Clamped lines only — a fully visible runtime needs no popup.
            if(!window.__scDurBubble.isClamped(_subEl)){ window.__scDurBubble.hide(); return; }
            var _ctx = (libraryMode === 'albums') ? 'Albums' : activePlaylist;
            window.__scDurBubble.toggle(_subEl, totalSeconds,
              ids.length + ' track' + (ids.length === 1 ? '' : 's') + ' \u00b7 ' + _ctx);
          });`,
  String.raw`        _subEl.setAttribute('data-dur-bubble', '1');
          _subEl.style.cursor = 'pointer';
          var _openDurBubble = function(ev){
            if(ev){ try{ ev.stopPropagation(); }catch(_eS){} }
            // One tap, one answer: pointerup arrives just before the click it
            // causes, so whichever lands first wins and the other is ignored.
            var _now = Date.now();
            if(_subEl._durTapAt && _now - _subEl._durTapAt < 400) return;
            _subEl._durTapAt = _now;
            var _ctx = (libraryMode === 'albums') ? 'Albums' : activePlaylist;
            window.__scDurBubble.toggle(_subEl, totalSeconds,
              ids.length + ' track' + (ids.length === 1 ? '' : 's') + ' \u00b7 ' + _ctx);
          };
          // The runtime line is ~11px and usually cut off ("233 tracks · 12h …"),
          // so a tap has to be easy to land and must never come back empty: the
          // line answers whether or not it measures as clamped, and it is wired
          // on pointerup too, because a tap that drifts a pixel or two can lose
          // its click in the WebView.
          _subEl.addEventListener('click', _openDurBubble);
          _subEl.addEventListener('pointerup', _openDurBubble);`,
  undefined, null);

sub('the bubble remembers when it opened',
  String.raw`    function hide(){
      var b = document.getElementById('durBubble');
      if(b) b.style.display = 'none';
    }`,
  String.raw`    // When it was opened. A touch that opens it can also nudge the list it sits
    // on, and the scroll that follows used to dismiss it the instant it appeared.
    var openedAt = 0;
    function hide(){
      openedAt = 0;
      var b = document.getElementById('durBubble');
      if(b) b.style.display = 'none';
    }`,
  undefined, null);

sub('the open time is stamped',
  String.raw`      b.style.visibility = 'visible';
      b._anchor = anchor;`,
  String.raw`      b.style.visibility = 'visible';
      openedAt = Date.now();
      b._anchor = anchor;`,
  undefined, null);

sub('a tap is not dismissed by its own scroll',
  String.raw`    window.addEventListener('scroll', hide, true);`,
  String.raw`    // Anything inside the first third of a second of opening is treated as part
    // of the tap that opened it, not as a scroll that closes it.
    window.addEventListener('scroll', function(){
      if(openedAt && Date.now() - openedAt < 350) return;
      hide();
    }, true);`,
  undefined, null);

// ---------------------------------------------------------------------------
// 4. Lyrics: nobody else's song is offered as yours.
//    `scLyricsArtistVerdict` is deliberately left alone — test-620 pins that a
//    name of two letters or fewer can confirm but never reject, which is what
//    makes "BK" able to claim an entry filed under "BK". What was missing is the
//    other half: when the entry DOES name a real artist and that name is not
//    ours, the entry is a stranger, and today's rule calls that 'unknown' (so a
//    same-titled song by anyone was offered, and could be accepted outright when
//    the two lengths happened to be within 2 s).
// ---------------------------------------------------------------------------
sub('a stranger credit is not ours',
  String.raw`  function scLyricsTitleKey(title){`,
  String.raw`  // Is this entry's credit a real artist who is not us? 'ours' is every word of
  // our name, SHORT ONES INCLUDED ("BK" must still claim "BK & Jay Trak"), and
  // 'theirs' is every word of the entry's credit that is long enough to be a
  // name. Yes when the entry names someone real and none of our words is in
  // there — which is the case that made a list of twenty "Lifestyle"s, only one
  // of them Punjabi, look like SideCut had found the lyrics.
  function scLyricsStrangerCredit(candArtist, artistTokens){
    var cand = String(candArtist || '').trim();
    if(!cand) return false;
    if(scLyricsLooksLikeImprint(cand)) return false;         // a label/channel says nothing
    // EVERY word of the credit is compared — the short ones included, or "BK &
    // Jay Trak" could not be recognised as ours — but a real (3+ letter) name has
    // to be present before the credit can contradict anybody.
    var theirs = scLyricsArtistTokens(cand);
    var realTheirs = theirs.filter(function(w){
      return w.length >= 3 && !SC_LYRICS_STOPWORDS[w] && !SC_LYRICS_IMPRINT_TOKENS[w];
    });
    if(!realTheirs.length) return false;                     // nothing real to judge on
    var ours = (artistTokens || []).filter(function(w){
      return w.length > 0 && !SC_LYRICS_STOPWORDS[w] && !SC_LYRICS_IMPRINT_TOKENS[w];
    });
    if(!ours.length) return false;                           // we have no name to compare
    for(var i = 0; i < ours.length; i++){
      for(var j = 0; j < theirs.length; j++){
        if(ours[i] === theirs[j]) return false;
        if(ours[i].length >= 4 && theirs[j].indexOf(ours[i]) === 0) return false;
      }
    }
    return true;
  }
  function scLyricsTitleKey(title){`,
  undefined, null);

sub('a stranger cannot be accepted on a coincidental length',
  String.raw`      acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign')),`,
  String.raw`      // …and a credit that names someone else outright is refused even then: the
      // exact title plus a length inside two seconds is how a stranger's song got
      // served as yours for an artist whose name is too short for the verdict
      // table to call foreign.
      stranger: scLyricsStrangerCredit(res.artistName, artistTokens),
      acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign' && !scLyricsStrangerCredit(res.artistName, artistTokens))),`,
  undefined, null);

sub('the candidate list drops strangers and says how many it dropped',
  String.raw`      var rk = scLyricsRank(res, titleKey, primaryTokens, dur);
      out.push({ title: res.trackName || '', artist: res.artistName || '', duration: Number(res.duration) || 0,`,
  String.raw`      var rk = scLyricsRank(res, titleKey, primaryTokens, dur);
      // Someone else's song is not a candidate for yours. It is counted instead,
      // so the panel can say "no lyrics found, N same-titled songs by other
      // artists" rather than offering a list headed by four strangers.
      if(scLyricsStrangerCredit(res.artistName, primaryTokens)){ strangers++; return; }
      if(rk.verdict === 'match') agree++;
      out.push({ title: res.trackName || '', artist: res.artistName || '', duration: Number(res.duration) || 0,`);

sub('the candidate list counts them',
  String.raw`    var seen = {}, out = [];
    function add(res){`,
  String.raw`    var seen = {}, out = [], strangers = 0, agree = 0;
    function add(res){`);

sub('the counts ride along with the list',
  String.raw`    out.sort(function(a, b){ return b.score - a.score; });
    scLyricsDeadline = 0;
    return out;`,
  String.raw`    out.sort(function(a, b){ return b.score - a.score; });
    scLyricsDeadline = 0;
    // Carried on the array: how many entries were dropped as someone else's, and
    // how many agree with this track's artist. A list with no agreement in it is
    // "no lyrics found", not a menu.
    out.strangers = strangers;
    out.agreeCount = agree;
    return out;`);

sub('no agreement means no lyrics found, not a menu',
  String.raw`        if(!_picks.length){
          $('lyricsNotFound').style.display = 'block';
          toast('Nothing on LRCLIB for "' + searchTitle + '". Try a shorter title — just the song name, no brackets.', 4200);
          return;
        }`,
  String.raw`        if(!_picks.length || !_picks.agreeCount){
          // Say no lyrics found. Offering the other people's songs as a list to
          // tap is what "the wrong lyrics" means to the person reading it.
          $('lyricsNotFound').style.display = 'block';
          var _whatEl = $('lyricsNotFoundWhat');
          var _whyEl = document.getElementById('lyricsNotFoundWhy');
          var _others = _picks.strangers || 0;
          if(_whatEl) _whatEl.textContent = 'No lyrics found for "' + searchTitle + '" by ' + searchArtist + '.';
          if(_whyEl){
            if(_others){
              _whyEl.style.display = 'block';
              _whyEl.textContent = 'LRCLIB has ' + _others + ' same-titled song' + (_others === 1 ? '' : 's') +
                ' by other artists, and a song is never served under someone else\\u2019s name. ' +
                'If one of them is the right one, put its artist in the Artist box below and search again.';
            }else{
              _whyEl.style.display = 'none';
            }
          }
          toast(_others
            ? ('No lyrics found for ' + searchArtist + ' — ' + _others + ' same-titled song' + (_others === 1 ? '' : 's') + ' by other artists were skipped.')
            : ('Nothing on LRCLIB for "' + searchTitle + '". Try a shorter title — just the song name, no brackets.'), 4600);
          return;
        }`);

// ---------------------------------------------------------------------------
// 5. Gemini: ask the API what this key can actually use.
// ---------------------------------------------------------------------------
sub('the model is resolved (and discoverable) instead of hardcoded',
  String.raw`var _aiGeminiKey = '';
try { _aiGeminiKey = localStorage.getItem('sidecut_aiGeminiKey') || ''; } catch(_e){}
try { _aiGeminiKey = localStorage.getItem('sidecut_aiGeminiKey') || ''; } catch(_e){}`,
  String.raw`var _aiGeminiKey = '';
try { _aiGeminiKey = localStorage.getItem('sidecut_aiGeminiKey') || ''; } catch(_e){}
try { _aiGeminiKey = localStorage.getItem('sidecut_aiGeminiKey') || ''; } catch(_e){}

// ---- Which Gemini model this key can actually use ---------------------------
// Every call used to be pinned to 'gemini-2.0-flash'. A 404 from that request is
// NOT "your key expired" — it is "this key cannot see this model", and the app
// was guessing at the cause and telling the user to go and make a new key. The
// API can be asked directly: GET /v1beta/models lists what the key may use, so
// the real answer is one request away, and the model that works is remembered.
window.__scGeminiDefaultModel = 'gemini-2.0-flash';
window.__scGeminiModel = function(){
  var m = '';
  try{ m = localStorage.getItem('sidecut_aiGeminiModel') || ''; }catch(_e){}
  return m || window.__scGeminiDefaultModel;
};
window.__scGeminiListModels = async function(key){
  var k = key || _aiGeminiKey || '';
  if(!k) throw new Error('No Gemini API key is set.');
  var r = await fetch('https://generativelanguage.googleapis.com/v1beta/models?key=' + encodeURIComponent(k));
  var j = await r.json().catch(function(){ return {}; });
  if(!r.ok) throw new Error((j && j.error && j.error.message) || ('HTTP ' + r.status));
  var names = (j.models || []).filter(function(m){
    return m && m.name && (m.supportedGenerationMethods || []).indexOf('generateContent') !== -1;
  }).map(function(m){ return String(m.name).replace(/^models\//, ''); });
  if(!names.length) throw new Error('This key has no model that can answer questions.');
  // Newest flash first — it is the cheap, fast family this app is written for —
  // then any other flash, then anything left.
  function rank(n){
    var m = /gemini-(\d+)(?:\.(\d+))?/.exec(n);
    var v = m ? (Number(m[1]) * 100 + Number(m[2] || 0)) : 0;
    return v + (/flash/.test(n) ? 1000 : 0) - (/preview|exp|thinking/.test(n) ? 5 : 0);
  }
  names.sort(function(a, b){ return rank(b) - rank(a); });
  return names;
};
// One model that answers, cached for every other caller in the app.
window.__scGeminiEnsureModel = async function(key){
  try{
    var list = await window.__scGeminiListModels(key);
    var pick = list[0];
    try{ localStorage.setItem('sidecut_aiGeminiModel', pick); }catch(_e){}
    return pick;
  }catch(_e){ return ''; }
};`,
  undefined, null);

sub('every Gemini call uses the resolved model',
  String.raw`"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=" + _aiGeminiKey`,
  String.raw`"https://generativelanguage.googleapis.com/v1beta/models/" + window.__scGeminiModel() + ":generateContent?key=" + _aiGeminiKey`);

sub('every Gemini call uses the resolved model (single quotes)',
  String.raw`'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + _aiGeminiKey`,
  String.raw`'https://generativelanguage.googleapis.com/v1beta/models/' + window.__scGeminiModel() + ':generateContent?key=' + _aiGeminiKey`,
  5);

// The chat: discover on a 404 and answer with the API's own words, never with a
// guess about the key.
sub('the assistant retries with a model the key can use, and says what the API said',
  String.raw`    var resp = await fetch('https://generativelanguage.googleapis.com/v1beta/models/' + window.__scGeminiModel() + ':generateContent?key=' + _aiGeminiKey, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: _aiSystemPrompt }] },
        contents: contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
      })
    });
    if (!resp.ok) {
      var err = await resp.json().catch(function(){ return {}; });
      console.error('Gemini API error:', resp.status, err);
      if (resp.status === 400) return 'Invalid API key. Go to aistudio.google.com → Get API key → create a new key, then paste it in Settings → Support.';
      if (resp.status === 403) return 'API key quota exceeded or invalid. Go to aistudio.google.com → Get API key → create a new key.';
      if (resp.status === 404) return 'API model not found — your Gemini key may be expired. Go to aistudio.google.com → Get API key → create a fresh key, then paste it in Settings → Support.';
      return 'API error (' + resp.status + '). Go to aistudio.google.com to check your key, then paste it in Settings → Support.';
    }`,
  String.raw`    var _body = JSON.stringify({
      system_instruction: { parts: [{ text: _aiSystemPrompt }] },
      contents: contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 600 }
    });
    var _ask = function(model){
      return fetch('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent?key=' + encodeURIComponent(_aiGeminiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: _body
      });
    };
    var resp = await _ask(window.__scGeminiModel());
    // A 404 here means THIS KEY cannot see THIS MODEL, not that the key is dead.
    // Ask the API which models it can see, then ask again with one of those.
    if(resp.status === 404){
      var _better = await window.__scGeminiEnsureModel(_aiGeminiKey);
      if(_better && _better !== window.__scGeminiModel()) resp = await _ask(_better);
    }
    if (!resp.ok) {
      var err = await resp.json().catch(function(){ return {}; });
      console.error('Gemini API error:', resp.status, err);
      var _apiSays = (err && err.error && err.error.message) ? String(err.error.message) : '';
      if (resp.status === 400) return 'The API key was rejected' + (_apiSays ? ' — ' + _apiSays : '') + '. Check it in Settings → Support (aistudio.google.com → Get API key).';
      if (resp.status === 403) return 'The API refused this request' + (_apiSays ? ' — ' + _apiSays : '') + '. That is usually the key being restricted, or its quota being used up.';
      if (resp.status === 404) return 'This key has no usable Gemini model' + (_apiSays ? ' — ' + _apiSays : '') + '. Open aistudio.google.com → Get API key, create a key in a project with the Gemini API enabled, and paste it in Settings → Support.';
      return 'API error (' + resp.status + ')' + (_apiSays ? ': ' + _apiSays : '') + '. Check the key in Settings → Support.';
    }`,
  undefined, null);

// Pasting the key: the WebView denies navigator.clipboard unless the app holds
// the permission, which is the "Clipboard access denied" the user saw. Try the
// Capacitor clipboard first when the build has it, then the browser API, then
// the old execCommand path, and only then explain.
sub('pasting the key has fallbacks',
  String.raw`window._aiPasteKey = async function() {
  try {
    var text = await navigator.clipboard.readText();
    var input = document.getElementById('aiGeminiKeyInput');
    if (input && text) {
      input.value = text.trim();
      input.focus();
      toast('Pasted from clipboard!', 1500);
    }
  } catch(e) {
    toast('Clipboard access denied — long-press the field and choose Paste.', 3000);
  }
};`,
  String.raw`window._aiPasteKey = async function() {
  var input = document.getElementById('aiGeminiKeyInput');
  var text = '';
  // 1. The Capacitor clipboard plugin, when the build ships it.
  try {
    var _cap = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Clipboard;
    if (_cap && _cap.read) {
      var _r = await _cap.read();
      text = (_r && (_r.value || _r.text)) || '';
    }
  } catch(e) {}
  // 2. The browser clipboard API (needs the WebView to allow it).
  if (!text) {
    try { text = await navigator.clipboard.readText(); } catch(e) {}
  }
  // 3. The old path, which still works in some WebView builds.
  if (!text) {
    try {
      if (input) { input.focus(); input.select(); var _ok = document.execCommand('paste'); if (_ok && input.value) text = input.value; }
    } catch(e) {}
  }
  if (text && input) {
    input.value = text.trim();
    input.focus();
    window._aiSetGeminiKey();
    return;
  }
  // Nothing readable: put the cursor in the field and let the system keyboard
  // offer its own Paste, which always works.
  if (input) { input.focus(); try { input.select(); } catch(e) {} }
  toast('Could not read the clipboard — the field is focused, long-press it and choose Paste.', 3600);
};`,
  undefined, null);

// ---------------------------------------------------------------------------
// 2b. …and the resolver is actually WIRED UP. It was called exactly once, at
//     boot, when the popup body is still empty — so it had never once run over a
//     real row, and a MusicBrainz album (stored with artworkUrl100: null) stayed
//     a blank square forever. openDiscoverPopup is the one place every list goes
//     through, fresh render or 24-hour cache, so the resolver is run there.
//     __ahResolveArtworks is exported first so the call cannot miss it on scope.
// ---------------------------------------------------------------------------
sub('the artwork resolver is exported for the popup to run',
  String.raw`    // Has placeholder or no image — try to get real artwork
    __ahFetchArtFallback(hdr, artDiv, PLACEHOLDER);
  });
}`,
  String.raw`    // Has placeholder or no image — try to get real artwork
    __ahFetchArtFallback(hdr, artDiv, PLACEHOLDER);
  });
}
window.__ahResolveArtworks = __ahResolveArtworks;`,
  undefined, null);

sub('every popup open resolves the covers it drew',
  String.raw`      if(bEl){ bEl.style.overflowY = ''; bEl.style.scrollbarWidth = ''; bEl.style.webkitOverflowScrolling = ''; }
    }
  }catch(_e){}
}`,
  String.raw`      if(bEl){ bEl.style.overflowY = ''; bEl.style.scrollbarWidth = ''; bEl.style.webkitOverflowScrolling = ''; }
    }
  }catch(_e){}
  // Covers for the album rows the stores handed us no picture for. This runs on
  // every open — a fresh Album History render AND a reopen from the 24-hour
  // cache, which is what the reported blank rows were — and it only reads the
  // rows already in the body, so on any other list it finds nothing to do.
  try{ if(typeof window.__ahResolveArtworks === 'function') window.__ahResolveArtworks(); }catch(_eArt){}
}`,
  undefined, null);

// ---------------------------------------------------------------------------
// 4b. …and the manual picker stays usable while it does. Gating the list on "a
//     candidate that AGREES with this track's artist" also removed the escape
//     hatch it exists for: an entry filed under a label ("T-Series") is not a
//     stranger — the resolver itself accepts it — but it never AGREES either, so
//     a hand search for the very song would have said "no lyrics found". Strangers
//     are already out of the list; an empty list is the only thing that means
//     nothing was found. Self-healing: it rewrites the interim gate if that is
//     what is on disk.
// ---------------------------------------------------------------------------
sub('a hand search still offers what it found',
  String.raw`        if(!_picks.length || !_picks.agreeCount){
          // Say no lyrics found. Offering the other people's songs as a list to
          // tap is what "the wrong lyrics" means to the person reading it.`,
  String.raw`        if(!_picks.length){
          // Say no lyrics found. Offering the other people's songs as a list to
          // tap is what "the wrong lyrics" means to the person reading it, so a
          // stranger is removed from the list rather than labelled — which leaves
          // an empty list meaning exactly this: nothing for this artist and this
          // song. A row that is no stranger (the credit is a label, or there is no
          // credit to read) stays, because that is the case the box is here for.`,
  undefined, null);

sub('the picker says when nothing in it is credited to you',
  String.raw`        _pickHead.textContent = _picks.length + ' match' + (_picks.length === 1 ? '' : 'es') + ' on LRCLIB — tap the right song:';`,
  String.raw`        _pickHead.textContent = _picks.length + ' match' + (_picks.length === 1 ? '' : 'es') + ' on LRCLIB' +
          (_picks.agreeCount ? ' — tap the right song:' : ' — none credited to ' + searchArtist + '. Tap the right one:');`,
  undefined, null);

// ---------------------------------------------------------------------------
// 1b. Singles again — the SECOND renderer. The ↻ (per-artist refresh) and the ⚡
//     (deep refetch) redraw a group's rows through window.__singlesRowsHTML,
//     which still emitted the ▶, and those rows are what gets saved into the
//     popup cache. Same contract as the list: the row is the tap target.
// ---------------------------------------------------------------------------
sub('no play button on a single (per-artist refetch rows)',
  String.raw`    r += '<div class="dp-track-play" data-play="' + ki + '-' + sri + '" style="width:28px;height:28px;border-radius:50%;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:rgba(227,178,60,0.16);color:var(--coral);font-size:11px;cursor:pointer;">\u25b6</div>';`,
  String.raw`    // No ▶ here either: a group redrawn by ↻ / ⚡ gets exactly the rows the list
    // draws, and the row itself is the tap target (it opens the song).`,
  undefined, null);

// ---------------------------------------------------------------------------
// 1c. …and a snapshot taken by an older build can still hold a ▶ per row, because
//     the popup cache survives an app update. The Old songs guard only ever
//     matched Old songs, and only a <span> — the play button is a <div> — so a
//     cached Singles list kept showing one. No popup row has a ▶ any more, so
//     every cached body is cleaned on the way in.
// ---------------------------------------------------------------------------
sub('a saved popup body opens without a play button',
  String.raw`      // Old songs rows are the tap target — no play button. A snapshot saved
      // before that change (the cache survives an app update) can still hold
      // one per row, so it is stripped here rather than shown.
      var isOldSongs = key === '\ud83d\udcc5 Old songs' || d.title === '\ud83d\udcc5 Old songs';
      if(isOldSongs && d.body.indexOf('dp-track-play') !== -1){
        d.body = d.body.replace(/<span[^>]*class="dp-track-play"[\s\S]*?<\/span>/g, '');
      }`,
  String.raw`      // No popup row carries a ▶ any more — Old songs, Singles and album tracks
      // are all tap targets. A snapshot saved by an older build (the cache
      // survives an app update) can still hold one per row, and the saved
      // Singles list that was reported was exactly that, so every cached body is
      // cleaned on the way in. The old guard only matched Old songs, and only a
      // <span> — the play button is a <div>, so it never actually matched.
      if(d.body.indexOf('dp-track-play') !== -1){
        d.body = d.body.replace(/<(?:span|div)[^>]*class="dp-track-play"[\s\S]*?<\/(?:span|div)>/g, '');
      }`,
  undefined, null);

fs.writeFileSync(FILE, src);
console.log('patch-634: ' + edits + ' index.html edit(s)');
