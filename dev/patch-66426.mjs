#!/usr/bin/env node
// SideCut - 64.2.6: the Favorites bubble stops blinking out, and the record tap
// moves only the list it belongs to.
//
// Two things were reported about 64.2.5:
//
//   "Why does me clicking on the record player in albums or playlists influence
//    the other it shouldnt scroll down in another place only in its place"
//   "the favorites bubble keeps disappearing fix these damn issues bro"
//
//   * THE REPAIR THAT COULD NEVER TAKE EFFECT. 64.2.5 replaced the blink and the
//     layer promotion with scRepaint(): write a fully transparent outline, then
//     clear it "on the next frame". That last part is where it came apart, and
//     it is why the bubble was still reported blank with the repair in place.
//
//     The repair is started by a TIMER - the debounce after a scroll settles -
//     and a timer task runs BEFORE the frame's rendering update. A
//     requestAnimationFrame callback scheduled from it therefore runs inside
//     that same update, and the browser then styles, lays out and paints once:
//     the write and the clear collapse into that single pass, so the one frame
//     that does get painted already carries NO outline, nothing is invalidated,
//     and the repair asks for a paint that never comes. On a phone that has
//     dropped the paint of a bubble there is then nothing to bring it back.
//
//     Clearing on the SECOND frame fixes exactly that: the first frame paints
//     WITH the outline - which is what invalidates the bubble and everything
//     under it - and the second takes it away again. The extra frame costs a
//     transparent outline, so nothing is visible, nothing moves, nothing is
//     measured and no layer is created or destroyed.
//
//   * THE GRID IS REBUILT FOR NO REASON. renderHome() is called by things that
//     have nothing to do with the grid - a play count ticking up, a metadata
//     read landing, the mini-play button settling - and every one of those threw
//     every bubble away and built them again. A rebuild that lands on a Home
//     that is already scrolled is the shape a WebView leaves half drawn: the new
//     nodes arrive with the scroller where it is, and a bubble is left holding
//     its space with nothing painted in it. Home is now left alone when the
//     markup it would build is the same as what is on the page (and the DOM
//     check still forces a rebuild when a bubble really is missing), and a
//     rebuild that DOES happen asks for its own paint instead of waiting for the
//     next settled scroll - which may never come.
//
//   * THE TWO LIBRARY HALVES SHARED ONE SCROLL POSITION. Playlists and Albums
//     render into the same #listPane, and renderListInner's "put the scroll back
//     where it was" restore never knew which half it was restoring. Leaving
//     Albums at album #30 and switching to Playlists put the playlists list at
//     that same offset, and the other way round - and because the record tap
//     renders the list before it glides, tapping the record visibly scrolled the
//     HALF THE USER WAS NOT IN before it moved the one they were. Each half now
//     keeps its own position (scLibScroll, kept current as you scroll), so a
//     half is put back where it was left and a jump through the record only ever
//     moves the half it is in.
//
//   node dev/patch-66426.mjs
//   node dev/patch-66426.mjs --manifest    # re-seed root manifest.json from ota/
//
// Idempotent: a rerun is a no-op.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILE = path.join(ROOT, 'index.html');
const MANIFEST_ONLY = process.argv.includes('--manifest');

// Static markup cannot carry a \uXXXX escape: it would be shown as those six
// characters. New HTML prose and new JS literals that need a glyph get the real
// character, built here so this script stays ASCII (see AGENTS.md).
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use
const ARROW = cp(0x2192);    // the arrow the settings paths are written with

const VER = '64.2.6';
const OLD_VER = '64.2.5';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 28, 2026 ' + DOT + ' 10:40 PM EDT';
const OLD_STAMP = 'September 28, 2026 ' + DOT + ' 10:05 PM EDT';
const SW_CACHE = '63.0.24';
const OLD_SW_CACHE = '63.0.23';

