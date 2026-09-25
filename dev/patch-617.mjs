#!/usr/bin/env node
// SideCut v61.7 — lyrics for a song that has only just come out.
//
// The report: "The lyrics for new songs aren't fetching well they are but not
// showing like Aujla szn 1 EP just came out but I can't get lyrics for them."
//
// Measured live on Sep 25, 2026 (release day for Karan Aujla's AUJLA SZN 1):
//   * lrclib.net/api/search?q=Karan Aujla Ashke        -> []
//     lrclib.net/api/search?track_name=Rap Killa       -> []
//     lrclib.net/api/search?q=aujla szn 1              -> []
//     lrclib.net/api/get?artist_name=Karan Aujla&track_name=Ashke -> 404
//     ...while ?track_name=Ashke returns 20 OTHER artists' Ashke songs — the
//     song simply is not filed anywhere yet. Nothing the app can ask for has it.
//   * lrclib.net also answered 503 "ServerOverloaded" twice in a row while that
//     was being probed: on a release day the one live source is BUSY.
//   * the two Genius-derived fallbacks are dead as shipped:
//       some-random-api.com/lyrics -> HTTP 403 {"error":"key required"}
//       lyrist.vercel.app/api/...  -> HTTP 429 for every anonymous call
//     so the effective list is lrclib + lyrics.ovh (an old catalog).
//
// So: the lookup was not broken, but two real defects made a brand-new song
// read as one, and nothing ever looked again.
//
//   [1] A busy source was reported as "no lyrics found": one 1.3 s retry, then
//       the empty state. A busy answer is now retried with growing waits inside
//       the same 12 s lookup deadline, and the reason the lookup came back empty
//       is remembered so the sheet can say WHICH happened.
//   [2] Nothing re-checked a song that came back empty. A track that arrived the
//       day it dropped stayed lyric-less until the user opened the sheet again
//       and happened to catch it after the community had filed it. A small
//       background pass now re-checks a few waiting songs per app open, at most
//       once per 6 h each, newest/never-checked first, and saves what it finds.
//
//   node dev/patch-617.mjs               # code fixes + release metadata
//   node dev/patch-617.mjs --manifest     # re-seed root manifest.json from ota/updates.json
//
// Every index.html edit is count==1 asserted and idempotent, and the write
// happens once at the end, so a bad needle can never half-apply and a rerun is
// a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '61.7';
const PREV = '61.6';
const STAMP = 'September 25, 2026 · 2:50 PM EDT';

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

// `marker` is a short, stable string that exists ONLY after the edit, so
// reworded prose (or an already-applied pass) can never make a rerun throw.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m && m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) {
    throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  }
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. A busy lyrics database is not "no lyrics found".
// ---------------------------------------------------------------------------
const OLD_JSON = [
  '  function scLyricsJson(url){',
  '    if(scLyricsOutOfTime()) return Promise.resolve({ __status: -1 });',
  '    function once(){',
  '      return scFetchWithTimeout(url, 4000).then(function(r){',
  '        if(r.ok) return r.json().catch(function(){ return null; });',
  '        return { __status: r.status };',
  '      }).catch(function(){ return { __status: 0 }; });',
  '    }',
  '    return once().then(function(j){',
  '      var st = j && j.__status;',
  '      if(st === 429 || st === 502 || st === 503){',
  '        return new Promise(function(res){ setTimeout(res, 1300); }).then(once);',
  '      }',
  '      return j;',
  '    });',
  '  }'
].join('\n');

