#!/usr/bin/env node
// SideCut — New releases / Upcoming releases: no remixes, nothing off the
// pinned artists, and an Upcoming tab that actually finds (and explains) drops.
//
// The user's words: "In new releases or upcoming releases, and make upcoming
// releses actually work there should be no remixes or anything not made by my
// pinned artists there shouldn't be remixes in general".
//
// WHERE THE JUNK CAME FROM (each source, read from the file):
//   * The iTunes song pass kept any track whose credited primary artist was an
//     exact match — but the TITLE was never looked at, so "Daytona (Remix)",
//     "Aaye Haaye (Afro Mix)", karaoke/tribute covers and "sped up" uploads
//     came straight through.
//   * The iTunes album pass matched the credit LOOSELY — `indexOf` in both
//     directions, i.e. a substring anywhere in the string — so "Karan Aujla
//     Tribute Band" counted as Karan Aujla.
//   * MusicBrainz and Wikidata matched credits the same loose `indexOf` way.
//   * Nothing ever filtered a title in any of the release paths. The Album
//     History noise filter (`/\b(karaoke|tribute|bootleg|unreleased|video
//     album|remix(es| bundle| album)?|focus collection|non.?stop|mashup)\b/`)
//     only ever ran on Album History rows.
//
// WHY UPCOMING RELEASES LOOKED DEAD (probed live, Sep 26 2026):
//   * MusicBrainz answers one request a second and throttles a burst with 429/
//     503 instead of queueing. The check runs three artists at once and asks
//     MusicBrainz TWICE per artist, so six requests left together, most came
//     back 503, and the code read a 503 as "nothing found" — the one source that
//     carries an announced day was silently the least reliable one.
//   * MusicBrainz was asked by NAME (`artist:"..."`), a rank-limited search that
//     can bury an announced release entirely. Browsing the artist's own catalog
//     by its MusicBrainz id returns everything on it, dated or not.
//   * Wikidata was asked only for albums (`P31/P279* Q482994`), so a future-dated
//     SINGLE or EP — Q134556 / Q169930, which are NOT album subclasses — could
//     never be found at all. Measured: future-dated singles exist on Wikidata.
//   * Apple and Deezer carry NO future-dated release today (probed across the
//     user's artists and a dozen global ones: 0 rows), so MusicBrainz and
//     Wikidata are the only two sources that can ever date a drop ahead.
//   * The empty tab said one flat line — "pin an artist whose next drop is
//     dated" — which reads as a broken tab rather than "checked, nothing dated".
//
// WHAT THIS CHANGES
//   1. `window.__scJunkTitle` — one shared remix/junk test, used by every source
//      AND by both lists, so a row is refused wherever it arrives from.
//   2. `window.__scSameArtistName` — exact name, or a whole-word prefix of it
//      ("Karan Aujla" ~ "Karan"), never a substring inside a word ("Karan Aujla"
//      ~ "Karan Aujla Tribute Band" no longer matches). Used by the iTunes album
//      pass, MusicBrainz and Wikidata.
//   3. `window.__scPruneJunkReleases` — runs on load, so the remixes already
//      stored on the device leave every list (Home panel, Fetch latest popup,
//      bell count, the section on Home) without waiting for a refetch.
//   4. MusicBrainz: one app-wide queue (one request in flight, spaced, retried
//      twice on 429/503) and the artist's own catalog browsed by MusicBrainz id,
//      with the name search kept as the fallback when no id resolves.
//   5. Wikidata: albums AND singles AND EPs.
//   6. The empty Upcoming tab now says what the check did — how many pinned
//      artists it looked at and when — instead of implying you have not pinned
//      anyone.
//
//   node dev/patch-628.mjs
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
// 1. The shared tests, beside the other cross-block helpers (__scDay10,
//    __scUpcomingDay, __scTime12). Both script blocks can reach them there.
// ---------------------------------------------------------------------------
sub('shared junk/artist helpers',
  "// A drop's time of day, when one is known. A manual drop carries the hour you",
  `// ---- Release-list noise: no remixes, nothing off the pinned artists --------
// The stores file a remix, a cover, a karaoke record, a tribute band's album and
// a "focus"/non-stop playlist next to the artist's own new music, and New
// releases and Upcoming releases listed them all. One test, used by every
// source and by both lists, so a row is refused wherever it arrives from.
// Whole words only: "Mixed Signals" is a song and "Mix Tape" is a release —
// "(Remix)" and "(Afro Mix)" are not new music, so only a QUALIFIED mix arm
// is refused (dj/club/afro/radio/extended/continuous/official), never "mix".
window.__scJunkTitle = function(v){
  var t = ' ' + String(v == null ? '' : v).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim() + ' ';
  if(!t.trim()) return true;
  return /\\b(karaoke|tribute|bootleg|unreleased|video album|remix|remixes|remixed|remixing|rmx|re mix|re mixes|re mixed|rework|reworked|mashup|megamix|dj set|dj mix|club mix|afro mix|radio mix|extended mix|continuous mix|official mix|mixed by|mixes by|focus collection|non stop|nonstop|radio edit|sped up|speed up|slowed|reverb|nightcore|8d audio|lofi|lo fi)\\b/.test(t);
};
// Words that turn a credit into somebody else's record when they are what the
// pinned name is extended by: "Karan Aujla Tribute Band" is not Karan Aujla.
window.__scActWords = /\\b(tribute|karaoke|cover|remix|remixed|mix|live|band|orchestra|ensemble|collective|presents|productions?|soundtrack|cast|choir|version)\\b/;
// Is this credit one of ours? An exact name, or a whole-word prefix of it, so
// "Karan Aujla" is the same artist as "Karan" — but never a substring inside a
// word, which is how "Karan Aujla Tribute Band" used to pass for Karan Aujla.
window.__scSameArtistName = function(a, b){
  var n = function(s){ return String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); };
  var x = n(a), y = n(b);
  if(!x || !y) return false;
  if(x === y) return true;
  var longer = (x + ' ').indexOf(y + ' ') === 0 ? x : ((y + ' ').indexOf(x + ' ') === 0 ? y : '');
  if(!longer) return false;
  // The longer credit has to be the same name, not the same name plus an act.
  return !window.__scActWords.test(longer);
};
// Drop the remixes and covers already stored on the device, so they leave every
// list at once instead of lingering until each artist is refetched. Returns how
// many rows went.
window.__scPruneJunkReleases = function(map){
  try{
    if(!map || typeof map !== 'object') return 0;
    var dropped = 0;
    Object.keys(map).forEach(function(k){
      var list = map[k];
      if(!Array.isArray(list)) return;
      var keep = list.filter(function(r){ return !(r && window.__scJunkTitle(r.title)); });
      if(keep.length !== list.length){ dropped += list.length - keep.length; map[k] = keep; }
    });
    return dropped;
  }catch(_e){ return 0; }
};
// A drop's time of day, when one is known. A manual drop carries the hour you`);

