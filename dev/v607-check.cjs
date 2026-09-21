// v60.0.7 audit — the Watermark Remover must match whole phrases.
//
// The regression this covers: the escape step's replacement string lost its
// backslash (commit 6b9df35: '\\$&' → '\$&', and '\$&' in JS is just "$&" — the
// match inserted with nothing added). So `escaped` was the raw pattern and every
// pattern went to the regex engine unescaped:
//
//   • "[SpotiSaver]" became a CHARACTER CLASS, so instead of the watermark word
//     disappearing, every S, p, o, t, i, a, v, e and r was deleted from unrelated
//     titles — "Sunshine Song" → "unhn ng";
//   • "(Live)" became a group, so "Live at Wembley" lost "Live".
//
// These checks pull the REAL function out of index.html and run it, so the
// behaviour — not just the source text — is what gets asserted.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const html = fs.readFileSync(process.env.SC_HTML || path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ✓ ' + name); }
  else { fail++; console.log('  ✗ ' + name + (extra ? '  [' + extra + ']' : '')); }
}
const BS = String.fromCharCode(92);
const SQ = String.fromCharCode(39);
const BROKEN_ESCAPE = SQ + BS + '$&' + SQ;         // '\$&'  — the regression
const FIXED_ESCAPE = SQ + BS + BS + '$&' + SQ;     // '\\$&' — escapes the pattern

const version = (html.match(/const APP_VERSION = '([^']+)'/) || [])[1];
const fnStart = html.indexOf('  function applyWatermarkPatterns(');
const fnEnd = html.indexOf('  function removeNumberPrefix(');
const fnSrc = (fnStart === -1 || fnEnd === -1) ? '' : html.slice(fnStart, fnEnd);

// Run the shipped function with a given pattern list / toggle.
function wm(patterns, text, opts) {
  const o = opts || {};
  const body =
    'let watermarkEnabled=' + (o.enabled === false ? 'false' : 'true') + ';' +
    'let watermarkPatterns=' + JSON.stringify(patterns) + ';' +
    'let watermarkArtistPatterns=' + JSON.stringify(o.artistPatterns || '') + ';\n' +
    fnSrc + '\nreturn applyWatermarkPatterns;';
  try { return new Function(body)()(text, !!o.forArtist); }
  catch (e) { return '<<threw: ' + e.message + '>>'; }
}

console.log('\n— the pattern is escaped again, so it matches the literal phrase —');
ok('the escape replacement string has its backslash', html.indexOf(FIXED_ESCAPE) !== -1);
ok('the broken replacement string is gone', html.indexOf(BROKEN_ESCAPE) === -1);
ok('the function could be extracted from index.html', fnSrc.length > 200, String(fnSrc.length));

console.log('\n— a bracketed watermark is a phrase, not a character class —');
// THE regression: with the raw pattern, this deleted every letter it listed.
ok('"Sunshine Song" survives a [SpotiSaver] pattern intact',
  wm('[SpotiSaver]', 'Sunshine Song') === 'Sunshine Song', wm('[SpotiSaver]', 'Sunshine Song'));
ok('and the bracketed watermark itself is removed',
  wm('[SpotiSaver]', 'Sunshine [SpotiSaver]') === 'Sunshine', wm('[SpotiSaver]', 'Sunshine [SpotiSaver]'));
ok('a paren watermark is removed with its brackets',
  wm('(SpotiSaver)', 'Sunshine (SpotiSaver)') === 'Sunshine', wm('(SpotiSaver)', 'Sunshine (SpotiSaver)'));
ok('a bare word only goes where it actually sits',
  wm('SpotiSaver', 'My SpotiSaver Song') === 'My Song', wm('SpotiSaver', 'My SpotiSaver Song'));
ok('a title that merely contains the letters is untouched',
  wm('SpotiSaver', 'Saver of Songs') === 'Saver of Songs', wm('SpotiSaver', 'Saver of Songs'));
ok('case-insensitive still (the gi flag is kept)',
  wm('SpotiSaver', 'MY SPOTISAVER SONG').indexOf('SPOTISAVER') === -1,
  wm('SpotiSaver', 'MY SPOTISAVER SONG'));

console.log('\n— regex metacharacters are literal, not syntax —');
ok('"(Live)" does not eat a bare "Live"',
  wm('(Live)', 'Live at Wembley') === 'Live at Wembley', wm('(Live)', 'Live at Wembley'));
