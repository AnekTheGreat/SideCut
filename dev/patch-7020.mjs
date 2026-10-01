#!/usr/bin/env node
/**
 * SideCut 70.2.0 - the tip rail works from the sideloaded package, and a page the
 * app opens really opens.
 *
 * The user's words: "The stripe isn't linked on the apk like it should while on the
 * Web it is". Both halves of that sentence were true, and they are two separate
 * defects - the web copy worked because it failed in the ONE way 70.1.9 handled,
 * and the APK failed in the two ways it did not.
 *
 * 1. THE APK DOES NOT FAIL THE WAY THE BROWSER DOES. `runTip` reached the card page
 *    only from the `'unavailable'` branch - the answer you get when `getPlayBilling-
 *    Service()` finds no plugin at all, which is exactly what a plain browser is.
 *    The sideloaded package ships `@capgo/native-purchases`, so the plugin IS there
 *    and `purchasePlayItem` gets as far as asking Play: a package Play never
 *    distributed has no products, so it comes back `'not-found'`, or `'error'` when
 *    the sheet itself refuses. Both of those branches returned early with a
 *    sentence, so the card page was never reached from the one copy that needs it.
 *    The card-page lookup now sits above both of them: the rail a copy can use is a
 *    property of the copy, not of the way Play declined. A deliberate `'cancelled'`
 *    still stops the tip - a user who backed out of the Play sheet did not ask to
 *    be sent to Stripe instead. The store build is untouched: `SC_IS_PLAY` keeps it
 *    out of the lookup entirely.
 *
 * 2. `window.open()` DOES NOTHING IN THIS WEBVIEW. Capacitor's WebView has no
 *    window support, so `window.open(url, '_blank', 'noopener')` answers null and no
 *    window is ever created - the app says so itself next to the Spotify handoff
 *    ("Capacitor's WebView cannot open new windows"), which is why that code already
 *    falls back to `window.location.href`. Assigning an address whose host is not in
 *    `allowNavigation` is handed to Android as an ACTION_VIEW intent, so the system
 *    browser takes it - which is what "opens the card page in your browser" always
 *    promised. Both the card page and the Play listing go through the new
 *    `scOpenExternal()` helper, which is that idiom in one place: try the window,
 *    fall back to the address, never silently do nothing.
 *
 * The probe now boots the app three ways - plain (the browser), `__PLAY_BUILD__`
 * (the store build) and `apk` (Capacitor, with a Billing plugin that reports itself
 * supported and has no products, which is what the sideloaded package really is) -
 * and the third one drives the exact reported path: a tap on Tip $5 must open
 * https://buy.stripe.com/28E4gyb6vfUn1P2dsUdMI01 with the address handed over rather
 * than only window.open().
 *
 *   node dev/patch-7020.mjs
 *   node dev/patch-7020.mjs --check   # report only
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
const VERSION = '70.2.0';
const PREV = '70.1.9';
// Eastern is UTC-4 and the DATE rolls back with it (the rule at APP_VERSION).
// A stamp in the FUTURE is a gate failure (test-6643 allows the next 15 minutes).
const STAMP = 'September 30, 2026 \u00b7 5:52 PM EDT';
const CACHE = 'sidecut-shell-v63.0.46';
const OLDCACHE = 'sidecut-shell-v63.0.45';
const TITLE = 'A tip from the sideloaded package reaches the card page, and a page the app opens really opens';

// Six notes. None carries an apostrophe (a note is emitted into a single-quoted
// literal), and none may read as a music downloader on the WIDER list
// dev/test-play-copy.mjs audits the store build against - which includes the word
// mp3, download, convert, "get song", "save the file" and "hand-off". test-662,
// test-6642 and test-66421 refuse the same words, plus "play build", "play
// version" and "play install". One note names a surface the 662 rule looks for.
const NOTES = [
  'Tipping from the sideloaded package works, and this is the bug the release before this one missed: the package Google Play will not sell to could not bill, but it only reached the card page when Billing was missing outright - and inside that package Billing is not missing, Play simply declines, which is a different answer. Every way Play can decline now lands on the card page when the tier has one.',
  'A tap that opens a page really opens it on Android. This WebView cannot open a new window, so a link opened that way went nowhere: the card page and the listing were both handed to a window that was never created. The fallback gives the address to Android the way this app already hands an outside link over, so the browser takes it.',
  'Two, five, ten, twenty-five and fifty each have their own card page, for the package built for sideloading and for a browser tab. The copy installed from Google Play keeps Billing, and its Donate pane is exactly the one the release before this one shipped.',
  'A tier with no page of its own says so instead of going quiet. Tapping one explains that the amount is set up through Google Play and names the amounts that do have a page here.',
  'Nothing unlocks when you tip, and nothing changes if you do not. The player, the dock and the library are the same app whether a tip was made or not, on the standalone package exactly as on the copy from Google Play.',
  'Nothing else moved in this release. The badge wall, Studio, the DJ Mode deck and the library tools are the ones the release before this one left, and a library saved before it comes back the same way.',
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
  console.log('patch-7020: tree is already at ' + VERSION + ' - nothing to apply');
  process.exit(0);
}

/* ================================ A. THE OPEN THAT ACTUALLY OPENS ON ANDROID ==== */
// One place, because it is the same defect everywhere it appears: a link that is
// handed to `window.open` in this WebView is handed to a window that is never
// created. The second half is the app's own long-standing fallback (see the Spotify
// authorization window): assign the address, and Capacitor turns a host that is not
// in allowNavigation into an ACTION_VIEW intent for the system browser.
sub(html, 'the open helper',
  '  // ---------------- Donate tab ----------------\n',
  block([
    '  // 70.2.0. Opening a page OUTSIDE this app from the Android build. Capacitor\'s',
    '  // WebView cannot open a new window - the app says so itself beside the Spotify',
    '  // handoff - so window.open() answers null there and nothing happens at all. A',
    '  // link that only used it was "opened" into a window that was never created,',
    '  // which is why the Donate tab could say it was opening a browser page and then',
    '  // sit there. The fallback is the idiom this app already uses for exactly this:',
    '  // assign the address, which Capacitor hands to Android as an ACTION_VIEW intent',
    '  // because the host is not in allowNavigation, so the browser takes it. Desktop',
    '  // and the browser copy never reach the fallback.',
    '  function scOpenExternal(url){',
    '    try{',
    '      if(!url) return false;',
    "      if(window.open(String(url), '_blank', 'noopener')) return true;",
    '    }catch(_eOpen){ }',
    '    try{',
    '      window.location.href = String(url);',
    '      return true;',
    '    }catch(_eHref){ }',
    '    return false;',
    '  }',
    '',
    '  // ---------------- Donate tab ----------------',
    '  // Tips go through Play Billing (consumable products) inside the Play-installed',
    '  // app. A copy Google Play did not distribute - the package this repo builds for',
    '  // sideloading, and a plain browser tab - has no Billing and no products to sell,',
    '  // so it pays on a hosted card page instead (PAYMENT_CONFIG.donateLinks).',
    '  //',
  ]),
  { key: 'function scOpenExternal(url){' });