// ---------------------------------------------------------------------------
// 2. Every source refuses a junk title / a credit that is not the pinned
//    artist's. The lookups themselves are unchanged.
// ---------------------------------------------------------------------------
sub('iTunes song pass title filter',
  `        results = (data.results || []).filter(r => r && r.trackName &&
          primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim());`,
  `        results = (data.results || []).filter(r => r && r.trackName &&
          !window.__scJunkTitle(r.trackName) &&
          primaryArtistName(r.artistName || '').toLowerCase().trim() === primaryArtistName(artist).toLowerCase().trim());`);

sub('iTunes album pass: credited artist + title',
  `            if(rArtist !== pArtist && rArtist.indexOf(pArtist) === -1 && pArtist.indexOf(rArtist) === -1) return;`,
  `            // Same artist by name, never by substring: "Karan Aujla Tribute
            // Band" is not Karan Aujla, and a remix album is not his drop.
            if(!window.__scSameArtistName(rArtist, pArtist)) return;
            if(window.__scJunkTitle(r.collectionName)) return;`);

sub('iTunes artist-catalog credit check',
  `      var credited = function(nm){ return !!nm && (nm === want || nm.indexOf(want) !== -1 || want.indexOf(nm) !== -1); };`,
  `      var credited = function(nm){ return !!nm && window.__scSameArtistName(nm, want); };`);

sub('iTunes artist-catalog result filter',
  `      return ((lkData && lkData.results) || []).filter(function(r){
        if(!r || !r.collectionName) return false;
        return credited(norm(primaryArtistName(r.artistName || '')));
      });`,
  `      return ((lkData && lkData.results) || []).filter(function(r){
        if(!r || !r.collectionName) return false;
        if(window.__scJunkTitle(r.collectionName)) return false;
        return credited(norm(primaryArtistName(r.artistName || '')));
      });`);