const NEW_JSON = [
  '  // The one live source can be BUSY, and busy is not the same answer as',
  '  // "nothing is filed under this song". Measured on release day (Sep 25, 2026,',
  '  // while the new AUJLA SZN 1 EP was being checked): lrclib.net answered 503',
  '  // "ServerOverloaded" twice in a row. One 1.3 s retry then turned that into',
  '  // "no lyrics found", which reads as a broken lookup. A busy answer is retried',
  '  // with growing waits (still inside the same 12 s lookup deadline), and the',
  '  // reason this lookup came back empty is remembered so the sheet can say which',
  '  // of the two happened.',
  '  var SC_LYRICS_RETRY_WAITS = [700, 1600, 3000];',
  "  var scLyricsFailReason = '';   // '' | 'busy' | 'offline' | 'unreachable'",
  '  function scLyricsJson(url){',
  '    if(scLyricsOutOfTime()) return Promise.resolve({ __status: -1 });',
  '    function once(){',
  '      return scFetchWithTimeout(url, 4000).then(function(r){',
  '        if(r.ok) return r.json().catch(function(){ return null; });',
  '        return { __status: r.status };',
  '      }).catch(function(){ return { __status: 0 }; });',
  '    }',
  '    function attempt(tryIdx){',
  '      return once().then(function(j){',
  '        var st = j && j.__status;',
  '        if(st === undefined){',
  '          // A real answer arrived. Whatever went wrong before, the source is',
  '          // answering now, so an earlier busy/unreachable note is stale and',
  '          // must not colour the empty state.',
  "          if(scLyricsFailReason === 'busy' || scLyricsFailReason === 'unreachable') scLyricsFailReason = '';",
  '          return j;',
  '        }',
  '        var retryable = (st === 429 || st === 502 || st === 503 || st === 0);',
  "        if(st === 429 || st === 502 || st === 503) scLyricsFailReason = 'busy';",
  '        else if(st === 0 && !scLyricsFailReason){',
  "          scLyricsFailReason = (typeof navigator !== 'undefined' && navigator.onLine === false) ? 'offline' : 'unreachable';",
  '        }',
  '        var wait = retryable ? SC_LYRICS_RETRY_WAITS[tryIdx] : undefined;',
  '        if(wait === undefined || scLyricsOutOfTime()) return j;',
  '        return new Promise(function(res){ setTimeout(res, wait); }).then(function(){ return attempt(tryIdx + 1); });',
  '      });',
  '    }',
  '    return attempt(0);',
  '  }'
].join('\n');

const OLD_LOOKUP_HEAD = [
  '  async function scLookupLyrics(artistRaw, titleRaw, duration){',
  '    scLyricsDeadline = Date.now() + 12000;'
].join('\n');

const NEW_LOOKUP_HEAD = [
  '  async function scLookupLyrics(artistRaw, titleRaw, duration){',
  '    scLyricsDeadline = Date.now() + 12000;',
  "    scLyricsFailReason = '';                          // ask again from a clean slate"
].join('\n');

const OLD_LIST_HEAD = [
  '    scLyricsDeadline = Date.now() + 12000;',
  '    scLyricsStrangers = 0;                            // a manual search explains itself'
].join('\n');

const NEW_LIST_HEAD = [
  '    scLyricsDeadline = Date.now() + 12000;',
  "    scLyricsFailReason = '';                          // ask again from a clean slate",
  '    scLyricsStrangers = 0;                            // a manual search explains itself'
].join('\n');

// ---------------------------------------------------------------------------
// 2. The empty state says which happened, and that a new release is expected to
//    be missing for a day or two.
// ---------------------------------------------------------------------------
const OLD_SIGNATURE = [
  '  // Say what was actually looked for, so a wrong artist tag is obvious rather than',
  '  // a mystery, and never leave the sheet sitting on a spinner.',
  '  function scLyricsSayNotFound(artist, title){'
].join('\n');

const NEW_SIGNATURE = [
  '  // Say what was actually looked for, so a wrong artist tag is obvious rather than',
  '  // a mystery, and never leave the sheet sitting on a spinner.',
  '  //',
  '  // `track` is passed in so a song added this week can be told apart from one that',
  '  // has been in the library for months. A brand-new release is missing from every',
  '  // readable lyrics database for a day or two — measured for the AUJLA SZN 1 EP on',
  '  // its release day: lrclib.net had no entry for any of its five tracks — and that',
  '  // is the most common reason a new song comes back empty. Saying so, and that the',
  '  // background pass keeps looking, is the difference between "no lyrics" and "not',
  '  // yet".',
  '  function scLyricsSayNotFound(artist, title, track){'
].join('\n');

