#!/usr/bin/env node
/**
 * SideCut 70.1.5 - donations reach the copies Google Play will not sell to.
 *
 * The user's words: "make donations work on the apk".
 *
 * WHY THE APK COULD NOT DONATE. SideCut ships two Android packages. The `play`
 * flavour is com.SideCut.myapp, the one in the Play listing, and Google Play
 * Billing sells inside it. The `full` flavour is a separate package that Play has
 * never heard of, so Play has no products to offer it and never will: billing
 * inside a sideloaded copy is a lookup that returns nothing, not a permission
 * problem that can be worked around in code. That is a rule of the store, not a
 * bug in the app, and no amount of billing code changes it.
 *
 * WHAT 70.1.3 DID. Nothing the paywall removal touched - the tip tiers, the Play
 * products and the billing call are all unchanged. It added a route out: a copy
 * that cannot bill is told so and the Play listing is opened, which is honest but
 * is still not a tip. The money only moves after the user installs a different
 * build and comes back.
 *
 * WHAT THIS RELEASE DOES. It gives those copies a payment rail that does not go
 * through Google at all: a hosted donation page. `PAYMENT_CONFIG.donateUrl` is
 * the setting, and when it is set a tap on a tier opens it in the browser instead
 * of stopping at a sentence. `{amt}` in the URL is replaced with the tier that
 * was tapped, which is how PayPal.me and Cash App carry a number in the path; a
 * URL without it opens exactly as configured and the page picks the amount up
 * (that is what a Stripe Payment Link set to "let customers choose what they pay"
 * does). With no URL set, the Play listing stays the only route out and the pane
 * behaves exactly as it did in 70.1.3.
 *
 * WHY NOT JUST RESTORE THE PLAY ROUTE. It is still there, underneath, and it is
 * still the fallback. What was missing is a way to actually pay from the copy the
 * user has installed.
 *
 *   SC_DONATE_URL='https://...' node dev/patch-7015.mjs
 *   SC_DONATE_URL='https://...' node dev/patch-7015.mjs --check   # report only
 *
 * The URL is required rather than defaulted: a release that ships an empty
 * donation route would be indistinguishable from 70.1.3 while claiming not to be.
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
const VERSION = '70.1.5';
const PREV = '70.1.4';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 29, 2026 \u00b7 8:57 PM EDT';
const CACHE = 'sidecut-shell-v63.0.41';
const OLDCACHE = 'sidecut-shell-v63.0.40';
const TITLE = 'Donations reach the sideloaded APK: a tap on a tip tier opens a card page on the web instead of stopping at the Play listing';

// The one thing this release needs from the outside world: a hosted tip page.
const DONATE = String(process.env.SC_DONATE_URL || '').trim();

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), none says "download", none uses "play build", "play version" or "play
// install" - test-662, test-6642 and test-66421 refuse those - and the set names a
// surface the 662 surface rule looks for (player, dock, Studio).
const NOTES = [
  'Donations work on the APK. Google Play only sells inside the copy Google Play distributed, so the package this repo builds for sideloading had nothing to charge and every tip ended at a sentence telling you to install a different build. A tip there opens a real card page in the browser now, and the money moves.',
  'The tip tiers mean the same thing everywhere. Tip five dollars on the copy from Google Play and the Play sheet still opens; the same tap on the APK or in a browser opens the donation page, with the amount already set where the page takes one and chosen on the page where it does not.',
  'The donation page is one setting. It is the donateUrl in the PAYMENT_CONFIG block near the top of the paid-features module, and any hosted page will do: a payment link, a PayPal link or a Cash App link, with the tapped amount dropped into the one placeholder the page understands.',
  'The browser gets the same route. SideCut in a plain browser tab cannot bill either, so the Donate tab there opens the donation page instead of sending you off to another copy first - which is where a tip from a tab used to end.',
  'Nothing about the app changes when you tip, and nothing changes if you do not. A tip unlocks nothing on purpose: the player, the dock and the library are the same app whether a tip was made or not, on the APK exactly as on the Play copy.',
  'Nothing else moved in this release. The badge wall is still two hundred and one tiles with the same five rewards, Studio is untouched, and Donate is still the only thing SideCut asks anybody for.',
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
  console.log('patch-7015: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

if(!DONATE){
  problems.push('SC_DONATE_URL is missing - this release exists to ship a donation page, so there is nothing to apply without one');
} else if(!/^https:\/\/[^\s'\\]+$/.test(DONATE)){
  problems.push('SC_DONATE_URL must be a plain https URL with no quote, backslash or space in it (got: ' + DONATE + ')');
} else if(/^https:\/\/(play\.google\.com|buy\.stripe\.com)?\/?$/.test(DONATE)){
  problems.push('SC_DONATE_URL is not a page (got: ' + DONATE + ')');
}

/* ============================================ A. THE ROUTE OUT OF THE DONATE TAB */
// The config block has held one field since 70.1.3 - the Play listing - and this
// is the second one. It is deliberately last: everything above it is unchanged
// and the diff should read as one field added.
sub(html, 'PAYMENT_CONFIG.donateUrl',
  "    playStoreListing: 'https://play.google.com/store/apps/details?id=com.SideCut.myapp',\n" +
  '  };\n',
  "    playStoreListing: 'https://play.google.com/store/apps/details?id=com.SideCut.myapp',\n" +
  '    // 70.1.5 - the web route out. Google only sells inside the copy it\n' +
  '    // distributed, so a copy that came from anywhere else - the sideloaded APK\n' +
  '    // this repo builds, and a plain browser - had nothing to charge and every\n' +
  '    // tip ended at "install the Play build", with no tip possible anywhere.\n' +
  '    // Set this to a hosted donation page and a tap on a tier opens it instead.\n' +
  '    // `{amt}` is replaced with the tier that was tapped, which is how PayPal.me\n' +
  '    // and Cash App take a number in the path; a URL without it opens as it is\n' +
  '    // and the page picks the amount up. Empty keeps the Play listing as the\n' +
  '    // only route out, exactly as 70.1.3 left it.\n' +
  "    donateUrl: '" + DONATE + "',\n" +
  '  };\n',
  { key: 'donateUrl:' });

