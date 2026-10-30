#!/usr/bin/env node
// 80.6.13 - what must be true of the page: a shelf that scrolls, playlists that
// keep their songs, and a play path that names the step that refused.
//
//   node dev/check-80613.cjs
const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let pass = 0;
const bad = [];
function ok(cond, msg) { if (cond) { pass++; } else { bad.push(msg); } }

// --- the version and its entry -------------------------------------------
ok(page.includes("const APP_VERSION = '80.6.13';"), 'the page runs 80.6.13');
ok(page.includes("version: '80.6.13'"), 'the changelog records 80.6.13');
ok(!page.includes("const APP_VERSION = '80.6.12';"), 'the previous version string is gone');
const _e0 = page.indexOf("version: '80.6.13'");
const entry = page.slice(_e0, page.indexOf("version: '", _e0 + 20));
ok((entry.match(/\[FULL\] /g) || []).length === 3, 'all three items are this build\'s own');
ok(!/full build|full apk|full web/i.test(entry), 'the entry never names the other build');

// --- the shelf is the scroll area ----------------------------------------
ok(page.includes("'#scStreamBlock.scShelfOpen{display:block;flex:1 1 auto;min-height:0;overflow-y:auto;'"),
  'the shelf owns the scroll when it is up');
ok(page.includes("'overscroll-behavior:contain;-webkit-overflow-scrolling:touch;'"),
  'and it scrolls with momentum, contained');
ok(page.includes("'padding:2px 0 calc(var(--list-bottom-inset, 96px) + var(--sc-dock-h, 0px) + env(safe-area-inset-bottom))}'"),
  'and its last row clears the dock');
ok(!page.includes('max-height:230px'), 'no result list scrolls in a box of its own');
ok(page.includes("'#library.scShelfOn #tabs{display:none}'"), 'the library\'s own filter tabs stand down while Streaming is up');
ok(page.includes("if(view){ if(on) view.classList.add('scShelfOn'); else view.classList.remove('scShelfOn'); }"),
  'one function still owns which page is up');

// --- the rail is a tab bar ------------------------------------------------
ok(page.includes("'#scShelfRail.scShelfRailOn{display:flex;gap:6px;"), 'the rail has an on state');
ok(page.includes("'#scShelfRail .scshelf-tab{flex:1 1 0;min-width:0;height:40px;"),
  'its three tabs are equal, and tall enough to hit');
ok(page.includes("rail.className = 'scShelfRailOn';"), 'the rail turns itself on when it is built');
ok(page.includes("aria-pressed=\"' + (on ? 'true' : 'false') + '\""), 'a tab says whether it is the one');

// --- playlists keep whole songs -----------------------------------------
ok(page.includes('function scStreamPlItem(t){'), 'a playlist item is a song');
ok(page.includes('function scStreamRestore(tracks, playlists){'), 'the old shape is migrated on load');
ok(page.includes('function scStreamOpenPlaylist(name){'), 'a playlist opens as a page');
ok(page.includes('id="scStreamPlBack"'), 'and it has a way back');
ok(page.includes('function scStreamPlDrop(name, id){'), 'a song can leave a playlist without leaving the shelf');
ok(page.includes("concat([{ name: name, items: [] }])"), 'a new playlist is created with items, not ids');
ok(!page.includes('p.ids || []'), 'no id-only playlist shape is left in the renderer');

// --- the play path ------------------------------------------------------
const src = page.slice(page.indexOf('function scStreamSource(info){'), page.indexOf('  // --- the audio element'));
ok(src.includes('var wasCancel = !!window.__scCancelDl;'), 'a stopped download is remembered, not obeyed');
ok(src.includes('window.__scCancelDl = false;'), 'and the stream is not read past it');
ok(src.includes('restore();'), 'and the flag is put back on every path');
ok(page.includes('scStreamState.size = Number(r.size) || 0;'), 'the resolver keeps the stream\'s real length');
ok(page.includes('scStreamSource({ url: u, mime: scStreamState.mime, size: scStreamState.size })'),
  'and hands it to the reader');
ok(page.includes('function scStreamReason(){'), 'a refusal can name the step');
ok(page.includes("'Could not read the song (' + scStreamReason()"), 'and it is shown');
ok(page.includes('scStreamState.fixes = (scStreamState.fixes || 0) + 1;'), 'one repair per song, not a loop');
ok(page.includes("if(!a.src){ scStreamPlay(scStreamState.curId); return; }"),
  'the play button starts a song that never loaded');