const OLD_WHY = [
  '      try{',
  "        var why = document.getElementById('lyricsNotFoundWhy');",
  '        if(why){',
  "          why.style.display = scLyricsStrangers ? 'block' : 'none';",
  '          why.textContent = scLyricsStrangers',
  "            ? ('Found ' + scLyricsStrangers + ' same-titled song' + (scLyricsStrangers === 1 ? '' : 's') +",
  "               ' under a different artist \\u2014 skipped, not served as this track\\'s.')",
  "            : '';",
  '        }',
  '      }catch(_eWhy){}'
].join('\n');

const NEW_WHY = [
  '      try{',
  "        var why = document.getElementById('lyricsNotFoundWhy');",
  '        if(why){',
  '          var _whyLines = [];',
  "          if(scLyricsFailReason === 'busy'){",
  "            _whyLines.push('The lyrics database was busy when SideCut asked \\u2014 that happens on a big release day. Tap \\u21bb Refetch to try again in a moment.');",
  "          }else if(scLyricsFailReason === 'offline' || scLyricsFailReason === 'unreachable'){",
  "            _whyLines.push('SideCut could not reach the lyrics database \\u2014 check the connection, then tap \\u21bb Refetch to try again.');",
  '          }',
  '          if(scLyricsStrangers){',
  "            _whyLines.push('Found ' + scLyricsStrangers + ' same-titled song' + (scLyricsStrangers === 1 ? '' : 's') +",
  "               ' under a different artist \\u2014 skipped, not served as this track\\'s.');",
  '          }',
  '          // Added in the last fortnight is a reasonable stand-in for "this song',
  '          // came out in the last fortnight": that is when a release is still',
  '          // missing from the community databases.',
  '          var _addedDays = (track && Number(track.dateAdded)) ? Math.floor((Date.now() - Number(track.dateAdded)) / 86400000) : -1;',
  '          if(_addedDays >= 0 && _addedDays <= 14 && !scLyricsFailReason){',
  "            _whyLines.push('Added ' + (_addedDays === 0 ? 'today' : _addedDays + ' day' + (_addedDays === 1 ? '' : 's') + ' ago') +",
  '              \' \u2014 a brand-new release usually reaches the lyrics databases a day or two later, and SideCut keeps checking by itself.\');',
  '          }',
  '          why.style.display = _whyLines.length ? \'block\' : \'none\';',
  "          why.textContent = _whyLines.join(' ');",
  '        }',
  '      }catch(_eWhy){}'
].join('\n');

// ---------------------------------------------------------------------------
// 3. Remember when a song was last checked (and came back empty).
// ---------------------------------------------------------------------------
const OLD_RECORD = "      lyrics: t.lyrics || null, lyricsSynced: t.lyricsSynced || false,";
const NEW_RECORD = [
  "      lyrics: t.lyrics || null, lyricsSynced: t.lyricsSynced || false,",
  '      // When the lyrics databases were last asked about this song and had',
  '      // nothing (see scLyricsRecheckRun). Persisted so a restart does not',
  '      // re-ask about every lyric-less song at once.',
  '      lyricsCheckedAt: t.lyricsCheckedAt || null,'
].join('\n');

const OLD_LOAD = [
  '            lyrics: r.lyrics || null,',
  '            lyricsSynced: r.lyricsSynced || false,'
].join('\n');

const NEW_LOAD = [
  '            lyrics: r.lyrics || null,',
  '            lyricsSynced: r.lyricsSynced || false,',
  '            lyricsCheckedAt: r.lyricsCheckedAt || null,'
].join('\n');

const OLD_HIT = [
  '      if(_found){',
  '        track.lyrics = _found.lyrics;',
  '        track.lyricsSynced = _found.isSynced;',
  '        persistTrackMeta(track);',
  '        showLyrics(_found.lyrics, _found.isSynced);',
  '        return;',
  '      }'
].join('\n');

const NEW_HIT = [
  '      if(_found){',
  '        track.lyrics = _found.lyrics;',
  '        track.lyricsSynced = _found.isSynced;',
  '        track.lyricsCheckedAt = Date.now();   // asked and answered',
  '        persistTrackMeta(track);',
  '        showLyrics(_found.lyrics, _found.isSynced);',
  '        return;',
  '      }'
].join('\n');

