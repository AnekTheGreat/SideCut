// One-off patch: renumber everything after 60.0.1 behind the second decimal.
//
//   60.1   → 60.0.2
//   60.2   → 60.0.3
//   60.3   → 60.0.4
//   60.4   → 60.0.5
//   60.4.1 → 60.0.6   (the build this patch ships)
//
// The updater never installs a downgrade and compares versions NUMERICALLY, so a
// phone, snapshot or staged bundle still carrying an old label (60.1 … 60.4.1)
// would read as newer than 60.0.6 and refuse the renumbered build. Both
// compareVersions() implementations therefore normalize those legacy labels to
// the release they became. Same atomic-replace + count-assert discipline as the
// other dev/_patch_*.py passes, because the file editor cannot match index.html.
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HTML = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const NATIVE = path.join(ROOT, 'dev/native-updates.js');

function patch(file, edits) {
  let s = fs.readFileSync(file, 'utf8');
  for (const [label, from, to, expect] of edits) {
    const n = s.split(from).length - 1;
    if (n !== expect) {
      console.error(`MISMATCH [${path.basename(file)}] ${label}: found ${n}, expected ${expect}`);
      console.error('--- looked for ---\n' + from.slice(0, 200));
      process.exit(1);
    }
    s = s.split(from).join(to);
    console.log(`  ok ${path.basename(file)} · ${label} (${n})`);
  }
  fs.writeFileSync(file, s);
}

const r = String.raw;
const MAP = `  const LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6' };
  function normVersion(v){
    const s = String(v == null ? '' : v);
    return LEGACY_VERSIONS[s] || s;
  }
`;
const MAP_VAR = `  var LEGACY_VERSIONS = { '60.1':'60.0.2', '60.2':'60.0.3', '60.3':'60.0.4', '60.4':'60.0.5', '60.4.1':'60.0.6' };
  function normVersion(v){
    var s = (v === null || v === undefined) ? '' : String(v);
    return LEGACY_VERSIONS[s] || s;
  }
`;

/* ── index.html ───────────────────────────────────────────────────────────── */
patch(HTML, [
  ['APP_VERSION', `const APP_VERSION = '60.4.1';`, `const APP_VERSION = '60.0.6';`, 1],

  // The changelog history, newest first. Longest label first so the 60.4 anchor
  // never swallows the 60.4.1 entry.
  ['changelog 60.4.1', `  { version: '60.4.1', date: '`, `  { version: '60.0.6', date: '`, 1],
  ['changelog 60.4', `  { version: '60.4', date: '`, `  { version: '60.0.5', date: '`, 1],
  ['changelog 60.3', `  { version: '60.3', date: '`, `  { version: '60.0.4', date: '`, 1],
  ['changelog 60.2', `  { version: '60.2', date: '`, `  { version: '60.0.3', date: '`, 1],
  ['changelog 60.1', `  { version: '60.1', date: '`, `  { version: '60.0.2', date: '`, 1],

  // Say it in the notes, where the user reads versions.
  [
    'notes: the renumbering',
    r`    'Desktop and non-Android browsers still get a normal new tab on open.spotify.com, which is where that tap belongs',`,
    r`    'Desktop and non-Android browsers still get a normal new tab on open.spotify.com, which is where that tap belongs',
    'Version numbers go behind the second decimal again. Everything after 60.0.1 is numbered 60.0.2 through 60.0.6 in the patch notes, and SideCut reads the old labels (60.1 \u2013 60.4.1) as the release they became \u2014 so a phone, a saved snapshot or a staged bundle still carrying an old number can never look newer than the renumbered build',`,
    1
  ],

  // compareVersions in the page (the rollback picker, the browser update check).
  [
    'compareVersions (page)',
    `  // compareVersions(a, b) → 1 if a>b, -1 if a<b, 0 if equal. Treats dotted
  // numbers numerically (so 42.10 > 42.8), used by the rollback picker.
  function compareVersions(a, b){
    const pa = String(a).split('.'), pb = String(b).split('.');
    const len = Math.max(pa.length, pb.length);
    for(let i=0;i<len;i++){
      const na = parseInt(pa[i] || '0', 10), nb = parseInt(pb[i] || '0', 10);
      if(na !== nb) return na > nb ? 1 : -1;
    }
    return 0;
  }`,
    `  // compareVersions(a, b) → 1 if a>b, -1 if a<b, 0 if equal. Treats dotted
  // numbers numerically (so 42.10 > 42.8), used by the rollback picker.
  //
  // The releases after 60.0.1 were renumbered behind the second decimal
  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A device can still carry an old label —
  // its own running version, a stored snapshot, a staged bundle — so every
  // comparison normalizes first: read as-is, "60.4" would look NEWER than 60.0.6
  // and the updater (which never installs a downgrade) would refuse the
  // renumbered build.
${MAP}  function compareVersions(a, b){
    const pa = normVersion(a).split('.'), pb = normVersion(b).split('.');
    const len = Math.max(pa.length, pb.length);
    for(let i=0;i<len;i++){
      const na = parseInt(pa[i] || '0', 10), nb = parseInt(pb[i] || '0', 10);
      if(na !== nb) return na > nb ? 1 : -1;
    }
    return 0;
  }`,
    1
  ],
]);

/* ── sw.js ────────────────────────────────────────────────────────────────── */
patch(SW, [
  ['CACHE_NAME', `const CACHE_NAME = 'sidecut-shell-v60.4.1';`, `const CACHE_NAME = 'sidecut-shell-v60.0.6';`, 1],
]);

/* ── dev/native-updates.js (the OTA client) ───────────────────────────────── */
patch(NATIVE, [
  [
    'compareVersions (OTA client)',
    `  // 1 when a is newer, -1 when older, 0 when the same. The check below used to be
  // \`man.version === running\`, so an OLDER published manifest counted as an update
  // and the app would happily install a downgrade over itself.
  function compareVersions(a, b){
    var pa = String(a || '').split('.'), pb = String(b || '').split('.');
    var len = Math.max(pa.length, pb.length);
    for(var i = 0; i < len; i++){
      var na = parseInt(pa[i], 10) || 0, nb = parseInt(pb[i], 10) || 0;
      if(na !== nb) return na > nb ? 1 : -1;
    }
    return 0;
  }`,
    `  // 1 when a is newer, -1 when older, 0 when the same. The check below used to be
  // \`man.version === running\`, so an OLDER published manifest counted as an update
  // and the app would happily install a downgrade over itself.
  //
  // The releases after 60.0.1 were renumbered behind the second decimal
  // (60.1 → 60.0.2 … 60.4.1 → 60.0.6). A phone can still be running one of those
  // old labels — and the comparison runs in the build that is INSTALLED, so the
  // mapping has to live here too: read as-is, "60.4" is newer than 60.0.6 and this
  // client would refuse the renumbered build as a downgrade for ever.
${MAP_VAR}  function compareVersions(a, b){
    var pa = normVersion(a).split('.'), pb = normVersion(b).split('.');
    var len = Math.max(pa.length, pb.length);
    for(var i = 0; i < len; i++){
      var na = parseInt(pa[i], 10) || 0, nb = parseInt(pb[i], 10) || 0;
      if(na !== nb) return na > nb ? 1 : -1;
    }
    return 0;
  }`,
    1
  ],
]);