// The link builder. Kept beside the billing code it stands in for, and tolerant
// on purpose: an unset URL and a templated URL asked for no amount both come back
// empty, which is the same "there is no web route" answer the caller branches on.
sub(html, 'donateUrlFor',
  '  async function purchasePlayTip(sku){\n' +
  '    return purchasePlayItem(sku, true);\n' +
  '  }\n',
  '  // 70.1.5. The web donation link for a chosen amount. `{amt}` in the configured\n' +
  '  // URL is replaced with the tier that was tapped - that is how a PayPal.me or a\n' +
  '  // Cash App link carries a number - and a URL without the placeholder opens\n' +
  '  // exactly as it was set, with the amount chosen on the page. An empty result\n' +
  '  // means there is no web route and the caller falls back to the Play listing.\n' +
  '  function donateUrlFor(amt){\n' +
  "    const base = String(PAYMENT_CONFIG.donateUrl || '').trim();\n" +
  "    if(!base) return '';\n" +
  "    if(base.indexOf('{amt}') === -1) return base;\n" +
  '    const n = parseInt(amt, 10);\n' +
  '    if(!isFinite(n) || n <= 0) return \'\';\n' +
  "    return base.split('{amt}').join(String(n));\n" +
  '  }\n\n' +
  '  async function purchasePlayTip(sku){\n' +
  '    return purchasePlayItem(sku, true);\n' +
  '  }\n',
  { key: 'function donateUrlFor(' });

/* ======================================== B. A TAP THE APK CAN ACTUALLY COMPLETE */
// runTip now carries the amount as well as the product id, because the web route
// needs the number the user tapped and the Play route does not.
sub(html, 'runTip signature', '    async function runTip(sku){\n', '    async function runTip(sku, amt){\n',
  { key: 'async function runTip(sku, amt){' });