ok('"(Live)" still removes the bracketed tag',
  wm('(Live)', 'Song (Live)') === 'Song', wm('(Live)', 'Song (Live)'));
ok('"C++ (Remix)" matches literally',
  wm('C++ (Remix)', 'C++ (Remix) Night') === 'Night', wm('C++ (Remix)', 'C++ (Remix) Night'));
ok('and does not fire on "C++ Night"',
  wm('C++ (Remix)', 'C++ Night') === 'C++ Night', wm('C++ (Remix)', 'C++ Night'));
ok('a dot in a pattern is a dot, not any character',
  wm('SpotiSaver.com', 'SpotiSaverXcom') === 'SpotiSaverXcom', wm('SpotiSaver.com', 'SpotiSaverXcom'));
ok('but the real dotted watermark goes',
  wm('SpotiSaver.com', 'Song SpotiSaver.com') === 'Song', wm('SpotiSaver.com', 'Song SpotiSaver.com'));

console.log('\n— no bracket crumbs left behind —');
ok('"Song [SpotiSaver]" is not left as "Song [] "',
  wm('SpotiSaver', 'Song [SpotiSaver]') === 'Song', wm('SpotiSaver', 'Song [SpotiSaver]'));
ok('double spaces collapse instead of lingering',
  wm('SpotiSaver', 'My  SpotiSaver  Song') === 'My Song', wm('SpotiSaver', 'My  SpotiSaver  Song'));
ok('a bracket that still holds text is left alone',
  wm('SpotiSaver', 'Song (Deluxe) [SpotiSaver]') === 'Song (Deluxe)',
  wm('SpotiSaver', 'Song (Deluxe) [SpotiSaver]'));

console.log('\n— the number-prefix patterns are unchanged —');
ok('an artist leading "1. " is stripped, and only for artists',
  wm('x', '1. Diljit Dosanjh', { forArtist: true, artistPatterns: '0.\n1.\n2.' }) === 'Diljit Dosanjh');
ok('the same text as a title is untouched',
  wm('x', '1. Diljit Dosanjh', { forArtist: true, artistPatterns: '0.\n1.\n2.' }) !== wm('x', '1. Diljit Dosanjh', {}));
ok('a number that is not at the start is untouched',
  wm('x', 'Track 1.', { forArtist: true, artistPatterns: '0.\n1.' }) === 'Track 1.',
  wm('x', 'Track 1.', { forArtist: true, artistPatterns: '0.\n1.' }));

console.log('\n— the toggle still gates it —');
ok('off means nothing is removed',
  wm('SpotiSaver', 'My SpotiSaver Song', { enabled: false }) === 'My SpotiSaver Song');

console.log('\n— the import cleaner uses the same function —');
ok('cleanOnImport is present and applies these patterns',
  /function cleanOnImport\([\s\S]{0,1400}applyWatermarkPatterns\(/.test(html));

console.log('\n— the bridge actually bridges —');
// A pre-renumbering install: plain numeric compare, none of the mapping. This is
// the decision that was refusing v60.0.7 and offering nothing.
const oldCmp = (a, b) => {
  const pa = String(a).split('.'), pb = String(b).split('.');
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = parseInt(pa[i] || '0', 10), y = parseInt(pb[i] || '0', 10);
    if (x !== y) return x > y ? 1 : -1;
  }
  return 0;
};
ok('a phone on v60.4 accepts the bridge (60.4.2 > 60.4)', oldCmp('60.4.2', '60.4') > 0);
ok('so does a phone on v60.4.1', oldCmp('60.4.2', '60.4.1') > 0);
ok('and one on v60.0.1 or older', oldCmp('60.4.2', '60.0.1') > 0);
ok('the plain renumbered build would NOT be accepted by them', oldCmp('60.0.7', '60.4') < 0);
// And the bridged phone must accept what comes after it — decided by the code in
// the shipped OTA client, so that is what gets run.
function extractFn(src, from, to, ret) {
  const a = src.indexOf(from), b = src.indexOf(to);
  if (a === -1 || b === -1 || b < a) return null;
  try { return new Function(src.slice(a, b) + '\nreturn ' + ret + ';')(); } catch (e) { return null; }
}
const otaCmp = extractFn(fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8'),
  'var LEGACY_VERSIONS', '  function currentVersion(){', 'compareVersions');
ok('the shipped OTA client reads the bridge as 60.0.7', typeof otaCmp === 'function' && otaCmp('60.4.2', '60.0.7') === 0);
ok('so the next renumbered release installs on a bridged phone',
  typeof otaCmp === 'function' && otaCmp('60.0.8', '60.4.2') > 0);
ok('and the bridge is not a downgrade for anyone else',
  typeof otaCmp === 'function' && otaCmp('60.4.2', '60.0.1') > 0);

console.log('\n— version, notes and the published bundle —');
// Read versions through the app's own legacy map: 60.1–60.4.1 were renumbered
// behind the second decimal, and 60.4.2 is the one-off bridge release that carries
// this same code under an old-style number so a pre-renumbering install accepts it.
const LEGACY = { '60.1': '60.0.2', '60.2': '60.0.3', '60.3': '60.0.4', '60.4': '60.0.5', '60.4.1': '60.0.6', '60.4.2': '60.0.7' };
const BRIDGE = '60.4.2';
function versionAtLeast(v, min) {
  const a = String(LEGACY[v] || v).split('.'), b = String(min).split('.');
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const x = parseInt(a[i] || '0', 10), y = parseInt(b[i] || '0', 10);
    if (x !== y) return x > y;
  }
  return true;
}
ok('index.html is v60.0.7, or the bridge build carrying it', versionAtLeast(version, '60.0.7'), version);
ok('sw.js cache matches', sw.indexOf(`sidecut-shell-v${version}`) !== -1);
ok('the bridge release is mapped to 60.0.7 in both comparators',
  html.indexOf(`'60.4.2':'60.0.7'`) !== -1 &&
  fs.readFileSync(path.join(ROOT, 'dev/native-updates.js'), 'utf8').indexOf(`'60.4.2':'60.0.7'`) !== -1);
