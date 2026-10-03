#!/usr/bin/env node
/**
 * SideCut 72.7 - the way in tells you what to tap, and a drop-down says so.
 *
 * The owner's words: "Make the instructions more clearer of to like click on
 * conversion tools and stuff and a drop-down will appear stuff like that to make
 * it more clearer".
 *
 * The how-to copy already named the converter, but it never said that the
 * Conversion Tools bar IS a drop-down you have to tap, and it never said to tap
 * the link box to paste. A brand new user could read all three steps and still
 * not know what to press first. This release is wording only:
 *
 * 1. THE TOOLS BAR SAYS IT OPENS. Its trailing hint now reads
 *    "Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL \u2014 tap to open \u25be" in
 *    both lists, so it reads as a control and not as a heading.
 *
 * 2. EVERY STEP SAYS THE TAP. In Discover, in Settings, in the how-to modal's
 *    own walkthrough, in the Spotify scenario and in the tutorial summary, step
 *    2 now opens with "Tap \ud83c\udf9b\ufe0f Conversion Tools below \u2014 a drop-down
 *    opens", then names the card to tap inside it and the box to tap to paste.
 *    The three teaching lines the older gates pin are kept verbatim inside the
 *    new sentences, so nothing that already pointed at the converter stopped.
 *
 * 3. THE PLAY-ONLY BUILD AGREES. The strings that build substitutes for the
 *    walkthrough and the tutorial summary already describe bringing your own
 *    files, so they are left alone; this release adds no converter language to
 *    them and changes nothing they say.
 *
 * EVERY sub is a swap and carries a `key`, so re-running this on a tree that
 * already has it applied is a no-op.
 *
 *   node dev/patch-727.mjs
 *   node dev/patch-727.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');

const CHECK = process.argv.includes('--check');
const VERSION = '72.7';
const STAMP = 'October 3, 2026 \\u00b7 9:29 AM EDT';
const CACHE = 'sidecut-shell-v' + VERSION;
const OLDVER = '72.6';
const OLDCACHE = 'sidecut-shell-v' + OLDVER;
const TITLE = 'The way in is tap-by-tap now: the tools bar says it opens, and every step names the tap';
const NOTES = [
  'The how-to boxes walk you through the taps now: tap the tools bar and a drop-down opens, tap the song-link card inside it, tap the box to paste, then tap the button.',
  'The tools bar itself says "tap to open", so it reads as a drop-down you press instead of a heading you read past.',
  'The same tap-by-tap wording is in Discover, in Settings, in the first-run walkthrough and in the Spotify scenario, so every place that teaches it says the same thing in the same order.',
  'Nothing was taken away: the outside-site fallback links, the folder import and the backup restore are all still exactly where they were.',
  'The player, your library, your queue and your saved songs are untouched by this build - this release is the wording and nothing else.',
  'Everything the previous update fixed stays fixed: pause, play, next and previous on the home-screen widget keep working from outside the app.',
  'If a step still reads oddly the wording is the only thing that changed - the buttons and the tools are the same ones you already had.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

let applied = 0, already = 0;

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

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));

/* ============================================================================
   1. THE VERSION AND THE CHANGELOG HEAD
   ========================================================================== */
sub(html, 'the app runs 72.7',
  "  const APP_VERSION = '72.6';\n",
  "  const APP_VERSION = '72.7';\n",
  { key: "const APP_VERSION = '72.7';" });

const headEntry = [
  "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ...NOTES.map((n) => "    '" + n + "',"),
  "  ] },",
].join('\n');

sub(html, 'the changelog carries the 72.7 entry at its head',
  "  const CHANGELOG = [\n" +
  "  { version: '" + OLDVER + "', date:",
  "  const CHANGELOG = [\n" +
  headEntry + "\n" +
  "  { version: '" + OLDVER + "', date:",
  { key: "{ version: '" + VERSION + "', date: '" + STAMP + "'" });

