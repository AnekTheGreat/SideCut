#!/usr/bin/env node
/**
 * SideCut 70.1.9 - donations reach the copies Google Play will not sell to, and
 * the store build says where the audio can come from.
 *
 * The user's words: "make donations work on the apk", then the payment links ("10
 * 25 and 50 this is 5", confirmed as MI01 = 5, MI02 = 10, MI03 = 25, MI04 = 50,
 * plus "What about 2 dollar stripe", which is MI00 = 2), and "In play version you
 * can put that you can get mp3's from external sources as well".
 *
 * THE CARD PAGES ARE FOR THE SIDELOADED PACKAGE AND THE BROWSER ONLY, which is the
 * user's second correction and the rule this release now encodes: "store is for
 * apk/web only not play store that has play billing". A copy installed from Play
 * has Billing and stays on it - `SC_IS_PLAY` never looks up a card page and never
 * names one, so the fallback sentence there is exactly the one 70.1.3 shipped - and
 * THE DONATE PANE THAT COPY RENDERS IS THE 70.1.8 PANE: the two sentences a card
 * page changes are rewritten only when a copy really can offer one, so nothing on
 * the store build reads differently from the release before this one.
 *
 * RENUMBERED FOUR TIMES, and the reason is the same every time: this release was
 * parked waiting on a hosted payment page, and a release that shipped in the
 * meantime took the number. 70.1.5 shipped the four library fixes, 70.1.6 the two
 * broken rows (the select-mode bar and the Discover search field), 70.1.7 the DJ
 * Mode loop controls and 70.1.8 SAVE COPY in DJ Mode, so this moved up one number
 * rather than being applied out of order. Its stamp sits just after 70.1.8's for
 * the same reason the changelog reads newest first - if it is applied days later,
 * re-read the clock: a stamp more than fifteen minutes in the future fails
 * test-6643.
 *
 * WHY THE APK COULD NOT DONATE. SideCut ships two Android packages. The `play`
 * flavour is com.SideCut.myapp, the one in the Play listing, and Google Play
 * Billing sells inside it. The `full` flavour is a separate package that Play has
 * never heard of, so Play has no products to offer it and never will: billing
 * inside a sideloaded copy is a lookup that returns nothing, not a permission
 * problem that can be worked around in code. That is a rule of the store, not a
 * bug in the app, and no amount of billing code changes it.
 *
 * WHAT THIS RELEASE DOES. It gives those copies a payment rail that does not go
 * through Google at all: `PAYMENT_CONFIG.donateLinks`, one hosted card page per
 * amount. Two, five, ten, twenty-five and fifty each have a Stripe Payment Link,
 * and a tap on one of those tiers in a copy that cannot bill opens it in the
 * browser. The two rails therefore mean the same thing everywhere - the tier the
 * user tapped is the amount that is paid - and a tier with no page of its own
 * keeps the route the earlier release left it (the Play listing), now saying which
 * amounts do work here. `donateUrl` stays as the one-page-for-every-amount
 * alternative: a link that carries a number in its path takes `{amt}`, and a
 * "customers choose what they pay" link is used as it is, which is how a PayPal.me
 * or a Cash App link works.
 *
 * THE COPY ON THE STORE BUILD. That build takes only the files the user has, and
 * its walkthrough said so - "the audio files saved on your device" - which reads
 * as a limit. It now says the same thing without the limit: the walkthrough that
 * Discover and Settings both show, the first-run sheet and the tutorial summary
 * all add that audio from external sources works too (a computer, a cloud drive,
 * an SD card, an email, a chat or another app), because the file on the phone is
 * the whole route in. Nothing about what the build does changed - it still fetches
 * nothing - and dev/test-play-copy.mjs still holds that copy to the wider term
 * list, which is why none of this wording names a source or a tool.
 *
 *   node dev/patch-7019.mjs
 *   node dev/patch-7019.mjs --check   # report only
 */
import fs from 'node:fs';
import path from 'node:path';

// SC_ROOT replays the same edits against a scratch copy of the tree.
const ROOT = process.env.SC_ROOT
  ? path.resolve(process.env.SC_ROOT)
  : path.resolve(new URL('.', import.meta.url).pathname, '..');
const IDX = path.join(ROOT, 'index.html');
const SW = path.join(ROOT, 'sw.js');
const TEST705 = path.join(ROOT, 'dev', 'test-705.mjs');
const STUDIO70 = path.join(ROOT, 'dev', 'studio-70-check.cjs');

