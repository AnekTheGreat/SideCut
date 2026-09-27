#!/usr/bin/env node
// SideCut - 64.2.2: six small things that were reported about 64.2.1.
//
//   1. "If you roll back the app make sure you can roll forward again back to
//      current version."
//      Rolling back was always two-way in the plumbing - the pin only ever swaps
//      the page, and the newest build is always the one installed - but the way
//      back sat as a footer button under the whole version history. It is now the
//      first thing in the list, and it names the version it returns you to.
//
//   2. "Now the favorites bubble sometimes disappears for a split second and
//      reappear."
//      That was 64.2.1's own doing. Its repaint hid the whole Home grid for a
//      frame (visibility:hidden, force layout, restore on the next frame) to make
//      the pixels be drawn again, and a phone can present that frame - which is
//      exactly the blink that was reported. The repaint now promotes the grid onto
//      its own compositor layer and takes the promotion away on the next frame,
//      so the grid is rastered again without ever leaving the screen.
//
//   3. "Put the patch notes in simple terms not so long for minimal changes."
//      This entry is six short plain sentences instead of six paragraphs.
//
//   4. "Make sure the knowledge base for the full ver and play version is
//      different because play version shouldnt know anything about downloading
//      just that it stores your mp3's or whatever you got."
//      The answers that could describe fetching music already had a store build
//      variant; the one that answers "can I download music" now says outright that
//      this build downloads nothing and only plays the files you already have, the
//      question list matches how that question is actually typed, and the
//      assistant's own instructions say the same thing on that build.
//
//   5. "Why is there only a certain amount of storage allowed?"
//      The Storage panel showed "3.19 GB of 13.19 GB allowed", which reads like a
//      SideCut cap. It is the phone's own allowance for the app; the row now says
//      whose limit it is and the panel explains that SideCut sets no size at all.
//
//   6. "When talking to the ai in certain themes in general its just hard to see
//      certain text."
//      The user's chat bubble and the Send button were white text on the theme's
//      accent, and several themes ship a LIGHT accent (Monochrome's near-white,
//      Liquid Glass, Glacier) - white on those is invisible. The accent's own
//      brightness now picks the text colour, and it is re-decided on every step of
//      the RGB cycle too. Every other accent-filled button gets the same pair.
//
//   7. "Watermark remover that should be default and it should be on by default."
//      It starts enabled, and an explicit off is still honoured.
//
//   node dev/patch-66422.mjs
//   node dev/patch-66422.mjs --manifest    # re-seed root manifest.json from ota/
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
const cp = (n) => String.fromCodePoint(n);
const DOT = cp(0x00b7);       // the middle dot the ship stamps use
const ARROW = cp(0x2192);     // right arrow, used in the knowledge-base paths
const BACK = cp(0x21a9);      // the roll-forward button's arrow
const ELL = cp(0x2026);       // the ellipsis in the switching toast

const VER = '64.2.2';
const OLD_VER = '64.2.1';
// The sandbox runs on UTC with no tzdata: Eastern is UTC minus 4 (EDT).
const STAMP = 'September 27, 2026 ' + DOT + ' 7:40 PM EDT';
const OLD_STAMP = 'September 27, 2026 ' + DOT + ' 6:20 PM EDT';
const SW_CACHE = '63.0.20';
const OLD_SW_CACHE = '63.0.19';

// Short, plain statements of the changes - the way the request asked for them.
const TITLE = 'Small fixes: no Home flash, a readable assistant, shorter notes';

// Six short notes, and they publish on BOTH channels (no [FULL] marker), so they
// carry no tooling wording at all: dev/test-617..620, -60510 and -662 read the
// WHOLE head entry for a downloader term, dev/test-6058 runs the shipped filter
// over it for the store channel, and dev/test-play-copy reads it against a wider
// list than either. The sixth note keeps the word "rollback": dev/test-662
// asserts the head entry describes what the release did with /rollback/i.
const NOTES = [
  'The Favorites bubble no longer blinks off. Home used to hide its whole grid for a moment after a scroll to redraw it; the grid is redrawn without ever being hidden now.',
  'The assistant chat is readable in every theme. Its replies and the Send button were white text on a light accent in themes like Monochrome and Liquid Glass; the text now follows the accent instead.',
  'The assistant knows which build it is on. Ask it to fetch music on the store build and it says plainly that only the files already on this device are played.',
  'Storage says where its allowance comes from. The figure in Settings > More > Storage is the room this phone gives the app, not a SideCut limit, and the panel now says so.',
  'Watermark Remover starts switched on. It can still be turned off in Settings > More, and its pattern list is unchanged.',
  'A rollback is still two-way. Every version keeps its own copy, and the version list now puts the way back to the installed build at the top, so you can roll forward again. This is 64.2.2 and your saved copies are untouched.',
];