/* ============================== B. EVERY DECLINED TIP REACHES THE CARD PAGE ==== */
// The old text: the card-page block lived INSIDE the 'unavailable' branch, below
// the 'not-found' and 'error' returns. It is removed from there first (its anchor
// has to be unique when the new block is inserted above them), then put back above
// both of them.
sub(html, 'the card block leaves the unavailable branch',
  block([
    "      msg.style.color = 'var(--ink-dim)';",
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
  ]),
  block([
    "      msg.style.color = 'var(--ink-dim)';",
  ]),
  // THE KEY IS NOT THE TEXT THIS SUB REMOVES. `const web = SC_IS_PLAY` is what the
  // removal deletes, so keying on it skipped the sub on the FIRST run while
  // `--check` reported nothing wrong - the 70.1.7 trap. The key is a phrase the
  // insertion below adds, which is absent before and present after.
  { key: 'a property of the copy, not of how Play declined' });

sub(html, 'the card block goes above every failure',
  block([
    "      if(result === 'not-found'){",
  ]),
  block([
    '      // 70.2.0 - EVERY WAY PLAY CAN DECLINE REACHES THE CARD PAGE, not only the',
    '      // one where the plugin is missing. On the package this repo builds for',
    '      // sideloading the plugin IS present, so Play is actually asked - and a',
    '      // package Google Play never distributed answers \'not-found\' (no products)',
    '      // or \'error\' (the sheet refused), while a plain browser answers',
    '      // \'unavailable\'. Both of those used to end the tip at a sentence, which is',
    '      // exactly "the stripe is not linked on the apk while on the web it is". The',
    '      // rail a copy can use is a property of the copy, not of how Play declined.',
    '      //',
    '      // A DELIBERATE CANCEL IS NOT ONE OF THEM: the branch above returns first,',
    '      // because someone who backed out of the Play sheet did not ask to be sent',
    '      // to a card page instead.',
    '      //',
    '      // THE STORE BUILD IS NOT A PART OF THIS AT ALL. A copy installed from',
    '      // Google Play has Billing, so it never looks a card page up and never names',
    '      // one - every sentence below is then exactly what 70.1.3 shipped.',
    "      const web = SC_IS_PLAY ? '' : donateUrlFor(amt);",
    '      if(web){',
    "        msg.style.color = 'var(--coral)';",
    "        msg.textContent = 'Google Play only sells inside the copy it distributed, so this tip is opening a secure card page in your browser for $' +",
    "          (parseInt(amt, 10) || 0) + ' instead. Thank you for chipping in.';",
    '        scOpenExternal(web);',
    '        return;',
    '      }',
    "      if(result === 'not-found'){",
  ]),
  { key: 'EVERY WAY PLAY CAN DECLINE REACHES THE CARD PAGE' });