const TITLE = 'The Favorites bubble stops blinking out, and the record tap moves only the list it belongs to';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere), so no
// tooling wording: dev/test-617..620, -60510 and -662 read the WHOLE head entry
// for a downloader term, dev/test-6058 runs the shipped filter over it for the
// store channel, and dev/test-play-copy reads it against a wider list than
// either. The fourth note keeps the word "rollback" (dev/test-662).
const NOTES = [
  'The Favorites bubble on Home stops coming back blank. The repair could not work: it wrote and cleared its paint request inside one frame, so the phone merged both and asked for nothing. It now holds for a frame, which is what makes the bubble draw again.',
  'Home is only rebuilt when something on it really changed. The grid was thrown away by things that have nothing to do with it - a play count, a metadata read, the play button settling - and a rebuild on a scrolled Home is what leaves a bubble blank.',
  'Tapping the record on the now bar moves only the list you are looking at. Playlists and Albums share one list area, and the position of the half you were not in was carried into the one you tapped - that is the scroll you saw in the other place.',
  'Nothing in your library is touched. Same songs, playlists, covers and pinned artists, and no setting or saved rollback copy is changed by this update.',
  'The pinned artists island asks for its own paint the moment it is rebuilt instead of waiting for the next scroll to settle, and a bubble built into a scrolled Home does the same.',
  'This is 64.2.6 and not a rebuild of 64.2.5: a phone already on that version is offered it and installs it.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66426 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker === undefined ? newStr : marker;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the repair that never reached the phone
// ═══════════════════════════════════════════════════════════════════════════

sub('the section says which release shaped it',
  `  // ---- Asking a surface to draw itself again (64.2.5) ------------------------`,
  `  // ---- Asking a surface to draw itself again (64.2.6) ------------------------`,
  undefined, '(64.2.6) ------------------------');

sub('the paint request is held across a frame, not cleared inside one',
  `  // An outline is read by paint and by nothing else: it takes no space, it moves
  // nothing, and a fully transparent one draws no pixels. Writing one and putting
  // it back on the next frame tells the phone that this element, and everything
  // drawn under it, has to be painted again - with nothing hidden, nothing
  // measured and no layer created or destroyed on the way. That makes the repair
  // invisible and cheap enough to run on every settled scroll, which is the
  // trigger that actually repaired the fault.
  function scRepaint(el){
    if(!el || !el.style) return;
    try{
      el.style.outline = '1px solid transparent';
      requestAnimationFrame(function(){
        try{ el.style.outline = ''; }catch(_eRpBack){}
      });
    }catch(_eRp){}
  }`,
  `  // An outline is read by paint and by nothing else: it takes no space, it moves
  // nothing, and a fully transparent one draws no pixels. Writing one and putting
  // it back tells the phone that this element, and everything drawn under it, has
  // to be painted again - with nothing hidden, nothing measured and no layer
  // created or destroyed on the way.
  //
  // The take-back happens on the SECOND frame, and that is the whole of 64.2.6's
  // bubble fix. This repair is started by a TIMER (the debounce after a scroll
  // settles), and a timer task runs BEFORE the frame's rendering update - so a
  // requestAnimationFrame callback scheduled from it runs inside that SAME
  // update, after which the phone styles, lays out and paints once. Write and
  // clear then collapse into that single pass: the one frame that does get
  // painted already has no outline, nothing is invalidated, and the repair asks
  // for a paint that never comes. That is why a bubble could still come back
  // blank with 64.2.5's repair in place. Clearing a frame later guarantees one
  // painted frame carrying the invalidation, and the extra frame is a fully
  // transparent outline - still nothing anyone can see.
  function scRepaint(el){
    if(!el || !el.style) return;
    try{
      el.style.outline = '1px solid transparent';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          try{ el.style.outline = ''; }catch(_eRpBack){}
        });
      });
    }catch(_eRp){}
  }`,
  undefined, 'The take-back happens on the SECOND frame');

sub('the note above it counts the attempts honestly',
  `  // This is the fourth answer to the same report, and the first one that costs
  // nothing anywhere else. Each earlier attempt bought its repair somewhere a
  // user could see or feel it:`,
  `  // This is the fifth answer to the same report, and the first one that costs
  // nothing anywhere else. Each earlier attempt bought its repair somewhere a
  // user could see or feel it:`,
  undefined, 'This is the fifth answer to the same report');

sub('and it names the fourth attempt in the list',
  `  //     which is why the bubble still sometimes comes back blank.
  //
`,
  `  //     which is why the bubble still sometimes comes back blank;
  //   - and asking for the paint from inside one frame (64.2.5) asked for it in
  //     a frame that already had nothing to notice: the write and the take-back
  //     collapsed into the same paint, so nothing was ever invalidated at all.
  //
`,
  undefined, 'and asking for the paint from inside one frame (64.2.5)');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - the grid that was rebuilt for no reason
// ═══════════════════════════════════════════════════════════════════════════

sub('an unchanged grid is left alone',
  `    bubbles.innerHTML = homeOrderNow.map(k => {
      if(k.indexOf('custom-') === 0){
        const act = customQuickActions.find(x => 'custom-' + x.id === k);
        return act ? customActionBubbleHTML(act) : '';
      }
      return homeTemplates[k] || '';
    }).join('');`,
  `    const gridHtml = homeOrderNow.map(k => {
      if(k.indexOf('custom-') === 0){
        const act = customQuickActions.find(x => 'custom-' + x.id === k);
        return act ? customActionBubbleHTML(act) : '';
      }
      return homeTemplates[k] || '';
    }).join('');
    // A grid already showing this exact markup is left exactly as it is. Home is
    // rebuilt by things that have nothing to do with the grid - a play count
    // ticking up, a metadata read landing, the mini-play button settling - and
    // every one of those used to throw every bubble away and build it again.
    // That rebuild is what a phone can leave half drawn when it happens on a
    // Home that is already scrolled: the new nodes arrive with the scroller
    // where it is, and a bubble is left holding its space with nothing painted
    // in it - the Favorites bubble that "keeps disappearing". If the markup is
    // the same there is nothing to build, and when a bubble really is missing
    // the DOM check says so and the rebuild below still happens.
    if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){
      applyHomeBubbleSizes();
      return;
    }
    renderHome._lastHtml = gridHtml;
    bubbles.innerHTML = gridHtml;`,
  undefined, 'if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){');

sub('and a rebuild that does happen asks for its own paint',
  `      wireHomeBubbleDrag(b);
    });
  }

  // ---- Asking a surface to draw itself again (64.2.6) ------------------------`,
  `      wireHomeBubbleDrag(b);
    });
    // A rebuild that really happened asks for its paint here, instead of waiting
    // for the next settled scroll. The rebuild can land after the last scroll
    // settled, and a bubble built into a scrolled Home would then sit blank
    // until the user scrolled again - which is the report, exactly.
    try{ scRepaintSurface(bubbles, '.home-bubble'); }catch(_eRpBuilt){}
  }

  // ---- Asking a surface to draw itself again (64.2.6) ------------------------`,
  undefined, 'try{ scRepaintSurface(bubbles, \'.home-bubble\'); }catch(_eRpBuilt){}');

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the island asks for its own paint the moment it is rebuilt
// ═══════════════════════════════════════════════════════════════════════════

sub('a rebuilt rail asks for its own paint too',
  `    try{ list.scrollLeft = 0; }catch(_eSc){}
  }`,
  `    try{ list.scrollLeft = 0; }catch(_eSc){}
    // A rebuilt rail is the same shape as a rebuilt grid: the chips are new
    // nodes in a scroller that is already where it is, and a phone can leave
    // them unpainted. The rail's own repair is asked for here rather than at the
    // next settle, so a rail that is rebuilt while Discover is on screen cannot
    // sit blank until something else scrolls.
    try{ repaintPinnedRail(list); }catch(_eRpRail){}
  }`,
  undefined, 'try{ repaintPinnedRail(list); }catch(_eRpRail){}');

// ═══════════════════════════════════════════════════════════════════════════
// 4 - each library half keeps its own place in the list
// ═══════════════════════════════════════════════════════════════════════════

sub('the two halves of the library are told apart',
  `  function renderList(){
    // Debounce: coalesce rapid renderList calls`,
  `  // ---- Each library half keeps its own place in the list --------------------
  // Playlists and Albums are two different lists that render into the SAME
  // #listPane, so the pane can only ever remember one position on its own.
  // renderListInner restores the scroll position across a rebuild, and it used
  // to ask the pane "where were we" without knowing which half "we" was: leaving
  // Albums at album #30 and switching to Playlists put the playlists list at
  // that same offset, and the other way round. Tapping the record on the now bar
  // made it obvious, because that path renders the list before it glides - the
  // tap scrolled the half the user was NOT looking at, then moved the one they
  // were. Each half now has its own position: it is taken from the pane as that
  // half is being replaced, and put back once the new half has been built.
  var scLibScroll = { playlists: 0, albums: 0 };
  function scLibHalfName(){
    return (typeof libraryMode !== 'undefined' && libraryMode === 'albums') ? 'albums' : 'playlists';
  }
  // Reachable from a probe the same way the two jumps are, so a test can read
  // what each half remembers instead of inferring it from the pane.
  window.__scLibScroll = scLibScroll;
  function renderList(){
    // Debounce: coalesce rapid renderList calls`,
  undefined, 'function scLibHalfName(){');

sub('the restore puts back the half you are entering, not the one you left',
  `    // restore when the playlist itself changed (tab switch) since jumping to
    // a stale scroll position on a different list looks wrong.
    const prevScrollTop = (renderListInner._lastPlaylist === activePlaylist) ? pane.scrollTop : 0;
    renderListInner._lastPlaylist = activePlaylist;`,
  `    // restore when the playlist itself changed (tab switch) since jumping to
    // a stale scroll position on a different list looks wrong.
    //
    // The same reasoning covers the two halves of the library, and this is the
    // part that was missing. The half the pane is actually SHOWING is read from
    // what was last rendered (not from libraryMode, which the caller may have
    // flipped already): the pane is about to be emptied and rebuilt, so its
    // position is taken here, while it still belongs to the half being replaced,
    // and the half being entered is handed its own remembered position instead.
    const libHalf = scLibHalfName();
    const leftHalf = renderListInner._lastHalf;
    const halfChanged = !!(leftHalf && leftHalf !== libHalf);
    if(halfChanged) scLibScroll[leftHalf] = pane.scrollTop;
    const prevScrollTop = halfChanged
      ? (scLibScroll[libHalf] || 0)
      : ((renderListInner._lastPlaylist === activePlaylist) ? pane.scrollTop : 0);
    renderListInner._lastHalf = libHalf;
    renderListInner._lastPlaylist = activePlaylist;`,
  undefined, 'const halfChanged = !!(leftHalf && leftHalf !== libHalf);');

// The half being entered must land at its own remembered offset EVEN WHEN that
// is 0: the pane is a scroller shared by both lists, and rebuilding it does not
// send it back to the top on its own, so "arrive at 0" has to be said out loud.
// Both halves restore through this one line.
sub('the restore is applied even when the remembered offset is the top',
  `    if(!renderListInner._scrollToPlaying && prevScrollTop) pane.scrollTop = prevScrollTop;`,
  `    if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;`,
  undefined, '(halfChanged || prevScrollTop)');

sub('and Albums is put back where it was, not where Playlists was',
  `        }
      });
      return;
    }

    ids.forEach((id,i) => {`,
  `        }
      });
      // Albums is the other half of the library, so it has to be put back where
      // it was in exactly the same way the playlists path below is: the pane is
      // emptied and rebuilt, and a scroller that has been emptied comes back at
      // the top. Without this the albums list opened at whatever offset the
      // playlists half happened to be at - the scroll the user saw "in another
      // place" - and the record tap, which renders the list before it glides,
      // moved it on the way every time.
      if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;
      return;
    }

    ids.forEach((id,i) => {`,
  undefined, 'Albums is the other half of the library, so it has to be put back where');

fs.writeFileSync(FILE, src);
console.log('patch-66426: index.html written (' + edits + ' edit(s))');

// ═══════════════════════════════════════════════════════════════════════════
// 5 - the release itself
// ═══════════════════════════════════════════════════════════════════════════

let rel = fs.readFileSync(FILE, 'utf8');
const relSkip = (l) => console.log('= ' + l + ' (already applied)');
const relDone = (l) => { console.log('+ ' + l); edits++; };

if (rel.indexOf(`  const APP_VERSION = '` + VER + `';`) !== -1) relSkip('APP_VERSION is ' + VER);
else {
  if (rel.indexOf(`  const APP_VERSION = '` + OLD_VER + `';`) === -1) throw new Error('APP_VERSION was not ' + OLD_VER);
  rel = rel.split(`  const APP_VERSION = '` + OLD_VER + `';`).join(`  const APP_VERSION = '` + VER + `';`);
  relDone('APP_VERSION is ' + VER);
}

// The new entry goes AHEAD of the 64.2.5 one, which stays exactly where it is:
// every earlier release is still listed and still readable in the bell.
const HEAD_NEW = `  { version: '` + VER + `', date: '` + STAMP + `', title: '` + TITLE + `', items: [` +
  NOTES.map((n) => `\n    '` + n + `',`).join('') + `\n  ] },\n`;
if (rel.indexOf(`  { version: '` + VER + `', date: '` + STAMP + `'`) !== -1) relSkip('the head changelog entry is ' + VER);
else {
  if (rel.indexOf(`  const CHANGELOG = [\n`) === -1) throw new Error('the CHANGELOG opener was not found');
  rel = rel.split(`  const CHANGELOG = [\n`).join(`  const CHANGELOG = [\n` + HEAD_NEW);
  relDone('the head changelog entry is ' + VER + ' with ' + NOTES.length + ' notes');
}
fs.writeFileSync(FILE, rel);

// sw.js carries a cache name and NOTHING of the app version (dev/ota-guard
// asserts that), so it moves on its own line and its own counter.
const SW = path.join(ROOT, 'sw.js');
let sw = fs.readFileSync(SW, 'utf8');
const SW_NEW = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
const SW_OLD = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
if (sw.indexOf(SW_NEW) !== -1) skip('the service worker cache moves on ' + SW_CACHE);
else {
  if (sw.indexOf(SW_OLD) === -1) throw new Error('sw.js cache was not v' + OLD_SW_CACHE);
  fs.writeFileSync(SW, sw.split(SW_OLD).join(SW_NEW));
  done('the service worker cache moves on ' + SW_CACHE);
}

// ═══════════════════════════════════════════════════════════════════════════
// 6 - the gates that pinned how the repair was written
// ═══════════════════════════════════════════════════════════════════════════
// Same rule as every release since 64.2.3: a gate that pins the shape of a
// repair has to move with it, or it is pinning a release that no longer exists.
// The checks keep their meaning - the surface is never hidden, never measured,
// never put on a layer, and it is asked for a fresh paint - they are just
// pointed at the repair that is there now.
function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let s = fs.readFileSync(p, 'utf8');
  for (const [label, oldStr, newStr, marker] of pairs) {
    const m = marker === undefined ? newStr : marker;
    if (m !== '' && s.indexOf(m) !== -1) { skip(rel + ': ' + label); continue; }
    const got = s.split(oldStr).length - 1;
    if (got !== 1) throw new Error(rel + ' - ' + label + ': found ' + got + ' occurrence(s), want 1');
    s = s.split(oldStr).join(newStr);
    done(rel + ': ' + label);
  }
  fs.writeFileSync(p, s);
}