const entries = [...html.matchAll(/version: '(\d+(?:\.\d+)*)', date: '([^']*)'/g)].map((m) => ({ v: m[1], d: m[2] }));
ok('the 60.0.7 entry exists', entries.some((e) => e.v === '60.0.7'));
ok('the newest entry is this build (or the bridge carrying it)',
  entries[0] && (entries[0].v === version || entries[0].v === BRIDGE), entries[0] && entries[0].v);
ok('only the documented bridge uses an old-style number',
  entries.filter((e) => /^60\.[1-9]/.test(e.v) && e.v !== BRIDGE).length === 0,
  entries.map((e) => e.v).slice(0, 7).join(', '));
ok('the stamps are Eastern time, never UTC',
  entries.slice(0, 7).every((e) => /(EDT|EST)$/.test(e.d)),
  entries[0].d);
ok('the renumbered history reads 60.0.7 … 60.0.2',
  entries.filter((e) => /^60\.0\.\d$/.test(e.v)).slice(0, 6).map((e) => e.v).join(',') === '60.0.7,60.0.6,60.0.5,60.0.4,60.0.3,60.0.2',
  entries.filter((e) => /^60\.0\.\d$/.test(e.v)).slice(0, 6).map((e) => e.v).join(','));

let man = null;
try { man = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8')); } catch (e) {}
ok('the OTA manifest parses', !!man);
ok('it names this version', man && String(man.version) === version, man && man.version);
ok('and carries patch notes', man && Array.isArray(man.notes) && man.notes.length > 0);
// The live manifest only carries the NEWEST entry's notes (which is the bridge's
// own on a bridge release), so this build's notes are read from its changelog.
const ownEntry = (html.match(/\{ version: '60\.0\.7'[\s\S]*?\n  \]\}/) || [''])[0];
ok('the 60.0.7 notes explain the escaping', ownEntry.indexOf('escaping') !== -1);
let zipHtml = '';
try { zipHtml = execFileSync('unzip', ['-p', path.join(ROOT, 'ota/update.zip'), 'index.html'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }); } catch (e) {}
ok('the published zip carries the fix', zipHtml.indexOf(FIXED_ESCAPE) !== -1 && zipHtml.indexOf(BROKEN_ESCAPE) === -1);
ok('the zip version matches', (zipHtml.match(/const APP_VERSION = '([^']+)'/) || [])[1] === version);

console.log('\n— it still parses —');
const blocks = html.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
let bad = null;
blocks.forEach((b, i) => {
  try { new Function(b.replace(/<\/?script[^>]*>/gi, '')); }
  catch (e) { if (!(i === 3 && String(e.message).includes('await'))) bad = `block ${i + 1}: ${e.message}`; }
});
ok('every inline script block parses', !bad, bad);
ok('there are still 5 blocks', blocks.length === 5, String(blocks.length));

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
