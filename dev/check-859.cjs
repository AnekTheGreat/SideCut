// 85.9 harness - the film moves to the now bar, and the side rail is two whole pages.
//
// The owner, one message, over a screenshot of the library with the rail over it:
// "fix this up and move the mv to the now bar where the lyrics is to the full right of
// that and clean up the side tab bar remove the 3 dots from that tooremove the all songs
// only tab and make it all playlists and all songs clean this up".
//
// Three asks, one rail:
//
//   * THE MV GLYPH LEAVES THE RAIL FOR THE NOW BAR. It sat under the library pages, a
//     screen away from the song it plays for. It is a chip at the right-hand end of the
//     DJ MODE / LYRICS row now, and the cloud bar - which hides that whole row - gets the
//     same camera beside its Lyrics icon, exactly as 80.2 gave it a Lyrics icon.
//   * THE THREE DOTS LEAVE THE RAIL. scShelfDots() went with them: it existed only to be
//     that glyph's tap, and the same sheet is on the now bar's ... menu and on the row.
//   * THE SONGS GLYPH LEAVES, AND PLAYLISTS IS THE WHOLE LIBRARY. "remove the all songs
//     only tab and make it all playlists and all songs" - the narrow page is gone, and the
//     Playlists glyph opens every playlist in the strip with the songs under it, All Songs
//     among them. The rail is two pages and, where there is a source to flip to, the
//     switch: one hairline.
//
// This gate drives `scShelfOrder` in a vm and reads the rest where it sits.
// Looked at? No - nothing was tapped from this sandbox, so what is proven is which glyphs
// the rail builds and which doors are left, not a particular phone's screen.
//
//   node dev/check-859.cjs
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
  const start = page.indexOf(key);
  if (start < 0) throw new Error('missing function ' + name);
  let depth = 0, started = false;
  for (let k = page.indexOf('{', start + key.length); k < page.length; k++) {
    const c = page[k];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) return page.slice(start, k + 1); }
  }
  throw new Error('unterminated function ' + name);
}