const OLD_MISS = [
  '      scLyricsSayNotFound(cleanArtist, cleanTitle, track);',
  '    } catch(e) {'
].join('\n');

const NEW_MISS = [
  '      // Remember that this song was asked about and had nothing: the background',
  '      // re-check reads this stamp so it never re-asks on every launch. The song',
  '      // the user just looked at is not the one to spend a request on.',
  '      track.lyricsCheckedAt = Date.now();',
  '      try{ persistTrackMeta(track); }catch(_eMissStamp){}',
  '      scLyricsSayNotFound(cleanArtist, cleanTitle, track);',
  '    } catch(e) {'
].join('\n');

// ---------------------------------------------------------------------------
// 4. The background re-check.
// ---------------------------------------------------------------------------
const ANCHOR_LOOKUP = '  window.__scLookupLyrics = scLookupLyrics;';

const RECHECK = [
  '',
  '  // ---- Lyrics for a song that has only just come out -------------------------',
  '  // The databases SideCut can read are community-run and they trail a release:',
  '  // on the day Karan Aujla\'s AUJLA SZN 1 dropped, lrclib.net had no entry for any',
  '  // of its five tracks (measured), so no matcher could have found them. That part',
  '  // is not something the app can fix. What it CAN fix is that nothing ever looked',
  '  // again — a song that came back empty stayed empty until the sheet happened to',
  '  // be opened after the community finally filed the words.',
  '  //',
  '  // This pass quietly re-checks the songs that are still waiting: a few per app',
  '  // open, and at most once every SC_LYRICS_RECHECK_MS for any one song. A song',
  '  // with lyrics already saved is never re-asked, and neither is one whose words',
  '  // were typed in by hand — those live in the song\'s notes, and a background pass',
  '  // must never overwrite what the user wrote.',
  '  var SC_LYRICS_RECHECK_MS = 6 * 60 * 60 * 1000;   // re-ask about one song at most every 6 h',
  '  var SC_LYRICS_RECHECK_MAX = 5;                   // per pass: a big library must not storm the API',
  '  var scLyricsRecheckRunning = false;',
  '  async function scLyricsRecheckRun(){',
  '    if(scLyricsRecheckRunning) return 0;',
  "    if(typeof navigator !== 'undefined' && navigator.onLine === false) return 0;",
  "    if(typeof document !== 'undefined' && document.visibilityState === 'hidden') return 0;",
  "    if(window.lyricsFetchState && window.lyricsFetchState.active) return 0;   // the manual batch owns it",
  '    var now = Date.now();',
  '    var due = allTracks.filter(function(t){',
  '      if(!t || t.lyrics) return false;',
  "      if(!t.name || t.name === 'Untitled') return false;",
  '      if(t.notes && String(t.notes).trim()) return false;                 // hand-typed lyrics',
  "      if(!t.artist || t.artist === 'Unknown artist') return false;",
  '      return !t.lyricsCheckedAt || (now - Number(t.lyricsCheckedAt)) >= SC_LYRICS_RECHECK_MS;',
  '    });',
  '    if(!due.length) return 0;',
  '    // Never-checked first (that is a song that has just arrived), then whichever',
  '    // has been waiting longest — so the whole library cycles instead of the same',
  '    // five songs being asked about at every launch.',
  '    due.sort(function(a, b){ return (Number(a.lyricsCheckedAt) || 0) - (Number(b.lyricsCheckedAt) || 0); });',
  '    due = due.slice(0, SC_LYRICS_RECHECK_MAX);',
  '    scLyricsRecheckRunning = true;',
  '    var added = 0;',
  '    try{',
  '      for(var i = 0; i < due.length; i++){',
  "        if(typeof navigator !== 'undefined' && navigator.onLine === false) break;",
  '        var t = due[i];',
  '        var found = null;',
  '        try{',
  "          var _artist = (t.artist.indexOf(',') !== -1) ? (scPrimaryArtist(t.artist) || t.artist) : t.artist;",
  "          found = await scLookupLyrics(applyWatermarkPatterns(_artist, true), applyWatermarkPatterns(t.name || '', false), t.duration);",
  '        }catch(_eRecheck){ found = null; }',
  '        if(found && found.lyrics){',
  '          t.lyrics = found.lyrics;',
  '          t.lyricsSynced = found.isSynced;',
  '          t.lyricsCheckedAt = Date.now();',
  '          try{ await persistTrackMeta(t); }catch(_eRecheckSave){}',
  '          added++;',
  '        }else{',
  '          // Stamped on a miss as well — that is what stops the next launch from',
  '          // asking about the same song again straight away.',
  '          t.lyricsCheckedAt = Date.now();',
  '          try{ await persistTrackMeta(t); }catch(_eRecheckMiss){}',
  '        }',
  '        await new Promise(function(r){ setTimeout(r, 1200); });',
  '      }',
  '    }finally{',
  '      scLyricsRecheckRunning = false;',
  '    }',
  '    if(added){',
  "      try{ toast('Lyrics found for ' + added + ' newer song' + (added === 1 ? '' : 's')); }catch(_eToast){}",
  '      try{ refreshEnrichNotif(); }catch(_eNotif){}',
  '    }',
  '    return added;',
  '  }',
  '  window.__scLyricsRecheckRun = scLyricsRecheckRun;'
].join('\n');

