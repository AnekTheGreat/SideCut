#!/usr/bin/env node
/**
 * SideCut 72.4 - a song taken from a Spotify link is named by the link.
 *
 * The owner's report: a brand-new single comes back as "no matching source",
 * the already-downloaded songs carry no metadata, and "HOW IS IT GETTING THE
 * ARTIST WRONG IN ALBUMS AND IN GETTING A SONG". All three are the same reader.
 *
 * A single-track Spotify link resolves like this:
 *   scSpOembed(url)      -> the track's NAME and its cover (the track oEmbed
 *                           carries no artist at all)
 *   scSpEmbedTrack(url)  -> the ARTIST, read from the embed page's __NEXT_DATA__
 *   scEnrichSingleMeta() -> whatever the first two left blank, from iTunes
 *
 * Three things were wrong with that chain, and every one of them ends in a
 * wrong or missing name:
 *
 *   1. scSpOembed was the ONE reader of open.spotify.com that never used the
 *      device network. It called the page itself and then three public relays.
 *      On Android the page request gets no answer (Spotify sends no
 *      cross-origin permission) and the relays are a browser-only fallback -
 *      the app's own comment says they "go quiet for days". So the title and
 *      the cover of a fresh track arrived EMPTY, and a plan with no title is no
 *      plan: the link looked like it held nothing. The two embed readers
 *      already go native first for exactly this reason; this one now does too.
 *
 *   2. scEnrichSingleMeta accepted the first iTunes result for the TITLE ALONE
 *      whenever the link had no artist - which is the whole case of a brand-new
 *      single whose embed was not readable, i.e. exactly when metadata is
 *      scarce. scDeezerArtistOk answers true on an empty hint ("nothing to
 *      judge on"), so result[0] was taken whatever it was. It is routinely a
 *      cover, a re-record, a karaoke cut or another performer's song with a
 *      similar name, and its artist, album, year, genre and cover were all
 *      borrowed: the tag, the file name and the library row named the wrong
 *      performer. The audio search was then built FROM that wrong name, which
 *      is how the right song answered "no matching source". The name must
 *      agree first now, and when there is no artist to judge on it must be the
 *      same name rather than a name that merely contains it. Nothing is
 *      borrowed when nothing agrees - a blank is better than a lie.
 *
 *   3. A one-track release is filed by every one of these catalogs as
 *      "<Song> - Single". That wrapper was copied into the album the song was
 *      tagged with and the album the search asked for. 72.3 already strips it
 *      for the release lists (scSingleTitle); the same rule now applies to a
 *      plan, so the album field is the song on every surface.
 *
 * The audio query is assembled from the parts the link actually named, so an
 * unknown artist no longer runs the title and the album together.
 *
 * Nothing about the player, the queue, the library or an already saved song
 * changes: this release only decides what a NEW song is named after.
 *
 *   node dev/patch-724.mjs
 *   node dev/patch-724.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.4';
const STAMP = 'October 2, 2026 \\u00b7 3:10 PM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.3';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'A song from a Spotify link is named by the link';
const NOTES = [
  'A Spotify link now fills the song with the name the link itself carries, and a catalog lookup can no longer answer for a different performer whose title merely looks similar.',
  'A song whose performer the link does not name stays unnamed rather than being given someone else, so the tag, the file name and the library row all agree on what the song is.',
  'A one-track release is tagged with the song as its album. The "<Song> - Single" wrapper these catalogs file it under is dropped, so the album field reads the same on every surface.',
  'The link reading reaches the network through the device itself, the way every other lookup in the app already does, so a song that exists is found on a phone where the page request never gets an answer.',
  'A short link is read the same way, so a brand-new release is not left empty just because its page has not been picked up by the public relays yet.',
  'A song already in your library keeps its name, its artist and its artwork. Nothing is re-tagged, and no song is replaced or removed.',
  'Nothing in the player, the dock or the queue moved. What plays, what is next and what the lock screen shows are exactly as they were.',
  'Songs you already saved sound the same, because only the names a new song is filed under are read differently.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ if(process.env.SC_DEBUG) console.log('  already: ' + label); already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-724: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ============================================================================
   1. THE LINK READER USES THE DEVICE NETWORK
   ========================================================================== */
sub(html, 'the link reader tries the device network first',
  "  async function scSpOembed(url){\n" +
  "    var base = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(url) + '&format=json';\n" +
  "    var attempts = [\n",
  "  async function scSpOembed(url){\n" +
  "    var base = 'https://open.spotify.com/oembed?url=' + encodeURIComponent(url) + '&format=json';\n" +
  "    // 72.4 - this is the one reader of open.spotify.com that never used the\n" +
  "    // device network. It is also the only source of a single-track link's\n" +
  "    // NAME and cover, because the track oEmbed carries no artist at all. A\n" +
  "    // plain page fetch gets no answer in the app (Spotify sends no\n" +
  "    // cross-origin permission) and the public relays below are a browser-only\n" +
  "    // fallback that goes quiet for days - so a link that had a name arrived\n" +
  "    // empty, and a plan with no title is no plan: the fresh release looked\n" +
  "    // like it held nothing. Native first, the same attempt shape the two\n" +
  "    // embed readers already use; the relays stay as the browser fallback.\n" +
  "    try{\n" +
  "      var _nResp = await __scNativeFetch(base);\n" +
  "      if(_nResp && _nResp.ok){ var _nj = await _nResp.json(); if(_nj && _nj.title) return _nj; }\n" +
  "    }catch(_ne){}\n" +
  "    var attempts = [\n");