// ---------------------------------------------------------------------------
// 3. MusicBrainz: one queue for the whole app, and the artist's own catalog
//    browsed by its MusicBrainz id.
// ---------------------------------------------------------------------------
sub('MusicBrainz queue + artist id',
  `  async function scFetchMbUpcoming(artist){`,
  `  // MusicBrainz answers ONE request a second and throttles a burst with a 429/
  // 503 rather than queueing it. This check runs three artists at once and asks
  // MusicBrainz twice per artist, so its requests used to leave together, come
  // back throttled, and be read as "nothing found" — for the one source that
  // carries an announced day. One queue for the whole app: a request leaves
  // alone, spaced, and a throttled reply is retried twice before giving up.
  var _mbChain = Promise.resolve(), _mbLast = 0, _mbMin = 1100;
  var _mbWait = function(ms){ return new Promise(function(res){ setTimeout(res, ms); }); };
  function scMbFetch(url, opts){
    var task = function(){
      var attempt = function(left){
        return _mbWait(Math.max(0, _mbLast + _mbMin - Date.now())).then(function(){
          _mbLast = Date.now();
          return fetchWithProxy(url, opts).catch(function(){ return null; }).then(function(rs){
            if(rs && (rs.status === 429 || rs.status === 503) && left > 0){
              return _mbWait(2600).then(function(){ return attempt(left - 1); });
            }
            return rs;
          });
        });
      };
      return attempt(2);
    };
    var out = _mbChain.then(task, task);
    _mbChain = out.then(function(){ return null; }, function(){ return null; });
    return out;
  }
  // Which MusicBrainz artist is this? The id is what the browse endpoint takes,
  // and the name search alone can rank an announced release out of reach. A name
  // can be a band, a DJ and a producer at once, so only an exact/whole-word
  // match is accepted, best score first. Resolved once per artist per session.
  function scMbArtistId(name){
    var key = String(name == null ? '' : name).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if(!key) return Promise.resolve(null);
    var cache = window.__scMbIds || (window.__scMbIds = {});
    if(cache[key] !== undefined) return cache[key];
    var who = String(name).replace(/["\\\\]/g, ' ').trim();
    var p = scMbFetch('https://musicbrainz.org/ws/2/artist/?query=' + encodeURIComponent('artist:"' + who + '"') + '&fmt=json&limit=5', SC_MB_FETCH).then(function(rs){
      if(!rs || !rs.ok) return null;
      return rs.json().catch(function(){ return null; });
    }).then(function(md){
      var hit = ((md && md.artists) || []).filter(function(a){
        return a && a.id && window.__scSameArtistName(primaryArtistName(a.name || ''), key);
      });
      hit.sort(function(a, b){ return Number(b.score || 0) - Number(a.score || 0); });
      return hit.length ? hit[0].id : null;
    }).catch(function(){ return null; });
    cache[key] = p;
    return p;
  }
  async function scFetchMbUpcoming(artist){`);

sub('MusicBrainz reads browse the artist id',
  `      var _reads = passes.map(function(ps){
        var q = 'artist:"' + who + '" AND ' + ps.range + ':[' + today + ' TO ' + horizon + ']';
        var url = 'https://musicbrainz.org/ws/2/' + ps.path + '/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
        return fetchWithProxy(url, SC_MB_FETCH).then(function(rs){
          return (rs && rs.ok) ? rs.json() : null;
        }).catch(function(){ return null; });
      });
      var _rp = await Promise.all(_reads);`,
  `      var _json = function(url){
        return scMbFetch(url, SC_MB_FETCH).then(function(rs){
          return (rs && rs.ok) ? rs.json() : null;
        }).catch(function(){ return null; });
      };
      var _reads;
      // The artist's own catalog, read by id: every release on it, dated or
      // not — where the id lookup found the drops the ranked name search had
      // buried (the same reason the Apple pass reads the artist's catalog by
      // id). No id resolved, and the name search still runs, unchanged.
      var _mbid = await scMbArtistId(artist);
      if(_mbid){
        _reads = passes.map(function(ps){
          return _json('https://musicbrainz.org/ws/2/' + ps.path + '?artist=' + _mbid + '&fmt=json&limit=100');
        });
      } else {
        _reads = passes.map(function(ps){
          var q = 'artist:"' + who + '" AND ' + ps.range + ':[' + today + ' TO ' + horizon + ']';
          return _json('https://musicbrainz.org/ws/2/' + ps.path + '/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100');
        });
      }
      var _rp = await Promise.all(_reads);`);

