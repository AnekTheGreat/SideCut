#!/usr/bin/env node
// v61.5 — finish the merge of origin/main (the v61.4 line) into the local line.
//
// The merge itself left three real defects in index.html, each caught by
// `dev/merge-audit.mjs` (which compares the merged file against BOTH parents
// and reports every line one side added that the merge then lost):
//   [1] `__scNativeFetch` — the native-first transport the whole local line
//       was built on — was gone, so fetchWithProxy still CALLED it and the
//       ReferenceError was swallowed by its own try/catch: every device
//       silently fell back to page fetch + relays, which is exactly the
//       "converters stopped working" symptom.
//   [2] fetchArtistReleases kept a stray `}` from the Apple-guard splice, so
//       the outer try closed early and the script did not parse at all.
//   [3] the changelog never got its 61.5 head entry: APP_VERSION said 61.5
//       while the newest entry was 61.4 (test-6053/54/55/56/57 all assert
//       entries[0].version === ver).
// AGENTS.md still carried the raw conflict markers too.
//
// Idempotent: every edit asserts count === 1 OR "already applied", so a re-run
// is a no-op. Run from the repository root:  node dev/patch-615.mjs
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

// ---- `--manifest`: re-seed the root manifest.json only --------------------
// Same rule patch-6139/614 used: the notes come from the 61.5 changelog head
// (with any [FULL] marker stripped, first 6), the size is whatever the OTA
// bundle that was just built actually is.
if (process.argv.includes('--manifest')) {
  const updPath = path.join(ROOT, 'ota', 'updates.json');
  if (!fs.existsSync(updPath)) throw new Error('ota/updates.json missing — run dev/ota-bundle.mjs first');
  const upd = JSON.parse(fs.readFileSync(updPath, 'utf8'));
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const ver = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  const block = html.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  const entries = block ? eval('[' + block[1] + ']') : [];
  const head = entries.find((e) => String(e.version) === String(ver));
  if (!head) throw new Error('no ' + ver + ' changelog entry found');
  const notes = (head.items || [])
    .map((it) => (typeof it === 'string' && it.indexOf('[FULL] ') === 0) ? it.slice(7) : it)
    .slice(0, 6);
  const man = { version: ver, url: 'update.zip', size: upd.size, notes, date: String(head.date || '') };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log('root manifest.json → ' + ver + ' · ' + upd.size + ' bytes · ' + notes.length + ' notes');
  process.exit(0);
}

let fails = 0;
const note = (label, ok, detail) => {
  console.log((ok ? '  ok    ' : '  FAIL  ') + label + (detail ? ' — ' + detail : ''));
  if (!ok) fails++;
};

// Replace `old` with `new` exactly once. `done` is the caller's
// already-applied test — it MUST be true after the edit, otherwise a re-run
// matches the anchor again and duplicates the insertion (cost this session:
// the native block and the 61.5 entry each got written twice before the
// guards below existed).
function sub(src, old, neu, label, done) {
  if (done) { console.log('  skip  ' + label + ' (already applied)'); return src; }
  const n = src.split(old).length - 1;
  if (n === 1) { console.log('  ok    ' + label); return src.replace(old, neu); }
  note(label, false, 'expected 1 occurrence, got ' + n);
  return src;
}

// A duplicated insertion shows up as the same block written twice back to
// back: drop everything from the SECOND `startMarker` up to `endMarker`.
function dropSecond(src, startMarker, endMarker, label) {
  const s1 = src.indexOf(startMarker);
  const s2 = s1 === -1 ? -1 : src.indexOf(startMarker, s1 + 1);
  if (s2 === -1) return src;
  const e2 = src.indexOf(endMarker, s2);
  if (e2 === -1) { note(label, false, 'duplicate found but no end marker'); return src; }
  console.log('  ok    ' + label + ' — removed the duplicated block');
  return src.slice(0, s2) + src.slice(e2);
}