/* ============================================================================
   2. A LOOK-ALIKE CANNOT NAME THE SONG
   ========================================================================== */
sub(html, 'only a hit for this very song may supply what the link left blank',
  "        for(var i = 0; i < ((it.results) || []).length && i < 3; i++){\n" +
  "          if(!scDeezerArtistOk(meta.artist, it.results[i].artistName)) continue;\n" +
  "          hit = it.results[i]; break;\n" +
  "        }\n",
  "        for(var i = 0; i < ((it.results) || []).length && i < 3; i++){\n" +
  "          // 72.4 - the hit has to BE this song. scDeezerArtistOk answers true\n" +
  "          // when the artist is unknown (nothing to judge on), so a link that\n" +
  "          // resolved without an artist - the whole of a brand-new single\n" +
  "          // whose embed was not readable - took the top result of a search\n" +
  "          // for the TITLE ALONE. That result is routinely a cover, a\n" +
  "          // re-record or a different performer's song with a similar name,\n" +
  "          // and every field it supplied was borrowed from it: the tag, the\n" +
  "          // file name and the library row named the wrong performer, and the\n" +
  "          // search for the audio was then built FROM that name, which is how\n" +
  "          // the right song came back as no matching source.\n" +
  "          if(!scAlbumTitleOk(it.results[i].trackName, meta.title)) continue;\n" +
  "          // With no artist on the link there is nothing else to judge on, so\n" +
  "          // the name must be the same name, not merely a name that contains\n" +
  "          // it. A blank is better than a lie.\n" +
  "          if(!meta.artist && scTrackTitleKey(it.results[i].trackName) !== scTrackTitleKey(meta.title)) continue;\n" +
  "          if(!scDeezerArtistOk(meta.artist, it.results[i].artistName)) continue;\n" +
  "          hit = it.results[i]; break;\n" +
  "        }\n");

/* ============================================================================
   3. A ONE-TRACK RELEASE IS ITS OWN ALBUM
   ========================================================================== */
sub(html, 'a plan can drop the filing wrapper from a release name',
  "  window.__scSingleTitle = scSingleTitle;\n",
  "  window.__scSingleTitle = scSingleTitle;\n" +
  "  // 72.4 - a one-track release is filed by every catalog as \"<Song> - Single\".\n" +
  "  // The song IS the release, so the wrapper is dropped from a plan's own name\n" +
  "  // and from the album each of its tracks would otherwise be tagged with - the\n" +
  "  // same rule the release lists already apply, applied to what a newly saved\n" +
  "  // song is named after.\n" +
  "  function scPlanDropSingleSuffix(plan){\n" +
  "    if(!plan) return plan;\n" +
  "    if(plan.title) plan.title = scSingleTitle(plan.title);\n" +
  "    if(plan.album) plan.album = scSingleTitle(plan.album);\n" +
  "    var _tr = plan.tracks || [];\n" +
  "    for(var _i = 0; _i < _tr.length; _i++){\n" +
  "      if(_tr[_i] && _tr[_i].album) _tr[_i].album = scSingleTitle(_tr[_i].album);\n" +
  "    }\n" +
  "    return plan;\n" +
  "  }\n");

sub(html, 'the embed plan names its release without the wrapper',
  "          var eName = String(embedEnt.name || embedEnt.title || '').trim();\n",
  "          var eName = scSingleTitle(String(embedEnt.name || embedEnt.title || '').trim());\n");

sub(html, 'the playlist fallback plan is filed without the wrapper',
  "            scAlbumResolveCache[url] = pl;\n",
  "            scAlbumResolveCache[url] = scPlanDropSingleSuffix(pl);\n");

sub(html, 'the album fallback plan is filed without the wrapper',
  "            scAlbumResolveCache[url] = ab;\n",
  "            scAlbumResolveCache[url] = scPlanDropSingleSuffix(ab);\n");

/* ============================================================================
   4. THE AUDIO QUERY IS BUILT FROM WHAT THE LINK NAMED
   ========================================================================== */
sub(html, 'an unnamed part leaves no blank in the search query',
  "    var query = ((title + ' ' + artist + ' ' + album).trim());\n",
  "    // 72.4 - a part the link did not name leaves no blank in the query. This\n" +
  "    // search alone decides what gets looked at, and an unknown artist used to\n" +
  "    // run the title and the album together.\n" +
  "    var query = [title, artist, album].filter(function(p){ return !!String(p || '').trim(); }).join(' ').trim();\n");