fileSub('dev/test-66424.mjs', [
  ['the version this gate reads', "const VER = '64.2.5';", "const VER = '64.2.6';"],
  ['the take-back is one frame deeper, and the label says so',
    `  ok(has("        try{ el.style.outline = ''; }catch(_eRpBack){}"), 'that is taken back on the next frame');`,
    `  ok(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'that is taken back a frame later, not inside the same one');`],
]);

fileSub('dev/test-66425.mjs', [
  ['the version this gate reads', "const VER = '64.2.5';", "const VER = '64.2.6';"],
  ['the take-back is one frame deeper, and the label says so',
    `  ok(has("        try{ el.style.outline = ''; }catch(_eRpBack){}"), 'and puts it back on the next frame');`,
    `  ok(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'and puts it back a frame later, so the frame that carries it is really painted');`],
]);

// ═══════════════════════════════════════════════════════════════════════════
// 7 - the version pins across the suite
// ═══════════════════════════════════════════════════════════════════════════
// A bump rewrites quoted version literals in every dev/test-*.mjs. Gates that
// describe an OLDER release read it by version with a regex and pin nothing
// here; the two that pinned this repair's shape were fixed above, before this
// sweep (so it has nothing left to do in them).
const REPINS = [
  ["ver === '" + OLD_VER + "'", "ver === '" + VER + "'"],
  ["const VER = '" + OLD_VER + "';", "const VER = '" + VER + "';"],
  ["version: '" + OLD_VER + "'", "version: '" + VER + "'"],
  ["entries[0].version === '" + OLD_VER + "'", "entries[0].version === '" + VER + "'"],
  [OLD_VER + " heads the changelog", VER + " heads the changelog"],
  ["'" + OLD_STAMP + "'", "'" + STAMP + "'"],
  ["CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'", "CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'"],
];
const SKIP = new Set(['test-655.mjs', 'test-656.mjs']);
let repinned = 0;
for (const name of fs.readdirSync(path.join(ROOT, 'dev'))) {
  if (!/^test-.*\.mjs$/.test(name)) continue;
  if (SKIP.has(name)) continue;
  const p = path.join(ROOT, 'dev', name);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of REPINS) {
    if (a === b || t.indexOf(a) === -1) continue;
    repinned += t.split(a).length - 1;
    t = t.split(a).join(b);
    console.log('  ' + name + ' - ' + a.slice(0, 52));
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}
console.log('patch-66426: ' + repinned + ' version repin(s) across dev/test-*.mjs');

