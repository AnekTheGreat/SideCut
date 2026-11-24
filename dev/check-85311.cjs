// 85.3.11 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report: "if I have the default set to albums it should open to albums and the
// icon for it, not the icon for playlists or what's first".
//
//   * the Boot view setting was applied to `libraryMode` and to nothing else;
//   * the rail keeps its own page (`scShelf.page`), which starts at 'library' - the first
//     glyph, Songs - and only a glyph tap ever moved it;
//   * so a library set to Albums drew Albums in the list and lit the Songs glyph above it.
//
// Now the page follows the mode whenever the mode is decided or changed by something that
// is not a glyph (boot, the tabs inside the library, the download landing), and a page a
// glyph tap chose is never overruled, because scShelfApply() records the mode that page
// means.
//
//   node dev/check-85311.cjs
const fs = require('fs');
const vm = require('vm');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function grab(name) {
  const key = 'function ' + name + '(';
  const i = page.indexOf(key);
  if (i < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', i + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(i, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}
function run(src, sandbox, expose, filename) {
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}

// =============================================================================
console.log('\n1. The glyph is the page the library is showing');
// =============================================================================
function followRun(o) {
  const opts = o || {};
  const calls = { marks: 0 };
  const shelf = { page: opts.page, modeAt: opts.modeAt, src: 'd', open: false };
  const sandbox = {
    console, Number, Math, String, Object, Array,
    libraryMode: opts.mode,
    scShelf: opts.noShelf ? undefined : shelf,
    scShelfMark() { calls.marks++; }
  };
  const U = run(grab('scShelfPageForMode') + '\n' + grab('scShelfModeFollow'), sandbox,
    ['scShelfModeFollow', 'scShelfPageForMode'], 'shelf-mode.js');
  return { moved: U.scShelfModeFollow(), shelf, calls, U };
}
{
  // THE REPORT, ONE LINE: boot with the setting on Albums.
  const r = followRun({ page: 'library', modeAt: '', mode: 'albums' });
  ok('a library set to Albums lights the Albums glyph', r.shelf.page === 'albums' && r.moved === true, r.shelf.page);
  ok('and the rail is repainted with it', r.calls.marks === 1, r.calls.marks);
  ok('the mode it followed is remembered', r.shelf.modeAt === 'albums', r.shelf.modeAt);
}
{
  // A glyph tap must win: Songs is the 'library' page in a mode that says playlists.
  const r = followRun({ page: 'library', modeAt: 'playlists', mode: 'playlists' });
  ok('a page picked with a glyph is left alone', r.shelf.page === 'library' && r.moved === false, r.shelf.page);
  ok('and nothing is repainted for no reason', r.calls.marks === 0, r.calls.marks);
}
{
  // A tab inside the library moves the mode, not the glyph - so the glyph follows.
  const r = followRun({ page: 'albums', modeAt: 'albums', mode: 'playlists' });
  ok('leaving Albums by the library is the playlists glyph', r.shelf.page === 'playlists' && r.moved === true, r.shelf.page);
}
{
  const r = followRun({ page: 'playlists', modeAt: 'playlists', mode: 'albums' });
  ok('going to Albums from the strip lights Albums', r.shelf.page === 'albums' && r.moved === true, r.shelf.page);
}
{
  const r = followRun({ page: 'albums', modeAt: 'albums', mode: 'albums' });
  ok('an unchanged mode never moves the glyph', r.shelf.page === 'albums' && r.moved === false);
}
{
  const r = followRun({ page: 'library', modeAt: '', mode: 'playlists' });
  ok('a library set to Playlists lights the Playlists glyph', r.shelf.page === 'playlists', r.shelf.page);
}
{
  const r = followRun({ noShelf: true, mode: 'albums' });
  ok('no rail built yet is not an error', r.moved === false);
  ok('the two modes map to exactly two pages',
    r.U.scShelfPageForMode('albums') === 'albums' && r.U.scShelfPageForMode('playlists') === 'playlists' &&
    r.U.scShelfPageForMode('') === 'playlists' && r.U.scShelfPageForMode(undefined) === 'playlists');
}

// =============================================================================
console.log('\n2. The library asks for it wherever the mode moves without a glyph');
// =============================================================================
const nav = page.slice(page.indexOf('  function navigate(view){'), page.indexOf('  $(\'homeBtn\').addEventListener'));
ok('the library view follows the mode on every paint', /isLibrary\)\{[\s\S]{0,1400}?scShelfModeFollow\(\)/.test(nav));
ok('the shelf painter records the mode its page means',
  /scShelf\.modeAt = \(page === 'albums'\) \? 'albums' : 'playlists';/.test(grab('scShelfApply')));
ok('a download landing on All Songs pins the Songs glyph, not the mode name',
  /scShelf\.page = 'library'; scShelf\.modeAt = 'playlists';/.test(grab('scOpenLibraryAfterDownload')));
ok('the shelf carries the mode it last agreed with', /modeAt: ''/.test(page));
ok('the glyph is marked from the page and nowhere else', /var on = \(b\.getAttribute\('data-shelf'\) === scShelf\.page\);/.test(page));

// =============================================================================
console.log('\n3. The release itself');
// =============================================================================
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
}
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok('the page is on 85.3.11', vPage === '85.3.11', vPage);
ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
ok('the notes carry the 85.3.11 entry', page.includes("version: '85.3.11'"));
ok('the new entry is above 85.3.10', page.indexOf("version: '85.3.11'") < page.indexOf("version: '85.3.10'"));
{
  const entry = page.slice(page.indexOf("version: '85.3.11'"), page.indexOf("version: '85.3.10'"));
  ok('the new entry avoids the words the Play channel filters', !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 120));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
