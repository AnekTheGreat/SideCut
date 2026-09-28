#!/usr/bin/env node
// SideCut - 64.2.4: the blink on every scroll and every launch, the album that
// lost a few songs, and the work the phone was doing for nothing.
//
// Five things were reported about 64.2.3:
//
//   "Every time it boots or you scroll around the app it blinks now slightly"
//   "why is refetch missing covers in watermark remover it should be in library
//    tools and fetching"
//   "These patch notes should have like headers and then drop-down menus for the
//    headers to go more into depth or just take a glance"
//   "Fix the foreground battery drain issue without reducing performance or
//    smoothness of the app"
//   "for some songs Spotify to mp3 it still says no source found but this
//    happens when it's an album more often and it's like a few songs in it"
//
//   * THE SCROLL BLINK IS 64.2.1/64.2.2/64.2.3'S REPAINT RUNNING ON A HEALTHY
//     SURFACE. Both settle handlers promoted the grid/card onto its own layer and
//     dropped the promotion two frames later on EVERY settled scroll - a full
//     re-raster of the surface a moment after you stop, whether or not anything
//     was wrong with it. That is the slight blink while scrolling, and it is a
//     whole extra GPU pass per scroll that buys nothing. The fresh raster is now
//     only asked for when there is damage to repair: a chip or bubble still
//     carrying what a drag gave it, or a placeholder an abandoned drag left.
//
//   * THE LAUNCH BLINK IS THE THEME ARRIVING LATE. The app painted itself in the
//     default colours and then restyled every colour in it once the saved theme
//     came back out of the database, and (since the accent text colour is picked
//     from the accent) it could restyle that a second time. applyTheme() now
//     caches the colours it just applied, and the very next launch applies that
//     cache before its first paint - the app opens in your theme.
//
//   * THE FOREGROUND DRAIN: the playing row's glow animated a box-shadow, which
//     no compositor can animate, so the row was painted again on every frame for
//     as long as a song played with the list open. It is a layer of its own whose
//     OPACITY pulses now. Same look, nothing painted per frame. Together with the
//     scroll raster above that is the app's own share of the drain, and neither
//     of them touches how smooth anything feels.
//
//   * THE ALBUM THAT LOST A FEW SONGS: inside a run, a candidate upload title
//     that answers to ANOTHER track of the run is thrown away - and "answers to"
//     is a substring test, so a one-word track title of three characters or less
//     ("Ok", "Ya", "Pt 1") matched inside unrelated titles ("Smoking", "Yacht")
//     and threw the RIGHT recording away for whichever track was being fetched.
//     That is an album where the rest is fine and a few songs come back with
//     nothing. A key that weak can now only confirm a source, never reject one -
//     the same rule the artist credit check already carries for a short name.
//     On top of that, a search that could not REACH the source is retried once
//     instead of failing that song for the rest of the run.
//
//   node dev/patch-66424.mjs
//   node dev/patch-66424.mjs --manifest    # re-seed root manifest.json from ota/
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
// character, built here so this script stays ASCII (see AGENTS.md). Needles that
// end up containing one are built the same way.
const cp = (n) => String.fromCodePoint(n); // real glyphs, kept out of this file's escapes
const DOT = cp(0x00b7);      // the middle dot the ship stamps use
const EM = cp(0x2014);       // em dash, for the notes as the app shows them
const BUL = cp(0x2022);      // the bullet the note lists use
const DOTS = cp(0x2026);     // the ellipsis the glance line is cut with
const CARET = cp(0x25be);    // the small down chevron the settings groups use

const VER = '64.2.4';
const OLD_VER = '64.2.3';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 28, 2026 ' + DOT + ' 9:10 PM EDT';
const OLD_STAMP = 'September 27, 2026 ' + DOT + ' 8:35 PM EDT';
const SW_CACHE = '63.0.22';
const OLD_SW_CACHE = '63.0.21';

// Short, plain statements of the changes, the way 64.2.3's entries are written.
const TITLE = 'The blink on every scroll and every launch, the album that lost a few songs, and the glow that kept the phone busy';

// Six short notes, published on BOTH channels (no [FULL] marker anywhere), so no
// tooling wording: dev/test-617..620, -60510 and -662 read the WHOLE head entry
// for a downloader term, dev/test-6058 runs the shipped filter over it for the
// store channel, and dev/test-play-copy reads it against a wider list than
// either. The last note keeps the word "rollback": dev/test-662 asserts the head
// entry describes what the release did with /rollback/i.
const NOTES = [
  'The app no longer re-paints itself on every scroll. A settled scroll made the phone raster Home, or the pinned artists island, again a moment after it stopped - that is the slight blink you see while scrolling, and it was work with nothing to show for it.',
  'And it no longer repaints itself a moment after it opens. SideCut used to appear in the default colours and then restyle every colour in it once your saved theme came back from the device - that whole-app flicker at launch is gone.',
  'The playing row glows on its own layer now instead of re-painting the row about sixty times a second while a song plays. The look is unchanged, and that steady repaint is part of what the foreground drain was made of.',
  'An album no longer comes back with a few songs missing. A very short track title in the run ("Ok", "Ya") used to match inside unrelated titles and throw the right recording away; a title that short can only confirm a source, never reject one.',
  'A search that could not reach the source is tried once more before that song is given up on, so a run of them in the middle of an album no longer loses the songs in the middle.',
  'Refetch missing covers now sits with the rest of the library tools instead of inside Watermark Remover, and the patch notes in the bell are grouped by version with a header you can open. Nothing else changes - same songs, covers and saved rollback copies.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66424 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
  process.exit(0);
}

let src = fs.readFileSync(FILE, 'utf8');
let edits = 0;
const skip = (l) => console.log('= ' + l + ' (already applied)');
const done = (l) => { console.log('+ ' + l); edits++; };