// ═══════════════════════════════════════════════════════════════════════════
// verification - every claim above, checked against what was just written
// ═══════════════════════════════════════════════════════════════════════════
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
function must(cond, what) { if (!cond) problems.push(what); }
const has = (needle) => final.indexOf(needle) !== -1;
const mark = (l) => console.log('  ok ' + l);
const code = final.replace(/^\s*\/\/.*$/gm, '');
const sliceC = (from, to) => {
  const a = code.indexOf(from);
  const b = code.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return code.slice(a, b);
};

// 1 - the repair really does ask for a paint the phone can act on
must(has('  function scRepaint(el){'), 'the paint request is declared');
must(has("      el.style.outline = '1px solid transparent';"), 'and it is a paint-only property');
must(has("          try{ el.style.outline = ''; }catch(_eRpBack){}"), 'which is taken back a frame later');
must(has(`      requestAnimationFrame(function(){\n        requestAnimationFrame(function(){`),
  'so the frame carrying it is really painted before it is removed');
must(has('This is the fifth answer to the same report'), 'and the note above it counts the attempts honestly');
must(has('  function scRepaintSurface(root, sel){'), 'a surface helper is declared');
const scBody = sliceC('  function scRepaint(el){', '  function scRepaintSurface(root, sel){');
must(scBody !== '' && !/visibility|translateZ|offsetHeight|getBoundingClientRect/.test(scBody),
  'and the repair still hides nothing, promotes nothing and measures nothing');
