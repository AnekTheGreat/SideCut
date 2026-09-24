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
`  { version: '${VER}', date: '${STAMP}', title: 'The Upcoming tab stays put, and the lyrics stop guessing', items: [
    'Upcoming releases finally stays where you put it: switching a release list — or letting a check finish — no longer snaps the tabs back to All releases, so the upcoming drops you were reading stay on screen.',
    'Opening Upcoming releases with nothing dated yet now looks the dates up on the spot, in the background, instead of leaving you on an empty tab — and if it finds drops it tells you and marks the bell.',
    'Lyrics stopped guessing: two sources that never checked the reply was the song you asked for can no longer serve someone else\\u2019s words, and a match with the right length but the wrong title is refused. A smaller artist with no lyrics on file now honestly says so instead of showing the wrong song.',
    'Lyrics hold still while the song is paused — the highlight and the auto-scroll stop with the music and pick up where you left off.',
    'Reopening the app with lyrics on screen keeps the highlight running: it used to stay frozen until you closed the lyrics and opened them again.',
    'The same lyric lookup still needs no account and nothing to connect — every source is an open, public catalog.',
  ] },
`;

if (!MANIFEST_ONLY) {

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

// The Wikidata pass is a sixth catalog read through the release options.
{
  const p = path.join(devDir, 'test-6139.mjs');
  const t0 = fs.readFileSync(p, 'utf8');
  const from = `ok(count('SC_RELEASE_FETCH') === 6, 'defined + used by 5 catalog reads (' + count('SC_RELEASE_FETCH') + ')');`;
  const to = `ok(count('SC_RELEASE_FETCH') === 7, 'defined + used by 6 catalog reads (' + count('SC_RELEASE_FETCH') + ')');`;
  if (t0.indexOf(to) !== -1) skip('dev/test-6139.mjs release-options count');
  else if (t0.indexOf(from) === -1) throw new Error('dev/test-6139.mjs: release-options count assertion not found');
  else { fs.writeFileSync(p, t0.split(from).join(to)); console.log('• dev/test-6139.mjs release-options count -> 6 reads'); }
}

// The changelog must name the second source.
sub('CHANGELOG — name the second open catalog',
  `    'The same lyric lookup still needs no account and nothing to connect — every source is an open, public catalog.',`,
  `    'Upcoming dates now come from two open catalogs, not one: MusicBrainz and Wikidata are both read, so a drop either one has dated with a real day turns up — still with no account and nothing to connect.',
    'The same lyric lookup still needs no account and nothing to connect — every source is an open, public catalog.',`);

// ---------------------------------------------------------------------------
// release metadata
// ---------------------------------------------------------------------------
sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '${PREV}';`,
  `  const APP_VERSION = '${VER}';`);

if (src.indexOf(`  { version: '${VER}',`) !== -1) { skip('CHANGELOG head -> ' + VER); }
else sub('CHANGELOG head -> ' + VER,
  `const CHANGELOG = [\n  { version: '${PREV}', date: `,
  `const CHANGELOG = [\n${CHANGELOG_HEAD}  { version: '${PREV}', date: `);

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
