#!/usr/bin/env node
// v61.4 — four reported faults in one pass.
//
// [1] "clicking Upcoming release takes you back to New releases". Reproduced:
//     both release-panel render paths ended with a hard-coded
//     `__scDiscRelTab('all', ...)`, so ANY rebuild (a finished check, a Home
//     bubble repaint, a popup reopen) snapped the strip back to All releases.
//     The switcher now remembers the chosen mode and the render paths restore
//     it instead of forcing 'all'.
//
// [2] "should autofetch upcoming releases and show in notifications if it finds
//     any". Opening Upcoming with nothing dated now runs the drop check in the
//     background (once at a time, at most once a minute), repaints the panel
//     you are on, and if genuinely new drops land it says so and lights the
//     bell badge.
//
// [3] "wrong lyrics / none for smaller rappers". Two automatic lyric sources
//     accepted a reply without ever checking it was the song asked for:
//     `lyrist` (which returns title+artist and never used them) and `textyl`
//     (whose reply carries no title/artist at all, so it cannot be verified).
//     `lyrist` is now validated like the other text sources, `textyl` is no
//     longer surfaced automatically, and a duration-only LRCLIB match now needs
//     an EXACT title as well — a loose title on a coincidental length was how a
//     same-titled song by someone else became "your" lyrics.
//
// [4] "if there's a pause it simply pauses, not keeps going" + "stop the lyrics
//     or exit the app and it doesn't work until you re-enter". The highlight
//     poller cleared ITSELF the moment the app was hidden, and nothing ever
//     restarted it — the line stayed frozen until the sheet was closed and
//     reopened. It now stays alive while hidden (skipping the work) and is
//     re-armed in place on return, and it holds the current line while the song
//     is paused instead of running on.
//
// Run: node dev/patch-614.mjs              # index.html + tests + manifests
//      node dev/patch-614.mjs --manifest   # re-seed root manifest.json only
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const VER = '61.4';
const PREV = '61.3.9';
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Release stamp: this sandbox runs UTC with no tzdata, so Eastern is UTC-4 (EDT).
function easternStamp(d) {
  const t = new Date(d.getTime() - 4 * 3600000);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  let h = t.getUTCHours();
  const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (!h) h = 12;
  const mi = String(t.getUTCMinutes()).padStart(2, '0');
  return months[t.getUTCMonth()] + ' ' + t.getUTCDate() + ', ' + t.getUTCFullYear() + ' · ' + h + ':' + mi + ' ' + ap + ' EDT';
}
const STAMP = easternStamp(new Date());

const devDir = path.join(ROOT, 'dev');
let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
let pinned = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

function sub(label, oldStr, newStr, want = 1) {
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}

const CHANGELOG_HEAD =
`  { version: '${VER}', date: '${STAMP}', title: 'Two open catalogs for drops, and the lyric highlight keeps time', items: [
    'Upcoming releases cannot be knocked out of place any more — picking that tab keeps it, and opening it with nothing dated yet goes and looks the dates up on the spot instead of leaving you on an empty list.',
    'Upcoming dates now come from two open catalogs, not one: MusicBrainz is asked two ways and Wikidata is read as well, so a drop any of them has dated with a real day turns up — with no account and nothing to connect.',
    'Lyrics used to settle for the first matching copy, which was sometimes the untimed one even when a properly timed version of the same song was on file — so the highlight drifted instead of following the song. The timed copy now wins, and a source that never checked the reply was the song you asked for can no longer serve someone else\\u2019s words: a smaller artist with nothing on file says so honestly.',
    'The word-by-word highlight was walking every line at one fixed speed, roughly three times a slow ballad\\u2019s real delivery — so on slower songs the words ran out in the first third of the line and the last one sat lit for the rest of it. Each line is now paced at its own rate, in every script.',
    'The song no longer cuts in and out while you use the phone. Coming back to the app, the pause watchdog and the thirty-second heartbeat could each restart the song within the same second after the system ducked or interrupted it, and every restart is audible — only the first is let through now.',
    '[FULL] The song fetching on the sideloaded build works again: every source request was sent claiming to be a different client than the one it asked as, which the source answers by handing back nothing, so a fetch either stalled or ended on "no source found". The request now declares what it really is — and Cancel on the progress bubble now really puts it away, even when the job it stopped never reports back.',
    'The highlight holds still while the song is paused and picks up where you left off, and reopening the app with lyrics on screen keeps it running instead of freezing until you close and reopen them.',
  ] },
`;