sub('MusicBrainz title + credit',
  `            var hit = credits.some(function(nm){ return !!nm && (nm === want || nm.indexOf(want) !== -1 || want.indexOf(nm) !== -1); });
            if(!hit) return; // collabs count only when the pinned artist is credited`,
  `            if(window.__scJunkTitle(rg.title)) return;      // no remixes, no covers
            // A browse-by-id reply carries no artist-credit at all — the id in
            // the query IS the credit. Only a reply that names credits has to
            // match the pinned artist, and then strictly.
            if(credits.length){
              var hit = credits.some(function(nm){ return !!nm && window.__scSameArtistName(nm, want); });
              if(!hit) return; // collabs count only when the pinned artist is credited
            }`);

// ---------------------------------------------------------------------------
// 4. Wikidata: singles and EPs count (they are not album subclasses — Q134556
//    and Q169930 sit beside Q482994, never under it), plus the same two tests.
// ---------------------------------------------------------------------------
sub('Wikidata release classes',
  `        + ' ?album wdt:P31/wdt:P279* wd:Q482994 .'`,
  `        + ' VALUES ?cls { wd:Q482994 wd:Q134556 wd:Q169930 }'
        + ' ?album wdt:P31/wdt:P279* ?cls .'`);

sub('Wikidata title + credit',
  `        if(!title || /^Q\\d+$/.test(title)) return;`,
  `        if(!title || /^Q\\d+$/.test(title)) return;
        if(window.__scJunkTitle(title)) return;         // no remixes, no covers`);

sub('Wikidata performer check',
  `        if(!(pl === want || pl.indexOf(want) !== -1 || want.indexOf(pl) !== -1)) return;`,
  `        if(!window.__scSameArtistName(pl, want)) return;`);

// ---------------------------------------------------------------------------
// 5. MusicBrainz and Wikidata now take a few spaced seconds each: the per-artist
//    ceiling is what the queue is allowed to spend, and it used to be cut off
//    before a throttled reply could be retried.
// ---------------------------------------------------------------------------
sub('per-artist ceiling',
  `          new Promise(function(res){ setTimeout(function(){ res(null); }, 8000); })   // 8s per artist`,
  `          // MusicBrainz is read through one spaced queue for the whole app, so
          // an artist's turn in that queue counts against this wall: the ceiling
          // is the wall the run may spend on ONE artist, not a timeout for one
          // request. Raised from 8s, where a queued retry was cut off before it
          // could be made — which is exactly how a dated drop got lost.
          new Promise(function(res){ setTimeout(function(){ res(null); }, 25000); })  // 25s per artist`);

// ---------------------------------------------------------------------------
// 6. What the lists show. The stored list is cleaned on load and again in the
//    lists themselves, so junk leaves at once instead of at the next refetch.
// ---------------------------------------------------------------------------
sub('prune on load',
  `    pinnedReleases = (pr && pr.value && typeof pr.value === 'object') ? pr.value : {};`,
  `    pinnedReleases = (pr && pr.value && typeof pr.value === 'object') ? pr.value : {};
    // A remix or a cover that an older build stored leaves now, not whenever
    // that artist is next refetched.
    try{ window.__scPruneJunkReleases(pinnedReleases); }catch(_ePrJ){}`);

sub('prune restored snapshot',
  `              pinnedReleases = _snapMeta.pinnedReleases;`,
  `              pinnedReleases = _snapMeta.pinnedReleases;
              try{ window.__scPruneJunkReleases(pinnedReleases); }catch(_ePrS){}`);

sub('upcoming list filter',
  `          if(r && r.date && window.__scUpcomingDay(r.date)) _out.push({ artist: artist, title: r.title || '', date: window.__scDay10(r.date), art: r.art || null, rel: r });`,
  `          if(!r || window.__scJunkTitle(r.title)) return;   // remixes never count as a drop
          if(r.date && window.__scUpcomingDay(r.date)) _out.push({ artist: artist, title: r.title || '', date: window.__scDay10(r.date), art: r.art || null, rel: r });`);

sub('Home release list filter',
  `        (pinnedReleases[artist] || []).forEach(rel => all.push({ ...rel, artist }));`,
  `        (pinnedReleases[artist] || []).forEach(rel => { if(!window.__scJunkTitle(rel.title)) all.push({ ...rel, artist }); });`);