// ---------------------------------------------------------------------------
// 1. index.html
// ---------------------------------------------------------------------------
{
  let src = fs.readFileSync('index.html', 'utf8');

  // Repair a double-run first (see sub()), then the real edits.
  src = dropSecond(src, "  { version: '61.5',", "  { version: '61.4',", 'the 61.5 changelog entry');
  src = dropSecond(src, '  // ─── Native-first fetch (CORS-free on the device)', '  // CORS helper — native first on the device', 'the __scNativeFetch block');

  // [2] the stray close-brace left by the Apple-guard splice
  src = sub(
    src,
    '      }catch(_ae){}\n      }\n      // ---- Dated drops with nothing to connect',
    '      }catch(_ae){}\n      // ---- Dated drops with nothing to connect',
    'fetchArtistReleases: the stray `}` that closed the outer try is gone',
    !src.includes('      }catch(_ae){}\n      }\n      // ---- Dated drops with nothing to connect')
  );

  // [1] the native-first transport
  const NATIVE = [
    '  // ─── Native-first fetch (CORS-free on the device) ─────────────────────────',
    "  // A page fetch inside the WebView is still bound by CORS: Spotify's embed",
    '  // pages send no access-control-allow-origin, and every public CORS relay',
    '  // that used to catch that has either gone behind an API key (corsproxy.io',
    '  // answers 401 now) or stopped answering for days — which is how the',
    "  // Spotify converter's metadata legs and the album/playlist track lists died",
    '  // while the same URLs fetched fine everywhere else. On the device the',
    "  // Capacitor HTTP plugin runs the request on Android's own network stack,",
    '  // where CORS does not apply and a real User-Agent can be set (MusicBrainz',
    '  // 403s requests that do not identify themselves). Returns a Response-shaped',
    '  // object, or null when there is no native plugin — the browser path below.',
    '  async function __scNativeFetch(url, opts){',
    '    try{',
    '      var cap = window.Capacitor;',
    '      var http = (cap && cap.isNativePlatform && cap.isNativePlatform() && cap.Plugins) ? cap.Plugins.CapacitorHttp : null;',
    "      if(!http || typeof http.request !== 'function') return null;",
    '      opts = opts || {};',
    "      var o = { url: url, method: opts.method || 'GET', responseType: 'arraybuffer', readTimeout: 8000, connectTimeout: 8000 };",
    '      if(opts.headers) o.headers = opts.headers;',
    '      if(opts.body != null) o.data = opts.body;',
    '      var nr = await http.request(o);',
    "      if(!nr || nr.status < 200 || nr.status >= 300 || nr.data == null || nr.data === '') return null;",
    '      var parsed = null, b64 = null, rawBuf = null;',
    "      if(typeof ArrayBuffer !== 'undefined' && nr.data instanceof ArrayBuffer) rawBuf = nr.data;",
    "      else if(typeof nr.data === 'string') b64 = nr.data;",
    '      else parsed = nr.data;   // a JSON Content-Type: the plugin hands back the parsed body',
    '      var bytes = null, text = null;',
    '      function asBytes(){',
    '        if(bytes) return bytes;',
    '        if(rawBuf){ bytes = new Uint8Array(rawBuf); return bytes; }',
    '        if(parsed !== null){ bytes = new TextEncoder().encode(JSON.stringify(parsed)); return bytes; }',
    '        // With responseType \'arraybuffer\' a successful non-JSON body arrives as',
    '        // raw base64; if it does not decode it was text after all.',
    '        try{',
    '          var bin = atob(b64);',
    '          bytes = new Uint8Array(bin.length);',
    '          for(var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);',
    '        }catch(_be){ text = b64; bytes = new TextEncoder().encode(b64); }',
    '        return bytes;',
    '      }',
    '      function asText(){',
    '        if(parsed !== null) return JSON.stringify(parsed);',
    '        if(text !== null) return text;',
    "        try{ text = new TextDecoder('utf-8').decode(asBytes()); }catch(_te){ text = String(b64 || ''); }",
    '        return text;',
    '      }',
    '      return {',
    '        ok: true, status: nr.status,',
    '        json: async function(){ if(parsed !== null) return parsed; return JSON.parse(asText()); },',
    '        text: async function(){ return asText(); },',
    '        blob: async function(){ return new Blob([asBytes()]); },',
    '        arrayBuffer: async function(){ var b = asBytes(); return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength); }',
    '      };',
    "    }catch(_e){ return null; }",
    '  }',
    '',
    '  // CORS helper — native first on the device, then the direct fetch, then a'
  ].join('\n');
  src = sub(
    src,
    '  // CORS helper — native first on the device, then the direct fetch, then a',
    NATIVE,
    '__scNativeFetch restored in front of fetchWithProxy',
    src.includes('async function __scNativeFetch(url, opts){')
  );

  // [3] the 61.5 head entry: the local line's two releases, folded into one.
  // textyl is gone in the merge (61.4 removed it — its reply carries no title),
  // so its clock note is reworded to what still stands, and the Apple-outage
  // note names the sources that actually survive the merge.
  const q = (s) => "'" + s.replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
  const SHIP_DATE = 'September 25, 2026 · 5:00 AM EDT';
  const TITLE = 'Links resolve, every song comes out as its own song, and your lyrics stay yours';
  const ITEMS = [
    'Two songs of the same album that run to almost the same length could come back as the SAME file, or as each other: the clock cannot tell them apart, so the upload that ranked first was accepted for whichever song was being saved at that moment. During one run an upload now belongs to one song only, an upload whose own title answers to another track of that run belongs to that track, and a source whose title matches exactly is tried before anything the clock merely approves — each song comes out as its own song',
    'Spotify link lookups stopped resolving: they leaned on free public CORS relay services, corsproxy.io started demanding an API key and the others went quiet for days — so track details, artists, covers and album/playlist track lists came back empty. On the phone those pages are now read straight through the device’s own network path, which needs no relay at all; a browser keeps live relays as its fallback and the dead one has been replaced.',
    'The video title lookup inside the app always failed: youtube.com/oembed sends no cross-origin permission, so a WebView could never ask for it. It now runs through the same device network path, so the saved file gets its real title and channel instead of the fallback name.',
    'One cancelled album fetch could silence everything that looks things up: the Album History cancel flag stayed latched and every shared lookup answered with nothing for the rest of the session — upcoming drops, cover art and the link lookups’ fallbacks included. The flag now only counts while an album fetch is actually running.',
    'MusicBrainz refuses requests that do not say who is asking, and the drop check was sending nothing to identify itself — it now carries an identifying User-Agent through the native network path.',
    'An Apple outage no longer ends the drop check: the iTunes pass still finds new singles and albums first, but when it fails, MusicBrainz and the Wikidata pass run anyway instead of the whole check returning empty.',
    'Requests that need a body were being sent without one: the shared lookup dropped the method, headers and body a caller passed in, so the AI lyrics and metadata requests went out as plain GETs and could never answer. What a caller asks for now rides all the way through.',
    'For a small or regional artist the lyrics came back as somebody else’s song: a title search turns up same-titled tracks by entirely different artists, and any of them that happened to run within a couple of seconds of your file was accepted on its length alone and saved onto the track. A length is not an identity any more — the title has to be the exact one and the credit must not contradict yours, so Bikramjit Dhaliwal’s songs keep his words instead of borrowing Karan Aujla’s.',
    '"No lyrics found" now explains itself: it names how many same-titled songs under a different artist were skipped, and the Manual button is reachable from there, so you can paste the words in yourself and they save with the song.',
    'The Refetch picker marks a same-titled entry credited to a different artist, so choosing one by hand is a decision instead of a guess.',
    'A reply that was never checked against the song you asked for is no longer believed: the lyrist response is matched against the title and the artist that were asked for instead of being taken on trust.',
    'A credit that is really an imprint (T-Series, Saregama Music, Speed Records) neither confirms nor contradicts an artist, so an odd tag still can’t hide a song that is genuinely yours.'
  ];
  const ENTRY =
    "  { version: '61.5', date: " + q(SHIP_DATE) + ', title: ' + q(TITLE) + ', items: [\n' +
    ITEMS.map((i) => '    ' + q(i) + ',').join('\n') +
    '\n  ] },\n';
  const ANCHOR = "  { version: '61.4', date: 'September 24, 2026 · 8:48 PM EDT',";
  src = sub(src, ANCHOR, ENTRY + ANCHOR, 'the 61.5 changelog head entry is in front of 61.4', src.includes("  { version: '61.5',"));

  // ---- assertions ----------------------------------------------------------
  const count = (n) => src.split(n).length - 1;
  note('APP_VERSION = 61.5', count("const APP_VERSION = '61.5';") === 1, count("const APP_VERSION = '61.5';") + '×');
  note('no conflict markers survive', !src.includes('<<<<<<< HEAD') && !src.includes('>>>>>>> origin/main'));
  note('__scNativeFetch: definition + 3 call sites', count('__scNativeFetch') === 4, count('__scNativeFetch') + '×');
  note('fetchWithProxy(url, init) forwards the caller body', count('async function fetchWithProxy(url, init){') === 1);
  note('the MusicBrainz pass rides the identifying User-Agent', count('fetchWithProxy(url, SC_MB_FETCH)') === 1);
  note('one 61.5 changelog entry', count("version: '61.5'") === 1, count("version: '61.5'") + '×');
  note('no silent-Spotify pass resurfaces', count('scFetchSpotifyUpcoming') === 0);
  note('Wikidata pass kept', count('scFetchWdUpcoming') === 2);

  // every inline script block still parses
  const re = /<script(?![^>]*src=)[^>]*>([\s\S]*?)<\/script>/g;
  let m; let blocks = 0; let bad = 0;
  while ((m = re.exec(src))) {
    blocks++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('       block ' + blocks + ': ' + e.message); }
  }
  note(blocks + ' inline script block(s) parse', bad === 0);

  if (src.includes('<<<<<<< HEAD')) note('index.html', false, 'conflict markers present');
  fs.writeFileSync('index.html', src);
}

