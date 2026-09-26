#!/usr/bin/env node
// SideCut — "why does it take up 4.53 gb".
//
// Three things were making the app's storage bigger than the music in it, and
// none of them was visible from inside the app:
//
//   1. THE EXPORT LEAK. The backup export streams the whole library as a zip
//      into the app's OWN cache directory (that is how it reaches the share
//      sheet) and NOTHING ever removed it: only the failure path deleted it.
//      Exporting a 4 GB library left 4 GB sitting in the app for good. It is
//      now removed shortly after the share sheet has it, and "Free up space"
//      sweeps whatever older builds left behind.
//
//   2. THE SHADOWED BYTES FORMATTER. A second scFmtBytes() lower in the script
//      returned a bare number. Function declarations hoist, so the LAST one
//      wins: the Storage panel printed "13.8" instead of "13.8 MB".
//
//   3. NO VISIBILITY. There was nowhere in the app that said what the storage
//      was made of, so "4.53 GB" had no explanation attached to it. Settings →
//      More now has a Storage panel with the breakdown, a Recalculate button
//      and a Free up space button (which removes only what SideCut can rebuild:
//      old rollback copies, the cached popups, leftover export files).
//
// This is a fix to the 63.0.8 work in the tree, not a new version: APP_VERSION,
// sw.js's cache name, the changelog DATE and the test repins all stay where
// patch-642 put them. Only the head entry's TEXT changes (it now describes the
// storage work too), still exactly six items.
//
//   node dev/patch-644.mjs
//   node dev/patch-644.mjs --manifest    # re-seed root manifest.json from ota/updates.json
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

const VER = '63.0.8';
const STAMP = 'September 26, 2026 · 2:12 PM EDT';

const OLD_ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'SideCut now times its own startup — and the two things that were still being done at launch for no reason', items: [
    'SideCut now measures its own startup and shows you where the time goes. Open the bell (\\ud83d\\udd14) and the first thing in it is “Startup — 1.9s”, your own number from your own phone; tap it and every step is listed: how long the app’s own code takes to load, then the notification state, your settings, the library read, and the moment Home is on screen. It is timed on every launch and the last one is kept. The last two rounds of speed work could only go so far because the numbers came from a faster machine than yours; this is the app reporting on itself, and the next fix will start from that list.',
    'The song list is no longer built while the app is starting up. It is by far the heaviest thing SideCut assembles — a row and a cover for every song — and it was being built for a screen you were not even looking at, because SideCut always opens on Home. Open Library and it is built right then, exactly as fast as before; it is simply no longer part of how long startup takes. (63.0.7 moved that build off the first paint; this removes it from startup altogether.)',
    'SideCut no longer analyses the song you last had open while it is starting. Auto volume works by measuring how loud a song is, which means reading and decoding the whole file, and that was happening to the restored song during startup — for a track that is restored paused and might never be played. A song you actually play still gets measured and remembered exactly as before; only the pointless one at launch is gone.',
    'The small dot on the bell is worked out a moment after Home is on screen instead of in the same instant. That check walks your whole library looking for duplicates, and nothing on the screen you are looking at depends on it, so it no longer competes with the app appearing.',
    'Everything 63.0.7 fixed stays fixed: your settings are read without dragging every old version’s saved page through the read (about 174 MB per launch on a phone with a dozen updates behind it, now a few kilobytes), the recovery file is only opened when something really is missing, and the two pieces that load from the network no longer sit in front of the app and hold up its start.',
    'If a step is still slow, that breakdown in the bell names it — which step, and how many milliseconds. Send that list over and the next round of work starts from your phone’s real numbers rather than from mine. Nothing about your music, playlists, covers or saved versions changes in this release.',
  ] },