// The reason string is only asked for when the plugin really was missing, and the
// sentence that uses it is now the last resort rather than the second one.
sub(html, 'the unavailable tail says what it always said',
  block([
    "      // 'unavailable': the Digital Goods / Payment Request API isn't",
    '      // available. Report the specific reason instead of a generic fallback.',
  ]),
  block([
    "      // 'unavailable': no Billing in this copy at all (a plain browser, or a build",
    '      // without the plugin). Report the specific reason instead of a generic',
    '      // fallback, and name the amounts that DO have a card page here. An amount',
    '      // that has one never arrives here - the block above returned already.',
  ]),
  { key: "// 'unavailable': no Billing in this copy at all" });

sub(html, 'the listing goes through the same open',
  block([
    '      if(PAYMENT_CONFIG.playStoreListing){',
    "        try{ window.open(PAYMENT_CONFIG.playStoreListing, '_blank', 'noopener'); }catch(_eDon){ }",
    '      }',
  ]),
  block([
    '      if(PAYMENT_CONFIG.playStoreListing) scOpenExternal(PAYMENT_CONFIG.playStoreListing);',
  ]),
  { key: 'scOpenExternal(PAYMENT_CONFIG.playStoreListing)' });

/* ===================================================== C. THE RELEASE METADATA */
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