const CHECK = process.argv.includes('--check');
const VERSION = '70.1.9';
const PREV = '70.1.8';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 5:00 PM EDT';
const CACHE = 'sidecut-shell-v63.0.45';
const OLDCACHE = 'sidecut-shell-v63.0.44';
const TITLE = 'Donations reach the sideloaded package and the browser: a tap on a tip tier opens a real card page, and the store build says the audio can come from anywhere';

// The one thing this release needs from the outside world: a hosted card page per
// amount. Stripe Payment Links are fixed amounts, so these are one per tier.
const LINKS = [
  [2, 'https://buy.stripe.com/eVqcN48Yn37BeBOagIdMI00'],
  [5, 'https://buy.stripe.com/28E4gyb6vfUn1P2dsUdMI01'],
  [10, 'https://buy.stripe.com/4gM4gy5Mb8rVbpC1KcdMI02'],
  [25, 'https://buy.stripe.com/6oUdR8fmLaA351e1KcdMI03'],
  [50, 'https://buy.stripe.com/4gM8wOb6v23x8dqcoQdMI04'],
];

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), and none may read as a music downloader on the WIDER list
// dev/test-play-copy.mjs audits the store build against - which includes the word
// mp3, download, convert, "get song", "save the file" and "hand-off". test-662,
// test-6642 and test-66421 refuse the same words, plus "play build", "play
// version" and "play install". One note names a surface the 662 rule looks for.
const NOTES = [
  'Donations work on the copy Google Play will not sell to. Google Play only sells inside the copy Google Play distributed, so the package this repo builds for sideloading had nothing to charge and every tip ended at a sentence telling you to install a different build. A tap on a tier there opens a real card page in the browser now, and the money moves.',
  'Two, five, ten, twenty-five and fifty each have their own card page, and they belong to the package built for sideloading and to the browser. A copy installed from Google Play is exactly the app it was: Billing, the Play sheet and the listing are untouched by this release, and no card page is reachable from it. In the other copies the tap opens the card page with that amount already set, so nothing has to be typed in.',
  'The store build now says the audio can come from anywhere. Its walkthrough for getting music into the library - the same one Discover shows - and the first-run sheet and tutorial summary on that build all add that audio from external sources works too: a computer, a cloud drive, an SD card, an email, a chat or another app, because the file on the phone is the whole route in.',
  'A tip from a browser tab works too. SideCut in a plain browser cannot bill either, so the Donate tab there opens the card page instead of sending you off to another copy first - which is where a tip from a tab used to end.',
  'Nothing unlocks when you tip, and nothing changes if you do not. A tip buys no entitlement on purpose: the player, the dock and the library are the same app whether a tip was made or not, on the standalone package exactly as on the copy from Google Play.',
  'Nothing else moved in this release. The badge wall, Studio and the DJ Mode deck are the ones the last release left, and a library saved before this release comes back the same way.',
];

const problems = [];
const count = (hay, needle) => hay.split(needle).length - 1;
const holder = (text) => ({ text: text });

function sub(h, label, oldStr, newStr, opts){
  opts = opts || {};
  if(opts.key && count(h.text, opts.key) >= 1){ already++; return; }
  const n = count(h.text, oldStr);
  if(n === 0){ problems.push('anchor missing (' + label + ')'); return; }
  if(n > 1 && !opts.all){ problems.push('anchor not unique, found ' + n + ' (' + label + ')'); return; }
  // A replacement that drops the newline the anchor had joins two lines
  // together, and the join parses. Refused here instead of found later.
  if(oldStr.slice(-1) === '\n' && newStr !== '' && newStr.slice(-1) !== '\n'){
    problems.push('replacement drops the trailing newline (' + label + ')');
    return;
  }
  h.text = h.text.split(oldStr).join(newStr);
  applied++;
}

const block = (lines) => lines.join('\n') + '\n';
let applied = 0, already = 0;

const html = holder(fs.readFileSync(IDX, 'utf8'));
const sw = holder(fs.readFileSync(SW, 'utf8'));
const t705 = holder(fs.readFileSync(TEST705, 'utf8'));
const studio = holder(fs.readFileSync(STUDIO70, 'utf8'));