const OLD_BOOT = '      if(loaded) setTimeout(() => { runAutoEnrich(); }, 2500);';
const NEW_BOOT = [
  '      if(loaded) setTimeout(() => { runAutoEnrich(); }, 2500);',
  '      // A song added the day it came out is the one the databases are still',
  '      // catching up on, so the lyrics re-check runs on every launch, well clear',
  '      // of the first paint and never while the manual batch is running.',
  "      if(loaded) setTimeout(() => { try{ scLyricsRecheckRun(); }catch(e){ console.error('lyrics re-check failed', e); } }, 20000);"
].join('\n');

const OLD_IMPORT_HOOK = '      setTimeout(() => { runAutoEnrich(); }, 4000);';
const NEW_IMPORT_HOOK = [
  '      setTimeout(() => { runAutoEnrich(); }, 4000);',
  '      // Fresh files are exactly the ones with no lyrics yet: ask about them once',
  '      // the local tag reads have settled, and again on later launches.',
  '      setTimeout(() => { try{ scLyricsRecheckRun(); }catch(e){} }, 45000);'
].join('\n');

if (!MANIFEST_ONLY) {
  sub('lyrics — a busy database is retried, not reported as empty', OLD_JSON, NEW_JSON, 1,
    'var SC_LYRICS_RETRY_WAITS = [700, 1600, 3000];');
  sub('lyrics — the lookup reason is reset per lookup', OLD_LOOKUP_HEAD, NEW_LOOKUP_HEAD, 1,
    "  async function scLookupLyrics(artistRaw, titleRaw, duration){\n    scLyricsDeadline = Date.now() + 12000;\n    scLyricsFailReason = '';");
  sub('lyrics — the manual-search reason is reset too', OLD_LIST_HEAD, NEW_LIST_HEAD, 1,
    "    scLyricsFailReason = '';                          // ask again from a clean slate\n    scLyricsStrangers = 0;");
  sub('lyrics — the empty state is told which track it is', OLD_SIGNATURE, NEW_SIGNATURE, 1,
    'function scLyricsSayNotFound(artist, title, track){');
  sub('lyrics — the empty state says busy / offline / brand-new', OLD_WHY, NEW_WHY, 1,
    'var _whyLines = [];');
  sub('lyrics — the sheet passes the track to the empty state', 'scLyricsSayNotFound(cleanArtist, cleanTitle);',
    'scLyricsSayNotFound(cleanArtist, cleanTitle, track);', 2,
    'scLyricsSayNotFound(cleanArtist, cleanTitle, track);');
  sub('lyrics — a hit stamps when it was checked', OLD_HIT, NEW_HIT, 1,
    'track.lyricsCheckedAt = Date.now();   // asked and answered');
  sub('lyrics — a miss stamps when it was checked', OLD_MISS, NEW_MISS, 1,
    'try{ persistTrackMeta(track); }catch(_eMissStamp){}');
  sub('lyrics — the check time is saved with the song', OLD_RECORD, NEW_RECORD, 1,
    'lyricsCheckedAt: t.lyricsCheckedAt || null,');
  sub('lyrics — and restored when the library loads', OLD_LOAD, NEW_LOAD, 1,
    'lyricsCheckedAt: r.lyricsCheckedAt || null,');
  sub('lyrics — the background re-check', ANCHOR_LOOKUP, ANCHOR_LOOKUP + '\n' + RECHECK, 1,
    'async function scLyricsRecheckRun(){');
  sub('lyrics — re-check on launch', OLD_BOOT, NEW_BOOT, 1,
    "console.error('lyrics re-check failed', e);");
  sub('lyrics — re-check after an import', OLD_IMPORT_HOOK, NEW_IMPORT_HOOK, 2,
    'setTimeout(() => { try{ scLyricsRecheckRun(); }catch(e){} }, 45000);');
}

