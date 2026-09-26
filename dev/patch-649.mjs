#!/usr/bin/env node
// Removes personal data from the in-app patch notes (CHANGELOG in index.html):
// the reporter's library size, and the specific artists / albums / songs that
// were named while describing the defects. Each entry keeps its meaning; only
// the identifying specifics are generalised. Idempotent: a rerun reports 0
// edits. Run from the repo root: node dev/patch-649.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

// [ marker (unique substring of the line to replace), replacement line (whole line, with indentation) ]
const EDITS = [
  // ---- 63.0.9 : the reporter's library size ----
  [
    `so a phone with 454 songs pulled 2.99 GB`,
    `    'Opening SideCut read every song out of the database in full, because each song was stored inside the same record as its name and artist — so every launch pulled the entire library\u2019s audio through memory before Home appeared. That is what the four seconds were. Songs are now stored so the record holds a reference to the audio, and the audio itself is read only when that song is actually played.',`,
  ],
  // ---- 63.0.6 : the named album + artist ----
  [
    `Ishq Da Uda Ada\u201d, 2003-02-09, by Diljit`,
    `    'The cover that was still blank is there. It was the one row left, because Apple\u2019s store has no entry for that album at all and Deezer has none either — both were asked live and both answered with nothing — which left MusicBrainz as the only place a picture could come from. It had the album, credited to that artist, and the Cover Art Archive served its front cover. That is what the row shows now.',`,
  ],
  [
    `MusicBrainz files that album under`,
    `    'The reason it had never been found is how MusicBrainz was being asked. The request demanded the release group by title and by artist together, and MusicBrainz files that album under a shorter form of the artist\u2019s name rather than the full credit — so the artist half matched nothing, and the whole search came back empty. Not the wrong cover: no cover, every single time, however often it was tried. It is asked by title alone now.',`,
  ],
  // ---- 63.0.5 : named albums + a named song/artist in the lyrics note ----
  [
    `and \u201cIshq Da Uda Ada\u201d by Diljit Dosanjh have no album entry`,
    `    'The covers nothing had a picture for show up now. The albums in question have no entry in Apple\u2019s store at all — in the US storefront or the Indian one — so the one place that looked for artwork had nothing it could ever find. The lookup now asks Deezer, which carries that catalogue, and then MusicBrainz\u2019s release group, whose front cover the Cover Art Archive serves; all three were checked live against those exact albums. Only a cover matching both the artist and the album is used — a same-titled album by someone else is refused, because a stranger\u2019s cover is worse than a blank. And it runs at last: that lookup had exactly one caller, and it fired once while the app was still starting up, when the album list did not exist yet — so it had never run over a real row, and an album stored without artwork could only stay blank for good. It now runs every time the list is drawn, a fresh one or one reopened from its saved copy, and a cover it finds is remembered.',`,
  ],
  [
    `LIFESTYLE\u201d was answered with twenty`,
    `    'Lyrics can no longer be somebody else\u2019s. A song was accepted when its title matched exactly and its length was within two seconds even when the artist was a stranger — which is how one song was answered with twenty matches headed by famous names that had nothing to do with it. An entry filed under a real other artist is refused and counted instead, and when nothing is left the panel says no lyrics were found for that artist and that song, naming how many same-titled songs by other artists were skipped. The hand-search box still lists what it finds — that is what you asked it for — but a stranger is removed from that list too, so it can never be a menu of other people\u2019s songs.',`,
  ],
  // ---- 62 : short stage name ----
  [
    `a stage name like "BK". The check that decides whether a lyric`,
    `    'Lyrics could go missing for an artist whose name is only a letter or two — a very short stage name. The check that decides whether a lyric entry really belongs to the artist skipped every name of two letters or fewer, so such a name could never confirm anything, and the song had to match on running time alone: any release whose length drifted by more than two seconds came back as having no lyrics even though the words were on file.',`,
  ],
  // ---- 61.8 : co-credited track + named song/artist ----
  [
    `half of a credit like "BK, Arsh Heer"`,
    `    'A track credited to two artists could come back with nothing even when the right source had been found: the check that decides whether a source really belongs to the artist skipped every name of two letters or fewer, so the short half of a two-artist credit was never looked at at all. On a track whose correct upload sits on the shorter-named artist\u2019s own channel, every co-credited track ended in "no matching source" while the solo tracks went through.',`,
  ],
  [
    `Nothing else was loosened. A longer credit is judged`,
    `    'Nothing else was loosened. A longer credit is judged exactly as before, a source that belongs to none of the credited artists is still refused, and a solo short name with nothing to compare it against still passes — so no track that already worked can start failing.',`,
  ],
  // ---- 61.7 : named EP ----
  [
    `AUJLA SZN 1 EP dropped`,
    `    'A brand-new release is missing from the lyrics databases for a day or two — they are community-run and file a song after it comes out, not with it. On the day a new EP dropped, none of its five tracks had a single entry anywhere SideCut can read, so no matcher could have found them. What was actually wrong is that nothing ever asked again: a song that came back empty stayed empty until the lyrics sheet was opened by hand and caught up. SideCut now quietly re-checks the songs that are still waiting, a few at a time and hours apart, so the words turn up on their own.',`,
  ],
  // ---- 61.5 : named artists ----
  [
    `Bikramjit Dhaliwal\u2019s songs keep his words`,
    `    'For a small or regional artist the lyrics came back as somebody else\u2019s song: a title search turns up same-titled tracks by entirely different artists, and any of them that happened to run within a couple of seconds of your file was accepted on its length alone and saved onto the track. A length is not an identity any more — the title has to be the exact one and the credit must not contradict yours, so a small artist\u2019s songs keep their own words instead of borrowing a bigger name\u2019s.',`,
  ],
  // ---- 60.1.3 : named artists ----
  [
    `The file-name cleaner stripped commas`,
    `    'Artists are comma-separated everywhere. The file-name cleaner stripped commas, so a converted "First Artist, Second Artist" became "First Artist Second Artist" and the library filed that as ONE artist. Commas survive now, so the file name, the saved tag and the library row all read "First Artist, Second Artist" — and a credit written "A & B", "A x B" or "A feat. B" is normalized to "A, B" on the way in, on imports too',`,
  ],
  [
    `credits are Diljit Dosanjh, Sia and David Guetta`,
    `    'Every credited artist is used, not just the first. A Spotify track with several credited artists came out as the first one only; the whole credit list is read now',`,
  ],
  // ---- 60.1.2 : named artist/song in the file-name example ----
  [
    `01 - Diljit Dosanjh - Dealer.mp3" on purpose`,
    `    'A leading track number is no longer read as the artist. Conversions are named with a leading number on purpose, and importing one used to file the song under artist "01" with the artist stuck on the front of the title \u2014 the number is dropped before the artist/title split now, for every file you add, converted or not',`,
  ],
  // ---- 60.1.1 : named song + named channels/artists ----
  [
    `the 140 stream of "Dealer" answers 403`,
    `    'Music tracks fall back to the video stream. YouTube caps the audio-only stream of a music upload at its first megabyte (measured: the audio-only stream of a music upload answers 403 past ~1 MB while the same video\u2019s progressive audio + video stream, itag 18, delivered all 11,317,380 bytes in 11 chunks). The small audio streams are still tried first — they are better quality and they are all an ordinary video needs — and that progressive copy sits behind them, so the album converts instead of coming back empty. It is a bigger download (roughly 10-12 MB per track), which is the price of no longer needing a token YouTube will not hand out',`,
  ],
  [
    `Live, the SUKHA channel sat behind`,
    `    'Buried uploads are found again. The three searches behind a conversion were merged by putting the quoted search\u2019s results in FRONT, which pushed the artist\u2019s own upload behind re-uploads of the same title \u2014 and only the first few candidates get verified, so a correct source could exist and never be reached. Live, the artist\u2019s own channel sat behind several re-upload and bass-boost channels. The merged list is ranked by the score each candidate carries now, a multi-artist credit scores its own channel, and a few more candidates are checked before giving up',`,
  ],
  [
    `A credit like "Sukha, Chani" or`,
    `    'Multi-artist credits verify. A credit naming two artists was required to appear word-for-word in the one uploader name, which no single channel can satisfy \u2014 that is why an album by a co-credited artist searched, found its own official upload and then discarded it. Each credited artist is checked on its own, and the source still has to belong to one of them, so a cover by an unrelated channel is rejected exactly as before',`,
  ],
  // ---- 60.0.9 : named single/artists ----
  [
    `Missing singles are found.`,
    `    'Missing singles are found. The Singles search only ever asked Apple\u2019s default (US) store, and a release that is not in that catalogue cannot come back at any limit \u2014 a new single by a co-credited artist is exactly that case: the US query returns nothing for it, while the same query in the Indian store returns it near the top. That is why no filter tuning could ever find it',`,
  ],
  [
    `Measured live: Diljit Dosanjh 41`,
    `    'The same search is now asked of both stores and merged, with one identical filter and dedupe, so it cannot become the flood the old release-list union caused. Measured live on a handful of artists: singles counts rose where the release already existed in the Indian store and stayed flat where it did not',`,
  ],
  // ---- 60.0.4 : named playlist ----
  [
    `cut "Punjabi Gaane" off mid-word`,
    `    'A name that is genuinely too long is the only one that still gives way. The back-to-top arrow shares its row with the playlist tabs and used to hold its slot even while invisible, which is what cut a long playlist tab name off mid-word. While the arrow is hidden the tabs get the entire row, and the tab you are on is always scrolled fully into view',`,
  ],
  [
    `CRUISE CONTROL`,
    `    'When nothing is found the sheet says so and names what it searched for, so a wrong artist tag is obvious and one tap on \u21bb Refetch fixes it',`,
  ],
  // ---- 56.1 : named-artist example ----
  [
    `      "Create your own albums: hold a song → Select multiple songs → choose Create album,or use the ⋮ menu → Create album — name it,and the songs group under your album. By-artist+album sort now shows your albums first, then singles below each artist (e.g. Diljit albums,`,
    `      "Create your own albums: hold a song → Select multiple songs → choose Create album,or use the ⋮ menu → Create album — name it,and the songs group under your album. By-artist+album sort now shows your albums first, then singles below each artist.",`,
  ],
  // ---- 50.1.1 / 50.0.2 : named artists ----
  [
    `polluting results for BK, Shubh`,
    `      'Deezer/MusicBrainz now require exact artist name match — prevents wrong artists polluting results for short artist names',`,
  ],
  [
    `short artist names like "BK"`,
    `      'Removed unsafe fallbacks that were grabbing wrong lyrics for short artist names'`,
  ],
  // ---- 49.5.8 / 49.5.7 / 49.5.5 / 49.5.4 : named albums/artist ----
  [
    `originals (Ishq Da Uda Ada, Dil, Smile)`,
    `      'Album History now also pulls from MusicBrainz — the community-run music database — so albums that Apple and Deezer simply don\\'t stock finally appear. An artist\\'s early originals that neither store carries show up with their full track lists, marked with a small "MusicBrainz" tag',`,
  ],
  [
    `"Dil" from 2008`,
    `      'Album History now also pulls from Deezer when an artist\\'s Apple catalog hits its limit — albums Apple simply doesn\\'t stock now appear, marked with a small "Deezer" tag',`,
  ],
  [
    `early albums that live under his composers`,
    `      'Album History finds albums where the artist is credited on the SONGS but not the album itself — a common catalogue quirk credits the music director on the album, so neither the discography lookup nor the album search could ever surface them (an artist\\'s early albums that live under their composers\\' names now appear)',`,
  ],
  [
    `"Over Exposure" from 2005`,
    `      'Album History now also checks other countries\\' iTunes stores when an artist\\'s catalog is big enough to hit the entry limit — older albums that are only licensed abroad were invisible to the default store and now show up',`,
  ],
];

let src = fs.readFileSync(FILE, 'utf8');
const lines = src.split('\n');

let applied = 0, skipped = 0;
const problems = [];
for (const [marker, replacement] of EDITS) {
  const idxs = [];
  for (let i = 0; i < lines.length; i++) if (lines[i].includes(marker)) idxs.push(i);
  if (idxs.length === 0) {
    if (lines.includes(replacement)) { skipped++; continue; }
    problems.push(`marker not found and not already applied: ${marker.slice(0, 60)}`);
    continue;
  }
  if (idxs.length > 1) { problems.push(`marker matched ${idxs.length} lines: ${marker.slice(0, 60)}`); continue; }
  if (lines[idxs[0]] === replacement) { skipped++; continue; }
  lines[idxs[0]] = replacement;
  applied++;
}

if (problems.length) {
  console.error('PATCH ABORTED — no file written:');
  for (const p of problems) console.error('  • ' + p);
  process.exit(1);
}

const out = lines.join('\n');
if (out !== src) fs.writeFileSync(FILE, out);
console.log(`patch-649: ${applied} edits applied, ${skipped} already done, 0 problems`);