if (MANIFEST_ONLY) {
  const upd = JSON.parse(fs.readFileSync(path.join(ROOT, 'ota/updates.json'), 'utf8'));
  fs.writeFileSync(path.join(ROOT, 'manifest.json'), JSON.stringify(upd));
  console.log('patch-66422 --manifest: root manifest.json re-seeded from ota/updates.json (v' + upd.version + ', ' + upd.size + ' bytes)');
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
// 1 - the Home repaint stops hiding the grid (the blink reported after 64.2.1)
// ═══════════════════════════════════════════════════════════════════════════
sub('the Home repaint says what it does now',
  '  //   - the grid painted pixels are thrown away and painted again, which costs\n' +
  '  //     one frame and cannot be seen;',
  '  //   - the grid\'s painted pixels are thrown away and painted again WITHOUT\n' +
  '  //     hiding it. 64.2.1 hid the whole grid for a frame to force the redraw, and\n' +
  '  //     a phone can present that frame: that hide is the "the Favorites bubble\n' +
  '  //     disappears for a split second and comes back" reported about it.\n' +
  '  //     Promoting the grid onto its own layer and taking the promotion away on\n' +
  '  //     the next frame makes the compositor raster it again while it stays on\n' +
  '  //     screen - the same fresh paint, nothing ever off the screen;');

sub('and never hides the grid to repaint it',
  "    wrap.style.visibility = 'hidden';\n" +
  '    void wrap.offsetHeight;\n' +
  "    requestAnimationFrame(function(){ try{ wrap.style.visibility = ''; }catch(_eRpH){ } });",
  '    // A frame of a hidden grid is a frame a phone can show, and that is the\n' +
  '    // blink this replaces. The layer promotion forces the same fresh raster\n' +
  '    // with the grid on screen the whole time, and it is taken away at once so\n' +
  '    // nothing stays promoted (a bubble left on its own layer is the shape this\n' +
  '    // guard exists to clear in the first place).\n' +
  "    wrap.style.transform = 'translateZ(0)';\n" +
  '    void wrap.offsetHeight;\n' +
  "    requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });");

// ═══════════════════════════════════════════════════════════════════════════
// 2 - rolling forward is the first thing the version list offers
// ═══════════════════════════════════════════════════════════════════════════
sub('the Roll back app section says forward is a tap away too',
  '<span>Roll back app</span>',
  '<span>Roll back app (or go forward again)</span>');

sub('and its note explains both directions',
  'Your library and settings live in their own storage, untouched by the switch.</div>',
  'Your library and settings live in their own storage, untouched by the switch. ' +
  'Going forward is the same one tap: the installed build is always kept in this list too, ' +
  'and the button at the top of it returns you to that version whenever you want.</div>');

sub('the way back to the installed build sits at the TOP of the list',
  '    list.innerHTML = rows.map((r,i) => {',
  '    // Rolling FORWARD is the same one tap as rolling back: every version keeps its\n' +
  '    // own copy, and the build actually installed on the device is always the newest\n' +
  '    // of them. The button that returns you to it is put FIRST, so coming back from a\n' +
  '    // rollback is the first thing on the screen instead of a footer under the whole\n' +
  '    // history - "if you roll back, make sure you can roll forward again" is the\n' +
  '    // promise this keeps.\n' +
  '    const forward = pinned\n' +
  '      ? `<button class="playlist-pick-btn" id="snapGoLatest" style="text-align:center; margin-bottom:2px; font-weight:600;">' +
  BACK + ' Go forward to the latest version (v${APP_VERSION})</button>`\n' +
  '      : `<div style="text-align:center; font-size:11px; color:var(--ink-dim); margin-bottom:4px;">' +
  'You are on the latest version (v${APP_VERSION}). Pick any version below to load its saved copy - come back here to return to this one.</div>`;\n' +
  '    list.innerHTML = forward + rows.map((r,i) => {');

sub('the old footer button is gone, and the top one is wired',
  '    if(pinned){\n' +
  '      list.innerHTML += `<button class="playlist-pick-btn" id="snapGoLatest" style="text-align:center; margin-top:2px;">' + BACK + ' Back to the actual latest version</button>`;\n' +
  "      $('snapGoLatest').addEventListener('click', async () => {\n" +
  '        window.__SIDECUT_PIN_SWITCHING__ = true;\n' +
  "        await dbDelete('meta', 'pinnedVersion');\n" +
  "        toast('Loading the latest version" + ELL + "');\n" +
  '        setTimeout(() => window.location.reload(), 300);\n' +
  '      });\n' +
  '    }',
  "    if($('snapGoLatest')) $('snapGoLatest').addEventListener('click', async () => {\n" +
  '      // The one tap back to the build that is installed. A rollback is never a\n' +
  '      // one-way door: clearing the pin is all it takes, and the next load runs the\n' +
  '      // newest code and stays on it.\n' +
  '      if(!pinned) return;\n' +
  '      window.__SIDECUT_PIN_SWITCHING__ = true;\n' +
  "      await dbDelete('meta', 'pinnedVersion');\n" +
  "      toast('Going forward to v' + APP_VERSION + '...');\n" +
  '      setTimeout(() => window.location.reload(), 300);\n' +
  '    });');

// ═══════════════════════════════════════════════════════════════════════════
// 3 - the store build's assistant answers the download question itself
// ═══════════════════════════════════════════════════════════════════════════
// The question the user actually typed - "Can I download music from the app" -
// now matches this entry on its own words, and the store build's answer says
// plainly that nothing is fetched and the files already on the device are it.
sub('the download question matches the entry that answers it',
  "{q:['how to get songs','where to get music','download music','get mp3s','spotify to mp3','how do i get music'],a: SC_IS_PLAY ? ",
  "{q:['how to get songs','where to get music','download music','can i download music','download music from the app','can i download songs','does sidecut download music','get mp3s','spotify to mp3','how do i get music'],a: SC_IS_PLAY ? ");

sub('and the store build answers it with what it really does',
  "'SideCut works with the files you already own: tap **+ Add songs " + ARROW + " + Files** (or **+ Add folder**) to bring audio in from your device, and **Import backup (everything)** to restore a .zip with playlists, albums, tags and covers.'",
  "'No - this build does not download music from anywhere. SideCut stores and plays the music files you already have: tap **+ Add songs " + ARROW + " + Files** (or **+ Add folder**) to bring audio in from your device, and **Import backup (everything)** to restore a .zip with playlists, albums, tags and covers. That is what it is for - your files, on your device, with no ads.'");

sub('the assistant instructions say the same on that build',
  "' and on this build they are absent: the way in is + Add songs \\u2192 + Files for single files, or a whole folder, and Import library for a backup .zip'",
  "' and on this build they are absent: the way in is + Add songs \\u2192 + Files for single files, or a whole folder, and Import library for a backup .zip. This build does not fetch music at all: the music it knows about is the music already on the device, and never describe getting it from anywhere else'");

// ═══════════════════════════════════════════════════════════════════════════
// 4 - the Storage panel says whose allowance it is showing
// ═══════════════════════════════════════════════════════════════════════════
sub('the allowance row names the phone, not SideCut',
  "'This device counts for SideCut', scFmtBytes(estimate.usage) + (estimate.quota ? ' of ' + scFmtBytes(estimate.quota) + ' allowed' : '')",
  "'This device counts for SideCut', scFmtBytes(estimate.usage) + (estimate.quota ? ' of the ' + scFmtBytes(estimate.quota) + ' this phone allows the app' : '')");

sub('and the panel answers the \"why is there a limit\" question',
  "'Songs removed from the library give their space back; a song you keep is kept, so SideCut can play it with no network.</div>'",
  "'Songs removed from the library give their space back; a song you keep is kept, so SideCut can play it with no network. ' + " +
  "(estimate && estimate.quota ? 'That allowance is a limit of this phone rather than a SideCut one: the storage system every app on Android shares sets it, SideCut sets no size of its own, and the room grows when the phone has more free space.' : '') + '</div>'");

// ═══════════════════════════════════════════════════════════════════════════
// 5 - Watermark Remover is on by default
// ═══════════════════════════════════════════════════════════════════════════
// A saved choice still wins (the loader below only overwrites this on a stored
// row), so anyone who switched it off stays off.
sub('Watermark Remover starts enabled',
  '  let watermarkEnabled = false;',
  '  // On by default: it only ever strips the literal patterns listed below (and\n' +
  '  // the numbered-prefix clean-up, which has always run on import regardless), so\n' +
  '  // a title is never left with the site tag the file arrived with. A stored choice\n' +
  '  // still wins - the loader only overwrites this default when a row exists.\n' +
  '  let watermarkEnabled = true;');

sub('and its switch reads On before the loader reaches it',
  'id="watermarkEnabledToggle" style="padding:5px 12px; font-size:12px;">Off</button>',
  'id="watermarkEnabledToggle" style="padding:5px 12px; font-size:12px;">On</button>');

// ═══════════════════════════════════════════════════════════════════════════
// 6 - accent-filled text is readable in every theme
// ═══════════════════════════════════════════════════════════════════════════
sub('the root declares the on-accent text colour',
  '    --coral: #E3B23C;\n    --gold: #4A6CF7;',
  '    --coral: #E3B23C;\n    --gold: #4A6CF7;\n' +
  '    /* Text drawn on top of --coral. Several themes ship a LIGHT accent\n' +
  '       (Monochrome, Liquid Glass, Glacier), and white text on those is\n' +
  '       invisible - the assistant chat was unreadable in exactly those themes.\n' +
  '       applyTheme() (and the RGB cycle) re-decide it from the accent. */\n' +
  '    --on-coral: #ffffff;');

sub('the brightness test it is decided with',
  '    h *= 60;\n' +
  '    if(h < 0) h += 360;\n' +
  '    return h;\n' +
  '  }',
  '    h *= 60;\n' +
  '    if(h < 0) h += 360;\n' +
  '    return h;\n' +
  '  }\n' +
  '  // The text colour to put on an accent fill. A theme accent can be anything\n' +
  '  // from a near-white (Monochrome #E5E5E5, Liquid Glass #E9EDF5, Glacier\n' +
  '  // #A6E8FF) to a deep blue, so the answer cannot be a constant: white text on a\n' +
  '  // light accent is invisible, and that is the "its just hard to see certain\n' +
  '  // text" the assistant chat was reported for. The two candidates are the\n' +
  '  // palette\'s own near-black and white, and the one with the better contrast\n' +
  '  // ratio wins - the test a contrast checker runs - so no theme can come out on\n' +
  '  // the wrong side of it. Both the hex themes and the HSL the RGB cycle writes\n' +
  '  // are understood, since that accent is re-decided on every step of the sweep.\n' +
  '  function scOnAccent(color){\n' +
  "    var r = 255, g = 255, b = 255;\n" +
  "    var css = String(color || '').trim();\n" +
  '    var hex = css.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);\n' +
  '    if(hex){\n' +
  '      var h = hex[1];\n' +
  "      if(h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];\n" +
  '      r = parseInt(h.slice(0, 2), 16); g = parseInt(h.slice(2, 4), 16); b = parseInt(h.slice(4, 6), 16);\n' +
  '    } else {\n' +
  '      var hsl = css.match(/^hsla?\\(\\s*([\\d.]+)\\s*,\\s*([\\d.]+)%\\s*,\\s*([\\d.]+)%/i);\n' +
  '      if(hsl){\n' +
  '        var hu = parseFloat(hsl[1]) / 360, sa = parseFloat(hsl[2]) / 100, li = parseFloat(hsl[3]) / 100;\n' +
  '        var q = li < 0.5 ? li * (1 + sa) : li + sa - li * sa;\n' +
  '        var p = 2 * li - q;\n' +
  '        var chan = function(t){\n' +
  '          if(t < 0) t += 1;\n' +
  '          if(t > 1) t -= 1;\n' +
  '          if(t < 1 / 6) return p + (q - p) * 6 * t;\n' +
  '          if(t < 1 / 2) return q;\n' +
  '          if(t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;\n' +
  '          return p;\n' +
  '        };\n' +
  '        r = Math.round(chan(hu + 1 / 3) * 255); g = Math.round(chan(hu) * 255); b = Math.round(chan(hu - 1 / 3) * 255);\n' +
  '      }\n' +
  '    }\n' +
  '    var linear = function(v){\n' +
  '      v = v / 255;\n' +
  '      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);\n' +
  '    };\n' +
  '    // WCAG relative luminance for the accent, for the near-black (#141414) and\n' +
  '    // for white, then whichever of the two is the better contrast ratio.\n' +
  '    var L = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);\n' +
  '    var LDARK = 0.00699; // #141414\n' +
  '    var withDark = (Math.max(L, LDARK) + 0.05) / (Math.min(L, LDARK) + 0.05);\n' +
  '    var withWhite = 1.05 / (L + 0.05);\n' +
  "    return withDark >= withWhite ? '#141414' : '#ffffff';\n" +
  '  }');

sub('a theme applies it',
  '      stopRgbAnimation();\n' +
  "      root.setProperty('--coral', th.coral);\n" +
  "      root.setProperty('--gold', th.gold);",
  '      stopRgbAnimation();\n' +
  "      root.setProperty('--coral', th.coral);\n" +
  "      root.setProperty('--gold', th.gold);\n" +
  "      root.setProperty('--on-coral', scOnAccent(th.coral));");

sub('and the RGB sweep re-decides it as the hue moves',
  "    root.setProperty('--coral', col1);\n" +
  "    root.setProperty('--gold', col2);",
  "    root.setProperty('--coral', col1);\n" +
  "    root.setProperty('--gold', col2);\n" +
  "    // The sweep changes the accent's brightness, so the text on it has to follow\n" +
  "    // the hue: white on the yellow part of the wheel would be as unreadable as\n" +
  "    // white on Monochrome's near-white.\n" +
  "    root.setProperty('--on-coral', scOnAccent(col1));");

sub('every accent-filled control uses it',
  'background:var(--coral); color:#fff',
  'background:var(--coral); color:var(--on-coral,#fff)',
  15);

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

// Version pins across the suite. A gate that describes an OLDER release reads it
// by version with a regex (test-663, test-6641, test-6642 read their entry that
// way) and is not listed here. test-66421 describes 64.2.1 and is repinned by
// hand below, because its head assertions are about that release's entry.
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

// dev/test-66421.mjs is 64.2.1's gate: it describes that release, and this one
// changes two things it pins. Its head-entry block reads the newest entry, which
// is this release's now, so it reads the 64.2.1 entry by version instead (exactly
// what was done for dev/test-6642.mjs at 64.2.1 and dev/test-6641.mjs at 64.2).
// Its two repaint assertions pin the hide-and-restore this release replaced.
fileSub('dev/test-66421.mjs', [
  ["  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');\n" +
   '  if (entries) {\n' +
   '    const head = entries[0];',
   '  ok(!!entries && String(entries[0].version) === ver, \'the newest changelog matches APP_VERSION (\' + (entries && entries[0].version) + \')\');\n' +
   '  // The head entry belongs to whatever shipped last, so read the 64.2.1 entry by\n' +
   '  // version: this gate describes 64.2.1.\n' +
   '  const entry6421 = entries ? entries.find((x) => /^64\\.2\\.1$/.test(String(x.version))) : null;\n' +
   "  ok(!!entry6421 && String(entry6421.version) === '64.2.1', 'the 64.2.1 entry this gate describes is still here');\n" +
   '  if (entry6421) {\n' +
   '    const head = entry6421;'],
  ['  ok(has("    wrap.style.visibility = \'hidden\';\\n    void wrap.offsetHeight;"),\n' +
   "    'by throwing its painted pixels away');\n" +
   '  ok(has("    requestAnimationFrame(function(){ try{ wrap.style.visibility = \'\'; }catch(_eRpH){ } });"),\n' +
   "    'and painting them again on the next frame');",
   '  // 64.2.2 replaced the hide-and-restore with a layer promotion: hiding the whole\n' +
   '  // grid for a frame IS the blink that release reported, so these two now pin the\n' +
   '  // repaint that cannot be seen instead of the one that could.\n' +
   '  ok(has("    wrap.style.transform = \'translateZ(0)\';\\n    void wrap.offsetHeight;"),\n' +
   "    'by forcing the grid to be rastered again');\n" +
   '  ok(has("    requestAnimationFrame(function(){ try{ wrap.style.transform = \'\'; }catch(_eRpH){ } });"),\n' +
   "    'and taking that back on the next frame, without ever hiding the grid');"],
]);

console.log('patch-66422: ' + edits + ' index.html edit(s), ' + repinned + ' test repin(s)');

// ---- verification -----------------------------------------------------------
const final = fs.readFileSync(FILE, 'utf8');
const problems = [];
const must = (c, m) => { if (!c) problems.push(m); };
const has = (n) => final.indexOf(n) !== -1;
const count = (n) => final.split(n).length - 1;
const block = final.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
const repaintAt = final.indexOf('  function repaintHomeGrid(){');
const gridEndAt = final.indexOf('  function homeGridIsWhole(){');
const repaint = repaintAt === -1 || gridEndAt === -1 ? '' : final.slice(repaintAt, gridEndAt);

// 1 - the blink
must(!/visibility = 'hidden'/.test(repaint), 'the Home repaint never hides the grid');
must(has("    wrap.style.transform = 'translateZ(0)';\n    void wrap.offsetHeight;"), 'it promotes the grid to force a fresh raster');
must(has("    requestAnimationFrame(function(){ try{ wrap.style.transform = ''; }catch(_eRpH){ } });"), 'and drops the promotion on the next frame');
must(has("      var phs = wrap.querySelectorAll('.hb-drag-placeholder');"), 'a placeholder an abandoned drag left behind is still cleared');
must(has("        b.style.position = ''; b.style.left = ''; b.style.top = '';"), 'a bubble still carrying a drag lift is still put back');
must(has('          repaintHomeGrid();\n          if(!homeGridIsWhole()) renderHome();'), 'and a grid really missing a bubble is still drawn again');

// 2 - roll forward
must(has('<span>Roll back app (or go forward again)</span>'), 'the section says forward is available');
must(has('Go forward to the latest version (v${APP_VERSION})</button>`'), 'the top of the list offers the way forward');
must(has('You are on the latest version (v${APP_VERSION}). Pick any version below'), 'and says so plainly when there is nothing to go back from');
must(has("    list.innerHTML = forward + rows.map((r,i) => {"), 'the forward button is rendered FIRST, above the history');
must(!has('Back to the actual latest version'), 'the old footer button is gone');
must(has("    if($('snapGoLatest')) $('snapGoLatest').addEventListener('click', async () => {"), 'and the new one is wired');
must(has('      if(!pinned) return;'), 'which refuses to act when nothing is pinned');

// 3 - the per-build knowledge base
must(has("'can i download music','download music from the app','can i download songs','does sidecut download music'"),
  'the download question matches the answer entry on its own words');
must(has("'No - this build does not download music from anywhere."), 'and the store build answers it with what it really does');
must(has('That is what it is for - your files, on your device, with no ads.'),
  'pointing at the files the user already has');
must(has('This build does not fetch music at all'), 'the assistant instructions say the same on that build');
{
  const kbSrc = final.slice(final.indexOf('var _aiKB = ['), final.indexOf('];', final.indexOf('var _aiKB = [')) + 2);
  const mk = (flag) => new Function('SC_IS_PLAY', 'window', kbSrc + '\nreturn _aiKB;')(flag, { __PLAY_BUILD__: flag });
  let play = null, full = null;
  try { play = mk(true); full = mk(false); } catch (e) { problems.push('the knowledge base evaluates: ' + e.message); }
  if (play && full) {
    const STRONG = /(downloader|downloading|converter|converts|converting|conversion|convert\b|spotify to mp3|youtube to mp3|\bto mp3\b|get song\b|spotisaver|spotmate|spotidown|spoticatch|ytmp3|vocal remover|no source found|hand-?off)/i;
    const leaks = play.filter((e) => STRONG.test(e.a));
    must(leaks.length === 0, 'no store-build answer mentions a fetch tool' + (leaks.length ? ' -> ' + leaks.map((l) => l.q[0]).join(', ') : ''));
    must(full.filter((e) => STRONG.test(e.a)).length >= 3, 'and the full build keeps its help');
    const q = play.find((e) => e.q.indexOf('can i download music') !== -1);
    must(!!q, 'the download question is in the store build list');
    must(!!q && /does not download music/.test(q.a), 'and its store answer says nothing is fetched');
    const fullQ = full.find((e) => e.q.indexOf('can i download music') !== -1);
    must(!!fullQ && /converter/.test(fullQ.a), 'while the full build still describes its own way in');
  }
}

// 4 - the storage allowance
must(has("' of the ' + scFmtBytes(estimate.quota) + ' this phone allows the app'"), 'the allowance row names the phone');
must(has("'That allowance is a limit of this phone rather than a SideCut one:"), 'and the panel says where the limit comes from');
must(!has("+ scFmtBytes(estimate.quota) + ' allowed'"), 'the old wording is gone');

// 5 - the watermark default
must(has('  let watermarkEnabled = true;'), 'Watermark Remover is on by default');
must(has("if(watermarkEnabledRow) watermarkEnabled = !!watermarkEnabledRow.value;"), 'while a stored choice still wins');
must(has('id="watermarkEnabledToggle" style="padding:5px 12px; font-size:12px;">On</button>'), 'and its switch reads On from the start');

// 6 - readable accent text
must(has('    --on-coral: #ffffff;'), 'the on-accent colour is declared');
must(has('  function scOnAccent(color){'), 'and decided from the accent itself');
must(has("      root.setProperty('--on-coral', scOnAccent(th.coral));"), 'a theme applies it');
must(has("    root.setProperty('--on-coral', scOnAccent(col1));"), 'the RGB sweep re-decides it every step');
must(count('background:var(--coral); color:var(--on-coral,#fff)') === 15, 'every accent-filled control uses it (' + count('background:var(--coral); color:var(--on-coral,#fff)') + ')');
must(!has('background:var(--coral); color:#fff'), 'and none is left on a hard white');
{
  const fn = final.indexOf('  function scOnAccent(color){');
  const end = final.indexOf('\n  }', fn);
  let light = '', deep = '', hslLight = '', mid = '';
  try {
    const impl = new Function(final.slice(fn, end + 4) + '\nreturn scOnAccent;')();
    light = impl('#E9EDF5');              // Liquid Glass: a near-white accent
    deep = impl('#0B1626');               // Ocean Blue's page colour: a deep accent
    hslLight = impl('hsl(58, 85%, 62%)'); // the yellow part of the RGB wheel
    mid = impl('#FF5470');                // Crimson: a saturated mid-tone
  } catch (e) { problems.push('scOnAccent evaluates: ' + e.message); }
  must(light === '#141414', 'a near-white accent gets dark text (' + light + ')');
  must(deep === '#ffffff', 'a deep accent keeps white text (' + deep + ')');
  must(mid === '#141414', 'a mid-tone takes the side that is actually readable (' + mid + ')');
  must(hslLight === '#141414', 'and the RGB wheel is read too (' + hslLight + ')');
}

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
    must(!/\bmp3\b|converting|conversion|\bget song\b|hand-?off/i.test(notes), 'nor carry a term the wider store list knows');
    must(/rollback/i.test(notes), 'while still saying what the release did');
    must(/favorites/i.test(notes), 'and naming what was reported');
    must(!/\bpass\b/i.test(String(head.title)), 'the head title states the changes (' + head.title + ')');
  }
} else {
  problems.push('the CHANGELOG block was not found');
}
const swFinal = fs.readFileSync(SW, 'utf8');
must(swFinal.indexOf("const CACHE_NAME = 'sidecut-shell-v" + SW_CACHE + "'") !== -1, 'sw.js cache is v' + SW_CACHE);
must(swFinal.indexOf(SW_CACHE) !== -1 && swFinal.indexOf("'" + VER + "'") === -1, 'and carries none of the app version');

if (problems.length) {
  console.error('\npatch-66422: ' + problems.length + ' FAILED check(s):');
  for (const p of problems) console.error('  - ' + p);
  process.exit(1);
}
console.log('patch-66422: all verification checks passed (' + edits + ' edit(s))');
