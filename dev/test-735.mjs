// v73.5 — the three asks of this release, each pinned against the shipped code.
//
// The owner's words: "this should be an option on by default but should be
// optional to automatically go to the next album when one ends"; "This random
// remixes shouldnt show up as new releases this song was made 7 years ago"; and
// "Remove get songs tab from settings because we have discover for free".
//
//   [1] release metadata (the head entry, the cache name, the channel rule)
//   [2] NEXT ALBUM WHEN ONE ENDS: the real scAlbumRollNext/scAlbumRollQueue are
//       lifted out of the page and RUN against a stub library, so what is
//       asserted is what the queue actually does — on, off, a library-wide queue,
//       a single-album library, and the wrap from the last album to the first.
//   [3] A SEVEN-YEAR-OLD SONG IS NOT A NEW RELEASE: the real
//       __scReleaseIsOldSong is run against a fake library, and the fetch-side
//       re-upload rule and the prune/list wiring are pinned at their call sites.
//   [4] THE GET SONGS TAB IS GONE from Settings: the tab, its pane and every
//       Settings-side converter id are asserted absent, the redirect that keeps
//       old links from reaching a pane that is not there is pinned, and Discover
//       is asserted to still carry the cards (the feature moved, it did not go).
//   [5] inline script syntax.
import fs from 'node:fs';
import path from 'node:path';
import * as acorn from 'acorn';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { c ? (pass++, console.log('  PASS ' + m)) : (fail++, console.log('  FAIL ' + m)); };
const count = (s) => src.split(s).length - 1;
function slice(from, to) {
  const a = src.indexOf(from);
  if (a === -1) return null;
  const b = src.indexOf(to, a);
  return b === -1 ? null : src.slice(a, b);
}

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  ok(/^\d+(\.\d+)*$/.test(String(ver)), 'APP_VERSION = ' + ver);
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'changelog evaluates: ' + e.message); }
  ok(!!entries && entries[0].version === ver, 'newest changelog (' + (entries && entries[0].version) + ') matches APP_VERSION');
  if (entries) {
    ok(entries[0].items.length >= 6, 'patch notes: ' + entries[0].items.length);
    ok(String(entries[0].date).endsWith('EDT'), 'date ends in EDT (' + entries[0].date + ')');
    const head = entries[0].items.join(' ');
    // The shared channel's rule, the one every release is held to: the last note
    // carries the store-channel feature words and no downloader term.
    const last = String(entries[0].items[entries[0].items.length - 1] || '');
    for (const w of ['widget', 'player', 'letter', 'lyrics', 'album']) {
      ok(new RegExp('\\b' + w, 'i').test(last), 'the last note names /' + w + '/');
    }
    ok(!/['’]/.test(head), 'no apostrophe anywhere in the notes');
    ok(!/\b(download|downloading|converter|converting|conversion|convert|mp3)\b/i.test(head),
      'notes carry no downloader or converter term');
  }
  ok(sw.includes("const CACHE_NAME = 'sidecut-shell-v" + ver + "'"),
    'the shell cache is this release name');
}

console.log('[2] the next album when one ends');
{
  // The two shipped functions, lifted whole and driven. The only things handed
  // in are the state the page keeps around them and the album helpers they read.
  const at = src.indexOf('  function scAlbumRollNext(){');
  const anchor = '  window.__scAlbumRollQueue = scAlbumRollQueue;';
  const b = src.indexOf(anchor, at);
  ok(at !== -1 && b > at, 'the album-roll functions can be lifted out of the page');
  const end = src.indexOf('\n', b) + 1;
  const body = src.slice(at, end);
  ok(/let autoNextAlbum = true;/.test(src), 'the option is ON by default');
  ok(src.indexOf("id=\"autoNextAlbumToggle\"") !== -1, 'and it has a toggle in Playback');
  ok(src.indexOf("$('autoNextAlbumToggle').addEventListener('click'") !== -1, 'wired to flip it');
  ok(count("dbPut('meta', { key: 'autoNextAlbum'") === 1, 'and it is remembered across launches');

  const make = (S, albums, on) => {
    const list = Object.keys(albums);
    const fn = new Function(
      'window', 'S', 'userAlbums', 'visibleAlbumNames', 'albumIsAuto', 'scAlbumCardOrder', 'scAlbumQueueIds', 'autoNextAlbum',
      'let queue = S.queue, queueIndex = S.queueIndex, queueAlbumName = S.queueAlbumName;\n' +
      'let gaplessPreloadedFor = S.gapless;\n' +
      body + '\n' +
      'return function(){ scAlbumRollQueue(); S.queue = queue; S.queueIndex = queueIndex;' +
      ' S.queueAlbumName = queueAlbumName; S.gapless = gaplessPreloadedFor; };'
    );
    return fn(
      {},
      S,
      albums,
      () => list,
      () => false,
      (names) => names.slice(),                       // the card order, as given
      (name) => (albums[name] && albums[name].trackIds ? albums[name].trackIds.slice() : []),
      on
    );
  };
  const ALBUMS = {
    First: { trackIds: ['a1', 'a2', 'a3'] },
    Second: { trackIds: ['b1', 'b2'] },
    Third: { trackIds: ['c1'] },
  };

  // ON: the queue really moves to the next album, at its first song.
  {
    const S = { queue: ['a1', 'a2', 'a3'], queueIndex: 2, queueAlbumName: 'First', gapless: 2 };
    make(S, ALBUMS, true)();
    ok(JSON.stringify(S.queue) === JSON.stringify(['b1', 'b2']), 'the queue becomes the next album (' + S.queue.join(',') + ')');
    ok(S.queueIndex === 0, 'and the deck starts at its first song');
    ok(S.queueAlbumName === 'Second', 'the album it now belongs to follows (' + S.queueAlbumName + ')');
    ok(S.gapless === null, 'and the gapless preload of the album that ended is dropped');
  }
  // OFF: nothing moves.
  {
    const S = { queue: ['a1', 'a2', 'a3'], queueIndex: 2, queueAlbumName: 'First', gapless: 2 };
    make(S, ALBUMS, false)();
    ok(JSON.stringify(S.queue) === JSON.stringify(['a1', 'a2', 'a3']) && S.queueIndex === 2,
      'with the option off the queue stays on the album you started');
  }
  // The last album wraps to the first, so music never just stops.
  {
    const S = { queue: ['c1'], queueIndex: 0, queueAlbumName: 'Third', gapless: 0 };
    make(S, ALBUMS, true)();
    ok(JSON.stringify(S.queue) === JSON.stringify(['a1', 'a2', 'a3']) && S.queueAlbumName === 'First',
      'the last album rolls back round to the first');
  }
  // A library-wide queue (an Albums-tab play-all) is somebody else's order.
  {
    const S = { queue: ['a1', 'a2', 'a3', 'b1', 'b2', 'c1'], queueIndex: 5, queueAlbumName: 'First', gapless: 5 };
    make(S, ALBUMS, true)();
    ok(JSON.stringify(S.queue) === JSON.stringify(['a1', 'a2', 'a3', 'b1', 'b2', 'c1']) && S.queueIndex === 5,
      'a queue that is not exactly one album keeps its own order');
  }
  // A library with one album has no next album to roll to.
  {
    const S = { queue: ['a1', 'a2', 'a3'], queueIndex: 2, queueAlbumName: 'First', gapless: 2 };
    make(S, { First: { trackIds: ['a1', 'a2', 'a3'] } }, true)();
    ok(JSON.stringify(S.queue) === JSON.stringify(['a1', 'a2', 'a3']) && S.queueIndex === 2,
      'with one album the play wraps inside it as before');
  }
  // Nothing that is not an album uses it at all.
  {
    const S = { queue: ['x1', 'x2'], queueIndex: 1, queueAlbumName: null, gapless: 1 };
    make(S, ALBUMS, true)();
    ok(S.queueIndex === 1 && S.queueAlbumName === null, 'a playlist or a mix is never rolled into an album');
  }

  // The three places a song can reach its own end all ask, and only a natural
  // end rolls: the Next button stays inside the album you are in.
  ok(src.indexOf('hardAdvance(1, true, true); // the album ends') !== -1, 'a natural end (no crossfade, no gapless) rolls');
  ok(/if\(natural && dir > 0 && scAlbumRollQueue\(\) >= 0\)/.test(src), 'and hardAdvance only rolls when it was a natural end');
  ok(/if\(nextIndex >= queue\.length\)\{ scAlbumRollQueue\(\); nextIndex = 0; \}/.test(src), 'a crossfade into the end rolls into the next album');
  ok(/let _rolledGapless = -1;/.test(src) && /_rolledGapless = scAlbumRollQueue\(\);/.test(src),
    'and so does the gapless cut');
  ok(/if\(_rolledGapless >= 0\)\{ try\{ nxt\.src = nextTrack\.url; \}/.test(src),
    'the gapless path re-points the idle element, whose preload was for the album that ended');
}

console.log('[3] a song that is seven years old is not a new release');
{
  // The shipped library test, lifted and driven with a fake library.
  const at = src.indexOf('  var SC_GENERIC_REL_TITLES = {');
  const b = src.indexOf('\n  let libraryMode', at);
  ok(at !== -1 && b > at, 'the old-song test can be lifted out of the page');
  const body = src.slice(at, b);
  const make = (tracks) => new Function(
    'window', 'allTracks', body + '\nreturn window.__scReleaseIsOldSong;'
  )({ __scSameArtistName: (x, y) => String(x).toLowerCase().trim() === String(y).toLowerCase().trim() }, tracks);

  const LIB = [{ title: 'Sauda Khara Khara', artist: 'Diljit Dosanjh' }, { title: 'Intro', artist: 'Somebody' }];
  const isOld = make(LIB);
  ok(isOld('Diljit Dosanjh', { title: 'Sauda Khara Khara', kind: 'single' }) === true,
    'the 2019 song you own is not a new single in 2026');
  ok(isOld('Diljit Dosanjh', { title: 'SAUDA  KHARA-KHARA' }) === true,
    'and it does not matter how the stores punctuate or case it');
  ok(isOld('Nobody Else', { title: 'Sauda Khara Khara', kind: 'single' }) === false,
    'the same title by another artist is somebody else record');
  ok(isOld('Diljit Dosanjh', { title: 'Sauda Khara Khara', kind: 'album' }) === false,
    'an album sharing a name with a song you own is a different record');
  ok(isOld('Somebody', { title: 'Intro', kind: 'single' }) === false,
    'a generic title never hides a drop');
  ok(isOld('Diljit Dosanjh', { title: 'Brand New Song', kind: 'single' }) === false,
    'and a song you do not own is still a drop');
  ok(make([])('Diljit Dosanjh', { title: 'Sauda Khara Khara', kind: 'single' }) === false,
    'an empty library hides nothing');

  // The in-page rule: a re-upload is caught before any fetch, and the copy an
  // older build already stored for that artist is evicted with it.
  ok(/const _oldestDay = \{\};/.test(src) && /const _reUpload = \{\};/.test(src),
    'the fetch indexes the earliest day each title has in the artist catalog');
  ok(/\(n - o\) > 180 \* 86400000/.test(src), 'and calls a title six months older than the candidate a re-upload');
  ok(/const prev = \(pinnedReleases\[artist\] \|\| \[\]\)\.filter\(function\(pr\)\{ return !\(pr && _reUpload\[_relKey\(pr\.title\)\]\); \}\);/.test(src),
    'a stored copy of a re-upload is dropped from the artist own list');
  ok(/if\(_reUpload\[_relKey\(r\.trackName\)\]\) return;   \/\/ 73\.5/.test(src),
    'the popularity pass refuses it');
  ok(/if\(_oneTrack && _reUpload\[_relKey\(window\.__scSingleTitle\(r\.collectionName\)\)\]\) return;/.test(src),
    'and so does the one-track catalog pass, through the "- Single" wrapper');

  // The two stored-list surfaces ask the shipped test.
  ok(/window\.__scNotNew = function\(artist, rel\)/.test(src), 'the lighter test sits on window beside the junk one');
  ok(/window\.__scJunkTitle\(r\.title\) \|\| window\.__scNotNew\(k, r\)/.test(src),
    'the prune drops an already-stored re-upload, per artist key');
  ok(/window\.__scJunkTitle\(rel\.title\)\) return;\n        if\(window\.__scNotNew\(rel\.artist \|\| artist, rel\)\) return;/.test(src),
    'and the flattened release list does too');
}

console.log('[4] the Get Songs tab is gone from Settings, Discover keeps the cards');
{
  ok(src.indexOf("id=\"settingsTabExpand\"") === -1, 'no Get Songs tab in the strip');
  ok(src.indexOf("id=\"settingsPaneExpand\"") === -1, 'no Get Songs pane');
  ok(src.indexOf("$('settingsTabExpand')") === -1, 'and nothing reaches for the tab');
  ok(src.indexOf("$('settingsPaneExpand')") === -1, 'or for the pane');
  ok(src.indexOf("if(tab === 'expand') tab = 'theme';") !== -1,
    'a link that still names the tab opens Theme instead of a pane that is not there');
  ok(src.indexOf("['widget', 'theme', 'donate', 'important', 'refresh', 'glow', 'playback', 'eq', 'more', 'sandbox', 'support']") !== -1,
    'the tab list a quick action can point at no longer offers it');
  ok(src.indexOf("<option value=\"expand\">Get Songs</option>") === -1, 'and the picker has no such option');

  // The Settings-side copies of every converter control are gone; the Discover
  // ones (and the batch/playlist pickers) are what is left.
  const SETTINGS_ONLY = ['spCardSettings', 'ytCardSettings', 'getSongsHowToSettings', 'spMp3InputSettings',
    'spMp3BtnSettings', 'spMp3ClearSettings', 'spMp3ResultSettings', 'spFmtSettings',
    'ytMp3InputSettings', 'ytMp3BtnSettings', 'ytMp3ClearSettings', 'ytMp3ResultSettings', 'ytFmtSettings',
    'mp4ToMp3FileSettings', 'mp4ToMp3ConvertSettings', 'mp4ToMp3ResultSettings', 'mp4FmtSettings',
    'expandUrlInputSettings', 'expandUrlBtnSettings', 'expandUrlClearSettings', 'expandUrlResultSettings'];
  const left = SETTINGS_ONLY.filter((id) => src.indexOf('id="' + id + '"') !== -1);
  ok(left.length === 0, 'the Settings-side converter surface is gone' + (left.length ? ': ' + left.join(', ') : ''));

  // The feature did NOT go anywhere: Discover still carries it, whole.
  for (const id of ['getSongsHowToDisc', 'spCardDisc', 'spMp3Input', 'spFmtDisc', 'ytCardDisc', 'ytMp3Input',
    'mp4ToMp3File', 'mp4FmtDisc', 'expandUrlInput', 'expandUrlBtn']) {
    ok(src.indexOf('id="' + id + '"') !== -1, 'Discover still has ' + id);
  }
  ok(count('🎛️ Conversion Tools') >= 1, 'and its Conversion Tools bar');

  // The tab strip reads cleanly without it, and the redirect runs before any
  // pane is shown, so nothing can crash on the missing pane.
  const strip = slice('id="settingsTabStrip"', '</div>');
  ok(strip !== null && strip.indexOf('settingsTabTheme') !== -1, 'the strip still has its Theme tab');
  ok(strip !== null && strip.indexOf('settingsTabMore') !== -1, 'and every other tab after it');
  // Nine buttons before this release (Expand + the eight below), eight now.
  const tabButtons = count('class="tab" id="settingsTab');
  ok(tabButtons === 8, 'the strip is eight tabs, one fewer than before (' + tabButtons + ')');
  const fn = src.slice(src.indexOf('function showSettingsTab(tab){'), src.indexOf("$('settingsTabTheme').addEventListener"));
  ok(fn.indexOf("if(tab === 'expand') tab = 'theme';") !== -1, 'the redirect is inside showSettingsTab');
  ok(fn.indexOf("$('settingsPaneTheme').style.display") !== -1, 'which still shows the Theme pane');

  // No settings pane a script reaches for is missing from the markup.
  const refs = new Set();
  for (const m of src.matchAll(/\$\('(settingsPane[A-Za-z0-9_]*)'\)/g)) refs.add(m[1]);
  const missing = [...refs].filter((id) => src.indexOf('id="' + id + '"') === -1);
  ok(missing.length === 0, 'every settings pane a script reaches for exists' + (missing.length ? ': ' + missing.join(', ') : ''));
  ok(refs.size >= 6, 'and that guard really looked at the panes (' + refs.size + ')');
}

console.log('[5] inline script syntax');
{
  const blocks = src.match(/<script[^>]*>([\s\S]*?)<\/script>/g) || [];
  let bad = 0, seen = 0;
  blocks.forEach((bl) => {
    const body = bl.replace(/<\/?script[^>]*>/gi, '');
    if (!body.trim()) return;
    seen++;
    try { acorn.parse(body, { ecmaVersion: 2022, sourceType: 'script' }); }
    catch (e) { bad++; console.log('  syntax error: ' + e.message); }
  });
  ok(bad === 0, 'inline script syntax failures: ' + bad + ' (' + seen + ' blocks)');
}

console.log('');
console.log(fail ? `${pass} passed, ${fail} FAILED` : `All ${pass} checks passed`);
process.exit(fail ? 1 : 0);