must(!/void (wrap|strip)\.offsetHeight/.test(code), 'no settled scroll lays the page out again');
const gridBody = sliceC('  function repaintHomeGrid(){', '  function homeGridIsWhole(){');
const railBody = sliceC('  function repaintPinnedRail(list){', '  (function watchPinnedRail(){');
must(gridBody !== '' && railBody !== '', 'both settle repaints are still there');
must(!/visibility/.test(gridBody) && !/visibility/.test(railBody), 'neither ever hides its surface');
must(!/carried/.test(gridBody) && !/carried/.test(railBody), 'and neither waits for a drag to leave something behind');
must(!/translateZ/.test(gridBody) && !/translateZ/.test(railBody), 'nor puts the surface on a layer of its own');
must(!/offsetHeight|getBoundingClientRect/.test(gridBody) && !/offsetHeight|getBoundingClientRect/.test(railBody),
  'and neither measures anything');

// 2 - the grid is only rebuilt when it really changed, and a real rebuild paints
must(has('const gridHtml = homeOrderNow.map(k => {'), 'the grid is assembled before it is assigned');
must(has('if(renderHome._lastHtml === gridHtml && homeGridIsWhole()){'), 'an unchanged grid is left alone');
must(has("    try{ scRepaintSurface(bubbles, '.home-bubble'); }catch(_eRpBuilt){}"),
  'and a rebuild that happens asks for every bubble to paint again');
