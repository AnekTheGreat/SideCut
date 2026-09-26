#!/usr/bin/env node
// SideCut -- the two reported defects:
//
//   1. "there shouldn't be a play button in singles when you click on a song"
//   2. "I'm still missing one album cover" -- Album History: "Ishq Da Uda Ada"
//      (2003-02-09, Diljit) still blank while every other row now has art.
//
// MEASURED, not guessed (all live, Sep 26 2026):
//
//   [1] No renderer emits a play button any more -- patch-634 removed the last
//       one -- so the ▶ in the report is coming out of the POPUP CACHE, which
//       survives an app update. A snapshot written by an older build holds a
//       `<div class="dp-track-play" data-play="0-0" ...>▶</div>` on every row,
//       and there were three readers of those snapshots, only ONE of which
//       stripped it:
//         * loadCachedDiscoverPopup()  -- stripped (since patch-634)
//         * cachedArtistGroups()       -- did NOT; its groups are carried into a
//                                         fresh Singles list as kept.html
//         * the Singles button's cached-open branch in siBtn.onclick, which
//           hands the saved body straight to openDiscoverPopup() -- did NOT.
//       Worse, openDiscoverPopup() WRITES the cache from the body it was handed,
//       so that branch re-saved the ▶ it had just served: the button was
//       immortal until the cache expired. One stripper now runs at every one of
//       those points, plus at the choke point inside openDiscoverPopup() itself,
//       so no reader can pass one through and a stale snapshot heals as it opens.
//
//   [2] The MusicBrainz fallback asked:
//           releasegroup:"Ishq Da Uda Ada" AND artist:"Diljit Dosanjh"
//       which returns count 0 -- verified against the live API. The release
//       group exists (d1999b8d-fb08-387f-b3ec-64fa14b81a97, 2003-02-09, credited
//       to "Diljit"), and the title-only query finds it; the AND artist clause
//       kills the whole search, because MusicBrainz's index does not match the
//       group's credit against the string "Diljit Dosanjh". Apple and Deezer
//       carry no record of this album at all (both return zero results, checked
//       live), so MusicBrainz is the only source it has -- and that query was
//       the reason this is the one row that stays blank. The query now searches
//       by title alone; the artist identity check stays in the loop, so a
//       same-titled release group by a stranger is still refused.
//
//   node dev/patch-637.mjs
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (label) => console.log('= ' + label + ' (already applied)');
const done = (label) => { console.log('\u2022 ' + label); edits++; };

function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ---------------------------------------------------------------------------
// 1. One stripper, in the first script block (where cachedArtistGroups lives)
//    and exported on window, because the popup itself -- openDiscoverPopup and
//    loadCachedDiscoverPopup -- is in the SECOND top-level script block and can
//    only reach it through window. That is the same wiring __scKeptArtistGroups
//    and __ahResolveArtworks already use.
//
//    It is deliberately scope-agnostic: it matches a <div> or a <span>, with any
//    attributes before or after the class, because the button that was emitted
//    was `<div class="dp-track-play" data-play="0-0" style="…">▶</div>` and the
//    only guard that existed before patch-634 matched a <span> with the class
//    first.
// ---------------------------------------------------------------------------
const HELPER = [
  '  // No popup row carries a \u25b6 any more -- album tracks, Singles and Old songs are all',
  '  // tap targets. A snapshot saved by an older build still holds one per row, and the',
  '  // popup cache is re-saved from whatever body it was opened with, so an unstripped',
  '  // reader kept that button alive across opens and app updates alike. This is the one',
  '  // stripper: every reader, the popup itself, and the cache write all go through it.',
  '  function scStripPopupPlayButtons(html){',
  '    try{',
  '      if(html && String(html).indexOf(\'dp-track-play\') !== -1){',
  '        return String(html).replace(/<(?:span|div)[^>]*class="dp-track-play"[\\s\\S]*?<\\/(?:span|div)>/g, \'\');',
  '      }',
  '    }catch(_eSPB){}',
  '    return html;',
  '  }',
  '  window.__scStripPopupPlayButtons = scStripPopupPlayButtons;',
  '',
].join('\n');

sub('the popup-play-button stripper is defined once and exported',
  [
    '  // Groups from the saved snapshot, keyed by artist name. A pinned artist that',
    '  // comes back empty keeps the group it already had, so a partial or blocked',
    '  // fetch can never delete singles the user already had.',
    '  function cachedArtistGroups(title){',
  ].join('\n'),
  HELPER +
  [
    '  // Groups from the saved snapshot, keyed by artist name. A pinned artist that',
    '  // comes back empty keeps the group it already had, so a partial or blocked',
    '  // fetch can never delete singles the user already had.',
    '  function cachedArtistGroups(title){',
  ].join('\n'),
  undefined, '  window.__scStripPopupPlayButtons = scStripPopupPlayButtons;');

