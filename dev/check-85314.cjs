// 85.3.14 harness - the functions that ship, sliced out of index.html and run in a vm.
//
// The owner's report: "it has to display the whole video and the correct fucking video with
// the song that I'm on not some random ahh other video by the same artist go in order of the
// album or playlist its in". Two faults in one sentence, and both were in scVideoRank: the
// list of search results was put in order by LENGTH and CREDIT, and nothing in it asked the
// one question that decides the film - does this title name this track? A different song by
// the same artist, of a similar length, on the artist's own channel, outranked the song's own
// upload. And a teaser or a short of the right song was a candidate with no penalty at all,
// because a clip is still "the song" to a length comparison.
//
// So:
//   * a title that does not name the track is not this song's video - it is dropped, not
//     demoted, and the cover with one honest line is what is left if nothing names it;
//   * a clip that runs well under the song is not the film - a full-length upload is what
//     the tab opens, and nothing at all beats a thirty-second teaser;
//   * the album the song is on is handed to the search and credited in the result order, so
//     the album cut is what is picked when the same track exists twice.
//
// Nothing here is a copy of the shipped code: scVideoRank and its title helpers are cut out
// of the page by name and braces and run in a vm against fake results.
//
//   node dev/check-85314.cjs
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
function constLine(name) {
  const m = page.match(new RegExp('^\\s*var ' + name + ' = [^\\n]+$', 'm'));
  if (!m) throw new Error('missing constant ' + name);
  return m[0];
}
function exec(src, sandbox, expose, filename) {
  sandbox.window = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(src + '\n;globalThis.__unit = {' + (expose || []).join(', ') + '};', sandbox, { filename: filename || 'unit.js' });
  return sandbox.__unit;
}

const rankSrc = [
  constLine('SC_VQ_FULL_SHARE'),
  grab('scVideoTitleWords'), grab('scVideoAllWords'), grab('scVideoHasWords'),
  grab('scVideoWordsName'), grab('scVideoTitleNames'), grab('scVideoRank')
].join('\n');

// The shipped rank, the shipped title matcher, a song length and nothing else.
function rank(list, t, songDur) {
  const sandbox = {
    console, Number, Math, String, Array, Object, isFinite,
    scVideoAudioEl() { return songDur === undefined ? { duration: 0 } : { duration: songDur }; }
  };
  const U = exec(rankSrc, sandbox, ['scVideoRank', 'scVideoTitleNames'], 'video-rank-85314.js');
  rank.U = U;
  return U.scVideoRank(list, t);
}
function ids(list) { return (list || []).map(function (c) { return c.videoId; }).join(','); }

const song = { title: 'Song', artist: 'Artist', album: 'Record' };

// =============================================================================
console.log('\n1. A different song by the same artist is never the film');
// =============================================================================
{
  // THE REPORT: same artist, same length, the artist's own channel - and a different song.
  const other = { videoId: 'other', title: 'Artist - Different Tune (Official Video)', owner: 'Artist', duration: 209 };
  const right = { videoId: 'right', title: 'Artist - Song (Official Video)', owner: 'Artist', duration: 209 };
  ok('another track by the artist does not take the screen from this song', ids(rank([other, right], song, 210)) === 'right', ids(rank([other, right], song, 210)));
  ok('and it is not played when it is all the search returned', rank([other], song, 210).length === 0, ids(rank([other], song, 210)));
  ok('the same length is not an identity: the title is what decides',
    rank([{ videoId: 'o', title: 'Artist - Different Tune', owner: 'Artist', duration: 210 }], song, 210).length === 0);
  ok('an artist-only channel name earns nothing for a different song',
    rank([{ videoId: 'o', title: 'Different Tune', owner: 'Artist - Topic', duration: 210 }], song, 210).length === 0);
  ok('a live take of THIS song is still this song, only demoted',
    rank([{ videoId: 'l', title: 'Artist - Song (Live)', owner: 'Artist', duration: 214 },
          { videoId: 'r', title: 'Artist - Song (Official Video)', owner: 'Artist', duration: 210 }], song, 210)[0].videoId === 'r');
}
{
  // The titles that DO name the track, in the shapes uploads really use.
  const shapes = [
    'Artist - Song (Official Video)',
    'Artist \u2013 Song',
    'Artist - Song (Official Music Video) 4K',
    'Song',
    'Artist - Song (feat. Guest) [Official Video]',
    'Song (Lyrics)',
    'Artist - Song | Record'
  ];
  for (let i = 0; i < shapes.length; i++) {
    const got = rank([{ videoId: 'x', title: shapes[i], owner: 'Artist', duration: 210 }], song, 210);
    ok('the title "' + shapes[i] + '" names this song', got.length === 1, got.length);
  }
}
{
  ok('Song 2 is not Song', rank([{ videoId: 's2', title: 'Artist - Song 2', owner: 'Artist', duration: 210 }], song, 210).length === 0);
  ok('Song is not Song 2', rank([{ videoId: 's', title: 'Artist - Song', owner: 'Artist', duration: 100 }], { title: 'Song 2', artist: 'Artist' }, 100).length === 0);
  ok('a title with no song to check against is not filtered',
    rank([{ videoId: 'a', title: 'Whatever - Thing', owner: '', duration: 100 }], { title: '', artist: 'Artist' }, 100).length === 1);
  ok('the matcher reads words, not letters: a title of nothing but tags does not match',
    rank.U.scVideoTitleNames('(Official Video)', 'Song') === false, 'matched');
}