must(has("    try{ repaintPinnedRail(list); }catch(_eRpRail){}"),
  'a rebuilt pinned-artists rail asks for its own paint too');
must(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'),
  'a grid really missing a bubble is still drawn from the layout again');
must(has("          if(l.querySelector('.pinned-artist-chip')) return;\n          renderPinnedArtists();"),
  'and a rail really missing its chips is still built again');

// 3 - each half of the library has its own position
must(has('  var scLibScroll = { playlists: 0, albums: 0 };'), 'each half has a remembered position');
must(has('  window.__scLibScroll = scLibScroll;'), 'and what it remembers can be read from outside');
must(has('  function scLibHalfName(){'), 'and one place decides which half is open');
must(has('    const libHalf = scLibHalfName();'), 'the renderer asks which half it is drawing');
must(has('    const leftHalf = renderListInner._lastHalf;'),
  'and which half the pane was actually showing, not what the caller just set');
must(has('    if(halfChanged) scLibScroll[leftHalf] = pane.scrollTop;'),
  'the half being left is remembered where it was, before the rebuild');
must(has('      ? (scLibScroll[libHalf] || 0)'), 'and the half being entered is handed its own position');
must(has('    renderListInner._lastHalf = libHalf;'), 'so the half the last render belonged to is recorded');
must(has(`      if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;
      return;`),
  'Albums puts itself back once its cards are built, exactly like Playlists');