sub(html, 'runTip web route',
  '      // 70.1.3: this is the APK and the browser, which have no Billing at all.\n' +
  '      // A tip still cannot be made here - but the install that CAN make one is\n' +
  '      // one tap away, so the message ends in the Play listing instead of a stop.\n' +
  "      msg.textContent = (reason || 'Tips are processed through Google Play and only work inside the SideCut app installed from Play.') +\n" +
  "        ' Opening the Play Store so you can install that copy.';\n",
  '      // 70.1.5: this is the APK built for sideloading and the browser, and this\n' +
  '      // is the branch that used to end the tip. Google will never sell to a copy\n' +
  '      // it did not distribute, so the only way a tip can be made here is off the\n' +
  '      // store entirely - a hosted donation page. With one configured the tap goes\n' +
  '      // there and the money moves; with none set the Play listing below is still\n' +
  '      // the route out, exactly as 70.1.3 left it.\n' +
  '      const web = donateUrlFor(amt);\n' +
  '      if(web){\n' +
  "        msg.style.color = 'var(--coral)';\n" +
  "        msg.textContent = 'Google Play only sells inside the copy it distributed, so this tip is opening the donation page in your browser instead' +\n" +
  "          (String(PAYMENT_CONFIG.donateUrl).indexOf('{amt}') === -1 ? ' - you can pick the amount there.' : ' for $' + (parseInt(amt, 10) || 0) + '.') +\n" +
  "          ' Thank you for chipping in.';\n" +
  "        try{ window.open(web, '_blank', 'noopener'); }catch(_eDon){ }\n" +
  '        return;\n' +
  '      }\n' +
  "      msg.textContent = (reason || 'Tips are processed through Google Play and only work inside the SideCut app installed from Play.') +\n" +
  "        ' Opening the Play Store so you can install that copy.';\n",
  { key: 'const web = donateUrlFor(amt);' });

sub(html, 'the tier hands its amount to runTip',
  '        runTip(sku);\n', '        runTip(sku, amt);\n',
  { key: 'runTip(sku, amt);' });

/* ================================================= C. WHAT THE PANE SAYS IT DOES */
// 70.1.3's copy promised Google Play and nothing else. Both rails are real now, so
// the pane names both rather than describing the copy the user might not have.
sub(html, 'the pane promise',
  'Pick an amount \u2014 Google Play handles the payment.',
  'Pick an amount \u2014 Google Play takes it inside the copy installed from Play, and a secure card page takes it in every other copy.',
  { key: 'and a secure card page takes it in every other copy' });

sub(html, 'the pane description',
  'processed through Google Play. Thank you!',
  'processed through Google Play inside the copy installed from Play, and through a secure card page everywhere else. Thank you!',
  { key: 'and through a secure card page everywhere else' });

/* ===================================================== D. THE RELEASE METADATA */
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

/* ==================================================================== E. THE GATES */
// test-705 is the standing 70.x gate. The structural claims below are about the
// route rather than about the URL, because the URL is a build-time setting and
// this gate runs on whatever page is in front of it.
sub(t705, 'test-705 web route',
  "  ok(count('donate-quick') >= 12 && count('PAYMENT_CONFIG.playStoreListing') >= 2,\n" +
  "     'or the tip buttons, or the route out for a copy that cannot bill');\n",
  "  ok(count('donate-quick') >= 12 && count('PAYMENT_CONFIG.playStoreListing') >= 2,\n" +
  "     'or the tip buttons, or the route out for a copy that cannot bill');\n" +
  '  // 70.1.5. A copy that cannot bill is not sent away any more: with a donation\n' +
  '  // page configured, the tap goes there. Structural, because the URL itself is a\n' +
  '  // build-time setting - what has to be true is that the route exists, that it is\n' +
  '  // the fallback branch that takes it, and that the tier the user tapped is the\n' +
  '  // amount that travels with the link.\n' +
  "  ok(count('function donateUrlFor(') === 1 && count('PAYMENT_CONFIG.donateUrl') >= 2,\n" +
  "     'a copy that cannot bill has no web route out of the Donate tab');\n" +
  "  ok(count('const web = donateUrlFor(amt);') === 1 && count('runTip(sku, amt);') === 1,\n" +
  "     'or the tip that cannot be billed never asks for that link');\n" +
  "  ok(count(\"return base.split('{amt}').join(String(n));\") === 1,\n" +
  "     'and the amount on the tier does not travel with it');\n",
  { key: 'a copy that cannot bill has no web route out of the Donate tab' });