// Replace every occurrence of an exact needle.
function sub(label, oldStr, newStr, want, marker) {
  const m = marker || newStr;
  if (m !== '' && src.indexOf(m) !== -1) return skip(label);
  const got = src.split(oldStr).length - 1;
  if (want === undefined) want = 1;
  if (got !== want) throw new Error(label + ': found ' + got + ' occurrence(s), want ' + want);
  src = src.split(oldStr).join(newStr);
  done(label);
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 - the launch starts in your theme (the boot flicker)
// ═══════════════════════════════════════════════════════════════════════════
sub('the launch applies the theme it was saved in, before its first paint',
  '<script>\n// ---- Upcoming-release day gate (shared by BOTH script blocks) --------------\n',
  '<script>\n' +
  '// ---- The saved theme, applied before the app paints (64.2.4) ---------------\n' +
  '// The theme lives in the database with everything else, and that read is\n' +
  '// asynchronous - so the app used to paint itself in the DEFAULT colours and\n' +
  '// then restyle every colour in it (and the accent text colour with it) the\n' +
  '// moment the saved row came back. On a phone that is a visible flicker on\n' +
  '// every launch. applyTheme() writes the colours it just applied to a tiny\n' +
  '// cache, and this runs at the top of the app script, before the first frame,\n' +
  '// so the launch already carries them.\n' +
  '//\n' +
  '// The cache is never a second source of truth: it is rewritten from the same\n' +
  '// database row every time applyTheme() runs, and it is only read here, once,\n' +
  '// to seed the first paint. A stale or unreadable cache simply paints the\n' +
  '// defaults, which is what every launch did before.\n' +
  '(function scPrepaintTheme(){\n' +
  '  try{\n' +
  "    var raw = localStorage.getItem('sidecut_theme_prepaint');\n" +
  '    if(!raw) return;\n' +
  '    var c = JSON.parse(raw);\n' +
  '    if(!c || c.v !== 1) return;\n' +
  '    var root = document.documentElement.style;\n' +
  "    if(c.bg) root.setProperty('--bg', c.bg);\n" +
  "    if(c.bgRaised) root.setProperty('--bg-raised', c.bgRaised);\n" +
  "    if(c.coral) root.setProperty('--coral', c.coral);\n" +
  "    if(c.gold) root.setProperty('--gold', c.gold);\n" +
  "    if(c.onCoral) root.setProperty('--on-coral', c.onCoral);\n" +
  "    if(c.dyn) document.body.classList.add('theme-dyn-' + c.dyn);\n" +
  '  }catch(_ePrepaint){}\n' +
  '})();\n' +
  '// ---- Upcoming-release day gate (shared by BOTH script blocks) --------------\n');

sub('and applyTheme remembers what it applied, for the next launch',
  "    dbPut('meta', { key: 'theme', value: key });\n" +
  '    updateFavicon();\n' +
  '  }',
  "    dbPut('meta', { key: 'theme', value: key });\n" +
  '    updateFavicon();\n' +
  '    // What the next launch paints with, before it can read the row above.\n' +
  '    try{\n' +
  "      localStorage.setItem('sidecut_theme_prepaint', JSON.stringify({\n" +
  '        v: 1, key: key, bg: th.bg, bgRaised: th.bgRaised, coral: th.coral, gold: th.gold,\n' +
  "        onCoral: th.rgb ? '' : scOnAccent(th.coral),\n" +
  "        dyn: th.dynamic || ''\n" +
  '      }));\n' +
  '    }catch(_ePrepaint){}\n' +
  '  }');

// ═══════════════════════════════════════════════════════════════════════════
// 2 - a settled scroll only re-rasters a surface that really needs it
// ═══════════════════════════════════════════════════════════════════════════
sub('the rail repaint is only asked for when a chip carries a drag',
  '  function repaintPinnedRail(list){\n' +
  '    try{\n' +
  "      var chips = list.querySelectorAll('.pinned-artist-chip');",
  '  function repaintPinnedRail(list){\n' +
  '    var carried = 0;\n' +
  '    try{\n' +
  "      var chips = list.querySelectorAll('.pinned-artist-chip');");

sub('and a rail that is simply fine is left alone',
  "        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }\n" +
  '      }\n' +
  '    }catch(_eLift){}\n' +
  "    var strip = $('pinnedArtistsStrip');\n" +
  '    if(!strip) return;',
  "        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }\n" +
  '      }\n' +
  '    }catch(_eLift){}\n' +
  '    // A chip left carrying a drag lift is damage, and the fresh raster below is\n' +
  '    // for it. A settled scroll over a rail that is simply fine is NOT damage:\n' +
  '    // promoting the card on every settled scroll made the compositor raster the\n' +
  '    // whole strip again a moment after you stopped, which is the slight blink\n' +
  '    // seen while scrolling - and a whole extra GPU pass per scroll that bought\n' +
  '    // nothing at all.\n' +
  '    if(!carried) return;\n' +
  "    var strip = $('pinnedArtistsStrip');\n" +
  '    if(!strip) return;');

sub('the Home grid is judged the same way',
  '  function repaintHomeGrid(){\n' +
  "    var wrap = $('homeBubbles');\n" +
  '    if(!wrap) return;\n' +
  '    try{',
  '  function repaintHomeGrid(){\n' +
  "    var wrap = $('homeBubbles');\n" +
  '    if(!wrap) return;\n' +
  '    // Nothing carried and no placeholder left behind means there is nothing to\n' +
  '    // repair - see repaintPinnedRail for why a settled scroll over a healthy\n' +
  '    // grid must not schedule a raster at all.\n' +
  '    var carried = 0;\n' +
  '    try{');

sub('a placeholder the drag left is still removed, and counts as damage',
  "      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode) phs[i].parentNode.removeChild(phs[i]); }",
  "      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); carried++; } }");

sub('as does a bubble still holding its drag lift',
  "        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';\n" +
  '      }\n' +
  '    }catch(_eCarry){}',
  "        b.style.width = ''; b.style.height = ''; b.style.transform = ''; b.style.transition = '';\n" +
  '        carried++;\n' +
  '      }\n' +
  '    }catch(_eCarry){}\n' +
  '    if(!carried) return;');

sub('and the grid comment says when the fresh paint is asked for',
  '  //   - and a grid that really is missing a bubble the layout asks for is drawn\n' +
  '  //     from the layout again instead of waiting for the next update to notice.',
  '  //   - and a grid that really is missing a bubble the layout asks for is drawn\n' +
  '  //     from the layout again instead of waiting for the next update to notice;\n' +
  '  //\n' +
  '  // and NONE of it runs on a scroll that found nothing wrong. Promoting the grid\n' +
  '  // on every settled scroll re-rastered the whole surface a moment after you\n' +
  '  // stopped - the slight blink while scrolling - so the fresh paint above is now\n' +
  '  // only asked for when there is something to repair.');

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the playing row pulses on its own layer, not by re-painting itself
// ═══════════════════════════════════════════════════════════════════════════
sub('the playing row stops animating a box-shadow',
  '  .track.playing{\n' +
  '    background: color-mix(in srgb, var(--coral) 8%, transparent);\n' +
  '    box-shadow: inset 3px 0 0 var(--coral), inset 0 0 14px color-mix(in srgb, var(--coral) 12%, transparent);\n' +
  '    animation: glowPulse 2s ease-in-out infinite;\n' +
  '    z-index:0;\n' +
  '  }\n' +
  '  @keyframes glowPulse{\n' +
  '    0%, 100%{ box-shadow: inset 3px 0 0 var(--coral), inset 0 0 10px color-mix(in srgb, var(--coral) 10%, transparent); }\n' +
  '    50%{ box-shadow: inset 3px 0 0 var(--coral), inset 0 0 20px color-mix(in srgb, var(--coral) 28%, transparent); }\n' +
  '  }',
  '  .track.playing{\n' +
  '    background: color-mix(in srgb, var(--coral) 8%, transparent);\n' +
  '    box-shadow: inset 3px 0 0 var(--coral);\n' +
  '    z-index:0;\n' +
  '  }\n' +
  '  /* The playing row\'s glow used to PULSE A BOX-SHADOW, which no compositor can\n' +
  '     animate: every frame re-painted the row - 60 to 120 times a second for as\n' +
  '     long as a song played with the list open, in the foreground, right where you\n' +
  '     scroll. The glow is a layer of its own now (the ::after below) and it is its\n' +
  '     OPACITY that pulses, which the compositor animates with nothing painted. Same\n' +
  '     glow, and the row is only painted when it really changes. z-index:-1 keeps it\n' +
  '     above the row\'s own background and below its content, exactly where the\n' +
  '     row-level inset shadow used to be drawn. */\n' +
  '  .track.playing::after{\n' +
  "    content:''; position:absolute; inset:0; z-index:-1; pointer-events:none;\n" +
  '    box-shadow: inset 3px 0 0 var(--coral), inset 0 0 20px color-mix(in srgb, var(--coral) 28%, transparent);\n' +
  '    opacity:0.4;\n' +
  '    animation: glowPulse 2s ease-in-out infinite;\n' +
  '  }\n' +
  '  @keyframes glowPulse{\n' +
  '    0%, 100%{ opacity:0.4; }\n' +
  '    50%{ opacity:1; }\n' +
  '  }');

// ═══════════════════════════════════════════════════════════════════════════
// 4 - Refetch Missing Covers moves to Library Tools & Fetching
// ═══════════════════════════════════════════════════════════════════════════
sub('the cover refetch leaves the Watermark Remover card',
  '              <button class="tab" id="watermarkResetBtn" style="padding:10px; font-size:13px; background:rgba(255,107,107,0.1); border-color:rgba(255,107,107,0.3);">Reset</button>\n' +
  '            </div>\n' +
  '            <button class="tab" id="refetchCoversBtn" style="width:100%; padding:10px; font-size:13px;">Refetch Missing Covers <span class="online-badge" style="font-size:7px;padding:1px 3px;">ONLINE</span></button>\n' +
  '          </div>',
  '              <button class="tab" id="watermarkResetBtn" style="padding:10px; font-size:13px; background:rgba(255,107,107,0.1); border-color:rgba(255,107,107,0.3);">Reset</button>\n' +
  '            </div>\n' +
  '          </div>',
  1,
  '              <button class="tab" id="watermarkResetBtn" style="padding:10px; font-size:13px; background:rgba(255,107,107,0.1); border-color:rgba(255,107,107,0.3);">Reset</button>\n' +
  '            </div>\n' +
  '          </div>');

sub('and joins the library tools, next to the cover fetch it belongs with',
  '          <div style="margin-bottom:12px;">\n' +
  '            <button class="playlist-pick-btn" id="fetchMissingCoversBtn" style="text-align:center; width:100%;">Fetch missing covers</button>\n' +
  '            <div id="coverProgressBar" style="display:none; height:4px; background:var(--line); border-radius:2px; margin-top:6px; overflow:hidden;"><div id="coverProgressFill" style="height:100%; background:var(--coral); width:0%; transition:width 0.2s;"></div></div>\n' +
  '            <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">Try to fetch covers from multiple sources.</div>\n' +
  '          </div>',
  '          <div style="margin-bottom:12px;">\n' +
  '            <button class="playlist-pick-btn" id="fetchMissingCoversBtn" style="text-align:center; width:100%;">Fetch missing covers</button>\n' +
  '            <div id="coverProgressBar" style="display:none; height:4px; background:var(--line); border-radius:2px; margin-top:6px; overflow:hidden;"><div id="coverProgressFill" style="height:100%; background:var(--coral); width:0%; transition:width 0.2s;"></div></div>\n' +
  '            <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">Try to fetch covers from multiple sources.</div>\n' +
  '          </div>\n' +
  '          <div style="margin-bottom:12px;">\n' +
  '            <button class="playlist-pick-btn" id="refetchCoversBtn" style="text-align:center; width:100%;"><span id="refetchCoversLabel">Refetch missing covers</span> <span class="online-badge" style="font-size:7px;padding:1px 3px;">ONLINE</span></button>\n' +
  '            <div style="font-size:11px; color:var(--ink-dim); margin-top:4px;">Ask every cover source again for every song, not only the ones with no cover. It never touches your music.</div>\n' +
  '          </div>');

sub('and its own label keeps the ONLINE badge alive',
  '  $(\'refetchCoversBtn\').addEventListener(\'click\', async () => {',
  "  // The button's label lives in its own element: writing textContent on the\n" +
  '  // button itself took the ONLINE badge with it the first time it ran.\n' +
  '  function scSetRefetchLabel(txt){\n' +
  "    const el = $('refetchCoversLabel') || $('refetchCoversBtn');\n" +
  '    if(el) el.textContent = txt;\n' +
  '  }\n' +
  "  $('refetchCoversBtn').addEventListener('click', async () => {");

sub('the running label goes through it',
  "    btn.textContent = 'Fetching...';",
  "    scSetRefetchLabel('Fetching...');");

sub('the progress counter does too',
  '      btn.textContent = `${window.coverFetchState.done}/${total}`;',
  '      scSetRefetchLabel(`${window.coverFetchState.done}/${total}`);');

sub('and so does the label it comes back to',
  "    btn.textContent = 'Refetch Missing Covers';",
  "    scSetRefetchLabel('Refetch missing covers');");

// ═══════════════════════════════════════════════════════════════════════════
// 5 - the patch notes are groups you open, not a wall of bullets
// ═══════════════════════════════════════════════════════════════════════════
sub('the bell gains the grouped patch notes',
  '  function renderNotifPanel(){',
  '  // ---- Patch notes: a header per release, and the detail behind it ---------\n' +
  '  // Each release is one group - the version, when it shipped, what it did and\n' +
  '  // how many notes are behind it, plus the opening of the first note as the\n' +
  '  // glance - and the notes themselves, which are there when you want them and\n' +
  '  // out of the way when you only wanted to look. The newest entry is open; the\n' +
  '  // rest stay shut until you tap one, and what you opened stays open while the\n' +
  '  // panel is re-rendered under you (a progress update redraws it every few\n' +
  '  // seconds, and losing the group you had just opened would be maddening).\n' +
  '  const openChangelogGroups = new Set();\n' +
  '  let changelogGroupsTouched = false;\n' +
  '  function scApplyChangelogGroup(v, open){\n' +
  "    const body = $('notifBody');\n" +
  '    if(!body) return;\n' +
  '    const h = body.querySelector(\'[data-cl-group="\' + v + \'"]\');\n' +
  '    const b = body.querySelector(\'[data-cl-body="\' + v + \'"]\');\n' +
  '    const g = body.querySelector(\'[data-cl-glance="\' + v + \'"]\');\n' +
  '    if(h) h.setAttribute(\'aria-expanded\', open ? \'true\' : \'false\');\n' +
  '    if(b) b.style.display = open ? \'flex\' : \'none\';\n' +
  '    if(g) g.style.display = open ? \'none\' : \'block\';\n' +
  "    const chev = h && h.querySelector('.cl-chev');\n" +
  "    if(chev) chev.style.transform = open ? 'rotate(0deg)' : 'rotate(-90deg)';\n" +
  '  }\n' +
  '  function renderNotifPanel(){');

sub('and the notes are rendered as those groups',
  '    html += CHANGELOG.map(entry => `\n' +
  '      <div style="border-bottom:1px solid var(--line); padding-bottom:10px;">\n' +
  '        <div style="font-weight:600; font-size:13.5px; margin-bottom:6px;">v${entry.version}${entry.date ? \' <span style="font-weight:400; font-size:11px; color:var(--ink-dim);">' + DOT + ' \' + entry.date + \'</span>\' : \'\'} ' + EM + ' ${escapeHtml(changelogTitle(entry))}</div>\n' +
  '        <div style="display:flex; flex-direction:column; gap:4px; font-size:12px; color:var(--ink-dim);">\n' +
  '          ${changelogItems(entry).map(i => `<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">' + BUL + '</span><span>${escapeHtml(i)}</span></div>`).join(\'\')}\n' +
  '        </div>\n' +
  '      </div>\n' +
  '    `).join(\'\');',
  '    html += CHANGELOG.map((entry, idx) => {\n' +
  '      const v = String(entry.version);\n' +
  '      const open = changelogGroupsTouched ? openChangelogGroups.has(v) : idx === 0;\n' +
  '      const items = changelogItems(entry);\n' +
  '      const glance = items.length ? String(items[0]) : \'\';\n' +
  '      const glanceShort = glance.length > 132 ? glance.slice(0, 129).replace(/\\s+\\S*$/, \'\') + \'' + DOTS + '\' : glance;\n' +
  '      const n = items.length;\n' +
  '      return `\n' +
  '      <div style="border-bottom:1px solid var(--line);">\n' +
  '        <button class="cl-hdr" data-cl-group="${escapeHtml(v)}" aria-expanded="${open ? \'true\' : \'false\'}" style="width:100%; display:flex; gap:10px; align-items:flex-start; text-align:left; background:none; border:none; padding:9px 0; color:var(--ink); cursor:pointer; font-family:var(--font-ui);">\n' +
  '          <span style="flex:1; min-width:0;">\n' +
  '            <span style="font-weight:600; font-size:13.5px;">v${escapeHtml(v)}${entry.date ? \' <span style="font-weight:400; font-size:11px; color:var(--ink-dim);">' + DOT + ' \' + entry.date + \'</span>\' : \'\'}</span>\n' +
  '            <span style="display:block; font-size:12.5px; margin-top:3px;">${escapeHtml(changelogTitle(entry))}</span>\n' +
  '            <span data-cl-glance="${escapeHtml(v)}" style="display:${open ? \'none\' : \'block\'}; font-size:11.5px; color:var(--ink-dim); margin-top:4px; line-height:1.45;">${escapeHtml(glanceShort)}</span>\n' +
  '            <span style="display:block; font-size:11px; color:var(--ink-dim); margin-top:5px;">${n} update${n === 1 ? \'\' : \'s\'} ' + DOT + ' ${open ? \'tap to close\' : \'tap for the detail\'}</span>\n' +
  '          </span>\n' +
  '          <span class="cl-chev" style="flex-shrink:0; color:var(--ink-dim); font-size:12px; line-height:1.35; transform:rotate(${open ? \'0deg\' : \'-90deg\'}); transition:transform 0.2s ease;">' + CARET + '</span>\n' +
  '        </button>\n' +
  '        <div data-cl-body="${escapeHtml(v)}" style="display:${open ? \'flex\' : \'none\'}; flex-direction:column; gap:5px; font-size:12px; color:var(--ink-dim); padding:0 0 12px 2px;">\n' +
  '          ${changelogItems(entry).map(i => `<div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">' + BUL + '</span><span>${escapeHtml(i)}</span></div>`).join(\'\')}\n' +
  '        </div>\n' +
  '      </div>\n' +
  '    `;\n' +
  '    }).join(\'\');');

sub('and one delegated listener opens and closes them in place',
  '    summary.innerHTML = summaryHtml;\n' +
  '    body.innerHTML = html;',
  '    summary.innerHTML = summaryHtml;\n' +
  '    body.innerHTML = html;\n' +
  '    // Wired once: this panel is re-rendered again and again while a job is\n' +
  '    // reporting progress, and a fresh listener per render would stack them up.\n' +
  '    // Opening a group changes the DOM in place, never by re-rendering - that\n' +
  '    // would throw away the reader\'s place in the notes.\n' +
  '    if(!body._scClWired){\n' +
  '      body._scClWired = true;\n' +
  '      body.addEventListener(\'click\', function(ev){\n' +
  '        const h = ev.target && ev.target.closest ? ev.target.closest(\'[data-cl-group]\') : null;\n' +
  '        if(!h) return;\n' +
  '        const v = h.getAttribute(\'data-cl-group\');\n' +
  '        if(!v) return;\n' +
  '        // The first tap adopts what is already open on screen: the newest entry\n' +
  '        // opens by itself, and it has to stay open - a re-render that shut it\n' +
  '        // the moment the reader opened an older release would be the opposite\n' +
  '        // of helpful.\n' +
  '        if(!changelogGroupsTouched){\n' +
  '          changelogGroupsTouched = true;\n' +
  '          const shown = body.querySelectorAll(\'[data-cl-body]\');\n' +
  '          for(let i = 0; i < shown.length; i++){\n' +
  '            if(shown[i].style.display !== \'none\'){\n' +
  '              const sv = shown[i].getAttribute(\'data-cl-body\');\n' +
  '              if(sv) openChangelogGroups.add(sv);\n' +
  '            }\n' +
  '          }\n' +
  '        }\n' +
  '        const wasOpen = openChangelogGroups.has(v);\n' +
  '        if(wasOpen) openChangelogGroups.delete(v); else openChangelogGroups.add(v);\n' +
  '        scApplyChangelogGroup(v, !wasOpen);\n' +
  '      });\n' +
  '    }');

// ═══════════════════════════════════════════════════════════════════════════
// 6 - the album that lost a few songs
// ═══════════════════════════════════════════════════════════════════════════
sub('a title key too short to be trusted can no longer reject a source',
  '  function scSourceClaimsSibling(candTitle, myTitle, myKey, siblingKeys){\n' +
  '    if(!candTitle || !siblingKeys) return false;\n' +
  '    var mine = String(myKey || scTrackTitleKey(myTitle) || \'\');\n' +
  '    if(!mine) return false;\n' +
  "    var mineStrong = scTitleStrong(mine, '', candTitle);\n" +
  '    for(var k in siblingKeys){\n' +
  '      if(!k || k === mine) continue;\n' +
  "      if(!scTitleStrong(k, '', candTitle)) continue;   // not that sibling's upload either",
  '  // Is this title key specific enough to throw a source away over? The sibling\n' +
  '  // test below is a SUBSTRING test, so a key with no word longer than three\n' +
  '  // characters ("ok", "ya", "pt 1") matches inside unrelated titles - "ok" sits\n' +
  '  // inside "smoking", "ya" inside "yacht", "1" inside "2021". An album with one\n' +
  '  // such track title in the run therefore threw the RIGHT recording away for its\n' +
  '  // neighbours, which is an album that comes back with a few songs missing while\n' +
  '  // the rest are fine. A key that weak can only CONFIRM a source now, never\n' +
  '  // reject one - the same rule the artist credit check already carries for a\n' +
  '  // short name. It can only ever turn a refusal into an acceptance: a source\n' +
  '  // still has to pass the artist and title checks afterwards.\n' +
  '  function scTitleKeyIsStrong(k){\n' +
  "    var words = String(k || '').split(' ');\n" +
  '    for(var i = 0; i < words.length; i++){ if(words[i].length >= 4) return true; }\n' +
  '    return false;\n' +
  '  }\n' +
  '  function scSourceClaimsSibling(candTitle, myTitle, myKey, siblingKeys){\n' +
  '    if(!candTitle || !siblingKeys) return false;\n' +
  '    var mine = String(myKey || scTrackTitleKey(myTitle) || \'\');\n' +
  '    if(!mine) return false;\n' +
  "    var mineStrong = scTitleStrong(mine, '', candTitle);\n" +
  '    for(var k in siblingKeys){\n' +
  '      if(!k || k === mine) continue;\n' +
  '      if(!scTitleKeyIsStrong(k)) continue;             // too weak to reject on\n' +
  "      if(!scTitleStrong(k, '', candTitle)) continue;   // not that sibling's upload either");

sub('and a search that could not reach the source is tried once more',
  "    var cands = await scYtSearch(query, artist, album);\n" +
  '    if(!cands || !cands.length){\n' +
  '      // Two different failures used to share one line.',
  "    var cands = await scYtSearch(query, artist, album);\n" +
  '    // One retry, and only when the source could not be REACHED (__scHttpWhy is\n' +
  '    // set by the transport itself). A run of songs is a burst of requests, and a\n' +
  '    // search in the middle of one can come back blocked or rate-limited instead\n' +
  '    // of empty - that song used to be failed for the rest of the run, which is\n' +
  '    // what "a few songs of the album" looks like. A search that plainly answered\n' +
  '    // with nothing is never repeated, so a track that simply is not there costs\n' +
  '    // no extra request.\n' +
  '    if((!cands || !cands.length) && window.__scHttpWhy){\n' +
  '      await new Promise(function(r){ setTimeout(r, 900); });\n' +
  "      window.__scHttpWhy = '';\n" +
  '      cands = await scYtSearch(query, artist, album);\n' +
  '    }\n' +
  '    if(!cands || !cands.length){\n' +
  '      // Two different failures used to share one line.');

// ═══════════════════════════════════════════════════════════════════════════
// 7 - the release itself
// ═══════════════════════════════════════════════════════════════════════════
function headEntry() {
  const newMark = "  { version: '" + VER + "',";
  if (src.indexOf(newMark) !== -1) return skip('CHANGELOG head entry');
  const items = NOTES.map((n) => "    '" + n + "',").join('\n');
  const block = "  { version: '" + VER + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [\n" +
    items + '\n  ] },\n';
  const headMark = 'const CHANGELOG = [\n';
  if (src.indexOf(headMark) === -1) throw new Error('CHANGELOG opener not found');
  src = src.replace(headMark, headMark + block);
  done('CHANGELOG head entry (' + VER + ')');
}

sub('APP_VERSION',
  "  const APP_VERSION = '" + OLD_VER + "';",
  "  const APP_VERSION = '" + VER + "';",
  1, "const APP_VERSION = '" + VER + "';");

headEntry();
fs.writeFileSync(FILE, src);

const SW = path.join(ROOT, 'sw.js');
const swTxt = fs.readFileSync(SW, 'utf8');
const newSw = "const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'";
if (swTxt.includes(newSw)) {
  console.log('= sw.js CACHE_NAME (already v' + SW_CACHE + ')');
} else {
  const oldSw = "const CACHE_NAME = 'sidecut-shell-v" + OLD_SW_CACHE + "'";
  const n = swTxt.split(oldSw).length - 1;
  if (n !== 1) throw new Error('sw.js: found ' + n + ' CACHE_NAME occurrence(s), want 1');
  fs.writeFileSync(SW, swTxt.split(oldSw).join(newSw));
  console.log('+ sw.js CACHE_NAME -> sidecut-shell-v' + SW_CACHE);
}

// Version pins across the suite. Gates that describe an OLDER release read it by
// version with a regex (test-663, test-6641, test-6642, test-66421, test-66422)
// and pin nothing here; dev/test-66423 (64.2.3) pins the head entry, which is
// this release's now, so it is moved to read the 64.2.3 entry by version below.
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

function fileSub(rel, pairs) {
  const p = path.join(ROOT, rel);
  let t = fs.readFileSync(p, 'utf8');
  const beforeT = t;
  for (const [a, b] of pairs) {
    if (t.indexOf(b) !== -1) { console.log('= ' + rel + ' (already applied)'); continue; }
    if (t.indexOf(a) === -1) { console.log('= ' + rel + ' (nothing to apply)'); continue; }
    t = t.split(a).join(b);
    console.log('+ ' + rel);
  }
  if (t !== beforeT) fs.writeFileSync(p, t);
}

// dev/test-66423.mjs is 64.2.3's gate, and it pins the head entry - which is this
// release's now. It reads the 64.2.3 entry by version instead, exactly as
// test-66422 was moved to read 64.2.2 by version at 64.2.3. The replacement uses
// a regex, never a quoted literal, because the bump above rewrites quoted version
// literals in every dev/test-*.mjs.
fileSub('dev/test-66423.mjs', [
  ["  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');\n" +
   '  if (entries) {\n' +
   '    const head = entries[0];',
   '  ok(!!entries && String(entries[0].version) === ver, \'the newest changelog matches APP_VERSION (\' + (entries && entries[0].version) + \')\');\n' +
   '  // The head entry belongs to whatever shipped last, so read the 64.2.3 entry by\n' +
   '  // version: this gate describes 64.2.3.\n' +
   '  const entry6423 = entries ? entries.find((x) => /^64\\.2\\.3$/.test(String(x.version))) : null;\n' +
   "  ok(!!entry6423 && String(entry6423.version) === '64.2.3', 'the 64.2.3 entry this gate describes is still here');\n" +
   '  if (entry6423) {\n' +
   '    const head = entry6423;'],
  ["    ok(String(head.version) === VER, 'the head entry is v' + head.version);",
   "    ok(String(head.version) === '64.2.3', 'the entry this gate describes is v' + head.version);"],
  ["    ok(String(head.date).indexOf('7:40 PM') === -1, 'and it is not ' + PREV + \"'s stamp\");",
   "    ok(String(head.date).indexOf('7:40 PM') === -1, 'and it is not ' + PREV + \"'s stamp\");\n" +
   "    ok(head.items && head.items.every((it) => it.length <= 260), 'and every 64.2.3 note is still short');"],
]);

// Three gates pin the chip clean-up as an exact line, and 64.2.4 adds the
// "does anything actually need this?" count to the same line. The cleanup they
// describe is unchanged - a chip still holding a drag lift is still put back to
// a plain chip - so they are moved to the line as it now reads, the way
// dev/test-6642.mjs and dev/test-6641.mjs were moved by 64.2.3.
const CHIP_OLD = "if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; }";
const CHIP_NEW = "if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }";
for (const rel of ['dev/test-66423.mjs', 'dev/test-6642.mjs', 'dev/railpaint-6423-check.cjs']) {
  fileSub(rel, [[CHIP_OLD, CHIP_NEW]]);
}

// dev/chatvis-6422-check.cjs drives a settled scroll over Home, and it pinned the
// same promotion-on-every-scroll shape as the rail probe. It is moved the same
// way: a healthy grid is not re-rastered, a grid that really lost a bubble still
// is (its own next check), and the fresh paint for real damage is asserted where
// the drag carry is left behind.
fileSub('dev/chatvis-6422-check.cjs', [
  [`  console.log('\\n` + EM + ' a settled scroll never hides the grid ' + EM + `');`,
   `  console.log('\\n` + EM + ' a settled scroll never hides the grid, and no longer re-rasters a healthy one ' + EM + `');`],
  [`    ok('the repaint promoted the grid instead', frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));`,
   `    ok('and a healthy grid is not re-rastered at all', !frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));`],
  [`    const fav = grid.querySelector('.home-bubble[data-bubble="favorites"]');\n    fav.parentNode.removeChild(fav);\n    await settle(win);\n    ok('a grid that lost a bubble is still drawn again', !!grid.querySelector('.home-bubble[data-bubble="favorites"]'));`,
   `    const fav = grid.querySelector('.home-bubble[data-bubble="favorites"]');\n    fav.parentNode.removeChild(fav);\n    await settle(win);\n    ok('a grid that lost a bubble is still drawn again', !!grid.querySelector('.home-bubble[data-bubble="favorites"]'));\n    // ... and a bubble left holding what a drag gives it is the other kind of\n    // damage, which is the one the fresh raster is for.\n    const b = grid.querySelector('.home-bubble[data-bubble="notifications"]');\n    b.classList.add('hb-dragging');\n    b.style.position = 'fixed';\n    b.style.transform = 'translate(0px, 0px) scale(1.05)';\n    const dragFrames = [];\n    win.requestAnimationFrame = function (cb) {\n      return raf(function (t) {\n        dragFrames.push({ t: grid.style.transform });\n        cb(t);\n      });\n    };\n    await settle(win);\n    win.requestAnimationFrame = raf;\n    ok('the drag carry is cleared', !!b && !b.classList.contains('hb-dragging'));\n    ok('and that grid really was rastered again', dragFrames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(dragFrames.slice(0, 3)));`],
]);

// dev/railpaint-6423-check.cjs drives a settled scroll for real. 64.2.3 asserted
// that a settled scroll promotes the strip (that was the fix then); 64.2.4 made
// the promotion repair-only, so the recording is asserted the new way - a healthy
// rail does no raster work at all, and a chip left carrying a drag still gets the
// fresh paint. The probe is updated by hand, the way test-6642/test-6641 were.
fileSub('dev/railpaint-6423-check.cjs', [
  ['  console.log(\'\\n' + EM + ' a settled scroll never hides the strip (the reported blink) ' + EM + "');",
   '  console.log(\'\\n' + EM + ' a settled scroll never hides the strip, and no longer re-rasters a healthy one ' + EM + "');"],
  [`    ok('the repaint promoted the strip instead', frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));
    ok('and left nothing promoted behind', !strip.style.transform, strip.style.transform);`,
   `    ok('and a healthy rail is not re-rastered at all', !frames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(frames.slice(0, 3)));
    ok('nothing was promoted and left behind', !strip.style.transform, strip.style.transform);`],
  ['  console.log(\'\\n' + EM + ' a rail with no chips on the page is still rebuilt ' + EM + "');",
   '  console.log(\'\\n' + EM + ' a chip left carrying a drag still gets the fresh paint ' + EM + "');\n" +
   '  {\n' +
   "    const chip = list.querySelector('.pinned-artist-chip');\n" +
   "    chip.style.transform = 'translate(4px, 4px) scale(1.04)';\n" +
   "    chip.style.zIndex = '5';\n" +
   "    chip.style.boxShadow = '0 8px 24px rgba(0,0,0,0.5)';\n" +
   '    const dragFrames = [];\n' +
   '    const raf2 = win.requestAnimationFrame.bind(win);\n' +
   '    win.requestAnimationFrame = function (cb) {\n' +
   '      return raf2(function (t) {\n' +
   '        dragFrames.push({ t: strip.style.transform });\n' +
   '        cb(t);\n' +
   '      });\n' +
   '    };\n' +
   '    await settle(win);\n' +
   '    win.requestAnimationFrame = raf2;\n' +
   "    ok('the drag carry is cleared', !chip.style.transform && !chip.style.zIndex, chip.style.transform);\n" +
   "    ok('and that rail really was rastered again', dragFrames.some((f) => /translateZ/.test(f.t || '')), JSON.stringify(dragFrames.slice(0, 3)));\n" +
   "    ok('with nothing left promoted', !strip.style.transform, strip.style.transform);\n" +
   '  }\n\n' +
   '  console.log(\'\\n' + EM + ' a rail with no chips on the page is still rebuilt ' + EM + "');"],
]);

console.log('patch-66424: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
// Comments talk about the code these checks are looking for, so every "is it
// gone" test runs over the code only (the same strip dev/test-6058.mjs uses).
const noComments = (s) => s.replace(/^\s*\/\/.*$/gm, '');
const railAt = final.indexOf('  function repaintPinnedRail(list){');
const railEnd = final.indexOf('  (function watchPinnedRail(){');
const rail = railAt === -1 || railEnd === -1 ? '' : final.slice(railAt, railEnd);
const gridAt = final.indexOf('  function repaintHomeGrid(){');
const gridEnd = final.indexOf('  function homeGridIsWhole(){');
const grid = gridAt === -1 || gridEnd === -1 ? '' : final.slice(gridAt, gridEnd);

// 1 - the launch
must(has('(function scPrepaintTheme(){'), 'the app has a prepaint theme step');
must(has("root.setProperty('--bg', c.bg);"), 'it applies the cached colours before the first paint');
must(has("localStorage.setItem('sidecut_theme_prepaint'"), 'and applyTheme caches what it applied');
const prepaintAt = final.indexOf('(function scPrepaintTheme(){');
const themeAt = final.indexOf('  function applyTheme(key){');
must(prepaintAt !== -1 && themeAt !== -1 && prepaintAt < themeAt, 'and the cache is applied before the app script runs');

// 2 - the scroll
must(rail !== '' && !/visibility/.test(rail), 'the rail repaint still never hides the strip');
must(has('    if(!carried) return;\n' + "    var strip = $('pinnedArtistsStrip');"), 'a healthy rail is left alone');
must(has("        if(c.style.transform){ c.style.transform = ''; c.style.zIndex = ''; c.style.boxShadow = ''; carried++; }"),
  'a chip still carrying a drag lift is still put back, and counts as damage');
must(has("    strip.style.transform = 'translateZ(0)';"), 'the fresh raster is still there for real damage');
must(grid !== '' && !/visibility/.test(grid), 'the Home repaint still never hides the grid');
must(has("      for(var i = 0; i < phs.length; i++){ if(phs[i].parentNode){ phs[i].parentNode.removeChild(phs[i]); carried++; } }"),
  'a placeholder an abandoned drag left still counts as damage');
must(has("        carried++;\n      }\n    }catch(_eCarry){}\n    if(!carried) return;"), 'and so does a carried bubble');
must(!/void (wrap|strip)\.offsetHeight/.test(noComments(final)), 'no settled scroll lays the page out again');
must(!/offsetHeight|getBoundingClientRect/.test(noComments(grid + rail)), 'and none of it measures anything');

// 3 - the glow
must(has('  .track.playing::after{'), 'the playing row glows from its own layer');
must(!/animation: glowPulse 2s ease-in-out infinite;\n    z-index:0;/.test(noComments(final)), 'and no longer animates a box-shadow');
must(has('    0%, 100%{ opacity:0.4; }\n    50%{ opacity:1; }'), 'the pulse is an opacity pulse');
must(has('    box-shadow: inset 3px 0 0 var(--coral);\n    z-index:0;'), 'with the row itself left static');

// 4 - the button
const libGroup = final.indexOf('<!-- Collapsible: Library Tools & Fetching -->');
const wmGroup = final.indexOf('<!-- Watermark Remover -->');
const storageGroup = final.indexOf('<!-- Collapsible: Storage -->');
const refetchAt = final.indexOf('id="refetchCoversBtn"');
must(refetchAt !== -1 && refetchAt > libGroup && refetchAt < wmGroup, 'the cover refetch is inside the library group');
must(refetchAt < storageGroup, 'and not down in Storage');
must(final.indexOf('id="refetchCoversBtn"', refetchAt + 10) === -1, 'it is on the page exactly once');
must(has('<span id="refetchCoversLabel">Refetch missing covers</span>'), 'with its label in its own element');
must(has('  function scSetRefetchLabel(txt){'), 'so the ONLINE badge survives a run');
must(!/refetchCoversBtn'\)\.textContent/.test(noComments(final)), 'and nothing writes over the badge');
must(final.indexOf("scSetRefetchLabel('Fetching...');") !== -1 && final.indexOf("scSetRefetchLabel('Refetch missing covers');") !== -1
  && final.indexOf('scSetRefetchLabel(`${window.coverFetchState.done}/${total}`);') !== -1,
  'the whole run reports through it');

// 5 - the patch notes
must(has('  function scApplyChangelogGroup(v, open){'), 'one group can be opened in place');
must(has('data-cl-group="${escapeHtml(v)}"') && has('aria-expanded="${open ? \'true\' : \'false\'}"'),
  'each release is a header that says whether it is open');
must(has('data-cl-body="${escapeHtml(v)}"') && has('data-cl-glance="${escapeHtml(v)}"'), 'with its notes and its glance behind it');
must(has("      const open = changelogGroupsTouched ? openChangelogGroups.has(v) : idx === 0;"),
  'the newest release is open and the rest are shut until tapped');
must(has("    if(!body._scClWired){"), 'and the toggles are wired once, not once per render');
must(has("          const shown = body.querySelectorAll('[data-cl-body]');"),
  'the first tap remembers what was already open, so the newest entry stays open');
must(count('changelogItems(entry).map') >= 3, 'every bullet renderer still runs through the filter (' + count('changelogItems(entry).map') + ')');
must(count('changelogItems(entry).length') >= 4, 'and every count does too (' + count('changelogItems(entry).length') + ')');
must(count('entry.items') === 1, 'raw entry.items is still only read inside the filter helper (' + count('entry.items') + ')');

// 6 - the album
must(has('  function scTitleKeyIsStrong(k){'), 'a title key can be judged too weak to reject on');
must(has('      if(!scTitleKeyIsStrong(k)) continue;             // too weak to reject on'), 'and a weak one is skipped');
must(has('    if((!cands || !cands.length) && window.__scHttpWhy){'), 'a search that could not reach the source is retried');
must(has('      cands = await scYtSearch(query, artist, album);\n' + '    }\n' + '    if(!cands || !cands.length){'),
  'exactly once, and only for a transport failure');

// 7 - the release
must(final.indexOf("  const APP_VERSION = '" + VER + "';") !== -1, 'APP_VERSION = ' + VER);
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
    must(/blink/i.test(notes), 'and naming what was reported');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
    must(entries.some((e) => /^64\.2\.3$/.test(String(e.version))), 'and the release before it is still listed');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(SW, 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

const t66423 = fs.readFileSync(path.join(ROOT, 'dev/test-66423.mjs'), 'utf8');
must(t66423.indexOf("const entry6423 = entries ? entries.find((x) => /^64\\.2\\.3$/.test(String(x.version))) : null;") !== -1,
  'dev/test-66423.mjs reads the 64.2.3 entry by version now');
const tRail = fs.readFileSync(path.join(ROOT, 'dev/railpaint-6423-check.cjs'), 'utf8');
must(tRail.indexOf('a healthy rail is not re-rastered at all') !== -1, 'the rail probe asserts the new behaviour');
must(tRail.indexOf('and that rail really was rastered again') !== -1, 'and that real damage is still repaired');
for (const rel of ['dev/test-66423.mjs', 'dev/test-6642.mjs', 'dev/railpaint-6423-check.cjs']) {
  must(fs.readFileSync(path.join(ROOT, rel), 'utf8').indexOf(CHIP_NEW) !== -1,
    rel + ' reads the chip clean-up as it now is');
}
const tChat = fs.readFileSync(path.join(ROOT, 'dev/chatvis-6422-check.cjs'), 'utf8');
must(tChat.indexOf('and a healthy grid is not re-rastered at all') !== -1, 'the Home probe asserts the new behaviour');
must(tChat.indexOf('and that grid really was rastered again') !== -1, 'and that real damage is still repaired');

// The grouped notes and the move must carry their real glyphs, not a stand-in:
// this script is ASCII, the page is not.
must(final.indexOf(BUL) !== -1 && final.indexOf(DOTS) !== -1 && final.indexOf(CARET) !== -1,
  'the grouped notes carry their real glyphs');

if (problems.length) {
  console.error('\npatch-66424: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66424: all verification checks passed (' + edits + ' edit(s))');