/* ==================================================================== D. THE GATES */
// test-705 is the standing 70.x gate: the structural half of the same two claims.
sub(t705, 'test-705 the open and the order',
  block([
    "  ok(count('donateLinks: {') === 1 && count('PAYMENT_CONFIG.donateLinks') >= 2 &&",
    "     count(\"return base.split('{amt}').join(String(n));\") === 1,",
    "     'or an amount without a page of its own has nowhere to go');",
  ]),
  block([
    "  ok(count('donateLinks: {') === 1 && count('PAYMENT_CONFIG.donateLinks') >= 2 &&",
    "     count(\"return base.split('{amt}').join(String(n));\") === 1,",
    "     'or an amount without a page of its own has nowhere to go');",
    '  // 70.2.0. Two claims, and the second is the one the APK proved was missing.',
    '  // (a) A page opened from the Android build has somewhere to go: a WebView has',
    '  // no windows, so window.open() alone is a link that goes nowhere. (b) The card',
    '  // page is looked up ABOVE the not-found and error returns, because the package',
    '  // this repo builds for sideloading fails in exactly those two ways - it has the',
    '  // Billing plugin, and Play simply declines.',
    "  ok(count('function scOpenExternal(url){') === 1 && count('window.location.href = String(url);') === 1 &&",
    "     count(\"if(window.open(String(url), '_blank', 'noopener')) return true;\") === 1,",
    "     'a page this app opens from the Android build has somewhere to go');",
    "  ok(count('scOpenExternal(web);') === 1 && count('scOpenExternal(PAYMENT_CONFIG.playStoreListing);') === 1 &&",
    "     count(\"try{ window.open(web, '_blank', 'noopener'); }catch(_eDon){ }\") === 0,",
    "     'and neither the card page nor the listing is opened into a window that cannot exist');",
    "  ok(src.indexOf(\"const web = SC_IS_PLAY ? '' : donateUrlFor(amt);\") < src.indexOf(\"if(result === 'not-found'){\") &&",
    "     count(\"const web = SC_IS_PLAY ? '' : donateUrlFor(amt);\") === 1,",
    "     'with the lookup above the failures, so a decline for any reason still reaches it');",
  ]),
  { key: 'a page this app opens from the Android build has somewhere to go' });

// The real-app probe boots three ways now. `mode` replaces the boolean so the
// sideloaded package - Capacitor, Billing present, Play refusing - can be driven
// instead of reasoned about, and it is the copy the user reported broken.
sub(studio, 'studio-70 boots by mode',
  'function boot(play) {\n',
  'function boot(mode) {\n',
  { key: 'function boot(mode) {' });

sub(studio, 'studio-70 stands in for the sideloaded apk',
  '      win.confirm = () => true;\n',
  block([
    '      win.confirm = () => true;',
    '      // A fake Capacitor for the apk boot: see fakeCapacitor() below.',
    "      if (mode === 'apk') win.Capacitor = fakeCapacitor();",
  ]),
  { key: "if (mode === 'apk') win.Capacitor = fakeCapacitor();" });

sub(studio, 'studio-70 sets the store flag before the scripts run',
  '      if (play) win.__PLAY_BUILD__ = true;\n',
  "      if (mode === 'play') win.__PLAY_BUILD__ = true;\n",
  { key: "if (mode === 'play') win.__PLAY_BUILD__ = true;" });

sub(studio, 'studio-70 the fake bridge',
  'function boot(mode) {\n',
  block([
    '// 70.2.0. The sideloaded package is NOT "no Capacitor" - it is Capacitor with a',
    '// Billing plugin that Play refuses, which is a different answer from the browser',
    '// and the one that was broken. This stands in for it: the plugin reports itself',
    '// supported and then has no products, which is exactly what a package Google Play',
    '// never distributed gets back (getProducts -> [] -> "not-found").',
    'function fakeCapacitor() {',
    '  return {',
    '    isNativePlatform: () => true,',
    "    getPlatform: () => 'android',",
    '    Plugins: {',
    '      NativePurchases: {',
    '        isBillingSupported: async () => ({ isBillingSupported: true }),',
    "        getPluginVersion: async () => ({ version: '7.19.3' }),",
    '        getProducts: async () => ({ products: [] }),',
    "        purchaseProduct: async () => { throw new Error('BILLING_SETUP_FAILED'); },",
    '      },',
    '    },',
    '  };',
    '}',
    '',
    'function boot(mode) {',
  ]),
  { key: 'function fakeCapacitor() {' });

sub(studio, 'studio-70 the store boot asks by mode',
  '    const store = boot(true);\n',
  "    const store = boot('play');\n",
  { key: "const store = boot('play');" });