// --- the pure functions, run --------------------------------------------
function grab(name) {
  const key = '\n  function ' + name + '(';
  const at = page.indexOf(key);
  if (at === -1) throw new Error('missing function ' + name);
  const start = at + 1;
  const end = page.indexOf('\n  }\n', start);
  if (end === -1) throw new Error('unterminated function ' + name);
  return page.slice(start, end + 4);
}
let P = null;
try {
  const code = ['scStreamPlItem', 'scStreamPlItems', 'scStreamRestore', 'scStreamPlAdd', 'scStreamPlRemove']
    .map(grab).join('\n');
  P = new Function(code + '\nreturn { scStreamPlItem, scStreamPlItems, scStreamRestore, scStreamPlAdd, scStreamPlRemove };')();
} catch (e) {
  bad.push('the playlist functions could not be loaded: ' + e.message);
}

if (P) {
  const track = { id: 's_a', videoId: 'aaaaaaaaaaa', title: 'Aujla Szn', artist: 'Karan Aujla', dur: 194, thumb: 'https://i.ytimg.com/vi/aaaaaaaaaaa/hq.jpg' };
  const other = { id: 's_b', videoId: 'bbbbbbbbbbb', title: 'Straight Up', artist: 'Karan Aujla', dur: 201, thumb: 'https://i.ytimg.com/vi/bbbbbbbbbbb/hq.jpg' };

  // A new playlist keeps the whole song.
  const one = P.scStreamPlAdd([], 'Punjabi', track);
  ok(one.length === 1 && one[0].items.length === 1, 'adding makes a playlist with the song in it');
  const kept = one[0].items[0];
  ok(kept.title === 'Aujla Szn' && kept.artist === 'Karan Aujla' && kept.dur === 194 && kept.thumb.indexOf('i.ytimg.com') !== -1,
    'the playlist keeps title, artist, length and cover');
  ok(kept.videoId === 'aaaaaaaaaaa', 'and the video it plays from');

  // Adding twice is a no-op; a second song appends.
  const twice = P.scStreamPlAdd(one, 'Punjabi', track);
  ok(twice[0].items.length === 1, 'the same song twice is still one song');
  const both = P.scStreamPlAdd(twice, 'Punjabi', other);
  ok(both[0].items.length === 2 && both[0].items[1].title === 'Straight Up', 'a second song is added behind it');

  // The shape every earlier release saved: ids alone, with the tracks elsewhere.
  const legacy = P.scStreamRestore([track, other], [{ name: 'Punjabi', ids: ['s_a', 's_b'] }]);
  ok(legacy.length === 1 && legacy[0].items.length === 2, 'an id-only playlist still opens');
  ok(legacy[0].items[0].title === 'Aujla Szn' && legacy[0].items[1].artist === 'Karan Aujla',
    'and its songs get their metadata back from the shelf');
  ok(legacy[0].items[0].thumb === track.thumb, 'including the cover');

  // A song the shelf has lost is still named by its playlist, and comes back.
  const orphan = P.scStreamRestore([], [{ name: 'Punjabi', items: [{ id: 's_a', videoId: 'aaaaaaaaaaa', title: 'Aujla Szn', artist: 'Karan Aujla', dur: 194, thumb: '' }] }]);
  ok(orphan[0].items.length === 1 && orphan[0].items[0].title === 'Aujla Szn',
    'a playlist keeps a song the shelf no longer lists');

  // Removing one song leaves the other; removing the last leaves no empty playlist.
  const minus = P.scStreamPlRemove(both, 'Punjabi', 's_a');
  ok(minus[0].items.length === 1 && minus[0].items[0].id === 's_b', 'removing one song keeps the rest');
  const gone = P.scStreamPlRemove(minus, 'Punjabi', 's_b');
  ok(gone.length === 0, 'an emptied playlist does not linger');

  // An id-only entry with no track anywhere is not a row of blanks.
  const dead = P.scStreamRestore([], [{ name: 'Old', ids: ['s_zzz'] }]);
  ok(dead[0].items.length === 0, 'an id nobody can resolve is dropped, not drawn blank');
}

// --- the regular channel is held ----------------------------------------
const hold = JSON.parse(fs.readFileSync(path.join(ROOT, 'dev/channel-hold.json'), 'utf8'));
ok(hold.play === true, 'the regular channel is held');
const playBundle = fs.readFileSync(path.join(ROOT, 'dev/ota-bundle-play.mjs'), 'utf8');
ok(playBundle.includes("channel-hold.json"), 'the play bundler reads the hold');
ok(playBundle.includes('the channel is HELD at v'), 'and --check reports the hold instead of failing');
ok(fs.existsSync(path.join(ROOT, 'ota-play/update.zip')), 'the bundle a regular install has is still there');

console.log('\ncheck-80613: ' + pass + ' passed, ' + bad.length + ' failed');
bad.forEach((b) => console.log('  x ' + b));
process.exit(bad.length ? 1 : 0);