must(final.split('if(!renderListInner._scrollToPlaying && (halfChanged || prevScrollTop)) pane.scrollTop = prevScrollTop;').length - 1 === 2,
  'and both halves restore through the same one line');
must(!/&& prevScrollTop\) pane\.scrollTop/.test(code), 'so arriving at the top is said out loud instead of skipped');
const restore = sliceC('    const libHalf = scLibHalfName();', '    const isUnsortedView');
must(restore !== '' && !/scrollIntoView/.test(restore), 'and nothing here reaches outside the pane');
must(!/watchLibraryHalfScroll/.test(final), 'no scroll listener is needed to keep the two positions apart');

// 4 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
if (block) {
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { problems.push('the changelog evaluates: ' + e.message); }
  if (entries) {
    const head = entries[0];
    must(String(head.version) === VER, 'the head entry is v' + VER + ' (' + head.version + ')');
    must(head.date === STAMP, 'stamped ' + STAMP + ' (' + head.date + ')');
    must((head.items || []).length === 6, 'six notes (' + (head.items || []).length + ')');
    const notes = (head.items || []).join('\n');
    must((head.items || []).every((it) => it.length <= 260), 'every note is short (longest ' + Math.max(...(head.items || ['']).map((i) => i.length)) + ' chars)');
    must((head.items || []).every((it) => it.indexOf('[FULL]') === -1), 'all six publish on both channels');
    must(!/\bdownload|converter|convert\b/i.test(notes), 'no downloader term in them');
    must(!/play build|play version|play install/i.test(notes), 'and they never name the store build');
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off|no source found/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what this release left alone');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    must(entries.some((e) => /^64\.2\.5$/.test(String(e.version))), 'and the release before it is still listed');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

// 5 - nothing else on the page still calls itself the release before this one
must(final.indexOf("'" + OLD_VER + "'") === -1 || has(`  { version: '` + OLD_VER + `'`),
  'the page names ' + VER + ' as itself and ' + OLD_VER + ' only as history');

if (problems.length) {
  console.error('\npatch-66426: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66426: all verification checks passed (' + edits + ' edit(s))');