// =============================================================================
console.log('1. The music video is a chip on the now bar, at the right-hand end');
{
  const rowAt = page.indexOf('style="margin-top:-2px;"');
  const mvAt = page.indexOf('id="mvBtn"');
  const djAt = page.indexOf('id="djModeBtn"');
  const lyAt = page.indexOf('id="lyricsBtn"');
  ok('the chip is in the DJ MODE / LYRICS row', rowAt > 0 && mvAt > rowAt && mvAt - rowAt < 2400,
    rowAt + '/' + mvAt);
  ok('after LYRICS, which is what "to the full right of that" names',
    lyAt > 0 && mvAt > lyAt, lyAt + '/' + mvAt);
  const chip = page.slice(mvAt - 40, page.indexOf('</button>', mvAt) + 9);
  ok('and it is pushed to the far right of the row', /margin-left:auto/.test(chip), chip.slice(0, 80));
  ok('it is a chip like the two beside it (mono, 9.5px, the same border)',
    /font-family:'JetBrains Mono'/.test(chip) && /font-size:9\.5px/.test(chip) && /border:1px solid var\(--line\)/.test(chip));
  ok('it wears the camera, not a word alone', /<svg viewBox="0 0 24 24"[^>]*><path d="M4 6h10\.5/.test(chip));
  ok('it says MV', />MV<\/button>/.test(chip));

  // ONE VIEWER, NOT A SECOND TAB. The chip opens the function the rail glyph opened.
  const wire = page.slice(page.indexOf("var mv = document.getElementById('mvBtn')"), page.indexOf("var mv = document.getElementById('mvBtn')") + 700);
  ok('the chip opens the shipped viewer', /typeof scVideoOpen === 'function'\) scVideoOpen\(\)/.test(wire));
  ok('it opens nothing else', !/openSongActions|scShelfOpenTab|navigate\(/.test(wire));
  ok('the Play build, which has no video path, gets no chip',
    /typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY\)\{ mv\.style\.display = 'none'; return; \}/.test(wire));
  ok('scVideoOpen is still the one door', /function scVideoOpen\(\)\{/.test(page));
}

console.log('\n2. The cloud bar gets the camera beside Lyrics');
{
  ok('the icon has an id of its own', page.includes('b.id = \'sc11Video\';'));
  ok('its click is the MV chip, and the viewer if the chip is gone',
    /document\.getElementById\('mvBtn'\);\s*\n\s*if\(chip\) chip\.click\(\);/.test(page) &&
    /else if\(typeof scVideoOpen === 'function'\) scVideoOpen\(\);/.test(page));
  ok('it is hidden outside the cloud layout', page.includes('#npControls #sc11Video{ display:none; width:32px; height:32px; }'));
  ok('and shown in it', page.includes('body.sc80-cloud #npControls #sc11Video{ display:flex; }'));
  ok('the Lyrics icon it sits beside is untouched',
    page.includes('#npControls #sc11Lyrics{ display:none; width:32px; height:32px; }') &&
    page.includes('body.sc80-cloud #npControls #sc11Lyrics{ display:flex; }'));
  ok('both are added by the one boot', /function sc11AddBarIcons\(\)\{ sc11AddLyrics\(\); sc11AddVideo\(\); \}/.test(page));
  ok('the Play build gets no camera here either', /if\(typeof SC_IS_PLAY !== 'undefined' && SC_IS_PLAY\) return;/.test(page));
}

console.log('\n3. The rail is two whole pages, and the tools are off it');
{
  const railPages = (page.match(/var SC_RAIL_PAGES = (\[[^\]]*\]);/) || [])[1];
  ok('the rail knows two pages', railPages === "['playlists', 'albums']", String(railPages));
  ok('the Songs page has no glyph', !/library: \['Songs'/.test(page) && !/'Songs', 'list'/.test(page));
  ok('Playlists is the whole library, and says so', page.includes("playlists: ['Playlists and songs', 'plist']"));

  const render = grab('scShelfRender');
  ok('the rail builds no music video glyph', !/data-video=/.test(page));
  ok('the rail builds no three dots', !/data-dots=/.test(page) && !/scshelf-dots/.test(page));
  ok('and the function behind them is gone too', !/function scShelfDots\(/.test(page));
  ok('one hairline: the pages, then the switch', (render.match(/scshelf-sep/g) || []).length === 1,
    (render.match(/scshelf-sep/g) || []).length);
  ok('the switch is still gated on there being a source', /if\(SC_STREAM_OK\)\{\s*\n\s*h \+= '<div class="scshelf-sep"><\/div>';/.test(render));
  ok('a tap is a page or the switch, nothing else',
    /if\(this\.getAttribute\('data-src'\) === '1'\)\{ scShelfSetSrc/.test(render) &&
    /scShelfOpenTab\(this\.getAttribute\('data-shelf'\)\);/.test(render) &&
    !/scVideoOpen|scShelfDots/.test(render));
  ok('the mark has no dots branch left to skip', !/data-dots/.test(grab('scShelfMark')));
  ok('the page the rail starts on has a glyph', /var scShelf = \{ page: 'playlists',/.test(page));

  // And the shipped builder is RUN, against a fake rail, so what is proven is the markup
  // it builds - not a string in a file that happens to sit near it.
  function railMarkup(streamOk, isPlay) {
    const rail = {
      _h: '', attrs: {},
      set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; },
      set className(v) { this._cls = v; }, get className() { return this._cls || ''; },
      setAttribute: function (k, v) { this.attrs[k] = String(v); },
      getAttribute: function (k) { return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null; },
      querySelectorAll: function () { return []; },
      parentNode: {}
    };
    const ctx = {
      document: { getElementById: function (id) { return id === 'scShelfRail' ? rail : null; }, body: { appendChild: function () {} } },
      scShelfOrder: function () { return ['playlists', 'albums']; },
      escapeHtml: function (s) { return String(s); },
      scIcon: function (n) { return '<i data-icon="' + n + '"></i>'; },
      SC_STREAM_OK: !!streamOk, SC_IS_PLAY: !!isPlay,
      scShelf: { page: 'playlists', src: 'd' },
      scShelfMark: function () {}, scShelfOpenTab: function () {}, scShelfSetSrc: function () {}, scRailDrag: function () {}
    };
    vm.createContext(ctx);
    vm.runInContext(grab('scShelfRender') + '\n;globalThis.__rail = scShelfRender;', ctx);
    ctx.__rail();
    return rail._h;
  }
  const markup = railMarkup(true, false);
  const tabs = (markup.match(/data-shelf="/g) || []).length;
  ok('built: two page glyphs and nothing else', tabs === 2, tabs);
  ok('built: Playlists first, Albums second',
    markup.indexOf('data-shelf="playlists"') < markup.indexOf('data-shelf="albums"') &&
    markup.indexOf('data-shelf="playlists"') > 0);
  ok('built: the playlist glyph, the grid glyph and no third',
    markup.split('data-icon="plist"').length === 2 && markup.split('data-icon="grid"').length === 2 &&
    !/data-icon="(list|video|dots)"/.test(markup));
  ok('built: one hairline, then the switch',
    (markup.match(/scshelf-sep/g) || []).length === 1 && markup.indexOf('scshelf-sep') < markup.indexOf('data-src="1"'),
    markup);
  ok('built: nothing taps into a video or a menu from here', !/data-video|data-dots/.test(markup));
  const noSource = railMarkup(false, false);
  ok('built: a build with no source gets no switch and no hairline either',
    !/data-src=/.test(noSource) && !/scshelf-sep/.test(noSource), noSource);
}

console.log('\n4. The order is still the owner\'s');
{
  const railPages = (page.match(/var SC_RAIL_PAGES = (\[[^\]]*\]);/) || [])[1];
  function order(stored) {
    const ctx = { localStorage: { getItem: function () { return stored; } } };
    vm.createContext(ctx);
    vm.runInContext('var SC_RAIL_PAGES = ' + railPages + ';\n' + grab('scShelfOrder') +
      '\n;globalThis.__order = scShelfOrder;', ctx);
    return ctx.__order();
  }
  ok('nothing stored is the two pages', JSON.stringify(order(null)) === '["playlists","albums"]',
    JSON.stringify(order(null)));
  ok('a stored order with the Songs glyph in it keeps its own order',
    JSON.stringify(order(JSON.stringify(['library', 'albums', 'playlists']))) === '["albums","playlists"]',
    JSON.stringify(order(JSON.stringify(['library', 'albums', 'playlists']))));
  ok('a stored order that lost a page gets it back rather than an empty rail',
    JSON.stringify(order(JSON.stringify(['albums']))) === '["albums","playlists"]',
    JSON.stringify(order(JSON.stringify(['albums']))));
  ok('a corrupt store is the two pages', JSON.stringify(order('{not json')) === '["playlists","albums"]',
    JSON.stringify(order('{not json')));
}

console.log('\n5. Nothing lost its last door');
{
  // Every door the three removed things had, still standing.
  ok('the song\'s actions are still on the now bar\'s ... menu', page.includes('id="npMenuBtn"'));
  ok('the actions sheet is still built', /function openSongActions\(/.test(page));
  ok('the library page still opens from the dock pill', page.includes("scShelfOpenTab('library'"));
  ok('the download landing still lands on All Songs', /activePlaylist = 'All Songs';/.test(page));
  ok('the film is still reachable from the song\'s own sheet',
    page.includes("videoBtn.id = 'songActionsVideo';") && /scVideoForTrack\(t\);/.test(page));
  ok('the rail is still the drag-reorderable one', /function scRailDrag\(/.test(page) && /sidecut_railOrder/.test(page));
  ok('and a stored order is still written back', /localStorage\.setItem\('sidecut_railOrder'/.test(page));
}

console.log('\n6. The release itself');
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) {
    scripts++;
    try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); }
  }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
  const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  const { atLeast } = require('./version.cjs');
  ok('the page is on 85.9 or newer', atLeast(vPage, '85.9'), vPage);
  ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
  ok('the notes carry the 85.9 entry', page.includes("version: '85.9'"));
  ok('the new entry is above 85.8', page.indexOf("version: '85.9'") < page.indexOf("version: '85.8'"));
  const entry = page.slice(page.indexOf("version: '85.9'"), page.indexOf("version: '85.8'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|to mp3|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off|streaming|streams?\b|from the source|\bdownload)/i.test(entry),
    (entry.match(/(downloader|downloading|converter|converts|converting|conversion|convert\b|streams?\b|from the source|\bdownload)/i) || [])[0]);
  const items = entry.split('\n').filter(function (l) { return /^      '/.test(l); }).length;
  ok('the entry carries the things it describes', items >= 4, items);
  ok('and names the bar, the rail and the song actions',
    /now bar/i.test(entry) && /rail/i.test(entry) && /menu/i.test(entry));
  ok('the version is two-part or one digit after the second (the numbering rule)',
    /^\d+\.\d+(\.\d)?$/.test(String(vPage)), vPage);
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
if (fail) process.exitCode = 1;