// ---------------------------------------------------------------------------
// 2. sw.js — the cache name must match the version the OTA manifests carry
// ---------------------------------------------------------------------------
{
  const sw = fs.readFileSync('sw.js', 'utf8');
  note("sw.js cache = sidecut-shell-v61.5", sw.includes("const CACHE_NAME = 'sidecut-shell-v61.5';"));
}

// ---------------------------------------------------------------------------
// 3. AGENTS.md — drop the markers, keep BOTH histories, and say why
// ---------------------------------------------------------------------------
{
  let doc = fs.readFileSync('AGENTS.md', 'utf8');
  const start = doc.indexOf('<<<<<<< HEAD\n');
  if (start !== -1) {
    const mid = doc.indexOf('\n=======\n', start);
    const end = doc.indexOf('\n>>>>>>> origin/main\n', mid);
    if (mid === -1 || end === -1) { note('AGENTS.md conflict block', false, 'unterminated'); }
    else {
      const ours = doc.slice(doc.indexOf('\n', start) + 1, mid + 1);
      const theirs = doc.slice(mid + '\n=======\n'.length, end + 1);
      // Both lines shipped releases numbered 61.3.8 / 61.3.9 for DIFFERENT
      // work, so the four sections are kept verbatim and the newest first:
      // local (Sep 25 2:39 AM), local 61.3.8, origin 61.3.9, origin 61.3.8.
      const cut = theirs.indexOf('\n## v61.3.9 (Sep 24, 2026): the drop check finishes');
      const t38 = cut === -1 ? theirs : theirs.slice(0, cut + 1);
      const t39 = cut === -1 ? '' : theirs.slice(cut + 1);
      const resolved = ours.replace(/\n+$/, '\n\n') + t39 + t38;
      doc = doc.slice(0, start) + resolved + doc.slice(end + '\n>>>>>>> origin/main\n'.length);
      console.log('  ok    AGENTS.md conflict markers resolved (both histories kept)');
    }
  } else {
    console.log('  skip  AGENTS.md conflict markers (already resolved)');
  }

  const SECTION = [
    '## v61.5 (Sep 25, 2026): two release lines that both called themselves 61.3.8/61.3.9 became one',
    '- **What happened**: `origin/main` and the local line had each been shipping under the SAME version numbers',
    '  for DIFFERENT work — local `61.3.8` was the lyrics-identity fix while origin `61.3.8` was the dated-drops',
    '  fix, and both had a `61.3.9`. Merging origin/main (v61.4) in needed one number nobody had used: **61.5**.',
    '  Local\'s two releases are folded into a single 61.5 changelog entry (their notes, in order); origin\'s',
    '  history (61.4, 61.3.9, 61.3.8 …) is kept exactly as published, and all four original AGENTS sections stay',
    '  below verbatim — read them as "local line" and "origin line", not as one timeline.',
    '- **The merge broke index.html in three ways, and `dev/merge-audit.mjs` is what caught them**: run it after',
    '  ANY merge — it reads `git show :1/:2/:3:<file>` for both parents, diffs each against the merge base, and',
    '  prints every line that side added which the merged file then lost. It found (1) the whole',
    '  `__scNativeFetch` definition dropped, so `fetchWithProxy` still called it and the ReferenceError was',
    '  swallowed by its own try/catch — every phone silently fell back to page fetch + CORS relays, i.e. the',
    '  exact "converters stopped working" symptom; (2) a stray `}` left by the Apple-guard splice, which closed',
    '  the outer try of `fetchArtistReleases` early and stopped the ENTIRE main script from parsing (a blank app,',
    '  not a subtle bug — check `new Function` on every inline block BEFORE trusting a merge); (3) no 61.5',
    '  changelog head entry, so `APP_VERSION` and `entries[0].version` disagreed.',
    '- **Rule for the next merge**: resolving a conflict is not finishing it. The audit script + the full',
    '  `dev/test-*.mjs` suite are the finish line, and the file tools silently cannot reach into `index.html`',
    '  (2.3 MB) — they only match near the head of a file, so every index.html edit still goes through a',
    '  `dev/patch-*.mjs` script like this one.',
    ''
  ].join('\n');
  if (doc.includes('## v61.5 (Sep 25, 2026):')) console.log('  skip  AGENTS.md v61.5 section (already there)');
  else if (doc.startsWith('# SideCut — repository memory\n\n')) {
    doc = '# SideCut — repository memory\n\n' + SECTION + doc.slice('# SideCut — repository memory\n\n'.length);
    console.log('  ok    AGENTS.md: the v61.5 section is at the top');
  } else note('AGENTS.md title line', false, 'unexpected head');

  note('AGENTS.md has no markers left', !doc.includes('<<<<<<< HEAD') && !doc.includes('>>>>>>> origin/main'));
  fs.writeFileSync('AGENTS.md', doc);
}

console.log(fails ? '\n' + fails + ' FAILURE(S)' : '\npatch-615: all good');
process.exit(fails ? 1 : 0);