// =============================================================================
console.log('\n2. The whole film, not a teaser');
// =============================================================================
{
  const full = { videoId: 'full', title: 'Artist - Song (Official Video)', owner: 'Artist', duration: 209 };
  const teaser = { videoId: 'teaser', title: 'Artist - Song (Teaser)', owner: 'Artist', duration: 40 };
  const short = { videoId: 'short', title: 'Artist - Song', owner: 'Artist', duration: 60 };
  ok('a forty-second teaser is not the video', rank([teaser], song, 208).length === 0, ids(rank([teaser], song, 208)));
  ok('a clip of half the song is not the video', rank([short], song, 220).length === 0, ids(rank([short], song, 220)));
  ok('the full upload is what opens when both are on the list', ids(rank([teaser, full], song, 208)) === 'full', ids(rank([teaser, full], song, 208)));
  ok('and a full upload first on the list is still first', ids(rank([full, teaser], song, 208)) === 'full', ids(rank([full, teaser], song, 208)));
  const long = { videoId: 'long', title: 'Artist - Song', owner: 'Artist', duration: 400 };
  ok('a film that runs away from the song is used only when nothing nearer exists',
    ids(rank([long, full], song, 210)) === 'full' && rank([long], song, 210).length === 1, ids(rank([long, full], song, 210)));
  ok('with no known song length a short clip is not guessed at', rank([short], song, 0).length === 1, ids(rank([short], song, 0)));
  ok('the clip line is a constant, not a number in the body', /var SC_VQ_FULL_SHARE = [\d.]+;/.test(page));
}

// =============================================================================
console.log('\n3. The album the song is in');
// =============================================================================
{
  const single = { videoId: 'single', title: 'Artist - Song (Official Video)', owner: 'Artist', duration: 209 };
  const album = { videoId: 'album', title: 'Artist - Song (Record) (Official Video)', owner: 'Artist', duration: 209 };
  ok('the album cut is preferred when the title carries the album',
    rank([single, album], song, 209)[0].videoId === 'album', ids(rank([single, album], song, 209)));
  ok('with no album named, the list order is kept', ids(rank([single, album], { title: 'Song', artist: 'Artist' }, 209)) === 'single,album');
  ok('the search is told which album the song is on',
    /scYtSearch\(q, \(t && t\.artist\) \|\| '', \(t && t\.album\) \|\| ''\)/.test(page));
  ok('the track carries its album and its length for that search',
    /album: String\(st\.album \|\| ''\), dur: Number\(st\.dur\) \|\| 0/.test(page) &&
    /album: String\(f\.album \|\| ''\), dur: Number\(f\.duration\) \|\| 0/.test(page));
  ok('more of the result list is ranked than the eight it used to be', /scVideoRank\(cands\.slice\(0, 12\), t\)/.test(page));
}

// =============================================================================
console.log('\n4. A film that is not this song is not offered');
// =============================================================================
{
  const src = grab('scVideoRank');
  ok('a wrong title is filtered out of the list', /return !r\.wrong/.test(src));
  ok('a teaser is filtered out of the list', /return !r\.clip/.test(src) && !/if\(fullRows\.length\) namedRows = fullRows;/.test(src));
  ok('a different recording is still dropped', /return !r\.far/.test(src));
  ok('the title is read before the row is scored', src.indexOf('scVideoTitleNames(') < src.indexOf('otherTake.test('));
}

// =============================================================================
console.log('\n5. The release itself');
// =============================================================================
{
  const re = /<script[^>]*>([\s\S]*?)<\/script>/g;
  let m, scripts = 0, bad = 0;
  while ((m = re.exec(page))) { scripts++; try { new Function(m[1]); } catch (e) { bad++; console.log('    ' + e.message); } }
  ok('every inline script parses (' + scripts + ' scripts)', bad === 0, bad + ' failures');
}
const vPage = (page.match(/const APP_VERSION = '([^']+)'/) || [])[1];
ok('the page is on 85.3.14 or newer', /^85\.3\.\d+$/.test(vPage) && Number(vPage.split('.')[2]) >= 14, vPage);
ok('the shell cache is on the same version', sw.includes('sidecut-shell-v' + vPage), vPage);
ok('the notes carry the 85.3.14 entry', page.includes("version: '85.3.14'"));
ok('the new entry is above 85.3.13', page.indexOf("version: '85.3.14'") < page.indexOf("version: '85.3.13'"));
{
  const entry = page.slice(page.indexOf("version: '85.3.14'"), page.indexOf("version: '85.3.13'"));
  ok('the new entry avoids the words the Play channel filters',
    !/(streaming|streams?\b|from the source|pinned artist)/i.test(entry), entry.slice(0, 120));
}

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