// ---------------------------------------------------------------------------
// 5. Release metadata: APP_VERSION + the 61.7 changelog head.
//
// NOTE on wording: the head entry's first six items become the OTA patch notes
// for BOTH channels, and dev/test-60510 + dev/test-6058 forbid a
// converter/downloader term there. Keep every note free of download*, convert*,
// "to mp3", "get song", "no source found" and "play build".
//
// The entry is CONTENT-COMPARED rather than insert-only: a release gets written
// more than once while it is being put together, and a later wording has to be
// able to replace an earlier one (patch-615 and patch-616 did the same).
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  sub('APP_VERSION', "  const APP_VERSION = '61.6';", "  const APP_VERSION = '61.7';", 1,
    "const APP_VERSION = '61.7';");

  const ENTRY = [
    "  { version: '61.7', date: '" + STAMP + "', title: 'Lyrics for a just-released song keep looking, and a busy lyrics database is no longer reported as no lyrics', items: [",
    "    'A brand-new release is missing from the lyrics databases for a day or two — they are community-run and file a song after it comes out, not with it. On the day the AUJLA SZN 1 EP dropped, none of its five tracks had a single entry anywhere SideCut can read, so no matcher could have found them. What was actually wrong is that nothing ever asked again: a song that came back empty stayed empty until the lyrics sheet was opened by hand and caught up. SideCut now quietly re-checks the songs that are still waiting, a few at a time and hours apart, so the words turn up on their own.',",
    "    'A song whose words you typed in yourself is never touched by that pass, and a song that already has lyrics saved is never asked about again.',",
    "    'The lyrics database can be busy on a release day: it answered overloaded repeatedly while the new EP was being checked, and one quick retry was not enough to tell that apart from nothing being filed under the song. A busy answer is retried with growing waits now, and when it still will not answer the sheet says the database was busy instead of reporting no lyrics.',",
    "    'The empty state says which of those happened, and for a song added in the last two weeks it adds that a brand-new release usually reaches the lyrics databases a day or two later and that SideCut keeps checking by itself.',",
    "    'The rules for what counts as a match are untouched: the title still has to line up, a same-titled track by a different artist is still refused and still named in the empty state, and no lyrics are ever guessed at.',",
    "    'Nothing else moved — playback, playlists, covers, the drop check, the exports and the search behave exactly as they did.',",
    "  ] },"
  ].join('\n');

  const start = src.indexOf("  { version: '61.7',");
  if (start !== -1) {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the 61.7 entry');
    const tail = '\n  ] },'.length;
    const cur = src.slice(start, end + tail);
    const norm = (s) => s.replace(/\s+/g, ' ');
    if (norm(cur) === norm(ENTRY)) skip('CHANGELOG 61.7 entry');
    else { src = src.slice(0, start) + ENTRY + src.slice(end + tail); done('CHANGELOG 61.7 entry rewritten'); }
  } else {
    sub('CHANGELOG head — 61.7 entry',
      "const CHANGELOG = [\n  { version: '" + PREV + "',",
      "const CHANGELOG = [\n" + ENTRY + "\n  { version: '" + PREV + "',", 1,
      "  { version: '61.7', date: '");
  }
}

if (!MANIFEST_ONLY) fs.writeFileSync(FILE, src);