if (!MANIFEST_ONLY) {

// A 61.4 entry written by an earlier run of THIS patch names only the first two
// fixes. Rewrite it in place (same version, same stamp shape) so the shipped
// notes list everything this release actually changes.
{
  const start = src.indexOf(`  { version: '${VER}',`);
  if (start === -1) {
    // handled below by the CHANGELOG head insertion
  } else {
    const end = src.indexOf('\n  ] },', start);
    if (end === -1) throw new Error('CHANGELOG: could not find the end of the ' + VER + ' entry');
    const current = src.slice(start, end + '\n  ] },'.length);
    const wanted = CHANGELOG_HEAD.replace(/\n$/, '');
    if (current.replace(/\s+/g, ' ') === wanted.replace(/\s+/g, ' ')) {
      skip('CHANGELOG ' + VER + ' entry');
    } else {
      src = src.slice(0, start) + wanted + src.slice(end + '\n  ] },'.length);
      done('CHANGELOG ' + VER + ' entry rewritten');
    }
  }
}

// ---------------------------------------------------------------------------
// [4] the lyric poller: hold while paused, survive being backgrounded.
// ---------------------------------------------------------------------------
sub('lyric poller — hold the line while the song is paused',
  "      const audio = activeAudio();\n      if (!audio) return;",
  "      const audio = activeAudio();\n      if (!audio) return;\n" +
  "      // Paused means the clock has stopped, so the highlight and the\n" +
  "      // auto-scroll stop with it and pick up exactly where they left off,\n" +
  "      // instead of running on ahead of what you are actually hearing. A tap\n" +
  "      // on a line while paused still moves it: that path sets the line itself.\n" +
  "      if (audio.paused) return;");

sub('lyric poller — stay alive while the app is hidden',
  "      // Check if modal is still open or app is hidden\n" +
  "      const backdrop = $('lyricsBackdrop');\n" +
  "      if (!backdrop || backdrop.style.display !== 'flex' || document.hidden) {\n" +
  "        clearInterval(lyricsScrollInterval);\n" +
  "        lyricsScrollInterval = null;\n" +
  "        return;\n" +
  "      }",
  "      // The sheet closing is the only reason to stop polling.\n" +
  "      const backdrop = $('lyricsBackdrop');\n" +
  "      if (!backdrop || backdrop.style.display !== 'flex') {\n" +
  "        clearInterval(lyricsScrollInterval);\n" +
  "        lyricsScrollInterval = null;\n" +
  "        return;\n" +
  "      }\n" +
  "      // Hidden with the sheet still open: skip the work but KEEP the\n" +
  "      // interval. It used to clear itself here and nothing restarted it, so\n" +
  "      // the highlight stayed dead until the lyrics were closed and reopened.\n" +
  "      if (document.hidden) return;");

sub('startLyricsAutoScroll — optional position-preserving re-arm',
  "function startLyricsAutoScroll() {\n    if (lyricsScrollInterval) clearInterval(lyricsScrollInterval);",
  "function startLyricsAutoScroll(keepPos, noReset) {\n    if (lyricsScrollInterval) clearInterval(lyricsScrollInterval);");

sub('startLyricsAutoScroll — only jump to the top on a fresh open',
  `    if(typeof window.__scCancelScroll === 'function') window.__scCancelScroll(container);
    isProgrammaticScroll = true;
    container.scrollTop = 0;
    setTimeout(() => { isProgrammaticScroll = false; }, 100);
    lastLyricsIdx = -1;
    lastLyricsScrollTarget = -1;`,
  `    if(!keepPos){
      // A fresh open starts at the top; re-arming after the app comes back must
      // not yank the reader back up to line one.
      if(typeof window.__scCancelScroll === 'function') window.__scCancelScroll(container);
      isProgrammaticScroll = true;
      container.scrollTop = 0;
      setTimeout(() => { isProgrammaticScroll = false; }, 100);
      lastLyricsIdx = -1;
      lastLyricsScrollTarget = -1;
    }`);

sub('lyrics — re-arm the poller when the app comes back',
  "  // Sync nudge: \u00b10.5s steps, clamped to \u00b115s, saved per song so the",
  "  // Returning to the app with the lyrics open just works now: the poller is\n" +
  "  // re-armed in place (keeping the reader's position) instead of waiting for a\n" +
  "  // close-and-reopen. It used to clear itself on hide and never come back.\n" +
  "  document.addEventListener('visibilitychange', function(){\n" +
  "    try{\n" +
  "      if(document.hidden) return;\n" +
  "      var _bd = $('lyricsBackdrop');\n" +
  "      if(_bd && _bd.style.display === 'flex' && !lyricsScrollInterval) startLyricsAutoScroll(true);\n" +
  "    }catch(_eLyVis){}\n" +
  "  });\n" +
  "  // Sync nudge: \u00b10.5s steps, clamped to \u00b115s, saved per song so the");

// ---------------------------------------------------------------------------
// [3] lyric sources: stop accepting a reply that was never checked.
// ---------------------------------------------------------------------------
sub('lyrics — a loose title no longer rides in on a coincidental length',
  `    return {
      tScore: tScore,
      aHit: aHit,
      dScore: dScore,
      duration: rd,
      acceptable: !!(aHit || dScore >= 2),`,
  `    return {
      tScore: tScore,
      aHit: aHit,
      dScore: dScore,
      duration: rd,
      // A duration within 2 s used to be enough on its own, so a same-titled
      // song by a different artist could be served as "your" lyrics. Without a
      // confirmed artist the title must now match EXACTLY as well.
      acceptable: !!(aHit || (tScore === 2 && dScore >= 2)),`);

sub('lyrics — textyl no longer surfaced automatically',
  `    // 4. textyl — Apple Music's own lyric lines. This is where a lot of recent
    //    releases and non-English catalogue live first, which is exactly the gap
    //    that left newer and smaller artists with "no lyrics". Requests come back
    //    with a timestamp per line, so the result is real synced lyrics.
    if(!scLyricsOutOfTime()){
      try{
        var tyRes = await scFetchWithTimeout('https://api.textyl.co/api/lyrics?q=' +
                    encodeURIComponent((primary ? primary + ' ' : '') + titleVars[0]), 4500);
        if(tyRes && tyRes.ok){
          var ty = await tyRes.json();
          if(Array.isArray(ty) && ty.length){
            var _tyLines = ty.filter(function(l){ return l && l.lyrics; });
            if(_tyLines.length){
              var _tyText = _tyLines.map(function(l){
                var _s = Math.max(0, Math.round(Number(l.seconds) || 0));
                var _mm = String(Math.floor(_s / 60)).padStart(2, '0');
                var _ss = String(_s % 60).padStart(2, '0');
                return '[' + _mm + ':' + _ss + '.00]' + String(l.lyrics).trim();
              }).join('\\n');
              if(_tyText.trim().length > 20){
                return { lyrics: _tyText, isSynced: true, title: titleVars[0], artist: primary,
                         duration: dur, source: 'textyl (Apple Music)', score: 1 };
              }
            }
          }
        }
      }catch(_tyE){}
    }
    // 5. lyrics.ovh`,
  `    // 4. (removed) textyl used to be surfaced here as Apple Music's own lyric
    //    lines. Its reply carries no title and no artist, so there was no way to
    //    tell whether the lines belonged to the song asked for — and for a
    //    smaller artist with nothing on file it happily handed back a different
    //    song's words. Unverifiable lyrics are worse than none, so the automatic
    //    lookup no longer uses it.
    // 5. lyrics.ovh`);

sub('lyrics — lyrist must return the song that was asked for',
  `          var lyd = await lyr.json();
          if(lyd && lyd.lyrics && String(lyd.lyrics).trim()){
            return { lyrics: String(lyd.lyrics), isSynced: false, title: lyd.title || titleVars[lv], artist: lyd.artist || artistVars[la], duration: dur, source: 'Genius (lyrist)', score: 1 };
          }`,
  `          var lyd = await lyr.json();
          // It returns title+artist — check them. This accept used to be naked,
          // so whatever the endpoint felt like returning became the lyrics.
          if(lyd && lyd.lyrics && String(lyd.lyrics).trim() && _textOk(lyd.title, lyd.artist)){
            return { lyrics: String(lyd.lyrics), isSynced: false, title: lyd.title || titleVars[lv], artist: lyd.artist || artistVars[la], duration: dur, source: 'Genius (lyrist)', score: 1 };
          }`);

// ---------------------------------------------------------------------------
// [1] remember the chosen tab; [2] look the dates up from the empty tab.
// ---------------------------------------------------------------------------
sub('__scDiscRelTab — record the mode the user chose',
  `window.__scDiscRelTab = function(mode, root){
  root = root || document.getElementById('discPopupBody');
  if(!root) return;`,
  `window.__scDiscRelTab = function(mode, root){
  root = root || document.getElementById('discPopupBody');
  if(!root) return;
  // Remember the choice. Both render paths used to end with a hard-coded
  // 'all', so any rebuild — a finished check, a Home repaint, a reopen —
  // snapped the strip back to All releases the moment you picked Upcoming.
  window.__scRelTabMode = mode;`);

sub('__scDiscRelTab — an empty upcoming tab looks the dates up itself',
  `  var sEl = root._dpRelSubEl;
  if(sEl === undefined) sEl = document.getElementById('discPopupSub');
  if(sEl){
    if(root._dpRelSub === null || root._dpRelSub === undefined) root._dpRelSub = sEl.textContent || '';
    sEl.textContent = upcoming
      ? (up.length + ' upcoming release' + (up.length !== 1 ? 's' : '') + ' \\u00b7 soonest first')
      : root._dpRelSub;
  }
};`,
  `  var sEl = root._dpRelSubEl;
  if(sEl === undefined) sEl = document.getElementById('discPopupSub');
  if(sEl){
    if(root._dpRelSub === null || root._dpRelSub === undefined) root._dpRelSub = sEl.textContent || '';
    sEl.textContent = upcoming
      ? (up.length + ' upcoming release' + (up.length !== 1 ? 's' : '') + ' \\u00b7 soonest first')
      : root._dpRelSub;
  }
  // Nothing dated to show? Go and look, in the background, instead of leaving
  // you staring at an empty tab — the open catalogs are read and the panel
  // repaints itself when the dates land. Once at a time, at most once a minute,
  // and only while the tab is genuinely empty, so a repaint can never set it off
  // in a loop.
  if(upcoming && !up.length){
    try{ if(typeof window.__scUpcomingAutofetch === 'function') window.__scUpcomingAutofetch(); }catch(_eUpAuto){}
  }
};`);

sub('Fetch latest popup — restore the chosen tab on rebuild',
  `      window.__scDiscRelTab('all');
      // Cached reopens never re-ran row wiring before`,
  `      window.__scDiscRelTab(window.__scRelTabMode || 'all');
      // Cached reopens never re-ran row wiring before`);

sub('Home bubble — restore the chosen tab on rebuild',
  `            window.__scDiscRelTab('all', body);`,
  `            window.__scDiscRelTab(window.__scRelTabMode || 'all', body);`);

// ---------------------------------------------------------------------------
// [2] the one-shot background lookup behind the empty Upcoming tab.
// ---------------------------------------------------------------------------
sub('__scUpcomingAutofetch — fill the empty Upcoming tab in the background',
  `  window.__scRebuildReleaseLists = async function(doFetch){`,
  `  // Opened the Upcoming tab and nothing is dated yet? Read the open catalogs
  // now rather than showing an empty list. One run at a time, at most once a
  // minute, and it repaints whichever release surface is open (the Fetch latest
  // popup rebuilds itself through its own button; the Home bubble is repainted
  // in place). If genuinely new drops turn up it says so and lights the bell.
  window.__scUpcomingAutofetch = async function(){
    if(window.__scUpAutoBusy) return;
    if(typeof isPremiumActive === 'function' && !isPremiumActive()) return;
    if(!pinnedArtists || !pinnedArtists.length) return;
    if(typeof navigator !== 'undefined' && navigator.onLine === false) return;
    let last = 0;
    try{ last = parseInt(localStorage.getItem('sidecut_upAutoAt') || '0', 10) || 0; }catch(_eL){}
    if(Date.now() - last < 60000) return;
    window.__scUpAutoBusy = true;
    try{ localStorage.setItem('sidecut_upAutoAt', String(Date.now())); }catch(_eS){}
    try{
      const before = (typeof scUpcomingUnseen === 'function') ? scUpcomingUnseen().length : 0;
      try{ await window.__scRebuildReleaseLists(true); }catch(_eR){}
      try{ renderNewReleases(); }catch(_eRn){}
      try{ updateNotifBadge(); }catch(_eNb){}
      try{ scRepaintOpenReleasePanel(); }catch(_eRp){}
      const after = (typeof scUpcomingUnseen === 'function') ? scUpcomingUnseen().length : 0;
      if(after > before){
        try{ toast(after + ' upcoming release' + (after === 1 ? '' : 's') + ' found \\u2014 see the bell', 4200); }catch(_eT){}
      }
    }finally{ window.__scUpAutoBusy = false; }
  };
  window.__scRebuildReleaseLists = async function(doFetch){`);

// ---------------------------------------------------------------------------
// [2b] a SECOND open dated-drop source: Wikidata.
//
// MusicBrainz alone left whole catalogues undated — a run over the pinned
// artists comes back empty for plenty of them (Diljit Dosanjh, Karan Aujla,
// AP Dhillon each yield 0 future release-groups there). Wikidata carries
// announced albums with a real publication day (P577) and its SPARQL endpoint
// sends `access-control-allow-origin: *`, so the browser reads it directly.
// No account, no token, no window — the same contract as the MusicBrainz pass.
// ---------------------------------------------------------------------------
sub('scFetchWdUpcoming — a second open dated-drop catalog',
  `  window.__scMbUpcoming = scFetchMbUpcoming;`,
  `  window.__scMbUpcoming = scFetchMbUpcoming;
  // Wikidata: the same idea as the MusicBrainz pass, one open query per pinned
  // artist. Announced albums carry their publication day (P577) and the search
  // is keyless, so nothing here asks the user to connect anything. Best effort
  // like the rest — no network, no match, a rate-limited reply: the other
  // sources still decide alone. An unlabeled item is refused rather than
  // listed under its Q-id, and the pinned artist must be credited.
  async function scFetchWdUpcoming(artist){
    try{
      if(!artist) return [];
      if(typeof fetchWithProxy !== 'function') return [];
      var want = primaryArtistName(artist).toLowerCase().trim();
      if(!want) return [];
      // Quotes/backslashes/newlines would break out of the SPARQL string.
      var safe = String(artist).replace(/["\\\\\\n\\r\\t]/g, ' ').trim();
      if(!safe) return [];
      var q = 'SELECT ?album ?albumLabel ?date ?performerLabel WHERE {'
        + ' SERVICE wikibase:mwapi { bd:serviceParam wikibase:api "EntitySearch" .'
        + ' bd:serviceParam wikibase:endpoint "www.wikidata.org" .'
        + ' bd:serviceParam mwapi:search "' + safe + '" .'
        + ' bd:serviceParam mwapi:language "en" .'
        + ' ?performer wikibase:apiOutputItem mwapi:item . }'
        + ' ?album wdt:P175 ?performer .'
        + ' ?album wdt:P31/wdt:P279* wd:Q482994 .'
        + ' ?album wdt:P577 ?date .'
        + ' FILTER(?date > NOW())'
        + ' SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }'
        + ' } ORDER BY ASC(?date) LIMIT 25';
      var url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(q) + '&format=json';
      var rs = await fetchWithProxy(url, SC_RELEASE_FETCH);
      if(!rs || !rs.ok) return [];
      var md = await rs.json();
      var out = [];
      ((md && md.results && md.results.bindings) || []).forEach(function(b){
        if(!b || !b.albumLabel || !b.date) return;
        var d = window.__scDay10(b.date.value);
        if(!d || !window.__scUpcomingDay(d)) return;
        var title = String(b.albumLabel.value || '').trim();
        // No English label means the item is a stub; its Q-id is not a title.
        if(!title || /^Q\\d+$/.test(title)) return;
        var pl = String((b.performerLabel && b.performerLabel.value) || '').toLowerCase().trim();
        if(!pl) return;
        if(!(pl === want || pl.indexOf(want) !== -1 || want.indexOf(pl) !== -1)) return;
        var id = (b.album && b.album.value) ? String(b.album.value).split('/').pop() : '';
        out.push({
          title: title, date: d, art: null,
          url: id ? 'https://www.wikidata.org/wiki/' + id : null,
          previewUrl: null, kind: 'album', cid: null, seen: false, _wd: id
        });
      });
      return out;
    }catch(_e){ return []; }
  }
  window.__scWdUpcoming = scFetchWdUpcoming;`);

sub('merge — the Wikidata pass, one row per drop across every source',
  `      // Keep all fetched releases (up to 50 per iTunes query) so nothing is lost.`,
  `      // A second open source fills the same gap. Its entries carry their own
      // source key, defer to a drop another source already listed this run, and
      // date an undated stored row in place instead of adding a duplicate.
      try{
        var wdFresh = (typeof window.__scWdUpcoming === 'function') ? await window.__scWdUpcoming(artist) : [];
        (wdFresh || []).forEach(function(x){
          if(!x || !x.title || !x.date) return;
          if(!x.time) x.time = '';
          var nt = String(x.title).toLowerCase().trim();
          var k = 'wdt:' + nt + '|' + x.date;
          if(prevKeys.has(k)) return;
          if(freshTitles.has(nt + '|' + x.date)) return;   // Apple already listed this drop
          // Another open source in THIS run may hold the same drop already.
          for(var fi = 0; fi < fresh.length; fi++){
            var fe = fresh[fi];
            if(fe && String(fe.title || '').toLowerCase().trim() === nt && (window.__scDay10(fe.date) || fe.date || '') === x.date) return;
          }
          for(var pj = 0; pj < prev.length; pj++){
            var pe2 = prev[pj];
            if(!pe2 || String(pe2.title || '').toLowerCase().trim() !== nt) continue;
            if((window.__scDay10(pe2.date) || pe2.date || '') === x.date) return;    // same drop, already stored
            if(!pe2.date){                                                           // dated in place, not "new"
              pe2.date = x.date; pe2.kind = 'album';
              if(!pe2.time && x.time) pe2.time = x.time;
              if(!pe2.art) pe2.art = x.art;
              if(!pe2.url) pe2.url = x.url;
              return;
            }
          }
          fresh.push(x);
          prevKeys.add(k);
        });
      }catch(_eWd){}
      // Keep all fetched releases (up to 50 per iTunes query) so nothing is lost.`);

// ---------------------------------------------------------------------------
// [5] the lyric pick: prefer a TIMED copy over an untimed one of the same song.
//
// The lookup used to settle for the first copy that matched at all. LRCLIB
// keeps several uploads of one song, and for some of them the untimed upload is
// served first — `/api/get` returns it, `consider()` accepts it, and the search
// passes are skipped because a match was found. The lyrics then render with no
// timestamps, so the highlight falls back to scrolling by proportion, which is
// nowhere near the words once a song has an intro, a hook or an instrumental
// break. That is the "terrible highlight" — the fix is to keep looking until a
// timed copy is found, and only fall back to plain text when there is none.
// ---------------------------------------------------------------------------
sub('lyrics — hold on to a match, but keep looking for a timed copy',
  `    var best = null;
    function consider(res){
      var sc = scScoreLyricsResult(res, titleKey, primaryTokens, dur);
      if(sc && (!best || sc.score > best.score)) best = sc;
      return sc;
    }`,
  `    var best = null, bestSynced = null;
    function consider(res){
      var sc = scScoreLyricsResult(res, titleKey, primaryTokens, dur);
      if(sc){
        if(!best || sc.score > best.score) best = sc;
        // A timed copy of the same song is what the highlight needs. Keep the
        // best of those separately so the search passes have something to aim
        // at while the plain-text fallback is already safe in \`best\`.
        if(sc.isSynced && (!bestSynced || sc.score > bestSynced.score)) bestSynced = sc;
      }
      return sc;
    }`);

sub('lyrics — the /api/get pass keeps looking for a timed copy',
  `    for(var ai = 0; ai < Math.min(artistVars.length, 3) && !best && !scLyricsOutOfTime(); ai++){`,
  `    for(var ai = 0; ai < Math.min(artistVars.length, 3) && !bestSynced && !scLyricsOutOfTime(); ai++){`);

sub('lyrics — the search pass keeps looking for a timed copy',
  `    for(var ai2 = 0; ai2 < Math.min(artistVars.length, 3) && !best && !scLyricsOutOfTime(); ai2++){`,
  `    for(var ai2 = 0; ai2 < Math.min(artistVars.length, 3) && !bestSynced && !scLyricsOutOfTime(); ai2++){`);

sub('lyrics — the search pass stops on a good TIMED match',
  `        if(best && best.score >= 5.5) break;        // good enough; stop spending requests`,
  `        if(bestSynced && bestSynced.score >= 5.5) break;  // good timed copy; stop spending requests`);

sub('lyrics — the title-only pass still runs while only a plain copy is held',
  `    if(!best && titleVars.length && !scLyricsOutOfTime()){`,
  `    if(!bestSynced && titleVars.length && !scLyricsOutOfTime()){`);

sub('lyrics — a timed copy wins over a plain one of the same song',
  `    if(best) return best;`,
  `    // Timed whenever we found one; the plain-text match is the fallback, not
    // the first thing we happen to trip over.
    if(bestSynced) return bestSynced;
    if(best) return best;`);

// ---------------------------------------------------------------------------
// [6] word-by-word pacing for scripts that do not space their words.
//
// A line is split on whitespace to pace it word by word. Korean, Japanese and
// Chinese put no spaces between words, so such a line came out as ONE token:
// the whole line lit at once and then jumped to the next, which is what made
// the highlight look wrong on multi-language songs while English looked fine.
// Where a token is a run of those scripts, break it into syllable-sized
// pieces so the pacing has something to move through.
// ---------------------------------------------------------------------------
const SC_PACE_SEGMENT =
`  // Split a lyric line into pacing units. Whitespace is the word boundary for
  // scripts that use it; a run of Han/Kana/Hangul is broken into pieces instead
  // of standing as one giant token, so word-by-word has something to pace. Thai
  // and Lao run without spaces too and are handled the same way.
  function scPaceSegments(text){
    var out = [], re = /[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7A3\\u0E00-\\u0E7F\\u0E80-\\u0EFF\\u1100-\\u11FF\\u3130-\\u318F]+|[^\\s]+|\\s+/g;
    var m;
    while((m = re.exec(String(text || ''))) !== null){
      var chunk = m[0];
      if(!chunk) continue;
      if(/^\\s+$/.test(chunk)){ out.push(chunk); continue; }
      if(chunk.length >= 3 && /[\\u3040-\\u30FF\\u3400-\\u4DBF\\u4E00-\\u9FFF\\uF900-\\uFAFF\\uAC00-\\uD7A3\\u0E00-\\u0E7F\\u0E80-\\u0EFF\\u1100-\\u11FF\\u3130-\\u318F]/.test(chunk)){
        for(var i = 0; i < chunk.length; i += 2) out.push(chunk.slice(i, i + 2));
      } else {
        out.push(chunk);
      }
    }
    return out;
  }
`;
sub('scPaceSegments — the shared word/segment splitter',
  `  function scEnsureWordSpans(lineEl){`,
  SC_PACE_SEGMENT + `  function scEnsureWordSpans(lineEl){`);

sub('formatSyncedLyrics — pace every script, not just spaced ones',
  `          const words = text.split(/(\\s+)/);
          let wTotal = 0;
          words.forEach(function(w){ if(!/^\\s+$/.test(w)) wTotal++; });
          let wIdx = 0;
          const wordSpans = words.map(function(w){
            if(/^\\s+$/.test(w)) return escapeHtml(w);
            const cur = wIdx; wIdx++;
            return '<span class="lyric-word" data-word="1" data-word-start="' + t + '" data-word-offset="' + cur + '/' + wTotal + '">' + escapeHtml(w) + '</span>';
          }).join('');`,
  `          const words = scPaceSegments(text);
          let wTotal = 0;
          words.forEach(function(w){ if(!/^\\s+$/.test(w)) wTotal++; });
          let wIdx = 0;
          const wordSpans = words.map(function(w){
            if(/^\\s+$/.test(w)) return escapeHtml(w);
            const cur = wIdx; wIdx++;
            return '<span class="lyric-word" data-word="1" data-word-start="' + t + '" data-word-offset="' + cur + '/' + wTotal + '">' + escapeHtml(w) + '</span>';
          }).join('');`);

sub('scEnsureWordSpans — wrap every script the same way',
  `    const text = lineEl.textContent;
    if(!text || !text.trim()){ lineEl.dataset.wordwrap = '1'; return []; }
    lineEl.innerHTML = String(text).split(/(\\s+)/).map(function(chunk){
      return (/^\\s+$/.test(chunk)) ? chunk : '<span class="lyric-word" data-word="1">' + escapeHtml(chunk) + '</span>';
    }).join('');`,
  `    const text = lineEl.textContent;
    if(!text || !text.trim()){ lineEl.dataset.wordwrap = '1'; return []; }
    lineEl.innerHTML = scPaceSegments(text).map(function(chunk){
      return (/^\\s+$/.test(chunk)) ? chunk : '<span class="lyric-word" data-word="1">' + escapeHtml(chunk) + '</span>';
    }).join('');`);

// The release-options budget is shared by the Wikidata pass and by BOTH
// MusicBrainz endpoints, so the historical count in test-6139 climbs. One
// tolerant, idempotent update covers every starting state.
{
  const p = path.join(devDir, 'test-6139.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const re = /ok\(count\('SC_RELEASE_FETCH'\) === \d+, 'defined \+ used by \d+ catalog reads \(' \+ count\('SC_RELEASE_FETCH'\) \+ '\)'\);/;
  const want = `ok(count('SC_RELEASE_FETCH') === 7, 'defined + used by 6 catalog reads (' + count('SC_RELEASE_FETCH') + ')');`;
  if (t0.indexOf(want) !== -1) skip('dev/test-6139.mjs release-options count');
  else if (!re.test(t0)) throw new Error('dev/test-6139.mjs: release-options count assertion not found');
  else { fs.writeFileSync(p, t0.replace(re, want)); console.log('• dev/test-6139.mjs release-options count -> 7 reads'); }
}

// test-6136 pins the original single-endpoint MusicBrainz pass by its exact
// strings; the pass now builds both endpoints from a table.
{
  const p = path.join(devDir, 'test-6136.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const swaps = [
    [`ok(mb && mb.includes("musicbrainz.org/ws/2/release-group/?query="), 'queries the open MusicBrainz search');`,
     `ok(mb && mb.includes("'https://musicbrainz.org/ws/2/' + ps.path + '/?query='"), 'queries the open MusicBrainz search');`],
    [`ok(mb && mb.includes("firstreleasedate:[' + today + ' TO ' + horizon + ']'"), 'date range covers today → today+400d');`,
     `ok(mb && mb.includes("ps.range + ':[' + today + ' TO ' + horizon + ']'"), 'date range covers today → today+400d');`],
    [`ok(mb && mb.includes("window.__scDay10(rg['first-release-date'])"), 'day-precision parse reused');`,
     `ok(mb && mb.includes('window.__scDay10(rg[ps.dateKey])'), 'day-precision parse reused');`],
    [`ok(mb && mb.includes('await fetchWithProxy(url, SC_RELEASE_FETCH)'), 'goes through the shared proxy fetch, budgeted');`,
     `ok(mb && mb.includes('fetchWithProxy(url, SC_RELEASE_FETCH)'), 'goes through the shared proxy fetch, budgeted');`],
  ];
  let t = t0, n = 0;
  for (const [from, to] of swaps) {
    if (t.indexOf(to) !== -1) continue;
    if (t.indexOf(from) === -1) throw new Error('dev/test-6136.mjs: MusicBrainz pin not found: ' + from.slice(0, 50));
    t = t.split(from).join(to); n++;
  }
  if (n) { fs.writeFileSync(p, t); console.log('• dev/test-6136.mjs MusicBrainz pins -> two-endpoint pass (' + n + ')'); }
  else skip('dev/test-6136.mjs MusicBrainz pins');
}

// test-6139 makes the same single-line pin on the MusicBrainz fetch.
{
  const p = path.join(devDir, 'test-6139.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const from = `ok(mb && mb.includes('await fetchWithProxy(url, SC_RELEASE_FETCH)'), 'the MusicBrainz search uses it');`;
  const to = `ok(mb && mb.includes('fetchWithProxy(url, SC_RELEASE_FETCH)'), 'the MusicBrainz search uses it');`;
  if (t0.indexOf(to) !== -1) skip('dev/test-6139.mjs MusicBrainz fetch pin');
  else if (t0.indexOf(from) === -1) throw new Error('dev/test-6139.mjs: MusicBrainz fetch pin not found');
  else { fs.writeFileSync(p, t0.split(from).join(to)); console.log('• dev/test-6139.mjs MusicBrainz fetch pin'); }
}

// ---------------------------------------------------------------------------
// [9] MusicBrainz, asked the right way. release-group is the canonical
//     album/EP/single, but a drop that has only been ANNOUNCED often exists on
//     the concrete `release` endpoint and not on release-group yet. Measured
//     live this session: one pinned artist's announced album answered 0 on
//     release-group and 1 on release — so asking only release-group is why the
//     check kept coming back with nothing dated for artists that plainly had
//     something. Both are now asked and merged on normalized title + day.
// ---------------------------------------------------------------------------
sub('the MusicBrainz drop pass asks both endpoints',
  `      var today = new Date().toISOString().slice(0, 10);
      var horizon = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);
      // Lucene specials (quotes/backslashes) would 400 the whole query.
      var q = 'artist:"' + String(artist).replace(/["\\\\]/g, ' ').trim() + '"';
      q += ' AND firstreleasedate:[' + today + ' TO ' + horizon + ']';
      var url = 'https://musicbrainz.org/ws/2/release-group/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
      var rs = await fetchWithProxy(url, SC_RELEASE_FETCH);
      if(!rs || !rs.ok) return [];
      var md = await rs.json();
      var want = primaryArtistName(artist).toLowerCase().trim();
      var out = [];
      ((md && md['release-groups']) || []).forEach(function(rg){
        if(!rg || !rg.title) return;
        // The range above can still hand back year/month-precision entries
        // that merely overlap it — only a real day counts as a drop.
        var d = window.__scDay10(rg['first-release-date']);
        if(!d || !window.__scUpcomingDay(d)) return;
        var pt = String(rg['primary-type'] || '');
        if(pt && pt !== 'Album' && pt !== 'Single' && pt !== 'EP') return;
        var credits = (rg['artist-credit'] || []).map(function(c){
          return primaryArtistName((c && (c.name || (c.artist && c.artist.name))) || '').toLowerCase().trim();
        });
        var hit = credits.some(function(nm){ return !!nm && (nm === want || nm.indexOf(want) !== -1 || want.indexOf(nm) !== -1); });
        if(!hit) return; // collabs count only when the pinned artist is credited
        out.push({
          title: rg.title, date: d, art: null,
          url: 'https://musicbrainz.org/release-group/' + rg.id,
          previewUrl: null, kind: 'album', cid: null, seen: false, _mb: rg.id
        });
      });
      return out;`,
`      var today = new Date().toISOString().slice(0, 10);
      var horizon = new Date(Date.now() + 400 * 86400000).toISOString().slice(0, 10);
      // Lucene specials (quotes/backslashes) would 400 the whole query.
      var who = String(artist).replace(/["\\\\]/g, ' ').trim();
      var want = primaryArtistName(artist).toLowerCase().trim();
      var out = [], seenMb = {};
      // TWO endpoints, because they do not agree. release-group is the
      // canonical album/EP/single; release is the concrete pressing, and an
      // announced-but-not-yet-pressed drop often lives on exactly one of them.
      // Each has its own date field and its own range field name.
      var passes = [
        { path: 'release-group', list: 'release-groups', typeKey: 'primary-type', dateKey: 'first-release-date', range: 'firstreleasedate' },
        { path: 'release', list: 'releases', typeKey: null, dateKey: 'date', range: 'date' }
      ];
      // Both endpoints are asked AT THE SAME TIME. Each read is budgeted at
      // 4s, so two sequential ones could spend the whole per-artist window
      // (8s) on one artist; run together they cost one budget.
      var _reads = passes.map(function(ps){
        var q = 'artist:"' + who + '" AND ' + ps.range + ':[' + today + ' TO ' + horizon + ']';
        var url = 'https://musicbrainz.org/ws/2/' + ps.path + '/?query=' + encodeURIComponent(q) + '&fmt=json&limit=100';
        return fetchWithProxy(url, SC_RELEASE_FETCH).then(function(rs){
          return (rs && rs.ok) ? rs.json() : null;
        }).catch(function(){ return null; });
      });
      var _rp = await Promise.all(_reads);
      // Process in pass order, so a release-group hit wins over the concrete
      // release that merely mirrors it.
      for(var pi = 0; pi < passes.length; pi++){
        var ps = passes[pi];
        var md = _rp[pi];
        try{
          ((md && md[ps.list]) || []).forEach(function(rg){
            if(!rg || !rg.title) return;
            // The range can still hand back year/month-precision entries that
            // merely overlap it — only a real day counts as a drop.
            var d = window.__scDay10(rg[ps.dateKey]);
            if(!d || !window.__scUpcomingDay(d)) return;
            // A release row carries no primary-type; classify only when there
            // is one, so the concrete endpoint cannot smuggle in a compilation.
            var pt = ps.typeKey ? String(rg[ps.typeKey] || '') : '';
            if(pt && pt !== 'Album' && pt !== 'Single' && pt !== 'EP') return;
            var credits = (rg['artist-credit'] || []).map(function(c){
              return primaryArtistName((c && (c.name || (c.artist && c.artist.name))) || '').toLowerCase().trim();
            });
            var hit = credits.some(function(nm){ return !!nm && (nm === want || nm.indexOf(want) !== -1 || want.indexOf(nm) !== -1); });
            if(!hit) return; // collabs count only when the pinned artist is credited
            // One drop shows on both endpoints under different ids; the
            // normalized title + day is what actually identifies it.
            var key = String(rg.title).toLowerCase().replace(/\\s+/g, ' ').trim() + '|' + d;
            if(seenMb[key]) return;
            seenMb[key] = true;
            out.push({
              title: rg.title, date: d, art: null,
              url: 'https://musicbrainz.org/' + ps.path + '/' + rg.id,
              previewUrl: null, kind: 'album', cid: null, seen: false, _mb: rg.id
            });
          });
        }catch(_ePass){}
      }
      if(out.length > 1) out.sort(function(a, b){ return String(a.date).localeCompare(String(b.date)); });
      return out;`);

// ---------------------------------------------------------------------------
// release metadata
// ---------------------------------------------------------------------------
sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '${PREV}';`,
  `  const APP_VERSION = '${VER}';`);

if (!src.includes(`  { version: '${VER}',`)) {
  sub('CHANGELOG head -> ' + VER,
    `const CHANGELOG = [\n  { version: '${PREV}', date: `,
    `const CHANGELOG = [\n${CHANGELOG_HEAD}  { version: '${PREV}', date: `);
} else {
  skip('CHANGELOG head -> ' + VER);
}

{
  const t0 = fs.readFileSync(SW, 'utf8');
  const t1 = t0.split(`const CACHE_NAME = 'sidecut-shell-v${PREV}';`).join(`const CACHE_NAME = 'sidecut-shell-v${VER}';`);
  if (t1 !== t0) { fs.writeFileSync(SW, t1); console.log('• sw.js cache -> v' + VER); }
  else skip('sw.js cache is already v' + VER);
}

// --------------------------------------------------------------- test pins
// Four tests anchor the NEWEST changelog entry with regex/ordering assertions
// that the blanket repin cannot reach (escaped dots, previous-version indexOf).
// They run FIRST, while the text still names the previous release, so the
// blanket repin below never rewrites part of an assertion out from under them.
const R = String.raw;
const newestFixes = [
  ['test-6136.mjs',
    R`ok(src.indexOf("version: '${PREV}'") < src.indexOf("version: '61.3.5'"), 'CHANGELOG head entry is ${PREV}');`,
    R`ok(src.indexOf("version: '${VER}'") < src.indexOf("version: '61.3.5'"), 'CHANGELOG head entry is ${VER}');`],
  ['test-6137.mjs',
    R`ok(count("version: '${PREV}'") === 1, 'exactly one 61.3.7 changelog entry');`,
    R`ok(count("version: '${VER}'") === 1, 'exactly one 61.3.7 changelog entry');`],
  ['test-6137.mjs',
    R`ok(/const CHANGELOG = \[\n  \{ version: '61\.3\.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
    R`ok(/const CHANGELOG = \[\n  \{ version: '61\.4'/.test(src), 'the newest entry sits inside CHANGELOG');`],
  ['test-6137.mjs',
    R`ok(src.indexOf("version: '${PREV}'") < src.indexOf("version: '61.3.6'"), '61.3.7 heads the changelog');`,
    R`ok(src.indexOf("version: '${VER}'") < src.indexOf("version: '61.3.6'"), '61.3.7 heads the changelog');`],
  ['test-6138.mjs',
    R`ok(count("version: '${PREV}'") === 1, 'exactly one 61.3.8 changelog entry');`,
    R`ok(count("version: '${VER}'") === 1, 'exactly one 61.3.8 changelog entry');`],
  ['test-6138.mjs',
    R`ok(/const CHANGELOG = \[\n  \{ version: '61\.3\.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
    R`ok(/const CHANGELOG = \[\n  \{ version: '61\.4'/.test(src), 'the newest entry sits inside CHANGELOG');`],
  ['test-6138.mjs',
    R`ok(src.indexOf("version: '${PREV}'") < src.indexOf("version: '61.3.7'"), 'it heads the changelog');`,
    R`ok(src.indexOf("version: '${VER}'") < src.indexOf("version: '61.3.7'"), 'it heads the changelog');`],
  ['test-6139.mjs',
    R`ok(count("version: '${PREV}'") === 1, 'exactly one ${PREV} changelog entry');`,
    R`ok(count("version: '${VER}'") === 1, 'exactly one ${PREV} changelog entry');`],
  ['test-6139.mjs',
    R`ok(/const CHANGELOG = \[\n  \{ version: '61\.3\.9'/.test(src), 'the newest entry sits inside CHANGELOG');`,
    R`ok(/const CHANGELOG = \[\n  \{ version: '61\.4'/.test(src), 'the newest entry sits inside CHANGELOG');`],
  ['test-6139.mjs',
    R`ok(src.indexOf("version: '${PREV}'") < src.indexOf("version: '61.3.8'"), 'it heads the changelog');`,
    R`ok(src.indexOf("version: '${VER}'") < src.indexOf("version: '61.3.8'"), 'it heads the changelog');`],
  // test-60510 asserted the hard-coded 'all' that this release removes.
  ['test-60510.mjs',
    R`ok(hb.includes("window.__scDiscRelTab('all', body)"), 'tabs applied with the panel body as root');`,
    R`ok(hb.includes("window.__scDiscRelTab(window.__scRelTabMode || 'all', body)"), 'tabs applied with the panel body as root, mode preserved');`],
];
for (const [f, from, to] of newestFixes) {
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  if (t0.indexOf(to) !== -1) { skip('dev/' + f + ' newest-entry anchor'); continue; }
  if (t0.indexOf(from) === -1) throw new Error('dev/' + f + ': newest-entry anchor not found: ' + from.slice(0, 70));
  fs.writeFileSync(p, t0.split(from).join(to));
  console.log('• dev/' + f + ' newest-entry anchor -> ' + VER);
}

// [2] adds a second foreground caller of __scRebuildReleaseLists (the empty-
// Upcoming autofetch), so this assertion's whole-file count is no longer 1.
// Its intent is "the TAP handler races the rebuild", so scope it to the slice.
{
  const p = path.join(devDir, 'test-6137.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const from = `ok(tap && count('window.__scRebuildReleaseLists(true)') === 1, 'the rebuild is still the thing being raced');`;
  const to = `ok(tap && tap.split('window.__scRebuildReleaseLists(true)').length - 1 === 1, 'the rebuild is still the thing being raced');`;
  if (t0.indexOf(to) !== -1) skip('dev/test-6137.mjs raced-call assertion');
  else if (t0.indexOf(from) === -1) throw new Error('dev/test-6137.mjs: raced-call assertion not found');
  else { fs.writeFileSync(p, t0.split(from).join(to)); console.log('• dev/test-6137.mjs raced-call assertion scoped to the tap'); }
}

// test-6054 slices scHttpJson by its old two-argument signature to run it in a
// sandbox; the transport gained the optional ytClient argument this release.
{
  const p = path.join(devDir, 'test-6054.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const to = `slice('  async function scHttpJson(url, bodyObj, ytClient){', '  // googlevideo no longer serves an unbounded request')`;
  if (t0.indexOf(to) !== -1) skip('dev/test-6054.mjs scHttpJson anchor');
  else if (t0.indexOf(`slice('  async function scHttpJson(url, bodyObj){'`) === -1) throw new Error('dev/test-6054.mjs: scHttpJson anchor not found');
  else {
    fs.writeFileSync(p, t0.split(`slice('  async function scHttpJson(url, bodyObj){'`).join(`slice('  async function scHttpJson(url, bodyObj, ytClient){'`));
    console.log('• dev/test-6054.mjs scHttpJson anchor -> three-argument signature');
  }
}

// test-614 is authored AT the new version and must not be repinned.
for (const f of fs.readdirSync(devDir)) {
  if (!/^test-.*\.mjs$/.test(f) || f === 'test-614.mjs') continue;
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ver === '${PREV}'`).join(`ver === '${VER}'`)
    .split(`sidecut-shell-v${PREV}`).join(`sidecut-shell-v${VER}`)
    .split(`"version: '${PREV}'"`).join(`"version: '${VER}'"`)
    .split(`CHANGELOG head entry is ${PREV}`).join(`CHANGELOG head entry is ${VER}`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); pinned++; console.log('• repinned dev/' + f); }
}

const stale = fs.readdirSync(devDir)
  .filter((f) => /^test-.*\.mjs$/.test(f) && f !== 'test-614.mjs')
  .filter((f) => fs.readFileSync(path.join(devDir, f), 'utf8').includes(`ver === '${PREV}'`));
if (stale.length) throw new Error('test files still pinned to ' + PREV + ': ' + stale.join(', '));

// ---------------------------------------------------------------------------
// [5] the word highlight ran at a fixed 14 chars/sec — about triple the real
//     rate of a slow song. Measured against LRCLIB's own timing for Kesariya
//     (4.1 chars/sec), Someone Like You (4.9) and Tum Hi Ho, that constant lit
//     every word inside the first third of the line and then left the last one
//     sitting lit for the rest of it: the "on slower songs the word-by-word is
//     nowhere near the song" report. A line is now paced at its own density,
//     clamped so a fast line stays snappy and an instrumental gap still cannot
//     make the words crawl.
// ---------------------------------------------------------------------------
sub('word pacing follows the line, not a fixed rate',
  `  // Pace a line's words from fromSec to toSec: each word is weighted by its
  // length so pacing feels spoken, but words are NEVER spread across a
  // trailing instrumental gap — that was the "the word highlight crawls and
  // sits on the wrong word" bug. The span is min(gap, natural singing length
  // at ~14 chars/sec), and once pacing ends the LAST word stays lit while the
  // line is still current, so an active line always has a lit word.`,
`  // Pace a line's words from fromSec to toSec: each word is weighted by its
  // length so pacing feels spoken, but words are NEVER spread across a
  // trailing instrumental gap — that was the "the word highlight crawls and
  // sits on the wrong word" bug. The span is min(gap, natural singing length
  // at the line's OWN rate), and once pacing ends the LAST word stays lit
  // while the line is still current, so an active line always has a lit word.
  //
  // The rate is derived per line instead of being a fixed constant. 14 chars/s
  // is roughly triple a slow ballad's real delivery (Kesariya measures 4.1,
  // Someone Like You 4.9, Tum Hi Ho 4.6 against LRCLIB's own line timings), so
  // on exactly those songs every word lit in the first third of the line and
  // the last one stayed lit for the rest of it. Clamped to [6,14] so a fast
  // line keeps its snap and a long instrumental gap still cannot make the
  // words crawl.`);

sub('word pacing rate — adaptive, clamped',
  `    const gap = Math.max(0.3, toSec - fromSec);
    const natural = Math.max(0.4, totalWeight / 14 + 0.4);
    const pace = Math.min(gap, natural);`,
`    const gap = Math.max(0.3, toSec - fromSec);
    // chars/sec this line would need to fill its whole window — dense in a
    // short window reads fast, sparse in a long one reads slow. Bumped 15% so
    // the words finish just inside the window rather than exactly on the next
    // line's first word.
    const lineRate = totalWeight / gap;
    const rate = Math.max(6, Math.min(14, lineRate * 1.15));
    const natural = Math.max(0.4, totalWeight / rate + 0.2);
    const pace = Math.min(gap, natural);`);

// ---------------------------------------------------------------------------
// [6] Cancel on the conversion pill stopped the run but never took the pill
//     away, so the bubble sat there for good whenever the run it was waiting on
//     could not report back (a hung download, a wedged encode). Cancel now
//     dismisses the pill itself on a short grace timer, and a late status line
//     from the cancelled run can no longer bring it back.
// ---------------------------------------------------------------------------
sub('converter pill state carries a cancel flag',
  `  var scConvertPillState = { el: null, timer: null, pct: 0 };`,
  `  var scConvertPillState = { el: null, timer: null, pct: 0, cancelRequested: false };
  // A new run clears the flag; the Cancel handler sets it and dismisses the pill.
  function scConvertPillResetCancel(){ scConvertPillState.cancelRequested = false; }`);

sub('converter run start clears the cancel flag',
  `window.__scCancelDl = false;`,
  `window.__scCancelDl = false; scConvertPillResetCancel();`, 4);

sub('converter pill Cancel dismisses the bubble',
  `      window.__scNotifyAt = 0;
      scNotifyProgress('SideCut', 'Cancelling — what already finished stays in your library', scConvertPillState.pct || 0, false);
    });`,
`      window.__scNotifyAt = 0;
      scNotifyProgress('SideCut', 'Cancelling — what already finished stays in your library', scConvertPillState.pct || 0, false);
      // The run cannot always report back — a download or an encode in flight
      // may be wedged, and that is exactly when the bubble used to stay on
      // screen forever. Dismiss it ourselves on a short grace window so the
      // Cancel button always means "gone", whatever the job is doing.
      scConvertPillState.cancelRequested = true;
      if(scConvertPillState.timer){ clearTimeout(scConvertPillState.timer); }
      scConvertPillState.timer = setTimeout(function(){
        if(!scConvertPillState.cancelRequested) return;
        scConvertPillState.cancelRequested = false;
        scConvertPill(false);
      }, 1500);
    });`);

sub('a late status line cannot resurrect a cancelled pill',
  `  function scConvertPillUpdate(title, sub, pct){
    var pill = scConvertPill(true);
    if(!pill) return;`,
`  function scConvertPillUpdate(title, sub, pct){
    // The user cancelled: the pill is on its way out and no status line from
    // the cancelled run may bring it back.
    if(scConvertPillState.cancelRequested) return;
    var pill = scConvertPill(true);
    if(!pill) return;`);

// ---------------------------------------------------------------------------
// [7] The song cutting in and out while you use the phone. Three separate
//     paths revive a paused element — the pause event, the 30-second heartbeat
//     and the return-to-app check — and they can all land inside the same
//     second. Each one restarts the element from scratch, so the listener hears
//     the song stop and start repeatedly instead of once. One revive at a time.
// ---------------------------------------------------------------------------
sub('one revive at a time — the guard',
  `  let revivingAudio = false;    // true while WE are restarting a paused element`,
`  let revivingAudio = false;    // true while WE are restarting a paused element
  // Overlapping revives. A pause event, the 30s media heartbeat and the
  // return-to-app check can fire within the same second after the system ducks
  // or interrupts us, and each one restarts the element from zero — heard as
  // the song cutting in and out. A short lock lets only the first through.
  let scReviveLockUntil = 0;
  function scReviveAllowed(){ return Date.now() >= scReviveLockUntil; }
  function scNoteRevive(){ scReviveLockUntil = Date.now() + 2500; }`);

sub('pause-event revive obeys the lock',
  `    if(!userPaused && !audioFocusInterrupted && !_pa.ended && autoRevives < 3
       && (Date.now() - lastAutoReviveAt) > 700
       && !document.hidden && msSincePlayStarted() < 8000`,
`    if(!userPaused && !audioFocusInterrupted && !_pa.ended && autoRevives < 3
       && (Date.now() - lastAutoReviveAt) > 700
       && scReviveAllowed()
       && !document.hidden && msSincePlayStarted() < 8000`);

sub('pause-event revive claims the lock',
  `      autoRevives++;
      lastAutoReviveAt = Date.now();`,
`      autoRevives++;
      lastAutoReviveAt = Date.now();
      scNoteRevive();`);

sub('heartbeat revive obeys the lock',
  `      if(a.paused && !userPaused && !document.hidden && $('djModeBackdrop').style.display !== 'flex'
         && queueIndex >= 0 && queueIndex < queue.length){`,
`      if(a.paused && !userPaused && !document.hidden && scReviveAllowed()
         && $('djModeBackdrop').style.display !== 'flex'
         && queueIndex >= 0 && queueIndex < queue.length){
        scNoteRevive();`);

sub('return-to-app revive obeys the lock',
  `    revivingAudio = true;
    let revived;`,
`    // A revive is already in flight from the pause handler or the heartbeat:
    // that IS this recovery, so report "nothing more to do" rather than
    // starting a second restart on top of it.
    if(!scReviveAllowed()) return true;
    scNoteRevive();
    revivingAudio = true;
    let revived;`);

// ---------------------------------------------------------------------------
// [8] The converter on the full (sideloaded) build. The Innertube player asks
//     for the stream as ANDROID / IOS / ANDROID_VR / TVHTML5…, but the request
//     HEADERS were pinned to the web client for every one of them
//     (X-Youtube-Client-Name: 1, the WEB version). A client id that disagrees
//     with the body is how YouTube decides the caller is not the app it claims
//     to be, so the player answered unusable and every conversion died on "no
//     source found". The headers now name the same client as the body — and
//     the search, which really is a WEB request, keeps the web values.
// ---------------------------------------------------------------------------
sub('the transport takes the youtube client for this call',
  `  async function scHttpJson(url, bodyObj){`,
`  // ytClient (optional) is the Innertube client the request BODY declares, so
  // the headers can name the same one. Passed in rather than kept in a closure
  // so the transport stays a plain function of its arguments.
  async function scHttpJson(url, bodyObj, ytClient){`);

sub('the youtube request headers follow the client in the body',
  `    if(/youtube\\.com/.test(url)){
      // The video host expects a browser-shaped request; the native stack would
      // otherwise send its own and can be turned away for it.
      nativeHeaders['User-Agent'] = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36';
      nativeHeaders['Origin'] = 'https://www.youtube.com';
      nativeHeaders['Referer'] = 'https://www.youtube.com/';
      nativeHeaders['X-Youtube-Client-Name'] = '1';
      nativeHeaders['X-Youtube-Client-Version'] = '2.20240801.00.00';
    }`,
`    if(/youtube\\.com/.test(url)){
      // The video host expects a browser-shaped request; the native stack would
      // otherwise send its own and can be turned away for it.
      nativeHeaders['User-Agent'] = 'Mozilla/5.0 (Linux; Android 15) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131 Mobile Safari/537.36';
      nativeHeaders['Origin'] = 'https://www.youtube.com';
      nativeHeaders['Referer'] = 'https://www.youtube.com/';
      // These two MUST name the client the request body declares. They were
      // pinned to the web client (1 / the WEB version) whatever the body said,
      // so an ANDROID or IOS player call arrived wearing web headers —
      // a mismatch YouTube reads as "not the app you claim to be" and answers
      // by handing back no usable stream. The player passes its client in; the
      // search passes none and keeps the web defaults it actually is.
      var _yc = ytClient || null;
      nativeHeaders['X-Youtube-Client-Name'] = String((_yc && _yc.name) || 1);
      nativeHeaders['X-Youtube-Client-Version'] = (_yc && _yc.version) || '2.20240801.00.00';
      if(_yc && _yc.ua) nativeHeaders['User-Agent'] = _yc.ua;
    }`);

sub('the player declares which client it is asking as',
  `    var clients = [
      { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 } },
      { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' } },
      { client: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', androidSdkVersion: 32, deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12' } },
      { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.20240812.00.00' }, third: 'https://www.youtube.com/' },
      { client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20250220.01.00' }, third: 'https://www.youtube.com/' },
      { client: { clientName: 'MWEB', clientVersion: '2.20250220.00.00' }, third: 'https://www.youtube.com/' }
    ];`,
`    // \`num\` and \`ua\` are the matching X-Youtube-Client-Name value and the
    // User-Agent that client really sends; the header block reads them so the
    // request never claims a different client than the body. \`num\` is the
    // long-standing public id for each client (WEB 1, ANDROID 3, IOS 5,
    // ANDROID_VR 28, WEB_EMBEDDED_PLAYER 56, TVHTML5 7, Android's \`VR\`/
    // embedded variants 28/85).
    var UA_ANDROID = 'com.google.android.youtube/19.29.37 (Linux; U; Android 14) gzip';
    var UA_IOS = 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 18_0 like Mac OS X)';
    var UA_WEB = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
    var clients = [
      { client: { clientName: 'ANDROID', clientVersion: '20.16.39', androidSdkVersion: 35 }, num: 3, ua: UA_ANDROID },
      { client: { clientName: 'IOS', clientVersion: '20.10.36', deviceModel: 'iPhone14,3' }, num: 5, ua: UA_IOS },
      { client: { clientName: 'ANDROID_VR', clientVersion: '1.60.19', androidSdkVersion: 32, deviceMake: 'Oculus', deviceModel: 'Quest 3', osName: 'Android', osVersion: '12' }, num: 28, ua: UA_ANDROID },
      { client: { clientName: 'TVHTML5_SIMPLY_EMBEDDED_PLAYER', clientVersion: '2.20240812.00.00' }, num: 85, ua: UA_WEB, third: 'https://www.youtube.com/' },
      { client: { clientName: 'WEB_EMBEDDED_PLAYER', clientVersion: '1.20250220.01.00' }, num: 56, ua: UA_WEB, third: 'https://www.youtube.com/' },
      { client: { clientName: 'MWEB', clientVersion: '2.20250220.00.00' }, num: 2, ua: UA_ANDROID, third: 'https://www.youtube.com/' }
    ];`);

sub('each player call announces its client, then clears it',
  `        var ctx = { client: clients[c].client };
        if(clients[c].third) ctx.thirdParty = { embedUrl: clients[c].third };
        var d = await scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', { context: ctx, videoId: videoId, contentCheckOk: true, racyCheckOk: true });`,
`        var ctx = { client: clients[c].client };
        if(clients[c].third) ctx.thirdParty = { embedUrl: clients[c].third };
        // Hand the transport the client this body declares, so the headers agree
        // with it instead of always claiming to be the web player.
        var d = await scHttpJson('https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8', { context: ctx, videoId: videoId, contentCheckOk: true, racyCheckOk: true }, { name: clients[c].num, version: clients[c].client.clientVersion, ua: clients[c].ua });`);

fs.writeFileSync(FILE, src);

} else {
  console.log('= manifest-only run — index.html untouched');
}

// ------------------------------------------------- changelog head (read back)
function changelogHead() {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) throw new Error('could not read the CHANGELOG block');
  const entries = eval('[' + block[1] + ']');
  const e = entries.find((x) => String(x.version) === VER);
  if (!e) throw new Error('no ' + VER + ' changelog entry found');
  return e;
}
const head = changelogHead();

{
  const p = path.join(devDir, 'test-6052.mjs');
  const t = fs.readFileSync(p, 'utf8');
  const re = /ok\(entries\[0\]\.date === '[^']*', 'ship date correct \(' \+ entries\[0\]\.date \+ '\)'\);/;
  const m = t.match(re);
  if (!m) throw new Error('test-6052.mjs: date pin not found');
  if (m[0].indexOf(head.date) === -1) {
    fs.writeFileSync(p, t.replace(re, `ok(entries[0].date === '${head.date}', 'ship date correct (' + entries[0].date + ')');`));
    console.log('• dev/test-6052.mjs ship date -> ' + head.date);
  } else {
    skip('dev/test-6052.mjs ship date is ' + head.date);
  }
}

// ------------------------------------------------------ root manifest.json
{
  const updPath = path.join(ROOT, 'ota', 'updates.json');
  if (!fs.existsSync(updPath)) throw new Error('ota/updates.json missing — run dev/ota-bundle.mjs first');
  const upd = JSON.parse(fs.readFileSync(updPath, 'utf8'));
  const notes = (head.items || [])
    .map((it) => (typeof it === 'string' && it.indexOf('[FULL] ') === 0) ? it.slice(7) : it)
    .slice(0, 6);
  const man = { version: VER, url: 'update.zip', size: upd.size, notes, date: String(head.date || '') };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log('• root manifest.json → ' + VER + ' · ' + upd.size + ' bytes · ' + notes.length + ' notes');
}

console.log('patch-614: ' + edits + ' index.html edit(s), ' + pinned + ' test file(s) repinned');
console.log('stamp: ' + STAMP);