// The real-app probe is where this is actually DRIVEN: jsdom has no
// window.Capacitor, which is the APK and the browser exactly, so a tap on a tier
// takes the branch this release exists to add. It reads the configured URL out of
// the page instead of hard-coding one, so the same section is meaningful whatever
// the build ships - and a tree with no page configured still has to fall back.
sub(studio, 'studio-70 donate drive',
  "  console.log('[12] the page still holds together');\n",
  '  // 70.1.5. The sideloaded APK and the browser have no Play Billing at all, and\n' +
  '  // jsdom is that environment exactly: window.Capacitor is undefined, so the\n' +
  "  // billing call answers 'unavailable' and used to end the tip at a sentence.\n" +
  '  // What has to be true now is that the tap leaves for the configured donation\n' +
  '  // page with the tier that was tapped in it, and that a tree with no page\n' +
  '  // configured still falls back to the Play listing rather than doing nothing.\n' +
  "  console.log('[11f] a tip from a copy that cannot bill');\n" +
  '  {\n' +
  "    const conf = html.match(/donateUrl: '([^']*)'/);\n" +
  "    ok(!!conf, 'the Donate tab names where a copy that cannot bill goes');\n" +
  '    if (conf) {\n' +
  '      const configured = conf[1];\n' +
  '      const realOpen = win.open;\n' +
  '      const opened = [];\n' +
  '      Object.defineProperty(win, \'open\', { value: (url) => { opened.push(String(url)); return null; }, writable: true, configurable: true });\n' +
  "      win.showSettingsTab('donate');\n" +
  "      const pane = doc.querySelector('#settingsPaneDonate');\n" +
  '      const btn = pane && pane.querySelector(\'.donate-quick[data-amt="5"]\');\n' +
  "      ok(!!btn, 'the five dollar tier is still a button in the pane');\n" +
  '      if (btn) {\n' +
  '        btn.click();\n' +
  '        await wait(200);\n' +
  '        const want = configured\n' +
  "          ? configured.split('{amt}').join('5')\n" +
  "          : 'https://play.google.com/store/apps/details?id=com.SideCut.myapp';\n" +
  '        ok(opened.length === 1 && opened[0] === want,\n' +
  "          'and tapping it opens ' + (configured ? 'the donation page' : 'the Play listing') + ' (' + (opened[0] || 'nothing') + ')');\n" +
  "        const msg = doc.querySelector('#donateMsg');\n" +
  "        ok(!!msg && msg.textContent.length > 20, 'with a sentence saying where it went');\n" +
  '      }\n' +
  '      Object.defineProperty(win, \'open\', { value: realOpen, writable: true, configurable: true });\n' +
  '    }\n' +
  '  }\n\n' +
  "  console.log('[12] the page still holds together');\n",
  { key: "[11f] a tip from a copy that cannot bill" });

/* ============================================================ F. WHAT MUST STILL HOLD */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // Nothing about the removal or the surviving tip rail may have moved.
  must(count(page, 'settingsPanePremium') === 0 && count(page, 'isPremiumActive') === 0,
    'Premium came back with this release');
  must(count(page, "id=\"settingsTabDonate\"") === 1 && count(page, "id=\"settingsPaneDonate\"") === 1 &&
    count(page, 'function initDonateTab(){') === 1,
    'the Donate tab left with the release');
  must(count(page, 'const PLAY_TIP_PRODUCTS = {') === 1 && count(page, 'purchasePlayTip') === 2,
    'the tip tiers and the Play call are not both intact');
  must(count(page, 'donate-quick') >= 12, 'the tip buttons are not all there');
  must(count(page, 'playStoreListing') === 3,
    'the Play listing is not used exactly twice in code and once in the config');
  // The route itself.
  must(count(page, 'function donateUrlFor(') === 1 && count(page, '{amt}') >= 2,
    'the link builder or its placeholder is missing');
  must(count(page, 'const web = donateUrlFor(amt);') === 1 &&
    count(page, "window.open(web, '_blank', 'noopener'); }catch(_eDon){ }") === 1,
    'the web route does not open the built link');
  must(count(page, 'runTip(sku, amt);') === 1 && count(page, 'async function runTip(sku, amt){') === 1,
    'the tapped amount does not reach the tip');
  must(count(page, "donateUrl: '" + DONATE + "',") === 1,
    'the configured donation page is not the one in the file');
  // The release.
  must(count(page, "const APP_VERSION = '70.1.5';") === 1, 'the version is not 70.1.5');
  must(count(page, "date: 'September 29, 2026 \u00b7 8:57 PM EDT'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.1.5',") === 1 && count(page, "  { version: '70.1.4',") === 1 &&
    count(page, "  { version: '70.1.3',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(count(page, "'{amt}',") === 0, 'a note leaked the placeholder as its own literal');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, 'a copy that cannot bill has no web route out of the Donate tab') === 1,
    'the new gate rule did not land');
  must(count(studio.text, '[11f] a tip from a copy that cannot bill') === 1,
    'the real-app probe does not drive the web route');
}

if(problems.length){
  console.error('patch-7015: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7015: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7015: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7015: next `node dev/repin-7015.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