`;

const ENTRY = `  { version: '${VER}', date: '${STAMP}', title: 'SideCut can now tell you what your storage is being used for — and give most of it back', items: [
    'Settings → More now opens a Storage panel that says what SideCut is using your device for: how much its own copy of your music takes, how much the covers take, how many old versions of the app it has saved, and — when the phone reports it — how much the whole app counts for. Beside it, Free up space removes only the things SideCut can build again: the saved pages from old versions, the cached song lists, and any backup files it left behind in its own folder. Your music, playlists, covers and settings are never touched.',
    'A backup was leaving a complete second copy of your library inside the app, in its own private folder, and never clearing it up — only a failed one was deleted. On a big library that alone was gigabytes, counted against SideCut by the phone and invisible inside the app. It is now removed just after the share sheet has it, and the Storage panel sweeps anything left from before.',
    'SideCut also stopped re-saving whole songs to change one number. Play counts, the last-played stamp, the loudness measured for auto volume and the lyric-check marks are what SideCut learns as you listen, and each one was writing the entire song back to storage — megabytes, every play. They now live in one small row that is written once and quietly, so listening cannot make the app grow. Alongside it, the app keeps only the newest few saved pages of its own code instead of one for every version it has ever run.',
    'SideCut now measures its own startup and shows you where the time goes. Open the bell (\\ud83d\\udd14) and the first thing in it is “Startup — 1.9s”, your own number from your own phone; tap it and every step is listed: how long the app’s own code takes to load, then the notification state, your settings, the library read, and the moment Home is on screen. It is timed on every launch and the last one is kept.',
    'The song list is no longer built while the app is starting up, and the song you last had open is no longer analysed at launch. Both were work being done for a screen you were not looking at: Library builds its list the moment you open it, exactly as fast as before, and auto volume still measures every song you actually play. 63.0.7 had already cut the settings read from about 174 MB on a phone with a dozen updates behind it to a few kilobytes.',
    'If a step is still slow, that breakdown in the bell names it — which step, and how many milliseconds. Send that list over and the next round of work starts from your phone’s real numbers rather than from mine. Nothing about your music, playlists, covers or saved versions changes in this release.',
  ] },
`;

let src = MANIFEST_ONLY ? '' : fs.readFileSync(FILE, 'utf8');
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

// The changelog head, self-healing: replaced outright when the text differs, so
// a rerun after a wording fix corrects it instead of leaving a stale one in
// place. Keeps the version and the date — test-6052 pins the date.
function headEntry(){
  const entryMark = "  { version: '" + VER + "',";
  const endMark = '\n  ] },\n';
  const at = src.indexOf(entryMark);
  if(at === -1) throw new Error('CHANGELOG: no ' + VER + ' entry to replace');
  const end = src.indexOf(endMark, at);
  if(end === -1) throw new Error('CHANGELOG: no end for the ' + VER + ' entry');
  const existing = src.slice(at, end + endMark.length);
  if(existing === ENTRY) return skip('CHANGELOG head entry');
  src = src.slice(0, at) + ENTRY + src.slice(end + endMark.length);
  done('CHANGELOG head entry (storage notes)');
}

if (!MANIFEST_ONLY) {
// ── 1. The shadowed bytes formatter ──────────────────────────────────────────
// Two definitions in one scope: the later one always wins, so the Storage panel
// (which wants "13.8 MB") was rendered by the older bare-number one. Removed,
// not renamed — nothing else called it.
sub('scFmtBytes duplicate',
  `  function scFmtBytes(n){
    return (n / (1024 * 1024)).toFixed(1);
  }
`,
  `  // (The bytes formatter lives with the Storage panel near scFmtBytes above.
  // A second definition used to sit here returning a bare number, and because
  // function declarations hoist the LATER one wins: the panel printed "13.8"
  // instead of "13.8 MB". Deleted — nothing else ever called it.)
