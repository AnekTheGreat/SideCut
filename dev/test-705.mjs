/**
 * v70.0.5 - Add songs moves to the header, the dock drops to four, and the
 *           achievements wall grows to 201 badges with five rewards.
 *
 * The user's words, verbatim, in two messages:
 *   "Remove the add songs tab from bottom and remove the refresh button from the
 *    top and replace that with a plus sign for add songs v70.0.5"
 *   "Achivements should have over 200 of them including 1 secret 1 where you have
 *    to enter dev mode in order to obtain them. If you can get all 200 badges you
 *    get a free very nice dynamic theme that whirls with your finger same version
 *    v70.0.5 you should also get a free theme for reaching 50 badges, 100 badges
 *    and 150 badges and at 201 with the secret one you can get a free SideCut
 *    premium"
 *
 * A two-control move is exactly the kind of change that looks fine in the diff and
 * is wrong on the phone, so this gate is written against what can be broken:
 *
 *   [1] the release itself: 70.0.5 runs, the head entry says so with a real
 *       Eastern stamp, and the release it replaced is still listed next;
 *   [2] the dock: four tabs, in order, and the add-songs pill AND its wrap gone -
 *       the wrap was a flex child, so leaving it behind would keep a fifth share
 *       of the row for nothing;
 *   [3] the header: the refresh button gone, the + in its slot, wired to the menu
 *       it now owns, and nothing left reading the id that left;
 *   [4] the menu: still in the document, still inside the dock's subtree (that is
 *       what lifts it over the player), still with all five entries;
 *   [5] the copy that pointed at the old pill: no caret left, and the words the
 *       older how-to gates look for are still there;
 *   [6] the styles: the dead wrap/pill rules gone, the dock still fixed on
 *       --sc-dock-h, and the .menu-open lift still present;
 *   [7] the Studio header: it names the build on the page instead of the release
 *       the module was written in;
 *   [8] the badge wall: 201 of them, one secret, gated on dev mode, and the five
 *       rewards - three themes at 50/100/150, the dynamic Vortex at 200, and
 *       Premium at 201 - with the gate the Theme tab asks and the backdrop the
 *       finger turns;
 *   [9]-[11] the same release driven on the real app, the earlier releases still
 *       standing, and the page still parsing as one document.
 *
 *   node dev/test-705.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const mod = fs.readFileSync(path.join(ROOT, 'dev', 'sc70-module.js'), 'utf8');

const VER = '70.0.5';

// 70.0.7. One surface has to reserve the bottom inset: the one that touches the
// bottom edge of the screen. That is the dock, and this is the half of that rule
// that a page-wide text check cannot accidentally satisfy with the wrong element.
function mustStillReserve(page, selector){
  const hit = page.match(new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") +
    "\\{\\s*[^}]*padding:[^}]*env\\(safe-area-inset-bottom\\)[^}]*\\}"));
  ok(!!hit, "and " + selector + " is the surface that reserves the inset");
}

const PREV = '70.0';
const SHELL_CACHE = 'sidecut-shell-v72.5.1';

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  PASS ' + name); }
  else { fail++; console.log('  FAIL ' + name); }
}
const count = (needle) => src.split(needle).length - 1;
// The badge wall's own file. `count(mod, x)` is NOT this: the two-argument calls
// above ask whether the whole module text (a needle) appears in the page, which is
// how the splice-once checks read. Anything about the module's CONTENT uses this.
const countMod = (needle) => mod.split(needle).length - 1;
const has = (needle) => src.indexOf(needle) !== -1;
const slice = (from, to, hay = src) => {
  const a = hay.indexOf(from);
  const b = hay.indexOf(to, a);
  if (a === -1 || b === -1) return '';
  return hay.slice(a, b);
};

console.log('[1] release metadata');
{
  const ver = (src.match(/const APP_VERSION = '([^']+)'/) || [])[1];
  // The build on the page is 70.0.5 or a patch on it; the release this gate
  // DESCRIBES is still 70.0.5, which is why VER does not move with APP_VERSION.
  ok(/^\d+(\.\d+)+$/.test(String(ver)), 'the app runs a real release number (' + ver + ')');
  ok(/const APP_VERSION = '\d+(\.\d+)+';/.test(src), 'and the page carries one version string');
  const block = src.match(/const CHANGELOG = \[([\s\S]*?)\n  \];/);
  let entries = null;
  try { entries = eval('[' + block[1] + ']'); } catch (e) { ok(false, 'the changelog evaluates: ' + e.message); }
  ok(!!entries && String(entries[0].version) === ver, 'the newest changelog matches APP_VERSION (' + (entries && entries[0].version) + ')');
  if (entries) {
    // The 70.0.5 entry, read by version: the top of the array belongs to
    // whatever shipped last, which is no longer this gate's release.
    const head = entries.find((e) => String(e.version) === VER) || entries[0];
    const items = head.items || [];
    ok(String(head.version) === VER, 'the entry this gate reads is v' + head.version);
    ok(items.length === 10, 'ten notes, one per thing that moved (' + items.length + ')');
    const longest = items.reduce((n, it) => Math.max(n, it.length), 0);
    ok(longest <= 320, 'every note is one short sentence or two (longest ' + longest + ' chars)');
    ok(String((entries[entries.findIndex((e) => String(e.version) === String(head.version)) + 1] || {}).version) === PREV,
       'the release before this one is still listed next');
    ok(/EDT$/.test(String(head.date)), 'the ship stamp is Eastern (' + head.date + ')');
    // The stamp rule at APP_VERSION: Eastern is UTC-4 and the DATE rolls back with
    // it. A stamp in the reader's future is the bug 64.3 fixed, so it is checked
    // against the clock rather than against a literal.
    const stamp = String(head.date).match(/([A-Z][a-z]+) (\d+), (\d{4}) · (\d+):(\d+) (AM|PM) EDT/);
    ok(!!stamp, 'and it parses as a real date');
    if (stamp) {
      const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      let hh = parseInt(stamp[4], 10) % 12;
      if (stamp[6] === 'PM') hh += 12;
      const at = Date.UTC(parseInt(stamp[3], 10), months.indexOf(stamp[1]), parseInt(stamp[2], 10), hh + 4, parseInt(stamp[5], 10));
      ok(at - Date.now() < 15 * 60 * 1000, 'and it is not stamped in the future');
    }
    const notes = items.join('\n');
    ok(/dock/i.test(notes) && /four tabs/i.test(notes), 'the notes say the dock lost a tab');
    ok(/top of the screen/i.test(notes) && /add songs/i.test(notes), 'and that Add songs is at the top of the screen');
    ok(/refresh/i.test(notes), 'and that the refresh button went with it');
    ok(/201/.test(notes) && /badges/.test(notes), 'and the notes say the wall is 201 badges');
    ok(/secret/i.test(notes) && /seven times/.test(notes), 'and how the secret one is reached (seven taps)');
    ok(/Cinder/.test(notes) && /Quartz/.test(notes) && /Lumen/.test(notes) && /Vortex/.test(notes),
      'and name all four reward themes');
    ok(/Premium/.test(notes), 'and the free Premium at 201');
    ok(/none of them asks you to share a song/.test(notes), 'and that no badge asks for a song to be shared');
    ok(/album badges/.test(notes) && /zero/.test(notes), 'and name the album stat that always read zero');
    ok(!/\bmp3\b|converting|conversion|hand-?off/i.test(notes), 'with no converter term in it');
    ok(items.every((it) => it.indexOf('[FULL]') === -1), 'and every note publishes on both channels');
  }
  const swCache = (sw.match(/const CACHE_NAME = '([^']+)'/) || [])[1] || '';
  ok(swCache === SHELL_CACHE, 'the shell cache moved with the release (' + swCache + ')');
  ok(swCache === 'sidecut-shell-v' + (src.match(/const APP_VERSION = '([^']+)'/) || [])[1], 'the shell cache is the release number (' + swCache + ')');
}

console.log('\n[2] the dock is four tabs');
{
  const strip = slice('<div class="action-strip" id="actionStrip">', '<div id="addSongsBackdrop"');
  ok(!!strip, 'the dock is still in the document');
  // Direct children only: the menu lives in this same subtree and its five buttons
  // wear .action-pill as well.
  const pills = (strip.match(/<button id="([A-Za-z0-9_]+)" class="action-pill"/g) || []);
  ok(pills.length === 4, 'four pills (' + pills.length + ')');
  ['homeBtn', 'libraryBtn', 'discoverBtn', 'studioBtn'].forEach((id, i) => {
    ok(pills[i] === `<button id="${id}" class="action-pill"`, 'pill ' + (i + 1) + ' is ' + id);
  });
  ok(count('id="addSongsToggle"') === 0, 'the old add-songs pill is still gone');
  ok(count('id="addSongsWrap"') === 0, 'and so is the wrap it sat in (it was a flex child of the strip)');
  ok(count('class="add-songs-wrap"') === 0, 'with no class reference left behind');
  // 71.2. The plus came back to the dock as a COMPACT icon at the end of the row,
  // not a fifth tab: it is a direct child of the strip after Studio, it carries its
  // own dock-add class, and a rule stops it sharing the row equally with the tabs.
  ok(count('id="dockAddBtn"') === 1 && strip.indexOf('id="dockAddBtn"') !== -1,
     'the dock carries the add-songs plus');
  ok(strip.indexOf('id="studioBtn"') < strip.indexOf('id="dockAddBtn"'),
     'and it sits after Studio, at the end of the row');
  ok(count('class="action-pill dock-add"') === 1,
     'as a compact icon rather than a fifth full-width tab');
  ok(/\.action-strip \.action-pill\.dock-add\{[^}]*flex: 0 0 auto/.test(src),
     'with a rule that keeps it out of the tabs equal-width share');
  // The dock is still the fixed bar the v70 release built, and every scrolling
  // view still clears it.
  ok(/\.action-strip\{\s*position:\s*fixed[^}]*z-index:\s*25/.test(src), 'the dock is still fixed to the bottom');
  ok(has('#nowPlaying{ bottom: calc(var(--sc-dock-h)'), 'and the player is still lifted onto it');
}

console.log('\n[3] the header refresh button');
{
  // 71.2 reverses 70.0.5 here: the refresh is back beside the gear and the + is
  // gone from the header. Both halves are asserted, because half of this move
  // would leave the menu reachable only from the dock or the button dead.
  ok(count('id="refreshBtn"') === 1, 'the refresh button is back');
  ok(has("getElementById('refreshBtn')"), 'and something reads its id again');
  ok(count('id="addSongsBtn"') === 0, 'and the header + is gone');
  const header = slice('<header>', '</header>');
  ok(header.indexOf('id="refreshBtn"') !== -1, 'the refresh sits in the header');
  ok(header.indexOf('id="notifBtn"') !== -1 && header.indexOf('id="themeBtn"') !== -1,
     'beside the notifications bell and settings');
  const refreshTag = header.slice(header.indexOf('id="refreshBtn"'), header.indexOf('</button>', header.indexOf('id="refreshBtn"')));
  ok(refreshTag.indexOf('title="Refresh app"') !== -1, 'titled Refresh app, so it says what it does when held');
  ok(refreshTag.indexOf('M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42') !== -1, 'with the refresh arrow');
  ok(refreshTag.indexOf('M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z') === -1, 'and no plus glyph left in the header');
  ok(has("_rb.addEventListener('click'") && has('_scRefreshWired = true;') &&
     has('window.location.reload()'), 'and the refresh really reloads the app');
  ok(count("  $('dockAddBtn').addEventListener('click'") === 1, 'the dock + is wired to the menu');
  ok(has("if($('addSongsMenu').classList.contains('open')) closeAddSongsMenu();"),
     'and it toggles rather than only opening');
}

console.log('\n[4] the menu it opens');
{
  ok(count('id="addSongsMenu"') === 1, 'the menu is still in the document');
  ok(count('id="addSongsBackdrop"') === 1, 'with its backdrop');
  // Inside the dock's own subtree on purpose: the menu is position:fixed, but the
  // .menu-open z-index on the strip is what lifts it over #nowPlaying (z-index 20).
  const strip = slice('<div class="action-strip" id="actionStrip">', '<input type="file" id="importLibInput">');
  ok(strip.indexOf('id="addSongsMenu"') !== -1 && strip.indexOf('id="addSongsBackdrop"') !== -1,
     'both still live inside the dock, which is what lifts them over the player');
  ['addFolderBtn', 'addBtn', 'importLibBtn', 'exportSongsBtn', 'exportLibBtn'].forEach((id) =>
    ok(strip.indexOf(`id="${id}"`) !== -1, 'the menu still offers ' + id));
  ok(has("$('addSongsBackdrop').addEventListener('click', closeAddSongsMenu)"), 'tapping outside still closes it');
  ok(/\.action-strip\.menu-open\{ z-index:300; \}/.test(src), 'and the dock still lifts while it is open');
  // The menu is out of flow and hidden until it opens, so it must not be laid out
  // as a fifth flex child of the strip.
  ok(/\.add-songs-menu\{\n\s*display:none; position:fixed/.test(src), 'the menu is still fixed and starts shut');
}

console.log('\n[5] the copy that pointed at the old pill');
{
  ok(count('+ Add songs ▾') === 0, 'no caret is left pointing at a pill that is not there');
  ok(count('+ Add songs') > 0, 'and the Add songs menu is still named in the how-to text');
  ok(has('+ Add songs → + Files'), 'including the failure message that sends people to it');
  // The five older copy gates all look for the words "+ Add songs" and "+ Files"
  // together; the caret was the only part that had to go, so they stay true.
  ok(has('<b>+ Add songs → + Files</b>') && count('<b>+ Add songs') >= 2, 'and the how-to steps still name it');
}

console.log('\n[6] the styles');
{
  ok(!has('.add-songs-wrap{'), 'the dead wrap rule is gone');
  ok(!has('#addSongsToggle{'), 'and the dead pill rule is gone');
  ok(count('.action-strip > *{ flex: 1 1 0; min-width: 0; }') === 1, 'every dock pill still shares the row');
  ok(has('#libraryBtn{ flex: 1.18 1 0; border-radius: 14px; }'), 'and the split tab still keeps its extra room');
  ok(has('--sc-dock-h: 56px'), 'the dock height token is untouched');
  // 70.0.8. Four complaints, one release, and none of them is a layout - so all
  // four are asserted as what the page and the module actually contain.
  // [1] the crop: Studio opens the app cropper, and the clip exporter is its own
  // card instead of wearing the word crop.
  ok(count('window.__scCropSong = function') === 1, 'the Studio gets the app cropper through one hook');
  ok(countMod("toolCard('crop',") === 1, 'the Studio tool card is a Crop song card');
  ok(countMod('Crop \\u2192 clip') === 0, 'and no longer calls a clip exporter a crop');
  ok(countMod('__scCropSong\', t.id)') === 1, 'and the card calls the real modal rather than a second one');
  // [2] the speed slider: the sheet rebuild must keep what is not a button.
  ok(countMod('var extras = [];') === 1, 'the song sheet collects what is not a button');
  ok(countMod("if(ch.tagName === 'BUTTON') return;") === 1, 'and that is how it decides');
  ok(countMod("ch.classList.contains('sc-sheet-group')") === 1, 'without dragging its own grouped sections along');
  ok(countMod('var anchor = target.firstChild;') === 1, 'and puts it back into the Play group');
  // [3] lyrics off: one flag, persisted cheaply, honoured everywhere it must be.
  ok(count('lyricsOff: t.lyricsOff || false,') === 1, 'the track record keeps the lyrics-off flag');
  ok(has("'gain', 'waveform', 'lyricsOff']"), 'and the sidecar is what stores it, so no audio is rewritten');
  ok(count('if(track.lyricsOff){ scLyricsShowOff(track); return; }') === 1, 'a song switched off is never fetched');
  ok(count('if(t.lyricsOff) return false;') === 1, 'and the background lyrics pass skips it');
  ok(count('id="lyricsDisableBtn"') === 1 && count('id="lyricsOffPanel"') === 1,
     'the switch and the panel it opens are both in the sheet');
  ok(count("$('lyricsOffBack').addEventListener('click'") === 1, 'and off can be undone from inside it');
  ok(has("t.lyricsOff ? 'Lyrics (off for this song)' : 'Lyrics'"), 'the song menu says when they are off');
  // [4] the count: a real, public API that carries a real download count.
  ok(count("'https://api.github.com/repos/'") === 1, 'Studio reads the counts from the GitHub API');
  ok(has('/releases?per_page=30') && has('a.download_count'), 'and it is the release asset count, which is the one GitHub keeps');
  ok(countMod('data-act="apkread"') === 1, 'with one button that asks for it');
  // 70.0.7, the user's words: "why is their a huge gap between the media player and
  // tabs". The player is the MIDDLE surface now - the dock touches the screen edge,
  // and the bar's own `bottom` already counts the inset - so the bar's padding must
  // not count the same inset a third time. The inset is only visible on a device that
  // reports one (Android 15 is edge to edge; 3-button nav is ~48px), which is exactly
  // why this is asserted as a cascade and not as a picture.
  // A rule is a rule: comments are stripped before anything is matched, because
  // this file's own design note names this selector and this inset on purpose.
  const cssOnly = src.replace(/\/\*[\s\S]*?\*\//g, '');
  const padRules = (cssOnly.match(/#nowPlaying[^{}]*\{[^}]*padding[^}]*\}/g) || []);
  const envPads = padRules.filter((r) => /env\(safe-area-inset-bottom\)/.test(r));
  ok(envPads.length === 4, 'the four player paddings that counted the inset are still there (' + envPads.length + ')');
  ok(count('#nowPlaying{ padding-bottom: 10px; }') === 1, 'and the override that drops it ships once');
  ok(count('body.sandbox-compact-nowbar #nowPlaying{ padding-bottom: 6px; }') === 1,
     'the compact now bar keeps its 6px, without the inset');
  ok(has('@media (max-width: 360px){ #nowPlaying{ padding-bottom: 8px; } }'),
     'and the very narrow phone keeps its 8px');
  ok(has('@media (max-height: 500px) and (orientation: landscape){ #nowPlaying{ padding-bottom: 6px; } }'),
     'and the landscape bar keeps its 6px');
  ok(cssOnly.indexOf('#nowPlaying{ padding-bottom: 10px; }') > Math.max.apply(null, envPads.map((r) => cssOnly.indexOf(r))),
     'and it comes after every padding that counted it, so it is the last word');
  mustStillReserve(src, '.action-strip');
  // 70.1.2. More Studio, and a Premium that is worth something - without taking
  // anything away from the free half or moving the badge wall.
  // 70.1.3. "Remove premium make everything free keep donations". Every rule
  // the 70.1 block below made about the paywall is made the other way round:
  // the absence is the assertion, because a page that still carries a premium
  // gate, a premium state, a purchase or a licence path has not done the job.
  ok(count('isPremiumActive') === 0 && count('sidecut_premium') === 0,
     'the app still carries a premium gate or a premium state');
  ok(count('LICENSE_CONFIG') === 0 && count('PREMIUM_HMAC_KEY_B64') === 0 && count('__scGrantPremium') === 0,
     'or any of the machinery that used to sit behind one');
  ok(countMod("toolCard('sleep'") === 1 && countMod("toolCard('practice'") === 1,
     'the two new Studio tools are not on the tools row');
  ok(countMod('function setSleep(mode){') === 1 && countMod("el.addEventListener('ended', fn)") === 1,
     'the sleep timer does not really stop anything');
  ok(countMod('isPro') === 0 && countMod('proOnly') === 0 && countMod('__scIsPremium') === 0,
     'and Studio still asks the app whether Premium is on');
  ok(countMod('FREE_LOOPS') === 0 && countMod('looper.layers.length >=') === 0,
     'something that used to be free was capped to sell Premium');
  ok(countMod('premiumStudioHtml') === 0 && countMod('openpremium') === 0,
     'and a Studio Premium section is still being sold here');
  // The wall must not move: the same FEATURE_KEYS, the same one capstone, the
  // same five rewards. New tools are tools, not badges.
  ok(countMod("var FEATURE_KEYS = ['studio', 'slow', 'karaoke', 'sampler', 'looper', 'clip', 'assistant', 'autodj', 'gestures'];") === 1,
     'the feature list the capstone badge counts was changed');
  ok(countMod("at: 201, kind: 'complete'") === 1 && countMod('function myPresetsHtml(){') === 1,
     'the rewards moved, or the presets are not in the sheet');
  // 70.1.1. The tab you are on says so, and the wall is never a picture of an
  // earlier moment than the badges it describes.
  ok(count('#discoverBtn.active, #homeBtn.active, #studioBtn.active{ background: var(--coral);') === 1,
     'the Studio tab is not lit up like the other tabs');
  ok(countMod('function badgeRepaintIfVisible(){') === 1 &&
     countMod('if(fresh.length) badgeRepaintIfVisible();') === 1,
     'a badge that reaches its goal leaves the wall stale');
  ok(countMod("el.closest('#studioBtn')") === 1,
     'and opening Studio does not redraw the wall');
  ok(countMod('host && host.classList.contains') === 1,
     'and the repaint is only done while the wall is on screen');
  // 70.1.3. What has to be true now is the opposite of the block that used to
  // be here, plus the one thing that had to survive it: Donate.
  ok(count("toast('Premium feature") === 0 && !has('premium:true'),
     'a premium gate or a premium theme flag is still in the page');
  ok(count('id="settingsTabPremium"') === 0 && count('settingsPanePremium') === 0,
     'and the Premium tab is still in Settings');
  ok(count('id="premiumLicenseInput"') === 0 && count('id="premiumCodeInput"') === 0 &&
     count('id="premiumBuyView"') === 0 && count('id="premiumStatusBox"') === 0,
     'and there is still something in the sheet to buy or redeem');
  ok(count('clearPremium') === 0 && count('setPremiumActive') === 0 && count('_proFx = true') === 1,
     'and anything at all can still lock the app');
  ok(count('activateLicenseKey') === 0 && count('revalidateLicense') === 0 &&
     count('offerLicenseOrPlayStore') === 0 && count('licensePost') === 0,
     'and a licence key is still checked with a store');
  ok(count('__scGrantPremium') === 0 && count('__scLicenseRedeem') === 0 && count('buildPremiumPayload') === 0,
     'and a badge, a backup or a probe can still grant Premium');
  // And what the removal must NOT have taken with it.
  ok(count('id="settingsTabDonate"') === 1 && count('id="settingsPaneDonate"') === 1 &&
     count('function initDonateTab(){') === 1,
     'the Donate tab left with the premium pane');
  ok(count('const PLAY_TIP_PRODUCTS = {') === 1 && count('purchasePlayTip') === 2,
     'or the tip tiers it is built on');
  ok(count('donate-quick') >= 12 && count('PAYMENT_CONFIG.playStoreListing') >= 2,
     'or the tip buttons, or the route out for a copy that cannot bill');
  // 70.1.9. A copy that cannot bill is not sent away any more: the amounts with a
  // hosted card page open it. Structural, because the links themselves are
  // settings - what has to be true is that the route exists, that the fallback
  // branch is the one that takes it, that the amount the user tapped is the one
  // that travels with the link, and that an amount with no page keeps the route
  // the earlier release left it.
  ok(count('function donateUrlFor(') === 1 && count('function donateTierList(') === 1,
     'a copy that cannot bill has no card page to open');
  ok(count("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") === 1 &&
     count('runTip(sku, amt);') === 1 && count('async function runTip(sku, amt){') === 1,
     'or the tip that cannot be billed never asks for that link');
  ok(count("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") === 1 &&
     count("const tierList = SC_IS_PLAY ? '' : donateTierList();") === 1,
     'and the copy installed from Google Play never leaves Billing for one');
  ok(count('if(promise && !SC_IS_PLAY){') === 1 && count("const promise = $('donatePromise');") === 1,
     'with the pane naming a card page only where one exists');
  ok(count('donateLinks: {') === 1 && count('PAYMENT_CONFIG.donateLinks') >= 2 &&
     count("return base.split('{amt}').join(String(n));") === 1,
     'or an amount without a page of its own has nowhere to go');
  // 70.2.0. Two claims, and the second is the one the APK proved was missing.
  // (a) A page opened from the Android build has somewhere to go: a WebView has
  // no windows, so window.open() alone is a link that goes nowhere. (b) The card
  // page is looked up ABOVE the not-found and error returns, because the package
  // this repo builds for sideloading fails in exactly those two ways - it has the
  // Billing plugin, and Play simply declines.
  ok(count('function scOpenExternal(url){') === 1 && count('window.location.href = String(url);') === 1 &&
     count("if(window.open(String(url), '_blank', 'noopener')) return true;") === 1,
     'a page this app opens from the Android build has somewhere to go');
  ok(count('scOpenExternal(web);') === 1 && count('scOpenExternal(PAYMENT_CONFIG.playStoreListing);') === 1 &&
     count("try{ window.open(web, '_blank', 'noopener'); }catch(_eDon){ }") === 0,
     'and neither the card page nor the listing is opened into a window that cannot exist');
  ok(src.indexOf("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") < src.indexOf("if(result === 'not-found'){") &&
     count("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") === 1,
     'with the lookup above the failures, so a decline for any reason still reaches it');
  // 70.0.9. The lift is measured, not guessed - and the fallback is the guess.
  ok(count('html.sc-dock-measured #nowPlaying{ bottom: var(--sc-dock-real') === 1,
     'the measured lift is not the last word on the player position');
  ok(has('var(--sc-dock-real, calc(var(--sc-dock-h) + env(safe-area-inset-bottom)))'),
     'and it falls back to the guess rather than leaving the player unpositioned');
  ok(countMod('function measureDock(){') === 1, 'the dock is measured');
  ok(countMod('if(!h || h < DOCK_MIN || h > DOCK_MAX){') === 1, 'and a nonsense height is refused');
  ok(countMod('getBoundingClientRect().height') === 1, 'by reading the dock that is on the screen');
  ok(countMod("root.classList.add('sc-dock-measured')") === 1 &&
     countMod("root.classList.remove('sc-dock-measured')") === 1,
     'and the player is switched to it, or back off it, in one place');
  ok(countMod('watchDock();') === 1, 'and the measurement is watched (rotation, resize, the dock itself)');
  ok(/#nowPlaying\{ bottom: calc\(var\(--sc-dock-h\) \+ env\(safe-area-inset-bottom\)\)/.test(src),
     'while the position that lifts the bar onto the dock still counts it');

  // 70.1.4. "Make sure export includes everything all functions of the app". The
  // backup used to read the same size-capped sweep as the on-device mirror, so
  // every value past 256 KB was left out of the zip - and the rows that grow with
  // use (the sidecar with the play counts, gains and waveforms, and the cover
  // maps) are exactly the ones that pass it. The two sweeps are separate now.
  ok(count('function collectLocalStorageForBackup(){') === 1 && count('function collectMetaForBackup(){') === 1,
     'the export still reads the same size-capped sweep as the on-device mirror');
  ok(count('collectLocalStorageForBackup(), meta: await collectMetaForBackup()') === 1,
     'or the backup is not the one built from the uncapped sweep');
  ok(count('if(v === null || v === undefined || v.length > MAX_ITEM) continue;') === 1 &&
     count('if(valSize > MAX_ITEM) continue;') === 1,
     'and the on-device mirror stopped skipping oversized rows');
  ok(count("if(k === 'sidecut_pinned_snapshot') continue;") === 1,
     'or a whole pinned shell page is riding into every backup');
  ok(count('cropped: t.cropped || false, originalDuration: t.originalDuration || null, manualOverride: t.manualOverride || false') === 1,
     'the backup still drops the crop undo and the manual tag mark');
  ok(count('existing.cropped = m.cropped') === 1 && count('existing.originalDuration = m.originalDuration') === 1 &&
     count('existing.manualOverride = m.manualOverride') === 1,
     'or a song that is already here does not get them back');

}

console.log('\n[7] the Studio header names the real build');
{
  ok(!/var VERSION = '70\.0';/.test(mod), 'the module no longer pins the release it was written in');
  ok(/var VERSION = \(typeof window !== 'undefined' && window\.APP_VERSION\)/.test(mod),
     'it reads the version the app publishes');
  ok(has("if(typeof window !== 'undefined') window.APP_VERSION = APP_VERSION;"),
     'and the app really publishes one');
  ok(count('id="sc-studio-70"') === 1, 'the Studio block is still spliced in once');
}

console.log('\n[8] 201 badges, dev mode, five rewards');
{
  // ---- the wall ----
  ok(count(mod, 'TWO HUNDRED BADGES, ONE SECRET, AND FIVE REWARDS') === 1,
    'the module states the size of the wall in its own words');
  ok(count(mod, "id: 'secret_devmode'") === 1, 'and there is exactly one secret badge');
  ok(count(mod, 'secret: true') === 1, 'marked as secret rather than left to the name');
  ok(/GROUP_TITLES = \[\s*\n\s*\['streak'/.test(mod), 'the grid is grouped');
  ['streak', 'listen', 'explore', 'library', 'studio', 'assistant', 'themes', 'miles', 'secret'].forEach((g) =>
    ok(mod.indexOf(`['${g}', `) !== -1, 'including a ' + g + ' section'));
  ok(mod.indexOf('g.have ? g.items.filter(isUnlocked).map(badgeTile).join(\'\') : secretTile()') !== -1,
    'and the secret section still renders before dev mode, as one blank tile');

  // ---- dev mode ----
  ok(count(mod, 'function wireDevGesture()') === 1, 'dev mode is opened by a gesture');
  ok(/el\.__scDevTaps >= 7/.test(mod), 'seven taps, exactly');
  ok(mod.indexOf("localStorage.setItem('sidecut_testMode', '1')") !== -1,
    'and it sets the app\u2019s own test flag, so the app\u2019s dev affordances come with it');
  ok(mod.indexOf("localStorage.removeItem('sidecut_testMode')") !== -1, 'and clears it on the way out');
  ok(count(mod, "data-act=\"devreset\"") === 1, 'dev mode can reset its own state');
  // 70.1.3: the reset note used to say Premium was not its to take back. There
  // is no Premium, so what it must not take back is the wall’s own reward.
  ok(/never takes a reward back/.test(mod), 'and the reset says out loud that a reward is not its to take back');


  // ---- the five rewards ----
  const ats = [...mod.matchAll(/\{ at: (\d+),\s*kind: '([a-z]+)',\s*key: '([a-z]+)'/g)].map((m) => ({ at: Number(m[1]), kind: m[2], key: m[3] }));
  ok(ats.length === 5, 'five rewards are declared (' + ats.length + ')');
  ok(ats.map((r) => r.at).join(',') === '50,100,150,200,201', 'at 50, 100, 150, 200 and 201');
  ok(ats[3].key === 'vortex', 'the 200 one is Vortex');
  ok(ats[4].kind === 'complete' && ats[4].at === 201,
     'and the 201 one finishes the wall, behind the secret badge');

  ok(ats.slice(0, 4).every((r) => r.kind === 'theme'), 'the other four are themes');

  // ---- the themes themselves, on the app side ----
  ['cinder', 'quartz', 'lumen'].forEach((k) =>
    ok(new RegExp('^\\s*' + k + ':\\s*\\{[^}]*reward:true', 'm').test(src), 'the app carries the ' + k + ' theme'));
  ok(new RegExp('^\\s*vortex:\\s*\\{[^}]*dynamic:\'vortex\'', 'm').test(src),
    'and Vortex is a dynamic theme, so applyTheme gives the body its class');
  ok(count('reward:true') === 4, 'exactly four themes are rewards (' + count('reward:true') + ')');
  ok(count(src, 'function rewardThemeOK(key){') === 1, 'the Theme tab gates them live, not on a stored flag');
  ok(src.indexOf('if(th.reward && !rewardThemeOK(key)){') !== -1, 'and refuses the tap with a reason');
  ok(count('window.__scRewardThemeUnlocked') >= 2, 'the wall and the Theme tab are both halves of it');
  // 70.1.3: the 201st tile was the table’s one reward with a side effect, a
  // grant of Premium. It is a trophy now and the hook that minted it is gone
  // with the rest of the paywall, so the celebration is all that is left.
  ok(count('window.__scGrantPremium') === 0 && count('setPremiumActive') === 0,
    'and the trophy still grants something on the side');
  ok(countMod('grantRewards(!!silent);') === 1,
    'and the wall stops celebrating the last tile');
  ok(src.indexOf('grantRewards(!!silent);\n    return fresh;') !== -1,
    'and is granted whenever the count is evaluated, not only on the frame a badge unlocks');

  // ---- the whirl ----
  ok(count(src, 'body.theme-dyn-vortex::before') === 1, 'Vortex has a backdrop rule of its own');
  ok(/body\.theme-dyn-vortex::before\{[\s\S]{0,700}transform: rotate\(var\(--whirl-deg, 0deg\)\)/.test(src),
    'and it rotates on the angle the finger writes');
  ok(count(mod, 'function whirlAngle(e)') === 1, 'which the module computes from where the finger is');
  ok(mod.indexOf("'--whirl-deg'") !== -1, 'and writes to the page as --whirl-deg');
  ok(/closest\('#nowPlaying, input, \.sc-sheet, \.sc-slider'\)/.test(mod),
    'while never stealing a drag from the player or a sheet');
  ok(count(mod, 'window.__scNoteTheme = noteTheme;') === 1,
    'and the app reports every theme change, so wearing one from Settings counts too');

  // ---- every tile on the wall is reachable, and none of them needs a share ----
  // Three tiles used to be unearnable (a stat the app always reported as zero, a
  // flag nothing ever set) and two counted the export buttons, which on a phone
  // open the share sheet. Premium needs ALL 201, so one impossible tile blocks the
  // reward - these are the assertions that keep that from coming back.
  ok(countMod('albums: 0,') === 0, 'no stat the badges read is a hard-coded zero');
  ok(countMod('albums: Object.keys(albums).length') === 1, 'the album count is computed from the library');
  ok(countMod("call('__scUserAlbums')") === 1 && count('window.__scUserAlbums = function(){') === 1,
    'and the app hands its own album map over for it');
  ok(countMod('albumsMade: made') === 1, 'with the hand-built albums counted as well');
  ok(countMod("markFeature('autodj')") === 1, 'the one flag nothing used to set is set now');
  ok(countMod("return ctr('exportAll')") === 0 && countMod("return ctr('exportSongs')") === 0,
    'and no badge counts an export any more');
  // 70.0.6, the user's words: "The badges shouldny do with altering your songs".
  // The three in-place editors are tools, not achievements - and neither is the
  // space one of them wins back.
  ok(countMod("'crop', 'retag', 'reencode'") === 0, 'the feature list no longer wants an edit');
  ok(countMod("return ctr('savedBytes')") === 0 && countMod("return ctr('crops')") === 0 &&
     countMod("return ctr('batch')") === 0 && countMod("return ctr('tagged')") === 0,
     'and no tile counts a re-encode, a batch tag run or the space it won back');
  ok(countMod('d.reencoded') === 0 && countMod('reencoded: reencoded') === 0,
     'nor reads the re-encoded stat the cleaner keeps');
  ok(countMod("id: 'crop_1'") === 0 && countMod("id: 'retag_1'") === 0 && countMod("id: 'reencode_1'") === 0,
     'and the three hand-written editing badges are off the wall');
  ok(countMod("bump('queue', 1)") === 1 && countMod("bump('search', 1)") === 1,
    'the two local replacements are wired: a queued song and a library search');
  ok(countMod("return ctr('search')") === 1 && countMod("return ctr('queue')") === 1,
    'and the tiles are the ones that read them');
  ok(countMod('plays_5000') === 0 && countMod('plays_3000') === 2,
    'the 5,000-play target is off the wall in both places (id and its group)');
  ok(countMod('var FEATURE_KEYS = [') === 1, 'the feature list is named once');
  ok(countMod('featuresUsed: FEATURE_KEYS.filter(') === 1,
    'and "used every feature" counts that list instead of any one flag');

  // The generated tables carry the reachable ceilings. Read them back and assert
  // the maxima, so a future edit cannot quietly reintroduce a 2,000-song shelf.
  const caps = [
    ['plays', 3, 2000], ['hours', 0.1, 150], ['one song', 2, 25], ['different songs', 1, 200],
    ['late-night', 3, 25], ['artists', 2, 200], ['genres', 1, 20], ['streak', 2, 180],
    ['streak', 7, 60], ['songs shelved', 1, 1000], ['albums', 1, 12], ['playlists', 1, 12],
    ['favorites', 1, 100],
  ];
  const tableBlock = mod.slice(mod.indexOf('var BADGE_TIERS = ['), mod.indexOf('// The counting tiers'));
  const vals = [...tableBlock.matchAll(/vals: \[([^\]]+)\]/g)].map((m) => m[1].split(',').map((n) => Number(n.trim())));
  ok(vals.length === 13, 'the thirteen threshold rows are all present (' + vals.length + ')');
  const maxima = vals.map((v) => Math.max(...v));
  ok(maxima.every((m, i) => m <= (caps[i] ? caps[i][2] : Infinity)),
    'and none reaches past its ceiling (' + maxima.join(', ') + ')');
  ok(vals.every((v) => v.every((n, i) => i === 0 || n > v[i - 1])),
    'every table still climbs in one direction');
}

console.log('\n[9] the same release, driven on the real app');
{
  let out = '', code = 0;
  try {
    out = execFileSync(process.execPath, [path.join(ROOT, 'dev/studio-70-check.cjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
  } catch (e) {
    code = e.status === undefined ? 1 : e.status;
    out = String((e.stdout || '') + (e.stderr || ''));
  }
  const last = out.trim().split('\n').pop() || '(no output)';
  ok(code === 0, 'dev/studio-70-check drives the real app: ' + last);
  const n = parseInt((last.match(/All (\d+) checks/) || [])[1] || (last.match(/(\d+) passed/) || [])[1] || '0', 10);
  ok(n >= 100, 'and every one of its ' + n + ' checks passed');
}

console.log('\n[10] what the earlier releases shipped is still standing');
{
  const run = (file) => {
    let o = '', c = 0;
    try { o = execFileSync(process.execPath, [path.join(ROOT, 'dev', file)], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
    catch (e) { c = e.status === undefined ? 1 : e.status; o = String((e.stdout || '') + (e.stderr || '')); }
    return { o, c };
  };
  const gates = [
    ['test-66431.mjs', 'the list is still not rebuilt while you are scrolling it'],
    ['test-6643.mjs', 'the two library halves still keep their own place'],
    ['ota-guard-check.cjs', 'the update guard still refuses a downgrade'],
    ['audit-calls.mjs', 'every name the app reads is still declared']
  ];
  gates.forEach(([file, what]) => {
    const r = run(file);
    const last = (r.o.trim().split('\n').filter(Boolean).pop() || '(no output)');
    ok(r.c === 0, what + ' (' + file + ': ' + last + ')');
  });
}

console.log('\n[10b] the streak, the album cover, the search box and the sheet');
{
  // 70.1.5. Four reported defects, one rule each. The streak rules are the
  // whole point: the failure was a restore that wrote the meta row and never
  // handed it to the running session, so BOTH paths in have to be asserted,
  // not just the presence of the row.
  ok(count('function scAdoptLiveStats(') === 1 && count('scAdoptLiveStats(manifest.stats);') === 1 &&
     count('scAdoptLiveStats(state.meta);') === 1,
     'a restored listening streak is handed to the running session, both ways in');
  // 70.2.1. The camera moved off the album card and into Manage albums: the
  // card header no longer carries it (it shared the row with the tap that opens
  // the album), and every row in Manage albums has its own cover button.
  ok(count('function albumCoverModal(') === 1 && count('function applyAlbumCover(') === 1 &&
     count('alb-cover-btn') === 0 && count('class="mgr-alb-cover"') === 1 &&
     count("bEl.querySelectorAll('.mgr-alb-cover')") === 1,
     'an album cover is changed from Manage albums, not from the album row');
  ok(count('searchClearBtn') >= 3 &&
     count('#searchInput:not(:placeholder-shown) + #searchClearBtn') === 1,
     'the library search box has a clear button the field itself shows');
  ok(count('width:440px; max-width:calc(100vw - 32px)') === 1,
     'the Add songs sheet is wide enough for its five buttons');
}

console.log('\n[10c] the select bar and the Discover search row');
{
  // 70.1.6. Both are layout, and jsdom measures every element as 0, so what is
  // asserted here is the stylesheet and the class the script has to emit. The
  // real-app probe drives both rows; this is the static half of the same claim.
  ok(count('pane-header.select-bar') === 4 &&
     count("header.className = 'pane-header' + (selectMode ? ' select-bar' : '')") === 1,
     'the select bar keeps its label on one line and wraps its seven buttons');
  ok(count('id="discoverSearchWrap"') === 1 &&
     count('#discoverSearch:not(:placeholder-shown) + #discoverSearchClear') === 1,
     'the Discover field and its clear button are one control');
  ok(count('#discoverSearchRow #discoverSearchBtn{ flex:0 0 auto; }') === 1,
     'and the Search button no longer takes the field width');
}

console.log('\n[10d] the DJ Mode loop controls');
{
  // 70.1.7. Every one of these is a hole that made a loop control do nothing:
  // a guard that needed a live sound source, a window that only ever existed on
  // the node, a playhead that walked out of the loop, and a hold the browser
  // could cancel. The audio half cannot run here (no Web Audio in a text gate),
  // so this is the code shape and the real-app probe drives the resting state.
  ok(count('function applyDeckLoop(') === 1 && count('function armDeckLoop(') === 1 &&
     count('function clearDeckLoop(') === 1 && count('    loop: null,         // { start, end } or null') === 1,
     'the loop window is armed on the deck, not only on the sound source');
  ok(count('if(!deckEngine.buffer || !deckEngine.node){ toast') === 0 &&
     count('if(!deckEngine.buffer || !deckEngine.running || !deckEngine.node) return;') === 0,
     'and neither the LOOP button nor a beat pad needs a live node any more');
  ok(count('pos = lp.start + (pos - lp.start) % span;') === 1,
     'the playhead is folded back into the loop instead of walking out of it');
  ok(count('btn.setPointerCapture(e.pointerId)') >= 1 &&
     count("['pointerup','pointercancel'].forEach(ev => btn.addEventListener(ev, () => {") === 1 &&
     count("['pointerup','pointercancel','pointerleave'].forEach(ev => btn.addEventListener(ev, () => {") === 0,
     'a held pad keeps the pointer and ends only when the finger is released');
  ok(count('.beat-pad, .fx-pad, .drum-pad, .hotcue-btn{ touch-action:none; }') === 1,
     'and the pads own the touch so a scrolling sheet cannot cancel the hold');
}

console.log('\n[10e] SAVE COPY in DJ Mode');
{
  // 70.1.8. The claim is that a DJ copy is the song with the deck's own sound on
  // it, as a NEW song. What a text gate can hold: the button exists, the render is
  // offline, every baked value is read from a live node, and the result goes in
  // through the same helper a finished conversion uses. The audio itself cannot be
  // rendered here (no Web Audio in jsdom) - the probe drives the resting state.
  ok(count('id="djCopyBtn"') === 1 && count('async function saveDjCopy(') === 1,
     'the DJ deck has a SAVE COPY button that is really wired');
  ok(count('const octx = new Offline(chCount') === 1 &&
     count('const rendered = await octx.startRendering();') === 1,
     'and it renders the song offline rather than recording it in real time');
  ok(count('src.playbackRate.value = state.rate;') === 1 &&
     count('src.detune.value = state.detune;') === 1 &&
     count('if(node.detune) detune = node.detune.value || 0;') === 1,
     'the copy is the speed the deck is really playing, detune included');
  ok(count('const liveFilter = deckEngine.filterNode;') === 1 &&
     count('(eqNodes[0] || []).forEach') === 1 &&
     count('conv.buffer = rv.convolver.buffer;') === 1 &&
     count('const liveLimiter = limiterNodes[0];') === 1,
     'and every baked value is read from the live chain, not the knobs');
  ok(count('scAddConvertedToLibrary(blob, meta, { fmt: \'mp3\', source: \'djmode\' })') === 1 &&
     count(" + ' (DJ edit)';") === 1,
     'the copy lands in the library as its own song, and the original is never written');
}

console.log('\n[11] the file still holds together');
{
  let code = 0, out = '';
  try { out = execFileSync(process.execPath, [path.join(ROOT, 'dev/check-dom.mjs')], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }); }
  catch (e) { code = e.status === undefined ? 1 : e.status; out = String((e.stdout || '') + (e.stderr || '')); }
  ok(code === 0, 'the document still closes every element and every id it reads exists: ' + (out.trim().split('\n').pop() || ''));
  ok(count('  const CHANGELOG = [') === 1, 'the changelog is still one array');
  ok(count('id="listPane"') === 1 && count('id="homeBubbles"') === 1, 'the list pane and the Home grid are still there');
  ok(count('id="nowPlaying"') === 1, 'and there is still one player');
  const blocks = [...src.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)];
  let bad = 0, badMsg = '';
  blocks.forEach((m) => { try { new Function(m[1]); } catch (e) { bad++; badMsg = e.message; } });
  ok(bad === 0, 'every inline script in the page parses (' + blocks.length + ' blocks' + (bad ? ': ' + badMsg : '') + ')');
}

console.log('\n' + (fail ? pass + ' passed, ' + fail + ' FAILED' : 'All ' + pass + ' checks passed'));
process.exit(fail ? 1 : 0);
