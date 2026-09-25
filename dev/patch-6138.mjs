#!/usr/bin/env node
// v61.3.8 — "For not that well known artists such as Bikramjit Dhaliwal the
// lyrics aren't correct for their songs."
//
// What was actually happening. LRCLIB has NOTHING for Bikramjit Dhaliwal
// (api/search?q=Bikramjit%20Dhaliwal → []), Apple Music and Deezer have nothing
// either, so every lyrics path that needs the artist misses. What runs next is
// the title-only LRCLIB search, which for a common Punjabi title returns 20
// same-titled songs by OTHER artists (Gabhru, Dil, Yaar, Pind, Shehar …). The
// matcher accepted any of them whose running time was within ±2s of the local
// file — a length is not an identity — and that stranger's words were saved on
// the track. Measured against the real API, a common title has a 13-31% chance
// of a stranger falling inside that window, so "the lyrics aren't correct for
// their songs" is exactly this. Two loose ends of the same bug are closed too:
// textyl (Apple Music) answers with timestamps and no title at all and was
// accepted blind, and lyrist's reply was never compared to the request.
//
// The fix, in the shared resolver only (the sheet, the batch fetch and the
// candidate picker all read it):
//   1. A length-only match now also has to be the EXACT title, and the
//      candidate's credit must not contradict ours. An imprint ("T-Series",
//      "Saregama Music", "Speed Records") is not a contradiction — it says
//      nothing about who sings — so an odd tag still can't hide a real hit.
//   2. textyl's own clock is the check: a lyric sheet whose last line lands
//      after the file has ended belongs to a longer song, so it is refused.
//   3. lyrist's title/artist are validated instead of trusted.
//   4. The empty state explains itself ("Found 1 same-titled song under a
//      different artist — skipped"), the picker marks a stranger, and the
//      Manual button is reachable when nothing was found — the way out for a
//      song no database has.
//
// Run: node dev/patch-6138.mjs              # index.html + sw.js + tests + manifests
//      node dev/patch-6138.mjs --manifest   # re-seed root manifest.json only
//                                           # (run after dev/ota-bundle.mjs)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const VER = '61.3.8';
const PREV = '61.3.7';
const MANIFEST_ONLY = process.argv.includes('--manifest');

const devDir = path.join(ROOT, 'dev');
let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
let pinned = 0;

const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('• ' + label); edits++; };