// ---------------------------------------------------------------------------
// 2. cachedArtistGroups() lifts whole artist groups out of a saved body and
//    hands them on as outerHTML, so a ▶ inside one came back even in a FRESH
//    Singles list. Strip the body before it is parsed.
// ---------------------------------------------------------------------------
sub('groups lifted from a saved snapshot are stripped before they are re-used',
  [
    '      var d = JSON.parse(raw);',
    '      if(!d || !d.body) return map;',
    '      var tmp = document.createElement(\'div\');',
  ].join('\n'),
  [
    '      var d = JSON.parse(raw);',
    '      if(!d || !d.body) return map;',
    '      // The group HTML below is re-used inside a freshly built Singles list,',
    '      // so the saved rows are cleaned here as well as where they are rendered.',
    '      if(typeof window.__scStripPopupPlayButtons === \'function\'){',
    '        try{ d.body = window.__scStripPopupPlayButtons(d.body) || d.body; }catch(_eSPBg){}',
    '      }',
    '      var tmp = document.createElement(\'div\');',
  ].join('\n'),
  undefined, 'd.body = window.__scStripPopupPlayButtons(d.body) || d.body;');

// ---------------------------------------------------------------------------
// 3. The choke point. Every popup body goes through here -- a fresh render, a
//    reopen from the cache, the kept groups carried into a refetch -- and the
//    cache is written from this same variable further down, so cleaning it here
//    also stops a stale snapshot from being re-saved and serving itself again.
// ---------------------------------------------------------------------------
sub('openDiscoverPopup strips on the way in, and so on the way to the cache',
  [
    'function openDiscoverPopup(title, bodyHTML, subtitle){',
    '  var ov = document.getElementById(\'discPopupOverlay\');',
  ].join('\n'),
  [
    'function openDiscoverPopup(title, bodyHTML, subtitle){',
    '  // The single choke point every popup body travels through. The cache below is',
    '  // written from this same body, so a list saved by an older build is cleaned as',
    '  // it opens instead of being re-saved with its play buttons and served again.',
    '  if(typeof window.__scStripPopupPlayButtons === \'function\'){',
    '    try{ bodyHTML = window.__scStripPopupPlayButtons(bodyHTML) || \'\'; }catch(_eSPBo){}',
    '  }',
    '  var ov = document.getElementById(\'discPopupOverlay\');',
  ].join('\n'),
  undefined, 'try{ bodyHTML = window.__scStripPopupPlayButtons(bodyHTML) || \'\'; }catch(_eSPBo){}');

// ---------------------------------------------------------------------------
// 4. loadCachedDiscoverPopup had its own copy of the regex (patch-634). It now
//    calls the shared stripper, so the two cannot drift apart again.
// ---------------------------------------------------------------------------
const LOADER_OLD = String.raw`      if(d.body.indexOf('dp-track-play') !== -1){
        d.body = d.body.replace(/<(?:span|div)[^>]*class="dp-track-play"[\s\S]*?<\/(?:span|div)>/g, '');
      }`;

sub('the cached-popup loader uses the same stripper as everything else',
  LOADER_OLD,
  String.raw`      // Through the shared helper, not a second copy of the regex, so the two readings
      // can never drift apart again.
      d.body = window.__scStripPopupPlayButtons(d.body) || d.body;`,
  undefined, '      d.body = window.__scStripPopupPlayButtons(d.body) || d.body;');

// ---------------------------------------------------------------------------
// 5. The MusicBrainz release-group query. Title only -- the artist identity
//    check that follows it in the loop is what keeps a stranger's cover out.
// ---------------------------------------------------------------------------
// (Transition only: the first run of this patch wrote a longer version of that
// same comment. Both forms collapse to the single line above.)
sub('stale snapshots are read through the shared stripper',
  ['      // Stripped on the way in by the shared helper, so a snapshot from an older',
   '      // build opens without a play button -- and openDiscoverPopup strips too, so',
   '      // neither the render nor the re-saved cache can carry one either.',
   "      d.body = window.__scStripPopupPlayButtons(d.body) || d.body;"].join('\n'),
  ['      // Through the shared helper, not a second copy of the regex, so the two readings',
   '      // can never drift apart again.',
   "      d.body = window.__scStripPopupPlayButtons(d.body) || d.body;"].join('\n'),
  undefined, '      // Through the shared helper, not a second copy of the regex, so the two readings');

// ---------------------------------------------------------------------------
sub('the MusicBrainz release-group query is no longer killed by an artist clause',
  [
    '        var _mr = await fetchWithProxy(\'https://musicbrainz.org/ws/2/release-group?query=\' +',
    '          encodeURIComponent(\'releasegroup:"\' + album + \'" AND artist:"\' + artist + \'"\') + \'&fmt=json&limit=5\',',
  ].join('\n'),
  [
    '        // Title only. "Ishq Da Uda Ada" by Diljit Dosanjh is the album this was',
    '        // reported for: Apple and Deezer carry no record of it at all (both',
    '        // checked live, both empty), and MusicBrainz\'s release group is filed',
    '        // under the credit "Diljit", which `AND artist:"Diljit Dosanjh"` does not',
    '        // match -- the clause made the whole query return nothing, so that one',
    '        // row could never be found. The artist check that follows in the loop is',
    '        // what refuses a same-titled release group by somebody else.',
    '        var _mr = await fetchWithProxy(\'https://musicbrainz.org/ws/2/release-group?query=\' +',
    '          encodeURIComponent(\'releasegroup:"\' + album + \'"\') + \'&fmt=json&limit=10\',',
  ].join('\n'),
  undefined, 'encodeURIComponent(\'releasegroup:"\' + album + \'"\')');

fs.writeFileSync(FILE, src);
console.log('\n' + edits + ' edit' + (edits === 1 ? '' : 's') + ' applied to index.html');