/* ============================================================================
   5. THIS RELEASE
   ========================================================================== */
sub(html, 'the release number',
  "  const APP_VERSION = '" + OLDVER + "';\n",
  "  const APP_VERSION = '" + VERSION + "';\n",
  { key: "const APP_VERSION = '" + VERSION + "';" });

const ENTRY = "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
  NOTES.map((n) => "    '" + n + "',\n").join('') +
  "  ] },\n";
sub(html, 'the changelog head entry',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + ENTRY,
  { key: "{ version: '" + VERSION + "'" });

sub(sw, 'the shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

if(!CHECK){
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-724: ' + applied + ' edit(s) applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
if(problems.length){
  console.error('\npatch-724: ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

// ---- verification ----------------------------------------------------------
if(!CHECK){
  const final = fs.readFileSync(IDX, 'utf8');
  const swFinal = fs.readFileSync(SW, 'utf8');
  const trouble = [];
  const must = (c, m) => { if(!c) trouble.push(m); };
  const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try{ entries = eval('[' + block[1] + ']'); }catch(e){}
  must(!!entries, 'the CHANGELOG array parses');
  if(entries){
    const head = entries[0];
    must(String(head.version) === VERSION, 'the head entry is v' + VERSION + ' (got ' + (head && head.version) + ')');
    must((head.items || []).length === NOTES.length, 'the head entry carries this release notes (' + (head.items || []).length + ')');
    must((head.items || []).length > 6, 'and a note past the six that ride to the store channel');
    must((head.items || []).every((it, i) => it === NOTES[i]), 'and they are the notes this script wrote');
    must(String(head.title || '') === TITLE, 'with its own title');
    must(!/\bpass\b/i.test(String(head.title)), 'and the title does not call itself a pass');
    must(!/\bdownload|converter|convert\b/i.test([head.title].concat(head.items || []).join('\n')),
      'the head entry carries no downloader wording');
    must(!/\bmp3\b/i.test([head.title].concat(head.items || []).join('\n')),
      'and nothing about encoding');
    must(/(studio|player|dock|premium|license)/i.test((head.items || []).join('\n')),
      'and it names a surface this app really has');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'nothing here is full-build-only');
    must((head.items || []).every((it) => it.indexOf("'") === -1), 'and no note carries an apostrophe');
    must(!!entries.find((e) => String(e.version) === '72.3'), 'the 72.3 entry is still in the changelog');
  }
  must(final.indexOf("const APP_VERSION = '" + VERSION + "';") !== -1, 'APP_VERSION is ' + VERSION);
  must(final.slice(-20).indexOf('</html>\n\n\n') !== -1, 'the bundle content keeps its settled size');
  must(swFinal.indexOf("const CACHE_NAME = '" + CACHE + "';") !== -1, 'the cache name is ' + CACHE);
  // The claims this release is about, checked in the shipped text.
  must(final.indexOf('var _nResp = await __scNativeFetch(base);') !== -1,
    'the link reader reaches the device network');
  must(final.indexOf('if(_nResp && _nResp.ok){ var _nj = await _nResp.json(); if(_nj && _nj.title) return _nj; }') !== -1,
    'and only accepts a real reply');
  must(count(final, 'await __scNativeFetch(base)') === 1,
    'the same way both embed readers already do');
  must(final.indexOf('if(!scAlbumTitleOk(it.results[i].trackName, meta.title)) continue;') !== -1,
    'a catalog hit must be this song');
  must(final.indexOf('if(!meta.artist && scTrackTitleKey(it.results[i].trackName) !== scTrackTitleKey(meta.title)) continue;') !== -1,
    'and with no artist it must be the same name');
  must(final.indexOf('function scPlanDropSingleSuffix(plan){') !== -1, 'a plan drops the filing wrapper');
  must(final.indexOf('var eName = scSingleTitle(String(embedEnt.name || embedEnt.title || \'\').trim());') !== -1,
    'the embed plan files its release by the song');
  must(count(final, 'scAlbumResolveCache[url] = scPlanDropSingleSuffix(') === 2,
    'and so do both fallback plans');
  must(final.indexOf("var query = [title, artist, album].filter(function(p){ return !!String(p || '').trim(); }).join(' ').trim();") !== -1,
    'the audio query carries no blank part');
  must(final.indexOf("var query = ((title + ' ' + artist + ' ' + album).trim());") === -1,
    'the old query builder is gone');
  if(trouble.length){
    console.error('\npatch-724: ' + trouble.length + ' verification failure(s):');
    trouble.forEach((t) => console.error('  - ' + t));
    process.exit(1);
  }
  console.log('patch-724: verified - APP_VERSION ' + VERSION + ', CACHE_NAME ' + CACHE);
}