// Replace `oldStr` with `newStr`. Idempotent: if the finished text is already
// in the file the edit is skipped, and any other count than `want` throws so a
// half-applied file is never written.
function sub(label, oldStr, newStr, want = 1) {
  if (newStr !== '' && src.indexOf(newStr) !== -1) return skip(label);
  if (newStr === '' && src.indexOf(oldStr) === -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (got !== want) throw new Error(label + ': expected ' + want + ' match(es), found ' + got);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// The same, for a small file outside index.html (count-checked, idempotent).
function subFile(rel, label, oldStr, newStr, want = 1) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  if (t.indexOf(newStr) !== -1 && t.indexOf(oldStr) === -1) return skip(rel + ': ' + label);
  const got = t.split(oldStr).length - 1;
  if (got !== want) throw new Error(rel + ' ' + label + ': expected ' + want + ', found ' + got);
  t = t.split(oldStr).join(newStr);
  fs.writeFileSync(p, t);
  console.log('• ' + rel + ': ' + label);
  pinned++;
}

if (!MANIFEST_ONLY) {

// ---------------------------------------------------------------------------
// [1] the artist-identity check
// ---------------------------------------------------------------------------

sub('the imprint/identity helpers',
  `  function scLyricsArtistTokens(artist){
    return String(artist || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  }`,
  `  function scLyricsArtistTokens(artist){
    return String(artist || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  }
  // Imprints and channels, not people. A credit like "T-Series", "Saregama
  // Music" or "Speed Records" is where a file was uploaded, not who sang it, so
  // it can neither confirm nor contradict an artist: it is ignored as evidence.
  // Without this, an imprint credit would read as "a different artist" and an
  // odd tag would start hiding songs that really are yours.
  var SC_LYRICS_IMPRINT_TOKENS = { records:1, record:1, music:1, musics:1, series:1, label:1, labels:1,
    entertainment:1, studio:1, studios:1, official:1, topic:1, company:1, media:1, digital:1, audio:1,
    video:1, videos:1, films:1, film:1, productions:1, production:1, tseries:1, saregama:1, shemaroo:1,
    tips:1, speed:1, zee:1, sony:1, universal:1, warner:1, columbia:1, atlantic:1, interscope:1,
    capitol:1, virgin:1, island:1, decca:1, polydor:1, rhymes:1, cinematic:1 };
  function scLyricsLooksLikeImprint(artist){
    var toks = scLyricsArtistTokens(artist);
    if(!toks.length) return true;                     // nothing to learn either way
    var words = 0;
    for(var i = 0; i < toks.length; i++){
      if(toks[i].length < 2) continue;                // the "t" of "T-Series"
      words++;
      if(!SC_LYRICS_IMPRINT_TOKENS[toks[i]]) return false;
    }
    return words > 0;                                 // every word of it is an imprint word
  }
  // Do a candidate's credit and ours belong to the same artist? 'match' when a
  // name word lines up, 'foreign' when both sides are real artist credits and
  // nothing lines up, 'unknown' when there is nothing to learn (a missing or
  // imprint-only credit on either side). Only 'foreign' blocks a length-only
  // match — two different people with a shared title and a coincidentally equal
  // running time are not the same song, and an obscure artist's only "hits" are
  // exactly that.
  function scLyricsArtistVerdict(candArtist, artistTokens){
    var cand = String(candArtist || '');
    if(!cand.trim()) return 'unknown';
    if(scLyricsLooksLikeImprint(cand)) return 'unknown';
    var ours = (artistTokens || []).filter(function(w){
      return w.length >= 3 && !SC_LYRICS_STOPWORDS[w] && !SC_LYRICS_IMPRINT_TOKENS[w];
    });
    if(!ours.length) return 'unknown';                // our tag is a label, a channel or blank
    var theirs = scLyricsArtistTokens(cand);
    for(var i = 0; i < theirs.length; i++){
      var t = theirs[i];
      if(t.length < 3 || SC_LYRICS_STOPWORDS[t]) continue;
      for(var j = 0; j < ours.length; j++){
        var o = ours[j];
        if(t === o) return 'match';
        // Transliteration drift ("Gurdas"/"Gurdaas") is the same person, so a
        // long shared prefix has to count as agreement rather than a stranger.
        var pre = 0, n = Math.min(t.length, o.length);
        while(pre < n && t.charAt(pre) === o.charAt(pre)) pre++;
        if(pre >= 5 && n >= 5) return 'match';
      }
    }
    return 'foreign';
  }`);

sub('scLyricsRank: the rule is written down where it runs',
  `  // Title has to line up; then a recognisable artist OR a tight length match has to
  // confirm it. A loose title match with an unconfirmed length is refused — that is
  // how a same-titled song by someone else ends up as "your" lyrics.`,
  `  // Title has to line up; then a recognisable artist OR a tight length match has to
  // confirm it. A loose title match with an unconfirmed length is refused — that is
  // how a same-titled song by someone else ends up as "your" lyrics.
  // 61.3.8 — and a length is not an identity either. "Bikramjit Dhaliwal" is in
  // none of these databases, so every entry under one of his titles belongs to
  // somebody else; a stranger's track that merely ran within ±2s of the local
  // file used to be handed over (and saved) as his lyrics. A length-only match
  // now also has to be the exact title AND a credit that does not contradict
  // ours — an imprint says nothing either way, so it is not a contradiction.`);

sub('scLyricsRank: a length-only match needs the exact title and a credit that agrees',
  `    return {
      tScore: tScore,
      aHit: aHit,
      dScore: dScore,
      duration: rd,
      acceptable: !!(aHit || dScore >= 2),`,
  `    var verdict = scLyricsArtistVerdict(res.artistName, artistTokens);
    var exactTitle = !!(rKey && titleKey && rKey === titleKey);
    return {
      tScore: tScore,
      aHit: aHit,
      dScore: dScore,
      duration: rd,
      verdict: verdict,
      exactTitle: exactTitle,
      acceptable: !!(aHit || (dScore >= 2 && exactTitle && verdict !== 'foreign')),`);

// ---------------------------------------------------------------------------
// [2] what the empty state is allowed to explain
// ---------------------------------------------------------------------------

sub('the refused-stranger counter',
  `  var scLyricsDeadline = 0;`,
  `  var scLyricsDeadline = 0;
  // How many same-titled songs by a different artist this lookup refused. The
  // empty state reads it back, so "no lyrics found" can say what was skipped
  // instead of leaving a mystery.
  var scLyricsStrangers = 0;`);

sub('consider(): count the strangers it refuses',
  `    var dur = Math.round(duration || 0);
    var best = null;
    function consider(res){
      var sc = scScoreLyricsResult(res, titleKey, primaryTokens, dur);
      if(sc && (!best || sc.score > best.score)) best = sc;
      return sc;
    }`,
  `    var dur = Math.round(duration || 0);
    var best = null;
    scLyricsStrangers = 0;
    function consider(res){
      var sc = scScoreLyricsResult(res, titleKey, primaryTokens, dur);
      if(sc && (!best || sc.score > best.score)) best = sc;
      if(!sc){
        // Refused. When it was refused for being someone else's song, say so
        // later rather than pretending nothing was there.
        var rk = scLyricsRank(res, titleKey, primaryTokens, dur);
        if(rk && rk.verdict === 'foreign' && rk.dScore >= 2) scLyricsStrangers++;
      }
      return sc;
    }`);

sub('a manual search starts its own count',
  `  async function scListLyricsCandidates(artistRaw, titleRaw, duration){
    scLyricsDeadline = Date.now() + 12000;`,
  `  async function scListLyricsCandidates(artistRaw, titleRaw, duration){
    scLyricsDeadline = Date.now() + 12000;
    scLyricsStrangers = 0;                            // a manual search explains itself`);

sub('fetchLyrics: a new song starts with no leftover explanation',
  `    var _staleLyricsPicker = document.getElementById('lyricsCandidatePicker');
    if(_staleLyricsPicker) _staleLyricsPicker.remove();`,
  `    var _staleLyricsPicker = document.getElementById('lyricsCandidatePicker');
    if(_staleLyricsPicker) _staleLyricsPicker.remove();
    var _staleWhy = document.getElementById('lyricsNotFoundWhy');
    if(_staleWhy){ _staleWhy.style.display = 'none'; _staleWhy.textContent = ''; }`);

sub('the sheet says what was skipped',
  `      if(what){
        var t = String(title || '').trim(), a = String(artist || '').trim();`,
  `      // A refused match is a real answer, not a failure: name what was skipped
      // so "no lyrics" never reads as "the app is broken".
      try{
        var why = document.getElementById('lyricsNotFoundWhy');
        if(why){
          why.style.display = scLyricsStrangers ? 'block' : 'none';
          why.textContent = scLyricsStrangers
            ? ('Found ' + scLyricsStrangers + ' same-titled song' + (scLyricsStrangers === 1 ? '' : 's') +
               ' under a different artist \\u2014 skipped, not served as this track\\'s.')
            : '';
        }
      }catch(_eWhy){}
      // Manual lyrics are the way out for a song no database has, so the button
      // has to be reachable from this state too — it used to appear only once
      // lyrics had already been found.
      try{
        var mBtnNF = $('lyricsManualBtn');
        if(mBtnNF && mBtnNF.style.display === 'none'){
          mBtnNF.style.display = '';
          mBtnNF.textContent = 'Manual: ' + (lyricsManualActive ? 'On' : 'Off');
        }
      }catch(_eMbnf){}
      if(what){
        var t = String(title || '').trim(), a = String(artist || '').trim();`);

// ---------------------------------------------------------------------------
// [3] the two providers that were trusted blind
// ---------------------------------------------------------------------------

sub('textyl: a sheet that outlives the file is another song',
  `              if(_tyText.trim().length > 20){
                return { lyrics: _tyText, isSynced: true, title: titleVars[0], artist: primary,
                         duration: dur, source: 'textyl (Apple Music)', score: 1 };
              }`,
  `              // textyl answers with a timestamp per line and nothing else, so
              // the one honest check available is its own clock: a lyric sheet
              // whose last line lands after the file has already ended was
              // written for a longer song — a different track. Refuse it rather
              // than dress someone else's words up as this song's.
              var _tyLast = 0;
              for(var _tli = 0; _tli < _tyLines.length; _tli++){
                var _tls = Number(_tyLines[_tli].seconds) || 0;
                if(_tls > _tyLast) _tyLast = _tls;
              }
              var _tyFits = !(dur > 0 && _tyLast > dur + 8);
              if(_tyText.trim().length > 20 && _tyFits){
                return { lyrics: _tyText, isSynced: true, title: titleVars[0], artist: primary,
                         duration: dur, source: 'textyl (Apple Music)', score: 1 };
              }`);

sub('lyrist: the reply has to be this song',
  `          var lyd = await lyr.json();
          if(lyd && lyd.lyrics && String(lyd.lyrics).trim()){`,
  `          var lyd = await lyr.json();
          // It has to be THIS song. lyrist hands back the title and artist it
          // matched and neither was ever looked at, so any body of lyrics that
          // came back for the query was served as the track's. The title has to
          // line up, and an artist in the reply must not contradict the credit
          // we asked with.
          var _lyrTitle = String((lyd && lyd.title) || titleVars[lv] || '');
          var _lyrArtist = String((lyd && lyd.artist) || '');
          var _lyrArtistOk = !_lyrArtist
            || _textOk(_lyrTitle, _lyrArtist)
            || scLyricsArtistVerdict(_lyrArtist, scLyricsArtistTokens(artistVars[la])) !== 'foreign';
          if(lyd && lyd.lyrics && String(lyd.lyrics).trim() && _textOk(_lyrTitle, '') && _lyrArtistOk){`);

// ---------------------------------------------------------------------------
// [4] a hand-picked candidate says what it is
// ---------------------------------------------------------------------------

sub('the picker marks a stranger',
  `      out.push({ title: res.trackName || '', artist: res.artistName || '', duration: Number(res.duration) || 0,
                 synced: !!res.syncedLyrics, lyrics: res.syncedLyrics || res.plainLyrics,`,
  `      out.push({ title: res.trackName || '', artist: res.artistName || '', duration: Number(res.duration) || 0,
                 synced: !!res.syncedLyrics, lyrics: res.syncedLyrics || res.plainLyrics,
                 // So picking one by hand can never be mistaken for a credit
                 // that agrees with this track's artist.
                 differentArtist: rk.verdict === 'foreign',`);

sub('the picker row shows it',
  `          sub.textContent = (c.artist || 'unknown artist') +`,
  `          sub.textContent = (c.artist || 'unknown artist') +
            (c.differentArtist ? ' \\u00b7 different artist' : '') +`);

// ---------------------------------------------------------------------------
// [5] the empty state, in words
// ---------------------------------------------------------------------------

sub('the empty state offers the manual way and explains the skip',
  `        <div style="font-size:11.5px;">Tap <b>↻ Refetch</b> to search by hand — the artist and title there are editable.</div>
        <div style="font-size:12px;">Lyrics could not be found. Lyrics APIs primarily support English/Western music.</div>`,
  `        <div id="lyricsNotFoundWhy" style="display:none; font-size:11.5px; color:var(--ink); margin-bottom:6px; line-height:1.5;"></div>
        <div style="font-size:11.5px;">Tap <b>↻ Refetch</b> to search by hand — the artist and title there are editable. Or tap <b>Manual</b> and paste the words in yourself: they save with the song.</div>
        <div style="font-size:12px;">A song is filed under its artist, and a same-titled track by someone else is never served as yours — so a small, new or regional artist can simply have no lyrics online yet.</div>`);

// ---------------------------------------------------------------------------
// [6] version + changelog head
// ---------------------------------------------------------------------------

sub('APP_VERSION -> ' + VER,
  `  const APP_VERSION = '${PREV}';`,
  `  const APP_VERSION = '${VER}';`);

const ITEMS = [
  'For a small or regional artist the lyrics came back as somebody else\u2019s song: a title search turns up same-titled tracks by entirely different artists, and any of them that happened to run within a couple of seconds of your file was accepted on its length alone and saved onto the track. A length is not an identity any more \u2014 the title has to be the exact one and the credit must not contradict yours, so Bikramjit Dhaliwal\u2019s songs keep his words instead of borrowing Karan Aujla\u2019s.',
  '\"No lyrics found\" now explains itself: it names how many same-titled songs under a different artist were skipped, and the Manual button is reachable from there, so you can paste the words in yourself and they save with the song.',
  'The Refetch picker marks a same-titled entry credited to a different artist, so choosing one by hand is a decision instead of a guess.',
  'A lyric sheet that runs past the end of your file is refused as another song\u2019s \u2014 Apple Music\u2019s textyl answers with timestamps and no title at all, so its own clock is what catches a wrong match \u2014 and the lyrist reply is now checked against the title and artist that were asked for instead of being taken on trust.',
  'A credit that is really an imprint (T-Series, Saregama Music, Speed Records) neither confirms nor contradicts an artist, so an odd tag still can\u2019t hide a song that is genuinely yours.',
];
const NEW_ENTRY =
  `  { version: '${VER}', date: 'September 24, 2026 · 7:00 PM EDT', title: 'Your lyrics stay yours on a small artist', items: [\n` +
  ITEMS.map((it) => `    '${it.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}',\n`).join('') +
  `  ] },\n`;

const headAnchor = `  const CHANGELOG = [\n  { version: '${PREV}', date: `;
if (src.indexOf(`const CHANGELOG = [\n  { version: '${VER}'`) !== -1) {
  skip('changelog head entry is ' + VER);
} else {
  if (src.indexOf(headAnchor) === -1) throw new Error('CHANGELOG head anchor missing');
  src = src.replace(headAnchor, `  const CHANGELOG = [\n` + NEW_ENTRY + `  { version: '${PREV}', date: `);
  done('changelog head entry added (' + VER + ')');
}

fs.writeFileSync(FILE, src);
console.log('• index.html written — ' + edits + ' edit(s)');

// ------------------------------------------------------------------ sw.js
subFile('sw.js', 'CACHE_NAME -> v' + VER,
  `const CACHE_NAME = 'sidecut-shell-v${PREV}';`,
  `const CACHE_NAME = 'sidecut-shell-v${VER}';`);

// ------------------------------------------------- test-6137's own head pins
// That file asserts the newest entry heads CHANGELOG, so it has to move with
// it — the generic repin below only touches version pins.
subFile('dev/test-6137.mjs', 'its own head assertions move to ' + VER,
  `  ok(count("version: '61.3.7'") === 1, 'exactly one 61.3.7 changelog entry');`,
  `  ok(count("version: '61.3.8'") === 1, 'exactly one 61.3.8 changelog entry');`);
subFile('dev/test-6137.mjs', 'the newest-entry regex moves to ' + VER,
  `/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.7'/`,
  `/const CHANGELOG = \\[\\n  \\{ version: '61\\.3\\.8'/`);
subFile('dev/test-6137.mjs', 'the 61.3.7 head-ordering pin moves to ' + VER,
  `src.indexOf("version: '61.3.7'") < src.indexOf("version: '61.3.6'"), '61.3.7 heads the changelog'`,
  `src.indexOf("version: '61.3.8'") < src.indexOf("version: '61.3.6'"), '61.3.8 heads the changelog'`);

// --------------------------------------------------------------- test pins
for (const f of fs.readdirSync(devDir)) {
  if (!/^test-.*\.mjs$/.test(f)) continue;
  const p = path.join(devDir, f);
  const t0 = fs.readFileSync(p, 'utf8');
  const t1 = t0
    .split(`ver === '${PREV}'`).join(`ver === '${VER}'`)
    .split(`sidecut-shell-v${PREV}`).join(`sidecut-shell-v${VER}`)
    .split(`"version: '${PREV}'"`).join(`"version: '${VER}'"`)
    .split(`CHANGELOG head entry is ${PREV}`).join(`CHANGELOG head entry is ${VER}`);
  if (t1 !== t0) { fs.writeFileSync(p, t1); pinned++; console.log('• repinned dev/' + f); }
}
// A re-run repins nothing (they are already at VER) — what must never happen is
// a test file left behind on the old pin.
const stale = fs.readdirSync(devDir)
  .filter((f) => /^test-.*\.mjs$/.test(f))
  .filter((f) => fs.readFileSync(path.join(devDir, f), 'utf8').includes(`ver === '${PREV}'`));
if (stale.length) throw new Error('test files still pinned to ' + PREV + ': ' + stale.join(', '));

} else {
  console.log('= manifest-only run — index.html untouched');
}

// ------------------------------------------------- changelog head (read back)
function changelogHead() {
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  if (!block) throw new Error('could not read the CHANGELOG block');
  const entries = eval('[' + block[1] + ']');
  const e = entries.find((x) => String(x.version) === VER);
  if (!e) throw new Error('no ' + VER + ' changelog entry found');
  return e;
}
const head = changelogHead();

{
  // test-6052 pins the head date by exact equality; keep it in step.
  const p = path.join(devDir, 'test-6052.mjs');
  const t = fs.readFileSync(p, 'utf8');
  const re = /ok\(entries\[0\]\.date === '[^']*', 'ship date correct \(' \+ entries\[0\]\.date \+ '\)'\);/;
  const m = t.match(re);
  if (!m) throw new Error('test-6052.mjs: date pin not found');
  if (m[0].indexOf(head.date) === -1) {
    fs.writeFileSync(p, t.replace(re, `ok(entries[0].date === '${head.date}', 'ship date correct (' + entries[0].date + ')');`));
    console.log('• dev/test-6052.mjs ship date → ' + head.date);
  } else {
    skip('dev/test-6052.mjs ship date is ' + head.date);
  }
}

// ------------------------------------------------------ root manifest.json
// The very first manifest location, kept current so no client left pointing at
// it is ever told about an older version. Size is read from the published
// bundle, so re-run with --manifest after `node dev/ota-bundle.mjs`.
{
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota', 'updates.json'), 'utf8'));
  const notes = (head.items || [])
    .map((it) => (typeof it === 'string' && it.indexOf('[FULL] ') === 0) ? it.slice(7) : it)
    .slice(0, 6);
  const man = { version: VER, url: 'update.zip', size: upd.size, notes, date: String(head.date || '') };
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(man, null, 2) + '\n');
  console.log('• root manifest.json → ' + VER + ' · ' + upd.size + ' bytes · ' + notes.length + ' notes');
}

console.log('patch-6138: ' + edits + ' index.html edit(s), ' + pinned + ' file(s) repinned');