sub(studio, 'studio-70 drives the sideloaded package',
  "  console.log('[12] the page still holds together');\n",
  block([
    "  console.log('[11n] a tip from the sideloaded package, where Billing exists and refuses');",
    '  {',
    '    // 70.2.0. The user\'s report, driven: "the stripe is not linked on the apk',
    '    // while on the web it is". This boot IS that package - Capacitor present,',
    '    // NativePurchases present, Play answering with no products - and window.open',
    '    // stubbed to answer null the way the WebView does, so the address fallback is',
    '    // what has to carry the tap. jsdom reports the fallback as a refused',
    '    // navigation, which is how it can be seen at all.',
    '    const apk = boot(\'apk\');',
    '    await wait(1500);',
    '    const awin = apk.win;',
    '    const adoc = awin.document;',
    "    const links = {};",
    "    const dl = html.slice(html.indexOf('donateLinks: {'));",
    "    for (const m of dl.slice(0, dl.indexOf('}')).matchAll(/(\\d+): '(https:\\/\\/[^']+)'/g)) links[m[1]] = m[2];",
    "    awin.showSettingsTab('donate');",
    '    await wait(150);',
    '    const opened = [];',
    '    const realOpen = awin.open;',
    "    Object.defineProperty(awin, 'open', { value: (url) => { opened.push(String(url)); return null; }, writable: true, configurable: true });",
    "    const tier = adoc.querySelector('.donate-quick[data-amt=\"5\"]');",
    "    ok(!!tier, 'the five dollar tier is on the deck on the package built for sideloading');",
    '    if (tier) {',
    '      tier.click();',
    '      await wait(350);',
    "      ok(opened.length === 1 && opened[0] === links['5'],",
    "        'and a tap on it opens the card page the browser copy already reached (' + (opened[0] || 'nothing') + ')');",
    "      ok(apk.errors.some((e) => /Not implemented: navigation/.test(e)),",
    "        'because the address was handed to Android, not only to window.open()');",
    "      const said = adoc.querySelector('#donateMsg');",
    "      ok(!!said && /card page/i.test(said.textContent || ''),",
    "        'with a sentence saying where it went');",
    '    }',
    "    Object.defineProperty(awin, 'open', { value: realOpen, writable: true, configurable: true });",
    '  }',
    '',
    "  console.log('[12] the page still holds together');",
  ]),
  { key: '[11n] a tip from the sideloaded package' });