`,
  1, 'A second definition used to sit here');

// ── 2. The export zip left in the app's own cache ────────────────────────────
// streamZipToCapacitor() writes the whole zip into CACHE so the share sheet can
// have a URI for it, then shares it in the background — and only the FAILURE
// path ever deleted the file. On success it stayed for ever: on a phone with a
// big library the app's storage was nearly twice the music.
sub('export cache cleanup',
  `              }catch(_bgErr){ console.log('Background share failed (file is still in cache):', _bgErr); }
            }).catch(function(){ resolve(true); });`,
  `              }catch(_bgErr){ console.log('Background share failed (file is still in cache):', _bgErr); }
              // The zip is a COMPLETE second copy of the library, sitting in the
              // app's own cache directory. It used to be left there for good:
              // sharing a 4 GB library left 4 GB behind, counted against the app
              // by the phone and invisible from inside it. The share sheet is
              // handed a URI, so a short grace period is all it needs — then the
              // cache copy goes. Anything older builds left behind is swept by
              // Settings → More → Storage → Free up space.
              try{
                setTimeout(function(){
                  try{ FS.deleteFile({ path: filename, directory: 'CACHE' }).catch(function(){}); }catch(_e){ }
                }, 90 * 1000);
              }catch(_e){ }
            }).catch(function(){ resolve(true); });`,
  1, 'a short grace period is all it needs');

// ── 3. What SideCut left in its own cache, and how to get it back ────────────
sub('own-cache helpers',
  `  async function scFreeUpSpace(){`,
  `  // ─── What SideCut itself left in its own cache directory ───────────────────
  // The backup export streams the whole library as a zip in here (that is how it
  // reaches the share sheet). Only files this app wrote are ever touched, and
  // they are matched by name, so nothing the user saved can be caught by it.
  var SC_OWN_CACHE_RE = /^sidecut-(songs|library)\\.zip$/i;
  function scCapFs(){
    try{ return (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) || null; }catch(_e){ return null; }
  }
  function scCacheEntryName(entry){
    var raw = (entry && typeof entry === 'object' && entry.name) ? String(entry.name) : String(entry || '');
    var name = raw.split('?')[0].split('/').pop();
    try{ name = decodeURIComponent(name); }catch(_e){ }
    return name;
  }
  async function scOwnCacheFiles(){
    var FS = scCapFs();
    if(!FS || typeof FS.readdir !== 'function') return [];
    var list = null;
    try{ list = await FS.readdir({ path: '', directory: 'CACHE' }); }catch(_e){ return []; }
    var files = (list && list.files) || [];
    var out = [];
    for(var i = 0; i < files.length; i++){
      var name = scCacheEntryName(files[i]);
      if(name && SC_OWN_CACHE_RE.test(name)) out.push(name);
    }
    return out;
  }
  async function scOwnCacheUsage(){
    var out = { files: 0, bytes: 0 };
    try{
      var FS = scCapFs();
      var names = await scOwnCacheFiles();
      for(var i = 0; i < names.length; i++){
        var size = 0;
        try{ var st = (FS && typeof FS.stat === 'function') ? await FS.stat({ path: names[i], directory: 'CACHE' }) : null; size = (st && st.size) || 0; }catch(_e){ }
        out.files++; out.bytes += size;
      }
    }catch(_e){ }
    return out;
  }
  async function scCleanOwnCache(){
    var out = { files: 0, bytes: 0 };
    try{
      var FS = scCapFs();
      if(!FS || typeof FS.deleteFile !== 'function') return out;
      var names = await scOwnCacheFiles();
      for(var i = 0; i < names.length; i++){
        var size = 0, age = null;
        try{ var st = await FS.stat({ path: names[i], directory: 'CACHE' }); size = (st && st.size) || 0; age = (st && st.mtime) || null; }catch(_e){ }
        // Never pull a file out from under a share sheet that is still up.
        if(age && (Date.now() - age) < 180000) continue;
        try{ await FS.deleteFile({ path: names[i], directory: 'CACHE' }); out.files++; out.bytes += size; }catch(_e){ }
      }
    }catch(_e){ }
    return out;
  }
  window.__scOwnCacheUsage = scOwnCacheUsage;
  window.__scCleanOwnCache = scCleanOwnCache;

  async function scFreeUpSpace(){`,
  1, 'What SideCut itself left in its own cache directory');

// ── 4. The panel reports it ──────────────────────────────────────────────────
sub('panel: own-cache row',
  `    var dupGroups = (typeof getDuplicateGroups === 'function') ? getDuplicateGroups() : [];
    var estimate = null;`,
  `    // Leftovers in the app's own cache directory do not show up in any of the
    // numbers above — that is exactly why a phone could report gigabytes while
    // the app could not explain them.
    var ownCache = { files: 0, bytes: 0 };
    try{ ownCache = await scOwnCacheUsage(); }catch(_e){ }
    var dupGroups = (typeof getDuplicateGroups === 'function') ? getDuplicateGroups() : [];
    var estimate = null;`,
  1, 'that is exactly why a phone could report gigabytes');

sub('panel: own-cache line',
  `    rows.push(['Saved settings & caches', scFmtBytes(scLocalStorageBytes())]);`,
  `    rows.push(['Saved settings & caches', scFmtBytes(scLocalStorageBytes())]);
    if(ownCache.files) rows.push(['Backup files left in the app\\u2019s cache', ownCache.files + ' \\u00b7 ' + scFmtBytes(ownCache.bytes)]);`,
  1, "Backup files left in the app");

// ── 5. Free up space actually frees it ───────────────────────────────────────
sub('free up: sweep the cache',
  `      var freed = Math.max(0, before - after);
      var msg = 'Freed ' + scFmtBytes(freed) + ' from ' + removed + ' old rollback cop' + (removed === 1 ? 'y' : 'ies') + (cleared ? ' and cleared ' + cleared + ' saved list' + (cleared === 1 ? '' : 's') : '') + '.';`,
  `      var own = { files: 0, bytes: 0 };
      try{ own = await scCleanOwnCache(); }catch(_e){ }
      var freed = Math.max(0, before - after) + (own.bytes || 0);
      var msg = 'Freed ' + scFmtBytes(freed) + ' from ' + removed + ' old rollback cop' + (removed === 1 ? 'y' : 'ies') + (cleared ? ' and cleared ' + cleared + ' saved list' + (cleared === 1 ? '' : 's') : '') + (own.files ? ' and removed ' + own.files + ' leftover backup file' + (own.files === 1 ? '' : 's') : '') + '.';`,
  1, "leftover backup file");
}

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-644 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
} else {
  headEntry();
  fs.writeFileSync(FILE, src);
  console.log('patch-644: ' + edits + ' index.html edit(s)');
}