sub(sw, 'the shell cache is the release name',
  "const CACHE_NAME = '" + OLDCACHE + "';\n",
  "const CACHE_NAME = '" + CACHE + "';\n",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ============================================================================
   2. THE TOOLS BAR SAYS IT OPENS
   --------------------------------------------------------------------------
   The trailing hint in the summary is the only affordance the bar has, and it
   read as a list of things rather than as a control. It now ends with the tap.
   Both lists carry the identical summary line, so the swap is deliberately
   global; the Play-only build rewrites this summary's textContent later and
   that build never shows the tools at all.
   ========================================================================== */
sub(html, 'the tools bar says it is a drop-down you tap',
  'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL</span></summary>',
  'Spotify \u00b7 YouTube \u00b7 MP4 \u00b7 Expand URL \u2014 tap to open \u25be</span></summary>',
  { all: true, key: '\u2014 tap to open \u25be' });

/* ============================================================================
   3. EVERY STEP SAYS THE TAP
   --------------------------------------------------------------------------
   Each rewrite keeps the teaching line the older gates pin, verbatim, inside
   the new sentence:
     * "Open the built-in converter below"   (Discover, test-619 + test-726)
     * "Paste the link into the built-in"    (Settings,  test-619 + test-726)
     * "<b>Getting music in:</b> paste a Spotify link" (tutorial summary, test-662)
     * "tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it
        into your library"                  (scenario 1, test-662)
   So the older gates still find what they were written to find.
   ========================================================================== */

// Discover step 2.
sub(html, 'the Discover step says tap the bar and the drop-down opens',
  '      2. Open the built-in converter below (<b style="color:var(--ink);">\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b>), paste the link and tap <b style="color:var(--ink);">Convert</b>.<br>\n',
  '      2. Tap <b style="color:var(--ink);">\ud83c\udf9b\ufe0f Conversion Tools</b> below \u2014 a drop-down opens. Open the built-in converter below (<b style="color:var(--ink);">\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b>), tap the link box to paste the link and tap <b style="color:var(--ink);">Convert</b>.<br>\n',
  { key: 'a drop-down opens. Open the built-in converter below' });

// Settings step 2.
sub(html, 'the Settings step says tap the bar and the drop-down opens',
  '        2. Paste the link into the built-in <b style="color:var(--ink);">\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b> converter below and tap <b style="color:var(--ink);">Convert</b>.<br>\n',
  '        2. Tap <b style="color:var(--ink);">\ud83c\udf9b\ufe0f Conversion Tools</b> below \u2014 a drop-down opens. Paste the link into the built-in <b style="color:var(--ink);">\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b> converter below (tap the box to paste it) and tap <b style="color:var(--ink);">Convert</b>.<br>\n',
  { key: 'a drop-down opens. Paste the link into the built-in' });

// The how-to modal's own walkthrough, step 2.
sub(html, 'the walkthrough step says tap the bar and the drop-down opens',
  '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">2.</span><span>In SideCut open <b>Settings \u2192 Get Songs</b> (the same box sits in <b>Discover</b>), paste the link and pick <b>MP3</b> for a small file or <b>WAV / FLAC</b> for lossless.</span></div>\n',
  '          <div style="display:flex; gap:8px;"><span style="color:var(--coral); flex-shrink:0;">2.</span><span>In SideCut open <b>Settings \u2192 Get Songs</b> (the same box sits in <b>Discover</b>). Tap <b>\ud83c\udf9b\ufe0f Conversion Tools</b> \u2014 a drop-down opens; tap <b>\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b>, tap the link box to paste the link, and pick <b>MP3</b> for a small file or <b>WAV / FLAC</b> for lossless.</span></div>\n',
  { key: 'a drop-down opens; tap <b>\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b>, tap the link box to paste the link' });

// The Spotify scenario in the how-to modal.
sub(html, 'the Spotify scenario says tap the bar and the drop-down opens',
  'In <b>Spotify</b>, open the song and tap <b>Share \u2192 Copy link</b>. In SideCut open <b>Settings \u2192 Get Songs</b> (or the same box in <b>Discover</b>), paste the link, pick <b>MP3</b> or <b>WAV / FLAC</b> and tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library',
  'In <b>Spotify</b>, open the song and tap <b>Share \u2192 Copy link</b>. In SideCut open <b>Settings \u2192 Get Songs</b> (or the same box in <b>Discover</b>). Tap <b>\ud83c\udf9b\ufe0f Conversion Tools</b> \u2014 a drop-down opens; tap <b>\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b>, tap the link box to paste the link, pick <b>MP3</b> or <b>WAV / FLAC</b> and tap <b>Convert</b>. SideCut tags it, gives it its cover art and files it into your library',
  { key: 'a drop-down opens; tap <b>\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b>, tap the link box to paste the link, pick <b>MP3</b>' });

// The tutorial summary line.
sub(html, 'the tutorial summary says tap the bar and the drop-down opens',
  '<b>Getting music in:</b> paste a Spotify link (or a YouTube link) into <b>Settings \u2192 Get Songs</b> or <b>Discover</b>, pick MP3 or WAV / FLAC and tap <b>Convert</b>',
  '<b>Getting music in:</b> paste a Spotify link (or a YouTube link) into <b>\ud83c\udfb5 Spotify to MP3 / WAV / FLAC</b> \u2014 tap <b>\ud83c\udf9b\ufe0f Conversion Tools</b> in <b>Settings \u2192 Get Songs</b> or <b>Discover</b> first and a drop-down opens; pick MP3 or WAV / FLAC and tap <b>Convert</b>',
  { key: 'first and a drop-down opens; pick MP3 or WAV / FLAC and tap <b>Convert</b>' });

/* ============================================================================
   4. THE OTA TAIL - TWO newlines after </html>, exactly as 72.5
   --------------------------------------------------------------------------
   72.7's content puts the OTA size map back in the known 2-cycle at a ONE-newline
   tail (874738 <-> 874739, no fixed point in 8 passes). Probing the tail over a
   scratch copy (dev/tmp-pad-exp.mjs, since deleted) showed pad 1 and pad 3 both
   settle. Two newlines is the padding 72.5 already proved for this exact problem,
   so it is what this release ships. The extra newline is invisible to the page
   and rides in the bundle only.
   ========================================================================== */
{
  const trimmed = html.text.replace(/\s*$/, '');
  const want = trimmed.endsWith('</html>') ? trimmed + '\n\n' : trimmed;
  if (html.text !== want) {
    if (process.env.SC_DEBUG) console.log('  normalising the OTA tail to one newline');
    html.text = want;
    applied++;
  } else {
    already++;
  }
}

if (problems.length) {
  console.error('patch-727: ' + problems.join('\n           '));
  process.exit(1);
}

if (!CHECK) {
  fs.writeFileSync(IDX, html.text);
  fs.writeFileSync(SW, sw.text);
}

console.log('patch-727: ' + applied + ' applied, ' + already + ' already in place' + (CHECK ? ' (check only)' : ''));
