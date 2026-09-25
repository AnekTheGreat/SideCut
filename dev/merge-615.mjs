// Resolve the 10 index.html conflict blocks left by merging origin/main (v61.4)
// into the local line. Each block is identified by a signature, never by index
// alone, and every replacement is count-asserted so a re-run is a no-op.
import fs from 'node:fs';

const FILE = 'index.html';
let src = fs.readFileSync(FILE, 'utf8');
if (src.includes('<<<<<<< HEAD')) {
  // ---- parse conflict blocks ------------------------------------------------
  const lines = src.split('\n');
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i] !== '<<<<<<< HEAD') continue;
    const start = i;
    let mid = -1;
    let end = -1;
    for (let j = i + 1; j < lines.length; j++) {
      if (lines[j] === '=======') mid = j;
      if (lines[j] === '>>>>>>> origin/main') { end = j; break; }
    }
    if (mid < 0 || end < 0) throw new Error('unterminated conflict at line ' + start);
    blocks.push({ start, mid, end });
    i = end;
  }
  if (blocks.length !== 10) throw new Error('expected 10 conflict blocks, got ' + blocks.length);

  const slice = (b, from, to) => lines.slice(from, to);
  const headOf = (b) => slice(b, b.start + 1, b.mid);
  const theirsOf = (b) => slice(b, b.mid + 1, b.end);

  const expectOne = (haystack, needle, label) => {
    const n = haystack.split(needle).length - 1;
    if (n !== 1) throw new Error(label + ': expected 1 occurrence of ' + JSON.stringify(needle) + ', got ' + n);
  };

  // ---- resolvers ------------------------------------------------------------
  const resolve = (b) => {
    const head = headOf(b);
    const theirs = theirsOf(b);
    const all = head.concat(theirs).join('\n');

    // 0 — the LRCLIB accept rule: keep the verdict/exact-title form and the warning.
    if (all.includes('tScore === 2')) {
      return [
        '      verdict: verdict,',
        '      exactTitle: exactTitle,',
        '      // A duration within 2 s used to be enough on its own, so a same-titled',
        '      // song by a different artist could be served as "your" lyrics. Without a',
        '      // confirmed artist the title must now match EXACTLY as well — and a credit',
        '      // that contradicts ours is refused outright.',
        "      acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign')),"
      ];
    }

    // 1 — consider(): track the timed copy (61.4) AND count refused strangers (61.3.8).
    if (all.includes('bestSynced = null')) {
      return [
        '    var best = null, bestSynced = null;',
        '    scLyricsStrangers = 0;',
        '    function consider(res){',
        '      var sc = scScoreLyricsResult(res, titleKey, primaryTokens, dur);',
        '      if(sc){',
        '        if(!best || sc.score > best.score) best = sc;',
        '        // A timed copy of the same song is what the highlight needs. Keep the',
        '        // best of those separately so the search passes have something to aim',
        '        // at while the plain-text fallback is already safe in `best`.',
        '        if(sc.isSynced && (!bestSynced || sc.score > bestSynced.score)) bestSynced = sc;',
        '      }else{',
        "        // Refused. When it was refused for being someone else's song, say so",
        '        // later rather than pretending nothing was there.',
        '        var rk = scLyricsRank(res, titleKey, primaryTokens, dur);',
        "        if(rk && rk.verdict === 'foreign' && rk.dScore >= 2) scLyricsStrangers++;"
      ];
    }

    // 2 — textyl: 61.4 removed it (its reply carries no title or artist).
    if (all.includes('textyl')) return theirs;

    // 3 — lyrist: keep the stricter title+credit validation from 61.3.8.
    if (all.includes('lyrist')) return head;

    // 4 — the version for this merged release.
    if (all.includes('const APP_VERSION')) return ["  const APP_VERSION = '61.5';"];

    // 5 — changelog: one new head entry carrying the local line's notes, then
    //     61.4's own history exactly as it was published.
    if (all.includes("version: '61.4'")) {
      const head0 = [
        "  { version: '61.5', date: 'September 25, 2026 · 5:00 AM EDT', title: 'Links resolve, every song comes out as its own song, and your lyrics stay yours', items: [",
        '    \'Two songs of the same album that run to almost the same length could come back as the SAME file, or as each other: the clock cannot tell them apart, so the upload that ranked first was accepted for whichever song was being saved at that moment. During one run an upload now belongs to one song only, an upload whose own title answers to another track of that run belongs to that track, and a source whose title matches exactly is tried before anything the clock merely approves — each song comes out as its own song\',',
        '    \'Spotify link lookups stopped resolving: they leaned on free public CORS relay services, corsproxy.io started demanding an API key and the others went quiet for days — so track details, artists, covers and album/playlist track lists came back empty. On the phone those pages are now read straight through the device’s own network path, which needs no relay at all; a browser keeps live relays as its fallback and the dead one has been replaced.\',',
        '    \'The video title lookup inside the app always failed: youtube.com/oembed sends no cross-origin permission, so a WebView could never ask for it. It now runs through the same device network path, so the saved file gets its real title and channel instead of the fallback name.\',',
        '    \'One cancelled album fetch could silence everything that looks things up: the Album History cancel flag stayed latched and every shared lookup answered with nothing for the rest of the session — upcoming drops, cover art and the link lookups’ fallbacks included. The flag now only counts while an album fetch is actually running.\',',
        '    \'MusicBrainz refuses requests that do not say who is asking, and the drop check was sending nothing to identify itself — it now carries an identifying User-Agent through the native network path.\',',
        '    \'An Apple outage no longer ends the drop check: the iTunes pass still finds new singles and albums first, but when it fails, MusicBrainz and the Wikidata pass run anyway instead of the whole check returning empty.\',',
        '    \'Requests that need a body were being sent without one: the shared lookup dropped the method, headers and body a caller passed in, so the AI lyrics and metadata requests went out as plain GETs and could never answer. What a caller asks for now rides all the way through.\',',
        '    \'For a small or regional artist the lyrics came back as somebody else’s song: a title search turns up same-titled tracks by entirely different artists, and any of them that happened to run within a couple of seconds of your file was accepted on its length alone and saved onto the track. A length is not an identity any more — the title has to be the exact one and the credit must not contradict yours, so Bikramjit Dhaliwal’s songs keep his words instead of borrowing Karan Aujla’s.\',',
        '    \'"No lyrics found" now explains itself: it names how many same-titled songs under a different artist were skipped, and the Manual button is reachable from there, so you can paste the words in yourself and they save with the song.\',',
        '    \'The Refetch picker marks a same-titled entry credited to a different artist, so choosing one by hand is a decision instead of a guess.\',',
        '    \'A credit that is really an imprint (T-Series, Saregama Music, Speed Records) neither confirms nor contradicts an artist, so an odd tag still can’t hide a song that is genuinely yours.\',',
        '  ] },'
      ];
      return head0.concat(theirs);
    }

    // 6 — fetchWithProxy: ONE function. Native-first transport with the caller's
    //     init (61.3.9) plus the release check's cancel opt-out and budget (61.4).
    if (all.includes('CORS proxy helper')) {
      return [
        '  // CORS helper — native first on the device, then the direct fetch, then a',
        '  // few public CORS relays, so every lookup keeps working even when one relay',
        '  // is down or blocked. `init` (method/headers/body) rides on the native and',
        '  // direct attempts; the relays only ever replay plain GETs. The same object',
        '  // may also carry { noCancel, budgetMs }: the release check opts out of the',
        '  // Album History cancel switch and gives itself a time budget so one dead',
        '  // relay cannot eat the whole run.',
        '  async function fetchWithProxy(url, init){',
        '    init = init || {};',
        '    var _noCancel = !!init.noCancel;',
        '    var _budget = (typeof init.budgetMs === \'number\' && init.budgetMs > 0) ? init.budgetMs : 8000;',
        '    var _deadline = Date.now() + _budget;',
        '    // Album History’s cancel flag used to be final: once set, EVERY caller of',
        '    // this shared helper got null for the rest of the session — the drop',
        '    // check, cover fetches and the converter’s fallbacks all silently found',
        '    // nothing after one cancelled album fetch. It only means anything while',
        '    // an album fetch is actually running (the cancel handlers clear',
        '    // __ahFetching themselves), and a caller that opted out never touches it.',
        '    if(!window.__ahFetching && !_noCancel) window.__ahCancelled = false;',
        '    // If Album History fetch was cancelled, abort immediately',
        '    if(!_noCancel && window.__ahCancelled) return null;',
        '    try{',
        '      var nf = await __scNativeFetch(url, init);',
        '      if(nf) return nf;',
        '    }catch(_nfe){}'
      ];
    }

    // 7 — fetchArtistReleases: Apple is hoisted (61.4) but guarded so its failure
    //     no longer ends the whole drop check (61.3.9).
    if (head.length === 0 && theirs.some((l) => l.includes('itunes.apple.com/search'))) {
      const idx = theirs.findIndex((l) => l.includes('if(!resp || !resp.ok) return [];'));
      if (idx < 0) throw new Error('block 7: the Apple early-return is not where it was');
      const before = theirs.slice(0, idx);
      const after = theirs.slice(idx + 1).map((l) => {
        if (l.includes('const results =')) return '  ' + l.replace('const results =', 'results =');
        return '  ' + l;
      });
      return before.concat([
        '      // The iTunes pass is one source of three: when it fails (a rate limit, a',
        '      // blocked network, a dead relay) the MusicBrainz and Wikidata passes',
        '      // below still run — one Apple hiccup used to end the whole drop check here,',
        '      // and those two are the only sources carrying DATED future drops anyway.',
        '      let results = [];',
        '      if(resp && resp.ok){'
      ]).concat(after).concat(['      }']);
    }

    // 8 — freshTitles (cross-source dedupe) is 61.4's; keep it.
    if (all.includes('freshTitles = new Set()')) return theirs;

    // 9 — MusicBrainz asked both ways + Wikidata (61.4), carrying the identifying
    //     User-Agent that MusicBrainz 403s without (61.3.9).
    if (all.includes('scFetchWdUpcoming')) {
      const out = theirs.slice();
      const mbCall = out.find((l) => l.includes('return fetchWithProxy(url, SC_RELEASE_FETCH).then(function(rs){'));
      if (!mbCall) throw new Error('block 9: the MusicBrainz pass call is missing');
      out[out.indexOf(mbCall)] = mbCall.replace('SC_RELEASE_FETCH', 'SC_MB_FETCH');
      return out;
    }

    throw new Error('unhandled conflict block: ' + all.slice(0, 120));
  };

  for (let i = blocks.length - 1; i >= 0; i--) {
    const b = blocks[i];
    const replacement = resolve(b);
    lines.splice(b.start, b.end - b.start + 1, ...replacement);
  }
  src = lines.join('\n');
  if (src.includes('<<<<<<< HEAD') || src.includes('>>>>>>> origin/main')) {
    throw new Error('conflict markers survived the merge');
  }

  // ---- MusicBrainz needs an identifying User-Agent ---------------------------
  {
    const needle = '  var SC_RELEASE_FETCH = { noCancel: true, budgetMs: 4000 };\n';
    expectOne(src, needle, 'SC_RELEASE_FETCH');
    src = src.replace(needle, needle +
      '  // MusicBrainz 403s requests that do not say who is asking, and a page fetch\n' +
      '  // cannot set a User-Agent — only the native attempt in fetchWithProxy can, so\n' +
      '  // hand it one. A browser keeps its own UA, which MusicBrainz also accepts.\n' +
      "  var SC_MB_FETCH = Object.assign({}, SC_RELEASE_FETCH, { headers: { 'User-Agent': 'SideCut/' + (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') + ' (https://anekthegreat.github.io/SideCut/)' } });\n");
  }

  fs.writeFileSync(FILE, src);
} else {
  console.log('no conflict markers — index.html already resolved');
}

// ---- report -----------------------------------------------------------------
const out = fs.readFileSync(FILE, 'utf8');
const checks = [
  ["const APP_VERSION = '61.5'", 1],
  ['var SC_MB_FETCH = Object.assign', 1],
  ['async function fetchWithProxy(url, init){', 1],
  ['scFetchWdUpcoming', 2],
  ['scLyricsStrangers', 6],
  ['__scNativeFetch', 4],
  ['textyl (Apple Music)', 0],
  ['version: \'61.5\'', 1],
  ['scFetchSpotifyUpcoming', 0]
];
let bad = 0;
for (const [needle, want] of checks) {
  const got = out.split(needle).length - 1;
  const ok = got === want;
  if (!ok) bad++;
  console.log((ok ? '  ok   ' : '  FAIL ') + needle + ' = ' + got + ' (want ' + want + ')');
}
if (bad) throw new Error(bad + ' post-merge checks failed');
console.log('index.html merged');