/* ============================================================ E. WHAT MUST STILL HOLD */
{
  const page = html.text;
  const must = (cond, msg) => { if(!cond) problems.push(msg); };

  // The rail itself.
  must(count(page, 'function scOpenExternal(url){') === 1 &&
    count(page, 'window.location.href = String(url);') === 1 &&
    count(page, "if(window.open(String(url), '_blank', 'noopener')) return true;") === 1,
    'the open helper is missing or has lost its fallback');
  must(count(page, 'scOpenExternal(web);') === 1 &&
    count(page, 'scOpenExternal(PAYMENT_CONFIG.playStoreListing);') === 1,
    'the card page or the listing does not go through it');
  must(count(page, "try{ window.open(web, '_blank', 'noopener'); }catch(_eDon){ }") === 0 &&
    count(page, "try{ window.open(PAYMENT_CONFIG.playStoreListing, '_blank', 'noopener'); }catch(_eDon){ }") === 0,
    'an open into a window that cannot exist survived');
  must(count(page, "const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") === 1 &&
    page.indexOf("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);") < page.indexOf("if(result === 'not-found'){"),
    'the card lookup is not above the not-found and error returns');
  must(count(page, "if(result === 'cancelled'){") === 1 &&
    page.indexOf("if(result === 'cancelled'){") < page.indexOf("const web = SC_IS_PLAY ? '' : donateUrlFor(amt);"),
    'a deliberate cancel now gets sent to a card page');
  // 70.1.9's rail and the store build's rule are untouched.
  must(count(page, 'function donateUrlFor(') === 1 && count(page, 'function donateTierList(') === 1 &&
    count(page, 'PAYMENT_CONFIG.donateLinks') >= 2 && count(page, "donateUrl: '',") === 1,
    'the amount table or the templated field is missing');
  must(count(page, "const tierList = SC_IS_PLAY ? '' : donateTierList();") === 1 &&
    count(page, 'if(promise && !SC_IS_PLAY){') === 1,
    'the store build is no longer held out of the card route');
  must(count(page, 'id="donatePromise"') === 1 && count(page, 'id="donateIntro"') === 1,
    'the two sentences a card page changes lost their names');
  // 70.1.9's store-build copy, still there.
  must(count(page, 'MP3s from external sources work too') === 1 &&
    count(page, 'Audio from external sources works too') === 1 &&
    count(page, 'MP3s from external sources work the same way') === 1 &&
    count(page, 'Audio from external sources works as well') === 1,
    'the store build does not say where the audio can come from');
  // The release.
  must(count(page, "const APP_VERSION = '70.2.0';") === 1, 'the version is not 70.2.0');
  must(count(page, "date: '" + STAMP + "'") === 1, 'the head stamp is not the one this release ships');
  must(count(page, "  { version: '70.2.0',") === 1 && count(page, "  { version: '70.1.9',") === 1 &&
    count(page, "  { version: '70.1.8',") === 1,
    'the changelog head did not move, or an older entry was overwritten');
  for(const note of NOTES) must(count(page, "'" + note + "',") === 1, 'a note did not land: ' + note.slice(0, 40));
  must(!/\bmp3\b|\bdownload|converter|\bconvert\b/i.test(NOTES.join('\n')),
    'a note reads as a music downloader on the wider store list');
  must(!/play build|play version|play install/i.test(NOTES.join('\n')), 'a note names the other build');
  must(/(studio|player|dock|premium|license)/i.test(NOTES.join('\n')),
    'and none of them names a surface this app has');
  must(count(sw.text, "const CACHE_NAME = '" + CACHE + "';") === 1, 'the shell cache did not move');
  must(count(sw.text, OLDCACHE) === 0, 'the old shell cache name survived in sw.js');
  // The gates.
  must(count(t705.text, "const VER = '70.0.5';") === 1, 'test-705 stopped describing 70.0.5');
  must(count(t705.text, 'a page this app opens from the Android build has somewhere to go') === 1,
    'the new gate rule did not land');
  must(count(studio.text, 'function fakeCapacitor() {') === 1 &&
    count(studio.text, '[11n] a tip from the sideloaded package') === 1 &&
    count(studio.text, "const apk = boot('apk');") === 1,
    'the real-app probe cannot boot the sideloaded package');
  must(count(studio.text, '[11m] the copy installed from Google Play is the app it was') === 1 &&
    count(studio.text, '[11l] a tip from a copy that cannot bill') === 1,
    'a 70.1.9 probe section left with this release');
}

if(problems.length){
  console.error('patch-7020: refusing to write, ' + problems.length + ' problem(s):');
  problems.forEach((p) => console.error('  - ' + p));
  process.exit(1);
}

if(CHECK){
  console.log('patch-7020: would apply ' + applied + ' edit(s), ' + already + ' already in place (' + VERSION + ')');
  process.exit(0);
}

const files = [[IDX, html.text], [SW, sw.text], [TEST705, t705.text], [STUDIO70, studio.text]];
const wrote = [];
for(const [file, text] of files){
  if(text !== fs.readFileSync(file, 'utf8')){ fs.writeFileSync(file, text); wrote.push(path.relative(ROOT, file)); }
}

console.log('patch-7020: ' + (wrote.length ? 'wrote ' + wrote.join(', ') : 'nothing to write') +
  ' - ' + applied + ' applied, ' + already + ' already in place (' + VERSION + ')');
console.log('patch-7020: next `node dev/repin-7020.mjs`, then `node dev/test-705.mjs`, then the OTA rebuild');