// Marker carries the newline: the 8-space Home-bubble line above CONTAINS this
// 6-space line as a substring, so a bare marker would read as "already applied".
sub('New releases section filter',
  `      (pinnedReleases[artist] || []).forEach(rel => all.push({ ...rel, artist }));`,
  `      (pinnedReleases[artist] || []).forEach(rel => { if(!window.__scJunkTitle(rel.title)) all.push({ ...rel, artist }); });`,
  1,
  `\n      (pinnedReleases[artist] || []).forEach(rel => { if(!window.__scJunkTitle(rel.title)) all.push({ ...rel, artist }); });`);

sub('Fetch latest popup filter',
  `        var releases = []; Object.keys(pinnedReleases).forEach(function(aname){ (pinnedReleases[aname]||[]).forEach(function(r){ releases.push(Object.assign({}, r, {artistName:aname})); }); }); releases.sort((a,b) => (b.date||'').localeCompare(a.date||''));`,
  `        var releases = []; Object.keys(pinnedReleases).forEach(function(aname){ (pinnedReleases[aname]||[]).forEach(function(r){ if(window.__scJunkTitle(r.title)) return; releases.push(Object.assign({}, r, {artistName:aname})); }); }); releases.sort((a,b) => (b.date||'').localeCompare(a.date||''));`);

// ---------------------------------------------------------------------------
// 7. The empty Upcoming tab explains itself: how many pinned artists were
//    checked and when, instead of implying you have pinned nobody.
// ---------------------------------------------------------------------------
sub('empty-tab line',
  `  window.__scUpcomingAutofetch = async function(){`,
  `  // The empty Upcoming tab's line. It used to be flat boilerplate — "pin an
  // artist whose next drop is dated" — which read as a broken tab when every
  // pinned artist had already been checked and no catalog simply has a day for
  // their next release yet. An empty tab now reports the check that produced it.
  window.__scUpcomingEmptyText = function(){
    try{
      var n = (typeof pinnedArtists !== 'undefined' && pinnedArtists) ? pinnedArtists.length : 0;
      if(!n) return 'Pin artists in Discover \\u2014 SideCut then reads the open catalogs for their next drop.';
      var at = 0;
      try{ at = parseInt(localStorage.getItem('sidecut_pinnedAutoAt') || '0', 10) || 0; }catch(_eAt){}
      try{ if(typeof pinnedCheckState !== 'undefined' && pinnedCheckState && pinnedCheckState.finishedAt) at = pinnedCheckState.finishedAt; }catch(_eCs){}
      var when = '';
      if(at){
        var ago = '';
        try{ ago = (typeof timeAgo === 'function') ? ' ' + timeAgo(at) : ''; }catch(_eAg){}
        when = ' SideCut last read the catalogs for all ' + n + ' pinned artist' + (n === 1 ? '' : 's') + ago + ' and none of them is dated ahead.';
      }
      return 'No upcoming releases yet \\u2014 no drop from your pinned artists has a date in the open catalogs.'
        + when
        + ' A store usually lists the day a week or two before the release, and the check runs again on its own.';
    }catch(_e){ return 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.'; }
  };
  window.__scUpcomingAutofetch = async function(){`);

sub('Home empty line',
  `            _hbEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';`,
  `            _hbEmpty.textContent = (typeof window.__scUpcomingEmptyText === 'function') ? window.__scUpcomingEmptyText() : 'No upcoming releases yet.';`);

sub('popup empty line',
  `      _upEmpty.textContent = 'No upcoming releases yet \\u2014 pin an artist whose next drop is dated.';`,
  `      _upEmpty.textContent = (typeof window.__scUpcomingEmptyText === 'function') ? window.__scUpcomingEmptyText() : 'No upcoming releases yet.';`);

sub('empty line refresh',
  `  var emptyEl = root.querySelector('#dpRelUpEmpty');
  if(emptyEl){ root.appendChild(emptyEl); emptyEl.style.display = (upcoming && !up.length) ? 'block' : 'none'; }`,
  `  var emptyEl = root.querySelector('#dpRelUpEmpty');
  if(emptyEl){
    root.appendChild(emptyEl);
    emptyEl.style.display = (upcoming && !up.length) ? 'block' : 'none';
    // Keep the line current — but only while the buttons have not been wired
    // into it yet: writing textContent after __scWireUpcomingCta ran would take
    // the CTA buttons with it.
    if(upcoming && !up.length && !emptyEl._scUpWired){
      try{ emptyEl.textContent = window.__scUpcomingEmptyText(); }catch(_eEmpty){}
    }
  }`);

fs.writeFileSync(FILE, src);
console.log('patch-628: ' + edits + ' index.html edit(s)');