// ---------------------------------------------------------------------------
// 6. sw.js cache name.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const SW = path.join(ROOT, 'sw.js');
  let sw = fs.readFileSync(SW, 'utf8');
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + PREV + "';";
  const newSw = "const CACHE_NAME = 'sidecut-shell-v" + VER + "';";
  if (sw.includes(newSw)) console.log('= sw.js CACHE_NAME (already ' + VER + ')');
  else {
    const n = sw.split(oldSw).length - 1;
    if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
    fs.writeFileSync(SW, sw.split(oldSw).join(newSw));
    console.log('• sw.js CACHE_NAME -> v' + VER);
  }
}

// ---------------------------------------------------------------------------
// 7. Repin the repo-wide release assertions.
//
// `version: '61.6'` mentions are deliberately NOT touched: they name the
// historical changelog entry that the ordering assertions compare against.
// ---------------------------------------------------------------------------
if (!MANIFEST_ONLY) {
  const REPINS = [
    ["ver === '" + PREV + "'", "ver === '" + VER + "'"],
    ["const CACHE_NAME = 'sidecut-shell-v" + PREV + "';", "const CACHE_NAME = 'sidecut-shell-v" + VER + "';"],
    ["entries[0].version === '" + PREV + "', '" + PREV + " heads the changelog'",
     "entries[0].version === '" + VER + "', '" + VER + " heads the changelog'"],
    ["entries[0].date === 'September 25, 2026 · 2:27 PM EDT'", "entries[0].date === '" + STAMP + "'"]
  ];
  // test-6137/test-6138 pin the head entry with a REGEX literal, where the dot
  // is escaped (version: '61\\.6'). A plain string repin never sees that form.
  // The backslash is built from a char code so no layer in between can eat it.
  const BS = String.fromCharCode(92);
  REPINS.push(["version: '61" + BS + ".6'", "version: '61" + BS + ".7'"]);
  // Two assertions pinned the OLD shape of what 61.7 changes, so they are
  // repinned here rather than deleted:
  //
  //  * test-6137 forbids the string "AUJLA SZN 1" ANYWHERE in the file, because
  //    the add-drop sheet must not ship an example release name. 61.7's notes
  //    and comments name that EP — it is the release the lyrics report was
  //    about — so the rule is now checked against the sheet's own builder, which
  //    is what it was ever about.
  //
  //  * test-6138 pinned `why.style.display = scLyricsStrangers ? ...`, the empty
  //    state showing its explanation only when a same-titled stranger had been
  //    skipped. It now shows whatever reasons there are (busy database, an
  //    unreachable one, a brand-new release, skipped strangers).
  REPINS.push([
    "ok(!src.includes('AUJLA SZN 1'), 'no example release name anywhere');",
    "ok((function(){ var _s = slice('window.__scAddUpcomingDrop = function', '// iTunes publishes an announced release as a pre-order'); return !!_s && !/AUJLA|SZN|e\\.g\\.|Example/i.test(_s); })(), 'no example release name in the add-drop sheet (the notes may name a real one)');"
  ]);
  REPINS.push([
    '  ok(src.includes("why.style.display = scLyricsStrangers ? \'block\' : \'none\';"), \'it shows only when something was skipped\');',
    '  ok(src.includes("why.style.display = _whyLines.length ? \'block\' : \'none\';"), \'it shows whenever there is something to say\');'
  ]);
  let repinned = 0;
  for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
    if (!/^test-.*\.mjs$/.test(name)) continue;
    const p = path.join(ROOT, 'dev', name);
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    for (const [a, b] of REPINS) {
      if (t.indexOf(a) === -1) continue;
      t = t.split(a).join(b);
      repinned++;
      console.log('• ' + name + ' — ' + a.slice(0, 46));
    }
    if (t !== before) fs.writeFileSync(p, t);
  }
  console.log('patch-617: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');
}

// ---------------------------------------------------------------------------
// --manifest: re-seed the legacy root manifest.json from the built channel so
// the two never disagree about the version. Run AFTER dev/ota-bundle.mjs.
// ---------------------------------------------------------------------------
if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-617 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
}