// `--check` on a tree already at this release has nothing to report.
if(CHECK && count(html.text, "const APP_VERSION = '" + VERSION + "';") === 1){
  console.log('patch-7019: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

for(const [amt, url] of LINKS){
  if(!/^https:\/\/buy\.stripe\.com\/[A-Za-z0-9]+$/.test(url)) problems.push('the card page for $' + amt + ' is not a Stripe link (got: ' + url + ')');
}

/* ============================================ A. THE ROUTE OUT OF THE DONATE TAB */
// The config block has held one field since 70.1.3 - the Play listing - and this
// is the second one. It is deliberately last: everything above it is unchanged.
sub(html, 'PAYMENT_CONFIG.donateLinks',
  "    playStoreListing: 'https://play.google.com/store/apps/details?id=com.SideCut.myapp',\n" +
  '  };\n',
  block([
    "    playStoreListing: 'https://play.google.com/store/apps/details?id=com.SideCut.myapp',",
    '    // 70.1.9 - the web route out. Google only sells inside the copy it',
    '    // distributed, so a copy that came from anywhere else - the package this',
    '    // repo builds for sideloading, and a plain browser - had nothing to charge',
    '    // and every tip ended at "install the Play build", with no tip possible',
    '    // anywhere. One hosted card page per amount: a tap on a tier opens its own',
    '    // link in the browser. Stripe Payment Links are fixed amounts, which is why',
    '    // there is one per tier rather than one page for all of them. An amount with',
    '    // no entry here keeps the route the earlier release left it (the listing),',
    '    // and a copy installed from Google Play never looks any of this up at all:',
    '    // it has Billing, and the store build stays on it.',
    '    donateLinks: {',
    ...LINKS.map(([amt, url]) => '      ' + amt + ": '" + url + "',"),
    '    },',
    '    // One page for every amount instead of one per tier. A link that carries the',
    '    // number in its path (PayPal.me, Cash App) takes `{amt}` here; a page the',
    '    // payer sets the amount on is used exactly as it is. Empty - the default -',
    '    // means the per-amount links above are the only web route.',
    "    donateUrl: '',",
    '  };',
  ]),
  { key: 'donateLinks: {' });

// The link builder. Kept beside the billing code it stands in for, and tolerant on
// purpose: no page configured comes back empty, which is the "there is no web
// route" answer the caller branches on.
sub(html, 'donateUrlFor + donateTierList',
  block([
    '  async function purchasePlayTip(sku){',
    '    return purchasePlayItem(sku, true);',
    '  }',
  ]),
  block([
    '  // 70.1.9. The web card page for a chosen amount, or an empty string when the',
    '  // copy has no page for it. The per-amount table is asked first, because a',
    '  // Payment Link fixes the amount in the link itself; the templated field is the',
    '  // one-page-for-every-amount alternative underneath it.',
    '  function donateUrlFor(amt){',
    '    const n = parseInt(amt, 10);',
    '    let links = {};',
    '    try{ links = PAYMENT_CONFIG.donateLinks || {}; }catch(_eLinks){ links = {}; }',
    '    const direct = links[n];',
    '    if(direct) return String(direct).trim();',
    "    const base = String(PAYMENT_CONFIG.donateUrl || '').trim();",
    "    if(!base) return '';",
    "    if(base.indexOf('{amt}') === -1) return base;",
    "    if(!isFinite(n) || n <= 0) return '';",
    "    return base.split('{amt}').join(String(n));",
    '  }',
    '  // The amounts that do have a card page, read off the table above rather than',
    '  // written out again, so a sentence about them cannot go stale when a link is',
    '  // added. Returns "2, 5, 10, 25 or 50", or an empty string when there are none.',
    '  function donateTierList(){',
    '    let keys = [];',
    '    try{ keys = Object.keys(PAYMENT_CONFIG.donateLinks || {}); }catch(_eTiers){ keys = []; }',
    '    const labels = keys.map(function(k){ return parseInt(k, 10); })',
    '      .filter(function(n){ return isFinite(n) && n > 0; })',
    '      .sort(function(a, b){ return a - b; })',
    '      .map(function(n){ return "$" + n; });',
    '    if(!labels.length) return "";',
    '    const last = labels.pop();',
    '    return labels.length ? labels.join(", ") + " or " + last : last;',
    '  }',
    '',
    '  async function purchasePlayTip(sku){',
    '    return purchasePlayItem(sku, true);',
    '  }',
  ]),
  { key: 'function donateUrlFor(' });

/* ======================================== B. A TAP THE APK CAN ACTUALLY COMPLETE */
// runTip now carries the amount as well as the product id, because the web route
// needs the number the user tapped and the Play route does not.
sub(html, 'runTip signature', '    async function runTip(sku){\n', '    async function runTip(sku, amt){\n',
  { key: 'async function runTip(sku, amt){' });

sub(html, 'runTip web route',
  block([
    '      // 70.1.3: this is the APK and the browser, which have no Billing at all.',
    '      // A tip still cannot be made here - but the install that CAN make one is',
    '      // one tap away, so the message ends in the Play listing instead of a stop.',
    "      msg.textContent = (reason || 'Tips are processed through Google Play and only work inside the SideCut app installed from Play.') +",
    "        ' Opening the Play Store so you can install that copy.';",
  ]),
  block([
    '      // 70.1.9: this is the package built for sideloading and the browser, and',
    '      // this is the branch that used to end the tip. Google will never sell to a',
    '      // copy it did not distribute, so the only way a tip can be made here is off',
    '      // the store entirely - a hosted card page. The amounts that have one open',
    '      // it and the money moves; an amount that does not still ends in the Play',
    '      // listing the way 70.1.3 left it, now saying which amounts do work here.',
    '      //',
    '      // THE STORE BUILD IS NOT A PART OF THIS AT ALL. A copy installed from',
    '      // Google Play has Billing, so it never looks a card page up and never',
    '      // names one - if Billing is unavailable there, the sentence it always',
    '      // had is the sentence it gets, and the listing is still the route.',
    "      const web = SC_IS_PLAY ? '' : donateUrlFor(amt);",
    '      if(web){',
    "        msg.style.color = 'var(--coral)';",
    "        msg.textContent = 'Google Play only sells inside the copy it distributed, so this tip is opening a secure card page in your browser for $' +",
    "          (parseInt(amt, 10) || 0) + ' instead. Thank you for chipping in.';",
    "        try{ window.open(web, '_blank', 'noopener'); }catch(_eDon){ }",
    '        return;',
    '      }',
    "      const tierList = SC_IS_PLAY ? '' : donateTierList();",
    "      msg.textContent = (reason || 'Tips are processed through Google Play and only work inside the SideCut app installed from Play.') +",
    "        (tierList ? ' Tip ' + tierList + ' to pay by card here, or open the Play Store so you can install that copy.' : ' Opening the Play Store so you can install that copy.');",
  ]),
  { key: 'const web = SC_IS_PLAY' });

sub(html, 'the tier hands its amount to runTip',
  '        runTip(sku);\n', '        runTip(sku, amt);\n',
  { key: 'runTip(sku, amt);' });

/* ================================================= C. WHAT THE PANE SAYS IT DOES */
// The promise under the heading is FILLED from the amount table when the pane
// opens, not written out beside it: the list of amounts changes whenever a card
// page is added, and a second copy of it in static markup would go stale the first
// time that happened. The markup keeps the sentence that is true everywhere (a
// copy with Billing and nothing else), and only a copy that can offer a page
// replaces it.
sub(html, 'the promise is the one the script fills',
  '<div style="font-size:12px; color:var(--ink-dim); margin-bottom:12px; text-align:center;">Pick an amount \u2014 Google Play handles the payment.</div>',
  '<div id="donatePromise" style="font-size:12px; color:var(--ink-dim); margin-bottom:12px; text-align:center;">Pick an amount \u2014 Google Play handles the payment.</div>',
  { key: 'id="donatePromise"' });

// The intro paragraph is the store build's own sentence and stays that sentence:
// this only gives the div a name, so the copies that can take a card page have
// something to rewrite the one clause for. The text written here is the text the
// markup already had, character for character.
sub(html, 'the intro paragraph gets a name',
  "<div style=\"font-size:12px; color:var(--ink-dim); line-height:1.5;\">SideCut is free and ad-free. If it's made your listening better, a tip helps keep it running and improving \u2014 processed through Google Play. Thank you!",
  "<div id=\"donateIntro\" style=\"font-size:12px; color:var(--ink-dim); line-height:1.5;\">SideCut is free and ad-free. If it's made your listening better, a tip helps keep it running and improving \u2014 processed through Google Play. Thank you!",
  { key: 'id="donateIntro"' });

sub(html, 'initDonateTab fills the rails sentence',
  '    if(!pane || pane._donateInit) return;\n',
  block([
    '    if(!pane || pane._donateInit) return;',
    '    // 70.1.9. A copy that can offer a card page says so, and names the amounts',
    '    // it can take there from the table itself - a second list in markup would go',
    '    // stale the first time a link was added, which is exactly what happened while',
    '    // this release was being written. THE COPY INSTALLED FROM GOOGLE PLAY IS NOT',
    '    // TOUCHED AT ALL: it has Billing, neither sentence changes, and nothing below',
    '    // runs for it.',
    "    const promise = $('donatePromise');",
    '    if(promise && !SC_IS_PLAY){',
    '      const tierList = donateTierList();',
    '      if(tierList){',
    "        const intro = $('donateIntro');",
    "        promise.textContent = 'Pick an amount \u2014 Google Play takes it inside the copy installed from Play, and ' + tierList + ' open a secure card page in every other copy.';",
    "        if(intro) intro.textContent = \"SideCut is free and ad-free. If it's made your listening better, a tip helps keep it running and improving \u2014 a secure card page takes it here. Thank you! \uD83D\uDC9B\";",
    '      }',
    '    }',
  ]),
  { key: "const promise = $('donatePromise');" });

/* ========================================= D. THE STORE BUILD SAYS WHERE AUDIO COMES FROM */
// The user's words: "In play version you can put that you can get mp3's from
// external sources as well". The walkthrough below opened with "the audio files
// saved on your device", which reads as a limit; the four edits add the other half
// without changing what the build does (it still fetches nothing). Every one of
// them stays inside the SC_IS_PLAY block, and none of them names a source or a
// tool - dev/test-play-copy.mjs runs the wider term list over this exact string.
sub(html, 'the walkthrough in Get Songs and Discover',
  block([
    "      + '<div style=\"display:flex; gap:8px;\"><span style=\"color:var(--coral); flex-shrink:0;\">5.</span><span>Moving phones or restoring a backup: <b style=\"color:var(--ink);\">Import library</b> brings back the whole .zip \u2014 playlists, albums and tags included.</span></div>'",
    "      + '</div>';",
  ]),
  block([
    "      + '<div style=\"display:flex; gap:8px;\"><span style=\"color:var(--coral); flex-shrink:0;\">5.</span><span>Moving phones or restoring a backup: <b style=\"color:var(--ink);\">Import library</b> brings back the whole .zip \u2014 playlists, albums and tags included.</span></div>'",
    "      + '<div style=\"display:flex; gap:8px;\"><span style=\"color:var(--coral); flex-shrink:0;\">\u2022</span><span><b style=\"color:var(--ink);\">MP3s from external sources work too</b> \u2014 a computer, a cloud drive, an SD card, an email, a chat or another app. Once the file is on the phone it imports exactly like the rest.</span></div>'",
    "      + '</div>';",
  ]),
  { key: 'MP3s from external sources work too' });

sub(html, 'the first-run sheet',
  block([
    "      + '<div style=\"display:flex; gap:8px;\"><span style=\"color:var(--coral); flex-shrink:0;\">3.</span><span><b>Import library</b> restores a full backup .zip, including playlists, albums and tags.</span></div>'",
    "      + '</div>';",
  ]),
  block([
    "      + '<div style=\"display:flex; gap:8px;\"><span style=\"color:var(--coral); flex-shrink:0;\">3.</span><span><b>Import library</b> restores a full backup .zip, including playlists, albums and tags.</span></div>'",
    "      + '<div style=\"display:flex; gap:8px;\"><span style=\"color:var(--coral); flex-shrink:0;\">\u2022</span><span><b>Audio from external sources works too</b> \u2014 a computer, a cloud drive, an SD card, an email, a chat or another app. Once the file is on the phone, <b>+ Add songs</b> brings it in.</span></div>'",
    "      + '</div>';",
  ]),
  { key: 'Audio from external sources works too' });

sub(html, 'the tutorial summary',
  "restores a backup .zip.</span>';",
  "restores a backup .zip. <b>MP3s from external sources work the same way</b> \u2014 once the file is on the phone, <b>+ Add songs</b> brings it in.</span>';",
  { key: 'MP3s from external sources work the same way' });

// The help answers are the corpus the built-in assistant reads on that build, and
// its first-music-in answer is where somebody asks this. Appended, so the answer
// keeps the shape it had. No apostrophe: it is a single-quoted literal.
sub(html, 'the store build help answer',
  'That is what it is for - your files, on your device, with no ads.',
  'That is what it is for - your files, on your device, with no ads. Audio from external sources works as well: a computer, a cloud drive, an SD card, an email, a chat or another app all end up as a file on the phone, and **+ Add songs** imports it.',
  { key: 'Audio from external sources works as well' });

/* ===================================================== E. THE RELEASE METADATA */
sub(html, 'APP_VERSION',
  "  const APP_VERSION = '" + PREV + "';",
  "  const APP_VERSION = '" + VERSION + "';",
  { key: "const APP_VERSION = '" + VERSION + "';" });

sub(html, 'changelog head',
  '  const CHANGELOG = [\n',
  '  const CHANGELOG = [\n' + block([
    "  { version: '" + VERSION + "', date: '" + STAMP + "', title: '" + TITLE + "', items: [",
  ]) + NOTES.map((n) => "    '" + n + "',").join('\n') + '\n  ] },\n',
  { key: "const CHANGELOG = [\n  { version: '" + VERSION + "'" });

sub(sw, 'shell cache',
  "const CACHE_NAME = '" + OLDCACHE + "';",
  "const CACHE_NAME = '" + CACHE + "';",
  { key: "const CACHE_NAME = '" + CACHE + "';" });

/* ==================================================================== F. THE GATES */
// test-705 is the standing 70.x gate. The structural claims below are about the
// route rather than about the URLs, because the links are a build-time setting and
// this gate runs on whatever page is in front of it.
sub(t705, 'test-705 web route',
  block([
    "  ok(count('donate-quick') >= 12 && count('PAYMENT_CONFIG.playStoreListing') >= 2,",
    "     'or the tip buttons, or the route out for a copy that cannot bill');",
  ]),
  block([
    "  ok(count('donate-quick') >= 12 && count('PAYMENT_CONFIG.playStoreListing') >= 2,",
    "     'or the tip buttons, or the route out for a copy that cannot bill');",
    '  // 70.1.9. A copy that cannot bill is not sent away any more: the amounts with a',
    '  // hosted card page open it. Structural, because the links themselves are',
    "  // settings - what has to be true is that the route exists, that the fallback",
    '  // branch is the one that takes it, that the amount the user tapped is the one',
    '  // that travels with the link, and that an amount with no page keeps the route',
    '  // the earlier release left it.',
    "  ok(count('function donateUrlFor(') === 1 && count('function donateTierList(') === 1,",
    "     'a copy that cannot bill has no card page to open');",
    "  ok(count(\"const web = SC_IS_PLAY ? '' : donateUrlFor(amt);\") === 1 &&",
    "     count('runTip(sku, amt);') === 1 && count('async function runTip(sku, amt){') === 1,",
    "     'or the tip that cannot be billed never asks for that link');",
    "  ok(count(\"const web = SC_IS_PLAY ? '' : donateUrlFor(amt);\") === 1 &&",
    "     count(\"const tierList = SC_IS_PLAY ? '' : donateTierList();\") === 1,",
    "     'and the copy installed from Google Play never leaves Billing for one');",
    "  ok(count('if(promise && !SC_IS_PLAY){') === 1 && count(\"const promise = $('donatePromise');\") === 1,",
    "     'with the pane naming a card page only where one exists');",
    "  ok(count('donateLinks: {') === 1 && count('PAYMENT_CONFIG.donateLinks') >= 2 &&",
    "     count(\"return base.split('{amt}').join(String(n));\") === 1,",
    "     'or an amount without a page of its own has nowhere to go');",
  ]),
  { key: 'a copy that cannot bill has no card page to open' });

// The real-app probe is where this is actually DRIVEN: jsdom has no
// window.Capacitor, which is the sideloaded package and the browser exactly, so a
// tap on a tier takes the branch this release exists to add. The amounts are read
// out of the page rather than hard-coded, so the same section is meaningful
// whatever the build ships - and an amount with no page of its own still has to
// fall back to the Play listing rather than doing nothing.
// The probe is booted twice: once as the sideloaded package (no flag) and once as
// the store build. `play` is window.__PLAY_BUILD__, which is exactly what CI
// injects into the Play AAB, so both sides of the user's line - "store is for
// apk/web only not play store that has play billing" - are MEASURED rather than
// reasoned about. Undefined keeps the first call exactly as it was.
sub(studio, 'studio-70 can boot a store build',
  'function boot() {\n  const errors = [];\n',
  'function boot(play) {\n  const errors = [];\n',
  { key: 'function boot(play) {' });

sub(studio, 'studio-70 sets the store flag before the scripts run',
  '      win.confirm = () => true;\n      win.localStorage.clear();\n',
  '      win.confirm = () => true;\n' +
  '      // Before any inline script runs: SC_IS_PLAY reads this once, at parse time.\n' +
  '      if (play) win.__PLAY_BUILD__ = true;\n' +
  '      win.localStorage.clear();\n',
  { key: 'if (play) win.__PLAY_BUILD__ = true;' });

sub(studio, 'studio-70 donate drive',
  "  console.log('[12] the page still holds together');\n",
  block([
    "  console.log('[11l] a tip from a copy that cannot bill');",
    '  {',
    '    // 70.1.9. A copy that cannot bill used to end every tip at a sentence. What',
    '    // has to be true now is that a tier with its own card page opens it in the',
    '    // browser, that the pane says which amounts those are, and that an amount',
    '    // with no page still ends in the Play listing the way the earlier release',
    '    // left it.',
    "    const pages = {};",
    "    const dlBlock = html.slice(html.indexOf('donateLinks: {'));",
    "    const dlSeg = dlBlock.slice(0, dlBlock.indexOf('}'));",
    "    for (const m of dlSeg.matchAll(/(\\d+): '(https:\\/\\/[^']+)'/g)) pages[m[1]] = m[2];",
    "    ok(Object.keys(pages).length >= 4, 'the Donate tab names a card page per amount (' + Object.keys(pages).sort((a, b) => a - b).map((n) => '$' + n).join(', ') + ')');",
    "    const realOpen = win.open;",
    "    const opened = [];",
    "    Object.defineProperty(win, 'open', { value: (url) => { opened.push(String(url)); return null; }, writable: true, configurable: true });",
    "    win.showSettingsTab('donate');",
    "    const pane = doc.querySelector('#settingsPaneDonate');",
    "    const promise = doc.querySelector('#donatePromise');",
    "    ok(!!promise && promise.textContent.indexOf('secure card page') !== -1,",
    "      'and the pane says a card page is one of the rails (' + (promise ? promise.textContent : '') + ')');",
    "    const intro = doc.querySelector('#donateIntro');",
    "    ok(!!intro && intro.textContent.indexOf('secure card page') !== -1,",
    "      'and the paragraph above it says the same on a copy that can take one');",
    "    const tier = pane && pane.querySelector('.donate-quick[data-amt=\"5\"]');",
    "    ok(!!tier, 'the five dollar tier is still a button in the pane');",
    '    if (tier) {',
    '      tier.click();',
    '      await wait(250);',
    "      ok(opened.length === 1 && opened[0] === pages['5'],",
    "        'and tapping it opens the card page for that amount (' + (opened[0] || 'nothing') + ')');",
    "      const said = doc.querySelector('#donateMsg');",
    "      ok(!!said && /card page/i.test(said.textContent || ''),",
    "        'with a sentence saying where it went');",
    '    }',
    '    opened.length = 0;',
    "    const odd = pane && pane.querySelector('.donate-quick[data-amt=\"7\"]');",
    '    if (odd) {',
    '      odd.click();',
    '      await wait(250);',
    "      ok(opened.length === 1 && /play\\.google\\.com/.test(opened[0]),",
    "        'and an amount with no page of its own still ends in the Play listing');",
    "      const said = doc.querySelector('#donateMsg');",
    "      ok(!!said && /\\$2, \\$5, \\$10, \\$25 or \\$50/.test(said.textContent || ''),",
    "        'saying which amounts do work here');",
    '    }',
    "    Object.defineProperty(win, 'open', { value: realOpen, writable: true, configurable: true });",
    '  }',
    '',
    "  console.log('[11m] the copy installed from Google Play is the app it was');",
    '  {',
    '    // 70.1.9. The user drew this line himself: "the play build should stay as is',
    '    // with play billing no stripe for that". So the store build is booted AS the',
    '    // store build and its Donate pane is compared with the sentences the release',
    '    // before this one shipped. A card page must be unreachable from it, and no',
    '    // sentence of it may mention one.',
    '    const store = boot(true);',
    '    await wait(1500);',
    '    const swin = store.win;',
    '    const sdoc = swin.document;',
    "    swin.showSettingsTab('donate');",
    '    await wait(150);',
    "    const sPromise = sdoc.querySelector('#donatePromise');",
    "    ok(!!sPromise && sPromise.textContent === 'Pick an amount \u2014 Google Play handles the payment.',",
    "      'the store build still promises Google Play alone (' + (sPromise ? sPromise.textContent : '') + ')');",
    "    const sIntro = sdoc.querySelector('#donateIntro');",
    "    ok(!!sIntro && sIntro.textContent.indexOf('processed through Google Play') !== -1 &&",
    "       sIntro.textContent.indexOf('secure card page') === -1,",
    "      'and its paragraph is the one it shipped, with no card page in it');",
    '    const sOpened = [];',
    '    const sRealOpen = swin.open;',
    "    Object.defineProperty(swin, 'open', { value: (url) => { sOpened.push(String(url)); return null; }, writable: true, configurable: true });",
    "    const sTier = sdoc.querySelector('.donate-quick[data-amt=\"5\"]');",
    "    ok(!!sTier, 'with its tip tiers still there');",
    '    if (sTier) {',
    '      sTier.click();',
    '      await wait(300);',
    "      ok(sOpened.length === 1 && /play\\.google\\.com/.test(sOpened[0]),",
    "        'and a tap on one still ends in the Play listing, never a card page (' + (sOpened[0] || 'nothing') + ')');",
    "      const sSaid = sdoc.querySelector('#donateMsg');",
    "      ok(!!sSaid && sSaid.textContent.indexOf('card page') === -1,",
    "        'with nothing it says naming a card page');",
    '    }',
    "    Object.defineProperty(swin, 'open', { value: sRealOpen, writable: true, configurable: true });",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]),
  { key: '[11l] a tip from a copy that cannot bill' });

/* ============================================================ G. WHAT MUST STILL HOLD */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // Nothing about the removal or the surviving tip rail may have moved.
  must(count(page, 'settingsPanePremium') === 0 && count(page, 'isPremiumActive') === 0,
    'Premium came back with this release');
  must(count(page, 'id="settingsTabDonate"') === 1 && count(page, 'id="settingsPaneDonate"') === 1 &&
    count(page, 'function initDonateTab(){') === 1,
    'the Donate tab left with the release');
  must(count(page, 'const PLAY_TIP_PRODUCTS = {') === 1 && count(page, 'purchasePlayTip') === 2,
    'the tip tiers and the Play call are not both intact');
  must(count(page, 'donate-quick') >= 12, 'the tip buttons are not all there');
  must(count(page, 'playStoreListing') === 3,
    'the Play listing is not used exactly twice in code and once in the config');
  // The route itself, and the build it is not for.
  must(count(page, 'function donateUrlFor(') === 1 && count(page, 'function donateTierList(') === 1,
    'the link builder or the tier list is missing');
  must(count(page, 'PAYMENT_CONFIG.donateLinks') >= 2 && count(page, "donateUrl: '',") === 1,
    'the amount table or the templated field is missing');
  for(const [amt, url] of LINKS){
    must(count(page, amt + ": '" + url + "',") === 1, 'the card page for $' + amt + ' is not the one in the file');
  }
  must(count(page, "const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") === 1 &&
    count(page, "const tierList = SC_IS_PLAY ? '' : donateTierList();") === 1,
    'the store build is not held to Billing');
  must(count(page, 'const web = donateUrlFor(amt);') === 0,
    'an ungated lookup survived, so the store build can reach a card page');
  must(count(page, "window.open(web, '_blank', 'noopener'); }catch(_eDon){ }") === 1,
    'the web route does not open the built link');
  must(count(page, 'runTip(sku, amt);') === 1 && count(page, 'async function runTip(sku, amt){') === 1,
    'the tapped amount does not reach the tip');
  must(count(page, "' Tip ' + tierList + '") === 1,
    'an amount with no page does not say which ones have one');
  must(count(page, 'id="donatePromise"') === 1 && count(page, 'id="donateIntro"') === 1 &&
    count(page, "const promise = $('donatePromise');") === 1 && count(page, 'if(promise && !SC_IS_PLAY){') === 1,
    'the two sentences a card page changes are not both named and both gated');
  must(count(page, 'a tip helps keep it running and improving \u2014 processed through Google Play. Thank you!') === 1,
    'the store build lost the sentence it ships');
  // The store build's copy.
  must(count(page, 'MP3s from external sources work too') === 1 &&
    count(page, 'Audio from external sources works too') === 1 &&
    count(page, 'MP3s from external sources work the same way') === 1 &&
    count(page, 'Audio from external sources works as well') === 1,
    'the store build does not say where the audio can come from');
  must(count(page, "'getSongsHowToDisc','getSongsHowToSettings'") === 1,
    'the walkthrough the store build shows is not the one rewritten');
  // The release.
  must(count(page, "const APP_VERSION = '70.1.9';") === 1, 'the version is not 70.1.9');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.1.9',") === 1 && count(page, "  { version: '70.1.8',") === 1 &&
    count(page, "  { version: '70.1.7',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(!/\bmp3\b|\bdownload|converter|\bconvert\b/i.test(NOTES.join('\n')),
    'a note reads as a music downloader on the wider store list');
  must(!/play build|play version|play install/i.test(NOTES.join('\n')),
    'a note names the other build');
  must(/(studio|player|dock|premium|license)/i.test(NOTES.join('\n')),
    'and none of them names a surface this app has');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, 'a copy that cannot bill has no card page to open') === 1,
    'the new gate rule did not land');
  must(count(studio.text, '[11l] a tip from a copy that cannot bill') === 1 &&
    count(studio.text, '[11m] the copy installed from Google Play is the app it was') === 1 &&
    count(studio.text, 'if (play) win.__PLAY_BUILD__ = true;') === 1,
    'the real-app probe does not drive both builds');
  // The release before this one is still pinned.
  must(count(t705.text, '[10e] SAVE COPY in DJ Mode') === 1, 'the 70.1.8 gate rule left with this release');
  must(count(studio.text, '[11k] SAVE COPY says what it needs') === 1, 'the 70.1.8 probe section left');
}

if(problems.length){
  console.error('patch-7019: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7019: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7019: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7019: next `node dev/repin-7019.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
